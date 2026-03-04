/**
 * StudyInterface 组件常量定义
 * 集中管理UI布局、时间、阈值等常量，避免魔法数字
 */

// ============================================
// 🎨 UI 布局常量
// ============================================

/**
 * UI时间相关常量
 */
export const UI_TIMING = {
  /** DOM准备延迟（编辑器创建后） */
  DOM_READY_DELAY: 200,
  /** 刷新防抖延迟 */
  REFRESH_DEBOUNCE: 100,
  /** 紧凑模式检测防抖 */
  COMPACT_MODE_CHECK_DEBOUNCE: 300,
  /** 自动保存延迟 */
  AUTO_SAVE_DELAY: 1000,
} as const;

/**
 * UI布局间距常量
 */
export const LAYOUT_SPACING = {
  /** 编辑模式预留间距 (container padding + editor margin) */
  EDITOR_RESERVED: 48,
  /** 预览模式预留间距 */
  PREVIEW_RESERVED: 80,
  /** 最小容器高度 */
  MIN_CONTAINER_HEIGHT: 400,
  /** 最小预览高度 */
  MIN_PREVIEW_HEIGHT: 300,
} as const;

// ============================================
// 📊 学习统计阈值
// ============================================

/**
 * 响应时间阈值（毫秒）
 */
export const RESPONSE_TIME_THRESHOLDS = {
  /** 快速响应阈值 - 低于此值被认为是快速回答 */
  FAST_RESPONSE: 5000,
  /** 正常响应上限 */
  NORMAL_RESPONSE: 15000,
  /** 慢速响应阈值 */
  SLOW_RESPONSE: 30000,
} as const;

/**
 * 进度提示频率
 */
export const PROGRESS_NOTIFICATION = {
  /** 每复习N张卡片显示一次个性化优化进度 */
  OPTIMIZATION_PROGRESS_INTERVAL: 50,
} as const;

// ============================================
// 🎯 FSRS 统计权重
// ============================================

/**
 * FSRS6统计更新权重
 */
export const FSRS_STATS_WEIGHTS = {
  /** 预测准确性历史权重 */
  PREDICTION_ACCURACY_HISTORY: 0.9,
  /** 预测准确性当前权重 */
  PREDICTION_ACCURACY_CURRENT: 0.1,
  /** 快速正确回答的准确性加成 */
  FAST_CORRECT_BONUS: 0.1,
  
  /** 稳定性趋势历史权重 */
  STABILITY_TREND_HISTORY: 0.8,
  /** 稳定性趋势当前权重 */
  STABILITY_TREND_CURRENT: 0.2,
  
  /** 难度趋势历史权重 */
  DIFFICULTY_TREND_HISTORY: 0.8,
  /** 难度趋势当前权重 */
  DIFFICULTY_TREND_CURRENT: 0.2,
} as const;

// ============================================
// 📝 日志前缀
// ============================================

/**
 * 统一的日志前缀，便于日志过滤和分类
 */
export const LOG_PREFIX = {
  CARD_OPERATION: '[StudyInterface:Card]',
  AI_OPERATION: '[StudyInterface:AI]',
  ERROR_BOOK: '[StudyInterface:ErrorBook]',
  SUSPEND: '[StudyInterface:Suspend]',
  REMINDER: '[StudyInterface:Reminder]',
  PRIORITY: '[StudyInterface:Priority]',
  FORMAT: '[StudyInterface:Format]',
  CHILD_CARDS: '[StudyInterface:ChildCards]',
  UNDO: '[StudyInterface:Undo]',
  SESSION: '[StudyInterface:Session]',
} as const;
