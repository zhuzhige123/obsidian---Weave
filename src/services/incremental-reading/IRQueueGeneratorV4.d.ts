/**
 * 增量阅读队列生成器 v4.0
 *
 * 对齐《增量阅读-算法实施权威规范.md》Section 6
 *
 * 核心特性：
 * - DRR 时间赤字版（Section 6.3）
 * - 成本估计（Section 6.2）
 * - 尾部碎片处理（允许轻微超出）
 * - 候选块选择分数（Section 7）
 *
 * @module services/incremental-reading/IRQueueGeneratorV4
 * @version 4.0.0
 */
import type { IRBlockV4 } from '../../types/ir-types';
/**
 * 队列项（带元数据）
 */
export interface QueueItemV4 {
    block: IRBlockV4;
    groupId: string;
    estimatedCost: number;
    score: number;
}
/**
 * 队列生成结果
 */
export interface QueueGenerationResultV4 {
    /** 生成的队列 */
    queue: IRBlockV4[];
    /** 预估总时间（分钟） */
    totalEstimatedMinutes: number;
    /** 统计信息 */
    stats: {
        /** 候选池总数 */
        candidateCount: number;
        /** 实际入队数 */
        scheduledCount: number;
        /** 组分布 */
        groupDistribution: Record<string, number>;
        /** 是否超出预算 */
        overBudget: boolean;
        /** 超出比例 */
        overBudgetRatio: number;
    };
}
/**
 * 组权重配置
 */
export interface GroupWeights {
    [groupId: string]: number;
}
export declare class IRQueueGeneratorV4 {
    private defaultTimeBudget;
    private tailThreshold;
    private agingStrength;
    constructor(timeBudget?: number, agingStrength?: 'low' | 'medium' | 'high');
    /**
     * 设置时间预算
     */
    setTimeBudget(minutes: number): void;
    /**
     * 设置 aging 强度
     */
    setAgingStrength(strength: 'low' | 'medium' | 'high'): void;
    /**
     * 生成会话队列（主入口）
     *
     * @param candidatePool scheduled 状态的候选块
     * @param groupMapping 块ID到组ID的映射
     * @param groupWeights 组权重配置（可选，默认均分）
     * @param timeBudget 时间预算（分钟）
     * @param currentSourcePath 当前展示的源文件路径（用于切换惩罚）
     * @returns 队列生成结果
     */
    generateQueue(candidatePool: IRBlockV4[], groupMapping: Record<string, string>, groupWeights?: GroupWeights, timeBudget?: number, currentSourcePath?: string | null): QueueGenerationResultV4;
    /**
     * 构建队列项
     */
    private buildQueueItems;
    /**
     * 按标签组分桶
     */
    private groupByTagGroup;
    /**
     * DRR 时间赤字版（权威规范 Section 6.3）
     */
    private deficitRoundRobin;
    /**
     * 检查是否还有可用项
     */
    private hasAvailableItems;
    /**
     * 获取赤字最大的组
     */
    private getMaxDeficitGroup;
    /**
     * 在组内找一个更小的块
     */
    private findSmallerItem;
    /**
     * 返回空结果
     */
    private emptyResult;
    /**
     * 获取队列预览（不修改状态）
     */
    previewQueue(candidatePool: IRBlockV4[], groupMapping: Record<string, string>, timeBudget?: number): {
        blocks: IRBlockV4[];
        totalMinutes: number;
    };
    /**
     * 计算过载统计
     */
    getOverloadStats(candidatePool: IRBlockV4[], groupMapping: Record<string, string>, timeBudget?: number): {
        isOverloaded: boolean;
        totalCandidateCost: number;
        budgetMinutes: number;
        overloadRatio: number;
        groupOverload: Record<string, {
            count: number;
            cost: number;
            ratio: number;
        }>;
    };
}
/**
 * 导出工厂函数
 */
export declare function createQueueGenerator(timeBudget?: number): IRQueueGeneratorV4;
