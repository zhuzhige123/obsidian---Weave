import type { App, TFile } from 'obsidian';
import { normalizePath } from 'obsidian';
import { PLUGIN_PATHS } from '../../config/paths';
import { logger } from '../../utils/logger';

export class EditorTempFileCleanupService {
  private app: App;
  private maxAgeMsInTempDir: number;
  private maxAgeMsInRoot: number;

  constructor(
    app: App,
    options?: {
      maxAgeMsInTempDir?: number;
      maxAgeMsInRoot?: number;
    }
  ) {
    this.app = app;
    this.maxAgeMsInTempDir = options?.maxAgeMsInTempDir ?? 12 * 60 * 60 * 1000;
    this.maxAgeMsInRoot = options?.maxAgeMsInRoot ?? 24 * 60 * 60 * 1000;
  }

  async cleanupNow(): Promise<{ scanned: number; deleted: number; skippedOpen: number; skippedYoung: number }> {
    const now = Date.now();

    let deleted = 0;
    let skippedOpen = 0;
    let skippedYoung = 0;

    const openPaths = this.getOpenMarkdownFilePaths();
    const candidates = this.getCandidateTempFiles();

    for (const f of candidates) {
      try {
        if (openPaths.has(f.path)) {
          skippedOpen++;
          continue;
        }

        const mtime = f.stat?.mtime ?? 0;
        const age = mtime > 0 ? now - mtime : Number.POSITIVE_INFINITY;

        const maxAge = this.getMaxAgeMsForPath(f.path);
        if (age < maxAge) {
          skippedYoung++;
          continue;
        }

        await this.app.vault.delete(f);
        deleted++;
      } catch (error) {
        logger.warn('[EditorTempFileCleanup] 删除临时文件失败:', f.path, error);
      }
    }

    if (deleted > 0) {
      logger.debug('[EditorTempFileCleanup] 已清理编辑器临时文件:', {
        scanned: candidates.length,
        deleted,
        skippedOpen,
        skippedYoung,
      });
    }

    return {
      scanned: candidates.length,
      deleted,
      skippedOpen,
      skippedYoung,
    };
  }

  private getCandidateTempFiles(): TFile[] {
    try {
      const files = this.app.vault.getFiles();
      return files.filter((f) => this.isEditorTempFile(f));
    } catch (error) {
      logger.warn('[EditorTempFileCleanup] 枚举文件失败:', error);
      return [];
    }
  }

  private isEditorTempFile(f: TFile): boolean {
    try {
      const name = f.name || '';
      if (!name.startsWith('weave-editor-')) return false;
      if (!name.endsWith('.md')) return false;

      const p = normalizePath(f.path || '');
      if (!p) return false;
      if (p.includes('/.trash/')) return false;

      return true;
    } catch {
      return false;
    }
  }

  private getMaxAgeMsForPath(path: string): number {
    try {
      const p = normalizePath(path);
      if (this.isInAnyTempDir(p)) return this.maxAgeMsInTempDir;
      if (this.isRootFile(p)) return this.maxAgeMsInRoot;
      return this.maxAgeMsInTempDir;
    } catch {
      return this.maxAgeMsInTempDir;
    }
  }

  private isAllowedLocation(path: string): boolean {
    try {
      const p = normalizePath(path);
      if (this.isInAnyTempDir(p)) return true;
      if (this.isRootFile(p)) return true;
      return false;
    } catch {
      return false;
    }
  }

  private isInAnyTempDir(path: string): boolean {
    try {
      const p = normalizePath(path);
      if (p.startsWith(normalizePath(`${PLUGIN_PATHS.temp}/`))) return true;

      // 兼容任意父目录：只要包含 /weave/temp/ 或 /Weave/temp/ 都认为是临时目录
      if (p.includes('/weave/temp/')) return true;
      if (p.includes('/Weave/temp/')) return true;

      // 兜底：历史遗留可能落在任意 */temp/*，但为了安全只清理 weave-editor 前缀
      if (p.includes('/temp/')) return true;
      return false;
    } catch {
      return false;
    }
  }

  private isRootFile(path: string): boolean {
    try {
      const p = normalizePath(path);
      return !p.includes('/');
    } catch {
      return false;
    }
  }

  /**
   * 启动时清理：删除所有未打开的临时文件（不受时间限制）
   * 用于 Obsidian 重启/崩溃后清理孤儿临时文件
   */
  async aggressiveCleanup(): Promise<{ scanned: number; deleted: number; skippedOpen: number }> {
    let deleted = 0;
    let skippedOpen = 0;

    const openPaths = this.getOpenMarkdownFilePaths();
    const candidates = this.getCandidateTempFiles();

    for (const f of candidates) {
      try {
        if (openPaths.has(f.path)) {
          skippedOpen++;
          continue;
        }
        await this.app.vault.delete(f);
        deleted++;
      } catch (error) {
        logger.warn('[EditorTempFileCleanup] 删除临时文件失败:', f.path, error);
      }
    }

    if (deleted > 0 || candidates.length > 0) {
      logger.info('[EditorTempFileCleanup] 启动清理完成:', {
        scanned: candidates.length,
        deleted,
        skippedOpen,
      });
    }

    return { scanned: candidates.length, deleted, skippedOpen };
  }

  private getOpenMarkdownFilePaths(): Set<string> {
    const open = new Set<string>();
    try {
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      for (const leaf of leaves) {
        try {
          const view = leaf.view as any;
          const file = view?.file as TFile | null | undefined;
          const p = file?.path;
          if (p) open.add(normalizePath(p));
        } catch {
        }
      }
    } catch {
    }
    return open;
  }
}
