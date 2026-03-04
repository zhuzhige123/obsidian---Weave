<script lang="ts">
  /**
   * 移动端牌组学习头部组件
   * 
   * Part A: 牌组学习界面的移动端顶部导航栏
   * - 左侧：菜单按钮（☰）- 使用 Obsidian 原生图标
   * - 中间：复用桌面端的CategoryFilter组件（多彩圆点）
   * - 右侧：留空（无搜索/设置按钮）
   * 
   * @module components/study/MobileDeckStudyHeader
   * @version 1.2.0
   * @requirements 1.1, 1.4, 1.5, 2.1, 2.2
   */
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import CategoryFilter, { type DeckFilter } from '../deck-views/CategoryFilter.svelte';

  interface Props {
    selectedFilter?: DeckFilter;
    onMenuClick: (evt: MouseEvent) => void;
    onFilterSelect?: (filter: DeckFilter) => void;
    showKanbanSettings?: boolean;
    onKanbanSettingsClick?: (evt: MouseEvent) => void;
  }

  let {
    selectedFilter = 'memory',
    onMenuClick,
    onFilterSelect,
    showKanbanSettings = false,
    onKanbanSettingsClick
  }: Props = $props();

  function handleMenuClick(evt: MouseEvent) {
    onMenuClick(evt);
  }

  function handleFilterSelect(filter: DeckFilter) {
    if (onFilterSelect) {
      onFilterSelect(filter);
    }
  }

  function handleKanbanSettingsClick(evt: MouseEvent) {
    onKanbanSettingsClick?.(evt);
  }
</script>

<header class="mobile-deck-study-header">
  <!-- 左侧：菜单按钮 - 使用 Obsidian 原生图标 -->
  <button
    class="mobile-menu-trigger"
    onclick={handleMenuClick}
    aria-label="打开菜单"
  >
    <ObsidianIcon name="menu" size={18} />
  </button>

  <!-- 中间：复用桌面端的CategoryFilter组件 -->
  <div class="mobile-category-filter">
    <CategoryFilter
      {selectedFilter}
      onSelect={handleFilterSelect}
    />
  </div>

  <!-- 右侧：看板列设置（仅在看板视图显示） -->
  {#if showKanbanSettings}
    <button
      class="mobile-kanban-settings"
      onclick={handleKanbanSettingsClick}
      aria-label="看板列设置"
    >
      <ObsidianIcon name="sliders" size={18} />
    </button>
  {:else}
    <div class="mobile-header-spacer"></div>
  {/if}
</header>

<style>
  .mobile-deck-study-header {
    display: none; /* 默认隐藏，仅在移动端显示 */
  }

  /* 移动端显示 */
  :global(body.is-mobile) .mobile-deck-study-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px; /* 🔧 减少水平内边距，让内容更贴近边框 */
    background: var(--background-primary); /* 🔧 使用内容区背景色，消除色差 */
    border-bottom: none; /* 🔧 移除底部边框，无缝融合 */
    flex-shrink: 0;
  }

  .mobile-menu-trigger {
    width: 44px; /* 🆕 增加到 44px 满足 Apple HIG 触控标准 */
    height: 44px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--interactive-normal); /* 🆕 使用 Obsidian 颜色令牌 */
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .mobile-menu-trigger:hover {
    background: var(--interactive-hover);
    color: var(--interactive-hover);
  }

  .mobile-menu-trigger:active {
    background: var(--interactive-active);
    color: var(--text-on-accent);
  }

  .mobile-category-filter {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  /* 右侧占位符（牌组学习界面无搜索按钮时使用） */
  .mobile-header-spacer {
    width: 44px; /* 🆕 匹配菜单按钮宽度，保持布局平衡 */
    flex-shrink: 0;
  }

  .mobile-kanban-settings {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--interactive-normal);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .mobile-kanban-settings:hover {
    background: var(--interactive-hover);
    color: var(--interactive-hover);
  }

  .mobile-kanban-settings:active {
    background: var(--interactive-active);
    color: var(--text-on-accent);
  }
</style>
