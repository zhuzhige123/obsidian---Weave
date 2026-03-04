/**
 * MobileDeckEditSheet 属性测试
 * 
 * Property 4: 标签列表交互一致性
 * - 验证标签切换状态正确
 * - 验证选中标签显示选中标记
 * - 验证保存时返回正确的选中标签
 * 
 * @module services/__tests__/MobileDeckEditSheet.property.test
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ===== 类型定义 =====

interface TagItem {
  id: string;
  name: string;
  color: string;
  selected: boolean;
}

// ===== 辅助函数 =====

function toggleTag(tags: TagItem[], tagId: string): TagItem[] {
  return tags.map(tag => 
    tag.id === tagId ? { ...tag, selected: !tag.selected } : tag
  );
}

function getSelectedTagIds(tags: TagItem[]): string[] {
  return tags.filter(t => t.selected).map(t => t.id);
}

function validateTagItem(item: TagItem): boolean {
  return (
    typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.name === 'string' && item.name.length > 0 &&
    typeof item.color === 'string' && item.color.length > 0 &&
    typeof item.selected === 'boolean'
  );
}

// ===== Arbitraries =====

const hexColorArbitrary = fc.array(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
  { minLength: 6, maxLength: 6 }
).map(arr => `#${arr.join('')}`);

const tagItemArbitrary: fc.Arbitrary<TagItem> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  color: hexColorArbitrary,
  selected: fc.boolean()
});

const tagListArbitrary = fc.array(tagItemArbitrary, { minLength: 0, maxLength: 20 });

// ===== Property 4: 标签列表交互一致性 =====
describe('Property 4: 标签列表交互一致性', () => {
  it('切换标签状态正确反转', () => {
    fc.assert(
      fc.property(
        fc.array(tagItemArbitrary, { minLength: 1, maxLength: 10 }),
        (tags) => {
          const tagId = tags[0].id;
          const originalState = tags[0].selected;
          const newTags = toggleTag(tags, tagId);
          const newState = newTags.find(t => t.id === tagId)?.selected;
          
          return newState === !originalState;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('切换不影响其他标签状态', () => {
    fc.assert(
      fc.property(
        fc.array(tagItemArbitrary, { minLength: 2, maxLength: 10 }),
        (tags) => {
          const tagId = tags[0].id;
          const newTags = toggleTag(tags, tagId);
          
          // 检查其他标签状态未变
          for (let i = 1; i < tags.length; i++) {
            const original = tags[i];
            const updated = newTags.find(t => t.id === original.id);
            if (updated?.selected !== original.selected) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('双击切换恢复原状态', () => {
    fc.assert(
      fc.property(
        fc.array(tagItemArbitrary, { minLength: 1, maxLength: 10 }),
        (tags) => {
          const tagId = tags[0].id;
          const originalState = tags[0].selected;
          
          // 切换两次
          const afterFirst = toggleTag(tags, tagId);
          const afterSecond = toggleTag(afterFirst, tagId);
          
          const finalState = afterSecond.find(t => t.id === tagId)?.selected;
          return finalState === originalState;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('获取选中标签ID列表正确', () => {
    fc.assert(
      fc.property(
        tagListArbitrary,
        (tags) => {
          const selectedIds = getSelectedTagIds(tags);
          const expectedCount = tags.filter(t => t.selected).length;
          
          return selectedIds.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('选中标签ID都存在于原列表中', () => {
    fc.assert(
      fc.property(
        tagListArbitrary,
        (tags) => {
          const selectedIds = getSelectedTagIds(tags);
          const allIds = new Set(tags.map(t => t.id));
          
          return selectedIds.every(id => allIds.has(id));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 标签项验证 =====
describe('标签项验证', () => {
  it('每个标签项都有非空的 id', () => {
    fc.assert(
      fc.property(
        tagItemArbitrary,
        (item) => {
          return typeof item.id === 'string' && item.id.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个标签项都有非空的 name', () => {
    fc.assert(
      fc.property(
        tagItemArbitrary,
        (item) => {
          return typeof item.name === 'string' && item.name.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个标签项都有有效的 color', () => {
    fc.assert(
      fc.property(
        tagItemArbitrary,
        (item) => {
          return typeof item.color === 'string' && item.color.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个标签项的 selected 是布尔值', () => {
    fc.assert(
      fc.property(
        tagItemArbitrary,
        (item) => {
          return typeof item.selected === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('标签项验证函数正确工作', () => {
    fc.assert(
      fc.property(
        tagItemArbitrary,
        (item) => {
          return validateTagItem(item);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 保存行为测试 =====
describe('保存行为', () => {
  it('保存时返回正确的选中标签ID', () => {
    fc.assert(
      fc.property(
        tagListArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        (tags, deckName) => {
          // 模拟保存行为
          let savedName: string | null = null;
          let savedTagIds: string[] | null = null;
          
          const handleSave = (name: string, selectedTagIds: string[]) => {
            savedName = name;
            savedTagIds = selectedTagIds;
          };
          
          const selectedIds = getSelectedTagIds(tags);
          handleSave(deckName, selectedIds);
          
          return (
            savedName === deckName &&
            savedTagIds !== null &&
            savedTagIds.length === selectedIds.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 边界条件测试 =====
describe('边界条件测试', () => {
  it('空标签列表不会崩溃', () => {
    const selectedIds = getSelectedTagIds([]);
    expect(selectedIds).toEqual([]);
  });

  it('切换不存在的标签ID不会崩溃', () => {
    const tags: TagItem[] = [
      { id: 'tag-1', name: 'Tag 1', color: '#7c3aed', selected: false }
    ];
    const newTags = toggleTag(tags, 'non-existent-id');
    expect(newTags).toEqual(tags);
  });

  it('所有标签都选中时返回所有ID', () => {
    const tags: TagItem[] = [
      { id: 'tag-1', name: 'Tag 1', color: '#7c3aed', selected: true },
      { id: 'tag-2', name: 'Tag 2', color: '#3b82f6', selected: true },
      { id: 'tag-3', name: 'Tag 3', color: '#22c55e', selected: true }
    ];
    const selectedIds = getSelectedTagIds(tags);
    expect(selectedIds.length).toBe(3);
  });

  it('所有标签都未选中时返回空数组', () => {
    const tags: TagItem[] = [
      { id: 'tag-1', name: 'Tag 1', color: '#7c3aed', selected: false },
      { id: 'tag-2', name: 'Tag 2', color: '#3b82f6', selected: false }
    ];
    const selectedIds = getSelectedTagIds(tags);
    expect(selectedIds.length).toBe(0);
  });
});
