<script lang="ts">
  /**
   * IRRatingModal - 理解度自评弹窗
   * 
   * 完成内容块阅读后弹出，用户选择理解程度：
   * - 1 忽略：标记为suspended，不再安排复习
   * - 2 一般：略微减少间隔
   * - 3 清晰：保持正常间隔
   * - 4 精通：增加复习间隔
   */
  import { createEventDispatcher } from 'svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  // v3.0: 从 IRFocusInterface 导入 IRRating 类型
  import type { IRRating } from './IRFocusInterface.svelte';

  interface Props {
    open: boolean;
    blockTitle?: string;
    readingTime?: number;
    onRate: (rating: IRRating) => void;
    onClose: () => void;
  }

  let {
    open = false,
    blockTitle = '',
    readingTime = 0,
    onRate,
    onClose
  }: Props = $props();

  // 评分选项（移除"困惑"，添加"忽略"用于标记不再复习的内容）
  const ratingOptions: { rating: IRRating; emoji: string; label: string; desc: string; color: string; isIgnore?: boolean }[] = [
    { rating: 1, emoji: '🚫', label: '忽略', desc: '不再安排复习', color: 'var(--text-muted)', isIgnore: true },
    { rating: 2, emoji: '🤔', label: '一般', desc: '还需复习', color: 'var(--text-warning)' },
    { rating: 3, emoji: '😊', label: '清晰', desc: '理解良好', color: 'var(--text-success)' },
    { rating: 4, emoji: '🎯', label: '精通', desc: '完全掌握', color: 'var(--interactive-accent)' }
  ];

  // 格式化阅读时长
  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`;
  }

  // 处理评分
  function handleRate(rating: IRRating) {
    onRate(rating);
  }

  // 处理键盘快捷键
  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    
    const key = parseInt(e.key);
    if (key >= 1 && key <= 4) {
      handleRate(key as IRRating);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="rating-modal-overlay">
    <button
      type="button"
      class="rating-modal-backdrop"
      aria-label="关闭理解评分"
      onclick={onClose}
    ></button>
    <div class="rating-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <h3>这段内容理解程度如何？</h3>
        {#if blockTitle}
          <p class="block-title">{blockTitle}</p>
        {/if}
      </div>

      {#if readingTime > 0}
        <div class="reading-time">
          <EnhancedIcon name="clock" size={14} />
          <span>阅读时长: {formatTime(readingTime)}</span>
        </div>
      {/if}

      <div class="rating-options">
        {#each ratingOptions as option}
          <button 
            class="rating-btn"
            onclick={() => handleRate(option.rating)}
            style="--rating-color: {option.color}"
          >
            <span class="emoji">{option.emoji}</span>
            <span class="label">{option.label}</span>
            <span class="desc">{option.desc}</span>
            <span class="shortcut">{option.rating}</span>
          </button>
        {/each}
      </div>

      <div class="modal-footer">
        <span class="hint">按 1-4 快速选择，或点击按钮</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .rating-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    animation: fadeIn 0.15s ease;
  }

  .rating-modal-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .rating-modal {
    background: var(--background-primary);
    border-radius: 12px;
    padding: 24px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .modal-header h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .block-title {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reading-time {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 20px;
  }

  .rating-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .rating-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 8px;
    background: var(--background-secondary);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .rating-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--rating-color);
    transform: translateY(-2px);
  }

  .rating-btn:active {
    transform: translateY(0);
  }

  .rating-btn .emoji {
    font-size: 28px;
    line-height: 1;
  }

  .rating-btn .label {
    font-size: 14px;
    font-weight: 600;
    color: var(--rating-color);
  }

  .rating-btn .desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .rating-btn .shortcut {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 10px;
    color: var(--text-faint);
    background: var(--background-modifier-border);
    padding: 2px 5px;
    border-radius: 4px;
  }

  .modal-footer {
    margin-top: 16px;
    text-align: center;
  }

  .hint {
    font-size: 12px;
    color: var(--text-faint);
  }

  /* 移动端适配 */
  @media (max-width: 480px) {
    .rating-options {
      grid-template-columns: repeat(2, 1fr);
    }

    .rating-btn {
      padding: 12px 8px;
    }

    .rating-btn .emoji {
      font-size: 24px;
    }
  }
</style>
