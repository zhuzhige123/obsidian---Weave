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
import type { TestAttempt, MasteryMetrics } from '../../types/question-bank-types';
export declare class AccuracyCalculator {
    /** 基准衰减因子 (0.1-0.3)，控制历史数据影响程度 */
    private readonly BASE_ALPHA;
    /** 模式权重：不同测试模式的重要性系数 */
    private readonly MODE_WEIGHTS;
    /** 先验掌握度：初始假设（无数据时） */
    private readonly PRIOR_MASTERY;
    /** 置信度参数：控制样本量到置信度的映射 */
    private readonly CONFIDENCE_SCALE;
    /**
     * 计算完整的掌握度指标
     *
     * @param history 测试历史记录
     * @returns 掌握度指标
     */
    calculateMastery(history: TestAttempt[]): MasteryMetrics;
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
    private calculateEWMA;
    /**
     * 简单平均正确率（保留用于对比）
     */
    private calculateSimpleAverage;
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
    private calculateConfidence;
    /**
     * 确定掌握状态
     *
     * 综合考虑：
     * 1. 当前正确率
     * 2. 置信度（样本量）
     * 3. 连续正确次数
     */
    private determineStatus;
    /**
     * 趋势分析
     *
     * 方法：比较前半部分和后半部分的平均正确率
     * - 差异>10%：明显趋势
     * - 差异<10%：稳定
     */
    private analyzeTrend;
    /**
     * 获取连续正确次数（从最近往前数）
     */
    private getConsecutiveCorrect;
    /**
     * 计算最近N次的正确率
     */
    private calculateRecentAccuracy;
    /**
     * 转换为百分制（保留1位小数）
     */
    private toPercentage;
    /**
     * 获取默认指标（无数据时）
     */
    private getDefaultMetrics;
}
export declare const accuracyCalculator: AccuracyCalculator;
