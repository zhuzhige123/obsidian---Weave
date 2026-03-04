<script lang="ts">
  /**
   * ContentListView - 统一内容列表视图
   * 
   * 在统一视图中展示卡片和增量阅读内容块
   * - 支持筛选和排序
   * - 支持批量操作
   * - 响应式设计
   */
  import { onMount } from 'svelte';
  import { Notice } from 'obsidian';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import EnhancedButton from '../ui/EnhancedButton.svelte';
  import type { WeavePlugin } from '../../main';
  import type { 
    ContentItem, 
    ContentItemFilter, 
    ContentItemSort,
    ContentItemStats,
    ContentItemType,
    ContentItemState
  } from '../../types/content-item-types';
  import { ContentItemService } from '../../services/ContentItemService';
  import { logger } from '../../utils/logger';

  interface Props {
    plugin: WeavePlugin;
    initialFilter?: ContentItemFilter;
    searchQuery?: string;           // 从父组件接收搜索查询
    viewMode?: 'list' | 'grid';     // 从父组件接收视图模式
    showToolbar?: boolean;          // 是否显示内置工具栏（默认false，复用父组件工具栏）
    onItemClick?: (item: ContentItem) => void;
    onItemAction?: (action: string, item: ContentItem) => void;
  }

  let {
    plugin,
    initialFilter = {},
    searchQuery: externalSearchQuery = '',
    viewMode: externalViewMode = 'list',
    showToolbar = false,            // 默认不显示内置工具栏
    onItemClick,
    onItemAction
  }: Props = $props();

  // 服务实例
  let service: ContentItemService | null = $state(null);

  // 数据状态
  let items: ContentItem[] = $state([]);
  let stats: ContentItemStats | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // 筛选状态
  let filter: ContentItemFilter = $state({ ...initialFilter });
  let sort: ContentItemSort = $state({ field: 'updatedAt', direction: 'desc' });
  let internalSearchQuery = $state('');  // 内部搜索状态（showToolbar=true时使用）

  // 选择状态
  let selectedIds = $state<Set<string>>(new Set());
  let selectAll = $state(false);

  // 视图状态 - 优先使用外部传入的值
  let internalViewMode = $state<'list' | 'grid'>('list');
  let showFilters = $state(false);
  
  // 实际使用的搜索查询和视图模式
  const searchQuery = $derived(showToolbar ? internalSearchQuery : externalSearchQuery);
  const viewMode = $derived(showToolbar ? internalViewMode : externalViewMode);

  // 派生状态
  const selectedCount = $derived(selectedIds.size);
  const hasSelection = $derived(selectedIds.size > 0);

  // 初始化
  onMount(async () => {
    try {
      service = new ContentItemService(plugin.app);
      await loadItems();
    } catch (e) {
      error = '加载失败';
      logger.error('[ContentListView] 初始化失败:', e);
    }
  });

  // 加载数据
  async function loadItems() {
    if (!service) return;
    
    loading = true;
    error = null;
    
    try {
      // 合并搜索查询到筛选条件
      const currentFilter = { ...filter };
      if (searchQuery.trim()) {
        currentFilter.searchQuery = searchQuery.trim();
      }
      
      items = await service.getFilteredItems(currentFilter, sort);
      stats = await service.getStats(currentFilter);
      
      logger.debug(`[ContentListView] 加载 ${items.length} 个内容项`);
    } catch (e) {
      error = '加载数据失败';
      logger.error('[ContentListView] 加载失败:', e);
    } finally {
      loading = false;
    }
  }

  // 筛选类型
  function toggleTypeFilter(type: ContentItemType) {
    const types = filter.types ? [...filter.types] : [];
    const index = types.indexOf(type);
    
    if (index >= 0) {
      types.splice(index, 1);
    } else {
      types.push(type);
    }
    
    filter = { ...filter, types: types.length > 0 ? types : undefined };
    loadItems();
  }

  // 筛选状态
  function toggleStateFilter(state: ContentItemState) {
    const states = filter.states ? [...filter.states] : [];
    const index = states.indexOf(state);
    
    if (index >= 0) {
      states.splice(index, 1);
    } else {
      states.push(state);
    }
    
    filter = { ...filter, states: states.length > 0 ? states : undefined };
    loadItems();
  }

  // 切换收藏筛选
  function toggleFavoriteFilter() {
    filter = { ...filter, favoriteOnly: !filter.favoriteOnly };
    loadItems();
  }

  // 切换今日到期筛选
  function toggleDueTodayFilter() {
    filter = { ...filter, dueToday: !filter.dueToday };
    loadItems();
  }

  // 更改排序
  function changeSort(field: ContentItemSort['field']) {
    if (sort.field === field) {
      sort = { ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
    } else {
      sort = { field, direction: 'desc' };
    }
    loadItems();
  }

  // 搜索
  function handleSearch() {
    loadItems();
  }

  // 清除搜索
  function clearSearch() {
    internalSearchQuery = '';
    loadItems();
  }

  // 选择项目
  function toggleSelection(uuid: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(uuid)) {
      newSet.delete(uuid);
    } else {
      newSet.add(uuid);
    }
    selectedIds = newSet;
    selectAll = selectedIds.size === items.length;
  }

  // 全选/取消全选
  function toggleSelectAll() {
    if (selectAll) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(items.map(i => i.uuid));
    }
    selectAll = !selectAll;
  }

  // 清除选择
  function clearSelection() {
    selectedIds = new Set();
    selectAll = false;
  }

  // 批量操作：切换收藏
  async function batchToggleFavorite() {
    if (!service || selectedIds.size === 0) return;
    
    try {
      for (const uuid of selectedIds) {
        await service.toggleFavorite(uuid);
      }
      new Notice(`已更新 ${selectedIds.size} 个项目`);
      clearSelection();
      await loadItems();
    } catch (e) {
      new Notice('操作失败');
    }
  }

  // 批量操作：添加标签
  async function batchAddTag(tag: string) {
    if (!service || selectedIds.size === 0 || !tag.trim()) return;
    
    try {
      await service.addTags(Array.from(selectedIds), [tag.trim()]);
      new Notice(`已添加标签到 ${selectedIds.size} 个项目`);
      clearSelection();
      await loadItems();
    } catch (e) {
      new Notice('操作失败');
    }
  }

  // 点击项目
  function handleItemClick(item: ContentItem) {
    onItemClick?.(item);
  }

  // 项目操作
  function handleAction(action: string, item: ContentItem) {
    onItemAction?.(action, item);
  }

  // 获取类型图标
  function getTypeIcon(type: ContentItemType): string {
    return type === 'card' ? 'credit-card' : 'book-open';
  }

  // 获取状态颜色
  function getStateColor(state: ContentItemState): string {
    switch (state) {
      case 'new': return 'var(--text-accent)';
      case 'learning': return 'var(--text-warning)';
      case 'review': return 'var(--text-success)';
      case 'suspended': return 'var(--text-muted)';
      default: return 'var(--text-normal)';
    }
  }

  // 获取状态文本
  function getStateText(state: ContentItemState): string {
    switch (state) {
      case 'new': return '新';
      case 'learning': return '学习中';
      case 'review': return '复习';
      case 'suspended': return '已暂停';
      default: return state;
    }
  }

  // 获取优先级文本
  function getPriorityText(priority: number): string {
    switch (priority) {
      case 1: return '高';
      case 2: return '中';
      case 3: return '低';
      default: return '中';
    }
  }

  // 格式化日期
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  }
</script>

<div class="content-list-view">
  <!-- 工具栏 - 仅在showToolbar=true时显示（独立使用时），否则复用父组件工具栏 -->
  {#if showToolbar}
  <div class="toolbar">
    <!-- 搜索 -->
    <div class="search-box">
      <EnhancedIcon name="search" size={16} />
      <input 
        type="text" 
        placeholder="搜索内容..."
        bind:value={internalSearchQuery}
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      {#if internalSearchQuery}
        <button class="clear-btn" onclick={clearSearch}>
          <EnhancedIcon name="x" size={14} />
        </button>
      {/if}
    </div>

    <!-- 筛选按钮 -->
    <button 
      class="filter-toggle"
      class:active={showFilters}
      onclick={() => showFilters = !showFilters}
    >
      <EnhancedIcon name="filter" size={16} />
      筛选
    </button>

    <!-- 视图切换 -->
    <div class="view-toggle">
      <button 
        class:active={internalViewMode === 'list'}
        onclick={() => internalViewMode = 'list'}
      >
        <EnhancedIcon name="list" size={16} />
      </button>
      <button 
        class:active={internalViewMode === 'grid'}
        onclick={() => internalViewMode = 'grid'}
      >
        <EnhancedIcon name="grid" size={16} />
      </button>
    </div>

    <!-- 刷新 -->
    <button class="refresh-btn" onclick={loadItems}>
      <EnhancedIcon name="refresh-cw" size={16} />
    </button>
  </div>
  {/if}

  <!-- 筛选面板 - 仅在showToolbar=true且showFilters时显示 -->
  {#if showToolbar && showFilters}
    <div class="filter-panel">
      <!-- 类型筛选 -->
      <div class="filter-group">
        <span class="filter-label">类型</span>
        <div class="filter-options">
          <button 
            class:active={filter.types?.includes('card')}
            onclick={() => toggleTypeFilter('card')}
          >
            <EnhancedIcon name="credit-card" size={14} />
            卡片
          </button>
          <button 
            class:active={filter.types?.includes('ir-block')}
            onclick={() => toggleTypeFilter('ir-block')}
          >
            <EnhancedIcon name="book-open" size={14} />
            内容块
          </button>
        </div>
      </div>

      <!-- 状态筛选 -->
      <div class="filter-group">
        <span class="filter-label">状态</span>
        <div class="filter-options">
          {#each ['new', 'learning', 'review', 'suspended'] as state}
            <button 
              class:active={filter.states?.includes(state as ContentItemState)}
              onclick={() => toggleStateFilter(state as ContentItemState)}
            >
              {getStateText(state as ContentItemState)}
            </button>
          {/each}
        </div>
      </div>

      <!-- 快速筛选 -->
      <div class="filter-group">
        <span class="filter-label">快速筛选</span>
        <div class="filter-options">
          <button 
            class:active={filter.favoriteOnly}
            onclick={toggleFavoriteFilter}
          >
            <EnhancedIcon name="star" size={14} />
            收藏
          </button>
          <button 
            class:active={filter.dueToday}
            onclick={toggleDueTodayFilter}
          >
            <EnhancedIcon name="clock" size={14} />
            今日到期
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 统计栏 - 仅在showToolbar=true时显示 -->
  {#if showToolbar && stats}
    <div class="stats-bar">
      <span class="stat-item">
        共 <strong>{stats.total}</strong> 项
      </span>
      <span class="stat-item">
        卡片 <strong>{stats.byType['card']}</strong>
      </span>
      <span class="stat-item">
        内容块 <strong>{stats.byType['ir-block']}</strong>
      </span>
      <span class="stat-item">
        今日到期 <strong>{stats.dueToday}</strong>
      </span>
    </div>
  {/if}

  <!-- 批量操作栏 -->
  {#if hasSelection}
    <div class="batch-actions">
      <span class="selection-info">
        已选择 {selectedCount} 项
      </span>
      <button onclick={batchToggleFavorite}>
        <EnhancedIcon name="star" size={14} />
        切换收藏
      </button>
      <button onclick={clearSelection}>
        取消选择
      </button>
    </div>
  {/if}

  <!-- 内容列表 -->
  <div class="content-list" class:grid-view={viewMode === 'grid'}>
    {#if loading}
      <div class="loading-state">
        <EnhancedIcon name="loader" size={24} />
        <span>加载中...</span>
      </div>
    {:else if error}
      <div class="error-state">
        <EnhancedIcon name="alert-circle" size={24} />
        <span>{error}</span>
        <button onclick={loadItems}>重试</button>
      </div>
    {:else if items.length === 0}
      <div class="empty-state">
        <EnhancedIcon name="inbox" size={48} />
        <span>暂无内容</span>
      </div>
    {:else}
      <!-- 列表头 -->
      {#if viewMode === 'list'}
        <div class="list-header">
          <div class="col-select">
            <input 
              type="checkbox" 
              checked={selectAll}
              onchange={toggleSelectAll}
            />
          </div>
          <div class="col-type">类型</div>
          <div class="col-title" onclick={() => changeSort('title')}>
            标题
            {#if sort.field === 'title'}
              <EnhancedIcon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} />
            {/if}
          </div>
          <div class="col-state">状态</div>
          <div class="col-priority" onclick={() => changeSort('priority')}>
            优先级
            {#if sort.field === 'priority'}
              <EnhancedIcon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} />
            {/if}
          </div>
          <div class="col-next-review" onclick={() => changeSort('nextReview')}>
            下次复习
            {#if sort.field === 'nextReview'}
              <EnhancedIcon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} />
            {/if}
          </div>
          <div class="col-actions">操作</div>
        </div>
      {/if}

      <!-- 列表项 -->
      {#each items as item (item.uuid)}
        <div 
          class="content-item"
          class:selected={selectedIds.has(item.uuid)}
          onclick={() => handleItemClick(item)}
        >
          {#if viewMode === 'list'}
            <!-- 列表模式 -->
            <div class="col-select" onclick={(e) => { e.stopPropagation(); toggleSelection(item.uuid); }}>
              <input 
                type="checkbox" 
                checked={selectedIds.has(item.uuid)}
              />
            </div>
            <div class="col-type">
              <EnhancedIcon name={getTypeIcon(item.type)} size={16} />
            </div>
            <div class="col-title">
              <span class="title-text">{item.title}</span>
              {#if item.favorite}
                <EnhancedIcon name="star" size={12} class="favorite-icon" />
              {/if}
              {#if item.tags.length > 0}
                <span class="tags">
                  {#each item.tags.slice(0, 3) as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                </span>
              {/if}
            </div>
            <div class="col-state">
              <span class="state-badge" style="color: {getStateColor(item.state)}">
                {getStateText(item.state)}
              </span>
            </div>
            <div class="col-priority">
              {getPriorityText(item.priority)}
            </div>
            <div class="col-next-review">
              {formatDate(item.nextReview)}
            </div>
            <div class="col-actions" onclick={(e) => e.stopPropagation()}>
              <button onclick={() => handleAction('open', item)} title="打开">
                <EnhancedIcon name="external-link" size={14} />
              </button>
              <button onclick={() => handleAction('favorite', item)} title="收藏">
                <EnhancedIcon name={item.favorite ? 'star' : 'star'} size={14} />
              </button>
            </div>
          {:else}
            <!-- 网格模式 -->
            <div class="grid-card">
              <div class="card-header">
                <EnhancedIcon name={getTypeIcon(item.type)} size={16} />
                <span class="state-badge" style="color: {getStateColor(item.state)}">
                  {getStateText(item.state)}
                </span>
                {#if item.favorite}
                  <EnhancedIcon name="star" size={14} class="favorite-icon" />
                {/if}
              </div>
              <div class="card-title">{item.title}</div>
              <div class="card-preview">{item.contentPreview}</div>
              <div class="card-footer">
                <span class="next-review">{formatDate(item.nextReview)}</span>
                <span class="priority">P{item.priority}</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .content-list-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-primary);
  }

  .toolbar {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    align-items: center;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .search-box input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
  }

  .clear-btn {
    padding: 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0.6;
  }

  .filter-toggle,
  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--background-secondary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .filter-toggle.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .view-toggle {
    display: flex;
    background: var(--background-secondary);
    border-radius: 6px;
    overflow: hidden;
  }

  .view-toggle button {
    padding: 6px 10px;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .view-toggle button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .filter-panel {
    padding: 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .filter-options {
    display: flex;
    gap: 4px;
  }

  .filter-options button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .filter-options button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .stats-bar {
    display: flex;
    gap: 16px;
    padding: 8px 12px;
    background: var(--background-secondary-alt);
    font-size: 12px;
  }

  .stat-item strong {
    color: var(--text-accent);
  }

  .batch-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .batch-actions button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 4px;
    color: inherit;
    cursor: pointer;
  }

  .content-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .content-list.grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }

  .list-header {
    display: flex;
    padding: 8px 12px;
    background: var(--background-secondary);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .content-item {
    display: flex;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .content-item:hover {
    background: var(--background-secondary);
  }

  .content-item.selected {
    background: var(--background-modifier-active-hover);
  }

  .col-select { width: 32px; }
  .col-type { width: 40px; }
  .col-title { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .col-state { width: 80px; }
  .col-priority { width: 60px; }
  .col-next-review { width: 100px; }
  .col-actions { width: 80px; display: flex; gap: 4px; }

  .title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .favorite-icon {
    color: var(--text-warning);
  }

  .tags {
    display: flex;
    gap: 4px;
  }

  .tag {
    padding: 2px 6px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    font-size: 10px;
  }

  .state-badge {
    font-size: 12px;
    font-weight: 500;
  }

  .col-actions button {
    padding: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0.6;
  }

  .col-actions button:hover {
    opacity: 1;
  }

  /* 网格卡片样式 */
  .grid-card {
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-preview {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }

  /* 状态提示 */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    color: var(--text-muted);
  }

  .error-state button {
    padding: 6px 16px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
