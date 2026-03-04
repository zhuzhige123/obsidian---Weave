<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import echarts, { type EChartsType, type EChartsOption } from '../../utils/echarts-loader';
  import type { MemoryCurveData, TimeRange } from '../../types/view-card-modal-types';
  import { getRatingColor } from '../../utils/memory-curve-utils';

  interface Props {
    /** 曲线数据 */
    data: MemoryCurveData;
    /** 时间范围 */
    timeRange?: TimeRange;
    /** 图表高度 */
    height?: number;
  }

  let { data, timeRange = '30d', height = 400 }: Props = $props();

  let chartContainer = $state<HTMLDivElement>();
  let chartInstance = $state<EChartsType | null>(null);

  // 监听主题变化
  function getThemeColors() {
    const style = getComputedStyle(document.body);
    return {
      textColor: style.getPropertyValue('--text-normal') || '#000',
      mutedColor: style.getPropertyValue('--text-muted') || '#666',
      accentColor: style.getPropertyValue('--interactive-accent') || '#3b82f6',
      bgColor: style.getPropertyValue('--background-primary') || '#fff',
      borderColor: style.getPropertyValue('--background-modifier-border') || '#ddd'
    };
  }

  // 初始化图表
  function initChart() {
    if (!chartContainer) return;

    chartInstance = echarts.init(chartContainer);
    updateChart();
  }

  // 更新图表
  function updateChart() {
    if (!chartInstance) return;

    const colors = getThemeColors();
    
    // 预测曲线数据
    const predictedSeriesData = data.predicted.map(point => [point.day, point.retrievability]);
    
    // 实际曲线数据
    const actualSeriesData = data.actual.map(point => [point.day, point.retrievability]);
    
    // 复习标记点
    const markPointData = data.reviewMarkers.map(marker => ({
      name: marker.rating === 1 ? '遗忘' : '复习',
      coord: [marker.day, marker.retrievability],
      value: marker.rating,
      itemStyle: {
        color: getRatingColor(marker.rating)
      }
    }));

    const option: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: colors.bgColor,
        borderColor: colors.borderColor,
        borderWidth: 1,
        textStyle: {
          color: colors.textColor,
          fontSize: 14
        },
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.2)',
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);',
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          let html = `<div style="padding: 12px; font-family: var(--font-interface);">`;
          html += `<div style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: var(--text-normal);">第 ${params[0].data[0].toFixed(1)} 天</div>`;
          params.forEach((param: any) => {
            if (param.value !== null && param.value !== undefined && Array.isArray(param.value)) {
              const colorMap: Record<string, string> = {
                '预测保持率': '#667eea',
                '实际保持率': '#4facfe',
                '风险阈值': '#f5576c'
              };
              const color = colorMap[param.seriesName] || param.color;
              html += `<div style="display: flex; align-items: center; margin: 8px 0; line-height: 1.4;">`;
              html += `<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color}; margin-right: 10px;"></span>`;
              html += `<span style="color: var(--text-normal); font-size: 14px;">${param.seriesName}:</span>`;
              html += `<strong style="margin-left: 8px; color: var(--text-accent); font-size: 15px;">${param.value[1].toFixed(1)}%</strong>`;
              html += `</div>`;
            }
          });
          html += `</div>`;
          return html;
        }
      },
      legend: {
        data: ['预测保持率', '实际保持率', '风险阈值'],
        bottom: 20,
        textStyle: {
          color: colors.textColor,
          fontSize: 13
        },
        itemGap: 20,
        icon: 'circle'
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: Array.from({length: Math.max(...data.predicted.map(p => Math.ceil(p.day)), ...data.actual.map(a => Math.ceil(a.day)))}, (_, i) => i),
        name: '天数',
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: { color: colors.borderColor }
        },
        axisLabel: {
          color: colors.mutedColor,
          fontSize: 12
        },
        nameTextStyle: {
          color: colors.textColor,
          fontSize: 13
        }
      },
      yAxis: {
        type: 'value',
        name: '记忆保持率 (%)',
        min: 0,
        max: 100,
        nameTextStyle: {
          color: colors.textColor,
          fontSize: 13
        },
        axisLine: {
          show: true, symbol: ['none', 'arrow'], symbolSize: [8, 10],
          lineStyle: { color: colors.borderColor }
        },
        axisLabel: {
          color: colors.mutedColor,
          formatter: '{value}%',
          fontSize: 12
        },
        splitLine: {
          lineStyle: { color: colors.borderColor, type: 'dashed' }
        }
      },
      series: [
        {
          name: '预测保持率',
          type: 'line',
          data: predictedSeriesData.map(d => [Math.floor(d[0]), d[1]]),
          smooth: true,
          lineStyle: {
            color: '#667eea',
            width: 3
          },
          itemStyle: {
            color: '#667eea'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
              ]
            }
          },
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          emphasis: {
            focus: 'series',
            scale: true,
            showSymbol: true
          }
        },
        {
          name: '实际保持率',
          type: 'line',
          data: actualSeriesData.map(d => [Math.floor(d[0]), d[1]]),
          smooth: true,
          lineStyle: {
            color: '#4facfe',
            width: 2,
            type: 'solid'
          },
          itemStyle: {
            color: '#4facfe'
          },
          symbol: 'circle',
          symbolSize: 6,
          emphasis: {
            focus: 'series',
            scale: true
          },
          markPoint: markPointData.length > 0 ? {
            data: markPointData.map(d => ({...d, coord: [Math.floor(d.coord[0]), d.coord[1]]})),
            symbolSize: 10,
            label: {
              show: false
            }
          } : undefined
        },
        {
          name: '风险阈值',
          type: 'line',
          data: Array.from({length: Math.max(...data.predicted.map(p => Math.ceil(p.day)))}, (_, i) => [i, 80]),
          lineStyle: {
            color: '#f5576c',
            width: 2,
            type: 'dashed'
          },
          itemStyle: {
            color: '#f5576c'
          },
          symbol: 'none',
          silent: true
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
          borderColor: colors.borderColor,
          fillerColor: 'rgba(59, 130, 246, 0.1)',
          handleStyle: {
            color: colors.accentColor
          },
          textStyle: {
            color: colors.mutedColor
          }
        }
      ]
    };

    chartInstance.setOption(option);
  }

  // 处理窗口resize
  function handleResize() {
    if (chartInstance) {
      chartInstance.resize();
    }
  }

  onMount(() => {
    initChart();
    window.addEventListener('resize', handleResize);
    
    // 监听主题变化
    const observer = new MutationObserver(() => {
      updateChart();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  });

  // 响应式更新数据
  $effect(() => {
    if (data && chartInstance) {
      updateChart();
    }
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
  });
</script>

<div 
  bind:this={chartContainer} 
  class="memory-curve-chart"
  style:height="{height}px"
></div>

<style>
  .memory-curve-chart {
    width: 100%;
    min-height: 300px;
  }
</style>

