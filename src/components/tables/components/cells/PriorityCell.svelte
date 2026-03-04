<script lang="ts">
  import { Menu, Platform } from 'obsidian';
  import type { PriorityCellProps } from "../../types/table-types";

  let { card, onPriorityUpdate }: PriorityCellProps = $props();

  //  移动端检测
  const isMobile = Platform.isMobile;

  // 优先级配置：颜色和标签
  const priorityConfig: Record<number, { color: string; label: string; cssClass: string }> = {
    1: { color: 'var(--color-red)', label: '紧急', cssClass: 'priority-1' },
    2: { color: 'var(--color-orange)', label: '高', cssClass: 'priority-2' },
    3: { color: 'var(--color-blue)', label: '中', cssClass: 'priority-3' },
    4: { color: 'var(--text-faint)', label: '低', cssClass: 'priority-4' },
  };

  // 当前优先级（默认为2）
  let currentPriority = $derived(card.priority || 2);
  let config = $derived(priorityConfig[currentPriority] || priorityConfig[2]);

  //  移动端：显示 Obsidian Menu 选择优先级
  function showPriorityMenu(event: MouseEvent) {
    if (!onPriorityUpdate) return;
    
    const menu = new Menu();
    
    [1, 2, 3, 4].forEach(priority => {
      const cfg = priorityConfig[priority];
      menu.addItem(item => {
        item
          .setTitle(`P${priority} - ${cfg.label}`)
          .setIcon(priority === currentPriority ? 'check' : 'circle')
          .onClick(() => {
            onPriorityUpdate(card.uuid, priority);
          });
      });
    });

    menu.showAtMouseEvent(event);
  }

  //  桌面端：点击切换优先级（循环 1-4）
  function handleDesktopClick() {
    if (!onPriorityUpdate) return;
    const newPriority = currentPriority >= 4 ? 1 : currentPriority + 1;
    onPriorityUpdate(card.uuid, newPriority);
  }
</script>

<td class="weave-priority-column">
  <button
    class="weave-priority-badge {config.cssClass}"
    onclick={isMobile ? showPriorityMenu : handleDesktopClick}
    aria-label="优先级 P{currentPriority} - {config.label}"
    title={isMobile ? '点击选择优先级' : `优先级: ${config.label}（点击切换）`}
  >
    {#if isMobile}
      <span class="priority-number">{currentPriority}</span>
    {:else}
      <span class="priority-text">P{currentPriority}</span>
    {/if}
  </button>
</td>

<style>
  .weave-priority-column {
    width: 48px;
    min-width: 48px;
    max-width: 48px;
    text-align: center;
  }

  /*  数字徽章样式 */
  .weave-priority-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 22px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  /* 优先级颜色 */
  .weave-priority-badge.priority-1 {
    background: rgba(var(--color-red-rgb), 0.15);
    color: var(--color-red);
  }

  .weave-priority-badge.priority-2 {
    background: rgba(var(--color-orange-rgb), 0.15);
    color: var(--color-orange);
  }

  .weave-priority-badge.priority-3 {
    background: rgba(var(--color-blue-rgb), 0.15);
    color: var(--color-blue);
  }

  .weave-priority-badge.priority-4 {
    background: var(--background-modifier-hover);
    color: var(--text-faint);
  }

  .weave-priority-badge:hover {
    transform: scale(1.05);
    filter: brightness(1.1);
  }

  .weave-priority-badge:active {
    transform: scale(0.95);
  }

  .weave-priority-badge:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .priority-text,
  .priority-number {
    line-height: 1;
  }

  /*  移动端适配 - 更紧凑的数字显示 */
  :global(body.is-mobile) .weave-priority-column {
    width: 36px;
    min-width: 36px;
    max-width: 36px;
  }

  :global(body.is-mobile) .weave-priority-badge {
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    font-size: 12px;
    border-radius: 6px;
  }
</style>


