<script lang="ts">
	import type { App, WorkspaceLeaf } from 'obsidian';
	import { setIcon, MarkdownView, Notice, Menu } from 'obsidian';
	import { onMount } from 'svelte';
	import EpubReaderView from './EpubReaderView.svelte';
	import BottomNav from './BottomNav.svelte';
	import SelectionToolbar from './SelectionToolbar.svelte';
	import ScreenshotOverlay from './ScreenshotOverlay.svelte';
	import EpubTutorial from './EpubTutorial.svelte';
	import EpubHighlightToolbar from './EpubHighlightToolbar.svelte';
	import { EpubReaderService, EpubStorageService, EpubAnnotationService, EpubLinkService } from '../../services/epub';
	import type { EpubExcerptSettings } from '../../services/epub/EpubStorageService';
	import { EpubBacklinkHighlightService } from '../../services/epub/EpubBacklinkHighlightService';
	import { IREpubBookmarkTaskService } from '../../services/incremental-reading/IREpubBookmarkTaskService';
	import { EpubScreenshotService } from '../../services/epub/EpubScreenshotService';
	import { EpubCanvasService } from '../../services/epub/EpubCanvasService';
	import type { ScreenshotRect } from '../../services/epub/EpubScreenshotService';
	import type { EpubBook, EpubReaderSettings, EpubTheme, EpubWidthMode, EpubLayoutMode, HighlightClickInfo } from '../../services/epub';
	import { epubActiveDocumentStore } from '../../stores/epub-active-document-store';
	import { logger } from '../../utils/logger';
	import '../../styles/epub/epub-reader.css';

	interface Props {
		app: App;
		filePath: string;
		pendingCfi?: string;
		pendingText?: string;
		autoInsertEnabled?: boolean;
		getLastActiveMarkdownLeaf?: () => WorkspaceLeaf | null;
		onTitleChange?: (title: string) => void;
		onReaderSettingsLoaded?: (settings: EpubReaderSettings) => void;
		onActionsReady?: (actions: {
			setAutoInsert: (enabled: boolean) => void;
			setScreenshotMode: (active: boolean) => void;
			setWidthMode: (mode: EpubWidthMode) => void;
			setLayoutMode: (mode: EpubLayoutMode) => void;
			setScreenshotSaveMode: (saveAsImage: boolean) => void;
			navigateToCfi: (cfi: string, text: string) => void;
			toggleTutorial: () => void;
			addBookmark: () => Promise<void>;
			bindCanvasPath: (canvasPath: string) => void;
			unbindCanvas: () => void;
			getCanvasService: () => EpubCanvasService;
			markIRResumePoint: () => Promise<void>;
		}) => void;
		onSwitchBook?: (filePath: string) => void;
		onCanvasStateChange?: (active: boolean, canvasPath: string | null) => void;
	}

	let { app, filePath, pendingCfi = '', pendingText = '', autoInsertEnabled: initialAutoInsert = false, getLastActiveMarkdownLeaf, onTitleChange, onReaderSettingsLoaded, onActionsReady, onSwitchBook, onCanvasStateChange }: Props = $props();

	let readerService = new EpubReaderService(app);
	let storageService = new EpubStorageService(app);
	let annotationService = new EpubAnnotationService(storageService);
	let linkService = new EpubLinkService(app);
	let screenshotService = new EpubScreenshotService(app);
	let canvasService = new EpubCanvasService(app);
	let backlinkService = new EpubBacklinkHighlightService(app);

	let book = $state<EpubBook | null>(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let readingProgress = $state(0);
	let renditionVersion = $state(0);
	let autoInsert = $state(initialAutoInsert);
	let screenshotMode = $state(false);
	let screenshotSaveAsImage = $state(true);
	let tutorialVisible = $state(false);
	let canvasMode = $state(false);
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let viewportEl = $state<HTMLDivElement | undefined>(undefined);
	let highlightToolbarInfo = $state<HighlightClickInfo | null>(null);
	let excerptSettings = $state<EpubExcerptSettings>({ addCreationTime: false });

	// IR navigation buffer: store navigation intent until rendition is ready
	let pendingIRNav = $state<{ cfi?: string; href?: string } | null>(null);
	let renditionReady = $state(false);

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	let settings = $state<EpubReaderSettings>({
		lineHeight: 1.618,
		theme: 'default',
		widthMode: 'standard',
		layoutMode: 'paginated'
	});

	function applyAndPersistReaderSettings(nextSettings: EpubReaderSettings) {
		settings = nextSettings;
		onReaderSettingsLoaded?.(nextSettings);
		void storageService.saveReaderSettings(nextSettings);
	}

	async function loadBook() {
		loading = true;
		errorMsg = '';
		try {
			const existingBook = await storageService.findBookByFilePath(filePath);
			book = await readerService.loadEpub(filePath, existingBook?.id);

			if (existingBook) {
				book.readingStats = existingBook.readingStats;
				book.currentPosition = existingBook.currentPosition;
			}

			await storageService.saveBook(book);
			onTitleChange?.(book.metadata.title);
			epubActiveDocumentStore.setSharedState({ filePath, book });
			epubActiveDocumentStore.setActiveDocument(filePath);
			await initCanvasBinding();
		} catch (error) {
			logger.error('[EpubReaderApp] Failed to load EPUB:', error);
			errorMsg = `${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			loading = false;
		}
	}


	function toggleTutorial() {
		tutorialVisible = !tutorialVisible;
	}

	async function addBookmark() {
		if (!book) {
			new Notice('未加载书籍');
			return;
		}
		try {
			const pos = readerService.getCurrentPosition();
			const chapterTitle = readerService.getCurrentChapterTitle() || `Page ${Math.round(pos.percent)}%`;
			const preview = chapterTitle;
			await annotationService.createBookmark(
				book.id,
				chapterTitle,
				pos.chapterIndex,
				pos.cfi,
				preview
			);
			new Notice('书签已添加');
		} catch (e) {
			new Notice('添加书签失败');
		}
	}

	function showSettingsMenu(evt: MouseEvent) {
		const menu = new Menu();

		menu.addItem(item => {
			item.setTitle('护眼模式');
			item.setIcon('sun');
			item.setChecked(settings.theme === 'sepia');
			item.onClick(() => {
				handleThemeChange(settings.theme === 'sepia' ? 'default' : 'sepia');
			});
		});

		menu.addSeparator();

		menu.addItem(item => {
			item.setTitle('摘录时间戳');
			item.setIcon('clock');
			item.setChecked(excerptSettings.addCreationTime);
			item.onClick(async () => {
				excerptSettings = { ...excerptSettings, addCreationTime: !excerptSettings.addCreationTime };
				await storageService.saveExcerptSettings(excerptSettings);
			});
		});

		menu.showAtMouseEvent(evt);
	}

	function handleThemeChange(theme: EpubTheme) {
		applyAndPersistReaderSettings({ ...settings, theme });
	}

	function handleWidthModeChange(mode: EpubWidthMode) {
		applyAndPersistReaderSettings({ ...settings, widthMode: mode });
	}

	function handleLayoutModeChange(mode: EpubLayoutMode) {
		applyAndPersistReaderSettings({ ...settings, layoutMode: mode });
	}

	async function handlePrevPage() {
		await readerService.prevPage();
	}

	async function handleNextPage() {
		await readerService.nextPage();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			readerService.prevPage();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			readerService.nextPage();
		}
	}

	function buildNoteContent(text: string, cfiRange: string, color?: string): string {
		const chapterIndex = readerService.getCurrentChapterIndex();
		const chapterTitle = readerService.getCurrentChapterTitle();
		const timestamp = excerptSettings.addCreationTime ? formatTimestamp(new Date()) : undefined;
		return linkService.buildQuoteBlock(filePath, cfiRange, text, chapterIndex, color, chapterTitle, timestamp);
	}

	function formatTimestamp(date: Date): string {
		const y = date.getFullYear();
		const mo = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		const h = String(date.getHours()).padStart(2, '0');
		const mi = String(date.getMinutes()).padStart(2, '0');
		return `${y}-${mo}-${d} ${h}:${mi}`;
	}

	function insertToEditor(content: string) {
		const leaf = getLastActiveMarkdownLeaf?.();
		if (!leaf) {
			new Notice('未找到活动的 Markdown 编辑器');
			return;
		}
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || !view.editor) {
			new Notice('未找到活动的 Markdown 编辑器');
			return;
		}
		const editor = view.editor;
		const cursor = editor.getCursor();
		editor.replaceRange(content + '\n', cursor);
		const lines = content.split('\n').length;
		editor.setCursor({ line: cursor.line + lines, ch: 0 });
	}

	async function copyTextToClipboard(content: string) {
		try {
			await navigator.clipboard.writeText(content);
			new Notice('已复制到剪贴板');
		} catch (_e) {
			new Notice('复制失败');
		}
	}

	async function copyImageToClipboard(blob: Blob) {
		try {
			await navigator.clipboard.write([
				new ClipboardItem({ [blob.type]: blob })
			]);
			new Notice('图片已复制到剪贴板');
		} catch (_e) {
			new Notice('图片复制失败');
		}
	}

	function outputNote(text: string, cfiRange: string, color?: string) {
		if (canvasMode && canvasService.isActive()) {
			addToCanvas(text, cfiRange, color);
			return;
		}

		const content = buildNoteContent(text, cfiRange, color);
		if (autoInsert) {
			insertToEditor(content);
		} else {
			copyTextToClipboard(content);
		}
	}

	async function addToCanvas(text: string, cfiRange: string, color?: string) {
		const chapterIndex = readerService.getCurrentChapterIndex();
		const chapterTitle = readerService.getCurrentChapterTitle();

		canvasService.updateAnchorFromCanvasSelection(app);

		const timestamp = excerptSettings.addCreationTime ? formatTimestamp(new Date()) : undefined;
		const node = await canvasService.addExcerptNode(
			text, cfiRange, filePath, chapterIndex, chapterTitle, color, timestamp
		);
		if (node) {
			new Notice('已添加到 Canvas');
		}
	}

	async function initCanvasBinding() {
		if (!book) return;
		const savedPath = await storageService.getCanvasBinding(book.id);
		if (savedPath) {
			const exists = await app.vault.adapter.exists(savedPath);
			if (exists) {
				canvasService.setCanvasPath(savedPath);
				canvasMode = true;
				onCanvasStateChange?.(true, savedPath);
			}
		}
	}

	async function bindCanvas(canvasPath: string) {
		if (!book) return;
		canvasService.setCanvasPath(canvasPath);
		await storageService.setCanvasBinding(book.id, canvasPath);
		canvasMode = true;
	}

	async function unbindCanvas() {
		if (!book) return;
		canvasService.setCanvasPath(null);
		canvasService.setAnchor(null);
		await storageService.removeCanvasBinding(book.id);
		canvasMode = false;
	}

	function handleInsertToNote(text: string, cfiRange: string, color?: string) {
		outputNote(text, cfiRange, color);
	}

	async function handleExtractToCard(text: string, cfiRange: string) {
		try {
			const plugin = (app as any)?.plugins?.getPlugin?.('weave');
			if (!plugin?.openCreateCardModal) {
				new Notice('创建卡片功能暂不可用');
				return;
			}

			const excerptContent = buildNoteContent(text, cfiRange);
			const cardContent = `${excerptContent}\n---div---\n\n`;

			await plugin.openCreateCardModal({
				initialContent: cardContent
			});
			new Notice('摘录已填充到创建卡片窗口');
		} catch (error) {
			logger.error('[EpubReaderApp] Failed to extract selection to card:', error);
			new Notice('摘录失败，请重试');
		}
	}

	async function handleHighlightExtractToCard(info: HighlightClickInfo) {
		try {
			const plugin = (app as any)?.plugins?.getPlugin?.('weave');
			if (!plugin?.openCreateCardModal) {
				new Notice('鍒涘缓鍗＄墖鍔熻兘鏆備笉鍙敤');
				return;
			}

			const excerptContent = buildNoteContent(info.text, info.cfiRange, info.color);
			const cardContent = `${excerptContent}\n---div---\n\n`;

			await plugin.openCreateCardModal({
				initialContent: cardContent
			});
			highlightToolbarInfo = null;
			new Notice('鎽樺綍宸插～鍏呭埌鍒涘缓鍗＄墖绐楀彛');
		} catch (error) {
			logger.error('[EpubReaderApp] Failed to extract highlight to card:', error);
			new Notice('鎽樺綍澶辫触锛岃閲嶈瘯');
		}
	}

	function handleAutoInsertSelection(text: string, cfiRange: string, color?: string) {
		outputNote(text, cfiRange, color);
	}

	async function navigateToCfi(cfi: string, text: string) {
		await readerService.navigateAndHighlight({ cfi, text, flashStyle: 'highlight' });
	}

	async function handleScreenshotCapture(blob: Blob, rect: ScreenshotRect) {
		const currentCfi = readerService.getCurrentCFI();
		const chapterIndex = readerService.getCurrentChapterIndex();
		const chapterTitle = readerService.getCurrentChapterTitle();

		let canvasContent: string | null = null;

		if (autoInsert) {
			if (screenshotSaveAsImage) {
				const bookTitle = book?.metadata.title || 'epub';
				const imagePath = await screenshotService.saveAsJpeg(blob, bookTitle);
				const insertText = screenshotService.buildJpegInsert(imagePath, filePath, currentCfi, chapterIndex, chapterTitle);
				insertToEditor(insertText);
				canvasContent = insertText;
			} else {
				const extractedText = screenshotService.extractTextFromRect(viewportEl!, rect);
				const insertText = screenshotService.buildSnapshotEmbed(filePath, currentCfi, extractedText, chapterIndex, chapterTitle);
				insertToEditor(insertText);
				canvasContent = insertText;
			}
		} else {
			if (screenshotSaveAsImage) {
				const pngBlob = await convertToClipboardImage(blob);
				await copyImageToClipboard(pngBlob);
			} else {
				const extractedText = screenshotService.extractTextFromRect(viewportEl!, rect);
				const content = screenshotService.buildSnapshotEmbed(filePath, currentCfi, extractedText, chapterIndex, chapterTitle);
				await copyTextToClipboard(content);
				canvasContent = content;
			}
		}

		if (canvasMode && canvasService.isActive() && canvasContent) {
			canvasService.updateAnchorFromCanvasSelection(app);
			const node = await canvasService.addRawTextNode(canvasContent);
			if (node) {
				new Notice('截图已添加到 Canvas');
			}
		}
	}

	async function convertToClipboardImage(blob: Blob): Promise<Blob> {
		const img = new Image();
		const url = URL.createObjectURL(blob);
		return new Promise((resolve) => {
			img.onload = () => {
				const canvas = document.createElement('canvas');
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(url);
				canvas.toBlob((b) => resolve(b || blob), 'image/png');
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				resolve(blob);
			};
			img.src = url;
		});
	}

	async function markIRResumePoint() {
		try {
			const currentCfi = readerService.getCurrentCFI();
			if (!currentCfi) {
				new Notice('没有可用的阅读位置');
				return;
			}

			const epubTaskService = new IREpubBookmarkTaskService(app);
			await epubTaskService.initialize();
			const tasks = await epubTaskService.getTasksByEpub(filePath);

			if (tasks.length === 0) {
				new Notice('未找到此 EPUB 的 IR 任务');
				return;
			}

			const chapterHref = readerService.getCurrentChapterHref?.() || '';
			let matchedTask = tasks.find(t => {
				if (!chapterHref || !t.tocHref) return false;
				const normalizedTaskHref = t.tocHref.split('#')[0].split('?')[0];
				const normalizedChapterHref = chapterHref.split('#')[0].split('?')[0];
				return normalizedChapterHref.endsWith(normalizedTaskHref) || normalizedTaskHref.endsWith(normalizedChapterHref);
			});

			if (!matchedTask) {
				matchedTask = tasks[0];
			}

			await epubTaskService.setResumePoint(matchedTask.id, currentCfi);
			const chapterTitle = readerService.getCurrentChapterTitle() || matchedTask.title;
			new Notice(`续读点已保存：${chapterTitle}`);
		} catch (e) {
			logger.error('[EpubReaderApp] markIRResumePoint failed:', e);
			new Notice('保存续读点失败');
		}
	}

	function handleEpubNavigateEvent(e: Event) {
		const detail = (e as CustomEvent).detail;
		if (!detail || detail.filePath !== filePath) return;

		const nav: { cfi?: string; href?: string } = {};
		if (detail.cfi) nav.cfi = detail.cfi;
		else if (detail.href) nav.href = detail.href;
		else return;

		if (!renditionReady) {
			pendingIRNav = nav;
			return;
		}
		applyIRNav(nav);
	}

	async function applyIRNav(nav: { cfi?: string; href?: string }) {
		try {
			await readerService.navigateAndHighlight({
				cfi: nav.cfi,
				href: nav.href,
				flashStyle: 'pulse'
			});
		} catch (e) {
			logger.warn('[EpubReaderApp] IR navigation failed:', e);
		}
	}

	function setupHighlightClickHandler() {
		readerService.onHighlightClick((info: HighlightClickInfo) => {
			highlightToolbarInfo = info;
		});
	}

	async function handleHighlightDelete(info: HighlightClickInfo) {
		let deleted = false;

		// Delete from backlink source file
		if (info.sourceFile) {
			await backlinkService.deleteHighlight(info.sourceFile, info.cfiRange, filePath, info.sourceRef);
			deleted = true;
		}

		// Delete from annotation service
		if (book) {
			const highlights = await annotationService.getHighlights(book.id);
			const match = highlights.find(h => h.cfiRange === info.cfiRange);
			if (match) {
				await annotationService.deleteHighlight(book.id, match.id);
				deleted = true;
			}
		}

		if (deleted) {
			new Notice('高亮已删除');
			highlightToolbarInfo = null;
			reloadHighlights();
		} else {
			new Notice('删除高亮失败');
		}
	}

	async function handleHighlightChangeColor(info: HighlightClickInfo, newColor: string) {
		if (newColor === info.color) return;
		let changed = false;

		// Update in backlink source file
		if (info.sourceFile) {
			await backlinkService.changeHighlightColor(info.sourceFile, info.cfiRange, filePath, newColor, info.sourceRef);
			changed = true;
		}

		// Update in annotation service
		if (book) {
			const highlights = await annotationService.getHighlights(book.id);
			const match = highlights.find(h => h.cfiRange === info.cfiRange);
			if (match) {
				await annotationService.deleteHighlight(book.id, match.id);
				await annotationService.createHighlight(book.id, match.text, newColor as any, match.chapterIndex, match.cfiRange);
				changed = true;
			}
		}

		if (changed) {
			highlightToolbarInfo = null;
			reloadHighlights();
		} else {
			new Notice('更改颜色失败');
		}
	}

	async function handleHighlightBacklink(info: HighlightClickInfo) {
		let sourceFile: string | undefined = info.sourceFile || undefined;

		if (!sourceFile) {
			sourceFile = await backlinkService.findSourceFileForCfi(info.cfiRange, filePath) ?? undefined;
		}

		if (!sourceFile) {
			new Notice('未找到关联笔记');
			return;
		}

		if (info.sourceRef?.startsWith('card:')) {
			await openCardBacklink(info.sourceRef.slice(5));
			highlightToolbarInfo = null;
			return;
		}

		const encodedCfi = EpubLinkService.encodeCfiForWikilink(info.cfiRange);

		// Handle canvas files
		if (sourceFile.endsWith('.canvas')) {
			await navigateToCanvasNode(sourceFile, encodedCfi, info.cfiRange, info.sourceRef);
			highlightToolbarInfo = null;
			return;
		}

		// Handle markdown files
		await navigateToMarkdownCallout(sourceFile, encodedCfi, info.cfiRange);
		highlightToolbarInfo = null;
	}

	async function navigateToMarkdownCallout(sourceFile: string, encodedCfi: string, rawCfi: string) {
		const existingLeaf = app.workspace.getLeavesOfType('markdown').find(leaf => {
			const file = (leaf.view as any)?.file;
			return file && file.path === sourceFile;
		});

		if (existingLeaf) {
			app.workspace.setActiveLeaf(existingLeaf, { focus: true });
			scrollToCfiLine(existingLeaf.view as MarkdownView, encodedCfi, rawCfi);
		} else {
			await app.workspace.openLinkText(sourceFile, '', false, { active: true });
			setTimeout(() => {
				const activeView = app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView) {
					scrollToCfiLine(activeView, encodedCfi, rawCfi);
				}
			}, 300);
		}
	}

	function scrollToCfiLine(view: MarkdownView, encodedCfi: string, rawCfi: string) {
		if (!view.editor) return;
		const editor = view.editor;
		const content = editor.getValue();
		const lineIndex = content.split('\n').findIndex(
			(line: string) => line.includes(encodedCfi) || line.includes(rawCfi)
		);
		if (lineIndex >= 0) {
			editor.setCursor({ line: lineIndex, ch: 0 });
			editor.scrollIntoView(
				{ from: { line: Math.max(0, lineIndex - 2), ch: 0 }, to: { line: lineIndex + 4, ch: 0 } },
				true
			);
		}
	}

	async function navigateToCanvasNode(canvasPath: string, encodedCfi: string, rawCfi: string, nodeId?: string) {
		// Find existing canvas leaf or open a new one
		let canvasLeaf = app.workspace.getLeavesOfType('canvas').find(leaf => {
			return (leaf.view as any)?.file?.path === canvasPath;
		});

		if (!canvasLeaf) {
			const file = app.vault.getAbstractFileByPath(canvasPath);
			if (!file) {
				new Notice('Canvas 文件未找到');
				return;
			}
			canvasLeaf = app.workspace.getLeaf('tab');
			await canvasLeaf.openFile(file as any);
		}

		app.workspace.setActiveLeaf(canvasLeaf, { focus: true });

		// Find and select the target node
		setTimeout(() => {
			try {
				const canvasView = canvasLeaf!.view as any;
				const canvas = canvasView?.canvas;
				if (!canvas) return;

				const nodes = canvas.nodes;
				if (!nodes) return;

				for (const [, node] of nodes) {
					if (nodeId && node?.id !== nodeId) continue;
					const text = node?.text || node?.unknownData?.text || '';
					if (text.includes(encodedCfi) || text.includes(rawCfi)) {
						canvas.selectOnly(node);
						canvas.zoomToSelection();
						return;
					}
				}
			} catch (e) {
				logger.warn('[EpubReaderApp] Failed to select canvas node:', e);
			}
		}, 500);
	}

	async function openCardBacklink(cardUuid: string) {
		try {
			const plugin = (app as any)?.plugins?.getPlugin?.('weave');
			if (!plugin) {
				new Notice('未找到 Weave 插件实例');
				return;
			}

			const card =
				await plugin.dataStorage?.getCardByUUID?.(cardUuid)
				|| await plugin.directFileReader?.getCardByUUID?.(cardUuid);

			if (card && typeof plugin.openViewCardModal === 'function') {
				await plugin.openViewCardModal(card);
				return;
			}

			window.dispatchEvent(new CustomEvent('Weave:filter-by-cards', {
				detail: {
					cardIds: [cardUuid],
					filterName: 'EPUB 摘录来源卡片'
				}
			}));
			new Notice('已在卡片管理中定位该摘录卡片');
		} catch (error) {
			logger.error('[EpubReaderApp] Failed to open card backlink:', error);
			new Notice('打开摘录来源卡片失败');
		}
	}

	async function handleHighlightCopyText(info: HighlightClickInfo) {
		const plainText = info.text.replace(/^>\s?/gm, '').trim();
		await copyTextToClipboard(plainText);
		highlightToolbarInfo = null;
	}

	async function reloadHighlights() {
		if (!book) return;
		try {
			const allHighlights = await annotationService.collectAllHighlights(book.id, filePath, backlinkService);
			await readerService.applyHighlights(allHighlights);
		} catch (_e) {
			logger.warn('[EpubReaderApp] Failed to reload highlights:', _e);
		}
	}

	onMount(() => {
		void (async () => {
			try {
				const [savedExcerptSettings, savedReaderSettings] = await Promise.all([
					storageService.loadExcerptSettings(),
					storageService.loadReaderSettings()
				]);
				excerptSettings = savedExcerptSettings;
				settings = savedReaderSettings;
				onReaderSettingsLoaded?.(savedReaderSettings);
			} catch (error) {
				logger.warn('[EpubReaderApp] Failed to load reader settings:', error);
			}
			await loadBook();
		})();

		// Check global pending IR navigation (set by sidebar before this component mounts)
		const pending = (window as any).__weaveEpubPendingNav;
		if (pending && pending.filePath === filePath) {
			const nav: { cfi?: string; href?: string } = {};
			if (pending.cfi) nav.cfi = pending.cfi;
			else if (pending.href) nav.href = pending.href;
			if (nav.cfi || nav.href) {
				pendingIRNav = nav;
			}
			delete (window as any).__weaveEpubPendingNav;
		}

		setupHighlightClickHandler();
		epubActiveDocumentStore.setActiveDocument(filePath);
		epubActiveDocumentStore.setSharedState({
			filePath,
			readerService,
			annotationService,
			backlinkService,
			book: null,
			progress: readingProgress,
			onSettingsClick: showSettingsMenu,
			onSwitchBook
		});

		if (rootEl) {
			rootEl.addEventListener('keydown', handleKeydown);
			rootEl.setAttribute('tabindex', '0');
		}

		window.addEventListener('Weave:epub-navigate', handleEpubNavigateEvent);

		onActionsReady?.({
			setAutoInsert: (enabled: boolean) => { autoInsert = enabled; },
			setScreenshotMode: (active: boolean) => { screenshotMode = active; },
			setWidthMode: handleWidthModeChange,
			setLayoutMode: handleLayoutModeChange,
			setScreenshotSaveMode: (saveAsImage: boolean) => { screenshotSaveAsImage = saveAsImage; },
			navigateToCfi,
			toggleTutorial,
			addBookmark,
			bindCanvasPath: (canvasPath: string) => { bindCanvas(canvasPath); },
			unbindCanvas: () => { unbindCanvas(); },
			getCanvasService: () => canvasService,
			markIRResumePoint
		});
		return () => {
			if (rootEl) {
				rootEl.removeEventListener('keydown', handleKeydown);
			}
			window.removeEventListener('Weave:epub-navigate', handleEpubNavigateEvent);
			storageService.flushPendingProgress();
			readerService.destroy();
			epubActiveDocumentStore.clearActiveDocument(filePath);
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="epub-reader-root" data-theme={settings.theme} bind:this={rootEl}>
	{#if loading}
		<div class="epub-loading">
			<div class="epub-loading-spinner"></div>
			<span>加载中...</span>
		</div>
	{:else if errorMsg}
		<div class="epub-error">
			<span>{errorMsg}</span>
		</div>
	{:else}
		<div class="epub-reader-viewport" bind:this={viewportEl}>
			<div class="epub-content-wrapper">
				<EpubReaderView
					{app}
					{filePath}
					{book}
					{readerService}
					{storageService}
					{annotationService}
					{backlinkService}
					{settings}
								onProgressChange={(p) => { readingProgress = p; epubActiveDocumentStore.setSharedState({ progress: p }); }}
					onRenditionReady={() => {
						renditionVersion++;
						renditionReady = true;
						if (pendingIRNav) {
							const nav = pendingIRNav;
							pendingIRNav = null;
							applyIRNav(nav);
						}
					}}
				/>
			</div>

			<BottomNav
				onPrev={handlePrevPage}
				onNext={handleNextPage}
			/>

			<EpubHighlightToolbar
				info={highlightToolbarInfo}
				onDelete={handleHighlightDelete}
				onChangeColor={handleHighlightChangeColor}
				onBacklink={handleHighlightBacklink}
				onExtractToCard={handleHighlightExtractToCard}
				onCopyText={handleHighlightCopyText}
				onDismiss={() => highlightToolbarInfo = null}
			/>

			<SelectionToolbar
				{app}
				{readerService}
				{annotationService}
				{book}
				{renditionVersion}
				{autoInsert}
				{canvasMode}
				onInsertToNote={handleInsertToNote}
				onExtractToCard={handleExtractToCard}
				onAutoInsert={handleAutoInsertSelection}
			/>

			<EpubTutorial
				visible={tutorialVisible}
				onClose={() => tutorialVisible = false}
			/>

			<ScreenshotOverlay
				active={screenshotMode}
				sourceEl={viewportEl}
				{screenshotService}
				onCapture={handleScreenshotCapture}
				onCancel={() => screenshotMode = false}
			/>


		</div>
	{/if}
</div>
