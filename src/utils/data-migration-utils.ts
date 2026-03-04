import { logger } from '../utils/logger';
/**
 * 数据迁移工具函数
 * 负责将旧版错题集数据迁移到新的统一格式
 */

import type { Card } from '../data/types';

/**
 * 根据错误次数计算错误等级
 */
function getErrorLevel(errorCount: number): 'light' | 'medium' | 'severe' {
  if (errorCount <= 2) return 'light';
  if (errorCount <= 5) return 'medium';
  return 'severe';
}

/**
 * 迁移单张卡片的错题集数据
 * 
 * 从 choiceStats 同步数据到 errorTracking
 * 
 * @param card - 需要迁移的卡片
 * @returns 迁移后的卡片（如果需要迁移）或原卡片
 */
export function migrateCardErrorTracking(card: Card): Card {
  //  安全检查：确保 stats 对象存在
  if (!card.stats) {
    logger.warn('[数据迁移] 卡片缺少 stats 对象，跳过迁移:', card.uuid);
    return card;
  }
  
  // 如果已经有 errorTracking 数据，无需迁移
  if (card.stats.errorTracking) {
    return card;
  }

  // 如果有 choiceStats，从中迁移数据
  if (card.stats.choiceStats) {
    const { isInErrorBook, errorCount, totalAttempts, correctAttempts, accuracy, lastErrorDate } = card.stats.choiceStats;

    // 创建新的 errorTracking 对象
    const errorTracking = {
      isInErrorBook: isInErrorBook,
      errorCount: errorCount,
      correctCount: correctAttempts,
      accuracy: accuracy,
      lastErrorDate: lastErrorDate,
      errorLevel: getErrorLevel(errorCount) // 使用内联函数计算错误等级
    };

    // 返回更新后的卡片
    return {
      ...card,
      stats: {
        ...card.stats,
        errorTracking
      }
    };
  }

  // 没有错题集数据，返回原卡片
  return card;
}

/**
 * 批量迁移卡片数据
 * 
 * @param cards - 卡片数组
 * @returns 迁移后的卡片数组
 */
export function migrateCardsErrorTracking(cards: Card[]): Card[] {
  let noStatsCount = 0;
  const result = cards.map(card => {
    if (!card.stats) {
      noStatsCount++;
      return card;
    }
    return migrateCardErrorTracking(card);
  });
  if (noStatsCount > 0) {
    logger.warn(`[数据迁移] ${noStatsCount} 张卡片缺少 stats 对象，已跳过迁移`);
  }
  return result;
}

/**
 * 检查卡片是否需要迁移
 * 
 * @param card - 卡片对象
 * @returns 是否需要迁移
 */
export function needsMigration(card: Card): boolean {
  // 有 choiceStats 但没有 errorTracking 的卡片需要迁移
  return !card.stats.errorTracking && !!card.stats.choiceStats;
}

/**
 * 获取需要迁移的卡片统计信息
 * 
 * @param cards - 卡片数组
 * @returns 迁移统计信息
 */
export function getMigrationStats(cards: Card[]): {
  total: number;
  needsMigration: number;
  alreadyMigrated: number;
  noErrorData: number;
} {
  let needsMigrationCount = 0;
  let alreadyMigrated = 0;
  let noErrorData = 0;

  for (const card of cards) {
    //  添加安全检查：确保 stats 对象存在
    if (!card.stats) {
      noErrorData++;
      continue;
    }
    
    if (card.stats.errorTracking) {
      alreadyMigrated++;
    } else if (card.stats.choiceStats) {
      needsMigrationCount++;
    } else {
      noErrorData++;
    }
  }

  return {
    total: cards.length,
    needsMigration: needsMigrationCount,
    alreadyMigrated: alreadyMigrated,
    noErrorData: noErrorData
  };
}










