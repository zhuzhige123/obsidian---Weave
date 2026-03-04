/**
 * V1.5 渐进式挖空卡片清理工具
 * 
 * 功能：清理数据库中所有 V1.5 格式的渐进式挖空卡片
 * - 删除 type="progressive" 的卡片（已废弃）
 * - 删除包含 V1.5 元数据的卡片
 * 
 * 使用场景：插件开发阶段，清理测试数据
 * 
 * @module utils/migration/clean-v15-progressive-cards
 */

import { logger } from '../logger';
import type { Card } from '../../data/types';
import type { WeaveDataStorage } from '../../data/storage';

export interface CleanupResult {
  totalScanned: number;
  deletedCount: number;
  deletedCards: Array<{
    uuid: string;
    reason: string;
  }>;
  errors: Array<{
    uuid: string;
    error: string;
  }>;
}

/**
 * 清理所有 V1.5 格式的渐进式挖空卡片
 * 
 * @param storage 数据存储实例
 * @param dryRun 是否仅模拟运行（不实际删除）
 * @returns 清理结果
 */
export async function cleanV15ProgressiveCards(
  storage: WeaveDataStorage,
  dryRun: boolean = false
): Promise<CleanupResult> {
  logger.info('[V1.5清理] 开始扫描数据库...');
  
  const result: CleanupResult = {
    totalScanned: 0,
    deletedCount: 0,
    deletedCards: [],
    errors: []
  };
  
  try {
    // 获取所有卡片
    const allCards = await storage.getAllCards();
    result.totalScanned = allCards.length;
    
    logger.info(`[V1.5清理] 扫描到 ${allCards.length} 张卡片`);
    
    for (const card of allCards) {
      try {
        const deleteReason = shouldDeleteCard(card);
        
        if (deleteReason) {
          logger.warn(`[V1.5清理] 发现V1.5卡片: ${card.uuid} - ${deleteReason}`);
          
          if (!dryRun) {
            // 实际删除
            await storage.deleteCard(card.uuid);
            logger.info(`[V1.5清理] 已删除: ${card.uuid}`);
          } else {
            logger.info(`[V1.5清理] [模拟] 将删除: ${card.uuid}`);
          }
          
          result.deletedCards.push({
            uuid: card.uuid,
            reason: deleteReason
          });
          result.deletedCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[V1.5清理] 处理卡片失败: ${card.uuid}`, error);
        result.errors.push({
          uuid: card.uuid,
          error: errorMsg
        });
      }
    }
    
    // 输出统计
    logger.info('[V1.5清理] 完成！统计：', {
      totalScanned: result.totalScanned,
      deletedCount: result.deletedCount,
      errorCount: result.errors.length,
      dryRun
    });
    
    if (dryRun) {
      logger.info('[V1.5清理] 这是模拟运行，未实际删除卡片');
    }
    
  } catch (error) {
    logger.error('[V1.5清理] 扫描失败:', error);
    throw error;
  }
  
  return result;
}

/**
 * 判断卡片是否应该被删除
 * 
 * @param card 卡片
 * @returns 删除原因，如果不需要删除则返回 null
 */
function shouldDeleteCard(card: Card): string | null {
  // 使用类型断言访问可能存在的 V1.5 字段
  const cardAny = card as any;
  
  // 检查1: type="progressive" (已废弃的枚举值)
  if (cardAny.type === 'progressive') {
    return 'V1.5类型: type="progressive"';
  }
  
  // 检查2: 包含 V1.5 的 progressiveCloze 字段（单卡片多FSRS方案）
  if (cardAny.progressiveCloze) {
    return 'V1.5字段: progressiveCloze (单卡片多FSRS方案)';
  }
  
  // 检查3: metadata 包含 V1.5 字段
  if (card.metadata) {
    if (cardAny.metadata.clozeMap) {
      return 'V1.5元数据: metadata.clozeMap';
    }
    
    if (cardAny.metadata.childClozeMetadata) {
      return 'V1.5元数据: metadata.childClozeMetadata';
    }
  }
  
  // 无需删除
  return null;
}

/**
 * 快速检查数据库中是否存在 V1.5 卡片
 * 
 * @param storage 数据存储实例
 * @returns 是否存在 V1.5 卡片
 */
export async function hasV15ProgressiveCards(storage: WeaveDataStorage): Promise<boolean> {
  try {
    const allCards = await storage.getAllCards();
    
    for (const card of allCards) {
      if (shouldDeleteCard(card)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error('[V1.5清理] 快速检查失败:', error);
    return false;
  }
}
