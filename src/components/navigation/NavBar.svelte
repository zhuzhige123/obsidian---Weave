<script lang="ts">
  import EnhancedButton from "../ui/EnhancedButton.svelte";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import { ICON_NAMES, type IconName } from "../../icons/index.js";
  //  导入国际化
  import { tr } from '../../utils/i18n';


  interface NavItem {
    id: string;
    label: string;
    icon: IconName;
    badge?: number | string;
    description?: string;
  }

  interface PageAction {
    id: string;
    label: string;
    icon: IconName;
    onClick: (event: MouseEvent) => void;
    variant?: 'primary' | 'secondary';
    badge?: number; // 🆕 角标数字
  }

  interface Props {
    items: NavItem[];
    currentPage: string;
    responsive?: any; // 响应式状态
    showSettingsButton?: boolean; // 是否显示设置按钮
    pageActions?: PageAction[]; // 页面特定的操作按钮
    collapsed?: boolean; // 🆕 折叠状态
    onNavbarEnter?: () => void; // 🆕 鼠标进入导航栏
    onNavbarLeave?: () => void; // 🆕 鼠标离开导航栏
    onNavigate?: (pageId: string) => void; // 🆕 导航事件回调
    onSettings?: () => void; // 🆕 设置按钮回调
  }

  let { items, currentPage, responsive, showSettingsButton = false, pageActions = [], collapsed = false, onNavbarEnter, onNavbarLeave, onNavigate, onSettings }: Props = $props();

  //  响应式翻译函数
  let t = $derived($tr);

  function handleNavigate(pageId: string) {
    onNavigate?.(pageId);
  }

  function handleSettings() {
    onSettings?.();
  }


</script>

<nav 
  class="anki-navbar"
  class:collapsed={collapsed}
  onmouseenter={onNavbarEnter}
  onmouseleave={onNavbarLeave}
>
  <div class="anki-nav-container">
    <!-- 左侧占位区域 -->
    <div class="nav-spacer"></div>

    <!-- 主导航菜单（居中） -->
    <div class="anki-nav-menu">
      {#each items as item}
        <button
          class="anki-nav-item"
          class:active={currentPage === item.id}
          onclick={() => handleNavigate(item.id)}
          aria-label={item.description}
        >
          <div class="anki-nav-icon">
            <EnhancedIcon name={item.icon} />
            {#if item.badge}
              <span class="anki-nav-badge">{item.badge}</span>
            {/if}
          </div>
          <span class="anki-nav-label">{t(item.label)}</span>
        </button>
      {/each}
    </div>

    <!-- 右侧操作区域 -->
    <div class="anki-nav-actions">
      <!-- 页面特定功能键 -->
      {#each pageActions as action}
        <div class="nav-action-wrapper">
          <button
            class="anki-nav-action-item page-action"
            class:primary={action.variant === 'primary'}
            onclick={(e) => action.onClick(e)}
            aria-label={action.label}
            title={action.label}
          >
            <EnhancedIcon name={action.icon} />
          </button>
          {#if action.badge && action.badge > 0}
            <span class="nav-action-badge">{action.badge}</span>
          {/if}
        </div>
      {/each}

      {#if showSettingsButton}
        <button
          class="anki-nav-action-item"
          class:active={currentPage === "settings"}
          onclick={handleSettings}
          aria-label={t('navbar.openSettings')}
          title={t('navbar.settings')}
        >
          <EnhancedIcon name={ICON_NAMES.SETTINGS} />
        </button>
      {/if}
    </div>
  </div>
</nav>

<style>
  /* 导航栏主容器 - 使用统一设计令牌 */
  .anki-navbar {
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
    position: fixed; /* 🆕 改为 fixed，不占用文档流空间 */
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateY(0);
    opacity: 1;
  }

  /* 🆕 折叠状态 - 完全移出视口 */
  .anki-navbar.collapsed {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none; /* 折叠时不响应鼠标事件 */
  }

  .anki-nav-container {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0.75rem 1.5rem;
    min-height: 3.5rem;
    max-width: 1400px;
    margin: 0 auto;
    gap: 1rem;
    position: relative;
  }

  /* 主导航菜单 - 统一面板样式 */
  .anki-nav-menu {
    display: flex;
    gap: 0.25rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem;
    padding: 0.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* 导航项样式 - 统一按钮设计令牌 */
  .anki-nav-item {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    min-height: 2.5rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: var(--font-interface);
    line-height: 1.2;
    user-select: none;
  }

  .anki-nav-item:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .anki-nav-item.active {
    background: var(--weave-accent-color, var(--color-accent));
    color: white;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
    transform: translateY(-1px);
  }

  /* 导航图标 - 统一图标样式 */
  .anki-nav-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  /* 徽章样式 - 统一通知样式 */
  .anki-nav-badge {
    position: absolute;
    top: -4px;
    right: -6px;
    background: var(--text-error, #ef4444);
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.125rem 0.25rem;
    border-radius: 0.5rem;
    line-height: 1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    min-width: 1rem;
    text-align: center;
  }

  /* 导航标签 - 统一文本样式 */
  .anki-nav-label {
    white-space: nowrap;
    opacity: 0.9;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .anki-nav-item.active .anki-nav-label {
    opacity: 1;
    font-weight: 600;
  }

  /* 响应式设计 - 统一断点和间距 */
  @media (max-width: 768px) {
    .anki-nav-container {
      padding: 0.5rem 1rem;
      gap: 0.75rem;
    }

    .anki-nav-menu {
      gap: 0.125rem;
      padding: 0.25rem;
    }

    .anki-nav-item {
      min-width: 3rem;
      padding: 0.5rem 0.625rem;
      gap: 0.375rem;
    }

    .anki-nav-label {
      font-size: 0.75rem;
    }
  }

  /* 小屏幕优化 - 统一移动端体验 */
  @media (max-width: 480px) {
    .anki-nav-container {
      padding: 0.5rem;
    }

    .anki-nav-menu {
      padding: 0.125rem;
      gap: 0.125rem;
    }

    .anki-nav-item {
      min-height: 2.5rem;
      min-width: 2.5rem;
      padding: 0.5rem;
      justify-content: center;
    }

    .anki-nav-item .anki-nav-label {
      display: none;
    }

    .anki-nav-icon {
      width: 20px;
      height: 20px;
    }
  }

  /* 动画优化 - 统一动画控制 */
  @media (prefers-reduced-motion: reduce) {
    .anki-nav-item,
    .anki-navbar {
      transition: none;
    }
  }

  /* 右侧操作区域样式 */
  .anki-nav-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  
  /* 🆕 操作按钮包装器 */
  .nav-action-wrapper {
    position: relative;
    display: inline-flex;
  }
  
  /* 🆕 操作按钮角标 */
  .nav-action-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--color-red);
    color: white;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    pointer-events: none;
  }

  /* 左侧占位区域 - 用于平衡布局，确保导航菜单居中 */

  .anki-nav-action-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1rem;
    user-select: none;
  }

  .anki-nav-action-item:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .anki-nav-action-item.active {
    background: var(--color-accent);
    color: var(--text-on-accent);
    border-color: var(--color-accent);
  }

  .anki-nav-action-item.active:hover {
    background: var(--color-accent-hover, var(--color-accent));
    transform: translateY(-1px);
  }

  /* 页面特定功能键样式 */
  .anki-nav-action-item.page-action {
    margin-right: 0.25rem;
  }

  .anki-nav-action-item.page-action.primary {
    background: var(--weave-accent-color, var(--color-accent));
    color: white;
    border-color: var(--weave-accent-color, var(--color-accent));
  }

  .anki-nav-action-item.page-action.primary:hover {
    background: var(--weave-accent-hover, var(--color-accent-hover));
    transform: translateY(-1px);
  }

  /* 深色模式优化 */
  @media (prefers-color-scheme: dark) {
    .anki-nav-menu {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .anki-nav-action-item {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }

  /* 🆕 动画优化 - 支持减少动画偏好 */
  @media (prefers-reduced-motion: reduce) {
    .anki-navbar {
      transition: none;
    }

    .anki-navbar.collapsed {
      display: none; /* 直接隐藏，不使用动画 */
    }
  }
</style>
