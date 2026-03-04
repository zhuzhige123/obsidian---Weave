/**
 * Queue Optimization Coordinator
 * 
 * 队列优化总协调器
 * 
 * 核心职责：
 * 1. 统一管理队列优化（Interleaving + Priority）
 * 2. 协调各个子系统
 * 3. 提供统一的API接口
 * 4. 管理优化缓存
 * 
 * @version 1.0.0
 * @since 2025-12-04
 */

import type { Card } from '../../data/types';
import type {
  QueueOptimizationSettings,
  CardWithQueueOptimization
} from '../../types/queue-optimization-types';
import { InterleavingEngine } from './InterleavingEngine';
import { PriorityCalculator } from './PriorityCalculator';
import { logger } from '../../utils/logger';

/**
 * 带优先级的卡片
 */
interface CardWithPriority {
  card: CardWithQueueOptimization;
  priority: number;
}

export class QueueOptimizationCoordinator {
  private interleavingEngine: InterleavingEngine;
  private priorityCalculator: PriorityCalculator;
  private settings: QueueOptimizationSettings;
  
  // 优先级缓存（避免重复计算）
  private priorityCache: WeakMap<Card, number> = new WeakMap();
  
  constructor(
    interleavingEngine: InterleavingEngine,
    priorityCalculator: PriorityCalculator,
    settings: QueueOptimizationSettings
  ) {
    this.interleavingEngine = interleavingEngine;
    this.priorityCalculator = priorityCalculator;
    this.settings = settings;
    
    logger.debug('[QueueCoordinator] Initialized', { settings });
  }
  
  /**
   * 优化队列
   * 
   * 核心算法：
   * 1. 计算所有卡片的优先级（带缓存）
   * 2. 按优先级分层
   * 3. 每层内Interleaving
   * 4. 合并结果
   * 
   * 时间复杂度：O(n log n)
   */
  async optimizeQueue(cards: CardWithQueueOptimization[]): Promise<CardWithQueueOptimization[]> {
    if (cards.length === 0) {
      logger.debug('[QueueCoordinator] Empty queue, nothing to optimize');
      return [];
    }
    
    logger.debug('[QueueCoordinator] Starting queue optimization', {
      cardCount: cards.length
    });
    
    const startTime = performance.now();
    
    try {
      // === 步骤1：计算优先级 ===
      const cardsWithPriority = this.calculatePriorities(cards);
      
      // === 步骤2：按优先级分层 ===
      const layers = this.groupByPriorityLayer(cardsWithPriority);
      
      logger.debug('[QueueCoordinator] Priority layers', {
        layerCount: layers.length,
        distribution: layers.map(layer => layer.length)
      });
      
      // === 步骤3：每层内Interleaving ===
      const optimizedLayers = layers.map(layer => this.optimizeLayer(layer));
      
      // === 步骤4：合并结果 ===
      const result = optimizedLayers.flat();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      logger.debug('[QueueCoordinator] Queue optimization completed', {
        cardCount: result.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return result;
      
    } catch (error) {
      logger.error('[QueueCoordinator] Queue optimization failed', { error });
      // 失败时返回原始队列
      return cards;
    }
  }
  
  /**
   * 计算所有卡片的优先级
   */
  private calculatePriorities(
    cards: CardWithQueueOptimization[]
  ): CardWithPriority[] {
    return cards.map(card => ({
      card,
      priority: this.getPriority(card)
    }));
  }
  
  /**
   * 获取优先级（带缓存）
   */
  private getPriority(card: CardWithQueueOptimization): number {
    // 检查缓存
    const cached = this.priorityCache.get(card);
    if (cached !== undefined) {
      return cached;
    }
    
    // 计算优先级
    const priority = this.priorityCalculator.calculate(card);
    
    // 写入缓存
    this.priorityCache.set(card, priority);
    
    return priority;
  }
  
  /**
   * 按优先级分层
   * 
   * 分层策略：
   * - Layer 1: Priority 100-199 (Learning)
   * - Layer 2: Priority 200-299 (Relearning)
   * - Layer 3: Priority 300-399 (Review)
   * - Layer 4: Priority 400+ (New)
   */
  private groupByPriorityLayer(
    items: CardWithPriority[]
  ): CardWithPriority[][] {
    const layers: Map<number, CardWithPriority[]> = new Map();
    
    items.forEach(item => {
      // 按100分层
      const layerKey = Math.floor(item.priority / 100);
      
      if (!layers.has(layerKey)) {
        layers.set(layerKey, []);
      }
      
      layers.get(layerKey)!.push(item);
    });
    
    // 按层级排序（从低到高，即从高优先级到低优先级）
    return Array.from(layers.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, items]) => items);
  }
  
  /**
   * 优化单层
   */
  private optimizeLayer(layer: CardWithPriority[]): CardWithQueueOptimization[] {
    if (layer.length === 0) {
      return [];
    }
    
    // 提取卡片
    const cards = layer.map(item => item.card);
    
    if (!this.settings.interleaving.enabled) {
      // Interleaving关闭，直接按优先级排序
      return layer
        .sort((a, b) => a.priority - b.priority)
        .map(item => item.card);
    }
    
    // 应用Interleaving
    return this.interleavingEngine.interleave(cards);
  }
  
  /**
   * 刷新队列（评分后调用）
   * 
   * 只刷新剩余卡片，避免重新计算已学习的卡片
   */
  async refreshQueue(
    remainingCards: CardWithQueueOptimization[],
    updatedCard?: CardWithQueueOptimization
  ): Promise<CardWithQueueOptimization[]> {
    // 清除更新卡片的缓存
    if (updatedCard) {
      this.priorityCache.delete(updatedCard);
    }
    
    // 重新优化剩余队列
    return this.optimizeQueue(remainingCards);
  }
  
  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.priorityCache = new WeakMap();
    this.priorityCalculator.clearCache();
    logger.debug('[QueueCoordinator] All caches cleared');
  }
  
  /**
   * 使指定卡片的缓存失效
   */
  invalidateCache(card: Card): void {
    this.priorityCache.delete(card);
    this.priorityCalculator.invalidateCache(card);
    logger.debug('[QueueCoordinator] Cache invalidated', { cardId: card.uuid });
  }
  
  /**
   * 获取队列统计信息
   */
  getQueueStatistics(cards: CardWithQueueOptimization[]): {
    total: number;
    byState: Record<number, number>;
    byPriority: Record<number, number>;
    avgPriority: number;
  } {
    const stats = {
      total: cards.length,
      byState: {} as Record<number, number>,
      byPriority: {} as Record<number, number>,
      avgPriority: 0
    };
    
    let prioritySum = 0;
    
    cards.forEach(card => {
      // 统计State分布
      const state = card.fsrs!.state;
      stats.byState[state] = (stats.byState[state] || 0) + 1;
      
      // 统计Priority分布
      const priority = card.priority || 2;
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      
      // 累加优先级
      prioritySum += this.getPriority(card);
    });
    
    // 计算平均优先级
    stats.avgPriority = cards.length > 0 ? prioritySum / cards.length : 0;
    
    return stats;
  }
  
  /**
   * 验证队列质量
   */
  validateQueue(cards: CardWithQueueOptimization[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // 1. 检查是否为空
    if (cards.length === 0) {
      issues.push('队列为空');
    }
    
    // 2. 检查Interleaving质量
    if (this.settings.interleaving.enabled) {
      const interleavingResult = this.interleavingEngine.validateInterleaving(cards);
      
      if (!interleavingResult.valid) {
        issues.push(
          `交错质量不佳：最大连续${interleavingResult.maxConsecutive}张相同标签，` +
          `违规${interleavingResult.violations}次`
        );
      }
    }
    
    // 3. 检查优先级顺序
    let prevPriority = -Infinity;
    for (const card of cards) {
      const priority = this.getPriority(card);
      if (priority < prevPriority) {
        issues.push('优先级顺序不正确');
        break;
      }
      prevPriority = priority;
    }
    
    const valid = issues.length === 0;
    
    logger.debug('[QueueCoordinator] Queue validation', {
      valid,
      issues
    });
    
    return { valid, issues };
  }
  
  /**
   * 更新设置
   */
  updateSettings(settings: Partial<QueueOptimizationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    // 更新子系统配置
    if (settings.interleaving) {
      this.interleavingEngine.updateConfig(settings.interleaving);
    }
    
    if (settings.priority) {
      this.priorityCalculator.updateConfig(settings.priority);
    }
    
    // 清除缓存
    this.clearCache();
    
    logger.debug('[QueueCoordinator] Settings updated', { settings: this.settings });
  }
  
  /**
   * 获取设置
   */
  getSettings(): QueueOptimizationSettings {
    return { ...this.settings };
  }
  
  /**
   * 获取Interleaving Engine
   */
  getInterleavingEngine(): InterleavingEngine {
    return this.interleavingEngine;
  }
  
  /**
   * 获取Priority Calculator
   */
  getPriorityCalculator(): PriorityCalculator {
    return this.priorityCalculator;
  }
}
