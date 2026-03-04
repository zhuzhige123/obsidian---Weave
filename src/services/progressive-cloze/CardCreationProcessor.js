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
import { ProgressiveClozeConverter } from './ProgressiveClozeConverter';
import { Logger } from '../../utils/logger';
const logger = Logger.getInstance();
/**
 * 卡片创建处理器 V2
 */
export class CardCreationProcessor {
    converter;
    constructor() {
        this.converter = new ProgressiveClozeConverter();
    }
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
    processNewCard(card) {
        logger.debug(`[CardCreationProcessor] Processing new card: ${card.uuid}`);
        try {
            // 1. 检查是否可以转换为渐进式挖空
            if (!this.converter.canConvert(card)) {
                logger.debug(`[CardCreationProcessor] Not a progressive cloze card`);
                return {
                    success: true,
                    cards: [card]
                };
            }
            // 2. 转换为渐进式挖空（父卡片 + 子卡片）
            const { parent, children } = this.converter.convert(card, {
                inheritFsrs: false, // 新卡片不继承FSRS
                keepParent: true
            });
            logger.info(`[CardCreationProcessor] Converted to progressive cloze: ` +
                `1 parent + ${children.length} children`);
            // 3. 返回所有卡片（父卡片 + 子卡片）
            return {
                success: true,
                cards: [parent, ...children],
                parent,
                children
            };
        }
        catch (error) {
            logger.error(`[CardCreationProcessor] Failed to process card: ${card.uuid}`, error);
            // 失败时返回原卡片
            return {
                success: false,
                cards: [card],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * 批量处理卡片
     *
     * @param cards 卡片列表
     * @returns 处理结果列表
     */
    processCards(cards) {
        return cards.map(card => this.processNewCard(card));
    }
}
