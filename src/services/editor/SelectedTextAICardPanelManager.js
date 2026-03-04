import { mount, unmount } from 'svelte';
import SelectedTextAICardPanel from '../../components/ai-assistant/SelectedTextAICardPanel.svelte';
export class SelectedTextAICardPanelManager {
    plugin;
    panels = new Map();
    constructor(plugin) {
        this.plugin = plugin;
    }
    openPanel(params) {
        const { view, selectedText, actionId } = params;
        this.closePanel(view);
        const container = document.createElement('div');
        container.className = 'weave-ai-card-panel-container';
        view.contentEl.append(container);
        const instance = mount(SelectedTextAICardPanel, {
            target: container,
            props: {
                plugin: this.plugin,
                selectedText,
                actionId,
                sourceFilePath: view.file?.path || '',
                onClose: () => this.closePanel(view)
            }
        });
        this.panels.set(view, { container, instance });
    }
    closePanel(view) {
        const existing = this.panels.get(view);
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
        this.panels.delete(view);
    }
    dispose() {
        for (const [view] of this.panels) {
            this.closePanel(view);
        }
        this.panels.clear();
    }
}
