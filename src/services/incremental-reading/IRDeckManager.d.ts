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
import { App, TFile } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import type { IRDeck, IRDeckStats, IRDeckSettings } from '../../types/ir-types';
export declare class IRDeckManager {
    private app;
    private storage;
    private chunkRoot;
    constructor(app: App, storage: IRStorageService, chunkRoot?: string);
    private cleanAllEmptyFoldersUnderChunks;
    /**
     * 检查并删除空文件夹
     * @param folderPath 文件夹路径
     * @returns 是否成功删除
     */
    private cleanEmptyFolder;
    /**
     * 递归清理空父文件夹
     * @param filePath 已删除文件的路径
     */
    private cleanEmptyParentFolders;
    /**
     * 获取所有增量阅读牌组
     */
    getAllDecks(): Promise<IRDeck[]>;
    /**
     * 获取牌组及其统计 (v2.0: 使用deck.id, v2.4: 新增提问统计)
     */
    getDecksWithStats(options?: {
        dailyNewLimit?: number;
        dailyReviewLimit?: number;
        learnAheadDays?: number;
    }): Promise<Array<{
        deck: IRDeck;
        stats: IRDeckStats;
    }>>;
    /**
     * 导入文件夹作为牌组 (v2.0: 使用createDefaultIRDeck)
     */
    importFolder(folderPath: string, settings?: Partial<IRDeckSettings>): Promise<IRDeck>;
    private collectReadingMaterialsForDeck;
    private cleanupReadingArtifactsForDeck;
    /**
     * 删除牌组（同时删除所有关联的内容块数据）
     */
    deleteDeck(deckId: string): Promise<void>;
    /**
     * 解散牌组 (v2.0 新增: 仅删除牌组，保留块数据)
     */
    disbandDeck(deckId: string): Promise<void>;
    /**
     * 创建空牌组 (v2.0 新增: 用于跨文件组织)
     */
    createDeck(name: string, description?: string): Promise<IRDeck>;
    /**
     * 向牌组添加内容块 (v2.0 新增)
     */
    addBlocksToDeck(deckId: string, blockIds: string[]): Promise<void>;
    /**
     * 从牌组移除内容块 (v2.0 新增)
     */
    removeBlocksFromDeck(deckId: string, blockIds: string[]): Promise<void>;
    /**
     * 更新牌组设置
     */
    updateDeckSettings(deckPath: string, settings: Partial<IRDeckSettings>): Promise<IRDeck>;
    /**
     * 扫描文件夹中的 Markdown 文件
     */
    scanFolderFiles(folderPath: string): Promise<TFile[]>;
    /**
     * 获取牌组的所有文件
     */
    getDeckFiles(deckPath: string): Promise<TFile[]>;
    /**
     * 检查文件夹是否可以作为牌组导入
     */
    canImportFolder(folderPath: string): Promise<{
        canImport: boolean;
        reason?: string;
        fileCount?: number;
    }>;
    /**
     * 获取可导入的文件夹列表
     */
    getImportableFolders(): Promise<Array<{
        path: string;
        name: string;
        fileCount: number;
    }>>;
    /**
     * 刷新牌组（重新扫描文件夹）
     */
    refreshDeck(deckPath: string): Promise<{
        added: number;
        removed: number;
        unchanged: number;
    }>;
}
