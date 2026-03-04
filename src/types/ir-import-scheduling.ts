/**
 * 增量阅读导入时间分散调度类型定义
 * 
 * 支持基于负载率的智能分配策略
 * 
 * @module types/ir-import-scheduling
 * @version 1.0.0
 */

/**
 * 时间分散策略类型
 */
export type SchedulingStrategy = 
  | 'even'           // 均分：完全平均分布，不看已有负载
  | 'balanced'       // 均衡：让每天合计负载尽量接近（推荐默认）
  | 'front-loaded';  // 尽快读：在不爆载前提下尽量靠前

/**
 * 时间分散配置
 */
export interface SchedulingConfig {
  /** 分散天数（默认14天） */
  distributionDays: number;
  
  /** 分散策略 */
  strategy: SchedulingStrategy;
  
  /** 是否启用每日最低保证（至少1篇） */
  dailyMinimum: boolean;
  
  /** 每日上限（可选，不填则自动计算） */
  dailyCap?: number;
  
  /** 目标负载率（0-1，默认0.8表示80%） */
  targetLoadRate: number;
}

/**
 * 每日负载信息
 */
export interface DailyLoad {
  /** 日期 */
  date: Date;
  
  /** 已有待读数量 */
  existingCount: number;
  
  /** 已有预计耗时（分钟） */
  existingMinutes: number;
  
  /** 新增分配数量 */
  newCount: number;
  
  /** 新增预计耗时（分钟） */
  newMinutes: number;
  
  /** 合计负载率 */
  loadRate: number;
  
  /** 是否超载 */
  isOverloaded: boolean;
}

/**
 * 分散影响评估
 */
export interface SchedulingImpact {
  /** 未来N天负载分布 */
  dailyLoads: DailyLoad[];
  
  /** 超载天数 */
  overloadedDays: number;
  
  /** 最高负载率 */
  peakLoadRate: number;
  
  /** 平均负载率 */
  averageLoadRate: number;
  
  /** 新增总耗时（小时） */
  totalNewHours: number;
  
  /** 建议调整（如有） */
  suggestions: string[];
}

/**
 * 默认配置
 */
export const DEFAULT_SCHEDULING_CONFIG: SchedulingConfig = {
  distributionDays: 14,
  strategy: 'balanced',
  dailyMinimum: false,
  targetLoadRate: 0.8
};

/**
 * 预设配置选项
 */
export const SCHEDULING_PRESETS = {
  week: {
    label: '一周',
    days: 7,
    strategy: 'balanced' as SchedulingStrategy
  },
  twoWeeks: {
    label: '两周',
    days: 14,
    strategy: 'balanced' as SchedulingStrategy
  },
  month: {
    label: '一个月',
    days: 30,
    strategy: 'balanced' as SchedulingStrategy
  }
} as const;
