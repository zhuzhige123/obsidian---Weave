/**
 * 测试会话管理器
 * 负责管理题库考试会话的生命周期
 */
import type { Card } from '../../data/types';
import type { TestSession, TestQuestionRecord, TestMode } from '../../types/question-bank-types';
import type { QuestionBankStorage } from './QuestionBankStorage';
export interface SessionConfig {
    bankId: string;
    mode: TestMode;
    questionCount?: number;
    timeLimit?: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
}
export interface AnswerSubmission {
    questionId: string;
    answer: string | string[];
    timeSpent: number;
}
export declare class TestSessionManager {
    private storage;
    private bankService;
    private currentSession;
    private sessionStartTime;
    private questionStartTime;
    constructor(storage: QuestionBankStorage, bankService?: any);
    /**
     * 开始新的测试会话
     */
    startSession(config: SessionConfig, questions: Card[]): Promise<TestSession>;
    /**
     * 提交答案
     */
    submitAnswer(submission: AnswerSubmission): Promise<{
        isCorrect: boolean;
        correctAnswer: string | string[] | null;
        questionRecord: TestQuestionRecord;
    }>;
    /**
     * 跳过当前题目
     */
    skipQuestion(): void;
    /**
     * 移动到下一题
     */
    moveToNextQuestion(): Promise<boolean>;
    /**
     * 移动到上一题（仅查看，不能修改）
     */
    moveToPreviousQuestion(): Promise<boolean>;
    /**
     * 跳转到指定题目
     */
    jumpToQuestion(targetIndex: number): Promise<boolean>;
    /**
     * 完成测试会话
     */
    completeSession(): Promise<TestSession>;
    /**
     * 取消测试会话
     */
    cancelSession(): Promise<void>;
    /**
     * 获取当前会话
     */
    getCurrentSession(): TestSession | null;
    /**
     * 保存当前会话状态
     *  用于外部修改题目后同步保存会话数据
     */
    saveCurrentSession(): Promise<void>;
    /**
     * 获取当前题目
     *  创新方案：从数据库实时刷新卡片数据，确保始终是最新内容
     */
    getCurrentQuestionWithRefresh(): Promise<TestQuestionRecord | null>;
    /**
     * 获取当前题目（旧方法，保持兼容）
     */
    getCurrentQuestion(): TestQuestionRecord | null;
    /**
     * 获取当前题目索引（0-based）
     */
    getCurrentIndex(): number;
    /**
     * 获取会话进度
     */
    getProgress(): {
        current: number;
        total: number;
        percentage: number;
        answered: number;
        unanswered: number;
    } | null;
    /**
     * 恢复未完成的会话
     */
    restoreSession(bankId: string): Promise<TestSession | null>;
    /**
     * 保存会话到存储
     */
    private saveSession;
    private toPersistedSession;
    private appendHistoryFromCompletedSession;
    /**
     * 从卡片中提取正确答案
     *  严格策略：只认选项中的 {} 标记，不信任metadata，不从---div---后解析
     *  设为public：允许外部在编辑卡片后重新提取正确答案
     */
    extractCorrectAnswer(card: Card): string | string[];
    /**
     * 提取卡片中的所有可用选项标识
     */
    private extractAvailableOptions;
    /**
     * 严格验证正确答案
     */
    private validateCorrectAnswer;
    /**
     * 从卡片内容解析答案（通过 {} 标记）
     *  严格限制：只扫描 ---div--- 之前的选项区域
     */
    private parseAnswerFromContent;
    /**
     * 检查答案是否正确
     */
    private checkAnswer;
    /**
     * 更新题目的测试统计
     */
    private updateQuestionStats;
    private saveSessionArchiveFromCompletedSession;
    /**
     * 打乱数组顺序（Fisher-Yates 算法）
     */
    private shuffleArray;
}
