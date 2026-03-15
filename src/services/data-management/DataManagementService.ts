/**
 * 数据管理服务
 * 
 * 统一管理数据检测、修复和迁移功能
 * 
 * @module services/data-management/DataManagementService
 * @version 1.0.0
 */

import type { Card, Deck } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { logger } from '../../utils/logger';
import { LEGACY_DOT_TUANKI, getV2Paths, normalizeWeaveParentFolder, resolveIRImportFolder } from '../../config/paths';
import { DirectoryUtils } from '../../utils/directory-utils';
import { 
  parseYAMLFromContent, 
  setCardProperties,
  needsSourceMigration,
  migrateSourceFields,
  type CardYAMLMetadata 
} from '../../utils/yaml-utils';
import { getDeckNameById } from '../DeckNameMapper';
import { diagnoseFilename, type SyncIssueType } from '../../utils/sync-safe-filename';
import { hasProgressiveClozeContent, isProgressiveClozeParent, isProgressiveClozeChild } from '../../types/progressive-cloze-v2';
import {
  UnifiedDataMigrationService,
  type DataMigrationPlan,
  type DataMigrationReport,
} from '../data-migration/UnifiedDataMigrationService';

// ===== 类型定义 =====

/** 检测类型枚�?*/
export type CheckType = 
  | 'yaml_migration'      // YAML 元数据迁�?
  | 'we_decks_fix'        // we_decks 牌组ID修复
  | 'we_block_migration'  // we_block -> we_source 合并迁移
  | 'deprecated_fields'   // 弃用字段检�?
  | 'card_deck_consistency' // 卡片-牌组一致�?
  | 'ir_material_consistency' // 导入材料一致性（增量阅读�?
  | 'orphan_cards'        // 孤立卡片
  | 'duplicate_cards'     // 重复卡片
  | 'invalid_refs'        // 无效引用
  | 'schema_migration'    // Schema V2 数据迁移
  | 'structure_check'     // 目录结构核对
  | 'legacy_cleanup'      // 旧目录清�?
  | 'filename_compatibility' // 文件名云同步兼容�?
  | 'sync_conflict_files'    // 云同步冲突副本检�?
  | 'progressive_cloze_unconverted'  // 符合渐进式挖空格式但未转�?
  | 'progressive_cloze_orphan'       // 孤儿子卡片（父卡片已不存在）
  | 'progressive_cloze_missing_children'  // 父卡片缺少序号对应的子卡�?
  | 'progressive_cloze_extra_children';   // 子卡片序号在父卡片内容中不存�?

/** 检测状�?*/
export type CheckStatus = 'ok' | 'warning' | 'error';

/** 数据检测结�?*/
export interface DataCheckResult {
  type: CheckType;
  status: CheckStatus;
  count: number;
  items: string[];  // 问题卡片UUID列表
  message: string;
}

/** 数据修复结果 */
export interface DataFixResult {
  type: CheckType;
  success: number;
  failed: number;
  errors: Array<{ uuid: string; error: string }>;
}

/** 检测进度回�?*/
export type ProgressCallback = (current: number, total: number, message: string) => void;

// ===== 弃用字段定义 =====

/** 
 * 需要直接删除的弃用字段
 * 注意：sourceFile, sourceBlock, type, priority, tags 是从 content YAML 解析的派生字段，
 * 它们在运行时是正常的，不需要清�?
 */
const DEPRECATED_FIELDS_TO_DELETE = [
  'template',
  'templateId',
  'deckId',           // 引用式牌组架构下不再需�?
  'referencedByDecks', // 已由 deck.cardUUIDs 替代
  'fields',           // Content-Only 架构下从 content 实时解析
] as const;

// ===== 服务实现 =====

export class DataManagementService {
  private plugin: WeavePlugin;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  private getMigrationService(): UnifiedDataMigrationService {
    return new UnifiedDataMigrationService(this.plugin.app, this.plugin.settings);
  }

  // ===== 检测方�?=====

  /**
   * 检测所有问�?
   */
  async checkAll(onProgress?: ProgressCallback): Promise<DataCheckResult[]> {
    const results: DataCheckResult[] = [];
    // 注意：orphan_cards（孤立卡片）在引用式牌组架构下是允许存在的，不作为问题检�?
    // 注意：redundant_fields 已移除，因为 Content-Only 架构�?type/tags 是从 content YAML 派生的运行时字段
    const checks: CheckType[] = [
      'yaml_migration',
      'we_decks_fix',
      'we_block_migration',
      'deprecated_fields',
      'duplicate_cards',
      'card_deck_consistency',
      'ir_material_consistency',
      'legacy_cleanup',
      'filename_compatibility',
      'sync_conflict_files',
      'progressive_cloze_unconverted',
      'progressive_cloze_orphan',
      'progressive_cloze_missing_children',
      'progressive_cloze_extra_children'
    ];

    for (let i = 0; i < checks.length; i++) {
      onProgress?.(i + 1, checks.length, `检�?${this.getCheckName(checks[i])}...`);
      const result = await this.check(checks[i]);
      results.push(result);
    }

    return results;
  }

  /**
   * 检测单�?
   */
  async check(type: CheckType): Promise<DataCheckResult> {
    const cards = await this.plugin.dataStorage.getCards();
    const decks = await this.plugin.dataStorage.getDecks();

    switch (type) {
      case 'yaml_migration':
        return this.checkYAMLMigration(cards);
      case 'we_decks_fix':
        return this.checkWeDecksId(cards);
      case 'deprecated_fields':
        return this.checkDeprecatedFields(cards);
      case 'we_block_migration':
        return this.checkWeBlockMigration(cards);
      // redundant_fields 已移除：Content-Only 架构�?type/tags 是从 content YAML 派生的运行时字段
      case 'orphan_cards':
        return this.checkOrphanCards(cards, decks);
      case 'duplicate_cards':
        return this.checkDuplicateCards(cards);
      case 'card_deck_consistency':
        return await this.checkCardDeckConsistency(cards, decks);
      case 'ir_material_consistency':
        return await this.checkIRMaterialConsistency();
      case 'legacy_cleanup':
        return await this.checkLegacyDirectories();
      case 'filename_compatibility':
        return await this.checkFilenameCompatibility();
      case 'sync_conflict_files':
        return await this.checkSyncConflictFiles();
      case 'progressive_cloze_unconverted':
        return this.checkProgressiveClozeUnconverted(cards);
      case 'progressive_cloze_orphan':
        return this.checkProgressiveClozeOrphan(cards);
      case 'progressive_cloze_missing_children':
        return this.checkProgressiveClozeMissingChildren(cards);
      case 'progressive_cloze_extra_children':
        return this.checkProgressiveClozeExtraChildren(cards);
      default:
        return {
          type,
          status: 'ok',
          count: 0,
          items: [],
          message: '暂未实现'
        };
    }
  }

  // ===== 修复方法 =====

  /**
   * 修复所有问�?
   */
  async fixAll(onProgress?: ProgressCallback): Promise<DataFixResult[]> {
    const results: DataFixResult[] = [];
    const fixes: CheckType[] = [
      'yaml_migration',
      'we_decks_fix',
      'we_block_migration',
      'deprecated_fields',
      'duplicate_cards',
      'card_deck_consistency',
      'ir_material_consistency',
      'legacy_cleanup',
      'filename_compatibility',
      'sync_conflict_files',
      'progressive_cloze_unconverted'
    ];

    for (let i = 0; i < fixes.length; i++) {
      onProgress?.(i + 1, fixes.length, `修复 ${this.getCheckName(fixes[i])}...`);
      const result = await this.fix(fixes[i]);
      results.push(result);
      
      // 每个修复操作后清除缓存，确保下次读取时获取最新数�?
      if (this.plugin.cardFileService) {
        this.plugin.cardFileService.clearCache();
      }
      // 等待文件系统同步
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 最终等待文件系统完全同�?
    await new Promise(resolve => setTimeout(resolve, 100));

    return results;
  }

  /**
   * 修复单项
   */
  async fix(type: CheckType): Promise<DataFixResult> {
    const cards = await this.plugin.dataStorage.getCards();
    const decks = await this.plugin.dataStorage.getDecks();

    switch (type) {
      case 'yaml_migration':
        return this.fixYAMLMigration(cards);
      case 'we_decks_fix':
        return this.fixWeDecksId(cards, decks);
      case 'deprecated_fields':
        return this.fixDeprecatedFields(cards);
      case 'we_block_migration':
        return this.fixWeBlockMigration(cards);
      case 'duplicate_cards':
        return await this.fixDuplicateCards(cards, decks);
      case 'card_deck_consistency':
        return await this.fixCardDeckConsistency(cards, decks);
      case 'ir_material_consistency':
        return await this.fixIRMaterialConsistency();
      case 'legacy_cleanup':
        return await this.cleanupLegacyDirectories();
      case 'filename_compatibility':
        return await this.fixFilenameCompatibility();
      case 'sync_conflict_files':
        return await this.fixSyncConflictFiles();
      case 'progressive_cloze_unconverted':
        return await this.fixProgressiveClozeUnconverted(cards);
      default:
        return {
          type,
          success: 0,
          failed: 0,
          errors: []
        };
    }
  }

  // ===== 具体检测实�?=====

  /**
   * 检测需�?YAML 迁移的卡�?
   */
  private checkYAMLMigration(cards: Card[]): DataCheckResult {
    const needsMigration: string[] = [];

    for (const card of cards) {
      if (this.cardNeedsYAMLMigration(card)) {
        needsMigration.push(card.uuid);
      }
    }

    return {
      type: 'yaml_migration',
      status: needsMigration.length > 0 ? 'warning' : 'ok',
      count: needsMigration.length,
      items: needsMigration,
      message: needsMigration.length > 0 
        ? `发现 ${needsMigration.length} 张卡片需�?YAML 迁移`
        : '所有卡片已迁移'
    };
  }

  /**
   * 检�?we_decks 中写入牌组ID的卡�?
   */
  private checkWeDecksId(cards: Card[]): DataCheckResult {
    const needsFix: string[] = [];

    for (const card of cards) {
      if (this.cardHasWeDecksId(card)) {
        needsFix.push(card.uuid);
      }
    }

    return {
      type: 'we_decks_fix',
      status: needsFix.length > 0 ? 'warning' : 'ok',
      count: needsFix.length,
      items: needsFix,
      message: needsFix.length > 0 
        ? `发现 ${needsFix.length} 张卡�?we_decks 写入了牌组ID`
        : 'we_decks 数据正常'
    };
  }

  /**
   * 检测卡片中的弃用字�?
   */
  private checkDeprecatedFields(cards: Card[]): DataCheckResult {
    const hasDeprecated: string[] = [];

    for (const card of cards) {
      if (this.cardHasDeprecatedFields(card)) {
        hasDeprecated.push(card.uuid);
      }
    }

    return {
      type: 'deprecated_fields',
      status: hasDeprecated.length > 0 ? 'warning' : 'ok',
      count: hasDeprecated.length,
      items: hasDeprecated,
      message: hasDeprecated.length > 0 
        ? `发现 ${hasDeprecated.length} 张卡片存在弃用字段`
        : 'No deprecated fields'
    };
  }

  /**
   * 检测需�?we_block -> we_source 合并迁移的卡�?
   */
  private checkWeBlockMigration(cards: Card[]): DataCheckResult {
    const needsMigration: string[] = [];

    for (const card of cards) {
      if (card.content && needsSourceMigration(card.content)) {
        needsMigration.push(card.uuid);
      }
    }

    return {
      type: 'we_block_migration',
      status: needsMigration.length > 0 ? 'warning' : 'ok',
      count: needsMigration.length,
      items: needsMigration,
      message: needsMigration.length > 0 
        ? `发现 ${needsMigration.length} 张卡片需要合�?we_block �?we_source`
        : 'we_source 格式正常'
    };
  }

  /**
   * 检测卡�?牌组一致性（引用式牌组数据一致性）
   * 
   * 🔧 P1重构：简化为只检查牌组侧的无效引�?
   * - �?deck.cardUUIDs 为唯一权威数据�?
   * - 只检查牌组中是否存在指向不存在卡片的UUID
   * - 不再检查已废弃�?card.referencedByDecks 字段
   */
  private async checkCardDeckConsistency(cards: Card[], decks: Deck[]): Promise<DataCheckResult> {
    // 构建卡片UUID集合
    const cardUUIDSet = new Set(cards.map(c => c.uuid));
    
    // 统计无效引用
    let invalidDeckRefs = 0;
    const affectedDecks: string[] = [];
    
    for (const deck of decks) {
      let hasInvalidRef = false;
      for (const uuid of (deck.cardUUIDs || [])) {
        if (!cardUUIDSet.has(uuid)) {
          invalidDeckRefs++;
          hasInvalidRef = true;
        }
      }
      if (hasInvalidRef) {
        affectedDecks.push(deck.id);
      }
    }
    
    return {
      type: 'card_deck_consistency',
      status: invalidDeckRefs > 0 ? 'warning' : 'ok',
      count: invalidDeckRefs,
      items: affectedDecks,
      message: invalidDeckRefs > 0 
        ? `发现 ${invalidDeckRefs} 个牌组无效引用（${affectedDecks.length} 个牌组受影响）`
        : 'Deck references are consistent'
    };
  }

  /**
   * 修复卡片-牌组一致�?
   * 
   * 🔧 P1重构：简化为只清理牌组侧的无效引�?
   * - �?deck.cardUUIDs 为唯一权威数据�?
   * - 只清理牌组中指向不存在卡片的UUID
   * - 不再尝试修改已废弃的 card.referencedByDecks 字段（该字段是派生字段，保存时会被剥离）
   */
  private async fixCardDeckConsistency(cards: Card[], decks: Deck[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];
    
    logger.info('[DataManagement] 开始修复牌组无效引�?..');
    
    // 构建卡片UUID集合
    const cardUUIDSet = new Set(cards.map(c => c.uuid));
    
    // 清理牌组中的无效引用
    for (const deck of decks) {
      const originalCount = (deck.cardUUIDs || []).length;
      const validUUIDs = (deck.cardUUIDs || []).filter(uuid => cardUUIDSet.has(uuid));
      const removedCount = originalCount - validUUIDs.length;
      
      if (removedCount > 0) {
        try {
          deck.cardUUIDs = validUUIDs;
          deck.modified = new Date().toISOString();
          await this.plugin.dataStorage.saveDeck(deck);
          success += removedCount;
          logger.debug(`[DataManagement] 清理牌组 ${deck.name} �?${removedCount} 个无效引用`);
        } catch (e) {
          failed += removedCount;
          errors.push({ uuid: deck.id, error: `牌组 ${deck.name}: ${String(e)}` });
        }
      }
    }
    
    logger.info(`[DataManagement] 牌组无效引用修复完成: 清理 ${success} 个无效引�? 失败 ${failed}`);
    
    return {
      type: 'card_deck_consistency',
      success,
      failed,
      errors
    };
  }

  /**
   * 检测孤立卡片（不属于任何牌组）
   */
  private checkOrphanCards(cards: Card[], decks: Deck[]): DataCheckResult {
    const orphans: string[] = [];
    const allDeckCardUUIDs = new Set<string>();

    // 收集所有牌组中的卡片UUID
    for (const deck of decks) {
      if (deck.cardUUIDs) {
        for (const uuid of deck.cardUUIDs) {
          allDeckCardUUIDs.add(uuid);
        }
      }
    }

    for (const card of cards) {
      if (!allDeckCardUUIDs.has(card.uuid)) {
        orphans.push(card.uuid);
      }
    }

    return {
      type: 'orphan_cards',
      status: orphans.length > 0 ? 'warning' : 'ok',
      count: orphans.length,
      items: orphans,
      message: orphans.length > 0 
        ? `发现 ${orphans.length} 张孤立卡片`
        : 'No orphan cards'
    };
  }

  /**
   * 检测内容重复卡片（AnkiConnect同步Bug导致的重复）
   * 
   * 检测逻辑�?
   * 1. 提取每张卡片的内容指纹（去除YAML frontmatter后的纯内容）
   * 2. 按指纹分组，找出内容相同但UUID不同的卡片组
   * 3. 每组中只需保留1张，其余为重�?
   */
  private checkDuplicateCards(cards: Card[]): DataCheckResult {
    const groups = new Map<string, Card[]>();
    
    for (const card of cards) {
      const fp = this.getContentFingerprint(card);
      if (!fp) continue;
      
      if (!groups.has(fp)) {
        groups.set(fp, []);
      }
      groups.get(fp)!.push(card);
    }
    
    const duplicateUUIDs: string[] = [];
    let duplicateGroups = 0;
    
    for (const [, groupCards] of groups) {
      if (groupCards.length <= 1) continue;
      duplicateGroups++;
      // 排序：有学习记录的优先，其次最早创建的
      groupCards.sort((a, b) => this.getCardRetentionScore(b) - this.getCardRetentionScore(a));
      // 第一张保留，其余标记为重�?
      for (let i = 1; i < groupCards.length; i++) {
        duplicateUUIDs.push(groupCards[i].uuid);
      }
    }
    
    return {
      type: 'duplicate_cards',
      status: duplicateUUIDs.length > 0 ? 'warning' : 'ok',
      count: duplicateUUIDs.length,
      items: duplicateUUIDs.slice(0, 200),
      message: duplicateUUIDs.length > 0
        ? `Found ${duplicateUUIDs.length} duplicate cards (${duplicateGroups} groups), usually caused by AnkiConnect sync issues`
        : 'No duplicate cards'
    };
  }

  /**
   * 修复内容重复卡片
   * 
   * 修复逻辑�?
   * 1. 按内容指纹分组，每组保留"最�?卡片（有FSRS学习记录 > 有复习记�?> 最早创建）
   * 2. 删除重复卡片
   * 3. 更新牌组 cardUUIDs：将重复UUID替换为保留的UUID
   */
  private async fixDuplicateCards(cards: Card[], decks: Deck[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];
    
    logger.info('[DataManagement] 开始修复内容重复卡�?..');
    
    // 1. 按内容指纹分�?
    const groups = new Map<string, Card[]>();
    for (const card of cards) {
      const fp = this.getContentFingerprint(card);
      if (!fp) continue;
      if (!groups.has(fp)) groups.set(fp, []);
      groups.get(fp)!.push(card);
    }
    
    // 2. 找出需要删除的重复卡片，建�?UUID 重映�?
    const uuidRemapping = new Map<string, string>(); // removedUUID -> keptUUID
    const toDelete: string[] = [];
    
    for (const [, groupCards] of groups) {
      if (groupCards.length <= 1) continue;
      groupCards.sort((a, b) => this.getCardRetentionScore(b) - this.getCardRetentionScore(a));
      const kept = groupCards[0];
      for (let i = 1; i < groupCards.length; i++) {
        toDelete.push(groupCards[i].uuid);
        uuidRemapping.set(groupCards[i].uuid, kept.uuid);
      }
    }
    
    if (toDelete.length === 0) {
      logger.info('[DataManagement] No duplicate cards to fix');
      return { type: 'duplicate_cards', success: 0, failed: 0, errors: [] };
    }
    
    logger.info(`[DataManagement] 发现 ${toDelete.length} 张重复卡片待删除`);
    
    // 3. 删除重复卡片
    for (const uuid of toDelete) {
      try {
        const deleted = await this.plugin.dataStorage.deleteCard(uuid);
        if (deleted.success) {
          success++;
        } else {
          failed++;
          errors.push({ uuid, error: deleted.error || '删除失败' });
        }
      } catch (e) {
        failed++;
        errors.push({ uuid, error: String(e) });
      }
    }
    
    // 4. 更新牌组 cardUUIDs：替换已删除UUID为保留的UUID
    const keptUUIDs = new Set(cards.filter(c => !uuidRemapping.has(c.uuid)).map(c => c.uuid));
    for (const deck of decks) {
      const originalUUIDs = deck.cardUUIDs || [];
      if (originalUUIDs.length === 0) continue;
      
      const newUUIDs = new Set<string>();
      let changed = false;
      
      for (const uuid of originalUUIDs) {
        if (uuidRemapping.has(uuid)) {
          // 替换为保留卡片的UUID
          const replacement = uuidRemapping.get(uuid)!;
          newUUIDs.add(replacement);
          changed = true;
        } else if (keptUUIDs.has(uuid)) {
          newUUIDs.add(uuid);
        } else {
          // 不在任何卡片中的无效引用，丢�?
          changed = true;
        }
      }
      
      if (changed) {
        try {
          deck.cardUUIDs = Array.from(newUUIDs);
          deck.modified = new Date().toISOString();
          await this.plugin.dataStorage.saveDeck(deck);
          logger.debug(`[DataManagement] 更新牌组 ${deck.name} 的卡片引用`);
        } catch (e) {
          errors.push({ uuid: deck.id, error: `更新牌组失败: ${String(e)}` });
        }
      }
    }
    
    logger.info(`[DataManagement] 重复卡片修复完成: 删除 ${success} 张，失败 ${failed}`);
    
    return { type: 'duplicate_cards', success, failed, errors };
  }

  /**
   * 提取卡片内容指纹（去除YAML frontmatter后标准化�?
   * 使用完整内容的哈希值，避免截断导致不同卡片误判为重�?
   */
  private getContentFingerprint(card: Card): string {
    const content = card.content || '';
    if (!content.trim()) return '';
    // 去除 YAML frontmatter
    const stripped = content.replace(/^---[\s\S]*?---\s*/, '').trim();
    // 标准化空�?
    const normalized = stripped.replace(/\s+/g, ' ');
    if (!normalized) return '';
    // 使用简单哈希生成固定长度指�?
    return this.simpleHash(normalized);
  }

  /**
   * 简单字符串哈希（djb2 算法），用于内容指纹
   */
  private simpleHash(str: string): string {
    let hash1 = 5381;
    let hash2 = 52711;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1 + ch) >>> 0;
      hash2 = ((hash2 << 5) + hash2 + ch) >>> 0;
    }
    return (hash1 >>> 0).toString(36) + '_' + (hash2 >>> 0).toString(36) + '_' + str.length;
  }

  /**
   * 评估卡片保留优先分数（分数越高越应保留）
   */
  private getCardRetentionScore(card: Card): number {
    let score = 0;
    const cardAny = card as any;
    
    // 有FSRS状态且非new的卡片最有价�?
    if (cardAny.fsrs && cardAny.fsrs.state !== undefined && cardAny.fsrs.state > 0) {
      score += 10000;
    }
    
    // 有复习记�?
    if (Array.isArray(cardAny.reviewLog) && cardAny.reviewLog.length > 0) {
      score += 5000 + cardAny.reviewLog.length;
    }
    
    // 有学习状态（从YAML解析�?
    const content = card.content || '';
    const weStatus = content.match(/we_status:\s*"?(\w+)"?/);
    if (weStatus && weStatus[1] !== 'new') {
      score += 3000;
    }
    
    // 有YAML frontmatter（更完整的数据）
    if (content.startsWith('---')) {
      score += 100;
    }
    
    // 更早创建的优�?
    let created = 0;
    if (card.created) {
      if (typeof card.created === 'number') {
        created = card.created;
      } else if (typeof card.created === 'string') {
        created = new Date(card.created).getTime();
      }
    }
    if (created > 0) {
      score += Math.max(0, (1900000000 - created / 1000));
    }
    
    return score;
  }

  // ===== 具体修复实现 =====

  /**
   * 修复 YAML 迁移
   */
  private async fixYAMLMigration(cards: Card[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    for (const card of cards) {
      if (!this.cardNeedsYAMLMigration(card)) continue;

      try {
        const migratedCard = this.migrateCardToYAML(card);
        const result = await this.plugin.dataStorage.saveCard(migratedCard);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push({ uuid: card.uuid, error: result.error || '保存失败' });
        }
      } catch (e) {
        failed++;
        errors.push({ uuid: card.uuid, error: String(e) });
      }
    }

    logger.info(`[DataManagement] YAML迁移完成: 成功 ${success}, 失败 ${failed}`);

    return {
      type: 'yaml_migration',
      success,
      failed,
      errors
    };
  }

  /**
   * 修复 we_decks 中的牌组ID
   */
  private async fixWeDecksId(cards: Card[], decks: Deck[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    logger.info(`[DataManagement] 开始修�?we_decks，共 ${cards.length} 张卡片，${decks.length} 个牌组`);

    for (const card of cards) {
      if (!this.cardHasWeDecksId(card)) continue;

      try {
        const fixedCard = this.fixCardWeDecksId(card, decks);
        if (fixedCard) {
          // 验证修复结果
          const oldYAML = parseYAMLFromContent(card.content || '');
          const newYAML = parseYAMLFromContent(fixedCard.content || '');
          logger.debug(`[DataManagement] 修复卡片 ${card.uuid}:`, {
            old_we_decks: oldYAML.we_decks,
            new_we_decks: newYAML.we_decks
          });

          const result = await this.plugin.dataStorage.saveCard(fixedCard);
          if (result.success) {
            // 验证保存结果
            if (result.data) {
              const savedYAML = parseYAMLFromContent(result.data.content || '');
              logger.debug(`[DataManagement] 保存后验�?${card.uuid}:`, {
                saved_we_decks: savedYAML.we_decks
              });
            }
            success++;
          } else {
            failed++;
            errors.push({ uuid: card.uuid, error: result.error || '保存失败' });
            logger.error(`[DataManagement] 保存失败: ${card.uuid}`, result.error);
          }
        }
      } catch (e) {
        failed++;
        errors.push({ uuid: card.uuid, error: String(e) });
        logger.error(`[DataManagement] 修复异常: ${card.uuid}`, e);
      }
    }

    logger.info(`[DataManagement] we_decks修复完成: 成功 ${success}, 失败 ${failed}`);

    return {
      type: 'we_decks_fix',
      success,
      failed,
      errors
    };
  }

  /**
   * 清理弃用字段
   */
  private async fixDeprecatedFields(cards: Card[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    for (const card of cards) {
      if (!this.cardHasDeprecatedFields(card)) continue;

      try {
        const cleanedCard = this.cleanDeprecatedFields(card);
        const result = await this.plugin.dataStorage.saveCard(cleanedCard);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push({ uuid: card.uuid, error: result.error || '保存失败' });
        }
      } catch (e) {
        failed++;
        errors.push({ uuid: card.uuid, error: String(e) });
      }
    }

    logger.info(`[DataManagement] 弃用字段清理完成: 成功 ${success}, 失败 ${failed}`);

    return {
      type: 'deprecated_fields',
      success,
      failed,
      errors
    };
  }

  /**
   * 修复 we_block -> we_source 合并迁移
   */
  private async fixWeBlockMigration(cards: Card[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    logger.info(`[DataManagement] 开始合�?we_block �?we_source...`);

    for (const card of cards) {
      if (!card.content || !needsSourceMigration(card.content)) continue;

      try {
        const migrationResult = migrateSourceFields(card.content);
        
        if (migrationResult.migrated) {
          const updatedCard = {
            ...card,
            content: migrationResult.content,
            modified: new Date().toISOString()
          };
          
          const result = await this.plugin.dataStorage.saveCard(updatedCard);
          if (result.success) {
            success++;
            logger.debug(`[DataManagement] �?we_block 合并成功: ${card.uuid}`);
          } else {
            failed++;
            errors.push({ uuid: card.uuid, error: result.error || '保存失败' });
          }
        }
      } catch (e) {
        failed++;
        errors.push({ uuid: card.uuid, error: String(e) });
      }
    }

    logger.info(`[DataManagement] we_block 合并完成: 成功 ${success}, 失败 ${failed}`);

    return {
      type: 'we_block_migration',
      success,
      failed,
      errors
    };
  }

  // ===== 辅助方法 =====

  /**
   * 检测卡片是否需�?YAML 迁移
   */
  private cardNeedsYAMLMigration(card: Card): boolean {
    // 有旧字段但没有对应的 YAML 字段
    if (!card.content) return false;

    try {
      const yaml = parseYAMLFromContent(card.content);
      
      // 检查是否有旧字段但没有迁移�?YAML
      const hasOldSource = card.sourceFile || card.sourceBlock;
      const hasYAMLSource = yaml.we_source;
      
      const hasOldType = card.type;
      const hasYAMLType = yaml.we_type;

      return (hasOldSource && !hasYAMLSource) || (!!hasOldType && !hasYAMLType);
    } catch {
      return false;
    }
  }

  /**
   * 检测卡�?we_decks 是否包含牌组ID
   */
  private cardHasWeDecksId(card: Card): boolean {
    if (!card.content) return false;

    try {
      const yaml = parseYAMLFromContent(card.content);
      if (!yaml.we_decks || yaml.we_decks.length === 0) return false;

      // 检查是否有 deck_ 开头的值（牌组ID格式�?
      return yaml.we_decks.some((value: string) => value.startsWith('deck_'));
    } catch {
      return false;
    }
  }

  /**
   * 检测卡片是否有弃用字段
   * 注意：只检测真正需要删除的字段，不检测派生字�?
   */
  private cardHasDeprecatedFields(card: Card): boolean {
    const cardAny = card as any;
    
    // 只检查需要删除的字段
    for (const field of DEPRECATED_FIELDS_TO_DELETE) {
      if (cardAny[field] !== undefined) return true;
    }

    return false;
  }

  /**
   * 迁移卡片�?YAML 格式
   */
  private migrateCardToYAML(card: Card): Card {
    const metadata: CardYAMLMetadata = {};

    // 迁移 sourceFile + sourceBlock -> we_source
    if (card.sourceFile) {
      const fileName = card.sourceFile.replace(/\.md$/, '');
      const blockId = card.sourceBlock?.replace(/^\^/, '');
      
      if (blockId) {
        metadata.we_source = `![[${fileName}#^${blockId}]]`;
      } else {
        metadata.we_source = `[[${fileName}]]`;
      }
    }

    // 迁移 type -> we_type
    if (card.type) {
      metadata.we_type = card.type as any;
    }

    // 迁移 priority -> we_priority
    if (card.priority !== undefined) {
      metadata.we_priority = card.priority;
    }

    // 迁移 tags
    if (card.tags && card.tags.length > 0) {
      metadata.tags = card.tags;
    }

    const newContent = setCardProperties(card.content, metadata);

    return {
      ...card,
      content: newContent,
      modified: new Date().toISOString()
    };
  }

  /**
   * 修复卡片 we_decks 中的牌组ID
   */
  private fixCardWeDecksId(card: Card, decks: Deck[]): Card | null {
    if (!card.content) return null;

    try {
      const yaml = parseYAMLFromContent(card.content);
      if (!yaml.we_decks || yaml.we_decks.length === 0) return null;

      const fixedDeckNames: string[] = [];
      let needsFix = false;

      for (const value of yaml.we_decks) {
        if (value.startsWith('deck_')) {
          needsFix = true;
          const matchedDeck = decks.find(d => d.id === value);
          if (matchedDeck) {
            fixedDeckNames.push(matchedDeck.name);
          } else {
            logger.warn(`[DataManagement] 牌组ID "${value}" 找不到对应牌组，已移除`);
          }
        } else {
          fixedDeckNames.push(value);
        }
      }

      if (!needsFix) return null;

      // 无论 fixedDeckNames 是否为空，都需要更�?we_decks
      // 如果为空，表示所有牌组ID都找不到对应牌组，清�?we_decks
      // 使用 undefined 可以�?setCardProperties 中删除该字段
      const newContent = setCardProperties(card.content, { 
        we_decks: fixedDeckNames.length > 0 ? fixedDeckNames : undefined 
      });

      return {
        ...card,
        content: newContent,
        modified: new Date().toISOString()
      };
    } catch (e) {
      logger.error(`[DataManagement] 修复 we_decks 失败: ${e}`);
      return null;
    }
  }

  /**
   * 清理卡片中的弃用字段
   */
  private cleanDeprecatedFields(card: Card): Card {
    const cleanedCard = { ...card } as any;

    // 删除需要删除的字段
    for (const field of DEPRECATED_FIELDS_TO_DELETE) {
      delete cleanedCard[field];
    }

    // 标记为已修改
    cleanedCard.modified = new Date().toISOString();

    return cleanedCard as Card;
  }

  // ===== 导入材料一致性检�?(v2.1 新增) =====
  
  /**
   * 检测导入材料一致�?
   * 
   * 检测项�?
   * 1. materials.json 中记录的文件是否实际存在
   * 2. blocks.json 中内容块的源文件是否存在
   * 3. IR牌组中的 blockIds 是否都有�?
   */
  private async checkIRMaterialConsistency(): Promise<DataCheckResult> {
    const issues: string[] = [];
    let orphanedMaterials = 0;
    let orphanedBlocks = 0;
    let orphanedDeckRefs = 0;
    
    try {
      // 1. 检�?materials.json 中的残留记录
      if (this.plugin.readingMaterialManager) {
        const storage = (this.plugin.readingMaterialManager as any).storage;
        if (storage) {
          await storage.initialize();
          const allMaterials = await storage.getAllMaterials();
          
          for (const material of allMaterials) {
            const file = this.plugin.app.vault.getAbstractFileByPath(material.filePath);
            if (!file) {
              orphanedMaterials++;
              issues.push(`材料记录无效: ${material.filePath}`);
            }
          }
        }
      }
      
      // 2. 检测IR存储服务中的孤立内容块（只检测不清理�?
      const irStorageService = await this.getIRStorageService();
      if (irStorageService) {
        // 检测孤立内容块（源文件已删除的内容块）
        const orphanedBlockIds = await irStorageService.findOrphanedBlocks();
        orphanedBlocks = orphanedBlockIds.length;
        if (orphanedBlocks > 0) {
          issues.push(`孤立内容�? ${orphanedBlocks} 个`);
        }
        // 注意: 检测模式不调用 validateAndCleanOrphanedReferences，避免自动清�?
      }
      
    } catch (error) {
      logger.error('[DataManagement] 检测导入材料一致性失�?', error);
      issues.push(`检测失�? ${error instanceof Error ? error.message : String(error)}`);
    }
    
    const totalIssues = orphanedMaterials + orphanedBlocks;
    
    return {
      type: 'ir_material_consistency',
      status: totalIssues > 0 ? 'warning' : 'ok',
      count: totalIssues,
      items: issues,
      message: totalIssues > 0 
        ? `Found ${totalIssues} consistency issues (materials: ${orphanedMaterials}, blocks: ${orphanedBlocks})`
        : 'IR material data is consistent'
    };
  }
  
  /**
   * 修复导入材料一致性问�?
   * 
   * 修复操作:
   * 1. 清理 materials.json 中的残留记录
   * 2. 清理 blocks.json 中的孤立内容�?
   * 3. 清理 IR牌组中的无效引用
   */
  private async fixIRMaterialConsistency(): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];
    
    try {
      // 1. 清理 materials.json 中的残留记录
      if (this.plugin.readingMaterialManager) {
        const storage = (this.plugin.readingMaterialManager as any).storage;
        if (storage) {
          await storage.initialize();
          const allMaterials = await storage.getAllMaterials();
          
          for (const material of allMaterials) {
            const file = this.plugin.app.vault.getAbstractFileByPath(material.filePath);
            if (!file) {
              try {
                await storage.deleteMaterial(material.uuid);
                success++;
                logger.debug(`[DataManagement] 清理残留材料记录: ${material.uuid}`);
              } catch (e) {
                failed++;
                errors.push({ uuid: material.uuid, error: String(e) });
              }
            }
          }
        }
      }
      
      // 2. 清理孤立内容块和牌组无效引用
      const irStorageService = await this.getIRStorageService();
      if (irStorageService) {
        // 清理孤立内容块（级联删除会自动清理牌组引用）
        const cleanedBlocks = await irStorageService.cleanOrphanedBlocks();
        success += cleanedBlocks;
        
        // 校验并清理牌组中的悬空引�?
        const validationResult = await irStorageService.validateAndCleanOrphanedReferences();
        success += validationResult.orphanedBlockIds + validationResult.orphanedSourceFiles;
      }
      
      logger.info(`[DataManagement] 导入材料一致性修复完�? 成功 ${success}, 失败 ${failed}`);
      
    } catch (error) {
      logger.error('[DataManagement] 修复导入材料一致性失�?', error);
      failed++;
      errors.push({ uuid: 'ir_material_consistency', error: String(error) });
    }
    
    return {
      type: 'ir_material_consistency',
      success,
      failed,
      errors
    };
  }
  
  // ===== 文件名云同步兼容性检�?修复 =====

  /**
   * 检测文件名云同步兼容性问�?
   * 
   * 扫描 weave/ 数据目录下所有文件和子目录名称，检测：
   * - Emoji 字符
   * - 全角标点
   * - 方括�?[]
   * - 超长路径
   * - 无扩展名的标记文�?
   * - 其它不安全字�?
   */
  private async checkFilenameCompatibility(): Promise<DataCheckResult> {
    const issues: string[] = [];

    try {
      const adapter = this.plugin.app.vault.adapter as any;
      const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
      const v2Paths = getV2Paths(parentFolder);
      const root = v2Paths.root;

      if (!(await adapter.exists(root))) {
        return {
          type: 'filename_compatibility',
          status: 'ok',
          count: 0,
          items: [],
          message: 'Data directory does not exist, no check needed'
        };
      }

      // 递归扫描目录（只检测每个路径的最后一段，避免重复计数�?
      const scanDir = async (dir: string, depth: number): Promise<void> => {
        if (depth > 8) return;
        try {
          const listing = await adapter.list(dir);
          const files: string[] = listing?.files || [];
          const folders: string[] = listing?.folders || [];

          for (const filePath of files) {
            const fileName = filePath.split('/').pop() || '';
            if (!fileName) continue;
            const diag = diagnoseFilename(fileName, true, filePath.length);
            const fixableIssues = diag.issues.filter(i => i !== 'path_too_long');
            if (fixableIssues.length > 0) {
              const issueLabels = fixableIssues.map(i => this.getSyncIssueLabel(i)).join(', ');
              issues.push(`${filePath} [${issueLabels}]`);
            }
          }

          for (const folderPath of folders) {
            const folderName = folderPath.split('/').pop() || '';
            if (folderName) {
              const diag = diagnoseFilename(folderName, false, folderPath.length);
              const fixableIssues = diag.issues.filter(i => i !== 'path_too_long');
              if (fixableIssues.length > 0) {
                const issueLabels = fixableIssues.map(i => this.getSyncIssueLabel(i)).join(', ');
                issues.push(`${folderPath}/ [${issueLabels}]`);
              }
            }
            await scanDir(folderPath, depth + 1);
          }
        } catch (error) {
          logger.debug(`[DataManagement] 扫描目录失败: ${dir}`, error);
        }
      };

      await scanDir(root, 0);

    } catch (error) {
      logger.error('[DataManagement] 文件名兼容性检测失�?', error);
      issues.push(`检测失�? ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      type: 'filename_compatibility',
      status: issues.length > 0 ? 'warning' : 'ok',
      count: issues.length,
      items: issues.slice(0, 50),
      message: issues.length > 0
        ? `Found ${issues.length} file or directory names incompatible with cloud sync`
        : 'All file names are cloud-sync compatible'
    };
  }

  /**
   * 修复文件名云同步兼容性问�?
   * 
   * 对不兼容的文�?目录执行安全重命�?
   */
  private async fixFilenameCompatibility(): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    try {
      const adapter = this.plugin.app.vault.adapter as any;
      const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
      const v2Paths = getV2Paths(parentFolder);
      const root = v2Paths.root;

      if (!(await adapter.exists(root))) {
        return { type: 'filename_compatibility', success: 0, failed: 0, errors: [] };
      }

      // 收集需要重命名的路径（只检测最后一段名称，保持父路径不变）
      const fileRenames: Array<{ oldPath: string; newPath: string }> = [];
      const folderRenames: Array<{ oldPath: string; newPath: string; depth: number }> = [];

      const scanDir = async (dir: string, depth: number): Promise<void> => {
        if (depth > 8) return;
        try {
          const listing = await adapter.list(dir);
          const files: string[] = listing?.files || [];
          const folders: string[] = listing?.folders || [];

          for (const filePath of files) {
            const segments = filePath.split('/');
            const fileName = segments[segments.length - 1];
            if (!fileName) continue;
            const diag = diagnoseFilename(fileName, true, filePath.length);
            const fixableIssues = diag.issues.filter(i => i !== 'path_too_long');
            if (fixableIssues.length > 0) {
              // 只替换最后一段，保持父路径不�?
              const parentPath = segments.slice(0, -1).join('/');
              const newPath = parentPath ? `${parentPath}/${diag.suggested}` : diag.suggested;
              fileRenames.push({ oldPath: filePath, newPath });
            }
          }

          for (const folderPath of folders) {
            // 先递归子目录（深层先处理）
            await scanDir(folderPath, depth + 1);

            const segments = folderPath.split('/');
            const folderName = segments[segments.length - 1];
            if (!folderName) continue;
            const diag = diagnoseFilename(folderName, false, folderPath.length);
            const fixableIssues = diag.issues.filter(i => i !== 'path_too_long');
            if (fixableIssues.length > 0) {
              const parentPath = segments.slice(0, -1).join('/');
              const newPath = parentPath ? `${parentPath}/${diag.suggested}` : diag.suggested;
              folderRenames.push({ oldPath: folderPath, newPath, depth });
            }
          }
        } catch (error) {
          logger.debug(`[DataManagement] 扫描目录失败: ${dir}`, error);
        }
      };

      await scanDir(root, 0);

      // 1. 先重命名文件（文件重命名不影响其他路径）
      for (const item of fileRenames) {
        try {
          if (await adapter.exists(item.newPath)) {
            logger.warn(`[DataManagement] 目标路径已存在，跳过: ${item.newPath}`);
            errors.push({ uuid: item.oldPath, error: `目标路径已存�? ${item.newPath}` });
            failed++;
            continue;
          }
          await adapter.rename(item.oldPath, item.newPath);
          success++;
          logger.info(`[DataManagement] 重命名文�? ${item.oldPath} �?${item.newPath}`);
        } catch (error) {
          failed++;
          errors.push({ uuid: item.oldPath, error: String(error) });
          logger.warn(`[DataManagement] 重命名文件失�? ${item.oldPath}`, error);
        }
      }

      // 2. 再重命名目录（按深度从深到浅，避免父目录先改名导致子路径失效�?
      folderRenames.sort((a, b) => b.depth - a.depth);
      for (const item of folderRenames) {
        try {
          if (await adapter.exists(item.newPath)) {
            logger.warn(`[DataManagement] 目标路径已存在，跳过: ${item.newPath}`);
            errors.push({ uuid: item.oldPath, error: `目标路径已存�? ${item.newPath}` });
            failed++;
            continue;
          }
          await adapter.rename(item.oldPath, item.newPath);
          success++;
          logger.info(`[DataManagement] 重命名目�? ${item.oldPath} �?${item.newPath}`);
        } catch (error) {
          failed++;
          errors.push({ uuid: item.oldPath, error: String(error) });
          logger.warn(`[DataManagement] 重命名目录失�? ${item.oldPath}`, error);
        }
      }

      if (success > 0) {
        logger.info(`[DataManagement] 文件名兼容性修复完�? 成功 ${success}, 失败 ${failed}`);
      }

    } catch (error) {
      logger.error('[DataManagement] 文件名兼容性修复失�?', error);
      failed++;
      errors.push({ uuid: 'filename_compatibility', error: String(error) });
    }

    return {
      type: 'filename_compatibility',
      success,
      failed,
      errors
    };
  }

  /**
   * 获取同步问题类型的中文标�?
   */
  private getSyncIssueLabel(type: SyncIssueType): string {
    const labels: Record<SyncIssueType, string> = {
      'emoji': 'Emoji',
      'fullwidth_punctuation': '全角标点',
      'square_brackets': 'square brackets',
      'path_too_long': '路径过长',
      'no_extension': '无扩展名',
      'unsafe_chars': 'unsafe chars',
      'leading_dot': 'leading dot'
    };
    return labels[type] || type;
  }

  /**
   * 获取IR存储服务实例
   */
  private async getIRStorageService(): Promise<any> {
    try {
      // 直接导入并创建IR存储服务实例
      const { IRStorageService } = await import('../incremental-reading/IRStorageService');
      const storageService = new IRStorageService(this.plugin.app);
      await storageService.initialize();
      return storageService;
    } catch (error) {
      logger.debug('[DataManagement] 无法获取IR存储服务:', error);
      return null;
    }
  }

  /**
   * 获取检测类型的中文名称
   */
  private getCheckName(type: CheckType): string {
    const names: Record<CheckType, string> = {
      'yaml_migration': 'YAML metadata migration',
      'we_decks_fix': 'we_decks 牌组ID',
      'we_block_migration': 'we_block 合并迁移',
      'deprecated_fields': '弃用字段',
      'card_deck_consistency': 'reference deck consistency',
      'ir_material_consistency': 'import material consistency',
      'orphan_cards': '孤立卡片',
      'duplicate_cards': '重复卡片',
      'invalid_refs': '无效引用',
      'schema_migration': 'Schema V2 数据迁移',
      'structure_check': '目录结构核对',
      'legacy_cleanup': 'legacy cleanup',
      'filename_compatibility': 'filename cloud-sync compatibility',
      'sync_conflict_files': 'cloud sync conflict copies',
      'progressive_cloze_unconverted': 'unconverted progressive cloze',
      'progressive_cloze_orphan': 'orphan progressive child cards',
      'progressive_cloze_missing_children': '缺失的子卡片',
      'progressive_cloze_extra_children': '多余的子卡片'
    };
    return names[type] || type;
  }

  // ===== 数据迁移相关 =====

  async getLatestMigrationPlan(): Promise<DataMigrationPlan | null> {
    return this.getMigrationService().getLatestPlan();
  }

  async getLatestMigrationReport(): Promise<DataMigrationReport | null> {
    return this.getMigrationService().getLatestReport();
  }

  async planUnifiedMigration(
    requestedParentFolder?: string,
    reason: 'startup-auto' | 'manual-review' | 'change-parent-folder' = 'manual-review',
  ): Promise<DataMigrationPlan> {
    return this.getMigrationService().planDataMigration({
      requestedParentFolder,
      reason,
    });
  }

  /**
   * 检测是否需要数据迁�?   */
  async checkSchemaMigration(): Promise<DataCheckResult> {
    try {
      const plan = await this.planUnifiedMigration(undefined, 'manual-review');
      
      return {
        type: 'schema_migration',
        status: plan.requiresMigration ? 'warning' : 'ok',
        count: plan.requiresMigration ? Math.max(plan.activeSourceRoots.length, 1) : 0,
        items: plan.activeSourceRoots.map(root => `${root.kind}: ${root.path}`),
        message: plan.requiresMigration ? 'Pending migration data sources detected' : 'Current data path and structure are normalized'
      };
    } catch (error) {
      logger.error('[DataManagement] 迁移检测失�?', error);
      return {
        type: 'schema_migration',
        status: 'error',
        count: 0,
        items: [],
        message: `迁移检查失�? ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 执行统一数据迁移
   */
  async executeSchemaMigration(): Promise<DataFixResult> {
    try {
      const migrationService = this.getMigrationService();
      const plan = await migrationService.planDataMigration({ reason: 'manual-review' });
      const result = await migrationService.executeDataMigration(plan);
      await this.plugin.saveSettings();
      
      return {
        type: 'schema_migration',
        success: result.movedFiles,
        failed: result.errors.length,
        errors: result.errors.map(e => ({ uuid: '', error: e }))
      };
    } catch (error) {
      logger.error('[DataManagement] 迁移执行失败:', error);
      return {
        type: 'schema_migration',
        success: 0,
        failed: 1,
        errors: [{ uuid: '', error: error instanceof Error ? error.message : String(error) }]
      };
    }
  }

  /**
   * 检测目录结构是否符�?V2 规范
   */
  async checkStructure(): Promise<DataCheckResult> {
    const adapter = this.plugin.app.vault.adapter;
    const issues: string[] = [];

    const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
    const v2Paths = getV2Paths(parentFolder);

    // 预期�?V2 目录结构
    const expectedDirs = [
      v2Paths.memory.root,
      v2Paths.memory.cards,
      v2Paths.memory.learning.root,
      v2Paths.ir.root,
      v2Paths.questionBank.root
    ];
    
    for (const dir of expectedDirs) {
      if (!(await adapter.exists(dir))) {
        issues.push(`缺少目录: ${dir}`);
      }
    }

    const irImportFolder = resolveIRImportFolder(
      this.plugin.settings?.incrementalReading?.importFolder,
      this.plugin.settings?.weaveParentFolder
    );
    if (irImportFolder === '.weave' || irImportFolder.startsWith('.weave/')) {
      issues.push(`导入材料存储文件夹不应位于隐藏目�? ${irImportFolder}`);
    }

    // 检�?IR 导入文件夹不应位于内部数据子目录（memory/cards, question-bank 等）
    const internalDirs = [v2Paths.memory.cards, v2Paths.memory.learning.root, v2Paths.questionBank.root];
    for (const intDir of internalDirs) {
      if (irImportFolder === intDir || irImportFolder.startsWith(`${intDir}/`)) {
        issues.push(`导入材料存储文件夹不应位于内部数据目�? ${irImportFolder}`);
        break;
      }
    }
    
    return {
      type: 'structure_check',
      status: issues.length > 0 ? 'warning' : 'ok',
      count: issues.length,
      items: issues,
      message: issues.length > 0 
        ? `目录结构不完整，缺少 ${issues.length} 个目录`
        : '目录结构完整'
    };
  }

  /**
   * 修复目录结构：创建缺失的目录
   */
  async fixStructure(): Promise<DataFixResult> {
    const adapter = this.plugin.app.vault.adapter;
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
    const v2Paths = getV2Paths(parentFolder);

    const expectedDirs = [
      v2Paths.memory.root,
      v2Paths.memory.cards,
      v2Paths.memory.learning.root,
      v2Paths.ir.root,
      v2Paths.questionBank.root
    ];

    for (const dir of expectedDirs) {
      if (!(await adapter.exists(dir))) {
        try {
          const { DirectoryUtils } = await import('../../utils/directory-utils');
          await DirectoryUtils.ensureDirRecursive(adapter, dir);
          success++;
          logger.info(`[DataManagement] 创建缺失目录: ${dir}`);
        } catch (error) {
          failed++;
          errors.push({ uuid: dir, error: String(error) });
        }
      }
    }

    return { type: 'structure_check', success, failed, errors };
  }

  /**
   * 检测旧目录
   */
  async checkLegacyDirectories(): Promise<DataCheckResult> {
    const adapter = this.plugin.app.vault.adapter;
    const legacyDirs: string[] = [];

    const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
    
    const v2Paths = getV2Paths(parentFolder);

    // 旧版本可能存在的目录（不包含当前活跃目录�?
    const possibleLegacyDirs = [
      LEGACY_DOT_TUANKI,
      // v1.x 旧路�?
      'weave/flashcards',
      'weave/decks',
      'weave/cards',
      'weave/_shared',
      'weave/indices',
      'weave/learning',
      'weave/reading-materials',
      'weave/temp',
      'weave/sessions',
      'weave/weave_media',
      `${v2Paths.root}/_migration_conflicts`,
      // v2.x _data/ 中间层旧路径
      `${v2Paths.root}/_data`,
      `${v2Paths.root}/_data/memory`,
      `${v2Paths.root}/_data/incremental-reading`,
      `${v2Paths.root}/_data/question-bank`,
      `${v2Paths.root}/_data/profile`,
      `${v2Paths.root}/_data/decks`,
      // v2.x �?IR 位置（现在应�?incremental-reading/IR 下）
      `${v2Paths.root}/IR`,
      // 隐藏文件/标记
      `${v2Paths.root}/.temp`,
    ];

    if (parentFolder) {
      possibleLegacyDirs.push(`${parentFolder}/${LEGACY_DOT_TUANKI}`);
    }
    
    for (const dir of possibleLegacyDirs) {
      if (await adapter.exists(dir)) {
        legacyDirs.push(dir);
      }
    }
    
    return {
      type: 'legacy_cleanup',
      status: legacyDirs.length > 0 ? 'warning' : 'ok',
      count: legacyDirs.length,
      items: legacyDirs,
      message: legacyDirs.length > 0 
        ? `发现 ${legacyDirs.length} 个旧目录可清理`
        : '无旧目录'
    };
  }

  /**
   * 清理旧目�?
   */
  async cleanupLegacyDirectories(): Promise<DataFixResult> {
    const adapter = this.plugin.app.vault.adapter;
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    const tryRemoveRecursive = async (dir: string, depth: number): Promise<boolean> => {
      if (depth <= 0) return false;
      try {
        if (!(await adapter.exists(dir))) return true;

        const listing = await (adapter as any).list(dir);
        const files: string[] = listing?.files || [];
        const folders: string[] = listing?.folders || [];

        // 先递归删除子目�?
        for (const folder of folders) {
          await tryRemoveRecursive(folder, depth - 1);
        }

        // 删除文件
        for (const file of files) {
          try {
            await adapter.remove(file);
          } catch {
            logger.debug(`[DataManagement] 删除旧文件失�? ${file}`);
          }
        }

        // 最后删除目录本�?
        try {
          await adapter.rmdir(dir, false);
          return true;
        } catch {
          // 再尝试强制删�?
          try {
            await adapter.rmdir(dir, true);
            return true;
          } catch {
            return false;
          }
        }
      } catch {
        return false;
      }
    };
    
    const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
    const v2Paths = getV2Paths(parentFolder);

    try {
      const imported = await this.importMigrationConflicts(v2Paths);
      if (imported.importedCards > 0 || imported.importedDecks > 0) {
        success += 1;
      }
      for (const e of imported.errors) {
        errors.push({ uuid: `${v2Paths.root}/_migration_conflicts`, error: e });
      }
    } catch (error) {
      failed += 1;
      errors.push({ uuid: `${v2Paths.root}/_migration_conflicts`, error: String(error) });
    }

    try {
      const cardCleanup = await this.cleanupEmptyCardFiles(v2Paths);
      if (cardCleanup.deleted > 0 || cardCleanup.merged > 0) {
        success += 1;
      }
      for (const e of cardCleanup.errors) {
        errors.push({ uuid: 'card_files_cleanup', error: e });
      }
    } catch (error) {
      failed += 1;
      errors.push({ uuid: 'card_files_cleanup', error: String(error) });
    }

    try {
      const manifestRenamed = await this.renameDotManifestFiles(v2Paths);
      if (manifestRenamed > 0) {
        success += 1;
      }
    } catch (error) {
      errors.push({ uuid: 'manifest_rename', error: String(error) });
    }

    // 迁移 weave/media/ �?weave/memory/media/（v3.0 媒体归属 memory 模块�?
    try {
      const oldMediaDir = `${v2Paths.root}/media`;
      const newMediaDir = v2Paths.memory.media;
      if (await adapter.exists(oldMediaDir)) {
        const stat = await adapter.stat(oldMediaDir);
        if (stat && stat.type === 'folder') {
          if (!(await adapter.exists(newMediaDir))) {
            const { DirectoryUtils } = await import('../../utils/directory-utils');
            await DirectoryUtils.ensureDirRecursive(adapter, newMediaDir);
          }
          const listing = await (adapter as any).list(oldMediaDir);
          const items = [...(listing.files || []), ...(listing.folders || [])];
          for (const item of items) {
            const name = item.split('/').pop() || '';
            if (!name) continue;
            const dest = `${newMediaDir}/${name}`;
            if (!(await adapter.exists(dest))) {
              try {
                await (adapter as any).rename(item, dest);
                success++;
                logger.info(`[DataManagement] 迁移媒体: ${item} �?${dest}`);
              } catch (e) {
                errors.push({ uuid: item, error: String(e) });
              }
            }
          }
        }
      }
    } catch (error) {
      errors.push({ uuid: 'media_migration', error: String(error) });
    }

    // 按深度从深到浅删除（不包含当前活跃目录）
    const legacyDirs = [
      // 旧隐藏数据目�?
      LEGACY_DOT_TUANKI,
      ...(parentFolder ? [`${parentFolder}/${LEGACY_DOT_TUANKI}`] : []),
      // v1.x 旧路�?
      'weave/flashcards/decks',
      'weave/flashcards/cards',
      'weave/flashcards/learning/sessions',
      'weave/flashcards/learning',
      'weave/flashcards',
      'weave/decks',
      'weave/cards',
      'weave/_shared/profile',
      'weave/_shared',
      'weave/indices',
      'weave/learning/sessions',
      'weave/learning',
      'weave/temp',
      'weave/reading-materials',
      'weave/sessions',
      'weave/weave_media',
      // v2.x _data/ 中间层旧路径（从深到浅）
      `${v2Paths.root}/_data/memory/cards`,
      `${v2Paths.root}/_data/memory/learning/sessions`,
      `${v2Paths.root}/_data/memory/learning`,
      `${v2Paths.root}/_data/memory/media`,
      `${v2Paths.root}/_data/memory`,
      `${v2Paths.root}/_data/incremental-reading/materials`,
      `${v2Paths.root}/_data/incremental-reading`,
      `${v2Paths.root}/_data/question-bank/test-history`,
      `${v2Paths.root}/_data/question-bank/in-progress`,
      `${v2Paths.root}/_data/question-bank/error-book`,
      `${v2Paths.root}/_data/question-bank`,
      `${v2Paths.root}/_data/profile`,
      `${v2Paths.root}/_data/decks`,
      `${v2Paths.root}/_data`,
      // v2.x �?IR 位置（现在应�?incremental-reading/IR 下）
      `${v2Paths.root}/IR`,
      // 隐藏目录/文件
      `${v2Paths.root}/.temp`,
      // v3.0 合并后的�?QB 子目�?
      `${v2Paths.root}/question-bank/test-history`,
      `${v2Paths.root}/question-bank/in-progress`,
      `${v2Paths.root}/question-bank/error-book`,
      `${v2Paths.root}/question-bank/session-archives`,
      `${v2Paths.root}/question-bank/test-sessions`,
      // 迁移残留
      `${v2Paths.root}/profile`,
      `${v2Paths.root}/_migration_conflicts`,
      // v3.0 媒体迁移后的旧根级目�?
      `${v2Paths.root}/media`,
    ];

    for (const dir of legacyDirs) {
      try {
        if (await adapter.exists(dir)) {
          const removed = await tryRemoveRecursive(dir, 8);
          if (removed) {
            success++;
            logger.info(`[DataManagement] 删除旧目�? ${dir}`);
          }
        }
      } catch (error) {
        failed++;
        errors.push({ uuid: dir, error: String(error) });
      }
    }

    const orphanFiles = [
      `${v2Paths.root}/editor-host.md`,
      `${v2Paths.root}/migration-completed`,
    ];
    for (const file of orphanFiles) {
      try {
        if (await adapter.exists(file)) {
          await adapter.remove(file);
          success++;
          logger.info(`[DataManagement] 删除残留文件: ${file}`);
        }
      } catch (error) {
        errors.push({ uuid: file, error: String(error) });
      }
    }

    return {
      type: 'legacy_cleanup',
      success,
      failed,
      errors
    };
  }

  private async importMigrationConflicts(v2Paths: ReturnType<typeof getV2Paths>): Promise<{ importedCards: number; importedDecks: number; errors: string[] }> {
    const adapter = this.plugin.app.vault.adapter as any;
    const conflictDir = `${v2Paths.root}/_migration_conflicts`;

    const result = { importedCards: 0, importedDecks: 0, errors: [] as string[] };

    const basePath: string | undefined = adapter?.basePath;
    if (!basePath) {
      result.errors.push('Could not determine the Vault base path; skipped conflict-file import');
      return result;
    }

    const vaultAdapter = this.plugin.app.vault.adapter;

    if (!(await vaultAdapter.exists(conflictDir))) {
      return result;
    }

    let allFileNames: string[];
    try {
      const listing = await vaultAdapter.list(conflictDir);
      allFileNames = listing.files.map(f => f.split('/').pop() || '');
    } catch (e) {
      result.errors.push(`读取 _migration_conflicts 目录失败: ${String(e)}`);
      return result;
    }

    const cardFileNames = allFileNames.filter(f => /^\.?weave_memory_cards_.*\.json-\d+$/.test(f));
    const deckFileNames = allFileNames.filter(f => /^\.?weave_memory_decks\.json-\d+$/.test(f));

    const readConflictFile = async (fileName: string): Promise<string | null> => {
      try {
        return await vaultAdapter.read(`${conflictDir}/${fileName}`);
      } catch (e) {
        result.errors.push(`读取冲突文件失败: ${fileName} (${String(e)})`);
        return null;
      }
    };

    const importedCardsByUuid = new Map<string, Card>();
    const deckNameById = new Map<string, string>();
    const importedDecksById = new Map<string, Deck>();

    let currentDeckStore: any = { decks: [] as Deck[] };
    try {
      if (await this.plugin.app.vault.adapter.exists(v2Paths.memory.decks)) {
        const raw = await this.plugin.app.vault.adapter.read(v2Paths.memory.decks);
        currentDeckStore = JSON.parse(raw);
      }
    } catch {
    }
    const currentDecks: Deck[] = Array.isArray(currentDeckStore?.decks) ? currentDeckStore.decks : [];
    const currentDeckById = new Map<string, Deck>();
    const currentDeckIdByName = new Map<string, string>();
    for (const d of currentDecks) {
      if (d?.id) {
        currentDeckById.set(d.id, d);
      }
      if (typeof d?.name === 'string' && d.name.trim()) {
        currentDeckIdByName.set(d.name.trim().toLowerCase(), d.id);
      }
    }

    const deckIdRemap = new Map<string, string>();

    for (const deckFileName of deckFileNames) {
      try {
        const raw = await readConflictFile(deckFileName);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const decks = Array.isArray(parsed?.decks) ? (parsed.decks as Deck[]) : [];
        for (const d of decks) {
          if (!d?.id) continue;
          importedDecksById.set(d.id, d);
          if (typeof d.name === 'string' && d.name.trim()) {
            const name = d.name.trim();
            deckNameById.set(d.id, name);
            const existingId = currentDeckIdByName.get(name.toLowerCase());
            if (existingId) {
              deckIdRemap.set(d.id, existingId);
            }
          }
        }
      } catch (e) {
        result.errors.push(`解析牌组冲突文件失败: ${deckFileName} (${String(e)})`);
      }
    }

    for (const cardFileName of cardFileNames) {
      try {
        const raw = await readConflictFile(cardFileName);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const cards = Array.isArray(parsed?.cards) ? (parsed.cards as Card[]) : [];
        for (const c of cards) {
          if (!c?.uuid || typeof c.uuid !== 'string') continue;

          const originalDeckId = (c as any).deckId as string | undefined;
          const deckId = originalDeckId ? (deckIdRemap.get(originalDeckId) || originalDeckId) : undefined;
          const deckName = deckId
            ? (currentDeckById.get(deckId)?.name || (originalDeckId ? deckNameById.get(originalDeckId) : undefined))
            : undefined;
          let nextContent = c.content || '';
          if (deckName) {
            try {
              const yaml = parseYAMLFromContent(nextContent);
              const existing = Array.isArray((yaml as any)?.we_decks) ? (yaml as any).we_decks : [];
              if (!existing || existing.length === 0) {
                nextContent = setCardProperties(nextContent, { we_decks: [deckName] });
              }
            } catch {
            }
          }

          importedCardsByUuid.set(c.uuid, { ...(c as any), deckId, content: nextContent } as any);
        }
      } catch (e) {
        result.errors.push(`解析卡片冲突文件失败: ${cardFileName} (${String(e)})`);
      }
    }

    const importedCards = Array.from(importedCardsByUuid.values());
    if (importedCards.length > 0) {
      try {
        if (this.plugin.cardFileService) {
          await this.plugin.cardFileService.saveCardsBatch(importedCards);
        } else {
          const fallbackPath = `${v2Paths.memory.cards}/default.json`;
          let existing: any = { cards: [] as Card[] };
          try {
            if (await this.plugin.app.vault.adapter.exists(fallbackPath)) {
              const raw = await this.plugin.app.vault.adapter.read(fallbackPath);
              existing = JSON.parse(raw);
            }
          } catch {
          }

          const map = new Map<string, Card>();
          for (const c of (existing?.cards || [])) {
            if (c?.uuid) map.set(c.uuid, c);
          }
          for (const c of importedCards) {
            map.set(c.uuid, c);
          }
          await this.plugin.app.vault.adapter.write(fallbackPath, JSON.stringify({ cards: Array.from(map.values()) }));
        }

        result.importedCards = importedCards.length;
      } catch (e) {
        result.errors.push(`导入卡片到新结构失败: ${String(e)}`);
      }
    }

    try {
      const decksPath = v2Paths.memory.decks;
      const deckById = new Map<string, Deck>(Array.from(currentDeckById.entries()));

      const uuidsByDeckId = new Map<string, Set<string>>();
      for (const c of importedCards) {
        const deckId = (c as any).deckId as string | undefined;
        if (!deckId) continue;
        const set = uuidsByDeckId.get(deckId) || new Set<string>();
        set.add(c.uuid);
        uuidsByDeckId.set(deckId, set);
      }

      for (const d of importedDecksById.values()) {
        if (!d?.id) continue;
        const targetId = deckIdRemap.get(d.id) || d.id;
        if (targetId !== d.id) {
          const existing = deckById.get(targetId);
          if (existing) {
            const a = new Set<string>(Array.isArray(existing.cardUUIDs) ? existing.cardUUIDs : []);
            const b = new Set<string>(Array.isArray(d.cardUUIDs) ? d.cardUUIDs : []);
            for (const u of b) a.add(u);
            existing.cardUUIDs = Array.from(a);
            deckById.set(existing.id, existing);
          }
          continue;
        }

        if (!deckById.has(d.id)) {
          deckById.set(d.id, d);
        } else {
          const existing = deckById.get(d.id)!;
          const a = new Set<string>(Array.isArray(existing.cardUUIDs) ? existing.cardUUIDs : []);
          const b = new Set<string>(Array.isArray(d.cardUUIDs) ? d.cardUUIDs : []);
          for (const u of b) a.add(u);
          existing.cardUUIDs = Array.from(a);
          deckById.set(existing.id, existing);
        }
      }

      for (const [deckId, set] of uuidsByDeckId.entries()) {
        if (!deckById.has(deckId)) {
          const name = deckNameById.get(deckId) || deckId;
          deckById.set(deckId, {
            id: deckId,
            name,
            description: '',
            category: '',
            path: name,
            level: 0,
            order: 0,
            inheritSettings: false,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            includeSubdecks: false,
            stats: {
              totalCards: 0,
              newCards: 0,
              learningCards: 0,
              reviewCards: 0,
              todayNew: 0,
              todayReview: 0,
              todayTime: 0,
              totalReviews: 0,
              totalTime: 0,
              memoryRate: 0,
              averageEase: 0,
              forecastDays: {}
            } as any,
            tags: [],
            metadata: {},
            cardUUIDs: []
          } as any);
        }

        const deck = deckById.get(deckId)!;
        const existing = new Set<string>(Array.isArray(deck.cardUUIDs) ? deck.cardUUIDs : []);
        for (const u of set) existing.add(u);
        deck.cardUUIDs = Array.from(existing);
      }

      const mergedDecks = Array.from(deckById.values());
      // cardUUIDs 分离写入独立文件
      const deckCardsDir = `${v2Paths.memory.deckCards}`;
      await DirectoryUtils.ensureDirRecursive(this.plugin.app.vault.adapter, deckCardsDir);
      for (const deck of mergedDecks) {
        if (deck.cardUUIDs && deck.cardUUIDs.length > 0) {
          const uuidFilePath = `${deckCardsDir}/${deck.id}.json`;
          await this.plugin.app.vault.adapter.write(uuidFilePath, JSON.stringify({ cardUUIDs: deck.cardUUIDs }));
        }
      }
      // decks.json 中剥�?cardUUIDs
      const strippedDecks = mergedDecks.map(d => {
        const { cardUUIDs, ...rest } = d;
        return rest;
      });
      await this.plugin.app.vault.adapter.write(decksPath, JSON.stringify({ decks: strippedDecks }));
      result.importedDecks = importedDecksById.size;
    } catch (e) {
      result.errors.push(`导入牌组到新结构失败: ${String(e)}`);
    }

    if (result.importedCards > 0 || result.importedDecks > 0) {
      logger.info(`[DataManagement] 冲突文件导入完成: 卡片=${result.importedCards}, 牌组=${result.importedDecks}`);
      const adapter = this.plugin.app.vault.adapter;
      for (const f of allFileNames) {
        try {
          if (await adapter.exists(f)) {
            await adapter.remove(f);
          }
        } catch { }
      }
    }

    return result;
  }

  private async cleanupEmptyCardFiles(v2Paths: ReturnType<typeof getV2Paths>): Promise<{ deleted: number; merged: number; errors: string[] }> {
    const result = { deleted: 0, merged: 0, errors: [] as string[] };

    try {
      const adapter = this.plugin.app.vault.adapter as any;
      const basePath: string | undefined = adapter?.basePath;
      if (!basePath) return result;

      const vaultAdapter = this.plugin.app.vault.adapter;
      const cardsDir = v2Paths.memory.cards;

      if (!(await vaultAdapter.exists(cardsDir))) return result;

      const listing = await vaultAdapter.list(cardsDir);
      const files = listing.files.map(f => f.split('/').pop() || '').filter(f => f.endsWith('.json'));
      const defaultFileName = 'cards-0.json';
      const legacyDefaultFileName = 'default.json';
      const indexFileName = 'card-files-index.json';

      const toDelete: string[] = [];
      const toMergeIntoDefault: Card[] = [];

      for (const f of files) {
        if (f === defaultFileName || f === legacyDefaultFileName || f === indexFileName) continue;

        let cards: Card[] = [];
        try {
          const raw = await vaultAdapter.read(`${cardsDir}/${f}`);
          const parsed = JSON.parse(raw);
          cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
        } catch {
          continue;
        }

        const baseName = f.replace(/\.json$/, '');
        const isLegacy = baseName.startsWith('legacy-') || f === legacyDefaultFileName;

        if (cards.length === 0) {
          // 空文件直接删�?
          toDelete.push(f);
        } else if (isLegacy) {
          // legacy 文件中有卡片则合并到 default 后删�?
          toMergeIntoDefault.push(...cards.filter(c => c?.uuid));
          toDelete.push(f);
        }
      }

      if (toMergeIntoDefault.length > 0) {
        const defaultPath = `${cardsDir}/${defaultFileName}`;
        let existing: any = { cards: [] };
        try {
          if (await this.plugin.app.vault.adapter.exists(defaultPath)) {
            const raw = await this.plugin.app.vault.adapter.read(defaultPath);
            existing = JSON.parse(raw);
          }
        } catch { }

        const map = new Map<string, Card>();
        for (const c of (existing?.cards || [])) {
          if (c?.uuid) map.set(c.uuid, c);
        }
        for (const c of toMergeIntoDefault) {
          map.set(c.uuid, c);
        }
        await this.plugin.app.vault.adapter.write(defaultPath, JSON.stringify({ cards: Array.from(map.values()) }));
        result.merged = toMergeIntoDefault.length;
      }

      for (const f of toDelete) {
        try {
          await vaultAdapter.remove(`${cardsDir}/${f}`);
          result.deleted++;
        } catch (e) {
          result.errors.push(`删除空卡片文件失�? ${f} (${String(e)})`);
        }
      }

      // 总是尝试清理索引（包括删除的文件条目�?cardCount=0 的僵尸条目）
      try {
        const indexPath = `${cardsDir}/${indexFileName}`;
        if (await this.plugin.app.vault.adapter.exists(indexPath)) {
          const raw = await this.plugin.app.vault.adapter.read(indexPath);
          const index = JSON.parse(raw);
          let indexChanged = false;

          if (Array.isArray(index?.files)) {
            const deletedSet = new Set(toDelete.map(f => f.replace(/\.json$/, '')));
            const beforeLen = index.files.length;

            // 移除已删除文件的条目 + cardCount=0 的僵尸条目（�?default�?
            index.files = index.files.filter((entry: any) => {
              if (deletedSet.has(entry?.fileName)) return false;
              if (entry?.cardCount === 0 && entry?.fileName !== 'default' && !entry?.isDefault) return false;
              return true;
            });

            if (index.files.length !== beforeLen) indexChanged = true;

            const defaultEntry = index.files.find((entry: any) => entry?.fileName === 'default');
            if (defaultEntry && result.merged > 0) {
              defaultEntry.cardCount = (defaultEntry.cardCount || 0) + result.merged;
              indexChanged = true;
            }
          }

          if (index?.cardLocations) {
            const deletedSet = new Set(toDelete.map(f => f.replace(/\.json$/, '')));
            for (const [uuid, loc] of Object.entries(index.cardLocations)) {
              if (deletedSet.has(loc as string)) {
                index.cardLocations[uuid] = 'default';
                indexChanged = true;
              }
            }
          }

          if (indexChanged) {
            await this.plugin.app.vault.adapter.write(indexPath, JSON.stringify(index));
          }
        }
      } catch (e) {
        result.errors.push(`更新 card-files-index.json 失败: ${String(e)}`);
      }

      logger.info(`[DataManagement] 空卡片文件清�? 删除=${result.deleted}, 合并=${result.merged}`);
    } catch (e) {
      result.errors.push(`清理空卡片文件失�? ${String(e)}`);
    }

    return result;
  }

  private async renameDotManifestFiles(v2Paths: ReturnType<typeof getV2Paths>): Promise<number> {
    let renamed = 0;
    try {
      const adapter = this.plugin.app.vault.adapter as any;
      const basePath: string | undefined = adapter?.basePath;
      if (!basePath) return 0;

      const vaultAdapter = this.plugin.app.vault.adapter;
      const mediaDir = `${v2Paths.memory.root}/media`;

      if (!(await vaultAdapter.exists(mediaDir))) return 0;

      const listing = await vaultAdapter.list(mediaDir);
      for (const subFolder of listing.folders) {
        const dotManifest = `${subFolder}/.manifest.json`;
        const newManifest = `${subFolder}/manifest.json`;
        if (await vaultAdapter.exists(dotManifest)) {
          if (!(await vaultAdapter.exists(newManifest))) {
            const content = await vaultAdapter.read(dotManifest);
            await vaultAdapter.write(newManifest, content);
          }
          await vaultAdapter.remove(dotManifest);
          renamed++;
        }
      }
    } catch { }
    return renamed;
  }
  // ===== 云同步冲突副本检�?=====

  /** 常见云同步冲突副本命名模�?*/
  private static readonly CONFLICT_PATTERNS: RegExp[] = [
    / \d+\.json$/,                              // iCloud: "file 2.json"
    / \(\d+\)\.json$/,                          // OneDrive: "file (1).json"
    /-[A-Z0-9]{7,}\.json$/,                     // Syncthing: short device ID suffix
    /\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]+\.json$/, // Syncthing full
    / \(SyncConflict\)\.json$/i,                // 坚果�?
    / \(conflicted copy .+\)\.json$/i,          // Dropbox
    /-conflict-\d+\.json$/,                     // generic
  ];

  /**
   * 检测是否为冲突副本文件�?
   */
  private isSyncConflictFile(fileName: string): boolean {
    return DataManagementService.CONFLICT_PATTERNS.some(p => p.test(fileName));
  }

  /**
   * 递归扫描目录下的所�?JSON 文件
   */
  private async listJsonFilesRecursive(dir: string): Promise<string[]> {
    const adapter = this.plugin.app.vault.adapter as any;
    const result: string[] = [];
    try {
      const listing = adapter.list ? await adapter.list(dir) : { files: [], folders: [] };
      for (const f of (listing.files || [])) {
        if (f.endsWith('.json')) result.push(f);
      }
      for (const sub of (listing.folders || [])) {
        const subFiles = await this.listJsonFilesRecursive(sub);
        result.push(...subFiles);
      }
    } catch { }
    return result;
  }

  /**
   * 检测云同步冲突副本文件
   */
  private async checkSyncConflictFiles(): Promise<DataCheckResult> {
    try {
      const v2Paths = getV2Paths(normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder));
      const allFiles = await this.listJsonFilesRecursive(v2Paths.root);

      const conflicts = allFiles.filter(f => {
        const name = f.split('/').pop() || '';
        return this.isSyncConflictFile(name);
      });

      if (conflicts.length === 0) {
        return {
          type: 'sync_conflict_files',
          status: 'ok',
          count: 0,
          items: [],
          message: 'No cloud sync conflict copies detected'
        };
      }

      return {
        type: 'sync_conflict_files',
        status: 'warning',
        count: conflicts.length,
        items: conflicts,
        message: `Detected ${conflicts.length} cloud sync conflict-copy files that may contain unmerged data`
      };
    } catch (error) {
      logger.error('[DataManagement] checkSyncConflictFiles failed:', error);
      return {
        type: 'sync_conflict_files',
        status: 'ok',
        count: 0,
        items: [],
        message: 'Check failed'
      };
    }
  }

  /**
   * 修复云同步冲突副本：合并数据后删除冲突文�?
   */
  private async fixSyncConflictFiles(): Promise<DataFixResult> {
    const result: DataFixResult = { type: 'sync_conflict_files', success: 0, failed: 0, errors: [] };

    try {
      const v2Paths = getV2Paths(normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder));
      const adapter = this.plugin.app.vault.adapter;
      const allFiles = await this.listJsonFilesRecursive(v2Paths.root);

      const conflicts = allFiles.filter(f => {
        const name = f.split('/').pop() || '';
        return this.isSyncConflictFile(name);
      });

      for (const conflictPath of conflicts) {
        try {
          const dir = conflictPath.substring(0, conflictPath.lastIndexOf('/'));
          const fileName = conflictPath.split('/').pop() || '';

          // 推断原始文件名：移除冲突后缀
          let originalName = fileName;
          for (const pattern of DataManagementService.CONFLICT_PATTERNS) {
            const match = fileName.match(pattern);
            if (match) {
              originalName = fileName.substring(0, match.index!) + '.json';
              break;
            }
          }
          const originalPath = `${dir}/${originalName}`;

          // 尝试合并卡片数据（如果是卡片分片文件�?
          if (dir.includes('/cards') && await adapter.exists(originalPath)) {
            try {
              const conflictRaw = await adapter.read(conflictPath);
              const conflictData = JSON.parse(conflictRaw);
              const originalRaw = await adapter.read(originalPath);
              const originalData = JSON.parse(originalRaw);

              if (Array.isArray(conflictData?.cards) && Array.isArray(originalData?.cards)) {
                const mergedMap = new Map<string, any>();
                for (const card of originalData.cards) {
                  if (card?.uuid) mergedMap.set(card.uuid, card);
                }
                let newCards = 0;
                for (const card of conflictData.cards) {
                  if (!card?.uuid) continue;
                  const existing = mergedMap.get(card.uuid);
                  if (!existing || (card.modified && existing.modified && card.modified > existing.modified)) {
                    mergedMap.set(card.uuid, card);
                    if (!existing) newCards++;
                  }
                }
                if (newCards > 0) {
                  await adapter.write(originalPath, JSON.stringify({ cards: Array.from(mergedMap.values()) }));
                  logger.info(`[DataManagement] 合并 ${newCards} 张卡片从冲突副本: ${fileName}`);
                }
              }
            } catch (mergeError) {
              logger.warn(`[DataManagement] 合并冲突副本内容失败: ${conflictPath}`, mergeError);
            }
          }

          // 尝试合并 deck-cards 数据（cardUUIDs 取并集）
          if (dir.includes('/deck-cards') && await adapter.exists(originalPath)) {
            try {
              const conflictRaw = await adapter.read(conflictPath);
              const conflictData = JSON.parse(conflictRaw);
              const originalRaw = await adapter.read(originalPath);
              const originalData = JSON.parse(originalRaw);

              if (Array.isArray(conflictData?.cardUUIDs) && Array.isArray(originalData?.cardUUIDs)) {
                const merged = new Set([...originalData.cardUUIDs, ...conflictData.cardUUIDs]);
                if (merged.size > originalData.cardUUIDs.length) {
                  await adapter.write(originalPath, JSON.stringify({ cardUUIDs: Array.from(merged) }));
                  logger.info(`[DataManagement] 合并 deck-cards UUID 从冲突副�? ${fileName}`);
                }
              }
            } catch (mergeError) {
              logger.warn(`[DataManagement] 合并 deck-cards 冲突失败: ${conflictPath}`, mergeError);
            }
          }

          // 删除冲突副本
          await adapter.remove(conflictPath);
          result.success++;
          logger.info(`[DataManagement] 已删除冲突副�? ${conflictPath}`);
        } catch (e) {
          result.failed++;
          result.errors.push({ uuid: conflictPath, error: String(e) });
        }
      }
    } catch (error) {
      logger.error('[DataManagement] fixSyncConflictFiles failed:', error);
    }

    return result;
  }

  // ===== 渐进式挖空检�?=====

  /**
   * 检测符合渐进式挖空格式但未转换的卡�?
   * 
   * 条件�?
   * 1. 卡片不是 ProgressiveParent �?ProgressiveChild 类型
   * 2. 卡片 content 包含 2+ 不同序号�?{{cN::}} 挖空
   */
  private checkProgressiveClozeUnconverted(cards: Card[]): DataCheckResult {
    const unconverted: string[] = [];

    for (const card of cards) {
      // 跳过已经是渐进式挖空的卡�?
      if (isProgressiveClozeParent(card) || isProgressiveClozeChild(card)) {
        continue;
      }

      // 检�?content 是否符合渐进式挖空格�?
      if (card.content && hasProgressiveClozeContent(card.content)) {
        unconverted.push(card.uuid);
      }
    }

    return {
      type: 'progressive_cloze_unconverted',
      status: unconverted.length > 0 ? 'warning' : 'ok',
      count: unconverted.length,
      items: unconverted,
      message: unconverted.length > 0
        ? `发现 ${unconverted.length} 张卡片包含渐进式挖空格式但未转换为子卡片`
        : '无未转换的渐进式挖空卡片'
    };
  }

  /**
   * 修复未转换的渐进式挖空卡�?
   * 将符合格式的卡片转换为父卡片+子卡�?
   */
  private async fixProgressiveClozeUnconverted(cards: Card[]): Promise<DataFixResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ uuid: string; error: string }> = [];

    const { getProgressiveClozeGateway } = await import('../../services/progressive-cloze/ProgressiveClozeGateway');
    const gateway = getProgressiveClozeGateway();

    for (const card of cards) {
      if (isProgressiveClozeParent(card) || isProgressiveClozeChild(card)) continue;
      if (!card.content || !hasProgressiveClozeContent(card.content)) continue;

      try {
        const result = await gateway.processNewCard({ ...card });
        if (result.converted && result.cards.length > 0) {
          // 先删除原卡片（避免UUID冲突，因为父卡片UUID与原卡片相同�?
          // processNewCard 返回的父卡片UUID就是原卡片UUID，直接覆盖保存即�?
          for (const c of result.cards) {
            const saveResult = await this.plugin.dataStorage.saveCard(c);
            if (!saveResult.success) {
              throw new Error(saveResult.error || '保存失败');
            }
          }
          logger.info(`[DataManagement] 转换渐进式挖�? ${card.uuid} -> 1�?${result.cards.length - 1}子`);
          success++;
        }
      } catch (error) {
        failed++;
        errors.push({
          uuid: card.uuid,
          error: error instanceof Error ? error.message : String(error)
        });
        logger.error(`[DataManagement] 转换渐进式挖空失�? ${card.uuid}`, error);
      }
    }

    return {
      type: 'progressive_cloze_unconverted',
      success,
      failed,
      errors
    };
  }

  /**
   * 检测孤儿子卡片（父卡片已不存在�?
   * 
   * 条件�?
   * 1. 卡片类型�?ProgressiveChild
   * 2. �?parentCardId 指向的父卡片在所有卡片中不存�?
   */
  private checkProgressiveClozeOrphan(cards: Card[]): DataCheckResult {
    const parentUUIDs = new Set(
      cards
        .filter(c => isProgressiveClozeParent(c))
        .map(c => c.uuid)
    );

    const orphans: string[] = [];

    for (const card of cards) {
      if (!isProgressiveClozeChild(card)) continue;

      const parentId = card.parentCardId;
      if (!parentId || !parentUUIDs.has(parentId)) {
        orphans.push(card.uuid);
      }
    }

    return {
      type: 'progressive_cloze_orphan',
      status: orphans.length > 0 ? 'warning' : 'ok',
      count: orphans.length,
      items: orphans,
      message: orphans.length > 0
        ? `发现 ${orphans.length} 张渐进式挖空子卡片的父卡片已不存在`
        : '无孤儿子卡片'
    };
  }

  /**
   * 检测父卡片缺少序号对应子卡�?
   * 
   * 条件：父卡片内容中存在的 cloze 序号，在子卡片中找不到对应的 clozeOrd
   */
  private checkProgressiveClozeMissingChildren(cards: Card[]): DataCheckResult {
    const problems: string[] = [];

    const childrenByParent = new Map<string, Set<number>>();
    for (const card of cards) {
      if (!isProgressiveClozeChild(card) || !card.parentCardId) continue;
      if (!childrenByParent.has(card.parentCardId)) {
        childrenByParent.set(card.parentCardId, new Set());
      }
      childrenByParent.get(card.parentCardId)!.add((card as any).clozeOrd);
    }

    const clozeRegex = /\{\{c(\d+)::/g;
    for (const card of cards) {
      if (!isProgressiveClozeParent(card) || !card.content) continue;

      const contentOrds = new Set<number>();
      let match: RegExpExecArray | null;
      while ((match = clozeRegex.exec(card.content)) !== null) {
        contentOrds.add(parseInt(match[1], 10) - 1);
      }
      clozeRegex.lastIndex = 0;

      const existingOrds = childrenByParent.get(card.uuid) || new Set();
      for (const ord of contentOrds) {
        if (!existingOrds.has(ord)) {
          problems.push(card.uuid);
          break;
        }
      }
    }

    return {
      type: 'progressive_cloze_missing_children',
      status: problems.length > 0 ? 'warning' : 'ok',
      count: problems.length,
      items: problems,
      message: problems.length > 0
        ? `发现 ${problems.length} 张父卡片缺少对应序号的子卡片`
        : '所有父卡片的子卡片完整'
    };
  }

  /**
   * 检测多余子卡片（序号在父卡片内容中不存在）
   * 
   * 条件：子卡片�?clozeOrd 在父卡片当前内容的挖空序号中找不�?
   */
  private checkProgressiveClozeExtraChildren(cards: Card[]): DataCheckResult {
    const extras: string[] = [];

    const parentMap = new Map<string, Card>();
    for (const card of cards) {
      if (isProgressiveClozeParent(card)) {
        parentMap.set(card.uuid, card);
      }
    }

    const clozeRegex = /\{\{c(\d+)::/g;
    for (const card of cards) {
      if (!isProgressiveClozeChild(card) || !card.parentCardId) continue;

      const parent = parentMap.get(card.parentCardId);
      if (!parent || !parent.content) continue;

      const contentOrds = new Set<number>();
      let match: RegExpExecArray | null;
      while ((match = clozeRegex.exec(parent.content)) !== null) {
        contentOrds.add(parseInt(match[1], 10) - 1);
      }
      clozeRegex.lastIndex = 0;

      if (!contentOrds.has((card as any).clozeOrd)) {
        extras.push(card.uuid);
      }
    }

    return {
      type: 'progressive_cloze_extra_children',
      status: extras.length > 0 ? 'warning' : 'ok',
      count: extras.length,
      items: extras,
      message: extras.length > 0
        ? `发现 ${extras.length} 张子卡片的序号在父卡片内容中不存在`
        : '无多余子卡片'
    };
  }
}

// ===== 导出工厂函数 =====

let instance: DataManagementService | null = null;

export function getDataManagementService(plugin: WeavePlugin): DataManagementService {
  if (!instance) {
    instance = new DataManagementService(plugin);
  }
  return instance;
}

export function resetDataManagementService(): void {
  instance = null;
}

