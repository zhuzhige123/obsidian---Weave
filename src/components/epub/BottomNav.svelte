<script lang="ts">
	import { setIcon } from 'obsidian';

	interface Props {
		onPrev: () => void;
		onNext: () => void;
	}

	let { onPrev, onNext }: Props = $props();

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

<div class="epub-bottom-nav">
	<button class="epub-nav-btn" onclick={onPrev}>
		<span use:icon={'arrow-left'}></span>
		<span>上一页</span>
	</button>
	<button class="epub-nav-btn" onclick={onNext}>
		<span>下一页</span>
		<span use:icon={'arrow-right'}></span>
	</button>
</div>
