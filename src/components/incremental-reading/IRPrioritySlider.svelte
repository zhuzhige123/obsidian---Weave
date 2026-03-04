<!--
  IRPrioritySlider - 优先级滑动条组件 v3.0
  
  设计：
  - 点击功能键后展开显示
  - 使用 0-10 连续优先级轴
  - 实时预览当前值
  - 与侧边功能栏风格统一
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface Props {
    value: number;
    expanded: boolean;
    disabled?: boolean;
    onToggle: () => void;
    onChange: (value: number) => void;
  }

  let {
    value = 5,
    expanded = false,
    disabled = false,
    onToggle,
    onChange
  }: Props = $props();

  let localValue = $state(value);
  let isDragging = $state(false);

  // 同步外部值
  $effect(() => {
    if (!isDragging) {
      localValue = value;
    }
  });

  // 优先级标签
  const priorityLabels = [
    { value: 0, label: '最低', color: 'var(--text-faint)' },
    { value: 2, label: '低', color: 'var(--text-muted)' },
    { value: 5, label: '中', color: 'var(--text-normal)' },
    { value: 7, label: '高', color: 'var(--text-warning)' },
    { value: 10, label: '紧急', color: 'var(--text-error)' }
  ];

  // 获取当前优先级标签
  function getPriorityLabel(v: number): string {
    if (v <= 1) return '最低';
    if (v <= 3) return '低';
    if (v <= 6) return '中';
    if (v <= 8) return '高';
    return '紧急';
  }

  // 获取当前优先级颜色
  function getPriorityColor(v: number): string {
    if (v <= 1) return 'var(--text-faint)';
    if (v <= 3) return 'var(--text-muted)';
    if (v <= 6) return 'var(--interactive-accent)';
    if (v <= 8) return 'var(--text-warning)';
    return 'var(--text-error)';
  }

  // 获取感叹号数量
  function getExclamationCount(v: number): number {
    if (v <= 1) return 0;
    if (v <= 3) return 1;
    if (v <= 6) return 2;
    if (v <= 8) return 3;
    return 4;
  }

  // 处理滑动
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    localValue = parseFloat(target.value);
    isDragging = true;
  }

  // 处理滑动结束
  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    isDragging = false;
    onChange(newValue);
  }

  // 快捷设置
  function quickSet(v: number) {
    localValue = v;
    onChange(v);
  }
</script>

<div class="ir-priority-slider" class:expanded class:disabled>
  <!-- 触发按钮 -->
  <button 
    class="trigger-btn toolbar-btn priority-btn"
    onclick={onToggle}
    title="设置优先级"
    {disabled}
    style="color: {getPriorityColor(localValue)}"
  >
    <div class="priority-indicator">
      {#if getExclamationCount(localValue) === 0}
        <span class="priority-dash">—</span>
      {:else}
        {'!'.repeat(getExclamationCount(localValue))}
      {/if}
    </div>
    <span class="btn-label">优先级</span>
    <EnhancedIcon name={expanded ? "chevron-up" : "chevron-down"} size={12} />
  </button>

  <!-- 展开面板 -->
  {#if expanded}
    <div class="slider-panel">
      <!-- 当前值显示 -->
      <div class="current-value" style="color: {getPriorityColor(localValue)}">
        <span class="value-number">{localValue.toFixed(1)}</span>
        <span class="value-label">{getPriorityLabel(localValue)}</span>
      </div>

      <!-- 滑动条 -->
      <div class="slider-container">
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={localValue}
          class="priority-slider"
          style="--slider-color: {getPriorityColor(localValue)}"
          oninput={handleInput}
          onchange={handleChange}
          {disabled}
        />
        <div class="slider-track">
          <div 
            class="slider-fill" 
            style="width: {localValue * 10}%; background: {getPriorityColor(localValue)}"
          ></div>
        </div>
      </div>

      <!-- 刻度标签 -->
      <div class="slider-ticks">
        {#each priorityLabels as tick}
          <button 
            class="tick-btn"
            class:active={Math.abs(localValue - tick.value) < 1}
            style="left: {tick.value * 10}%; color: {tick.color}"
            onclick={() => quickSet(tick.value)}
            title={tick.label}
          >
            <span class="tick-dot"></span>
            <span class="tick-label">{tick.label}</span>
          </button>
        {/each}
      </div>

      <!-- 说明文字 -->
      <div class="slider-hint">
        高优先级内容将更频繁出现
      </div>
    </div>
  {/if}
</div>

<style>
  .ir-priority-slider {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .ir-priority-slider.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  /* 触发按钮 - 继承侧边栏工具按钮风格 */
  .trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    font-size: 0.85rem;
    transition: all 0.15s ease;
  }

  .trigger-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ir-priority-slider.expanded .trigger-btn {
    background: var(--background-modifier-hover);
  }

  .priority-indicator {
    font-weight: 700;
    font-size: 1rem;
    min-width: 24px;
    text-align: center;
  }

  .priority-dash {
    color: var(--text-faint);
  }

  .btn-label {
    flex: 1;
    text-align: left;
    color: var(--text-normal);
  }

  /* 展开面板 */
  .slider-panel {
    padding: 12px;
    margin-top: 4px;
    background: var(--background-secondary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 当前值显示 */
  .current-value {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .value-number {
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .value-label {
    font-size: 0.9rem;
    font-weight: 500;
  }

  /* 滑动条容器 */
  .slider-container {
    position: relative;
    height: 24px;
    margin: 8px 0;
  }

  .priority-slider {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 24px;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
  }

  .slider-track {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    transform: translateY(-50%);
    overflow: hidden;
  }

  .slider-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.1s ease, background 0.15s ease;
  }

  /* 滑块 */
  .priority-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    border-radius: 50%;
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .priority-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.1);
  }

  /* 刻度标签 */
  .slider-ticks {
    position: relative;
    height: 32px;
    margin-top: 8px;
  }

  .tick-btn {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .tick-btn:hover {
    opacity: 1;
  }

  .tick-btn:not(.active) {
    opacity: 0.6;
  }

  .tick-dot {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
  }

  .tick-label {
    font-size: 0.7rem;
    white-space: nowrap;
  }

  /* 说明文字 */
  .slider-hint {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  /* 移动端适配 */
  :global(body.is-mobile) .slider-panel {
    padding: 16px;
  }

  :global(body.is-mobile) .priority-slider {
    height: 32px;
  }

  :global(body.is-mobile) .slider-track {
    height: 8px;
  }
</style>
