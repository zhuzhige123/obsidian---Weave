/**
 * 卡片创建处理器 V2
 *
 * 负责在卡片创建时自动检测并处理渐进式挖空格式
 *
 * 架构改进（V2）：
 * - 创建父卡片 + 多个独立子卡片
 * - 子卡片拥有真实UUID和独立FSRS数据
 * - 移除旧的progressiveCloze内部数据结构
 *
 * @module services/progressive-cloze/CardCreationProcessor
 * @version 2.0.0
 */
import type { Card } from '../../data/types';
import type { ProgressiveClozeParentCard, ProgressiveClozeChildCard } from '../../types/progressive-cloze-v2';
/**
 * 卡片创建结果
 */
export interface CardCreationResult {
    /** 是否成功 */
    success: boolean;
    /** 创建的卡片列表（普通卡片=1张，渐进式挖空=1父+N子） */
    cards: Card[];
    /** 父卡片（如果是渐进式挖空） */
    parent?: ProgressiveClozeParentCard;
    /** 子卡片列表（如果是渐进式挖空） */
    children?: ProgressiveClozeChildCard[];
    /** 错误信息 */
    error?: string;
}
/**
 * 卡片创建处理器 V2
 */
export declare class CardCreationProcessor {
    private converter;
    constructor();
    /**
     * 处理新创建的卡片
     *
     * V2架构：
     * - 检测渐进式挖空（≥2个挖空）
     * - 创建父卡片 + 多个独立子卡片
     * - 返回所有创建的卡片
     *
     * @param card 待处理的卡片
     * @returns 创建结果
     */
    processNewCard(card: Card): CardCreationResult;
    /**
     * 批量处理卡片
     *
     * @param cards 卡片列表
     * @returns 处理结果列表
     */
    processCards(cards: Card[]): CardCreationResult[];
}
