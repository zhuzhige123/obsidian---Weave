/**
 * 请求合并器
 * 
 * 合并短时间内的多个焦点恢复请求，避免频繁调用 setActiveLeaf。
 * 使用 requestAnimationFrame 进行延迟，确保在下一帧执行。
 */

import type { IRequestCoalescer } from './types';
import { logger } from '../logger';

interface PendingRequest {
  action: () => void;
  rafId: number | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * 请求合并器实现
 */
export class RequestCoalescer implements IRequestCoalescer {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private debounceMs: number;
  private debugMode: boolean;

  constructor(debounceMs = 100, debugMode = false) {
    this.debounceMs = debounceMs;
    this.debugMode = debugMode;
  }

  /**
   * 调度一个操作
   * 相同 key 的操作会被合并，只执行最后一个
   */
  schedule(action: () => void, key: string): void {
    // 取消之前的同 key 请求
    this.cancel(key);

    if (this.debugMode) {
      logger.debug('[RequestCoalescer] 调度请求:', key);
    }

    // 使用 setTimeout + requestAnimationFrame 双重延迟
    // setTimeout 提供 debounce，requestAnimationFrame 确保在渲染帧执行
    const timeoutId = setTimeout(() => {
      const rafId = requestAnimationFrame(() => {
        const request = this.pendingRequests.get(key);
        if (request) {
          this.pendingRequests.delete(key);
          
          if (this.debugMode) {
            logger.debug('[RequestCoalescer] 执行请求:', key);
          }
          
          try {
            action();
          } catch (error) {
            logger.error('[RequestCoalescer] 执行请求失败:', key, error);
          }
        }
      });

      // 更新 rafId
      const request = this.pendingRequests.get(key);
      if (request) {
        request.rafId = rafId;
      }
    }, this.debounceMs);

    this.pendingRequests.set(key, {
      action,
      rafId: null,
      timeoutId
    });
  }

  /**
   * 取消指定 key 的操作
   */
  cancel(key: string): void {
    const request = this.pendingRequests.get(key);
    if (request) {
      if (request.timeoutId !== null) {
        clearTimeout(request.timeoutId);
      }
      if (request.rafId !== null) {
        cancelAnimationFrame(request.rafId);
      }
      this.pendingRequests.delete(key);

      if (this.debugMode) {
        logger.debug('[RequestCoalescer] 取消请求:', key);
      }
    }
  }

  /**
   * 立即执行所有待处理的操作
   */
  flush(): void {
    if (this.debugMode) {
      logger.debug('[RequestCoalescer] 刷新所有请求，数量:', this.pendingRequests.size);
    }

    const requests = Array.from(this.pendingRequests.entries());
    
    // 先清理所有定时器
    for (const [key, request] of requests) {
      if (request.timeoutId !== null) {
        clearTimeout(request.timeoutId);
      }
      if (request.rafId !== null) {
        cancelAnimationFrame(request.rafId);
      }
    }

    // 清空 map
    this.pendingRequests.clear();

    // 执行所有操作
    for (const [key, request] of requests) {
      try {
        request.action();
        if (this.debugMode) {
          logger.debug('[RequestCoalescer] 刷新执行:', key);
        }
      } catch (error) {
        logger.error('[RequestCoalescer] 刷新执行失败:', key, error);
      }
    }
  }

  /**
   * 设置防抖时间
   */
  setDebounceMs(ms: number): void {
    this.debounceMs = ms;
  }

  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * 获取待处理请求数量
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * 清理所有待处理请求（不执行）
   */
  clear(): void {
    for (const [, request] of this.pendingRequests) {
      if (request.timeoutId !== null) {
        clearTimeout(request.timeoutId);
      }
      if (request.rafId !== null) {
        cancelAnimationFrame(request.rafId);
      }
    }
    this.pendingRequests.clear();

    if (this.debugMode) {
      logger.debug('[RequestCoalescer] 清理所有请求');
    }
  }
}
