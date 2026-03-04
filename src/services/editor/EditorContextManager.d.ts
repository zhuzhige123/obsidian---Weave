/**
 * 全局编辑器上下文管理器
 *
 * 职责：
 * 1. 跟踪当前活动的插件编辑器
 * 2. 为全局快捷键提供编辑器实例访问
 * 3. 支持标准的 Obsidian Editor API
 *
 * 设计理念：
 * - 单例模式确保全局唯一
 * - 提供兼容的 Editor API，使全局快捷键无需修改即可支持插件编辑器
 * - 基于焦点事件自动追踪活动编辑器
 */
import type { DetachedLeafEditor } from './DetachedLeafEditor';
import type { Editor } from 'obsidian';
/**
 * 编辑器上下文管理器（单例）
 */
declare class EditorContextManager {
    private static instance;
    private activePluginEditor;
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): EditorContextManager;
    /**
     * 注册活动编辑器
     * 当插件编辑器获得焦点时调用
     */
    registerActive(editor: DetachedLeafEditor): void;
    /**
     * 取消注册
     * 当插件编辑器失焦或销毁时调用
     */
    unregisterActive(editor: DetachedLeafEditor): void;
    /**
     * 获取活动的插件编辑器
     */
    getActivePluginEditor(): DetachedLeafEditor | null;
    /**
     * 检查是否有活动的插件编辑器
     */
    hasActivePluginEditor(): boolean;
    /**
     * 获取兼容的 Editor API（用于全局快捷键）
     *
     * 返回一个兼容 Obsidian Editor 的对象，支持：
     * - getSelection(): 获取选中文本
     * - replaceSelection(): 替换选中文本
     * - getValue(): 获取全部内容
     * - setValue(): 设置全部内容
     *
     * @returns 兼容的 Editor 对象，如果没有活动编辑器则返回 null
     */
    getCompatibleEditor(): Editor | null;
}
export default EditorContextManager;
