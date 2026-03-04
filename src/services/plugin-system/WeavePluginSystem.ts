/**
 * Weave 插件系统总入口
 * 管理插件的发现、加载、启用/禁用、状态持久化
 */

import { logger } from '../../utils/logger';
import { weaveEventBus } from '../../events/WeaveEventBus';
import { WeavePluginLoader } from './WeavePluginLoader';
import { WeaveMenuRegistry } from './WeaveMenuRegistry';
import type { InstalledPluginInfo } from './WeaveMenuRegistry';
import type {
  PluginRegistryEntry,
  PluginRegistryData,
  PluginStateRecord,
  WeavePluginManifest
} from '../../types/weave-plugin-types';

interface PluginHost {
  app: any;
  dataStorage: any;
  settings?: any;
}

export class WeavePluginSystem {
  private host: PluginHost;
  private loader: WeavePluginLoader;
  private registry = new Map<string, PluginRegistryEntry>();
  private weaveVersion: string;
  private pluginsBaseDir: string;
  private stateFilePath: string;
  private isInitialized = false;
  private isDestroyed = false;

  constructor(host: PluginHost, weaveVersion: string, pluginsBaseDir: string, stateFilePath: string) {
    this.host = host;
    this.weaveVersion = weaveVersion;
    this.pluginsBaseDir = pluginsBaseDir;
    this.stateFilePath = stateFilePath;
    this.loader = new WeavePluginLoader(host, weaveVersion, pluginsBaseDir);
  }

  /**
   * 初始化插件系统：扫描、加载已启用的插件
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) return;

    logger.info('[PluginSystem] Initializing...');

    try {
      // 确保插件目录存在
      await this.ensurePluginsDir();

      // 加载持久化状态
      const savedState = await this.loadState();

      // 扫描插件
      const discovered = await this.loader.scanPlugins();
      logger.info(`[PluginSystem] Discovered ${discovered.length} plugin(s)`);

      // 注册所有发现的插件
      for (const { manifest, dir } of discovered) {
        const stateRecord = savedState.find(s => s.id === manifest.id);
        const shouldEnable = stateRecord ? stateRecord.enabled : true; // 默认启用

        if (shouldEnable) {
          const entry = await this.loader.loadPlugin(manifest, dir);
          this.registry.set(manifest.id, entry);
        } else {
          this.registry.set(manifest.id, {
            manifest,
            state: 'disabled'
          });
        }
      }

      this.isInitialized = true;

      // 发射 plugin:ready 事件
      weaveEventBus.emitSync('plugin:ready', undefined);

      logger.info(`[PluginSystem] Initialized: ${this.registry.size} plugin(s) registered`);
      this.syncInstalledPlugins();
    } catch (err) {
      logger.error('[PluginSystem] Initialization failed:', err);
    }
  }

  /**
   * 销毁插件系统：卸载所有插件、清理事件
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return;

    logger.info('[PluginSystem] Destroying...');

    // 保存状态
    await this.saveState();

    // 卸载所有已加载的插件
    for (const [id, entry] of this.registry) {
      if (entry.instance) {
        try {
          await this.loader.unloadPlugin(entry);
          weaveEventBus.removePluginListeners(id);
          WeaveMenuRegistry.unregister(id);
        } catch (err) {
          logger.error(`[PluginSystem] Error destroying plugin ${id}:`, err);
        }
      }
    }

    WeaveMenuRegistry.clear();
    this.registry.clear();
    this.isDestroyed = true;
    this.isInitialized = false;

    logger.info('[PluginSystem] Destroyed');
  }

  /**
   * 启用插件
   */
  async enablePlugin(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) return false;
    if (entry.state === 'enabled') return true;

    // 重新扫描获取目录路径
    const discovered = await this.loader.scanPlugins();
    const found = discovered.find(d => d.manifest.id === pluginId);
    if (!found) return false;

    const newEntry = await this.loader.loadPlugin(found.manifest, found.dir);
    this.registry.set(pluginId, newEntry);

    await this.saveState();
    this.syncInstalledPlugins();
    return newEntry.state === 'enabled';
  }

  /**
   * 禁用插件
   */
  async disablePlugin(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) return false;
    if (entry.state === 'disabled') return true;

    if (entry.instance) {
      await this.loader.unloadPlugin(entry);
      weaveEventBus.removePluginListeners(pluginId);
      WeaveMenuRegistry.unregister(pluginId);
    }

    entry.state = 'disabled';
    entry.instance = undefined;
    entry.error = undefined;

    await this.saveState();
    this.syncInstalledPlugins();
    return true;
  }

  /**
   * 获取所有已注册的插件
   */
  getPlugins(): PluginRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * 获取单个插件信息
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * 重新加载单个插件
   */
  async reloadPlugin(pluginId: string): Promise<boolean> {
    await this.disablePlugin(pluginId);
    return this.enablePlugin(pluginId);
  }

  /**
   * 卸载并删除插件（删除文件夹及所有内容）
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) return false;

    // 1. 先禁用插件
    if (entry.instance) {
      try {
        await this.loader.unloadPlugin(entry);
        weaveEventBus.removePluginListeners(pluginId);
        WeaveMenuRegistry.unregister(pluginId);
      } catch (err) {
        logger.error(`[PluginSystem] Error unloading plugin ${pluginId} during uninstall:`, err);
      }
    }

    // 2. 查找插件目录路径
    try {
      const discovered = await this.loader.scanPlugins();
      const found = discovered.find(d => d.manifest.id === pluginId);
      if (found) {
        const adapter = this.host.app.vault.adapter;
        await this.deleteDirectoryRecursive(adapter, found.dir);
        logger.info(`[PluginSystem] Deleted plugin directory: ${found.dir}`);
      }
    } catch (err) {
      logger.error(`[PluginSystem] Failed to delete plugin directory for ${pluginId}:`, err);
    }

    // 3. 从注册表中移除
    this.registry.delete(pluginId);
    await this.saveState();
    this.syncInstalledPlugins();

    logger.info(`[PluginSystem] Plugin uninstalled: ${pluginId}`);
    return true;
  }

  /**
   * 递归删除目录及其所有内容
   */
  private async deleteDirectoryRecursive(adapter: any, dirPath: string): Promise<void> {
    const listing = await adapter.list(dirPath);

    // 先删除所有子文件
    if (listing.files) {
      for (const file of listing.files) {
        await adapter.remove(file);
      }
    }

    // 再递归删除子目录
    if (listing.folders) {
      for (const folder of listing.folders) {
        await this.deleteDirectoryRecursive(adapter, folder);
      }
    }

    // 最后删除目录本身
    await adapter.rmdir(dirPath, true);
  }

  /**
   * 获取插件数量统计
   */
  // 可配置插件列表（硬编码）
  private static readonly CONFIGURABLE_PLUGINS = new Set(['auto-rules']);

  /**
   * 同步已安装插件列表到全局菜单注册表，供 UI 消费
   */
  private syncInstalledPlugins(): void {
    const plugins: InstalledPluginInfo[] = [];
    for (const entry of this.registry.values()) {
      plugins.push({
        id: entry.manifest.id,
        name: entry.manifest.name,
        version: entry.manifest.version,
        state: entry.state,
        configurable: WeavePluginSystem.CONFIGURABLE_PLUGINS.has(entry.manifest.id)
      });
    }
    WeaveMenuRegistry.setInstalledPlugins(plugins);
  }

  getStats(): { total: number; enabled: number; disabled: number; error: number } {
    let enabled = 0, disabled = 0, error = 0;
    for (const entry of this.registry.values()) {
      switch (entry.state) {
        case 'enabled': enabled++; break;
        case 'disabled': disabled++; break;
        case 'error': error++; break;
      }
    }
    return { total: this.registry.size, enabled, disabled, error };
  }

  // ===== 状态持久化 =====

  private async loadState(): Promise<PluginStateRecord[]> {
    try {
      const adapter = this.host.app.vault.adapter;
      const exists = await adapter.exists(this.stateFilePath);
      if (!exists) return [];
      const raw = await adapter.read(this.stateFilePath);
      const data = JSON.parse(raw) as PluginRegistryData;
      return data.plugins || [];
    } catch {
      return [];
    }
  }

  private async saveState(): Promise<void> {
    try {
      const records: PluginStateRecord[] = [];
      for (const [id, entry] of this.registry) {
        records.push({
          id,
          enabled: entry.state === 'enabled'
        });
      }

      const data: PluginRegistryData = {
        version: 1,
        plugins: records
      };

      const adapter = this.host.app.vault.adapter;

      // 确保父目录存在
      const parentDir = this.stateFilePath.substring(0, this.stateFilePath.lastIndexOf('/'));
      const parentExists = await adapter.exists(parentDir);
      if (!parentExists) {
        await adapter.mkdir(parentDir);
      }

      await adapter.write(this.stateFilePath, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('[PluginSystem] Failed to save state:', err);
    }
  }

  private async ensurePluginsDir(): Promise<void> {
    try {
      const adapter = this.host.app.vault.adapter;
      const exists = await adapter.exists(this.pluginsBaseDir);
      if (!exists) {
        await adapter.mkdir(this.pluginsBaseDir);
        logger.debug(`[PluginSystem] Created plugins directory: ${this.pluginsBaseDir}`);
      }
    } catch (err) {
      logger.error('[PluginSystem] Failed to create plugins directory:', err);
    }
  }
}
