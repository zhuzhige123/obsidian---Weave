/**
 * 三方合并引擎
 *
 * 核心功能：
 * 1. 对比源文件、数据库、最后扫描快照三个版本
 * 2. 智能决策：跳过、更新、保留、冲突
 * 3. 保护用户在Weave中的修改
 *
 * 设计理念：
 * - 源文件是"学习材料源头"
 * - 数据库是"学习记录载体"
 * - 快照是"版本对比基准"
 */
import type { Card } from '../../data/types';
/**
 * 同步结果
 */
export interface SyncResult {
    action: 'skipped' | 'created' | 'updated' | 'conflict' | 'kept';
    cardId?: string;
    uuid?: string;
    reason?: string;
    changes?: {
        contentChanged?: boolean;
        deckChanged?: boolean;
    };
    conflict?: ConflictInfo;
}
/**
 * 冲突信息
 */
export interface ConflictInfo {
    type: 'both-modified';
    sourceContent: string;
    dbContent: string;
    lastScanned: string;
    sourceChanges: string;
    dbChanges: string;
    uuid: string;
    cardId: string;
}
/**
 * 合并决策
 */
export interface MergeDecision {
    action: 'skip' | 'update-from-source' | 'keep-database' | 'conflict';
    reason: string;
}
/**
 * 三方合并引擎
 */
export declare class ThreeWayMergeEngine {
    private dataStorage;
    private plugin;
    constructor(dataStorage: any, plugin?: any);
    /**
     * 🆕 动态获取 DirectFileReader（解决初始化时序问题）
     */
    private getDirectFileReader;
    /**
     * 智能同步卡片
     *
     * @param sourceContent - 源文件当前内容
     * @param uuid - 卡片UUID
     * @param deckId - 目标牌组ID
     * @returns 同步结果
     */
    smartSync(sourceContent: string, uuid: string, deckId: string): Promise<SyncResult>;
    /**
     * 检查是否需要更新（三方对比核心逻辑）
     *
     * @param sourceContent - 源文件当前内容
     * @param card - 数据库中的卡片
     * @returns 合并决策
     */
    private checkNeedsUpdate;
    /**
     * 检测冲突详情
     *
     * @param sourceContent - 源文件内容
     * @param card - 数据库卡片
     * @returns 冲突信息
     */
    private detectConflict;
    /**
     * 计算内容差异描述
     *
     * @param oldContent - 旧内容
     * @param newContent - 新内容
     * @returns 差异描述
     */
    private calculateDiff;
    /**
     * 创建新卡片
     *
     * @param content - 卡片内容
     * @param uuid - UUID
     * @param deckId - 牌组ID
     * @returns 同步结果
     */
    private createNewCard;
    /**
     * 更新已存在的卡片
     *
     * @param card - 现有卡片
     * @param newContent - 新内容
     * @param newDeckId - 新牌组ID
     * @returns 同步结果
     */
    private updateExistingCard;
    /**
     * 解决冲突（手动选择）
     *
     * @param card - 卡片
     * @param choice - 选择（'use-source' | 'use-weave'）
     * @param sourceContent - 源文件内容
     * @returns 同步结果
     */
    resolveConflict(card: Card, choice: 'use-source' | 'use-weave', sourceContent: string): Promise<SyncResult>;
    /**
     * 🆕 根据 UUID 查找卡片（供外部调用）
     * @param uuid 卡片 UUID
     * @returns 卡片对象或 null
     */
    findCardByUUID(uuid: string): Promise<Card | null>;
}
