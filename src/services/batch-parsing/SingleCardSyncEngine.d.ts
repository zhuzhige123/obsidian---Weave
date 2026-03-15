/**
 * 单文件单卡片同步决策引擎
 * 职责：基于文件 mtime 判断是否需要同步卡片
 *
 * 决策逻辑：
 * 1. 如果卡片不存在 → 创建新卡片
 * 2. 如果文件 mtime > 数据库 modified → 更新卡片
 * 3. 如果文件 mtime <= 数据库 modified → 跳过（保护插件内编辑）
 *
 * @author Weave Team
 * @date 2025-11-03
 */
import type { Card } from '../../data/types';
import type { ParsedCard } from '../../types/newCardParsingTypes';
import type { WeaveDataStorage } from '../../data/storage';
/**
 * 同步动作类型
 */
export type SyncAction = 'create' | 'update' | 'skip';
/**
 * 同步决策结果
 */
export interface SyncDecision {
    action: SyncAction;
    reason: string;
    card?: ParsedCard;
    existingCard?: Card;
}
/**
 * 单文件单卡片同步决策引擎
 */
export declare class SingleCardSyncEngine {
    private dataStorage;
    private plugin?;
    constructor(dataStorage: WeaveDataStorage, plugin?: any | undefined);
    /**
     * 决策同步动作
     * @param parsedCard 解析后的卡片
     * @returns 同步决策
     */
    decideSyncAction(parsedCard: ParsedCard): Promise<SyncDecision>;
    /**
     * 🆕 动态获取 DirectFileReader（解决初始化时序问题）
     */
    private getDirectFileReader;
    /**
     * 根据 UUID 查找卡片
     * @param uuid 卡片 UUID
     * @returns 卡片对象或 null
     */
    private findCardByUUID;
    /**
     * 批量决策同步动作
     * @param parsedCards 解析后的卡片数组
     * @returns 同步决策数组
     */
    decideSyncActions(parsedCards: ParsedCard[]): Promise<SyncDecision[]>;
    /**
     * 获取同步统计信息
     * @param decisions 同步决策数组
     * @returns 统计对象
     */
    getSyncStatistics(decisions: SyncDecision[]): {
        createCount: number;
        updateCount: number;
        skipCount: number;
    };
    /**
     * 过滤出需要处理的卡片（排除 skip）
     * @param decisions 同步决策数组
     * @returns 需要处理的卡片数组
     */
    filterCardsToProcess(decisions: SyncDecision[]): ParsedCard[];
    /**
     * 强制同步模式（忽略 mtime 对比）
     * 用于"完全同步模式"
     * @param parsedCard 解析后的卡片
     * @returns 同步决策
     */
    forceSync(parsedCard: ParsedCard): Promise<SyncDecision>;
}
