/**
 * 标签工具函数集
 * 用于处理标签的层级结构、筛选和计数
 */

import { TagExtractor } from './tag-extractor';

/**
 * 移除标签的 # 前缀
 * @param tag - 标签字符串（可能包含#前缀）
 * @returns 移除#前缀后的标签
 */
export function removeHashPrefix(tag: string): string {
  return tag.startsWith('#') ? tag.slice(1) : tag;
}

/**
 * 检查卡片标签是否匹配筛选标签（支持层级匹配）
 * @param cardTags - 卡片的标签数组
 * @param selectedTag - 选中的筛选标签
 * @returns 是否匹配
 * 
 * @example
 * // 点击父标签 "学习"
 * matchesTagFilter(['学习/理论', '笔记'], '学习') // true (层级匹配)
 * matchesTagFilter(['笔记'], '学习') // false
 * 
 * // 点击子标签 "学习/理论"
 * matchesTagFilter(['学习/理论'], '学习/理论') // true (精确匹配)
 * matchesTagFilter(['学习'], '学习/理论') // false (父标签不匹配子标签)
 */
export function matchesTagFilter(cardTags: string[], selectedTag: string): boolean {
  if (!cardTags || cardTags.length === 0) return false;
  
  const cleanSelected = removeHashPrefix(selectedTag);
  
  return cardTags.some(_tag => {
    const cleanTag = removeHashPrefix(_tag);
    
    // 精确匹配
    if (cleanTag === cleanSelected) return true;
    
    // 层级匹配：卡片标签是选中标签的子标签
    // 例如：选中 "学习"，匹配 "学习/理论"
    return cleanTag.startsWith(`${cleanSelected}/`);
  });
}

/**
 * 计算标签聚合计数
 * 父标签的计数 = 直接使用该标签的卡片数 + 所有子标签的卡片数（去重）
 * 
 * @param cards - 卡片数组
 * @returns 标签计数结果
 * 
 * @example
 * const cards = [
 *   { id: '1', tags: ['学习'] },
 *   { id: '2', tags: ['学习/理论'] },
 *   { id: '3', tags: ['学习/理论/CFT'] }
 * ];
 * 
 * calculateTagCounts(cards) 
 * // {
 * //   aggregatedCounts: {
 * //     '学习': 3,           // 包含所有子标签
 * //     '学习/理论': 2,      // 包含 CFT 子标签
 * //     '学习/理论/CFT': 1   // 叶子节点
 * //   },
 * //   allTags: ['学习', '学习/理论', '学习/理论/CFT']
 * // }
 */
export function calculateTagCounts(
  cards: Array<{ id: string; tags?: string[]; content?: string }>
): { aggregatedCounts: Record<string, number>; allTags: string[] } {
  // 标签路径 -> 卡片ID集合（用于去重）
  const tagToCardIds = new Map<string, Set<string>>();
  
  // 所有标签路径集合
  const allTagPaths = new Set<string>();

  // 辅助：处理单个标签
  function processTag(cardId: string, tag: string) {
    const cleanTag = removeHashPrefix(tag);
    const parts = cleanTag.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join('/');
      allTagPaths.add(path);
      if (!tagToCardIds.has(path)) {
        tagToCardIds.set(path, new Set());
      }
      tagToCardIds.get(path)?.add(cardId);
    }
  }
  
  // 遍历所有卡片，合并 tags 数组 + content 内联 #标签
  cards.forEach(_card => {
    // 1. card.tags 数组
    if (Array.isArray(_card.tags)) {
      _card.tags.forEach(_tag => processTag(_card.id, _tag));
    }
    
    // 2. 从 card.content 提取内联 #标签（排除代码块）
    if (typeof _card.content === 'string' && _card.content) {
      const contentTags = TagExtractor.extractTagsExcludingCode(_card.content);
      contentTags.forEach(_tag => processTag(_card.id, _tag));
    }
  });
  
  // 计算聚合计数
  const aggregatedCounts: Record<string, number> = {};
  allTagPaths.forEach(_path => {
    aggregatedCounts[_path] = tagToCardIds.get(_path)?.size || 0;
  });
  
  return {
    aggregatedCounts,
    allTags: Array.from(allTagPaths)
  };
}








