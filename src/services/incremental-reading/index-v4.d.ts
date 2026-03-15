/**
 * 增量阅读 v4.0 模块导出
 *
 * 对齐《增量阅读-算法实施权威规范.md》
 *
 * @module services/incremental-reading
 * @version 4.0.0
 */
export { EWMA_ALPHA, M_BASE, I_MIN, I_MAX, SPEED_AVG, TIMEOUT_SECONDS, AGE_SLOPE, AGE_CAP, PRIORITY_NEUTRAL, calculatePriorityEWMA, calculatePriorityEWMATimeAware, calculatePsi, calculateNextInterval, calculateNextRepDate, estimateCost, estimateBlockCost, calculateAgeBoost, calculateEngageBoost, calculateSelectionScore, calculateEffectiveReadingTime, isLowQualityTime, createPriorityLogEntry, checkTimeoutPause, checkBankruptcy, type BankruptcyCheckResult } from './IRCoreAlgorithmsV4';
export { IRStateMachineV4, stateMachine, InvalidStateTransitionError, isValidTransition } from './IRStateMachineV4';
export { IRQueueGeneratorV4, createQueueGenerator, type QueueItemV4, type QueueGenerationResultV4, type GroupWeights } from './IRQueueGeneratorV4';
export { IRStorageAdapterV4, } from './IRStorageAdapterV4';
export { IRStorageV4, createIRStorageV4 } from './IRStorageV4';
export type { IRBlockStatus, IRBlockV4, IRBlockStats, IRBlockMeta, IRPriorityLogEntry } from '../../types/ir-types';
export { createDefaultIRBlockV4, migrateToIRBlockV4, mapStateToStatus, DEFAULT_IR_BLOCK_STATS, DEFAULT_IR_BLOCK_META } from '../../types/ir-types';
