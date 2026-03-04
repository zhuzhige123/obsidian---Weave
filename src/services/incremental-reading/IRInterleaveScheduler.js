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
import { logger } from '../../utils/logger';
// ============================================
// 类型定义
// ============================================
/**
 * 交错策略
 */
export var InterleaveStrategy;
(function (InterleaveStrategy) {
    /** 聚类：相关内容一起学习 */
    InterleaveStrategy["CLUSTER"] = "cluster";
    /** 交错：相关内容分开学习 */
    InterleaveStrategy["INTERLEAVE"] = "interleave";
    /** 自适应：根据理解度动态调整 */
    InterleaveStrategy["ADAPTIVE"] = "adaptive";
})(InterleaveStrategy || (InterleaveStrategy = {}));
/**
 * 默认交错配置
 */
export const DEFAULT_INTERLEAVE_CONFIG = {
    withinSessionStrategy: InterleaveStrategy.CLUSTER,
    acrossSessionStrategy: InterleaveStrategy.INTERLEAVE,
    sameTopicMinGap: 3,
    sameFileMinGap: 2,
    clusterSize: 3,
    fuzzRange: 0.1,
    enableFuzz: true
};
// ============================================
// 交错调度器
// ============================================
export class IRInterleaveScheduler {
    config;
    constructor(config) {
        this.config = { ...DEFAULT_INTERLEAVE_CONFIG, ...config };
    }
    // ============================================
    // 核心调度方法
    // ============================================
    /**
     * 应用交错策略重排队列
     *
     * @param blocks 已排序的块队列（按优先级、过期天数等）
     * @param isNewSession 是否是新Session（影响策略选择）
     * @returns 重排后的队列
     */
    applyInterleaving(blocks, isNewSession = true) {
        if (blocks.length <= 1) {
            return blocks;
        }
        const strategy = isNewSession
            ? this.config.withinSessionStrategy
            : this.config.acrossSessionStrategy;
        let result;
        switch (strategy) {
            case InterleaveStrategy.CLUSTER:
                result = this.applyClustering(blocks);
                break;
            case InterleaveStrategy.INTERLEAVE:
                result = this.applyStrictInterleaving(blocks);
                break;
            case InterleaveStrategy.ADAPTIVE:
                result = this.applyAdaptiveInterleaving(blocks);
                break;
            default:
                result = blocks;
        }
        // 应用Fuzz随机化
        if (this.config.enableFuzz) {
            result = this.applyFuzz(result);
        }
        logger.debug(`[IRInterleaveScheduler] 应用${strategy}策略, ` +
            `输入${blocks.length}块, 输出${result.length}块`);
        return result;
    }
    // ============================================
    // 聚类策略
    // ============================================
    /**
     * 聚类策略：同主题内容连续出现，但限制数量
     */
    applyClustering(blocks) {
        // 按标签分组
        const groups = this.groupByTopic(blocks);
        const result = [];
        const { clusterSize } = this.config;
        // 轮询每个组，每次取clusterSize个
        let hasMore = true;
        const groupIndices = new Map();
        // 初始化每组的索引
        for (const group of groups) {
            groupIndices.set(group.key, 0);
        }
        while (hasMore) {
            hasMore = false;
            for (const group of groups) {
                const startIdx = groupIndices.get(group.key);
                const endIdx = Math.min(startIdx + clusterSize, group.blocks.length);
                if (startIdx < group.blocks.length) {
                    hasMore = true;
                    for (let i = startIdx; i < endIdx; i++) {
                        result.push(group.blocks[i]);
                    }
                    groupIndices.set(group.key, endIdx);
                }
            }
        }
        return result;
    }
    // ============================================
    // 严格交错策略
    // ============================================
    /**
     * 严格交错策略：确保相邻块来自不同主题/文件
     */
    applyStrictInterleaving(blocks) {
        const groups = this.groupByTopic(blocks);
        if (groups.length <= 1) {
            // 只有一个主题，尝试按文件交错
            return this.interleaveByFile(blocks);
        }
        const result = [];
        const groupIndices = new Map();
        // 初始化
        for (const group of groups) {
            groupIndices.set(group.key, 0);
        }
        // 按优先级排序组（取每组第一个块的优先级）
        const sortedGroups = [...groups].sort((a, b) => {
            const aPriority = a.blocks[0]?.priority || 3;
            const bPriority = b.blocks[0]?.priority || 3;
            return aPriority - bPriority;
        });
        let lastGroupKey = '';
        let attempts = 0;
        const maxAttempts = blocks.length * 2;
        while (result.length < blocks.length && attempts < maxAttempts) {
            attempts++;
            // 找一个与上一个不同的组
            let selectedGroup = null;
            for (const group of sortedGroups) {
                const idx = groupIndices.get(group.key);
                if (idx < group.blocks.length && group.key !== lastGroupKey) {
                    selectedGroup = group;
                    break;
                }
            }
            // 如果找不到不同的组，退而求其次选任意有剩余的组
            if (!selectedGroup) {
                for (const group of sortedGroups) {
                    const idx = groupIndices.get(group.key);
                    if (idx < group.blocks.length) {
                        selectedGroup = group;
                        break;
                    }
                }
            }
            if (selectedGroup) {
                const idx = groupIndices.get(selectedGroup.key);
                result.push(selectedGroup.blocks[idx]);
                groupIndices.set(selectedGroup.key, idx + 1);
                lastGroupKey = selectedGroup.key;
            }
        }
        return result;
    }
    /**
     * 按文件交错（当只有一个主题时的备选方案）
     */
    interleaveByFile(blocks) {
        const fileGroups = new Map();
        for (const block of blocks) {
            const filePath = block.filePath;
            if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, []);
            }
            fileGroups.get(filePath).push(block);
        }
        // 转换为数组并交错
        const groups = Array.from(fileGroups.entries()).map(([key, blocks]) => ({ key, blocks }));
        if (groups.length <= 1) {
            return blocks; // 只有一个文件，无法交错
        }
        // 简单轮询交错
        const result = [];
        const indices = new Map();
        for (const group of groups) {
            indices.set(group.key, 0);
        }
        let hasMore = true;
        while (hasMore) {
            hasMore = false;
            for (const group of groups) {
                const idx = indices.get(group.key);
                if (idx < group.blocks.length) {
                    result.push(group.blocks[idx]);
                    indices.set(group.key, idx + 1);
                    hasMore = true;
                }
            }
        }
        return result;
    }
    // ============================================
    // 自适应交错策略
    // ============================================
    /**
     * 自适应策略：根据理解度历史动态调整
     * - 理解度低的内容 → 聚类（加强巩固）
     * - 理解度高的内容 → 交错（挑战区分）
     */
    applyAdaptiveInterleaving(blocks) {
        // 分离低理解度和高理解度块
        const lowComprehension = [];
        const highComprehension = [];
        for (const block of blocks) {
            // 使用reviewCount和interval作为理解度代理
            // reviewCount多且interval长 → 理解度高
            const isHighComprehension = block.reviewCount >= 3 && block.interval >= 7;
            if (isHighComprehension) {
                highComprehension.push(block);
            }
            else {
                lowComprehension.push(block);
            }
        }
        // 低理解度块使用聚类
        const clusteredLow = this.applyClustering(lowComprehension);
        // 高理解度块使用交错
        const interleavedHigh = this.applyStrictInterleaving(highComprehension);
        // 合并：先低理解度（需要更多关注），再高理解度
        return [...clusteredLow, ...interleavedHigh];
    }
    // ============================================
    // Fuzz随机化
    // ============================================
    /**
     * 应用Fuzz随机化
     * 目的：防止相同优先级的内容总是以固定顺序出现
     */
    applyFuzz(blocks) {
        const { fuzzRange } = this.config;
        if (fuzzRange <= 0 || blocks.length <= 2) {
            return blocks;
        }
        // 在保持大致顺序的前提下，对相邻块进行小范围随机交换
        const result = [...blocks];
        const swapRange = Math.max(1, Math.floor(blocks.length * fuzzRange));
        for (let i = 0; i < result.length - 1; i++) {
            // 只交换相同优先级的块
            const current = result[i];
            const swapIdx = Math.min(i + 1 + Math.floor(Math.random() * swapRange), result.length - 1);
            const candidate = result[swapIdx];
            if (current.priority === candidate.priority && Math.random() < 0.3) {
                result[i] = candidate;
                result[swapIdx] = current;
            }
        }
        return result;
    }
    // ============================================
    // 辅助方法
    // ============================================
    /**
     * 按主题分组（使用标签作为主题标识）
     */
    groupByTopic(blocks) {
        const groups = new Map();
        for (const block of blocks) {
            // 使用第一个标签作为主题，无标签则使用文件路径
            const topic = block.tags.length > 0
                ? block.tags[0]
                : `file:${block.filePath}`;
            if (!groups.has(topic)) {
                groups.set(topic, []);
            }
            groups.get(topic).push(block);
        }
        return Array.from(groups.entries()).map(([key, blocks]) => ({ key, blocks }));
    }
    /**
     * 检查两个块是否应该分开（满足最小间隔要求）
     */
    shouldSeparate(blockA, blockB) {
        // 同文件检查
        if (blockA.filePath === blockB.filePath) {
            return true;
        }
        // 同标签检查
        const commonTags = blockA.tags.filter(t => blockB.tags.includes(t));
        if (commonTags.length > 0) {
            return true;
        }
        return false;
    }
    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// ============================================
// 工厂函数
// ============================================
/**
 * 创建交错调度器实例
 */
export function createInterleaveScheduler(config) {
    return new IRInterleaveScheduler(config);
}
