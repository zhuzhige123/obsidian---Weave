import { logger } from '../../utils/logger';
/**
 * 网络请求优化器
 * 实现请求合并、连接池管理和智能重试机制
 */

// 请求配置
export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  cacheable?: boolean;
  batchable?: boolean;
  metadata?: Record<string, any>;
}

// 批量请求配置
export interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number; // 批量等待时间（毫秒）
  endpoint: string;
  mergeStrategy: 'array' | 'object' | 'custom';
  customMerger?: (requests: RequestConfig[]) => any;
}

// 连接池配置
export interface ConnectionPoolConfig {
  maxConnections: number;
  maxConnectionsPerHost: number;
  connectionTimeout: number;
  keepAliveTimeout: number;
  retryDelay: number;
  maxRetries: number;
}

// 请求结果
export interface RequestResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
  timing: {
    start: number;
    end: number;
    duration: number;
    retries: number;
  };
  fromCache?: boolean;
  batchId?: string;
}

// 网络统计
export interface NetworkStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  cacheHitRate: number;
  batchedRequests: number;
  retryCount: number;
  activeConnections: number;
  queuedRequests: number;
}

/**
 * 请求批量处理器
 */
export class RequestBatcher {
  private batches = new Map<string, BatchRequest[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private config: BatchConfig;

  constructor(config: BatchConfig) {
    this.config = config;
  }

  /**
   * 添加请求到批量处理队列
   */
  addRequest(request: RequestConfig): Promise<RequestResult> {
    if (!request.batchable) {
      throw new Error('请求不支持批量处理');
    }

    const batchKey = this.getBatchKey(request);
    
    return new Promise((resolve, reject) => {
      const batchRequest: BatchRequest = {
        request,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // 添加到批次
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, []);
      }
      
      const batch = this.batches.get(batchKey)!;
      batch.push(batchRequest);

      // 检查是否需要立即执行批次
      if (batch.length >= this.config.maxBatchSize) {
        this.executeBatch(batchKey);
      } else {
        // 设置定时器
        this.scheduleBatchExecution(batchKey);
      }
    });
  }

  /**
   * 执行批次请求
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // 清除定时器
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // 移除批次
    this.batches.delete(batchKey);

    logger.debug(`📦 执行批次请求: ${batchKey} (${batch.length} 个请求)`);

    try {
      // 合并请求
      const mergedRequest = this.mergeRequests(batch.map(b => b.request));
      
      // 执行合并后的请求
      const startTime = Date.now();
      const response = await this.executeRequest(mergedRequest);
      const endTime = Date.now();

      // 分发结果
      this.distributeResults(batch, response, startTime, endTime);

    } catch (error) {
      // 分发错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      batch.forEach(_batchRequest => {
        _batchRequest.reject(new Error(`批次请求失败: ${errorMessage}`));
      });
    }
  }

  /**
   * 合并请求
   */
  private mergeRequests(requests: RequestConfig[]): RequestConfig {
    const baseRequest = requests[0];
    
    switch (this.config.mergeStrategy) {
      case 'array':
        return {
          ...baseRequest,
          url: this.config.endpoint,
          method: 'POST',
          body: requests.map(r => r.body)
        };
        
      case 'object':
        return {
          ...baseRequest,
          url: this.config.endpoint,
          method: 'POST',
          body: {
            requests: requests.map(r => ({
              url: r.url,
              method: r.method,
              body: r.body
            }))
          }
        };
        
      case 'custom':
        if (this.config.customMerger) {
          return {
            ...baseRequest,
            url: this.config.endpoint,
            method: 'POST',
            body: this.config.customMerger(requests)
          };
        }
        // 回退到数组策略
        return this.mergeRequests(requests);
        
      default:
        throw new Error(`不支持的合并策略: ${this.config.mergeStrategy}`);
    }
  }

  /**
   * 分发结果
   */
  private distributeResults(
    batch: BatchRequest[],
    response: any,
    startTime: number,
    endTime: number
  ): void {
    const batchId = `batch-${Date.now()}`;
    
    // 简化实现：假设响应是数组，按顺序对应请求
    if (Array.isArray(response)) {
      batch.forEach((batchRequest, index) => {
        const result: RequestResult = {
          success: true,
          data: response[index],
          timing: {
            start: startTime,
            end: endTime,
            duration: endTime - startTime,
            retries: 0
          },
          batchId
        };
        batchRequest.resolve(result);
      });
    } else {
      // 所有请求返回相同结果
      const result: RequestResult = {
        success: true,
        data: response,
        timing: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime,
          retries: 0
        },
        batchId
      };
      
      batch.forEach(_batchRequest => {
        _batchRequest.resolve(result);
      });
    }
  }

  private getBatchKey(request: RequestConfig): string {
    // 简化实现：基于URL和方法生成批次键
    return `${request.method}-${request.url}`;
  }

  private scheduleBatchExecution(batchKey: string): void {
    if (this.batchTimers.has(batchKey)) return;

    const timer = setTimeout(() => {
      this.executeBatch(batchKey);
    }, this.config.batchTimeout);

    this.batchTimers.set(batchKey, timer);
  }

  private async executeRequest(request: RequestConfig): Promise<any> {
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, request.timeout || 5000);

      // 执行真实的 HTTP 请求
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 解析响应
      let data: any;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true, data };
    } catch (error) {
      throw new Error(`批次请求失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

interface BatchRequest {
  request: RequestConfig;
  resolve: (result: RequestResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * 连接池管理器
 */
export class ConnectionPoolManager {
  private config: ConnectionPoolConfig;
  private connections = new Map<string, Connection[]>();
  private activeConnections = new Set<string>();
  private requestQueue: QueuedRequest[] = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private stats: NetworkStats;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.config = {
      maxConnections: 10,
      maxConnectionsPerHost: 4,
      connectionTimeout: 30000,
      keepAliveTimeout: 60000,
      retryDelay: 1000,
      maxRetries: 3,
      ...config
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      batchedRequests: 0,
      retryCount: 0,
      activeConnections: 0,
      queuedRequests: 0
    };

    this.startConnectionCleanup();
  }

  /**
   * 执行请求
   */
  async executeRequest(request: RequestConfig): Promise<RequestResult> {
    this.stats.totalRequests++;
    
    const host = this.extractHost(request.url);
    const connection = await this.acquireConnection(host);
    
    try {
      const result = await this.performRequest(connection, request);
      this.stats.successfulRequests++;
      this.updateLatencyStats(result.timing.duration);
      return result;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * 获取连接
   */
  private async acquireConnection(host: string): Promise<Connection> {
    // 检查是否有可用连接
    const hostConnections = this.connections.get(host) || [];
    const availableConnection = hostConnections.find(conn => !conn.inUse && !conn.expired);
    
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      return availableConnection;
    }

    // 检查连接数限制
    if (this.activeConnections.size >= this.config.maxConnections ||
        hostConnections.length >= this.config.maxConnectionsPerHost) {
      
      // 等待连接可用
      return this.waitForConnection(host);
    }

    // 创建新连接
    return this.createConnection(host);
  }

  /**
   * 创建新连接
   */
  private createConnection(host: string): Connection {
    const connectionId = `conn-${host}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const connection: Connection = {
      id: connectionId,
      host,
      inUse: true,
      created: Date.now(),
      lastUsed: Date.now(),
      expired: false,
      requestCount: 0
    };

    // 添加到连接池
    if (!this.connections.has(host)) {
      this.connections.set(host, []);
    }
    this.connections.get(host)?.push(connection);
    this.activeConnections.add(connectionId);

    logger.debug(`🔗 创建新连接: ${connectionId} (${host})`);
    return connection;
  }

  /**
   * 等待连接可用
   */
  private async waitForConnection(host: string): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        host,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.requestQueue.push(queuedRequest);
      this.stats.queuedRequests++;

      // 设置超时
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queuedRequest);
        if (index > -1) {
          this.requestQueue.splice(index, 1);
          this.stats.queuedRequests--;
          reject(new Error('连接获取超时'));
        }
      }, this.config.connectionTimeout);
    });
  }

  /**
   * 释放连接
   */
  private releaseConnection(connection: Connection): void {
    connection.inUse = false;
    connection.lastUsed = Date.now();
    connection.requestCount++;

    // 检查是否有等待的请求
    const queuedIndex = this.requestQueue.findIndex(req => req.host === connection.host);
    if (queuedIndex > -1) {
      const queuedRequest = this.requestQueue.splice(queuedIndex, 1)[0];
      this.stats.queuedRequests--;
      
      connection.inUse = true;
      queuedRequest.resolve(connection);
    }
  }

  /**
   * 执行实际请求
   */
  private async performRequest(_connection: Connection, request: RequestConfig): Promise<RequestResult> {
    const startTime = Date.now();
    let retries = 0;
    const maxRetries = request.retries || this.config.maxRetries;

    while (retries <= maxRetries) {
      try {
        // 创建 AbortController 用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, request.timeout || this.config.connectionTimeout);

        // 执行真实的 HTTP 请求
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 解析响应
        let data: any;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        const endTime = Date.now();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          success: true,
          data,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          timing: {
            start: startTime,
            end: endTime,
            duration: endTime - startTime,
            retries
          }
        };

      } catch (error) {
        retries++;
        this.stats.retryCount++;

        if (retries > maxRetries) {
          const endTime = Date.now();
          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            success: false,
            error: errorMessage,
            timing: {
              start: startTime,
              end: endTime,
              duration: endTime - startTime,
              retries
            }
          };
        }

        // 指数退避
        const delay = this.config.retryDelay * 2 ** (retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('不应该到达这里');
  }

  /**
   * 启动连接清理
   */
  private startConnectionCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredConnections();
    }, 30000); // 每30秒清理一次
  }

  /**
   * 清理过期连接
   */
  private cleanupExpiredConnections(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [host, connections] of this.connections) {
      const validConnections = connections.filter(_conn => {
        const isExpired = !_conn.inUse && (now - _conn.lastUsed) > this.config.keepAliveTimeout;
        
        if (isExpired) {
          this.activeConnections.delete(_conn.id);
          cleanedCount++;
          return false;
        }
        
        return true;
      });

      this.connections.set(host, validConnections);
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 清理了 ${cleanedCount} 个过期连接`);
    }

    this.stats.activeConnections = this.activeConnections.size;
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'localhost';
    }
  }

  private updateLatencyStats(latency: number): void {
    const totalRequests = this.stats.successfulRequests;
    this.stats.averageLatency = (this.stats.averageLatency * (totalRequests - 1) + latency) / totalRequests;
  }

  /**
   * 获取网络统计
   */
  getStats(): NetworkStats {
    this.stats.activeConnections = this.activeConnections.size;
    this.stats.queuedRequests = this.requestQueue.length;
    return { ...this.stats };
  }

  /**
   * 销毁连接池
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 清理所有连接
    this.connections.clear();
    this.activeConnections.clear();
    this.requestQueue.length = 0;
    
    logger.debug('🗑️ 连接池已销毁');
  }
}

interface Connection {
  id: string;
  host: string;
  inUse: boolean;
  created: number;
  lastUsed: number;
  expired: boolean;
  requestCount: number;
}

interface QueuedRequest {
  host: string;
  resolve: (connection: Connection) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * 网络优化器
 */
export class NetworkOptimizer {
  private connectionPool: ConnectionPoolManager;
  private requestBatcher: RequestBatcher;
  private requestCache = new Map<string, CachedResponse>();
  private cacheCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private cacheConfig = {
    maxSize: 1000,
    ttl: 300000 // 5分钟
  };

  constructor(
    connectionConfig?: Partial<ConnectionPoolConfig>,
    batchConfig?: BatchConfig
  ) {
    this.connectionPool = new ConnectionPoolManager(connectionConfig);
    
    if (batchConfig) {
      this.requestBatcher = new RequestBatcher(batchConfig);
    } else {
      // 默认批量配置
      this.requestBatcher = new RequestBatcher({
        maxBatchSize: 10,
        batchTimeout: 100,
        endpoint: '/api/batch',
        mergeStrategy: 'array'
      });
    }

    this.startCacheCleanup();
  }

  /**
   * 执行优化的请求
   */
  async request<T = any>(config: RequestConfig): Promise<RequestResult<T>> {
    // 检查缓存
    if (config.cacheable) {
      const cached = this.getFromCache(config);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          timing: {
            start: Date.now(),
            end: Date.now(),
            duration: 0,
            retries: 0
          },
          fromCache: true
        };
      }
    }

    // 批量处理
    if (config.batchable) {
      const result = await this.requestBatcher.addRequest(config);
      
      // 缓存结果
      if (config.cacheable && result.success) {
        this.addToCache(config, result.data);
      }
      
      return result;
    }

    // 直接请求
    const result = await this.connectionPool.executeRequest(config);
    
    // 缓存结果
    if (config.cacheable && result.success) {
      this.addToCache(config, result.data);
    }
    
    return result;
  }

  /**
   * 批量请求
   */
  async batchRequest<T = any>(configs: RequestConfig[]): Promise<RequestResult<T>[]> {
    const promises = configs.map(config => this.request<T>(config));
    return Promise.all(promises);
  }

  /**
   * 获取网络统计
   */
  getNetworkStats(): NetworkStats {
    const stats = this.connectionPool.getStats();
    stats.cacheHitRate = this.calculateCacheHitRate();
    return stats;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.requestCache.clear();
    logger.debug('🧹 请求缓存已清理');
  }

  /**
   * 销毁优化器
   */
  destroy(): void {
    this.connectionPool.destroy();
    this.requestCache.clear();

    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }
  }

  // 私有方法

  private getFromCache(config: RequestConfig): CachedResponse | null {
    const key = this.getCacheKey(config);
    const cached = this.requestCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheConfig.ttl) {
      cached.hitCount++;
      return cached;
    }
    
    if (cached) {
      this.requestCache.delete(key);
    }
    
    return null;
  }

  private addToCache(config: RequestConfig, data: any): void {
    if (this.requestCache.size >= this.cacheConfig.maxSize) {
      // 清理最旧的缓存项
      const oldestKey = Array.from(this.requestCache.keys())[0];
      this.requestCache.delete(oldestKey);
    }

    const key = this.getCacheKey(config);
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  private getCacheKey(config: RequestConfig): string {
    return `${config.method}-${config.url}-${JSON.stringify(config.body || {})}`;
  }

  private calculateCacheHitRate(): number {
    if (this.requestCache.size === 0) return 0;
    
    const totalHits = Array.from(this.requestCache.values())
      .reduce((sum, cached) => sum + cached.hitCount, 0);
    
    return totalHits / this.requestCache.size;
  }

  private startCacheCleanup(): void {
    if (this.cacheCleanupTimer) return;
    this.cacheCleanupTimer = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const [key, cached] of this.requestCache) {
        if (now - cached.timestamp > this.cacheConfig.ttl) {
          expiredKeys.push(key);
        }
      }
      
      expiredKeys.forEach(key => this.requestCache.delete(key));
      
      if (expiredKeys.length > 0) {
        logger.debug(`🧹 清理了 ${expiredKeys.length} 个过期缓存项`);
      }
    }, 60000); // 每分钟清理一次
  }
}

interface CachedResponse {
  data: any;
  timestamp: number;
  hitCount: number;
}
