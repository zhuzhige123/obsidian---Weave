import { describe, expect, it, vi } from 'vitest';
import { Platform, TFile } from 'obsidian';
import { EpubStorageService } from '../EpubStorageService';
import type { EpubBook } from '../types';

function createMemoryApp(initialFiles: Record<string, string> = {}, vaultFiles: string[] = []) {
  const files = new Map<string, string>(Object.entries(initialFiles));
  const writes: string[] = [];
  const normalizedVaultFiles = new Set(vaultFiles.map((path) => path.replace(/\\/g, '/')));

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
    const allPaths = new Set<string>([
      ...Array.from(files.keys()),
      ...Array.from(normalizedVaultFiles),
    ]);

    for (const path of allPaths) {
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

  const createVaultFile = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const extension = normalized.split('.').pop() || '';
    const basename = normalized.split('/').pop()?.replace(/\.[^.]+$/, '') || normalized;
    const folder = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
    return Object.assign(Object.create(TFile.prototype), {
      path: normalized,
      extension,
      basename,
      name: normalized.split('/').pop() || normalized,
      stat: { size: 1024 },
      parent: folder ? { path: folder } : null,
    });
  };

  const adapter = {
    exists: vi.fn(async (path: string) => {
      const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
      if (files.has(normalized) || normalizedVaultFiles.has(normalized)) return true;
      const prefix = normalized ? `${normalized}/` : '';
      for (const key of files.keys()) {
        if (key.startsWith(prefix)) {
          return true;
        }
      }
      for (const vaultFilePath of normalizedVaultFiles) {
        if (vaultFilePath.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    }),
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
      getAbstractFileByPath: vi.fn((path: string) => {
        const normalized = path.replace(/\\/g, '/');
        return normalizedVaultFiles.has(normalized) ? createVaultFile(normalized) : null;
      }),
      getFiles: vi.fn(() => Array.from(normalizedVaultFiles).map((path) => createVaultFile(path))),
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

async function withPlatformIsMobile<T>(value: boolean, run: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'isMobile');
  Object.defineProperty(Platform, 'isMobile', {
    configurable: true,
    value,
  });
  try {
    return await run();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(Platform, 'isMobile', originalDescriptor);
    } else {
      delete (Platform as { isMobile?: boolean }).isMobile;
    }
  }
}

describe('EpubStorageService', () => {
  it('returns the updated comfortable reading defaults when no reader settings were saved', async () => {
    const { app } = createMemoryApp();

    const service = new EpubStorageService(app);
    const settings = await service.loadReaderSettings();

    expect(settings.lineHeight).toBe(1.9);
    expect(settings.widthMode).toBe('full');
    expect(settings.layoutMode).toBe('paginated');
    expect(settings.flowMode).toBe('paginated');
  });

  it('returns scrolled reader defaults on mobile when no reader settings were saved', async () => {
    const { app } = createMemoryApp();

    await withPlatformIsMobile(true, async () => {
      const service = new EpubStorageService(app);
      const settings = await service.loadReaderSettings();

      expect(settings.lineHeight).toBe(1.9);
      expect(settings.widthMode).toBe('full');
      expect(settings.layoutMode).toBe('paginated');
      expect(settings.flowMode).toBe('scrolled');
    });
  });

  it('stores reader settings in a device-specific file on mobile', async () => {
    const { app, files } = createMemoryApp({
      'weave/incremental-reading/epub-reading/reader-settings.json': JSON.stringify({
        flowMode: 'paginated',
        layoutMode: 'paginated',
      }),
    });

    await withPlatformIsMobile(true, async () => {
      const service = new EpubStorageService(app);
      await service.saveReaderSettings({
        lineHeight: 1.9,
        theme: 'default',
        widthMode: 'full',
        layoutMode: 'paginated',
        flowMode: 'scrolled',
        showScrolledSideNav: true,
      });
    });

    expect(files.has('weave/incremental-reading/epub-reading/reader-settings.mobile.json')).toBe(true);
    expect(files.has('weave/incremental-reading/epub-reading/reader-settings.json')).toBe(true);
    expect(JSON.parse(files.get('weave/incremental-reading/epub-reading/reader-settings.mobile.json') || '{}').flowMode).toBe('scrolled');
    expect(JSON.parse(files.get('weave/incremental-reading/epub-reading/reader-settings.json') || '{}').flowMode).toBe('paginated');
  });

  it('migrates legacy epub-reading data into incremental-reading on first access', async () => {
    const { app, files } = createMemoryApp({
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
    expect(files.has('weave/incremental-reading/epub-reading/books.json')).toBe(true);
    expect(files.has('weave/incremental-reading/epub-reading/book-1/state.json')).toBe(true);
  });

  it('stores reading progress in per-book state without rewriting books.json', async () => {
    const booksPath = 'weave/incremental-reading/epub-reading/books.json';
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
    expect(writes).toContain('weave/incremental-reading/epub-reading/book-1/state.json');

    const persistedBooks = JSON.parse(files.get(booksPath) || '{}');
    expect(persistedBooks['book-1'].currentPosition.percent).toBe(10);

    const state = JSON.parse(files.get('weave/incremental-reading/epub-reading/book-1/state.json') || '{}');
    expect(state.currentPosition.percent).toBe(66);
  });

  it('hydrates persisted per-book state on reload', async () => {
    const { app } = createMemoryApp({
      'weave/incremental-reading/epub-reading/books.json': JSON.stringify({
        'book-1': createBook(),
      }),
      'weave/incremental-reading/epub-reading/book-1/state.json': JSON.stringify({
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

  it('refreshes folder bookshelf entries when cached folder data misses new epub files', async () => {
    const indexPath = 'weave/incremental-reading/epub-reading/bookshelf-index.json';
    const { app, files } = createMemoryApp({
      [indexPath]: JSON.stringify([
        {
          path: 'Books/old.epub',
          name: 'old',
          folder: 'Books',
          size: 1024,
        },
        {
          path: 'Other/outside.epub',
          name: 'outside',
          folder: 'Other',
          size: 1024,
        },
      ]),
    }, ['Books/old.epub', 'Books/new.epub', 'Other/outside.epub']);

    const service = new EpubStorageService(app);
    const entries = await service.loadBookshelfEntriesForFolder('Books');

    expect(entries.map((entry) => entry.path)).toEqual([
      'Books/new.epub',
      'Books/old.epub',
    ]);

    expect(JSON.parse(files.get(indexPath) || '[]')).toEqual([
      {
        path: 'Books/new.epub',
        name: 'new',
        folder: 'Books',
        size: 1024,
      },
      {
        path: 'Books/old.epub',
        name: 'old',
        folder: 'Books',
        size: 1024,
      },
      {
        path: 'Other/outside.epub',
        name: 'outside',
        folder: 'Other',
        size: 1024,
      },
    ]);
  });

  it('does not resurrect bookshelf entries from books cache when stored index is explicitly empty', async () => {
    const booksPath = 'weave/incremental-reading/epub-reading/books.json';
    const indexPath = 'weave/incremental-reading/epub-reading/bookshelf-index.json';
    const { app } = createMemoryApp({
      [booksPath]: JSON.stringify({
        'book-1': createBook(),
      }),
      [indexPath]: JSON.stringify([]),
    }, ['Books/demo.epub']);

    const service = new EpubStorageService(app);
    const entries = await service.loadBookshelfIndex();

    expect(entries).toEqual([]);
  });

  it('removes book cache and bookshelf index by file path for reimport', async () => {
    const booksPath = 'weave/incremental-reading/epub-reading/books.json';
    const indexPath = 'weave/incremental-reading/epub-reading/bookshelf-index.json';
    const { app, files } = createMemoryApp({
      [booksPath]: JSON.stringify({
        'book-1': createBook(),
      }),
      [indexPath]: JSON.stringify([
        {
          path: 'Books/demo.epub',
          name: 'demo',
          folder: 'Books',
          size: 1024,
        },
      ]),
      'weave/incremental-reading/epub-reading/book-1/state.json': JSON.stringify({
        currentPosition: {
          chapterIndex: 2,
          cfi: '/6/8',
          percent: 66,
        },
        readingStats: {
          totalReadTime: 10,
          lastReadTime: 999,
          createdTime: 50,
        },
      }),
    }, ['Books/demo.epub']);

    const service = new EpubStorageService(app);
    const result = await service.removeBookByFilePath('Books/demo.epub');

    expect(result.removedBookId).toBe('book-1');
    expect(JSON.parse(files.get(booksPath) || '{}')).toEqual({});
    expect(JSON.parse(files.get(indexPath) || '[]')).toEqual([]);
    expect(files.has('weave/incremental-reading/epub-reading/book-1/state.json')).toBe(false);
  });
});
