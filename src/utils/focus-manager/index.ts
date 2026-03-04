/**
 * 焦点管理器模块
 * 
 * 平台感知的焦点管理系统，解决移动端键盘闪烁问题。
 * 
 * 使用方式：
 * ```typescript
 * import { getFocusManager } from './utils/focus-manager';
 * 
 * const focusManager = getFocusManager();
 * 
 * // 保存焦点（打开模态窗口前）
 * focusManager.saveFocus('modal-open');
 * 
 * // 恢复焦点（关闭模态窗口后）
 * await focusManager.restoreFocus();
 * 
 * // 创建焦点陷阱
 * focusManager.trapFocus(modalContainer);
 * 
 * // 释放焦点陷阱
 * focusManager.releaseTrap(modalContainer);
 * ```
 */

// 主类
export { FocusManager, getFocusManager } from './FocusManager';

// 子模块
export { PlatformDetector, getPlatformDetector } from './PlatformDetector';
export { FocusStack } from './FocusStack';
export { RequestCoalescer } from './RequestCoalescer';
export { KeyboardMonitor } from './KeyboardMonitor';
export { FocusTrapManager } from './FocusTrapManager';

// 策略
export { ActiveFocusStrategy } from './strategies/ActiveFocusStrategy';
export { PassiveFocusStrategy } from './strategies/PassiveFocusStrategy';

// 类型
export type {
  PlatformInfo,
  IPlatformDetector,
  KeyboardState,
  IKeyboardMonitor,
  FocusRecord,
  IFocusStack,
  IFocusRestoreStrategy,
  FocusStrategyType,
  IRequestCoalescer,
  IFocusTrapManager,
  FocusManagerConfig,
  FocusManagerState,
  FocusEvent,
  IFocusManager
} from './types';

export { FOCUSABLE_SELECTORS, DEFAULT_FOCUS_MANAGER_CONFIG } from './types';
