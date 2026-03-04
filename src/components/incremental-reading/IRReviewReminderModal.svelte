<script lang="ts">
  import { onMount, tick } from 'svelte';

  interface Props {
    initialDate: string;
    initialTime: string;
    position?: { x: number; y: number };
    onCancel: () => void;
    onConfirm: (date: string, time: string) => void;
  }

  let { initialDate, initialTime, position, onCancel, onConfirm }: Props = $props();

  let reviewDate = $state(initialDate);
  let reviewTime = $state(initialTime);

  let modalEl: HTMLDivElement | null = $state(null);
  let left = $state(-9999);
  let top = $state(-9999);

  function handleConfirm() {
    onConfirm(reviewDate, reviewTime);
  }

  async function updatePosition() {
    await tick();
    if (!modalEl) return;

    const rect = modalEl.getBoundingClientRect();
    const margin = 12;
    const baseX = position?.x ?? window.innerWidth / 2;
    const baseY = position?.y ?? window.innerHeight / 2;

    const desiredLeft = baseX + 12;
    const desiredTop = baseY + 12;

    left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(desiredTop, window.innerHeight - rect.height - margin));
  }

  onMount(() => {
    void updatePosition();

    const onKeydown = (_e: KeyboardEvent) => {
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!modalEl) return;
      if (!modalEl.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', updatePosition);
    };
  });
</script>

<div
  class="reminder-popover"
  role="dialog"
  aria-modal="false"
  bind:this={modalEl}
  style={`left: ${left}px; top: ${top}px;`}
>
  <div class="modal-header">
    <h3>设置复习提醒</h3>
    <button class="modal-close" onclick={onCancel}>×</button>
  </div>

  <div class="modal-body">
    <p class="modal-description">为当前内容块自定义下次复习时间：</p>

    <div class="form-group">
      <label for="review-date">复习日期：</label>
      <input id="review-date" type="date" bind:value={reviewDate} class="date-input" />
    </div>

    <div class="form-group">
      <label for="review-time">复习时间：</label>
      <input id="review-time" type="time" bind:value={reviewTime} class="time-input" />
    </div>
  </div>

  <div class="modal-footer">
    <button class="btn-secondary" onclick={onCancel}>取消</button>
    <button class="btn-primary" onclick={handleConfirm}>确认设置</button>
  </div>
</div>

<style>
  .reminder-popover {
    position: fixed;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: var(--shadow-s);
    z-index: 1100;
    max-width: 450px;
    min-width: 350px;
    max-height: 80vh;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    font-size: 1.2rem;
    line-height: 1;
    transition: all 0.15s ease;
  }

  .modal-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .date-input,
  .time-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 0.95rem;
    transition: border-color 0.15s ease;
  }

  .date-input:focus,
  .time-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .btn-secondary,
  .btn-primary {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .btn-secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-active-hover);
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  :global(.is-mobile) .reminder-popover {
    width: calc(100vw - 24px);
    min-width: 0;
    max-width: calc(100vw - 24px);
    max-height: 75vh;
  }

  :global(.is-mobile) .modal-header {
    padding: 0.75rem 1rem;
  }

  :global(.is-mobile) .modal-header h3 {
    font-size: 1rem;
  }

  :global(.is-mobile) .modal-body {
    padding: 1rem;
  }

  :global(.is-mobile) .modal-description {
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
  }

  :global(.is-mobile) .form-group label {
    font-size: 0.85rem;
    margin-bottom: 0.4rem;
  }

  :global(.is-mobile) .date-input,
  :global(.is-mobile) .time-input {
    padding: 0.6rem 0.7rem;
    font-size: 0.9rem;
  }

  :global(.is-mobile) .modal-footer {
    padding: 0.75rem 1rem;
    gap: 0.5rem;
  }

  :global(.is-mobile) .btn-secondary,
  :global(.is-mobile) .btn-primary {
    padding: 0.6rem;
    font-size: 0.9rem;
    border-radius: 7px;
  }
</style>
