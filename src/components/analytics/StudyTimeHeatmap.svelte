<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import type { Card } from '../../data/types';
  import echarts, { type EChartsType } from '../../utils/echarts-loader';
  import { getThemeColors } from '../../utils/echarts-theme';

  interface Props {
    cards: Card[];
    height?: number;
  }

  let { cards, height = 500 }: Props = $props();

  let chartContainer: HTMLDivElement;
  let chartInstance: EChartsType | null = null;

  // 生成热力图数据（24小时 × 7天）
  function generateHeatmapData() {
    const hours = ['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
                   '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'];
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    // 初始化数据矩阵
    const matrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
    
    // 统计每个时间段的学习次数
    cards.forEach(card => {
      if (card.reviewHistory && Array.isArray(card.reviewHistory)) {
        card.reviewHistory.forEach((log: import('../../data/types').ReviewLog) => {
          if (log.review) {
            const date = new Date(log.review);
            const day = date.getDay(); // 0-6
            const hour = date.getHours(); // 0-23
            matrix[day][hour]++;
          }
        });
      }
    });

    // 转换为echarts需要的格式 [x, y, value]
    const data: [number, number, number][] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push([hour, day, matrix[day][hour]]);
      }
    }

    return { data, hours, days };
  }

  function initChart() {
    if (!chartContainer) return;

    try {
      chartInstance = echarts.init(chartContainer);
      updateChart();
    } catch (error) {
      logger.error('[StudyTimeHeatmap] 初始化图表失败:', error);
    }
  }

  function updateChart() {
    if (!chartInstance) return;

    const colors = getThemeColors();
    const { data, hours, days } = generateHeatmapData();
    
    // 计算最大值用于颜色映射
    const maxValue = Math.max(...data.map(d => d[2]), 1);

    const option = {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const [hour, day, value] = params.data;
          return `${days[day]} ${hours[hour]}<br/>学习次数: ${value}`;
        },
        backgroundColor: colors.background,
        borderColor: colors.border,
        textStyle: { color: colors.text }
      },
      grid: {
        left: 60,
        right: 40,
        top: 40,
        bottom: 60,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: hours,
        splitArea: {
          show: true
        },
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: { color: colors.border }
        },
        axisLabel: {
          color: colors.textMuted,
          fontSize: 11
        }
      },
      yAxis: {
        type: 'category',
        data: days,
        splitArea: {
          show: true
        },
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: { color: colors.border }
        },
        axisLabel: {
          color: colors.textMuted,
          fontSize: 12
        }
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: {
          // 绿色系热力图，适配深色模式
          color: [
            'rgba(22, 27, 34, 0.8)',      // 深灰色（无数据）
            'rgba(14, 68, 41, 0.6)',      // 深绿色低密度
            'rgba(0, 109, 50, 0.8)',      // 中绿色
            'rgba(38, 166, 91, 0.9)',     // 亮绿色
            'rgba(57, 211, 83, 1.0)'      // 高亮绿色（高密度）
          ]
        },
        textStyle: {
          color: colors.textMuted,
          fontSize: 12
        }
      },
      series: [
        {
          name: '学习次数',
          type: 'heatmap',
          data: data,
          label: {
            show: false
          },
          itemStyle: {
            borderRadius: 2,
            borderWidth: 1,
            borderColor: colors.background
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(57, 211, 83, 0.4)',
              borderColor: 'rgba(57, 211, 83, 0.8)',
              borderWidth: 2
            }
          }
        }
      ]
    };

    chartInstance.setOption(option);
  }

  onMount(() => {
    initChart();

    // 增强的响应式支持
    const resizeHandler = () => {
      if (chartInstance) {
        // 延迟重绘，避免频繁触发
        setTimeout(() => chartInstance?.resize(), 100);
      }
    };
    
    // 监听多种尺寸变化事件
    window.addEventListener('resize', resizeHandler);
    
    // 监听容器尺寸变化（用于ResizeObserver）
    let resizeObserver: ResizeObserver | null = null;
    if (chartContainer && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resizeHandler);
      resizeObserver.observe(chartContainer);
    }

    return () => {
      window.removeEventListener('resize', resizeHandler);
      resizeObserver?.disconnect();
    };
  });

  onDestroy(() => {
    chartInstance?.dispose();
  });

  // 响应数据变化
  $effect(() => {
    if (cards && chartInstance) {
      updateChart();
    }
  });
</script>

<div class="heatmap-wrapper">
  <div bind:this={chartContainer} class="chart-container" style="height: {height}px;"></div>
  
  {#if cards.length === 0}
    <div class="empty-overlay">
      <p>暂无学习数据</p>
    </div>
  {/if}
</div>

<style>
  .heatmap-wrapper {
    position: relative;
    width: 100%;
  }

  .chart-container {
    width: 100%;
    background: transparent;
  }

  .empty-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    pointer-events: none;
  }
</style>
