/**
 * @deprecated v4.0 此文件已弃用，请使用 index-v4.ts 导出的 V4 调度系统
 *
 * 新系统使用：
 * - IRStateMachineV4: 6 状态机
 * - IRSessionControllerV4: 会话控制
 * - IRQueueGeneratorV4: 队列生成
 * - IRCoreAlgorithmsV4: 核心算法
 *
 * 此文件保留仅供参考，不应在新代码中使用
 *
 * @module services/incremental-reading/IRScheduler
 * @version 2.1.0 - DEPRECATED
 */
import type { App } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import type { IRBlock } from '../../types/ir-types';
import { IRLinkAnalyzer, type LinkAnalyzerConfig } from './IRLinkAnalyzer';
import { IRInterleaveScheduler, type InterleaveConfig } from './IRInterleaveScheduler';
/** 理解度评分 (v2.0) */
export type IRRating = 1 | 2 | 3 | 4;
/** 调度配置 */
export interface IRScheduleConfig {
    /** 初始间隔（天）- 首次完成后 */
    initialInterval: number;
    /** 间隔增长因子 */
    intervalFactor: number;
    /** 进入复习状态的最小间隔（天） */
    reviewThreshold: number;
    /** 最大间隔（天） */
    maxInterval: number;
}
/** 默认调度配置 */
export declare const DEFAULT_SCHEDULE_CONFIG: IRScheduleConfig;
/**
 * v2.1 扩展配置
 */
export interface IRSchedulerOptions {
    /** 调度配置 */
    scheduleConfig?: Partial<IRScheduleConfig>;
    /** 链接分析配置 */
    linkAnalyzerConfig?: Partial<LinkAnalyzerConfig>;
    /** 交错调度配置 */
    interleaveConfig?: Partial<InterleaveConfig>;
    /** 是否启用链接分析 */
    enableLinkAnalysis?: boolean;
    /** 是否启用交错调度 */
    enableInterleaving?: boolean;
}
export declare class IRScheduler {
    private storage;
    private config;
    /** v2.1: 链接分析器 */
    private linkAnalyzer;
    /** v2.1: 交错调度器 */
    private interleaveScheduler;
    /** v2.1: 功能开关 */
    private enableLinkAnalysis;
    private enableInterleaving;
    constructor(storage: IRStorageService, config?: Partial<IRScheduleConfig>, app?: App, options?: IRSchedulerOptions);
    /**
     * v2.1: 延迟初始化链接分析器（用于不在构造函数中传入app的情况）
     */
    initLinkAnalyzer(app: App, config?: Partial<LinkAnalyzerConfig>): void;
    /**
     * 完成内容块阅读后更新调度 (v2.0: 支持理解度评分)
     * @param block 内容块
     * @param rating 理解度评分 1-4
     * @param readingTime 阅读时长(秒)
     * @param deckId 牌组ID
     */
    completeBlock(block: IRBlock, rating?: IRRating, readingTime?: number, deckId?: string): Promise<IRBlock>;
    /**
     * 跳过内容块（不更新调度，只记录）(v2.0: 新接口)
     */
    skipBlock(block: IRBlock, deckId?: string): Promise<void>;
    /**
     * 暂停/忽略内容块 (v2.0 新增)
     */
    suspendBlock(block: IRBlock, deckId?: string): Promise<IRBlock>;
    /**
     * 恢复已暂停的内容块 (v2.0 新增)
     */
    unsuspendBlock(block: IRBlock): Promise<IRBlock>;
    /**
     * 重置内容块调度（重新学习）
     */
    resetBlock(block: IRBlock): Promise<IRBlock>;
    /**
     * 调整内容块优先级
     */
    adjustPriority(block: IRBlock, newPriority: number): Promise<IRBlock>;
    /**
     * 获取今日到期的内容块（排序后）
     */
    getTodayDueBlocks(): Promise<IRBlock[]>;
    /**
     * 获取牌组今日到期的内容块
     */
    getDeckDueBlocks(deckPath: string): Promise<IRBlock[]>;
    /**
     * 排序内容块 (v2.0: 支持suspended状态)
     * 1. 优先级（低值优先，v2.0: 1=高, 2=中, 3=低）
     * 2. 过期天数（过期越久越优先）
     * 3. 状态（learning > review > new, suspended排最后）
     */
    private sortBlocks;
    /**
     * 获取智能学习队列 (v2.5: 移除每日限制，增量阅读无认知负荷瓶颈)
     * 过滤suspended，智能排序，应用交错策略
     *
     * 设计理念：与记忆牌组不同，增量阅读属于"语义编码"过程，
     * 主要依赖前额叶理解网络，不存在海马体的记忆巩固瓶颈，
     * 因此不应限制每日学习数量。
     *
     * @param deckId 牌组ID
     * @param _dailyNewLimit 已废弃，保留参数兼容性
     * @param _dailyReviewLimit 已废弃，保留参数兼容性
     * @param applyInterleaving 是否应用交错策略（默认true）
     */
    getStudyQueue(deckId: string, _dailyNewLimit?: number, _dailyReviewLimit?: number, applyInterleaving?: boolean): Promise<IRBlock[]>;
    /**
     * v2.1: 根据内容分析动态调整块的intervalFactor
     *
     * @param block 内容块
     * @param content 内容文本
     * @returns 调整后的intervalFactor
     */
    analyzeAndAdjustAFactor(block: IRBlock, content: string): Promise<number>;
    /**
     * v2.1: 完成阅读并应用链接分析调整
     *
     * @param block 内容块
     * @param rating 理解度评分
     * @param content 内容文本（用于链接分析）
     * @param readingTime 阅读时长
     * @param deckId 牌组ID
     */
    completeBlockWithAnalysis(block: IRBlock, rating: IRRating | undefined, content: string, readingTime?: number, deckId?: string): Promise<IRBlock>;
    /**
     * v2.1: 获取链接分析器（供外部使用）
     */
    getLinkAnalyzer(): IRLinkAnalyzer | null;
    /**
     * v2.1: 获取交错调度器（供外部使用）
     */
    getInterleaveScheduler(): IRInterleaveScheduler | null;
    /**
     * v2.1: 更新交错调度配置
     */
    updateInterleaveConfig(config: Partial<InterleaveConfig>): void;
    /**
     * v2.1: 更新链接分析配置
     */
    updateLinkAnalyzerConfig(config: Partial<LinkAnalyzerConfig>): void;
    /**
     * 计算过期天数
     */
    private getOverdueDays;
    /**
     * 获取调度统计
     */
    getScheduleStats(deckPath: string): Promise<{
        newCount: number;
        learningCount: number;
        reviewCount: number;
        dueToday: number;
        overdue: number;
        upcoming7Days: number;
    }>;
    /**
     * 预测未来复习负载
     */
    forecastLoad(deckPath: string, days?: number): Promise<Record<string, number>>;
}
