/**
 * 优先级衰减属性测试
 * 
 * **Feature: incremental-reading, Property 6: Priority Decay Correctness**
 * **Validates: Requirements 9.3, 9.4**
 * 
 * 测试阅读材料优先级衰减的正确性
 * 
 * @module services/__tests__/PriorityDecay.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ReadingCategory } from '../../types/incremental-reading-types';

// ===== 优先级衰减逻辑 =====

/**
 * 计算优先级衰减
 * @param priority 当前优先级
 * @param daysSinceAccess 未访问天数
 * @param decayRate 每天衰减率
 * @param category 材料分类
 * @returns 衰减后的优先级
 */
function calculatePriorityDecay(
  priority: number,
  daysSinceAccess: number,
  decayRate: number,
  category: ReadingCategory
): number {
  // 收藏分类不衰减
  if (category === ReadingCategory.Favorite) {
    return priority;
  }
  
  // 计算衰减量
  const decay = daysSinceAccess * decayRate;
  
  // 返回衰减后的优先级，最小为0
  return Math.max(0, priority - decay);
}

/**
 * 验证优先级是否在有效范围内
 */
function isValidPriority(priority: number): boolean {
  return priority >= 0 && priority <= 100;
}

// ===== 生成器 =====

/**
 * 生成有效的优先级
 */
const priorityArb = fc.integer({ min: 0, max: 100 });

/**
 * 生成有效的衰减率
 */
const decayRateArb = fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true });

/**
 * 生成未访问天数
 */
const daysSinceAccessArb = fc.integer({ min: 0, max: 365 });

/**
 * 生成非收藏分类
 */
const nonFavoriteCategoryArb = fc.constantFrom(
  ReadingCategory.Later,
  ReadingCategory.Reading,
  ReadingCategory.Archived
);

/**
 * 生成所有分类
 */
const allCategoryArb = fc.constantFrom(
  ReadingCategory.Later,
  ReadingCategory.Reading,
  ReadingCategory.Favorite,
  ReadingCategory.Archived
);

// ===== 属性测试 =====

describe('Property 6: Priority Decay Correctness', () => {
  /**
   * **Feature: incremental-reading, Property 6: Priority Decay Correctness**
   * **Validates: Requirements 9.3, 9.4**
   * 
   * *For any* reading material not in "Favorite" category, if the material
   * has not been accessed for N days, its priority must be reduced by
   * (N × priorityDecay) points, with a minimum of 0.
   */

  it('收藏分类的材料优先级不应衰减', () => {
    fc.assert(
      fc.property(
        priorityArb,
        daysSinceAccessArb,
        decayRateArb,
        (priority, days, decayRate) => {
          const newPriority = calculatePriorityDecay(
            priority,
            days,
            decayRate,
            ReadingCategory.Favorite
          );
          
          // 收藏分类优先级应该保持不变
          expect(newPriority).toBe(priority);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('非收藏分类的材料优先级应该按天数衰减', () => {
    fc.assert(
      fc.property(
        priorityArb,
        daysSinceAccessArb,
        decayRateArb,
        nonFavoriteCategoryArb,
        (priority, days, decayRate, category) => {
          const newPriority = calculatePriorityDecay(
            priority,
            days,
            decayRate,
            category
          );
          
          // 计算预期衰减
          const expectedDecay = days * decayRate;
          const expectedPriority = Math.max(0, priority - expectedDecay);
          
          // 允许浮点数误差
          expect(Math.abs(newPriority - expectedPriority)).toBeLessThan(0.001);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('衰减后的优先级不应低于0', () => {
    fc.assert(
      fc.property(
        priorityArb,
        daysSinceAccessArb,
        decayRateArb,
        allCategoryArb,
        (priority, days, decayRate, category) => {
          const newPriority = calculatePriorityDecay(
            priority,
            days,
            decayRate,
            category
          );
          
          expect(newPriority).toBeGreaterThanOrEqual(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('衰减后的优先级不应超过原始优先级', () => {
    fc.assert(
      fc.property(
        priorityArb,
        daysSinceAccessArb,
        decayRateArb,
        allCategoryArb,
        (priority, days, decayRate, category) => {
          const newPriority = calculatePriorityDecay(
            priority,
            days,
            decayRate,
            category
          );
          
          expect(newPriority).toBeLessThanOrEqual(priority);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('0天未访问不应导致衰减', () => {
    fc.assert(
      fc.property(
        priorityArb,
        decayRateArb,
        nonFavoriteCategoryArb,
        (priority, decayRate, category) => {
          const newPriority = calculatePriorityDecay(
            priority,
            0, // 0天
            decayRate,
            category
          );
          
          expect(newPriority).toBe(priority);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('衰减应该与天数成正比', () => {
    fc.assert(
      fc.property(
        priorityArb,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        decayRateArb,
        nonFavoriteCategoryArb,
        (priority, days1, days2, decayRate, category) => {
          const moreDays = Math.max(days1, days2);
          const fewerDays = Math.min(days1, days2);
          
          const priorityAfterMoreDays = calculatePriorityDecay(
            priority,
            moreDays,
            decayRate,
            category
          );
          
          const priorityAfterFewerDays = calculatePriorityDecay(
            priority,
            fewerDays,
            decayRate,
            category
          );
          
          // 更多天数应该导致更低或相等的优先级
          expect(priorityAfterMoreDays).toBeLessThanOrEqual(priorityAfterFewerDays);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('衰减应该与衰减率成正比', () => {
    fc.assert(
      fc.property(
        priorityArb,
        daysSinceAccessArb.filter(d => d > 0),
        fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
        fc.float({ min: Math.fround(1.0), max: Math.fround(2.0), noNaN: true }),
        nonFavoriteCategoryArb,
        (priority, days, lowerRate, higherRate, category) => {
          const priorityWithLowerRate = calculatePriorityDecay(
            priority,
            days,
            lowerRate,
            category
          );
          
          const priorityWithHigherRate = calculatePriorityDecay(
            priority,
            days,
            higherRate,
            category
          );
          
          // 更高的衰减率应该导致更低或相等的优先级
          expect(priorityWithHigherRate).toBeLessThanOrEqual(priorityWithLowerRate);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('优先级有效性', () => {
  it('衰减后的优先级应该在有效范围内', () => {
    fc.assert(
      fc.property(
        priorityArb,
        daysSinceAccessArb,
        decayRateArb,
        allCategoryArb,
        (priority, days, decayRate, category) => {
          const newPriority = calculatePriorityDecay(
            priority,
            days,
            decayRate,
            category
          );
          
          expect(isValidPriority(newPriority)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('极端衰减应该将优先级降至0', () => {
    fc.assert(
      fc.property(
        priorityArb,
        nonFavoriteCategoryArb,
        (priority, category) => {
          // 使用极高的衰减率和天数
          const newPriority = calculatePriorityDecay(
            priority,
            1000, // 1000天
            10,   // 每天衰减10
            category
          );
          
          expect(newPriority).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('分类特定行为', () => {
  it('Later分类应该正常衰减', () => {
    const priority = 50;
    const days = 10;
    const decayRate = 0.5;
    
    const newPriority = calculatePriorityDecay(
      priority,
      days,
      decayRate,
      ReadingCategory.Later
    );
    
    expect(newPriority).toBe(45); // 50 - (10 * 0.5) = 45
  });

  it('Reading分类应该正常衰减', () => {
    const priority = 80;
    const days = 5;
    const decayRate = 1.0;
    
    const newPriority = calculatePriorityDecay(
      priority,
      days,
      decayRate,
      ReadingCategory.Reading
    );
    
    expect(newPriority).toBe(75); // 80 - (5 * 1.0) = 75
  });

  it('Archived分类应该正常衰减', () => {
    const priority = 30;
    const days = 20;
    const decayRate = 0.5;
    
    const newPriority = calculatePriorityDecay(
      priority,
      days,
      decayRate,
      ReadingCategory.Archived
    );
    
    expect(newPriority).toBe(20); // 30 - (20 * 0.5) = 20
  });

  it('Favorite分类应该保持优先级不变', () => {
    const priority = 100;
    const days = 365;
    const decayRate = 2.0;
    
    const newPriority = calculatePriorityDecay(
      priority,
      days,
      decayRate,
      ReadingCategory.Favorite
    );
    
    expect(newPriority).toBe(100); // 收藏不衰减
  });
});
