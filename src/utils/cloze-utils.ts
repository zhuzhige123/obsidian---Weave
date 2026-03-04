/**
 * 挖空语法处理工具
 * 
 * 用于在浏览/管理界面移除挖空标记，显示完整内容
 * 
 * @module utils/cloze-utils
 */

/**
 * 移除挖空语法标记，保留答案文本
 * 
 * 用于卡片管理界面（网格视图、看板视图）显示完整内容。
 * 不影响学习界面的挖空隐藏功能。
 * 
 * 支持的格式：
 * - {{c1::答案}} → 答案
 * - {{c1::答案::提示}} → 答案（移除提示）
 * - ==高亮== → ==高亮==（保持不变，Obsidian 原生支持）
 * 
 * @param content 包含挖空语法的内容
 * @returns 清理后的纯文本内容
 * 
 * @example
 * ```typescript
 * const input = "JavaScript中 {{c1::变量声明}} 有几种方式？";
 * const output = stripClozeForDisplay(input);
 * // 输出: "JavaScript中 变量声明 有几种方式？"
 * ```
 */
export function stripClozeForDisplay(content: string): string {
  if (!content) return content;
  
  // 移除 Anki 渐进式挖空语法：{{c1::text}} 或 {{c1::text::hint}} → text
  // 正则说明：
  // \{\{c\d+::  - 匹配 {{c数字::
  // ([^}:]+)    - 捕获答案文本（非}和:的字符）
  // (?:::[^}]+)? - 可选的提示部分 ::hint
  // \}\}        - 匹配 }}
  return content.replace(/\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g, '$1');
}

/**
 * 检测内容是否包含挖空语法
 * 
 * @param content 待检测内容
 * @returns 是否包含挖空标记
 * 
 * @example
 * ```typescript
 * hasClozeMarkup("{{c1::答案}}") // true
 * hasClozeMarkup("普通文本") // false
 * ```
 */
export function hasClozeMarkup(content: string): boolean {
  if (!content) return false;
  return /\{\{c\d+::[^}]+\}\}/.test(content);
}











