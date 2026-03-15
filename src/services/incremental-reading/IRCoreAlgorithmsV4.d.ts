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
import type { IRBlockV4, IRBlockStats, IRPriorityLogEntry } from '../../types/ir-types';
/** EWMA 平滑系数 alpha，默认 0.3 */
export declare const EWMA_ALPHA = 0.3;
/** 基础扩张乘子 M_base */
export declare const M_BASE = 1.5;
/** 最小间隔（天） I_min */
export declare const I_MIN = 1;
/** 最大间隔（天） I_max */
export declare const I_MAX = 3650;
/** 平均阅读速度（字/分） */
export declare const SPEED_AVG = 300;
/** 超时暂停阈值（秒） */
export declare const TIMEOUT_SECONDS = 300;
/** Aging 斜率 */
export declare const AGE_SLOPE = 0.1;
/** Aging 上限 */
export declare const AGE_CAP = 2;
/** Aging 强度三级配置（与 V3 IRQueueGenerator 对齐） */
export declare const AGING_STRENGTH_CONFIG: Record<'low' | 'medium' | 'high', {
    slope: number;
    cap: number;
}>;
/** 优先级中性点 p0 */
export declare const PRIORITY_NEUTRAL = 5;
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
export declare function calculatePriorityEWMA(priorityUi: number, priorityEffOld: number, alphaOrHalfLife?: number, lastUpdatedMs?: number): number;
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
export declare function calculatePriorityEWMATimeAware(priorityUi: number, priorityEffOld: number, lastPriorityUpdateMs: number, alphaBase?: number, deltaRefMs?: number): number;
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
export declare function calculatePsi(p: number): number;
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
export declare function calculateNextInterval(iCurr: number, mBase?: number, mGroup?: number, pEff?: number, iMax?: number): number;
/**
 * 计算下次复习时间戳
 *
 * @param intervalDays 间隔（天）
 * @returns ms timestamp
 */
export declare function calculateNextRepDate(intervalDays: number): number;
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
export declare function estimateCost(wordCount: number, speedAvg?: number, bufferMin?: number): number;
/**
 * 从内容块估算阅读成本
 *
 * @param block 内容块
 * @param defaultMinutes 默认分钟数（无历史数据时）
 * @returns 预估成本（分钟）
 */
export declare function estimateBlockCost(block: IRBlockV4, defaultMinutes?: number): number;
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
export declare function calculateAgeBoost(lastShownAtMs: number, ageSlopeOrStrength?: number | 'low' | 'medium' | 'high', ageCap?: number): number;
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
export declare function calculateEngageBoost(stats: IRBlockStats, kEngage?: number, r0?: number): number;
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
export declare function calculateSelectionScore(block: IRBlockV4, currentSourcePath?: string | null, switchPenalty?: number, agingStrength?: 'low' | 'medium' | 'high'): number;
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
export declare function calculateEffectiveReadingTime(rawSeconds: number, wordCount: number, speedAvg?: number, maxRatio?: number): number;
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
export declare function isLowQualityTime(rawSeconds: number, wordCount: number, outputCount: number, threshold?: number): boolean;
/**
 * 创建优先级变更日志条目
 *
 * @param oldP 旧优先级
 * @param newP 新优先级
 * @param reason 变更理由（必填）
 * @returns 日志条目
 */
export declare function createPriorityLogEntry(oldP: number, newP: number, reason: string): IRPriorityLogEntry;
/**
 * 检查是否触发超时暂停
 *
 * @param lastInteractionMs 最后交互时间 (ms)
 * @param timeoutSeconds 超时阈值（秒），默认 300
 * @returns 是否超时
 */
export declare function checkTimeoutPause(lastInteractionMs: number, timeoutSeconds?: number): boolean;
/**
 * 破产保护检测条件
 */
export interface BankruptcyCheckResult {
    /** 是否触发破产保护 */
    triggered: boolean;
    /** 高优过期数量 */
    highPriorityOverdueCount: number;
    /** 积压天数 */
    backlogDays: number;
    /** 建议操作 */
    suggestion: string;
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
export declare function checkBankruptcy(blocks: IRBlockV4[], highPriorityThreshold?: number, overdueThreshold?: number, countThreshold?: number): BankruptcyCheckResult;
