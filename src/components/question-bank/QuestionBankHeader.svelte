<script lang="ts">
  import { onMount } from 'svelte';
  import { Platform } from 'obsidian';
  import EnhancedButton from "../ui/EnhancedButton.svelte";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import FlipClock from "./FlipClock.svelte";

  interface Props {
    bankName: string;
    currentIndex: number;
    totalQuestions: number;
    statsCollapsed: boolean;
    showSidebar: boolean;
    showNavigator?: boolean; // 🆕 导航栏显示状态
    showStatsBar?: boolean; //  答题情况信息栏显示状态
    onToggleStats: () => void;
    onToggleSidebar: () => void;
    onToggleNavigator?: () => void; // 🆕 切换导航栏
    onToggleStatsBar?: () => void; //  切换答题情况信息栏
    onShowMobileMenu?: () => void; //  显示移动端多功能菜单
    onClose: () => void;
    // 🆕 倒计时相关
    mode?: 'practice' | 'exam' | 'quiz';
    remainingTime?: number;
    isPaused?: boolean;
    isTimeWarning?: boolean;
    onTogglePause?: () => void;
  }

  let {
    bankName,
    currentIndex,
    totalQuestions,
    statsCollapsed,
    showSidebar,
    showNavigator = true,
    showStatsBar = false,
    onToggleStats,
    onToggleSidebar,
    onToggleNavigator,
    onToggleStatsBar,
    onShowMobileMenu,
    onClose,
    mode = 'exam',
    remainingTime = 0,
    isPaused = false,
    isTimeWarning = false,
    onTogglePause
  }: Props = $props();

  //  移动端检测
  const isMobile = Platform.isMobile;

</script>

<!--  移动端：完全隐藏自定义顶部栏，所有功能按钮移到 Obsidian 原生顶部栏 -->
{#if !isMobile}
<!--  桌面端头部工具栏 -->
<div class="study-header">
  <div class="header-left">
    <h2 class="study-title">{bankName || '考试测试'}</h2>
    <div class="study-progress">
      <span class="progress-text">{currentIndex} / {totalQuestions}</span>
    </div>
    
    <!-- 🆕 翻页时钟 -->
    {#if mode === 'exam' || mode === 'quiz'}
      <div class="clock-container">
        <FlipClock 
          remainingTime={Math.floor(remainingTime / 1000)}
          {isPaused} 
          {isTimeWarning} 
        />
        
        <!-- 暂停按钮 -->
        {#if onTogglePause}
          <button class="pause-btn" onclick={onTogglePause} title={isPaused ? '继续' : '暂停'}>
            <EnhancedIcon name={isPaused ? 'play' : 'pause'} size={14} />
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 中间：多彩彩色圆点（复用主界面设计） -->
  <div class="header-center">
    <div class="header-dots-container">
      <span class="header-dot" style="background: linear-gradient(135deg, #ef4444, #dc2626)" title="增量阅读"></span>
      <span class="header-dot" style="background: linear-gradient(135deg, #3b82f6, #2563eb)" title="记忆牌组"></span>
      <span class="header-dot" style="background: linear-gradient(135deg, #10b981, #059669)" title="考试牌组"></span>
    </div>
  </div>

  <div class="header-right">
    <EnhancedButton
      variant="ghost"
      onclick={onToggleStats}
      ariaLabel={statsCollapsed ? "展开统计" : "收起统计"}
      class="weave-topbar-btn"
    >
      <EnhancedIcon name={statsCollapsed ? "chevron-down" : "chevron-up"} size="18" />
    </EnhancedButton>

    <EnhancedButton
      variant="ghost"
      onclick={onToggleSidebar}
      ariaLabel={showSidebar ? "隐藏侧边栏" : "显示侧边栏"}
      class="weave-topbar-btn"
    >
      <EnhancedIcon name={showSidebar ? "sidebar-close" : "sidebar-open"} size="18" />
    </EnhancedButton>

    <EnhancedButton variant="ghost" onclick={onClose} ariaLabel="关闭" class="weave-topbar-btn">
      <EnhancedIcon name="times" size="18" />
    </EnhancedButton>
  </div>
</div>
{/if}

<style>
  .study-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
    position: relative;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex: 1;
  }

  .study-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-normal);
    margin: 0;
  }

  .study-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }


  .progress-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 600;
    min-width: 60px;
  }

  .header-center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: auto;
  }

  .header-dots-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }

  .header-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .header-dot:hover {
    transform: scale(1.25);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* 桌面端不进行布局重排，头部始终水平 */
  /* 移动端布局由 :global(body.is-mobile) 控制 */

  /* ==================== 翻页时钟容器 ==================== */
  .clock-container {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    margin-right: 2rem;
  }

  /* 暂停按钮 */
  .pause-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
    color: #3b82f6;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pause-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .pause-btn:active {
    transform: scale(0.95);
  }

</style>

