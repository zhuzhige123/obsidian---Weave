/**
 * 增量阅读调度服务 v3.0
 *
 * 基于连续优先级轴 + 隐式反馈的新调度算法：
 * - 使用 EWMA 平滑优先级，避免抖动
 * - 双时间尺度：会话内分钟级 + 跨日小时/天级
 * - 防刷屏机制：同块每日出现上限
 * - TagGroup 类型先验：材料类型影响间隔增长因子
 *
 * 核心设计原则：
 * - 稳定性优先：有界权重 + 慢学习 + 小样本收缩
 * - 过载治理为 P0：预算控制 + 公平分配
 * - 增量阅读 ≠ FSRS：以优先级队列 + 效用驱动
 *
 * @module services/incremental-reading/IRSchedulerV3
 * @version 3.0.0
 */
import type { App } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import type { IRBlock, IRScheduleStrategy, IRAdvancedScheduleSettings, IRTagGroupProfile } from '../../types/ir-types';
/** 默认调度配置 */
export declare const DEFAULT_SCHEDULE_CONFIG_V3: {
    /** 初始间隔（天）- 加工流默认 0.25 = 6小时 */
    initialIntervalDays: number;
    /** 达到 review 状态的阈值（天） */
    reviewThresholdDays: number;
    /** 最大间隔（天） */
    maxIntervalDays: number;
    /** 全局基线 intervalFactor */
    globalIntervalFactorBase: number;
};
/**
 * 计算 time-aware EWMA
 *
 * @param priorityUi 本次滑条值 (0-10)
 * @param priorityEffOld 旧有效优先级 (0-10)
 * @param lastUpdatedAt 上次更新时间 (ISO字符串)
 * @param halfLifeDays 半衰期（天），默认 7
 * @returns 新的有效优先级 (0-10)
 */
export declare function calculatePriorityEWMA(priorityUi: number, priorityEffOld: number, lastUpdatedAt: string | null, halfLifeDays?: number): number;
/**
 * 计算优先级倍率 Pm
 * 越重要（高优先级）间隔越短
 *
 * @param priorityEff 有效优先级 (0-10)
 * @returns 优先级倍率 (0.6-1.6)
 */
export declare function calculatePriorityMultiplier(priorityEff: number): number;
/**
 * 计算隐式负载/产出信号 L
 *
 * @param readingTimeSeconds 阅读时长（秒）
 * @param createdCardCount 本次创建卡片数
 * @param createdExtractCount 本次创建摘录数
 * @param createdNoteCount 本次创建笔记数
 * @returns 负载信号 L (0-1)
 */
export declare function calculateLoadSignal(readingTimeSeconds: number, createdCardCount?: number, createdExtractCount?: number, createdNoteCount?: number): number;
/**
 * 计算下次复习间隔
 *
 * @param currentIntervalDays 当前间隔（天）
 * @param intervalFactor 间隔增长因子
 * @param priorityEff 有效优先级 (0-10)
 * @param strategy 调度策略
 * @param config 调度配置
 * @returns 下次间隔（天）
 */
export declare function calculateNextInterval(currentIntervalDays: number, intervalFactor: number, priorityEff: number, strategy: IRScheduleStrategy, config?: typeof DEFAULT_SCHEDULE_CONFIG_V3): number;
/**
 * 计算下次复习时间
 *
 * @param intervalDays 间隔（天）
 * @returns ISO 字符串
 */
export declare function calculateNextReviewDate(intervalDays: number): string;
/**
 * 检查是否达到每日出现上限
 *
 * @param block 内容块
 * @param maxAppearances 每日上限
 * @returns 是否达到上限
 */
export declare function hasReachedDailyLimit(block: IRBlock, maxAppearances: number): boolean;
/**
 * 增加每日出现计数
 *
 * @param block 内容块
 * @returns 更新后的 dailyAppearances
 */
export declare function incrementDailyAppearance(block: IRBlock): Record<string, number>;
/**
 * 估算内容块阅读时间（分钟）
 *
 * @param block 内容块
 * @returns 预估时间（分钟）
 */
export declare function estimateReadingTime(block: IRBlock): number;
/**
 * v3.0 调度器配置
 */
export interface IRSchedulerV3Config {
    strategy?: IRScheduleStrategy;
    advancedSettings?: IRAdvancedScheduleSettings;
    scheduleConfig?: typeof DEFAULT_SCHEDULE_CONFIG_V3;
}
/**
 * 阅读完成时的行为数据
 */
export interface ReadingCompletionData {
    rating?: number;
    readingTimeSeconds: number;
    priorityUi?: number;
    createdCardCount?: number;
    createdExtractCount?: number;
    createdNoteCount?: number;
}
/**
 * 增量阅读调度服务 v3.0
 */
export declare class IRSchedulerV3 {
    private storage;
    private strategy;
    private advancedSettings;
    private scheduleConfig;
    private app;
    constructor(storage: IRStorageService, config?: IRSchedulerV3Config, app?: App);
    /**
     * 切换调度策略
     */
    setStrategy(strategyType: 'processing' | 'reading-list'): void;
    /**
     * 更新高级设置
     */
    updateAdvancedSettings(settings: Partial<IRAdvancedScheduleSettings>): void;
    /**
     * 获取当前策略
     */
    getStrategy(): IRScheduleStrategy;
    /**
     * 更新内容块优先级（使用 EWMA）
     *
     * @param block 内容块
     * @param priorityUi 新的用户优先级 (0-10)
     * @returns 更新后的内容块
     */
    updatePriority(block: IRBlock, priorityUi: number): Promise<IRBlock>;
    /**
     * 完成内容块阅读后更新调度 (v3.0)
     *
     * @param block 内容块
     * @param data 阅读完成数据
     * @param deckId 牌组ID
     * @param groupProfile 标签组参数（可选）
     * @returns 更新后的内容块
     */
    completeBlock(block: IRBlock, data: ReadingCompletionData, deckId?: string, groupProfile?: IRTagGroupProfile): Promise<IRBlock>;
    /**
     * 暂停/忽略内容块
     */
    suspendBlock(block: IRBlock, deckId?: string): Promise<IRBlock>;
    /**
     * 恢复已暂停的内容块
     */
    unsuspendBlock(block: IRBlock): Promise<IRBlock>;
    /**
     * 跳过内容块（不更新调度，只记录）
     */
    skipBlock(block: IRBlock, deckId?: string): Promise<void>;
    /**
     * 获取今日到期的内容块（过滤后）
     *
     * @param deckId 牌组ID
     * @returns 过滤并排序后的到期内容块
     */
    getDueBlocks(deckId: string): Promise<IRBlock[]>;
    /**
     * 排序内容块
     *
     * 排序规则：
     * 1. 有效优先级 (priorityEff 高优先)
     * 2. 过期天数 (过期越久越优先)
     * 3. 状态 (learning > review > new)
     */
    private sortBlocks;
    /**
     * 计算过期天数
     */
    private getOverdueDays;
    /**
     * 生成学习队列（应用预算控制）
     *
     * @param deckId 牌组ID
     * @returns 学习队列
     */
    getStudyQueue(deckId: string): Promise<IRBlock[]>;
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
}
