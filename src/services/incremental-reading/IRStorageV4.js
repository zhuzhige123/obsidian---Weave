/**
 * 增量阅读存储服务 v4.0（简化版）
 *
 * 直接使用 IRBlockV4 格式存储，无需 V3 兼容
 *
 * @module services/incremental-reading/IRStorageV4
 * @version 4.0.0
 */
import { logger } from '../../utils/logger';
import { getV2PathsFromApp } from '../../config/paths';
// ============================================
// IRStorageV4 类
// ============================================
export class IRStorageV4 {
    app;
    initialized = false;
    // 内存缓存
    blocksCache = {};
    decksCache = {};
    sessionsCache = [];
    // 存储路径
    basePath;
    blocksFile;
    decksFile;
    historyFile;
    constructor(app) {
        this.app = app;
        this.basePath = getV2PathsFromApp(app).ir.root;
        this.blocksFile = `${this.basePath}/blocks-v4.json`;
        this.decksFile = `${this.basePath}/decks-v4.json`;
        this.historyFile = `${this.basePath}/history-v4.json`;
    }
    // ============================================
    // 初始化
    // ============================================
    async initialize() {
        if (this.initialized)
            return;
        const startTime = Date.now();
        try {
            // 确保目录存在
            await this.ensureDirectory();
            // 加载数据
            await Promise.all([
                this.loadBlocks(),
                this.loadDecks(),
                this.loadHistory()
            ]);
            this.initialized = true;
            logger.info(`[IRStorageV4] 初始化完成: ${Date.now() - startTime}ms`);
        }
        catch (error) {
            logger.error('[IRStorageV4] 初始化失败:', error);
            throw error;
        }
    }
    async ensureDirectory() {
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(this.basePath)) {
            await adapter.mkdir(this.basePath);
        }
    }
    // ============================================
    // 内容块操作
    // ============================================
    /**
     * 获取所有内容块
     */
    async getAllBlocks() {
        await this.initialize();
        return { ...this.blocksCache };
    }
    /**
     * 获取单个内容块
     */
    async getBlock(id) {
        await this.initialize();
        return this.blocksCache[id] || null;
    }
    /**
     * 保存内容块
     */
    async saveBlock(block) {
        await this.initialize();
        block.updatedAt = Date.now();
        this.blocksCache[block.id] = block;
        await this.persistBlocks();
    }
    /**
     * 批量保存内容块
     */
    async saveBlocks(blocks) {
        await this.initialize();
        const now = Date.now();
        for (const block of blocks) {
            block.updatedAt = now;
            this.blocksCache[block.id] = block;
        }
        await this.persistBlocks();
    }
    /**
     * 删除内容块
     */
    async deleteBlock(id) {
        await this.initialize();
        delete this.blocksCache[id];
        await this.persistBlocks();
    }
    /**
     * 获取牌组的所有内容块
     */
    async getBlocksByDeck(deckId) {
        await this.initialize();
        const deck = this.decksCache[deckId];
        if (!deck) {
            logger.warn(`[IRStorageV4] 牌组不存在: ${deckId}`);
            return [];
        }
        // 使用 blockIds 索引
        if (deck.blockIds && deck.blockIds.length > 0) {
            return deck.blockIds
                .map(id => this.blocksCache[id])
                .filter((b) => b !== undefined)
                .filter(b => b.status !== 'suspended' && b.status !== 'done');
        }
        // 兼容：使用 sourcePath 匹配
        const deckPath = deck.path || deckId;
        return Object.values(this.blocksCache)
            .filter(b => b.sourcePath.startsWith(deckPath))
            .filter(b => b.status !== 'suspended' && b.status !== 'done');
    }
    /**
     * 获取文件的所有内容块
     */
    async getBlocksByFile(filePath) {
        await this.initialize();
        return Object.values(this.blocksCache)
            .filter(b => b.sourcePath === filePath);
    }
    /**
     * 获取到期的内容块
     */
    async getDueBlocks(deckId) {
        const blocks = await this.getBlocksByDeck(deckId);
        const now = Date.now();
        return blocks.filter(block => {
            // 新块总是到期
            if (block.status === 'new')
                return true;
            // scheduled 状态：检查时间
            if (block.status === 'scheduled') {
                return block.nextRepDate === 0 || block.nextRepDate <= now;
            }
            // queued 状态：也检查时间
            if (block.status === 'queued') {
                return block.nextRepDate === 0 || block.nextRepDate <= now;
            }
            return false;
        });
    }
    // ============================================
    // 牌组操作
    // ============================================
    /**
     * 获取所有牌组
     */
    async getAllDecks() {
        await this.initialize();
        return { ...this.decksCache };
    }
    /**
     * 获取单个牌组
     */
    async getDeck(idOrPath) {
        await this.initialize();
        // 优先 ID 匹配
        if (this.decksCache[idOrPath]) {
            return this.decksCache[idOrPath];
        }
        // 兼容 path 匹配
        for (const deck of Object.values(this.decksCache)) {
            if (deck.path === idOrPath) {
                return deck;
            }
        }
        return null;
    }
    /**
     * 保存牌组
     */
    async saveDeck(deck) {
        await this.initialize();
        deck.updatedAt = new Date().toISOString();
        this.decksCache[deck.id] = deck;
        await this.persistDecks();
    }
    /**
     * 删除牌组
     */
    async deleteDeck(idOrPath) {
        await this.initialize();
        // 优先 ID 匹配
        if (this.decksCache[idOrPath]) {
            delete this.decksCache[idOrPath];
        }
        else {
            // 兼容 path 匹配
            for (const [id, deck] of Object.entries(this.decksCache)) {
                if (deck.path === idOrPath) {
                    delete this.decksCache[id];
                    break;
                }
            }
        }
        await this.persistDecks();
    }
    /**
     * 向牌组添加内容块
     */
    async addBlocksToDeck(deckId, blockIds) {
        await this.initialize();
        const deck = this.decksCache[deckId];
        if (!deck) {
            logger.warn(`[IRStorageV4] 牌组不存在: ${deckId}`);
            return;
        }
        deck.blockIds = deck.blockIds || [];
        const existing = new Set(deck.blockIds);
        for (const id of blockIds) {
            if (!existing.has(id)) {
                deck.blockIds.push(id);
            }
        }
        await this.persistDecks();
    }
    /**
     * 获取牌组统计
     * @param learnAheadDays 待读天数（用于计算N天内到期的内容块）
     */
    async getDeckStats(deckId, learnAheadDays = 3) {
        const blocks = await this.getBlocksByDeck(deckId);
        const now = Date.now();
        const safeLearnAheadDays = Math.min(Math.max(learnAheadDays, 1), 14);
        const learnAheadMs = now + safeLearnAheadDays * 24 * 60 * 60 * 1000;
        let newCount = 0;
        let learningCount = 0;
        let reviewCount = 0;
        let dueToday = 0;
        let dueWithinDays = 0;
        const files = new Set();
        for (const block of blocks) {
            files.add(block.sourcePath);
            switch (block.status) {
                case 'new':
                    newCount++;
                    dueToday++; // 新块视为到期
                    dueWithinDays++;
                    break;
                case 'queued':
                case 'active':
                    learningCount++;
                    if (block.nextRepDate === 0 || block.nextRepDate <= now) {
                        dueToday++;
                        dueWithinDays++;
                    }
                    else if (block.nextRepDate <= learnAheadMs) {
                        dueWithinDays++;
                    }
                    break;
                case 'scheduled':
                    reviewCount++;
                    if (block.nextRepDate === 0 || block.nextRepDate <= now) {
                        dueToday++;
                        dueWithinDays++;
                    }
                    else if (block.nextRepDate <= learnAheadMs) {
                        dueWithinDays++;
                    }
                    break;
            }
        }
        return {
            newCount,
            learningCount,
            reviewCount,
            dueToday,
            dueWithinDays,
            totalCount: blocks.length,
            fileCount: files.size,
            questionCount: 0,
            completedQuestionCount: 0,
            todayNewCount: newCount,
            todayDueCount: dueToday
        };
    }
    // ============================================
    // 历史记录操作
    // ============================================
    /**
     * 添加会话记录
     */
    async addSession(session) {
        await this.initialize();
        this.sessionsCache.push(session);
        // 限制历史记录数量
        const maxSessions = 10000;
        if (this.sessionsCache.length > maxSessions) {
            this.sessionsCache = this.sessionsCache.slice(-maxSessions);
        }
        await this.persistHistory();
    }
    /**
     * 获取内容块的会话记录
     */
    async getBlockSessions(blockId) {
        await this.initialize();
        return this.sessionsCache.filter(s => s.blockId === blockId);
    }
    // ============================================
    // 持久化
    // ============================================
    async loadBlocks() {
        try {
            const adapter = this.app.vault.adapter;
            if (await adapter.exists(this.blocksFile)) {
                const content = await adapter.read(this.blocksFile);
                const data = JSON.parse(content);
                this.blocksCache = data.blocks || {};
                logger.debug(`[IRStorageV4] 加载 ${Object.keys(this.blocksCache).length} 个块`);
            }
        }
        catch (error) {
            logger.error('[IRStorageV4] 加载 blocks 失败:', error);
            this.blocksCache = {};
        }
    }
    async loadDecks() {
        try {
            const adapter = this.app.vault.adapter;
            if (await adapter.exists(this.decksFile)) {
                const content = await adapter.read(this.decksFile);
                const data = JSON.parse(content);
                this.decksCache = data.decks || {};
                logger.debug(`[IRStorageV4] 加载 ${Object.keys(this.decksCache).length} 个牌组`);
            }
        }
        catch (error) {
            logger.error('[IRStorageV4] 加载 decks 失败:', error);
            this.decksCache = {};
        }
    }
    async loadHistory() {
        try {
            const adapter = this.app.vault.adapter;
            if (await adapter.exists(this.historyFile)) {
                const content = await adapter.read(this.historyFile);
                const data = JSON.parse(content);
                this.sessionsCache = data.sessions || [];
                logger.debug(`[IRStorageV4] 加载 ${this.sessionsCache.length} 个会话记录`);
            }
        }
        catch (error) {
            logger.error('[IRStorageV4] 加载 history 失败:', error);
            this.sessionsCache = [];
        }
    }
    async persistBlocks() {
        try {
            const adapter = this.app.vault.adapter;
            const data = {
                version: '4.0',
                blocks: this.blocksCache
            };
            await adapter.write(this.blocksFile, JSON.stringify(data));
        }
        catch (error) {
            logger.error('[IRStorageV4] 保存 blocks 失败:', error);
            throw error;
        }
    }
    async persistDecks() {
        try {
            const adapter = this.app.vault.adapter;
            const data = {
                version: '4.0',
                decks: this.decksCache
            };
            await adapter.write(this.decksFile, JSON.stringify(data));
        }
        catch (error) {
            logger.error('[IRStorageV4] 保存 decks 失败:', error);
            throw error;
        }
    }
    async persistHistory() {
        try {
            const adapter = this.app.vault.adapter;
            const data = {
                version: '4.0',
                sessions: this.sessionsCache
            };
            await adapter.write(this.historyFile, JSON.stringify(data));
        }
        catch (error) {
            logger.error('[IRStorageV4] 保存 history 失败:', error);
            throw error;
        }
    }
}
/**
 * 工厂函数
 */
export function createIRStorageV4(app) {
    return new IRStorageV4(app);
}
