/**
 * 移动端表格视图属性测试
 * 
 * Feature: mobile-deck-study-redesign
 * Task: 10.3 - 编写表格视图属性测试
 * 
 * Property 5: 卡片内容文本截断
 * Property 6: 卡片状态颜色映射
 * 
 * Validates: Requirements 10.2, 10.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ==================== 类型定义 ====================

type CardStatus = 'new' | 'learning' | 'review';

interface CardItem {
  id: string;
  content: string;
  status: CardStatus;
  dueDate?: Date;
}

// ==================== 状态颜色映射 ====================

const STATUS_COLOR_MAP: Record<CardStatus, string> = {
  new: '#3b82f6',      // 蓝色
  learning: '#f59e0b', // 橙色
  review: '#22c55e'    // 绿色
};

// ==================== 辅助函数 ====================

/**
 * 获取卡片状态对应的颜色
 */
function getStatusColor(status: CardStatus): string {
  return STATUS_COLOR_MAP[status];
}

/**
 * 检查文本是否需要截断
 * @param text 原始文本
 * @param maxWidth 最大宽度（字符数近似）
 */
function shouldTruncate(text: string, maxWidth: number): boolean {
  // 简化计算：假设每个字符宽度相同
  // 实际 CSS 使用 text-overflow: ellipsis
  return text.length > maxWidth;
}

/**
 * 截断文本并添加省略号
 * @param text 原始文本
 * @param maxWidth 最大宽度（字符数）
 */
function truncateText(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }
  return text.slice(0, maxWidth - 3) + '...';
}

/**
 * 模拟移动端表格行渲染
 */
function renderMobileTableRow(card: CardItem, maxContentWidth: number): {
  content: string;
  truncated: boolean;
  statusColor: string;
  dueDate: string;
} {
  const truncated = shouldTruncate(card.content, maxContentWidth);
  const displayContent = truncated 
    ? truncateText(card.content, maxContentWidth)
    : card.content;
  
  return {
    content: displayContent,
    truncated,
    statusColor: getStatusColor(card.status),
    dueDate: card.dueDate 
      ? formatDueDate(card.dueDate)
      : '-'
  };
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
  } else if (diffDays <= 7) {
    return `${diffDays}天后`;
  } else {
    return `${Math.floor(diffDays / 7)}周后`;
  }
}

/**
 * 验证状态颜色是否为有效的十六进制颜色
 */
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ==================== Arbitraries ====================

/**
 * 卡片状态生成器
 */
const cardStatusArb = fc.constantFrom<CardStatus>('new', 'learning', 'review');

/**
 * 卡片内容生成器 - 各种长度的文本
 */
const cardContentArb = fc.oneof(
  // 短文本（不需要截断）
  fc.string({ minLength: 1, maxLength: 20 }),
  // 中等文本（可能需要截断）
  fc.string({ minLength: 21, maxLength: 50 }),
  // 长文本（肯定需要截断）
  fc.string({ minLength: 51, maxLength: 200 }),
  // 包含中文的文本
  fc.array(
    fc.constantFrom('学', '习', '卡', '片', '内', '容', '测', '试', '文', '本'),
    { minLength: 1, maxLength: 100 }
  ).map(arr => arr.join('')),
  // 包含特殊字符的文本
  fc.string({ minLength: 1, maxLength: 100 }).map(s => s.replace(/[\x00-\x1f]/g, ''))
);

/**
 * 到期日期生成器
 */
const dueDateArb = fc.option(
  fc.date({
    min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
    max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)  // 90天后
  }),
  { nil: undefined }
);

/**
 * 卡片项生成器
 */
const cardItemArb: fc.Arbitrary<CardItem> = fc.record({
  id: fc.uuid(),
  content: cardContentArb,
  status: cardStatusArb,
  dueDate: dueDateArb
});

/**
 * 最大内容宽度生成器（模拟不同屏幕宽度）
 */
const maxWidthArb = fc.integer({ min: 20, max: 100 });

// ==================== Property Tests ====================

describe('MobileTableView Property Tests', () => {
  
  describe('Property 5: 卡片内容文本截断', () => {
    
    it('should truncate text when content exceeds max width', () => {
      fc.assert(
        fc.property(
          cardContentArb,
          maxWidthArb,
          (content, maxWidth) => {
            const truncated = truncateText(content, maxWidth);
            
            // 截断后的文本长度不应超过最大宽度
            expect(truncated.length).toBeLessThanOrEqual(maxWidth);
            
            // 如果原文本超过最大宽度，截断后应以省略号结尾
            if (content.length > maxWidth) {
              expect(truncated.endsWith('...')).toBe(true);
            }
            
            // 如果原文本不超过最大宽度，应保持原样
            if (content.length <= maxWidth) {
              expect(truncated).toBe(content);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should correctly identify when truncation is needed', () => {
      fc.assert(
        fc.property(
          cardContentArb,
          maxWidthArb,
          (content, maxWidth) => {
            const needsTruncation = shouldTruncate(content, maxWidth);
            
            // 截断判断应与实际长度比较一致
            expect(needsTruncation).toBe(content.length > maxWidth);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should preserve content meaning when truncating', () => {
      fc.assert(
        fc.property(
          cardContentArb,
          maxWidthArb,
          (content, maxWidth) => {
            const truncated = truncateText(content, maxWidth);
            
            // 截断后的文本（去掉省略号）应是原文本的前缀
            if (content.length > maxWidth) {
              const prefix = truncated.slice(0, -3); // 去掉 '...'
              expect(content.startsWith(prefix)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle empty content gracefully', () => {
      const emptyContent = '';
      const maxWidth = 50;
      
      const truncated = truncateText(emptyContent, maxWidth);
      expect(truncated).toBe('');
      expect(shouldTruncate(emptyContent, maxWidth)).toBe(false);
    });
    
    it('should render table row with correct truncation state', () => {
      fc.assert(
        fc.property(
          cardItemArb,
          maxWidthArb,
          (card, maxWidth) => {
            const rendered = renderMobileTableRow(card, maxWidth);
            
            // 渲染结果的截断状态应与预期一致
            expect(rendered.truncated).toBe(card.content.length > maxWidth);
            
            // 渲染的内容长度不应超过最大宽度
            expect(rendered.content.length).toBeLessThanOrEqual(maxWidth);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
  describe('Property 6: 卡片状态颜色映射', () => {
    
    it('should map card status to correct color', () => {
      fc.assert(
        fc.property(
          cardStatusArb,
          (status) => {
            const color = getStatusColor(status);
            const expectedColors: Record<CardStatus, string> = {
              new: '#3b82f6',      // 蓝色
              learning: '#f59e0b', // 橙色
              review: '#22c55e'    // 绿色
            };
            
            expect(color).toBe(expectedColors[status]);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should return valid hex color for all statuses', () => {
      fc.assert(
        fc.property(
          cardStatusArb,
          (status) => {
            const color = getStatusColor(status);
            
            // 颜色应为有效的十六进制格式
            expect(isValidHexColor(color)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should have unique colors for each status', () => {
      const colors = Object.values(STATUS_COLOR_MAP);
      const uniqueColors = new Set(colors);
      
      // 每个状态应有唯一的颜色
      expect(uniqueColors.size).toBe(colors.length);
    });
    
    it('should render table row with correct status color', () => {
      fc.assert(
        fc.property(
          cardItemArb,
          (card) => {
            const rendered = renderMobileTableRow(card, 50);
            
            // 渲染结果的状态颜色应与映射一致
            expect(rendered.statusColor).toBe(STATUS_COLOR_MAP[card.status]);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should cover all possible status values', () => {
      const allStatuses: CardStatus[] = ['new', 'learning', 'review'];
      
      allStatuses.forEach(status => {
        const color = getStatusColor(status);
        expect(color).toBeDefined();
        expect(isValidHexColor(color)).toBe(true);
      });
    });
    
  });
  
  describe('Integration: Mobile Table Row Rendering', () => {
    
    it('should render complete table row with all properties', () => {
      fc.assert(
        fc.property(
          cardItemArb,
          maxWidthArb,
          (card, maxWidth) => {
            const rendered = renderMobileTableRow(card, maxWidth);
            
            // 所有必需属性应存在
            expect(rendered).toHaveProperty('content');
            expect(rendered).toHaveProperty('truncated');
            expect(rendered).toHaveProperty('statusColor');
            expect(rendered).toHaveProperty('dueDate');
            
            // 类型验证
            expect(typeof rendered.content).toBe('string');
            expect(typeof rendered.truncated).toBe('boolean');
            expect(typeof rendered.statusColor).toBe('string');
            expect(typeof rendered.dueDate).toBe('string');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should format due date correctly', () => {
      fc.assert(
        fc.property(
          dueDateArb,
          (dueDate) => {
            if (dueDate) {
              const formatted = formatDueDate(dueDate);
              
              // 格式化结果应为非空字符串
              expect(formatted.length).toBeGreaterThan(0);
              
              // 应包含时间相关的中文字符或数字
              expect(/[天周今明后前\d]/.test(formatted)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle cards without due date', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            content: cardContentArb,
            status: cardStatusArb,
            dueDate: fc.constant(undefined)
          }),
          (card) => {
            const rendered = renderMobileTableRow(card as CardItem, 50);
            
            // 无到期时间时应显示占位符
            expect(rendered.dueDate).toBe('-');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
});
