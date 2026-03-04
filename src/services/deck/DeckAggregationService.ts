import { logger } from '../../utils/logger';
/**
 * 牌组聚合服务
 * 
 * 负责分析牌组内卡片的聚合特征，支持多种分组方式
 */

import type { Deck, Card, CardType } from '../../data/types';
import type { WeaveDataStorage } from '../../data/storage';
import type { DeckGroupByType, DeckTagGroup } from '../../types/deck-kanban-types';
import { getCardDeckIds } from '../../utils/yaml-utils';

/**
 * 牌组统计数据接口
 */
interface DeckStats {
  newCards: number;
  learningCards: number;
  reviewCards: number;
  memoryRate: number;
}

/**
 * 牌组聚合服务类
 */
export class DeckAggregationService {
  private storage: WeaveDataStorage;
  private cardsCache: Card[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 30000; // 30秒缓存有效期
  private deckStats?: Record<string, DeckStats>; //  实时统计数据

  constructor(storage: WeaveDataStorage, deckStats?: Record<string, DeckStats>) {
    this.storage = storage;
    this.deckStats = deckStats;
  }

  /**
   * 更新统计数据（用于响应式更新）
   */
  updateDeckStats(deckStats: Record<string, DeckStats>): void {
    this.deckStats = deckStats;
  }

  /**
   * 获取所有卡片（带缓存）
   */
  private async getAllCards(): Promise<Card[]> {
    const now = Date.now();
    
    // 如果缓存有效，直接返回
    if (this.cardsCache && (now - this.cacheTimestamp < this.CACHE_TTL)) {
      return this.cardsCache;
    }
    
    // 重新获取并缓存
    this.cardsCache = await this.storage.getCards();
    this.cacheTimestamp = now;
    return this.cardsCache;
  }

  /**
   * 清除缓存（在数据更新时调用）
   */
  public clearCache(): void {
    this.cardsCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * 🆕 v2.0: 获取牌组的卡片（引用式架构）
   * 优先使用 deck.cardUUIDs，回退到 card.referencedByDecks
   */
  private getDeckCards(allCards: Card[], deck: Deck): Card[] {
    // 方式1：通过 deck.cardUUIDs 获取（优先）
    if (deck.cardUUIDs && deck.cardUUIDs.length > 0) {
      const uuidSet = new Set(deck.cardUUIDs);
      return allCards.filter(card => uuidSet.has(card.uuid));
    }
    
    // 方式2：通过 card.referencedByDecks 获取
    // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
    return allCards.filter(card => {
      const { deckIds } = getCardDeckIds(card);
      return deckIds.includes(deck.id) || 
             card.referencedByDecks?.includes(deck.id) || 
             card.deckId === deck.id;
    });
  }

  /**
   * 分析牌组的完成情况
   * 
   * @param deck 牌组对象
   * @returns 分组key: 'new' | 'learning' | 'review' | 'completed'
   */
  analyzeCompletion(deck: Deck): string {
    //  优先使用实时统计数据（准确），fallback到deck.stats
    const stats = this.deckStats?.[deck.id] || deck.stats;

    //  优先级：新卡片 > 学习中 > 待复习 > 已完成
    // 只有当今日没有任何需要学习的卡片时，才归类为"已完成"
    if (stats.newCards > 0) {
      return 'new';
    } else if (stats.learningCards > 0) {
      return 'learning';
    } else if (stats.reviewCards > 0) {
      return 'review';
    } else {
      return 'completed';
    }
  }

  /**
   * 分析牌组的时间范围
   * 
   * @param deck 牌组对象
   * @returns 分组key: 'urgent' | 'today' | 'thisWeek' | 'future'
   */
  async analyzeTimeRange(deck: Deck): Promise<string> {
    try {
      // 使用缓存获取牌组所有卡片
      const allCards = await this.getAllCards();
      // 🆕 v2.0: 引用式牌组架构 - 优先使用 deck.cardUUIDs，回退到 card.referencedByDecks
      const deckCards = this.getDeckCards(allCards, deck);

      if (deckCards.length === 0) {
        return 'future';
      }

      // 找出最早到期的卡片
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      let earliestDue: Date | null = null;

      for (const card of deckCards) {
        //  跳过没有FSRS数据的卡片
        if (!card.fsrs) continue;
        
        const dueDate = new Date(card.fsrs.due);
        if (!earliestDue || dueDate < earliestDue) {
          earliestDue = dueDate;
        }
      }

      if (!earliestDue) {
        return 'future';
      }

      // 判断时间范围
      if (earliestDue < now) {
        return 'urgent'; // 已过期
      } else if (earliestDue < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
        return 'today'; // 今天到期
      } else if (earliestDue < weekEnd) {
        return 'thisWeek'; // 本周到期
      } else {
        return 'future'; // 未来到期
      }
    } catch (error) {
      logger.error('Error analyzing time range:', error);
      return 'future';
    }
  }


  /**
   * 分析牌组的优先级
   * 
   * @param deck 牌组对象
   * @returns 分组key: 'high' | 'medium' | 'low' | 'none'
   */
  async analyzePriority(deck: Deck): Promise<string> {
    try {
      //  优先从牌组的metadata中读取优先级（支持拖拽设置）
      if (deck.metadata?.priority) {
        return deck.metadata.priority as string;
      }
      
      //  备选方案：分析牌组内卡片的优先级
      // 使用缓存获取牌组所有卡片
      const allCards = await this.getAllCards();
      // 🆕 v2.0: 引用式牌组架构 - 优先使用 deck.cardUUIDs，回退到 card.referencedByDecks
      const deckCards = this.getDeckCards(allCards, deck);

      if (deckCards.length === 0) {
        return 'none';
      }

      // 检查是否存在各优先级的卡片
      let hasHigh = false;
      let hasMedium = false;
      let hasLow = false;

      for (const card of deckCards) {
        const priority = card.priority || 0;
        if (priority === 4) hasHigh = true;
        else if (priority === 3) hasMedium = true;
        else if (priority === 2) hasLow = true;
      }

      // 按优先级从高到低返回
      if (hasHigh) return 'high';
      if (hasMedium) return 'medium';
      if (hasLow) return 'low';
      return 'none';
    } catch (error) {
      logger.error('Error analyzing priority:', error);
      return 'none';
    }
  }

  /**
   * 分析牌组的标签
   * 
   * @param deck 牌组对象
   * @returns 标签名称或'noTag'
   */
  analyzeTag(deck: Deck): string {
    // 牌组的tags数组中，只取第一个标签（单选）
    if (deck.tags && deck.tags.length > 0) {
      return deck.tags[0];
    }
    return 'noTag';
  }

  /**
   * 根据标签组分析牌组
   * 
   * @param deck 牌组对象
   * @param tagGroup 标签组定义
   * @returns 匹配的标签名称或'__other__'
   */
  analyzeTagGroup(deck: Deck, tagGroup: DeckTagGroup): string {
    // 检查牌组的标签是否包含标签组中的任意标签
    if (deck.tags && deck.tags.length > 0) {
      for (const tag of tagGroup.tags) {
        if (deck.tags.includes(tag)) {
          return tag; // 返回第一个匹配的标签
        }
      }
    }
    // 不在标签组中，归类到"其他"
    return '__other__';
  }


  /**
   * 对牌组列表进行分组
   * 
   * @param decks 牌组列表
   * @param groupBy 分组方式
   * @param tagGroup 标签组（当groupBy为'tagGroup'时必需）
   * @returns 分组后的牌组对象
   */
  async groupDecks(
    decks: Deck[],
    groupBy: DeckGroupByType,
    tagGroup?: DeckTagGroup
  ): Promise<Record<string, Deck[]>> {
    const grouped: Record<string, Deck[]> = {};

    // 根据分组方式分析每个牌组
    // 对于需要异步操作的分组方式，使用Promise.all并行处理
    if (groupBy === 'timeRange' || groupBy === 'priority') {
      // 并行处理所有牌组
      const results = await Promise.all(
        decks.map(async (deck) => {
          let groupKey: string;

          switch (groupBy) {
            case 'timeRange':
              groupKey = await this.analyzeTimeRange(deck);
              break;
            case 'priority':
              groupKey = await this.analyzePriority(deck);
              break;
            default:
              groupKey = 'unknown';
          }
          
          return { deck, groupKey };
        })
      );
      
      // 组织结果
      for (const { deck, groupKey } of results) {
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push(deck);
      }
    } else {
      // 同步分组方式（completion, tag, tagGroup）
      for (const deck of decks) {
        let groupKey: string;

        switch (groupBy) {
          case 'completion':
            groupKey = this.analyzeCompletion(deck);
            break;
          case 'tag':
            groupKey = this.analyzeTag(deck);
            break;
          case 'tagGroup':
            // 按标签组分组，需要传入tagGroup
            if (!tagGroup) {
              logger.error('tagGroup is required when groupBy is "tagGroup"');
              groupKey = '__other__';
            } else {
              groupKey = this.analyzeTagGroup(deck, tagGroup);
            }
            break;
          default:
            groupKey = 'unknown';
        }

        // 初始化分组数组
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }

        // 将牌组添加到对应分组
        grouped[groupKey].push(deck);
      }
    }

    return grouped;
  }

  /**
   * 扁平化牌组树
   * 
   * @param deckTree 牌组树节点数组
   * @returns 扁平化的牌组列表
   */
  flattenDeckTree(deckTree: any[]): Deck[] {
    const result: Deck[] = [];

    const flatten = (nodes: any[]) => {
      for (const node of nodes) {
        result.push(node.deck);
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      }
    };

    flatten(deckTree);
    return result;
  }
}

