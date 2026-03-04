<script lang="ts">
  /**
   * IRNoBlocksAvailableModal - 增量阅读队列为空时的选择模态窗
   * 
   * 参考 NoCardsAvailableModal 设计风格
   * 提供选项：提前学习、前往记忆牌组、返回
   */
  import { onMount } from 'svelte';
  import WavingDots from '../celebration/WavingDots.svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  
  interface IRDeckStats {
    totalBlocks: number;
    dueToday: number;
    dueWithinDays: number;
    learnAheadDays?: number;
  }
  
  interface Props {
    deckName: string;
    stats?: IRDeckStats;
    onClose: () => void;
    onAdvanceReading?: () => void;
    onGoToMemoryDeck?: () => void;
  }
  
  let { 
    deckName,
    stats,
    onClose,
    onAdvanceReading,
    onGoToMemoryDeck
  }: Props = $props();
  
  // 动画状态
  let showContent = $state(false);
  
  // 计算可提前阅读的块数
  const advanceableBlocks = $derived(() => {
    if (!stats) return 0;
    return Math.max(0, stats.dueWithinDays - stats.dueToday);
  });
  
  onMount(() => {
    // 延迟显示内容（等待动画）
    setTimeout(() => {
      showContent = true;
    }, 300);
    
  });
</script>

<div 
  class="ir-no-blocks-backdrop"
  onclick={() => { if (typeof onClose === 'function') onClose(); }}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (typeof onClose === 'function') onClose(); } }}
  role="button"
  tabindex="0"
  aria-label="关闭提示窗口"
>
  <div 
    class="ir-no-blocks-card"
    class:show={showContent}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-labelledby="ir-no-blocks-title"
    aria-modal="true"
  >
    <!-- 主标题 -->
    <h2 id="ir-no-blocks-title" class="ir-no-blocks-title">
      今日阅读任务已完成
    </h2>
    
    <!-- 波浪圆点动画 -->
    <div class="dots-container">
      <WavingDots />
    </div>
    
    <!-- 牌组信息 -->
    <div class="deck-info">
      <EnhancedIcon name="book-open" size={18} />
      <span class="deck-name">{deckName}</span>
    </div>
    
    <!-- 统计信息卡片 -->
    {#if stats}
    <div class="stats-card">
      <div class="stats-header">
        <span class="stats-title">阅读统计</span>
      </div>
      
      <div class="stats-list">
        <div class="stat-row">
          <span class="stat-label">总内容块</span>
          <span class="stat-value">{stats.totalBlocks}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">今日到期</span>
          <span class="stat-value highlight-done">已完成</span>
        </div>
        {#if advanceableBlocks() > 0}
        <div class="stat-row">
          <span class="stat-label">可提前阅读{stats.learnAheadDays ? ` (≤${stats.learnAheadDays}天)` : ''}</span>
          <span class="stat-value highlight-advance">{advanceableBlocks()} 块</span>
        </div>
        {/if}
      </div>
    </div>
    {/if}
    
    <!-- 操作按钮组 -->
    <div class="action-buttons-row">
      <button class="btn-compact btn-tertiary" onclick={onClose}>
        <EnhancedIcon name="x" size={14} />
        <span>返回</span>
      </button>
      
      {#if onGoToMemoryDeck}
      <button class="btn-compact btn-secondary" onclick={onGoToMemoryDeck}>
        <EnhancedIcon name="layers" size={14} />
        <span>记忆牌组</span>
      </button>
      {/if}
      
      {#if onAdvanceReading && advanceableBlocks() > 0}
      <button class="btn-compact btn-primary" onclick={onAdvanceReading}>
        <EnhancedIcon name="fast-forward" size={14} />
        <span>提前阅读</span>
      </button>
      {/if}
    </div>
  </div>
</div>

<style>
  /* 背景遮罩 */
  .ir-no-blocks-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-notice);
    padding: 20px;
    animation: backdrop-fade-in 0.3s ease-out;
    overflow: auto;
  }

  @keyframes backdrop-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 内容卡片 */
  .ir-no-blocks-card {
    position: relative;
    max-width: 480px;
    width: 100%;
    background: var(--background-primary);
    border-radius: 16px;
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    padding: 32px 28px;
    opacity: 0;
    transform: scale(0.9);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    z-index: calc(var(--layer-notice) + 1);
  }

  .ir-no-blocks-card.show {
    opacity: 1;
    transform: scale(1);
  }

  /* 主标题 */
  .ir-no-blocks-title {
    font-size: 22px;
    font-weight: 600;
    color: var(--text-normal);
    text-align: center;
    margin: 0 0 20px 0;
    line-height: 1.4;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: title-slide-up 0.5s ease-out 0.4s both;
  }

  @keyframes title-slide-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 圆点容器 */
  .dots-container {
    margin: 0 0 20px 0;
    animation: dots-fade-in 0.5s ease-out 0.5s both;
  }

  @keyframes dots-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 牌组信息 */
  .deck-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
    animation: deck-fade-in 0.5s ease-out 0.55s both;
  }

  @keyframes deck-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .deck-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 统计信息卡片 */
  .stats-card {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    animation: stats-slide-up 0.5s ease-out 0.6s both;
  }

  @keyframes stats-slide-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .stats-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .stats-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--background-modifier-border-hover);
    transition: background 0.15s ease;
  }

  .stat-row:last-child {
    border-bottom: none;
  }

  .stat-row:hover {
    background: var(--background-primary-alt);
  }

  .stat-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .stat-value {
    font-size: 14px;
    color: var(--text-normal);
    font-weight: 600;
  }

  .stat-value.highlight-done {
    color: #10b981;
  }

  .stat-value.highlight-advance {
    color: #8b5cf6;
  }

  /* 操作按钮组 - 同一行紧凑显示 */
  .action-buttons-row {
    display: flex;
    gap: 10px;
    justify-content: center;
    animation: buttons-fade-in 0.5s ease-out 0.8s both;
  }

  @keyframes buttons-fade-in {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .btn-compact {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-compact.btn-tertiary {
    background: var(--background-secondary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
  }

  .btn-compact.btn-tertiary:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .btn-compact.btn-secondary {
    background: var(--interactive-accent);
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  .btn-compact.btn-secondary:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
    filter: brightness(1.1);
  }

  .btn-compact.btn-primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
  }

  .btn-compact.btn-primary:hover {
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
    filter: brightness(1.05);
  }

  .btn-compact:active {
    transform: scale(0.98);
  }

  /* 响应式 - 移动端优化 */
  @media (max-width: 600px) {
    .ir-no-blocks-card {
      padding: 24px 20px;
      margin: 12px;
      max-width: calc(100% - 24px);
    }

    .ir-no-blocks-title {
      font-size: 18px;
      margin-bottom: 16px;
    }

    .dots-container {
      margin-bottom: 16px;
    }

    .deck-info {
      margin-bottom: 16px;
    }

    .deck-name {
      font-size: 14px;
    }

    .stats-card {
      padding: 12px;
      margin-bottom: 12px;
    }

    .stats-header {
      margin-bottom: 8px;
    }

    .stat-row {
      padding: 8px 12px;
    }

    .stat-label {
      font-size: 12px;
    }

    .stat-value {
      font-size: 13px;
    }

    .action-buttons-row {
      gap: 8px;
      flex-wrap: nowrap;
    }

    .btn-compact {
      padding: 10px 12px;
      font-size: 12px;
      gap: 4px;
    }
  }

  /* 超小屏幕 */
  @media (max-width: 360px) {
    .btn-compact {
      padding: 8px 10px;
      font-size: 11px;
    }
  }
</style>
