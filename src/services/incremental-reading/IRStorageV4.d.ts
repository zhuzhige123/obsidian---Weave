/**
 * 增量阅读存储服务 v4.0（简化版）
 *
 * 直接使用 IRBlockV4 格式存储，无需 V3 兼容
 *
 * @module services/incremental-reading/IRStorageV4
 * @version 4.0.0
 */
import type { App } from 'obsidian';
import type { IRBlockV4, IRDeck, IRDeckStats, IRSession } from '../../types/ir-types';
export declare class IRStorageV4 {
    private app;
    private initialized;
    private blocksCache;
    private decksCache;
    private sessionsCache;
    private readonly basePath;
    private readonly blocksFile;
    private readonly decksFile;
    private readonly historyFile;
    constructor(app: App);
    initialize(): Promise<void>;
    private ensureDirectory;
    /**
     * 获取所有内容块
     */
    getAllBlocks(): Promise<Record<string, IRBlockV4>>;
    /**
     * 获取单个内容块
     */
    getBlock(id: string): Promise<IRBlockV4 | null>;
    /**
     * 保存内容块
     */
    saveBlock(block: IRBlockV4): Promise<void>;
    /**
     * 批量保存内容块
     */
    saveBlocks(blocks: IRBlockV4[]): Promise<void>;
    /**
     * 删除内容块
     */
    deleteBlock(id: string): Promise<void>;
    /**
     * 获取牌组的所有内容块
     */
    getBlocksByDeck(deckId: string): Promise<IRBlockV4[]>;
    /**
     * 获取文件的所有内容块
     */
    getBlocksByFile(filePath: string): Promise<IRBlockV4[]>;
    /**
     * 获取到期的内容块
     */
    getDueBlocks(deckId: string): Promise<IRBlockV4[]>;
    /**
     * 获取所有牌组
     */
    getAllDecks(): Promise<Record<string, IRDeck>>;
    /**
     * 获取单个牌组
     */
    getDeck(idOrPath: string): Promise<IRDeck | null>;
    /**
     * 保存牌组
     */
    saveDeck(deck: IRDeck): Promise<void>;
    /**
     * 删除牌组
     */
    deleteDeck(idOrPath: string): Promise<void>;
    /**
     * 向牌组添加内容块
     */
    addBlocksToDeck(deckId: string, blockIds: string[]): Promise<void>;
    /**
     * 获取牌组统计
     * @param learnAheadDays 待读天数（用于计算N天内到期的内容块）
     */
    getDeckStats(deckId: string, learnAheadDays?: number): Promise<IRDeckStats>;
    /**
     * 添加会话记录
     */
    addSession(session: IRSession): Promise<void>;
    /**
     * 获取内容块的会话记录
     */
    getBlockSessions(blockId: string): Promise<IRSession[]>;
    private loadBlocks;
    private loadDecks;
    private loadHistory;
    private persistBlocks;
    private persistDecks;
    private persistHistory;
}
/**
 * 工厂函数
 */
export declare function createIRStorageV4(app: App): IRStorageV4;
