import { logger } from '../../utils/logger';
/**
 * 智能错误处理和恢复机制
 * 提供自动错误检测、智能恢复策略和用户友好的错误提示
 */

import { writable, derived, type Writable } from 'svelte/store';

// 错误类型枚举
export enum ErrorType {
  NETWORK = 'network',
  PERMISSION = 'permission',
  DATA_CORRUPTION = 'data_corruption',
  TEMPLATE_ERROR = 'template_error',
  SYNC_CONFLICT = 'sync_conflict',
  MEMORY_LIMIT = 'memory_limit',
  UNKNOWN = 'unknown'
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 恢复策略类型
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  RESET = 'reset',
  MANUAL = 'manual',
  IGNORE = 'ignore'
}

// 错误信息接口
export interface ErrorInfo {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  timestamp: number;
  context?: Record<string, any>;
  stackTrace?: string;
  recoveryStrategy?: RecoveryStrategy;
  retryCount: number;
  maxRetries: number;
  resolved: boolean;
  userNotified: boolean;
}

// 恢复操作接口
export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  action: () => Promise<boolean>;
  automatic: boolean;
  priority: number;
}

// 错误统计接口
export interface ErrorStats {
  totalErrors: number;
  resolvedErrors: number;
  criticalErrors: number;
  errorsByType: Record<ErrorType, number>;
  averageResolutionTime: number;
  successRate: number;
}

/**
 * 智能错误处理和恢复服务
 */
export class ErrorRecoveryService {
  private errors = new Map<string, Writable<ErrorInfo>>();
  private recoveryActions = new Map<string, RecoveryAction[]>();
  private config = {
    maxRetries: 3,
    retryDelay: 1000,
    autoRecoveryEnabled: true,
    notificationThreshold: ErrorSeverity.MEDIUM,
    maxErrorHistory: 100
  };

  // 全局状态存储
  public readonly activeErrors = writable<Map<string, ErrorInfo>>(new Map());
  public readonly errorHistory = writable<ErrorInfo[]>([]);
  public readonly isRecovering = writable<boolean>(false);

  // 计算属性
  public readonly errorStats = derived(
    [this.activeErrors, this.errorHistory],
    ([active, history]) => this.calculateStats(active, history)
  );

  public readonly criticalErrors = derived(
    this.activeErrors,
    ($errors) => Array.from($errors.values()).filter(e => e.severity === ErrorSeverity.CRITICAL)
  );

  constructor() {
    this.initializeRecoveryActions();
  }

  /**
   * 报告错误
   */
  reportError(
    type: ErrorType,
    message: string,
    details?: string,
    context?: Record<string, any>,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): string {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorInfo: ErrorInfo = {
      id: errorId,
      type,
      severity,
      message,
      details,
      timestamp: Date.now(),
      context,
      stackTrace: new Error().stack,
      recoveryStrategy: this.determineRecoveryStrategy(type, severity),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      resolved: false,
      userNotified: false
    };

    const errorStore = writable(errorInfo);
    this.errors.set(errorId, errorStore);

    // 更新活跃错误列表
    this.updateActiveErrors();

    // 记录错误日志
    this.logError(errorInfo);

    // 尝试自动恢复
    if (this.config.autoRecoveryEnabled && severity !== ErrorSeverity.CRITICAL) {
      this.attemptAutoRecovery(errorId);
    }

    // 发送用户通知
    if (severity >= this.config.notificationThreshold) {
      this.notifyUser(errorInfo);
    }

    return errorId;
  }

  /**
   * 手动触发恢复
   */
  async triggerRecovery(errorId: string, actionId?: string): Promise<boolean> {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) {
      logger.warn(`错误不存在: ${errorId}`);
      return false;
    }

    this.isRecovering.set(true);

    try {
      let success = false;

      if (actionId) {
        // 执行指定的恢复操作
        success = await this.executeRecoveryAction(errorId, actionId);
      } else {
        // 执行自动恢复
        success = await this.attemptAutoRecovery(errorId);
      }

      if (success) {
        this.resolveError(errorId);
      }

      return success;
    } finally {
      this.isRecovering.set(false);
    }
  }

  /**
   * 解决错误
   */
  resolveError(errorId: string): void {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) return;

    errorStore.update(_error => ({
      ..._error,
      resolved: true,
      timestamp: Date.now()
    }));

    // 移动到历史记录
    this.moveToHistory(errorId);
    
    logger.debug(`✅ 错误已解决: ${errorId}`);
  }

  /**
   * 忽略错误
   */
  ignoreError(errorId: string): void {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) return;

    errorStore.update(_error => ({
      ..._error,
      resolved: true,
      recoveryStrategy: RecoveryStrategy.IGNORE
    }));

    this.moveToHistory(errorId);
    logger.debug(`🔇 错误已忽略: ${errorId}`);
  }

  /**
   * 获取错误的恢复操作
   */
  getRecoveryActions(errorId: string): RecoveryAction[] {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) return [];

    let errorType: ErrorType;
    const unsubscribe = errorStore.subscribe(_error => {
      errorType = _error.type;
    });
    unsubscribe();

    return this.recoveryActions.get(errorType!) || [];
  }

  /**
   * 清理已解决的错误
   */
  cleanupResolvedErrors(): void {
    const resolvedErrors: string[] = [];

    for (const [errorId, errorStore] of this.errors) {
      let isResolved = false;
      const unsubscribe = errorStore.subscribe(_error => {
        isResolved = _error.resolved;
      });
      unsubscribe();

      if (isResolved) {
        resolvedErrors.push(errorId);
      }
    }

    resolvedErrors.forEach(_errorId => {
      this.moveToHistory(_errorId);
    });

    logger.debug(`🧹 清理了 ${resolvedErrors.length} 个已解决的错误`);
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): ErrorStats {
    let stats: ErrorStats;
    const unsubscribe = this.errorStats.subscribe(_value => {
      stats = _value;
    });
    unsubscribe();
    return stats!;
  }

  // 私有方法

  /**
   * 初始化恢复操作
   */
  private initializeRecoveryActions(): void {
    // 网络错误恢复操作
    this.recoveryActions.set(ErrorType.NETWORK, [
      {
        id: 'retry-connection',
        name: '重试连接',
        description: '尝试重新建立网络连接',
        icon: '🔄',
        action: async () => this.retryNetworkConnection(),
        automatic: true,
        priority: 1
      },
      {
        id: 'check-network',
        name: '检查网络',
        description: '检查网络连接状态',
        icon: '🌐',
        action: async () => this.checkNetworkStatus(),
        automatic: false,
        priority: 2
      }
    ]);

    // 权限错误恢复操作
    this.recoveryActions.set(ErrorType.PERMISSION, [
      {
        id: 'request-permission',
        name: '请求权限',
        description: '重新请求必要的权限',
        icon: '🔐',
        action: async () => this.requestPermissions(),
        automatic: false,
        priority: 1
      }
    ]);

    // 数据损坏恢复操作
    this.recoveryActions.set(ErrorType.DATA_CORRUPTION, [
      {
        id: 'restore-backup',
        name: '恢复备份',
        description: '从最近的备份恢复数据',
        icon: '💾',
        action: async () => this.restoreFromBackup(),
        automatic: false,
        priority: 1
      },
      {
        id: 'repair-data',
        name: '修复数据',
        description: '尝试自动修复损坏的数据',
        icon: '🔧',
        action: async () => this.repairCorruptedData(),
        automatic: true,
        priority: 2
      }
    ]);

    // 模板错误恢复操作
    this.recoveryActions.set(ErrorType.TEMPLATE_ERROR, [
      {
        id: 'reset-template',
        name: '重置模板',
        description: '重置为默认模板',
        icon: '🔄',
        action: async () => this.resetToDefaultTemplate(),
        automatic: false,
        priority: 1
      },
      {
        id: 'validate-template',
        name: '验证模板',
        description: '检查并修复模板语法',
        icon: '✅',
        action: async () => this.validateTemplate(),
        automatic: true,
        priority: 2
      }
    ]);

    // 同步冲突恢复操作
    this.recoveryActions.set(ErrorType.SYNC_CONFLICT, [
      {
        id: 'merge-changes',
        name: '合并更改',
        description: '智能合并冲突的更改',
        icon: '🔀',
        action: async () => this.mergeConflictingChanges(),
        automatic: true,
        priority: 1
      },
      {
        id: 'choose-version',
        name: '选择版本',
        description: '手动选择要保留的版本',
        icon: '⚖️',
        action: async () => this.showVersionSelector(),
        automatic: false,
        priority: 2
      }
    ]);

    // 内存限制恢复操作
    this.recoveryActions.set(ErrorType.MEMORY_LIMIT, [
      {
        id: 'clear-cache',
        name: '清理缓存',
        description: '清理内存缓存释放空间',
        icon: '🧹',
        action: async () => this.clearMemoryCache(),
        automatic: true,
        priority: 1
      },
      {
        id: 'reduce-batch-size',
        name: '减少批量大小',
        description: '降低处理批量大小',
        icon: '📉',
        action: async () => this.reduceBatchSize(),
        automatic: true,
        priority: 2
      }
    ]);
  }

  /**
   * 确定恢复策略
   */
  private determineRecoveryStrategy(type: ErrorType, severity: ErrorSeverity): RecoveryStrategy {
    if (severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.MANUAL;
    }

    switch (type) {
      case ErrorType.NETWORK:
        return RecoveryStrategy.RETRY;
      case ErrorType.PERMISSION:
        return RecoveryStrategy.MANUAL;
      case ErrorType.DATA_CORRUPTION:
        return RecoveryStrategy.FALLBACK;
      case ErrorType.TEMPLATE_ERROR:
        return RecoveryStrategy.RESET;
      case ErrorType.SYNC_CONFLICT:
        return RecoveryStrategy.FALLBACK;
      case ErrorType.MEMORY_LIMIT:
        return RecoveryStrategy.RETRY;
      default:
        return RecoveryStrategy.MANUAL;
    }
  }

  /**
   * 尝试自动恢复
   */
  private async attemptAutoRecovery(errorId: string): Promise<boolean> {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) return false;

    let errorInfo: ErrorInfo | undefined;
    const unsubscribe = errorStore.subscribe(_error => {
      errorInfo = _error;
    });
    unsubscribe();

    // 检查重试次数
    if (!errorInfo || errorInfo.retryCount >= errorInfo.maxRetries) {
      logger.warn(`错误重试次数已达上限: ${errorId}`);
      return false;
    }

    // 增加重试次数
    errorStore.update(error => ({
      ...error,
      retryCount: error.retryCount + 1
    }));

    // 获取自动恢复操作
    const actions = this.getRecoveryActions(errorId).filter(action => action.automatic);
    
    if (actions.length === 0) {
      logger.debug(`没有可用的自动恢复操作: ${errorId}`);
      return false;
    }

    // 按优先级排序并执行
    actions.sort((a, b) => a.priority - b.priority);
    
    for (const action of actions) {
      try {
        logger.debug(`执行自动恢复操作: ${action.name}`);
        const success = await action.action();
        
        if (success) {
          logger.debug(`✅ 自动恢复成功: ${action.name}`);
          return true;
        }
      } catch (error) {
        logger.error(`自动恢复操作失败: ${action.name}`, error);
      }
    }

    return false;
  }

  /**
   * 执行恢复操作
   */
  private async executeRecoveryAction(errorId: string, actionId: string): Promise<boolean> {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) return false;

    let errorType: ErrorType;
    const unsubscribe = errorStore.subscribe(_error => {
      errorType = _error.type;
    });
    unsubscribe();

    const actions = this.recoveryActions.get(errorType!);
    const action = actions?.find(a => a.id === actionId);

    if (!action) {
      logger.warn(`恢复操作不存在: ${actionId}`);
      return false;
    }

    try {
      logger.debug(`执行恢复操作: ${action.name}`);
      return await action.action();
    } catch (error) {
      logger.error(`恢复操作执行失败: ${action.name}`, error);
      return false;
    }
  }

  /**
   * 更新活跃错误列表
   */
  private updateActiveErrors(): void {
    const activeMap = new Map<string, ErrorInfo>();

    for (const [errorId, errorStore] of this.errors) {
      let errorInfo: ErrorInfo | undefined;
      const unsubscribe = errorStore.subscribe(_error => {
        errorInfo = _error;
      });
      unsubscribe();

      if (errorInfo && !errorInfo.resolved) {
        activeMap.set(errorId, errorInfo);
      }
    }

    this.activeErrors.set(activeMap);
  }

  /**
   * 移动到历史记录
   */
  private moveToHistory(errorId: string): void {
    const errorStore = this.errors.get(errorId);
    if (!errorStore) return;

    let errorInfo: ErrorInfo;
    const unsubscribe = errorStore.subscribe(_error => {
      errorInfo = _error;
    });
    unsubscribe();

    // 添加到历史记录
    this.errorHistory.update(_history => {
      const newHistory = [errorInfo!, ..._history];
      
      // 限制历史记录大小
      if (newHistory.length > this.config.maxErrorHistory) {
        newHistory.splice(this.config.maxErrorHistory);
      }
      
      return newHistory;
    });

    // 从活跃错误中移除
    this.errors.delete(errorId);
    this.updateActiveErrors();
  }

  /**
   * 计算错误统计
   */
  private calculateStats(activeErrors: Map<string, ErrorInfo>, history: ErrorInfo[]): ErrorStats {
    const allErrors = [...Array.from(activeErrors.values()), ...history];
    const resolvedErrors = allErrors.filter(e => e.resolved);
    const criticalErrors = allErrors.filter(e => e.severity === ErrorSeverity.CRITICAL);

    const errorsByType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = allErrors.filter(e => e.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);

    const resolutionTimes = resolvedErrors
      .filter(e => e.timestamp)
      .map(e => (e.timestamp - e.timestamp) / 1000); // 简化计算

    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length 
      : 0;

    const successRate = allErrors.length > 0 
      ? (resolvedErrors.length / allErrors.length) * 100 
      : 100;

    return {
      totalErrors: allErrors.length,
      resolvedErrors: resolvedErrors.length,
      criticalErrors: criticalErrors.length,
      errorsByType,
      averageResolutionTime,
      successRate
    };
  }

  /**
   * 记录错误日志
   */
  private logError(error: ErrorInfo): void {
    const logLevel = error.severity === ErrorSeverity.CRITICAL ? 'error' : 'warn';
    console[logLevel](`[${error.type}] ${error.message}`, {
      id: error.id,
      details: error.details,
      context: error.context,
      timestamp: new Date(error.timestamp).toISOString()
    });
  }

  /**
   * 通知用户
   */
  private notifyUser(error: ErrorInfo): void {
    // 这里可以集成实际的通知系统
    logger.debug(`🔔 用户通知: ${error.message}`);
    
    // 标记为已通知
    const errorStore = this.errors.get(error.id);
    if (errorStore) {
      errorStore.update(_e => ({ ..._e, userNotified: true }));
    }
  }

  // 恢复操作实现（简化版本）
  private async retryNetworkConnection(): Promise<boolean> {
    // 模拟网络重连
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Math.random() > 0.3; // 70% 成功率
  }

  private async checkNetworkStatus(): Promise<boolean> {
    return navigator.onLine;
  }

  private async requestPermissions(): Promise<boolean> {
    // 模拟权限请求
    return true;
  }

  private async restoreFromBackup(): Promise<boolean> {
    // 模拟备份恢复
    await new Promise(resolve => setTimeout(resolve, 2000));
    return Math.random() > 0.2; // 80% 成功率
  }

  private async repairCorruptedData(): Promise<boolean> {
    // 模拟数据修复
    await new Promise(resolve => setTimeout(resolve, 1500));
    return Math.random() > 0.4; // 60% 成功率
  }

  private async resetToDefaultTemplate(): Promise<boolean> {
    // 模拟模板重置
    return true;
  }

  private async validateTemplate(): Promise<boolean> {
    // 模拟模板验证
    return Math.random() > 0.1; // 90% 成功率
  }

  private async mergeConflictingChanges(): Promise<boolean> {
    // 模拟冲突合并
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Math.random() > 0.3; // 70% 成功率
  }

  private async showVersionSelector(): Promise<boolean> {
    // 模拟版本选择器
    return true;
  }

  private async clearMemoryCache(): Promise<boolean> {
    // 模拟缓存清理
    return true;
  }

  private async reduceBatchSize(): Promise<boolean> {
    // 模拟批量大小调整
    return true;
  }
}

// 创建全局实例
export const errorRecoveryService = new ErrorRecoveryService();
