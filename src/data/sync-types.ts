/**
 * 同步相关的类型定义
 */

import type { Card } from "./types";

/**
 * 同步模式枚举
 */
export enum SyncMode {
	LOCAL_ONLY = "local_only",
	SYNC_PENDING = "sync_pending",
	SYNCED = "synced",
	CONFLICT = "conflict",
	SYNC_FAILED = "sync_failed",
}

/**
 * 同步状态接口
 */
export interface SyncState {
	mode: SyncMode;
	lastSyncTime?: string;
	conflictData?: unknown;
	errorMessage?: string;
	retryCount?: number;
}

/**
 * 带同步状态的卡片
 */
export interface CardWithSync extends Card {
	syncState: SyncState;
}

/**
 * 看板列配置
 */
export interface KanbanColumn {
	id: string;
	title: string;
	icon: string;
	syncMode: SyncMode;
	allowDrop: boolean;
	color?: string;
}

/**
 * 看板列类型（用于组件）
 */
export interface KanbanColumnType extends KanbanColumn {
	cards: CardWithSync[];
	count: number;
}

/**
 * 看板视图设置
 */
export interface KanbanViewSettings {
	enableDragDrop: boolean;
	cardDisplayMode: "compact" | "detailed";
	showSyncStatus: boolean;
	showLastSyncTime: boolean;
	showConflictIndicator: boolean;
	autoRefresh: boolean;
	refreshInterval: number;
}

/**
 * 批量操作类型
 */
export interface BatchOperation {
	type: "sync" | "delete" | "move" | "resolve_conflict";
	cardIds: string[];
	targetSyncMode?: SyncMode;
	options?: Record<string, unknown>;
}

/**
 * 同步过滤器
 */
export interface SyncFilters {
	syncModes: SyncMode[];
	searchText: string;
	tags: string[];
	dateRange?: {
		start: Date;
		end: Date;
	};
}

/**
 * 看板列配置常量
 */
export const KANBAN_COLUMN_CONFIGS: KanbanColumn[] = [
	{
		id: "local_only",
		title: "本地卡片",
		icon: "📱",
		syncMode: SyncMode.LOCAL_ONLY,
		allowDrop: true,
		color: "#6b7280",
	},
	{
		id: "sync_pending",
		title: "待同步",
		icon: "⏳",
		syncMode: SyncMode.SYNC_PENDING,
		allowDrop: true,
		color: "#f59e0b",
	},
	{
		id: "synced",
		title: "已同步",
		icon: "✅",
		syncMode: SyncMode.SYNCED,
		allowDrop: true,
		color: "#10b981",
	},
	{
		id: "conflict",
		title: "冲突",
		icon: "⚠️",
		syncMode: SyncMode.CONFLICT,
		allowDrop: false,
		color: "#ef4444",
	},
	{
		id: "sync_failed",
		title: "同步失败",
		icon: "❌",
		syncMode: SyncMode.SYNC_FAILED,
		allowDrop: true,
		color: "#dc2626",
	},
];

/**
 * 默认看板视图设置
 */
export const DEFAULT_KANBAN_VIEW_SETTINGS: KanbanViewSettings = {
	enableDragDrop: true,
	cardDisplayMode: "compact",
	showSyncStatus: true,
	showLastSyncTime: true,
	showConflictIndicator: true,
	autoRefresh: true,
	refreshInterval: 30000, // 30秒
};

/**
 * 同步状态工具函数
 */
export class SyncStateUtils {
	private readonly _brand = 0;

	private constructor() {}

	/**
	 * 获取同步状态的显示文本
	 */
	static getSyncStatusText(syncState: SyncState): string {
		switch (syncState.mode) {
			case SyncMode.LOCAL_ONLY:
				return "本地";
			case SyncMode.SYNC_PENDING:
				return "待同步";
			case SyncMode.SYNCED:
				return "已同步";
			case SyncMode.CONFLICT:
				return "冲突";
			case SyncMode.SYNC_FAILED:
				return "同步失败";
			default:
				return "未知";
		}
	}

	/**
	 * 获取同步状态的颜色
	 */
	static getSyncStatusColor(syncState: SyncState): string {
		const config = KANBAN_COLUMN_CONFIGS.find((c) => c.syncMode === syncState.mode);
		return config?.color || "#6b7280";
	}

	/**
	 * 检查是否可以同步
	 */
	static canSync(syncState: SyncState): boolean {
		return [SyncMode.LOCAL_ONLY, SyncMode.SYNC_PENDING, SyncMode.SYNC_FAILED].includes(
			syncState.mode
		);
	}

	/**
	 * 检查是否有冲突
	 */
	static hasConflict(syncState: SyncState): boolean {
		return syncState.mode === SyncMode.CONFLICT;
	}

	/**
	 * 创建默认同步状态
	 */
	static createDefaultSyncState(): SyncState {
		return {
			mode: SyncMode.LOCAL_ONLY,
			retryCount: 0,
		};
	}
}
