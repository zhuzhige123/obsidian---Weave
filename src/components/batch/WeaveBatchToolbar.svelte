<script lang="ts">
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import { tr } from "../../utils/i18n";
  import { showObsidianConfirm } from "../../utils/obsidian-confirm";
  import type { App } from "obsidian";

  interface Props {
    selectedCount: number;
    visible: boolean;
    app: App;
    dataSource?: 'memory' | 'questionBank' | 'incremental-reading';
    onBatchChangeDeck?: (event: MouseEvent) => void;
    onBatchTagsMenu?: (event: MouseEvent) => void;  // 标签操作菜单（增加/移除合并）
    onBatchDelete?: () => void;
    onClearSelection?: () => void;
    // 组建牌组
    onBuildDeck?: () => void;
    // 增量阅读操作
    onBuildIRDeck?: () => void;
    onIRChangeDeck?: (event: MouseEvent) => void;
    onIRToggleFavorite?: () => void;
    onIRExtractCards?: () => void;
    isMobile?: boolean;
  }

  let {
    selectedCount,
    visible,
    app,
    dataSource = 'memory',
    onBatchChangeDeck,
    onBatchTagsMenu,
    onBatchDelete,
    onClearSelection,
    onBuildDeck,
    onBuildIRDeck,
    onIRChangeDeck,
    onIRToggleFavorite,
    onIRExtractCards,
    isMobile = false
  }: Props = $props();
  
  let t = $derived($tr);

  // 处理更换牌组
  function handleBatchChangeDeckClick(event: MouseEvent) {
    onBatchChangeDeck?.(event);
  }

  // 处理标签操作菜单
  function handleBatchTagsMenuClick(event: MouseEvent) {
    onBatchTagsMenu?.(event);
  }

  // 处理批量删除
  async function handleBatchDeleteClick() {
    const confirmed = await showObsidianConfirm(
      app,
      t('cardManagement.batchDelete.confirm').replace('{count}', String(selectedCount)),
      { title: '确认删除', confirmText: '删除' }
    );
    if (confirmed) {
      onBatchDelete?.();
    }
  }

  // 组建牌组
  function handleBuildDeckClick() {
    onBuildDeck?.();
  }

  // IR: 组建增量牌组
  function handleBuildIRDeckClick() {
    onBuildIRDeck?.();
  }

  // IR: 更换牌组
  function handleIRChangeDeckClick(event: MouseEvent) {
    onIRChangeDeck?.(event);
  }

  // IR: 切换收藏
  function handleIRToggleFavoriteClick() {
    onIRToggleFavorite?.();
  }

  // IR: 提取卡片
  function handleIRExtractCardsClick() {
    onIRExtractCards?.();
  }

  // 是否为增量阅读数据源
  const isIRDataSource = $derived(dataSource === 'incremental-reading');

</script>

{#if visible}
  <div class="weave-batch-toolbar" class:visible={selectedCount > 0} class:mobile={isMobile}>
    <div class="weave-toolbar-info">
      <span>已选{selectedCount}张</span>
    </div>
    <div class="weave-toolbar-actions">
      {#if isIRDataSource}
        <!-- 增量阅读模式按钮顺序：组建牌组、更换牌组、收藏、提取卡片、标签操作、删除 -->
        {#if onBuildIRDeck}
          <div class="weave-toolbar-btn weave-btn-primary" role="button" tabindex="-1" title="组建增量牌组" onclick={handleBuildIRDeckClick}>
            <EnhancedIcon name="layers" size={16} />
          </div>
        {/if}
        {#if onIRChangeDeck}
          <div class="weave-toolbar-btn" role="button" tabindex="-1" title="更换牌组" onclick={handleIRChangeDeckClick}>
            <EnhancedIcon name="folder" size={16} />
          </div>
        {/if}
        {#if onIRToggleFavorite}
          <div class="weave-toolbar-btn" role="button" tabindex="-1" title="切换收藏" onclick={handleIRToggleFavoriteClick}>
            <EnhancedIcon name="heart" size={16} />
          </div>
        {/if}
        {#if onIRExtractCards}
          <div class="weave-toolbar-btn" role="button" tabindex="-1" title="提取卡片" onclick={handleIRExtractCardsClick}>
            <EnhancedIcon name="file-plus" size={16} />
          </div>
        {/if}
      {:else}
        <!-- 记忆/考试模式按钮顺序：组建牌组、更换牌组、标签操作、删除 -->
        {#if onBuildDeck}
          <div class="weave-toolbar-btn weave-btn-primary" role="button" tabindex="-1" title="组建牌组" onclick={handleBuildDeckClick}>
            <EnhancedIcon name="layers" size={16} />
          </div>
        {/if}
        {#if onBatchChangeDeck}
          <div class="weave-toolbar-btn" role="button" tabindex="-1" title={t('cardManagement.batchToolbar.changeDeck')} onclick={handleBatchChangeDeckClick}>
            <EnhancedIcon name="folder" size={16} />
          </div>
        {/if}
      {/if}
      <!-- 通用按钮：标签操作、删除 -->
      {#if onBatchTagsMenu}
        <div class="weave-toolbar-btn" role="button" tabindex="-1" title="标签操作" onclick={handleBatchTagsMenuClick}>
          <EnhancedIcon name="tag" size={16} />
        </div>
      {/if}
      <div class="weave-toolbar-btn weave-btn-danger" role="button" tabindex="-1" title={t('ui.delete')} onclick={handleBatchDeleteClick}>
        <EnhancedIcon name="trash-2" size={16} />
      </div>
      <div class="weave-toolbar-btn weave-btn-secondary" role="button" tabindex="-1" title="取消选择" onclick={() => onClearSelection?.()}>
        <EnhancedIcon name="x-circle" size={16} />
      </div>
    </div>
  </div>
{/if}

<style>
  .weave-batch-toolbar {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(8px);
    z-index: var(--weave-z-overlay);
    animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: calc(100vw - 2rem);
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }

  .weave-toolbar-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-accent);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .weave-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .weave-toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-normal);
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 2.5rem;
    height: 2.5rem;
    box-shadow: none;
    outline: none;
  }

  .weave-toolbar-btn:hover {
    background: var(--background-modifier-hover);
  }

  .weave-toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: transparent;
  }

  .weave-toolbar-btn:disabled:hover {
    background: transparent;
  }

  .weave-btn-danger {
    color: var(--text-error);
  }

  .weave-btn-danger:hover {
    background: var(--background-modifier-error);
    color: white;
  }

  .weave-btn-secondary {
    color: var(--text-muted);
  }

  .weave-btn-secondary:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 🆕 主要操作按钮（组建牌组） */
  .weave-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .weave-btn-primary:hover {
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  }


  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* 移动端适配 */
  .weave-batch-toolbar.mobile {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem 0.75rem 0 0;
    bottom: 48px;
    left: 0;
    right: 0;
    transform: none;
    max-width: none;
  }

  .weave-batch-toolbar.mobile .weave-toolbar-info {
    align-self: flex-start;
  }

  .weave-batch-toolbar.mobile .weave-toolbar-actions {
    width: 100%;
    justify-content: space-around;
    flex-wrap: wrap;
  }

  .weave-batch-toolbar.mobile .weave-toolbar-btn {
    width: 2.5rem;
    height: 2.5rem;
    flex: none;
  }
</style>
