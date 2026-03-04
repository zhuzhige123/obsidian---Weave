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
import { getV2PathsFromApp } from '../../config/paths';
// ============================================
// 默认值
// ============================================
const DEFAULT_MONITORING_DATA = {
    version: '3.0.0',
    dailyStats: [],
    priorityChanges: [],
    groupParamChanges: [],
    lastUpdated: new Date().toISOString()
};
const MAX_DAILY_STATS_DAYS = 30;
const MAX_PRIORITY_CHANGES = 100;
const MAX_GROUP_PARAM_CHANGES = 100;
// ============================================
// 工具函数
// ============================================
/**
 * 获取今日日期字符串
 */
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}
/**
 * 创建空的每日统计
 */
function createEmptyDailyStats(date) {
    return {
        date,
        dueCount: 0,
        scheduledCount: 0,
        postponedCount: 0,
        totalEstimatedMinutes: 0,
        totalActualReadingSeconds: 0,
        tagGroupAppearances: {},
        newBlocksCount: 0,
        completedBlocksCount: 0
    };
}
// ============================================
// 服务实现
// ============================================
/**
 * 增量阅读监控服务
 */
export class IRMonitoringService {
    data;
    storagePath;
    vault; // Obsidian Vault
    constructor(vault, basePath) {
        this.vault = vault;
        const resolvedBasePath = basePath || getV2PathsFromApp(vault?.app).ir.root;
        this.storagePath = `${resolvedBasePath}/monitoring.json`;
        this.data = { ...DEFAULT_MONITORING_DATA };
    }
    // ============================================
    // 初始化与持久化
    // ============================================
    /**
     * 加载监控数据
     */
    async load() {
        try {
            const exists = await this.vault.adapter.exists(this.storagePath);
            if (exists) {
                const content = await this.vault.adapter.read(this.storagePath);
                const parsed = JSON.parse(content);
                this.data = { ...DEFAULT_MONITORING_DATA, ...parsed };
            }
        }
        catch (error) {
            console.warn('[IRMonitoringService] 加载监控数据失败，使用默认值:', error);
            this.data = { ...DEFAULT_MONITORING_DATA };
        }
    }
    /**
     * 保存监控数据
     */
    async save() {
        try {
            this.data.lastUpdated = new Date().toISOString();
            // 清理过期数据
            this.cleanupOldData();
            const content = JSON.stringify(this.data);
            // 确保目录存在
            const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf('/'));
            const dirExists = await this.vault.adapter.exists(dir);
            if (!dirExists) {
                await this.vault.adapter.mkdir(dir);
            }
            await this.vault.adapter.write(this.storagePath, content);
        }
        catch (error) {
            console.error('[IRMonitoringService] 保存监控数据失败:', error);
        }
    }
    /**
     * 清理过期数据
     */
    cleanupOldData() {
        // 保留最近 N 天的每日统计
        if (this.data.dailyStats.length > MAX_DAILY_STATS_DAYS) {
            this.data.dailyStats = this.data.dailyStats.slice(-MAX_DAILY_STATS_DAYS);
        }
        // 保留最近 N 条优先级变更
        if (this.data.priorityChanges.length > MAX_PRIORITY_CHANGES) {
            this.data.priorityChanges = this.data.priorityChanges.slice(-MAX_PRIORITY_CHANGES);
        }
        // 保留最近 N 条组参数变更
        if (this.data.groupParamChanges.length > MAX_GROUP_PARAM_CHANGES) {
            this.data.groupParamChanges = this.data.groupParamChanges.slice(-MAX_GROUP_PARAM_CHANGES);
        }
    }
    // ============================================
    // 每日统计
    // ============================================
    /**
     * 获取或创建今日统计
     */
    getTodayStats() {
        const today = getTodayDateString();
        let stats = this.data.dailyStats.find(s => s.date === today);
        if (!stats) {
            stats = createEmptyDailyStats(today);
            this.data.dailyStats.push(stats);
        }
        return stats;
    }
    /**
     * 记录到期数量
     */
    recordDueCount(count) {
        const stats = this.getTodayStats();
        stats.dueCount = count;
    }
    /**
     * 记录已安排数量
     */
    recordScheduledCount(count) {
        const stats = this.getTodayStats();
        stats.scheduledCount = count;
    }
    /**
     * 记录后推数量
     */
    recordPostponedCount(count) {
        const stats = this.getTodayStats();
        stats.postponedCount = count;
    }
    /**
     * 记录预估时长
     */
    recordEstimatedMinutes(minutes) {
        const stats = this.getTodayStats();
        stats.totalEstimatedMinutes = minutes;
    }
    /**
     * 累加实际阅读时长
     */
    addActualReadingTime(seconds) {
        const stats = this.getTodayStats();
        stats.totalActualReadingSeconds += seconds;
    }
    /**
     * 记录 TagGroup 出现
     */
    recordTagGroupAppearance(groupId) {
        const stats = this.getTodayStats();
        stats.tagGroupAppearances[groupId] = (stats.tagGroupAppearances[groupId] || 0) + 1;
    }
    /**
     * 记录新增块
     */
    recordNewBlock() {
        const stats = this.getTodayStats();
        stats.newBlocksCount++;
    }
    /**
     * 记录完成块
     */
    recordCompletedBlock() {
        const stats = this.getTodayStats();
        stats.completedBlocksCount++;
    }
    // ============================================
    // 优先级追踪
    // ============================================
    /**
     * 记录优先级变更
     */
    recordPriorityChange(blockId, oldPriorityUi, newPriorityUi, oldPriorityEff, newPriorityEff) {
        this.data.priorityChanges.push({
            blockId,
            timestamp: new Date().toISOString(),
            oldPriorityUi,
            newPriorityUi,
            oldPriorityEff,
            newPriorityEff
        });
    }
    /**
     * 获取块的优先级变更历史
     */
    getPriorityHistory(blockId) {
        return this.data.priorityChanges.filter(r => r.blockId === blockId);
    }
    // ============================================
    // 组参数监控
    // ============================================
    /**
     * 记录组参数变更
     */
    recordGroupParamChange(groupId, oldIntervalFactor, newIntervalFactor, sampleCount) {
        this.data.groupParamChanges.push({
            groupId,
            timestamp: new Date().toISOString(),
            oldIntervalFactor,
            newIntervalFactor,
            sampleCount
        });
    }
    /**
     * 获取组的参数变更历史
     */
    getGroupParamHistory(groupId) {
        return this.data.groupParamChanges.filter(r => r.groupId === groupId);
    }
    // ============================================
    // 统计查询
    // ============================================
    /**
     * 获取最近 N 天的统计
     */
    getRecentStats(days = 7) {
        return this.data.dailyStats.slice(-days);
    }
    /**
     * 计算 TagGroup 展示占比
     */
    calculateTagGroupRatios(blocks, profiles) {
        const today = getTodayDateString();
        const todayStats = this.data.dailyStats.find(s => s.date === today);
        const totalAppearances = todayStats
            ? Object.values(todayStats.tagGroupAppearances).reduce((a, b) => a + b, 0)
            : 0;
        const summaries = [];
        profiles.forEach((profile, groupId) => {
            const groupBlocks = blocks.filter(b => b.tagGroupId === groupId);
            const now = new Date();
            const dueBlocks = groupBlocks.filter(b => {
                if (!b.nextReview)
                    return false;
                return new Date(b.nextReview) <= now;
            });
            const appearances = todayStats?.tagGroupAppearances[groupId] || 0;
            const avgPriority = groupBlocks.length > 0
                ? groupBlocks.reduce((sum, b) => sum + (b.priorityEff ?? 5), 0) / groupBlocks.length
                : 5;
            summaries.push({
                groupId,
                groupName: profile.groupId, // 可以从 TagGroup 定义中获取名称
                blockCount: groupBlocks.length,
                dueCount: dueBlocks.length,
                appearanceRatio: totalAppearances > 0 ? appearances / totalAppearances : 0,
                intervalFactorBase: profile.intervalFactorBase,
                avgPriority
            });
        });
        return summaries.sort((a, b) => b.appearanceRatio - a.appearanceRatio);
    }
    /**
     * 获取汇总报告
     */
    getSummaryReport() {
        const recentStats = this.getRecentStats(7);
        const today = this.data.dailyStats.find(s => s.date === getTodayDateString()) || null;
        // 计算周平均
        const weeklyAvg = {
            dueCount: 0,
            scheduledCount: 0,
            completedCount: 0,
            readingMinutes: 0
        };
        if (recentStats.length > 0) {
            weeklyAvg.dueCount = recentStats.reduce((sum, s) => sum + s.dueCount, 0) / recentStats.length;
            weeklyAvg.scheduledCount = recentStats.reduce((sum, s) => sum + s.scheduledCount, 0) / recentStats.length;
            weeklyAvg.completedCount = recentStats.reduce((sum, s) => sum + s.completedBlocksCount, 0) / recentStats.length;
            weeklyAvg.readingMinutes = recentStats.reduce((sum, s) => sum + s.totalActualReadingSeconds / 60, 0) / recentStats.length;
        }
        // 计算趋势（比较前3天和后3天）
        let dueCountTrend = 0;
        let completionRateTrend = 0;
        if (recentStats.length >= 6) {
            const firstHalf = recentStats.slice(0, 3);
            const secondHalf = recentStats.slice(-3);
            const firstAvgDue = firstHalf.reduce((sum, s) => sum + s.dueCount, 0) / 3;
            const secondAvgDue = secondHalf.reduce((sum, s) => sum + s.dueCount, 0) / 3;
            dueCountTrend = secondAvgDue - firstAvgDue;
            const firstCompletionRate = firstHalf.reduce((sum, s) => {
                return sum + (s.scheduledCount > 0 ? s.completedBlocksCount / s.scheduledCount : 0);
            }, 0) / 3;
            const secondCompletionRate = secondHalf.reduce((sum, s) => {
                return sum + (s.scheduledCount > 0 ? s.completedBlocksCount / s.scheduledCount : 0);
            }, 0) / 3;
            completionRateTrend = secondCompletionRate - firstCompletionRate;
        }
        return {
            today,
            weeklyAvg,
            trends: {
                dueCountTrend,
                completionRateTrend
            }
        };
    }
    // ============================================
    // 数据导出
    // ============================================
    /**
     * 导出所有监控数据
     */
    exportData() {
        return { ...this.data };
    }
    /**
     * 重置监控数据
     */
    reset() {
        this.data = { ...DEFAULT_MONITORING_DATA };
    }
}
/**
 * 创建监控服务实例
 */
export function createIRMonitoringService(vault, basePath) {
    return new IRMonitoringService(vault, basePath);
}
