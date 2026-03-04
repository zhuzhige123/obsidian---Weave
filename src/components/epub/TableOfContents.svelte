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
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="epub-toc-item level-{item.level}"
			class:active={activeHref === item.href}
			onclick={() => handleClick(item)}
		>
			<span class="toc-title">{item.label}</span>
		</div>
	{/each}
</div>
