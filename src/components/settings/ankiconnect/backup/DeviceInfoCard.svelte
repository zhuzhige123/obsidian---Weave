<script lang="ts">
  import type { DeviceBackupInfo } from '../../../../types/backup-types';
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    devices: DeviceBackupInfo[];
  }

  let { devices }: Props = $props();

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatTime(timestamp: number): string {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
  }
</script>

<div class="device-info-card settings-group">
  <h4 class="group-title">{t('dataManagement.backup.mgmt.deviceInfo') ?? 'Device Information'}</h4>
  <div class="device-list">
    {#each devices as device}
      <div class="device-item" class:current={device.isCurrent}>
        <div class="device-name">
          {device.deviceName}
          {#if device.isCurrent}
            <span class="current-badge">{t('dataManagement.backup.mgmt.currentDevice') ?? 'Current'}</span>
          {/if}
        </div>
        <div class="device-stats">
          <span>{device.backupCount} backups</span>
          <span>{formatSize(device.totalSize)}</span>
          <span>{formatTime(device.latestBackup)}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .device-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .device-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .device-item.current {
    border-color: var(--interactive-accent);
  }

  .device-name {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .current-badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
    color: var(--interactive-accent);
    font-weight: 500;
  }

  .device-stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
