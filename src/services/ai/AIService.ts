import { logger } from '../../utils/logger';
/**
 * AI服务抽象基类
 */

import type {
  IAIService,
  GenerationConfig,
  AIServiceResponse,
  RegenerateRequest,
  GenerationProgress,
  SystemPromptConfig,
  SplitCardRequest,
  SplitCardResponse
} from '../../types/ai-types';
import type { ParseTemplate } from '../../types/newCardParsingTypes';
import { OFFICIAL_TEMPLATES } from '../../constants/official-templates';
import { PromptBuilderService } from './PromptBuilderService';

/**
 * Chat消息接口
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat请求接口
 */
export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Chat响应接口
 */
export interface ChatResponse {
  success: boolean;
  content?: string;
  model?: string;
  tokensUsed?: number;
  cost?: number;
  error?: string;
}

export abstract class AIService implements IAIService {
  protected apiKey: string;
  protected model: string;
  protected baseUrl: string = ''; // 🆕 API基础地址
  protected systemPromptConfig?: SystemPromptConfig;

  constructor(apiKey: string, model: string, baseUrl?: string, systemPromptConfig?: SystemPromptConfig) {
    this.apiKey = apiKey;
    this.model = model;
    this.systemPromptConfig = systemPromptConfig;
    // 🆕 如果提供了自定义baseUrl，子类在调用super后会被覆盖
    // 子类需要在调用super后处理baseUrl
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
  }

  /**
   * 生成卡片
   */
  abstract generateCards(
    content: string,
    config: GenerationConfig,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<AIServiceResponse>;

  /**
   * 重新生成单张卡片
   */
  abstract regenerateCard(
    request: RegenerateRequest,
    config: GenerationConfig
  ): Promise<AIServiceResponse>;

  /**
   * 拆分父卡片为多个子卡片
   */
  abstract splitParentCard(
    request: SplitCardRequest
  ): Promise<SplitCardResponse>;

  /**
   * 测试API连接
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 通用对话接口（用于格式化等非生成场景）
   */
  abstract chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * 加载模板信息
   */
  protected loadTemplates(config: GenerationConfig): {
    qa?: ParseTemplate;
    choice?: ParseTemplate;
    cloze?: ParseTemplate;
  } {
    const templates = config.templates;
    if (!templates) return {};

    return {
      qa: OFFICIAL_TEMPLATES.find(t => t.id === templates.qa),
      choice: OFFICIAL_TEMPLATES.find(t => t.id === templates.choice),
      cloze: OFFICIAL_TEMPLATES.find(t => t.id === templates.cloze)
    };
  }

  /**
   * 构建系统提示词（使用PromptBuilderService）
   */
  protected buildSystemPrompt(config: GenerationConfig): string {
    return PromptBuilderService.buildSystemPrompt(config, this.systemPromptConfig);
  }

  /**
   * 构建用户提示词（使用PromptBuilderService）
   */
  protected buildUserPrompt(content: string, promptTemplate: string): string {
    return PromptBuilderService.buildUserPrompt(content, promptTemplate);
  }

  /**
   * 解析AI响应为卡片数组
   */
  protected parseResponse(responseText: string): any[] {
    try {
      const trimmed = (responseText ?? '').trim();

      // 尝试直接解析
      const direct = this.tryParseJson(trimmed);
      const directCards = this.extractCardsFromParsed(direct);
      if (directCards) {
        return directCards;
      }

      const objectMatch = trimmed.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        const obj = this.tryParseJson(objectMatch[0]);
        const objCards = this.extractCardsFromParsed(obj);
        if (objCards) {
          return objCards;
        }
      }

      // 尝试提取JSON数组
      const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const arr = this.tryParseJson(arrayMatch[0]);
        const arrCards = this.extractCardsFromParsed(arr);
        if (arrCards) {
          return arrCards;
        }
      }

      throw new Error('AI返回的内容格式不正确');
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      throw new Error('AI返回的内容格式不正确');
    }
  }

  private tryParseJson(text: string): unknown {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private extractCardsFromParsed(parsed: unknown): any[] | null {
    if (!parsed) return null;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const cards = obj.cards;
      if (Array.isArray(cards)) {
        return cards;
      }
    }

    return null;
  }

  /**
   * 生成卡片ID
   */
  protected generateCardId(): string {
    return `ai-card-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 估算成本（默认实现）
   */
  protected estimateCost(promptTokens: number, completionTokens: number): number {
    // 默认按GPT-4定价估算（实际应根据不同模型调整）
    const promptCost = (promptTokens / 1000) * 0.03;
    const completionCost = (completionTokens / 1000) * 0.06;
    return promptCost + completionCost;
  }

  /**
   * 处理API错误
   */
  protected handleError(error: any): AIServiceResponse {
    logger.error('AI Service Error:', error);

    let errorMessage = 'AI服务调用失败';

    if (error.message) {
      errorMessage = error.message;
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error.message || errorMessage;
    } else if (error.status === 401) {
      errorMessage = 'API密钥无效或已过期';
    } else if (error.status === 429) {
      errorMessage = 'AI服务触发限流/配额限制（429），请稍后再试或检查账户配额/余额';
    } else if (error.status === 500) {
      errorMessage = 'AI服务暂时不可用';
    }

    const msgLower = (errorMessage || '').toLowerCase();
    if (
      msgLower.includes('429') ||
      msgLower.includes('rate limit') ||
      msgLower.includes('too many requests') ||
      msgLower.includes('quota') ||
      errorMessage.includes('频率') ||
      errorMessage.includes('限流')
    ) {
      errorMessage = 'AI服务触发限流/配额限制（429），请稍后再试；也可减少生成数量或检查账户配额/余额';
    }

    return {
      success: false,
      error: errorMessage
    };
  }

  /**
   * 分类连接测试错误，返回用户可理解的错误信息
   * 子类在 testConnection catch 中调用后 throw
   */
  protected classifyConnectionError(error: any): Error {
    const status = error?.status;
    const msg = (error?.message || '').toLowerCase();

    if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('authentication')) {
      return new Error('API\u5bc6\u94a5\u65e0\u6548\u6216\u5df2\u8fc7\u671f\uff0c\u8bf7\u68c0\u67e5\u5bc6\u94a5\u662f\u5426\u6b63\u786e');
    }

    if (status === 404 || msg.includes('not found')) {
      return new Error('API\u5730\u5740\u9519\u8bef\u6216\u670d\u52a1\u4e0d\u53ef\u8fbe\uff0c\u8bf7\u68c0\u67e5\u81ea\u5b9a\u4e49URL\u662f\u5426\u6b63\u786e');
    }

    if (status === 429 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many')) {
      return new Error('\u8bf7\u6c42\u9891\u7387\u8d85\u9650\u6216\u914d\u989d\u4e0d\u8db3\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u6216\u68c0\u67e5\u8d26\u6237\u4f59\u989d');
    }

    if (status >= 500 || msg.includes('internal server') || msg.includes('overloaded') || msg.includes('529')) {
      return new Error('\u670d\u52a1\u7aef\u9519\u8bef\uff0cAI\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
    }

    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('econnaborted')) {
      return new Error('\u8fde\u63a5\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u6216\u589e\u52a0\u8d85\u65f6\u65f6\u95f4');
    }

    if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network') || msg.includes('fetch failed')) {
      return new Error('\u65e0\u6cd5\u8fde\u63a5\u5230\u670d\u52a1\u5668\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u548cAPI\u5730\u5740');
    }

    return new Error(error?.message || '\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u914d\u7f6e');
  }
}


