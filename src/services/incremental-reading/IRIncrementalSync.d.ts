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
import { App, TFile } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import { IRContentSplitter } from './IRContentSplitter';
export interface SyncResult {
    /** 同步的文件数 */
    syncedFiles: number;
    /** 跳过的文件数（未变化） */
    skippedFiles: number;
    /** 新增的块数 */
    newBlocks: number;
    /** 更新的块数 */
    updatedBlocks: number;
    /** 删除的块数 */
    deletedBlocks: number;
    /** 耗时（毫秒） */
    duration: number;
}
export declare class IRIncrementalSync {
    private app;
    private storage;
    private contentSplitter;
    private importFolder;
    constructor(app: App, storage: IRStorageService, contentSplitter: IRContentSplitter, importFolder?: string);
    /**
     * 更新导入文件夹路径
     */
    setImportFolder(folder: string): void;
    /**
     * 执行增量同步（打开牌组时调用）
     * 仅同步 mtime/size 变化的文件
     */
    syncOnDeckOpen(deckPath?: string): Promise<SyncResult>;
    /**
     * 同步单个文件
     * @returns 同步结果
     */
    syncSingleFile(file: TFile): Promise<{
        synced: boolean;
        newBlocks: number;
        updatedBlocks: number;
        deletedBlocks: number;
    }>;
    /**
     * 同步文件中的内容块
     */
    private syncFileBlocks;
    /**
     * 提取内容中的所有 UUID
     */
    private extractUuids;
    /**
     * 按 UUID 解析内容块
     */
    private parseBlocksByUuid;
    /**
     * 提取标题
     */
    private extractTitle;
    /**
     * 获取文件夹中的所有 Markdown 文件
     */
    private getMarkdownFilesInFolder;
}
