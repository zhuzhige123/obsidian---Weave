import type { Editor, MarkdownView } from 'obsidian';
import type { WeavePlugin } from '../../main';
export declare class SelectedTextAICardPanelManager {
    private plugin;
    private panels;
    constructor(plugin: WeavePlugin);
    openPanel(params: {
        view: MarkdownView;
        editor: Editor;
        selectedText: string;
        actionId: string;
    }): void;
    closePanel(view: MarkdownView): void;
    dispose(): void;
}
