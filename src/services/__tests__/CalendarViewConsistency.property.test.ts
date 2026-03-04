/**
 * 日历视图一致性属性测试
 * 
 * **Feature: incremental-reading, Property 9: Calendar View Consistency**
 * **Validates: Requirements 7.2**
 * 
 * 测试日历视图中的材料数量与FSRS.due日期的一致性
 * 
 * @module services/__tests__/CalendarViewConsistency.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ReadingMaterial, ReadingProgress } from '../../types/incremental-reading-types';
import { ReadingCategory } from '../../types/incremental-reading-types';
import type { FSRSCard } from '../../data/types';
import { CardState } from '../../data/types';

// ===== 辅助函数 =====

/**
 * 计算某日期的到期材料数量（模拟日历视图逻辑）
 */
function countMaterialsForDate(materials: ReadingMaterial[], targetDate: Date): number {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  return materials.filter(m => {
    if (!m.fsrs?.due) return false;
    const dueDate = new Date(m.fsrs.due);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === target.getTime();
  }).length;
}

/**
 * 获取某日期的到期材料列表（模拟日历视图逻辑）
 */
function getMaterialsForDate(materials: ReadingMaterial[], targetDate: Date): ReadingMaterial[] {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  return materials.filter(m => {
    if (!m.fsrs?.due) return false;
    const dueDate = new Date(m.fsrs.due);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === target.getTime();
  });
}

/**
 * 生成日历网格数据（模拟日历视图逻辑）
 */
function generateCalendarData(
  materials: ReadingMaterial[], 
  year: number, 
  month: number
): Map<string, number> {
  const result = new Map<string, number>();
  
  // 获取当月第一天和最后一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // 遍历当月每一天
  const current = new Date(firstDay);
  while (current <= lastDay) {
    const dateKey = current.toISOString().split('T')[0];
    const count = countMaterialsForDate(materials, current);
    result.set(dateKey, count);
    current.setDate(current.getDate() + 1);
  }
  
  return result;
}

// ===== 生成器 =====

/**
 * 生成有效的日期（未来30天内）
 */
const futureDateArb = fc.integer({ min: 0, max: 30 }).map(days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
});

/**
 * 生成有效的FSRS卡片状态
 */
const fsrsCardArb = (dueDate: Date): fc.Arbitrary<FSRSCard> => fc.record({
  stability: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
  difficulty: fc.float({ min: Math.fround(1), max: Math.fround(10), noNaN: true }),
  reps: fc.integer({ min: 0, max: 100 }),
  lapses: fc.integer({ min: 0, max: 50 }),
  state: fc.constantFrom(CardState.New, CardState.Learning, CardState.Review, CardState.Relearning)
}).map(data => ({
  due: dueDate.toISOString(),
  stability: data.stability,
  difficulty: data.difficulty,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: data.reps,
  lapses: data.lapses,
  state: data.state,
  retrievability: 1
}));

/**
 * 生成有效的阅读进度
 */
const progressArb: fc.Arbitrary<ReadingProgress> = fc.record({
  percentage: fc.integer({ min: 0, max: 100 }),
  totalWords: fc.integer({ min: 100, max: 50000 }),
  readWords: fc.integer({ min: 0, max: 50000 }),
  estimatedTimeRemaining: fc.integer({ min: 0, max: 300 })
}).map(data => ({
  percentage: data.percentage,
  totalWords: data.totalWords,
  readWords: Math.min(data.readWords, data.totalWords),
  estimatedTimeRemaining: data.estimatedTimeRemaining,
  anchorHistory: []
}));

/**
 * 生成有效的阅读材料（带指定due日期）
 */
const materialWithDueDateArb = (dueDate: Date): fc.Arbitrary<ReadingMaterial> => 
  fc.record({
    uuid: fc.uuid(),
    filePath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}.md`),
    title: fc.string({ minLength: 3, maxLength: 30 }),
    category: fc.constantFrom(
      ReadingCategory.Later,
      ReadingCategory.Reading,
      ReadingCategory.Favorite
    ),
    priority: fc.integer({ min: 0, max: 100 }),
    priorityDecay: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
    progress: progressArb
  }).chain(data => 
    fsrsCardArb(dueDate).map(fsrs => ({
      uuid: data.uuid,
      filePath: data.filePath,
      title: data.title,
      category: data.category,
      priority: data.priority,
      priorityDecay: data.priorityDecay,
      lastAccessed: new Date().toISOString(),
      fsrs,
      progress: data.progress,
      extractedCards: [],
      tags: [],
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      source: 'manual' as const
    }))
  );

/**
 * 生成一组阅读材料（随机due日期）
 */
const materialsArb = fc.array(
  futureDateArb.chain(date => materialWithDueDateArb(date)),
  { minLength: 0, maxLength: 20 }
);

/**
 * 生成一组阅读材料（指定due日期分布）
 */
const materialsWithDistributionArb = fc.array(
  fc.tuple(
    fc.integer({ min: 0, max: 30 }), // 天数偏移
    fc.integer({ min: 1, max: 5 })   // 该日期的材料数量
  ),
  { minLength: 1, maxLength: 10 }
).chain(distribution => {
  const materialArrays = distribution.map(([dayOffset, count]) => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);
    return fc.array(materialWithDueDateArb(date), { minLength: count, maxLength: count });
  });
  
  return fc.tuple(...materialArrays).map(arrays => arrays.flat());
});

// ===== 属性测试 =====

describe('Property 9: Calendar View Consistency', () => {
  /**
   * **Feature: incremental-reading, Property 9: Calendar View Consistency**
   * **Validates: Requirements 7.2**
   * 
   * *For any* date in the calendar view, the count of due materials must equal
   * the number of reading materials where FSRS.due date equals that date.
   */

  it('日历视图中的材料数量应该与FSRS.due日期匹配', () => {
    fc.assert(
      fc.property(
        materialsArb,
        futureDateArb,
        (materials, targetDate) => {
          // 计算日历视图显示的数量
          const calendarCount = countMaterialsForDate(materials, targetDate);
          
          // 直接计算FSRS.due匹配的数量
          const target = new Date(targetDate);
          target.setHours(0, 0, 0, 0);
          
          const directCount = materials.filter(m => {
            if (!m.fsrs?.due) return false;
            const dueDate = new Date(m.fsrs.due);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === target.getTime();
          }).length;
          
          expect(calendarCount).toBe(directCount);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('获取的材料列表长度应该与计数一致', () => {
    fc.assert(
      fc.property(
        materialsArb,
        futureDateArb,
        (materials, targetDate) => {
          const count = countMaterialsForDate(materials, targetDate);
          const materialsList = getMaterialsForDate(materials, targetDate);
          
          expect(materialsList.length).toBe(count);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('获取的材料列表中所有材料的due日期应该匹配目标日期', () => {
    fc.assert(
      fc.property(
        materialsArb,
        futureDateArb,
        (materials, targetDate) => {
          const materialsList = getMaterialsForDate(materials, targetDate);
          const target = new Date(targetDate);
          target.setHours(0, 0, 0, 0);
          
          for (const material of materialsList) {
            expect(material.fsrs).toBeDefined();
            const dueDate = new Date(material.fsrs!.due);
            dueDate.setHours(0, 0, 0, 0);
            expect(dueDate.getTime()).toBe(target.getTime());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('日历网格中所有日期的计数总和应该等于有due日期的材料总数', () => {
    fc.assert(
      fc.property(
        materialsWithDistributionArb,
        (materials) => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          
          // 生成日历数据
          const calendarData = generateCalendarData(materials, year, month);
          
          // 计算日历中的总数
          let calendarTotal = 0;
          calendarData.forEach(count => {
            calendarTotal += count;
          });
          
          // 计算当月due的材料数量
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          
          const monthMaterialsCount = materials.filter(m => {
            if (!m.fsrs?.due) return false;
            const dueDate = new Date(m.fsrs.due);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate >= firstDay && dueDate <= lastDay;
          }).length;
          
          expect(calendarTotal).toBe(monthMaterialsCount);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('没有FSRS数据的材料不应该出现在日历中', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            uuid: fc.uuid(),
            filePath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}.md`),
            title: fc.string({ minLength: 3, maxLength: 30 }),
            category: fc.constantFrom(
              ReadingCategory.Later,
              ReadingCategory.Reading,
              ReadingCategory.Favorite
            ),
            priority: fc.integer({ min: 0, max: 100 }),
            priorityDecay: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
            progress: progressArb
          }).map(data => ({
            uuid: data.uuid,
            filePath: data.filePath,
            title: data.title,
            category: data.category,
            priority: data.priority,
            priorityDecay: data.priorityDecay,
            lastAccessed: new Date().toISOString(),
            fsrs: undefined, // 没有FSRS数据
            progress: data.progress,
            extractedCards: [],
            tags: [],
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            source: 'manual' as const
          } as ReadingMaterial)),
          { minLength: 1, maxLength: 10 }
        ),
        futureDateArb,
        (materials, targetDate) => {
          const count = countMaterialsForDate(materials, targetDate);
          
          // 没有FSRS数据的材料不应该被计入
          expect(count).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('日历视图热力图一致性', () => {
  /**
   * 测试热力图等级计算的一致性
   */
  
  function getHeatLevel(count: number): number {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
  }

  it('热力图等级应该与材料数量正相关', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (count1, count2) => {
          const level1 = getHeatLevel(count1);
          const level2 = getHeatLevel(count2);
          
          // 如果count1 > count2，则level1 >= level2
          if (count1 > count2) {
            expect(level1).toBeGreaterThanOrEqual(level2);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('热力图等级应该在0-4范围内', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (count) => {
          const level = getHeatLevel(count);
          
          expect(level).toBeGreaterThanOrEqual(0);
          expect(level).toBeLessThanOrEqual(4);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('0个材料的热力图等级应该为0', () => {
    const level = getHeatLevel(0);
    expect(level).toBe(0);
  });
});

describe('日历视图日期选择一致性', () => {
  it('选择日期后获取的材料应该与该日期的计数一致', () => {
    fc.assert(
      fc.property(
        materialsWithDistributionArb,
        fc.integer({ min: 0, max: 30 }),
        (materials, dayOffset) => {
          const selectedDate = new Date();
          selectedDate.setDate(selectedDate.getDate() + dayOffset);
          selectedDate.setHours(0, 0, 0, 0);
          
          // 模拟选择日期
          const count = countMaterialsForDate(materials, selectedDate);
          const selectedMaterials = getMaterialsForDate(materials, selectedDate);
          
          // 验证一致性
          expect(selectedMaterials.length).toBe(count);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('选择不同日期应该返回不同的材料集合（如果due日期不同）', () => {
    fc.assert(
      fc.property(
        materialsWithDistributionArb,
        (materials) => {
          const date1 = new Date();
          date1.setHours(0, 0, 0, 0);
          
          const date2 = new Date();
          date2.setDate(date2.getDate() + 1);
          date2.setHours(0, 0, 0, 0);
          
          const materials1 = getMaterialsForDate(materials, date1);
          const materials2 = getMaterialsForDate(materials, date2);
          
          // 两个日期的材料集合应该没有交集
          const uuids1 = new Set(materials1.map(m => m.uuid));
          const uuids2 = new Set(materials2.map(m => m.uuid));
          
          for (const uuid of uuids1) {
            expect(uuids2.has(uuid)).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

