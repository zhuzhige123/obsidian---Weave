/**
 * Obsidian媒体存储适配器实现
 * 
 * 实现IMediaStorageAdapter接口，提供Obsidian环境下的媒体文件存储能力
 * 
 * @module infrastructure/adapters/impl
 */

import type { Plugin, TFile } from 'obsidian';
import type { IMediaStorageAdapter } from '../MediaStorageAdapter';
import type { MediaManifest } from '../../../domain/apkg/types';
import { APKGLogger } from '../../logger/APKGLogger';
import { getMediaFolder } from '../../../config/paths';

/**
 * Obsidian媒体存储适配器
 */
export class ObsidianMediaStorageAdapter implements IMediaStorageAdapter {
  private logger: APKGLogger;
  private plugin: Plugin;
  private baseMediaPath: string;  // 🆕 插件专属媒体文件夹（可配置）

  constructor(plugin: Plugin) {
    this.logger = new APKGLogger({ prefix: '[ObsidianMediaStorage]' });
    this.plugin = plugin;
    // 🆕 使用统一的媒体文件夹路径
    const parentFolder = (this.plugin as any).settings?.weaveParentFolder as string | undefined;
    this.baseMediaPath = getMediaFolder(parentFolder);
  }

  /**
   * 创建牌组媒体文件夹
   */
  async createDeckMediaFolder(deckName: string): Promise<string> {
    //  规范路径: weave/memory/media/[APKG] DeckName/
    const safeDeckName = this.sanitizeFilename(deckName);
    const folderPath = `${this.baseMediaPath}/[APKG] ${safeDeckName}`;
    
    await this.ensureFolder(folderPath);
    this.logger.debug(`创建牌组媒体文件夹: ${folderPath}`);
    
    return folderPath;
  }

  /**
   * 保存媒体文件
   */
  async saveMediaFile(
    filename: string,
    data: Uint8Array,
    basePath: string
  ): Promise<string> {
    const safeFilename = this.sanitizeFilename(filename);
    const filePath = `${basePath}/${safeFilename}`;
    
    // 如果文件已存在，生成唯一路径
    const uniquePath = await this.getUniqueFilePath(filePath);
    
    try {
      // 保存文件
      // 创建新的ArrayBuffer以确保类型兼容性
      const arrayBuffer = new ArrayBuffer(data.byteLength);
      const uint8View = new Uint8Array(arrayBuffer);
      uint8View.set(data);
      
      await this.plugin.app.vault.createBinary(
        uniquePath,
        arrayBuffer
      );
      
      this.logger.debug(`保存媒体文件: ${filename} → ${uniquePath}`);
      return uniquePath;
      
    } catch (error) {
      // 处理文件已存在的竞态条件
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.debug(`文件已存在，尝试生成新的唯一路径: ${uniquePath}`);
        
        // 重新生成唯一路径并重试
        const retryPath = await this.getUniqueFilePath(filePath);
        const retryArrayBuffer = new ArrayBuffer(data.byteLength);
        const retryUint8View = new Uint8Array(retryArrayBuffer);
        retryUint8View.set(data);
        
        await this.plugin.app.vault.createBinary(
          retryPath,
          retryArrayBuffer
        );
        
        this.logger.debug(`重试保存成功: ${filename} → ${retryPath}`);
        return retryPath;
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }

  /**
   * 计算文件哈希（SHA-256）
   */
  async calculateHash(data: Uint8Array): Promise<string> {
    // 创建新的ArrayBuffer以避免类型问题
    const inputBuffer = new ArrayBuffer(data.byteLength);
    const inputView = new Uint8Array(inputBuffer);
    inputView.set(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', inputBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * 检查媒体文件是否存在
   */
  async mediaFileExists(path: string): Promise<boolean> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    return file !== null;
  }

  /**
   * 删除媒体文件
   */
  async deleteMediaFile(path: string): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file && file instanceof this.plugin.app.vault.adapter.constructor) {
      await this.plugin.app.vault.delete(file as TFile);
      this.logger.debug(`删除媒体文件: ${path}`);
    }
  }

  /**
   * 读取媒体清单
   */
  async loadManifest(basePath: string): Promise<MediaManifest | null> {
    const manifestPath = `${basePath}/manifest.json`;
    const legacyManifestPath = `${basePath}/.manifest.json`;
    
    try {
      let file = this.plugin.app.vault.getAbstractFileByPath(manifestPath);
      if (!file) {
        file = this.plugin.app.vault.getAbstractFileByPath(legacyManifestPath);
      }
      if (!file) {
        return null;
      }
      
      const content = await this.plugin.app.vault.read(file as TFile);
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('读取媒体清单失败:', error);
      return null;
    }
  }

  /**
   * 生成Obsidian路径
   */
  generateObsidianPath(filename: string, basePath: string): string {
    const safeFilename = this.sanitizeFilename(filename);
    return `${basePath}/${safeFilename}`;
  }

  /**
   * 保存媒体清单
   */
  async saveManifest(manifest: MediaManifest): Promise<void> {
    const manifestPath = `${manifest.basePath}/manifest.json`;
    const manifestJson = JSON.stringify(manifest, null, 2);
    
    try {
      // 检查文件是否已存在
      const existingFile = this.plugin.app.vault.getAbstractFileByPath(manifestPath);
      
      if (existingFile) {
        // 如果存在，修改文件内容
        await this.plugin.app.vault.modify(existingFile as TFile, manifestJson);
        this.logger.debug(`更新媒体清单: ${manifestPath}`);
      } else {
        // 如果不存在，创建新文件
        await this.plugin.app.vault.create(manifestPath, manifestJson);
        this.logger.debug(`创建媒体清单: ${manifestPath}`);
      }
      
    } catch (error) {
      // 处理文件已存在的竞态条件
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.debug(`清单文件已存在，尝试修改: ${manifestPath}`);
        
        const existingFile = this.plugin.app.vault.getAbstractFileByPath(manifestPath);
        if (existingFile) {
          await this.plugin.app.vault.modify(existingFile as TFile, manifestJson);
          this.logger.debug(`重试修改清单成功: ${manifestPath}`);
        }
      } else {
        // 其他错误直接抛出
        throw error;
      }
    }
  }

  /**
   * 确保文件夹存在
   */
  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split('/');
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const exists = this.plugin.app.vault.getAbstractFileByPath(currentPath);
      if (!exists) {
        try {
          await this.plugin.app.vault.createFolder(currentPath);
        } catch (error) {
          // 忽略"已存在"错误
          if (!(error as any).message?.includes('already exists')) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * 清理文件名
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')  // 替换不安全字符
      .replace(/\s+/g, '_')            // 替换空格
      .replace(/_{2,}/g, '_')          // 合并多个下划线
      .replace(/^_+|_+$/g, '');        // 移除首尾下划线
  }

  /**
   * 获取唯一文件路径
   */
  private async getUniqueFilePath(originalPath: string): Promise<string> {
    let testPath = originalPath;
    
    // 首先检查原始路径是否可用
    const exists = await this.mediaFileExists(testPath);
    if (!exists) return testPath;
    
    // 如果存在冲突，使用时间戳+随机数策略
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    const dotIndex = originalPath.lastIndexOf('.');
    if (dotIndex > 0) {
      const baseName = originalPath.substring(0, dotIndex);
      const extension = originalPath.substring(dotIndex);
      testPath = `${baseName}_${timestamp}_${random}${extension}`;
    } else {
      testPath = `${originalPath}_${timestamp}_${random}`;
    }
    
    // 检查生成的路径是否可用
    const finalExists = await this.mediaFileExists(testPath);
    if (!finalExists) return testPath;
    
    // 如果还是冲突，回退到计数器策略
    let counter = 1;
    while (counter <= 1000) {
      if (dotIndex > 0) {
        const baseName = originalPath.substring(0, dotIndex);
        const extension = originalPath.substring(dotIndex);
        testPath = `${baseName}_${timestamp}_${random}_${counter}${extension}`;
      } else {
        testPath = `${originalPath}_${timestamp}_${random}_${counter}`;
      }
      
      const exists = await this.mediaFileExists(testPath);
      if (!exists) return testPath;
      
      counter++;
    }

    throw new Error(`无法生成唯一文件路径: ${originalPath}`);
  }
}

