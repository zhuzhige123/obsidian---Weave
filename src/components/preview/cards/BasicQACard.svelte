<script lang="ts">
  import type { PreviewSection } from '../ContentPreviewEngine';
  import type { AnimationController } from '../AnimationController';
  import type WeavePlugin from '../../../main';
  import type { Card } from '../../../data/types';
  import ObsidianRenderer from '../../atoms/ObsidianRenderer.svelte';

  interface Props {
    sections: PreviewSection[];
    showAnswer: boolean;
    plugin: WeavePlugin;
    card?: Card;                // 新增：传递完整的卡片对象用于类型检测
    sourcePath?: string;
    animationController?: AnimationController;
    enableAnimations?: boolean;
    activeClozeOrdinal?: number; // 渐进式挖空：当前激活的挖空序号 (1-based)
  }

  let { 
    sections, 
    showAnswer = $bindable(), 
    plugin,
    card,
    sourcePath = '',
    animationController,
    enableAnimations = true,
    activeClozeOrdinal
  }: Props = $props();

  //  修复：分离问题和答案节 - 使用正确的类型匹配
  let questionSections = $derived(sections.filter(s => s.type === 'front'));
  let answerSections = $derived(sections.filter(s => s.type === 'back'));

  // 动画处理
  function handleAnswerReveal(element: HTMLElement): void {
    if (animationController && enableAnimations) {
      animationController.animateContentReveal(element, {
        duration: 400,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        delay: 100
      });
    }
  }

  //  已移除hover效果函数
</script>

<!-- 应用weave-card-base基础样式 -->
<div class="weave-card-base weave-basic-qa-card weave-card-mount">
  <!-- 问题部分 -->
  {#if questionSections.length > 0}
    <div class="weave-qa-question">
      <div class="weave-qa-question-title">
        <span class="weave-qa-label">问题</span>
      </div>
      
      {#each questionSections as section, index}
        <div
          class="weave-qa-question-content"
          class:weave-qa-multiple={questionSections.length > 1}
          role="region"
          aria-label="问题内容区域"
        >
          {#if questionSections.length > 1}
            <div class="weave-qa-field-label">{section.metadata?.title || `字段 ${index + 1}`}</div>
          {/if}
          
          <div class="weave-qa-content">
            <ObsidianRenderer
              {plugin}
              content={section.content}
              {sourcePath}
            />
          </div>
          
          {#if section.metadata?.keywords && section.metadata.keywords.length > 0}
            <div class="weave-qa-keywords">
              {#each section.metadata.keywords as keyword}
                <span class="weave-qa-keyword">{keyword}</span>
              {/each}
            </div>
          {/if}
          
          {#if section.metadata?.truncated}
            <div class="weave-qa-overflow-indicator">
              内容已截断，完整内容请查看原文...
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- 答案部分 -->
  {#if answerSections.length > 0}
    <div 
      class="weave-qa-answer"
      class:weave-qa-answer--hidden={!showAnswer}
    >
      {#if showAnswer}
        <div class="weave-qa-answer-title">
          <span class="weave-qa-label weave-qa-label--answer">答案</span>
        </div>
        
        {#each answerSections as section, index}
          <div
            class="weave-qa-answer-content"
            class:weave-qa-multiple={answerSections.length > 1}
            role="region"
            aria-label="答案内容区域"
            use:handleAnswerReveal
          >
            {#if answerSections.length > 1}
              <div class="weave-qa-field-label">{section.metadata?.title || `字段 ${index + 1}`}</div>
            {/if}
            
            <div class="weave-qa-content">
              <ObsidianRenderer
                {plugin}
                content={section.content}
                {sourcePath}
                enableClozeProcessing={!!activeClozeOrdinal}
                showClozeAnswers={true}
                {card}
                {activeClozeOrdinal}
              />
            </div>
            
            {#if section.metadata?.keywords && section.metadata.keywords.length > 0}
              <div class="weave-qa-keywords">
                {#each section.metadata.keywords as keyword}
                  <span class="weave-qa-keyword">{keyword}</span>
                {/each}
              </div>
            {/if}
            
            {#if section.metadata?.truncated}
              <div class="weave-qa-overflow-indicator">
                内容已截断，完整内容请查看原文...
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="weave-qa-answer-placeholder">
          <div class="weave-qa-placeholder-icon">[?]</div>
          <div class="weave-qa-placeholder-text">点击显示答案查看答案内容</div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- 空状态 -->
  {#if questionSections.length === 0 && answerSections.length === 0}
    <div class="weave-qa-empty">
      <div class="weave-qa-empty-icon">--</div>
      <div class="weave-qa-empty-title">没有可显示的内容</div>
      <div class="weave-qa-empty-description">卡片内容为空或解析失败</div>
    </div>
  {/if}
</div>

<style>
  /* 继承weave-card-base的样式，只定义特殊行为 */
  /* padding和gap由weave-card-base提供 */

  /* 问题样式 - 简洁扁平设计 */
  .weave-qa-question {
    /*  移除边框和背景，避免多层嵌套 */
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0 0 1.5rem 0; /* 只保留底部间距 */
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--background-modifier-border); /* 简单分隔线 */
    transition: border-color var(--weave-duration-normal, 300ms) ease;
  }

  /*  已移除hover颜色变化效果 */

  /* 答案样式 - 简洁扁平设计 */
  .weave-qa-answer {
    /*  移除边框和背景，避免多层嵌套 */
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 1.5rem 0 0 0; /* 只保留顶部间距 */
    transition: opacity var(--weave-duration-normal, 300ms) ease;
  }

  .weave-qa-answer--hidden {
    opacity: 0.6;
    pointer-events: none;
  }

  /* 标题样式 */
  .weave-qa-question-title,
  .weave-qa-answer-title {
    display: flex;
    align-items: center;
    justify-content: flex-start; /* 移除字段统计后改为左对齐 */
    margin-bottom: var(--weave-space-md, 1rem);
    padding-bottom: var(--weave-space-sm, 0.5rem);
    /*  移除底部边框，避免过多分隔线 */
  }

  .weave-qa-label {
    padding: var(--weave-space-xs, 0.25rem) var(--weave-space-sm, 0.5rem);
    background: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
    color: var(--interactive-accent);
    border-radius: var(--weave-radius-sm, 0.375rem);
    font-size: var(--weave-font-size-xs, 0.75rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .weave-qa-label--answer {
    background: var(--weave-success-light, rgba(16, 185, 129, 0.1));
    color: var(--weave-success, #10b981);
  }

  /* 内容样式 */
  .weave-qa-question-content,
  .weave-qa-answer-content {
    margin-bottom: var(--weave-space-md, 1rem);
    transition: all var(--weave-duration-fast, 150ms) ease;
    
    /* 支持文本选择 */
    user-select: text;
    -webkit-user-select: text;
    cursor: auto;
  }

  .weave-qa-question-content:last-child,
  .weave-qa-answer-content:last-child {
    margin-bottom: 0;
  }

  .weave-qa-multiple {
    background: var(--weave-surface, var(--background-primary));
    border: 1px solid var(--weave-border, var(--background-modifier-border));
    border-radius: var(--weave-radius-md, 0.5rem);
    padding: var(--weave-space-md, 1rem);
  }

  .weave-qa-field-label {
    font-size: var(--weave-font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--weave-text-secondary, var(--text-muted));
    margin-bottom: var(--weave-space-sm, 0.5rem);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .weave-qa-content {
    color: var(--weave-text-primary, var(--text-normal));
    line-height: 1.6;
    font-size: var(--weave-font-size-md, 1rem);
    
    /* 支持文本选择 */
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
    cursor: text;
  }

  /* 关键词样式 */
  .weave-qa-keywords {
    display: flex;
    flex-wrap: wrap;
    gap: var(--weave-space-xs, 0.25rem);
    margin-top: var(--weave-space-sm, 0.5rem);
  }

  .weave-qa-keyword {
    background: var(--weave-warning-light, rgba(245, 158, 11, 0.2));
    color: var(--weave-warning, #f59e0b);
    padding: 0.125rem 0.375rem;
    border-radius: var(--weave-radius-sm, 0.375rem);
    font-size: var(--weave-font-size-xs, 0.75rem);
    font-weight: 600;
  }

  /* 溢出指示器 */
  .weave-qa-overflow-indicator {
    color: var(--weave-text-muted, var(--text-muted));
    font-style: italic;
    text-align: center;
    margin-top: var(--weave-space-sm, 0.5rem);
    font-size: var(--weave-font-size-sm, 0.875rem);
  }

  /* 答案占位符 */
  .weave-qa-answer-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--weave-space-xl, 2rem);
    text-align: center;
    opacity: 0.7;
  }

  .weave-qa-placeholder-icon {
    font-size: 2rem;
    margin-bottom: var(--weave-space-sm, 0.5rem);
  }

  .weave-qa-placeholder-text {
    color: var(--weave-text-secondary, var(--text-muted));
    font-size: var(--weave-font-size-sm, 0.875rem);
  }

  /* 空状态 */
  .weave-qa-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--weave-space-xl, 2rem);
    text-align: center;
    opacity: 0.6;
  }

  .weave-qa-empty-icon {
    font-size: 2.5rem;
    margin-bottom: var(--weave-space-md, 1rem);
  }

  .weave-qa-empty-title {
    font-size: var(--weave-font-size-lg, 1.125rem);
    font-weight: 600;
    color: var(--weave-text-primary, var(--text-normal));
    margin-bottom: var(--weave-space-sm, 0.5rem);
  }

  .weave-qa-empty-description {
    color: var(--weave-text-secondary, var(--text-muted));
    font-size: var(--weave-font-size-sm, 0.875rem);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .weave-basic-qa-card {
      padding: var(--weave-space-md, 1rem);
      gap: var(--weave-space-md, 1rem);
    }

    .weave-qa-question,
    .weave-qa-answer {
      /*  移动端保持简洁，由容器padding控制间距 */
      padding: 0 0 1rem 0;
    }

    .weave-qa-content {
      font-size: var(--weave-font-size-sm, 0.875rem);
    }

    .weave-qa-question-title,
    .weave-qa-answer-title {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--weave-space-xs, 0.25rem);
    }
  }

  /* 可访问性增强 */
  .weave-qa-question-content:focus,
  .weave-qa-answer-content:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  /* 减少动画（用户偏好） */
  @media (prefers-reduced-motion: reduce) {
    .weave-qa-question,
    .weave-qa-answer,
    .weave-qa-question-content,
    .weave-qa-answer-content {
      transition: none;
    }
  }
</style>
