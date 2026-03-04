<script lang="ts">
  import { logger } from '../../utils/logger';

  // 性能监控仪表板组件
  import { onMount, onDestroy } from 'svelte';
  import { 
    performanceMonitor, 
    MetricType, 
    type PerformanceMetric, 
    type PerformanceReport,
    type PerformanceBottleneck 
  } from '../../services/monitoring/performance-monitor';

  // 组件属性
  interface Props {
    compact?: boolean;
    showDetails?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
  }

  let {
    compact = false,
    showDetails = true,
    autoRefresh = true,
    refreshInterval = 2000
  }: Props = $props();

  // 响应式状态
  let currentMetrics = $state<Record<MetricType, PerformanceMetric | null>>({
    [MetricType.MEMORY]: null,
    [MetricType.CPU]: null,
    [MetricType.NETWORK]: null,
    [MetricType.RENDER]: null,
    [MetricType.INTERACTION]: null,
    [MetricType.STORAGE]: null,
    [MetricType.CUSTOM]: null
  });

  let performanceScore = $state(100);
  let healthStatus = $state<'healthy' | 'warning' | 'critical'>('healthy');
  let activeBottlenecks = $state<PerformanceBottleneck[]>([]);
  let isMonitoring = $state(false);
  let selectedMetric = $state<MetricType | null>(null);
  let showTrends = $state(false);

  let startedMonitoringHere = false;

  // 订阅状态
  let unsubscribeMetrics: (() => void) | null = null;
  let unsubscribeScore: (() => void) | null = null;
  let unsubscribeHealth: (() => void) | null = null;
  let unsubscribeBottlenecks: (() => void) | null = null;
  let unsubscribeMonitoring: (() => void) | null = null;

  // 刷新定时器
  let refreshTimer: NodeJS.Timeout | null = null;

  // 计算属性
  const healthColor = $derived(() => {
    switch (healthStatus) {
      case 'healthy': return 'var(--text-success)';
      case 'warning': return 'var(--text-warning)';
      case 'critical': return 'var(--text-error)';
      default: return 'var(--text-muted)';
    }
  });

  const scoreColor = $derived(() => {
    if (performanceScore >= 80) return 'var(--text-success)';
    if (performanceScore >= 60) return 'var(--text-warning)';
    return 'var(--text-error)';
  });

  const criticalBottlenecks = $derived(
    activeBottlenecks.filter(b => b.severity === 'critical')
  );

  onMount(() => {
    // 订阅性能监控状态
    unsubscribeMetrics = performanceMonitor.currentMetrics.subscribe(metrics => {
      currentMetrics = metrics;
    });

    unsubscribeScore = performanceMonitor.performanceScore.subscribe(score => {
      performanceScore = score;
    });

    unsubscribeHealth = performanceMonitor.healthStatus.subscribe(status => {
      healthStatus = status;
    });

    unsubscribeBottlenecks = performanceMonitor.activeBottlenecks.subscribe(bottlenecks => {
      activeBottlenecks = bottlenecks;
    });

    unsubscribeMonitoring = performanceMonitor.monitoringStatus.subscribe(status => {
      isMonitoring = status;
    });

    // 启动自动刷新
    if (autoRefresh) {
      startAutoRefresh();
    }

    // 自动启动监控
    if (!isMonitoring) {
      performanceMonitor.startMonitoring();
      startedMonitoringHere = true;
    }
  });

  onDestroy(() => {
    unsubscribeMetrics?.();
    unsubscribeScore?.();
    unsubscribeHealth?.();
    unsubscribeBottlenecks?.();
    unsubscribeMonitoring?.();
    stopAutoRefresh();

    if (startedMonitoringHere) {
      performanceMonitor.stopMonitoring();
      startedMonitoringHere = false;
    }
  });

  // 方法
  function startAutoRefresh() {
    if (refreshTimer) return;
    
    refreshTimer = setInterval(() => {
      // 触发界面更新
      currentMetrics = { ...currentMetrics };
    }, refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function toggleMonitoring() {
    if (isMonitoring) {
      performanceMonitor.stopMonitoring();
    } else {
      performanceMonitor.startMonitoring();
    }
  }

  function generateReport() {
    const report = performanceMonitor.generatePerformanceReport();
    logger.debug('📋 性能报告已生成:', report);
    // 可以显示报告或下载
  }

  function exportData() {
    const data = performanceMonitor.exportPerformanceData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function selectMetric(metric: MetricType) {
    selectedMetric = selectedMetric === metric ? null : metric;
  }

  function getMetricIcon(type: MetricType): string {
    const icons = {
      [MetricType.MEMORY]: '🧠',
      [MetricType.CPU]: '⚡',
      [MetricType.NETWORK]: '🌐',
      [MetricType.RENDER]: '🎨',
      [MetricType.INTERACTION]: '👆',
      [MetricType.STORAGE]: '💾',
      [MetricType.CUSTOM]: '📊'
    };
    return icons[type] || '📊';
  }

  function getMetricColor(metric: PerformanceMetric | null): string {
    if (!metric || !metric.threshold) return 'var(--text-normal)';
    
    const { warning, critical } = metric.threshold;
    if (metric.value >= critical) return 'var(--text-error)';
    if (metric.value >= warning) return 'var(--text-warning)';
    return 'var(--text-success)';
  }

  function formatValue(value: number, unit: string): string {
    if (unit === 'MB' || unit === 'ms') {
      return `${value.toFixed(1)} ${unit}`;
    }
    if (unit === '%') {
      return `${value.toFixed(0)}%`;
    }
    return `${value.toFixed(2)} ${unit}`;
  }

  function getSeverityIcon(severity: string): string {
    const icons = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    return icons[severity as keyof typeof icons] || '⚪';
  }

  function formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }
</script>

<div class="performance-dashboard" class:compact>
  <!-- 仪表板标题 -->
  <div class="dashboard-header">
    <div class="header-info">
      <h3>性能监控</h3>
      <div class="status-indicators">
        <div class="status-item">
          <span class="status-label">健康状态:</span>
          <span class="status-value" style="color: {healthColor}">
            {healthStatus === 'healthy' ? '正常' : 
             healthStatus === 'warning' ? '警告' : '严重'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">性能分数:</span>
          <span class="status-value" style="color: {scoreColor}">
            {performanceScore.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
    
    <div class="header-controls">
      <button 
        class="control-btn"
        class:active={isMonitoring}
        onclick={toggleMonitoring}
      >
        {isMonitoring ? '暂停' : '开始'}
      </button>
      <button class="control-btn" onclick={generateReport}>
        报告
      </button>
      <button class="control-btn" onclick={exportData}>
        导出
      </button>
    </div>
  </div>

  <!-- 关键指标卡片 -->
  <div class="metrics-grid">
    {#each Object.entries(currentMetrics) as [type, metric]}
      {#if metric}
        <div 
          class="metric-card"
          class:selected={selectedMetric === type}
          onclick={() => selectMetric(type as MetricType)}
        >
          <div class="metric-header">
            <span class="metric-icon">{getMetricIcon(type as MetricType)}</span>
            <span class="metric-name">{type}</span>
          </div>
          <div class="metric-value" style="color: {getMetricColor(metric)}">
            {formatValue(metric.value, metric.unit)}
          </div>
          {#if metric.threshold}
            <div class="metric-threshold">
              <div class="threshold-bar">
                <div 
                  class="threshold-fill"
                  style="width: {Math.min(100, (metric.value / metric.threshold.critical) * 100)}%"
                ></div>
              </div>
              <span class="threshold-text">
                {metric.threshold.warning}/{metric.threshold.critical}
              </span>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- 性能瓶颈警告 -->
  {#if criticalBottlenecks.length > 0}
    <div class="bottlenecks-section">
      <h4>严重性能问题</h4>
      <div class="bottlenecks-list">
        {#each criticalBottlenecks as bottleneck}
          <div class="bottleneck-item critical">
            <div class="bottleneck-header">
              <span class="severity-icon">{getSeverityIcon(bottleneck.severity)}</span>
              <span class="bottleneck-type">{bottleneck.type}</span>
              <span class="bottleneck-time">{formatTimestamp(bottleneck.detectedAt)}</span>
            </div>
            <div class="bottleneck-description">{bottleneck.description}</div>
            <div class="bottleneck-suggestion">{bottleneck.suggestion}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 详细信息 -->
  {#if showDetails && !compact}
    <div class="details-section">
      <!-- 所有瓶颈 -->
      {#if activeBottlenecks.length > 0}
        <div class="all-bottlenecks">
          <h4>性能问题 ({activeBottlenecks.length})</h4>
          <div class="bottlenecks-list">
            {#each activeBottlenecks.slice(0, 5) as bottleneck}
              <div class="bottleneck-item" class:critical={bottleneck.severity === 'critical'}>
                <div class="bottleneck-header">
                  <span class="severity-icon">{getSeverityIcon(bottleneck.severity)}</span>
                  <span class="bottleneck-type">{bottleneck.type}</span>
                  <span class="bottleneck-time">{formatTimestamp(bottleneck.detectedAt)}</span>
                </div>
                <div class="bottleneck-description">{bottleneck.description}</div>
                <div class="bottleneck-impact">影响: {bottleneck.impact}</div>
                <div class="bottleneck-suggestion">建议: {bottleneck.suggestion}</div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="no-issues">
          <div class="no-issues-icon">[OK]</div>
          <p>系统运行良好，未检测到性能问题</p>
        </div>
      {/if}

      <!-- 趋势分析 -->
      {#if selectedMetric && showTrends}
        <div class="trends-section">
          <h4>{selectedMetric} 趋势分析</h4>
          <div class="trend-info">
            <p>趋势分析功能正在开发中...</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- 快速操作 -->
  <div class="quick-actions">
    <button 
      class="action-btn"
      onclick={() => showTrends = !showTrends}
    >
      {showTrends ? '隐藏' : '显示'}趋势
    </button>
    <button 
      class="action-btn"
      onclick={() => performanceMonitor.updateThresholds({})}
    >
      调整阈值
    </button>
  </div>
</div>

<style>
  .performance-dashboard {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
  }

  .performance-dashboard.compact {
    padding: 1rem;
    margin: 0.5rem 0;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .header-info h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-normal);
    font-size: 1.3rem;
  }

  .status-indicators {
    display: flex;
    gap: 2rem;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .status-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .status-value {
    font-size: 1rem;
    font-weight: 600;
  }

  .header-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    padding: 0.5rem 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .control-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .metric-card {
    background: var(--background-secondary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .metric-card:hover {
    border-color: var(--interactive-accent);
    transform: translateY(-2px);
  }

  .metric-card.selected {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-secondary));
  }

  .metric-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .metric-icon {
    font-size: 1.2rem;
  }

  .metric-name {
    font-size: 0.9rem;
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: 500;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .metric-threshold {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .threshold-bar {
    flex: 1;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .threshold-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--text-success), var(--text-warning), var(--text-error));
    transition: width 0.3s ease;
  }

  .threshold-text {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .bottlenecks-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: color-mix(in srgb, var(--text-error) 5%, var(--background-secondary));
    border: 1px solid var(--text-error);
    border-radius: 6px;
  }

  .bottlenecks-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-error);
    font-size: 1rem;
  }

  .bottlenecks-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .bottleneck-item {
    padding: 0.75rem;
    background: var(--background-primary);
    border-radius: 4px;
    border-left: 3px solid var(--text-warning);
  }

  .bottleneck-item.critical {
    border-left-color: var(--text-error);
  }

  .bottleneck-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .severity-icon {
    font-size: 0.9rem;
  }

  .bottleneck-type {
    font-weight: 500;
    color: var(--text-normal);
    text-transform: capitalize;
  }

  .bottleneck-time {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-left: auto;
  }

  .bottleneck-description {
    color: var(--text-normal);
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }

  .bottleneck-impact, .bottleneck-suggestion {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .details-section {
    margin-bottom: 1.5rem;
  }

  .all-bottlenecks h4 {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
    font-size: 1rem;
  }

  .no-issues {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .no-issues-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .trends-section {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .trends-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
    font-size: 1rem;
  }

  .quick-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .action-btn {
    padding: 0.5rem 1rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .dashboard-header {
      flex-direction: column;
      gap: 1rem;
    }

    .status-indicators {
      flex-direction: column;
      gap: 0.5rem;
    }

    .metrics-grid {
      grid-template-columns: 1fr;
    }

    .quick-actions {
      flex-direction: column;
    }
  }
</style>
