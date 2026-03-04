<!--
  自定义下拉菜单组件
  职责：提供完全可控的下拉选择器，解决原生 select 的 z-index 和 stacking context 问题
  特性：
  - 绝对定位，超高 z-index，确保显示在最上层
  - 支持键盘导航（ArrowUp, ArrowDown, Enter, Escape）
  - 点击外部自动关闭
  - 符合 Obsidian 主题样式
-->
<script lang="ts">
  import { Menu } from 'obsidian';

  interface Option {
    id: string;
    name: string;
  }

  interface Props {
    /** 标签文本 */
    label: string;

    /** 当前选中的值 -  使用双向绑定 */
    value: string;

    /** 选项列表 */
    options: Option[];

    /** 值变化回调 */
    onchange: (value: string) => void;

    /** 自定义类名 */
    className?: string;
  }

  let {
    label,
    value = $bindable(),
    options,
    onchange,
    className = ''
  }: Props = $props();

  let buttonRef: HTMLButtonElement;

  // 计算当前选中的选项
  let selectedOption = $derived(
    options.find(opt => opt.id === value) || options[0]
  );


  function showMenu(event: MouseEvent | KeyboardEvent) {
    const menu = new Menu();

    for (const option of options) {
      menu.addItem((item) => {
        const title = option.id === value ? `${option.name} ✓` : option.name;
        item.setTitle(title);
        item.onClick(() => {
          value = option.id;
          onchange(option.id);
        });
      });
    }

    if (event instanceof MouseEvent) {
      menu.showAtMouseEvent(event);
    } else {
      const rect = buttonRef.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.bottom });
    }
  }

  function handleClick(event: MouseEvent) {
    event.preventDefault();
    showMenu(event);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showMenu(event);
    }
  }
</script>

<div class="custom-dropdown {className}">
  <!-- 标签 -->
  {#if label}
    <span class="dropdown-label">{label}</span>
  {/if}

  <!-- 触发按钮 -->
  <button
    bind:this={buttonRef}
    class="dropdown-button"
    onclick={handleClick}
    onkeydown={handleKeydown}
    type="button"
    aria-label={label}
    aria-haspopup="menu"
  >
    <span class="dropdown-button-text">{selectedOption?.name || '请选择'}</span>
    <span class="dropdown-button-arrow">▼</span>
  </button>
</div>

<style>
  .custom-dropdown {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
  }

  .dropdown-label {
    color: var(--text-muted);
    font-size: 0.875rem;
    white-space: nowrap;
    margin: 0;
  }

  .dropdown-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 120px;
    padding: 0.375rem 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dropdown-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .dropdown-button.open {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .dropdown-button-text {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropdown-button-arrow {
    font-size: 0.7rem;
    color: var(--text-muted);
    transition: transform 0.15s ease;
  }

  .dropdown-button-arrow.open {
    transform: rotate(180deg);
  }

  .dropdown-panel {
    position: fixed;
    /*  修复：使用合理的z-index值 */
    z-index: 1600; /* 自定义下拉菜单层级，高于标准下拉菜单 */
    min-width: 150px;
    max-height: 300px;
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    padding: 0.25rem;
    margin-top: 0.25rem;
  }

  .dropdown-panel:focus {
    outline: none;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-normal);
    font-size: 0.875rem;
    transition: background 0.1s ease;
  }

  .dropdown-item:hover,
  .dropdown-item.highlighted {
    background: var(--background-modifier-hover);
  }

  .dropdown-item.selected {
    background: var(--background-modifier-active-hover);
    color: var(--interactive-accent);
  }

  .dropdown-item-check {
    margin-left: 0.5rem;
    color: var(--interactive-accent);
    font-size: 0.875rem;
  }

  /* 滚动条样式 */
  .dropdown-panel::-webkit-scrollbar {
    width: 8px;
  }

  .dropdown-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .dropdown-panel::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 4px;
  }

  .dropdown-panel::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }
</style>

