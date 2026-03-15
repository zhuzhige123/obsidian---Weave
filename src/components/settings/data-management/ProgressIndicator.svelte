<!--
  进度指示器组件
  显示操作进度、状态和剩余时间估算
-->
<script lang="ts">
  import type { OperationProgress, OperationType } from '../../../types/data-management-types';
  import { formatDuration, formatEstimatedTime, formatOperationType } from '../../../utils/format-utils';
  import { createEventDispatcher } from 'svelte';
  import { tr } from '../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    progress: OperationProgress | null;
    isVisible?: boolean;
    allowCancel?: boolean;
    onCancel?: () => void;
  }

  let {
    progress,
    isVisible = false,
    allowCancel = true,
    onCancel
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    cancel: void;
  }>();

  // 操作图标映射
  const operationIcons: Record<OperationType, string> = {
    export: '📤',
    import: '📥',
    backup: '💾',
    restore: '🔄',
    reset: '🗑️',
    refresh: '🔄',
    open_folder: '📁',
    delete_backup: '🗑️'
  };

  // 获取操作图标
  function getOperationIcon(operation: OperationType): string {
    return operationIcons[operation] || '⚙️';
  }

  // 计算进度百分比
  let progressPercentage = $derived(
    progress ? Math.min(100, Math.max(0, progress.progress)) : 0
  );

  // 格式化进度文本
  let progressText = $derived(
    progress ? `${Math.round(progressPercentage)}%` : ''
  );

  // 格式化处理计数
  let countText = $derived(
    progress ? `${progress.processedCount} / ${progress.totalCount}` : ''
  );

  // 计算已用时间
  let elapsedTime = $derived(
    progress?.startTime ? Date.now() - new Date(progress.startTime).getTime() : 0
  );

  // 格式化已用时间
  let elapsedTimeText = $derived(
    formatDuration(elapsedTime)
  );

  // 格式化剩余时间
  let remainingTimeText = $derived(
    progress?.estimatedTimeRemaining ? formatEstimatedTime(progress.estimatedTimeRemaining) : t('dataManagement.progress.calculating')
  );

  // 获取进度条颜色
  function getProgressColor(): string {
    if (!progress) return 'var(--interactive-accent)';
    
    if (progressPercentage < 30) return 'var(--text-error)';
    if (progressPercentage < 70) return 'var(--text-warning)';
    return 'var(--text-success)';
  }

  // 处理取消操作
  function handleCancel() {
    if (!progress?.cancellable) return;
    
    if (onCancel) {
      onCancel();
    }
    
    dispatch('cancel');
  }

  // 检查是否可以取消
  let canCancel = $derived(
    allowCancel && progress?.cancellable
  );
</script>

<!-- 进度指示器 -->
{#if isVisible && progress}
  <div class="progress-indicator">
    <!-- 进度头部 -->
    <div class="progress-header">
      <div class="operation-info">
        <div class="operation-icon">{getOperationIcon(progress.operation)}</div>
        <div class="operation-details">
          <div class="operation-title">
            {formatOperationType(progress.operation)}
          </div>
          <div class="operation-status">
            {progress.status}
          </div>
        </div>
      </div>
      
      {#if canCancel}
        <button 
          class="cancel-button"
          onclick={handleCancel}
          title={t('dataManagement.progress.cancelOperation')}
        >
          <span class="cancel-icon">✕</span>
        </button>
      {/if}
    </div>

    <!-- 进度条 -->
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div 
          class="progress-fill"
          style="width: {progressPercentage}%; background-color: {getProgressColor()}"
        ></div>
      </div>
      <div class="progress-percentage">{progressText}</div>
    </div>

    <!-- 进度详情 -->
    <div class="progress-details">
      <!-- 处理计数 -->
      <div class="detail-item">
        <span class="detail-label">{t('dataManagement.progress.progressLabel')}</span>
        <span class="detail-value">{countText}</span>
      </div>

      <!-- 已用时间 -->
      <div class="detail-item">
        <span class="detail-label">{t('dataManagement.progress.elapsedTime')}</span>
        <span class="detail-value">{elapsedTimeText}</span>
      </div>

      <!-- 剩余时间 -->
      {#if progress.estimatedTimeRemaining !== undefined}
        <div class="detail-item">
          <span class="detail-label">{t('dataManagement.progress.remainingTime')}</span>
          <span class="detail-value">{remainingTimeText}</span>
        </div>
      {/if}
    </div>

    <!-- 动画指示器 -->
    <div class="activity-indicator">
      <div class="activity-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .progress-indicator {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: var(--shadow-s);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 进度头部 */
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .operation-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .operation-icon {
    font-size: 1.5rem;
    opacity: 0.8;
  }

  .operation-details {
    flex: 1;
  }

  .operation-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.25rem;
  }

  .operation-status {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .cancel-button {
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 50%;
    background: var(--background-primary);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .cancel-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-error);
    color: var(--text-error);
  }

  .cancel-icon {
    font-size: 0.875rem;
    font-weight: bold;
  }

  /* 进度条 */
  .progress-bar-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease, background-color 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .progress-fill::after {
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
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
    min-width: 3rem;
    text-align: right;
    font-family: var(--font-monospace);
  }

  /* 进度详情 */
  .progress-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-normal);
    font-family: var(--font-monospace);
  }

  /* 活动指示器 */
  .activity-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .activity-dots {
    display: flex;
    gap: 0.5rem;
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

  /* 响应式设计 */
  @media (max-width: 768px) {
    .progress-indicator {
      padding: 1rem;
    }

    .progress-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .operation-info {
      justify-content: center;
    }

    .cancel-button {
      align-self: flex-end;
    }

    .progress-details {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .detail-item {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  @media (max-width: 480px) {
    .progress-bar-container {
      flex-direction: column;
      gap: 0.5rem;
    }

    .progress-percentage {
      text-align: center;
      min-width: auto;
    }
  }
</style>
