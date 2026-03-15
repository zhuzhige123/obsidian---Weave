<script lang="ts">
  import type { BackupMetadata } from '../../../../types/backup-types';
  import { BackupLevel, BackupTrigger } from '../../../../types/backup-types';
  import { showObsidianConfirm } from '../../../../utils/obsidian-confirm';
  import { tr as trStore } from '../../../../utils/i18n';

  let t = $derived($trStore);
  
  let {
    backups = [],
    isLoading = false,
    onRestore,
    onDelete
  }: {
    backups: BackupMetadata[];
    isLoading?: boolean;
    onRestore: (backupId: string) => Promise<void>;
    onDelete: (backupId: string) => Promise<void>;
  } = $props();

  let currentPage = $state(1);
  let pageSize = 10;
  let expandedBackupId = $state<string | null>(null);
  let sortField = $state<'timestamp' | 'size'>('timestamp');
  let sortDirection = $state<'asc' | 'desc'>('desc');

  // 排序和分页
  let sortedBackups = $derived.by(() => {
    const sorted = [...backups].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const direction = sortDirection === 'asc' ? 1 : -1;
      return aValue > bValue ? direction : -direction;
    });
    return sorted;
  });

  let totalPages = $derived(Math.ceil(sortedBackups.length / pageSize));
  let paginatedBackups = $derived(
    sortedBackups.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('dataManagement.backup.list.yesterday') + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getLevelIcon(level: BackupLevel): string {
    switch (level) {
      case BackupLevel.CARD: return '🎴';
      case BackupLevel.DECK: return '📚';
      case BackupLevel.GLOBAL: return '🌍';
      default: return '📦';
    }
  }

  function getTriggerText(trigger: BackupTrigger): string {
    switch (trigger) {
      case BackupTrigger.AUTO_IMPORT: return t('dataManagement.backup.list.triggerAutoImport');
      case BackupTrigger.AUTO_SYNC: return t('dataManagement.backup.list.triggerAutoSync');
      case BackupTrigger.MANUAL: return t('dataManagement.backup.list.triggerManual');
      case BackupTrigger.SCHEDULED: return t('dataManagement.backup.list.triggerScheduled');
      case BackupTrigger.PRE_UPDATE: return t('dataManagement.backup.list.triggerPreUpdate');
      default: return t('dataManagement.backup.list.triggerUnknown');
    }
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function toggleSort(field: 'timestamp' | 'size') {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'desc';
    }
  }

  function toggleExpand(backupId: string) {
    expandedBackupId = expandedBackupId === backupId ? null : backupId;
  }

  async function handleRestore(backupId: string) {
    const confirmed = await showObsidianConfirm((window as any).app, t('dataManagement.backup.list.confirmRestore'), { title: t('dataManagement.backup.list.confirmRestoreTitle') });
    if (!confirmed) return;
    await onRestore(backupId);
  }

  async function handleDelete(backupId: string) {
    const confirmed = await showObsidianConfirm((window as any).app, t('dataManagement.backup.list.confirmDelete'), { title: t('dataManagement.backup.list.confirmDeleteTitle') });
    if (!confirmed) return;
    await onDelete(backupId);
  }
</script>

<div class="backup-list-table settings-group">
  <div class="group-header">
    <h4>{t('dataManagement.backup.list.title')}</h4>
    <p class="group-description">{t('dataManagement.backup.list.description')}</p>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{t('dataManagement.backup.list.loading')}</p>
    </div>
  {:else if backups.length === 0}
    <!-- 空状态：不显示任何提示 -->
  {:else}
    <!-- 表格 -->
    <div class="table-container">
      <table class="anki-table">
        <thead>
          <tr>
            <th>{t('dataManagement.backup.list.colType')}</th>
            <th class="sortable" onclick={() => toggleSort('timestamp')}>
              {t('dataManagement.backup.list.colTime')} {sortField === 'timestamp' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th>{t('dataManagement.backup.list.colDevice')}</th>
            <th>{t('dataManagement.backup.list.colContent')}</th>
            <th class="sortable" onclick={() => toggleSort('size')}>
              {t('dataManagement.backup.list.colSize')} {sortField === 'size' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th>{t('dataManagement.backup.list.colTrigger')}</th>
            <th>{t('dataManagement.backup.list.colStatus')}</th>
            <th>{t('dataManagement.backup.list.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedBackups as backup}
            <tr class:expanded={expandedBackupId === backup.id}>
              <td>
                <span class="level-badge">
                  {getLevelIcon(backup.level)}
                </span>
              </td>
              <td>{formatTime(backup.timestamp)}</td>
              <td>
                <span class="device-name" title={backup.deviceId}>
                  {backup.deviceName}
                </span>
              </td>
              <td>
                <div class="backup-content">
                  {#if backup.summary.deckName}
                    <div class="content-main">{backup.summary.deckName}</div>
                  {:else}
                    <div class="content-main">{t('dataManagement.backup.list.globalBackup')}</div>
                  {/if}
                  <div class="content-detail">{t('dataManagement.backup.list.cardCount', { count: backup.summary.cardCount })}</div>
                </div>
              </td>
              <td>
                <div class="size-info">
                  <div class="size-main">{formatSize(backup.size)}</div>
                  {#if backup.compressed}
                    <div class="size-detail">
                      {t('dataManagement.backup.list.compressed', { ratio: Math.round((backup.compressionRatio || 0) * 100) })}
                    </div>
                  {/if}
                </div>
              </td>
              <td>
                <span class="trigger-badge {backup.trigger === BackupTrigger.MANUAL ? 'manual' : 'auto'}">
                  {getTriggerText(backup.trigger)}
                </span>
              </td>
              <td>
                <div class="status-badges">
                  {#if backup.isHealthy}
                    <span class="status-badge healthy" title={t('dataManagement.backup.list.healthy')}>✓</span>
                  {:else}
                    <span class="status-badge unhealthy" title={t('dataManagement.backup.list.unhealthy')}>[!]</span>
                  {/if}
                  {#if backup.encrypted}
                    <span class="status-badge encrypted" title={t('dataManagement.backup.list.encrypted')}>[E]</span>
                  {/if}
                </div>
              </td>
              <td>
                <div class="action-buttons-cell">
                  <button
                    class="btn btn-small btn-secondary"
                    onclick={() => toggleExpand(backup.id)}
                    title={t('dataManagement.backup.list.details')}
                  >
                    {expandedBackupId === backup.id ? t('dataManagement.backup.list.collapse') : t('dataManagement.backup.list.details')}
                  </button>
                  <button
                    class="btn btn-small btn-primary"
                    onclick={() => handleRestore(backup.id)}
                    title={t('dataManagement.backup.list.restore')}
                  >
                    {t('dataManagement.backup.list.restore')}
                  </button>
                  {#if backup.canDelete}
                    <button
                      class="btn btn-small btn-danger"
                      onclick={() => handleDelete(backup.id)}
                      title={t('dataManagement.backup.list.delete')}
                    >
                      {t('dataManagement.backup.list.delete')}
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
            
            <!-- 展开的详情行 -->
            {#if expandedBackupId === backup.id}
              <tr class="detail-row">
                <td colspan="8">
                  <div class="backup-details">
                    <div class="detail-section">
                      <h5>{t('dataManagement.backup.list.basicInfo')}</h5>
                      <div class="detail-grid">
                        <div class="detail-item">
                          <span class="detail-label">{t('dataManagement.backup.list.backupId')}</span>
                          <span class="detail-value">{backup.id}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">{t('dataManagement.backup.list.pluginVersion')}</span>
                          <span class="detail-value">{backup.pluginVersion}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">{t('dataManagement.backup.list.obsidianVersion')}</span>
                          <span class="detail-value">{backup.obsidianVersion}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">{t('dataManagement.backup.list.vaultName')}</span>
                          <span class="detail-value">{backup.vaultName}</span>
                        </div>
                      </div>
                    </div>
                    
                    {#if backup.description || backup.userNotes}
                      <div class="detail-section">
                        <h5>{t('dataManagement.backup.list.notes')}</h5>
                        <p class="detail-notes">{backup.description || backup.userNotes}</p>
                      </div>
                    {/if}
                    
                    {#if backup.tags.length > 0}
                      <div class="detail-section">
                        <h5>{t('dataManagement.backup.list.tags')}</h5>
                        <div class="tag-list">
                          {#each backup.tags as tag}
                            <span class="tag">{tag}</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    
                    <div class="detail-section">
                      <h5>{t('dataManagement.backup.list.fileInfo')}</h5>
                      <div class="detail-grid">
                        <div class="detail-item">
                          <span class="detail-label">{t('dataManagement.backup.list.storagePath')}</span>
                          <span class="detail-value code">{backup.storagePath}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">{t('dataManagement.backup.list.backupType')}</span>
                          <span class="detail-value">{backup.type === 'full' ? t('dataManagement.backup.list.fullBackup') : t('dataManagement.backup.list.incrementalBackup')}</span>
                        </div>
                        {#if backup.baseBackupId}
                          <div class="detail-item">
                            <span class="detail-label">{t('dataManagement.backup.list.baseBackup')}</span>
                            <span class="detail-value">{backup.baseBackupId}</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="btn btn-small"
          onclick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          {t('dataManagement.backup.list.prevPage')}
        </button>
        <span class="page-info">
          {t('dataManagement.backup.list.pageInfo', { current: currentPage, total: totalPages })}
        </span>
        <button
          class="btn btn-small"
          onclick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          {t('dataManagement.backup.list.nextPage')}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* BackupListTable 组件样式 - 使用全局样式框架 */

  .table-container {
    overflow-x: auto;
    margin-bottom: 16px;
  }

  .anki-table {
    width: 100%;
    border-collapse: collapse;
  }

  .anki-table th {
    padding: 12px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .anki-table th.sortable {
    cursor: pointer;
    user-select: none;
  }

  .anki-table th.sortable:hover {
    color: var(--text-normal);
  }

  .anki-table td {
    padding: 12px 8px;
    border-bottom: 1px solid var(--background-modifier-border);
    font-size: 14px;
  }

  .anki-table tr:hover {
    background: var(--background-modifier-hover);
  }

  .anki-table tr.expanded {
    background: var(--background-secondary);
  }

  .level-badge {
    font-size: 18px;
  }

  .device-name {
    font-size: 13px;
    color: var(--text-muted);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
  }

  .backup-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .content-main {
    font-weight: 500;
    color: var(--text-normal);
  }

  .content-detail {
    font-size: 12px;
    color: var(--text-muted);
  }

  .size-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .size-main {
    font-weight: 500;
  }

  .size-detail {
    font-size: 11px;
    color: var(--text-muted);
  }

  .trigger-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .trigger-badge.manual {
    background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
    color: var(--interactive-accent);
  }

  .trigger-badge.auto {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .status-badges {
    display: flex;
    gap: 4px;
  }

  .status-badge {
    display: inline-block;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    border-radius: 50%;
    font-size: 12px;
  }

  .status-badge.healthy {
    background: color-mix(in srgb, var(--color-green) 20%, transparent);
    color: var(--color-green);
  }

  .status-badge.unhealthy {
    background: color-mix(in srgb, var(--color-orange) 20%, transparent);
    color: var(--color-orange);
  }

  .status-badge.encrypted {
    background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);
  }

  .action-buttons-cell {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .action-buttons-cell .btn {
    min-width: auto;
  }

  /* 详情行 */
  .detail-row td {
    padding: 0;
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .backup-details {
    padding: 16px;
    background: var(--background-primary);
  }

  .detail-section {
    margin-bottom: 16px;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .detail-section h5 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-value {
    font-size: 13px;
    color: var(--text-normal);
  }

  .detail-value.code {
    font-family: var(--font-monospace);
    font-size: 12px;
    word-break: break-all;
  }

  .detail-notes {
    margin: 0;
    font-size: 13px;
    color: var(--text-normal);
    line-height: 1.5;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    padding: 4px 10px;
    background: var(--background-secondary);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-normal);
  }

  /* 加载状态 */
  .loading-state {
    padding: 48px 16px;
    text-align: center;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 分页 */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .page-info {
    font-size: 13px;
    color: var(--text-muted);
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .anki-table {
      font-size: 12px;
    }

    .anki-table th,
    .anki-table td {
      padding: 8px 4px;
    }

    .action-buttons-cell {
      flex-direction: column;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

