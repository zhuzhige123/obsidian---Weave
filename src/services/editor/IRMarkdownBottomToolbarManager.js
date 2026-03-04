import { Notice, Platform } from 'obsidian';
import { mount, unmount } from 'svelte';
import IRMarkdownBottomToolbarPreview from '../../components/incremental-reading/IRMarkdownBottomToolbarPreview.svelte';
export class IRMarkdownBottomToolbarManager {
    plugin;
    toolbars = new Map();
    enabled = false;
    constructor(plugin) {
        this.plugin = plugin;
    }
    isDetachedLeafEditorView(view) {
        try {
            const content = view.contentEl;
            const container = view.containerEl;
            if (container?.dataset?.weaveDetachedLeafEditor === 'true')
                return true;
            if (content?.dataset?.weaveDetachedLeafEditor === 'true')
                return true;
            if (content?.closest?.('[data-weave-detached-leaf-editor="true"]'))
                return true;
            return false;
        }
        catch {
            return false;
        }
    }
    enable() {
        if (this.enabled)
            return;
        this.enabled = true;
        this.attachAllExistingMarkdownViews();
        this.plugin.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
            if (!this.enabled)
                return;
            this.attachAllExistingMarkdownViews();
        }));
        this.plugin.registerEvent(this.plugin.app.workspace.on('layout-change', () => {
            if (!this.enabled)
                return;
            this.attachAllExistingMarkdownViews();
        }));
    }
    disable() {
        if (!this.enabled)
            return;
        this.enabled = false;
        this.dispose();
    }
    attachAllExistingMarkdownViews() {
        const leaves = this.plugin.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            const view = leaf.view;
            this.attachToView(view);
        }
        for (const view of Array.from(this.toolbars.keys())) {
            if (!leaves.some(l => l.view === view)) {
                this.closeToolbar(view);
            }
        }
    }
    attachToView(view) {
        if (!this.enabled)
            return;
        if (this.toolbars.has(view))
            return;
        if (this.isDetachedLeafEditorView(view))
            return;
        const root = view.contentEl;
        if (!root)
            return;
        const container = document.createElement('div');
        container.className = 'weave-ir-markdown-bottom-toolbar-container';
        root.append(container);
        const instance = mount(IRMarkdownBottomToolbarPreview, {
            target: container,
            props: {
                onAction: (actionId) => {
                    const label = this.mapActionToLabel(actionId);
                    if (Platform.isMobile) {
                        new Notice(label);
                    }
                    else {
                        new Notice(label);
                    }
                }
            }
        });
        this.toolbars.set(view, { container, instance });
    }
    closeToolbar(view) {
        const existing = this.toolbars.get(view);
        if (!existing)
            return;
        try {
            unmount(existing.instance);
        }
        catch {
        }
        try {
            existing.container.remove();
        }
        catch {
        }
        this.toolbars.delete(view);
    }
    dispose() {
        for (const [view] of this.toolbars) {
            this.closeToolbar(view);
        }
        this.toolbars.clear();
    }
    mapActionToLabel(actionId) {
        const map = {
            review: '复查（预览）',
            tomorrow: '明天（预览）',
            normal: '正常（预览）',
            in3days: '3天后（预览）',
            intensive: '攻坚（预览）',
            in10days: '10天后（预览）',
            later: '稍后（预览）',
            plus2days: '+2天（预览）'
        };
        return map[actionId] ?? `${actionId}（预览）`;
    }
}
