<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount } from 'svelte';
  import { Menu, Notice } from 'obsidian';
  import type { Deck, DeckStats } from '../../data/types';
  import type { DeckTreeNode } from '../../services/deck/DeckHierarchyService';
  import type { StudySession } from '../../data/study-types';
  import type { WeavePlugin } from '../../main';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import CategoryFilter, { type DeckFilter } from './CategoryFilter.svelte';
  import MultiSegmentProgressBar from './MultiSegmentProgressBar.svelte';
  import DeckStatsPopover from './DeckStatsPopover.svelte';
  //  导入国际化
  import { tr } from '../../utils/i18n';
  
  interface Props {
    deckTree: DeckTreeNode[];
    deckStats: Record<string, DeckStats>;
    studySessions: StudySession[];
    plugin: WeavePlugin;
    onStartStudy: (deckId: string) => void;
    onContinueStudy: () => void;
    // 🆕 菜单操作回调
    onCreateSubdeck?: (deckId: string) => void;
    onMoveDeck?: (deckId: string) => void;
    onEditDeck?: (deckId: string) => void;
    onDeleteDeck?: (deckId: string) => void;
    onRefreshData?: () => Promise<void>;
  }
  
  let { 
    deckTree, 
    deckStats, 
    studySessions, 
    plugin, 
    onStartStudy, 
    onContinueStudy,
    onCreateSubdeck,
    onMoveDeck,
    onEditDeck,
    onDeleteDeck,
    onRefreshData
  }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);
  
  // 🆕 牌组类型筛选状态
  let selectedFilter = $state<DeckFilter>('all');
  
  // 🆕 浮窗状态
  let showPopover = $state(false);
  let popoverDeckId = $state<string | null>(null);
  let popoverPosition = $state({ x: 0, y: 0 });
  
  // 🆕 计算当前过滤后牌组名的最大宽度
  const maxDeckNameWidth = $derived(() => {
    const decks = filteredDecks();
    if (decks.length === 0) return 200; // 默认最小宽度
    
    // 创建临时元素测量文本宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 250;
    
    // 使用与界面相同的字体设置
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    let maxWidth = 0;
    decks.forEach(deck => {
      const indentWidth = (deck.level || 0) * 24; // 缩进宽度
      const iconWidth = 28; // 图标 + 间距宽度
      const textWidth = ctx.measureText(deck.name).width;
      const totalWidth = indentWidth + iconWidth + textWidth + 20; // 额外20px padding
      maxWidth = Math.max(maxWidth, totalWidth);
    });
    
    // 限制在合理范围内
    return Math.min(Math.max(maxWidth, 200), 400);
  });
  
  // 🆕 初始化筛选器
  onMount(() => {
    // 恢复上次选择的筛选器
    const savedFilter = localStorage.getItem('weave-deck-filter') as DeckFilter;
    if (savedFilter && ['parent', 'child', 'all'].includes(savedFilter)) {
      selectedFilter = savedFilter;
    }
    logger.debug('[DashboardView] 筛选器初始化:', selectedFilter);
  });
  
  // 🆕 筛选器选择处理
  function handleFilterSelect(filter: DeckFilter) {
    selectedFilter = filter;
    localStorage.setItem('weave-deck-filter', filter);
    logger.debug('[DashboardView] 切换筛选器:', filter);
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
  
  // 判断牌组是否为父卡片牌组
  function isParentCardDeck(deck: Deck): boolean {
    // 检查 metadata 中的 pairedChildDeck 字段
    return deck.metadata?.pairedChildDeck != null;
  }
  
  // 判断牌组是否为子卡片牌组
  function isChildCardDeck(deck: Deck): boolean {
    // 检查 metadata 中的 pairedParentDeck 字段
    return deck.metadata?.pairedParentDeck != null;
  }
  
  // 🆕 分类列表（空数组，如果需要可以后续添加）
  const categories: Array<{ id: string; name: string }> = [];

  // 🆕 根据类型筛选牌组
  const filteredDecks = $derived(() => {
    if (selectedFilter === 'all') {
      return allDecks;
    } else if (selectedFilter === 'parent') {
      return allDecks.filter(deck => isParentCardDeck(deck));
    } else if (selectedFilter === 'child') {
      return allDecks.filter(deck => isChildCardDeck(deck));
    }
    return allDecks;
  });
  
  function getTotalDue(deckId: string): number {
    const stats = deckStats[deckId];
    return (stats?.newCards ?? 0) + (stats?.learningCards ?? 0) + (stats?.reviewCards ?? 0);
  }
  
  // 🆕 获取牌组总卡片数
  function getTotalCards(deckId: string): number {
    const stats = deckStats[deckId];
    if (!stats) return 0;
    
    // 使用DeckStats接口中的totalCards字段
    return stats.totalCards ?? 0;
  }
  
  // 🆕 获取今日学习数据
  function getTodayStudyData(deckId: string): { studyTime: number; reviewed: number } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todaySessions = studySessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      return s.deckId === deckId && sessionDate >= today && sessionDate <= todayEnd;
    });
    
    const studyTime = todaySessions.reduce((sum, s) => sum + (s.totalTime || 0), 0) / 1000; // 转换为秒
    const reviewed = todaySessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
    
    return { studyTime, reviewed };
  }
  
  // 🆕 处理进度条点击（智能定位）
  function handleProgressClick(event: MouseEvent, deckId: string) {
    // Svelte 5: 移除 stopPropagation
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popoverWidth = 300; // 浮窗预估宽度
    
    // 智能 X 定位：
    // 1. 优先显示在进度条左侧（左对齐）
    // 2. 如果右侧空间不足（< popoverWidth + 20），则右对齐到进度条右侧
    // 3. 如果整体空间都不足，居中显示
    let x = rect.left;
    
    // 检查右侧空间
    if (rect.left + popoverWidth > viewportWidth - 20) {
      // 右侧空间不足，尝试右对齐
      x = rect.right - popoverWidth;
      
      // 如果左侧也不够，强制在可视范围内
      if (x < 20) {
        x = Math.max(20, (viewportWidth - popoverWidth) / 2);
      }
    }
    
    popoverPosition = {
      x,
      y: rect.bottom + 8
    };
    
    popoverDeckId = deckId;
    showPopover = true;
  }
  
  // 🆕 关闭浮窗
  function handleClosePopover() {
    showPopover = false;
    popoverDeckId = null;
  }
  
  // 🆕 显示牌组菜单
  function showDeckMenu(event: MouseEvent, deckId: string) {
    const menu = new Menu();
    
    const deck = allDecks.find(d => d.id === deckId);
    const isSubdeck = deck?.parentId != null;
    
    // 创建子牌组
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.createSubdeck'))
        .setIcon("folder-plus")
        .onClick(() => onCreateSubdeck?.(deckId))
    );
    
    // 移动牌组
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.moveDeck'))
        .setIcon("move")
        .onClick(() => onMoveDeck?.(deckId))
    );
    
    // 移动分类（仅父牌组可用）
    menu.addItem((item) => {
      item
        .setTitle(t('decks.menu.moveCategory'))
        .setIcon("tag");
      
      if (isSubdeck) {
        item.setDisabled(true);
      } else {
        item.onClick((e) => {
          showCategoryMenu(e as any, deckId);
        });
      }
      
      return item;
    });
    
    menu.addSeparator();
    
    // 编辑
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.edit'))
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
    
    menu.addSeparator();
    
    // 分析
    
    menu.showAtMouseEvent(event);
  }
  
  // 🆕 显示分类菜单
  function showCategoryMenu(event: MouseEvent, deckId: string) {
    const deck = allDecks.find(d => d.id === deckId);
    if (!deck) return;
    
    const menu = new Menu();
    
    categories.forEach((cat: { id: string; name: string }) => {
      menu.addItem((item) => {
        const isSelected = deck.categoryIds?.includes(cat.id) || false;
        item
          .setTitle(cat.name)
          .setChecked(isSelected)
          .onClick(async () => {
            // 切换分类选择
            let newCategoryIds: string[] = [];
            if (deck.categoryIds && deck.categoryIds.length > 0) {
              if (isSelected) {
                // 取消选择（至少保留一个分类）
                newCategoryIds = deck.categoryIds.filter(id => id !== cat.id);
                if (newCategoryIds.length === 0) {
                  new Notice('至少需要保留一个分类');
                  return;
                }
              } else {
                // 添加选择
                newCategoryIds = [...deck.categoryIds, cat.id];
              }
            } else {
              // 首次添加分类
              newCategoryIds = [cat.id];
            }
            
            // 保存更新
            deck.categoryIds = newCategoryIds;
            await plugin.dataStorage.saveDeck(deck);
            if (onRefreshData) {
              await onRefreshData();
            }
            new Notice(`已更新分类`);
          });
      });
    });
    
    menu.showAtMouseEvent(event);
  }
  
  // 今日统计（从真实数据计算）
  const todayStats = $derived(() => {
    const total = allDecks.reduce((sum, d) => sum + getTotalDue(d.id), 0);
    
    // 计算今日已完成的卡片数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todaySessions = studySessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      return sessionDate >= today && sessionDate <= todayEnd;
    });
    
    const completed = todaySessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
    const totalTime = todaySessions.reduce((sum, s) => sum + (s.totalTime || 0), 0);
    const durationMinutes = Math.round(totalTime / 60000); // 毫秒转分钟
    const duration = durationMinutes > 0 ? `${durationMinutes}分钟` : '0分钟';
    
    return {
      total,
      completed,
      duration
    };
  });
  
  const progress = $derived(() => {
    const stats = todayStats();
    if (stats.total === 0 && stats.completed === 0) return 0;
    if (stats.total === 0) return 100;
    return Math.round((stats.completed / (stats.total + stats.completed)) * 100);
  });
  
  //  牌组热力数据（基于过滤后的牌组）
  const maxDue = $derived(() => {
    const decks = filteredDecks();
    if (decks.length === 0) return 1;
    return Math.max(...decks.map(d => getTotalDue(d.id)), 1);
  });
</script>

<div class="dashboard-view">
  <!-- 🆕 彩色圆点牌组类型筛选器 -->
  <CategoryFilter 
    {selectedFilter}
    onSelect={handleFilterSelect}
  />
  
  <!-- 牌组热力图 -->
  <div class="dashboard-section heatmap">
    <h3 class="section-title">
      <EnhancedIcon name="bar-chart-2" size={18} />
      牌组热力图
      {#if selectedFilter !== 'all'}
        {@const filterNames = { parent: '父卡片牌组', child: '子卡片牌组', all: '全部牌组' } as Record<DeckFilter, string>}
        {@const filterColors = { 
          parent: { start: '#ef4444', end: '#dc2626' },
          child: { start: '#3b82f6', end: '#2563eb' },
          all: { start: '#f59e0b', end: '#d97706' }
        } as Record<DeckFilter, { start: string; end: string }>}
        <span class="category-badge" style="background: linear-gradient(135deg, {filterColors[selectedFilter].start}, {filterColors[selectedFilter].end})">
          {filterNames[selectedFilter]}
        </span>
      {/if}
    </h3>
    
    <div class="heatmap-list">
      {#if filteredDecks().length === 0}
        <!-- 🆕 紧凑的空状态提示（不阻挡点击） -->
        <div class="empty-hint-inline">
          <span class="empty-hint-icon">--</span>
          <span class="empty-hint-text">{t('decks.dashboard.emptyHint')}</span>
        </div>
      {:else}
        {#each filteredDecks() as deck (deck.id)}
          {@const total = getTotalDue(deck.id)}
          {@const intensity = total / maxDue()}
          {@const isSubdeck = deck.parentId != null}
          {@const indentLevel = deck.level || 0}
          <div class="heatmap-row" class:subdeck={isSubdeck} style="--deck-name-width: {maxDeckNameWidth()}px">
            <div class="deck-info" style="--indent-level: {indentLevel}">
              <span class="deck-icon">{#if deck.icon}{deck.icon}{:else}<EnhancedIcon name="folder" size={16} />{/if}</span>
              <span class="deck-name" title={deck.name}>{deck.name}</span>
            </div>
            <MultiSegmentProgressBar
              newCards={deckStats[deck.id]?.newCards ?? 0}
              learningCards={deckStats[deck.id]?.learningCards ?? 0}
              reviewCards={deckStats[deck.id]?.reviewCards ?? 0}
              totalCards={getTotalCards(deck.id)}
              deckName={deck.name}
              onClick={(e) => handleProgressClick(e, deck.id)}
            />
            <span class="count">{total} {t('decks.dashboard.unit')}</span>
            <div class="deck-actions">
              <button 
                class="action-btn"
                class:completed={total === 0}
                onclick={() => onStartStudy(deck.id)}
                title={total === 0 ? t('decks.dashboard.viewCelebration') : t('decks.dashboard.startStudy')}
              >
              {#if total > 0}
                {t('decks.dashboard.study')}
              {:else}
                {t('decks.dashboard.completed')}
              {/if}
              </button>
              <button 
                class="menu-btn"
                onclick={(e) => {
            e.preventDefault();
            showDeckMenu(e, deck.id);
          }}
                aria-label={t('decks.dashboard.moreActions')}
                title={t('decks.dashboard.moreActions')}
              >
                <EnhancedIcon name="more-horizontal" size={16} />
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<!-- 🆕 统计浮窗（直接渲染，高 z-index） -->
{#if showPopover && popoverDeckId}
  {@const deck = allDecks.find(d => d.id === popoverDeckId)}
  {@const stats = deckStats[popoverDeckId]}
  {@const todayData = getTodayStudyData(popoverDeckId)}
  {#if deck && stats}
    {@const deckId = deck.id}
    <DeckStatsPopover
      newCards={stats.newCards}
      learningCards={stats.learningCards}
      reviewCards={stats.reviewCards}
      totalCards={getTotalCards(deckId)}
      memoryRate={stats.memoryRate}
      deckName={deck.name}
      todayStudyTime={todayData.studyTime}
      todayReviewed={todayData.reviewed}
      position={popoverPosition}
      onClose={handleClosePopover}
    />
  {/if}
{/if}

<style>
  .dashboard-view {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }
  
  
  .dashboard-section {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 20px;
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0 0 16px 0;
  }
  
  /* 🆕 分类徽章 */
  .category-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    margin-left: 8px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  /* 🆕 紧凑的内联空状态提示（不阻挡点击） */
  .empty-hint-inline {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px dashed var(--background-modifier-border);
    margin: 8px 0;
  }
  
  .empty-hint-icon {
    font-size: 24px;
    opacity: 0.6;
    flex-shrink: 0;
  }
  
  .empty-hint-text {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }
  
  .heatmap-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .heatmap-row {
    display: grid;
    grid-template-columns: var(--deck-name-width, 250px) 1fr auto auto; /* 🆕 动态宽度 | 进度条 | 计数 | 操作区 */
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: var(--background-primary);
    border-radius: 8px;
    transition: all 0.2s;
  }
  
  .heatmap-row:hover {
    background: var(--background-modifier-hover);
  }
  
  /* 🆕 子牌组样式 */
  .heatmap-row.subdeck {
    background: var(--background-secondary);
  }
  
  /* 🆕 牌组信息区（图标+名称） */
  .deck-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: calc(var(--indent-level, 0) * 24px); /* 整个信息区缩进 */
    overflow: hidden; /* 防止缩进影响布局 */
  }
  
  .heatmap-row.subdeck .deck-name {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .heatmap-row.subdeck .deck-icon {
    font-size: 14px;
    opacity: 0.8;
  }
  
  .deck-icon {
    font-size: 16px;
    flex-shrink: 0; /* 防止图标被压缩 */
  }
  
  .deck-name {
    font-size: 13px;
    color: var(--text-normal);
    overflow: hidden; /* 🆕 隐藏溢出 */
    text-overflow: ellipsis; /* 🆕 省略号 */
    white-space: nowrap; /* 🆕 不换行 */
    flex: 1; /* 占据剩余空间 */
  }
  
  .count {
    min-width: 60px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
    text-align: right;
  }
  
  .action-btn {
    padding: 6px 12px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .action-btn:hover {
    background: var(--interactive-accent-hover);
  }
  
  /*  完成状态按钮 */
  .action-btn.completed {
    background: var(--background-secondary);
    color: var(--text-success);
    border: 1px solid var(--text-success);
  }
  
  .action-btn.completed:hover {
    background: rgba(16, 185, 129, 0.1);
    transform: translateY(-1px);
  }
  
  /* 🆕 操作区样式 */
  .deck-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .menu-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .menu-btn:active {
    transform: scale(0.95);
  }
  
  /* 响应式 - 移除不需要的样式 */
</style>

