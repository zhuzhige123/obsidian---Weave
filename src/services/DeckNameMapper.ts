/**
 * 牌组名称/ID 映射服务
 * 
 * 提供牌组名称与ID之间的双向映射功能
 * 用于 YAML 属性栏卡片元数据方案中的 we_decks 字段处理
 * 
 * @module services/DeckNameMapper
 * @version 1.0.0
 * @see YAML属性栏卡片元数据方案.md
 */

import type { Deck } from '../data/types';
import type { WeavePlugin } from '../main';
import { logger } from '../utils/logger';

/**
 * 牌组名称映射服务
 * 
 * 职责：
 * 1. 维护牌组名称 ↔ ID 的双向映射
 * 2. 提供快速查询功能
 * 3. 在牌组变更时自动更新映射
 */
export class DeckNameMapper {
  private plugin: WeavePlugin;
  
  /** 名称 → ID 映射 */
  private nameToIdMap: Map<string, string> = new Map();
  
  /** ID → 名称 映射 */
  private idToNameMap: Map<string, string> = new Map();
  
  /** 是否已初始化 */
  private initialized = false;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 初始化映射服务
   * 从存储中加载所有牌组并建立映射
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const decks = await (this.plugin as any).dataStorage.getDecks();
      this.rebuildMaps(decks);
      this.initialized = true;
      logger.info(`[DeckNameMapper] ✅ 初始化完成，已映射 ${this.nameToIdMap.size} 个牌组`);
    } catch (error) {
      logger.error('[DeckNameMapper] ❌ 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 重建映射表
   * @param decks 牌组列表
   */
  rebuildMaps(decks: Deck[]): void {
    this.nameToIdMap.clear();
    this.idToNameMap.clear();

    for (const deck of decks) {
      this.nameToIdMap.set(deck.name, deck.id);
      this.idToNameMap.set(deck.id, deck.name);
    }

    logger.debug(`[DeckNameMapper] 重建映射表: ${decks.length} 个牌组`);
  }

  /**
   * 根据牌组名称获取ID
   * @param deckName 牌组名称
   * @returns 牌组ID，不存在则返回 undefined
   */
  getDeckIdByName(deckName: string): string | undefined {
    return this.nameToIdMap.get(deckName);
  }

  /**
   * 根据牌组ID获取名称
   * @param deckId 牌组ID
   * @returns 牌组名称，不存在则返回 undefined
   */
  getDeckNameById(deckId: string): string | undefined {
    return this.idToNameMap.get(deckId);
  }

  /**
   * 批量将牌组名称转换为ID
   * @param deckNames 牌组名称数组
   * @returns 牌组ID数组（过滤掉不存在的）
   */
  getDeckIdsByNames(deckNames: string[]): string[] {
    const ids: string[] = [];
    for (const name of deckNames) {
      const id = this.nameToIdMap.get(name);
      if (id) {
        ids.push(id);
      }
    }
    return ids;
  }

  /**
   * 批量将牌组ID转换为名称
   * @param deckIds 牌组ID数组
   * @returns 牌组名称数组（过滤掉不存在的）
   */
  getDeckNamesByIds(deckIds: string[]): string[] {
    const names: string[] = [];
    for (const id of deckIds) {
      const name = this.idToNameMap.get(id);
      if (name) {
        names.push(name);
      }
    }
    return names;
  }

  /**
   * 检查牌组名称是否存在
   * @param deckName 牌组名称
   * @returns 是否存在
   */
  hasDeckName(deckName: string): boolean {
    return this.nameToIdMap.has(deckName);
  }

  /**
   * 检查牌组ID是否存在
   * @param deckId 牌组ID
   * @returns 是否存在
   */
  hasDeckId(deckId: string): boolean {
    return this.idToNameMap.has(deckId);
  }

  /**
   * 获取所有有效的牌组名称集合
   * @returns 牌组名称 Set
   */
  getAllDeckNames(): Set<string> {
    return new Set(this.nameToIdMap.keys());
  }

  /**
   * 获取所有有效的牌组ID集合
   * @returns 牌组ID Set
   */
  getAllDeckIds(): Set<string> {
    return new Set(this.idToNameMap.keys());
  }

  /**
   * 验证牌组名称列表
   * @param deckNames 牌组名称数组
   * @returns 验证结果
   */
  validateDeckNames(deckNames: string[]): {
    valid: boolean;
    validNames: string[];
    invalidNames: string[];
  } {
    const validNames: string[] = [];
    const invalidNames: string[] = [];

    for (const name of deckNames) {
      if (this.nameToIdMap.has(name)) {
        validNames.push(name);
      } else {
        invalidNames.push(name);
      }
    }

    return {
      valid: invalidNames.length === 0,
      validNames,
      invalidNames
    };
  }

  // ===== 牌组变更事件处理 =====

  /**
   * 牌组创建时更新映射
   * @param deck 新创建的牌组
   */
  onDeckCreated(deck: Deck): void {
    this.nameToIdMap.set(deck.name, deck.id);
    this.idToNameMap.set(deck.id, deck.name);
    logger.debug(`[DeckNameMapper] 添加牌组映射: ${deck.name} -> ${deck.id}`);
  }

  /**
   * 牌组删除时更新映射
   * @param deckId 被删除的牌组ID
   */
  onDeckDeleted(deckId: string): void {
    const name = this.idToNameMap.get(deckId);
    if (name) {
      this.nameToIdMap.delete(name);
      this.idToNameMap.delete(deckId);
      logger.debug(`[DeckNameMapper] 删除牌组映射: ${name} -> ${deckId}`);
    }
  }

  /**
   * 牌组重命名时更新映射
   * @param deckId 牌组ID
   * @param oldName 旧名称
   * @param newName 新名称
   */
  onDeckRenamed(deckId: string, oldName: string, newName: string): void {
    // 删除旧名称映射
    this.nameToIdMap.delete(oldName);
    
    // 添加新名称映射
    this.nameToIdMap.set(newName, deckId);
    this.idToNameMap.set(deckId, newName);
    
    logger.debug(`[DeckNameMapper] 重命名牌组映射: ${oldName} -> ${newName} (${deckId})`);
  }

  /**
   * 刷新映射表
   * 从存储重新加载所有牌组
   */
  async refresh(): Promise<void> {
    try {
      const decks = await (this.plugin as any).dataStorage.getDecks();
      this.rebuildMaps(decks);
      logger.debug('[DeckNameMapper] 映射表已刷新');
    } catch (error) {
      logger.error('[DeckNameMapper] 刷新映射表失败:', error);
    }
  }

  /**
   * 清除映射表
   */
  clear(): void {
    this.nameToIdMap.clear();
    this.idToNameMap.clear();
    this.initialized = false;
    logger.debug('[DeckNameMapper] 映射表已清除');
  }
}

// ===== 单例管理 =====

let deckNameMapperInstance: DeckNameMapper | null = null;

/**
 * 获取 DeckNameMapper 单例
 * @param plugin WeavePlugin 实例（首次调用时必需）
 * @returns DeckNameMapper 实例
 */
export function getDeckNameMapper(plugin?: WeavePlugin): DeckNameMapper {
  if (!deckNameMapperInstance && plugin) {
    deckNameMapperInstance = new DeckNameMapper(plugin);
  }
  if (!deckNameMapperInstance) {
    throw new Error('DeckNameMapper not initialized. Call with plugin first.');
  }
  return deckNameMapperInstance;
}

/**
 * 初始化 DeckNameMapper 单例
 * @param plugin WeavePlugin 实例
 * @returns DeckNameMapper 实例
 */
export async function initDeckNameMapper(plugin: WeavePlugin): Promise<DeckNameMapper> {
  deckNameMapperInstance = new DeckNameMapper(plugin);
  await deckNameMapperInstance.initialize();
  return deckNameMapperInstance;
}

/**
 * 销毁 DeckNameMapper 单例
 */
export function destroyDeckNameMapper(): void {
  if (deckNameMapperInstance) {
    deckNameMapperInstance.clear();
    deckNameMapperInstance = null;
  }
}

// ===== 便捷函数 =====

/**
 * 根据牌组名称获取ID（便捷函数）
 * @param deckName 牌组名称
 * @returns 牌组ID，不存在则返回 undefined
 */
let _loggedNotInitialized = false;
export function getDeckIdByName(deckName: string): string | undefined {
  if (!deckNameMapperInstance) {
    if (!_loggedNotInitialized) {
      _loggedNotInitialized = true;
      logger.debug('[DeckNameMapper] 服务未初始化，无法获取牌组ID（后续相同警告已静默）');
    }
    return undefined;
  }
  _loggedNotInitialized = false;
  return deckNameMapperInstance.getDeckIdByName(deckName);
}

/**
 * 根据牌组ID获取名称（便捷函数）
 * @param deckId 牌组ID
 * @returns 牌组名称，不存在则返回 undefined
 */
export function getDeckNameById(deckId: string): string | undefined {
  if (!deckNameMapperInstance) {
    return undefined;
  }
  return deckNameMapperInstance.getDeckNameById(deckId);
}
