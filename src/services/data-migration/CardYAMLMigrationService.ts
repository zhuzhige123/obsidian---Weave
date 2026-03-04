/**
 * 卡片 YAML 元数据迁移服务
 * 
 * 将旧版卡片字段迁移到 YAML frontmatter 格式
 * 
 * @module services/data-migration/CardYAMLMigrationService
 * @version 1.0.0
 * @see YAML属性栏卡片元数据方案.md
 */

import type { Card } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { 
  setCardProperties, 
  hasYAMLFrontmatter, 
  parseYAMLFromContent,
  type CardYAMLMetadata 
} from '../../utils/yaml-utils';
import { getDeckNameById } from '../DeckNameMapper';
import { logger } from '../../utils/logger';

// ===== 类型定义 =====

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 迁移的卡片数量 */
  migratedCount: number;
  /** 跳过的卡片数量（已是新格式） */
  skippedCount: number;
  /** 失败的卡片数量 */
  failedCount: number;
  /** 失败的卡片 UUID 列表 */
  failedCards: string[];
  /** 迁移耗时（毫秒） */
  duration: number;
  /** 错误信息 */
  errors: Array<{ uuid: string; error: string }>;
}

/**
 * 单张卡片迁移结果
 */
export interface CardMigrationResult {
  /** 是否需要迁移 */
  needsMigration: boolean;
  /** 迁移后的卡片 */
  migratedCard?: Card;
  /** 错误信息 */
  error?: string;
}

/**
 * 迁移配置
 */
export interface MigrationConfig {
  /** 是否自动保存迁移后的卡片 */
  autoSave: boolean;
  /** 是否删除旧字段 */
  removeOldFields: boolean;
  /** 批量大小 */
  batchSize: number;
  /** 是否记录详细日志 */
  verbose: boolean;
}

const DEFAULT_CONFIG: MigrationConfig = {
  autoSave: true,
  removeOldFields: true,
  batchSize: 100,
  verbose: false
};

// ===== 迁移服务实现 =====

/**
 * 卡片 YAML 元数据迁移服务
 */
export class CardYAMLMigrationService {
  private plugin: WeavePlugin;
  private config: MigrationConfig;

  constructor(plugin: WeavePlugin, config?: Partial<MigrationConfig>) {
    this.plugin = plugin;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===== 检测方法 =====

  /**
   * 检测卡片是否需要迁移
   * @param card 卡片对象
   * @returns 是否需要迁移
   */
  needsMigration(card: Card): boolean {
    // 检查是否存在旧格式字段
    const hasOldFields = !!(
      card.sourceFile ||
      card.sourceBlock ||
      card.deckId ||
      card.referencedByDecks?.length ||
      card.tags?.length ||
      card.type ||
      card.priority !== undefined
    );

    // 检查 content 中是否已有 YAML frontmatter
    const hasYAML = hasYAMLFrontmatter(card.content);
    
    // 如果有旧字段且 YAML 中没有对应的 we_ 字段，则需要迁移
    if (!hasOldFields) {
      return false;
    }

    if (!hasYAML) {
      return true;
    }

    // 检查 YAML 中是否已有 we_ 字段
    const yaml = parseYAMLFromContent(card.content);
    const hasWeFields = !!(
      yaml.we_source ||
      yaml.we_block ||
      yaml.we_decks ||
      yaml.we_type ||
      yaml.we_priority !== undefined
    );

    return !hasWeFields;
  }

  /**
   * 批量检测需要迁移的卡片
   * @param cards 卡片数组
   * @returns 需要迁移的卡片数组
   */
  findCardsNeedingMigration(cards: Card[]): Card[] {
    return cards.filter(card => this.needsMigration(card));
  }

  // ===== 迁移方法 =====

  /**
   * 迁移单张卡片
   * @param card 卡片对象
   * @returns 迁移结果
   */
  migrateCard(card: Card): CardMigrationResult {
    try {
      if (!this.needsMigration(card)) {
        return { needsMigration: false };
      }

      // 构建 YAML 元数据
      const metadata: CardYAMLMetadata = {};

      // 🔧 v2.1.1: 合并 sourceFile + sourceBlock 为统一的 we_source
      if (card.sourceFile) {
        const fileName = card.sourceFile.replace(/\.md$/, '');
        const blockId = card.sourceBlock?.replace(/^\^/, ''); // 移除可能的 ^ 前缀
        
        if (blockId) {
          // 合并格式: ![[文档名#^blockId]]
          metadata.we_source = `![[${fileName}#^${blockId}]]`;
        } else {
          // 仅文档: [[文档名]]
          metadata.we_source = `[[${fileName}]]`;
        }
      } else if (card.sourceBlock) {
        // 仅有块ID（罕见情况）
        const blockId = card.sourceBlock.replace(/^\^/, '');
        metadata.we_source = `^${blockId}`;
      }

      // 迁移 deckId/referencedByDecks -> we_decks
      const deckIds = new Set<string>();
      if (card.deckId) {
        deckIds.add(card.deckId);
      }
      if (card.referencedByDecks) {
        for (const id of card.referencedByDecks) {
          deckIds.add(id);
        }
      }
      
      if (deckIds.size > 0) {
        const deckNames: string[] = [];
        for (const id of deckIds) {
          const name = getDeckNameById(id);
          if (name) {
            deckNames.push(name);
          } else {
            // 🆕 v2.2 修复：找不到名称时跳过，不写入ID
            // 原因：we_decks 应该存储牌组名称，写入 ID 会导致显示错误
            logger.warn(`[Migration] 牌组ID "${id}" 找不到对应名称，跳过（不写入ID）`);
            // 不再将 ID 作为名称写入
          }
        }
        if (deckNames.length > 0) {
          metadata.we_decks = deckNames;
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

      // 迁移 tags -> tags（YAML 原生字段）
      if (card.tags && card.tags.length > 0) {
        metadata.tags = card.tags;
      }

      // 更新 content，添加 YAML frontmatter
      const newContent = setCardProperties(card.content, metadata);

      // 创建迁移后的卡片
      const migratedCard: Card = {
        ...card,
        content: newContent
      };

      // 如果配置要求删除旧字段
      if (this.config.removeOldFields) {
        delete (migratedCard as any).sourceFile;
        delete (migratedCard as any).sourceBlock;
        delete (migratedCard as any).tags;
        delete (migratedCard as any).priority;
        // deckId 和 referencedByDecks 暂时保留，因为其他地方可能还在使用
      }

      if (this.config.verbose) {
        logger.debug(`[Migration] 卡片 ${card.uuid.substring(0, 8)}... 迁移完成`);
      }

      return {
        needsMigration: true,
        migratedCard
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Migration] 卡片 ${card.uuid} 迁移失败:`, error);
      return {
        needsMigration: true,
        error: errorMsg
      };
    }
  }

  /**
   * 批量迁移所有卡片
   * @param cards 卡片数组
   * @returns 迁移结果
   */
  async migrateAll(cards: Card[]): Promise<MigrationResult> {
    const startTime = Date.now();
    
    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failedCards: [],
      duration: 0,
      errors: []
    };

    logger.info(`[Migration] 开始迁移 ${cards.length} 张卡片...`);

    // 分批处理
    for (let i = 0; i < cards.length; i += this.config.batchSize) {
      const batch = cards.slice(i, i + this.config.batchSize);
      
      for (const card of batch) {
        const migrationResult = this.migrateCard(card);

        if (!migrationResult.needsMigration) {
          result.skippedCount++;
          continue;
        }

        if (migrationResult.error) {
          result.failedCount++;
          result.failedCards.push(card.uuid);
          result.errors.push({ uuid: card.uuid, error: migrationResult.error });
          continue;
        }

        if (migrationResult.migratedCard && this.config.autoSave) {
          try {
            await this.plugin.dataStorage.saveCard(migrationResult.migratedCard);
            result.migratedCount++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.failedCount++;
            result.failedCards.push(card.uuid);
            result.errors.push({ uuid: card.uuid, error: `保存失败: ${errorMsg}` });
          }
        } else if (migrationResult.migratedCard) {
          result.migratedCount++;
        }
      }

      // 每批次后记录进度
      const progress = Math.min(i + this.config.batchSize, cards.length);
      logger.info(`[Migration] 进度: ${progress}/${cards.length}`);
    }

    result.duration = Date.now() - startTime;
    result.success = result.failedCount === 0;

    logger.info(`[Migration] 迁移完成:`, {
      migrated: result.migratedCount,
      skipped: result.skippedCount,
      failed: result.failedCount,
      duration: `${result.duration}ms`
    });

    return result;
  }

  /**
   * 执行完整迁移流程
   * 从存储加载所有卡片，迁移并保存
   */
  async runFullMigration(): Promise<MigrationResult> {
    try {
      // 加载所有卡片
      const allCards = await this.plugin.dataStorage.getAllCards();
      logger.info(`[Migration] 加载了 ${allCards.length} 张卡片`);

      // 找出需要迁移的卡片
      const cardsToMigrate = this.findCardsNeedingMigration(allCards);
      logger.info(`[Migration] 需要迁移 ${cardsToMigrate.length} 张卡片`);

      if (cardsToMigrate.length === 0) {
        return {
          success: true,
          migratedCount: 0,
          skippedCount: allCards.length,
          failedCount: 0,
          failedCards: [],
          duration: 0,
          errors: []
        };
      }

      // 执行迁移
      return await this.migrateAll(cardsToMigrate);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[Migration] 完整迁移失败:', error);
      return {
        success: false,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        failedCards: [],
        duration: 0,
        errors: [{ uuid: 'system', error: errorMsg }]
      };
    }
  }
}

// ===== 便捷函数 =====

/**
 * 检查单张卡片是否需要迁移
 * @param card 卡片对象
 * @returns 是否需要迁移
 */
export function cardNeedsMigration(card: Card): boolean {
  // 检查是否存在旧格式字段
  const hasOldFields = !!(
    card.sourceFile ||
    card.sourceBlock ||
    card.deckId ||
    card.referencedByDecks?.length ||
    card.tags?.length ||
    card.type ||
    card.priority !== undefined
  );

  if (!hasOldFields) {
    return false;
  }

  // 检查 YAML 中是否已有 we_ 字段
  if (!hasYAMLFrontmatter(card.content)) {
    return true;
  }

  const yaml = parseYAMLFromContent(card.content);
  return !(yaml.we_source || yaml.we_block || yaml.we_decks || yaml.we_type);
}

/**
 * 快速迁移单张卡片（不保存）
 * @param card 卡片对象
 * @returns 迁移后的卡片，如果不需要迁移返回原卡片
 */
export function migrateCardQuick(card: Card): Card {
  if (!cardNeedsMigration(card)) {
    return card;
  }

  const metadata: CardYAMLMetadata = {};

  // 🔧 v2.1.1: 合并 sourceFile + sourceBlock 为统一的 we_source
  if (card.sourceFile) {
    const fileName = card.sourceFile.replace(/\.md$/, '');
    const blockId = card.sourceBlock?.replace(/^\^/, '');
    
    if (blockId) {
      metadata.we_source = `![[${fileName}#^${blockId}]]`;
    } else {
      metadata.we_source = `[[${fileName}]]`;
    }
  } else if (card.sourceBlock) {
    const blockId = card.sourceBlock.replace(/^\^/, '');
    metadata.we_source = `^${blockId}`;
  }

  if (card.type) {
    metadata.we_type = card.type as any;
  }

  if (card.priority !== undefined) {
    metadata.we_priority = card.priority;
  }

  if (card.tags && card.tags.length > 0) {
    metadata.tags = card.tags;
  }

  // 牌组迁移需要 DeckNameMapper，这里跳过

  const newContent = setCardProperties(card.content, metadata);

  return {
    ...card,
    content: newContent
  };
}

/**
 * 🆕 v2.2: 修复 we_decks 中错误写入的牌组ID
 * 将 we_decks 中的牌组ID（deck_开头）转换为牌组名称
 * 
 * @param card 卡片对象
 * @param decks 牌组列表（用于ID到名称的映射）
 * @returns 修复后的卡片，如果不需要修复返回原卡片
 */
export function fixWeDecksIdToName(
  card: Card,
  decks: Array<{ id: string; name: string }>
): { card: Card; fixed: boolean } {
  if (!card.content) {
    return { card, fixed: false };
  }

  try {
    const yaml = parseYAMLFromContent(card.content);
    if (!yaml.we_decks || yaml.we_decks.length === 0) {
      return { card, fixed: false };
    }

    let needsFix = false;
    const fixedDeckNames: string[] = [];

    for (const value of yaml.we_decks) {
      // 检测值是否是牌组ID格式（deck_开头）
      if (value.startsWith('deck_')) {
        needsFix = true;
        const matchedDeck = decks.find(d => d.id === value);
        if (matchedDeck) {
          fixedDeckNames.push(matchedDeck.name);
        } else {
          // 牌组已删除，跳过
          logger.warn(`[Migration] 修复 we_decks: 牌组ID "${value}" 找不到对应牌组，跳过`);
        }
      } else {
        // 已经是名称格式，保留
        fixedDeckNames.push(value);
      }
    }

    if (!needsFix) {
      return { card, fixed: false };
    }

    // 更新 we_decks
    const metadata: CardYAMLMetadata = {};
    if (fixedDeckNames.length > 0) {
      metadata.we_decks = fixedDeckNames;
    }

    const newContent = setCardProperties(card.content, metadata);

    return {
      card: { ...card, content: newContent, modified: new Date().toISOString() },
      fixed: true
    };
  } catch (e) {
    logger.error(`[Migration] 修复 we_decks 失败: ${e}`);
    return { card, fixed: false };
  }
}
