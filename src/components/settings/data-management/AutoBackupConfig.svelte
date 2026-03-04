<!--
  自动备份配置组件
  提供自动备份的配置界面
-->
<script lang="ts">
  import type { AutoBackupConfig } from '../../../types/data-management-types';
  import type { WeavePlugin } from '../../../main';
  import { tr } from '../../../utils/i18n';

  interface Props {
    plugin: WeavePlugin;
  }

  // 响应式翻译函数
  let t = $derived($tr);

  let { plugin }: Props = $props();

  // 响应式配置状态
  let config = $state<AutoBackupConfig>({
    enabled: plugin.settings.autoBackupConfig?.enabled ?? true,
    intervalHours: plugin.settings.autoBackupConfig?.intervalHours ?? 24,
    triggers: {
      onStartup: plugin.settings.autoBackupConfig?.triggers.onStartup ?? true,
      onCardThreshold: plugin.settings.autoBackupConfig?.triggers.onCardThreshold ?? true,
      cardThresholdCount: plugin.settings.autoBackupConfig?.triggers.cardThresholdCount ?? 100
    },
    notifications: plugin.settings.autoBackupConfig?.notifications ?? {
      onSuccess: true,
      onFailure: true
    },
    lastAutoBackupTime: plugin.settings.autoBackupConfig?.lastAutoBackupTime,
    autoBackupCount: plugin.settings.autoBackupConfig?.autoBackupCount ?? 0
  });



  // 保存配置
  async function saveConfig() {
    plugin.settings.autoBackupConfig = { ...config };
    await plugin.saveSettings();
    
    // 重启调度器以应用新配置
    const scheduler = (plugin as any).autoBackupScheduler;
    if (scheduler) {
      scheduler.restart();
    }
  }

  // 切换启用状态
  async function toggleEnabled() {
    config.enabled = !config.enabled;
    await saveConfig();
  }

  // 更新间隔小时
  async function updateInterval(value: number) {
    const hours = Math.max(1, Math.min(168, value)); // 限制 1-168 小时
    config.intervalHours = hours;
    await saveConfig();
  }

  // 更新阈值
  async function updateThreshold(value: number) {
    const count = Math.max(1, Math.min(10000, value)); // 限制 1-10000
    config.triggers.cardThresholdCount = count;
    await saveConfig();
  }

</script>

<div class="weave-settings auto-backup-config">
  <!-- 自动备份配置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-red">{t('dataManagement.backup.auto.title')}</h4>
    <p class="group-description">
      {t('dataManagement.backup.auto.description')}
    </p>

    <!-- 主开关 -->
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">{t('dataManagement.backup.auto.enable')}</div>
        <div class="setting-description">
          {t('dataManagement.backup.auto.enableDesc')}
        </div>
      </div>
      <div class="setting-control">
        <label class="toggle-switch">
          <input
            type="checkbox"
            checked={config.enabled}
            onchange={toggleEnabled}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 备份间隔 -->
    <div class="setting-item" class:disabled={!config.enabled}>
      <div class="setting-info">
        <div class="setting-label">{t('dataManagement.backup.auto.interval')}</div>
        <div class="setting-description">
          {t('dataManagement.backup.auto.intervalDesc')}
        </div>
      </div>
      <div class="setting-control">
        <input
          type="number"
          min="1"
          max="168"
          bind:value={config.intervalHours}
          onchange={() => updateInterval(config.intervalHours)}
          disabled={!config.enabled}
          class="modern-input number-input"
        />
        <span class="unit-label">{t('dataManagement.backup.auto.intervalUnit')}</span>
      </div>
    </div>
  </div>

  <!-- 触发条件 -->
  <div class="settings-group" class:disabled={!config.enabled}>
    <h4 class="group-title with-accent-bar accent-blue">{t('dataManagement.backup.auto.triggers.title')}</h4>
    
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">{t('dataManagement.backup.auto.triggers.onStartup')}</div>
        <div class="setting-description">
          {t('dataManagement.backup.auto.triggers.onStartupDesc')}
        </div>
      </div>
      <div class="setting-control">
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={config.triggers.onStartup}
            onchange={saveConfig}
            disabled={!config.enabled}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">{t('dataManagement.backup.auto.triggers.onCardThreshold')}</div>
        <div class="setting-description">
          {t('dataManagement.backup.auto.triggers.onCardThresholdDesc')}
        </div>
      </div>
      <div class="setting-control">
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={config.triggers.onCardThreshold}
            onchange={saveConfig}
            disabled={!config.enabled}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    {#if config.triggers.onCardThreshold}
      <div class="setting-item nested">
        <div class="setting-info">
          <div class="setting-label">{t('dataManagement.backup.auto.triggers.thresholdCount')}</div>
          <div class="setting-description">
            {t('dataManagement.backup.auto.triggers.thresholdCountDesc')}
          </div>
        </div>
        <div class="setting-control">
          <input
            type="number"
            min="1"
            max="10000"
            bind:value={config.triggers.cardThresholdCount}
            onchange={() => updateThreshold(config.triggers.cardThresholdCount)}
            disabled={!config.enabled}
            class="modern-input number-input"
          />
          <span class="unit-label">{t('dataManagement.backup.auto.triggers.thresholdUnit')}</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .auto-backup-config {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .setting-item.disabled {
    opacity: 0.5;
  }

  .setting-item.nested {
    margin-left: 2rem;
  }

  .settings-group.disabled {
    opacity: 0.5;
  }
</style>

