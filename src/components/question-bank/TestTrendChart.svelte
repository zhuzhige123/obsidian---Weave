<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import echarts, { type EChartsType } from '../../utils/echarts-loader';
  import { getThemeColors, createGradient } from '../../utils/echarts-theme';

  interface TestHistoryPoint {
    sessionId: string;
    date: string;
    timestamp: number;
    accuracy: number;
    score: number;
    timeSpent: number;
    correctCount: number;
    totalQuestions: number;
  }

  interface Props {
    history: TestHistoryPoint[];
    currentMetric: 'accuracy' | 'score';
  }

  let { history, currentMetric }: Props = $props();
  
  let chartContainer: HTMLDivElement;
  let chartInstance: EChartsType | null = null;

  // 格式化时间
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}秒`;
    return `${mins}分${secs}秒`;
  }

  function initChart() {
    if (!chartContainer) return;
    
    try {
      chartInstance = echarts.init(chartContainer);
      updateChart();
    } catch (error) {
      logger.error('[TestTrendChart] 初始化失败:', error);
    }
  }

  function updateChart() {
    if (!chartInstance || history.length === 0) return;

    const colors = getThemeColors();
    const isAccuracy = currentMetric === 'accuracy';
    const lineColor = isAccuracy ? '#10b981' : '#8b5cf6';
    const metricName = isAccuracy ? '正确率' : '测试分数';
    
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: 1,
        textStyle: { color: colors.text },
        padding: [12, 16],
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px;',
        formatter: (params: any) => {
          const point = history[params[0].dataIndex];
          return `
            <div style="font-weight: 600; margin-bottom: 8px;">
              第${params[0].dataIndex + 1}次测试 (${point.date})
            </div>
            <div style="margin: 4px 0;">
              <span style="color: ${colors.textMuted};">正确率:</span>
              <span style="font-weight: 600; margin-left: 8px;">${point.accuracy.toFixed(1)}%</span>
            </div>
            <div style="margin: 4px 0;">
              <span style="color: ${colors.textMuted};">分数:</span>
              <span style="font-weight: 600; margin-left: 8px;">${point.score.toFixed(1)}分</span>
            </div>
            <div style="margin: 4px 0;">
              <span style="color: ${colors.textMuted};">用时:</span>
              <span style="font-weight: 600; margin-left: 8px;">${formatTime(point.timeSpent)}</span>
            </div>
          `;
        }
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: history.map(h => h.date),
        axisLine: { show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10], lineStyle: { color: colors.border } },
        axisLabel: { 
          color: colors.textMuted,
          fontSize: 11,
          interval: 'auto'
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: metricName,
        min: 0,
        max: 100,
        axisLine: { show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10], lineStyle: { color: colors.border } },
        axisLabel: {
          color: colors.textMuted,
          fontSize: 11,
          formatter: '{value}' + (isAccuracy ? '%' : '分')
        },
        splitLine: {
          lineStyle: { 
            color: colors.border, 
            type: 'dashed', 
            opacity: 0.3 
          }
        }
      },
      series: [{
        name: metricName,
        type: 'line',
        data: history.map(h => isAccuracy ? h.accuracy : h.score),
        smooth: true,
        lineStyle: { 
          color: lineColor, 
          width: 2.5 
        },
        itemStyle: { 
          color: lineColor,
          borderWidth: 2,
          borderColor: colors.background
        },
        symbolSize: 6,
        areaStyle: createGradient(lineColor, 0.3, 0.05),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: lineColor,
            shadowOffsetY: 0,
            scale: 1.5
          }
        }
      }]
    };

    try {
      chartInstance.setOption(option, true);
    } catch (error) {
      logger.error('[TestTrendChart] 更新配置失败:', error);
    }
  }

  // 监听指标变化，重新渲染
  $effect(() => {
    currentMetric;
    if (chartInstance) {
      updateChart();
    }
  });

  onMount(() => {
    initChart();
    
    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
  });
</script>

<div bind:this={chartContainer} class="trend-chart"></div>

<style>
  .trend-chart {
    width: 100%;
    height: 240px;
    background: var(--background-secondary);
    border-radius: 10px;
    border: 1px solid var(--background-modifier-border);
  }

  @media (max-width: 600px) {
    .trend-chart {
      height: 200px;
    }
  }
</style>
