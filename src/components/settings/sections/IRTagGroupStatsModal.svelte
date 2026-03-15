<!--
  增量阅读标签组参数统计模态窗
  职责：展示 IRTagGroupProfile 的参数学习统计与历史变化曲线
  
  @version 3.0.0
-->
<script lang="ts">
  import type { IRTagGroup, IRTagGroupProfile, IRProfileHistoryPoint } from '../../../types/ir-types';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';
  import { tr } from '../../../utils/i18n';
  let t = $derived($tr);

  interface Props {
    group: IRTagGroup;
    profile: IRTagGroupProfile;
    onClose: () => void;
  }

  let { group, profile, onClose }: Props = $props();

  // 图表配置
  const CHART_WIDTH = 440;
  const CHART_HEIGHT = 180;
  const PADDING = { top: 16, right: 16, bottom: 32, left: 45 };
  const INNER_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // 是否有有效历史数据
  let hasHistory = $derived(profile.history && profile.history.length > 1);

  // 获取历史数据
  let historyData = $derived.by(() => {
    if (profile.history && profile.history.length > 0) {
      return profile.history;
    }
    return [] as IRProfileHistoryPoint[];
  });

  // Y 轴范围
  let yMin = $derived.by(() => {
    if (historyData.length === 0) return 1.0;
    return Math.floor((Math.min(...historyData.map(d => d.value)) - 0.1) * 10) / 10;
  });
  
  let yMax = $derived.by(() => {
    if (historyData.length === 0) return 2.0;
    return Math.ceil((Math.max(...historyData.map(d => d.value)) + 0.1) * 10) / 10;
  });

  // 生成 SVG 路径
  let pathD = $derived.by(() => {
    if (historyData.length < 2) return '';
    const range = yMax - yMin || 1;
    const points = historyData.map((d, i) => {
      const x = PADDING.left + (i / (historyData.length - 1)) * INNER_WIDTH;
      const y = PADDING.top + INNER_HEIGHT - ((d.value - yMin) / range) * INNER_HEIGHT;
      return { x, y };
    });
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  });

  // 数据点位置
  let dataPoints = $derived.by(() => {
    if (historyData.length < 2) return [];
    const range = yMax - yMin || 1;
    return historyData.map((d, i) => ({
      x: PADDING.left + (i / (historyData.length - 1)) * INNER_WIDTH,
      y: PADDING.top + INNER_HEIGHT - ((d.value - yMin) / range) * INNER_HEIGHT,
      data: d
    }));
  });

  // Y 轴刻度
  let yTicks = $derived.by(() => {
    const ticks = [];
    const range = yMax - yMin || 1;
    for (let i = 0; i <= 4; i++) {
      const value = yMin + (range * i) / 4;
      const y = PADDING.top + INNER_HEIGHT - (i / 4) * INNER_HEIGHT;
      ticks.push({ value, y });
    }
    return ticks;
  });

  // 格式化日期
  function formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function formatDateTime(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  // 悬停状态
  let hoveredPoint = $state<{ x: number; y: number; data: IRProfileHistoryPoint } | null>(null);

  // 点击背景关闭
  function handleOverlayClick() {
    onClose();
  }
</script>

<div class="stats-overlay">
  <button
    type="button"
    class="stats-backdrop"
    aria-label={t('common.close')}
    onclick={handleOverlayClick}
  ></button>
  <div class="stats-dialog" role="dialog" aria-modal="true" tabindex="-1">
    <!-- 头部 -->
    <div class="dialog-header">
      <h3>{t('irTagGroup.stats.title')}</h3>
      <button class="close-btn" onclick={onClose}>
        <EnhancedIcon name="x" size={20} />
      </button>
    </div>

    <!-- 内容 -->
    <div class="dialog-body">
      <!-- 组信息 -->
      <div class="section-block">
        <div class="group-title">{group.name}</div>
        {#if group.matchAnyTags.length > 0}
          <div class="group-tags">
            {#each group.matchAnyTags.slice(0, 6) as tag}
              <span class="tag-chip">{tag}</span>
            {/each}
            {#if group.matchAnyTags.length > 6}
              <span class="tag-more">+{group.matchAnyTags.length - 6}</span>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 参数概览（列表形式） -->
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">{t('irTagGroup.stats.intervalFactor')}</span>
          <span class="info-value highlight">{profile.intervalFactorBase.toFixed(3)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{t('irTagGroup.stats.coldStartMultiplier')}</span>
          <span class="info-value">{profile.initialIntervalMultiplier.toFixed(2)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{t('irTagGroup.stats.sampleCount')}</span>
          <span class="info-value">{profile.sampleCount}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{t('irTagGroup.stats.lastUpdated')}</span>
          <span class="info-value">{formatDateTime(profile.updatedAt)}</span>
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="chart-section">
        <div class="section-title">{t('irTagGroup.stats.trendTitle')}</div>
        
        {#if hasHistory}
          <div class="chart-wrapper">
            <svg width={CHART_WIDTH} height={CHART_HEIGHT} class="chart-svg">
              <!-- 背景网格 -->
              {#each yTicks as tick}
                <line 
                  x1={PADDING.left} 
                  y1={tick.y} 
                  x2={CHART_WIDTH - PADDING.right} 
                  y2={tick.y} 
                  class="grid-line"
                />
                <text 
                  x={PADDING.left - 6} 
                  y={tick.y + 3} 
                  class="axis-text"
                  text-anchor="end"
                >{tick.value.toFixed(2)}</text>
              {/each}

              <!-- 坐标轴 -->
              <line 
                x1={PADDING.left} 
                y1={CHART_HEIGHT - PADDING.bottom} 
                x2={CHART_WIDTH - PADDING.right} 
                y2={CHART_HEIGHT - PADDING.bottom} 
                class="axis-line"
              />
              <line 
                x1={PADDING.left} 
                y1={PADDING.top} 
                x2={PADDING.left} 
                y2={CHART_HEIGHT - PADDING.bottom} 
                class="axis-line"
              />

              <!-- 数据线 -->
              <path d={pathD} class="data-line" />

              <!-- 数据点 -->
              {#each dataPoints as point}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle 
                  cx={point.x} 
                  cy={point.y} 
                  r={hoveredPoint === point ? 5 : 3}
                  class="data-point"
                  class:active={hoveredPoint === point}
                  onmouseenter={() => hoveredPoint = point}
                  onmouseleave={() => hoveredPoint = null}
                />
              {/each}

              <!-- X 轴标签 -->
              {#if historyData.length >= 2}
                <text 
                  x={PADDING.left} 
                  y={CHART_HEIGHT - PADDING.bottom + 16} 
                  class="axis-text"
                  text-anchor="start"
                >{formatDate(historyData[0].timestamp)}</text>
                <text 
                  x={CHART_WIDTH - PADDING.right} 
                  y={CHART_HEIGHT - PADDING.bottom + 16} 
                  class="axis-text"
                  text-anchor="end"
                >{formatDate(historyData[historyData.length - 1].timestamp)}</text>
              {/if}
            </svg>

            <!-- 悬停提示 -->
            {#if hoveredPoint}
              <div 
                class="chart-tooltip" 
                style="left: {Math.min(Math.max(hoveredPoint.x, 60), CHART_WIDTH - 60)}px; top: {hoveredPoint.y - 45}px;"
              >
                <div class="tooltip-val">{hoveredPoint.data.value.toFixed(3)}</div>
                <div class="tooltip-info">n={hoveredPoint.data.sampleCount}</div>
                <div class="tooltip-info">{formatDate(hoveredPoint.data.timestamp)}</div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-chart">
            <span class="empty-text">{t('irTagGroup.stats.noHistory')}</span>
            <span class="empty-hint">{t('irTagGroup.stats.noHistoryHint')}</span>
          </div>
        {/if}
      </div>

      <!-- 说明 -->
      <div class="note-block">
        <div class="note-title">
          <EnhancedIcon name="info" size={14} />
          <span>{t('irTagGroup.stats.paramNoteTitle')}</span>
        </div>
        <div class="note-text">
          {t('irTagGroup.stats.paramNoteContent')}
        </div>
      </div>
    </div>

    <!-- 底部 -->
    <div class="dialog-footer">
      <button class="btn primary" onclick={onClose}>{t('irTagGroup.stats.closeBtn')}</button>
    </div>
  </div>
</div>

<style>
  .stats-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
    padding: 20px;
  }

  .stats-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
  }

  .stats-dialog {
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .dialog-body {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }

  .section-block {
    margin-bottom: 16px;
  }

  .group-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .group-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-chip {
    padding: 2px 8px;
    font-size: 0.75rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
  }

  .tag-more {
    padding: 2px 6px;
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 12px 14px;
    background: var(--background-secondary);
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .info-value {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  .info-value.highlight {
    color: var(--interactive-accent);
    font-weight: 600;
  }

  .chart-section {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 10px;
  }

  .chart-wrapper {
    position: relative;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 12px;
    overflow: hidden;
  }

  .chart-svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .grid-line {
    stroke: var(--background-modifier-border);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .axis-line {
    stroke: var(--text-faint);
    stroke-width: 1;
  }

  .axis-text {
    font-size: 10px;
    fill: var(--text-muted);
  }

  .data-line {
    fill: none;
    stroke: var(--interactive-accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .data-point {
    fill: var(--interactive-accent);
    stroke: var(--background-secondary);
    stroke-width: 2;
    cursor: pointer;
    transition: r 0.1s ease;
  }

  .data-point.active {
    fill: var(--text-on-accent);
    stroke: var(--interactive-accent);
    stroke-width: 3;
  }

  .chart-tooltip {
    position: absolute;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 6px 10px;
    pointer-events: none;
    transform: translateX(-50%);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
    text-align: center;
  }

  .tooltip-val {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--interactive-accent);
  }

  .tooltip-info {
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .empty-chart {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    background: var(--background-secondary);
    border-radius: 8px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .note-block {
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .note-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .note-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    padding: 14px 20px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary-alt);
  }

  .btn {
    padding: 8px 20px;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn.primary:hover {
    background: var(--interactive-accent-hover);
  }
</style>
