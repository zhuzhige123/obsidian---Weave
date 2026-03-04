/**
 * 模板自动识别器
 * 负责识别和标记 Weave 专属模板，支持双向同步
 */

import type { ParseTemplate } from '../../types/newCardParsingTypes';

export interface IdentificationResult {
  isAnkiImported: boolean;  // 是否从 Anki 导入
  isWeaveExclusive?: boolean;  // Weave 专属模板（已弃用，保留向后兼容）
  supportsBidirectional?: boolean;  // 支持双向同步（已弃用）
  confidence: number;
  reason: string[];
}

export class TemplateAutoIdentifier {
  // Weave 专属标识符
  private readonly WEAVE_SIGNATURES = [
    'weave-template',
    'weave_template',
    'WEAVE',
    'weave-exclusive'
  ];

  // Weave 专属命名前缀
  private readonly WEAVE_PREFIXES = [
    'Weave:',
    'weave-',
    'T:',
    '[Weave]'
  ];

  /**
   * 识别模板是否为 Weave 专属
   */
  identify(template: ParseTemplate): IdentificationResult {
    const reasons: string[] = [];
    let confidence = 0;
    let isWeaveExclusive = false;
    let supportsBidirectional = false;

    // 检查 1: 显式的 syncCapability 标记
    if (template.syncCapability) {
      if ((template.syncCapability as any).isWeaveExclusive) {
        confidence += 100;
        isWeaveExclusive = true;
        supportsBidirectional = (template.syncCapability as any).supportsBidirectional ?? false;
        reasons.push('模板已显式标记为 Weave 专属');
        return { isAnkiImported: false, isWeaveExclusive, supportsBidirectional, confidence, reason: reasons };
      }
    }

    // 检查 2: weaveMetadata 标记
    if (template.weaveMetadata) {
      const metadata = template.weaveMetadata;
      
      if (metadata.source === 'weave_created') {
        confidence += 80;
        isWeaveExclusive = true;
        supportsBidirectional = true;
        reasons.push('模板在 Weave 中创建');
      } else if (metadata.source === 'official' && metadata.createdInWeave) {
        confidence += 90;
        isWeaveExclusive = true;
        supportsBidirectional = true;
        reasons.push('Weave 官方模板');
      } else if (metadata.editedInWeave && metadata.createdInWeave) {
        confidence += 70;
        isWeaveExclusive = true;
        supportsBidirectional = true;
        reasons.push('模板在 Weave 中创建并编辑');
      } else if (metadata.source === 'anki_imported') {
        confidence = 10;
        isWeaveExclusive = false;
        supportsBidirectional = false;
        reasons.push('模板从 Anki 导入');
      }
      
      if (metadata.signature && this.containsWeaveSignature(metadata.signature)) {
        confidence += 20;
        isWeaveExclusive = true;
        reasons.push('包含 Weave 签名');
      }
    }

    // 检查 3: 模板名称
    const nameCheck = this.checkTemplateName(template.name);
    if (nameCheck.isWeave) {
      confidence += 60;
      isWeaveExclusive = true;
      supportsBidirectional = true;
      reasons.push(`模板名称包含 Weave 标识: ${nameCheck.matchedPattern}`);
    }

    // 检查 4: 是否为官方模板
    if (template.isOfficial) {
      confidence += 50;
      isWeaveExclusive = true;
      supportsBidirectional = true;
      reasons.push('Weave 官方模板');
    }

    // 检查 5: 描述中的标识
    if (template.description) {
      if (this.containsWeaveSignature(template.description)) {
        confidence += 30;
        isWeaveExclusive = true;
        reasons.push('描述中包含 Weave 标识');
      }
    }

    // 检查 6: 创建时间和更新时间
    if (template.createdAt && !template.syncCapability?.ankiModelMapping) {
      confidence += 10;
      isWeaveExclusive = true;
      reasons.push('在 Weave 中首次创建');
    }

    // 最终判断
    if (confidence >= 50) {
      isWeaveExclusive = true;
      supportsBidirectional = true;
    }

    if (reasons.length === 0) {
      reasons.push('未找到 Weave 专属标识，判定为通用模板');
    }

    return {
      isAnkiImported: !isWeaveExclusive,
      isWeaveExclusive,
      supportsBidirectional,
      confidence,
      reason: reasons
    };
  }

  /**
   * 检查模板名称
   */
  private checkTemplateName(name: string): { isWeave: boolean; matchedPattern?: string } {
    for (const prefix of this.WEAVE_PREFIXES) {
      if (name.startsWith(prefix)) {
        return { isWeave: true, matchedPattern: prefix };
      }
    }

    for (const signature of this.WEAVE_SIGNATURES) {
      if (name.toLowerCase().includes(signature.toLowerCase())) {
        return { isWeave: true, matchedPattern: signature };
      }
    }

    return { isWeave: false };
  }

  /**
   * 检查字符串是否包含 Weave 签名
   */
  private containsWeaveSignature(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.WEAVE_SIGNATURES.some(sig => lowerText.includes(sig.toLowerCase()));
  }

  /**
   * 生成 Weave 签名
   */
  generateWeaveSignature(templateId: string, version = '1.0'): string {
    const timestamp = Date.now();
    return `weave-template-${templateId}-v${version}-${timestamp}`;
  }

  /**
   * 标记模板为 Weave 专属
   */
  markAsWeaveExclusive(
    template: ParseTemplate,
    _supportsBidirectional = true // 已弃用，保留参数签名兼容性
  ): ParseTemplate {
    const now = new Date().toISOString();

    return {
      ...template,
      syncCapability: {
        ankiModelMapping: undefined
      } as any,
      weaveMetadata: {
        signature: this.generateWeaveSignature(template.id, '1.0'),
        version: '1.0',
        ankiCompatible: false,
        source: template.isOfficial ? 'official' : 'weave_created',
        createdInWeave: true,
        editedInWeave: false
      },
      createdAt: template.createdAt || now,
      updatedAt: now
    };
  }

  /**
   * 标记模板为从 Anki 导入
   */
  markAsAnkiImported(
    template: ParseTemplate,
    ankiModelId: number,
    ankiModelName: string
  ): ParseTemplate {
    const now = new Date().toISOString();

    return {
      ...template,
      syncCapability: {
        ankiModelMapping: {
          modelId: ankiModelId,
          modelName: ankiModelName,
          lastSyncVersion: '1.0'
        }
      },
      weaveMetadata: {
        signature: '',
        version: '1.0',
        ankiCompatible: true,
        source: 'anki_imported',
        createdInWeave: false,
        editedInWeave: false
      },
      createdAt: template.createdAt || now,
      updatedAt: now
    };
  }

  /**
   * 批量识别模板
   */
  identifyBatch(templates: ParseTemplate[]): Map<string, IdentificationResult> {
    const results = new Map<string, IdentificationResult>();
    
    for (const template of templates) {
      const result = this.identify(template);
      results.set(template.id, result);
    }

    return results;
  }


  /**
   * 获取统计信息
   */
  getStatistics(templates: ParseTemplate[]): {
    total: number;
    weaveExclusive: number;
    bidirectional: number;
    ankiImported: number;
    generic: number;
  } {
    const results = this.identifyBatch(templates);
    const identifications = Array.from(results.values());

    return {
      total: templates.length,
      weaveExclusive: identifications.filter(r => r.isWeaveExclusive).length,
      bidirectional: identifications.filter(r => r.supportsBidirectional).length,
      ankiImported: templates.filter(t => 
        t.weaveMetadata?.source === 'anki_imported'
      ).length,
      generic: identifications.filter(r => !r.isWeaveExclusive).length
    };
  }
}




