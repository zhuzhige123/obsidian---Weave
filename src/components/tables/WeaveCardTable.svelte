<script lang="ts">
  import { logger } from '../../utils/logger';

  import type { Card } from '../../data/types';
  // FieldTemplate类型已废弃，现使用动态解析，不再需要预定义模板
  import { onMount } from "svelte";
  import TableHeader from "./components/TableHeader.svelte";
  import TableRow from './components/TableRow.svelte';
  import type { ColumnVisibility, ColumnWidths, ColumnOrder, TableRowCallbacks, TableViewMode, ColumnKey } from "./types/table-types";
  import { validateTableIcons } from "../../utils/icon-validator";

  interface Props {
    cards: Card[];
    selectedCards: Set<string>;
    columnVisibility: ColumnVisibility;
    columnOrder: ColumnOrder;
    tableViewMode?: TableViewMode;
    onCardSelect: (cardId: string, selected: boolean) => void;
    onSelectAll: (selected: boolean) => void;
    onSort: (field: string) => void;
    sortConfig: { field: string; direction: "asc" | "desc" };
    onEdit: (cardId: string) => void;
    onDelete: (cardId: string) => void;
    onTagsUpdate?: (cardId: string, tags: string[]) => void;
    onPriorityUpdate?: (cardId: string, priority: number) => void;
    loading?: boolean;
    isSorting?: boolean;
    fieldTemplates?: any[]; // 保持兼容性，但已不使用预定义模板
    plugin?: any;
    onTempFileEdit?: (cardId: string) => void;
    decks?: Array<{id: string; name: string}>;
    onView?: (cardId: string) => void;
    availableTags?: string[];
    onJumpToSource?: (card: Card) => void;
    isVisible?: boolean; // 🔧 性能优化：组件可见性
  }

  let {
    cards,
    selectedCards,
    onCardSelect,
    onSelectAll,
    onSort,
    sortConfig,
    columnVisibility,
    columnOrder,
    tableViewMode = 'basic',
    onEdit,
    onDelete,
    onTagsUpdate,
    onPriorityUpdate,
    loading = false,
    isSorting = false,
    fieldTemplates = [],
    plugin,
    onTempFileEdit,
    decks = [],
    onView,
    availableTags = [],
    onJumpToSource,
    isVisible = true // 🔧 性能优化：默认可见
  }: Props = $props();

  // 🔧 修复reconciliation错误：过滤掉无效的卡片
  // 确保所有卡片都有有效的uuid，避免重复的'unknown' key
  let validCards = $derived(
    Array.isArray(cards) 
      ? cards.filter(card => card && card.uuid) 
      : []
  );

  // 列宽管理
  const COLUMN_WIDTHS_KEY = 'weave-table-column-widths';
  const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
    checkbox: 48,
    front: 200,
    back: 200,
    status: 140,
    deck: 150,
    tags: 160,
    priority: 100,
    created: 120,
    modified: 120,
    next_review: 130,
    retention: 100,
    interval: 90,
    difficulty: 90,
    review_count: 100,
    actions: 60,
    uuid: 120,
    obsidian_block_link: 150,
    source_document: 180,
    field_template: 160,
    source_document_status: 120,
    // 🆕 题库专用列宽度
    question_type: 120,
    accuracy: 100,
    test_attempts: 110,
    last_test: 130,
    error_level: 110,
    source_card: 200,
    // 🆕 增量阅读专用列宽度
    ir_title: 250,
    ir_source_file: 180,
    ir_state: 100,
    ir_priority: 80,
    ir_tags: 150,
    ir_favorite: 60,
    ir_next_review: 130,
    ir_review_count: 90,
    ir_reading_time: 100,
    ir_notes: 200,
    ir_extracted_cards: 100,
    ir_created: 120,
    ir_decks: 180,  // 🆕 所属牌组列宽度
  };

  // 表格视图模式列配置
  const TABLE_MODE_COLUMNS: Record<TableViewMode, ColumnKey[]> = {
    basic: [
      'front',
      'back',
      'status',
      'deck',
      'tags',
      'priority',
      'created',
      'modified',
      'source_document',
    ],
    review: [
      'front',
      'back',
      'status',
      'next_review',
      'retention',
      'interval',
      'difficulty',
      'review_count',
    ],
    // 🆕 题库考试模式
    questionBank: [
      'front',
      'back',
      'deck',
      'tags',
      'priority',
      'question_type',
      'accuracy',
      'test_attempts',
      'last_test',
      'error_level',
      'source_card',
      'created',
    ],
    // 🆕 增量阅读内容块模式
    irContent: [
      'ir_title',
      'ir_source_file',
      'ir_decks',       // 🆕 所属牌组（引入式架构）
      'ir_state',
      'ir_priority',
      'ir_tags',
      'ir_favorite',
      'ir_next_review',
      'ir_review_count',
      'ir_reading_time',
      'ir_extracted_cards',
      'ir_created',
    ],
  };

  let columnWidths = $state<ColumnWidths>({ ...DEFAULT_COLUMN_WIDTHS });
  let tableContainer = $state<HTMLElement | null>(null);
  let topScrollbar = $state<HTMLElement | null>(null);
  let bottomScrollbar = $state<HTMLElement | null>(null);
  let tableElement = $state<HTMLElement | null>(null);
  let scrollbarContent = $state<HTMLElement | null>(null);

  // 根据模式和用户设置计算实际显示的列
  let effectiveColumns = $derived.by(() => {
    const modeColumns = TABLE_MODE_COLUMNS[tableViewMode];
    
    // 🔧 关键修复：如果没有modeColumns，使用默认列
    if (!modeColumns || modeColumns.length === 0) {
      logger.warn('[WeaveCardTable] 未找到模式列配置:', tableViewMode);
      return ['front', 'back', 'status', 'actions'] as ColumnKey[];
    }
    
    // 🔧 关键修复：IR模式直接返回模式定义的列（不依赖columnOrder）
    // 因为columnOrder可能不包含新添加的IR列
    if (tableViewMode === 'irContent') {
      // 直接使用模式定义的列 + actions
      const irColumns = [...modeColumns, 'actions'] as ColumnKey[];
      logger.debug('[WeaveCardTable] IR模式列:', irColumns);
      return irColumns;
    }
    
    // 定义每个模式下应该强制显示的列（忽略 columnVisibility）
    const forceShowColumns: Record<TableViewMode, ColumnKey[]> = {
      basic: [] as ColumnKey[],
      review: ['modified', 'next_review', 'retention', 'interval', 'difficulty', 'review_count'] as ColumnKey[],
      questionBank: ['question_type', 'accuracy', 'test_attempts', 'last_test', 'error_level', 'source_card'] as ColumnKey[],
      irContent: ['ir_title', 'ir_source_file', 'ir_state', 'ir_priority', 'ir_next_review', 'ir_review_count'] as ColumnKey[],
    };
    
    const forcedCols = forceShowColumns[tableViewMode];
    
    // 过滤出当前模式下可见的列
    // 规则：
    // 1. actions 列总是显示
    // 2. 模式列表中的列 + 强制显示的列（在复习模式下）
    // 3. 其他列根据 columnVisibility 决定
    // 🔧 防御性检查：确保columnOrder存在
    if (!columnOrder || !Array.isArray(columnOrder)) {
      return ['front', 'back', 'status', 'actions'] as ColumnKey[];
    }
    
    const filteredColumns = columnOrder.filter(key => {
      // actions 列总是显示
      if (key === 'actions') return true;
      
      // 不在当前模式的列表中，过滤掉
      if (!modeColumns || !modeColumns.includes(key)) return false;
      
      // 在强制显示列表中，显示（复习模式的FSRS列）
      if (forcedCols && forcedCols.includes(key)) return true;
      
      // 其他列根据 columnVisibility 决定
      return columnVisibility[key] !== false;
    });
    
    return filteredColumns;
  });

  // 同步滚动条
  function syncScrollbars(source: 'top' | 'bottom') {
    if (source === 'top' && topScrollbar && bottomScrollbar) {
      bottomScrollbar.scrollLeft = topScrollbar.scrollLeft;
    } else if (source === 'bottom' && topScrollbar && bottomScrollbar) {
      topScrollbar.scrollLeft = bottomScrollbar.scrollLeft;
    }
  }

  // 更新滚动条宽度
  function updateScrollbarWidth() {
    if (tableElement && scrollbarContent) {
      // 使用setTimeout确保DOM已更新
      setTimeout(() => {
        if (tableElement && scrollbarContent) {
          const tableWidth = tableElement.scrollWidth;
          scrollbarContent.style.width = `${tableWidth}px`;
        }
      }, 0);
    }
  }

  // 监听表格宽度变化 - 添加防抖优化
  let updateScrollbarTimer: number | null = null;
  
  $effect(() => {
    // 当列宽、列顺序、列可见性或模式变化时，更新滚动条
    if (columnWidths && effectiveColumns && columnVisibility && tableViewMode) {
      // 防抖：避免频繁的 DOM 操作
      if (updateScrollbarTimer !== null) {
        clearTimeout(updateScrollbarTimer);
      }
      updateScrollbarTimer = window.setTimeout(() => {
        updateScrollbarWidth();
        updateScrollbarTimer = null;
      }, 50); // 50ms 防抖
    }
  });

  // 监听cards变化 - 添加防抖优化
  let cardsUpdateTimer: number | null = null;
  
  $effect(() => {
    if (cards) {
      // 防抖：避免频繁的 DOM 操作
      if (cardsUpdateTimer !== null) {
        clearTimeout(cardsUpdateTimer);
      }
      cardsUpdateTimer = window.setTimeout(() => {
        updateScrollbarWidth();
        cardsUpdateTimer = null;
      }, 100); // 100ms 防抖
    }
  });

  // 加载保存的列宽设置
  function loadColumnWidths() {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      if (saved) {
        const parsedWidths = JSON.parse(saved);
        columnWidths = { ...DEFAULT_COLUMN_WIDTHS, ...parsedWidths };
      }
    } catch (error) {
      logger.warn('Failed to load column widths:', error);
    }
  }

  // 保存列宽设置
  function saveColumnWidths() {
    try {
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));
    } catch (error) {
      logger.warn('Failed to save column widths:', error);
    }
  }

  // 处理列宽调整
  function handleColumnResize(columnKey: string, deltaX: number) {
    const currentWidth = columnWidths[columnKey as keyof ColumnWidths];
    const newWidth = Math.max(50, currentWidth + deltaX);

    columnWidths = {
      ...columnWidths,
      [columnKey]: newWidth
    };
    
    saveColumnWidths();
  }

  // 重置列宽到默认值
  function resetColumnWidths() {
    columnWidths = { ...DEFAULT_COLUMN_WIDTHS };
    saveColumnWidths();
  }

  // 组件挂载时加载保存的列宽
  onMount(() => {
    // 验证表格所需图标
    const iconValidation = validateTableIcons();
    if (!iconValidation.valid) {
      logger.warn('[Weave Table] 部分图标缺失，可能影响显示效果', iconValidation.missingIcons);
    }

    loadColumnWidths();

    // 监听重置列宽事件
    const handleResetColumnWidths = () => {
      resetColumnWidths();
    };

    if (tableContainer) {
      tableContainer.addEventListener('resetColumnWidths', handleResetColumnWidths);
    }

    // 性能优化：使用防抖的 ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    let resizeDebounceTimer: number | null = null;
    
    if (tableElement) {
      resizeObserver = new ResizeObserver(() => {
        // 防抖：避免频繁更新
        if (resizeDebounceTimer !== null) {
          clearTimeout(resizeDebounceTimer);
        }
        resizeDebounceTimer = window.setTimeout(() => {
          updateScrollbarWidth();
          resizeDebounceTimer = null;
        }, 100); // 100ms 防抖
      });
      resizeObserver.observe(tableElement);
    }

    // 清理事件监听器
    return () => {
      if (tableContainer) {
        tableContainer.removeEventListener('resetColumnWidths', handleResetColumnWidths);
      }
      if (resizeDebounceTimer !== null) {
        clearTimeout(resizeDebounceTimer);
      }
      if (resizeObserver && tableElement) {
        resizeObserver.unobserve(tableElement);
        resizeObserver.disconnect();
      }
      // 清理定时器
      if (updateScrollbarTimer !== null) {
        clearTimeout(updateScrollbarTimer);
      }
      if (cardsUpdateTimer !== null) {
        clearTimeout(cardsUpdateTimer);
      }
    };
  });

  // 拖拽批量选择状态
  let isDragSelectMode = $state(false);
  let dragSelectStartCard = $state<string | null>(null);
  
  // 拖拽批量选择开始
  function handleDragSelectStart(cardId: string) {
    isDragSelectMode = true;
    dragSelectStartCard = cardId;
    // 开始拖拽批量选择
    
    // 阻止页面滚动
    document.body.style.overflow = 'hidden';
    
    // 监听全局鼠标释放事件
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }
  
  // 拖拽批量选择移动
  function handleDragSelectMove(cardId: string) {
    if (!isDragSelectMode || !dragSelectStartCard) return;
    
    // 获取起始卡片和当前卡片的索引
    const startIndex = cards.findIndex(card => card.uuid === dragSelectStartCard);
    const currentIndex = cards.findIndex(card => card.uuid === cardId);
    
    if (startIndex === -1 || currentIndex === -1) return;
    
    // 确定选择范围
    const minIndex = Math.min(startIndex, currentIndex);
    const maxIndex = Math.max(startIndex, currentIndex);
    
    // 批量选择/取消选择
    const newSelectedCards = new Set(selectedCards);
    const startCardSelected = selectedCards.has(dragSelectStartCard);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const card = cards[i];
      if (card && card.uuid) {
        if (startCardSelected) {
          newSelectedCards.add(card.uuid);
        } else {
          newSelectedCards.delete(card.uuid);
        }
      }
    }
    
    // 触发选择状态变化
    for (const cardId of newSelectedCards) {
      if (!selectedCards.has(cardId)) {
        onCardSelect(cardId, true);
      }
    }
    
    for (const cardId of selectedCards) {
      if (!newSelectedCards.has(cardId)) {
        onCardSelect(cardId, false);
      }
    }
    
    // 拖拽批量选择范围操作完成
  }
  
  // 全局鼠标释放事件
  function handleGlobalMouseUp() {
    if (isDragSelectMode) {
      isDragSelectMode = false;
      dragSelectStartCard = null;
      
      // 恢复页面滚动
      document.body.style.overflow = '';
      
      // 移除全局事件监听
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      
      // 退出拖拽批量选择模式
    }
  }

  // 构建回调函数对象
  const callbacks: TableRowCallbacks = {
    onEdit,
    onDelete,
    onTagsUpdate,
    onPriorityUpdate,
    onTempFileEdit,
    onView,
    onJumpToSource
  };

  // 🔧 性能优化：移除虚拟滚动，使用分页
  // 虚拟滚动与分页冲突，已经通过分页限制了显示数量
  // 分页每页25-50条，不需要额外的虚拟滚动
</script>

<div class="weave-table-wrapper">
  {#if !loading && Array.isArray(cards) && cards.length > 0}
    <!-- 顶部横向滚动条 -->
    <div 
      class="weave-table-top-scrollbar" 
      bind:this={topScrollbar}
      onscroll={() => syncScrollbars('top')}
    >
      <div class="weave-table-scrollbar-content" bind:this={scrollbarContent}></div>
    </div>
  {/if}

  <!-- 主表格容器 -->
  <div 
    class="weave-table-container" 
    bind:this={tableContainer}
    onscroll={() => syncScrollbars('bottom')}
  >
    {#if !loading}
      <div bind:this={bottomScrollbar} style="overflow-x: auto; overflow-y: hidden;">
        <table class="weave-table" bind:this={tableElement}>
          <TableHeader
            {columnVisibility}
            columnOrder={effectiveColumns}
            tableViewMode={tableViewMode}
            {sortConfig}
            {selectedCards}
            totalCards={cards.length}
            {columnWidths}
            {onSelectAll}
            {onSort}
            {isSorting}
            onColumnResize={handleColumnResize}
          />
          <tbody class="weave-table-body">
            {#each validCards as card (card.uuid)}
              <TableRow
                {card}
                selected={selectedCards.has(card.uuid)}
                {columnVisibility}
                columnOrder={effectiveColumns}
                tableViewMode={tableViewMode}
                {callbacks}
                {plugin}
                {decks}
                {fieldTemplates}
                {availableTags}
                onSelect={onCardSelect}
                onDragSelectStart={handleDragSelectStart}
                onDragSelectMove={handleDragSelectMove}
                isDragSelectActive={isDragSelectMode}
                {isVisible}
              />
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .weave-table-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--background-primary);
    border-radius: var(--radius-m);
    border: 1px solid var(--background-modifier-border);
  }

  /* 顶部横向滚动条 */
  .weave-table-top-scrollbar {
    overflow-x: auto;
    overflow-y: hidden;
    height: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .weave-table-scrollbar-content {
    height: 1px;
    min-width: 1200px; /* 最小宽度与表格最小宽度一致 */
  }

  .weave-table-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: var(--background-primary);
  }

  .weave-table {
    width: 100%;
    min-width: 1200px;
    border-collapse: separate;
    border-spacing: 0;
    position: relative;
    table-layout: fixed;
  }

  .weave-table-body {
    position: relative;
  }

  /* 全局拖拽状态 */
  :global(body.resizing-column) {
    cursor: col-resize !important;
    user-select: none !important;
  }

  :global(body.resizing-column *) {
    cursor: col-resize !important;
    user-select: none !important;
  }
</style>
