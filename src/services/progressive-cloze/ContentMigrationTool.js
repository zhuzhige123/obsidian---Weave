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
import { CardType } from '../../data/types';
import { logger } from '../../utils/logger';
/**
 * 内容迁移工具
 */
export class ContentMigrationTool {
    /**
     * 执行迁移
     *
     * @param allCards 所有卡片
     * @param saveCard 保存卡片的方法
     * @param dryRun 是否为试运行（不实际保存）
     * @returns 迁移结果
     */
    async migrate(allCards, saveCard, dryRun = false) {
        logger.info('[ContentMigrationTool] 开始迁移子卡片content...');
        const result = {
            success: false,
            totalCards: allCards.length,
            parentCardsCount: 0,
            childCardsCount: 0,
            needsMigrationCount: 0,
            migratedCount: 0,
            failedCount: 0,
            failures: [],
            timestamp: new Date().toISOString()
        };
        try {
            // 1. 构建父卡片映射
            const parentMap = new Map();
            for (const card of allCards) {
                if (card.type === CardType.ProgressiveParent) {
                    parentMap.set(card.uuid, card);
                    result.parentCardsCount++;
                }
            }
            logger.info(`[ContentMigrationTool] 发现 ${parentMap.size} 个父卡片`);
            // 2. 扫描子卡片
            const childCardsToMigrate = [];
            for (const card of allCards) {
                if (card.type === CardType.ProgressiveChild) {
                    result.childCardsCount++;
                    const childCard = card;
                    // 检查是否需要迁移
                    if (!childCard.content || childCard.content.trim() === '') {
                        childCardsToMigrate.push(childCard);
                        result.needsMigrationCount++;
                    }
                }
            }
            logger.info(`[ContentMigrationTool] 发现 ${result.childCardsCount} 个子卡片，` +
                `其中 ${result.needsMigrationCount} 个需要迁移`);
            // 3. 执行迁移
            if (dryRun) {
                logger.info('[ContentMigrationTool] 试运行模式，不实际保存数据');
                result.migratedCount = result.needsMigrationCount;
                result.success = true;
            }
            else {
                for (const childCard of childCardsToMigrate) {
                    try {
                        // 获取父卡片（childCard现在确保是ProgressiveClozeChildCard类型）
                        const parentCard = parentMap.get(childCard.parentCardId);
                        if (!parentCard) {
                            // 父卡片不存在
                            result.failedCount++;
                            result.failures.push({
                                cardId: childCard.uuid,
                                parentCardId: childCard.parentCardId,
                                reason: `父卡片不存在: ${childCard.parentCardId}`
                            });
                            logger.warn(`[ContentMigrationTool] 子卡片 ${childCard.uuid} 的父卡片 ${childCard.parentCardId} 不存在`);
                            continue;
                        }
                        if (!parentCard.content) {
                            // 父卡片内容为空
                            result.failedCount++;
                            result.failures.push({
                                cardId: childCard.uuid,
                                parentCardId: childCard.parentCardId,
                                reason: '父卡片内容为空'
                            });
                            logger.warn(`[ContentMigrationTool] 父卡片 ${parentCard.uuid} 的内容为空`);
                            continue;
                        }
                        // 填充content
                        childCard.content = parentCard.content;
                        childCard.modified = new Date().toISOString();
                        // 保存
                        await saveCard(childCard);
                        result.migratedCount++;
                        logger.debug(`[ContentMigrationTool] ✓ 已迁移子卡片: ${childCard.uuid} ` +
                            `(clozeOrd: ${childCard.clozeOrd})`);
                    }
                    catch (error) {
                        result.failedCount++;
                        result.failures.push({
                            cardId: childCard.uuid,
                            parentCardId: childCard.parentCardId,
                            reason: error instanceof Error ? error.message : String(error)
                        });
                        logger.error(`[ContentMigrationTool] ✗ 迁移子卡片失败: ${childCard.uuid}`, error);
                    }
                }
                result.success = result.failedCount === 0;
            }
            // 4. 输出报告
            logger.info('[ContentMigrationTool] 迁移完成:');
            logger.info(`  - 扫描卡片: ${result.totalCards}`);
            logger.info(`  - 父卡片: ${result.parentCardsCount}`);
            logger.info(`  - 子卡片: ${result.childCardsCount}`);
            logger.info(`  - 需要迁移: ${result.needsMigrationCount}`);
            logger.info(`  - 成功迁移: ${result.migratedCount}`);
            logger.info(`  - 迁移失败: ${result.failedCount}`);
            if (result.failures.length > 0) {
                logger.warn('[ContentMigrationTool] 失败详情:');
                for (const failure of result.failures) {
                    logger.warn(`  - ${failure.cardId} (父卡片: ${failure.parentCardId}): ${failure.reason}`);
                }
            }
            return result;
        }
        catch (error) {
            logger.error('[ContentMigrationTool] 迁移过程失败:', error);
            result.success = false;
            result.error = error instanceof Error ? error.message : String(error);
            return result;
        }
    }
    /**
     * 生成迁移报告（Markdown格式）
     *
     * @param result 迁移结果
     * @returns Markdown格式的报告
     */
    generateReport(result) {
        let report = `## 渐进式挖空内容迁移报告\n\n`;
        report += `- **迁移时间**: ${new Date(result.timestamp).toLocaleString()}\n`;
        report += `- **状态**: ${result.success ? '✅ 成功' : '❌ 失败'}\n\n`;
        report += `### 统计信息\n\n`;
        report += `| 项目 | 数量 |\n`;
        report += `|------|------|\n`;
        report += `| 扫描卡片总数 | ${result.totalCards} |\n`;
        report += `| 父卡片数量 | ${result.parentCardsCount} |\n`;
        report += `| 子卡片数量 | ${result.childCardsCount} |\n`;
        report += `| 需要迁移 | ${result.needsMigrationCount} |\n`;
        report += `| 成功迁移 | ${result.migratedCount} |\n`;
        report += `| 迁移失败 | ${result.failedCount} |\n\n`;
        if (result.failures.length > 0) {
            report += `### ⚠️ 失败详情\n\n`;
            for (const failure of result.failures) {
                report += `- **卡片ID**: \`${failure.cardId}\`\n`;
                report += `  - 父卡片ID: \`${failure.parentCardId}\`\n`;
                report += `  - 原因: ${failure.reason}\n\n`;
            }
        }
        if (result.error) {
            report += `### ❌ 错误信息\n\n`;
            report += `\`\`\`\n${result.error}\n\`\`\`\n`;
        }
        return report;
    }
}
/**
 * 单例实例
 */
let migrationToolInstance = null;
/**
 * 获取迁移工具单例
 */
export function getContentMigrationTool() {
    if (!migrationToolInstance) {
        migrationToolInstance = new ContentMigrationTool();
    }
    return migrationToolInstance;
}
