import type { App } from 'obsidian';
import type { IRBlock, IRDeck, IRSession } from '../../types/ir-types';
import type { IRBlockV4, IRBlockStatus, IRBlockStats } from '../../types/ir-types';
import { IRStorageService } from './IRStorageService';
/**
 * V4 存储适配器
 * 在现有 IRStorageService 之上提供 V4 类型支持
 */
export declare class IRStorageAdapterV4 {
    private storage;
    private app;
    constructor(app: App, storage?: IRStorageService);
    /**
     * 初始化
     */
    initialize(): Promise<void>;
    /**
     * 获取所有内容块 (V4格式)
     */
    getAllBlocksV4(): Promise<Record<string, IRBlockV4>>;
    /**
     * 获取单个内容块 (V4格式)
     */
    getBlockV4(id: string): Promise<IRBlockV4 | null>;
    /**
     * 获取牌组的所有内容块 (V4格式)
     * v5.4: 优先使用 chunks.json 数据，回退到 blocks.json
     */
    getBlocksByDeckV4(deckId: string, includeIgnored?: boolean): Promise<IRBlockV4[]>;
    getBlocksByDeckV4Fast(deckId: string, includeIgnored?: boolean): Promise<IRBlockV4[]>;
    /**
     * 将 IRChunkFileData 转换为 IRBlockV4
     * @param chunk 块数据
     * @param sourceOriginalPath 可选的源文档原始路径（用于文档关联筛选）
     */
    private chunkToV4;
    /**
     * v5.4: 将 IRChunkFileData 转换为 IRBlockV4，并从块文件读取标题和内容预览
     * v6.1: 支持传入 sources 数据，用于设置正确的 sourcePath（源文档路径）
     */
    private chunkToV4WithTitle;
    private chunkToV4Fast;
    private extractTagsFromYamlContent;
    private hasIgnoreTag;
    /**
     * 获取文件的所有内容块 (V4格式)
     */
    getBlocksByFileV4(filePath: string): Promise<IRBlockV4[]>;
    /**
     * 保存内容块 (V4格式)
     */
    saveBlockV4(block: IRBlockV4): Promise<void>;
    /**
     * 批量保存内容块 (V4格式)
     */
    saveBlocksV4(blocks: IRBlockV4[]): Promise<void>;
    /**
     * 删除内容块
     */
    deleteBlock(id: string): Promise<void>;
    /**
     * 删除文件的所有内容块
     */
    deleteBlocksByFile(filePath: string): Promise<void>;
    getAllDecks(): Promise<Record<string, IRDeck>>;
    getDeckById(idOrPath: string): Promise<IRDeck | null>;
    saveDeck(deck: IRDeck): Promise<void>;
    deleteDeck(idOrPath: string): Promise<void>;
    addBlocksToDeck(deckId: string, blockIds: string[]): Promise<void>;
    removeBlocksFromDeck(deckId: string, blockIds: string[]): Promise<void>;
    getHistory(): Promise<{
        sessions: IRSession[];
    }>;
    addSession(session: IRSession): Promise<void>;
    getBlockSessions(blockId: string): Promise<IRSession[]>;
    /**
     * 获取到期的 V4 内容块
     */
    getDueBlocksV4(deckId: string): Promise<IRBlockV4[]>;
    /**
     * 获取指定状态的 V4 内容块
     */
    getBlocksByStatusV4(deckId: string, status: IRBlockStatus): Promise<IRBlockV4[]>;
    /**
     * 更新内容块统计信息
     */
    updateBlockStatsV4(blockId: string, statsUpdate: Partial<IRBlockStats>): Promise<IRBlockV4 | null>;
    /**
     * 记录阅读会话并更新块统计
     */
    recordReadingSessionV4(block: IRBlockV4, readingTimeSec: number, effectiveTimeSec: number, actions: {
        extracts?: number;
        cardsCreated?: number;
        notesWritten?: number;
    }): Promise<IRBlockV4>;
    /**
     * IRBlock (V3) → IRBlockV4
     */
    private toV4;
    /**
     * IRBlockV4 → IRBlock (V3) - 公开版本
     * v5.4: 用于将 V4 块转换为 V3 格式以使用 IRFocusInterface
     */
    v4ToV3Public(block: IRBlockV4): IRBlock;
    /**
     * IRBlockV4 → IRBlock (V3)
     * 用于保存到现有存储
     */
    private toV3;
    /**
     * 将连续优先级(0-10)映射为枚举
     */
    private mapPriorityUiToEnum;
    /**
     * 将所有 V3 内容块迁移到 V4 格式
     * （实际数据仍存储为 V3，但会补全 V4 字段）
     */
    migrateAllToV4(): Promise<{
        migrated: number;
        errors: number;
    }>;
}
