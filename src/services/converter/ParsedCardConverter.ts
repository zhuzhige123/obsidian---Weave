import { logger } from '../../utils/logger';
/**
 * ParsedCard 到 Card 的转换器
 * 负责将解析后的卡片转换为数据库可存储的格式
 */

import { FSRS } from '../../algorithms/fsrs';
import type { Card } from '../../data/types';
import type { ParsedCard, CardType } from '../../types/newCardParsingTypes';
import type {
  ConversionOptions,
  ConversionResult,
  BatchConversionResult
} from '../../types/converter-types';
// 🆕 v2.2: 导入 YAML 工具函数
import { createContentWithMetadata } from '../../utils/yaml-utils';

/**
 * 卡片转换器
 */
export class ParsedCardConverter {
  private fsrs: FSRS;
  private app: any;

  constructor(app: any, fsrs: FSRS) {
    this.app = app;
    this.fsrs = fsrs;
  }

  /**
   * 将单个 ParsedCard 转换为 Card
   *  Content-Only 架构：生成 content 而非 fields
   */
  convertToCard(
    parsedCard: ParsedCard,
    options: ConversionOptions
  ): ConversionResult {
    try {
      // 1. 生成 UUID（使用现有或新建）
      const uuid = parsedCard.metadata?.uuid || this.generateUUID();

      // 2. 构建 content（Content-Only 架构核心）
      // 🆕 v2.2: 在 content 中写入 we_decks YAML 元数据
      const bodyContent = this.buildContent(parsedCard);
      const content = this.buildContentWithMetadata(bodyContent, options);

      // 3. 转换卡片类型
      const cardType = this.convertCardType(parsedCard.type);

      // 4. 合并标签
      const tags = [
        ...parsedCard.tags,
        ...(options.additionalTags || [])
      ];

      // 5. 初始化 FSRS 数据
      const fsrsCard = this.fsrs.createCard();
      
      // 转换为 FSRSData 格式（兼容旧类型系统）
      const fsrsData: any = {
        state: fsrsCard.state,
        due: fsrsCard.due,
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        elapsed_days: fsrsCard.elapsedDays,
        scheduled_days: fsrsCard.scheduledDays,
        reps: fsrsCard.reps,
        lapses: fsrsCard.lapses,
        last_review: fsrsCard.lastReview,
        parameters: null
      };

      // 6. 生成时间戳
      const now = new Date().toISOString();

      // 7. 构建 Card 对象（Content-Only 架构）
      const card: Card = {
        uuid: uuid,
        deckId: options.deckId,
        //  templateId 为可选，依赖 type 判断题型
        type: cardType,
        content: content,  //  唯一权威数据源
        //  不再生成 fields
        tags: tags,
        
        // 时间戳
        created: now,
        modified: now,
        
        // FSRS 数据
        fsrs: fsrsData,
        
        // 统计信息
        stats: {
          totalReviews: 0,
          totalTime: 0,
          averageTime: 0
        },
        
        // 其他属性
        priority: options.priority ?? 0
      };

      // 8. 保留源文件信息（如果启用）
      if (options.preserveSourceInfo !== false) {
        // 🆕 关键修复：从 metadata 或顶层读取溯源信息
        const sourceFile = parsedCard.sourceFile || parsedCard.metadata?.sourceFile;
        const sourceBlock = parsedCard.sourceBlock || parsedCard.metadata?.sourceBlock;
        
        if (sourceFile) {
          card.sourceFile = sourceFile;
        }
        if (sourceBlock) {
          card.sourceBlock = sourceBlock;
        }
      }

      return {
        success: true,
        card: card
      };

    } catch (error) {
      logger.error('[ParsedCardConverter] 转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知转换错误'
      };
    }
  }

  /**
   * 批量转换 ParsedCard 到 Card
   */
  convertBatch(
    parsedCards: ParsedCard[],
    options: ConversionOptions
  ): BatchConversionResult {
    const cards: Card[] = [];
    const errors: BatchConversionResult['errors'] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < parsedCards.length; i++) {
      const parsedCard = parsedCards[i];
      const result = this.convertToCard(parsedCard, options);

      if (result.success && result.card) {
        cards.push(result.card);
        successCount++;
      } else {
        errors.push({
          index: i,
          cardId: parsedCard.id,
          error: result.error || '未知错误'
        });
        failureCount++;
      }
    }

    return {
      success: failureCount === 0,
      successCount,
      failureCount,
      cards,
      errors
    };
  }

  /**
   * 🆕 v2.2: 构建带有 YAML 元数据的 content
   * 在 content 中注入 we_decks 等元数据
   */
  private buildContentWithMetadata(bodyContent: string, options: ConversionOptions): string {
    // 如果没有牌组名称，直接返回原内容
    if (!options.deckName) {
      return bodyContent;
    }
    
    // 构建 YAML 元数据
    const yamlMetadata: Record<string, any> = {
      we_decks: [options.deckName]
    };
    
    // 使用工具函数生成带 frontmatter 的 content
    return createContentWithMetadata(yamlMetadata, bodyContent);
  }

  /**
   * 构建 content 字段
   *  Content-Only 架构核心方法
   */
  private buildContent(parsedCard: ParsedCard): string {
    // 优先使用 content 字段（新架构）
    if (parsedCard.content) {
      return parsedCard.content;
    }

    // 向后兼容：从 front/back 构建 content
    if (parsedCard.front || parsedCard.back) {
      const front = parsedCard.front || '';
      const back = parsedCard.back || '';
      
      if (back) {
        return `${front}\n---div---\n${back}`;
      }
      return front;
    }

    // 降级：从 fields 重建（极端向后兼容）
    if (parsedCard.fields) {
      const front = parsedCard.fields.front || parsedCard.fields.Front || '';
      const back = parsedCard.fields.back || parsedCard.fields.Back || '';
      
      if (back) {
        return `${front}\n---div---\n${back}`;
      }
      return front;
    }

    return '';
  }

  /**
   * 转换卡片类型
   *  从 ParsedCard 的简化类型转换为 Card 的完整类型
   */
  private convertCardType(type: CardType): import('../../data/types').CardType {
    switch (type) {
      case 'basic':
        return 'basic' as any;
      case 'multiple':
        return 'multiple' as any;
      case 'cloze':
        return 'cloze' as any;
      default:
        return 'basic' as any;
    }
  }

  /**
   * 推断模板ID
   * @deprecated Content-Only 架构不再需要模板，保留仅用于向后兼容
   */
  private inferTemplate(
    _parsedCard: ParsedCard,
    options: ConversionOptions
  ): string {
    // Content-Only 架构下，templateId 为可选
    if (options.templateId) {
      return options.templateId;
    }

    // 2. 优先使用卡片自带的模板
    if (_parsedCard.template) {
      return _parsedCard.template;
    }

    // 3. 根据卡片类型推断默认模板（向后兼容）
    const defaultTemplates: Record<string, string> = {
      basic: 'official-qa',
      cloze: 'official-cloze',
      multiple: 'official-mcq'
    };

    return defaultTemplates[_parsedCard.type] || 'official-qa';
  }

  /**
   * 生成唯一的卡片ID
   */
  private generateCardId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `card_${timestamp}_${random}`;
  }

  /**
   * 生成 UUID（用于卡片）
   */
  private generateUUID(): string {
    // 使用与项目其他部分一致的 UUID 生成逻辑
    const chars = '23456789abcdefghjkmnpqrstuvwxyz';
    let result = 'tk-';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}



