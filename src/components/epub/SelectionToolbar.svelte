<script lang="ts">
	import { setIcon } from 'obsidian';
	import type { App } from 'obsidian';
	import { onMount } from 'svelte';
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
	}

	let { app, readerService, annotationService, book, renditionVersion = 0, autoInsert = false, canvasMode = false, onInsertToNote, onAutoInsert }: Props = $props();

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

			await readerService.applyHighlights([{ cfiRange: currentCfiRange, color }]);
		} catch (e) {
			console.warn('Failed to save highlight:', e);
		}

		onAutoInsert?.(selectedText, currentCfiRange, color);
		clearAndHide();
	}

	function handleAction(action: string) {
		console.log('Action:', action, 'text:', selectedText);
		clearAndHide();
	}

	function handleInsertToNote() {
		if (selectedText && currentCfiRange) {
			onInsertToNote?.(selectedText, currentCfiRange);
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
		const toolbarHeight = 50;

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
				console.warn('SelectionToolbar: failed to show', e);
			}
		});

		rendition.on('markClicked', () => {
			isVisible = false;
		});
	}

	function handleClickOutside(e: MouseEvent) {
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
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});
</script>

<div
	class="epub-selection-toolbar epub-glass-panel"
	class:visible={isVisible}
	style="top: {posTop}px; left: {posLeft}px;"
	bind:this={toolbarEl}
>
	<div class="toolbar-group colors">
		<button class="color-btn yellow" onclick={() => handleHighlight('yellow')} title="Highlight"></button>
		<button class="color-btn green" onclick={() => handleHighlight('green')} title="Important"></button>
		<button class="color-btn blue" onclick={() => handleHighlight('blue')} title="Thought"></button>
		<button class="color-btn pink" onclick={() => handleHighlight('pink')} title="Question"></button>
	</div>

	<div class="divider"></div>

	<div class="toolbar-group actions">
		<button class="action-btn" onclick={() => handleAction('underline')} title="Underline">
			<span use:icon={'underline'}></span>
		</button>
		<button class="action-btn" onclick={() => handleAction('note')} title="Note">
			<span use:icon={'pencil'}></span>
		</button>
		<button class="action-btn" onclick={handleInsertToNote} title={autoInsert ? 'Insert to note' : 'Copy to clipboard'}>
			<span use:icon={autoInsert ? 'clipboard-paste' : 'clipboard-copy'}></span>
		</button>
		<button class="action-btn" onclick={handleSearch} title="Search in vault">
			<span use:icon={'search'}></span>
		</button>
	</div>

	<div class="divider"></div>

	<div class="toolbar-group weave">
		<button class="action-btn special" onclick={() => handleAction('cloze')} title="Cloze card">
			<span use:icon={'brackets'}></span>
		</button>
		<button class="action-btn special" onclick={() => handleAction('extract')} title="Extract card">
			<span use:icon={'scissors'}></span>
		</button>
		<button class="action-btn ai" onclick={() => handleAction('ai-explain')} title="AI Explain">
			<span use:icon={'sparkles'}></span>
		</button>
	</div>

	<div class="toolbar-arrow"></div>
</div>
