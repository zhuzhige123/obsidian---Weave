<!--
  RescheduleMaterialModal - 手动调整阅读材料日期
  
  允许用户手动设置材料的下次复习日期，覆盖 FSRS 自动调度
  
  @module components/incremental-reading/RescheduleMaterialModal
  @version 1.0.0
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import type { ReadingMaterial } from '../../types/incremental-reading-types';
  import { logger } from '../../utils/logger';

  // Props
  interface Props {
    plugin: WeavePlugin;
    material: ReadingMaterial;
    onClose: () => void;
    onReschedule: (newDate: Date) => void;
  }

  let { plugin, material, onClose, onReschedule }: Props = $props();

  // State
  let selectedDate = $state<string>('');
  let showContent = $state(false);

  // 预设选项
  const presets = [
    { label: '明天', days: 1 },
    { label: '3天后', days: 3 },
    { label: '1周后', days: 7 },
    { label: '2周后', days: 14 },
    { label: '1个月后', days: 30 },
  ];

  // 初始化日期
  function initDate(): void {
    const today = new Date();
    today.setDate(today.getDate() + 1); // 默认明天
    selectedDate = formatDateForInput(today);
  }

  // 格式化日期为 input[type=date] 格式
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 应用预设
  function applyPreset(days: number): void {
    const date = new Date();
    date.setDate(date.getDate() + days);
    selectedDate = formatDateForInput(date);
  }

  // 确认调整
  function handleConfirm(): void {
    if (!selectedDate) return;
    
    const newDate = new Date(selectedDate);
    newDate.setHours(9, 0, 0, 0); // 设置为上午9点
    
    logger.debug('[RescheduleMaterialModal] 调整日期:', {
      materialId: material.uuid,
      newDate: newDate.toISOString()
    });
    
    onReschedule(newDate);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && selectedDate) {
      e.preventDefault();
      handleConfirm();
    }
  }

  onMount(() => {
    initDate();
    setTimeout(() => {
      showContent = true;
    }, 50);
    
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div 
  class="reschedule-backdrop"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Enter' && onClose()}
  role="button"
  tabindex="0"
  aria-label="关闭"
>
  <div 
    class="reschedule-modal"
    class:show={showContent}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-labelledby="reschedule-title"
    aria-modal="true"
  >
    <!-- 标题 -->
    <div class="modal-header">
      <h3 id="reschedule-title" class="modal-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        调整复习日期
      </h3>
      <button class="close-btn" onclick={onClose} aria-label="关闭">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- 材料信息 -->
    <div class="material-info">
      <span class="material-title">{material.title}</span>
      <span class="material-meta">
        当前进度: {material.progress.percentage}%
      </span>
    </div>

    <!-- 预设选项 -->
    <div class="presets">
      {#each presets as preset}
        <button 
          class="preset-btn"
          onclick={() => applyPreset(preset.days)}
        >
          {preset.label}
        </button>
      {/each}
    </div>

    <!-- 日期选择器 -->
    <div class="date-picker">
      <label for="reschedule-date">选择日期</label>
      <input 
        type="date" 
        id="reschedule-date"
        bind:value={selectedDate}
        min={formatDateForInput(new Date())}
      />
    </div>

    <!-- 操作按钮 -->
    <div class="modal-actions">
      <button class="cancel-btn" onclick={onClose}>取消</button>
      <button 
        class="confirm-btn" 
        onclick={handleConfirm}
        disabled={!selectedDate}
      >
        确认调整
      </button>
    </div>
  </div>
</div>

<style>
  .reschedule-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-notice);
    padding: 20px;
    animation: backdrop-fade-in 0.15s ease-out;
  }

  @keyframes backdrop-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .reschedule-modal {
    width: 100%;
    max-width: 360px;
    background: var(--background-primary);
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: scale(0.95) translateY(10px);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .reschedule-modal.show {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .modal-title svg {
    color: var(--interactive-accent);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .material-info {
    padding: 16px 20px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .material-title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .material-meta {
    font-size: 12px;
    color: var(--text-muted);
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px 20px;
  }

  .preset-btn {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 16px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .date-picker {
    padding: 0 20px 16px;
  }

  .date-picker label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .date-picker input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 14px;
  }

  .date-picker input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .cancel-btn,
  .confirm-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .cancel-btn:hover {
    background: var(--background-modifier-hover);
  }

  .confirm-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .confirm-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
