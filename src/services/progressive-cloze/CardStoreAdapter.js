import { logger } from '../../utils/logger';
/**
 * CardStore适配器
 *
 * 将AnkiDataStorage适配为ICardStore接口
 */
export class CardStoreAdapter {
    storage;
    cardsCache = new Map();
    cacheInitialized = false;
    constructor(storage) {
        this.storage = storage;
    }
    /**
     * 初始化缓存
     * 从存储加载所有卡片到内存缓存
     */
    async initializeCache() {
        if (this.cacheInitialized)
            return;
        try {
            const decks = await this.storage.getDecks();
            for (const deck of decks) {
                const cards = await this.storage.getCards({ deckId: deck.id });
                for (const card of cards) {
                    this.cardsCache.set(card.uuid, card);
                }
            }
            this.cacheInitialized = true;
            logger.debug(`[CardStoreAdapter] 缓存初始化完成: ${this.cardsCache.size}张卡片`);
        }
        catch (error) {
            logger.error('[CardStoreAdapter] 缓存初始化失败:', error);
            throw error;
        }
    }
    /**
     * 获取单张卡片
     */
    getCard(uuid) {
        return this.cardsCache.get(uuid) || null;
    }
    /**
     * 批量获取卡片
     */
    getCards(uuids) {
        const cards = [];
        for (const uuid of uuids) {
            const card = this.cardsCache.get(uuid);
            if (card) {
                cards.push(card);
            }
        }
        return cards;
    }
    /**
     * 保存卡片到缓存
     *
     * 注意：这只更新缓存，需要调用storage.saveCard持久化
     */
    updateCache(card) {
        this.cardsCache.set(card.uuid, card);
    }
    /**
     * 从缓存删除卡片
     */
    removeFromCache(uuid) {
        this.cardsCache.delete(uuid);
    }
    /**
     * 批量更新缓存
     */
    updateCacheBatch(cards) {
        for (const card of cards) {
            this.cardsCache.set(card.uuid, card);
        }
    }
    /**
     * 清空缓存
     */
    clearCache() {
        this.cardsCache.clear();
        this.cacheInitialized = false;
    }
    /**
     * 获取所有卡片
     */
    getAllCards() {
        return Array.from(this.cardsCache.values());
    }
    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            totalCards: this.cardsCache.size,
            initialized: this.cacheInitialized
        };
    }
}
