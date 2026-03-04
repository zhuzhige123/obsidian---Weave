<!--
  预览系统错误恢复组件
  专门处理预览渲染、内容解析和模板应用中的错误
-->
<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount } from 'svelte';
  import type { PreviewData } from '../preview/ContentPreviewEngine';
  import type { Card } from '../../data/types';
  import { globalPerformanceMonitor } from '../../utils/parsing-performance-monitor';

  interface Props {
    children: any;
    previewData?: PreviewData;
    card?: Card;
    onError?: (error: PreviewError) => void;
    onRecovery?: (recoveryMethod: string) => void;
    enableFallback?: boolean;
  }

  let {
    children,
    previewData,
    card,
    onError,
    onRecovery,
    enableFallback = true
  }: Props = $props();

  // 错误状态
  let hasError = $state(false);
  let error = $state<PreviewError | null>(null);
  let recoveryAttempts = $state(0);
  let isRecovering = $state(false);
  let fallbackContent = $state<string>('');

  // 预览错误类型
  interface PreviewError {
    type: 'rendering' | 'parsing' | 'template' | 'data' | 'unknown';
    message: string;
    originalError: Error;
    context: {
      cardId?: string;
      templateId?: string;
      sectionCount?: number;
      contentLength?: number;
    };
    recoverable: boolean;
    fallbackAvailable: boolean;
  }

  // 恢复策略配置
  const RECOVERY_STRATEGIES = {
    rendering: ['simplify-content', 'fallback-template', 'basic-display'],
    parsing: ['retry-parse', 'simplified-parse', 'raw-content'],
    template: ['default-template', 'basic-template', 'no-template'],
    data: ['reload-data', 'cached-data', 'minimal-data'],
    unknown: ['full-reset', 'safe-mode']
  };

  const MAX_RECOVERY_ATTEMPTS = 3;

  /**
   * 分析预览错误
   */
  function analyzePreviewError(err: Error): PreviewError {
    const message = err.message.toLowerCase();
    const stack = err.stack?.toLowerCase() || '';

    let type: PreviewError['type'] = 'unknown';
    let recoverable = true;
    let fallbackAvailable = true;

    // 渲染错误
    if (message.includes('render') || message.includes('component') || stack.includes('svelte')) {
      type = 'rendering';
    }
    // 解析错误
    else if (message.includes('parse') || message.includes('syntax') || message.includes('invalid')) {
      type = 'parsing';
    }
    // 模板错误
    else if (message.includes('template') || message.includes('field') || message.includes('mapping')) {
      type = 'template';
    }
    // 数据错误
    else if (message.includes('undefined') || message.includes('null') || message.includes('property')) {
      type = 'data';
    }

    return {
      type,
      message: err.message,
      originalError: err,
      context: {
        cardId: card?.id,
        templateId: previewData?.templateId,
        sectionCount: previewData?.sections?.length,
        contentLength: previewData?.originalContent?.length
      },
      recoverable,
      fallbackAvailable
    };
  }

  /**
   * 捕获预览错误
   */
  function capturePreviewError(err: Error) {
    const previewError = analyzePreviewError(err);
    
    hasError = true;
    error = previewError;
    recoveryAttempts = 0;

    logger.error('🚨 [PreviewSystemErrorRecovery] 预览错误:', {
      error: previewError,
      previewData,
      card: card?.id
    });

    // 记录错误
    globalPerformanceMonitor.recordOperation(
      'preview_error',
      0,
      false,
      0,
      false
    );

    onError?.(previewError);

    // 自动尝试恢复
    if (previewError.recoverable) {
      setTimeout(() => {
        attemptRecovery();
      }, 100);
    }
  }

  /**
   * 尝试错误恢复
   */
  async function attemptRecovery() {
    if (!error || isRecovering || recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      return;
    }

    isRecovering = true;
    recoveryAttempts++;

    const strategies = RECOVERY_STRATEGIES[error.type] || RECOVERY_STRATEGIES.unknown;
    const currentStrategy = strategies[Math.min(recoveryAttempts - 1, strategies.length - 1)];

    logger.debug(`🔄 [PreviewSystemErrorRecovery] 尝试恢复策略: ${currentStrategy}`, {
      attempt: recoveryAttempts,
      errorType: error.type
    });

    try {
      const success = await executeRecoveryStrategy(currentStrategy);
      
      if (success) {
        hasError = false;
        error = null;
        isRecovering = false;
        
        logger.debug('✅ [PreviewSystemErrorRecovery] 恢复成功:', currentStrategy);
        
        globalPerformanceMonitor.recordOperation(
          'preview_recovery',
          200,
          true,
          1,
          false
        );

        onRecovery?.(currentStrategy);
      } else {
        throw new Error(`恢复策略失败: ${currentStrategy}`);
      }
    } catch (recoveryError) {
      logger.error('❌ [PreviewSystemErrorRecovery] 恢复失败:', recoveryError);
      isRecovering = false;

      // 如果还有重试机会，继续尝试
      if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        setTimeout(() => {
          attemptRecovery();
        }, 500 * recoveryAttempts);
      } else {
        // 最后尝试生成后备内容
        generateFallbackContent();
      }
    }
  }

  /**
   * 执行恢复策略
   */
  async function executeRecoveryStrategy(strategy: string): Promise<boolean> {
    switch (strategy) {
      case 'simplify-content':
        return await simplifyContent();
      
      case 'fallback-template':
        return await useFallbackTemplate();
      
      case 'basic-display':
        return await useBasicDisplay();
      
      case 'retry-parse':
        return await retryParsing();
      
      case 'simplified-parse':
        return await useSimplifiedParsing();
      
      case 'raw-content':
        return await showRawContent();
      
      case 'default-template':
        return await useDefaultTemplate();
      
      case 'reload-data':
        return await reloadData();
      
      case 'safe-mode':
        return await enterSafeMode();
      
      default:
        return false;
    }
  }

  /**
   * 简化内容策略
   */
  async function simplifyContent(): Promise<boolean> {
    if (!previewData) return false;

    try {
      // 移除复杂的格式和嵌套结构
      const simplifiedSections = previewData.sections.map(section => ({
        ...section,
        content: section.content.replace(/!\[.*?\]\(.*?\)/g, '[图片]')
                               .replace(/\[.*?\]\(.*?\)/g, '[链接]')
                               .replace(/```[\s\S]*?```/g, '[代码块]')
                               .replace(/<[^>]*>/g, '')
      }));

      // 更新预览数据
      Object.assign(previewData, {
        sections: simplifiedSections,
        complexity: 'low'
      });

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 使用后备模板策略
   */
  async function useFallbackTemplate(): Promise<boolean> {
    if (!previewData) return false;

    try {
      // 使用最基础的模板
      Object.assign(previewData, {
        templateId: 'basic-fallback',
        renderMode: 'simple'
      });

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 基础显示策略
   */
  async function useBasicDisplay(): Promise<boolean> {
    try {
      fallbackContent = generateBasicDisplay();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 重试解析策略
   */
  async function retryParsing(): Promise<boolean> {
    // 简单的重试，清理可能的状态问题
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }

  /**
   * 简化解析策略
   */
  async function useSimplifiedParsing(): Promise<boolean> {
    if (!card) return false;

    try {
      // 使用最简单的解析逻辑
      const content = card.content || '';
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return false;

      const simpleSections: any[] = [
        {
          id: 'simple-front',
          type: 'front',
          content: lines[0] || '问题',
          renderMode: 'markdown',
          animations: [],
          interactivity: {
            clickable: false,
            hoverable: false,
            selectable: false,
            customHandlers: {}
          }
        },
        {
          id: 'simple-back',
          type: 'back',
          content: lines.slice(1).join('\n') || '答案',
          renderMode: 'markdown',
          animations: [],
          interactivity: {
            clickable: false,
            hoverable: false,
            selectable: false,
            customHandlers: {}
          }
        }
      ];
      
      const simplifiedData: Partial<PreviewData> = {
        sections: simpleSections as any,
        cardType: ('basic-qa' as any),
        confidence: 0.5
      };

      if (previewData) {
        Object.assign(previewData, simplifiedData);
      }

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 显示原始内容策略
   */
  async function showRawContent(): Promise<boolean> {
    try {
      const content = card?.content || previewData?.originalContent || '无内容';
      fallbackContent = `<pre>${content}</pre>`;
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 使用默认模板策略
   */
  async function useDefaultTemplate(): Promise<boolean> {
    if (!previewData) return false;

    try {
      Object.assign(previewData, {
        templateId: 'default',
        renderMode: 'basic'
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 重新加载数据策略
   */
  async function reloadData(): Promise<boolean> {
    // 触发数据重新加载
    await new Promise(resolve => setTimeout(resolve, 200));
    return true;
  }

  /**
   * 进入安全模式策略
   */
  async function enterSafeMode(): Promise<boolean> {
    try {
      fallbackContent = generateSafeModeDisplay();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 生成基础显示内容
   */
  function generateBasicDisplay(): string {
    const cardTitle = card?.content?.split('\n')[0] || '卡片';
    return `
      <div class="basic-display">
        <h3>${cardTitle}</h3>
        <p>预览暂时不可用，请在学习模式中查看完整内容。</p>
      </div>
    `;
  }

  /**
   * 生成安全模式显示内容
   */
  function generateSafeModeDisplay(): string {
    return `
      <div class="safe-mode-display">
        <div class="safe-mode-icon">[S]</div>
        <h3>安全模式</h3>
        <p>预览系统遇到问题，已切换到安全模式。</p>
        <p>卡片功能正常，可以继续学习。</p>
      </div>
    `;
  }

  /**
   * 生成后备内容
   */
  function generateFallbackContent() {
    if (!enableFallback) return;

    fallbackContent = `
      <div class="fallback-content">
        <div class="fallback-header">
          <span class="fallback-icon">[!]</span>
          <h4>预览不可用</h4>
        </div>
        <p>预览系统暂时不可用，但不影响学习功能。</p>
        ${card ? `<p><strong>卡片ID:</strong> ${card.id}</p>` : ''}
        <button class="retry-btn" onclick={() => location.reload()}>
          刷新页面
        </button>
      </div>
    `;
  }

  /**
   * 手动重试
   */
  function manualRetry() {
    recoveryAttempts = 0;
    hasError = false;
    error = null;
    isRecovering = false;
    fallbackContent = '';
  }
</script>

{#if hasError && error}
  <div class="preview-error-recovery" role="alert">
    {#if isRecovering}
      <div class="recovery-status">
        <div class="loading-spinner"></div>
        <span>正在恢复预览... (尝试 {recoveryAttempts}/{MAX_RECOVERY_ATTEMPTS})</span>
      </div>
    {:else if fallbackContent}
      <div class="fallback-container">
        {@html fallbackContent}
      </div>
    {:else}
      <div class="error-info">
        <h4>预览错误</h4>
        <p>类型: {error.type}</p>
        <p>尝试次数: {recoveryAttempts}</p>
        <button class="btn btn-primary" onclick={manualRetry}>
          重试
        </button>
      </div>
    {/if}
  </div>
{:else}
  {@render children?.()}
{/if}

<style>
  .preview-error-recovery {
    padding: var(--weave-space-md);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--weave-radius-sm);
    text-align: center;
  }

  .recovery-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--weave-space-sm);
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

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .fallback-container {
    min-height: 100px;
  }

  .error-info h4 {
    margin: 0 0 var(--weave-space-sm) 0;
    color: var(--text-error);
  }

  .error-info p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .btn {
    margin-top: var(--weave-space-sm);
    padding: var(--weave-space-sm) var(--weave-space-md);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--weave-radius-sm);
    cursor: pointer;
  }

  .btn:hover {
    background: var(--interactive-accent-hover);
  }
</style>
