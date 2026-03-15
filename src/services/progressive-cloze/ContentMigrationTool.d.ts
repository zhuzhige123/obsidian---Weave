/**
 * 渐进式挖空内容迁移工具
 *
 * 功能：
 * - 为所有子卡片填充父卡片的content
 * - 从V1架构（子卡片content为空）迁移到V2架构（子卡片存储完整content）
 * - 提供详细的迁移报告
 *
 * 使用场景：
 * - 系统升级时自动运行
 * - 数据修复时手动运行
 *
 * @module services/progressive-cloze/ContentMigrationTool
 * @version 2.0.0
 */
import type { Card } from '../../data/types';
/**
 * 迁移结果
 */
export interface MigrationResult {
    /** 是否成功 */
    success: boolean;
    /** 扫描的卡片总数 */
    totalCards: number;
    /** 发现的父卡片数量 */
    parentCardsCount: number;
    /** 发现的子卡片数量 */
    childCardsCount: number;
    /** 需要迁移的子卡片数量（content为空） */
    needsMigrationCount: number;
    /** 成功迁移的子卡片数量 */
    migratedCount: number;
    /** 失败的子卡片数量 */
    failedCount: number;
    /** 失败详情 */
    failures: {
        cardId: string;
        parentCardId: string;
        reason: string;
    }[];
    /** 迁移时间 */
    timestamp: string;
    /** 错误信息 */
    error?: string;
}
/**
 * 内容迁移工具
 */
export declare class ContentMigrationTool {
    /**
     * 执行迁移
     *
     * @param allCards 所有卡片
     * @param saveCard 保存卡片的方法
     * @param dryRun 是否为试运行（不实际保存）
     * @returns 迁移结果
     */
    migrate(allCards: Card[], saveCard: (card: Card) => Promise<void>, dryRun?: boolean): Promise<MigrationResult>;
    /**
     * 生成迁移报告（Markdown格式）
     *
     * @param result 迁移结果
     * @returns Markdown格式的报告
     */
    generateReport(result: MigrationResult): string;
}
/**
 * 获取迁移工具单例
 */
export declare function getContentMigrationTool(): ContentMigrationTool;
