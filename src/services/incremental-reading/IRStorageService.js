/**
 * 增量阅读存储服务
 *
 * 负责管理增量阅读数据的持久化存储：
 * - blocks.json: 内容块数据
 * - decks.json: 牌组配置
 * - history.json: 阅读历史
 *
 * 存储路径: weave/incremental-reading/
 *
 * @module services/incremental-reading/IRStorageService
 * @version 2.0.0 - 引入式架构
 */
import { TFile, normalizePath } from 'obsidian';
import { IRPdfBookmarkTaskService } from './IRPdfBookmarkTaskService';
import { IREpubBookmarkTaskService } from './IREpubBookmarkTaskService';
import { IR_STORAGE_VERSION } from '../../types/ir-types';
import { logger } from '../../utils/logger';
import { getReadableWeaveRoot, getV2PathsFromApp, normalizeWeaveParentFolder, PATHS, resolveIRImportFolder } from '../../config/paths';
import { parseYAMLFromContent, setCardProperty } from '../../utils/yaml-utils';
const BLOCKS_FILE = 'blocks.json';
const DECKS_FILE = 'decks.json';
const HISTORY_FILE = 'history.json';
const SYNC_STATE_FILE = 'sync-state.json';
const CALENDAR_PROGRESS_FILE = 'calendar-progress.json';
export class IRStorageService {
    app;
    initialized = false;
    initPromise = null;
    migratedChunkReadablePaths = false;
    migratedSourceReadablePaths = false;
    migratedBlockReadablePaths = false;
    migratedDeckReadablePaths = false;
    constructor(app) {
        this.app = app;
    }
    getStorageDir() {
        return getV2PathsFromApp(this.app).ir.root;
    }
    coerceToVaultPath(p) {
        const normalized = normalizePath(p);
        if (normalized.startsWith('weave/') || normalized === 'weave')
            return normalized;
        if (normalized.startsWith('.weave/') || normalized === '.weave')
            return normalized;
        const weaveIdx = normalized.indexOf('/weave/');
        if (weaveIdx >= 0) {
            return normalized.slice(weaveIdx + 1);
        }
        const dotWeaveIdx = normalized.indexOf('/.weave/');
        if (dotWeaveIdx >= 0) {
            return normalized.slice(dotWeaveIdx + 1);
        }
        return normalized;
    }
    getReadableRoots() {
        try {
            const plugin = this.app?.plugins?.getPlugin?.('weave');
            const parentFolder = normalizeWeaveParentFolder(plugin?.settings?.weaveParentFolder);
            let currentRoot = normalizePath(getReadableWeaveRoot(parentFolder));
            if (!parentFolder) {
                const importFolder = plugin?.settings?.incrementalReading?.importFolder;
                if (typeof importFolder === 'string' && importFolder.trim()) {
                    const normalizedImport = normalizePath(importFolder);
                    if (normalizedImport.endsWith('/IR')) {
                        const inferred = normalizePath(normalizedImport.slice(0, -3));
                        if (inferred.endsWith('/weave') || inferred === 'weave') {
                            currentRoot = inferred;
                        }
                    }
                }
            }
            const legacyRoot = normalizePath(getReadableWeaveRoot(undefined));
            if (!currentRoot || !legacyRoot || currentRoot === legacyRoot)
                return null;
            return { legacyRoot, currentRoot };
        }
        catch {
            return null;
        }
    }
    rewriteRootPrefix(p, fromRoot, toRoot) {
        if (typeof p !== 'string' || !p.trim())
            return null;
        const normalized = this.coerceToVaultPath(p);
        if (normalized === fromRoot)
            return toRoot;
        if (normalized.startsWith(`${fromRoot}/`)) {
            return normalizePath(`${toRoot}/${normalized.slice(fromRoot.length + 1)}`);
        }
        return null;
    }
    async migrateReadablePathIfNeeded(p, fromRoot, toRoot) {
        const rewritten = this.rewriteRootPrefix(p, fromRoot, toRoot);
        if (!rewritten)
            return null;
        try {
            const adapter = this.app.vault.adapter;
            const oldPath = this.coerceToVaultPath(String(p));
            const oldExists = await adapter.exists(oldPath);
            if (oldExists)
                return null;
            const newExists = await adapter.exists(rewritten);
            if (!newExists)
                return null;
            return rewritten;
        }
        catch {
            return null;
        }
    }
    /**
     * 初始化存储目录（带锁防止并发）
     */
    async initialize() {
        // 如果已初始化，直接返回
        if (this.initialized)
            return;
        // 如果正在初始化，等待完成
        if (this.initPromise) {
            return this.initPromise;
        }
        // 开始初始化
        this.initPromise = this.doInitialize();
        try {
            await this.initPromise;
        }
        finally {
            this.initPromise = null;
        }
    }
    async doInitialize() {
        try {
            const storageDir = this.getStorageDir();
            logger.info(`[IRStorageService] ⚡ 开始初始化, STORAGE_DIR=${storageDir}`);
            // 确保存储目录存在（迁移由 SchemaV2MigrationService 统一处理）
            await this.ensureDirectory(storageDir);
            logger.info(`[IRStorageService] ⚡ 目录创建完成: ${storageDir}`);
            // 🔧 优化：移除不必要的 sleep，并行初始化文件
            const defaultBlocks = { version: IR_STORAGE_VERSION, blocks: {} };
            const defaultDecks = { version: IR_STORAGE_VERSION, decks: {} };
            const defaultHistory = { version: IR_STORAGE_VERSION, sessions: [] };
            const defaultCalendarProgress = { version: IR_STORAGE_VERSION, byDate: {} };
            // v5.3: 添加 chunks.json 和 sources.json 初始化
            const defaultChunks = { version: IR_STORAGE_VERSION, chunks: {} };
            const defaultSources = { version: IR_STORAGE_VERSION, sources: {} };
            // 并行确保文件存在
            await Promise.all([
                this.ensureFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(defaultBlocks)),
                this.ensureFile(`${storageDir}/${DECKS_FILE}`, JSON.stringify(defaultDecks)),
                this.ensureFile(`${storageDir}/${HISTORY_FILE}`, JSON.stringify(defaultHistory)),
                this.ensureFile(`${storageDir}/${CALENDAR_PROGRESS_FILE}`, JSON.stringify(defaultCalendarProgress)),
                this.ensureFile(`${storageDir}/${IRStorageService.STUDY_SESSIONS_FILE}`, '{"version":"1.0","sessions":[]}'),
                this.ensureFile(`${storageDir}/chunks.json`, JSON.stringify(defaultChunks)),
                this.ensureFile(`${storageDir}/sources.json`, JSON.stringify(defaultSources))
            ]);
            this.initialized = true;
            logger.info('[IRStorageService] ✅ 存储服务初始化完成');
        }
        catch (error) {
            logger.error('[IRStorageService] 初始化失败:', error);
            // 不抛出错误，允许后续操作继续（会使用默认值）
            this.initialized = true;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 确保目录存在（使用 adapter）
     */
    async ensureDirectory(path) {
        try {
            const adapter = this.app.vault.adapter;
            const normalized = normalizePath(path);
            const parts = normalized.split('/').filter(Boolean);
            let current = '';
            for (const part of parts) {
                current = current ? `${current}/${part}` : part;
                const exists = await adapter.exists(current);
                if (!exists) {
                    await adapter.mkdir(current);
                }
            }
        }
        catch (e) {
            // 忽略错误，目录可能已存在
        }
    }
    /**
     * 确保文件存在（使用 adapter）
     */
    async ensureFile(path, defaultContent) {
        try {
            const adapter = this.app.vault.adapter;
            const exists = await adapter.exists(path);
            if (!exists) {
                // 确保父目录存在
                const dir = path.substring(0, path.lastIndexOf('/'));
                if (dir) {
                    await this.ensureDirectory(dir);
                }
                await adapter.write(path, defaultContent);
            }
        }
        catch (e) {
            logger.warn(`[IRStorageService] 确保文件存在失败: ${path}`, e);
        }
    }
    // ============================================
    // 内容块操作
    // ============================================
    /**
     * 获取所有内容块 (v2.0 支持版本化结构)
     */
    async getAllBlocks() {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const content = await this.readFile(`${storageDir}/${BLOCKS_FILE}`, '{"version":"2.0","blocks":{}}');
        try {
            const data = JSON.parse(content);
            // v2.0 版本化结构
            if (data.version && data.blocks) {
                if (!this.migratedBlockReadablePaths) {
                    const roots = this.getReadableRoots();
                    if (roots && data.blocks && typeof data.blocks === 'object') {
                        let changed = false;
                        for (const block of Object.values(data.blocks)) {
                            if (!block || typeof block !== 'object')
                                continue;
                            const current = block.filePath;
                            const rewritten = await this.migrateReadablePathIfNeeded(current, roots.legacyRoot, roots.currentRoot);
                            if (rewritten) {
                                block.filePath = rewritten;
                                changed = true;
                            }
                        }
                        if (changed) {
                            await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(data));
                        }
                    }
                    this.migratedBlockReadablePaths = true;
                }
                return data.blocks;
            }
            // v1.0 兼容: 直接是块对象
            if (!this.migratedBlockReadablePaths && data && typeof data === 'object') {
                const roots = this.getReadableRoots();
                if (roots) {
                    let changed = false;
                    for (const block of Object.values(data)) {
                        if (!block || typeof block !== 'object')
                            continue;
                        const current = block.filePath;
                        const rewritten = await this.migrateReadablePathIfNeeded(current, roots.legacyRoot, roots.currentRoot);
                        if (rewritten) {
                            block.filePath = rewritten;
                            changed = true;
                        }
                    }
                    if (changed) {
                        await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(data));
                    }
                }
                this.migratedBlockReadablePaths = true;
            }
            return data;
        }
        catch (error) {
            logger.error('[IRStorageService] 解析内容块JSON失败:', error);
            return {};
        }
    }
    /**
     * 获取单个内容块
     */
    async getBlock(id) {
        const blocks = await this.getAllBlocks();
        return blocks[id] || null;
    }
    /**
     * 获取牌组的所有内容块 (v2.0: 支持blockIds索引)
     * @param deckId 牌组ID
     * @param includeIgnored 是否包含已忽略的内容块（默认false）
     * @param caller 调用者标识（用于调试）
     */
    async getBlocksByDeck(deckId, includeIgnored = false, caller = 'unknown') {
        const blocks = await this.getAllBlocks();
        const deck = await this.getDeckById(deckId);
        logger.info(`[IRStorageService] getBlocksByDeck [${caller}]: deckId=${deckId}, deck found=${!!deck}, blockIds count=${deck?.blockIds?.length || 0}, all blocks count=${Object.keys(blocks).length}`);
        // 过滤函数：排除suspended状态和带有ignore标签的内容块
        const filterIgnored = (block) => {
            if (includeIgnored)
                return true;
            // 排除suspended状态
            if (block.state === 'suspended')
                return false;
            // v2.3.1: 排除带有ignore标签的内容块（同时检查 tags 数组和 contentPreview）
            const hasIgnoreInTags = block.tags?.some(tag => tag.toLowerCase() === 'ignore' || tag.toLowerCase() === '#ignore') || false;
            const hasIgnoreInContent = /#ignore\b/i.test(block.contentPreview || '');
            if (hasIgnoreInTags || hasIgnoreInContent)
                return false;
            return true;
        };
        // v2.0: 使用blockIds索引
        if (deck && deck.blockIds && deck.blockIds.length > 0) {
            // 🔍 调试：检查 blockIds 和 blocks 键的匹配情况
            const blockKeys = Object.keys(blocks);
            const matchedCount = deck.blockIds.filter(id => blocks[id] !== undefined).length;
            logger.info(`[IRStorageService] getBlocksByDeck: blockIds=${deck.blockIds.length}, blocks键数=${blockKeys.length}, 匹配数=${matchedCount}`);
            if (matchedCount === 0 && deck.blockIds.length > 0) {
                logger.warn(`[IRStorageService] ⚠️ ID不匹配！blockIds前3个: ${JSON.stringify(deck.blockIds.slice(0, 3))}, blocks键前3个: ${JSON.stringify(blockKeys.slice(0, 3))}`);
            }
            const result = deck.blockIds
                .map(id => blocks[id])
                .filter((block) => block !== undefined)
                .filter(filterIgnored);
            return result;
        }
        // v1.0 兼容: 使用deckPath筛选（同时检查 deckPath 和 deck.path）
        const deckPath = deck?.path || deckId;
        // v1 兼容：通过 deckPath 查找
        const allBlockValues = Object.values(blocks);
        const v1Result = allBlockValues
            .filter(block => block.deckPath === deckId || block.deckPath === deckPath)
            .filter(filterIgnored);
        return v1Result;
    }
    /**
     * 获取文件的所有内容块 (v2.0: 使用startLine排序)
     */
    async getBlocksByFile(filePath) {
        const blocks = await this.getAllBlocks();
        return Object.values(blocks)
            .filter(block => block.filePath === filePath)
            .sort((a, b) => (a.startLine ?? a.blockIndex ?? 0) - (b.startLine ?? b.blockIndex ?? 0));
    }
    /**
     * 保存内容块 (v2.0 版本化存储)
     */
    async saveBlock(block) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const blocks = await this.getAllBlocks();
        blocks[block.id] = block;
        const store = {
            version: IR_STORAGE_VERSION,
            blocks
        };
        await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(store));
    }
    /**
     * 批量保存内容块 (v2.0 版本化存储)
     */
    async saveBlocks(newBlocks) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const blocks = await this.getAllBlocks();
        for (const block of newBlocks) {
            blocks[block.id] = block;
        }
        const store = {
            version: IR_STORAGE_VERSION,
            blocks
        };
        await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(store));
    }
    /**
     * 删除内容块 (v2.0 版本化存储)
     * v2.1: 实现级联删除，自动从所有牌组的 blockIds 中移除该 UUID
     */
    async deleteBlock(id) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const blocks = await this.getAllBlocks();
        const deletedBlock = blocks[id];
        delete blocks[id];
        const store = {
            version: IR_STORAGE_VERSION,
            blocks
        };
        await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(store));
        // v2.1: 级联删除 - 从所有牌组中移除该内容块引用
        await this.removeBlockFromAllDecks(id, deletedBlock?.filePath);
    }
    /**
     * 从所有牌组中移除指定内容块引用 (v2.1 新增)
     * @param blockId 要移除的内容块ID
     * @param filePath 内容块所属文件路径（用于更新 sourceFiles）
     */
    async removeBlockFromAllDecks(blockId, filePath) {
        const decks = await this.getAllDecks();
        let updatedCount = 0;
        for (const deck of Object.values(decks)) {
            if (deck.blockIds?.includes(blockId)) {
                // 移除内容块引用
                deck.blockIds = deck.blockIds.filter(id => id !== blockId);
                deck.updatedAt = new Date().toISOString();
                // 如果该文件在牌组中不再有内容块，从 sourceFiles 中移除
                if (filePath && deck.sourceFiles?.includes(filePath)) {
                    const blocks = await this.getAllBlocks();
                    const hasOtherBlocks = deck.blockIds.some(id => blocks[id]?.filePath === filePath);
                    if (!hasOtherBlocks) {
                        deck.sourceFiles = deck.sourceFiles.filter(f => f !== filePath);
                    }
                }
                await this.saveDeck(deck);
                updatedCount++;
            }
        }
        // 静默移除引用
    }
    /**
     * 删除文件的所有内容块 (v2.0 版本化存储)
     * v2.1: 实现级联删除，自动从所有牌组中移除这些内容块引用和 sourceFiles
     */
    async deleteBlocksByFile(filePath) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const blocks = await this.getAllBlocks();
        const idsToDelete = Object.keys(blocks).filter(id => blocks[id].filePath === filePath);
        for (const id of idsToDelete) {
            delete blocks[id];
        }
        const store = {
            version: IR_STORAGE_VERSION,
            blocks
        };
        await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(store));
        // v2.1: 级联删除 - 从所有牌组中移除这些内容块引用和文件引用
        if (idsToDelete.length > 0) {
            await this.removeBlocksFromAllDecks(idsToDelete, filePath);
        }
    }
    /**
     * 从所有牌组中批量移除内容块引用 (v2.1 新增)
     * @param blockIds 要移除的内容块ID列表
     * @param filePath 内容块所属文件路径（用于更新 sourceFiles）
     */
    async removeBlocksFromAllDecks(blockIds, filePath) {
        const decks = await this.getAllDecks();
        const idsToRemove = new Set(blockIds);
        let updatedCount = 0;
        for (const deck of Object.values(decks)) {
            const originalLength = deck.blockIds?.length || 0;
            // 移除内容块引用
            deck.blockIds = (deck.blockIds || []).filter(id => !idsToRemove.has(id));
            if (deck.blockIds.length < originalLength) {
                deck.updatedAt = new Date().toISOString();
                // 从 sourceFiles 中移除该文件
                if (deck.sourceFiles?.includes(filePath)) {
                    deck.sourceFiles = deck.sourceFiles.filter(f => f !== filePath);
                }
                await this.saveDeck(deck);
                updatedCount++;
            }
        }
        // 静默移除引用
    }
    // ============================================
    // 牌组操作
    // ============================================
    /**
     * 获取所有牌组 (v2.0 支持版本化结构)
     */
    async getAllDecks() {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const content = await this.readFile(`${storageDir}/${DECKS_FILE}`, '{"version":"2.0","decks":{}}');
        try {
            const data = JSON.parse(content);
            if (data.version && data.decks) {
                if (!this.migratedDeckReadablePaths) {
                    const roots = this.getReadableRoots();
                    if (roots && data.decks && typeof data.decks === 'object') {
                        let changed = false;
                        for (const deck of Object.values(data.decks)) {
                            if (!deck || typeof deck !== 'object')
                                continue;
                            const srcFiles = deck.sourceFiles;
                            if (Array.isArray(srcFiles)) {
                                for (let i = 0; i < srcFiles.length; i++) {
                                    const rewritten = await this.migrateReadablePathIfNeeded(srcFiles[i], roots.legacyRoot, roots.currentRoot);
                                    if (rewritten) {
                                        srcFiles[i] = rewritten;
                                        changed = true;
                                    }
                                }
                            }
                        }
                        if (changed) {
                            await this.writeFile(`${storageDir}/${DECKS_FILE}`, JSON.stringify(data));
                        }
                    }
                    this.migratedDeckReadablePaths = true;
                }
                return data.decks;
            }
            if (!this.migratedDeckReadablePaths && data && typeof data === 'object') {
                const roots = this.getReadableRoots();
                if (roots) {
                    let changed = false;
                    for (const deck of Object.values(data)) {
                        if (!deck || typeof deck !== 'object')
                            continue;
                        const srcFiles = deck.sourceFiles;
                        if (Array.isArray(srcFiles)) {
                            for (let i = 0; i < srcFiles.length; i++) {
                                const rewritten = await this.migrateReadablePathIfNeeded(srcFiles[i], roots.legacyRoot, roots.currentRoot);
                                if (rewritten) {
                                    srcFiles[i] = rewritten;
                                    changed = true;
                                }
                            }
                        }
                    }
                    if (changed) {
                        await this.writeFile(`${storageDir}/${DECKS_FILE}`, JSON.stringify(data));
                    }
                }
                this.migratedDeckReadablePaths = true;
            }
            return data;
        }
        catch (error) {
            logger.error('[IRStorageService] 解析牌组JSON失败:', error);
            return {};
        }
    }
    /**
     * 获取单个牌组 (v1.0 兼容: 使用path查找)
     * @deprecated 使用 getDeckById 代替
     */
    async getDeck(path) {
        const decks = await this.getAllDecks();
        // v2.0: 先尝试使用id查找
        if (decks[path])
            return decks[path];
        // v1.0 兼容: 遍历查找path字段
        return Object.values(decks).find(d => d.path === path) || null;
    }
    /**
     * 获取单个牌组 (v2.0: 使用id查找，兼容path)
     */
    async getDeckById(idOrPath) {
        const decks = await this.getAllDecks();
        // 先尝试 id 查找
        if (decks[idOrPath])
            return decks[idOrPath];
        // 兼容: 通过 path 字段查找
        return Object.values(decks).find(d => d.path === idOrPath) || null;
    }
    async migrateChunkDeckNameInYAML(oldName, newName) {
        await this.initialize();
        const fromName = String(oldName || '').trim();
        const toName = String(newName || '').trim();
        if (!fromName || !toName || fromName === toName) {
            return { scanned: 0, updated: 0 };
        }
        const normalizeDeckNameForTag = (name) => {
            return String(name || '')
                .trim()
                .replace(/[\s/\\#]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '') || '未分配';
        };
        const fromSeg = normalizeDeckNameForTag(fromName);
        const toSeg = normalizeDeckNameForTag(toName);
        const fromTag = `ir/deck/${fromSeg}`;
        const toTag = `ir/deck/${toSeg}`;
        const chunks = await this.getAllChunkData();
        const adapter = this.app.vault.adapter;
        const visited = new Set();
        let scanned = 0;
        let updated = 0;
        for (const chunk of Object.values(chunks)) {
            const filePath = String(chunk.filePath || '').trim();
            if (!filePath || visited.has(filePath))
                continue;
            visited.add(filePath);
            try {
                if (!await adapter.exists(filePath))
                    continue;
                const content = await adapter.read(filePath);
                scanned++;
                const yaml = parseYAMLFromContent(content);
                if (yaml.weave_type !== 'ir-chunk')
                    continue;
                const rawDeckNames = yaml.deck_names;
                let deckNames = [];
                if (Array.isArray(rawDeckNames)) {
                    deckNames = rawDeckNames.map((n) => String(n).trim()).filter(Boolean);
                }
                else if (typeof rawDeckNames === 'string' && rawDeckNames.trim()) {
                    deckNames = [rawDeckNames.trim()];
                }
                const rawDeckTag = typeof yaml.deck_tag === 'string' ? String(yaml.deck_tag) : '';
                const inferredFromTag = rawDeckTag === `#IR_deck_${fromName}`;
                const hasOld = deckNames.includes(fromName);
                if (!hasOld && !inferredFromTag)
                    continue;
                const nextDeckNames = deckNames.length > 0
                    ? deckNames.map(n => (n === fromName ? toName : n))
                    : [toName];
                let nextContent = content;
                nextContent = setCardProperty(nextContent, 'deck_names', nextDeckNames);
                const rawTags = yaml.tags;
                const tagsArr = Array.isArray(rawTags)
                    ? rawTags.map((t) => String(t).trim()).filter(Boolean)
                    : (typeof rawTags === 'string' && rawTags.trim() ? [rawTags.trim()] : []);
                const tags = new Set(tagsArr);
                tags.add('ir/deck');
                tags.delete(fromTag);
                tags.add(toTag);
                nextContent = setCardProperty(nextContent, 'tags', Array.from(tags));
                if (rawDeckTag === `#IR_deck_${fromName}`) {
                    nextContent = setCardProperty(nextContent, 'deck_tag', `#IR_deck_${toName}`);
                }
                if (nextContent !== content) {
                    await adapter.write(filePath, nextContent);
                    updated++;
                }
            }
            catch (error) {
                logger.warn(`[IRStorageService] 迁移块文件牌组名称失败: ${chunk.filePath}`, error);
            }
        }
        if (updated > 0) {
            await this.syncDeckDataFromYAML();
        }
        return { scanned, updated };
    }
    /**
     * 保存牌组 (v2.0 版本化存储)
     */
    async saveDeck(deck) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const decks = await this.getAllDecks();
        // v2.0: 使用id作为键
        const key = deck.id || deck.path || '';
        decks[key] = deck;
        const store = {
            version: IR_STORAGE_VERSION,
            decks
        };
        await this.writeFile(`${storageDir}/${DECKS_FILE}`, JSON.stringify(store));
    }
    /**
     * 删除牌组 (v2.0 版本化存储，兼容 id 和 path 查找)
     */
    async deleteDeck(idOrPath) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const decks = await this.getAllDecks();
        let deckKey = null;
        let targetDeck = null;
        if (decks[idOrPath]) {
            deckKey = idOrPath;
            targetDeck = decks[idOrPath];
        }
        else {
            const matchedKey = Object.keys(decks).find(key => decks[key].path === idOrPath);
            if (matchedKey) {
                deckKey = matchedKey;
                targetDeck = decks[matchedKey];
            }
        }
        if (!deckKey || !targetDeck) {
            logger.warn(`[IRStorageService] 未找到牌组: ${idOrPath}`);
            return;
        }
        const targetDeckId = targetDeck.id || deckKey;
        const targetDeckPath = targetDeck.path || targetDeckId;
        const targetDeckName = String(targetDeck.name || '').trim();
        const targetDeckTag = targetDeckName ? `#IR_deck_${targetDeckName}` : undefined;
        const sourceFiles = Array.isArray(targetDeck.sourceFiles) ? [...new Set(targetDeck.sourceFiles)] : [];
        await this.cleanupDeletedDeckRelatedData({
            deckId: targetDeckId,
            deckPath: targetDeckPath,
            deckName: targetDeckName,
            deckTag: targetDeckTag,
            sourceFiles
        });
        delete decks[deckKey];
        const store = {
            version: IR_STORAGE_VERSION,
            decks
        };
        await this.writeFile(`${storageDir}/${DECKS_FILE}`, JSON.stringify(store));
    }
    async cleanupDeletedDeckRelatedData(params) {
        const { deckId, deckPath, deckName, deckTag, sourceFiles } = params;
        const deckIdentifiers = this.toNormalizedStringSet([deckId, deckPath, deckName]);
        await this.cleanupDeckBookmarkTasks(deckId, deckIdentifiers, sourceFiles);
        await this.cleanupDeckBlocks(deckId, deckPath);
        await this.cleanupDeckChunksAndSources(deckId, deckTag);
        await this.cleanupDeckStudySessions(deckId, deckPath);
        await this.cleanupDeckSyncStates(sourceFiles);
        await this.cleanupDeckMarkdownFrontmatter(deckIdentifiers, deckId, sourceFiles);
    }
    async cleanupDeckBookmarkTasks(deckId, deckIdentifiers, sourceFiles) {
        const pdfPaths = this.collectSourceFilesByExtension(sourceFiles, '.pdf');
        const epubPaths = this.collectSourceFilesByExtension(sourceFiles, '.epub');
        try {
            const pdfService = new IRPdfBookmarkTaskService(this.app);
            await pdfService.initialize();
            await pdfService.deleteTasksByDeckIdentifiers(Array.from(deckIdentifiers));
            await pdfService.deleteTasksByPdfPaths(pdfPaths);
        }
        catch (error) {
            logger.warn(`[IRStorageService] 清理 PDF 书签任务失败: ${deckId}`, error);
        }
        try {
            const epubService = new IREpubBookmarkTaskService(this.app);
            await epubService.initialize();
            await epubService.deleteTasksByDeckIdentifiers(Array.from(deckIdentifiers));
            await epubService.deleteTasksByEpubPaths(epubPaths);
        }
        catch (error) {
            logger.warn(`[IRStorageService] 清理 EPUB 书签任务失败: ${deckId}`, error);
        }
    }
    toNormalizedStringSet(values) {
        return new Set((Array.isArray(values) ? values : [])
            .map(value => String(value || '').trim())
            .filter(Boolean));
    }
    collectSourceFilesByExtension(sourceFiles, extension) {
        const normalizedExtension = String(extension || '').toLowerCase();
        return Array.from(new Set((Array.isArray(sourceFiles) ? sourceFiles : [])
            .map(filePath => String(filePath || '').trim())
            .filter(filePath => filePath.toLowerCase().endsWith(normalizedExtension))));
    }
    async cleanupDeckBlocks(deckId, deckPath) {
        const storageDir = this.getStorageDir();
        const blocks = await this.getAllBlocks();
        let changed = false;
        for (const [blockId, block] of Object.entries(blocks)) {
            if (block.deckPath === deckId || block.deckPath === deckPath) {
                delete blocks[blockId];
                changed = true;
            }
        }
        if (!changed)
            return;
        const store = {
            version: IR_STORAGE_VERSION,
            blocks
        };
        await this.writeFile(`${storageDir}/${BLOCKS_FILE}`, JSON.stringify(store));
    }
    async cleanupDeckChunksAndSources(deckId, deckTag) {
        const storageDir = this.getStorageDir();
        const chunks = await this.getAllChunkData();
        const chunkEntries = Object.entries(chunks);
        const removedChunkIds = new Set();
        for (const [chunkId, chunk] of chunkEntries) {
            const inDeckIds = Array.isArray(chunk.deckIds) && chunk.deckIds.includes(deckId);
            const inDeckTag = Boolean(deckTag) && chunk.deckTag === deckTag;
            if (inDeckIds || inDeckTag) {
                delete chunks[chunkId];
                removedChunkIds.add(chunkId);
            }
        }
        if (removedChunkIds.size > 0) {
            const chunkStore = {
                version: IR_STORAGE_VERSION,
                chunks
            };
            await this.writeFile(`${storageDir}/${this.CHUNKS_FILE}`, JSON.stringify(chunkStore));
        }
        const sources = await this.getAllSources();
        let sourcesChanged = false;
        const remainingChunks = Object.values(chunks);
        for (const [sourceId] of Object.entries(sources)) {
            const stillReferenced = remainingChunks.some(chunk => chunk.sourceId === sourceId);
            if (!stillReferenced) {
                delete sources[sourceId];
                sourcesChanged = true;
            }
        }
        if (sourcesChanged) {
            const sourceStore = {
                version: IR_STORAGE_VERSION,
                sources
            };
            await this.writeFile(`${storageDir}/${this.SOURCES_FILE}`, JSON.stringify(sourceStore));
        }
    }
    async cleanupDeckStudySessions(deckId, deckPath) {
        const sessions = await this.getStudySessions();
        const filtered = sessions.filter(session => session.deckId !== deckId && session.deckId !== deckPath);
        if (filtered.length === sessions.length)
            return;
        const store = {
            version: '1.0',
            sessions: filtered
        };
        await this.writeFile(`${this.getStorageDir()}/${IRStorageService.STUDY_SESSIONS_FILE}`, JSON.stringify(store));
    }
    async cleanupDeckSyncStates(sourceFiles) {
        if (sourceFiles.length === 0)
            return;
        const states = await this.getAllSyncStates();
        let changed = false;
        for (const filePath of sourceFiles) {
            if (states[filePath]) {
                delete states[filePath];
                changed = true;
            }
        }
        if (changed) {
            await this.saveSyncStates(states);
        }
    }
    async cleanupDeckMarkdownFrontmatter(deckIdentifiers, deckId, sourceFiles) {
        if (sourceFiles.length === 0)
            return;
        const remainingDecks = await this.getAllDecks();
        const remainingSourceFileSet = new Set();
        for (const deck of Object.values(remainingDecks)) {
            if (deck.id === deckId)
                continue;
            for (const filePath of deck.sourceFiles || []) {
                remainingSourceFileSet.add(filePath);
            }
        }
        for (const filePath of sourceFiles) {
            if (!filePath.endsWith('.md'))
                continue;
            if (remainingSourceFileSet.has(filePath))
                continue;
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile))
                continue;
            try {
                await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                    const readingDeckId = typeof frontmatter['weave-reading-ir-deck-id'] === 'string'
                        ? String(frontmatter['weave-reading-ir-deck-id']).trim()
                        : '';
                    const hasPluginFields = frontmatter['weave-reading-id'] !== undefined ||
                        frontmatter['weave-reading-category'] !== undefined ||
                        frontmatter['weave-reading-priority'] !== undefined ||
                        frontmatter['weave-reading-ir-deck-id'] !== undefined;
                    if (!hasPluginFields) {
                        return;
                    }
                    if (readingDeckId && !deckIdentifiers.has(readingDeckId)) {
                        return;
                    }
                    delete frontmatter['weave-reading-id'];
                    delete frontmatter['weave-reading-category'];
                    delete frontmatter['weave-reading-priority'];
                    delete frontmatter['weave-reading-ir-deck-id'];
                });
            }
            catch (error) {
                logger.warn(`[IRStorageService] 清理 Markdown 增量阅读 frontmatter 失败: ${filePath}`, error);
            }
        }
    }
    /**
     * 向牌组添加内容块 (v2.0 新增)
     */
    async addBlocksToDeck(deckId, blockIds) {
        const deck = await this.getDeckById(deckId);
        if (!deck) {
            logger.warn(`[IRStorageService] 牌组不存在: ${deckId}`);
            return;
        }
        // 添加新的blockIds，去重
        const existingIds = new Set(deck.blockIds || []);
        for (const id of blockIds) {
            existingIds.add(id);
        }
        deck.blockIds = Array.from(existingIds);
        deck.updatedAt = new Date().toISOString();
        // 更新sourceFiles
        const blocks = await this.getAllBlocks();
        const files = new Set(deck.sourceFiles || []);
        for (const id of blockIds) {
            const block = blocks[id];
            if (block?.filePath) {
                files.add(block.filePath);
            }
        }
        deck.sourceFiles = Array.from(files);
        await this.saveDeck(deck);
    }
    /**
     * 从牌组移除内容块 (v2.0 新增)
     */
    async removeBlocksFromDeck(deckId, blockIds) {
        const deck = await this.getDeckById(deckId);
        if (!deck) {
            logger.warn(`[IRStorageService] 牌组不存在: ${deckId}`);
            return;
        }
        const idsToRemove = new Set(blockIds);
        deck.blockIds = (deck.blockIds || []).filter(id => !idsToRemove.has(id));
        deck.updatedAt = new Date().toISOString();
        await this.saveDeck(deck);
    }
    // ============================================
    // 历史记录操作
    // ============================================
    /**
     * 获取阅读历史 (v2.0 支持版本化结构)
     */
    async getHistory() {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const content = await this.readFile(`${storageDir}/${HISTORY_FILE}`, '{"version":"2.0","sessions":[]}');
        try {
            const data = JSON.parse(content);
            // v2.0 版本化结构
            if (data.version && data.sessions) {
                return { sessions: data.sessions };
            }
            // v1.0 兼容
            return data;
        }
        catch (error) {
            logger.error('[IRStorageService] 解析历史JSON失败:', error);
            return { sessions: [] };
        }
    }
    /**
     * 添加阅读会话 (v2.0 版本化存储)
     */
    async addSession(session) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const history = await this.getHistory();
        history.sessions.push(session);
        // 只保留最近1000条记录
        if (history.sessions.length > 1000) {
            history.sessions = history.sessions.slice(-1000);
        }
        const store = {
            version: IR_STORAGE_VERSION,
            sessions: history.sessions
        };
        await this.writeFile(`${storageDir}/${HISTORY_FILE}`, JSON.stringify(store));
    }
    /**
     * 获取内容块的阅读历史
     */
    async getBlockSessions(blockId) {
        const history = await this.getHistory();
        return history.sessions.filter(s => s.blockId === blockId);
    }
    async getCalendarProgress() {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const content = await this.readFile(`${storageDir}/${CALENDAR_PROGRESS_FILE}`, `{"version":"${IR_STORAGE_VERSION}","byDate":{}}`);
        try {
            const data = JSON.parse(content);
            return data.byDate && typeof data.byDate === 'object' ? data.byDate : {};
        }
        catch (error) {
            logger.error('[IRStorageService] 解析 calendar-progress JSON 失败:', error);
            return {};
        }
    }
    async addCalendarCompletion(dateKey, chunkId) {
        await this.initialize();
        const storageDir = this.getStorageDir();
        const byDate = await this.getCalendarProgress();
        const current = Array.isArray(byDate[dateKey]) ? byDate[dateKey] : [];
        if (!current.includes(chunkId)) {
            byDate[dateKey] = [...current, chunkId];
        }
        const store = { version: IR_STORAGE_VERSION, byDate };
        await this.writeFile(`${storageDir}/${CALENDAR_PROGRESS_FILE}`, JSON.stringify(store));
    }
    // ============================================
    // 学习会话记录 (v6.0 整场会话级别)
    // ============================================
    static STUDY_SESSIONS_FILE = 'study-sessions.json';
    /**
     * 获取所有学习会话记录
     */
    async getStudySessions() {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        const targetPath = `${this.getStorageDir()}/${IRStorageService.STUDY_SESSIONS_FILE}`;
        try {
            const exists = await adapter.exists(targetPath);
            if (!exists) {
                const candidates = new Set();
                candidates.add(`${PATHS.incrementalReading}/${IRStorageService.STUDY_SESSIONS_FILE}`);
                const roots = this.getReadableRoots();
                const readableRoot = roots?.currentRoot || 'weave';
                candidates.add(`${readableRoot}/incremental-reading/${IRStorageService.STUDY_SESSIONS_FILE}`);
                for (const legacyPath of candidates) {
                    if (await adapter.exists(legacyPath)) {
                        const legacyContent = await adapter.read(legacyPath);
                        await this.writeFile(targetPath, legacyContent);
                        break;
                    }
                }
            }
        }
        catch (error) {
            logger.warn('[IRStorageService] 检测/迁移学习会话文件失败:', error);
        }
        const content = await this.readFile(targetPath, '{"version":"1.0","sessions":[]}');
        try {
            const data = JSON.parse(content);
            return data.sessions || [];
        }
        catch (error) {
            logger.error('[IRStorageService] 解析学习会话JSON失败:', error);
            return [];
        }
    }
    /**
     * 添加学习会话记录
     */
    async addStudySession(session) {
        await this.initialize();
        const sessions = await this.getStudySessions();
        sessions.push(session);
        // 保留最近500条记录（会话级别的记录较大，控制数量）
        const trimmedSessions = sessions.length > 500 ? sessions.slice(-500) : sessions;
        const store = {
            version: '1.0',
            sessions: trimmedSessions
        };
        await this.writeFile(`${this.getStorageDir()}/${IRStorageService.STUDY_SESSIONS_FILE}`, JSON.stringify(store));
        logger.info(`[IRStorageService] 添加学习会话: ${session.id}, 时长: ${session.confirmedDuration}秒`);
    }
    /**
     * 获取指定牌组的学习会话
     */
    async getStudySessionsByDeck(deckId) {
        const sessions = await this.getStudySessions();
        return sessions.filter(s => s.deckId === deckId);
    }
    // ============================================
    // 统计数据
    // ============================================
    /**
     * 获取牌组统计
     * v2.4: 新增提问统计（解析复选框+问号语法）
     * v2.6: 优化性能 - 提问统计改为可选，默认跳过以加快加载
     * v5.3: 同时统计旧版 IRBlock 和新版 IRChunkFileData
     */
    async getDeckStats(deckPath, dailyNewLimit = 20, dailyReviewLimit = 50, learnAheadDays = 3) {
        // === 1. 旧版 IRBlock 统计 ===
        const blocks = await this.getBlocksByDeck(deckPath);
        const today = new Date().toISOString().split('T')[0];
        const nowMs = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startMs = startOfToday.getTime();
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const endMs = endOfToday.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const safeLearnAheadDays = Math.min(Math.max(learnAheadDays, 1), 14);
        const learnAheadEndMs = endMs + (safeLearnAheadDays - 1) * dayMs;
        // 🔍 调试：统计 state 分布
        const stateDistribution = {};
        for (const b of blocks) {
            const s = b.state ?? 'undefined';
            stateDistribution[s] = (stateDistribution[s] || 0) + 1;
        }
        logger.info(`[IRStorageService] getDeckStats: state分布=${JSON.stringify(stateDistribution)}`);
        const files = new Set();
        let newCount = 0;
        let learningCount = 0;
        let reviewCount = 0;
        let dueToday = 0;
        let dueWithinDays = 0;
        for (const block of blocks) {
            files.add(block.filePath);
            // 🔧 修复：如果 state 未定义，视为 new
            const state = block.state ?? 'new';
            switch (state) {
                case 'new':
                    newCount++;
                    // 新块视为已到期
                    dueToday++;
                    dueWithinDays++;
                    break;
                case 'learning':
                    learningCount++;
                    break;
                case 'review':
                    reviewCount++;
                    break;
            }
            // 检查是否到期（仅针对非 new 状态的块）
            if (state !== 'new' && state !== 'suspended') {
                if (!block.nextReview) {
                    dueToday++;
                    dueWithinDays++;
                }
                else {
                    const reviewMs = new Date(block.nextReview).getTime();
                    if (reviewMs >= startMs && reviewMs <= endMs) {
                        dueToday++;
                    }
                    if (reviewMs >= startMs && reviewMs <= learnAheadEndMs) {
                        dueWithinDays++;
                    }
                }
            }
        }
        // === 2. 新版 IRChunkFileData 统计 (v5.3) ===
        const deck = await this.getDeckById(deckPath);
        logger.info(`[IRStorageService] getDeckStats: deckPath=${deckPath}, deck found=${!!deck}, deck.id=${deck?.id}, deck.name=${deck?.name}`);
        const deckTag = deck ? `#IR_deck_${deck.name}` : `#IR_deck_${deckPath.split('/').pop() || deckPath}`;
        const allChunkData = await this.getAllChunkData();
        const allChunkValues = Object.values(allChunkData);
        const getFileTagsLower = (filePath) => {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile))
                return [];
            const cache = this.app.metadataCache.getFileCache(file);
            const inlineTags = cache?.tags?.map(t => t.tag.replace(/^#/, '')) || [];
            const fmTagsRaw = cache?.frontmatter?.tags;
            let fmTags = [];
            if (Array.isArray(fmTagsRaw)) {
                fmTags = fmTagsRaw.map(t => String(t));
            }
            else if (typeof fmTagsRaw === 'string') {
                fmTags = fmTagsRaw.split(',').map(t => t.trim());
            }
            return [...new Set([...fmTags, ...inlineTags])]
                .map(t => String(t).toLowerCase())
                .filter(Boolean);
        };
        const hasIgnoreTagInFile = (filePath) => {
            const tags = getFileTagsLower(filePath);
            if (tags.includes('ignore') || tags.includes('#ignore'))
                return true;
            const file = this.app.vault.getAbstractFileByPath(filePath);
            const cache = file instanceof TFile ? this.app.metadataCache.getFileCache(file) : null;
            const fm = cache?.frontmatter;
            const fmString = fm ? JSON.stringify(fm).toLowerCase() : '';
            return fmString.includes('ignore');
        };
        // 筛选属于当前牌组的 chunks（并过滤 ignore）
        const chunkValues = allChunkValues.filter(chunk => {
            const inDeck = chunk.deckTag === deckTag || (deck && chunk.deckIds?.includes(deck.id));
            if (!inDeck)
                return false;
            if (hasIgnoreTagInFile(chunk.filePath))
                return false;
            return true;
        });
        logger.info(`[IRStorageService] getDeckStats: 期望deckTag=${deckTag}, deck.id=${deck?.id}, 匹配chunks=${chunkValues.length}, 总chunks=${allChunkValues.length}`);
        for (const chunk of chunkValues) {
            files.add(chunk.filePath);
            switch (chunk.scheduleStatus) {
                case 'new':
                    newCount++;
                    dueToday++;
                    dueWithinDays++;
                    break;
                case 'queued':
                case 'active':
                    learningCount++;
                    break;
                case 'scheduled':
                    reviewCount++;
                    break;
            }
            // 检查是否到期（仅针对非 new 状态的块）
            if (chunk.scheduleStatus !== 'new' && chunk.scheduleStatus !== 'suspended' && chunk.scheduleStatus !== 'done' && chunk.scheduleStatus !== 'removed') {
                if (!chunk.nextRepDate || chunk.nextRepDate === 0) {
                    dueToday++;
                    dueWithinDays++;
                }
                else {
                    // 过期块也应计入今日到期
                    if (chunk.nextRepDate <= endMs) {
                        dueToday++;
                    }
                    // 过期块也应计入 N 天内到期
                    if (chunk.nextRepDate <= learnAheadEndMs) {
                        dueWithinDays++;
                    }
                }
            }
        }
        // === 3. PDF 书签任务统计 ===
        let pdfTaskCount = 0;
        try {
            const pdfService = new IRPdfBookmarkTaskService(this.app);
            await pdfService.initialize();
            const pdfTasks = await pdfService.getTasksByDeck(deckPath);
            for (const task of pdfTasks) {
                const status = String(task.status || 'new');
                if (status === 'done' || status === 'suspended' || status === 'removed')
                    continue;
                pdfTaskCount++;
                switch (status) {
                    case 'new':
                        newCount++;
                        dueToday++;
                        dueWithinDays++;
                        break;
                    case 'queued':
                    case 'active':
                        learningCount++;
                        break;
                    case 'scheduled':
                        reviewCount++;
                        break;
                }
                if (status !== 'new') {
                    const nrd = task.nextRepDate || 0;
                    if (!nrd || nrd <= endMs) {
                        dueToday++;
                    }
                    if (!nrd || nrd <= learnAheadEndMs) {
                        dueWithinDays++;
                    }
                }
            }
        }
        catch (e) {
            logger.debug('[IRStorageService] getDeckStats: PDF 书签任务统计失败', e);
        }
        const totalCount = blocks.length + chunkValues.length + pdfTaskCount;
        // v2.4: 统计提问数量（从源文件读取复选框+问号语法）
        const questionStats = await this.countQuestionsInFiles(Array.from(files));
        // v2.5: 计算应用每日限制后的今日可学数量
        const todayNewCount = Math.min(newCount, dailyNewLimit);
        const todayDueCount = Math.min(dueToday, dailyReviewLimit);
        return {
            newCount,
            learningCount,
            reviewCount,
            dueToday,
            dueWithinDays,
            totalCount,
            fileCount: files.size,
            questionCount: questionStats.total,
            completedQuestionCount: questionStats.completed,
            todayNewCount,
            todayDueCount
        };
    }
    /**
     * 统计文件中的提问数量 (v2.4 新增)
     * 识别格式: - [x] 问题? 或 - [ ] 问题?
     * @param filePaths 文件路径列表
     * @returns 提问总数和已完成数
     */
    async countQuestionsInFiles(filePaths) {
        let total = 0;
        let completed = 0;
        // 匹配复选框+问号的正则表达式
        // 格式: - [x] 或 - [ ] 开头，内容包含问号
        const completedQuestionRegex = /^[-*]\s*\[x\]\s*.+[?？]/gmi;
        const uncompletedQuestionRegex = /^[-*]\s*\[\s\]\s*.+[?？]/gmi;
        for (const filePath of filePaths) {
            try {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    const content = await this.app.vault.read(file);
                    // 统计已完成的提问（带 [x]）
                    const completedMatches = content.match(completedQuestionRegex);
                    const completedCount = completedMatches ? completedMatches.length : 0;
                    // 统计未完成的提问（带 [ ]）
                    const uncompletedMatches = content.match(uncompletedQuestionRegex);
                    const uncompletedCount = uncompletedMatches ? uncompletedMatches.length : 0;
                    completed += completedCount;
                    total += completedCount + uncompletedCount;
                }
            }
            catch (error) {
                // 静默跳过
            }
        }
        return { total, completed };
    }
    /**
     * 获取今日到期的内容块
     */
    async getTodayDueBlocks() {
        const blocks = await this.getAllBlocks();
        const today = new Date().toISOString().split('T')[0];
        return Object.values(blocks).filter(block => {
            if (block.state === 'new')
                return true;
            if (!block.nextReview)
                return false;
            const reviewDate = block.nextReview.split('T')[0];
            return reviewDate <= today;
        });
    }
    // ============================================
    // 文件操作辅助（使用 adapter 直接读写，绕过文件索引缓存）
    // ============================================
    /**
     * 读取文件内容（使用 adapter 直接读取）
     */
    async readFile(path, defaultContent = '{}') {
        try {
            const adapter = this.app.vault.adapter;
            // 检查文件是否存在
            const exists = await adapter.exists(path);
            if (exists) {
                const content = await adapter.read(path);
                return content;
            }
            // 文件不存在，创建并写入默认内容
            await this.writeFile(path, defaultContent);
            return defaultContent;
        }
        catch (error) {
            logger.warn(`[IRStorageService] 读取文件失败，返回默认值: ${path}`, error);
            return defaultContent;
        }
    }
    /**
     * 写入文件内容（使用 adapter 直接写入）
     */
    async writeFile(path, content) {
        try {
            const adapter = this.app.vault.adapter;
            // 确保目录存在
            const dir = path.substring(0, path.lastIndexOf('/'));
            if (dir) {
                await this.ensureDirectory(dir);
            }
            // 直接写入文件
            await adapter.write(path, content);
        }
        catch (error) {
            logger.error(`[IRStorageService] 写入文件失败: ${path}`, error);
            throw error;
        }
    }
    // ============================================
    // 文件同步状态管理 (v2.2 增量更新)
    // ============================================
    /**
     * 获取所有文件同步状态
     */
    async getAllSyncStates() {
        await this.initialize();
        const path = `${this.getStorageDir()}/${SYNC_STATE_FILE}`;
        const defaultStore = { version: IR_STORAGE_VERSION, files: {} };
        const content = await this.readFile(path, JSON.stringify(defaultStore));
        try {
            const store = JSON.parse(content);
            return store.files || {};
        }
        catch {
            return {};
        }
    }
    /**
     * 获取单个文件的同步状态
     */
    async getFileSyncState(filePath) {
        await this.initialize();
        const states = await this.getAllSyncStates();
        return states[filePath] || null;
    }
    async saveFileSyncState(state) {
        await this.initialize();
        const states = await this.getAllSyncStates();
        states[state.filePath] = state;
        await this.saveSyncStates(states);
    }
    async saveFileSyncStates(newStates) {
        await this.initialize();
        const states = await this.getAllSyncStates();
        for (const state of newStates) {
            states[state.filePath] = state;
        }
        await this.saveSyncStates(states);
    }
    async deleteFileSyncState(filePath) {
        await this.initialize();
        const states = await this.getAllSyncStates();
        if (states[filePath]) {
            delete states[filePath];
            await this.saveSyncStates(states);
        }
    }
    async saveSyncStates(states) {
        const store = {
            version: IR_STORAGE_VERSION,
            files: states
        };
        const path = `${this.getStorageDir()}/${SYNC_STATE_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
    }
    /**
     * 检测文件是否需要同步（基于 mtime 和 size）
     * @returns true 如果文件已变化需要同步
     */
    async checkFileNeedsSync(filePath, currentMtime, currentSize) {
        const state = await this.getFileSyncState(filePath);
        if (!state) {
            // 新文件，需要同步
            return true;
        }
        // 比较 mtime 和 size
        if (state.mtime !== currentMtime || state.size !== currentSize) {
            return true;
        }
        return false;
    }
    /**
     * 生成 UUID 列表哈希（用于快速检测块变化）
     */
    generateUuidListHash(uuids) {
        // 简单哈希：排序后连接，取前32位
        const sorted = [...uuids].sort();
        const combined = sorted.join('|');
        // 简单的 djb2 哈希算法
        let hash = 5381;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) + hash) + combined.charCodeAt(i);
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
    // ============================================
    // 数据完整性校验 (v2.1 新增)
    // ============================================
    /**
     * 校验并清理悬空引用 (v2.1 新增)
     * 用于插件启动时执行，确保数据完整性
     *
     * @returns 清理结果统计
     */
    async validateAndCleanOrphanedReferences() {
        await this.initialize();
        const result = {
            orphanedBlockIds: 0,
            orphanedSourceFiles: 0,
            affectedDecks: 0
        };
        // 获取所有有效的内容块ID
        const blocks = await this.getAllBlocks();
        const validBlockIds = new Set(Object.keys(blocks));
        // 获取所有有效的文件路径
        const validFilePaths = new Set();
        for (const block of Object.values(blocks)) {
            if (block.filePath) {
                validFilePaths.add(block.filePath);
            }
        }
        // 检查每个牌组
        const decks = await this.getAllDecks();
        for (const deck of Object.values(decks)) {
            let deckModified = false;
            const originalBlockCount = deck.blockIds?.length || 0;
            const originalFileCount = deck.sourceFiles?.length || 0;
            // 清理悬空的 blockIds
            if (deck.blockIds && deck.blockIds.length > 0) {
                const validBlockIdsInDeck = deck.blockIds.filter(id => validBlockIds.has(id));
                if (validBlockIdsInDeck.length < deck.blockIds.length) {
                    result.orphanedBlockIds += deck.blockIds.length - validBlockIdsInDeck.length;
                    deck.blockIds = validBlockIdsInDeck;
                    deckModified = true;
                }
            }
            // 清理悬空的 sourceFiles
            if (deck.sourceFiles && deck.sourceFiles.length > 0) {
                // 检查每个源文件是否仍有内容块在牌组中
                const validSourceFiles = deck.sourceFiles.filter(filePath => {
                    // 文件必须存在且在牌组中有对应的内容块
                    return deck.blockIds?.some(id => blocks[id]?.filePath === filePath);
                });
                if (validSourceFiles.length < deck.sourceFiles.length) {
                    result.orphanedSourceFiles += deck.sourceFiles.length - validSourceFiles.length;
                    deck.sourceFiles = validSourceFiles;
                    deckModified = true;
                }
            }
            // 保存修改
            if (deckModified) {
                deck.updatedAt = new Date().toISOString();
                await this.saveDeck(deck);
                result.affectedDecks++;
                logger.info(`[IRStorageService] 清理牌组 "${deck.name}" 的悬空引用: ` +
                    `blockIds ${originalBlockCount} -> ${deck.blockIds?.length || 0}, ` +
                    `sourceFiles ${originalFileCount} -> ${deck.sourceFiles?.length || 0}`);
            }
        }
        if (result.orphanedBlockIds > 0 || result.orphanedSourceFiles > 0) {
            logger.info(`[IRStorageService] 完整性校验完成: ` +
                `清理 ${result.orphanedBlockIds} 个悬空内容块引用, ` +
                `${result.orphanedSourceFiles} 个悬空源文件引用, ` +
                `影响 ${result.affectedDecks} 个牌组`);
        }
        else {
            // 无悬空引用
        }
        return result;
    }
    /**
     * 检查内容块是否存在对应的源文件 (v2.1 新增)
     * 用于检测源文件被删除但内容块记录未清理的情况
     *
     * @returns 孤立内容块的ID列表
     */
    async findOrphanedBlocks() {
        await this.initialize();
        const blocks = await this.getAllBlocks();
        const orphanedIds = [];
        for (const [id, block] of Object.entries(blocks)) {
            if (!block.filePath) {
                orphanedIds.push(id);
                continue;
            }
            // 检查文件是否存在
            const file = this.app.vault.getAbstractFileByPath(block.filePath);
            if (!file || !(file instanceof TFile)) {
                orphanedIds.push(id);
            }
        }
        return orphanedIds;
    }
    /**
     * 清理孤立内容块（源文件已删除）(v2.1 新增)
     *
     * @returns 清理的内容块数量
     */
    async cleanOrphanedBlocks() {
        const orphanedIds = await this.findOrphanedBlocks();
        if (orphanedIds.length === 0) {
            return 0;
        }
        // 删除孤立内容块（级联删除会自动清理牌组引用）
        for (const id of orphanedIds) {
            await this.deleteBlock(id);
        }
        logger.info(`[IRStorageService] 清理 ${orphanedIds.length} 个孤立内容块（源文件已删除）`);
        return orphanedIds.length;
    }
    // ============================================
    // v5.0 文件化内容块方案存储
    // ============================================
    SOURCES_FILE = 'sources.json';
    CHUNKS_FILE = 'chunks.json';
    /**
     * 获取所有源材料元数据
     */
    async getAllSources() {
        await this.initialize();
        const path = `${this.getStorageDir()}/${this.SOURCES_FILE}`;
        const defaultStore = { version: IR_STORAGE_VERSION, sources: {} };
        const content = await this.readFile(path, JSON.stringify(defaultStore));
        try {
            const store = JSON.parse(content);
            if (!this.migratedSourceReadablePaths) {
                const roots = this.getReadableRoots();
                if (roots && store?.sources && typeof store.sources === 'object') {
                    let changed = false;
                    for (const src of Object.values(store.sources)) {
                        if (!src || typeof src !== 'object')
                            continue;
                        const indexFilePath = src.indexFilePath;
                        const rewrittenIndex = await this.migrateReadablePathIfNeeded(indexFilePath, roots.legacyRoot, roots.currentRoot);
                        if (rewrittenIndex) {
                            src.indexFilePath = rewrittenIndex;
                            changed = true;
                        }
                        const rawFilePath = src.rawFilePath;
                        const rewrittenRaw = await this.migrateReadablePathIfNeeded(rawFilePath, roots.legacyRoot, roots.currentRoot);
                        if (rewrittenRaw) {
                            src.rawFilePath = rewrittenRaw;
                            changed = true;
                        }
                    }
                    if (changed) {
                        await this.writeFile(path, JSON.stringify(store));
                    }
                }
                this.migratedSourceReadablePaths = true;
            }
            return store.sources || {};
        }
        catch {
            return {};
        }
    }
    /**
     * 获取单个源材料元数据
     */
    async getSource(sourceId) {
        const sources = await this.getAllSources();
        return sources[sourceId] || null;
    }
    /**
     * 保存源材料元数据
     */
    async saveSource(source) {
        await this.initialize();
        const sources = await this.getAllSources();
        sources[source.sourceId] = source;
        const store = {
            version: IR_STORAGE_VERSION,
            sources
        };
        const path = `${this.getStorageDir()}/${this.SOURCES_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
    }
    async saveSourceBatch(sourceList) {
        await this.initialize();
        const sources = await this.getAllSources();
        for (const source of sourceList) {
            sources[source.sourceId] = source;
        }
        const store = {
            version: IR_STORAGE_VERSION,
            sources
        };
        const path = `${this.getStorageDir()}/${this.SOURCES_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
    }
    /**
     * 删除源材料元数据
     */
    async deleteSource(sourceId) {
        await this.initialize();
        const sources = await this.getAllSources();
        delete sources[sourceId];
        const store = {
            version: IR_STORAGE_VERSION,
            sources
        };
        const path = `${this.getStorageDir()}/${this.SOURCES_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
    }
    /**
     * 获取所有块文件调度数据
     */
    async getAllChunkData() {
        await this.initialize();
        const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
        const defaultStore = { version: IR_STORAGE_VERSION, chunks: {} };
        const content = await this.readFile(path, JSON.stringify(defaultStore));
        // v5.4: 自动迁移 - 检测并修复缺失的调度数据
        let needsSave = false;
        const parsed = JSON.parse(content);
        const now = Date.now();
        // v6.2: 为 TagGroup 回填准备 sources 数据（如读取失败则忽略）
        let sources = null;
        try {
            sources = await this.getAllSources();
        }
        catch {
            sources = null;
        }
        for (const [key, chunk] of Object.entries(parsed.chunks)) {
            // v5.5: 跳过无效数据（值为字符串而非对象）
            if (typeof chunk !== 'object' || chunk === null) {
                logger.warn(`[IRStorageService] 跳过无效块数据: key=${key}, value=${String(chunk).slice(0, 50)}`);
                delete parsed.chunks[key];
                needsSave = true;
                continue;
            }
            // v6.2: priorityUi 迁移 - 若旧数据缺失，则回填为当前 priorityEff
            if (chunk.priorityUi === undefined && typeof chunk.priorityEff === 'number') {
                chunk.priorityUi = chunk.priorityEff;
                needsSave = true;
            }
            // v6.2: meta.tagGroup 回填 - 若缺失或 default，尝试从 sources[sourceId].tagGroup 获取
            try {
                const sourceId = chunk.sourceId;
                const sourceTagGroup = sourceId && sources ? sources[sourceId]?.tagGroup : undefined;
                const currentTagGroup = chunk?.meta?.tagGroup;
                if (typeof sourceTagGroup === 'string' &&
                    sourceTagGroup.trim().length > 0 &&
                    sourceTagGroup !== 'default') {
                    if (!currentTagGroup || currentTagGroup === 'default') {
                        if (currentTagGroup !== sourceTagGroup) {
                            chunk.meta = {
                                ...chunk.meta,
                                tagGroup: sourceTagGroup
                            };
                            needsSave = true;
                        }
                    }
                }
            }
            catch {
                // ignore
            }
            // 修复 nextRepDate === 0 的旧数据
            if (chunk.nextRepDate === 0 || chunk.nextRepDate === undefined) {
                chunk.nextRepDate = now;
                chunk.intervalDays = chunk.intervalDays || 1;
                chunk.updatedAt = now;
                needsSave = true;
            }
        }
        // 如果有数据需要迁移，保存更新
        if (!this.migratedChunkReadablePaths) {
            const roots = this.getReadableRoots();
            if (roots && parsed?.chunks && typeof parsed.chunks === 'object') {
                for (const chunk of Object.values(parsed.chunks)) {
                    if (!chunk || typeof chunk !== 'object')
                        continue;
                    const current = chunk.filePath;
                    const rewritten = await this.migrateReadablePathIfNeeded(current, roots.legacyRoot, roots.currentRoot);
                    if (rewritten) {
                        chunk.filePath = rewritten;
                        needsSave = true;
                    }
                }
            }
            this.migratedChunkReadablePaths = true;
        }
        if (needsSave) {
            await this.writeFile(path, JSON.stringify(parsed));
            logger.info(`[IRStorageService] 自动迁移完成: 已修复缺失的调度数据`);
        }
        return parsed.chunks;
    }
    /**
     * 获取单个块文件调度数据
     */
    async getChunkData(chunkId) {
        const chunks = await this.getAllChunkData();
        return chunks[chunkId] || null;
    }
    /**
     * 保存块文件调度数据
     */
    async saveChunkData(chunk) {
        await this.initialize();
        const chunks = await this.getAllChunkData();
        chunks[chunk.chunkId] = chunk;
        const store = {
            version: IR_STORAGE_VERSION,
            chunks
        };
        const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
    }
    /**
     * 批量保存块文件调度数据
     */
    async saveChunkDataBatch(chunkList) {
        logger.info(`[IRStorageService] ⚡ saveChunkDataBatch 开始: ${chunkList.length} 个块`);
        await this.initialize();
        const chunks = await this.getAllChunkData();
        for (const chunk of chunkList) {
            chunks[chunk.chunkId] = chunk;
        }
        const store = {
            version: IR_STORAGE_VERSION,
            chunks
        };
        const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
        logger.info(`[IRStorageService] ⚡ 准备写入: ${path}, 总块数=${Object.keys(chunks).length}`);
        try {
            await this.writeFile(path, JSON.stringify(store));
            logger.info(`[IRStorageService] ✅ 批量保存成功: ${chunkList.length} 个块`);
        }
        catch (err) {
            logger.error(`[IRStorageService] ❌ 批量保存失败:`, err);
            throw err;
        }
    }
    /**
     * 删除块文件调度数据
     */
    async deleteChunkData(chunkId) {
        await this.initialize();
        const chunks = await this.getAllChunkData();
        delete chunks[chunkId];
        const store = {
            version: IR_STORAGE_VERSION,
            chunks
        };
        const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
    }
    /**
     * 获取源材料的所有块调度数据
     */
    async getChunkDataBySource(sourceId) {
        const chunks = await this.getAllChunkData();
        return Object.values(chunks).filter(c => c.sourceId === sourceId);
    }
    /**
     * 获取所有活跃状态的块调度数据（排除 done/archived）
     */
    async getActiveChunkData() {
        const chunks = await this.getAllChunkData();
        return Object.values(chunks).filter(c => c.scheduleStatus !== 'done' && c.scheduleStatus !== 'suspended' && c.scheduleStatus !== 'removed');
    }
    /**
     * 获取今日到期的块调度数据
     */
    async getTodayDueChunkData() {
        const chunks = await this.getAllChunkData();
        const now = Date.now();
        return Object.values(chunks).filter(chunk => {
            // 新块立即可用
            if (chunk.scheduleStatus === 'new')
                return true;
            // 已完成或暂停的跳过
            if (chunk.scheduleStatus === 'done' || chunk.scheduleStatus === 'suspended' || chunk.scheduleStatus === 'removed')
                return false;
            // 检查是否到期
            return chunk.nextRepDate <= now;
        });
    }
    // ============================================
    // v5.4: 牌组标签相关方法
    // ============================================
    /**
     * 根据牌组标签获取块调度数据
     * @param deckTag 牌组标签，格式 #IR_deck_牌组名
     */
    async getChunksByDeckTag(deckTag) {
        const chunks = await this.getAllChunkData();
        return Object.values(chunks).filter(c => c.deckTag === deckTag);
    }
    /**
     * 获取所有牌组标签列表（从 chunks.json 中提取）
     */
    async getAllDeckTags() {
        const chunks = await this.getAllChunkData();
        const tags = new Set();
        for (const chunk of Object.values(chunks)) {
            if (chunk.deckTag) {
                tags.add(chunk.deckTag);
            }
        }
        return Array.from(tags);
    }
    /**
     * 修改块的牌组标签（同时更新 JSON 和块文件 YAML）
     * @param chunkId 块 ID
     * @param newDeckTag 新牌组标签
     */
    async updateChunkDeckTag(chunkId, newDeckTag) {
        // 1. 更新 chunks.json
        const chunks = await this.getAllChunkData();
        const chunk = chunks[chunkId];
        if (!chunk) {
            throw new Error(`块不存在: ${chunkId}`);
        }
        const oldDeckTag = chunk.deckTag;
        chunk.deckTag = newDeckTag;
        chunk.updatedAt = Date.now();
        const store = {
            version: IR_STORAGE_VERSION,
            chunks
        };
        const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
        // 2. 更新块文件 YAML
        await this.updateChunkFileYAML(chunk.filePath, { deck_tag: newDeckTag });
        logger.info(`[IRStorageService] 更新块牌组标签: ${chunkId}, ${oldDeckTag} -> ${newDeckTag}`);
    }
    /**
     * 更新块文件的 YAML frontmatter
     */
    async updateChunkFileYAML(filePath, updates) {
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(filePath)) {
            logger.warn(`[IRStorageService] 块文件不存在，跳过 YAML 更新: ${filePath}`);
            return;
        }
        const content = await adapter.read(filePath);
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!yamlMatch) {
            logger.warn(`[IRStorageService] 块文件无 YAML frontmatter: ${filePath}`);
            return;
        }
        // 简单的 YAML 更新（逐行替换或追加）
        let yamlContent = yamlMatch[1];
        for (const [key, value] of Object.entries(updates)) {
            const regex = new RegExp(`^${key}:.*$`, 'm');
            const newLine = `${key}: "${value}"`;
            if (regex.test(yamlContent)) {
                yamlContent = yamlContent.replace(regex, newLine);
            }
            else {
                yamlContent += `\n${newLine}`;
            }
        }
        const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${yamlContent}\n---`);
        await adapter.write(filePath, newContent);
    }
    /**
     * 根据牌组标签获取统计数据
     */
    async getDeckStatsByTag(deckTag, dailyNewLimit = 20, dailyReviewLimit = 50) {
        const chunks = await this.getChunksByDeckTag(deckTag);
        const todayMs = new Date().setHours(23, 59, 59, 999);
        const files = new Set();
        let newCount = 0;
        let learningCount = 0;
        let reviewCount = 0;
        let dueToday = 0;
        for (const chunk of chunks) {
            files.add(chunk.filePath);
            switch (chunk.scheduleStatus) {
                case 'new':
                    newCount++;
                    break;
                case 'queued':
                case 'active':
                    // queued/active 对应旧版 learning 状态
                    learningCount++;
                    break;
                case 'scheduled':
                    // scheduled 对应旧版 review 状态
                    reviewCount++;
                    break;
            }
            if (chunk.nextRepDate && chunk.nextRepDate <= todayMs) {
                dueToday++;
            }
        }
        const todayNewCount = Math.min(newCount, dailyNewLimit);
        const todayDueCount = Math.min(dueToday, dailyReviewLimit);
        return {
            newCount,
            learningCount,
            reviewCount,
            dueToday,
            totalCount: chunks.length,
            fileCount: files.size,
            todayNewCount,
            todayDueCount
        };
    }
    // ============================================
    // v5.5: 从内容块文件 YAML 同步 deck_tag
    // ============================================
    /**
     * 从内容块文件 YAML 读取 deck_tag
     * @param filePath 块文件路径
     * @returns deck_tag 值，如果读取失败返回 null
     */
    async readDeckTagFromYAML(filePath) {
        try {
            const adapter = this.app.vault.adapter;
            if (!await adapter.exists(filePath)) {
                return null;
            }
            const content = await adapter.read(filePath);
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!yamlMatch)
                return null;
            const yamlContent = yamlMatch[1];
            const deckTagMatch = yamlContent.match(/^deck_tag:\s*["']?([^"'\n]+)["']?\s*$/m);
            if (deckTagMatch) {
                return deckTagMatch[1].trim();
            }
            return null;
        }
        catch (error) {
            logger.warn(`[IRStorageService] 读取块文件 deck_tag 失败: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 同步所有内容块的 deck_tag（以 YAML 为基准）
     * 返回需要更新的块数量
     */
    async syncDeckTagsFromYAML() {
        await this.initialize();
        const chunks = await this.getAllChunkData();
        const chunksToUpdate = [];
        // 记录每个牌组需要移除的块 ID
        const removedFromDecks = new Map();
        for (const chunk of Object.values(chunks)) {
            const yamlDeckTag = await this.readDeckTagFromYAML(chunk.filePath);
            if (yamlDeckTag === null) {
                // 文件不存在或无法读取，跳过
                continue;
            }
            // 如果 YAML 中的 deck_tag 与 chunks.json 不一致，以 YAML 为准
            if (yamlDeckTag !== chunk.deckTag) {
                const oldDeckTag = chunk.deckTag;
                // 记录从旧牌组移除
                if (oldDeckTag && oldDeckTag !== yamlDeckTag) {
                    if (!removedFromDecks.has(oldDeckTag)) {
                        removedFromDecks.set(oldDeckTag, []);
                    }
                    removedFromDecks.get(oldDeckTag).push(chunk.chunkId);
                }
                chunk.deckTag = yamlDeckTag;
                chunk.updatedAt = Date.now();
                chunksToUpdate.push(chunk);
            }
        }
        // 批量保存更新
        if (chunksToUpdate.length > 0) {
            await this.saveChunkDataBatch(chunksToUpdate);
            logger.info(`[IRStorageService] 同步 ${chunksToUpdate.length} 个块的 deck_tag`);
        }
        return { synced: chunksToUpdate.length, removed: removedFromDecks };
    }
    /**
     * 获取所有块数据（同步 YAML deck_tag 后）
     * 这是 getAllChunkData 的增强版本，确保 deck_tag 与文件 YAML 一致
     */
    async getAllChunkDataWithSync() {
        // 先同步牌组数据（包含验证）
        await this.syncDeckDataFromYAML();
        // 返回最新数据
        return this.getAllChunkData();
    }
    // ============================================
    // v5.5: 多牌组支持与牌组验证
    // ============================================
    /**
     * 从内容块文件 YAML 读取 deck_names（多牌组）
     * @param filePath 块文件路径
     * @returns deck_names 数组，如果读取失败返回 null
     */
    async readDeckNamesFromYAML(filePath) {
        try {
            const adapter = this.app.vault.adapter;
            if (!await adapter.exists(filePath)) {
                return null;
            }
            const content = await adapter.read(filePath);
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!yamlMatch)
                return null;
            const yamlContent = yamlMatch[1];
            // 尝试解析 deck_names 数组
            const deckNamesMatch = yamlContent.match(/^deck_names:\s*$/m);
            if (deckNamesMatch) {
                // 多行数组格式
                const arrayItems = [];
                const lines = yamlContent.split('\n');
                let inDeckNames = false;
                for (const line of lines) {
                    if (line.match(/^deck_names:\s*$/)) {
                        inDeckNames = true;
                        continue;
                    }
                    if (inDeckNames) {
                        if (line.match(/^\s+-\s+/)) {
                            const item = line.replace(/^\s+-\s+/, '').replace(/["']/g, '').trim();
                            if (item)
                                arrayItems.push(item);
                        }
                        else if (!line.match(/^\s/)) {
                            break; // 新的顶级键，结束
                        }
                    }
                }
                if (arrayItems.length > 0)
                    return arrayItems;
            }
            // 尝试单行数组格式: deck_names: ["a", "b"]
            const inlineMatch = yamlContent.match(/^deck_names:\s*\[(.*)\]\s*$/m);
            if (inlineMatch) {
                const items = inlineMatch[1].split(',').map(s => s.replace(/["']/g, '').trim()).filter(Boolean);
                if (items.length > 0)
                    return items;
            }
            // 回退：从 deck_tag 提取单个牌组名
            const deckTagMatch = yamlContent.match(/^deck_tag:\s*["']?#?IR_deck_([^"'\n]+)["']?\s*$/m);
            if (deckTagMatch) {
                return [deckTagMatch[1].trim()];
            }
            return null;
        }
        catch (error) {
            logger.warn(`[IRStorageService] 读取块文件 deck_names 失败: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 验证牌组名称，返回有效的牌组ID列表
     * @param deckNames 用户填写的牌组名称列表
     * @returns 验证通过的牌组ID列表
     */
    async validateDeckNames(deckNames) {
        const validDecks = await this.getAllDecks();
        const validDeckIds = [];
        for (const name of deckNames) {
            // 根据名称查找正式牌组
            const matchedDeck = Object.values(validDecks).find(d => d.name === name || d.name === name.replace('#IR_deck_', ''));
            if (matchedDeck) {
                validDeckIds.push(matchedDeck.id);
            }
            else {
                logger.warn(`[IRStorageService] 牌组名称无效（未在插件中创建）: ${name}`);
            }
        }
        return validDeckIds;
    }
    /**
     * 根据牌组ID获取牌组名称
     */
    async getDeckNameById(deckId) {
        const decks = await this.getAllDecks();
        const deck = decks[deckId];
        return deck ? deck.name : null;
    }
    /**
     * 根据牌组名称获取牌组ID
     */
    async getDeckIdByName(deckName) {
        const decks = await this.getAllDecks();
        const deck = Object.values(decks).find(d => d.name === deckName);
        return deck ? deck.id : null;
    }
    /**
     * 同步内容块的牌组数据（从 YAML 读取并验证）
     * 支持多牌组，以 YAML 中的 deck_names 为基准
     */
    async syncDeckDataFromYAML() {
        await this.initialize();
        const chunks = await this.getAllChunkData();
        const chunksToUpdate = [];
        const invalidDecks = new Set();
        for (const chunk of Object.values(chunks)) {
            const yamlDeckNames = await this.readDeckNamesFromYAML(chunk.filePath);
            if (yamlDeckNames === null) {
                continue;
            }
            // 验证牌组名称
            const validDeckIds = await this.validateDeckNames(yamlDeckNames);
            // 记录无效的牌组名称
            for (const name of yamlDeckNames) {
                const isValid = await this.getDeckIdByName(name);
                if (!isValid) {
                    invalidDecks.add(name);
                }
            }
            // 检查是否需要更新
            const currentDeckIds = chunk.deckIds || [];
            const needsUpdate = !this.arraysEqual(validDeckIds, currentDeckIds);
            if (needsUpdate) {
                chunk.deckIds = validDeckIds;
                // 保持 deckTag 兼容性（使用第一个牌组）
                if (validDeckIds.length > 0) {
                    const firstName = await this.getDeckNameById(validDeckIds[0]);
                    chunk.deckTag = firstName ? `#IR_deck_${firstName}` : undefined;
                }
                else {
                    chunk.deckTag = undefined;
                }
                chunk.updatedAt = Date.now();
                chunksToUpdate.push(chunk);
            }
        }
        if (chunksToUpdate.length > 0) {
            await this.saveChunkDataBatch(chunksToUpdate);
            logger.info(`[IRStorageService] 同步 ${chunksToUpdate.length} 个块的牌组数据`);
        }
        return { synced: chunksToUpdate.length, invalidDecks: Array.from(invalidDecks) };
    }
    /**
     * 辅助函数：比较两个数组是否相等
     */
    arraysEqual(a, b) {
        if (a.length !== b.length)
            return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, i) => val === sortedB[i]);
    }
    /**
     * 更新内容块的牌组（支持多牌组）
     * @param chunkId 块 ID
     * @param deckIds 牌组 ID 列表
     */
    async updateChunkDecks(chunkId, deckIds) {
        const chunks = await this.getAllChunkData();
        const chunk = chunks[chunkId];
        if (!chunk) {
            throw new Error(`块不存在: ${chunkId}`);
        }
        // 验证所有牌组 ID 都是有效的
        const validDecks = await this.getAllDecks();
        const validIds = deckIds.filter(id => validDecks[id]);
        chunk.deckIds = validIds;
        // 保持 deckTag 兼容性
        if (validIds.length > 0) {
            const firstName = validDecks[validIds[0]]?.name;
            chunk.deckTag = firstName ? `#IR_deck_${firstName}` : undefined;
        }
        else {
            chunk.deckTag = undefined;
        }
        chunk.updatedAt = Date.now();
        const store = {
            version: IR_STORAGE_VERSION,
            chunks
        };
        const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
        await this.writeFile(path, JSON.stringify(store));
        // 同时更新块文件 YAML
        const deckNames = validIds.map(id => validDecks[id]?.name).filter(Boolean);
        await this.updateChunkFileYAMLDeckNames(chunk.filePath, deckNames);
        logger.info(`[IRStorageService] 更新块牌组: ${chunkId}, 牌组数: ${validIds.length}`);
    }
    /**
     * 向内容块添加牌组
     */
    async addDeckToChunk(chunkId, deckId) {
        const chunks = await this.getAllChunkData();
        const chunk = chunks[chunkId];
        if (!chunk) {
            throw new Error(`块不存在: ${chunkId}`);
        }
        const currentDeckIds = chunk.deckIds || [];
        if (!currentDeckIds.includes(deckId)) {
            await this.updateChunkDecks(chunkId, [...currentDeckIds, deckId]);
        }
    }
    /**
     * 从内容块移除牌组
     */
    async removeDeckFromChunk(chunkId, deckId) {
        const chunks = await this.getAllChunkData();
        const chunk = chunks[chunkId];
        if (!chunk) {
            throw new Error(`块不存在: ${chunkId}`);
        }
        const currentDeckIds = chunk.deckIds || [];
        const newDeckIds = currentDeckIds.filter(id => id !== deckId);
        await this.updateChunkDecks(chunkId, newDeckIds);
    }
    /**
     * 更新块文件 YAML 中的 deck_names
     */
    async updateChunkFileYAMLDeckNames(filePath, deckNames) {
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(filePath)) {
            return;
        }
        const content = await adapter.read(filePath);
        const yaml = parseYAMLFromContent(content);
        if (yaml.weave_type !== 'ir-chunk') {
            return;
        }
        const normalizeDeckNameForTag = (name) => {
            return String(name || '')
                .trim()
                .replace(/[\s/\\#]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '') || '未分配';
        };
        const names = (Array.isArray(deckNames) ? deckNames : [])
            .map(n => String(n).trim())
            .filter(Boolean);
        const primaryName = names[0] || '未分配';
        let nextContent = content;
        nextContent = setCardProperty(nextContent, 'deck_names', names.length > 0 ? names : undefined);
        const rawTags = yaml.tags;
        const tagsArr = Array.isArray(rawTags)
            ? rawTags.map((t) => String(t).trim()).filter(Boolean)
            : (typeof rawTags === 'string' && rawTags.trim() ? [rawTags.trim()] : []);
        const tags = new Set(tagsArr);
        tags.add('ir/deck');
        for (const t of Array.from(tags)) {
            if (t.startsWith('ir/deck/') && t !== 'ir/deck') {
                tags.delete(t);
            }
        }
        for (const n of names) {
            const seg = normalizeDeckNameForTag(n);
            tags.add(`ir/deck/${seg}`);
        }
        nextContent = setCardProperty(nextContent, 'tags', Array.from(tags));
        // 兼容字段：deck_tag 仅保存第一个牌组名
        nextContent = setCardProperty(nextContent, 'deck_tag', `#IR_deck_${primaryName}`);
        if (nextContent !== content) {
            await adapter.write(filePath, nextContent);
        }
    }
    /**
     * 获取所有正式牌组列表（用于UI显示）
     */
    async getValidDeckList() {
        const decks = await this.getAllDecks();
        return Object.values(decks).map(d => ({ id: d.id, name: d.name }));
    }
    // ============================================
    // v5.5: 数据完整性检查与清理
    // ============================================
    /**
     * 清理无效的块数据（对应文件不存在的块）
     * 返回被清理的块数量
     */
    async cleanupInvalidChunks() {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        const chunks = await this.getAllChunkData();
        const invalidChunkIds = [];
        const invalidPaths = [];
        for (const [chunkId, chunk] of Object.entries(chunks)) {
            if (typeof chunk.filePath !== 'string' || chunk.filePath.trim() === '') {
                invalidChunkIds.push(chunkId);
                invalidPaths.push(String(chunk.filePath));
                continue;
            }
            // 检查块文件是否存在
            const exists = await adapter.exists(chunk.filePath);
            if (!exists) {
                invalidChunkIds.push(chunkId);
                invalidPaths.push(chunk.filePath);
            }
        }
        // 删除无效块
        if (invalidChunkIds.length > 0) {
            for (const chunkId of invalidChunkIds) {
                delete chunks[chunkId];
            }
            const store = {
                version: IR_STORAGE_VERSION,
                chunks
            };
            const path = `${this.getStorageDir()}/${this.CHUNKS_FILE}`;
            await this.writeFile(path, JSON.stringify(store));
            logger.info(`[IRStorageService] 清理了 ${invalidChunkIds.length} 个无效块`);
        }
        return { removed: invalidChunkIds.length, invalidPaths };
    }
    async slimIRMarkdownFrontmatter(scanRoot) {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        const walk = async (dir) => {
            const result = [];
            try {
                const listed = await adapter.list(dir);
                for (const f of listed.files)
                    result.push(f);
                for (const sub of listed.folders) {
                    const nested = await walk(sub);
                    for (const f of nested)
                        result.push(f);
                }
            }
            catch {
                return result;
            }
            return result;
        };
        const root = resolveIRImportFolder(scanRoot);
        const files = await walk(root);
        let updated = 0;
        let scanned = 0;
        for (const filePath of files) {
            if (!filePath.endsWith('.md'))
                continue;
            scanned++;
            let content;
            try {
                content = await adapter.read(filePath);
            }
            catch {
                continue;
            }
            if (!content.startsWith('---'))
                continue;
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!yamlMatch)
                continue;
            const yaml = yamlMatch[1];
            const isChunk = yaml.includes('weave_type: ir-chunk');
            const isIndex = yaml.includes('weave_type: ir-index');
            if (!isChunk && !isIndex)
                continue;
            let newYaml = yaml;
            if (isChunk) {
                newYaml = newYaml
                    .replace(/^tag_group:.*$\n?/gm, '')
                    .replace(/^chunk_order:.*$\n?/gm, '')
                    .replace(/^priority_reason:.*$\n?/gm, '');
            }
            if (isIndex) {
                newYaml = newYaml
                    .replace(/^tag_group:.*$\n?/gm, '')
                    .replace(/^created_at:.*$\n?/gm, '');
            }
            newYaml = newYaml.replace(/\n{3,}/g, '\n\n').trim();
            if (newYaml === yaml.trim())
                continue;
            const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newYaml}\n---`);
            try {
                await adapter.write(filePath, newContent);
                updated++;
            }
            catch {
                continue;
            }
        }
        return { updated, scanned };
    }
    async cleanupOrphanChunkFiles(scanRoot) {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        const chunks = await this.getAllChunkData();
        const sources = await this.getAllSources();
        const knownChunkIds = new Set(Object.keys(chunks));
        const knownSourceIds = new Set(Object.keys(sources));
        const chunkRoot = resolveIRImportFolder(scanRoot);
        const walk = async (dir) => {
            const result = [];
            try {
                const listed = await adapter.list(dir);
                for (const f of listed.files)
                    result.push(f);
                for (const sub of listed.folders) {
                    const nested = await walk(sub);
                    for (const f of nested)
                        result.push(f);
                }
            }
            catch {
                return result;
            }
            return result;
        };
        const files = await walk(chunkRoot);
        let removed = 0;
        for (const filePath of files) {
            if (!filePath.endsWith('.md'))
                continue;
            let content;
            try {
                content = await adapter.read(filePath);
            }
            catch {
                continue;
            }
            if (!content.startsWith('---'))
                continue;
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!yamlMatch)
                continue;
            const yaml = yamlMatch[1];
            if (yaml.includes('weave_type: ir-chunk')) {
                const idMatch = yaml.match(/^chunk_id:\s*(["']?)([^\n"']+)\1\s*$/m);
                if (!idMatch)
                    continue;
                const chunkId = idMatch[2].trim();
                if (!knownChunkIds.has(chunkId)) {
                    try {
                        await adapter.remove(filePath);
                        removed++;
                    }
                    catch {
                    }
                }
            }
            else if (yaml.includes('weave_type: ir-index')) {
                const idMatch = yaml.match(/^source_id:\s*(["']?)([^\n"']+)\1\s*$/m);
                if (!idMatch)
                    continue;
                const sourceId = idMatch[2].trim();
                const hasChunks = Object.values(chunks).some(c => c.sourceId === sourceId);
                if (!knownSourceIds.has(sourceId) && !hasChunks) {
                    try {
                        await adapter.remove(filePath);
                        removed++;
                    }
                    catch {
                    }
                }
            }
        }
        return { removed };
    }
    /**
     * 清理无效的旧版块数据（blocks.json）
     */
    async cleanupInvalidBlocks() {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        const blocks = await this.getAllBlocks();
        const invalidBlockIds = [];
        const invalidPaths = [];
        for (const [blockId, block] of Object.entries(blocks)) {
            if (typeof block.filePath !== 'string' || String(block.filePath).trim() === '') {
                invalidBlockIds.push(blockId);
                invalidPaths.push(String(block.filePath));
                continue;
            }
            // 检查源文件是否存在
            const exists = await adapter.exists(block.filePath);
            if (!exists) {
                invalidBlockIds.push(blockId);
                invalidPaths.push(block.filePath);
            }
        }
        // 删除无效块
        if (invalidBlockIds.length > 0) {
            for (const blockId of invalidBlockIds) {
                delete blocks[blockId];
            }
            const store = {
                version: IR_STORAGE_VERSION,
                blocks
            };
            const path = `${this.getStorageDir()}/${BLOCKS_FILE}`;
            await this.writeFile(path, JSON.stringify(store));
            logger.info(`[IRStorageService] 清理了 ${invalidBlockIds.length} 个无效旧版块`);
        }
        return { removed: invalidBlockIds.length, invalidPaths };
    }
    /**
     * 清理无效的源材料数据
     */
    async cleanupInvalidSources() {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        const sources = await this.getAllSources();
        const chunks = await this.getAllChunkData();
        const invalidSourceIds = [];
        for (const [sourceId, source] of Object.entries(sources)) {
            // 检查索引文件是否存在
            const indexExists = source.indexFilePath ? await adapter.exists(source.indexFilePath) : false;
            // 检查是否有任何关联的块
            const hasChunks = Object.values(chunks).some(c => c.sourceId === sourceId);
            if (!indexExists && !hasChunks) {
                invalidSourceIds.push(sourceId);
            }
        }
        // 删除无效源材料
        if (invalidSourceIds.length > 0) {
            for (const sourceId of invalidSourceIds) {
                delete sources[sourceId];
            }
            const store = {
                version: IR_STORAGE_VERSION,
                sources
            };
            const path = `${this.getStorageDir()}/${this.SOURCES_FILE}`;
            await this.writeFile(path, JSON.stringify(store));
            logger.info(`[IRStorageService] 清理了 ${invalidSourceIds.length} 个无效源材料`);
        }
        return { removed: invalidSourceIds.length };
    }
    /**
     * 执行完整的数据完整性检查和清理
     * 在加载数据前调用，确保显示的数据都是有效的
     */
    async performIntegrityCheck(scanRoot) {
        logger.info('[IRStorageService] 开始数据完整性检查...');
        const chunksResult = await this.cleanupInvalidChunks();
        const blocksResult = await this.cleanupInvalidBlocks();
        const sourcesResult = await this.cleanupInvalidSources();
        const orphanFilesResult = await this.cleanupOrphanChunkFiles(scanRoot);
        if (orphanFilesResult.removed > 0) {
            logger.info(`[IRStorageService] 清理了 ${orphanFilesResult.removed} 个孤儿块文件`);
        }
        const total = chunksResult.removed + blocksResult.removed + sourcesResult.removed;
        if (total > 0) {
            logger.info(`[IRStorageService] 数据完整性检查完成，共清理 ${total} 个无效数据`);
        }
        return {
            chunksRemoved: chunksResult.removed,
            blocksRemoved: blocksResult.removed,
            sourcesRemoved: sourcesResult.removed
        };
    }
    /**
     * 获取所有块数据（带完整性检查）
     * 先清理无效数据，再返回有效数据
     */
    async getAllChunkDataWithIntegrityCheck(scanRoot) {
        // 先执行完整性检查
        await this.performIntegrityCheck(scanRoot);
        // 再同步牌组数据
        await this.syncDeckDataFromYAML();
        // 返回最新有效数据
        return this.getAllChunkData();
    }
}
