/**
 * Priority Calculator
 * 
 * 负责计算卡片的最终优先级
 * 
 * 优先级公式（四层）：
 * Priority = StatePriority + UserPriority + DifficultyAdjustment + LeechBoost
 * 
 * 数值越小，优先级越高
 * 
 * @version 1.0.0
 * @since 2025-12-04
 */

import { CardState } from '../../data/types';
import type { Card } from '../../data/types';
import type {
  PriorityConfig,
  CardWithQueueOptimization,
  LeechDetectionResult,
  LeechLevel,
  DifficultyLevel
} from '../../types/queue-optimization-types';
import { logger } from '../../utils/logger';

export class PriorityCalculator {
  private config: PriorityConfig;
  private cache: WeakMap<Card, number> = new WeakMap();
  
  constructor(config: PriorityConfig) {
    this.config = config;
    logger.debug('[PriorityCalculator] Initialized', { config });
  }
  
  /**
   * 计算最终优先级（带缓存）
   * 
   * @param card 卡片
   * @returns 优先级数值（越小越优先）
   */
  calculate(card: CardWithQueueOptimization): number {
    // 检查缓存
    const cached = this.cache.get(card);
    if (cached !== undefined) {
      return cached;
    }
    
    // 计算优先级
    const priority = this.doCalculate(card);
    
    // 写入缓存
    this.cache.set(card, priority);
    
    logger.debug('[PriorityCalculator] Calculated priority', {
      cardId: card.uuid,
      priority,
      breakdown: this.getBreakdown(card)
    });
    
    return priority;
  }
  
  /**
   * 实际计算优先级
   */
  private doCalculate(card: CardWithQueueOptimization): number {
    // 防御性检查：确保fsrs数据存在
    if (!card.fsrs) {
      logger.warn('[PriorityCalculator] Card missing fsrs data', { cardId: card.uuid });
      return 400; // 返回最低优先级（New卡片级别）
    }
    
    // 第1层：State优先级（100-400）
    const statePriority = this.getStatePriority(card.fsrs.state);
    
    // 第2层：用户优先级（0-40）
    const userPriority = this.config.enableUserPriority
      ? this.getUserPriority(card)
      : 20;  // 默认值
    
    // 第3层：Difficulty微调（0-5）
    const difficultyAdjustment = this.config.enableDifficultyAdjustment
      ? this.getDifficultyAdjustment(card)
      : 0;
    
    // 第4层：Leech提升（-20 to 0）
    const leechBoost = this.config.enableLeechBoost
      ? this.getLeechBoost(card)
      : 0;
    
    return statePriority + userPriority + difficultyAdjustment + leechBoost;
  }
  
  /**
   * 获取State优先级
   */
  private getStatePriority(state: CardState): number {
    const priorities: Record<CardState, number> = {
      [CardState.Learning]: 100,      // 最高优先级
      [CardState.Relearning]: 200,    // 第二优先级
      [CardState.Review]: 300,        // 第三优先级
      [CardState.New]: 400            // 最低优先级
    };
    
    return priorities[state];
  }
  
  /**
   * 获取用户设定优先级
   */
  private getUserPriority(card: Card): number {
    const priority = card.priority || 2;  // 默认优先级2
    return priority * 10;
    
    // Priority 1 → 10分
    // Priority 2 → 20分（默认）
    // Priority 3 → 30分
    // Priority 4 → 40分
  }
  
  /**
   * 获取Difficulty微调
   */
  private getDifficultyAdjustment(card: CardWithQueueOptimization): number {
    const level = card.metadata?.difficultyTracking?.currentLevel;
    
    const adjustments: Record<DifficultyLevel, number> = {
      'easy': 0,
      'medium': 1,
      'hard': 3,
      'very_hard': 5
    };
    
    return adjustments[level || 'medium'];
  }
  
  /**
   * 获取Leech提升
   * 
   * 计算逻辑：
   * 1. 遗忘次数（lapses）
   * 2. FSRS难度（difficulty）
   * 3. Difficulty Tracking数据
   * 
   * 综合评分转换为boost（负数 = 提升优先级）
   */
  private getLeechBoost(card: CardWithQueueOptimization): number {
    let severity = 0;
    
    // 因素1：FSRS Difficulty（调用方已检查fsrs存在性）
    const difficulty = card.fsrs!.difficulty || 0;
    if (difficulty >= 9.5) {
      severity += 3;
    } else if (difficulty >= 9.0) {
      severity += 2;
    } else if (difficulty >= 8.0) {
      severity += 1;
    }
    
    // 因素2：Lapses（遗忘次数）
    const lapses = card.fsrs!.lapses || 0;
    if (lapses >= 8) {
      severity += 3;
    } else if (lapses >= 5) {
      severity += 2;
    } else if (lapses >= 3) {
      severity += 1;
    }
    
    // 因素3：Difficulty Tracking
    if (card.metadata?.difficultyTracking) {
      const tracking = card.metadata.difficultyTracking;
      
      // 当前难度等级
      if (tracking.currentLevel === 'very_hard') {
        severity += 1;
      }
      
      // 难度上升趋势
      if (tracking.trend === 'rising') {
        severity += 1;
      }
      
      // 连续Hard
      if (tracking.consecutiveHard >= 3) {
        severity += 1;
      }
    }
    
    // 转换为boost（负数 = 提升）
    if (severity >= 6) return -20;  // Severe
    if (severity >= 4) return -10;  // Moderate
    if (severity >= 2) return -5;   // Mild
    return 0;                       // None
  }
  
  /**
   * 检测Leech等级（用于UI显示和回收判断）
   */
  detectLeech(card: CardWithQueueOptimization): LeechDetectionResult {
    // 防御性检查
    if (!card.fsrs) {
      return {
        severity: 0,
        level: 'none',
        shouldRecycle: false,
        reasons: ['Card missing fsrs data']
      };
    }
    
    let severity = 0;
    const reasons: string[] = [];
    
    // FSRS Difficulty
    const difficulty = card.fsrs.difficulty || 0;
    if (difficulty >= 9.5) {
      severity += 3;
      reasons.push(`FSRS难度极高(${difficulty.toFixed(1)})`);
    } else if (difficulty >= 9.0) {
      severity += 2;
      reasons.push(`FSRS难度很高(${difficulty.toFixed(1)})`);
    }
    
    // Lapses
    const lapses = card.fsrs.lapses || 0;
    if (lapses >= 8) {
      severity += 3;
      reasons.push(`遗忘次数过多(${lapses}次)`);
    } else if (lapses >= 5) {
      severity += 2;
      reasons.push(`遗忘次数较多(${lapses}次)`);
    }
    
    // Difficulty Tracking
    if (card.metadata?.difficultyTracking) {
      const tracking = card.metadata.difficultyTracking;
      
      if (tracking.currentLevel === 'very_hard') {
        severity += 1;
        reasons.push('标记为非常困难');
      }
      
      if (tracking.trend === 'rising') {
        severity += 1;
        reasons.push('难度持续上升');
      }
      
      if (tracking.consecutiveHard >= 3) {
        severity += 1;
        reasons.push(`连续${tracking.consecutiveHard}次评Hard`);
      }
    }
    
    // 确定等级
    let level: LeechLevel;
    let shouldRecycle: boolean;
    
    if (severity >= 6) {
      level = 'severe';
      shouldRecycle = true;
    } else if (severity >= 4) {
      level = 'moderate';
      shouldRecycle = false;
    } else if (severity >= 2) {
      level = 'mild';
      shouldRecycle = false;
    } else {
      level = 'none';
      shouldRecycle = false;
    }
    
    logger.debug('[PriorityCalculator] Leech detection', {
      cardId: card.uuid,
      severity,
      level,
      shouldRecycle,
      reasons
    });
    
    return {
      severity,
      level,
      shouldRecycle,
      reasons
    };
  }
  
  /**
   * 获取优先级分解（用于调试）
   */
  getBreakdown(card: CardWithQueueOptimization): {
    statePriority: number;
    userPriority: number;
    difficultyAdjustment: number;
    leechBoost: number;
    total: number;
  } {
    // 防御性检查
    if (!card.fsrs) {
      return {
        statePriority: 400,
        userPriority: 20,
        difficultyAdjustment: 0,
        leechBoost: 0,
        total: 420
      };
    }
    
    const statePriority = this.getStatePriority(card.fsrs.state);
    const userPriority = this.getUserPriority(card);
    const difficultyAdjustment = this.getDifficultyAdjustment(card);
    const leechBoost = this.getLeechBoost(card);
    
    return {
      statePriority,
      userPriority,
      difficultyAdjustment,
      leechBoost,
      total: statePriority + userPriority + difficultyAdjustment + leechBoost
    };
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = new WeakMap();
    logger.debug('[PriorityCalculator] Cache cleared');
  }
  
  /**
   * 使指定卡片的缓存失效
   */
  invalidateCache(card: Card): void {
    this.cache.delete(card);
    logger.debug('[PriorityCalculator] Cache invalidated', { cardId: card.uuid });
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<PriorityConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache();  // 配置更新后清除缓存
    logger.debug('[PriorityCalculator] Config updated', { config: this.config });
  }
  
  /**
   * 获取配置
   */
  getConfig(): PriorityConfig {
    return { ...this.config };
  }
}
