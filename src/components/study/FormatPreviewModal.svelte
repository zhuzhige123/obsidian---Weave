<script lang="ts">
  import type { FormatPreviewResult } from '../../types/ai-types';
  
  interface Props {
    show: boolean;
    previewResult: FormatPreviewResult;
    actionName: string;
    onConfirm: () => void;
    onCancel: () => void;
  }
  
  let { show, previewResult, actionName, onConfirm, onCancel }: Props = $props();
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="format-preview-overlay" onclick={onCancel}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="format-preview-modal" onclick={(e) => e.stopPropagation()}>
      <!-- 头部 - 使用多彩侧边颜色条 -->
      <div class="format-preview-header">
        <h3 class="format-title with-accent-bar accent-ai">AI格式化预览 - {actionName}</h3>
        <button class="format-preview-close" onclick={onCancel}>×</button>
      </div>
      
      <!-- 内容区 -->
      <div class="format-preview-content">
        <!-- 对比面板 -->
        <div class="format-comparison">
          <!-- 原始内容面板 -->
          <div class="format-panel format-panel-original">
            <div class="format-panel-title">原始内容</div>
            <div class="format-panel-body">
              {previewResult?.originalContent || '(无内容)'}
            </div>
          </div>
          
          <!-- 箭头 -->
          <div class="format-arrow">→</div>
          
          <!-- 格式化后面板 -->
          <div class="format-panel format-panel-formatted">
            <div class="format-panel-title">
              格式化后
              {#if previewResult?.provider}
                <span class="format-provider-tag">{previewResult.provider}</span>
              {/if}
            </div>
            <div class="format-panel-body">
              {previewResult?.formattedContent || '(无内容)'}
            </div>
          </div>
        </div>
        
        <!-- 错误信息 -->
        {#if !previewResult?.success}
          <div class="format-error">
            {previewResult?.error || '未知错误'}
          </div>
        {/if}
      </div>
      
      <!-- 底部按钮 -->
      <div class="format-preview-footer">
        <button class="format-btn format-btn-cancel" onclick={onCancel}>取消</button>
        <button 
          class="format-btn format-btn-confirm" 
          onclick={onConfirm}
          disabled={!previewResult?.success}
        >
          应用更改
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /*  完全重构的样式 - 使用独立命名空间避免冲突 */
  .format-preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
  }
  
  .format-preview-modal {
    background: var(--background-primary, #1e1e1e);
    border-radius: 12px;
    width: 90vw;
    max-width: 960px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 1px solid var(--background-modifier-border, #333);
    overflow: hidden;
  }
  
  .format-preview-header {
    padding: 16px 20px;
    background: var(--background-secondary, #252525);
    border-bottom: 1px solid var(--background-modifier-border, #333);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  /* 多彩侧边颜色条标题样式 */
  .format-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal, #ddd);
  }

  .format-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 70%;
    border-radius: 2px;
  }

  /* AI主题渐变色 - 紫蓝渐变 */
  .format-title.accent-ai::before {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  .format-preview-close {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted, #888);
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1;
  }
  
  .format-preview-close:hover {
    background: var(--background-modifier-hover, #333);
    color: var(--text-normal, #ddd);
  }
  
  .format-preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  
  .format-comparison {
    display: flex;
    gap: 16px;
    align-items: stretch;
  }
  
  .format-panel {
    flex: 1;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .format-panel-original {
    border: 2px solid #ff6b6b;
    background: var(--background-secondary, #252525);
  }
  
  .format-panel-formatted {
    border: 2px solid #51cf66;
    background: var(--background-secondary, #252525);
  }
  
  .format-panel-title {
    padding: 12px 16px;
    background: var(--background-modifier-border, #333);
    font-weight: 600;
    font-size: 14px;
    color: var(--text-normal, #ddd);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .format-provider-tag {
    margin-left: auto;
    padding: 2px 8px;
    background: var(--text-accent, #7c3aed);
    color: white;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .format-panel-body {
    padding: 16px;
    min-height: 180px;
    max-height: 320px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-normal, #ddd);
    background: var(--background-primary, #1e1e1e);
  }
  
  .format-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    color: var(--text-accent, #7c3aed);
    padding: 0 8px;
    align-self: center;
  }
  
  .format-error {
    margin-top: 16px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    border-radius: 6px;
    color: #ef4444;
    font-size: 14px;
  }
  
  .format-preview-footer {
    padding: 16px 20px;
    background: var(--background-secondary, #252525);
    border-top: 1px solid var(--background-modifier-border, #333);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  
  .format-btn {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .format-btn-cancel {
    background: var(--background-modifier-border, #333);
    color: var(--text-normal, #ddd);
  }
  
  .format-btn-cancel:hover {
    background: var(--background-modifier-hover, #444);
  }
  
  .format-btn-confirm {
    background: var(--text-accent, #7c3aed);
    color: white;
  }
  
  .format-btn-confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  
  .format-btn-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .format-comparison {
      flex-direction: column;
    }
    
    .format-arrow {
      transform: rotate(90deg);
      padding: 8px 0;
    }
    
    .format-preview-modal {
      width: 95vw;
      max-height: 90vh;
    }
  }
</style>

