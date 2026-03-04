<!--
  全局清理进度模态窗口 - Svelte组件版本
  设计风格：与Weave插件统一，现代化、简洁
  将原TypeScript类转换为Svelte组件
-->
<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import type { GlobalCleanupScanner } from '../../services/cleanup/GlobalCleanupScanner';
  import type { ScanProgress, GlobalScanResult } from '../../services/cleanup/types';

  interface Props {
    /** 是否显示模态窗 */
    open: boolean;
    
    /** 关闭回调 */
    onClose: () => void;
    
    /** 清理扫描器实例 */
    scanner: GlobalCleanupScanner;
  }

  let { 
    open = $bindable(), 
    onClose, 
    scanner 
  }: Props = $props();

  // 组件状态
  let progress = $state(0);
  let currentFile = $state('');
  let progressText = $state('准备开始...');
  let stats = $state<GlobalScanResult | null>(null);
  let isCancelled = $state(false);
  let isCompleted = $state(false);

  // 启动清理进程
  async function startCleanup() {
    isCancelled = false;
    isCompleted = false;
    
    try {
      // 监听进度更新
      const unsubscribe = scanner.onProgress((progressData: ScanProgress) => {
        progress = progressData.percentage;
        currentFile = progressData.currentFile;
        progressText = `${progressData.processedFiles}/${progressData.totalFiles}`;
      });

      // 执行清理
      const result = await scanner.performCleanup();
      stats = result;
      isCompleted = true;

      // 清理监听器
      unsubscribe?.();
    } catch (error) {
      logger.error('清理过程出错:', error);
      progressText = '清理失败';
    }
  }

  // 取消清理
  function cancelCleanup() {
    isCancelled = true;
    scanner.cancel?.();
  }

  // 关闭模态窗
  function handleClose() {
    if (!isCompleted && !isCancelled) {
      cancelCleanup();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  // 组件挂载时启动清理
  onMount(() => {
    if (open) {
      startCleanup();
    }
  });

  // 监听open变化
  $effect(() => {
    if (open && !isCompleted && !isCancelled) {
      startCleanup();
    }
  });
</script>

{#if open}
<div 
  class="modal-overlay" 
  onclick={(e) => {
    // 只有点击overlay背景时才关闭，点击内容区域不关闭
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }}
  onkeydown={(_e) => {}}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- 模态窗内容容器：纯展示容器，无需事件处理器 -->
  <div 
    class="cleanup-progress-modal" 
    aria-labelledby="cleanup-modal-title"
  >
    <!-- 标题栏 -->
    <header class="modal-header">
      <h2 id="cleanup-modal-title">全局清理孤立块链接</h2>
    </header>

    <!-- 主体内容 -->
    <div class="modal-body">
      <!-- 进度条 -->
      <div class="progress-container">
        <div class="progress-bar" style="width: {progress}%"></div>
      </div>

      <!-- 状态信息 -->
      <div class="status-section">
        {#if currentFile}
          <div class="current-file">
            <span class="label">当前处理:</span>
            <span class="value">{currentFile}</span>
          </div>
        {/if}
        
        <div class="progress-text">
          <span class="label">进度:</span>
          <span class="value">{progressText}</span>
        </div>
      </div>

      <!-- 统计信息 -->
      {#if stats}
        <div class="stats-section">
          <div class="stat-item">
            <span class="stat-label">处理文件</span>
            <span class="stat-value processed">{stats.totalFiles}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">清理链接</span>
            <span class="stat-value cleaned">{stats.cleanedOrphans}</span>
          </div>
          {#if stats.errors && stats.errors.length > 0}
            <div class="stat-item error">
              <span class="stat-label">错误</span>
              <span class="stat-value">{stats.errors.length}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 底部按钮 -->
    <footer class="modal-footer">
      {#if !isCompleted && !isCancelled}
        <button class="cancel-btn" onclick={cancelCleanup}>
          取消清理
        </button>
      {:else}
        <button class="close-btn" onclick={handleClose}>
          完成
        </button>
      {/if}
    </footer>
  </div>
</div>
{/if}

<style>
  /* =========================== 模态窗口主体 =========================== */
  .cleanup-progress-modal {
    --modal-bg: var(--background-primary);
    --modal-text: var(--text-normal);
    --modal-border: var(--background-modifier-border);
    --progress-bg: var(--background-modifier-border);
    --progress-fill: var(--interactive-accent);
    --success-color: var(--color-green);
    --error-color: var(--color-red);
    --stat-label-color: var(--text-muted);
    
    max-width: 600px;
    padding: 0;
    background: var(--modal-bg);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
  }

  .modal-header {
    padding: 24px 32px;
    border-bottom: 1px solid var(--modal-border);
    background: var(--modal-bg);
    border-radius: 12px 12px 0 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--modal-text);
  }

  .modal-body {
    padding: 32px;
    background: var(--modal-bg);
  }

  /* =========================== 进度条 =========================== */
  .progress-container {
    width: 100%;
    height: 8px;
    background: var(--progress-bg);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .progress-bar {
    height: 100%;
    background: var(--progress-fill);
    transition: width 0.3s ease;
    border-radius: 4px;
    animation: progress-glow 2s ease-in-out infinite;
  }

  /* 当进度完成时，停止动画 */
  .progress-bar[style*="width: 100%"] {
    animation: none;
  }

  @keyframes progress-glow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* =========================== 状态区域 =========================== */
  .status-section {
    margin-bottom: 24px;
  }

  .current-file,
  .progress-text {
    margin-bottom: 12px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--modal-text);
  }

  .label {
    font-weight: 500;
    color: var(--stat-label-color);
    margin-right: 8px;
  }

  .value {
    color: var(--modal-text);
    font-family: var(--font-monospace);
    font-size: 13px;
    word-break: break-all;
  }

  /* =========================== 统计区域 =========================== */
  .stats-section {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 24px;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--modal-border);
  }

  .stat-item:last-child {
    border-bottom: none;
  }

  .stat-label {
    font-size: 14px;
    color: var(--stat-label-color);
    font-weight: 500;
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--modal-text);
    font-family: var(--font-monospace);
  }

  .stat-value.processed {
    color: var(--interactive-accent);
  }

  .stat-value.cleaned {
    color: var(--success-color);
  }

  .stat-item.error .stat-value {
    color: var(--error-color);
  }

  /* =========================== 底部按钮 =========================== */
  .modal-footer {
    padding: 16px 32px;
    border-top: 1px solid var(--modal-border);
    background: var(--modal-bg);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-radius: 0 0 12px 12px;
  }

  .cancel-btn,
  .close-btn {
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    outline: none;
  }

  .cancel-btn {
    background: var(--interactive-normal);
    color: var(--text-on-accent);
  }

  .cancel-btn:hover {
    background: var(--interactive-hover);
  }

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .close-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .close-btn:hover {
    background: var(--interactive-accent-hover);
  }

  /* =========================== 响应式设计 =========================== */
  @media (max-width: 768px) {
    .cleanup-progress-modal {
      max-width: 90vw;
    }
    
    .modal-header,
    .modal-body,
    .modal-footer {
      padding-left: 20px;
      padding-right: 20px;
    }
  }

  /* =========================== 暗色主题优化 =========================== */
  :global(.theme-dark) .stats-section {
    background: var(--background-primary-alt);
  }
</style>
