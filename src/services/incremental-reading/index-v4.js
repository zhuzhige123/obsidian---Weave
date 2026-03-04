/**
 * 增量阅读 v4.0 模块导出
 *
 * 对齐《增量阅读-算法实施权威规范.md》
 *
 * @module services/incremental-reading
 * @version 4.0.0
 */
// 核心算法
export { 
// 常量
EWMA_ALPHA, M_BASE, I_MIN, I_MAX, SPEED_AVG, TIMEOUT_SECONDS, AGE_SLOPE, AGE_CAP, PRIORITY_NEUTRAL, 
// EWMA 优先级
calculatePriorityEWMA, calculatePriorityEWMATimeAware, 
// 变速函数
calculatePsi, 
// 间隔计算
calculateNextInterval, calculateNextRepDate, 
// 成本估计
estimateCost, estimateBlockCost, 
// 选择分数
calculateAgeBoost, calculateEngageBoost, calculateSelectionScore, 
// 有效时长
calculateEffectiveReadingTime, isLowQualityTime, 
// 安全机制
createPriorityLogEntry, checkTimeoutPause, checkBankruptcy } from './IRCoreAlgorithmsV4';
// 状态机
export { IRStateMachineV4, stateMachine, InvalidStateTransitionError, isValidTransition } from './IRStateMachineV4';
// 会话计时器和控制器已删除 (v5.4 弃用)
// 队列生成器
export { IRQueueGeneratorV4, createQueueGenerator } from './IRQueueGeneratorV4';
// 存储适配器
export { IRStorageAdapterV4, } from './IRStorageAdapterV4';
// V4 简化存储服务
export { IRStorageV4, createIRStorageV4 } from './IRStorageV4';
export { createDefaultIRBlockV4, migrateToIRBlockV4, mapStateToStatus, DEFAULT_IR_BLOCK_STATS, DEFAULT_IR_BLOCK_META } from '../../types/ir-types';
