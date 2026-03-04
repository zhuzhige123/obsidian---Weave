import { logger } from '../../utils/logger';
/**
 * AI驱动的卡片格式化服务
 * 使用真实AI模型进行智能格式规范化
 */

import type { AIProvider, CustomFormatAction, FormatPreviewResult } from '../../types/ai-types';
import type { Card } from '../../data/types';
import type { ParseTemplate } from '../../types/newCardParsingTypes';
import type { Deck } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { AIServiceFactory } from './AIServiceFactory';
import { PromptVariableResolver } from './PromptVariableResolver';

export interface FormatRequest {
  content: string;
  formatType: 'choice';
}

export interface FormatResponse {
  success: boolean;
  formattedContent?: string;
  error?: string;
  provider?: AIProvider;
  model?: string;
}

export class AIFormatterService {
  private static variableResolver = new PromptVariableResolver();
  
  /**
   * 使用自定义功能格式化卡片
   * @param action 自定义格式化功能配置
   * @param card 要格式化的卡片
   * @param context 上下文信息（模板、牌组）
   * @param plugin 插件实例
   * @returns 格式化预览结果
   */
  static async formatWithCustomAction(
    action: CustomFormatAction,
    card: Card,
    context: { template?: ParseTemplate; deck?: Deck },
    plugin: WeavePlugin
  ): Promise<FormatPreviewResult> {
    try {
      const aiConfig = plugin.settings.aiConfig;
      
      if (!aiConfig?.formatting?.enabled) {
        return {
          success: false,
          originalContent: card.content || '',
          error: 'AI格式化功能未启用'
        };
      }
      
      //  统一的provider选择逻辑：action.provider > defaultProvider
      // 注意：由AIActionExecutor统一处理，这里action.provider已经被设置
      const provider = action.provider || aiConfig.defaultProvider;
      
      if (!provider) {
        return {
          success: false,
          originalContent: card.content || '',
          error: '未设置AI提供商'
        };
      }
      
      // 检查API密钥
      const apiKeys = aiConfig.apiKeys as Partial<Record<AIProvider, any>>;
      const providerConfig = apiKeys[provider];
      if (!providerConfig || !providerConfig.apiKey) {
        return {
          success: false,
          originalContent: card.content || '',
          error: `AI提供商"${provider}"未配置API密钥，请前往 [插件设置 > AI服务] 进行配置`
        };
      }
      
      // 解析模板变量
      const systemPrompt = this.variableResolver.resolve(action.systemPrompt, card, context);
      const userPrompt = this.variableResolver.resolve(action.userPromptTemplate, card, context);
      
      // 获取AI服务
      const aiService = AIServiceFactory.createService(provider, plugin, action.model);
      
      // 调用AI服务
      const response = await aiService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: action.temperature ?? 0.1,
        maxTokens: action.maxTokens ?? 2000
      });
      
      if (!response.success || !response.content) {
        return {
          success: false,
          originalContent: card.content || '',
          error: response.error || 'AI格式化失败'
        };
      }
      
      // 清理AI响应
      const formattedContent = this.cleanAIResponse(response.content);
      
      return {
        success: true,
        originalContent: card.content || '',
        formattedContent,
        provider,
        model: response.model
      };
      
    } catch (error) {
      logger.error('[AIFormatterService] Error:', error);
      return {
        success: false,
        originalContent: card.content || '',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
  
  /**
   * 格式化选择题内容
   */
  static async formatChoiceQuestion(
    request: FormatRequest,
    plugin: WeavePlugin
  ): Promise<FormatResponse> {
    try {
      const aiConfig = plugin.settings.aiConfig;
      
      // 检查AI格式化是否启用
      if (!aiConfig?.formatting?.enabled) {
        return {
          success: false,
          error: 'AI格式化功能未启用，请在设置中开启'
        };
      }
      
      // 确定使用的提供商：优先使用formattingProvider，否则使用defaultProvider
      const provider = ((aiConfig as any).formattingProvider || aiConfig.defaultProvider) as AIProvider | undefined;
      
      if (!provider) {
        return {
          success: false,
          error: '未设置AI提供商，请在设置中配置'
        };
      }
      
      const apiKeys = aiConfig.apiKeys as Partial<Record<AIProvider, any>>;
      const providerConfig = apiKeys[provider];
      
      if (!providerConfig || !providerConfig.apiKey) {
        return {
          success: false,
          error: `格式化AI提供商"${provider}"未配置API密钥，请在设置中配置`
        };
      }
      
      // 直接使用提供商的模型配置
      const model = providerConfig.model;
      
      // 获取AI服务
      const aiService = AIServiceFactory.createService(provider, plugin);
      
      // 构建提示词
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request.content);
      
      // 调用AI服务
      const response = await aiService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        maxTokens: 2000
      });
      
      if (!response.success || !response.content) {
        logger.error('[AIFormatterService] AI调用失败:', response.error);
        return {
          success: false,
          error: response.error || 'AI格式化失败'
        };
      }
      
      // 清理AI响应内容（移除可能的代码块包裹）
      const formattedContent = this.cleanAIResponse(response.content);
      
      // 基础验证：检查是否符合选择题格式
      const validation = this.validateChoiceFormat(formattedContent);
      
      if (!validation.isValid) {
        logger.error('[AIFormatterService] 格式验证失败:', validation.reason);
        return {
          success: false,
          error: `格式化结果不符合规范：${validation.reason}`
        };
      }
      
      return {
        success: true,
        formattedContent,
        provider,
        model: response.model
      };
      
    } catch (error) {
      logger.error('[AIFormatterService] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
  
  /**
   * 构建系统提示词
   */
  private static buildSystemPrompt(): string {
    return `你是一个选择题格式规范化助手。

## 核心原则
1. **不修改内容** - 保持所有文本完全一致
2. **仅调整格式** - 将内容重组为标准格式
3. **识别正确答案** - 将正确答案编码到题干末尾括号中

## 标准格式
\`\`\`
Q: [问题内容]（B）

A. [选项A]
B. [选项B]
C. [选项C]
D. [选项D]

---div---

[解析内容]
\`\`\`

## 格式要求
- 问题以"Q: "开头
- 选项用 A. B. C. D. 标记
- 正确答案只能写在题干末尾：例如（B）或（A,C）
- 解析内容放在 ---div--- 分隔符之后

## 严格禁止
- 改写或润色任何文本
- 添加新内容或删除原有内容
- 修改正确答案
- 纠正拼写/语法错误
- 在选项行中添加 {✓}/{correct}/{*} 等标记
- 输出 Answer: / 正确答案: 这样的单独答案行

## 允许操作
- 统一格式标记（A) → A.）
- 添加/调整空行
- 把旧格式的正确答案标记（如 {✓}）转换为题干末尾括号（如（B））
- 规范分隔符格式

## 输出格式要求
**重要**：直接返回格式化后的文本内容，不要使用markdown代码块（\`\`\`）包裹，不要添加任何前缀、后缀或额外说明。

示例正确输出：
Q: 问题内容（B）

A. 选项A
B. 选项B

---div---

解析内容`;
  }
  
  /**
   * 构建用户提示词
   */
  private static buildUserPrompt(content: string): string {
    return `请规范化以下选择题：

${content}`;
  }
  
  /**
   * 清理AI响应内容
   * 移除可能存在的markdown代码块包裹和多余空白
   */
  private static cleanAIResponse(content: string): string {
    if (!content) return '';
    
    let cleaned = content.trim();
    
    // 检测并移除外层markdown代码块包裹
    // 匹配模式：```可选语言标识\n内容\n```
    const codeBlockRegex = /^```(?:markdown|md|text|)?\s*\n?([\s\S]*?)\n?```$/;
    const match = cleaned.match(codeBlockRegex);
    
    if (match) {
      // 提取代码块内的内容
      cleaned = match[1].trim();
    }
    
    // 清理多余的空白行（保留必要的分隔）
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned;
  }
  
  /**
   * 验证是否符合选择题格式
   */
  private static validateChoiceFormat(content: string): {
    isValid: boolean;
    reason?: string;
  } {
    // 1. 检查是否有问题
    if (!content.includes('Q:') && !content.includes('q:')) {
      return { isValid: false, reason: '缺少问题部分（Q:）' };
    }
    
    // 2. 检查是否有选项
    const optionsMatch = content.match(/^[A-Z][\)\.．、）]\s*/gm);
    if (!optionsMatch || optionsMatch.length < 2) {
      return { isValid: false, reason: '选项数量不足（至少需要2个）' };
    }
    
    // 3. 检查是否有正确答案标记
    const hasLegacyCorrectMarker = content.includes('{✓}') || content.toLowerCase().includes('{correct}') || content.includes('{*}');
    const hasTrailingAnswerParens = /^(?:Q:|q:|问题：)\s*.*[（(]\s*[A-Z](?:\s*[,，、]\s*[A-Z])*\s*[）)]\s*$/m.test(content);
    if (!hasLegacyCorrectMarker && !hasTrailingAnswerParens) {
      return { isValid: false, reason: '缺少正确答案信息（题干末尾（A,C）或旧格式{✓}）' };
    }
    
    return { isValid: true };
  }
}

