<!--
  平板端学习界面适配组件
  针对平板设备优化的学习体验
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TabletWrapper from './TabletWrapper.svelte';
  import { detectDevice, getRecommendedTouchSize } from '../../utils/tablet-detection';
  import { gestureManager, type GestureEvent } from '../../utils/gesture-manager';
  import type { Card } from '../../data/types';
  import { getCardFieldContent } from '../../utils/card-field-helper';

  interface Props {
    /** 当前学习的卡片 */
    currentCard: Card | null;
    /** 是否显示答案 */
    showAnswer: boolean;
    /** 学习按钮回调 */
    onAnswer: (difficulty: 'again' | 'hard' | 'good' | 'easy') => void;
    /** 显示答案回调 */
    onShowAnswer: () => void;
    /** 撤销回调 */
    onUndo?: () => void;
    /** 是否可以撤销 */
    canUndo?: boolean;
  }

  let {
    currentCard,
    showAnswer,
    onAnswer,
    onShowAnswer,
    onUndo,
    canUndo = false
  }: Props = $props();

  let tabletWrapper: TabletWrapper;
  let touchSizes = $state({ minSize: 44, recommendedSize: 48, spacing: 8 });
  let cardContentArea: HTMLElement;
  let actionArea: HTMLElement;

  onMount(() => {
    const device = detectDevice();
    touchSizes = getRecommendedTouchSize(device);
    
    // 设置手势支持
    if (device.isTouch) {
      setupGestures();
    }
  });

  onDestroy(() => {
    // 清理手势监听器
    if (cardContentArea) {
      gestureManager.removeGestureListener(cardContentArea);
    }
    if (actionArea) {
      gestureManager.removeGestureListener(actionArea);
    }
  });

  // 设置手势监听
  function setupGestures(): void {
    if (!cardContentArea) return;

    // 卡片内容区域的手势
    gestureManager.addGestureListener(cardContentArea, 'swipe', handleCardSwipe);
    gestureManager.addGestureListener(cardContentArea, 'doubletap', handleCardDoubleTap);
    
    // 操作区域的手势
    if (actionArea) {
      gestureManager.addGestureListener(actionArea, 'swipe', handleActionSwipe);
    }
  }

  // 处理卡片区域滑动
  function handleCardSwipe(event: GestureEvent): void {
    if (!currentCard) return;

    switch (event.direction) {
      case 'left':
        // 左滑：显示答案或下一张
        if (!showAnswer) {
          handleShowAnswer();
        } else {
          // 已显示答案时，左滑为"良好"评分
          handleAnswer('good');
        }
        break;
        
      case 'right':
        // 右滑：撤销或"简单"评分
        if (showAnswer && canUndo) {
          handleUndo();
        } else if (showAnswer) {
          handleAnswer('easy');
        }
        break;
        
      case 'up':
        // 上滑：显示答案
        if (!showAnswer) {
          handleShowAnswer();
        }
        break;
        
      case 'down':
        // 下滑：重来
        if (showAnswer) {
          handleAnswer('again');
        }
        break;
    }
  }

  // 处理卡片双击
  function handleCardDoubleTap(event: GestureEvent): void {
    if (!showAnswer) {
      handleShowAnswer();
    }
  }

  // 处理操作区域滑动
  function handleActionSwipe(event: GestureEvent): void {
    if (!showAnswer) return;

    const difficulties: Array<'again' | 'hard' | 'good' | 'easy'> = ['again', 'hard', 'good', 'easy'];
    
    switch (event.direction) {
      case 'left':
        // 左滑：困难 → 良好 → 简单
        handleAnswer('good');
        break;
      case 'right':
        // 右滑：简单 → 良好 → 困难
        handleAnswer('hard');
        break;
    }
  }

  // 处理学习按钮点击
  function handleAnswer(difficulty: 'again' | 'hard' | 'good' | 'easy') {
    // 添加触觉反馈（如果支持）
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    onAnswer(difficulty);
  }

  // 处理显示答案
  function handleShowAnswer() {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    onShowAnswer();
  }

  // 处理撤销
  function handleUndo() {
    if (navigator.vibrate) {
      navigator.vibrate([30, 30, 30]);
    }
    onUndo?.();
  }
</script>

<TabletWrapper bind:this={tabletWrapper} class="weave-tablet-study">
  <div class="study-container">
    <!-- 卡片内容区域 -->
    <div class="card-content-area" bind:this={cardContentArea}>
      {#if currentCard}
        <div class="card-display">
          <!-- 卡片正面 -->
          <div class="card-front">
            <div class="card-content">
              {@html getCardFieldContent(currentCard, 'front')}
            </div>
            
            <!-- 手势提示（仅在平板端显示） -->
            <div class="gesture-hint">
              <div class="gesture-indicators">
                {#if !showAnswer}
                  <div class="gesture-item">
                    <span class="gesture-icon">[U]</span>
                    <span class="gesture-text">上滑或双击显示答案</span>
                  </div>
                {:else}
                  <div class="gesture-grid">
                    <div class="gesture-item">
                      <span class="gesture-icon">[D]</span>
                      <span class="gesture-text">重来</span>
                    </div>
                    <div class="gesture-item">
                      <span class="gesture-icon">[L]</span>
                      <span class="gesture-text">良好</span>
                    </div>
                    <div class="gesture-item">
                      <span class="gesture-icon">[R]</span>
                      <span class="gesture-text">简单</span>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- 卡片背面（如果显示答案） -->
          {#if showAnswer}
            {@const backContent = getCardFieldContent(currentCard, 'back')}
            {#if backContent}
              <div class="card-back">
                <div class="card-divider"></div>
                <div class="card-content">
                  {@html backContent}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {:else}
        <div class="no-card-state">
          <div class="no-card-icon">提示</div>
          <div class="no-card-text">暂无学习内容</div>
        </div>
      {/if}
    </div>

    <!-- 操作按钮区域 -->
    <div class="action-area" bind:this={actionArea}>
      {#if !showAnswer}
        <!-- 显示答案按钮 -->
        <button 
          class="show-answer-btn tablet-button primary"
          style="min-height: {touchSizes.recommendedSize}px; margin: {touchSizes.spacing}px;"
          onclick={handleShowAnswer}
        >
          <span class="button-text">显示答案</span>
        </button>
      {:else}
        <!-- 学习评分按钮组 -->
        <div class="study-buttons">
          <button 
            class="study-btn again-btn tablet-button"
            style="min-height: {touchSizes.recommendedSize}px; margin: {touchSizes.spacing}px;"
            onclick={() => handleAnswer('again')}
          >
            <span class="button-text">重来</span>
            <span class="button-shortcut">1</span>
          </button>

          <button 
            class="study-btn hard-btn tablet-button"
            style="min-height: {touchSizes.recommendedSize}px; margin: {touchSizes.spacing}px;"
            onclick={() => handleAnswer('hard')}
          >
            <span class="button-text">困难</span>
            <span class="button-shortcut">2</span>
          </button>

          <button 
            class="study-btn good-btn tablet-button"
            style="min-height: {touchSizes.recommendedSize}px; margin: {touchSizes.spacing}px;"
            onclick={() => handleAnswer('good')}
          >
            <span class="button-text">良好</span>
            <span class="button-shortcut">3</span>
          </button>

          <button 
            class="study-btn easy-btn tablet-button"
            style="min-height: {touchSizes.recommendedSize}px; margin: {touchSizes.spacing}px;"
            onclick={() => handleAnswer('easy')}
          >
            <span class="button-text">简单</span>
            <span class="button-shortcut">4</span>
          </button>
        </div>
      {/if}

      <!-- 撤销按钮 -->
      {#if canUndo}
        <button 
          class="undo-btn tablet-button secondary"
          style="min-height: {touchSizes.minSize}px; margin: {touchSizes.spacing}px;"
          onclick={handleUndo}
        >
          <span class="button-text">撤销</span>
        </button>
      {/if}
    </div>
  </div>
</TabletWrapper>

<style>
  .study-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
  }

  /* 卡片内容区域 */
  .card-content-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--size-4-6, 24px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .card-display {
    max-width: 800px;
    width: 100%;
    background: var(--background-primary);
    border-radius: var(--radius-l, 12px);
    box-shadow: var(--shadow-l);
    overflow: hidden;
  }

  .card-front,
  .card-back {
    padding: var(--size-4-6, 24px);
  }

  .card-content {
    font-size: var(--font-ui-large, 16px);
    line-height: 1.6;
    color: var(--text-normal);
  }

  .card-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 0 var(--size-4-6, 24px);
  }

  .no-card-state {
    text-align: center;
    color: var(--text-muted);
  }

  .no-card-icon {
    font-size: 3rem;
    margin-bottom: var(--size-4-4, 16px);
  }

  .no-card-text {
    font-size: var(--font-ui-large, 16px);
  }

  /* 操作按钮区域 */
  .action-area {
    flex-shrink: 0;
    padding: var(--size-4-4, 16px);
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  /* 平板端按钮基础样式 - 应用触控标准 */
  .tablet-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--weave-touch-gap-xs, 8px);
    /* 应用触控标准尺寸 */
    min-height: var(--weave-touch-md, 48px);
    min-width: var(--weave-touch-md, 48px);
    padding: var(--weave-touch-gap-sm, 12px) var(--weave-touch-gap-md, 16px);
    margin: var(--weave-touch-gap-xs, 8px);
    border: none;
    border-radius: var(--radius-m, 8px);
    font-size: var(--font-ui-medium, 14px);
    font-weight: 600;
    cursor: pointer;
    /* 应用触控优化的过渡效果 */
    transition: transform var(--weave-touch-duration-fast, 0.1s) var(--weave-touch-ease, cubic-bezier(0.4, 0, 0.2, 1)),
                box-shadow var(--weave-touch-duration-normal, 0.2s) var(--weave-touch-ease, cubic-bezier(0.4, 0, 0.2, 1)),
                background-color var(--weave-touch-duration-normal, 0.2s) ease;
    position: relative;
    overflow: hidden;
    /* 触控优化 */
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .tablet-button:active {
    transform: scale(var(--weave-touch-scale, 0.98));
  }
  
  /* 增强的触控反馈 */
  .tablet-button:hover {
    transform: translateY(-1px);
    box-shadow: var(--weave-shadow-md);
  }

  .tablet-button.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .tablet-button.primary:hover {
    background: var(--interactive-accent-hover);
  }

  .tablet-button.secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 显示答案按钮 - 增大触控目标 */
  .show-answer-btn {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    display: flex;
    /* 主要操作按钮使用更大尺寸 */
    min-height: var(--weave-touch-lg, 56px);
  }

  /* 学习按钮组 - 优化触控间距 */
  .study-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--weave-touch-gap-sm, 12px);
    max-width: 600px;
    margin: 0 auto;
    padding: var(--weave-touch-gap-sm, 12px);
  }

  /* 学习按钮颜色 */
  .again-btn {
    background: var(--color-red, #ef4444);
    color: white;
  }

  .hard-btn {
    background: var(--color-orange, #f59e0b);
    color: white;
  }

  .good-btn {
    background: var(--color-green, #10b981);
    color: white;
  }

  .easy-btn {
    background: var(--color-blue, #3b82f6);
    color: white;
  }

  /* 按钮文本和图标 */
  .button-text {
    flex: 1;
  }

  .button-shortcut {
    font-size: var(--font-ui-small, 12px);
    opacity: 0.7;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: var(--radius-s, 4px);
  }

  /* 撤销按钮 */
  .undo-btn {
    width: 100%;
    max-width: 200px;
    margin: var(--size-4-2, 8px) auto 0;
  }

  /* 竖屏适配 */
  @media (orientation: portrait) {
    .study-buttons {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: var(--size-4-3, 12px);
    }
  }

  /* 横屏适配 */
  @media (orientation: landscape) {
    .study-container {
      flex-direction: row;
    }

    .card-content-area {
      flex: 1;
    }

    .action-area {
      width: 300px;
      border-top: none;
      border-left: 1px solid var(--background-modifier-border);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .study-buttons {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
    }
  }

  /* 触控反馈 */
  @media (pointer: coarse) {
    .tablet-button::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.1);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .tablet-button:active::after {
      opacity: 1;
    }
  }

  /* ==================== 手势提示样式 ==================== */
  .gesture-hint {
    position: absolute;
    bottom: var(--weave-touch-gap-md, 16px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: var(--weave-touch-gap-xs, 8px) var(--weave-touch-gap-sm, 12px);
    border-radius: var(--radius-m, 8px);
    font-size: var(--font-ui-small, 12px);
    pointer-events: none;
    z-index: 10;
    backdrop-filter: blur(8px);
  }

  .gesture-indicators {
    display: flex;
    align-items: center;
    gap: var(--weave-touch-gap-sm, 12px);
  }

  .gesture-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--weave-touch-gap-xs, 8px);
  }

  .gesture-item {
    display: flex;
    align-items: center;
    gap: var(--weave-touch-gap-xs, 8px);
    white-space: nowrap;
  }

  .gesture-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .gesture-text {
    font-size: var(--font-ui-smaller, 11px);
    opacity: 0.9;
  }

  /* 平板端显示手势提示 */
  @media (min-width: 768px) and (max-width: 1024px) and (pointer: coarse) {
    .gesture-hint {
      opacity: 1;
      animation: fadeInUp 0.3s ease-out;
    }
  }

  /* 桌面端隐藏手势提示 */
  @media (pointer: fine) {
    .gesture-hint {
      display: none;
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translate(-50%, 10px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
</style>
