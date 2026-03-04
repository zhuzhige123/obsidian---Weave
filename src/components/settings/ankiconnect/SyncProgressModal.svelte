<!--
  AnkiConnect 同步进度模态窗
  统一的进度显示组件，支持多种操作类型
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';

  type OperationType = 'fetch_models' | 'sync_to_anki' | 'sync_from_anki' | 'batch_sync';

  interface Props {
    /** 是否显示模态窗 */
    open: boolean;
    /** 操作类型 */
    operation: OperationType;
    /** 操作标题 */
    title: string;
    /** 当前进度数值 */
    current: number;
    /** 总数 */
    total: number;
    /** 当前状态描述 */
    status?: string;
    /** 当前处理项名称（如牌组名） */
    currentItem?: string;
    /** 当前牌组索引 */
    deckIndex?: number;
    /** 总牌组数 */
    totalDecks?: number;
    /** 是否允许取消 */
    allowCancel?: boolean;
    /** 取消回调 */
    onCancel?: () => void;
    /** 关闭回调 */
    onClose?: () => void;
  }

  let {
    open = false,
    operation,
    title,
    current = 0,
    total = 0,
    status = '',
    currentItem = '',
    deckIndex = 0,
    totalDecks = 0,
    allowCancel = false,
    onCancel,
    onClose
  }: Props = $props();

  // 操作图标映射
  const operationIcons: Record<OperationType, string> = {
    fetch_models: '📋',
    sync_to_anki: '→',
    sync_from_anki: '←',
    batch_sync: '⇄'
  };

  // 计算进度百分比
  let progressPercentage = $derived(
    total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0
  );

  // 格式化进度文本
  let progressText = $derived(
    `${current} / ${total}`
  );

  // 格式化百分比
  let percentageText = $derived(
    `${Math.round(progressPercentage)}%`
  );

  // 获取操作图标
  function getOperationIcon(): string {
    return operationIcons[operation] || '⚙️';
  }

  function handleKeydown(_event: KeyboardEvent) {
  }

  // 处理取消
  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
    if (onClose) {
      onClose();
    }
  }

  // 监听键盘事件
  onMount(() => {
    if (allowCancel) {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if open}
  <div 
    class="sync-progress-modal-overlay"
    role="presentation"
    transition:fade={{ duration: 250 }}
  >
    <div
      class="sync-progress-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-modal-title"
      tabindex="-1"
    >
      <!-- 头部 -->
      <div class="modal-header">
        <div class="operation-icon">{getOperationIcon()}</div>
        <h3 id="progress-modal-title" class="modal-title">{title}</h3>
      </div>

      <!-- 进度区域 -->
      <div class="modal-body">
        <!-- 当前处理项 -->
        {#if currentItem}
          <div class="current-item">
            <span class="label">正在处理：</span>
            <span class="value">{currentItem}</span>
          </div>
        {/if}

        <!-- 牌组进度（批量操作时显示） -->
        {#if totalDecks > 0}
          <div class="deck-progress">
            <span class="label">牌组进度：</span>
            <span class="value">{deckIndex} / {totalDecks}</span>
          </div>
        {/if}

        <!-- 进度条 -->
        <div class="progress-bar-wrapper">
          <div class="progress-bar-container">
            <div 
              class="progress-bar-fill"
              style="width: {progressPercentage}%"
            ></div>
          </div>
          <div class="progress-percentage">{percentageText}</div>
        </div>

        <!-- 进度文本 -->
        <div class="progress-text">
          {progressText}
          {#if status}
            <span class="status">· {status}</span>
          {/if}
        </div>

        <!-- 活动指示器（动画点） -->
        <div class="activity-indicator">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>

      <!-- 底部按钮 -->
      {#if allowCancel && onCancel}
        <div class="modal-footer">
          <button
            class="btn-cancel"
            onclick={handleCancel}
            aria-label="取消操作"
          >
            取消
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* 遮罩层 */
  .sync-progress-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: var(--layer-notice);
    backdrop-filter: blur(2px);
    animation: fadeIn 0.25s ease-out;
    /*  关键修复：遮罩层不拦截鼠标事件，允许点击穿透 */
    pointer-events: none;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* 模态窗主体 */
  .sync-progress-modal {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 450px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;
    /*  关键修复：模态窗本体恢复事件接收 */
    pointer-events: auto;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 头部 */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .operation-icon {
    font-size: 28px;
    opacity: 0.9;
  }

  .modal-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 主体内容 */
  .modal-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .current-item,
  .deck-progress {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
  }

  .label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .value {
    color: var(--text-normal);
    font-weight: 600;
    font-family: var(--font-monospace);
  }

  /* 进度条 */
  .progress-bar-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .progress-bar-container {
    flex: 1;
    height: 10px;
    background: var(--background-modifier-border);
    border-radius: 5px;
    overflow: hidden;
    position: relative;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 5px;
    transition: width 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .progress-bar-fill::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .progress-percentage {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    min-width: 3rem;
    text-align: right;
    font-family: var(--font-monospace);
  }

  /* 进度文本 */
  .progress-text {
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .status {
    color: var(--text-accent);
    font-style: italic;
  }

  /* 活动指示器 */
  .activity-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
  }

  .dot {
    width: 6px;
    height: 6px;
    background: var(--interactive-accent);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%, 80%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    40% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  /* 底部按钮 */
  .modal-footer {
    padding: 0 1.5rem 1.5rem;
    display: flex;
    justify-content: flex-end;
  }

  .btn-cancel {
    padding: 8px 20px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-error);
    color: var(--text-error);
  }

  /* 响应式 */
  @media (max-width: 600px) {
    .sync-progress-modal {
      width: 95vw;
    }

    .modal-header {
      padding: 1.25rem 1.25rem 0.875rem;
    }

    .modal-body {
      padding: 1.25rem;
    }

    .modal-footer {
      padding: 0 1.25rem 1.25rem;
    }
  }
</style>

