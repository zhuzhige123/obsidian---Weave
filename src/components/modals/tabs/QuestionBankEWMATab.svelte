<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type { Deck } from '../../../data/types';
  import type WeavePlugin from '../../../main';
  import { onMount, onDestroy } from 'svelte';
  import echarts, { type EChartsType } from '../../../utils/echarts-loader';
  import { getThemeColors, createGradient } from '../../../utils/echarts-theme';

  interface Props {
    questionBank: Deck;
    plugin: WeavePlugin;
  }

  let { questionBank, plugin }: Props = $props();

  let chartContainer: HTMLElement;
  let chart: EChartsType | null = null;

  // 生成EWMA趋势数据
  function generateEWMAData() {
    // 模拟最近30次测试的EWMA数据
    const dates = [];
    const ewmaData = [];
    const historicalData = [];
    const confidenceData = [];
    
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 29);
    
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + i);
      dates.push(currentDate.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }));
      
      // 模拟EWMA数据：整体上升趋势
      const base = 45 + i * 1.2;
      const noise = (Math.random() - 0.5) * 8;
      ewmaData.push(Math.max(0, Math.min(100, base + noise)));
      
      // 历史平均数据（变化较慢）
      historicalData.push(Math.max(0, Math.min(100, 55 + i * 0.5 + noise * 0.5)));
      
      // 置信度数据（随着样本增加而增加）
      confidenceData.push(Math.min(0.95, 0.3 + i * 0.022));
    }
    
    return { dates, ewmaData, historicalData, confidenceData };
  }

  function initializeChart() {
    if (!chartContainer) {
      logger.warn('[EWMA] Chart container not available');
      return;
    }

    try {
      const colors = getThemeColors();
      
      // 验证颜色值格式
      if (!colors.accent || !colors.success || !colors.warning) {
        logger.error('[EWMA] Invalid theme colors:', colors);
        return;
      }
      
      // 额外验证：确保颜色值不为空且格式正确
      const safeColors = {
        accent: colors.accent || '#7c3aed',
        success: colors.success || '#10b981',
        warning: colors.warning || '#f59e0b',
        textMuted: colors.textMuted || '#6b7280',
        backgroundSecondary: colors.backgroundSecondary || '#f3f4f6',
        border: colors.border || '#e5e7eb',
        text: colors.text || '#374151'
      };
      
      logger.debug('[EWMA] 使用安全颜色配置:', safeColors);
      
      chart = echarts.init(chartContainer);
    
    const { dates, ewmaData, historicalData, confidenceData } = generateEWMAData();
    
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: safeColors.backgroundSecondary,
        borderColor: safeColors.border,
        textStyle: { color: safeColors.text },
        formatter: function(params: any) {
          let result = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            const color = param.color;
            const value = param.seriesName === 'EWMA掌握度' || param.seriesName === '历史平均' ? 
              param.value.toFixed(1) + '%' : param.value.toFixed(2);
            result += `<div style="margin: 2px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%; margin-right: 8px;"></span>
              ${param.seriesName}: <span style="font-weight: 600;">${value}</span>
            </div>`;
          });
          return result;
        }
      },
      legend: {
        show: true,
        top: 10,
        textStyle: { color: safeColors.text },
        itemGap: 20
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: {
            color: safeColors.border
          }
        },
        axisLabel: {
          color: safeColors.textMuted, 
          fontSize: 11,
          rotate: 45
        },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          name: '掌握度 (%)',
          nameTextStyle: { color: safeColors.textMuted, fontSize: 12 },
          min: 0,
          max: 100,
          axisLine: { show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10], lineStyle: { color: safeColors.border } },
          axisLabel: {
            color: safeColors.textMuted,
            fontSize: 11,
            formatter: '{value}%'
          },
          splitLine: {
            lineStyle: { color: safeColors.border, type: 'dashed', opacity: 0.6 }
          }
        },
        {
          type: 'value',
          name: '置信度',
          nameTextStyle: { color: safeColors.textMuted, fontSize: 12 },
          min: 0,
          max: 1,
          axisLine: { show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10], lineStyle: { color: safeColors.border } },
          axisLabel: {
            color: safeColors.textMuted,
            fontSize: 11,
            formatter: '{value}'
          },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'EWMA掌握度',
          type: 'line',
          data: ewmaData,
          smooth: true,
          lineStyle: { color: safeColors.accent, width: 3 },
          itemStyle: { color: safeColors.accent, borderWidth: 2 },
          symbolSize: 6,
          areaStyle: {
            color: createGradient(safeColors.accent, 0.15, 0.03)
          }
        },
        {
          name: '历史平均',
          type: 'line',
          data: historicalData,
          smooth: true,
          lineStyle: { color: safeColors.textMuted, width: 2, type: 'dashed' },
          itemStyle: { color: safeColors.textMuted },
          symbolSize: 4
        },
        {
          name: '目标掌握线',
          type: 'line',
          data: dates.map(() => 80),
          lineStyle: { color: safeColors.success, width: 2, type: 'solid' },
          itemStyle: { color: safeColors.success },
          symbol: 'none',
          markLine: {
            silent: true,
            data: [{ yAxis: 80 }],
            lineStyle: { color: safeColors.success, width: 1, type: 'dashed' }
          }
        },
        {
          name: '置信度',
          type: 'line',
          yAxisIndex: 1,
          data: confidenceData,
          smooth: true,
          lineStyle: { color: safeColors.warning, width: 2 },
          itemStyle: { color: safeColors.warning },
          symbolSize: 4
        }
      ]
    };
    
    chart.setOption(option);
    logger.debug('[EWMA] Chart initialized successfully');
    
    } catch (error) {
      logger.error('[EWMA] Failed to initialize chart:', error);
      // 清理失败的chart实例
      if (chart) {
        chart.dispose();
        chart = null;
      }
    }
  }

  onMount(() => {
    setTimeout(() => {
      initializeChart();
    }, 100);

    const resizeObserver = new ResizeObserver(() => {
      if (chart) {
        chart.resize();
      }
    });

    if (chartContainer) {
      resizeObserver.observe(chartContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    if (chart) {
      chart.dispose();
      chart = null;
    }
  });
</script>

<div class="ewma-tab">
  <div class="chart-container">
    <div bind:this={chartContainer} class="chart"></div>
  </div>
</div>

<style>
  .ewma-tab {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .chart-container {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 12px 6px 12px 2px;
    border: 1px solid var(--background-modifier-border);
    flex: 1;
    min-height: 500px;
    display: flex;
    flex-direction: column;
  }

  .chart {
    width: 100%;
    flex: 1;
    min-height: 450px;
  }
</style>
