<script lang="ts">
  import type { Card } from '../../data/types';

  interface Props {
    card: Card;
    onClose: () => void;
  }

  let { card, onClose }: Props = $props();

  // 格式化JSON数据
  const formattedJson = JSON.stringify(card, null, 2);
  
  function handleKeydown(_e: KeyboardEvent) {
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="card-debug-backdrop" 
  onclick={onClose}
  onkeydown={handleKeydown}
>
  <div 
    class="card-debug-container" 
    onclick={(e) => { e.preventDefault(); }} 
    role="dialog" 
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="card-debug-title"
  >
    <div class="card-debug-header">
      <h3 id="card-debug-title">卡片数据结构</h3>
      <button class="card-debug-close" onclick={onClose}>×</button>
    </div>
    
    <div class="card-debug-content">
      <pre class="card-debug-json">{formattedJson}</pre>
    </div>
  </div>
</div>

<style>
  .card-debug-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-tooltip);
  }

  .card-debug-container {
    background: var(--background-primary);
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .card-debug-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .card-debug-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .card-debug-close {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .card-debug-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .card-debug-content {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--background-secondary);
  }

  .card-debug-json {
    margin: 0;
    font-family: var(--font-monospace);
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-normal);
    white-space: pre;
    word-wrap: break-word;
  }
</style>
