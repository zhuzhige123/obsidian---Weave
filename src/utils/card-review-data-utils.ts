import { logger } from '../utils/logger';
/**
 * 卡片复习数据工具函数
 * 用于从卡片状态派生展示所需的复习数据
 */

import type { Card } from '../data/types';
import type { FSRS } from '../algorithms/fsrs';

/**
 * 卡片复习数据接口
 */
export interface CardReviewData {
  /** 下次复习时间 */
  nextReview: Date | null;
  /** 记忆保持率 (0-1) */
  retention: number;
  /** 当前间隔天数 */
  interval: number;
  /** 难度系数 */
  difficulty: number;
  /** 已复习次数 */
  reviewCount: number;
}

/**
 * 从卡片状态派生复习数据
 * @param card 卡片对象
 * @param fsrs FSRS算法实例（可选）
 * @returns 派生的复习数据
 */
export function deriveReviewData(card: Card, _fsrs?: FSRS): CardReviewData {
  try {
    // 从 card.fsrs 提取 FSRS 数据
    const fsrsData = card.fsrs;
    
    return {
      nextReview: fsrsData?.due ? new Date(fsrsData.due) : null,
      retention: fsrsData?.stability ? Math.min(fsrsData.stability / 100, 1) : 0, // 基于stability计算保持率
      interval: fsrsData?.scheduledDays ?? 0,
      difficulty: fsrsData?.difficulty ?? 0,
      reviewCount: card.reviewHistory?.length ?? 0,
    };
  } catch (error) {
    logger.error('[CardReviewData] 派生复习数据失败:', error);
    return {
      nextReview: null,
      retention: 0,
      interval: 0,
      difficulty: 0,
      reviewCount: 0,
    };
  }
}

/**
 * 获取卡片最后修改时间
 * @param card 卡片对象
 * @returns 最后修改时间
 */
export function getCardModifiedTime(card: Card): Date {
  try {
    // 优先使用 modified，其次使用 created（修复属性名）
    if (card.modified) {
      return new Date(card.modified);
    }
    return new Date(card.created);
  } catch (error) {
    logger.error('[CardReviewData] 获取修改时间失败:', error);
    return new Date();
  }
}

