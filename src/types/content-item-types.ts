/**
 * 统一内容项类型定义
 * 
 * 用于在统一的卡片管理界面中展示和管理多种内容类型：
 * - 记忆卡片 (card)
 * - 增量阅读内容块 (ir-block)
 * 
 * @module types/content-item-types
 * @version 1.0.0
 */

import type { Card, FSRSCard } from '../data/types';
import type { IRBlock } from './ir-types';

// ============================================
// 内容项类型
// ============================================

/** 内容项类型枚举 */
export type ContentItemType = 'card' | 'ir-block';

/** 内容项状态（统一状态） */
export type ContentItemState = 'new' | 'learning' | 'review' | 'suspended';

/** 内容项优先级 (1=高, 2=中, 3=低) */
export type ContentItemPriority = 1 | 2 | 3;

// ============================================
// 统一内容项接口
// ============================================

/**
 * 统一内容项接口
 * 
 * 将Card和IRBlock抽象为统一的ContentItem，
 * 便于在同一个视图中展示和管理
 */
export interface ContentItem {
  /** 唯一标识符 */
  uuid: string;
  
  /** 内容类型 */
  type: ContentItemType;
  
  /** 内容预览/摘要 */
  contentPreview: string;
  
  /** 完整标题/标识 */
  title: string;
  
  // ============================================
  // 共有字段
  // ============================================
  
  /** 标签列表 */
  tags: string[];
  
  /** 优先级 (1=高, 2=中, 3=低) */
  priority: ContentItemPriority;
  
  /** 状态 */
  state: ContentItemState;
  
  /** 是否收藏 */
  favorite: boolean;
  
  /** 来源文件路径 */
  sourceFile: string;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 修改时间 */
  updatedAt: string;
  
  /** 下次复习时间 */
  nextReview: string | null;
  
  /** 复习次数 */
  reviewCount: number;
  
  /** 所属牌组ID列表 */
  deckIds: string[];
  
  // ============================================
  // 类型特定数据
  // ============================================
  
  /** IR内容块专有数据 */
  irData?: {
    /** 标题层级路径 */
    headingPath: string[];
    /** 标题级别 */
    headingLevel: number;
    /** 起始行号 */
    startLine: number;
    /** 调度间隔（天） */
    interval: number;
    /** 间隔因子 */
    intervalFactor: number;
    /** 总阅读时长（秒） */
    totalReadingTime: number;
    /** 首次阅读时间 */
    firstReadAt: string | null;
    /** 用户笔记 */
    notes: string;
    /** 提取的卡片ID列表 */
    extractedCards: string[];
  };
  
  /** 记忆卡片专有数据 */
  cardData?: {
    /** 牌组ID */
    deckId: string;
    /** 模板ID */
    templateId: string;
    /** 卡片类型 */
    cardType: string;
    /** FSRS调度数据 */
    fsrs: FSRSCard;
    /** 字段内容 */
    fields: Record<string, string>;
  };
  
  // ============================================
  // 原始数据引用
  // ============================================
  
  /** 原始Card对象（仅card类型） */
  _rawCard?: Card;
  
  /** 原始IRBlock对象（仅ir-block类型） */
  _rawBlock?: IRBlock;
}

// ============================================
// 适配器函数
// ============================================

/**
 * 将IRBlock转换为ContentItem
 */
export function irBlockToContentItem(block: IRBlock, deckIds: string[] = []): ContentItem {
  const headingPath = block.headingPath || [];
  const title = headingPath.length > 0 
    ? headingPath.join(' > ') 
    : block.headingText || '(无标题)';
  
  return {
    uuid: block.id,
    type: 'ir-block',
    contentPreview: block.contentPreview || '',
    title,
    
    // 共有字段
    tags: block.tags || [],
    priority: (block.priority as ContentItemPriority) || 2,
    state: block.state as ContentItemState,
    favorite: block.favorite || false,
    sourceFile: block.filePath,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    nextReview: block.nextReview,
    reviewCount: block.reviewCount || 0,
    deckIds: deckIds,
    
    // IR专有数据
    irData: {
      headingPath,
      headingLevel: block.headingLevel,
      startLine: block.startLine ?? block.blockIndex ?? 0,
      interval: block.interval,
      intervalFactor: block.intervalFactor,
      totalReadingTime: block.totalReadingTime || 0,
      firstReadAt: block.firstReadAt || null,
      notes: block.notes || '',
      extractedCards: block.extractedCards || []
    },
    
    // 原始引用
    _rawBlock: block
  };
}

/**
 * 将Card转换为ContentItem
 */
export function cardToContentItem(card: Card): ContentItem {
  // 获取卡片预览内容
  const frontContent = card.fields?.front || card.fields?.['正面'] || '';
  const contentPreview = frontContent.slice(0, 100);
  const title = frontContent.slice(0, 50) || `卡片 ${card.uuid.slice(0, 8)}`;
  
  // 转换状态
  let state: ContentItemState = 'new';
  if (card.fsrs) {
    const fsrsState = card.fsrs.state;
    if (fsrsState === 1 || fsrsState === 3) { // Learning or Relearning
      state = 'learning';
    } else if (fsrsState === 2) { // Review
      state = 'review';
    }
  }
  
  // 转换优先级 (1-10 -> 1-3)
  const cardPriority = card.priority ?? 5;
  const priority: ContentItemPriority = cardPriority <= 3 ? 1 : cardPriority <= 6 ? 2 : 3;
  
  return {
    uuid: card.uuid,
    type: 'card',
    contentPreview,
    title,
    
    // 共有字段
    tags: card.tags || [],
    priority,
    state,
    favorite: false,  // Card目前没有favorite字段
    sourceFile: card.sourceFile || '',
    createdAt: card.created,
    updatedAt: card.modified,
    nextReview: card.fsrs?.due || null,
    reviewCount: card.fsrs?.reps || 0,
    deckIds: [card.deckId || ''],
    
    // Card专有数据
    cardData: {
      deckId: card.deckId || '',
      templateId: card.templateId || '',
      cardType: card.type || '',
      fsrs: card.fsrs!,
      fields: card.fields || {}
    },
    
    // 原始引用
    _rawCard: card
  };
}

// ============================================
// 筛选和排序
// ============================================

/** 内容项筛选条件 */
export interface ContentItemFilter {
  /** 类型筛选 */
  types?: ContentItemType[];
  /** 状态筛选 */
  states?: ContentItemState[];
  /** 标签筛选（任意匹配） */
  tags?: string[];
  /** 牌组ID筛选 */
  deckIds?: string[];
  /** 仅收藏 */
  favoriteOnly?: boolean;
  /** 仅今日到期 */
  dueToday?: boolean;
  /** 来源文件 */
  sourceFile?: string;
  /** 搜索关键词 */
  searchQuery?: string;
}

/** 内容项排序字段 */
export type ContentItemSortField = 
  | 'createdAt' 
  | 'updatedAt' 
  | 'nextReview' 
  | 'priority' 
  | 'reviewCount'
  | 'title';

/** 内容项排序配置 */
export interface ContentItemSort {
  field: ContentItemSortField;
  direction: 'asc' | 'desc';
}

/**
 * 筛选内容项
 */
export function filterContentItems(
  items: ContentItem[],
  filter: ContentItemFilter
): ContentItem[] {
  return items.filter(item => {
    // 类型筛选
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(item.type)) return false;
    }
    
    // 状态筛选
    if (filter.states && filter.states.length > 0) {
      if (!filter.states.includes(item.state)) return false;
    }
    
    // 标签筛选
    if (filter.tags && filter.tags.length > 0) {
      if (!filter.tags.some(tag => item.tags.includes(tag))) return false;
    }
    
    // 牌组筛选
    if (filter.deckIds && filter.deckIds.length > 0) {
      if (!filter.deckIds.some(id => item.deckIds.includes(id))) return false;
    }
    
    // 收藏筛选
    if (filter.favoriteOnly && !item.favorite) return false;
    
    // 今日到期筛选
    if (filter.dueToday) {
      if (!item.nextReview) return false;
      const today = new Date().toISOString().split('T')[0];
      const dueDate = item.nextReview.split('T')[0];
      if (dueDate > today) return false;
    }
    
    // 来源文件筛选
    if (filter.sourceFile && item.sourceFile !== filter.sourceFile) return false;
    
    // 搜索关键词
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchContent = item.contentPreview.toLowerCase().includes(query);
      const matchTags = item.tags.some(t => t.toLowerCase().includes(query));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }
    
    return true;
  });
}

/**
 * 排序内容项
 */
export function sortContentItems(
  items: ContentItem[],
  sort: ContentItemSort
): ContentItem[] {
  const sorted = [...items];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sort.field) {
      case 'createdAt':
        // 防御性检查：确保字段存在
        const aCreated = a.createdAt || '';
        const bCreated = b.createdAt || '';
        comparison = aCreated.localeCompare(bCreated);
        break;
      case 'updatedAt':
        const aUpdated = a.updatedAt || '';
        const bUpdated = b.updatedAt || '';
        comparison = aUpdated.localeCompare(bUpdated);
        break;
      case 'nextReview':
        const aReview = a.nextReview || '9999-12-31';
        const bReview = b.nextReview || '9999-12-31';
        comparison = aReview.localeCompare(bReview);
        break;
      case 'priority':
        comparison = (a.priority || 2) - (b.priority || 2);
        break;
      case 'reviewCount':
        comparison = (a.reviewCount || 0) - (b.reviewCount || 0);
        break;
      case 'title':
        const aTitle = a.title || '';
        const bTitle = b.title || '';
        comparison = aTitle.localeCompare(bTitle);
        break;
    }
    
    return sort.direction === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

// ============================================
// 统计
// ============================================

/** 内容项统计 */
export interface ContentItemStats {
  total: number;
  byType: Record<ContentItemType, number>;
  byState: Record<ContentItemState, number>;
  dueToday: number;
  favorites: number;
}

/**
 * 计算内容项统计
 */
export function calculateContentItemStats(items: ContentItem[]): ContentItemStats {
  const today = new Date().toISOString().split('T')[0];
  
  const stats: ContentItemStats = {
    total: items.length,
    byType: { 'card': 0, 'ir-block': 0 },
    byState: { 'new': 0, 'learning': 0, 'review': 0, 'suspended': 0 },
    dueToday: 0,
    favorites: 0
  };
  
  for (const item of items) {
    stats.byType[item.type]++;
    stats.byState[item.state]++;
    
    if (item.favorite) stats.favorites++;
    
    if (item.state === 'new') {
      stats.dueToday++;
    } else if (item.nextReview) {
      const dueDate = item.nextReview.split('T')[0];
      if (dueDate <= today) stats.dueToday++;
    }
  }
  
  return stats;
}
