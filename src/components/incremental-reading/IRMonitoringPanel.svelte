<!--
  IRMonitoringPanel - 增量阅读监控报表组件 v3.0
  
  功能：
  - 今日统计概览
  - TagGroup 展示占比
  - 最近7天趋势
  - 组参数变化监控
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import type { 
    DailyStats, 
    TagGroupSummary,
    IRMonitoringService 
  } from '../../services/incremental-reading/IRMonitoringService';

  interface Props {
    monitoringService: IRMonitoringService;
    onClose?: () => void;
  }

  let { monitoringService, onClose }: Props = $props();

  // 数据状态
  let todayStats = $state<DailyStats | null>(null);
  let weeklyStats = $state<DailyStats[]>([]);
  let tagGroupSummaries = $state<TagGroupSummary[]>([]);
  let summaryReport = $state<{
    weeklyAvg: { dueCount: number; scheduledCount: number; completedCount: number; readingMinutes: number };
    trends: { dueCountTrend: number; completionRateTrend: number };
  } | null>(null);

  let isLoading = $state(true);

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      await monitoringService.load();
      
      const report = monitoringService.getSummaryReport();
      todayStats = report.today;
      summaryReport = {
        weeklyAvg: report.weeklyAvg,
        trends: report.trends
      };
      weeklyStats = monitoringService.getRecentStats(7);
    } catch (error) {
      console.error('[IRMonitoringPanel] 加载数据失败:', error);
    } finally {
      isLoading = false;
    }
  }

  // 格式化时长
  function formatMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}小时${mins > 0 ? mins + '分' : ''}`;
  }

  // 格式化趋势
  function formatTrend(value: number): { text: string; color: string; icon: string } {
    if (Math.abs(value) < 0.01) {
      return { text: '持平', color: 'var(--text-muted)', icon: 'minus' };
    }
    if (value > 0) {
      return { text: `+${value.toFixed(1)}`, color: 'var(--text-error)', icon: 'trending-up' };
    }
    return { text: value.toFixed(1), color: 'var(--text-success)', icon: 'trending-down' };
  }

  // 格式化百分比
  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  // 计算柱状图高度
  function getBarHeight(value: number, max: number): number {
    if (max === 0) return 0;
    return Math.min((value / max) * 100, 100);
  }

  let maxDue = $derived(
    weeklyStats.length > 0 ? Math.max(...weeklyStats.map(s => s.dueCount), 1) : 1
  );

  let dueCountTrend = $derived(
    summaryReport ? formatTrend(summaryReport.trends.dueCountTrend) : null
  );

  let completionRateTrend = $derived(
    summaryReport ? formatTrend(summaryReport.trends.completionRateTrend * 100) : null
  );
</script>

<div class="ir-monitoring-panel">
  <!-- 头部 -->
  <div class="panel-header">
    <h3 class="panel-title">
      <EnhancedIcon name="bar-chart-2" size={20} />
      增量阅读统计
    </h3>
    {#if onClose}
      <button class="close-btn" onclick={onClose}>
        <EnhancedIcon name="x" size={18} />
      </button>
    {/if}
  </div>

  {#if isLoading}
    <div class="loading-state">
      <EnhancedIcon name="loader" size={24} />
      <span>加载中...</span>
    </div>
  {:else}
    <!-- 今日概览 -->
    <section class="stats-section">
      <h4 class="section-title">今日概览</h4>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{todayStats?.dueCount ?? 0}</div>
          <div class="stat-label">到期数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{todayStats?.scheduledCount ?? 0}</div>
          <div class="stat-label">已安排</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{todayStats?.completedBlocksCount ?? 0}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{formatMinutes((todayStats?.totalActualReadingSeconds ?? 0) / 60)}</div>
          <div class="stat-label">阅读时长</div>
        </div>
      </div>
    </section>

    <!-- 周均与趋势 -->
    {#if summaryReport}
    <section class="stats-section">
      <h4 class="section-title">本周趋势</h4>
      
      <div class="trend-cards">
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-label">日均到期</span>
            <span class="trend-indicator" style="color: {dueCountTrend?.color ?? 'var(--text-muted)'}">
              <EnhancedIcon name={dueCountTrend?.icon ?? 'minus'} size={14} />
              {dueCountTrend?.text ?? ''}
            </span>
          </div>
          <div class="trend-value">{summaryReport.weeklyAvg.dueCount.toFixed(1)}</div>
        </div>
        
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-label">完成率趋势</span>
            <span class="trend-indicator" style="color: {summaryReport.trends.completionRateTrend >= 0 ? 'var(--text-success)' : 'var(--text-error)'}">
              <EnhancedIcon name={summaryReport.trends.completionRateTrend >= 0 ? 'trending-up' : 'trending-down'} size={14} />
              {completionRateTrend?.text ?? ''}%
            </span>
          </div>
          <div class="trend-value">{formatMinutes(summaryReport.weeklyAvg.readingMinutes)}/日</div>
        </div>
      </div>
    </section>
    {/if}

    <!-- 最近7天柱状图 -->
    {#if weeklyStats.length > 0}
    <section class="stats-section">
      <h4 class="section-title">最近7天</h4>

      <div class="weekly-chart">
        {#each weeklyStats as day}
          {@const date = new Date(day.date)}
          {@const dayLabel = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
          <div class="chart-bar-container">
            <div class="chart-bar-wrapper">
              <div 
                class="chart-bar scheduled"
                style="height: {getBarHeight(day.scheduledCount, maxDue)}%"
                title="已安排: {day.scheduledCount}"
              ></div>
              <div 
                class="chart-bar completed"
                style="height: {getBarHeight(day.completedBlocksCount, maxDue)}%"
                title="已完成: {day.completedBlocksCount}"
              ></div>
            </div>
            <div class="chart-label">{dayLabel}</div>
          </div>
        {/each}
      </div>
      
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-dot scheduled"></span>
          已安排
        </span>
        <span class="legend-item">
          <span class="legend-dot completed"></span>
          已完成
        </span>
      </div>
    </section>
    {/if}

    <!-- TagGroup 占比 -->
    {#if tagGroupSummaries.length > 0}
    <section class="stats-section">
      <h4 class="section-title">材料类型分布</h4>
      
      <div class="group-list">
        {#each tagGroupSummaries as group}
          <div class="group-item">
            <div class="group-info">
              <span class="group-name">{group.groupName}</span>
              <span class="group-count">{group.blockCount}块</span>
            </div>
            <div class="group-bar-container">
              <div 
                class="group-bar" 
                style="width: {group.appearanceRatio * 100}%"
              ></div>
            </div>
            <span class="group-ratio">{formatPercent(group.appearanceRatio)}</span>
          </div>
        {/each}
      </div>
    </section>
    {/if}

    <!-- 空状态 -->
    {#if !todayStats && weeklyStats.length === 0}
    <div class="empty-state">
      <EnhancedIcon name="inbox" size={48} />
      <p>暂无统计数据</p>
      <p class="hint">开始增量阅读后将自动记录</p>
    </div>
    {/if}
  {/if}
</div>

<style>
  .ir-monitoring-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--background-primary);
    border-radius: 8px;
    max-width: 400px;
  }

  /* 头部 */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    padding: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 加载状态 */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    color: var(--text-muted);
  }

  /* 区块 */
  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* 统计网格 */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-normal);
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* 趋势卡片 */
  .trend-cards {
    display: flex;
    gap: 12px;
  }

  .trend-card {
    flex: 1;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .trend-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .trend-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .trend-indicator {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .trend-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 柱状图 */
  .weekly-chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 100px;
    padding: 8px 0;
    gap: 4px;
  }

  .chart-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .chart-bar-wrapper {
    width: 100%;
    height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 2px;
  }

  .chart-bar {
    width: 80%;
    min-height: 2px;
    border-radius: 2px;
    transition: height 0.3s ease;
  }

  .chart-bar.scheduled {
    background: var(--interactive-accent);
    opacity: 0.4;
  }

  .chart-bar.completed {
    background: var(--text-success);
  }

  .chart-label {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .legend-dot.scheduled {
    background: var(--interactive-accent);
    opacity: 0.4;
  }

  .legend-dot.completed {
    background: var(--text-success);
  }

  /* 组列表 */
  .group-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-info {
    width: 100px;
    display: flex;
    flex-direction: column;
  }

  .group-name {
    font-size: 0.85rem;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-count {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .group-bar-container {
    flex: 1;
    height: 8px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .group-bar {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .group-ratio {
    width: 50px;
    text-align: right;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* 空状态 */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
  }

  .empty-state .hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }
</style>
