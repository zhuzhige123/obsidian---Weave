/**
 * 嵌入式编辑器管理器
 *
 * 负责管理嵌入式Obsidian编辑器的完整生命周期：
 * 1. 创建隐藏的Leaf和编辑器实例
 * 2. 提取编辑器DOM并嵌入到自定义容器
 * 3. 管理键盘事件和布局
 * 4. 修复z-index和右键菜单问题
 * 5. 清理资源
 *
 *  焦点管理重构：
 * - 仅在初始化时调用一次 setActiveLeaf
 * - 移除定时重新激活机制，避免移动端键盘闪烁
 * - 使用新的 FocusManager 进行平台感知的焦点管理
 */
import { TFile } from 'obsidian';
import type { WeavePlugin } from '../../main';
import type { EditorOptions, EditorResult } from '../../types/editor-types';
export declare class EmbeddedEditorManager {
    private plugin;
    private leaf;
    private editor;
    private editorElement;
    private container;
    private keyboardHandler;
    private layoutManager;
    private menuObserver;
    private resizeObserver;
    private debug;
    private lastKnownContent;
    private contentChangeInterval;
    private contentChangeCallbacks;
    constructor(plugin: WeavePlugin, debug?: boolean);
    /**
     * 创建嵌入式编辑器
     */
    create(container: HTMLElement, file: TFile, options: EditorOptions): Promise<EditorResult>;
    /**
     * 创建Leaf
     *
     *  根本性修复：等待编辑器完全初始化后再隐藏leaf
     */
    private createLeaf;
    private waitForLayoutReady;
    /**
     *  新增：等待CodeMirror编辑器完全初始化
     * 确保编辑器DOM和实例都已就绪
     */
    private waitForCodeMirrorInitialization;
    /**
     * 隐藏Leaf的UI
     *  关键修复：保持 Leaf 可见但移到屏幕外，而不是完全隐藏
     * 这样 Obsidian 快捷键系统才能识别到活跃的编辑器
     */
    private hideLeafUI;
    /**
     * 隐藏文件名显示元素
     */
    private hideFileNameElements;
    /**
     * 提取编辑器DOM
     *  根本性修复：添加验证和重试机制，确保DOM完整
     */
    private extractEditorDOM;
    /**
     * 设置编辑器
     */
    private setupEditor;
    /**
     * 等待编辑器 DOM 完全就绪
     *  根本性修复：增强检测机制，确保编辑器真正就绪
     *
     * @param editorElement 编辑器元素
     * @returns Promise
     */
    private waitForEditorReady;
    /**
     * 设置编辑器样式
     */
    private setupEditorStyles;
    /**
     * 初始化键盘事件处理器
     */
    private initializeKeyboardHandler;
    /**
     * 初始化布局管理器
     */
    private initializeLayoutManager;
    /**
     * 修复右键菜单z-index
     */
    private setupContextMenuFix;
    /**
     * 修复菜单元素的z-index
     *  修复后：使用合理的z-index值，不再无脑设置超高值
     */
    private fixMenuZIndex;
    /**
     * 监听菜单元素的添加
     */
    private observeMenuElements;
    /**
     * 聚焦编辑器
     *  焦点管理重构：移除 setActiveLeaf 调用，仅在初始化时调用一次
     * 避免移动端键盘闪烁问题
     */
    focusEditor(cursorPosition?: 'start' | 'end'): void;
    /**
     * 检查编辑器是否已初始化
     */
    isReady(): boolean;
    /**
     * 获取编辑器内容
     *  增强版：多层回退机制 + 内容缓存更新
     */
    getContent(): string;
    /**
     * 设置编辑器内容
     */
    setContent(content: string): void;
    /**
     * 🆕 添加内容变化监听器
     */
    onContentChange(callback: (content: string) => void): void;
    /**
     * 🆕 移除内容变化监听器
     */
    offContentChange(callback: (content: string) => void): void;
    /**
     * 🆕 启动内容变化监听
     */
    private startContentChangeMonitoring;
    /**
     * 🆕 停止内容变化监听
     */
    private stopContentChangeMonitoring;
    /**
     * 🆕 通知内容变化
     */
    private notifyContentChange;
    /**
     * 销毁编辑器
     */
    destroy(): void;
    /**
     * 调试日志
     */
    private log;
}
