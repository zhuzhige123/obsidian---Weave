import type { WeavePlugin } from '../main';
import { TemplateService } from './template/TemplateService';
import { logger } from '../utils/logger';

// TODO: 迁移到新模板系统 (newCardParsingTypes)
type FieldTemplate = any;
// MarkdownHeaderTemplateSystem stub - not yet implemented
const MarkdownHeaderTemplateSystem = {
  parseContentToFields(_content: string): { success: boolean; fields?: Record<string, string>; templateId?: string; warnings?: string[]; error?: string } {
    return { success: false, error: 'MarkdownHeaderTemplateSystem not implemented' };
  },
  generateContentFromFields(_fields: Record<string, string>, _template: unknown): { success: boolean; content?: string; warnings?: string[]; error?: string } {
    return { success: false, error: 'MarkdownHeaderTemplateSystem not implemented' };
  }
};

/**
 * MD内容解析结果
 */
export interface MDParseResult {
  success: boolean;
  fields?: Record<string, string>;
  template?: FieldTemplate;
  error?: string;
  warnings?: string[];
}

/**
 * MD内容生成结果
 */
export interface MDGenerateResult {
  success: boolean;
  content?: string;
  template?: FieldTemplate;
  error?: string;
}

/**
 * MD内容解析服务（独立于已删除的ContentParserService）
 * 实现MD内容与结构化字段之间的双向转换
 */
export class MDContentParserService {
  private plugin: WeavePlugin;
  private templateService: TemplateService;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
    this.templateService = new TemplateService(plugin.dataStorage);
  }

  /**
   * 简化的分隔策略：优先使用自定义分隔符，否则默认全部正面
   */
  private determineSeparationStrategy(
    content: string,
    fields: Record<string, string>
  ): {
    strategy: 'separator' | 'all_front';
    separatorPattern?: string;
    frontFields: string[];
    backFields: string[];
    separatorInfo?: string;
  } {
    // 检查是否存在自定义分隔符
    const separatorResult = this.detectCustomSeparator(content);
    if (separatorResult.found) {
      const { frontContent, backContent } = this.splitContentBySeparator(content, separatorResult.pattern!);
      return {
        strategy: 'separator',
        separatorPattern: separatorResult.pattern,
        frontFields: Object.keys(fields).filter(key =>
          frontContent.includes(fields[key]) && fields[key].trim()
        ),
        backFields: Object.keys(fields).filter(key =>
          backContent.includes(fields[key]) && fields[key].trim()
        ),
        separatorInfo: `使用分隔符: ${separatorResult.pattern}`
      };
    }

    // 默认全部正面
    return {
      strategy: 'all_front',
      frontFields: Object.keys(fields).filter(key => fields[key]?.trim()),
      backFields: [],
      separatorInfo: '默认全部显示在正面'
    };
  }

  /**
   * 检测自定义分隔符 - 简化版本，使用常见的分隔符
   */
  private detectCustomSeparator(content: string): { found: boolean; pattern?: string } {
    // 使用常见的分隔符模式
    const commonSeparators = ['---div---', '---', '%%<->%%', '<->'];
    
    for (const separator of commonSeparators) {
      if (content.includes(separator)) {
        return { found: true, pattern: separator };
      }
    }

    return { found: false };
  }

  /**
   * 按分隔符分割内容
   */
  private splitContentBySeparator(content: string, separator: string): {
    frontContent: string;
    backContent: string;
  } {
    const parts = content.split(separator);
    return {
      frontContent: parts[0] || '',
      backContent: parts.slice(1).join(separator) || ''
    };
  }

  /**
   * 判断是否为答案类内容
   */
  private isAnswerLikeContent(content: string, fieldKey: string): boolean {
    const key = fieldKey.toLowerCase();
    const text = content.toLowerCase();

    // 基于字段名判断
    if (key.includes('answer') || key.includes('back') || key.includes('解析') ||
        key.includes('explanation') || key.includes('solution')) {
      return true;
    }

    // 基于内容判断
    const answerKeywords = ['答案', '解答', '因为', '所以', '原因', '解析'];
    return answerKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 解析MD内容到结构化字段（优先使用新的标题格式）
   * @param content MD内容
   * @param templateId 指定的模板ID（可选）
   * @returns 解析结果
   */
  async parseToFields(content: string, templateId?: string): Promise<MDParseResult> {
    try {
      // 使用新的Markdown标题格式解析
      const headerParseResult = MarkdownHeaderTemplateSystem.parseContentToFields(content);

      if (headerParseResult.success && headerParseResult.fields) {
        // 如果指定了模板ID，验证是否匹配
        if (templateId && headerParseResult.templateId && headerParseResult.templateId !== templateId) {
          logger.warn(`内容中的模板ID (${headerParseResult.templateId}) 与指定的模板ID (${templateId}) 不匹配`);
        }

        // 使用内容中的模板ID或指定的模板ID
        const finalTemplateId = templateId || headerParseResult.templateId;
        let targetTemplate: FieldTemplate | null = null;

        if (finalTemplateId) {
          targetTemplate = await this.templateService.getTemplate(finalTemplateId);
        }

        // 应用分隔符优先级逻辑
        const separationStrategy = this.determineSeparationStrategy(
          content,
          headerParseResult.fields
        );

        const warnings = [
          ...(headerParseResult.warnings || []),
          ...(separationStrategy.separatorInfo ? [separationStrategy.separatorInfo] : [])
        ];

        return {
          success: true,
          fields: headerParseResult.fields,
          template: targetTemplate || undefined,
          ...(warnings.length > 0 ? { warnings } : {})
        };
      }

      // 新格式解析失败，返回错误
      return {
        success: false,
        error: headerParseResult.error || '解析失败，请检查内容格式'
      };
    } catch (error) {
      logger.error('MD content parsing failed:', error);
      return {
        success: false,
        error: `解析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 从结构化字段生成MD内容（使用新的标题格式）
   * @param fields 字段数据
   * @param templateId 模板ID
   * @returns 生成结果
   */
  async generateFromFields(fields: Record<string, string>, templateId: string): Promise<MDGenerateResult> {
    try {
      const template = await this.templateService.getTemplate(templateId);
      if (!template) {
        return {
          success: false,
          error: `找不到指定的模板: ${templateId}`
        };
      }

      // 使用新的Markdown标题格式生成内容
      const headerResult = MarkdownHeaderTemplateSystem.generateContentFromFields(fields, template);

      if (headerResult.success && headerResult.content) {
        // 应用分隔符优先级逻辑到生成的内容
        const separationStrategy = this.determineSeparationStrategy(
          headerResult.content,
          fields
        );

        const warnings = [
          ...(headerResult.warnings || []),
          ...(separationStrategy.separatorInfo ? [separationStrategy.separatorInfo] : [])
        ];

        return {
          success: true,
          content: headerResult.content,
          template,
          ...(warnings.length > 0 ? { warnings } : {})
        };
      }

      return {
        success: false,
        error: headerResult.error || '生成失败，请检查模板配置'
      };
    } catch (error) {
      logger.error('MD content generation failed:', error);
      return {
        success: false,
        error: `生成失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }



  /**
   * 验证MD内容格式
   */
  async validateContent(content: string, templateId?: string): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!content.trim()) {
      issues.push('内容为空');
      return { isValid: false, issues, suggestions };
    }

    // 使用新的标题格式验证
    const parseResult = MarkdownHeaderTemplateSystem.parseContentToFields(content);
    if (!parseResult.success) {
      issues.push(parseResult.error || '内容格式不符合当前解析规范');
      suggestions.push('请使用当前标题格式，示例：\\n\\n# 标题\\n\\n## 字段1\\n内容1\\n\\n## 字段2\\n内容2');
    }

    if (templateId) {
      const template = await this.templateService.getTemplate(templateId);
      if (!template) {
        issues.push(`找不到指定的模板: ${templateId}`);
        suggestions.push('请检查模板ID是否正确，或选择其他可用的模板');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * 获取所有可用的模板
   */
  async getAvailableTemplates(): Promise<FieldTemplate[]> {
    try {
      return await this.templateService.getTemplates();
    } catch (error) {
      logger.error('Failed to get available templates:', error);
      return [];
    }
  }
}

// 单例服务实例
let mdContentParserServiceInstance: MDContentParserService | null = null;

export function getMDContentParserService(plugin: WeavePlugin): MDContentParserService {
  if (!mdContentParserServiceInstance) {
    mdContentParserServiceInstance = new MDContentParserService(plugin);
  }
  return mdContentParserServiceInstance;
}
