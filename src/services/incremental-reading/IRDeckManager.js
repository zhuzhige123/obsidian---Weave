/**
 * 增量阅读牌组管理服务
 *
 * 负责管理增量阅读牌组：
 * - 文件夹扫描和牌组识别
 * - 牌组创建和删除
 * - 牌组统计计算
 * - v2.0: 支持跨文件牌组组织
 *
 * @module services/incremental-reading/IRDeckManager
 * @version 2.0.0 - 引入式架构
 */
import { TFolder, TFile, normalizePath } from 'obsidian';
import { createDefaultIRDeck } from '../../types/ir-types';
import { resolveIRImportFolder } from '../../config/paths';
import { logger } from '../../utils/logger';
export class IRDeckManager {
    app;
    storage;
    chunkRoot;
    constructor(app, storage, chunkRoot) {
        this.app = app;
        this.storage = storage;
        const plugin = app?.plugins?.getPlugin?.('weave');
        const parentFolder = plugin?.settings?.weaveParentFolder;
        this.chunkRoot = normalizePath(resolveIRImportFolder(chunkRoot, parentFolder));
    }
    async cleanAllEmptyFoldersUnderChunks() {
        const adapter = this.app.vault.adapter;
        const chunksRoot = this.chunkRoot;
        if (!adapter?.exists || !await adapter.exists(chunksRoot)) {
            return;
        }
        const walk = async (dir) => {
            const normalizedDir = normalizePath(dir);
            let listing;
            try {
                listing = await adapter.list(normalizedDir);
            }
            catch {
                return;
            }
            const folders = Array.isArray(listing?.folders) ? listing.folders : [];
            for (const sub of folders) {
                await walk(sub);
            }
            if (normalizedDir !== chunksRoot) {
                await this.cleanEmptyFolder(normalizedDir);
            }
        };
        await walk(chunksRoot);
    }
    /**
     * 检查并删除空文件夹
     * @param folderPath 文件夹路径
     * @returns 是否成功删除
     */
    async cleanEmptyFolder(folderPath) {
        try {
            const normalizedFolderPath = normalizePath(folderPath);
            const adapter = this.app.vault.adapter;
            if (!adapter?.exists || !await adapter.exists(normalizedFolderPath)) {
                return false;
            }
            const listing = await adapter.list(normalizedFolderPath);
            const isEmpty = (!listing?.files || listing.files.length === 0) &&
                (!listing?.folders || listing.folders.length === 0);
            if (!isEmpty) {
                return false;
            }
            const folder = this.app.vault.getAbstractFileByPath(normalizedFolderPath);
            if (folder instanceof TFolder) {
                await this.app.vault.delete(folder);
                logger.info(`[IRDeckManager] 删除空文件夹: ${normalizedFolderPath}`);
                return true;
            }
            if (adapter.rmdir) {
                await adapter.rmdir(normalizedFolderPath, false);
            }
            else {
                await adapter.remove(normalizedFolderPath);
            }
            logger.info(`[IRDeckManager] 删除空文件夹: ${normalizedFolderPath}`);
            return true;
        }
        catch (error) {
            logger.warn(`[IRDeckManager] 删除空文件夹失败: ${folderPath}`, error);
            return false;
        }
    }
    /**
     * 递归清理空父文件夹
     * @param filePath 已删除文件的路径
     */
    async cleanEmptyParentFolders(filePath) {
        const normalizedFilePath = normalizePath(filePath);
        let parentPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
        const chunksRoot = this.chunkRoot;
        while (parentPath && parentPath.startsWith(chunksRoot) && parentPath !== chunksRoot) {
            const deleted = await this.cleanEmptyFolder(parentPath);
            if (!deleted) {
                break;
            }
            parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
        }
    }
    /**
     * 获取所有增量阅读牌组
     */
    async getAllDecks() {
        const decksData = await this.storage.getAllDecks();
        return Object.values(decksData);
    }
    /**
     * 获取牌组及其统计 (v2.0: 使用deck.id, v2.4: 新增提问统计)
     */
    async getDecksWithStats(options) {
        const decks = await this.getAllDecks();
        const result = [];
        const dailyNewLimit = options?.dailyNewLimit ?? 20;
        const dailyReviewLimit = options?.dailyReviewLimit ?? 50;
        const learnAheadDays = options?.learnAheadDays ?? 3;
        for (const deck of decks) {
            // v2.0: 使用id或path
            const deckKey = deck.id || deck.path || '';
            const stats = await this.storage.getDeckStats(deckKey, dailyNewLimit, dailyReviewLimit, learnAheadDays);
            result.push({
                deck,
                stats: {
                    newCount: stats.newCount,
                    learningCount: stats.learningCount,
                    reviewCount: stats.reviewCount,
                    dueToday: stats.dueToday,
                    dueWithinDays: stats.dueWithinDays,
                    totalCount: stats.totalCount,
                    fileCount: stats.fileCount,
                    questionCount: stats.questionCount,
                    completedQuestionCount: stats.completedQuestionCount,
                    todayNewCount: stats.todayNewCount,
                    todayDueCount: stats.todayDueCount
                }
            });
        }
        return result;
    }
    /**
     * 导入文件夹作为牌组 (v2.0: 使用createDefaultIRDeck)
     */
    async importFolder(folderPath, settings) {
        // 验证文件夹存在
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) {
            throw new Error(`文件夹不存在: ${folderPath}`);
        }
        // 检查是否已存在 (v2.0: 同时检查id和path)
        const existingDecks = await this.storage.getAllDecks();
        const existing = Object.values(existingDecks).find(d => d.id === folderPath || d.path === folderPath);
        if (existing) {
            logger.warn(`[IRDeckManager] 牌组已存在: ${folderPath}`);
            return existing;
        }
        // v2.0: 使用工厂函数创建牌组
        const deck = createDefaultIRDeck(folder.name);
        // 保留path用于兼容
        deck.path = folderPath;
        // 应用自定义设置
        if (settings) {
            deck.settings = { ...deck.settings, ...settings };
        }
        await this.storage.saveDeck(deck);
        logger.info(`[IRDeckManager] 导入牌组: ${deck.id} (${folderPath})`);
        return deck;
    }
    /**
     * 删除牌组（同时删除所有关联的内容块数据）
     */
    async deleteDeck(deckId) {
        const deck = await this.storage.getDeckById(deckId);
        const adapter = this.app.vault.adapter;
        const blocks = await this.storage.getBlocksByDeck(deckId);
        for (const block of blocks) {
            await this.storage.deleteBlock(block.id);
        }
        const allChunks = await this.storage.getAllChunkData();
        const deckTag = deck?.name ? `#IR_deck_${deck.name}` : undefined;
        const chunksToDelete = Object.values(allChunks).filter(c => (Array.isArray(c.deckIds) && c.deckIds.includes(deckId)) ||
            (!!deckTag && c.deckTag === deckTag));
        const affectedSourceIds = new Set();
        // 收集所有需要检查的父文件夹路径
        const foldersToCheck = new Set();
        for (const chunk of chunksToDelete) {
            try {
                affectedSourceIds.add(chunk.sourceId);
                const filePath = normalizePath(chunk.filePath);
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    await this.app.vault.delete(file);
                }
                else if (adapter?.exists && await adapter.exists(filePath)) {
                    await adapter.remove(filePath);
                }
                foldersToCheck.add(filePath);
            }
            catch (error) {
                logger.warn(`[IRDeckManager] 删除块文件失败: ${chunk.filePath}`, error);
            }
            try {
                await this.storage.deleteChunkData(chunk.chunkId);
            }
            catch (error) {
                logger.warn(`[IRDeckManager] 删除块调度数据失败: ${chunk.chunkId}`, error);
            }
        }
        if (affectedSourceIds.size > 0) {
            const sources = await this.storage.getAllSources();
            for (const sourceId of affectedSourceIds) {
                const source = sources[sourceId];
                if (!source)
                    continue;
                const remainingChunkIds = (source.chunkIds || []).filter(id => !chunksToDelete.some(c => c.chunkId === id));
                if (remainingChunkIds.length === 0) {
                    try {
                        if (source.indexFilePath) {
                            const indexFilePath = normalizePath(source.indexFilePath);
                            const indexFile = this.app.vault.getAbstractFileByPath(indexFilePath);
                            if (indexFile instanceof TFile) {
                                await this.app.vault.delete(indexFile);
                            }
                            else if (adapter?.exists && await adapter.exists(indexFilePath)) {
                                await adapter.remove(indexFilePath);
                            }
                            foldersToCheck.add(indexFilePath);
                        }
                    }
                    catch (error) {
                        logger.warn(`[IRDeckManager] 删除源索引文件失败: ${source.indexFilePath}`, error);
                    }
                    try {
                        await this.storage.deleteSource(sourceId);
                    }
                    catch (error) {
                        logger.warn(`[IRDeckManager] 删除源材料元数据失败: ${sourceId}`, error);
                    }
                }
                else if (remainingChunkIds.length !== (source.chunkIds || []).length) {
                    try {
                        source.chunkIds = remainingChunkIds;
                        source.updatedAt = Date.now();
                        await this.storage.saveSource(source);
                    }
                    catch (error) {
                        logger.warn(`[IRDeckManager] 更新源材料元数据失败: ${sourceId}`, error);
                    }
                }
            }
        }
        // 清理所有空文件夹
        for (const folderPath of foldersToCheck) {
            await this.cleanEmptyParentFolders(folderPath);
        }
        await this.cleanAllEmptyFoldersUnderChunks();
        await this.storage.deleteDeck(deckId);
        logger.info(`[IRDeckManager] 删除牌组及 ${blocks.length + chunksToDelete.length} 个内容块: ${deckId}`);
    }
    /**
     * 解散牌组 (v2.0 新增: 仅删除牌组，保留块数据)
     */
    async disbandDeck(deckId) {
        const allChunks = await this.storage.getAllChunkData();
        const chunksToUpdate = Object.values(allChunks).filter(c => Array.isArray(c.deckIds) && c.deckIds.includes(deckId));
        for (const chunk of chunksToUpdate) {
            try {
                await this.storage.removeDeckFromChunk(chunk.chunkId, deckId);
            }
            catch (error) {
                logger.warn(`[IRDeckManager] 解散牌组时移除块牌组失败: ${chunk.chunkId}`, error);
            }
        }
        await this.storage.deleteDeck(deckId);
        logger.info(`[IRDeckManager] 解散牌组 (保留块数据): ${deckId}`);
    }
    /**
     * 创建空牌组 (v2.0 新增: 用于跨文件组织)
     */
    async createDeck(name, description) {
        const deck = createDefaultIRDeck(name);
        if (description) {
            deck.description = description;
        }
        await this.storage.saveDeck(deck);
        logger.info(`[IRDeckManager] 创建牌组: ${deck.id} (${name})`);
        return deck;
    }
    /**
     * 向牌组添加内容块 (v2.0 新增)
     */
    async addBlocksToDeck(deckId, blockIds) {
        await this.storage.addBlocksToDeck(deckId, blockIds);
        logger.debug(`[IRDeckManager] 向牌组 ${deckId} 添加 ${blockIds.length} 个内容块`);
    }
    /**
     * 从牌组移除内容块 (v2.0 新增)
     */
    async removeBlocksFromDeck(deckId, blockIds) {
        await this.storage.removeBlocksFromDeck(deckId, blockIds);
        logger.debug(`[IRDeckManager] 从牌组 ${deckId} 移除 ${blockIds.length} 个内容块`);
    }
    /**
     * 更新牌组设置
     */
    async updateDeckSettings(deckPath, settings) {
        const deck = await this.storage.getDeck(deckPath);
        if (!deck) {
            throw new Error(`牌组不存在: ${deckPath}`);
        }
        deck.settings = {
            ...deck.settings,
            ...settings
        };
        await this.storage.saveDeck(deck);
        logger.debug(`[IRDeckManager] 更新牌组设置: ${deckPath}`);
        return deck;
    }
    /**
     * 扫描文件夹中的 Markdown 文件
     */
    async scanFolderFiles(folderPath) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) {
            return [];
        }
        const files = [];
        // 递归扫描所有 Markdown 文件
        const scanFolder = (f) => {
            for (const child of f.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child);
                }
                else if (child instanceof TFolder) {
                    scanFolder(child);
                }
            }
        };
        scanFolder(folder);
        return files;
    }
    /**
     * 获取牌组的所有文件
     */
    async getDeckFiles(deckPath) {
        return this.scanFolderFiles(deckPath);
    }
    /**
     * 检查文件夹是否可以作为牌组导入
     */
    async canImportFolder(folderPath) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) {
            return { canImport: false, reason: '路径不是文件夹' };
        }
        // 检查是否为系统文件夹
        if (folderPath.startsWith('.')) {
            return { canImport: false, reason: '不能导入隐藏文件夹' };
        }
        // 扫描文件数量
        const files = await this.scanFolderFiles(folderPath);
        if (files.length === 0) {
            return { canImport: false, reason: '文件夹中没有 Markdown 文件' };
        }
        // 检查是否已导入
        const existing = await this.storage.getDeck(folderPath);
        if (existing) {
            return { canImport: false, reason: '该文件夹已作为牌组导入' };
        }
        return { canImport: true, fileCount: files.length };
    }
    /**
     * 获取可导入的文件夹列表
     */
    async getImportableFolders() {
        const result = [];
        const existingDecks = await this.storage.getAllDecks();
        const existingPaths = new Set(Object.keys(existingDecks));
        // 遍历根目录下的文件夹
        const root = this.app.vault.getRoot();
        for (const child of root.children) {
            if (child instanceof TFolder && !child.path.startsWith('.')) {
                if (!existingPaths.has(child.path)) {
                    const files = await this.scanFolderFiles(child.path);
                    if (files.length > 0) {
                        result.push({
                            path: child.path,
                            name: child.name,
                            fileCount: files.length
                        });
                    }
                }
            }
        }
        return result;
    }
    /**
     * 刷新牌组（重新扫描文件夹）
     */
    async refreshDeck(deckPath) {
        const deck = await this.storage.getDeck(deckPath);
        if (!deck) {
            throw new Error(`牌组不存在: ${deckPath}`);
        }
        // 获取当前存储的内容块
        const existingBlocks = await this.storage.getBlocksByDeck(deckPath);
        const existingFiles = new Set(existingBlocks.map(b => b.filePath));
        // 扫描文件夹中的文件
        const currentFiles = await this.scanFolderFiles(deckPath);
        const currentFilePaths = new Set(currentFiles.map(f => f.path));
        let added = 0;
        let removed = 0;
        let unchanged = 0;
        // 检查已删除的文件
        for (const filePath of existingFiles) {
            if (!currentFilePaths.has(filePath)) {
                await this.storage.deleteBlocksByFile(filePath);
                removed++;
            }
            else {
                unchanged++;
            }
        }
        // 检查新增的文件（需要后续拆分处理）
        for (const file of currentFiles) {
            if (!existingFiles.has(file.path)) {
                added++;
                // 新文件需要通过 IRContentSplitter 处理
            }
        }
        logger.info(`[IRDeckManager] 刷新牌组 ${deckPath}: 新增 ${added}, 删除 ${removed}, 不变 ${unchanged}`);
        return { added, removed, unchanged };
    }
}
