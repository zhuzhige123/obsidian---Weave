<script lang="ts">
	import { setIcon } from 'obsidian';
	import type { EpubBook, Highlight, Note } from '../../services/epub';
	import type { EpubAnnotationService } from '../../services/epub';

	interface Props {
		book: EpubBook | null;
		annotationService: EpubAnnotationService;
		onNavigate?: (cfi: string) => void;
	}

	let { book, annotationService, onNavigate }: Props = $props();

	let highlights = $state<Highlight[]>([]);
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
		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	async function loadAnnotations() {
		if (!book) return;
		try {
			highlights = await annotationService.getHighlights(book.id);
			notes = await annotationService.getNotes(book.id);
		} catch (error) {
			console.error('Failed to load annotations:', error);
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
		<div class="epub-placeholder">No highlights or notes yet. Select text while reading to add annotations.</div>
	{:else}
		{#each highlights as hl}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="epub-note-card clickable" onclick={() => hl.cfiRange && onNavigate?.(hl.cfiRange)}>
				<div class="note-icon">
					<span use:icon={'bookmark'}></span>
				</div>
				<div class="note-body">
					<div class="note-quote {getHighlightClass(hl.color)}">{hl.text}</div>
					<span class="note-time">{formatTime(hl.createdTime)}</span>
				</div>
			</div>
		{/each}
		{#each notes as note}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="epub-note-card clickable" onclick={() => note.cfi && onNavigate?.(note.cfi)}>
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
