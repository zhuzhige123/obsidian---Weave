<script lang="ts">
	import { setIcon } from 'obsidian';
	import { onMount } from 'svelte';
	import type { HighlightClickInfo } from '../../services/epub';

	interface Props {
		info: HighlightClickInfo | null;
		onDelete: (info: HighlightClickInfo) => void;
		onChangeColor: (info: HighlightClickInfo, newColor: string) => void;
		onBacklink: (info: HighlightClickInfo) => void;
		onExtractToCard: (info: HighlightClickInfo) => void;
		onCopyText: (info: HighlightClickInfo) => void;
		onDismiss: () => void;
	}

	let { info, onDelete, onChangeColor, onBacklink, onExtractToCard, onCopyText, onDismiss }: Props = $props();

	let toolbarEl: HTMLDivElement | undefined = $state(undefined);
	let colorPickerOpen = $state(false);
	let posTop = $state(0);
	let posLeft = $state(0);

	const colors = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	$effect(() => {
		if (info) {
			colorPickerOpen = false;
			const toolbarWidth = 240;
			const toolbarHeight = 40;

			let top = info.rect.top - toolbarHeight - 10;
			let left = info.rect.left + info.rect.width / 2;

			if (top < 10) top = info.rect.bottom + 10;
			if (left < toolbarWidth / 2 + 10) left = toolbarWidth / 2 + 10;

			posTop = top;
			posLeft = left;
		}
	});

	function handleClickOutside(e: Event) {
		if (info && toolbarEl && !toolbarEl.contains(e.target as Node)) {
			onDismiss();
		}
	}

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
	class="epub-highlight-toolbar epub-glass-panel"
	class:visible={info !== null}
	style="top: {posTop}px; left: {posLeft}px;"
	bind:this={toolbarEl}
>
	{#if info}
		{#if colorPickerOpen}
			<div class="toolbar-group colors">
				{#each colors as c}
					<button
						class="color-btn {c}"
						class:active={c === info.color}
						onclick={() => { onChangeColor(info!, c); colorPickerOpen = false; }}
						title={c}
					></button>
				{/each}
			</div>
		{:else}
			<div class="toolbar-group actions">
				<button class="action-btn" onclick={() => colorPickerOpen = true} title="更改颜色">
					<span use:icon={'palette'}></span>
				</button>
				<button class="action-btn" onclick={() => onBacklink(info!)} title="跳转到笔记">
					<span use:icon={'external-link'}></span>
				</button>
				<button class="action-btn" onclick={() => onExtractToCard(info!)} title="摘录到卡片">
					<span use:icon={'scissors'}></span>
				</button>
				<button class="action-btn" onclick={() => onCopyText(info!)} title="复制文本">
					<span use:icon={'clipboard-copy'}></span>
				</button>
				<div class="divider"></div>
				<button class="action-btn delete" onclick={() => onDelete(info!)} title="删除高亮">
					<span use:icon={'trash-2'}></span>
				</button>
			</div>
		{/if}
	{/if}

	<div class="toolbar-arrow"></div>
</div>
