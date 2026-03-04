<script lang="ts">
  import EnhancedIcon from "../../ui/EnhancedIcon.svelte";
  import { ICON_NAMES } from "../../../icons/index.js";
  import type { TableEmptyStateProps } from "../types/table-types";
  import { tr } from "../../../utils/i18n";

  let { loading = false, isEmpty = false }: TableEmptyStateProps = $props();
  let t = $derived($tr);
</script>

{#if loading}
  <div class="weave-table-loading">
    <EnhancedIcon name={ICON_NAMES.REFRESH} size={24} />
    <span>{t('tables.card.loading')}</span>
  </div>
{:else if isEmpty}
  <div class="weave-table-empty">
    <EnhancedIcon name="layer-group" size={48} />
    <h3>{t('tables.card.empty')}</h3>
    <p>{t('cardManagement.empty.hint')}</p>
  </div>
{/if}

<style>
  .weave-table-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    text-align: center;
    color: var(--text-muted);
    gap: 1rem;
  }

  .weave-table-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    text-align: center;
    color: var(--text-muted);
    gap: 1rem;
  }

  .weave-table-empty h3 {
    margin: 0;
    color: var(--text-normal);
    font-size: 1.125rem;
  }

  .weave-table-empty p {
    margin: 0;
    font-size: 0.875rem;
  }
</style>


