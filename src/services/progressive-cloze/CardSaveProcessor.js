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
import { Logger } from '../../utils/logger';
const logger = Logger.getInstance();
/**
 * 卡片保存处理器
 */
export class CardSaveProcessor {
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
    async beforeSave(originalCard, updatedCard, strategy, onPromptNeeded) {
        // 1. 检查内容是否变化
        if (originalCard.content === updatedCard.content) {
            logger.debug('[内容未变化] 跳过处理');
            return { card: updatedCard, needsPrompt: false };
        }
        // 2. 分析新旧格式
        const analysis = this.analyzeContent(updatedCard.content);
        const wasProgressive = !!originalCard.progressiveCloze;
        const isProgressive = analysis.isProgressiveCloze;
        const hasHistory = !!originalCard.fsrs && originalCard.fsrs.reps > 0;
        logger.debug(`[格式检测] 原格式=${wasProgressive ? '渐进式' : '普通'}, 新格式=${isProgressive ? '渐进式' : '普通'}, 有历史=${hasHistory}`);
        // 3. 处理各种转换场景
        // 场景1: 已是渐进式 → 内容变化 → 更新子挖空
        if (wasProgressive && isProgressive) {
            logger.info('[更新渐进式挖空] 更新子挖空数据');
            return {
                card: this.updateProgressiveCloze(originalCard, updatedCard, analysis),
                needsPrompt: false
            };
        }
        // 场景2: 渐进式 → 普通（降级）
        if (wasProgressive && !isProgressive) {
            logger.info('[降级] 渐进式挖空 → 普通卡片');
            return {
                card: this.convertToNormalCard(updatedCard),
                needsPrompt: false
            };
        }
        // 场景3: 普通 → 渐进式（核心场景）
        if (!wasProgressive && isProgressive) {
            logger.info(`[场景3] 普通 → 渐进式挖空，挖空数量: ${analysis.clozeCount}`);
            // 验证格式
            if (!analysis.isSequential) {
                logger.warn('[格式错误] 挖空序号不连续，跳过转换', analysis.errors);
                return { card: updatedCard, needsPrompt: false };
            }
            if (hasHistory) {
                // 有学习历史，根据策略处理
                logger.info(`[有历史数据] 处理历史继承，策略: ${strategy}`);
                return await this.handleHistoryInheritance(originalCard, updatedCard, analysis, strategy, onPromptNeeded);
            }
            else {
                // 无历史，直接转换
                logger.info('[无历史数据] 直接转换');
                const converted = this.convertToProgressiveCloze(updatedCard, analysis);
                logger.debug(`[场景3-无历史] 转换完成，验证结果:`, {
                    type: converted.type,
                    hasProgressiveCloze: !!converted.progressiveCloze,
                    hasFsrs: !!converted.fsrs,
                    hasReviewHistory: !!converted.reviewHistory
                });
                return {
                    card: converted,
                    needsPrompt: false
                };
            }
        }
        // 场景4: 普通 → 普通（内容变化但格式未变）
        return { card: updatedCard, needsPrompt: false };
    }
    /**
     * 处理历史继承
     */
    async handleHistoryInheritance(originalCard, updatedCard, analysis, strategy, onPromptNeeded) {
        let options;
        switch (strategy) {
            case 'first':
                // 第一个子挖空继承
                options = { mode: 'specific', targetIndex: 0 };
                break;
            case 'proportional':
                // 按比例分配
                options = { mode: 'proportional' };
                break;
            case 'reset':
                // 全部重置
                options = { mode: 'reset' };
                break;
            case 'prompt':
                // 需要用户选择
                if (!onPromptNeeded) {
                    logger.warn('[策略=prompt但无回调] 降级为first策略');
                    options = { mode: 'specific', targetIndex: 0 };
                }
                else {
                    // 返回需要提示的标记，由上层显示弹窗
                    return { card: updatedCard, needsPrompt: true };
                }
                break;
        }
        const converted = this.convertWithInheritance(updatedCard, analysis, options, originalCard.fsrs);
        logger.debug(`[handleHistoryInheritance] 转换完成，验证结果:`, {
            type: converted.type,
            hasProgressiveCloze: !!converted.progressiveCloze,
            hasFsrs: !!converted.fsrs,
            hasReviewHistory: !!converted.reviewHistory
        });
        return { card: converted, needsPrompt: false };
    }
    /**
     * 更新渐进式挖空（挖空数量可能变化）
     */
    updateProgressiveCloze(originalCard, updatedCard, analysis) {
        const oldCount = originalCard.progressiveCloze.totalClozes;
        const newCount = analysis.clozeCount;
        logger.debug(`[挖空数量] 原=${oldCount}, 新=${newCount}`);
        // 保持原有的progressiveCloze结构（V1.5兼容）
        const updatedAny = updatedCard;
        const originalAny = originalCard;
        updatedAny.progressiveCloze = { ...originalAny.progressiveCloze };
        if (newCount > oldCount) {
            // 新增了挖空，为新挖空初始化FSRS
            logger.debug(`[新增挖空] 初始化 c${oldCount + 1} - c${newCount}`);
            for (let i = oldCount; i < newCount; i++) {
                updatedAny.progressiveCloze.fsrsData[i] = this.createNewFSRS();
                updatedAny.progressiveCloze.reviewHistory[i] = [];
            }
        }
        else if (newCount < oldCount) {
            // 删除了挖空，清理多余的FSRS数据
            logger.debug(`[删除挖空] 清理 c${newCount + 1} - c${oldCount}`);
            for (let i = newCount; i < oldCount; i++) {
                delete updatedAny.progressiveCloze.fsrsData[i];
                delete updatedAny.progressiveCloze.reviewHistory[i];
            }
        }
        // 更新元数据
        updatedAny.progressiveCloze.clozes = analysis.clozes;
        updatedAny.progressiveCloze.totalClozes = newCount;
        return updatedCard;
    }
    /**
     * 转换回普通卡片
     *
     * @deprecated V2架构不需要此方法
     * V2中父卡片和子卡片是独立的卡片对象，没有"降级"概念
     * 如果需要删除渐进式挖空，应该删除父卡片和所有子卡片
     */
    convertToNormalCard(card) {
        logger.warn('[CardSaveProcessor] convertToNormalCard is deprecated in V2');
        // V1.5兼容逻辑（仅保留用于数据迁移）
        const cardAny = card;
        const firstCloze = cardAny.progressiveCloze?.fsrsData?.[0];
        if (firstCloze) {
            card.fsrs = firstCloze;
            card.reviewHistory = cardAny.progressiveCloze.reviewHistory?.[0] || [];
        }
        delete cardAny.progressiveCloze;
        return card;
    }
    /**
     * 转换为渐进式挖空格式（无历史继承）
     */
    convertToProgressiveCloze(card, analysis) {
        const now = new Date().toISOString();
        logger.debug(`[convertToProgressiveCloze] 开始转换，挖空数量: ${analysis.clozeCount}`);
        // ✅ 确保卡片类型为 Progressive（V1.5兼容）
        card.type = 'progressive';
        logger.debug(`[convertToProgressiveCloze] ✅ 设置 card.type = 'progressive'`);
        const cardAny = card;
        cardAny.progressiveCloze = {
            clozes: analysis.clozes,
            fsrsData: {},
            reviewHistory: {},
            totalClozes: analysis.clozeCount,
            createdAt: now
        };
        for (let i = 0; i < analysis.clozeCount; i++) {
            cardAny.progressiveCloze.fsrsData[i] = this.createNewFSRS();
            cardAny.progressiveCloze.reviewHistory[i] = [];
        }
        delete card.fsrs;
        delete card.reviewHistory;
        logger.debug(`[convertToProgressiveCloze] ✅ 删除 card.fsrs 和 card.reviewHistory`);
        return card;
    }
    /**
     * 带继承的转换
     */
    convertWithInheritance(card, analysis, options, parentFsrs) {
        const now = new Date().toISOString();
        const clozeCount = analysis.clozeCount;
        logger.debug(`[继承模式] ${options.mode}, 目标索引=${options.targetIndex}`);
        // ✅ 确保卡片类型为 Progressive
        card.type = 'progressive';
        logger.debug(`[convertWithInheritance] ✅ 设置 card.type = 'progressive'`);
        // 初始化 progressiveCloze（V1.5兼容）
        const cardAny = card;
        cardAny.progressiveCloze = {
            clozes: analysis.clozes,
            fsrsData: {},
            reviewHistory: {},
            totalClozes: clozeCount,
            createdAt: now
        };
        // 根据模式分配FSRS数据
        for (let i = 0; i < clozeCount; i++) {
            if (options.mode === 'specific' && i === options.targetIndex) {
                // 指定子挖空继承全部
                cardAny.progressiveCloze.fsrsData[i] = { ...parentFsrs };
                cardAny.progressiveCloze.reviewHistory[i] = []; // 清空历史记录
                logger.debug(`[继承] 子挖空 ${i + 1} 继承全部FSRS数据`);
            }
            else if (options.mode === 'proportional') {
                // 按比例分配
                cardAny.progressiveCloze.fsrsData[i] = {
                    ...parentFsrs,
                    stability: parentFsrs.stability / clozeCount,
                    difficulty: parentFsrs.difficulty,
                    reps: Math.ceil(parentFsrs.reps / clozeCount)
                };
                cardAny.progressiveCloze.reviewHistory[i] = []; // 清空历史记录
                logger.debug(`[按比例] 子挖空 ${i + 1} 获得 ${Math.ceil(parentFsrs.reps / clozeCount)} 次复习`);
            }
            else {
                // 新卡片
                cardAny.progressiveCloze.fsrsData[i] = this.createNewFSRS();
                cardAny.progressiveCloze.reviewHistory[i] = [];
            }
        }
        // 清除父卡片FSRS
        delete card.fsrs;
        delete card.reviewHistory;
        logger.debug(`[convertWithInheritance] ✅ 删除 card.fsrs 和 card.reviewHistory`);
        return card;
    }
    /**
     * 分析卡片内容
     */
    analyzeContent(content) {
        const regex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
        const matches = Array.from(content.matchAll(regex));
        const clozes = matches.map(match => ({
            ord: parseInt(match[1]) - 1,
            text: match[2].trim(),
            hint: match[3]?.trim()
        }));
        const { isSequential, errors } = this.checkSequential(clozes);
        return {
            isProgressiveCloze: clozes.length >= 2,
            clozeCount: clozes.length,
            clozes,
            isSequential,
            errors
        };
    }
    /**
     * 检查序号是否连续
     */
    checkSequential(clozes) {
        if (clozes.length === 0) {
            return { isSequential: true };
        }
        const errors = [];
        const ords = clozes.map(c => c.ord).sort((a, b) => a - b);
        if (ords[0] !== 0) {
            errors.push(`挖空序号应从 c1 开始`);
        }
        for (let i = 0; i < ords.length; i++) {
            if (ords[i] !== i) {
                errors.push(`挖空序号不连续`);
                break;
            }
        }
        const uniqueOrds = new Set(ords);
        if (uniqueOrds.size !== ords.length) {
            errors.push('存在重复的挖空序号');
        }
        return {
            isSequential: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * 创建新的FSRS卡片数据
     */
    createNewFSRS() {
        const now = new Date().toISOString();
        return {
            due: now,
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            retrievability: 1
        };
    }
}
