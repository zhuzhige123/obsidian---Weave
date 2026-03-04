/**
 * 增量阅读服务模块
 *
 * @module services/incremental-reading
 * @version 3.0.0 - 新调度系统
 */
// 存储服务
export { ReadingMaterialStorage, createReadingMaterialStorage } from './ReadingMaterialStorage';
export { IRStorageService } from './IRStorageService';
// v3.0 新调度系统
export { IRSchedulerV3, calculatePriorityEWMA, calculatePriorityMultiplier, calculateLoadSignal, calculateNextInterval, calculateNextReviewDate, hasReachedDailyLimit, incrementDailyAppearance, estimateReadingTime, DEFAULT_SCHEDULE_CONFIG_V3 } from './IRSchedulerV3';
// v3.0 标签组服务
export { IRTagGroupService } from './IRTagGroupService';
// v3.0 队列生成器
export { IRQueueGenerator, calculateAgingBonus, calculateItemScore, calculateOverdueDays } from './IRQueueGenerator';
// v3.0 统一调度服务外观
export { IRSchedulingFacade, createIRSchedulingFacade } from './IRSchedulingFacade';
// v3.0 监控统计服务
export { IRMonitoringService, createIRMonitoringService } from './IRMonitoringService';
// v5.7 标注信号服务
export { IRAnnotationSignalService, getAnnotationSignalService, createAnnotationSignalService, calculateAnnotationSignal, calculateAdjustedPriority, syncAnnotationSignalFromSettings, CALLOUT_TYPE_ALIASES, DEFAULT_CALLOUT_WEIGHTS, DEFAULT_ENABLED_TYPES, DEFAULT_ANNOTATION_SIGNAL_CONFIG } from './IRAnnotationSignalService';
export { IRSessionCardStatsService, getSessionCardStatsService, createSessionCardStatsService, destroySessionCardStatsService } from './IRSessionCardStatsService';
// 旧调度器（保留兼容）
export { IRScheduler, DEFAULT_SCHEDULE_CONFIG } from './IRScheduler';
// 锚点管理
export { AnchorManager, createAnchorManager } from './AnchorManager';
// 材料管理
export { ReadingMaterialManager, createReadingMaterialManager } from './ReadingMaterialManager';
// 会话管理
export { ReadingSessionManager, createReadingSessionManager } from './ReadingSessionManager';
// 摘录卡片服务
export { ExtractCardService, createExtractCardService } from './ExtractCardService';
// 段落解析器
export { ParagraphParser } from './ParagraphParser';
// @deprecated 聚焦阅读管理器已删除
// export { FocusReadingManager, createFocusReadingManager, DEFAULT_FOCUS_READING_SETTINGS } from './FocusReadingManager';
// export type { FocusReadingState, FocusReadingSettings, ActivateFocusModeOptions } from './FocusReadingManager';
// @deprecated 聚焦样式管理器已删除
// export { FocusStyleManager } from './FocusStyleManager';
// 行号到 DOM 映射器
export { LineDOMMapperImpl, createLineDOMMapper } from './LineDOMMapper';
// 内容变化观察器
export { ContentObserverImpl, createContentObserver } from './ContentObserver';
export { ReadingCategory, ReadingEventType, DEFAULT_READING_MATERIAL, ANCHOR_PREFIX, ANCHOR_REGEX, YAML_FIELD_PREFIX } from '../../types/incremental-reading-types';
