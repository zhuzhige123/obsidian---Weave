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
import { logger } from '../../utils/logger';
import { IRLinkAnalyzer } from './IRLinkAnalyzer';
import { IRInterleaveScheduler } from './IRInterleaveScheduler';
/** 评分对应的间隔修正因子 */
const RATING_MODIFIERS = {
    1: 0, // 忽略: 标记为suspended，不再安排复习
    2: 0.8, // 一般: 略微减少
    3: 1.0, // 清晰: 保持
    4: 1.3 // 精通: 增加间隔
};
/** 默认调度配置 */
export const DEFAULT_SCHEDULE_CONFIG = {
    initialInterval: 1,
    intervalFactor: 2.0,
    reviewThreshold: 7,
    maxInterval: 365
};
export class IRScheduler {
    storage;
    config;
    /** v2.1: 链接分析器 */
    linkAnalyzer = null;
    /** v2.1: 交错调度器 */
    interleaveScheduler = null;
    /** v2.1: 功能开关 */
    enableLinkAnalysis = true;
    enableInterleaving = true;
    constructor(storage, config, app, options) {
        this.storage = storage;
        this.config = { ...DEFAULT_SCHEDULE_CONFIG, ...config, ...options?.scheduleConfig };
        // v2.1: 初始化链接分析器
        this.enableLinkAnalysis = options?.enableLinkAnalysis ?? true;
        if (app && this.enableLinkAnalysis) {
            this.linkAnalyzer = new IRLinkAnalyzer(app, options?.linkAnalyzerConfig);
        }
        // v2.1: 初始化交错调度器
        this.enableInterleaving = options?.enableInterleaving ?? true;
        if (this.enableInterleaving) {
            this.interleaveScheduler = new IRInterleaveScheduler(options?.interleaveConfig);
        }
    }
    /**
     * v2.1: 延迟初始化链接分析器（用于不在构造函数中传入app的情况）
     */
    initLinkAnalyzer(app, config) {
        if (!this.linkAnalyzer && this.enableLinkAnalysis) {
            this.linkAnalyzer = new IRLinkAnalyzer(app, config);
            logger.debug('[IRScheduler] 链接分析器已初始化');
        }
    }
    /**
     * 完成内容块阅读后更新调度 (v2.0: 支持理解度评分)
     * @param block 内容块
     * @param rating 理解度评分 1-4
     * @param readingTime 阅读时长(秒)
     * @param deckId 牌组ID
     */
    async completeBlock(block, rating = 3, readingTime = 0, deckId = '') {
        const now = new Date();
        let newState = block.state;
        let newInterval = block.interval;
        // 评分1=忽略：直接标记为suspended，不再安排复习
        if (rating === 1) {
            newState = 'suspended';
            newInterval = 0;
            const updatedBlock = {
                ...block,
                state: newState,
                interval: newInterval,
                reviewCount: (block.reviewCount || 0) + 1,
                lastReview: now.toISOString(),
                totalReadingTime: (block.totalReadingTime || 0) + readingTime,
                firstReadAt: block.firstReadAt || now.toISOString(),
                updatedAt: now.toISOString(),
                lastRating: rating
            };
            await this.storage.saveBlock(updatedBlock);
            const session = {
                id: `session-${Date.now()}`,
                blockId: block.id,
                deckId: deckId,
                startTime: new Date(now.getTime() - readingTime * 1000).toISOString(),
                endTime: now.toISOString(),
                duration: readingTime,
                action: 'ignored',
                rating: rating
            };
            await this.storage.addSession(session);
            logger.debug(`[IRScheduler] 内容块已忽略 ${block.id}: 标记为suspended`);
            return updatedBlock;
        }
        // 应用评分修正因子
        const ratingModifier = RATING_MODIFIERS[rating];
        switch (block.state) {
            case 'new':
                // 新 -> 学习中
                newState = 'learning';
                newInterval = this.config.initialInterval * ratingModifier;
                break;
            case 'learning':
                // 学习中：增加间隔
                newInterval = Math.min(block.interval * block.intervalFactor * ratingModifier, this.config.maxInterval);
                // 间隔超过阈值，进入复习状态
                if (newInterval >= this.config.reviewThreshold) {
                    newState = 'review';
                }
                break;
            case 'review':
                // 复习：继续增加间隔
                newInterval = Math.min(block.interval * block.intervalFactor * ratingModifier, this.config.maxInterval);
                break;
            case 'suspended':
                // suspended状态不应该被调度，但如果被调用，恢复为learning
                newState = 'learning';
                newInterval = this.config.initialInterval;
                break;
        }
        // 确保间隔至少为1天
        newInterval = Math.max(1, Math.round(newInterval));
        // 计算下次复习日期
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + newInterval);
        // v2.0: 更新内容块（包含新字段）
        const updatedBlock = {
            ...block,
            state: newState,
            interval: newInterval,
            nextReview: nextReview.toISOString(),
            reviewCount: (block.reviewCount || 0) + 1,
            lastReview: now.toISOString(),
            // v2.0 新字段
            totalReadingTime: (block.totalReadingTime || 0) + readingTime,
            firstReadAt: block.firstReadAt || now.toISOString(),
            updatedAt: now.toISOString(),
            // v2.1: 保存上次自评评分
            lastRating: rating
        };
        await this.storage.saveBlock(updatedBlock);
        // v2.0: 记录会话 (新接口)
        const session = {
            id: `session-${Date.now()}`,
            blockId: block.id,
            deckId: deckId,
            startTime: new Date(now.getTime() - readingTime * 1000).toISOString(),
            endTime: now.toISOString(),
            duration: readingTime,
            action: 'completed',
            rating: rating
        };
        await this.storage.addSession(session);
        logger.debug(`[IRScheduler] 完成内容块 ${block.id}: ${block.state} -> ${newState}, 间隔: ${newInterval}天, 评分: ${rating}`);
        return updatedBlock;
    }
    /**
     * 跳过内容块（不更新调度，只记录）(v2.0: 新接口)
     */
    async skipBlock(block, deckId = '') {
        const now = new Date();
        const session = {
            id: `session-${Date.now()}`,
            blockId: block.id,
            deckId: deckId,
            startTime: now.toISOString(),
            endTime: now.toISOString(),
            duration: 0,
            action: 'skipped'
        };
        await this.storage.addSession(session);
        logger.debug(`[IRScheduler] 跳过内容块: ${block.id}`);
    }
    /**
     * 暂停/忽略内容块 (v2.0 新增)
     */
    async suspendBlock(block, deckId = '') {
        const now = new Date();
        const updatedBlock = {
            ...block,
            state: 'suspended',
            updatedAt: now.toISOString()
        };
        await this.storage.saveBlock(updatedBlock);
        const session = {
            id: `session-${Date.now()}`,
            blockId: block.id,
            deckId: deckId,
            startTime: now.toISOString(),
            endTime: now.toISOString(),
            duration: 0,
            action: 'suspended'
        };
        await this.storage.addSession(session);
        logger.debug(`[IRScheduler] 暂停内容块: ${block.id}`);
        return updatedBlock;
    }
    /**
     * 恢复已暂停的内容块 (v2.0 新增)
     */
    async unsuspendBlock(block) {
        if (block.state !== 'suspended') {
            return block;
        }
        const updatedBlock = {
            ...block,
            state: block.reviewCount > 0 ? 'review' : 'new',
            updatedAt: new Date().toISOString()
        };
        await this.storage.saveBlock(updatedBlock);
        logger.debug(`[IRScheduler] 恢复内容块: ${block.id}`);
        return updatedBlock;
    }
    /**
     * 重置内容块调度（重新学习）
     */
    async resetBlock(block) {
        const updatedBlock = {
            ...block,
            state: 'new',
            interval: 0,
            nextReview: null,
            reviewCount: 0,
            lastReview: null
        };
        await this.storage.saveBlock(updatedBlock);
        logger.debug(`[IRScheduler] 重置内容块: ${block.id}`);
        return updatedBlock;
    }
    /**
     * 调整内容块优先级
     */
    async adjustPriority(block, newPriority) {
        // IRPriority 只允许 1, 2, 3
        const priority = Math.max(1, Math.min(3, Math.round(newPriority)));
        const updatedBlock = {
            ...block,
            priority
        };
        await this.storage.saveBlock(updatedBlock);
        logger.debug(`[IRScheduler] 调整优先级 ${block.id}: ${block.priority} -> ${priority}`);
        return updatedBlock;
    }
    /**
     * 获取今日到期的内容块（排序后）
     */
    async getTodayDueBlocks() {
        const dueBlocks = await this.storage.getTodayDueBlocks();
        // 按优先级和过期天数排序
        return this.sortBlocks(dueBlocks);
    }
    /**
     * 获取牌组今日到期的内容块
     */
    async getDeckDueBlocks(deckPath) {
        const allBlocks = await this.storage.getBlocksByDeck(deckPath);
        const today = new Date().toISOString().split('T')[0];
        const dueBlocks = allBlocks.filter(block => {
            if (block.state === 'new')
                return true;
            if (!block.nextReview)
                return false;
            const reviewDate = block.nextReview.split('T')[0];
            return reviewDate <= today;
        });
        return this.sortBlocks(dueBlocks);
    }
    /**
     * 排序内容块 (v2.0: 支持suspended状态)
     * 1. 优先级（低值优先，v2.0: 1=高, 2=中, 3=低）
     * 2. 过期天数（过期越久越优先）
     * 3. 状态（learning > review > new, suspended排最后）
     */
    sortBlocks(blocks) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return blocks.sort((a, b) => {
            // 1. 优先级 (v2.0: 1=高优先)
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // 2. 过期天数
            const aOverdue = this.getOverdueDays(a, today);
            const bOverdue = this.getOverdueDays(b, today);
            if (aOverdue !== bOverdue) {
                return bOverdue - aOverdue; // 过期越久越优先
            }
            // 3. 状态权重 (v2.0: 包含suspended)
            const stateOrder = {
                'learning': 0,
                'review': 1,
                'new': 2,
                'suspended': 99 // suspended排最后
            };
            return stateOrder[a.state] - stateOrder[b.state];
        });
    }
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
    async getStudyQueue(deckId, _dailyNewLimit = 20, _dailyReviewLimit = 50, applyInterleaving = true) {
        const dueBlocks = await this.getDeckDueBlocks(deckId);
        logger.info(`[IRScheduler] 获取学习队列: ${deckId}, 到期块数: ${dueBlocks.length}`);
        // 过滤suspended状态
        const suspendedCount = dueBlocks.filter(b => b.state === 'suspended').length;
        let activeBlocks = dueBlocks.filter(b => b.state !== 'suspended');
        logger.debug(`[IRScheduler] 过滤suspended后: ${activeBlocks.length} (移除 ${suspendedCount} 个suspended块)`);
        // v2.3.1: 过滤带有 #ignore 标签的内容块（同时检查 tags 数组和 contentPreview）
        let ignoredCount = 0;
        activeBlocks = activeBlocks.filter(b => {
            // 检查1: tags数组中是否包含"ignore"
            const hasIgnoreInTags = b.tags?.some(tag => tag.toLowerCase() === 'ignore' || tag.toLowerCase() === '#ignore') || false;
            // 检查2: contentPreview中是否包含 #ignore（作为备用检查）
            const hasIgnoreInContent = /#ignore\b/i.test(b.contentPreview || '');
            const hasIgnoreTag = hasIgnoreInTags || hasIgnoreInContent;
            if (hasIgnoreTag) {
                ignoredCount++;
                logger.debug(`[IRScheduler] 过滤忽略标签内容块: ${b.id}, tags: ${JSON.stringify(b.tags)}, inContent: ${hasIgnoreInContent}`);
            }
            return !hasIgnoreTag;
        });
        logger.info(`[IRScheduler] 过滤#ignore后: ${activeBlocks.length} (移除 ${ignoredCount} 个ignore块)`);
        // v2.5: 不再应用每日限制，直接使用所有到期内容块
        // 增量阅读的认知负荷与记忆牌组不同，用户可以自由阅读任意数量
        let queue = this.sortBlocks(activeBlocks);
        // v2.1: 应用交错策略（保留，用于优化阅读顺序）
        if (applyInterleaving && this.interleaveScheduler && this.enableInterleaving) {
            queue = this.interleaveScheduler.applyInterleaving(queue, true);
            logger.debug(`[IRScheduler] 应用交错调度: ${queue.length}块`);
        }
        return queue;
    }
    // ============================================
    // v2.1 链接分析集成方法
    // ============================================
    /**
     * v2.1: 根据内容分析动态调整块的intervalFactor
     *
     * @param block 内容块
     * @param content 内容文本
     * @returns 调整后的intervalFactor
     */
    async analyzeAndAdjustAFactor(block, content) {
        if (!this.linkAnalyzer || !this.enableLinkAnalysis) {
            return block.intervalFactor;
        }
        const metrics = this.linkAnalyzer.analyzeContent(content, block.id);
        const adjustedFactor = this.linkAnalyzer.adjustAFactor(block.intervalFactor, metrics);
        logger.debug(`[IRScheduler] 链接分析: ${block.id}, ` +
            `链接=${metrics.internalLinks}+${metrics.embedLinks}+${metrics.externalLinks}, ` +
            `密度=${metrics.linkDensity.toFixed(2)}, ` +
            `A-Factor: ${block.intervalFactor} -> ${adjustedFactor.toFixed(2)}`);
        return adjustedFactor;
    }
    /**
     * v2.1: 完成阅读并应用链接分析调整
     *
     * @param block 内容块
     * @param rating 理解度评分
     * @param content 内容文本（用于链接分析）
     * @param readingTime 阅读时长
     * @param deckId 牌组ID
     */
    async completeBlockWithAnalysis(block, rating = 3, content, readingTime = 0, deckId = '') {
        // 先进行链接分析并更新intervalFactor
        if (this.linkAnalyzer && this.enableLinkAnalysis && content) {
            const adjustedFactor = await this.analyzeAndAdjustAFactor(block, content);
            block = { ...block, intervalFactor: adjustedFactor };
        }
        // 然后调用原有的completeBlock逻辑
        return this.completeBlock(block, rating, readingTime, deckId);
    }
    /**
     * v2.1: 获取链接分析器（供外部使用）
     */
    getLinkAnalyzer() {
        return this.linkAnalyzer;
    }
    /**
     * v2.1: 获取交错调度器（供外部使用）
     */
    getInterleaveScheduler() {
        return this.interleaveScheduler;
    }
    /**
     * v2.1: 更新交错调度配置
     */
    updateInterleaveConfig(config) {
        if (this.interleaveScheduler) {
            this.interleaveScheduler.updateConfig(config);
        }
    }
    /**
     * v2.1: 更新链接分析配置
     */
    updateLinkAnalyzerConfig(config) {
        if (this.linkAnalyzer) {
            this.linkAnalyzer.updateConfig(config);
        }
    }
    /**
     * 计算过期天数
     */
    getOverdueDays(block, today) {
        if (!block.nextReview)
            return 0;
        const reviewDate = new Date(block.nextReview);
        reviewDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - reviewDate.getTime();
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }
    /**
     * 获取调度统计
     */
    async getScheduleStats(deckPath) {
        const blocks = await this.storage.getBlocksByDeck(deckPath);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next7Days = new Date(today);
        next7Days.setDate(next7Days.getDate() + 7);
        let newCount = 0;
        let learningCount = 0;
        let reviewCount = 0;
        let dueToday = 0;
        let overdue = 0;
        let upcoming7Days = 0;
        for (const block of blocks) {
            // 状态统计
            switch (block.state) {
                case 'new':
                    newCount++;
                    break;
                case 'learning':
                    learningCount++;
                    break;
                case 'review':
                    reviewCount++;
                    break;
            }
            // 到期统计
            if (block.state === 'new') {
                dueToday++;
            }
            else if (block.nextReview) {
                const reviewDate = new Date(block.nextReview);
                reviewDate.setHours(0, 0, 0, 0);
                if (reviewDate < today) {
                    overdue++;
                    dueToday++;
                }
                else if (reviewDate.getTime() === today.getTime()) {
                    dueToday++;
                }
                else if (reviewDate <= next7Days) {
                    upcoming7Days++;
                }
            }
        }
        return {
            newCount,
            learningCount,
            reviewCount,
            dueToday,
            overdue,
            upcoming7Days
        };
    }
    /**
     * 预测未来复习负载
     */
    async forecastLoad(deckPath, days = 30) {
        const blocks = await this.storage.getBlocksByDeck(deckPath);
        const forecast = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // 初始化日期
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            forecast[date.toISOString().split('T')[0]] = 0;
        }
        // 统计每日到期数
        for (const block of blocks) {
            if (block.state === 'new') {
                // 新块计入今天
                forecast[today.toISOString().split('T')[0]]++;
            }
            else if (block.nextReview) {
                const reviewDate = block.nextReview.split('T')[0];
                if (forecast[reviewDate] !== undefined) {
                    forecast[reviewDate]++;
                }
            }
        }
        return forecast;
    }
}
