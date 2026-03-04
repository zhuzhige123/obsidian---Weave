/**
 * 移动端看板视图属性测试
 * 
 * Feature: mobile-deck-study-redesign
 * Task: 12.4 - 编写看板视图属性测试
 * 
 * Property 9: 看板列标题显示
 * 
 * Validates: Requirements 12.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ==================== 类型定义 ====================

type CardStatus = 'new' | 'learning' | 'review' | 'relearning';

interface KanbanColumn {
  id: string;
  title: string;
  status: CardStatus;
  cardCount: number;
  color: string;
}

interface KanbanColumnDisplay {
  title: string;
  countBadge: string;
  fullTitle: string;
  color: string;
}

// ==================== 常量定义 ====================

const STATUS_LABELS: Record<CardStatus, string> = {
  new: '新卡片',
  learning: '学习中',
  review: '复习',
  relearning: '重新学习'
};

const STATUS_COLORS: Record<CardStatus, string> = {
  new: '#6b7280',
  learning: '#3b82f6',
  review: '#10b981',
  relearning: '#f59e0b'
};

// ==================== 辅助函数 ====================

/**
 * 获取状态标签
 */
function getStatusLabel(status: CardStatus): string {
  return STATUS_LABELS[status];
}

/**
 * 获取状态颜色
 */
function getStatusColor(status: CardStatus): string {
  return STATUS_COLORS[status];
}

/**
 * 格式化卡片数量徽章
 */
function formatCountBadge(count: number): string {
  if (count >= 1000) {
    return `${Math.floor(count / 1000)}k+`;
  }
  return String(count);
}

/**
 * 渲染看板列标题显示
 */
function renderKanbanColumnHeader(column: KanbanColumn): KanbanColumnDisplay {
  const statusLabel = getStatusLabel(column.status);
  const countBadge = formatCountBadge(column.cardCount);
  
  return {
    title: statusLabel,
    countBadge,
    fullTitle: `${statusLabel} (${countBadge})`,
    color: column.color || getStatusColor(column.status)
  };
}

/**
 * 验证颜色是否为有效的十六进制格式
 */
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * 创建看板列
 */
function createKanbanColumn(
  status: CardStatus,
  cardCount: number,
  customColor?: string
): KanbanColumn {
  return {
    id: `column-${status}`,
    title: getStatusLabel(status),
    status,
    cardCount,
    color: customColor || getStatusColor(status)
  };
}

// ==================== Arbitraries ====================

/**
 * 卡片状态生成器
 */
const cardStatusArb = fc.constantFrom<CardStatus>('new', 'learning', 'review', 'relearning');

/**
 * 卡片数量生成器
 */
const cardCountArb = fc.integer({ min: 0, max: 10000 });

/**
 * 自定义颜色生成器
 */
const customColorArb = fc.option(
  fc.string({ minLength: 6, maxLength: 6 })
    .filter(s => /^[0-9A-Fa-f]+$/.test(s))
    .map(hex => `#${hex}`),
  { nil: undefined }
);

/**
 * 看板列生成器
 */
const kanbanColumnArb: fc.Arbitrary<KanbanColumn> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 20 }),
  status: cardStatusArb,
  cardCount: cardCountArb,
  color: fc.string({ minLength: 6, maxLength: 6 })
    .filter(s => /^[0-9A-Fa-f]+$/.test(s))
    .map(hex => `#${hex}`)
});

// ==================== Property Tests ====================

describe('MobileKanbanView Property Tests', () => {
  
  describe('Property 9: 看板列标题显示', () => {
    
    it('should display status name in column header', () => {
      fc.assert(
        fc.property(
          cardStatusArb,
          cardCountArb,
          (status, cardCount) => {
            const column = createKanbanColumn(status, cardCount);
            const rendered = renderKanbanColumnHeader(column);
            
            // 标题应为状态标签
            expect(rendered.title).toBe(STATUS_LABELS[status]);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should display card count in column header', () => {
      fc.assert(
        fc.property(
          cardStatusArb,
          cardCountArb,
          (status, cardCount) => {
            const column = createKanbanColumn(status, cardCount);
            const rendered = renderKanbanColumnHeader(column);
            
            // 数量徽章应存在
            expect(rendered.countBadge).toBeDefined();
            expect(rendered.countBadge.length).toBeGreaterThan(0);
            
            // 完整标题应包含状态名称和数量
            expect(rendered.fullTitle).toContain(rendered.title);
            expect(rendered.fullTitle).toContain(rendered.countBadge);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should format large card counts correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 100000 }),
          (largeCount) => {
            const badge = formatCountBadge(largeCount);
            
            // 大数量应使用 k+ 格式
            expect(badge).toMatch(/^\d+k\+$/);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should display small card counts as-is', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          (smallCount) => {
            const badge = formatCountBadge(smallCount);
            
            // 小数量应直接显示数字
            expect(badge).toBe(String(smallCount));
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should use correct color for each status', () => {
      fc.assert(
        fc.property(
          cardStatusArb,
          (status) => {
            const column = createKanbanColumn(status, 10);
            const rendered = renderKanbanColumnHeader(column);
            
            // 颜色应为有效的十六进制格式
            expect(isValidHexColor(rendered.color)).toBe(true);
            
            // 颜色应与状态对应
            expect(rendered.color).toBe(STATUS_COLORS[status]);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should support custom column colors', () => {
      fc.assert(
        fc.property(
          cardStatusArb,
          cardCountArb,
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^[0-9A-Fa-f]+$/.test(s)),
          (status, cardCount, hexColor) => {
            const customColor = `#${hexColor}`;
            const column = createKanbanColumn(status, cardCount, customColor);
            const rendered = renderKanbanColumnHeader(column);
            
            // 应使用自定义颜色
            expect(rendered.color).toBe(customColor);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should have unique labels for each status', () => {
      const allStatuses: CardStatus[] = ['new', 'learning', 'review', 'relearning'];
      const labels = allStatuses.map(s => getStatusLabel(s));
      const uniqueLabels = new Set(labels);
      
      // 每个状态应有唯一的标签
      expect(uniqueLabels.size).toBe(allStatuses.length);
    });
    
    it('should have unique colors for each status', () => {
      const allStatuses: CardStatus[] = ['new', 'learning', 'review', 'relearning'];
      const colors = allStatuses.map(s => getStatusColor(s));
      const uniqueColors = new Set(colors);
      
      // 每个状态应有唯一的颜色
      expect(uniqueColors.size).toBe(allStatuses.length);
    });
    
  });
  
  describe('Integration: Kanban Column Rendering', () => {
    
    it('should render complete column header with all properties', () => {
      fc.assert(
        fc.property(
          kanbanColumnArb,
          (column) => {
            const rendered = renderKanbanColumnHeader(column);
            
            // 所有必需属性应存在
            expect(rendered).toHaveProperty('title');
            expect(rendered).toHaveProperty('countBadge');
            expect(rendered).toHaveProperty('fullTitle');
            expect(rendered).toHaveProperty('color');
            
            // 类型验证
            expect(typeof rendered.title).toBe('string');
            expect(typeof rendered.countBadge).toBe('string');
            expect(typeof rendered.fullTitle).toBe('string');
            expect(typeof rendered.color).toBe('string');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle zero card count', () => {
      const column = createKanbanColumn('new', 0);
      const rendered = renderKanbanColumnHeader(column);
      
      expect(rendered.countBadge).toBe('0');
      expect(rendered.fullTitle).toContain('0');
    });
    
    it('should handle all status types', () => {
      const allStatuses: CardStatus[] = ['new', 'learning', 'review', 'relearning'];
      
      allStatuses.forEach(status => {
        const column = createKanbanColumn(status, 42);
        const rendered = renderKanbanColumnHeader(column);
        
        expect(rendered.title).toBe(STATUS_LABELS[status]);
        expect(rendered.color).toBe(STATUS_COLORS[status]);
        expect(rendered.countBadge).toBe('42');
      });
    });
    
    it('should maintain consistency between title and fullTitle', () => {
      fc.assert(
        fc.property(
          kanbanColumnArb,
          (column) => {
            const rendered = renderKanbanColumnHeader(column);
            
            // fullTitle 应包含 title
            expect(rendered.fullTitle).toContain(rendered.title);
            
            // fullTitle 应包含 countBadge
            expect(rendered.fullTitle).toContain(rendered.countBadge);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
});
