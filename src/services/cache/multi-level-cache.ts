import { logger } from '../../utils/logger';
/**
 * 多层缓存管理器
 * 实现L1内存缓存、L2 IndexedDB缓存和L3持久化缓存的多层架构
 */

// 缓存条目接口
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size?: number;
  metadata?: Record<string, any>;
}

// 缓存选项
export interface CacheOptions {
  ttl?: number; // 生存时间（毫秒）
  persistent?: boolean; // 是否持久化到L3
  priority?: 'low' | 'normal' | 'high'; // 缓存优先级
  compress?: boolean; // 是否压缩存储
  metadata?: Record<string, any>; // 附加元数据
}

// 缓存统计信息
export interface CacheStats {
  l1: {
    size: number;
    memoryUsage: number;
    hitCount: number;
    missCount: number;
  };
  l2: {
    size: number;
    storageUsage: number;
    hitCount: number;
    missCount: number;
  };
  l3: {
    size: number;
    storageUsage: number;
    hitCount: number;
    missCount: number;
  };
  overall: {
    hitRate: number;
    totalRequests: number;
    averageLatency: number;
  };
}

/**
 * IndexedDB 缓存实现
 */
export class IndexedDBCache {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName = 'weave-cache', storeName = 'cache-store') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            data: result.data,
            timestamp: result.timestamp,
            ttl: result.ttl,
            accessCount: result.accessCount,
            lastAccessed: result.lastAccessed,
            size: result.size,
            metadata: result.metadata
          });
        } else {
          resolve(null);
        }
      };
    });
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({
        key,
        ...entry
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }
}

/**
 * 持久化存储缓存实现
 */
export class PersistentStorageCache {
  private storageKey: string;

  constructor(storageKey = 'weave-persistent-cache') {
    this.storageKey = storageKey;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const stored = localStorage.getItem(`${this.storageKey}:${key}`);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      logger.warn('持久化缓存读取失败:', error);
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      localStorage.setItem(`${this.storageKey}:${key}`, JSON.stringify(entry));
    } catch (error) {
      logger.warn('持久化缓存写入失败:', error);
      // 如果存储空间不足，清理一些旧数据
      await this.cleanup();
      try {
        localStorage.setItem(`${this.storageKey}:${key}`, JSON.stringify(entry));
      } catch (retryError) {
        logger.error('持久化缓存写入重试失败:', retryError);
      }
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(`${this.storageKey}:${key}`);
  }

  async clear(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.storageKey));
    keys.forEach(key => localStorage.removeItem(key));
  }

  async getAllKeys(): Promise<string[]> {
    return Object.keys(localStorage)
      .filter(key => key.startsWith(`${this.storageKey}:`))
      .map(key => key.replace(`${this.storageKey}:`, ''));
  }

  private async cleanup(): Promise<void> {
    const keys = await this.getAllKeys();
    const entries: Array<{ key: string; lastAccessed: number }> = [];

    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        entries.push({ key, lastAccessed: entry.lastAccessed });
      }
    }

    // 删除最旧的25%条目
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    const toDelete = entries.slice(0, Math.floor(entries.length * 0.25));
    
    for (const { key } of toDelete) {
      await this.delete(key);
    }
  }
}

/**
 * 多层缓存管理器
 */
export class MultiLevelCacheManager {
  private l1Cache = new Map<string, CacheEntry<any>>(); // 内存缓存
  private l2Cache: IndexedDBCache; // IndexedDB缓存
  private l3Cache: PersistentStorageCache; // 持久化缓存

  private stats: CacheStats = {
    l1: { size: 0, memoryUsage: 0, hitCount: 0, missCount: 0 },
    l2: { size: 0, storageUsage: 0, hitCount: 0, missCount: 0 },
    l3: { size: 0, storageUsage: 0, hitCount: 0, missCount: 0 },
    overall: { hitRate: 0, totalRequests: 0, averageLatency: 0 }
  };

  private config = {
    l1MaxSize: 100,
    l1MaxMemory: 50 * 1024 * 1024, // 50MB
    l2MaxSize: 500,
    l3MaxSize: 1000,
    defaultTTL: 3600000, // 1小时
    cleanupInterval: 300000 // 5分钟
  };

  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<typeof MultiLevelCacheManager.prototype.config>) {
    this.config = { ...this.config, ...config };
    this.l2Cache = new IndexedDBCache();
    this.l3Cache = new PersistentStorageCache();
    this.startCleanupTimer();
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    this.stats.overall.totalRequests++;

    try {
      // L1: 内存缓存检查
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && !this.isExpired(l1Entry)) {
        this.updateAccessTime(l1Entry);
        this.stats.l1.hitCount++;
        this.updateLatency(Date.now() - startTime);
        return l1Entry.data;
      }
      if (l1Entry) {
        this.l1Cache.delete(key);
      }

      // L2: IndexedDB缓存检查
      const l2Entry = await this.l2Cache.get<T>(key);
      if (l2Entry && !this.isExpired(l2Entry)) {
        this.updateAccessTime(l2Entry);
        this.l1Cache.set(key, l2Entry); // 提升到L1
        this.stats.l2.hitCount++;
        this.updateLatency(Date.now() - startTime);
        return l2Entry.data;
      }
      if (l2Entry) {
        await this.l2Cache.delete(key);
      }

      // L3: 持久化缓存检查
      if (options.persistent !== false) {
        const l3Entry = await this.l3Cache.get<T>(key);
        if (l3Entry && !this.isExpired(l3Entry)) {
          this.updateAccessTime(l3Entry);
          this.l1Cache.set(key, l3Entry); // 提升到L1
          await this.l2Cache.set(key, l3Entry); // 提升到L2
          this.stats.l3.hitCount++;
          this.updateLatency(Date.now() - startTime);
          return l3Entry.data;
        }
        if (l3Entry) {
          await this.l3Cache.delete(key);
        }
      }

      // 所有层级都未命中
      this.stats.l1.missCount++;
      this.stats.l2.missCount++;
      if (options.persistent !== false) {
        this.stats.l3.missCount++;
      }
      this.updateLatency(Date.now() - startTime);
      return null;

    } catch (error) {
      logger.error('缓存获取失败:', error);
      this.updateLatency(Date.now() - startTime);
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: Date.now(),
      size: this.estimateSize(data),
      metadata: options.metadata
    };

    try {
      // 写入L1缓存
      this.l1Cache.set(key, entry);
      this.enforceL1Limits();

      // 异步写入其他层级
      const writePromises: Promise<void>[] = [];

      // 写入L2缓存
      writePromises.push(
        this.l2Cache.set(key, entry).catch(_error => {
          logger.warn('L2缓存写入失败:', _error);
        })
      );

      // 写入L3缓存（如果需要持久化）
      if (options.persistent !== false) {
        writePromises.push(
          this.l3Cache.set(key, entry).catch(_error => {
            logger.warn('L3缓存写入失败:', _error);
          })
        );
      }

      // 等待所有写入完成（但不阻塞主流程）
      Promise.all(writePromises).catch(_error => {
        logger.warn('缓存写入部分失败:', _error);
      });

    } catch (error) {
      logger.error('缓存设置失败:', error);
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    
    // 异步删除其他层级
    Promise.all([
      this.l2Cache.delete(key).catch(() => {}),
      this.l3Cache.delete(key).catch(() => {})
    ]);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    
    await Promise.all([
      this.l2Cache.clear().catch(() => {}),
      this.l3Cache.clear().catch(() => {})
    ]);

    this.resetStats();
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    // 更新L1统计
    this.stats.l1.size = this.l1Cache.size;
    this.stats.l1.memoryUsage = Array.from(this.l1Cache.values())
      .reduce((sum, entry) => sum + (entry.size || 0), 0);

    // 计算总体命中率
    const totalHits = this.stats.l1.hitCount + this.stats.l2.hitCount + this.stats.l3.hitCount;
    const totalMisses = this.stats.l1.missCount + this.stats.l2.missCount + this.stats.l3.missCount;
    this.stats.overall.hitRate = totalHits / (totalHits + totalMisses) || 0;

    return { ...this.stats };
  }

  /**
   * 预热缓存
   */
  async warmup<T>(entries: Array<{ key: string; data: T; options?: CacheOptions }>): Promise<void> {
    logger.debug(`🔥 开始缓存预热: ${entries.length} 个条目`);

    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(({ key, data, options }) => 
          this.set(key, data, options).catch(_error => {
            logger.warn(`预热失败 ${key}:`, _error);
          })
        )
      );
    }

    logger.debug('✅ 缓存预热完成');
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.l1Cache.clear();
  }

  // 私有方法

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateAccessTime(entry: CacheEntry<any>): void {
    entry.lastAccessed = Date.now();
    entry.accessCount++;
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 粗略估算
    } catch {
      return 1024; // 默认1KB
    }
  }

  private enforceL1Limits(): void {
    // 检查大小限制
    if (this.l1Cache.size > this.config.l1MaxSize) {
      this.evictLRU();
    }

    // 检查内存限制
    const memoryUsage = Array.from(this.l1Cache.values())
      .reduce((sum, entry) => sum + (entry.size || 0), 0);
    
    if (memoryUsage > this.config.l1MaxMemory) {
      this.evictLargest();
    }
  }

  private evictLRU(): void {
    const entries = Array.from(this.l1Cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const toEvict = Math.ceil(this.l1Cache.size * 0.1); // 清理10%
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.l1Cache.delete(entries[i][0]);
    }
  }

  private evictLargest(): void {
    const entries = Array.from(this.l1Cache.entries())
      .sort((a, b) => (b[1].size || 0) - (a[1].size || 0));
    
    let freedMemory = 0;
    const targetFree = this.config.l1MaxMemory * 0.2; // 释放20%内存
    
    for (const [key, entry] of entries) {
      if (freedMemory >= targetFree) break;
      this.l1Cache.delete(key);
      freedMemory += entry.size || 0;
    }
  }

  private updateLatency(latency: number): void {
    const currentAvg = this.stats.overall.averageLatency;
    const totalRequests = this.stats.overall.totalRequests;
    
    this.stats.overall.averageLatency = 
      (currentAvg * (totalRequests - 1) + latency) / totalRequests;
  }

  private resetStats(): void {
    this.stats = {
      l1: { size: 0, memoryUsage: 0, hitCount: 0, missCount: 0 },
      l2: { size: 0, storageUsage: 0, hitCount: 0, missCount: 0 },
      l3: { size: 0, storageUsage: 0, hitCount: 0, missCount: 0 },
      overall: { hitRate: 0, totalRequests: 0, averageLatency: 0 }
    };
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    // 清理过期的L1条目
    const _now = Date.now();
    for (const [key, entry] of this.l1Cache) {
      if (this.isExpired(entry)) {
        this.l1Cache.delete(key);
      }
    }
  }
}

/**
 * 缓存性能监控器
 */
export class CachePerformanceMonitor {
  private metrics = new Map<string, number[]>();

  recordLatency(operation: string, latency: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const latencies = this.metrics.get(operation)!;
    latencies.push(latency);

    // 保持最近1000个记录
    if (latencies.length > 1000) {
      latencies.splice(0, latencies.length - 1000);
    }
  }

  getPerformanceReport(): Record<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  }> {
    const report: Record<string, any> = {};

    for (const [operation, latencies] of this.metrics) {
      if (latencies.length === 0) continue;

      const sorted = [...latencies].sort((a, b) => a - b);

      report[operation] = {
        count: latencies.length,
        average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }

    return report;
  }
}
