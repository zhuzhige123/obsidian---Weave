<script lang="ts" module>
	const coverCache = new Map<string, string>();
</script>

<script lang="ts">
	import { setIcon, TFile, Menu } from 'obsidian';
	import type { App } from 'obsidian';
	import ePub from 'epubjs';
	import { getPreferredEpubLeaf } from '../../utils/epub-leaf-utils';
	import { logger } from '../../utils/logger';
	import { VIEW_TYPE_EPUB } from '../../views/EpubView';

	interface EpubFileInfo {
		path: string;
		name: string;
		folder: string;
		size: number;
	}

	interface Props {
		app: App;
		onSwitchBook?: (filePath: string) => void;
		onClose: () => void;
	}

	let { app, onSwitchBook, onClose }: Props = $props();

	let epubFiles = $state<EpubFileInfo[]>([]);
	let covers = $state<Map<string, string>>(new Map());
	let searchQuery = $state('');
	let searching = $state(false);
	let loadingCovers = false;

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	function scanVaultForEpubs() {
		const files = app.vault.getFiles();
		epubFiles = files
			.filter((f: TFile) => f.extension === 'epub')
			.map((f: TFile) => ({
				path: f.path,
				name: f.basename,
				folder: f.parent?.path || '/',
				size: f.stat.size
			}))
			.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
	}

	async function loadCovers() {
		if (loadingCovers) return;
		loadingCovers = true;

		for (const file of epubFiles) {
			if (coverCache.has(file.path)) {
				if (!covers.has(file.path)) {
					covers.set(file.path, coverCache.get(file.path)!);
					covers = new Map(covers);
				}
				continue;
			}

			try {
				const arrayBuffer = await app.vault.adapter.readBinary(file.path);
				const book = ePub(arrayBuffer, { replacements: 'none' } as any);
				await book.ready;
				const coverUrl = await book.coverUrl();
				book.destroy();

				if (coverUrl) {
					coverCache.set(file.path, coverUrl);
					covers.set(file.path, coverUrl);
					covers = new Map(covers);
				}
			} catch {
				// skip failed covers
			}
		}

		loadingCovers = false;
	}

	function handleBookKeydown(event: KeyboardEvent, path: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void switchBook(path);
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function switchBook(filePath: string) {
		if (onSwitchBook) {
			await Promise.resolve(onSwitchBook(filePath));
		} else {
			await openBookInNewTab(filePath);
		}
		onClose();
	}

	async function openBookInNewTab(filePath: string) {
		try {
			const leaf = getPreferredEpubLeaf(app, filePath);
			if (!leaf) return;
			await leaf.setViewState({
				type: VIEW_TYPE_EPUB,
				active: true,
				state: { filePath }
			});
			app.workspace.revealLeaf(leaf);
		} catch (error) {
			logger.error('[BookshelfView] Failed to open EPUB:', error);
		}
	}

	function handleContextMenu(e: MouseEvent, filePath: string, fileName: string) {
		e.preventDefault();
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('在新标签页打开')
				.setIcon('external-link')
				.onClick(() => openBookInNewTab(filePath));
		});
		menu.showAtMouseEvent(e);
	}

	let filteredFiles = $derived(
		searchQuery.trim()
			? epubFiles.filter(f =>
				f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				f.folder.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: epubFiles
	);

	$effect(() => {
		scanVaultForEpubs();
	});

	$effect(() => {
		if (epubFiles.length > 0) {
			loadCovers();
		}
	});
</script>

<div class="epub-bookshelf-header">
	<h3>书架</h3>
	<div style="display: flex; gap: 4px;">
		<button
			class="epub-icon-btn"
			style="width:28px;height:28px;"
			title={searching ? '关闭搜索' : '搜索'}
			onclick={() => { searching = !searching; if (!searching) searchQuery = ''; }}
		>
			<span use:icon={searching ? 'x' : 'search'}></span>
		</button>
	</div>
</div>

{#if searching}
	<div class="epub-bookshelf-search">
		<input
			type="text"
			placeholder="搜索书籍..."
			bind:value={searchQuery}
		/>
	</div>
{/if}

<div class="epub-bookshelf-list">
	{#if filteredFiles.length === 0}
		<div class="epub-placeholder">
			{#if epubFiles.length === 0}
				未在此仓库中找到 EPUB 文件。
			{:else}
				未找到“{searchQuery}”的结果
			{/if}
		</div>
	{:else}
		{#each filteredFiles as file (file.path)}
			<div
				class="epub-book-item"
				onclick={() => void switchBook(file.path)}
				oncontextmenu={(e) => handleContextMenu(e, file.path, file.name)}
				onkeydown={(event) => handleBookKeydown(event, file.path)}
				role="button"
				tabindex="0"
			>
				{#if covers.get(file.path)}
					<img src={covers.get(file.path)} alt="" class="book-thumb" />
				{:else}
					<div class="book-thumb-placeholder">
						<span use:icon={'book-text'}></span>
					</div>
				{/if}
				<div class="book-info">
					<div class="book-name">{file.name}</div>
					<div class="book-meta-text">{file.folder}</div>
					<div class="book-meta-text">{formatSize(file.size)}</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
