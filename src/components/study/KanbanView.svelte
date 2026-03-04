<!--
  看板列视图组件
  根据学习状态和题型对卡片进行分组展示
-->
<script lang="ts">
  import { logger } from '../../utils/logger';
  // 🆕 v2.2: 导入牌组信息获取和设置工具
  import { getCardDeckIds, setCardProperty } from '../../utils/yaml-utils';

  import { onMount } from "svelte";
  import type { Card, CardState, CardType, Deck } from "../../data/types";
  import type { WeaveDataStorage } from "../../data/storage";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import { CardStateManager } from "./CardStateManager";
  import MarkdownRenderer from "../atoms/MarkdownRenderer.svelte";
  import type { WeavePlugin } from "../../main";
  
  // 虚拟滚动支持
  import VirtualKanbanColumn from "../kanban/VirtualKanbanColumn.svelte";
  import { VirtualizationConfigManager } from "../../services/virtualization-config-manager";
  import type { KanbanVirtualizationConfig } from "../../types/virtualization-types";
  
  // 卡片组件
  import LazyGridCard from "../cards/LazyGridCard.svelte";

  /**
   * 排序配置接口
   */
  interface SortConfig {
    property: 'created' | 'due' | 'modified' | 'priority' | 'difficulty' | 'title';
    direction: 'asc' | 'desc';
  }

  /**
   * 列可见性配置接口
   */
  interface ColumnVisibilityConfig {
    hidden: string[];           // 隐藏的列key
    colors: Record<string, string>; // 自定义颜色映射
    order: string[];            // 列显示顺序
    hideEmptyGroups: boolean;   // 隐藏空白分组
    useColoredBackground: boolean; // 使用彩色背景
    sortMode: 'manual' | 'auto'; // 排序模式（保留向后兼容）
    sortRules: SortConfig[];    // 多级排序规则
  }

  // 🆕 卡片属性显示类型
  type CardAttributeType = 'none' | 'uuid' | 'source' | 'priority' | 'retention' | 'modified';

  interface Props {
    cards: Card[]; // 必需：由父组件提供卡片数组
    dataStorage: WeaveDataStorage;
    plugin?: WeavePlugin; // 用于Markdown渲染
    decks?: Deck[]; // 牌组列表（用于显示牌组名称）
    isMobile?: boolean; // 🆕 移动端状态
    onCardSelect?: (card: Card) => void;
    onCardUpdate?: (card: Card) => void; // 新增：卡片更新回调
    onCardDelete?: (cardId: string) => void; // 新增：卡片删除回调
    onCardView?: (cardId: string) => void; // 🆕 卡片查看回调（显示详情模态窗）
    onStartStudy?: (cards: Card[]) => void;
    groupBy?: 'status' | 'type' | 'priority' | 'deck' | 'createTime';
    showStats?: boolean;
    layoutMode?: 'compact' | 'comfortable' | 'spacious';
    attributeType?: CardAttributeType; // 🆕 卡片属性显示类型
  }

  let {
    cards: externalCards,
    dataStorage,
    plugin,
    decks = [],
    isMobile = false, // 🆕 移动端状态
    onCardSelect,
    onCardUpdate,
    onCardDelete,
    onCardView, // 🆕 卡片查看回调
    onStartStudy,
    groupBy = 'status',
    showStats = true,
    layoutMode = 'comfortable',
    attributeType = 'uuid' // 🆕 默认显示唯一标识符
  }: Props = $props();

  // 渐进式加载配置
  const INITIAL_CARDS_PER_COLUMN = 20;
  const LOAD_MORE_BATCH_SIZE = 20;
  
  // 虚拟化配置（从配置管理器获取）
  let virtualizationConfig = $state<KanbanVirtualizationConfig>(
    VirtualizationConfigManager.getKanbanConfig()
  );
  
  // 虚拟化阈值（超过此数量自动启用虚拟滚动）
  //  临时提高阈值：虚拟滚动组件与Svelte 5存在兼容性问题，暂时禁用
  const VIRTUALIZATION_THRESHOLD = 10000;
  
  // 状态管理
  let selectedCards = $state<Set<string>>(new Set());
  let draggedCard = $state<Card | null>(null);
  let cardStateManager = $state<CardStateManager | null>(null);
  let visibleCardsPerGroup = $state<Record<string, number>>({});
  let hoveredCardId = $state<string | null>(null);
  let dragOverColumn = $state<string | null>(null);
  let dragOverIndex = $state<number>(-1);
  
  // 列管理状态
  let columnConfig = $state<Record<string, ColumnVisibilityConfig>>({});
  let showColumnMenu = $state(false);
  
  // 菜单导航状态
  type MenuView = 'main' | 'groupby' | 'sort' | 'sort-add';
  let menuView = $state<MenuView>('main');
  let editingSortIndex = $state<number>(-1);

  // 拖拽管理状态
  let dragSource = $state<string | null>(null);
  let dragTarget = $state<string | null>(null);

  // 分组方式标签映射
  const groupByLabels: Record<string, string> = {
    status: '学习状态',
    type: '题型',
    priority: '优先级',
    deck: '牌组',
    createTime: '创建时间'
  };

  // 当前分组方式标签
  const currentGroupByLabel = $derived(groupByLabels[groupBy] || groupBy);
  
  // 排序选项定义
  const sortOptions = {
    created: { key: 'created', label: '创建时间', icon: 'calendar' },
    due: { key: 'due', label: '到期时间', icon: 'clock' },
    modified: { key: 'modified', label: '修改时间', icon: 'history' },
    priority: { key: 'priority', label: '优先级', icon: 'flag' },
    difficulty: { key: 'difficulty', label: '难度', icon: 'chart-bar' },
    title: { key: 'title', label: '标题', icon: 'heading' }
  };
  
  // 使用 $derived 同步外部数据
  let cards = $derived(externalCards);
  let groupedCards: Record<string, Card[]> = $derived.by(() => {
    if (!cardStateManager) return {};
    // 确保响应式系统能追踪externalCards的变化
    // 通过直接引用externalCards和groupBy，确保任何变化都会触发重新计算
    return cardStateManager.groupCards(externalCards, groupBy);
  });

  // 分组配置
  const groupConfigs = {
    status: {
      title: '按学习状态分组',
      icon: 'layers',
      groups: [
        { key: '0', label: '新卡片', color: '#6b7280', icon: 'plus-circle' },
        { key: '1', label: '学习中', color: '#3b82f6', icon: 'book-open' },
        { key: '2', label: '复习', color: '#10b981', icon: 'refresh-cw' },
        { key: '3', label: '重新学习', color: '#f59e0b', icon: 'rotate-ccw' }
      ]
    },
    type: {
      title: '按题型分组',
      icon: 'grid',
      groups: [
        { key: 'basic', label: '基础问答', color: 'var(--interactive-accent)', icon: 'file-text' },
        { key: 'cloze', label: '挖空填词', color: '#ec4899', icon: 'edit' },
        { key: 'multiple', label: '多选题', color: '#06b6d4', icon: 'check-circle' },
        { key: 'code', label: '代码题', color: '#84cc16', icon: 'code' }
      ]
    },
    priority: {
      title: '按优先级分组',
      icon: 'flag',
      groups: [
        { key: '4', label: '高优先级', color: '#ef4444', icon: 'alert-triangle' },
        { key: '3', label: '中优先级', color: '#f59e0b', icon: 'flag' },
        { key: '2', label: '低优先级', color: '#10b981', icon: 'minus-circle' },
        { key: '1', label: '无优先级', color: '#6b7280', icon: 'circle' }
      ]
    },
    deck: {
      title: '按牌组分组',
      icon: 'folder',
      groups: [] // 动态生成
    },
    createTime: {
      title: '按创建时间分组',
      icon: 'calendar',
      groups: [
        { key: 'today', label: '今天', color: '#3b82f6', icon: 'calendar' },
        { key: 'yesterday', label: '昨天', color: '#10b981', icon: 'calendar' },
        { key: 'last7days', label: '过去7天', color: '#f59e0b', icon: 'calendar' },
        { key: 'last30days', label: '过去30天', color: '#ec4899', icon: 'calendar' },
        { key: 'earlier', label: '更早', color: '#6b7280', icon: 'calendar' }
      ]
    }
  };

  // 当前分组配置（动态生成牌组分组）
  const currentConfig = $derived.by(() => {
    if (groupBy === 'deck' && cardStateManager) {
      // 动态生成牌组分组
      const deckGroups = cardStateManager.getDeckGroups(cards);
      return {
        title: '按牌组分组',
        icon: 'folder',
        groups: deckGroups
      };
    }
    return groupConfigs[groupBy];
  });

  // 可见列（过滤隐藏的列并按顺序排序）
  const visibleGroups = $derived.by(() => {
    const config = getCurrentColumnConfig();
    const allGroups = currentConfig.groups;
    
    // 1. 过滤手动隐藏的列
    let filtered = allGroups.filter((g: { key: string }) => !config.hidden.includes(g.key));
    
    // 2. 过滤空白分组（如果开启）
    if (config.hideEmptyGroups) {
      filtered = filtered.filter((g: { key: string }) => {
        const cards = groupedCards[g.key] || [];
        return cards.length > 0;
      });
    }
    
    // 3. 按配置的顺序排序
    return filtered.sort((a: { key: string }, b: { key: string }) => {
      const orderA = config.order.indexOf(a.key);
      const orderB = config.order.indexOf(b.key);
      if (orderA === -1 && orderB === -1) return 0;
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    });
  });

  // 最终渲染的列
  const renderedGroups = $derived.by(() => {
    return visibleGroups;
  });
  
  /**
   * 判断指定列是否应启用虚拟滚动
   * 
   * @param groupKey - 分组键
   * @returns 是否启用虚拟滚动
   */
  function shouldUseVirtualization(groupKey: string): boolean {
    // 检查全局配置是否启用
    if (!virtualizationConfig.enabled) {
      return false;
    }
    
    // 检查列虚拟化开关
    if (!virtualizationConfig.enableColumnVirtualization) {
      return false;
    }
    
    // 获取该列的卡片总数
    const groupCards = groupedCards[groupKey] || [];
    const cardCount = groupCards.length;
    
    // 超过阈值才启用
    return cardCount > VIRTUALIZATION_THRESHOLD;
  }

  // 初始化可见卡片数量
  function initializeVisibleCards() {
    const newVisibleCards: Record<string, number> = {};
    const config = currentConfig;
    config.groups.forEach((group: { key: string }) => {
      newVisibleCards[group.key] = INITIAL_CARDS_PER_COLUMN;
    });
    visibleCardsPerGroup = newVisibleCards;
  }

  // 卡片排序：比较两张卡片的指定属性
  function compareCards(a: Card, b: Card, property: SortConfig['property']): number {
    switch (property) {
      case 'created':
        return new Date(a.created).getTime() - new Date(b.created).getTime();
      
      case 'due':
        if (!a.fsrs || !b.fsrs) return 0;
        return new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime();
      
      case 'modified':
        return new Date(a.modified).getTime() - new Date(b.modified).getTime();
      
      case 'priority':
        return (b.priority || 0) - (a.priority || 0); // 高优先级在前
      
      case 'difficulty':
        if (!a.fsrs || !b.fsrs) return 0;
        return (a.fsrs.difficulty || 0) - (b.fsrs.difficulty || 0);
      
      case 'title':
        const titleA = a.fields?.front || a.fields?.question || '';
        const titleB = b.fields?.front || b.fields?.question || '';
        return titleA.localeCompare(titleB, 'zh-CN');
      
      default:
        return 0;
    }
  }

  // 卡片排序：应用多级排序规则
  function applySortRules(cards: Card[], rules: SortConfig[]): Card[] {
    if (rules.length === 0) return cards;
    
    return [...cards].sort((a, b) => {
      // 依次应用每个排序规则，直到找到差异
      for (const rule of rules) {
        const comparison = compareCards(a, b, rule.property);
        if (comparison !== 0) {
          return rule.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0; // 完全相等
    });
  }

  // 获取可见卡片（应用排序和分页）
  function getVisibleCards(groupKey: string): Card[] {
    const allCards = groupedCards[groupKey] || [];
    const config = getCurrentColumnConfig();
    
    // 应用排序规则
    const sortedCards = applySortRules(allCards, config.sortRules);
    
    // 应用分页
    const visibleCount = visibleCardsPerGroup[groupKey] || INITIAL_CARDS_PER_COLUMN;
    return sortedCards.slice(0, visibleCount);
  }

  // 加载更多卡片
  function loadMoreCards(groupKey: string) {
    const currentVisible = visibleCardsPerGroup[groupKey] || INITIAL_CARDS_PER_COLUMN;
    const totalCards = (groupedCards[groupKey] || []).length;
    const nextVisible = Math.min(currentVisible + LOAD_MORE_BATCH_SIZE, totalCards);
    
    visibleCardsPerGroup[groupKey] = nextVisible;
  }

  // 辅助函数：确保数组格式
  function ensureArray(value: any): string[] {
    if (Array.isArray(value)) {
      return value;
    }
    // 如果是Set或类似对象，转换为数组
    if (value && typeof value === 'object') {
      try {
        return Array.from(value);
      } catch {
        return [];
      }
    }
    return [];
  }

  // 辅助函数：确保对象格式
  function ensureObject(value: any): Record<string, string> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // 如果是Map，转换为普通对象
      if (value instanceof Map || (value.entries && typeof value.entries === 'function')) {
        try {
          return Object.fromEntries(value);
        } catch {
          return {};
        }
      }
      return value;
    }
    return {};
  }

  // 列管理：获取默认配置
  function getDefaultColumnConfig(groupByType: string): ColumnVisibilityConfig {
    const config = groupConfigs[groupByType as keyof typeof groupConfigs];
    if (!config) {
      return {
        hidden: [],
        colors: {},
        order: [],
        hideEmptyGroups: false,
        useColoredBackground: true,
        sortMode: 'manual',
        sortRules: []
      };
    }
    
    // 如果是牌组分组，需要动态获取
    const groups = groupByType === 'deck' && cardStateManager 
      ? cardStateManager.getDeckGroups(cards)
      : config.groups;
    
    return {
      hidden: [],
      colors: {},
      order: groups.map((g: { key: string }) => g.key),
      hideEmptyGroups: false,
      useColoredBackground: true,
      sortMode: 'manual',
      sortRules: []
    };
  }

  // 列管理：获取当前配置（只读，用于$derived）
  function getCurrentColumnConfig(): ColumnVisibilityConfig {
    const config = columnConfig[groupBy];
    if (!config) {
      return getDefaultColumnConfig(groupBy);
    }
    
    // 运行时类型守卫：确保配置格式正确
    return {
      hidden: ensureArray(config.hidden),
      colors: ensureObject(config.colors),
      order: Array.isArray(config.order) ? config.order : [],
      hideEmptyGroups: config.hideEmptyGroups ?? false,
      useColoredBackground: config.useColoredBackground ?? true,
      sortMode: config.sortMode ?? 'manual',
      sortRules: Array.isArray(config.sortRules) ? config.sortRules : []
    };
  }

  // 列管理：确保当前配置存在（用于修改操作）
  function ensureCurrentColumnConfig(): ColumnVisibilityConfig {
    if (!columnConfig[groupBy]) {
      columnConfig[groupBy] = getDefaultColumnConfig(groupBy);
    }
    
    // 运行时验证并修复配置格式
    const config = columnConfig[groupBy];
    columnConfig[groupBy] = {
      hidden: ensureArray(config.hidden),
      colors: ensureObject(config.colors),
      order: Array.isArray(config.order) ? config.order : [],
      hideEmptyGroups: config.hideEmptyGroups ?? false,
      useColoredBackground: config.useColoredBackground ?? true,
      sortMode: config.sortMode ?? 'manual',
      sortRules: Array.isArray(config.sortRules) ? config.sortRules : []
    };
    
    return columnConfig[groupBy];
  }

  // 当groupBy改变时，确保配置存在
  $effect(() => {
    if (groupBy && !columnConfig[groupBy]) {
      columnConfig[groupBy] = getDefaultColumnConfig(groupBy);
    }
  });

  // 列管理：切换列显示/隐藏
  function handleToggleVisibility(key: string) {
    const config = ensureCurrentColumnConfig();
    if (config.hidden.includes(key)) {
      config.hidden = config.hidden.filter(k => k !== key);
    } else {
      config.hidden = [...config.hidden, key];
    }
    saveColumnConfig();
  }


  // 列管理：显示所有列
  function handleShowAll() {
    const config = ensureCurrentColumnConfig();
    config.hidden = [];
    saveColumnConfig();
  }

  // 列管理：隐藏所有列
  function handleHideAll() {
    const config = ensureCurrentColumnConfig();
    config.hidden = currentConfig.groups.map((g: { key: string }) => g.key);
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
    const config = getCurrentColumnConfig();
    const totalGroups = currentConfig.groups.length;
    const hiddenGroups = config.hidden.length;
    return hiddenGroups >= totalGroups;
  });

  // 计算属性：判断是否所有列都显示
  const isAllVisible = $derived.by(() => {
    const config = getCurrentColumnConfig();
    return config.hidden.length === 0;
  });

  // 列管理：重置配置
  function handleReset() {
    columnConfig[groupBy] = getDefaultColumnConfig(groupBy);
    saveColumnConfig();
  }

  // 列管理：切换隐藏空白分组
  function handleToggleHideEmpty() {
    const config = ensureCurrentColumnConfig();
    config.hideEmptyGroups = !config.hideEmptyGroups;
    saveColumnConfig();
  }

  // 列管理：切换彩色背景
  function handleToggleColoredBackground() {
    const config = ensureCurrentColumnConfig();
    config.useColoredBackground = !config.useColoredBackground;
    saveColumnConfig();
  }

  // 菜单导航：返回上一级
  function navigateBack() {
    if (menuView === 'groupby' || menuView === 'sort') {
      menuView = 'main';
    } else if (menuView === 'sort-add') {
      menuView = 'sort';
    }
  }

  // 菜单导航：关闭菜单
  function closeMenu() {
    showColumnMenu = false;
    menuView = 'main';
  }

  // 处理overlay点击：仅当点击的是overlay自身时才关闭
  function handleOverlayClick(e: MouseEvent) {
    // 只有点击的是overlay自身（不是子元素）时才关闭
    if (e.target === e.currentTarget) {
      closeMenu();
    }
  }

  // 分组方式切换
  function handleGroupByChange(newGroupBy: typeof groupBy) {
    groupBy = newGroupBy;
    initializeVisibleCards();
    menuView = 'main'; // 返回主菜单
    saveColumnConfig();
  }

  // 排序规则管理：添加排序规则
  function handleAddSortRule(property: SortConfig['property'], direction: 'asc' | 'desc') {
    const config = ensureCurrentColumnConfig();
    config.sortRules.push({ property, direction });
    saveColumnConfig();
    menuView = 'sort'; // 返回排序菜单
  }

  // 排序规则管理：删除排序规则
  function handleRemoveSortRule(index: number) {
    const config = ensureCurrentColumnConfig();
    config.sortRules.splice(index, 1);
    saveColumnConfig();
  }

  // 排序规则管理：切换排序方向
  function handleToggleSortDirection(index: number) {
    const config = ensureCurrentColumnConfig();
    const rule = config.sortRules[index];
    if (rule) {
      rule.direction = rule.direction === 'asc' ? 'desc' : 'asc';
      saveColumnConfig();
    }
  }

  // 排序规则管理：清除所有排序
  function handleClearAllSorts() {
    const config = ensureCurrentColumnConfig();
    config.sortRules = [];
    saveColumnConfig();
  }

  // 排序规则管理：拖拽重排
  let sortRuleDragSource = $state<number>(-1);
  let sortRuleDragTarget = $state<number>(-1);

  function handleSortRuleDragStart(index: number) {
    sortRuleDragSource = index;
  }

  function handleSortRuleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (sortRuleDragSource !== -1 && sortRuleDragSource !== index) {
      sortRuleDragTarget = index;
    }
  }

  function handleSortRuleDrop(index: number) {
    if (sortRuleDragSource === -1 || sortRuleDragSource === index) {
      sortRuleDragSource = -1;
      sortRuleDragTarget = -1;
      return;
    }

    const config = ensureCurrentColumnConfig();
    const rules = [...config.sortRules];
    const [removed] = rules.splice(sortRuleDragSource, 1);
    rules.splice(index, 0, removed);
    config.sortRules = rules;
    saveColumnConfig();

    sortRuleDragSource = -1;
    sortRuleDragTarget = -1;
  }

  // 列拖拽管理：开始拖拽
  function handleColumnDragStart(key: string) {
    dragSource = key;
  }

  // 列拖拽管理：拖拽经过
  function handleColumnDragOver(e: DragEvent, key: string) {
    e.preventDefault();
    if (dragSource && dragSource !== key) {
      dragTarget = key;
    }
  }

  // 列拖拽管理：放下
  function handleColumnDrop(key: string) {
    if (!dragSource || dragSource === key) {
      handleColumnDragEnd();
      return;
    }

    const config = ensureCurrentColumnConfig();
    const newOrder = [...config.order];
    const sourceIndex = newOrder.indexOf(dragSource);
    const targetIndex = newOrder.indexOf(key);

    if (sourceIndex === -1 || targetIndex === -1) {
      handleColumnDragEnd();
      return;
    }

    // 重新排序
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, dragSource);

    config.order = newOrder;
    saveColumnConfig();

    handleColumnDragEnd();
  }

  // 列拖拽管理：结束拖拽
  function handleColumnDragEnd() {
    dragSource = null;
    dragTarget = null;
  }

  // 列管理：保存配置到localStorage
  function saveColumnConfig() {
    try {
      // 直接保存，无需转换
      localStorage.setItem('weave-kanban-column-config-v4', 
        JSON.stringify(columnConfig)
      );
    } catch (error) {
      logger.error('[KanbanView] 保存列配置失败:', error);
    }
  }

  // 列管理：从localStorage加载配置
  function loadColumnConfig() {
    try {
      // 强制清理旧版本配置，避免数据冲突
      const v2 = localStorage.getItem('weave-kanban-column-config-v2');
      const v3 = localStorage.getItem('weave-kanban-column-config-v3');
      
      // 尝试加载 v4 配置
      let saved = localStorage.getItem('weave-kanban-column-config-v4');
      
      // 如果 v4 不存在，尝试从 v3 迁移
      if (!saved && (v2 || v3)) {
        const oldSaved = v3 || v2;
        if (oldSaved) {
          logger.debug('[KanbanView] 从旧版本迁移配置...');
          const parsed = JSON.parse(oldSaved);
          const migrated: Record<string, ColumnVisibilityConfig> = {};
          
          Object.keys(parsed).forEach(key => {
            const oldConfig = parsed[key];
            migrated[key] = {
              hidden: ensureArray(oldConfig.hidden),
              colors: ensureObject(oldConfig.colors),
              order: Array.isArray(oldConfig.order) ? oldConfig.order : [],
              hideEmptyGroups: oldConfig.hideEmptyGroups ?? false,
              useColoredBackground: oldConfig.useColoredBackground ?? true,
              sortMode: oldConfig.sortMode ?? 'manual',
              sortRules: Array.isArray(oldConfig.sortRules) ? oldConfig.sortRules : []
            };
          });
          
          columnConfig = migrated;
          // 保存迁移后的数据
          saveColumnConfig();
          
          // 清理旧配置
          if (v2) localStorage.removeItem('weave-kanban-column-config-v2');
          if (v3) localStorage.removeItem('weave-kanban-column-config-v3');
          
          logger.debug('[KanbanView] 配置迁移完成');
          return;
        }
      }
      
      if (saved) {
        const parsed = JSON.parse(saved);
        // 确保数据结构正确（即使是v4也要验证）
        const loaded: Record<string, ColumnVisibilityConfig> = {};
        
        Object.keys(parsed).forEach(key => {
          const config = parsed[key];
          loaded[key] = {
            hidden: ensureArray(config.hidden),
            colors: ensureObject(config.colors),
            order: Array.isArray(config.order) ? config.order : [],
            hideEmptyGroups: config.hideEmptyGroups ?? false,
            useColoredBackground: config.useColoredBackground ?? true,
            sortMode: config.sortMode ?? 'manual',
            sortRules: Array.isArray(config.sortRules) ? config.sortRules : []
          };
        });
        
        columnConfig = loaded;
      }
    } catch (error) {
      logger.error('[KanbanView] 加载列配置失败:', error);
      // 出错时清空配置，使用默认值
      columnConfig = {};
    }
  }

  // 列管理：获取列颜色（自定义优先）
  function getColumnColor(groupKey: string, defaultColor: string): string {
    const config = getCurrentColumnConfig();
    return config.colors[groupKey] || defaultColor;
  }


  // 切换分组方式
  function changeGroupBy(newGroupBy: typeof groupBy) {
    groupBy = newGroupBy;
    // groupedCards 会通过 $derived 自动更新
    // 重新初始化可见卡片数量
    initializeVisibleCards();
  }

  // 选择卡片
  function toggleCardSelection(card: Card) {
    if (selectedCards.has(card.uuid)) {
      selectedCards.delete(card.uuid);
    } else {
      selectedCards.add(card.uuid);
    }
    selectedCards = new Set(selectedCards);
  }

  // 全选/取消全选分组
  function selectGroup(groupKey: string) {
    const groupCards = groupedCards[groupKey] || [];
    
    // 检查是否所有卡片都已选中
    const allSelected = groupCards.length > 0 && groupCards.every((card: Card) => selectedCards.has(card.uuid));
    
    if (allSelected) {
      // 如果全部选中，则取消选中
      groupCards.forEach((card: Card) => selectedCards.delete(card.uuid));
    } else {
      // 否则全选
      groupCards.forEach((card: Card) => selectedCards.add(card.uuid));
    }
    
    selectedCards = new Set(selectedCards);
  }

  // 清除选择
  function clearSelection() {
    selectedCards.clear();
    selectedCards = new Set(selectedCards);
  }

  // 开始学习选中的卡片
  function startStudySelected() {
    const selected = cards.filter(card => selectedCards.has(card.uuid));
    if (selected.length > 0 && onStartStudy) {
      onStartStudy(selected);
    }
  }

  // 悬停事件处理
  function handleCardHover(cardId: string) {
    hoveredCardId = cardId;
  }

  function handleCardLeave() {
    hoveredCardId = null;
  }

  // 复制卡片
  function duplicateCard(card: Card) {
    // 🆕 v0.8: 导入新ID生成器
    const { generateUUID } = require('../../utils/helpers');
    
    const newCard: Card = {
      ...card,
      // id字段已废弃，移除
      uuid: generateUUID(), // 🆕 使用新格式UUID
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };
    
    if (onCardUpdate) {
      onCardUpdate(newCard);
    }
  }

  // 删除卡片（调用父组件处理，父组件会处理确认逻辑）
  function deleteCard(card: Card) {
    if (onCardDelete) {
      onCardDelete(card.uuid);
    }
  }

  //  判断当前分组方式是否支持卡片拖拽
  // 只有 priority 和 deck 分组方式支持拖拽卡片
  function isCardDraggable(): boolean {
    return groupBy === 'priority' || groupBy === 'deck';
  }

  // 检查是否允许拖拽到目标列
  function canDragToColumn(
    sourceGroupKey: string,
    targetGroupKey: string
  ): { allowed: boolean; reason?: string } {
    
    // 同一列内排序总是允许
    if (sourceGroupKey === targetGroupKey) {
      return { allowed: true };
    }
    
    // 根据分组类型判断
    switch (groupBy) {
      case 'status':
        return { 
          allowed: false, 
          reason: '学习状态由FSRS6算法自动管理，无法手动修改。\n请通过学习功能来更新卡片状态。' 
        };
        
      case 'type':
        return { 
          allowed: false, 
          reason: '卡片类型无法通过拖拽修改' 
        };
      
      case 'createTime':
        return { 
          allowed: false, 
          reason: '创建时间无法修改' 
        };
      
      case 'priority':
      case 'deck':
        return { allowed: true };
        
      default:
        return { allowed: true };
    }
  }

  // 显示拖拽限制提示
  function showDragRestrictionNotice(reason: string) {
    if (plugin?.app) {
      // 使用Obsidian的Notice API
      new (plugin.app as any).Notice(reason, 4000);
    } else {
      alert(reason);
    }
  }

  // 拖拽处理
  function handleDragStart(e: DragEvent, card: Card) {
    draggedCard = card;
    
    // 设置看板拖拽标识，防止触发创建卡片
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/x-weave-kanban-card', card.uuid);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragEnd() {
    draggedCard = null;
    dragOverColumn = null;
    dragOverIndex = -1;
  }

  function handleDragOver(e: DragEvent, groupKey: string, index: number = -1) {
    e.preventDefault();
    dragOverColumn = groupKey;
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverColumn = null;
    dragOverIndex = -1;
  }

  async function handleDrop(targetGroupKey: string) {
    if (!draggedCard || !cardStateManager) return;

    try {
      const card = cards.find(c => c.uuid === draggedCard!.uuid);
      if (!card) return;

      // 获取源分组key
      const sourceGroupKey = getCardGroupKey(card);
      
      // 检查是否允许拖拽
      const dragCheck = canDragToColumn(sourceGroupKey, targetGroupKey);
      if (!dragCheck.allowed) {
        if (dragCheck.reason) {
          showDragRestrictionNotice(dragCheck.reason);
        }
        return;
      }

      let updatedCard: Card | null = null;

      // 根据分组方式更新卡片
      switch (groupBy) {
        case 'status':
          // 此分支现在不会被执行，因为canDragToColumn已经拒绝了
          break;
          
        case 'type':
          // 题型不能通过拖拽改变
          break;
        
        case 'createTime':
          // 创建时间不能通过拖拽改变
          break;
          
        case 'priority':
          const newPriority = parseInt(targetGroupKey);
          updatedCard = {
            ...card,
            priority: newPriority
          };
          break;
        
        case 'deck':
          //  禁止将卡片拖到"无牌组"列（每张卡片必须属于一个牌组）
          if (targetGroupKey === '_none') {
            showDragRestrictionNotice('卡片必须属于一个牌组，无法移动到"无牌组"');
            return;
          }
          // 🆕 v2.2: 同时更新 deckId 和 content YAML 中的 we_decks
          const targetDeck = decks.find(d => d.id === targetGroupKey);
          let updatedContent = card.content;
          if (targetDeck && updatedContent) {
            // 更新 we_decks 为新牌组名称
            updatedContent = setCardProperty(updatedContent, 'we_decks', [targetDeck.name]);
          }
          updatedCard = {
            ...card,
            deckId: targetGroupKey,
            content: updatedContent
          };
          break;
      }

      // 通过回调通知父组件更新
      if (updatedCard && onCardUpdate) {
        // 等待父组件更新完成
        await onCardUpdate(updatedCard);
      }
    } catch (error) {
      logger.error('拖拽更新失败:', error);
    } finally {
      draggedCard = null;
    }
  }

  // 获取卡片所属的分组key
  function getCardGroupKey(card: Card): string {
    switch (groupBy) {
      case 'status':
        return card.fsrs ? String(card.fsrs.state) : '0';
      case 'type':
        return card.type;
      case 'priority':
        return String(card.priority || 1);
      case 'deck':
        //  v2.2: 优先从 content YAML 的 we_decks 获取牌组ID
        const { primaryDeckId } = getCardDeckIds(card);
        return primaryDeckId || card.deckId || '_none';
      case 'createTime':
        return getTimeGroupKey(card.created);
      default:
        return '';
    }
  }

  // 根据创建时间获取分组key（与CardStateManager保持一致）
  function getTimeGroupKey(created: string): string {
    const now = new Date();
    const createTime = new Date(created);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (createTime >= today) {
      return 'today';
    } else if (createTime >= yesterday) {
      return 'yesterday';
    } else if (createTime >= last7days) {
      return 'last7days';
    } else if (createTime >= last30days) {
      return 'last30days';
    } else {
      return 'earlier';
    }
  }

  // 获取分组统计
  function getGroupStats(groupKey: string) {
    const groupCards = groupedCards[groupKey] || [];
    const total = groupCards.length;
    const selected = groupCards.filter((card: Card) => selectedCards.has(card.uuid)).length;
    
    // 计算到期卡片数量
    const now = new Date();
    const due = groupCards.filter((card: Card) => card.fsrs && new Date(card.fsrs.due) <= now).length;
    
    return { total, selected, due };
  }

  // 格式化卡片内容
  function getCardPreview(card: Card): string {
    //  Content-Only 架构：从 card.content 解析
    if (card.content) {
      const content = card.content.trim();
      const dividerIndex = content.indexOf('---div---');
      const front = dividerIndex >= 0 
        ? content.substring(0, dividerIndex).trim() 
        : content;
      return front.length > 50 ? front.substring(0, 50) + '...' : front;
    }
    return '';
  }

  // 获取卡片内容用于渲染
  function getCardContentBySide(card: Card, side: 'front' | 'back'): string {
    //  Content-Only 架构：从 card.content 解析
    if (!card || !card.content) {
      return '';
    }
    
    const content = card.content.trim();
    const dividerIndex = content.indexOf('---div---');
    
    if (dividerIndex >= 0) {
      const front = content.substring(0, dividerIndex).trim();
      const back = content.substring(dividerIndex + '---div---'.length).trim();
      return side === 'front' ? front : back;
    } else {
      return side === 'front' ? content : '';
    }
  }

  // 获取卡片完整内容（合并正反面）- 参考GridCard实现
  function getFullCardContent(card: Card): string {
    if (!card || !card.content) {
      return '';
    }
    
    const content = card.content.trim();
    const dividerIndex = content.indexOf('---div---');
    
    if (dividerIndex >= 0) {
      const front = content.substring(0, dividerIndex).trim();
      const back = content.substring(dividerIndex + '---div---'.length).trim();
      
      // 如果没有背面内容，只返回正面
      if (!back) return front;
      
      // 如果有背面内容，用分隔符连接（与GridCard保持一致）
      return `${front}\n\n---\n\n${back}`;
    } else {
      // 无分隔符，返回整个内容
      return content;
    }
  }


  // 获取卡片类型图标
  function getCardTypeIcon(type: CardType): string {
    switch (type) {
      case 'basic': return 'file-text';
      case 'cloze': return 'edit';
      case 'multiple': return 'check-circle';
      case 'code': return 'code';
      default: return 'file-text';
    }
  }

  // 组件挂载时初始化
  onMount(async () => {
    // 初始化状态管理器
    cardStateManager = new CardStateManager(dataStorage);
    
    // 设置牌组列表（用于显示牌组名称）
    if (decks && decks.length > 0) {
      cardStateManager.setDecks(decks);
    }
    
    // 清理旧的折叠配置（向新的列管理系统迁移）
    try {
      const oldKey = 'weave-kanban-collapsed-columns';
      if (localStorage.getItem(oldKey)) {
        localStorage.removeItem(oldKey);
      }
    } catch (error) {
      // 忽略清理错误
    }
    
    // 加载列配置
    loadColumnConfig();
    
    // 初始化可见卡片数量
    initializeVisibleCards();
    
  });
  
  // 监听decks变化，更新CardStateManager中的牌组列表
  $effect(() => {
    if (cardStateManager && decks && decks.length > 0) {
      cardStateManager.setDecks(decks);
    }
  });
</script>

<div class="weave-kanban-view">
  <!-- 隐藏的列管理按钮（通过父组件触发） -->
  <button
    class="weave-hidden-column-btn"
    class:active={showColumnMenu}
    onclick={() => showColumnMenu = !showColumnMenu}
    title="列设置"
    style="display: none;"
  >
    <EnhancedIcon name="sliders" size="16" />
  </button>

  <!-- 列管理菜单 -->
  {#if showColumnMenu}
    <div 
      class="weave-column-menu-overlay"
      role="presentation"
      onclick={handleOverlayClick}
      onkeydown={(e) => {
        if (e.key === 'Escape') closeMenu();
      }}
    >
      <div 
        class="weave-column-menu" 
        role="dialog"
        aria-label="列设置"
        tabindex="-1"
      >
        <!-- 主菜单视图 -->
        {#if menuView === 'main'}
          <!-- Notion风格标题栏 -->
          <div class="notion-menu-header">
            <div class="notion-menu-title">
              <EnhancedIcon name="sliders" size="14" />
              <span>视图选项</span>
            </div>
            <button class="notion-close-btn" onclick={closeMenu}>
              <EnhancedIcon name="x" size="14" />
            </button>
          </div>

          <!-- 分组方式选择器 -->
          <div 
            class="notion-menu-row notion-menu-row--clickable" 
            role="button"
            tabindex="0"
            onclick={() => menuView = 'groupby'}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                menuView = 'groupby';
              }
            }}
          >
            <span class="notion-menu-label">分组方式</span>
            <div class="notion-menu-value">
              <span>{currentGroupByLabel}</span>
              <EnhancedIcon name="chevron-right" size="12" />
            </div>
          </div>

          <!-- 排序方式选择器 -->
          <div 
            class="notion-menu-row notion-menu-row--clickable" 
            role="button"
            tabindex="0"
            onclick={() => menuView = 'sort'}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                menuView = 'sort';
              }
            }}
          >
            <span class="notion-menu-label">排序</span>
            <div class="notion-menu-value">
              <span>{getCurrentColumnConfig().sortRules.length > 0 ? `${getCurrentColumnConfig().sortRules.length} 条规则` : '无'}</span>
              <EnhancedIcon name="chevron-right" size="12" />
            </div>
          </div>

          <!-- 分隔线 -->
          <div class="notion-divider"></div>

          <!-- 配置选项 -->
          <div class="notion-menu-row">
            <span class="notion-menu-label">隐藏空白分组</span>
            <div 
              class="notion-toggle-mini {getCurrentColumnConfig().hideEmptyGroups ? 'active' : ''}"
              onclick={handleToggleHideEmpty}
              role="switch"
              aria-label="切换隐藏空白分组"
              aria-checked={getCurrentColumnConfig().hideEmptyGroups}
              tabindex="0"
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

          <div class="notion-menu-row">
            <span class="notion-menu-label">填充列背景颜色</span>
            <div 
              class="notion-toggle-mini {getCurrentColumnConfig().useColoredBackground ? 'active' : ''}"
              onclick={handleToggleColoredBackground}
              role="switch"
              aria-label="切换填充列背景颜色"
              aria-checked={getCurrentColumnConfig().useColoredBackground}
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleColoredBackground();
                }
              }}
            >
              <div class="notion-toggle-thumb"></div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div class="notion-divider"></div>

          <!-- 群组标题 -->
          <div class="notion-section-header">
            <span class="notion-section-title">群组</span>
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
              >重置</span>
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
                title={isAllHidden ? '显示所有列' : '隐藏所有列'}
              >{isAllHidden ? '全部显示' : '全部隐藏'}</span>
            </div>
          </div>

          <!-- 群组列表 -->
          <div class="notion-menu-content">
            {#each currentConfig.groups as group (group.key)}
              {@const config = getCurrentColumnConfig()}
              {@const isHidden = config.hidden.includes(group.key)}
              {@const customColor = config.colors[group.key]}
              
              <div 
                class="notion-group-item"
                class:dragging={dragSource === group.key}
                class:drag-over={dragTarget === group.key}
                role="button"
                tabindex="0"
                draggable="true"
                ondragstart={() => handleColumnDragStart(group.key)}
                ondragover={(e) => handleColumnDragOver(e, group.key)}
                ondrop={() => handleColumnDrop(group.key)}
                ondragend={handleColumnDragEnd}
              >
                <!-- 拖拽手柄（文本符号） -->
                <div class="notion-drag-handle">⋮⋮</div>

                <!-- 分组名称 -->
                <div class="notion-group-name">{group.label}</div>

                <!-- 操作按钮组 -->
                <div class="notion-group-actions">
                  <!-- 显示/隐藏按钮 -->
                  <button
                    class="notion-icon-btn"
                    class:active={!isHidden}
                    onclick={(e) => {
            e.preventDefault();
            handleToggleVisibility(group.key);
          }}
                    title={isHidden ? '显示列' : '隐藏列'}
                  >
                    <EnhancedIcon name={isHidden ? 'eye-off' : 'eye'} size="12" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- 分组方式子菜单 -->
        {#if menuView === 'groupby'}
          <div class="notion-menu-header">
            <button class="notion-back-btn" onclick={navigateBack}>
              <EnhancedIcon name="arrow-left" size="14" />
              <span>分组方式</span>
            </button>
            <button class="notion-close-btn" onclick={closeMenu}>
              <EnhancedIcon name="x" size="14" />
            </button>
          </div>

          <div class="notion-menu-content">
            <div 
              class="notion-menu-row notion-menu-row--option"
              class:notion-menu-row--selected={groupBy === 'status'}
              role="button"
              tabindex="0"
              onclick={() => handleGroupByChange('status')}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGroupByChange('status');
                }
              }}
            >
              <div class="notion-option-content">
                <EnhancedIcon name="layers" size="14" />
                <span>学习状态</span>
              </div>
              {#if groupBy === 'status'}
                <EnhancedIcon name="check" size="14" />
              {/if}
            </div>

            <div 
              class="notion-menu-row notion-menu-row--option"
              class:notion-menu-row--selected={groupBy === 'type'}
              role="button"
              tabindex="0"
              onclick={() => handleGroupByChange('type')}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGroupByChange('type');
                }
              }}
            >
              <div class="notion-option-content">
                <EnhancedIcon name="grid" size="14" />
                <span>题型</span>
              </div>
              {#if groupBy === 'type'}
                <EnhancedIcon name="check" size="14" />
              {/if}
            </div>

            <div 
              class="notion-menu-row notion-menu-row--option"
              class:notion-menu-row--selected={groupBy === 'priority'}
              role="button"
              tabindex="0"
              onclick={() => handleGroupByChange('priority')}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGroupByChange('priority');
                }
              }}
            >
              <div class="notion-option-content">
                <EnhancedIcon name="flag" size="14" />
                <span>优先级</span>
              </div>
              {#if groupBy === 'priority'}
                <EnhancedIcon name="check" size="14" />
              {/if}
            </div>

            <div 
              class="notion-menu-row notion-menu-row--option"
              class:notion-menu-row--selected={groupBy === 'deck'}
              role="button"
              tabindex="0"
              onclick={() => handleGroupByChange('deck')}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGroupByChange('deck');
                }
              }}
            >
              <div class="notion-option-content">
                <EnhancedIcon name="folder" size="14" />
                <span>牌组</span>
              </div>
              {#if groupBy === 'deck'}
                <EnhancedIcon name="check" size="14" />
              {/if}
            </div>

            <div 
              class="notion-menu-row notion-menu-row--option"
              class:notion-menu-row--selected={groupBy === 'createTime'}
              role="button"
              tabindex="0"
              onclick={() => handleGroupByChange('createTime')}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGroupByChange('createTime');
                }
              }}
            >
              <div class="notion-option-content">
                <EnhancedIcon name="calendar" size="14" />
                <span>创建时间</span>
              </div>
              {#if groupBy === 'createTime'}
                <EnhancedIcon name="check" size="14" />
              {/if}
            </div>
          </div>
        {/if}

        <!-- 排序子菜单 -->
        {#if menuView === 'sort'}
          <div class="notion-menu-header">
            <button class="notion-back-btn" onclick={navigateBack}>
              <EnhancedIcon name="arrow-left" size="14" />
              <span>排序</span>
            </button>
            <button class="notion-close-btn" onclick={closeMenu}>
              <EnhancedIcon name="x" size="14" />
            </button>
          </div>

          <div class="notion-menu-content">
            <!-- 当前排序规则列表 -->
            {#if getCurrentColumnConfig().sortRules.length > 0}
              <div class="notion-sort-rules-list">
                {#each getCurrentColumnConfig().sortRules as rule, index (index)}
                  {@const option = sortOptions[rule.property]}
                  <div 
                    class="notion-sort-rule-item"
                    class:dragging={sortRuleDragSource === index}
                    class:drag-over={sortRuleDragTarget === index}
                    role="button"
                    tabindex="0"
                    draggable="true"
                    ondragstart={() => handleSortRuleDragStart(index)}
                    ondragover={(e) => handleSortRuleDragOver(e, index)}
                    ondrop={() => handleSortRuleDrop(index)}
                    ondragend={() => { sortRuleDragSource = -1; sortRuleDragTarget = -1; }}
                  >
                    <div class="notion-drag-handle">⋮⋮</div>
                    <div class="notion-sort-rule-content">
                      <EnhancedIcon name={option.icon} size="12" />
                      <span>{option.label}</span>
                    </div>
                    <button 
                      class="notion-sort-direction-btn"
                      onclick={(e) => {
            e.preventDefault();
            handleToggleSortDirection(index);
          }}
                      title={rule.direction === 'asc' ? '升序' : '降序'}
                    >
                      <EnhancedIcon name={rule.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size="12" />
                    </button>
                    <button 
                      class="notion-icon-btn"
                      onclick={(e) => {
            e.preventDefault();
            handleRemoveSortRule(index);
          }}
                      title="删除排序规则"
                    >
                      <EnhancedIcon name="x" size="12" />
                    </button>
                  </div>
                {/each}
              </div>
              
              <div class="notion-divider"></div>
            {/if}

            <!-- 添加排序规则按钮 -->
            <div 
              class="notion-menu-row notion-menu-row--clickable"
              role="button"
              tabindex="0"
              onclick={() => menuView = 'sort-add'}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  menuView = 'sort-add';
                }
              }}
            >
              <div class="notion-option-content">
                <EnhancedIcon name="plus" size="14" />
                <span>添加排序规则</span>
              </div>
              <EnhancedIcon name="chevron-right" size="12" />
            </div>

            {#if getCurrentColumnConfig().sortRules.length > 0}
              <div class="notion-divider"></div>
              
              <!-- 清除所有排序按钮 -->
              <div 
                class="notion-menu-row notion-menu-row--clickable notion-menu-row--danger"
                role="button"
                tabindex="0"
                onclick={handleClearAllSorts}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClearAllSorts();
                  }
                }}
              >
                <div class="notion-option-content">
                  <EnhancedIcon name="refresh-cw" size="14" />
                  <span>清除所有排序</span>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- 属性选择子菜单 -->
        {#if menuView === 'sort-add'}
          <div class="notion-menu-header">
            <button class="notion-back-btn" onclick={navigateBack}>
              <EnhancedIcon name="arrow-left" size="14" />
              <span>选择属性</span>
            </button>
            <button class="notion-close-btn" onclick={closeMenu}>
              <EnhancedIcon name="x" size="14" />
            </button>
          </div>

          <div class="notion-menu-content">
            {#each Object.values(sortOptions) as option (option.key)}
              <div class="notion-sort-option-group">
                <div 
                  class="notion-menu-row notion-menu-row--option"
                  role="button"
                  tabindex="0"
                  onclick={() => handleAddSortRule(option.key as SortConfig['property'], 'asc')}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAddSortRule(option.key as SortConfig['property'], 'asc');
                    }
                  }}
                >
                  <div class="notion-option-content">
                    <EnhancedIcon name={option.icon} size="14" />
                    <span>{option.label}</span>
                  </div>
                  <div class="notion-sort-direction-options">
                    <button
                      class="notion-direction-btn"
                      onclick={(e) => {
            e.preventDefault();
            handleAddSortRule(option.key as SortConfig['property'], 'asc');
          }}
                      title="升序"
                    >
                      <EnhancedIcon name="chevron-up" size="10" />
                    </button>
                    <button
                      class="notion-direction-btn"
                      onclick={(e) => {
            e.preventDefault();
            handleAddSortRule(option.key as SortConfig['property'], 'desc');
          }}
                      title="降序"
                    >
                      <EnhancedIcon name="chevron-down" size="10" />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- 看板列 -->
  <div class="weave-kanban-board" class:layout-compact={layoutMode === 'compact'} class:layout-comfortable={layoutMode === 'comfortable'} class:layout-spacious={layoutMode === 'spacious'}>
    {#if cardStateManager}
      {#each renderedGroups as group (group.key)}
        {@const stats = getGroupStats(group.key)}
        {@const groupCards = groupedCards[group.key] || []}
        
        <div
          class="weave-kanban-column"
          role="region"
          aria-label={`${group.label}分组`}
          ondrop={() => handleDrop(group.key)}
          ondragover={(e) => e.preventDefault()}
        >
          <!-- 列头 -->
          <div 
            class="weave-column-header"
            class:colored-bg={getCurrentColumnConfig().useColoredBackground}
            style="--group-color: {getColumnColor(group.key, group.color)}"
          >
            <div class="weave-column-title-row">
              <div class="weave-title-content">
                <EnhancedIcon name={group.icon} size="18" />
                <span>{group.label}</span>
                <span class="weave-column-count">({stats.total})</span>
              </div>
              
              <button
                class="weave-column-action weave-select-all"
                onclick={() => selectGroup(group.key)}
                title="全选此分组"
              >
                <EnhancedIcon name="check-square" size="14" />
              </button>
            </div>
            
            {#if showStats}
              <div class="weave-column-stats">
                <div class="weave-progress-bar">
                  <div 
                    class="weave-progress-fill"
                    style="width: {stats.total > 0 ? (stats.due / stats.total * 100) : 0}%"
                  ></div>
                </div>
                <div class="weave-stats-text">
                  {#if stats.due > 0}
                    <span class="weave-due-badge">{stats.due} 到期</span>
                  {/if}
                  {#if stats.selected > 0}
                    <span class="weave-selected-badge">{stats.selected} 已选</span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <!-- 卡片列表 -->
          <div 
            class="weave-column-content"
            class:drag-over={dragOverColumn === group.key}
            class:virtualized={shouldUseVirtualization(group.key)}
            role="list"
            ondragover={(e) => handleDragOver(e, group.key)}
            ondragleave={handleDragLeave}
            ondrop={() => handleDrop(group.key)}
          >
            {#if shouldUseVirtualization(group.key)}
              <!-- 虚拟滚动模式 -->
              <VirtualKanbanColumn
                cards={groupedCards[group.key] || []}
                groupKey={group.key}
                columnConfig={virtualizationConfig}
                onCardSelect={onCardSelect}
                onCardUpdate={onCardUpdate}
                onCardDelete={onCardDelete}
                {plugin}
                {layoutMode}
                isDraggable={isCardDraggable()}
              />
            {:else}
              <!-- 传统渲染模式 - 使用 GridCard 组件 -->
              {#each getVisibleCards(group.key) as card, index (card.uuid)}
              <!-- 插入指示器 -->
              {#if draggedCard && dragOverColumn === group.key && dragOverIndex === index}
                <div class="weave-drop-indicator"></div>
              {/if}
              
              <!-- 拖拽容器包装 GridCard -->
              <div
                class="weave-kanban-card-wrapper"
                class:dragging={draggedCard?.uuid === card.uuid}
                class:draggable={isCardDraggable()}
                role="listitem"
                draggable={isCardDraggable()}
                ondragstart={(e) => isCardDraggable() && handleDragStart(e, card)}
                ondragend={handleDragEnd}
                ondragover={(e) => isCardDraggable() && handleDragOver(e, group.key, index)}
              >
                <LazyGridCard
                  {card}
                  selected={selectedCards.has(card.uuid)}
                  plugin={plugin!}
                  layoutMode="masonry"
                  {attributeType}
                  {isMobile}
                  onClick={() => toggleCardSelection(card)}
                  onEdit={() => onCardSelect?.(card)}
                  onDelete={() => deleteCard(card)}
                  onView={() => onCardView?.(card.uuid)}
                />
              </div>
            {/each}

            <!-- 加载更多按钮（仅传统模式） -->
            {#if getVisibleCards(group.key).length < (groupedCards[group.key] || []).length}
              <div class="weave-load-more-container">
                <button 
                  class="weave-load-more-btn"
                  onclick={() => loadMoreCards(group.key)}
                >
                  <EnhancedIcon name="chevron-down" size={16} />
                  加载更多 ({(groupedCards[group.key] || []).length - (visibleCardsPerGroup[group.key] || INITIAL_CARDS_PER_COLUMN)} 张剩余)
                </button>
              </div>
            {/if}
            {/if}

            <!-- 空列状态 -->
            <!-- 空列不显示任何提示 -->
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .weave-kanban-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-primary);
  }

  /* 工具栏样式已移除，功能迁移到父组件 */

  .weave-kanban-board {
    flex: 1;
    display: flex;
    gap: 1rem;
    padding: 0.75rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .weave-kanban-column {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    max-height: 100%;  /* 防止被子元素撑开 */
    min-height: 0;     /* 确保 flex 收缩正常 */
    background: var(--background-secondary);
    border-radius: var(--radius-l);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }


  .weave-column-header {
    padding: 0.75rem 0.75rem 0.5rem 0.75rem;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background 0.2s ease;
  }

  .weave-column-header.colored-bg {
    background: color-mix(in srgb, var(--group-color) 15%, var(--background-secondary));
  }

  .weave-column-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.375rem;
    gap: 0.5rem;
  }


  .weave-title-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .weave-column-count {
    color: var(--text-muted);
    font-weight: normal;
  }

  .weave-column-stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .weave-progress-bar {
    width: 100%;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .weave-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--interactive-accent), var(--color-green));
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .weave-stats-text {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .weave-due-badge,
  .weave-selected-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .weave-due-badge {
    background: color-mix(in srgb, var(--color-red) 20%, transparent);
    color: var(--color-red);
  }

  .weave-selected-badge {
    background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);
    color: var(--interactive-accent);
  }

  .weave-select-all {
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  .weave-select-all:hover {
    opacity: 1;
  }

  .weave-column-action {
    padding: 0.25rem;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .weave-column-action:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .weave-column-content {
    flex: 1;
    padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }
  
  .weave-column-content.virtualized {
    /* 虚拟化模式：移除内边距和gap，由虚拟列组件管理 */
    padding: 0;
    gap: 0;
    overflow-y: auto;   /* 恢复滚动能力，修复高度撑开问题 */
    overflow-x: hidden; /* 防止横向滚动 */
  }

  .weave-column-content.drag-over {
    background: color-mix(in srgb, var(--interactive-accent) 5%, transparent);
    border: 2px dashed var(--interactive-accent);
    border-radius: 4px;
  }

  .weave-drop-indicator {
    height: 3px;
    background: var(--interactive-accent);
    margin: 0.25rem 0;
    border-radius: 2px;
    animation: pulse 1s infinite;
    box-shadow: 0 0 8px var(--interactive-accent);
  }

  @keyframes pulse {
    0%, 100% { 
      opacity: 1;
      transform: scaleY(1);
    }
    50% { 
      opacity: 0.7;
      transform: scaleY(0.8);
    }
  }

  /* 拖拽容器包装器样式 */
  .weave-kanban-card-wrapper {
    width: 100%;
  }

  .weave-kanban-card-wrapper.dragging {
    opacity: 0.6;
  }

  /* 布局模式样式（由主工具栏控制） - 带平滑过渡动画 */
  .weave-kanban-board {
    transition: gap 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-kanban-column {
    transition: min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-kanban-board.layout-compact {
    gap: 0.5rem;
  }

  .weave-kanban-board.layout-compact .weave-kanban-column {
    min-width: 280px;
    flex: 1;
  }

  .weave-kanban-board.layout-comfortable {
    gap: 0.75rem;
  }

  .weave-kanban-board.layout-comfortable .weave-kanban-column {
    min-width: 320px;
    flex: 1;
  }

  .weave-kanban-board.layout-spacious {
    gap: 1rem;
  }

  .weave-kanban-board.layout-spacious .weave-kanban-column {
    min-width: 380px;
    flex: 1;
  }

  /* GridCard 在看板视图中的显示密度适配 - 通过 CSS 变量实现 */
  .weave-kanban-board.layout-compact :global(.grid-card--kanban) {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    min-height: 140px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-kanban-board.layout-compact :global(.grid-card--kanban .content-area) {
    max-height: 150px;
    font-size: 0.85rem;
  }

  .weave-kanban-board.layout-comfortable :global(.grid-card--kanban) {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    min-height: 180px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-kanban-board.layout-comfortable :global(.grid-card--kanban .content-area) {
    max-height: 200px;
  }

  .weave-kanban-board.layout-spacious :global(.grid-card--kanban) {
    margin-bottom: 1rem;
    padding: 1rem;
    min-height: 220px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-kanban-board.layout-spacious :global(.grid-card--kanban .content-area) {
    max-height: 280px;
    font-size: 1.05rem;
    line-height: 1.6;
  }

  /* 拖拽容器也需要过渡动画 */
  .weave-kanban-card-wrapper {
    transition: margin 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .weave-load-more-container {
    display: flex;
    justify-content: center;
    padding: 0.75rem;
    margin-top: 0.5rem;
  }

  .weave-load-more-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .weave-load-more-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateY(-1px);
  }

  .weave-load-more-btn:active {
    transform: translateY(0);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .weave-kanban-board {
      padding: 0.5rem;
    }

    .weave-kanban-column {
      flex: 0 0 280px;
      min-width: 280px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .weave-load-more-btn,
    .weave-drop-indicator,
    .weave-column-content,
    .weave-kanban-card-wrapper,
    .weave-kanban-board,
    .weave-kanban-column {
      animation: none;
      transition: none;
    }
  }

  /* 列管理菜单样式 */
  /* ==================== Notion风格菜单样式 ==================== */
  
  .weave-column-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent;
    z-index: var(--weave-z-overlay);
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 3.5rem 1rem 1rem 1rem;
    pointer-events: none;
  }

  .weave-column-menu {
    width: 280px;
    max-height: calc(100vh - 6rem);
    background: var(--background-primary);
    border-radius: 8px;
    box-shadow: 
      0 0 0 1px var(--background-modifier-border),
      0 3px 6px rgba(0, 0, 0, 0.1),
      0 9px 24px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    pointer-events: auto;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Notion标题栏 */
  .notion-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px 6px 14px;
    border-bottom: 1px solid var(--background-modifier-border);
    height: 38px;
    flex-shrink: 0;
  }

  .notion-menu-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .notion-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .notion-close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* Notion选项行 */
  .notion-menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    min-height: 32px;
    font-size: 13px;
    transition: background 0.12s ease;
  }

  .notion-menu-row--clickable {
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .notion-menu-row--clickable:hover {
    background: var(--background-modifier-hover);
  }

  .notion-menu-row--option {
    cursor: pointer;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background 0.12s ease;
  }

  .notion-menu-row--option:hover {
    background: var(--background-modifier-hover);
  }

  .notion-menu-row--selected {
    background: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
  }

  .notion-menu-row--danger {
    color: var(--text-error);
  }

  .notion-menu-row--danger:hover {
    background: color-mix(in srgb, var(--text-error) 10%, transparent);
  }

  .notion-option-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .notion-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-normal);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.12s ease;
  }

  .notion-back-btn:hover {
    color: var(--text-accent);
  }

  .notion-menu-label {
    color: var(--text-normal);
    font-weight: 400;
  }

  .notion-menu-value {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 13px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.12s ease;
  }

  /* Notion分隔线 */
  .notion-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 0;
  }

  /* Notion Toggle开关（紧凑版） */
  .notion-toggle-mini {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 8px;
    background: var(--interactive-normal);
    cursor: pointer;
    transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    border: none;
    padding: 0;
  }

  .notion-toggle-mini:hover {
    background: var(--interactive-hover);
  }

  .notion-toggle-mini.active {
    background: var(--interactive-accent);
  }

  .notion-toggle-mini.active:hover {
    background: var(--interactive-accent-hover);
  }

  .notion-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .notion-toggle-mini.active .notion-toggle-thumb {
    transform: translateX(12px);
  }

  /* Notion分组标题 */
  .notion-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px 4px 14px;
    margin-top: 4px;
  }

  .notion-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
  }

  .notion-section-action {
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .notion-section-action:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .notion-action-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .notion-separator {
    color: var(--text-faint);
    font-size: 12px;
    margin: 0 2px;
  }

  /* Notion列表内容区域 */
  .notion-menu-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px;
  }

  /* Notion群组列表项 */
  .notion-group-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 4px;
    margin: 0 2px;
    border-radius: 4px;
    font-size: 13px;
    cursor: grab;
    transition: background 0.12s ease;
  }

  .notion-group-item:hover {
    background: var(--background-modifier-hover);
  }

  .notion-group-item.dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  .notion-group-item.drag-over {
    border-top: 2px solid var(--interactive-accent);
  }

  /* Notion拖拽手柄（文本符号） */
  .notion-drag-handle {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    font-size: 10px;
    letter-spacing: -1px;
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }

  .notion-group-item:hover .notion-drag-handle {
    color: var(--text-muted);
  }

  .notion-group-item.dragging .notion-drag-handle {
    cursor: grabbing;
  }

  /* Notion群组名称 */
  .notion-group-name {
    flex: 1;
    color: var(--text-normal);
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Notion操作按钮组 */
  .notion-group-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }


  /* Notion图标按钮 */
  .notion-icon-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    transition: all 0.12s ease;
    opacity: 0.6;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
  }

  .notion-icon-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    opacity: 1;
  }

  .notion-icon-btn.active {
    color: var(--interactive-accent);
    opacity: 1;
  }

  .notion-separator {
    color: var(--text-faint);
    user-select: none;
  }

  /* 排序规则列表样式 */
  .notion-sort-rules-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 6px;
  }

  .notion-sort-rule-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    margin: 0 2px;
    border-radius: 4px;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    cursor: grab;
    transition: all 0.12s ease;
  }

  .notion-sort-rule-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .notion-sort-rule-item.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .notion-sort-rule-item.drag-over {
    border-top: 2px solid var(--interactive-accent);
    margin-top: 4px;
  }

  .notion-sort-rule-content {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
  }

  .notion-sort-direction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .notion-sort-direction-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .notion-sort-option-group {
    margin: 2px 0;
  }

  .notion-sort-direction-options {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .notion-direction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: none;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .notion-direction-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .notion-direction-btn:active {
    transform: scale(0.95);
  }

</style>
