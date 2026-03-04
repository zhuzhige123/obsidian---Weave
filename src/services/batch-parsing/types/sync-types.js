/**
 * 批量解析增量同步相关类型定义
 * @module sync-types
 */
// ============================================
// 增量同步相关类型
// ============================================
/**
 * 同步操作类型
 */
export var SyncAction;
(function (SyncAction) {
    /** 创建新卡片 */
    SyncAction["CREATE"] = "CREATE";
    /** 更新现有卡片 */
    SyncAction["UPDATE"] = "UPDATE";
    /** 跳过同步 */
    SyncAction["SKIP"] = "SKIP";
    /** 标记为已删除 */
    SyncAction["MARK_DELETED"] = "MARK_DELETED";
})(SyncAction || (SyncAction = {}));
/**
 * 默认同步配置
 */
export const DEFAULT_SYNC_CONFIG = {
    enabled: true,
    detectDeletions: true,
    timeTolerance: 0, // 精确比较
    conflictResolution: 'obsidian-wins'
};
