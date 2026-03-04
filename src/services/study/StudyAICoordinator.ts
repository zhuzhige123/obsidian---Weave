/**
 * 学习界面AI功能协调器
 * 
 * 职责：
 * - AI格式化功能
 * - AI测试题生成
 * - AI拆分功能
 * - 子卡片管理
 * - 题库保存
 * 
 * @created 2025-11-29
 */

import { Notice } from "obsidian";
import type { WeavePlugin } from "../../main";
import type { WeaveDataStorage } from "../../data/storage";
import type { Card, Deck } from "../../data/types";
import type { ParseTemplate } from "../../types/newCardParsingTypes";
import type { AIAction, SplitCardRequest, FormatPreviewResult } from "../../types/ai-types";
import { CardState, CardType } from "../../data/types";
import { DerivationMethod } from "../relation/types";
import { AIFormatterService } from "../ai/AIFormatterService";
import { cardToMarkdown, markdownToCard } from "../../utils/card-markdown-serializer";
import { getCardDeckIds } from "../../utils/yaml-utils";
import { logger } from "../../utils/logger";

/**
 * AI功能协调器上下文
 */
export interface AICoordinatorContext {
  plugin: WeavePlugin;
  dataStorage: WeaveDataStorage;
  decks: Deck[];
  availableTemplates: ParseTemplate[];
  formatActions: AIAction[];
  testGenActions: AIAction[];
}

/**
 * AI格式化结果回调
 */
export interface AIFormatCallbacks {
  onCardUpdated: (card: Card, index: number) => void;
  onForceRefresh: () => void;
}

/**
 * AI拆分/测试题生成结果
 */
export interface AIGenerationResult {
  success: boolean;
  cards: Card[];
  error?: string;
}

/**
 * 学习界面AI功能协调器
 */
export class StudyAICoordinator {
  constructor(private context: AICoordinatorContext) {}

  /**
   * AI格式化卡片（官方预设）
   */
  async formatCard(
    card: Card,
    formatType: string,
    cardIndex: number,
    callbacks: AIFormatCallbacks
  ): Promise<boolean> {
    if (!card) {
      new Notice('当前没有可格式化的卡片');
      return false;
    }

    // 检查AI配置
    const aiConfig = this.context.plugin.settings.aiConfig;
    if (!aiConfig?.formatting?.enabled) {
      new Notice('AI格式化功能未启用\n请在设置→AI配置中开启');
      return false;
    }

    try {
      logger.debug(`开始AI格式化，类型: ${formatType}`);
      
      const loadingNotice = new Notice('AI正在格式化卡片...', 0);
      
      // 获取卡片内容
      let currentContent = card.content || '';
      
      if (!currentContent.trim()) {
        // 降级方案：从fields构建
        const front = card.fields?.front || card.fields?.question || '';
        const back = card.fields?.back || card.fields?.answer || '';
        currentContent = front;
        if (back) {
          currentContent += '\n\n---\n\n' + back;
        }
      }
      
      if (!currentContent.trim()) {
        loadingNotice.hide();
        new Notice('卡片内容为空，无法格式化');
        return false;
      }
      
      logger.debug('📝 卡片内容长度:', currentContent.length);
      
      // 调用AI格式化服务
      const formatResult = await AIFormatterService.formatChoiceQuestion(
        { content: currentContent, formatType: 'choice' },
        this.context.plugin
      );
      
      loadingNotice.hide();
      
      if (!formatResult.success) {
        new Notice(`格式化失败\n${formatResult.error || '未知错误'}`);
        logger.error('[AI格式化] 失败:', formatResult);
        return false;
      }
      
      if (!formatResult.formattedContent) {
        new Notice('格式化结果为空');
        return false;
      }
      
      logger.debug('✅ AI格式化成功:', {
        provider: formatResult.provider,
        model: formatResult.model
      });
      
      // 更新卡片
      const updatedCard = { ...card };
      updatedCard.content = formatResult.formattedContent;
      updatedCard.modified = new Date().toISOString();
      
      // ✅ Content-Only: 只更新 content，不再更新 fields
      // 重新解析元数据
      try {
        const parsedCard = markdownToCard(formatResult.formattedContent, card);
        updatedCard.parsedMetadata = parsedCard.parsedMetadata;
      } catch (parseError) {
        logger.warn('[AI格式化] 元数据解析失败:', parseError);
      }
      
      // 保存卡片
      const result = await this.context.dataStorage.saveCard(updatedCard);
      
      if (result.success) {
        callbacks.onCardUpdated(updatedCard, cardIndex);
        
        const providerLabel = formatResult.provider ? ` (${formatResult.provider})` : '';
        new Notice(`AI格式化成功${providerLabel}`);
        
        logger.debug('✅ 卡片已保存');
        callbacks.onForceRefresh();
        return true;
      } else {
        new Notice('保存失败');
        return false;
      }
      
    } catch (error) {
      logger.error('[AI格式化] 异常:', error);
      new Notice(
        `格式化失败\n${error instanceof Error ? error.message : '未知错误'}`
      );
      return false;
    }
  }

  /**
   * AI格式化卡片（自定义功能）
   */
  async formatCardCustom(
    card: Card,
    actionId: string
  ): Promise<FormatPreviewResult | null> {
    if (!card) {
      new Notice('当前没有可格式化的卡片');
      return null;
    }
    
    const action = this.context.formatActions.find(a => a.id === actionId);
    if (!action) {
      new Notice('未找到该格式化功能');
      return null;
    }
    
    const loadingNotice = new Notice('AI正在格式化...', 0);
    
    try {
      const result = await AIFormatterService.formatWithCustomAction(
        action,
        card,
        {
          template: this.context.availableTemplates.find(t => t.id === card.templateId),
          // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
          deck: this.context.decks.find(d => d.id === (getCardDeckIds(card).primaryDeckId || card.deckId))
        },
        this.context.plugin
      );
      
      loadingNotice.hide();
      
      if (result.success) {
        return result;
      } else {
        new Notice('格式化失败: ' + result.error);
        return null;
      }
    } catch (error) {
      loadingNotice.hide();
      logger.error('[AI格式化] 异常:', error);
      new Notice('格式化失败: ' + (error instanceof Error ? error.message : '未知错误'));
      return null;
    }
  }

  /**
   * 应用格式化结果
   */
  async applyFormatResult(
    card: Card,
    formatResult: FormatPreviewResult,
    cardIndex: number,
    callbacks: AIFormatCallbacks
  ): Promise<boolean> {
    if (!card || !formatResult?.formattedContent) return false;
    
    try {
      const updatedCard = { ...card };
      updatedCard.content = formatResult.formattedContent;
      updatedCard.modified = new Date().toISOString();
      
      // ✅ Content-Only: 只更新 content，不再更新 fields
      // 重新解析元数据
      try {
        const parsedCard = markdownToCard(formatResult.formattedContent, card);
        updatedCard.parsedMetadata = parsedCard.parsedMetadata;
      } catch (parseError) {
        logger.warn('[AI格式化] 元数据解析失败:', parseError);
      }
      
      // 保存卡片
      const result = await this.context.dataStorage.saveCard(updatedCard);
      
      if (result.success) {
        callbacks.onCardUpdated(updatedCard, cardIndex);
        
        const providerLabel = formatResult.provider ? ` (${formatResult.provider})` : '';
        new Notice(`AI格式化成功${providerLabel}`);
        
        logger.debug('✅ 卡片已保存并应用格式化');
        callbacks.onForceRefresh();
        return true;
      } else {
        new Notice('保存失败');
        return false;
      }
    } catch (error) {
      logger.error('[AI格式化] 应用失败:', error);
      new Notice('应用失败: ' + (error instanceof Error ? error.message : '未知错误'));
      return false;
    }
  }

  /**
   * 生成测试题
   */
  async generateTests(
    card: Card,
    actionId: string
  ): Promise<AIGenerationResult> {
    if (!card) {
      new Notice('当前没有可生成测试题的卡片');
      return { success: false, cards: [], error: '无卡片' };
    }

    try {
      // 1. 获取测试题生成器配置
      const action = this.context.testGenActions.find(a => a.id === actionId);
      
      if (!action || !action.testConfig) {
        new Notice('找不到指定的测试题生成功能');
        return { success: false, cards: [], error: '找不到生成器' };
      }

      new Notice('正在生成测试题...');

      // 2. 使用专用的AI测试题生成服务
      const { AITestGeneratorService } = await import('../ai/AITestGeneratorService');
      const testGeneratorService = new AITestGeneratorService(this.context.plugin);
      
      logger.debug('[测试题生成] 使用测试题生成服务:', action.id);

      // 3. 构建测试题生成请求
      const generateRequest = {
        sourceCard: card,
        action: action,
        targetDeckId: undefined
      };

      // 4. 调用专用的AI测试题生成服务
      const response = await testGeneratorService.generateTests(generateRequest);

      if (!response.success || !response.generatedQuestions || response.generatedQuestions.length === 0) {
        throw new Error(response.error || '生成失败');
      }

      // 5. 转换为临时卡片数据（用于预览）
      const tempChildCards: Card[] = response.generatedQuestions.map((question: any, index: number) => {
        // 为选择题构建完整的content
        let content: string;
        if (question.type === 'choice' && question.back) {
          content = `${question.front}\n\n---div---\n\n${question.back}`;
        } else if (question.back) {
          content = `${question.front}\n\n${question.back}`;
        } else {
          content = question.front;
        }
        
        return {
          id: `temp-${Date.now()}-${index}`,
          uuid: `temp-uuid-${Date.now()}-${index}`,
          deckId: card.deckId,
          templateId: card.templateId,
          type: question.type === 'choice' ? CardType.Multiple : CardType.Basic,
          content: content,
          // ✅ Content-Only: 不再生成 fields
          tags: ['AI生成', ...(card.tags || [])],
          priority: 0,
          difficulty: question.difficulty || action.testConfig?.difficultyLevel,
          cardPurpose: 'test',
          sourceFile: card.sourceFile || '',
          sourceBlock: card.sourceBlock,
          sourceRange: card.sourceRange,
          sourceExists: card.sourceExists,
          sourceFileMtime: card.sourceFileMtime,
          metadata: {
            questionType: question.type || action.testConfig?.questionType || 'single',
            generatedBy: action.id,
            generatedAt: new Date().toISOString(),
            explanation: question.explanation,
            sourceCardId: card.uuid
          },
          fsrs: {
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: CardState.New,
            retrievability: 0
          },
          reviewHistory: [],
          stats: {
            totalReviews: 0,
            totalTime: 0,
            averageTime: 0,
            memoryRate: 0
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        };
      });

      new Notice(`成功生成${tempChildCards.length}道测试题`);
      return { success: true, cards: tempChildCards };
      
    } catch (error) {
      logger.error('[测试题生成] 失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      new Notice(`生成失败: ${errorMessage}`);
      return { success: false, cards: [], error: errorMessage };
    }
  }

  /**
   * AI拆分卡片
   */
  async splitCard(
    card: Card,
    targetCount: number = 0,
    positionMap?: Map<number, string>
  ): Promise<AIGenerationResult> {
    if (!card) {
      return { success: false, cards: [], error: '无卡片' };
    }

    try {
      // 区分首次拆分和重新生成
      const isRegeneration = positionMap && positionMap.size > 0;
      if (!isRegeneration) {
        new Notice('正在拆分卡片...');
      }

      // 获取AI服务
      const { AIServiceFactory } = await import('../ai/AIServiceFactory');

      const aiConfig = this.context.plugin.settings.aiConfig;
      const provider = aiConfig?.defaultProvider || 'openai';

      logger.debug('[AI拆分] 使用提供商:', provider);
      const aiService = AIServiceFactory.createService(provider, this.context.plugin);

      if (!aiService) {
        throw new Error(`AI服务未配置，请在设置中配置 ${provider} 的API密钥`);
      }

      // 构建拆分请求
      const request: SplitCardRequest = {
        parentCardId: card.uuid,
        content: {
          front: card.fields?.front || card.content || '',
          back: card.fields?.back || ''
        },
        targetCount: targetCount,
        instruction: this.context.plugin.settings.aiConfig?.cardSplitting?.defaultInstruction || undefined,
        templateId: card.templateId
      };

      // 调用AI拆分
      const response = await aiService.splitParentCard(request);

      if (!response.success || !response.childCards || response.childCards.length === 0) {
        throw new Error(response.error || '拆分失败');
      }

      // 转换为临时卡片数据
      const now = new Date().toISOString();
      const tempChildCards: Card[] = response.childCards.map((child: any, index: number) => ({
        uuid: `temp-uuid-${Date.now()}-${index}`,
        deckId: card.deckId,
        templateId: card.templateId,
        type: card.type,
        cardPurpose: 'memory',
        content: `${child.front}\n\n---div---\n\n${child.back}`,
        tags: child.tags || card.tags || [],
        priority: 0,
        fsrs: {
          due: now,
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          state: CardState.New,
          retrievability: 0
        },
        reviewHistory: [],
        stats: {
          totalReviews: 0,
          totalTime: 0,
          averageTime: 0,
          memoryRate: 0
        },
        created: now,
        modified: now,

        parentCardId: card.uuid,
        relationMetadata: {
          derivationMethod: DerivationMethod.AI_SPLIT,
          sourceCardId: card.uuid,
          createdAt: now,
          isParent: false,
          level: 1
        }
      }));

      if (!isRegeneration) {
        new Notice(`成功拆分为${tempChildCards.length}张子卡片`);
      }

      return { success: true, cards: tempChildCards };

    } catch (error) {
      logger.error('[AI拆分] 失败:', error);
      const errorMessage = error instanceof Error ? error.message : '拆分失败';
      new Notice(`拆分失败: ${errorMessage}`);
      return { success: false, cards: [], error: errorMessage };
    }
  }

  /**
   * 加载记忆牌组列表
   */
  async loadMemoryDecks(): Promise<Array<{ id: string; name: string }>> {
    try {
      const allDecks = await this.context.dataStorage.getDecks();

      // 只加载记忆学习牌组（非题库牌组）
      const memoryDecks = allDecks
        .filter(deck => deck.purpose !== 'test')
        .map(deck => ({
          id: deck.id,
          name: deck.name
        }));

      return memoryDecks;
    } catch (error) {
      logger.error('[AI拆分] 加载记忆牌组失败:', error);
      // 创建默认牌组备用
      return [{ id: 'default-memory', name: '默认记忆牌组' }];
    }
  }

  /**
   * 保存卡片到题库
   */
  async saveToQuestionBank(cards: Card[], parentCard: Card): Promise<number> {
    if (!this.context.plugin.questionBankService) {
      throw new Error('题库服务未初始化');
    }

    try {
      logger.debug('[题库保存] 准备保存卡片:', {
        count: cards.length,
        parentCardId: parentCard.uuid
      });

      const qbService = this.context.plugin.questionBankService;
      const parentDeckInfo = getCardDeckIds(parentCard, this.context.decks);
      const parentDeckId = parentDeckInfo.primaryDeckId;
      const parentDeckName = parentDeckId
        ? (this.context.decks.find((d) => d.id === parentDeckId)?.name || '默认')
        : '默认';

      const questionBankName = `${parentDeckName} - 题库`;
      let bank = qbService.getAllQuestionBanks().find((b: any) => b.name === questionBankName);
      if (!bank) {
        bank = await qbService.createBank({
          name: questionBankName,
          description: `从牌组\"${parentDeckName}\"自动生成的题库`,
          deckType: 'question-bank'
        });
      }

      await qbService.addQuestions(bank.id, cards);
      return cards.length;
    } catch (error) {
      logger.error('[题库保存] 失败:', error);
      throw error;
    }
  }
}
