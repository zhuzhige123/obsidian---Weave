<script lang="ts">
  /**
   * 移动端卡片管理头部组件
   *
   * Part B: 卡片管理界面的移动端顶部导航栏
   * - 左侧：菜单按钮（☰）- 使用 Obsidian 原生图标，与牌组学习界面一致
   * - 中间：视图切换圆点（表格、网格、看板）
   * - 右侧：搜索按钮（🔍）
   *
   * @module components/study/MobileCardManagementHeader
   * @version 1.3.0 - 🆕 改为视图切换，与桌面端统一
   * @requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5
   */
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  // 🆕 视图类型
  export type CardViewType = 'table' | 'grid' | 'kanban';

  interface Props {
    currentView?: CardViewType;
    onMenuClick: (evt: MouseEvent) => void;
    onSearchClick: () => void;
    onViewChange?: (view: CardViewType) => void;
  }

  let {
    currentView = 'table',
    onMenuClick,
    onSearchClick,
    onViewChange
  }: Props = $props();

  // 🆕 视图配置（与桌面端统一）
  const viewTypes = [
    { id: 'table' as CardViewType, name: '表格视图', colorStart: '#ef4444', colorEnd: '#dc2626' },
    { id: 'grid' as CardViewType, name: '网格视图', colorStart: '#3b82f6', colorEnd: '#2563eb' },
    { id: 'kanban' as CardViewType, name: '看板视图', colorStart: '#10b981', colorEnd: '#059669' }
  ];

  function handleMenuClick(evt: MouseEvent) {
    onMenuClick(evt);
  }

  function handleDotClick(viewId: CardViewType) {
    if (onViewChange) {
      onViewChange(viewId);
    }
  }

  function getGradientStyle(colorStart: string, colorEnd: string): string {
    return `background: linear-gradient(135deg, ${colorStart}, ${colorEnd})`;
  }
</script>

<header class="mobile-card-management-header">
  <!-- 左侧：菜单按钮 - 使用 Obsidian 原生图标，与牌组学习界面一致 -->
  <button
    class="mobile-menu-trigger"
    onclick={handleMenuClick}
    aria-label="打开菜单"
  >
    <ObsidianIcon name="menu" size={18} />
  </button>

  <!-- 🆕 中间：视图切换圆点（与桌面端统一） -->
  <div class="mobile-view-switcher">
    {#each viewTypes as viewType}
      <button
        class="view-type-dot"
        class:selected={currentView === viewType.id}
        style={getGradientStyle(viewType.colorStart, viewType.colorEnd)}
        onclick={() => handleDotClick(viewType.id)}
        ontouchend={(e) => { e.preventDefault(); handleDotClick(viewType.id); }}
        aria-label={viewType.name}
        title={viewType.name}
      >
        {#if currentView === viewType.id}
          <span class="selected-indicator"></span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- 右侧：搜索按钮 -->
  <button
    class="mobile-search-btn"
    onclick={onSearchClick}
    aria-label="搜索卡片"
  >
    <ObsidianIcon name="search" size={16} />
  </button>
</header>

<style>
  .mobile-card-management-header {
    display: none; /* 默认隐藏，仅在移动端显示 */
  }

  /* 移动端显示 */
  :global(body.is-mobile) .mobile-card-management-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px; /* 🔧 与牌组学习界面一致 */
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
    /* 📱 Obsidian clickable-icon 风格：完全透明，无边框无阴影 */
    background: transparent;
    border: none;
    box-shadow: none;
    outline: none;
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

  .mobile-view-switcher {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }

  .view-type-dot {
    position: relative;
    width: 20px; /* 🔧 与 CategoryFilter 保持一致 */
    height: 20px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    padding: 0;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .view-type-dot::before {
    content: '';
    position: absolute;
    top: -12px;
    left: -12px;
    right: -12px;
    bottom: -12px;
    border-radius: 50%;
  }

  .view-type-dot:hover {
    transform: scale(1.25);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }

  .view-type-dot:active {
    transform: scale(1.15);
  }

  .view-type-dot.selected {
    transform: scale(1.35);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  }

  .view-type-dot.selected::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.6);
    opacity: 0.6;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.3;
    }
  }

  .selected-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .mobile-search-btn {
    width: 44px; /* 🆕 与菜单按钮一致 */
    height: 44px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* 📱 Obsidian clickable-icon 风格：完全透明，无边框无阴影 */
    background: transparent;
    border: none;
    box-shadow: none;
    outline: none;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .mobile-search-btn:hover {
    background: var(--interactive-hover);
  }

  .mobile-search-btn:active {
    background: var(--interactive-active);
    color: var(--text-on-accent);
  }
</style>
