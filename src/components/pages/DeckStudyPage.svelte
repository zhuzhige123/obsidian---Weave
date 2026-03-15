<script lang="ts">
  import { onMount } from "svelte";
  import ObsidianIcon from "../ui/ObsidianIcon.svelte";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import BouncingBallsLoader from "../ui/BouncingBallsLoader.svelte";

  import StudyInterface from "../study/StudyInterface.svelte";
  import type { WeaveDataStorage } from "../../data/storage";
  import type { FSRS } from "../../algorithms/fsrs";
  import type { Card, Deck, DeckStats } from "../../data/types";
  import type { StudySession } from "../../data/study-types";
  import type { DataChangeEvent } from "../../services/DataSyncService";
  import { CardType } from "../../data/types";
  //  移除不存在的DeckTreeBuilder导入 - 使用DeckHierarchyService代替
  import { logger } from '../../utils/logger';
  import { vaultStorage } from '../../utils/vault-local-storage';
  import type WeavePlugin from '../../main';
  //  导入回收卡片过滤工具（原搁置功能已重构）
  import { filterRecycledCards } from '../../utils/recycle-utils';
  //  导入ID生成工具函数
  import { generateId, generateUUID } from '../../utils/helpers';
  // 🆕 渐进式挖空支持 - V2架构
  import { isProgressiveClozeParent, isProgressiveClozeChild } from '../../types/progressive-cloze-v2';
  import CreateDeckModal from "../modals/CreateDeckModal.svelte";
  import APKGImportModal from "../modals/APKGImportModal.svelte";
  import CSVImportModal from "../modals/CSVImportModal.svelte";
  import ClipboardImportModal from "../modals/ClipboardImportModal.svelte";
  // MoveDeckModal 已移除 - 不再支持父子牌组层级结构
  import type { ImportResult } from "../../domain/apkg/types";
  import { Menu, Modal, Notice, Setting } from "obsidian";
  import type { DeckTreeNode } from "../../services/deck/DeckHierarchyService";
  
  //  导入服务就绪检查工具
  import { waitForService, safeServiceCall } from "../../utils/service-ready-check";
  import { waitForServiceReady } from "../../utils/service-ready-event";
  
  // 进度条模态窗
  import { executeBatchWithProgress } from "../../utils/progress-modal";
  
  // 🆕 导入视图组件
  import KanbanView from "../deck-views/KanbanView.svelte";
  import GridCardView from "../deck-views/GridCardView.svelte";
  import CategoryFilter from "../deck-views/CategoryFilter.svelte";
  
  // 🆕 v0.10 导入题库组件
  import QuestionBankListView from "../question-bank/QuestionBankListView.svelte";
  
  //  导入庆祝模态窗
  import CelebrationModal from "../modals/CelebrationModal.svelte";
  
  //  导入增量阅读牌组视图
  import IRDeckView from "../incremental-reading/IRDeckView.svelte";
  import type { CelebrationStats } from "../../types/celebration-types";
  
  // 🆕 导入无卡片提示模态窗
  import NoCardsAvailableModal from "../modals/NoCardsAvailableModal.svelte";
  
  //  导入牌组分析模态窗
  import DeckAnalyticsModal from "../modals/DeckAnalyticsModal.svelte";
  
  // 🆕 导入学习完成逻辑辅助函数
  import { loadDeckCardsForStudy, isDeckCompleteForToday, getAdvanceStudyCards, getLearnedNewCardsCountToday } from "../../utils/study/studyCompletionHelper";
  
  //  高级功能限制
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from "../../services/premium/PremiumFeatureGuard";
  import ActivationPrompt from "../premium/ActivationPrompt.svelte";
  import PremiumBadge from "../premium/PremiumBadge.svelte";
  
  //  导入国际化
  import { tr } from '../../utils/i18n';
  
  //  导入移动端组件
  import MobileDeckStudyHeader from "../study/MobileDeckStudyHeader.svelte";
  // MobileNavMenu 已移除 - 现在使用 Obsidian Menu API
  import { Platform } from 'obsidian';
  // 🆕 导入安全设置打开函数
  import { safeOpenSettings } from '../../utils/obsidian-api-safe';

  interface Props {
    dataStorage: WeaveDataStorage;
    fsrs: FSRS;
    plugin: WeavePlugin;
  }

  let { dataStorage, fsrs, plugin }: Props = $props();
  let t = $derived($tr);

  // 核心状态
  //  showStudyModal 已废弃 - 现在使用 plugin.openStudySession()
  // let showStudyModal = $state(false);
  let studyCards = $state<Card[]>([]);
  let showCreateDeckModal = $state(false);
  let createSubdeckParentId = $state<string | null>(null);
  let showAPKGImportModal = $state(false);
  let showCSVImportModal = $state(false);
  let showClipboardImportModal = $state(false);
  
  //  加载状态
  let isLoading = $state(true);


  // 牌组编辑模态窗状态
  let showEditDeckModal = $state(false);
  let editingDeck: Deck | null = $state(null);

  // 创建子牌组和移动牌组功能已移除 - 不再支持父子牌组层级结构
  
  
  //  庆祝模态窗状态
  let showCelebrationModal = $state(false);
  let celebrationDeckName = $state<string>('');
  let celebrationDeckId = $state<string>('');
  let celebrationStats = $state<CelebrationStats | null>(null);
  
  // 🆕 无卡片提示模态窗状态
  let showNoCardsModal = $state(false);
  let noCardsDeckName = $state<string>('');
  let noCardsReason = $state<'empty' | 'all-learned' | 'no-due'>('empty');
  let noCardsStats = $state<{
    totalCards: number;
    learnedCards: number;
    nextDueTime?: string;
    todayNewCards?: number;
    todayNewLimit?: number;
  } | undefined>(undefined);
  let noCardsCurrentDeckId = $state<string>('');

  //  牌组分析模态窗状态
  let showDeckAnalyticsModal = $state(false);
  let analyticsDeckId = $state<string | undefined>(undefined);
  let analyticsDeckCards = $state<Card[]>([]);

  //  移动端状态
  let isMobile = $state(false);
  // showMobileNavMenu 已移除 - 现在使用 Obsidian Menu API
  
  //  移动端彩色圆点配置（用于分类筛选）
  // 使用数据层的 Deck 类型

  // 数据状态
  let decks = $state<Deck[]>([]);
  let deckTree = $state<DeckTreeNode[]>([]);
  let expandedDeckIds = $state<Set<string>>(new Set());
  let allCards = $state<Card[]>([]);
  let deckStats = $state<Record<string, DeckStats>>({});
  let studySessions = $state<StudySession[]>([]);
  
  // 考试牌组和增量阅读的牌组树（用于看板视图）
  let qbDeckTree = $state<DeckTreeNode[]>([]);
  let qbDeckStats = $state<Record<string, DeckStats>>({});
  let irDeckTree = $state<DeckTreeNode[]>([]);
  let irDeckStats = $state<Record<string, DeckStats>>({});
  
  // 🆕 视图状态 - 从持久化存储加载，默认使用网格卡片视图
  let currentView = $state<'classic' | 'kanban' | 'grid'>('grid');
  
  // 🆕 牌组模式筛选状态（v0.10 - 题库功能）
  // memory: 记忆牌组, question-bank: 题库牌组, incremental-reading: 增量阅读
  // 兼容旧版: parent/child/all 映射到 memory
  //  同步初始化：从 localStorage 读取，确保首次渲染即为正确值（避免重启后圆点与内容不匹配）
  let selectedFilter = $state<'memory' | 'question-bank' | 'incremental-reading' | 'parent' | 'child' | 'all'>((() => {
    try {
      const saved = vaultStorage.getItem('weave-deck-mode-filter');
      if (saved && ['memory', 'question-bank', 'incremental-reading'].includes(saved)) {
        return saved as 'memory' | 'question-bank' | 'incremental-reading';
      }
      if (saved && ['parent', 'child', 'all'].includes(saved)) {
        return 'memory';
      }
    } catch {}
    return 'memory';
  })());
  
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
  
  // 🆕 从 Obsidian 持久化存储加载视图偏好
  onMount(() => {
    //  检测移动端
    isMobile = Platform.isMobile || document.body.classList.contains('is-mobile');
    
    // 🆕 订阅数据同步服务（在同步作用域中定义，以便清理函数可以访问）
    let unsubscribeDecks: (() => void) | undefined;
    let unsubscribeSessions: (() => void) | undefined;
    let unsubscribeCards: (() => void) | undefined;
    
    // 异步初始化（不阻塞清理函数的返回）
    (async () => {
      //  selectedFilter 已在状态初始化时同步从 localStorage 恢复，此处无需重复读取
      
      // 🆕 使用 Obsidian 持久化 API 加载视图偏好
      try {
        const savedData = await plugin.loadData();
        const savedView = savedData?.deckView || vaultStorage.getItem('weave-deck-view'); // 兼容旧版localStorage
        
        // 验证并加载保存的视图
        if (savedView && ['kanban', 'grid'].includes(savedView)) {
          currentView = savedView as typeof currentView;
          window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
        } else if (savedView === 'classic' || savedView === 'timeline' || savedView === 'card') {
          // 经典列表、时间轴和卡片视图已移除，切换到网格卡片视图
          currentView = 'grid';
          window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
        } else {
          currentView = 'grid';
          window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
        }
        
        // 如果从localStorage加载成功，迁移到Obsidian持久化存储
        if (vaultStorage.getItem('weave-deck-view') && savedData?.deckView !== vaultStorage.getItem('weave-deck-view')) {
          const migratedView = vaultStorage.getItem('weave-deck-view');
          if (migratedView && ['kanban', 'grid'].includes(migratedView)) {
            await plugin.saveData({ ...savedData, deckView: migratedView });
            currentView = migratedView as typeof currentView;
            window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
          } else if (migratedView === 'classic') {
            // 经典列表视图已移除，切换到网格卡片视图
            await plugin.saveData({ ...savedData, deckView: 'grid' });
            currentView = 'grid';
            window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
          }
        }
      } catch (error) {
        logger.warn('加载视图偏好失败:', error);
        // 降级到localStorage（兼容）
        const savedView = vaultStorage.getItem('weave-deck-view');
        if (savedView && ['kanban', 'grid'].includes(savedView)) {
          currentView = savedView as typeof currentView;
          window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
        } else if (savedView === 'classic') {
          // 经典列表视图已移除，默认使用网格卡片视图
          currentView = 'grid';
          window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
        } else {
          currentView = 'grid';
          window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: currentView }));
        }
      }
      
      // 🆕 订阅数据同步服务
      if (plugin.dataSyncService) {
        // 订阅数据变更通知
        
        // 订阅牌组变更
        unsubscribeDecks = plugin.dataSyncService.subscribe(
          'decks',
          async (event: DataChangeEvent) => {
            // 牌组数据变更
            await refreshData(false);
          },
          { debounce: 300 }
        );
        
        // 订阅学习会话变更
        unsubscribeSessions = plugin.dataSyncService.subscribe(
          'sessions',
          async (event: DataChangeEvent) => {
            // 学习会话变更
            await refreshData(false);
          },
          { debounce: 300 }
        );
        
        // 订阅卡片变更（影响统计）
        unsubscribeCards = plugin.dataSyncService.subscribe(
          'cards',
          async (event: DataChangeEvent) => {
            // 卡片数据变更
            await refreshData(false);
          },
          { debounce: 500 }
        );
        
        // 数据同步服务订阅成功
      }
    })(); // 结束异步IIFE
    
    // 3. 监听workspace事件（备用刷新机制）
    const handleCardCreated = async () => {
      // 卡片创建事件
      await refreshData(false);
    };
    
    const handleCardUpdated = async () => {
      logger.debug('[DeckStudyPage] 接收到卡片更新事件，刷新数据');
      await refreshData(false);
    };
    
    (plugin.app.workspace as any).on("Weave:card-created", handleCardCreated);
    (plugin.app.workspace as any).on("Weave:card-updated", handleCardUpdated);
    
    // 4. 从localStorage加载展开状态
    loadExpandedState();
    
    // 5. 立即刷新数据
    refreshData();
    
    // 🆕 监听全局视图切换事件（移到 onMount 确保只注册一次）
    const handleShowViewMenu = (e: CustomEvent) => {
      showViewSwitcher(e.detail.event);
    };
    window.addEventListener('show-view-menu', handleShowViewMenu as EventListener);
    
    // 🆕 监听侧边栏筛选事件
    const handleSidebarFilterSelect = (e: CustomEvent<string>) => {
      const filter = e.detail as 'memory' | 'question-bank' | 'incremental-reading';
      handleFilterSelect(filter);
    };
    window.addEventListener('Weave:sidebar-filter-select', handleSidebarFilterSelect as EventListener);
    
    // 🆕 初始化时通知父组件当前筛选状态
    window.dispatchEvent(new CustomEvent('Weave:deck-filter-change', { detail: selectedFilter }));

    // 清理函数
    return () => {
      if (unsubscribeDecks) unsubscribeDecks();
      if (unsubscribeSessions) unsubscribeSessions();
      if (unsubscribeCards) unsubscribeCards();
      (plugin.app.workspace as any).off("Weave:card-created", handleCardCreated);
      (plugin.app.workspace as any).off("Weave:card-updated", handleCardUpdated);
      window.removeEventListener('show-view-menu', handleShowViewMenu as EventListener);
      window.removeEventListener('Weave:sidebar-filter-select', handleSidebarFilterSelect as EventListener);
    };
  });
  
  // 🆕 视图切换逻辑（使用 Obsidian Menu API）
  function showViewSwitcher(evt: MouseEvent) {
    const menu = new Menu();
    
    //  只保留网格卡片和看板视图
    const views = [
      { id: 'grid', label: t('deckStudyPage.views.grid'), icon: 'grid', desc: t('deckStudyPage.views.gridDesc') },
      { id: 'kanban', label: t('deckStudyPage.views.kanban'), icon: 'columns', desc: t('deckStudyPage.views.kanbanDesc') }
    ] as const;
    
    views.forEach(view => {
      menu.addItem((item) => {
        item
          .setTitle(view.label)
          .setIcon(view.icon)
          .setChecked(currentView === view.id)
          .onClick(async () => {
            currentView = view.id;
            // 保存偏好
            try {
              const savedData = await plugin.loadData();
              await plugin.saveData({ ...savedData, deckView: view.id });
            } catch (error) {
              // 降级到localStorage（兼容）
              vaultStorage.setItem('weave-deck-view', view.id);
            }
            window.dispatchEvent(new CustomEvent('Weave:deck-view-change', { detail: view.id }));
          });
      });
    });
    
    menu.showAtMouseEvent(evt);
  }

  // 显示更多操作菜单（使用 Obsidian 原生菜单）
  function showMoreActionsMenu(event: MouseEvent) {
    const menu = new Menu();
    
    // 🆕 增量阅读模式：显示导入文件夹选项
    if (selectedFilter === 'incremental-reading') {
      menu.addItem((item) => {
        item
          .setTitle(t('deckStudyPage.menu.importFolder'))
          .setIcon("folder-plus")
          .onClick(() => {
            document.dispatchEvent(new CustomEvent('ir-import-folder'));
          });
      });
      
      menu.showAtMouseEvent(event);
      return;
    }
    
    // 记忆牌组模式的菜单
    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.importAPKG'))
        .setIcon("package")
        .onClick(() => { showAPKGImportModal = true; });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.importCSV'))
        .setIcon("file-text")
        .onClick(() => { showCSVImportModal = true; });
    });

    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.importClipboard'))
        .setIcon('clipboard-paste')
        .onClick(() => { showClipboardImportModal = true; });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.exportJSON'))
        .setIcon("download")
        .setDisabled(decks.length === 0)
        .onClick(exportDeck);
    });
    
    menu.showAtMouseEvent(event);
  }


  // 数据刷新
  async function refreshData(showLoading = false) {
    if (showLoading) {
      isLoading = true;
    }
    
    try {
      //  关键修复：等待所有核心服务就绪（包括 cardFileService）
      // getCards() 依赖 cardFileService，必须等待 allCoreServices
      await waitForServiceReady('allCoreServices', 15000);
      
      decks = await dataStorage.getDecks();
      allCards = await dataStorage.getCards();
      await calculateDeckStats();
      
      // 加载牌组树结构
      await loadDeckTree();
      
      // 加载学习历史数据（最近30天）
      await loadStudySessions();
    } finally {
      if (showLoading) {
        isLoading = false;
      }
    }
  }
  
  // 当切换到kanban视图或切换模式时，加载对应的牌组树数据
  $effect(() => {
    const view = currentView;
    const filter = selectedFilter;
    if (view === 'kanban') {
      if (filter === 'question-bank') {
        loadQBDeckTree();
      } else if (filter === 'incremental-reading') {
        loadIRDeckTree();
      }
    }
  });

  // 加载考试牌组树（用于看板视图）
  async function loadQBDeckTree() {
    try {
      if (!plugin.questionBankService || !plugin.questionBankHierarchy || !plugin.deckHierarchy) return;
      const memoryTree = await plugin.deckHierarchy.getDeckTree();
      qbDeckTree = await plugin.questionBankHierarchy.buildQuestionBankTree(memoryTree);
      // 构建统计
      // 映射QB统计到DeckStats格式，与QuestionBankGridCard显示一致:
      // newCards → 总题(total), learningCards → 已练(completed), reviewCards → 错题(errorCount)
      const stats: Record<string, DeckStats> = {};
      for (const node of qbDeckTree) {
        const bank = node.deck;
        const questions = plugin.questionBankService ? await plugin.questionBankService.getQuestionsByBank(bank.id) : [];
        const total = questions.length;
        let completed = 0;
        let errorCount = 0;
        for (const q of questions) {
          if ((q as any).stats?.testStats?.attempts > 0) {
            completed++;
            errorCount += (q as any).stats?.testStats?.incorrectAttempts || 0;
          }
        }
        stats[bank.id] = {
          totalCards: total, newCards: total, learningCards: completed, reviewCards: errorCount,
          todayNew: 0, todayReview: 0, todayTime: 0, totalReviews: 0, totalTime: 0, memoryRate: 0, averageEase: 0, forecastDays: {}
        };
      }
      qbDeckStats = stats;
    } catch (e) {
      logger.warn('[DeckStudyPage] loadQBDeckTree failed:', e);
    }
  }

  // 加载增量阅读牌组树（用于看板视图）
  async function loadIRDeckTree() {
    try {
      const { IRStorageService } = await import('../../services/incremental-reading/IRStorageService');
      const irStorage = new IRStorageService(plugin.app);
      await irStorage.initialize();
      const irDecks = await irStorage.getAllDecks();
      const irDeckList: import('../../types/ir-types').IRDeck[] = Object.values(irDecks);
      const activeIRDecks = irDeckList.filter(d => !d.archivedAt);
      
      // 为每个IR牌组获取真实统计数据
      const stats: Record<string, DeckStats> = {};
      const treeNodes: DeckTreeNode[] = [];
      
      for (const irDeck of activeIRDecks) {
        // 使用 IRStorageService.getDeckStats 获取真实统计
        let irStats = { newCount: 0, learningCount: 0, reviewCount: 0, dueToday: 0, dueWithinDays: 0, totalCount: irDeck.blockIds?.length || 0, fileCount: 0, questionCount: 0, completedQuestionCount: 0 };
        try {
          irStats = await irStorage.getDeckStats(irDeck.id);
        } catch (e) {
          logger.debug('[DeckStudyPage] IR getDeckStats failed for', irDeck.name, e);
        }
        
        // 映射IR统计到DeckStats格式，与IRDeckCard显示一致:
        // newCards → 未读(dueToday), learningCards → 待读(dueWithinDays-dueToday), reviewCards → 提问(questionCount)
        const deckStats: DeckStats = {
          totalCards: irStats.totalCount,
          newCards: irStats.dueToday,
          learningCards: Math.max(0, (irStats.dueWithinDays ?? irStats.dueToday) - irStats.dueToday),
          reviewCards: irStats.questionCount ?? 0,
          todayNew: 0, todayReview: 0, todayTime: 0,
          totalReviews: 0, totalTime: 0,
          memoryRate: 0, averageEase: 0, forecastDays: {}
        };
        
        const node: DeckTreeNode = {
          deck: {
            id: irDeck.id,
            name: irDeck.name,
            description: irDeck.description || '',
            category: '',
            path: irDeck.path || irDeck.name,
            level: 0,
            order: 0,
            inheritSettings: false,
            settings: {} as any,
            includeSubdecks: false,
            created: irDeck.createdAt,
            modified: irDeck.updatedAt,
            tags: irDeck.tags || [],
            stats: deckStats,
            metadata: { isIRDeck: true, color: irDeck.color, icon: irDeck.icon }
          } as Deck,
          children: []
        };
        
        treeNodes.push(node);
        stats[irDeck.id] = deckStats;
      }
      
      irDeckTree = treeNodes;
      irDeckStats = stats;
    } catch (e) {
      logger.warn('[DeckStudyPage] loadIRDeckTree failed:', e);
    }
  }

  // 🆕 父子卡片牌组筛选相关函数
  function isParentCardDeck(deck: Deck): boolean {
    return deck.metadata?.pairedChildDeck != null;
  }

  function isChildCardDeck(deck: Deck): boolean {
    return deck.metadata?.pairedParentDeck != null;
  }

  function handleFilterSelect(filter: 'memory' | 'reading' | 'question-bank' | 'incremental-reading' | 'parent' | 'child' | 'all') {
    // 兼容旧版
    if (['parent', 'child', 'all'].includes(filter)) {
      selectedFilter = 'memory';
    } else {
      // 高级版功能守卫
      if (premiumGuard.isFeatureRestricted(filter)) {
        promptFeatureId = filter;
        showActivationPrompt = true;
        return;
      }
      selectedFilter = filter as 'memory' | 'question-bank' | 'incremental-reading';
    }
    vaultStorage.setItem('weave-deck-mode-filter', selectedFilter);
    logger.debug('[DeckStudyPage] 切换模式筛选器:', selectedFilter);
    
    // 通知父组件状态变化（用于侧边栏导航同步）
    window.dispatchEvent(new CustomEvent('Weave:deck-filter-change', { detail: selectedFilter }));
  }
  
  //  移动端菜单按钮点击处理 - 使用 Obsidian Menu API
  function handleMobileMenuClick(evt: MouseEvent) {
    showMobileNavMenuWithObsidianAPI(evt);
  }
  
  //  使用 Obsidian 原生 Menu API 显示移动端导航菜单
  async function showMobileNavMenuWithObsidianAPI(evt: MouseEvent) {
    const menu = new Menu();
    
    // 功能切换分组
    menu.addItem((item) => {
      item
        .setTitle(t('navigation.deckStudy'))
        .setIcon('graduation-cap')
        .setChecked(true)
        .onClick(() => {
          // 已在牌组学习界面，无需操作
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('navigation.cardManagement'))
        .setIcon('list')
        .onClick(() => {
          window.dispatchEvent(new CustomEvent('Weave:navigate', { 
            detail: 'weave-card-management' 
          }));
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('navigation.aiAssistant'))
        .setIcon('bot')
        .onClick(() => {
          window.dispatchEvent(new CustomEvent('Weave:navigate', { 
            detail: 'ai-assistant' 
          }));
        });
    });
    
    menu.addSeparator();
    
    // 视图切换分组
    menu.addItem((item) => {
      item
        .setTitle(t('navigation.switchView'))
        .setIcon('layout-grid')
        .onClick(() => {
          const viewEvent = new MouseEvent('click', { bubbles: true, clientX: evt.clientX, clientY: evt.clientY });
          showViewSwitcher(viewEvent);
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('navigation.createDeck'))
        .setIcon('folder-plus')
        .onClick(() => {
          showCreateDeckModal = true;
        });
    });
    
    menu.addSeparator();

    // 导入功能
    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.importAPKG'))
        .setIcon('package')
        .onClick(() => { showAPKGImportModal = true; });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.importCSV'))
        .setIcon('file-text')
        .onClick(() => { showCSVImportModal = true; });
    });

    menu.addItem((item) => {
      item
        .setTitle(t('deckStudyPage.menu.importClipboard'))
        .setIcon('clipboard-paste')
        .onClick(() => { showClipboardImportModal = true; });
    });
    
    menu.addSeparator();
    
    // 更多操作子菜单
    menu.addItem((item) => {
      const submenu = (item as any).setSubmenu();
      item.setTitle(t('deckStudyPage.menu.management')).setIcon('more-horizontal');
      
      submenu.addItem((subItem: any) => {
        subItem
          .setTitle(t('deckStudyPage.menu.restoreTutorialDeck'))
          .setIcon('book-open')
          .onClick(async () => {
            const success = await dataStorage.restoreGuideDeck();
            if (success) {
              await refreshData();
              plugin.app.workspace.trigger('Weave:data-changed');
              new Notice(t('deckStudyPage.notices.tutorialRestored'));
            } else {
              new Notice(t('deckStudyPage.notices.tutorialRestoreFailed'));
            }
          });
      });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('navigation.settings'))
        .setIcon('settings')
        .onClick(() => {
          safeOpenSettings(plugin.app, 'weave');
        });
    });

    
    menu.showAtMouseEvent(evt);
  }
  
  // 🆕 过滤后的牌组树（v0.10 - 三模式筛选）
  const filteredDeckTree = $derived(() => {
    if (currentView !== 'classic') {
      return deckTree;
    }
    
    // v0.10: 新的三模式筛选
    // memory: 显示所有记忆牌组（现有牌组系统）
    // question-bank: 题库牌组（占位，后续阶段实现）
    // incremental-reading: 增量阅读
    
    if (selectedFilter === 'memory') {
      // 记忆模式: 显示所有牌组（保持现有行为）
      //  去重处理：确保没有重复的牌组节点
      const seenIds = new Set<string>();
      const uniqueTree: DeckTreeNode[] = [];
      
      for (const node of deckTree) {
        if (!seenIds.has(node.deck.id)) {
          seenIds.add(node.deck.id);
          uniqueTree.push(node);
        }
      }
      
      return uniqueTree;
    } else if (selectedFilter === 'question-bank') {
      // 题库模式: 暂时返回空数组（占位，后续阶段实现）
      return [];
    } else if (selectedFilter === 'incremental-reading') {
      // 增量阅读模式: 返回空数组，使用专用视图组件
      return [];
    }
    
    // 默认返回所有牌组（去重）
    const seenIds = new Set<string>();
    const uniqueTree: DeckTreeNode[] = [];
    
    for (const node of deckTree) {
      if (!seenIds.has(node.deck.id)) {
        seenIds.add(node.deck.id);
        uniqueTree.push(node);
      }
    }
    
    return uniqueTree;
  });
  
  // 加载学习历史数据
  async function loadStudySessions() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      studySessions = await dataStorage.getStudySessions({
        since: thirtyDaysAgo.toISOString()
      });
    } catch (error) {
      logger.error('[DeckStudyPage] 加载学习历史失败:', error);
      studySessions = [];
    }
  }
  
  // 获取最近学习的牌组ID
  function getRecentlyStudiedDeck(): string | null {
    if (studySessions.length === 0) return null;
    
    // 按开始时间倒序排序
    const sorted = [...studySessions].sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    
    // 返回最近一次学习的牌组ID
    return sorted[0].deckId;
  }
  
  // 继续学习功能（选择最近学习的牌组）
  async function handleContinueStudy() {
    try {
      // 尝试获取最近学习的牌组
      let targetDeckId = getRecentlyStudiedDeck();
      
      // 如果没有最近学习记录，选择第一个有待办的牌组
      if (!targetDeckId) {
        for (const deckId of Object.keys(deckStats)) {
          const stats = deckStats[deckId];
          const totalDue = (stats?.newCards ?? 0) + (stats?.learningCards ?? 0) + (stats?.reviewCards ?? 0);
          if (totalDue > 0) {
            targetDeckId = deckId;
            break;
          }
        }
      }
      
      // 如果找到了目标牌组，开始学习
      if (targetDeckId) {
        await startStudy(targetDeckId);
      } else {
        new Notice(t('deckStudyPage.study.noDeckAvailable'));
      }
    } catch (error) {
      logger.error('[DeckStudyPage] 继续学习失败:', error);
      new Notice(t('notifications.error.startStudy'));
    }
  }

  // 加载牌组树
  async function loadDeckTree() {
    try {
      //  等待 deckHierarchy 服务就绪
      const deckHierarchy = await waitForService(
        () => plugin?.deckHierarchy,
        'deckHierarchy',
        5000
      );
      
      deckTree = await deckHierarchy.getDeckTree();
      
      // 首次加载时从 localStorage 恢复展开状态
      const hasStoredState = vaultStorage.getItem('weave-deck-expanded-state');
      
      if (hasStoredState) {
        // 恢复保存的展开状态
        loadExpandedState();
      } else if (expandedDeckIds.size === 0) {
        // 首次使用，默认展开根级牌组
        deckTree.forEach(node => {
          expandedDeckIds.add(node.deck.id);
        });
        expandedDeckIds = new Set(expandedDeckIds);
        saveExpandedState();
      }
    } catch (error) {
      logger.error('[DeckStudyPage] Failed to load deck tree:', error);
      deckTree = [];
    }
  }

  // 计算牌组统计
  //  v3.0: 使用 UnifiedStudyProvider 确保统计与队列 100% 一致（参考Anki架构）
  // 核心改进：统计数据直接从学习队列派生，而非独立计算
  async function calculateDeckStats() {
    const stats: Record<string, DeckStats> = {};
    
    //  使用 UnifiedStudyProvider（统一数据源）
    const { UnifiedStudyProvider } = await import('../../services/study/UnifiedStudyProvider');
    const unifiedProvider = new UnifiedStudyProvider(dataStorage);
    
    // 读取配置
    const filterSiblings = plugin.settings.studyConfig?.siblingDispersion?.filterInQueue ?? true;
    const newCardsPerDay = plugin.settings.newCardsPerDay || 20;
    const reviewsPerDay = plugin.settings.reviewsPerDay || 200;
    
    logger.debug(`[calculateDeckStats] 🚀 开始计算统计 (v3.0 UnifiedStudyProvider), 牌组数: ${decks.length}`);
    
    // 为每个牌组获取统一的学习数据
    for (const deck of decks) {
      try {
        const { stats: deckStat, queue, debug } = await unifiedProvider.getStudyData(deck.id, {
          newCardsPerDay,
          reviewsPerDay,
          filterSiblings,
          onlyDue: true
        });
        
        // 计算记忆率（从队列派生）
        let memoryRateSum = 0;
        for (const card of queue) {
          const fsrs = card.fsrs;
          if (fsrs) {
            const elapsed = Math.max(0, fsrs.elapsedDays || 0);
            const stability = Math.max(0.01, fsrs.stability || 0.01);
            const retention = Math.exp(-elapsed / stability);
            memoryRateSum += retention;
          }
        }
        
        stats[deck.id] = {
          ...deckStat,
          memoryRate: queue.length > 0 ? memoryRateSum / queue.length : 0
        };
        
        logger.debug(`[calculateDeckStats] ✅ 牌组 ${deck.name}:`, {
          queueLength: queue.length,
          new: deckStat.newCards,
          learning: deckStat.learningCards,
          review: deckStat.reviewCards,
          debug
        });
      } catch (error) {
        logger.error(`[calculateDeckStats] ❌ 牌组 ${deck.name} 统计失败:`, error);
        stats[deck.id] = {
          totalCards: 0,
          newCards: 0,
          learningCards: 0,
          reviewCards: 0,
          todayNew: 0,
          todayReview: 0,
          todayTime: 0,
          totalReviews: 0,
          totalTime: 0,
          memoryRate: 0,
          averageEase: 0,
          forecastDays: {}
        };
      }
    }

    deckStats = stats;
    
    // 防抖持久化统计数据到 decks.json，确保云同步后其他设备能看到最新统计
    debouncedPersistDeckStats(stats);
    
    logger.info('[DeckStudyPage] ✅ 统计完成 (v3.0 UnifiedStudyProvider):', {
      newCardsPerDay,
      filterSiblings,
      deckCount: decks.length,
      statsKeys: Object.keys(stats)
    });
  }

  // 防抖持久化 deckStats（5秒延迟，合并多次快速刷新）
  let persistStatsTimer: ReturnType<typeof setTimeout> | null = null;
  function debouncedPersistDeckStats(stats: Record<string, DeckStats>) {
    if (persistStatsTimer) clearTimeout(persistStatsTimer);
    persistStatsTimer = setTimeout(async () => {
      try {
        await dataStorage.persistAllDeckStats(stats);
      } catch (e) {
        logger.warn('[DeckStudyPage] 持久化 deckStats 失败:', e);
      }
    }, 5000);
  }

  // 处理APKG导入完成
  async function handleAPKGImportComplete(result: ImportResult) {
    if (result.success) {
      const message = t('deckStudyPage.import.success', { deckName: result.deckName || t('common.unknown'), count: String(result.stats.importedCards) });
      const N = (plugin as any).app?.plugins?.plugins?.obsidian?.Notice ||
                 (globalThis as any).Notice || ((...args: any[]) => logger.info(args.join(' ')));
      if (typeof N === 'function') {
        new N(`✅ ${message}`, 5000);
      }

      // 刷新牌组列表
      await refreshData();
      
      // 通知全局侧边栏刷新
      plugin.app.workspace.trigger('Weave:data-changed');
    } else {
      const errorMessage = result.errors && result.errors.length > 0
        ? result.errors[0].message
        : t('notifications.error.importFailed');
      const N = (plugin as any).app?.plugins?.plugins?.obsidian?.Notice ||
                 (globalThis as any).Notice || ((...args: any[]) => logger.error(args.join(' ')));
      if (typeof N === 'function') {
        new N(`❌ ${errorMessage}`, 8000);
      }
    }
  }


  async function exportDeck() {
    try {
      const data = await dataStorage.exportData();
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anki-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      logger.error(t('deckStudyPage.notices.exportFailed'), e);
    }
  }


  // ===== 看板视图模式感知回调 =====
  // 根据 selectedFilter 路由到正确的牌组类型处理函数
  
  async function kanbanStartStudy(deckId: string) {
    if (selectedFilter === 'incremental-reading') {
      // IR牌组：使用 IRStorageAdapterV4 构建学习队列并打开阅读界面
      try {
        const { IRStorageAdapterV4 } = await import('../../services/incremental-reading/IRStorageAdapterV4');
        const storageAdapter = new IRStorageAdapterV4(plugin.app);
        await storageAdapter.initialize();
        const allBlocksV4 = await storageAdapter.getBlocksByDeckV4Fast(deckId);
        
        if (allBlocksV4.length === 0) {
          new Notice(t('deckStudyPage.notices.noBlocks'));
          return;
        }
        
        const { IRV4SchedulerService } = await import('../../services/incremental-reading/IRV4SchedulerService');
        const v4Scheduler = new IRV4SchedulerService(plugin.app, plugin.settings?.incrementalReading?.importFolder);
        await v4Scheduler.initialize();
        const timeBudgetMinutes = plugin.settings?.incrementalReading?.dailyTimeBudgetMinutes ?? 40;
        const queueResult = await v4Scheduler.getStudyQueueV4(deckId, {
          timeBudgetMinutes,
          currentSourcePath: null,
          markActive: true,
          preloadedBlocks: allBlocksV4
        });
        
        // 获取牌组名称
        const { IRStorageService } = await import('../../services/incremental-reading/IRStorageService');
        const irStorage = new IRStorageService(plugin.app);
        await irStorage.initialize();
        const irDeck = await irStorage.getDeckById(deckId);
        const deckName = irDeck?.name || t('deckStudyPage.fallback.incrementalReading');
        
        if (queueResult.queue.length === 0) {
          new Notice(t('deckStudyPage.notices.noDueBlocks', { name: deckName }));
          return;
        }
        
        const focusStats = {
          timeBudgetMinutes,
          estimatedMinutes: queueResult.totalEstimatedMinutes,
          candidateCount: queueResult.stats.candidateCount,
          dueToday: 0,
          dueWithinDays: 0,
          learnAheadDays: plugin.settings?.incrementalReading?.learnAheadDays ?? 3
        };
        
        await plugin.openIRFocusView(deckId, queueResult.queue, deckName, focusStats);
      } catch (error) {
        logger.error('[DeckStudyPage] IR kanban 开始阅读失败:', error);
        new Notice(t('deckStudyPage.notices.startReadingFailed'));
      }
    } else if (selectedFilter === 'question-bank') {
      // QB牌组：打开考试界面
      try {
        if (!plugin.questionBankService) {
          new Notice(t('deckStudyPage.notices.qbServiceNotInit'));
          return;
        }
        const questions = await plugin.questionBankService.getQuestionsByBank(deckId);
        const bank = await plugin.questionBankService.getBankById(deckId);
        
        if (questions.length === 0) {
          new Notice(t('deckStudyPage.notices.noQuestions'));
          return;
        }
        
        await plugin.openQuestionBankSession({
          bankId: deckId,
          bankName: bank?.name || t('deckStudyPage.fallback.unknownBank'),
          mode: 'exam'
        });
      } catch (error) {
        logger.error('[DeckStudyPage] QB kanban 开始考试失败:', error);
        new Notice(t('deckStudyPage.notices.startExamFailed'));
      }
    } else {
      // 记忆牌组：原有逻辑
      await startStudy(deckId);
    }
  }
  
  async function kanbanEditDeck(deckId: string) {
    if (selectedFilter === 'incremental-reading') {
      // IR牌组编辑：使用IRDeckView的编辑模态窗逻辑
      try {
        const { IRStorageService } = await import('../../services/incremental-reading/IRStorageService');
        const { IRChunkFileService } = await import('../../services/incremental-reading/IRChunkFileService');
        const irStorage = new IRStorageService(plugin.app);
        await irStorage.initialize();
        const deck = await irStorage.getDeckById(deckId);
        if (!deck) { new Notice(t('deckStudyPage.notices.deckNotFound')); return; }
        
        const modal = new Modal(plugin.app);
        modal.titleEl.setText(t('deckStudyPage.edit.title'));
        let newName = deck.name;
        let newTag = (deck.tags && deck.tags.length > 0) ? deck.tags[0] : '';
        
        new Setting(modal.contentEl).setName(t('deckStudyPage.edit.name')).addText((text: any) => {
          text.setValue(newName).onChange((v: string) => { newName = v; });
          text.inputEl.style.width = '100%';
        });
        new Setting(modal.contentEl).setName(t('deckStudyPage.edit.tag')).setDesc(t('deckStudyPage.edit.tagDesc'));
        const tagContainer = modal.contentEl.createDiv({ cls: 'weave-tag-input-container' });
        const tagDisplay = tagContainer.createDiv({ cls: 'weave-tag-display' });
        function renderTag() {
          tagDisplay.empty();
          if (newTag) {
            const chip = tagDisplay.createSpan({ cls: 'weave-tag-chip', text: newTag });
            chip.createSpan({ cls: 'weave-tag-remove', text: '\u00d7' }).onclick = () => { newTag = ''; renderTag(); };
          }
        }
        renderTag();
        const tagInput = tagContainer.createEl('input', { type: 'text', placeholder: t('deckStudyPage.edit.tagPlaceholder') });
        tagInput.style.width = '100%';
        tagInput.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' && tagInput.value.trim()) { e.preventDefault(); newTag = tagInput.value.trim(); tagInput.value = ''; renderTag(); }
        });
        
        const btnContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
        btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
        btnContainer.createEl('button', { text: t('common.cancel') }).onclick = () => modal.close();
        const saveBtn = btnContainer.createEl('button', { text: t('common.save'), cls: 'mod-cta' });
        saveBtn.onclick = async () => {
          if (!newName.trim()) return;
          try {
            const oldName = deck.name;
            deck.name = newName.trim();
            deck.tags = newTag ? [newTag] : [];
            deck.updatedAt = new Date().toISOString();
            await irStorage.saveDeck(deck);
            if (oldName !== deck.name) {
              try { await irStorage.migrateChunkDeckNameInYAML(oldName, deck.name); } catch (e) { logger.warn('[kanbanEditDeck] IR YAML migration failed:', e); }
              try {
                const outputRoot = plugin.settings?.incrementalReading?.importFolder;
                const chunkFileService = new IRChunkFileService(plugin.app, outputRoot);
                await chunkFileService.renameDeckIndexCard(oldName, deck.name);
              } catch (e) { logger.warn('[kanbanEditDeck] IR index card rename failed:', e); }
            }
            await loadIRDeckTree();
            window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
            plugin.app.workspace.trigger('Weave:data-changed');
            new Notice(t('deckStudyPage.notices.deckUpdated'));
            modal.close();
          } catch (error) { logger.error('[kanbanEditDeck] IR edit failed:', error); new Notice(t('deckStudyPage.notices.editFailed')); }
        };
        modal.open();
      } catch (error) { logger.error('[kanbanEditDeck] IR编辑模态窗创建失败:', error); }
    } else if (selectedFilter === 'question-bank') {
      // QB牌组编辑
      try {
        const bank = decks.find(d => d.id === deckId) || (await dataStorage.getDeck(deckId));
        if (!bank) { new Notice(t('deckStudyPage.notices.deckNotFound')); return; }
        
        const modal = new Modal(plugin.app);
        modal.titleEl.setText(t('deckStudyPage.edit.title'));
        let newName = bank.name;
        let newTag = (bank.tags && bank.tags.length > 0) ? bank.tags[0] : '';
        
        new Setting(modal.contentEl).setName(t('deckStudyPage.edit.name')).addText((text: any) => {
          text.setValue(newName).onChange((v: string) => { newName = v; });
          text.inputEl.style.width = '100%';
        });
        new Setting(modal.contentEl).setName(t('deckStudyPage.edit.tag')).setDesc(t('deckStudyPage.edit.tagDesc'));
        const tagContainer = modal.contentEl.createDiv({ cls: 'weave-tag-input-container' });
        const tagDisplay = tagContainer.createDiv({ cls: 'weave-tag-display' });
        function renderTag() {
          tagDisplay.empty();
          if (newTag) {
            const chip = tagDisplay.createSpan({ cls: 'weave-tag-chip', text: newTag });
            chip.createSpan({ cls: 'weave-tag-remove', text: '\u00d7' }).onclick = () => { newTag = ''; renderTag(); };
          }
        }
        renderTag();
        const tagInput = tagContainer.createEl('input', { type: 'text', placeholder: t('deckStudyPage.edit.tagPlaceholder') });
        tagInput.style.width = '100%';
        tagInput.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' && tagInput.value.trim()) { e.preventDefault(); newTag = tagInput.value.trim(); tagInput.value = ''; renderTag(); }
        });
        
        const btnContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
        btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
        btnContainer.createEl('button', { text: t('common.cancel') }).onclick = () => modal.close();
        const saveBtn = btnContainer.createEl('button', { text: t('common.save'), cls: 'mod-cta' });
        saveBtn.onclick = async () => {
          if (!newName.trim()) return;
          try {
            const updated = { ...bank, name: newName.trim(), tags: newTag ? [newTag] : [], modified: new Date().toISOString() };
            await dataStorage.saveDeck(updated);
            await loadQBDeckTree();
            plugin.app.workspace.trigger('Weave:data-changed');
            new Notice(t('deckStudyPage.notices.deckUpdated'));
            modal.close();
          } catch (error) { logger.error('[kanbanEditDeck] QB edit failed:', error); new Notice(t('deckStudyPage.notices.editFailed')); }
        };
        modal.open();
      } catch (error) { logger.error('[kanbanEditDeck] QB编辑模态窗创建失败:', error); }
    } else {
      editDeck(deckId);
    }
  }
  
  async function kanbanDeleteDeck(deckId: string) {
    if (selectedFilter === 'incremental-reading') {
      try {
        const { showObsidianConfirm } = await import('../../utils/obsidian-confirm');
        const { IRStorageService } = await import('../../services/incremental-reading/IRStorageService');
        const irStorage = new IRStorageService(plugin.app);
        await irStorage.initialize();
        const deck = await irStorage.getDeckById(deckId);
        if (!deck) { new Notice(t('deckStudyPage.notices.deckNotFound')); return; }
        const confirmed = await showObsidianConfirm(plugin.app, `${t('common.confirmDelete')}: "${deck.name}"?`, { title: t('common.confirmDelete') });
        if (!confirmed) return;
        await irStorage.deleteDeck(deckId);
        await loadIRDeckTree();
        window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
        plugin.app.workspace.trigger('Weave:data-changed');
        new Notice(t('notifications.success.cardDeleted'));
      } catch (error) { logger.error('[kanbanDeleteDeck] IR delete failed:', error); new Notice(t('notifications.error.deleteFailed')); }
    } else if (selectedFilter === 'question-bank') {
      try {
        const { showObsidianConfirm } = await import('../../utils/obsidian-confirm');
        const bank = decks.find(d => d.id === deckId) || (await dataStorage.getDeck(deckId));
        if (!bank) { new Notice(t('deckStudyPage.notices.deckNotFound')); return; }
        const confirmed = await showObsidianConfirm(plugin.app, `${t('common.confirmDelete')}: "${bank.name}"?`, { title: t('common.confirmDelete') });
        if (!confirmed) return;
        await dataStorage.deleteDeck(deckId);
        await loadQBDeckTree();
        plugin.app.workspace.trigger('Weave:data-changed');
        new Notice(t('notifications.success.cardDeleted'));
      } catch (error) { logger.error('[kanbanDeleteDeck] QB delete failed:', error); new Notice(t('notifications.error.deleteFailed')); }
    } else {
      await deleteDeck(deckId);
    }
  }

  // 防止重复点击的锁
  let isStartingStudy = false;
  
  async function startStudy(deckId: string) {
    //  防止重复点击
    if (isStartingStudy) {
      logger.debug('[DeckStudyPage] 正在启动学习，忽略重复点击');
      return;
    }
    
    try {
      isStartingStudy = true;
      
      //  Bug1修复：立即重置studyCards，防止使用旧值
      studyCards = [];
      
      const deck = decks.find(d => d.id === deckId);
      
      // 🆕 v2.0: 完全引用式牌组架构
      // 优先使用 deck.cardUUIDs，同时支持 card.referencedByDecks
      let allDeckCardsRaw: Card[] = [];
      
      // 构建卡片UUID到卡片的映射
      const allCardsMap = new Map<string, Card>();
      for (const card of allCards) {
        allCardsMap.set(card.uuid, card);
      }
      
      // 方式1：通过 deck.cardUUIDs 获取卡片（优先）
      if (deck?.cardUUIDs && deck.cardUUIDs.length > 0) {
        for (const uuid of deck.cardUUIDs) {
          const card = allCardsMap.get(uuid);
          if (card) {
            allDeckCardsRaw.push(card);
          }
        }
        logger.debug(`[DeckStudyPage] 🔗 通过 deck.cardUUIDs 获取牌组卡片:`, {
          deckId: deckId.slice(0, 8),
          cardUUIDsCount: deck.cardUUIDs.length,
          foundCards: allDeckCardsRaw.length
        });
      }
      
      // 方式2：通过 card.referencedByDecks 补充
      if (allDeckCardsRaw.length === 0) {
        for (const card of allCards) {
          if (card.referencedByDecks && card.referencedByDecks.includes(deckId)) {
            allDeckCardsRaw.push(card);
          }
        }
        logger.debug(`[DeckStudyPage] 🔗 通过 card.referencedByDecks 获取牌组卡片:`, {
          deckId: deckId.slice(0, 8),
          foundCards: allDeckCardsRaw.length
        });
      }
      
      //  关键修复：过滤回收卡片，确保与统计和加载逻辑一致
      const allDeckCards = filterRecycledCards(allDeckCardsRaw);
      
      logger.debug(`[DeckStudyPage] 🔍 卡片过滤:`, {
        deckId: deckId.slice(0, 8),
        totalCards: allDeckCardsRaw.length,
        afterFilterRecycled: allDeckCards.length
      });
      
      // 🆕 应用新卡片每日限额逻辑
      const newCardsPerDay = plugin.settings.newCardsPerDay || 20;
      const reviewsPerDay = plugin.settings.reviewsPerDay || 20;
      
      // 获取今天已学习的新卡片数量
      const learnedNewCardsToday = await getLearnedNewCardsCountToday(dataStorage, deckId);
      
      //  使用新的完成判定逻辑（现在是async，确保与队列生成一致）
      const isComplete = await isDeckCompleteForToday(allDeckCards, newCardsPerDay, learnedNewCardsToday);
      
      logger.debug(`[DeckStudyPage] 🔍 学习状态检查:`, {
        deckId: deckId.slice(0, 8),
        allCardsCount: allDeckCards.length,
        isComplete,
        newCardsPerDay,
        learnedNewCardsToday
      });
      
      if (isComplete) {
        //  学习已完成，显示庆祝动画
        logger.debug(`[DeckStudyPage] ✅ 牌组 ${deckId.slice(0, 8)} 今日学习已完成`);
        // studyCards 已经在开头重置为 []
      } else {
        //  使用新的辅助函数加载卡片（应用新卡片限额）
        // 🆕 读取兄弟卡片过滤配置
        const filterSiblings = plugin.settings.studyConfig?.siblingDispersion?.filterInQueue ?? true;
        
        studyCards = await loadDeckCardsForStudy(
          dataStorage,
          deckId,
          newCardsPerDay,
          reviewsPerDay,
          filterSiblings  // 🆕 传递配置
        );
        
        logger.debug(`[DeckStudyPage] ✅ 加载卡片完成:`, {
          studyCardsLength: studyCards.length,
          newCardsPerDay,
          learnedNewCardsToday,
          cardIds: studyCards.slice(0, 3).map(c => c.uuid.slice(0, 8))
        });
      }

      //  关键修复：强制验证 studyCards 确实有效
      const hasValidCards = studyCards && studyCards.length > 0;
      
      logger.debug(`[DeckStudyPage] 🎯 最终决策:`, {
        studyCardsLength: studyCards?.length ?? 0,
        hasValidCards,
        willOpenSession: hasValidCards
      });
      
      // 只有在确定有卡片可学时才打开学习界面
      if (hasValidCards) {
        // 🆕 使用学习会话入口（标签页模式）
        //  关键优化：传递卡片ID列表，避免 StudyView 重复加载
        const cardIds = studyCards.map(c => c.uuid);
        logger.info(`[DeckStudyPage] 📖 打开学习界面:`, {
          deckId: deckId.slice(0, 8),
          cardCount: studyCards.length,
          cardIds: cardIds.slice(0, 3).map(id => id.slice(0, 8))
        });
        
        await plugin.openStudySession({
          deckId,
          cardIds
        });
      } else {
        logger.info(`[DeckStudyPage] ⚠️ 无可学卡片，显示提示模态窗`);
        //  智能判断：是完成学习、配额用完、暂无到期，还是空牌组
        const stats = deckStats[deckId];
        
        //  关键修复：使用物理卡片总数判断是否真的是空牌组
        const physicalTotalCards = allDeckCards.length;  // 物理总卡片数
        const learnableTotalCards = stats?.totalCards ?? 0;  // 可学卡片数（FSRS6过滤后）
        const newCards = stats?.newCards ?? 0;
        const learningCards = stats?.learningCards ?? 0;
        const reviewCards = stats?.reviewCards ?? 0;
        
        logger.debug(`[DeckStudyPage] 📊 卡片数量对比:`, {
          deckId: deckId.slice(0, 8),
          physicalTotal: physicalTotalCards,
          learnableTotal: learnableTotalCards,
          newCards,
          learningCards,
          reviewCards
        });
        
        if (physicalTotalCards === 0) {
          //  场景1：真正的空牌组（物理上没有卡片）
          noCardsDeckName = deck?.name || t('deckStudyPage.fallback.deck');
          noCardsReason = 'empty';
          noCardsStats = undefined;  // 空牌组无需统计
          noCardsCurrentDeckId = deckId;
          showNoCardsModal = true;
        } else if (isComplete && (learningCards > 0 || reviewCards > 0 || newCards === 0)) {
          //  场景2：所有到期卡片已学完（真正的完成）→ 显示庆祝动画
          
          // 防重复逻辑：30分钟内同一牌组不重复显示
          const lastShownKey = `celebration-last-shown-${deckId}`;
          const lastShown = vaultStorage.getItem(lastShownKey);
          const currentTime = Date.now();
          const thirtyMinutes = 1800000; // 30分钟
          
          const shouldShowCelebration = !lastShown || (currentTime - parseInt(lastShown)) > thirtyMinutes;
          
          if (shouldShowCelebration) {
            // 计算统计数据
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            
            const todaySessions = studySessions.filter(s => {
              const sessionDate = new Date(s.startTime);
              return s.deckId === deckId && sessionDate >= today && sessionDate <= todayEnd;
            });
            
            const todayStudyTime = todaySessions.reduce((sum, s) => sum + (s.totalTime || 0), 0) / 1000; // 秒
            const todayReviewed = todaySessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
            
            celebrationDeckName = deck?.name || t('deckStudyPage.fallback.deck');
            celebrationDeckId = deckId;
            celebrationStats = {
              reviewed: todayReviewed,
              studyTime: todayStudyTime,
              memoryRate: stats?.memoryRate ?? 0.9,
              newCards: stats?.newCards ?? 0
            };
            showCelebrationModal = true;
            
            // 记录显示时间
            vaultStorage.setItem(lastShownKey, currentTime.toString());
          } else {
            // 30分钟内已显示过，但仍显示庆祝（用户主动点击）
            // 计算统计数据
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            
            const todaySessions = studySessions.filter(s => {
              const sessionDate = new Date(s.startTime);
              return s.deckId === deckId && sessionDate >= today && sessionDate <= todayEnd;
            });
            
            const todayStudyTime = todaySessions.reduce((sum, s) => sum + (s.totalTime || 0), 0) / 1000;
            const todayReviewed = todaySessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
            
            celebrationDeckName = deck?.name || t('deckStudyPage.fallback.deck');
            celebrationDeckId = deckId;
            celebrationStats = {
              reviewed: todayReviewed,
              studyTime: todayStudyTime,
              memoryRate: stats?.memoryRate ?? 0.9,
              newCards: stats?.newCards ?? 0
            };
            showCelebrationModal = true;
          }
        } else if (newCards > 0 && learnedNewCardsToday >= newCardsPerDay) {
          //  场景3：新卡片配额已用完
          noCardsDeckName = deck?.name || t('deckStudyPage.fallback.deck');
          noCardsReason = 'all-learned';  // 使用 'all-learned' 表示今日目标达成
          
          //  计算最近到期时间
          const nextDueCard = allDeckCards
            .filter(c => c.fsrs && new Date(c.fsrs.due) > new Date())
            .sort((a, b) => new Date(a.fsrs!.due).getTime() - new Date(b.fsrs!.due).getTime())[0];
          
          const nextDueTime = nextDueCard ? formatNextDueTime(new Date(nextDueCard.fsrs!.due)) : undefined;
          
          //  修复：使用物理总卡片数
          noCardsStats = {
            totalCards: physicalTotalCards,  // 使用物理总数
            learnedCards: physicalTotalCards - learnableTotalCards,  // 已学完 = 总数 - 可学数
            nextDueTime,
            todayNewCards: learnedNewCardsToday,
            todayNewLimit: newCardsPerDay
          };
          noCardsCurrentDeckId = deckId;
          showNoCardsModal = true;
        } else {
          //  场景4：有卡片但都还没到期
          noCardsDeckName = deck?.name || t('deckStudyPage.fallback.deck');
          noCardsReason = 'no-due';
          
          //  计算最近到期时间
          const nextDueCard = allDeckCards
            .filter(c => c.fsrs && new Date(c.fsrs.due) > new Date())
            .sort((a, b) => new Date(a.fsrs!.due).getTime() - new Date(b.fsrs!.due).getTime())[0];
          
          const nextDueTime = nextDueCard ? formatNextDueTime(new Date(nextDueCard.fsrs!.due)) : undefined;
          
          //  修复：使用物理总卡片数
          noCardsStats = {
            totalCards: physicalTotalCards,  // 使用物理总数
            learnedCards: physicalTotalCards - learnableTotalCards,  // 已学完 = 总数 - 可学数
            nextDueTime,
            todayNewCards: learnedNewCardsToday,
            todayNewLimit: newCardsPerDay
          };
          noCardsCurrentDeckId = deckId;
          showNoCardsModal = true;
        }
      }
    } catch (error) {
      logger.error('Error starting study:', error);
      const N = (plugin as any).app?.plugins?.plugins?.obsidian?.Notice || (globalThis as any).Notice;
      if (typeof N === 'function') {
        new N(t('deckStudyPage.studyActions.startError'), 3000);
      }
    } finally {
      //  释放锁
      isStartingStudy = false;
    }
  }

  /**
   * 🆕 启动提前学习（学习未到期的复习卡片）
   */
  async function startAdvanceStudy(deckId: string) {
    try {
      const deck = decks.find(d => d.id === deckId);
      
      // 🆕 v2.0: 完全引用式牌组架构
      // 优先使用 deck.cardUUIDs，同时支持 card.referencedByDecks
      let allDeckCardsRaw: Card[] = [];
      
      // 构建卡片UUID到卡片的映射
      const allCardsMap = new Map<string, Card>();
      for (const card of allCards) {
        allCardsMap.set(card.uuid, card);
      }
      
      // 方式1：通过 deck.cardUUIDs 获取卡片（优先）
      if (deck?.cardUUIDs && deck.cardUUIDs.length > 0) {
        for (const uuid of deck.cardUUIDs) {
          const card = allCardsMap.get(uuid);
          if (card) {
            allDeckCardsRaw.push(card);
          }
        }
        logger.debug(`[DeckStudyPage] 🔗 提前学习 - 通过 deck.cardUUIDs 获取牌组卡片:`, {
          deckId: deckId.slice(0, 8),
          cardUUIDsCount: deck.cardUUIDs.length,
          foundCards: allDeckCardsRaw.length
        });
      }
      
      // 方式2：通过 card.referencedByDecks 补充
      if (allDeckCardsRaw.length === 0) {
        for (const card of allCards) {
          if (card.referencedByDecks && card.referencedByDecks.includes(deckId)) {
            allDeckCardsRaw.push(card);
          }
        }
        logger.debug(`[DeckStudyPage] 🔗 提前学习 - 通过 card.referencedByDecks 获取牌组卡片:`, {
          deckId: deckId.slice(0, 8),
          foundCards: allDeckCardsRaw.length
        });
      }
      
      //  关键修复：过滤回收卡片，确保与统计和加载逻辑一致
      const allDeckCards = filterRecycledCards(allDeckCardsRaw);
      
      logger.debug('[DeckStudyPage] 📚 牌组卡片（提前学习）:', {
        deckId,
        totalCards: allDeckCardsRaw.length,
        afterFilterRecycled: allDeckCards.length,
        sampleCardIds: allDeckCards.slice(0, 5).map(c => c.uuid.slice(0, 8)),
        cardTypes: allDeckCards.slice(0, 5).map(c => c.type),
        parentCards: allDeckCards.filter(c => c.type === 'progressive-parent').length,
        childCards: allDeckCards.filter(c => c.type === 'progressive-child').length
      });
      
      //  获取未到期的复习卡片（限制提前学习天数，避免影响记忆效果）
      const maxAdvanceDays = plugin.settings.maxAdvanceDays || 7;
      const advanceCards = getAdvanceStudyCards(allDeckCards, 20, maxAdvanceDays);
      
      if (advanceCards.length === 0) {
        new Notice(t('deckStudyPage.studyActions.noAdvanceCards'));
        return;
      }
      
      logger.debug(`[DeckStudyPage] 🆕 提前学习: ${advanceCards.length} 张卡片`, {
        cardCount: advanceCards.length,
        cardIds: advanceCards.map(c => c.uuid.slice(0, 8)),
        cardTypes: advanceCards.map(c => c.type),
        sampleCard: {
          uuid: advanceCards[0].uuid.slice(0, 8),
          type: advanceCards[0].type,
          isProgressiveParent: advanceCards[0].type === 'progressive-parent',
          isProgressiveChild: advanceCards[0].type === 'progressive-child',
          hasFsrs: !!advanceCards[0].fsrs,
          fsrsState: advanceCards[0].fsrs?.state
        }
      });
      
      //  传递卡片ID列表和学习模式到学习界面
      const cardIds = advanceCards.map(card => card.uuid);
      logger.debug('[DeckStudyPage] 📤 传递给openStudySession:', {
        deckId,
        mode: 'advance',
        cardIdsCount: cardIds.length,
        cardIds: cardIds.map(id => id.slice(0, 8))
      });
      
      await plugin.openStudySession({
        deckId,
        mode: 'advance',
        cardIds
      });
      
      new Notice(t('deckStudyPage.studyActions.advanceStudyStarted', { count: String(advanceCards.length) }));
    } catch (error) {
      logger.error('[DeckStudyPage] 启动提前学习失败:', error);
      new Notice(t('deckStudyPage.studyActions.advanceStudyFailed'));
    }
  }

  //  已移除：processProgressiveClozeCards 批量处理函数
  // 原因：改为创建和编辑时自动处理（V2 架构：ProgressiveClozeGateway）
  // 移除日期：2025-12-03
  
  //  关闭庆祝模态窗
  function handleCloseCelebration() {
    showCelebrationModal = false;
    celebrationStats = null;
    celebrationDeckId = '';
  }
  
  //  开始考试模式
  async function handleStartPractice() {
    // 关闭庆祝模态窗
    showCelebrationModal = false;
    const deckId = celebrationDeckId;
    celebrationStats = null;
    celebrationDeckId = '';
    
    if (!deckId) {
      logger.error('[DeckStudyPage] 无法开始考试：缺少牌组ID');
      new Notice(t('deckStudyPage.exam.missingDeckInfo'));
      return;
    }
    
    try {
      logger.info('[DeckStudyPage] Starting exam mode from celebration modal, deckId:', deckId);
      
      // Check if question bank service is available
      if (!plugin.questionBankService) {
        logger.error('[DeckStudyPage] Question bank service not initialized');
        new Notice(t('deckStudyPage.exam.qbNotEnabled'));
        return;
      }
      
      //  调试日志：查看所有题库
      const allBanks = await plugin.questionBankService.getAllBanks();
      logger.info('[DeckStudyPage] 当前所有题库:', allBanks.map(b => ({
        id: b.id,
        name: b.name,
        deckType: b.deckType,
        pairedMemoryDeckId: (b.metadata as any)?.pairedMemoryDeckId
      })));
      
      logger.info('[DeckStudyPage] 🔍 详细匹配信息 (handleStartPractice):', {
        searchingForMemoryDeckId: deckId,
        searchingForMemoryDeckIdType: typeof deckId,
        allBanksWithPairing: allBanks.map(b => ({
          bankId: b.id,
          bankName: b.name,
          pairedMemoryDeckId: (b.metadata as any)?.pairedMemoryDeckId,
          pairedMemoryDeckIdType: typeof (b.metadata as any)?.pairedMemoryDeckId,
          strictEquals: (b.metadata as any)?.pairedMemoryDeckId === deckId,
          looseEquals: (b.metadata as any)?.pairedMemoryDeckId == deckId
        }))
      });
      
      //  关键修复：检查当前牌组是否本身就是题库牌组
      const currentDeck = await dataStorage.getDeck(deckId);
      logger.info('[DeckStudyPage] 当前牌组信息:', currentDeck ? {
        id: currentDeck.id,
        name: currentDeck.name,
        deckType: currentDeck.deckType,
        pairedMemoryDeckId: (currentDeck.metadata as any)?.pairedMemoryDeckId
      } : '未找到');
      
      let questionBank: Deck | null = null;
      
      // 如果当前牌组本身就是题库牌组，直接使用
      if (currentDeck && currentDeck.deckType === 'question-bank') {
        logger.info('[DeckStudyPage] ✅ 当前牌组本身就是题库牌组，直接使用');
        questionBank = currentDeck;
      } else {
        // 否则，将当前牌组ID作为记忆牌组ID，查找对应的题库牌组
        logger.info('[DeckStudyPage] 当前牌组是记忆牌组，查找对应的题库牌组');
        questionBank = await plugin.questionBankService.findBankByMemoryDeckId(deckId);
        
        logger.info('[DeckStudyPage] 查找结果:', questionBank ? {
          id: questionBank.id,
          name: questionBank.name,
          pairedMemoryDeckId: (questionBank.metadata as any)?.pairedMemoryDeckId
        } : '未找到');
      }
      
      if (!questionBank) {
        // 没有对应的考试牌组
        logger.info('[DeckStudyPage] 暂无该记忆牌组对应的考试牌组');
        new Notice(t('deckStudyPage.exam.noPairedBank'));
        return;
      }
      
      // Open exam session
      logger.info('[DeckStudyPage] Opening question bank:', questionBank.id, questionBank.name);
      await plugin.openQuestionBankSession({
        bankId: questionBank.id,
        bankName: questionBank.name
      });
      
    } catch (error) {
      logger.error('[DeckStudyPage] Failed to start exam:', error);
      new Notice(t('deckStudyPage.exam.startFailed'));
    }
  }
  
  // Close no-cards modal
  function handleCloseNoCardsModal() {
    showNoCardsModal = false;
  }
  
  // Start exam from no-cards modal
  async function handleStartPracticeFromNoCards() {
    showNoCardsModal = false;
    const deckId = noCardsCurrentDeckId;
    
    if (!deckId) {
      logger.error('[DeckStudyPage] Cannot start exam: missing deck ID');
      new Notice(t('deckStudyPage.exam.missingDeckInfo'));
      return;
    }
    
    try {
      logger.info('[DeckStudyPage] 从无卡片模态窗开始考试模式，牌组ID:', deckId);
      
      // 检查题库服务是否可用
      if (!plugin.questionBankService) {
        logger.error('[DeckStudyPage] 题库服务未初始化');
        new Notice(t('deckStudyPage.exam.qbNotEnabled'));
        return;
      }
      
      //  调试日志：查看所有题库
      const allBanks = await plugin.questionBankService.getAllBanks();
      logger.info('[DeckStudyPage] 当前所有题库:', allBanks.map(b => ({
        id: b.id,
        name: b.name,
        deckType: b.deckType,
        pairedMemoryDeckId: (b.metadata as any)?.pairedMemoryDeckId
      })));
      
      logger.info('[DeckStudyPage] 🔍 详细匹配信息 (handleStartPracticeFromNoCards):', {
        searchingForMemoryDeckId: deckId,
        searchingForMemoryDeckIdType: typeof deckId,
        allBanksWithPairing: allBanks.map(b => ({
          bankId: b.id,
          bankName: b.name,
          pairedMemoryDeckId: (b.metadata as any)?.pairedMemoryDeckId,
          pairedMemoryDeckIdType: typeof (b.metadata as any)?.pairedMemoryDeckId,
          strictEquals: (b.metadata as any)?.pairedMemoryDeckId === deckId,
          looseEquals: (b.metadata as any)?.pairedMemoryDeckId == deckId
        }))
      });
      
      //  关键修复：检查当前牌组是否本身就是题库牌组
      const currentDeck = await dataStorage.getDeck(deckId);
      logger.info('[DeckStudyPage] 当前牌组信息:', currentDeck ? {
        id: currentDeck.id,
        name: currentDeck.name,
        deckType: currentDeck.deckType,
        pairedMemoryDeckId: (currentDeck.metadata as any)?.pairedMemoryDeckId
      } : '未找到');
      
      let questionBank: Deck | null = null;
      
      // 如果当前牌组本身就是题库牌组，直接使用
      if (currentDeck && currentDeck.deckType === 'question-bank') {
        logger.info('[DeckStudyPage] ✅ 当前牌组本身就是题库牌组，直接使用');
        questionBank = currentDeck;
      } else {
        // 否则，将当前牌组ID作为记忆牌组ID，查找对应的题库牌组
        logger.info('[DeckStudyPage] 当前牌组是记忆牌组，查找对应的题库牌组');
        questionBank = await plugin.questionBankService.findBankByMemoryDeckId(deckId);
        
        logger.info('[DeckStudyPage] 查找结果:', questionBank ? {
          id: questionBank.id,
          name: questionBank.name,
          pairedMemoryDeckId: (questionBank.metadata as any)?.pairedMemoryDeckId
        } : '未找到');
      }
      
      if (!questionBank) {
        // 没有对应的考试牌组
        logger.info('[DeckStudyPage] 暂无该记忆牌组对应的考试牌组');
        new Notice(t('deckStudyPage.exam.noPairedBank'));
        return;
      }
      
      // Open exam session
      logger.info('[DeckStudyPage] Opening question bank:', questionBank.id, questionBank.name);
      await plugin.openQuestionBankSession({
        bankId: questionBank.id,
        bankName: questionBank.name
      });
      
    } catch (error) {
      logger.error('[DeckStudyPage] Failed to start exam:', error);
      new Notice(t('deckStudyPage.exam.startFailed'));
    }
  }
  
  // 🆕 提前学习回调
  async function handleAdvanceStudy() {
    showNoCardsModal = false;
    if (noCardsCurrentDeckId) {
      await startAdvanceStudy(noCardsCurrentDeckId);
    }
  }
  
  // 🆕 查看统计回调
  function handleViewStats() {
    showNoCardsModal = false;
    if (noCardsCurrentDeckId) {
      openDeckAnalytics(noCardsCurrentDeckId);
    }
  }
  
  // 🆕 格式化下次到期时间
  function formatNextDueTime(dueDate: Date): string {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 1) {
      const dateStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
      const timeStr = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
      return `${dateStr} ${timeStr}`;
    } else if (days === 1) {
      const timeStr = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
      return `${t('deckStudyPage.time.tomorrow')} ${timeStr}`;
    } else if (hours > 0) {
      return t('deckStudyPage.time.hoursLater', { hours: String(hours) });
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return t('deckStudyPage.time.minutesLater', { minutes: String(minutes) });
    }
  }

  async function handleStudyComplete(session: StudySession) {
    // 清理状态
    studyCards = [];
    
    // 🆕 刷新数据（学习完成后统计数据已变化）
    await refreshData();
    
    //  已移除旧的 CustomEvent 触发（Weave:refresh-decks）
    // 现在通过 DataSyncService 在 saveStudySession 时自动通知
    
    //  显示庆祝界面
    const deck = decks.find(d => d.id === session.deckId);
    if (deck) {
      const stats = deckStats[session.deckId];
      
      celebrationDeckName = deck.name;
      celebrationDeckId = session.deckId;
      celebrationStats = {
        reviewed: session.cardsReviewed || 0,
        studyTime: session.totalTime ? session.totalTime / 1000 : 0,
        memoryRate: stats?.memoryRate ?? 0.9,
        newCards: stats?.newCards ?? 0
      };
      showCelebrationModal = true;
      
      // 记录显示时间
      const lastShownKey = `celebration-last-shown-${session.deckId}`;
      vaultStorage.setItem(lastShownKey, Date.now().toString());
    }
  }

  //  closeStudyModal 已废弃 - 学习界面现在由 plugin.openStudySession() 管理
  // function closeStudyModal() {
  //   showStudyModal = false;
  //   studyCards = [];
  // }

  // 编辑牌组（包含牌组信息和标签编辑）
  async function editDeck(deckId: string) {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;
    
    //  移动端使用 Obsidian Modal API
    if (isMobile) {
      showEditDeckModalWithObsidianAPI(deck);
    } else {
      // 桌面端使用原有模态窗
      editingDeck = deck;
      showEditDeckModal = true;
    }
  }
  
  //  使用 Obsidian Modal API 显示编辑牌组模态窗
  function showEditDeckModalWithObsidianAPI(deck: Deck) {
    const modal = new Modal(plugin.app);
    
    modal.titleEl.setText(t('deckStudyPage.edit.title'));
    
    let newName = deck.name;
    let selectedTags = [...(deck.tags || [])];
    
    new Setting(modal.contentEl)
      .setName(t('deckStudyPage.editModal.deckName'))
      .setDesc(t('deckStudyPage.editModal.deckNameDesc'))
      .addText((text: any) => {
        text
          .setPlaceholder(t('deckStudyPage.editModal.deckNamePlaceholder'))
          .setValue(newName)
          .onChange((value: string) => {
            newName = value;
          });
        // 设置输入框样式
        text.inputEl.style.width = '100%';
      });
    
    // 标签编辑区域
    const tagSection = modal.contentEl.createDiv({ cls: 'tag-edit-section' });
    tagSection.style.marginTop = '16px';
    
    // 标签标题
    const tagHeader = tagSection.createDiv({ cls: 'tag-header' });
    tagHeader.style.display = 'flex';
    tagHeader.style.justifyContent = 'space-between';
    tagHeader.style.alignItems = 'center';
    tagHeader.style.marginBottom = '8px';
    
    const tagTitle = tagHeader.createEl('span', { text: t('deckStudyPage.editModal.tags') });
    tagTitle.style.fontWeight = '500';
    tagTitle.style.color = 'var(--text-normal)';
    
    // 添加标签按钮
    const addTagBtn = tagHeader.createEl('button', { text: t('deckStudyPage.editModal.addTag') });
    addTagBtn.style.fontSize = '12px';
    addTagBtn.style.padding = '4px 8px';
    addTagBtn.style.borderRadius = '4px';
    addTagBtn.style.border = '1px solid var(--background-modifier-border)';
    addTagBtn.style.background = 'var(--background-secondary)';
    addTagBtn.style.cursor = 'pointer';
    
    // 标签列表容器
    const tagListContainer = tagSection.createDiv({ cls: 'tag-list-container' });
    tagListContainer.style.display = 'flex';
    tagListContainer.style.flexWrap = 'wrap';
    tagListContainer.style.gap = '8px';
    tagListContainer.style.minHeight = '40px';
    tagListContainer.style.padding = '8px';
    tagListContainer.style.background = 'var(--background-secondary)';
    tagListContainer.style.borderRadius = '6px';
    
    // 渲染标签列表
    function renderTags() {
      tagListContainer.empty();
      
      if (selectedTags.length === 0) {
        const emptyHint = tagListContainer.createEl('span', { text: t('deckStudyPage.editModal.noTags') });
        emptyHint.style.color = 'var(--text-muted)';
        emptyHint.style.fontSize = '13px';
        return;
      }
      
      selectedTags.forEach((tag, index) => {
        const tagEl = tagListContainer.createDiv({ cls: 'tag-item' });
        tagEl.style.display = 'inline-flex';
        tagEl.style.alignItems = 'center';
        tagEl.style.gap = '4px';
        tagEl.style.padding = '4px 8px';
        tagEl.style.background = 'var(--interactive-accent)';
        tagEl.style.color = 'var(--text-on-accent)';
        tagEl.style.borderRadius = '12px';
        tagEl.style.fontSize = '13px';
        
        const tagText = tagEl.createEl('span', { text: tag });
        
        // 删除按钮
        const removeBtn = tagEl.createEl('span', { text: '×' });
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.marginLeft = '2px';
        removeBtn.style.fontWeight = 'bold';
        removeBtn.onclick = () => {
          selectedTags = selectedTags.filter((_, i) => i !== index);
          renderTags();
        };
      });
    }
    
    // 初始渲染
    renderTags();
    
    // 添加标签点击处理
    addTagBtn.onclick = () => {
      // 创建输入框
      const inputContainer = tagSection.createDiv({ cls: 'tag-input-container' });
      inputContainer.style.marginTop = '8px';
      inputContainer.style.display = 'flex';
      inputContainer.style.gap = '8px';
      
      const tagInput = inputContainer.createEl('input', { 
        type: 'text',
        placeholder: t('deckStudyPage.editModal.tagNamePlaceholder')
      });
      tagInput.style.flex = '1';
      tagInput.style.padding = '6px 10px';
      tagInput.style.borderRadius = '4px';
      tagInput.style.border = '1px solid var(--background-modifier-border)';
      tagInput.style.background = 'var(--background-primary)';
      
      const confirmBtn = inputContainer.createEl('button', { text: t('deckStudyPage.editModal.confirm') });
      confirmBtn.style.padding = '6px 12px';
      confirmBtn.style.borderRadius = '4px';
      confirmBtn.style.border = 'none';
      confirmBtn.style.background = 'var(--interactive-accent)';
      confirmBtn.style.color = 'var(--text-on-accent)';
      confirmBtn.style.cursor = 'pointer';
      
      const cancelInputBtn = inputContainer.createEl('button', { text: t('common.cancel') });
      cancelInputBtn.style.padding = '6px 12px';
      cancelInputBtn.style.borderRadius = '4px';
      cancelInputBtn.style.border = '1px solid var(--background-modifier-border)';
      cancelInputBtn.style.background = 'var(--background-secondary)';
      cancelInputBtn.style.cursor = 'pointer';
      
      // 聚焦输入框
      tagInput.focus();
      
      // 确定添加
      const addTag = () => {
        const newTag = tagInput.value.trim();
        if (newTag && !selectedTags.includes(newTag)) {
          selectedTags.push(newTag);
          renderTags();
        }
        inputContainer.remove();
      };
      
      confirmBtn.onclick = addTag;
      tagInput.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          addTag();
        }
      };
      cancelInputBtn.onclick = () => inputContainer.remove();
    };
    
    // 按钮容器
    const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '16px';
    
    // 取消按钮
    const cancelButton = buttonContainer.createEl('button', { text: t('common.cancel') });
    cancelButton.onclick = () => {
      modal.close();
    };
    
    const saveButton = buttonContainer.createEl('button', { 
      text: t('common.save'),
      cls: 'mod-cta'
    });
    saveButton.onclick = async () => {
      // 验证名称
      if (!newName.trim()) {
        new Notice(t('deckStudyPage.editModal.deckNameRequired'));
        return;
      }
      
      try {
        // 更新牌组
        const updatedDeck: Deck = {
          ...deck,
          name: newName.trim(),
          tags: selectedTags,
          modified: new Date().toISOString()
        };
        
        // 如果名称改变，需要更新路径
        if (newName.trim() !== deck.name) {
          const deckHierarchy = await waitForService(
            () => plugin?.deckHierarchy,
            'deckHierarchy',
            5000
          );
          // 更新路径
          if (deck.parentId) {
            const parent = decks.find(d => d.id === deck.parentId);
            updatedDeck.path = parent?.path ? `${parent.path}/${newName.trim()}` : newName.trim();
          } else {
            updatedDeck.path = newName.trim();
          }
        }
        
        await dataStorage.saveDeck(updatedDeck);
        await refreshData();
        
        // 通知全局侧边栏刷新
        plugin.app.workspace.trigger('Weave:data-changed');
        
        new Notice(t('deckStudyPage.notices.deckUpdated'));
        modal.close();
      } catch (error) {
        logger.error('[DeckStudyPage] Failed to update deck:', error);
        new Notice(`${t('deckStudyPage.editModal.updateFailed')}: ${error instanceof Error ? error.message : t('common.unknown')}`);
      }
    };
    
    modal.open();
  }

  async function deleteDeck(deckId: string) {
    try {
      //  等待 deckHierarchy 服务就绪
      const deckHierarchy = await waitForService(
        () => plugin?.deckHierarchy,
        'deckHierarchy',
        5000
      );
      
      // 获取牌组信息
      const deck = decks.find(d => d.id === deckId);
      if (!deck) {
        new Notice(t('deckStudyPage.notices.deckNotFound'));
        return;
      }
      
      const cardUUIDs = deck.cardUUIDs || [];
      const cardCount = cardUUIDs.length;
      
      let confirmMessage = t('deckStudyPage.deleteModal.confirmMessage', { name: deck.name });
      if (cardCount > 0) {
        confirmMessage += `\n\n${t('deckStudyPage.deleteModal.cardWarning', { count: String(cardCount) })}`;
      }
      confirmMessage += `\n\n${t('deckStudyPage.deleteModal.irreversible')}`;
      
      const modal = new Modal(plugin.app);
      modal.titleEl.setText(t('deckStudyPage.deleteModal.title'));
      
      // 创建消息内容（支持多行）
      const messageEl = modal.contentEl.createDiv({ cls: 'delete-confirm-message' });
      confirmMessage.split('\n').forEach(line => {
        messageEl.createEl('p', { text: line });
      });
      
      // 创建按钮容器
      const buttonContainer = modal.contentEl.createDiv({ cls: 'delete-confirm-buttons' });
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'flex-end';
      buttonContainer.style.gap = '10px';
      buttonContainer.style.marginTop = '16px';
      
      let shouldDelete = false;
      
      const cancelButton = buttonContainer.createEl('button', { text: t('common.cancel') });
      cancelButton.onclick = () => {
        modal.close();
      };
      
      const deleteButton = buttonContainer.createEl('button', { 
        text: t('deckStudyPage.deleteModal.confirmButton'),
        cls: 'mod-warning'
      });
      deleteButton.onclick = () => {
        shouldDelete = true;
        modal.close();
      };
      
      modal.onClose = async () => {
        if (!shouldDelete) return;
        
        try {
          if (cardUUIDs.length > 0) {
            // ===== 高效批量删除卡片 =====
            // 不使用 dataStorage.deleteCard（每卡逐一cascade极慢），
            // 而是分三步批量处理：
            
            const { ProgressModal } = await import('../../utils/progress-modal');
            const progress = new ProgressModal(plugin.app, {
              title: t('deckStudyPage.deleteModal.progressTitle'),
              description: t('deckStudyPage.deleteModal.progressDesc', { name: deck.name, count: String(cardCount) }),
              total: 3, // 三个阶段
              cancellable: false
            });
            progress.open();
            
            const cardUUIDSet = new Set(cardUUIDs);
            
            // 阶段 1/3: 从其他牌组批量移除对这些卡片的引用
            progress.updateProgress(0, t('deckStudyPage.deleteModal.cleaningRefs'));
            const otherDecks = await dataStorage.getDecks();
            for (const otherDeck of otherDecks) {
              if (otherDeck.id === deckId) continue;
              const before = otherDeck.cardUUIDs?.length || 0;
              if (before === 0) continue;
              otherDeck.cardUUIDs = (otherDeck.cardUUIDs || []).filter(uuid => !cardUUIDSet.has(uuid));
              if (otherDeck.cardUUIDs.length !== before) {
                otherDeck.modified = new Date().toISOString();
                await dataStorage.saveDeck(otherDeck);
                logger.debug(`[DeckStudyPage] 从牌组"${otherDeck.name}"移除了 ${before - otherDeck.cardUUIDs.length} 个引用`);
              }
            }
            progress.increment(t('deckStudyPage.deleteModal.refsCleaned'));
            
            // 阶段 2/3: 统一通过 dataStorage 删除，确保触发源文档清理
            progress.updateProgress(1, t('deckStudyPage.deleteModal.deletingCards'));
            const deleteResult = await dataStorage.deleteCards(cardUUIDs);
            const deletedCount = deleteResult.deleted.length;
            logger.info(`[DeckStudyPage] 统一批量删除完成: 成功${deleteResult.deleted.length}, 失败${deleteResult.failed.length}`);
            progress.increment(t('deckStudyPage.deleteModal.cardsDeleted'));
            
            // 阶段 3/3: 清理缓存和索引
            progress.updateProgress(2, t('deckStudyPage.deleteModal.cleaningCache'));
            if (plugin.cardMetadataCache) {
              for (const uuid of cardUUIDs) {
                plugin.cardMetadataCache.invalidate(uuid);
              }
            }
            if (plugin.cardIndexService) {
              for (const uuid of cardUUIDs) {
                plugin.cardIndexService.removeCardIndex(uuid);
              }
            }
            // 触发卡片删除事件
            for (const uuid of cardUUIDs) {
              plugin.app.workspace.trigger('Weave:card-deleted', uuid);
            }
            progress.increment(t('deckStudyPage.deleteModal.cacheCleaned'));
            
            progress.setComplete(t('deckStudyPage.deleteModal.deletedCount', { count: String(deletedCount) }));
            
            logger.info(`[DeckStudyPage] 删除牌组卡片完成: ${deletedCount}/${cardCount}`);
          }
          
          // 删除牌组本身
          await deckHierarchy.deleteDeckWithChildren(deckId);
          
          // 如果删除的是官方教程牌组，标记为跳过自动恢复
          const { GUIDE_DECK_NAME } = await import('../../data/guide-deck-data');
          if (deck.name === GUIDE_DECK_NAME && plugin.settings) {
            plugin.settings.skipGuideDeck = true;
            await plugin.saveSettings();
            logger.info('[DeckStudyPage] 用户删除了教程牌组，已标记 skipGuideDeck=true');
          }
          
          // 刷新数据
          decks = await dataStorage.getDecks();
          await refreshData();
          
          // 通知全局侧边栏刷新
          plugin.app.workspace.trigger('Weave:data-changed');
          
          const successMsg = cardCount > 0
            ? t('deckStudyPage.deleteModal.successWithCards', { name: deck.name, count: String(cardCount) })
            : t('deckStudyPage.deleteModal.success', { name: deck.name });
          new Notice(successMsg);
        } catch (error) {
          logger.error('[DeckStudyPage] Delete deck failed:', error);
          new Notice(`${t('deckStudyPage.deleteModal.failed')}: ${error instanceof Error ? error.message : t('common.unknown')}`);
        }
      };
      
      modal.open();
    } catch (error) {
      logger.error('[DeckStudyPage] Delete deck failed:', error);
      new Notice(`${t('deckStudyPage.deleteModal.failed')}: ${error instanceof Error ? error.message : t('common.unknown')}`);
    }
  }

  type RowMenuItem = { id: string; label: string; icon?: string; onClick: () => void };

  // 🆕 v2.0 解散牌组（引用式牌组系统）
  async function dissolveDeck(deckId: string) {
    try {
      // 检查引用式牌组服务是否可用
      if (!plugin.referenceDeckService) {
        new Notice(t('deckStudyPage.dissolve.serviceNotInit'));
        return;
      }
      
      const deck = decks.find(d => d.id === deckId);
      if (!deck) {
        new Notice(t('deckStudyPage.notices.deckNotFound'));
        return;
      }
      
      const cardCount = deck.cardUUIDs?.length || 0;
      
      // 使用 Obsidian Modal 确认
      const modal = new Modal(plugin.app);
      modal.titleEl.setText(t('deckStudyPage.dissolve.title'));
      
      // 创建消息内容
      const messageEl = modal.contentEl.createDiv({ cls: 'dissolve-confirm-message' });
      messageEl.createEl('p', { text: t('deckStudyPage.dissolve.confirmMessage', { name: deck.name }) });
      messageEl.createEl('p', { 
        text: t('deckStudyPage.dissolve.cardCount', { count: String(cardCount) }),
        cls: 'dissolve-card-count'
      });
      messageEl.createEl('p', { 
        text: t('deckStudyPage.dissolve.warning'),
        cls: 'dissolve-warning'
      });
      
      // 创建按钮容器
      const buttonContainer = modal.contentEl.createDiv({ cls: 'dissolve-confirm-buttons' });
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'flex-end';
      buttonContainer.style.gap = '10px';
      buttonContainer.style.marginTop = '16px';
      
      let shouldDissolve = false;
      
      const cancelButton = buttonContainer.createEl('button', { text: t('common.cancel') });
      cancelButton.onclick = () => {
        modal.close();
      };
      
      const dissolveButton = buttonContainer.createEl('button', { 
        text: t('deckStudyPage.dissolve.confirmButton'),
        cls: 'mod-warning'
      });
      dissolveButton.onclick = () => {
        shouldDissolve = true;
        modal.close();
      };
      
      modal.onClose = async () => {
        if (!shouldDissolve) return;
        
        try {
          new Notice(t('deckStudyPage.dissolve.inProgress'));
          
          const result = await plugin.referenceDeckService!.dissolveDeck(deckId);
          
          if (!result.success) {
            throw new Error(result.error || t('deckStudyPage.dissolve.failed'));
          }
          
          // 刷新数据
          decks = await dataStorage.getDecks();
          await refreshData();
          
          // 通知全局侧边栏刷新
          plugin.app.workspace.trigger('Weave:data-changed');
          
          let message = t('deckStudyPage.dissolve.success', { name: deck.name });
          if (result.orphanedCards.length > 0) {
            message += t('deckStudyPage.dissolve.orphanedCards', { count: String(result.orphanedCards.length) });
          }
          new Notice(message);
        } catch (error) {
          logger.error('[DeckStudyPage] Dissolve deck failed:', error);
          new Notice(`${t('deckStudyPage.dissolve.failed')}: ${error instanceof Error ? error.message : t('common.unknown')}`);
        }
      };
      
      modal.open();
    } catch (error) {
      logger.error('[DeckStudyPage] Dissolve deck failed:', error);
      new Notice(`${t('deckStudyPage.dissolve.failed')}: ${error instanceof Error ? error.message : t('common.unknown')}`);
    }
  }


  // 创建子牌组和移动牌组功能已移除 - 不再支持父子牌组层级结构

  //  打开牌组分析
  async function openDeckAnalytics(deckId: string) {
    try {
      // 🆕 v2.0: 引用式牌组架构 - 优先使用 deck.cardUUIDs
      const deck = decks.find(d => d.id === deckId);
      let deckCards: Card[];
      if (deck?.cardUUIDs?.length) {
        const uuidSet = new Set(deck.cardUUIDs);
        deckCards = allCards.filter(card => uuidSet.has(card.uuid));
      } else {
        // 回退到 card.referencedByDecks 或 card.deckId
        deckCards = allCards.filter(card => 
          card.referencedByDecks?.includes(deckId) || card.deckId === deckId
        );
      }
      
      analyticsDeckId = deckId;
      analyticsDeckCards = deckCards;
      showDeckAnalyticsModal = true;
      
      logger.debug('[DeckStudyPage] 打开牌组分析:', { deckId, cardCount: deckCards.length });
    } catch (error) {
      logger.error('[DeckStudyPage] 打开牌组分析失败:', error);
      new Notice(t('deckStudyPage.analyticsAction.openFailed'));
    }
  }

  // 关闭牌组分析
  function closeDeckAnalytics() {
    showDeckAnalyticsModal = false;
    analyticsDeckId = undefined;
    analyticsDeckCards = [];
  }


  // 使用 Obsidian 原生 Menu
  function showDeckMenu(event: MouseEvent, deckId: string) {
    const menu = new Menu();
    
    // 获取牌组信息以判断是否为子牌组
    const deck = decks.find(d => d.id === deckId);
    const isSubdeck = deck?.parentId != null;

    // 🆕 提前学习功能
    menu.addItem((item) =>
      item
        .setTitle(t('deckStudyPage.contextMenu.advanceStudy'))
        .setIcon("fast-forward")
        .onClick(async () => await startAdvanceStudy(deckId))
    );

    //  已移除：渐进式挖空批量处理菜单项
    // 原因：改为自动处理，无需手动触发

    //  牌组分析
    menu.addItem((item) =>
      item
        .setTitle(t('deckStudyPage.contextMenu.deckAnalytics'))
        .setIcon("bar-chart-2")
        .onClick(() => openDeckAnalytics(deckId))
    );

    menu.addSeparator();

    // 创建子牌组和移动牌组功能已移除 - 不再支持父子牌组层级结构

    menu.addItem((item) =>
      item
        .setTitle(t('deckStudyPage.contextMenu.editDeck'))
        .setIcon("edit")
        .onClick(() => editDeck(deckId))
    );

    menu.addItem((item) =>
      item
        .setTitle(t('deckStudyPage.contextMenu.delete'))
        .setIcon("trash-2")
        .onClick(() => deleteDeck(deckId))
    );

    // 🆕 v2.0 解散牌组（引用式牌组系统）
    menu.addItem((item) =>
      item
        .setTitle(t('deckStudyPage.contextMenu.dissolveDeck'))
        .setIcon("unlink")
        .onClick(() => dissolveDeck(deckId))
    );

    menu.addSeparator();


    menu.showAtMouseEvent(event);
  }

  // 展开/折叠功能
  function toggleExpand(deckId: string) {
    if (expandedDeckIds.has(deckId)) {
      expandedDeckIds.delete(deckId);
    } else {
      expandedDeckIds.add(deckId);
    }
    expandedDeckIds = new Set(expandedDeckIds);
    
    // 保存到 localStorage
    saveExpandedState();
  }

  function isExpanded(deckId: string): boolean {
    return expandedDeckIds.has(deckId);
  }

  // 保存展开状态到 localStorage
  function saveExpandedState() {
    try {
      const stateArray = Array.from(expandedDeckIds);
      vaultStorage.setItem('weave-deck-expanded-state', JSON.stringify(stateArray));
    } catch (error) {
      logger.error('Failed to save expanded state:', error);
    }
  }

  // 从 localStorage 加载展开状态
  function loadExpandedState() {
    try {
      const saved = vaultStorage.getItem('weave-deck-expanded-state');
      if (saved) {
        const stateArray = JSON.parse(saved);
        expandedDeckIds = new Set(stateArray);
      }
    } catch (error) {
      logger.error('Failed to load expanded state:', error);
      expandedDeckIds = new Set();
    }
  }

  // 递归计算牌组总卡片数（包含子牌组）
  function getTotalCards(node: DeckTreeNode): number {
    const stats = deckStats[node.deck.id] || { newCards: 0, learningCards: 0, reviewCards: 0 };
    let total = stats.newCards + stats.learningCards + stats.reviewCards;
    
    for (const child of node.children) {
      total += getTotalCards(child);
    }
    
    return total;
  }

  // 递归计算子牌组的统计（不包含自己）
  function getSubdeckStats(node: DeckTreeNode): { newCards: number; learningCards: number; reviewCards: number } {
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;

    for (const child of node.children) {
      const childStats = deckStats[child.deck.id] || { newCards: 0, learningCards: 0, reviewCards: 0 };
      newCards += childStats.newCards;
      learningCards += childStats.learningCards;
      reviewCards += childStats.reviewCards;

      // 递归累加子牌组的子牌组
      const subStats = getSubdeckStats(child);
      newCards += subStats.newCards;
      learningCards += subStats.learningCards;
      reviewCards += subStats.reviewCards;
    }

    return { newCards, learningCards, reviewCards };
  }

  // 获取总统计（本牌组 + 所有子牌组）
  function getTotalStats(node: DeckTreeNode): { newCards: number; learningCards: number; reviewCards: number; total: number } {
    const ownStats = deckStats[node.deck.id] || { newCards: 0, learningCards: 0, reviewCards: 0 };
    const subStats = getSubdeckStats(node);

    const newCards = ownStats.newCards + subStats.newCards;
    const learningCards = ownStats.learningCards + subStats.learningCards;
    const reviewCards = ownStats.reviewCards + subStats.reviewCards;

    return {
      newCards,
      learningCards,
      reviewCards,
      total: newCards + learningCards + reviewCards
    };
  }


  // 初始化加载牌组和卡片
  // 初始化数据加载
  $effect(() => {
    (async () => {
      try {
        isLoading = true;
        await refreshData();
      } catch (error) {
        logger.error('[DeckStudyPage] ❌ 初始化失败:', error);
        // 即使初始化失败，也不阻止组件渲染
        // 用户可以通过手动刷新重试
      } finally {
        isLoading = false;
      }
    })();
  });

  //  已移除旧的 CustomEvent 监听器（Weave:refresh-decks）
  // 现在使用 DataSyncService 在 onMount 中统一订阅数据变更

  // 监听导航栏功能键事件
  $effect(() => {
    const handleCreateDeck = () => {
      showCreateDeckModal = true;
    };

    const handleMoreActions = (e: Event) => {
      // 从 CustomEvent 中获取原始鼠标事件
      const customEvent = e as CustomEvent<{ event: MouseEvent }>;
      const mouseEvent = customEvent.detail?.event;
      if (mouseEvent) {
        showMoreActionsMenu(mouseEvent);
      }
    };

    // 🆕 处理 APKG 导入
    const handleAPKGImport = () => {
      showAPKGImportModal = true;
    };

    // 🆕 处理 CSV 导入（使用新的CSVImportModal向导）
    const handleCSVImport = () => {
      showCSVImportModal = true;
    };

    // 粘贴卡片批量导入
    const handleClipboardImport = () => {
      showClipboardImportModal = true;
    };

    // 🆕 处理 JSON 导出
    const handleJSONExport = () => {
      exportDeck();
    };

    // 恢复官方教程牌组（来自 SidebarNavHeader 操作管理子菜单）
    const handleRestoreGuideDeck = async () => {
      const success = await dataStorage.restoreGuideDeck();
      if (success) {
        await refreshData();
        plugin.app.workspace.trigger('Weave:data-changed');
        new Notice(t('deckStudyPage.notices.tutorialRestored'));
      } else {
        new Notice(t('deckStudyPage.notices.tutorialRestoreFailed'));
      }
    };

    // 打开设置（来自 SidebarNavHeader）
    const handleOpenSettings = () => {
      safeOpenSettings(plugin.app, 'weave');
    };

    document.addEventListener('create-deck', handleCreateDeck);
    document.addEventListener('more-actions', handleMoreActions);
    document.addEventListener('apkg-import', handleAPKGImport);
    document.addEventListener('csv-import', handleCSVImport);
    document.addEventListener('clipboard-import', handleClipboardImport);
    document.addEventListener('json-export', handleJSONExport);
    document.addEventListener('Weave:restore-guide-deck', handleRestoreGuideDeck);
    document.addEventListener('Weave:open-settings', handleOpenSettings);

    return () => {
      document.removeEventListener('create-deck', handleCreateDeck);
      document.removeEventListener('more-actions', handleMoreActions);
      document.removeEventListener('apkg-import', handleAPKGImport);
      document.removeEventListener('csv-import', handleCSVImport);
      document.removeEventListener('clipboard-import', handleClipboardImport);
      document.removeEventListener('json-export', handleJSONExport);
      document.removeEventListener('Weave:restore-guide-deck', handleRestoreGuideDeck);
      document.removeEventListener('Weave:open-settings', handleOpenSettings);
    };
  });



  function getUrgencyLevel(stats: any): 'urgent' | 'due' | 'completed' | 'normal' {
    if (!stats) return 'normal';

    const reviewCards = stats.reviewCards ?? 0;
    const newCards = stats.newCards ?? 0;
    const learningCards = stats.learningCards ?? 0;

    if (reviewCards > 10) return 'urgent';
    if (reviewCards > 0 || learningCards > 0) return 'due';
    if (newCards === 0 && reviewCards === 0 && learningCards === 0) return 'completed';
    return 'normal';
  }


</script>

{#snippet deckNode(node: DeckTreeNode, depth: number)}
  {@const stats = deckStats[node.deck.id]}
  {@const totalDue = (stats?.newCards ?? 0) + (stats?.learningCards ?? 0) + (stats?.reviewCards ?? 0)}
  {@const urgencyLevel = getUrgencyLevel(stats)}
  {@const hasChildren = node.children.length > 0}
  {@const expanded = isExpanded(node.deck.id)}

  <div
    class="new-deck-row anki-font-interface"
    class:urgent={urgencyLevel === 'urgent'}
    class:due={urgencyLevel === 'due'}
    class:completed={totalDue === 0}
    class:has-children={hasChildren}
    style="padding-left: {depth * 24}px"
    role="button"
    tabindex="0"
    oncontextmenu={(e) => {
      e.preventDefault();
      showDeckMenu(e, node.deck.id);
    }}
  >
    <!-- 展开/折叠按钮 -->
    <div class="row-deck-name">
      {#if hasChildren}
        <button
          class="expand-toggle"
          onclick={(e) => {
            e.stopPropagation();
            toggleExpand(node.deck.id);
          }}
          aria-label={expanded ? t('deckStudyPage.studyActions.collapse') : t('deckStudyPage.studyActions.expand')}
        >
          <ObsidianIcon 
            name={expanded ? "chevron-down" : "chevron-right"} 
            size={14} 
          />
        </button>
      {:else}
        <span class="expand-spacer"></span>
      {/if}

      <div class="deck-name-content">
        {#if node.deck.icon}
          <span class="deck-emoji">{node.deck.icon}</span>
        {/if}
        <span class="deck-name">{node.deck.name}</span>
        
        <!-- 牌组类型徽章 -->
        {#if node.deck.deckType === 'choice-only'}
          <span class="choice-deck-badge">
            <ObsidianIcon name="check-square" size={12} />
            <span>{t('deckStudyPage.deckTypes.choice')}</span>
          </span>
        {/if}
        
        <!-- 子牌组统计气泡（仅当有子牌组时显示） -->
        {#if hasChildren}
          {@const totalStats = getTotalStats(node)}
          {@const subStats = getSubdeckStats(node)}
          {@const subTotal = subStats.newCards + subStats.learningCards + subStats.reviewCards}
          {#if subTotal > 0}
            <span class="subdeck-indicator" title={t('deckStudyPage.subdeck.indicator', { total: String(subTotal), newCards: String(subStats.newCards), learning: String(subStats.learningCards), review: String(subStats.reviewCards) })}>
              +{subTotal}
            </span>
          {/if}
        {/if}
        
        {#if urgencyLevel === 'urgent'}
          <span class="deck-status urgent">{t('deckStudyPage.urgency.urgent')}</span>
        {:else if totalDue === 0}
          <span class="deck-status completed">{t('deckStudyPage.urgency.completed')}</span>
        {/if}
      </div>
    </div>

    <!-- 统计数据区域（仅显示本牌组的统计） -->
    <div class="row-stat new-cards">
      <span class="stat-number">{stats?.newCards ?? 0}</span>
    </div>
    <div class="row-stat learning-cards">
      <span class="stat-number">{stats?.learningCards ?? 0}</span>
    </div>
    <div class="row-stat review-cards">
      <span class="stat-number">{stats?.reviewCards ?? 0}</span>
    </div>

    <!-- 操作 -->
    <div class="row-actions">
      <div class="deck-actions">
        {#if totalDue > 0}
          <button
            class="study-button primary"
            onclick={() => startStudy(node.deck.id)}
          >
            <ObsidianIcon name="play" size={16} />
            {t('deckStudyPage.studyActions.studyButton')} ({totalDue})
          </button>
        {:else}
          <button
            class="study-button completed"
            disabled
          >
            <ObsidianIcon name="check" size={16} />
            {t('deckStudyPage.studyActions.completedButton')}
          </button>
        {/if}

        <button
          class="icon-button menu-button"
          onclick={(e) => {
            e.stopPropagation();
            showDeckMenu(e, node.deck.id);
          }}
          aria-label={t('deckStudyPage.moreActions')}
        >
          <EnhancedIcon name="more-horizontal" size={16} />
        </button>
      </div>
    </div>
  </div>

  <!-- 递归渲染子节点 -->
  {#if expanded && hasChildren}
    {#each node.children as child}
      {@render deckNode(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<div class="anki-app deck-study-page">
  <!--  移动端头部组件 -->
  {#if isMobile}
    <MobileDeckStudyHeader
      {selectedFilter}
      onMenuClick={handleMobileMenuClick}
      onFilterSelect={handleFilterSelect}
      showKanbanSettings={currentView === 'kanban'}
      onKanbanSettingsClick={(evt) => {
        window.dispatchEvent(new CustomEvent('Weave:open-deck-kanban-menu', {
          detail: { x: evt.clientX, y: evt.clientY, filter: selectedFilter }
        }));
      }}
    />
  {/if}

  <!--  加载动画 - 全屏显示 -->
  {#if isLoading}
    <div class="deck-loading-overlay">
      <BouncingBallsLoader message={t('deckStudyPage.studyActions.loading')} />
    </div>
  {:else}
  <div class="deck-study-content">
    <!-- 看板视图：三种模式统一支持 -->
    {#if currentView === 'kanban'}
      <KanbanView 
        deckTree={selectedFilter === 'question-bank' ? qbDeckTree : selectedFilter === 'incremental-reading' ? irDeckTree : deckTree}
        deckStats={selectedFilter === 'question-bank' ? qbDeckStats : selectedFilter === 'incremental-reading' ? irDeckStats : deckStats}
        deckMode={selectedFilter === 'question-bank' ? 'question-bank' : selectedFilter === 'incremental-reading' ? 'incremental-reading' : 'memory'}
        {dataStorage}
        {plugin}
        onStartStudy={kanbanStartStudy}
        onDeckUpdate={refreshData}
        onEditDeck={kanbanEditDeck}
        onDeleteDeck={kanbanDeleteDeck}
        onDissolveDeck={selectedFilter === 'memory' ? dissolveDeck : undefined}
      />
    <!-- 非看板视图：按模式分别渲染 -->
    {:else if selectedFilter === 'incremental-reading'}
      <IRDeckView 
        {plugin}
        onStartReading={async (deckPath, blocks, deckName, focusStats) => {
          logger.info('[DeckStudyPage] ========== onStartReading 回调开始 ==========');
          logger.info('[DeckStudyPage] 开始增量阅读:', deckPath, '块数:', blocks.length, '牌组名:', deckName);
          try {
            await plugin.openIRFocusView(deckPath, blocks, deckName, focusStats);
            logger.info('[DeckStudyPage] openIRFocusView 调用成功（完整界面）');
          } catch (error) {
            logger.error('[DeckStudyPage] openIRFocusView 调用失败:', error);
          }
          logger.info('[DeckStudyPage] ========== onStartReading 回调结束 ==========');
        }}
      />
    {:else if currentView === 'grid'}
      <GridCardView 
        {deckTree}
        {deckStats}
        {studySessions}
        {plugin}
        {selectedFilter}
        onFilterSelect={handleFilterSelect}
        onStartStudy={startStudy}
        onContinueStudy={handleContinueStudy}
        onAdvanceStudy={startAdvanceStudy}
        onOpenDeckAnalytics={openDeckAnalytics}
        onEditDeck={editDeck}
        onDeleteDeck={deleteDeck}
        onDissolveDeck={dissolveDeck}
        onRefreshData={refreshData}
      />
    {/if}
  </div>
  {/if}

  <!--  移动端导航菜单已改用 Obsidian Menu API，不再使用 MobileNavMenu 组件 -->
</div>

<!--  学习模态窗已移除 - 现在使用 plugin.openStudySession() -->
<!-- 
  学习界面现在通过 plugin.openStudySession() 打开（标签页模式）
-->
<!-- 
{#if showStudyModal}
  <StudyInterface
    cards={studyCards}
    {fsrs}
    {dataStorage}
    {plugin}
    onClose={closeStudyModal}
    onComplete={handleStudyComplete}
  />
{/if}
-->


<!-- 编辑牌组模态窗（复用 CreateDeckModal 的编辑模式） -->
{#if showEditDeckModal && editingDeck}
  <CreateDeckModal
    open={showEditDeckModal}
    {plugin}
    {dataStorage}
    mode="edit"
    initialDeck={editingDeck}
    onClose={() => { showEditDeckModal = false; editingDeck = null; }}
    onUpdated={async () => { showEditDeckModal = false; editingDeck = null; await refreshData(); plugin.app.workspace.trigger('Weave:data-changed'); }}
  />
{/if}

<!-- 新建牌组模态窗 -->
{#if showCreateDeckModal}
  <CreateDeckModal
    open={showCreateDeckModal}
    {plugin}
    {dataStorage}
    onClose={() => { 
      showCreateDeckModal = false; 
    }}
    onCreated={async () => { 
      showCreateDeckModal = false; 
      await refreshData(); 
    }}
  />
{/if}

<!-- APKG导入模态窗 -->
{#if showAPKGImportModal}
  <APKGImportModal
    show={showAPKGImportModal}
    {plugin}
    {dataStorage}
    wasmUrl="https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.wasm"
    onClose={() => { showAPKGImportModal = false; }}
    onImportComplete={handleAPKGImportComplete}
  />
{/if}

<!-- CSV导入向导模态窗 -->
{#if showCSVImportModal}
  <CSVImportModal
    bind:open={showCSVImportModal}
    {plugin}
    {dataStorage}
    onClose={() => { showCSVImportModal = false; }}
    onImportComplete={async () => { showCSVImportModal = false; await refreshData(); plugin.app.workspace.trigger('Weave:data-changed'); }}
  />
{/if}

<!-- 粘贴卡片批量导入模态窗 -->
{#if showClipboardImportModal}
  <ClipboardImportModal
    bind:open={showClipboardImportModal}
    {plugin}
    {dataStorage}
    onClose={() => { showClipboardImportModal = false; }}
    onImportComplete={async () => { showClipboardImportModal = false; await refreshData(); plugin.app.workspace.trigger('Weave:data-changed'); }}
  />
{/if}

<!--  庆祝模态窗 -->
{#if showCelebrationModal && celebrationStats}
  <CelebrationModal
    deckName={celebrationDeckName}
    deckId={celebrationDeckId}
    stats={celebrationStats}
    soundEnabled={true}
    onClose={handleCloseCelebration}
    onStartPractice={handleStartPractice}
  />
{/if}

<!-- 🆕 无卡片提示模态窗 -->
{#if showNoCardsModal}
  <NoCardsAvailableModal
    deckName={noCardsDeckName}
    reason={noCardsReason}
    stats={noCardsStats}
    onClose={handleCloseNoCardsModal}
    onAdvanceStudy={handleAdvanceStudy}
    onViewStats={handleViewStats}
    onStartPractice={handleStartPracticeFromNoCards}
  />
{/if}

<!--  牌组分析模态窗 -->
{#if showDeckAnalyticsModal}
  <DeckAnalyticsModal
    open={showDeckAnalyticsModal}
    {plugin}
    deckId={analyticsDeckId}
    cards={analyticsDeckCards}
    onClose={closeDeckAnalytics}
  />
{/if}


<!--  激活提示 -->
<ActivationPrompt
  featureId={promptFeatureId}
  visible={showActivationPrompt}
  onClose={() => showActivationPrompt = false}
/>

<style>
  .deck-study-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    overflow: hidden;
    /*  不需要 position: relative，庆祝模态窗使用 fixed 定位 */
    min-height: 100vh;
  }

  /*  加载覆盖层 */
  .deck-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--background-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-top);
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .deck-study-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    overflow: hidden;
  }

  /*  移动端内容区间距优化 */
  :global(body.is-mobile) .deck-study-content {
    padding: 4px 2px; /* 🔧 减少内容区与标签页的间距 */
  }

  /*  已移除未使用的CSS：.deck-list-container, .category-filter-wrapper, .deck-list-body */
  /* 原因：这些类在HTML中未被使用，属于旧设计残留 */

  /*  已移除未使用的CSS：.new-deck-header, .header-deck-name, .header-stat, .header-actions */
  /* 原因：这些表头样式在HTML中未被使用，属于旧表格设计残留 */


  /* 卡片化数据行样式 - CSS Table布局 */
  .new-deck-row {
    display: table !important; /* 强制table布局 */
    width: 100%;
    table-layout: fixed; /* 固定表格布局，与header保持一致 */
    padding: 8px 12px; /* 减少外层padding，避免与cell padding重复 */
    border-bottom: none;
    transition: all 0.2s ease;
    background: var(--background-primary);
    position: relative;
    border-radius: 8px;
    margin-bottom: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    border-collapse: separate; /* 确保table布局正常 */
    border-spacing: 0; /* 消除cell间距 */
  }

  .new-deck-row:hover {
    background: var(--background-modifier-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  /* 卡片化状态指示 - 保持状态样式 */
  .new-deck-row.urgent {
    background: linear-gradient(135deg, var(--background-primary) 0%, rgba(239, 68, 68, 0.03) 100%);
    border: 1px solid rgba(239, 68, 68, 0.1);
    box-shadow: 0 1px 3px rgba(239, 68, 68, 0.1); /* 状态色阴影 */
  }

  .new-deck-row.due {
    background: linear-gradient(135deg, var(--background-primary) 0%, rgba(245, 158, 11, 0.03) 100%);
    border: 1px solid rgba(245, 158, 11, 0.1);
    box-shadow: 0 1px 3px rgba(245, 158, 11, 0.1); /* 状态色阴影 */
  }

  .new-deck-row.completed {
    background: linear-gradient(135deg, var(--background-primary) 0%, rgba(16, 185, 129, 0.03) 100%);
    border: 1px solid rgba(16, 185, 129, 0.1);
    box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1); /* 状态色阴影 */
  }

  /* 牌组名称区域 */
  .row-deck-name {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* 展开/折叠按钮 */
  .expand-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .expand-toggle:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .expand-spacer {
    display: inline-block;
    width: 20px;
    flex-shrink: 0;
  }

  .deck-emoji {
    font-size: 1rem;
    line-height: 1;
    margin-right: 0.25rem;
  }

  .deck-name-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .deck-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  /* 子牌组统计气泡 */
  .subdeck-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem 0.375rem;
    margin-left: 0.5rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: help;
    transition: all 0.2s ease;
    opacity: 0.75;
  }

  .subdeck-indicator:hover {
    opacity: 1;
    transform: scale(1.05);
  }

  /* 菜单按钮 - Cursor 风格圆形设计 */
  .menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.2s ease;
    opacity: 0.6;
  }

  .menu-button:hover {
    opacity: 1;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .menu-button:active {
    transform: scale(0.95);
    background: var(--background-modifier-active);
  }

  .deck-status {
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .deck-status.urgent {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .deck-status.completed {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }


  /* 数据行元素 - Table Cell布局 */
  .row-deck-name,
  .row-stat,
  .row-actions {
    display: table-cell !important; /* 强制覆盖其他样式 */
    vertical-align: middle;
    border: none; /* 确保无边框干扰 */
    position: static !important; /* 防止position干扰table布局 */
    float: none !important; /* 防止float干扰table布局 */
    /* 移除通用padding，使用各自的精确padding设置 */
  }

  .row-deck-name {
    width: 60%; /* 与header保持一致的宽度 */
    text-align: left;
    padding: 4px 0px 4px 8px; /* 右侧无padding，直接贴合统计列 */
  }

  .row-stat {
    width: 8%; /* 与header保持一致的宽度 */
    text-align: center;
    font-weight: 600;
    font-size: 0.9rem;
    padding: 4px 2px; /* 最小padding，节省空间 */
  }

  .row-actions {
    width: 16%; /* 与header保持一致的宽度 */
    text-align: right;
    padding: 4px 8px 4px 0px; /* 左侧无padding，贴合统计列 */
  }

  .row-stat.new-cards .stat-number {
    color: #3b82f6;
  }

  .row-stat.learning-cards .stat-number {
    color: #f59e0b;
  }

  .row-stat.review-cards .stat-number {
    color: #10b981;
  }


  .deck-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end; /* 确保按钮右对齐在操作列内 */
    gap: 0.5rem;
    width: 100%; /* 确保占满table-cell宽度 */
  }

  .study-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .study-button.primary {
    background: #3b82f6;
    color: white;
  }

  .study-button.primary:hover {
    background: #2563eb;
  }

  .study-button.completed {
    background: var(--background-modifier-border);
    color: var(--text-muted);
    cursor: not-allowed;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .row-deck-name {
      width: 55%; /* 中屏幕：保持名称列的最大化利用 */
    }

    .row-stat {
      width: 9%; /* 中屏幕：统计列适中宽度 */
    }

    .row-actions {
      width: 18%; /* 中屏幕：压缩操作列为名称列让出空间 */
    }

    .deck-name {
      font-size: 0.85rem;
    }

    .deck-status {
      font-size: 0.65rem;
      padding: 0.1rem 0.4rem;
    }

    .study-button {
      padding: 0.4rem 0.8rem;
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .new-deck-row {
      padding: 0.75rem;
    }

    .row-deck-name {
      width: 50%; /* 小屏幕：仍然最大化利用名称空间 */
    }

    .row-stat {
      width: 10%; /* 小屏幕：统计列保持紧凑 */
    }

    .row-actions {
      width: 20%; /* 小屏幕：压缩操作列 */
    }

    .deck-actions {
      flex-direction: column;
      gap: 0.25rem;
    }

    .study-button {
      padding: 0.375rem 0.75rem;
      font-size: 0.7rem;
    }
  }


  .stat-number {
    font-weight: 600;
    font-size: 1.125rem;
  }

  /*  已移除未使用的CSS：.mode-placeholder, .placeholder-icon, .placeholder-title, .placeholder-desc */
  /* 原因：这些占位样式在HTML中未被使用 */ 

</style>
