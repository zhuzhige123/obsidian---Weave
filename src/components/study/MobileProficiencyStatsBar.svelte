<script lang="ts">
  /**
   * 移动端学习进度统计栏组件
   * 
   * 显示牌组级别的卡片数量统计：新卡片、学习中、复习
   * 与 MobileStatsInfoBar (FSRS信息栏) 互斥展开
   * 
   * @module components/study/MobileProficiencyStatsBar
   * @version 1.0.0
   */

  interface DeckStats {
    newCards: number;      // 新卡片数量
    learningCards: number; // 学习中卡片数量
    reviewCards: number;   // 复习卡片数量
  }

  interface Props {
    /** 是否展开 */
    expanded: boolean;
    /** 牌组统计数据 */
    stats: DeckStats;
  }

  let {
    expanded = false,
    stats = {
      newCards: 0,
      learningCards: 0,
      reviewCards: 0
    }
  }: Props = $props();

  // 计算总数
  let totalCards = $derived(stats.newCards + stats.learningCards + stats.reviewCards);
</script>

{#if expanded}
  <div class="mobile-proficiency-stats-bar">
    <div class="proficiency-stats-items">
      <div class="proficiency-stats-item new-cards">
        <span class="proficiency-stats-value">{stats.newCards}</span>
        <span class="proficiency-stats-label">新卡片</span>
      </div>
      <div class="proficiency-stats-item learning-cards">
        <span class="proficiency-stats-value">{stats.learningCards}</span>
        <span class="proficiency-stats-label">学习中</span>
      </div>
      <div class="proficiency-stats-item review-cards">
        <span class="proficiency-stats-value">{stats.reviewCards}</span>
        <span class="proficiency-stats-label">复习</span>
      </div>
      <div class="proficiency-stats-item total-cards">
        <span class="proficiency-stats-value">{totalCards}</span>
        <span class="proficiency-stats-label">总计</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .mobile-proficiency-stats-bar {
    display: flex;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .proficiency-stats-items {
    display: flex;
    justify-content: space-around;
    width: 100%;
    gap: 8px;
  }

  .proficiency-stats-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex: 1;
  }

  .proficiency-stats-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-normal);
  }

  .proficiency-stats-label {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* 不同类型卡片的颜色区分 */
  .new-cards .proficiency-stats-value {
    color: var(--weave-info, #60a5fa);
  }

  .learning-cards .proficiency-stats-value {
    color: var(--weave-warning, #fbbf24);
  }

  .review-cards .proficiency-stats-value {
    color: var(--weave-success, #34d399);
  }

  .total-cards .proficiency-stats-value {
    color: var(--text-muted);
  }
</style>
