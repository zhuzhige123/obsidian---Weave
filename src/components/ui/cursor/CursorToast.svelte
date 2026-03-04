<script lang="ts">
  // Toast 组件占位符
  interface Props {
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    visible?: boolean;
  }

  let { message, type = 'info', visible = true }: Props = $props();
</script>

{#if visible}
  <div class="cursor-toast {type}">
    {message}
  </div>
{/if}

<style>
  .cursor-toast {
    padding: var(--weave-spacing-md);
    border-radius: var(--weave-radius-md);
    background: var(--weave-surface);
    border: 1px solid var(--weave-border);
  }
</style>
