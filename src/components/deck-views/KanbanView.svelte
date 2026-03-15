<script lang="ts">
  import { logger } from '../../utils/logger';
  import { vaultStorage } from '../../utils/vault-local-storage';

  import { onMount, tick } from 'svelte';
  import { Menu, Notice } from 'obsidian';
  import type { Deck, Card } from '../../data/types';
  import type { DeckTreeNode } from '../../services/deck/DeckHierarchyService';
  import type { WeaveDataStorage } from '../../data/storage';
  import type AnkiObsidianPlugin from '../../main';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import ObsidianDropdown from '../ui/ObsidianDropdown.svelte';
  import DeckGridCard from './DeckGridCard.svelte';
  import ChineseElegantDeckCard from './ChineseElegantDeckCard.svelte';
  import type { DeckCardStyle } from '../../types/plugin-settings.d';
  import { getColorSchemeForDeck } from '../../config/card-color-schemes';
  
  // 导入牌组聚合服务和类型
  import { DeckAggregationService } from '../../services/deck/DeckAggregationService';
  import type { DeckGroupByType, DeckTagGroup } from '../../types/deck-kanban-types';
  import { DECK_GROUP_CONFIGS, DECK_GROUP_BY_LABELS } from '../../types/deck-kanban-types';
  import { getAdvanceStudyCards } from '../../utils/study/studyCompletionHelper';
  import { tr } from '../../utils/i18n';
import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  
  // 导入快速标签组创建器
  import QuickTagGroupCreator from './QuickTagGroupCreator.svelte';
  
  interface DeckStats {
    newCards: number;
    learningCards: number;
    reviewCards: number;
    memoryRate: number;
  }
  
  interface Props {
    deckTree: DeckTreeNode[];
    deckStats: Record<string, DeckStats>;
    dataStorage: WeaveDataStorage;
    plugin?: AnkiObsidianPlugin;
    groupBy?: DeckGroupByType;
    deckMode?: 'memory' | 'question-bank' | 'incremental-reading';
    onStartStudy: (deckId: string) => void;
    onDeckUpdate?: () => void; //  牌组更新回调
    onOpenDeckAnalytics?: (deckId: string) => void;
    onOpenLoadForecast?: (deckId: string) => void;
    onEditDeck?: (deckId: string) => void;
    onDeleteDeck?: (deckId: string) => void;
    // 🆕 v2.0 引用式牌组系统
    onDissolveDeck?: (deckId: string) => void;
  }

  //  响应式翻译函数
  let t = $derived($tr);
  
  let { 
    deckTree, 
    deckStats, 
    dataStorage,
    plugin,
    groupBy: initialGroupBy = 'completion',
    deckMode = 'memory',
    onStartStudy,
    onDeckUpdate,
    onOpenDeckAnalytics,
    onOpenLoadForecast,
    onEditDeck,
    onDeleteDeck,
    // 🆕 v2.0 引用式牌组系统
    onDissolveDeck
  }: Props = $props();
  
  // 状态管理
  let groupBy = $state<DeckGroupByType>(initialGroupBy);
  let groupedDecks = $state<Record<string, Deck[]>>({});
  let isLoading = $state(false);
  let aggregationService: DeckAggregationService;
  
  // 🆕 标签组分组相关状态
  let selectedTagGroupId = $state<string | null>(null);
  let showQuickCreator = $state(false);
  let editingTagGroup = $state<DeckTagGroup | undefined>(undefined); // 🆕 编辑中的标签组
  
  // 看板配置状态
  let showKanbanMenu = $state(false);
  let menuView = $state<'main' | 'groupby'>('main');
  let menuButtonRef = $state<HTMLElement | null>(null);
  let menuRef = $state<HTMLElement | null>(null);
  let menuPosition = $state({ top: 0, right: 0 });
  
  // 列可见性配置
  interface ColumnConfig {
    hidden: string[];             // 隐藏的列
    pinned: string[];             // 固定的列  
    order: string[];              // 列顺序
    hideEmptyGroups: boolean;     // 隐藏空白分组
  }
  
  let columnConfig = $state<ColumnConfig>({
    hidden: [],
    pinned: [],
    order: [],
    hideEmptyGroups: false
  });
  
  // 拖拽状态
  let dragSource = $state<string | null>(null);
  let dragTarget = $state<string | null>(null);
  
  // 拖拽状态管理
  let draggedDeck = $state<Deck | null>(null);
  let dragOverColumn = $state<string | null>(null);
  
  // 获取当前牌组卡片设计样式
  const deckCardStyle = $derived<DeckCardStyle>(
    (plugin?.settings?.deckCardStyle as DeckCardStyle) || 'default'
  );

  //  初始化聚合服务，传入实时统计数据
  aggregationService = new DeckAggregationService(dataStorage, deckStats);
  
  //  监听 deckStats 变化，动态更新服务
  $effect(() => {
    aggregationService.updateDeckStats(deckStats);
  });
  
  // 将牌组树扁平化为列表
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
  
  // 🆕 获取选定的标签组
  const selectedTagGroup = $derived((() => {
    if (groupBy === 'tagGroup' && selectedTagGroupId && plugin?.settings.deckTagGroups) {
      return plugin.settings.deckTagGroups.find(tg => tg.id === selectedTagGroupId);
    }
    return null;
  })());
  
  // 获取当前分组配置（动态生成标签分组）
  const currentGroupConfig = $derived((() => {
    if (groupBy === 'tag') {
      // 动态生成标签分组列
      const tagSet = new Set<string>();
      allDecks.forEach(deck => {
        if (deck.tags && deck.tags.length > 0) {
          tagSet.add(deck.tags[0]); // 单选标签
        }
      });
      
      const tagColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
      const tagGroups = Array.from(tagSet).sort().map((tag, index) => ({
        key: tag,
        label: tag,
        color: tagColors[index % tagColors.length],
        icon: 'tag'
      }));
      
      // 添加"无标签"分组
      tagGroups.push({
        key: 'noTag',
        label: t('decks.kanban.noTag'),
        color: '#6b7280',
        icon: 'circle'
      });
      
      return {
        title: t('decks.kanban.tagGrouping'),
        icon: 'tag',
        groups: tagGroups
      };
    } else if (groupBy === 'tagGroup' && selectedTagGroup) {
      // 🆕 标签组分组
      const tagGroups = selectedTagGroup.tags.map((tag: string, index: number) => ({
        key: tag,
        label: tag,
        color: selectedTagGroup.color || '#3b82f6',
        icon: 'tag'
      }));
      
      // 添加"其他"分组
      tagGroups.push({
        key: '__other__',
        label: t('decks.kanban.other'),
        color: '#6b7280',
        icon: 'circle'
      });
      
      return {
        title: t('decks.kanban.tagGroupPrefix', { name: selectedTagGroup.name }),
        icon: selectedTagGroup.icon || 'tags',
        groups: tagGroups
      };
    }
    return DECK_GROUP_CONFIGS[groupBy];
  })());
  
  const currentGroupLabel = $derived(DECK_GROUP_BY_LABELS[groupBy]);
  
  // 获取有序的列配置（用于渲染）
  const orderedGroups = $derived((() => {
    const groups = currentGroupConfig.groups;
    
    // 如果有自定义顺序，应用排序
    if (columnConfig.order.length > 0) {
      const currentKeys = groups.map((g: any) => g.key);
      const validOrder = columnConfig.order.filter((key: string) => currentKeys.includes(key));
      const missingKeys = currentKeys.filter((key: string) => !validOrder.includes(key));
      const finalOrder = [...validOrder, ...missingKeys];
      
      // 按照顺序重新排列分组
      return finalOrder.map((key: string) => groups.find((g: any) => g.key === key)).filter((g: any) => g !== undefined)
        .filter((group: any) => {
          // 应用隐藏和空白过滤
          const isHidden = columnConfig.hidden.includes(group.key);
          const isEmpty = (groupedDecks[group.key] || []).length === 0;
          return !isHidden && (!columnConfig.hideEmptyGroups || !isEmpty);
        });
    }
    
    return groups.filter((group: any) => {
      const isHidden = columnConfig.hidden.includes(group.key);
      const isEmpty = (groupedDecks[group.key] || []).length === 0;
      return !isHidden && (!columnConfig.hideEmptyGroups || !isEmpty);
    });
  })());
  
  // 动态分组逻辑
  $effect(() => {
    async function updateGrouping() {
      isLoading = true;
      try {
        // 🆕 如果是tagGroup分组，传入selectedTagGroup
        if (groupBy === 'tagGroup') {
          groupedDecks = await aggregationService.groupDecks(allDecks, groupBy, selectedTagGroup || undefined);
        } else {
          groupedDecks = await aggregationService.groupDecks(allDecks, groupBy);
        }
      } catch (error) {
        logger.error('Error grouping decks:', error);
        groupedDecks = {};
      } finally {
        isLoading = false;
      }
    }
    
    updateGrouping();
  });
  
  // 从 localStorage 加载配置
  onMount(() => {
    // 加载分组方式
    const saved = vaultStorage.getItem('weave-deck-kanban-groupby');
    const validTypes = deckMode === 'memory'
      ? ['completion', 'timeRange', 'priority', 'tag', 'tagGroup']
      : ['tag', 'tagGroup'];
    if (saved && validTypes.includes(saved)) {
      groupBy = saved as DeckGroupByType;
    } else if (deckMode !== 'memory') {
      groupBy = 'tag';
    }
    
    // 🆕 加载选定的标签组
    const savedTagGroupId = vaultStorage.getItem('weave-selected-tag-group');
    if (savedTagGroupId) {
      selectedTagGroupId = savedTagGroupId;
    }
    
    // 加载列配置
    const savedColumnConfig = vaultStorage.getItem('weave-deck-kanban-columns');
    if (savedColumnConfig) {
      try {
        const config = JSON.parse(savedColumnConfig);
        columnConfig = {
          hidden: config.hidden || [],
          pinned: config.pinned || [],
          order: config.order || [],
          hideEmptyGroups: config.hideEmptyGroups || false
        };
      } catch (e) {
        logger.error('Failed to parse column config:', e);
      }
    }
    
    // 🆕 监听移动端头部按钮的菜单打开事件
    const handleOpenKanbanMenu = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (detail) {
        openKanbanMenuAtPosition(detail.x, detail.y);
      }
    };
    window.addEventListener('Weave:open-deck-kanban-menu', handleOpenKanbanMenu);
    
    return () => {
      window.removeEventListener('Weave:open-deck-kanban-menu', handleOpenKanbanMenu);
    };
  });
  
  // 保存配置
  function saveColumnConfig() {
    // 直接保存，无需转换
    vaultStorage.setItem('weave-deck-kanban-columns', JSON.stringify(columnConfig));
  }
  
  // 菜单管理功能
  function openKanbanMenu(event: MouseEvent) {
    event.preventDefault();
    
    // 如果菜单已经显示，关闭它
    if (showKanbanMenu) {
      closeKanbanMenu();
      return;
    }
    
    // 计算菜单位置
    if (menuButtonRef) {
      const rect = menuButtonRef.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // 计算位置（相对于视口）
      let top = rect.bottom + 4;
      let right = viewportWidth - rect.right;
      
      // 防止菜单超出视口
      if (top + 400 > viewportHeight) {
        top = rect.top - 400 - 4;
      }
      if (right + 280 > viewportWidth) {
        right = viewportWidth - rect.left - 280;
      }
      
      menuPosition = { top, right };
    }
    
    // 初始化列顺序（如果没有配置）
    if (columnConfig.order.length === 0) {
      const columnKeys = Object.keys(groupedDecks);
      if (columnKeys.length > 0) {
        columnConfig.order = columnKeys;
        saveColumnConfig();
      }
    }
    
    showKanbanMenu = true;
  }
  
  // 🆕 通过事件打开菜单（由移动端头部按钮触发）
  function openKanbanMenuAtPosition(x: number, y: number) {
    if (showKanbanMenu) {
      closeKanbanMenu();
      return;
    }
    
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let top = y + 4;
    let right = viewportWidth - x;
    
    if (top + 400 > viewportHeight) {
      top = y - 400 - 4;
    }
    if (right + 280 > viewportWidth) {
      right = 10;
    }
    
    menuPosition = { top, right };
    
    if (columnConfig.order.length === 0) {
      const columnKeys = Object.keys(groupedDecks);
      if (columnKeys.length > 0) {
        columnConfig.order = columnKeys;
        saveColumnConfig();
      }
    }
    
    showKanbanMenu = true;
  }
  
  // 处理overlay点击：仅当点击的是overlay自身时才关闭
  function handleOverlayClick(e: MouseEvent) {
    // 只有点击的是overlay自身（不是子元素）时才关闭
    if (e.target === e.currentTarget) {
      closeKanbanMenu();
    }
  }
  
  function closeKanbanMenu() {
    showKanbanMenu = false;
    menuView = 'main';
  }
  
  function navigateBack() {
    menuView = 'main';
  }
  
  // 🆕 使用 Obsidian Menu API 打开分组方式选择菜单
  function openGroupByMenu(event: MouseEvent) {
    const menu = new Menu();
    
    const groupTypes: DeckGroupByType[] = deckMode === 'memory'
      ? ['completion', 'timeRange', 'priority', 'tag', 'tagGroup']
      : ['tag', 'tagGroup'];
    
    for (const type of groupTypes) {
      const config = DECK_GROUP_CONFIGS[type];
      menu.addItem((item) => {
        item
          .setTitle(config.title)
          .setIcon(config.icon)
          .setChecked(groupBy === type)
          .onClick(() => {
            handleGroupByChange(type);
          });
      });
    }
    
    menu.showAtMouseEvent(event);
  }
  
  // 分组方式切换
  async function handleGroupByChange(newGroupBy: string) {
    if (!['completion', 'timeRange', 'priority', 'tag', 'tagGroup'].includes(newGroupBy)) {
      return;
    }
    
    groupBy = newGroupBy as DeckGroupByType;
    vaultStorage.setItem('weave-deck-kanban-groupby', newGroupBy);
    
    // 等待分组更新完成
    await tick();
    
    // 现在可以安全地访问 groupedDecks
    const newKeys = Object.keys(groupedDecks);
    columnConfig.order = newKeys;
    columnConfig.hidden = [];
    saveColumnConfig();
    
    //  短暂延迟后返回主菜单，让用户看到选择效果
    setTimeout(() => {
      navigateBack();
    }, 200);
  }
  
  // 🆕 保存标签组（创建或更新）
  async function handleSaveTagGroup(tagGroup: DeckTagGroup) {
    if (!plugin) return;
    
    const tagGroups = plugin.settings.deckTagGroups || [];
    const existingIndex = tagGroups.findIndex(tg => tg.id === tagGroup.id);
    
    if (existingIndex !== -1) {
      // 更新现有标签组
      tagGroups[existingIndex] = tagGroup;
      new Notice(t('decks.kanban.tagGroupUpdated', { name: tagGroup.name }));
    } else {
      // 添加新标签组
      tagGroups.push(tagGroup);
      new Notice(t('decks.kanban.tagGroupCreated', { name: tagGroup.name }));
    }
    
    plugin.settings.deckTagGroups = tagGroups;
    await plugin.saveSettings();
    
    // 自动选择标签组
    selectedTagGroupId = tagGroup.id;
    vaultStorage.setItem('weave-selected-tag-group', tagGroup.id);
    
    // 关闭创建器并清除编辑状态
    showQuickCreator = false;
    editingTagGroup = undefined;
  }
  
  // 🆕 编辑标签组
  function handleEditTagGroup() {
    if (!plugin || !selectedTagGroupId) return;
    
    const tagGroup = plugin.settings.deckTagGroups?.find(tg => tg.id === selectedTagGroupId);
    if (!tagGroup) return;
    
    // 设置编辑状态并打开创建器
    editingTagGroup = tagGroup;
    showQuickCreator = true;
  }
  
  // 🆕 删除标签组
  async function handleDeleteTagGroup() {
    if (!plugin || !selectedTagGroupId) return;
    
    const tagGroup = plugin.settings.deckTagGroups?.find(tg => tg.id === selectedTagGroupId);
    if (!tagGroup) return;
    
    //  使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    const confirmed = await showObsidianConfirm(plugin!.app, t('decks.kanban.tagGroupDeleteConfirm', { name: tagGroup.name }), { title: t('decks.kanban.confirmDelete') });
    if (!confirmed) {
      return;
    }
    
    // 从设置中移除
    plugin.settings.deckTagGroups = plugin.settings.deckTagGroups?.filter(tg => tg.id !== selectedTagGroupId) || [];
    await plugin.saveSettings();
    
    // 清除选择
    selectedTagGroupId = null;
    vaultStorage.removeItem('weave-selected-tag-group');
    
    new Notice(t('decks.kanban.tagGroupDeleted', { name: tagGroup.name }));
  }
  
  // 列可见性切换
  function handleToggleVisibility(key: string) {
    if (columnConfig.hidden.includes(key)) {
      columnConfig.hidden = columnConfig.hidden.filter(k => k !== key);
    } else {
      columnConfig.hidden = [...columnConfig.hidden, key];
    }
    saveColumnConfig();
  }
  
  // 列固定切换
  function handleTogglePin(key: string) {
    if (columnConfig.pinned.includes(key)) {
      columnConfig.pinned = columnConfig.pinned.filter(k => k !== key);
    } else {
      columnConfig.pinned = [...columnConfig.pinned, key];
    }
    saveColumnConfig();
  }
  
  // 隐藏空白分组切换
  function handleToggleHideEmpty() {
    columnConfig.hideEmptyGroups = !columnConfig.hideEmptyGroups;
    saveColumnConfig();
  }
  
  
  // 全部显示
  function handleShowAll() {
    columnConfig.hidden = [];
    saveColumnConfig();
  }
  
  // 全部隐藏
  function handleHideAll() {
    const allKeys = Object.keys(groupedDecks);
    columnConfig.hidden = [...allKeys];
    saveColumnConfig();
  }

  // 列管理：切换显示/隐藏所有列
  function handleToggleAllVisibility() {
    if (isAllHidden) {
      handleShowAll();
    } else {
      handleHideAll();
    }
  }

  // 计算属性：判断是否所有列都被隐藏
  const isAllHidden = $derived.by(() => {
    const totalGroups = Object.keys(groupedDecks).length;
    const hiddenGroups = columnConfig.hidden.length;
    return hiddenGroups >= totalGroups;
  });

  // 计算属性：判断是否所有列都显示
  const isAllVisible = $derived.by(() => {
    return columnConfig.hidden.length === 0;
  });
  
  // 重置配置
  function handleReset() {
    columnConfig = {
      hidden: [],
      pinned: [],
      order: Object.keys(groupedDecks),
      hideEmptyGroups: false
    };
    saveColumnConfig();
  }
  
  // 拖拽功能
  function handleColumnDragStart(groupKey: string) {
    dragSource = groupKey;
  }
  
  function handleColumnDragOver(e: DragEvent, groupKey: string) {
    e.preventDefault();
    if (dragSource && dragSource !== groupKey) {
      dragTarget = groupKey;
    }
  }
  
  function handleColumnDrop(e: DragEvent, groupKey: string) {
    e.preventDefault();
    
    if (dragSource && dragSource !== groupKey) {
      // 获取当前显示的列顺序
      const visibleGroups = orderedGroups.map((g: any) => g.key);
      const sourceIndex = visibleGroups.indexOf(dragSource);
      const targetIndex = visibleGroups.indexOf(groupKey);
      
      if (sourceIndex !== -1 && targetIndex !== -1) {
        // 更新columnConfig.order中的顺序
        const newOrder = [...columnConfig.order];
        const sourcePos = newOrder.indexOf(dragSource);
        const targetPos = newOrder.indexOf(groupKey);
        
        if (sourcePos !== -1 && targetPos !== -1) {
          // 移除源项目
          newOrder.splice(sourcePos, 1);
          // 插入到目标位置
          const adjustedTargetPos = sourcePos < targetPos ? targetPos - 1 : targetPos;
          newOrder.splice(adjustedTargetPos, 0, dragSource);
          
          columnConfig.order = newOrder;
          saveColumnConfig();
        }
      }
    }
    
    dragSource = null;
    dragTarget = null;
  }
  
  function handleColumnDragEnd() {
    dragSource = null;
    dragTarget = null;
  }
  
  // 获取牌组统计数据（用于显示）
  function getDeckStats(deck: Deck): any {
    return deckStats[deck.id] || {
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      memoryRate: 0,
      totalCards: 0,
      todayNew: 0,
      todayReview: 0,
      todayTime: 0
    };
  }
  
  // 显示牌组菜单（根据 deckMode 显示不同菜单项）
  function showDeckMenu(event: MouseEvent, deckId: string) {
    event.preventDefault();
    const menu = new Menu();
    
    const deck = allDecks.find(d => d.id === deckId);
    if (!deck) return;
    
    if (deckMode === 'incremental-reading') {
      // === 增量阅读牌组菜单（与 IRDeckView 网格视图一致）===
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.startReading')).setIcon('play')
          .onClick(() => onStartStudy(deckId))
      );
      
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.advanceReading')).setIcon('fast-forward')
          .onClick(async () => {
            try {
              const { IRStorageAdapterV4 } = await import('../../services/incremental-reading/IRStorageAdapterV4');
              const storageAdapter = new IRStorageAdapterV4(plugin!.app);
              await storageAdapter.initialize();
              const allBlocksV4 = await storageAdapter.getBlocksByDeckV4Fast(deckId);
              if (allBlocksV4.length === 0) { new Notice(t('deckStudyPage.notices.noBlocks')); return; }
              const { IRStorageService } = await import('../../services/incremental-reading/IRStorageService');
              const irStorage = new IRStorageService(plugin!.app);
              await irStorage.initialize();
              const irDeck = await irStorage.getDeckById(deckId);
              const deckName = irDeck?.name || t('deckStudyPage.fallback.incrementalReading');
              await plugin!.openIRFocusView(deckId, allBlocksV4, deckName);
            } catch (e) {
              logger.error('[KanbanView] 提前阅读失败:', e);
              new Notice(t('decks.kanban.advanceReadingFailed'));
            }
          })
      );
      
      menu.addSeparator();
      
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.editDeck')).setIcon('edit-3')
          .onClick(() => onEditDeck?.(deckId))
      );
      
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.deckAnalytics')).setIcon('bar-chart-2')
          .onClick(() => onOpenLoadForecast?.(deckId))
      );
      
      menu.addSeparator();
      
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.dissolveDeck')).setIcon('unlink')
          .onClick(async () => {
            try {
              const { showObsidianConfirm } = await import('../../utils/obsidian-confirm');
              const confirmed = await showObsidianConfirm(plugin!.app, t('decks.kanban.dissolveConfirmIR'), { title: t('decks.kanban.dissolveDeck') });
              if (!confirmed) return;
              const { IRStorageService } = await import('../../services/incremental-reading/IRStorageService');
              const { IRDeckManager } = await import('../../services/incremental-reading/IRDeckManager');
              const irStorage = new IRStorageService(plugin!.app);
              await irStorage.initialize();
              const deckManager = new IRDeckManager(plugin!.app, irStorage, plugin!.settings?.incrementalReading?.importFolder);
              await deckManager.disbandDeck(deckId);
              onDeckUpdate?.();
              window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
              new Notice(t('decks.kanban.deckDissolved'));
            } catch (e) {
              logger.error('[KanbanView] 解散牌组失败:', e);
              new Notice(t('decks.kanban.dissolveFailed'));
            }
          })
      );
      
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.deleteDeck')).setIcon('trash-2').setWarning(true)
          .onClick(() => onDeleteDeck?.(deckId))
      );
    } else if (deckMode === 'question-bank') {
      // === 考试牌组菜单（与 QuestionBankGridView 网格视图一致）===
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.editDeck')).setIcon('edit-3')
          .onClick(() => onEditDeck?.(deckId))
      );
      
      menu.addItem((item) =>
        item.setTitle(t('decks.kanban.analytics')).setIcon('bar-chart-2')
          .onClick(async () => {
            try {
              if (!plugin?.questionBankService) { new Notice(t('decks.kanban.qbServiceNotInit')); return; }
              const bank = await plugin.questionBankService.getBankById(deckId);
              if (!bank) { new Notice(t('decks.kanban.qbNotFound')); return; }
              // 触发分析事件，由父组件处理
              window.dispatchEvent(new CustomEvent('Weave:open-qb-analytics', { detail: { bankId: deckId } }));
            } catch (e) {
              logger.error('[KanbanView] 题库分析失败:', e);
              new Notice(t('decks.kanban.openAnalyticsFailed'));
            }
          })
      );
      
      menu.addSeparator();
      
      menu.addItem((item) =>
        item.setTitle(t('decks.menu.delete')).setIcon('trash-2')
          .onClick(() => onDeleteDeck?.(deckId))
      );
    } else {
      // === 记忆牌组菜单 ===
      menu.addItem((item) =>
        item
          .setTitle(t('decks.menu.advanceStudy'))
          .setIcon("fast-forward")
          .onClick(async () => {
            try {
              const allCards = await dataStorage.getCardsByDeck(deck.id);
              const maxAdvanceDays = plugin?.settings.maxAdvanceDays || 7;
              const advanceCards = getAdvanceStudyCards(allCards, 20, maxAdvanceDays);
              
              if (advanceCards.length === 0) {
                new Notice(t('common.noAdvanceCards') || 'No cards to advance study');
                return;
              }
              
              new Notice(`${advanceCards.length} cards available for advance study`);
            } catch (error) {
              logger.error('Failed to get advance study cards:', error);
              new Notice('Failed to get card info');
            }
          })
      );
      
      menu.addItem((item) =>
        item
          .setTitle(t('decks.menu.deckAnalytics'))
          .setIcon("bar-chart-2")
          .onClick(() => onOpenDeckAnalytics?.(deckId))
      );
      
      menu.addSeparator();
      
      menu.addItem((item) =>
        item
          .setTitle(t('decks.menu.editDeck'))
          .setIcon("edit")
          .onClick(() => onEditDeck?.(deckId))
      );
      
      menu.addItem((item) =>
        item
          .setTitle(t('decks.menu.delete'))
          .setIcon("trash-2")
          .onClick(() => onDeleteDeck?.(deckId))
      );
      
      if (onDissolveDeck) {
        menu.addItem((item) =>
          item
            .setTitle(t('decks.kanban.dissolveDeck'))
            .setIcon("unlink")
            .onClick(() => onDissolveDeck?.(deckId))
        );
      }
    }
    
    menu.showAtMouseEvent(event);
  }
  
  // 判断是否可拖拽（根据分组方式决定）
  function isDraggable(): boolean {
    // 只有在优先级分组时才允许拖拽
    return groupBy === 'priority';
  }
  
  // 拖拽开始
  function handleDragStart(e: DragEvent, deck: Deck) {
    if (!isDraggable()) return;
    
    draggedDeck = deck;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-weave-deck', deck.id);
    }
  }
  
  // 拖拽结束
  function handleDragEnd() {
    draggedDeck = null;
    dragOverColumn = null;
  }
  
  // 拖拽经过列
  function handleDragOver(e: DragEvent, groupKey: string) {
    if (!draggedDeck) return;
    e.preventDefault();
    dragOverColumn = groupKey;
  }
  
  // 离开列
  function handleDragLeave() {
    dragOverColumn = null;
  }
  
  // 放下
  async function handleDrop(targetGroupKey: string) {
    if (!draggedDeck || !isDraggable()) return;
    
    try {
      // 获取当前牌组的分组key
      const sourceGroupKey = getCurrentGroupKey(draggedDeck);
      
      // 如果拖到同一列，不做处理
      if (sourceGroupKey === targetGroupKey) {
        handleDragEnd();
        return;
      }
      
      // 更新牌组优先级（通过metadata存储）
      const updatedDeck: Deck = {
        ...draggedDeck,
        metadata: {
          ...draggedDeck.metadata,
          priority: targetGroupKey
        },
        modified: new Date().toISOString()
      };
      
      // 保存到数据库
      await dataStorage.saveDeck(updatedDeck);
      
      // 触发父组件刷新数据
      if (onDeckUpdate) {
        onDeckUpdate();
      } else {
        // 如果没有回调，本地重新加载分组
        groupedDecks = await aggregationService.groupDecks(allDecks, groupBy);
      }
      
      logger.debug(`[KanbanView] 牌组 ${draggedDeck.name} 优先级已更新为 ${targetGroupKey}`);
    } catch (error) {
      logger.error('[KanbanView] 更新牌组优先级失败:', error);
    } finally {
      handleDragEnd();
    }
  }
  
  // 获取牌组当前所在的分组key
  function getCurrentGroupKey(deck: Deck): string {
    for (const [key, decks] of Object.entries(groupedDecks)) {
      if (decks.some(d => d.id === deck.id)) {
        return key;
      }
    }
    return '';
  }
</script>

<div class="kanban-view">
  <!-- 🆕 桌面端工具栏（移动端已移至头部） -->
  <!-- 加载状态 -->
  {#if isLoading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>{t('decks.kanban.grouping')}</span>
    </div>
  {:else}
    <!-- 看板列 -->
    <div class="kanban-columns">
      {#each orderedGroups as group (group?.key || '')}
        {#if group}
          {@const decks = groupedDecks[group.key] || []}
          <div 
            class="kanban-column" 
            class:drag-over={dragOverColumn === group.key}
            style="--column-color: {group.color}"
            role="region"
            aria-label={t('decks.kanban.groupLabel', { label: group.label })}
            ondragover={(e) => handleDragOver(e, group.key)}
            ondragleave={handleDragLeave}
            ondrop={() => handleDrop(group.key)}
          >
            <div class="column-header">
              <div class="header-content">
                <span class="header-icon">
                  <EnhancedIcon name={group.icon} size={16} color={group.color} />
                </span>
                <h3 class="header-title">{group.label}</h3>
              </div>
              <span class="count-badge">{decks.length}</span>
            </div>
            
            <div class="column-content">
              {#if decks.length === 0}
                <div class="empty-message">
                  <EnhancedIcon name="inbox" size={24} />
                  <span>{t('decks.kanban.emptyColumn')}</span>
                </div>
              {:else}
                {#each decks as deck (deck.id)}
                  {@const stats = getDeckStats(deck)}
                  {@const colorScheme = getColorSchemeForDeck(deck.id)}
                  {@const colorVariant = ((decks.indexOf(deck) % 4) + 1) as 1 | 2 | 3 | 4}
                  <div 
                    class="kanban-card-wrapper"
                    class:dragging={draggedDeck?.id === deck.id}
                    class:draggable={isDraggable()}
                    role="button"
                    tabindex="0"
                    draggable={isDraggable()}
                    ondragstart={(e) => handleDragStart(e, deck)}
                    ondragend={handleDragEnd}
                  >
                    {#if deckCardStyle === 'chinese-elegant'}
                      <ChineseElegantDeckCard
                        {deck}
                        stats={stats}
                        {colorVariant}
                        {deckMode}
                        onStudy={() => onStartStudy(deck.id)}
                        onMenu={(e) => showDeckMenu(e, deck.id)}
                      />
                    {:else}
                      <DeckGridCard
                        {deck}
                        stats={stats}
                        colorScheme={colorScheme}
                        {deckMode}
                        onStudy={() => onStartStudy(deck.id)}
                        onMenu={(e) => showDeckMenu(e, deck.id)}
                      />
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- 看板设置菜单 -->
{#if showKanbanMenu}
  <div 
    class="weave-column-menu-overlay"
    role="presentation"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
    }}
  >
    <div 
      bind:this={menuRef}
      class="weave-column-menu kanban-dropdown-menu" 
      style="position: fixed; top: {menuPosition.top}px; right: {menuPosition.right}px;"
      role="dialog"
      aria-label={t('decks.kanban.kanbanSettings')}
      tabindex="-1"
    >
      {#if menuView === 'main'}
        <!-- 主菜单 -->
        <div class="notion-menu-header">
          <div class="notion-menu-title">
            <EnhancedIcon name="sliders" size={14} />
            <span>{t('decks.kanban.viewOptions')}</span>
          </div>
          <button class="notion-close-btn" onclick={closeKanbanMenu}>
            <EnhancedIcon name="x" size={14} />
          </button>
        </div>
        
        <!-- 分组方式选择器（使用 Obsidian Menu API） -->
        <div 
          class="notion-menu-row notion-menu-row--clickable" 
          role="button"
          tabindex="0"
          onclick={openGroupByMenu}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openGroupByMenu(e as unknown as MouseEvent);
            }
          }}
        >
          <span class="notion-menu-label">{t('decks.kanban.groupByLabel')}</span>
          <div class="notion-menu-value">
            <span>{DECK_GROUP_BY_LABELS[groupBy]}</span>
            <EnhancedIcon name="chevron-right" size={12} />
          </div>
        </div>
        
        <!-- 🆕 标签组选择器（仅在标签组分组模式下显示） -->
        {#if groupBy === 'tagGroup' && plugin}
          <div class="tag-group-selector-inline">
            {#if plugin.settings.deckTagGroups && plugin.settings.deckTagGroups.length > 0}
              <div class="notion-menu-row">
                <span class="notion-menu-label">{t('decks.kanban.tagGroup')}</span>
                <div>
                  <ObsidianDropdown
                    className="tag-group-select-mini"
                    options={[
                      { id: '', label: t('decks.kanban.selectPlaceholder') },
                      ...plugin.settings.deckTagGroups.map((tg) => ({
                        id: tg.id,
                        label: `${tg.icon || '📦'} ${tg.name}`
                      }))
                    ]}
                    value={selectedTagGroupId || ''}
                    onchange={(value) => {
                      selectedTagGroupId = value ? value : null;
                      if (selectedTagGroupId) {
                        vaultStorage.setItem('weave-selected-tag-group', selectedTagGroupId);
                      }
                    }}
                  />
                </div>
              </div>
              <div class="tag-group-actions-mini">
                <button class="notion-icon-btn" onclick={() => { editingTagGroup = undefined; showQuickCreator = true; }} title={t('decks.kanban.newTagGroup')}>
                  <EnhancedIcon name="plus" size={12} />
                </button>
                {#if selectedTagGroupId}
                  <button class="notion-icon-btn" onclick={handleEditTagGroup} title={t('decks.kanban.editTagGroup')}>
                    <EnhancedIcon name="edit" size={12} />
                  </button>
                  <button class="notion-icon-btn danger" onclick={handleDeleteTagGroup} title={t('decks.kanban.deleteTagGroup')}>
                    <EnhancedIcon name="trash-2" size={12} />
                  </button>
                {/if}
              </div>
            {:else}
              <div class="notion-menu-row">
                <span class="notion-menu-label">{t('decks.kanban.tagGroup')}</span>
                <button class="notion-text-btn" onclick={() => showQuickCreator = true}>
                  <EnhancedIcon name="plus" size={12} />
                  <span>{t('decks.kanban.createNew')}</span>
                </button>
              </div>
            {/if}
          </div>
        {/if}
        
        <div class="notion-divider"></div>
        
        <!-- 配置选项 -->
        <div class="notion-menu-row">
          <span class="notion-menu-label">{t('decks.kanban.hideEmptyGroups')}</span>
          <div 
            class="notion-toggle-mini {columnConfig.hideEmptyGroups ? 'active' : ''}"
            role="switch"
            tabindex="0"
            aria-checked={columnConfig.hideEmptyGroups}
            onclick={handleToggleHideEmpty}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleHideEmpty();
              }
            }}
          >
            <div class="notion-toggle-thumb"></div>
          </div>
        </div>
        
        
        <!-- 群组标题 -->
        <div class="notion-section-header">
          <span class="notion-section-title">{t('decks.kanban.groups')}</span>
          <div class="notion-action-group">
            <span 
              class="notion-section-action" 
              role="button"
              tabindex="0"
              onclick={handleReset}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleReset();
                }
              }}
            >{t('decks.kanban.reset')}</span>
            <span class="notion-separator">·</span>
            <span 
              class="notion-section-action" 
              role="button"
              tabindex="0"
              onclick={handleToggleAllVisibility}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleAllVisibility();
                }
              }}
              title={isAllHidden ? t('decks.kanban.showAll') : t('decks.kanban.hideAll')}
            >{isAllHidden ? t('decks.kanban.showAllBtn') : t('decks.kanban.hideAllBtn')}</span>
          </div>
        </div>
        
        <!-- 群组列表 -->
        <div class="notion-menu-content">
          {#each currentGroupConfig.groups as group (group.key)}
            {@const isHidden = columnConfig.hidden.includes(group.key)}
            {@const isPinned = columnConfig.pinned.includes(group.key)}
            
            <div class="notion-group-item"
                 class:dragging={dragSource === group.key}
                 class:drag-over={dragTarget === group.key}
                 draggable="true"
                 role="button"
                 tabindex="0"
                 ondragstart={() => handleColumnDragStart(group.key)}
                 ondragover={(e) => handleColumnDragOver(e, group.key)}
                 ondrop={(e) => handleColumnDrop(e, group.key)}
                 ondragend={handleColumnDragEnd}
                 onkeydown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     // 拖拽功能的键盘替代方案可以后续实现
                   }
                 }}>
              <div class="notion-drag-handle" role="presentation" aria-hidden="true">⋮⋮</div>
              <div class="notion-group-name">{group.label}</div>
              <div class="notion-group-actions">
                <button class="notion-icon-btn {isHidden ? '' : 'active'}"
                        onclick={(e) => {
                          e.preventDefault();
                          handleToggleVisibility(group.key);
                        }}>
                  <EnhancedIcon name={isHidden ? "eye-off" : "eye"} size={12} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- 🆕 快速创建/编辑标签组对话框 -->
{#if showQuickCreator && plugin}
  <QuickTagGroupCreator
    {plugin}
    editingTagGroup={editingTagGroup}
    onSave={handleSaveTagGroup}
    onCancel={() => { showQuickCreator = false; editingTagGroup = undefined; }}
  />
{/if}

<style>
  .kanban-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
    gap: 16px;
  }
  
  /* 加载状态 */
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--text-muted);
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* 看板列 */
  .kanban-columns {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    flex: 1;
    min-height: 0;
  }
  
  .kanban-column {
    display: flex;
    flex-direction: column;
    background: var(--background-secondary);
    border-radius: 12px;
    padding: 16px;
    min-height: 0;
    transition: all 0.3s ease;
  }
  
  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--column-color, var(--background-modifier-border));
  }
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-icon {
    display: flex;
    align-items: center;
  }
  
  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }
  
  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background: var(--column-color, var(--interactive-accent));
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .column-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .column-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .column-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .column-content::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 3px;
  }
  
  .column-content::-webkit-scrollbar-thumb:hover {
    background: var(--background-modifier-border-hover);
  }
  
  /* 牌组卡片包装器（用于拖拽） */
  .kanban-card-wrapper {
    margin-bottom: 12px;
    transition: all 0.2s;
  }
  
  /* 可拖拽的卡片 */
  .kanban-card-wrapper.draggable {
    cursor: grab;
  }
  
  .kanban-card-wrapper.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }
  
  /* 拖拽目标列高亮 */
  .kanban-column.drag-over {
    background: color-mix(in srgb, var(--column-color) 5%, var(--background-secondary));
    border: 2px dashed var(--interactive-accent);
  }
  
  /* 空状态 */
  .empty-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 13px;
  }
  
  /* 响应式 */
  @media (max-width: 1200px) {
    .kanban-columns {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 768px) {
    .kanban-view {
      padding: 12px;
    }
    
    .kanban-columns {
      grid-template-columns: 1fr;
    }
    
  }
  
  /*  移动端专属样式 */
  :global(body.is-mobile) .kanban-view {
    padding: 8px;
    padding-bottom: 60px; /* 为 Obsidian 底部栏留出空间 */
  }
  
  :global(body.is-mobile) .kanban-columns {
    display: flex;
    flex-direction: row;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    grid-template-columns: unset;
    padding-bottom: 8px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  
  :global(body.is-mobile) .kanban-column {
    min-width: 140px;
    max-width: 180px;
    flex-shrink: 0;
    padding: 10px;
    border-radius: 10px;
    scroll-snap-align: start;
  }
  
  :global(body.is-mobile) .column-header {
    margin-bottom: 10px;
    padding-bottom: 8px;
  }
  
  :global(body.is-mobile) .header-title {
    font-size: 12px;
  }
  
  :global(body.is-mobile) .count-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 10px;
  }
  
  :global(body.is-mobile) .kanban-card-wrapper {
    margin-bottom: 6px;
  }
  
  :global(body.is-mobile) .empty-message {
    padding: 20px 10px;
    font-size: 11px;
  }
  
  /* 下拉菜单样式 */
  
  .kanban-dropdown-menu {
    width: 280px;
    max-height: 400px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    z-index: var(--weave-z-overlay);
    animation: dropdownSlideIn 0.15s ease;
  }
  
  @keyframes dropdownSlideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* 菜单组件 */
  .notion-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .notion-menu-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-normal);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .notion-close-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color 0.15s;
  }
  
  .notion-close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .notion-menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    font-size: 13px;
    margin: 1px 6px;
    border-radius: 4px;
    transition: background-color 0.15s;
  }
  
  .notion-menu-row--clickable {
    cursor: pointer;
  }
  
  .notion-menu-row--clickable:hover {
    background: var(--background-modifier-hover);
  }
  
  .notion-menu-label {
    color: var(--text-normal);
  }
  
  .notion-menu-value {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 12px;
  }
  
  /* 切换开关 */
  .notion-toggle-mini {
    width: 32px;
    height: 18px;
    border-radius: 10px;
    background: var(--background-modifier-border);
    position: relative;
    cursor: pointer;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }
  
  .notion-toggle-mini.active {
    background: var(--interactive-accent);
  }
  
  .notion-toggle-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  
  .notion-toggle-mini.active .notion-toggle-thumb {
    transform: translateX(14px);
  }
  
  .notion-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 12px;
  }
  
  .notion-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 4px;
  }
  
  .notion-section-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .notion-section-action {
    font-size: 11px;
    color: var(--text-accent);
    cursor: pointer;
  }
  
  .notion-section-action:hover {
    text-decoration: underline;
  }
  
  .notion-menu-content {
    max-height: 250px;
    overflow-y: auto;
    padding: 4px 0;
  }
  
  /* 群组项目 */
  .notion-group-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    margin: 1px 6px;
    border-radius: 4px;
    cursor: grab;
    transition: background-color 0.15s;
    user-select: none;
  }
  
  .notion-group-item:hover {
    background: var(--background-modifier-hover);
  }
  
  .notion-group-item.dragging {
    opacity: 0.6;
    cursor: grabbing;
  }
  
  .notion-group-item.drag-over {
    background: var(--background-secondary);
    border: 1px dashed var(--interactive-accent);
  }
  
  .notion-drag-handle {
    font-size: 12px;
    color: var(--text-faint);
    cursor: grab;
  }
  
  .notion-group-name {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
  }
  
  .notion-group-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .notion-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--text-faint);
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .notion-icon-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
  }
  
  .notion-icon-btn.active {
    color: var(--interactive-accent);
    background: var(--interactive-accent-hover);
  }
  
  .notion-separator {
    font-size: 12px;
    color: var(--text-faint);
    margin: 0 2px;
  }

  .notion-action-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Overlay 模式样式 */
  .weave-column-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent;
    z-index: var(--weave-z-overlay);
    pointer-events: auto;
  }

  .weave-column-menu {
    pointer-events: auto;
    animation: slideIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 🆕 标签组选择器样式（内联版本） */
  .tag-group-selector-inline {
    padding: 4px 0;
  }
  
  :global(.obsidian-dropdown-trigger.tag-group-select-mini) {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    max-width: 140px;
    min-height: 0;
  }
  
  :global(.obsidian-dropdown-trigger.tag-group-select-mini:hover:not(.disabled)) {
    border-color: var(--interactive-accent);
  }
  
  .tag-group-actions-mini {
    display: flex;
    gap: 4px;
    padding: 4px 12px;
    justify-content: flex-end;
  }
  
  .notion-text-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--interactive-accent);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .notion-text-btn:hover {
    background: var(--background-modifier-hover);
  }
  
  .notion-icon-btn.danger {
    color: var(--text-error);
  }
  
  .notion-icon-btn.danger:hover {
    background: rgba(255, 0, 0, 0.1);
  }

</style>

