<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { WeavePlugin } from "../main";
  import type { WeaveDataStorage } from "../data/storage";
  import type { FSRS } from "../algorithms/fsrs";
  import WeaveCardManagementPage from "./pages/WeaveCardManagementPage.svelte";
  import DeckStudyPage from "./pages/DeckStudyPage.svelte";
  import SettingsPage from "./settings/SettingsPanel.svelte";
  import AIAssistantPage from "./pages/AIAssistantPage.svelte";
  import SidebarNavHeader from "./navigation/SidebarNavHeader.svelte";
  import ResponsiveContainer from "./ui/ResponsiveContainer.svelte";
  import { isInSidebar, createSidebarObserver } from "../utils/responsive";
  import { waitForServiceReady } from "../utils/service-ready-event";

  //  错误边界组件
  import ErrorBoundary from "./ui/ErrorBoundary.svelte";

  import { Platform } from 'obsidian';

  // 🌍 导入国际化
  import { tr } from "../utils/i18n";
  import { logger } from "../utils/logger";

  // 导入主题管理器
  import { addThemeClasses } from "../utils/theme-detection";

  // 插件配置模态窗
  import AutoRulesConfigModal from "./modals/AutoRulesConfigModal.svelte";

  interface Props {
    plugin: WeavePlugin;
    dataStorage: WeaveDataStorage;
    fsrs: FSRS;
  }

  interface ResponsiveState {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    width: number;
  }


  let { plugin, dataStorage, fsrs }: Props = $props();
  let activePage = $state<string>("deck-study");
  let isMounted = $state(false);  // 🔥 添加挂载状态追踪
  
  // 📱 移动端检测状态
  let isMobileDevice = $state(false);
  
  // 🆕 侧边栏模式检测状态
  let isInSidebarMode = $state(false);
  let sidebarObserverCleanup: (() => void) | null = null;
  
  // 🆕 侧边栏导航状态（用于与子页面同步）
  let sidebarDeckFilter = $state<'memory' | 'incremental-reading' | 'question-bank'>('memory');
  let sidebarCardView = $state<'table' | 'grid' | 'kanban'>('table');
  let sidebarDeckStudyView = $state<'grid' | 'kanban'>('grid');
  // 🆕 卡片管理页面的数据源状态
  let cardDataSource = $state<'memory' | 'questionBank' | 'incremental-reading'>('memory');

  let appElement: HTMLElement;
  let themeCleanup: (() => void) | null = null;
  
  // 响应式翻译函数
  let t = $derived($tr);

  // 🆕 导航可见性本地响应式状态
  let navigationVisibility = $state(plugin.settings.navigationVisibility || {
    deckStudy: true,
    cardManagement: true,
    incrementalReading: true,
    aiAssistant: true
  });

  // 牌组数据
  let decks = $state<any[]>([]);

  // 插件配置模态窗状态
  let showPluginConfigModal = $state<string | null>(null);

  onMount(() => {
    isMounted = true;  // 🔥 标记组件已挂载
    
    // 📱 检测移动端设备
    isMobileDevice = Platform.isMobile || document.body.classList.contains('is-mobile');
    logger.debug('[WeaveApp] 移动端检测结果:', isMobileDevice);
    
    const handleNavigate = (e: CustomEvent<string>) => {
      activePage = e.detail;
    };

    // 🆕 监听导航可见性更新事件
    const handleNavigationVisibilityUpdate = (e: CustomEvent<any>) => {
      navigationVisibility = { ...e.detail };
      logger.debug('[WeaveApp] 导航可见性已更新:', navigationVisibility);
      
      // 🔧 智能页面切换：如果当前页面被隐藏，自动切换到第一个可见页面
      const pageVisibilityMap: Record<string, boolean> = {
        'deck-study': navigationVisibility.deckStudy !== false,
        'card-management': navigationVisibility.cardManagement !== false,
        'incremental-reading': navigationVisibility.incrementalReading !== false,
        'ai-assistant': navigationVisibility.aiAssistant !== false,
      };
      
      // 如果当前页面被隐藏，切换到第一个可见页面
      if (pageVisibilityMap[activePage] === false) {
        const firstVisiblePage = Object.keys(pageVisibilityMap).find(page => pageVisibilityMap[page]);
        if (firstVisiblePage) {
          activePage = firstVisiblePage;
          logger.info(`[WeaveApp] 当前页面已隐藏，自动切换到: ${firstVisiblePage}`);
        }
      }
    };

    window.addEventListener("Weave:navigate", handleNavigate as EventListener);
    window.addEventListener("Weave:navigation-visibility-update", handleNavigationVisibilityUpdate as EventListener);
    
    // 监听插件配置打开事件
    const handleOpenPluginConfig = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.pluginId) {
        showPluginConfigModal = detail.pluginId;
      }
    };
    document.addEventListener('Weave:open-plugin-config', handleOpenPluginConfig);
    
    // 🆕 监听子页面状态变化（用于侧边栏导航同步）
    const handleDeckFilterChange = (e: CustomEvent<string>) => {
      sidebarDeckFilter = e.detail as 'memory' | 'question-bank' | 'incremental-reading';
      logger.debug('[WeaveApp] 牌组筛选变化:', sidebarDeckFilter);
    };
    const handleCardViewChange = (e: CustomEvent<string>) => {
      sidebarCardView = e.detail as 'table' | 'grid' | 'kanban';
      logger.debug('[WeaveApp] 卡片视图变化:', sidebarCardView);
    };
    const handleDeckViewChange = (e: CustomEvent<string>) => {
      const view = e.detail as 'grid' | 'kanban' | string;
      if (view === 'grid' || view === 'kanban') {
        sidebarDeckStudyView = view;
        logger.debug('[WeaveApp] 牌组学习视图变化:', sidebarDeckStudyView);
      }
    };
    window.addEventListener("Weave:deck-filter-change", handleDeckFilterChange as EventListener);
    window.addEventListener("Weave:card-view-change", handleCardViewChange as EventListener);
    window.addEventListener("Weave:deck-view-change", handleDeckViewChange as EventListener);

    // 加载牌组数据
    (async () => {
      try {
        // 🔥 关键修复：等待所有核心服务就绪（包括 cardFileService）
        // getCards() 依赖 cardFileService，必须等待 allCoreServices
        await waitForServiceReady('allCoreServices', 15000);
        decks = await dataStorage.getDecks();
      } catch (error) {
        logger.error('加载牌组数据失败:', error);
        decks = [];
      }
    })();
    
    // 应用主题类到应用容器
    if (appElement) {
      themeCleanup = addThemeClasses(appElement);
      logger.debug('[WeaveApp] 主题类已应用到应用容器');
      
      // 🆕 初始化侧边栏检测
      isInSidebarMode = isInSidebar(appElement);
      logger.debug('[WeaveApp] 初始侧边栏模式:', isInSidebarMode);
      
      // 监听侧边栏状态变化
      sidebarObserverCleanup = createSidebarObserver(appElement, (inSidebar) => {
        isInSidebarMode = inSidebar;
        logger.debug('[WeaveApp] 侧边栏模式变化:', inSidebar);
      });
    }

    return () => {
      window.removeEventListener("Weave:navigate", handleNavigate as EventListener);
      window.removeEventListener("Weave:navigation-visibility-update", handleNavigationVisibilityUpdate as EventListener);
      window.removeEventListener("Weave:deck-filter-change", handleDeckFilterChange as EventListener);
      window.removeEventListener("Weave:card-view-change", handleCardViewChange as EventListener);
      window.removeEventListener("Weave:deck-view-change", handleDeckViewChange as EventListener);
      document.removeEventListener('Weave:open-plugin-config', handleOpenPluginConfig);

      // 清理主题监听器
      if (themeCleanup) {
        themeCleanup();
        themeCleanup = null;
      }
    };
  });

  onDestroy(() => {
    // 🔥 标记组件已卸载
    isMounted = false;
    
    // 清理主题监听器
    if (themeCleanup) {
      themeCleanup();
      themeCleanup = null;
    }
    
    // 🆕 清理侧边栏观察器
    if (sidebarObserverCleanup) {
      sidebarObserverCleanup();
      sidebarObserverCleanup = null;
    }
    
  });

</script>


<ResponsiveContainer classPrefix="weave">
  {#snippet children(responsive: ResponsiveState)}
    <div
      bind:this={appElement}
      class="weave-app weave-app-inner"
      role="application"
    >
      <!-- 🆕 统一导航头部（侧边栏和主内容区都显示，移动端由各页面的 MobileHeader 处理） -->
      <!-- 🔧 修复：移除 isInSidebarMode 条件，让菜单按钮在主内容区也显示 -->
      {#if !isMobileDevice}
        <SidebarNavHeader
          currentPage={activePage}
          selectedFilter={sidebarDeckFilter}
          deckStudyView={activePage === 'deck-study' ? sidebarDeckStudyView : 'grid'}
          currentView={sidebarCardView}
          cardDataSource={cardDataSource}
          onFilterSelect={(filter) => {
            sidebarDeckFilter = filter;
            // 触发事件通知子页面
            window.dispatchEvent(new CustomEvent('Weave:sidebar-filter-select', { detail: filter }));
          }}
          onViewChange={(view) => {
            sidebarCardView = view;
            // 触发事件通知子页面
            window.dispatchEvent(new CustomEvent('Weave:sidebar-view-change', { detail: view }));
          }}
          onCardDataSourceChange={(source) => {
            cardDataSource = source;
            // 🆕 触发事件通知卡片管理页面
            window.dispatchEvent(new CustomEvent('Weave:card-data-source-change', { detail: source }));
          }}
          onNavigate={(pageId) => {
            activePage = pageId;
          }}
        />
      {/if}
      
      <main class="weave-main-content" class:mobile={isMobileDevice}>
        {#if activePage === "deck-study"}
          <DeckStudyPage {dataStorage} {fsrs} {plugin} />
        {:else if activePage === "weave-card-management"}
          <WeaveCardManagementPage {dataStorage} {fsrs} {plugin} />
        {:else if activePage === "incremental-reading"}
          <!-- 增量阅读已移至全局侧边栏 -->
          <div class="removed-feature-notice">
            <div class="notice-icon">提示</div>
            <h3>增量阅读</h3>
            <p>增量阅读功能已整合到左侧边栏中。<br/>点击左侧边栏的图标即可访问日历视图和材料列表。</p>
          </div>
        {:else if activePage === "ai-assistant"}
          <div class="weave-page-host">
            <AIAssistantPage {plugin} {dataStorage} {fsrs} />
          </div>
        {:else if activePage === "settings"}
          <SettingsPage plugin={plugin as any} />
        {/if}
      </main>
      
      <!-- 插件配置模态窗 -->
      {#if showPluginConfigModal === 'auto-rules'}
        <AutoRulesConfigModal
          open={true}
          onClose={() => { showPluginConfigModal = null; }}
          {plugin}
        />
      {/if}

    </div>
  {/snippet}
</ResponsiveContainer>

<!-- ⚠️ 全局新建卡片模态窗已重构：不再使用 GlobalModalContainer，
     现在直接在 main.ts 的 openCreateCardModal() 中挂载到 document.body -->

<style>
  .weave-app {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-interface);
    overflow: hidden;
  }

  .weave-app-inner {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .weave-main-content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding-top: 0;
    margin-top: 0;
    overflow: hidden;
    transition: padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-main-content.mobile {
    padding-top: 0;
  }

  .weave-main-content > :global(*) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .weave-page-host {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .removed-feature-notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: var(--text-muted);
    max-width: 600px;
    margin: 0 auto;
  }

  .removed-feature-notice .notice-icon {
    font-size: 4rem;
    margin-bottom: 20px;
    opacity: 0.4;
  }

  .removed-feature-notice h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0 0 12px 0;
  }

  .removed-feature-notice p {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-muted);
    margin: 0;
  }
</style>
