/**
 * 渐进式挖空卡片保存处理器 - V1.5 废弃版
 *
 * 🚫🚫🚫 警告：此文件已完全废弃，请勿使用 🚫🚫🚫
 *
 * V2架构替代方案：
 * - 使用 ProgressiveClozeConverter 进行转换
 * - 使用 ProgressiveClozeGateway 统一处理
 * - 所有卡片保存通过 storage.saveCard() 自动调用Gateway
 *
 * 废弃原因：
 * - V1.5使用单卡片+metadata存储渐进式挖空（已弃用）
 * - V2使用父卡片+子卡片架构（当前版本）
 * - 功能未发布，无需数据迁移
 *
 * @deprecated 请使用 ProgressiveClozeGateway
 * @module services/progressive-cloze/CardSaveProcessor
 */
import type { Card } from '../../data/types';
/**
 * 历史继承策略
 */
export type HistoryInheritanceStrategy = 'first' | 'proportional' | 'reset' | 'prompt';
/**
 * 继承选项
 */
export interface InheritanceOptions {
    /** 继承模式 */
    mode: 'specific' | 'proportional' | 'reset';
    /** 指定继承的子挖空索引（仅mode='specific'时有效） */
    targetIndex?: number;
}
/**
 * 卡片保存处理器
 */
export declare class CardSaveProcessor {
    /**
     * 保存前处理
     *
     * 检测内容变化并处理格式转换
     *
     * @param originalCard 原始卡片
     * @param updatedCard 更新后的卡片
     * @param strategy 历史继承策略
     * @param onPromptNeeded 需要用户选择时的回调
     * @returns 处理后的卡片和是否需要提示
     */
    beforeSave(originalCard: Card, updatedCard: Card, strategy: HistoryInheritanceStrategy, onPromptNeeded?: (card: Card, clozes: any[]) => Promise<InheritanceOptions>): Promise<{
        card: Card;
        needsPrompt: boolean;
    }>;
    /**
     * 处理历史继承
     */
    private handleHistoryInheritance;
    /**
     * 更新渐进式挖空（挖空数量可能变化）
     */
    private updateProgressiveCloze;
    /**
     * 转换回普通卡片
     *
     * @deprecated V2架构不需要此方法
     * V2中父卡片和子卡片是独立的卡片对象，没有"降级"概念
     * 如果需要删除渐进式挖空，应该删除父卡片和所有子卡片
     */
    private convertToNormalCard;
    /**
     * 转换为渐进式挖空格式（无历史继承）
     */
    private convertToProgressiveCloze;
    /**
     * 带继承的转换
     */
    private convertWithInheritance;
    /**
     * 分析卡片内容
     */
    private analyzeContent;
    /**
     * 检查序号是否连续
     */
    private checkSequential;
    /**
     * 创建新的FSRS卡片数据
     */
    private createNewFSRS;
}
