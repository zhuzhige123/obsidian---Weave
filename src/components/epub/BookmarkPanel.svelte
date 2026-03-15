<script lang="ts">
	import { setIcon } from 'obsidian';
	import type { EpubBook, Bookmark } from '../../services/epub';
	import type { EpubAnnotationService } from '../../services/epub';

	interface Props {
		book: EpubBook | null;
		annotationService: EpubAnnotationService;
		onNavigate: (cfi: string, text?: string, color?: string) => void;
	}

	let { book, annotationService, onNavigate }: Props = $props();

	let bookmarks = $state<Bookmark[]>([]);

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	async function loadBookmarks() {
		if (!book) {
			bookmarks = [];
			return;
		}
		try {
			bookmarks = await annotationService.getBookmarks(book.id);
			bookmarks.sort((a, b) => b.createdTime - a.createdTime);
		} catch (_e) {
			bookmarks = [];
		}
	}

	async function handleDelete(e: MouseEvent, bookmarkId: string) {
		e.stopPropagation();
		if (!book) return;
		await annotationService.deleteBookmark(book.id, bookmarkId);
		await loadBookmarks();
	}

	function formatTime(timestamp: number): string {
		const d = new Date(timestamp);
		const month = (d.getMonth() + 1).toString().padStart(2, '0');
		const day = d.getDate().toString().padStart(2, '0');
		const hours = d.getHours().toString().padStart(2, '0');
		const minutes = d.getMinutes().toString().padStart(2, '0');
		return `${month}-${day} ${hours}:${minutes}`;
	}

	$effect(() => {
		if (book) {
			loadBookmarks();
		}
	});
</script>

{#if bookmarks.length === 0}
	<div class="epub-placeholder">暂无书签。阅读时点击书签按钮即可添加。</div>
{:else}
	<div class="epub-bookmark-list">
		{#each bookmarks as bm}
			<div
				class="epub-bookmark-item"
				onclick={() => onNavigate(bm.cfi, bm.preview)}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onNavigate(bm.cfi, bm.preview);
					}
				}}
				role="button"
				tabindex="0"
			>
				<span class="bookmark-icon" use:icon={'bookmark'}></span>
				<div class="bookmark-body">
					<div class="bookmark-title">{bm.title}</div>
					{#if bm.preview}
						<div class="bookmark-preview">{bm.preview}</div>
					{/if}
					<div class="bookmark-time">{formatTime(bm.createdTime)}</div>
				</div>
				<button
					class="bookmark-delete"
					onclick={(e: MouseEvent) => handleDelete(e, bm.id)}
					title="删除书签"
				>
					<span use:icon={'trash-2'}></span>
				</button>
			</div>
		{/each}
	</div>
{/if}
