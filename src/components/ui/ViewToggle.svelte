<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import EnhancedIcon from "./EnhancedIcon.svelte";

  interface ViewOption {
    value: string;
    label: string;
    icon: string;
    description?: string;
  }

  interface Props {
    value: string;
    options: ViewOption[];
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    onChange?: (value: string) => void;
    class?: string;
  }

  let {
    value = $bindable(),
    options = [],
    size = "md",
    disabled = false,
    onChange,
    class: className = ""
  }: Props = $props();

  const dispatch = createEventDispatcher();

  let componentClasses = $derived.by(() => {
    const classes = [
      'weave-view-toggle',
      `weave-view-toggle--${size}`,
    ];

    if (disabled) classes.push('weave-view-toggle--disabled');
    if (className) classes.push(className);

    return classes.join(' ');
  });

  function handleOptionClick(optionValue: string) {
    if (disabled || optionValue === value) return;

    value = optionValue;
    onChange?.(optionValue);
    dispatch('change', optionValue);
  }

  function handleKeydown(event: KeyboardEvent, optionValue: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOptionClick(optionValue);
    }
  }
</script>

<div class={componentClasses} role="tablist" aria-label="视图切换">
  {#each options as option}
    <button
      type="button"
      class="weave-view-toggle__option"
      class:active={option.value === value}
      role="tab"
      aria-selected={option.value === value}
      aria-controls="view-content"
      tabindex={option.value === value ? 0 : -1}
      title={option.description || option.label}
      {disabled}
      onclick={() => handleOptionClick(option.value)}
      onkeydown={(e) => handleKeydown(e, option.value)}
    >
      <EnhancedIcon
        name={option.icon}
        size="sm"
        variant={option.value === value ? "primary" : "secondary"}
      />
      <span class="option-label">{option.label}</span>
    </button>
  {/each}
</div>

<style>
  .weave-view-toggle {
    display: inline-flex;
    background: var(--weave-secondary-bg);
    border: 1px solid var(--weave-border);
    border-radius: var(--weave-radius-md);
    padding: var(--weave-space-xs);
    gap: var(--weave-space-xs);
  }

  .weave-view-toggle--disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .weave-view-toggle__option {
    display: flex;
    align-items: center;
    gap: var(--weave-space-xs);
    padding: var(--weave-space-sm) var(--weave-space-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--weave-radius-sm);
    color: var(--weave-text-secondary);
    font-family: var(--font-interface);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .weave-view-toggle__option:hover:not(:disabled) {
    background: var(--weave-hover);
    color: var(--weave-text-primary);
  }

  .weave-view-toggle__option:focus {
    outline: 2px solid var(--weave-accent-color);
    outline-offset: 2px;
  }

  .weave-view-toggle__option.active {
    background: var(--weave-surface);
    color: var(--weave-accent-color);
    border-color: var(--weave-border);
    box-shadow: var(--weave-shadow-sm);
  }

  .option-label {
    font-size: inherit;
    font-weight: inherit;
  }

  /* 尺寸变体 */
  .weave-view-toggle--sm .weave-view-toggle__option {
    padding: var(--weave-space-xs) var(--weave-space-sm);
    font-size: 0.75rem;
  }

  .weave-view-toggle--lg .weave-view-toggle__option {
    padding: var(--weave-space-md) var(--weave-space-lg);
    font-size: 1rem;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .option-label {
      display: none;
    }

    .weave-view-toggle__option {
      padding: var(--weave-space-sm);
    }
  }
</style>
