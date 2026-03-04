/**
 * 考试正确率科学计算器
 *
 * 基于EWMA（指数加权移动平均）算法
 * 科学依据：
 * - 学习曲线理论：近期表现更能反映当前能力
 * - 近因效应（Recency Effect）：最近的测试结果权重更大
 * - 形成性评估理论：评估"当前是否掌握"而非"历史平均"
 *
 * 核心公式：R_t = α × result_t + (1-α) × R_{t-1}
 *
 * @author Weave Team
 * @version 2.0.0
 * @since 2025-01-24
 */
export class AccuracyCalculator {
    // ===== 配置参数 =====
    /** 基准衰减因子 (0.1-0.3)，控制历史数据影响程度 */
    BASE_ALPHA = 0.2;
    /** 模式权重：不同测试模式的重要性系数 */
    MODE_WEIGHTS = {
        exam: 1.5, // 考试模式：权重最高，快速反映变化
        quiz: 1.2, // 测验模式：中等权重
        practice: 1.0 // 练习模式：基准权重
    };
    /** 先验掌握度：初始假设（无数据时） */
    PRIOR_MASTERY = 0.5;
    /** 置信度参数：控制样本量到置信度的映射 */
    CONFIDENCE_SCALE = 20; // n=20时置信度约63%
    // ===== 公开方法 =====
    /**
     * 计算完整的掌握度指标
     *
     * @param history 测试历史记录
     * @returns 掌握度指标
     */
    calculateMastery(history) {
        // 0. 数据验证
        if (!history || history.length === 0) {
            return this.getDefaultMetrics();
        }
        // 1. EWMA正确率（当前掌握度）
        const currentAccuracy = this.calculateEWMA(history);
        // 2. 简单平均正确率（历史对比）
        const historicalAccuracy = this.calculateSimpleAverage(history);
        // 3. 置信度
        const confidence = this.calculateConfidence(history.length);
        // 4. 掌握状态
        const consecutiveCorrect = this.getConsecutiveCorrect(history);
        const status = this.determineStatus(currentAccuracy, confidence, consecutiveCorrect);
        // 5. 趋势分析
        const trend = this.analyzeTrend(history);
        // 6. 有效样本量
        const effectiveSampleSize = Math.round(1 / this.BASE_ALPHA);
        // 7. 最近正确率（最近5次）
        const recentAccuracy = this.calculateRecentAccuracy(history, 5);
        return {
            currentAccuracy: this.toPercentage(currentAccuracy),
            historicalAccuracy: this.toPercentage(historicalAccuracy),
            confidence,
            status,
            trend,
            effectiveSampleSize,
            totalAttempts: history.length,
            consecutiveCorrect,
            recentAccuracy: this.toPercentage(recentAccuracy)
        };
    }
    // ===== 核心算法 =====
    /**
     * EWMA算法：指数加权移动平均
     *
     * 公式：R_t = α × result_t + (1-α) × R_{t-1}
     * 其中：
     * - α: 衰减因子（可根据模式调整）
     * - result_t: 当前测试结果（0或1）
     * - R_{t-1}: 前一次的正确率
     *
     * 特性：
     * - 近期权重大：α^1, α^2, α^3, ... 指数衰减
     * - 自动遗忘：早期错误的影响随时间减弱
     * - 平滑变化：避免单次测试的剧烈波动
     */
    calculateEWMA(history) {
        let accuracy = this.PRIOR_MASTERY; // 先验：假设初始50%
        for (const attempt of history) {
            // 动态α：根据测试模式调整
            const modeWeight = this.MODE_WEIGHTS[attempt.mode] || 1.0;
            const alpha = this.BASE_ALPHA * modeWeight;
            // EWMA递推公式
            const score = attempt.isCorrect ? 1 : 0;
            accuracy = alpha * score + (1 - alpha) * accuracy;
        }
        return accuracy;
    }
    /**
     * 简单平均正确率（保留用于对比）
     */
    calculateSimpleAverage(history) {
        const correct = history.filter(a => a.isCorrect).length;
        return history.length > 0 ? correct / history.length : 0;
    }
    /**
     * 置信度计算
     *
     * 使用Sigmoid函数：1 - exp(-n / scale)
     * - n小时：置信度低（数据不足）
     * - n大时：置信度接近1（数据充分）
     *
     * 示例（scale=20）：
     * - n=5:  22%
     * - n=10: 39%
     * - n=20: 63%
     * - n=50: 92%
     */
    calculateConfidence(sampleSize) {
        return 1 - Math.exp(-sampleSize / this.CONFIDENCE_SCALE);
    }
    /**
     * 确定掌握状态
     *
     * 综合考虑：
     * 1. 当前正确率
     * 2. 置信度（样本量）
     * 3. 连续正确次数
     */
    determineStatus(accuracy, confidence, consecutiveCorrect) {
        // 数据不足
        if (confidence < 0.5) {
            return 'insufficient_data';
        }
        // 精通：高正确率 + 连续正确
        if (accuracy >= 0.9 && consecutiveCorrect >= 3) {
            return 'mastered';
        }
        // 按正确率分级
        if (accuracy >= 0.75)
            return 'proficient';
        if (accuracy >= 0.60)
            return 'learning';
        if (accuracy >= 0.40)
            return 'struggling';
        return 'needs_review';
    }
    /**
     * 趋势分析
     *
     * 方法：比较前半部分和后半部分的平均正确率
     * - 差异>10%：明显趋势
     * - 差异<10%：稳定
     */
    analyzeTrend(history) {
        if (history.length < 5) {
            return { direction: 'unknown', strength: 0 };
        }
        const mid = Math.floor(history.length / 2);
        const firstHalf = history.slice(0, mid);
        const secondHalf = history.slice(mid);
        const firstAvg = this.calculateSimpleAverage(firstHalf);
        const secondAvg = this.calculateSimpleAverage(secondHalf);
        const diff = secondAvg - firstAvg;
        const threshold = 0.1; // 10%阈值
        if (Math.abs(diff) < threshold) {
            return { direction: 'stable', strength: 0 };
        }
        else if (diff > 0) {
            return { direction: 'improving', strength: diff };
        }
        else {
            return { direction: 'declining', strength: Math.abs(diff) };
        }
    }
    // ===== 辅助方法 =====
    /**
     * 获取连续正确次数（从最近往前数）
     */
    getConsecutiveCorrect(history) {
        let count = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].isCorrect) {
                count++;
            }
            else {
                break;
            }
        }
        return count;
    }
    /**
     * 计算最近N次的正确率
     */
    calculateRecentAccuracy(history, n) {
        if (history.length === 0)
            return 0;
        const recent = history.slice(-n);
        return this.calculateSimpleAverage(recent);
    }
    /**
     * 转换为百分制（保留1位小数）
     */
    toPercentage(ratio) {
        return Math.round(ratio * 1000) / 10;
    }
    /**
     * 获取默认指标（无数据时）
     */
    getDefaultMetrics() {
        return {
            currentAccuracy: 0,
            historicalAccuracy: 0,
            confidence: 0,
            status: 'insufficient_data',
            trend: { direction: 'unknown', strength: 0 },
            effectiveSampleSize: Math.round(1 / this.BASE_ALPHA),
            totalAttempts: 0,
            consecutiveCorrect: 0,
            recentAccuracy: 0
        };
    }
}
// 导出单例
export const accuracyCalculator = new AccuracyCalculator();
