/**
 * @deprecated v5.0: 此服务已弃用，块文件方案不再需要文件监听
 *
 * 增量阅读文件监听服务（旧 UUID 标记方案）
 *
 * 监听增量阅读文件夹中的文件变化，自动同步内容块数据
 * 此服务用于旧的"源文件内 UUID 标记"方案，新的块文件方案不需要此服务
 *
 * @module services/incremental-reading/IRFileWatcher
 * @version 2.2.0
 */
import { TFile, debounce } from 'obsidian';
import { resolveIRImportFolder } from '../../config/paths';
import { logger } from '../../utils/logger';
import { generateIRBlockId, createDefaultIRBlock } from '../../types/ir-types';
/** UUID 标记正则 */
const IR_UUID_REGEX = /<!--\s*weave-ir:\s*(ir-[a-z0-9]+)\s*-->/g;
const IR_START_REGEX = /<!--\s*weave-ir-start\s*-->/;
/**
 * 从内容块提取标签（如 #ignore）
 * v2.3: 支持从文档同步 #ignore 标签到 IRBlock.tags
 * v2.3.1: 检查整个内容块，而不仅仅是 UUID 行
 */
function extractTagsFromContent(content, uuidLine) {
    const tags = [];
    // 匹配 #ignore 标签（不区分大小写）- 检查内容和 UUID 行
    if (/#ignore\b/i.test(content) || /#ignore\b/i.test(uuidLine)) {
        tags.push('ignore');
    }
    return tags;
}
export class IRFileWatcher {
    app;
    storage;
    contentSplitter;
    eventRefs = [];
    isWatching = false;
    importFolder;
    /** 防抖处理文件变化 */
    debouncedHandleModify;
    constructor(app, storage, contentSplitter, importFolder) {
        this.app = app;
        this.storage = storage;
        this.contentSplitter = contentSplitter;
        const plugin = app?.plugins?.getPlugin?.('weave');
        const parentFolder = plugin?.settings?.weaveParentFolder;
        this.importFolder = resolveIRImportFolder(importFolder, parentFolder);
        // 创建防抖函数（500ms）
        this.debouncedHandleModify = debounce((file) => this.handleFileModified(file), 500, true);
    }
    /**
     * 更新监听的导入文件夹路径
     */
    setImportFolder(folder) {
        this.importFolder = folder;
        logger.debug(`[IRFileWatcher] 更新监听文件夹: ${folder}`);
    }
    /**
     * 开始监听文件变化
     */
    startWatching() {
        if (this.isWatching) {
            return;
        }
        logger.info(`[IRFileWatcher] 开始监听增量阅读文件夹: ${this.importFolder}`);
        // 监听文件修改事件
        const modifyRef = this.app.vault.on('modify', (file) => {
            if (file instanceof TFile && this.isInWatchFolder(file.path)) {
                this.debouncedHandleModify(file);
            }
        });
        // 监听文件删除事件
        const deleteRef = this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && this.isInWatchFolder(file.path)) {
                this.handleFileDeleted(file);
            }
        });
        // 监听文件重命名事件
        const renameRef = this.app.vault.on('rename', async (file, oldPath) => {
            if (file instanceof TFile) {
                if (this.isInWatchFolder(oldPath) || this.isInWatchFolder(file.path)) {
                    await this.handleFileRenamed(file, oldPath);
                }
            }
        });
        this.eventRefs = [modifyRef, deleteRef, renameRef];
        this.isWatching = true;
    }
    /**
     * 停止监听
     */
    stopWatching() {
        if (!this.isWatching) {
            return;
        }
        logger.debug('[IRFileWatcher] 停止监听');
        this.eventRefs.forEach(ref => {
            this.app.vault.offref(ref);
        });
        this.eventRefs = [];
        this.isWatching = false;
    }
    /**
     * 检查文件是否在监听文件夹中
     */
    isInWatchFolder(filePath) {
        return filePath.startsWith(this.importFolder + '/') && filePath.endsWith('.md');
    }
    /**
     * 处理文件修改事件
     * 重新解析文件中的 UUID 标记，同步更新 blocks.json
     */
    async handleFileModified(file) {
        try {
            logger.debug(`[IRFileWatcher] 文件修改: ${file.path}`);
            const content = await this.app.vault.read(file);
            // 检查是否有起始标记（确认是增量阅读文件）
            if (!IR_START_REGEX.test(content)) {
                logger.debug(`[IRFileWatcher] 文件无起始标记，跳过: ${file.path}`);
                return;
            }
            // 提取文件中的所有 UUID 标记
            const uuidsInFile = this.extractUuidsFromContent(content);
            if (uuidsInFile.length === 0) {
                logger.debug(`[IRFileWatcher] 文件无 UUID 标记: ${file.path}`);
                return;
            }
            // 获取已存储的块数据
            const existingBlocks = await this.storage.getBlocksByFile(file.path);
            const existingBlockMap = new Map(existingBlocks.map(b => [b.id, b]));
            // 解析文件内容，按 UUID 标记分割
            const lines = content.split('\n');
            const parsedBlocks = this.parseBlocksByUuid(lines, file.path, uuidsInFile);
            // 合并：保留已有块的 FSRS 状态，更新内容信息
            const updatedBlocks = [];
            for (const parsed of parsedBlocks) {
                const existing = existingBlockMap.get(parsed.id);
                if (existing) {
                    // 保留调度状态，更新内容信息
                    existing.headingText = parsed.headingText;
                    existing.headingPath = parsed.headingPath;
                    existing.headingLevel = parsed.headingLevel;
                    existing.startLine = parsed.startLine;
                    existing.endLine = parsed.endLine;
                    existing.contentPreview = parsed.contentPreview;
                    // v2.3: 同步文档中的 tags（如 #ignore）
                    existing.tags = parsed.tags;
                    existing.updatedAt = new Date().toISOString();
                    updatedBlocks.push(existing);
                }
                else {
                    // 新块（用户通过快捷键添加的）
                    updatedBlocks.push(parsed);
                }
                // 从 map 中移除已处理的
                existingBlockMap.delete(parsed.id);
            }
            // 处理被删除的块（用户删除了 UUID 标记）
            // 这些块的 UUID 不再出现在文件中
            for (const [deletedId, deletedBlock] of existingBlockMap) {
                logger.debug(`[IRFileWatcher] 块标记已删除: ${deletedId}`);
                // 可选：保留数据但标记为已删除，或直接删除
                // 这里选择保留，但可以添加 deleted 标记
            }
            // 保存更新后的块数据
            if (updatedBlocks.length > 0) {
                await this.storage.saveBlocks(updatedBlocks);
                logger.info(`[IRFileWatcher] ✅ 同步完成: ${file.path}, ${updatedBlocks.length} 个内容块`);
            }
        }
        catch (error) {
            logger.error(`[IRFileWatcher] 处理文件修改失败: ${file.path}`, error);
        }
    }
    /**
     * 从内容中提取所有 UUID
     */
    extractUuidsFromContent(content) {
        const uuids = [];
        const regex = new RegExp(IR_UUID_REGEX);
        let match;
        while ((match = regex.exec(content)) !== null) {
            uuids.push(match[1]);
        }
        return uuids;
    }
    /**
     * 按 UUID 标记解析内容块
     * UUID 标记在内容块末尾，UUID 之前的内容属于该块
     */
    parseBlocksByUuid(lines, filePath, uuidsInFile) {
        const blocks = [];
        const now = new Date().toISOString();
        // 查找起始标记位置
        let contentStartLine = 0;
        for (let i = 0; i < lines.length; i++) {
            if (IR_START_REGEX.test(lines[i])) {
                contentStartLine = i + 1;
                break;
            }
        }
        // 查找每个 UUID 的位置
        const uuidPositions = [];
        const uuidRegex = /<!--\s*weave-ir:\s*(ir-[a-z0-9]+)\s*-->/;
        for (let i = contentStartLine; i < lines.length; i++) {
            const match = lines[i].match(uuidRegex);
            if (match) {
                uuidPositions.push({ uuid: match[1], line: i });
            }
        }
        // 按位置解析每个块的内容
        // UUID 在块末尾，所以块1的内容是: 起始标记 -> 第一个UUID
        for (let i = 0; i < uuidPositions.length; i++) {
            const { uuid, line: uuidLine } = uuidPositions[i];
            // 块的起始位置: 上一个 UUID 之后，或起始标记之后
            const startLine = i === 0
                ? contentStartLine
                : uuidPositions[i - 1].line + 1;
            // 块的结束位置: 当前 UUID 所在行之前
            const endLine = uuidLine - 1;
            // 提取内容（UUID 之前的内容）
            const contentLines = lines.slice(startLine, uuidLine);
            const content = contentLines.join('\n').trim();
            // 提取标题
            const title = this.extractTitle(contentLines) || `块 ${i + 1}`;
            const headingMatch = contentLines.find(l => l.match(/^#{1,6}\s+/));
            const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
            // 创建块对象
            const block = createDefaultIRBlock(uuid, filePath, [title], level, startLine);
            block.headingText = title;
            block.endLine = endLine;
            block.contentPreview = content.slice(0, 100);
            block.blockIndex = i;
            block.deckPath = this.importFolder;
            // v2.3.1: 从整个内容块提取 tags（如 #ignore）
            block.tags = extractTagsFromContent(content, lines[uuidLine]);
            blocks.push(block);
        }
        // 处理最后一个 UUID 之后的内容（如果有）
        if (uuidPositions.length > 0) {
            const lastUuidLine = uuidPositions[uuidPositions.length - 1].line;
            const remainingStartLine = lastUuidLine + 1;
            if (remainingStartLine < lines.length) {
                const remainingLines = lines.slice(remainingStartLine);
                const remainingContent = remainingLines.join('\n').trim();
                if (remainingContent.length > 0) {
                    const title = this.extractTitle(remainingLines) || `块 ${uuidPositions.length + 1}`;
                    const headingMatch = remainingLines.find(l => l.match(/^#{1,6}\s+/));
                    const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                    // 最后一块没有 UUID，生成一个新的
                    const newUuid = generateIRBlockId();
                    const block = createDefaultIRBlock(newUuid, filePath, [title], level, remainingStartLine);
                    block.headingText = title;
                    block.endLine = lines.length - 1;
                    block.contentPreview = remainingContent.slice(0, 100);
                    block.blockIndex = uuidPositions.length;
                    block.deckPath = this.importFolder;
                    blocks.push(block);
                }
            }
        }
        return blocks;
    }
    /**
     * 提取标题
     */
    extractTitle(lines) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0)
                continue;
            const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
            if (headingMatch) {
                return headingMatch[1].trim();
            }
            return trimmed.slice(0, 50);
        }
        return '';
    }
    /**
     * 处理文件删除事件
     */
    async handleFileDeleted(file) {
        try {
            logger.debug(`[IRFileWatcher] 文件删除: ${file.path}`);
            // 获取该文件的所有块并删除
            const blocks = await this.storage.getBlocksByFile(file.path);
            if (blocks.length > 0) {
                // 删除相关块数据
                for (const block of blocks) {
                    await this.storage.deleteBlock(block.id);
                }
                logger.info(`[IRFileWatcher] 已删除 ${blocks.length} 个内容块: ${file.path}`);
            }
        }
        catch (error) {
            logger.error(`[IRFileWatcher] 处理文件删除失败: ${file.path}`, error);
        }
    }
    /**
     * 处理文件重命名事件
     */
    async handleFileRenamed(file, oldPath) {
        try {
            logger.debug(`[IRFileWatcher] 文件重命名: ${oldPath} -> ${file.path}`);
            // 更新所有相关块的 filePath
            const blocks = await this.storage.getBlocksByFile(oldPath);
            if (blocks.length > 0) {
                for (const block of blocks) {
                    block.filePath = file.path;
                    block.updatedAt = new Date().toISOString();
                }
                await this.storage.saveBlocks(blocks);
                logger.info(`[IRFileWatcher] 已更新 ${blocks.length} 个内容块的路径`);
            }
        }
        catch (error) {
            logger.error(`[IRFileWatcher] 处理文件重命名失败`, error);
        }
    }
}
