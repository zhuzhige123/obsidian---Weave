<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    text?: string;
    children?: Snippet;
  }

  let { text, children }: Props = $props();

  let visible = $state(false);
</script>

<span
  class="help-tooltip-trigger"
  role="button"
  tabindex="0"
  onmouseenter={() => visible = true}
  onmouseleave={() => visible = false}
  onfocus={() => visible = true}
  onblur={() => visible = false}
>
  <span class="help-icon">?</span>
  {#if visible}
    <span class="help-tooltip-content">
      {#if children}
        {@render children()}
      {:else if text}
        {text}
      {/if}
    </span>
  {/if}
</span>

<style>
  .help-tooltip-trigger {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
  }

  .help-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
  }

  .help-tooltip-content {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 12px;
    color: var(--text-normal);
    white-space: nowrap;
    z-index: 10;
  }
</style>
