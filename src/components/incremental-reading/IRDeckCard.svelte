<script lang="ts">
  /**
   * 增量阅读牌组卡片组件
   * 
   * 专为增量阅读设计，显示：
   * - 未读：新的内容块（state === 'new'）
   * - 待读：算法推荐的到期内容块（dueToday）
   * - 提问：内容块中带复选框+问号的统计
   * - 右侧：已完成提问百分比
   * 
   * @version 2.4.0
   */
  import type { IRDeck, IRDeckStats } from '../../types/ir-types';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface Props {
    deck: IRDeck;
    stats: IRDeckStats;
    colorVariant?: 1 | 2 | 3 | 4;
    compact?: boolean;
    onStudy: () => void;
    onMenu: (event: MouseEvent) => void;
  }

  let {
    deck,
    stats,
    colorVariant = 1,
    compact = false,
    onStudy,
    onMenu
  }: Props = $props();

  // 根据牌组ID生成稳定的颜色变体
  const stableColorVariant = $derived(() => {
    if (colorVariant) return colorVariant;
    let hash = 0;
    const id = deck.id || deck.path || '';
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return ((Math.abs(hash) % 4) + 1) as 1 | 2 | 3 | 4;
  });

  const loadRatePercent = $derived(() => {
    const v = stats.loadRatePercent;
    if (typeof v !== 'number' || Number.isNaN(v)) return 0;
    return Math.max(0, Math.min(v, 999));
  });

  const loadRateClass = $derived(() => {
    const p = loadRatePercent();
    if (p < 50) return 'low';
    if (p < 80) return 'normal';
    if (p < 120) return 'high';
    return 'overload';
  });

  // 触摸追踪变量
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 10;

  function handleClick() {
    onStudy();
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    if (deltaX > SWIPE_THRESHOLD || deltaY > SWIPE_THRESHOLD) {
      return;
    }
    
    event.preventDefault();
    onStudy();
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    onMenu(event);
  }

  function handleMenuClick(event: MouseEvent) {
    event.stopPropagation();
    onMenu(event);
  }

  function handleMenuTouchEnd(event: TouchEvent) {
    event.stopPropagation();
    event.preventDefault();
    const touch = event.changedTouches[0];
    const mouseEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: false
    });
    onMenu(mouseEvent);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<div 
  class="ir-deck-card variant-{stableColorVariant()}"
  class:compact
  onclick={handleClick}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  onkeydown={handleKeyDown}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
  aria-label="打开牌组 {deck.name}"
>
  <!-- 宣纸纹理层 -->
  <div class="texture-overlay"></div>
  
  <!-- 微光效果层 -->
  <div class="light-effect"></div>
  
  <!-- 右上角菜单按钮 -->
  <button 
    class="menu-btn"
    onclick={handleMenuClick}
    ontouchend={handleMenuTouchEnd}
    aria-label="更多操作"
    title="更多操作"
  >
    <EnhancedIcon name="more-horizontal" size={16} />
  </button>
  
  <!-- 内容区域 -->
  <div class="card-content">
    <!-- 牌组标题 -->
    <div class="card-title">
      {deck.name || '未命名牌组'}
    </div>

    <!-- 底部区域：统计+百分比 -->
    <div class="card-footer">
      <!-- 左侧统计信息栏：未读=今日到期，待读=可提前阅读的增量（N天内到期 - 今日到期） -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">未读</span>
          <span class="stat-value">{stats.dueToday}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">待读</span>
          <span class="stat-value">{Math.max(0, (stats.dueWithinDays ?? stats.dueToday) - stats.dueToday)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">提问</span>
          <span class="stat-value">{stats.questionCount}</span>
        </div>
      </div>
      
      <div class="question-progress" title="负载率(未来3天峰值)">
        <div class="progress-ring">
          <svg viewBox="0 0 36 36" class="circular-chart">
            <path class="circle-bg"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path class="circle {loadRateClass()}"
              stroke-dasharray="{Math.min(loadRatePercent(), 100)}, 100"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span class="percentage-text">{loadRatePercent()}%</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .ir-deck-card {
    position: relative;
    height: 220px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }

  .ir-deck-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }

  .ir-deck-card:active {
    transform: translateY(-2px);
  }

  /* 深色系渐变变体 */
  .variant-1 {
    background: linear-gradient(135deg, #2d3654 0%, #1e2438 100%);
  }

  .variant-2 {
    background: linear-gradient(145deg, #3d4560 0%, #2a3248 100%);
  }

  .variant-3 {
    background: linear-gradient(135deg, #1a4a42 0%, #0c2e28 100%);
  }

  .variant-4 {
    background: linear-gradient(135deg, #1e3048 0%, #0f1e30 100%);
  }

  /* 微妙纹理层 */
  .texture-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 1;
    pointer-events: none;
    z-index: 1;
    mix-blend-mode: overlay;
  }

  /* 微光效果层 */
  .light-effect {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, 
      rgba(255, 255, 255, 0.08) 0%, 
      rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
    z-index: 1;
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
    background: rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s;
    opacity: 0;
  }

  .ir-deck-card:hover .menu-btn {
    opacity: 1;
  }

  .menu-btn:hover {
    background: rgba(0, 0, 0, 0.35);
    color: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  .menu-btn:active {
    transform: scale(0.95);
  }

  /* 内容区域 */
  .card-content {
    position: relative;
    z-index: 3;
    padding: 20px 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* 牌组标题 */
  .card-title {
    font-family: var(--font-interface), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 24px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: 0.5px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    line-height: 1.35;
    word-break: break-word;
    text-align: left;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* 底部区域 */
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  /* 底部统计信息栏 */
  .stats-bar {
    display: flex;
    gap: 20px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 400;
  }

  .stat-value {
    font-weight: 600;
    font-family: var(--font-interface), -apple-system, sans-serif;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.95);
  }

  /* 提问完成百分比 */
  .question-progress {
    display: flex;
    align-items: center;
  }

  .progress-ring {
    position: relative;
    width: 48px;
    height: 48px;
  }

  .circular-chart {
    display: block;
    width: 100%;
    height: 100%;
  }

  .circle-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.15);
    stroke-width: 3;
  }

  .circle {
    fill: none;
    stroke: rgba(255, 255, 255, 0.9);
    stroke-width: 3;
    stroke-linecap: round;
    animation: progress 1s ease-out forwards;
  }

  .circle.low {
    stroke: #51cf66;
  }

  .circle.normal {
    stroke: #4dabf7;
  }

  .circle.high {
    stroke: #ffd43b;
  }

  .circle.overload {
    stroke: #ff6b6b;
  }

  @keyframes progress {
    0% {
      stroke-dasharray: 0 100;
    }
  }

  .percentage-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  /* 紧凑模式 */
  .ir-deck-card.compact {
    height: 160px;
  }

  .compact .card-title {
    font-size: 20px;
  }

  .compact .card-content {
    padding: 16px 20px;
  }

  .compact .stats-bar {
    gap: 16px;
  }

  .compact .stat-label {
    font-size: 11px;
  }

  .compact .stat-value {
    font-size: 14px;
  }

  .compact .progress-ring {
    width: 40px;
    height: 40px;
  }

  .compact .percentage-text {
    font-size: 10px;
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .ir-deck-card {
      height: 200px;
    }

    .card-title {
      font-size: 22px;
    }

    .card-content {
      padding: 20px 24px;
    }

    .stats-bar {
      gap: 18px;
    }

    .stat-label {
      font-size: 12px;
    }

    .stat-value {
      font-size: 15px;
    }

    .menu-btn {
      opacity: 1;
    }

    .progress-ring {
      width: 44px;
      height: 44px;
    }
  }

  /* 大屏幕优化 */
  @media (min-width: 1400px) {
    .ir-deck-card {
      height: 240px;
    }

    .card-title {
      font-size: 26px;
    }

    .card-content {
      padding: 24px 28px;
    }

    .stat-value {
      font-size: 18px;
    }

    .progress-ring {
      width: 52px;
      height: 52px;
    }

    .percentage-text {
      font-size: 12px;
    }
  }
</style>
