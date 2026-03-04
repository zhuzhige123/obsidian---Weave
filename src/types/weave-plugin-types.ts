/**
 * Weave 插件系统类型定义
 * 定义第三方插件的清单、接口、API 表面和注册表
 */

import type { Card, Deck, ReviewLog } from '../data/types';

// ===== 插件清单 =====

export interface WeavePluginManifest {
  id: string;
  name: string;
  version: string;
  minWeaveVersion?: string;
  author?: string;
  description?: string;
}

// ===== 插件实例接口 =====

export interface WeavePluginInstance {
  onload(api: WeaveAPI): void | Promise<void>;
  onunload?(): void | Promise<void>;
}

// ===== 插件状态 =====

export type PluginState = 'enabled' | 'disabled' | 'error' | 'loading';

export interface PluginRegistryEntry {
  manifest: WeavePluginManifest;
  state: PluginState;
  instance?: WeavePluginInstance;
  error?: string;
  loadedAt?: string;
}

// ===== 插件持久化状态 =====

export interface PluginStateRecord {
  id: string;
  enabled: boolean;
}

export interface PluginRegistryData {
  version: 1;
  plugins: PluginStateRecord[];
}

// ===== 事件类型 =====

export interface WeavePluginEvents {
  'card:created': { card: Card; triggeredByPlugin?: string };
  'card:updated': { card: Card; prev?: Card; triggeredByPlugin?: string };
  'card:deleted': { uuid: string; triggeredByPlugin?: string };
  'deck:changed': { deck: Deck; triggeredByPlugin?: string };
  'plugin:ready': undefined;
}

export type WeavePluginEventName = keyof WeavePluginEvents;

// ===== 卡片查询过滤 =====

export interface CardQueryFilter {
  tags?: string[];
  type?: string;
  deckId?: string;
}

// ===== 新建卡片数据 =====

export interface NewCardData {
  deckId: string;
  content: string;
  type?: string;
  tags?: string[];
}

// ===== WeaveAPI 接口 =====

export interface WeaveCardsAPI {
  getByUuid(uuid: string): Promise<Card | null>;
  getAll(): Promise<Card[]>;
  getByDeck(deckId: string): Promise<Card[]>;
  query(filter: CardQueryFilter): Promise<Card[]>;
  create(data: NewCardData): Promise<Card>;
  updateContent(uuid: string, content: string): Promise<void>;
  delete(uuid: string): Promise<boolean>;
  getTags(uuid: string): Promise<string[]>;
  addTag(uuid: string, tag: string): Promise<void>;
  removeTag(uuid: string, tag: string): Promise<void>;
}

export interface NewDeckData {
  name: string;
  description?: string;
  parentId?: string;
}

export interface WeaveDecksAPI {
  getById(id: string): Promise<Deck | null>;
  getAll(): Promise<Deck[]>;
  create(data: NewDeckData): Promise<Deck>;
  delete(deckId: string): Promise<boolean>;
  includeCard(deckId: string, cardUuid: string): Promise<void>;
  excludeCard(deckId: string, cardUuid: string): Promise<void>;
  getCardUuids(deckId: string): Promise<string[]>;
}

export interface WeaveReviewHistoryAPI {
  getByCard(uuid: string): Promise<ReviewLog[]>;
}

// ===== 插件菜单注册 =====

export interface WeaveMenuItemAction {
  id: string;
  label: string;
  icon?: string;
  callback: () => void | Promise<void>;
}

export interface WeaveMenuCategory {
  id: string;
  label: string;
  icon?: string;
  items: WeaveMenuItemAction[];
}

export interface WeaveMenuRegistration {
  pluginId: string;
  pluginName: string;
  categories: WeaveMenuCategory[];
}

export interface WeaveUIAPI {
  showNotice(message: string, durationMs?: number): void;
  registerMenuItems(categories: WeaveMenuCategory[]): void;
  unregisterMenuItems(): void;
}

export interface WeavePluginStorageAPI {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  getAll(): Promise<Record<string, any>>;
}

export interface WeaveAPI {
  cards: WeaveCardsAPI;
  decks: WeaveDecksAPI;
  reviewHistory: WeaveReviewHistoryAPI;
  ui: WeaveUIAPI;
  storage: WeavePluginStorageAPI;

  on<K extends WeavePluginEventName>(
    event: K,
    handler: (data: WeavePluginEvents[K]) => void | Promise<void>
  ): () => void;

  pluginId: string;
  weaveVersion: string;
}

// ===== 菜单注册表（全局单例） =====

export interface WeaveMenuRegistry {
  register(registration: WeaveMenuRegistration): void;
  unregister(pluginId: string): void;
  getAll(): WeaveMenuRegistration[];
  onChange(callback: () => void): () => void;
}
