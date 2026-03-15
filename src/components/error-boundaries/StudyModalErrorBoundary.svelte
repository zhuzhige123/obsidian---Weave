<!--
  学习模态窗错误边界组件
  提供完整的错误捕获、恢复和用户友好的错误显示
-->
<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import type { Card } from '../../data/types';
  import { globalPerformanceMonitor } from '../../utils/parsing-performance-monitor';
  import { createMultilingualRecognizer } from '../../utils/multilingual-parser-support';

  interface Props {
    children: any;
    card?: Card;
    onError?: (error: Error, errorInfo: any) => void;
    onRecover?: () => void;
    fallbackComponent?: any;
  }

  let {
    children,
    card,
    onError,
    onRecover,
    fallbackComponent
  }: Props = $props();

  // 错误状态管理
  let hasError = $state(false);
  let error = $state<Error | null>(null);
  let errorInfo = $state<any>(null);
  let retryCount = $state(0);
  let isRecovering = $state(false);
  let errorId = $state<string>('');

  // 错误恢复策略
  const MAX_RETRY_COUNT = 3;
  const RECOVERY_DELAY = 1000; // 1秒

  // 错误类型分类
  interface ErrorClassification {
    type: 'rendering' | 'data' | 'network' | 'parsing' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
    userMessage: string;
    technicalMessage: string;
  }

  /**
   * 分类错误类型和严重程度
   */
  function classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // 渲染错误
    if (message.includes('render') || message.includes('component') || stack.includes('svelte')) {
      return {
        type: 'rendering',
        severity: 'high',
        recoverable: true,
        userMessage: '卡片显示出现问题，正在尝试恢复...',
        technicalMessage: `渲染错误: ${error.message}`
      };
    }

    // 数据错误
    if (message.includes('undefined') || message.includes('null') || message.includes('property')) {
      return {
        type: 'data',
        severity: 'medium',
        recoverable: true,
        userMessage: '卡片数据加载失败，正在重新加载...',
        technicalMessage: `数据错误: ${error.message}`
      };
    }

    // 网络错误
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        type: 'network',
        severity: 'medium',
        recoverable: true,
        userMessage: '网络连接问题，请检查网络后重试',
        technicalMessage: `网络错误: ${error.message}`
      };
    }

    // 解析错误
    if (message.includes('parse') || message.includes('syntax') || message.includes('json')) {
      return {
        type: 'parsing',
        severity: 'low',
        recoverable: true,
        userMessage: '内容解析失败，正在使用备用方案...',
        technicalMessage: `解析错误: ${error.message}`
      };
    }

    // 未知错误
    return {
      type: 'unknown',
      severity: 'critical',
      recoverable: false,
      userMessage: '发生未知错误，请刷新页面或联系支持',
      technicalMessage: `未知错误: ${error.message}`
    };
  }

  /**
   * 捕获错误
   */
  function captureError(err: Error, info?: any) {
    const classification = classifyError(err);
    
    hasError = true;
    error = err;
    errorInfo = info;
    errorId = `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // 记录错误到性能监控
    globalPerformanceMonitor.recordOperation(
      'studyModal_error',
      0,
      false,
      0,
      false
    );

    // 记录详细错误信息
    logger.error('🚨 [StudyModalErrorBoundary] 捕获错误:', {
      errorId,
      error: err,
      errorInfo: info,
      classification,
      card: card?.id,
      retryCount,
      timestamp: new Date().toISOString()
    });

    // 调用外部错误处理器
    onError?.(err, {
      ...info,
      classification,
      errorId,
      retryCount
    });

    // 自动恢复策略
    if (classification.recoverable && retryCount < MAX_RETRY_COUNT) {
      setTimeout(() => {
        attemptRecovery();
      }, RECOVERY_DELAY * (retryCount + 1)); // 递增延迟
    }
  }

  /**
   * 尝试错误恢复
   */
  async function attemptRecovery() {
    if (isRecovering) return;

    isRecovering = true;
    retryCount++;

    logger.debug(`🔄 [StudyModalErrorBoundary] 尝试恢复 (第${retryCount}次)`, {
      errorId,
      error: error?.message
    });

    try {
      // 清理状态
      await new Promise(resolve => setTimeout(resolve, 500));

      // 重置错误状态
      hasError = false;
      error = null;
      errorInfo = null;
      isRecovering = false;

      // 记录恢复成功
      globalPerformanceMonitor.recordOperation(
        'studyModal_recovery',
        500,
        true,
        1,
        false
      );

      logger.debug('✅ [StudyModalErrorBoundary] 错误恢复成功', { errorId });
      
      onRecover?.();

    } catch (recoveryError) {
      logger.error('❌ [StudyModalErrorBoundary] 恢复失败:', recoveryError);
      isRecovering = false;
      
      // 如果恢复失败且还有重试次数，继续尝试
      if (retryCount < MAX_RETRY_COUNT) {
        setTimeout(() => {
          attemptRecovery();
        }, RECOVERY_DELAY * retryCount);
      }
    }
  }

  /**
   * 手动重试
   */
  function manualRetry() {
    retryCount = 0; // 重置重试计数
    attemptRecovery();
  }

  /**
   * 重置错误状态
   */
  function resetError() {
    hasError = false;
    error = null;
    errorInfo = null;
    retryCount = 0;
    isRecovering = false;
    errorId = '';
  }

  // 全局错误监听
  onMount(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      captureError(event.error, { type: 'unhandled', event });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      captureError(error, { type: 'unhandled_promise', event });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  });

  // 清理
  onDestroy(() => {
    resetError();
  });

  // 监听卡片变化，重置错误状态
  $effect(() => {
    if (card) {
      resetError();
    }
  });
</script>

{#if hasError && error}
  {@const classification = classifyError(error)}
  
  <div class="error-boundary" role="alert" aria-live="polite">
    <div class="error-content">
      <div class="error-header">
        <div class="error-icon" class:recoverable={classification.recoverable}>
          {#if classification.recoverable}
            [R]
          {:else}
            [!]
          {/if}
        </div>
        <h3 class="error-title">
          {#if isRecovering}
            正在恢复...
          {:else}
            学习遇到问题
          {/if}
        </h3>
      </div>

      <div class="error-body">
        <p class="error-message">{classification.userMessage}</p>
        
        {#if retryCount > 0}
          <p class="retry-info">已尝试恢复 {retryCount} 次</p>
        {/if}

        <details class="error-details">
          <summary>技术详情</summary>
          <div class="technical-info">
            <p><strong>错误ID:</strong> {errorId}</p>
            <p><strong>错误类型:</strong> {classification.type}</p>
            <p><strong>严重程度:</strong> {classification.severity}</p>
            <p><strong>技术信息:</strong> {classification.technicalMessage}</p>
            {#if card}
              <p><strong>卡片ID:</strong> {card.id}</p>
            {/if}
          </div>
        </details>
      </div>

      <div class="error-actions">
        {#if classification.recoverable && !isRecovering}
          <button 
            class="btn btn-primary" 
            onclick={manualRetry}
            disabled={retryCount >= MAX_RETRY_COUNT}
          >
            {retryCount >= MAX_RETRY_COUNT ? '已达最大重试次数' : '重试'}
          </button>
        {/if}
        
        <button class="btn btn-secondary" onclick={resetError}>
          跳过此卡片
        </button>
      </div>
    </div>

    {#if isRecovering}
      <div class="recovery-indicator">
        <div class="loading-spinner"></div>
        <span>正在恢复中...</span>
      </div>
    {/if}
  </div>
{:else}
  <!-- 正常渲染子组件 -->
  {@render children?.()}
{/if}

<style>
  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: var(--weave-space-lg);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--weave-radius-md);
    text-align: center;
  }

  .error-content {
    max-width: 500px;
    width: 100%;
  }

  .error-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--weave-space-sm);
    margin-bottom: var(--weave-space-md);
  }

  .error-icon {
    font-size: 2rem;
    opacity: 0.8;
  }

  .error-icon.recoverable {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .error-body {
    margin-bottom: var(--weave-space-lg);
  }

  .error-message {
    font-size: 1rem;
    color: var(--text-muted);
    margin-bottom: var(--weave-space-sm);
  }

  .retry-info {
    font-size: 0.875rem;
    color: var(--text-faint);
    font-style: italic;
  }

  .error-details {
    margin-top: var(--weave-space-md);
    text-align: left;
  }

  .error-details summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--text-muted);
  }

  .technical-info {
    margin-top: var(--weave-space-sm);
    padding: var(--weave-space-sm);
    background: var(--background-secondary);
    border-radius: var(--weave-radius-sm);
    font-family: var(--font-monospace);
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .technical-info p {
    margin: 0.25rem 0;
  }

  .error-actions {
    display: flex;
    gap: var(--weave-space-sm);
    justify-content: center;
  }

  .btn {
    padding: var(--weave-space-sm) var(--weave-space-md);
    border: none;
    border-radius: var(--weave-radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .btn-secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .recovery-indicator {
    display: flex;
    align-items: center;
    gap: var(--weave-space-sm);
    margin-top: var(--weave-space-md);
    padding: var(--weave-space-sm);
    background: var(--background-secondary);
    border-radius: var(--weave-radius-sm);
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
</style>
