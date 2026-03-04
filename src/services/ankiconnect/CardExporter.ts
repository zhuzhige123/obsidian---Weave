import { logger } from '../../utils/logger';
/**
 * 卡片导出器
 * 负责将 Weave 卡片导出到 Anki
 */

import type { AnkiNoteInfo, AnkiModelInfo, ExportResult, ExportError } from '../../types/ankiconnect-types';
import type { ParseTemplate } from '../../types/newCardParsingTypes';
import type { Card } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { AnkiConnectClient } from './AnkiConnectClient';
import { WeaveTemplateExporter } from './WeaveTemplateExporter';
import { ObsidianToAnkiConverter } from './ObsidianToAnkiConverter';
import type { ObsidianToAnkiOptions } from '../../types/ankiconnect-types';
import { OFFICIAL_TEMPLATES } from '../../constants/official-templates';
import { parseSourceInfo } from '../../utils/yaml-utils';

/**
 * 字段别名映射表
 * 用于智能匹配卡片字段名与模板字段名
 */
const FIELD_ALIASES: Record<string, string[]> = {
  front: ['question', 'Front', 'Q', '问题', '题目', 'Question'],
  back: ['answer', 'Back', 'A', '答案', '解答', 'Answer'],
  // 兼容旧模型的字段名
  question: ['front', 'Front', 'question', 'Question', 'Q', '问题', '题目'],
  answer: ['back', 'Back', 'answer', 'Answer', 'A', '答案', '解答'],
  options: ['choices', 'Choices', 'Options', '选项'],
  correctAnswers: ['correctanswers', 'CorrectAnswers', '正确答案'],
  text: ['content', 'Content', 'Text', '内容'],
  cloze: ['Cloze', '挖空'],
  hint: ['Hint', 'Extra', '提示', '额外']
};

export class CardExporter {
  private plugin: WeavePlugin;
  private ankiConnect: AnkiConnectClient;
  private templateExporter: WeaveTemplateExporter;
  private converter: ObsidianToAnkiConverter;

  constructor(
    plugin: WeavePlugin,
    ankiConnect: AnkiConnectClient,
    templateExporter: WeaveTemplateExporter
  ) {
    this.plugin = plugin;
    this.ankiConnect = ankiConnect;
    this.templateExporter = templateExporter;
    this.converter = new ObsidianToAnkiConverter(plugin.app, ankiConnect);
  }

  /**
   * 导出整个牌组
   */
  async exportDeck(
    weaveDeckId: string,
    ankiDeckName: string,
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<ExportResult> {
    logger.debug('📤 开始导出牌组:', weaveDeckId, '→', ankiDeckName);

    const errors: ExportError[] = [];
    let exportedCards = 0;
    let skippedCards = 0;
    let createdModels = 0;

    try {
      // 1. 获取 Weave 牌组的所有卡片
      onProgress?.(0, 100, '正在读取 Weave 牌组...');
      const cards = await this.getWeaveDeckCards(weaveDeckId);

      logger.debug('📊 找到', cards.length, '张卡片');

      if (cards.length === 0) {
        logger.debug('✅ 牌组为空，无需导出');
        return {
          success: true,
          exportedCards: 0,
          createdModels: 0,
          skippedCards: 0,
          errors: []
        };
      }

      onProgress?.(10, 100, `找到 ${cards.length} 张卡片`);

      // 2. 按模板分组
      const cardsByTemplate = this.groupCardsByTemplate(cards);
      const templates = Array.from(cardsByTemplate.keys());

      logger.debug('📋 卡片分属', templates.length, '个模板');

      onProgress?.(20, 100, '正在准备 Anki 模板...');

      // 3. 确保所有模板在 Anki 中存在
      const templateModelMap = new Map<string, AnkiModelInfo>();
      
      for (let i = 0; i < templates.length; i++) {
        const templateId = templates[i];
        logger.debug('🔧 准备模板', i + 1, '/', templates.length, ':', templateId);

        const template = this.getTemplateById(templateId);
        
        if (!template) {
          errors.push({
            type: 'model_creation',
            message: `找不到模板 ID: ${templateId}`,
            templateId
          });
          continue;
        }

        try {
          // 🆕 优先使用原生模板（基于卡片类型）
          const cardType = template.type || 'basic-qa';
          const modelInfo = await this.templateExporter.ensureNativeModelByCardType(cardType);
          templateModelMap.set(templateId, modelInfo);
          
          logger.debug('✓ 原生模板就绪:', modelInfo.name, '(卡片类型:', cardType, ')');

          // 如果是新创建的模型
          if (modelInfo) {
            createdModels++;
          }

          onProgress?.(
            20 + (i + 1) / templates.length * 20,
            100,
            `已准备模板 ${i + 1}/${templates.length}`
          );
        } catch (error: any) {
          errors.push({
            type: 'model_creation',
            message: `创建/获取模板失败: ${error.message}`,
            templateId
          });
        }
      }

      onProgress?.(40, 100, '正在导出卡片...');

      // 4. 转换并上传卡片
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];

        // 每10张卡片输出一次进度
        if (i % 10 === 0 || i === cards.length - 1) {
          logger.debug('📤 上传进度:', i + 1, '/', cards.length);
        }

        try {
          //  获取导出时的 templateId（可能动态生成）
          const exportTemplateId = this.getTemplateIdForExport(card);
          
          const template = this.getTemplateById(exportTemplateId);
          if (!template) {
            skippedCards++;
            errors.push({
              type: 'template_not_found',
              message: `未找到模板: ${exportTemplateId}`,
              cardId: card.uuid
            });
            continue;
          }

          const modelInfo = templateModelMap.get(exportTemplateId);
          if (!modelInfo) {
            skippedCards++;
            errors.push({
              type: 'note_creation',
              message: `卡片 ${card.uuid} 的 Anki 模型不可用`,
              cardId: card.uuid
            });
            continue;
          }

          await this.convertAndUploadCard(card, template, modelInfo, ankiDeckName);
          exportedCards++;

          if ((i + 1) % 10 === 0 || i === cards.length - 1) {
            onProgress?.(
              40 + (i + 1) / cards.length * 60,
              100,
              `已导出 ${exportedCards}/${cards.length} 张卡片`
            );
          }
        } catch (error: any) {
          skippedCards++;
          errors.push({
            type: 'upload',
            message: `上传卡片失败: ${error.message}`,
            cardId: card.uuid
          });
        }
      }

      onProgress?.(100, 100, '导出完成！');

      logger.debug('✅ 导出完成 ━', '成功:', exportedCards, '跳过:', skippedCards, '错误:', errors.length);

      return {
        success: true,
        exportedCards,
        createdModels,
        skippedCards,
        errors
      };
    } catch (error: any) {
      logger.error('导出牌组失败:', error);
      return {
        success: false,
        exportedCards,
        createdModels,
        skippedCards,
        errors: [
          ...errors,
          {
            type: 'upload',
            message: `导出失败: ${error.message}`
          }
        ]
      };
    }
  }

  /**
   * 转换并上传单张卡片
   */
  private async convertAndUploadCard(
    card: Card,
    template: ParseTemplate,
    modelInfo: AnkiModelInfo,
    deckName: string
  ): Promise<void> {
    // 转换为 Anki Note
    const ankiNote = await this.convertCardToAnkiNote(card, template, modelInfo);

    // 上传到 Anki
    await this.uploadNoteToAnki(ankiNote, deckName);
  }

  /**
   * 转换 Weave Card 为 Anki Note
   */
  async convertCardToAnkiNote(
    card: Card,
    template: ParseTemplate,
    modelInfo: AnkiModelInfo
  ): Promise<Partial<AnkiNoteInfo>> {
    logger.debug('🔍 转换卡片', card.uuid, '使用模板', template.name);

    // 🆕 准备转换选项
    const conversionOptions: ObsidianToAnkiOptions = {
      vaultName: this.plugin.app.vault.getName(),
      uploadMedia: true,
      generateBacklinks: true,
      backlinkPosition: 'append',  // 追加到字段末尾
      mediaPosition: 'inline',
      formatConversion: {
        enabled: true,
        mathConversion: {
          enabled: true,
          targetFormat: 'latex-parens',  // 转换为 \(...\) 格式
          detectCurrencySymbol: true
        },
        wikiLinkConversion: {
          enabled: true,
          mode: 'obsidian-link'  // 转换为 Obsidian 协议链接
        },
        calloutConversion: {
          enabled: true,
          injectStyles: false  // 使用内联样式，无需注入
        },
        highlightConversion: {
          enabled: true
        }
      }
    };

    const fields: Record<string, string> = {};

    // 🆕 获取 Anki 模型的实际字段列表（用于验证）
    const ankiFieldNames = modelInfo.fields.map(f => f.toLowerCase());
    logger.debug('  📋 Anki 模型字段:', ankiFieldNames.join(', '));

    // 填充字段
    const templateFields = template.fields || [];
    
    for (const templateField of templateFields) {
      //  使用模板字段名（小写）
      const templateFieldName = templateField.name.toLowerCase();
      
      // 🆕 查找 Anki 模型中对应的字段名
      let ankiFieldName = templateFieldName;
      
      // 如果模板字段名不在 Anki 模型中，尝试使用别名查找
      if (!ankiFieldNames.includes(templateFieldName)) {
        const aliases = FIELD_ALIASES[templateFieldName] || [];
        for (const alias of aliases) {
          if (ankiFieldNames.includes(alias.toLowerCase())) {
            ankiFieldName = alias.toLowerCase();
            logger.debug(`  🔄 字段映射: "${templateFieldName}" → "${ankiFieldName}"`);
            break;
          }
        }
      }
      
      let fieldValue = '';
      let matchedKey = '';

      // 生成可能的字段名列表（用于从 parsedFields 中匹配）
      const possibleKeys: string[] = [];
      
      // 1. 添加基本字段名（各种大小写变体）
      if (templateField.name) {
        possibleKeys.push(templateField.name);
        possibleKeys.push(templateField.name.toLowerCase());
        const capitalized = templateField.name.charAt(0).toUpperCase() + templateField.name.slice(1);
        possibleKeys.push(capitalized);
      }
      
      // 2. 添加别名（使用小写键查找）
      const aliasKey = templateField.name.toLowerCase();
      if (FIELD_ALIASES[aliasKey]) {
        possibleKeys.push(...FIELD_ALIASES[aliasKey]);
      }
      
      // 去重
      const uniqueKeys = [...new Set(possibleKeys)];

      //  Content-Only 架构：从 content 实时解析字段
      const { getCardFields } = await import('../../utils/card-field-helper');
      const parsedFields = getCardFields(card);
      
      for (const key of uniqueKeys) {
        if (parsedFields[key] && parsedFields[key].trim() !== '') {
          fieldValue = parsedFields[key];
          matchedKey = key;
          logger.debug(`  ✓ 字段匹配: "${ankiFieldName}" ← "${matchedKey}" = "${fieldValue.slice(0, 30)}${fieldValue.length > 30 ? '...' : ''}"`);
          break;
        }
      }

      // 🆕 特殊处理：tags 字段从 card.tags 获取
      if (!fieldValue && ankiFieldName === 'tags' && card.tags && card.tags.length > 0) {
        fieldValue = card.tags.join(' ');
        logger.debug(`  ✓ 字段匹配: "tags" ← card.tags = "${fieldValue}"`);
      }
      
      // 如果未找到匹配，输出调试信息（区分"字段为空"和"字段不存在"）
      if (!fieldValue) {
        // 检查字段是否存在但为空
        let fieldExistsButEmpty = false;
        for (const key of uniqueKeys) {
          if (key in parsedFields) {
            fieldExistsButEmpty = true;
            logger.warn(`  ⚠️ 字段为空: "${ankiFieldName}" (存在于 parsedFields 但值为空)`);
            break;
          }
        }
        
        if (!fieldExistsButEmpty && ankiFieldName !== 'weave_template_id' && ankiFieldName !== 'weave_card_id' && ankiFieldName !== 'source') {
          logger.warn(`  ⚠️ 字段未匹配: "${ankiFieldName}"`);
          logger.warn(`     尝试了: ${uniqueKeys.join(', ')}`);
          logger.warn(`     可用字段: ${Object.keys(parsedFields).join(', ')}`);
        }
      }

      // 🆕 转换内容（媒体文件 + 回链）
      if (fieldValue?.trim()) {
        try {
          //  特殊处理：options字段转换为HTML
          if (templateField.name === 'options') {
            fieldValue = this.formatOptionsToHTML(fieldValue);
          } else {
            //  关闭字段内回链（使用独立的 source 字段代替）
            const fieldConversionOptions = {
              ...conversionOptions,
              generateBacklinks: false  // 不在字段内生成回链，使用 source 字段
            };
            
            const conversionResult = await this.converter.convertContent(
              fieldValue,
              card,
              fieldConversionOptions
            );
            
            fieldValue = conversionResult.convertedContent;
            
            // 输出转换信息
            if (conversionResult.mediaFiles.length > 0 || conversionResult.backlinks.length > 0) {
              logger.debug(`  🔄 转换字段 "${ankiFieldName}":`, {
                媒体文件: conversionResult.mediaFiles.length,
                回链: conversionResult.backlinks.length,
                警告: conversionResult.warnings.length
              });
            }
          }
        } catch (error) {
          logger.error(`  ❌ 转换字段失败 "${ankiFieldName}":`, error);
          // 转换失败时保留原始内容
        }
      }

      // 🆕 使用 Anki 模型的实际字段名填充
      fields[ankiFieldName] = fieldValue;
    }

    // 填充追踪字段
    if (ankiFieldNames.includes('weave_template_id')) {
      fields.weave_template_id = template.id;
    }
    if (ankiFieldNames.includes('weave_card_id')) {
      fields.weave_card_id = card.uuid; // 使用UUID值
    }
    
    // 🆕 填充来源文档字段（Obsidian URI 回链）
    if (ankiFieldNames.includes('source')) {
      //  v2.2: 从 content YAML 解析源信息，带回退机制
      const sourceInfo = parseSourceInfo(card.content);
      const sourceFile = sourceInfo.sourceFile || card.sourceFile || (card.customFields?.sourceFile as string);
      const sourceBlock = sourceInfo.sourceBlock || card.sourceBlock;
      
      if (sourceFile) {
        const vaultName = this.plugin.app.vault.getName();
        const encodedVault = encodeURIComponent(vaultName);
        
        //  使用 Obsidian 官方 URI 格式
        let url: string;
        let linkText = '查看源文档';
        
        if (sourceBlock) {
          // 块定位：file 参数包含锚点
          const cleanBlockId = sourceBlock.replace(/^\^/, ''); // 移除 ^ 前缀
          const fileWithAnchor = `${sourceFile}#^${cleanBlockId}`;
          url = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(fileWithAnchor)}`;
          linkText = '定位到源块';
        } else {
          // 仅文件定位
          url = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(sourceFile)}`;
        }
        
        // 生成美观的 HTML 链接
        fields.source = `<div style="margin-top: 8px; padding: 8px 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <a href="${url}" style="color: white; text-decoration: none; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;">
    <span style="font-size: 16px;">${sourceBlock ? '🔗' : '📄'}</span>
    <span>${linkText}</span>
    <span style="opacity: 0.8; font-size: 11px; margin-left: auto;">Obsidian</span>
  </a>
</div>`;
        
        logger.debug(`  🔗 生成源文档链接: ${sourceFile}${sourceBlock ? '#^' + sourceBlock : ''}`);
      } else {
        logger.warn(`  ⚠️ 卡片 ${card.uuid} 缺少 sourceFile 信息，无法生成回链`);
      }
    }

    return {
      modelName: modelInfo.name,
      fields: fields,
      tags: card.tags || []
    };
  }

  /**
   * 上传 Note 到 Anki
   */
  async uploadNoteToAnki(
    note: Partial<AnkiNoteInfo>,
    deckName: string
  ): Promise<number> {
    try {
      const ankiNote = {
        deckName: deckName,
        modelName: note.modelName || '',
        fields: note.fields || {},
        tags: note.tags || [],
        options: {
          allowDuplicate: false,
          duplicateScope: 'deck'
        }
      };
      
      const noteId = await this.ankiConnect.addNote(ankiNote);

      return noteId;
    } catch (error: any) {
      // 检查是否是重复卡片错误
      if (error.message?.includes('duplicate')) {
        logger.warn('⚠️ 卡片已存在于 Anki，跳过重复卡片:', {
          modelName: note.modelName,
          fields: note.fields,
          tags: note.tags
        });
        return -1; // 返回特殊值表示跳过
      }
      
      // 其他错误需要详细记录
      logger.error('❌ 上传卡片到 Anki 失败:', {
        error: error.message,
        modelName: note.modelName,
        fields: note.fields
      });
      throw error;
    }
  }

  /**
   * 获取 Weave 牌组的所有卡片
   */
  private async getWeaveDeckCards(deckId: string): Promise<Card[]> {
    const dataStorage = this.plugin.dataStorage;
    if (!dataStorage) {
      throw new Error('DataStorage 未初始化');
    }

    return await dataStorage.getCardsByDeck(deckId);
  }

  /**
   * 按模板分组卡片
   */
  private groupCardsByTemplate(cards: Card[]): Map<string, Card[]> {
    const groups = new Map<string, Card[]>();

    for (const card of cards) {
      //  修复：使用 getTemplateIdForExport 获取有效的 templateId
      // 不再使用 'default' 作为降级值，因为 'default' 模板不存在
      const templateId = this.getTemplateIdForExport(card);
      if (!groups.has(templateId)) {
        groups.set(templateId, []);
      }
      groups.get(templateId)!.push(card);
    }

    return groups;
  }

  /**
   * 将options字段格式化为HTML（用于Anki显示）
   */
  private formatOptionsToHTML(optionsText: string): string {
    const lines = optionsText.split('\n').filter(line => line.trim());
    const htmlLines = lines.map(_line => {
      const hasCorrectMark = _line.includes('{✓}') || _line.includes('{√}');
      const cleanLine = _line.replace(/\{[✓√]\}/g, '').trim();
      
      if (hasCorrectMark) {
        // 正确答案：清新田园风格
        return `<div class="option-item option-correct"><span class="check-mark">✓</span>${cleanLine}</div>`;
      } else {
        // 普通选项：柔和米白色
        return `<div class="option-item">${cleanLine}</div>`;
      }
    });
    
    return htmlLines.join('\n');
  }

  /**
   * 获取导出时使用的 templateId
   * 如果卡片有 templateId，使用原有的
   * 否则根据 type 动态生成
   */
  private getTemplateIdForExport(card: Card): string {
    // 如果有 templateId，使用原有的
    if (card.templateId) {
      return card.templateId;
    }
    
    //  根据 type 动态生成
    const cardType = card.type?.toLowerCase() || 'basic-qa';
    
    // 🆕 类型映射表
    const typeMapping: Record<string, string> = {
      'basic': 'official-qa',
      'basic-qa': 'official-qa',
      'basic-reverse': 'official-qa',
      'qa': 'official-qa',
      'single-choice': 'official-choice',
      'multiple-choice': 'official-choice',
      'choice': 'official-choice',
      'cloze': 'official-cloze',
      'cloze-deletion': 'official-cloze'
    };
    
    const templateId = typeMapping[cardType];
    if (templateId) {
      return templateId;
    }
    
    logger.warn(`⚠️ 未知卡片类型: ${card.type}，降级使用 official-qa`);
    return 'official-qa';
  }

  /**
   * 根据 ID 获取模板
   * 先在官方模板中查找，再在用户模板中查找
   * 如果找不到，使用降级机制返回默认问答题模板
   */
  private getTemplateById(templateId: string): ParseTemplate | null {
    logger.debug('🔍 查找模板:', templateId);

    // 参数验证：如果模板ID为空，使用默认问答题模板
    if (!templateId || templateId.trim() === '') {
      logger.warn('⚠️ 模板ID为空，降级使用官方问答题模板');
      const defaultTemplate = OFFICIAL_TEMPLATES.find(t => t.id === 'official-qa');
      return defaultTemplate ? { ...defaultTemplate } : null;
    }

    // 1. 先在官方模板中查找
    const officialTemplate = OFFICIAL_TEMPLATES.find(t => t.id === templateId);
    if (officialTemplate) {
      logger.debug('✓ 找到官方模板:', officialTemplate.name, `(${officialTemplate.id})`);
      // 返回深拷贝，避免修改原始定义
      return { ...officialTemplate };
    }

    // 2. 再在用户模板中查找（外部导入的模板）
    const settings = this.plugin.settings.simplifiedParsing;
    if (settings) {
      const userTemplate = settings.templates.find(t => t.id === templateId);
      if (userTemplate) {
        logger.debug('✓ 找到用户模板:', userTemplate.name, `(${userTemplate.id})`);
        return userTemplate;
      }
    }

    // 3. 降级机制：找不到时使用官方问答题模板
    const availableOfficial = OFFICIAL_TEMPLATES.map(t => t.id);
    const availableUser = settings?.templates.map(t => t.id) || [];
    
    logger.warn('⚠️ 模板不存在:', templateId);
    logger.warn('   可用的官方模板:', availableOfficial.join(', '));
    if (availableUser.length > 0) {
      logger.warn('   可用的用户模板:', availableUser.join(', '));
    }
    logger.warn('   降级使用官方问答题模板 (official-qa)');

    // 返回默认问答题模板
    const defaultTemplate = OFFICIAL_TEMPLATES.find(t => t.id === 'official-qa');
    return defaultTemplate ? { ...defaultTemplate } : null;
  }
}


