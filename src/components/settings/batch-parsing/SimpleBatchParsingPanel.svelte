<!--
  简化批量解析配置面板
  使用统一的文件夹牌组映射表格
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type { SimpleBatchParsingConfig, FolderDeckMapping } from '../../../services/batch-parsing';
  import type WeavePlugin from '../../../main';
  import { onMount } from 'svelte';
  import type { Deck } from '../../../data/types';
  import FolderDeckMappingTable from './FolderDeckMappingTable.svelte';

  //  高级功能守卫
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../../services/premium/PremiumFeatureGuard';

  interface Props {
    config: SimpleBatchParsingConfig;
    onConfigChange: (config: SimpleBatchParsingConfig) => void;
    app: any;
    plugin?: WeavePlugin;
  }

  let { config, onConfigChange, app, plugin }: Props = $props();

  // 牌组列表（从插件获取）
  let decks = $state<Deck[]>([]);

  //  高级功能权限检查
  const premiumGuard = PremiumFeatureGuard.getInstance();
  let isPremium = $state(false);

  // 订阅高级版状态
  $effect(() => {
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      isPremium = value;
    });
    return unsubscribe;
  });

  // 初始化
  onMount(async () => {
    await refreshDecks();
  });

  /**
   * 刷新牌组列表
   */
  async function refreshDecks() {
    if (plugin?.dataStorage) {
      try {
        const allDecks = await plugin.dataStorage.getAllDecks();
        decks = allDecks || [];
      } catch (error) {
        logger.error('[SimpleBatchParsingPanel] 获取牌组列表失败:', error);
        decks = [];
      }
    } else {
      decks = [];
    }
  }

  /**
   * 更新配置
   */
  function updateConfig(updates: Partial<SimpleBatchParsingConfig>) {
    const newConfig = { ...config, ...updates };
    onConfigChange(newConfig);
  }

  /**
   * 更新映射列表
   */
  function handleMappingsChange(mappings: FolderDeckMapping[]) {
    updateConfig({
      folderDeckMappings: mappings
    });
  }
</script>

<div class="simple-batch-parsing-panel">
  <!-- 文件夹牌组映射表格 -->
  <section class="config-section">
    <FolderDeckMappingTable
      mappings={config.folderDeckMappings || []}
      {decks}
      {app}
      {plugin}
      onMappingsChange={handleMappingsChange}
    />
  </section>
</div>

<style>
  .simple-batch-parsing-panel {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1rem 0;
  }

  /* 区块标题样式 */
  .config-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .simple-batch-parsing-panel {
      padding: 0.5rem 0;
      gap: 1.5rem;
    }

    .config-section {
      gap: 1rem;
    }
  }
</style>
