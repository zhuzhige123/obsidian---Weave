/**
 * 锚点管理服务
 *
 * 负责锚点的插入、解析和追踪
 * 锚点格式：^weave-bookmark-{timestamp}
 *
 * @module services/incremental-reading/AnchorManager
 * @version 1.0.0
 */
import { Notice } from 'obsidian';
import { ANCHOR_PREFIX, ANCHOR_REGEX, ReadingCategory } from '../../types/incremental-reading-types';
import { logger } from '../../utils/logger';
import { countWords, countWordsUpToPosition, estimateReadingTime, generateReadingUUID } from '../../utils/reading-utils';
/**
 * 锚点管理器
 */
export class AnchorManager {
    app;
    storage;
    yamlManager;
    constructor(app, storage, yamlManager) {
        this.app = app;
        this.storage = storage;
        this.yamlManager = yamlManager;
    }
    async isIRFile(file) {
        try {
            const cache = this.app.metadataCache.getFileCache(file);
            const fmType = cache?.frontmatter?.weave_type;
            if (typeof fmType === 'string' && fmType.startsWith('ir-')) {
                return true;
            }
        }
        catch {
            // ignore
        }
        try {
            const content = await this.app.vault.read(file);
            const match = content.match(/\bweave_type\s*:\s*([^\n\r]+)/);
            if (match?.[1]) {
                const t = match[1].trim().replace(/^['"]|['"]$/g, '');
                return t.startsWith('ir-');
            }
        }
        catch {
            // ignore
        }
        return false;
    }
    /**
     * 生成唯一的锚点ID
     */
    generateAnchorId() {
        return `${ANCHOR_PREFIX}${Date.now()}`;
    }
    /**
     * 在当前光标位置插入锚点
     * @param editor 编辑器实例
     * @param view Markdown视图
     * @returns 插入结果
     */
    async insertAnchorAtCursor(editor, view) {
        try {
            const file = view.file;
            if (!file) {
                return { success: false, error: '无法获取当前文件' };
            }
            if (await this.isIRFile(file)) {
                return { success: false, error: 'IR 文件不支持锚点标记' };
            }
            // 生成锚点ID
            const anchorId = this.generateAnchorId();
            const anchorText = `\n^${anchorId}\n`;
            // 获取当前光标位置
            const cursor = editor.getCursor();
            const lineContent = editor.getLine(cursor.line);
            // 在当前行末尾插入锚点
            const insertPosition = {
                line: cursor.line,
                ch: lineContent.length
            };
            editor.replaceRange(anchorText, insertPosition);
            logger.debug(`[AnchorManager] 插入锚点: ${anchorId} at line ${cursor.line}`);
            // 检查是否需要创建阅读材料
            let materialCreated = false;
            let material = await this.storage.getMaterialByPath(file.path);
            if (!material) {
                // 首次标记锚点，自动创建阅读材料
                material = await this.createMaterialForFile(file, anchorId);
                materialCreated = true;
                new Notice('已创建阅读材料并标记锚点');
            }
            else {
                // 更新现有材料的锚点
                await this.updateMaterialAnchor(material, file, anchorId);
                new Notice('已标记阅读锚点');
            }
            return {
                success: true,
                anchorId,
                materialCreated
            };
        }
        catch (error) {
            logger.error('[AnchorManager] 插入锚点失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            };
        }
    }
    /**
     * 为文件创建阅读材料
     */
    async createMaterialForFile(file, anchorId) {
        const now = new Date().toISOString();
        const uuid = generateReadingUUID();
        // 计算文件字数
        const content = await this.app.vault.read(file);
        const totalWords = countWords(content);
        // 解析锚点位置
        const anchorPosition = this.findAnchorPosition(content, anchorId);
        const readWords = anchorPosition > 0 ? countWordsUpToPosition(content, anchorPosition) : 0;
        const material = {
            uuid,
            filePath: file.path,
            title: file.basename,
            category: ReadingCategory.Later,
            priority: 50,
            priorityDecay: 0.5,
            lastAccessed: now,
            progress: {
                currentAnchor: anchorId,
                anchorHistory: [{
                        anchorId,
                        position: anchorPosition,
                        timestamp: now,
                        wordCount: readWords
                    }],
                percentage: totalWords > 0 ? Math.round((readWords / totalWords) * 100) : 0,
                totalWords,
                readWords,
                estimatedTimeRemaining: estimateReadingTime(totalWords - readWords)
            },
            extractedCards: [],
            tags: [],
            created: now,
            modified: now,
            source: 'auto'
        };
        // 保存材料
        await this.storage.saveMaterial(material);
        // 更新文件的YAML frontmatter
        await this.yamlManager.initializeReadingFields(file, uuid, ReadingCategory.Later, 50);
        logger.info(`[AnchorManager] 创建阅读材料: ${uuid} for ${file.path}`);
        return material;
    }
    /**
     * 更新材料的锚点信息
     */
    async updateMaterialAnchor(material, file, anchorId) {
        const now = new Date().toISOString();
        // 读取文件内容
        const content = await this.app.vault.read(file);
        const totalWords = countWords(content);
        // 解析锚点位置
        const anchorPosition = this.findAnchorPosition(content, anchorId);
        const readWords = anchorPosition > 0 ? countWordsUpToPosition(content, anchorPosition) : 0;
        // 创建锚点记录
        const anchorRecord = {
            anchorId,
            position: anchorPosition,
            timestamp: now,
            wordCount: readWords
        };
        // 更新进度
        material.progress.currentAnchor = anchorId;
        material.progress.anchorHistory.push(anchorRecord);
        material.progress.totalWords = totalWords;
        material.progress.readWords = readWords;
        material.progress.percentage = totalWords > 0 ? Math.round((readWords / totalWords) * 100) : 0;
        material.progress.estimatedTimeRemaining = estimateReadingTime(totalWords - readWords);
        // 更新访问时间
        material.lastAccessed = now;
        material.modified = now;
        // 保存更新
        await this.storage.saveMaterial(material);
        logger.debug(`[AnchorManager] 更新锚点: ${anchorId}, 进度: ${material.progress.percentage}%`);
    }
    /**
     * 从文件内容中解析所有锚点
     * @param content 文件内容
     * @returns 锚点列表
     */
    parseAnchorsFromContent(content) {
        const anchors = [];
        const lines = content.split('\n');
        let charPosition = 0;
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            // 重置正则表达式
            const regex = new RegExp(ANCHOR_REGEX.source, 'g');
            let match;
            while ((match = regex.exec(line)) !== null) {
                const anchorId = match[0].substring(1); // 移除 ^ 前缀
                const timestamp = parseInt(match[1], 10);
                anchors.push({
                    anchorId,
                    timestamp,
                    position: charPosition + match.index,
                    lineNumber: lineNum
                });
            }
            charPosition += line.length + 1; // +1 for newline
        }
        // 按位置排序
        anchors.sort((a, b) => a.position - b.position);
        return anchors;
    }
    /**
     * 从文件中解析锚点
     * @param file 目标文件
     * @returns 锚点列表
     */
    async parseAnchorsFromFile(file) {
        try {
            const content = await this.app.vault.read(file);
            return this.parseAnchorsFromContent(content);
        }
        catch (error) {
            logger.error(`[AnchorManager] 解析文件锚点失败: ${file.path}`, error);
            return [];
        }
    }
    /**
     * 获取文件中最新的锚点
     * @param file 目标文件
     * @returns 最新锚点，如果没有则返回null
     */
    async getLatestAnchor(file) {
        const anchors = await this.parseAnchorsFromFile(file);
        if (anchors.length === 0) {
            return null;
        }
        // 返回时间戳最大的锚点
        return anchors.reduce((latest, current) => current.timestamp > latest.timestamp ? current : latest);
    }
    /**
     * 跳转到锚点位置并高亮显示
     * @param file 目标文件
     * @param anchorId 锚点ID
     */
    async jumpToAnchor(file, anchorId) {
        try {
            const content = await this.app.vault.read(file);
            const anchors = this.parseAnchorsFromContent(content);
            const anchor = anchors.find(a => a.anchorId === anchorId);
            if (!anchor) {
                logger.warn(`[AnchorManager] 锚点不存在: ${anchorId}`);
                return false;
            }
            // 打开文件并跳转到锚点行
            const leaf = this.app.workspace.getLeaf();
            await leaf.openFile(file);
            // 等待视图加载完成
            await new Promise(resolve => setTimeout(resolve, 100));
            // 获取编辑器并设置光标位置
            const view = this.app.workspace.getActiveViewOfType(this.app.workspace.constructor);
            if (view && 'editor' in view) {
                const editor = view.editor;
                // 设置光标位置
                editor.setCursor({ line: anchor.lineNumber, ch: 0 });
                // 滚动到视图中心
                editor.scrollIntoView({
                    from: { line: Math.max(0, anchor.lineNumber - 3), ch: 0 },
                    to: { line: anchor.lineNumber + 3, ch: 0 }
                }, true);
                // 添加高亮效果
                this.highlightAnchorLine(editor, anchor.lineNumber);
            }
            return true;
        }
        catch (error) {
            logger.error(`[AnchorManager] 跳转到锚点失败: ${anchorId}`, error);
            return false;
        }
    }
    /**
     * 高亮锚点所在行（闪烁效果）
     * @param editor 编辑器实例
     * @param lineNumber 行号
     */
    highlightAnchorLine(editor, lineNumber) {
        try {
            // 使用 CodeMirror 的行高亮功能
            const cm = editor.cm;
            if (!cm)
                return;
            // 添加高亮类
            const lineHandle = cm.addLineClass(lineNumber, 'wrap', 'weave-anchor-highlight');
            // 2秒后移除高亮
            setTimeout(() => {
                try {
                    cm.removeLineClass(lineHandle, 'wrap', 'weave-anchor-highlight');
                }
                catch {
                    // 忽略移除失败（可能视图已关闭）
                }
            }, 2000);
        }
        catch (error) {
            // 降级方案：使用选中效果
            logger.debug('[AnchorManager] CodeMirror高亮不可用，使用选中效果');
            const line = editor.getLine(lineNumber);
            if (line) {
                editor.setSelection({ line: lineNumber, ch: 0 }, { line: lineNumber, ch: line.length });
                // 1秒后取消选中
                setTimeout(() => {
                    editor.setCursor({ line: lineNumber, ch: 0 });
                }, 1000);
            }
        }
    }
    /**
     * 删除锚点
     * @param file 目标文件
     * @param anchorId 锚点ID
     */
    async removeAnchor(file, anchorId) {
        try {
            const content = await this.app.vault.read(file);
            const anchorPattern = new RegExp(`\\n?\\^${anchorId}\\n?`, 'g');
            const newContent = content.replace(anchorPattern, '\n');
            if (newContent !== content) {
                await this.app.vault.modify(file, newContent);
                logger.debug(`[AnchorManager] 删除锚点: ${anchorId}`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger.error(`[AnchorManager] 删除锚点失败: ${anchorId}`, error);
            return false;
        }
    }
    /**
     * 计算阅读进度
     * @param file 目标文件
     * @param material 阅读材料
     * @returns 更新后的进度
     */
    async calculateProgress(file, material) {
        const content = await this.app.vault.read(file);
        const totalWords = countWords(content);
        const anchors = this.parseAnchorsFromContent(content);
        // 获取最新锚点
        const latestAnchor = anchors.length > 0
            ? anchors.reduce((latest, current) => current.timestamp > latest.timestamp ? current : latest)
            : null;
        let readWords = 0;
        if (latestAnchor) {
            readWords = countWordsUpToPosition(content, latestAnchor.position);
        }
        const percentage = totalWords > 0 ? Math.round((readWords / totalWords) * 100) : 0;
        return {
            currentAnchor: latestAnchor?.anchorId,
            anchorHistory: material.progress.anchorHistory,
            percentage,
            totalWords,
            readWords,
            estimatedTimeRemaining: estimateReadingTime(totalWords - readWords)
        };
    }
    // ===== 辅助方法 =====
    /**
     * 查找锚点在内容中的位置
     */
    findAnchorPosition(content, anchorId) {
        const pattern = `^${anchorId}`;
        const index = content.indexOf(pattern);
        return index >= 0 ? index : 0;
    }
}
/**
 * 创建锚点管理器实例
 */
export function createAnchorManager(app, storage, yamlManager) {
    return new AnchorManager(app, storage, yamlManager);
}
