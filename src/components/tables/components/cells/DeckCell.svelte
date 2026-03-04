<script lang="ts">
  import { truncateText } from "../../utils/table-utils";
  import type { DeckCellProps } from "../../types/table-types";
  // 🆕 v2.2: 导入YAML解析工具
  import { getCardMetadata } from "../../../../utils/yaml-utils";

  let { card, decks = [] }: DeckCellProps = $props();

  // 🆕 v2.2: 直接从 content YAML 的 we_decks 获取牌组名称
  // 使用 getCardDeckNamesFromYaml 工具函数，内部已处理名称/ID转换
  const referencedDeckNames = $derived.by(() => {
    // 优先从 content YAML 获取牌组名称
    if (card.content) {
      try {
        const metadata = getCardMetadata(card.content);
        if (metadata.we_decks && metadata.we_decks.length > 0) {
          const names: string[] = [];
          for (const value of metadata.we_decks) {
            // 检测值是否是牌组ID格式（deck_开头）
            const isDeckIdFormat = value.startsWith('deck_');
            if (isDeckIdFormat) {
              // 值是ID，转换为名称
              const matchedDeck = decks.find(d => d.id === value);
              names.push(matchedDeck?.name || value);
            } else {
              // 值本身就是名称，直接使用
              names.push(value);
            }
          }
          if (names.length > 0) {
            return names;
          }
        }
      } catch (e) {
        // 解析失败，继续回退逻辑
      }
    }
    
    // 回退：通过 deck.cardUUIDs 查找引用该卡片的牌组
    const names: string[] = [];
    for (const deck of decks) {
      if ('cardUUIDs' in deck && deck.cardUUIDs?.includes(card.uuid)) {
        if (deck.name && !names.includes(deck.name)) {
          names.push(deck.name);
        }
      }
    }
    
    return names;
  });

  // 显示名称：多个牌组用逗号分隔
  const displayNames = $derived.by(() => {
    const names = referencedDeckNames;
    if (names.length === 0) return '';
    if (names.length === 1) return truncateText(names[0], 20);
    // 多牌组：显示第一个 + 数量
    return `${truncateText(names[0], 15)} +${names.length - 1}`;
  });

  // 完整的牌组名称列表（用于 tooltip）
  const fullDeckNames = $derived(referencedDeckNames.join('\n'));

  // 是否有牌组（有ID且能找到对应的牌组名称）
  const hasDecks = $derived(referencedDeckNames.length > 0);

  // 是否有多个牌组
  const hasMultipleDecks = $derived(referencedDeckNames.length > 1);
</script>

<td class="weave-deck-column">
  <div class="weave-decks-container">
    {#if hasDecks}
      {#each referencedDeckNames.slice(0, 2) as deckName}
        <span class="weave-deck-badge" title={deckName}>
          {truncateText(deckName, 12)}
        </span>
      {/each}
      {#if referencedDeckNames.length > 2}
        <span class="weave-deck-more" title={fullDeckNames}>
          +{referencedDeckNames.length - 2}
        </span>
      {/if}
    {:else}
      <span class="weave-text-muted">未分配</span>
    {/if}
  </div>
</td>

<style>
  .weave-deck-column {
    width: 180px;
    min-width: 150px;
    max-width: 250px;
    text-align: left;
  }

  .weave-decks-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .weave-deck-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 4px;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    white-space: nowrap;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid var(--background-modifier-border);
  }

  .weave-deck-more {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    font-size: 0.7rem;
    font-weight: 500;
    border-radius: 4px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .weave-text-muted {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
</style>

