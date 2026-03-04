/**
 * 类型守卫工具函数
 * 提供类型安全的检查和过滤功能
 */

/**
 * 过滤字段 - 基础实现
 * @param fields 字段数组
 * @returns 过滤后的字段
 */
export function filterFields(fields: any[]): any[] {
  if (!Array.isArray(fields)) {
    return [];
  }
  
  // 基础过滤逻辑：移除空值和undefined
  return fields.filter(field => field != null);
}

/**
 * 检查是否为有效的字段对象
 * @param field 待检查的字段
 * @returns 是否为有效字段
 */
export function isValidField(field: any): field is Record<string, any> {
  return typeof field === 'object' && field !== null;
}

/**
 * 检查是否为字符串
 * @param value 待检查的值
 * @returns 是否为字符串
 */
export function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * 检查是否为数组
 * @param value 待检查的值
 * @returns 是否为数组
 */
export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}
