import { ItemView, WorkspaceLeaf, TFile, MarkdownView, setIcon, Menu, Notice, Platform } from 'obsidian';
import type { WeavePlugin } from '../main';
import type { EpubWidthMode, EpubLayoutMode } from '../services/epub';
import type { EpubCanvasService } from '../services/epub/EpubCanvasService';
import type { CanvasLayoutDirection } from '../services/epub/canvas-types';
import { logger } from '../utils/logger';
import { VIEW_TYPE_EPUB_SIDEBAR } from './EpubSidebarView';

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
	private layoutMode: EpubLayoutMode = 'paginated';
	private lastActiveMarkdownLeaf: WorkspaceLeaf | null = null;
	private leafChangeHandler: any = null;
	private layoutChangeHandler: any = null;
	private linkedCanvasPath: string | null = null;
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
	private resumePointBtn: HTMLElement | null = null;
	private bookmarkBtn: HTMLElement | null = null;
	private actionHandlers: {
		setAutoInsert?: (enabled: boolean) => void;
		setScreenshotMode?: (active: boolean) => void;
		setWidthMode?: (mode: EpubWidthMode) => void;
		setLayoutMode?: (mode: EpubLayoutMode) => void;
		setScreenshotSaveMode?: (saveAsImage: boolean) => void;
		navigateToCfi?: (cfi: string, text: string) => void;
		toggleTutorial?: () => void;
		addBookmark?: () => Promise<void>;
		bindCanvasPath?: (canvasPath: string) => void;
		unbindCanvas?: () => void;
		getCanvasService?: () => EpubCanvasService;
		markIRResumePoint?: () => Promise<void>;
	} = {};

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_EPUB;
	}

	getDisplayText(): string {
		return this.bookTitle || 'EPUB 阅读器';
	}

	getIcon(): string {
		return 'book-open';
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		if (!Platform.isMobile) return;

		menu.addItem(item => {
			item.setTitle('切换侧边栏');
			item.setIcon('panel-left');
			item.onClick(() => { void this.toggleGlobalSidebar(); });
		});

		menu.addSeparator();
		this.addMobileToolsToMenu(menu);
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

		if (!Platform.isMobile) {
			this.sidebarBtn = this.addAction('panel-left', '切换侧边栏', () => {
				void this.toggleGlobalSidebar();
			});
		}

		this.saveAsImageBtn = this.addAction('image', '保存为图片文件（开）', () => {
			this.screenshotSaveAsImage = !this.screenshotSaveAsImage;
			this.saveAsImageBtn?.toggleClass('is-active', this.screenshotSaveAsImage);
			this.updateSaveAsImageBtn();
			this.actionHandlers.setScreenshotSaveMode?.(this.screenshotSaveAsImage);
		});
		this.saveAsImageBtn?.toggleClass('is-active', this.screenshotSaveAsImage);
		this.screenshotBtn = this.addAction('camera', '截图工具', () => {
			this.screenshotModeActive = !this.screenshotModeActive;
			this.screenshotBtn?.toggleClass('is-active', this.screenshotModeActive);
			this.actionHandlers.setScreenshotMode?.(this.screenshotModeActive);
		});
		this.autoInsertBtn = this.addAction('zap', '自动模式（关：复制，开：插入）', () => {
			this.autoInsertEnabled = !this.autoInsertEnabled;
			this.autoInsertBtn?.toggleClass('is-active', this.autoInsertEnabled);
			this.actionHandlers.setAutoInsert?.(this.autoInsertEnabled);
		});

		if (Platform.isMobile) {
			this.bookmarkBtn = this.addAction('bookmark', '添加书签', () => {
				void this.actionHandlers.addBookmark?.();
			});
		} else {
			this.layoutBtn = this.addAction('scroll-text', '布局：翻页', () => {
				this.cycleLayoutMode();
			});
			this.widthBtn = this.addAction('align-center', '宽度：标准', () => {
				this.toggleWidthMode();
			});
			this.canvasDirBtn = this.addAction('arrow-down', 'Canvas 方向：向下', (evt) => {
				this.showDirectionMenu(evt);
			});
			this.canvasDirBtn.style.display = 'none';
			this.canvasBtn = this.addAction('layout-dashboard', 'Canvas 脑图（关）', (evt) => {
				this.showCanvasMenu(evt);
			});
			this.bookmarkBtn = this.addAction('bookmark', '添加书签', () => {
				void this.actionHandlers.addBookmark?.();
			});
			this.resumePointBtn = this.addAction('bookmark-plus', 'IR 续读点', () => {
				void this.actionHandlers.markIRResumePoint?.();
			});
			this.addAction('circle-help', '使用教程', () => {
				this.actionHandlers.toggleTutorial?.();
			});
		}

		if (!Platform.isMobile) {
			this.moveSidebarBtnToNav();
		}
		this.setupLeafChangeTracking();
		this.setupLinkedTabTracking();

		if (this.filePath) {
			await this.mountComponent();
		}
	}

	private async toggleGlobalSidebar(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_EPUB_SIDEBAR);
		if (existing.length > 0) {
			existing.forEach(leaf => leaf.detach());
			return;
		}
		const leftLeaf = workspace.getLeftLeaf(false);
		if (leftLeaf) {
			await leftLeaf.setViewState({
				type: VIEW_TYPE_EPUB_SIDEBAR,
				active: true
			});
			void workspace.revealLeaf(leftLeaf);
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
				try { void unmountOld(this.component); } catch (_e) { /* ignore */ }
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
					onReaderSettingsLoaded: (settings: { widthMode: EpubWidthMode; layoutMode: EpubLayoutMode }) => {
						this.widthMode = settings.widthMode;
						this.layoutMode = settings.layoutMode;
						this.updateWidthBtn();
						this.updateLayoutBtn();
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
				text: 'EPUB 加载失败'
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
		if (this.layoutChangeHandler) {
			this.app.workspace.off('layout-change', this.layoutChangeHandler);
			this.layoutChangeHandler = null;
		}
		if (this.component) {
			const { unmount } = await import('svelte');
			try {
				void unmount(this.component);
			} catch (e) {
				// ignore
			}
			this.component = null;
		}
	}

	private setupLinkedTabTracking(): void {
		this.layoutChangeHandler = () => {
			this.checkLinkedCanvasTab();
		};
		this.app.workspace.on('layout-change', this.layoutChangeHandler);
	}

	private checkLinkedCanvasTab(): void {
		const myGroup = (this.leaf as any).group;

		if (!myGroup) {
			// Not in any group - unbind if previously linked
			if (this.linkedCanvasPath) {
				this.linkedCanvasPath = null;
				this.canvasModeActive = false;
				this.actionHandlers.unbindCanvas?.();
				this.updateCanvasBtn();
			}
			return;
		}

		// Find canvas leaves in the same group
		const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
		let foundCanvasPath: string | null = null;

		for (const leaf of canvasLeaves) {
			if ((leaf as any).group === myGroup) {
				const file = (leaf.view as any)?.file;
				if (file?.path) {
					foundCanvasPath = file.path;
					break;
				}
			}
		}

		if (foundCanvasPath && foundCanvasPath !== this.linkedCanvasPath) {
			// New linked canvas detected - auto-bind
			this.linkedCanvasPath = foundCanvasPath;
			this.canvasModeActive = true;
			this.actionHandlers.bindCanvasPath?.(foundCanvasPath);
			this.updateCanvasBtn();
			new Notice(`Canvas 已关联：${foundCanvasPath.split('/').pop()}`);
		} else if (!foundCanvasPath && this.linkedCanvasPath) {
			// Canvas unlinked
			this.linkedCanvasPath = null;
			this.canvasModeActive = false;
			this.actionHandlers.unbindCanvas?.();
			this.updateCanvasBtn();
			new Notice('Canvas 已取消关联');
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
		const modes: EpubLayoutMode[] = ['paginated', 'double'];
		const idx = modes.indexOf(this.layoutMode);
		this.layoutMode = modes[(idx + 1) % modes.length];
		this.updateLayoutBtn();
		this.actionHandlers.setLayoutMode?.(this.layoutMode);
	}

	private updateWidthBtn(): void {
		if (!this.widthBtn) return;
		const icon = this.widthMode === 'standard' ? 'align-center' : 'maximize';
		const label = `宽度：${this.widthMode === 'standard' ? '标准' : '全宽'}`;
		setIcon(this.widthBtn, icon);
		this.widthBtn.setAttribute('aria-label', label);
	}

	private updateLayoutBtn(): void {
		if (!this.layoutBtn) return;
		const iconMap: Record<EpubLayoutMode, string> = {
			'paginated': 'file-text',
			'double': 'book-open'
		};
		setIcon(this.layoutBtn, iconMap[this.layoutMode]);
		const layoutLabels: Record<EpubLayoutMode, string> = { 'paginated': '翻页', 'double': '双栏' };
		this.layoutBtn.setAttribute('aria-label', `布局：${layoutLabels[this.layoutMode]}`);
	}

	private updateSaveAsImageBtn(): void {
		if (!this.saveAsImageBtn) return;
		const icon = this.screenshotSaveAsImage ? 'image' : 'code';
		const label = this.screenshotSaveAsImage ? '保存为图片文件（开）' : '保存为嵌入链接（关）';
		setIcon(this.saveAsImageBtn, icon);
		this.saveAsImageBtn.setAttribute('aria-label', label);
	}

	private updateCanvasBtn(): void {
		if (!this.canvasBtn) return;
		const label = this.canvasModeActive ? 'Canvas 脑图（开）' : 'Canvas 脑图（关）';
		setIcon(this.canvasBtn, 'layout-dashboard');
		this.canvasBtn.setAttribute('aria-label', label);
		this.canvasBtn.toggleClass('is-active', this.canvasModeActive);

		if (this.canvasDirBtn) {
			this.canvasDirBtn.style.display = this.canvasModeActive ? '' : 'none';
		}
	}

	private addMobileToolsToMenu(menu: Menu): void {
		const layoutLabels: Record<EpubLayoutMode, string> = {
			'paginated': '翻页',
			'double': '双栏'
		};
		menu.addItem(item => {
			item.setTitle(`布局：${layoutLabels[this.layoutMode]}`);
			item.setIcon(this.layoutMode === 'paginated' ? 'file-text' : 'book-open');
			item.onClick(() => { this.cycleLayoutMode(); });
		});
		menu.addItem(item => {
			item.setTitle(`宽度：${this.widthMode === 'standard' ? '标准' : '全宽'}`);
			item.setIcon(this.widthMode === 'standard' ? 'align-center' : 'maximize');
			item.onClick(() => { this.toggleWidthMode(); });
		});
		menu.addSeparator();
		menu.addItem(item => {
			item.setTitle('添加书签');
			item.setIcon('bookmark');
			item.onClick(() => { void this.actionHandlers.addBookmark?.(); });
		});
		menu.addItem(item => {
			item.setTitle(this.canvasModeActive ? 'Canvas（开）' : 'Canvas（关）');
			item.setIcon('layout-dashboard');
			item.setChecked(this.canvasModeActive);
			item.onClick((e) => { this.showCanvasMenu(e); });
		});
		if (this.canvasModeActive) {
			const dirLabels: Record<CanvasLayoutDirection, string> = { down: '向下', right: '向右', up: '向上', left: '向左' };
			menu.addItem(item => {
				item.setTitle(`Canvas 方向：${dirLabels[this.canvasDirection]}`);
				item.setIcon({
					down: 'arrow-down',
					right: 'arrow-right',
					up: 'arrow-up',
					left: 'arrow-left'
				}[this.canvasDirection]);
				item.onClick((e) => { this.showDirectionMenu(e); });
			});
		}
		menu.addItem(item => {
			item.setTitle('IR 续读点');
			item.setIcon('bookmark-plus');
			item.onClick(() => { void this.actionHandlers.markIRResumePoint?.(); });
		});
		menu.addItem(item => {
			item.setTitle('使用教程');
			item.setIcon('circle-help');
			item.onClick(() => { this.actionHandlers.toggleTutorial?.(); });
		});
	}

	private showDirectionMenu(evt: MouseEvent | Event): void {
		const canvasService = this.actionHandlers.getCanvasService?.();
		if (!canvasService) return;

		const menu = new Menu();
		const dirs: { dir: CanvasLayoutDirection; icon: string; label: string }[] = [
			{ dir: 'down', icon: 'arrow-down', label: '向下' },
			{ dir: 'right', icon: 'arrow-right', label: '向右' },
			{ dir: 'up', icon: 'arrow-up', label: '向上' },
			{ dir: 'left', icon: 'arrow-left', label: '向左' }
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
		const dirLabels: Record<CanvasLayoutDirection, string> = { down: '向下', right: '向右', up: '向上', left: '向左' };
		this.canvasDirBtn.setAttribute('aria-label', `Canvas 方向：${dirLabels[this.canvasDirection]}`);
	}

	private showCanvasMenu(evt: MouseEvent | Event): void {
		const canvasService = this.actionHandlers.getCanvasService?.();
		if (!canvasService) return;

		const menu = new Menu();

		if (this.canvasModeActive) {
			const currentPath = canvasService.getCanvasPath();
			if (currentPath) {
				menu.addItem(item => {
					item.setTitle(`当前：${currentPath}`);
					item.setIcon('file');
					item.setDisabled(true);
				});
				menu.addItem(item => {
					item.setTitle('打开 Canvas');
					item.setIcon('external-link');
					item.onClick(() => this.openCanvasFile(currentPath));
				});
			}
			menu.addSeparator();
			menu.addItem(item => {
				item.setTitle('断开 Canvas');
				item.setIcon('unlink');
				item.onClick(() => {
					this.canvasModeActive = false;
					this.actionHandlers.unbindCanvas?.();
					this.updateCanvasBtn();
				});
			});
		} else {
			menu.addItem(item => {
				item.setTitle('新建 Canvas');
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
			new Notice(`Canvas 已创建：${canvasPath}`);

			this.openCanvasFile(canvasPath);
		} catch (e) {
			logger.error('[EpubView] Failed to create canvas:', e);
			new Notice('Canvas 创建失败');
		}
	}

	private async bindExistingCanvas(canvasService: EpubCanvasService, path: string): Promise<void> {
		try {
			this.canvasModeActive = true;
			this.actionHandlers.bindCanvasPath?.(path);
			this.updateCanvasBtn();
			new Notice(`Canvas 已连接：${path}`);
		} catch (e) {
			logger.error('[EpubView] Failed to bind canvas:', e);
		}
	}

	private openCanvasFile(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf('split', 'vertical');
			void leaf.openFile(file);
		}
	}

}
