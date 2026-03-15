/**
 * 增量阅读编辑器同步服务
 *
 * v5.0: 简化为块文件方案，移除旧 UUID 标记方案
 * - 方向 A：增量阅读编辑 → 块文件立即更新
 * - 方向 B：块文件编辑 → 增量阅读界面立即更新
 *
 * @deprecated findBlockBoundaryByUUID, extractContentByBoundary 已不再需要
 *
 * @module services/incremental-reading/IREditorSyncService
 * @version 5.0.0
 */
import { MarkdownView } from 'obsidian';
import { logger } from '../../utils/logger';
/** @deprecated v5.0: UUID 标记正则（仅用于兼容导出） */
const IR_UUID_REGEX = /<!--\s*weave-ir:\s*(ir-[a-z0-9]+)\s*-->/;
/** @deprecated v5.0: 起始标记正则（仅用于兼容导出） */
const IR_START_REGEX = /<!--\s*weave-ir-start\s*-->/;
/**
 * 根据 UUID 查找块边界
 *
 * 块边界规则：
 * - 开始：上一个 UUID 行之后 或 ir-start 之后 或文件开头
 * - 结束：当前 UUID 行之前（UUID行本身作为结束标记，不含在内容中）
 *
 * @param lines 文件内容按行分割
 * @param blockId 块UUID
 * @returns 块边界信息，未找到返回 null
 */
export function findBlockBoundaryByUUID(lines, blockId) {
    const uuidPattern = new RegExp(`<!--\\s*weave-ir:\\s*${blockId}\\s*-->`);
    // 找到目标 UUID 行
    let uuidLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (uuidPattern.test(lines[i])) {
            uuidLine = i;
            break;
        }
    }
    if (uuidLine === -1) {
        return null;
    }
    // 向上查找块起始位置
    let startLine = 0;
    for (let i = uuidLine - 1; i >= 0; i--) {
        const line = lines[i];
        // 遇到另一个 UUID 标记（上一个块的结束）
        if (IR_UUID_REGEX.test(line)) {
            startLine = i + 1;
            break;
        }
        // 遇到起始标记
        if (IR_START_REGEX.test(line)) {
            startLine = i + 1;
            break;
        }
    }
    return {
        startLine,
        endLine: uuidLine, // UUID行之前的内容
        uuidLine
    };
}
/**
 * 根据块边界提取内容
 * @param lines 文件内容按行分割
 * @param boundary 块边界
 * @returns 块内容（不含UUID行）
 */
export function extractContentByBoundary(lines, boundary) {
    const contentLines = lines.slice(boundary.startLine, boundary.endLine);
    return contentLines.join('\n');
}
/**
 * 增量阅读编辑器同步服务
 */
export class IREditorSyncService {
    app;
    callbacks = null;
    eventRef = null;
    modifyEventRef = null; // v5.4: 文件修改事件引用
    /** 防止循环更新的标记 */
    isLocalChange = false;
    /** 当前监听的文件路径 */
    currentFilePath = null;
    /** v5.4: 缓存的文件内容（用于变化检测） */
    cachedContent = null;
    constructor(app) {
        this.app = app;
    }
    /**
     * 初始化同步服务
     */
    initialize(callbacks) {
        this.callbacks = callbacks;
        this.registerEditorChangeListener();
        this.registerFileModifyListener(); // v5.4: 注册文件修改监听
        logger.debug('[IREditorSyncService] 同步服务已初始化');
    }
    /**
     * 设置当前监听的文件
     */
    setCurrentFile(filePath) {
        this.currentFilePath = filePath;
        this.cachedContent = null; // v5.4: 重置缓存
        logger.debug('[IREditorSyncService] 当前监听文件:', filePath);
    }
    /**
     * v5.4: 注册文件修改监听器（支持块文件方案）
     */
    registerFileModifyListener() {
        this.modifyEventRef = this.app.vault.on('modify', async (file) => {
            if (this.isLocalChange)
                return;
            if (!this.currentFilePath)
                return;
            if (file.path !== this.currentFilePath)
                return;
            // v5.0: 块文件方案 - 直接处理文件修改
            await this.handleChunkFileModify(file);
        });
    }
    /**
     * v5.4: 处理块文件修改事件
     */
    async handleChunkFileModify(file) {
        try {
            const content = await this.app.vault.read(file);
            // 移除 YAML frontmatter
            let bodyContent = content;
            const yamlMatch = content.match(/^---\n[\s\S]*?\n---\n/);
            if (yamlMatch) {
                bodyContent = content.substring(yamlMatch[0].length);
            }
            // 检查内容是否变化
            if (this.cachedContent !== null && bodyContent === this.cachedContent) {
                return; // 内容未变化
            }
            this.cachedContent = bodyContent;
            logger.debug('[IREditorSyncService] 块文件已修改，同步到界面:', file.path);
            this.callbacks?.onSourceChanged(bodyContent);
        }
        catch (error) {
            logger.warn('[IREditorSyncService] 读取块文件失败:', error);
        }
    }
    /**
     * 注册编辑器变化监听器
     */
    registerEditorChangeListener() {
        // 监听所有编辑器变化
        this.eventRef = this.app.workspace.on('editor-change', (editor, info) => {
            if (info instanceof MarkdownView) {
                this.handleEditorChange(editor, info);
            }
        });
    }
    /**
     * 处理编辑器变化事件
     */
    handleEditorChange(editor, info) {
        // 防止循环更新
        if (this.isLocalChange) {
            return;
        }
        // 检查是否是当前监听的文件
        const filePath = info.file?.path;
        if (!filePath || filePath !== this.currentFilePath) {
            return;
        }
        // 获取当前块信息
        const currentBlock = this.callbacks?.getCurrentBlock();
        if (!currentBlock) {
            return;
        }
        logger.debug('[IREditorSyncService] 检测到原文档变化:', filePath);
        // v5.0: 块文件方案 - 直接同步整个内容（移除 YAML frontmatter）
        const fullContent = editor.getValue();
        let bodyContent = fullContent;
        const yamlMatch = fullContent.match(/^---\n[\s\S]*?\n---\n/);
        if (yamlMatch) {
            bodyContent = fullContent.substring(yamlMatch[0].length);
        }
        // 检查内容是否变化
        if (this.cachedContent !== null && bodyContent === this.cachedContent) {
            return;
        }
        this.cachedContent = bodyContent;
        logger.debug('[IREditorSyncService] 块文件实时同步到界面');
        this.callbacks?.onSourceChanged(bodyContent);
    }
    /**
     * @deprecated v5.0: 旧 UUID 标记方案已移除，块文件方案不需要此方法
     * 同步内容到原文档（增量阅读 → 原文档）
     * @returns 总是返回 false，块文件方案应直接写入文件
     */
    syncToSourceDocument(_content, _block) {
        // v5.0: 块文件方案不使用 Editor API 同步，由 IRFocusInterface 直接写入文件
        logger.debug('[IREditorSyncService] syncToSourceDocument 已弃用，返回 false');
        return false;
    }
    /**
     * 查找已打开指定文件的 Leaf
     */
    findOpenLeaf(filePath) {
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view.file?.path === filePath) {
                return leaf;
            }
        }
        return null;
    }
    /**
     * 开始本地变化（防止循环）
     * 公共方法，供外部组件调用
     */
    beginLocalChange() {
        this.isLocalChange = true;
    }
    /**
     * 结束本地变化（延迟重置）
     * 公共方法，供外部组件调用
     */
    endLocalChange() {
        setTimeout(() => {
            this.isLocalChange = false;
        }, 50);
    }
    /**
     * 检查是否处于本地变化状态
     */
    isInLocalChange() {
        return this.isLocalChange;
    }
    /**
     * v5.4: 缓存当前内容（用于变化检测）
     */
    cacheCurrentContent(content) {
        this.cachedContent = content;
    }
    /**
     * 销毁服务
     */
    destroy() {
        if (this.eventRef) {
            this.app.workspace.offref(this.eventRef);
            this.eventRef = null;
        }
        if (this.modifyEventRef) {
            this.app.vault.offref(this.modifyEventRef);
            this.modifyEventRef = null;
        }
        this.callbacks = null;
        this.currentFilePath = null;
        this.cachedContent = null;
        logger.debug('[IREditorSyncService] 同步服务已销毁');
    }
}
