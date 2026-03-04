/**
 * WeaveAPI 实现
 * 包装 WeaveDataStorage，为第三方插件提供受控的 CRUD 接口
 */

import { Notice } from 'obsidian';
import { logger } from '../../utils/logger';
import { weaveEventBus } from '../../events/WeaveEventBus';
import type {
  WeaveAPI,
  WeaveCardsAPI,
  WeaveDecksAPI,
  WeaveReviewHistoryAPI,
  WeaveUIAPI,
  WeavePluginStorageAPI,
  WeavePluginEventName,
  WeavePluginEvents,
  CardQueryFilter,
  NewCardData,
  NewDeckData,
  WeaveMenuCategory
} from '../../types/weave-plugin-types';
import type { Card, Deck, CardType } from '../../data/types';
import { WeaveMenuRegistry } from './WeaveMenuRegistry';

interface PluginHost {
  app: any;
  dataStorage: any;
  settings?: any;
}

export class WeaveAPIImpl implements WeaveAPI {
  public readonly pluginId: string;
  public readonly weaveVersion: string;
  public readonly cards: WeaveCardsAPI;
  public readonly decks: WeaveDecksAPI;
  public readonly reviewHistory: WeaveReviewHistoryAPI;
  public readonly ui: WeaveUIAPI;
  public readonly storage: WeavePluginStorageAPI;

  private host: PluginHost;
  private pluginDir: string;
  private pluginName: string;

  constructor(pluginId: string, weaveVersion: string, host: PluginHost, pluginDir: string, pluginName?: string) {
    this.pluginId = pluginId;
    this.weaveVersion = weaveVersion;
    this.host = host;
    this.pluginDir = pluginDir;
    this.pluginName = pluginName || pluginId;

    this.cards = this.createCardsAPI();
    this.decks = this.createDecksAPI();
    this.reviewHistory = this.createReviewHistoryAPI();
    this.ui = this.createUIAPI();
    this.storage = this.createStorageAPI();
  }

  on<K extends WeavePluginEventName>(
    event: K,
    handler: (data: WeavePluginEvents[K]) => void | Promise<void>
  ): () => void {
    return weaveEventBus.on(event, handler, this.pluginId);
  }

  // ===== Cards API =====

  private createCardsAPI(): WeaveCardsAPI {
    const self = this;
    return {
      async getByUuid(uuid: string): Promise<Card | null> {
        const ds = self.getDataStorage();
        const cards = await ds.getCards();
        return cards.find((c: Card) => c.uuid === uuid) ?? null;
      },

      async getAll(): Promise<Card[]> {
        const ds = self.getDataStorage();
        return ds.getCards();
      },

      async getByDeck(deckId: string): Promise<Card[]> {
        const ds = self.getDataStorage();
        return ds.getCardsByDeck(deckId);
      },

      async query(filter: CardQueryFilter): Promise<Card[]> {
        const ds = self.getDataStorage();
        let cards: Card[] = filter.deckId
          ? await ds.getCardsByDeck(filter.deckId)
          : await ds.getCards();

        if (filter.tags && filter.tags.length > 0) {
          cards = cards.filter((c: Card) =>
            filter.tags!.some(t => c.tags?.includes(t))
          );
        }
        if (filter.type) {
          cards = cards.filter((c: Card) => c.type === filter.type);
        }
        return cards;
      },

      async create(data: NewCardData): Promise<Card> {
        const ds = self.getDataStorage();
        const now = new Date().toISOString();
        const uuid = self.generateUUID();

        const card: Card = {
          uuid,
          deckId: data.deckId,
          content: data.content,
          type: (data.type || 'basic') as CardType,
          tags: data.tags || [],
          created: now,
          modified: now,
          stats: {
            totalReviews: 0,
            totalTime: 0,
            averageTime: 0
          }
        };

        const result = await ds.saveCard(card);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create card');
        }

        // 将卡片引入牌组
        const deck = await ds.getDeck(data.deckId);
        if (deck) {
          if (!deck.cardUUIDs) deck.cardUUIDs = [];
          if (!deck.cardUUIDs.includes(uuid)) {
            deck.cardUUIDs.push(uuid);
            await ds.saveDeck(deck);
          }
        }

        weaveEventBus.emitSync('card:created', {
          card: result.data || card,
          triggeredByPlugin: self.pluginId
        });

        return result.data || card;
      },

      async updateContent(uuid: string, content: string): Promise<void> {
        const ds = self.getDataStorage();
        const cards = await ds.getCards();
        const card = cards.find((c: Card) => c.uuid === uuid);
        if (!card) throw new Error(`Card not found: ${uuid}`);

        const prev = { ...card };
        card.content = content;
        card.modified = new Date().toISOString();

        const result = await ds.saveCard(card);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update card');
        }

        weaveEventBus.emitSync('card:updated', {
          card: result.data || card,
          prev,
          triggeredByPlugin: self.pluginId
        });
      },

      async delete(uuid: string): Promise<boolean> {
        const ds = self.getDataStorage();
        const result = await ds.deleteCard(uuid);

        if (result.success && result.data) {
          weaveEventBus.emitSync('card:deleted', {
            uuid,
            triggeredByPlugin: self.pluginId
          });
        }
        return result.success && !!result.data;
      },

      async getTags(uuid: string): Promise<string[]> {
        const ds = self.getDataStorage();
        const cards = await ds.getCards();
        const card = cards.find((c: Card) => c.uuid === uuid);
        return card?.tags || [];
      },

      async addTag(uuid: string, tag: string): Promise<void> {
        const ds = self.getDataStorage();
        const cards = await ds.getCards();
        const card = cards.find((c: Card) => c.uuid === uuid);
        if (!card) throw new Error(`Card not found: ${uuid}`);

        if (!card.tags) card.tags = [];
        if (card.tags.includes(tag)) return;

        const prev = { ...card, tags: [...card.tags] };
        card.tags.push(tag);
        card.modified = new Date().toISOString();

        await ds.saveCard(card);

        weaveEventBus.emitSync('card:updated', {
          card,
          prev,
          triggeredByPlugin: self.pluginId
        });
      },

      async removeTag(uuid: string, tag: string): Promise<void> {
        const ds = self.getDataStorage();
        const cards = await ds.getCards();
        const card = cards.find((c: Card) => c.uuid === uuid);
        if (!card) throw new Error(`Card not found: ${uuid}`);

        if (!card.tags || !card.tags.includes(tag)) return;

        const prev = { ...card, tags: [...card.tags] };
        card.tags = card.tags.filter((t: string) => t !== tag);
        card.modified = new Date().toISOString();

        await ds.saveCard(card);

        weaveEventBus.emitSync('card:updated', {
          card,
          prev,
          triggeredByPlugin: self.pluginId
        });
      }
    };
  }

  // ===== Decks API =====

  private createDecksAPI(): WeaveDecksAPI {
    const self = this;
    return {
      async getById(id: string): Promise<Deck | null> {
        const ds = self.getDataStorage();
        return ds.getDeck(id);
      },

      async getAll(): Promise<Deck[]> {
        const ds = self.getDataStorage();
        return ds.getDecks();
      },

      async create(data: NewDeckData): Promise<Deck> {
        const ds = self.getDataStorage();
        const now = new Date().toISOString();
        const id = 'deck_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);

        const deck: Deck = {
          id,
          name: data.name,
          description: data.description || '',
          category: '',
          path: data.name,
          level: 0,
          order: 0,
          cardUUIDs: [],
          created: now,
          modified: now
        } as unknown as Deck;

        if (data.parentId) {
          (deck as any).parentId = data.parentId;
        }

        const result = await ds.saveDeck(deck);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create deck');
        }

        weaveEventBus.emitSync('deck:changed', {
          deck: result.data || deck,
          triggeredByPlugin: self.pluginId
        });

        return result.data || deck;
      },

      async delete(deckId: string): Promise<boolean> {
        const ds = self.getDataStorage();
        const result = await ds.deleteDeck(deckId);
        if (result.success) {
          weaveEventBus.emitSync('deck:changed', {
            deck: { id: deckId } as Deck,
            triggeredByPlugin: self.pluginId
          });
        }
        return result.success;
      },

      async includeCard(deckId: string, cardUuid: string): Promise<void> {
        const ds = self.getDataStorage();
        const deck = await ds.getDeck(deckId);
        if (!deck) throw new Error(`Deck not found: ${deckId}`);

        if (!deck.cardUUIDs) deck.cardUUIDs = [];
        if (deck.cardUUIDs.includes(cardUuid)) return;

        deck.cardUUIDs.push(cardUuid);
        deck.modified = new Date().toISOString();
        await ds.saveDeck(deck);

        weaveEventBus.emitSync('deck:changed', {
          deck,
          triggeredByPlugin: self.pluginId
        });
      },

      async excludeCard(deckId: string, cardUuid: string): Promise<void> {
        const ds = self.getDataStorage();
        const deck = await ds.getDeck(deckId);
        if (!deck) throw new Error(`Deck not found: ${deckId}`);

        if (!deck.cardUUIDs || !deck.cardUUIDs.includes(cardUuid)) return;

        deck.cardUUIDs = deck.cardUUIDs.filter((id: string) => id !== cardUuid);
        deck.modified = new Date().toISOString();
        await ds.saveDeck(deck);

        weaveEventBus.emitSync('deck:changed', {
          deck,
          triggeredByPlugin: self.pluginId
        });
      },

      async getCardUuids(deckId: string): Promise<string[]> {
        const ds = self.getDataStorage();
        const deck = await ds.getDeck(deckId);
        return deck?.cardUUIDs || [];
      }
    };
  }

  // ===== Review History API (read-only) =====

  private createReviewHistoryAPI(): WeaveReviewHistoryAPI {
    const self = this;
    return {
      async getByCard(uuid: string) {
        const ds = self.getDataStorage();
        const cards = await ds.getCards();
        const card = cards.find((c: Card) => c.uuid === uuid);
        return card?.reviewHistory || [];
      }
    };
  }

  // ===== UI API =====

  private createUIAPI(): WeaveUIAPI {
    const self = this;
    return {
      showNotice(message: string, durationMs?: number): void {
        new Notice(message, durationMs ?? 5000);
      },

      registerMenuItems(categories: WeaveMenuCategory[]): void {
        WeaveMenuRegistry.register({
          pluginId: self.pluginId,
          pluginName: self.pluginName,
          categories
        });
      },

      unregisterMenuItems(): void {
        WeaveMenuRegistry.unregister(self.pluginId);
      }
    };
  }

  // ===== Plugin Storage API =====

  private createStorageAPI(): WeavePluginStorageAPI {
    const self = this;
    const dataPath = `${self.pluginDir}/data.json`;

    async function readData(): Promise<Record<string, any>> {
      try {
        const adapter = self.host.app.vault.adapter;
        const exists = await adapter.exists(dataPath);
        if (!exists) return {};
        const raw = await adapter.read(dataPath);
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }

    async function writeData(data: Record<string, any>): Promise<void> {
      const adapter = self.host.app.vault.adapter;
      await adapter.write(dataPath, JSON.stringify(data, null, 2));
    }

    return {
      async get(key: string): Promise<any> {
        const data = await readData();
        return data[key];
      },

      async set(key: string, value: any): Promise<void> {
        const data = await readData();
        data[key] = value;
        await writeData(data);
      },

      async getAll(): Promise<Record<string, any>> {
        return readData();
      }
    };
  }

  // ===== Helpers =====

  private getDataStorage(): any {
    const ds = this.host.dataStorage;
    if (!ds) {
      throw new Error('[WeaveAPI] DataStorage not initialized');
    }
    return ds;
  }

  private generateUUID(): string {
    const now = Date.now();
    const random = Math.random().toString(36).substring(2, 12);
    return `card_${now}_${random}`;
  }
}
