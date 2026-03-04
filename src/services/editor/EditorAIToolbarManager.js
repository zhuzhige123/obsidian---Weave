/**
 * 编辑器AI制卡工具栏管理服务
 *
 * 负责在 MarkdownView 编辑器底部挂载/卸载 AI制卡工具栏 Svelte 组件。
 * 通过右键菜单或命令触发显示，默认不显示。
 */
import { MarkdownView } from 'obsidian';
import { mount, unmount } from 'svelte';
import { logger } from '../../utils/logger';
export class EditorAIToolbarManager {
    plugin;
    activeToolbar = null;
    constructor(plugin) {
        this.plugin = plugin;
    }
    /**
     * 在当前活动的 MarkdownView 底部显示/隐藏 AI制卡工具栏
     */
    async toggle() {
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            logger.debug('[EditorAIToolbar] 当前没有活动的 MarkdownView');
            return;
        }
        const leafId = view.leaf.id || '';
        // 如果已有工具栏且在同一个leaf，关闭它
        if (this.activeToolbar && this.activeToolbar.leafId === leafId) {
            this.close();
            return;
        }
        // 如果在不同leaf有工具栏，先关闭旧的
        if (this.activeToolbar) {
            this.close();
        }
        await this.show(view, leafId);
    }
    /**
     * 在指定的 MarkdownView 底部挂载工具栏
     */
    async show(view, leafId) {
        try {
            // 获取当前文档内容
            const editor = view.editor;
            const content = editor.getValue();
            const filePath = view.file?.path || '';
            // 创建容器元素
            const containerEl = document.createElement('div');
            containerEl.className = 'weave-editor-ai-toolbar-container';
            // 将容器插入到编辑器视图的底部
            const contentEl = view.contentEl;
            contentEl.appendChild(containerEl);
            // 动态导入并挂载 Svelte 组件
            const { default: EditorAICardToolbar } = await import('../../components/ai-assistant/EditorAICardToolbar.svelte');
            const component = mount(EditorAICardToolbar, {
                target: containerEl,
                props: {
                    plugin: this.plugin,
                    content: content,
                    sourceFilePath: filePath,
                    onClose: () => {
                        this.close();
                    }
                }
            });
            this.activeToolbar = {
                component,
                containerEl,
                leafId
            };
            logger.debug('[EditorAIToolbar] 工具栏已挂载到编辑器');
        }
        catch (error) {
            logger.error('[EditorAIToolbar] 挂载工具栏失败:', error);
        }
    }
    /**
     * 关闭当前活动的工具栏
     */
    close() {
        if (!this.activeToolbar)
            return;
        try {
            unmount(this.activeToolbar.component);
            this.activeToolbar.containerEl.remove();
            logger.debug('[EditorAIToolbar] 工具栏已卸载');
        }
        catch (error) {
            logger.error('[EditorAIToolbar] 卸载工具栏失败:', error);
        }
        this.activeToolbar = null;
    }
    /**
     * 检查工具栏是否正在显示
     */
    get isActive() {
        return this.activeToolbar !== null;
    }
    /**
     * 销毁管理器，清理所有资源
     */
    destroy() {
        this.close();
    }
}
