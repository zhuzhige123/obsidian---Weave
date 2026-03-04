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
import type { Card } from '../../data/types';
import type { ProgressiveClozeParentCard, ProgressiveClozeChildCard } from '../../types/progressive-cloze-v2';
import { type CardCreationResult } from './CardCreationProcessor';
/**
 * 卡片存储服务接口
 */
export interface ICardStorageService {
    /** 保存单张卡片 */
    saveCard(card: Card): Promise<void>;
    /** 批量保存卡片 */
    saveCards(cards: Card[]): Promise<void>;
    /** 删除卡片 */
    deleteCard(uuid: string): Promise<void>;
    /** 批量删除卡片 */
    deleteCards(uuids: string[]): Promise<void>;
    /** 获取卡片 */
    getCard(uuid: string): Card | null;
    /** 批量获取卡片 */
    getCards(uuids: string[]): Card[];
}
/**
 * 卡片创建选项
 */
export interface CardCreationOptions {
    /** 是否自动保存 */
    autoSave?: boolean;
    /** 是否继承FSRS数据（用于转换已有卡片） */
    inheritFsrs?: boolean;
    /** FSRS继承模式 */
    inheritanceMode?: 'none' | 'first-only' | 'proportional';
}
/**
 * 渐进式挖空卡片管理器
 */
export declare class ProgressiveClozeCardManager {
    private storageService?;
    private processor;
    constructor(storageService?: ICardStorageService | undefined);
    /**
     * 创建卡片（自动检测渐进式挖空）
     *
     * @param card 待创建的卡片
     * @param options 创建选项
     * @returns 创建结果
     */
    createCard(card: Card, options?: CardCreationOptions): Promise<CardCreationResult>;
    /**
     * 批量创建卡片
     *
     * @param cards 卡片列表
     * @param options 创建选项
     * @returns 创建结果列表
     */
    createCards(cards: Card[], options?: CardCreationOptions): Promise<CardCreationResult[]>;
    /**
     * 更新父卡片内容（V2: 同时更新所有子卡片的 content）
     *
     * V2 架构：子卡片存储完整 content，需要同步更新
     *
     * @param parentCard 父卡片
     * @returns 更新是否成功
     */
    updateParentCard(parentCard: ProgressiveClozeParentCard): Promise<boolean>;
    /**
     * 删除渐进式挖空卡片（包括父卡片和所有子卡片）
     *
     * @param parentCardId 父卡片UUID
     * @returns 删除是否成功
     */
    deleteProgressiveCloze(parentCardId: string): Promise<boolean>;
    /**
     * 删除单个子卡片
     *
     * 注意：如果删除后只剩1个子卡片，应该降级为普通卡片
     *
     * @param childCardId 子卡片UUID
     * @returns 删除是否成功
     */
    deleteChildCard(childCardId: string): Promise<boolean>;
    /**
     * 获取父卡片的所有子卡片
     *
     * @param parentCardId 父卡片UUID
     * @returns 子卡片列表
     */
    getChildCards(parentCardId: string): ProgressiveClozeChildCard[];
}
