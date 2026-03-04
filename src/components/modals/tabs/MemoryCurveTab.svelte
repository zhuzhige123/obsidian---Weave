<script lang="ts">
  import { Platform } from 'obsidian';
  import MemoryCurveChart from '../../charts/MemoryCurveChartEcharts.svelte';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';
  import EnhancedButton from '../../ui/EnhancedButton.svelte';
  import { generateMemoryCurveData } from '../../../utils/memory-curve-utils';
  import type { Card } from '../../../data/types';
  import type { TimeRange, TimeRangeConfig } from '../../../types/view-card-modal-types';
  //  导入国际化
  import { tr } from '../../../utils/i18n';

  //  移动端检测
  const isMobile = Platform.isMobile;

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);

  // 时间范围配置
  const timeRanges = $derived([
    { value: '7d' as TimeRange, label: '最近7天', days: 7 },
    { value: '14d' as TimeRange, label: '最近14天', days: 14 },
    { value: '30d' as TimeRange, label: '最近30天', days: 30 },
    { value: '60d' as TimeRange, label: '最近60天', days: 60 },
    { value: '90d' as TimeRange, label: '最近90天', days: 90 }
  ]);

  // 当前选中的时间范围
  let selectedRange = $state<TimeRange>('30d');
  
  // 自定义日期范围
  let customDateStart = $state<string>('');
  let customDateEnd = $state<string>('');
  let showCustomDate = $state(false);

  // 生成曲线数据
  const curveData = $derived(generateMemoryCurveData(card, selectedRange));

  // 是否有足够的复习历史
  const hasEnoughData = $derived((card.reviewHistory || []).length >= 2);
</script>

<div class="memory-curve-tab" class:mobile={isMobile} role="tabpanel" id="curve-panel">
  <!-- 时间范围选择器 -->
  <section class="curve-controls" class:mobile={isMobile}>
    <div class="range-selector" class:mobile={isMobile}>
      <span class="range-label">快捷范围：</span>
      <div class="range-buttons" class:mobile={isMobile}>
        {#each timeRanges as range}
          <button
            class="range-button"
            class:active={selectedRange === range.value && !showCustomDate}
            onclick={() => { selectedRange = range.value; showCustomDate = false; }}
          >
            {isMobile ? range.label.replace('最近', '') : range.label}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- 自定义日期范围 -->
    <div class="custom-date-selector" class:mobile={isMobile}>
      <span class="range-label">自定义范围：</span>
      <div class="date-inputs" class:mobile={isMobile}>
        <input 
          type="date" 
          class="date-input"
          bind:value={customDateStart}
          onfocus={() => showCustomDate = true}
        />
        <span class="date-separator">至</span>
        <input 
          type="date" 
          class="date-input"
          bind:value={customDateEnd}
          onfocus={() => showCustomDate = true}
        />
        {#if !isMobile}
          <span class="date-hint">(30天)</span>
        {/if}
      </div>
    </div>
    
    <!--  移动端不显示鼠标滚轮提示 -->
    {#if !isMobile}
      <div class="hint-text">
        <span class="hint-indicator">ⓘ</span>
        <span>滑动鼠标滚轮或拖拽可快速切换查看范围</span>
      </div>
    {/if}
  </section>

  <!-- 图表区域 -->
  <section class="curve-chart-section">
    {#if !hasEnoughData}
      <div class="chart-empty">
        <div class="empty-icon">--</div>
        <h4>{t('modals.memoryCurveTab.emptyState.title')}</h4>
        <p>{t('modals.memoryCurveTab.emptyState.description')}</p>
        <p class="empty-hint">{t('modals.memoryCurveTab.emptyState.reviewCount').replace('{count}', String((card.reviewHistory || []).length))}</p>
      </div>
    {:else}
      <MemoryCurveChart data={curveData} timeRange={selectedRange} height={450} />
    {/if}
  </section>

  <!--  曲线解读区域已移除 - 用户反馈不需要 -->

  <!-- 统计摘要 -->
  {#if hasEnoughData}
    <section class="curve-summary" class:mobile={isMobile}>
      <div class="summary-item">
        <span class="summary-label">{t('modals.memoryCurveTab.summary.dataPoints')}</span>
        <span class="summary-value">{curveData.actual.length} {t('modals.memoryCurveTab.summary.pointsUnit')}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{t('modals.memoryCurveTab.summary.reviewMarkers')}</span>
        <span class="summary-value">{curveData.reviewMarkers.length} {t('modals.memoryCurveTab.summary.pointsUnit')}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{t('modals.memoryCurveTab.summary.currentStability')}</span>
        <span class="summary-value">{(card.fsrs?.stability || 0).toFixed(1)} {t('modals.memoryCurveTab.summary.daysUnit')}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{t('modals.memoryCurveTab.summary.currentRetrievability')}</span>
        <span class="summary-value">{((card.fsrs?.retrievability || 0) * 100).toFixed(1)}%</span>
      </div>
    </section>
  {/if}
</div>

<style>
  .memory-curve-tab {
    padding: var(--size-4-4);
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
    overflow-y: auto;
    height: 100%;
    min-height: 0;
  }

  .curve-controls {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: var(--size-4-4);
  }

  .range-selector {
    display: flex;
    align-items: center;
    gap: var(--size-4-3);
    flex-wrap: wrap;
  }

  .range-label {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-weight: 500;
  }

  .range-buttons {
    display: flex;
    gap: var(--size-4-2);
    flex-wrap: wrap;
  }

  .range-button {
    padding: 6px 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .range-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .range-button.active {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: white;
  }

  /* 自定义日期选择器 */
  .custom-date-selector {
    display: flex;
    align-items: center;
    gap: var(--size-4-3);
    flex-wrap: wrap;
    margin-top: var(--size-4-3);
    padding-top: var(--size-4-3);
    border-top: 1px solid var(--background-modifier-border);
  }

  .date-inputs {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    flex-wrap: wrap;
  }

  .date-input {
    padding: 6px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .date-input:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .date-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .date-separator {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .date-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    font-style: italic;
  }

  /* 提示文本 */
  .hint-text {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    margin-top: var(--size-4-2);
    padding: var(--size-4-2) var(--size-4-3);
    background: var(--background-secondary-alt);
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .curve-chart-section {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: var(--size-4-4);
    min-height: 450px;
  }

  .chart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 450px;
    color: var(--text-muted);
    text-align: center;
    gap: var(--size-4-2);
  }

  .chart-empty h4 {
    font-size: var(--font-ui-large);
    color: var(--text-normal);
    margin: 0;
  }

  .chart-empty p {
    font-size: var(--font-ui-medium);
    margin: 0;
  }

  .empty-hint {
    font-size: var(--font-ui-small);
    color: var(--text-faint);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--size-4-3);
    opacity: 0.5;
  }

  .hint-indicator {
    font-size: var(--font-ui-small);
    color: var(--text-accent);
    font-weight: 600;
  }

  .curve-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--size-4-3);
    padding: var(--size-4-3);
    background: var(--background-secondary);
    border-radius: var(--radius-m);
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
  }

  .summary-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .summary-value {
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 滚动条样式 */
  .memory-curve-tab::-webkit-scrollbar {
    width: 8px;
  }

  .memory-curve-tab::-webkit-scrollbar-track {
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .memory-curve-tab::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 4px;
  }

  .memory-curve-tab::-webkit-scrollbar-thumb:hover {
    background: var(--background-modifier-border-hover);
  }

  /* 响应式适配 */
  @media (max-width: 768px) {
    .curve-summary {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* ====================  移动端适配样式 ==================== */
  
  /* 移动端主容器 */
  .memory-curve-tab.mobile {
    padding: 12px;
    gap: 12px;
  }

  /* 移动端控制区域 */
  .curve-controls.mobile {
    padding: 12px;
  }

  /* 移动端范围选择器 - 垂直布局 */
  .range-selector.mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  /* 移动端快捷按钮 - 紧凑排列 */
  .range-buttons.mobile {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
  }

  .range-buttons.mobile .range-button {
    padding: 8px 12px;
    font-size: 13px;
    min-height: 36px;
    flex: 0 0 auto;
  }

  /* 移动端自定义日期选择器 - 单行布局 */
  .custom-date-selector.mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
  }

  .date-inputs.mobile {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .date-inputs.mobile .date-input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    font-size: 13px;
  }

  .date-inputs.mobile .date-separator {
    flex-shrink: 0;
  }

  /* 移动端统计摘要 - 2x2 网格 */
  .curve-summary.mobile {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 12px;
  }

  .curve-summary.mobile .summary-item {
    gap: 2px;
  }

  .curve-summary.mobile .summary-label {
    font-size: 11px;
  }

  .curve-summary.mobile .summary-value {
    font-size: 14px;
  }
</style>

