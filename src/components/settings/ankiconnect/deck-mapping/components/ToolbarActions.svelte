<!--
  工具栏操作组件
  职责：获取Anki牌组、添加映射按钮等工具栏操作
-->
<script lang="ts">
  import type { AnkiDeckInfo } from '../../../../../types/ankiconnect-types';
  import type { Deck } from '../../../../../data/types';
  import { tr } from '../../../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    ankiDecks: AnkiDeckInfo[];
    weaveDecks: Deck[];
    isFetchingDecks: boolean;
    showAddModal: boolean;
    onFetchDecks: () => Promise<void>;
    onToggleAddModal: () => void;
  }

  let { 
    ankiDecks, 
    weaveDecks, 
    isFetchingDecks, 
    showAddModal,
    onFetchDecks,
    onToggleAddModal
  }: Props = $props();
</script>

<div class="toolbar">
  <button
    class="btn btn-primary"
    onclick={onFetchDecks}
    disabled={isFetchingDecks}
  >
    {isFetchingDecks ? t('ankiConnect.toolbar.fetching') : t('ankiConnect.toolbar.fetchAnkiDecks')}
  </button>
  {#if ankiDecks.length > 0}
    <span class="deck-count">{t('ankiConnect.toolbar.deckCount', { count: ankiDecks.length })}</span>
  {/if}
  <button
    class="btn btn-success"
    onclick={onToggleAddModal}
    disabled={weaveDecks.length === 0 || ankiDecks.length === 0}
    title={weaveDecks.length === 0 ? t('ankiConnect.toolbar.createWeaveFirst') : ankiDecks.length === 0 ? t('ankiConnect.toolbar.fetchAnkiFirst') : ''}
  >
    {showAddModal ? t('ankiConnect.toolbar.cancelAdd') : t('ankiConnect.toolbar.addMapping')}
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 16px 0;
  }

  .deck-count {
    font-size: 13px;
    color: var(--text-muted);
    padding: 0 8px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: var(--weave-radius-sm);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-success {
    background: var(--weave-success);
    color: white;
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .deck-count {
      text-align: center;
    }
  }
</style>


