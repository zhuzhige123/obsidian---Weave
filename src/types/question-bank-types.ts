/**
 * 题库功能相关类型定义
 * 
 * 定义题库考试系统的所有数据结构
 * 
 * @module types/question-bank-types
 * @version v0.10
 */

import type { UnifiedCardType } from './unified-card-types';

export interface QuestionRef {
  cardUuid: string;
  addedAt: string;
}

// ============================================================================
// 题库卡片专用类型
// ============================================================================

/**
 * 题目元数据
 * 存储在 Card.metadata.questionMetadata 中
 */
export interface QuestionMetadata {
  /** 题目类型 */
  type?: 'single_choice' | 'multiple_choice' | 'choice' | 'cloze' | 'short_answer';
  //  'choice' 兼容AI生成的测试题（可能是单选或多选，由correctAnswer类型决定）
  
  /** 选择题选项列表 */
  choices?: string[];
  
  /** 正确答案（单选为string，多选为string[]） */
  correctAnswer?: string | string[];
  
  /** 正确答案索引（单选为number，多选为number[]） */
  correctAnswers?: number | number[];
  
  /** AI生成的干扰项列表 */
  distractors?: string[];
  
  /** 答案解析 */
  explanation?: string;
  
  /** 挖空题选项映射（挖空序号 → 选项列表） */
  clozeOptions?: Record<number, string[]>;
}

// ============================================================================
// 掌握度评估相关类型（基于EWMA算法）
// ============================================================================

/**
 * 掌握状态
 */
export type MasteryStatus = 
  | 'mastered'          // 精通 (≥90%, 连续3次正确)
  | 'proficient'        // 熟练 (≥75%)
  | 'learning'          // 学习中 (≥60%)
  | 'struggling'        // 困难 (≥40%)
  | 'needs_review'      // 需要复习 (<40%)
  | 'insufficient_data';// 数据不足

/**
 * 学习趋势
 */
export type TrendDirection = 
  | 'improving'    // 进步中
  | 'stable'       // 稳定
  | 'declining'    // 退步中
  | 'unknown';     // 未知（数据不足）

/**
 * 趋势信息
 */
export interface TrendInfo {
  /** 趋势方向 */
  direction: TrendDirection;
  /** 趋势强度 (0-1) */
  strength: number;
}

/**
 * 掌握度指标
 * 基于EWMA算法的科学评估
 */
export interface MasteryMetrics {
  // ===== 主指标 =====
  /** 当前掌握度 (0-100)，基于EWMA算法 */
  currentAccuracy: number;
  
  /** 历史平均正确率 (0-100)，用于对比 */
  historicalAccuracy: number;
  
  // ===== 置信度与状态 =====
  /** 评估置信度 (0-1)，基于样本量 */
  confidence: number;
  
  /** 掌握状态 */
  status: MasteryStatus;
  
  // ===== 趋势分析 =====
  /** 学习趋势 */
  trend: TrendInfo;
  
  // ===== 统计信息 =====
  /** 有效样本量（EWMA考虑的等效测试次数） */
  effectiveSampleSize: number;
  
  /** 总测试次数 */
  totalAttempts: number;
  
  /** 连续正确次数 */
  consecutiveCorrect: number;
  
  /** 最近一次正确率（最近5次） */
  recentAccuracy: number;
}

/**
 * 测试结果记录（用于EWMA计算）
 */
export interface TestAttempt {
  /** 是否正确 */
  isCorrect: boolean;
  
  /** 测试模式 */
  mode: TestMode;
  
  /** 测试时间 */
  timestamp: string;
  
  /** 得分 (0-100, 可选) */
  score?: number;
  
  /** 耗时（毫秒） */
  timeSpent?: number;
}

/**
 * 题库测试统计数据
 * 存储在 Card.stats.testStats 中
 */
export interface QuestionTestStats {
  // ===== 基础统计 =====
  /** 总测试次数 */
  totalAttempts: number;
  
  /** 正确次数 */
  correctAttempts: number;
  
  /** 错误次数 */
  incorrectAttempts: number;
  
  /** 简单平均正确率 (0-1)
   * @deprecated 使用 masteryMetrics.currentAccuracy 替代
   * 仅保留用于向后兼容
   */
  accuracy: number;
  
  /** 掌握度指标（基于EWMA算法）*/
  masteryMetrics?: MasteryMetrics;
  
  // ===== 分数统计 =====
  /** 最佳分数 (0-100) */
  bestScore: number;
  
  /** 平均分数 (0-100) */
  averageScore: number;
  
  /** 最近一次分数 (0-100) */
  lastScore: number;
  
  // ===== 时间统计 =====
  /** 平均答题时间（毫秒） */
  averageResponseTime: number;
  
  /** 最快答题时间（毫秒） */
  fastestTime: number;
  
  /** 最后测试时间 (ISO 8601) */
  lastTestDate: string;
  
  // ===== 错题标记 =====
  /** 是否在错题本中 */
  isInErrorBook: boolean;
  
  /** 连续答对次数（3次自动移出错题本） */
  consecutiveCorrect: number;
  
  /** 最后答错时间 (ISO 8601) */
  lastIncorrectDate?: string;

  attempts?: TestAttempt[];
}

// ============================================================================
// 测试会话相关类型
// ============================================================================

/**
 * 测试会话模式
 */
export type TestMode = 'practice' | 'exam' | 'quiz';

/**
 * 模式元数据
 */
export interface TestModeMetadata {
  mode: TestMode;
  name: string;
  description: string;
  icon: string;
  defaultQuestionCount: number | 'all';
  allowViewAnswer: boolean;  // 是否允许查看答案
  allowSkip: boolean;        // 是否允许跳过
}

/**
 * 预定义的测试模式配置
 */
export const TEST_MODES: Record<TestMode, TestModeMetadata> = {
  practice: {
    mode: 'practice',
    name: '常规考试',
    description: '可随时查看答案，适合日常练习',
    icon: 'edit',
    defaultQuestionCount: 'all',
    allowViewAnswer: true,
    allowSkip: true
  },
  exam: {
    mode: 'exam',
    name: '考试模式',
    description: '全部完成后查看答案，模拟真实考试',
    icon: 'file-text',
    defaultQuestionCount: 'all',
    allowViewAnswer: false,
    allowSkip: false
  },
  quiz: {
    mode: 'quiz',
    name: '小测验',
    description: '随机10题快速测试，完成后查看答案',
    icon: 'zap',
    defaultQuestionCount: 10,
    allowViewAnswer: false,
    allowSkip: false
  }
};

/**
 * 测试会话
 * 记录一次完整的考试过程
 */
export interface TestSession {
  /** 会话ID */
  id: string;
  
  /** 题库牌组ID */
  bankId: string;
  
  /** 题库牌组名称 */
  bankName: string;
  
  // ===== 会话模式 =====
  /** 测试模式：practice=常规考试, exam=考试模式 */
  mode: TestMode;
  
  // ===== 时间数据 =====
  /** 开始时间 (ISO 8601) */
  startTime: string;
  
  /** 结束时间 (ISO 8601) */
  endTime?: string;
  
  /** 总用时（秒） */
  duration: number;
  
  // ===== 题目记录 =====
  /** 题目答题记录列表 */
  questions: TestQuestionRecord[];
  
  // ===== 统计数据 =====
  /** 总题数 */
  totalQuestions: number;
  
  /** 已完成题数 */
  completedQuestions: number;
  
  /** 正确数 */
  correctCount: number;
  
  /** 错误数 */
  incorrectCount: number;
  
  /** 错误数（别名，兼容） */
  wrongCount: number;
  
  /** 百分制分数 (0-100) */
  score: number;
  
  /** 正确率 (0-1) */
  accuracy: number;
  
  /** 跳过数 */
  skippedCount: number;
  
  // ===== 状态 =====
  /** 会话状态 */
  status: 'in_progress' | 'completed' | 'cancelled';
  
  /** 当前题目索引（0-based） */
  currentQuestionIndex: number;
  
  /** 总用时（秒，可选） */
  totalTimeSpent?: number;
  
  /** 是否完成 */
  completed?: boolean;
  
  /** 是否中途放弃 */
  abandoned?: boolean;
  
  // ===== 配置 =====
  /** 测试配置 */
  config?: {
    timeLimit?: number;
    shuffleOptions?: boolean;
  };
}

/**
 * 单题答题记录
 */
export interface TestQuestionRecord {
  /** 题目ID（卡片ID） */
  questionId: string;
  
  /** 题目对象（完整卡片数据） */
  question: import('../data/types').Card;
  
  // ===== 答题数据 =====
  /** 用户答案（单选为string，多选为string[]，未答为null） */
  userAnswer: string | string[] | null;
  
  /** 正确答案（如果格式有问题可能为null） */
  correctAnswer: string | string[] | null;
  
  /** 是否正确（null表示未作答） */
  isCorrect: boolean | null;
  
  /** 题目格式错误信息（如果有的话） */
  errorMessage?: string;
  
  // ===== 时间数据 =====
  /** 答题用时（秒） */
  timeSpent: number;
  
  /** 提交时间 (ISO 8601，可选) */
  submittedAt: string | null;
}

export interface PersistedTestQuestionRecord {
  questionId: string;
  userAnswer: string | string[] | null;
  correctAnswer: string | string[] | null;
  isCorrect: boolean | null;
  errorMessage?: string;
  timeSpent: number;
  submittedAt: string | null;
}

export interface PersistedTestSession {
  id: string;
  bankId: string;
  bankName: string;
  mode: TestMode;
  startTime: string;
  endTime?: string;
  duration: number;
  questions: PersistedTestQuestionRecord[];
  totalQuestions: number;
  completedQuestions: number;
  correctCount: number;
  incorrectCount: number;
  wrongCount: number;
  score: number;
  accuracy: number;
  skippedCount: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  currentQuestionIndex: number;
  totalTimeSpent?: number;
  completed?: boolean;
  abandoned?: boolean;
  config?: {
    timeLimit?: number;
    shuffleOptions?: boolean;
  };
}

export interface TestHistoryEntry {
  sessionId: string;
  bankId: string;
  timestamp: string;
  mode: TestMode;
  score: number;
  accuracy: number;
  totalQuestions: number;
  correctCount: number;
  durationSeconds: number;
}

// ============================================================================
// 错题本相关类型
// ============================================================================

/**
 * 错题本记录
 */
export interface ErrorBookEntry {
  /** 卡片ID */
  cardId: string;
  
  /** 题库牌组ID */
  bankId: string;
  
  /** 累计错误次数 */
  errorCount: number;
  
  /** 连续答对次数 */
  consecutiveCorrect: number;
  
  /** 加入错题本时间 (ISO 8601) */
  addedAt: string;
  
  /** 最后答错时间 (ISO 8601) */
  lastErrorDate: string;
  
  /** 最后答对时间 (ISO 8601) */
  lastCorrectDate?: string;
  
  /** 错误等级 */
  errorLevel: 'light' | 'medium' | 'severe';
}

/**
 * 错题本过滤条件
 */
export interface ErrorBookFilter {
  /** 仅高频错题（错误次数≥3） */
  frequentOnly?: boolean;
  
  /** 最近错题（天数） */
  recentDays?: number;
  
  /** 按题库筛选 */
  bankId?: string;
  
  /** 按难度筛选 */
  difficulty?: 'easy' | 'medium' | 'hard';
}

// ============================================================================
// 题库牌组相关类型
// ============================================================================


/**
 * 题库考试模式配置
 */
export interface QuestionBankModeConfig {
  /** 题型占比配置 */
  questionTypeRatio?: {
    single_choice?: number;    // 单选题占比 (0-100)
    multiple_choice?: number;  // 多选题占比 (0-100)
    cloze?: number;           // 填空题占比 (0-100)
    short_answer?: number;    // 简答题占比 (0-100)
  };
  
  /** 难度分布 */
  difficultyDistribution?: {
    easy?: number;     // 简单题占比 (0-100)
    medium?: number;   // 中等题占比 (0-100)
    hard?: number;     // 困难题占比 (0-100)
  };
  
  /** 题目来源 */
  questionSource?: 'all' | 'untested' | 'incorrect' | 'marked';
  
  /** 自定义题目数量（覆盖模式默认值） */
  customQuestionCount?: {
    practice?: number | null;
    exam?: number | null;
    quiz?: number | null;
  };
  
  /** 是否随机打乱题目顺序 */
  shuffleQuestions?: boolean;
  
  /** 是否随机打乱选项顺序 */
  shuffleOptions?: boolean;
  
  /** 题目数量限制 */
  questionCount?: number;
  
  /** 时间限制（毫秒） */
  timeLimit?: number;
  
  /** 🆕 考试时长配置（分钟） */
  examTimeLimit?: {
    exam?: number;      // 考试模式时长（默认60分钟）
    quiz?: number;      // 小测验时长（默认10分钟）
  };
  
  /** 高级选项 */
  options?: {
    shuffleQuestions?: boolean;  // 打乱题目顺序
    shuffleOptions?: boolean;    // 打乱选项顺序
    autoSave?: boolean;          // 自动保存配置
  };
}

/**
 * 题库牌组配置
 */
export interface QuestionBankConfig {
  /** 是否允许查看解析（考试过程中） */
  allowViewExplanation: boolean;
  
  /** 是否打乱题目顺序 */
  shuffleQuestions: boolean;
  
  /** 默认测试模式 */
  defaultMode: TestMode;
  
  /** 自动移出错题本的连续正确次数阈值 */
  errorBookThreshold: number;
  
  /** 考试模式配置 */
  modeConfig?: QuestionBankModeConfig;
}

/**
 * 题库牌组统计
 */
export interface QuestionBankStats {
  /** 总题数 */
  totalQuestions: number;
  
  /** 已测试题数 */
  testedQuestions: number;
  
  /** 平均正确率 (0-1) */
  averageAccuracy: number;
  
  /** 平均分数 (0-100) */
  averageScore: number;
  
  /** 平均完成时间（秒） */
  averageCompletionTime: number;
  
  /** 错题数量 */
  errorCount: number;
  
  /** 总测试次数 */
  totalTests: number;
  
  /** 最后测试时间 (ISO 8601) */
  lastTestDate?: string;
  
  /** 按难度分布 */
  byDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
}

/**
 * 题库过滤条件
 */
export interface QuestionBankFilter {
  /** 按标签筛选 */
  tags?: string[];
  
  /** 按难度筛选 */
  difficulty?: 'easy' | 'medium' | 'hard';
  
  /** 按题型筛选 */
  cardType?: UnifiedCardType;
  
  /** 仅未测试题目 */
  untestedOnly?: boolean;
  
  /** 仅错题 */
  errorOnly?: boolean;
}

// ============================================================================
// 评分相关类型
// ============================================================================

/**
 * 评分规则
 */
export interface ScoringRules {
  /** 选择题单选：全对100分，错误0分 */
  singleChoice: {
    correct: 100;
    incorrect: 0;
  };
  
  /** 选择题多选：全对100分，一错全错0分 */
  multipleChoice: {
    allCorrect: 100;
    anyIncorrect: 0;
  };
  
  /** 挖空题：平均分配，部分正确给部分分 */
  cloze: {
    perCloze: (correct: number, total: number) => number;
  };
}

/**
 * 成绩等级
 */
export type GradeLevel = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';

/**
 * 评分结果
 */
export interface ScoringResult {
  /** 得分 (0-100) */
  score: number;
  
  /** 成绩等级 */
  grade: GradeLevel;
  
  /** 是否及格（≥60分） */
  passed: boolean;
  
  /** 排名百分位（超过X%的用户） */
  percentile?: number;
}

// ============================================================================
// 干扰项生成相关类型
// ============================================================================

/**
 * 干扰项生成请求
 */
export interface DistractorGenerationRequest {
  /** 题目内容 */
  question: string;
  
  /** 正确答案 */
  correctAnswer: string;
  
  /** 上下文（完整题目内容） */
  context: string;
  
  /** 生成数量 */
  count: number;
}

/**
 * 干扰项质量评估
 */
export interface DistractorQuality {
  /** 语义相似度 (0-1) */
  similarity: number;
  
  /** 合理性 (0-1) */
  plausibility: number;
  
  /** 多样性 (0-1) */
  diversity: number;
  
  /** 是否通过质量检查 */
  passed: boolean;
}

// ============================================================================
// 所有类型已通过 export interface/type 直接导出
// ============================================================================

