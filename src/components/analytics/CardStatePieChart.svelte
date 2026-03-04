<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import type { Card } from '../../data/types';
  import { CardState } from '../../data/types';
  import echarts, { type EChartsType } from '../../utils/echarts-loader';
  import { getThemeColors } from '../../utils/echarts-theme';

  interface Props {
    cards: Card[];
    height?: number;
  }

  let { cards, height = 400 }: Props = $props();

  let chartContainer: HTMLDivElement;
  let chartInstance: EChartsType | null = null;

  // 统计卡片状态分布
  function calculateStateDistribution() {
    const stats = {
      new: 0,
      learning: 0,
      relearning: 0,
      review: 0
    };

    cards.forEach(card => {
      // 检查是否有FSRS数据和状态
      const cardState = card.fsrs?.state;
      if (cardState === undefined) return; // 跳过没有FSRS数据的卡片
      
      switch (cardState) {
        case CardState.New:
          stats.new++;
          break;
        case CardState.Learning:
          stats.learning++;
          break;
        case CardState.Relearning:
          stats.relearning++;
          break;
        case CardState.Review:
          stats.review++;
          break;
      }
    });

    return stats;
  }

  function initChart() {
    if (!chartContainer) return;

    try {
      chartInstance = echarts.init(chartContainer);
      updateChart();
    } catch (error) {
      logger.error('[CardStatePieChart] 初始化图表失败:', error);
    }
  }

  function updateChart() {
    if (!chartInstance) return;

    const colors = getThemeColors();
    const stats = calculateStateDistribution();

    const chartData = [
      { value: stats.new, name: '新卡片', itemStyle: { color: '#6366f1' } },
      { value: stats.learning, name: '学习中', itemStyle: { color: '#8b5cf6' } },
      { value: stats.relearning, name: '重新学习', itemStyle: { color: '#f97316' } },
      { value: stats.review, name: '复习中', itemStyle: { color: '#10b981' } }
    ].filter(item => item.value > 0);

    // 如果没有数据，显示空状态
    if (chartData.length === 0) {
      chartData.push({ value: 1, name: '暂无数据', itemStyle: { color: '#64748b' } });
    }

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} 张 ({d}%)',
        backgroundColor: colors.background,
        borderColor: colors.border,
        textStyle: { color: colors.text }
      },
      legend: {
        orient: 'horizontal',
        bottom: 20,
        textStyle: { color: colors.textMuted }
      },
      series: [
        {
          name: '卡片状态',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: colors.background,
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            color: colors.text
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          data: chartData
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

<div bind:this={chartContainer} class="chart-container" style="height: {height}px;"></div>

<style>
  .chart-container {
    width: 100%;
    background: transparent;
  }
</style>
