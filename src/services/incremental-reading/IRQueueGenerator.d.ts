/**
 * 增量阅读队列生成器 v3.0
 *
 * 职责：
 * - Deficit Round Robin 公平分配（避免某组霸屏）
 * - 预算控制（时间/数量）
 * - Aging 防沉底机制
 * - 过载治理（自动后推）
 *
 * 设计原则：
 * - 稳定性优先：所有参数有界
 * - 公平性：按组轮转，避免某类材料霸占队列
 * - 可解释性：每个选择都有明确理由
 *
 * @module services/incremental-reading/IRQueueGenerator
 * @version 3.0.0
 */
import type { IRBlock, IRScheduleStrategy, IRAdvancedScheduleSettings } from '../../types/ir-types';
/**
 * 队列项（带元数据）
 */
export interface QueueItem {
    block: IRBlock;
    groupId: string;
    estimatedMinutes: number;
    overdueDays: number;
    agingBonus: number;
    score: number;
}
/**
 * 队列生成结果
 */
export interface QueueGenerationResult {
    queue: IRBlock[];
    stats: {
        totalDue: number;
        scheduled: number;
        postponed: number;
        reachedDailyLimit: number;
        totalEstimatedMinutes: number;
        groupDistribution: Record<string, number>;
    };
}
/**
 * 后推结果
 */
export interface PostponeResult {
    postponedCount: number;
    postponedBlocks: IRBlock[];
}
/**
 * 计算 aging 加分
 * 长期未展示的到期项获得额外排序权重
 *
 * @param overdueDays 过期天数
 * @param strength aging 强度
 * @returns aging 加分 (0 ~ maxBonus)
 */
export declare function calculateAgingBonus(overdueDays: number, strength?: 'low' | 'medium' | 'high'): number;
/**
 * 计算队列项的综合得分
 *
 * @param item 队列项
 * @returns 综合得分（越高越优先）
 */
export declare function calculateItemScore(item: QueueItem): number;
/**
 * 计算过期天数
 */
export declare function calculateOverdueDays(block: IRBlock): number;
export declare class IRQueueGenerator {
    private strategy;
    private advancedSettings;
    constructor(strategy?: IRScheduleStrategy, advancedSettings?: IRAdvancedScheduleSettings);
    /**
     * 更新策略
     */
    setStrategy(strategy: IRScheduleStrategy): void;
    /**
     * 更新高级设置
     */
    setAdvancedSettings(settings: IRAdvancedScheduleSettings): void;
    /**
     * 生成学习队列（主入口）
     *
     * @param blocks 所有内容块
     * @param groupMapping 文档到组的映射 (filePath -> groupId)
     * @returns 队列生成结果
     */
    generateQueue(blocks: IRBlock[], groupMapping: Record<string, string>): QueueGenerationResult;
    /**
     * 过滤到期内容块
     */
    private filterDueBlocks;
    /**
     * 按标签组分桶
     */
    private groupByTagGroup;
    /**
     * Deficit Round Robin 公平分配
     *
     * 原理：
     * - 每轮给每个组增加 quantum（默认 1）
     * - 从 deficit 最大的组取下一项
     * - 取走后 deficit 减去该项成本
     */
    private deficitRoundRobin;
    /**
     * 应用预算控制
     */
    private applyBudgetControl;
    /**
     * 自动后推低优先级到期项
     *
     * @param blocks 到期内容块
     * @returns 后推结果和更新后的块
     */
    autoPostpone(blocks: IRBlock[]): PostponeResult;
    /**
     * 手动批量后推
     *
     * @param blocks 要后推的内容块
     * @param days 后推天数
     * @returns 更新后的块
     */
    manualPostpone(blocks: IRBlock[], days: number): IRBlock[];
    /**
     * 按组后推
     *
     * @param blocks 所有到期块
     * @param groupId 要后推的组 ID
     * @param groupMapping 文档到组的映射
     * @param days 后推天数
     * @returns 更新后的块
     */
    postponeByGroup(blocks: IRBlock[], groupId: string, groupMapping: Record<string, string>, days: number): IRBlock[];
    /**
     * 按优先级阈值后推
     *
     * @param blocks 所有到期块
     * @param maxPriority 最大优先级阈值（低于等于此值的后推）
     * @param days 后推天数
     * @returns 更新后的块
     */
    postponeByPriority(blocks: IRBlock[], maxPriority: number, days: number): IRBlock[];
    /**
     * 获取过载统计
     */
    getOverloadStats(blocks: IRBlock[], groupMapping: Record<string, string>): {
        isOverloaded: boolean;
        dueCount: number;
        budgetCount: number;
        overloadRatio: number;
        groupOverload: Record<string, {
            due: number;
            ratio: number;
        }>;
    };
}
