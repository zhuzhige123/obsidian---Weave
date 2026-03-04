<script lang="ts">
  import type { AIActionType } from '../../types/ai-types';
  
  interface Props {
    activeType: AIActionType;
    formatCount: number;
    splitCount: number;
    onTypeChange: (type: AIActionType) => void;
  }
  
  let { activeType, formatCount, splitCount, onTypeChange }: Props = $props();
</script>

<div class="action-type-tab-bar">
  <button 
    class="tab-btn" 
    class:active={activeType === 'format'}
    onclick={() => onTypeChange('format')}
  >
    <span>AI格式化</span>
    <span class="count-badge">{formatCount}</span>
  </button>
  
  <button 
    class="tab-btn" 
    class:active={activeType === 'split'}
    onclick={() => onTypeChange('split')}
  >
    <span>AI拆分</span>
    <span class="count-badge">{splitCount}</span>
  </button>
</div>

<style>
  .action-type-tab-bar {
    display: flex;
    gap: 4px; /* 参考教程模态窗的标签页间距设计 */
    border-bottom: none; /* 移除底部边框，由父容器处理 */
    margin-bottom: 0; /* 移除底部边距，适应顶部布局 */
    overflow-x: auto; /* 防止内容溢出 */
    background: var(--background-primary);
  }
  
  .tab-btn {
    /* 移除 flex: 1，改为自适应宽度 */
    display: flex;
    align-items: center;
    gap: 6px; /* 参考AIConfigModal的gap */
    padding: 12px 20px; /* 参考AIConfigModal的padding */
    min-width: fit-content; /* 确保内容不被压缩 */
    white-space: nowrap; /* 防止文字换行 */
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: 0; /* 顶部布局不需要负边距 */
    color: var(--text-muted); /* 使用标准颜色变量 */
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease; /* 缩短过渡时间 */
    position: relative;
  }
  
  .tab-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
  
  .tab-btn.active {
    color: var(--interactive-accent);
    border-bottom-color: var(--interactive-accent);
    background: var(--background-primary);
  }
  
  .tab-btn:focus-visible {
    outline: 2px solid var(--weave-accent-color);
    outline-offset: -2px;
  }
  
  .count-badge {
    padding: 2px 6px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 10px;
    transition: all 0.2s ease;
    min-width: fit-content;
  }
  
  .tab-btn.active .count-badge {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .tab-btn:hover .count-badge {
    transform: scale(1.05);
  }
</style>

