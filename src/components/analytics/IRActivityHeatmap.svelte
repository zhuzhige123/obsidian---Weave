<!--
  增量阅读年度活动热力图组件 (GitHub 风格)
  显示用户一年内的增量阅读活动分布
  - 横向: 周 (每列一周)
  - 纵向: 星期几 (周日到周六)
  - 颜色深浅: 学习时长/活动强度
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Platform } from 'obsidian';
  import type AnkiObsidianPlugin from '../../main';
  import type { IRStudySession, IRDeck } from '../../types/ir-types';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { logger } from '../../utils/logger';

  interface Props {
    plugin: AnkiObsidianPlugin;
    allDecks: IRDeck[];
    selectedDeckIds: Set<string>;
    showGlobalLoad: boolean;
  }

  let { plugin, allDecks, selectedDeckIds, showGlobalLoad }: Props = $props();

  let sessions = $state<IRStudySession[]>([]);
  let tooltip = $state<{ show: boolean; x: number; y: number; content: string }>({
    show: false,
    x: 0,
    y: 0,
    content: ''
  });

  interface WeekData {
    days: DayData[];
  }

  interface DayData {
    date: string;
    blocks: number;
    duration: number;
    level: number;
    isPlaceholder?: boolean;
  }

  interface MonthLabel {
    name: string;
    position: number;
  }

  const isMobile = Platform.isMobile;

  async function loadSessions() {
    try {
      const irStorage = new IRStorageService(plugin.app);
      await irStorage.initialize();
      sessions = await irStorage.getStudySessions();
      logger.info(`[IRActivityHeatmap] 加载了 ${sessions.length} 个会话`);
    } catch (error) {
      logger.error('[IRActivityHeatmap] 加载会话数据失败:', error);
      sessions = [];
    }
  }

  function getFilteredSessions(): IRStudySession[] {
    if (showGlobalLoad) {
      return sessions;
    }

    const selectedAliases = new Set<string>();
    for (const id of selectedDeckIds) {
      selectedAliases.add(id);
      const deck = allDecks.find(d => d.id === id || d.path === id);
      if (deck?.id) selectedAliases.add(deck.id);
      if (deck?.path) selectedAliases.add(deck.path);
    }

    return sessions.filter(s => selectedAliases.has(s.deckId));
  }

  function generateDailyData(): Record<string, { blocks: number; duration: number }> {
    const filteredSessions = getFilteredSessions();
    const dailyData: Record<string, { blocks: number; duration: number }> = {};
    
    for (const session of filteredSessions) {
      const date = session.startTime.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { blocks: 0, duration: 0 };
      }
      dailyData[date].blocks += session.blocksCompleted;
      dailyData[date].duration += session.confirmedDuration;
    }
    
    return dailyData;
  }

  function getLevel(minutes: number, maxMinutes: number): number {
    if (minutes === 0) return 0;
    if (maxMinutes === 0) return 0;
    const quart = maxMinutes / 4;
    if (minutes <= quart) return 1;
    if (minutes <= quart * 2) return 2;
    if (minutes <= quart * 3) return 3;
    return 4;
  }

  function generateHeatmapGrid(): { weeks: WeekData[]; monthLabels: MonthLabel[] } {
    const dailyData = generateDailyData();
    const allMinutes = Object.values(dailyData).map(d => Math.round(d.duration / 60));
    const maxMinutes = Math.max(...allMinutes, 30);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 365);
    
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const weeks: WeekData[] = [];
    const monthLabels: MonthLabel[] = [];
    let currentWeek: DayData[] = [];
    let weekIndex = 0;

    const iterDate = new Date(startDate);
    
    while (iterDate <= endDate) {
      if (iterDate.getDay() === 0 && currentWeek.length > 0) {
        weeks.push({ days: currentWeek });
        currentWeek = [];
        weekIndex++;
      }

      if (iterDate.getDay() === 0) {
        const d = iterDate.getDate();
        if (d <= 7) {
          const monthName = iterDate.toLocaleString('zh-CN', { month: 'short' });
          if (!monthLabels.some(m => m.name === monthName && Math.abs(m.position - weekIndex) < 4)) {
            monthLabels.push({ name: monthName, position: weekIndex });
          }
        }
      }

      const dateStr = iterDate.toISOString().split('T')[0];
      const data = dailyData[dateStr] || { blocks: 0, duration: 0 };
      const minutes = Math.round(data.duration / 60);
      
      currentWeek.push({
        date: dateStr,
        blocks: data.blocks,
        duration: minutes,
        level: getLevel(minutes, maxMinutes),
        isPlaceholder: iterDate < new Date(startDate.getTime() + dayOfWeek * 24 * 60 * 60 * 1000) && iterDate < new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000)
      });

      iterDate.setDate(iterDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: '',
          blocks: 0,
          duration: 0,
          level: 0,
          isPlaceholder: true
        });
      }
      weeks.push({ days: currentWeek });
    }

    return { weeks, monthLabels };
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  function formatDuration(minutes: number): string {
    if (minutes === 0) return '0分钟';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }
    return `${mins}分钟`;
  }

  function showTooltip(event: MouseEvent, day: DayData) {
    if (day.isPlaceholder || !day.date) return;
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const content = day.blocks === 0 && day.duration === 0
      ? `<strong>${formatDate(day.date)}</strong><span class="no-activity">无学习记录</span>`
      : `<strong>${formatDate(day.date)}</strong><span class="stat-line"><span class="label">处理内容块</span><span class="value blocks">${day.blocks} 块</span></span><span class="stat-line"><span class="label">学习时长</span><span class="value">${formatDuration(day.duration)}</span></span>`;
    
    tooltip = {
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      content
    };
  }

  function hideTooltip() {
    tooltip = { ...tooltip, show: false };
  }

  function getStats() {
    const filteredSessions = getFilteredSessions();
    const totalBlocks = filteredSessions.reduce((sum, s) => sum + s.blocksCompleted, 0);
    const totalMinutes = filteredSessions.reduce((sum, s) => sum + s.confirmedDuration, 0) / 60;
    const totalDays = new Set(filteredSessions.map(s => s.startTime.split('T')[0])).size;
    const avgBlocks = totalDays > 0 ? totalBlocks / totalDays : 0;
    
    const dates = [...new Set(filteredSessions.map(s => s.startTime.split('T')[0]))].sort().reverse();
    let streak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = today;
    
    for (const date of dates) {
      if (date === checkDate) {
        streak++;
        const d = new Date(checkDate);
        d.setDate(d.getDate() - 1);
        checkDate = d.toISOString().split('T')[0];
      } else if (date < checkDate) {
        break;
      }
    }

    const sortedDates = [...new Set(filteredSessions.map(s => s.startTime.split('T')[0]))].sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          if (tempStreak > maxStreak) maxStreak = tempStreak;
          tempStreak = 1;
        }
      }
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak;
    
    return {
      totalBlocks,
      totalHours: Math.round(totalMinutes / 60),
      totalDays,
      avgBlocks: Math.round(avgBlocks * 10) / 10,
      currentStreak: streak,
      maxStreak
    };
  }

  onMount(async () => {
    await loadSessions();
  });

  const heatmapData = $derived(generateHeatmapGrid());
  const stats = $derived(getStats());
</script>

<div class="activity-heatmap-container">
  <div class="heatmap-header">
    <span class="header-title">
      过去一年 {stats.totalBlocks} 块内容，{stats.totalHours} 小时学习
    </span>
  </div>

  {#if isMobile}
    <!-- 移动端纵向布局：周为行，星期为列，上下滚动 -->
    <div class="graph-container-vertical">
      <div class="days-header-row">
        <span class="month-col-label"></span>
        <span class="day-col-label">日</span>
        <span class="day-col-label">一</span>
        <span class="day-col-label">二</span>
        <span class="day-col-label">三</span>
        <span class="day-col-label">四</span>
        <span class="day-col-label">五</span>
        <span class="day-col-label">六</span>
      </div>
      <div class="vertical-grid">
        {#each heatmapData.weeks as week, weekIdx}
          {@const monthLabel = heatmapData.monthLabels.find(m => m.position === weekIdx)}
          <div class="week-row">
            <span class="month-col-label">{monthLabel ? monthLabel.name : ''}</span>
            {#each week.days as day}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="day-cell"
                class:placeholder={day.isPlaceholder}
                data-level={day.level}
                onmouseenter={(e) => showTooltip(e, day)}
                onmouseleave={hideTooltip}
              ></div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- 桌面端横向布局 -->
    <div class="graph-container">
      <div class="months-row">
        {#each heatmapData.monthLabels as month}
          <span class="month-label" style="left: {month.position * 13}px">{month.name}</span>
        {/each}
      </div>
      
      <div class="heatmap-body">
        <div class="days-legend">
          <span class="day-label"></span>
          <span class="day-label">一</span>
          <span class="day-label"></span>
          <span class="day-label">三</span>
          <span class="day-label"></span>
          <span class="day-label">五</span>
          <span class="day-label"></span>
        </div>
        
        <div class="heatmap-grid">
          {#each heatmapData.weeks as week}
            <div class="week-column">
              {#each week.days as day}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                  class="day-cell"
                  class:placeholder={day.isPlaceholder}
                  data-level={day.level}
                  onmouseenter={(e) => showTooltip(e, day)}
                  onmouseleave={hideTooltip}
                ></div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <div class="heatmap-footer">
    <span class="legend-text">Less</span>
    <div class="legend-box" data-level="0"></div>
    <div class="legend-box" data-level="1"></div>
    <div class="legend-box" data-level="2"></div>
    <div class="legend-box" data-level="3"></div>
    <div class="legend-box" data-level="4"></div>
    <span class="legend-text">More</span>
  </div>

  <div class="stats-summary">
    <div class="summary-item">
      <span class="summary-value">{stats.totalDays}</span>
      <span class="summary-label">学习天数</span>
    </div>
    <div class="summary-item">
      <span class="summary-value highlight-green">{stats.totalBlocks}</span>
      <span class="summary-label">处理块数</span>
    </div>
    <div class="summary-item">
      <span class="summary-value">{stats.totalHours}h</span>
      <span class="summary-label">总学习时长</span>
    </div>
    <div class="summary-item">
      <span class="summary-value highlight-yellow">{stats.maxStreak}</span>
      <span class="summary-label">最长连续</span>
    </div>
    <div class="summary-item">
      <span class="summary-value highlight-blue">{stats.currentStreak}</span>
      <span class="summary-label">当前连续</span>
    </div>
  </div>

  {#if tooltip.show}
    <div 
      class="heatmap-tooltip"
      style="left: {tooltip.x}px; top: {tooltip.y}px;"
    >
      {@html tooltip.content}
    </div>
  {/if}
</div>

<style>
  .activity-heatmap-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
  }

  .heatmap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-title {
    font-size: 13px;
    color: var(--text-muted);
  }

  .graph-container {
    display: flex;
    flex-direction: column;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .months-row {
    display: flex;
    position: relative;
    height: 16px;
    margin-left: 28px;
    margin-bottom: 4px;
  }

  .month-label {
    position: absolute;
    font-size: 10px;
    color: var(--text-muted);
  }

  .heatmap-body {
    display: flex;
  }

  .days-legend {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-right: 4px;
    padding-top: 0;
  }

  .day-label {
    font-size: 9px;
    color: var(--text-muted);
    height: 10px;
    line-height: 10px;
    width: 20px;
    text-align: right;
  }

  .heatmap-grid {
    display: flex;
    gap: 3px;
  }

  .week-column {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .day-cell {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background-color: var(--background-modifier-border);
    cursor: pointer;
    transition: outline 0.1s ease;
  }

  .day-cell:hover:not(.placeholder) {
    outline: 1px solid var(--text-muted);
    outline-offset: 1px;
  }

  .day-cell.placeholder {
    visibility: hidden;
  }

  .day-cell[data-level="0"] { background-color: var(--background-modifier-border); }
  .day-cell[data-level="1"] { background-color: #9be9a8; }
  .day-cell[data-level="2"] { background-color: #40c463; }
  .day-cell[data-level="3"] { background-color: #30a14e; }
  .day-cell[data-level="4"] { background-color: #216e39; }

  :global(.theme-dark) .day-cell[data-level="0"] { background-color: var(--background-modifier-border); }
  :global(.theme-dark) .day-cell[data-level="1"] { background-color: #0e4429; }
  :global(.theme-dark) .day-cell[data-level="2"] { background-color: #006d32; }
  :global(.theme-dark) .day-cell[data-level="3"] { background-color: #26a641; }
  :global(.theme-dark) .day-cell[data-level="4"] { background-color: #39d353; }

  .heatmap-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-muted);
  }

  .legend-box {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .legend-box[data-level="0"] { background-color: var(--background-modifier-border); }
  .legend-box[data-level="1"] { background-color: #9be9a8; }
  .legend-box[data-level="2"] { background-color: #40c463; }
  .legend-box[data-level="3"] { background-color: #30a14e; }
  .legend-box[data-level="4"] { background-color: #216e39; }

  :global(.theme-dark) .legend-box[data-level="0"] { background-color: var(--background-modifier-border); }
  :global(.theme-dark) .legend-box[data-level="1"] { background-color: #0e4429; }
  :global(.theme-dark) .legend-box[data-level="2"] { background-color: #006d32; }
  :global(.theme-dark) .legend-box[data-level="3"] { background-color: #26a641; }
  :global(.theme-dark) .legend-box[data-level="4"] { background-color: #39d353; }

  .legend-text {
    font-size: 10px;
  }

  .stats-summary {
    display: flex;
    gap: 24px;
    padding: 12px 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .summary-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .summary-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .summary-value.highlight-blue {
    color: #89b4fa;
  }

  .summary-value.highlight-green {
    color: #40c463;
  }

  :global(.theme-dark) .summary-value.highlight-green {
    color: #39d353;
  }

  .summary-value.highlight-yellow {
    color: #f9e2af;
  }

  .heatmap-tooltip {
    position: fixed;
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-normal);
    pointer-events: none;
    z-index: var(--layer-tooltip);
    transform: translateX(-50%) translateY(-100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    gap: 4px;
    white-space: nowrap;
  }

  .heatmap-tooltip :global(strong) {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .heatmap-tooltip :global(.no-activity) {
    color: var(--text-muted);
  }

  .heatmap-tooltip :global(.stat-line) {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .heatmap-tooltip :global(.stat-line .label) {
    color: var(--text-muted);
  }

  .heatmap-tooltip :global(.stat-line .value.blocks) {
    color: #40c463;
    font-weight: 600;
  }

  :global(.theme-dark) .heatmap-tooltip :global(.stat-line .value.blocks) {
    color: #39d353;
  }

  /* 移动端纵向热力图 */
  .graph-container-vertical {
    display: flex;
    flex-direction: column;
    max-height: 400px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .days-header-row {
    display: flex;
    gap: 3px;
    position: sticky;
    top: 0;
    background: var(--background-primary);
    z-index: 1;
    padding-bottom: 4px;
  }

  .day-col-label {
    width: 38px;
    text-align: center;
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .month-col-label {
    width: 32px;
    font-size: 9px;
    color: var(--text-muted);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .vertical-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .week-row {
    display: flex;
    gap: 3px;
  }

  .week-row .day-cell {
    width: 38px;
    height: 38px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    .stats-summary {
      flex-wrap: wrap;
      gap: 16px;
      justify-content: center;
    }

    .summary-item {
      min-width: 60px;
    }
  }
</style>
