<!--
  添加牌组映射表单组件
  职责：提供添加新映射的表单界面
-->
<script lang="ts">
  import type { AnkiDeckInfo } from '../../../../../types/ankiconnect-types';
  import type { Deck } from '../../../../../data/types';
  import type { DeckSyncMapping } from '../../../types/settings-types';
  import ObsidianDropdown from '../../../../ui/ObsidianDropdown.svelte';

  interface Props {
    isVisible: boolean;
    ankiDecks: AnkiDeckInfo[];
    weaveDecks: Deck[];
    isPremium: boolean;
    onAdd: (mapping: DeckSyncMapping) => void;
  }

  let { 
    isVisible, 
    ankiDecks, 
    weaveDecks, 
    isPremium,
    onAdd
  }: Props = $props();

  let selectedWeaveDeckId = $state('');
  let selectedAnkiDeckName = $state('');
  let selectedSyncDirection = $state<'to_anki' | 'from_anki'>('to_anki');
  let selectedContentConversion = $state<'standard' | 'preserve_style' | 'minimal'>('standard');

  function handleAdd() {
    if (!selectedWeaveDeckId || !selectedAnkiDeckName) return;

    const weaveDeck = weaveDecks.find(d => d.id === selectedWeaveDeckId);
    if (!weaveDeck) return;

    onAdd({
      weaveDeckId: selectedWeaveDeckId,
      weaveDeckName: weaveDeck.name,
      ankiDeckName: selectedAnkiDeckName,
      syncDirection: selectedSyncDirection,
      contentConversion: selectedContentConversion,
      enabled: false,
      lastSyncTime: undefined
    });

    // 重置表单
    selectedWeaveDeckId = '';
    selectedAnkiDeckName = '';
    selectedSyncDirection = 'to_anki';
    selectedContentConversion = 'standard';
  }

</script>

{#if isVisible}
  <div class="add-mapping-form">
    <h5>添加新的牌组映射</h5>
    <div class="form-row">
      <div class="form-field">
        <label for="weave-deck-select">Weave 牌组</label>
        <ObsidianDropdown
          options={[
            { id: '', label: '请选择 Weave 牌组...' },
            ...weaveDecks.map(deck => ({ id: deck.id, label: deck.name }))
          ]}
          value={selectedWeaveDeckId}
          onchange={(value) => { selectedWeaveDeckId = value; }}
        />
      </div>
      <div class="form-field">
        <label for="anki-deck-select">Anki 牌组</label>
        <ObsidianDropdown
          options={[
            { id: '', label: '请选择 Anki 牌组...' },
            ...ankiDecks.map(deck => ({ id: deck.name, label: deck.name }))
          ]}
          value={selectedAnkiDeckName}
          onchange={(value) => { selectedAnkiDeckName = value; }}
        />
      </div>
      <div class="form-field">
        <label for="sync-direction-select">同步方向</label>
        <ObsidianDropdown
          options={[
            { id: 'to_anki', label: '→ 到 Anki' },
            { id: 'from_anki', label: '← 从 Anki' }
          ]}
          value={selectedSyncDirection}
          onchange={(value) => { selectedSyncDirection = value as 'to_anki' | 'from_anki'; }}
        />
      </div>
      <div class="form-field">
        <label for="content-conversion-select">内容转换</label>
        <ObsidianDropdown
          options={[
            { id: 'standard', label: '标准' },
            { id: 'preserve_style', label: '尽量保留样式' },
            { id: 'minimal', label: '最少转换' }
          ]}
          value={selectedContentConversion}
          onchange={(value) => { selectedContentConversion = value as any; }}
        />
      </div>
      <div class="form-actions">
        <button
          class="btn btn-primary"
          onclick={handleAdd}
          disabled={!selectedWeaveDeckId || !selectedAnkiDeckName}
        >
          ✓ 添加
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .add-mapping-form {
    background: var(--background-secondary);
    border-radius: var(--weave-radius-md);
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid var(--background-modifier-border);
  }

  .add-mapping-form h5 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr auto;
    gap: 12px;
    align-items: end;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-field label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .form-actions {
    display: flex;
    align-items: flex-end;
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

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 响应式设计 */
  @media (max-width: 1024px) {
    .form-row {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .form-actions {
      justify-content: flex-start;
    }
  }
</style>

