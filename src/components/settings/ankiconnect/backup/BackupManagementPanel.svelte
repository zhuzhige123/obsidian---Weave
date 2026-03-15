<script lang="ts">
  import { logger } from '../../../../utils/logger';
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  import { Notice } from 'obsidian';
  import type { UnifiedBackupService } from '../../../../services/ankiconnect/backup/UnifiedBackupService';
  import type { BackupMetadata, CleanupRecommendation, DeviceBackupInfo } from '../../../../types/backup-types';
  import { BackupLevel, BackupTrigger } from '../../../../types/backup-types';
  
  import BackupListTable from './BackupListTable.svelte';
  import CleanupRecommendationCard from './CleanupRecommendationCard.svelte';
  import DeviceInfoCard from './DeviceInfoCard.svelte';
  
  let {
    backupService,
    onRefresh
  }: {
    backupService: UnifiedBackupService;
    onRefresh?: () => void;
  } = $props();

  // 状态
  let backups = $state<BackupMetadata[]>([]);
  let cleanupRecommendation = $state<CleanupRecommendation | null>(null);
  let deviceInfo = $state<DeviceBackupInfo[]>([]);
  let isLoading = $state(false);
  let isCreatingBackup = $state(false);
  
  // 统计
  let stats = $derived({
    totalBackups: backups.length,
    totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    compressedBackups: backups.filter(b => b.compressed).length,
    autoBackups: backups.filter(b => b.trigger !== BackupTrigger.MANUAL).length,
    deviceCount: new Set(backups.map(b => b.deviceId)).size
  });

  // 初始化
  $effect(() => {
    loadBackupData();
  });

  async function loadBackupData() {
    isLoading = true;
    try {
      // 加载所有备份
      const backupList = await backupService.listBackups();
      backups = backupList;
      
      // 加载清理建议
      const recommendation = await backupService.getCleanupRecommendation();
      cleanupRecommendation = recommendation;
      
      // 加载设备信息
      deviceInfo = extractDeviceInfo(backupList);
    } catch (error) {
      logger.error('加载备份数据失败:', error);
      new Notice(t('dataManagement.backup.mgmt.loadFailed'));
    } finally {
      isLoading = false;
    }
  }

  function extractDeviceInfo(allBackups: BackupMetadata[]): DeviceBackupInfo[] {
    const deviceMap = new Map<string, DeviceBackupInfo>();
    
    for (const backup of allBackups) {
      const existing = deviceMap.get(backup.deviceId);
      if (existing) {
        existing.backupCount++;
        existing.totalSize += backup.size;
        if (backup.timestamp > existing.latestBackup) {
          existing.latestBackup = backup.timestamp;
        }
      } else {
        deviceMap.set(backup.deviceId, {
          deviceId: backup.deviceId,
          deviceName: backup.deviceName,
          backupCount: 1,
          latestBackup: backup.timestamp,
          totalSize: backup.size,
          isCurrent: false // 将在下面设置
        });
      }
    }
    
    // TODO: 检测当前设备
    // 暂时简单地将最近活跃的设备标记为当前设备
    const devices = Array.from(deviceMap.values());
    if (devices.length > 0) {
      const mostRecent = devices.reduce((a, b) => 
        a.latestBackup > b.latestBackup ? a : b
      );
      mostRecent.isCurrent = true;
    }
    
    return devices;
  }

  async function handleCreateBackup() {
    isCreatingBackup = true;
    try {
      const result = await backupService.createBackup({
        level: BackupLevel.GLOBAL,
        trigger: BackupTrigger.MANUAL,
        data: null, // 全局备份会自动获取所有数据
        reason: t('dataManagement.backup.mgmt.manualReason')
      });
      
      if (result.success) {
        new Notice(t('dataManagement.backup.mgmt.createSuccess'));
        await loadBackupData();
        onRefresh?.();
      } else {
        new Notice(t('dataManagement.backup.mgmt.createFailed') + result.error);
      }
    } catch (error) {
      logger.error('创建备份失败:', error);
      new Notice(t('dataManagement.backup.mgmt.createFailed'));
    } finally {
      isCreatingBackup = false;
    }
  }

  async function handleRestoreBackup(backupId: string) {
    try {
      const result = await backupService.restoreBackup(backupId);
      if (result.success) {
        new Notice(t('dataManagement.backup.mgmt.restoreSuccess', { count: result.restoredItems ?? 0 }));
        onRefresh?.();
      } else {
        new Notice(t('dataManagement.backup.mgmt.restoreFailed') + result.error);
      }
    } catch (error) {
      logger.error('恢复备份失败:', error);
      new Notice(t('dataManagement.backup.mgmt.restoreFailed'));
    }
  }

  async function handleDeleteBackup(backupId: string) {
    try {
      const success = await backupService.deleteBackup(backupId);
      if (success) {
        new Notice(t('dataManagement.backup.mgmt.deleted'));
        await loadBackupData();
      } else {
        new Notice(t('dataManagement.backup.mgmt.deleteFailed'));
      }
    } catch (error) {
      logger.error('删除备份失败:', error);
      new Notice(t('dataManagement.backup.mgmt.deleteFailedDetail') + (error as Error).message);
    }
  }

  async function handleCleanupSelected(items: string[]) {
    try {
      let successCount = 0;
      let failedCount = 0;
      
      for (const backupId of items) {
        const success = await backupService.deleteBackup(backupId);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      }
      
      new Notice(t('dataManagement.backup.mgmt.cleanupDone', { success: successCount, failed: failedCount }));
      await loadBackupData();
    } catch (error) {
      logger.error('批量清理失败:', error);
      new Notice(t('dataManagement.backup.mgmt.cleanupFailed') + (error as Error).message);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div class="backup-management-panel">
  <!-- 统计汇总 -->
  <div class="settings-group">
    <div class="group-header">
      <h4 class="section-title with-accent-bar accent-cyan">{t('dataManagement.backup.mgmt.statsTitle')}</h4>
      <p class="group-description">{t('dataManagement.backup.mgmt.statsDesc')}</p>
    </div>

    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-value">{stats.totalBackups}</div>
        <div class="stat-label">{t('dataManagement.backup.mgmt.totalBackups')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{formatSize(stats.totalSize)}</div>
        <div class="stat-label">{t('dataManagement.backup.mgmt.totalSize')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.compressedBackups}</div>
        <div class="stat-label">{t('dataManagement.backup.mgmt.compressedBackups')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.deviceCount}</div>
        <div class="stat-label">{t('dataManagement.backup.mgmt.deviceCount')}</div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <button
        class="btn btn-primary"
        onclick={handleCreateBackup}
        disabled={isCreatingBackup}
      >
        {isCreatingBackup ? t('dataManagement.backup.mgmt.creating') : t('dataManagement.backup.mgmt.createBackup')}
      </button>
      <button
        class="btn btn-secondary"
        onclick={loadBackupData}
        disabled={isLoading}
      >
        {isLoading ? t('dataManagement.backup.mgmt.refreshing') : t('dataManagement.backup.mgmt.refresh')}
      </button>
    </div>
  </div>

  <!-- 设备信息 -->
  {#if deviceInfo.length > 0}
    <DeviceInfoCard devices={deviceInfo} />
  {/if}

  <!-- 清理建议 -->
  {#if cleanupRecommendation && cleanupRecommendation.recommendedDeletions.length > 0}
    <CleanupRecommendationCard
      recommendation={cleanupRecommendation}
      onCleanup={handleCleanupSelected}
    />
  {/if}

  <!-- 备份列表 -->
  <BackupListTable
    {backups}
    {isLoading}
    onRestore={handleRestoreBackup}
    onDelete={handleDeleteBackup}
  />
</div>

<style>
  /* BackupManagementPanel 组件样式 - 使用全局样式框架 */

  .backup-management-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /*  确保备份管理面板可交互 */
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .stats-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .stat-card {
    padding: 16px;
    background: var(--background-primary);
    border-radius: var(--weave-radius-md);
    border: 1px solid var(--background-modifier-border);
    text-align: center;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .action-buttons .btn {
    flex: 1;
    min-width: 120px;
  }

  /* 侧边颜色条样式 */
  .section-title.with-accent-bar {
    position: relative;
    padding-left: 0.75rem;
  }

  .section-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 1.2em;
    border-radius: 2px;
  }

  .section-title.accent-cyan::before {
    background: var(--color-cyan);
  }

  @media (max-width: 768px) {
    .stats-summary {
      grid-template-columns: repeat(2, 1fr);
    }

    .action-buttons {
      flex-direction: column;
    }

    .action-buttons .btn {
      flex: none;
      min-width: auto;
    }
  }
</style>

