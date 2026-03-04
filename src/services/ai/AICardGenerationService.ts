/**
 * AI制卡核心生成服务
 * 
 * 从 AIAssistantPage 提取的独立生成逻辑，供 AI助手页面 和 编辑器全局工具栏 共用。
 */

import { Notice } from 'obsidian';
import { logger } from '../../utils/logger';
import type { WeavePlugin } from '../../main';
import type {
  PromptTemplate,
  GenerationConfig,
  GenerationProgress,
  GeneratedCard
} from '../../types/ai-types';
import { AIServiceFactory } from './AIServiceFactory';
import { validateContentLength } from '../../utils/file-utils';
import { replaceTemplateVariables, buildVariablesFromConfig } from '../../utils/prompt-template-utils';
import { createBatches } from '../../utils/batch-utils';

export interface AICardGenerationCallbacks {
  onProgress: (progress: GenerationProgress) => void;
  onCardsUpdate: (cards: GeneratedCard[]) => void;
}

export class AICardGenerationService {
  private plugin: WeavePlugin;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  private isRateLimitErrorMessage(message?: string): boolean {
    if (!message) return false;
    const m = message.toLowerCase();
    return (
      m.includes('429') ||
      m.includes('rate limit') ||
      m.includes('too many requests') ||
      m.includes('quota') ||
      message.includes('频率') ||
      message.includes('限流')
    );
  }

  private buildRateLimitNotice(provider: string, raw?: string): string {
    const detail = raw ? `\n\n原始信息：${raw}` : '';
    return `AI服务触发限流/配额限制（429）。\n\n建议：\n1) 稍后再试（通常需要等待一段时间）\n2) 减少生成数量或降低并发/频率\n3) 检查${provider}账户配额、余额或套餐限制\n4) 需要时切换模型/提供商${detail}`;
  }

  /**
   * 执行AI制卡生成（渐进式分批）
   * 
   * @param content 文档内容
   * @param generationConfig 生成配置
   * @param selectedPrompt 选中的提示词模板（可选）
   * @param customPrompt 自定义提示词（可选）
   * @param callbacks 进度和卡片更新回调
   * @returns 生成的卡片数组
   */
  async generateCards(
    content: string,
    generationConfig: GenerationConfig,
    selectedPrompt: PromptTemplate | null,
    customPrompt: string,
    callbacks: AICardGenerationCallbacks
  ): Promise<GeneratedCard[]> {
    // 验证内容
    const validation = validateContentLength(content);
    if (!validation.valid) {
      new Notice(validation.message || '内容验证失败');
      throw new Error(validation.message || '内容验证失败');
    }

    // 验证AI配置
    if (!this.plugin.settings.aiConfig) {
      new Notice('请先在设置中配置AI服务');
      throw new Error('请先在设置中配置AI服务');
    }

    // 确定使用的提示词
    const promptText = selectedPrompt 
      ? selectedPrompt.prompt 
      : customPrompt || '请根据以下内容生成学习卡片';

    let generatedCards: GeneratedCard[] = [];
    const totalCount = generationConfig.cardCount;

    callbacks.onProgress({
      status: 'preparing',
      progress: 0,
      message: '准备生成卡片...',
      currentCard: 0,
      totalCards: totalCount
    });

    // 构建基础生成配置
    const aiConfig = this.plugin.settings.aiConfig;
    if (!aiConfig) {
      throw new Error('AI配置未初始化');
    }

    const provider = generationConfig.provider;
    const model = generationConfig.model;
    const apiKeys = aiConfig.apiKeys as Record<string, { apiKey: string; enabled?: boolean } | undefined> | undefined;
    const providerConfig = apiKeys?.[provider];

    const aiService = AIServiceFactory.createService(provider, this.plugin, model);

    if (!providerConfig || !providerConfig.apiKey) {
      throw new Error(`${provider} API密钥未配置`);
    }

    // 替换模板变量
    const variables = buildVariablesFromConfig(generationConfig);
    const finalPrompt = replaceTemplateVariables(promptText, variables);

    // 智能分批
    const batches = createBatches(totalCount, 'fast-first');
    logger.debug(`分批生成策略: ${batches.join(' + ')} = ${totalCount}张卡片`);

    // 循环生成每批
    for (let i = 0; i < batches.length; i++) {
      const batchSize = batches[i];
      const batchNum = i + 1;

      logger.debug(`开始生成第${batchNum}批 (${batchSize}张)`);

      const batchConfig: GenerationConfig = {
        ...generationConfig,
        cardCount: batchSize,
        templateId: selectedPrompt?.id || 'custom',
        promptTemplate: finalPrompt,
        customPrompt: customPrompt || undefined,
        provider: provider,
        model: model,
        temperature: generationConfig.temperature,
        maxTokens: generationConfig.maxTokens
      };

      callbacks.onProgress({
        status: 'generating',
        progress: Math.round((i / batches.length) * 100),
        message: `正在生成第${batchNum}/${batches.length}批 (${batchSize}张)...`,
        currentCard: generatedCards.length,
        totalCards: totalCount
      });

      const response = await aiService.generateCards(
        content,
        batchConfig,
        (progress) => {
          callbacks.onProgress({
            ...progress,
            currentCard: generatedCards.length,
            totalCards: totalCount
          });
        }
      );

      if (response.success && response.cards) {
        const newCards = response.cards.map(card => ({
          ...card,
          isNew: true
        }));

        generatedCards = [...generatedCards, ...newCards];
        callbacks.onCardsUpdate(generatedCards);

        logger.debug(`第${batchNum}批完成: 新增${newCards.length}张，累计${generatedCards.length}/${totalCount}张`);

        // 短暂延迟，让用户看到卡片出现的动画
        await new Promise(resolve => setTimeout(resolve, 100));

        // 移除"新"标记
        generatedCards = generatedCards.map(card => ({
          ...card,
          isNew: false
        }));
        callbacks.onCardsUpdate(generatedCards);
      } else {
        logger.error(`第${batchNum}批生成失败:`, response.error);
        if (this.isRateLimitErrorMessage(response.error)) {
          throw new Error(this.buildRateLimitNotice(provider, response.error));
        }
      }
    }

    // 全部完成
    callbacks.onProgress({
      status: 'completed',
      progress: 100,
      message: `成功生成${generatedCards.length}张卡片`,
      currentCard: generatedCards.length,
      totalCards: totalCount
    });

    logger.debug('所有批次生成完成:', generatedCards);

    return generatedCards;
  }
}
