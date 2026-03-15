/**
 * 题库核心服务
 *
 * 提供题库牌组和题目卡片的CRUD操作
 *
 *  数据管理策略：
 * - 内存缓存：所有题库和题目都加载到内存中（this.banks, this.questions）
 * - 按题库存储：每个题库的题目独立存储在各自的 questions.json 文件中
 * - 增量保存：修改单个题库时，只更新该题库的 questions.json，不影响其他题库
 *
 *  保存策略：
 * - 添加题目 → 只保存该题库的 questions.json
 * - 更新题目 → 只保存该题库的 questions.json
 * - 删除题目 → 只保存该题库的 questions.json
 * - 删除题库 → 删除整个题库文件夹
 *
 * @module services/question-bank/QuestionBankService
 */
import type { Card, Deck } from '../../data/types';
import type { WeaveDataStorage } from '../../data/storage';
import type { QuestionBankFilter, QuestionBankStats } from '../../types/question-bank-types';
import { QuestionBankStorage } from './QuestionBankStorage';
/**
 * 题库核心服务
 */
export declare class QuestionBankService {
    private storage;
    private banks;
    private dataStorage;
    constructor(storage: QuestionBankStorage, dataStorage: WeaveDataStorage);
    /**
     * 初始化服务（加载数据）
     * 注意：QuestionBankStorage 应该在传入前已经初始化
     */
    initialize(): Promise<void>;
    /**
     * 加载所有数据（按题库加载）
     */
    private loadData;
    /**
     * 保存所有数据（按题库保存）
     */
    private saveData;
    /**
     * 创建题库牌组
     * @param name 题库名称
     * @param description 题库描述
     * @param initialMetadata 初始 metadata（可选，用于设置 pairedMemoryDeckId 等）
     */
    createQuestionBank(name: string, description?: string, initialMetadata?: Record<string, any>): Promise<Deck>;
    /**
     * 获取题库牌组
     */
    getQuestionBank(bankId: string): Deck | undefined;
    /**
     * 获取所有题库牌组
     */
    getAllQuestionBanks(): Deck[];
    /**
     * 获取所有题库（别名方法）
     *  修复：每次调用时从存储重新加载，确保数据一致性
     */
    getAllBanks(): Promise<Deck[]>;
    /**
     * 根据ID获取题库（别名方法）
     */
    getBankById(bankId: string): Deck | null;
    /**
     * 根据记忆牌组ID查找对应的考试牌组
     *  修复：从存储重新加载数据，确保数据一致性
     */
    findBankByMemoryDeckId(memoryDeckId: string): Promise<Deck | null>;
    /**
     * 创建题库（别名方法，兼容 QuestionBank 接口）
     *  关键修复：在创建时就设置完整的 metadata，避免竞态条件
     */
    createBank(bank: Partial<Deck>): Promise<Deck>;
    /**
     * 更新题库（别名方法，兼容整个对象更新）
     */
    updateBank(bank: Deck): Promise<void>;
    /**
     * 更新题库牌组
     */
    updateQuestionBank(bankId: string, updates: Partial<Deck>): Promise<void>;
    /**
     * 删除题库（别名方法）
     */
    deleteBank(bankId: string): Promise<void>;
    /**
     * 更新题库配置
     */
    updateBankConfig(bankId: string, config: any): Promise<void>;
    /**
     * 删除题库牌组（及其所有题目）
     */
    deleteQuestionBank(bankId: string): Promise<void>;
    /**
     * 添加题目到题库
     */
    addQuestion(bankId: string, question: Card): Promise<void>;
    /**
     * 批量添加题目
     */
    addQuestions(bankId: string, questions: Card[]): Promise<void>;
    addQuestionRefs(bankId: string, cardUuids: string[]): Promise<void>;
    /**
     * 根据ID获取题目（async版本，用于实时刷新）
     *  先从内存查找，找不到则从数据库重新加载
     */
    getQuestionById(bankId: string, questionId: string): Promise<Card | null>;
    /**
     * 更新题目
     */
    updateQuestion(questionId: string, updates: Partial<Card>): Promise<void>;
    /**
     * 删除题目
     * @param questionIdOrBankId - 题目ID，或者第一个参数为bankId时的bankId
     * @param questionId - 当第一个参数为bankId时的题目ID
     */
    deleteQuestion(questionIdOrBankId: string, questionId?: string): Promise<void>;
    private resolveCardsByUuidsFromAllCards;
    /**
     * 获取题库的所有题目
     */
    getQuestionsByBank(bankId: string, filter?: QuestionBankFilter): Promise<Card[]>;
    /**
     * 获取未测试的题目
     */
    getUntestedQuestions(bankId: string): Promise<Card[]>;
    /**
     * 获取错题
     */
    getErrorQuestions(bankId: string): Promise<Card[]>;
    /**
     * 应用筛选条件
     */
    private applyFilter;
    /**
     * 更新题库统计信息
     */
    private updateBankStats;
    /**
     * 获取题库统计信息
     */
    getBankStats(bankId: string): Promise<QuestionBankStats | null>;
    /**
     * 获取默认牌组设置
     */
    private getDefaultSettings;
    /**
     * 获取默认统计信息
     */
    private getDefaultStats;
}
