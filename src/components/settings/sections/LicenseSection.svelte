<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type { PluginExtended, LicenseInfo } from '../types/settings-types';
  import { licenseManager } from '../../../utils/licenseManager';
  import { PremiumFeatureGuard } from '../../../services/premium/PremiumFeatureGuard';
  import {
    showNotification,
    handleError
  } from '../utils/settings-utils';
  import {
    CSS_CLASSES
  } from '../constants/settings-constants';
  import EnhancedLicenseStatusCard from '../components/EnhancedLicenseStatusCard.svelte';
  import EnhancedActivationForm from '../components/EnhancedActivationForm.svelte';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';

  interface Props {
    plugin: PluginExtended;
    onSave: () => Promise<void>;
  }

  let { plugin, onSave }: Props = $props();

  // 检查许可证状态
  async function checkLicenseStatus() {
    if (!plugin.settings.license?.isActivated) {
      return;
    }

    try {
      const validation = await licenseManager.validateCurrentLicense(plugin.settings.license);

      await PremiumFeatureGuard.getInstance().updateLicense(plugin.settings.license);

      if (validation.isValid) {
        showNotification({
          message: '许可证验证成功',
          type: 'success'
        });
        return;
      }

      showNotification({
        message: validation.error ? `许可证验证失败: ${validation.error}` : '许可证验证失败',
        type: 'error'
      });
    } catch (error) {
      handleError(error, '许可证验证');
    }
  }

  // 重置许可证
  async function resetLicense() {
    const confirmed = await showObsidianConfirm(plugin.app, '确定要重置许可证吗？这将清除当前的激活状态。', { title: '确认重置' });
    if (confirmed) {
      plugin.settings.license = {
        activationCode: "",
        isActivated: false,
        activatedAt: "",
        deviceFingerprint: "",
        expiresAt: "",
        productVersion: "",
        licenseType: 'lifetime'
      };
      
      await onSave();
      
      showNotification({
        message: "许可证已重置",
        type: 'success'
      });
    }
  }

  // 激活成功回调
  function handleActivationSuccess(licenseInfo: any) {
    logger.debug('[LicenseSection] 激活成功:', licenseInfo);
  }

  // 激活失败回调
  function handleActivationError(error: any) {
    logger.error('[LicenseSection] 激活失败:', error);
  }
</script>

<section class={CSS_CLASSES.LICENSE_SECTION}>
  <h2 class="section-title">许可证状态</h2>

  <!-- 使用增强的许可证状态卡片 -->
  <EnhancedLicenseStatusCard
    license={plugin.settings.license}
    showActions={true}
    onVerify={checkLicenseStatus}
    onReset={resetLicense}
  />

  {#if !plugin.settings.license?.isActivated}
    <!-- 使用增强的激活表单（包含邮箱输入） -->
    <EnhancedActivationForm
      {plugin}
      {onSave}
      onActivationSuccess={handleActivationSuccess}
      onActivationError={handleActivationError}
      standalone={false}
    />
  {/if}
</section>
