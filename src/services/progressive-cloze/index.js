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
// ============================================================================
//  V2 核心服务（混合架构）
// ============================================================================
// 卡片访问器（统一content访问）
export { CardAccessor, createCardAccessor } from './CardAccessor';
// CardStore适配器（桥接AnkiDataStorage）
export { CardStoreAdapter } from './CardStoreAdapter';
// 卡片转换器（普通卡片 → 父卡片+子卡片）
export { ProgressiveClozeConverter } from './ProgressiveClozeConverter';
// 卡片创建处理器 V2
export { CardCreationProcessor } from './CardCreationProcessor';
// 卡片管理器（统一创建/更新/删除）
export { ProgressiveClozeCardManager } from './ProgressiveClozeCardManager';
//  统一处理网关（第一道门+第二道门）
export { ProgressiveClozeGateway, getProgressiveClozeGateway } from './ProgressiveClozeGateway';
//  孤儿卡片清理服务
export { OrphanCardCleaner, getOrphanCardCleaner } from './OrphanCardCleaner';
//  内容迁移工具（V1→V2架构升级）
export { ContentMigrationTool, getContentMigrationTool } from './ContentMigrationTool';
// ============================================================================
//  V1.5 服务（兼容性保留）
// ============================================================================
// 保留仍在使用的工具类
export { ProgressiveClozeAnalyzer } from './ProgressiveClozeAnalyzer';
/**
 * @deprecated 将在V3移除
 */
export { CardSaveProcessor } from './CardSaveProcessor';
export { 
// 类型守卫
isProgressiveClozeParent, isProgressiveClozeChild, isProgressiveClozeCard, isChildCardInstance, 
// 工具函数
hasProgressiveClozeContent } from '../../types/progressive-cloze-v2';
// ============================================================================
//  说明
// ============================================================================
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
