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
import type { IRBlockV4, IRBlockStatus } from '../../types/ir-types';
export declare class InvalidStateTransitionError extends Error {
    constructor(from: IRBlockStatus, to: IRBlockStatus, reason?: string);
}
/**
 * 检查状态迁移是否有效
 */
export declare function isValidTransition(from: IRBlockStatus, to: IRBlockStatus): boolean;
export declare class IRStateMachineV4 {
    /**
     * new → queued: 初始化完成且写入 nextRepDate
     *
     * @param block 内容块
     * @param initialIntervalDays 初始间隔（天），默认 1
     * @returns 更新后的内容块
     */
    transitionToQueued(block: IRBlockV4, initialIntervalDays?: number): IRBlockV4;
    /**
     * queued → scheduled: 当 nextRepDate <= now
     *
     * 此方法会检查是否满足迁移条件
     *
     * @param block 内容块
     * @returns 更新后的内容块（如果满足条件）或原块
     */
    checkAndTransitionToScheduled(block: IRBlockV4): IRBlockV4;
    /**
     * scheduled → active: 被会话选中并展示
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    transitionToActive(block: IRBlockV4): IRBlockV4;
    /**
     * active → queued: 用户点 Next（未完成/继续增量处理）
     *
     * @param block 内容块
     * @param mBase 基础扩张乘子
     * @param mGroup TagGroup 系数
     * @returns 更新后的内容块
     */
    transitionBackToQueued(block: IRBlockV4, mBase?: number, mGroup?: number, maxInterval?: number): IRBlockV4;
    /**
     * active → done: 归档（用户已完全理解）
     *
     * @param block 内容块
     * @param reason 完成原因
     * @returns 更新后的内容块
     */
    transitionToDone(block: IRBlockV4, reason?: 'archived' | 'completed'): IRBlockV4;
    /**
     * → suspended: 搁置（从 active/queued/scheduled 均可搁置）
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    transitionToSuspended(block: IRBlockV4): IRBlockV4;
    /**
     * → removed: 移除（从 active/queued/scheduled 均可移除）
     *
     * @param block 内容块
     * @param reason 移除原因
     * @returns 更新后的内容块
     */
    transitionToRemoved(block: IRBlockV4): IRBlockV4;
    /**
     * suspended → queued: 用户恢复搁置后重新入队
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    resumeFromSuspended(block: IRBlockV4): IRBlockV4;
    /**
     * 强制恢复：从 done/removed 重新激活到 queued
     * 这不是常规状态迁移，而是管理操作
     *
     * @param block 内容块
     * @returns 更新后的内容块
     */
    forceReactivate(block: IRBlockV4): IRBlockV4;
    /**
     * 更新优先级（带强制理由）
     *
     * @param block 内容块
     * @param newPriorityUi 新优先级 (0-10)
     * @param reason 变更理由（必填）
     * @param useTimeAwareEWMA 是否使用 time-aware EWMA
     * @returns 更新后的内容块
     */
    updatePriority(block: IRBlockV4, newPriorityUi: number, reason: string, useTimeAwareEWMA?: boolean): IRBlockV4;
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
    updateStats(block: IRBlockV4, readingTimeSec: number, effectiveTimeSec: number, extracts?: number, cardsCreated?: number, notesWritten?: number): IRBlockV4;
    /**
     * 批量检查并迁移到 scheduled 状态
     *
     * @param blocks 内容块数组
     * @returns 更新后的内容块数组
     */
    batchCheckScheduled(blocks: IRBlockV4[]): IRBlockV4[];
    /**
     * 获取指定状态的内容块
     *
     * @param blocks 所有内容块
     * @param status 目标状态
     * @returns 过滤后的内容块
     */
    getBlocksByStatus(blocks: IRBlockV4[], status: IRBlockStatus): IRBlockV4[];
    /**
     * 获取候选池（scheduled 状态的块）
     *
     * @param blocks 所有内容块
     * @returns scheduled 状态的块
     */
    getCandidatePool(blocks: IRBlockV4[]): IRBlockV4[];
    /**
     * 检查是否有 active 状态的块（防并发）
     *
     * @param blocks 所有内容块
     * @returns 是否有活跃块
     */
    hasActiveBlock(blocks: IRBlockV4[]): boolean;
    /**
     * 获取当前活跃块
     *
     * @param blocks 所有内容块
     * @returns 活跃块或 null
     */
    getActiveBlock(blocks: IRBlockV4[]): IRBlockV4 | null;
}
/**
 * 导出单例
 */
export declare const stateMachine: IRStateMachineV4;
