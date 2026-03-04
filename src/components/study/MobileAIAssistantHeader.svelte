<script lang="ts">
  /**
   * 移动端 AI 助手头部组件
   * 
   * AI 助手界面的移动端顶部导航栏
   * - 左侧：菜单按钮（☰）- 与牌组学习界面一致
   * - 中间：标题
   * - 右侧：配置按钮
   * 
   * @module components/study/MobileAIAssistantHeader
   * @version 1.0.0
   */
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  interface Props {
    onMenuClick: (evt: MouseEvent) => void;
    onConfigClick: () => void;
  }

  let { onMenuClick, onConfigClick }: Props = $props();
</script>

<header class="mobile-ai-assistant-header">
  <!-- 左侧：菜单按钮 - 与牌组学习界面一致 -->
  <button
    class="mobile-menu-trigger"
    onclick={onMenuClick}
    aria-label="打开菜单"
  >
    <ObsidianIcon name="menu" size={18} />
  </button>

  <!-- 中间：标题 -->
  <div class="mobile-header-title">
    <ObsidianIcon name="bot" size={20} />
    <span>AI 助手</span>
  </div>

  <!-- 右侧：配置按钮 -->
  <button
    class="mobile-config-btn"
    onclick={onConfigClick}
    aria-label="配置"
  >
    <ObsidianIcon name="settings" size={18} />
  </button>
</header>

<style>
  .mobile-ai-assistant-header {
    display: none; /* 默认隐藏，仅在移动端显示 */
  }

  /* 移动端显示 */
  :global(body.is-mobile) .mobile-ai-assistant-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px;
    background: var(--background-primary); /* 与内容区一致，消除色差 */
    border-bottom: none; /* 无缝融合 */
    flex-shrink: 0;
  }

  .mobile-menu-trigger {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--interactive-normal);
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .mobile-menu-trigger:hover {
    background: var(--interactive-hover);
  }

  .mobile-menu-trigger:active {
    background: var(--interactive-active);
    color: var(--text-on-accent);
  }

  .mobile-header-title {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .mobile-config-btn {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .mobile-config-btn:hover {
    background: var(--interactive-hover);
  }

  .mobile-config-btn:active {
    background: var(--interactive-active);
    color: var(--text-on-accent);
  }
</style>
