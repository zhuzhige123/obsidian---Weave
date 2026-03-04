<script lang="ts">
  // 简单的标签页组件占位符
  interface TabItem {
    id: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    items: TabItem[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
  }

  let {
    items = [],
    activeTab = items[0]?.id,
    onTabChange
  }: Props = $props();
</script>

<div class="cursor-tabs">
  <div class="tab-list">
    {#each items as item}
      <button
        class="tab-button"
        class:active={activeTab === item.id}
        disabled={item.disabled}
        onclick={() => {
          activeTab = item.id;
          onTabChange?.(item.id);
        }}
      >
        {item.label}
      </button>
    {/each}
  </div>
  <div class="tab-content">
    <slot />
  </div>
</div>

<style>
  .cursor-tabs {
    display: flex;
    flex-direction: column;
  }

  .tab-list {
    display: flex;
    border-bottom: 1px solid var(--weave-border);
  }

  .tab-button {
    padding: var(--weave-spacing-md);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--weave-text-muted);
    border-bottom: 2px solid transparent;
  }

  .tab-button.active {
    color: var(--weave-primary);
    border-bottom-color: var(--weave-primary);
  }

  .tab-content {
    padding: var(--weave-spacing-lg);
  }
</style>
