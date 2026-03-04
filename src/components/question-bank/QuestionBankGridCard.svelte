<script lang="ts">
  import type { Deck } from '../../data/types';
  import type { ColorScheme, CardState } from '../../config/card-color-schemes';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface QuestionBankStats {
    total: number;      // 总题数
    completed: number;  // 已练题数
    accuracy: number;   // 正确率 (0-100)
    errorCount: number; // 错题数
  }

  interface Props {
    bank: Deck;
    stats: QuestionBankStats;
    colorScheme: ColorScheme;
    onTest: () => void;
    onMenu: (event: MouseEvent) => void;
  }

  let { bank, stats, colorScheme, onTest, onMenu }: Props = $props();

  // 根据题库状态计算卡片状态
  const cardState = $derived.by<CardState>(() => {
    if (stats.total === 0) return 'completed';
    
    // 已完成且正确率高
    if (stats.completed === stats.total && stats.accuracy >= 80) {
      return 'completed';
    }
    
    // 正确率低于60%且已练习超过50% → 需要重点复习
    if (stats.completed > 0 && stats.accuracy < 60 && stats.completed > stats.total * 0.5) {
      return 'urgent';
    }
    
    // 有未完成的题目 → 待练习状态
    if (stats.completed < stats.total) {
      return 'normal';
    }
    
    return 'normal';
  });

  // 获取当前状态的配色
  const currentColorConfig = $derived(colorScheme[cardState]);

  // 生成卡片主区域样式
  const mainStyle = $derived(`background: ${currentColorConfig.gradient}; color: ${currentColorConfig.textColor};`);

  // 生成信息条样式
  const infoBarStyle = $derived(`background: ${colorScheme.infoBar.background}; color: ${colorScheme.infoBar.textColor};`);

  // 根据正确率获取颜色（保留以便未来可能的用途）
  function getAccuracyColor(accuracy: number): string {
    if (accuracy === 0) return 'rgba(156, 163, 175, 0.8)'; // 灰色
    if (accuracy < 60) return '#ef4444'; // 红色
    if (accuracy < 80) return '#f97316'; // 橙色
    return '#22c55e'; // 绿色
  }

  // 处理点击事件
  function handleClick() {
    if (stats.total > 0) {
      onTest();
    }
  }

  // 处理右键菜单
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    onMenu(event);
  }

  // 处理菜单按钮点击
  function handleMenuClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onMenu(event);
  }

  // 处理键盘事件
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && stats.total > 0) {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<div 
  class="question-bank-grid-card"
  class:empty={stats.total === 0}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
  aria-label="{bank.name} - 总题{stats.total}, 已练{stats.completed}, 正确率{stats.accuracy.toFixed(0)}%"
>
  <!-- 上方主区域：题库名 -->
  <div class="card-main" style={mainStyle}>
    <!-- 微妙的光效层 -->
    <div class="light-effect"></div>
    
    <!-- 右上角菜单按钮 -->
    <button 
      class="menu-btn"
      onclick={handleMenuClick}
      aria-label="更多操作"
      title="更多操作"
    >
      <EnhancedIcon name="more-horizontal" size={16} />
    </button>
    
    <div class="bank-title">
      {bank.name}
    </div>

    <!-- 空题库标记 -->
    {#if stats.total === 0}
      <div class="empty-badge">空题库</div>
    {/if}
  </div>

  <!-- 下方信息条 -->
  <div class="card-info-bar" style={infoBarStyle}>
    <!-- 左侧：正确率 -->
    <div class="info-left">
      {#if stats.completed > 0}
        <div class="accuracy-display">
          {stats.accuracy.toFixed(0)}%
        </div>
      {/if}
    </div>

    <!-- 中间：统计数字（标签在前，数字在后） -->
    <div class="info-center">
      <div class="stat-item">
        <span class="stat-label">总题</span>
        <span class="stat-number">{stats.total}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已练</span>
        <span class="stat-number">{stats.completed}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">错题</span>
        <span class="stat-number">{stats.errorCount}</span>
      </div>
    </div>

    <!-- 右侧：占位（保持布局平衡） -->
    <div class="info-right">
    </div>
  </div>
</div>

<style>
  .question-bank-grid-card {
    height: 220px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }

  .question-bank-grid-card.empty {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .question-bank-grid-card:not(.empty):hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    filter: brightness(1.05);
  }

  .question-bank-grid-card:not(.empty):active {
    transform: translateY(-2px);
  }

  /* 上方主区域：题库名 */
  .card-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    position: relative;
    overflow: hidden;
  }

  /* 微妙的光效层 */
  .light-effect {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at 30% 20%,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 60%
    );
    pointer-events: none;
  }

  /* 右上角菜单按钮 */
  .menu-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.15);
    color: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s;
    opacity: 0;
  }

  .question-bank-grid-card:hover .menu-btn {
    opacity: 1;
  }

  .menu-btn:hover {
    background: rgba(0, 0, 0, 0.25);
    color: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  .menu-btn:active {
    transform: scale(0.95);
  }

  /* 移动端：始终显示菜单按钮 */
  @media (max-width: 768px) {
    .menu-btn {
      opacity: 1;
    }
  }

  .bank-title {
    font-family: 'Playfair Display', 'Noto Serif SC', serif;
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    line-height: 1.3;
    position: relative;
    z-index: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    word-break: break-word;
  }

  /* 空题库标记 */
  .empty-badge {
    position: absolute;
    bottom: 16px;
    right: 16px;
    padding: 4px 12px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 600;
    backdrop-filter: blur(8px);
  }

  /* 下方信息条 */
  .card-info-bar {
    height: 52px;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    font-size: 13px;
    font-weight: 500;
  }

  .info-left {
    display: flex;
    align-items: center;
    min-width: 60px;
  }

  /* 信息条内的正确率显示 - 统一黑白色设计 */
  .accuracy-display {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.08);
    color: var(--text-normal);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .info-center {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    justify-content: center;
  }

  .stat-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .stat-label {
    font-size: 12px;
    opacity: 0.8;
  }

  .stat-number {
    font-weight: 600;
    font-size: 16px;
  }

  .info-right {
    display: flex;
    align-items: center;
    min-width: 60px;
    justify-content: flex-end;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .question-bank-grid-card {
      height: 200px;
    }

    .bank-title {
      font-size: 20px;
    }

    .card-info-bar {
      height: 48px;
      padding: 0 16px;
      font-size: 12px;
    }

    .stat-number {
      font-size: 14px;
    }

    .info-center {
      gap: 8px;
    }

    .stat-label {
      font-size: 10px;
    }
  }
</style>
