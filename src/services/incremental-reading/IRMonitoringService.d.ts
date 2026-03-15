/**
 * IRMonitoringService - 增量阅读监控统计服务 v3.0
 *
 * 职责：
 * - 每日统计：dueCount / scheduledCount / postponedCount
 * - TagGroup 展示占比统计
 * - 个体优先级变化追踪
 * - 组参数变化监控
 *
 * @module services/incremental-reading/IRMonitoringService
 */
import type { IRBlock, IRTagGroupProfile } from '../../types/ir-types';
/**
 * 每日统计数据
 */
export interface DailyStats {
    /** 统计日期 YYYY-MM-DD */
    date: string;
    /** 到期数量 */
    dueCount: number;
    /** 已安排数量 */
    scheduledCount: number;
    /** 已后推数量 */
    postponedCount: number;
    /** 预估总时长（分钟） */
    totalEstimatedMinutes: number;
    /** 实际阅读时长（秒） */
    totalActualReadingSeconds: number;
    /** 各 TagGroup 展示次数 */
    tagGroupAppearances: Record<string, number>;
    /** 新增块数 */
    newBlocksCount: number;
    /** 完成块数（理解度≥3） */
    completedBlocksCount: number;
}
/**
 * 优先级变更记录
 */
export interface PriorityChangeRecord {
    /** 块 ID */
    blockId: string;
    /** 变更时间 */
    timestamp: string;
    /** 旧的用户优先级 */
    oldPriorityUi: number;
    /** 新的用户优先级 */
    newPriorityUi: number;
    /** 旧的有效优先级 */
    oldPriorityEff: number;
    /** 新的有效优先级 */
    newPriorityEff: number;
}
/**
 * 组参数变更记录
 */
export interface GroupParamChangeRecord {
    /** 组 ID */
    groupId: string;
    /** 变更时间 */
    timestamp: string;
    /** 旧的间隔因子 */
    oldIntervalFactor: number;
    /** 新的间隔因子 */
    newIntervalFactor: number;
    /** 样本数量 */
    sampleCount: number;
}
/**
 * TagGroup 统计摘要
 */
export interface TagGroupSummary {
    /** 组 ID */
    groupId: string;
    /** 组名称 */
    groupName: string;
    /** 块数量 */
    blockCount: number;
    /** 到期数量 */
    dueCount: number;
    /** 展示占比 (0-1) */
    appearanceRatio: number;
    /** 当前间隔因子 */
    intervalFactorBase: number;
    /** 平均优先级 */
    avgPriority: number;
}
/**
 * 监控数据存储结构
 */
export interface IRMonitoringData {
    /** 版本号 */
    version: string;
    /** 每日统计记录（最近 30 天） */
    dailyStats: DailyStats[];
    /** 优先级变更记录（最近 100 条） */
    priorityChanges: PriorityChangeRecord[];
    /** 组参数变更记录（最近 100 条） */
    groupParamChanges: GroupParamChangeRecord[];
    /** 最后更新时间 */
    lastUpdated: string;
}
/**
 * 增量阅读监控服务
 */
export declare class IRMonitoringService {
    private data;
    private readonly storagePath;
    private vault;
    constructor(vault: any, basePath?: string);
    /**
     * 加载监控数据
     */
    load(): Promise<void>;
    /**
     * 保存监控数据
     */
    save(): Promise<void>;
    /**
     * 清理过期数据
     */
    private cleanupOldData;
    /**
     * 获取或创建今日统计
     */
    getTodayStats(): DailyStats;
    /**
     * 记录到期数量
     */
    recordDueCount(count: number): void;
    /**
     * 记录已安排数量
     */
    recordScheduledCount(count: number): void;
    /**
     * 记录后推数量
     */
    recordPostponedCount(count: number): void;
    /**
     * 记录预估时长
     */
    recordEstimatedMinutes(minutes: number): void;
    /**
     * 累加实际阅读时长
     */
    addActualReadingTime(seconds: number): void;
    /**
     * 记录 TagGroup 出现
     */
    recordTagGroupAppearance(groupId: string): void;
    /**
     * 记录新增块
     */
    recordNewBlock(): void;
    /**
     * 记录完成块
     */
    recordCompletedBlock(): void;
    /**
     * 记录优先级变更
     */
    recordPriorityChange(blockId: string, oldPriorityUi: number, newPriorityUi: number, oldPriorityEff: number, newPriorityEff: number): void;
    /**
     * 获取块的优先级变更历史
     */
    getPriorityHistory(blockId: string): PriorityChangeRecord[];
    /**
     * 记录组参数变更
     */
    recordGroupParamChange(groupId: string, oldIntervalFactor: number, newIntervalFactor: number, sampleCount: number): void;
    /**
     * 获取组的参数变更历史
     */
    getGroupParamHistory(groupId: string): GroupParamChangeRecord[];
    /**
     * 获取最近 N 天的统计
     */
    getRecentStats(days?: number): DailyStats[];
    /**
     * 计算 TagGroup 展示占比
     */
    calculateTagGroupRatios(blocks: IRBlock[], profiles: Map<string, IRTagGroupProfile>): TagGroupSummary[];
    /**
     * 获取汇总报告
     */
    getSummaryReport(): {
        today: DailyStats | null;
        weeklyAvg: {
            dueCount: number;
            scheduledCount: number;
            completedCount: number;
            readingMinutes: number;
        };
        trends: {
            dueCountTrend: number;
            completionRateTrend: number;
        };
    };
    /**
     * 导出所有监控数据
     */
    exportData(): IRMonitoringData;
    /**
     * 重置监控数据
     */
    reset(): void;
}
/**
 * 创建监控服务实例
 */
export declare function createIRMonitoringService(vault: any, basePath?: string): IRMonitoringService;
