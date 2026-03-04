<script lang="ts">
  /**
   * 导航栏折叠控制组件
   * 
   * 功能：
   * - 桌面端：顶部感应区，鼠标移入展开，完全移出后收起
   * - 移动端/平板端：角标式按钮，触控友好
   * 
   * 防误触设计：
   * - 展开延迟：100ms
   * - 收起延迟：500ms（确保用户可以点击导航项）
   */

  import { onMount, onDestroy } from 'svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import { tr } from '../../utils/i18n';

  interface Props {
    collapsed: boolean;
    onToggle: (collapsed: boolean) => void;
    onSensorEnter?: () => void; // 🆕 桌面端感应区进入事件
    responsive?: {
      isMobile: boolean;
      isTablet: boolean;
      isDesktop: boolean;
    };
  }

  let { collapsed = $bindable(false), onToggle, onSensorEnter, responsive }: Props = $props();

  // 是否为桌面端（使用顶部感应区）
  let isDesktop = $derived(responsive?.isDesktop ?? true);
  
  //  响应式翻译函数
  let t = $derived($tr);

  // 移动端/平板端：点击切换
  function handleButtonClick() {
    collapsed = !collapsed;
    onToggle?.(collapsed);
  }
</script>

{#if isDesktop}
  <!-- 桌面端：顶部感应区 -->
  <div 
    class="navbar-sensor-area"
    onmouseenter={onSensorEnter}
    role="button"
    tabindex="-1"
    aria-label={t('navbar.expand')}
  >
    {#if collapsed}
      <div class="sensor-indicator">
        <EnhancedIcon name="chevron-down" size={12} />
        <span>{t('navbar.collapseHint')}</span>
      </div>
    {/if}
  </div>
{:else}
  <!-- 移动端/平板端：角标式按钮 -->
  <button
    class="navbar-corner-button"
    class:collapsed={collapsed}
    onclick={handleButtonClick}
    aria-label={collapsed ? t('navbar.expand') : t('navbar.collapse')}
    aria-pressed={!collapsed}
  >
    <EnhancedIcon name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} />
  </button>
{/if}

<style>
  /* ========================================
     桌面端：顶部感应区
     ======================================== */
  
  .navbar-sensor-area {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 12px;
    background: transparent;
    cursor: pointer;
    z-index: 200; /* 高于导航栏 */
    transition: background 0.2s ease;
  }

  .navbar-sensor-area:hover {
    background: linear-gradient(
      to bottom, 
      var(--interactive-accent-hover, var(--interactive-accent)) 0%,
      transparent 100%
    );
  }

  .sensor-indicator {
    position: absolute;
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-on-accent);
    opacity: 0;
    transition: opacity 0.2s ease;
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .navbar-sensor-area:hover .sensor-indicator {
    opacity: 0.9;
  }

  /* ========================================
     移动端/平板端：角标式按钮
     ======================================== */
  
  .navbar-corner-button {
    position: fixed;
    top: 0;
    left: 0;
    width: 48px;
    height: 48px;
    background: var(--interactive-accent, var(--color-accent));
    border: none;
    border-radius: 0 0 24px 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    padding: 10px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 200; /* 高于导航栏 */
    color: var(--text-on-accent);
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.2);
    -webkit-tap-highlight-color: transparent; /* 移除移动端点击高亮 */
  }

  .navbar-corner-button:hover,
  .navbar-corner-button:active {
    width: 56px;
    height: 56px;
    border-radius: 0 0 28px 0;
    background: var(--interactive-accent-hover, var(--interactive-accent));
    box-shadow: 3px 3px 12px rgba(0, 0, 0, 0.25);
  }

  .navbar-corner-button:active {
    transform: scale(0.95);
  }

  /* 收起状态时的动画 */
  .navbar-corner-button.collapsed {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* ========================================
     无障碍和动画优化
     ======================================== */
  
  @media (prefers-reduced-motion: reduce) {
    .navbar-sensor-area,
    .navbar-corner-button {
      transition: none;
    }

    .navbar-corner-button.collapsed {
      animation: none;
    }
  }

  /* 触摸屏设备优化 */
  @media (pointer: coarse) {
    .navbar-corner-button {
      /* 确保足够的触控区域 */
      min-width: 44px;
      min-height: 44px;
    }
  }

  /* 高对比度模式支持 */
  @media (prefers-contrast: high) {
    .navbar-corner-button {
      border: 2px solid var(--text-on-accent);
    }
  }
</style>

