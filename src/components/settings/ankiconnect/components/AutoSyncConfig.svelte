<!--
  AnkiConnect自动同步配置组件
  职责：自动同步相关的所有配置选项
-->
<script lang="ts">
  import type { AnkiConnectService } from '../../../../services/ankiconnect/AnkiConnectService';

  interface AutoSyncSettings {
    enabled: boolean;
    intervalMinutes: number;
    syncOnStartup: boolean;
    onlyWhenAnkiRunning: boolean;
    maxCardsPerSync?: number;
    prioritizeRecent: boolean;
    enableFileWatcher?: boolean;
  }

  interface Props {
    autoSyncSettings: AutoSyncSettings;
    ankiService: AnkiConnectService | null;
    onSettingsChange: (settings: AutoSyncSettings) => void;
  }

  let { autoSyncSettings, ankiService, onSettingsChange }: Props = $props();

  function handleAutoSyncToggle() {
    onSettingsChange(autoSyncSettings);
    
    if (autoSyncSettings.enabled && ankiService) {
      ankiService.startAutoSync();
    } else if (ankiService) {
      ankiService.stopAutoSync();
    }
  }

  function handleSettingChange() {
    onSettingsChange(autoSyncSettings);
  }
</script>

<div class="autosync-config">
  <!-- 启用自动同步 -->
  <div class="setting-item">
    <div class="setting-info">
      <div class="setting-label">启用自动同步</div>
      <div class="setting-description">
        按设定间隔自动同步卡片到 Anki
      </div>
    </div>
    <div class="setting-control">
      <label class="toggle-switch">
        <input
          type="checkbox"
          bind:checked={autoSyncSettings.enabled}
          onchange={handleAutoSyncToggle}
        />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>

  {#if autoSyncSettings.enabled}
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">同步间隔（分钟）</div>
        <div class="setting-description">
          定时同步的时间间隔
        </div>
      </div>
      <div class="setting-control">
        <input
          type="number"
          class="number-input"
          bind:value={autoSyncSettings.intervalMinutes}
          onblur={handleSettingChange}
          min="5"
          max="1440"
        />
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">启动时同步</div>
        <div class="setting-description">
          Obsidian 启动时自动执行同步
        </div>
      </div>
      <div class="setting-control">
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={autoSyncSettings.syncOnStartup}
            onchange={handleSettingChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">文件变更检测</div>
        <div class="setting-description">
          检测到卡片文件修改时自动同步
        </div>
      </div>
      <div class="setting-control">
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={autoSyncSettings.enableFileWatcher}
            onchange={handleSettingChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .autosync-config {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>

