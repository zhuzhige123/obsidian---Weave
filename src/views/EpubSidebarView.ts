import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { WeavePlugin } from '../main';
import { logger } from '../utils/logger';

export const VIEW_TYPE_EPUB_SIDEBAR = 'weave-epub-sidebar';

export class EpubSidebarView extends ItemView {
	private component: any = null;
	private plugin: WeavePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_EPUB_SIDEBAR;
	}

	getDisplayText(): string {
		return 'EPUB \u4fa7\u8fb9\u680f';
	}

	getIcon(): string {
		return 'book-open';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('weave-epub-sidebar-view');

		try {
			const { mount } = await import('svelte');
			const { default: EpubGlobalSidebar } = await import('../components/epub/EpubGlobalSidebar.svelte');

			this.component = mount(EpubGlobalSidebar, {
				target: this.contentEl,
				props: {
					app: this.app
				}
			});

			logger.debug('[EpubSidebarView] Sidebar component mounted');
		} catch (error) {
			logger.error('[EpubSidebarView] Failed to mount sidebar:', error);
			this.contentEl.empty();
			this.contentEl.createDiv({
				cls: 'epub-error',
				text: 'Sidebar loading failed'
			});
		}
	}

	async onClose(): Promise<void> {
		if (this.component) {
			const { unmount } = await import('svelte');
			try {
				void unmount(this.component);
			} catch (_e) {
				// ignore
			}
			this.component = null;
		}
	}
}
