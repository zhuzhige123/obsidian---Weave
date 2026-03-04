/**
 * YAML Frontmatter 工具
 * 
 * 用于在MD文件中读取和更新增量阅读相关的YAML字段
 * 
 * @module utils/yaml-frontmatter-utils
 * @version 1.0.0
 */

import type { App, TFile } from 'obsidian';
import type { ReadingYAMLFields, ReadingCategory } from '../types/incremental-reading-types';
import { YAML_FIELD_PREFIX } from '../types/incremental-reading-types';
import { logger } from './logger';

/**
 * YAML Frontmatter 管理器
 */
export class YAMLFrontmatterManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * 获取文件的增量阅读YAML字段
   * @param file 目标文件
   * @returns 增量阅读字段，如果不存在则返回null
   */
  async getReadingFields(file: TFile): Promise<Partial<ReadingYAMLFields> | null> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;

      if (!frontmatter) {
        return null;
      }

      const fields: Partial<ReadingYAMLFields> = {};

      if (frontmatter['weave-reading-id']) {
        fields['weave-reading-id'] = frontmatter['weave-reading-id'];
      }
      if (frontmatter['weave-reading-category']) {
        fields['weave-reading-category'] = frontmatter['weave-reading-category'];
      }
      if (frontmatter['weave-reading-priority'] !== undefined) {
        fields['weave-reading-priority'] = frontmatter['weave-reading-priority'];
      }
      if (frontmatter['weave-reading-ir-deck-id']) {
        fields['weave-reading-ir-deck-id'] = frontmatter['weave-reading-ir-deck-id'];
      }

      return Object.keys(fields).length > 0 ? fields : null;
    } catch (error) {
      logger.error('[YAMLFrontmatter] 获取YAML字段失败:', error);
      return null;
    }
  }

  /**
   * 获取文件的阅读材料ID
   * @param file 目标文件
   * @returns 阅读材料UUID，如果不存在则返回null
   */
  async getReadingId(file: TFile): Promise<string | null> {
    const fields = await this.getReadingFields(file);
    return fields?.['weave-reading-id'] || null;
  }

  /**
   * 更新文件的增量阅读YAML字段
   * @param file 目标文件
   * @param updates 要更新的字段
   */
  async updateReadingFields(
    file: TFile,
    updates: Partial<ReadingYAMLFields>
  ): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        // 更新每个字段
        if (updates['weave-reading-id'] !== undefined) {
          frontmatter['weave-reading-id'] = updates['weave-reading-id'];
        }
        if (updates['weave-reading-category'] !== undefined) {
          frontmatter['weave-reading-category'] = updates['weave-reading-category'];
        }
        if (updates['weave-reading-priority'] !== undefined) {
          frontmatter['weave-reading-priority'] = updates['weave-reading-priority'];
        }
        if (updates['weave-reading-ir-deck-id'] !== undefined) {
          if (updates['weave-reading-ir-deck-id']) {
            frontmatter['weave-reading-ir-deck-id'] = updates['weave-reading-ir-deck-id'];
          } else {
            delete frontmatter['weave-reading-ir-deck-id'];
          }
        }
      });

      logger.debug('[YAMLFrontmatter] 更新YAML字段成功:', file.path, updates);
    } catch (error) {
      logger.error('[YAMLFrontmatter] 更新YAML字段失败:', error);
      throw error;
    }
  }

  /**
   * 初始化文件的增量阅读YAML字段
   * @param file 目标文件
   * @param uuid 阅读材料UUID
   * @param category 初始分类
   * @param priority 初始优先级
   */
  async initializeReadingFields(
    file: TFile,
    uuid: string,
    category: ReadingCategory,
    priority: number
  ): Promise<void> {
    await this.updateReadingFields(file, {
      'weave-reading-id': uuid,
      'weave-reading-category': category,
      'weave-reading-priority': priority
    });
  }

  /**
   * 更新文件的分类
   * @param file 目标文件
   * @param category 新分类
   */
  async updateCategory(file: TFile, category: ReadingCategory): Promise<void> {
    await this.updateReadingFields(file, {
      'weave-reading-category': category
    });
  }

  /**
   * 更新文件的优先级
   * @param file 目标文件
   * @param priority 新优先级
   */
  async updatePriority(file: TFile, priority: number): Promise<void> {
    await this.updateReadingFields(file, {
      'weave-reading-priority': priority
    });
  }

  /**
   * 移除文件的增量阅读YAML字段
   * @param file 目标文件
   */
  async removeReadingFields(file: TFile): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        delete frontmatter['weave-reading-id'];
        delete frontmatter['weave-reading-category'];
        delete frontmatter['weave-reading-priority'];
        delete frontmatter['weave-reading-ir-deck-id'];
      });

      logger.debug('[YAMLFrontmatter] 移除YAML字段成功:', file.path);
    } catch (error) {
      logger.error('[YAMLFrontmatter] 移除YAML字段失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否有增量阅读标记
   * @param file 目标文件
   * @returns 是否有阅读标记
   */
  async hasReadingMark(file: TFile): Promise<boolean> {
    const readingId = await this.getReadingId(file);
    return readingId !== null;
  }

  /**
   * 批量获取多个文件的阅读ID
   * @param files 文件列表
   * @returns 文件路径 -> 阅读ID 的映射
   */
  async batchGetReadingIds(files: TFile[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (const file of files) {
      const readingId = await this.getReadingId(file);
      if (readingId) {
        result.set(file.path, readingId);
      }
    }

    return result;
  }
}

/**
 * 创建 YAML Frontmatter 管理器实例
 * @param app Obsidian App 实例
 */
export function createYAMLFrontmatterManager(app: App): YAMLFrontmatterManager {
  return new YAMLFrontmatterManager(app);
}
