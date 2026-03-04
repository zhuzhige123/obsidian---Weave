/**
 * 增量阅读调度服务外观 v3.0
 *
 * 统一入口，整合以下组件：
 * - IRSchedulerV3: 核心调度算法
 * - IRTagGroupService: 标签组管理
 * - IRQueueGenerator: 队列生成
 * - IRStorageService: 数据存储
 *
 * v5.0 扩展：
 * - IRChunkScheduleAdapter: 文件化块调度适配器（新方案）
 * - 支持从 chunks.json 获取调度数据
 * - 旧的 blocks.json 方法标记为废弃
 *
 * @module services/incremental-reading/IRSchedulingFacade
 * @version 3.0.0 (v5.0 扩展)
 */
import type { App } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import { IRSchedulerV3, type ReadingCompletionData } from './IRSchedulerV3';
import { IRTagGroupService } from './IRTagGroupService';
import { IRQueueGenerator, type QueueGenerationResult } from './IRQueueGenerator';
import { IRChunkScheduleAdapter } from './IRChunkScheduleAdapter';
import type { IRChunkFileData } from '../../types/ir-types';
import type { IRBlock, IRScheduleStrategy, IRAdvancedScheduleSettings, IRTagGroup, IRTagGroupProfile } from '../../types/ir-types';
/**
 * 调度服务配置
 */
export interface IRSchedulingFacadeConfig {
    strategy?: 'processing' | 'reading-list';
    advancedSettings?: Partial<IRAdvancedScheduleSettings>;
    /** 🔧 优化：可选传入已初始化的存储服务，避免重复创建 */
    storageService?: IRStorageService;
    /** v5.0+: 文件化块根目录（默认使用 DEFAULT_IR_IMPORT_FOLDER） */
    chunkRoot?: string;
}
/**
 * 学习队列结果（扩展）
 */
export interface StudyQueueResult extends QueueGenerationResult {
    deckId: string;
    strategy: IRScheduleStrategy;
    overloadInfo?: {
        isOverloaded: boolean;
        overloadRatio: number;
    };
}
/**
 * 完成阅读的结果
 */
export interface CompleteBlockResult {
    block: IRBlock;
    groupProfile: IRTagGroupProfile;
    nextInQueue: IRBlock | null;
}
export declare class IRSchedulingFacade {
    private app;
    private storage;
    private scheduler;
    private queueGenerator;
    private tagGroupService;
    private chunkAdapter?;
    private chunkRoot;
    private strategy;
    private advancedSettings;
    private initialized;
    constructor(app: App, config?: IRSchedulingFacadeConfig);
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    /**
     * 获取文件化块调度适配器（延迟初始化）
     */
    getChunkAdapter(): IRChunkScheduleAdapter;
    /**
     * 获取文件化块学习队列
     * v5.0 新方案：从 chunks.json 获取调度数据
     */
    getChunkStudyQueue(): Promise<IRChunkFileData[]>;
    /**
     * 标记文件化块为完成
     */
    markChunkComplete(chunkId: string): Promise<void>;
    /**
     * 同步所有块文件的 YAML 状态到调度数据
     */
    syncChunksFromYAML(): Promise<number>;
    /**
     * 切换调度策略
     */
    setStrategy(strategyType: 'processing' | 'reading-list'): void;
    /**
     * 获取当前策略
     */
    getStrategy(): IRScheduleStrategy;
    /**
     * 更新高级设置
     */
    updateAdvancedSettings(settings: Partial<IRAdvancedScheduleSettings>): void;
    /**
     * 获取高级设置
     */
    getAdvancedSettings(): IRAdvancedScheduleSettings;
    /**
     * 获取学习队列（主入口）
     *
     * @param deckId 牌组 ID
     * @returns 学习队列结果
     */
    getStudyQueue(deckId: string): Promise<StudyQueueResult>;
    /**
     * 完成内容块阅读
     *
     * @param block 内容块
     * @param data 阅读完成数据
     * @param deckId 牌组 ID
     * @returns 完成结果
     */
    completeBlock(block: IRBlock, data: ReadingCompletionData, deckId?: string): Promise<CompleteBlockResult>;
    /**
     * 更新内容块优先级
     */
    updatePriority(block: IRBlock, priorityUi: number): Promise<IRBlock>;
    /**
     * 暂停内容块
     */
    suspendBlock(block: IRBlock, deckId?: string): Promise<IRBlock>;
    /**
     * 恢复内容块
     */
    unsuspendBlock(block: IRBlock): Promise<IRBlock>;
    /**
     * 跳过内容块
     */
    skipBlock(block: IRBlock, deckId?: string): Promise<void>;
    /**
     * 批量后推
     */
    postponeBlocks(blocks: IRBlock[], days: number): Promise<IRBlock[]>;
    /**
     * 按组后推
     */
    postponeByGroup(deckId: string, groupId: string, days: number): Promise<IRBlock[]>;
    /**
     * 按优先级后推
     */
    postponeByPriority(deckId: string, maxPriority: number, days: number): Promise<IRBlock[]>;
    /**
     * 获取所有标签组
     */
    getAllTagGroups(): Promise<IRTagGroup[]>;
    /**
     * 创建标签组
     */
    createTagGroup(name: string, matchAnyTags: string[], description?: string): Promise<IRTagGroup>;
    /**
     * 删除标签组
     */
    deleteTagGroup(id: string): Promise<void>;
    /**
     * 获取标签组统计
     */
    getTagGroupStats(): Promise<Array<{
        group: IRTagGroup;
        profile: IRTagGroupProfile;
        documentCount: number;
    }>>;
    /**
     * 获取调度统计
     */
    getScheduleStats(deckId: string): Promise<{
        newCount: number;
        learningCount: number;
        reviewCount: number;
        suspendedCount: number;
        dueToday: number;
        overdue: number;
        upcoming7Days: number;
        reachedDailyLimit: number;
    }>;
    /**
     * 获取过载信息
     */
    getOverloadInfo(deckId: string): Promise<{
        isOverloaded: boolean;
        dueCount: number;
        budgetCount: number;
        overloadRatio: number;
        groupOverload: Record<string, {
            due: number;
            ratio: number;
        }>;
    }>;
    /**
     * 获取存储服务（高级用途）
     */
    getStorage(): IRStorageService;
    /**
     * 获取调度器（高级用途）
     */
    getScheduler(): IRSchedulerV3;
    /**
     * 获取标签组服务（高级用途）
     */
    getTagGroupService(): IRTagGroupService;
    /**
     * 获取队列生成器（高级用途）
     */
    getQueueGenerator(): IRQueueGenerator;
}
/**
 * 工厂函数
 */
export declare function createIRSchedulingFacade(app: App, config?: IRSchedulingFacadeConfig): IRSchedulingFacade;
