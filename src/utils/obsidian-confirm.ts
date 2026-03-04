/**
 * Obsidian 风格确认对话框工具函数
 * 
 * 用于替代浏览器原生 confirm() 对话框，解决焦点劫持问题。
 * 
 * 问题背景：
 * 1. Svelte 5 事件委托机制 - 将事件监听器附加到 document.body，依赖事件冒泡
 * 2. confirm() 焦点劫持 - 系统对话框会夺取焦点，关闭后焦点不会自动恢复到 Obsidian 应用内
 * 3. 导致 document.activeElement 变成 document.body，后续点击输入框无法获得焦点
 * 
 * 解决方案：使用 Obsidian Modal API，焦点始终保持在应用内
 */

import { App, Modal } from 'obsidian';

/**
 * 确认对话框配置选项
 */
export interface ConfirmOptions {
  /** 对话框标题，默认 "确认" */
  title?: string;
  /** 确认按钮文本，默认 "确认" */
  confirmText?: string;
  /** 取消按钮文本，默认 "取消" */
  cancelText?: string;
  /** 确认按钮样式类，默认 "mod-warning" */
  confirmClass?: string;
}

/**
 * 显示 Obsidian 风格的确认对话框
 * 
 * @param app Obsidian App 实例
 * @param message 确认消息（支持多行，用 \n 分隔）
 * @param options 可选配置
 * @returns Promise<boolean> - 用户点击确认返回 true，取消或关闭返回 false
 * 
 * @example
 * ```typescript
 * // 基本用法
 * const confirmed = await showObsidianConfirm(app, '确定要删除吗？');
 * if (confirmed) {
 *   await deleteItem();
 * }
 * 
 * // 自定义选项
 * const confirmed = await showObsidianConfirm(app, '确定要删除吗？', {
 *   title: '确认删除',
 *   confirmText: '删除',
 *   cancelText: '取消',
 *   confirmClass: 'mod-warning'
 * });
 * ```
 */
export function showObsidianConfirm(
  app: App,
  message: string,
  options: ConfirmOptions = {}
): Promise<boolean> {
  const {
    title = '确认',
    confirmText = '确认',
    cancelText = '取消',
    confirmClass = 'mod-warning'
  } = options;

  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(title);
    
    // 创建消息内容（支持多行）
    const messageEl = modal.contentEl.createDiv({ cls: 'obsidian-confirm-message' });
    message.split('\n').forEach(line => {
      if (line.trim()) {
        messageEl.createEl('p', { text: line });
      }
    });
    
    // 创建按钮容器
    const buttonContainer = modal.contentEl.createDiv({ cls: 'obsidian-confirm-buttons' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '16px';
    
    let confirmed = false;
    
    // 取消按钮
    const cancelButton = buttonContainer.createEl('button', { text: cancelText });
    cancelButton.onclick = () => modal.close();
    
    // 确认按钮
    const confirmButton = buttonContainer.createEl('button', { 
      text: confirmText,
      cls: confirmClass
    });
    confirmButton.onclick = () => {
      confirmed = true;
      modal.close();
    };
    
    // 关闭时解析 Promise
    modal.onClose = () => resolve(confirmed);
    
    // 打开对话框
    modal.open();
  });
}

/**
 * 显示删除确认对话框（预设删除样式）
 * 
 * @param app Obsidian App 实例
 * @param itemName 要删除的项目名称
 * @param customMessage 可选的自定义消息
 * @returns Promise<boolean>
 */
export function showDeleteConfirm(
  app: App,
  itemName: string,
  customMessage?: string
): Promise<boolean> {
  const message = customMessage || `确定要删除"${itemName}"吗？`;
  return showObsidianConfirm(app, message, {
    title: '确认删除',
    confirmText: '删除',
    confirmClass: 'mod-warning'
  });
}

/**
 * 显示危险操作确认对话框（预设危险样式）
 * 
 * @param app Obsidian App 实例
 * @param message 确认消息
 * @param title 对话框标题
 * @returns Promise<boolean>
 */
export function showDangerConfirm(
  app: App,
  message: string,
  title: string = '警告'
): Promise<boolean> {
  return showObsidianConfirm(app, message, {
    title,
    confirmText: '确认',
    confirmClass: 'mod-warning'
  });
}

/**
 * 输入对话框配置选项
 */
export interface InputOptions {
  /** 对话框标题，默认 "输入" */
  title?: string;
  /** 输入框占位符 */
  placeholder?: string;
  /** 确认按钮文本，默认 "确认" */
  confirmText?: string;
  /** 取消按钮文本，默认 "取消" */
  cancelText?: string;
}

/**
 * 显示 Obsidian 风格的输入对话框
 * 用于替代浏览器原生 prompt() 对话框
 * 
 * @param app Obsidian App 实例
 * @param message 提示消息
 * @param defaultValue 默认值
 * @param options 可选配置
 * @returns Promise<string | null> - 用户输入的值，取消返回 null
 */
export function showObsidianInput(
  app: App,
  message: string,
  defaultValue: string = '',
  options: InputOptions = {}
): Promise<string | null> {
  const {
    title = '输入',
    placeholder = '',
    confirmText = '确认',
    cancelText = '取消'
  } = options;

  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(title);
    
    // 创建消息内容
    if (message) {
      modal.contentEl.createEl('p', { text: message });
    }
    
    // 创建输入框
    const inputEl = modal.contentEl.createEl('input', {
      type: 'text',
      value: defaultValue,
      placeholder: placeholder
    });
    inputEl.style.width = '100%';
    inputEl.style.marginTop = '8px';
    inputEl.style.marginBottom = '16px';
    
    // 创建按钮容器
    const buttonContainer = modal.contentEl.createDiv({ cls: 'obsidian-input-buttons' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    
    let result: string | null = null;
    
    // 取消按钮
    const cancelButton = buttonContainer.createEl('button', { text: cancelText });
    cancelButton.onclick = () => modal.close();
    
    // 确认按钮
    const confirmButton = buttonContainer.createEl('button', { 
      text: confirmText,
      cls: 'mod-cta'
    });
    confirmButton.onclick = () => {
      result = inputEl.value;
      modal.close();
    };
    
    // 回车键确认
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        result = inputEl.value;
        modal.close();
      }
    });
    
    // 关闭时解析 Promise
    modal.onClose = () => resolve(result);
    
    // 打开对话框并聚焦输入框
    modal.open();
    inputEl.focus();
    inputEl.select();
  });
}
