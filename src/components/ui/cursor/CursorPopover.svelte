<script lang="ts">
  interface Props { open?: boolean; }
  let { open = false }: Props = $props();
</script>

<div class="cursor-popover">
  <div onclick={() => open = !open}>
    <slot name="trigger" />
  </div>
  {#if open}
    <div class="popover-content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .cursor-popover { position: relative; display: inline-block; }
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
