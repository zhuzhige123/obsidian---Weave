<script lang="ts">
  import { Menu } from 'obsidian';
  import ObsidianIcon from './ObsidianIcon.svelte';

  interface DropdownOption {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    disabled?: boolean;
  }

  interface Props {
    options: DropdownOption[];
    value: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onchange?: (value: string) => void;
  }

  let {
    options,
    value = $bindable(),
    placeholder = '请选择...',
    disabled = false,
    className = '',
    onchange
  }: Props = $props();

  let buttonRef: HTMLButtonElement;

  // 获取当前选中的选项
  let selectedOption = $derived(options.find(opt => opt.id === value));

  // 显示菜单
  function showMenu(event: MouseEvent | KeyboardEvent) {
    if (disabled) return;

    const menu = new Menu();

    for (const option of options) {
      menu.addItem((item) => {
        const title = option.description ? `${option.label} - ${option.description}` : option.label;
        item.setTitle(title);
        if (option.id === value) {
          item.setChecked(true);
        }

        if (option.icon) {
          item.setIcon(option.icon);
        }

        if (option.disabled) {
          item.setDisabled(true);
        }

        item.onClick(() => {
          if (option.disabled) return;
          value = option.id;
          onchange?.(option.id);
        });
      });
    }

    // 根据事件类型显示菜单
    if (event instanceof MouseEvent) {
      menu.showAtMouseEvent(event);
    } else {
      // 键盘事件，在按钮位置显示
      const rect = buttonRef.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.bottom });
    }
  }

  // 处理点击
  function handleClick(event: MouseEvent) {
    showMenu(event);
  }

  // 处理键盘
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showMenu(event);
    }
  }
</script>

<button
  bind:this={buttonRef}
  class="obsidian-dropdown-trigger {className}"
  class:disabled
  onclick={handleClick}
  onkeydown={handleKeydown}
  {disabled}
  type="button"
>
  <span class="dropdown-text">
    {#if selectedOption}
      {selectedOption.label}
    {:else}
      <span class="placeholder">{placeholder}</span>
    {/if}
  </span>
  <ObsidianIcon name="chevron-down" size={14} />
</button>

<style>
  .obsidian-dropdown-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    color: var(--text-normal);
    font-family: var(--font-interface);
    font-size: var(--font-ui-small);
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .obsidian-dropdown-trigger:hover:not(.disabled) {
    border-color: var(--background-modifier-border-hover);
  }

  .obsidian-dropdown-trigger:focus-visible {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
  }

  .obsidian-dropdown-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown-text {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .placeholder {
    color: var(--text-muted);
  }
</style>
