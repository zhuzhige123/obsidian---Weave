<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props { text: string; children?: Snippet; }
  let { text, children }: Props = $props();
  let showTooltip = $state(false);
</script>

<div class="cursor-tooltip" 
     role="presentation"
     onmouseenter={() => showTooltip = true} 
     onmouseleave={() => showTooltip = false}>
  {@render children?.()}
  {#if showTooltip}
    <div class="tooltip-content">{text}</div>
  {/if}
</div>

<style>
  .cursor-tooltip { position: relative; display: inline-block; }
  .tooltip-content {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--weave-text-primary);
    color: var(--weave-surface);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: var(--weave-z-overlay);
    margin-bottom: 4px;
  }
</style>
