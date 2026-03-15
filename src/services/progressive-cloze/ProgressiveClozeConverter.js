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
import { CardType } from '../../data/types';
import { generateUUID } from '../../utils/helpers';
import { FSRS } from '../../algorithms/fsrs';
import { setCardProperty } from '../../utils/yaml-utils';
/**
 * 渐进式挖空转换器
 */
export class ProgressiveClozeConverter {
    fsrs;
    constructor() {
        // 使用默认FSRS参数，实际使用时应注入配置
        this.fsrs = new FSRS();
    }
    // ==========================================================================
    // 挖空解析
    // ==========================================================================
    /**
     * 解析content中的挖空信息
     *
     * @param content Markdown内容
     * @returns 解析结果
     */
    parseClozes(content) {
        const clozes = [];
        const errors = [];
        // 匹配所有挖空：{{c1::text}} 或 {{c1::text::hint}}
        const clozePattern = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
        let match;
        const ordSet = new Set();
        while ((match = clozePattern.exec(content)) !== null) {
            const ordNum = parseInt(match[1], 10);
            const ord = ordNum - 1; // 转换为0-based
            const text = match[2].trim();
            const hint = match[3]?.trim();
            if (ordNum < 1) {
                errors.push(`Invalid cloze number: c${ordNum} (must be >= 1)`);
                continue;
            }
            ordSet.add(ord);
            // 检查是否已存在该ord
            const existingIndex = clozes.findIndex(c => c.ord === ord);
            if (existingIndex >= 0) {
                // 合并同序号挖空
                clozes[existingIndex].text += `, ${text}`;
                if (hint && !clozes[existingIndex].hint) {
                    clozes[existingIndex].hint = hint;
                }
            }
            else {
                clozes.push({
                    ord,
                    text,
                    hint,
                    position: {
                        start: match.index,
                        end: match.index + match[0].length
                    }
                });
            }
        }
        // 按ord排序
        clozes.sort((a, b) => a.ord - b.ord);
        // 检查挖空序号连续性
        if (clozes.length > 0) {
            const expectedOrds = Array.from({ length: clozes.length }, (_, i) => i);
            const actualOrds = clozes.map(c => c.ord);
            const missingOrds = expectedOrds.filter(ord => !actualOrds.includes(ord));
            if (missingOrds.length > 0) {
                errors.push(`Cloze numbers are not continuous. Missing: ${missingOrds.map(o => `c${o + 1}`).join(', ')}`);
            }
        }
        const totalClozes = ordSet.size;
        const isProgressive = totalClozes >= 2;
        return {
            hasValidClozes: clozes.length > 0 && errors.length === 0,
            clozes,
            totalClozes,
            isProgressive,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * 检查卡片是否可以转换为渐进式挖空
     *
     * @param card 卡片
     * @returns 是否可以转换
     */
    canConvert(card) {
        if (!card.content) {
            return false;
        }
        const parseResult = this.parseClozes(card.content);
        return parseResult.isProgressive && parseResult.hasValidClozes;
    }
    // ==========================================================================
    // 卡片转换
    // ==========================================================================
    /**
     * 将普通挖空卡片转换为渐进式挖空
     *
     * @param sourceCard 源卡片
     * @param options 转换选项
     * @returns 转换结果：{ parent, children }
     * @throws Error 如果卡片无法转换
     */
    convert(sourceCard, options = {}) {
        // 解析挖空
        const parseResult = this.parseClozes(sourceCard.content);
        if (!parseResult.hasValidClozes) {
            throw new Error(`Card cannot be converted: ${parseResult.errors?.join('; ') || 'No valid clozes'}`);
        }
        if (!parseResult.isProgressive) {
            throw new Error(`Card has only ${parseResult.totalClozes} cloze(s), need at least 2 for progressive cloze`);
        }
        const { inheritFsrs = false, inheritanceMode = 'first-only', keepParent = true, createdAt = new Date().toISOString() } = options;
        // 创建子卡片
        const children = this.createChildCards(sourceCard, parseResult.clozes, {
            inheritFsrs,
            inheritanceMode,
            createdAt
        });
        // 创建父卡片
        const parent = this.createParentCard(sourceCard, children, parseResult.clozes);
        return { parent, children };
    }
    /**
     * 创建父卡片
     */
    createParentCard(sourceCard, children, clozes) {
        // 🔧 v2.2: 同时更新 content YAML 的 we_type
        const updatedContent = setCardProperty(sourceCard.content || '', 'we_type', CardType.ProgressiveParent);
        const parentCard = {
            ...sourceCard,
            uuid: sourceCard.uuid, // 保持原UUID
            type: CardType.ProgressiveParent,
            content: updatedContent,
            progressiveCloze: {
                childCardIds: children.map(c => c.uuid),
                totalClozes: clozes.length,
                createdAt: new Date().toISOString()
            },
            // 移除学习数据
            fsrs: undefined,
            reviewHistory: undefined,
            modified: new Date().toISOString()
        };
        return parentCard;
    }
    /**
     * 创建子卡片列表
     */
    createChildCards(sourceCard, clozes, options) {
        const children = [];
        for (let i = 0; i < clozes.length; i++) {
            const cloze = clozes[i];
            // 2. 处理FSRS继承
            let fsrsData;
            let reviewHistory = [];
            // 🆕 P1: 初始分散配置
            const MIN_SIBLING_SPACING = 5; // 5天最小间隔（基于CleverDeck和Anki社区标准）
            const daysOffset = i * MIN_SIBLING_SPACING; // 第i张卡片偏移i*5天
            if (options.inheritanceMode !== 'none') {
                if (options.inheritanceMode === 'first-only' && i === 0) {
                    // 第一个子卡片继承：克隆父卡片的FSRS和复习历史
                    if (sourceCard.fsrs) {
                        fsrsData = this.cloneFsrsData(sourceCard.fsrs);
                        reviewHistory = sourceCard.reviewHistory || [];
                    }
                    else {
                        fsrsData = this.createNewFsrs(daysOffset);
                    }
                }
                else if (options.inheritanceMode === 'proportional') {
                    // 按比例分配（简化版：所有子卡片共享）
                    if (sourceCard.fsrs) {
                        fsrsData = this.cloneFsrsData(sourceCard.fsrs);
                        reviewHistory = sourceCard.reviewHistory || [];
                    }
                    else {
                        fsrsData = this.createNewFsrs(daysOffset);
                    }
                }
                else {
                    // 不继承，创建新FSRS（应用初始分散）
                    fsrsData = this.createNewFsrs(daysOffset);
                }
            }
            else {
                // 不继承，创建新FSRS（应用初始分散）
                fsrsData = this.createNewFsrs(daysOffset);
            }
            // 🔧 v2.2: 同时更新 content YAML 的 we_type
            const childContent = setCardProperty(sourceCard.content || '', 'we_type', CardType.ProgressiveChild);
            const childCard = {
                ...sourceCard,
                uuid: generateUUID(), // 新UUID
                type: CardType.ProgressiveChild,
                parentCardId: sourceCard.uuid,
                clozeOrd: cloze.ord,
                content: childContent, // ✅ V2优化：冗余存储父卡片内容（数据安全 + 性能优化）
                fsrs: fsrsData,
                reviewHistory,
                clozeSnapshot: {
                    text: cloze.text,
                    hint: cloze.hint
                },
                // 移除不需要的字段
                progressiveCloze: undefined,
                created: options.createdAt,
                modified: options.createdAt
            };
            children.push(childCard);
        }
        return children;
    }
    // ==========================================================================
    // FSRS工具方法
    // ==========================================================================
    /**
     * 创建新的FSRS数据
     *
     * @param daysOffset P1优化：初始分散天数偏移（用于兄弟卡片分散）
     */
    createNewFsrs(daysOffset = 0) {
        const now = new Date();
        // 🆕 P1: 创建时初始分散 - 为子卡片添加天数偏移
        // 避免兄弟卡片在相近日期出现，减少记忆干扰
        if (daysOffset > 0) {
            now.setDate(now.getDate() + daysOffset);
        }
        return {
            due: now.toISOString(),
            stability: 0,
            difficulty: 5,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0, // New
            lastReview: undefined,
            retrievability: 1
        };
    }
    /**
     * 克隆FSRS数据
     */
    cloneFsrsData(fsrs) {
        return {
            ...fsrs,
            // 保持所有字段一致
        };
    }
    // ==========================================================================
    // 批量转换
    // ==========================================================================
    /**
     * 批量转换卡片
     *
     * @param cards 卡片列表
     * @param options 转换选项
     * @returns 转换结果列表
     */
    convertBatch(cards, options = {}) {
        return cards.map(card => {
            try {
                if (!this.canConvert(card)) {
                    return {
                        sourceCard: card,
                        parent: null,
                        children: [],
                        success: false,
                        error: 'Card cannot be converted to progressive cloze'
                    };
                }
                const { parent, children } = this.convert(card, options);
                return {
                    sourceCard: card,
                    parent,
                    children,
                    success: true
                };
            }
            catch (error) {
                return {
                    sourceCard: card,
                    parent: null,
                    children: [],
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });
    }
}
