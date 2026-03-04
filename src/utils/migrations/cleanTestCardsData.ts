/**
 * 测试卡片数据清理迁移脚本
 * 
 * 清理测试卡片中的废弃字段和错误数据：
 * 1. 移除 fields（已废弃）
 * 2. 移除 choiceQuestionData（已废弃）
 * 3. 移除 fsrs（测试卡片不应有）
 * 4. 移除 reviewHistory（测试卡片不应有）
 * 5. 确保 testStats 存在且完整
 * 
 * @module utils/migrations/cleanTestCardsData
 */

import type { WeaveDataStorage } from '../../data/storage';
import type { Card } from '../../data/types';
import { logger } from '../logger';

/**
 * 清理结果统计
 */
export interface CleanupResult {
  totalDecks: number;
  totalCards: number;
  cleanedCards: number;
  errors: string[];
}

/**
 * 清理测试卡片错误数据
 * 
 * @param storage 数据存储实例
 * @returns 清理结果统计
 */
export async function cleanTestCardsData(storage: WeaveDataStorage): Promise<CleanupResult> {
  logger.info('[数据迁移] 开始清理测试卡片错误数据...');
  
  const result: CleanupResult = {
    totalDecks: 0,
    totalCards: 0,
    cleanedCards: 0,
    errors: []
  };
  
  try {
    const allDecks = await storage.getAllDecks();
    result.totalDecks = allDecks.length;
    
    for (const deck of allDecks) {
      // 只处理题库牌组
      if (deck.deckType === 'question-bank' || deck.purpose === 'test') {
        try {
          const cards = await storage.getDeckCards(deck.id);
          let deckModified = false;
          
          for (const card of cards) {
            result.totalCards++;
            
            // 只处理测试卡片
            if (card.cardPurpose === 'test') {
              let cardModified = false;
              
              // 1. 清理废弃字段：fields
              if ('fields' in card) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 移除 fields 字段`);
                delete (card as any).fields;
                cardModified = true;
              }
              
              // 2. 清理废弃字段：choiceQuestionData
              if ('choiceQuestionData' in card) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 移除 choiceQuestionData 字段`);
                delete (card as any).choiceQuestionData;
                cardModified = true;
              }
              
              // 3. 清理FSRS字段（测试卡片不应有）
              if ('fsrs' in card) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 移除 fsrs 字段`);
                delete (card as any).fsrs;
                cardModified = true;
              }
              
              // 4. 清理reviewHistory字段（测试卡片不应有）
              if ('reviewHistory' in card) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 移除 reviewHistory 字段`);
                delete (card as any).reviewHistory;
                cardModified = true;
              }
              
              // 5. 确保 testStats 存在且完整
              if (!card.stats.testStats) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 初始化 testStats`);
                card.stats.testStats = {
                  totalAttempts: 0,
                  correctAttempts: 0,
                  incorrectAttempts: 0,
                  accuracy: 0,
                  bestScore: 0,
                  averageScore: 0,
                  lastScore: 0,
                  averageResponseTime: 0,
                  fastestTime: 0,
                  lastTestDate: new Date().toISOString(),
                  isInErrorBook: false,
                  consecutiveCorrect: 0
                };
                cardModified = true;
              } else {
                // 检查 testStats 的完整性
                const testStats = card.stats.testStats;
                let statsIncomplete = false;
                
                // 确保所有必需字段存在
                if (testStats.totalAttempts === undefined) { testStats.totalAttempts = 0; statsIncomplete = true; }
                if (testStats.correctAttempts === undefined) { testStats.correctAttempts = 0; statsIncomplete = true; }
                if (testStats.incorrectAttempts === undefined) { testStats.incorrectAttempts = 0; statsIncomplete = true; }
                if (testStats.accuracy === undefined) { testStats.accuracy = 0; statsIncomplete = true; }
                if (testStats.bestScore === undefined) { testStats.bestScore = 0; statsIncomplete = true; }
                if (testStats.averageScore === undefined) { testStats.averageScore = 0; statsIncomplete = true; }
                if (testStats.lastScore === undefined) { testStats.lastScore = 0; statsIncomplete = true; }
                if (testStats.averageResponseTime === undefined) { testStats.averageResponseTime = 0; statsIncomplete = true; }
                if (testStats.fastestTime === undefined) { testStats.fastestTime = 0; statsIncomplete = true; }
                if (!testStats.lastTestDate) { testStats.lastTestDate = new Date().toISOString(); statsIncomplete = true; }
                if (testStats.isInErrorBook === undefined) { testStats.isInErrorBook = false; statsIncomplete = true; }
                if (testStats.consecutiveCorrect === undefined) { testStats.consecutiveCorrect = 0; statsIncomplete = true; }
                
                if (statsIncomplete) {
                  logger.debug(`[数据迁移] 卡片 ${card.uuid}: 补全 testStats 缺失字段`);
                  cardModified = true;
                }
              }
              
              // 6. 清理 stats 中的 memoryRate（测试卡片不应有）
              if ('memoryRate' in card.stats) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 移除 stats.memoryRate 字段`);
                delete (card.stats as any).memoryRate;
                cardModified = true;
              }
              
              // 7. 清理 templateId（仅用于Anki导出，Weave原生测试卡片不需要）
              if (card.templateId) {
                logger.debug(`[数据迁移] 卡片 ${card.uuid}: 移除 templateId 字段 (${card.templateId})`);
                delete (card as any).templateId;
                cardModified = true;
              }
              
              if (cardModified) {
                result.cleanedCards++;
                deckModified = true;
              }
            }
          }
          
          // 如果牌组有修改，保存到数据库
          if (deckModified) {
            await storage.saveDeckCards(deck.id, cards);
            logger.info(`[数据迁移] ✅ 清理牌组: ${deck.name} (${deck.id})`);
          }
          
        } catch (error) {
          const errorMsg = `清理牌组 ${deck.name} 失败: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(`[数据迁移] ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
    }
    
    logger.info(`[数据迁移] ✅ 完成！`);
    logger.info(`[数据迁移] 📊 统计：`);
    logger.info(`[数据迁移]   - 扫描牌组: ${result.totalDecks}`);
    logger.info(`[数据迁移]   - 扫描卡片: ${result.totalCards}`);
    logger.info(`[数据迁移]   - 清理卡片: ${result.cleanedCards}`);
    logger.info(`[数据迁移]   - 错误数量: ${result.errors.length}`);
    
  } catch (error) {
    const errorMsg = `数据迁移失败: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(`[数据迁移] ❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
  
  return result;
}

/**
 * 验证测试卡片数据结构
 * 
 * @param card 卡片对象
 * @returns 验证结果
 */
export function validateTestCard(card: Card): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (card.cardPurpose !== 'test') {
    return { valid: true, issues: [] }; // 不是测试卡片，跳过验证
  }
  
  // 检查不应存在的字段
  if ('fields' in card) {
    issues.push('存在废弃字段: fields');
  }
  
  if ('choiceQuestionData' in card) {
    issues.push('存在废弃字段: choiceQuestionData');
  }
  
  if ('fsrs' in card) {
    issues.push('测试卡片不应有 fsrs 字段');
  }
  
  if ('reviewHistory' in card) {
    issues.push('测试卡片不应有 reviewHistory 字段');
  }
  
  if (card.templateId) {
    issues.push('测试卡片不需要 templateId 字段（仅用于Anki导出）');
  }
  
  // 检查应存在的字段
  if (!card.stats.testStats) {
    issues.push('缺少 testStats 字段');
  } else {
    // 检查 testStats 的完整性
    const requiredFields = [
      'totalAttempts', 'correctAttempts', 'incorrectAttempts', 'accuracy',
      'bestScore', 'averageScore', 'lastScore', 'averageResponseTime',
      'fastestTime', 'lastTestDate', 'isInErrorBook', 'consecutiveCorrect'
    ];
    
    for (const field of requiredFields) {
      if (!(field in card.stats.testStats)) {
        issues.push(`testStats 缺少字段: ${field}`);
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
