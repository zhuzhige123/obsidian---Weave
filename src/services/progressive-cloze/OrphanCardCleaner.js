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
import { CardType } from '../../data/types';
import { getCardDeckIds } from '../../utils/yaml-utils';
import { logger } from '../../utils/logger';
/**
 * 孤儿卡片清理器
 */
export class OrphanCardCleaner {
    /**
     * 检测孤儿子卡片
     *
     * @param allCards 所有卡片
     * @returns 检测结果
     */
    detectOrphans(allCards) {
        logger.debug('[OrphanCardCleaner] 开始检测孤儿子卡片...');
        // 1. 构建父卡片ID集合
        const parentCardIds = new Set();
        for (const card of allCards) {
            if (card.type === CardType.ProgressiveParent) {
                parentCardIds.add(card.uuid);
            }
        }
        logger.debug(`[OrphanCardCleaner] 发现 ${parentCardIds.size} 个父卡片`);
        // 2. 查找所有子卡片（使用类型断言）
        const childCards = allCards.filter(card => card.type === CardType.ProgressiveChild);
        logger.debug(`[OrphanCardCleaner] 发现 ${childCards.length} 个子卡片`);
        // 3. 检测孤儿子卡片
        const orphanCards = [];
        const details = [];
        for (const childCard of childCards) {
            if (!childCard.parentCardId) {
                // 情况1：子卡片没有parentCardId字段
                orphanCards.push(childCard);
                details.push({
                    cardId: childCard.uuid,
                    parentCardId: childCard.parentCardId || 'undefined',
                    clozeOrd: childCard.clozeOrd || -1,
                    // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
                    deckId: getCardDeckIds(childCard).primaryDeckId || childCard.deckId || '',
                    reason: '子卡片缺少parentCardId字段'
                });
            }
            else if (!parentCardIds.has(childCard.parentCardId)) {
                // 情况2：父卡片不存在
                orphanCards.push(childCard);
                details.push({
                    cardId: childCard.uuid,
                    parentCardId: childCard.parentCardId,
                    clozeOrd: childCard.clozeOrd || -1,
                    // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
                    deckId: getCardDeckIds(childCard).primaryDeckId || childCard.deckId || '',
                    reason: `父卡片不存在: ${childCard.parentCardId}`
                });
            }
        }
        const result = {
            hasOrphans: orphanCards.length > 0,
            orphanCards,
            totalChildCards: childCards.length,
            orphanCount: orphanCards.length,
            detectedAt: new Date().toISOString(),
            details
        };
        if (result.hasOrphans) {
            logger.warn(`[OrphanCardCleaner] ⚠️ 发现 ${result.orphanCount} 个孤儿子卡片 (总共${result.totalChildCards}个子卡片)`);
            for (const detail of details) {
                logger.warn(`  - ${detail.cardId}: ${detail.reason}`);
            }
        }
        else {
            logger.info(`[OrphanCardCleaner] ✅ 未发现孤儿子卡片 (总共${result.totalChildCards}个子卡片)`);
        }
        return result;
    }
    /**
     * 清理孤儿子卡片
     *
     * @param orphanCards 孤儿卡片列表
     * @param deleteCard 删除卡片的方法
     * @returns 清理结果
     */
    async cleanOrphans(orphanCards, deleteCard) {
        logger.info(`[OrphanCardCleaner] 开始清理 ${orphanCards.length} 个孤儿子卡片...`);
        const cleanedCardIds = [];
        let cleanedCount = 0;
        try {
            for (const orphanCard of orphanCards) {
                try {
                    await deleteCard(orphanCard.uuid);
                    cleanedCardIds.push(orphanCard.uuid);
                    cleanedCount++;
                    logger.debug(`[OrphanCardCleaner] ✓ 已删除孤儿子卡片: ${orphanCard.uuid}`);
                }
                catch (error) {
                    logger.error(`[OrphanCardCleaner] ✗ 删除孤儿子卡片失败: ${orphanCard.uuid}`, error);
                }
            }
            logger.info(`[OrphanCardCleaner] ✅ 清理完成: ${cleanedCount}/${orphanCards.length} 个卡片`);
            return {
                success: true,
                cleanedCount,
                cleanedCardIds
            };
        }
        catch (error) {
            logger.error('[OrphanCardCleaner] 清理过程失败:', error);
            return {
                success: false,
                cleanedCount,
                cleanedCardIds,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * 生成检测报告（用于UI显示）
     *
     * @param result 检测结果
     * @returns Markdown格式的报告
     */
    generateReport(result) {
        if (!result.hasOrphans) {
            return `## ✅ 数据完整性检查通过\n\n未发现孤儿子卡片 (总共${result.totalChildCards}个子卡片)`;
        }
        let report = `## ⚠️ 发现孤儿子卡片\n\n`;
        report += `- **孤儿数量**: ${result.orphanCount} / ${result.totalChildCards}\n`;
        report += `- **检测时间**: ${new Date(result.detectedAt).toLocaleString()}\n\n`;
        report += `### 详细信息\n\n`;
        for (const detail of result.details) {
            report += `- **卡片ID**: \`${detail.cardId}\`\n`;
            report += `  - 父卡片ID: \`${detail.parentCardId}\`\n`;
            report += `  - 挖空序号: ${detail.clozeOrd}\n`;
            report += `  - 牌组: \`${detail.deckId}\`\n`;
            report += `  - 原因: ${detail.reason}\n\n`;
        }
        return report;
    }
}
/**
 * 单例实例
 */
let cleanerInstance = null;
/**
 * 获取清理器单例
 */
export function getOrphanCardCleaner() {
    if (!cleanerInstance) {
        cleanerInstance = new OrphanCardCleaner();
    }
    return cleanerInstance;
}
