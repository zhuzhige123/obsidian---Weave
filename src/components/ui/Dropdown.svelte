<script lang="ts">
  import EnhancedIcon from "./EnhancedIcon.svelte";
  import type { IconName } from "../../icons/index.js";
  import { Menu } from 'obsidian';

  interface DropdownItem {
    id: string;
    label: string;
    icon?: IconName;
    onClick: () => void;
    disabled?: boolean;
  }

  interface Props {
    items: DropdownItem[];
    buttonText: string;
    buttonIcon?: IconName;
    position?: "left" | "right";
    iconOnly?: boolean;
    showOnHover?: boolean;
  }

  let {
    items,
    buttonText,
    buttonIcon,
    position = "left",
    iconOnly = false,
    showOnHover = false,
  }: Props = $props();

  let dropdownRef: HTMLDivElement;
  let buttonRef: HTMLButtonElement;

  function showMenu(event: MouseEvent | KeyboardEvent) {
    const menu = new Menu();

    for (const item of items) {
      if (item.id === 'divider') {
        menu.addSeparator();
        continue;
      }

      menu.addItem((menuItem) => {
        menuItem.setTitle(item.label);
        if (item.icon) {
          menuItem.setIcon(item.icon);
        }
        if (item.disabled) {
          menuItem.setDisabled(true);
        }
        menuItem.onClick(() => {
          if (!item.disabled) {
            item.onClick();
          }
        });
      });
    }

    if (event instanceof MouseEvent) {
      menu.showAtMouseEvent(event);
    } else {
      const rect = buttonRef.getBoundingClientRect();
      const x = position === 'right' ? rect.right : rect.left;
      menu.showAtPosition({ x, y: rect.bottom });
    }
  }

  function handleClick(event: MouseEvent) {
    showMenu(event);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showMenu(event);
    }
  }

  function handleMouseEnter(event: MouseEvent) {
    if (showOnHover) {
      showMenu(event);
    }
  }
</script>

<div
  class="dropdown-container"
  bind:this={dropdownRef}
  onmouseenter={handleMouseEnter}
  role="button"
  tabindex="0"
>
  <button
    bind:this={buttonRef}
    class="dropdown-trigger {iconOnly ? 'icon-only' : ''}"
    onclick={handleClick}
    onkeydown={handleKeydown}
    aria-label={iconOnly ? (buttonText || '菜单') : undefined}
    aria-haspopup="menu"
  >
    {#if iconOnly}
      {#if buttonIcon}
        <EnhancedIcon name={buttonIcon} size="16" />
      {/if}
    {:else}
      {#if buttonIcon}
        <EnhancedIcon name={buttonIcon} size="16" />
      {/if}
      <span>{buttonText}</span>
      <span class="chevron" aria-hidden="true">
        <EnhancedIcon name="chevronDown" size="14" />
      </span>
    {/if}
  </button>
</div>

<style>
  .dropdown-container { position: relative; display: inline-block; }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    color: var(--text-normal);
    cursor: pointer;
    font-family: var(--font-interface);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .icon-only {
    padding: 0.5rem;
    border-radius: 0.375rem;
  }

  .dropdown-trigger:hover {
    background: var(--background-modifier-hover);
  }

  .dropdown-trigger .chevron {
    display: inline-flex;
    transition: transform 0.2s ease;
  }

  .dropdown-trigger:focus-visible {
    outline: 2px solid var(--weave-accent-color);
    outline-offset: 2px;
  }
</style>
