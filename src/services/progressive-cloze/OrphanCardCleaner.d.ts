/**
 * 孤儿卡片清理服务
 *
 * 功能：
 * - 检测没有父卡片的子卡片（孤儿子卡片）
 * - 提供自动清理或手动清理选项
 * - 生成检测报告
 *
 * @module services/progressive-cloze/OrphanCardCleaner
 * @version 1.0.0
 */
import type { Card } from '../../data/types';
/**
 * 孤儿卡片检测结果
 */
export interface OrphanDetectionResult {
    /** 是否发现孤儿卡片 */
    hasOrphans: boolean;
    /** 孤儿卡片列表 */
    orphanCards: Card[];
    /** 总子卡片数量 */
    totalChildCards: number;
    /** 孤儿卡片数量 */
    orphanCount: number;
    /** 检测时间 */
    detectedAt: string;
    /** 详细报告 */
    details: {
        cardId: string;
        parentCardId: string;
        clozeOrd: number;
        deckId: string;
        reason: string;
    }[];
}
/**
 * 清理结果
 */
export interface CleanupResult {
    /** 是否成功 */
    success: boolean;
    /** 清理的卡片数量 */
    cleanedCount: number;
    /** 清理的卡片ID列表 */
    cleanedCardIds: string[];
    /** 错误信息 */
    error?: string;
}
/**
 * 孤儿卡片清理器
 */
export declare class OrphanCardCleaner {
    /**
     * 检测孤儿子卡片
     *
     * @param allCards 所有卡片
     * @returns 检测结果
     */
    detectOrphans(allCards: Card[]): OrphanDetectionResult;
    /**
     * 清理孤儿子卡片
     *
     * @param orphanCards 孤儿卡片列表
     * @param deleteCard 删除卡片的方法
     * @returns 清理结果
     */
    cleanOrphans(orphanCards: Card[], deleteCard: (cardId: string) => Promise<void>): Promise<CleanupResult>;
    /**
     * 生成检测报告（用于UI显示）
     *
     * @param result 检测结果
     * @returns Markdown格式的报告
     */
    generateReport(result: OrphanDetectionResult): string;
}
/**
 * 获取清理器单例
 */
export declare function getOrphanCardCleaner(): OrphanCardCleaner;
