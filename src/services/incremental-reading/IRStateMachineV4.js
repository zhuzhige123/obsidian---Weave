/**
 * 增量阅读状态机 v4.1
 *
 * 7 状态定义：
 * - new: 刚导入/刚解析，尚未完成初始化
 * - queued: 已计算 nextRepDate，但尚未到期
 * - scheduled: 已到期，进入候选池
 * - active: 正在 IR 界面展示
 * - suspended: 用户搁置（可恢复）
 * - done: 归档（用户已完全理解）
 * - removed: 移除（从队列永久移除，保留历史）
 *
 * @module services/incremental-reading/IRStateMachineV4
 * @version 4.1.0
 */
import { calculateNextInterval, calculateNextRepDate, createPriorityLogEntry, calculatePriorityEWMA, calculatePriorityEWMATimeAware } from './IRCoreAlgorithmsV4';
import { logger } from '../../utils/logger';
// ============================================
// 状态机错误类型
// ============================================
export class InvalidStateTransitionError extends Error {
    constructor(from, to, reason) {
        super(`无效的状态迁移: ${from} → ${to}${reason ? ` (${reason})` : ''}`);
        this.name = 'InvalidStateTransitionError';
    }
}
// ============================================
// 状态迁移规则（权威规范 Section 3.2）
// ============================================
/**
 * 有效的状态迁移映射
 */
const VALID_TRANSITIONS = {
    'new': ['queued'],
    'queued': ['scheduled', 'suspended', 'removed'],
    'scheduled': ['active', 'suspended', 'removed'],
    'active': ['queued', 'done', 'suspended', 'removed'],
    'suspended': ['queued'],
    'done': [],
    'removed': []
};
/**
 * 检查状态迁移是否有效
 */
export function isValidTransition(from, to) {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
// ============================================
// IRStateMachineV4 类
// ============================================
export class IRStateMachineV4 {
    /**
     * new → queued: 初始化完成且写入 nextRepDate
     *
     * @param block 内容块
     * @param initialIntervalDays 初始间隔（天），默认 1
     * @returns 更新后的内容块
     */
    transitionToQueued(block, initialIntervalDays = 1) {
        if (block.status !== 'new') {
            throw new InvalidStateTransitionError(block.status, 'queued');
        }
        const now = Date.now();
        const nextRepDate = calculateNextRepDate(initialIntervalDays);
        logger.debug(`[IRStateMachineV4] ${block.id}: new → queued, interval=${initialIntervalDays}d`);
        return {
            ...block,
            status: 'queued',
            intervalDays: initialIntervalDays,
            nextRepDate,
            updatedAt: now
        };
    }
    /**
     * queued → scheduled: 当 nextRepDate <= now
     *
     * 此方法会检查是否满足迁移条件
     *
     * @param block 内容块
     * @returns 更新后的内容块（如果满足条件）或原块
     */
    checkAndTransitionToScheduled(block) {
        if (block.status !== 'queued') {
            return block;
        }
        const now = Date.now();
        if (block.nextRepDate <= now) {
            logger.debug(`[IRStateMachineV4] ${block.id}: queued → scheduled (到期)`);
            return {
                ...block,
                status: 'scheduled',
                updatedAt: now
            };
        }
        return block;
    }
    /**
     * scheduled → active: 被会话选中并展示
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    transitionToActive(block) {
        if (block.status !== 'scheduled') {
            throw new InvalidStateTransitionError(block.status, 'active');
        }
        const now = Date.now();
        logger.debug(`[IRStateMachineV4] ${block.id}: scheduled → active`);
        return {
            ...block,
            status: 'active',
            stats: {
                ...block.stats,
                lastShownAt: now,
                impressions: block.stats.impressions + 1
            },
            updatedAt: now
        };
    }
    /**
     * active → queued: 用户点 Next（未完成/继续增量处理）
     *
     * @param block 内容块
     * @param mBase 基础扩张乘子
     * @param mGroup TagGroup 系数
     * @returns 更新后的内容块
     */
    transitionBackToQueued(block, mBase = 1.5, mGroup = 1.0, maxInterval) {
        if (block.status !== 'active') {
            throw new InvalidStateTransitionError(block.status, 'queued');
        }
        const now = Date.now();
        // 计算新间隔
        const newInterval = calculateNextInterval(block.intervalDays, mBase, mGroup, block.priorityEff, maxInterval);
        // nextRepDate 单调更新（不得回退到过去）
        const newNextRepDate = Math.max(now, calculateNextRepDate(newInterval));
        logger.debug(`[IRStateMachineV4] ${block.id}: active → queued, ` +
            `interval=${newInterval.toFixed(2)}d, pEff=${block.priorityEff.toFixed(2)}`);
        return {
            ...block,
            status: 'queued',
            intervalDays: newInterval,
            nextRepDate: newNextRepDate,
            updatedAt: now
        };
    }
    /**
     * active → done: 归档（用户已完全理解）
     *
     * @param block 内容块
     * @param reason 完成原因
     * @returns 更新后的内容块
     */
    transitionToDone(block, reason = 'archived') {
        if (block.status !== 'active') {
            throw new InvalidStateTransitionError(block.status, 'done');
        }
        const now = Date.now();
        logger.debug(`[IRStateMachineV4] ${block.id}: active → done (${reason})`);
        return {
            ...block,
            status: 'done',
            doneReason: reason,
            doneAt: now,
            updatedAt: now
        };
    }
    /**
     * → suspended: 搁置（从 active/queued/scheduled 均可搁置）
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    transitionToSuspended(block) {
        if (!isValidTransition(block.status, 'suspended')) {
            throw new InvalidStateTransitionError(block.status, 'suspended');
        }
        const now = Date.now();
        logger.debug(`[IRStateMachineV4] ${block.id}: ${block.status} → suspended`);
        return {
            ...block,
            status: 'suspended',
            updatedAt: now
        };
    }
    /**
     * → removed: 移除（从 active/queued/scheduled 均可移除）
     *
     * @param block 内容块
     * @param reason 移除原因
     * @returns 更新后的内容块
     */
    transitionToRemoved(block) {
        if (!isValidTransition(block.status, 'removed')) {
            throw new InvalidStateTransitionError(block.status, 'removed');
        }
        const now = Date.now();
        logger.debug(`[IRStateMachineV4] ${block.id}: ${block.status} → removed`);
        return {
            ...block,
            status: 'removed',
            doneReason: 'removed',
            doneAt: now,
            updatedAt: now
        };
    }
    /**
     * suspended → queued: 用户恢复搁置后重新入队
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    resumeFromSuspended(block) {
        if (block.status !== 'suspended') {
            throw new InvalidStateTransitionError(block.status, 'queued');
        }
        const now = Date.now();
        logger.debug(`[IRStateMachineV4] ${block.id}: suspended → queued (恢复)`);
        return {
            ...block,
            status: 'queued',
            nextRepDate: now, // 立即到期
            updatedAt: now
        };
    }
    /**
     * 强制恢复：从 done/removed 重新激活到 queued
     * 这不是常规状态迁移，而是管理操作
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    forceReactivate(block) {
        if (block.status !== 'done' && block.status !== 'removed') {
            throw new InvalidStateTransitionError(block.status, 'queued', '强制恢复仅适用于 done/removed 状态');
        }
        const now = Date.now();
        logger.debug(`[IRStateMachineV4] ${block.id}: ${block.status} → queued (强制恢复)`);
        return {
            ...block,
            status: 'queued',
            doneReason: undefined,
            doneAt: undefined,
            nextRepDate: now,
            updatedAt: now
        };
    }
    /**
     * 更新优先级（带强制理由）
     *
     * @param block 内容块
     * @param newPriorityUi 新优先级 (0-10)
     * @param reason 变更理由（必填）
     * @param useTimeAwareEWMA 是否使用 time-aware EWMA
     * @returns 更新后的内容块
     */
    updatePriority(block, newPriorityUi, reason, useTimeAwareEWMA = false) {
        // 强制理由检查
        if (!reason || reason.trim().length === 0) {
            throw new Error('[IRStateMachineV4] 优先级变更必须提供理由');
        }
        const now = Date.now();
        const oldP = block.priorityUi;
        // 计算新的有效优先级
        let newPriorityEff;
        if (useTimeAwareEWMA && block.stats.lastInteraction > 0) {
            // Time-aware EWMA
            newPriorityEff = calculatePriorityEWMATimeAware(newPriorityUi, block.priorityEff, block.stats.lastInteraction);
        }
        else {
            // 标准 EWMA
            newPriorityEff = calculatePriorityEWMA(newPriorityUi, block.priorityEff);
        }
        // 创建日志条目
        const logEntry = createPriorityLogEntry(oldP, newPriorityUi, reason);
        logger.debug(`[IRStateMachineV4] ${block.id}: 优先级变更 ` +
            `UI=${oldP}→${newPriorityUi}, Eff=${block.priorityEff.toFixed(2)}→${newPriorityEff.toFixed(2)}, ` +
            `理由="${reason}"`);
        return {
            ...block,
            priorityUi: newPriorityUi,
            priorityEff: newPriorityEff,
            meta: {
                ...block.meta,
                priorityLog: [...block.meta.priorityLog, logEntry]
            },
            stats: {
                ...block.stats,
                lastInteraction: now
            },
            updatedAt: now
        };
    }
    /**
     * 更新阅读统计
     *
     * @param block 内容块
     * @param readingTimeSec 本次阅读时长（秒）
     * @param effectiveTimeSec 有效时长（秒）
     * @param extracts 摘录数
     * @param cardsCreated 制卡数
     * @param notesWritten 批注数
     * @returns 更新后的内容块
     */
    updateStats(block, readingTimeSec, effectiveTimeSec, extracts = 0, cardsCreated = 0, notesWritten = 0) {
        const now = Date.now();
        return {
            ...block,
            stats: {
                ...block.stats,
                totalReadingTimeSec: block.stats.totalReadingTimeSec + readingTimeSec,
                effectiveReadingTimeSec: block.stats.effectiveReadingTimeSec + effectiveTimeSec,
                extracts: block.stats.extracts + extracts,
                cardsCreated: block.stats.cardsCreated + cardsCreated,
                notesWritten: block.stats.notesWritten + notesWritten,
                lastInteraction: now
            },
            updatedAt: now
        };
    }
    /**
     * 批量检查并迁移到 scheduled 状态
     *
     * @param blocks 内容块数组
     * @returns 更新后的内容块数组
     */
    batchCheckScheduled(blocks) {
        return blocks.map(block => this.checkAndTransitionToScheduled(block));
    }
    /**
     * 获取指定状态的内容块
     *
     * @param blocks 所有内容块
     * @param status 目标状态
     * @returns 过滤后的内容块
     */
    getBlocksByStatus(blocks, status) {
        return blocks.filter(b => b.status === status);
    }
    /**
     * 获取候选池（scheduled 状态的块）
     *
     * @param blocks 所有内容块
     * @returns scheduled 状态的块
     */
    getCandidatePool(blocks) {
        return this.getBlocksByStatus(blocks, 'scheduled');
    }
    /**
     * 检查是否有 active 状态的块（防并发）
     *
     * @param blocks 所有内容块
     * @returns 是否有活跃块
     */
    hasActiveBlock(blocks) {
        return blocks.some(b => b.status === 'active');
    }
    /**
     * 获取当前活跃块
     *
     * @param blocks 所有内容块
     * @returns 活跃块或 null
     */
    getActiveBlock(blocks) {
        return blocks.find(b => b.status === 'active') || null;
    }
}
/**
 * 导出单例
 */
export const stateMachine = new IRStateMachineV4();
