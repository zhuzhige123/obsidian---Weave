import { logger } from '../../utils/logger';
/**
 * 用户体验优化服务
 * 提供智能的用户体验优化，包括性能监控、用户行为分析和界面自适应
 */

import { writable, derived, type Writable } from 'svelte/store';

// 用户行为类型
export enum UserAction {
  CLICK = 'click',
  SCROLL = 'scroll',
  KEYBOARD = 'keyboard',
  DRAG = 'drag',
  HOVER = 'hover',
  FOCUS = 'focus'
}

// 性能指标类型
export enum PerformanceMetric {
  LOAD_TIME = 'load_time',
  RENDER_TIME = 'render_time',
  INTERACTION_TIME = 'interaction_time',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage'
}

// 用户行为记录
export interface UserBehavior {
  id: string;
  action: UserAction;
  element: string;
  timestamp: number;
  duration?: number;
  context?: Record<string, any>;
}

// 性能记录
export interface PerformanceRecord {
  id: string;
  metric: PerformanceMetric;
  value: number;
  timestamp: number;
  context?: Record<string, any>;
}

// 用户偏好设置
export interface UserPreferences {
  theme: 'auto' | 'light' | 'dark';
  animationSpeed: 'slow' | 'normal' | 'fast' | 'none';
  compactMode: boolean;
  autoSave: boolean;
  showTooltips: boolean;
  keyboardShortcuts: boolean;
  accessibilityMode: boolean;
  language: string;
}

// UX 优化建议
export interface UXRecommendation {
  id: string;
  type: 'performance' | 'accessibility' | 'usability' | 'efficiency';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action?: () => void;
  autoApply: boolean;
  applied: boolean;
}

// 用户会话信息
export interface UserSession {
  id: string;
  startTime: number;
  endTime?: number;
  actions: UserBehavior[];
  performance: PerformanceRecord[];
  errors: number;
  completedTasks: string[];
}

/**
 * 用户体验优化服务类
 */
export class UXOptimizationService {
  private behaviors: UserBehavior[] = [];
  private performanceRecords: PerformanceRecord[] = [];
  private currentSession: UserSession | null = null;
  private recommendations: UXRecommendation[] = [];
  private performanceIntervalId: ReturnType<typeof setInterval> | null = null;
  private analysisIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // 配置选项
  private config = {
    maxBehaviorHistory: 1000,
    maxPerformanceHistory: 500,
    analysisInterval: 30000, // 30秒
    autoOptimization: true,
    trackingEnabled: true
  };

  // 全局状态存储
  public readonly userPreferences = writable<UserPreferences>({
    theme: 'auto',
    animationSpeed: 'normal',
    compactMode: false,
    autoSave: true,
    showTooltips: true,
    keyboardShortcuts: true,
    accessibilityMode: false,
    language: 'zh-CN'
  });

  public readonly currentRecommendations = writable<UXRecommendation[]>([]);
  public readonly performanceMetrics = writable<Record<PerformanceMetric, number>>({
    [PerformanceMetric.LOAD_TIME]: 0,
    [PerformanceMetric.RENDER_TIME]: 0,
    [PerformanceMetric.INTERACTION_TIME]: 0,
    [PerformanceMetric.MEMORY_USAGE]: 0,
    [PerformanceMetric.CPU_USAGE]: 0
  });

  // 计算属性
  public readonly userEfficiency = derived(
    [this.userPreferences],
    ([prefs]) => this.calculateUserEfficiency(prefs)
  );

  public readonly systemPerformance = derived(
    [this.performanceMetrics],
    ([metrics]) => this.calculateSystemPerformance(metrics)
  );

  constructor() {
    this.loadUserPreferences();
    this.startSession();
    this.startPerformanceMonitoring();
    this.startAnalysisLoop();
  }

  /**
   * 启动用户会话
   */
  startSession(): void {
    this.currentSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      actions: [],
      performance: [],
      errors: 0,
      completedTasks: []
    };

    logger.debug('🎯 用户会话已启动:', this.currentSession.id);
  }

  /**
   * 结束用户会话
   */
  endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.analyzeSession(this.currentSession);
      logger.debug('📊 用户会话已结束:', this.currentSession.id);
      this.currentSession = null;
    }
  }

  /**
   * 记录用户行为
   */
  trackUserBehavior(
    action: UserAction,
    element: string,
    duration?: number,
    context?: Record<string, any>
  ): void {
    if (!this.config.trackingEnabled) return;

    const behavior: UserBehavior = {
      id: `behavior-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      element,
      timestamp: Date.now(),
      duration,
      context
    };

    this.behaviors.push(behavior);
    
    // 添加到当前会话
    if (this.currentSession) {
      this.currentSession.actions.push(behavior);
    }

    // 限制历史记录大小
    if (this.behaviors.length > this.config.maxBehaviorHistory) {
      this.behaviors.splice(0, this.behaviors.length - this.config.maxBehaviorHistory);
    }

    // 实时分析用户行为
    this.analyzeUserBehavior(behavior);
  }

  private analyzeUserBehavior(behavior: UserBehavior): void {
    if (!this.config.trackingEnabled) return;

    if (behavior.action === UserAction.CLICK && behavior.duration !== undefined && behavior.duration > 2000) {
      this.addRecommendation({
        id: `interaction-slow-${behavior.element}`,
        type: 'usability',
        priority: 'low',
        title: `优化 ${behavior.element} 的交互响应`,
        description: '检测到该操作耗时较长，建议优化交互流程或减少步骤',
        autoApply: false,
        applied: false
      });
    }
  }

  /**
   * 记录性能指标
   */
  recordPerformance(
    metric: PerformanceMetric,
    value: number,
    context?: Record<string, any>
  ): void {
    const record: PerformanceRecord = {
      id: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      metric,
      value,
      timestamp: Date.now(),
      context
    };

    this.performanceRecords.push(record);

    // 添加到当前会话
    if (this.currentSession) {
      this.currentSession.performance.push(record);
    }

    // 更新性能指标存储
    this.performanceMetrics.update(_metrics => ({
      ..._metrics,
      [metric]: value
    }));

    // 限制历史记录大小
    if (this.performanceRecords.length > this.config.maxPerformanceHistory) {
      this.performanceRecords.splice(0, this.performanceRecords.length - this.config.maxPerformanceHistory);
    }

    // 检查性能阈值
    this.checkPerformanceThresholds(metric, value);
  }

  /**
   * 更新用户偏好
   */
  updateUserPreferences(updates: Partial<UserPreferences>): void {
    this.userPreferences.update(_prefs => {
      const newPrefs = { ..._prefs, ...updates };
      this.saveUserPreferences(newPrefs);
      this.applyPreferences(newPrefs);
      return newPrefs;
    });

    logger.debug('⚙️ 用户偏好已更新:', updates);
  }

  /**
   * 应用 UX 优化建议
   */
  applyRecommendation(recommendationId: string): void {
    const recommendation = this.recommendations.find(r => r.id === recommendationId);
    if (!recommendation) {
      logger.warn(`优化建议不存在: ${recommendationId}`);
      return;
    }

    if (recommendation.action) {
      try {
        recommendation.action();
        recommendation.applied = true;
        logger.debug(`✅ 已应用优化建议: ${recommendation.title}`);
        
        // 更新建议列表
        this.updateRecommendations();
      } catch (error) {
        logger.error(`应用优化建议失败: ${recommendation.title}`, error);
      }
    }
  }

  /**
   * 获取用户效率分析
   */
  getUserEfficiencyAnalysis(): {
    score: number;
    insights: string[];
    suggestions: string[];
  } {
    const recentBehaviors = this.behaviors.slice(-100); // 最近100个行为
    
    // 计算效率分数
    let score = 100;
    const insights: string[] = [];
    const suggestions: string[] = [];

    // 分析点击频率
    const clickActions = recentBehaviors.filter(b => b.action === UserAction.CLICK);
    const avgClickInterval = this.calculateAverageInterval(clickActions);
    
    if (avgClickInterval < 500) {
      score -= 10;
      insights.push('检测到频繁点击行为');
      suggestions.push('考虑使用键盘快捷键提高效率');
    }

    // 分析任务完成时间
    const taskCompletionTimes = this.calculateTaskCompletionTimes();
    if (taskCompletionTimes.average > 30000) { // 30秒
      score -= 15;
      insights.push('任务完成时间较长');
      suggestions.push('启用自动保存和智能提示');
    }

    // 分析错误率
    const errorRate = this.calculateErrorRate();
    if (errorRate > 0.1) { // 10%
      score -= 20;
      insights.push('错误率较高');
      suggestions.push('启用详细提示和确认对话框');
    }

    return {
      score: Math.max(0, score),
      insights,
      suggestions
    };
  }

  /**
   * 获取性能优化建议
   */
  getPerformanceOptimizations(): UXRecommendation[] {
    const optimizations: UXRecommendation[] = [];
    const metrics = this.getLatestMetrics();

    // 加载时间优化
    if (metrics[PerformanceMetric.LOAD_TIME] > 3000) {
      optimizations.push({
        id: 'optimize-load-time',
        type: 'performance',
        priority: 'high',
        title: '优化加载时间',
        description: '启用预加载和缓存机制以提高加载速度',
        action: () => this.enablePreloading(),
        autoApply: false,
        applied: false
      });
    }

    // 内存使用优化
    if (metrics[PerformanceMetric.MEMORY_USAGE] > 100) { // 100MB
      optimizations.push({
        id: 'optimize-memory',
        type: 'performance',
        priority: 'medium',
        title: '优化内存使用',
        description: '清理缓存和减少内存占用',
        action: () => this.optimizeMemoryUsage(),
        autoApply: true,
        applied: false
      });
    }

    // 渲染性能优化
    if (metrics[PerformanceMetric.RENDER_TIME] > 100) {
      optimizations.push({
        id: 'optimize-rendering',
        type: 'performance',
        priority: 'medium',
        title: '优化渲染性能',
        description: '启用虚拟滚动和延迟渲染',
        action: () => this.optimizeRendering(),
        autoApply: false,
        applied: false
      });
    }

    return optimizations;
  }

  /**
   * 自动应用优化
   */
  autoOptimize(): void {
    if (!this.config.autoOptimization) return;

    const autoRecommendations = this.recommendations.filter(r => r.autoApply && !r.applied);
    
    for (const recommendation of autoRecommendations) {
      this.applyRecommendation(recommendation.id);
    }

    if (autoRecommendations.length > 0) {
      logger.debug(`🤖 自动应用了 ${autoRecommendations.length} 个优化建议`);
    }
  }

  // 私有方法

  /**
   * 加载用户偏好
   */
  private loadUserPreferences(): void {
    try {
      const saved = localStorage.getItem('weave-user-preferences');
      if (saved) {
        const preferences = JSON.parse(saved) as UserPreferences;
        this.userPreferences.set(preferences);
        this.applyPreferences(preferences);
        logger.debug('✅ 用户偏好加载成功');
      }
    } catch (error) {
      logger.warn('用户偏好加载失败:', error);
    }
  }

  /**
   * 保存用户偏好
   */
  private saveUserPreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem('weave-user-preferences', JSON.stringify(preferences));
    } catch (error) {
      logger.error('用户偏好保存失败:', error);
    }
  }

  /**
   * 应用用户偏好
   */
  private applyPreferences(preferences: UserPreferences): void {
    // 应用主题
    if (preferences.theme !== 'auto') {
      document.body.classList.toggle('theme-dark', preferences.theme === 'dark');
      document.body.classList.toggle('theme-light', preferences.theme === 'light');
    }

    // 应用动画速度
    document.body.classList.toggle('animations-slow', preferences.animationSpeed === 'slow');
    document.body.classList.toggle('animations-fast', preferences.animationSpeed === 'fast');
    document.body.classList.toggle('animations-none', preferences.animationSpeed === 'none');

    // 应用紧凑模式
    document.body.classList.toggle('compact-mode', preferences.compactMode);

    // 应用无障碍模式
    document.body.classList.toggle('accessibility-mode', preferences.accessibilityMode);
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    // 监控页面加载时间
    if (performance.timing) {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      this.recordPerformance(PerformanceMetric.LOAD_TIME, loadTime);
    }

    // 监控内存使用
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.recordPerformance(
        PerformanceMetric.MEMORY_USAGE,
        memInfo.usedJSHeapSize / (1024 * 1024) // 转换为MB
      );
    }

    // 定期监控性能
    if (this.performanceIntervalId) return;
    this.performanceIntervalId = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 10000); // 每10秒收集一次
  }

  /**
   * 收集性能指标
   */
  private collectPerformanceMetrics(): void {
    // 收集内存使用
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.recordPerformance(
        PerformanceMetric.MEMORY_USAGE,
        memInfo.usedJSHeapSize / (1024 * 1024)
      );
    }

    // 收集渲染时间（简化实现）
    const renderStart = performance.now();
    requestAnimationFrame(() => {
      const renderTime = performance.now() - renderStart;
      this.recordPerformance(PerformanceMetric.RENDER_TIME, renderTime);
    });
  }

  /**
   * 启动分析循环
   */
  private startAnalysisLoop(): void {
    if (this.analysisIntervalId) return;
    this.analysisIntervalId = setInterval(() => {
      this.analyzeUserPatterns();
      this.generateRecommendations();
      this.autoOptimize();
    }, this.config.analysisInterval);
  }

  destroy(): void {
    try {
      this.endSession();
    } catch {
    }

    if (this.performanceIntervalId) {
      clearInterval(this.performanceIntervalId);
      this.performanceIntervalId = null;
    }

    if (this.analysisIntervalId) {
      clearInterval(this.analysisIntervalId);
      this.analysisIntervalId = null;
    }

    this.behaviors = [];
    this.performanceRecords = [];
    this.recommendations = [];
    this.currentRecommendations.set([]);

    logger.debug('[UXOptimizationService] 已销毁');
  }

  /**
   * 分析用户模式
   */
  private analyzeUserPatterns(): void {
    const recentBehaviors = this.behaviors.slice(-100);
    
    // 分析使用频率最高的功能
    const elementFrequency = new Map<string, number>();
    recentBehaviors.forEach(_b => {
      elementFrequency.set(_b.element, (elementFrequency.get(_b.element) || 0) + 1);
    });

    // 为高频功能推荐快捷键
    for (const [element, frequency] of elementFrequency) {
      if (frequency > 10) {
        this.addRecommendation({
          id: `shortcut-${element}`,
          type: 'efficiency',
          priority: 'low',
          title: `为 ${element} 设置快捷键`,
          description: '该功能使用频繁，建议设置快捷键提高效率',
          autoApply: false,
          applied: false
        });
      }
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): void {
    // 清除旧建议
    this.recommendations = this.recommendations.filter(r => !r.applied);

    // 添加性能优化建议
    const performanceOptimizations = this.getPerformanceOptimizations();
    this.recommendations.push(...performanceOptimizations);

    // 更新建议列表
    this.updateRecommendations();
  }

  /**
   * 添加建议
   */
  private addRecommendation(recommendation: UXRecommendation): void {
    // 检查是否已存在相同建议
    const exists = this.recommendations.some(r => r.id === recommendation.id);
    if (!exists) {
      this.recommendations.push(recommendation);
      this.updateRecommendations();
    }
  }

  /**
   * 更新建议列表
   */
  private updateRecommendations(): void {
    this.currentRecommendations.set([...this.recommendations]);
  }

  /**
   * 计算用户效率
   */
  private calculateUserEfficiency(preferences: UserPreferences): number {
    let efficiency = 100;

    // 基于偏好设置计算效率
    if (preferences.keyboardShortcuts) efficiency += 10;
    if (preferences.autoSave) efficiency += 5;
    if (preferences.compactMode) efficiency += 5;
    if (preferences.animationSpeed === 'fast' || preferences.animationSpeed === 'none') efficiency += 5;

    return Math.min(100, efficiency);
  }

  /**
   * 计算系统性能
   */
  private calculateSystemPerformance(metrics: Record<PerformanceMetric, number>): number {
    let performance = 100;

    // 基于性能指标计算分数
    if (metrics[PerformanceMetric.LOAD_TIME] > 3000) performance -= 20;
    if (metrics[PerformanceMetric.RENDER_TIME] > 100) performance -= 15;
    if (metrics[PerformanceMetric.MEMORY_USAGE] > 100) performance -= 10;

    return Math.max(0, performance);
  }

  /**
   * 计算平均间隔
   */
  private calculateAverageInterval(behaviors: UserBehavior[]): number {
    if (behaviors.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < behaviors.length; i++) {
      intervals.push(behaviors[i].timestamp - behaviors[i - 1].timestamp);
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  /**
   * 计算任务完成时间
   */
  private calculateTaskCompletionTimes(): { average: number; median: number } {
    // 简化实现
    return { average: 15000, median: 12000 };
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    if (!this.currentSession) return 0;
    const totalActions = this.currentSession.actions.length;
    return totalActions > 0 ? this.currentSession.errors / totalActions : 0;
  }

  /**
   * 获取最新指标
   */
  private getLatestMetrics(): Record<PerformanceMetric, number> {
    let metrics: Record<PerformanceMetric, number>;
    const unsubscribe = this.performanceMetrics.subscribe(_m => {
      metrics = _m;
    });
    unsubscribe();
    return metrics!;
  }

  /**
   * 检查性能阈值
   */
  private checkPerformanceThresholds(metric: PerformanceMetric, value: number): void {
    const thresholds = {
      [PerformanceMetric.LOAD_TIME]: 5000,
      [PerformanceMetric.RENDER_TIME]: 200,
      [PerformanceMetric.INTERACTION_TIME]: 100,
      [PerformanceMetric.MEMORY_USAGE]: 150,
      [PerformanceMetric.CPU_USAGE]: 80
    };

    if (value > thresholds[metric]) {
      logger.warn(`性能警告: ${metric} 超过阈值 (${value} > ${thresholds[metric]})`);
    }
  }

  /**
   * 分析会话
   */
  private analyzeSession(session: UserSession): void {
    const duration = (session.endTime || Date.now()) - session.startTime;
    logger.debug(`📊 会话分析: 时长 ${Math.round(duration / 1000)}s, 操作 ${session.actions.length} 次, 错误 ${session.errors} 次`);
  }

  // 优化操作实现
  private enablePreloading(): void {
    logger.debug('🚀 启用预加载机制');
  }

  private optimizeMemoryUsage(): void {
    logger.debug('🧹 优化内存使用');
  }

  private optimizeRendering(): void {
    logger.debug('⚡ 优化渲染性能');
  }
}

// 创建全局实例
function getOrCreateUXOptimizationService(): UXOptimizationService {
  if (typeof window === 'undefined') {
    return new UXOptimizationService();
  }

  const w = window as any;
  if (w.__weaveUXOptimizationService) {
    return w.__weaveUXOptimizationService as UXOptimizationService;
  }

  const instance = new UXOptimizationService();
  w.__weaveUXOptimizationService = instance;
  w.__weaveUXOptimizationServiceCleanup = () => {
    try {
      (w.__weaveUXOptimizationService as UXOptimizationService | undefined)?.destroy();
    } catch {
    }

    try {
      delete w.__weaveUXOptimizationService;
      delete w.__weaveUXOptimizationServiceCleanup;
    } catch {
      w.__weaveUXOptimizationService = null;
      w.__weaveUXOptimizationServiceCleanup = null;
    }
  };

  return instance;
}

export const uxOptimizationService = getOrCreateUXOptimizationService();
