<script lang="ts">
	import type { TocItem } from '../../services/epub';

	interface Props {
		items: TocItem[];
		onNavigate: (href: string) => void;
	}

	let { items, onNavigate }: Props = $props();

	let activeHref = $state<string | null>(null);

	function handleClick(item: TocItem) {
		activeHref = item.href;
		onNavigate(item.href);
	}

	function handleKeydown(event: KeyboardEvent, item: TocItem) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(item);
		}
	}

	function flattenItems(items: TocItem[]): TocItem[] {
		const result: TocItem[] = [];
		for (const item of items) {
			result.push(item);
			if (item.subitems) {
				result.push(...flattenItems(item.subitems));
			}
		}
		return result;
	}

	let flatItems = $derived(flattenItems(items));
</script>

<div class="epub-toc-list">
	{#each flatItems as item}
		<div
			class="epub-toc-item level-{item.level}"
			class:active={activeHref === item.href}
			onclick={() => handleClick(item)}
			onkeydown={(event) => handleKeydown(event, item)}
			role="button"
			tabindex="0"
		>
			<span class="toc-title">{item.label}</span>
		</div>
	{/each}
</div>
