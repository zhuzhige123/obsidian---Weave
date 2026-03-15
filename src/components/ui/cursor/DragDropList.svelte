<script lang="ts">
  import type { Snippet } from 'svelte';

  interface DragDropItem { id: string; [key: string]: any; }
  interface Props { items: DragDropItem[]; onReorder?: (items: DragDropItem[]) => void; children?: Snippet<[DragDropItem]>; }
  let { items = [], onReorder, children }: Props = $props();
</script>

<div class="drag-drop-list">
  {#each items as item}
    <div class="drag-item" draggable="true">
      {@render children?.(item)}
    </div>
  {/each}
</div>

<style>
  .drag-drop-list { display: flex; flex-direction: column; gap: var(--weave-spacing-sm); }
  .drag-item { padding: var(--weave-spacing-md); background: var(--weave-surface); border: 1px solid var(--weave-border); border-radius: var(--weave-radius-md); cursor: move; }
  .drag-item:hover { background: var(--weave-surface-hover); }
</style>
