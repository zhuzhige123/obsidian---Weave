/**
 * 渐进式挖空卡片管理器
 *
 * 统一管理渐进式挖空卡片的创建、更新和删除
 *
 * 核心职责：
 * 1. 协调CardCreationProcessor创建父子卡片
 * 2. 批量保存到CardStore
 * 3. 处理卡片关系更新
 * 4. 提供统一的操作接口
 *
 * @module services/progressive-cloze/ProgressiveClozeCardManager
 * @version 2.0.0
 */
import { isProgressiveClozeParent, isProgressiveClozeChild } from '../../types/progressive-cloze-v2';
import { CardCreationProcessor } from './CardCreationProcessor';
import { Logger } from '../../utils/logger';
const logger = Logger.getInstance();
/**
 * 渐进式挖空卡片管理器
 */
export class ProgressiveClozeCardManager {
    storageService;
    processor;
    constructor(storageService) {
        this.storageService = storageService;
        this.processor = new CardCreationProcessor();
    }
    /**
     * 创建卡片（自动检测渐进式挖空）
     *
     * @param card 待创建的卡片
     * @param options 创建选项
     * @returns 创建结果
     */
    async createCard(card, options = {}) {
        const { autoSave = true } = options;
        logger.debug(`[ProgressiveClozeCardManager] Creating card: ${card.uuid}`);
        // 1. 处理卡片（检测并转换渐进式挖空）
        const result = this.processor.processNewCard(card);
        // 2. 自动保存
        if (autoSave && this.storageService && result.success) {
            try {
                await this.storageService.saveCards(result.cards);
                logger.info(`[ProgressiveClozeCardManager] Saved ${result.cards.length} card(s)`);
            }
            catch (error) {
                logger.error('[ProgressiveClozeCardManager] Failed to save cards', error);
                throw error;
            }
        }
        return result;
    }
    /**
     * 批量创建卡片
     *
     * @param cards 卡片列表
     * @param options 创建选项
     * @returns 创建结果列表
     */
    async createCards(cards, options = {}) {
        const { autoSave = true } = options;
        logger.debug(`[ProgressiveClozeCardManager] Creating ${cards.length} cards`);
        // 1. 批量处理
        const results = this.processor.processCards(cards);
        // 2. 统计
        const successCount = results.filter(r => r.success).length;
        const totalCards = results.reduce((sum, r) => sum + r.cards.length, 0);
        logger.info(`[ProgressiveClozeCardManager] Processed ${successCount}/${cards.length} cards, ` +
            `created ${totalCards} card(s) total`);
        // 3. 自动保存
        if (autoSave && this.storageService && successCount > 0) {
            try {
                const allCards = results.flatMap(r => r.success ? r.cards : []);
                await this.storageService.saveCards(allCards);
                logger.info(`[ProgressiveClozeCardManager] Saved ${allCards.length} cards`);
            }
            catch (error) {
                logger.error('[ProgressiveClozeCardManager] Failed to save cards', error);
                throw error;
            }
        }
        return results;
    }
    /**
     * 更新父卡片内容（V2: 同时更新所有子卡片的 content）
     *
     * V2 架构：子卡片存储完整 content，需要同步更新
     *
     * @param parentCard 父卡片
     * @returns 更新是否成功
     */
    async updateParentCard(parentCard) {
        if (!this.storageService) {
            throw new Error('Storage service not provided');
        }
        if (!isProgressiveClozeParent(parentCard)) {
            throw new Error('Card is not a progressive-parent');
        }
        try {
            // 更新父卡片的修改时间
            parentCard.modified = new Date().toISOString();
            // 保存父卡片
            await this.storageService.saveCard(parentCard);
            logger.info(`[ProgressiveClozeCardManager] Updated parent card: ${parentCard.uuid}`);
            // V2: 更新所有子卡片的 content
            const childCardIds = parentCard.progressiveCloze.childCardIds;
            for (const childCardId of childCardIds) {
                const childCard = this.storageService.getCard(childCardId);
                if (childCard && isProgressiveClozeChild(childCard)) {
                    childCard.content = parentCard.content;
                    childCard.modified = new Date().toISOString();
                    await this.storageService.saveCard(childCard);
                }
            }
            logger.info(`[ProgressiveClozeCardManager] Updated ${childCardIds.length} child cards`);
            return true;
        }
        catch (error) {
            logger.error('[ProgressiveClozeCardManager] Failed to update parent card', error);
            return false;
        }
    }
    /**
     * 删除渐进式挖空卡片（包括父卡片和所有子卡片）
     *
     * @param parentCardId 父卡片UUID
     * @returns 删除是否成功
     */
    async deleteProgressiveCloze(parentCardId) {
        if (!this.storageService) {
            throw new Error('Storage service not provided');
        }
        try {
            // 1. 获取父卡片
            const parentCard = this.storageService.getCard(parentCardId);
            if (!parentCard || !isProgressiveClozeParent(parentCard)) {
                throw new Error(`Parent card not found or invalid: ${parentCardId}`);
            }
            // 2. 删除所有子卡片
            const childCardIds = parentCard.progressiveCloze.childCardIds;
            await this.storageService.deleteCards(childCardIds);
            // 3. 删除父卡片
            await this.storageService.deleteCard(parentCardId);
            logger.info(`[ProgressiveClozeCardManager] Deleted progressive cloze: ` +
                `1 parent + ${childCardIds.length} children`);
            return true;
        }
        catch (error) {
            logger.error('[ProgressiveClozeCardManager] Failed to delete progressive cloze', error);
            return false;
        }
    }
    /**
     * 删除单个子卡片
     *
     * 注意：如果删除后只剩1个子卡片，应该降级为普通卡片
     *
     * @param childCardId 子卡片UUID
     * @returns 删除是否成功
     */
    async deleteChildCard(childCardId) {
        if (!this.storageService) {
            throw new Error('Storage service not provided');
        }
        try {
            // 1. 获取子卡片
            const childCard = this.storageService.getCard(childCardId);
            if (!childCard || !isProgressiveClozeChild(childCard)) {
                throw new Error(`Child card not found or invalid: ${childCardId}`);
            }
            // 2. 获取父卡片
            const parentCard = this.storageService.getCard(childCard.parentCardId);
            if (!parentCard || !isProgressiveClozeParent(parentCard)) {
                throw new Error(`Parent card not found: ${childCard.parentCardId}`);
            }
            // 3. 更新父卡片的子卡片列表
            const updatedChildIds = parentCard.progressiveCloze.childCardIds.filter(id => id !== childCardId);
            // 4. 检查是否需要降级
            if (updatedChildIds.length < 2) {
                logger.warn(`[ProgressiveClozeCardManager] Only ${updatedChildIds.length} child card(s) remaining, ` +
                    `should consider downgrading to normal card`);
                // TODO: 实现降级逻辑
            }
            // 5. 更新父卡片
            parentCard.progressiveCloze.childCardIds = updatedChildIds;
            parentCard.progressiveCloze.totalClozes = updatedChildIds.length;
            parentCard.modified = new Date().toISOString();
            await this.storageService.saveCard(parentCard);
            // 6. 删除子卡片
            await this.storageService.deleteCard(childCardId);
            logger.info(`[ProgressiveClozeCardManager] Deleted child card: ${childCardId}`);
            return true;
        }
        catch (error) {
            logger.error('[ProgressiveClozeCardManager] Failed to delete child card', error);
            return false;
        }
    }
    /**
     * 获取父卡片的所有子卡片
     *
     * @param parentCardId 父卡片UUID
     * @returns 子卡片列表
     */
    getChildCards(parentCardId) {
        if (!this.storageService) {
            throw new Error('Storage service not provided');
        }
        const parentCard = this.storageService.getCard(parentCardId);
        if (!parentCard || !isProgressiveClozeParent(parentCard)) {
            return [];
        }
        const cards = this.storageService.getCards(parentCard.progressiveCloze.childCardIds);
        return cards.filter((c) => isProgressiveClozeChild(c));
    }
}
