/**
 * Weave 插件加载器
 * 扫描插件目录、验证清单、使用 new Function() 加载插件代码
 */

import { logger } from '../../utils/logger';
import { WeaveAPIImpl } from './WeaveAPIImpl';
import type {
  WeavePluginManifest,
  WeavePluginInstance,
  PluginRegistryEntry
} from '../../types/weave-plugin-types';

interface PluginHost {
  app: any;
  dataStorage: any;
  settings?: any;
}

export class WeavePluginLoader {
  private host: PluginHost;
  private weaveVersion: string;
  private pluginsBaseDir: string;

  constructor(host: PluginHost, weaveVersion: string, pluginsBaseDir: string) {
    this.host = host;
    this.weaveVersion = weaveVersion;
    this.pluginsBaseDir = pluginsBaseDir;
  }

  /**
   * 扫描插件目录，返回所有发现的插件清单
   */
  async scanPlugins(): Promise<{ manifest: WeavePluginManifest; dir: string }[]> {
    const adapter = this.host.app.vault.adapter;
    const results: { manifest: WeavePluginManifest; dir: string }[] = [];

    try {
      const exists = await adapter.exists(this.pluginsBaseDir);
      if (!exists) {
        logger.debug('[PluginLoader] Plugins directory does not exist, skipping scan');
        return [];
      }

      const listing = await adapter.list(this.pluginsBaseDir);
      const dirs = listing.folders || [];

      for (const dir of dirs) {
        try {
          const manifestPath = `${dir}/manifest.json`;
          const manifestExists = await adapter.exists(manifestPath);
          if (!manifestExists) continue;

          const raw = await adapter.read(manifestPath);
          const manifest = JSON.parse(raw) as WeavePluginManifest;

          if (!manifest.id || !manifest.name || !manifest.version) {
            logger.warn(`[PluginLoader] Invalid manifest in ${dir}: missing required fields`);
            continue;
          }

          results.push({ manifest, dir });
        } catch (err) {
          logger.error(`[PluginLoader] Failed to read manifest from ${dir}:`, err);
        }
      }
    } catch (err) {
      logger.error('[PluginLoader] Failed to scan plugins directory:', err);
    }

    return results;
  }

  /**
   * 加载单个插件
   */
  async loadPlugin(
    manifest: WeavePluginManifest,
    pluginDir: string
  ): Promise<PluginRegistryEntry> {
    const entry: PluginRegistryEntry = {
      manifest,
      state: 'loading'
    };

    try {
      // 版本兼容性检查
      if (manifest.minWeaveVersion && !this.isVersionCompatible(manifest.minWeaveVersion)) {
        entry.state = 'error';
        entry.error = `Requires Weave >= ${manifest.minWeaveVersion}, current: ${this.weaveVersion}`;
        logger.warn(`[PluginLoader] Plugin ${manifest.id}: ${entry.error}`);
        return entry;
      }

      // 读取 main.js
      const mainPath = `${pluginDir}/main.js`;
      const adapter = this.host.app.vault.adapter;
      const mainExists = await adapter.exists(mainPath);
      if (!mainExists) {
        entry.state = 'error';
        entry.error = 'main.js not found';
        return entry;
      }

      const code = await adapter.read(mainPath);

      // 使用 new Function() 加载代码（桌面端 + 移动端 WebView 均可用）
      const instance = this.executePluginCode(code, manifest.id);
      if (!instance || typeof instance.onload !== 'function') {
        entry.state = 'error';
        entry.error = 'Plugin does not export onload function';
        return entry;
      }

      // 创建独立的 API 实例
      const api = new WeaveAPIImpl(
        manifest.id,
        this.weaveVersion,
        this.host,
        pluginDir,
        manifest.name
      );

      // 调用 onload
      await Promise.resolve(instance.onload(api));

      entry.instance = instance;
      entry.state = 'enabled';
      entry.loadedAt = new Date().toISOString();

      logger.info(`[PluginLoader] Plugin loaded: ${manifest.id} v${manifest.version}`);
      return entry;
    } catch (err) {
      entry.state = 'error';
      entry.error = err instanceof Error ? err.message : String(err);
      logger.error(`[PluginLoader] Failed to load plugin ${manifest.id}:`, err);
      return entry;
    }
  }

  /**
   * 卸载单个插件
   */
  async unloadPlugin(entry: PluginRegistryEntry): Promise<void> {
    if (!entry.instance) return;

    try {
      if (typeof entry.instance.onunload === 'function') {
        await Promise.resolve(entry.instance.onunload());
      }
    } catch (err) {
      logger.error(`[PluginLoader] Error unloading plugin ${entry.manifest.id}:`, err);
    }

    entry.instance = undefined;
    entry.state = 'disabled';
  }

  /**
   * 执行插件代码，返回插件实例
   */
  private executePluginCode(code: string, pluginId: string): WeavePluginInstance | null {
    try {
      const moduleObj = { exports: {} as any };
      const exportsObj = moduleObj.exports;

      // 构建沙箱化的 require（目前仅允许空实现，后续可扩展）
      const requireFn = (name: string) => {
        logger.warn(`[PluginLoader] Plugin ${pluginId} tried to require: ${name}`);
        return {};
      };

      const fn = new Function('module', 'exports', 'require', code);
      fn(moduleObj, exportsObj, requireFn);

      // 支持 module.exports = { onload, onunload } 或 exports.default = ...
      const result = moduleObj.exports.default || moduleObj.exports;
      return result as WeavePluginInstance;
    } catch (err) {
      logger.error(`[PluginLoader] Failed to execute plugin code for ${pluginId}:`, err);
      return null;
    }
  }

  /**
   * 简单版本兼容性检查
   */
  private isVersionCompatible(minVersion: string): boolean {
    try {
      const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
      const min = parse(minVersion);
      const cur = parse(this.weaveVersion);

      for (let i = 0; i < Math.max(min.length, cur.length); i++) {
        const m = min[i] || 0;
        const c = cur[i] || 0;
        if (c > m) return true;
        if (c < m) return false;
      }
      return true; // 相等也兼容
    } catch {
      return true; // 解析失败则放行
    }
  }
}
