/**
 * 增量阅读导入时间分散调度服务
 *
 * 基于负载率的智能分配算法实现
 *
 * @module services/incremental-reading/IRImportSchedulingService
 * @version 1.0.0
 */
export class IRImportSchedulingService {
    loadInfo;
    constructor(loadInfo) {
        this.loadInfo = loadInfo;
    }
    /**
     * 计算导入分散计划
     */
    async calculateScheduling(contentBlocks, config, startDate = new Date()) {
        const dailyLoads = await this.initializeDailyLoads(config.distributionDays, startDate);
        // 根据策略分配内容块
        switch (config.strategy) {
            case 'even':
                this.distributeEvenly(contentBlocks, dailyLoads, config);
                break;
            case 'balanced':
                this.distributeBalanced(contentBlocks, dailyLoads, config);
                break;
            case 'front-loaded':
                this.distributeFrontLoaded(contentBlocks, dailyLoads, config);
                break;
        }
        // 计算影响指标
        return this.calculateImpact(dailyLoads, contentBlocks);
    }
    /**
     * 初始化每日负载数据
     */
    async initializeDailyLoads(days, startDate) {
        const loads = [];
        // Get start of day
        const today = new Date(startDate);
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const existingBlocks = await this.loadInfo.getBlocksForDate(date);
            const existingMinutes = existingBlocks.reduce((sum, block) => sum + this.loadInfo.estimateBlockMinutes(block), 0);
            loads.push({
                date,
                existingCount: existingBlocks.length,
                existingMinutes,
                newCount: 0,
                newMinutes: 0,
                loadRate: existingMinutes / this.loadInfo.dailyBudgetMinutes,
                isOverloaded: existingMinutes >= this.loadInfo.dailyBudgetMinutes
            });
        }
        return loads;
    }
    /**
     * 均分策略：完全平均分布，不看已有负载
     */
    distributeEvenly(blocks, dailyLoads, config) {
        const blocksPerDay = Math.ceil(blocks.length / dailyLoads.length);
        let blockIndex = 0;
        for (const load of dailyLoads) {
            let dayCount = 0;
            while (blockIndex < blocks.length && dayCount < blocksPerDay) {
                const block = blocks[blockIndex];
                const minutes = this.loadInfo.estimateBlockMinutes(block);
                load.newCount++;
                load.newMinutes += minutes;
                blockIndex++;
                dayCount++;
            }
            this.updateLoadRate(load);
        }
    }
    /**
     * 均衡策略：基于负载率的水位填充算法（推荐默认）
     */
    distributeBalanced(blocks, dailyLoads, config) {
        const targetMinutes = this.loadInfo.dailyBudgetMinutes * config.targetLoadRate;
        for (const block of blocks) {
            const blockMinutes = this.loadInfo.estimateBlockMinutes(block);
            // 找到剩余容量最大的日期
            let bestDay = null;
            let maxSlack = -Infinity;
            for (const load of dailyLoads) {
                const currentTotal = load.existingMinutes + load.newMinutes;
                const slack = targetMinutes - currentTotal;
                // 如果这天还能装下这个块，并且剩余容量更大
                if (slack >= blockMinutes && slack > maxSlack) {
                    maxSlack = slack;
                    bestDay = load;
                }
            }
            // 如果找不到合适的日期，选择负载最低的
            if (!bestDay) {
                bestDay = dailyLoads.reduce((min, load) => {
                    const minTotal = min.existingMinutes + min.newMinutes;
                    const loadTotal = load.existingMinutes + load.newMinutes;
                    return loadTotal < minTotal ? load : min;
                });
            }
            // 分配到选中的日期
            bestDay.newCount++;
            bestDay.newMinutes += blockMinutes;
            this.updateLoadRate(bestDay);
        }
        // 如果启用每日最低保证，确保每天至少1个
        if (config.dailyMinimum) {
            this.ensureDailyMinimum(blocks, dailyLoads, config);
        }
    }
    /**
     * 尽快读策略：在不爆载前提下尽量靠前
     */
    distributeFrontLoaded(blocks, dailyLoads, config) {
        const targetMinutes = this.loadInfo.dailyBudgetMinutes * config.targetLoadRate;
        let blockIndex = 0;
        for (const load of dailyLoads) {
            if (blockIndex >= blocks.length)
                break;
            let dayMinutes = load.existingMinutes + load.newMinutes;
            while (blockIndex < blocks.length) {
                const block = blocks[blockIndex];
                const blockMinutes = this.loadInfo.estimateBlockMinutes(block);
                // 如果加上这个块会超过目标负载，跳到下一天
                if (dayMinutes + blockMinutes > targetMinutes) {
                    break;
                }
                load.newCount++;
                load.newMinutes += blockMinutes;
                dayMinutes += blockMinutes;
                blockIndex++;
            }
            this.updateLoadRate(load);
        }
        // 处理剩余的块（如果前面的天数都满了）
        if (blockIndex < blocks.length) {
            // 分配到负载最低的日期
            const remainingBlocks = blocks.slice(blockIndex);
            this.distributeBalanced(remainingBlocks, dailyLoads, config);
        }
    }
    /**
     * 确保每天至少有1个内容块
     */
    ensureDailyMinimum(blocks, dailyLoads, config) {
        for (const load of dailyLoads) {
            if (load.newCount === 0 && blocks.length > 0) {
                // 从负载最高的日期转移1个块过来
                const sourceDay = dailyLoads
                    .filter(l => l.newCount > 1)
                    .sort((a, b) => b.loadRate - a.loadRate)[0];
                if (sourceDay) {
                    // 简化处理：转移估计的平均时间
                    const avgMinutes = sourceDay.newMinutes / sourceDay.newCount;
                    sourceDay.newCount--;
                    sourceDay.newMinutes -= avgMinutes;
                    load.newCount++;
                    load.newMinutes += avgMinutes;
                    this.updateLoadRate(sourceDay);
                    this.updateLoadRate(load);
                }
            }
        }
    }
    /**
     * 更新负载率
     */
    updateLoadRate(load) {
        const totalMinutes = load.existingMinutes + load.newMinutes;
        load.loadRate = totalMinutes / this.loadInfo.dailyBudgetMinutes;
        load.isOverloaded = load.loadRate >= 1.0;
    }
    /**
     * 计算分散影响评估
     */
    calculateImpact(dailyLoads, contentBlocks) {
        const overloadedDays = dailyLoads.filter(l => l.isOverloaded).length;
        const peakLoadRate = Math.max(...dailyLoads.map(l => l.loadRate));
        const averageLoadRate = dailyLoads.reduce((sum, l) => sum + l.loadRate, 0) / dailyLoads.length;
        const totalNewHours = dailyLoads.reduce((sum, l) => sum + l.newMinutes, 0) / 60;
        const suggestions = [];
        // 生成建议
        if (overloadedDays > dailyLoads.length * 0.3) {
            suggestions.push('建议延长分散天数或降低导入优先级');
        }
        if (peakLoadRate > 1.5) {
            suggestions.push(`峰值负载过高(${Math.round(peakLoadRate * 100)}%)，建议调整策略`);
        }
        if (averageLoadRate < 0.3) {
            suggestions.push('平均负载较低，可以缩短分散天数');
        }
        return {
            dailyLoads,
            overloadedDays,
            peakLoadRate,
            averageLoadRate,
            totalNewHours,
            suggestions
        };
    }
    /**
     * 应用分散计划到内容块
     */
    applyScheduling(contentBlocks, impact) {
        const assignments = new Map();
        let blockIndex = 0;
        for (const load of impact.dailyLoads) {
            for (let i = 0; i < load.newCount && blockIndex < contentBlocks.length; i++) {
                assignments.set(contentBlocks[blockIndex], load.date);
                blockIndex++;
            }
        }
        return assignments;
    }
}
