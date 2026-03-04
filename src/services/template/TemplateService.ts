/**
 * 模板服务
 * 管理卡片模板的创建、更新、删除和查询
 */

import type { WeaveDataStorage } from '../../data/storage';

// TODO: 评估整个 TemplateService 是否已弃用
// 如果需要保留，需要迁移到新模板系统 (newCardParsingTypes)
type FieldTemplate = any;

/**
 * 模板服务类
 * 提供模板管理的统一接口
 */
export class TemplateService {
  constructor(private dataStorage: WeaveDataStorage & Record<string, any>) {}

  /**
   * 创建新模板
   * @param templateData 模板数据
   * @returns 创建的模板
   */
  async createTemplate(templateData: FieldTemplate): Promise<FieldTemplate> {
    return this.dataStorage.createTemplate(templateData);
  }

  /**
   * 更新模板
   * @param templateId 模板ID
   * @param updates 更新数据
   * @returns 更新后的模板
   */
  async updateTemplate(templateId: string, updates: Partial<FieldTemplate>): Promise<FieldTemplate> {
    return this.dataStorage.updateTemplate(templateId, updates);
  }

  /**
   * 删除模板
   * @param templateId 模板ID
   */
  async deleteTemplate(templateId: string): Promise<void> {
    return this.dataStorage.deleteTemplate(templateId);
  }

  /**
   * 获取单个模板
   * @param templateId 模板ID
   * @returns 模板数据，如果不存在则返回null
   */
  async getTemplate(templateId: string): Promise<FieldTemplate | null> {
    return this.dataStorage.getTemplate(templateId);
  }

  /**
   * 获取所有模板
   * @returns 模板列表
   */
  async getTemplates(): Promise<FieldTemplate[]> {
    return this.dataStorage.getTemplates();
  }
}



