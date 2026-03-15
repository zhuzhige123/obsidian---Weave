/**
 * 增量阅读 V4 调度服务
 *
 * 整合 IRStateMachineV4 + IRChunkScheduleAdapter + IRTagGroupService
 * 提供完整的 V4 调度能力，替代 V3 IRSchedulingFacade
 *
 * @module services/incremental-reading/IRV4SchedulerService
 * @version 4.0.0
 */
import { App } from 'obsidian';
import { IRTagGroupService } from './IRTagGroupService';
import { IRStorageAdapterV4 } from './IRStorageAdapterV4';
import { IRPdfBookmarkTaskService } from './IRPdfBookmarkTaskService';
import { IREpubBookmarkTaskService } from './IREpubBookmarkTaskService';
import type { IRBlockV4, IRBlock } from '../../types/ir-types';
/**
 * 阅读完成数据
 */
export interface ReadingCompletionDataV4 {
    rating: number;
    readingTimeSeconds: number;
    priorityUi: number;
    createdCardCount: number;
    createdExtractCount: number;
    createdNoteCount: number;
    /** v3.1: 标注信号值（由UI层预计算传入，0~maxBoost） */
    annotationSignal?: number;
}
/**
 * 完成块结果
 */
export interface CompleteBlockResultV4 {
    block: IRBlockV4;
    nextRepDate: number;
    intervalDays: number;
}
/**
 * V4 调度服务
 */
export declare class IRV4SchedulerService {
    private app;
    private stateMachine;
    private chunkAdapter;
    private tagGroupService;
    private storageService;
    private storageAdapterV4;
    private queueGenerator;
    private _pdfBookmarkTaskService;
    private _epubBookmarkTaskService;
    private initialized;
    constructor(app: App, chunkRoot?: string);
    get pdfBookmarkTaskService(): IRPdfBookmarkTaskService;
    get epubBookmarkTaskService(): IREpubBookmarkTaskService;
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    private autoBackfillTagGroupsOnce;
    private getAdvancedSettingsSnapshot;
    /**
     * 获取标签组跟随模式设置
     */
    private getTagGroupFollowMode;
    getStudyQueueV4(deckPath: string, options?: {
        timeBudgetMinutes?: number;
        currentSourcePath?: string | null;
        markActive?: boolean;
        preloadedBlocks?: IRBlockV4[];
    }): Promise<{
        queue: IRBlockV4[];
        totalEstimatedMinutes: number;
        stats: {
            candidateCount: number;
            scheduledCount: number;
            groupDistribution: Record<string, number>;
            overBudget: boolean;
            overBudgetRatio: number;
            persistedTransitions: number;
            activeBlockId: string | null;
        };
    }>;
    /**
     * 完成内容块（V4 版本）
     *
     * @param blockV4 V4 格式内容块
     * @param data 完成数据
     * @param deckPath 牌组路径（用于会话记录）
     * @returns 更新后的块和调度信息
     */
    completeBlockV4(blockV4: IRBlockV4, data: ReadingCompletionDataV4, deckPath?: string): Promise<CompleteBlockResultV4>;
    /**
     * 跳过内容块（不更新调度间隔，仅记录）
     *
     * @param blockV4 V4 格式内容块
     * @param deckPath 牌组路径
     */
    skipBlockV4(blockV4: IRBlockV4, deckPath?: string): Promise<void>;
    /**
     * 更新优先级（带强制理由）
     *
     * @param blockV4 V4 格式内容块
     * @param newPriorityUi 新优先级 (0-10)
     * @param reason 变更理由
     * @returns 更新后的块
     */
    updatePriorityV4(blockV4: IRBlockV4, newPriorityUi: number, reason: string): Promise<IRBlockV4>;
    /**
     * 搁置内容块（暂停调度，可恢复）
     */
    suspendBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4>;
    /**
     * 恢复内容块
     */
    resumeBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4>;
    /**
     * 归档内容块（用户已完全理解，正面完成）
     */
    archiveBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4>;
    /**
     * @deprecated 使用 archiveBlockV4 代替
     */
    markBlockDoneV4(blockV4: IRBlockV4): Promise<IRBlockV4>;
    /**
     * 移除内容块（从队列永久移除，保留历史记录）
     */
    removeBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4>;
    /**
     * 删除内容块（彻底清除调度记录，可选删除 chunk 文件，不删除源文档）
     */
    deleteBlockV4(blockV4: IRBlockV4, deleteChunkFile?: boolean): Promise<void>;
    /**
     * 强制恢复内容块（从 done/removed 状态重新激活）
     */
    forceReactivateBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4>;
    /**
     * 记录会话历史
     */
    private recordSession;
    /**
     * V3 兼容：将 IRBlock 转换为 IRBlockV4 并完成
     */
    completeBlockFromV3(blockV3: IRBlock, data: ReadingCompletionDataV4, deckPath?: string): Promise<{
        block: IRBlock;
        nextRepDate: number;
        intervalDays: number;
    }>;
    /**
     * V3 兼容：将 IRBlock 转换为 IRBlockV4 并跳过
     */
    skipBlockFromV3(blockV3: IRBlock, deckPath?: string): Promise<void>;
    /**
     * 获取存储适配器（供外部使用）
     */
    getStorageAdapter(): IRStorageAdapterV4;
    /**
     * 获取标签组服务（供外部使用）
     */
    getTagGroupService(): IRTagGroupService;
}
