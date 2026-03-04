<script lang="ts">
  /**
   * 移动端统计信息栏组件
   * 
   * Part A Task 5.4: 可折叠的统计信息栏
   * 显示：保持率、复习次数、卡片数、学习时间
   * 
   * @module components/study/MobileStatsInfoBar
   * @version 1.0.0
   */

  interface StatsData {
    retentionRate: number;  // 保持率 (0-100)
    reviewCount: number;    // 复习次数
    cardCount: number;      // 卡片数
    studyTime: string;      // 学习时间（格式化字符串）
  }

  interface Props {
    /** 是否展开 */
    expanded: boolean;
    /** 统计数据 */
    stats: StatsData;
  }

  let {
    expanded = false,
    stats = {
      retentionRate: 0,
      reviewCount: 0,
      cardCount: 0,
      studyTime: '0h'
    }
  }: Props = $props();
</script>

{#if expanded}
  <div class="mobile-stats-info-bar">
    <div class="stats-info-items">
      <div class="stats-info-item">
        <span class="stats-info-value">{stats.retentionRate}%</span>
        <span class="stats-info-label">保持率</span>
      </div>
      <div class="stats-info-item">
        <span class="stats-info-value">{stats.reviewCount}</span>
        <span class="stats-info-label">复习</span>
      </div>
      <div class="stats-info-item">
        <span class="stats-info-value">{stats.cardCount}</span>
        <span class="stats-info-label">卡片</span>
      </div>
      <div class="stats-info-item">
        <span class="stats-info-value">{stats.studyTime}</span>
        <span class="stats-info-label">时间</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .mobile-stats-info-bar {
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

  .stats-info-items {
    display: flex;
    justify-content: space-around;
    width: 100%;
    gap: 8px;
  }

  .stats-info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stats-info-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--weave-mobile-primary-color, #a78bfa);
  }

  .stats-info-label {
    font-size: 10px;
    color: var(--text-muted);
  }
</style>
