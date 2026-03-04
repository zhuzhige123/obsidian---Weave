<script lang="ts">
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import EnhancedButton from "../ui/EnhancedButton.svelte";
  import { Platform } from "obsidian";
  import { ChildCardsMenuBuilder } from "../../services/menu/ChildCardsMenuBuilder";
  import ObsidianDropdown from "../ui/ObsidianDropdown.svelte";
  
  //  导入国际化
  import { tr } from "../../utils/i18n";

  interface Props {
    showChildOverlay: boolean;
    selectedCount: number;
    onReturn: () => void;
    onRegenerate: () => void;
    onSave: () => void;
    canUndo?: boolean;
    onUndo?: () => void;
    isRegenerating?: boolean; // 🆕 是否正在重新生成
    // 🆕 牌组选择相关
    showDeckSelector?: boolean; // 是否显示牌组选择器（AI拆分模式）
    availableDecks?: Array<{ id: string; name: string }>; // 可选牌组列表
    selectedDeckId?: string; // 当前选中的牌组ID
    onDeckChange?: (deckId: string) => void; // 牌组选择回调
  }

  let { 
    showChildOverlay, 
    selectedCount, 
    onReturn, 
    onRegenerate, 
    onSave,
    canUndo = false,
    onUndo,
    isRegenerating = false,
    // 🆕 牌组选择相关
    showDeckSelector = false,
    availableDecks = [],
    selectedDeckId = '',
    onDeckChange
  }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);
  
  //  移动端检测
  const isMobile = Platform.isMobile;
  
  //  移动端：使用 Obsidian Menu API 显示牌组选择菜单
  function handleDeckSelectorClick(event: MouseEvent) {
    if (!isMobile || !onDeckChange) return;
    
    const menuBuilder = new ChildCardsMenuBuilder(
      {
        selectedCount,
        isRegenerating,
        showDeckSelector,
        availableDecks,
        selectedDeckId
      },
      {
        onReturn,
        onRegenerate,
        onSave,
        onDeckChange
      }
    );
    
    menuBuilder.showDeckSelectMenu({
      x: event.clientX,
      y: event.clientY
    });
  }
  
  // 获取当前选中的牌组名称
  let selectedDeckName = $derived(
    availableDecks.find(d => d.id === selectedDeckId)?.name || '选择牌组...'
  );
</script>

<div class="unified-actions-bar" class:mobile={isMobile}>
  {#if showChildOverlay}
    <!-- 1. 牌组选择器（仅在AI拆分模式显示，靠左） -->
    {#if showDeckSelector && availableDecks.length > 0}
      {#if isMobile}
        <!--  移动端：使用按钮触发 Obsidian Menu -->
        <button 
          class="action-btn deck-selector-btn" 
          onclick={handleDeckSelectorClick}
          type="button"
        >
          <EnhancedIcon name="folder" size="18" />
          <span class="deck-name">{selectedDeckName}</span>
          <EnhancedIcon name="chevron-down" size="14" />
        </button>
      {:else}
        <!-- 桌面端：使用原生 select -->
        <div class="deck-selector">
          <label for="deck-select">导入到记忆牌组：</label>
          <ObsidianDropdown
            className="deck-select"
            options={[
              { id: '', label: '选择牌组...' },
              ...availableDecks.map((deck) => ({ id: deck.id, label: deck.name }))
            ]}
            value={selectedDeckId}
            onchange={(value) => {
              onDeckChange?.(value);
            }}
          />
        </div>
      {/if}
    {/if}
    
    <!-- 弹性空间 - 把其他按钮推到右侧 -->
    <div class="flex-spacer"></div>
    
    <!-- 2. 返回按钮 -->
    <button class="action-btn secondary" onclick={onReturn} type="button">
      {#if isMobile}
        <EnhancedIcon name="arrow-left" size="18" />
      {/if}
      {#if !isMobile}
        <span>{t('studyInterface.actions.return')}</span>
      {/if}
    </button>
    
    <!-- 3. 重新生成按钮 -->
    <button 
      class="action-btn primary" 
      onclick={onRegenerate} 
      disabled={isRegenerating}
      type="button"
      title={isRegenerating ? '正在重新生成，请稍候...' : ''}
    >
      {#if isMobile}
        <EnhancedIcon name="refresh-cw" size="18" />
      {/if}
      {#if !isMobile}
        <span>{t('studyInterface.actions.regenerate')}</span>
      {/if}
    </button>
    
    <!-- 4. 收入按钮 -->
    <button 
      class="action-btn primary" 
      onclick={onSave} 
      disabled={selectedCount === 0 || isRegenerating || (showDeckSelector && !selectedDeckId)}
      type="button"
      title={isRegenerating ? '正在重新生成，请稍候...' : (showDeckSelector && !selectedDeckId) ? '请先选择目标牌组' : ''}
    >
      {#if isMobile}
        <EnhancedIcon name="save" size="18" />
      {/if}
      {#if isMobile}
        <span>{selectedCount}</span>
      {:else}
        <span>{t('studyInterface.actions.collect').replace('{n}', String(selectedCount))}</span>
      {/if}
    </button>
  {/if}
</div>

<style>
  .unified-actions-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    background: var(--background-primary);
    border-top: none; /* 移除分割线 */
    position: relative;
    z-index: 90;
  }
  
  /*  移动端样式 */
  .unified-actions-bar.mobile {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }

  .flex-spacer {
    flex: 1;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    outline: none;
  }
  
  /*  移动端按钮样式 */
  .mobile .action-btn {
    padding: 0.5rem 0.75rem;
    gap: 0.25rem;
  }

  .action-btn.secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .action-btn.secondary:hover {
    background: var(--background-modifier-active-hover);
    transform: translateY(-1px);
  }

  .action-btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .action-btn.primary:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(76, 175, 80, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* 🆕 牌组选择器样式 */
  .deck-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* 移除margin-left: auto，让flexbox自然排列 */
  }

  .deck-selector label {
    font-size: 0.875rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .deck-select {
    min-width: 160px;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  :global(.obsidian-dropdown-trigger.deck-select) {
    min-width: 160px;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    cursor: pointer;
    min-height: 0;
  }

  .deck-select:hover {
    border-color: var(--interactive-accent);
  }

  :global(.obsidian-dropdown-trigger.deck-select:hover:not(.disabled)) {
    border-color: var(--interactive-accent);
  }

  .deck-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
  }

  :global(.obsidian-dropdown-trigger.deck-select:focus-visible) {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: none;
  }
  
  /*  移动端牌组选择器按钮样式 */
  .deck-selector-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal);
    max-width: 140px;
  }
  
  .deck-selector-btn .deck-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  
  .deck-selector-btn:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }
  
  .deck-selector-btn:active {
    background: var(--background-modifier-active-hover);
  }
</style>

