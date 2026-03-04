<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    newCards: number;
    learningCards: number;
    reviewCards: number;
    totalCards: number;
    memoryRate: number;
    deckName: string;
    todayStudyTime?: number;
    todayReviewed?: number;
    position: { x: number; y: number };
    onClose: () => void;
  }

  let { 
    newCards, 
    learningCards, 
    reviewCards, 
    totalCards, 
    memoryRate, 
    deckName, 
    todayStudyTime = 0, 
    todayReviewed = 0,
    position, 
    onClose 
  }: Props = $props();

  let popoverElement: HTMLDivElement;
  let adjustedPosition = $state({ x: position.x, y: position.y });

  // 计算已掌握卡片数
  const masteredCards = $derived(totalCards - (newCards + learningCards + reviewCards));

  // 格式化学习时长
  const formattedStudyTime = $derived(() => {
    if (todayStudyTime === 0) return '0分钟';
    const minutes = Math.floor(todayStudyTime / 60);
    if (minutes === 0) return '< 1分钟';
    return `${minutes}分钟`;
  });

  // 🆕 将 popover 移动到 body，并调整位置
  onMount(() => {
    if (popoverElement) {
      //  将 popover 移动到 document.body，确保 fixed 定位正常工作
      document.body.appendChild(popoverElement);
      
      const rect = popoverElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // 精细边界检测
      // 确保浮窗完全在视口内，但保持在触发点附近
      
      // 右边界检测：如果超出右边界，往左调整
      if (x + rect.width > viewportWidth - 20) {
        x = Math.max(20, viewportWidth - rect.width - 20);
      }

      // 左边界检测：确保不超出左边界
      if (x < 20) {
        x = 20;
      }

      // 底部边界检测：如果超出底部，显示在触发点上方
      if (y + rect.height > viewportHeight - 20) {
        // 尝试显示在上方
        const yAbove = position.y - rect.height - 16;
        if (yAbove >= 20) {
          y = yAbove;
        } else {
          // 上方也不够，强制在可视范围内（底部对齐）
          y = Math.max(20, viewportHeight - rect.height - 20);
        }
      }

      // 顶部边界检测
      if (y < 20) {
        y = 20;
      }

      adjustedPosition = { x, y };
    }
  });
  
  // 清理：从 body 移除
  onDestroy(() => {
    if (popoverElement && popoverElement.parentNode === document.body) {
      document.body.removeChild(popoverElement);
    }
  });

  // 点击外部关闭
  function handleClickOutside(event: MouseEvent) {
    if (popoverElement && !popoverElement.contains(event.target as Node)) {
      onClose();
    }
  }

  function handleKeydown(_event: KeyboardEvent) {
  }

  onMount(() => {
    // 延迟绑定事件，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('keydown', handleKeydown);
    }, 100);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div 
  class="deck-stats-popover"
  bind:this={popoverElement}
  style:left="{adjustedPosition.x}px"
  style:top="{adjustedPosition.y}px"
  role="dialog"
  aria-label="牌组统计信息"
>
  <!-- 标题栏 -->
  <div class="popover-header">
    <span class="popover-title">{deckName}</span>
    <button 
      class="close-btn"
      onclick={onClose}
      aria-label="关闭"
      title="关闭 (Esc)"
    >
      ×
    </button>
  </div>

  <!-- 统计列表 -->
  <div class="stats-list">
    <!-- 新卡片 -->
    <div class="stat-row">
      <div class="stat-left">
        <span class="stat-icon">[N]</span>
        <span class="stat-label">新卡片</span>
      </div>
      <div class="stat-right">
        <span class="stat-count">{newCards}张</span>
      </div>
    </div>

    <!-- 学习中 -->
    <div class="stat-row">
      <div class="stat-left">
        <span class="stat-icon">[L]</span>
        <span class="stat-label">学习中</span>
      </div>
      <div class="stat-right">
        <span class="stat-count">{learningCards}张</span>
      </div>
    </div>

    <!-- 待复习 -->
    <div class="stat-row">
      <div class="stat-left">
        <span class="stat-icon">[W]</span>
        <span class="stat-label">待复习</span>
      </div>
      <div class="stat-right">
        <span class="stat-count">{reviewCards}张</span>
      </div>
    </div>

    <!-- 已掌握 -->
    <div class="stat-row">
      <div class="stat-left">
        <span class="stat-icon">[M]</span>
        <span class="stat-label">已掌握</span>
      </div>
      <div class="stat-right">
        <span class="stat-count">{masteredCards}张</span>
      </div>
    </div>
  </div>

  <!-- 分隔线 -->
  <div class="divider"></div>

  <!-- 附加信息 -->
  <div class="extra-info">
    <div class="info-row">
      <span class="info-icon">[R]</span>
      <span class="info-label">记忆率</span>
      <span class="info-value">{Math.round(memoryRate * 100)}%</span>
    </div>
    <div class="info-row">
      <span class="info-icon">[T]</span>
      <span class="info-label">今日学习</span>
      <span class="info-value">{formattedStudyTime()} / {todayReviewed}张</span>
    </div>
  </div>
</div>

<style>
  .deck-stats-popover {
    position: fixed;
    min-width: 280px;
    max-width: min(320px, calc(100vw - 40px)); /* 🆕 响应式最大宽度 */
    width: max-content;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: 0;
    z-index: var(--weave-z-top);
    animation: popover-bounce-in 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  }
  
  /* 🆕 极窄视口适配 */
  @media (max-width: 360px) {
    .deck-stats-popover {
      min-width: calc(100vw - 40px);
      max-width: calc(100vw - 40px);
    }
  }

  @keyframes popover-bounce-in {
    0% {
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
    }
    60% {
      transform: translateY(3px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* 标题栏 */
  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 12px 12px 0 0;
  }

  .popover-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 统计列表 */
  .stats-list {
    padding: 4px 0;
  }

  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    transition: background 0.2s;
  }

  .stat-row:hover {
    background: var(--background-modifier-hover);
  }

  .stat-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat-icon {
    font-size: 18px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  }

  .stat-label {
    font-size: 13px;
    color: var(--text-muted);
  }

  .stat-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-count {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-normal);
  }


  /* 分隔线 */
  .divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 8px 16px;
  }

  /* 附加信息 */
  .extra-info {
    padding: 8px 0 12px 0;
  }

  .info-row {
    display: flex;
    align-items: center;
    padding: 6px 16px;
    gap: 8px;
  }

  .info-icon {
    font-size: 16px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  }

  .info-label {
    font-size: 13px;
    color: var(--text-muted);
    flex: 1;
  }

  .info-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .deck-stats-popover {
      min-width: 260px;
      max-width: 300px;
    }

    .stat-icon {
      font-size: 16px;
    }

    .stat-label,
    .info-label {
      font-size: 12px;
    }

    .stat-count {
      font-size: 13px;
    }
  }
</style>

