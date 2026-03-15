<!--
  虚拟化数据表格组件
  为大量数据提供高性能的表格显示
-->
<script lang="ts">
  import VirtualScroll from '../ui/VirtualScroll.svelte';
  import { i18n } from '../../utils/i18n';

  interface TableColumn {
    key: string;
    title: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    formatter?: (value: any, row: any) => string;
    sortable?: boolean;
  }

  interface Props {
    data: any[];
    columns: TableColumn[];
    height?: number;
    itemHeight?: number;
    loading?: boolean;
    emptyText?: string;
    onRowClick?: (row: any, index: number) => void;
    onSort?: (column: string, direction: 'asc' | 'desc') => void;
  }

  let {
    data = [],
    columns = [],
    height,
    itemHeight = 48,
    loading = false,
    emptyText,
    onRowClick,
    onSort
  }: Props = $props();

  // 动态计算容器高度
  let containerHeight = $derived(() => {
    if (height !== undefined) return height - 48; // 减去表头高度
    // 如果没有提供height，使用flex自适应
    return undefined;
  });

  // 排序状态
  let sortColumn = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  // 虚拟滚动实例 - 使用$state声明以符合Svelte 5规范
  let virtualScroll = $state<any>(null);

  // 处理的数据
  let processedData = $derived(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn as string];
      const bValue = b[sortColumn as string];
      
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  /**
   * 处理列排序
   */
  function handleSort(column: TableColumn) {
    if (!column.sortable) return;

    if (sortColumn === column.key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column.key;
      sortDirection = 'asc';
    }

    if (onSort) {
      onSort(column.key, sortDirection);
    }
  }

  /**
   * 格式化单元格值
   */
  function formatCellValue(value: any, row: any, column: TableColumn): string {
    if (column.formatter) {
      return column.formatter(value, row);
    }
    
    if (typeof value === 'number') {
      if (column.key.includes('accuracy') || column.key.includes('rate')) {
        return `${(value * 100).toFixed(1)}%`;
      }
      if (column.key.includes('interval')) {
        return `${value.toFixed(1)}天`;
      }
      return value.toLocaleString();
    }
    
    return String(value || '');
  }

  /**
   * 处理行点击
   */
  function handleRowClick(row: any, index: number) {
    if (onRowClick) {
      onRowClick(row, index);
    }
  }

  /**
   * 滚动到指定行
   */
  export function scrollToRow(index: number, align: 'start' | 'center' | 'end' = 'start') {
    if (virtualScroll) {
      virtualScroll.scrollToIndex(index, align);
    }
  }

  /**
   * 获取滚动信息
   */
  export function getScrollInfo() {
    return virtualScroll?.getScrollInfo() || null;
  }
</script>

<div class="virtualized-table" class:loading>
  <!-- 表头 -->
  <div class="table-header">
    <div class="table-row header-row">
      {#each columns as column}
        {#if column.sortable}
          <button
            class="table-cell header-cell sortable"
            class:sorted={sortColumn === column.key}
            class:asc={sortColumn === column.key && sortDirection === 'asc'}
            class:desc={sortColumn === column.key && sortDirection === 'desc'}
            style="width: {column.width || 'auto'}; text-align: {column.align || 'left'};"
            onclick={() => handleSort(column)}
            type="button"
          >
            <span class="header-text">{column.title}</span>
            <span class="sort-indicator">
              {#if sortColumn === column.key}
                {sortDirection === 'asc' ? '↑' : '↓'}
              {:else}
                ↕
              {/if}
            </span>
          </button>
        {:else}
          <div
            class="table-cell header-cell"
            style="width: {column.width || 'auto'}; text-align: {column.align || 'left'};"
          >
            <span class="header-text">{column.title}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- 表体 -->
  <div class="table-body">
    {#if processedData.length === 0}
      <div class="empty-state">
        <div class="empty-icon">--</div>
        <p class="empty-text">{emptyText || i18n.t('analytics.dashboard.noData')}</p>
      </div>
    {:else if containerHeight() !== undefined}
      <VirtualScroll
        bind:this={virtualScroll}
        items={processedData()}
        {itemHeight}
        containerHeight={containerHeight() as number}
        overscan={3}
        className="table-virtual-scroll"
      >
        {#snippet children(row: any, index: number)}
          {#if onRowClick}
            <button
              type="button"
              class="table-row data-row clickable"
              onclick={() => handleRowClick(row, index)}
            >
              {#each columns as column}
                <div 
                  class="table-cell data-cell"
                  style="width: {column.width || 'auto'}; text-align: {column.align || 'left'};"
                  title={formatCellValue(row[column.key], row, column)}
                >
                  {formatCellValue(row[column.key], row, column)}
                </div>
              {/each}
            </button>
          {:else}
            <div class="table-row data-row">
              {#each columns as column}
                <div 
                  class="table-cell data-cell"
                  style="width: {column.width || 'auto'}; text-align: {column.align || 'left'};"
                  title={formatCellValue(row[column.key], row, column)}
                >
                  {formatCellValue(row[column.key], row, column)}
                </div>
              {/each}
            </div>
          {/if}
        {/snippet}
      </VirtualScroll>
    {:else}
      <!-- 自适应模式：渲染所有行 -->
      <div class="table-simple-scroll">
        {#each processedData() as row, index}
          {#if onRowClick}
            <button
              type="button"
              class="table-row data-row clickable"
              onclick={() => handleRowClick(row, index)}
            >
              {#each columns as column}
                <div 
                  class="table-cell data-cell"
                  style="width: {column.width || 'auto'}; text-align: {column.align || 'left'};"
                  title={formatCellValue(row[column.key], row, column)}
                >
                  {formatCellValue(row[column.key], row, column)}
                </div>
              {/each}
            </button>
          {:else}
            <div class="table-row data-row">
              {#each columns as column}
                <div 
                  class="table-cell data-cell"
                  style="width: {column.width || 'auto'}; text-align: {column.align || 'left'};"
                  title={formatCellValue(row[column.key], row, column)}
                >
                  {formatCellValue(row[column.key], row, column)}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <!-- 加载遮罩 -->
  {#if loading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">加载中...</p>
    </div>
  {/if}
</div>

<style>
  .virtualized-table {
    position: relative;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .table-header {
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .table-row {
    display: flex;
    align-items: center;
    min-height: 48px;
  }

  .header-row {
    font-weight: 600;
    color: var(--text-normal);
  }

  .data-row {
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background-color 0.1s ease;
  }

  .data-row:hover {
    background-color: var(--background-modifier-hover);
  }

  .data-row.clickable {
    cursor: pointer;
  }

  .data-row:last-child {
    border-bottom: none;
  }

  .table-cell {
    padding: 0.75rem 1rem;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    user-select: none;
  }

  .header-cell.sortable {
    cursor: pointer;
    transition: background-color 0.1s ease;
  }

  .header-cell.sortable:hover {
    background-color: var(--background-modifier-hover);
  }

  .header-cell.sorted {
    background-color: var(--background-modifier-active);
  }

  .header-text {
    flex: 1;
    font-size: 0.875rem;
  }

  .sort-indicator {
    font-size: 0.75rem;
    color: var(--text-muted);
    opacity: 0.6;
    transition: opacity 0.1s ease;
  }

  .header-cell.sortable:hover .sort-indicator,
  .header-cell.sorted .sort-indicator {
    opacity: 1;
  }

  .data-cell {
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .table-body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .table-simple-scroll {
    overflow-y: auto;
    flex: 1;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    opacity: 0.5;
  }

  .empty-text {
    margin: 0;
    font-size: 0.875rem;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--background-primary-rgb), 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 0.5rem;
  }

  .loading-text {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .table-cell {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
    }

    .header-text {
      font-size: 0.8rem;
    }

    .sort-indicator {
      font-size: 0.7rem;
    }
  }
</style>
