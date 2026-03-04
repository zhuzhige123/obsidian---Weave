/**
 * IR 会话制卡统计服务
 *
 * 功能：
 * - 按块统计本次会话创建的卡片
 * - 持久化到 localStorage（支持异常关闭后恢复）
 * - 正常结束会话时清零
 * - 监听卡片删除事件，削减计数
 *
 * @version 5.8.0
 */
import type { App } from 'obsidian';
/**
 * 单个块的制卡统计
 */
export interface BlockCardStats {
    /** 块ID */
    blockId: string;
    /** 块所属文件路径 */
    filePath: string;
    /** 本次会话创建的卡片UUID集合 */
    cardUuids: string[];
    /** 最后更新时间 */
    updatedAt: number;
}
/**
 * 会话制卡统计存储结构
 */
export interface SessionCardStatsStore {
    /** 会话开始时间（用于判断是否是同一会话） */
    sessionStartTime: number;
    /** 按块统计 */
    blockStats: Record<string, BlockCardStats>;
    /** 会话是否正常结束 */
    sessionEnded: boolean;
}
/**
 * IR 会话制卡统计服务
 */
export declare class IRSessionCardStatsService {
    private app;
    private store;
    private eventHandlers;
    constructor(app: App);
    /**
     * 初始化服务，注册事件监听
     */
    initialize(): void;
    /**
     * 销毁服务，移除事件监听
     * @param normalEnd 是否正常结束（true=清除统计，false=保留供恢复）
     */
    destroy(normalEnd?: boolean): void;
    /**
     * 开始新会话
     */
    private startNewSession;
    /**
     * 处理卡片创建事件
     */
    private handleCardCreated;
    /**
     * 处理卡片删除事件
     */
    private handleCardDeleted;
    /**
     * 获取指定块的本次会话制卡数
     */
    getBlockCardCount(blockId: string): number;
    /**
     * 获取指定文件路径的本次会话制卡数
     */
    getFileCardCount(filePath: string): number;
    /**
     * 获取所有块的统计
     */
    getAllStats(): Record<string, BlockCardStats>;
    /**
     * 手动添加卡片到指定块（用于兼容现有逻辑）
     */
    addCardToBlock(blockId: string, filePath: string, cardUuid: string): void;
    /**
     * 从 localStorage 加载数据
     */
    private loadFromStorage;
    /**
     * 保存数据到 localStorage
     */
    private saveToStorage;
}
/**
 * 获取会话制卡统计服务实例
 */
export declare function getSessionCardStatsService(app?: App): IRSessionCardStatsService | null;
/**
 * 创建会话制卡统计服务实例
 */
export declare function createSessionCardStatsService(app: App): IRSessionCardStatsService;
/**
 * 销毁会话制卡统计服务实例
 */
export declare function destroySessionCardStatsService(normalEnd?: boolean): void;
