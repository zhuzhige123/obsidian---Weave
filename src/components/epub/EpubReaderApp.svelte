<script lang="ts">
	import type { App, WorkspaceLeaf } from 'obsidian';
	import { setIcon, MarkdownView, Notice } from 'obsidian';
	import { onMount } from 'svelte';
	import EpubReaderView from './EpubReaderView.svelte';
	import EpubSidebar from './EpubSidebar.svelte';
	import BottomNav from './BottomNav.svelte';
	import SelectionToolbar from './SelectionToolbar.svelte';
	import ScreenshotOverlay from './ScreenshotOverlay.svelte';
	import EpubTutorial from './EpubTutorial.svelte';
	import { EpubReaderService, EpubStorageService, EpubAnnotationService, EpubLinkService } from '../../services/epub';
	import { EpubScreenshotService } from '../../services/epub/EpubScreenshotService';
	import { EpubCanvasService } from '../../services/epub/EpubCanvasService';
	import type { ScreenshotRect } from '../../services/epub/EpubScreenshotService';
	import type { EpubBook, EpubReaderSettings, EpubTheme, EpubFontFamily, EpubWidthMode, EpubLayoutMode } from '../../services/epub';
	import { epubActiveDocumentStore } from '../../stores/epub-active-document-store';
	import '../../styles/epub/epub-reader.css';

	interface Props {
		app: App;
		filePath: string;
		pendingCfi?: string;
		pendingText?: string;
		autoInsertEnabled?: boolean;
		getLastActiveMarkdownLeaf?: () => WorkspaceLeaf | null;
		onTitleChange?: (title: string) => void;
		onActionsReady?: (actions: {
			toggleSidebar: () => void;
			toggleSettings: () => void;
			setAutoInsert: (enabled: boolean) => void;
			setScreenshotMode: (active: boolean) => void;
			setWidthMode: (mode: EpubWidthMode) => void;
			setLayoutMode: (mode: EpubLayoutMode) => void;
			setScreenshotSaveMode: (saveAsImage: boolean) => void;
			navigateToCfi: (cfi: string, text: string) => void;
			toggleTutorial: () => void;
			bindCanvasPath: (canvasPath: string) => void;
			unbindCanvas: () => void;
			getCanvasService: () => EpubCanvasService;
		}) => void;
		onSwitchBook?: (filePath: string) => void;
		onCanvasStateChange?: (active: boolean, canvasPath: string | null) => void;
	}

	let { app, filePath, pendingCfi = '', pendingText = '', autoInsertEnabled: initialAutoInsert = false, getLastActiveMarkdownLeaf, onTitleChange, onActionsReady, onSwitchBook, onCanvasStateChange }: Props = $props();

	let readerService = new EpubReaderService(app);
	let storageService = new EpubStorageService(app);
	let annotationService = new EpubAnnotationService(storageService);
	let linkService = new EpubLinkService(app);
	let screenshotService = new EpubScreenshotService(app);
	let canvasService = new EpubCanvasService(app);

	let book = $state<EpubBook | null>(null);
	let sidebarVisible = $state(false);
	let settingsVisible = $state(false);
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
		fontSize: 18,
		lineHeight: 1.618,
		theme: 'default',
		fontFamily: 'serif',
		widthMode: 'standard',
		layoutMode: 'scroll'
	});

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
			await initCanvasBinding();
		} catch (error) {
			console.error('Failed to load EPUB:', error);
			errorMsg = `${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			loading = false;
		}
	}

	function toggleSidebar() {
		sidebarVisible = !sidebarVisible;
	}

	function closeSidebar() {
		sidebarVisible = false;
	}

	function toggleSettings() {
		settingsVisible = !settingsVisible;
	}

	function toggleTutorial() {
		tutorialVisible = !tutorialVisible;
	}

	function handleThemeChange(theme: EpubTheme) {
		settings = { ...settings, theme };
	}

	function handleFontSizeChange(delta: number) {
		const newSize = settings.fontSize + delta;
		if (newSize >= 12 && newSize <= 32) {
			settings = { ...settings, fontSize: newSize };
		}
	}

	function handleFontFamilyChange(family: EpubFontFamily) {
		settings = { ...settings, fontFamily: family };
	}

	function handleWidthModeChange(mode: EpubWidthMode) {
		settings = { ...settings, widthMode: mode };
	}

	function handleLayoutModeChange(mode: EpubLayoutMode) {
		settings = { ...settings, layoutMode: mode };
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
		return linkService.buildQuoteBlock(filePath, cfiRange, text, chapterIndex, color, chapterTitle);
	}

	function insertToEditor(content: string) {
		const leaf = getLastActiveMarkdownLeaf?.();
		if (!leaf) {
			new Notice('No active markdown editor found');
			return;
		}
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || !view.editor) {
			new Notice('No active markdown editor found');
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
			new Notice('Copied to clipboard');
		} catch (_e) {
			new Notice('Failed to copy');
		}
	}

	async function copyImageToClipboard(blob: Blob) {
		try {
			await navigator.clipboard.write([
				new ClipboardItem({ [blob.type]: blob })
			]);
			new Notice('Image copied to clipboard');
		} catch (_e) {
			new Notice('Failed to copy image');
		}
	}

	function outputNote(text: string, cfiRange: string, color?: string) {
		if (canvasMode && canvasService.isActive()) {
			addToCanvas(text, cfiRange, color);
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

		const node = await canvasService.addExcerptNode(
			text, cfiRange, filePath, chapterIndex, chapterTitle, color
		);
		if (node) {
			new Notice('Added to canvas');
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

	function handleAutoInsertSelection(text: string, cfiRange: string, color?: string) {
		outputNote(text, cfiRange, color);
	}

	async function navigateToCfi(cfi: string, text: string) {
		await readerService.highlightAtCfi(cfi, text);
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
				new Notice('Screenshot added to canvas');
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

	onMount(() => {
		loadBook();
		epubActiveDocumentStore.setActiveDocument(filePath);

		if (rootEl) {
			rootEl.addEventListener('keydown', handleKeydown);
			rootEl.setAttribute('tabindex', '0');
		}
		onActionsReady?.({
			toggleSidebar,
			toggleSettings,
			setAutoInsert: (enabled: boolean) => { autoInsert = enabled; },
			setScreenshotMode: (active: boolean) => { screenshotMode = active; },
			setWidthMode: handleWidthModeChange,
			setLayoutMode: handleLayoutModeChange,
			setScreenshotSaveMode: (saveAsImage: boolean) => { screenshotSaveAsImage = saveAsImage; },
			navigateToCfi,
			toggleTutorial,
			bindCanvasPath: (canvasPath: string) => { bindCanvas(canvasPath); },
			unbindCanvas: () => { unbindCanvas(); },
			getCanvasService: () => canvasService
		});
		return () => {
			if (rootEl) {
				rootEl.removeEventListener('keydown', handleKeydown);
			}
			readerService.destroy();
			epubActiveDocumentStore.clearActiveDocument();
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="epub-reader-root" data-theme={settings.theme} bind:this={rootEl}>
	{#if loading}
		<div class="epub-loading">
			<div class="epub-loading-spinner"></div>
			<span>Loading...</span>
		</div>
	{:else if errorMsg}
		<div class="epub-error">
			<span>{errorMsg}</span>
		</div>
	{:else}
		{#if sidebarVisible}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="epub-sidebar-overlay" onclick={closeSidebar}></div>
		{/if}

		<EpubSidebar
			{app}
			{book}
			{readerService}
			{annotationService}
			visible={sidebarVisible}
			progress={readingProgress}
			onClose={closeSidebar}
			{onSwitchBook}
		/>

		<div class="epub-reader-viewport" bind:this={viewportEl}>
			<div class="epub-content-wrapper">
				<EpubReaderView
					{app}
					{filePath}
					{book}
					{readerService}
					{storageService}
					{annotationService}
					{settings}
					onProgressChange={(p) => readingProgress = p}
					onRenditionReady={() => renditionVersion++}
				/>
			</div>

			{#if settings.layoutMode === 'paginated' || settings.layoutMode === 'double'}
				<BottomNav
					onPrev={handlePrevPage}
					onNext={handleNextPage}
				/>
			{/if}

				<SelectionToolbar
				{app}
				{readerService}
				{annotationService}
				{book}
				{renditionVersion}
				{autoInsert}
				{canvasMode}
				onInsertToNote={handleInsertToNote}
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

			<!-- Settings Popover (triggered from Obsidian header action) -->
			{#if settingsVisible}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="epub-settings-overlay" onclick={toggleSettings}></div>
				<div class="epub-settings-float epub-glass-panel">
					<div class="epub-settings-row">
						<span class="label">Eye care</span>
						<button
							class="epub-sepia-toggle"
							class:active={settings.theme === 'sepia'}
							onclick={() => handleThemeChange(settings.theme === 'sepia' ? 'default' : 'sepia')}
							title="Toggle sepia mode"
						>
							<span use:icon={'sun'}></span>
						</button>
					</div>
					<div class="epub-settings-row">
						<span class="label">Font size</span>
						<div class="epub-stepper">
							<button class="epub-stepper-btn" onclick={() => handleFontSizeChange(-1)} aria-label="Decrease font size">
								<span use:icon={'minus'}></span>
							</button>
							<span class="epub-stepper-val">{settings.fontSize}</span>
							<button class="epub-stepper-btn" onclick={() => handleFontSizeChange(1)} aria-label="Increase font size">
								<span use:icon={'plus'}></span>
							</button>
						</div>
					</div>
					<div class="epub-settings-row">
						<span class="label">Font</span>
						<select
							class="epub-font-select"
							value={settings.fontFamily}
							onchange={(e: Event) => handleFontFamilyChange((e.target as HTMLSelectElement).value as EpubFontFamily)}
						>
							<option value="serif">Serif</option>
							<option value="sans">Sans</option>
						</select>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
