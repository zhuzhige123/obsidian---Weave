/**
 * 测试卡片创建工具
 * 
 * 明确定义考试牌组卡片的数据结构
 * 核心原则：
 * 1. Content-First：内容存储在Markdown中
 * 2. 不使用FSRS字段
 * 3. 使用testStats而非memoryRate
 */

import type { Card, SourceRange } from '../../data/types';
import { generateId } from '../helpers';
import { generateUUID } from '../helpers';
// 🆕 v2.2: 导入 YAML 工具函数
import { createContentWithMetadata } from '../yaml-utils';

/**
 * 从源卡片提取源信息
 * 用于AI生成卡片时继承来源信息
 * 
 * @param sourceCard 源卡片
 * @returns 源信息对象
 */
export function extractSourceInfo(sourceCard: Card): {
  sourceFile?: string;
  sourceBlock?: string;
  sourceRange?: SourceRange;
  sourceExists?: boolean;
  sourceFileMtime?: number;
} {
  return {
    sourceFile: sourceCard.sourceFile,
    sourceBlock: sourceCard.sourceBlock,
    sourceRange: sourceCard.sourceRange,
    sourceExists: sourceCard.sourceExists,
    sourceFileMtime: sourceCard.sourceFileMtime
  };
}

/**
 * 创建测试卡片的最小必需参数
 */
export interface CreateTestCardParams {
  deckId: string;
  deckName?: string;          // 🆕 v2.2: 用于写入 we_decks
  templateId?: string;        // ❌ 可选：模板ID（仅用于Anki导出，Weave原生不需要）
  content: string;            // Markdown内容（包含题目、选项、答案等）
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  priority?: number;
  questionType?: 'single_choice' | 'multiple_choice' | 'qa' | 'cloze';  // 可选：题型标记
  correctAnswer?: string | string[];  // 可选：正确答案（A/B/C/D 或 ['A', 'B']）
  
  // 🆕 源文件信息（用于AI生成的测试题继承来源）
  sourceFile?: string;        // 来源文档路径
  sourceBlock?: string;       // 块引用ID
  sourceRange?: import('../../data/types').SourceRange;  // 精确位置
  sourceExists?: boolean;     // 源文档是否存在
  sourceFileMtime?: number;   // 源文件修改时间
}

/**
 * 创建测试卡片
 * 
 * @param params 创建参数
 * @returns 测试卡片对象
 */
export function createTestCard(params: CreateTestCardParams): Card {
  const now = new Date().toISOString();
  
  // 🆕 v2.2: 在 content 中写入 we_decks
  let finalContent = params.content;
  if (params.deckName && params.content) {
    finalContent = createContentWithMetadata({ we_decks: [params.deckName] }, params.content);
  }
  
  return {
    // 基础标识
    id: generateId(),
    uuid: generateUUID(),
    deckId: params.deckId,
    ...(params.templateId && { templateId: params.templateId }), // ✅ 仅在有值时设置（用于Anki导出）
    type: 'basic', // 题库卡片使用basic类型，具体题型通过content解析
    
    // 题库标识
    cardPurpose: 'test',
    difficulty: params.difficulty || 'medium',
    
    // 内容（包含 we_decks）
    content: finalContent,
    
    // 统计数据（仅测试相关）
    stats: {
      totalReviews: 0,
      totalTime: 0,
      averageTime: 0,
      // ✅ 使用testStats，不使用memoryRate
      testStats: {
        totalAttempts: 0,
        correctAttempts: 0,
        incorrectAttempts: 0,
        accuracy: 0,
        bestScore: 0,
        averageScore: 0,
        lastScore: 0,
        averageResponseTime: 0,
        fastestTime: 0,
        lastTestDate: now,
        isInErrorBook: false,
        consecutiveCorrect: 0
      }
    },
    
    // 时间戳
    created: now,
    modified: now,
    
    // 可选字段
    tags: params.tags || [],
    priority: params.priority || 2,
    
    // 🆕 源文件信息（如果提供）
    ...(params.sourceFile && { sourceFile: params.sourceFile }),
    ...(params.sourceBlock && { sourceBlock: params.sourceBlock }),
    ...(params.sourceRange && { sourceRange: params.sourceRange }),
    ...(params.sourceExists !== undefined && { sourceExists: params.sourceExists }),
    ...(params.sourceFileMtime && { sourceFileMtime: params.sourceFileMtime }),
    
    // ✅ 可选的题型元数据（便于快速识别）
    metadata: (params.questionType || params.correctAnswer) ? {
      questionMetadata: {
        type: params.questionType,
        correctAnswer: params.correctAnswer
      }
    } : undefined,
    
    // ❌ 不包含以下字段：
    // fsrs - 测试卡片不需要
    // reviewHistory - 测试卡片不需要
    // choiceQuestionData - 已删除，使用content动态解析
  } as Card;
}

/**
 * 验证是否为测试卡片
 */
export function isTestCard(card: Card): boolean {
  return card.cardPurpose === 'test';
}

/**
 * 验证是否为记忆卡片
 */
export function isMemoryCard(card: Card): boolean {
  return card.cardPurpose === 'memory' || !card.cardPurpose;
}
