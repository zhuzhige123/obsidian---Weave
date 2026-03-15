import { logger } from '../../utils/logger';
/**
 * Content-Only 架构迁移工具
 * 
 * 目标：移除 card.fields，全面使用 card.content 作为唯一数据源
 * 
 * 迁移步骤：
 * 1. 数据完整性验证
 * 2. 创建完整备份
 * 3. 从 fields 生成 content（如果缺失）
 * 4. 删除 fields 字段
 * 5. 验证迁移结果
 * 
 * @module services/data-migration
 */

import type { WeavePlugin } from '../../main';
import type { Card } from '../../data/types';
import { Notice } from 'obsidian';
import { QACardParser } from '../../parsers/card-type-parsers/QACardParser';
import { ChoiceCardParser } from '../../parsers/card-type-parsers/ChoiceCardParser';
import { ClozeCardParser } from '../../parsers/card-type-parsers/ClozeCardParser';
import type { CardType } from '../../parsers/MarkdownFieldsConverter';
import { DirectoryUtils } from '../../utils/directory-utils';
import { getPluginPaths } from '../../config/paths';

/**
 * 迁移报告
 */
export interface MigrationReport {
  // 总体统计
  totalCards: number;
  
  // 迁移统计
  cardsWithContentOnly: number;  // 已经是 content-only 格式
  cardsNeedMigration: number;    // 需要迁移（有 fields 无 content）
  cardsMigrated: number;         // 成功迁移的卡片
  cardsFieldsRemoved: number;    // 移除了 fields 的卡片
  
  // 问题卡片
  cardsWithErrors: number;       // 迁移失败的卡片
  errors: MigrationError[];
  
  // 备份信息
  backupPath?: string;
  backupCreatedAt?: string;
  
  // 性能指标
  duration: number;              // 迁移耗时(ms)
  
  // 成功标志
  success: boolean;
}

/**
 * 迁移错误
 */
export interface MigrationError {
  cardId: string;
  cardUuid?: string;
  errorType: 'no_content' | 'no_fields' | 'parse_failed' | 'save_failed' | 'unknown';
  message: string;
  cardData?: Partial<Card>;
}

/**
 * 数据验证报告
 */
export interface ValidationReport {
  totalCards: number;
  hasContent: number;
  hasFields: number;
  hasContentAndFields: number;
  hasContentOnly: number;
  hasFieldsOnly: number;
  hasNeither: number;
  
  // 按卡片类型分组
  byType: Record<string, {
    total: number;
    hasContent: number;
    hasFields: number;
  }>;
  
  // 详细问题
  issues: {
    cardId: string;
    issue: string;
  }[];
}

/**
 * Content-Only 迁移服务
 */
export class ContentOnlyMigration {
  private plugin: WeavePlugin;
  
  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }
  
  /**
   * 验证当前数据状态
   */
  async validateCurrentData(): Promise<ValidationReport> {
    logger.debug('[ContentOnlyMigration] 🔍 开始数据验证...');
    
    const report: ValidationReport = {
      totalCards: 0,
      hasContent: 0,
      hasFields: 0,
      hasContentAndFields: 0,
      hasContentOnly: 0,
      hasFieldsOnly: 0,
      hasNeither: 0,
      byType: {},
      issues: []
    };
    
    // 获取所有牌组
    const decks = await this.plugin.dataStorage.getDecks();
    
    for (const deck of decks) {
      const cards = await this.plugin.dataStorage.getDeckCards(deck.id);
      
      for (const card of cards) {
        report.totalCards++;
        
        const hasContent = !!(card.content && card.content.trim());
        const hasFields = !!(card.fields && Object.keys(card.fields).length > 0);
        
        if (hasContent) report.hasContent++;
        if (hasFields) report.hasFields++;
        
        if (hasContent && hasFields) {
          report.hasContentAndFields++;
        } else if (hasContent && !hasFields) {
          report.hasContentOnly++;
        } else if (!hasContent && hasFields) {
          report.hasFieldsOnly++;
          report.issues.push({
            cardId: card.uuid,
            issue: '只有 fields 没有 content，需要迁移'
          });
        } else {
          report.hasNeither++;
          report.issues.push({
            cardId: card.uuid,
            issue: 'content 和 fields 都为空！数据异常'
          });
        }
        
        // 按类型统计
        const type = card.type || 'unknown';
        if (!report.byType[type]) {
          report.byType[type] = { total: 0, hasContent: 0, hasFields: 0 };
        }
        report.byType[type].total++;
        if (hasContent) report.byType[type].hasContent++;
        if (hasFields) report.byType[type].hasFields++;
      }
    }
    
    // 同样检查题库
    const questionBanks = this.plugin.questionBankService?.getAllQuestionBanks() || [];
    for (const bank of questionBanks) {
      const questions = await this.plugin.questionBankService?.getQuestionsByBank(bank.id) || [];
      
      for (const card of questions) {
        report.totalCards++;
        
        const hasContent = !!(card.content && card.content.trim());
        const hasFields = !!(card.fields && Object.keys(card.fields).length > 0);
        
        if (hasContent) report.hasContent++;
        if (hasFields) report.hasFields++;
        
        if (hasContent && hasFields) {
          report.hasContentAndFields++;
        } else if (hasContent && !hasFields) {
          report.hasContentOnly++;
        } else if (!hasContent && hasFields) {
          report.hasFieldsOnly++;
          report.issues.push({
            cardId: card.uuid,
            issue: '题库卡片：只有 fields 没有 content，需要迁移'
          });
        } else {
          report.hasNeither++;
          report.issues.push({
            cardId: card.uuid,
            issue: '题库卡片：content 和 fields 都为空！数据异常'
          });
        }
        
        const type = card.type || 'unknown';
        if (!report.byType[type]) {
          report.byType[type] = { total: 0, hasContent: 0, hasFields: 0 };
        }
        report.byType[type].total++;
        if (hasContent) report.byType[type].hasContent++;
        if (hasFields) report.byType[type].hasFields++;
      }
    }
    
    logger.debug('[ContentOnlyMigration] ✅ 数据验证完成:', report);
    return report;
  }
  
  /**
   * 创建完整备份
   */
  async createBackup(): Promise<string> {
    logger.debug('[ContentOnlyMigration] 💾 创建数据备份...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData: any = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      migrationPurpose: 'content-only-migration',
      decks: [],
      questionBanks: []
    };
    
    // 备份所有牌组
    const decks = await this.plugin.dataStorage.getDecks();
    for (const deck of decks) {
      const cards = await this.plugin.dataStorage.getDeckCards(deck.id);
      backupData.decks.push({
        deck: deck,
        cards: cards
      });
    }
    
    // 备份所有题库
    const questionBanks = this.plugin.questionBankService?.getAllQuestionBanks() || [];
    for (const bank of questionBanks) {
      const questions = await this.plugin.questionBankService?.getQuestionsByBank(bank.id) || [];
      backupData.questionBanks.push({
        bank: bank,
        questions: questions
      });
    }
    
    // 保存备份文件
    const backupFileName = `weave-backup-content-only-${timestamp}.json`;
    const backupDir = getPluginPaths(this.plugin.app).backups;
    const backupPath = `${backupDir}/${backupFileName}`;
    
    try {
      // 确保备份目录存在
      await DirectoryUtils.ensureDirRecursive(this.plugin.app.vault.adapter, backupDir);
      
      await this.plugin.app.vault.adapter.write(
        backupPath,
        JSON.stringify(backupData, null, 2)
      );
      
      logger.debug(`[ContentOnlyMigration] ✅ 备份创建成功: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('[ContentOnlyMigration] ❌ 备份创建失败:', error);
      throw new Error(`备份创建失败: ${error}`);
    }
  }
  
  /**
   * 从 fields 生成 content
   */
  private generateContentFromFields(card: Card): string {
    if (!card.fields) return '';
    
    const type = this.normalizeCardType(card.type);
    
    try {
      switch (type) {
        case 'cloze-deletion': {
          // 挖空题：优先使用 text 字段
          return card.fields.text || card.fields.front || '';
        }
        
        case 'single-choice':
        case 'multiple-choice': {
          // 选择题：需要重建完整格式
          const front = card.fields.front || '';
          const back = card.fields.back || '';
          
          if (!back) return front;
          return `${front}\n\n---div---\n\n${back}`;
        }
        
        case 'basic-qa':
        default: {
          // 问答题：front + back
          const front = card.fields.front || card.fields.question || '';
          const back = card.fields.back || card.fields.answer || '';
          
          if (!back) return front;
          return `${front}\n\n---div---\n\n${back}`;
        }
      }
    } catch (error) {
      logger.error('[ContentOnlyMigration] 生成 content 失败:', card.uuid, error);
      // 降级：合并所有字段
      return Object.values(card.fields).filter(v => v).join('\n\n---div---\n\n');
    }
  }
  
  /**
   * 标准化卡片类型
   */
  private normalizeCardType(type?: string): CardType {
    if (!type) return 'basic-qa';
    
    const normalized = type.toLowerCase();
    
    if (normalized.includes('cloze')) return 'cloze-deletion';
    if (normalized.includes('choice') || normalized.includes('mcq')) {
      return normalized.includes('single') ? 'single-choice' : 'multiple-choice';
    }
    
    return 'basic-qa';
  }
  
  /**
   * 执行完整迁移
   */
  async migrate(options: {
    createBackup?: boolean;
    removeFields?: boolean;
    dryRun?: boolean;
  } = {}): Promise<MigrationReport> {
    const {
      createBackup = true,
      removeFields = true,
      dryRun = false
    } = options;
    
    const startTime = Date.now();
    
    const report: MigrationReport = {
      totalCards: 0,
      cardsWithContentOnly: 0,
      cardsNeedMigration: 0,
      cardsMigrated: 0,
      cardsFieldsRemoved: 0,
      cardsWithErrors: 0,
      errors: [],
      duration: 0,
      success: false
    };
    
    try {
      logger.debug('[ContentOnlyMigration] 🚀 开始迁移...');
      logger.debug('[ContentOnlyMigration] 配置:', { createBackup, removeFields, dryRun });
      
      // 步骤1：创建备份
      if (createBackup && !dryRun) {
        report.backupPath = await this.createBackup();
        report.backupCreatedAt = new Date().toISOString();
        new Notice('数据备份已创建');
      }
      
      // 步骤2：迁移牌组卡片
      const decks = await this.plugin.dataStorage.getDecks();
      for (const deck of decks) {
        await this.migrateDeck(deck.id, report, removeFields, dryRun);
      }
      
      // 步骤3：迁移题库卡片
      const questionBanks = this.plugin.questionBankService?.getAllQuestionBanks() || [];
      for (const bank of questionBanks) {
        await this.migrateQuestionBank(bank.id, report, removeFields, dryRun);
      }
      
      report.duration = Date.now() - startTime;
      report.success = report.cardsWithErrors === 0;
      
      logger.debug('[ContentOnlyMigration] ✅ 迁移完成:', report);
      
      if (!dryRun) {
        if (report.success) {
          new Notice(`迁移成功！共处理 ${report.totalCards} 张卡片`);
        } else {
          new Notice(`迁移完成，但有 ${report.cardsWithErrors} 张卡片出错`);
        }
      }
      
      return report;
      
    } catch (error) {
      logger.error('[ContentOnlyMigration] ❌ 迁移失败:', error);
      report.duration = Date.now() - startTime;
      report.success = false;
      report.errors.push({
        cardId: 'MIGRATION_PROCESS',
        errorType: 'unknown',
        message: `迁移过程失败: ${error}`
      });
      
      if (!dryRun) {
        new Notice('迁移失败！请查看控制台');
      }
      
      return report;
    }
  }
  
  /**
   * 迁移单个牌组
   */
  private async migrateDeck(
    deckId: string,
    report: MigrationReport,
    removeFields: boolean,
    dryRun: boolean
  ): Promise<void> {
    const cards = await this.plugin.dataStorage.getDeckCards(deckId);
    
    for (const card of cards) {
      report.totalCards++;
      
      const hasContent = !!(card.content && card.content.trim());
      const hasFields = !!(card.fields && Object.keys(card.fields).length > 0);
      
      let needsSave = false;
      
      // 场景1：只有 fields，没有 content - 需要生成 content
      if (!hasContent && hasFields) {
        report.cardsNeedMigration++;
        
        try {
          const generatedContent = this.generateContentFromFields(card);
          
          if (!generatedContent || !generatedContent.trim()) {
            throw new Error('生成的 content 为空');
          }
          
          card.content = generatedContent;
          report.cardsMigrated++;
          needsSave = true;
          
          logger.debug(`[ContentOnlyMigration] ✓ 生成 content: ${card.uuid}`);
        } catch (error) {
          report.cardsWithErrors++;
          report.errors.push({
            cardId: deckId,
            cardUuid: card.uuid,
            errorType: 'parse_failed',
            message: `从 fields 生成 content 失败: ${error}`,
            cardData: { uuid: card.uuid, type: card.type }
          });
          logger.error(`[ContentOnlyMigration] ✗ 生成失败: ${card.uuid}`, error);
          continue; // 跳过此卡片
        }
      } else if (hasContent && !hasFields) {
        // 场景2：只有 content，没有 fields - 已经是目标格式
        report.cardsWithContentOnly++;
      } else if (hasContent && hasFields) {
        // 场景3：既有 content 又有 fields - 保留 content，后续删除 fields
        report.cardsWithContentOnly++;
      } else {
        // 场景4：两者都没有 - 数据异常
        report.cardsWithErrors++;
        report.errors.push({
          cardId: deckId,
          cardUuid: card.uuid,
          errorType: 'no_content',
          message: 'content 和 fields 都为空',
          cardData: { uuid: card.uuid }
        });
        continue;
      }
      
      // 删除 fields 字段
      if (removeFields && hasFields) {
        delete card.fields;
        report.cardsFieldsRemoved++;
        needsSave = true;
      }
      
      // 保存卡片
      if (needsSave && !dryRun) {
        try {
          await this.plugin.dataStorage.saveCard(card);
        } catch (error) {
          report.cardsWithErrors++;
          report.errors.push({
            cardId: deckId,
            cardUuid: card.uuid,
            errorType: 'save_failed',
            message: `保存失败: ${error}`,
            cardData: { uuid: card.uuid }
          });
        }
      }
    }
  }
  
  /**
   * 迁移单个题库
   */
  private async migrateQuestionBank(
    bankId: string,
    report: MigrationReport,
    removeFields: boolean,
    dryRun: boolean
  ): Promise<void> {
    const questions = await this.plugin.questionBankService?.getQuestionsByBank(bankId) || [];
    
    for (const card of questions) {
      report.totalCards++;
      
      const hasContent = !!(card.content && card.content.trim());
      const hasFields = !!(card.fields && Object.keys(card.fields).length > 0);
      
      let needsSave = false;
      
      if (!hasContent && hasFields) {
        report.cardsNeedMigration++;
        
        try {
          const generatedContent = this.generateContentFromFields(card);
          
          if (!generatedContent || !generatedContent.trim()) {
            throw new Error('生成的 content 为空');
          }
          
          card.content = generatedContent;
          report.cardsMigrated++;
          needsSave = true;
          
          logger.debug(`[ContentOnlyMigration] ✓ 题库生成 content: ${card.uuid}`);
        } catch (error) {
          report.cardsWithErrors++;
          report.errors.push({
            cardId: bankId,
            cardUuid: card.uuid,
            errorType: 'parse_failed',
            message: `题库卡片：从 fields 生成 content 失败: ${error}`,
            cardData: { uuid: card.uuid, type: card.type }
          });
          continue;
        }
      } else if (hasContent && !hasFields) {
        report.cardsWithContentOnly++;
      } else if (hasContent && hasFields) {
        report.cardsWithContentOnly++;
      } else {
        report.cardsWithErrors++;
        report.errors.push({
          cardId: bankId,
          cardUuid: card.uuid,
          errorType: 'no_content',
          message: '题库卡片：content 和 fields 都为空',
          cardData: { uuid: card.uuid }
        });
        continue;
      }
      
      if (removeFields && hasFields) {
        delete card.fields;
        report.cardsFieldsRemoved++;
        needsSave = true;
      }
      
      if (needsSave && !dryRun) {
        try {
          await this.plugin.questionBankService?.updateQuestion(card.uuid, card);
        } catch (error) {
          report.cardsWithErrors++;
          report.errors.push({
            cardId: bankId,
            cardUuid: card.uuid,
            errorType: 'save_failed',
            message: `题库卡片保存失败: ${error}`,
            cardData: { uuid: card.uuid }
          });
        }
      }
    }
  }
  
  /**
   * 生成迁移报告（人类可读）
   */
  generateReadableReport(report: MigrationReport): string {
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════════════');
    lines.push('   Content-Only 架构迁移报告');
    lines.push('═══════════════════════════════════════════');
    lines.push('');
    
    lines.push(`📊 总体统计`);
    lines.push(`  • 总卡片数: ${report.totalCards}`);
    lines.push(`  • 已是 content-only 格式: ${report.cardsWithContentOnly}`);
    lines.push(`  • 需要迁移: ${report.cardsNeedMigration}`);
    lines.push(`  • 成功迁移: ${report.cardsMigrated}`);
    lines.push(`  • 移除 fields 字段: ${report.cardsFieldsRemoved}`);
    lines.push(`  • 错误数: ${report.cardsWithErrors}`);
    lines.push('');
    
    if (report.backupPath) {
      lines.push(`💾 备份信息`);
      lines.push(`  • 备份路径: ${report.backupPath}`);
      lines.push(`  • 创建时间: ${report.backupCreatedAt}`);
      lines.push('');
    }
    
    lines.push(`⏱️ 性能指标`);
    lines.push(`  • 总耗时: ${report.duration}ms`);
    lines.push(`  • 平均耗时: ${report.totalCards > 0 ? (report.duration / report.totalCards).toFixed(2) : 0}ms/卡片`);
    lines.push('');
    
    if (report.errors.length > 0) {
      lines.push(`❌ 错误详情 (${report.errors.length})`);
      report.errors.slice(0, 10).forEach((error, index) => {
        lines.push(`  ${index + 1}. [${error.errorType}] ${error.cardUuid || error.cardId}`);
        lines.push(`     ${error.message}`);
      });
      if (report.errors.length > 10) {
        lines.push(`  ... 还有 ${report.errors.length - 10} 个错误`);
      }
      lines.push('');
    }
    
    lines.push(`${report.success ? '✅' : '⚠️'} 迁移状态: ${report.success ? '成功' : '部分失败'}`);
    lines.push('═══════════════════════════════════════════');
    
    return lines.join('\n');
  }
}
