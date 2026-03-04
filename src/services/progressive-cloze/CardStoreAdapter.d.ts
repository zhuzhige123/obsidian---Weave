/**
 * CardStore适配器
 *
 * 桥接V2架构的ICardStore接口和现有的AnkiDataStorage
 *
 * @module services/progressive-cloze/CardStoreAdapter
 * @version 2.0.0
 */
import type { Card } from '../../data/types';
import type { ICardStore } from './CardAccessor';
import type { WeaveDataStorage } from '../../data/storage';
/**
 * CardStore适配器
 *
 * 将AnkiDataStorage适配为ICardStore接口
 */
export declare class CardStoreAdapter implements ICardStore {
    private storage;
    private cardsCache;
    private cacheInitialized;
    constructor(storage: WeaveDataStorage);
    /**
     * 初始化缓存
     * 从存储加载所有卡片到内存缓存
     */
    initializeCache(): Promise<void>;
    /**
     * 获取单张卡片
     */
    getCard(uuid: string): Card | null;
    /**
     * 批量获取卡片
     */
    getCards(uuids: string[]): Card[];
    /**
     * 保存卡片到缓存
     *
     * 注意：这只更新缓存，需要调用storage.saveCard持久化
     */
    updateCache(card: Card): void;
    /**
     * 从缓存删除卡片
     */
    removeFromCache(uuid: string): void;
    /**
     * 批量更新缓存
     */
    updateCacheBatch(cards: Card[]): void;
    /**
     * 清空缓存
     */
    clearCache(): void;
    /**
     * 获取所有卡片
     */
    getAllCards(): Card[];
    /**
     * 获取缓存统计
     */
    getCacheStats(): {
        totalCards: number;
        initialized: boolean;
    };
}
