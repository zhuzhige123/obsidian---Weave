/**
 * 渐进式挖空系统 - 混合架构 V2
 *
 * 统一导出所有渐进式挖空相关的类型和服务
 *
 * 架构演进：
 * - V1：方案A（多卡片+关联）
 * - V1.5：方案B（单卡片+多FSRS+虚拟化层）
 * - V2：混合架构（父卡片+独立子卡片+内容引用）
 *
 * @module services/progressive-cloze
 * @version 2.0.0
 */
export { CardAccessor, createCardAccessor } from './CardAccessor';
export type { ICardStore } from './CardAccessor';
export { CardStoreAdapter } from './CardStoreAdapter';
export { ProgressiveClozeConverter } from './ProgressiveClozeConverter';
export { CardCreationProcessor } from './CardCreationProcessor';
export type { CardCreationResult } from './CardCreationProcessor';
export { ProgressiveClozeCardManager } from './ProgressiveClozeCardManager';
export type { ICardStorageService, CardCreationOptions } from './ProgressiveClozeCardManager';
export { ProgressiveClozeGateway, getProgressiveClozeGateway } from './ProgressiveClozeGateway';
export { OrphanCardCleaner, getOrphanCardCleaner } from './OrphanCardCleaner';
export type { OrphanDetectionResult, CleanupResult } from './OrphanCardCleaner';
export { ContentMigrationTool, getContentMigrationTool } from './ContentMigrationTool';
export type { MigrationResult } from './ContentMigrationTool';
export { ProgressiveClozeAnalyzer } from './ProgressiveClozeAnalyzer';
/**
 * @deprecated 将在V3移除
 */
export { CardSaveProcessor } from './CardSaveProcessor';
export type { HistoryInheritanceStrategy, InheritanceOptions } from './CardSaveProcessor';
export type { ProgressiveClozeCardType, ProgressiveClozeParentCard, ProgressiveClozeChildCard, ProgressiveClozeCard, ClozeData, ClozeParseResult, ConversionOptions, StudyInstance } from '../../types/progressive-cloze-v2';
export { isProgressiveClozeParent, isProgressiveClozeChild, isProgressiveClozeCard, isChildCardInstance, hasProgressiveClozeContent } from '../../types/progressive-cloze-v2';
/**
 * @deprecated 请使用 progressive-cloze-v2 中的类型
 */
export type { ClozeAnalysisResult, SplitCapabilityResult, } from '../../types/progressive-cloze-types';
/**
 * @deprecated 方案A的类型，已被V2替代
 */
export type { ClozeMap, ChildClozeMetadata, } from '../../types/progressive-cloze-types';
/**
 * V2 混合架构迁移指南：
 *
 * 1. 新项目应使用：
 *    - ProgressiveClozeConverter 替代 ProgressiveClozeSplitter
 *    - CardAccessor 替代 ProgressiveClozeHandler
 *    - ProgressiveClozeCardManager 替代 CardSaveProcessor
 *
 * 2. 类型迁移：
 *    - 使用 progressive-cloze-v2 中的类型
 *    - ProgressiveClozeChildCard 替代 ClozeStudyInstance
 *    - isProgressiveClozeChild 替代 isClozeStudyInstance
 *
 * 3. 核心变化：
 *    - 子卡片现为真实Card对象（非虚拟）
 *    -  V2.1优化：子卡片冗余存储content（数据安全 + 性能优化）
 *    - 简化类型系统，移除490行虚拟化代码
 *
 * 4. V2.1架构升级（内容去规范化）：
 *    - 子卡片存储完整content（Anki同款方案）
 *    - 保留parentCardId关系（用于同步和管理）
 *    - Gateway自动处理同步（对用户透明）
 *    - 数据安全优先于存储优化
 */
