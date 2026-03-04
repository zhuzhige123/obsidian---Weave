/**
 * 数据一致性检查服务 (v2.0)
 * 
 * 核心职责：
 * 1. 检查双向引用的一致性
 * 2. 发现并报告孤儿卡片
 * 3. 发现并报告无效引用
 * 4. 提供数据修复功能
 * 
 * 修复策略：
 * - 以牌组的 cardUUIDs 为权威数据源
 * - 重建卡片的 referencedByDecks
 */

import type { Card, DataConsistencyCheckResult } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { getCardDeckIds } from '../../utils/yaml-utils';
import { logger } from '../../utils/logger';

export interface RepairResult {
  success: boolean;
  /** 修复的卡片数量 */
  repairedCards: number;
  /** 清理的无效引用数量 */
  cleanedInvalidRefs: number;
  /** 错误信息 */
  error?: string;
}

export class DataConsistencyService {
  private plugin: WeavePlugin;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 执行完整的数据一致性检查
   */
  async checkConsistency(): Promise<DataConsistencyCheckResult> {
    const startTime = Date.now();
    logger.info('[DataConsistency] 开始数据一致性检查...');

    try {
      const decks = await this.plugin.dataStorage.getDecks();
      const allCards = await this.plugin.dataStorage.getCards();

      // 构建卡片UUID集合（用于快速查找）
      const cardUUIDSet = new Set(allCards.map(c => c.uuid));

      // 构建实际的卡片-牌组映射（从牌组的cardUUIDs推导）
      const actualCardDeckMap = new Map<string, Set<string>>();
      const missingDeckRefs: string[] = [];

      for (const deck of decks) {
        for (const uuid of (deck.cardUUIDs || [])) {
          if (!cardUUIDSet.has(uuid)) {
            // 牌组引用了不存在的卡片
            missingDeckRefs.push(`${deck.id}:${uuid}`);
          } else {
            // 记录有效的引用关系
            if (!actualCardDeckMap.has(uuid)) {
              actualCardDeckMap.set(uuid, new Set());
            }
            actualCardDeckMap.get(uuid)!.add(deck.id);
          }
        }
      }

      // 检查孤儿卡片和反向引用一致性
      const orphanedCards: string[] = [];
      const missingCardRefs: string[] = [];

      for (const card of allCards) {
        const actualRefs = actualCardDeckMap.get(card.uuid);
        const expectedRefs = actualRefs ? Array.from(actualRefs).sort() : [];
        const currentRefs = (card.referencedByDecks || []).sort();

        // 检查是否为孤儿卡片
        if (expectedRefs.length === 0) {
          orphanedCards.push(card.uuid);
        }

        // 检查反向引用是否一致
        if (JSON.stringify(expectedRefs) !== JSON.stringify(currentRefs)) {
          missingCardRefs.push(card.uuid);
        }
      }

      const isConsistent = 
        missingDeckRefs.length === 0 && 
        missingCardRefs.length === 0;

      const result: DataConsistencyCheckResult = {
        isConsistent,
        checkedAt: Date.now(),
        totalCards: allCards.length,
        totalDecks: decks.length,
        orphanCards: orphanedCards,
        invalidReferences: [], // 简化：不再详细记录每个牌组的无效引用
        inconsistentBackReferences: missingCardRefs.map(uuid => ({
          cardUUID: uuid,
          expected: Array.from(actualCardDeckMap.get(uuid) || []),
          actual: allCards.find(c => c.uuid === uuid)?.referencedByDecks || []
        }))
      };

      const duration = Date.now() - startTime;
      logger.info(`[DataConsistency] 检查完成 (${duration}ms):`, {
        isConsistent,
        totalCards: allCards.length,
        totalDecks: decks.length,
        orphanCards: orphanedCards.length,
        missingCardRefs: missingCardRefs.length,
        missingDeckRefs: missingDeckRefs.length
      });

      return result;
    } catch (error) {
      logger.error('[DataConsistency] 检查失败:', error);
      return {
        isConsistent: false,
        checkedAt: Date.now(),
        totalCards: 0,
        totalDecks: 0,
        orphanCards: [],
        invalidReferences: [],
        inconsistentBackReferences: []
      };
    }
  }

  /**
   * 修复数据一致性问题
   * 
   * 修复策略：
   * 1. 以牌组的 cardUUIDs 为权威数据源
   * 2. 重建所有卡片的 referencedByDecks
   * 3. 清理牌组中的无效UUID引用
   * 
   * 🔧 性能优化：按牌组分组批量保存
   */
  async repairConsistency(): Promise<RepairResult> {
    logger.info('[DataConsistency] 开始修复数据一致性...');

    try {
      const decks = await this.plugin.dataStorage.getDecks();
      const allCards = await this.plugin.dataStorage.getCards();

      // 构建卡片UUID集合
      const cardUUIDSet = new Set(allCards.map(c => c.uuid));

      // 构建实际的卡片-牌组映射
      const actualCardDeckMap = new Map<string, Set<string>>();
      let cleanedInvalidRefs = 0;

      // 第一步：清理牌组中的无效引用，并构建正确的映射
      for (const deck of decks) {
        const validUUIDs: string[] = [];
        
        for (const uuid of (deck.cardUUIDs || [])) {
          if (cardUUIDSet.has(uuid)) {
            validUUIDs.push(uuid);
            
            if (!actualCardDeckMap.has(uuid)) {
              actualCardDeckMap.set(uuid, new Set());
            }
            actualCardDeckMap.get(uuid)!.add(deck.id);
          } else {
            cleanedInvalidRefs++;
          }
        }

        // 如果有无效引用被清理，更新牌组
        if (validUUIDs.length !== (deck.cardUUIDs || []).length) {
          deck.cardUUIDs = validUUIDs;
          deck.modified = new Date().toISOString();
          await this.plugin.dataStorage.saveDeck(deck);
          logger.debug(`[DataConsistency] 清理牌组 ${deck.name} 的无效引用`);
        }
      }

      // 第二步：重建所有卡片的 referencedByDecks（批量保存优化）
      let repairedCards = 0;
      
      // 按卡片所在牌组分组
      const cardsByDeck = new Map<string, Card[]>();

      for (const card of allCards) {
        const actualRefs = actualCardDeckMap.get(card.uuid);
        const expectedRefs = actualRefs ? Array.from(actualRefs).sort() : [];
        const currentRefs = (card.referencedByDecks || []).sort();

        if (JSON.stringify(expectedRefs) !== JSON.stringify(currentRefs)) {
          card.referencedByDecks = expectedRefs;
          card.modified = new Date().toISOString();
          repairedCards++;
          
          // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
          const { primaryDeckId } = getCardDeckIds(card);
          const cardDeckId = primaryDeckId || card.deckId || 'default';
          if (!cardsByDeck.has(cardDeckId)) {
            cardsByDeck.set(cardDeckId, []);
          }
          cardsByDeck.get(cardDeckId)!.push(card);
        }
      }
      
      // 批量保存每个牌组的卡片
      for (const [deckId, cards] of cardsByDeck) {
        // 读取该牌组的所有卡片
        const allDeckCards = await this.plugin.dataStorage.getDeckCards(deckId);
        
        // 更新修改过的卡片
        const cardMap = new Map(cards.map(c => [c.uuid, c]));
        const updatedCards = allDeckCards.map(c => cardMap.get(c.uuid) || c);
        
        // 批量保存
        await this.plugin.dataStorage.saveDeckCards(deckId, updatedCards);
        logger.debug(`[DataConsistency] 批量保存牌组 ${deckId} 的 ${cards.length} 张卡片`);
      }

      logger.info(`[DataConsistency] 修复完成: 修复 ${repairedCards} 张卡片, 清理 ${cleanedInvalidRefs} 个无效引用`);

      return {
        success: true,
        repairedCards,
        cleanedInvalidRefs
      };
    } catch (error) {
      logger.error('[DataConsistency] 修复失败:', error);
      return {
        success: false,
        repairedCards: 0,
        cleanedInvalidRefs: 0,
        error: error instanceof Error ? error.message : '修复失败'
      };
    }
  }

  /**
   * 快速检查（仅检查是否一致，不返回详细信息）
   */
  async quickCheck(): Promise<boolean> {
    try {
      const result = await this.checkConsistency();
      return result.isConsistent;
    } catch {
      return false;
    }
  }
}

// 单例导出
let dataConsistencyServiceInstance: DataConsistencyService | null = null;

export function getDataConsistencyService(plugin?: WeavePlugin): DataConsistencyService {
  if (!dataConsistencyServiceInstance && plugin) {
    dataConsistencyServiceInstance = new DataConsistencyService(plugin);
  }
  if (!dataConsistencyServiceInstance) {
    throw new Error('DataConsistencyService not initialized');
  }
  return dataConsistencyServiceInstance;
}

export function initDataConsistencyService(plugin: WeavePlugin): DataConsistencyService {
  dataConsistencyServiceInstance = new DataConsistencyService(plugin);
  return dataConsistencyServiceInstance;
}
