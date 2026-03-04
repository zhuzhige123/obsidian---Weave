<script lang="ts">
  /**
   * 移动端牌组分析控制栏组件
   * 
   * Part A Task 5: 牌组分析模态窗移动端重构
   * 包含：左侧图表类型下拉、中间展开/折叠按钮、右侧时间范围下拉
   * 
   * @module components/study/MobileAnalysisControlBar
   * @version 1.0.0
   */
  import BottomSheetModal from '../ui/BottomSheetModal.svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface Props {
    /** 当前图表类型 */
    chartType: 'retention' | 'quantity' | 'timing' | 'difficulty' | 'loadForecast';
    /** 当前时间范围（天数） */
    timeRange: number;
    /** 统计栏是否展开 */
    statsExpanded: boolean;
    /** 图表类型变更回调 */
    onChartTypeChange: (type: string) => void;
    /** 时间范围变更回调 */
    onTimeRangeChange: (days: number) => void;
    /** 统计栏展开/折叠回调 */
    onToggleStats: () => void;
  }

  let {
    chartType = 'retention',
    timeRange = 30,
    statsExpanded = false,
    onChartTypeChange,
    onTimeRangeChange,
    onToggleStats
  }: Props = $props();

  // 下拉菜单状态
  let showChartTypeSheet = $state(false);
  let showTimeRangeSheet = $state(false);

  // 图表类型选项
  const chartTypeOptions = [
    { id: 'retention', label: '记忆曲线', icon: 'activity' },
    { id: 'quantity', label: '卡片数量', icon: 'bar-chart-2' },
    { id: 'timing', label: '复习热力图', icon: 'calendar' },
    { id: 'difficulty', label: '学习统计', icon: 'pie-chart' },
    { id: 'loadForecast', label: '负荷预测', icon: 'trending-up' }
  ];

  // 时间范围选项
  const timeRangeOptions = [
    { days: 7, label: '7天' },
    { days: 14, label: '14天' },
    { days: 30, label: '30天' },
    { days: 60, label: '60天' },
    { days: 90, label: '90天' }
  ];

  // 获取当前图表类型标签
  const currentChartLabel = $derived(
    chartTypeOptions.find(opt => opt.id === chartType)?.label || '记忆曲线'
  );

  // 获取当前时间范围标签
  const currentTimeLabel = $derived(
    timeRangeOptions.find(opt => opt.days === timeRange)?.label || '30天'
  );

  function handleChartTypeSelect(type: string) {
    onChartTypeChange(type);
    showChartTypeSheet = false;
  }

  function handleTimeRangeSelect(days: number) {
    onTimeRangeChange(days);
    showTimeRangeSheet = false;
  }
</script>

<!-- 移动端控制栏 -->
<div class="mobile-analysis-control-bar">
  <!-- 左侧：图表类型下拉 -->
  <button class="dropdown-btn" onclick={() => showChartTypeSheet = true}>
    <span>{currentChartLabel}</span>
    <span class="dropdown-icon">▼</span>
  </button>

  <!-- 中间：展开/折叠按钮 -->
  <button
    class="expand-toggle"
    class:expanded={statsExpanded}
    onclick={onToggleStats}
    aria-label={statsExpanded ? '折叠统计' : '展开统计'}
  >
    <EnhancedIcon name={statsExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
  </button>

  <!-- 右侧：时间范围下拉 -->
  <button class="dropdown-btn" onclick={() => showTimeRangeSheet = true}>
    <span>{currentTimeLabel}</span>
    <span class="dropdown-icon">▼</span>
  </button>
</div>

<!-- 图表类型选择 Bottom Sheet -->
<BottomSheetModal
  isOpen={showChartTypeSheet}
  onClose={() => showChartTypeSheet = false}
  title="选择图表类型"
  height="auto"
>
  <div class="dropdown-menu-items">
    {#each chartTypeOptions as option}
      <button
        class="dropdown-menu-item"
        class:selected={option.id === chartType}
        onclick={() => handleChartTypeSelect(option.id)}
      >
        <span class="menu-item-icon">
          <EnhancedIcon name={option.icon} size={16} />
        </span>
        <span class="menu-item-text">{option.label}</span>
        {#if option.id === chartType}
          <span class="check-icon">
            <EnhancedIcon name="check" size={14} />
          </span>
        {/if}
      </button>
    {/each}
  </div>
</BottomSheetModal>

<!-- 时间范围选择 Bottom Sheet -->
<BottomSheetModal
  isOpen={showTimeRangeSheet}
  onClose={() => showTimeRangeSheet = false}
  title="选择时间范围"
  height="auto"
>
  <div class="dropdown-menu-items">
    {#each timeRangeOptions as option}
      <button
        class="dropdown-menu-item"
        class:selected={option.days === timeRange}
        onclick={() => handleTimeRangeSelect(option.days)}
      >
        <span class="menu-item-text">{option.label}</span>
        {#if option.days === timeRange}
          <span class="check-icon">
            <EnhancedIcon name="check" size={14} />
          </span>
        {/if}
      </button>
    {/each}
  </div>
</BottomSheetModal>

<style>
  .mobile-analysis-control-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .dropdown-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    min-width: 90px;
  }

  .dropdown-btn:active {
    background: var(--background-modifier-hover);
    border-color: var(--weave-mobile-primary-color, #7c3aed);
  }

  .dropdown-icon {
    font-size: 10px;
    color: var(--text-muted);
    margin-left: auto;
  }

  .expand-toggle {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .expand-toggle:active {
    background: var(--background-modifier-hover);
  }

  .expand-toggle.expanded {
    background: rgba(124, 58, 237, 0.2);
    border-color: var(--weave-mobile-primary-color, #7c3aed);
    color: var(--weave-mobile-primary-color, #a78bfa);
  }

  .dropdown-menu-items {
    padding: 8px 0;
  }

  .dropdown-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    color: var(--text-normal);
    font-size: 15px;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
  }

  .dropdown-menu-item:active {
    background: var(--background-secondary);
  }

  .dropdown-menu-item.selected {
    color: var(--weave-mobile-primary-color, #a78bfa);
  }

  .menu-item-icon {
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .dropdown-menu-item.selected .menu-item-icon {
    color: var(--weave-mobile-primary-color, #a78bfa);
  }

  .menu-item-text {
    flex: 1;
  }

  .check-icon {
    color: var(--weave-mobile-primary-color, #a78bfa);
  }
</style>
