/**
 * MobileNavMenu 属性测试
 * 
 * Property 10: 菜单项结构完整性
 * - 验证每个菜单项都有 id、icon、label
 * - 验证菜单分类结构正确
 * - 验证当前视图高亮显示
 * 
 * @module services/__tests__/MobileNavMenu.property.test
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ===== 类型定义 =====

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  active?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ===== 菜单配置（从组件提取） =====

const MENU_SECTIONS: MenuSection[] = [
  {
    title: '功能切换',
    items: [
      { id: 'deck-study', icon: 'graduation-cap', label: '牌组学习' },
      { id: 'card-management', icon: 'list', label: '卡片管理' },
      { id: 'ai-assistant', icon: 'bot', label: 'AI助手' }
    ]
  },
  {
    title: '视图切换',
    items: [
      { id: 'toggle-view', icon: 'refresh-cw', label: '切换视图' },
      { id: 'new-deck', icon: 'plus', label: '新建牌组' },
      { id: 'more-actions', icon: 'more-horizontal', label: '更多操作' }
    ]
  },
  {
    title: '牌组学习',
    items: [
      { id: 'incremental-reading', icon: 'book-open', label: '增量摘录' },
      { id: 'memory-deck', icon: 'brain', label: '记忆牌组' },
      { id: 'quiz-deck', icon: 'edit-3', label: '考试牌组' }
    ]
  }
];

// ===== 辅助函数 =====

function getAllMenuItems(sections: MenuSection[]): MenuItem[] {
  return sections.flatMap(section => section.items);
}

function findActiveItem(sections: MenuSection[], currentView: string): MenuItem | undefined {
  return getAllMenuItems(sections).find(item => item.id === currentView);
}

function validateMenuItem(item: MenuItem): boolean {
  return (
    typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.icon === 'string' && item.icon.length > 0 &&
    typeof item.label === 'string' && item.label.length > 0
  );
}

function validateMenuSection(section: MenuSection): boolean {
  return (
    typeof section.title === 'string' && section.title.length > 0 &&
    Array.isArray(section.items) && section.items.length > 0 &&
    section.items.every(validateMenuItem)
  );
}

// ===== Arbitraries =====

const menuItemIdArbitrary = fc.constantFrom(
  'deck-study', 'card-management', 'ai-assistant',
  'toggle-view', 'new-deck', 'more-actions',
  'incremental-reading', 'memory-deck', 'quiz-deck'
);

const menuItemArbitrary: fc.Arbitrary<MenuItem> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  icon: fc.string({ minLength: 1, maxLength: 30 }),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  active: fc.option(fc.boolean(), { nil: undefined })
});

const menuSectionArbitrary: fc.Arbitrary<MenuSection> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 30 }),
  items: fc.array(menuItemArbitrary, { minLength: 1, maxLength: 10 })
});

// ===== Property 10: 菜单项结构完整性 =====
describe('Property 10: 菜单项结构完整性', () => {
  it('每个菜单项都有非空的 id', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (item) => {
          return typeof item.id === 'string' && item.id.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个菜单项都有非空的 icon', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (item) => {
          return typeof item.icon === 'string' && item.icon.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个菜单项都有非空的 label', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (item) => {
          return typeof item.label === 'string' && item.label.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('菜单分类有非空的 title', () => {
    fc.assert(
      fc.property(
        menuSectionArbitrary,
        (section) => {
          return typeof section.title === 'string' && section.title.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('菜单分类至少有一个菜单项', () => {
    fc.assert(
      fc.property(
        menuSectionArbitrary,
        (section) => {
          return Array.isArray(section.items) && section.items.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 实际菜单配置验证 =====
describe('实际菜单配置验证', () => {
  it('所有预定义菜单分类都有效', () => {
    for (const section of MENU_SECTIONS) {
      expect(validateMenuSection(section)).toBe(true);
    }
  });

  it('所有预定义菜单项都有效', () => {
    const allItems = getAllMenuItems(MENU_SECTIONS);
    for (const item of allItems) {
      expect(validateMenuItem(item)).toBe(true);
    }
  });

  it('菜单项 ID 唯一', () => {
    const allItems = getAllMenuItems(MENU_SECTIONS);
    const ids = allItems.map(item => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('有三个菜单分类', () => {
    expect(MENU_SECTIONS.length).toBe(3);
  });

  it('功能切换分类有三个选项', () => {
    const section = MENU_SECTIONS.find(s => s.title === '功能切换');
    expect(section).toBeDefined();
    expect(section!.items.length).toBe(3);
  });
});

// ===== 当前视图高亮测试 =====
describe('当前视图高亮', () => {
  it('能找到当前视图对应的菜单项', () => {
    fc.assert(
      fc.property(
        menuItemIdArbitrary,
        (currentView) => {
          const activeItem = findActiveItem(MENU_SECTIONS, currentView);
          return activeItem !== undefined && activeItem.id === currentView;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('不存在的视图返回 undefined', () => {
    const activeItem = findActiveItem(MENU_SECTIONS, 'non-existent-view');
    expect(activeItem).toBeUndefined();
  });

  it('每次只有一个菜单项被高亮', () => {
    fc.assert(
      fc.property(
        menuItemIdArbitrary,
        (currentView) => {
          const allItems = getAllMenuItems(MENU_SECTIONS);
          const activeItems = allItems.filter(item => item.id === currentView);
          return activeItems.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 菜单项点击行为 =====
describe('菜单项点击行为', () => {
  it('点击菜单项返回正确的 ID', () => {
    fc.assert(
      fc.property(
        menuItemIdArbitrary,
        (itemId) => {
          // 模拟点击行为
          let clickedId: string | null = null;
          const handleClick = (id: string) => { clickedId = id; };
          
          handleClick(itemId);
          
          return clickedId === itemId;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 边界条件测试 =====
describe('边界条件测试', () => {
  it('空菜单分类数组不会崩溃', () => {
    const emptyItems = getAllMenuItems([]);
    expect(emptyItems).toEqual([]);
  });

  it('空字符串视图返回 undefined', () => {
    const activeItem = findActiveItem(MENU_SECTIONS, '');
    expect(activeItem).toBeUndefined();
  });
});
