import { logger } from '../../utils/logger';
/**
 * 学习队列生成器 V2
 * 
 * 支持普通卡片和渐进式挖空的统一队列生成
 * 
 * 架构改进（V2）：
 * - 子卡片是真实Card对象，不需要虚拟化
 * - 父卡片不参与队列，只有子卡片进入队列
 * - 简化类型系统
 * 
 * @module utils/study/StudyQueueGenerator
 * @version 2.0.0
 */

import type { Card } from '../../data/types';
import type { StudyInstance } from '../../types/progressive-cloze-v2';
import {
  isProgressiveClozeParent,
  isProgressiveClozeChild
} from '../../types/progressive-cloze-v2';
import { CardInstanceProvider, type ICardStore } from '../../services/study/CardInstanceProvider';

export class StudyQueueGenerator {
  private provider: CardInstanceProvider;
  
  constructor(cardStore?: ICardStore) {
    this.provider = new CardInstanceProvider(cardStore);
  }
  
  /**
   * 生成学习队列 V2（纯函数）
   * 
   * 简化逻辑：
   * 1. 过滤父卡片（不参与学习）
   * 2. 子卡片和普通卡片都是真实Card对象
   * 3. 使用CardInstanceProvider实现Bury Siblings
   * 
   * @param cards 卡片列表（包括父卡片、子卡片、普通卡片）
   * @param onlyDue 是否只包含到期的卡片（默认true；提前学习模式应设为false）
   * @returns 学习实例列表
   */
  generateQueuePure(cards: Card[], onlyDue: boolean = true): StudyInstance[] {
    const queue: StudyInstance[] = [];
    let childCardCount = 0;
    let normalCardCount = 0;
    let parentCardSkipped = 0;
    
    for (const card of cards) {
      try {
        // ✅ 使用CardInstanceProvider过滤
        const instances = this.provider.getTodaysInstances(card, { onlyDue });
        
        if (instances.length === 0) {
          // 跳过：父卡片 / 被Bury的子卡片 / 未到期的卡片
          if (isProgressiveClozeParent(card)) {
            parentCardSkipped++;
          }
          continue;
        }
        
        // ✅ 添加到队列（都是真实Card对象）
        queue.push(instances[0]);
        
        // 统计
        if (isProgressiveClozeChild(instances[0])) {
          childCardCount++;
        } else {
          normalCardCount++;
        }
      } catch (error) {
        logger.error(`[StudyQueueGenerator] 处理卡片失败: ${card.uuid}`, error);
        continue;
      }
    }
    
    logger.debug(`[StudyQueueGenerator V2] 队列生成完成:
      - 输入卡片数: ${cards.length}
      - 跳过父卡片: ${parentCardSkipped}
      - 普通卡片: ${normalCardCount}
      - 子卡片: ${childCardCount}
      - 队列总数: ${queue.length}
      ✅ 所有实例都是真实Card对象`);
    
    return queue;
  }
  
  /**
   * 过滤队列 V2
   * 
   * @param queue 原始队列
   * @param filters 过滤条件
   * @returns 过滤后的队列
   */
  filterQueue(queue: StudyInstance[], filters: {
    excludeProgressiveCloze?: boolean;
    excludeNormalCards?: boolean;
    includeTags?: string[];
    excludeTags?: string[];
  }): StudyInstance[] {
    return queue.filter(card => {
      // ✅ V2：所有instance都是Card对象
      
      // 类型过滤
      if (filters.excludeProgressiveCloze && isProgressiveClozeChild(card)) {
        return false;
      }
      
      if (filters.excludeNormalCards && !isProgressiveClozeChild(card)) {
        return false;
      }
      
      // 标签过滤
      const cardTags = card.tags || [];
      
      if (filters.includeTags && filters.includeTags.length > 0) {
        const hasRequiredTag = filters.includeTags.some(tag => 
          cardTags.includes(tag)
        );
        if (!hasRequiredTag) {
          return false;
        }
      }
      
      if (filters.excludeTags && filters.excludeTags.length > 0) {
        const hasExcludedTag = filters.excludeTags.some(tag => 
          cardTags.includes(tag)
        );
        if (hasExcludedTag) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * 打乱队列
   * 
   * 使用Fisher-Yates算法打乱队列顺序
   * 
   * @param queue 原始队列
   * @returns 打乱后的队列
   */
  shuffleQueue(queue: StudyInstance[]): StudyInstance[] {
    const shuffled = [...queue];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }
  
  /**
   * 根据FSRS优先级排序队列 V2
   * 
   * @param queue 原始队列
   * @returns 排序后的队列
   */
  sortByPriority(queue: StudyInstance[]): StudyInstance[] {
    return [...queue].sort((a, b) => {
      try {
        // ✅ V2：所有instance都有fsrs属性
        const aFsrs = a.fsrs;
        const bFsrs = b.fsrs;
        
        if (!aFsrs || !bFsrs) {
          return 0;
        }
        
        const aDue = new Date(aFsrs.due);
        const bDue = new Date(bFsrs.due);
        
        return aDue.getTime() - bDue.getTime();
      } catch (error) {
        logger.error('[StudyQueueGenerator] 排序失败:', error);
        return 0;
      }
    });
  }
  
  /**
   * 获取队列统计信息 V2
   * 
   * @param queue 学习队列
   * @returns 统计信息
   */
  getQueueStats(queue: StudyInstance[]): {
    total: number;
    normalCards: number;
    childCards: number;
    uniqueParentCards: number;
  } {
    const uniqueParentCards = new Set<string>();
    let normalCards = 0;
    let childCards = 0;
    
    for (const card of queue) {
      if (isProgressiveClozeChild(card)) {
        childCards++;
        uniqueParentCards.add(card.parentCardId);
      } else {
        normalCards++;
      }
    }
    
    return {
      total: queue.length,
      normalCards,
      childCards,
      uniqueParentCards: uniqueParentCards.size
    };
  }
}
