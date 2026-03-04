/**
 * 增量阅读文件化块调度适配器
 *
 * 桥接 IRChunkFileService 和现有调度系统：
 * - 从块文件 YAML 读取用户设置（status, priority_ui）
 * - 同步调度状态到存储服务
 * - 过滤完成态块，排除出 IR 会话
 *
 * @module services/incremental-reading/IRChunkScheduleAdapter
 * @version 5.0.0 - 文件化内容块方案
 */
import { App } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import type { IRChunkFileData } from '../../types/ir-types';
export declare class IRChunkScheduleAdapter {
    private app;
    private storage;
    private chunkFileService;
    constructor(app: App, storage: IRStorageService, chunkRoot?: string);
    /**
     * 获取所有可调度的块（排除 done/archived）
     */
    getSchedulableChunks(): Promise<IRChunkFileData[]>;
    /**
     * 获取今日到期的块
     */
    getTodayDueChunks(): Promise<IRChunkFileData[]>;
    /**
     * 更新块的调度状态
     */
    updateChunkSchedule(chunkId: string, updates: Partial<Pick<IRChunkFileData, 'priorityUi' | 'priorityEff' | 'intervalDays' | 'nextRepDate' | 'scheduleStatus' | 'doneReason' | 'doneAt'>>): Promise<void>;
    /**
     * 批量更新多个块的调度状态（只写一次 chunks.json）
     */
    batchUpdateChunkSchedules(updates: Array<{
        chunkId: string;
        data: Partial<Pick<IRChunkFileData, 'priorityUi' | 'priorityEff' | 'intervalDays' | 'nextRepDate' | 'scheduleStatus' | 'doneReason' | 'doneAt'>>;
    }>): Promise<number>;
    /**
     * 将块标记为完成
     */
    markChunkDone(chunkId: string): Promise<void>;
    /**
     * 记录块交互统计
     */
    recordChunkInteraction(chunkId: string, readingTimeSec: number, actions?: {
        extracts?: number;
        cardsCreated?: number;
        notesWritten?: number;
    }): Promise<void>;
    /**
     * 从 YAML 同步状态到调度数据
     * 用于检测用户直接编辑 YAML 的情况
     */
    syncFromYAML(chunkId: string): Promise<boolean>;
    /**
     * 批量同步所有块的 YAML 状态
     */
    syncAllFromYAML(): Promise<number>;
}
