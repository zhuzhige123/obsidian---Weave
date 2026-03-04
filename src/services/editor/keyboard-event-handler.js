import { logger } from '../../utils/logger';
export class KeyboardEventHandler {
    options;
    editorElement = null;
    boundHandler = null;
    // Obsidian原生快捷键列表（参考）
    OBSIDIAN_SHORTCUTS = new Set([
        'b', 'i', 'k', 'e', 'd', 'h', // 格式化快捷键
        '[', ']', // 缩进
        'z', 'y', // 撤销/重做
        'f', 'g', // 查找/跳转
        'p', 'o', // 命令面板/快速切换
        'n', 't', // 新建/标签
        'w', 'q', // 关闭
        's', // 保存
        'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', // 导航
        'PageUp', 'PageDown',
        'Tab', 'Enter', 'Backspace', 'Delete'
    ]);
    constructor(options) {
        this.options = options;
        this.log('KeyboardEventHandler initialized', { options });
    }
    /**
     * 附加到编辑器元素
     */
    attach(editorElement) {
        if (this.editorElement) {
            this.log('Warning: Already attached, detaching first');
            this.detach();
        }
        this.editorElement = editorElement;
        this.boundHandler = this.handleKeydown.bind(this);
        // 使用 capture: false 确保 CodeMirror 的监听器优先
        editorElement.addEventListener('keydown', this.boundHandler, {
            capture: false,
            passive: false // 需要能够 preventDefault
        });
        this.log('Attached to editor element');
    }
    /**
     * 从编辑器元素分离
     */
    detach() {
        if (this.editorElement && this.boundHandler) {
            this.editorElement.removeEventListener('keydown', this.boundHandler);
            this.log('Detached from editor element');
        }
        this.editorElement = null;
        this.boundHandler = null;
    }
    /**
     * 键盘事件处理函数
     */
    handleKeydown(event) {
        const context = this.getEventContext(event);
        //  性能优化：移除频繁的键盘事件日志（每次按键都触发）
        // 保留在特殊处理时的日志即可
        // this.log('Keydown event', {
        //   key: event.key,
        //   ctrl: event.ctrlKey,
        //   meta: event.metaKey,
        //   shift: event.shiftKey,
        //   alt: event.altKey,
        //   context
        // });
        // 检查是否应该处理此事件
        if (!this.shouldHandleEvent(event, context)) {
            this.log('Event ignored - should not handle');
            return;
        }
        // 检查自定义快捷键
        if (this.handleCustomShortcut(event)) {
            this.log('Custom shortcut handled');
            return;
        }
        // 处理内置快捷键
        if (this.handleBuiltinShortcut(event)) {
            this.log('Builtin shortcut handled');
            return;
        }
        // 检查是否是Obsidian快捷键
        if (this.isObsidianShortcut(event)) {
            //  性能优化：移除频繁的快捷键检测日志
            // this.log('Obsidian shortcut detected - letting it pass through');
            // 完全放行，让CodeMirror和Obsidian处理
            return;
        }
        // 其他所有键也放行
        this.log('Regular key - letting it pass through');
    }
    /**
     * 处理自定义快捷键
     */
    handleCustomShortcut(event) {
        if (!this.options.customShortcuts) {
            return false;
        }
        const shortcutKey = this.buildShortcutKey(event);
        const handler = this.options.customShortcuts.get(shortcutKey);
        if (handler) {
            event.preventDefault();
            // 不调用 stopPropagation，让其他监听器也能处理
            const shouldStopPropagation = handler();
            // Svelte 5: 完全避免使用 stopPropagation
            // 如果需要阻止其他处理，应该通过返回值等其他机制实现
            return true;
        }
        return false;
    }
    /**
     * 处理内置快捷键（Ctrl+Enter保存，Escape取消）
     */
    handleBuiltinShortcut(event) {
        // Ctrl/Cmd + Enter: 保存
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            //  关键：不调用 stopPropagation，让事件继续传播
            this.log('Save shortcut triggered');
            this.options.onSave();
            return true;
        }
        // Escape: 取消
        if (event.key === 'Escape') {
            event.preventDefault();
            //  关键：不调用 stopPropagation，让事件继续传播
            this.log('Cancel shortcut triggered');
            this.options.onCancel();
            return true;
        }
        return false;
    }
    /**
     * 判断是否是Obsidian快捷键
     */
    isObsidianShortcut(event) {
        // 如果有自定义的允许列表，使用它
        if (this.options.allowedObsidianShortcuts) {
            const key = event.key.toLowerCase();
            return this.options.allowedObsidianShortcuts.has(key);
        }
        // 否则使用默认列表
        const key = event.key.toLowerCase();
        const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
        // Ctrl/Cmd + key 的组合
        if (hasModifier && this.OBSIDIAN_SHORTCUTS.has(key)) {
            return true;
        }
        // 导航键
        if (this.OBSIDIAN_SHORTCUTS.has(event.key)) {
            return true;
        }
        return false;
    }
    /**
     * 判断是否应该处理此事件
     */
    shouldHandleEvent(event, context) {
        // 如果事件不在编辑器内，不处理
        if (!context.isInEditor) {
            return false;
        }
        // 如果焦点在特殊元素上（如输入框、下拉框），不处理
        const target = event.target;
        if (target) {
            const tagName = target.tagName.toLowerCase();
            if (tagName === 'input' && target !== this.editorElement) {
                // 如果是编辑器外的input，不处理
                return false;
            }
            if (tagName === 'select' || tagName === 'textarea') {
                return false;
            }
        }
        return true;
    }
    /**
     * 获取事件上下文信息
     */
    getEventContext(event) {
        const target = event.target;
        const activeElement = document.activeElement;
        // 检查事件是否发生在编辑器内
        const isInEditor = this.editorElement
            ? this.editorElement.contains(target)
            : false;
        // 检查编辑器是否获得焦点
        const isFocused = this.editorElement
            ? this.editorElement.contains(activeElement) || this.editorElement === activeElement
            : false;
        return {
            isInEditor,
            isFocused,
            activeElement,
            target
        };
    }
    /**
     * 构建快捷键标识符
     */
    buildShortcutKey(event) {
        const parts = [];
        if (event.ctrlKey || event.metaKey)
            parts.push('Mod');
        if (event.shiftKey)
            parts.push('Shift');
        if (event.altKey)
            parts.push('Alt');
        parts.push(event.key);
        return parts.join('+').toLowerCase();
    }
    /**
     * 调试日志
     */
    log(message, data) {
        if (this.options.debug) {
            logger.debug(`[KeyboardEventHandler] ${message}`, data || '');
        }
    }
}
