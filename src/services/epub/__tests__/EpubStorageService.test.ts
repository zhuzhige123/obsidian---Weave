import { describe, expect, it, vi } from 'vitest';
import { EpubStorageService } from '../EpubStorageService';
import type { EpubBook } from '../types';

function createMemoryApp(initialFiles: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initialFiles));
  const writes: string[] = [];

  const ensureParentDirs = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
    }
  };

  const list = (dir: string) => {
    const normalizedDir = dir.replace(/\\/g, '/').replace(/\/+$/, '');
    const prefix = normalizedDir ? `${normalizedDir}/` : '';
    const folders = new Set<string>();
    const directFiles: string[] = [];

    for (const path of files.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (!rest) continue;
      if (!rest.includes('/')) {
        directFiles.push(path);
        continue;
      }
      const folder = rest.split('/')[0];
      folders.add(prefix ? `${prefix}${folder}` : folder);
    }

    return { files: directFiles, folders: Array.from(folders) };
  };

  const adapter = {
    exists: vi.fn(async (path: string) => files.has(path)),
    read: vi.fn(async (path: string) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`Missing file: ${path}`);
      return value;
    }),
    write: vi.fn(async (path: string, content: string) => {
      ensureParentDirs(path);
      files.set(path, content);
      writes.push(path);
    }),
    mkdir: vi.fn(async () => {}),
    list: vi.fn(async (dir: string) => list(dir)),
    rmdir: vi.fn(async (dir: string) => {
      const prefix = `${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(prefix)) files.delete(key);
      }
    }),
  };

  const app: any = {
    vault: {
      adapter,
      configDir: '.obsidian',
    },
    plugins: {
      getPlugin: vi.fn(() => ({
        settings: { weaveParentFolder: '' },
      })),
    },
  };

  return { app, files, writes };
}

function createBook(overrides: Partial<EpubBook> = {}): EpubBook {
  return {
    id: 'book-1',
    filePath: 'Books/demo.epub',
    metadata: {
      title: 'Demo',
      author: 'Author',
      chapterCount: 3,
      coverImage: 'data:image/jpeg;base64,AAAA',
    },
    currentPosition: {
      chapterIndex: 0,
      cfi: '/6/2',
      percent: 10,
    },
    readingStats: {
      totalReadTime: 0,
      lastReadTime: 100,
      createdTime: 50,
    },
    ...overrides,
  };
}

describe('EpubStorageService', () => {
  it('stores reading progress in per-book state without rewriting books.json', async () => {
    const booksPath = 'weave/epub-reading/books.json';
    const { app, files, writes } = createMemoryApp({
      [booksPath]: JSON.stringify({
        'book-1': createBook(),
      }),
    });

    const service = new EpubStorageService(app);

    await service.saveProgress('book-1', {
      chapterIndex: 2,
      cfi: '/6/8',
      percent: 66,
    });
    await service.flushPendingProgress();

    expect(writes).not.toContain(booksPath);
    expect(writes).toContain('weave/epub-reading/book-1/state.json');

    const persistedBooks = JSON.parse(files.get(booksPath) || '{}');
    expect(persistedBooks['book-1'].currentPosition.percent).toBe(10);

    const state = JSON.parse(files.get('weave/epub-reading/book-1/state.json') || '{}');
    expect(state.currentPosition.percent).toBe(66);
  });

  it('hydrates persisted per-book state on reload', async () => {
    const { app } = createMemoryApp({
      'weave/epub-reading/books.json': JSON.stringify({
        'book-1': createBook(),
      }),
      'weave/epub-reading/book-1/state.json': JSON.stringify({
        currentPosition: {
          chapterIndex: 1,
          cfi: '/6/6',
          percent: 42,
        },
        readingStats: {
          totalReadTime: 10,
          lastReadTime: 999,
          createdTime: 50,
        },
      }),
    });

    const service = new EpubStorageService(app);
    const book = await service.getBook('book-1');

    expect(book?.currentPosition.percent).toBe(42);
    expect(book?.readingStats.lastReadTime).toBe(999);
  });
});
