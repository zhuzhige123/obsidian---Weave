/**
 * AI助手相关类型定义
 */

import type { TFile } from 'obsidian';
import type { Card } from '../data/types';

// ===== AI服务提供商 =====
export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'zhipu' | 'siliconflow' | 'xai';

// ===== Obsidian文件信息 =====
export interface ObsidianFileInfo {
  path: string;
  name: string;
  size: number;
  file: TFile;
  extension: string;
}

// ===== 生成配置 =====
export interface GenerationConfig {
  // 模板和提示词
  templateId: string;
  promptTemplate: string;
  customPrompt?: string;
  
  // 卡片模板配置（按题型）
  templates?: {
    qa: string;      // 问答题模板ID，默认 'official-qa'
    choice: string;  // 选择题模板ID，默认 'official-choice'
    cloze: string;   // 挖空题模板ID，默认 'official-cloze'
  };
  
  // 卡片生成参数
  cardCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  
  // 卡片类型分布（百分比）
  typeDistribution: {
    qa: number;      // 问答题
    cloze: number;   // 挖空题
    choice: number;  // 选择题
  };
  
  // AI服务配置
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  
  // 图片生成配置
  imageGeneration: {
    enabled: boolean;
    strategy: 'none' | 'ai-generate' | 'search';
    imagesPerCard: number;
    placement: 'question' | 'answer' | 'both';
  };
  
  // 高级选项
  targetDeck?: string;
  autoTags: string[];
  enableHints: boolean;
}

// ===== 生成的卡片 =====
export interface GeneratedCard {
  uuid: string;
  type: 'qa' | 'cloze' | 'choice' | 'judge';
  
  // 🆕 卡片内容（统一使用content字段）
  content: string;  // 原始Markdown内容，使用 ---div--- 分隔正反面
  
  //  向后兼容字段（已废弃，但保留以支持旧代码）
  /** @deprecated 使用 content 字段代替 */
  front?: string;
  /** @deprecated 使用 content 字段代替 */
  back?: string;
  
  // 选择题特有字段（已废弃，信息包含在content中）
  /** @deprecated 选择题信息已包含在 content 字段中 */
  choices?: string[];
  /** @deprecated 选择题信息已包含在 content 字段中 */
  correctAnswer?: number;
  
  // 挖空题特有字段（已废弃，信息包含在content中）
  /** @deprecated 挖空题信息已包含在 content 字段中 */
  clozeText?: string;
  
  // 附加信息
  tags?: string[];
  images?: string[];
  explanation?: string;
  
  // 🆕 块链接溯源信息
  sourceText?: string;    // AI生成此卡片所依据的原文片段
  sourceBlock?: string;   // 块链接ID（如 ^abc123）
  
  // UI状态（渐进式加载）
  isNew?: boolean; // 标记新生成的卡片，用于触发动画
  
  // 元数据
  metadata: {
    generatedAt: string;
    provider: string;
    model: string;
    sourceFile?: string;
    temperature: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
}

// ===== 生成会话 =====
export interface GenerationSession {
  id: string;
  sourceFile: string | null;
  sourceContent: string;
  config: GenerationConfig;
  cards: GeneratedCard[];
  selectedCardIds: Set<string>;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'generating' | 'completed' | 'failed';
}

// ===== AI服务响应 =====
export interface AIServiceResponse {
  success: boolean;
  cards?: GeneratedCard[];
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost?: number;
  };
}

// ===== 重新生成请求 =====
export interface RegenerateRequest {
  cardId: string;
  instruction: string;
  originalCard: GeneratedCard;
}

// ===== 进度更新 =====
export interface GenerationProgress {
  status: 'preparing' | 'generating' | 'parsing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  currentCard?: number;
  totalCards?: number;
}

// ===== 自定义系统提示词 =====
export interface CustomSystemPrompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

// ===== 系统提示词配置 =====
export interface SystemPromptConfig {
  useBuiltin: boolean;  // 使用内置系统提示词
  customPrompt: string;  // 自定义系统提示词（单条，向后兼容）
  lastModified?: string;  // 最后修改时间
  // 🆕 自定义系统提示词列表
  customSystemPrompts?: CustomSystemPrompt[];  // 自定义系统提示词列表
  selectedSystemPromptId?: string;  // 当前选中的自定义系统提示词ID（如果为undefined或null，则使用内置或customPrompt）
}

// ===== 提示词模板 =====
export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;  // 用户提示词
  
  // 🆕 系统提示词配置
  systemPrompt?: string;  // 自定义系统提示词（可选）
  useBuiltinSystemPrompt: boolean;  // 是否使用内置系统提示词
  description?: string;  // 模板描述
  
  variables: string[];
  category: 'official' | 'custom';
  createdAt: string;
  updatedAt?: string;
}

// ===== 父卡片拆分请求 =====
export interface SplitCardRequest {
  /** 父卡片ID */
  parentCardId: string;
  
  /** 父卡片内容（包含front和back） */
  content: {
    front: string;
    back: string;
  };
  
  /** 目标子卡片数量（0=AI自动决定） */
  targetCount?: number;
  
  /** 拆分指令（可选） */
  instruction?: string;
  
  /** 目标模板ID（默认继承父卡片模板） */
  templateId?: string;
}

// ===== 父卡片拆分响应 =====
export interface SplitCardResponse {
  success: boolean;
  
  /** 生成的子卡片数据 */
  childCards?: Array<{
    front: string;
    back: string;
    tags?: string[];
    explanation?: string;
  }>;
  
  /** 错误信息 */
  error?: string;
  
  /** 使用情况 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost?: number;
  };
}

// ===== AI服务接口 =====
export interface IAIService {
  /**
   * 生成卡片
   */
  generateCards(
    content: string,
    config: GenerationConfig,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<AIServiceResponse>;

  /**
   * 重新生成单张卡片
   */
  regenerateCard(
    request: RegenerateRequest,
    config: GenerationConfig
  ): Promise<AIServiceResponse>;

  /**
   * 拆分父卡片为多个子卡片
   */
  splitParentCard(
    request: SplitCardRequest
  ): Promise<SplitCardResponse>;

  /**
   * 测试API连接
   */
  testConnection(): Promise<boolean>;

  /**
   * 通用对话接口（用于格式化等非生成场景）
   */
  chat(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    success: boolean;
    content?: string;
    model?: string;
    tokensUsed?: number;
    cost?: number;
    error?: string;
  }>;
}

// ===== 卡片转换结果 =====
export interface CardConversionResult {
  success: boolean;
  card?: Card;
  error?: string;
}

// ===== 批量导入结果 =====
export interface ImportResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
  errors: string[];
}

// ===== 历史记录 =====
export interface GenerationHistory {
  id: string;
  sourceFile: string | null;
  cardCount: number;
  selectedCount: number;
  importedCount: number;
  provider: string;
  model: string;
  cost: number;
  createdAt: string;
}

// ===== 自定义AI格式化功能 =====

/**
 * 自定义AI格式化功能配置
 */
export interface CustomFormatAction {
  id: string;                    // 唯一标识符
  name: string;                  // 功能名称（显示在菜单中）
  description?: string;          // 功能描述（可选）
  icon: string;                  // 图标（emoji或图标名）
  
  // 提示词配置
  systemPrompt: string;          // 系统提示词（支持变量）
  userPromptTemplate: string;    // 用户提示词模板（支持变量）
  
  // AI配置
  provider?: AIProvider;         // 指定AI提供商（可选，默认使用formattingProvider）
  model?: string;                // 指定AI模型（可选，默认使用provider的默认模型）
  temperature?: number;          // 温度参数（可选，默认0.1）
  maxTokens?: number;           // 最大token数（可选，默认2000）
  
  // 元数据
  category: 'official' | 'custom'; // 分类
  createdAt: string;             // 创建时间
  updatedAt?: string;            // 更新时间
  enabled: boolean;              // 是否启用
}

/**
 * 格式化结果预览
 */
export interface FormatPreviewResult {
  success: boolean;
  originalContent: string;       // 原始内容
  formattedContent?: string;     // 格式化后的内容
  provider?: AIProvider;         // 使用的AI提供商
  model?: string;                // 使用的模型
  error?: string;                // 错误信息
}

/**
 * 可用的模板变量
 */
export const TEMPLATE_VARIABLES: Record<string, string> = {
  '{{cardContent}}': '卡片完整内容（包含正反面）',
  '{{cardFront}}': '卡片正面内容',
  '{{cardBack}}': '卡片背面内容',
  '{{cardType}}': '卡片类型（问答/选择/挖空）',
  '{{templateName}}': '当前使用的模板名称',
  '{{deckName}}': '所属牌组名称',
  '{{tags}}': '卡片标签（逗号分隔）'
};

// ===== 统一的AI功能配置系统 =====

/**
 * AI功能类型
 * - format: 格式化功能（在现有卡片基础上优化内容）
 * - test-generator: 测试题生成功能（基于卡片生成测试题到考试牌组）
 * - split: 拆分功能（将复杂卡片拆分成多张简单子卡片）
 */
export type AIActionType = 'format' | 'test-generator' | 'split';

/**
 * 题目类型
 */
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill';

/**
 * 难度级别
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'mixed';

/**
 * 测试题生成配置
 */
export interface TestGenConfig {
  /** 默认生成数量 */
  defaultCount: number;
  
  /** 题目类型 */
  questionType: QuestionType;
  
  /** 难度级别 */
  difficultyLevel: DifficultyLevel;
  
  /** 目标牌组策略：auto=自动创建对应考试牌组, manual=手动指定 */
  targetDeckStrategy: 'auto' | 'manual';
  
  /** 手动指定的目标牌组ID（当strategy为manual时使用） */
  targetDeckId?: string;
}

/**
 * 统一的AI功能配置接口
 * 支持格式化、测试题生成和卡片拆分三种功能类型
 */
export interface AIAction {
  // 基础信息
  id: string;
  name: string;
  description?: string;
  icon: string;
  type: AIActionType;
  
  // AI提示词配置
  systemPrompt: string;
  userPromptTemplate: string;
  userPrompt?: string; // 向后兼容字段
  
  // AI服务配置（可选，未设置时使用插件默认配置）
  provider?: AIProvider;
  model?: string;
  
  // 测试题生成特有配置（仅当type='test-generator'时有效）
  testConfig?: TestGenConfig;
  
  // 拆分功能特有配置（仅当type='split'时有效）
  splitConfig?: {
    targetCount: number;
    splitStrategy: 'knowledge-point' | 'difficulty' | 'content-length';
    outputFormat: 'qa' | 'cloze' | 'mixed';
  };
  
  // 元数据
  category: 'official' | 'custom';
  createdAt: string;
  updatedAt?: string;
  enabled: boolean;
  
  // 🆕 官方模板专用字段
  isModified?: boolean;     // 用户是否修改过（仅官方模板使用）
  originalVersion?: string; // 原始版本号（用于升级检测）
}

/**
 * 测试题生成专用模板变量
 */
export const TEST_GEN_TEMPLATE_VARIABLES: Record<string, string> = {
  '{{cardContent}}': '卡片完整内容（包含正反面）',
  '{{cardFront}}': '卡片正面内容',
  '{{cardBack}}': '卡片背面内容',
  '{{cardType}}': '卡片类型（问答/选择/挖空）',
  '{{templateName}}': '当前使用的模板名称',
  '{{deckName}}': '所属牌组名称',
  '{{tags}}': '卡片标签（逗号分隔）',
  '{{数量}}': '生成题目数量',
  '{{类型}}': '题目类型（单选/多选/判断/填空）',
  '{{难度}}': '难度级别（简单/中等/困难/混合）',
  '{{目标牌组}}': '目标考试牌组名称'
};

/**
 * 测试题生成请求
 */
export interface TestGenerationRequest {
  /** 源卡片ID */
  sourceCardId: string;
  
  /** 源卡片内容 */
  sourceContent: {
    front: string;
    back: string;
    tags?: string[];
  };
  
  /** 生成配置 */
  config: {
    count: number;
    questionType: QuestionType;
    difficulty: DifficultyLevel;
    customPrompt?: string;
  };
  
  /** 目标题库牌组ID */
  targetDeckId: string;
}

/**
 * 单个生成的测试题
 * 
 *  数据结构说明：
 * - 统一使用 `content` 作为权威字段，存储完整的Markdown内容
 * - `front` 和 `back` 仅作为临时中间字段（用于AI解析），不应持久化到数据库
 * - 最终导入时必须将 front+back 转换为 content 格式
 */
export interface GeneratedTestQuestion {
  /** @deprecated 临时字段，用于AI解析，不应持久化 */
  front?: string;
  /** @deprecated 临时字段，用于AI解析，不应持久化 */
  back?: string;
  
  /**  权威字段：完整的Markdown格式内容（问题+答案，使用 ---div--- 分隔） */
  content: string;
  
  type: 'choice' | 'fill' | 'judge';
  
  // 选择题专用字段
  choices?: string[];
  correctAnswer?: number | number[];
  
  // 通用字段
  explanation?: string;
  difficulty?: DifficultyLevel;
  tags?: string[];
}

/**
 * 测试题生成响应
 */
export interface TestGenerationResponse {
  success: boolean;
  generatedQuestions?: GeneratedTestQuestion[];
  error?: string;
  metadata?: {
    provider: string;
    model: string;
    tokensUsed: number;
    cost?: number;
  };
}


