/**
 * 卡片学习顺序工具函数
 * 
 * 提供正序和乱序两种卡片排序方式：
 * - sequential（正序）：保持FSRS算法的科学优先级顺序
 * - random（乱序）：随机打乱卡片顺序，避免位置记忆效应
 * 
 * @module utils/study/cardOrder
 */

import type { Card } from '../../data/types';

/**
 * Fisher-Yates 洗牌算法
 * 
 * 使用现代版本的 Fisher-Yates 算法随机打乱数组
 * - 时间复杂度：O(n)
 * - 空间复杂度：O(n)（创建副本）
 * - 保证每种排列出现的概率相等
 * 
 * @param cards 卡片数组
 * @returns 打乱后的卡片数组（新数组，不修改原数组）
 * 
 * @example
 * ```typescript
 * const cards = [card1, card2, card3];
 * const shuffled = shuffleCards(cards);
 * // shuffled: [card2, card1, card3] (随机顺序)
 * ```
 */
export function shuffleCards(cards: Card[]): Card[] {
  // 创建副本，避免修改原数组
  const shuffled = [...cards];
  
  // Fisher-Yates 洗牌：从后往前遍历
  for (let i = shuffled.length - 1; i > 0; i--) {
    // 生成 [0, i] 范围内的随机索引
    const j = Math.floor(Math.random() * (i + 1));
    
    // 交换元素
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * 应用卡片顺序设置
 * 
 * 根据配置决定使用正序还是乱序
 * 
 * @param cards 卡片数组
 * @param order 顺序类型：'sequential' | 'random'
 * @returns 排序后的卡片数组
 * 
 * @example
 * ```typescript
 * // 正序：保持原有优先级顺序
 * const sequential = applyCardOrder(cards, 'sequential');
 * 
 * // 乱序：随机打乱
 * const random = applyCardOrder(cards, 'random');
 * ```
 */
export function applyCardOrder(
  cards: Card[],
  order: 'sequential' | 'random'
): Card[] {
  if (order === 'random') {
    return shuffleCards(cards);
  }
  
  // 正序：直接返回原数组
  return cards;
}

/**
 * 获取顺序模式的显示名称
 * 
 * @param order 顺序类型
 * @returns 中文显示名称
 */
export function getCardOrderLabel(order: 'sequential' | 'random'): string {
  return order === 'sequential' ? '正序学习' : '乱序学习';
}

/**
 * 获取顺序模式的说明文字
 * 
 * @param order 顺序类型
 * @returns 说明文字
 */
export function getCardOrderDescription(order: 'sequential' | 'random'): string {
  return order === 'sequential'
    ? '按优先级学习（学习中→复习→新卡片）'
    : '随机打乱顺序，避免位置记忆';
}
