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
import type { Card } from '../../data/types';
import { CardType } from '../../data/types';
import type { ProgressiveClozeChildCard } from '../../types/progressive-cloze-v2';
/**
 * 卡片处理结果（第一道门）
 */
export interface CardProcessResult {
    /** 是否进行了转换 */
    converted: boolean;
    /** 处理后的卡片数组（父+子 或 原卡片） */
    cards: Card[];
    /** 原卡片ID（如果发生转换，这是父卡片的ID） */
    originalCardId: string;
    /** 转换类型 */
    conversionType: 'none' | 'to-progressive';
}
/**
 * 内容变化检测结果（第二道门）
 */
export interface ContentChangeResult {
    /** 是否需要处理 */
    needsProcessing: boolean;
    /** 变化类型 */
    changeType: 'none' | 'to-progressive' | 'to-simple' | 'ordinal-changed' | 'content-only';
    /** 旧挖空数量 */
    oldClozeCount: number;
    /** 新挖空数量 */
    newClozeCount: number;
    /** 旧序号集合 */
    oldOrdinals?: Set<number>;
    /** 新序号集合 */
    newOrdinals?: Set<number>;
    /** 处理建议 */
    recommendation?: string;
}
/**
 * 序号差异分析结果
 */
export interface OrdinalDiffResult {
    /** 需要删除的序号（旧有但新无） */
    removedOrds: number[];
    /** 需要新增的序号（新有但旧无） */
    addedOrds: number[];
    /** 保留的序号（新旧都有） */
    retainedOrds: number[];
}
/**
 * 确认回调类型
 * @returns true=确认, false=取消
 */
export type ConfirmCallback = (message: string, title?: string) => Promise<boolean>;
export interface ProgressiveClozeExitChoice {
    mode: 'inherit-child' | 'reset-all' | 'cancel';
    childUuid?: string;
}
export type ExitChoiceCallback = (parentCard: Card, childCards: ProgressiveClozeChildCard[], nextType: CardType.Basic | CardType.Cloze) => Promise<ProgressiveClozeExitChoice>;
/**
 * Gateway 数据存储依赖接口
 */
export interface GatewayDataStorage {
    deleteCard: (uuid: string) => Promise<void>;
    saveCard: (card: Card) => Promise<void>;
    getDeckCards: (deckId: string) => Promise<Card[]>;
}
/**
 * 渐进式挖空网关
 */
export declare class ProgressiveClozeGateway {
    private converter;
    constructor();
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
    processNewCard(card: Card): Promise<CardProcessResult>;
    /**
     * 批量处理卡片数组
     *
     * @param cards 待处理的卡片数组
     * @returns 处理后的卡片数组（可能包含父子卡片）
     */
    processBatch(cards: Card[]): Promise<Card[]>;
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
    detectContentChange(oldCard: Card, newContent: string): ContentChangeResult;
    /**
     * 处理内容变化（执行转换）
     *
     * @param oldCard 旧卡片
     * @param newContent 新内容
     * @param dataStorage 数据存储服务（用于删除/保存卡片和获取牌组卡片）
     * @param onConfirmNeeded 需要用户确认时的回调（删除子卡片/降级等场景）
     * @returns 处理后的卡片数组，null 表示保存被用户取消
     */
    processContentChange(oldCard: Card, newContent: string, dataStorage: GatewayDataStorage, onConfirmNeeded?: ConfirmCallback, onExitChoiceNeeded?: ExitChoiceCallback): Promise<Card[] | null>;
    /**
     * 处理转换为渐进式挖空
     */
    private handleConvertToProgressive;
    /**
     * 处理转换为普通挖空（降级）
     * 需要用户确认后才会删除所有子卡片
     */
    private handleConvertToSimple;
    /**
     * 处理序号差异（精确按序号增删子卡片，保留不变序号的复习历史）
     */
    private handleOrdinalDiff;
    /**
     * 处理仅内容变化（挖空数量不变）
     * ✅ V2.1优化：同步content到子卡片，无需重建
     */
    private handleContentOnlyChange;
    /**
     * 快速检测内容是否包含渐进式挖空
     *
     * @param content 内容
     * @returns 是否为渐进式挖空
     */
    isProgressiveCloze(content: string): boolean;
    /**
     * 获取挖空数量
     *
     * @param content 内容
     * @returns 挖空数量
     */
    getClozeCount(content: string): number;
    /**
     * 查找父卡片的所有子卡片
     */
    private findChildCards;
    /**
     * 计算序号集合差异
     */
    private computeOrdinalDiff;
    /**
     * 创建新的FSRS数据
     */
    private toProgressiveChildContent;
    private createNewFsrs;
}
/**
 * 获取网关单例
 */
export declare function getProgressiveClozeGateway(): ProgressiveClozeGateway;
