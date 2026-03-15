<!--
  历史继承策略选择弹窗
  
  当卡片从普通格式转换为渐进式挖空时，如果有学习历史，
  让用户选择如何处理这些历史数据
-->
<script lang="ts">
  import { Modal } from 'obsidian';
  import type { Card } from '../../data/types';
  import type { InheritanceOptions } from '../../services/progressive-cloze/CardSaveProcessor';
  
  interface Props {
    parentCard: Card;
    clozes: Array<{ ord: number; text: string; hint?: string }>;
    onConfirm: (options: InheritanceOptions, rememberChoice: boolean) => void;
    onCancel: () => void;
  }
  
  let {
    parentCard,
    clozes,
    onConfirm,
    onCancel
  }: Props = $props();
  
  let selectedOption = $state<'specific' | 'proportional' | 'reset'>('specific');
  let targetIndex = $state(0);
  let rememberChoice = $state(false);
  
  // 获取FSRS信息
  const fsrsInfo = $derived({
    reps: parentCard.fsrs?.reps ?? 0,
    difficulty: parentCard.fsrs?.difficulty?.toFixed(1) ?? '0',
    stability: parentCard.fsrs?.stability?.toFixed(1) ?? '0'
  });
  
  function handleConfirm() {
    const options: InheritanceOptions = selectedOption === 'specific'
      ? { mode: 'specific', targetIndex }
      : { mode: selectedOption };
    
    onConfirm(options, rememberChoice);
  }

  function handleBackdropPointerDown(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }
</script>

<div class="modal-backdrop" onmousedown={handleBackdropPointerDown} role="presentation">
  <div class="modal-container" role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-header">
      <h2 class="modal-title">检测到学习历史</h2>
      <button class="modal-close" onclick={onCancel}>×</button>
    </div>
    
    <div class="modal-body">
      <div class="warning-info">
        <p class="info-text">
          此卡片已复习 <strong>{fsrsInfo.reps}</strong> 次，
          转换为渐进式挖空后如何处理这些数据？
        </p>
        <div class="fsrs-details">
          <span class="detail-item">难度: {fsrsInfo.difficulty}</span>
          <span class="detail-item">稳定性: {fsrsInfo.stability}天</span>
        </div>
      </div>
      
      <div class="options-container">
        <!-- 选项1: 指定子挖空继承 -->
        <label class="option-card" class:selected={selectedOption === 'specific'}>
          <input 
            type="radio" 
            name="inheritance" 
            value="specific"
            bind:group={selectedOption}
          />
          <div class="option-content">
            <div class="option-header">
              <span class="option-icon">[1]</span>
              <span class="option-title">由指定子挖空继承</span>
            </div>
            <p class="option-desc">学习历史数据保留，其他子挖空作为新卡片</p>
            
            {#if selectedOption === 'specific'}
              <div class="subcloze-selector">
                {#each clozes as cloze, index}
                  <label class="subcloze-option">
                    <input 
                      type="radio" 
                      name="target" 
                      value={index}
                      bind:group={targetIndex}
                    />
                    <span class="subcloze-text">
                      子挖空 {index + 1}：{cloze.text}
                    </span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        </label>
        
        <!-- 选项2: 按比例分配 -->
        <label class="option-card" class:selected={selectedOption === 'proportional'}>
          <input 
            type="radio" 
            name="inheritance" 
            value="proportional"
            bind:group={selectedOption}
          />
          <div class="option-content">
            <div class="option-header">
              <span class="option-icon">[3]</span>
              <span class="option-title">所有子挖空按比例继承</span>
            </div>
            <p class="option-desc">每个子挖空继承部分学习历史（稳定性、复习次数等分）</p>
          </div>
        </label>
        
        <!-- 选项3: 全部重置 -->
        <label class="option-card" class:selected={selectedOption === 'reset'}>
          <input 
            type="radio" 
            name="inheritance" 
            value="reset"
            bind:group={selectedOption}
          />
          <div class="option-content">
            <div class="option-header">
              <span class="option-icon">[2]</span>
              <span class="option-title">归零（重置为新卡片）</span>
            </div>
            <p class="option-desc">清除学习历史，所有子挖空从头开始</p>
          </div>
        </label>
      </div>
    </div>
    
    <div class="modal-footer">
      <label class="remember-checkbox">
        <input type="checkbox" bind:checked={rememberChoice} />
        <span>记住我的选择，下次不再提示</span>
      </label>
      
      <div class="action-buttons">
        <button class="btn btn-secondary" onclick={onCancel}>
          取消
        </button>
        <button class="btn btn-primary" onclick={handleConfirm}>
          确认转换
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    backdrop-filter: blur(2px);
  }
  
  .modal-container {
    background: var(--background-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 28px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .modal-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  
  .warning-info {
    background: var(--background-secondary);
    border-left: 4px solid var(--interactive-accent);
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
  }
  
  .info-text {
    margin: 0 0 12px 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-normal);
  }
  
  .info-text strong {
    color: var(--interactive-accent);
    font-weight: 600;
  }
  
  .fsrs-details {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--text-muted);
  }
  
  .detail-item {
    background: var(--background-primary);
    padding: 4px 12px;
    border-radius: 12px;
  }
  
  .options-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .option-card {
    display: block;
    padding: 16px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .option-card:hover {
    border-color: var(--interactive-accent-hover);
    background: var(--background-secondary);
  }
  
  .option-card.selected {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-success);
  }
  
  .option-card input[type="radio"] {
    display: none;
  }
  
  .option-content {
    flex: 1;
  }
  
  .option-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .option-icon {
    font-size: 20px;
  }
  
  .option-title {
    font-weight: 600;
    font-size: 15px;
    color: var(--text-normal);
  }
  
  .option-desc {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }
  
  .subcloze-selector {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .subcloze-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .subcloze-option:hover {
    background: var(--background-modifier-hover);
  }
  
  .subcloze-option input[type="radio"] {
    cursor: pointer;
  }
  
  .subcloze-text {
    font-size: 14px;
    color: var(--text-normal);
  }
  
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  .remember-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
  }
  
  .remember-checkbox input {
    cursor: pointer;
  }
  
  .action-buttons {
    display: flex;
    gap: 12px;
  }
  
  .btn {
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .btn-secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }
  
  .btn-secondary:hover {
    background: var(--background-modifier-border-hover);
  }
  
  .btn-primary {
    background: var(--interactive-accent);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--interactive-accent-hover);
  }
</style>
