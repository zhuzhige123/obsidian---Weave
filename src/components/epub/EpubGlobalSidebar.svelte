<script lang="ts">
	import { onMount } from 'svelte';
	import { setIcon } from 'obsidian';
	import type { App } from 'obsidian';
	import { logger } from '../../utils/logger';
	import type { EpubBook, TocItem, Highlight, Note } from '../../services/epub';
	import { epubActiveDocumentStore } from '../../stores/epub-active-document-store';
	import type { EpubSharedState } from '../../stores/epub-active-document-store';
	import TableOfContents from './TableOfContents.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import BookmarkPanel from './BookmarkPanel.svelte';
	import BookshelfView from './BookshelfView.svelte';
	import { VIEW_TYPE_EPUB } from '../../views/EpubView';

	interface Props {
		app: App;
	}

	let { app }: Props = $props();

	let sharedState = $state<EpubSharedState | null>(null);
	let activeTab = $state<'toc' | 'highlights' | 'bookmarks'>('toc');
	let sidebarView = $state<'details' | 'bookshelf'>('details');
	let tocItems = $state<TocItem[]>([]);

	let searchQuery = $state('');
	let searchResults = $state<Array<{ cfi: string; excerpt: string; chapterTitle: string }>>([]);
	let searching = $state(false);
	let searched = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	let searchInputEl: HTMLInputElement | undefined = $state(undefined);
	let isSearchActive = $derived(searchQuery.trim().length > 0);
	let collapsedChapters = $state<Set<string>>(new Set());
	let lastSearchedQuery = $state('');
	let matchingHighlights = $state<Highlight[]>([]);
	let matchingNotes = $state<Note[]>([]);
	let hasAnyResults = $derived(
		activeTab === 'toc'
			? searchResults.length > 0
			: activeTab === 'highlights'
				? matchingHighlights.length > 0 || matchingNotes.length > 0
				: false
	);
	let resultCount = $derived(
		activeTab === 'toc'
			? searchResults.length
			: matchingHighlights.length + matchingNotes.length
	);

	type GroupedResults = Array<{ chapter: string; items: Array<{ cfi: string; excerpt: string }> }>;
	let groupedSearchResults = $derived.by(() => {
		if (searchResults.length === 0) return [] as GroupedResults;
		const map = new Map<string, Array<{ cfi: string; excerpt: string }>>();
		for (const r of searchResults) {
			const ch = r.chapterTitle || 'Unknown';
			if (!map.has(ch)) map.set(ch, []);
			map.get(ch)!.push({ cfi: r.cfi, excerpt: r.excerpt });
		}
		return Array.from(map.entries()).map(([chapter, items]) => ({ chapter, items }));
	});

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
		if (isSearchActive) {
			if (searchTimer) clearTimeout(searchTimer);
			doSearch();
		}
	}

	function handleSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searched = false;
		if (!searchQuery.trim()) {
			searching = false;
			searchResults = [];
			matchingHighlights = [];
			matchingNotes = [];
			lastSearchedQuery = '';
			return;
		}
		searchTimer = setTimeout(() => doSearch(), 500);
	}

	function textMatchesQuery(text: string, q: string): boolean {
		if (!text || !q) return false;
		const lower = text.toLowerCase();
		const parts = q.toLowerCase().split(/\s+/).filter(Boolean);
		return parts.some((p) => lower.includes(p));
	}

	async function doSearch() {
		const q = searchQuery.trim();
		if (!q || !sharedState?.readerService) {
			searching = false;
			searched = false;
			return;
		}
		searching = true;
		try {
			if (activeTab === 'toc') {
				const raw = await sharedState.readerService.searchText(q);
				const seen = new Set<string>();
				searchResults = raw.filter((r) => {
					if (!r?.cfi) return false;
					if (seen.has(r.cfi)) return false;
					seen.add(r.cfi);
					return true;
				});
				matchingHighlights = [];
				matchingNotes = [];
			} else if (activeTab === 'highlights') {
				searchResults = [];
				const [highlights, notes] = await Promise.all([
					sharedState.annotationService && sharedState.book
						? sharedState.annotationService.getHighlights(sharedState.book.id)
						: Promise.resolve([] as Highlight[]),
					sharedState.annotationService && sharedState.book
						? sharedState.annotationService.getNotes(sharedState.book.id)
						: Promise.resolve([] as Note[])
				]);
				matchingHighlights = highlights.filter((hl) => textMatchesQuery(hl.text, q));
				matchingNotes = notes.filter((n) =>
					textMatchesQuery(n.content, q) || textMatchesQuery(n.quotedText || '', q)
				);
			} else {
				searchResults = [];
				matchingHighlights = [];
				matchingNotes = [];
			}
			lastSearchedQuery = q;
		} catch (_e) {
			searchResults = [];
			matchingHighlights = [];
			matchingNotes = [];
			lastSearchedQuery = q;
		} finally {
			searching = false;
			searched = true;
		}
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (searchTimer) clearTimeout(searchTimer);
			doSearch();
		}
		if (e.key === 'Escape') {
			clearSearch();
		}
	}

	function clearSearch() {
		searchQuery = '';
		searchResults = [];
		matchingHighlights = [];
		matchingNotes = [];
		searched = false;
		searching = false;
		lastSearchedQuery = '';
		collapsedChapters = new Set();
		searchInputEl?.blur();
	}

	function getHighlightColorClass(color: string): string {
		return `hl-${color}`;
	}

	function formatAnnotationTime(timestamp: number): string {
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

	function escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function normalizeExcerpt(excerpt: string): string {
		return excerpt.replace(/\s+/g, ' ').trim();
	}

	function toggleChapter(chapter: string) {
		const next = new Set(collapsedChapters);
		if (next.has(chapter)) {
			next.delete(chapter);
		} else {
			next.add(chapter);
		}
		collapsedChapters = next;
	}

	function highlightExcerpt(excerpt: string, q: string): string {
		const text = escapeHtml(normalizeExcerpt(excerpt));
		const raw = q.trim();
		if (!raw) return text;
		const parts = raw.split(/\s+/).map((p) => p.trim()).filter(Boolean);
		if (parts.length === 0) return text;
		const escapedParts = parts.map((p) => escapeHtml(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		const pattern = escapedParts.join('|');
		return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
	}

	function toggleAllChapters(collapsed: boolean) {
		if (!collapsed) {
			collapsedChapters = new Set();
			return;
		}
		const next = new Set<string>();
		for (const group of groupedSearchResults) {
			next.add(group.chapter);
		}
		collapsedChapters = next;
	}

	function toggleBookshelfView() {
		sidebarView = sidebarView === 'details' ? 'bookshelf' : 'details';
	}

	async function loadToc() {
		if (!sharedState?.readerService || !sharedState?.book) return;
		try {
			tocItems = await sharedState.readerService.getTableOfContents();
		} catch (error) {
			logger.error('[EpubGlobalSidebar] Failed to load TOC:', error);
		}
	}

	function ensureEpubLeafActive(): void {
		if (!sharedState?.filePath) return;
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EPUB);
		for (const leaf of leaves) {
			const state = leaf.view?.getState?.();
			if (state?.filePath === sharedState.filePath || state?.file === sharedState.filePath) {
				app.workspace.revealLeaf(leaf);
				return;
			}
		}
		if (leaves.length > 0) {
			app.workspace.revealLeaf(leaves[0]);
		}
	}

	async function handleTocNavigate(href: string) {
		if (!sharedState?.readerService) return;
		try {
			ensureEpubLeafActive();
			await sharedState.readerService.navigateAndHighlight({ href, flashStyle: 'pulse' });
		} catch (error) {
			logger.error('[EpubGlobalSidebar] Failed to navigate:', error);
		}
	}

	async function handleHighlightNavigate(cfi: string, text?: string, color?: string) {
		if (!sharedState?.readerService) return;
		try {
			ensureEpubLeafActive();
			await sharedState.readerService.navigateAndHighlight({ cfi, text, flashStyle: 'pulse', flashColor: color });
		} catch (error) {
			logger.error('[EpubGlobalSidebar] Failed to navigate to highlight:', error);
		}
	}

	async function handleSearchResultNavigate(cfi: string, text?: string) {
		if (!sharedState?.readerService) return;
		try {
			ensureEpubLeafActive();
			await sharedState.readerService.navigateAndHighlight({ cfi, text, flashStyle: 'highlight' });
		} catch (error) {
			logger.error('[EpubGlobalSidebar] Failed to navigate to search result:', error);
		}
	}

	$effect(() => {
		if (sharedState?.book) {
			loadToc();
		}
	});

	onMount(() => {
		const unsubscribe = epubActiveDocumentStore.subscribeState((state) => {
			sharedState = { ...state };
		});
		return unsubscribe;
	});
</script>

<div class="epub-global-sidebar">
	{#if sidebarView === 'bookshelf'}
		<BookshelfView {app} onSwitchBook={sharedState?.onSwitchBook ?? undefined} onClose={() => sidebarView = 'details'} />
	{:else if !sharedState?.book}
		<div class="epub-global-sidebar-empty">
			<span class="empty-icon" use:icon={'book-open'}></span>
			<span class="empty-text">未打开 EPUB</span>
		</div>
	{:else}
		{#if sidebarView === 'details'}
			<div class="epub-global-sidebar-header">
				<div class="header-flex">
					{#if sharedState.book.metadata.coverImage}
						<img src={sharedState.book.metadata.coverImage} alt="Cover" class="sidebar-cover" />
					{:else}
						<div class="sidebar-cover-placeholder">
							<span use:icon={'book-open'}></span>
						</div>
					{/if}
					<div class="header-info">
						<div class="book-title">{sharedState.book.metadata.title || ''}</div>
						<div class="book-meta">
							<span class="book-author">{sharedState.book.metadata.author || ''}</span>
							<span class="book-progress">{sharedState.progress}%</span>
						</div>
					</div>
				</div>
			</div>

			<div class="epub-global-search-bar">
				<div class="epub-search-input-container">
					<span class="epub-search-icon" use:icon={'search'}></span>
					<input
						bind:this={searchInputEl}
						bind:value={searchQuery}
						oninput={handleSearchInput}
						onkeydown={handleSearchKeydown}
						placeholder="搜索..."
						class="epub-search-input"
					/>
					{#if searchQuery}
						<button class="epub-search-clear" onclick={clearSearch} title="清除">
							<span use:icon={'x'}></span>
						</button>
					{/if}
				</div>
			</div>

			<div class="epub-global-sidebar-tabs">
				<button
					class="epub-global-tab"
					class:active={activeTab === 'toc'}
					onclick={() => switchTab('toc')}
				>
					<span class="tab-icon" use:icon={'list'}></span>
					<span class="tab-label">目录</span>
				</button>
				<button
					class="epub-global-tab"
					class:active={activeTab === 'highlights'}
					onclick={() => switchTab('highlights')}
				>
					<span class="tab-icon" use:icon={'highlighter'}></span>
					<span class="tab-label">笔记</span>
				</button>
				<button
					class="epub-global-tab"
					class:active={activeTab === 'bookmarks'}
					onclick={() => switchTab('bookmarks')}
				>
					<span class="tab-icon" use:icon={'bookmark'}></span>
					<span class="tab-label">书签</span>
				</button>
			</div>

			<div class="epub-sidebar-content">
				{#if isSearchActive && (activeTab === 'toc' || activeTab === 'highlights')}
					<div class="epub-search-results">
						{#if searching}
							<div class="search-empty-state">搜索中...</div>
						{:else if searched && !hasAnyResults}
							<div class="search-empty-state">未找到结果</div>
						{:else if hasAnyResults}
							<div class="search-toolbar">
								<span class="search-toolbar-count">
									{resultCount} 个结果
									{#if lastSearchedQuery && lastSearchedQuery !== searchQuery.trim()}
										<span class="search-toolbar-stale"> - 查询已变更</span>
									{/if}
								</span>
								{#if activeTab === 'toc' && searchResults.length > 0}
									<div class="search-toolbar-actions">
										<button class="search-toolbar-btn" onclick={() => toggleAllChapters(false)} title="展开全部">
											<span use:icon={'chevrons-down'}></span>
										</button>
										<button class="search-toolbar-btn" onclick={() => toggleAllChapters(true)} title="折叠全部">
											<span use:icon={'chevrons-up'}></span>
										</button>
									</div>
								{/if}
							</div>

							{#if activeTab === 'toc'}
								{#each groupedSearchResults as group}
									<div class="search-group">
										<button class="search-group-header" onclick={() => toggleChapter(group.chapter)}>
											<span class="search-group-chevron" use:icon={collapsedChapters.has(group.chapter) ? 'chevron-right' : 'chevron-down'}></span>
											<span class="search-group-name">{group.chapter}</span>
											<span class="search-group-badge">{group.items.length}</span>
										</button>
										{#if !collapsedChapters.has(group.chapter)}
											<div class="search-group-items">
												{#each group.items as item}
													<button class="search-item" onclick={() => handleSearchResultNavigate(item.cfi, item.excerpt)}>
														<div class="search-item-accent"></div>
														<div class="search-item-content">
															<div class="search-item-text">{@html highlightExcerpt(item.excerpt, searchQuery)}</div>
														</div>
													</button>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							{:else if activeTab === 'highlights'}
								<div class="search-annotations">
									{#each matchingHighlights as hl}
										<button class="search-annotation" onclick={() => handleSearchResultNavigate(hl.cfiRange, hl.text)}>
											<span class="search-anno-dot {getHighlightColorClass(hl.color)}"></span>
											<div class="search-anno-body">
												<div class="search-anno-text">{@html highlightExcerpt(hl.text, searchQuery)}</div>
												<div class="search-anno-time">{formatAnnotationTime(hl.createdTime)}</div>
											</div>
										</button>
									{/each}
									{#each matchingNotes as note}
										<button class="search-annotation" onclick={() => note.cfi && handleSearchResultNavigate(note.cfi, note.content)}>
											<span class="search-anno-icon" use:icon={'pencil'}></span>
											<div class="search-anno-body">
												{#if note.quotedText}
													<div class="search-anno-quote">{@html highlightExcerpt(note.quotedText, searchQuery)}</div>
												{/if}
												<div class="search-anno-text search-anno-note">{@html highlightExcerpt(note.content, searchQuery)}</div>
												<div class="search-anno-time">{formatAnnotationTime(note.createdTime)}</div>
											</div>
										</button>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{:else if activeTab === 'toc'}
					<TableOfContents items={tocItems} onNavigate={handleTocNavigate} />
				{:else if activeTab === 'highlights'}
					{#if sharedState.annotationService}
						<NotesPanel book={sharedState.book} annotationService={sharedState.annotationService} backlinkService={sharedState.backlinkService ?? undefined} filePath={sharedState.filePath ?? undefined} onNavigate={handleHighlightNavigate} />
					{/if}
				{:else if activeTab === 'bookmarks'}
					{#if sharedState.annotationService}
						<BookmarkPanel book={sharedState.book} annotationService={sharedState.annotationService} onNavigate={handleHighlightNavigate} />
					{/if}
				{/if}
			</div>
		{/if}
	{/if}

	<div class="epub-sidebar-footer">
		<button
			class="footer-btn"
			onclick={toggleBookshelfView}
			title={sidebarView === 'bookshelf' ? '返回' : '书架'}
		>
			<span use:icon={sidebarView === 'bookshelf' ? 'book-open' : 'library'}></span>
		</button>
		<div class="spacer"></div>
		{#if sharedState?.onSettingsClick}
			<button class="footer-btn" title="设置" onclick={(e: MouseEvent) => sharedState?.onSettingsClick?.(e)}>
				<span use:icon={'settings'}></span>
			</button>
		{/if}
	</div>
</div>

<style>
	.epub-global-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		width: 100%;
		overflow: hidden;
		background: var(--background-primary);
	}

	.epub-global-sidebar > :not(.epub-sidebar-footer) {
		min-height: 0;
	}

	.epub-global-sidebar-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
		gap: 8px;
		color: var(--text-faint);
		font-size: 13px;
	}

	.epub-global-sidebar-empty .empty-icon :global(.svg-icon) {
		width: 24px;
		height: 24px;
	}

	.epub-global-sidebar-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		flex-shrink: 0;
	}

	.epub-global-sidebar-header .book-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal);
		line-height: 1.3;
		margin-bottom: 4px;
	}

	.epub-global-sidebar-header .book-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: var(--text-muted);
	}

	.epub-global-sidebar-header .book-progress {
		font-weight: 600;
		color: var(--interactive-accent);
	}

	.epub-global-sidebar-header .header-flex {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.epub-global-sidebar-header .sidebar-cover {
		width: 48px;
		height: 68px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	.epub-global-sidebar-header .sidebar-cover-placeholder {
		width: 48px;
		height: 68px;
		border-radius: 4px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--background-modifier-border);
		color: var(--text-faint);
	}

	.epub-global-sidebar-header .sidebar-cover-placeholder :global(.svg-icon) {
		width: 20px;
		height: 20px;
	}

	.epub-global-sidebar-header .header-info {
		flex: 1;
		min-width: 0;
	}

	.epub-global-sidebar-tabs {
		display: flex;
		gap: 2px;
		padding: 6px 12px;
		flex-shrink: 0;
		background: var(--background-primary);
	}

	.epub-global-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		line-height: 1;
	}

	.epub-global-tab .tab-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.epub-global-tab .tab-icon :global(.svg-icon) {
		width: 14px;
		height: 14px;
	}

	.epub-global-tab .tab-label {
		white-space: nowrap;
	}

	.epub-global-tab:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}

	.epub-global-tab.active {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
		font-weight: 600;
	}

	/* Search bar */
	.epub-global-search-bar {
		padding: 8px 12px 0;
		flex-shrink: 0;
	}

	.epub-search-input-container {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		height: 30px;
		background: var(--background-modifier-form-field);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.epub-search-input-container:focus-within {
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.15);
	}

	.epub-search-icon {
		flex-shrink: 0;
		color: var(--text-faint);
		display: flex;
		align-items: center;
	}

	.epub-search-icon :global(.svg-icon) {
		width: 14px;
		height: 14px;
	}

	.epub-search-input {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--text-normal);
		font-size: 13px;
		padding: 0;
		outline: none;
		min-width: 0;
		height: 100%;
	}

	.epub-search-input::placeholder {
		color: var(--text-faint);
	}

	.epub-search-clear {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--text-faint);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		border-radius: 4px;
		transition: color 0.1s ease;
	}

	.epub-search-clear:hover {
		color: var(--text-normal);
	}

	.epub-search-clear :global(.svg-icon) {
		width: 12px;
		height: 12px;
	}

	:global(.epub-sidebar-content) {
		overflow-x: hidden;
	}

	.epub-sidebar-content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	/* --- Search Results: explicit button reset to prevent Obsidian native styling --- */
	.epub-search-results :global(button) {
		appearance: none;
		-webkit-appearance: none;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		text-align: left;
		text-decoration: none;
		outline: none;
		box-shadow: none;
		box-sizing: border-box;
		cursor: pointer;
	}

	.epub-search-results {
		flex: 1 0 auto;
		width: 100%;
		max-height: none;
		overflow-y: visible;
	}

	/* Empty / loading state */
	.search-empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--text-faint);
		font-size: 13px;
		line-height: 1.5;
	}

	/* Toolbar */
	.search-toolbar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 14px;
		background: var(--background-primary);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.search-toolbar-count {
		font-size: 12px;
		color: var(--text-faint);
		font-weight: 500;
	}

	.search-toolbar-stale {
		font-weight: 400;
		color: var(--text-muted);
	}

	.search-toolbar-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.search-toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		color: var(--text-faint);
		transition: background 0.12s, color 0.12s;
	}

	.search-toolbar-btn:hover {
		background: var(--background-modifier-hover);
		color: var(--text-muted);
	}

	.search-toolbar-btn :global(.svg-icon) {
		width: 14px;
		height: 14px;
	}

	/* Chapter group */
	.search-group + .search-group {
		border-top: 1px solid var(--background-modifier-border);
	}

	.search-group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 8px 14px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		transition: color 0.12s;
	}

	.search-group-header:hover {
		color: var(--text-normal);
	}

	.search-group-chevron {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--text-faint);
	}

	.search-group-chevron :global(.svg-icon) {
		width: 12px;
		height: 12px;
	}

	.search-group-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search-group-badge {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 500;
		color: var(--text-faint);
		background: var(--background-modifier-hover);
		padding: 1px 6px;
		border-radius: 10px;
		line-height: 1.4;
	}

	/* Result items container */
	.search-group-items {
		padding: 0 8px 6px 20px;
	}

	/* Individual result item */
	.search-item {
		display: flex;
		width: 100%;
		margin: 2px 0;
		border-radius: 6px;
		overflow: hidden;
		transition: background 0.12s;
	}

	.search-item:hover {
		background: var(--background-modifier-hover);
	}

	.search-item-accent {
		width: 3px;
		flex-shrink: 0;
		background: var(--interactive-accent);
		border-radius: 2px;
		opacity: 0.3;
		transition: opacity 0.12s;
	}

	.search-item:hover .search-item-accent {
		opacity: 0.85;
	}

	.search-item-content {
		flex: 1;
		min-width: 0;
		padding: 7px 10px;
	}

	.search-item-text {
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-normal);
		word-break: break-word;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.search-item-text :global(mark) {
		background: var(--text-highlight-bg);
		color: inherit;
		border-radius: 2px;
		padding: 0 1px;
	}

	/* Section divider */
	.search-section-divider {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 14px 6px;
		margin-top: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-top: 1px solid var(--background-modifier-border);
	}

	.search-section-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.search-section-icon :global(.svg-icon) {
		width: 12px;
		height: 12px;
	}

	/* Annotations list */
	.search-annotations {
		padding: 2px 8px 6px;
	}

	.search-annotation {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		margin: 2px 0;
		border-radius: 6px;
		overflow: hidden;
		transition: background 0.12s;
	}

	.search-annotation:hover {
		background: var(--background-modifier-hover);
	}

	/* Highlight color dot */
	.search-anno-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 4px;
	}

	.search-anno-dot.hl-yellow { background: #FBC02D; }
	.search-anno-dot.hl-green { background: #4CAF50; }
	.search-anno-dot.hl-blue { background: #2196F3; }
	.search-anno-dot.hl-pink { background: #E91E63; }
	.search-anno-dot.hl-purple { background: #9C27B0; }

	/* Note icon */
	.search-anno-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--text-faint);
		margin-top: 2px;
	}

	.search-anno-icon :global(.svg-icon) {
		width: 14px;
		height: 14px;
	}

	/* Annotation body */
	.search-anno-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.search-anno-text {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-normal);
		word-break: break-word;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.search-anno-text :global(mark) {
		background: var(--text-highlight-bg);
		color: inherit;
		border-radius: 2px;
		padding: 0 1px;
	}

	.search-anno-quote {
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.4;
		word-break: break-word;
		overflow-wrap: anywhere;
		padding-left: 8px;
		border-left: 2px solid var(--background-modifier-border);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.search-anno-quote :global(mark) {
		background: var(--text-highlight-bg);
		color: inherit;
		border-radius: 2px;
		padding: 0 1px;
	}

	.search-anno-note {
		font-style: italic;
		color: var(--text-muted);
	}

	.search-anno-time {
		font-size: 11px;
		color: var(--text-faint);
	}
</style>
