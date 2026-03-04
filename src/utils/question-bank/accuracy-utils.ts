/**
 * 正确率统计辅助工具
 * 
 * 提供掌握状态、趋势、置信度的显示格式化功能
 * 
 * @author Weave Team
 * @version 2.0.0
 * @since 2025-01-24
 */

import type { MasteryStatus, TrendDirection } from '../../types/question-bank-types';

/**
 * 获取掌握状态的显示文本
 */
export function getMasteryStatusText(status: MasteryStatus): string {
  const map: Record<MasteryStatus, string> = {
    mastered: '已精通',
    proficient: '熟练',
    learning: '学习中',
    struggling: '有困难',
    needs_review: '需复习',
    insufficient_data: '数据不足'
  };
  return map[status];
}

/**
 * 获取掌握状态的颜色（CSS变量）
 */
export function getMasteryStatusColor(status: MasteryStatus): string {
  const map: Record<MasteryStatus, string> = {
    mastered: 'var(--color-green)',
    proficient: 'var(--color-blue)',
    learning: 'var(--color-yellow)',
    struggling: 'var(--color-orange)',
    needs_review: 'var(--color-red)',
    insufficient_data: 'var(--color-base-40)'
  };
  return map[status];
}

/**
 * 获取掌握状态的图标
 */
export function getMasteryStatusIcon(status: MasteryStatus): string {
  const map: Record<MasteryStatus, string> = {
    mastered: '✨',
    proficient: '👍',
    learning: '📚',
    struggling: '⚠️',
    needs_review: '❌',
    insufficient_data: '❓'
  };
  return map[status];
}

/**
 * 获取趋势方向的图标
 */
export function getTrendIcon(direction: TrendDirection): string {
  const map: Record<TrendDirection, string> = {
    improving: '📈',
    stable: '➡️',
    declining: '📉',
    unknown: '❓'
  };
  return map[direction];
}

/**
 * 获取趋势方向的文本
 */
export function getTrendText(direction: TrendDirection): string {
  const map: Record<TrendDirection, string> = {
    improving: '进步中',
    stable: '稳定',
    declining: '退步中',
    unknown: '未知'
  };
  return map[direction];
}

/**
 * 获取趋势方向的颜色
 */
export function getTrendColor(direction: TrendDirection): string {
  const map: Record<TrendDirection, string> = {
    improving: 'var(--color-green)',
    stable: 'var(--color-base-60)',
    declining: 'var(--color-red)',
    unknown: 'var(--color-base-40)'
  };
  return map[direction];
}

/**
 * 格式化正确率显示
 * @param accuracy 正确率 (0-100)
 * @returns 格式化的字符串，如 "85.5%"
 */
export function formatAccuracy(accuracy: number): string {
  return `${accuracy.toFixed(1)}%`;
}

/**
 * 格式化置信度显示
 * @param confidence 置信度 (0-1)
 * @returns 格式化的字符串，如 "高 (92%)"
 */
export function formatConfidence(confidence: number): string {
  const percentage = (confidence * 100).toFixed(0);
  if (confidence >= 0.8) return `高 (${percentage}%)`;
  if (confidence >= 0.5) return `中 (${percentage}%)`;
  return `低 (${percentage}%)`;
}

/**
 * 获取置信度级别
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * 获取置信度颜色
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'var(--color-green)';
  if (confidence >= 0.5) return 'var(--color-yellow)';
  return 'var(--color-orange)';
}

/**
 * 格式化趋势强度显示
 * @param strength 强度 (0-1)
 * @returns 格式化的字符串，如 "+15.3%"
 */
export function formatTrendStrength(strength: number, direction: TrendDirection): string {
  if (direction === 'unknown' || direction === 'stable') {
    return '';
  }
  
  const percentage = (strength * 100).toFixed(1);
  const sign = direction === 'improving' ? '+' : '-';
  return `${sign}${percentage}%`;
}

/**
 * 生成掌握度总结文本
 * @example "熟练 (78.5%) - 进步中 +12%"
 */
export function getMasterySummary(
  status: MasteryStatus,
  accuracy: number,
  trend: TrendDirection,
  trendStrength: number
): string {
  const statusText = getMasteryStatusText(status);
  const accuracyText = formatAccuracy(accuracy);
  const trendText = getTrendText(trend);
  const strengthText = formatTrendStrength(trendStrength, trend);
  
  if (trend === 'stable' || trend === 'unknown') {
    return `${statusText} (${accuracyText})`;
  }
  
  return `${statusText} (${accuracyText}) - ${trendText} ${strengthText}`;
}
