import { logger } from '../../utils/logger';
/**
 * 记忆回溯策略
 * 监控优化效果，必要时回退到更稳定的参数
 * 
 * 核心功能：
 * - 创建检查点（每次参数更新）
 * - 检测性能下降
 * - 自动回溯到稳定状态
 * - 渐进式衰减（防止过度依赖旧参数）
 */

export interface PerformanceMetrics {
  predictionAccuracy: number;
  retentionRate: number;
  avgResponseTime?: number;
  reviewCount: number;
  timestamp: number;
}

export interface WeightCheckpoint {
  weights: number[];
  performance: PerformanceMetrics;
  timestamp: number;
  reviewCount: number;
}

export class MemoryBacktrackingStrategy {
  private historyCheckpoints: Map<number, WeightCheckpoint> = new Map();
  private performanceWindow = 20; // 监控最近20次复习
  private maxCheckpoints = 5; // 最多保留5个检查点
  private performanceThreshold = 0.1; // 性能下降10%触发回溯
  
  /**
   * 创建检查点（每次参数更新时）
   */
  createCheckpoint(
    reviewCount: number, 
    weights: number[], 
    performance: PerformanceMetrics
  ): void {
    this.historyCheckpoints.set(reviewCount, {
      weights: [...weights],
      performance: { ...performance },
      timestamp: Date.now(),
      reviewCount
    });
    
    logger.debug(`📍 [BacktrackingStrategy] 创建检查点 #${reviewCount}:`, {
      accuracy: performance.predictionAccuracy.toFixed(3),
      retention: performance.retentionRate.toFixed(3)
    });
    
    // 只保留最近的检查点
    if (this.historyCheckpoints.size > this.maxCheckpoints) {
      const oldestKey = Math.min(...this.historyCheckpoints.keys());
      this.historyCheckpoints.delete(oldestKey);
      logger.debug(`🗑️ [BacktrackingStrategy] 删除旧检查点 #${oldestKey}`);
    }
  }
  
  /**
   * 检测性能下降并回溯
   */
  async detectAndBacktrack(
    currentPerformance: PerformanceMetrics
  ): Promise<number[] | null> {
    // 获取最近的检查点
    const checkpoints = Array.from(this.historyCheckpoints.values())
      .sort((a, b) => b.reviewCount - a.reviewCount);
    
    if (checkpoints.length < 2) {
      logger.debug('ℹ️ [BacktrackingStrategy] 检查点不足，跳过回溯检测');
      return null;
    }
    
    const prevCheckpoint = checkpoints[1]; // 上一个检查点
    
    // 性能对比
    const currentAccuracy = currentPerformance.predictionAccuracy;
    const prevAccuracy = prevCheckpoint.performance.predictionAccuracy;
    const performanceDrop = prevAccuracy - currentAccuracy;
    
    logger.debug("📊 [BacktrackingStrategy] 性能对比:", {
      current: currentAccuracy.toFixed(3),
      previous: prevAccuracy.toFixed(3),
      drop: performanceDrop.toFixed(3)
    });
    
    // 性能下降超过阈值：触发回溯
    if (performanceDrop > this.performanceThreshold) {
      logger.warn(`⚠️ [BacktrackingStrategy] 检测到性能下降 ${(performanceDrop * 100).toFixed(1)}%，执行回溯`);
      
      // 回退到上一个稳定状态
      return prevCheckpoint.weights;
    }
    
    // 检查是否有更早的稳定检查点
    const stableCheckpoint = this.findMostStableCheckpoint(currentPerformance);
    if (stableCheckpoint && stableCheckpoint !== prevCheckpoint) {
      logger.debug(`🎯 [BacktrackingStrategy] 找到更稳定的检查点 #${stableCheckpoint.reviewCount}`);
      return stableCheckpoint.weights;
    }
    
    return null;
  }
  
  /**
   * 查找最稳定的检查点
   */
  private findMostStableCheckpoint(
    currentPerformance: PerformanceMetrics
  ): WeightCheckpoint | null {
    const checkpoints = Array.from(this.historyCheckpoints.values());
    
    if (checkpoints.length === 0) return null;
    
    // 按性能排序，找最好的检查点
    const sorted = checkpoints.sort((a, b) => {
      const scoreA = this.calculateStabilityScore(a.performance);
      const scoreB = this.calculateStabilityScore(b.performance);
      return scoreB - scoreA;
    });
    
    const bestCheckpoint = sorted[0];
    const currentScore = this.calculateStabilityScore(currentPerformance);
    const bestScore = this.calculateStabilityScore(bestCheckpoint.performance);
    
    // 只有当历史最佳明显优于当前时才回溯
    if (bestScore > currentScore + this.performanceThreshold) {
      return bestCheckpoint;
    }
    
    return null;
  }
  
  /**
   * 计算稳定性分数（综合指标）
   */
  private calculateStabilityScore(performance: PerformanceMetrics): number {
    // 加权组合：准确率70% + 保持率30%
    return performance.predictionAccuracy * 0.7 + 
           performance.retentionRate * 0.3;
  }
  
  /**
   * 渐进式衰减策略
   * 防止过度依赖旧参数，保持新参数的影响
   */
  applyDecayToCheckpoint(
    oldWeights: number[], 
    currentWeights: number[], 
    decayFactor = 0.7
  ): number[] {
    logger.debug(`🔄 [BacktrackingStrategy] 应用衰减策略 (因子: ${decayFactor})`);
    
    return oldWeights.map((w, i) => {
      // 70%旧权重 + 30%新权重
      const blended = w * decayFactor + currentWeights[i] * (1 - decayFactor);
      return blended;
    });
  }
  
  /**
   * 自适应衰减因子
   * 根据性能差异动态调整衰减强度
   */
  calculateAdaptiveDecayFactor(
    oldPerformance: PerformanceMetrics,
    currentPerformance: PerformanceMetrics
  ): number {
    const performanceDrop = 
      this.calculateStabilityScore(oldPerformance) - 
      this.calculateStabilityScore(currentPerformance);
    
    // 性能下降越大，越依赖旧参数
    if (performanceDrop > 0.2) {
      return 0.9; // 90%旧参数
    } else if (performanceDrop > 0.15) {
      return 0.8; // 80%旧参数
    } else if (performanceDrop > 0.1) {
      return 0.7; // 70%旧参数
    } else {
      return 0.5; // 50%旧参数（平衡）
    }
  }
  
  /**
   * 获取检查点历史
   */
  getCheckpointHistory(): WeightCheckpoint[] {
    return Array.from(this.historyCheckpoints.values())
      .sort((a, b) => a.reviewCount - b.reviewCount);
  }
  
  /**
   * 清除所有检查点
   */
  clearCheckpoints(): void {
    this.historyCheckpoints.clear();
    logger.debug('🗑️ [BacktrackingStrategy] 已清除所有检查点');
  }
  
  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalCheckpoints: number;
    oldestCheckpoint: number;
    newestCheckpoint: number;
    avgAccuracy: number;
    avgRetention: number;
  } {
    const checkpoints = Array.from(this.historyCheckpoints.values());
    
    if (checkpoints.length === 0) {
      return {
        totalCheckpoints: 0,
        oldestCheckpoint: 0,
        newestCheckpoint: 0,
        avgAccuracy: 0,
        avgRetention: 0
      };
    }
    
    const accuracies = checkpoints.map(c => c.performance.predictionAccuracy);
    const retentions = checkpoints.map(c => c.performance.retentionRate);
    const reviewCounts = checkpoints.map(c => c.reviewCount);
    
    return {
      totalCheckpoints: checkpoints.length,
      oldestCheckpoint: Math.min(...reviewCounts),
      newestCheckpoint: Math.max(...reviewCounts),
      avgAccuracy: accuracies.reduce((sum, v) => sum + v, 0) / accuracies.length,
      avgRetention: retentions.reduce((sum, v) => sum + v, 0) / retentions.length
    };
  }
}


