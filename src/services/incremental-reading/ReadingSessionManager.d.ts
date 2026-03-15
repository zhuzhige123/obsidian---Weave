/**
 * 阅读会话管理服务
 *
 * 负责阅读会话的创建、记录和统计
 *
 * @module services/incremental-reading/ReadingSessionManager
 * @version 1.0.0
 */
import type { App } from 'obsidian';
import type { ReadingSession } from '../../types/incremental-reading-types';
import type { Rating } from '../../data/types';
import type { ReadingMaterialStorage } from './ReadingMaterialStorage';
import type { ReadingMaterialManager } from './ReadingMaterialManager';
/**
 * 会话开始选项
 */
export interface StartSessionOptions {
    /** 开始锚点 */
    startAnchor?: string;
    /** 初始笔记 */
    notes?: string;
}
/**
 * 会话结束选项
 */
export interface EndSessionOptions {
    /** 结束锚点 */
    endAnchor?: string;
    /** 评分 */
    rating?: Rating;
    /** 理解度 (1-5) */
    comprehension?: number;
    /** 会话笔记 */
    notes?: string;
    /** 本次创建的卡片UUID列表 */
    cardsCreated?: string[];
}
/**
 * 阅读会话管理器
 */
export declare class ReadingSessionManager {
    private storage;
    /** 当前活跃的会话 */
    private activeSession;
    constructor(_app: App, // 保留参数以保持 API 兼容性
    storage: ReadingMaterialStorage, _materialManager: ReadingMaterialManager);
    /**
     * 开始新的阅读会话
     * @param materialId 阅读材料ID
     * @param options 会话选项
     * @returns 创建的会话，如果已有活跃会话则返回null
     */
    startSession(materialId: string, options?: StartSessionOptions): Promise<ReadingSession | null>;
    /**
     * 结束当前阅读会话
     * @param options 结束选项
     * @returns 完成的会话，如果没有活跃会话则返回null
     */
    endSession(options?: EndSessionOptions): Promise<ReadingSession | null>;
    /**
     * 取消当前会话（不保存）
     */
    cancelSession(): void;
    /**
     * 获取当前活跃会话
     */
    getActiveSession(): ReadingSession | null;
    /**
     * 检查是否有活跃会话
     */
    hasActiveSession(): boolean;
    /**
     * 获取当前会话的持续时间（秒）
     */
    getCurrentDuration(): number;
    /**
     * 更新当前会话的笔记
     */
    updateSessionNotes(notes: string): void;
    /**
     * 添加创建的卡片到当前会话
     */
    addCreatedCard(cardId: string): void;
    /**
     * 获取材料的所有会话
     */
    getSessionsForMaterial(materialId: string): Promise<ReadingSession[]>;
    /**
     * 获取材料的会话统计
     */
    getSessionStats(materialId: string): Promise<{
        totalSessions: number;
        totalDuration: number;
        totalWordsRead: number;
        averageDuration: number;
        averageRating: number;
        lastSessionDate: string | null;
    }>;
    /**
     * 获取今日的会话统计
     */
    getTodayStats(): Promise<{
        sessionsCount: number;
        totalDuration: number;
        totalWordsRead: number;
        materialsRead: string[];
    }>;
    /**
     * 计算两个锚点之间的阅读字数
     */
    private calculateWordsRead;
}
/**
 * 创建阅读会话管理器实例
 */
export declare function createReadingSessionManager(app: App, storage: ReadingMaterialStorage, materialManager: ReadingMaterialManager): ReadingSessionManager;
