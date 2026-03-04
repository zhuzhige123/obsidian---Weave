<script lang="ts">
  interface Props { open?: boolean; }
  let { open = false }: Props = $props();
</script>

<div class="cursor-dropdown">
  <button onclick={() => open = !open}>
    <slot name="trigger" />
  </button>
  {#if open}
    <div class="dropdown-content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .cursor-dropdown { position: relative; display: inline-block; }
  .dropdown-content {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--weave-surface);
    border: 1px solid var(--weave-border);
    border-radius: var(--weave-radius-md);
    box-shadow: var(--weave-shadow-md);
    z-index: var(--weave-z-overlay);
    min-width: 200px;
  }
</style>
