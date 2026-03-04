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
    sourcePath?: string;
    animationController?: AnimationController;
    enableAnimations?: boolean;
    card?: Card;
    activeClozeOrdinal?: number; // 渐进式挖空：当前激活的挖空序号 (1-based)
  }

  let { 
    sections, 
    showAnswer = $bindable(), 
    plugin,
    sourcePath = '',
    animationController,
    enableAnimations = true,
    card,
    activeClozeOrdinal
  }: Props = $props();
</script>

<!-- 应用weave-card-base基础样式 -->
<div class="weave-card-base weave-cloze-card weave-card-mount">
  <!--  统一使用ObsidianRenderer，通过传递card参数处理渐进式挖空 -->
  
  <!-- 挖空内容 -->
  <div class="weave-cloze-content">
    {#each sections as section}
      <!-- 只渲染front类型的section作为挖空区域 -->
      {#if section.type === 'front'}
        <div class="weave-cloze-section">
          {#if section.metadata?.title}
            <div class="weave-cloze-section-title">{section.metadata.title}</div>
          {/if}
          
          <!--  ObsidianRenderer处理所有挖空（包括渐进式挖空子卡片） -->
          <div class="weave-cloze-text">
            <ObsidianRenderer
              {plugin}
              content={section.content}
              {sourcePath}
              enableClozeProcessing={true}
              showClozeAnswers={showAnswer}
              {card}
              {activeClozeOrdinal}
            />
          </div>
        </div>
      {/if}
    {/each}
  </div>
  
  <!--  背面内容区域（---div---分隔符后的内容） -->
  {#if showAnswer}
    {#each sections as section}
      {#if section.type === 'back'}
        <div class="weave-cloze-back-section">
          <ObsidianRenderer
            {plugin}
            content={section.content}
            {sourcePath}
            enableClozeProcessing={false}
            showClozeAnswers={true}
            {card}
            {activeClozeOrdinal}
          />
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  /* 继承weave-card-base的样式，只定义特殊行为 */
  /* padding和gap由weave-card-base提供 */

  /* 内容样式 */
  .weave-cloze-content {
    display: flex;
    flex-direction: column;
    gap: var(--weave-space-md, 1rem);
    
    /* 支持文本选择 */
    user-select: text;
    -webkit-user-select: text;
    cursor: auto;
  }

  .weave-cloze-section {
    background: var(--weave-surface, var(--background-primary));
    border-radius: var(--weave-radius-md, 0.5rem);
    padding: var(--weave-space-lg, 1.5rem);
    transition: all var(--weave-duration-normal, 300ms) ease;
  }

  /*  已移除hover浮动和颜色变化效果 */

  .weave-cloze-section-title {
    font-size: var(--weave-font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--weave-text-secondary, var(--text-muted));
    margin-bottom: var(--weave-space-md, 1rem);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .weave-cloze-text {
    color: var(--weave-text-primary, var(--text-normal));
    line-height: 1.6;
    font-size: var(--weave-font-size-md, 1rem);
  }

  /* 背面内容区域样式 - 保持Obsidian原生渲染风格 */
  .weave-cloze-back-section {
    margin-top: var(--weave-space-md, 1rem);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .weave-cloze-section {
      padding: var(--weave-space-md, 1rem);
    }
  }

  /* 减少动画（用户偏好） */
  @media (prefers-reduced-motion: reduce) {
    .weave-cloze-section {
      transition: none;
    }

    /*  已移除hover transform效果 */
  }
</style>
