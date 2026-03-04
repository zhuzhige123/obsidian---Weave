<!--
  基础设置组件
  职责：处理基础配置项（默认牌组、通知、主题等）
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';
  import ObsidianDropdown from '../../ui/ObsidianDropdown.svelte';
  import type WeavePlugin from '../../../main';
  // ðŸŒ 导入国际化系统
  import { tr } from '../../../utils/i18n';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';
  
  // ðŸ”’ 高级功能限制
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../../services/premium/PremiumFeatureGuard';
  import ActivationPrompt from '../../premium/ActivationPrompt.svelte';

  interface Props {
    plugin: WeavePlugin;
    onPerformanceSettingsToggle?: (enabled: boolean) => void;
    onPremiumFeaturesPreviewToggle?: (enabled: boolean) => void;
    onThirdPartyPluginsToggle?: (enabled: boolean) => void;
  }

  let { plugin, onPerformanceSettingsToggle, onPremiumFeaturesPreviewToggle, onThirdPartyPluginsToggle }: Props = $props();
  let settings = $state(plugin.settings);
  
  // ðŸŒ 响应式翻译函数
  let t = $derived($tr);
  
  // ðŸ”’ 高级功能守卫
  const premiumGuard = PremiumFeatureGuard.getInstance();
  let isPremium = $state(false);
  let showActivationPrompt = $state(false);
  let promptFeatureId = $state('');

  // 订阅高级版状态
  $effect(() => {
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      isPremium = value;
    });
    return unsubscribe;
  });
  
  // ðŸ”’ 计算是否显示高级功能（已激活或开启了预览）
  let showPremiumFeatures = $derived(isPremium || (settings.showPremiumFeaturesPreview ?? false));

  // 保存设置的统一方法
  async function saveSettings() {
    try {
      plugin.settings = settings;
      await plugin.saveSettings();
      
} catch (error) {
      logger.error('保存设置失败:', error);
}
  }

  // 处理默认牌组变更
  function handleDefaultDeckChange(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    if (value.length > 0) {
      settings.defaultDeck = value;
      saveSettings();
    }
  }

  // 处理悬浮按钮设置变更
  function handleFloatingButtonChange(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    settings.showFloatingCreateButton = enabled;
    saveSettings();
    
    // 动态控制悬浮按钮显示
    plugin.toggleFloatingButton(enabled);
  }

  // ðŸ”œ 处理渐进式挖空历史继承策略变更
  function handleProgressiveClozeHistoryChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'first' | 'proportional' | 'reset' | 'prompt';
    
    if (!settings.progressiveCloze) {
      settings.progressiveCloze = {
        enableAutoSplit: true
      };
    }
    
    settings.progressiveCloze.historyInheritance = value;
    saveSettings();
  }

  // 处理拖拽调整设置变更
  function handleResizeEnabledChange(event: Event) {
    if (!settings.editorModalSize) {
      settings.editorModalSize = {
        preset: 'large',
        customWidth: 800,
        customHeight: 600,
        rememberLastSize: true,
        enableResize: true
      };
    }
    settings.editorModalSize.enableResize = (event.target as HTMLInputElement).checked;
    saveSettings();
  }

  // ðŸ”œ 处理牌组卡片设计样式变更
  function handleDeckCardStyleChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'default' | 'chinese-elegant';
    settings.deckCardStyle = value;
    saveSettings();
    
}

  // ðŸ”œ 处理主界面打开位置变更
  function handleMainInterfaceOpenLocationChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'content' | 'sidebar';
    settings.mainInterfaceOpenLocation = value;
    saveSettings();
  }

  // 处理导航可见性变更
  function handleNavigationVisibilityChange(key: string) {
    return (event: Event) => {
      if (!settings.navigationVisibility) {
        settings.navigationVisibility = {};
      }
      (settings.navigationVisibility as any)[key] = (event.target as HTMLInputElement).checked;
      plugin.settings.navigationVisibility = { ...settings.navigationVisibility };
      
      // ðŸ”œ 立即通知主界面更新导航
      window.dispatchEvent(new CustomEvent('Weave:navigation-visibility-update', {
        detail: plugin.settings.navigationVisibility
      }));
      
      saveSettings();
    };
  }

  // 处理调试模式变更
  async function handleDebugModeChange(event: Event) {
    settings.enableDebugMode = (event.target as HTMLInputElement).checked;
    // 立即更新日志管理器的调试模式
    const { logger } = await import('../../../utils/logger');
    logger.setDebugMode(settings.enableDebugMode);
    saveSettings();
    
    // 显示提示
    if (settings.enableDebugMode) {
} else {
}
  }

  // ðŸ”œ 处理性能优化设置显示变更
  function handleShowPerformanceSettingsChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    settings.showPerformanceSettings = checked;
    plugin.settings.showPerformanceSettings = checked;
    
    // ðŸ”œ 关键：立即通知父组件更新UI
    if (onPerformanceSettingsToggle) {
      onPerformanceSettingsToggle(checked);
    }
    
    saveSettings();
    
  }
  
  // ðŸ”œ 处理显示高级功能预览变更
  function handleShowPremiumFeaturesPreviewChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    settings.showPremiumFeaturesPreview = checked;
    plugin.settings.showPremiumFeaturesPreview = checked;
    
    saveSettings();
    
    // ðŸ”œ 通知父组件实时刷新标签页和界面
    onPremiumFeaturesPreviewToggle?.(checked);
    
  }

  // 处理第三方插件启用变更
  async function handleThirdPartyPluginsChange(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const checked = inputEl.checked;

    if (checked) {
      // 启用时需要安全确认
      const confirmed = await showObsidianConfirm(
        plugin.app,
        '第三方插件可以访问你的笔记数据，请仅安装来自可信来源的插件。\n\n确定要启用第三方插件系统吗？',
        { title: '安全提示', confirmText: '启用', cancelText: '取消' }
      );
      if (!confirmed) {
        // 用户取消，恢复开关
        inputEl.checked = false;
        return;
      }
    }

    settings.enableThirdPartyPlugins = checked;
    plugin.settings.enableThirdPartyPlugins = checked;
    
    // 立即通知父组件更新UI
    if (onThirdPartyPluginsToggle) {
      onThirdPartyPluginsToggle(checked);
    }
    
    saveSettings();

  }

</script>

<div class="weave-settings settings-section basic-settings">
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-blue">{t('settings.basic.title')}</h4>
  
    <div class="group-content">
    <!-- 默认牌组 -->
    <div class="row weave-inline-input">
      <label for="defaultDeck">{t('settings.basic.defaultDeck.label')}</label>
      <input
        id="defaultDeck"
        type="text"
        value={settings.defaultDeck}
        placeholder={t('settings.basic.defaultDeck.placeholder')}
        class="modern-input"
        oninput={handleDefaultDeckChange}
      />
    </div>

    <!-- 显示悬浮新建按钮 -->
    <div class="row">
      <label for="showFloatingCreateButton">{t('settings.basic.floatingButton.label')}</label>
      <label class="modern-switch">
        <input
          id="showFloatingCreateButton"
          type="checkbox"
          checked={settings.showFloatingCreateButton}
          onchange={handleFloatingButtonChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <!-- 调试模式 -->
    <div class="row">
      <label for="enableDebugMode">{t('settings.basic.debugMode.label')}</label>
      <label class="modern-switch">
        <input
          id="enableDebugMode"
          type="checkbox"
          checked={settings.enableDebugMode ?? false}
          onchange={handleDebugModeChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <!-- 启用第三方插件 -->
    <div class="row">
      <label for="enableThirdPartyPlugins">启用第三方插件</label>
      <label class="modern-switch">
        <input
          id="enableThirdPartyPlugins"
          type="checkbox"
          checked={settings.enableThirdPartyPlugins ?? false}
          onchange={handleThirdPartyPluginsChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <!-- ÆŸ 显示性能优化设置 -->
    <div class="row">
      <label for="showPerformanceSettings">{t('settings.basic.showPerformanceSettings.label')}</label>
      <label class="modern-switch">
        <input
          id="showPerformanceSettings"
          type="checkbox"
          checked={settings.showPerformanceSettings ?? false}
          onchange={handleShowPerformanceSettingsChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <!-- 🆕 显示高级功能预览 -->
    <div class="row">
      <label for="showPremiumFeaturesPreview">显示高级功能预览</label>
      <label class="modern-switch">
        <input
          id="showPremiumFeaturesPreview"
          type="checkbox"
          checked={settings.showPremiumFeaturesPreview ?? false}
          onchange={handleShowPremiumFeaturesPreviewChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <!-- 牌组卡片设计样式 -->
    <div class="row">
      <label for="deckCardStyle">{t('settings.basic.deckCardStyle.label')}</label>
      <div class="settings-dropdown-compact">
        <ObsidianDropdown
          options={[
            { id: 'default', label: t('settings.basic.deckCardStyle.options.default') },
            { id: 'chinese-elegant', label: t('settings.basic.deckCardStyle.options.chineseElegant') }
          ]}
          value={settings.deckCardStyle ?? 'default'}
          onchange={(value) => {
            settings.deckCardStyle = value as 'default' | 'chinese-elegant';
            saveSettings();
}}
        />
      </div>
    </div>

    <!-- 主界面打开位置 -->
    <div class="row">
      <label for="mainInterfaceOpenLocation">主界面打开位置</label>
      <div class="settings-dropdown-compact">
        <ObsidianDropdown
          options={[
            { id: 'content', label: '内容区（主编辑区域）' },
            { id: 'sidebar', label: '侧边栏' }
          ]}
          value={settings.mainInterfaceOpenLocation ?? 'content'}
          onchange={(value) => {
            settings.mainInterfaceOpenLocation = value as 'content' | 'sidebar';
            saveSettings();
}}
        />
      </div>
    </div>

  </div>
  </div>

  <!-- 编辑器窗口设置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-cyan">{t('settings.editor.title')}</h4>

    <div class="group-content">
    <!-- 启用拖拽调整 -->
    <div class="row">
      <label for="enable-resize-switch">{t('settings.editor.window.enableResize.label')}</label>
      <label class="modern-switch">
        <input
          id="enable-resize-switch"
          type="checkbox"
          checked={settings.editorModalSize?.enableResize ?? true}
          onchange={handleResizeEnabledChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>
  </div>

  <!-- 🆕 渐进式挖空设置 - 高级功能（未激活且未开启预览时完全隐藏） -->
  {#if showPremiumFeatures}
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-green">
      {t('settings.basic.progressiveCloze.title')}
    </h4>
    
    <div class="group-content">
      <!-- 历史继承策略 -->
      <div class="row">
        <label for="progressive-cloze-history">{t('settings.basic.progressiveCloze.historyInheritance.label')}</label>
        <div class="progressive-cloze-history-dropdown">
          <ObsidianDropdown
            options={[
              { id: 'first', label: t('settings.basic.progressiveCloze.historyInheritance.first') },
              { id: 'proportional', label: t('settings.basic.progressiveCloze.historyInheritance.proportional') },
              { id: 'reset', label: t('settings.basic.progressiveCloze.historyInheritance.reset') },
              { id: 'prompt', label: t('settings.basic.progressiveCloze.historyInheritance.prompt') }
            ]}
            value={settings.progressiveCloze?.historyInheritance ?? 'first'}
            onchange={(value) => {
              if (!settings.progressiveCloze) {
                settings.progressiveCloze = { enableAutoSplit: true };
              }
              settings.progressiveCloze.historyInheritance = value as 'first' | 'proportional' | 'reset' | 'prompt';
              saveSettings();
}}
          />
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- 导航项显示 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-purple">{t('settings.navigation.title')}</h4>
  
    <div class="group-content">
    <div class="row">
      <label for="navDeckStudy">{t('navigation.deckStudy')}</label>
      <label class="modern-switch">
        <input
          id="navDeckStudy"
          type="checkbox"
          checked={settings.navigationVisibility?.deckStudy !== false}
          onchange={handleNavigationVisibilityChange('deckStudy')}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <div class="row">
      <label for="navCardManagement">{t('navigation.cardManagement')}</label>
      <label class="modern-switch">
        <input
          id="navCardManagement"
          type="checkbox"
          checked={settings.navigationVisibility?.cardManagement !== false}
          onchange={handleNavigationVisibilityChange('cardManagement')}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <div class="row">
      <label for="navAiAssistant">{t('navigation.aiAssistant')}</label>
      <label class="modern-switch">
        <input
          id="navAiAssistant"
          type="checkbox"
          checked={settings.navigationVisibility?.aiAssistant !== false}
          onchange={handleNavigationVisibilityChange('aiAssistant')}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

  </div>
  </div>
</div>

<!--  激活提示模态窗 -->
{#if showActivationPrompt}
  <ActivationPrompt
    visible={showActivationPrompt}
    featureId={promptFeatureId}
    onClose={() => showActivationPrompt = false}
  />
{/if}
