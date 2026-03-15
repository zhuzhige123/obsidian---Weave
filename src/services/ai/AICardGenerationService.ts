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

/** 卡片内容相似度去重阈值（前 N 个非空白字符相同即视为重复） */
const DEDUP_PREFIX_LENGTH = 60;

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
   * 提取卡片内容的去重指纹（取 content 的前 N 个非空白字符）
   */
  private getContentFingerprint(card: GeneratedCard): string {
    const raw = (card.content || '').replace(/\s+/g, '').toLowerCase();
    return raw.slice(0, DEDUP_PREFIX_LENGTH);
  }

  /**
   * 对新生成的卡片进行去重，过滤掉与已有卡片内容重复的条目
   */
  private deduplicateCards(
    newCards: GeneratedCard[],
    existingCards: GeneratedCard[]
  ): GeneratedCard[] {
    const existingFingerprints = new Set(
      existingCards.map(c => this.getContentFingerprint(c))
    );

    const uniqueCards: GeneratedCard[] = [];
    for (const card of newCards) {
      const fp = this.getContentFingerprint(card);
      if (!fp) continue;
      if (existingFingerprints.has(fp)) {
        logger.debug('[Dedup] 跳过重复卡片:', fp.slice(0, 30) + '...');
        continue;
      }
      existingFingerprints.add(fp);
      uniqueCards.push(card);
    }

    const removedCount = newCards.length - uniqueCards.length;
    if (removedCount > 0) {
      logger.debug(`[Dedup] 移除了 ${removedCount} 张重复卡片`);
    }
    return uniqueCards;
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

    // 确定使用的提示词模板（未替换变量的原始模板）
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

    // 智能分批：小数量（<=15）不分批，一次性生成
    const batches = totalCount <= 15
      ? [totalCount]
      : createBatches(totalCount, 'fast-first');
    logger.debug(`分批生成策略: ${batches.join(' + ')} = ${totalCount}张卡片`);

    // 循环生成每批
    for (let i = 0; i < batches.length; i++) {
      // 计算本批实际需要的数量（考虑已生成的卡片）
      const remaining = totalCount - generatedCards.length;
      if (remaining <= 0) {
        logger.debug(`已达到目标数量 ${totalCount}，提前终止`);
        break;
      }
      const batchSize = Math.min(batches[i], remaining);
      const batchNum = i + 1;

      logger.debug(`开始生成第${batchNum}批 (${batchSize}张, 剩余需要${remaining}张)`);

      // 在批次内替换模板变量，确保 {count}/{cardCount} 与本批请求数量一致
      const batchVariables = buildVariablesFromConfig({
        ...generationConfig,
        cardCount: batchSize
      });
      const batchPrompt = replaceTemplateVariables(promptText, batchVariables);

      const batchConfig: GenerationConfig = {
        ...generationConfig,
        cardCount: batchSize,
        templateId: selectedPrompt?.id || 'custom',
        promptTemplate: batchPrompt,
        customPrompt: customPrompt || undefined,
        provider: provider,
        model: model,
        temperature: generationConfig.temperature,
        maxTokens: generationConfig.maxTokens
      };

      callbacks.onProgress({
        status: 'generating',
        progress: Math.round((i / batches.length) * 100),
        message: batches.length > 1
          ? `正在生成第${batchNum}/${batches.length}批 (${batchSize}张)...`
          : `正在生成 ${batchSize} 张卡片...`,
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
        // 截断：AI返回数量可能超出请求，只取需要的数量
        let batchCards = response.cards;
        if (batchCards.length > batchSize) {
          logger.debug(`[Truncate] AI返回 ${batchCards.length} 张，截断到请求的 ${batchSize} 张`);
          batchCards = batchCards.slice(0, batchSize);
        }

        // 去重：过滤掉与已生成卡片内容重复的条目
        batchCards = this.deduplicateCards(batchCards, generatedCards);

        // 总量保护：确保累计不超过目标总数
        const canAdd = totalCount - generatedCards.length;
        if (batchCards.length > canAdd) {
          batchCards = batchCards.slice(0, canAdd);
        }

        const newCards = batchCards.map(card => ({
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
