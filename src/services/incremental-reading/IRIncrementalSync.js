/**
 * @deprecated v5.0: 此服务已弃用，块文件方案不再需要增量同步
 *
 * 增量阅读增量同步服务（旧 UUID 标记方案）
 *
 * 实现三级检测策略（用于旧的源文件内 UUID 标记方案）：
 * - Level 1: mtime + size 检测（最快）
 * - Level 2: UUID 列表哈希检测（快速）
 * - Level 3: 完整内容块同步（完整）
 *
 * 新的块文件方案每个块就是一个独立文件，不需要此服务
 *
 * @module services/incremental-reading/IRIncrementalSync
 * @version 2.2.0
 */
import { resolveIRImportFolder } from '../../config/paths';
import { logger } from '../../utils/logger';
import { createDefaultIRBlock } from '../../types/ir-types';
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
export class IRIncrementalSync {
    app;
    storage;
    contentSplitter;
    importFolder;
    constructor(app, storage, contentSplitter, importFolder) {
        this.app = app;
        this.storage = storage;
        this.contentSplitter = contentSplitter;
        const plugin = app?.plugins?.getPlugin?.('weave');
        const parentFolder = plugin?.settings?.weaveParentFolder;
        this.importFolder = resolveIRImportFolder(importFolder, parentFolder);
    }
    /**
     * 更新导入文件夹路径
     */
    setImportFolder(folder) {
        this.importFolder = folder;
    }
    /**
     * 执行增量同步（打开牌组时调用）
     * 仅同步 mtime/size 变化的文件
     */
    async syncOnDeckOpen(deckPath) {
        const startTime = Date.now();
        const targetFolder = deckPath || this.importFolder;
        logger.info(`[IRIncrementalSync] 开始增量同步: ${targetFolder}`);
        const result = {
            syncedFiles: 0,
            skippedFiles: 0,
            newBlocks: 0,
            updatedBlocks: 0,
            deletedBlocks: 0,
            duration: 0
        };
        try {
            // 获取文件夹中所有 Markdown 文件
            const files = await this.getMarkdownFilesInFolder(targetFolder);
            if (files.length === 0) {
                logger.debug(`[IRIncrementalSync] 文件夹为空: ${targetFolder}`);
                result.duration = Date.now() - startTime;
                return result;
            }
            // 逐个检测并同步
            for (const file of files) {
                const fileResult = await this.syncSingleFile(file);
                if (fileResult.synced) {
                    result.syncedFiles++;
                    result.newBlocks += fileResult.newBlocks;
                    result.updatedBlocks += fileResult.updatedBlocks;
                    result.deletedBlocks += fileResult.deletedBlocks;
                }
                else {
                    result.skippedFiles++;
                }
            }
            result.duration = Date.now() - startTime;
            logger.info(`[IRIncrementalSync] ✅ 同步完成: ${result.syncedFiles} 个文件同步, ${result.skippedFiles} 个跳过, 耗时 ${result.duration}ms`);
            return result;
        }
        catch (error) {
            logger.error('[IRIncrementalSync] 同步失败:', error);
            result.duration = Date.now() - startTime;
            return result;
        }
    }
    /**
     * 同步单个文件
     * @returns 同步结果
     */
    async syncSingleFile(file) {
        const result = {
            synced: false,
            newBlocks: 0,
            updatedBlocks: 0,
            deletedBlocks: 0
        };
        try {
            // Level 1: mtime + size 检测
            const stat = await this.app.vault.adapter.stat(file.path);
            if (!stat) {
                logger.warn(`[IRIncrementalSync] 无法获取文件状态: ${file.path}`);
                return result;
            }
            const needsSync = await this.storage.checkFileNeedsSync(file.path, stat.mtime, stat.size);
            if (!needsSync) {
                logger.debug(`[IRIncrementalSync] 文件未变化，跳过: ${file.path}`);
                return result;
            }
            // Level 2 + Level 3: 读取文件并同步
            const content = await this.app.vault.read(file);
            // 检查是否有起始标记
            if (!IR_START_REGEX.test(content)) {
                logger.debug(`[IRIncrementalSync] 文件无起始标记，跳过: ${file.path}`);
                return result;
            }
            // 提取 UUID 列表
            const uuids = this.extractUuids(content);
            if (uuids.length === 0) {
                logger.debug(`[IRIncrementalSync] 文件无 UUID 标记: ${file.path}`);
                return result;
            }
            // Level 2: UUID 哈希检测
            const currentHash = this.storage.generateUuidListHash(uuids);
            const savedState = await this.storage.getFileSyncState(file.path);
            if (savedState && savedState.uuidListHash === currentHash) {
                // UUID 列表未变化，只需更新 mtime
                await this.storage.saveFileSyncState({
                    ...savedState,
                    mtime: stat.mtime,
                    size: stat.size,
                    lastSynced: new Date().toISOString()
                });
                logger.debug(`[IRIncrementalSync] UUID 未变化，更新 mtime: ${file.path}`);
                return result;
            }
            // Level 3: 完整内容块同步
            const syncResult = await this.syncFileBlocks(file, content, uuids);
            // 更新同步状态
            await this.storage.saveFileSyncState({
                filePath: file.path,
                mtime: stat.mtime,
                size: stat.size,
                uuidListHash: currentHash,
                lastSynced: new Date().toISOString()
            });
            result.synced = true;
            result.newBlocks = syncResult.newBlocks;
            result.updatedBlocks = syncResult.updatedBlocks;
            result.deletedBlocks = syncResult.deletedBlocks;
            logger.debug(`[IRIncrementalSync] 文件同步完成: ${file.path}, 新增 ${result.newBlocks}, 更新 ${result.updatedBlocks}, 删除 ${result.deletedBlocks}`);
            return result;
        }
        catch (error) {
            logger.error(`[IRIncrementalSync] 同步文件失败: ${file.path}`, error);
            return result;
        }
    }
    /**
     * 同步文件中的内容块
     */
    async syncFileBlocks(file, content, uuids) {
        const result = { newBlocks: 0, updatedBlocks: 0, deletedBlocks: 0 };
        // 获取已存储的块
        const existingBlocks = await this.storage.getBlocksByFile(file.path);
        const existingBlockMap = new Map(existingBlocks.map(b => [b.id, b]));
        // 解析文件内容
        const lines = content.split('\n');
        const parsedBlocks = this.parseBlocksByUuid(lines, file.path, uuids);
        // 合并块数据
        const updatedBlocks = [];
        for (const parsed of parsedBlocks) {
            const existing = existingBlockMap.get(parsed.id);
            if (existing) {
                // 更新已有块（保留调度状态）
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
                result.updatedBlocks++;
            }
            else {
                // 新块
                updatedBlocks.push(parsed);
                result.newBlocks++;
            }
            existingBlockMap.delete(parsed.id);
        }
        // 处理被删除的块（UUID 不再存在）
        for (const [deletedId] of existingBlockMap) {
            await this.storage.deleteBlock(deletedId);
            result.deletedBlocks++;
            logger.debug(`[IRIncrementalSync] 删除块: ${deletedId}`);
        }
        // 保存更新后的块
        if (updatedBlocks.length > 0) {
            await this.storage.saveBlocks(updatedBlocks);
        }
        return result;
    }
    /**
     * 提取内容中的所有 UUID
     */
    extractUuids(content) {
        const uuids = [];
        const regex = new RegExp(IR_UUID_REGEX);
        let match;
        while ((match = regex.exec(content)) !== null) {
            uuids.push(match[1]);
        }
        return uuids;
    }
    /**
     * 按 UUID 解析内容块
     */
    parseBlocksByUuid(lines, filePath, uuids) {
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
        // 按位置解析每个块
        for (let i = 0; i < uuidPositions.length; i++) {
            const { uuid, line: uuidLine } = uuidPositions[i];
            // 内容范围：UUID 行之后到下一个 UUID 行之前
            const startLine = uuidLine + 1;
            const endLine = i < uuidPositions.length - 1
                ? uuidPositions[i + 1].line - 1
                : lines.length - 1;
            const contentLines = lines.slice(startLine, endLine + 1);
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
     * 获取文件夹中的所有 Markdown 文件
     */
    async getMarkdownFilesInFolder(folderPath) {
        const files = [];
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            return files;
        }
        const allFiles = this.app.vault.getMarkdownFiles();
        for (const file of allFiles) {
            if (file.path.startsWith(folderPath + '/')) {
                files.push(file);
            }
        }
        return files;
    }
}
