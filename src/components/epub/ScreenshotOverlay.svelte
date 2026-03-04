<script lang="ts">
	import { tick } from 'svelte';
	import type { EpubScreenshotService, ScreenshotRect } from '../../services/epub/EpubScreenshotService';

	interface Props {
		active: boolean;
		sourceEl: HTMLElement | null;
		screenshotService: EpubScreenshotService;
		onCapture: (blob: Blob, rect: ScreenshotRect) => void;
		onCancel: () => void;
	}

	let { active, sourceEl, screenshotService, onCapture, onCancel }: Props = $props();

	let overlayEl = $state<HTMLDivElement | undefined>(undefined);
	let isDragging = $state(false);
	let isCapturing = $state(false);
	let startX = $state(0);
	let startY = $state(0);
	let selRect = $state<ScreenshotRect>({ x: 0, y: 0, width: 0, height: 0 });

	$effect(() => {
		if (active && overlayEl) {
			tick().then(() => overlayEl?.focus());
		}
		if (!active) {
			resetState();
		}
	});

	function handleMouseDown(e: MouseEvent) {
		if (isCapturing) return;
		const rect = overlayEl!.getBoundingClientRect();
		startX = e.clientX - rect.left;
		startY = e.clientY - rect.top;
		isDragging = true;
		selRect = { x: startX, y: startY, width: 0, height: 0 };
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const rect = overlayEl!.getBoundingClientRect();
		const currentX = e.clientX - rect.left;
		const currentY = e.clientY - rect.top;

		selRect = {
			x: Math.min(startX, currentX),
			y: Math.min(startY, currentY),
			width: Math.abs(currentX - startX),
			height: Math.abs(currentY - startY)
		};
	}

	async function handleMouseUp(_e: MouseEvent) {
		if (!isDragging) return;
		isDragging = false;

		if (selRect.width > 10 && selRect.height > 10 && sourceEl) {
			isCapturing = true;
			const captureRect = { ...selRect };

			if (overlayEl) overlayEl.style.visibility = 'hidden';
			await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

			try {
				const blob = await screenshotService.captureFromCanvas(sourceEl, captureRect);
				if (blob) {
					onCapture(blob, captureRect);
				}
			} finally {
				if (overlayEl) overlayEl.style.visibility = '';
				isCapturing = false;
			}
		}
		resetState();
	}

	function resetState() {
		isDragging = false;
		selRect = { x: 0, y: 0, width: 0, height: 0 };
	}

	function handleKeydown(_e: KeyboardEvent) {
	}

	function handleWheel(e: WheelEvent) {
		if (isDragging) return;
		if (!sourceEl) return;
		e.preventDefault();
		const contentWrapper = sourceEl.querySelector('.epub-content-wrapper') as HTMLElement;
		if (contentWrapper) {
			contentWrapper.scrollTop += e.deltaY;
			contentWrapper.scrollLeft += e.deltaX;
		}
	}
</script>

{#if active}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="epub-screenshot-overlay"
		bind:this={overlayEl}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onkeydown={handleKeydown}
		onwheel={handleWheel}
		tabindex="-1"
	>
		{#if selRect.width > 0 && selRect.height > 0}
			<div
				class="epub-screenshot-selection"
				style="left: {selRect.x}px; top: {selRect.y}px; width: {selRect.width}px; height: {selRect.height}px;"
			></div>
		{/if}

	</div>
{/if}
