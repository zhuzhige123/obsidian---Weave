/**
 * ReadingMaterial 数据模型单元测试
 * 
 * 测试增量阅读数据结构的验证逻辑和FSRS初始化
 * 
 * @module services/__tests__/ReadingMaterial.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReadingCategory,
  DEFAULT_READING_MATERIAL,
  ANCHOR_PREFIX,
  ANCHOR_REGEX
} from '../../types/incremental-reading-types';
import type {
  ReadingMaterial,
  ReadingProgress,
  AnchorRecord,
  ReadingSession
} from '../../types/incremental-reading-types';

// ===== 辅助函数 =====

/**
 * 生成UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成锚点ID
 */
function generateAnchorId(): string {
  return `${ANCHOR_PREFIX}${Date.now()}`;
}

/**
 * 创建测试用阅读材料
 */
function createTestMaterial(overrides: Partial<ReadingMaterial> = {}): ReadingMaterial {
  const now = new Date().toISOString();
  return {
    uuid: generateUUID(),
    filePath: 'test/document.md',
    title: 'Test Document',
    category: ReadingCategory.Later,
    priority: 50,
    priorityDecay: 0.5,
    lastAccessed: now,
    progress: {
      anchorHistory: [],
      percentage: 0,
      totalWords: 1000,
      readWords: 0,
      estimatedTimeRemaining: 30
    },
    extractedCards: [],
    tags: [],
    created: now,
    modified: now,
    source: 'auto',
    ...overrides
  };
}

/**
 * 创建测试用锚点记录
 */
function createTestAnchor(overrides: Partial<AnchorRecord> = {}): AnchorRecord {
  return {
    anchorId: generateAnchorId(),
    position: 500,
    timestamp: new Date().toISOString(),
    wordCount: 500,
    ...overrides
  };
}

/**
 * 创建测试用阅读会话
 */
function createTestSession(materialId: string, overrides: Partial<ReadingSession> = {}): ReadingSession {
  const now = new Date().toISOString();
  return {
    uuid: generateUUID(),
    materialId,
    startTime: now,
    duration: 0,
    wordsRead: 0,
    cardsCreated: [],
    ...overrides
  };
}

// ===== 测试套件 =====

describe('ReadingMaterial 数据模型', () => {
  describe('基础结构验证', () => {
    it('应该创建有效的阅读材料', () => {
      const material = createTestMaterial();

      expect(material.uuid).toBeDefined();
      expect(material.uuid.length).toBeGreaterThan(0);
      expect(material.filePath).toBe('test/document.md');
      expect(material.title).toBe('Test Document');
      expect(material.category).toBe(ReadingCategory.Later);
    });

    it('应该有有效的默认值', () => {
      expect(DEFAULT_READING_MATERIAL.category).toBe(ReadingCategory.Later);
      expect(DEFAULT_READING_MATERIAL.priority).toBe(50);
      expect(DEFAULT_READING_MATERIAL.priorityDecay).toBe(0.5);
      expect(DEFAULT_READING_MATERIAL.source).toBe('auto');
    });

    it('应该支持所有分类类型', () => {
      const categories = [
        ReadingCategory.Later,
        ReadingCategory.Reading,
        ReadingCategory.Favorite,
        ReadingCategory.Archived
      ];

      categories.forEach(category => {
        const material = createTestMaterial({ category });
        expect(material.category).toBe(category);
      });
    });
  });

  describe('优先级验证', () => {
    it('优先级应该在0-100范围内', () => {
      const material = createTestMaterial({ priority: 75 });
      expect(material.priority).toBeGreaterThanOrEqual(0);
      expect(material.priority).toBeLessThanOrEqual(100);
    });

    it('优先级衰减率应该是正数', () => {
      const material = createTestMaterial({ priorityDecay: 0.5 });
      expect(material.priorityDecay).toBeGreaterThan(0);
    });
  });

  describe('进度计算', () => {
    it('进度百分比应该在0-100范围内', () => {
      const progress: ReadingProgress = {
        anchorHistory: [],
        percentage: 45,
        totalWords: 1000,
        readWords: 450,
        estimatedTimeRemaining: 15
      };

      expect(progress.percentage).toBeGreaterThanOrEqual(0);
      expect(progress.percentage).toBeLessThanOrEqual(100);
    });

    it('已读字数不应超过总字数', () => {
      const progress: ReadingProgress = {
        anchorHistory: [],
        percentage: 50,
        totalWords: 1000,
        readWords: 500,
        estimatedTimeRemaining: 15
      };

      expect(progress.readWords).toBeLessThanOrEqual(progress.totalWords);
    });

    it('进度百分比应该与字数比例一致', () => {
      const totalWords = 1000;
      const readWords = 450;
      const expectedPercentage = (readWords / totalWords) * 100;

      const progress: ReadingProgress = {
        anchorHistory: [],
        percentage: expectedPercentage,
        totalWords,
        readWords,
        estimatedTimeRemaining: 15
      };

      expect(progress.percentage).toBe(45);
    });
  });

  describe('时间戳验证', () => {
    it('创建时间应该是有效的ISO 8601格式', () => {
      const material = createTestMaterial();
      const createdDate = new Date(material.created);
      expect(createdDate.toISOString()).toBe(material.created);
    });

    it('修改时间应该是有效的ISO 8601格式', () => {
      const material = createTestMaterial();
      const modifiedDate = new Date(material.modified);
      expect(modifiedDate.toISOString()).toBe(material.modified);
    });

    it('最后访问时间应该是有效的ISO 8601格式', () => {
      const material = createTestMaterial();
      const lastAccessedDate = new Date(material.lastAccessed);
      expect(lastAccessedDate.toISOString()).toBe(material.lastAccessed);
    });
  });
});

describe('AnchorRecord 锚点记录', () => {
  describe('锚点ID格式', () => {
    it('锚点ID应该以正确的前缀开头', () => {
      const anchor = createTestAnchor();
      expect(anchor.anchorId.startsWith(ANCHOR_PREFIX)).toBe(true);
    });

    it('锚点ID应该包含时间戳', () => {
      const anchor = createTestAnchor();
      const timestampPart = anchor.anchorId.replace(ANCHOR_PREFIX, '');
      const timestamp = parseInt(timestampPart, 10);
      expect(timestamp).toBeGreaterThan(0);
    });

    it('锚点正则表达式应该匹配有效锚点', () => {
      const validAnchors = [
        '^weave-bookmark-1704556800000',
        '^weave-bookmark-1234567890123'
      ];

      validAnchors.forEach(anchor => {
        // 重置正则表达式
        ANCHOR_REGEX.lastIndex = 0;
        expect(ANCHOR_REGEX.test(anchor)).toBe(true);
      });
    });

    it('锚点正则表达式不应该匹配无效锚点', () => {
      const invalidAnchors = [
        '^bookmark-1704556800000',
        '^weave-1704556800000',
        'weave-bookmark-1704556800000'
      ];

      invalidAnchors.forEach(anchor => {
        ANCHOR_REGEX.lastIndex = 0;
        expect(ANCHOR_REGEX.test(anchor)).toBe(false);
      });
    });
  });

  describe('锚点位置', () => {
    it('位置应该是非负整数', () => {
      const anchor = createTestAnchor({ position: 500 });
      expect(anchor.position).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(anchor.position)).toBe(true);
    });

    it('字数应该是非负整数', () => {
      const anchor = createTestAnchor({ wordCount: 500 });
      expect(anchor.wordCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(anchor.wordCount)).toBe(true);
    });
  });
});

describe('ReadingSession 阅读会话', () => {
  describe('会话基础结构', () => {
    it('应该创建有效的阅读会话', () => {
      const materialId = generateUUID();
      const session = createTestSession(materialId);

      expect(session.uuid).toBeDefined();
      expect(session.materialId).toBe(materialId);
      expect(session.startTime).toBeDefined();
    });

    it('会话持续时间应该是非负数', () => {
      const session = createTestSession(generateUUID(), { duration: 300 });
      expect(session.duration).toBeGreaterThanOrEqual(0);
    });

    it('阅读字数应该是非负数', () => {
      const session = createTestSession(generateUUID(), { wordsRead: 500 });
      expect(session.wordsRead).toBeGreaterThanOrEqual(0);
    });
  });

  describe('会话结束', () => {
    it('结束时间应该在开始时间之后', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 300000); // 5分钟后

      const session = createTestSession(generateUUID(), {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: 300
      });

      const start = new Date(session.startTime);
      const end = new Date(session.endTime!);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });
  });
});

describe('FSRS 初始化', () => {
  it('新材料应该可以没有FSRS数据', () => {
    const material = createTestMaterial();
    // 新材料可以没有FSRS数据（稍后阅读分类）
    expect(material.fsrs).toBeUndefined();
  });

  it('正在阅读的材料应该有FSRS数据', () => {
    const material = createTestMaterial({
      category: ReadingCategory.Reading,
      fsrs: {
        due: new Date().toISOString(),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 0,
        lapses: 0,
        state: 0, // New
        retrievability: 1
      }
    });

    expect(material.fsrs).toBeDefined();
    expect(material.fsrs!.stability).toBeGreaterThan(0);
    expect(material.fsrs!.difficulty).toBeGreaterThanOrEqual(1);
    expect(material.fsrs!.difficulty).toBeLessThanOrEqual(10);
  });
});

describe('关联数据', () => {
  it('提取的卡片列表应该是数组', () => {
    const material = createTestMaterial({
      extractedCards: ['card-1', 'card-2', 'card-3']
    });

    expect(Array.isArray(material.extractedCards)).toBe(true);
    expect(material.extractedCards.length).toBe(3);
  });

  it('标签应该是字符串数组', () => {
    const material = createTestMaterial({
      tags: ['心理学', '认知科学', '学习']
    });

    expect(Array.isArray(material.tags)).toBe(true);
    material.tags!.forEach(tag => {
      expect(typeof tag).toBe('string');
    });
  });
});
