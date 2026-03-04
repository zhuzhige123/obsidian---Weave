<script lang="ts">
  // 简单的手风琴组件占位符
  interface Props {
    title: string;
    open?: boolean;
  }

  let {
    title,
    open = false
  }: Props = $props();
</script>

<div class="cursor-accordion">
  <button class="accordion-header" onclick={() => open = !open}>
    <span>{title}</span>
    <span class="chevron" class:rotated={open}>▼</span>
  </button>
  {#if open}
    <div class="accordion-content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .cursor-accordion {
    border: 1px solid var(--weave-border);
    border-radius: var(--weave-radius-md);
  }

  .accordion-header {
    width: 100%;
    padding: var(--weave-spacing-md);
    background: none;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }

  .chevron {
    transition: transform 0.2s;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .accordion-content {
    padding: var(--weave-spacing-md);
    border-top: 1px solid var(--weave-border);
  }
</style>
