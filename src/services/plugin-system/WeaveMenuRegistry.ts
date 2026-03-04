/**
 * WeaveMenuRegistry - 全局菜单注册表
 * 管理第三方插件注册的菜单项 + 已安装插件列表，供 SidebarNavHeader 消费
 */

import type {
  WeaveMenuRegistry,
  WeaveMenuRegistration
} from '../../types/weave-plugin-types';

export interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  state: string; // 'enabled' | 'disabled' | 'error'
  configurable: boolean;
}

class WeaveMenuRegistryImpl implements WeaveMenuRegistry {
  private registrations = new Map<string, WeaveMenuRegistration>();
  private installedPlugins: InstalledPluginInfo[] = [];
  private listeners = new Set<() => void>();

  register(registration: WeaveMenuRegistration): void {
    this.registrations.set(registration.pluginId, registration);
    this.notify();
  }

  unregister(pluginId: string): void {
    if (this.registrations.delete(pluginId)) {
      this.notify();
    }
  }

  getAll(): WeaveMenuRegistration[] {
    return Array.from(this.registrations.values());
  }

  setInstalledPlugins(plugins: InstalledPluginInfo[]): void {
    this.installedPlugins = plugins;
    this.notify();
  }

  getInstalledPlugins(): InstalledPluginInfo[] {
    return this.installedPlugins;
  }

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  clear(): void {
    this.registrations.clear();
    this.installedPlugins = [];
    this.notify();
  }

  private notify(): void {
    for (const cb of this.listeners) {
      try { cb(); } catch { /* ignore */ }
    }
  }
}

export const WeaveMenuRegistry = new WeaveMenuRegistryImpl();
