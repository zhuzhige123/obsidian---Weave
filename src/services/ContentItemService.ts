/**
 * 统一内容项服务
 * 
 * 提供对Card和IRBlock的统一访问接口：
 * - 获取所有内容项
 * - 筛选和排序
 * - 批量操作
 * 
 * @module services/ContentItemService
 * @version 1.0.0
 */

import { App } from 'obsidian';
import type { Card } from '../data/types';
import type { IRBlock } from '../types/ir-types';
import type { 
  ContentItem, 
  ContentItemFilter, 
  ContentItemSort,
  ContentItemStats 
} from '../types/content-item-types';
import { 
  cardToContentItem, 
  irBlockToContentItem,
  filterContentItems,
  sortContentItems,
  calculateContentItemStats
} from '../types/content-item-types';
import { IRStorageService } from './incremental-reading/IRStorageService';
import { logger } from '../utils/logger';

/**
 * 内容项服务配置
 */
export interface ContentItemServiceConfig {
  /** 是否包含卡片 */
  includeCards: boolean;
  /** 是否包含IR内容块 */
  includeIRBlocks: boolean;
}

const DEFAULT_CONFIG: ContentItemServiceConfig = {
  includeCards: true,
  includeIRBlocks: true
};

/**
 * 统一内容项服务
 */
export class ContentItemService {
  private app: App;
  private irStorage: IRStorageService;
  private config: ContentItemServiceConfig;
  private initialized = false;

  constructor(
    app: App, 
    config?: Partial<ContentItemServiceConfig>
  ) {
    this.app = app;
    this.irStorage = new IRStorageService(app);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.irStorage.initialize();
    this.initialized = true;
    
    logger.debug('[ContentItemService] 服务已初始化');
  }

  /**
   * 获取所有内容项
   */
  async getAllItems(): Promise<ContentItem[]> {
    await this.initialize();
    
    const items: ContentItem[] = [];
    
    // 获取IR内容块
    if (this.config.includeIRBlocks) {
      const blocks = await this.getIRBlockItems();
      items.push(...blocks);
    }
    
    // 获取卡片 (TODO: 集成卡片存储服务)
    if (this.config.includeCards) {
      const cards = await this.getCardItems();
      items.push(...cards);
    }
    
    logger.debug(`[ContentItemService] 获取 ${items.length} 个内容项`);
    return items;
  }

  /**
   * 获取IR内容块作为ContentItem
   */
  private async getIRBlockItems(): Promise<ContentItem[]> {
    const blocksRecord = await this.irStorage.getAllBlocks();
    const decksRecord = await this.irStorage.getAllDecks();
    
    const items: ContentItem[] = [];
    
    for (const block of Object.values(blocksRecord)) {
      // 查找块所属的牌组
      const deckIds: string[] = [];
      for (const deck of Object.values(decksRecord)) {
        if (deck.blockIds && deck.blockIds.includes(block.id)) {
          deckIds.push(deck.id);
        }
        // v1.0兼容：通过path匹配
        if (deck.path && block.filePath.startsWith(deck.path)) {
          if (!deckIds.includes(deck.id)) {
            deckIds.push(deck.id);
          }
        }
      }
      
      items.push(irBlockToContentItem(block, deckIds));
    }
    
    return items;
  }

  /**
   * 获取卡片作为ContentItem
   * TODO: 集成实际的卡片存储服务
   */
  private async getCardItems(): Promise<ContentItem[]> {
    // 暂时返回空数组，待集成卡片存储服务
    // const cards = await this.cardStorage.getAllCards();
    // return cards.map(cardToContentItem);
    return [];
  }

  /**
   * 获取筛选后的内容项
   */
  async getFilteredItems(
    filter: ContentItemFilter,
    sort?: ContentItemSort
  ): Promise<ContentItem[]> {
    let items = await this.getAllItems();
    
    // 应用筛选
    items = filterContentItems(items, filter);
    
    // 应用排序
    if (sort) {
      items = sortContentItems(items, sort);
    }
    
    return items;
  }

  /**
   * 获取今日到期的内容项
   */
  async getDueTodayItems(): Promise<ContentItem[]> {
    return this.getFilteredItems({ dueToday: true }, { field: 'priority', direction: 'asc' });
  }

  /**
   * 获取收藏的内容项
   */
  async getFavoriteItems(): Promise<ContentItem[]> {
    return this.getFilteredItems({ favoriteOnly: true }, { field: 'updatedAt', direction: 'desc' });
  }

  /**
   * 获取指定文件的内容项
   */
  async getItemsByFile(filePath: string): Promise<ContentItem[]> {
    return this.getFilteredItems({ sourceFile: filePath }, { field: 'createdAt', direction: 'asc' });
  }

  /**
   * 获取指定牌组的内容项
   */
  async getItemsByDeck(deckId: string): Promise<ContentItem[]> {
    return this.getFilteredItems({ deckIds: [deckId] }, { field: 'priority', direction: 'asc' });
  }

  /**
   * 搜索内容项
   */
  async searchItems(query: string): Promise<ContentItem[]> {
    return this.getFilteredItems({ searchQuery: query }, { field: 'updatedAt', direction: 'desc' });
  }

  /**
   * 获取内容项统计
   */
  async getStats(filter?: ContentItemFilter): Promise<ContentItemStats> {
    let items = await this.getAllItems();
    
    if (filter) {
      items = filterContentItems(items, filter);
    }
    
    return calculateContentItemStats(items);
  }

  /**
   * 根据UUID获取内容项
   */
  async getItemByUuid(uuid: string): Promise<ContentItem | null> {
    await this.initialize();
    
    // 尝试从IR存储获取
    const blocks = await this.irStorage.getAllBlocks();
    if (blocks[uuid]) {
      const decks = await this.irStorage.getAllDecks();
      const deckIds = Object.values(decks)
        .filter(d => d.blockIds?.includes(uuid))
        .map(d => d.id);
      return irBlockToContentItem(blocks[uuid], deckIds);
    }
    
    // TODO: 尝试从卡片存储获取
    
    return null;
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(uuid: string): Promise<boolean> {
    await this.initialize();
    
    const blocks = await this.irStorage.getAllBlocks();
    if (blocks[uuid]) {
      const block = blocks[uuid];
      const newFavorite = !block.favorite;
      
      const updatedBlock: IRBlock = {
        ...block,
        favorite: newFavorite,
        updatedAt: new Date().toISOString()
      };
      
      await this.irStorage.saveBlock(updatedBlock);
      logger.debug(`[ContentItemService] 切换收藏: ${uuid} -> ${newFavorite}`);
      return newFavorite;
    }
    
    // TODO: 处理卡片收藏
    
    return false;
  }

  /**
   * 更新优先级
   */
  async updatePriority(uuid: string, priority: 1 | 2 | 3): Promise<void> {
    await this.initialize();
    
    const blocks = await this.irStorage.getAllBlocks();
    if (blocks[uuid]) {
      const block = blocks[uuid];
      
      const updatedBlock: IRBlock = {
        ...block,
        priority,
        updatedAt: new Date().toISOString()
      };
      
      await this.irStorage.saveBlock(updatedBlock);
      logger.debug(`[ContentItemService] 更新优先级: ${uuid} -> ${priority}`);
      return;
    }
    
    // TODO: 处理卡片优先级
  }

  /**
   * 切换暂停状态
   */
  async toggleSuspend(uuid: string): Promise<boolean> {
    await this.initialize();
    
    const blocks = await this.irStorage.getAllBlocks();
    if (blocks[uuid]) {
      const block = blocks[uuid];
      const newState = block.state === 'suspended' 
        ? (block.reviewCount > 0 ? 'review' : 'new')
        : 'suspended';
      
      const updatedBlock: IRBlock = {
        ...block,
        state: newState as any,
        updatedAt: new Date().toISOString()
      };
      
      await this.irStorage.saveBlock(updatedBlock);
      logger.debug(`[ContentItemService] 切换暂停: ${uuid} -> ${newState}`);
      return newState === 'suspended';
    }
    
    // TODO: 处理卡片暂停
    
    return false;
  }

  /**
   * 批量添加标签
   */
  async addTags(uuids: string[], tags: string[]): Promise<number> {
    await this.initialize();
    
    let updated = 0;
    const blocks = await this.irStorage.getAllBlocks();
    
    for (const uuid of uuids) {
      if (blocks[uuid]) {
        const block = blocks[uuid];
        const existingTags = new Set(block.tags || []);
        tags.forEach(t => existingTags.add(t));
        
        const updatedBlock: IRBlock = {
          ...block,
          tags: Array.from(existingTags),
          updatedAt: new Date().toISOString()
        };
        
        await this.irStorage.saveBlock(updatedBlock);
        updated++;
      }
    }
    
    logger.debug(`[ContentItemService] 批量添加标签: ${updated} 项`);
    return updated;
  }

  /**
   * 批量移除标签
   */
  async removeTags(uuids: string[], tags: string[]): Promise<number> {
    await this.initialize();
    
    let updated = 0;
    const blocks = await this.irStorage.getAllBlocks();
    const tagsToRemove = new Set(tags);
    
    for (const uuid of uuids) {
      if (blocks[uuid]) {
        const block = blocks[uuid];
        const newTags = (block.tags || []).filter(t => !tagsToRemove.has(t));
        
        const updatedBlock: IRBlock = {
          ...block,
          tags: newTags,
          updatedAt: new Date().toISOString()
        };
        
        await this.irStorage.saveBlock(updatedBlock);
        updated++;
      }
    }
    
    logger.debug(`[ContentItemService] 批量移除标签: ${updated} 项`);
    return updated;
  }
}
