/**
 * 引用式牌组服务 (v2.0+ 平级架构)
 * 
 * 核心职责：
 * 1. 管理牌组的 cardUUIDs 数组（正向引用）
 * 2. 管理卡片的 we_decks YAML 字段（反向引用）
 * 3. 维护双向引用的一致性
 * 4. 提供组建牌组、解散牌组、移除卡片等操作
 * 
 * 设计原则：
 * - 所有引用操作必须同时更新正向和反向引用
 * - 以牌组的 cardUUIDs 为权威数据源
 * - 支持一张卡片被多个牌组引用（类似 Obsidian 双链）
 * 
 * ⚠️ v2.0+ 平级架构：
 * - 已移除父牌组支持（parentDeckId 已废弃）
 * - referencedByDecks 已废弃，使用 we_decks YAML 字段
 */

import type { Card, Deck, ApiResponse } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { getCardMetadata, setCardProperties } from '../../utils/yaml-utils';
import { logger } from '../../utils/logger';
import { getV2PathsFromApp } from '../../config/paths';
import { DirectoryUtils } from '../../utils/directory-utils';

export interface CreateDeckFromCardsOptions {
  /** 牌组名称 */
  name: string;
  /** @deprecated v2.0+ 平级架构不支持父牌组，此字段将被忽略 */
  parentDeckId?: string;
  /** 标签（单选） */
  tag?: string;
  /** 描述 */
  description?: string;
  /** 要引用的卡片UUID数组 */
  cardUUIDs: string[];
}

export interface AddCardsToDeckResult {
  success: boolean;
  addedCount: number;
  skippedCount: number;
  error?: string;
}

export interface RemoveCardsFromDeckResult {
  success: boolean;
  removedCount: number;
  error?: string;
  /** 变成孤儿的卡片UUID */
  orphanedCards?: string[];
}

export interface DissolveDeckResult {
  success: boolean;
  /** 受影响的卡片数量 */
  affectedCards: number;
  /** 变成孤儿的卡片UUID */
  orphanedCards: string[];
  error?: string;
}

export class ReferenceDeckService {
  private plugin: WeavePlugin;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 从选中的卡片创建新牌组
   * 
   * 流程：
   * 1. 创建新牌组，设置 cardUUIDs
   * 2. 更新每张卡片的 referencedByDecks
   */
  async createDeckFromCards(options: CreateDeckFromCardsOptions): Promise<ApiResponse<Deck>> {
    const { name, tag, description, cardUUIDs } = options;
    // parentDeckId 已废弃 - 平级架构不支持父牌组

    try {
      // 验证卡片UUID存在
      if (!cardUUIDs || cardUUIDs.length === 0) {
        return {
          success: false,
          error: '至少需要选择一张卡片',
          timestamp: new Date().toISOString()
        };
      }

      // 检查牌组名称是否重复
      const existingDecks = await this.plugin.dataStorage.getDecks();
      if (existingDecks.some(d => d.name === name)) {
        return {
          success: false,
          error: `牌组名称"${name}"已存在`,
          timestamp: new Date().toISOString()
        };
      }

      // 生成牌组ID
      const { generateUUID } = await import('../../utils/helpers');
      const deckId = `deck_${generateUUID().slice(0, 12)}`;
      const now = new Date();

      // 平级架构：path = name, level = 0
      const path = name;
      const level = 0;

      // 创建新牌组（平级架构）
      const newDeck: Deck = {
        id: deckId,
        name,
        description: description || '',
        category: tag || '',
        cardUUIDs: [...cardUUIDs],
        // parentId 已废弃 - 平级架构下始终为 undefined
        path,
        level,
        order: existingDecks.length, // 平级架构：排在最后
        inheritSettings: false,
        created: now.toISOString(),
        modified: now.toISOString(),
        settings: await this.getDefaultDeckSettings(),
        includeSubdecks: false,
        stats: {
          totalCards: cardUUIDs.length,
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
        },
        tags: tag ? [tag] : [],
        metadata: {}
      };

      // 保存牌组
      const saveResult = await this.plugin.dataStorage.saveDeck(newDeck);
      if (!saveResult.success) {
        return saveResult;
      }

      // 更新卡片的反向引用
      await this.addDeckReferenceToCards(deckId, cardUUIDs);

      logger.info(`[ReferenceDeck] 创建牌组成功: ${name}, 引用 ${cardUUIDs.length} 张卡片`);

      return {
        success: true,
        data: newDeck,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('[ReferenceDeck] 创建牌组失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建牌组失败',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 向牌组添加卡片引用
   */
  async addCardsToDeck(deckId: string, cardUUIDs: string[]): Promise<AddCardsToDeckResult> {
    try {
      const deck = await this.plugin.dataStorage.getDeck(deckId);
      if (!deck) {
        return { success: false, addedCount: 0, skippedCount: 0, error: '牌组不存在' };
      }

      const existingUUIDs = new Set(deck.cardUUIDs || []);
      const newUUIDs: string[] = [];
      let skippedCount = 0;

      for (const uuid of cardUUIDs) {
        if (existingUUIDs.has(uuid)) {
          skippedCount++;
        } else {
          newUUIDs.push(uuid);
          existingUUIDs.add(uuid);
        }
      }

      if (newUUIDs.length === 0) {
        return { success: true, addedCount: 0, skippedCount };
      }

      // 更新牌组的 cardUUIDs
      deck.cardUUIDs = Array.from(existingUUIDs);
      deck.modified = new Date().toISOString();
      await this.plugin.dataStorage.saveDeck(deck);

      // 更新卡片的反向引用
      await this.addDeckReferenceToCards(deckId, newUUIDs);

      logger.info(`[ReferenceDeck] 添加 ${newUUIDs.length} 张卡片到牌组 ${deck.name}`);

      return { success: true, addedCount: newUUIDs.length, skippedCount };
    } catch (error) {
      logger.error('[ReferenceDeck] 添加卡片失败:', error);
      return {
        success: false,
        addedCount: 0,
        skippedCount: 0,
        error: error instanceof Error ? error.message : '添加卡片失败'
      };
    }
  }

  /**
   * 从牌组移除卡片引用（不删除卡片数据）
   */
  async removeCardsFromDeck(deckId: string, cardUUIDs: string[]): Promise<RemoveCardsFromDeckResult> {
    try {
      const deck = await this.plugin.dataStorage.getDeck(deckId);
      if (!deck) {
        return { success: false, removedCount: 0, error: '牌组不存在' };
      }

      const existingUUIDs = new Set(deck.cardUUIDs || []);
      const removedUUIDs: string[] = [];

      for (const uuid of cardUUIDs) {
        if (existingUUIDs.has(uuid)) {
          existingUUIDs.delete(uuid);
          removedUUIDs.push(uuid);
        }
      }

      if (removedUUIDs.length === 0) {
        return { success: true, removedCount: 0 };
      }

      // 更新牌组的 cardUUIDs
      deck.cardUUIDs = Array.from(existingUUIDs);
      deck.modified = new Date().toISOString();
      await this.plugin.dataStorage.saveDeck(deck);

      // 更新卡片的反向引用，并收集孤儿卡片
      const orphanedCards = await this.removeDeckReferenceFromCards(deckId, removedUUIDs);

      logger.info(`[ReferenceDeck] 从牌组 ${deck.name} 移除 ${removedUUIDs.length} 张卡片`);

      return {
        success: true,
        removedCount: removedUUIDs.length,
        orphanedCards
      };
    } catch (error) {
      logger.error('[ReferenceDeck] 移除卡片失败:', error);
      return {
        success: false,
        removedCount: 0,
        error: error instanceof Error ? error.message : '移除卡片失败'
      };
    }
  }

  /**
   * 解散牌组（删除牌组但保留卡片）
   * 
   * 🔧 重要：卡片数据会被移动到统一卡片存储，确保不会丢失
   */
  async dissolveDeck(deckId: string): Promise<DissolveDeckResult> {
    try {
      const deck = await this.plugin.dataStorage.getDeck(deckId);
      if (!deck) {
        return { success: false, affectedCards: 0, orphanedCards: [], error: '牌组不存在' };
      }

      const cardUUIDs = deck.cardUUIDs || [];
      
      // 🔧 关键修复：在删除牌组之前，将卡片数据移动到统一卡片存储
      // 这样确保卡片不会因为牌组被删除而丢失
      await this.moveCardsToUnifiedStorage(deckId);

      // 从所有卡片中移除对此牌组的引用
      const orphanedCards = await this.removeDeckReferenceFromCards(deckId, cardUUIDs);

      // 删除牌组（不删除卡片数据，因为已经移动了）
      await this.deleteDeckOnly(deckId);

      // 检查是否需要自动创建默认牌组
      const remainingDecks = await this.plugin.dataStorage.getDecks();
      if (remainingDecks.length === 0) {
        await this.ensureDefaultDeck();
      }

      logger.info(`[ReferenceDeck] 解散牌组 ${deck.name}, 影响 ${cardUUIDs.length} 张卡片`);

      return {
        success: true,
        affectedCards: cardUUIDs.length,
        orphanedCards
      };
    } catch (error) {
      logger.error('[ReferenceDeck] 解散牌组失败:', error);
      return {
        success: false,
        affectedCards: 0,
        orphanedCards: [],
        error: error instanceof Error ? error.message : '解散牌组失败'
      };
    }
  }

  /**
   * 获取卡片被哪些牌组引用
   */
  async getCardReferences(cardUUID: string): Promise<string[]> {
    try {
      // 优先从卡片的 referencedByDecks 获取
      const card = await this.findCardByUUID(cardUUID);
      if (card?.referencedByDecks) {
        return card.referencedByDecks;
      }

      // 降级：遍历所有牌组查找
      const decks = await this.plugin.dataStorage.getDecks();
      const references: string[] = [];
      for (const deck of decks) {
        if (deck.cardUUIDs?.includes(cardUUID)) {
          references.push(deck.id);
        }
      }
      return references;
    } catch (error) {
      logger.error('[ReferenceDeck] 获取卡片引用失败:', error);
      return [];
    }
  }

  /**
   * 获取牌组引用的所有卡片
   */
  async getDeckCards(deckId: string): Promise<Card[]> {
    try {
      const deck = await this.plugin.dataStorage.getDeck(deckId);
      if (!deck || !deck.cardUUIDs || deck.cardUUIDs.length === 0) {
        return [];
      }

      const cards: Card[] = [];
      for (const uuid of deck.cardUUIDs) {
        const card = await this.findCardByUUID(uuid);
        if (card) {
          cards.push(card);
        }
      }
      return cards;
    } catch (error) {
      logger.error('[ReferenceDeck] 获取牌组卡片失败:', error);
      return [];
    }
  }

  /**
   * 获取孤儿卡片（不属于任何牌组的卡片）
   */
  async getOrphanCards(): Promise<Card[]> {
    try {
      const allCards = await this.plugin.dataStorage.getCards();
      const allDecks = await this.plugin.dataStorage.getDecks();
      // 构建所有牌组引用的卡片UUID集合
      const referencedUUIDs = new Set<string>();
      for (const deck of allDecks) {
        if (deck.cardUUIDs) {
          for (const uuid of deck.cardUUIDs) {
            referencedUUIDs.add(uuid);
          }
        }
      }
      return allCards.filter(card => !referencedUUIDs.has(card.uuid));
    } catch (error) {
      logger.error('[ReferenceDeck] 获取孤儿卡片失败:', error);
      return [];
    }
  }

  /**
   * 🆕 删除卡片时的级联操作
   * 从所有引用此卡片的牌组中移除UUID
   * 
   * 注意：此方法应在实际删除卡片数据之前调用
   */
  async cascadeDeleteCard(cardUUID: string): Promise<{ success: boolean; affectedDecks: number; error?: string }> {
    try {
      // 获取卡片被哪些牌组引用
      const referencedDeckIds = await this.getCardReferences(cardUUID);
      
      if (referencedDeckIds.length === 0) {
        logger.debug(`[ReferenceDeck] 卡片 ${cardUUID} 未被任何牌组引用，无需级联删除`);
        return { success: true, affectedDecks: 0 };
      }

      logger.info(`[ReferenceDeck] 开始级联删除卡片 ${cardUUID}，影响 ${referencedDeckIds.length} 个牌组`);

      // 从每个牌组中移除此卡片的UUID
      for (const deckId of referencedDeckIds) {
        try {
          const deck = await this.plugin.dataStorage.getDeck(deckId);
          if (deck && deck.cardUUIDs) {
            deck.cardUUIDs = deck.cardUUIDs.filter(uuid => uuid !== cardUUID);
            deck.modified = new Date().toISOString();
            await this.plugin.dataStorage.saveDeck(deck);
            logger.debug(`[ReferenceDeck] 从牌组 ${deck.name} 移除卡片引用`);
          }
        } catch (deckError) {
          logger.warn(`[ReferenceDeck] 从牌组 ${deckId} 移除卡片引用失败:`, deckError);
          // 继续处理其他牌组
        }
      }

      logger.info(`[ReferenceDeck] ✅ 级联删除完成，从 ${referencedDeckIds.length} 个牌组中移除了卡片引用`);

      return { success: true, affectedDecks: referencedDeckIds.length };
    } catch (error) {
      logger.error('[ReferenceDeck] 级联删除卡片失败:', error);
      return {
        success: false,
        affectedDecks: 0,
        error: error instanceof Error ? error.message : '级联删除失败'
      };
    }
  }

  /**
   * 🆕 批量级联删除卡片
   */
  async cascadeDeleteCards(cardUUIDs: string[]): Promise<{ success: boolean; totalAffectedDecks: number; errors: string[] }> {
    const errors: string[] = [];
    let totalAffectedDecks = 0;

    for (const uuid of cardUUIDs) {
      const result = await this.cascadeDeleteCard(uuid);
      if (result.success) {
        totalAffectedDecks += result.affectedDecks;
      } else if (result.error) {
        errors.push(`${uuid}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      totalAffectedDecks,
      errors
    };
  }

  // ===== 私有方法 =====

  /**
   * 向卡片添加牌组引用
   * 🆕 v2.2: 同时更新 referencedByDecks 和 content YAML 的 we_decks
   * 🔧 性能优化：按牌组分组批量保存
   */
  private async addDeckReferenceToCards(deckId: string, cardUUIDs: string[]): Promise<void> {
    // 获取目标牌组名称（we_decks 存储牌组名称）
    const targetDeck = await this.plugin.dataStorage.getDeck(deckId);
    const deckName = targetDeck?.name || deckId;

    const updatedCards: Card[] = [];

    for (const uuid of cardUUIDs) {
      const card = await this.findCardByUUID(uuid);
      if (card) {
        // 更新 referencedByDecks（向后兼容）
        const refs = new Set(card.referencedByDecks || []);
        refs.add(deckId);
        card.referencedByDecks = Array.from(refs);
        
        // 🆕 v2.2: 同时更新 content YAML 的 we_decks
        if (card.content) {
          const metadata = getCardMetadata(card.content);
          const weDecks = new Set(metadata.we_decks || []);
          weDecks.add(deckName);
          card.content = setCardProperties(card.content, { we_decks: Array.from(weDecks) });
        }
        
        card.modified = new Date().toISOString();

        updatedCards.push(card);
      }
    }

    if (updatedCards.length > 0) {
      const cardsToSave = updatedCards.map((c) => {
        const cloned: any = { ...c };
        delete cloned.deckId;
        return cloned as Card;
      });
      await this.plugin.dataStorage.saveCardsBatch(cardsToSave);
    }
    
    logger.debug(`[ReferenceDeck] 批量更新 ${cardUUIDs.length} 张卡片的反向引用`);
  }

  /**
   * 从卡片移除牌组引用
   * 🆕 v2.2: 同时更新 referencedByDecks 和 content YAML 的 we_decks
   * 🔧 性能优化：按牌组分组批量保存
   * @returns 变成孤儿的卡片UUID数组
   */
  private async removeDeckReferenceFromCards(deckId: string, cardUUIDs: string[]): Promise<string[]> {
    // 获取目标牌组名称（we_decks 存储牌组名称）
    const targetDeck = await this.plugin.dataStorage.getDeck(deckId);
    const deckName = targetDeck?.name || deckId;
    
    const orphanedCards: string[] = [];

    const updatedCards: Card[] = [];

    for (const uuid of cardUUIDs) {
      const card = await this.findCardByUUID(uuid);
      if (card) {
        // 更新 referencedByDecks（向后兼容）
        const refs = new Set(card.referencedByDecks || []);
        refs.delete(deckId);
        card.referencedByDecks = Array.from(refs);
        
        // 🆕 v2.2: 同时更新 content YAML 的 we_decks
        if (card.content) {
          const metadata = getCardMetadata(card.content);
          const weDecks = new Set(metadata.we_decks || []);
          weDecks.delete(deckName);
          card.content = setCardProperties(card.content, { 
            we_decks: weDecks.size > 0 ? Array.from(weDecks) : undefined 
          });
        }
        
        card.modified = new Date().toISOString();

        if (card.referencedByDecks.length === 0) {
          orphanedCards.push(uuid);
        }

        updatedCards.push(card);
      }
    }

    if (updatedCards.length > 0) {
      const cardsToSave = updatedCards.map((c) => {
        const cloned: any = { ...c };
        delete cloned.deckId;
        return cloned as Card;
      });
      await this.plugin.dataStorage.saveCardsBatch(cardsToSave);
    }
    
    logger.debug(`[ReferenceDeck] 批量更新 ${cardUUIDs.length} 张卡片的反向引用，${orphanedCards.length} 张变成孤儿`);

    return orphanedCards;
  }

  /**
   * 通过UUID查找卡片
   */
  private async findCardByUUID(uuid: string): Promise<Card | null> {
    // 优先使用索引服务
    if (this.plugin.cardIndexService) {
      const deckId = this.plugin.cardIndexService.getDeckIdByUUID(uuid);
      if (deckId) {
        const cards = await this.plugin.dataStorage.getDeckCards(deckId);
        return cards.find(c => c.uuid === uuid) || null;
      }
    }

    // 降级：遍历所有卡片
    const allCards = await this.plugin.dataStorage.getCards();
    return allCards.find(c => c.uuid === uuid) || null;
  }

  /**
   * 将牌组中的卡片数据移动到统一卡片存储
   * 
   * 🔧 关键方法：解决解散牌组后卡片丢失的问题
   * 
   * 问题背景：
   * - 旧架构：卡片存储在 weave/decks/{deckId}/cards.json 中
   * - getCards() 遍历 decks.json 来加载卡片
   * - 如果牌组从 decks.json 中删除，其卡片文件仍存在但无法访问
   * 
   * 解决方案（完全引用式架构）：
   * - 将卡片数据移动到统一的卡片存储 weave/cards/default.json
   * - 卡片与牌组完全解耦，牌组只存储 cardUUIDs 引用
   */
  private async moveCardsToUnifiedStorage(deckId: string): Promise<void> {
    try {
      // 1. 读取要解散牌组的所有卡片
      const cardsToMove = await this.plugin.dataStorage.getDeckCards(deckId);
      if (cardsToMove.length === 0) {
        logger.debug(`[ReferenceDeck] 牌组 ${deckId} 没有卡片需要移动`);
        return;
      }

      // 2. 获取 CardFileService（优先使用已初始化的实例）
      let cardFileService = this.plugin.cardFileService;
      if (!cardFileService) {
        const { initCardFileService } = await import('./CardFileService');
        cardFileService = initCardFileService(this.plugin);
        await cardFileService.initialize();
      }

      // 3. 将每张卡片保存到统一存储
      const now = new Date().toISOString();
      let movedCount = 0;
      
      for (const card of cardsToMove) {
        // 移除旧的 deckId（完全引用式架构不需要）
        const updatedCard: Card = {
          ...card,
          modified: now
        };
        // 不再设置 deckId，因为卡片现在独立于牌组存储
        delete (updatedCard as any).deckId;
        
        const success = await cardFileService.saveCard(updatedCard);
        if (success) {
          movedCount++;
        } else {
          logger.warn(`[ReferenceDeck] 卡片 ${card.uuid} 移动到统一存储失败`);
        }
      }

      logger.info(`[ReferenceDeck] ✅ 已将 ${movedCount}/${cardsToMove.length} 张卡片从牌组 ${deckId} 移动到统一卡片存储`);
    } catch (error) {
      logger.error('[ReferenceDeck] 移动卡片到统一存储失败:', error);
      // 不抛出错误，允许解散流程继续
    }
  }

  /**
   * 仅删除牌组（不删除卡片数据）
   */
  private async deleteDeckOnly(deckId: string): Promise<void> {
    const decks = await this.plugin.dataStorage.getDecks();
    const filteredDecks = decks.filter(d => d.id !== deckId);
    
    // 使用 V2 路径写入牌组文件
    const adapter = this.plugin.app.vault.adapter;
    const v2Paths = getV2PathsFromApp(this.plugin.app);
    await DirectoryUtils.ensureDirRecursive(adapter, v2Paths.memory.root);
    await adapter.write(
      v2Paths.memory.decks,
      JSON.stringify({ decks: filteredDecks })
    );
  }

  /**
   * 确保存在默认牌组
   */
  private async ensureDefaultDeck(): Promise<void> {
    const { generateUUID } = await import('../../utils/helpers');
    const now = new Date();
    
    const defaultDeck: Deck = {
      id: `deck_${generateUUID().slice(0, 12)}`,
      name: '默认牌组',
      description: '自动创建的默认牌组',
      category: '默认',
      cardUUIDs: [],
      path: '默认牌组',
      level: 0,
      order: 0,
      inheritSettings: false,
      created: now.toISOString(),
      modified: now.toISOString(),
      settings: await this.getDefaultDeckSettings(),
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
      },
      tags: [],
      metadata: { autoCreated: true }
    };

    await this.plugin.dataStorage.saveDeck(defaultDeck);
    logger.info('[ReferenceDeck] 自动创建默认牌组');
  }

  /**
   * 获取默认牌组设置
   */
  private async getDefaultDeckSettings() {
    return {
      newCardsPerDay: 20,
      maxReviewsPerDay: 100,
      enableAutoAdvance: true,
      showAnswerTime: 0,
      fsrsParams: {
        w: [
          0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
          0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729,
          0.5425, 0.0912, 0.0658, 0.1542
        ],
        requestRetention: 0.9,
        maximumInterval: 36500,
        enableFuzz: true
      },
      learningSteps: [1, 10],
      relearningSteps: [10],
      graduatingInterval: 1,
      easyInterval: 4
    };
  }
}

// 单例导出
let referenceDeckServiceInstance: ReferenceDeckService | null = null;

export function getReferenceDeckService(plugin?: WeavePlugin): ReferenceDeckService {
  if (!referenceDeckServiceInstance && plugin) {
    referenceDeckServiceInstance = new ReferenceDeckService(plugin);
  }
  if (!referenceDeckServiceInstance) {
    throw new Error('ReferenceDeckService not initialized');
  }
  return referenceDeckServiceInstance;
}

export function initReferenceDeckService(plugin: WeavePlugin): ReferenceDeckService {
  referenceDeckServiceInstance = new ReferenceDeckService(plugin);
  return referenceDeckServiceInstance;
}
