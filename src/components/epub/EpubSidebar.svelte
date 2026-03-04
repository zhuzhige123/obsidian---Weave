<script lang="ts">
	import { setIcon } from 'obsidian';
	import type { App } from 'obsidian';
	import type { EpubReaderService, EpubAnnotationService, EpubBook, TocItem } from '../../services/epub';
	import TableOfContents from './TableOfContents.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import BookshelfView from './BookshelfView.svelte';

	interface Props {
		app: App;
		book: EpubBook | null;
		readerService: EpubReaderService;
		annotationService: EpubAnnotationService;
		visible: boolean;
		progress: number;
		onClose: () => void;
		onSwitchBook?: (filePath: string) => void;
	}

	let { app, book, readerService, annotationService, visible, progress, onClose, onSwitchBook }: Props = $props();

	let activeTab = $state<'toc' | 'highlights' | 'bookmarks'>('toc');
	let sidebarView = $state<'details' | 'bookshelf'>('details');
	let tocItems = $state<TocItem[]>([]);

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	function switchTab(tab: 'toc' | 'highlights' | 'bookmarks') {
		activeTab = tab;
	}

	function toggleBookshelfView() {
		sidebarView = sidebarView === 'details' ? 'bookshelf' : 'details';
	}

	async function loadToc() {
		if (!book) return;
		try {
			tocItems = await readerService.getTableOfContents();
		} catch (error) {
			console.error('Failed to load TOC:', error);
		}
	}

	async function handleTocNavigate(href: string) {
		try {
			await readerService.goToHref(href);
			onClose();
		} catch (error) {
			console.error('Failed to navigate:', error);
		}
	}

	async function handleHighlightNavigate(cfi: string) {
		try {
			await readerService.goToLocation(cfi);
			onClose();
		} catch (error) {
			console.error('Failed to navigate to highlight:', error);
		}
	}

	$effect(() => {
		if (book) {
			loadToc();
		}
	});
</script>

<aside class="epub-sidebar" class:visible>
	<!-- Book Details View -->
	<div class="epub-sidebar-view" class:active={sidebarView === 'details'}>
		<!-- Design-G Frosted Header -->
		<div class="epub-book-header">
			<button class="epub-close-btn-abs" onclick={onClose} title="Close">
				<span use:icon={'x'}></span>
			</button>

			{#if book?.metadata.coverImage}
				<div class="bg-blur" style="background-image: url('{book.metadata.coverImage}')"></div>
			{/if}

			<div class="header-content">
				<div class="header-flex">
					{#if book?.metadata.coverImage}
						<img src={book.metadata.coverImage} alt="Cover" class="book-cover" />
					{:else}
						<div class="book-cover-placeholder">
							<span use:icon={'book-open'}></span>
						</div>
					{/if}

					<div class="info-flex">
						<div class="book-title">{book?.metadata.title || ''}</div>
						<div class="book-author">
							<span use:icon={'user'}></span>
							{book?.metadata.author || ''}
						</div>
						{#if book?.metadata.publisher}
							<div class="book-publisher">{book.metadata.publisher}</div>
						{/if}
					</div>
				</div>

				<div class="data-strip">
					<div class="data-col">
						<span class="data-label">Progress</span>
						<span class="data-val accent">{progress}%</span>
					</div>
					<div class="data-col" style="align-items: center">
						<span class="data-label">Chapters</span>
						<span class="data-val">{book?.metadata.chapterCount || 0}</span>
					</div>
					<div class="data-col" style="align-items: flex-end">
						<span class="data-label">Status</span>
						<span class="data-val">{progress >= 100 ? 'Done' : 'Reading'}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="epub-sidebar-tabs">
			<button
				class="epub-sidebar-tab"
				class:active={activeTab === 'toc'}
				onclick={() => switchTab('toc')}
			>TOC</button>
			<button
				class="epub-sidebar-tab"
				class:active={activeTab === 'highlights'}
				onclick={() => switchTab('highlights')}
			>Highlights</button>
			<button
				class="epub-sidebar-tab"
				class:active={activeTab === 'bookmarks'}
				onclick={() => switchTab('bookmarks')}
			>Bookmarks</button>
		</div>

		<!-- Content -->
		<div class="epub-sidebar-content">
			{#if activeTab === 'toc'}
				<TableOfContents items={tocItems} onNavigate={handleTocNavigate} />
			{:else if activeTab === 'highlights'}
				<NotesPanel {book} {annotationService} onNavigate={handleHighlightNavigate} />
			{:else if activeTab === 'bookmarks'}
				<div class="epub-placeholder">No bookmarks yet. Add bookmarks while reading.</div>
			{/if}
		</div>
	</div>

	<!-- Bookshelf View -->
	<div class="epub-sidebar-view" class:active={sidebarView === 'bookshelf'}>
		<BookshelfView {app} {onSwitchBook} onClose={() => sidebarView = 'details'} />
	</div>

	<!-- Footer -->
	<div class="epub-sidebar-footer">
		<button
			class="footer-btn"
			onclick={toggleBookshelfView}
			title={sidebarView === 'details' ? 'Bookshelf' : 'Back'}
		>
			<span use:icon={sidebarView === 'details' ? 'library' : 'book-open'}></span>
		</button>
		<div class="spacer"></div>
		<button class="footer-btn" title="Settings">
			<span use:icon={'settings'}></span>
		</button>
	</div>
</aside>
