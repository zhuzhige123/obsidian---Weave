import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => {
  class TFile {
    path: string;

    constructor(path = '') {
      this.path = path;
    }
  }

  return {
    TFile,
    Notice: class Notice {}
  };
});

import { TFile } from 'obsidian';
import { CardState, CardType, type Card, type FSRSCard, type ReviewLog } from '../types';
import type { ProgressiveClozeChildCard, ProgressiveClozeParentCard } from '../../types/progressive-cloze-v2';
import { WeaveDataStorage } from '../storage';

const processContentChangeMock = vi.fn();

vi.mock('../../services/progressive-cloze/ProgressiveClozeGateway', () => ({
  getProgressiveClozeGateway: () => ({
    processNewCard: vi.fn(async (card: Card) => ({ converted: false, cards: [card] })),
    processContentChange: processContentChangeMock
  })
}));

function createFsrs(overrides: Partial<FSRSCard> = {}): FSRSCard {
  return {
    due: '2026-03-15T00:00:00.000Z',
    stability: 3,
    difficulty: 5,
    elapsedDays: 2,
    scheduledDays: 5,
    reps: 1,
    lapses: 0,
    state: CardState.Review,
    retrievability: 0.9,
    ...overrides
  };
}

function createReviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    rating: 3,
    state: CardState.Review,
    due: '2026-03-20T00:00:00.000Z',
    stability: 3,
    difficulty: 5,
    elapsedDays: 2,
    lastElapsedDays: 1,
    scheduledDays: 5,
    review: '2026-03-15T00:00:00.000Z',
    ...overrides
  };
}

function createProgressiveParent(content?: string): ProgressiveClozeParentCard {
  return {
    uuid: 'parent-1',
    deckId: 'deck-1',
    type: CardType.ProgressiveParent,
    content: content ?? '---\nwe_type: progressive-parent\n---\n{{c1::Alpha}} {{c2::Beta}}',
    stats: {
      totalReviews: 0,
      totalTime: 0,
      averageTime: 0
    },
    tags: [],
    created: '2026-03-15T00:00:00.000Z',
    modified: '2026-03-15T00:00:00.000Z',
    progressiveCloze: {
      childCardIds: ['child-1', 'child-2'],
      totalClozes: 2,
      createdAt: '2026-03-15T00:00:00.000Z'
    }
  };
}

function createProgressiveChild(uuid: string, clozeOrd: number): ProgressiveClozeChildCard {
  return {
    uuid,
    deckId: 'deck-1',
    type: CardType.ProgressiveChild,
    parentCardId: 'parent-1',
    clozeOrd,
    content: '---\nwe_type: progressive-child\n---\n{{c1::Alpha2}} {{c2::Beta2}}',
    fsrs: createFsrs({ reps: clozeOrd + 1 }),
    reviewHistory: [createReviewLog({ scheduledDays: 5 + clozeOrd })],
    clozeSnapshot: clozeOrd === 0
      ? { text: 'Alpha2', hint: undefined }
      : { text: 'Beta2', hint: undefined },
    stats: {
      totalReviews: 1,
      totalTime: 10,
      averageTime: 10
    },
    tags: [],
    created: '2026-03-15T00:00:00.000Z',
    modified: '2026-03-15T00:00:00.000Z'
  };
}

describe('WeaveDataStorage delete source resolution', () => {
  it('backfills single-card batch cleanup metadata from source markdown frontmatter', async () => {
    const sourceFile = new TFile();
    sourceFile.path = 'notes/source.md';
    const content = [
      '---',
      'weave-uuid: tk-abc123def456',
      'tags:',
      '  - 生物',
      '---',
      '',
      '什么是突触可塑性？',
      '---div---',
      '突触连接强度可随活动发生变化。'
    ].join('\n');

    const plugin = {
      settings: {},
      app: {
        vault: {
          getMarkdownFiles: () => [sourceFile],
          getAbstractFileByPath: (path: string) => (path === sourceFile.path ? sourceFile : null),
          cachedRead: vi.fn(async () => content)
        }
      }
    } as any;

    const storage = new WeaveDataStorage(plugin);
    const resolved = await (storage as any).resolveMissingDeletionSource({
      uuid: 'tk-abc123def456',
      content: '',
      tags: []
    });

    expect(resolved?.sourceFile).toBe('notes/source.md');
    expect(resolved?.isBatchScanned).toBe(true);
    expect(resolved?.metadata?.creationType).toBe('batch-parse-single');
  });

  it('finds card from unified card storage before deletion so cleanup metadata can still be resolved', async () => {
    const sourceFile = new TFile();
    sourceFile.path = 'notes/source.md';
    const sourceContent = [
      '---',
      'weave-uuid: tk-abc123def456',
      'tags:',
      '  - 生物',
      '---',
      '',
      '什么是突触可塑性？',
      '---div---',
      '突触连接强度可随活动发生变化。'
    ].join('\n');

    const plugin = {
      settings: {},
      cardFileService: {
        getAllCards: vi.fn(async () => [
          {
            uuid: 'tk-abc123def456',
            content: '',
            tags: []
          }
        ])
      },
      app: {
        vault: {
          getMarkdownFiles: () => [sourceFile],
          getAbstractFileByPath: (path: string) => (path === sourceFile.path ? sourceFile : null),
          cachedRead: vi.fn(async () => sourceContent)
        }
      }
    } as any;

    const storage = new WeaveDataStorage(plugin);
    const card = await storage.getCardByUUID('tk-abc123def456');
    const resolved = await (storage as any).resolveMissingDeletionSource(card);

    expect(plugin.cardFileService.getAllCards).toHaveBeenCalled();
    expect(card?.uuid).toBe('tk-abc123def456');
    expect(resolved?.sourceFile).toBe('notes/source.md');
    expect(resolved?.isBatchScanned).toBe(true);
    expect(resolved?.metadata?.creationType).toBe('batch-parse-single');
  });

  it('deletes progressive child cards before deleting the progressive parent in unified storage', async () => {
    const deletedOrder: string[] = [];
    const plugin = {
      settings: {},
      cardFileService: {
        getAllCards: vi.fn(async () => [
          {
            uuid: 'parent-1',
            deckId: 'deck-1',
            type: 'progressive-parent',
            content: '---\nwe_type: progressive-parent\n---\n{{c1::Alpha}} {{c2::Beta}}',
            stats: { totalReviews: 0, totalTime: 0, averageTime: 0 },
            created: '2026-03-15T00:00:00.000Z',
            modified: '2026-03-15T00:00:00.000Z',
            tags: []
          },
          {
            uuid: 'child-1',
            deckId: 'deck-1',
            type: 'progressive-child',
            parentCardId: 'parent-1',
            clozeOrd: 0,
            content: '{{c1::Alpha}} {{c2::Beta}}',
            stats: { totalReviews: 1, totalTime: 10, averageTime: 10 },
            created: '2026-03-15T00:00:00.000Z',
            modified: '2026-03-15T00:00:00.000Z',
            tags: [],
            fsrs: {
              due: '2026-03-15T00:00:00.000Z',
              stability: 1,
              difficulty: 5,
              elapsedDays: 0,
              scheduledDays: 0,
              reps: 0,
              lapses: 0,
              state: 0,
              retrievability: 1
            },
            reviewHistory: []
          },
          {
            uuid: 'child-2',
            deckId: 'deck-1',
            type: 'progressive-child',
            parentCardId: 'parent-1',
            clozeOrd: 1,
            content: '{{c1::Alpha}} {{c2::Beta}}',
            stats: { totalReviews: 1, totalTime: 10, averageTime: 10 },
            created: '2026-03-15T00:00:00.000Z',
            modified: '2026-03-15T00:00:00.000Z',
            tags: [],
            fsrs: {
              due: '2026-03-15T00:00:00.000Z',
              stability: 1,
              difficulty: 5,
              elapsedDays: 0,
              scheduledDays: 0,
              reps: 0,
              lapses: 0,
              state: 0,
              retrievability: 1
            },
            reviewHistory: []
          }
        ]),
        deleteCard: vi.fn(async (uuid: string) => {
          deletedOrder.push(uuid);
          return true;
        })
      },
      cardMetadataCache: {
        invalidate: vi.fn()
      },
      app: {
        workspace: {
          trigger: vi.fn()
        },
        vault: {
          getMarkdownFiles: () => [],
          getAbstractFileByPath: () => null,
          cachedRead: vi.fn()
        }
      }
    } as any;

    const storage = new WeaveDataStorage(plugin);
    vi.spyOn(storage as any, 'ensureCleanupService').mockReturnValue({
      cleanupAfterCardDeletion: vi.fn(async () => ({ success: true, cleanedItems: [] }))
    });

    const result = await storage.deleteCard('parent-1');

    expect(result.success).toBe(true);
    expect(plugin.cardFileService.deleteCard).toHaveBeenCalledTimes(3);
    expect(deletedOrder).toEqual(['child-1', 'child-2', 'parent-1']);
  });

  it('routes progressive parent edits through gateway and saves returned parent plus children', async () => {
    processContentChangeMock.mockReset();

    const existingParent = createProgressiveParent();
    const updatedParent: ProgressiveClozeParentCard = {
      ...existingParent,
      content: '---\nwe_type: progressive-parent\n---\n{{c1::Alpha2}} {{c2::Beta2}}',
      modified: '2026-03-16T00:00:00.000Z',
      progressiveCloze: {
        childCardIds: ['child-1', 'child-2'],
        totalClozes: 2,
        createdAt: '2026-03-15T00:00:00.000Z'
      }
    };
    const updatedChild1 = createProgressiveChild('child-1', 0);
    const updatedChild2 = createProgressiveChild('child-2', 1);

    processContentChangeMock.mockResolvedValue([updatedParent, updatedChild1, updatedChild2]);

    const plugin = {
      settings: {},
      cardFileService: {
        getAllCards: vi.fn(async () => [existingParent]),
        saveCard: vi.fn(async (_card: Card) => true)
      },
      cardMetadataCache: {
        invalidate: vi.fn()
      },
      app: {
        workspace: {
          trigger: vi.fn()
        },
        vault: {
          configDir: '.obsidian',
          adapter: {
            exists: vi.fn(async () => false),
            read: vi.fn(async () => JSON.stringify({ decks: [] })),
            write: vi.fn(async () => {})
          },
          getMarkdownFiles: () => [],
          getAbstractFileByPath: () => null,
          cachedRead: vi.fn()
        }
      }
    } as any;

    const storage = new WeaveDataStorage(plugin);
    vi.spyOn(storage, 'getDeckCards').mockResolvedValue([updatedChild1, updatedChild2]);

    const result = await storage.saveCard({
      ...existingParent,
      content: '---\nwe_type: progressive-parent\n---\n{{c1::Alpha2}} {{c2::Beta2}}'
    });

    expect(result.success).toBe(true);
    expect(processContentChangeMock).toHaveBeenCalledTimes(1);
    expect(processContentChangeMock.mock.calls[0][0]).toMatchObject({
      uuid: existingParent.uuid,
      type: CardType.ProgressiveParent
    });
    expect(processContentChangeMock.mock.calls[0][1]).toContain('{{c1::Alpha2}}');

    expect(plugin.cardFileService.saveCard).toHaveBeenCalledTimes(3);
    expect(plugin.cardFileService.saveCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ uuid: 'child-1', type: CardType.ProgressiveChild })
    );
    expect(plugin.cardFileService.saveCard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ uuid: 'child-2', type: CardType.ProgressiveChild })
    );
    expect(plugin.cardFileService.saveCard).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ uuid: 'parent-1', type: CardType.ProgressiveParent })
    );
  });

  it('returns SAVE_CANCELLED when gateway cancels progressive parent save', async () => {
    processContentChangeMock.mockReset();
    processContentChangeMock.mockResolvedValue(null);

    const existingParent = createProgressiveParent();
    const plugin = {
      settings: {},
      cardFileService: {
        getAllCards: vi.fn(async () => [existingParent]),
        saveCard: vi.fn(async (_card: Card) => true)
      },
      cardMetadataCache: {
        invalidate: vi.fn()
      },
      app: {
        workspace: {
          trigger: vi.fn()
        },
        vault: {
          configDir: '.obsidian',
          adapter: {
            exists: vi.fn(async () => false),
            read: vi.fn(async () => JSON.stringify({ decks: [] })),
            write: vi.fn(async () => {})
          },
          getMarkdownFiles: () => [],
          getAbstractFileByPath: () => null,
          cachedRead: vi.fn()
        }
      }
    } as any;

    const storage = new WeaveDataStorage(plugin);
    vi.spyOn(storage, 'getDeckCards').mockResolvedValue([]);

    const result = await storage.saveCard({
      ...existingParent,
      content: 'plain basic content'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SAVE_CANCELLED');
    expect(plugin.cardFileService.saveCard).not.toHaveBeenCalled();
  });
});
