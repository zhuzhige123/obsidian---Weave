/**
 * 增量阅读链接分析服务
 *
 * 基于Obsidian双链特性进行内容复杂度分析：
 * - 检测 [[]] 内部链接、![[]] 嵌入、[]() 外链
 * - 根据链接密度动态调整A-Factor
 * - 基于认知负荷理论：链接越多 → 复杂度越高 → 需要更频繁复习
 *
 * 设计依据：
 * - 认知负荷理论 (Sweller): 高元素交互性需要分段学习
 * - Hebbian学习法则: 概念需同时激活才能建立连接
 * - Obsidian SR插件: link_contribution = max_link_factor * min(1.0, log(link_count + 0.5) / log(64))
 *
 * @module services/incremental-reading/IRLinkAnalyzer
 * @version 1.0.0
 */
import type { App, TFile } from 'obsidian';
import type { IRBlock } from '../../types/ir-types';
/**
 * 链接分析指标
 */
export interface LinkMetrics {
    /** 内部链接数量 [[]] */
    internalLinks: number;
    /** 嵌入链接数量 ![[]] */
    embedLinks: number;
    /** 外部链接数量 []() */
    externalLinks: number;
    /** 标签数量 #tag */
    tags: number;
    /** 内容行数 */
    lineCount: number;
    /** 链接密度 (每10行链接数) */
    linkDensity: number;
    /** 链接贡献度 (0-1) */
    linkContribution: number;
}
/**
 * 反向链接指标
 */
export interface BacklinkMetrics {
    /** 直接引用该文件的笔记数 */
    directBacklinks: number;
    /** 重要性得分 (基于PageRank思想) */
    importanceScore: number;
}
/**
 * 链接分析配置
 */
export interface LinkAnalyzerConfig {
    /** 最大链接因子 (0-1)，控制链接对A-Factor的最大影响程度 */
    maxLinkFactor: number;
    /** A-Factor调整系数，链接密度对A-Factor的影响程度 */
    aFactorAdjustment: number;
    /** 优先级提升系数，反向链接对优先级的影响程度 */
    priorityBoostFactor: number;
    /** 是否启用反向链接分析 */
    enableBacklinkAnalysis: boolean;
}
/**
 * 默认配置
 */
export declare const DEFAULT_LINK_ANALYZER_CONFIG: LinkAnalyzerConfig;
export declare class IRLinkAnalyzer {
    private app;
    private config;
    /** 链接指标缓存 (blockId -> metrics) */
    private metricsCache;
    /** 反向链接缓存 (filePath -> metrics) */
    private backlinkCache;
    /** 缓存过期时间 (ms) */
    private cacheExpiry;
    private lastCacheUpdate;
    constructor(app: App, config?: Partial<LinkAnalyzerConfig>);
    /**
     * 分析内容块的链接指标
     * @param content 内容块文本
     * @param blockId 可选的块ID用于缓存
     */
    analyzeContent(content: string, blockId?: string): LinkMetrics;
    /**
     * 分析文件的反向链接
     * @param file Obsidian文件对象
     */
    analyzeBacklinks(file: TFile): BacklinkMetrics;
    /**
     * 根据链接密度调整A-Factor
     *
     * 核心逻辑（基于认知科学）：
     * - 链接越多 → 复杂度越高 → A-Factor越低 → 间隔增长越慢 → 复习越频繁
     *
     * @param baseAFactor 基础A-Factor
     * @param linkMetrics 链接指标
     * @returns 调整后的A-Factor
     */
    adjustAFactor(baseAFactor: number, linkMetrics: LinkMetrics): number;
    /**
     * 根据内容分析调整IRBlock的intervalFactor
     * @param block IRBlock
     * @param content 内容块文本
     */
    adjustBlockAFactor(block: IRBlock, content: string): Promise<number>;
    /**
     * 根据反向链接调整优先级
     *
     * 核心逻辑：
     * - 被引用越多 → 越重要 → 优先级越高（数值越低）
     *
     * @param basePriority 基础优先级 (1-3)
     * @param backlinkMetrics 反向链接指标
     * @returns 调整后的优先级
     */
    adjustPriority(basePriority: number, backlinkMetrics: BacklinkMetrics): number;
    /**
     * 批量分析多个内容块
     * @param blocks IRBlock数组
     * @param getContent 获取内容的回调函数
     */
    analyzeBlocks(blocks: IRBlock[], getContent: (block: IRBlock) => Promise<string>): Promise<Map<string, LinkMetrics>>;
    /**
     * 更新所有文件的反向链接缓存
     */
    updateBacklinkCache(): Promise<void>;
    /**
     * 计算链接贡献度（对数衰减）
     *
     * 参考Obsidian SR插件的公式:
     * link_contribution = max_link_factor * min(1.0, log(link_count + 0.5) / log(64))
     */
    private calculateLinkContribution;
    /**
     * 计算重要性得分（简化PageRank）
     */
    private calculateImportanceScore;
    /**
     * 检查缓存是否过期
     */
    private isCacheExpired;
    /**
     * 清除缓存
     */
    clearCache(): void;
    /**
     * 清除特定块的缓存
     */
    clearBlockCache(blockId: string): void;
    /**
     * 获取配置
     */
    getConfig(): LinkAnalyzerConfig;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<LinkAnalyzerConfig>): void;
}
/**
 * 创建链接分析器实例
 */
export declare function createLinkAnalyzer(app: App, config?: Partial<LinkAnalyzerConfig>): IRLinkAnalyzer;
