/**
 * 移动端网格视图属性测试
 * 
 * Feature: mobile-deck-study-redesign
 * Task: 11.3 - 编写网格视图属性测试
 * 
 * Property 7: 网格卡片标题截断
 * Property 8: 网格卡片元信息显示
 * 
 * Validates: Requirements 11.2, 11.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ==================== 类型定义 ====================

type CardStatus = 'new' | 'learning' | 'review';

interface GridCardItem {
  id: string;
  title: string;
  status: CardStatus;
  deckName?: string;
  dueDate?: Date;
}

interface GridCardDisplay {
  title: string;
  truncated: boolean;
  lineCount: number;
  status: CardStatus;
  meta: string;
}

// ==================== 常量定义 ====================

const MAX_TITLE_LINES = 3;
const CHARS_PER_LINE = 20; // 估算每行字符数（12px字体，约200px宽度）
const MAX_TITLE_CHARS = MAX_TITLE_LINES * CHARS_PER_LINE;

// ==================== 辅助函数 ====================

/**
 * 计算文本行数（简化计算）
 */
function calculateLineCount(text: string, charsPerLine: number): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / charsPerLine);
}

/**
 * 检查标题是否需要截断
 */
function shouldTruncateTitle(title: string): boolean {
  return calculateLineCount(title, CHARS_PER_LINE) > MAX_TITLE_LINES;
}

/**
 * 截断标题到指定行数
 */
function truncateTitle(title: string, maxLines: number = MAX_TITLE_LINES): string {
  const maxChars = maxLines * CHARS_PER_LINE;
  if (title.length <= maxChars) {
    return title;
  }
  return title.slice(0, maxChars - 3) + '...';
}

/**
 * 格式化元信息
 */
function formatMeta(card: GridCardItem): string {
  const parts: string[] = [];
  
  // 状态
  const statusLabels: Record<CardStatus, string> = {
    new: '新卡',
    learning: '学习中',
    review: '复习'
  };
  parts.push(statusLabels[card.status]);
  
  // 牌组名称或到期时间
  if (card.deckName) {
    parts.push(card.deckName);
  } else if (card.dueDate) {
    parts.push(formatDueDate(card.dueDate));
  }
  
  return parts.join(' · ');
}

/**
 * 格式化到期时间
 */
function formatDueDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `${Math.abs(diffDays)}天前`;
  } else if (diffDays === 0) {
    return '今天';
  } else if (diffDays === 1) {
    return '明天';
  } else {
    return `${diffDays}天后`;
  }
}

/**
 * 渲染网格卡片显示数据
 */
function renderGridCard(card: GridCardItem): GridCardDisplay {
  const truncated = shouldTruncateTitle(card.title);
  const displayTitle = truncated ? truncateTitle(card.title) : card.title;
  const lineCount = Math.min(
    calculateLineCount(card.title, CHARS_PER_LINE),
    MAX_TITLE_LINES
  );
  
  return {
    title: displayTitle,
    truncated,
    lineCount,
    status: card.status,
    meta: formatMeta(card)
  };
}

// ==================== Arbitraries ====================

/**
 * 卡片状态生成器
 */
const cardStatusArb = fc.constantFrom<CardStatus>('new', 'learning', 'review');

/**
 * 卡片标题生成器 - 各种长度
 */
const cardTitleArb = fc.oneof(
  // 短标题（1行内）
  fc.string({ minLength: 1, maxLength: 20 }),
  // 中等标题（2-3行）
  fc.string({ minLength: 21, maxLength: 60 }),
  // 长标题（超过3行，需要截断）
  fc.string({ minLength: 61, maxLength: 200 }),
  // 包含中文的标题
  fc.array(
    fc.constantFrom('什', '么', '是', '记', '忆', '卡', '片', '学', '习', '方', '法'),
    { minLength: 1, maxLength: 50 }
  ).map(arr => arr.join('')),
  // 包含换行符的标题
  fc.string({ minLength: 1, maxLength: 100 }).map(s => s.replace(/[\x00-\x1f]/g, ' '))
);

/**
 * 牌组名称生成器
 */
const deckNameArb = fc.option(
  fc.oneof(
    fc.constant('默认牌组'),
    fc.constant('医学'),
    fc.constant('编程'),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
  { nil: undefined }
);

/**
 * 到期日期生成器
 */
const dueDateArb = fc.option(
  fc.date({
    min: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }),
  { nil: undefined }
);

/**
 * 网格卡片项生成器
 */
const gridCardItemArb: fc.Arbitrary<GridCardItem> = fc.record({
  id: fc.uuid(),
  title: cardTitleArb,
  status: cardStatusArb,
  deckName: deckNameArb,
  dueDate: dueDateArb
});

// ==================== Property Tests ====================

describe('MobileGridView Property Tests', () => {
  
  describe('Property 7: 网格卡片标题截断', () => {
    
    it('should truncate title when exceeding 3 lines', () => {
      fc.assert(
        fc.property(
          cardTitleArb,
          (title) => {
            const lineCount = calculateLineCount(title, CHARS_PER_LINE);
            const shouldTruncate = lineCount > MAX_TITLE_LINES;
            
            expect(shouldTruncateTitle(title)).toBe(shouldTruncate);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should limit truncated title to max characters', () => {
      fc.assert(
        fc.property(
          cardTitleArb,
          (title) => {
            const truncated = truncateTitle(title);
            
            // 截断后的标题长度不应超过最大字符数
            expect(truncated.length).toBeLessThanOrEqual(MAX_TITLE_CHARS);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should add ellipsis when truncating', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: MAX_TITLE_CHARS + 1, maxLength: 300 }),
          (longTitle) => {
            const truncated = truncateTitle(longTitle);
            
            // 长标题截断后应以省略号结尾
            expect(truncated.endsWith('...')).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should preserve short titles unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: MAX_TITLE_CHARS }),
          (shortTitle) => {
            const truncated = truncateTitle(shortTitle);
            
            // 短标题应保持不变
            expect(truncated).toBe(shortTitle);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should render grid card with correct truncation state', () => {
      fc.assert(
        fc.property(
          gridCardItemArb,
          (card) => {
            const rendered = renderGridCard(card);
            
            // 渲染结果的截断状态应与预期一致
            const expectedTruncated = shouldTruncateTitle(card.title);
            expect(rendered.truncated).toBe(expectedTruncated);
            
            // 行数不应超过最大行数
            expect(rendered.lineCount).toBeLessThanOrEqual(MAX_TITLE_LINES);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle empty title gracefully', () => {
      const emptyCard: GridCardItem = {
        id: 'test-id',
        title: '',
        status: 'new'
      };
      
      const rendered = renderGridCard(emptyCard);
      expect(rendered.title).toBe('');
      expect(rendered.truncated).toBe(false);
      expect(rendered.lineCount).toBe(0);
    });
    
  });
  
  describe('Property 8: 网格卡片元信息显示', () => {
    
    it('should always include status in meta', () => {
      fc.assert(
        fc.property(
          gridCardItemArb,
          (card) => {
            const meta = formatMeta(card);
            
            // 元信息应包含状态标签
            const statusLabels = ['新卡', '学习中', '复习'];
            const hasStatus = statusLabels.some(label => meta.includes(label));
            expect(hasStatus).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should include deck name when available', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            title: cardTitleArb,
            status: cardStatusArb,
            deckName: fc.string({ minLength: 1, maxLength: 20 }),
            dueDate: fc.constant(undefined)
          }),
          (card) => {
            const meta = formatMeta(card as GridCardItem);
            
            // 元信息应包含牌组名称
            expect(meta).toContain(card.deckName);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should include due date when deck name is not available', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            title: cardTitleArb,
            status: cardStatusArb,
            deckName: fc.constant(undefined),
            dueDate: fc.date({
              min: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            })
          }),
          (card) => {
            const meta = formatMeta(card as GridCardItem);
            
            // 元信息应包含时间相关的中文字符
            expect(/[天今明后前]/.test(meta)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should use separator between meta parts', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            title: cardTitleArb,
            status: cardStatusArb,
            deckName: fc.string({ minLength: 1, maxLength: 20 }),
            dueDate: fc.constant(undefined)
          }),
          (card) => {
            const meta = formatMeta(card as GridCardItem);
            
            // 元信息各部分应使用分隔符
            expect(meta).toContain(' · ');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should render grid card with complete meta info', () => {
      fc.assert(
        fc.property(
          gridCardItemArb,
          (card) => {
            const rendered = renderGridCard(card);
            
            // 渲染结果应包含元信息
            expect(rendered.meta).toBeDefined();
            expect(rendered.meta.length).toBeGreaterThan(0);
            
            // 状态应正确传递
            expect(rendered.status).toBe(card.status);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
  describe('Integration: Mobile Grid Card Rendering', () => {
    
    it('should render complete grid card with all properties', () => {
      fc.assert(
        fc.property(
          gridCardItemArb,
          (card) => {
            const rendered = renderGridCard(card);
            
            // 所有必需属性应存在
            expect(rendered).toHaveProperty('title');
            expect(rendered).toHaveProperty('truncated');
            expect(rendered).toHaveProperty('lineCount');
            expect(rendered).toHaveProperty('status');
            expect(rendered).toHaveProperty('meta');
            
            // 类型验证
            expect(typeof rendered.title).toBe('string');
            expect(typeof rendered.truncated).toBe('boolean');
            expect(typeof rendered.lineCount).toBe('number');
            expect(['new', 'learning', 'review']).toContain(rendered.status);
            expect(typeof rendered.meta).toBe('string');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should maintain consistency between title and truncation state', () => {
      fc.assert(
        fc.property(
          gridCardItemArb,
          (card) => {
            const rendered = renderGridCard(card);
            
            // 如果标记为截断，标题应以省略号结尾（除非原标题为空）
            if (rendered.truncated && card.title.length > 0) {
              expect(rendered.title.endsWith('...')).toBe(true);
            }
            
            // 如果未截断，标题应与原标题相同
            if (!rendered.truncated) {
              expect(rendered.title).toBe(card.title);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle cards with minimal data', () => {
      const minimalCard: GridCardItem = {
        id: 'minimal-id',
        title: 'A',
        status: 'new'
      };
      
      const rendered = renderGridCard(minimalCard);
      
      expect(rendered.title).toBe('A');
      expect(rendered.truncated).toBe(false);
      expect(rendered.lineCount).toBe(1);
      expect(rendered.status).toBe('new');
      expect(rendered.meta).toContain('新卡');
    });
    
  });
  
});
