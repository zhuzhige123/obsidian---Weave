/**
 * 题库数据存储服务
 *
 *  数据结构（v3.0.0 单文件合并）：
 * ```
 * weave/question-bank/
 * ├── banks.json                      (题库元数据列表)
 * ├── question-stats.json             (全局题目统计)
 * ├── test-history.json               (所有题库的历史分数)
 * ├── in-progress.json                (所有题库的进行中会话)
 * ├── session-archives.json           (所有题库的会话归档)
 * ├── error-book.json                 (所有题库的错题本)
 * └── banks/
 *     ├── {bankId-1}/
 *     │   └── questions.json          (该题库的题目引用)
 *     └── ...
 * ```
 *
 * @module services/question-bank/QuestionBankStorage
 */
import { App } from 'obsidian';
import type { Deck, Card } from '../../data/types';
import type { ErrorBookEntry, PersistedTestSession, TestHistoryEntry, QuestionRef, QuestionTestStats } from '../../types/question-bank-types';
/**
 * 题库数据存储服务
 */
export declare class QuestionBankStorage {
    private app;
    private basePath;
    constructor(app: App);
    /**
     * 获取题库文件夹路径（基于当前数据源）
     */
    private getQuestionBankPath;
    /**
     * 初始化存储目录结构
     */
    initialize(): Promise<void>;
    private computeStatsFromAttempts;
    private mergeQuestionTestStats;
    private migratePerBankQuestionStatsToGlobal;
    /**
     * 获取文件完整路径
     */
    private getFilePath;
    /**
     * 保存题库牌组列表
     */
    saveBanks(banks: Deck[]): Promise<void>;
    saveGlobalQuestionStats(statsByUuid: Record<string, QuestionTestStats>): Promise<void>;
    loadGlobalQuestionStats(): Promise<Record<string, QuestionTestStats>>;
    /**
     * 加载题库牌组列表
     */
    loadBanks(): Promise<Deck[]>;
    private getBankDir;
    private ensureBankDir;
    private getBankQuestionRefsFilePath;
    private getBankQuestionStatsFilePath;
    private getGlobalQuestionStatsFilePath;
    private loadConsolidatedMap;
    private saveConsolidatedMap;
    saveBankQuestionRefs(bankId: string, refs: QuestionRef[]): Promise<void>;
    loadBankQuestionRefs(bankId: string): Promise<QuestionRef[]>;
    saveBankQuestionStats(bankId: string, statsByUuid: Record<string, QuestionTestStats>): Promise<void>;
    loadBankQuestionStats(bankId: string): Promise<Record<string, QuestionTestStats>>;
    saveSessionArchive(bankId: string, sessionId: string, archive: unknown): Promise<void>;
    /**
     * 保存题库的题目列表（单文件存储）
     * 每个题库的所有题目存储在一个 questions.json 文件中
     * @param bankId 题库ID
     * @param questions 题目列表
     */
    saveBankQuestions(bankId: string, questions: Card[]): Promise<void>;
    /**
     * 加载题库的题目列表（单文件存储）
     * @param bankId 题库ID
     */
    loadBankQuestions(bankId: string): Promise<Card[]>;
    saveInProgressSession(bankId: string, session: PersistedTestSession): Promise<void>;
    loadInProgressSession(bankId: string): Promise<PersistedTestSession | null>;
    clearInProgressSession(bankId: string): Promise<void>;
    loadTestHistory(bankId: string): Promise<TestHistoryEntry[]>;
    appendTestHistoryEntry(bankId: string, entry: TestHistoryEntry, maxEntries?: number): Promise<void>;
    /**
     * 保存错题本数据
     */
    saveErrorBook(bankId: string, errors: ErrorBookEntry[]): Promise<void>;
    loadErrorBook(bankId: string): Promise<ErrorBookEntry[]>;
    deleteErrorBook(bankId: string): Promise<void>;
    /**
     * 删除题库的题目文件
     * @param bankId 题库ID
     */
    deleteBankQuestions(bankId: string): Promise<void>;
    /**
     * 清理过期的测试会话（保留最近30天）
     */
    cleanupOldSessions(daysToKeep?: number): Promise<number>;
    /**
     * 获取存储统计信息
     */
    getStorageStats(): Promise<{
        banks: number;
        questions: number;
        sessions: number;
        errorBooks: number;
    }>;
    private getAllTestHistoryCount;
    private migratePerFilesToConsolidated;
    private migrateLegacyTestSessionsToHistory;
}
