<script lang="ts">
  import { logger } from '../../utils/logger';

  import TabNavigation from "../atoms/TabNavigation.svelte";

  //  高级功能限制
  import { PremiumFeatureGuard } from "../../services/premium/PremiumFeatureGuard";

  // 重构后的设置组件
  import BasicSettingsSection from "./sections/BasicSettingsSection.svelte";
  import MemoryLearningSettingsSection from "./sections/MemoryLearningSettingsSection.svelte";
  import FSRS6SettingsSection from "./sections/FSRS6SettingsSection.svelte";


  import DataManagementPanel from "./sections/DataManagementPanel.svelte";

  // AnkiConnect 同步面板
  import AnkiConnectPanel from './AnkiConnectPanel.svelte';

  // 新的关于页面组件
  import ProductInfoSection from './components/ProductInfoSection.svelte';

  // 新版简化卡片解析设置组件
  import SimplifiedParsingSettings from './SimplifiedParsingSettings.svelte';
  import { DEFAULT_SIMPLIFIED_PARSING_SETTINGS } from '../../types/newCardParsingTypes';

  // AI配置组件
  import AIConfigSection from './sections/AIConfigSection.svelte';
  
  // 虚拟化设置组件
  import VirtualizationSettingsSection from './sections/VirtualizationSettingsSection.svelte';
  
  // 增量阅读设置组件
  import IncrementalReadingSettingsSection from './sections/IncrementalReadingSettingsSection.svelte';

  // 插件系统管理组件
  import PluginSystemSection from './sections/PluginSystemSection.svelte';

  // 类型和常量
  import type { PluginExtended } from "./types/settings-types";
  import { SETTINGS_TABS, DEFAULT_ACTIVE_TAB } from "./constants/settings-constants";
  import { showNotification } from "./utils/settings-utils";

  import { onMount } from 'svelte';
  
  //  导入国际化系统
  import { tr } from "../../utils/i18n";

  interface Props { plugin: PluginExtended }
  let { plugin }: Props = $props();

  //  响应式翻译函数
  let t = $derived($tr);

  // 标签页配置
  let activeTab = $state(DEFAULT_ACTIVE_TAB);
  let isMobile = $state(false);
  
  // 🆕 本地响应式状态跟踪性能优化设置显示
  let showPerformanceSettings = $state(plugin.settings.showPerformanceSettings ?? false);
  
  // 本地响应式状态跟踪第三方插件开关
  let enableThirdPartyPlugins = $state(plugin.settings.enableThirdPartyPlugins ?? false);
  
  //  高级功能守卫
  const premiumGuard = PremiumFeatureGuard.getInstance();
  let isPremium = $state(false);
  
  // 🆕 本地响应式状态跟踪高级功能预览设置（用于实时刷新）
  let showPremiumFeaturesPreview = $state(plugin.settings.showPremiumFeaturesPreview ?? false);

  // 订阅高级版状态
  $effect(() => {
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      isPremium = value;
    });
    return unsubscribe;
  });
  
  // 计算是否显示高级功能预览（已激活或设置中开启了预览）- 使用$derived实现响应式
  let showPremiumFeatures = $derived(isPremium || showPremiumFeaturesPreview);
  
  // 🆕 处理高级功能预览设置变更（由子组件调用）
  function handlePremiumFeaturesPreviewToggle(enabled: boolean) {
    showPremiumFeaturesPreview = enabled;
    
    // 如果当前在高级功能标签页且该标签被隐藏，自动切换到默认标签页
    if (PREMIUM_TABS.includes(activeTab) && !enabled && !isPremium) {
      activeTab = DEFAULT_ACTIVE_TAB;
    }
  }
  
  // 🆕 处理性能优化设置显示变更（由子组件调用）
  function handlePerformanceSettingsToggle(enabled: boolean) {
    showPerformanceSettings = enabled;
    
    // 如果当前在性能优化标签页且该标签被隐藏，自动切换到默认标签页
    if (activeTab === 'virtualization' && !enabled) {
      activeTab = DEFAULT_ACTIVE_TAB;
    }
  }

  // 处理第三方插件开关变更（由子组件调用）
  function handleThirdPartyPluginsToggle(enabled: boolean) {
    enableThirdPartyPlugins = enabled;
    
    // 如果当前在插件标签页且被关闭，自动切换到默认标签页
    if (activeTab === 'plugin-system' && !enabled) {
      activeTab = DEFAULT_ACTIVE_TAB;
    }
  }
  
  // 🆕 根据设置动态过滤标签页（响应式）
  //  高级功能标签页列表（未激活时隐藏）
  const PREMIUM_TABS = ['card-parsing', 'incremental-reading'];
  
  let visibleTabs = $derived(
    SETTINGS_TABS.filter(tab => {
      if (isMobile && tab.id === 'anki-connect') {
        return false;
      }
      // 如果是性能优化标签页，检查设置
      if (tab.id === 'virtualization') {
        return showPerformanceSettings;
      }
      // 如果是插件标签页，检查第三方插件开关
      if (tab.id === 'plugin-system') {
        return enableThirdPartyPlugins;
      }
      //  如果是高级功能标签页，检查高级功能状态
      if (PREMIUM_TABS.includes(tab.id)) {
        return showPremiumFeatures;
      }
      return true;
    })
  );



  // 初始化组件
  onMount(() => {
    const updateIsMobile = () => {
      const cls = document.body?.classList;
      isMobile = !!cls && (cls.contains('is-mobile') || cls.contains('is-phone') || cls.contains('is-tablet'));

      if (activeTab === 'annotation') {
        activeTab = DEFAULT_ACTIVE_TAB;
      }

      if (isMobile && activeTab === 'anki-connect') {
        activeTab = DEFAULT_ACTIVE_TAB;
      }
    };

    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  });

  // 防抖动保存函数
  let saveTimeout: NodeJS.Timeout | null = null;

  async function save() {
    // 清除之前的定时器
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // 设置新的防抖动定时器
    saveTimeout = setTimeout(async () => {
      try {
        await plugin.saveSettings();
      } catch (error) {
        logger.error('保存设置失败:', error);
        showNotification({
          message: '设置保存失败，请重试',
          type: 'error'
        });
      }
    }, 300);
  }

  // 重试机制函数
  async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        logger.warn(`操作失败，${delay}ms后重试 (${i + 1}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  // 通用数据操作错误处理函数
  async function handleDataOperation<T>(
    operation: () => Promise<T>,
    successMessage: string,
    errorMessage: string,
    errorContext?: string,
    enableRetry: boolean = false
  ): Promise<T | null> {
    try {
      const result = enableRetry
        ? await withRetry(operation)
        : await operation();
      showNotification({ message: successMessage, type: 'success' });
      return result;
    } catch (error) {
      const context = errorContext || errorMessage;
      logger.error(`${context}:`, error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      showNotification({
        message: `${errorMessage}: ${errorMsg}`,
        type: 'error'
      });
      return null;
    }
  }
</script>

<div class="anki-app settings-root">
  <div class="header">
    <h1 class="title">{t('settings.title')}</h1>
  </div>

  <div class="tabs">
    <TabNavigation items={visibleTabs} activeId={activeTab} onChange={(id) => activeTab = id} />
  </div>

  <!-- About -->
  {#if activeTab === 'about'}
    <div class="about-container">
      <!-- 产品信息区域 - 包含集成的激活功能 -->
      <ProductInfoSection {plugin} onSave={save} />
    </div>
  {/if}

  <!-- Basic -->
  {#if activeTab === 'basic'}
    <!-- 使用重构后的基础设置组件 -->
    <BasicSettingsSection 
      {plugin} 
      onPerformanceSettingsToggle={handlePerformanceSettingsToggle}
      onPremiumFeaturesPreviewToggle={handlePremiumFeaturesPreviewToggle}
      onThirdPartyPluginsToggle={handleThirdPartyPluginsToggle}
    />
  {/if}

  {#if activeTab === 'memory-learning'}
    <MemoryLearningSettingsSection {plugin} />
  {/if}

  <!-- FSRS6 Algorithm -->
  {#if activeTab === 'fsrs6'}
    <FSRS6SettingsSection {plugin} />
  {/if}

  <!-- Simplified Card Parsing Settings -->
  {#if activeTab === 'card-parsing'}
    <SimplifiedParsingSettings
      settings={plugin.settings.simplifiedParsing}
      onSettingsChange={(newSettings: any) => {
        plugin.settings.simplifiedParsing = newSettings;
        plugin.saveSettings();
      }}
      {plugin}
    />
  {/if}

  <!-- AI Configuration -->
  {#if activeTab === 'ai-config'}
    <AIConfigSection {plugin} />
  {/if}
  
  <!-- Incremental Reading Settings -->
  {#if activeTab === 'incremental-reading'}
    <IncrementalReadingSettingsSection {plugin} />
  {/if}
  
  <!-- Virtualization Settings -->
  {#if activeTab === 'virtualization' && showPerformanceSettings}
    <VirtualizationSettingsSection onSave={save} app={plugin.app} />
  {/if}

  <!-- Data Management -->
  {#if activeTab === 'data-management'}
    <DataManagementPanel {plugin} onSave={save} />
  {/if}

  <!-- Anki Connect -->
  {#if activeTab === 'anki-connect'}
    <AnkiConnectPanel {plugin} />
  {/if}

  <!-- Plugin System -->
  {#if activeTab === 'plugin-system'}
    <PluginSystemSection {plugin} />
  {/if}
</div>

<style>
  /* 基础布局样式 */
  .settings-root {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    height: 100%;
    pointer-events: auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    margin: 0;
    font-size: var(--weave-font-size-lg);
    font-weight: 700;
    background: var(--anki-gradient-primary);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tabs {
    margin-top: 0.25rem;
  }

  /* 关于页面样式 */
  .about-container {
    width: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* 动画定义 */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
