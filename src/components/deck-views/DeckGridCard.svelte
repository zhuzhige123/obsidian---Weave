<script lang="ts">
  import type { Deck, DeckStats } from '../../data/types';
  import type { ColorScheme, CardState } from '../../config/card-color-schemes';
  import { getCardState } from '../../config/card-color-schemes';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  //  导入国际化
  import { tr } from '../../utils/i18n';

  interface Props {
    deck: Deck;
    stats: DeckStats;
    colorScheme: ColorScheme;
    deckMode?: 'memory' | 'question-bank' | 'incremental-reading';
    onStudy: () => void;
    onMenu: (event: MouseEvent) => void;
  }

  let { deck, stats, colorScheme, deckMode = 'memory', onStudy, onMenu }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);

  // 根据牌组模式返回不同的统计标签
  const statLabels = $derived.by(() => {
    switch (deckMode) {
      case 'incremental-reading':
        return { first: '未读', second: '待读', third: '提问' };
      case 'question-bank':
        return { first: '总题', second: '已练', third: '错题' };
      default:
        return { first: t('decks.card.new'), second: t('decks.card.learning'), third: t('decks.card.review') };
    }
  });

  // 计算卡片状态
  const cardState = $derived<CardState>(
    getCardState(stats.newCards, stats.learningCards, stats.reviewCards)
  );

  // 获取当前状态的配色
  const currentColorConfig = $derived(colorScheme[cardState]);

  // 生成卡片主区域样式
  const mainStyle = $derived(() => {
    return `background: ${currentColorConfig.gradient}; color: ${currentColorConfig.textColor};`;
  });

  // 生成信息条样式
  const infoBarStyle = $derived(() => {
    return `background: ${colorScheme.infoBar.background}; color: ${colorScheme.infoBar.textColor};`;
  });

  // 触摸追踪变量（用于区分点击和滑动）
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 10; // 移动超过10px视为滑动

  // 处理点击事件
  function handleClick() {
    onStudy();
  }

  // 处理触摸开始（记录起始位置）
  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  // 处理触摸事件（移动端优化）
  function handleTouchEnd(event: TouchEvent) {
    // 检测是否为滑动操作
    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // 如果移动距离超过阈值，视为滑动，不触发学习
    if (deltaX > SWIPE_THRESHOLD || deltaY > SWIPE_THRESHOLD) {
      return;
    }
    
    // 防止触发 onclick 导致双重调用
    event.preventDefault();
    onStudy();
  }

  // 处理右键菜单
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    onMenu(event);
  }

  // 处理菜单按钮点击
  function handleMenuClick(event: MouseEvent) {
    event.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击
    onMenu(event);
  }

  // 处理菜单按钮触摸（移动端）
  function handleMenuTouchEnd(event: TouchEvent) {
    event.stopPropagation(); // 阻止事件冒泡到父元素
    event.preventDefault();
    // 创建一个模拟的 MouseEvent 传递给 onMenu
    const touch = event.changedTouches[0];
    const mouseEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: false
    });
    onMenu(mouseEvent);
  }

  // 处理键盘事件
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<div 
  class="deck-grid-card"
  onclick={handleClick}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  onkeydown={handleKeyDown}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
  aria-label={t('decks.card.ariaLabel').replace('{name}', deck.name)}
>
  <!-- 上方主区域：牌组名 -->
  <div class="card-main" style={mainStyle()}>
    <!-- 微妙的光效层 -->
    <div class="light-effect"></div>
    
    <!-- 🆕 右上角菜单按钮 -->
    <button 
      class="menu-btn"
      onclick={handleMenuClick}
      ontouchend={handleMenuTouchEnd}
      aria-label="更多操作"
      title="更多操作"
    >
      <EnhancedIcon name="more-horizontal" size={16} />
    </button>
    
    <div class="deck-title">
      {deck.name}
    </div>
  </div>

  <!-- 下方信息条 -->
  <div class="card-info-bar" style={infoBarStyle()}>
    <!-- 中间：统计数字 -->
    <div class="info-center">
      <div class="stat-item">
        <span class="stat-number">{stats.newCards}</span>
        <span class="stat-label">{statLabels.first}</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{stats.learningCards}</span>
        <span class="stat-label">{statLabels.second}</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{stats.reviewCards}</span>
        <span class="stat-label">{statLabels.third}</span>
      </div>
    </div>

  </div>
</div>

<style>
  .deck-grid-card {
    height: 220px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }

  .deck-grid-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    filter: brightness(1.05);
  }

  .deck-grid-card:active {
    transform: translateY(-2px);
  }

  /* 上方主区域：牌组名 */
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

  /* 🆕 右上角菜单按钮 */
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

  .deck-grid-card:hover .menu-btn {
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

  /* 🆕 移动端：始终显示菜单按钮 */
  @media (max-width: 768px) {
    .menu-btn {
      opacity: 1;
    }
  }

  .deck-title {
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
    gap: 2px;
  }

  .stat-number {
    font-weight: 600;
    font-size: 16px;
  }

  .stat-label {
    font-size: 12px;
    opacity: 0.85;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .deck-grid-card {
      height: 200px;
    }

    .deck-title {
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
  }

  /* ==================== Obsidian 移动端适配 ==================== */
  
  /* 手机端：全宽单列布局 */
  :global(body.is-phone) .deck-grid-card {
    width: 100%;
    margin: 0;
    height: 180px;
  }

  :global(body.is-phone) .card-main {
    padding: 20px 16px;
  }

  :global(body.is-phone) .deck-title {
    font-size: 20px;
  }

  :global(body.is-phone) .card-info-bar {
    height: var(--weave-mobile-touch-min, 44px);
    padding: 0 12px;
  }

  :global(body.is-phone) .stat-number {
    font-size: 14px;
  }

  :global(body.is-phone) .stat-label {
    font-size: 11px;
  }

  :global(body.is-phone) .info-center {
    gap: 8px;
  }

  /* 手机端：始终显示菜单按钮 */
  :global(body.is-phone) .menu-btn {
    opacity: 1;
  }

  /* 平板端：适中尺寸 */
  :global(body.is-tablet) .deck-grid-card {
    height: 200px;
  }
</style>

