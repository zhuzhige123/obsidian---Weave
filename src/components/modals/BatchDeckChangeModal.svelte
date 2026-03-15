<!--
  批量更换牌组模态框 - 重构版
  优雅干净的设计风格，使用多彩侧边颜色条
-->
<script lang="ts">
  import { Platform } from 'obsidian';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import { ICON_NAMES } from '../../icons/index.js';
  import type { Card, Deck } from '../../data/types';
  import { tr } from '../../utils/i18n';

  interface Props {
    open: boolean;
    selectedCards: Card[];
    decks: Deck[];
    onconfirm?: (targetDeckId: string, operationType: 'move' | 'copy') => void;
    oncancel?: () => void;
  }

  let { open, selectedCards, decks, onconfirm, oncancel }: Props = $props();

  let t = $derived($tr);
  const isMobile = Platform.isMobile;

  // 状态管理
  let selectedDeckId = $state('');
  let searchQuery = $state('');
  let operationType = $state<'move' | 'copy'>('move');

  // 筛选牌组
  let filteredDecks = $derived.by<Deck[]>(() => {
    if (!searchQuery.trim()) return decks;
    const query = searchQuery.toLowerCase();
    return decks.filter(deck => 
      deck.name.toLowerCase().includes(query) ||
      deck.description?.toLowerCase().includes(query)
    );
  });

  // 获取选中牌组名称
  let selectedDeckName = $derived(() => {
    const deck = decks.find(d => d.id === selectedDeckId);
    return deck?.name || '';
  });

  function resetState() {
    selectedDeckId = '';
    searchQuery = '';
    operationType = 'move';
  }

  function handleDeckSelect(deckId: string) {
    selectedDeckId = deckId;
  }

  function handleConfirm() {
    if (!selectedDeckId) return;
    onconfirm?.(selectedDeckId, operationType);
    resetState();
  }

  function handleCancel() {
    oncancel?.();
    resetState();
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  $effect(() => {
    if (!open) resetState();
  });
</script>

{#if open}
<div class="bdc-overlay" onclick={handleOverlayClick} onkeydown={handleOverlayKeydown} role="presentation" tabindex="-1">
  <div class="bdc-modal" class:mobile={isMobile} role="dialog" aria-modal="true" aria-labelledby="bdc-title">
    <!-- 标题栏 - 使用多彩侧边颜色条 -->
    <header class="bdc-header">
      <h2 id="bdc-title" class="bdc-title with-accent-bar accent-cyan">
        {t('modals.batchDeckChange.title')}
      </h2>
      <button class="bdc-close-btn" onclick={handleCancel} aria-label="关闭">
        <EnhancedIcon name={ICON_NAMES.CLOSE} size={18} />
      </button>
    </header>

    <main class="bdc-main">
      <!-- 卡片数量提示 -->
      <div class="bdc-card-count">
        已选择 <strong>{selectedCards.length}</strong> 张卡片
      </div>

      <!-- 操作类型选择 -->
      <div class="bdc-operation-section">
        <div class="bdc-section-label">操作类型</div>
        <div class="bdc-operation-tabs">
          <button 
            class="bdc-operation-tab"
            class:active={operationType === 'move'}
            onclick={() => operationType = 'move'}
            type="button"
          >
            <EnhancedIcon name={ICON_NAMES.ARROW_RIGHT} size={16} />
            <span>移动</span>
          </button>
          <button 
            class="bdc-operation-tab"
            class:active={operationType === 'copy'}
            onclick={() => operationType = 'copy'}
            type="button"
          >
            <EnhancedIcon name={ICON_NAMES.COPY} size={16} />
            <span>复制</span>
          </button>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="bdc-search">
        <EnhancedIcon name={ICON_NAMES.SEARCH} size={16} />
        <input
          type="text"
          placeholder="搜索牌组..."
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button class="bdc-search-clear" onclick={() => searchQuery = ''} type="button">
            <EnhancedIcon name={ICON_NAMES.CLOSE} size={14} />
          </button>
        {/if}
      </div>

      <!-- 牌组列表 -->
      <div class="bdc-deck-list">
        {#each filteredDecks as deck (deck.id)}
          <button
            class="bdc-deck-item"
            class:selected={selectedDeckId === deck.id}
            onclick={() => handleDeckSelect(deck.id)}
            type="button"
          >
            <div class="bdc-deck-icon">
              <EnhancedIcon name={ICON_NAMES.FOLDER} size={18} />
            </div>
            <span class="bdc-deck-name">{deck.name}</span>
            {#if selectedDeckId === deck.id}
              <div class="bdc-deck-check">
                <EnhancedIcon name={ICON_NAMES.CHECK} size={16} />
              </div>
            {/if}
          </button>
        {/each}
        
        {#if filteredDecks.length === 0}
          <div class="bdc-empty">
            <EnhancedIcon name={ICON_NAMES.FOLDER} size={32} />
            <p>没有找到匹配的牌组</p>
          </div>
        {/if}
      </div>
    </main>

    <!-- 底部操作栏 -->
    <footer class="bdc-footer">
      <button class="bdc-btn bdc-btn-secondary" onclick={handleCancel} type="button">
        取消
      </button>
      <button 
        class="bdc-btn bdc-btn-primary"
        onclick={handleConfirm}
        disabled={!selectedDeckId}
        type="button"
      >
        {operationType === 'move' ? '移动' : '复制'}到 {selectedDeckName() || '...'}
      </button>
    </footer>
  </div>
</div>
{/if}

<style>
  .bdc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
    padding: 1rem;
    backdrop-filter: blur(2px);
  }

  .bdc-modal {
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* 标题栏 */
  .bdc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bdc-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 多彩侧边颜色条 */
  .bdc-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
  }

  .bdc-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 24px;
    border-radius: 2px;
  }

  .bdc-title.accent-cyan::before {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(14, 165, 233, 0.7));
  }

  .bdc-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bdc-close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 主内容区 */
  .bdc-main {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .bdc-card-count {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .bdc-card-count strong {
    color: var(--text-normal);
    font-weight: 600;
  }

  /* 操作类型选择 */
  .bdc-operation-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bdc-section-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .bdc-operation-tabs {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .bdc-operation-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bdc-operation-tab:hover {
    color: var(--text-normal);
  }

  .bdc-operation-tab.active {
    background: var(--background-primary);
    color: var(--text-normal);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* 搜索框 */
  .bdc-search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--background-secondary);
    border: 1px solid transparent;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  .bdc-search:focus-within {
    border-color: var(--interactive-accent);
    background: var(--background-primary);
  }

  .bdc-search input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-normal);
    font-size: 0.875rem;
  }

  .bdc-search input::placeholder {
    color: var(--text-faint);
  }

  .bdc-search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bdc-search-clear:hover {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  /* 牌组列表 */
  .bdc-deck-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 280px;
    overflow-y: auto;
  }

  .bdc-deck-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-normal);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .bdc-deck-item:hover {
    background: var(--background-secondary);
  }

  .bdc-deck-item.selected {
    background: rgba(6, 182, 212, 0.15);
  }

  .bdc-deck-icon {
    color: var(--text-muted);
  }

  .bdc-deck-item.selected .bdc-deck-icon {
    color: rgb(6, 182, 212);
  }

  .bdc-deck-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bdc-deck-check {
    color: rgb(6, 182, 212);
  }

  .bdc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--text-faint);
    text-align: center;
  }

  .bdc-empty p {
    margin: 12px 0 0 0;
    font-size: 0.875rem;
  }

  /* 底部操作栏 */
  .bdc-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .bdc-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bdc-btn-secondary {
    background: transparent;
    color: var(--text-muted);
  }

  .bdc-btn-secondary:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .bdc-btn-primary {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(14, 165, 233, 0.8));
    color: white;
  }

  .bdc-btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .bdc-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 移动端适配 */
  .bdc-modal.mobile {
    max-width: 100%;
    max-height: 90vh;
    margin: 0;
    border-radius: 16px 16px 0 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
  }
</style>

