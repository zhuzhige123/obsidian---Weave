<script lang="ts">
  import { logger } from '../../utils/logger';
  import { vaultStorage } from '../../utils/vault-local-storage';

  import { onMount } from 'svelte';
  import { Menu } from 'obsidian';
  import type { Deck, DeckStats } from '../../data/types';
  import type { DeckTreeNode } from '../../services/deck/DeckHierarchyService';
  import type { StudySession } from '../../data/study-types';
  import type { WeavePlugin } from '../../main';
  import DeckGridCard from './DeckGridCard.svelte';
  import ChineseElegantDeckCard from './ChineseElegantDeckCard.svelte';
  import CategoryFilter, { type DeckFilter } from './CategoryFilter.svelte';
  import { getColorSchemeForDeck } from '../../config/card-color-schemes';
  // 🆕 v0.10 导入题库组件
  import QuestionBankListView from '../question-bank/QuestionBankListView.svelte';
  import QuestionBankGridView from '../question-bank/QuestionBankGridView.svelte';
  import { tr } from '../../utils/i18n';
  // 🆕 牌组卡片设计类型
  import type { DeckCardStyle } from '../../types/plugin-settings.d';
  //  高级功能限制
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';
  import ActivationPrompt from '../premium/ActivationPrompt.svelte';
  // 🆕 侧边栏检测
  import { isInSidebar, createSidebarObserver } from '../../utils/responsive';

  interface Props {
    deckTree: DeckTreeNode[];
    deckStats: Record<string, DeckStats>;
    studySessions: StudySession[];
    plugin: WeavePlugin;
    // 🆕 筛选器状态（由父组件管理）
    selectedFilter?: DeckFilter;
    onFilterSelect?: (filter: DeckFilter) => void;
    onStartStudy: (deckId: string) => void;
    onContinueStudy: () => void;
    // 菜单操作回调
    onAdvanceStudy?: (deckId: string) => Promise<void>;
    onOpenDeckAnalytics?: (deckId: string) => void;
    onOpenLoadForecast?: (deckId: string) => void;
    onEditDeck?: (deckId: string) => void;
    onDeleteDeck?: (deckId: string) => void;
    onRefreshData?: () => Promise<void>;
    // 🆕 v2.0 引用式牌组系统
    onDissolveDeck?: (deckId: string) => void;
  }

  let {
    deckTree,
    deckStats,
    studySessions,
    plugin,
    // 🆕 筛选器状态（由父组件管理，支持双向绑定）
    selectedFilter: externalFilter = undefined,
    onFilterSelect: externalOnFilterSelect = undefined,
    onStartStudy,
    onContinueStudy,
    onAdvanceStudy,
    onOpenDeckAnalytics,
    onOpenLoadForecast,
    onEditDeck,
    onDeleteDeck,
    onRefreshData,
    // 🆕 v2.0 引用式牌组系统
    onDissolveDeck
  }: Props = $props();

  //  响应式翻译函数
  let t = $derived($tr);

  //  高级功能守卫
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

  // 🆕 获取当前牌组卡片设计样式
  const deckCardStyle = $derived<DeckCardStyle>(
    (plugin.settings.deckCardStyle as DeckCardStyle) || 'default'
  );

  // 🆕 检测是否在侧边栏（容器宽度较窄）
  let containerRef: HTMLElement | null = $state(null);
  let isCompactMode = $state(false);
  // 🆕 侧边栏模式检测（用于隐藏 CategoryFilter）
  let isInSidebarMode = $state(false);
  let sidebarObserverCleanup: (() => void) | null = null;

  // 🆕 v0.10 牌组模式筛选状态
  // 如果父组件传入了 selectedFilter，则使用父组件的状态
  // 否则使用本地状态（向后兼容）
  //  同步初始化：从 localStorage 读取，确保首次渲染即为正确值
  let internalFilter = $state<DeckFilter>((() => {
    try {
      const saved = vaultStorage.getItem('weave-deck-mode-filter') as DeckFilter;
      if (saved && ['memory', 'reading', 'question-bank', 'incremental-reading'].includes(saved)) {
        return saved;
      }
      if (saved && ['parent', 'child', 'all'].includes(saved)) {
        return 'memory' as DeckFilter;
      }
    } catch {}
    return 'memory' as DeckFilter;
  })());
  
  // 🆕 计算实际使用的筛选器（优先使用外部传入的）
  const currentFilter = $derived(externalFilter ?? internalFilter);

  //  internalFilter 已在状态初始化时同步从 localStorage 恢复，onMount 无需重复读取
  onMount(() => {
    logger.debug('[GridCardView] 模式筛选器初始化:', currentFilter);

    // 🆕 检测容器宽度，决定是否使用紧凑模式
    if (containerRef) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          isCompactMode = entry.contentRect.width < 500;
        }
      });
      resizeObserver.observe(containerRef);
      // 初始检测
      isCompactMode = containerRef.clientWidth < 500;
      
      // 🆕 初始化侧边栏检测
      isInSidebarMode = isInSidebar(containerRef);
      logger.debug('[GridCardView] 初始侧边栏模式:', isInSidebarMode);
      
      // 监听侧边栏状态变化
      sidebarObserverCleanup = createSidebarObserver(containerRef, (inSidebar) => {
        isInSidebarMode = inSidebar;
        logger.debug('[GridCardView] 侧边栏模式变化:', inSidebar);
      });
      
      return () => {
        resizeObserver.disconnect();
        if (sidebarObserverCleanup) {
          sidebarObserverCleanup();
          sidebarObserverCleanup = null;
        }
      };
    }
  });

  // 🆕 筛选器选择处理
  function handleFilterSelect(filter: DeckFilter) {
    // 如果有外部回调，调用它
    if (externalOnFilterSelect) {
      externalOnFilterSelect(filter);
    } else {
      // 否则更新本地状态
      internalFilter = filter;
      vaultStorage.setItem('weave-deck-mode-filter', filter);
    }
    logger.debug('[GridCardView] 切换模式筛选器:', filter);
  }

  // 扁平化牌组树（保持层级结构）
  function flattenDeckTree(nodes: DeckTreeNode[]): Deck[] {
    const result: Deck[] = [];
    for (const node of nodes) {
      result.push(node.deck);
      if (node.children.length > 0) {
        result.push(...flattenDeckTree(node.children));
      }
    }
    return result;
  }

  const allDecks = $derived(flattenDeckTree(deckTree));

  // 🆕 v0.10 根据模式筛选牌组（与 DeckStudyPage 保持一致）
  const filteredDecks = $derived(() => {
    // v0.10: 新的三模式筛选
    // memory: 显示所有记忆牌组（现有牌组系统）
    // reading: 增量阅读（占位）
    // question-bank: 题库牌组（由 QuestionBankListView 组件处理）
    
    if (currentFilter === 'memory') {
      // 记忆模式: 显示所有牌组（保持现有行为）
      return allDecks;
    } else if (currentFilter === 'reading') {
      // 增量阅读模式: 返回空数组（显示占位符）
      return [];
    } else if (currentFilter === 'question-bank') {
      // 题库模式: 返回空数组（由 QuestionBankListView 组件处理）
      return [];
    }
    
    //  兼容旧版（parent/child/all）
    if (['parent', 'child', 'all'].includes(currentFilter)) {
      return allDecks;
    }
    
    // 默认返回所有牌组
    return allDecks;
  });

  // 显示牌组菜单（完整版，与DeckStudyPage保持一致）
  function showDeckMenu(event: MouseEvent, deckId: string) {
    const menu = new Menu();

    const deck = allDecks.find(d => d.id === deckId);
    const isSubdeck = deck?.parentId != null;

    // 🆕 提前学习功能
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.advanceStudy'))
        .setIcon("fast-forward")
        .onClick(async () => await onAdvanceStudy?.(deckId))
    );

    //  牌组分析（包含负荷预测）- 高级功能
    menu.addItem((item) => {
      const title = isPremium ? t('decks.menu.deckAnalytics') : t('decks.menu.deckAnalytics') + ' 🔒';
      item
        .setTitle(title)
        .setIcon("bar-chart-2")
        .setDisabled(!isPremium)
        .onClick(() => {
          if (!isPremium) {
            promptFeatureId = PREMIUM_FEATURES.DECK_ANALYTICS;
            showActivationPrompt = true;
            return;
          }
          onOpenDeckAnalytics?.(deckId);
        });
    });

    menu.addSeparator();

    // 创建子牌组和移动牌组功能已移除 - 不再支持父子牌组层级结构

    // 牌组编辑
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.editDeck'))
        .setIcon("edit")
        .onClick(() => onEditDeck?.(deckId))
    );

    // 删除
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.delete'))
        .setIcon("trash-2")
        .onClick(() => onDeleteDeck?.(deckId))
    );

    // 🆕 v2.0 解散牌组（引用式牌组系统）
    if (onDissolveDeck) {
      menu.addItem((item) =>
        item
          .setTitle(t('decks.menu.dissolveDeck'))
          .setIcon("unlink")
          .onClick(() => onDissolveDeck?.(deckId))
      );
    }

    menu.addSeparator();

    menu.showAtMouseEvent(event);
  }

</script>

<div class="grid-card-view" bind:this={containerRef}>
  <!--  桌面端彩色圆点筛选器已移除 - 现在由 WeaveApp 中的 SidebarNavHeader 统一处理 -->
  <!-- 侧边栏和主内容区都使用 SidebarNavHeader 提供的筛选功能 -->

  <!-- 🆕 v0.10 根据模式显示不同内容 -->
  {#if currentFilter === 'memory'}
    <!-- 记忆牌组模式 -->
    {#if filteredDecks().length > 0}
      <div class="cards-grid">
        {#each filteredDecks() as deck, index (deck.id)}
          {@const stats = deckStats[deck.id] || {
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
            memoryRate: 0,
            totalCards: 0,
            todayNew: 0,
            todayReview: 0,
            todayTime: 0,
            totalReviews: 0,
            totalTime: 0,
            averageEase: 0,
            forecastDays: {}
          }}
          {@const colorScheme = getColorSchemeForDeck(deck.id)}
          {@const colorVariant = ((index % 4) + 1) as 1 | 2 | 3 | 4}
          
          {#if deckCardStyle === 'chinese-elegant'}
            <!-- 🆕 中式典雅风格卡片 -->
            <ChineseElegantDeckCard
              {deck}
              {stats}
              {colorVariant}
              compact={isCompactMode}
              onStudy={() => onStartStudy(deck.id)}
              onMenu={(e) => showDeckMenu(e, deck.id)}
            />
          {:else}
            <!-- 默认风格卡片 -->
            <DeckGridCard
              {deck}
              {stats}
              {colorScheme}
              onStudy={() => onStartStudy(deck.id)}
              onMenu={(e) => showDeckMenu(e, deck.id)}
            />
          {/if}
        {/each}
      </div>
    {:else}
      <!-- 空状态占位符 -->
      <div class="mode-placeholder">
        <div class="placeholder-icon">--</div>
        <h2 class="placeholder-title">{t('deckStudyPage.emptyState.noDecks')}</h2>
        <p class="placeholder-desc">{t('deckStudyPage.emptyState.createFirstDeck')}</p>
      </div>
    {/if}
  {:else if currentFilter === 'reading'}
    <!-- @deprecated 增量摘录模式已弃用，显示提示信息 -->
    <div class="extract-list-wrapper deprecated-notice">
      <div class="placeholder-icon">--</div>
      <h2 class="placeholder-title">{t('decks.grid.readingTitle')}</h2>
      <p class="placeholder-desc">{t('decks.grid.readingDesc')}</p>
    </div>
  {:else if currentFilter === 'question-bank'}
    <!-- 题库牌组模式 - 网格视图 -->
    <QuestionBankGridView {plugin} />
  {/if}
</div>

<!--  激活提示模态窗 -->
{#if showActivationPrompt}
  <ActivationPrompt
    visible={showActivationPrompt}
    featureId={promptFeatureId}
    onClose={() => showActivationPrompt = false}
  />
{/if}

<style>
  .grid-card-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px 4px;
    overflow-y: auto;
    background: var(--background-primary);
    container-type: inline-size;
    container-name: deck-grid;
  }

  /*  桌面端彩色圆点筛选器已移除 - 现在由 WeaveApp 中的 SidebarNavHeader 统一处理 */

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 24px;
    padding: 8px 0;
    container-type: inline-size;
  }

  /* 🆕 v0.10 模式占位符样式 */
  .mode-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 3rem 2rem;
    text-align: center;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    opacity: 0.6;
  }

  .placeholder-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.5rem;
  }

  .placeholder-desc {
    font-size: 1rem;
    color: var(--text-muted);
    max-width: 500px;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .grid-card-view {
      padding: 8px 2px; /* 🔧 减少左右间距，让卡片更贴边 */
    }

    .cards-grid {
      grid-template-columns: 1fr;
      gap: 8px; /* 🔧 减少卡片之间的间距 */
    }

    .mode-placeholder {
      min-height: 300px;
      padding: 2rem 1rem;
    }

    .placeholder-icon {
      font-size: 3rem;
    }

    .placeholder-title {
      font-size: 1.25rem;
    }
  }

  @media (min-width: 769px) and (max-width: 1200px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
  }

  @media (min-width: 1201px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 24px;
    }
  }

  /* 摘录列表视图包装器 - 确保按钮阴影有足够空间 */
  .extract-list-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-top: 8px;  /* 为按钮上方阴影预留额外空间 */
  }

  /*  Obsidian 移动端特定样式 - 内容区贴边 */
  :global(body.is-mobile) .grid-card-view {
    padding: 8px 2px; /* 🔧 减少左右间距，让卡片更贴边 */
  }

  :global(body.is-mobile) .cards-grid {
    gap: 8px; /* 🔧 减少卡片之间的间距 */
    padding: 4px 0;
  }

  :global(body.is-phone) .grid-card-view {
    padding: 4px 1px; /* 🔧 手机端进一步减少间距 */
  }

  :global(body.is-phone) .cards-grid {
    gap: 6px; /* 🔧 手机端进一步减少卡片间距 */
  }
</style>

