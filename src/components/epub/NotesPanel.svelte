<script lang="ts">
	import { setIcon } from 'obsidian';
	import { logger } from '../../utils/logger';
	import type { EpubBook, Highlight, Note } from '../../services/epub';
	import type { EpubAnnotationService } from '../../services/epub';
	import type { EpubBacklinkHighlightService } from '../../services/epub/EpubBacklinkHighlightService';
	import { EpubLinkService } from '../../services/epub';

	interface Props {
		book: EpubBook | null;
		annotationService: EpubAnnotationService;
		backlinkService?: EpubBacklinkHighlightService;
		filePath?: string;
		onNavigate?: (cfi: string, text?: string, color?: string) => void;
	}

	let { book, annotationService, backlinkService, filePath, onNavigate }: Props = $props();

	interface DisplayHighlight {
		cfiRange: string;
		text: string;
		color: string;
		createdTime: number;
		sourceFile?: string;
	}

	let highlights = $state<DisplayHighlight[]>([]);
	let notes = $state<Note[]>([]);

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	function getHighlightClass(color: string): string {
		return `hl-${color}`;
	}

	function formatTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return '刚刚';
		if (minutes < 60) return `${minutes}分钟前`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}小时前`;
		const days = Math.floor(hours / 24);
		return `${days}天前`;
	}

	function navigateToHighlight(hl: DisplayHighlight) {
		if (hl.cfiRange) {
			onNavigate?.(hl.cfiRange, hl.text, hl.color);
		}
	}

	function navigateToNote(note: Note) {
		if (note.cfi) {
			onNavigate?.(note.cfi, note.quotedText || note.content);
		}
	}

	function handleCardKeydown(event: KeyboardEvent, navigate: () => void) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			navigate();
		}
	}

	async function loadAnnotations() {
		if (!book) return;
		try {
			const storedHighlights = await annotationService.getHighlights(book.id);
			const displayHighlights: DisplayHighlight[] = storedHighlights.map(h => ({
				cfiRange: h.cfiRange,
				text: h.text,
				color: h.color,
				createdTime: h.createdTime
			}));

			if (backlinkService && filePath) {
				try {
					const backlinkHls = await backlinkService.collectHighlights(filePath);
					for (const bh of backlinkHls) {
						const bhNorm = EpubLinkService.normalizeCfi(bh.cfiRange);
						const exists = displayHighlights.some(h => EpubLinkService.normalizeCfi(h.cfiRange) === bhNorm);
						if (!exists) {
							displayHighlights.push({
								cfiRange: bh.cfiRange,
								text: bh.text,
								color: bh.color,
								createdTime: 0,
								sourceFile: bh.sourceFile
							});
						}
					}
				} catch (e) {
					logger.debug('[NotesPanel] Failed to load backlink highlights:', e);
				}
			}

			highlights = displayHighlights;
			notes = await annotationService.getNotes(book.id);
		} catch (error) {
			logger.error('[NotesPanel] Failed to load annotations:', error);
		}
	}

	$effect(() => {
		if (book) {
			loadAnnotations();
		}
	});
</script>

<div class="epub-notes-panel">
	{#if highlights.length === 0 && notes.length === 0}
		<div class="epub-placeholder">暂无高亮或笔记。阅读时选中文本即可添加标注。</div>
	{:else}
		{#each highlights as hl}
			<div
				class="epub-note-card clickable"
				onclick={() => navigateToHighlight(hl)}
				onkeydown={(event) => handleCardKeydown(event, () => navigateToHighlight(hl))}
				role="button"
				tabindex="0"
			>
				<div class="note-icon">
					<span use:icon={hl.sourceFile ? 'file-text' : 'bookmark'}></span>
				</div>
				<div class="note-body">
					<div class="note-quote {getHighlightClass(hl.color)}">{hl.text}</div>
					{#if hl.sourceFile}
						<span class="note-source">{hl.sourceFile.split('/').pop()}</span>
					{:else if hl.createdTime}
						<span class="note-time">{formatTime(hl.createdTime)}</span>
					{/if}
				</div>
			</div>
		{/each}
		{#each notes as note}
			<div
				class="epub-note-card clickable"
				onclick={() => navigateToNote(note)}
				onkeydown={(event) => handleCardKeydown(event, () => navigateToNote(note))}
				role="button"
				tabindex="0"
			>
				<div class="note-icon">
					<span use:icon={'pencil'}></span>
				</div>
				<div class="note-body">
					{#if note.quotedText}
						<div class="note-quote">{note.quotedText}</div>
					{/if}
					<div class="note-comment">{note.content}</div>
					<span class="note-time">{formatTime(note.createdTime)}</span>
				</div>
			</div>
		{/each}
	{/if}
</div>
