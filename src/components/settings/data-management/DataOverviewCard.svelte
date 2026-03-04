<!--
  数据概览卡片组件
  显示数据统计信息和快速操作
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type { DataOverview } from '../../../types/data-management-types';
  import { formatFileSize, formatNumber } from '../../../utils/format-utils';
  import { createEventDispatcher } from 'svelte';
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import { tr } from '../../../utils/i18n';

  // 响应式翻译
  let t = $derived($tr);

  interface Props {
    overview: DataOverview | null;
    isLoading?: boolean;
    onRefresh?: () => Promise<void>;
    onOpenFolder?: () => Promise<void>;
    onCreateBackup?: () => Promise<void>;
  }

  let { 
    overview, 
    isLoading = false, 
    onRefresh, 
    onOpenFolder,
    onCreateBackup
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    refresh: void;
    openFolder: void;
    createBackup: void;
  }>();

  // 派生状态
  let formattedSize = $derived(
    overview ? formatFileSize(overview.totalSize) : t('common.loading')
  );

  let formattedCards = $derived(
    overview ? formatNumber(overview.totalCards) : '0'
  );

  let formattedDecks = $derived(
    overview ? formatNumber(overview.totalDecks) : '0'
  );

  let formattedSessions = $derived(
    overview ? formatNumber(overview.totalSessions) : '0'
  );

  let lastUpdatedText = $derived.by(() => {
    if (!overview?.lastUpdated) return t('common.unknown');

    const lastUpdated = new Date(overview.lastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return t('dataManagement.backup.latest.justNow');
    if (diffMinutes < 60) return `${diffMinutes} ${t('common.timeUnits.minutes').replace('{n}', '').trim()}`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ${t('common.timeUnits.hours').replace('{n}', '').trim()}`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${t('common.timeUnits.days').replace('{n}', '').trim()}`;
  });

  // 事件处理
  async function handleRefresh() {
    if (isLoading) return;
    
    try {
      if (onRefresh) {
        await onRefresh();
      }
      dispatch('refresh');
    } catch (error) {
      logger.error('刷新数据概览失败:', error);
    }
  }

  async function handleOpenFolder() {
    try {
      if (onOpenFolder) {
        await onOpenFolder();
      }
      dispatch('openFolder');
    } catch (error) {
      logger.error('打开文件夹失败:', error);
    }
  }

  async function handleCreateBackup() {
    try {
      if (onCreateBackup) {
        await onCreateBackup();
      }
      dispatch('createBackup');
    } catch (error) {
      logger.error('创建备份失败:', error);
    }
  }
</script>

<!-- 数据概览卡片 -->
<div class="weave-settings settings-group data-overview-card" class:loading={isLoading}>
  <!-- 卡片头部 -->
  <div class="group-title-row">
    <div class="title-container">
      <h4 class="group-title with-accent-bar accent-blue">{t('dataManagement.backup.latest.title')}</h4>
      <p class="last-updated">{t('dataManagement.backup.latest.lastGenerated')}: {lastUpdatedText}</p>
    </div>
    <div class="header-actions">
      <button
        class="icon-button"
        onclick={handleOpenFolder}
        title={t('dataManagement.openFolder')}
        aria-label={t('dataManagement.openFolder')}
      >
        <ObsidianIcon name="folder-open" size={16} />
      </button>
      <button
        class="icon-button refresh-button"
        onclick={handleRefresh}
        disabled={isLoading}
        title={t('common.refresh')}
        aria-label={t('common.refresh')}
      >
        <ObsidianIcon name="refresh-cw" size={16} class={isLoading ? 'spinning' : ''} />
      </button>
      <button
        class="backup-button"
        onclick={handleCreateBackup}
        disabled={isLoading}
        title={t('dataManagement.backup.operations.createBackup')}
        aria-label={t('dataManagement.backup.operations.createBackup')}
      >
        <ObsidianIcon name="archive" size={16} />
        <span>{t('dataManagement.backup.operations.createBackup')}</span>
      </button>
    </div>
  </div>

  <!-- 数据统计网格 -->
  <div class="stats-grid">
    <!-- 数据文件夹信息 -->
    <div class="stat-item folder-info">
      <div class="stat-content">
        <div class="stat-label">{t('dataManagement.backup.latest.dataFolder')}</div>
        <div class="stat-value folder-path" title={overview?.dataFolderPath}>
          {overview?.dataFolderPath || t('common.notSet')}
        </div>
      </div>
    </div>

    <!-- 总大小 -->
    <div class="stat-item">
      <div class="stat-content">
        <div class="stat-label">{t('dataManagement.backup.latest.stats.totalSize')}</div>
        <div class="stat-value">{formattedSize}</div>
      </div>
    </div>

    <!-- 牌组数量 -->
    <div class="stat-item">
      <div class="stat-content">
        <div class="stat-label">{t('dataManagement.backup.latest.stats.deckCount')}</div>
        <div class="stat-value">{formattedDecks}</div>
      </div>
    </div>

    <!-- 卡片总数 -->
    <div class="stat-item">
      <div class="stat-content">
        <div class="stat-label">{t('dataManagement.backup.latest.stats.cardTotal')}</div>
        <div class="stat-value">{formattedCards}</div>
      </div>
    </div>

    <!-- 学习会话 -->
    <div class="stat-item">
      <div class="stat-content">
        <div class="stat-label">{t('dataManagement.backup.latest.stats.backupCount')}</div>
        <div class="stat-value">{formattedSessions}</div>
      </div>
    </div>
  </div>

  <!-- 加载遮罩 -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">{t('common.loading')}</div>
    </div>
  {/if}
</div>

<style>
  .data-overview-card {
    position: relative;
  }

  .data-overview-card.loading {
    pointer-events: none;
  }

  /* 卡片头部 */
  .group-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .title-container {
    flex: 1;
  }

  .last-updated {
    margin: 0.25rem 0 0 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .icon-button {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-normal);
    color: var(--text-normal);
  }

  .icon-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 备份按钮 */
  .backup-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .backup-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .backup-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 统计网格 */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .stat-item {
    display: flex;
    align-items: flex-start;
    padding: 0.75rem;
    background: var(--weave-secondary-bg, var(--background-primary));
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .stat-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-normal);
  }

  .stat-item.folder-info {
    grid-column: 1 / -1;
  }

  .stat-content {
    flex: 1;
    min-width: 0;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
    word-break: break-all;
  }

  .folder-path {
    font-family: var(--font-monospace);
    font-size: 0.875rem;
  }

  /* 加载遮罩 */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in oklab, var(--background-primary), transparent 20%);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    backdrop-filter: blur(2px);
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .group-title-row {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .header-actions {
      justify-content: flex-end;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .stat-item.folder-info {
      grid-column: 1;
    }
  }
</style>
