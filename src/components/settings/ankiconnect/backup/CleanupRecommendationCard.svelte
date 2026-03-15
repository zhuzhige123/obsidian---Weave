<script lang="ts">
  import type { CleanupRecommendation } from '../../../../types/backup-types';
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    recommendation: CleanupRecommendation;
    onCleanup: (items: string[]) => void;
  }

  let { recommendation, onCleanup }: Props = $props();

  let selectedIds = $state<Set<string>>(
    new Set(recommendation.recommendedDeletions.map(item => item.backupId))
  );

  function toggleItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function handleCleanup() {
    onCleanup([...selectedIds]);
  }
</script>

<div class="cleanup-card settings-group">
  <div class="group-header">
    <h4 class="group-title">{t('dataManagement.backup.mgmt.cleanupTitle') ?? 'Cleanup Recommendations'}</h4>
    <p class="group-description">
      {t('dataManagement.backup.mgmt.cleanupDesc') ?? 'Remove old backups to free up space'}
      - {t('dataManagement.backup.mgmt.potentialSavings') ?? 'Potential savings'}: {formatSize(recommendation.potentialSavings)} ({recommendation.savingsPercentage}%)
    </p>
  </div>

  <div class="cleanup-items">
    {#each recommendation.recommendedDeletions as item}
      <label class="cleanup-item">
        <input
          type="checkbox"
          checked={selectedIds.has(item.backupId)}
          onchange={() => toggleItem(item.backupId)}
        />
        <div class="cleanup-item-info">
          <span class="cleanup-item-name">{item.metadata.summary?.deckName || item.backupId}</span>
          <span class="cleanup-item-detail">
            {formatSize(item.potentialSavings)} - {item.assessment.reason}
          </span>
        </div>
      </label>
    {/each}
  </div>

  {#if selectedIds.size > 0}
    <button class="btn btn-warning" onclick={handleCleanup}>
      {t('dataManagement.backup.mgmt.cleanupSelected') ?? 'Clean up'} ({selectedIds.size})
    </button>
  {/if}
</div>

<style>
  .cleanup-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .cleanup-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid var(--background-modifier-border);
  }

  .cleanup-item:hover {
    background: var(--background-modifier-hover);
  }

  .cleanup-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cleanup-item-name {
    font-size: 13px;
    font-weight: 500;
  }

  .cleanup-item-detail {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
