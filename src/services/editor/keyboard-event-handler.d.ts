/**
 * 键盘事件处理器
 *
 * 负责管理编辑器的键盘事件，确保：
 * 1. Obsidian原生快捷键正常工作
 * 2. 自定义快捷键（Ctrl+Enter, Escape）正常工作
 * 3. 事件正确传播，不干扰CodeMirror
 */
import type { KeyboardEventHandlerOptions } from '../../types/editor-types';
export declare class KeyboardEventHandler {
    private options;
    private editorElement;
    private boundHandler;
    private readonly OBSIDIAN_SHORTCUTS;
    constructor(options: KeyboardEventHandlerOptions);
    /**
     * 附加到编辑器元素
     */
    attach(editorElement: HTMLElement): void;
    /**
     * 从编辑器元素分离
     */
    detach(): void;
    /**
     * 键盘事件处理函数
     */
    private handleKeydown;
    /**
     * 处理自定义快捷键
     */
    private handleCustomShortcut;
    /**
     * 处理内置快捷键（Ctrl+Enter保存，Escape取消）
     */
    private handleBuiltinShortcut;
    /**
     * 判断是否是Obsidian快捷键
     */
    private isObsidianShortcut;
    /**
     * 判断是否应该处理此事件
     */
    private shouldHandleEvent;
    /**
     * 获取事件上下文信息
     */
    private getEventContext;
    /**
     * 构建快捷键标识符
     */
    private buildShortcutKey;
    /**
     * 调试日志
     */
    private log;
}
