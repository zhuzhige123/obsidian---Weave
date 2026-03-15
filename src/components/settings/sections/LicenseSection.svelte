<script lang="ts">
  import { logger } from '../../../utils/logger';
  import { tr } from '../../../utils/i18n';
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

  let t = $derived($tr);

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
          message: t('licenseNotices.verifySuccess'),
          type: 'success'
        });
        return;
      }

      showNotification({
        message: validation.error ? t('licenseNotices.verifyFailedDetail', { error: validation.error }) : t('licenseNotices.verifyFailed'),
        type: 'error'
      });
    } catch (error) {
      handleError(error, 'license verification');
    }
  }

  // 重置许可证
  async function resetLicense() {
    const confirmed = await showObsidianConfirm(plugin.app, t('licenseNotices.resetConfirm'), { title: t('common.confirmReset') });
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
        message: t('licenseNotices.resetSuccess'),
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
  <h2 class="section-title">{t('licenseNotices.sectionTitle')}</h2>

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
