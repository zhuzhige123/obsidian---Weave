/**
 * 卡片访问器
 *
 * 统一的卡片数据访问层，提供渐进式挖空相关的高级功能
 *
 * 核心职责：
 * 1. 提供统一的content访问接口（兼容 V1 和 V2）
 * 2. 提供当前激活挖空的解析和显示
 * 3. 提供挖空文本的提取和替换
 * 4. 缓存优化，避免重复解析
 *
 * V2 架构设计：
 * - 子卡片存储完整 content：创建时从父卡片复制，避免运行时查找
 * - CardAccessor 提供向后兼容：支持 V1 遗留数据（content 为空的子卡片）
 * - 推荐用法：直接使用 card.content，除非需要高级挖空操作
 *
 * @module services/progressive-cloze/CardAccessor
 * @version 2.0.0
 */
import type { Card } from '../../data/types';
import { type ProgressiveClozeChildCard, type ProgressiveClozeParentCard, type ClozeData } from '../../types/progressive-cloze-v2';
/**
 * 卡片存储接口（依赖注入）
 */
export interface ICardStore {
    /** 根据UUID获取卡片 */
    getCard(uuid: string): Card | null;
    /** 批量获取卡片 */
    getCards(uuids: string[]): Card[];
}
/**
 * 卡片访问器
 *
 * 使用示例：
 * ```typescript
 * const accessor = new CardAccessor(childCard, cardStore);
 *
 * // V2: 获取content（向后兼容 V1 数据）
 * const content = accessor.getContent();
 *
 * // 获取当前挖空文本
 * const clozeText = accessor.getActiveClozeText();
 *
 * // 获取用于显示的content（当前挖空高亮）
 * const displayContent = accessor.getDisplayContent();
 * ```
 */
export declare class CardAccessor {
    private card;
    private cardStore;
    private contentCache;
    private clozeDataCache;
    constructor(card: Card, cardStore: ICardStore);
    /**
     * 获取卡片内容
     *
     * V2 架构：
     * - 普通卡片：直接返回自己的content
     * - 父卡片：直接返回自己的content
     * - 子卡片：优先使用自己的content（V2 已存储），如果为空则从父卡片获取（V1 兼容）
     *
     * @throws Error 如果子卡片的父卡片不存在（仅 V1 遗留数据）
     */
    getContent(): string;
    /**
     * 获取父卡片（如果存在）
     */
    getParentCard(): ProgressiveClozeParentCard | null;
    /**
     * 解析content中的所有挖空
     *
     * @returns 挖空数据数组，按ord排序
     */
    parseClozes(): ClozeData[];
    /**
     * 获取当前激活的挖空数据
     *
     * 仅对子卡片有效，返回当前学习的挖空信息
     */
    getActiveClozeData(): ClozeData | null;
    /**
     * 获取当前激活的挖空文本
     *
     * 仅对子卡片有效
     *
     * @returns 挖空文本，如 "Python"
     */
    getActiveClozeText(): string | null;
    /**
     * 获取当前激活的挖空提示
     *
     * 仅对子卡片有效
     */
    getActiveClozeHint(): string | null;
    /**
     * 获取用于显示的content
     *
     * 对于子卡片：
     * - 当前挖空显示为 [...] 或 [提示]
     * - 其他挖空显示原文
     *
     * 对于父卡片和普通卡片：
     * - 返回原始content
     *
     * @param showHint 是否在挖空处显示提示（默认true）
     */
    getDisplayContent(showHint?: boolean): string;
    /**
     * 获取用于答案显示的content
     *
     * 所有挖空都显示原文，但当前挖空会高亮标记
     */
    getAnswerContent(): string;
    /**
     * 清除缓存
     *
     * 当卡片内容可能变化时调用（如父卡片被修改）
     */
    clearCache(): void;
    /**
     * 获取所有同胞子卡片（siblings）
     *
     * 仅对子卡片有效，返回同一父卡片的所有其他子卡片
     */
    getSiblingCards(): ProgressiveClozeChildCard[];
    /**
     * 检查今天是否有同胞卡片已经学习过
     *
     * 用于Bury Siblings机制
     */
    hasSiblingStudiedToday(): boolean;
}
/**
 * 创建CardAccessor实例
 *
 * @param card 卡片
 * @param cardStore 卡片存储服务
 */
export declare function createCardAccessor(card: Card, cardStore: ICardStore): CardAccessor;
