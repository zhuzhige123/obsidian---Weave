/**
 * 焦点栈
 * 
 * 管理焦点历史，支持多层嵌套的模态窗口场景。
 * 使用 LIFO（后进先出）结构。
 */

import type { IFocusStack, FocusRecord } from './types';
import { logger } from '../logger';

/**
 * 焦点栈实现
 */
export class FocusStack implements IFocusStack {
  private stack: FocusRecord[] = [];
  private maxSize: number;
  private debugMode: boolean;

  constructor(maxSize = 10, debugMode = false) {
    this.maxSize = maxSize;
    this.debugMode = debugMode;
  }

  /**
   * 压入焦点记录
   */
  push(record: FocusRecord): void {
    // 防止栈溢出
    if (this.stack.length >= this.maxSize) {
      const removed = this.stack.shift();
      if (this.debugMode) {
        logger.debug('[FocusStack] 栈已满，移除最旧记录:', removed?.context);
      }
    }

    this.stack.push(record);

    if (this.debugMode) {
      logger.debug('[FocusStack] 压入焦点记录:', {
        context: record.context,
        element: record.element?.tagName || 'null',
        stackSize: this.stack.length
      });
    }
  }

  /**
   * 弹出焦点记录
   */
  pop(): FocusRecord | undefined {
    const record = this.stack.pop();

    if (this.debugMode) {
      logger.debug('[FocusStack] 弹出焦点记录:', {
        context: record?.context || 'empty',
        element: record?.element?.tagName || 'null',
        stackSize: this.stack.length
      });
    }

    return record;
  }

  /**
   * 查看栈顶记录（不弹出）
   */
  peek(): FocusRecord | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * 清空栈
   */
  clear(): void {
    const previousSize = this.stack.length;
    this.stack = [];

    if (this.debugMode) {
      logger.debug('[FocusStack] 清空栈，移除了', previousSize, '条记录');
    }
  }

  /**
   * 获取栈大小
   */
  size(): number {
    return this.stack.length;
  }

  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * 获取所有记录（用于调试）
   */
  getAll(): readonly FocusRecord[] {
    return [...this.stack];
  }
}
