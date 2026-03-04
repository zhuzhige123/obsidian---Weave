import { ItemView, WorkspaceLeaf, TFile, MarkdownView, setIcon, Menu, Notice } from 'obsidian';
import type { WeavePlugin } from '../main';
import type { EpubWidthMode, EpubLayoutMode } from '../services/epub';
import type { EpubCanvasService } from '../services/epub/EpubCanvasService';
import type { CanvasLayoutDirection } from '../services/epub/canvas-types';
import { logger } from '../utils/logger';

export const VIEW_TYPE_EPUB = 'weave-epub-reader';

export class EpubView extends ItemView {
	private component: any = null;
	private plugin: WeavePlugin;
	private filePath: string = '';
	private bookTitle: string = '';
	private isOpen: boolean = false;
	private pendingCfi: string = '';
	private pendingText: string = '';
	private autoInsertEnabled: boolean = false;
	private screenshotModeActive: boolean = false;
	private screenshotSaveAsImage: boolean = true;
	private widthMode: EpubWidthMode = 'standard';
	private layoutMode: EpubLayoutMode = 'scroll';
	private lastActiveMarkdownLeaf: WorkspaceLeaf | null = null;
	private leafChangeHandler: any = null;
	private mounting = false;
	private sidebarBtn: HTMLElement | null = null;
	private autoInsertBtn: HTMLElement | null = null;
	private screenshotBtn: HTMLElement | null = null;
	private saveAsImageBtn: HTMLElement | null = null;
	private widthBtn: HTMLElement | null = null;
	private layoutBtn: HTMLElement | null = null;
	private canvasBtn: HTMLElement | null = null;
	private canvasDirBtn: HTMLElement | null = null;
	private canvasModeActive: boolean = false;
	private canvasDirection: CanvasLayoutDirection = 'down';
	private actionHandlers: {
		toggleSidebar?: () => void;
		toggleSettings?: () => void;
		setAutoInsert?: (enabled: boolean) => void;
		setScreenshotMode?: (active: boolean) => void;
		setWidthMode?: (mode: EpubWidthMode) => void;
		setLayoutMode?: (mode: EpubLayoutMode) => void;
		setScreenshotSaveMode?: (saveAsImage: boolean) => void;
		navigateToCfi?: (cfi: string, text: string) => void;
		toggleTutorial?: () => void;
		bindCanvasPath?: (canvasPath: string) => void;
		unbindCanvas?: () => void;
		getCanvasService?: () => EpubCanvasService;
	} = {};

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_EPUB;
	}

	getDisplayText(): string {
		return this.bookTitle || 'EPUB Reader';
	}

	getIcon(): string {
		return 'book-open';
	}

	allowNoFile(): boolean {
		return true;
	}

	getState(): any {
		return { filePath: this.filePath, file: this.filePath };
	}

	async setState(state: any, result: any): Promise<void> {
		await super.setState(state, result);

		const incomingPath = state?.filePath || state?.file || '';

		if (state?.pendingCfi) {
			this.pendingCfi = state.pendingCfi;
			this.pendingText = state.pendingText || '';
		}

		if (incomingPath && incomingPath !== this.filePath) {
			this.filePath = incomingPath;
			if (this.isOpen) {
				await this.mountComponent();
			}
		} else if (incomingPath && !this.component && this.isOpen) {
			this.filePath = incomingPath;
			await this.mountComponent();
		} else if (this.pendingCfi && this.component) {
			this.actionHandlers.navigateToCfi?.(this.pendingCfi, this.pendingText);
			this.pendingCfi = '';
			this.pendingText = '';
		}
	}

	async onOpen(): Promise<void> {
		this.isOpen = true;
		this.contentEl.empty();
		this.contentEl.addClass('weave-epub-view-content');

		this.sidebarBtn = this.addAction('panel-left', 'Toggle sidebar', () => {
			this.actionHandlers.toggleSidebar?.();
		});
		this.addAction('a-large-small', 'Display settings', () => {
			this.actionHandlers.toggleSettings?.();
		});
		this.saveAsImageBtn = this.addAction('image', 'Save as image file (ON)', () => {
			this.screenshotSaveAsImage = !this.screenshotSaveAsImage;
			this.saveAsImageBtn?.toggleClass('is-active', this.screenshotSaveAsImage);
			this.updateSaveAsImageBtn();
			this.actionHandlers.setScreenshotSaveMode?.(this.screenshotSaveAsImage);
		});
		this.saveAsImageBtn?.toggleClass('is-active', this.screenshotSaveAsImage);
		this.screenshotBtn = this.addAction('camera', 'Screenshot tool', () => {
			this.screenshotModeActive = !this.screenshotModeActive;
			this.screenshotBtn?.toggleClass('is-active', this.screenshotModeActive);
			this.actionHandlers.setScreenshotMode?.(this.screenshotModeActive);
		});
		this.autoInsertBtn = this.addAction('zap', 'Auto (OFF: copy, ON: insert)', () => {
			this.autoInsertEnabled = !this.autoInsertEnabled;
			this.autoInsertBtn?.toggleClass('is-active', this.autoInsertEnabled);
			this.actionHandlers.setAutoInsert?.(this.autoInsertEnabled);
		});
		this.layoutBtn = this.addAction('scroll-text', 'Layout: scroll', () => {
			this.cycleLayoutMode();
		});
		this.widthBtn = this.addAction('align-center', 'Width: standard', () => {
			this.toggleWidthMode();
		});
		this.canvasDirBtn = this.addAction('arrow-down', 'Canvas direction: down', (evt) => {
			this.showDirectionMenu(evt);
		});
		this.canvasDirBtn.style.display = 'none';
		this.canvasBtn = this.addAction('layout-dashboard', 'Canvas mind map (OFF)', (evt) => {
			this.showCanvasMenu(evt);
		});
		this.addAction('circle-help', 'Tutorial', () => {
			this.actionHandlers.toggleTutorial?.();
		});

		this.moveSidebarBtnToNav();
		this.setupLeafChangeTracking();

		if (this.filePath) {
			await this.mountComponent();
		}
	}

	private moveSidebarBtnToNav(): void {
		if (!this.sidebarBtn) return;
		const navButtons = this.containerEl.querySelector('.view-header-nav-buttons');
		if (navButtons) {
			navButtons.appendChild(this.sidebarBtn);
		}
	}

	private async mountComponent(): Promise<void> {
		if (this.mounting) return;
		this.mounting = true;
		try {
			if (this.component) {
				const { unmount: unmountOld } = await import('svelte');
				try { unmountOld(this.component); } catch (_e) { /* ignore */ }
				this.component = null;
			}
			this.contentEl.empty();

			const { mount } = await import('svelte');
			const { default: EpubReaderApp } = await import('../components/epub/EpubReaderApp.svelte');

			this.component = mount(EpubReaderApp, {
				target: this.contentEl,
				props: {
					app: this.app,
					filePath: this.filePath,
					onTitleChange: (title: string) => {
						this.bookTitle = title;
						(this.leaf as any).updateHeader?.();
					},
					pendingCfi: this.pendingCfi,
					pendingText: this.pendingText,
					autoInsertEnabled: this.autoInsertEnabled,
					getLastActiveMarkdownLeaf: () => this.getValidMarkdownLeaf(),
					onActionsReady: (actions: typeof this.actionHandlers) => {
						this.actionHandlers = actions;
						if (this.pendingCfi) {
							this.actionHandlers.navigateToCfi?.(this.pendingCfi, this.pendingText);
							this.pendingCfi = '';
							this.pendingText = '';
						}
					},
					onSwitchBook: async (newFilePath: string) => {
						this.filePath = newFilePath;
						await this.mountComponent();
					},
					onCanvasStateChange: (active: boolean, _canvasPath: string | null) => {
						this.canvasModeActive = active;
						this.updateCanvasBtn();
					}
				}
			});

			logger.debug('[EpubView] EPUB component mounted:', this.filePath);
		} catch (error) {
			logger.error('[EpubView] Failed to mount EPUB component:', error);
			this.contentEl.empty();
			this.contentEl.createDiv({
				cls: 'epub-error-state',
				text: 'EPUB loading failed'
			});
		} finally {
			this.mounting = false;
		}
	}

	async onClose(): Promise<void> {
		if (this.leafChangeHandler) {
			this.app.workspace.off('active-leaf-change', this.leafChangeHandler);
			this.leafChangeHandler = null;
		}
		if (this.component) {
			const { unmount } = await import('svelte');
			try {
				unmount(this.component);
			} catch (e) {
				// ignore
			}
			this.component = null;
		}
	}

	private setupLeafChangeTracking(): void {
		this.leafChangeHandler = (leaf: WorkspaceLeaf | null) => {
			if (leaf && leaf.view instanceof MarkdownView) {
				this.lastActiveMarkdownLeaf = leaf;
			}
		};
		this.app.workspace.on('active-leaf-change', this.leafChangeHandler);

		const currentLeaves = this.app.workspace.getLeavesOfType('markdown');
		if (currentLeaves.length > 0) {
			this.lastActiveMarkdownLeaf = currentLeaves[0];
		}
	}

	private getValidMarkdownLeaf(): WorkspaceLeaf | null {
		if (this.lastActiveMarkdownLeaf) {
			try {
				const view = this.lastActiveMarkdownLeaf.view;
				if (view instanceof MarkdownView && view.editor) {
					return this.lastActiveMarkdownLeaf;
				}
			} catch (_e) {
				// stale reference
			}
		}

		const leaves = this.app.workspace.getLeavesOfType('markdown');
		for (const leaf of leaves) {
			if (leaf.view instanceof MarkdownView && leaf.view.editor) {
				this.lastActiveMarkdownLeaf = leaf;
				return leaf;
			}
		}
		return null;
	}

	public updateBookTitle(title: string): void {
		this.bookTitle = title;
	}

	private toggleWidthMode(): void {
		this.widthMode = this.widthMode === 'standard' ? 'full' : 'standard';
		this.updateWidthBtn();
		this.actionHandlers.setWidthMode?.(this.widthMode);
	}

	private cycleLayoutMode(): void {
		const modes: EpubLayoutMode[] = ['scroll', 'paginated', 'double'];
		const idx = modes.indexOf(this.layoutMode);
		this.layoutMode = modes[(idx + 1) % modes.length];
		this.updateLayoutBtn();
		this.actionHandlers.setLayoutMode?.(this.layoutMode);
	}

	private updateWidthBtn(): void {
		if (!this.widthBtn) return;
		const icon = this.widthMode === 'standard' ? 'align-center' : 'maximize';
		const label = `Width: ${this.widthMode}`;
		setIcon(this.widthBtn, icon);
		this.widthBtn.setAttribute('aria-label', label);
	}

	private updateLayoutBtn(): void {
		if (!this.layoutBtn) return;
		const iconMap: Record<EpubLayoutMode, string> = {
			'scroll': 'scroll-text',
			'paginated': 'file-text',
			'double': 'book-open'
		};
		setIcon(this.layoutBtn, iconMap[this.layoutMode]);
		this.layoutBtn.setAttribute('aria-label', `Layout: ${this.layoutMode}`);
	}

	private updateSaveAsImageBtn(): void {
		if (!this.saveAsImageBtn) return;
		const icon = this.screenshotSaveAsImage ? 'image' : 'code';
		const label = this.screenshotSaveAsImage ? 'Save as image file (ON)' : 'Save as embed link (OFF)';
		setIcon(this.saveAsImageBtn, icon);
		this.saveAsImageBtn.setAttribute('aria-label', label);
	}

	private updateCanvasBtn(): void {
		if (!this.canvasBtn) return;
		const label = this.canvasModeActive ? 'Canvas mind map (ON)' : 'Canvas mind map (OFF)';
		setIcon(this.canvasBtn, 'layout-dashboard');
		this.canvasBtn.setAttribute('aria-label', label);
		this.canvasBtn.toggleClass('is-active', this.canvasModeActive);

		if (this.canvasDirBtn) {
			this.canvasDirBtn.style.display = this.canvasModeActive ? '' : 'none';
		}
	}

	private showDirectionMenu(evt: MouseEvent | Event): void {
		const canvasService = this.actionHandlers.getCanvasService?.();
		if (!canvasService) return;

		const menu = new Menu();
		const dirs: { dir: CanvasLayoutDirection; icon: string; label: string }[] = [
			{ dir: 'down', icon: 'arrow-down', label: 'Down' },
			{ dir: 'right', icon: 'arrow-right', label: 'Right' },
			{ dir: 'up', icon: 'arrow-up', label: 'Up' },
			{ dir: 'left', icon: 'arrow-left', label: 'Left' }
		];

		for (const { dir, icon, label } of dirs) {
			menu.addItem(item => {
				item.setTitle(label);
				item.setIcon(icon);
				item.setChecked(this.canvasDirection === dir);
				item.onClick(() => {
					this.canvasDirection = dir;
					canvasService.setLayoutDirection(dir);
					this.updateDirectionBtn();
				});
			});
		}

		menu.showAtMouseEvent(evt as MouseEvent);
	}

	private updateDirectionBtn(): void {
		if (!this.canvasDirBtn) return;
		const iconMap: Record<CanvasLayoutDirection, string> = {
			down: 'arrow-down',
			right: 'arrow-right',
			up: 'arrow-up',
			left: 'arrow-left'
		};
		setIcon(this.canvasDirBtn, iconMap[this.canvasDirection]);
		this.canvasDirBtn.setAttribute('aria-label', `Canvas direction: ${this.canvasDirection}`);
	}

	private showCanvasMenu(evt: MouseEvent | Event): void {
		const canvasService = this.actionHandlers.getCanvasService?.();
		if (!canvasService) return;

		const menu = new Menu();

		if (this.canvasModeActive) {
			const currentPath = canvasService.getCanvasPath();
			if (currentPath) {
				menu.addItem(item => {
					item.setTitle(`Current: ${currentPath}`);
					item.setIcon('file');
					item.setDisabled(true);
				});
				menu.addItem(item => {
					item.setTitle('Open canvas');
					item.setIcon('external-link');
					item.onClick(() => this.openCanvasFile(currentPath));
				});
			}
			menu.addSeparator();
			menu.addItem(item => {
				item.setTitle('Disconnect canvas');
				item.setIcon('unlink');
				item.onClick(() => {
					this.canvasModeActive = false;
					this.actionHandlers.unbindCanvas?.();
					this.updateCanvasBtn();
				});
			});
		} else {
			menu.addItem(item => {
				item.setTitle('Create new canvas');
				item.setIcon('plus');
				item.onClick(() => this.createAndBindCanvas(canvasService));
			});

			const canvasFiles = this.app.vault.getFiles()
				.filter(f => f.extension === 'canvas')
				.sort((a, b) => b.stat.mtime - a.stat.mtime)
				.slice(0, 15);

			if (canvasFiles.length > 0) {
				menu.addSeparator();
				for (const file of canvasFiles) {
					menu.addItem(item => {
						item.setTitle(file.path);
						item.setIcon('file');
						item.onClick(() => this.bindExistingCanvas(canvasService, file.path));
					});
				}
			}
		}

		menu.showAtMouseEvent(evt as MouseEvent);
	}

	private async createAndBindCanvas(canvasService: EpubCanvasService): Promise<void> {
		const title = this.bookTitle || 'EPUB';
		const safeName = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 40).trim();
		const canvasPath = `${safeName}-mindmap.canvas`;

		try {
			await canvasService.createCanvas(canvasPath);
			this.canvasModeActive = true;
			this.actionHandlers.bindCanvasPath?.(canvasPath);
			this.updateCanvasBtn();
			new Notice(`Canvas created: ${canvasPath}`);

			this.openCanvasFile(canvasPath);
		} catch (e) {
			logger.error('[EpubView] Failed to create canvas:', e);
			new Notice('Failed to create canvas');
		}
	}

	private async bindExistingCanvas(canvasService: EpubCanvasService, path: string): Promise<void> {
		try {
			this.canvasModeActive = true;
			this.actionHandlers.bindCanvasPath?.(path);
			this.updateCanvasBtn();
			new Notice(`Canvas connected: ${path}`);
		} catch (e) {
			logger.error('[EpubView] Failed to bind canvas:', e);
		}
	}

	private openCanvasFile(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf('split', 'vertical');
			leaf.openFile(file);
		}
	}

}
