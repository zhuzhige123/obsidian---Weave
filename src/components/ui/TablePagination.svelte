<script lang="ts">
  import { Menu, Platform } from "obsidian";
  import { tr } from "../../utils/i18n";
  import ObsidianDropdown from "./ObsidianDropdown.svelte";

  interface Props {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (size: number) => void;
  }

  let {
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange
  }: Props = $props();
  
  let t = $derived($tr);

  //  移动端检测
  const isMobile = Platform.isMobile;

  const pageSizes = [20, 50, 100, 200, 500];

  let totalPages = $derived(Math.ceil(totalItems / itemsPerPage));
  let isTransitioning = $state(false);

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages && !isTransitioning) {
      isTransitioning = true;
      onPageChange(page);
      setTimeout(() => {
        isTransitioning = false;
      }, 300);
    }
  }

  //  移动端：Obsidian Menu 选择每页行数
  function showPageSizeMenu(event: MouseEvent) {
    event.stopPropagation();
    const menu = new Menu();
    
    pageSizes.forEach(size => {
      menu.addItem(item => {
        item
          .setTitle(`${size} 条/页`)
          .setIcon(size === itemsPerPage ? 'check' : 'list')
          .onClick(() => {
            onItemsPerPageChange(size);
          });
      });
    });

    menu.showAtMouseEvent(event);
  }
</script>

<div class="table-pagination" class:transitioning={isTransitioning} class:mobile={isMobile}>
  {#if isMobile}
    <!--  移动端布局：简洁单行 -->
    <div class="mobile-pagination-row">
      <button 
        class="mobile-page-size-btn"
        onclick={showPageSizeMenu}
        type="button"
        aria-label="每页显示数量"
      >
        {itemsPerPage}
      </button>
      
      <div class="mobile-pagination-controls">
        <button onclick={() => goToPage(1)} disabled={currentPage === 1} class="mobile-nav-btn" aria-label="首页">«</button>
        <button onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} class="mobile-nav-btn" aria-label="上一页">‹</button>
        <span class="mobile-page-info">{currentPage}/{totalPages}</span>
        <button onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} class="mobile-nav-btn" aria-label="下一页">›</button>
        <button onclick={() => goToPage(totalPages)} disabled={currentPage === totalPages} class="mobile-nav-btn" aria-label="末页">»</button>
      </div>
      
      <span class="mobile-total">{totalItems}</span>
    </div>
  {:else}
    <!--  桌面端布局 -->
    <div class="items-per-page">
      <ObsidianDropdown
        options={pageSizes.map((size) => ({ id: String(size), label: String(size) }))}
        value={String(itemsPerPage)}
        onchange={(value) => onItemsPerPageChange(parseInt(value, 10))}
      />
    </div>
    <div class="pagination-controls">
      <button onclick={() => goToPage(1)} disabled={currentPage === 1} title={t('ui.pagination.previous')}>&laquo;</button>
      <button onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} title={t('ui.pagination.previous')}>&lsaquo;</button>
      <span class="page-info">
        {t('ui.pagination.page').replace('{n}', `${currentPage}/${totalPages}`)}
      </span>
      <button onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} title={t('ui.pagination.next')}>&rsaquo;</button>
      <button onclick={() => goToPage(totalPages)} disabled={currentPage === totalPages} title={t('ui.pagination.next')}>&raquo;</button>
    </div>
    <div class="total-items">
      {t('ui.pagination.total').replace('{n}', String(totalItems))}
    </div>
  {/if}
</div>

<style>
  .table-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: transparent;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  /*  移动端样式 - 无底色差异 */
  .table-pagination.mobile {
    padding: 10px 12px;
    background: transparent;
  }

  .mobile-pagination-row {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    gap: 8px;
  }

  .mobile-page-size-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
    min-width: 32px;
    min-height: 28px;
    border-radius: 4px;
  }

  .mobile-page-size-btn:active {
    background: var(--background-modifier-hover);
  }

  .mobile-pagination-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mobile-nav-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px 10px;
    min-width: 32px;
    min-height: 28px;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .mobile-nav-btn:active:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .mobile-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .mobile-page-info {
    font-size: 13px;
    color: var(--text-muted);
    padding: 0 8px;
    min-width: 50px;
    text-align: center;
  }

  .mobile-total {
    font-size: 12px;
    color: var(--text-faint);
    white-space: nowrap;
  }

  /*  桌面端样式 */
  .items-per-page,
  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  button {
    background: none;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    cursor: pointer;
    padding: 0.25rem 0.75rem;
    transition: all 0.2s ease;
    transform: scale(1);
  }

  button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--text-muted);
    transform: scale(1.05);
  }

  button:active:not(:disabled) {
    transform: scale(0.95);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 翻页动画效果 */
  .table-pagination.transitioning {
    opacity: 0.8;
  }

  .pagination-controls {
    position: relative;
  }

  .pagination-controls button:not(:disabled):active {
    animation: pageChangeClick 0.3s ease;
  }

  @keyframes pageChangeClick {
    0% { transform: scale(1); }
    50% { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
</style>
