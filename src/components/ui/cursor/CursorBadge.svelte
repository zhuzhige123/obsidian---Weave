<script lang="ts">
  interface Props { variant?: 'default' | 'success' | 'warning' | 'error'; }
  let { variant = 'default' }: Props = $props();
</script>

<span class="cursor-badge {variant}">
  <slot />
</span>

<style>
  .cursor-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .cursor-badge.default { background: var(--weave-surface-alt); color: var(--weave-text-primary); }
  .cursor-badge.success { background: var(--weave-success-alpha); color: var(--weave-success); }
  .cursor-badge.warning { background: var(--weave-warning-alpha); color: var(--weave-warning); }
  .cursor-badge.error { background: var(--weave-error-alpha); color: var(--weave-error); }
</style>
