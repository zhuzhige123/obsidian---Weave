import { logger } from '../../utils/logger';
/**
 * 学习界面一致性管理协调器
 * 
 * @deprecated V1.5架构专用，已废弃
 * 
 * 原职责：
 * - 卡片一致性检查（V1.5 单卡片多FSRS）
 * - 一致性问题修复（V1.5 progressiveCloze字段）
 * - 渐进式挖空数据管理（V1.5）
 * 
 * V2架构说明：
 * - 渐进式挖空使用独立的父子卡片，无需一致性修复
 * - 使用 ProgressiveClozeConverter 进行转换
 * - 使用 CardConsistencyChecker 进行基础类型检查
 * 
 * @created 2025-11-29
 * @deprecated 2025-12-07
 */

import { Notice } from "obsidian";
import type { WeaveDataStorage } from "../../data/storage";
import type { Card } from "../../data/types";
import { CardType } from "../../data/types";
import { 
  CardConsistencyChecker, 
  type CardConsistencyIssue, 
  ConsistencyIssueType 
} from "../../utils/study/CardConsistencyChecker";
import { ProgressiveClozeAnalyzer } from "../progressive-cloze/ProgressiveClozeAnalyzer";
// V2架构：使用ProgressiveClozeConverter替代ProgressiveClozeSplitter
import { ProgressiveClozeConverter } from "../progressive-cloze/ProgressiveClozeConverter";
import { CardRelationService } from "../relation/CardRelationService";

/**
 * 一致性协调器上下文
 */
export interface ConsistencyCoordinatorContext {
  dataStorage: WeaveDataStorage;
  cardRelationService: CardRelationService;
}

/**
 * 一致性修复结果
 */
export interface ConsistencyFixResult {
  success: boolean;
  message?: string;
  needsReload?: boolean; // 是否需要重新加载学习界面
}

/**
 * 学习界面一致性管理协调器
 */
export class StudyConsistencyCoordinator {
  private checker: CardConsistencyChecker;

  constructor(private context: ConsistencyCoordinatorContext) {
    this.checker = new CardConsistencyChecker();
  }

  /**
   * 检查卡片一致性
   */
  checkCard(card: Card): CardConsistencyIssue | null {
    return this.checker.check(card);
  }

  /**
   * 修复一致性问题
   */
  async fixIssue(
    card: Card,
    issue: CardConsistencyIssue
  ): Promise<ConsistencyFixResult> {
    try {
      switch (issue.type) {
        case ConsistencyIssueType.MISSING_PROGRESSIVE_CLOZE:
          return await this.fixMissingProgressiveCloze(card);
          
        case ConsistencyIssueType.TYPE_MISMATCH:
          return await this.fixTypeMismatch(card, issue);
          
        case ConsistencyIssueType.ORPHANED_PROGRESSIVE_CLOZE:
          return await this.fixOrphanedProgressiveCloze(card);
          
        case ConsistencyIssueType.OUTDATED_PROGRESSIVE_CLOZE:
          return await this.fixOutdatedProgressiveCloze(card);
          
        default:
          return {
            success: false,
            message: '未知的一致性问题类型'
          };
      }
    } catch (error) {
      logger.error('[一致性修复] 失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '修复失败'
      };
    }
  }

  /**
   * 修复缺少渐进式挖空数据的问题
   */
  private async fixMissingProgressiveCloze(card: Card): Promise<ConsistencyFixResult> {
    logger.debug('[一致性修复] 初始化渐进式挖空');
    
    // V2架构：转换为父卡片+子卡片
    const converter = new ProgressiveClozeConverter();
    
    // 1. 检查是否可以转换
    if (!converter.canConvert(card)) {
      new Notice('卡片不满足渐进式挖空条件（需要≥2个挖空）', 3000);
      return {
        success: false,
        message: '卡片不满足渐进式挖空条件（需要≥2个挖空）'
      };
    }
    
    // 2. 转换为父卡片+子卡片
    const { parent, children } = converter.convert(card, {
      inheritFsrs: true,  // 继承原有FSRS数据
      keepParent: true
    });
    
    // 3. 保存所有卡片（父卡片+子卡片）
    await this.context.dataStorage.saveCard(parent);
    for (const child of children) {
      await this.context.dataStorage.saveCard(child);
    }
    
    new Notice(
      `已转换为渐进式挖空V2\n创建1个父卡片 + ${children.length}个子卡片\n请刷新学习界面`,
      4000
    );
    
    logger.debug(`[一致性修复] 渐进式挖空初始化完成: ${card.uuid}`);
    
    return {
      success: true,
      message: `已初始化${children.length}个渐进式挖空`,
      needsReload: true
    };
  }

  /**
   * 修复类型不匹配的问题
   */
  private async fixTypeMismatch(
    card: Card,
    issue: CardConsistencyIssue
  ): Promise<ConsistencyFixResult> {
    logger.debug('[一致性修复] 修正卡片类型');
    
    const detectedType = issue.detectedContentType;
    
    // 1. 更新type
    card.type = detectedType;
    
    // 2. V2架构：检测到多个挖空时，提示用户使用转换工具
    if (detectedType === CardType.Cloze && issue.detectedClozeCount && issue.detectedClozeCount >= 2) {
      logger.info('[一致性修复] 检测到多个挖空，建议使用 ProgressiveClozeConverter 转换为V2架构');
      new Notice('检测到多个挖空，可使用转换工具创建渐进式挖空卡片', 3000);
    }
    
    // 3. 清除可能存在的 V1.5 废弃字段
    const cardAny = card as any;
    if (cardAny.progressiveCloze) {
      delete cardAny.progressiveCloze;
    }
    
    // 4. 保存
    await this.context.dataStorage.saveCard(card);
    
    new Notice('卡片类型已修正', 2000);
    
    return {
      success: true,
      message: '卡片类型已修正'
    };
  }

  /**
   * 修复孤立的渐进式挖空数据
   * @deprecated V1.5专用
   */
  private async fixOrphanedProgressiveCloze(card: Card): Promise<ConsistencyFixResult> {
    logger.debug('[一致性修复] 清除过时的挖空数据');
    
    // 1. 删除progressiveCloze（V1.5兼容）
    const cardAny = card as any;
    delete cardAny.progressiveCloze;
    
    // 2. 更新type为检测到的类型
    const detectedType = this.checker.detectCardTypeFromContent(card.content || '');
    card.type = detectedType;
    
    // 3. 保存
    await this.context.dataStorage.saveCard(card);
    
    new Notice('已清除挖空数据', 2000);
    
    return {
      success: true,
      message: '已清除过时的挖空数据'
    };
  }

  /**
   * 修复过时的渐进式挖空数据
   * @deprecated V1.5专用
   */
  private async fixOutdatedProgressiveCloze(card: Card): Promise<ConsistencyFixResult> {
    logger.debug('[一致性修复] 重新初始化渐进式挖空');
    
    // 删除旧数据，重新初始化（V1.5兼容）
    const cardAny = card as any;
    delete cardAny.progressiveCloze;
    return await this.fixMissingProgressiveCloze(card);
  }

  /**
   * 自动修复（用于启用自动拆分时）
   */
  async autoFix(card: Card): Promise<ConsistencyFixResult> {
    const issue = this.checkCard(card);
    
    if (!issue) {
      return {
        success: true,
        message: '无需修复'
      };
    }
    
    logger.debug('[一致性修复] 自动修复一致性问题:', issue.type);
    return await this.fixIssue(card, issue);
  }
}
