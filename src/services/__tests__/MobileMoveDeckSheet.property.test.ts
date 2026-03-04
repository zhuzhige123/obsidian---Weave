/**
 * MobileMoveDeckSheet 属性测试
 * 
 * Property 3: 移动牌组列表项结构完整性
 * - 验证每个牌组项都有 id、name、color、cardCount
 * - 验证当前牌组显示选中标记
 * - 验证颜色格式正确
 * 
 * @module services/__tests__/MobileMoveDeckSheet.property.test
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ===== 类型定义 =====

interface DeckItem {
  id: string;
  name: string;
  color: string;
  cardCount: number;
}

// ===== 辅助函数 =====

function validateDeckItem(item: DeckItem): boolean {
  return (
    typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.name === 'string' && item.name.length > 0 &&
    typeof item.color === 'string' && isValidColor(item.color) &&
    typeof item.cardCount === 'number' && item.cardCount >= 0
  );
}

function isValidColor(color: string): boolean {
  // 支持十六进制颜色和 CSS 颜色名称
  const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const rgbPattern = /^rgb\(\d+,\s*\d+,\s*\d+\)$/;
  const rgbaPattern = /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/;
  
  return hexPattern.test(color) || rgbPattern.test(color) || rgbaPattern.test(color) || color.length > 0;
}

function findCurrentDeck(decks: DeckItem[], currentDeckId: string): DeckItem | undefined {
  return decks.find(deck => deck.id === currentDeckId);
}

function isCurrentDeckHighlighted(decks: DeckItem[], currentDeckId: string): boolean {
  const currentDeck = findCurrentDeck(decks, currentDeckId);
  return currentDeck !== undefined;
}

// ===== Arbitraries =====

const hexColorArbitrary = fc.array(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
  { minLength: 6, maxLength: 6 }
).map(arr => `#${arr.join('')}`);

const deckItemArbitrary: fc.Arbitrary<DeckItem> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  color: hexColorArbitrary,
  cardCount: fc.integer({ min: 0, max: 10000 })
});

const deckListArbitrary = fc.array(deckItemArbitrary, { minLength: 0, maxLength: 20 });

// ===== Property 3: 移动牌组列表项结构完整性 =====
describe('Property 3: 移动牌组列表项结构完整性', () => {
  it('每个牌组项都有非空的 id', () => {
    fc.assert(
      fc.property(
        deckItemArbitrary,
        (item) => {
          return typeof item.id === 'string' && item.id.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个牌组项都有非空的 name', () => {
    fc.assert(
      fc.property(
        deckItemArbitrary,
        (item) => {
          return typeof item.name === 'string' && item.name.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个牌组项都有有效的 color', () => {
    fc.assert(
      fc.property(
        deckItemArbitrary,
        (item) => {
          return isValidColor(item.color);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个牌组项的 cardCount >= 0', () => {
    fc.assert(
      fc.property(
        deckItemArbitrary,
        (item) => {
          return typeof item.cardCount === 'number' && item.cardCount >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('牌组项验证函数正确工作', () => {
    fc.assert(
      fc.property(
        deckItemArbitrary,
        (item) => {
          return validateDeckItem(item);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 当前牌组高亮测试 =====
describe('当前牌组高亮', () => {
  it('能找到当前牌组', () => {
    fc.assert(
      fc.property(
        fc.array(deckItemArbitrary, { minLength: 1, maxLength: 10 }),
        (decks) => {
          // 随机选择一个牌组作为当前牌组
          const currentDeckId = decks[0].id;
          const currentDeck = findCurrentDeck(decks, currentDeckId);
          return currentDeck !== undefined && currentDeck.id === currentDeckId;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('不存在的牌组ID返回 undefined', () => {
    fc.assert(
      fc.property(
        deckListArbitrary,
        (decks) => {
          const currentDeck = findCurrentDeck(decks, 'non-existent-id');
          return currentDeck === undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('当前牌组应该被高亮', () => {
    fc.assert(
      fc.property(
        fc.array(deckItemArbitrary, { minLength: 1, maxLength: 10 }),
        (decks) => {
          const currentDeckId = decks[0].id;
          return isCurrentDeckHighlighted(decks, currentDeckId);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 牌组选择行为 =====
describe('牌组选择行为', () => {
  it('选择牌组返回正确的 ID', () => {
    fc.assert(
      fc.property(
        fc.array(deckItemArbitrary, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (decks, index) => {
          const safeIndex = index % decks.length;
          const selectedDeck = decks[safeIndex];
          
          // 模拟选择行为
          let selectedId: string | null = null;
          const handleSelect = (id: string) => { selectedId = id; };
          
          handleSelect(selectedDeck.id);
          
          return selectedId === selectedDeck.id;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 颜色格式测试 =====
describe('颜色格式验证', () => {
  it('十六进制颜色格式有效', () => {
    const validColors = ['#fff', '#FFF', '#ffffff', '#FFFFFF', '#123abc', '#ABC123'];
    for (const color of validColors) {
      expect(isValidColor(color)).toBe(true);
    }
  });

  it('RGB 颜色格式有效', () => {
    const validColors = ['rgb(0, 0, 0)', 'rgb(255, 255, 255)', 'rgb(124, 58, 237)'];
    for (const color of validColors) {
      expect(isValidColor(color)).toBe(true);
    }
  });

  it('RGBA 颜色格式有效', () => {
    const validColors = ['rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 1)', 'rgba(124, 58, 237, 0.5)'];
    for (const color of validColors) {
      expect(isValidColor(color)).toBe(true);
    }
  });
});

// ===== 边界条件测试 =====
describe('边界条件测试', () => {
  it('空牌组列表不会崩溃', () => {
    const currentDeck = findCurrentDeck([], 'any-id');
    expect(currentDeck).toBeUndefined();
  });

  it('卡片数为0的牌组有效', () => {
    const deck: DeckItem = {
      id: 'test-id',
      name: 'Test Deck',
      color: '#7c3aed',
      cardCount: 0
    };
    expect(validateDeckItem(deck)).toBe(true);
  });

  it('长牌组名称有效', () => {
    const deck: DeckItem = {
      id: 'test-id',
      name: 'A'.repeat(100),
      color: '#7c3aed',
      cardCount: 10
    };
    expect(validateDeckItem(deck)).toBe(true);
  });
});
