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
import { logger } from '../../utils/logger';
/**
 * 默认配置
 */
export const DEFAULT_LINK_ANALYZER_CONFIG = {
    maxLinkFactor: 0.5,
    aFactorAdjustment: 0.3,
    priorityBoostFactor: 0.05,
    enableBacklinkAnalysis: true
};
// ============================================
// 正则表达式
// ============================================
/** 内部链接: [[note]] 或 [[note|alias]] 或 [[note#heading]] */
const INTERNAL_LINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
/** 嵌入链接: ![[note]] 或 ![[image.png]] */
const EMBED_LINK_REGEX = /!\[\[([^\]]+)\]\]/g;
/** 外部链接: [text](url) */
const EXTERNAL_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
/** 标签: #tag 或 #tag/subtag */
const TAG_REGEX = /(?:^|\s)#([a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5_/-]*)/g;
// ============================================
// 链接分析器
// ============================================
export class IRLinkAnalyzer {
    app;
    config;
    /** 链接指标缓存 (blockId -> metrics) */
    metricsCache = new Map();
    /** 反向链接缓存 (filePath -> metrics) */
    backlinkCache = new Map();
    /** 缓存过期时间 (ms) */
    cacheExpiry = 5 * 60 * 1000; // 5分钟
    lastCacheUpdate = 0;
    constructor(app, config) {
        this.app = app;
        this.config = { ...DEFAULT_LINK_ANALYZER_CONFIG, ...config };
    }
    // ============================================
    // 核心分析方法
    // ============================================
    /**
     * 分析内容块的链接指标
     * @param content 内容块文本
     * @param blockId 可选的块ID用于缓存
     */
    analyzeContent(content, blockId) {
        // 检查缓存
        if (blockId && this.metricsCache.has(blockId)) {
            return this.metricsCache.get(blockId);
        }
        const lines = content.split('\n');
        const lineCount = lines.length;
        // 统计各类链接
        const internalLinks = (content.match(INTERNAL_LINK_REGEX) || []).length;
        const embedLinks = (content.match(EMBED_LINK_REGEX) || []).length;
        const externalLinks = (content.match(EXTERNAL_LINK_REGEX) || []).length;
        const tags = (content.match(TAG_REGEX) || []).length;
        // 计算链接密度 (每10行的链接数)
        const totalLinks = internalLinks + embedLinks + externalLinks;
        const linkDensity = lineCount > 0 ? totalLinks / (lineCount / 10) : 0;
        // 计算链接贡献度 (对数衰减，参考Obsidian SR插件)
        const linkContribution = this.calculateLinkContribution(totalLinks);
        const metrics = {
            internalLinks,
            embedLinks,
            externalLinks,
            tags,
            lineCount,
            linkDensity,
            linkContribution
        };
        // 缓存结果
        if (blockId) {
            this.metricsCache.set(blockId, metrics);
        }
        return metrics;
    }
    /**
     * 分析文件的反向链接
     * @param file Obsidian文件对象
     */
    analyzeBacklinks(file) {
        const filePath = file.path;
        // 检查缓存
        if (this.backlinkCache.has(filePath) && !this.isCacheExpired()) {
            return this.backlinkCache.get(filePath);
        }
        // 使用resolvedLinks统计反向链接
        // resolvedLinks[sourcePath][targetPath] = linkCount
        let directBacklinks = 0;
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        for (const sourcePath in resolvedLinks) {
            const links = resolvedLinks[sourcePath];
            if (links && links[filePath]) {
                directBacklinks++;
            }
        }
        // 计算重要性得分 (简化的PageRank思想)
        const importanceScore = this.calculateImportanceScore(directBacklinks);
        const metrics = {
            directBacklinks,
            importanceScore
        };
        // 缓存结果
        this.backlinkCache.set(filePath, metrics);
        return metrics;
    }
    // ============================================
    // A-Factor调整
    // ============================================
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
    adjustAFactor(baseAFactor, linkMetrics) {
        const { linkContribution } = linkMetrics;
        const { aFactorAdjustment } = this.config;
        // 链接贡献度越高，A-Factor降低越多
        // 公式: adjustedAFactor = baseAFactor * (1 - linkContribution * aFactorAdjustment)
        const adjustedAFactor = baseAFactor * (1 - linkContribution * aFactorAdjustment);
        // 确保A-Factor在合理范围内 [1.1, 3.0]
        return Math.max(1.1, Math.min(3.0, adjustedAFactor));
    }
    /**
     * 根据内容分析调整IRBlock的intervalFactor
     * @param block IRBlock
     * @param content 内容块文本
     */
    async adjustBlockAFactor(block, content) {
        const metrics = this.analyzeContent(content, block.id);
        const adjustedFactor = this.adjustAFactor(block.intervalFactor, metrics);
        logger.debug(`[IRLinkAnalyzer] 调整A-Factor: ${block.id}, ` +
            `链接密度=${metrics.linkDensity.toFixed(2)}, ` +
            `贡献度=${metrics.linkContribution.toFixed(2)}, ` +
            `${block.intervalFactor} -> ${adjustedFactor.toFixed(2)}`);
        return adjustedFactor;
    }
    // ============================================
    // 优先级调整
    // ============================================
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
    adjustPriority(basePriority, backlinkMetrics) {
        if (!this.config.enableBacklinkAnalysis) {
            return basePriority;
        }
        const { importanceScore } = backlinkMetrics;
        const { priorityBoostFactor } = this.config;
        // 重要性越高，优先级提升越多（数值降低）
        const priorityBoost = Math.min(0.5, importanceScore * priorityBoostFactor);
        const adjustedPriority = basePriority - priorityBoost;
        // 确保优先级在有效范围 [1, 3]
        return Math.max(1, Math.min(3, adjustedPriority));
    }
    // ============================================
    // 批量分析
    // ============================================
    /**
     * 批量分析多个内容块
     * @param blocks IRBlock数组
     * @param getContent 获取内容的回调函数
     */
    async analyzeBlocks(blocks, getContent) {
        const results = new Map();
        for (const block of blocks) {
            try {
                const content = await getContent(block);
                const metrics = this.analyzeContent(content, block.id);
                results.set(block.id, metrics);
            }
            catch (error) {
                logger.warn(`[IRLinkAnalyzer] 分析块失败: ${block.id}`, error);
            }
        }
        return results;
    }
    /**
     * 更新所有文件的反向链接缓存
     */
    async updateBacklinkCache() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            this.analyzeBacklinks(file);
        }
        this.lastCacheUpdate = Date.now();
        logger.debug(`[IRLinkAnalyzer] 更新反向链接缓存: ${files.length}个文件`);
    }
    // ============================================
    // 辅助方法
    // ============================================
    /**
     * 计算链接贡献度（对数衰减）
     *
     * 参考Obsidian SR插件的公式:
     * link_contribution = max_link_factor * min(1.0, log(link_count + 0.5) / log(64))
     */
    calculateLinkContribution(linkCount) {
        if (linkCount <= 0)
            return 0;
        const { maxLinkFactor } = this.config;
        // 使用对数函数，避免链接过多时影响过大
        // log(64) ≈ 4.16，意味着64个链接达到最大贡献度
        const normalizedContribution = Math.min(1.0, Math.log(linkCount + 0.5) / Math.log(64));
        return maxLinkFactor * normalizedContribution;
    }
    /**
     * 计算重要性得分（简化PageRank）
     */
    calculateImportanceScore(backlinkCount) {
        if (backlinkCount <= 0)
            return 0;
        // 使用平方根函数，减缓增长速度
        // 10个反向链接 → 得分 ≈ 3.16
        // 100个反向链接 → 得分 = 10
        return Math.sqrt(backlinkCount);
    }
    /**
     * 检查缓存是否过期
     */
    isCacheExpired() {
        return Date.now() - this.lastCacheUpdate > this.cacheExpiry;
    }
    /**
     * 清除缓存
     */
    clearCache() {
        this.metricsCache.clear();
        this.backlinkCache.clear();
        this.lastCacheUpdate = 0;
    }
    /**
     * 清除特定块的缓存
     */
    clearBlockCache(blockId) {
        this.metricsCache.delete(blockId);
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
 * 创建链接分析器实例
 */
export function createLinkAnalyzer(app, config) {
    return new IRLinkAnalyzer(app, config);
}
