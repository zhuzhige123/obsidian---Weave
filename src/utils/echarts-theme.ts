import { logger } from '../utils/logger';
/**
 * ECharts主题配置工具
 * 提供统一的主题颜色获取和图表基础配置
 */

export interface ThemeColors {
  text: string;
  textMuted: string;
  accent: string;
  background: string;
  backgroundSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

/**
 * 获取Obsidian主题颜色
 */
export function getThemeColors(): ThemeColors {
  const style = getComputedStyle(document.body);
  
  return {
    text: style.getPropertyValue('--text-normal').trim() || '#000',
    textMuted: style.getPropertyValue('--text-muted').trim() || '#666',
    accent: style.getPropertyValue('--interactive-accent').trim() || '#7c3aed',
    background: style.getPropertyValue('--background-primary').trim() || '#fff',
    backgroundSecondary: style.getPropertyValue('--background-secondary').trim() || '#f5f5f5',
    border: style.getPropertyValue('--background-modifier-border').trim() || '#ddd',
    success: style.getPropertyValue('--text-success').trim() || '#10b981',
    warning: style.getPropertyValue('--text-warning').trim() || '#f59e0b',
    error: style.getPropertyValue('--text-error').trim() || '#ef4444'
  };
}

/**
 * 生成ECharts通用配置
 */
export function getBaseChartOption(colors: ThemeColors): any {
  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: colors.text,
      fontFamily: 'var(--font-text)'
    },
    tooltip: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      textStyle: {
        color: colors.text
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 6px;'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      axisLine: {
        lineStyle: {
          color: colors.border
        }
      },
      axisLabel: {
        color: colors.textMuted,
        fontSize: 12
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      axisLine: {
        lineStyle: {
          color: colors.border
        }
      },
      axisLabel: {
        color: colors.textMuted,
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: colors.border,
          type: 'dashed',
          opacity: 0.3
        }
      }
    }
  };
}

/**
 * 生成渐变色配置（支持多种颜色格式）
 */
export function createGradient(color: string, opacity1: number = 0.25, opacity2: number = 0.05): any {
  // 安全的颜色解析函数
  function parseColor(colorStr: string): { r: number, g: number, b: number } {
    // 默认颜色（防止解析失败）
    const defaultColor = { r: 124, g: 58, b: 237 };
    
    try {
      // 处理十六进制颜色 #ff0000 或 ff0000
      if (colorStr.match(/^#?[0-9a-fA-F]{6}$/)) {
        const hex = colorStr.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // 验证解析结果
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          return { r, g, b };
        }
      }
      
      // 处理RGB格式 rgb(255, 0, 0)
      const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        return {
          r: parseInt(rgbMatch[1]),
          g: parseInt(rgbMatch[2]),
          b: parseInt(rgbMatch[3])
        };
      }
      
      // 处理CSS变量和其他格式，返回默认颜色
      logger.warn(`[createGradient] 无法解析颜色: ${colorStr}, 使用默认颜色`);
      return defaultColor;
      
    } catch (error) {
      logger.error(`[createGradient] 颜色解析错误: ${colorStr}`, error);
      return defaultColor;
    }
  }
  
  const { r, g, b } = parseColor(color);
  
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      {
        offset: 0,
        color: `rgba(${r}, ${g}, ${b}, ${opacity1})`
      },
      {
        offset: 1,
        color: `rgba(${r}, ${g}, ${b}, ${opacity2})`
      }
    ]
  };
}

/**
 * 数据验证和清理
 */
export function validateChartData<T extends Record<string, any>>(
  data: T[],
  requiredFields: string[]
): T[] {
  // 数据验证开始
  
  if (!Array.isArray(data)) {
    return [];
  }
  
  const result = data.filter(item => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    
    for (const field of requiredFields) {
      if (!(field in item)) {
        return false;
      }
      
      // 数值验证
      if (typeof item[field] === 'number') {
        if (isNaN(item[field]) || !isFinite(item[field])) {
          return false;
        }
      }
    }
    
    return true;
  });
  
  // 数据验证完成
  
  return result;
}

/**
 * 格式化数值显示
 */
export function formatValue(value: number, type: 'number' | 'percentage' | 'time' = 'number'): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  
  switch (type) {
    case 'percentage':
      return `${Math.round(value)}%`;
    case 'time':
      if (value < 60) return `${Math.round(value)}分钟`;
      const hours = Math.floor(value / 60);
      const minutes = Math.round(value % 60);
      return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
    case 'number':
    default:
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      }
      return value.toString();
  }
}
