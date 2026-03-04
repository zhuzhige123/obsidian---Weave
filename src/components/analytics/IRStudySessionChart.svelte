<!--
  历史学习行为散点图组件
  显示用户在一天中什么时间点进行增量阅读学习
  - x轴: 时间点 (0-24小时)
  - y轴: 日期/星期 (可切换)
  - 颜色深浅: 学习时长
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Platform } from 'obsidian';
  import type AnkiObsidianPlugin from '../../main';
  import type { IRStudySession, IRDeck } from '../../types/ir-types';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { logger } from '../../utils/logger';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import * as echarts from 'echarts/core';
  import type { EChartsCoreOption } from 'echarts/core';
  import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    VisualMapComponent,
    DataZoomComponent
  } from 'echarts/components';
  import { ScatterChart } from 'echarts/charts';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([
    TitleComponent,
    TooltipComponent,
    GridComponent,
    VisualMapComponent,
    DataZoomComponent,
    ScatterChart,
    CanvasRenderer
  ]);

  interface Props {
    plugin: AnkiObsidianPlugin;
    allDecks: IRDeck[];
    selectedDeckIds: Set<string>;
    showGlobalLoad: boolean;
  }

  let { plugin, allDecks, selectedDeckIds, showGlobalLoad }: Props = $props();

  // 图表相关
  let chartRef: HTMLDivElement | null = $state(null);
  let chart: echarts.ECharts | null = null;
  let themeObserver: MutationObserver | null = null;

  // 视图模式: 'date' | 'weekday'
  let viewMode = $state<'date' | 'weekday'>('date');

  // 会话数据
  let sessions = $state<IRStudySession[]>([]);

  // 最小会话时长（秒）- 1分钟
  const MIN_SESSION_DURATION = 60;

  const isMobile = Platform.isMobile;

  // 星期映射
  const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 获取主题颜色
  function getThemeColors() {
    const isDark = document.body.classList.contains('theme-dark');
    return {
      textColor: isDark ? '#e0e0e0' : '#2c3e50',
      axisLineColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
      splitLineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      tooltipBg: isDark ? '#1a1a1a' : '#ffffff',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    };
  }

  // 加载会话数据
  async function loadSessions() {
    try {
      const irStorage = new IRStorageService(plugin.app);
      await irStorage.initialize();
      const allSessions = await irStorage.getStudySessions();
      
      // 过滤：至少30分钟的会话
      sessions = allSessions.filter(s => s.confirmedDuration >= MIN_SESSION_DURATION);
      
      logger.info(`[IRStudySessionChart] 加载了 ${sessions.length} 个有效会话 (>=${MIN_SESSION_DURATION/60}分钟)`);
    } catch (error) {
      logger.error('[IRStudySessionChart] 加载会话数据失败:', error);
      sessions = [];
    }
  }

  // 过滤会话（根据牌组选择）
  function getFilteredSessions(): IRStudySession[] {
    if (showGlobalLoad) {
      return sessions;
    }

    const selectedAliases = new Set<string>();
    for (const id of selectedDeckIds) {
      selectedAliases.add(id);
      const deck = allDecks.find(d => d.id === id || d.path === id);
      if (deck?.id) selectedAliases.add(deck.id);
      if (deck?.path) selectedAliases.add(deck.path);
    }

    return sessions.filter(s => selectedAliases.has(s.deckId));
  }

  // 生成散点图数据
  function generateChartData() {
    const filteredSessions = getFilteredSessions();
    
    if (viewMode === 'date') {
      return generateDateViewData(filteredSessions);
    } else {
      return generateWeekdayViewData(filteredSessions);
    }
  }

  // 日期视图数据
  function generateDateViewData(filteredSessions: IRStudySession[]) {
    // 收集所有日期
    const dateSet = new Set<string>();
    filteredSessions.forEach(s => {
      const date = s.startTime.split('T')[0];
      dateSet.add(date);
    });
    
    // 排序日期
    const dates = Array.from(dateSet).sort();
    
    // 生成数据点
    const data = filteredSessions.map(s => {
      const startDate = new Date(s.startTime);
      const date = s.startTime.split('T')[0];
      const timeOfDay = startDate.getHours() + startDate.getMinutes() / 60;
      const durationMinutes = Math.round(s.confirmedDuration / 60);
      
      return {
        value: [timeOfDay, dates.indexOf(date), durationMinutes],
        session: s
      };
    });
    
    return { data, yAxisData: dates };
  }

  // 星期视图数据
  function generateWeekdayViewData(filteredSessions: IRStudySession[]) {
    const data = filteredSessions.map(s => {
      const startDate = new Date(s.startTime);
      const timeOfDay = startDate.getHours() + startDate.getMinutes() / 60;
      const weekday = startDate.getDay();
      const durationMinutes = Math.round(s.confirmedDuration / 60);
      
      return {
        value: [timeOfDay, weekday, durationMinutes],
        session: s
      };
    });
    
    return { data, yAxisData: weekdayLabels };
  }

  // 初始化图表
  function initChart() {
    if (!chartRef) return;
    
    if (chart) {
      chart.dispose();
    }
    
    chart = echarts.init(chartRef);
    updateChart();
    
    // 监听主题变化
    themeObserver = new MutationObserver(() => {
      updateChartTheme();
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
  }

  // 更新图表
  function updateChart() {
    if (!chart) return;
    
    const { data, yAxisData } = generateChartData();
    const colors = getThemeColors();
    
    // 计算最大时长用于颜色映射
    const maxDuration = Math.max(...data.map(d => d.value[2]), 60);
    
    const option: EChartsCoreOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        textStyle: {
          color: colors.textColor,
          fontSize: 12
        },
        formatter: (params: any) => {
          const session = params.data.session as IRStudySession;
          const startDate = new Date(session.startTime);
          const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
          const dateStr = session.startTime.split('T')[0];
          const durationMin = Math.round(session.confirmedDuration / 60);
          
          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">${session.deckName}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${colors.textColor}80;">日期</span>
                <span>${dateStr}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${colors.textColor}80;">开始时间</span>
                <span>${timeStr}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${colors.textColor}80;">学习时长</span>
                <span style="color: #7C3AED; font-weight: 600;">${durationMin}分钟</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${colors.textColor}80;">完成内容块</span>
                <span>${session.blocksCompleted}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${colors.textColor}80;">创建卡片</span>
                <span>${session.cardsCreated}</span>
              </div>
            </div>
          `;
        }
      },
      grid: {
        left: isMobile ? (viewMode === 'date' ? 50 : 35) : (viewMode === 'date' ? 80 : 50),
        right: isMobile ? 50 : 80,
        top: isMobile ? 10 : 20,
        bottom: isMobile ? 35 : 50
      },
      xAxis: {
        type: 'value',
        name: '时间',
        nameLocation: 'middle',
        nameGap: isMobile ? 20 : 30,
        min: 0,
        max: 24,
        interval: 4,
        axisLabel: {
          formatter: (value: number) => `${value}:00`,
          color: colors.textColor
        },
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: { color: colors.axisLineColor }
        },
        splitLine: {
          lineStyle: { color: colors.splitLineColor }
        }
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        axisLabel: {
          color: colors.textColor,
          fontSize: isMobile ? 9 : 11,
          formatter: isMobile && viewMode === 'date' 
            ? (value: string) => {
                const parts = value.split('-');
                return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
              }
            : undefined
        },
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: { color: colors.axisLineColor }
        },
        splitLine: {
          show: true,
          lineStyle: { color: colors.splitLineColor }
        }
      },
      visualMap: {
        type: 'continuous',
        min: 1,
        max: maxDuration,
        dimension: 2,
        orient: 'vertical',
        right: isMobile ? 2 : 10,
        top: 'center',
        itemHeight: isMobile ? 80 : 120,
        itemWidth: isMobile ? 12 : 20,
        text: ['长', '短'],
        textStyle: {
          color: colors.textColor,
          fontSize: isMobile ? 9 : 11
        },
        inRange: {
          color: ['#C4B5FD', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6']
        },
        formatter: (value: number) => `${Math.round(value)}分`
      },
      series: [{
        type: 'scatter',
        data: data,
        symbolSize: (val: number[]) => {
          // 根据时长调整点大小
          const duration = val[2];
          return Math.min(Math.max(duration / 10 + 8, 10), 24);
        },
        itemStyle: {
          opacity: 0.8
        },
        emphasis: {
          itemStyle: {
            opacity: 1,
            shadowBlur: 10,
            shadowColor: 'rgba(124, 58, 237, 0.5)'
          }
        }
      }]
    };
    
    chart.setOption(option);
  }

  // 更新图表主题
  function updateChartTheme() {
    if (chart) {
      updateChart();
    }
  }

  // 处理窗口大小变化
  function handleResize() {
    chart?.resize();
  }

  // 切换视图模式
  function toggleViewMode(mode: 'date' | 'weekday') {
    viewMode = mode;
    updateChart();
  }

  // 响应外部数据变化
  $effect(() => {
    // 当牌组选择或全局模式变化时，更新图表
    if (chart && (selectedDeckIds || showGlobalLoad !== undefined)) {
      updateChart();
    }
  });

  onMount(async () => {
    await loadSessions();
    if (chartRef) {
      setTimeout(() => initChart(), 100);
    }
  });

  onDestroy(() => {
    chart?.dispose();
    window.removeEventListener('resize', handleResize);
    themeObserver?.disconnect();
  });
</script>

<div class="study-session-chart-container">
  <!-- 视图切换 -->
  <div class="view-toggle">
    <span class="toggle-label">Y轴显示:</span>
    <div class="toggle-buttons">
      <button 
        class="toggle-btn" 
        class:active={viewMode === 'date'}
        onclick={() => toggleViewMode('date')}
      >
        日期
      </button>
      <button 
        class="toggle-btn" 
        class:active={viewMode === 'weekday'}
        onclick={() => toggleViewMode('weekday')}
      >
        星期
      </button>
    </div>
  </div>

  <!-- 图表容器 -->
  <div class="chart-wrapper" bind:this={chartRef}></div>

  <!-- 统计摘要 -->
  <div class="stats-summary">
    <div class="summary-item">
      <span class="summary-label">有效会话</span>
      <span class="summary-value">{getFilteredSessions().length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">总学习时长</span>
      <span class="summary-value">
        {Math.round(getFilteredSessions().reduce((sum, s) => sum + s.confirmedDuration, 0) / 3600)}小时
      </span>
    </div>
    <div class="summary-item">
      <span class="summary-label">平均时长</span>
      <span class="summary-value">
        {getFilteredSessions().length > 0 
          ? Math.round(getFilteredSessions().reduce((sum, s) => sum + s.confirmedDuration, 0) / getFilteredSessions().length / 60)
          : 0}分钟
      </span>
    </div>
  </div>
</div>

<style>
  .study-session-chart-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
  }

  .view-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toggle-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .toggle-buttons {
    display: flex;
    gap: 4px;
  }

  .toggle-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    background: var(--background-primary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .toggle-btn.active {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }

  .chart-wrapper {
    flex: 1;
    min-height: 300px;
    width: 100%;
  }

  .stats-summary {
    display: flex;
    gap: 24px;
    padding: 12px 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .summary-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .summary-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  @media (max-width: 600px) {
    .stats-summary {
      flex-wrap: wrap;
      gap: 16px;
    }

    .summary-item {
      min-width: 80px;
    }
  }
</style>
