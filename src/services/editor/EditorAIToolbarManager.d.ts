/**
 * 编辑器AI制卡工具栏管理服务
 *
 * 负责在 MarkdownView 编辑器底部挂载/卸载 AI制卡工具栏 Svelte 组件。
 * 通过右键菜单或命令触发显示，默认不显示。
 */
import type { WeavePlugin } from '../../main';
export declare class EditorAIToolbarManager {
    private plugin;
    private activeToolbar;
    constructor(plugin: WeavePlugin);
    /**
     * 在当前活动的 MarkdownView 底部显示/隐藏 AI制卡工具栏
     */
    toggle(): Promise<void>;
    /**
     * 在指定的 MarkdownView 底部挂载工具栏
     */
    private show;
    /**
     * 关闭当前活动的工具栏
     */
    close(): void;
    /**
     * 检查工具栏是否正在显示
     */
    get isActive(): boolean;
    /**
     * 销毁管理器，清理所有资源
     */
    destroy(): void;
}
