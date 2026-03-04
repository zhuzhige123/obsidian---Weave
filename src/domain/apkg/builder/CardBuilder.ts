/**
 * 卡片构建器
 * 
 * 负责将Anki笔记转换为Weave卡片格式
 * 
 * @module domain/apkg/builder
 */

import type { Card } from '../../../data/types';
import { CardType } from '../../../data/types';
import type {
  CardBuildParams,
  CardBuildResult,
  AnkiNote,
  AnkiModel,
  ConversionConfig
} from '../types';
import { ContentConverter } from '../converter/ContentConverter';
import { APKGLogger } from '../../../infrastructure/logger/APKGLogger';
import { generateId, generateUUID } from '../../../utils/helpers';
// 🆕 v2.2: 导入 YAML 工具函数
import { createContentWithMetadata } from '../../../utils/yaml-utils';

/**
 * 卡片构建器
 */
export class CardBuilder {
  private logger: APKGLogger;
  private converter: ContentConverter;
  private currentConversionConfig?: ConversionConfig;

  constructor() {
    this.logger = new APKGLogger({ prefix: '[CardBuilder]' });
    this.converter = new ContentConverter();
  }

  /**
   * 构建Weave卡片
   * 
   * @param params - 构建参数
   * @returns 构建结果
   */
  build(params: CardBuildParams): CardBuildResult {
    const warnings: string[] = [];
    
    try {
      this.logger.debug(`构建卡片: 笔记${params.note.id}`);

      this.currentConversionConfig = params.conversionConfig;
      
      // 1. 解析字段值
      const fields = this.parseFields(params.note, params.model);
      
      // 2. 分类字段（按显示面）
      const { frontFields, backFields, bothFields } = this.classifyFields(
        fields,
        params.fieldSideMap
      );
      
      // 3. 转换内容为Markdown
      const frontContent = this.convertFields(frontFields, params.mediaPathMap);
      const backContent = this.convertFields(backFields, params.mediaPathMap);
      const bothContent = this.convertFields(bothFields, params.mediaPathMap);
      
      // 4. 组装卡片内容
      const content = this.assembleContent(
        frontContent,
        backContent,
        bothContent
      );
      
      // 5. 🆕 v2.2: 在 content 中写入 YAML 元数据 (Content-Only 架构)
      // 解析标签和类型
      const tags = params.note.tags ? params.note.tags.split(' ').filter(t => t.trim()) : [];
      const cardType = params.model.type === 1 ? 'cloze' : 'basic';
      
      const finalContent = this.buildContentWithMetadata(content, {
        deckName: params.deckName,
        cardType,
        tags
      });
      
      // 6. 创建Card对象
      const card = this.createCard(
        finalContent,
        params.deckId,
        params.templateId,
        params.note,
        params.model,
        fields
      );
      
      this.logger.debug(`卡片构建成功: ${card.uuid}`);
      
      return {
        card,
        warnings,
        success: true
      };
      
    } catch (error) {
      this.logger.error('卡片构建失败', error);
      
      return {
        card: null,
        warnings: [`构建失败: ${(error as Error).message}`],
        success: false
      };
    } finally {
      this.currentConversionConfig = undefined;
    }
  }

  /**
   * 解析字段值
   */
  private parseFields(note: AnkiNote, model: AnkiModel): Record<string, string> {
    const fieldValues = note.flds.split('\x1f');  // Anki使用\x1f分隔字段
    const fields: Record<string, string> = {};
    
    model.flds.forEach((field, index) => {
      const value = fieldValues[index] || '';
      if (value.trim()) {
        fields[field.name] = value;
      }
    });
    
    return fields;
  }

  /**
   * 分类字段
   */
  private classifyFields(
    fields: Record<string, string>,
    sideMap: Record<string, 'front' | 'back' | 'both'>
  ): {
    frontFields: Record<string, string>;
    backFields: Record<string, string>;
    bothFields: Record<string, string>;
  } {
    const frontFields: Record<string, string> = {};
    const backFields: Record<string, string> = {};
    const bothFields: Record<string, string> = {};
    
    for (const [name, value] of Object.entries(fields)) {
      const side = sideMap[name] || 'both';
      
      if (side === 'front') {
        frontFields[name] = value;
      } else if (side === 'back') {
        backFields[name] = value;
      } else {
        bothFields[name] = value;
      }
    }
    
    return { frontFields, backFields, bothFields };
  }

  /**
   * 转换字段内容
   */
  private convertFields(
    fields: Record<string, string>,
    mediaPathMap: Map<string, string>
  ): string[] {
    const converted: string[] = [];
    
    for (const [name, value] of Object.entries(fields)) {
      // 转换HTML为Markdown
      const result = this.converter.convert(value, this.currentConversionConfig);
      
      // 替换媒体占位符
      const markdown = this.converter.replaceMediaPlaceholders(
        result.markdown,
        result.mediaRefs,
        mediaPathMap,
        this.currentConversionConfig
      );
      
      //  Content-Only 架构：不添加字段名前缀，直接返回纯净内容
      // 字段名已保存在 customFields.ankiOriginal.fields 中
      converted.push(markdown);
    }
    
    return converted;
  }

  /**
   * 🆕 v2.2: 构建带有 YAML 元数据的 content
   * 
   * Content-Only 架构：将所有元数据写入 content YAML frontmatter
   * - we_decks: 牌组名称
   * - we_type: 卡片类型
   * - tags: 标签列表
   */
  private buildContentWithMetadata(
    bodyContent: string, 
    options: {
      deckName?: string;
      cardType?: string;
      tags?: string[];
    }
  ): string {
    const yamlMetadata: Record<string, any> = {};
    
    // 写入牌组名称
    if (options.deckName) {
      yamlMetadata.we_decks = [options.deckName];
    }
    
    // 写入卡片类型
    if (options.cardType) {
      yamlMetadata.we_type = options.cardType;
    }
    
    // 写入标签
    if (options.tags && options.tags.length > 0) {
      yamlMetadata.tags = options.tags;
    }
    
    // 如果没有任何元数据，直接返回原内容
    if (Object.keys(yamlMetadata).length === 0) {
      return bodyContent;
    }
    
    return createContentWithMetadata(yamlMetadata, bodyContent);
  }

  /**
   * 组装卡片内容
   * 
   * 🆕 修复：只在正面和背面都有内容时添加分隔符，避免分隔符位置错误
   */
  private assembleContent(
    frontFields: string[],
    backFields: string[],
    bothFields: string[]
  ): string {
    const parts: string[] = [];
    
    // 收集正面内容
    const frontParts: string[] = [];
    if (frontFields.length > 0) {
      frontParts.push(frontFields.join('\n\n'));
    }
    // both字段显示在正面
    if (bothFields.length > 0) {
      frontParts.push(bothFields.join('\n\n'));
    }
    
    // 收集背面内容
    const backParts: string[] = [];
    if (backFields.length > 0) {
      backParts.push(backFields.join('\n\n'));
    }
    // both字段也显示在背面（如果正面没有内容）
    if (bothFields.length > 0 && frontFields.length === 0) {
      backParts.push(bothFields.join('\n\n'));
    }
    
    // 🆕 智能组装：只在两边都有内容时添加分隔符
    if (frontParts.length > 0 && backParts.length > 0) {
      // 正常情况：正面 + 分隔符 + 背面
      parts.push(frontParts.join('\n\n'));
      parts.push('---div---');
      parts.push(backParts.join('\n\n'));
    } else if (frontParts.length > 0) {
      // 只有正面内容
      parts.push(frontParts.join('\n\n'));
    } else if (backParts.length > 0) {
      // 只有背面内容（不添加分隔符）
      parts.push(backParts.join('\n\n'));
    }
    // 如果两者都为空，返回空字符串
    
    return parts.join('\n\n').trim();
  }

  /**
   * 创建Card对象
   * 
   * 🆕 Content-Only 架构：不再写入独立的 type 和 tags 字段
   * 这些数据已经写入 content 的 YAML frontmatter
   */
  private createCard(
    content: string,
    deckId: string,
    templateId: string | undefined,
    _note: AnkiNote,
    model: AnkiModel,
    fields: Record<string, string>
  ): Card {
    const now = Date.now();
    
    //  向后兼容：Card 接口仍要求 type 字段
    // 数据已写入 content YAML，此处设置是为了满足接口要求
    const cardType = model.type === 1 ? CardType.Cloze : CardType.Basic;
    
    // 提取字段映射（只包含 front/back 标准字段）
    const fieldMap = this.extractFieldsMap(content, fields);
    
    // 🆕 Content-Only 架构：type 已写入 content YAML
    // 此处设置 type 仅为向后兼容，未来版本将移除
    return {
      uuid: generateUUID(),
      deckId,
      templateId: templateId || 'unknown',
      content,
      type: cardType,  //  向后兼容：接口必需字段，实际数据在 content YAML
      //  tags 不再写入独立字段，已迁移到 content YAML
      created: now.toString(),
      modified: now.toString(),
      // FSRS数据（初始化）
      fsrs: {
        state: 0,  // New
        difficulty: 0,
        stability: 0,
        due: now.toString(),
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReview: undefined,  //  使用 undefined 而不是 null
        retrievability: 0
      },
      reviewHistory: [],
      stats: {
        totalReviews: 0,
        totalTime: 0,
        averageTime: 0,
        memoryRate: 0
      },
      //  Content-Only 架构：不保留 Anki 原始数据
      // APKG 导入是一次性数据迁移，导入后完全归 Weave 管理
      customFields: {
        importedFrom: 'apkg',
        importedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 从内容中提取字段映射（已废弃）
   * 
   *  Content-Only 架构下此方法不再使用
   * content 是唯一数据源，不再需要提取字段映射
   */
  private extractFieldsMap(
    content: string,
    _fields: Record<string, string>
  ): Record<string, string> {
    //  Content-Only 架构：此方法已废弃，保留仅为避免编译错误
    const fieldMap: Record<string, string> = {};
    
    // 🆕 增强的分隔符检测
    const dividerIndex = content.indexOf('---div---');
    
    if (dividerIndex === -1) {
      // 没有分隔符，全部内容视为正面（或只有正面）
      const cleanContent = this.stripFieldNamePrefix(content.trim());
      if (cleanContent) {
        fieldMap.front = cleanContent;
      }
    } else if (dividerIndex === 0) {
      // 🆕 分隔符在开头（异常情况），后面的内容应该是正面
      const afterDivider = content.substring('---div---'.length).trim();
      const cleanContent = this.stripFieldNamePrefix(afterDivider);
      if (cleanContent) {
        fieldMap.front = cleanContent;
      }
    } else {
      // 正常情况：正面 ---div--- 背面
      const beforeDivider = content.substring(0, dividerIndex).trim();
      const afterDivider = content.substring(dividerIndex + '---div---'.length).trim();
      
      const frontContent = this.stripFieldNamePrefix(beforeDivider);
      if (frontContent) {
        fieldMap.front = frontContent;
      }
      
      const backContent = this.stripFieldNamePrefix(afterDivider);
      if (backContent) {
        fieldMap.back = backContent;
      }
    }
    
    // 字段映射提取完成（已优化：移除详细日志）
    
    return fieldMap;
  }

  /**
   * 去除字段名前缀
   * 
   * 🆕 增强版：支持多种字段前缀格式
   * - **字段名**: 内容
   * - **字段名**:内容（无空格）
   * - **字段名: 内容（单星号）
   * 
   * @param text - 包含字段名前缀的文本
   * @returns 去除前缀后的纯净内容
   */
  private stripFieldNamePrefix(text: string): string {
    if (!text || !text.trim()) {
      return '';
    }

    // 🆕 支持多种字段前缀格式
    const fieldPrefixPatterns = [
      /^\*\*([^*]+)\*\*:\s*/,      // **字段名**: 内容
      /^\*\*([^*]+)\*\*:/,          // **字段名**:内容（无空格）
      /^\*([^*]+)\*:\s*/,           // *字段名*: 内容（单星号）
      /^([^:]+):\s+/                // 字段名: 内容（兜底，纯文本）
    ];
    
    // 按段落分割（双换行符）
    const paragraphs = text.split(/\n\n+/);
    
    // 处理每个段落，去除字段名前缀
    const cleanedParagraphs = paragraphs.map(_paragraph => {
      let trimmed = _paragraph.trim();
      if (!trimmed) return '';
      
      // 尝试匹配并移除前缀
      for (const pattern of fieldPrefixPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          trimmed = trimmed.replace(pattern, '');
          break;
        }
      }
      
      return trimmed;
    }).filter(p => p.length > 0);
    
    const result = cleanedParagraphs.join('\n\n');
    
    // 字段前缀清理完成（已优化：移除详细日志）
    
    return result;
  }
}



