<script lang="ts">
  interface Props { value: string; language?: string; }
  let { value = $bindable(), language = 'javascript' }: Props = $props();
</script>

<div class="code-editor">
  <textarea bind:value placeholder="Enter code here..." class="code-textarea"></textarea>
</div>

<style>
  .code-editor { border: 1px solid var(--weave-border); border-radius: var(--weave-radius-md); }
  .code-textarea {
    width: 100%;
    min-height: 200px;
    padding: var(--weave-spacing-md);
    border: none;
    background: var(--weave-surface);
    color: var(--weave-text-primary);
    font-family: var(--font-monospace, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
    font-size: 14px;
    resize: vertical;
    outline: none;
  }
</style>
