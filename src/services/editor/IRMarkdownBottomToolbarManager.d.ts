import type { WeavePlugin } from '../../main';
export declare class IRMarkdownBottomToolbarManager {
    private plugin;
    private toolbars;
    private enabled;
    constructor(plugin: WeavePlugin);
    private isDetachedLeafEditorView;
    enable(): void;
    disable(): void;
    private attachAllExistingMarkdownViews;
    private attachToView;
    private closeToolbar;
    dispose(): void;
    private mapActionToLabel;
}
