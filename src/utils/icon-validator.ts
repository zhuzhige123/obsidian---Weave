import { logger } from '../utils/logger';
/**
 * 图标验证工具
 * 用于开发时验证所有使用的图标是否存在
 */

import { hasIcon } from "../icons/index";

/**
 * 验证所有表格使用的图标
 * @returns 验证结果对象
 */
export function validateTableIcons(): {
  valid: boolean;
  missingIcons: string[];
} {
  // 表格组件中使用的所有图标
  const requiredIcons = [
    // 排序图标
    'sort',
    'sort-up',
    'sort-down',
    
    // 操作图标
    'edit',
    'trash',
    'eye',
    
    // 状态图标
    'check',
    'check-circle',
    'warning',
    'question-circle',
    
    // 功能图标
    'tag',
    'download',
    'help',
    
    // 模式切换图标
    'info',
    'bar-chart-2',
  ];

  const missingIcons = requiredIcons.filter(icon => !hasIcon(icon));

  if (missingIcons.length > 0) {
    logger.error('[Weave Table] 缺失的图标:', missingIcons);
  }

  return {
    valid: missingIcons.length === 0,
    missingIcons
  };
}

/**
 * 获取图标并提供后备
 * @param iconName 图标名称
 * @param fallback 后备图标名称
 * @returns 最终使用的图标名称
 */
export function getIconWithFallback(
  iconName: string, 
  fallback = 'question-circle'
): string {
  return hasIcon(iconName) ? iconName : fallback;
}

/**
 * 验证单个图标是否存在并记录警告
 * @param iconName 图标名称
 * @param context 使用上下文（用于日志）
 * @returns 图标是否存在
 */
export function validateIcon(iconName: string, context?: string): boolean {
  const exists = hasIcon(iconName);
  
  if (!exists) {
    const contextStr = context ? ` (在 ${context} 中)` : '';
    logger.warn(`[Weave] 图标不存在: "${iconName}"${contextStr}`);
  }
  
  return exists;
}
