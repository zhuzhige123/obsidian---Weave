<script lang="ts">
  import { logger } from '../../utils/logger';
  import { vaultStorage } from '../../utils/vault-local-storage';

  import type { WeaveDataStorage } from "../../data/storage";
  import type { FSRS } from "../../algorithms/fsrs";
  import type { WeavePlugin } from "../../main";

  import type { Card, Deck } from "../../data/types";
  import type { TimeFilterType } from "../../types/time-filter-types";
  import { MarkdownView, Platform, Menu, TFile, Modal, FuzzySuggestModal } from "obsidian";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import EnhancedButton from "../ui/EnhancedButton.svelte";
  import BouncingBallsLoader from "../ui/BouncingBallsLoader.svelte";
  import FloatingMenu from "../ui/FloatingMenu.svelte";
  import WeaveCardTable from "../tables/WeaveCardTable.svelte";
  import TableSortingOverlay from "../tables/components/TableSortingOverlay.svelte";
  import KanbanView from "../study/KanbanView.svelte";
  import GridView from "../views/GridView.svelte";
  import MasonryGridView from "../views/MasonryGridView.svelte";
  import SavedFilterBar from "../filters/SavedFilterBar.svelte";
  import WeaveBatchToolbar from "../batch/WeaveBatchToolbar.svelte";
  // BatchTemplateChangeModal 已删除（基于弃用的字段模板系统）
  // BatchDeckChangeModal、BatchRemoveTagsModal、BatchAddTagsModal 已改用 Obsidian Menu API
  // v2.0 引用式牌组系统模态窗
  import BuildDeckModal from "../modals/BuildDeckModal.svelte";
  // v2.0 增量阅读牌组模态窗
  import BuildIRDeckModal from "../modals/BuildIRDeckModal.svelte";
  // v2.2 数据管理模态窗
  import DataManagementModal from "../modals/DataManagementModal.svelte";
  // EditCardModal 已改为全局方法，不再局部导入
  import { EmbeddableEditorManager } from "../../services/editor/EmbeddableEditorManager";

  import ColumnManager from "../ui/ColumnManager.svelte";
  import TablePagination from "../ui/TablePagination.svelte";
  import { DEFAULT_COLUMN_ORDER, type ColumnOrder, type ColumnKey } from "../tables/types/table-types";

  import { ICON_NAMES } from "../../icons/index.js";
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { waitForServiceReady } from "../../utils/service-ready-event";

  import { getCardContentBySide, generateUUID } from "../../utils/helpers";
  import { showNotification } from "../../utils/notifications";
  // FieldTemplate 类型已删除（基于弃用的字段模板系统）
  // FSRS复习数据工具
  import { deriveReviewData, getCardModifiedTime } from "../../utils/card-review-data-utils";
  
  // 源文档路径匹配工具
  import { 
    matchesSourceDocument, 
    filterCardsBySourceDocument,
    extractSourcePath 
  } from "../../utils/source-path-matcher";
  // 标签层级筛选工具
  import { matchesTagFilter } from "../../utils/tag-utils";
  // 旧的三位一体模板系统已完全移除
  import { Notice } from "obsidian";
  // v2.2: 导入牌组获取工具和内容解析工具（Content-Only 架构）
  import { getCardMetadata, setCardProperties, getCardDeckIds, getCardDeckNames as getCardDeckNamesFromYaml, extractBodyContent, parseSourceInfo, parseYAMLFromContent } from "../../utils/yaml-utils";
  import { MAIN_SEPARATOR } from "../../constants/markdown-delimiters";
  import { cardsToCSV, groupCardsBySource, groupCardsByMonth, groupCardsByDeck, sanitizeFileName, type ExportGroupMode } from "../../utils/card-export-utils";
  import { showObsidianConfirm, showObsidianInput } from "../../utils/obsidian-confirm";
  import { detectCardQuestionType, getQuestionTypeDistribution } from "../../utils/card-type-utils";
  import { getErrorBookDistribution, getCardErrorLevel } from "../../utils/error-book-utils";
  import { CardType } from "../../data/types";
  import { applyTimeFilter } from "../../utils/time-filter-utils";
  import { batchUpdateCards, mergeUnmappedFields, deleteFields } from "../../services/batch-operation-service";
  // 卡片详情模态窗改用全局方法 plugin.openViewCardModal()
  // 导入国际化
  import { tr } from "../../utils/i18n";
  import { migrateCardsErrorTracking, getMigrationStats } from "../../utils/data-migration-utils";
  import { calculateTagCounts } from "../../utils/tag-utils";
  import { FilterManager } from "../../services/filter-manager";
  import { TFolder } from "obsidian";
  
  // v2.1 YAML 元数据服务
  import { getCardMetadataService } from "../../services/CardMetadataService";
  import { invalidateCardCache } from "../../services/CardMetadataCache";
  import type { FilterConfig, SavedFilter } from "../../types/filter-types";
  
  // 牌组选择器
  import { DeckSelectorStorage } from "../../services/deck-selector-storage";
  
  // 高级功能守卫
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from "../../services/premium/PremiumFeatureGuard";
  import ActivationPrompt from "../premium/ActivationPrompt.svelte";
  import PremiumBadge from "../premium/PremiumBadge.svelte";
  
  // 题库数据存储
  import { QuestionBankStorage } from "../../services/question-bank/QuestionBankStorage";
  import type { TestSession, QuestionTestStats } from "../../types/question-bank-types";
  
  
  // 移动端组件
  import MobileCardManagementHeader from "../study/MobileCardManagementHeader.svelte";
  // MobileCardManagementMenu 已移除 - 现在使用 Obsidian Menu API
  
  // 卡片搜索组件
  import CardSearchInput from "../search/CardSearchInput.svelte";
  import { parseSearchQuery, matchSearchQuery } from "../../utils/search-parser";
  import type { SearchQuery } from "../../utils/search-parser";
  
  // 侧边栏导航头部组件已移至 WeaveApp 统一处理
  
  // 增量阅读活动文档store（用于文档关联筛选）
  import { irActiveDocumentStore } from "../../stores/ir-active-document-store";
  // EPUB阅读器活动文档store（用于文档关联筛选）
  import { epubActiveDocumentStore } from "../../stores/epub-active-document-store";
  import { VIEW_TYPE_EPUB } from "../../views/EpubView";
  
  // v2.0 增量阅读
  import { IRStorageService } from "../../services/incremental-reading/IRStorageService";
  import { IRPdfBookmarkTaskService, isPdfBookmarkTaskId } from "../../services/incremental-reading/IRPdfBookmarkTaskService";
  import type { IRBlock, IRDeck } from "../../types/ir-types";
  
  // 进度条模态窗
  import { executeBatchWithProgress } from "../../utils/progress-modal";
  
  class ExportFolderPickerModal extends FuzzySuggestModal<string> {
    private folders: string[];
    private onChoose: (item: string) => void;
    constructor(app: import('obsidian').App, folders: string[], onChoose: (item: string) => void) {
      super(app);
      this.folders = folders;
      this.onChoose = onChoose;
    }
    getItems(): string[] { return this.folders; }
    getItemText(item: string): string { return item || '/  (Vault Root)'; }
    onChooseItem(item: string): void { this.onChoose(item); }
  }

  interface Props {
    dataStorage: WeaveDataStorage;
    plugin: WeavePlugin;
    fsrs: FSRS;
  }

  let { dataStorage, plugin }: Props = $props();

  // 响应式翻译函数
  let t = $derived($tr);

  // 基础状态管理
  let isMounted = $state(false);  // 组件挂载状态（onMount设置）
  let isViewVisible = $state(true); // 视图可见性（组件被渲染即可见）
  let isLoading = $state(true);
  let isViewSwitching = $state(false); // 视图切换加载状态
  let isViewDestroyed = false;  // 添加视图销毁状态（非响应式，用于清理）
  let cards = $state<Card[]>([]);
  let selectedCards = $state(new Set<string>()); // Set<uuid>
  let searchQuery = $state("");
  let parsedSearchQuery = $state<SearchQuery | null>(null);
  
  // 视图状态（从 plugin.settings 初始化）
  type GridCardAttributeType = 'none' | 'uuid' | 'source' | 'priority' | 'retention' | 'modified' | 'accuracy' | 'question_type' | 'ir_state' | 'ir_priority';
  
  const GRID_ATTRIBUTES_BY_SOURCE: Record<'memory' | 'questionBank' | 'incremental-reading', GridCardAttributeType[]> = {
    'memory': ['none', 'uuid', 'source', 'priority', 'retention', 'modified'],
    'questionBank': ['none', 'uuid', 'source', 'question_type', 'accuracy', 'modified'],
    'incremental-reading': ['none', 'uuid', 'source', 'ir_state', 'ir_priority', 'modified'],
  };

  const DEFAULT_ATTRIBUTE_BY_SOURCE: Record<'memory' | 'questionBank' | 'incremental-reading', GridCardAttributeType> = {
    'memory': 'uuid',
    'questionBank': 'question_type',
    'incremental-reading': 'ir_state',
  };

  const viewPrefs = plugin.settings.cardManagementViewPreferences || {
    currentView: 'table',
    gridLayout: 'fixed',
    gridCardAttribute: 'uuid',
    kanbanLayoutMode: 'comfortable',
    tableViewMode: 'basic',
    enableCardLocationJump: false
  };
  
  // 高级功能守卫实例（优先初始化）
  const premiumGuard = PremiumFeatureGuard.getInstance();
  
  // 视图权限检查和降级
  function getInitialView(): 'table' | 'grid' | 'kanban' {
    const savedView = viewPrefs.currentView;
    // 如果保存的是网格视图但没有权限，降级到表格视图
    if (savedView === 'grid' && !premiumGuard.canUseFeature(PREMIUM_FEATURES.GRID_VIEW)) {
      return 'table';
    }
    // 如果保存的是看板视图但没有权限，降级到表格视图
    if (savedView === 'kanban' && !premiumGuard.canUseFeature(PREMIUM_FEATURES.KANBAN_VIEW)) {
      return 'table';
    }
    // 只返回允许的视图类型
    if (savedView === 'table' || savedView === 'grid' || savedView === 'kanban') {
      return savedView;
    }
    return 'table';
  }
  
  let currentView = $state<'table' | 'grid' | 'kanban'>(getInitialView());
  let gridLayout = $state<"fixed" | "masonry">(viewPrefs.gridLayout);
  let kanbanGroupBy = $state<'status' | 'type' | 'priority' | 'deck' | 'createTime'>('status'); // 看板分组方式
  let kanbanLayoutMode = $state<'compact' | 'comfortable' | 'spacious'>(viewPrefs.kanbanLayoutMode);
  let tableViewMode = $state<'basic' | 'review' | 'questionBank' | 'irContent'>(viewPrefs.tableViewMode);
  let enableCardLocationJump = $state(viewPrefs.enableCardLocationJump);
  let gridCardAttribute = $state<GridCardAttributeType>(viewPrefs.gridCardAttribute);
  let showGridAttributeMenu = $state(false); // 属性选择菜单显示状态（UI临时状态）
  
  // 全局筛选状态（从FilterStateService同步）
  let globalSelectedDeckId = $state<string | null>(null);
  let globalSelectedCardTypes = $state<Set<CardType>>(new Set());
  let globalSelectedPriority = $state<number | null>(null);
  let globalSelectedTags = $state<Set<string>>(new Set());
  let globalSelectedTimeFilter = $state<TimeFilterType>(null);  // 时间筛选
  let globalShowOrphanCards = $state(false);  // v2.0 孤儿卡片筛选
  
  // 自定义卡片筛选（用于显示特定卡片集合，如变体卡片）
  let customCardIdsFilter = $state<Set<string> | null>(null);
  let customFilterName = $state<string | null>(null);

  // isEditingCard 和 editingCard 已移除，统一使用嵌入式编辑器
  
  // 嵌入式编辑器管理器（方案A：永久隐藏Leaf）
  let editorPoolManager = $state<EmbeddableEditorManager | null>(null);
  
  // 题库数据存储和统计
  let questionBankStorage = $state<QuestionBankStorage | null>(null);
  let questionBankStats = $state<Map<string, QuestionTestStats>>(new Map());
  
  // 文档监听器清理函数
  let documentListenerCleanup: (() => void) | null = null;

  // 题库数据源
  let dataSource = $state<'memory' | 'questionBank' | 'incremental-reading'>('memory');  // 默认显示记忆学习数据
  let questionBankCards = $state<Card[]>([]);  // 题库数据
  let isLoadingQuestionBank = $state(false);  // 题库加载状态
  let questionBankDecks = $state<Deck[]>([]);
  
  // v2.0 增量阅读数据源
  let irContentCards = $state<Card[]>([]);  // IR内容块转换为Card格式
  let irBlocks = $state<Record<string, IRBlock>>({});  // 原始IR块数据
  let irDecks = $state<Record<string, IRDeck>>({});  // IR牌组数据
  let isLoadingIR = $state(false);  // IR数据加载状态
  let irStorageService: IRStorageService | null = null;  // IR存储服务
  let irTypeFilter = $state<'all' | 'md' | 'pdf'>('all');  // IR类型筛选：全部/MD文件/PDF书签
  
  // IR存储服务懒初始化辅助函数
  async function ensureIRStorageService(): Promise<IRStorageService> {
    if (!irStorageService) {
      irStorageService = new IRStorageService(plugin.app);
      await irStorageService.initialize();
    }
    return irStorageService;
  }
  
  // 查看卡片模态窗状态 - 改用全局方法，不再需要本地状态
  

  // 字段管理器状态
  let showColumnManager = $state(false);
  
  /**
   * 保存视图偏好到插件设置
   */
  async function saveViewPreferences() {
    try {
      if (!plugin.settings.cardManagementViewPreferences) {
        plugin.settings.cardManagementViewPreferences = {
          currentView: 'table',
          gridLayout: 'fixed',
          gridCardAttribute: 'uuid',
          kanbanLayoutMode: 'comfortable',
          tableViewMode: 'basic',
          enableCardLocationJump: false
        };
      }
      
      plugin.settings.cardManagementViewPreferences.currentView = currentView;
      plugin.settings.cardManagementViewPreferences.gridLayout = gridLayout;
      plugin.settings.cardManagementViewPreferences.gridCardAttribute = gridCardAttribute;
      plugin.settings.cardManagementViewPreferences.kanbanLayoutMode = kanbanLayoutMode;
      plugin.settings.cardManagementViewPreferences.tableViewMode = tableViewMode;
      plugin.settings.cardManagementViewPreferences.enableCardLocationJump = enableCardLocationJump;
      
      await plugin.saveSettings();
    } catch (error) {
      logger.error('保存视图偏好失败:', error);
    }
  }
  // showNewCardModal 已移除
  // showBatchTemplateModal 已删除（基于弃用的字段模板系统）
  // showBatchDeckModal、showBatchRemoveTagsModal、showBatchAddTagsModal 已移除（改用 Obsidian Menu API）
  
  // v2.2 数据管理模态窗（含质量扫描）
  let showDataManagementModal = $state(false);
  let dataManagementInitialTab = $state<'data' | 'quality'>('data');
  // v2.0 引用式牌组系统模态窗状态
  let showBuildDeckModal = $state(false);
  // v2.0 增量阅读牌组模态窗状态
  let showBuildIRDeckModal = $state(false);
  // 更多菜单状态
  let moreButtonElement = $state<HTMLElement | null>(null);
  // 工具栏容器引用
  let toolbarContainerRef = $state<HTMLElement | null>(null);
  let filterManager = $state<FilterManager | null>(null);
  let savedFilters = $state<SavedFilter[]>([]);

  // 文档过滤功能状态
  let documentFilterMode = $state<'all' | 'current'>('all'); // 过滤模式
  let currentActiveDocument = $state<string | null>(null); // 当前活动文档路径
  
  // 侧边栏检测状态
  let isInSidebar = $state(false);
  let viewWidth = $state(0);
  
  // 工具栏模式状态
  let toolbarMode = $state<'sidebar' | 'full'>('full');
  
  // 网格属性选择器按钮引用
  let gridAttributeButtonElement = $state<HTMLElement | null>(null);
  
  // 检测工具栏模式
  // 修复：使用 DOM 结构检测侧边栏 + 宽度检测双重方案
  function detectToolbarMode() {
    const rootContainer = document.querySelector('.weave-card-management-page');
    if (!rootContainer) {
      logger.debug('[detectToolbarMode] rootContainer not found');
      return;
    }
    
    // 方案1：使用 DOM 结构检测是否在侧边栏（最可靠）
    const inSidebarByDOM = checkIfInSidebar(rootContainer as HTMLElement);
    
    // 方案2：使用 workspace-leaf 的宽度检测（作为补充）
    const leafContent = rootContainer.closest('.workspace-leaf-content');
    const containerWidth = leafContent 
      ? (leafContent as HTMLElement).clientWidth 
      : (rootContainer as HTMLElement).clientWidth;
    
    const inSidebarByWidth = containerWidth > 0 && containerWidth < 600;
    
    // 任一方案检测到侧边栏则使用紧凑模式
    const newMode = (inSidebarByDOM || inSidebarByWidth) ? 'sidebar' : 'full';
    
    logger.debug(`[detectToolbarMode] DOM=${inSidebarByDOM}, width=${containerWidth}, widthCheck=${inSidebarByWidth}, mode=${newMode}`);
    
    if (toolbarMode !== newMode) {
      toolbarMode = newMode;
    }
  }
  
  // 检测是否在侧边栏的辅助函数（基于 DOM 结构）
  function checkIfInSidebar(element: HTMLElement): boolean {
    let current = element.parentElement;
    while (current) {
      const classList = current.classList;
      
      // 检测 Obsidian 侧边栏容器
      if (classList.contains('mod-right-split') || classList.contains('mod-left-split')) {
        return true;
      }
      
      // 检查是否在主编辑区（mod-root 表示主内容区）
      if (classList.contains('mod-root')) {
        return false;
      }
      
      current = current.parentElement;
    }
    return false;
  }
  
  // 移动端状态 - 使用多种检测方法确保准确性
  function detectMobileDevice(): boolean {
    // 1. Platform.isMobile - Obsidian 官方 API
    if (Platform.isMobile) return true;
    // 2. body classes
    if (typeof document !== 'undefined') {
      const body = document.body;
      if (body.classList.contains('is-mobile') || 
          body.classList.contains('is-phone') || 
          body.classList.contains('is-tablet')) {
        return true;
      }
    }
    // 3. 触摸屏检测
    if (typeof window !== 'undefined' && 'ontouchstart' in window) return true;
    // 4. Platform API 检测
    try {
      const { Platform } = require('obsidian');
      if (Platform.isMobile) return true;
    } catch {}
    return false;
  }
  
  const isMobile = detectMobileDevice();
  let isMobileMenuOpen = $state(false);
  let showMobileSearchInput = $state(false);

  // allFieldTemplates 已删除（新系统使用动态解析，无需预定义模板）
  let allDecks = $state<Deck[]>([]);
  
  // 高级功能相关状态
  let isPremium = $state(false);
  let showActivationPrompt = $state(false);
  let promptFeatureId = $state('');
  
  // 高级功能预览模式（从设置中读取）
  let showPremiumPreview = $derived(plugin.settings.showPremiumFeaturesPreview ?? false);
  // 是否显示高级功能（已激活或预览模式）
  let showPremiumFeatures = $derived(isPremium || showPremiumPreview);
  
  // 订阅高级版状态（添加挂载状态保护）
  $effect(() => {
    if (!isMounted) return;  // 只在组件挂载后订阅
    
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      if (isMounted) {  // 只在组件仍挂载时更新状态
        isPremium = value;
      }
    });
    return unsubscribe;
  });

  // 分页状态
  let currentPage = $state(1);
  let itemsPerPage = $state(25); // 性能优化：从50改为25，减少组件实例数量

  // 添加数据版本号，强制触发UI更新
  let dataVersion = $state(0);

  // 使用 $state + $effect 替代 $derived，避免 reconciliation 错误
  // 注意：$effect 必须正常追踪所有必要的依赖（包括 sortConfig），不能滥用 untrack
  let filteredAndSortedCards = $state<Card[]>([]);
  let totalFilteredItems = $state(0);
  let filteredCards = $state<Card[]>([]);
  
  // 判断是否有活动的全局筛选
  let hasActiveGlobalFilters = $derived(
    globalSelectedDeckId !== null ||
    globalSelectedCardTypes.size > 0 ||
    globalSelectedPriority !== null ||
    globalSelectedTags.size > 0 ||
    globalSelectedTimeFilter !== null ||
    globalShowOrphanCards ||  // v2.0 孤儿卡片筛选
    (customCardIdsFilter !== null && customCardIdsFilter.size > 0)
  );

  // 使用 $effect 来更新筛选和排序后的卡片
  $effect(() => {
    // 添加dataVersion依赖，确保数据更新时触发重新计算
    void dataVersion;
    
    // 性能优化：只在组件挂载且未销毁时计算
    if (!isMounted || !isViewVisible) {
      // 组件未挂载或已销毁时，清空数据避免内存泄漏
      filteredAndSortedCards = [];
      return;
    }
    
    // 修复说明：移除了 untrack 包裹，让排序配置变化能够正常触发 $effect
    // 原注释误判了"循环依赖"问题，实际上排序逻辑是单向的：sortConfig → 排序 → filteredAndSortedCards
    // 没有任何代码会在排序过程中修改 sortConfig，因此不存在循环依赖
    const currentSortField = sortConfig.field;
    const currentSortDirection = sortConfig.direction;
    
    // 根据数据源选择卡片数据
    const sourceCards = dataSource === 'questionBank' 
      ? questionBankCards 
      : dataSource === 'incremental-reading' 
        ? irContentCards 
        : cards;
    
    if (!Array.isArray(sourceCards)) {
      filteredAndSortedCards = [];
      return;
    }

    const deckById = new Map(allDecks.map(d => [d.id, d] as const));
    const deckIdsCache = new Map<string, ReturnType<typeof getCardDeckIds>>();
    const getCachedCardDeckIds = (card: Card) => {
      const key = card.uuid;
      const cached = deckIdsCache.get(key);
      if (cached) return cached;
      const computed = getCardDeckIds(card);
      deckIdsCache.set(key, computed);
      return computed;
    };

    let result = [...sourceCards];

    // 过滤渐进式挖空子卡片（管理界面只显示父卡片，子卡片仅在学习队列中出现）
    result = result.filter(card => card.type !== 'progressive-child');

    // IR类型筛选：按 MD/PDF 过滤
    if (dataSource === 'incremental-reading' && irTypeFilter !== 'all') {
      result = result.filter(card => {
        const isPdf = !!(card as any).metadata?.irPdfBookmark;
        return irTypeFilter === 'pdf' ? isPdf : !isPdf;
      });
    }

    // 应用自定义卡片ID筛选（最高优先级，用于显示特定卡片集合）
    if (customCardIdsFilter && customCardIdsFilter.size > 0) {
      result = result.filter(card => {
        const id = card.uuid;
        return customCardIdsFilter!.has(id);
      });
    }

    // 应用文档筛选（在其他筛选之前）
    if (documentFilterMode === 'current' && currentActiveDocument) {
      result = filterCardsBySourceDocument(result, currentActiveDocument);
    }
    
    // 应用全局筛选器的筛选条件
    // 1. 牌组筛选
    if (globalSelectedDeckId) {
      const selectedDeck = deckById.get(globalSelectedDeckId);
      const selectedDeckUuidSet = selectedDeck?.cardUUIDs?.length
        ? new Set(selectedDeck.cardUUIDs)
        : null;
      result = result.filter(card => {
        // 优先使用 deck.cardUUIDs
        if (selectedDeckUuidSet) {
          return selectedDeckUuidSet.has(card.uuid);
        }
        // v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
        const { deckIds } = getCachedCardDeckIds(card);
        return deckIds.includes(globalSelectedDeckId!) || card.referencedByDecks?.includes(globalSelectedDeckId!) || card.deckId === globalSelectedDeckId;
      });
    }
    
    // 2. 题型筛选
    if (globalSelectedCardTypes.size > 0) {
      result = result.filter(card => {
        const cardType = detectCardQuestionType(card);
        return globalSelectedCardTypes.has(cardType as unknown as CardType);
      });
    }
    
    // 3. 优先级筛选
    if (globalSelectedPriority !== null) {
      result = result.filter(card => (card.priority || 0) === globalSelectedPriority);
    }
    
    // 4. 标签筛选（AND逻辑：卡片必须包含所有选中标签，支持层级筛选）
    // v2.1: 使用 CardMetadataService 兼容新旧格式
    if (globalSelectedTags.size > 0) {
      const metadataSvc = getCardMetadataService();
      result = result.filter(card => {
        // AND逻辑：卡片必须匹配所有选中的标签
        const cardTags = metadataSvc.getCardTags(card);
        return Array.from(globalSelectedTags).every(selectedTag => 
          matchesTagFilter(cardTags, selectedTag)
        );
      });
    }
    
    // 5. 时间筛选
    if (globalSelectedTimeFilter) {
      result = applyTimeFilter(result, globalSelectedTimeFilter);
    }
    
    // 6. 孤儿卡片筛选（v2.0 引用式牌组系统）
    // 孤儿卡片定义：不被任何牌组的 cardUUIDs 所引用
    if (globalShowOrphanCards) {
      const referencedUUIDs = new Set<string>();
      for (const deck of allDecks) {
        if (deck.cardUUIDs) {
          for (const uuid of deck.cardUUIDs) {
            referencedUUIDs.add(uuid);
          }
        }
      }
      result = result.filter(card => !referencedUUIDs.has(card.uuid));
    }

    // 应用搜索筛选（使用卡片搜索解析器）
    if (searchQuery.trim() && parsedSearchQuery) {
      // 创建适配器函数
      const getContentAdapter = (card: any, side: 'front' | 'back') => {
        return getCardContentBySide(card, side, []);
      };
      
      result = result.filter(card => 
        matchSearchQuery(
          card, 
          parsedSearchQuery!, 
          getContentAdapter,
          getCardDeckNames,  // 修复：使用 getCardDeckNames 支持 v2.0 引用式牌组
          detectCardQuestionType
        )
      );
    }

    // 应用状态筛选
    if (filters.status.size > 0) {
      result = result.filter(card => {
        if (!card.fsrs) return false;
        const statusString = getCardStatusString(card.fsrs.state);
        return filters.status.has(statusString);
      });
    }

    // 应用牌组筛选
    if (filters.decks.size > 0) {
      const deckUuidSets = new Map<string, Set<string>>();
      for (const deckId of filters.decks) {
        const deck = deckById.get(deckId);
        if (deck?.cardUUIDs?.length) {
          deckUuidSets.set(deckId, new Set(deck.cardUUIDs));
        }
      }
      result = result.filter(card => {
        // 检查卡片是否属于任意筛选的牌组
        for (const deckId of filters.decks) {
          const uuidSet = deckUuidSets.get(deckId);
          if (uuidSet?.has(card.uuid)) {
            return true;
          }
          // v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
          const { deckIds: cardDeckIds } = getCachedCardDeckIds(card);
          if (cardDeckIds.includes(deckId) || card.referencedByDecks?.includes(deckId) || card.deckId === deckId) {
            return true;
          }
        }
        return false;
      });
    }

    // 应用标签筛选（支持层级筛选）
    // v2.1: 使用 CardMetadataService 兼容新旧格式
    if (filters.tags.size > 0) {
      const metadataSvc = getCardMetadataService();
      result = result.filter(card => {
        // AND逻辑：卡片必须匹配所有选中的标签
        const cardTags = metadataSvc.getCardTags(card);
        return Array.from(filters.tags).every(selectedTag =>
          matchesTagFilter(cardTags, selectedTag)
        );
      });
    }

    // 应用题型筛选
    if (filters.questionTypes.size > 0) {
      result = result.filter(card => {
        const questionType = detectCardQuestionType(card);
        return filters.questionTypes.has(questionType);
      });
    }

    // 应用错题集筛选
    if (filters.errorBooks.size > 0) {
      result = result.filter(card => {
        const errorLevel = getCardErrorLevel(card);
        return errorLevel && filters.errorBooks.has(errorLevel);
      });
    }

    const getSortKey = (card: Card): string | number => {
      switch (currentSortField) {
        case "front":
          return (getCardContentBySide(card, 'front', []) || '').toLowerCase();
        case "back":
          return (getCardContentBySide(card, 'back', []) || '').toLowerCase();
        case "status":
          return getCardStatusString(card.fsrs?.state ?? 0);
        case "created": {
          const ts = new Date(card.created || 0).getTime();
          return Number.isFinite(ts) ? ts : 0;
        }
        case "modified": {
          const ts = new Date(card.modified || 0).getTime();
          return Number.isFinite(ts) ? ts : 0;
        }
        case "tags":
          return (card.tags || []).join(" ").toLowerCase();
        case "obsidian_block_link":
          return (card.fields?.obsidian_block_link || '').toLowerCase();
        case "source_document":
          return (card.fields?.source_document || '').toLowerCase();
        case "uuid":
          return (card.uuid || '').toLowerCase();
        case "deck":
          return getCardDeckNames(card).toLowerCase();
        // IR 专用字段排序
        case "ir_title":
          return ((card as any).ir_title || '').toLowerCase();
        case "ir_source_file":
          return ((card as any).ir_source_file || '').toLowerCase();
        case "ir_state":
          return ((card as any).ir_state || '').toLowerCase();
        case "ir_priority":
          return (card as any).ir_priority ?? 5;
        case "ir_tags":
          return ((card as any).ir_tags || []).join(' ').toLowerCase();
        case "ir_favorite":
          return (card as any).ir_favorite ? 1 : 0;
        case "ir_next_review": {
          const irTs = new Date((card as any).ir_next_review || 0).getTime();
          return Number.isFinite(irTs) ? irTs : 0;
        }
        case "ir_review_count":
          return (card as any).ir_review_count ?? 0;
        case "ir_reading_time":
          return (card as any).ir_reading_time ?? 0;
        case "ir_extracted_cards":
          return (card as any).ir_extracted_cards ?? 0;
        case "ir_created": {
          const irCreatedTs = new Date((card as any).ir_created || 0).getTime();
          return Number.isFinite(irCreatedTs) ? irCreatedTs : 0;
        }
        case "ir_decks":
          return ((card as any).ir_deck || '').toLowerCase();
        default:
          return '';
      }
    };

    const decorated = result.map(card => ({ card, key: getSortKey(card) }));
    decorated.sort((a, b) => {
      const aKey = a.key;
      const bKey = b.key;
      if (typeof aKey === 'number' && typeof bKey === 'number') {
        return currentSortDirection === 'asc' ? aKey - bKey : bKey - aKey;
      }
      if (aKey < bKey) return currentSortDirection === "asc" ? -1 : 1;
      if (aKey > bKey) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    result = decorated.map(d => d.card);

    // 更新状态，创建新数组避免引用问题
    filteredAndSortedCards = result;
    
    // 排序完成后释放锁
    // 注意：这里的 untrack 是必要的，因为我们在 $effect 内部读取和修改 isSorting
    // 不使用 untrack 会导致修改 isSorting 时再次触发当前 $effect，造成无限循环
    // 这与上面 sortConfig 的使用不同：sortConfig 的变化应该触发 $effect（用户主动排序）
    untrack(() => {
      if (sortingLock && isSorting) {
        // 清除之前的定时器（防止多次触发）
        if (sortLockReleaseTimer !== null) {
          clearTimeout(sortLockReleaseTimer);
          sortLockReleaseTimer = null;
        }
        
        // 捕获当前排序请求ID，用于验证
        const currentRequestId = sortRequestId;
        
        queueMicrotask(() => {
          const elapsed = Date.now() - sortStartTime;
          const minDisplayTime = 200; // 最小显示时间200ms
          const remainingTime = Math.max(0, minDisplayTime - elapsed);
          
          sortLockReleaseTimer = window.setTimeout(() => {
            // 验证这是当前的排序请求才释放锁（防止过时的定时器释放锁）
            if (currentRequestId === sortRequestId) {
              isSorting = false;
              sortingLock = false;
              sortLockReleaseTimer = null;
            } else {
            }
          }, remainingTime);
        });
      }
    });
  });

  // 使用 $effect 来更新总数和分页数据
  $effect(() => {
    // 性能优化：只在组件挂载且视图可见时更新
    if (!isMounted || !isViewVisible) return;
    
    // 追踪所有的依赖项
    const sortedCards = filteredAndSortedCards;
    const page = currentPage;
    const perPage = itemsPerPage;
    
    // 计算总数
    totalFilteredItems = sortedCards.length;

    // 计算当前页的起止索引
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(sortedCards.length, startIndex + perPage);

    // 性能优化：直接使用 slice 结果，不需要额外的展开运算符
    // slice 已经返回新数组，不需要再用 [...] 创建副本
    const newFilteredCards = sortedCards.slice(startIndex, endIndex);
    
    // 修复：移除过于激进的优化检查，确保数据更新时 UI 能正确刷新
    // 原来的检查只比较长度和第一个元素的 UUID，但当标签/优先级等属性更新时，
    // 这些条件都不会变化，导致 filteredCards 不更新，UI 不刷新
    // 现在直接赋值，让 Svelte 的响应式系统自行判断是否需要更新 DOM
    filteredCards = newFilteredCards;
  });


  // 列可见性状态
  let columnVisibility = $state({
    front: true,
    back: true,
    status: true,
    deck: true,     // 新增：牌组列，默认显示
    tags: true,
    priority: true,
    created: true,
    modified: false, // 修改时间，默认隐藏
    next_review: false, // 下次复习，默认隐藏（复习模式显示）
    retention: false, // 记忆率，默认隐藏（复习模式显示）
    interval: false, // 间隔，默认隐藏（复习模式显示）
    difficulty: false, // 难度，默认隐藏（复习模式显示）
    review_count: false, // 复习次数，默认隐藏（复习模式显示）
    actions: true,
    // 新增字段，默认显示
    uuid: false,  // UUID默认隐藏，避免界面过于复杂
    obsidian_block_link: true,
    source_document: true,
    field_template: true, // 新增：字段模板列，默认显示
    source_document_status: true, // 新增：源文档状态列，默认显示
    // 题库专用列（根据dataSource动态显示）
    question_type: false,    // 题型，考试模式显示
    accuracy: false,         // 正确率，考试模式显示
    test_attempts: false,    // 测试次数，考试模式显示
    last_test: false,        // 最后测试，考试模式显示
    error_level: false,      // 错题等级，考试模式显示
    source_card: false,      // 关联记忆卡片，考试模式显示
    // 增量阅读专用列（irContent模式显示）
    ir_title: true,          // 标题，默认显示
    ir_source_file: true,    // 源文档，默认显示
    ir_state: true,          // 阅读状态，默认显示
    ir_priority: true,       // 优先级，默认显示
    ir_tags: true,           // 标签，默认显示
    ir_favorite: true,       // 收藏，默认显示
    ir_next_review: true,    // 下次复习，默认显示
    ir_review_count: true,   // 复习次数，默认显示
    ir_reading_time: false,  // 阅读时长，默认隐藏
    ir_notes: false,         // 笔记，默认隐藏
    ir_extracted_cards: true,// 已提取卡片，默认显示
    ir_created: true,        // 创建时间，默认显示
    ir_decks: true,          // 所属牌组，默认显示
  });

  // 列顺序状态
  let columnOrder = $state<ColumnOrder>([...DEFAULT_COLUMN_ORDER]);

  function handleVisibilityChange(key: keyof typeof columnVisibility, value: boolean) {
    columnVisibility[key] = value;
    
    // 持久化到 localStorage
    try {
      vaultStorage.setItem('weave-column-visibility', JSON.stringify(columnVisibility));
    } catch (error) {
      logger.error('保存列设置失败:', error);
    }
  }

  function handleOrderChange(newOrder: ColumnOrder) {
    columnOrder = newOrder;
    
    // 持久化到 localStorage
    try {
      vaultStorage.setItem('weave-column-order', JSON.stringify(newOrder));
    } catch (error) {
      logger.error('保存列顺序失败:', error);
    }
  }

  /**
   * 同步列可见性与数据源
   * 确保表格头部属性与当前数据源匹配
   */
  function syncColumnVisibilityWithDataSource(source: 'memory' | 'questionBank' | 'incremental-reading') {
    if (source === 'questionBank') {
      // 题库模式：显示题库专用列，隐藏其他
      tableViewMode = 'questionBank';
      columnVisibility.question_type = true;
      columnVisibility.accuracy = true;
      columnVisibility.test_attempts = true;
      columnVisibility.last_test = true;
      columnVisibility.error_level = true;
      columnVisibility.source_card = true;
      // 隐藏记忆学习专用列
      columnVisibility.next_review = false;
      columnVisibility.retention = false;
      columnVisibility.interval = false;
      columnVisibility.difficulty = false;
      columnVisibility.review_count = false;
      // 隐藏IR专用列
      columnVisibility.ir_title = false;
      columnVisibility.ir_source_file = false;
      columnVisibility.ir_state = false;
      columnVisibility.ir_priority = false;
      columnVisibility.ir_tags = false;
      columnVisibility.ir_favorite = false;
      columnVisibility.ir_next_review = false;
      columnVisibility.ir_review_count = false;
      columnVisibility.ir_reading_time = false;
      columnVisibility.ir_notes = false;
      columnVisibility.ir_extracted_cards = false;
      columnVisibility.ir_created = false;
      // 恢复卡片基础列
      columnVisibility.front = true;
      columnVisibility.back = true;
      columnVisibility.status = true;
      columnVisibility.deck = true;
    } else if (source === 'incremental-reading') {
      // IR模式：显示IR专用列，隐藏卡片列
      tableViewMode = 'irContent';
      columnVisibility.ir_title = true;
      columnVisibility.ir_source_file = true;
      columnVisibility.ir_state = true;
      columnVisibility.ir_priority = true;
      columnVisibility.ir_tags = true;
      columnVisibility.ir_favorite = true;
      columnVisibility.ir_next_review = true;
      columnVisibility.ir_review_count = true;
      columnVisibility.ir_reading_time = false;
      columnVisibility.ir_notes = false;
      columnVisibility.ir_extracted_cards = true;
      columnVisibility.ir_created = true;
      // 隐藏卡片专用列
      columnVisibility.front = false;
      columnVisibility.back = false;
      columnVisibility.status = false;
      columnVisibility.deck = false;
      columnVisibility.question_type = false;
      columnVisibility.accuracy = false;
      columnVisibility.test_attempts = false;
      columnVisibility.last_test = false;
      columnVisibility.error_level = false;
      columnVisibility.source_card = false;
    } else {
      // 记忆模式（默认）：显示基础列，隐藏专用列
      tableViewMode = 'basic';
      // 隐藏题库专用列
      columnVisibility.question_type = false;
      columnVisibility.accuracy = false;
      columnVisibility.test_attempts = false;
      columnVisibility.last_test = false;
      columnVisibility.error_level = false;
      columnVisibility.source_card = false;
      // 隐藏IR专用列
      columnVisibility.ir_title = false;
      columnVisibility.ir_source_file = false;
      columnVisibility.ir_state = false;
      columnVisibility.ir_priority = false;
      columnVisibility.ir_tags = false;
      columnVisibility.ir_favorite = false;
      columnVisibility.ir_next_review = false;
      columnVisibility.ir_review_count = false;
      columnVisibility.ir_reading_time = false;
      columnVisibility.ir_notes = false;
      columnVisibility.ir_extracted_cards = false;
      columnVisibility.ir_created = false;
      // 恢复卡片基础列
      columnVisibility.front = true;
      columnVisibility.back = true;
      columnVisibility.status = true;
      columnVisibility.deck = true;
      columnVisibility.tags = true;
      columnVisibility.priority = true;
    }
  }

  // 筛选状态
  let filters = $state({
    status: new Set<string>(),
    decks: new Set<string>(),
    tags: new Set<string>(),
    questionTypes: new Set<string>(),     // 新增：题型筛选
    errorBooks: new Set<string>(),        // 新增：错题集筛选
    searchQuery: ""
  });

  // 排序状态
  let sortConfig = $state({
    field: "created",
    direction: "desc" as "asc" | "desc"
  });

  // 排序加载状态
  let isSorting = $state(false);
  let sortingField = $state<string | null>(null);
  let sortingDirection = $state<'asc' | 'desc' | null>(null);
  
  // 同步标志位：立即阻止重复点击（不依赖响应式系统）
  let sortingLock = false;
  
  // 排序开始时间（用于确保最小显示时间）
  let sortStartTime = 0;
  
  // 排序请求ID：用于追踪当前排序请求（防止多次 $effect 触发导致的混乱）
  let sortRequestId = 0;
  
  // 延迟释放锁的定时器引用（用于清理）
  let sortLockReleaseTimer: number | null = null;

  // 使用 $state + $effect 替代 $derived，避免 reconciliation 错误
  let statusCounts = $state<Record<string, number>>({});
  let availableDecks = $state<Array<{id: string, name: string, count: number}>>([]);
  let availableTags = $state<Array<{name: string, count: number}>>([]);
  let questionTypeCounts = $state<Record<string, number>>({});     // 新增：题型统计
  let errorBookCounts = $state<Record<string, number>>({});        // 新增：错题集统计
  
  // 搜索组件需要的数据
  const searchSourceCards = $derived.by(() => {
    return dataSource === 'questionBank'
      ? questionBankCards
      : dataSource === 'incremental-reading'
        ? irContentCards
        : cards;
  });

  const searchAvailableDecks = $derived.by(() => {
    if (dataSource === 'questionBank') return questionBankDecks;
    if (dataSource === 'incremental-reading') {
      return Object.values(irDecks).map(d => ({ id: d.id, name: d.name } as unknown as Deck));
    }
    return allDecks;
  });

  const searchAvailableTags = $derived.by(() => {
    // 使用与侧边栏标签树相同的 calculateTagCounts 逻辑，确保标签提取一致
    const cardsForTags = searchSourceCards.map(c => ({
      id: c.uuid,
      tags: c.tags,
      content: c.content
    }));
    const { allTags } = calculateTagCounts(cardsForTags);
    // 补充 IR 标签（增量阅读专用）
    if (dataSource === 'incremental-reading') {
      const tagSet = new Set(allTags);
      for (const c of searchSourceCards) {
        const irTags = (c as any).ir_tags as string[] | undefined;
        if (Array.isArray(irTags)) {
          for (const t of irTags) tagSet.add(t);
        }
      }
      return Array.from(tagSet).sort();
    }
    return allTags.sort();
  });

  let searchAvailablePriorities = $derived.by(() => {
    const priorities = new Set<number>();
    searchSourceCards.forEach(card => {
      const p = (card as any).priority;
      if (p !== undefined && p !== null) {
        priorities.add(p);
      }
    });
    return Array.from(priorities).sort((a, b) => b - a);
  });
  
  let searchAvailableQuestionTypes = $derived.by(() => {
    const types = new Set<string>();
    for (const c of searchSourceCards) {
      const t = detectCardQuestionType(c);
      if (t) types.add(String(t));
    }
    return Array.from(types);
  });
  
  let searchAvailableSources = $derived.by(() => {
    const sources = new Set<string>();
    searchSourceCards.forEach(card => {
      const source = (card as any).sourceFile;
      if (source) {
        sources.add(source);
      }
    });
    return Array.from(sources).sort();
  });

  const searchAvailableStatuses = $derived.by(() => {
    if (dataSource !== 'memory') return [];
    return ['new', 'learning', 'review', 'relearning'];
  });

  const searchAvailableIRStates = $derived.by(() => {
    if (dataSource !== 'incremental-reading') return [];
    const set = new Set<string>();
    for (const c of irContentCards) {
      const s = (c as any).ir_state;
      if (s) set.add(String(s));
    }
    return Array.from(set);
  });

  const searchAvailableAccuracies = $derived.by(() => {
    if (dataSource !== 'questionBank') return [];
    return ['high', 'medium', 'low', '80', '60'];
  });

  const searchAvailableAttemptThresholds = $derived.by(() => {
    if (dataSource !== 'questionBank') return [];
    return [1, 3, 5, 10];
  });

  const searchAvailableErrorLevels = $derived.by(() => {
    if (dataSource !== 'questionBank') return [];
    return ['high', 'common', 'light', 'none'];
  });

  const searchAvailableSourceCards = $derived.by(() => {
    if (dataSource !== 'questionBank') return [];
    const set = new Set<string>();
    for (const c of questionBankCards) {
      const id = (c as any).metadata?.sourceCardId;
      if (typeof id === 'string' && id) set.add(id);
    }
    return Array.from(set).slice(0, 50);
  });

  const searchAvailableYamlKeys = $derived.by(() => {
    const keySet = new Set<string>();
    const sample = searchSourceCards.slice(0, 200);
    for (const card of sample) {
      if (typeof card.content === 'string' && card.content) {
        try {
          const yaml = parseYAMLFromContent(card.content);
          for (const key of Object.keys(yaml)) {
            if (!key.startsWith('we_')) keySet.add(key);
          }
        } catch { /* ignore */ }
      }
    }
    return Array.from(keySet).sort();
  });

  // 使用 $effect 来更新统计数据
  let statisticsUpdateTimer: number | null = null;
  $effect(() => {
    // 性能优化：只在组件挂载且视图可见时计算
    if (!isMounted || !isViewVisible) {
      // 清理定时器
      if (statisticsUpdateTimer !== null) {
        clearTimeout(statisticsUpdateTimer);
        statisticsUpdateTimer = null;
      }
      return;
    }
    
    // 根据数据源选择统计用的源数据
    const currentSource = dataSource;
    const statsCards = currentSource === 'questionBank' 
      ? questionBankCards 
      : currentSource === 'incremental-reading' 
        ? irContentCards 
        : cards;
    
    if (!Array.isArray(statsCards)) {
      statusCounts = {};
      availableDecks = [];
      availableTags = [];
      questionTypeCounts = {};
      errorBookCounts = {};
      return;
    }
    
    // 性能优化：根据数据量决定是否延迟计算
    const shouldDefer = statsCards.length > 100; // 大数据集才延迟
    
    const updateStatistics = () => {

      // 计算状态统计
    if (currentSource === 'incremental-reading') {
      // IR模式：统计阅读状态
      const irStatusMap: Record<string, number> = {};
      statsCards.forEach(card => {
        const state = (card as any).ir_state || 'new';
        irStatusMap[state] = (irStatusMap[state] || 0) + 1;
      });
      statusCounts = irStatusMap;
    } else {
      const newStatusCounts = statsCards.reduce((acc, card) => {
        if (!card.fsrs) return acc;
        const status = getCardStatusString(card.fsrs.state);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      statusCounts = newStatusCounts;
    }

    // v2.0: 引用式牌组架构 - 计算牌组统计
    const deckMap = new Map<string, number>();
    
    if (currentSource === 'incremental-reading') {
      // IR模式：从 ir_deck_ids 或 ir_deck 统计
      statsCards.forEach(card => {
        const deckIds = (card as any).ir_deck_ids as string[] | undefined;
        if (deckIds && deckIds.length > 0) {
          deckIds.forEach((did: string) => {
            deckMap.set(did, (deckMap.get(did) || 0) + 1);
          });
        } else {
          const deckName = (card as any).ir_deck || '未分配';
          deckMap.set(deckName, (deckMap.get(deckName) || 0) + 1);
        }
      });
      
      // IR 牌组名称解析
      availableDecks = Array.from(deckMap.entries()).map(([id, count]) => {
        const irDeck = Object.values(irDecks).find(d => d.id === id);
        return { id, name: irDeck?.name || id, count };
      });
    } else {
      const cardUUIDSet = new Set(statsCards.map(c => c.uuid));
      
      // 方式1：通过 deck.cardUUIDs 统计（优先）
      allDecks.forEach(deck => {
        if (deck.cardUUIDs && deck.cardUUIDs.length > 0) {
          const count = deck.cardUUIDs.filter(uuid => cardUUIDSet.has(uuid)).length;
          if (count > 0) {
            deckMap.set(deck.id, count);
          }
        }
      });
      
      // 方式2：对于没有 cardUUIDs 的牌组，通过 we_decks/referencedByDecks/deckId 统计
      // v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
      statsCards.forEach(card => {
        const { deckIds: cardDeckIds } = getCardDeckIds(card);
        if (cardDeckIds.length > 0) {
          cardDeckIds.forEach((deckId: string) => {
            const deck = allDecks.find(d => d.id === deckId);
            if (!deck?.cardUUIDs?.length) {
              deckMap.set(deckId, (deckMap.get(deckId) || 0) + 1);
            }
          });
        } else if (card.referencedByDecks && card.referencedByDecks.length > 0) {
          card.referencedByDecks.forEach((deckId: string) => {
            const deck = allDecks.find(d => d.id === deckId);
            if (!deck?.cardUUIDs?.length) {
              deckMap.set(deckId, (deckMap.get(deckId) || 0) + 1);
            }
          });
        } else if (card.deckId) {
          const deck = allDecks.find(d => d.id === card.deckId);
          if (!deck?.cardUUIDs?.length) {
            deckMap.set(card.deckId, (deckMap.get(card.deckId) || 0) + 1);
          }
        }
      });
      
      availableDecks = Array.from(deckMap.entries()).map(([id, count]) => ({
        id,
        name: getDeckName(id),
        count
      }));
    }

    // 计算标签统计
    const tagMap = new Map<string, number>();
    if (currentSource === 'incremental-reading') {
      // IR模式：从 ir_tags 和 card.tags 合并统计
      statsCards.forEach(card => {
        const irTags = (card as any).ir_tags as string[] | undefined;
        const cardTags = card.tags || [];
        const allCardTags = new Set([...(irTags || []), ...cardTags]);
        allCardTags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      });
    } else {
      // v2.1: 使用 CardMetadataService 兼容新旧格式
      const metadataService = getCardMetadataService();
      statsCards.forEach(card => {
        const cardTags = metadataService.getCardTags(card);
        cardTags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      });
    }
    availableTags = Array.from(tagMap.entries()).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 计算题型统计
    questionTypeCounts = getQuestionTypeDistribution(statsCards);

      // 计算错题集统计
      errorBookCounts = getErrorBookDistribution(statsCards);
      
    };
    
    if (shouldDefer) {
      // 大数据集：延迟计算，避免阻塞主线程
      if (statisticsUpdateTimer !== null) {
        clearTimeout(statisticsUpdateTimer);
      }
      statisticsUpdateTimer = window.setTimeout(() => {
        updateStatistics();
        statisticsUpdateTimer = null;
      }, 150);
    } else {
      // 小数据集：立即更新，避免数据不一致
      updateStatistics();
    }
  });

  // 性能优化：缓存VIEW_TYPE_WEAVE常量，避免重复动态导入
  let VIEW_TYPE_WEAVE_CACHED: string | null = null;
  
  /**
   * 检测当前视图是否在侧边栏
   * 使用Obsidian官方API进行精确检测
   */
  async function detectSidebarContext() {
    if (!plugin?.app?.workspace) {
      isInSidebar = false; // 降级：无法检测时隐藏按钮
      return;
    }
    
    try {
      // 性能优化：只在第一次时动态导入，之后使用缓存
      if (!VIEW_TYPE_WEAVE_CACHED) {
        const module = await import('../../views/WeaveView');
        VIEW_TYPE_WEAVE_CACHED = module.VIEW_TYPE_WEAVE;
      }
      
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_WEAVE_CACHED);
      
      if (leaves.length === 0) {
        isInSidebar = false; // 降级：找不到leaf时隐藏按钮（等待leaf创建）
        return;
      }
      
      const leaf = leaves[0];
      const leafRoot = leaf.getRoot();
      const workspace = plugin.app.workspace;
      
      // 精确判断：leaf不在主编辑区 = 在侧边栏
      const isInMainArea = leafRoot === workspace.rootSplit;
      const newState = !isInMainArea;
      
      // 仅在状态真正改变时更新（触发Svelte响应式更新）
      if (isInSidebar !== newState) {
        isInSidebar = newState;
      }
      
    } catch (error) {
      logger.error('侧边栏检测失败:', error);
      // 降级策略：检测失败时隐藏按钮（保守策略）
      if (isInSidebar !== false) {
        isInSidebar = false;
      }
    }
  }

  /**
   * 获取文件名（不含路径）
   */
  function getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1].replace(/\.md$/i, '');
  }

  // 监听活动文档变化
  function setupActiveDocumentListener() {
    if (!plugin?.app?.workspace) return;

    // 获取当前活动文档
    function updateActiveDocument() {
      const activeFile = plugin.app.workspace.getActiveFile();
      currentActiveDocument = activeFile ? activeFile.path : null;
    }

    // 初始化当前活动文档
    updateActiveDocument();

    // 监听活动文档变化
    plugin.app.workspace.on('active-leaf-change', updateActiveDocument);
    plugin.app.workspace.on('file-open', updateActiveDocument);

    // 清理函数
    return () => {
      plugin.app.workspace.off('active-leaf-change', updateActiveDocument);
      plugin.app.workspace.off('file-open', updateActiveDocument);
    };
  }

  // 文档过滤切换函数
  function toggleDocumentFilter() {
    documentFilterMode = documentFilterMode === 'all' ? 'current' : 'all';
    // 修复：不再持久化过滤模式，避免自动触发过滤
    // 用户需要主动点击按钮才会应用文档过滤
  }

  // 异步初始化函数
  async function initializeAsync() {
    // 关键修复：等待所有核心服务就绪（包括 cardFileService）
    // 视图可能在 workspace 恢复时创建，此时 cardFileService 还未初始化
    // 必须等待 allCoreServices 而不是 dataStorage，因为 getCards() 依赖 cardFileService
    await waitForServiceReady('allCoreServices', 15000);
    
    // Load initial data
    allDecks = await dataStorage.getDecks();
    await loadCards();

    // 初始化嵌入式编辑器管理器（方案A：永久隐藏Leaf）
    editorPoolManager = new EmbeddableEditorManager(plugin.app);
    
    // 初始化题库数据存储
    questionBankStorage = new QuestionBankStorage(plugin.app);
    await questionBankStorage.initialize();
  }

  // 生命周期
  onMount(() => {
    isMounted = true;
    
    // 订阅全局筛选状态（从FilterStateService）
    const filterUnsubscribe = plugin.filterStateService?.subscribe((state) => {
      
      // 同步全局筛选状态到本地
      globalSelectedDeckId = state.selectedDeckId;
      globalSelectedCardTypes = new Set(state.selectedCardTypes);
      globalSelectedPriority = state.selectedPriority;
      globalSelectedTags = new Set(state.selectedTags);
      globalSelectedTimeFilter = state.selectedTimeFilter;
      globalShowOrphanCards = state.showOrphanCards;  // v2.0 同步孤儿卡片筛选
    });
    
    // 订阅数据同步服务（卡片变更）
    let cardsUnsubscribe: (() => void) | undefined;
    if (plugin.dataSyncService) {
      cardsUnsubscribe = plugin.dataSyncService.subscribe(
        'cards',
        async (event) => {
          await loadCards();
        },
        { debounce: 300 }
      );
    }
    
    // 订阅数据同步服务（牌组变更）
    let decksUnsubscribe: (() => void) | undefined;
    if (plugin.dataSyncService) {
      decksUnsubscribe = plugin.dataSyncService.subscribe(
        'decks',
        async (event) => {
          allDecks = await dataStorage.getDecks();
        },
        { debounce: 300 }
      );
    }
    
    // 初始化 FilterManager
    filterManager = new FilterManager();
    savedFilters = filterManager.getAllFilters();
    
    // 延迟初始化侧边栏检测（确保leaf已创建）
    setTimeout(async () => {
      await detectSidebarContext();  // 使用缓存的动态导入
      detectToolbarMode();
    }, 200);
    
    // 监听窗口大小变化
    const handleResize = async () => {
      await detectSidebarContext();  // 使用缓存的动态导入
      detectToolbarMode();
    };
    window.addEventListener('resize', handleResize);
    
    // 工具栏模式检测（使用 ResizeObserver + MutationObserver）
    // 修复：监听 workspace-leaf-content 而不是组件内部容器
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    
    // 使用 tick().then() 确保 DOM 已渲染
    tick().then(() => {
      // 查找最近的 workspace-leaf-content（这是 Obsidian 控制宽度的容器）
      const rootContainer = document.querySelector('.weave-card-management-page');
      const leafContent = rootContainer?.closest('.workspace-leaf-content');
      const observeTarget = leafContent || rootContainer;
      
      if (observeTarget) {
        // ResizeObserver 监听宽度变化
        resizeObserver = new ResizeObserver(() => {
          detectToolbarMode();
        });
        resizeObserver.observe(observeTarget);
        
        // MutationObserver 监听 DOM 结构变化（视图移动到侧边栏）
        const workspace = document.querySelector('.workspace');
        if (workspace) {
          mutationObserver = new MutationObserver(() => {
            // DOM 结构变化时重新检测
            detectToolbarMode();
          });
          mutationObserver.observe(workspace, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
          });
        }
        
        // 立即执行一次检测，确保初始状态正确
        detectToolbarMode();
      }
    });
    
    // 监听布局变化（视图拖动时触发）
    const layoutChangeHandler = () => {
      // 延迟执行，等待布局稳定
      setTimeout(async () => {
        await detectSidebarContext();  
        detectToolbarMode();
      }, 150);
    };
    plugin.app.workspace.on('layout-change', layoutChangeHandler);
    
    // 修复：移除错误的active-leaf-change检测
    // 原逻辑检查 getViewType() !== 'weave-card-management'，但实际视图类型是 'weave-view'
    // 导致isViewVisible永远为false，数据被清空
    // 
    // 正确的逻辑：组件被Svelte渲染 = 可见，组件被销毁 = 不可见
    // 使用onDestroy来清理资源，而不是依赖active-leaf-change
    
    // 监听按卡片ID筛选事件（来自其他组件，如CardInfoTab）
    const handleFilterByCards = (e: CustomEvent<{ cardIds: string[], filterName: string, parentCardPreview?: string }>) => {
      const { cardIds, filterName, parentCardPreview } = e.detail;
      // Received filter request
      if (customCardIdsFilter === null || customCardIdsFilter.size === 0) {
        // First filter, create new set
        customCardIdsFilter = new Set(cardIds);
      } else {
        // Already filtered, append to set
        cardIds.forEach(id => customCardIdsFilter!.add(id));
      }
      
      customFilterName = filterName;
      
      // Notify user
      const filterMessage = parentCardPreview 
        ? t('cards.management.filterFromSource', { count: cardIds.length, source: parentCardPreview })
        : t('cards.management.filtered', { count: cardIds.length });
      new Notice(filterMessage);
    };
    window.addEventListener('Weave:filter-by-cards', handleFilterByCards as EventListener);
    
    // 监听侧边栏视图切换事件
    const handleSidebarViewChange = (e: CustomEvent<string>) => {
      const view = e.detail as 'table' | 'grid' | 'kanban';
      switchView(view);
    };
    window.addEventListener('Weave:sidebar-view-change', handleSidebarViewChange as EventListener);
    
    // 监听彩色圆点的数据源切换事件
    const handleCardDataSourceChange = async (e: Event) => {
      const source = (e as CustomEvent<string>).detail as 'memory' | 'questionBank' | 'incremental-reading';
      await switchDataSource(source);
    };
    window.addEventListener('Weave:card-data-source-change', handleCardDataSourceChange);
    
    // 初始化时通知父组件当前视图状态
    window.dispatchEvent(new CustomEvent('Weave:card-view-change', { detail: currentView }));
    
    // 立即订阅当前活动文档变化
    // 优先使用增量阅读的活动文档（支持IR界面的文档关联筛选）
    const updateActiveDocumentNow = () => {
      // 优先检查增量阅读界面的活动文档
      const irActiveDocument = irActiveDocumentStore.getActiveDocument();
      if (irActiveDocument) {
        currentActiveDocument = irActiveDocument;
        logger.debug('[卡片管理] 使用增量阅读活动文档:', currentActiveDocument);
        return;
      }

      // 优先识别当前活动标签页是否为 EPUB 阅读器
      const activeLeaf = plugin.app.workspace.activeLeaf;
      const activeLeafViewType = activeLeaf?.view?.getViewType?.();
      if (activeLeafViewType === VIEW_TYPE_EPUB) {
        const activeEpubState = activeLeaf?.view?.getState?.() as { filePath?: unknown; file?: unknown } | undefined;
        const leafFilePath = typeof activeEpubState?.filePath === 'string' ? activeEpubState.filePath : null;
        const leafFile = typeof activeEpubState?.file === 'string' ? activeEpubState.file : null;
        const activeEpubPath = leafFilePath || leafFile || epubActiveDocumentStore.getActiveDocument();
        if (activeEpubPath) {
          currentActiveDocument = activeEpubPath;
          logger.debug('[卡片管理] 使用当前活动 EPUB 文档:', currentActiveDocument);
          return;
        }
      }

      // Obsidian 原生活动文件优先，避免 Markdown 标签页存在时被旧的 EPUB 状态覆盖
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile) {
        currentActiveDocument = activeFile.path;
        logger.debug('[卡片管理] 使用 Obsidian 活动文档:', currentActiveDocument);
        return;
      }
      
      // 侧栏获得焦点时，回退到最近同步过的 EPUB 阅读书籍
      const epubActiveDocument = epubActiveDocumentStore.getActiveDocument();
      if (epubActiveDocument) {
        currentActiveDocument = epubActiveDocument;
        logger.debug('[卡片管理] 使用EPUB阅读器活动文档:', currentActiveDocument);
        return;
      }
      
      currentActiveDocument = null;
      logger.debug('[卡片管理] 当前活动文档更新:', currentActiveDocument);
    };
    
    // 调用一次，确保初始化
    updateActiveDocumentNow();
    
    // 订阅增量阅读活动文档变化
    const irUnsubscribe = irActiveDocumentStore.subscribe((filePath) => {
      updateActiveDocumentNow();
    });
    
    // 订阅EPUB阅读器活动文档变化
    const epubUnsubscribe = epubActiveDocumentStore.subscribe((filePath) => {
      updateActiveDocumentNow();
    });
    
    // 监听文档切换事件
    const eventRef = plugin.app.workspace.on('active-leaf-change', (leaf) => {
      updateActiveDocumentNow();
    });
    
    // 保存清理函数
    documentListenerCleanup = () => {
      plugin.app.workspace.offref(eventRef);
      irUnsubscribe();
      epubUnsubscribe();
    };
    
    // 异步初始化
    initializeAsync();

    // 修复：不再从 localStorage 恢复文档过滤模式
    // 保持初始值为 'all'，用户需要主动点击才会应用过滤
    // 这避免了自动触发文档过滤的问题

    // 加载列可见性设置
    const savedColumnVisibility = vaultStorage.getItem('weave-column-visibility');
    if (savedColumnVisibility) {
      try {
        const parsed = JSON.parse(savedColumnVisibility);
        // 合并保存的设置和默认设置（确保新增字段有默认值）
        columnVisibility = { ...columnVisibility, ...parsed };
        // 列设置加载成功
      } catch (error) {
        logger.error('解析列设置失败:', error);
      }
    }
    
    // 关键修复：同步列可见性与当前数据源，防止表头与数据源错乱
    syncColumnVisibilityWithDataSource(dataSource);

    // 加载列顺序设置
    const savedColumnOrder = vaultStorage.getItem('weave-column-order');
    if (savedColumnOrder) {
      try {
        const parsed = JSON.parse(savedColumnOrder);
        // 合并保存的顺序和默认顺序（确保新增列被包含）
        const defaultOrder = [...DEFAULT_COLUMN_ORDER];
        // 防御性检查：确保parsed是有效数组
        if (!Array.isArray(parsed) || parsed.length === 0) {
          logger.warn('[ColumnOrder] 保存的列顺序无效，使用默认值');
          columnOrder = [...DEFAULT_COLUMN_ORDER];
        } else {
          const mergedOrder = [
            ...parsed.filter((key: ColumnKey) => defaultOrder.includes(key)),
            ...defaultOrder.filter((key: ColumnKey) => !parsed.includes(key))
          ];
          columnOrder = mergedOrder;
          // 列顺序设置加载成功
        }
      } catch (error) {
        logger.error('解析列设置失败:', error);
      }
    }

    isLoading = false;

    // 设置活动文档监听
    setupActiveDocumentListener();

    // 清理函数
    const cleanupResources = () => {
      // 关闭活动的编辑器
      if (editorPoolManager) {
        try {
          // 编辑器管理器会在组件销毁时自动清理
          logger.debug('[cleanupResources] 编辑器管理器存在，将自动清理');
        } catch (error) {
          logger.debug('[cleanupResources] 清理编辑器失败:', error);
        }
      }
      
      isViewDestroyed = true;
      
      // 清理所有间隔
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      
      // 清理导航超时
      if (navigationTimeout !== null) {
        clearTimeout(navigationTimeout);
        navigationTimeout = null;
      }
      
      // 清理内容缓存，防止内存泄漏
      // 但如果正在导航，保留缓存以避免返回时重新计算
      if (!isNavigatingToSource) {
        contentCache.clear();
      }
      
      // 清理订阅
      if (filterUnsubscribe) {
        filterUnsubscribe();
      }
      
      // 清理数据同步服务
      if (cardsUnsubscribe) {
        cardsUnsubscribe();
        // 数据订阅已取消
      }
      
      // 清理排序定时器
      if (sortLockReleaseTimer !== null) {
        clearTimeout(sortLockReleaseTimer);
        sortLockReleaseTimer = null;
        // 排序定时器已清理
        tableDataTimer = null;
      }
      
      // 清理统计数据更新定时器
      if (statisticsUpdateTimer !== null) {
        clearTimeout(statisticsUpdateTimer);
        statisticsUpdateTimer = null;
      }
      
      // 重置排序状态
      isSorting = false;
      sortingField = null;
      sortingDirection = null;
      
      // Clean up active document listener
      if (documentListenerCleanup) {
        documentListenerCleanup();
      }
      
      // Remove event listeners
      // 注：这些事件监听器未使用，已移除
      
      // 性能优化：清理缓存以释放内存
      contentCache.clear();
      cachedTransformedCards = [];
      
      isMounted = false;  // 标记组件已卸载
      
      window.removeEventListener('resize', handleResize);
      plugin.app.workspace.off('layout-change', layoutChangeHandler);
      window.removeEventListener('Weave:filter-by-cards', handleFilterByCards as EventListener);
      window.removeEventListener('Weave:sidebar-view-change', handleSidebarViewChange as EventListener);
      window.removeEventListener('Weave:card-data-source-change', handleCardDataSourceChange);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
    
    // 返回清理函数
    return cleanupResources;
  });
  
  // 修复：添加onDestroy，确保组件销毁时清理资源
  onDestroy(() => {
    logger.debug('[卡片管理] 组件销毁，清理资源');
    isViewVisible = false;  // 标记视图不可见
    isViewDestroyed = true; // 标记视图已销毁
  });

  // 已移除旧的 CustomEvent 监听器（Weave:refresh-cards）
  // 现在使用 DataSyncService 统一管理数据刷新

  // loadFieldTemplates 已删除（新系统使用动态解析，无需预加载模板）

  async function loadCards() {
    try {
      logger.debug('[卡片管理] 开始加载卡片数据...');
      
      // 等待所有核心服务就绪（包括 cardFileService）
      await waitForServiceReady('allCoreServices', 15000);
      
      // v2.0: 完全引用式架构 - 从统一存储获取所有卡片
      let allCards: Card[] = await dataStorage.getCards();
      
      // 同时加载牌组数据
      allDecks = await dataStorage.getDecks();
      logger.debug(`[卡片管理] 从统一存储加载 ${allCards.length} 张卡片`);

      // Data migration: auto-migrate old error tracking data
      const migrationStats = getMigrationStats(allCards);
      if (migrationStats.needsMigration > 0) {
        logger.debug(`检测到 ${migrationStats.needsMigration} 张卡片需要迁移错题集数据`);
        allCards = migrateCardsErrorTracking(allCards);
        logger.debug('错题集数据迁移完成');
      }

      // 确保是新引用，触发Svelte响应式更新
      cards = [...allCards];

      // 卡片加载完成
    } catch (error) {
      logger.error('加载卡片失败:', error);
      cards = [];
      new Notice(t('cards.management.loadFailed', { error: error instanceof Error ? error.message : 'Unknown error' }), 5000);
    }
  }


  // 安全创建Date对象
  function createSafeDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    try {
      const date = new Date(dateValue);
      // 检查是否是有效的Date对象
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      return null;
    }
  }

  // 获取牌组名称
  function getDeckName(deckId: string): string {
    // 从allDecks数据中获取正确的牌组名称
    const deck = allDecks.find(d => d.id === deckId);
    return deck?.name || deckId;
  }
  
  // v2.2: 获取卡片所属的所有牌组名称（Content-Only 架构）
  // 优先从 content YAML 的 we_decks 获取，回退到 referencedByDecks/deckId
  function getCardDeckNames(card: Card): string {
    if (dataSource === 'incremental-reading') {
      const names: string[] = [];
      const seen = new Set<string>();
      const ids = (card as any).ir_deck_ids || (card as any).metadata?.deckIds || [];
      if (Array.isArray(ids)) {
        for (const id of ids) {
          const name = irDecks[id]?.name || String(id);
          if (name && !seen.has(name)) {
            seen.add(name);
            names.push(name);
          }
        }
      }
      const singleName = (card as any).ir_deck;
      if (typeof singleName === 'string' && singleName && singleName !== '未分配' && !seen.has(singleName)) {
        names.push(singleName);
      }
      if (names.length > 0) return names.join(', ');
    }

    // 直接使用 yaml-utils 工具函数，内部已实现完整回退链：
    // 1. content YAML 的 we_decks（牌组名称）← 权威数据源
    // 2. card.referencedByDecks（牌组ID列表）
    // 3. card.deckId（单个牌组ID）
    const decksForLookup = dataSource === 'questionBank'
      ? questionBankDecks
      : dataSource === 'incremental-reading'
        ? Object.values(irDecks).map(d => ({ id: d.id, name: d.name } as unknown as Deck))
        : allDecks;
    const names = getCardDeckNamesFromYaml(card, decksForLookup, '-');
    return names.join(', ');
  }

  // 将 Card 转换为表格显示格式
  // 添加缓存优化（使用computed状态）
  // 性能优化：添加内容缓存
  const contentCache = new Map<string, { front: string; back: string }>();
  
  // 性能优化：跟踪导航状态，避免缓存清理
  let isNavigatingToSource = $state(false);
  let navigationTimeout: number | null = null;
  let refreshInterval: number | null = null;  // 添加 refreshInterval 定义
  
  // 性能优化：添加转换结果缓存
  let lastFilteredCardsKey: string = '';
  let cachedTransformedCards: any[] = [];
  
  // 生成卡片数组的缓存键（基于内容而非引用）
  // 性能优化：使用采样策略代替遍历全部卡片，O(1) 复杂度
  function generateCacheKey(cards: Card[]): string {
    if (!cards || cards.length === 0) return 'empty';
    const count = cards.length;
    const firstMod = cards[0]?.modified || '';
    const lastMod = cards[count - 1]?.modified || '';
    // 采样前5张 + 后5张 + 中间1张的属性（覆盖排序/筛选变化场景）
    const sampleIndices = [0, 1, 2, 3, 4, Math.floor(count / 2), count - 5, count - 4, count - 3, count - 2, count - 1]
      .filter(i => i >= 0 && i < count);
    const uniqueIndices = [...new Set(sampleIndices)];
    const sample = uniqueIndices.map(i => {
      const c = cards[i];
      return `${c.uuid}:${(c.tags || []).length}:${c.priority || 0}:${c.metadata?.favorite || false}:${c.modified || ''}`;
    }).join(',');
    return `${count}:${sample}:${firstMod}:${lastMod}:${dataVersion}`;
  }
  
  // 性能优化：延迟计算标志
  let isTableDataReady = $state(false);
  let tableDataTimer: number | null = null;
  let lastViewSwitch = 0;  // 记录上次视图切换时间
  
  // 监听视图切换，延迟初始化表格数据
  $effect(() => {
    if (currentView === 'table') {
      const now = Date.now();
      // 如果距离上次切换不到500ms，说明是标签切换导致的，使用更长的延迟
      const delay = (now - lastViewSwitch < 500) ? 300 : 100;
      lastViewSwitch = now;
      
      // 切换到表格视图时，延迟后才开始转换数据
      if (tableDataTimer) clearTimeout(tableDataTimer);
      tableDataTimer = window.setTimeout(() => {
        isTableDataReady = true;
        tableDataTimer = null;
      }, delay);
    } else {
      // 切换到其他视图时，保持表格数据状态但不重新计算
      lastViewSwitch = Date.now();
      if (tableDataTimer) {
        clearTimeout(tableDataTimer);
        tableDataTimer = null;
      }
      // 不立即设置 isTableDataReady = false，保留缓存
    }
  });
  
  // 性能优化：使用 $derived 缓存转换结果，避免每次渲染时重新计算
  let transformedCards = $derived.by(() => {
    // 添加dataVersion依赖，确保数据更新时触发重新计算
    void dataVersion;
    
    // 性能优化：如果不在表格视图或组件未挂载或视图不可见，直接返回空数组
    if (!isMounted || !isViewVisible || currentView !== 'table') {
      return [];
    }
    
    // 只在表格视图可见且数据准备好时才进行转换
    if (!isTableDataReady) {
      return cachedTransformedCards.length > 0 ? cachedTransformedCards : [];
    }
    
    // 生成当前数组的缓存键（包含dataVersion以确保缓存失效）
    const currentKey = generateCacheKey(filteredCards) + `-v${dataVersion}`;
    
    // 检查内容是否真的变化了（基于内容的缓存键比较）
    if (currentKey === lastFilteredCardsKey && cachedTransformedCards.length > 0) {
      return cachedTransformedCards; // 直接返回缓存
    }
    
    const startTime = performance.now();
    const result = transformCardsForTable(filteredCards);
    const elapsed = performance.now() - startTime;
    
    // 性能监控：记录所有转换
    logger.debug(`[性能优化] 卡片转换耗时: ${elapsed.toFixed(2)}ms, 卡片数量: ${filteredCards.length}, 每页: ${itemsPerPage}`);
    
    // 更新缓存
    lastFilteredCardsKey = currentKey;
    cachedTransformedCards = result;
    
    return result;
  });
  
  function transformCardsForTable(cards: Card[]): any[] {
    return cards.map(card => {
      // 安全获取修改时间
      const modifiedTime = createSafeDate(card.modified || card.created);
      
      // 安全获取FSRS数据
      const nextReview = card.fsrs?.due ? createSafeDate(card.fsrs.due) : null;
      const retention = card.fsrs?.retrievability ?? 0;
      const interval = card.fsrs?.scheduledDays ?? 0;
      // 将difficulty从number转换为字符串类型
      const difficultyNum = card.fsrs?.difficulty ?? 5;
      const difficulty: "easy" | "medium" | "hard" | undefined = 
        difficultyNum < 4 ? "easy" : difficultyNum < 7 ? "medium" : "hard";
      const reviewCount = card.reviewHistory?.length ?? 0;
      
      // 获取题库统计数据
      const testStats = questionBankStats.get(card.uuid);
      
      // 获取关联记忆卡片信息
      const sourceCardId = card.metadata?.sourceCardId as string | undefined;
      let sourceCardInfo = '-';
      if (sourceCardId && typeof sourceCardId === 'string') {
        // 从记忆学习卡片列表中查找源卡片
        const sourceCard = cards.find(c => c.uuid === sourceCardId);
        if (sourceCard) {
          const sourceFront = getCardContentBySide(sourceCard, 'front', [], " / ");
          sourceCardInfo = sourceFront.length > 30 ? sourceFront.substring(0, 30) + '...' : sourceFront;
        } else {
          sourceCardInfo = `[已删除] ${sourceCardId.substring(0, 8)}...`;
        }
      }
      
      // 性能优化：使用缓存避免重复解析
      const cacheKey = `${card.uuid}_${card.modified || ''}`;
      
      let content = contentCache.get(cacheKey);
      
      if (!content) {
        // 性能优化：只在表格视图真正需要时才计算内容
        // 延迟计算：使用占位符，真正显示时才计算
        if (currentView !== 'table') {
          content = { front: '', back: '' };
        } else {
          // 修复：从 content 解析正反面（使用 ---div--- 分割符）
          let front = '';
          let back = '';
          
          if (card.content && card.content.trim()) {
            // 1. 先剥离 YAML frontmatter
            const bodyContent = extractBodyContent(card.content).trim();
            
            // 2. 使用 ---div--- 分割正反面
            const dividerIndex = bodyContent.indexOf(MAIN_SEPARATOR);
            
            if (dividerIndex >= 0) {
              front = bodyContent.substring(0, dividerIndex).trim();
              back = bodyContent.substring(dividerIndex + MAIN_SEPARATOR.length).trim();
            } else {
              // 无分割符：整个内容作为正面
              front = bodyContent;
            }
          } else {
            // 回退到 fields（兼容 Anki 同步格式）
            front = card.fields?.front || card.fields?.question || '';
            back = card.fields?.back || card.fields?.answer || '';
          }
          
          content = { front, back };
        }
        contentCache.set(cacheKey, content);
        
        // 限制缓存大小，防止内存泄漏
        if (contentCache.size > 1000) { // 增加缓存大小
          // 批量删除旧缓存
          const keysToDelete = [];
          let count = 0;
          for (const key of contentCache.keys()) {
            keysToDelete.push(key);
            if (++count >= 100) break; // 批量删除100个
          }
          keysToDelete.forEach(key => contentCache.delete(key));
        }
      }
      
      return {
        ...card,
        // 修复：确保tags是新数组引用，触发TagsCell响应式更新
        tags: card.tags ? [...card.tags] : [],
        front: content.front,
        back: content.back,
        status: getCardStatusString(card.fsrs?.state ?? 0),
        deck: getCardDeckNames(card), // v2.0: 支持多牌组引用显示
        nextReview: card.fsrs?.due,
        sourceDocumentStatus: getSourceDocumentStatus(card),
        // 修复：添加块引用字段映射
        obsidian_block_link: card.sourceBlock || '-',
        source_document: card.sourceFile || '-',
        // 添加复习历史相关数据（保持字符串类型以兼容Card接口）
        modified: modifiedTime ? modifiedTime.toISOString() : new Date().toISOString(),
        next_review: nextReview,
        retention: retention,
        interval: interval,
        difficulty: difficulty,
        review_count: reviewCount,
        // 添加题库专用数据
        question_type: formatQuestionType(card),
        accuracy: formatAccuracy(card),
        accuracy_class: getAccuracyColorClass(card),
        test_attempts: testStats?.totalAttempts ?? 0,
        last_test: testStats?.lastTestDate ? formatRelativeTime(testStats.lastTestDate) : '-',
        error_level: formatErrorLevel(card),
        source_card: sourceCardInfo, // 关联记忆卡片
      };
    });
  }

  // 获取卡片状态字符串
  function getCardStatusString(state: number): string {
    switch (state) {
      case 0: return "new";
      case 1: return "learning";
      case 2: return "review";
      case 3: return "relearning";
      default: return "unknown";
    }
  }

  // 获取源文档状态
  // 遵循卡片数据结构规范 v1.0：使用专用字段 card.sourceFile
  // v2.1.1: 使用 metadataCache 支持仅文件名格式
  function getSourceDocumentStatus(card: Card): string {
    const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
    // 优先使用专用字段 card.sourceFile
    if (card.sourceFile) {
      const linkText = card.sourceFile.replace(/\.md$/, '');
      const file = plugin.app.metadataCache.getFirstLinkpathDest(linkText, contextPath);
      if (file) {
        return "存在";
      } else {
        return "已删除";
      }
    }
    
    // 向后兼容：检查旧的customFields字段
    if (card.customFields?.obsidianFilePath) {
      const filePath = card.customFields.obsidianFilePath as string;
      if (filePath && typeof filePath === 'string') {
        const linkText = filePath.replace(/\.md$/, '');
        const file = plugin.app.metadataCache.getFirstLinkpathDest(linkText, contextPath);
        if (file) return "存在";
      }
      return "已删除";
    }

    // 没有源文档信息的卡片（如导入的卡片）
    return "无源文档";
  }
  
  // 获取源文档显示文本（用于表格显示）
  function getSourceDocumentText(card: Card): string {
    // 优先使用专用字段
    if (card.sourceFile) {
      // 提取文件名（不含路径）
      const fileName = card.sourceFile.split('/').pop() || card.sourceFile;
      return fileName;
    }
    
    // 向后兼容：使用customFields
    if (card.customFields?.obsidianFilePath) {
      const filePath = card.customFields.obsidianFilePath as string;
      const fileName = filePath.split('/').pop() || filePath;
      return fileName;
    }
    
    return '';
  }
  
  // 点击源文档跳转到文件并高亮显示
  // v2.1.3: 使用 parseSourceInfo 从 card.content 解析源文件信息，与卡片详情模态窗保持一致
  async function jumpToSourceDocument(card: Card) {
    try {
      // 设置导航状态，防止缓存被清理
      isNavigatingToSource = true;
      
      // 清理之前的导航超时
      if (navigationTimeout !== null) {
        clearTimeout(navigationTimeout);
      }
      
      // 设置导航超时，3秒后重置状态
      navigationTimeout = window.setTimeout(() => {
        isNavigatingToSource = false;
        navigationTimeout = null;
      }, 3000);

      const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
      
      let filePath: string | undefined;
      let blockId: string | undefined;
      const filePathCandidates: string[] = [];

      if (card.content) {
        const { parseYAMLFromContent } = await import('../../utils/yaml-utils');
        const yaml = parseYAMLFromContent(card.content);
        const sourceValue = Array.isArray((yaml as any).we_source) ? (yaml as any).we_source[0] : (yaml as any).we_source;
        if (typeof sourceValue === 'string') {
          const start = sourceValue.indexOf('[[');
          const end = sourceValue.lastIndexOf(']]');
          if (start !== -1 && end !== -1 && end > start + 2) {
            let linkText = sourceValue.slice(start + 2, end).trim();
            const aliasIndex = linkText.indexOf('|');
            if (aliasIndex !== -1) {
              linkText = linkText.slice(0, aliasIndex).trim();
            }
            const pathOnly = linkText.split('#')[0].replace(/\.md$/, '');
            if (pathOnly) {
              let file = plugin.app.metadataCache.getFirstLinkpathDest(pathOnly, contextPath);
              // fallback: getFirstLinkpathDest may miss files in hidden folders (e.g. .epub/)
              if (!file && pathOnly.toLowerCase().endsWith('.epub')) {
                const abstractFile = plugin.app.vault.getAbstractFileByPath(pathOnly);
                if (abstractFile && 'extension' in abstractFile) {
                  file = abstractFile as TFile;
                } else {
                  // fallback: search by filename across the entire vault (handles moved files)
                  const epubName = pathOnly.split('/').pop() || pathOnly;
                  const found = plugin.app.vault.getFiles().find(f => f.name === epubName && f.extension === 'epub');
                  if (found) file = found;
                }
              }
              if (file) {
                // EPUB文件：拦截到插件内置阅读器，避免系统外部阅读器打开
                if (pathOnly.toLowerCase().endsWith('.epub')) {
                  const hashPart = linkText.includes('#') ? linkText.slice(linkText.indexOf('#')) : '';
                  const { EpubLinkService } = await import('../../services/epub/EpubLinkService');
                  const parsed = EpubLinkService.parseEpubLink(hashPart);
                  const linkService = new EpubLinkService(plugin.app);
                  await linkService.navigateToEpubLocation(file.path, parsed?.cfi || '', parsed?.text || '');
                  new Notice(parsed?.cfi ? '已跳转到EPUB源位置' : '已打开EPUB源文档');
                  return;
                }
                await plugin.app.workspace.openLinkText(linkText, contextPath, false);
                if (linkText.includes('#^')) {
                  new Notice('已跳转到源文档块');
                } else {
                  new Notice('已打开源文档');
                }
                return;
              }
            }
          }
        }
      }
      
      // v2.1.3: 优先从 card.content YAML 解析源文件信息（与卡片详情模态窗保持一致）
      if (card.content) {
        const { parseSourceInfo } = await import('../../utils/yaml-utils');
        const sourceInfo = parseSourceInfo(card.content);
        if (sourceInfo.sourceFile) {
          filePath = sourceInfo.sourceFile;
          blockId = sourceInfo.sourceBlock?.replace(/^\^/, ''); // 移除^前缀
          filePathCandidates.push(filePath);
        }
      }
      
      // 向后兼容：如果 content 解析失败，使用派生字段
      if (!filePath && card.sourceFile) {
        filePath = card.sourceFile;
        blockId = card.sourceBlock?.replace(/^\^/, '');
      }
      if (card.sourceFile && !filePathCandidates.includes(card.sourceFile)) {
        filePathCandidates.push(card.sourceFile);
      }
      
      // 向后兼容：customFields
      if (!filePath && card.customFields?.obsidianFilePath) {
        filePath = card.customFields.obsidianFilePath as string;
        blockId = card.customFields.blockId as string;
      }
      if (card.customFields?.obsidianFilePath && typeof card.customFields.obsidianFilePath === 'string') {
        const p = card.customFields.obsidianFilePath as string;
        if (!filePathCandidates.includes(p)) {
          filePathCandidates.push(p);
        }
      }
      
      if (!filePath) {
        new Notice('此卡片没有关联的源文档');
        isNavigatingToSource = false;
        return;
      }
      
      // EPUB文件：使用插件内置EPUB阅读器打开
      if (filePath.toLowerCase().endsWith('.epub')) {
        let epubCfi = '';
        let epubText = '';
        // 从卡片内容中提取CFI和文本（用于精确定位）
        if (card.content) {
          // 1) protocol URL format: obsidian://weave-epub?cfi=...&text=...
          const epubLinkMatch = card.content.match(/obsidian:\/\/weave-epub\?[^)\s]*/);
          if (epubLinkMatch) {
            try {
              const url = new URL(epubLinkMatch[0]);
              epubCfi = url.searchParams.get('cfi') || '';
              epubText = url.searchParams.get('text') || '';
            } catch {
              const cfiMatch = epubLinkMatch[0].match(/[?&]cfi=([^&]*)/);
              const textMatch = epubLinkMatch[0].match(/[?&]text=([^&]*)/);
              if (cfiMatch) {
                try { epubCfi = decodeURIComponent(cfiMatch[1]); } catch { epubCfi = cfiMatch[1]; }
              }
              if (textMatch) {
                try { epubText = decodeURIComponent(textMatch[1]); } catch { epubText = textMatch[1]; }
              }
            }
          }
          // 2) wikilink format: [[file.epub#weave-cfi=epubcfi(...)]] or legacy [[file.epub#tuanki-cfi-epubcfi(...)]]
          if (!epubCfi) {
            const wikiCfiMatch = card.content.match(/(?:weave-cfi=|tuanki-cfi-)(epubcfi\([^)]*\))|(?:weave-cfi=|tuanki-cfi-)([^&|\]\s]*)/);
            if (wikiCfiMatch) {
              const rawCfi = wikiCfiMatch[1] || wikiCfiMatch[2] || '';
              const { EpubLinkService } = await import('../../services/epub/EpubLinkService');
              epubCfi = EpubLinkService.normalizeCfi(rawCfi);
            }
          }
        }
        // resolve filePath via vault to handle shortest-path or hidden folders
        let resolvedPath = filePath;
        const abstractFile = plugin.app.vault.getAbstractFileByPath(filePath);
        if (abstractFile) {
          resolvedPath = abstractFile.path;
        } else {
          const metaFile = plugin.app.metadataCache.getFirstLinkpathDest(filePath.replace(/\.epub$/i, '.epub'), '');
          if (metaFile) {
            resolvedPath = metaFile.path;
          } else {
            // fallback: search by filename across the entire vault
            const epubFileName = filePath.split('/').pop() || filePath;
            const found = plugin.app.vault.getFiles().find(f => f.name === epubFileName && f.extension === 'epub');
            if (found) {
              resolvedPath = found.path;
              logger.debug('[CardMgmt] EPUB resolved by filename search:', resolvedPath);
            }
          }
        }
        const { EpubLinkService } = await import('../../services/epub/EpubLinkService');
        const linkService = new EpubLinkService(plugin.app);
        await linkService.navigateToEpubLocation(resolvedPath, epubCfi, epubText);
        new Notice(epubCfi ? '已跳转到EPUB源位置' : '已打开EPUB源文档');
        return;
      }
      
      // Markdown文件：使用Obsidian原生跳转
      const docName = filePath.replace(/\.md$/, '');
      const linktext = blockId ? `${docName}#^${blockId}` : docName;
      await plugin.app.workspace.openLinkText(linktext, contextPath, false);
      
      if (blockId) {
        new Notice('已跳转到源文档块');
      } else {
        new Notice('已打开源文档');
      }
    } catch (error) {
      logger.error('跳转到源文档失败:', error);
      new Notice('跳转失败');
    } finally {
      // 确保导航状态被重置
      isNavigatingToSource = false;
    }
  }

  // 清除所有全局筛选
  function clearGlobalFilters() {
    plugin.filterStateService?.clearAll();
    // 清除自定义卡片ID筛选
    customCardIdsFilter = null;
    customFilterName = '';
    new Notice('已清除所有筛选');
  }

  // 批量更新源文档状态
  async function updateSourceDocumentStatus() {
    try {
      const updatedCards = await Promise.all(
        cards.map(async (card: Card) => {
          const status = getSourceDocumentStatus(card);
          const exists = status === "存在";

          // 更新卡片的 sourceDocumentExists 属性
          const updatedCard = {
            ...card,
            sourceDocumentExists: exists
          };

          // 保存到数据库
          await plugin.dataStorage.saveCard(updatedCard);
          return updatedCard;
        })
      );

      // 重新加载卡片数据
      await loadCards();
      
      // 已移除旧的 CustomEvent 触发（Weave:refresh-decks）
      // 现在通过 DataSyncService 在 saveCard 时自动通知

      new Notice(`已更新 ${updatedCards.length} 张卡片的源文档状态`);
    } catch (error) {
      logger.error('更新源文档状态失败:', error);
      new Notice('更新源文档状态失败');
    }
  }
  // 孤儿卡片扫描（只在表格工具栏点击时触发）
  async function handleScanOrphanCards() {
    const files = plugin.app.vault.getMarkdownFiles();

    function findFileByName(name: string) {
      return files.find((f: any) => f.basename === name || f.name === name || f.name === `${name}.md`);
    }

    async function checkCard(card: Card): Promise<'存在' | '缺失' | '无源文档'> {
      try {
        const fields = (card as any).fields || {};
        const link: string | undefined = fields.obsidian_block_link;
        let filePath: string | undefined;
        let blockId: string | undefined;

        if (typeof link === 'string' && link.includes('#^')) {
          const m = link.match(/\[\[([^#\]]+)#\^([^\]]+)\]\]/);
          if (m) {
            const fileName = m[1];
            blockId = m[2];
            const f = findFileByName(fileName);
            filePath = f?.path;
          }
        } else if (typeof link === 'string' && link.startsWith('^')) {
          blockId = link.replace(/^\^/, '');
          const fileName = typeof fields.source_document === 'string' ? fields.source_document : undefined;
          if (fileName) filePath = findFileByName(fileName)?.path;
          if (!filePath && typeof fields.source_file === 'string') filePath = fields.source_file;
        }

        if (!filePath) return '无源文档';
        if (!blockId) return '缺失';

        const f = plugin.app.vault.getAbstractFileByPath(filePath);
        if (!f) return '缺失';
        const content = await plugin.app.vault.read(f as any);
        const re = new RegExp(`\\^${blockId}(?![A-Za-z0-9_-])`);
        return re.test(content) ? '存在' : '缺失';
      } catch (e) {
        logger.warn('[Scan] 检查卡片失败', e);
        return '缺失';
      }
    }

    let exist = 0, missing = 0, none = 0;
    for (let i = 0; i < cards.length; i++) {
      const status = await checkCard(cards[i]);
      (cards[i] as any).sourceDocumentStatus = status;
      if (status === '存在') exist++; else if (status === '缺失') missing++; else none++;
    }

    // 触发渲染
    cards = [...cards];

    try {
      new Notice(`扫描完成：存在 ${exist}，缺失 ${missing}，无源文档 ${none}`);
    } catch {
      logger.debug(`扫描完成：存在 ${exist}，缺失 ${missing}，无源文档 ${none}`);
    }
  }


  // 搜索功能
  function handleSearch(query: string) {
    searchQuery = query;
    // 解析搜索查询
    parsedSearchQuery = parseSearchQuery(query);
    currentPage = 1;
  }
  
  // 清除搜索
  function handleClearSearch() {
    searchQuery = "";
    parsedSearchQuery = null;
    currentPage = 1;
  }
  
  // 视图切换回调函数（用于移动端头部组件）
  function handleViewChange(view: 'table' | 'grid' | 'kanban') {
    switchView(view);
  }

  // 筛选功能
  function handleFilterChange(data: { type: string; value: string; checked: boolean }) {
    const { type, value, checked } = data;

    // 支持所有筛选类型
    if (type === 'status' || type === 'decks' || type === 'tags' || type === 'questionTypes' || type === 'errorBooks') {
      if (checked) {
        filters[type].add(value);
      } else {
        filters[type].delete(value);
      }
      filters = { ...filters }; // 触发响应式更新
      currentPage = 1;
    }
  }

  function handleClearFilters() {
    filters.status = new Set();
    filters.decks = new Set();
    filters.tags = new Set();
    filters.questionTypes = new Set();
    filters.errorBooks = new Set();
  }

  function handleDeleteSavedFilter(filterId: string) {
    if (!filterManager) return;
    
    filterManager.deleteFilter(filterId);
    savedFilters = filterManager.getAllFilters();
    showNotification('筛选器已删除', 'success');
  }

  function handleUpdateSavedFilter(filter: SavedFilter) {
    if (!filterManager) return;
    
    filterManager.updateFilter(filter.id, filter);
    savedFilters = filterManager.getAllFilters();
    showNotification('筛选器已更新', 'success');
  }
  
  /**
   * 清理空父文件夹
   * @param filePath 已删除文件的路径
   */
  async function cleanEmptyParentFolders(filePath: string): Promise<void> {
    // 获取父文件夹路径
    const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!parentPath || parentPath === 'incremental-reading/files/chunks') {
      return; // 不删除根目录
    }
    
    // 尝试删除当前文件夹
    const deleted = await cleanEmptyFolder(parentPath);
    
    // 如果成功删除，继续检查上级文件夹
    if (deleted) {
      const grandParentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
      if (grandParentPath && grandParentPath.includes('chunks')) {
        await cleanEmptyFolder(grandParentPath);
      }
    }
  }
  
  /**
   * 检查并删除空文件夹
   * @param folderPath 文件夹路径
   * @returns 是否成功删除
   */
  async function cleanEmptyFolder(folderPath: string): Promise<boolean> {
    try {
      const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
      if (!folder || !(folder instanceof TFolder)) {
        return false;
      }
      
      // 检查文件夹是否为空
      if (folder.children.length === 0) {
        await plugin.app.fileManager.trashFile(folder);
        logger.info(`[卡片管理] 删除空文件夹: ${folderPath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`[卡片管理] 删除空文件夹失败: ${folderPath}`, error);
      return false;
    }
  }

  // 排序功能
  function handleSort(field: string) {
    // 第一层保护：同步标志位立即阻止
    if (sortingLock) {
      // 排序锁定中
      return;
    }

    // 第二层保护：响应式状态检查
    if (isSorting) {
      // 排序进行中
      return;
    }

    // 清除之前的定时器（如果存在）
    if (sortLockReleaseTimer !== null) {
      clearTimeout(sortLockReleaseTimer);
      sortLockReleaseTimer = null;
    }

    // 立即启用同步锁
    sortingLock = true;

    // 启用加载状态（UI更新）
    isSorting = true;
    
    // 记录排序开始时间
    sortStartTime = Date.now();
    
    // 生成新的排序请求ID
    sortRequestId++;

    // 排序开始

    // 更新排序配置
    if (sortConfig.field === field) {
      sortConfig.direction = sortConfig.direction === "asc" ? "desc" : "asc";
    } else {
      sortConfig.field = field;
      sortConfig.direction = "desc";
    }
    
    // 注意：锁的释放现在在 $effect 中排序完成后执行
  }
  
  // 显示排序菜单
  function handleShowSortMenu(e: MouseEvent) {
    const menu = new Menu();
    
    const sortFields = [
      { field: 'created', label: '创建时间', icon: ICON_NAMES.CLOCK },
      { field: 'modified', label: '修改时间', icon: ICON_NAMES.CLOCK },
      { field: 'front', label: '正面内容', icon: ICON_NAMES.FILE_TEXT },
      { field: 'back', label: '背面内容', icon: ICON_NAMES.FILE_TEXT },
      { field: 'deck', label: '牌组', icon: ICON_NAMES.FOLDER },
      { field: 'tags', label: '标签', icon: ICON_NAMES.TAG },
      { field: 'status', label: '状态', icon: ICON_NAMES.CHECK_CIRCLE },
    ];
    
    sortFields.forEach(({ field, label, icon }) => {
      menu.addItem((item) => {
        item.setTitle(label);
        item.setIcon(icon);
        
        // 显示当前排序状态
        if (sortConfig.field === field) {
          item.setChecked(true);
          if (sortConfig.direction === 'asc') {
            item.setTitle(`${label} ↑`);
          } else {
            item.setTitle(`${label} ↓`);
          }
        }
        
        item.onClick(() => {
          handleSort(field);
        });
      });
    });
    
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
  }


  // 选择功能
  function handleCardSelect(cardUuid: string, selected: boolean) {
    const newSelectedCards = new Set(selectedCards);
    if (selected) {
      newSelectedCards.add(cardUuid);
    } else {
      newSelectedCards.delete(cardUuid);
    }
    selectedCards = newSelectedCards; // 创建新的 Set 实例
  }

  function handleSelectAll(selected: boolean) {
    if (selected) {
      // 创建 filteredCards 的稳定副本，避免在状态变化过程中访问
      const currentFilteredCards = [...filteredCards];
      const visibleCardUuids = currentFilteredCards.map(card => card.uuid);
      selectedCards = new Set(visibleCardUuids);
    } else {
      selectedCards = new Set();
    }
  }

  function handleClearSelection() {
    selectedCards = new Set();
  }

  // 分页事件处理
  function handlePageChange(page: number) {
    currentPage = page;
    // 响应式系统会自动更新 filteredCards
  }

  function handleItemsPerPageChange(size: number) {
    itemsPerPage = size;
    currentPage = 1;
    // 响应式系统会自动更新 filteredCards，无需防抖
  }


  // 批量操作事件处理 - 使用 Obsidian Menu API
  let lastBatchDeckMenuPosition: { x: number; y: number } | null = null;

  function handleBatchChangeDeck(event?: MouseEvent) {
    const selectedCardIds = Array.from(selectedCards);
    logger.debug("更换牌组:", selectedCardIds);

    if (selectedCardIds.length === 0) {
      new Notice("请先选择要更换牌组的卡片");
      return;
    }

    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      lastBatchDeckMenuPosition = { x: rect.left, y: rect.top - 8 };
    } else {
      lastBatchDeckMenuPosition = { x: window.innerWidth / 2, y: window.innerHeight - 100 };
    }

    // 使用分组菜单：记忆牌组 / 考试牌组
    const menu = new Menu();
    (menu as any).app = plugin.app;

    // 记忆牌组子菜单
    menu.addItem((item) => {
      item.setTitle('记忆牌组').setIcon('graduation-cap');
      const submenu = (item as any).setSubmenu();

      const selectedSet = new Set(selectedCardIds);
      allDecks.forEach((deck) => {
        const deckCardUUIDs = new Set(deck.cardUUIDs || []);
        let anyInDeck = false;
        let allInDeck = true;
        for (const uuid of selectedSet) {
          if (deckCardUUIDs.has(uuid)) { anyInDeck = true; } else { allInDeck = false; }
        }
        const indentLevel = deck.level || 0;
        const prefix = indentLevel > 0 ? '  '.repeat(indentLevel) + '└ ' : '';

        submenu.addItem((subItem: any) => {
          subItem.setTitle(prefix + deck.name);
          if (allInDeck) { subItem.setIcon('check-square'); }
          else { subItem.setIcon(anyInDeck ? 'minus-square' : 'square'); }
          subItem.onClick(async () => {
            await handleBatchToggleDeckReference(deck, { allInDeck }, selectedCardIds);
          });
        });
      });
    });

    // 考试牌组子菜单
    menu.addItem((item) => {
      item.setTitle('考试牌组').setIcon('clipboard-list');
      const submenu = (item as any).setSubmenu();

      if (questionBankStorage && plugin.questionBankService) {
        const banks = plugin.questionBankService.getAllQuestionBanks();
        if (banks.length > 0) {
          banks.forEach((bank) => {
            submenu.addItem((subItem: any) => {
              subItem.setTitle(bank.name).setIcon('edit-3');
              subItem.onClick(async () => {
                await handleBatchAddToExamDeck(bank.id, selectedCardIds);
              });
            });
          });
        } else {
          submenu.addItem((subItem: any) => {
            subItem.setTitle('暂无考试牌组').setDisabled(true);
          });
        }
      } else {
        submenu.addItem((subItem: any) => {
          subItem.setTitle('考试牌组服务未初始化').setDisabled(true);
        });
      }
    });

    menu.showAtPosition(lastBatchDeckMenuPosition!);
  }

  // 批量将选择题卡片添加到考试牌组
  async function handleBatchAddToExamDeck(bankId: string, selectedCardIds: string[]) {
    try {
      if (!plugin.questionBankService) {
        showNotification('考试牌组服务未初始化', 'error');
        return;
      }

      // 从选中的卡片中筛选出选择题类型
      const sourceCards = dataSource === 'questionBank' ? questionBankCards : cards;
      const selectedCardData = sourceCards.filter(c => selectedCardIds.includes(c.uuid));
      const choiceCards = selectedCardData.filter(c => {
        const questionType = detectCardQuestionType(c);
        return questionType === 'single-choice' || questionType === 'multiple-choice';
      });

      if (choiceCards.length === 0) {
        showNotification('选中的卡片中没有选择题类型的卡片', 'warning');
        return;
      }

      // 获取考试牌组信息
      const bank = plugin.questionBankService.getQuestionBank(bankId);
      if (!bank) {
        showNotification('考试牌组不存在', 'error');
        return;
      }

      // 将选择题卡片的 UUID 引用添加到考试牌组
      const existingUUIDs = new Set(bank.cardUUIDs || []);
      let addedCount = 0;
      for (const card of choiceCards) {
        if (!existingUUIDs.has(card.uuid)) {
          existingUUIDs.add(card.uuid);
          addedCount++;
        }
      }

      if (addedCount === 0) {
        showNotification('选中的选择题卡片已在该考试牌组中', 'info');
        return;
      }

      bank.cardUUIDs = Array.from(existingUUIDs);
      bank.modified = new Date().toISOString();
      await questionBankStorage!.saveBanks(plugin.questionBankService.getAllQuestionBanks());

      showNotification(`已将 ${addedCount} 张选择题添加到考试牌组"${bank.name}"`, 'success');
    } catch (error) {
      logger.error('添加到考试牌组失败:', error);
      showNotification('操作失败', 'error');
    }
  }

  function showBatchDeckMultiSelectMenu(selectedCardIds: string[]) {
    if (!lastBatchDeckMenuPosition) {
      lastBatchDeckMenuPosition = { x: window.innerWidth / 2, y: window.innerHeight - 100 };
    }

    const menu = new Menu();
    (menu as any).app = plugin.app;

    menu.addItem((item) => {
      item.setTitle(`设置 ${selectedCardIds.length} 张卡片所属牌组`);
      item.setDisabled(true);
    });

    menu.addSeparator();

    const selectedSet = new Set(selectedCardIds);

    allDecks.forEach((deck) => {
      const deckCardUUIDs = new Set(deck.cardUUIDs || []);

      let anyInDeck = false;
      let allInDeck = true;

      for (const uuid of selectedSet) {
        if (deckCardUUIDs.has(uuid)) {
          anyInDeck = true;
        } else {
          allInDeck = false;
        }
      }

      const indentLevel = deck.level || 0;
      const prefix = indentLevel > 0 ? '  '.repeat(indentLevel) + '└ ' : '';

      menu.addItem((item) => {
        item.setTitle(prefix + deck.name);

        if (allInDeck) {
          item.setIcon('check-square');
        } else {
          item.setIcon(anyInDeck ? 'minus-square' : 'square');
        }

        item.onClick(async () => {
          await handleBatchToggleDeckReference(deck, { allInDeck }, selectedCardIds);

          if (lastBatchDeckMenuPosition) {
            setTimeout(() => {
              showBatchDeckMultiSelectMenu(selectedCardIds);
            }, 0);
          }
        });
      });
    });

    menu.showAtPosition(lastBatchDeckMenuPosition);
  }

  async function handleBatchToggleDeckReference(
    deck: Deck,
    current: { allInDeck: boolean },
    cardUUIDs: string[]
  ) {
    const referenceDeckService = plugin.referenceDeckService;
    if (!referenceDeckService) {
      showNotification("ReferenceDeckService 未初始化", "error");
      return;
    }

    try {
      const now = new Date().toISOString();

      if (current.allInDeck) {
        await referenceDeckService.removeCardsFromDeck(deck.id, cardUUIDs);

        const removeSet = new Set(cardUUIDs);
        allDecks = allDecks.map((d) => {
          if (d.id !== deck.id) return d;
          const next = (d.cardUUIDs || []).filter((uuid) => !removeSet.has(uuid));
          return { ...d, cardUUIDs: next, modified: now };
        });

        cards = cards.map((c) => {
          if (!removeSet.has(c.uuid)) return c;
          const metadata = getCardMetadata(c.content || '');
          const weDecks = new Set(metadata.we_decks || []);
          weDecks.delete(deck.name);
          weDecks.delete(deck.id);

          const nextRefs = new Set(c.referencedByDecks || []);
          nextRefs.delete(deck.id);

          return {
            ...c,
            referencedByDecks: Array.from(nextRefs),
            content: setCardProperties(c.content || '', {
              we_decks: weDecks.size > 0 ? Array.from(weDecks) : undefined
            }),
            modified: now
          };
        });
      } else {
        await referenceDeckService.addCardsToDeck(deck.id, cardUUIDs);

        const addSet = new Set(cardUUIDs);
        allDecks = allDecks.map((d) => {
          if (d.id !== deck.id) return d;
          const next = new Set([...(d.cardUUIDs || []), ...cardUUIDs]);
          return { ...d, cardUUIDs: Array.from(next), modified: now };
        });

        cards = cards.map((c) => {
          if (!addSet.has(c.uuid)) return c;
          const metadata = getCardMetadata(c.content || '');
          const weDecks = new Set(metadata.we_decks || []);
          weDecks.delete(deck.id);
          weDecks.add(deck.name);

          const nextRefs = new Set(c.referencedByDecks || []);
          nextRefs.add(deck.id);

          return {
            ...c,
            referencedByDecks: Array.from(nextRefs),
            content: setCardProperties(c.content || '', { we_decks: Array.from(weDecks) }),
            modified: now
          };
        });
      }

      dataVersion++;
    } catch (error) {
      logger.error('[WeaveCardManagement] 批量更换牌组失败:', error);
      showNotification("批量更换牌组失败", "error");
    }
  }

  function handleBatchChangeTemplate() {
    // 批量更换模板功能已删除（基于弃用的字段模板系统）
    showNotification("此功能已移除：新系统使用MD编辑+动态解析，无需模板更换", "info");
  }

  function handleBatchCopy() {
    const selectedCardIds = Array.from(selectedCards);
    logger.debug("批量复制:", selectedCardIds);

    if (selectedCardIds.length === 0) {
      new Notice("请先选择要复制的卡片");
      return;
    }

    // 获取选中的卡片数据
    const selectedCardData = filteredCards.filter(card => selectedCardIds.includes(card.uuid));

    // 创建复制的文本内容
    // v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
    const copyText = selectedCardData.map(card => {
      const { primaryDeckId } = getCardDeckIds(card);
      const deck = allDecks.find(d => d.id === (primaryDeckId || card.deckId));
      return `正面: ${card.fields?.front || card.fields?.question || ''}
背面: ${card.fields?.back || card.fields?.answer || ''}
标签: ${card.tags?.join(', ') || '无'}
牌组: ${deck?.name || '默认'}
---`;
    }).join('\n');

    // 复制到剪贴板
    navigator.clipboard.writeText(copyText).then(() => {
      new Notice(`已复制 ${selectedCardIds.length} 张卡片到剪贴板`);
    }).catch(() => {
      new Notice("复制失败，请重试");
    });
  }

  // 导出笔记（MD + CSV，支持多种分组方式）
  type ExportFormat = 'md' | 'csv';
  type ExportMode = 'single' | 'bySource' | 'byMonth' | 'byDeck';

  function handleExportToMd(event?: MouseEvent) {
    const selectedCardIds = Array.from(selectedCards);
    if (selectedCardIds.length === 0) {
      new Notice(t('cardManagement.batchToolbar.exportNoCards'));
      return;
    }

    const selectedCardData = filteredAndSortedCards.filter(card => selectedCardIds.includes(card.uuid));
    if (selectedCardData.length === 0) {
      new Notice(t('cardManagement.batchToolbar.exportNoCards'));
      return;
    }

    const menu = new Menu();

    // --- Markdown 导出 ---
    menu.addItem(item => { item.setTitle('Markdown'); item.setIsLabel(true); });
    menu.addItem(item => {
      item.setTitle('导出为一个文件');
      item.setIcon('file-text');
      item.onClick(() => showExportFolderPicker('single', 'md', selectedCardData));
    });
    menu.addItem(item => {
      item.setTitle('按来源分别导出');
      item.setIcon('files');
      item.onClick(() => showExportFolderPicker('bySource', 'md', selectedCardData));
    });
    menu.addItem(item => {
      item.setTitle('按月份分别导出');
      item.setIcon('calendar');
      item.onClick(() => showExportFolderPicker('byMonth', 'md', selectedCardData));
    });
    menu.addItem(item => {
      item.setTitle('按牌组分别导出');
      item.setIcon('folder');
      item.onClick(() => showExportFolderPicker('byDeck', 'md', selectedCardData));
    });

    menu.addSeparator();

    // --- CSV 导出 ---
    menu.addItem(item => { item.setTitle('CSV'); item.setIsLabel(true); });
    menu.addItem(item => {
      item.setTitle('导出为一个文件');
      item.setIcon('file-spreadsheet');
      item.onClick(() => showExportFolderPicker('single', 'csv', selectedCardData));
    });
    menu.addItem(item => {
      item.setTitle('按来源分别导出');
      item.setIcon('files');
      item.onClick(() => showExportFolderPicker('bySource', 'csv', selectedCardData));
    });
    menu.addItem(item => {
      item.setTitle('按月份分别导出');
      item.setIcon('calendar');
      item.onClick(() => showExportFolderPicker('byMonth', 'csv', selectedCardData));
    });
    menu.addItem(item => {
      item.setTitle('按牌组分别导出');
      item.setIcon('folder');
      item.onClick(() => showExportFolderPicker('byDeck', 'csv', selectedCardData));
    });

    if (event) {
      const el = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
      const rect = el.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.top - 8 });
    } else {
      menu.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight - 100 });
    }
  }

  // 显示文件夹选择器
  function showExportFolderPicker(mode: ExportMode, format: ExportFormat, cardsToExport: Card[]) {
    const allFolders: string[] = [''];
    function collectFolders(folder: TFolder) {
      if (folder.path) allFolders.push(folder.path);
      for (const child of folder.children) {
        if (child instanceof TFolder) collectFolders(child);
      }
    }
    collectFolders(plugin.app.vault.getRoot());
    allFolders.sort((a, b) => a.localeCompare(b, 'zh-CN'));

    const modal = new ExportFolderPickerModal(plugin.app, allFolders, (item) => executeExport(mode, format, cardsToExport, item));
    modal.setPlaceholder(t('cardManagement.batchToolbar.exportSelectFolder'));
    modal.open();
  }

  // 执行导出（统一入口）
  async function executeExport(mode: ExportMode, format: ExportFormat, cardsToExport: Card[], folderPath: string) {
    try {
      if (format === 'csv') {
        await executeCSVExport(mode, cardsToExport, folderPath);
      } else {
        await executeMDExport(mode, cardsToExport, folderPath);
      }
    } catch (error: any) {
      logger.error('导出失败:', error);
      new Notice(t('cardManagement.batchToolbar.exportFailed').replace('{error}', error.message || String(error)));
    }
  }

  // MD 导出（含分组）
  async function executeMDExport(mode: ExportMode, cardsToExport: Card[], folderPath: string) {
    if (mode === 'single') {
      await exportAsSingleFile(cardsToExport, folderPath);
    } else {
      const groups = getExportGroups(mode, cardsToExport);
      await exportGroupedMD(groups, folderPath);
    }
  }

  // CSV 导出（含分组）
  async function executeCSVExport(mode: ExportMode, cardsToExport: Card[], folderPath: string) {
    if (mode === 'single') {
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `Weave Export ${timestamp}.csv`;
      const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const csvContent = cardsToCSV(cardsToExport, allDecks);
      const finalPath = await getUniqueFilePath(filePath);
      await plugin.app.vault.create(finalPath, csvContent);
      new Notice(`已导出 ${cardsToExport.length} 张卡片到 ${finalPath}`);
    } else {
      const groups = getExportGroups(mode, cardsToExport);
      let totalExported = 0;
      let fileCount = 0;
      for (const [groupKey, groupCards] of groups) {
        const baseName = sanitizeFileName(groupKey === '__no_source__' || groupKey === '__no_deck__' || groupKey === '__unknown__'
          ? `Weave Export - Ungrouped`
          : `Weave Export - ${groupKey}`);
        const filePath = folderPath ? `${folderPath}/${baseName}.csv` : `${baseName}.csv`;
        const csvContent = cardsToCSV(groupCards, allDecks);
        const finalPath = await getUniqueFilePath(filePath);
        await plugin.app.vault.create(finalPath, csvContent);
        totalExported += groupCards.length;
        fileCount++;
      }
      new Notice(`已导出 ${totalExported} 张卡片到 ${fileCount} 个 CSV 文件`);
    }
  }

  // 获取分组结果
  function getExportGroups(mode: ExportMode, cardsToExport: Card[]): Map<string, Card[]> {
    switch (mode) {
      case 'bySource': return groupCardsBySource(cardsToExport);
      case 'byMonth': return groupCardsByMonth(cardsToExport);
      case 'byDeck': return groupCardsByDeck(cardsToExport, allDecks);
      default: {
        const m = new Map<string, Card[]>();
        m.set('all', cardsToExport);
        return m;
      }
    }
  }

  // MD 分组导出
  async function exportGroupedMD(groups: Map<string, Card[]>, folderPath: string) {
    let totalExported = 0;
    let fileCount = 0;
    for (const [groupKey, groupCards] of groups) {
      const baseName = sanitizeFileName(groupKey === '__no_source__' || groupKey === '__no_deck__' || groupKey === '__unknown__'
        ? 'Weave Export - Ungrouped'
        : `Weave Export - ${groupKey}`);
      const filePath = folderPath ? `${folderPath}/${baseName}.md` : `${baseName}.md`;
      const sections = groupCards.map(card => formatCardForExport(card));
      const content = sections.join('\n\n---\n\n') + '\n';
      const finalPath = await getUniqueFilePath(filePath);
      await plugin.app.vault.create(finalPath, content);
      totalExported += groupCards.length;
      fileCount++;
    }
    new Notice(
      t('cardManagement.batchToolbar.exportSuccessMultiple')
        .replace('{count}', String(totalExported))
        .replace('{fileCount}', String(fileCount))
    );
  }

  // 获取卡片的来源链接文本
  function getCardSourceLink(card: Card): string {
    // 优先从content YAML获取来源信息
    const sourceInfo = parseSourceInfo(card.content || '');
    if (sourceInfo.sourceFile) {
      const docName = sourceInfo.sourceFile.replace(/\.md$/, '');
      if (sourceInfo.sourceBlock) {
        return `[[${docName}#^${sourceInfo.sourceBlock}]]`;
      }
      return `[[${docName}]]`;
    }
    // 回退到卡片的sourceFile字段
    if (card.sourceFile) {
      const docName = card.sourceFile.replace(/\.md$/, '');
      if (card.sourceBlock) {
        return `[[${docName}#^${card.sourceBlock}]]`;
      }
      return `[[${docName}]]`;
    }
    return '';
  }

  // 获取卡片的来源文档标识（用于分组）
  function getCardSourceKey(card: Card): string {
    const sourceInfo = parseSourceInfo(card.content || '');
    if (sourceInfo.sourceFile) {
      return sourceInfo.sourceFile;
    }
    if (card.sourceFile) {
      return card.sourceFile;
    }
    return '__no_source__';
  }

  // 格式化单张卡片为MD内容
  function formatCardForExport(card: Card): string {
    let bodyContent = extractBodyContent(card.content || '').trim();

    // 将内部分隔符 ---div--- 替换为标准 Markdown 水平线
    bodyContent = bodyContent.replace(/^\s*---div---\s*$/gm, '---');

    const sourceLink = getCardSourceLink(card);

    let result = bodyContent;
    // 仅当来源是有效的 wikilink 时才添加 Source 行（排除内部ID）
    if (sourceLink && sourceLink.includes('[[')) {
      result += `\n\n> Source: ${sourceLink}`;
    }
    return result;
  }

  // 导出为单个文件
  async function exportAsSingleFile(cardsToExport: Card[], folderPath: string) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Weave Export ${timestamp}.md`;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const sections: string[] = [];
    for (const card of cardsToExport) {
      sections.push(formatCardForExport(card));
    }

    const content = sections.join('\n\n---\n\n') + '\n';

    // 检查文件是否已存在，若存在则加数字后缀
    const finalPath = await getUniqueFilePath(filePath);
    await plugin.app.vault.create(finalPath, content);

    new Notice(
      t('cardManagement.batchToolbar.exportSuccess')
        .replace('{count}', String(cardsToExport.length))
        .replace('{path}', finalPath)
    );
  }

  // 按来源文档分别导出
  async function exportBySource(cardsToExport: Card[], folderPath: string) {
    // 按来源文档分组（保持排序顺序）
    const groups = new Map<string, Card[]>();
    for (const card of cardsToExport) {
      const key = getCardSourceKey(card);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(card);
    }

    let totalExported = 0;
    let fileCount = 0;

    for (const [sourceKey, groupCards] of groups) {
      // 生成文件名
      let baseName: string;
      if (sourceKey === '__no_source__') {
        baseName = 'Weave Export - No Source';
      } else {
        baseName = `Weave Export - ${sourceKey.replace(/\.md$/, '').replace(/[\\/:*?"<>|]/g, '_')}`;
      }
      const fileName = `${baseName}.md`;
      const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

      const sections: string[] = [];
      for (const card of groupCards) {
        sections.push(formatCardForExport(card));
      }

      const content = sections.join('\n\n---\n\n') + '\n';

      const finalPath = await getUniqueFilePath(filePath);
      await plugin.app.vault.create(finalPath, content);

      totalExported += groupCards.length;
      fileCount++;
    }

    new Notice(
      t('cardManagement.batchToolbar.exportSuccessMultiple')
        .replace('{count}', String(totalExported))
        .replace('{fileCount}', String(fileCount))
    );
  }

  // 获取唯一文件路径（避免覆盖已有文件，支持 .md 和 .csv）
  async function getUniqueFilePath(filePath: string): Promise<string> {
    const extMatch = filePath.match(/\.(md|csv)$/);
    const ext = extMatch ? extMatch[0] : '.md';
    const basePath = filePath.replace(/\.(md|csv)$/, '');
    let candidate = filePath;
    let counter = 1;
    while (plugin.app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${basePath} ${counter}${ext}`;
      counter++;
    }
    return candidate;
  }

  function handleBatchAddTagsClick(event?: MouseEvent) {
    const selectedCardIds = Array.from(selectedCards);
    logger.debug("添加标签:", selectedCardIds);

    if (selectedCardIds.length === 0) {
      new Notice("请先选择要添加标签的卡片");
      return;
    }

    // 使用 Obsidian Menu API 显示标签选择列表
    const menu = new Menu();
    (menu as any).app = plugin.app;

    // 添加标题
    menu.addItem((item) => {
      item.setTitle(`为 ${selectedCardIds.length} 张卡片添加标签`);
      item.setDisabled(true);
    });

    // 收集选中卡片已有的标签（用于排除）
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const selectedCardData = sourceCards.filter(c => selectedCardIds.includes(c.uuid));
    const existingTagsInSelection = new Set<string>();
    selectedCardData.forEach(card => {
      card.tags?.forEach(tag => existingTagsInSelection.add(tag));
    });

    // 显示可添加的标签（排除选中卡片已有的标签）
    const tagsToShow = availableTags
      .filter(t => !existingTagsInSelection.has(t.name))
      .slice(0, 20);

    if (tagsToShow.length > 0) {
      tagsToShow.forEach((tag) => {
        menu.addItem((item) => {
          item.setTitle(tag.name);
          item.setIcon('tag');
          item.onClick(() => {
            handleBatchAddTags([tag.name]);
          });
        });
      });
    } else {
      menu.addItem((item) => {
        item.setTitle('没有可添加的标签');
        item.setDisabled(true);
      });
    }

    // 显示菜单 - 在按钮上方显示
    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.top - 8 });
    } else {
      menu.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight - 100 });
    }
  }

  function handleBatchRemoveTags(event?: MouseEvent) {
    const selectedCardIds = Array.from(selectedCards);
    logger.debug("删除标签:", selectedCardIds);

    if (selectedCardIds.length === 0) {
      new Notice("请先选择要删除标签的卡片");
      return;
    }

    // 收集选中卡片的所有标签
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const selectedCardData = sourceCards.filter(c => selectedCardIds.includes(c.uuid));
    const tagCounts = new Map<string, number>();
    selectedCardData.forEach(card => {
      card.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    if (tagCounts.size === 0) {
      new Notice("选中的卡片没有标签");
      return;
    }

    // 使用 Obsidian Menu API 显示标签选择列表
    const menu = new Menu();
    (menu as any).app = plugin.app;

    // 添加标题
    menu.addItem((item) => {
      item.setTitle(`从 ${selectedCardIds.length} 张卡片中删除标签`);
      item.setDisabled(true);
    });

    menu.addSeparator();

    // 按标签数量排序
    const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);

    // 添加标签选项
    sortedTags.forEach(([tag, count]) => {
      menu.addItem((item) => {
        item.setTitle(`${tag} (${count})`);
        item.setIcon('tag');
        item.onClick(() => {
          handleBatchRemoveTagsConfirm([tag]);
        });
      });
    });

    // 添加全部删除选项
    if (sortedTags.length > 1) {
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle(`删除全部 ${sortedTags.length} 个标签`);
        item.setIcon('trash-2');
        item.onClick(() => {
          handleBatchRemoveTagsConfirm(sortedTags.map(([tag]) => tag));
        });
      });
    }

    // 显示菜单 - 在按钮上方显示
    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.top - 8 });
    } else {
      menu.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight - 100 });
    }
  }

  // 标签操作菜单（合并增加标签和移除标签）
  function handleBatchTagsMenu(event?: MouseEvent) {
    const selectedCardIds = Array.from(selectedCards);
    if (selectedCardIds.length === 0) {
      new Notice("请先选择卡片");
      return;
    }

    const menu = new Menu();
    (menu as any).app = plugin.app;

    // 增加标签子菜单
    menu.addItem((item) => {
      item.setTitle('增加标签').setIcon('plus');
      const submenu = (item as any).setSubmenu();

      const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
      const selectedCardData = sourceCards.filter(c => selectedCardIds.includes(c.uuid));
      const existingTagsInSelection = new Set<string>();
      selectedCardData.forEach(card => {
        card.tags?.forEach(tag => existingTagsInSelection.add(tag));
      });

      const tagsToShow = availableTags
        .filter(t => !existingTagsInSelection.has(t.name))
        .slice(0, 20);

      if (tagsToShow.length > 0) {
        tagsToShow.forEach((tag) => {
          submenu.addItem((subItem: any) => {
            subItem.setTitle(tag.name).setIcon('tag');
            subItem.onClick(() => { handleBatchAddTags([tag.name]); });
          });
        });
      } else {
        submenu.addItem((subItem: any) => {
          subItem.setTitle('没有可添加的标签').setDisabled(true);
        });
      }
    });

    // 移除标签子菜单
    menu.addItem((item) => {
      item.setTitle('移除标签').setIcon('minus');
      const submenu = (item as any).setSubmenu();

      const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
      const selectedCardData = sourceCards.filter(c => selectedCardIds.includes(c.uuid));
      const tagCounts = new Map<string, number>();
      selectedCardData.forEach(card => {
        card.tags?.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      if (tagCounts.size > 0) {
        const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
        sortedTags.forEach(([tag, count]) => {
          submenu.addItem((subItem: any) => {
            subItem.setTitle(`${tag} (${count})`).setIcon('tag');
            subItem.onClick(() => { handleBatchRemoveTagsConfirm([tag]); });
          });
        });
        if (sortedTags.length > 1) {
          submenu.addSeparator();
          submenu.addItem((subItem: any) => {
            subItem.setTitle(`删除全部 ${sortedTags.length} 个标签`).setIcon('trash-2');
            subItem.onClick(() => { handleBatchRemoveTagsConfirm(sortedTags.map(([tag]) => tag)); });
          });
        }
      } else {
        submenu.addItem((subItem: any) => {
          subItem.setTitle('选中卡片没有标签').setDisabled(true);
        });
      }
    });

    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.top - 8 });
    } else {
      menu.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight - 100 });
    }
  }

  // v2.0 组建牌组
  function handleBuildDeck() {
    const selectedCardIds = Array.from(selectedCards);
    logger.debug("组建牌组:", selectedCardIds);

    if (selectedCardIds.length === 0) {
      new Notice("请先选择要组建牌组的卡片");
      return;
    }

    // 打开组建牌组模态窗
    showBuildDeckModal = true;
  }


  // v2.0 组建牌组完成回调
  function handleBuildDeckCreated(deck: Deck) {
    logger.info("牌组创建成功:", deck.name);
    // 清除选择
    selectedCards = new Set();
    // 刷新数据
    loadCards();
  }

  async function handleBatchDelete() {
    const selectedCardIds = Array.from(selectedCards);
    logger.debug("批量删除:", selectedCardIds, "数据源:", dataSource);

    if (selectedCardIds.length === 0) {
      new Notice("请先选择要删除的卡片");
      return;
    }

    // 使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    const modal = new Modal(plugin.app);
    modal.titleEl.setText('确认删除');
    modal.contentEl.setText(`确定要删除选中的 ${selectedCardIds.length} 张卡片吗？\n\n此操作不可撤销！`);
    
    const buttonContainer = modal.contentEl.createDiv({ cls: 'confirm-buttons' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '16px';
    
    let shouldDelete = false;
    
    const cancelButton = buttonContainer.createEl('button', { text: '取消' });
    cancelButton.onclick = () => modal.close();
    
    const deleteButton = buttonContainer.createEl('button', { 
      text: '确认删除',
      cls: 'mod-warning'
    });
    deleteButton.onclick = () => {
      shouldDelete = true;
      modal.close();
    };
    modal.onClose = async () => {
      if (!shouldDelete) return;
      
      let ok = 0, fail = 0;
      
      if (dataSource === 'incremental-reading') {
        // 增量阅读模式：从IR存储中删除内容块
        logger.debug("使用IR存储删除内容块");
        
        await ensureIRStorageService();

        const affectedSourceIds = new Set<string>();
        const foldersToCheck = new Set<string>(); // 收集需要检查的文件夹
        
        for (const id of selectedCardIds) {
          try {
            // v5.7: 根据卡片类型区分删除 blocks.json 或 chunks.json
            const card = irContentCards.find(c => c.uuid === id);
            const isChunkType = card?.templateId === CardType.IRChunk || card?.type === CardType.IRChunk;
            
            if (isChunkType) {
              const chunk = await irStorageService!.getChunkData(id);
              if (chunk) {
                affectedSourceIds.add(chunk.sourceId);
                const file = plugin.app.vault.getAbstractFileByPath(chunk.filePath);
                if (file instanceof TFile) {
                  await plugin.app.fileManager.trashFile(file);
                  // 记录父文件夹路径
                  const parentPath = chunk.filePath.substring(0, chunk.filePath.lastIndexOf('/'));
                  if (parentPath) {
                    foldersToCheck.add(parentPath);
                  }
                } else {
                  const adapter = plugin.app.vault.adapter;
                  if (await adapter.exists(chunk.filePath)) {
                    await adapter.remove(chunk.filePath);
                    // 记录父文件夹路径
                    const parentPath = chunk.filePath.substring(0, chunk.filePath.lastIndexOf('/'));
                    if (parentPath) {
                      foldersToCheck.add(parentPath);
                    }
                  }
                }
              }
              await irStorageService!.deleteChunkData(id);
              logger.debug(`成功删除IR chunk: ${id}`);
            } else {
              // 旧版 blocks.json 数据：从牌组移除引用 + 删除 block
              const allDecks = await irStorageService!.getAllDecks();
              for (const deck of Object.values(allDecks)) {
                if (deck.blockIds?.includes(id)) {
                  await irStorageService!.removeBlocksFromDeck(deck.id, [id]);
                }
              }
              await irStorageService!.deleteBlock(id);
              logger.debug(`成功删除IR block: ${id}`);
            }
            ok++;
          } catch (error) {
            logger.error(`删除IR内容块失败: ${id}`, error);
            fail++;
          }
        }

        if (affectedSourceIds.size > 0) {
          const chunks = await irStorageService!.getAllChunkData();
          const sources = await irStorageService!.getAllSources();
          for (const sourceId of affectedSourceIds) {
            const source = sources[sourceId];
            if (!source) continue;

            const remainingChunkIds = (source.chunkIds || []).filter(chunkId => !!chunks[chunkId]);
            if (remainingChunkIds.length === 0) {
              try {
                if (source.indexFilePath) {
                  const indexFile = plugin.app.vault.getAbstractFileByPath(source.indexFilePath);
                  if (indexFile instanceof TFile) {
                    await plugin.app.fileManager.trashFile(indexFile);
                    // 记录索引文件的父文件夹
                    const parentPath = source.indexFilePath.substring(0, source.indexFilePath.lastIndexOf('/'));
                    if (parentPath) {
                      foldersToCheck.add(parentPath);
                    }
                  }
                }
              } catch (error) {
                logger.warn(`[IR] 删除源索引文件失败: ${source.indexFilePath}`, error);
              }

              try {
                await irStorageService!.deleteSource(sourceId);
              } catch (error) {
                logger.warn(`[IR] 删除源材料元数据失败: ${sourceId}`, error);
              }
            } else if (remainingChunkIds.length !== (source.chunkIds || []).length) {
              try {
                source.chunkIds = remainingChunkIds;
                source.updatedAt = Date.now();
                await irStorageService!.saveSource(source);
              } catch (error) {
                logger.warn(`[IR] 更新源材料元数据失败: ${sourceId}`, error);
              }
            }
          }
        }
        
        // 清理空文件夹
        for (const folderPath of foldersToCheck) {
          await cleanEmptyParentFolders(folderPath);
        }
        
        // 重新加载IR数据
        await loadIRContentCards();
      } else if (dataSource === 'questionBank') {
        // 考试牌组模式：从题库中删除题目
        logger.debug("使用题库存储删除卡片");
        
        if (!questionBankStorage) {
          new Notice("题库存储服务未初始化");
          return;
        }
        
        // 按题库分组待删除的卡片
        const cardsByBank = new Map<string, Card[]>();
        for (const id of selectedCardIds) {
          const card = questionBankCards.find(c => c.uuid === id);
          if (!card) { 
            logger.warn(`未找到题库卡片: ${id}`);
            fail++; 
            continue; 
          }
          
          // v2.2: 优先从 content YAML 的 we_decks 获取题库ID
          const { primaryDeckId } = getCardDeckIds(card);
          const bankId = primaryDeckId || card.deckId || '';
          if (!cardsByBank.has(bankId)) {
            cardsByBank.set(bankId, []);
          }
          cardsByBank.get(bankId)!.push(card);
        }
        
        // 对每个题库执行删除操作
        for (const [bankId, cardsToDelete] of cardsByBank) {
          try {
            if (!plugin.questionBankService) {
              throw new Error('题库服务未初始化');
            }

            for (const c of cardsToDelete) {
              await plugin.questionBankService.deleteQuestion(bankId, c.uuid);
            }
            
            logger.debug(`成功从题库 ${bankId} 删除 ${cardsToDelete.length} 张卡片`);
            ok += cardsToDelete.length;
          } catch (error) {
            logger.error(`删除题库 ${bankId} 中的卡片失败:`, error);
            fail += cardsToDelete.length;
          }
        }
        
        // 重新加载题库数据
        await loadQuestionBankCards();
      } else {
        // 记忆牌组模式：高效批量删除
        logger.debug("使用记忆存储删除卡片");
        
        const { ProgressModal } = await import('../../utils/progress-modal');
        const progress = new ProgressModal(plugin.app, {
          title: '删除卡片',
          description: `正在删除 ${selectedCardIds.length} 张卡片...`,
          total: 3,
          cancellable: false
        });
        progress.open();
        
        // 阶段 1/3: 级联清理 - 从所有牌组中批量移除被删卡片的引用
        progress.updateProgress(0, '清理牌组引用...');
        const cardUUIDSet = new Set(selectedCardIds);
        const allDecksForCleanup = await dataStorage.getDecks();
        for (const d of allDecksForCleanup) {
          const before = d.cardUUIDs?.length || 0;
          if (before === 0) continue;
          d.cardUUIDs = (d.cardUUIDs || []).filter(uuid => !cardUUIDSet.has(uuid));
          if (d.cardUUIDs.length !== before) {
            d.modified = new Date().toISOString();
            await dataStorage.saveDeck(d);
          }
        }
        progress.increment('引用清理完成');
        
        // 阶段 2/3: 统一通过 dataStorage 删除，确保触发源文档清理
        progress.updateProgress(1, '删除卡片数据...');
        const deleteResult = await dataStorage.deleteCards(selectedCardIds);
        ok = deleteResult.deleted.length;
        fail = deleteResult.failed.length;
        logger.info(`[CardMgmt] 统一批量删除: 成功${ok}, 失败${fail}`);
        progress.increment('卡片数据已删除');
        
        // 阶段 3/3: 清理缓存
        progress.updateProgress(2, '清理缓存...');
        if (plugin.cardMetadataCache) {
          for (const id of selectedCardIds) plugin.cardMetadataCache.invalidate(id);
        }
        if (plugin.cardIndexService) {
          for (const id of selectedCardIds) plugin.cardIndexService.removeCardIndex(id);
        }
        for (const id of selectedCardIds) {
          plugin.app.workspace.trigger('Weave:card-deleted', id);
        }
        progress.increment('清理完成');
        
        progress.setComplete(`已删除 ${ok} 张卡片`);
        
        // 重新加载记忆牌组数据
        await loadCards();
      }

      new Notice(`已删除 ${ok} 张卡片${fail ? `，失败 ${fail}` : ''}`);

      // 通知全局侧边栏刷新
      plugin.app.workspace.trigger('Weave:data-changed');

      // 清除选择状态
      handleClearSelection();
    };
    
    modal.open();
  }



  // 加载考试牌组卡片数据
  async function loadQuestionBankCards(): Promise<void> {
    if (!questionBankStorage) {
      logger.error('[QuestionBank] Storage未初始化');
      return;
    }
    
    isLoadingQuestionBank = true;
    
    try {
      // 1. 加载所有题库牌组
      const banks = await questionBankStorage.loadBanks();
      logger.debug(`[QuestionBank] 加载了${banks.length}个题库`);
      questionBankDecks = banks;
      
      // 2. 加载所有题库的题目（真实数据源）
      const allQuestionsMap = new Map<string, Card>();
      for (const bank of banks) {
        const questions = plugin.questionBankService
          ? await plugin.questionBankService.getQuestionsByBank(bank.id)
          : [];
        for (const question of questions) {
          allQuestionsMap.set(question.uuid, question);
        }
      }
      logger.debug(`[QuestionBank] 加载了${allQuestionsMap.size}张实际存在的题目`);

      const statsMap = new Map<string, QuestionTestStats>();
      for (const q of allQuestionsMap.values()) {
        const testStats = q.stats?.testStats;
        if (testStats) {
          statsMap.set(q.uuid, testStats);
        }
      }

      // 3. 更新状态（只包含实际存在的题目）
      questionBankCards = Array.from(allQuestionsMap.values());
      questionBankStats = statsMap;
      
      logger.debug(`[QuestionBank] 最终加载了${questionBankCards.length}张题目卡片`);
      showNotification(`已加载 ${questionBankCards.length} 张题目卡片`, 'success');
      
    } catch (error) {
      logger.error('[QuestionBank] 加载失败:', error);
      showNotification('加载考试数据失败', 'error');
    } finally {
      isLoadingQuestionBank = false;
    }
  }
  
  // 统一数据源切换函数（供彩色圆点调用）
  async function switchDataSource(newSource: 'memory' | 'questionBank' | 'incremental-reading'): Promise<void> {
    // 如果已经是当前数据源，不做处理
    if (dataSource === newSource) return;
    
    // 增量阅读高级功能门控
    if (newSource === 'incremental-reading' && premiumGuard.isFeatureRestricted(PREMIUM_FEATURES.INCREMENTAL_READING)) {
      new Notice('增量阅读是高级功能，请激活许可证后使用');
      return;
    }
    
    // 根据目标数据源加载数据
    if (newSource === 'questionBank' && questionBankCards.length === 0) {
      await loadQuestionBankCards();
    } else if (newSource === 'incremental-reading' && irContentCards.length === 0) {
      await loadIRContentCards();
    }
    
    dataSource = newSource;
    
    // 切换离开IR时重置类型筛选
    if (newSource !== 'incremental-reading') {
      irTypeFilter = 'all';
    }
    
    // 同步数据源到全局筛选状态服务
    plugin.filterStateService.updateFilter({ dataSource: newSource });
    
    // 使用统一的列可见性同步函数
    syncColumnVisibilityWithDataSource(newSource);
    
    // 自动切换网格属性：当前属性在新数据源不可用时，切换到该数据源的默认属性
    const availableAttrs = GRID_ATTRIBUTES_BY_SOURCE[newSource];
    if (!availableAttrs.includes(gridCardAttribute)) {
      gridCardAttribute = DEFAULT_ATTRIBUTE_BY_SOURCE[newSource];
      await saveViewPreferences();
    }
    
    // 清空选中状态
    selectedCards.clear();
    
    // 显示切换提示
    const sourceNames: Record<string, string> = {
      'memory': '记忆牌组',
      'questionBank': '考试牌组',
      'incremental-reading': '增量阅读'
    };
    showNotification(`切换到${sourceNames[newSource]}数据`, 'success');
  }
  
  // v2.0 加载增量阅读内容块数据
  // v5.3: 同时支持旧版 IRBlock (blocks.json) 和新版 IRChunkFileData (chunks.json)
  async function loadIRContentCards(): Promise<void> {
    if (isLoadingIR) return;
    
    isLoadingIR = true;
    try {
      await ensureIRStorageService();
      
      // v5.5: 先执行数据完整性检查，清理无效数据（文件不存在的块）
      const { resolveIRImportFolder } = await import('../../config/paths');
      const scanRoot = resolveIRImportFolder(
        plugin.settings?.incrementalReading?.importFolder,
        plugin.settings?.weaveParentFolder
      );
      const integrityResult = await irStorageService!.performIntegrityCheck(scanRoot);
      if (integrityResult.chunksRemoved > 0 || integrityResult.blocksRemoved > 0) {
        logger.info(`[IR] 数据完整性检查: 清理了 ${integrityResult.chunksRemoved} 个无效块, ${integrityResult.blocksRemoved} 个无效旧版块`);
      }
      
      // 加载IR数据
      irBlocks = await irStorageService!.getAllBlocks();
      irDecks = await irStorageService!.getAllDecks();
      
      // v5.5: 加载新版文件化块数据（带 YAML deck_tag 同步）
      const chunkData = await irStorageService!.getAllChunkData();
      const sourcesData = await irStorageService!.getAllSources();
      
      // v5.3: 调试日志
      logger.info(`[IR] 加载数据: blocks=${Object.keys(irBlocks).length}, decks=${Object.keys(irDecks).length}, chunks=${Object.keys(chunkData).length}, sources=${Object.keys(sourcesData).length}`);
      
      const convertedCards: Card[] = [];
      
      // v5.6: 收集 chunks.json 中的 ID，用于去重
      // 如果同一内容在 blocks.json 和 chunks.json 中都存在，优先使用 chunks.json
      const chunkIds = new Set(Object.keys(chunkData));
      
      // === 1. 转换旧版 IRBlock (blocks.json) ===
      for (const block of Object.values(irBlocks)) {
        // v5.6: 跳过已存在于 chunks.json 中的块，避免重复
        if (chunkIds.has(block.id)) {
          continue;
        }
        // 查找块所属的牌组
        const deckIds: string[] = [];
        for (const deck of Object.values(irDecks)) {
          if (deck.blockIds?.includes(block.id)) {
            deckIds.push(deck.id);
          }
        }
        
        // 转换为Card格式（包含IR专用字段）
        // 防御性处理：确保 headingPath 是数组
        const headingPath = Array.isArray(block.headingPath) ? block.headingPath : [];
        const displayContent = `# ${block.headingText || '无标题'}\n\n${headingPath.length > 1 ? `${headingPath.join(' > ')}\n\n` : ''}来源: ${block.filePath}`;
        
        const card: Card & Record<string, any> = {
          id: block.id,
          uuid: block.id,
          deckId: deckIds[0] || '',
          templateId: CardType.IRBlock,
          type: CardType.IRBlock,
          content: displayContent,
          fields: {
            front: block.headingText || '无标题',
            back: headingPath.join(' > ')
          },
          sourceFile: block.filePath,
          sourcePosition: {
            startLine: block.startLine,
            endLine: block.startLine,
            contentHash: ''
          },
          created: block.createdAt,
          modified: block.updatedAt,
          stats: {
            totalReviews: block.reviewCount || 0,
            totalTime: block.totalReadingTime || 0,
            averageTime: block.reviewCount ? Math.floor((block.totalReadingTime || 0) / block.reviewCount) : 0
          },
          fsrs: {
            state: block.state === 'new' ? 0 : block.state === 'learning' ? 1 : 2,
            difficulty: 0.3,
            stability: block.interval,
            due: block.nextReview || new Date().toISOString(),
            lastReview: block.lastReview || undefined,
            reps: block.reviewCount,
            lapses: 0,
            elapsedDays: 0,
            scheduledDays: block.interval || 0,
            retrievability: 1
          },
          tags: block.tags || [],
          priority: block.priority || 2,
          suspended: block.state === 'suspended',
          metadata: {
            irBlock: true,
            headingLevel: block.headingLevel,
            headingPath: block.headingPath,
            totalReadingTime: block.totalReadingTime,
            favorite: block.favorite,
            extractedCards: block.extractedCards,
            deckIds: deckIds
          },
          // IR专用字段（用于表格显示）
          ir_title: headingPath.join(' > ') || block.headingText || '无标题',
          ir_source_file: block.filePath,
          ir_deck: deckIds.length > 0 ? Object.values(irDecks).find(d => d.id === deckIds[0])?.name || '未分配' : '未分配',  // v5.4
          ir_state: block.state,
          ir_priority: block.priority,
          ir_tags: block.tags || [],
          ir_favorite: block.favorite,
          ir_next_review: block.nextReview,
          ir_review_count: block.reviewCount,
          ir_reading_time: block.totalReadingTime,
          ir_notes: block.notes || '',
          ir_extracted_cards: block.extractedCards?.length || 0,
          ir_created: block.createdAt,
        };
        convertedCards.push(card);
      }
      
      // === 2. 转换新版 IRChunkFileData (chunks.json) ===
      for (const chunk of Object.values(chunkData)) {
        // 从文件路径提取标题
        const fileName = chunk.filePath.replace(/^.*\//, '').replace(/\.md$/, '');
        const title = fileName.replace(/^\d+_/, ''); // 移除序号前缀
        
        // 查找源文件信息
        const source = sourcesData[chunk.sourceId];
        const sourceTitle = source?.title || '未知来源';
        
        // 读取块文件的YAML和内容以提取标签
        let tags: string[] = [];
        let extractedCardsCount = 0;
        try {
          const chunkFile = plugin.app.vault.getAbstractFileByPath(chunk.filePath);
          if (chunkFile instanceof TFile) {
            const content = await plugin.app.vault.read(chunkFile);
            
            // 提取YAML中的tags
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (yamlMatch) {
              const yamlContent = yamlMatch[1];
              const tagsMatch = yamlContent.match(/tags:\s*\[([^\]]+)\]/) || yamlContent.match(/tags:\s*\n((?:\s+-\s+.+\n)+)/);
              if (tagsMatch) {
                if (tagsMatch[1].includes('-')) {
                  // 列表格式
                  tags = tagsMatch[1].split('\n')
                    .map(line => line.trim().replace(/^-\s+/, ''))
                    .filter(tag => tag.length > 0);
                } else {
                  // 单行格式
                  tags = tagsMatch[1].split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                }
              }
            }
            
            // 从内容中提取#标签（排除Markdown标题：行首#后跟空格）
            const bodyContent = content.replace(/^---\n[\s\S]*?\n---/, '');
            const contentTagMatches = Array.from(bodyContent.matchAll(/(?:^|[^#\w])#([\w\u4e00-\u9fa5-]+)/g));
            const filteredTags = contentTagMatches
              .map(m => m[1])
              .filter(t => !/^\d+$/.test(t));
            tags = [...new Set([...tags, ...filteredTags])];
            
            // 统计制卡数：从 stats 中获取
            extractedCardsCount = chunk.stats?.cardsCreated || 0;
          }
        } catch (error) {
          logger.warn(`[读取块文件失败] ${chunk.filePath}:`, error);
        }
        
        // 转换为Card格式
        const displayContent = `# ${title}\n\n来源: ${sourceTitle}\n文件: ${chunk.filePath}`;
        
        const card: Card & Record<string, any> = {
          id: chunk.chunkId,
          uuid: chunk.chunkId,
          deckId: '',
          templateId: CardType.IRChunk,
          type: CardType.IRChunk,
          content: displayContent,
          fields: {
            front: title,
            back: sourceTitle
          },
          sourceFile: chunk.filePath,
          sourcePosition: {
            startLine: 0,
            endLine: 0,
            contentHash: ''
          },
          created: typeof chunk.createdAt === 'number' ? new Date(chunk.createdAt).toISOString() : chunk.createdAt,
          modified: typeof chunk.updatedAt === 'number' ? new Date(chunk.updatedAt).toISOString() : chunk.updatedAt,
          stats: {
            totalReviews: chunk.stats?.impressions || 0,
            totalTime: 0,
            averageTime: 0
          },
          fsrs: {
            state: chunk.scheduleStatus === 'new' ? 0 : chunk.scheduleStatus === 'active' ? 1 : 2,
            difficulty: 0.3,
            stability: chunk.intervalDays,
            due: chunk.nextRepDate ? new Date(chunk.nextRepDate).toISOString() : new Date().toISOString(),
            lastReview: undefined,
            reps: chunk.stats?.impressions || 0,
            lapses: 0,
            elapsedDays: 0,
            scheduledDays: chunk.intervalDays || 0,
            retrievability: 1
          },
          tags: tags,
          priority: chunk.priorityEff <= 3 ? 1 : chunk.priorityEff <= 7 ? 2 : 3,
          suspended: chunk.scheduleStatus === 'suspended',
          metadata: {
            irChunk: true,
            sourceId: chunk.sourceId,
            sourceTitle: sourceTitle,
            deckTag: chunk.deckTag,  // v5.4: 兼容
            deckIds: chunk.deckIds || []  // v5.5: 多牌组ID列表
          },
          // IR专用字段（用于表格显示）
          ir_title: title,
          ir_source_file: chunk.filePath,
          ir_deck: chunk.deckTag ? chunk.deckTag.replace('#IR_deck_', '') : '未分配',  // v5.4: 兼容单牌组
          ir_deck_ids: chunk.deckIds || [],  // v5.5: 多牌组ID列表
          ir_state: chunk.scheduleStatus,
          ir_priority: chunk.priorityEff <= 3 ? 1 : chunk.priorityEff <= 7 ? 2 : 3,
          ir_tags: tags,
          ir_favorite: false,
          ir_next_review: chunk.nextRepDate ? new Date(chunk.nextRepDate).toISOString() : null,
          ir_review_count: chunk.stats?.impressions || 0,
          ir_reading_time: chunk.stats?.totalReadingTimeSec || 0,
          ir_notes: '',
          ir_extracted_cards: extractedCardsCount,
          ir_created: typeof chunk.createdAt === 'number' ? new Date(chunk.createdAt).toISOString() : chunk.createdAt,
        };
        convertedCards.push(card);
      }
      
      // === 3. 转换 PDF 书签任务 (pdf-bookmark-tasks.json) ===
      let pdfTaskCount = 0;
      try {
        const pdfService = new IRPdfBookmarkTaskService(plugin.app);
        await pdfService.initialize();
        const pdfTasks = await pdfService.getAllTasks();
        
        for (const task of pdfTasks) {
          // 跳过已完成/已移除的任务
          if (task.status === 'done' || task.status === 'removed') continue;
          
          // 查找所属牌组名称
          const deck = Object.values(irDecks).find(d => d.id === task.deckId);
          const deckName = deck?.name || '未分配';
          
          const displayContent = `# ${task.title}\n\nPDF: ${task.pdfPath}\n链接: ${task.link}`;
          
          // 将 priorityEff(1-10) 映射为显示用的 1(高)/2(中)/3(低)
          const displayPriority = task.priorityEff <= 3 ? 1 : task.priorityEff <= 7 ? 2 : 3;
          
          const card: Card & Record<string, any> = {
            id: task.id,
            uuid: task.id,
            deckId: task.deckId || '',
            templateId: CardType.IRChunk,
            type: CardType.IRChunk,
            content: displayContent,
            fields: {
              front: task.title,
              back: task.pdfPath
            },
            sourceFile: task.pdfPath,
            sourcePosition: { startLine: 0, endLine: 0, contentHash: '' },
            created: new Date(task.createdAt).toISOString(),
            modified: new Date(task.updatedAt).toISOString(),
            stats: {
              totalReviews: task.stats?.impressions || 0,
              totalTime: task.stats?.totalReadingTimeSec || 0,
              averageTime: 0
            },
            fsrs: {
              state: task.status === 'new' ? 0 : task.status === 'active' || task.status === 'queued' ? 1 : 2,
              difficulty: 0.3,
              stability: task.intervalDays,
              due: task.nextRepDate ? new Date(task.nextRepDate).toISOString() : new Date().toISOString(),
              lastReview: undefined,
              reps: task.stats?.impressions || 0,
              lapses: 0,
              elapsedDays: 0,
              scheduledDays: task.intervalDays || 0,
              retrievability: 1
            },
            tags: task.tags || [],
            priority: displayPriority,
            suspended: task.status === 'suspended',
            metadata: {
              irPdfBookmark: true,
              pdfPath: task.pdfPath,
              link: task.link,
              annotationId: task.annotationId,
              deckIds: [task.deckId]
            },
            // IR专用字段
            ir_title: task.title,
            ir_source_file: task.pdfPath,
            ir_deck: deckName,
            ir_deck_ids: task.deckId ? [task.deckId] : [],
            ir_state: task.status,
            ir_priority: displayPriority,
            ir_tags: task.tags || [],
            ir_favorite: false,
            ir_next_review: task.nextRepDate ? new Date(task.nextRepDate).toISOString() : null,
            ir_review_count: task.stats?.impressions || 0,
            ir_reading_time: task.stats?.totalReadingTimeSec || 0,
            ir_notes: '',
            ir_extracted_cards: task.stats?.cardsCreated || 0,
            ir_created: new Date(task.createdAt).toISOString(),
          };
          convertedCards.push(card);
          pdfTaskCount++;
        }
        
        if (pdfTaskCount > 0) {
          logger.info(`[IR] 加载了 ${pdfTaskCount} 个PDF书签任务`);
        }
      } catch (error) {
        logger.warn('[IR] PDF书签任务加载失败（继续使用其他数据）:', error);
      }
      
      irContentCards = convertedCards;
      const legacyCount = Object.keys(irBlocks).length;
      const chunkCount = Object.keys(chunkData).length;
      logger.debug(`[IR] 加载了 ${irContentCards.length} 个内容块 (旧版: ${legacyCount}, 新版: ${chunkCount}, PDF书签: ${pdfTaskCount})`);
      showNotification(`已加载 ${irContentCards.length} 个增量阅读内容块`, 'success');
      
    } catch (error) {
      logger.error('[IR] 加载失败:', error);
      showNotification('加载增量阅读数据失败', 'error');
    } finally {
      isLoadingIR = false;
    }
  }

  // v2.0 IR批量操作：组建增量牌组
  function handleBuildIRDeck(): void {
    const selectedIds = Array.from(selectedCards);
    if (selectedIds.length === 0) {
      showNotification('请先选择要添加到牌组的内容块', 'warning');
      return;
    }
    
    // 打开组建增量牌组模态窗
    showBuildIRDeckModal = true;
  }

  // v2.0 IR组建牌组完成回调
  async function handleBuildIRDeckCreated(deck: IRDeck): Promise<void> {
    logger.info('[IR] 增量牌组创建成功:', deck.name);
    // 清除选择
    selectedCards = new Set();
    // 刷新数据
    await loadIRContentCards();
    showNotification(`增量牌组"${deck.name}"创建成功`, 'success');
  }

  // v2.0 IR批量操作：切换收藏状态（支持 block/chunk/PDF书签）
  async function handleIRBatchToggleFavorite(): Promise<void> {
    const selectedIds = Array.from(selectedCards);
    if (selectedIds.length === 0) {
      showNotification('请先选择内容块', 'warning');
      return;
    }
    
    try {
      await ensureIRStorageService();
      const latestBlocks = await irStorageService!.getAllBlocks();
      const chunkData = await irStorageService!.getAllChunkData();
      
      let toggledCount = 0;
      for (const id of selectedIds) {
        const card = irContentCards.find(c => c.uuid === id);

        if (isPdfBookmarkTaskId(id)) {
          // PDF书签任务：切换收藏
          const pdfService = new IRPdfBookmarkTaskService(plugin.app);
          await pdfService.initialize();
          const task = await pdfService.getTask(id);
          const currentFav = task?.favorite ?? false;
          await pdfService.updateTask(id, { favorite: !currentFav });
          toggledCount++;
        } else if (card?.metadata?.irChunk) {
          // 新版 chunk：切换收藏
          const chunk = chunkData[id];
          if (chunk) {
            chunk.favorite = !(chunk.favorite ?? false);
            await irStorageService!.saveChunkData(chunk);
            toggledCount++;
          }
        } else {
          // 旧版 block
          const block = latestBlocks[id];
          if (block) {
            const updatedBlock = { ...block, favorite: !block.favorite };
            await irStorageService!.saveBlock(updatedBlock);
            toggledCount++;
          }
        }
      }
      
      await loadIRContentCards();
      showNotification(`已切换 ${toggledCount} 个内容块的收藏状态`, 'success');
      
    } catch (error) {
      logger.error('[IR] 切换收藏失败:', error);
      showNotification('切换收藏失败', 'error');
    }
  }

  // v2.0 IR批量操作：修改优先级（支持 block/chunk/PDF书签）
  function handleIRBatchChangePriority(event: MouseEvent): void {
    const selectedIds = Array.from(selectedCards);
    if (selectedIds.length === 0) {
      showNotification('请先选择内容块', 'warning');
      return;
    }
    
    const menu = new Menu();
    
    const priorities = [
      { value: 1, label: '高优先级', icon: 'alert-circle' },
      { value: 2, label: '中优先级', icon: 'minus-circle' },
      { value: 3, label: '低优先级', icon: 'check-circle' }
    ];
    
    for (const p of priorities) {
      menu.addItem((item) => {
        item.setTitle(p.label);
        item.setIcon(p.icon);
        item.onClick(async () => {
          try {
            await ensureIRStorageService();
            const latestBlocks = await irStorageService!.getAllBlocks();
            const chunkData = await irStorageService!.getAllChunkData();
            
            let updatedCount = 0;
            for (const id of selectedIds) {
              const card = irContentCards.find(c => c.uuid === id);

              if (isPdfBookmarkTaskId(id)) {
                const pdfService = new IRPdfBookmarkTaskService(plugin.app);
                await pdfService.initialize();
                await pdfService.updateTask(id, { priorityUi: p.value, priorityEff: p.value });
                updatedCount++;
              } else if (card?.metadata?.irChunk) {
                const chunk = chunkData[id];
                if (chunk) {
                  chunk.priorityEff = p.value;
                  await irStorageService!.saveChunkData(chunk);
                  updatedCount++;
                }
              } else {
                const block = latestBlocks[id];
                if (block) {
                  const updatedBlock = { ...block, priority: p.value as 1 | 2 | 3 };
                  await irStorageService!.saveBlock(updatedBlock);
                  updatedCount++;
                }
              }
            }
            
            await loadIRContentCards();
            showNotification(`已将 ${updatedCount} 个内容块设为${p.label}`, 'success');
            
          } catch (error) {
            logger.error('[IR] 修改优先级失败:', error);
            showNotification('修改优先级失败', 'error');
          }
        });
      });
    }
    
    menu.showAtMouseEvent(event);
  }

  // v5.5 IR批量操作：更换牌组（使用正式牌组列表，支持多牌组）
  async function handleIRBatchChangeDeck(event: MouseEvent): Promise<void> {
    const selectedIds = Array.from(selectedCards);
    if (selectedIds.length === 0) {
      showNotification('请先选择内容块', 'warning');
      return;
    }
    
    await ensureIRStorageService();
    
    // v5.5: 获取正式牌组列表（从 decks.json）
    const validDecks = await irStorageService!.getValidDeckList();
    
    const menu = new Menu();
    
    // 添加到牌组（支持多牌组）
    if (validDecks.length > 0) {
      menu.addItem((item) => {
        item.setTitle('添加到牌组');
        item.setIcon('folder-plus');
        const subMenu = (item as any).setSubmenu();
        
        for (const deck of validDecks) {
          subMenu.addItem((subItem: any) => {
            subItem.setTitle(deck.name);
            subItem.setIcon('folder');
            subItem.onClick(async () => {
              try {
                // v5.5: 使用 addDeckToChunk 添加牌组（支持多牌组）
                for (const chunkId of selectedIds) {
                  await irStorageService!.addDeckToChunk(chunkId, deck.id);
                }
                await loadIRContentCards();
                showNotification(`已将 ${selectedIds.length} 个内容块添加到"${deck.name}"`, 'success');
              } catch (error) {
                logger.error('[IR] 添加到牌组失败:', error);
                showNotification('添加到牌组失败', 'error');
              }
            });
          });
        }
      });
      
      // 移动到牌组（替换现有牌组）
      menu.addItem((item) => {
        item.setTitle('移动到牌组（替换）');
        item.setIcon('folder-input');
        const subMenu = (item as any).setSubmenu();
        
        for (const deck of validDecks) {
          subMenu.addItem((subItem: any) => {
            subItem.setTitle(deck.name);
            subItem.setIcon('folder');
            subItem.onClick(async () => {
              try {
                // v5.5: 使用 updateChunkDecks 替换牌组
                for (const chunkId of selectedIds) {
                  await irStorageService!.updateChunkDecks(chunkId, [deck.id]);
                }
                await loadIRContentCards();
                showNotification(`已将 ${selectedIds.length} 个内容块移动到"${deck.name}"`, 'success');
              } catch (error) {
                logger.error('[IR] 移动到牌组失败:', error);
                showNotification('移动到牌组失败', 'error');
              }
            });
          });
        }
      });
      
      // 从牌组移除
      menu.addItem((item) => {
        item.setTitle('从牌组移除');
        item.setIcon('folder-minus');
        const subMenu = (item as any).setSubmenu();
        
        for (const deck of validDecks) {
          subMenu.addItem((subItem: any) => {
            subItem.setTitle(deck.name);
            subItem.setIcon('folder');
            subItem.onClick(async () => {
              try {
                for (const chunkId of selectedIds) {
                  await irStorageService!.removeDeckFromChunk(chunkId, deck.id);
                }
                await loadIRContentCards();
                showNotification(`已从"${deck.name}"移除 ${selectedIds.length} 个内容块`, 'success');
              } catch (error) {
                logger.error('[IR] 从牌组移除失败:', error);
                showNotification('从牌组移除失败', 'error');
              }
            });
          });
        }
      });
    } else {
      menu.addItem((item) => {
        item.setTitle('暂无牌组（请先在增量阅读界面创建）');
        item.setIcon('info');
        item.setDisabled(true);
      });
    }
    
    // 清空所有牌组
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle('清空所有牌组');
      item.setIcon('x');
      item.onClick(async () => {
        try {
          for (const chunkId of selectedIds) {
            await irStorageService!.updateChunkDecks(chunkId, []);
          }
          await loadIRContentCards();
          showNotification(`已清空 ${selectedIds.length} 个内容块的牌组`, 'success');
        } catch (error) {
          logger.error('[IR] 清空牌组失败:', error);
          showNotification('操作失败', 'error');
        }
      });
    });
    
    menu.showAtMouseEvent(event);
  }

  // 格式化题型显示
  function formatQuestionType(card: Card): string {
    const type = card.metadata?.questionMetadata?.type;
    const typeMap = {
      'single_choice': '单选',
      'multiple_choice': '多选',
      'cloze': '填空',
      'short_answer': '问答'
    };
    return typeMap[type as keyof typeof typeMap] || '未知';
  }
  
  // 格式化正确率显示
  function formatAccuracy(card: Card): string {
    const stats = questionBankStats.get(card.uuid);
    if (!stats) return '-';
    
    const percent = Math.round(stats.accuracy * 100);
    return `${percent}%`;
  }
  
  // 获取正确率颜色类
  function getAccuracyColorClass(card: Card): string {
    const stats = questionBankStats.get(card.uuid);
    if (!stats) return '';
    
    const percent = Math.round(stats.accuracy * 100);
    if (percent >= 80) return 'accuracy-high';
    if (percent >= 60) return 'accuracy-medium';
    return 'accuracy-low';
  }
  
  // 格式化错题等级
  function formatErrorLevel(card: Card): string {
    const stats = questionBankStats.get(card.uuid);
    if (!stats || !stats.isInErrorBook) return '-';
    
    const incorrectCount = stats.incorrectAttempts;
    if (incorrectCount >= 5) return '高频';
    if (incorrectCount >= 3) return '常见';
    return '轻度';
  }
  
  // 格式化相对时间
  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  }

  // 新建卡片
  function handleCreateCard() {
    plugin.openCreateCardModal(); // 使用复用的CardEditModal
  }


  // 编辑卡片 - 使用全局编辑器
  function handleEditCard(cardUuid: string) {
    handleTempFileEditCard(cardUuid);
  }

  // 删除卡片（并清理源文档中的 Weave 元数据与块锚点）
  async function handleDeleteCard(cardUuid: string) {
    logger.debug('[WeaveCardManagement] 删除单个卡片:', cardUuid, '数据源:', dataSource);
    
    // 根据数据源选择正确的卡片数据
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const cardToDelete = sourceCards.find(c => c.uuid === cardUuid);
    if (!cardToDelete) {
      logger.error('[WeaveCardManagement] 未找到要删除的卡片:', cardUuid, '数据源:', dataSource);
      return;
    }

    const frontContent = getCardContentBySide(cardToDelete, 'front', [], " / ");
    // 使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    const confirmed = await showObsidianConfirm(
      plugin.app,
      `确定要删除卡片 "${frontContent}" 吗？`,
      { title: '确认删除', confirmText: '删除' }
    );
    if (!confirmed) return;

    try {
      if (dataSource === 'questionBank') {
        // 考试牌组模式：从题库中删除单个题目
        if (!questionBankStorage) {
          showNotification("题库存储服务未初始化", "error");
          return;
        }

        const bankId = cardToDelete.deckId || '';
        if (!plugin.questionBankService) {
          showNotification("题库服务未初始化", "error");
          return;
        }

        await plugin.questionBankService.deleteQuestion(bankId, cardUuid);
        
        // 4. 重新加载题库数据
        await loadQuestionBankCards();
        
        logger.debug(`成功从题库 ${bankId} 删除卡片 ${cardUuid}`);
      } else if (dataSource === 'incremental-reading') {
        // 增量阅读模式：从IR存储中删除
        irContentCards = irContentCards.filter(c => c.uuid !== cardUuid);
        
        await ensureIRStorageService();
        
        if (isPdfBookmarkTaskId(cardUuid)) {
          // PDF书签任务：从 pdf-bookmark-tasks.json 删除
          const pdfService = new IRPdfBookmarkTaskService(plugin.app);
          await pdfService.initialize();
          await pdfService.deleteTask(cardUuid);
          logger.debug(`[IR] 已删除PDF书签任务: ${cardUuid}`);
        } else if (cardToDelete.metadata?.irChunk) {
          // 新版 chunk：从 chunks.json 删除
          await irStorageService!.deleteChunkData(cardUuid);
          logger.debug(`[IR] 已删除chunk: ${cardUuid}`);
        } else if (cardToDelete.metadata?.irBlock) {
          // 旧版 block：从 blocks.json 删除
          await irStorageService!.deleteBlock(cardUuid);
          logger.debug(`[IR] 已删除旧版block: ${cardUuid}`);
        }
        
        // 后台重新加载确保一致性
        loadIRContentCards().catch(err => {
          logger.error('[IR] 重新加载失败:', err);
        });
      } else {
        // 记忆牌组模式：使用记忆存储删除
        // 立即从UI中移除（乐观更新）
        cards = cards.filter(c => c.uuid !== cardUuid);
        
        // 修复：移除 tick()，避免强制同步刷新导致 reconciliation 错误
        // 乐观更新后让 Svelte 自然处理 DOM 更新即可
        
        // 删除卡片数据
        await dataStorage.deleteCard(cardUuid);
        
        // 后台重新加载（确保数据一致性）
        loadCards().catch(err => {
          logger.error('重新加载卡片失败:', err);
        });
      }
      
      // 通知全局侧边栏刷新
      plugin.app.workspace.trigger('Weave:data-changed');
      
      showNotification('卡片已删除', 'success');
      
    } catch (error) {
      // 删除失败，重新加载数据恢复状态
      logger.error('删除卡片失败:', error);
      if (dataSource === 'questionBank') {
        await loadQuestionBankCards();
      } else {
        await loadCards();
      }
      showNotification('删除失败，请重试', 'error');
    }
  }

  // handleCloseCardEditor 已移除，统一使用临时文件编辑器

  // 临时文件编辑卡片 - 改为使用全局方法
  function handleTempFileEditCard(cardId: string) {
    logger.debug('[WeaveCardManagementPage] 开始全局编辑:', cardId, '数据源:', dataSource);

    // 性能优化：清理该卡片的缓存，确保编辑后显示最新内容
    for (const [key] of contentCache) {
      if (key.startsWith(cardId)) {
        contentCache.delete(key);
      }
    }

    // 根据数据源选择正确的卡片数据
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const cardToEdit = sourceCards.find(c => c.uuid === cardId);
    
    if (cardToEdit) {
      // IR内容块特殊处理：跳转到源文件进行编辑
      if (dataSource === 'incremental-reading') {
        // PDF 书签：打开 PDF 链接
        if (cardToEdit.metadata?.irPdfBookmark) {
          const link = cardToEdit.metadata.link as string;
          const pdfPath = cardToEdit.metadata.pdfPath as string;
          if (link) {
            const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
            plugin.app.workspace.openLinkText(link, contextPath, false);
          } else if (pdfPath) {
            const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
            plugin.app.workspace.openLinkText(pdfPath, contextPath, false);
          } else {
            showNotification('PDF书签链接不存在', 'error');
          }
          return;
        }
        
        // 新版 IRChunk：打开 chunk 对应的 md 文件
        if (cardToEdit.metadata?.irChunk && cardToEdit.sourceFile) {
          const file = plugin.app.vault.getAbstractFileByPath(cardToEdit.sourceFile);
          if (file && file instanceof TFile) {
            const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
            plugin.app.workspace.openLinkText(cardToEdit.sourceFile, contextPath, false);
            return;
          } else {
            showNotification('源文件不存在', 'error');
            return;
          }
        }
        
        // 旧版 IRBlock：打开源文件并定位到对应行
        if (cardToEdit.metadata?.irBlock) {
          const block = irBlocks[cardId];
          if (block && block.filePath) {
            const file = plugin.app.vault.getAbstractFileByPath(block.filePath);
            if (file && file instanceof TFile) {
              const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
              plugin.app.workspace.openLinkText(block.filePath, contextPath, false).then(() => {
                const leaf = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                if (leaf && block.startLine) {
                  const editor = leaf.editor;
                  editor.setCursor({ line: block.startLine - 1, ch: 0 });
                  editor.scrollIntoView({ from: { line: block.startLine - 1, ch: 0 }, to: { line: block.startLine - 1, ch: 0 } }, true);
                }
              });
              return;
            } else {
              showNotification('源文件不存在', 'error');
              return;
            }
          }
        }
      }
      
      // 普通卡片：立即打开模态窗，不等待（乐观UI策略）
      plugin.openEditCardModal(cardToEdit, {
        onSave: handleTempFileEditSave,
        onCancel: () => {
          logger.debug('[WeaveCardManagementPage] 编辑取消');
        }
      });
    } else {
      logger.error('[WeaveCardManagementPage] 未找到要编辑的卡片:', cardId, '数据源:', dataSource);
    }
  }

  // 临时文件编辑保存完成
  async function handleTempFileEditSave(_updatedCard: Card) {
    try {
      // 立即显示成功通知
      showNotification("卡片保存成功", "success");
      
      // 数据重新加载在后台异步执行，不阻塞模态窗关闭（类似 Obsidian 的策略）
      // - 题库模式：需要手动加载（没有 dataSyncService 订阅）
      // - 记忆牌组：依赖 dataSyncService 自动同步，避免双重加载
      if (dataSource === 'questionBank') {
        // 不使用 await，让加载在后台执行
        loadQuestionBankCards().catch((error) => {
          logger.error('后台加载题库卡片失败:', error);
          showNotification("数据同步失败，请手动刷新", "error");
        });
      }
      // 记忆牌组模式：dataSyncService 会在 300ms 后自动触发 loadCards()
      
    } catch (error) {
      logger.error('临时文件编辑保存失败:', error);
      showNotification("保存失败", "error");
    }
  }

  // 查看卡片
  function handleViewCard(cardId: string) {
    logger.debug('[WeaveCardManagement] 查看卡片:', cardId, '数据源:', dataSource);
    
    // 根据数据源选择正确的卡片数据
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const cardToView = sourceCards.find(c => c.uuid === cardId);
    
    if (cardToView) {
      // 使用全局模态窗，支持在其他标签页上方显示
      plugin.openViewCardModal(cardToView, {
        allDecks: allDecks
      });
    } else {
      logger.error('[WeaveCardManagement] 未找到要查看的卡片:', cardId, '数据源:', dataSource);
    }
  }

  // 处理标签更新
  async function handleTagsUpdate(cardId: string, tags: string[]) {
    logger.debug('[WeaveCardManagement] 更新卡片标签:', cardId, tags, '数据源:', dataSource);
    
    // 根据数据源选择正确的卡片数据
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const cardToUpdate = sourceCards.find(c => c.uuid === cardId);
    
    if (!cardToUpdate) {
      logger.error('[WeaveCardManagement] 未找到要更新标签的卡片:', cardId, '数据源:', dataSource);
      showNotification("卡片数据不存在", "error");
      return;
    }

    try {
      if (dataSource === 'questionBank') {
        // 考试牌组模式：更新题库中的卡片标签
        if (!questionBankStorage) {
          showNotification("题库存储服务未初始化", "error");
          return;
        }

        const { setCardProperty } = await import('../../utils/yaml-utils');
        const updatedCard = {
          ...cardToUpdate,
          content: setCardProperty(cardToUpdate.content || '', 'tags', tags),
          tags,
          modified: new Date().toISOString(),
        };

        await dataStorage.updateCard(updatedCard);
        await loadQuestionBankCards();
        
        // 修复：递增数据版本号，强制触发UI更新
        dataVersion++;
        logger.debug('[WeaveCardManagement] 数据版本更新(题库):', dataVersion);
      } else if (dataSource === 'incremental-reading') {
        // 增量阅读模式：更新IR存储中的标签（不走dataStorage）
        await ensureIRStorageService();
        
        if (isPdfBookmarkTaskId(cardId)) {
          const pdfService = new IRPdfBookmarkTaskService(plugin.app);
          await pdfService.initialize();
          await pdfService.updateTask(cardId, { tags });
        } else if (cardToUpdate.metadata?.irChunk) {
          // chunk：更新 chunks.json 中的标签（通过文件YAML）
          const chunkData = await irStorageService!.getAllChunkData();
          const chunk = chunkData[cardId];
          if (chunk?.filePath) {
            const { setCardProperty } = await import('../../utils/yaml-utils');
            const adapter = plugin.app.vault.adapter;
            if (await adapter.exists(chunk.filePath)) {
              let content = await adapter.read(chunk.filePath);
              content = setCardProperty(content, 'tags', tags);
              await adapter.write(chunk.filePath, content);
            }
          }
        } else if (cardToUpdate.metadata?.irBlock) {
          const allBlocks = await irStorageService!.getAllBlocks();
          const block = allBlocks[cardId];
          if (block) {
            block.tags = tags;
            await irStorageService!.saveBlock(block);
          }
        }
        
        // 更新本地数组
        irContentCards = irContentCards.map(c => 
          c.uuid === cardId 
            ? { ...c, tags, ir_tags: tags, modified: new Date().toISOString() }
            : c
        );
        
        lastFilteredCardsKey = '';
        cachedTransformedCards = [];
        dataVersion++;
      } else {
        // 记忆牌组模式：更新卡片标签
        const { setCardProperty } = await import('../../utils/yaml-utils');
        const updatedCard = { 
          ...cardToUpdate, 
          content: setCardProperty(cardToUpdate.content || '', 'tags', tags),
          tags, 
          modified: new Date().toISOString() 
        };
        
        // 修复：先保存到数据库
        const result = await dataStorage.updateCard(updatedCard);
        
        logger.debug('[WeaveCardManagement] 数据库保存结果:', result.success);
        
        if (!result.success) {
          throw new Error(result.error || '保存失败');
        }
        
        // 修复：清理该卡片的缓存
        for (const [key] of contentCache) {
          if (key.startsWith(cardId)) {
            contentCache.delete(key);
          }
        }
        
        // 修复：清理元数据缓存，强制从新content重新提取标签
        invalidateCardCache(cardId);
        
        // 修复：清理transformedCards缓存，强制重新转换
        lastFilteredCardsKey = '';
        cachedTransformedCards = [];
        
        cards = cards.map(c => 
          c.uuid === cardId 
            ? { ...c, content: updatedCard.content, tags, modified: new Date().toISOString() }
            : c
        );
        
        // 修复：递增数据版本号，强制触发UI更新
        dataVersion++;
        logger.debug('[WeaveCardManagement] 数据版本更新:', dataVersion);
      }
      
      showNotification("标签更新成功", "success");
    } catch (error) {
      logger.error('[WeaveCardManagement] 标签更新失败:', error);
      showNotification("标签更新失败", "error");
    }
  }

  // 处理优先级更新
  async function handlePriorityUpdate(cardId: string, priority: number) {
    logger.debug('[WeaveCardManagement] 更新卡片优先级:', cardId, priority, '数据源:', dataSource);
    
    // 根据数据源选择正确的卡片数据
    const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
    const cardToUpdate = sourceCards.find(c => c.uuid === cardId);
    
    if (!cardToUpdate) {
      logger.error('[WeaveCardManagement] 未找到要更新优先级的卡片:', cardId, '数据源:', dataSource);
      showNotification("卡片数据不存在", "error");
      return;
    }

    try {
      if (dataSource === 'questionBank') {
        // 考试牌组模式：更新题库中的卡片优先级
        if (!questionBankStorage) {
          showNotification("题库存储服务未初始化", "error");
          return;
        }

        const updatedCard = {
          ...cardToUpdate,
          priority,
          modified: new Date().toISOString(),
        };

        await dataStorage.updateCard(updatedCard);
        await loadQuestionBankCards();
      } else if (dataSource === 'incremental-reading') {
        // 增量阅读模式：更新IR存储中的优先级（不走dataStorage）
        await ensureIRStorageService();
        
        if (isPdfBookmarkTaskId(cardId)) {
          const pdfService = new IRPdfBookmarkTaskService(plugin.app);
          await pdfService.initialize();
          await pdfService.updateTask(cardId, { priorityUi: priority, priorityEff: priority });
        } else if (cardToUpdate.metadata?.irChunk) {
          // chunk：更新 chunks.json 中的优先级
          const chunkData = await irStorageService!.getAllChunkData();
          const chunk = chunkData[cardId];
          if (chunk) {
            chunk.priorityEff = priority;
            await irStorageService!.saveChunkData(chunk);
          }
        } else if (cardToUpdate.metadata?.irBlock) {
          const allBlocks = await irStorageService!.getAllBlocks();
          const block = allBlocks[cardId];
          if (block) {
            block.priority = priority as 1 | 2 | 3;
            await irStorageService!.saveBlock(block);
          }
        }
        
        // 更新本地数组
        irContentCards = irContentCards.map(c => 
          c.uuid === cardId 
            ? { ...c, priority, ir_priority: priority, modified: new Date().toISOString() }
            : c
        );
        
        lastFilteredCardsKey = '';
        cachedTransformedCards = [];
        dataVersion++;
      } else {
        // 记忆牌组模式：更新卡片优先级
        const updatedCard = { 
          ...cardToUpdate, 
          priority, 
          modified: new Date().toISOString() 
        };
        
        await dataStorage.updateCard(updatedCard);
        
        // 修复：清理transformedCards缓存，强制重新转换
        lastFilteredCardsKey = '';
        cachedTransformedCards = [];
        
        cards = cards.map(c => 
          c.uuid === cardId 
            ? { ...c, priority, modified: new Date().toISOString() }
            : c
        );
        
        // 修复：递增数据版本号，强制触发UI更新
        dataVersion++;
      }
      
      showNotification("优先级更新成功", "success");
    } catch (error) {
      logger.error('[WeaveCardManagement] 优先级更新失败:', error);
      showNotification("优先级更新失败", "error");
    }
  }

  // 查看/编辑/删除卡片模态窗已改用全局方法（plugin.openViewCardModal）

  // handleBatchTemplateChangeConfirm 已删除（基于弃用的字段模板系统）


  // v2.0: 处理批量更换牌组确认（完全引用式架构）
  async function handleBatchDeckChangeConfirm(targetDeckId: string, operationType: 'move' | 'copy' = 'move') {
    const selectedCardIds = Array.from(selectedCards);

    try {
      logger.debug('[批量操作] 开始更换牌组:', {
        targetDeckId,
        operationType,
        cardCount: selectedCardIds.length
      });

      // 获取 ReferenceDeckService
      const referenceDeckService = plugin.referenceDeckService;
      if (!referenceDeckService) {
        throw new Error('ReferenceDeckService 未初始化');
      }

      // 获取要更新的卡片
      const cardsToUpdate = cards.filter(c => selectedCardIds.includes(c.uuid));
      const cardUUIDs = cardsToUpdate.map(c => c.uuid);

      let operationResult: { success: number; failed: number; errors: any[] };

      if (operationType === 'copy') {
        // 复制操作：创建新卡片副本并添加到目标牌组
        logger.debug('[批量操作] 执行复制操作');
        
        let success = 0, failed = 0;
        const errors: any[] = [];
        const newCardUUIDs: string[] = [];
        
        for (const card of cardsToUpdate) {
          try {
            // 创建新卡片（不设置 deckId，使用引用式架构）
            // v2.2: referencedByDecks 由 addCardsToDeck() 统一维护
            const newCard = {
              ...card,
              uuid: generateUUID(),
              deckId: '', // v2.0: 不使用 deckId
              referencedByDecks: [], // 由 addCardsToDeck() 填充
              created: new Date().toISOString(),
              modified: new Date().toISOString()
            };
            await dataStorage.saveCard(newCard);
            newCardUUIDs.push(newCard.uuid);
            success++;
          } catch (error) {
            failed++;
            errors.push({ card, error });
          }
        }
        
        // 将新卡片添加到目标牌组的 cardUUIDs
        if (newCardUUIDs.length > 0) {
          await referenceDeckService.addCardsToDeck(targetDeckId, newCardUUIDs);
        }
        
        operationResult = { success, failed, errors };
      } else {
        // 移动操作：使用引用式架构（更新 deck.cardUUIDs 和 card.referencedByDecks）
        logger.debug('[批量操作] 执行移动操作');
        
        let success = 0, failed = 0;
        const errors: any[] = [];
        
        // 1. 找出每张卡片当前所属的牌组（通过 deck.cardUUIDs 查找）
        const sourceDeckIds = new Set<string>();
        for (const card of cardsToUpdate) {
          for (const deck of allDecks) {
            if (deck.cardUUIDs?.includes(card.uuid)) {
              sourceDeckIds.add(deck.id);
            }
          }
        }
        
        // 2. 从所有源牌组移除卡片引用
        for (const sourceDeckId of sourceDeckIds) {
          if (sourceDeckId !== targetDeckId) {
            try {
              await referenceDeckService.removeCardsFromDeck(sourceDeckId, cardUUIDs);
              logger.debug(`已从牌组 ${sourceDeckId} 移除卡片引用`);
            } catch (error) {
              logger.error(`从牌组 ${sourceDeckId} 移除卡片引用失败:`, error);
            }
          }
        }
        
        // 3. 添加卡片到目标牌组
        const addResult = await referenceDeckService.addCardsToDeck(targetDeckId, cardUUIDs);
        if (addResult.success) {
          success = addResult.addedCount + addResult.skippedCount;
          logger.debug(`已添加 ${addResult.addedCount} 张卡片到目标牌组，跳过 ${addResult.skippedCount} 张`);
        } else {
          failed = cardUUIDs.length;
          errors.push({ error: addResult.error });
        }
        
        operationResult = { success, failed, errors };
      }

      // 清除选择
      handleClearSelection();

      // 显示结果通知
      const actionText = operationType === 'copy' ? '复制' : '移动';
      if (operationResult.failed === 0) {
        showNotification(
          `成功将 ${operationResult.success} 张卡片${actionText}到新牌组`,
          "success"
        );
      } else {
        showNotification(
          `${actionText}完成：成功 ${operationResult.success} 张，失败 ${operationResult.failed} 张`,
          "warning"
        );
        logger.error(`[Batch${operationType === 'copy' ? 'Copy' : 'Move'}] 失败详情:`, operationResult.errors);
      }

      // 刷新数据
      await loadCards();
      // 刷新牌组数据
      allDecks = await dataStorage.getDecks();

    } catch (error) {
      logger.error('批量更换牌组失败:', error);
      showNotification("批量更换牌组失败", "error");
    }
  }

  // handleBatchDeckChangeCancel 已移除（改用 Obsidian Menu API）

  // 处理批量添加标签确认
  async function handleBatchAddTags(tagsToAdd: string[]) {
    const selectedCardIds = Array.from(selectedCards);
    
    try {
      logger.debug('开始批量添加标签:', {
        tags: tagsToAdd,
        cardCount: selectedCardIds.length,
        dataSource
      });

      // 根据数据源获取要更新的卡片
      const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
      const cardsToUpdate = sourceCards.filter(c => selectedCardIds.includes(c.uuid));

      if (dataSource === 'incremental-reading') {
        // 增量阅读模式：更新IR内容块的标签（支持 block/chunk/PDF书签）
        await ensureIRStorageService();
        const { setCardProperty } = await import('../../utils/yaml-utils');
        const chunkData = await irStorageService!.getAllChunkData();
        const allBlocks = await irStorageService!.getAllBlocks();

        let success = 0, failed = 0;
        for (const id of selectedCardIds) {
          try {
            const card = cardsToUpdate.find(c => c.uuid === id);
            const currentTags = card?.tags || [];
            const newTags = [...new Set([...currentTags, ...tagsToAdd])];

            if (isPdfBookmarkTaskId(id)) {
              // PDF书签任务
              const pdfService = new IRPdfBookmarkTaskService(plugin.app);
              await pdfService.initialize();
              await pdfService.updateTask(id, { tags: newTags });
              success++;
            } else if (card?.metadata?.irChunk) {
              // 新版 chunk：通过文件YAML更新标签
              const chunk = chunkData[id];
              if (chunk?.filePath) {
                const adapter = plugin.app.vault.adapter;
                if (await adapter.exists(chunk.filePath)) {
                  let content = await adapter.read(chunk.filePath);
                  content = setCardProperty(content, 'tags', newTags);
                  await adapter.write(chunk.filePath, content);
                  success++;
                }
              }
            } else {
              // 旧版 block
              const block = allBlocks[id];
              if (block) {
                const updatedBlock = { ...block, tags: newTags, updatedAt: new Date().toISOString() };
                await irStorageService!.saveBlock(updatedBlock);
                success++;
              }
            }
          } catch (error) {
            logger.error(`[IR] 更新内容块 ${id} 标签失败:`, error);
            failed++;
          }
        }

        await loadIRContentCards();
        if (failed === 0) {
          showNotification(`成功为 ${success} 个内容块添加标签`, "success");
        } else {
          showNotification(`添加完成：成功 ${success} 个，失败 ${failed} 个`, "warning");
        }
      } else if (dataSource === 'questionBank') {
        // 考试牌组模式：手动更新每个题库
        if (!questionBankStorage) {
          showNotification("题库存储服务未初始化", "error");
          return;
        }

        let success = 0, failed = 0;
        const cardsByBank = new Map<string, Card[]>();
        
        // 按题库分组
        // v2.2: 优先从 content YAML 的 we_decks 获取题库ID
        for (const card of cardsToUpdate) {
          const { primaryDeckId } = getCardDeckIds(card);
          const bankId = primaryDeckId || card.deckId || '';
          if (!cardsByBank.has(bankId)) {
            cardsByBank.set(bankId, []);
          }
          cardsByBank.get(bankId)!.push(card);
        }

        const { setCardProperty } = await import('../../utils/yaml-utils');

        for (const bankCards of cardsByBank.values()) {
          for (const c of bankCards) {
            try {
              const currentTags = c.tags || [];
              const newTags = [...new Set([...currentTags, ...tagsToAdd])];
              const updatedCard = {
                ...c,
                content: setCardProperty(c.content || '', 'tags', newTags),
                tags: newTags,
                modified: new Date().toISOString(),
              };
              await dataStorage.updateCard(updatedCard);
              success++;
            } catch (error) {
              logger.error(`更新题库卡片 ${c.uuid} 失败:`, error);
              failed++;
            }
          }
        }

        // 重新加载题库数据
        await loadQuestionBankCards();

        // 显示结果
        if (failed === 0) {
          showNotification(`成功为 ${success} 张卡片添加标签`, "success");
        } else {
          showNotification(`添加完成：成功 ${success} 张，失败 ${failed} 张`, "warning");
        }
      } else {
        // 记忆牌组模式：使用批量操作服务
        // v2.1 修复：直接修改 content YAML，而不是派生字段
        const { setCardProperty } = await import('../../utils/yaml-utils');
        
        const operationResult = await batchUpdateCards(
          cardsToUpdate,
          (card) => {
            // 合并标签（去重）
            const currentTags = card.tags || [];
            const newTags = [...new Set([...currentTags, ...tagsToAdd])];
            
            // 修改 content YAML（权威数据源）
            const newContent = setCardProperty(card.content || '', 'tags', newTags);
            
            return {
              ...card,
              content: newContent,
              modified: new Date().toISOString()
            };
          },
          dataStorage
        );

        // 刷新数据
        await loadCards();

        // 显示结果通知
        if (operationResult.failed === 0) {
          showNotification(
            `成功为 ${operationResult.success} 张卡片添加标签`,
            "success"
          );
        } else {
          showNotification(
            `添加完成：成功 ${operationResult.success} 张，失败 ${operationResult.failed} 张`,
            "warning"
          );
          logger.error('[BatchAddTags] 失败详情:', operationResult.errors);
        }
      }

    } catch (error) {
      logger.error('批量添加标签失败:', error);
      showNotification("批量添加标签失败", "error");
    }
  }

  // handleBatchAddTagsCancel 已移除（改用 Obsidian Menu API）

  // 处理批量删除标签确认
  async function handleBatchRemoveTagsConfirm(tagsToRemove: string[]) {
    const selectedCardIds = Array.from(selectedCards);

    try {
      logger.debug('[批量操作] 开始删除标签:', {
        tags: tagsToRemove,
        cardCount: selectedCardIds.length,
        dataSource
      });

      // 根据数据源获取要更新的卡片
      const sourceCards = dataSource === 'questionBank' ? questionBankCards : dataSource === 'incremental-reading' ? irContentCards : cards;
      const cardsToUpdate = sourceCards.filter(c => selectedCardIds.includes(c.uuid));

      if (dataSource === 'incremental-reading') {
        // 增量阅读模式：删除IR内容块的标签（支持 block/chunk/PDF书签）
        await ensureIRStorageService();
        const { setCardProperty } = await import('../../utils/yaml-utils');
        const chunkData = await irStorageService!.getAllChunkData();
        const allBlocks = await irStorageService!.getAllBlocks();

        let success = 0, failed = 0;
        for (const id of selectedCardIds) {
          try {
            const card = cardsToUpdate.find(c => c.uuid === id);
            const currentTags = card?.tags || [];
            const newTags = currentTags.filter(tag => !tagsToRemove.includes(tag));

            if (isPdfBookmarkTaskId(id)) {
              const pdfService = new IRPdfBookmarkTaskService(plugin.app);
              await pdfService.initialize();
              await pdfService.updateTask(id, { tags: newTags });
              success++;
            } else if (card?.metadata?.irChunk) {
              const chunk = chunkData[id];
              if (chunk?.filePath) {
                const adapter = plugin.app.vault.adapter;
                if (await adapter.exists(chunk.filePath)) {
                  let content = await adapter.read(chunk.filePath);
                  content = setCardProperty(content, 'tags', newTags);
                  await adapter.write(chunk.filePath, content);
                  success++;
                }
              }
            } else {
              const block = allBlocks[id];
              if (block) {
                const updatedBlock = { ...block, tags: newTags, updatedAt: new Date().toISOString() };
                await irStorageService!.saveBlock(updatedBlock);
                success++;
              }
            }
          } catch (error) {
            logger.error(`[IR] 删除内容块 ${id} 标签失败:`, error);
            failed++;
          }
        }

        await loadIRContentCards();
        if (failed === 0) {
          showNotification(`成功从 ${success} 个内容块中删除标签`, "success");
        } else {
          showNotification(`删除完成：成功 ${success} 个，失败 ${failed} 个`, "warning");
        }
      } else if (dataSource === 'questionBank') {
        // 考试牌组模式：手动更新每个题库
        if (!questionBankStorage) {
          showNotification("题库存储服务未初始化", "error");
          return;
        }

        let success = 0, failed = 0;
        const cardsByBank = new Map<string, Card[]>();
        
        // 按题库分组
        // v2.2: 优先从 content YAML 的 we_decks 获取题库ID
        for (const card of cardsToUpdate) {
          const { primaryDeckId } = getCardDeckIds(card);
          const bankId = primaryDeckId || card.deckId || '';
          if (!cardsByBank.has(bankId)) {
            cardsByBank.set(bankId, []);
          }
          cardsByBank.get(bankId)!.push(card);
        }

        const { setCardProperty } = await import('../../utils/yaml-utils');

        for (const bankCards of cardsByBank.values()) {
          for (const c of bankCards) {
            try {
              const currentTags = c.tags || [];
              const newTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
              const updatedCard = {
                ...c,
                content: setCardProperty(c.content || '', 'tags', newTags),
                tags: newTags,
                modified: new Date().toISOString(),
              };
              await dataStorage.updateCard(updatedCard);
              success++;
            } catch (error) {
              logger.error(`更新题库卡片 ${c.uuid} 失败:`, error);
              failed++;
            }
          }
        }

        // 重新加载题库数据
        await loadQuestionBankCards();

        // 显示结果
        if (failed === 0) {
          showNotification(`成功从 ${success} 张卡片中删除标签`, "success");
        } else {
          showNotification(`删除完成：成功 ${success} 张，失败 ${failed} 张`, "warning");
        }
      } else {
        // 记忆牌组模式：使用批量操作服务
        // v2.1 修复：直接修改 content YAML，而不是派生字段
        const { setCardProperty } = await import('../../utils/yaml-utils');
        
        const operationResult = await batchUpdateCards(
          cardsToUpdate,
          (card) => {
            // 过滤掉要删除的标签
            const currentTags = card.tags || [];
            const newTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
            
            // 修改 content YAML（权威数据源）
            const newContent = setCardProperty(card.content || '', 'tags', newTags);
            
            return {
              ...card,
              content: newContent,
              modified: new Date().toISOString()
            };
          },
          dataStorage
        );

        // 刷新数据
        await loadCards();

        // 显示结果通知
        if (operationResult.failed === 0) {
          showNotification(
            `成功从 ${operationResult.success} 张卡片中删除标签`,
            "success"
          );
        } else {
          showNotification(
            `删除完成：成功 ${operationResult.success} 张，失败 ${operationResult.failed} 张`,
            "warning"
          );
          logger.error('[BatchRemoveTags] 失败详情:', operationResult.errors);
        }
      }

    } catch (error) {
      logger.error('批量删除标签失败:', error);
      showNotification("批量删除标签失败", "error");
    }
  }

  // handleBatchRemoveTagsCancel 已移除（改用 Obsidian Menu API）

  // 视图切换
  async function switchView(view: 'table' | 'grid' | 'kanban') {
    // 检查高级功能权限
    if (view === 'grid' && !premiumGuard.canUseFeature(PREMIUM_FEATURES.GRID_VIEW)) {
      promptFeatureId = PREMIUM_FEATURES.GRID_VIEW;
      showActivationPrompt = true;
      return;
    }
    
    if (view === 'kanban' && !premiumGuard.canUseFeature(PREMIUM_FEATURES.KANBAN_VIEW)) {
      promptFeatureId = PREMIUM_FEATURES.KANBAN_VIEW;
      showActivationPrompt = true;
      return;
    }
    
    // 显示加载状态
    isViewSwitching = true;
    
    // 切换视图
    currentView = view;
    await saveViewPreferences(); // 保存视图偏好
    
    // 通知父组件状态变化（用于侧边栏导航同步）
    window.dispatchEvent(new CustomEvent('Weave:card-view-change', { detail: view }));
    
    // 等待下一帧，确保DOM已更新
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 隐藏加载状态
    isViewSwitching = false;
    
    // 视图切换完成
  }
  
  // 处理激活提示关闭
  function handleActivationPromptClose() {
    showActivationPrompt = false;
  }

  // 更多菜单控制函数 - 使用 Obsidian Menu API
  function toggleMoreMenu(evt?: MouseEvent) {
    const menu = new Menu();

    // === 网格视图专属功能 ===
    if (currentView === 'grid') {
      // 布局切换
      menu.addItem((item) => {
        item.setTitle(t('cardManagement.layout.fixed')).setIcon('grid')
          .setChecked(gridLayout === 'fixed')
          .onClick(async () => { await handleLayoutModeChange('fixed'); });
      });
      menu.addItem((item) => {
        item.setTitle(t('cardManagement.layout.waterfall')).setIcon('layout-grid')
          .setChecked(gridLayout === 'masonry')
          .onClick(async () => { await handleLayoutModeChange('masonry'); });
      });

      menu.addSeparator();

      // 卡片属性显示 - 子菜单
      menu.addItem((item) => {
        item.setTitle(t('cardManagement.gridAttributeSelector.title')).setIcon('tag');
        const submenu = (item as any).setSubmenu();
        const attrOptions: { key: GridCardAttributeType; label: string; icon: string }[] = [
          { key: 'none', label: t('cardManagement.gridAttributeSelector.none'), icon: 'eye-off' },
          { key: 'uuid', label: t('cardManagement.gridAttributeSelector.uuid'), icon: 'hash' },
          { key: 'source', label: t('cardManagement.gridAttributeSelector.source'), icon: 'file-text' },
          { key: 'priority', label: t('cardManagement.gridAttributeSelector.priority'), icon: 'flag' },
          { key: 'retention', label: t('cardManagement.gridAttributeSelector.retention'), icon: 'activity' },
          { key: 'modified', label: t('cardManagement.gridAttributeSelector.modified'), icon: 'clock' },
        ];
        for (const opt of attrOptions) {
          submenu.addItem((sub: any) => {
            sub.setTitle(opt.label).setIcon(opt.icon)
              .setChecked(gridCardAttribute === opt.key)
              .onClick(async () => { await setGridCardAttribute(opt.key); });
          });
        }
      });
    }

    // === 看板视图专属功能 ===
    if (currentView === 'kanban') {
      // 显示密度
      menu.addItem((item) => {
        item.setTitle('紧凑模式').setIcon('minimize-2')
          .setChecked(kanbanLayoutMode === 'compact')
          .onClick(async () => { await handleKanbanLayoutModeChange('compact'); });
      });
      menu.addItem((item) => {
        item.setTitle('舒适模式').setIcon('maximize-2')
          .setChecked(kanbanLayoutMode === 'comfortable')
          .onClick(async () => { await handleKanbanLayoutModeChange('comfortable'); });
      });
      menu.addItem((item) => {
        item.setTitle('宽松模式').setIcon('expand')
          .setChecked(kanbanLayoutMode === 'spacious')
          .onClick(async () => { await handleKanbanLayoutModeChange('spacious'); });
      });

      menu.addSeparator();

      // 卡片属性显示 - 子菜单
      menu.addItem((item) => {
        item.setTitle(t('cardManagement.gridAttributeSelector.title')).setIcon('tag');
        const submenu = (item as any).setSubmenu();
        const attrOptions: { key: GridCardAttributeType; label: string; icon: string }[] = [
          { key: 'none', label: t('cardManagement.gridAttributeSelector.none'), icon: 'eye-off' },
          { key: 'uuid', label: t('cardManagement.gridAttributeSelector.uuid'), icon: 'hash' },
          { key: 'source', label: t('cardManagement.gridAttributeSelector.source'), icon: 'file-text' },
          { key: 'priority', label: t('cardManagement.gridAttributeSelector.priority'), icon: 'flag' },
          { key: 'retention', label: t('cardManagement.gridAttributeSelector.retention'), icon: 'activity' },
          { key: 'modified', label: t('cardManagement.gridAttributeSelector.modified'), icon: 'clock' },
        ];
        for (const opt of attrOptions) {
          submenu.addItem((sub: any) => {
            sub.setTitle(opt.label).setIcon(opt.icon)
              .setChecked(gridCardAttribute === opt.key)
              .onClick(async () => { await setGridCardAttribute(opt.key); });
          });
        }
      });

      // 列属性设置
      menu.addItem((item) => {
        item.setTitle('列属性设置').setIcon('sliders')
          .onClick(() => {
            const kanbanView = document.querySelector('.weave-kanban-view');
            if (kanbanView) {
              const columnButton = kanbanView.querySelector('[title="\u5217\u8bbe\u7f6e"]') as HTMLButtonElement;
              if (columnButton) columnButton.click();
            }
          });
      });
    }

    // === 表格视图专属功能 ===
    if (currentView === 'table') {
      menu.addItem((item) => {
        item.setTitle('基础信息模式').setIcon('table')
          .setChecked(tableViewMode === 'basic')
          .onClick(async () => { tableViewMode = 'basic'; await saveViewPreferences(); });
      });
      menu.addItem((item) => {
        item.setTitle('复习历史模式').setIcon('history')
          .setChecked(tableViewMode === 'review')
          .onClick(async () => { tableViewMode = 'review'; await saveViewPreferences(); });
      });
      menu.addItem((item) => {
        item.setTitle('考试牌组模式').setIcon('edit-3')
          .setChecked(tableViewMode === 'questionBank')
          .onClick(async () => { tableViewMode = 'questionBank'; await saveViewPreferences(); });
      });

      menu.addSeparator();

      menu.addItem((item) => {
        item.setTitle('字段管理').setIcon('columns')
          .onClick(() => { showColumnManager = true; });
      });
    }

    // === 工具 ===
    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle('数据管理').setIcon('database')
        .onClick(() => { dataManagementInitialTab = 'data'; showDataManagementModal = true; });
    });
    menu.addItem((item) => {
      item.setTitle('质量扫描').setIcon('search')
        .onClick(() => { dataManagementInitialTab = 'quality'; showDataManagementModal = true; });
    });

    if (evt) {
      menu.showAtMouseEvent(evt);
    } else if (moreButtonElement) {
      const rect = moreButtonElement.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
    }
  }

  const modalActive = $derived(
    showBuildDeckModal ||
        showBuildIRDeckModal ||
      showDataManagementModal ||
      showColumnManager ||
      showActivationPrompt
  );

  // 布局切换处理
  async function handleLayoutModeChange(layout: "fixed" | "masonry") {
    gridLayout = layout;
    await saveViewPreferences(); // 保存视图偏好
  }

  // 表格视图模式切换处理
  async function handleTableViewModeChange(mode: 'basic' | 'review') {
    tableViewMode = mode;
    logger.debug('[TableViewMode] 模式已切换为:', mode);
    await saveViewPreferences(); // 保存视图偏好
  }

  // 移动端菜单项点击处理 - 使用 Obsidian Menu API
  function showMobileCardManagementMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    // 功能切换分组
    menu.addItem((item) => {
      item
        .setTitle('牌组学习')
        .setIcon('graduation-cap')
        .onClick(() => {
          // 修复：使用 window.dispatchEvent 与 WeaveApp.svelte 的监听器匹配
          window.dispatchEvent(new CustomEvent('Weave:navigate', { 
            detail: 'deck-study' 
          }));
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('卡片管理')
        .setIcon('list')
        .setChecked(true)
        .onClick(() => {
          // 当前页面，无需操作
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('AI助手')
        .setIcon('bot')
        .onClick(() => {
          // 修复：使用 window.dispatchEvent 与 WeaveApp.svelte 的监听器匹配
          window.dispatchEvent(new CustomEvent('Weave:navigate', { 
            detail: 'ai-assistant' 
          }));
        });
    });
    
    menu.addSeparator();
    
    // 数据源切换子菜单（移动端）
    menu.addItem((item) => {
      item
        .setTitle('数据源切换')
        .setIcon('database');
      const submenu = (item as any).setSubmenu();
      
      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('记忆牌组')
          .setIcon('brain')
          .setChecked(dataSource === 'memory')
          .onClick(async () => {
            await switchDataSource('memory');
          });
      });
      
      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('增量阅读')
          .setIcon('book-open')
          .setChecked(dataSource === 'incremental-reading')
          .onClick(async () => {
            await switchDataSource('incremental-reading');
          });
      });
      
      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('考试牌组')
          .setIcon('edit-3')
          .setChecked(dataSource === 'questionBank')
          .onClick(async () => {
            await switchDataSource('questionBank');
          });
      });
    });
    
    // IR类型筛选子菜单（仅增量阅读数据源时显示）
    if (dataSource === 'incremental-reading') {
      menu.addItem((item) => {
        item
          .setTitle('内容类型')
          .setIcon('filter');
        const submenu = (item as any).setSubmenu();
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('MD文件')
            .setIcon('file-text')
            .setChecked(irTypeFilter === 'md')
            .onClick(() => { irTypeFilter = irTypeFilter === 'md' ? 'all' : 'md'; });
        });
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('PDF书签')
            .setIcon('file')
            .setChecked(irTypeFilter === 'pdf')
            .onClick(() => { irTypeFilter = irTypeFilter === 'pdf' ? 'all' : 'pdf'; });
        });
      });
    }
    
    menu.addSeparator();
    
    // 表格视图专用功能（仅在表格视图下显示）
    if (currentView === 'table') {
      // 表格视图模式切换子菜单
      menu.addItem((item) => {
        item
          .setTitle('基础信息模式')
          .setIcon('table')
          .setChecked(tableViewMode === 'basic')
          .onClick(async () => {
            tableViewMode = 'basic';
            await saveViewPreferences();
          });
      });
      
      menu.addItem((item) => {
        item
          .setTitle('复习历史模式')
          .setIcon('history')
          .setChecked(tableViewMode === 'review')
          .onClick(async () => {
            tableViewMode = 'review';
            await saveViewPreferences();
          });
      });
      
      menu.addItem((item) => {
        item
          .setTitle('考试牌组模式')
          .setIcon('edit-3')
          .setChecked(tableViewMode === 'questionBank')
          .onClick(async () => {
            tableViewMode = 'questionBank';
            await saveViewPreferences();
          });
      });
      
      menu.addSeparator();
      
      menu.addItem((item) => {
        item
          .setTitle('字段管理')
          .setIcon('columns')
          .onClick(() => {
            showColumnManager = true;
          });
      });
    }
    
    // 网格视图专用功能（仅在网格视图下显示）
    if (currentView === 'grid') {
      menu.addItem((item) => {
        item
          .setTitle('固定布局')
          .setIcon('grid')
          .setChecked(gridLayout === 'fixed')
          .onClick(async () => {
            gridLayout = 'fixed';
            await saveViewPreferences();
          });
      });
      
      menu.addItem((item) => {
        item
          .setTitle('瀑布流布局')
          .setIcon('layout-grid')
          .setChecked(gridLayout === 'masonry')
          .onClick(async () => {
            gridLayout = 'masonry';
            await saveViewPreferences();
          });
      });
      
      menu.addSeparator();
      
      // 卡片属性显示选项 - 使用子菜单
      menu.addItem((item) => {
        const currentAttrLabel = gridCardAttribute === 'none' ? '不显示' :
          gridCardAttribute === 'uuid' ? 'UUID' :
          gridCardAttribute === 'source' ? '来源' :
          gridCardAttribute === 'priority' ? '优先级' :
          gridCardAttribute === 'retention' ? '记忆率' :
          gridCardAttribute === 'modified' ? '修改时间' : '未知';
        
        item
          .setTitle(`卡片属性：${currentAttrLabel}`)
          .setIcon('tag');
        
        const submenu = (item as any).setSubmenu();
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('不显示')
            .setIcon('eye-off')
            .setChecked(gridCardAttribute === 'none')
            .onClick(async () => {
              setGridCardAttribute('none');
            });
        });
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('UUID')
            .setIcon('hash')
            .setChecked(gridCardAttribute === 'uuid')
            .onClick(async () => {
              setGridCardAttribute('uuid');
            });
        });
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('来源')
            .setIcon('file-text')
            .setChecked(gridCardAttribute === 'source')
            .onClick(async () => {
              setGridCardAttribute('source');
            });
        });
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('优先级')
            .setIcon('flag')
            .setChecked(gridCardAttribute === 'priority')
            .onClick(async () => {
              setGridCardAttribute('priority');
            });
        });
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('记忆率')
            .setIcon('activity')
            .setChecked(gridCardAttribute === 'retention')
            .onClick(async () => {
              setGridCardAttribute('retention');
            });
        });
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('修改时间')
            .setIcon('clock')
            .setChecked(gridCardAttribute === 'modified')
            .onClick(async () => {
              setGridCardAttribute('modified');
            });
        });
      });
      
      // 侧边栏专用功能：关联当前活动文档、定位跳转模式
      if (isInSidebar) {
        menu.addSeparator();
        
        menu.addItem((item) => {
          item
            .setTitle('关联当前活动文档')
            .setIcon(documentFilterMode === 'current' ? 'file-text' : 'file')
            .setChecked(documentFilterMode === 'current')
            .setDisabled(!currentActiveDocument)
            .onClick(() => {
              toggleDocumentFilter();
            });
        });
        
        menu.addItem((item) => {
          item
            .setTitle('定位跳转模式')
            .setIcon('bullseye')
            .setChecked(enableCardLocationJump)
            .onClick(async () => {
              await toggleCardLocationJump();
            });
        });
      }
    }
    
    // 看板视图专用功能（仅在看板视图下显示）
    if (currentView === 'kanban') {
      menu.addItem((item) => {
        item
          .setTitle('紧凑模式')
          .setIcon('minimize-2')
          .setChecked(kanbanLayoutMode === 'compact')
          .onClick(async () => {
            await handleKanbanLayoutModeChange('compact');
          });
      });
      
      menu.addItem((item) => {
        item
          .setTitle('舒适模式')
          .setIcon('maximize-2')
          .setChecked(kanbanLayoutMode === 'comfortable')
          .onClick(async () => {
            await handleKanbanLayoutModeChange('comfortable');
          });
      });
      
      menu.addItem((item) => {
        item
          .setTitle('宽松模式')
          .setIcon('expand')
          .setChecked(kanbanLayoutMode === 'spacious')
          .onClick(async () => {
            await handleKanbanLayoutModeChange('spacious');
          });
      });
      
      menu.addSeparator();
      
      // 列属性设置入口（所有位置都显示）
      menu.addItem((item) => {
        item
          .setTitle('列属性设置')
          .setIcon('sliders')
          .onClick(() => {
            // 触发看板视图的列设置
            const kanbanView = document.querySelector('.weave-kanban-view');
            if (kanbanView) {
              const columnButton = kanbanView.querySelector('[title="列设置"]') as HTMLButtonElement;
              if (columnButton) {
                columnButton.click();
              }
            }
          });
      });
      
      // 侧边栏专用功能：关联当前活动文档、定位跳转模式
      if (isInSidebar) {
        menu.addSeparator();
        
        menu.addItem((item) => {
          item
            .setTitle('关联当前活动文档')
            .setIcon(documentFilterMode === 'current' ? 'file-text' : 'file')
            .setChecked(documentFilterMode === 'current')
            .setDisabled(!currentActiveDocument)
            .onClick(() => {
              toggleDocumentFilter();
            });
        });
        
        menu.addItem((item) => {
          item
            .setTitle('定位跳转模式')
            .setIcon('bullseye')
            .setChecked(enableCardLocationJump)
            .onClick(async () => {
              await toggleCardLocationJump();
            });
        });
      }
    }
    
    menu.addSeparator();
    
    // 工具分组
    menu.addItem((item) => {
      item
        .setTitle('数据管理')
        .setIcon('database')
        .onClick(() => {
          dataManagementInitialTab = 'data';
          showDataManagementModal = true;
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('质量扫描')
        .setIcon('search')
        .onClick(() => {
          dataManagementInitialTab = 'quality';
          showDataManagementModal = true;
        });
    });
    
    menu.showAtMouseEvent(evt);
  }

  // 移动端搜索按钮点击处理
  function handleMobileSearchClick() {
    showMobileSearchInput = !showMobileSearchInput;
  }

  // 看板显示密度切换处理
  async function handleKanbanLayoutModeChange(layout: "compact" | "comfortable" | "spacious") {
    kanbanLayoutMode = layout;
    await saveViewPreferences(); // 保存视图偏好
  }
  
  // 网格视图卡片点击处理（切换选中状态）
  function handleGridCardClick(card: Card) {
    // 如果启用了定位跳转模式，点击卡片跳转到源文档
    if (enableCardLocationJump) {
      jumpToSourceDocument(card);
      return;
    }
    
    // 否则执行选中/取消选中逻辑
    const newSelectedCards = new Set(selectedCards);
    if (newSelectedCards.has(card.uuid)) {
      // 已选中 - 取消选中
      newSelectedCards.delete(card.uuid);
    } else {
      // 未选中 - 选中
      newSelectedCards.add(card.uuid);
    }
    selectedCards = newSelectedCards;
  }
  
  // 网格视图卡片长按处理（移动端多选）
  function handleGridCardLongPress(card: Card) {
    // 长按触发多选：切换卡片选中状态
    const newSelectedCards = new Set(selectedCards);
    if (newSelectedCards.has(card.uuid)) {
      newSelectedCards.delete(card.uuid);
    } else {
      newSelectedCards.add(card.uuid);
    }
    selectedCards = newSelectedCards;
  }
  
  // 切换卡片定位跳转模式
  async function toggleCardLocationJump() {
    enableCardLocationJump = !enableCardLocationJump;
    await saveViewPreferences(); // 保存视图偏好
    
    // 切换到跳转模式时，清空已选中的卡片
    if (enableCardLocationJump && selectedCards.size > 0) {
      selectedCards = new Set();
      showNotification('已启用定位跳转模式\n点击卡片将跳转到源文档', 'success');
    } else if (enableCardLocationJump) {
      showNotification('已启用定位跳转模式\n点击卡片将跳转到源文档', 'success');
    } else {
      showNotification('已禁用定位跳转模式\n恢复单击选中、双击编辑功能', 'info');
    }
  }
  
  // 切换网格卡片属性显示
  function toggleGridAttributeMenu() {
    showGridAttributeMenu = !showGridAttributeMenu;
  }
  
  // 设置网格卡片属性
  async function setGridCardAttribute(attr: GridCardAttributeType) {
    gridCardAttribute = attr;
    showGridAttributeMenu = false;
    await saveViewPreferences(); // 保存视图偏好
  }
  
  // 网格视图卡片编辑处理
  function handleGridCardEdit(card: Card) {
    handleTempFileEditCard(card.uuid);
  }
  
  // 网格视图卡片删除处理
  function handleGridCardDelete(card: Card) {
    handleDeleteCard(card.uuid);
  }
  
  // 网格视图卡片查看处理
  function handleGridCardView(card: Card) {
    handleViewCard(card.uuid);
  }

  // 看板视图处理函数
  function handleKanbanCardSelect(card: Card) {
    // 打开卡片编辑器
    handleEditCard(card.uuid);
  }

  function handleKanbanStartStudy(cards: Card[]) {
    // 这里可以集成学习功能，暂时显示通知
    showNotification(`开始学习 ${cards.length} 张卡片`, "info");
  }

  // 看板视图卡片更新（包括新增和跨牌组移动）
  async function handleKanbanCardUpdate(updatedCard: Card) {
    try {
      // v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
      const existingCard = cards.find(c => c.uuid === updatedCard.uuid);
      const { primaryDeckId: existingDeckId } = existingCard ? getCardDeckIds(existingCard) : { primaryDeckId: undefined };
      const { primaryDeckId: updatedDeckId } = getCardDeckIds(updatedCard);
      const oldDeckId = existingDeckId || existingCard?.deckId;
      const newDeckId = updatedDeckId || updatedCard.deckId;
      const isMove = existingCard && oldDeckId !== newDeckId;
      
      let result;
      if (isMove) {
        // 验证：跨牌组移动必须有有效的源和目标牌组
        if (!oldDeckId || !newDeckId) {
          showNotification('无法移动：卡片必须属于一个有效的牌组', 'error');
          logger.warn(`[KanbanCardUpdate] 跨牌组移动失败: 源=${oldDeckId}, 目标=${newDeckId}`);
          return;
        }
        
        // 使用安全的跨牌组移动方法
        result = await dataStorage.moveCardToDeck(
          updatedCard.uuid,
          oldDeckId,
          newDeckId
        );
        if (result.success) {
          showNotification('卡片已移动到新牌组', 'success');
        }
      } else {
        // 普通保存（优先级等属性更新）
        // 确保卡片有有效的deckId
        if (!updatedCard.deckId) {
          showNotification('无法保存：卡片必须属于一个牌组', 'error');
          return;
        }
        result = await dataStorage.saveCard(updatedCard);
        if (result.success) {
          const index = cards.findIndex(c => c.uuid === updatedCard.uuid);
          if (index !== -1) {
            showNotification('卡片已更新', 'success');
          } else {
            showNotification('卡片已创建', 'success');
          }
        }
      }
      
      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }
      
      // 更新本地状态
      const index = cards.findIndex(c => c.uuid === updatedCard.uuid);
      if (index !== -1) {
        cards[index] = result.data || updatedCard;
        cards = [...cards];
      } else {
        cards = [...cards, result.data || updatedCard];
      }
    } catch (error) {
      logger.error('保存卡片失败:', error);
      showNotification(`保存卡片失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      // 重新加载数据以恢复状态
      await loadCards();
    }
  }

  // 看板视图卡片删除
  async function handleKanbanCardDelete(cardId: string) {
    try {
      // 确认删除
      const cardToDelete = cards.find(c => c.uuid === cardId);
      if (!cardToDelete) return;
      
      const frontContent = getCardContentBySide(cardToDelete, 'front', [], " / ");
      // 使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
      const confirmed = await showObsidianConfirm(
        plugin.app,
        `确定要删除卡片 "${frontContent}" 吗？`,
        { title: '确认删除', confirmText: '删除' }
      );
      if (!confirmed) return;
      
      // 删除卡片
      await dataStorage.deleteCard(cardId);
      
      // 更新本地状态
      cards = cards.filter(c => c.uuid !== cardId);
      
      // 通知全局侧边栏刷新
      plugin.app.workspace.trigger('Weave:data-changed');
      
      // 延迟显示通知，避免覆盖清理通知
      setTimeout(() => {
        showNotification('卡片已删除', 'success');
      }, 1000);
    } catch (error) {
      logger.error('删除卡片失败:', error);
      showNotification('删除卡片失败', 'error');
      // 重新加载数据以恢复状态
      await loadCards();
    }
  }


</script>

<div class="weave-card-management-page">
  
  <!-- 加载动画 - 全屏显示 -->
  {#if isLoading || isViewSwitching}
    <div class="initial-loading-overlay">
      <BouncingBallsLoader 
        message={isLoading 
          ? "正在加载卡片数据..." 
          : currentView === 'grid' 
            ? '正在加载网格视图...' 
            : currentView === 'kanban' 
              ? '正在加载看板视图...' 
              : '正在加载表格视图...'
        } 
      />
    </div>
  {:else}
    <!-- 移动端头部（仅在移动端显示） -->
    <MobileCardManagementHeader
      {currentView}
      onMenuClick={showMobileCardManagementMenu}
      onSearchClick={handleMobileSearchClick}
      onViewChange={handleViewChange}
    />
    
    <!-- 移动端导航菜单已改用 Obsidian Menu API，不再使用 MobileCardManagementMenu 组件 -->
    
    <!-- 移动端搜索输入框 -->
    {#if showMobileSearchInput}
      <div class="mobile-search-container">
        <CardSearchInput
          bind:value={searchQuery}
          placeholder="搜索卡片..."
          onSearch={handleSearch}
          onClear={() => {
            handleClearSearch();
            showMobileSearchInput = false;
          }}
          onSort={handleSort}
          app={plugin.app}
          dataSource={dataSource}
          availableDecks={searchAvailableDecks}
          availableTags={searchAvailableTags}
          availablePriorities={searchAvailablePriorities}
          availableQuestionTypes={searchAvailableQuestionTypes}
          availableSources={searchAvailableSources}
          availableStatuses={searchAvailableStatuses}
          availableStates={searchAvailableIRStates}
          availableAccuracies={searchAvailableAccuracies}
          availableAttemptThresholds={searchAvailableAttemptThresholds}
          availableErrorLevels={searchAvailableErrorLevels}
          availableSourceCards={searchAvailableSourceCards}
          availableYamlKeys={searchAvailableYamlKeys}
          matchCount={searchQuery ? totalFilteredItems : -1}
          totalCount={searchSourceCards.length}
          sortField={sortConfig.field}
          sortDirection={sortConfig.direction}
        />
      </div>
    {/if}
    
    <!-- 桌面端彩色圆点视图切换栏已移除 - 现在由 WeaveApp 中的 SidebarNavHeader 统一处理 -->
    <!-- 侧边栏和主内容区都使用 SidebarNavHeader 提供的视图切换功能 -->
    
    <!-- 响应式页面工具栏（桌面端显示） -->
    <header class="page-header hide-on-mobile" class:modal-active={modalActive} bind:this={toolbarContainerRef}>
      <div class="header-actions" class:sidebar-mode={toolbarMode === 'sidebar'}>
        {#if toolbarMode === 'sidebar'}
          <!-- ============================================
               侧边栏模式：紧凑布局
               ============================================ -->
          
          <!-- 更多菜单按钮 -->
          <div class="more-menu-container">
            <div
              bind:this={moreButtonElement}
              class="more-menu-button"
              role="button"
              tabindex="0"
              onclick={(e) => toggleMoreMenu(e)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMoreMenu(); }}
              aria-label="更多"
              title={t('cardManagement.more')}
            >
              <EnhancedIcon name="ellipsis-h" size={16} />
            </div>
          </div>
          
          <!-- 文档筛选（侧边栏模式） -->
          <div
            class="toolbar-button"
            class:active={documentFilterMode === 'current'}
            class:disabled={!currentActiveDocument}
            role="button"
            tabindex="0"
            onclick={(e) => { if (currentActiveDocument) toggleDocumentFilter(); }}
            onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && currentActiveDocument) toggleDocumentFilter(); }}
            aria-label="文档筛选"
            title={
              !currentActiveDocument 
                ? '请先打开一个文档' 
                : documentFilterMode === 'current'
                  ? `仅显示: ${getFileName(currentActiveDocument)}`
                  : '显示全部文档'
            }
          >
            <EnhancedIcon name={documentFilterMode === 'current' ? 'file-text' : 'file'} size={16} />
          </div>
          
          <!-- 卡片定位跳转按钮（侧边栏模式） -->
          <div
          class="toolbar-button"
          class:active={enableCardLocationJump}
          role="button"
          tabindex="0"
          onclick={toggleCardLocationJump}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCardLocationJump(); }}
          aria-label="卡片定位跳转"
          title={enableCardLocationJump ? '点击关闭定位跳转（恢复卡片选中功能）' : '点击启用定位跳转（点击卡片将跳转到源文档）'}
        >
          <EnhancedIcon name="bullseye" size={16} />
        </div>
        
        <!-- 侧边栏模式搜索框（使用 CardSearchInput 支持下拉建议） -->
        <div class="sidebar-search-wrapper">
          <CardSearchInput
            bind:value={searchQuery}
            placeholder="搜索卡片..."
            onSearch={handleSearch}
            onClear={handleClearSearch}
            onSort={handleSort}
            app={plugin.app}
            dataSource={dataSource}
            availableDecks={searchAvailableDecks}
            availableTags={searchAvailableTags}
            availablePriorities={searchAvailablePriorities}
            availableQuestionTypes={searchAvailableQuestionTypes}
            availableSources={searchAvailableSources}
            availableStatuses={searchAvailableStatuses}
            availableStates={searchAvailableIRStates}
            availableAccuracies={searchAvailableAccuracies}
            availableAttemptThresholds={searchAvailableAttemptThresholds}
            availableErrorLevels={searchAvailableErrorLevels}
            availableSourceCards={searchAvailableSourceCards}
            availableYamlKeys={searchAvailableYamlKeys}
            matchCount={searchQuery ? totalFilteredItems : -1}
            totalCount={searchSourceCards.length}
            sortField={sortConfig.field}
            sortDirection={sortConfig.direction}
          />
        </div>

      {:else}
        <!-- ============================================
             完整模式：展开所有功能
             ============================================ -->
        
        <!-- 数据源切换按钮组 -->
      <div class="btn-group data-source-toggle">
        <EnhancedButton
          variant={dataSource === "memory" ? "primary" : "secondary"}
          size="sm"
          onclick={() => switchDataSource("memory")}
          tooltip="记忆牌组"
        >
          <EnhancedIcon name="graduation-cap" size={16} />
        </EnhancedButton>
        <EnhancedButton
          variant={dataSource === "questionBank" ? "primary" : "secondary"}
          size="sm"
          onclick={() => switchDataSource("questionBank")}
          tooltip="考试牌组"
        >
          <EnhancedIcon name="clipboard-list" size={16} />
        </EnhancedButton>
        <EnhancedButton
          variant={dataSource === "incremental-reading" ? "primary" : "secondary"}
          size="sm"
          onclick={() => switchDataSource("incremental-reading")}
          tooltip="增量阅读"
        >
          <EnhancedIcon name="bookmark" size={16} />
        </EnhancedButton>
      </div>
      
      <!-- 动态布局模式切换器 -->
      {#if currentView === "table"}
        <!-- 表格视图模式切换器 -->
        <div class="btn-group layout-mode-toggle">
          {#if dataSource === 'memory'}
            <!-- 记忆牌组数据源：显示基础信息和复习历史模式 -->
            <EnhancedButton
              variant={tableViewMode === "basic" ? "primary" : "secondary"}
              size="sm"
              onclick={() => handleTableViewModeChange("basic")}
              tooltip="基础信息模式"
            >
              <EnhancedIcon name="table" size={16} />
            </EnhancedButton>
            <EnhancedButton
              variant={tableViewMode === "review" ? "primary" : "secondary"}
              size="sm"
              onclick={() => handleTableViewModeChange("review")}
              tooltip="复习历史模式"
            >
              <EnhancedIcon name="bar-chart-2" size={16} />
            </EnhancedButton>
          {:else if dataSource === 'incremental-reading'}
            <!-- 增量阅读数据源：MD/PDF类型筛选（点击已选中项取消筛选） -->
            <EnhancedButton
              variant={irTypeFilter === "md" ? "primary" : "secondary"}
              size="sm"
              onclick={() => { irTypeFilter = irTypeFilter === 'md' ? 'all' : 'md'; }}
              tooltip="MD文件"
            >
              <EnhancedIcon name="file-text" size={16} />
            </EnhancedButton>
            <EnhancedButton
              variant={irTypeFilter === "pdf" ? "primary" : "secondary"}
              size="sm"
              onclick={() => { irTypeFilter = irTypeFilter === 'pdf' ? 'all' : 'pdf'; }}
              tooltip="PDF书签"
            >
              <EnhancedIcon name="file" size={16} />
            </EnhancedButton>
          {/if}
        </div>
      {:else if currentView === "grid"}
          <div class="btn-group layout-mode-toggle">
          <EnhancedButton
            variant={gridLayout === "fixed" ? "primary" : "secondary"}
            size="sm"
            onclick={() => handleLayoutModeChange("fixed")}
            tooltip="固定高度"
          >
              <EnhancedIcon name="th" size={16} />
          </EnhancedButton>
          <EnhancedButton
            variant={gridLayout === "masonry" ? "primary" : "secondary"}
            size="sm"
            onclick={() => handleLayoutModeChange("masonry")}
            tooltip="瀑布流"
          >
              <EnhancedIcon name="th-large" size={16} />
          </EnhancedButton>
        </div>
      {:else if currentView === "kanban"}
          <div class="btn-group layout-mode-toggle">
          <EnhancedButton
            variant={kanbanLayoutMode === "compact" ? "primary" : "secondary"}
            size="sm"
            onclick={() => handleKanbanLayoutModeChange("compact")}
            tooltip="紧凑布局"
          >
              <EnhancedIcon name="compress" size={16} />
          </EnhancedButton>
          <EnhancedButton
            variant={kanbanLayoutMode === "comfortable" ? "primary" : "secondary"}
            size="sm"
            onclick={() => handleKanbanLayoutModeChange("comfortable")}
            tooltip="舒适布局"
          >
            <EnhancedIcon name="square" size={16} />
          </EnhancedButton>
          <EnhancedButton
            variant={kanbanLayoutMode === "spacious" ? "primary" : "secondary"}
            size="sm"
            onclick={() => handleKanbanLayoutModeChange("spacious")}
            tooltip="宽敞布局"
          >
              <EnhancedIcon name="expand" size={16} />
          </EnhancedButton>
        </div>
      {/if}

      <!-- 工具操作按钮组 -->
        <div class="btn-group utility-actions">
        <!-- 数据管理按钮（含质量扫描） -->
        <EnhancedButton
          variant="secondary"
          size="sm"
          onclick={() => showDataManagementModal = true}
          tooltip="数据管理与质量扫描"
        >
            <EnhancedIcon name="database" size={16} />
        </EnhancedButton>

          {#if currentView === 'table'}
          <EnhancedButton
            variant="secondary"
            size="sm"
              onclick={() => {
                logger.debug('[字段管理] 完整模式按钮点击，当前状态:', showColumnManager);
                showColumnManager = !showColumnManager;
                logger.debug('[字段管理] 新状态:', showColumnManager);
              }}
            tooltip="字段管理"
          >
              <EnhancedIcon name="columns" size={16} />
          </EnhancedButton>
          {:else if currentView === 'kanban'}
            <!-- 看板视图：显示列设置和属性选择两个按钮 -->
            <EnhancedButton
              variant="secondary"
              size="sm"
              onclick={() => {
                // 触发看板视图的列设置
                const kanbanView = document.querySelector('.weave-kanban-view');
                if (kanbanView) {
                  const columnButton = kanbanView.querySelector('[title="列设置"]') as HTMLButtonElement;
                  if (columnButton) {
                    columnButton.click();
                  }
                }
              }}
              tooltip="看板列设置"
            >
              <EnhancedIcon name="sliders" size={16} />
            </EnhancedButton>
            <div bind:this={gridAttributeButtonElement}>
              <EnhancedButton
                variant="secondary"
                size="sm"
                onclick={toggleGridAttributeMenu}
                tooltip={t('cardManagement.gridAttributeSelector.tooltip')}
              >
                <EnhancedIcon name="tag" size={16} />
              </EnhancedButton>
            </div>
          {:else if currentView === 'grid'}
            <!-- 网格视图：只显示属性选择按钮 -->
            <div bind:this={gridAttributeButtonElement}>
              <EnhancedButton
                variant="secondary"
                size="sm"
                onclick={toggleGridAttributeMenu}
                tooltip={t('cardManagement.gridAttributeSelector.tooltip')}
              >
                <EnhancedIcon name="tag" size={16} />
              </EnhancedButton>
            </div>
          {/if}
      
    </div>
        
        <!-- 新增卡片（完整按钮） -->
        <!-- 卡片搜索框（完整模式 - 移到右侧） -->
        <div class="header-right-actions">
          <div class="card-search-wrapper">
            <CardSearchInput
              bind:value={searchQuery}
              placeholder="搜索卡片..."
              onSearch={handleSearch}
              onClear={handleClearSearch}
              onSort={handleSort}
              app={plugin.app}
              dataSource={dataSource}
              availableDecks={searchAvailableDecks}
              availableTags={searchAvailableTags}
              availablePriorities={searchAvailablePriorities}
              availableQuestionTypes={searchAvailableQuestionTypes}
              availableSources={searchAvailableSources}
              availableStatuses={searchAvailableStatuses}
              availableStates={searchAvailableIRStates}
              availableAccuracies={searchAvailableAccuracies}
              availableAttemptThresholds={searchAvailableAttemptThresholds}
              availableErrorLevels={searchAvailableErrorLevels}
              availableSourceCards={searchAvailableSourceCards}
              availableYamlKeys={searchAvailableYamlKeys}
              matchCount={searchQuery ? totalFilteredItems : -1}
              totalCount={searchSourceCards.length}
              sortField={sortConfig.field}
              sortDirection={sortConfig.direction}
            />
          </div>

          <EnhancedButton
            variant="ghost"
            size="md"
            onclick={handleCreateCard}
          >
            <EnhancedIcon name="plus" size={16} />
            新增卡片
          </EnhancedButton>
        </div>
      {/if}
    </div>
    </header>

    <!-- 网格属性选择菜单 -->
    {#if showGridAttributeMenu}
    <FloatingMenu
      bind:show={showGridAttributeMenu}
      anchor={gridAttributeButtonElement}
      placement="bottom-start"
      offset={4}
      onClose={() => showGridAttributeMenu = false}
    >
      <div class="grid-attribute-menu">
        <div class="menu-section-title">{t('cardManagement.gridAttributeSelector.title')}</div>
        {#each GRID_ATTRIBUTES_BY_SOURCE[dataSource] as attr}
          <button 
            class="menu-item" 
            class:active={gridCardAttribute === attr} 
            onclick={() => setGridCardAttribute(attr)}
          >
            <EnhancedIcon name={gridCardAttribute === attr ? 'check-circle' : 'circle'} size={14} />
            <span>{t(`cardManagement.gridAttributeSelector.${attr}`)}</span>
          </button>
        {/each}
      </div>
    </FloatingMenu>
    {/if}


  <!-- 批量操作工具栏 -->
  <WeaveBatchToolbar
    selectedCount={selectedCards.size}
    visible={selectedCards.size > 0 && !modalActive}
    app={plugin.app}
    {dataSource}
    onBatchChangeDeck={dataSource === 'memory' ? handleBatchChangeDeck : undefined}
    onBatchTagsMenu={handleBatchTagsMenu}
    onBatchDelete={handleBatchDelete}
    onClearSelection={handleClearSelection}
    onBuildDeck={dataSource === 'memory' ? handleBuildDeck : undefined}
    onBuildIRDeck={dataSource === 'incremental-reading' ? handleBuildIRDeck : undefined}
    onIRChangeDeck={dataSource === 'incremental-reading' ? handleIRBatchChangeDeck : undefined}
    onIRToggleFavorite={dataSource === 'incremental-reading' ? handleIRBatchToggleFavorite : undefined}
    {isMobile}
  />

    <!-- 主体容器 -->
    <div class="content-container">
      <!-- 主内容区域 -->
      <main class="main-content">
        <!-- 文档筛选状态指示器 -->
        {#if documentFilterMode === 'current' && currentActiveDocument}
          <div class="filter-status-bar" class:mobile={isMobile}>
            <div class="status-content">
              <span class="doc-name">{getFileName(currentActiveDocument)}</span>
            </div>
            <button 
              class="clear-filter-btn"
              onclick={() => documentFilterMode = 'all'}
              title="显示全部"
              aria-label="显示全部"
            >
              <EnhancedIcon name="x" size={14} />
            </button>
          </div>
        {/if}
      
      <!-- 全局筛选清除按钮 - 移动端简化显示 -->
      {#if hasActiveGlobalFilters}
        <div class="filter-status-bar global-filters" class:mobile={isMobile}>
          <div class="status-content">
            {#if isMobile}
              <!-- 移动端：仅显示筛选图标和数量 -->
              <EnhancedIcon name="filter" size={14} />
              {#if customCardIdsFilter && customCardIdsFilter.size > 0}
                <span class="filter-count">{customCardIdsFilter.size}</span>
              {:else}
                {@const filterCount = (globalSelectedDeckId ? 1 : 0) + 
                  (globalSelectedCardTypes.size > 0 ? 1 : 0) + 
                  (globalSelectedPriority !== null ? 1 : 0) + 
                  (globalSelectedTags.size > 0 ? 1 : 0) + 
                  (globalSelectedTimeFilter ? 1 : 0)}
                <span class="filter-count">{filterCount}</span>
              {/if}
            {:else}
              <!-- 桌面端：显示详细筛选条件 -->
              {#if customCardIdsFilter && customCardIdsFilter.size > 0}
                <span class="filter-title">{customFilterName}</span>
              {:else}
                <span>已应用筛选条件</span>
              {/if}
              {#if globalSelectedDeckId}
                <span class="filter-badge">牌组</span>
              {/if}
              {#if globalSelectedCardTypes.size > 0}
                <span class="filter-badge">题型 ({globalSelectedCardTypes.size})</span>
              {/if}
              {#if globalSelectedPriority !== null}
                <span class="filter-badge">优先级</span>
              {/if}
              {#if globalSelectedTags.size > 0}
                <span class="filter-badge">标签 ({globalSelectedTags.size})</span>
              {/if}
              {#if globalSelectedTimeFilter}
                <span class="filter-badge">时间</span>
              {/if}
              {#if customCardIdsFilter && customCardIdsFilter.size > 0}
                <span class="filter-badge custom-id-filter">
                  <EnhancedIcon name="grid" size={12} />
                  {customCardIdsFilter.size} 张卡片
                </span>
              {/if}
            {/if}
          </div>
          <button 
            class="clear-filter-btn"
            onclick={clearGlobalFilters}
            title="清除所有筛选"
            aria-label="清除筛选"
          >
            <EnhancedIcon name="x" size={14} />
            {#if !isMobile}
              清除筛选
            {/if}
          </button>
          </div>
        {/if}
        
        {#if currentView === "table"}
        <div class="table-view-wrapper">
          <WeaveCardTable
            cards={transformedCards}
            {selectedCards}
            columnVisibility={columnVisibility}
            columnOrder={columnOrder}
            tableViewMode={tableViewMode}
            onCardSelect={(cardId, selected) => handleCardSelect(cardId, selected)}
            onSelectAll={handleSelectAll}
            onSort={(field) => handleSort(field)}
            onEdit={handleEditCard}
            onDelete={handleDeleteCard}
            onTagsUpdate={handleTagsUpdate}
            onPriorityUpdate={handlePriorityUpdate}
            onTempFileEdit={handleTempFileEditCard}
            onView={handleViewCard}
            onJumpToSource={jumpToSourceDocument}
            {sortConfig}
            {isSorting}
            loading={isLoading}
            fieldTemplates={[]}
            availableTags={availableTags.map(t => t.name)}
            {plugin}
            decks={dataSource === 'incremental-reading' 
              ? Object.values(irDecks).map(d => ({ id: d.id, name: d.name })) 
              : allDecks}
            isVisible={isViewVisible}
          />
          
          <!-- 排序加载遮罩 -->
          <TableSortingOverlay show={isSorting} />
        </div>
        <TablePagination
          {currentPage}
          totalItems={totalFilteredItems}
          {itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      {:else if currentView === "grid"}
        <!-- 网格视图 -->
        {#if gridLayout === "masonry"}
          <MasonryGridView
            cards={filteredAndSortedCards}
            {selectedCards}
            {plugin}
            attributeType={gridCardAttribute}
            {isMobile}
            onCardClick={handleGridCardClick}
            onCardEdit={handleGridCardEdit}
            onCardDelete={handleGridCardDelete}
            onCardView={handleGridCardView}
            onSourceJump={jumpToSourceDocument}
            onCardLongPress={handleGridCardLongPress}
            loading={isLoading}
          />
        {:else}
          <GridView
            cards={filteredAndSortedCards}
            {selectedCards}
            {plugin}
            layoutMode={gridLayout}
            attributeType={gridCardAttribute}
            {isMobile}
            onCardClick={handleGridCardClick}
            onCardEdit={handleGridCardEdit}
            onCardDelete={handleGridCardDelete}
            onCardView={handleGridCardView}
            onSourceJump={jumpToSourceDocument}
            onCardLongPress={handleGridCardLongPress}
            loading={isLoading}
          />
        {/if}
      {:else if currentView === "kanban"}
        <!-- 看板视图 -->
        <KanbanView
          cards={filteredAndSortedCards}
          {dataStorage}
          {plugin}
          decks={allDecks}
          {isMobile}
          onCardSelect={handleKanbanCardSelect}
          onCardUpdate={handleKanbanCardUpdate}
          onCardDelete={handleKanbanCardDelete}
          onCardView={handleViewCard}
          onStartStudy={handleKanbanStartStudy}
          groupBy={kanbanGroupBy}
          showStats={true}
          layoutMode={kanbanLayoutMode}
          attributeType={gridCardAttribute}
        />
      {/if}
      </main>
    </div>
  {/if}
</div>

  <!-- 编辑卡片模态窗 - 已改为全局方法，不再需要局部组件 -->

  <!-- 新建卡片模态窗已移除，等待重新实现 -->

  <!-- 批量更换模板功能已删除（基于弃用的字段模板系统） -->
  <!-- 批量更换牌组、删除标签、添加标签已改用 Obsidian Menu API -->

  <!-- v2.0 组建牌组模态窗 -->
  {#if showBuildDeckModal}
    <BuildDeckModal
      open={showBuildDeckModal}
      {plugin}
      selectedCardUUIDs={Array.from(selectedCards)}
      pairedMemoryDeckId={globalSelectedDeckId}
      onClose={() => showBuildDeckModal = false}
      onCreated={handleBuildDeckCreated}
    />
  {/if}

  <!-- v2.0 组建增量牌组模态窗 -->
  {#if showBuildIRDeckModal}
    <BuildIRDeckModal
      open={showBuildIRDeckModal}
      {plugin}
      selectedBlockIds={Array.from(selectedCards)}
      onClose={() => showBuildIRDeckModal = false}
      onCreated={handleBuildIRDeckCreated}
    />
  {/if}


  <!-- 查看卡片模态窗 - 改用全局方法 plugin.openViewCardModal() -->
  
  
  <!-- 字段管理器（全局，支持侧边栏和完整模式） -->
  {#if showColumnManager}
    <div 
      class="column-manager-overlay"
      role="dialog"
      aria-label="字段管理器"
      tabindex="-1"
      onclick={(e) => {
        // 点击遮罩层关闭
        if (e.target === e.currentTarget) {
          logger.debug('[字段管理] 点击遮罩层关闭');
          showColumnManager = false;
        }
      }}
      onkeydown={(e) => {
      }}
    >
      <div class="column-manager-wrapper">
        <ColumnManager
          visibility={columnVisibility}
          columnOrder={columnOrder}
          onVisibilityChange={handleVisibilityChange}
          onOrderChange={handleOrderChange}
        />
        <button 
          class="column-manager-close"
          onclick={() => {
            logger.debug('[字段管理] 点击关闭按钮');
            showColumnManager = false;
          }}
          aria-label="关闭"
        >
          <EnhancedIcon name="x" size={20} />
        </button>
      </div>
    </div>
  {/if}
  
  <!-- 高级功能激活提示 -->
  <ActivationPrompt
    featureId={promptFeatureId}
    visible={showActivationPrompt}
    onClose={handleActivationPromptClose}
  />
  
  <!-- v2.2 数据管理模态窗（含质量扫描标签页） -->
  <DataManagementModal
    bind:open={showDataManagementModal}
    onClose={() => {
      showDataManagementModal = false;
    }}
    {plugin}
    cards={filteredCards}
    allCards={cards}
    initialTab={dataManagementInitialTab}
  />

  <!-- 编辑卡片模态窗 - 已改为全局方法，不再需要局部组件 -->

<!-- 新建卡片模态窗已移除，等待重新实现 -->

<!-- 批量更换模板功能已删除（基于弃用的字段模板系统） -->
<!-- 批量更换牌组、删除标签、添加标签已改用 Obsidian Menu API -->

<style>
  .weave-card-management-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    overflow: hidden;
    position: relative;
    height: 100%;
    min-height: 0;
  }

  /* 桌面端彩色圆点视图切换栏样式已移除 - 现在由 WeaveApp 中的 SidebarNavHeader 统一处理 */

  /* 初始加载覆盖层（相对于父容器 .weave-card-management-page） */
  .initial-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--background-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
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

  /* ============================================
     🆕 响应式工具栏样式
     ============================================ */

  .page-header {
    position: sticky;
    top: 0;
    z-index: var(--weave-z-float);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 16px;
    background: var(--background-primary);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .page-header.modal-active {
    z-index: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    flex-wrap: nowrap;
    transition: gap 0.3s ease;
  }

  /* 侧边栏模式：紧凑间距 */
  .header-actions.sidebar-mode {
    gap: 8px;
  }

  .header-right-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
    flex-shrink: 0;
  }

  /* ============================================
     按钮组样式
     ============================================ */

  .btn-group {
    display: inline-flex;
    border-radius: 8px;
    overflow: visible;
    background: transparent;
    flex-shrink: 0;
  }

  .btn-group :global(.weave-btn) {
    border-radius: 4px;
    border: none;
    background: transparent;
    box-shadow: none;
    position: relative;
  }

  .btn-group :global(.weave-btn:hover) {
    background: var(--background-modifier-hover);
  }

  .btn-group :global(.weave-btn:last-child) {
    border-right: none;
  }

  .btn-group :global(.weave-btn--primary) {
    background: transparent;
    color: var(--text-accent);
    border-color: transparent;
  }

  .btn-group :global(.weave-btn--primary::after) {
    content: '';
    position: absolute;
    bottom: 1px;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
    opacity: 1;
    transition: width 0.2s ease, opacity 0.2s ease;
  }

  .btn-group :global(.weave-btn--primary:hover) {
    background: var(--background-modifier-hover);
  }

  /* ============================================
     特定按钮组样式
     ============================================ */

  .data-source-toggle,
  .layout-mode-toggle {
    flex-shrink: 0;
  }

  .utility-actions {
    flex-shrink: 0;
    position: relative;
  }
  
  

  /* ============================================
     工具栏按钮（统一样式）
     ============================================ */

  .toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: none;
    outline: none;
  }

  .toolbar-button:hover:not(.disabled) {
    background: var(--background-modifier-hover);
  }

  .toolbar-button:active:not(.disabled) {
    transform: scale(0.95);
  }

  .toolbar-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .toolbar-button.active {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  /* ============================================
     更多菜单容器
     ============================================ */

  .more-menu-container {
    display: inline-flex;
    align-items: center;
  }

  .more-menu-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease;
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    padding: 0;
    margin: 0;
  }

  .more-menu-button:hover {
    background: var(--background-modifier-hover);
  }

  .more-menu-button:active {
    transform: scale(0.95);
  }



  /* ============================================
     搜索框样式（完整模式）
     ============================================ */

  /* 🆕 卡片搜索包装器 */
  .card-search-wrapper {
    flex: 0 1 auto;
    min-width: 280px;
    max-width: 400px;
  }

  /* 字段管理器遮罩层 */
  .column-manager-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
    animation: fadeIn 0.2s ease-out;
  }

  /* ============================================
     动画效果
     ============================================ */

  .header-actions > :global(*) {
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeInUp {
    from { 
      opacity: 0; 
      transform: translateY(4px);
    }
    to { 
      opacity: 1; 
      transform: translateY(0);
    }
  }

  /* ============================================
     响应式适配
     ============================================ */

  /* 侧边栏模式优化 */
  @media (max-width: 600px) {
    .page-header {
      padding: 6px 12px; /* 缩小上下间距 */
    }
    
    .header-actions {
      gap: 6px;
    }
    
    .btn-group {
      gap: 0;
    }
  }

  /* 中等屏幕隐藏按钮文字 - 如果想始终显示文字，注释掉这个块 */
  /* @media (max-width: 768px) {
    .btn-text {
      display: none;
    }
  } */

  /* 极窄屏幕 */
  @media (max-width: 400px) {
    .page-header {
      padding: 4px 8px; /* 缩小上下间距 */
    }
    
    .header-actions {
      gap: 4px;
    }
  }

  /* ============================================
     旧样式保留（向后兼容）
     ============================================ */

  /* 内容区域全高度布局 */
  .content-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .data-source-toggle,
  .layout-mode-toggle,
  .utility-actions {
    display: flex;
    gap: 0.25rem;
    padding: 0;
    background: transparent;
    border-radius: 0.5rem;
  }

  /* 字段管理器包装器 */
  .column-manager-wrapper {
    position: relative;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    overflow: auto;
    padding: 16px;
  }
  
  /* 移动端字段管理器适配 */
  @media (max-width: 600px) {
    .column-manager-wrapper {
      max-width: calc(100vw - 2rem);
      max-height: 80vh;
      margin: 1rem;
      border-radius: 12px;
    }
  }

  /* 字段管理器关闭按钮 */
  .column-manager-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    z-index: calc(var(--weave-z-overlay) + 1);
  }

  .column-manager-close:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .column-manager-close:active {
    transform: scale(0.95);
  }

  
  /* ========== 🆕 题库专用列样式 ========== */
  
  /* 正确率颜色样式 */
  :global(.accuracy-high) {
    color: #22c55e;
    font-weight: 600;
  }
  
  :global(.accuracy-medium) {
    color: #f59e0b;
    font-weight: 600;
  }
  
  :global(.accuracy-low) {
    color: #ef4444;
    font-weight: 600;
  }

  /* 调整表格容器的边框半径 */
  :global(.weave-table-container) {
    border-radius: 0 0 var(--radius-m) var(--radius-m) !important;
    border-top: none !important;
  }

  /* ========== 🆕 文档筛选功能样式 ========== */

  /* 文档筛选控制 */
  /* 筛选状态栏 - 无底色差异 */
  .filter-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: transparent;
    font-size: var(--weave-font-size-sm);
    color: var(--weave-text-secondary);
  }

  /* 移动端筛选状态栏 - 更紧凑 */
  .filter-status-bar.mobile {
    padding: 6px 12px;
    gap: 8px;
  }

  .status-content {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .doc-name {
    color: var(--weave-accent-color);
    font-weight: 500;
    font-size: 13px;
  }

  /* 移动端筛选数量显示 */
  .filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
  }

  .clear-filter-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: var(--weave-radius-sm);
    color: var(--weave-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: var(--weave-font-size-xs);
  }

  .clear-filter-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--weave-text-primary);
  }

  .clear-filter-btn:active {
    background: var(--background-modifier-active-hover);
  }

  /* 移动端清除按钮 - 仅图标 */
  .filter-status-bar.mobile .clear-filter-btn {
    padding: 6px;
    border-radius: 50%;
  }
  
  /* 筛选标记 */
  .filter-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  /* 🆕 自定义ID筛选徽章 */
  .filter-badge.custom-id-filter {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    font-weight: 600;
  }

  /* 🆕 筛选标题（用于自定义筛选） */
  .filter-title {
    font-weight: 600;
    color: var(--interactive-accent);
  }

  /* @deprecated 当前模式指示器已移除 */
  
  .filter-status-bar.global-filters {
    background: transparent;
  }

  /* 响应式调整 */
  @media (max-width: 768px) {
    .filter-status-bar:not(.mobile) {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--weave-space-xs);
    }
  }

  /* ============================================
     表格视图容器（用于排序遮罩）
     ============================================ */
  .table-view-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* ============================================
     🆕 移动端样式
     ============================================ */
  
  /* 移动端隐藏桌面端头部 */
  :global(body.is-mobile) .page-header.hide-on-mobile {
    display: none !important;
  }

  /* 移动端搜索容器 */
  .mobile-search-container {
    display: none;
  }

  :global(body.is-mobile) .mobile-search-container {
    display: block;
    padding: 8px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  /* 移动端内容区域底部间距 */
  :global(body.is-mobile) .weave-card-management-page .content-container {
    padding-bottom: var(--weave-mobile-content-bottom-padding, 60px);
  }

</style>

