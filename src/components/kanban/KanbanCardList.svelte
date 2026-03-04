<!--
  看板卡片列表组件
  渲染分组内的卡片列表，支持拖拽
-->
<script lang="ts">
  import type { Card } from "../../data/types";
  import type { WeavePlugin } from "../../main";
  import GridCard from "../cards/GridCard.svelte";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";

  interface Props {
    /** 卡片列表 */
    cards: Card[];
    /** 分组键 */
    groupKey: string;
    /** 已选择的卡片ID集合 */
    selectedCards: Set<string>;
    /** 插件实例 */
    plugin: WeavePlugin;
    /** 是否允许拖拽 */
    isDraggable?: boolean;
    /** 拖拽中的卡片 */
    draggedCard?: Card | null;
    /** 拖拽经过的列 */
    dragOverColumn?: string | null;
    /** 拖拽经过的索引 */
    dragOverIndex?: number;
    /** 初始显示数量 */
    initialVisibleCount?: number;
    /** 加载更多批次大小 */
    loadMoreBatchSize?: number;
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
  }

  let {
    cards,
    groupKey,
    selectedCards,
    plugin,
    isDraggable = false,
    draggedCard = null,
    dragOverColumn = null,
    dragOverIndex = -1,
    initialVisibleCount = 20,
    loadMoreBatchSize = 20,
    onCardClick,
    onCardEdit,
    onCardDelete,
    onDragStart,
    onDragEnd,
    onDragOver
  }: Props = $props();

  // 当前显示数量
  let visibleCount = $state(initialVisibleCount);

  // 可见卡片
  const visibleCards = $derived(cards.slice(0, visibleCount));
  
  // 是否有更多卡片
  const hasMore = $derived(visibleCount < cards.length);
  
  // 剩余卡片数
  const remainingCount = $derived(cards.length - visibleCount);

  // 加载更多
  function loadMore() {
    visibleCount = Math.min(visibleCount + loadMoreBatchSize, cards.length);
  }

  // 重置显示数量（当cards变化时）
  $effect(() => {
    // 当分组或卡片数量变化时重置
    if (cards.length < visibleCount) {
      visibleCount = Math.min(initialVisibleCount, cards.length);
    }
  });
</script>

<div class="kanban-card-list" role="list">
  {#each visibleCards as card, index (card.uuid)}
    <!-- 拖拽指示器 -->
    {#if isDraggable && draggedCard && dragOverColumn === groupKey && dragOverIndex === index}
      <div class="drop-indicator"></div>
    {/if}
    
    <!-- 卡片容器 -->
    <div
      class="card-wrapper"
      class:dragging={draggedCard?.uuid === card.uuid}
      class:draggable={isDraggable}
      role="listitem"
      draggable={isDraggable}
      ondragstart={(e) => isDraggable && onDragStart?.(e, card)}
      ondragend={() => onDragEnd?.()}
      ondragover={(e) => {
        if (isDraggable) {
          e.preventDefault();
          onDragOver?.(e, groupKey, index);
        }
      }}
    >
      <GridCard
        {card}
        selected={selectedCards.has(card.uuid)}
        {plugin}
        layoutMode="masonry"
        viewContext="kanban"
        onClick={() => onCardClick?.(card)}
        onEdit={() => onCardEdit?.(card)}
        onDelete={() => onCardDelete?.(card.uuid)}
        onView={() => onCardEdit?.(card)}
      />
    </div>
  {/each}

  <!-- 末尾拖拽指示器 -->
  {#if isDraggable && draggedCard && dragOverColumn === groupKey && dragOverIndex === visibleCards.length}
    <div class="drop-indicator"></div>
  {/if}

  <!-- 加载更多按钮 -->
  {#if hasMore}
    <div class="load-more-container">
      <button class="load-more-btn" onclick={loadMore}>
        <EnhancedIcon name="chevron-down" size={16} />
        加载更多 ({remainingCount} 张剩余)
      </button>
    </div>
  {/if}

  <!-- 空状态 -->
  {#if cards.length === 0}
    <div class="empty-state">
      <span class="empty-text">暂无卡片</span>
    </div>
  {/if}
</div>

<style>
  .kanban-card-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    min-height: 100px;
  }

  .card-wrapper {
    transition: transform 0.2s, opacity 0.2s;
  }

  .card-wrapper.draggable {
    cursor: grab;
  }

  .card-wrapper.draggable:active {
    cursor: grabbing;
  }

  .card-wrapper.dragging {
    opacity: 0.5;
    transform: scale(0.98);
  }

  .drop-indicator {
    height: 3px;
    background: var(--interactive-accent);
    border-radius: 2px;
    margin: 0.25rem 0;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .load-more-container {
    padding: 0.5rem;
  }

  .load-more-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--background-modifier-hover);
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .load-more-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
    border-style: solid;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
  }

  .empty-text {
    font-size: 0.875rem;
  }
</style>
