/**
 * 媒体存储适配器
 * 
 * 抽象媒体文件存储操作
 * 
 * @module infrastructure/adapters
 */

import type { MediaManifest, MediaFileEntry } from '../../domain/apkg/types';

/**
 * 媒体存储适配器接口
 */
export interface IMediaStorageAdapter {
  /**
   * 创建牌组媒体文件夹
   */
  createDeckMediaFolder(deckName: string): Promise<string>;

  /**
   * 保存媒体文件
   */
  saveMediaFile(
    filename: string,
    data: Uint8Array,
    basePath: string
  ): Promise<string>;

  /**
   * 检查媒体文件是否存在
   */
  mediaFileExists(path: string): Promise<boolean>;

  /**
   * 删除媒体文件
   */
  deleteMediaFile(path: string): Promise<void>;

  /**
   * 保存媒体清单
   */
  saveManifest(manifest: MediaManifest): Promise<void>;

  /**
   * 读取媒体清单
   */
  loadManifest(basePath: string): Promise<MediaManifest | null>;

  /**
   * 生成Obsidian路径
   */
  generateObsidianPath(originalName: string, basePath: string): string;

  /**
   * 计算文件哈希
   */
  calculateHash(data: Uint8Array): Promise<string>;
}
