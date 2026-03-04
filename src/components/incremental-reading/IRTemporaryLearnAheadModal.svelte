<script lang="ts">
  import { onMount } from 'svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface Props {
    deckName: string;
    initialDays?: number;
    minDays?: number;
    maxDays?: number;
    onClose: () => void;
    onConfirm: (days: number) => void;
  }

  let {
    deckName,
    initialDays = 30,
    minDays = 15,
    maxDays = 30,
    onClose,
    onConfirm
  }: Props = $props();

  let showContent = $state(false);
  let days = $state(initialDays);

  function handleInput(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) days = value;
  }

  function handleConfirm() {
    if (typeof onConfirm === 'function') {
      onConfirm(days);
    }
  }

  onMount(() => {
    setTimeout(() => {
      showContent = true;
    }, 300);

  });
</script>

<div
  class="ir-temp-learn-ahead-backdrop"
  onclick={() => {
    if (typeof onClose === 'function') onClose();
  }}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (typeof onClose === 'function') onClose();
    }
  }}
  role="button"
  tabindex="0"
  aria-label="关闭提示窗口"
>
  <div
    class="ir-temp-learn-ahead-card"
    class:show={showContent}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
  >
    <h2 class="ir-temp-title">临时扩大提前阅读范围</h2>

    <div class="deck-info">
      <EnhancedIcon name="book-open" size={18} />
      <span class="deck-name">{deckName}</span>
    </div>

    <div class="ir-temp-desc">
      14天内暂无可提前阅读内容。你可以临时扩大到更远的到期范围（仅本次生效）。
    </div>

    <div class="slider-row">
      <div class="slider-label">临时提前阅读范围</div>
      <div class="slider-control">
        <input
          type="range"
          min={minDays}
          max={maxDays}
          step="1"
          value={days}
          class="modern-slider"
          oninput={handleInput}
        />
        <span class="slider-value">{days}天</span>
      </div>
    </div>

    <div class="action-buttons-row">
      <button class="btn-compact btn-tertiary" onclick={onClose}>
        <EnhancedIcon name="x" size={14} />
        <span>取消</span>
      </button>

      <button class="btn-compact btn-primary" onclick={handleConfirm}>
        <EnhancedIcon name="play" size={14} />
        <span>开始提前阅读</span>
      </button>
    </div>
  </div>
</div>

<style>
  .ir-temp-learn-ahead-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
    padding: 1rem;
    backdrop-filter: blur(6px);
  }

  .ir-temp-learn-ahead-card {
    width: 100%;
    max-width: 520px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 16px;
    padding: 1.25rem 1.25rem 1rem;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
    transform: translateY(8px) scale(0.98);
    opacity: 0;
    transition: transform 220ms ease, opacity 220ms ease;
  }

  .ir-temp-learn-ahead-card.show {
    transform: translateY(0) scale(1);
    opacity: 1;
  }

  .ir-temp-title {
    margin: 0 0 0.75rem;
    font-size: 1.35rem;
    font-weight: 700;
    text-align: center;
    color: var(--text-normal);
  }

  .deck-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    margin-bottom: 0.75rem;
  }

  .deck-name {
    font-weight: 600;
    color: var(--text-normal);
  }

  .ir-temp-desc {
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.4;
    text-align: center;
    margin: 0 0 1rem;
  }

  .slider-row {
    border-radius: 14px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    padding: 0.9rem 0.9rem;
    margin-bottom: 1rem;
  }

  .slider-label {
    color: var(--text-normal);
    font-weight: 600;
    margin-bottom: 0.6rem;
  }

  .slider-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .slider-control input {
    flex: 1;
  }

  .slider-value {
    min-width: 52px;
    text-align: right;
    color: var(--text-normal);
    font-weight: 600;
  }

  .action-buttons-row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }
</style>
