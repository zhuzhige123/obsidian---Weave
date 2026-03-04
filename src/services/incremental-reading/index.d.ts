/**
 * 增量阅读服务模块
 *
 * @module services/incremental-reading
 * @version 3.0.0 - 新调度系统
 */
export { ReadingMaterialStorage, createReadingMaterialStorage } from './ReadingMaterialStorage';
export { IRStorageService } from './IRStorageService';
export { IRSchedulerV3, calculatePriorityEWMA, calculatePriorityMultiplier, calculateLoadSignal, calculateNextInterval, calculateNextReviewDate, hasReachedDailyLimit, incrementDailyAppearance, estimateReadingTime, DEFAULT_SCHEDULE_CONFIG_V3 } from './IRSchedulerV3';
export type { IRSchedulerV3Config, ReadingCompletionData } from './IRSchedulerV3';
export { IRTagGroupService } from './IRTagGroupService';
export { IRQueueGenerator, calculateAgingBonus, calculateItemScore, calculateOverdueDays } from './IRQueueGenerator';
export type { QueueItem, QueueGenerationResult, PostponeResult } from './IRQueueGenerator';
export { IRSchedulingFacade, createIRSchedulingFacade } from './IRSchedulingFacade';
export type { IRSchedulingFacadeConfig, StudyQueueResult, CompleteBlockResult } from './IRSchedulingFacade';
export { IRMonitoringService, createIRMonitoringService } from './IRMonitoringService';
export type { DailyStats, PriorityChangeRecord, GroupParamChangeRecord, TagGroupSummary, IRMonitoringData } from './IRMonitoringService';
export { IRAnnotationSignalService, getAnnotationSignalService, createAnnotationSignalService, calculateAnnotationSignal, calculateAdjustedPriority, syncAnnotationSignalFromSettings, CALLOUT_TYPE_ALIASES, DEFAULT_CALLOUT_WEIGHTS, DEFAULT_ENABLED_TYPES, DEFAULT_ANNOTATION_SIGNAL_CONFIG } from './IRAnnotationSignalService';
export type { AnnotationSignalConfig, AnnotationSignalResult, ParsedCallout } from './IRAnnotationSignalService';
export { IRSessionCardStatsService, getSessionCardStatsService, createSessionCardStatsService, destroySessionCardStatsService } from './IRSessionCardStatsService';
export type { BlockCardStats, SessionCardStatsStore } from './IRSessionCardStatsService';
export { IRScheduler, DEFAULT_SCHEDULE_CONFIG } from './IRScheduler';
export type { IRScheduleConfig, IRSchedulerOptions, IRRating } from './IRScheduler';
export { AnchorManager, createAnchorManager } from './AnchorManager';
export type { AnchorParseResult, AnchorInsertResult } from './AnchorManager';
export { ReadingMaterialManager, createReadingMaterialManager } from './ReadingMaterialManager';
export type { CreateMaterialOptions, CategoryChangeResult } from './ReadingMaterialManager';
export { ReadingSessionManager, createReadingSessionManager } from './ReadingSessionManager';
export type { StartSessionOptions, EndSessionOptions } from './ReadingSessionManager';
export { ExtractCardService, createExtractCardService } from './ExtractCardService';
export type { ExtractCardOptions, ExtractCardResult, DeckHierarchy } from './ExtractCardService';
export { ParagraphParser } from './ParagraphParser';
export type { Paragraph } from './ParagraphParser';
export { LineDOMMapperImpl, createLineDOMMapper } from './LineDOMMapper';
export type { LineDOMMapper } from './LineDOMMapper';
export { ContentObserverImpl, createContentObserver } from './ContentObserver';
export type { ContentObserver } from './ContentObserver';
export type { ReadingMaterial, ReadingSession, ReadingProgress, AnchorRecord, ReadingYAMLFields, ReadingMaterialsIndex, AnchorsCache, CalendarDayData, MonthlyStats, ReadingEvent, DeckHierarchyExtension } from '../../types/incremental-reading-types';
export { ReadingCategory, ReadingEventType, DEFAULT_READING_MATERIAL, ANCHOR_PREFIX, ANCHOR_REGEX, YAML_FIELD_PREFIX } from '../../types/incremental-reading-types';
