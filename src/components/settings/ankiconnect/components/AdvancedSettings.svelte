<!--
  AnkiConnect高级设置组件
  职责：媒体同步等高级功能配置
-->
<script lang="ts">
  import PremiumBadge from '../../../premium/PremiumBadge.svelte';
  import { PREMIUM_FEATURES } from '../../../../services/premium/PremiumFeatureGuard';
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  interface MediaSyncSettings {
    enabled: boolean;
  }

  interface Props {
    mediaSync: MediaSyncSettings;
    isPremium: boolean;
    onMediaSyncChange: () => void;
    onShowActivationPrompt: (featureId: string) => void;
  }

  let { 
    mediaSync, 
    isPremium,
    onMediaSyncChange,
    onShowActivationPrompt
  }: Props = $props();
</script>

<div class="advanced-settings">
  <!-- 启用媒体同步 -->
  <div class="setting-item">
    <div class="setting-info">
      <div class="setting-label">{t('ankiConnect.advanced.mediaSyncLabel')}</div>
      <div class="setting-description">
        {t('ankiConnect.advanced.mediaSyncDesc')}
      </div>
    </div>
    <div class="setting-control">
      <label class="toggle-switch">
        <input
          type="checkbox"
          bind:checked={mediaSync.enabled}
          onchange={onMediaSyncChange}
        />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
</div>

<style>
  .advanced-settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>

