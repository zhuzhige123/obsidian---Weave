<script lang="ts">
  import { Platform } from "obsidian";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";

  interface Props {
    hasSubmitted: boolean;
    hasAnswer: boolean;
    isLastQuestion: boolean;
    onSubmit: () => void;
    onNext: () => void;
    /**  移动端：撤销功能 */
    canUndo?: boolean;
    undoRemaining?: number;
    onUndo?: () => void;
  }

  let { hasSubmitted, hasAnswer, isLastQuestion, onSubmit, onNext, canUndo = false, undoRemaining = 0, onUndo }: Props = $props();
  
  const isMobile = Platform.isMobile;
</script>

<div class="action-section" class:is-mobile={isMobile}>
  {#if !hasSubmitted}
    <!-- 提交答案区域 -->
    <div class="submit-answer-area">
      <button 
        class="submit-answer-btn" 
        onclick={onSubmit}
        disabled={!hasAnswer}
      >
        <span>提交答案</span>
      </button>
    </div>
  {:else}
    <!--  移动端：撤销和完成测试水平排列 -->
    {#if isMobile}
      <div class="mobile-action-row">
        {#if canUndo && onUndo}
          <button
            class="mobile-undo-btn"
            onclick={onUndo}
            disabled={!canUndo}
          >
            <EnhancedIcon name="undo" size="16" />
            <span>撤销 ({undoRemaining})</span>
          </button>
        {/if}
        <button class="next-question-btn" onclick={onNext}>
          {#if isLastQuestion}
            <span>完成测试</span>
          {:else}
            <span>下一题</span>
          {/if}
        </button>
      </div>
    {:else}
      <!-- 桌面端：下一题/完成测试区域 -->
      <div class="next-question-area">
        <button class="next-question-btn" onclick={onNext}>
          {#if isLastQuestion}
            <EnhancedIcon name="check" size="20" />
            <span>完成测试</span>
          {:else}
            <EnhancedIcon name="chevron-right" size="20" />
            <span>下一题</span>
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .action-section {
    background: transparent;
    padding: 0;
  }

  /* 提交答案区域 */
  .submit-answer-area {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .submit-answer-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    /*  修复：使用明确的颜色确保在所有主题下可见 */
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    /* 确保按钮在浅色背景下也可见 */
    border: 1px solid var(--interactive-accent);
    border-radius: 0.75rem;
    padding: 1rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--weave-shadow-md);
  }

  .submit-answer-btn:hover:not(:disabled) {
    box-shadow: var(--weave-shadow-lg);
    background: var(--interactive-accent-hover);
  }

  .submit-answer-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-answer-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-answer-btn kbd {
    background: rgba(255, 255, 255, 0.2);
    color: currentColor; /* ✅ 继承父元素颜色，保持一致性 */
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: bold;
    margin: 0;
    opacity: 0.9;
  }

  /* 下一题/完成测试区域 */
  .next-question-area {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .next-question-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    /*  修复：明确指定背景和文字颜色 */
    background: var(--weave-success);
    color: white; /* 白色文字在绿色背景上始终可见 */
    /* 添加边框确保在浅色背景下按钮边界可见 */
    border: 1px solid var(--weave-success);
    border-radius: 0.75rem;
    padding: 1rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--weave-shadow-md);
  }

  .next-question-btn:hover {
    box-shadow: var(--weave-shadow-lg);
    background: color-mix(in srgb, var(--weave-success) 90%, black);
  }

  .next-question-btn:active {
    transform: translateY(0);
  }

  /*  主题适配：确保按钮在所有主题下都可见 */
  /* 浅色模式下的按钮颜色优化 */
  :global(body.theme-light) .next-question-btn {
    background: #10b981; /* 明确的绿色 */
    color: #ffffff; /* 明确的白色文字 */
    border-color: #10b981;
  }

  :global(body.theme-light) .submit-answer-btn {
    background: var(--interactive-accent);
    color: #ffffff; /* 确保文字是白色 */
    border-color: var(--interactive-accent);
  }

  /* 深色模式下的按钮颜色优化 */
  :global(body.theme-dark) .next-question-btn {
    background: #10b981;
    color: #ffffff;
    border-color: #10b981;
  }

  :global(body.theme-dark) .submit-answer-btn {
    background: var(--interactive-accent);
    color: #ffffff;
    border-color: var(--interactive-accent);
  }

  /* 桌面端不进行布局重排，移动端布局由 :global(body.is-mobile) 控制 */

  /*  移动端水平排列按钮容器 */
  .mobile-action-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .mobile-undo-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mobile-undo-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .mobile-undo-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /*  移动端样式优化 */
  .action-section.is-mobile {
    padding: 0.5rem 1rem;
  }

  .action-section.is-mobile .submit-answer-btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    width: 100%;
    justify-content: center;
  }

  .mobile-action-row .next-question-btn {
    padding: 0.6rem 1.25rem;
    font-size: 0.9rem;
    flex: 1;
    max-width: 160px;
  }
</style>

