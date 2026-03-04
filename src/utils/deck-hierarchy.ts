/**
 * 牌组工具函数（平级架构）
 * 
 * @description Weave v2.0+ 采用平级牌组架构，无父子层级关系
 * 
 * ℹ 历史说明：
 * - 旧版本支持父子牌组层级
 * - v2.0+ 已废弃层级结构，相关函数已标记 @deprecated
 */

import type { Deck } from '../data/types';
import type { DeckHierarchyNode, DeckStats } from '../types/deck-selector-types';

/**
 * 构建牌组列表（平级架构）
 * 
 * @deprecated 平级架构下 children 始终为空数组
 * @param decks 牌组列表
 * @param deckCardCounts 牌组卡片数量映射
 * @param selectedDeckIds 已选中的牌组ID
 * @param _expandedDeckIds 已废弃，平级架构无展开/折叠概念
 * @returns 平级节点列表（children 始终为 [])
 */
export function buildDeckHierarchy(
  decks: Deck[],
  deckCardCounts: Map<string, number>,
  selectedDeckIds: Set<string> = new Set(),
  _expandedDeckIds: Set<string> = new Set()
): DeckHierarchyNode[] {
  // 平级架构：按 order 排序，所有牌组都是根节点
  const sortedDecks = [...decks].sort((a, b) => (a.order || 0) - (b.order || 0));

  return sortedDecks.map(deck => ({
    deck,
    children: [], // 平级架构：始终为空
    level: 0,     // 平级架构：始终为 0
    cardCount: deckCardCounts.get(deck.id) || 0,
    selected: selectedDeckIds.has(deck.id),
    disabled: false,
    expanded: true // 平级架构：无意义，始终为 true
  }));
}

/**
 * 扁平化节点列表
 * 
 * @deprecated 平级架构下直接返回输入列表
 * @param nodes 节点列表
 * @param _includeCollapsed 已废弃，平级架构无折叠概念
 * @returns 输入列表的副本
 */
export function flattenHierarchy(
  nodes: DeckHierarchyNode[],
  _includeCollapsed = false
): DeckHierarchyNode[] {
  // 平级架构：直接返回输入列表
  return [...nodes];
}

/**
 * 获取牌组的缩进级别
 * 
 * @deprecated 平级架构下始终返回 0
 * @param _path 已废弃
 * @returns 0
 */
export function getIndentLevel(_path: string): number {
  return 0; // 平级架构：始终为 0
}

/**
 * 格式化牌组名称
 * 
 * @param name 牌组名称（平级架构下 path = name）
 * @param _showFullPath 已废弃，平级架构无路径概念
 * @returns 牌组名称
 */
export function formatDeckPath(name: string, _showFullPath = false): string {
  return name || '未命名牌组';
}

/**
 * 搜索牌组
 * 
 * @param nodes 节点列表
 * @param query 搜索查询
 * @returns 匹配的节点列表
 */
export function searchDecks(
  nodes: DeckHierarchyNode[],
  query: string
): DeckHierarchyNode[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();
  return nodes.filter(node => 
    node.deck.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * @deprecated 平级架构无展开/折叠概念，直接返回输入列表
 */
export function toggleNodeExpanded(
  nodes: DeckHierarchyNode[],
  _deckId: string
): DeckHierarchyNode[] {
  return nodes;
}

/**
 * @deprecated 平级架构无展开概念，返回所有牌组ID
 */
export function getExpandedDeckIds(nodes: DeckHierarchyNode[]): string[] {
  return nodes.map(n => n.deck.id);
}

/**
 * 计算选择限制
 * 
 * @param selectedDeckIds 已选中的牌组ID
 * @param deckCardCounts 牌组卡片数量映射
 * @param maxDeckSelection 最大牌组选择数
 * @param cardCountThreshold 卡片数阈值
 * @returns 选择限制信息
 */
export function calculateSelectionLimit(
  selectedDeckIds: string[],
  deckCardCounts: Map<string, number>,
  maxDeckSelection = 4,
  cardCountThreshold = 3000
): {
  maxDecks: number;
  currentCards: number;
  maxCards: number;
  canSelectMore: boolean;
  limitReason?: string;
} {
  const currentCards = selectedDeckIds.reduce((sum, id) => {
    return sum + (deckCardCounts.get(id) || 0);
  }, 0);

  // 如果当前卡片数超过阈值，只能选1个
  if (currentCards >= cardCountThreshold) {
    return {
      maxDecks: 1,
      currentCards,
      maxCards: cardCountThreshold,
      canSelectMore: false,
      limitReason: `卡片总数已超过${cardCountThreshold}张，只能选择1个牌组`
    };
  }

  // 如果已选数量达到上限
  if (selectedDeckIds.length >= maxDeckSelection) {
    return {
      maxDecks: maxDeckSelection,
      currentCards,
      maxCards: cardCountThreshold,
      canSelectMore: false,
      limitReason: `最多只能选择${maxDeckSelection}个牌组`
    };
  }

  // 可以继续选择
  return {
    maxDecks: maxDeckSelection,
    currentCards,
    maxCards: cardCountThreshold,
    canSelectMore: true
  };
}

/**
 * 构建牌组统计信息
 * 
 * @param decks 牌组列表
 * @param deckCardCounts 牌组卡片数量映射
 * @returns 统计信息列表
 */
export function buildDeckStats(
  decks: Deck[],
  deckCardCounts: Map<string, number>
): DeckStats[] {
  return decks.map(deck => ({
    deckId: deck.id,
    name: deck.name,
    cardCount: deckCardCounts.get(deck.id) || 0,
    path: deck.name, // 平级架构：path = name
    level: 0         // 平级架构：始终为 0
  }));
}

