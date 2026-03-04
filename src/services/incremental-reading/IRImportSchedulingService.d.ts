/**
 * 增量阅读导入时间分散调度服务
 *
 * 基于负载率的智能分配算法实现
 *
 * @module services/incremental-reading/IRImportSchedulingService
 * @version 1.0.0
 */
import type { SchedulingConfig, SchedulingImpact } from '../../types/ir-import-scheduling';
import type { IRBlock } from '../../types/ir-types';
import type { ContentBlock } from '../../types/content-split-types';
export interface IRLoadInfo {
    /** 每日时间预算（分钟） */
    dailyBudgetMinutes: number;
    /** 获取指定日期的已有块 */
    getBlocksForDate: (date: Date) => IRBlock[] | Promise<IRBlock[]>;
    /** 预估块的阅读时间（分钟） */
    estimateBlockMinutes: (block: IRBlock | ContentBlock) => number;
}
export declare class IRImportSchedulingService {
    private loadInfo;
    constructor(loadInfo: IRLoadInfo);
    /**
     * 计算导入分散计划
     */
    calculateScheduling(contentBlocks: ContentBlock[], config: SchedulingConfig, startDate?: Date): Promise<SchedulingImpact>;
    /**
     * 初始化每日负载数据
     */
    private initializeDailyLoads;
    /**
     * 均分策略：完全平均分布，不看已有负载
     */
    private distributeEvenly;
    /**
     * 均衡策略：基于负载率的水位填充算法（推荐默认）
     */
    private distributeBalanced;
    /**
     * 尽快读策略：在不爆载前提下尽量靠前
     */
    private distributeFrontLoaded;
    /**
     * 确保每天至少有1个内容块
     */
    private ensureDailyMinimum;
    /**
     * 更新负载率
     */
    private updateLoadRate;
    /**
     * 计算分散影响评估
     */
    private calculateImpact;
    /**
     * 应用分散计划到内容块
     */
    applyScheduling(contentBlocks: ContentBlock[], impact: SchedulingImpact): Map<ContentBlock, Date>;
}
