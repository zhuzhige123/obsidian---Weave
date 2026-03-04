<script lang="ts">
  import type { DeviceBackupInfo } from '../../../../types/backup-types';
  
  let {
    devices = []
  }: {
    devices: DeviceBackupInfo[];
  } = $props();

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }

  // 排序：当前设备优先，然后按最近备份时间
  let sortedDevices = $derived(
    [...devices].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return b.latestBackup - a.latestBackup;
    })
  );
</script>

<div class="device-info-card settings-group">
  <div class="group-header">
    <h4>设备信息</h4>
    <p class="group-description">跨设备备份概览</p>
  </div>

  <div class="device-list">
    {#each sortedDevices as device}
      <div class="device-item" class:current={device.isCurrent}>
        <div class="device-icon">
          {device.isCurrent ? '[PC]' : '[PC]'}
        </div>
        
        <div class="device-info">
          <div class="device-header">
            <div class="device-name">
              {device.deviceName}
              {#if device.isCurrent}
                <span class="current-badge">当前设备</span>
              {/if}
            </div>
            <div class="device-id" title={device.deviceId}>
              {device.deviceId.slice(0, 8)}...
            </div>
          </div>
          
          <div class="device-stats">
            <div class="stat-item">
              <span class="stat-icon">[#]</span>
              <span class="stat-text">{device.backupCount} 个备份</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">[S]</span>
              <span class="stat-text">{formatSize(device.totalSize)}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">[T]</span>
              <span class="stat-text">最近: {formatTime(device.latestBackup)}</span>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  {#if devices.length > 1}
    <div class="device-notice">
      <div class="notice-icon">*</div>
      <div class="notice-text">
        <strong>跨设备备份说明：</strong> 
        Weave 会自动隔离不同设备的备份，并在跨设备恢复时自动转换路径。
        备份文件存储在仓库的 <code>weave/.backups/</code> 目录中，会被 Obsidian Sync 自动同步。
      </div>
    </div>
  {/if}
</div>

<style>
  /* DeviceInfoCard 组件样式 - 使用全局样式框架 */

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .device-item {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--weave-radius-md);
    transition: all 0.2s ease;
  }

  .device-item:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .device-item.current {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 5%, var(--background-primary));
  }

  .device-icon {
    font-size: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .device-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .device-name {
    font-weight: 600;
    font-size: 15px;
    color: var(--text-normal);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .current-badge {
    padding: 2px 8px;
    background: var(--interactive-accent);
    color: white;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .device-id {
    font-family: var(--font-monospace);
    font-size: 12px;
    color: var(--text-muted);
    background: var(--background-secondary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .device-stats {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .stat-icon {
    font-size: 14px;
  }

  .stat-text {
    white-space: nowrap;
  }

  .device-notice {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--color-blue) 10%, var(--background-primary));
    border-radius: var(--weave-radius-md);
    border-left: 3px solid var(--color-blue);
  }

  .notice-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .notice-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
    line-height: 1.5;
  }

  .notice-text strong {
    font-weight: 600;
    color: var(--text-normal);
  }

  .notice-text code {
    font-family: var(--font-monospace);
    font-size: 12px;
    background: var(--background-secondary);
    padding: 2px 6px;
    border-radius: 3px;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .device-item {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .device-header {
      flex-direction: column;
      align-items: center;
    }

    .device-stats {
      justify-content: center;
    }

    .device-notice {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }
</style>


