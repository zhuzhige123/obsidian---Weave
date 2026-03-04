<script lang="ts">
	import { setIcon } from 'obsidian';
	import type { EpubWidthMode, EpubLayoutMode } from '../../services/epub';

	interface Props {
		widthMode: EpubWidthMode;
		layoutMode: EpubLayoutMode;
		opacity: number;
		onWidthModeChange: (mode: EpubWidthMode) => void;
		onLayoutModeChange: (mode: EpubLayoutMode) => void;
	}

	let { widthMode, layoutMode, opacity, onWidthModeChange, onLayoutModeChange }: Props = $props();

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="epub-right-bar"
	style="opacity: {opacity}"
	onmouseenter={() => opacity = 1}
>
	<div class="toolbar-group">
		<button
			class="epub-icon-btn"
			class:active={widthMode === 'standard'}
			onclick={() => onWidthModeChange('standard')}
			title="Standard width"
		>
			<span use:icon={'align-center'}></span>
		</button>
		<button
			class="epub-icon-btn"
			class:active={widthMode === 'full'}
			onclick={() => onWidthModeChange('full')}
			title="Full width"
		>
			<span use:icon={'maximize'}></span>
		</button>
	</div>

	<div class="divider-h"></div>

	<div class="toolbar-group">
		<button
			class="epub-icon-btn"
			class:active={layoutMode === 'scroll'}
			onclick={() => onLayoutModeChange('scroll')}
			title="Continuous scroll"
		>
			<span use:icon={'scroll-text'}></span>
		</button>
		<button
			class="epub-icon-btn"
			class:active={layoutMode === 'paginated'}
			onclick={() => onLayoutModeChange('paginated')}
			title="Paginated"
		>
			<span use:icon={'file-text'}></span>
		</button>
		<button
			class="epub-icon-btn"
			class:active={layoutMode === 'double'}
			onclick={() => onLayoutModeChange('double')}
			title="Double column"
		>
			<span use:icon={'book-open'}></span>
		</button>
	</div>

	<div class="divider-h"></div>

	<div class="toolbar-group">
		<button class="epub-icon-btn" title="Translate">
			<span use:icon={'languages'}></span>
		</button>
		<button class="epub-icon-btn" title="More">
			<span use:icon={'more-vertical'}></span>
		</button>
	</div>
</div>
