/**
 * 焦点管理器类型定义
 * 
 * 平台感知的焦点管理系统，解决移动端键盘闪烁问题
 */

import type { WorkspaceLeaf } from 'obsidian';

// ============================================================================
// 平台检测相关类型
// ============================================================================

/**
 * 平台信息
 */
export interface PlatformInfo {
  /** 是否为移动端 */
  isMobile: boolean;
  /** 是否为桌面端 */
  isDesktop: boolean;
  /** 是否为 iOS */
  isIOS: boolean;
  /** 是否为 Android */
  isAndroid: boolean;
}

/**
 * 平台检测器接口
 */
export interface IPlatformDetector {
  /** 检测平台信息 */
  detect(): PlatformInfo;
  /** 是否为移动应用 */
  isMobileApp(): boolean;
}

// ============================================================================
// 键盘监控相关类型（移动端专用）
// ============================================================================

/**
 * 键盘状态
 */
export interface KeyboardState {
  /** 键盘是否可见 */
  isVisible: boolean;
  /** 键盘是否正在动画中 */
  isAnimating: boolean;
  /** 键盘高度（像素） */
  height: number;
}

/**
 * 键盘监控器接口
 */
export interface IKeyboardMonitor {
  /** 获取当前键盘状态 */
  getState(): KeyboardState;
  /** 监听状态变化，返回取消监听函数 */
  onStateChange(callback: (state: KeyboardState) => void): () => void;
  /** 键盘是否处于活跃状态（可见或动画中） */
  isKeyboardActive(): boolean;
  /** 开始监听 */
  startListening(): void;
  /** 停止监听 */
  stopListening(): void;
}

// ============================================================================
// 焦点栈相关类型
// ============================================================================

/**
 * 焦点记录
 */
export interface FocusRecord {
  /** 焦点元素（可能已被移除） */
  element: HTMLElement | null;
  /** 记录时间戳 */
  timestamp: number;
  /** 上下文标识，如 'modal', 'deck-delete', 'editor' */
  context: string;
}

/**
 * 焦点栈接口
 */
export interface IFocusStack {
  /** 压入焦点记录 */
  push(record: FocusRecord): void;
  /** 弹出焦点记录 */
  pop(): FocusRecord | undefined;
  /** 查看栈顶记录（不弹出） */
  peek(): FocusRecord | undefined;
  /** 清空栈 */
  clear(): void;
  /** 获取栈大小 */
  size(): number;
}

// ============================================================================
// 焦点恢复策略相关类型
// ============================================================================

/**
 * 焦点恢复策略接口
 */
export interface IFocusRestoreStrategy {
  /** 是否应该自动恢复焦点 */
  shouldAutoRestore(): boolean;
  /** 恢复焦点，返回是否成功 */
  restore(record: FocusRecord): Promise<boolean>;
  /** 焦点丢失时的处理 */
  onFocusLost(currentElement: HTMLElement | null): void;
}

/**
 * 策略类型
 */
export type FocusStrategyType = 'active' | 'passive';

// ============================================================================
// 请求合并器相关类型
// ============================================================================

/**
 * 请求合并器接口
 */
export interface IRequestCoalescer {
  /** 调度一个操作，相同 key 的操作会被合并 */
  schedule(action: () => void, key: string): void;
  /** 取消指定 key 的操作 */
  cancel(key: string): void;
  /** 立即执行所有待处理的操作 */
  flush(): void;
}

// ============================================================================
// 焦点陷阱相关类型
// ============================================================================

/**
 * 焦点陷阱管理器接口
 */
export interface IFocusTrapManager {
  /** 在容器内创建焦点陷阱 */
  trap(container: HTMLElement, initialFocus?: HTMLElement): void;
  /** 释放焦点陷阱 */
  release(container: HTMLElement): void;
  /** 检查容器是否有焦点陷阱 */
  isTrapped(container: HTMLElement): boolean;
}

// ============================================================================
// 焦点管理器主接口
// ============================================================================

/**
 * 焦点管理器配置
 */
export interface FocusManagerConfig {
  /** 防抖延迟时间（毫秒），默认 100 */
  debounceMs: number;
  /** 是否启用调试模式，默认 false */
  enableDebugMode: boolean;
  /** 是否启用自动恢复（桌面端默认 true，移动端默认 false） */
  enableAutoRestore: boolean;
}

/**
 * 焦点管理器状态
 */
export interface FocusManagerState {
  /** 平台信息 */
  platform: PlatformInfo;
  /** 键盘状态（仅移动端） */
  keyboard: KeyboardState | null;
  /** 焦点栈大小 */
  stackSize: number;
  /** 当前焦点元素信息 */
  currentFocus: {
    element: string;  // tagName
    id: string;
    className: string;
  } | null;
  /** 当前策略类型 */
  strategy: FocusStrategyType;
  /** 是否处于调试模式 */
  debugMode: boolean;
}

/**
 * 焦点事件（调试用）
 */
export interface FocusEvent {
  /** 事件类型 */
  type: 'save' | 'restore' | 'lost' | 'trap' | 'release';
  /** 时间戳 */
  timestamp: number;
  /** 上下文 */
  context: string;
  /** 元素描述 */
  element: string;
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  reason?: string;
}

/**
 * 焦点管理器主接口
 */
export interface IFocusManager {
  // 配置
  /** 更新配置 */
  configure(config: Partial<FocusManagerConfig>): void;
  
  // 焦点保存/恢复
  /** 保存当前焦点 */
  saveFocus(context: string): void;
  /** 恢复焦点 */
  restoreFocus(fallback?: HTMLElement): Promise<boolean>;
  
  // 焦点陷阱
  /** 创建焦点陷阱 */
  trapFocus(container: HTMLElement, initialFocus?: HTMLElement): void;
  /** 释放焦点陷阱 */
  releaseTrap(container: HTMLElement): void;
  
  // 状态查询
  /** 获取当前状态 */
  getState(): FocusManagerState;
  /** 检查 leaf 是否已激活 */
  isLeafActive(leaf: WorkspaceLeaf): boolean;
  
  // 手动控制
  /** 强制恢复焦点 */
  forceRestore(): Promise<boolean>;
  
  // 调试
  /** 启用调试模式 */
  enableDebug(): void;
  /** 禁用调试模式 */
  disableDebug(): void;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 可聚焦元素选择器
 */
export const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
] as const;

/**
 * 默认配置
 */
export const DEFAULT_FOCUS_MANAGER_CONFIG: FocusManagerConfig = {
  debounceMs: 100,
  enableDebugMode: false,
  enableAutoRestore: true  // 会根据平台动态调整
};
