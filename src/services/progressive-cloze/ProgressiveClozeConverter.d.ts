/**
 * 渐进式挖空转换器 V2
 *
 * 核心职责：
 * 1. 将普通挖空卡片转换为渐进式挖空（父卡片 + 子卡片）
 * 2. 解析content中的挖空信息
 * 3. 创建独立的子卡片实体
 * 4. 处理FSRS数据继承
 *
 * 设计原则：
 * - 内容单一来源：只有父卡片存储content
 * - 独立实体：每个子卡片都是真实的Card对象
 * - FSRS继承：支持多种继承策略
 *
 * @module services/progressive-cloze/ProgressiveClozeConverter
 * @version 2.0.0
 */
import type { Card } from '../../data/types';
import { type ProgressiveClozeParentCard, type ProgressiveClozeChildCard, type ClozeParseResult, type ConversionOptions } from '../../types/progressive-cloze-v2';
/**
 * 渐进式挖空转换器
 */
export declare class ProgressiveClozeConverter {
    private fsrs;
    constructor();
    /**
     * 解析content中的挖空信息
     *
     * @param content Markdown内容
     * @returns 解析结果
     */
    parseClozes(content: string): ClozeParseResult;
    /**
     * 检查卡片是否可以转换为渐进式挖空
     *
     * @param card 卡片
     * @returns 是否可以转换
     */
    canConvert(card: Card): boolean;
    /**
     * 将普通挖空卡片转换为渐进式挖空
     *
     * @param sourceCard 源卡片
     * @param options 转换选项
     * @returns 转换结果：{ parent, children }
     * @throws Error 如果卡片无法转换
     */
    convert(sourceCard: Card, options?: ConversionOptions): {
        parent: ProgressiveClozeParentCard;
        children: ProgressiveClozeChildCard[];
    };
    /**
     * 创建父卡片
     */
    private createParentCard;
    /**
     * 创建子卡片列表
     */
    private createChildCards;
    /**
     * 创建新的FSRS数据
     *
     * @param daysOffset P1优化：初始分散天数偏移（用于兄弟卡片分散）
     */
    private createNewFsrs;
    /**
     * 克隆FSRS数据
     */
    private cloneFsrsData;
    /**
     * 批量转换卡片
     *
     * @param cards 卡片列表
     * @param options 转换选项
     * @returns 转换结果列表
     */
    convertBatch(cards: Card[], options?: ConversionOptions): Array<{
        sourceCard: Card;
        parent: ProgressiveClozeParentCard;
        children: ProgressiveClozeChildCard[];
        success: boolean;
        error?: string;
    }>;
}
