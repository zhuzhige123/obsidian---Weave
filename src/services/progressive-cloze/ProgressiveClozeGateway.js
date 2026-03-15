/**
 * 渐进式挖空网关 - 统一处理层
 *
 * 职责：
 * 1. 第一道门：外部新增卡片时自动检测和转换渐进式挖空
 * 2. 第二道门：内部内容变化时监测题型转换
 * 3. 统一调用：所有入口点通过此网关处理渐进式挖空
 *
 * 架构原则：
 * - 单一入口：所有渐进式挖空处理都经过此网关
 * - V2架构：只生成 progressive-parent + progressive-child
 * - 自动转换：检测到多个挖空自动调用转换器
 *
 * @module services/progressive-cloze/ProgressiveClozeGateway
 * @version 1.0.0
 */
import { CardType } from '../../data/types';
import { ProgressiveClozeConverter } from './ProgressiveClozeConverter';
import { getCardDeckIds, setCardProperty } from '../../utils/yaml-utils';
import { logger } from '../../utils/logger';
import { isProgressiveClozeChild } from '../../types/progressive-cloze-v2';
import { generateUUID } from '../../utils/helpers';
/**
 * 渐进式挖空网关
 */
export class ProgressiveClozeGateway {
    converter;
    constructor() {
        this.converter = new ProgressiveClozeConverter();
    }
    // ==========================================================================
    // 第一道门：外部新增卡片处理
    // ==========================================================================
    /**
     * 处理新创建的卡片
     *
     * 使用场景：
     * 1. 新建卡片模态窗
     * 2. Obsidian标注块
     * 3. 批量解析扫描
     * 4. APKG导入
     * 5. AnkiConnect导入
     * 6. AI制卡生成
     * 7. AI拆分卡片
     *
     * @param card 待处理的卡片（可能type已经是'progressive'或检测后的类型）
     * @returns 处理结果
     */
    async processNewCard(card) {
        logger.debug(`[ProgressiveClozeGateway] 处理新卡片: ${card.uuid}, type=${card.type}`);
        // 0. 已经是渐进式挖空卡片的不再重复转换
        if (card.type === CardType.ProgressiveParent || card.type === CardType.ProgressiveChild) {
            logger.debug(`[ProgressiveClozeGateway] 卡片已是渐进式挖空类型(${card.type})，跳过转换`);
            return {
                converted: false,
                cards: [card],
                originalCardId: card.uuid,
                conversionType: 'none'
            };
        }
        // 1. 检查卡片内容
        if (!card.content || !card.content.trim()) {
            logger.debug(`[ProgressiveClozeGateway] 卡片内容为空，跳过处理`);
            return {
                converted: false,
                cards: [card],
                originalCardId: card.uuid,
                conversionType: 'none'
            };
        }
        // 2. 解析挖空
        const parseResult = this.converter.parseClozes(card.content);
        // 3. 判断是否需要转换为渐进式挖空
        if (!parseResult.isProgressive) {
            // 普通挖空或非挖空卡片
            logger.debug(`[ProgressiveClozeGateway] 挖空数量=${parseResult.totalClozes}，不需要转换`);
            // 🔧 v2.2: 同时更新派生字段和 YAML 的 we_type
            if (parseResult.totalClozes === 1 && card.type !== CardType.Cloze) {
                card.type = CardType.Cloze;
                card.content = setCardProperty(card.content || '', 'we_type', CardType.Cloze);
            }
            else if (parseResult.totalClozes === 0 && card.type === CardType.Cloze) {
                card.type = CardType.Basic;
                card.content = setCardProperty(card.content || '', 'we_type', CardType.Basic);
            }
            return {
                converted: false,
                cards: [card],
                originalCardId: card.uuid,
                conversionType: 'none'
            };
        }
        // 4. 需要转换为渐进式挖空
        logger.info(`[ProgressiveClozeGateway] 检测到${parseResult.totalClozes}个挖空，转换为渐进式挖空`);
        try {
            // 5. 调用转换器
            const { parent, children } = this.converter.convert(card, {
                inheritFsrs: false, // 新卡片不继承FSRS
                keepParent: true,
                createdAt: new Date().toISOString()
            });
            logger.info(`[ProgressiveClozeGateway] ✅ 转换成功: 1父 + ${children.length}子`);
            return {
                converted: true,
                cards: [parent, ...children],
                originalCardId: parent.uuid,
                conversionType: 'to-progressive'
            };
        }
        catch (error) {
            logger.error(`[ProgressiveClozeGateway] ❌ 转换失败:`, error);
            // 转换失败，返回普通挖空卡片
            card.type = CardType.Cloze;
            card.content = setCardProperty(card.content || '', 'we_type', CardType.Cloze);
            return {
                converted: false,
                cards: [card],
                originalCardId: card.uuid,
                conversionType: 'none'
            };
        }
    }
    /**
     * 批量处理卡片数组
     *
     * @param cards 待处理的卡片数组
     * @returns 处理后的卡片数组（可能包含父子卡片）
     */
    async processBatch(cards) {
        const result = [];
        for (const card of cards) {
            const processResult = await this.processNewCard(card);
            result.push(...processResult.cards);
        }
        logger.info(`[ProgressiveClozeGateway] 批量处理完成: ${cards.length}张 → ${result.length}张`);
        return result;
    }
    // ==========================================================================
    // 第二道门：内部内容变化监测
    // ==========================================================================
    /**
     * 检测内容变化
     *
     * 使用场景：
     * 1. 编辑器保存卡片时
     * 2. 学习界面编辑保存时
     * 3. 编辑模态窗保存时
     *
     * @param oldCard 旧卡片
     * @param newContent 新内容
     * @returns 变化检测结果
     */
    detectContentChange(oldCard, newContent) {
        // 1. 解析旧内容
        const oldParseResult = this.converter.parseClozes(oldCard.content || '');
        const oldClozeCount = oldParseResult.totalClozes;
        const oldIsProgressive = oldParseResult.isProgressive;
        // 2. 解析新内容
        const newParseResult = this.converter.parseClozes(newContent);
        const newClozeCount = newParseResult.totalClozes;
        const newIsProgressive = newParseResult.isProgressive;
        logger.debug(`[ProgressiveClozeGateway] 内容变化检测: ` +
            `旧=${oldClozeCount}个挖空(progressive=${oldIsProgressive}), ` +
            `新=${newClozeCount}个挖空(progressive=${newIsProgressive})`);
        // 3. 判断变化类型
        // 3.1 普通挖空 → 渐进式挖空
        if (!oldIsProgressive && newIsProgressive) {
            return {
                needsProcessing: true,
                changeType: 'to-progressive',
                oldClozeCount,
                newClozeCount,
                recommendation: '需要将卡片转换为渐进式挖空（1父 + N子）'
            };
        }
        // 3.2 渐进式挖空 → 普通挖空
        if (oldIsProgressive && !newIsProgressive) {
            return {
                needsProcessing: true,
                changeType: 'to-simple',
                oldClozeCount,
                newClozeCount,
                recommendation: '需要删除子卡片，保留父卡片并转为普通挖空'
            };
        }
        // 3.3 渐进式挖空序号集合变化（包含数量变化和序号替换）
        if (oldIsProgressive && newIsProgressive) {
            const oldOrdinals = new Set(oldParseResult.clozes.map(c => c.ord));
            const newOrdinals = new Set(newParseResult.clozes.map(c => c.ord));
            const ordinalsChanged = oldOrdinals.size !== newOrdinals.size ||
                [...oldOrdinals].some(ord => !newOrdinals.has(ord));
            if (ordinalsChanged) {
                return {
                    needsProcessing: true,
                    changeType: 'ordinal-changed',
                    oldClozeCount,
                    newClozeCount,
                    oldOrdinals,
                    newOrdinals,
                    recommendation: '序号集合变化，需要按差异处理子卡片'
                };
            }
            // 3.4 序号集合不变但内容变化
            if (oldCard.content !== newContent) {
                return {
                    needsProcessing: true,
                    changeType: 'content-only',
                    oldClozeCount,
                    newClozeCount,
                    recommendation: '仅同步内容到子卡片，无需重建'
                };
            }
        }
        // 3.5 无需处理
        return {
            needsProcessing: false,
            changeType: 'none',
            oldClozeCount,
            newClozeCount
        };
    }
    /**
     * 处理内容变化（执行转换）
     *
     * @param oldCard 旧卡片
     * @param newContent 新内容
     * @param dataStorage 数据存储服务（用于删除/保存卡片和获取牌组卡片）
     * @param onConfirmNeeded 需要用户确认时的回调（删除子卡片/降级等场景）
     * @returns 处理后的卡片数组，null 表示保存被用户取消
     */
    async processContentChange(oldCard, newContent, dataStorage, onConfirmNeeded, onExitChoiceNeeded) {
        const changeResult = this.detectContentChange(oldCard, newContent);
        if (!changeResult.needsProcessing) {
            logger.debug(`[ProgressiveClozeGateway] 内容无需处理，直接返回`);
            return [{ ...oldCard, content: newContent }];
        }
        logger.info(`[ProgressiveClozeGateway] 处理内容变化: ${changeResult.changeType}, ` +
            `${changeResult.recommendation}`);
        switch (changeResult.changeType) {
            case 'to-progressive':
                return await this.handleConvertToProgressive(oldCard, newContent);
            case 'to-simple':
                return await this.handleConvertToSimple(oldCard, newContent, dataStorage, onConfirmNeeded, onExitChoiceNeeded);
            case 'ordinal-changed':
                return await this.handleOrdinalDiff(oldCard, newContent, changeResult, dataStorage, onConfirmNeeded);
            case 'content-only':
                return await this.handleContentOnlyChange(oldCard, newContent, dataStorage);
            default:
                return [{ ...oldCard, content: newContent }];
        }
    }
    /**
     * 处理转换为渐进式挖空
     */
    async handleConvertToProgressive(oldCard, newContent) {
        const updatedCard = { ...oldCard, content: newContent };
        const processResult = await this.processNewCard(updatedCard);
        return processResult.cards;
    }
    /**
     * 处理转换为普通挖空（降级）
     * 需要用户确认后才会删除所有子卡片
     */
    async handleConvertToSimple(oldCard, newContent, dataStorage, onConfirmNeeded, onExitChoiceNeeded) {
        if (oldCard.type !== CardType.ProgressiveParent) {
            // 非父卡片，直接转换
            const updatedCard = {
                ...oldCard,
                type: CardType.Cloze,
                content: setCardProperty(newContent, 'we_type', CardType.Cloze),
                modified: new Date().toISOString()
            };
            delete updatedCard.progressiveCloze;
            return [updatedCard];
        }
        const childCards = (await this.findChildCards(oldCard, dataStorage)).filter(isProgressiveClozeChild);
        const newParseResult = this.converter.parseClozes(newContent);
        const newType = newParseResult.totalClozes === 1 ? CardType.Cloze : CardType.Basic;
        const nextContent = setCardProperty(newContent, 'we_type', newType);
        let exitChoice = { mode: 'reset-all' };
        if (childCards.length > 0) {
            if (onExitChoiceNeeded) {
                exitChoice = await onExitChoiceNeeded(oldCard, childCards, newType);
            }
            else if (onConfirmNeeded) {
                const confirmed = await onConfirmNeeded(`当前卡片内容已不满足渐进式挖空格式。\n将转为普通卡片，${childCards.length}个子卡片及其复习历史会被删除。\n\n确认继续？取消将返回编辑。`, '确认退出渐进式挖空');
                exitChoice = confirmed ? { mode: 'reset-all' } : { mode: 'cancel' };
            }
        }
        if (exitChoice.mode === 'cancel') {
            logger.info(`[ProgressiveClozeGateway] 用户取消退出渐进式挖空`);
            return null;
        }
        let inheritedChild;
        if (exitChoice.mode === 'inherit-child') {
            inheritedChild = childCards.find(child => child.uuid === exitChoice.childUuid);
            if (!inheritedChild) {
                logger.warn(`[ProgressiveClozeGateway] 未找到要继承历史的子卡片，降级为全部重置`);
                exitChoice = { mode: 'reset-all' };
            }
        }
        logger.info(`[ProgressiveClozeGateway] 开始删除${childCards.length}个子卡片`);
        for (const childCard of childCards) {
            await dataStorage.deleteCard(childCard.uuid);
        }
        const updatedCard = {
            ...oldCard,
            type: newType,
            content: nextContent,
            modified: new Date().toISOString()
        };
        delete updatedCard.progressiveCloze;
        if (exitChoice.mode === 'inherit-child' && inheritedChild) {
            updatedCard.fsrs = inheritedChild.fsrs;
            updatedCard.reviewHistory = inheritedChild.reviewHistory || [];
        }
        else {
            updatedCard.fsrs = this.createNewFsrs();
            updatedCard.reviewHistory = [];
        }
        logger.info(`[ProgressiveClozeGateway] 降级完成: progressive-parent -> ${newType}, mode=${exitChoice.mode}`);
        return [updatedCard];
    }
    /**
     * 处理序号差异（精确按序号增删子卡片，保留不变序号的复习历史）
     */
    async handleOrdinalDiff(oldCard, newContent, changeResult, dataStorage, onConfirmNeeded) {
        if (oldCard.type !== CardType.ProgressiveParent) {
            // 非父卡片回退到重建
            const updatedCard = { ...oldCard, content: newContent };
            const processResult = await this.processNewCard(updatedCard);
            return processResult.cards;
        }
        // 1. 获取现有子卡片并建立序号映射
        const existingChildCards = await this.findChildCards(oldCard, dataStorage);
        const ordToChild = new Map();
        for (const child of existingChildCards) {
            if (isProgressiveClozeChild(child)) {
                ordToChild.set(child.clozeOrd, child);
            }
        }
        // 2. 解析新内容的序号集合
        const newParseResult = this.converter.parseClozes(newContent);
        const newOrdinals = new Set(newParseResult.clozes.map(c => c.ord));
        const existingOrdinals = new Set(ordToChild.keys());
        // 3. 计算差异
        const diff = this.computeOrdinalDiff(existingOrdinals, newOrdinals);
        logger.info(`[ProgressiveClozeGateway] 序号差异: ` +
            `删除=${JSON.stringify(diff.removedOrds)}, ` +
            `新增=${JSON.stringify(diff.addedOrds)}, ` +
            `保留=${JSON.stringify(diff.retainedOrds)}`);
        // 4. 如果有需要删除的序号，请求用户确认
        if (diff.removedOrds.length > 0 && onConfirmNeeded) {
            const removedLabels = diff.removedOrds.map(ord => `c${ord + 1}`).join(', ');
            const removedChildren = diff.removedOrds
                .map(ord => ordToChild.get(ord))
                .filter(Boolean);
            const hasStudied = removedChildren.some(c => c.fsrs && c.fsrs.reps > 0);
            let message = `检测到以下挖空序号被移除: ${removedLabels}\n`;
            message += `对应的${removedChildren.length}个子卡片及其复习历史将被永久删除。`;
            if (hasStudied) {
                message += `\n\n注意：部分子卡片已有学习记录，删除后无法恢复。`;
            }
            message += `\n\n确认删除？取消将返回编辑。`;
            const confirmed = await onConfirmNeeded(message, '确认删除子卡片');
            if (!confirmed) {
                logger.info(`[ProgressiveClozeGateway] 用户取消序号变更`);
                return null;
            }
        }
        // 5. 执行删除
        for (const ord of diff.removedOrds) {
            const child = ordToChild.get(ord);
            if (child) {
                await dataStorage.deleteCard(child.uuid);
                logger.debug(`[ProgressiveClozeGateway] 已删除子卡片: c${ord + 1} (${child.uuid})`);
            }
        }
        // 6. 同步保留的子卡片内容
        const updatedChildren = [];
        for (const ord of diff.retainedOrds) {
            const child = ordToChild.get(ord);
            if (child) {
                const clozeData = newParseResult.clozes.find(c => c.ord === ord);
                const updatedChild = {
                    ...child,
                    content: this.toProgressiveChildContent(newContent),
                    modified: new Date().toISOString(),
                    clozeSnapshot: clozeData
                        ? {
                            text: clozeData.text,
                            hint: clozeData.hint
                        }
                        : child.clozeSnapshot
                };
                await dataStorage.saveCard(updatedChild);
                updatedChildren.push(updatedChild);
                logger.debug(`[ProgressiveClozeGateway] 已同步子卡片: c${ord + 1} (${child.uuid})`);
            }
        }
        // 7. 为新增的序号创建子卡片
        const newChildren = [];
        for (const ord of diff.addedOrds) {
            const clozeData = newParseResult.clozes.find(c => c.ord === ord);
            if (!clozeData)
                continue;
            const childContent = this.toProgressiveChildContent(newContent);
            const newChild = {
                ...oldCard,
                uuid: generateUUID(),
                type: CardType.ProgressiveChild,
                parentCardId: oldCard.uuid,
                clozeOrd: ord,
                content: childContent,
                fsrs: this.createNewFsrs(),
                reviewHistory: [],
                clozeSnapshot: {
                    text: clozeData.text,
                    hint: clozeData.hint
                },
                progressiveCloze: undefined,
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };
            await dataStorage.saveCard(newChild);
            newChildren.push(newChild);
            logger.debug(`[ProgressiveClozeGateway] 已创建子卡片: c${ord + 1} (${newChild.uuid})`);
        }
        // 8. 更新父卡片
        const allChildIds = [
            ...diff.retainedOrds.map(ord => ordToChild.get(ord).uuid),
            ...newChildren.map(c => c.uuid)
        ];
        const updatedParent = {
            ...oldCard,
            content: setCardProperty(newContent, 'we_type', CardType.ProgressiveParent),
            modified: new Date().toISOString()
        };
        updatedParent.progressiveCloze = {
            childCardIds: allChildIds,
            totalClozes: newOrdinals.size,
            createdAt: oldCard.progressiveCloze?.createdAt || new Date().toISOString()
        };
        logger.info(`[ProgressiveClozeGateway] 序号差异处理完成: ` +
            `删除${diff.removedOrds.length}, 保留${diff.retainedOrds.length}, 新增${diff.addedOrds.length}`);
        return [updatedParent, ...updatedChildren, ...newChildren];
    }
    /**
     * 处理仅内容变化（挖空数量不变）
     * ✅ V2.1优化：同步content到子卡片，无需重建
     */
    async handleContentOnlyChange(oldCard, newContent, dataStorage) {
        logger.info(`[ProgressiveClozeGateway] 内容变化（挖空数量不变），同步到子卡片`);
        // 1. 更新父卡片
        const updatedParent = {
            ...oldCard,
            content: setCardProperty(newContent, 'we_type', CardType.ProgressiveParent),
            modified: new Date().toISOString()
        };
        // 2. 查找并更新所有子卡片
        if (oldCard.type === CardType.ProgressiveParent) {
            // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
            const { primaryDeckId } = getCardDeckIds(oldCard);
            const deckId = primaryDeckId || oldCard.deckId || '';
            const allCards = await dataStorage.getDeckCards(deckId);
            const childCards = allCards.filter(c => c.type === CardType.ProgressiveChild &&
                c.parentCardId === oldCard.uuid);
            logger.info(`[ProgressiveClozeGateway] 找到${childCards.length}个子卡片，开始同步内容`);
            const parseResult = this.converter.parseClozes(newContent);
            // 3. 同步内容到每个子卡片
            const updatedChildren = [];
            for (const childCard of childCards) {
                const clozeData = parseResult.clozes.find(c => c.ord === childCard.clozeOrd);
                const updatedChild = {
                    ...childCard,
                    content: this.toProgressiveChildContent(newContent),
                    modified: new Date().toISOString(),
                    clozeSnapshot: clozeData
                        ? {
                            text: clozeData.text,
                            hint: clozeData.hint
                        }
                        : childCard.clozeSnapshot
                };
                // 保存子卡片（注意：不能调用saveCard，会触发Gateway递归）
                // 这里需要直接调用底层保存方法
                await dataStorage.saveCard(updatedChild);
                updatedChildren.push(updatedChild);
                logger.debug(`[ProgressiveClozeGateway] ✓ 已同步子卡片: ${childCard.uuid} (clozeOrd: ${childCard.clozeOrd})`);
            }
            logger.info(`[ProgressiveClozeGateway] ✅ 内容同步完成: ${updatedChildren.length}个子卡片`);
            // 4. 返回父卡片+所有子卡片
            return [updatedParent, ...updatedChildren];
        }
        // 如果不是父卡片，只返回更新后的卡片
        return [updatedParent];
    }
    // ==========================================================================
    // 工具方法
    // ==========================================================================
    /**
     * 快速检测内容是否包含渐进式挖空
     *
     * @param content 内容
     * @returns 是否为渐进式挖空
     */
    isProgressiveCloze(content) {
        const parseResult = this.converter.parseClozes(content);
        return parseResult.isProgressive;
    }
    /**
     * 获取挖空数量
     *
     * @param content 内容
     * @returns 挖空数量
     */
    getClozeCount(content) {
        const parseResult = this.converter.parseClozes(content);
        return parseResult.totalClozes;
    }
    // ==========================================================================
    // 内部辅助方法
    // ==========================================================================
    /**
     * 查找父卡片的所有子卡片
     */
    async findChildCards(parentCard, dataStorage) {
        const { primaryDeckId } = getCardDeckIds(parentCard);
        const deckId = primaryDeckId || parentCard.deckId || '';
        const allCards = await dataStorage.getDeckCards(deckId);
        return allCards.filter(c => c.type === CardType.ProgressiveChild &&
            c.parentCardId === parentCard.uuid);
    }
    /**
     * 计算序号集合差异
     */
    computeOrdinalDiff(existingOrds, newOrds) {
        const removedOrds = [];
        const addedOrds = [];
        const retainedOrds = [];
        for (const ord of existingOrds) {
            if (newOrds.has(ord)) {
                retainedOrds.push(ord);
            }
            else {
                removedOrds.push(ord);
            }
        }
        for (const ord of newOrds) {
            if (!existingOrds.has(ord)) {
                addedOrds.push(ord);
            }
        }
        return {
            removedOrds: removedOrds.sort((a, b) => a - b),
            addedOrds: addedOrds.sort((a, b) => a - b),
            retainedOrds: retainedOrds.sort((a, b) => a - b)
        };
    }
    /**
     * 创建新的FSRS数据
     */
    toProgressiveChildContent(content) {
        return setCardProperty(content, 'we_type', CardType.ProgressiveChild);
    }
    createNewFsrs() {
        const now = new Date();
        return {
            due: now.toISOString(),
            stability: 0,
            difficulty: 5,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            lastReview: undefined,
            retrievability: 1
        };
    }
}
/**
 * 单例实例
 */
let gatewayInstance = null;
/**
 * 获取网关单例
 */
export function getProgressiveClozeGateway() {
    if (!gatewayInstance) {
        gatewayInstance = new ProgressiveClozeGateway();
    }
    return gatewayInstance;
}
