/**
 * 考试牌组管理服务（v2.0+ 平级架构）
 *
 * 管理考试牌组与记忆牌组的一对一对应关系
 * 实现与记忆牌组的同步：重命名、删除
 *
 *  v2.0+ 平级架构：
 * - 已移除层级结构支持（parentId, level, path 已废弃）
 * - syncMove() 已废弃
 *
 * @module services/question-bank/QuestionBankHierarchyService
 */
import type { Deck } from '../../data/types';
import type { DeckTreeNode } from '../../services/deck/DeckHierarchyService';
import type { WeaveDataStorage } from '../../data/storage';
import type { QuestionBankService } from './QuestionBankService';
/**
 * 考试牌组层级管理服务
 */
export declare class QuestionBankHierarchyService {
    private dataStorage;
    private questionBankService;
    constructor(dataStorage: WeaveDataStorage, questionBankService: QuestionBankService);
    /**
     * 基于记忆牌组树构建考试牌组树
     * 只显示有对应考试牌组的记忆牌组节点
     */
    buildQuestionBankTree(memoryDeckTree: DeckTreeNode[]): Promise<DeckTreeNode[]>;
    /**
     * 直接从考试牌组列表构建树（平级架构）
     *
     * @deprecated v2.0+ 平级架构下 children 始终为空数组
     */
    private buildTreeFromBanks;
    /**
     * 根据记忆牌组ID查找对应的考试牌组
     */
    findQuestionBankByMemoryDeckId(memoryDeckId: string): Promise<Deck | null>;
    /**
     * 确保考试牌组存在（如果不存在则创建空的考试牌组）
     * 用于维护层级关系
     */
    ensureQuestionBankExists(memoryDeckId: string): Promise<Deck>;
    /**
     * @deprecated v2.0+ 平级架构不支持牌组移动
     * 调用此方法将抛出错误
     */
    syncMove(_memoryDeckId: string, _newParentMemoryDeckId: string | null): Promise<void>;
    /**
     * 同步重命名考试牌组（当记忆牌组重命名时调用）
     */
    syncRename(memoryDeckId: string, newMemoryDeckName: string): Promise<void>;
    /**
     * 同步删除考试牌组（当记忆牌组删除时调用）
     */
    syncDelete(memoryDeckId: string): Promise<void>;
    /**
     * 递归更新子考试牌组的路径
     */
    private updateChildrenPaths;
    /**
     * 获取考试牌组的所有子孙
     */
    private getDescendants;
    /**
     * 获取默认设置
     */
    private getDefaultSettings;
    /**
     * 获取默认统计信息
     */
    private getDefaultStats;
}
