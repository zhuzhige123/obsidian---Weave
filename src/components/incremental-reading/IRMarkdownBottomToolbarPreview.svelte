<script lang="ts">
  interface Props {
    onAction?: (actionId: string) => void;
  }

  let { onAction }: Props = $props();

  const buttons = [
    { id: 'review', label: '复查' },
    { id: 'tomorrow', label: '明天' },
    { id: 'normal', label: '正常' },
    { id: 'in3days', label: '3天后' },
    { id: 'intensive', label: '攻坚' },
    { id: 'in10days', label: '10天后' },
    { id: 'later', label: '稍后' },
    { id: 'plus2days', label: '+2天' }
  ] as const;
</script>

<div class="weave-ir-bottom-toolbar-preview" aria-label="weave-ir-bottom-toolbar-preview">
  <div class="btn-row">
    {#each buttons as btn (btn.id)}
      <button
        type="button"
        class="toolbar-btn"
        onclick={() => onAction?.(btn.id)}
      >
        {btn.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .weave-ir-bottom-toolbar-preview {
    width: 100%;
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    padding: 10px 12px;
    background: transparent;
    z-index: 50;
  }

  .btn-row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .toolbar-btn {
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    box-shadow: var(--shadow-s);
  }

  .toolbar-btn:hover {
    background: var(--background-modifier-hover);
  }

  .toolbar-btn:active {
    transform: translateY(1px);
  }
</style>
