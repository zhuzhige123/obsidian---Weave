/**
 * Weave 文件夹迁移服务
 * 
 * 功能：
 * - 检测父文件夹路径变更
 * - 自动迁移编辑器池文件和媒体文件
 * - 验证迁移完整性
 * - 清理旧文件夹
 */

import type { WeavePlugin } from '../main';
import { TFolder, TFile, Notice } from 'obsidian';
// ⚠️ 已弃用：此服务在v1.0.0中已不再使用（路径不再可配置）
import { getMediaFolder } from '../config/paths';
import { logger } from '../utils/logger';

export class WeaveFolderMigration {
  private plugin: WeavePlugin;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 检查是否需要迁移
   * @deprecated v1.0.0 路径不再可配置，此方法已弃用
   */
  needsMigration(newParentFolder: string, oldParentFolder?: string): boolean {
    const old = oldParentFolder || 'weave';
    return newParentFolder !== old;
  }

  /**
   * 执行完整的文件夹迁移
   * @param oldParentFolder 旧的父文件夹路径
   * @param newParentFolder 新的父文件夹路径
   */
  async migrate(oldParentFolder: string, newParentFolder: string): Promise<void> {
    logger.debug('[WeaveFolderMigration]', `开始迁移: ${oldParentFolder} -> ${newParentFolder}`);

    try {
      // 步骤1: 创建新的父文件夹结构
      await this.ensureNewStructure(newParentFolder);

      // 步骤2: 迁移媒体文件（编辑器池已弃用）
      const mediaResult = await this.migrateMediaFolder(oldParentFolder, newParentFolder);
      const editorsResult = { count: 0, errors: [] }; // 编辑器池已弃用

      const totalMigrated = editorsResult.count + mediaResult.count;
      const allErrors = [...editorsResult.errors, ...mediaResult.errors];
      
      // 🔧 检查是否有错误发生
      if (allErrors.length > 0) {
        logger.error('[WeaveFolderMigration]', `迁移过程中发生 ${allErrors.length} 个错误:`, allErrors);
        throw new Error(`迁移失败: ${allErrors.length} 个错误，详见控制台`);
      }
      
      // 步骤4: 清理旧文件夹（仅在成功时）
      await this.cleanupOldFolders(oldParentFolder);
      
      logger.debug('[WeaveFolderMigration]', `迁移完成: 共迁移 ${totalMigrated} 个文件`);
      new Notice(`Weave文件夹迁移完成\n编辑器池: ${editorsResult.count} 文件\n媒体文件: ${mediaResult.count} 文件`);

    } catch (error) {
      logger.error('[WeaveFolderMigration]', '迁移失败:', error);
      new Notice('Weave文件夹迁移失败，请检查控制台错误信息');
      throw error;
    }
  }

  /**
   * 确保新的文件夹结构存在
   */
  private async ensureNewStructure(newParentFolder: string): Promise<void> {
    const vault = this.plugin.app.vault;
    const adapter = vault.adapter;

    // 创建父文件夹
    const parentExists = await adapter.exists(newParentFolder);
    if (!parentExists) {
      await vault.createFolder(newParentFolder);
      logger.debug('[WeaveFolderMigration]', `创建父文件夹: ${newParentFolder}`);
    }

    // 创建子文件夹
    const mediaFolder = getMediaFolder(newParentFolder);
    const mediaExists = await adapter.exists(mediaFolder);
    if (!mediaExists) {
      await vault.createFolder(mediaFolder);
      logger.debug('[WeaveFolderMigration]', `创建媒体文件夹: ${mediaFolder}`);
    }
  }

  /**
   * 迁移编辑器池文件夹
   */
  private async migrateEditorsFolder(
    oldParentFolder: string,
    newParentFolder: string
  ): Promise<{ count: number; errors: string[] }> {
    void oldParentFolder;
    void newParentFolder;
    return { count: 0, errors: [] };
  }

  /**
   * 迁移媒体文件夹
   */
  private async migrateMediaFolder(
    oldParentFolder: string,
    newParentFolder: string
  ): Promise<{ count: number; errors: string[] }> {
    const oldMediaFolder = getMediaFolder(oldParentFolder);
    const newMediaFolder = getMediaFolder(newParentFolder);

    return await this.migrateFolderContents(oldMediaFolder, newMediaFolder, '媒体文件');
  }

  /**
   * 迁移文件夹内容（递归）
   */
  private async migrateFolderContents(
    oldFolder: string,
    newFolder: string,
    label: string
  ): Promise<{ count: number; errors: string[] }> {
    const vault = this.plugin.app.vault;
    const adapter = vault.adapter;
    let count = 0;
    const errors: string[] = [];

    // 检查旧文件夹是否存在
    const oldExists = await adapter.exists(oldFolder);
    if (!oldExists) {
      logger.debug('[WeaveFolderMigration]', `旧文件夹不存在，跳过: ${oldFolder}`);
      return { count: 0, errors: [] };
    }

    try {
      const oldFolderObj = vault.getAbstractFileByPath(oldFolder);
      
      // 🔧 增强空值和类型检查
      if (!oldFolderObj) {
        logger.warn('[WeaveFolderMigration]', `文件夹不存在: ${oldFolder}`);
        return { count: 0, errors: [] };
      }
      
      if (!(oldFolderObj instanceof TFolder)) {
        const errorMsg = `路径不是文件夹: ${oldFolder}`;
        logger.error('[WeaveFolderMigration]', errorMsg);
        return { count: 0, errors: [errorMsg] };
      }

      // 递归迁移所有文件
      const filesToMigrate = this.getAllFiles(oldFolderObj);
      
      for (const file of filesToMigrate) {
        try {
          // 计算相对路径
          const relativePath = file.path.substring(oldFolder.length + 1);
          const newPath = `${newFolder}/${relativePath}`;

          // 确保目标文件夹存在
          const targetDir = newPath.substring(0, newPath.lastIndexOf('/'));
          const targetDirExists = await adapter.exists(targetDir);
          if (!targetDirExists) {
            await vault.createFolder(targetDir);
          }

          // 移动文件
          await vault.rename(file, newPath);
          count++;
          logger.debug('[WeaveFolderMigration]', `迁移文件: ${file.path} -> ${newPath}`);

        } catch (error) {
          const errorMsg = `迁移文件失败: ${file.path} (${error})`;
          errors.push(errorMsg);
          logger.error('[WeaveFolderMigration]', errorMsg);
        }
      }

      logger.debug('[WeaveFolderMigration]', `${label}迁移完成: ${count} 个文件`);

    } catch (error) {
      const errorMsg = `迁移${label}失败: ${error}`;
      errors.push(errorMsg);
      logger.error('[WeaveFolderMigration]', errorMsg);
    }

    return { count, errors };
  }

  /**
   * 递归获取文件夹下所有文件
   */
  private getAllFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile) {
        files.push(child);
      } else if (child instanceof TFolder) {
        files.push(...this.getAllFiles(child));
      }
    }

    return files;
  }

  /**
   * 清理旧文件夹（如果为空）
   */
  private async cleanupOldFolders(oldParentFolder: string): Promise<void> {
    const vault = this.plugin.app.vault;
    const adapter = vault.adapter;

    try {
      // 清理旧的媒体文件夹（编辑器池已弃用）
      const oldMediaFolder = getMediaFolder(oldParentFolder);
      await this.deleteEmptyFolder(oldMediaFolder);

      // 清理旧的父文件夹（如果为空）
      await this.deleteEmptyFolder(oldParentFolder);

      logger.debug('[WeaveFolderMigration]', '旧文件夹清理完成');

    } catch (error) {
      logger.warn('[WeaveFolderMigration]', '清理旧文件夹时出错（非致命）:', error);
    }
  }

  /**
   * 删除空文件夹
   */
  private async deleteEmptyFolder(folderPath: string): Promise<void> {
    const vault = this.plugin.app.vault;
    const adapter = vault.adapter;

    const exists = await adapter.exists(folderPath);
    if (!exists) return;

    const folderObj = vault.getAbstractFileByPath(folderPath);
    // 🔧 增强空值检查
    if (!folderObj || !(folderObj instanceof TFolder)) return;

    // 检查文件夹是否为空
    if (folderObj.children.length === 0) {
      await vault.delete(folderObj);
      logger.debug('[WeaveFolderMigration]', `删除空文件夹: ${folderPath}`);
    } else {
      logger.debug('[WeaveFolderMigration]', `文件夹不为空，保留: ${folderPath}`);
    }
  }

  /**
   * 验证迁移结果
   */
  async validateMigration(newParentFolder: string): Promise<boolean> {
    const adapter = this.plugin.app.vault.adapter;
    
    // 检查新文件夹是否存在
    const mediaFolder = getMediaFolder(newParentFolder);
    const mediaExists = await adapter.exists(mediaFolder);

    if (!mediaExists) {
      logger.error('[WeaveFolderMigration]', '迁移验证失败: 新文件夹不存在');
      return false;
    }

    logger.debug('[WeaveFolderMigration]', '迁移验证通过');
    return true;
  }
}
