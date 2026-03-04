/**
 * 卡片顺序工具函数单元测试
 */

import { shuffleCards, applyCardOrder, getCardOrderLabel, getCardOrderDescription } from '../cardOrder';
import { CardType, type Card } from '../../../data/types';

// Mock Card数据
const createMockCard = (id: string): Card => ({
  uuid: id,
  deckId: 'deck-1',
  templateId: 'template-1',
  type: CardType.Basic,
  content: `Card ${id} content`,
  fields: { front: `Front ${id}`, back: `Back ${id}` },
  fsrs: {
    due: new Date().toISOString(),
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    retrievability: 1
  },
  reviewHistory: [],
  stats: {
    totalReviews: 0,
    totalTime: 0,
    averageTime: 0,
    memoryRate: 0
  },
  created: new Date().toISOString(),
  modified: new Date().toISOString()
});

describe('cardOrder utils', () => {
  describe('shuffleCards', () => {
    it('应该返回相同长度的数组', () => {
      const cards = [1, 2, 3, 4, 5].map(i => createMockCard(`card-${i}`));
      const shuffled = shuffleCards(cards);
      
      expect(shuffled.length).toBe(cards.length);
    });

    it('应该包含所有原始卡片', () => {
      const cards = [1, 2, 3, 4, 5].map(i => createMockCard(`card-${i}`));
      const shuffled = shuffleCards(cards);
      
      const originalIds = cards.map(c => c.uuid).sort();
      const shuffledIds = shuffled.map(c => c.uuid).sort();
      
      expect(shuffledIds).toEqual(originalIds);
    });

    it('不应该修改原数组', () => {
      const cards = [1, 2, 3].map(i => createMockCard(`card-${i}`));
      const originalIds = cards.map(c => c.uuid);
      
      shuffleCards(cards);
      
      expect(cards.map(c => c.uuid)).toEqual(originalIds);
    });

    it('空数组应该返回空数组', () => {
      const cards: Card[] = [];
      const shuffled = shuffleCards(cards);
      
      expect(shuffled).toEqual([]);
    });

    it('单个元素应该返回相同的数组', () => {
      const cards = [createMockCard('card-1')];
      const shuffled = shuffleCards(cards);
      
      expect(shuffled).toEqual(cards);
      expect(shuffled).not.toBe(cards); // 不是同一个引用
    });
  });

  describe('applyCardOrder', () => {
    it('sequential应该返回原始顺序', () => {
      const cards = [1, 2, 3, 4, 5].map(i => createMockCard(`card-${i}`));
      const result = applyCardOrder(cards, 'sequential');
      
      expect(result).toEqual(cards);
      expect(result).toBe(cards); // 同一个引用
    });

    it('random应该返回打乱的数组', () => {
      const cards = [1, 2, 3, 4, 5].map(i => createMockCard(`card-${i}`));
      const result = applyCardOrder(cards, 'random');
      
      expect(result.length).toBe(cards.length);
      expect(result).not.toBe(cards); // 不是同一个引用
      
      // 包含所有原始卡片
      const originalIds = cards.map(c => c.uuid).sort();
      const resultIds = result.map(c => c.uuid).sort();
      expect(resultIds).toEqual(originalIds);
    });
  });

  describe('getCardOrderLabel', () => {
    it('sequential应该返回"正序学习"', () => {
      expect(getCardOrderLabel('sequential')).toBe('正序学习');
    });

    it('random应该返回"乱序学习"', () => {
      expect(getCardOrderLabel('random')).toBe('乱序学习');
    });
  });

  describe('getCardOrderDescription', () => {
    it('sequential应该返回正确的描述', () => {
      const desc = getCardOrderDescription('sequential');
      expect(desc).toContain('优先级');
      expect(desc).toContain('学习中');
    });

    it('random应该返回正确的描述', () => {
      const desc = getCardOrderDescription('random');
      expect(desc).toContain('随机');
      expect(desc).toContain('位置记忆');
    });
  });
});
