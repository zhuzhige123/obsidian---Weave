<script lang="ts">
  import { logger } from '../../utils/logger';

  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { fade, fly, scale } from 'svelte/transition';
  
  // 进度监控数据接口
  interface ProgressData {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number; // 0-100
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
    startTime: number;
    endTime?: number;
    estimatedTimeRemaining?: number;
    throughput?: number; // 项目/秒
    errors: string[];
    warnings: string[];
    metadata?: Record<string, any>;
  }

  // 性能指标接口
  interface PerformanceMetrics {
    memoryUsage: number; // MB
    cpuUsage: number; // 0-100%
    networkLatency: number; // ms
    cacheHitRate: number; // 0-100%
    errorRate: number; // 0-100%
    throughput: number; // 项目/秒
  }

  // 组件属性
  interface Props {
    taskId?: string;
    autoRefresh?: boolean;
    refreshInterval?: number;
    showDetails?: boolean;
    showMetrics?: boolean;
    compact?: boolean;
  }

  let {
    taskId = '',
    autoRefresh = true,
    refreshInterval = 1000,
    showDetails = true,
    showMetrics = true,
    compact = false
  }: Props = $props();

  // 事件分发器
  const dispatch = createEventDispatcher<{
    taskComplete: ProgressData;
    taskFailed: ProgressData;
    taskCancelled: ProgressData;
    metricsUpdate: PerformanceMetrics;
  }>();

  // 响应式状态
  let progressStore = writable<ProgressData | null>(null);
  let metricsStore = writable<PerformanceMetrics>({
    memoryUsage: 0,
    cpuUsage: 0,
    networkLatency: 0,
    cacheHitRate: 0,
    errorRate: 0,
    throughput: 0
  });

  let refreshTimer = $state<NodeJS.Timeout | null>(null);
  let isVisible = $state(true);
  let showAdvancedMetrics = $state(false);

  // 计算属性
  const timeElapsed = derived(progressStore, ($progress) => {
    if (!$progress || !$progress.startTime) return 0;
    const endTime = $progress.endTime || Date.now();
    return Math.floor((endTime - $progress.startTime) / 1000);
  });

  const estimatedTotal = derived([progressStore, timeElapsed], ([$progress, $elapsed]) => {
    if (!$progress || $progress.progress === 0) return 0;
    return Math.floor(($elapsed * 100) / $progress.progress);
  });

  const statusColor = derived(progressStore, ($progress) => {
    if (!$progress) return 'var(--text-muted)';
    
    switch ($progress.status) {
      case 'pending': return 'var(--text-muted)';
      case 'running': return 'var(--text-accent)';
      case 'completed': return 'var(--text-success)';
      case 'failed': return 'var(--text-error)';
      case 'cancelled': return 'var(--text-warning)';
      default: return 'var(--text-muted)';
    }
  });

  const statusIcon = derived(progressStore, ($progress) => {
    if (!$progress) return '';
    
    switch ($progress.status) {
      case 'pending': return '';
      case 'running': return '';
      case 'completed': return '';
      case 'failed': return '';
      case 'cancelled': return '';
      default: return '';
    }
  });

  onMount(() => {
    if (autoRefresh) {
      startRefresh();
    }
    
    // 模拟初始数据
    if (taskId) {
      loadProgressData();
    }
  });

  onDestroy(() => {
    stopRefresh();
  });

  function startRefresh() {
    if (refreshTimer) return;
    
    refreshTimer = setInterval(() => {
      if (isVisible && taskId) {
        loadProgressData();
        updateMetrics();
      }
    }, refreshInterval);
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  async function loadProgressData() {
    try {
      // 模拟从API加载进度数据
      const mockProgress: ProgressData = {
        id: taskId,
        name: '智能同步处理',
        status: 'running',
        progress: Math.min(100, (Date.now() % 60000) / 600), // 模拟进度
        currentStep: '正在处理卡片数据...',
        totalSteps: 5,
        completedSteps: Math.floor(Math.min(100, (Date.now() % 60000) / 600) / 20),
        startTime: Date.now() - (Date.now() % 60000),
        throughput: 15.5 + Math.random() * 10,
        errors: [],
        warnings: Math.random() > 0.8 ? ['检测到部分卡片格式不标准'] : [],
        metadata: {
          cardsProcessed: Math.floor(Math.min(100, (Date.now() % 60000) / 600) * 2),
          totalCards: 200,
          batchSize: 25
        }
      };

      // 检查状态变化
      const currentProgress = $progressStore;
      if (currentProgress && currentProgress.status !== mockProgress.status) {
        handleStatusChange(mockProgress);
      }

      progressStore.set(mockProgress);
    } catch (error) {
      logger.error('加载进度数据失败:', error);
    }
  }

  function updateMetrics() {
    const metrics: PerformanceMetrics = {
      memoryUsage: 45 + Math.random() * 20,
      cpuUsage: 30 + Math.random() * 40,
      networkLatency: 50 + Math.random() * 100,
      cacheHitRate: 75 + Math.random() * 20,
      errorRate: Math.random() * 5,
      throughput: 15 + Math.random() * 10
    };

    metricsStore.set(metrics);
    dispatch('metricsUpdate', metrics);
  }

  function handleStatusChange(progress: ProgressData) {
    switch (progress.status) {
      case 'completed':
        dispatch('taskComplete', progress);
        stopRefresh();
        break;
      case 'failed':
        dispatch('taskFailed', progress);
        stopRefresh();
        break;
      case 'cancelled':
        dispatch('taskCancelled', progress);
        stopRefresh();
        break;
    }
  }

  function toggleAdvancedMetrics() {
    showAdvancedMetrics = !showAdvancedMetrics;
  }

  function pauseRefresh() {
    if (refreshTimer) {
      stopRefresh();
    } else {
      startRefresh();
    }
  }

  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // 响应式类名
  const containerClass = $derived(compact ? 'progress-monitor compact' : 'progress-monitor');
  const progressBarClass = $derived($progressStore?.status === 'failed' ? 'progress-bar error' : 'progress-bar');
</script>

<div class={containerClass} class:hidden={!isVisible}>
  {#if $progressStore}
    <div class="monitor-header" transition:fade>
      <div class="task-info">
        {#if $statusIcon}
          <span class="status-icon" style="color: {$statusColor}">{$statusIcon}</span>
        {/if}
        <div class="task-details">
          <h4 class="task-name">{$progressStore.name}</h4>
          <p class="current-step">{$progressStore.currentStep}</p>
        </div>
      </div>
      
      <div class="task-controls">
        <button 
          class="control-btn"
          onclick={pauseRefresh}
          title={refreshTimer ? '暂停刷新' : '恢复刷新'}
        >
          {refreshTimer ? '暂停' : '继续'}
        </button>
        
        <button 
          class="control-btn"
          onclick={() => isVisible = false}
          title="隐藏监控器"
        >
          关闭
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-section">
      <div class={progressBarClass}>
        <div 
          class="progress-fill"
          style="width: {$progressStore.progress}%"
          transition:fly={{ x: -20, duration: 300 }}
        ></div>
        <span class="progress-text">
          {$progressStore.progress.toFixed(1)}%
        </span>
      </div>
      
      <div class="progress-stats">
        <span class="stat">
          步骤: {$progressStore.completedSteps}/{$progressStore.totalSteps}
        </span>
        <span class="stat">
          耗时: {formatTime($timeElapsed)}
        </span>
        {#if $progressStore.estimatedTimeRemaining}
          <span class="stat">
            剩余: {formatTime(Math.floor($progressStore.estimatedTimeRemaining / 1000))}
          </span>
        {/if}
      </div>
    </div>

    <!-- 详细信息 -->
    {#if showDetails && !compact}
      <div class="details-section" transition:fade>
        {#if $progressStore.metadata}
          <div class="metadata-grid">
            <div class="metadata-item">
              <span class="label">已处理:</span>
              <span class="value">{$progressStore.metadata.cardsProcessed || 0}</span>
            </div>
            <div class="metadata-item">
              <span class="label">总数:</span>
              <span class="value">{$progressStore.metadata.totalCards || 0}</span>
            </div>
            <div class="metadata-item">
              <span class="label">批量大小:</span>
              <span class="value">{$progressStore.metadata.batchSize || 0}</span>
            </div>
            {#if $progressStore.throughput}
              <div class="metadata-item">
                <span class="label">吞吐量:</span>
                <span class="value">{$progressStore.throughput.toFixed(1)} 项/秒</span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- 警告和错误 -->
        {#if $progressStore.warnings.length > 0}
          <div class="messages warnings">
            <h5>警告</h5>
            {#each $progressStore.warnings as warning}
              <p class="message warning">{warning}</p>
            {/each}
          </div>
        {/if}

        {#if $progressStore.errors.length > 0}
          <div class="messages errors">
            <h5>错误</h5>
            {#each $progressStore.errors as error}
              <p class="message error">{error}</p>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- 性能指标 -->
    {#if showMetrics && !compact}
      <div class="metrics-section" transition:fade>
        <div class="metrics-header">
          <h5>性能指标</h5>
          <button 
            class="toggle-btn"
            onclick={toggleAdvancedMetrics}
          >
            {showAdvancedMetrics ? '简化' : '详细'}
          </button>
        </div>

        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">内存使用</span>
            <span class="metric-value">{formatBytes($metricsStore.memoryUsage * 1024 * 1024)}</span>
          </div>
          
          <div class="metric-item">
            <span class="metric-label">CPU使用率</span>
            <span class="metric-value">{$metricsStore.cpuUsage.toFixed(1)}%</span>
          </div>
          
          <div class="metric-item">
            <span class="metric-label">缓存命中率</span>
            <span class="metric-value">{$metricsStore.cacheHitRate.toFixed(1)}%</span>
          </div>
          
          <div class="metric-item">
            <span class="metric-label">吞吐量</span>
            <span class="metric-value">{$metricsStore.throughput.toFixed(1)} 项/秒</span>
          </div>

          {#if showAdvancedMetrics}
            <div class="metric-item" transition:scale>
              <span class="metric-label">网络延迟</span>
              <span class="metric-value">{$metricsStore.networkLatency.toFixed(0)}ms</span>
            </div>
            
            <div class="metric-item" transition:scale>
              <span class="metric-label">错误率</span>
              <span class="metric-value">{$metricsStore.errorRate.toFixed(2)}%</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {:else}
    <div class="loading-state" transition:fade>
      <div class="spinner"></div>
      <p>正在加载进度信息...</p>
    </div>
  {/if}
</div>

<!-- 恢复显示按钮 -->
{#if !isVisible && !$progressStore}
  <button
    class="show-button"
    onclick={() => isVisible = true}
    transition:fly={{ y: 20, duration: 300 }}
  >
    显示进度监控
  </button>
{/if}

<style>
  .progress-monitor {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .progress-monitor.compact {
    padding: 0.75rem;
    margin: 0.5rem 0;
  }

  .progress-monitor.hidden {
    display: none;
  }

  .monitor-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .task-info {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
  }

  .status-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .task-details {
    flex: 1;
  }

  .task-name {
    margin: 0 0 0.25rem 0;
    color: var(--text-normal);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .current-step {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .task-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    background: var(--background-modifier-hover);
  }

  .progress-section {
    margin-bottom: 1rem;
  }

  .progress-bar {
    position: relative;
    height: 24px;
    background: var(--background-secondary);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-bar.error {
    background: color-mix(in srgb, var(--text-error) 20%, var(--background-secondary));
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
    border-radius: 12px;
    transition: width 0.3s ease;
  }

  .progress-bar.error .progress-fill {
    background: linear-gradient(90deg, var(--text-error), color-mix(in srgb, var(--text-error) 80%, #000));
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--text-on-accent);
    font-size: 0.8rem;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .stat {
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .details-section {
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .metadata-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metadata-item .label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .metadata-item .value {
    font-size: 0.9rem;
    color: var(--text-normal);
    font-weight: 500;
  }

  .messages {
    margin-top: 1rem;
  }

  .messages h5 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
  }

  .message {
    margin: 0.25rem 0;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .message.warning {
    background: color-mix(in srgb, var(--text-warning) 10%, var(--background-primary));
    border-left: 3px solid var(--text-warning);
  }

  .message.error {
    background: color-mix(in srgb, var(--text-error) 10%, var(--background-primary));
    border-left: 3px solid var(--text-error);
  }

  .metrics-section {
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .metrics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .metrics-header h5 {
    margin: 0;
    color: var(--text-normal);
    font-size: 1rem;
  }

  .toggle-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border-radius: 4px;
  }

  .metric-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .metric-value {
    font-size: 1rem;
    color: var(--text-normal);
    font-weight: 600;
  }

  .loading-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top: 3px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .restore-btn {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: var(--weave-z-overlay);
  }

  .restore-btn:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-2px);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .progress-monitor {
      padding: 0.75rem;
    }

    .metadata-grid, .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .progress-stats {
      flex-direction: column;
      gap: 0.25rem;
    }

    .task-controls {
      flex-direction: column;
    }
  }
</style>
