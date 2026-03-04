<script lang="ts">
	import { onMount } from 'svelte';
	import type { App } from 'obsidian';
	import type { EpubReaderService, EpubStorageService, EpubBook, EpubReaderSettings, EpubLayoutMode } from '../../services/epub';
	import type { EpubAnnotationService } from '../../services/epub';
	import { EpubBacklinkHighlightService } from '../../services/epub/EpubBacklinkHighlightService';

	interface Props {
		app: App;
		filePath: string;
		book: EpubBook | null;
		readerService: EpubReaderService;
		storageService: EpubStorageService;
		annotationService: EpubAnnotationService;
		settings: EpubReaderSettings;
		onProgressChange?: (percent: number) => void;
		onChapterChange?: (title: string) => void;
		onRenditionReady?: () => void;
	}

	let { app, filePath, book, readerService, storageService, annotationService, settings, onProgressChange, onChapterChange, onRenditionReady }: Props = $props();

	let viewerContainer: HTMLDivElement;
	let rendered = false;
	let resizeObserver: ResizeObserver | null = null;
	let currentLayoutMode: EpubLayoutMode = 'scroll';

	async function renderBook() {
		if (!book || !viewerContainer || rendered) return;
		rendered = true;

		try {
			const flow = settings.layoutMode === 'scroll' ? 'scrolled-doc' : 'paginated';
			const spread = settings.layoutMode === 'double' ? 'always' : 'none';
			await readerService.renderTo(viewerContainer, { flow, spread });
			currentLayoutMode = settings.layoutMode;

			const savedProgress = await storageService.loadProgress(book.id);
			if (savedProgress && savedProgress.cfi) {
				await readerService.goToLocation(savedProgress.cfi);
			}

			readerService.onRelocated(async (position) => {
				if (book) {
					await storageService.saveProgress(book.id, position);
				}
				onProgressChange?.(position.percent);
			});

			applySettings();
			setupResizeObserver();
			await loadSavedHighlights();
			onRenditionReady?.();
		} catch (error) {
			console.error('Failed to render book:', error);
		}
	}

	function setupResizeObserver() {
		if (resizeObserver) resizeObserver.disconnect();
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) {
					readerService.resize(width, height);
				}
			}
		});
		resizeObserver.observe(viewerContainer);
	}

	function applySettings() {
		if (!rendered) return;
		readerService.setFontSize(settings.fontSize);
		readerService.setLineHeight(settings.lineHeight);
		readerService.setTheme(settings.theme);
		readerService.setFontFamily(settings.fontFamily);
	}

	async function loadSavedHighlights() {
		if (!book) return;
		try {
			const backlinkService = new EpubBacklinkHighlightService(app);
			const highlights = await backlinkService.collectHighlights(filePath);
			if (highlights.length > 0) {
				await readerService.applyHighlights(
					highlights.map(h => ({ cfiRange: h.cfiRange, color: h.color }))
				);
			}
		} catch (e) {
			console.warn('Failed to load highlights from backlinks:', e);
		}
	}

	async function handleLayoutModeChange() {
		if (!rendered || settings.layoutMode === currentLayoutMode) return;
		currentLayoutMode = settings.layoutMode;
		await readerService.setLayoutMode(settings.layoutMode);
		applySettings();

		readerService.onRelocated(async (position) => {
			if (book) {
				await storageService.saveProgress(book.id, position);
			}
			onProgressChange?.(position.percent);
		});
		await loadSavedHighlights();
		onRenditionReady?.();
	}

	$effect(() => {
		if (book && viewerContainer && !rendered) {
			renderBook();
		}
	});

	$effect(() => {
		if (rendered) {
			applySettings();
		}
	});

	$effect(() => {
		if (rendered && settings.layoutMode !== currentLayoutMode) {
			handleLayoutModeChange();
		}
	});

	onMount(() => {
		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	});
</script>

<div class="epub-reader-view">
	<div class="epub-viewer-container" bind:this={viewerContainer}></div>
</div>
