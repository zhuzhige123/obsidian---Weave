/**
 * 兄弟卡片分散服务
 * 
 * P2: 复习后动态调整兄弟卡片的due日期，避免记忆干扰
 * 
 * 核心功能：
 * 1. 检测兄弟卡片due日期冲突
 * 2. 动态调整冲突的兄弟卡片
 * 3. 支持配置最小间隔天数和动态比例
 * 
 * 科学依据：
 * - 基于Anki的"Disperse Siblings"机制
 * - 默认5天最小间隔或间隔的5%（取较大值）
 * - 在FSRS的fuzz范围内调整，不破坏最优复习间隔
 * 
 * @version 1.0.0
 * @date 2025-12-08
 */

import type { Card, FSRSCard } from '../../data/types';
import { CardType } from '../../data/types';
import type { ProgressiveClozeChildCard } from '../../types/progressive-cloze-v2';
import type { WeaveDataStorage } from '../../data/storage';
import { logger } from '../../utils/logger';

/**
 * 兄弟分散配置
 */
export interface SiblingDispersionConfig {
  /** 是否启用兄弟分散 */
  enabled: boolean;
  
  /** 最小间隔天数 */
  minSpacing: number;
  
  /** 基于间隔的动态分散比例（例如0.05表示5%） */
  spacingPercentage: number;
  
  /** 队列生成时过滤（P0） */
  filterInQueue: boolean;
  
  /** 复习后自动调整（P2） */
  autoAdjustAfterReview: boolean;
  
  /** 遵守FSRS的fuzz范围 */
  respectFuzzRange: boolean;
}

/**
 * 默认配置（基于Anki社区最佳实践）
 */
export const DEFAULT_SIBLING_DISPERSION_CONFIG: SiblingDispersionConfig = {
  enabled: true,
  minSpacing: 5, // 5天最小间隔
  spacingPercentage: 0.05, // 5%动态间隔
  filterInQueue: true,
  autoAdjustAfterReview: true,
  respectFuzzRange: true
};

/**
 * 兄弟卡片分散服务
 */
export class SiblingDispersionService {
  private config: SiblingDispersionConfig;
  
  constructor(config: Partial<SiblingDispersionConfig> = {}) {
    this.config = { ...DEFAULT_SIBLING_DISPERSION_CONFIG, ...config };
  }
  
  /**
   * 更新配置
   */
  public updateConfig(config: Partial<SiblingDispersionConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * P2: 复习后调整兄弟卡片
   * 
   * 在卡片复习完成后调用，检查并调整冲突的兄弟卡片due日期
   * 
   * @param reviewedCard 刚复习完的卡片
   * @param dataStorage 数据存储实例
   * @returns 调整的兄弟卡片数量
   */
  public async adjustSiblingsAfterReview(
    reviewedCard: Card,
    dataStorage: WeaveDataStorage
  ): Promise<number> {
    // 检查是否启用
    if (!this.config.enabled || !this.config.autoAdjustAfterReview) {
      return 0;
    }
    
    // 只处理渐进式挖空子卡片
    if (reviewedCard.type !== CardType.ProgressiveChild) {
      return 0;
    }
    
    // 类型断言：确认是ProgressiveClozeChildCard
    const childCard = reviewedCard as ProgressiveClozeChildCard;
    
    try {
      // 1. 获取所有兄弟卡片
      const siblings = await this.getSiblingCards(childCard, dataStorage);
      
      if (siblings.length === 0) {
        return 0;
      }
      
      // 2. 计算分散间隔
      const disperseInterval = this.calculateDisperseInterval(childCard);
      
      logger.debug(
        `[SiblingDispersion] 检查卡片 ${childCard.uuid.slice(0, 8)} ` +
        `(cloze ${childCard.clozeOrd}) 的 ${siblings.length} 个兄弟卡片，` +
        `分散间隔: ${disperseInterval}天`
      );
      
      // 3. 检查并调整冲突的兄弟卡片
      let adjustedCount = 0;
      const reviewedDue = new Date(childCard.fsrs.due);
      
      for (const sibling of siblings) {
        if (!sibling.fsrs) continue;
        
        const siblingDue = new Date(sibling.fsrs.due);
        const daysDiff = Math.abs(this.daysBetween(reviewedDue, siblingDue));
        
        // 如果间隔太近，需要调整
        if (daysDiff < disperseInterval) {
          const adjusted = await this.adjustSiblingDue(
            sibling,
            reviewedDue,
            disperseInterval,
            dataStorage
          );
          
          if (adjusted) {
            adjustedCount++;
          }
        }
      }
      
      if (adjustedCount > 0) {
        logger.info(
          `[SiblingDispersion] ✅ 调整完成: ${adjustedCount}/${siblings.length} 个兄弟卡片`
        );
      }
      
      return adjustedCount;
    } catch (error) {
      logger.error('[SiblingDispersion] 调整兄弟卡片失败:', error);
      return 0;
    }
  }
  
  /**
   * 获取兄弟卡片（同一父卡片的其他子卡片）
   */
  private async getSiblingCards(
    card: Card,
    dataStorage: WeaveDataStorage
  ): Promise<ProgressiveClozeChildCard[]> {
    if (card.type !== CardType.ProgressiveChild) {
      return [];
    }
    
    // 类型断言：确认是ProgressiveClozeChildCard
    const childCard = card as ProgressiveClozeChildCard;
    
    const allCards = await dataStorage.getAllCards();
    
    return allCards.filter(c =>
      c.type === CardType.ProgressiveChild &&
      (c as ProgressiveClozeChildCard).parentCardId === childCard.parentCardId &&
      c.uuid !== card.uuid // 排除自己
    ) as ProgressiveClozeChildCard[];
  }
  
  /**
   * 计算分散间隔
   * 
   * 规则：取以下两者的较大值
   * 1. minSpacing（默认5天）
   * 2. scheduledDays * spacingPercentage（默认5%）
   */
  private calculateDisperseInterval(card: Card): number {
    if (!card.fsrs) {
      return this.config.minSpacing;
    }
    
    const dynamicSpacing = Math.round(card.fsrs.scheduledDays * this.config.spacingPercentage);
    
    return Math.max(this.config.minSpacing, dynamicSpacing);
  }
  
  /**
   * 调整兄弟卡片的due日期
   * 
   * @param sibling 要调整的兄弟卡片（ProgressiveClozeChildCard类型）
   * @param referenceDue 参考日期（刚复习的卡片的due）
   * @param minInterval 最小间隔天数
   * @param dataStorage 数据存储实例
   * @returns 是否成功调整
   */
  private async adjustSiblingDue(
    sibling: ProgressiveClozeChildCard,
    referenceDue: Date,
    minInterval: number,
    dataStorage: WeaveDataStorage
  ): Promise<boolean> {
    if (!sibling.fsrs) {
      return false;
    }
    
    const siblingDue = new Date(sibling.fsrs.due);
    const daysDiff = this.daysBetween(referenceDue, siblingDue);
    
    // 计算新的due日期
    let newDue: Date;
    if (Math.abs(daysDiff) < minInterval) {
      // 如果太近，向后推minInterval天
      newDue = new Date(referenceDue);
      newDue.setDate(newDue.getDate() + minInterval);
      
      logger.debug(
        `[SiblingDispersion] 调整卡片 ${sibling.uuid.slice(0, 8)} ` +
        `(cloze ${sibling.clozeOrd}): ` +
        `${siblingDue.toISOString().split('T')[0]} → ` +
        `${newDue.toISOString().split('T')[0]} ` +
        `(+${minInterval}天)`
      );
    } else {
      // 间隔足够，不需要调整
      return false;
    }
    
    // 更新FSRS数据
    const updatedFsrs: FSRSCard = {
      ...sibling.fsrs,
      due: newDue.toISOString()
    };
    
    // 保存更新后的卡片
    const updatedCard: Card = {
      ...sibling,
      fsrs: updatedFsrs,
      modified: new Date().toISOString()
    };
    
    await dataStorage.saveCard(updatedCard);
    
    return true;
  }
  
  /**
   * 计算两个日期之间的天数差
   */
  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    const diffMs = date2.getTime() - date1.getTime();
    return Math.round(diffMs / oneDay);
  }
  
  /**
   * P3: FSRS调度集成
   * 
   * 在FSRS调度时考虑兄弟分散，在fuzz范围内寻找合适的due日期
   * 
   * FSRS的fuzz机制：
   * - 为复习日期添加随机性，避免卡片在固定日期集中
   * - fuzz范围 = min(1, max(1, 0.05 * interval))
   * - 例如：100天间隔 → fuzz范围±5天
   * 
   * @param card 要调度的卡片
   * @param optimalDue FSRS计算的最优due日期
   * @param siblings 兄弟卡片列表（可选）
   * @returns 调整后的due日期
   */
  public async findDispersedDue(
    card: Card,
    optimalDue: Date,
    siblings?: Card[]
  ): Promise<Date> {
    // 检查是否启用和需要调整
    if (!this.config.enabled || !this.config.respectFuzzRange) {
      return optimalDue;
    }
    
    if (!siblings || siblings.length === 0) {
      return optimalDue;
    }
    
    // 只处理渐进式挖空子卡片
    if (card.type !== CardType.ProgressiveChild) {
      return optimalDue;
    }
    
    try {
      // 1. 计算FSRS的fuzz范围
      const fuzzDays = this.calculateFuzzRange(card.fsrs?.scheduledDays || 0);
      
      // 2. 计算分散间隔
      const disperseInterval = this.calculateDisperseInterval(card);
      
      // 3. 收集兄弟due日期
      const siblingDues = siblings
        .filter((s): s is ProgressiveClozeChildCard & { fsrs: NonNullable<typeof s.fsrs> } => !!s.fsrs)
        .map(s => new Date(s.fsrs.due));
      
      if (siblingDues.length === 0) {
        return optimalDue;
      }
      
      // 4. 在fuzz范围内寻找最佳日期
      // 优先尝试向后调整（+偏移），如果不行则尝试向前（-偏移）
      const candidates: Array<{ date: Date; offset: number; minDistance: number }> = [];
      
      // 尝试0偏移（原始日期）
      const originalMinDistance = Math.min(
        ...siblingDues.map(d => Math.abs(this.daysBetween(optimalDue, d)))
      );
      candidates.push({ date: optimalDue, offset: 0, minDistance: originalMinDistance });
      
      // 在fuzz范围内尝试不同偏移
      for (let offset = 1; offset <= fuzzDays; offset++) {
        // 向后偏移
        const forwardDate = new Date(optimalDue);
        forwardDate.setDate(forwardDate.getDate() + offset);
        const forwardMinDistance = Math.min(
          ...siblingDues.map(d => Math.abs(this.daysBetween(forwardDate, d)))
        );
        candidates.push({ date: forwardDate, offset, minDistance: forwardMinDistance });
        
        // 向前偏移
        const backwardDate = new Date(optimalDue);
        backwardDate.setDate(backwardDate.getDate() - offset);
        const backwardMinDistance = Math.min(
          ...siblingDues.map(d => Math.abs(this.daysBetween(backwardDate, d)))
        );
        candidates.push({ date: backwardDate, offset: -offset, minDistance: backwardMinDistance });
      }
      
      // 5. 选择最佳候选日期
      // 优先级：minDistance >= disperseInterval > minDistance最大 > offset最小
      const validCandidates = candidates.filter(c => c.minDistance >= disperseInterval);
      
      let bestCandidate;
      if (validCandidates.length > 0) {
        // 有满足分散间隔的候选，选择offset最小的（最接近原始日期）
        bestCandidate = validCandidates.reduce((best, current) => 
          Math.abs(current.offset) < Math.abs(best.offset) ? current : best
        );
      } else {
        // 没有完全满足的，选择minDistance最大的
        bestCandidate = candidates.reduce((best, current) => 
          current.minDistance > best.minDistance ? current : best
        );
      }
      
      // 6. 记录调整结果
      if (bestCandidate.offset !== 0) {
        logger.debug(
          `[SiblingDispersion P3] 调整due日期: ` +
          `${optimalDue.toISOString().split('T')[0]} → ` +
          `${bestCandidate.date.toISOString().split('T')[0]} ` +
          `(偏移${bestCandidate.offset}天, fuzz范围±${fuzzDays}天, ` +
          `最小间隔${bestCandidate.minDistance}天)`
        );
      }
      
      return bestCandidate.date;
    } catch (error) {
      logger.error('[SiblingDispersion P3] 查找分散due失败:', error);
      return optimalDue;
    }
  }
  
  /**
   * 计算FSRS的fuzz范围（天数）
   * 
   * FSRS公式: fuzz = min(1, max(1, interval * 0.05))
   * 
   * @param scheduledDays 计划间隔天数
   * @returns fuzz范围天数
   */
  private calculateFuzzRange(scheduledDays: number): number {
    if (scheduledDays <= 0) {
      return 1;
    }
    
    // FSRS的fuzz计算
    const fuzz = Math.max(1, Math.min(scheduledDays * 0.05, scheduledDays * 0.25));
    
    return Math.round(fuzz);
  }
}

/**
 * 单例模式：全局服务实例
 */
let siblingDispersionService: SiblingDispersionService | null = null;

/**
 * 获取全局兄弟分散服务实例
 */
export function getSiblingDispersionService(): SiblingDispersionService {
  if (!siblingDispersionService) {
    siblingDispersionService = new SiblingDispersionService();
  }
  return siblingDispersionService;
}

/**
 * 初始化兄弟分散服务（可选，用于自定义配置）
 */
export function initializeSiblingDispersionService(
  config?: Partial<SiblingDispersionConfig>
): void {
  siblingDispersionService = new SiblingDispersionService(config);
}
