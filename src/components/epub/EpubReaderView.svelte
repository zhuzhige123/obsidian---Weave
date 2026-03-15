<script lang="ts">
	import { onMount } from 'svelte';
	import type { App } from 'obsidian';
	import type { EpubReaderService, EpubStorageService, EpubBook, EpubReaderSettings, EpubLayoutMode } from '../../services/epub';
	import type { EpubAnnotationService } from '../../services/epub';
	import type { EpubBacklinkHighlightService } from '../../services/epub/EpubBacklinkHighlightService';
	import { logger } from '../../utils/logger';

	interface Props {
		app: App;
		filePath: string;
		book: EpubBook | null;
		readerService: EpubReaderService;
		storageService: EpubStorageService;
		annotationService: EpubAnnotationService;
		backlinkService: EpubBacklinkHighlightService;
		settings: EpubReaderSettings;
		onProgressChange?: (percent: number) => void;
		onChapterChange?: (title: string) => void;
		onRenditionReady?: () => void;
	}

	let { app, filePath, book, readerService, storageService, annotationService, backlinkService, settings, onProgressChange, onChapterChange, onRenditionReady }: Props = $props();

	let viewerContainer: HTMLDivElement;
	let rendered = false;
	let resizeObserver: ResizeObserver | null = null;
	let currentLayoutMode: EpubLayoutMode = 'paginated';
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let highlightReapplyTimer: ReturnType<typeof setTimeout> | null = null;
	let highlightsReady = false;

	interface ContainerRect {
		width: number;
		height: number;
	}

	function readContainerRect(): ContainerRect {
		const rect = viewerContainer?.getBoundingClientRect();
		return {
			width: Math.round(rect?.width || 0),
			height: Math.round(rect?.height || 0)
		};
	}

	function waitForNextFrame(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	async function waitForStableContainer(maxFrames = 24): Promise<ContainerRect> {
		let previous = readContainerRect();
		let stableFrames = previous.width > 0 && previous.height > 0 ? 1 : 0;

		for (let i = 0; i < maxFrames; i++) {
			await waitForNextFrame();
			const current = readContainerRect();
			const isSameSize = current.width === previous.width && current.height === previous.height;
			const isRenderable = current.width > 0 && current.height > 0;

			if (isRenderable && isSameSize) {
				stableFrames += 1;
				if (stableFrames >= 2) {
					return current;
				}
			} else {
				stableFrames = isRenderable ? 1 : 0;
			}

			previous = current;
		}

		return previous.width > 0 && previous.height > 0
			? previous
			: { width: 800, height: 600 };
	}

	async function renderBook() {
		if (!book || !viewerContainer || rendered) return;
		rendered = true;

		try {
			// Start collecting highlights in parallel with rendering
			const highlightPromise = collectAllHighlights();
			const stableRect = await waitForStableContainer();

			const spread = settings.layoutMode === 'double' ? 'always' : 'none';
			await readerService.renderTo(viewerContainer, {
				spread,
				width: stableRect.width,
				height: stableRect.height
			});
			currentLayoutMode = settings.layoutMode;

			// Apply settings and resize observer FIRST, before restoring progress.
			// Theme/line-height changes and initial resize can cause re-layout
			// which would reset the reading position if applied after goToLocation.
			applySettings();
			setupResizeObserver();

			registerRelocatedHandler();

			// Let rendition settle after settings/resize before navigating
			await new Promise(r => setTimeout(r, 50));

			// Restore reading progress LAST so nothing can override the position
			const savedProgress = await storageService.loadProgress(book.id);
			if (savedProgress && savedProgress.cfi) {
				await readerService.goToLocation(savedProgress.cfi);
			}

			// Apply pre-collected highlights (already resolved or nearly so)
			const allHighlights = await highlightPromise;
			if (allHighlights.length > 0) {
				await readerService.applyHighlights(allHighlights);
			} else {
				// Retry after delay - metadata cache may still be building
				scheduleHighlightRetry();
			}
			highlightsReady = true;

			onRenditionReady?.();
		} catch (error) {
			logger.error('[EpubReaderView] Failed to render book:', error);
		}
	}

	function setupResizeObserver() {
		if (resizeObserver) resizeObserver.disconnect();
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) {
					readerService.resize(width, height);
					scheduleHighlightReapply();
				}
			}
		});
		resizeObserver.observe(viewerContainer);
	}

	async function applySettings() {
		if (!rendered) return;
		readerService.setLineHeight(settings.lineHeight);
		await readerService.setTheme(settings.theme);
	}

	async function collectAllHighlights(): Promise<Array<{ cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }>> {
		if (!book) return [];
		try {
			const allHighlights = await annotationService.collectAllHighlights(book.id, filePath, backlinkService);
			logger.debug('[EpubReaderView] total highlights to apply:', allHighlights.length);
			return allHighlights;
		} catch (e) {
			logger.warn('[EpubReaderView] Failed to collect highlights:', e);
			return [];
		}
	}

	function scheduleHighlightReapply(delayMs = 300) {
		if (!highlightsReady) return;
		if (highlightReapplyTimer) clearTimeout(highlightReapplyTimer);
		highlightReapplyTimer = setTimeout(async () => {
			highlightReapplyTimer = null;
			await loadSavedHighlights();
		}, delayMs);
	}

	function scheduleHighlightRetry() {
		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = setTimeout(async () => {
			retryTimer = null;
			const retried = await collectAllHighlights();
			if (retried.length > 0) {
				await readerService.applyHighlights(retried);
			}
		}, 3000);
	}

	async function loadSavedHighlights() {
		const allHighlights = await collectAllHighlights();
		if (allHighlights.length > 0) {
			await readerService.applyHighlights(allHighlights);
		}
	}

	function registerRelocatedHandler() {
		readerService.onRelocated(async (position) => {
			if (book) {
				await storageService.saveProgress(book.id, position);
			}
			onProgressChange?.(position.percent);
		});
	}

	async function handleLayoutModeChange() {
		if (!rendered || settings.layoutMode === currentLayoutMode) return;
		currentLayoutMode = settings.layoutMode;
		await readerService.setLayoutMode(settings.layoutMode);
		await applySettings();

		await new Promise(r => setTimeout(r, 150));

		registerRelocatedHandler();
		await loadSavedHighlights();
		onRenditionReady?.();
	}

	$effect(() => {
		if (book && viewerContainer && !rendered) {
			renderBook();
		}
	});

	$effect(() => {
		const _theme = settings.theme;
		const _lh = settings.lineHeight;
		if (rendered) {
			applySettings().then(() => {
				scheduleHighlightReapply(150);
			});
		}
	});

	$effect(() => {
		const _layout = settings.layoutMode;
		if (rendered && _layout !== currentLayoutMode) {
			handleLayoutModeChange();
		}
	});

	onMount(() => {
		return () => {
			if (retryTimer) clearTimeout(retryTimer);
			if (highlightReapplyTimer) clearTimeout(highlightReapplyTimer);
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	});
</script>

<div class="epub-reader-view" class:epub-width-full={settings.widthMode === 'full'}>
	<div class="epub-viewer-container" bind:this={viewerContainer}></div>
</div>
