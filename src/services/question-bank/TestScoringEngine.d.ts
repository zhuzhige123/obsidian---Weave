/**
 * 测试评分引擎
 * 负责计算题目得分、总分和成绩等级
 */
import type { TestSession, TestQuestionRecord } from '../../types/question-bank-types';
export type GradeLevel = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
export interface QuestionScore {
    questionId: string;
    score: number;
    maxScore: number;
    isCorrect: boolean;
    partialCredit?: number;
}
export interface SessionScore {
    totalScore: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    totalQuestions: number;
    accuracy: number;
    grade: GradeLevel;
    questionScores: QuestionScore[];
}
export declare class TestScoringEngine {
    private static readonly GRADE_THRESHOLDS;
    /**
     * 计算单个题目得分
     */
    static scoreQuestion(record: TestQuestionRecord): QuestionScore;
    /**
     * 计算多选题得分（一错全错规则）
     */
    static scoreMultipleChoice(userAnswer: string[] | null, correctAnswer: string[]): QuestionScore;
    /**
     * 计算挖空题得分（部分得分规则）
     */
    static scoreClozeQuestion(userAnswers: string[] | null, correctAnswers: string[]): QuestionScore;
    /**
     * 计算测试会话总分
     */
    static scoreSession(session: TestSession): SessionScore;
    /**
     * 根据分数计算成绩等级
     */
    static calculateGrade(score: number): GradeLevel;
    /**
     * 获取成绩等级描述
     */
    static getGradeDescription(grade: GradeLevel): string;
    /**
     * 获取成绩等级颜色
     */
    static getGradeColor(grade: GradeLevel): string;
    /**
     * 计算排名（相对于历史成绩）
     */
    static calculatePercentile(currentScore: number, historicalScores: number[]): number;
    /**
     * 获取进步建议
     */
    static getImprovementSuggestions(sessionScore: SessionScore): string[];
    /**
     * 生成测试报告摘要
     */
    static generateReportSummary(sessionScore: SessionScore): string;
}
