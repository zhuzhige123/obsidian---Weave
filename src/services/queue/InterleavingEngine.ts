/**
 * Interleaving Engine
 * 
 * 负责实现交错学习算法
 * 
 * 核心功能：
 * 1. 按标签分组卡片
 * 2. 组内按优先级排序
 * 3. 轮询式交错排列
 * 
 * 时间复杂度：O(n)
 * 
 * @version 1.0.0
 * @since 2025-12-04
 */

import type { Card } from '../../data/types';
import type {
  InterleavingConfig,
  CardWithQueueOptimization
} from '../../types/queue-optimization-types';
import { logger } from '../../utils/logger';

export class InterleavingEngine {
  private config: InterleavingConfig;
  
  constructor(config: InterleavingConfig) {
    this.config = config;
    logger.debug('[InterleavingEngine] Initialized', { config });
  }
  
  /**
   * 交错卡片
   * 
   * @param cards 原始卡片列表
   * @returns 交错后的卡片列表
   */
  interleave(cards: CardWithQueueOptimization[]): CardWithQueueOptimization[] {
    if (!this.config.enabled) {
      logger.debug('[InterleavingEngine] Interleaving disabled, returning original order');
      return cards;
    }
    
    if (cards.length < this.config.minGroupSize) {
      logger.debug('[InterleavingEngine] Too few cards, skipping interleaving', {
        cardCount: cards.length,
        minGroupSize: this.config.minGroupSize
      });
      return cards;
    }
    
    logger.debug('[InterleavingEngine] Starting interleaving', {
      cardCount: cards.length,
      mode: this.config.mode
    });
    
    switch (this.config.mode) {
      case 'tag':
        return this.interleaveByTag(cards);
        
      case 'smart':
        return this.smartInterleave(cards);
        
      case 'random':
        return this.randomShuffle(cards);
        
      default:
        logger.warn('[InterleavingEngine] Unknown mode, using tag mode', {
          mode: this.config.mode
        });
        return this.interleaveByTag(cards);
    }
  }
  
  /**
   * 按标签交错
   */
  private interleaveByTag(cards: CardWithQueueOptimization[]): CardWithQueueOptimization[] {
    // 1. 按标签分组
    const groups = this.groupByTag(cards);
    
    if (groups.size < 2) {
      logger.debug('[InterleavingEngine] Only one tag group, no interleaving needed');
      return cards;
    }
    
    logger.debug('[InterleavingEngine] Grouped by tags', {
      groupCount: groups.size,
      groups: Array.from(groups.entries()).map(([tag, cards]) => ({
        tag,
        count: cards.length
      }))
    });
    
    // 2. 组内排序（如果配置了尊重优先级）
    if (this.config.respectPriority) {
      groups.forEach(group => {
        group.sort((a, b) => this.compareCards(a, b));
      });
    }
    
    // 3. 轮询式交错
    return this.roundRobinInterleave(Array.from(groups.values()));
  }
  
  /**
   * 智能交错（分层交错）
   * 
   * 先按优先级分层，每层内再交错
   */
  private smartInterleave(cards: CardWithQueueOptimization[]): CardWithQueueOptimization[] {
    // 按State分层
    const layers = this.groupByState(cards);
    
    logger.debug('[InterleavingEngine] Smart interleaving', {
      layerCount: layers.size
    });
    
    // 每层内交错
    const result: CardWithQueueOptimization[] = [];
    
    // 按State优先级顺序处理（Learning > Relearning > Review > New）
    const stateOrder = [1, 3, 2, 0];  // CardState枚举值
    
    stateOrder.forEach(state => {
      const layer = layers.get(state);
      if (layer && layer.length > 0) {
        // 该层内按标签交错
        const interleaved = this.interleaveByTag(layer);
        result.push(...interleaved);
      }
    });
    
    return result;
  }
  
  /**
   * 随机打乱
   */
  private randomShuffle(cards: CardWithQueueOptimization[]): CardWithQueueOptimization[] {
    const shuffled = [...cards];
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    logger.debug('[InterleavingEngine] Random shuffle completed');
    
    return shuffled;
  }
  
  /**
   * 按标签分组
   */
  private groupByTag(cards: CardWithQueueOptimization[]): Map<string, CardWithQueueOptimization[]> {
    const groups = new Map<string, CardWithQueueOptimization[]>();
    
    cards.forEach(card => {
      const tag = this.getPrimaryTag(card);
      
      if (!groups.has(tag)) {
        groups.set(tag, []);
      }
      
      groups.get(tag)!.push(card);
    });
    
    return groups;
  }
  
  /**
   * 按State分组
   */
  private groupByState(cards: CardWithQueueOptimization[]): Map<number, CardWithQueueOptimization[]> {
    const groups = new Map<number, CardWithQueueOptimization[]>();
    
    cards.forEach(card => {
      // 防御性检查
      if (!card.fsrs) {
        logger.warn('[InterleavingEngine] Card missing fsrs data', { cardId: card.uuid });
        return;
      }
      
      const state = card.fsrs.state;
      
      if (!groups.has(state)) {
        groups.set(state, []);
      }
      
      groups.get(state)!.push(card);
    });
    
    return groups;
  }
  
  /**
   * 获取主要标签
   * 
   * 规则：
   * 1. 忽略特殊标签（#困难、#回收等）
   * 2. 提取一级标签（如 #英语/单词 → 英语）
   * 3. 无标签返回 __untagged__
   */
  private getPrimaryTag(card: Card): string {
    if (!card.tags || card.tags.length === 0) {
      return '__untagged__';
    }
    
    // 特殊标签列表
    const specialTags = ['#困难', '#需关注', '#回收', '#已改进'];
    
    // 过滤掉特殊标签
    const normalTags = card.tags.filter(tag => !specialTags.includes(tag));
    
    if (normalTags.length === 0) {
      return '__untagged__';
    }
    
    // 取第一个标签的一级分类
    const firstTag = normalTags[0];
    
    // 提取一级标签（#英语/单词 → 英语）
    const parts = firstTag.split('/');
    return parts[0].replace('#', '').trim() || '__untagged__';
  }
  
  /**
   * 轮询式交错
   * 
   * 时间复杂度：O(n)
   */
  private roundRobinInterleave(
    groups: CardWithQueueOptimization[][]
  ): CardWithQueueOptimization[] {
    const result: CardWithQueueOptimization[] = [];
    const maxLength = Math.max(...groups.map(g => g.length));
    
    for (let i = 0; i < maxLength; i++) {
      for (const group of groups) {
        if (group[i]) {
          result.push(group[i]);
        }
      }
    }
    
    logger.debug('[InterleavingEngine] Round robin interleaving completed', {
      resultCount: result.length
    });
    
    return result;
  }
  
  /**
   * 比较卡片（用于排序）
   * 
   * 排序规则：
   * 1. Priority（用户优先级）
   * 2. Due时间
   */
  private compareCards(a: Card, b: Card): number {
    // 1. 优先级
    const priorityA = a.priority || 2;
    const priorityB = b.priority || 2;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // 2. Due时间（防御性检查）
    if (!a.fsrs || !b.fsrs) {
      return 0; // 如果缺少fsrs数据，视为相等
    }
    
    const dueA = new Date(a.fsrs.due).getTime();
    const dueB = new Date(b.fsrs.due).getTime();
    
    return dueA - dueB;
  }
  
  /**
   * 验证交错结果
   * 
   * 检查是否有连续相同标签超过阈值
   */
  validateInterleaving(cards: CardWithQueueOptimization[]): {
    valid: boolean;
    maxConsecutive: number;
    violations: number;
  } {
    if (cards.length < 2) {
      return { valid: true, maxConsecutive: 0, violations: 0 };
    }
    
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    let violations = 0;
    let lastTag = this.getPrimaryTag(cards[0]);
    
    for (let i = 1; i < cards.length; i++) {
      const currentTag = this.getPrimaryTag(cards[i]);
      
      if (currentTag === lastTag && currentTag !== '__untagged__') {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        
        if (currentConsecutive > this.config.maxConsecutiveSameTag) {
          violations++;
        }
      } else {
        currentConsecutive = 1;
      }
      
      lastTag = currentTag;
    }
    
    const valid = violations === 0;
    
    logger.debug('[InterleavingEngine] Validation result', {
      valid,
      maxConsecutive,
      violations,
      threshold: this.config.maxConsecutiveSameTag
    });
    
    return { valid, maxConsecutive, violations };
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<InterleavingConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('[InterleavingEngine] Config updated', { config: this.config });
  }
  
  /**
   * 获取配置
   */
  getConfig(): InterleavingConfig {
    return { ...this.config };
  }
}
