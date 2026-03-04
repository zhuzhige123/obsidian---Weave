/**
 * 增量阅读交错调度服务
 *
 * 基于认知科学的交错学习策略：
 * - Session内聚类：允许相关内容出现，建立知识连接
 * - 跨Session交错：强制不同主题交替，强化区分性处理
 *
 * 设计依据：
 * - 交错效应 (Rohrer & Taylor, 2007): 交错练习比分块练习效果好63%
 * - 区分性处理 (Discriminative Processing): 强迫大脑进行主动区分
 * - 知识建构平衡: 避免完全随机打断知识建构过程
 *
 * @module services/incremental-reading/IRInterleaveScheduler
 * @version 1.0.0
 */
import type { IRBlock } from '../../types/ir-types';
/**
 * 交错策略
 */
export declare enum InterleaveStrategy {
    /** 聚类：相关内容一起学习 */
    CLUSTER = "cluster",
    /** 交错：相关内容分开学习 */
    INTERLEAVE = "interleave",
    /** 自适应：根据理解度动态调整 */
    ADAPTIVE = "adaptive"
}
/**
 * 交错配置
 */
export interface InterleaveConfig {
    /** Session内策略 */
    withinSessionStrategy: InterleaveStrategy;
    /** 跨Session策略 */
    acrossSessionStrategy: InterleaveStrategy;
    /** 同标签/主题内容的最小间隔（队列中的位置间隔） */
    sameTopicMinGap: number;
    /** 同文件内容的最小间隔 */
    sameFileMinGap: number;
    /** 聚类大小（CLUSTER策略下，同主题连续出现的最大数量） */
    clusterSize: number;
    /** Fuzz随机化范围 (0-1)，用于打乱相同优先级的顺序 */
    fuzzRange: number;
    /** 是否启用Fuzz随机化 */
    enableFuzz: boolean;
}
/**
 * 默认交错配置
 */
export declare const DEFAULT_INTERLEAVE_CONFIG: InterleaveConfig;
export declare class IRInterleaveScheduler {
    private config;
    constructor(config?: Partial<InterleaveConfig>);
    /**
     * 应用交错策略重排队列
     *
     * @param blocks 已排序的块队列（按优先级、过期天数等）
     * @param isNewSession 是否是新Session（影响策略选择）
     * @returns 重排后的队列
     */
    applyInterleaving(blocks: IRBlock[], isNewSession?: boolean): IRBlock[];
    /**
     * 聚类策略：同主题内容连续出现，但限制数量
     */
    private applyClustering;
    /**
     * 严格交错策略：确保相邻块来自不同主题/文件
     */
    private applyStrictInterleaving;
    /**
     * 按文件交错（当只有一个主题时的备选方案）
     */
    private interleaveByFile;
    /**
     * 自适应策略：根据理解度历史动态调整
     * - 理解度低的内容 → 聚类（加强巩固）
     * - 理解度高的内容 → 交错（挑战区分）
     */
    private applyAdaptiveInterleaving;
    /**
     * 应用Fuzz随机化
     * 目的：防止相同优先级的内容总是以固定顺序出现
     */
    private applyFuzz;
    /**
     * 按主题分组（使用标签作为主题标识）
     */
    private groupByTopic;
    /**
     * 检查两个块是否应该分开（满足最小间隔要求）
     */
    shouldSeparate(blockA: IRBlock, blockB: IRBlock): boolean;
    /**
     * 获取配置
     */
    getConfig(): InterleaveConfig;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<InterleaveConfig>): void;
}
/**
 * 创建交错调度器实例
 */
export declare function createInterleaveScheduler(config?: Partial<InterleaveConfig>): IRInterleaveScheduler;
