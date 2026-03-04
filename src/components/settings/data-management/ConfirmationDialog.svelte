<!--
  确认对话框组件
  支持分级确认系统（安全/谨慎/危险操作）
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type { SecurityLevel } from '../../../types/data-management-types';
  import { createEventDispatcher } from 'svelte';

  interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    securityLevel: SecurityLevel;
    confirmText?: string;
    cancelText?: string;
    requireTextConfirmation?: boolean;
    confirmationPhrase?: string;
    details?: string[];
    warningItems?: string[];
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }

  let {
    isOpen = false,
    title,
    message,
    securityLevel,
    confirmText = '确认',
    cancelText = '取消',
    requireTextConfirmation = false,
    confirmationPhrase = '确认操作',
    details = [],
    warningItems = [],
    onConfirm,
    onCancel
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();

  // 文本确认输入
  let textConfirmationInput = $state('');
  let isProcessing = $state(false);

  // 安全等级配置
  const securityConfig = {
    safe: {
      icon: '',
      color: 'var(--text-success)',
      bgColor: 'color-mix(in oklab, var(--text-success), transparent 95%)',
      borderColor: 'var(--text-success)'
    },
    caution: {
      icon: '',
      color: 'var(--text-warning)',
      bgColor: 'color-mix(in oklab, var(--text-warning), transparent 95%)',
      borderColor: 'var(--text-warning)'
    },
    danger: {
      icon: '',
      color: 'var(--text-error)',
      bgColor: 'color-mix(in oklab, var(--text-error), transparent 95%)',
      borderColor: 'var(--text-error)'
    }
  };

  // 获取当前安全等级配置
  let currentConfig = $derived(securityConfig[securityLevel]);

  // 检查是否可以确认
  let canConfirm = $derived(() => {
    if (requireTextConfirmation) {
      return textConfirmationInput.trim() === confirmationPhrase;
    }
    return true;
  });

  // 处理确认
  async function handleConfirm() {
    if (!canConfirm() || isProcessing) return;

    try {
      isProcessing = true;
      
      if (onConfirm) {
        await onConfirm();
      }
      
      dispatch('confirm');
      closeDialog();
    } catch (error) {
      logger.error('确认操作失败:', error);
    } finally {
      isProcessing = false;
    }
  }

  // 处理取消
  function handleCancel() {
    if (isProcessing) return;

    if (onCancel) {
      onCancel();
    }
    
    dispatch('cancel');
    closeDialog();
  }

  // 关闭对话框
  function closeDialog() {
    textConfirmationInput = '';
    isProcessing = false;
  }

  // 键盘事件处理
  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    if (event.key === 'Enter' && canConfirm()) {
      event.preventDefault();
      handleConfirm();
    }
  }

  // 点击遮罩关闭
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- 确认对话框 -->
{#if isOpen}
  <div
    class="confirmation-overlay"
    onclick={handleOverlayClick}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="confirmation-dialog" style="--security-color: {currentConfig.color}; --security-bg: {currentConfig.bgColor}; --security-border: {currentConfig.borderColor}">
      <!-- 对话框头部 -->
      <div class="dialog-header">
        {#if currentConfig.icon}
          <div class="header-icon">{currentConfig.icon}</div>
        {/if}
        <div class="header-content">
          <h2 class="dialog-title">{title}</h2>
          <div class="security-badge security-{securityLevel}">
            {securityLevel === 'safe' ? '安全操作' : 
             securityLevel === 'caution' ? '谨慎操作' : '危险操作'}
          </div>
        </div>
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-content">
        <!-- 主要消息 -->
        <div class="main-message">
          {message}
        </div>

        <!-- 详细信息 -->
        {#if details.length > 0}
          <div class="details-section">
            <h4>操作详情:</h4>
            <ul class="details-list">
              {#each details as detail}
                <li>{detail}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- 警告项目 -->
        {#if warningItems.length > 0}
          <div class="warning-section">
            <h4>注意事项:</h4>
            <ul class="warning-list">
              {#each warningItems as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- 文本确认输入 -->
        {#if requireTextConfirmation}
          <div class="text-confirmation">
            <label for="confirmation-input" class="confirmation-label">
              请输入 "<strong>{confirmationPhrase}</strong>" 以确认操作:
            </label>
            <input
              id="confirmation-input"
              type="text"
              bind:value={textConfirmationInput}
              placeholder={confirmationPhrase}
              class="confirmation-input"
              class:valid={canConfirm()}
              disabled={isProcessing}
              autocomplete="off"
            />
            {#if textConfirmationInput && !canConfirm()}
              <div class="input-error">输入的文本不匹配</div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 对话框操作 -->
      <div class="dialog-actions">
        <button
          class="action-button cancel-button"
          onclick={handleCancel}
          disabled={isProcessing}
        >
          {cancelText}
        </button>

        <button
          class="action-button confirm-button security-{securityLevel}"
          onclick={handleConfirm}
          disabled={!canConfirm() || isProcessing}
        >
          {#if isProcessing}
            <div class="button-spinner"></div>
            处理中...
          {:else}
            {confirmText}
          {/if}
        </button>
      </div>

      <!-- 处理中遮罩 -->
      {#if isProcessing}
        <div class="processing-overlay">
          <div class="processing-spinner"></div>
          <div class="processing-text">正在处理操作...</div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .confirmation-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in oklab, var(--background-primary), transparent 20%);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    padding: 1rem;
  }

  .confirmation-dialog {
    position: relative;
    background: var(--background-primary);
    border: 2px solid var(--security-border);
    border-radius: 12px;
    box-shadow: var(--shadow-l);
    max-width: 500px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    animation: dialogAppear 0.2s ease-out;
  }

  @keyframes dialogAppear {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* 对话框头部 */
  .dialog-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--security-bg);
    border-bottom: 1px solid var(--security-border);
  }

  .header-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .header-content {
    flex: 1;
  }

  .dialog-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .security-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .security-badge.security-safe {
    background: var(--text-success);
    color: var(--text-on-accent);
  }

  .security-badge.security-caution {
    background: var(--text-warning);
    color: var(--text-on-accent);
  }

  .security-badge.security-danger {
    background: var(--text-error);
    color: var(--text-on-accent);
  }

  /* 对话框内容 */
  .dialog-content {
    padding: 1.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .main-message {
    font-size: 1rem;
    line-height: 1.5;
    color: var(--text-normal);
    margin-bottom: 1rem;
  }

  .details-section,
  .warning-section {
    margin: 1rem 0;
  }

  .details-section h4,
  .warning-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .details-list,
  .warning-list {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-muted);
  }

  .details-list li,
  .warning-list li {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .warning-list li {
    color: var(--text-error);
  }

  /* 文本确认 */
  .text-confirmation {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
  }

  .confirmation-label {
    display: block;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .confirmation-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .confirmation-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .confirmation-input.valid {
    border-color: var(--text-success);
  }

  .input-error {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-error);
  }

  /* 对话框操作 */
  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  .action-button {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border: 2px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .action-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-s);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .cancel-button:hover:not(:disabled) {
    border-color: var(--text-muted);
    background: var(--background-modifier-hover);
  }

  .confirm-button.security-safe:hover:not(:disabled) {
    border-color: var(--text-success);
    background: color-mix(in oklab, var(--text-success), transparent 95%);
    color: var(--text-success);
  }

  .confirm-button.security-caution:hover:not(:disabled) {
    border-color: var(--text-warning);
    background: color-mix(in oklab, var(--text-warning), transparent 95%);
    color: var(--text-warning);
  }

  .confirm-button.security-danger:hover:not(:disabled) {
    border-color: var(--text-error);
    background: color-mix(in oklab, var(--text-error), transparent 95%);
    color: var(--text-error);
  }

  /* 加载指示器 */
  .button-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .processing-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in oklab, var(--background-primary), transparent 10%);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .processing-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--background-modifier-border);
    border-top: 3px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .processing-text {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* 滚动条样式 */
  .dialog-content::-webkit-scrollbar {
    width: 6px;
  }

  .dialog-content::-webkit-scrollbar-track {
    background: var(--background-secondary);
  }

  .dialog-content::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 3px;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .confirmation-overlay {
      padding: 0.5rem;
    }

    .confirmation-dialog {
      max-width: none;
      width: 100%;
    }

    .dialog-header {
      padding: 1rem;
    }

    .dialog-content {
      padding: 1rem;
    }

    .dialog-actions {
      padding: 1rem;
      flex-direction: column;
    }

    .action-button {
      flex: none;
    }
  }
</style>
