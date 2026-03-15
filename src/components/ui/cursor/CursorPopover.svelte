<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props { open?: boolean; trigger?: Snippet; children?: Snippet; }
  let { open = false, trigger, children }: Props = $props();
</script>

<div class="cursor-popover">
  <button type="button" class="popover-trigger" onclick={() => open = !open}>
    {@render trigger?.()}
  </button>
  {#if open}
    <div class="popover-content">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .cursor-popover { position: relative; display: inline-block; }
  .popover-trigger {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .popover-content {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--weave-surface);
    border: 1px solid var(--weave-border);
    border-radius: var(--weave-radius-md);
    box-shadow: var(--weave-shadow-lg);
    padding: var(--weave-spacing-md);
    z-index: var(--weave-z-overlay);
    min-width: 200px;
  }
</style>
