<!--
  增量阅读材料调度甘特图组件
  显示阅读材料的调度安排
  - X轴: 日期时间线
  - Y轴: 材料列表（按优先级排序）
  - 支持标签筛选
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type AnkiObsidianPlugin from '../../main';
  import type { IRDeck, IRBlock, IRChunkFileData } from '../../types/ir-types';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { logger } from '../../utils/logger';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  interface Props {
    plugin: AnkiObsidianPlugin;
    allDecks: IRDeck[];
    selectedDeckIds: Set<string>;
    showGlobalLoad: boolean;
  }

  let { plugin, allDecks, selectedDeckIds, showGlobalLoad }: Props = $props();

  // 时间范围
  let daysToShow = $state(7);
  const daysOptions = [7, 14, 30];

  // 排序方式
  type SortMode = 'priority' | 'dueDate' | 'name';
  let sortMode = $state<SortMode>('priority');

  // 标签搜索
  let tagSearchInput = $state('');
  let availableTags = $state<string[]>([]);

  // 材料数据
  interface ScheduleItem {
    id: string;
    name: string;
    deckId: string;
    deckName: string;
    priority: number;
    priorityLabel: string;
    status: 'new' | 'learning' | 'review' | 'due' | 'overdue' | 'suspended';
    nextReviewDate: Date | null;
    daysUntilDue: number;
    interval: number;
    reviewCount: number;
    tags: string[];
  }

  let scheduleItems = $state<ScheduleItem[]>([]);
  let isLoading = $state(true);

  const priorityLabels: Record<number, string> = {
    1: '低', 2: '低', 3: '低',
    4: '中', 5: '中', 6: '中',
    7: '高', 8: '高',
    9: '紧急', 10: '紧急'
  };

  const priorityClasses: Record<string, string> = {
    '紧急': 'priority-urgent',
    '高': 'priority-high',
    '中': 'priority-medium',
    '低': 'priority-low'
  };

  const statusLabels: Record<string, string> = {
    new: '新材料',
    learning: '学习中',
    review: '待复习',
    due: '今日到期',
    overdue: '已过期',
    suspended: '已暂停'
  };

  function getDeckIdsForChunk(chunk: IRChunkFileData): string[] {
    const deckIds = chunk.deckIds;
    if (deckIds && deckIds.length > 0) return deckIds;

    const deckTag = chunk.deckTag;
    if (deckTag && deckTag.startsWith('#IR_deck_')) {
      const name = deckTag.slice('#IR_deck_'.length);
      const deck = allDecks.find(d => d.name === name);
      if (deck?.id) return [deck.id];
      if (deck?.path) return [deck.path];
    }

    return [];
  }

  function getChunkDisplayName(chunk: IRChunkFileData): string {
    const filePath = chunk.filePath;
    const base = filePath?.split('/').pop() || chunk.chunkId;
    return base.replace(/\.md$/i, '').replace(/^\d+_/, '');
  }

  // 加载数据
  async function loadScheduleData() {
    isLoading = true;
    try {
      const irStorage = new IRStorageService(plugin.app);
      await irStorage.initialize();

      const allChunks = await irStorage.getAllChunkData();
      const chunks = Object.values(allChunks) as IRChunkFileData[];

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const nowMs = now.getTime();

      const tagSet = new Set<string>();
      const items: ScheduleItem[] = [];

      for (const chunk of chunks) {
        // 过滤牌组
        const deckIds = getDeckIdsForChunk(chunk);
        if (deckIds.length === 0) continue;

        if (!showGlobalLoad) {
          const hasSelectedDeck = deckIds.some(id => selectedDeckIds.has(id));
          if (!hasSelectedDeck) continue;
        }

        // 获取牌组名称
        const deckId = deckIds[0];
        const deck = allDecks.find(d => d.id === deckId || d.path === deckId);
        const deckName = deck?.name || deckId.split('/').pop() || '未知牌组';

        // 解析标签
        const tags = (chunk as any).tags as string[] || [];
        tags.forEach(t => tagSet.add(t));

        // 计算状态
        const scheduleStatus = (chunk as any).scheduleStatus as string || 'new';
        if (scheduleStatus === 'done' || scheduleStatus === 'removed') continue;

        const nextRepDate = (chunk as any).nextRepDate as number || 0;
        const interval = (chunk as any).intervalDays as number || 0;
        const reviewCount = ((chunk as any).stats?.impressions as number) || 0;
        const priority = (chunk as any).priorityEff as number || 5;

        let status: ScheduleItem['status'] = 'new';
        let daysUntilDue = 0;
        let nextReviewDate: Date | null = null;

        if (scheduleStatus === 'suspended') {
          status = 'suspended';
        } else if (nextRepDate > 0) {
          nextReviewDate = new Date(nextRepDate);
          daysUntilDue = Math.floor((nextRepDate - nowMs) / (24 * 60 * 60 * 1000));

          if (daysUntilDue < 0) {
            status = 'overdue';
          } else if (daysUntilDue === 0) {
            status = 'due';
          } else if (scheduleStatus === 'queued') {
            status = 'learning';
          } else {
            status = 'review';
          }
        }

        // 获取材料名称
        const name = getChunkDisplayName(chunk);

        items.push({
          id: chunk.chunkId,
          name,
          deckId,
          deckName,
          priority,
          priorityLabel: priorityLabels[Math.min(Math.max(priority, 1), 10)],
          status,
          nextReviewDate,
          daysUntilDue,
          interval,
          reviewCount,
          tags
        });
      }

      availableTags = Array.from(tagSet).sort();
      scheduleItems = items;
      
      logger.info(`[IRScheduleGantt] 加载了 ${items.length} 个材料`);
    } catch (error) {
      logger.error('[IRScheduleGantt] 加载数据失败:', error);
      scheduleItems = [];
    } finally {
      isLoading = false;
    }
  }

  // 过滤和排序
  function getFilteredAndSortedItems(): ScheduleItem[] {
    let items = [...scheduleItems];

    // 标签筛选
    if (tagSearchInput.trim()) {
      const searchTags = tagSearchInput.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
      items = items.filter(item => 
        searchTags.some(st => item.tags.some(t => t.toLowerCase().includes(st)))
      );
    }

    // 排序
    items.sort((a, b) => {
      switch (sortMode) {
        case 'priority':
          if (a.priority !== b.priority) return b.priority - a.priority;
          return a.daysUntilDue - b.daysUntilDue;
        case 'dueDate':
          return a.daysUntilDue - b.daysUntilDue;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return items;
  }

  // 生成日期列表
  function getDateColumns(): { date: Date; isToday: boolean; isWeekend: boolean; label: string; weekday: string }[] {
    const columns: { date: Date; isToday: boolean; isWeekend: boolean; label: string; weekday: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      columns.push({
        date,
        isToday: i === 0,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        weekday: `周${weekdays[date.getDay()]}`
      });
    }

    return columns;
  }

  // 检查材料是否在某天有调度
  function getScheduleBlockForDay(item: ScheduleItem, dayIndex: number): { show: boolean; status: string } | null {
    if (item.status === 'suspended') return null;
    
    if (item.daysUntilDue === dayIndex || (item.daysUntilDue < 0 && dayIndex === 0)) {
      return { show: true, status: item.status };
    }
    return null;
  }

  // 统计数据
  function getStats() {
    const items = getFilteredAndSortedItems();
    return {
      today: items.filter(i => i.daysUntilDue <= 0 && i.status !== 'suspended').length,
      week: items.filter(i => i.daysUntilDue <= 7 && i.status !== 'suspended').length,
      overdue: items.filter(i => i.status === 'overdue').length,
      newItems: items.filter(i => i.status === 'new').length,
      review: items.filter(i => i.status === 'review' || i.status === 'learning').length
    };
  }

  // 响应外部数据变化
  $effect(() => {
    if (selectedDeckIds || showGlobalLoad !== undefined) {
      loadScheduleData();
    }
  });

  onMount(() => {
    loadScheduleData();
  });

  const filteredItems = $derived(getFilteredAndSortedItems());
  const dateColumns = $derived(getDateColumns());
  const stats = $derived(getStats());
</script>

<div class="schedule-gantt-container">
  <!-- 控制栏 -->
  <div class="gantt-controls">
    <div class="control-group">
      <span class="control-label">时间范围:</span>
      <div class="toggle-buttons">
        {#each daysOptions as days}
          <button 
            class="toggle-btn" 
            class:active={daysToShow === days}
            onclick={() => daysToShow = days}
          >
            {days}天
          </button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <span class="control-label">排序:</span>
      <div class="toggle-buttons">
        <button 
          class="toggle-btn" 
          class:active={sortMode === 'priority'}
          onclick={() => sortMode = 'priority'}
        >
          优先级
        </button>
        <button 
          class="toggle-btn" 
          class:active={sortMode === 'dueDate'}
          onclick={() => sortMode = 'dueDate'}
        >
          到期时间
        </button>
        <button 
          class="toggle-btn" 
          class:active={sortMode === 'name'}
          onclick={() => sortMode = 'name'}
        >
          名称
        </button>
      </div>
    </div>

    <div class="control-group search-group">
      <span class="control-label">标签筛选:</span>
      <div class="search-input-wrapper">
        <ObsidianIcon name="tag" size={14} />
        <input 
          type="text" 
          class="search-input"
          placeholder="输入标签搜索，多个用逗号分隔..."
          bind:value={tagSearchInput}
        />
        {#if tagSearchInput}
          <button class="clear-btn" onclick={() => tagSearchInput = ''}>
            <ObsidianIcon name="x" size={12} />
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- 图例 -->
  <div class="legend-bar">
    <div class="legend-item">
      <span class="legend-dot status-new"></span>
      <span>新材料</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot status-learning"></span>
      <span>学习中</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot status-review"></span>
      <span>待复习</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot status-due"></span>
      <span>今日到期</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot status-overdue"></span>
      <span>已过期</span>
    </div>
  </div>

  <!-- 甘特图 -->
  {#if isLoading}
    <div class="loading-state">
      <ObsidianIcon name="loader" size={24} />
      <span>加载中...</span>
    </div>
  {:else}
    <div class="gantt-wrapper">
      <!-- 表头 -->
      <div class="gantt-header">
        <div class="gantt-sidebar-header">
          <ObsidianIcon name="book-open" size={14} />
          <span>阅读材料 ({filteredItems.length})</span>
        </div>
        <div class="gantt-timeline-header">
          {#each dateColumns as col}
            <div class="date-cell" class:today={col.isToday} class:weekend={col.isWeekend}>
              <div class="weekday">{col.weekday}</div>
              <div class="day">{col.label}</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="gantt-body">
        {#each filteredItems as item (item.id)}
          <div class="gantt-row">
            <div class="material-info">
              <div class="priority-indicator {priorityClasses[item.priorityLabel]}"></div>
              <div class="material-details">
                <div class="material-name" title={item.name}>{item.name}</div>
                <div class="material-meta">
                  <span class="meta-item">
                    <ObsidianIcon name="folder" size={10} />
                    {item.deckName}
                  </span>
                  <span class="meta-item">
                    <ObsidianIcon name="repeat" size={10} />
                    {item.reviewCount}次
                  </span>
                  {#if item.interval > 0}
                    <span class="meta-item">
                      <ObsidianIcon name="clock" size={10} />
                      {item.interval}天
                    </span>
                  {/if}
                </div>
              </div>
            </div>
            <div class="timeline-cells">
              {#each dateColumns as col, dayIndex}
                {@const block = getScheduleBlockForDay(item, dayIndex)}
                <div class="timeline-cell" class:today={col.isToday} class:weekend={col.isWeekend}>
                  {#if block}
                    <div class="schedule-block status-{block.status}" title="{statusLabels[block.status]}">
                      {block.status === 'new' ? '新' : block.status === 'overdue' ? '逾' : '复'}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 统计摘要 -->
  <div class="stats-summary">
    <div class="stat-item">
      <span class="stat-label">今日待读</span>
      <span class="stat-value today">{stats.today}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">本周待读</span>
      <span class="stat-value week">{stats.week}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">已过期</span>
      <span class="stat-value overdue">{stats.overdue}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">新材料</span>
      <span class="stat-value new">{stats.newItems}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">复习中</span>
      <span class="stat-value review">{stats.review}</span>
    </div>
  </div>
</div>

<style>
  .schedule-gantt-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
  }

  /* 控制栏 */
  .gantt-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .toggle-buttons {
    display: flex;
    gap: 4px;
  }

  .toggle-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 500;
    background: var(--background-primary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .toggle-btn.active {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }

  .search-group {
    flex: 1;
    min-width: 200px;
  }

  .search-input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-muted);
  }

  .search-input-wrapper:focus-within {
    border-color: var(--interactive-accent);
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: 12px;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-faint);
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 2px;
  }

  .clear-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  /* 图例 */
  .legend-bar {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }

  .legend-dot.status-new { background: #89b4fa; }
  .legend-dot.status-learning { background: #a6e3a1; }
  .legend-dot.status-review { background: #cba6f7; }
  .legend-dot.status-due { background: #f9e2af; }
  .legend-dot.status-overdue { background: #f38ba8; }

  /* 甘特图 */
  .gantt-wrapper {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .gantt-header {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
  }

  .gantt-sidebar-header {
    width: 240px;
    min-width: 240px;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    border-right: 1px solid var(--background-modifier-border);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .gantt-timeline-header {
    flex: 1;
    display: flex;
    overflow-x: auto;
  }

  .date-cell {
    min-width: 70px;
    width: 70px;
    padding: 6px 4px;
    text-align: center;
    border-right: 1px solid var(--background-modifier-border);
    font-size: 11px;
  }

  .date-cell .weekday {
    color: var(--text-faint);
    font-size: 10px;
  }

  .date-cell .day {
    font-weight: 600;
    color: var(--text-normal);
    margin-top: 2px;
  }

  .date-cell.today {
    background: rgba(137, 180, 250, 0.12);
  }

  .date-cell.today .day {
    color: #89b4fa;
  }

  .date-cell.weekend {
    background: rgba(166, 227, 161, 0.06);
  }

  .gantt-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .gantt-row {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background 0.15s;
  }

  .gantt-row:hover {
    background: var(--background-modifier-hover);
  }

  .gantt-row:last-child {
    border-bottom: none;
  }

  .material-info {
    width: 240px;
    min-width: 240px;
    padding: 8px 12px;
    border-right: 1px solid var(--background-modifier-border);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .priority-indicator {
    width: 3px;
    height: 32px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .priority-indicator.priority-urgent { background: #f38ba8; }
  .priority-indicator.priority-high { background: #fab387; }
  .priority-indicator.priority-medium { background: #f9e2af; }
  .priority-indicator.priority-low { background: #a6e3a1; }

  .material-details {
    flex: 1;
    min-width: 0;
  }

  .material-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 3px;
  }

  .material-meta {
    display: flex;
    gap: 10px;
    font-size: 10px;
    color: var(--text-faint);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .timeline-cells {
    flex: 1;
    display: flex;
    overflow-x: auto;
  }

  .timeline-cell {
    min-width: 70px;
    width: 70px;
    height: 48px;
    border-right: 1px solid var(--background-modifier-border);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .timeline-cell.today {
    background: rgba(137, 180, 250, 0.06);
  }

  .timeline-cell.weekend {
    background: rgba(166, 227, 161, 0.03);
  }

  .schedule-block {
    width: calc(100% - 8px);
    height: 26px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: #1e1e2e;
    cursor: pointer;
    transition: all 0.2s;
  }

  .schedule-block:hover {
    transform: scale(1.08);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
  }

  .schedule-block.status-new { background: linear-gradient(135deg, #89b4fa, #7aa2f7); }
  .schedule-block.status-learning { background: linear-gradient(135deg, #a6e3a1, #8bd5a1); }
  .schedule-block.status-review { background: linear-gradient(135deg, #cba6f7, #b794f4); }
  .schedule-block.status-due { background: linear-gradient(135deg, #f9e2af, #ffd43b); }
  .schedule-block.status-overdue { background: linear-gradient(135deg, #f38ba8, #ff6b6b); }

  /* 统计摘要 */
  .stats-summary {
    display: flex;
    gap: 16px;
    padding: 10px 14px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-muted);
  }

  .stat-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-normal);
  }

  .stat-value.today { color: #89b4fa; }
  .stat-value.week { color: #cba6f7; }
  .stat-value.overdue { color: #f38ba8; }
  .stat-value.new { color: #94e2d5; }
  .stat-value.review { color: #a6e3a1; }

  /* 状态 */
  .loading-state,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
    font-size: 13px;
  }

  @media (max-width: 600px) {
    .gantt-controls {
      flex-direction: column;
      align-items: flex-start;
    }

    .search-group {
      width: 100%;
    }

    .stats-summary {
      gap: 12px;
    }

    .stat-item {
      min-width: 60px;
    }
  }
</style>
