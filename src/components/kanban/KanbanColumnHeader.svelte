<!--
  看板列头组件
  显示分组标题、统计信息和操作按钮
-->
<script lang="ts">
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";

  interface GroupStats {
    total: number;
    due: number;
    selected: number;
  }

  interface Props {
    /** 分组标签 */
    label: string;
    /** 分组图标 */
    icon: string;
    /** 分组颜色 */
    color: string;
    /** 统计信息 */
    stats: GroupStats;
    /** 是否显示统计 */
    showStats?: boolean;
    /** 是否使用彩色背景 */
    useColoredBackground?: boolean;
    /** 全选回调 */
    onSelectAll?: () => void;
  }

  let {
    label,
    icon,
    color,
    stats,
    showStats = true,
    useColoredBackground = false,
    onSelectAll
  }: Props = $props();
</script>

<div 
  class="kanban-column-header"
  class:colored-bg={useColoredBackground}
  style="--group-color: {color}"
>
  <div class="header-title-row">
    <div class="title-content">
      <EnhancedIcon name={icon} size="18" />
      <span class="title-text">{label}</span>
      <span class="card-count">({stats.total})</span>
    </div>
    
    {#if onSelectAll}
      <button
        class="select-all-btn"
        onclick={onSelectAll}
        title="全选此分组"
      >
        <EnhancedIcon name="check-square" size="14" />
      </button>
    {/if}
  </div>
  
  {#if showStats && stats.total > 0}
    <div class="header-stats">
      <div class="progress-bar">
        <div 
          class="progress-fill"
          style="width: {stats.total > 0 ? (stats.due / stats.total * 100) : 0}%"
        ></div>
      </div>
      <div class="stats-badges">
        {#if stats.due > 0}
          <span class="badge badge-due">{stats.due} 到期</span>
        {/if}
        {#if stats.selected > 0}
          <span class="badge badge-selected">{stats.selected} 已选</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .kanban-column-header {
    padding: 0.75rem;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .kanban-column-header.colored-bg {
    background: color-mix(in srgb, var(--group-color) 15%, var(--background-secondary));
  }

  .header-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .title-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .title-text {
    font-weight: 600;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-count {
    color: var(--text-muted);
    font-weight: normal;
    font-size: 0.875rem;
  }

  .select-all-btn {
    padding: 0.25rem;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s, background 0.2s;
  }

  .select-all-btn:hover {
    opacity: 1;
    background: var(--background-modifier-hover);
  }

  .header-stats {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--interactive-accent), var(--color-green));
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .stats-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .badge-due {
    background: color-mix(in srgb, var(--color-red) 20%, transparent);
    color: var(--color-red);
  }

  .badge-selected {
    background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);
    color: var(--interactive-accent);
  }
</style>
