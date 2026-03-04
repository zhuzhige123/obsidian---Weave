<script lang="ts">
  import EnhancedIcon from "../../../ui/EnhancedIcon.svelte";
  import { Menu } from "obsidian";
  import type { ActionsCellProps } from "../../types/table-types";

  let { 
    card, 
    onView, 
    onTempFileEdit, 
    onEdit, 
    onDelete 
  }: ActionsCellProps = $props();

  /**
   * 显示 Obsidian 原生菜单
   */
  function showMenu(event: MouseEvent) {
    event.preventDefault();
    // Svelte 5: 移除 stopPropagation

    const menu = new Menu();

    // 查看详情
    if (onView) {
      menu.addItem((item) => {
        item
          .setTitle("查看详情")
          .setIcon("eye")
          .onClick(() => {
            onView(card.uuid);
          });
      });
    }

    // 编辑卡片
    if (onEdit || onTempFileEdit) {
      menu.addItem((item) => {
        item
          .setTitle("编辑卡片")
          .setIcon("edit")
          .onClick(() => {
            if (onTempFileEdit) {
              onTempFileEdit(card.uuid);
            } else if (onEdit) {
              onEdit(card.uuid);
            }
          });
      });
    }

    // 分隔线
    menu.addSeparator();

    // 删除卡片（警告样式）
    menu.addItem((item) => {
      item
        .setTitle("删除卡片")
        .setIcon("trash")
        .setWarning(true)
        .onClick(() => {
          onDelete(card.uuid);
        });
    });

    // 在鼠标位置显示菜单
    menu.showAtMouseEvent(event);
  }
</script>

<!--  修复：移除外层<td>，让TableRow来包裹 -->
<div class="weave-actions-container">
  <!-- Obsidian 原生菜单按钮 -->
  <button
    class="actions-menu-button"
    onclick={showMenu}
    title="操作菜单"
  >
    <EnhancedIcon name="more-horizontal" size={16} />
  </button>
</div>

<style>
  /*  修复：移除了.weave-actions-column样式，由TableRow的<td>控制 */

  .weave-actions-container {
    display: flex;
    justify-content: center;
  }

  /*  圆形菜单按钮 - 与牌组卡片右上角菜单按钮设计一致 */
  .actions-menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--background-modifier-hover);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--text-muted);
    opacity: 0.6;
  }

  /*  行hover时显示按钮 */
  :global(.weave-table-row:hover) .actions-menu-button {
    opacity: 1;
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  /*  按钮hover效果 - 圆形设计 */
  .actions-menu-button:hover {
    background: var(--interactive-accent) !important;
    color: var(--text-on-accent) !important;
    opacity: 1 !important;
    transform: scale(1.08);
  }

  .actions-menu-button:active {
    transform: scale(0.95);
  }
</style>


