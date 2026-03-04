<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount } from 'svelte';
  import { Notice } from 'obsidian';
  import type {
    SimplifiedParsingSettings,
  } from '../../types/newCardParsingTypes';
  import {
    DEFAULT_SIMPLIFIED_PARSING_SETTINGS
  } from '../../types/newCardParsingTypes';
  import type WeavePlugin from '../../main';
  import { tr } from '../../utils/i18n';

  // 导入拆分后的子组件
  import SymbolConfigPanel from './card-parsing/SymbolConfigPanel.svelte';
  
  // 导入新的批量解析设置面板（扁平化设计）
  import SimpleBatchParsingPanel from './batch-parsing/SimpleBatchParsingPanel.svelte';

  //  高级功能限制
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';
  import ActivationPrompt from '../premium/ActivationPrompt.svelte';

  // Props (Svelte 5 Runes 模式)
  interface Props {
    settings?: SimplifiedParsingSettings;
    onSettingsChange?: (settings: SimplifiedParsingSettings) => void;
    plugin?: WeavePlugin;
  }

  let {
    settings = { ...DEFAULT_SIMPLIFIED_PARSING_SETTINGS },
    onSettingsChange = () => {},
    plugin
  }: Props = $props();

  let t = $derived($tr);

  // 状态管理 - 移除标签页切换，简化为单页面
  
  // 批量解析配置的响应式状态
  let batchConfig = $state<any>(undefined);

  //  高级功能守卫
  const premiumGuard = PremiumFeatureGuard.getInstance();
  let isPremium = $state(false);

  // 订阅高级版状态
  $effect(() => {
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      isPremium = value;
    });
    return unsubscribe;
  });

  //  调试日志：初始状态（仅在组件挂载时执行一次）
  // 移除 $effect 避免无限循环

  // 初始化
  onMount(() => {
    // 初始化批量解析配置
    if (plugin?.batchParsingManager) {
      batchConfig = plugin.batchParsingManager.getConfig();
    } else {
      logger.warn('[SimplifiedParsingSettings] batchParsingManager 未初始化');
    }
  });

  // 移除标签页切换逻辑
</script>

<div class="simplified-parsing-settings">
  {#if !isPremium}
    <!-- 未激活提示 - 使用统一的ActivationPrompt组件 -->
    <ActivationPrompt
      visible={true}
      featureId={PREMIUM_FEATURES.BATCH_PARSING}
      embedded={true}
      onClose={() => {}}
    />
  {:else}
    <!-- 已激活，显示完整配置 -->
    
    <!-- 分隔符配置面板 -->
    <div class="weave-settings">
      <div class="settings-group">
        <SymbolConfigPanel
          {settings}
          onSettingsChange={onSettingsChange}
        />
      </div>
    </div>

    <!-- 批量解析配置 -->
    {#if batchConfig !== undefined}
      <SimpleBatchParsingPanel
        config={batchConfig}
        onConfigChange={async (newConfig) => {
          batchConfig = newConfig;
          
          // 保存配置到插件
          if (plugin?.batchParsingManager) {
            try {
              // 使用正确的方法名保存配置
              await plugin.batchParsingManager.updateConfig(newConfig);
            } catch (error) {
              logger.error('[SimplifiedParsingSettings] 配置保存失败:', error);
            }
          }
        }}
        app={plugin?.app}
        plugin={plugin}
      />
    {/if}
  {/if}

</div>

<style>
  .simplified-parsing-settings {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
  }

  /* 移除标签页相关样式，现在是单页面布局 */

  /* settings-group样式由全局settings-common.css处理 */
</style>
