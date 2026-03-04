/**
 * Anki模板转换器
 * 
 * 将Anki Model转换为Weave ParseTemplate
 * 用于APKG导入时创建模板并保存到插件模板管理系统
 * 
 * @module application/services/apkg
 */

import type { AnkiModel } from '../../../domain/apkg/types';
import type { ParseTemplate, TemplateField } from '../../../types/newCardParsingTypes';
import { APKGLogger } from '../../../infrastructure/logger/APKGLogger';

/**
 * Anki模板转换器
 */
export class AnkiTemplateConverter {
  private logger: APKGLogger;

  constructor() {
    this.logger = new APKGLogger({ prefix: '[AnkiTemplateConverter]' });
  }

  /**
   * 从Anki Model创建ParseTemplate
   * 
   * @param model - Anki模型
   * @param fieldSideMap - 字段显示面映射
   * @returns ParseTemplate
   */
  convertModelToTemplate(
    model: AnkiModel,
    fieldSideMap: Record<string, 'front' | 'back' | 'both'>
  ): ParseTemplate {
    this.logger.info(`转换Anki模型: ${model.name} (ID: ${model.id})`);

    // 转换字段定义
    const templateFields: TemplateField[] = model.flds.map(field => ({
      name: field.name,
      pattern: '',  // APKG导入不需要正则解析，字段值已经确定
      isRegex: false,
      required: false,
      type: 'field' as const,
      side: fieldSideMap[field.name] || 'both',  //  保存字段显示面
      key: field.name.toLowerCase().replace(/\s+/g, '_'),  // 字段键名
      description: field.description || `${field.name} 字段`
    }));

    this.logger.debug(`转换了 ${templateFields.length} 个字段:`, 
      templateFields.map(f => `${f.name}(${f.side})`).join(', '));

    // 创建ParseTemplate（带Anki扩展元数据）
    const template = {
      id: `anki-import-${model.id}-${Date.now()}`,
      name: `【Anki】${model.name}`,
      description: `从APKG导入的Anki模板\n原始Model ID: ${model.id}\n字段数量: ${model.flds.length}`,
      type: 'single-field' as const,
      fields: templateFields,
      scenarios: ['study', 'edit'] as const,
      isOfficial: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      //  关键元数据：标识为Anki导入
      weaveMetadata: {
        signature: `anki-model-${model.id}`,
        version: '1.0.0',
        ankiCompatible: true,
        source: 'anki_imported' as const,
        createdInWeave: false,
        editedInWeave: false
      },

      //  Anki特定元数据（扩展字段）
      ankiImportMetadata: {
        originalAnkiModelId: model.id.toString(),
        originalAnkiModelName: model.name,
        ankiModelType: model.type === 1 ? 'cloze' as const : 'standard' as const,
        ankiTemplates: model.tmpls,
        ankiCSS: model.css,
        ankiFieldCount: model.flds.length,
        importedAt: new Date().toISOString(),
        source: 'APKG Import'
      }
    } as ParseTemplate & {
      ankiImportMetadata: {
        originalAnkiModelId: string;
        originalAnkiModelName: string;
        ankiModelType: 'cloze' | 'standard';
        ankiTemplates: any[];
        ankiCSS: string;
        ankiFieldCount: number;
        importedAt: string;
        source: string;
      }
    };

    this.logger.info(`成功创建模板: ${template.name}`);
    return template;
  }

  /**
   * 检查模板是否已存在（去重）
   * 
   * @param modelId - Anki Model ID
   * @param existingTemplates - 已存在的模板列表
   * @returns 已存在的模板，或null
   */
  findExistingTemplate(
    modelId: number,
    existingTemplates: ParseTemplate[]
  ): ParseTemplate | null {
    const existing = existingTemplates.find(template => 
      (template as any).ankiImportMetadata?.originalAnkiModelId === modelId.toString()
    );

    if (existing) {
      this.logger.info(`找到已存在的模板: ${existing.name} (Model ID: ${modelId})`);
    }

    return existing || null;
  }

  /**
   * 批量转换多个Anki模型
   * 
   * @param models - Anki模型列表
   * @param fieldSideMapAll - 所有模型的字段显示面映射
   * @param existingTemplates - 已存在的模板列表
   * @returns 新创建的模板列表
   */
  convertModels(
    models: AnkiModel[],
    fieldSideMapAll: Record<number, Record<string, 'front' | 'back' | 'both'>>,
    existingTemplates: ParseTemplate[] = []
  ): ParseTemplate[] {
    this.logger.info(`开始批量转换 ${models.length} 个Anki模型`);

    const newTemplates: ParseTemplate[] = [];

    for (const model of models) {
      // 检查是否已存在
      const existing = this.findExistingTemplate(model.id, existingTemplates);
      if (existing) {
        this.logger.debug(`跳过已存在的模板: ${model.name}`);
        continue;
      }

      // 转换新模板
      const fieldSideMap = fieldSideMapAll[model.id] || {};
      const newTemplate = this.convertModelToTemplate(model, fieldSideMap);
      newTemplates.push(newTemplate);
    }

    this.logger.info(`批量转换完成: 新创建 ${newTemplates.length} 个模板`);
    return newTemplates;
  }

  /**
   * 验证模板完整性
   * 
   * @param template - 模板
   * @returns 是否有效
   */
  validateTemplate(template: ParseTemplate): boolean {
    if (!template.id || !template.name) {
      this.logger.error('模板缺少必需字段: id 或 name');
      return false;
    }

    if (!template.fields || template.fields.length === 0) {
      this.logger.error(`模板 "${template.name}" 没有字段定义`);
      return false;
    }

    if (!template.weaveMetadata?.source) {
      this.logger.error(`模板 "${template.name}" 缺少来源标识`);
      return false;
    }

    return true;
  }
}













