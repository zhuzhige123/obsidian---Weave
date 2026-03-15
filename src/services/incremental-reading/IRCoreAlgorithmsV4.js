/**
 * 增量阅读核心算法 v4.0
 *
 * 对齐《增量阅读-算法实施权威规范.md》的权威实现
 *
 * 包含：
 * - EWMA 优先级平滑（Section 4.2）
 * - 变速函数 Ψ(p)（Section 5.1）
 * - 间隔计算（Section 5.2）
 * - 选择分数计算（Section 7）
 * - 有效时长过滤（Section 8）
 *
 * @module services/incremental-reading/IRCoreAlgorithmsV4
 * @version 4.0.0
 */
// ============================================
// 常量配置（权威规范 Section 11）
// ============================================
/** EWMA 平滑系数 alpha，默认 0.3 */
export const EWMA_ALPHA = 0.3;
/** 基础扩张乘子 M_base */
export const M_BASE = 1.5;
/** 最小间隔（天） I_min */
export const I_MIN = 1;
/** 最大间隔（天） I_max */
export const I_MAX = 3650;
/** 平均阅读速度（字/分） */
export const SPEED_AVG = 300;
/** 超时暂停阈值（秒） */
export const TIMEOUT_SECONDS = 300;
/** Aging 斜率 */
export const AGE_SLOPE = 0.1;
/** Aging 上限 */
export const AGE_CAP = 2.0;
/** Aging 强度三级配置（与 V3 IRQueueGenerator 对齐） */
export const AGING_STRENGTH_CONFIG = {
    low: { slope: 0.036, cap: 0.5 }, // halfLife≈14d: slope≈ln2/14≈0.05, 但线性近似取小值
    medium: { slope: 0.1, cap: 1.0 }, // halfLife≈7d
    high: { slope: 0.23, cap: 2.0 } // halfLife≈3d
};
/** 优先级中性点 p0 */
export const PRIORITY_NEUTRAL = 5;
// ============================================
// Section 4.2: EWMA 优先级平滑
// ============================================
/**
 * 计算 EWMA 平滑优先级（权威公式）
 *
 * 基础模式: P_eff^(t) = α × P_ui^(t) + (1-α) × P_eff^(t-1)
 * 时间感知模式: decay = 2^(-Δt / halfLifeDays), P_eff = (1-decay) × P_ui + decay × P_eff_old
 *
 * @param priorityUi 本次滑条值 (0-10)
 * @param priorityEffOld 旧有效优先级 (0-10)
 * @param alphaOrHalfLife EWMA 系数（默认 0.3），或当 lastUpdatedMs 存在时作为 halfLifeDays（天）
 * @param lastUpdatedMs 上次更新时间戳 (ms)，提供时启用时间感知模式
 * @returns 新的有效优先级 (0-10)
 */
export function calculatePriorityEWMA(priorityUi, priorityEffOld, alphaOrHalfLife = EWMA_ALPHA, lastUpdatedMs) {
    let priorityEffNew;
    if (lastUpdatedMs !== undefined && lastUpdatedMs > 0) {
        // 时间感知模式: decay = 2^(-Δt / halfLifeDays)
        const halfLifeDays = alphaOrHalfLife;
        const now = Date.now();
        const deltaTimeDays = (now - lastUpdatedMs) / (1000 * 60 * 60 * 24);
        const decay = Math.pow(2, -deltaTimeDays / halfLifeDays);
        priorityEffNew = (1 - decay) * priorityUi + decay * priorityEffOld;
    }
    else {
        // 固定 alpha 模式
        const alpha = alphaOrHalfLife;
        priorityEffNew = alpha * priorityUi + (1 - alpha) * priorityEffOld;
    }
    // clamp 到 [0, 10]
    return Math.max(0, Math.min(10, priorityEffNew));
}
/**
 * 计算 Time-aware EWMA（可选增强版）
 *
 * α_eff = 1 - (1-α_base)^(Δt/Δt_ref)
 *
 * @param priorityUi 本次滑条值 (0-10)
 * @param priorityEffOld 旧有效优先级 (0-10)
 * @param lastPriorityUpdateMs 上次更新时间 (ms timestamp)
 * @param alphaBase 基础 alpha，默认 0.3
 * @param deltaRefMs 参考周期，默认 1 天
 * @returns 新的有效优先级 (0-10)
 */
export function calculatePriorityEWMATimeAware(priorityUi, priorityEffOld, lastPriorityUpdateMs, alphaBase = EWMA_ALPHA, deltaRefMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const deltaT = now - lastPriorityUpdateMs;
    // α_eff = 1 - (1-α_base)^(Δt/Δt_ref)
    const alphaEff = 1 - Math.pow(1 - alphaBase, deltaT / deltaRefMs);
    // EWMA 计算
    const priorityEffNew = alphaEff * priorityUi + (1 - alphaEff) * priorityEffOld;
    return Math.max(0, Math.min(10, priorityEffNew));
}
// ============================================
// Section 5.1: 变速函数 Ψ(p)
// ============================================
/**
 * 计算变速函数 Ψ(p)（权威实现）
 *
 * Ψ(p) = 1.0 - (p-5)/5 × 0.6,  p > 5  → 取值 0.4~1.0
 * Ψ(p) = 1.0,                   p = 5
 * Ψ(p) = 1.0 + (5-p)/5 × 2.0,  p < 5  → 取值 1.0~3.0
 *
 * 总取值范围: 0.4 ~ 3.0
 *
 * @param p 有效优先级 P_eff (0-10)
 * @returns 变速系数 (0.4-3.0)
 */
export function calculatePsi(p) {
    const p0 = PRIORITY_NEUTRAL;
    if (p > p0) {
        // 高优先级：缩短间隔
        // Ψ(p) = 1.0 - (p-5)/5 × 0.6
        return 1.0 - ((p - p0) / 5) * 0.6;
    }
    else if (p < p0) {
        // 低优先级：拉长间隔
        // Ψ(p) = 1.0 + (5-p)/5 × 2.0
        return 1.0 + ((p0 - p) / 5) * 2.0;
    }
    else {
        // 中性点
        return 1.0;
    }
}
// ============================================
// Section 5.2: 间隔计算
// ============================================
/**
 * 计算下次间隔（权威公式）
 *
 * I_next = Clamp(I_curr × M_base × M_group × Ψ(P_eff), I_min, I_max)
 *
 * @param iCurr 当前间隔（天）
 * @param mBase 基础扩张乘子，默认 1.5
 * @param mGroup TagGroup 类型节奏系数
 * @param pEff 有效优先级 (0-10)
 * @returns 下次间隔（天）
 */
export function calculateNextInterval(iCurr, mBase = M_BASE, mGroup = 1.0, pEff = PRIORITY_NEUTRAL, iMax = I_MAX) {
    // 新块规则：若 I_curr = 0，则 I_next = 1
    if (iCurr === 0) {
        return I_MIN;
    }
    const psi = calculatePsi(pEff);
    const iNext = iCurr * mBase * mGroup * psi;
    // Clamp 到 [I_min, iMax]
    return Math.max(I_MIN, Math.min(iMax, iNext));
}
/**
 * 计算下次复习时间戳
 *
 * @param intervalDays 间隔（天）
 * @returns ms timestamp
 */
export function calculateNextRepDate(intervalDays) {
    const now = Date.now();
    return now + intervalDays * 24 * 60 * 60 * 1000;
}
// ============================================
// Section 6.2: 成本估计
// ============================================
/**
 * 估算内容块阅读成本（分钟）
 *
 * Cost(B) = WordCount(B)/Speed_avg + Buffer_min
 *
 * @param wordCount 块字数
 * @param speedAvg 平均阅读速度（字/分），默认 300
 * @param bufferMin 固定缓冲（分钟），默认 1
 * @returns 预估成本（分钟）
 */
export function estimateCost(wordCount, speedAvg = SPEED_AVG, bufferMin = 1) {
    return wordCount / speedAvg + bufferMin;
}
/**
 * 从内容块估算阅读成本
 *
 * @param block 内容块
 * @param defaultMinutes 默认分钟数（无历史数据时）
 * @returns 预估成本（分钟）
 */
export function estimateBlockCost(block, defaultMinutes = 2) {
    // 如果有历史数据，使用平均值
    if (block.stats.impressions > 0 && block.stats.effectiveReadingTimeSec > 0) {
        return (block.stats.effectiveReadingTimeSec / block.stats.impressions) / 60;
    }
    return defaultMinutes;
}
// ============================================
// Section 7: 候选块选择分数
// ============================================
/**
 * 计算 Aging 加分（防饿死）
 *
 * AgeBoost = min(ageCap, ageSlope × waitingDays)
 *
 * @param lastShownAtMs 最后展示时间 (ms timestamp)
 * @param ageSlopeOrStrength 斜率数值，或 'low'|'medium'|'high' 强度级别
 * @param ageCap 上限（仅在 ageSlopeOrStrength 为数值时生效）
 * @returns Aging 加分
 */
export function calculateAgeBoost(lastShownAtMs, ageSlopeOrStrength = AGE_SLOPE, ageCap = AGE_CAP) {
    if (lastShownAtMs === 0)
        return 0;
    let slope;
    let cap;
    if (typeof ageSlopeOrStrength === 'string') {
        const cfg = AGING_STRENGTH_CONFIG[ageSlopeOrStrength];
        slope = cfg.slope;
        cap = cfg.cap;
    }
    else {
        slope = ageSlopeOrStrength;
        cap = ageCap;
    }
    const now = Date.now();
    const waitingDays = (now - lastShownAtMs) / (24 * 60 * 60 * 1000);
    return Math.min(cap, slope * waitingDays);
}
/**
 * 计算投入加成 EngageBoost
 *
 * EngageRate = outputCount / max(1, minutes)
 * EngageBoost = Clamp(k_engage × (EngageRate - r0), 0, 2.0)
 *
 * @param stats 内容块统计
 * @param kEngage 映射系数，默认 1.0
 * @param r0 阈值，默认 0.2
 * @returns EngageBoost 加分
 */
export function calculateEngageBoost(stats, kEngage = 1.0, r0 = 0.2) {
    const outputCount = stats.extracts + stats.cardsCreated + stats.notesWritten;
    const minutes = Math.max(1, stats.effectiveReadingTimeSec / 60);
    const engageRate = outputCount / minutes;
    const boost = kEngage * (engageRate - r0);
    return Math.max(0, Math.min(2.0, boost));
}
/**
 * 计算基础选择分数（组内排序）
 *
 * Score(B) = P_eff(B) + AgeBoost(B) + EngageBoost(B) - SwitchPenalty(B)
 *
 * @param block 内容块
 * @param currentSourcePath 当前展示的源文件路径（用于切换惩罚）
 * @param switchPenalty 切换惩罚值，默认 0.5
 * @returns 选择分数
 */
export function calculateSelectionScore(block, currentSourcePath = null, switchPenalty = 0.5, agingStrength = 'low') {
    const pEff = block.priorityEff;
    const ageBoost = calculateAgeBoost(block.stats.lastShownAt, agingStrength);
    const engageBoost = calculateEngageBoost(block.stats);
    // 切换成本（软约束）
    let penalty = 0;
    if (currentSourcePath && block.sourcePath !== currentSourcePath) {
        // 检查是否为 siblings
        const isSibling = block.meta.siblings.prev === currentSourcePath ||
            block.meta.siblings.next === currentSourcePath;
        if (!isSibling) {
            penalty = switchPenalty;
        }
    }
    return pEff + ageBoost + engageBoost - penalty;
}
// ============================================
// Section 8: 有效时长过滤
// ============================================
/**
 * 计算有效阅读时长（过滤噪音）
 *
 * T_expected = WordCount/Speed_avg
 * T_effective = min(T_raw, 1.5 × T_expected)
 *
 * @param rawSeconds 原始阅读时长（秒）
 * @param wordCount 内容字数
 * @param speedAvg 平均阅读速度（字/分），默认 300
 * @param maxRatio 最大比例，默认 1.5
 * @returns 有效时长（秒）
 */
export function calculateEffectiveReadingTime(rawSeconds, wordCount, speedAvg = SPEED_AVG, maxRatio = 1.5) {
    // T_expected（秒）
    const tExpected = (wordCount / speedAvg) * 60;
    // T_effective = min(T_raw, 1.5 × T_expected)
    const tEffective = Math.min(rawSeconds, maxRatio * tExpected);
    return Math.max(0, tEffective);
}
/**
 * 判断是否为低质量时长
 * 若 T_raw 远超上限且交互产出为 0，则认定为低质量
 *
 * @param rawSeconds 原始时长（秒）
 * @param wordCount 内容字数
 * @param outputCount 交互产出数量
 * @param threshold 超出比例阈值，默认 2.0
 * @returns 是否低质量
 */
export function isLowQualityTime(rawSeconds, wordCount, outputCount, threshold = 2.0) {
    const tExpected = (wordCount / SPEED_AVG) * 60;
    return rawSeconds > threshold * tExpected && outputCount === 0;
}
// ============================================
// Section 9: 安全机制辅助
// ============================================
/**
 * 创建优先级变更日志条目
 *
 * @param oldP 旧优先级
 * @param newP 新优先级
 * @param reason 变更理由（必填）
 * @returns 日志条目
 */
export function createPriorityLogEntry(oldP, newP, reason) {
    if (!reason || reason.trim().length === 0) {
        throw new Error('[IRCoreAlgorithmsV4] 优先级变更必须提供理由');
    }
    return {
        ts: Date.now(),
        oldP,
        newP,
        reason: reason.trim()
    };
}
/**
 * 检查是否触发超时暂停
 *
 * @param lastInteractionMs 最后交互时间 (ms)
 * @param timeoutSeconds 超时阈值（秒），默认 300
 * @returns 是否超时
 */
export function checkTimeoutPause(lastInteractionMs, timeoutSeconds = TIMEOUT_SECONDS) {
    const now = Date.now();
    const elapsedSeconds = (now - lastInteractionMs) / 1000;
    return elapsedSeconds > timeoutSeconds;
}
/**
 * 检查是否触发破产保护
 *
 * 触发条件（任一满足）：
 * - Count(status='scheduled' & P_eff >= 8 & OverdueDays > 7) > 20
 * - BacklogDaysHigh > 7
 *
 * @param blocks 所有内容块
 * @param highPriorityThreshold 高优先级阈值，默认 8
 * @param overdueThreshold 过期天数阈值，默认 7
 * @param countThreshold 数量阈值，默认 20
 * @returns 检测结果
 */
export function checkBankruptcy(blocks, highPriorityThreshold = 8, overdueThreshold = 7, countThreshold = 20) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let highPriorityOverdueCount = 0;
    for (const block of blocks) {
        if (block.status === 'scheduled' && block.priorityEff >= highPriorityThreshold) {
            const overdueDays = (now - block.nextRepDate) / oneDayMs;
            if (overdueDays > overdueThreshold) {
                highPriorityOverdueCount++;
            }
        }
    }
    const triggered = highPriorityOverdueCount > countThreshold;
    return {
        triggered,
        highPriorityOverdueCount,
        backlogDays: overdueThreshold,
        suggestion: triggered
            ? `建议：批量将 ${highPriorityOverdueCount} 个高优积压项降至优先级 5，或挂起/归档一批`
            : ''
    };
}
