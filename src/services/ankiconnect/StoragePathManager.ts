import { logger } from '../../utils/logger';
/**
 * 存储路径管理器
 * 
 * 统一管理插件所有数据存储路径，实现分层存储策略：
 * - Vault 内：用户数据、备份（会同步）
 * - 插件目录：缓存、临时文件、日志（不同步）
 */

import type { Plugin } from 'obsidian';
import { getV2Paths } from '../../config/paths';

export class StoragePathManager {
  private plugin: Plugin;
  private v2Paths = getV2Paths(undefined);
  
  constructor(plugin: Plugin) {
    this.plugin = plugin;
    const parentFolder = (this.plugin as any).settings?.weaveParentFolder as string | undefined;
    this.v2Paths = getV2Paths(parentFolder);
  }

  private getDataRoot(): string {
    const parentFolder = (this.plugin as any).settings?.weaveParentFolder as string | undefined;
    this.v2Paths = getV2Paths(parentFolder);
    return this.v2Paths.root;
  }
  
  /**
   * 获取主数据文件夹路径（Vault内，会同步）
   * @param subPath 子路径（可选）
   * @returns 完整路径
   */
  getDataPath(subPath?: string): string {
    const baseFolder = this.getDataRoot();
    return subPath ? `${baseFolder}/${subPath}` : baseFolder;
  }
  
  /**
   * 获取备份文件夹路径（独立于数据目录，防止误删）
   * 
   *  安全设计：
   * - 备份放在插件配置目录（.obsidian/plugins/weave/backups/）
   * - 与数据文件夹（weave/）完全分离
   * - 删除数据文件夹不会影响备份
   * 
   * @param subPath 子路径（可选）
   * @returns 完整路径
   */
  getBackupPath(subPath?: string): string {
    const baseFolder = '.obsidian/plugins/weave/backups';
    return subPath ? `${baseFolder}/${subPath}` : baseFolder;
  }
  
  /**
   * 获取设备备份路径
   * @param deviceId 设备ID
   * @returns 设备备份路径
   */
  getDeviceBackupPath(deviceId: string): string {
    return this.getBackupPath(`devices/${deviceId}`);
  }
  
  /**
   * 获取导入备份路径
   * @returns 导入备份路径
   */
  getImportBackupPath(): string {
    return this.getBackupPath('import');
  }
  
  /**
   * 获取定时备份路径
   * @returns 定时备份路径
   */
  getScheduledBackupPath(): string {
    return this.getBackupPath('scheduled');
  }
  
  /**
   * 获取手动备份路径
   * @returns 手动备份路径
   */
  getManualBackupPath(): string {
    return this.getBackupPath('manual');
  }
  
  /**
   * 获取备份元数据索引路径
   * @returns 索引文件路径
   */
  getBackupIndexPath(): string {
    return this.getBackupPath('.index.json');
  }
  
  /**
   * 获取缓存文件夹路径（插件目录，不同步）
   * @param subPath 子路径（可选）
   * @returns 完整路径
   */
  getCachePath(subPath?: string): string {
    const pluginDir = this.plugin.manifest.dir;  // .obsidian/plugins/weave
    const cacheFolder = `${pluginDir}/cache`;
    return subPath ? `${cacheFolder}/${subPath}` : cacheFolder;
  }
  
  /**
   * 获取临时文件夹路径（插件目录，不同步）
   * @param subPath 子路径（可选）
   * @returns 完整路径
   */
  getTempPath(subPath?: string): string {
    const pluginDir = this.plugin.manifest.dir;
    const tempFolder = `${pluginDir}/temp`;
    return subPath ? `${tempFolder}/${subPath}` : tempFolder;
  }
  
  /**
   * 获取日志文件夹路径（插件目录，不同步）
   * @param subPath 子路径（可选）
   * @returns 完整路径
   */
  getLogPath(subPath?: string): string {
    const pluginDir = this.plugin.manifest.dir;
    const logFolder = `${pluginDir}/logs`;
    return subPath ? `${logFolder}/${subPath}` : logFolder;
  }
  
  /**
   * 获取插件目录的绝对路径（用于跨平台文件操作）
   * @returns 插件目录绝对路径
   */
  getPluginDirPath(): string {
    const configDir = this.plugin.app.vault.configDir;  // .obsidian
    return `${configDir}/plugins/${this.plugin.manifest.id}`;
  }
  
  /**
   * 判断路径是否会被同步
   * @param path 要判断的路径
   * @returns 是否会被同步
   */
  isPathSynced(path: string): boolean {
    // 在 Vault 内且不在 .obsidian 目录的路径会被同步
    const configDir = this.plugin.app.vault.configDir;
    return !path.startsWith('.obsidian/') && !path.startsWith(configDir);
  }
  
  /**
   * 确保目录存在
   * @param path 目录路径
   */
  async ensureFolder(path: string): Promise<void> {
    try {
      const exists = await this.plugin.app.vault.adapter.exists(path);
      if (!exists) {
        await this.plugin.app.vault.createFolder(path);
        logger.debug(`✅ 创建目录: ${path}`);
      }
    } catch (error) {
      // 忽略"已存在"错误
      if (!(error as any).message?.includes('already exists')) {
        logger.error(`❌ 创建目录失败: ${path}`, error);
        throw error;
      }
    }
  }
  
  /**
   * 确保所有必要的备份目录存在
   */
  async ensureBackupFolders(): Promise<void> {
    const folders = [
      this.getBackupPath(),                // .backups/
      this.getBackupPath('devices'),       // .backups/devices/
      this.getImportBackupPath(),          // .backups/import/
      this.getScheduledBackupPath(),       // .backups/scheduled/
      this.getManualBackupPath(),          // .backups/manual/
    ];
    
    for (const folder of folders) {
      await this.ensureFolder(folder);
    }
  }
  
  /**
   * 确保所有必要的缓存目录存在
   */
  async ensureCacheFolders(): Promise<void> {
    const folders = [
      this.getCachePath(),                 // cache/
      this.getCachePath('card-snapshots'), // cache/card-snapshots/
      this.getTempPath(),                  // temp/
      this.getLogPath(),                   // logs/
    ];
    
    for (const folder of folders) {
      await this.ensureFolder(folder);
    }
  }
  
  /**
   * 初始化所有存储目录
   */
  async initialize(): Promise<void> {
    logger.debug('📁 初始化存储目录...');
    await this.ensureBackupFolders();
    await this.ensureCacheFolders();
    logger.debug('✅ 存储目录初始化完成');
  }
}


