<script lang="ts">
  import { onMount } from 'svelte';
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import type { IconName } from "../../icons/index.js";
  //  导入国际化系统
  import { tr } from "../../utils/i18n";

  interface TabItem {
    id: string;
    label: string;  //  可以是i18n键或直接文本（向后兼容）
    icon?: IconName;
    badge?: number | string;
    disabled?: boolean;
    tooltip?: string;
  }

  interface Props {
    items: TabItem[];
    activeId: string;
    onChange: (id: string) => void;
    variant?: 'default' | 'pills' | 'underline' | 'compact';
    size?: 'sm' | 'md' | 'lg';
    orientation?: 'horizontal' | 'vertical';
    fullWidth?: boolean;
    animated?: boolean;
  }

  let {
    items,
    activeId,
    onChange,
    variant = 'default',
    size = 'md',
    orientation = 'horizontal',
    fullWidth = false,
    animated = true
  }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);

  // 计算当前活动标签的索引
  let activeIndex = $derived(items.findIndex(item => item.id === activeId));

  // 计算指示器位置和大小
  let indicatorStyle = $derived.by(() => {
    if (!animated || activeIndex === -1) return '';
    
    if (orientation === 'horizontal') {
      const width = 100 / items.length;
      const translateX = activeIndex * 100;
      return `transform: translateX(${translateX}%); width: ${width}%;`;
    } else {
      const height = 100 / items.length;
      const translateY = activeIndex * 100;
      return `transform: translateY(${translateY}%); height: ${height}%;`;
    }
  });

  function handleTabClick(item: TabItem) {
    if (item.disabled) return;
    onChange(item.id);
  }

  function handleKeyDown(event: KeyboardEvent, item: TabItem) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabClick(item);
    }
  }

  // touch swipe support for mobile
  let tabsEl: HTMLDivElement | undefined = $state(undefined);
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isScrolling = false;

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isScrolling = false;
  }

  function handleTouchMove(e: TouchEvent) {
    if (isScrolling) return;
    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartY);
    // if vertical movement exceeds 15px, treat as scroll not swipe
    if (deltaY > 15) {
      isScrolling = true;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (isScrolling) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;

    // swipe validation: >80px horizontal, strict angle (<22deg), 100-800ms duration
    if (
      Math.abs(deltaX) > 80 &&
      Math.abs(deltaY) < Math.abs(deltaX) * 0.4 &&
      elapsed > 100 && elapsed < 800
    ) {
      const currentIndex = items.findIndex(item => item.id === activeId);
      if (currentIndex === -1) return;

      if (deltaX < 0 && currentIndex < items.length - 1) {
        // swipe left -> next tab
        const next = items.slice(currentIndex + 1).find(i => !i.disabled);
        if (next) {
          onChange(next.id);
          scrollTabIntoView(next.id);
        }
      } else if (deltaX > 0 && currentIndex > 0) {
        // swipe right -> previous tab
        const prev = items.slice(0, currentIndex).reverse().find(i => !i.disabled);
        if (prev) {
          onChange(prev.id);
          scrollTabIntoView(prev.id);
        }
      }
    }
  }

  function scrollTabIntoView(tabId: string) {
    if (!tabsEl) return;
    requestAnimationFrame(() => {
      const tabButton = tabsEl?.querySelector(`[aria-selected="true"]`) as HTMLElement;
      if (tabButton) {
        tabButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  // scroll active tab into view on mount
  onMount(() => {
    scrollTabIntoView(activeId);
  });
</script>

<div
  class="weave-tabs weave-tabs-{variant} weave-tabs-{size} weave-tabs-{orientation}"
  class:weave-tabs-full={fullWidth}
  class:weave-tabs-animated={animated}
  role="tablist"
  aria-orientation={orientation}
  bind:this={tabsEl}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  {#each items as item, index}
    <button
      role="tab"
      tabindex={item.disabled ? undefined : 0}
      aria-selected={activeId === item.id}
      aria-disabled={item.disabled}
      class="weave-tab"
      class:active={activeId === item.id}
      class:disabled={item.disabled}
      onclick={() => handleTabClick(item)}
      onkeydown={(e) => handleKeyDown(e, item)}
      title={item.tooltip}
    >
      {#if item.icon}
        <div class="weave-tab-icon">
          <EnhancedIcon
            name={item.icon}
            size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16}
          />
          {#if item.badge}
            <span class="weave-tab-badge">{item.badge}</span>
          {/if}
        </div>
      {/if}

      <span class="weave-tab-label">{t(item.label)}</span>

      {#if item.badge && !item.icon}
        <span class="weave-tab-badge weave-tab-badge-standalone">{item.badge}</span>
      {/if}
    </button>
  {/each}

  <!-- 活动指示器 -->
  {#if animated && variant === 'underline'}
    <div
      class="weave-tab-indicator"
      style={indicatorStyle}
    ></div>
  {/if}

  <!-- 占位器（用于某些布局） -->
  {#if !fullWidth && orientation === 'horizontal'}
    <div class="weave-tabs-spacer"></div>
  {/if}
</div>

<style>
  .weave-tabs {
    display: flex;
    position: relative;
    background: var(--background-secondary);
    border-radius: var(--radius-m, 0.5rem);
    padding: 0.25rem;
    gap: 0.125rem;
    transition: all 0.2s ease;
  }

  .weave-tabs-vertical {
    flex-direction: column;
    width: fit-content;
  }

  .weave-tabs-horizontal {
    flex-direction: row;
  }

  .weave-tabs-full {
    width: 100%;
  }

  .weave-tabs-full .weave-tab {
    flex: 1;
  }

  /* 尺寸变体 */
  .weave-tabs-sm {
    padding: 0.125rem;
    gap: 0.0625rem;
  }

  .weave-tabs-lg {
    padding: 0.375rem;
    gap: 0.25rem;
  }

  /* 样式变体 */
  .weave-tabs-pills {
    background: transparent;
    gap: 0.5rem;
    padding: 0;
  }

  .weave-tabs-underline {
    background: transparent;
    border-bottom: 1px solid var(--background-modifier-border);
    border-radius: 0;
    padding: 0;
    gap: 0;
  }

  .weave-tabs-compact {
    padding: 0.125rem;
    gap: 0.0625rem;
  }

  /* 标签按钮 */
  .weave-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border: none;
    border-radius: var(--radius-s, 0.375rem);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: var(--font-interface);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    position: relative;
    z-index: 1;
  }

  .weave-tab:hover:not(.disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    transform: translateY(-1px);
  }

  .weave-tab:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .weave-tab.active {
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-2, #6366f1));
    color: white;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
  }

  .weave-tab.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* 尺寸变体的标签 */
  .weave-tabs-sm .weave-tab {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    gap: 0.375rem;
  }

  .weave-tabs-lg .weave-tab {
    padding: 0.75rem 1.125rem;
    font-size: 1rem;
    gap: 0.625rem;
  }

  /* Pills 变体 */
  .weave-tabs-pills .weave-tab {
    border-radius: var(--radius-l, 0.75rem);
    border: 1px solid var(--background-modifier-border);
  }

  .weave-tabs-pills .weave-tab.active {
    border-color: var(--color-accent);
  }

  /* Underline 变体 */
  .weave-tabs-underline .weave-tab {
    border-radius: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    padding-bottom: 0.75rem;
  }

  .weave-tabs-underline .weave-tab:hover:not(.disabled) {
    background: var(--background-modifier-hover);
    border-bottom-color: var(--text-muted);
  }

  .weave-tabs-underline .weave-tab.active {
    background: transparent;
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
    box-shadow: none;
  }

  /* Compact 变体 */
  .weave-tabs-compact .weave-tab {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    gap: 0.25rem;
  }

  /* 图标和标签 */
  .weave-tab-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .weave-tab-label {
    flex-shrink: 0;
  }

  /* 徽章 */
  .weave-tab-badge {
    position: absolute;
    top: -6px;
    right: -8px;
    background: var(--weave-error);
    color: var(--weave-text-on-accent);
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-l, 0.75rem);
    line-height: 1;
    min-width: 1rem;
    text-align: center;
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  }

  .weave-tab-badge-standalone {
    position: static;
    margin-left: 0.375rem;
  }

  .weave-tab.active .weave-tab-badge {
    background: var(--weave-text-on-accent);
    color: var(--color-accent);
  }

  /* 活动指示器（用于 underline 变体） */
  .weave-tab-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--color-accent);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 1px 1px 0 0;
  }

  /* 占位器 */
  .weave-tabs-spacer {
    flex: 1;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .weave-tabs-horizontal {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .weave-tabs-horizontal::-webkit-scrollbar {
      display: none;
    }

    .weave-tab {
      flex-shrink: 0;
    }

    .weave-tabs-sm .weave-tab {
      padding: 0.25rem 0.5rem;
    }

    .weave-tabs-lg .weave-tab {
      padding: 0.5rem 0.875rem;
    }
  }

  @media (max-width: 480px) {
    /* 移动端：保持标签名称可见，使用水平滚动 */
    .weave-tabs-horizontal {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 2px; /* 防止滚动条遮挡指示器 */
    }

    .weave-tabs-horizontal::-webkit-scrollbar {
      display: none;
    }

    .weave-tab {
      flex-shrink: 0;
      padding: 0.375rem 0.625rem;
      font-size: 0.8125rem;
      min-width: auto;
    }

    .weave-tab-label {
      display: inline; /* 保持标签名称可见 */
      font-size: 0.75rem;
    }

    .weave-tab-icon :global(svg) {
      width: 14px;
      height: 14px;
    }

    /* 仅在极小屏幕（320px以下）隐藏标签名称 */
    @media (max-width: 320px) {
      .weave-tab-label {
        display: none;
      }

      .weave-tab {
        min-width: 2.5rem;
        justify-content: center;
        padding: 0.375rem 0.5rem;
      }
    }
  }

  /* 动画优化 */
  @media (prefers-reduced-motion: reduce) {
    .weave-tab,
    .weave-tab-indicator {
      transition: none;
    }
  }

  /* 高对比度模式 */
  @media (prefers-contrast: high) {
    .weave-tab.active {
      border: 2px solid var(--color-accent);
    }

    .weave-tabs-underline .weave-tab.active {
      border-bottom-width: 3px;
    }
  }

  /* Obsidian mobile: ensure horizontal scroll on tab bar */
  :global(body.is-mobile) .weave-tabs-horizontal {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }

  :global(body.is-mobile) .weave-tabs-horizontal::-webkit-scrollbar {
    display: none;
  }

  :global(body.is-mobile) .weave-tabs-horizontal .weave-tab {
    flex-shrink: 0;
  }

  :global(body.is-phone) .weave-tabs-horizontal .weave-tab {
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
  }

  :global(body.is-phone) .weave-tabs-horizontal .weave-tab-label {
    font-size: 0.75rem;
  }
</style>
