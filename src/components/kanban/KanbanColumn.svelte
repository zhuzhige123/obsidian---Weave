<!--
  看板单列组件
  组合列头和卡片列表
-->
<script lang="ts">
  import type { Card } from "../../data/types";
  import type { WeavePlugin } from "../../main";
  import KanbanColumnHeader from "./KanbanColumnHeader.svelte";
  import KanbanCardList from "./KanbanCardList.svelte";

  interface GroupConfig {
    key: string;
    label: string;
    color: string;
    icon: string;
  }

  interface GroupStats {
    total: number;
    due: number;
    selected: number;
  }

  interface Props {
    /** 分组配置 */
    group: GroupConfig;
    /** 该分组的卡片 */
    cards: Card[];
    /** 已选择的卡片ID集合 */
    selectedCards: Set<string>;
    /** 统计信息 */
    stats: GroupStats;
    /** 插件实例 */
    plugin: WeavePlugin;
    /** 是否允许拖拽 */
    isDraggable?: boolean;
    /** 是否显示统计 */
    showStats?: boolean;
    /** 是否使用彩色背景 */
    useColoredBackground?: boolean;
    /** 拖拽中的卡片 */
    draggedCard?: Card | null;
    /** 拖拽经过的列 */
    dragOverColumn?: string | null;
    /** 拖拽经过的索引 */
    dragOverIndex?: number;
    /** 全选回调 */
    onSelectAll?: () => void;
    /** 卡片点击回调 */
    onCardClick?: (card: Card) => void;
    /** 卡片编辑回调 */
    onCardEdit?: (card: Card) => void;
    /** 卡片删除回调 */
    onCardDelete?: (cardId: string) => void;
    /** 拖拽开始回调 */
    onDragStart?: (e: DragEvent, card: Card) => void;
    /** 拖拽结束回调 */
    onDragEnd?: () => void;
    /** 拖拽经过回调 */
    onDragOver?: (e: DragEvent, groupKey: string, index: number) => void;
    /** 拖拽离开回调 */
    onDragLeave?: () => void;
    /** 放下回调 */
    onDrop?: (groupKey: string) => void;
  }

  let {
    group,
    cards,
    selectedCards,
    stats,
    plugin,
    isDraggable = false,
    showStats = true,
    useColoredBackground = false,
    draggedCard = null,
    dragOverColumn = null,
    dragOverIndex = -1,
    onSelectAll,
    onCardClick,
    onCardEdit,
    onCardDelete,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop
  }: Props = $props();

  // 是否正在拖拽经过此列
  const isDragOver = $derived(dragOverColumn === group.key);
</script>

<div
  class="kanban-column"
  class:drag-over={isDragOver && isDraggable}
  role="region"
  aria-label="{group.label}分组"
  ondragover={(e) => {
    if (isDraggable) {
      e.preventDefault();
    }
  }}
  ondragleave={() => onDragLeave?.()}
  ondrop={() => onDrop?.(group.key)}
>
  <KanbanColumnHeader
    label={group.label}
    icon={group.icon}
    color={group.color}
    {stats}
    {showStats}
    {useColoredBackground}
    {onSelectAll}
  />

  <div class="column-content">
    <KanbanCardList
      {cards}
      groupKey={group.key}
      {selectedCards}
      {plugin}
      {isDraggable}
      {draggedCard}
      {dragOverColumn}
      {dragOverIndex}
      {onCardClick}
      onCardEdit={onCardEdit}
      {onCardDelete}
      {onDragStart}
      {onDragEnd}
      {onDragOver}
    />
  </div>
</div>

<style>
  .kanban-column {
    display: flex;
    flex-direction: column;
    min-width: 280px;
    max-height: calc(100vh - 200px);
    min-height: 200px;
    background: var(--background-secondary);
    border-radius: var(--radius-l);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .kanban-column.drag-over {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 20%, transparent);
  }

  .column-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }

  .column-content::-webkit-scrollbar {
    width: 6px;
  }

  .column-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .column-content::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 3px;
  }

  .column-content::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }
</style>
