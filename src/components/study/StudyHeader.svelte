<script lang="ts">
  import EnhancedButton from "../ui/EnhancedButton.svelte";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import StudyProgressBar from "./StudyProgressBar.svelte";
  import type { WeaveDataStorage } from "../../data/storage";
  import type { StudySession } from "../../data/study-types";
  import type { Card } from "../../data/types";
  import { onMount } from "svelte";

  interface Props {
    currentDeckName: string;
    currentIndexDisplay: number;
    cardsLength: number;
    statsCollapsed: boolean;
    sourceInfoCollapsed?: boolean;
    showSidebar: boolean;
    session: StudySession;
    dataStorage: WeaveDataStorage;
    progressBarRefreshTrigger: number;
    // 🆕 v2.0: 引用式牌组架构 - 多牌组引用信息
    referencedDecks?: Array<{ id: string; name: string }>;
    //  v2.3: 可选的卡片数组，作为进度条的备用数据源
    cards?: Card[];
    onToggleStats: () => void;
    onToggleSourceInfo?: () => void;
    onToggleSidebar: () => void;
    onClose: () => void;
  }

  let {
    currentDeckName,
    currentIndexDisplay,
    cardsLength,
    statsCollapsed,
    sourceInfoCollapsed = false,
    showSidebar,
    session,
    dataStorage,
    progressBarRefreshTrigger,
    referencedDecks = [],
    cards,
    onToggleStats,
    onToggleSourceInfo = () => {},
    onToggleSidebar,
    onClose
  }: Props = $props();

  // 🆕 v2.0: 是否显示多牌组引用标识
  let hasMultipleReferences = $derived(referencedDecks.length > 1);

  // 🆕 检测是否为移动端（Obsidian 移动端会添加 is-phone 或 is-mobile 类）
  let isMobile = $state(false);
  
  onMount(() => {
    isMobile = document.body.classList.contains('is-phone') || document.body.classList.contains('is-mobile');
  });
</script>

<!-- 头部工具栏 -->
<!--  移动端完全隐藏自定义顶部栏，所有功能按钮已移到 Obsidian 原生顶部栏 -->
{#if !isMobile}
<div class="study-header">
  <!--  桌面端布局 -->
  <div class="header-left">
    <div class="deck-info">
      <h2 class="study-title">{currentDeckName || '学习'}</h2>
      {#if hasMultipleReferences}
        <span class="multi-deck-badge" title="此卡片被多个牌组引用: {referencedDecks.map(d => d.name).join(', ')}">
          +{referencedDecks.length - 1}
        </span>
      {/if}
    </div>
    <div class="study-progress">
      <StudyProgressBar deckId={session.deckId} {dataStorage} refreshTrigger={progressBarRefreshTrigger} {cards} />
      <span class="progress-text">{currentIndexDisplay} / {cardsLength}</span>
    </div>
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
    <!-- 来源信息栏展开/收起按钮 -->
    <EnhancedButton
      variant="ghost"
      onclick={onToggleSourceInfo}
      ariaLabel={sourceInfoCollapsed ? "展开来源信息" : "收起来源信息"}
      class="weave-topbar-btn source-info-toggle-btn"
    >
      <EnhancedIcon name={sourceInfoCollapsed ? "book-open" : "book-open"} size="18" />
    </EnhancedButton>

    <!-- 统计展开/收起按钮 -->
    <EnhancedButton
      variant="ghost"
      onclick={onToggleStats}
      ariaLabel={statsCollapsed ? "展开统计" : "收起统计"}
      class="weave-topbar-btn stats-toggle-btn"
    >
      <EnhancedIcon name={statsCollapsed ? "chevron-down" : "chevron-up"} size="18" />
    </EnhancedButton>

    <!-- 侧边栏切换按钮 -->
    <EnhancedButton
      variant="ghost"
      onclick={onToggleSidebar}
      ariaLabel={showSidebar ? "隐藏侧边栏" : "显示侧边栏"}
      class="weave-topbar-btn sidebar-toggle-btn"
    >
      <EnhancedIcon name={showSidebar ? "sidebar-close" : "sidebar-open"} size="18" />
    </EnhancedButton>

    <!-- 关闭按钮 -->
    <EnhancedButton variant="ghost" onclick={onClose} ariaLabel="关闭" class="weave-topbar-btn close-btn">
      <EnhancedIcon name="times" size="18" />
    </EnhancedButton>
  </div>
</div>
{/if}

<style>
  /* 头部工具栏 */
  .study-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
    border-radius: var(--weave-radius-lg, 8px) var(--weave-radius-lg, 8px) 0 0;
    position: relative;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex: 1;
  }

  /* 🆕 v2.0: 牌组信息容器 */
  .deck-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .study-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-normal);
    margin: 0;
  }

  /* 🆕 v2.0: 多牌组引用标识 */
  .multi-deck-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-accent);
    background: var(--background-modifier-hover);
    border-radius: var(--weave-radius-sm, 4px);
    cursor: help;
    transition: background 0.2s ease;
  }

  .multi-deck-badge:hover {
    background: var(--background-modifier-active-hover);
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
    flex-shrink: 0;
  }

  /* ==================== Obsidian 移动端适配 ==================== */
  /*  移动端完全隐藏自定义顶部栏，所有功能按钮已移到 Obsidian 原生顶部栏 */
  
  /* 平板端：保持桌面端布局 */
  :global(body.is-tablet) .study-header {
    flex-direction: row;
    padding: 0.75rem 1rem;
  }

  :global(body.is-tablet) .header-left {
    flex-direction: row;
    gap: 1rem;
  }
</style>
