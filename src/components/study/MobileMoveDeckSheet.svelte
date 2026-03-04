<script lang="ts">
  /**
   * 移动牌组选择 Bottom Sheet 组件
   * 
   * Part A Task 6: 移动牌组菜单重构
   * Obsidian 风格的牌组列表，用于移动卡片到其他牌组
   * 
   * @module components/study/MobileMoveDeckSheet
   * @version 1.1.0
   * @requirements 使用 Obsidian 原生列表菜单设计
   */
  import BottomSheetModal from '../ui/BottomSheetModal.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  interface DeckItem {
    id: string;
    name: string;
    color: string;
    cardCount: number;
  }

  interface Props {
    /** 是否显示 */
    isOpen: boolean;
    /** 牌组列表 */
    decks: DeckItem[];
    /** 当前牌组ID */
    currentDeckId?: string;
    /** 关闭回调 */
    onClose: () => void;
    /** 选择牌组回调 */
    onSelectDeck: (deckId: string) => void;
  }

  let {
    isOpen = false,
    decks = [],
    currentDeckId = '',
    onClose,
    onSelectDeck
  }: Props = $props();

  function handleDeckSelect(deckId: string) {
    onSelectDeck(deckId);
    onClose();
  }
</script>

<BottomSheetModal
  {isOpen}
  {onClose}
  title="移动到牌组"
  height="auto"
>
  <div class="deck-list">
    {#each decks as deck}
      <button
        class="deck-list-item"
        class:current={deck.id === currentDeckId}
        onclick={() => handleDeckSelect(deck.id)}
      >
        <span class="deck-list-icon">
          <ObsidianIcon name="folder" size={16} />
        </span>
        <span class="deck-list-name">{deck.name}</span>
        <span class="deck-list-count">{deck.cardCount}</span>
        {#if deck.id === currentDeckId}
          <span class="deck-list-check">
            <ObsidianIcon name="check" size={16} />
          </span>
        {/if}
      </button>
    {/each}
  </div>
</BottomSheetModal>

<style>
  .deck-list {
    padding: 4px 0;
  }

  /* 🔧 使用 Obsidian 原生列表菜单设计 */
  .deck-list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    border-radius: 4px;
    margin: 0 4px;
    width: calc(100% - 8px);
    transition: background-color 0.1s ease;
  }

  .deck-list-item:hover {
    background: var(--background-modifier-hover);
  }

  .deck-list-item:active {
    background: var(--background-modifier-active-hover);
  }

  .deck-list-item.current {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .deck-list-item.current .deck-list-icon,
  .deck-list-item.current .deck-list-name,
  .deck-list-item.current .deck-list-count,
  .deck-list-item.current .deck-list-check {
    color: var(--text-on-accent);
  }

  .deck-list-icon {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .deck-list-name {
    flex: 1;
    font-size: 14px;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deck-list-count {
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 6px;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .deck-list-item.current .deck-list-count {
    background: rgba(255, 255, 255, 0.2);
  }

  .deck-list-check {
    color: var(--interactive-accent);
    display: flex;
    align-items: center;
  }
</style>
