/**
 * Weave 全局事件总线
 * 用于插件系统的事件通信，支持防循环触发
 */

import { logger } from '../utils/logger';
import type { WeavePluginEvents, WeavePluginEventName } from '../types/weave-plugin-types';

type EventHandler<T = any> = (data: T) => void | Promise<void>;

interface Subscription {
  id: string;
  handler: EventHandler;
  pluginId?: string;
}

const MAX_REENTRY_DEPTH = 10;

export class WeaveEventBus {
  private listeners = new Map<string, Subscription[]>();
  private subCounter = 0;
  private emitDepth = 0;
  private isDestroyed = false;

  on<K extends WeavePluginEventName>(
    event: K,
    handler: EventHandler<WeavePluginEvents[K]>,
    pluginId?: string
  ): () => void {
    if (this.isDestroyed) {
      logger.warn('[WeaveEventBus] Cannot subscribe to destroyed event bus');
      return () => {};
    }

    const sub: Subscription = {
      id: `tsub_${++this.subCounter}`,
      handler,
      pluginId
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(sub);

    return () => this.off(event, sub.id);
  }

  off(event: string, subId: string): void {
    const subs = this.listeners.get(event);
    if (!subs) return;
    const idx = subs.findIndex(s => s.id === subId);
    if (idx !== -1) subs.splice(idx, 1);
    if (subs.length === 0) this.listeners.delete(event);
  }

  async emit<K extends WeavePluginEventName>(
    event: K,
    data: WeavePluginEvents[K]
  ): Promise<void> {
    if (this.isDestroyed) return;

    if (this.emitDepth >= MAX_REENTRY_DEPTH) {
      logger.warn(`[WeaveEventBus] Max reentry depth reached for event: ${event}`);
      return;
    }

    const subs = this.listeners.get(event);
    if (!subs || subs.length === 0) return;

    // 防循环：提取 triggeredByPlugin
    const triggeredBy = (data as any)?.triggeredByPlugin as string | undefined;

    this.emitDepth++;
    try {
      for (const sub of [...subs]) {
        // 同一插件触发的变更不再回调自身
        if (triggeredBy && sub.pluginId === triggeredBy) {
          continue;
        }
        try {
          const result = sub.handler(data);
          if (result instanceof Promise) {
            await result;
          }
        } catch (err) {
          logger.error(
            `[WeaveEventBus] Error in handler for ${event} (plugin: ${sub.pluginId || 'core'}):`,
            err
          );
        }
      }
    } finally {
      this.emitDepth--;
    }
  }

  emitSync<K extends WeavePluginEventName>(
    event: K,
    data: WeavePluginEvents[K]
  ): void {
    this.emit(event, data).catch(err => {
      logger.error(`[WeaveEventBus] Error in sync emit for ${event}:`, err);
    });
  }

  getListenerCount(event?: string): number {
    if (event) {
      return this.listeners.get(event)?.length ?? 0;
    }
    let total = 0;
    for (const subs of this.listeners.values()) {
      total += subs.length;
    }
    return total;
  }

  removePluginListeners(pluginId: string): void {
    for (const [event, subs] of this.listeners.entries()) {
      const filtered = subs.filter(s => s.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  destroy(): void {
    this.listeners.clear();
    this.isDestroyed = true;
  }

  get destroyed(): boolean {
    return this.isDestroyed;
  }
}

// 全局单例
export const weaveEventBus = new WeaveEventBus();
