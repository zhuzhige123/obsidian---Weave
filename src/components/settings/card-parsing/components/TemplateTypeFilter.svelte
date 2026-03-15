<script lang="ts">
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    sourceFilter: 'all' | 'weave' | 'anki';
    onSourceFilterChange: (filter: 'all' | 'weave' | 'anki') => void;
  }

  let { sourceFilter, onSourceFilterChange }: Props = $props();
</script>

<div class="template-type-filter">
  <button
    class="filter-btn"
    class:active={sourceFilter === 'all'}
    onclick={() => onSourceFilterChange('all')}
  >
    {t('dataManagement.templateMgmt.filterAll') ?? 'All'}
  </button>
  <button
    class="filter-btn"
    class:active={sourceFilter === 'weave'}
    onclick={() => onSourceFilterChange('weave')}
  >
    Weave
  </button>
  <button
    class="filter-btn"
    class:active={sourceFilter === 'anki'}
    onclick={() => onSourceFilterChange('anki')}
  >
    Anki
  </button>
</div>

<style>
  .template-type-filter {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--background-secondary);
    border-radius: 8px;
    width: fit-content;
  }

  .filter-btn {
    padding: 6px 14px;
    border: none;
    background: transparent;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-btn:hover {
    color: var(--text-normal);
  }

  .filter-btn.active {
    background: var(--background-primary);
    color: var(--text-normal);
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
</style>
