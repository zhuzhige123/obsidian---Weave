<script lang="ts">
	import { setIcon, Notice } from 'obsidian';
	import type { App } from 'obsidian';
	import { onMount } from 'svelte';
	import { logger } from '../../utils/logger';
	import type { EpubReaderService, EpubAnnotationService, EpubBook } from '../../services/epub';
	import type { HighlightColor } from '../../services/epub';

	interface Props {
		app: App;
		readerService: EpubReaderService;
		annotationService: EpubAnnotationService;
		book: EpubBook | null;
		renditionVersion?: number;
		autoInsert?: boolean;
		canvasMode?: boolean;
		onInsertToNote?: (text: string, cfiRange: string, color?: string) => void;
		onAutoInsert?: (text: string, cfiRange: string, color?: string) => void;
		onExtractToCard?: (text: string, cfiRange: string) => void;
	}

	let { app, readerService, annotationService, book, renditionVersion = 0, autoInsert = false, canvasMode = false, onInsertToNote, onAutoInsert, onExtractToCard }: Props = $props();

	let toolbarEl: HTMLDivElement;
	let isVisible = $state(false);
	let posTop = $state(0);
	let posLeft = $state(0);
	let selectedText = $state('');
	let currentCfiRange = $state('');
	let iframeDoc: Document | null = null;

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	async function handleHighlight(color: string) {
		if (!book || !selectedText || !currentCfiRange) {
			clearAndHide();
			return;
		}

		try {
			const chapterIndex = readerService.getCurrentChapterIndex();
			await annotationService.createHighlight(
				book.id,
				selectedText,
				color as HighlightColor,
				chapterIndex,
				currentCfiRange
			);

			readerService.addHighlight({ cfiRange: currentCfiRange, color });
		} catch (e) {
			logger.warn('[SelectionToolbar] Failed to save highlight:', e);
		}

		onAutoInsert?.(selectedText, currentCfiRange, color);
		clearAndHide();
	}

	function handleAction(action: string) {
		new Notice(`${action}: \u5c1a\u672a\u5b9e\u73b0`);
		clearAndHide();
	}

	function handleInsertToNote() {
		if (selectedText && currentCfiRange) {
			onInsertToNote?.(selectedText, currentCfiRange);
		}
		clearAndHide();
	}

	function handleExtractToCard() {
		if (selectedText && currentCfiRange) {
			onExtractToCard?.(selectedText, currentCfiRange);
		}
		clearAndHide();
	}

	function handleSearch() {
		if (!selectedText) return;
		const searchPlugin = (app as any).internalPlugins?.getPluginById?.('global-search');
		if (searchPlugin?.instance) {
			searchPlugin.instance.openGlobalSearch(selectedText);
		}
		clearAndHide();
	}

	function clearAndHide() {
		if (iframeDoc) {
			iframeDoc.getSelection()?.removeAllRanges();
		}
		isVisible = false;
		selectedText = '';
		currentCfiRange = '';
	}

	function showToolbar(rect: DOMRect, containerEl: HTMLElement) {
		const containerRect = containerEl.getBoundingClientRect();
		const toolbarWidth = 280;
		const toolbarHeight = 68;

		let top = rect.top - containerRect.top - toolbarHeight - 10;
		let left = rect.left - containerRect.left + (rect.width / 2);

		if (top < 10) top = rect.bottom - containerRect.top + 10;
		if (left < toolbarWidth / 2) left = toolbarWidth / 2 + 10;
		const maxLeft = containerRect.width - toolbarWidth / 2 - 10;
		if (left > maxLeft) left = maxLeft;

		posTop = top;
		posLeft = left;
		isVisible = true;
	}

	function setupIframeListeners() {
		const rendition = readerService.getRendition();
		if (!rendition) return;

		rendition.on('selected', (cfiRange: string, contents: any) => {
			try {
				const iframeWindow = contents?.window || contents?.document?.defaultView;
				if (!iframeWindow) return;

				iframeDoc = iframeWindow.document;
				const selection = iframeWindow.getSelection();
				if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
					isVisible = false;
					return;
				}

				selectedText = selection.toString().trim();
				currentCfiRange = cfiRange;
				if (!selectedText) {
					isVisible = false;
					return;
				}

				const range = selection.getRangeAt(0);
				const rangeRect = range.getBoundingClientRect();

				const iframe = contents?.document?.defaultView?.frameElement as HTMLIFrameElement;
				if (!iframe) return;

				const iframeRect = iframe.getBoundingClientRect();
				const viewportEl = iframe.closest('.epub-reader-viewport') as HTMLElement;
				if (!viewportEl) return;

				const adjustedRect = new DOMRect(
					rangeRect.left + iframeRect.left,
					rangeRect.top + iframeRect.top,
					rangeRect.width,
					rangeRect.height
				);

				showToolbar(adjustedRect, viewportEl);
			} catch (e) {
				logger.warn('[SelectionToolbar] Failed to show:', e);
			}
		});

		rendition.on('markClicked', () => {
			isVisible = false;
		});
	}

	function handleClickOutside(e: Event) {
		if (isVisible && toolbarEl && !toolbarEl.contains(e.target as Node)) {
			isVisible = false;
		}
	}

	$effect(() => {
		const _v = renditionVersion;
		const rendition = readerService.getRendition();
		if (rendition) {
			setupIframeListeners();
		}
	});

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('touchstart', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('touchstart', handleClickOutside);
		};
	});
</script>

<div
	class="epub-selection-toolbar epub-glass-panel"
	class:visible={isVisible}
	style="top: {posTop}px; left: {posLeft}px;"
	bind:this={toolbarEl}
>
	<div class="toolbar-row colors-row">
		<button class="color-btn yellow" onclick={() => handleHighlight('yellow')} aria-label="黄色高亮"></button>
		<button class="color-btn green" onclick={() => handleHighlight('green')} aria-label="绿色高亮"></button>
		<button class="color-btn blue" onclick={() => handleHighlight('blue')} aria-label="蓝色高亮"></button>
		<button class="color-btn pink" onclick={() => handleHighlight('pink')} aria-label="粉色高亮"></button>
	</div>

	<div class="toolbar-row actions-row">
		<button class="action-item" onclick={handleInsertToNote}>
			<span class="action-icon" use:icon={autoInsert ? 'clipboard-paste' : 'clipboard-copy'}></span>
			<span class="action-label">{autoInsert ? '插入' : '复制'}</span>
		</button>
		<button class="action-item" onclick={handleSearch}>
			<span class="action-icon" use:icon={'search'}></span>
			<span class="action-label">搜索</span>
		</button>

		<div class="row-divider"></div>

		<button class="action-item accent" onclick={() => handleAction('cloze')}>
			<span class="action-icon" use:icon={'brackets'}></span>
			<span class="action-label">Cloze</span>
		</button>
		<button class="action-item accent" onclick={handleExtractToCard}>
			<span class="action-icon" use:icon={'scissors'}></span>
			<span class="action-label">摘录</span>
		</button>
		<button class="action-item ai" onclick={() => handleAction('ai-explain')}>
			<span class="action-icon" use:icon={'sparkles'}></span>
			<span class="action-label">AI</span>
		</button>
	</div>

	<div class="toolbar-arrow"></div>
</div>
