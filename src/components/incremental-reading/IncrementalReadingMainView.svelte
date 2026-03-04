<!--
  IncrementalReadingMainView - 增量阅读日历视图
  
  显示在牌组学习界面的增量阅读标签页中
  只包含日历视图（侧边栏材料目录使用全局侧边栏）
  
  @module components/incremental-reading/IncrementalReadingMainView
  @version 2.0.0
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import type { ReadingMaterial } from '../../types/incremental-reading-types';
  import { ReadingCategory } from '../../types/incremental-reading-types';
  import { logger } from '../../utils/logger';
  import RescheduleMaterialModal from './RescheduleMaterialModal.svelte';

  // Props
  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();

  // ===== 状态 =====
  let loading = $state(true);
  let serviceReady = $state(false);
  let allMaterials = $state<ReadingMaterial[]>([]);
  
  // 日历状态
  let currentDate = $state(new Date());
  let selectedDate = $state(new Date());
  
  // 调度模态窗状态
  let showRescheduleModal = $state(false);
  let rescheduleTarget = $state<ReadingMaterial | null>(null);

  // ===== 数据结构 =====
  interface BookGroup {
    id: string;
    title: string;
    color: number;
  }

  // ===== 派生数据 =====
  
  // 按书籍分组（用于颜色标识）
  let bookGroups: Map<string, BookGroup> = $derived.by(() => {
    const groups = new Map<string, BookGroup>();
    let colorIndex = 0;
    
    for (const material of allMaterials) {
      const pathParts = material.filePath.split('/');
      const bookTitle = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '未分类';
      const bookId = bookTitle.toLowerCase().replace(/\s+/g, '-');
      
      if (!groups.has(bookId)) {
        groups.set(bookId, {
          id: bookId,
          title: bookTitle,
          color: (colorIndex++ % 6) + 1
        });
      }
    }
    
    return groups;
  });
  
  // 获取选中日期的材料
  let selectedDateMaterials: ReadingMaterial[] = $derived.by(() => {
    return allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      const dueDate = new Date(m.fsrs.due);
      return isSameDay(dueDate, selectedDate);
    }).sort((a, b) => b.priority - a.priority);
  });
  
  // 统计数据
  let stats = $derived.by(() => {
    const todayMaterials = allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      return isSameDay(new Date(m.fsrs.due), new Date());
    });
    const totalProgress = allMaterials.reduce((sum, m) => sum + m.progress.percentage, 0);
    const avgProgress = allMaterials.length > 0 ? Math.round(totalProgress / allMaterials.length) : 0;
    const completedCount = allMaterials.filter(m => m.progress.percentage >= 100).length;
    
    return {
      todayCount: todayMaterials.length,
      completedCount,
      avgProgress,
      totalCount: allMaterials.length
    };
  });

  // ===== 工具函数 =====
  
  function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }
  
  function getMaterialColor(material: ReadingMaterial): string {
    const colors = [
      'var(--weave-primary)',
      'var(--weave-secondary)',
      '#ec4899',
      '#10b981',
      '#f59e0b',
      '#3b82f6'
    ];
    
    const pathParts = material.filePath.split('/');
    const bookTitle = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '未分类';
    const bookId = bookTitle.toLowerCase().replace(/\s+/g, '-');
    const book = bookGroups.get(bookId);
    
    return colors[((book?.color || 1) - 1) % colors.length];
  }
  
  function getBookTitle(material: ReadingMaterial): string {
    const pathParts = material.filePath.split('/');
    return pathParts.length > 1 ? pathParts[pathParts.length - 2] : '未分类';
  }
  
  function getMonthDays(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // 上月末尾
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    // 当月
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // 下月开头
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  }
  
  function getMaterialsForDate(date: Date): ReadingMaterial[] {
    return allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      return isSameDay(new Date(m.fsrs.due), date);
    });
  }
  
  function formatPeriod(): string {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    return `${year}年${month}月`;
  }

  // ===== 事件处理 =====
  
  async function loadMaterials(): Promise<void> {
    try {
      loading = true;
      
      // 等待增量阅读服务初始化
      if (!plugin.readingMaterialManager) {
        const maxAttempts = 50;
        const interval = 100;
        
        for (let i = 0; i < maxAttempts; i++) {
          if (plugin.readingMaterialManager) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        if (!plugin.readingMaterialManager) {
          logger.warn('[IncrementalReadingMainView] 增量阅读服务未初始化');
          serviceReady = false;
          allMaterials = [];
          return;
        }
      }
      
      serviceReady = true;
      allMaterials = await plugin.readingMaterialManager.getAllMaterials();
      
      logger.debug('[IncrementalReadingMainView] 数据加载完成:', {
        materials: allMaterials.length
      });
    } catch (error) {
      logger.error('[IncrementalReadingMainView] 加载数据失败:', error);
      allMaterials = [];
    } finally {
      loading = false;
    }
  }
  
  function selectDateInCalendar(date: Date): void {
    selectedDate = date;
  }
  
  function navigate(delta: number): void {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    currentDate = newDate;
  }
  
  function goToToday(): void {
    currentDate = new Date();
    selectedDate = new Date();
  }
  
  async function handleMaterialClick(material: ReadingMaterial): Promise<void> {
    const file = plugin.app.vault.getAbstractFileByPath(material.filePath);
    if (file) {
      const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
      const linkToOpen = (material.resumeLink && material.resumeLink.trim().length > 0)
        ? material.resumeLink
        : material.filePath;
      await plugin.app.workspace.openLinkText(linkToOpen, contextPath, false);
    }
  }
  
  function openReschedule(material: ReadingMaterial): void {
    rescheduleTarget = material;
    showRescheduleModal = true;
  }
  
  async function handleReschedule(newDate: Date): Promise<void> {
    if (!rescheduleTarget || !plugin.readingMaterialManager) return;
    
    try {
      await plugin.readingMaterialManager.rescheduleMaterial(
        rescheduleTarget.uuid,
        newDate
      );
      await loadMaterials();
    } catch (error) {
      logger.error('[IncrementalReadingMainView] 重新调度失败:', error);
    }
  }

  // ===== 生命周期 =====
  
  onMount(async () => {
    await loadMaterials();
  });
</script>

<div class="ir-calendar-view">
  <!-- 工具栏 -->
  <div class="ir-toolbar">
    <div class="toolbar-left">
      <div class="nav-group">
        <button class="nav-btn" onclick={() => navigate(-1)} title="上一月">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button class="nav-btn" onclick={() => navigate(1)} title="下一月">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
      <span class="current-period">{formatPeriod()}</span>
      <button class="today-btn" onclick={goToToday}>今天</button>
    </div>
  </div>
  
  <!-- 日历区域 -->
  <div class="ir-calendar-area">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>
    {:else if !serviceReady}
      <div class="service-not-ready">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>增量阅读服务正在初始化...</span>
        <button class="retry-btn" onclick={loadMaterials}>重试</button>
      </div>
    {:else}
      <div class="calendar-wrapper">
        <!-- 紧凑日历视图 -->
        <div class="compact-calendar-view">
          <!-- 日历网格 -->
          <div class="compact-calendar-section">
            <div class="weekday-header">
              {#each ['日', '一', '二', '三', '四', '五', '六'] as day}
                <div class="weekday-cell">{day}</div>
              {/each}
            </div>
            <div class="compact-calendar-grid">
              {#each getMonthDays(currentDate.getFullYear(), currentDate.getMonth()) as day}
                {@const materials = getMaterialsForDate(day.date)}
                {@const isToday = isSameDay(day.date, new Date())}
                {@const isSelected = isSameDay(day.date, selectedDate)}
                <button 
                  class="compact-day"
                  class:other-month={!day.isCurrentMonth}
                  class:today={isToday}
                  class:selected={isSelected}
                  onclick={() => selectDateInCalendar(day.date)}
                >
                  <span class="compact-day-num">{day.date.getDate()}</span>
                  {#if materials.length > 0}
                    <span class="compact-day-count">{materials.length}项</span>
                    <div class="compact-day-dots">
                      {#each materials.slice(0, 3) as m}
                        <div class="compact-dot" style="background: {getMaterialColor(m)}"></div>
                      {/each}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
          
          <!-- 选中日期材料列表 -->
          <div class="selected-date-materials">
            <div class="date-materials-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span class="date-materials-title">
                {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 到期材料 ({selectedDateMaterials.length})
              </span>
            </div>
            
            {#if selectedDateMaterials.length === 0}
              <div class="empty-date-hint">该日期无到期材料</div>
            {:else}
              <div class="date-material-list">
                {#each selectedDateMaterials as material}
                  <div 
                    class="date-material-item"
                    onclick={() => handleMaterialClick(material)}
                    onkeydown={(e) => e.key === 'Enter' && handleMaterialClick(material)}
                    role="button"
                    tabindex="0"
                  >
                    <div class="date-material-color" style="background: {getMaterialColor(material)}"></div>
                    <div class="date-material-info">
                      <div class="date-material-title">
                        {material.title}
                        <span class="material-meta-inline">{getBookTitle(material)} · P{material.priority}</span>
                      </div>
                    </div>
                    <div class="date-material-progress">
                      <div class="progress-bar-sm">
                        <div class="progress-bar-fill" style="width: {material.progress.percentage}%"></div>
                      </div>
                      <span class="progress-text">{material.progress.percentage}%</span>
                    </div>
                    <div class="date-material-actions">
                      <button class="action-btn primary" title="开始阅读" onclick={(e) => { e.stopPropagation(); handleMaterialClick(material); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </button>
                      <button class="action-btn" title="调整日期" onclick={(e) => { e.stopPropagation(); openReschedule(material); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <!-- 底部统计栏 -->
  <div class="ir-stats-bar">
    <div class="stat-item accent">
      <span>今日待读:</span>
      <span class="stat-value">{stats.todayCount}</span>
    </div>
    <div class="stat-item success">
      <span>已完成:</span>
      <span class="stat-value">{stats.completedCount}</span>
    </div>
    <div class="stat-item">
      <span>平均进度:</span>
      <span class="stat-value">{stats.avgProgress}%</span>
    </div>
    <div class="stat-item warning">
      <span>总材料:</span>
      <span class="stat-value">{stats.totalCount}</span>
    </div>
  </div>
</div>

<!-- 调度模态窗 -->
{#if showRescheduleModal && rescheduleTarget}
  <RescheduleMaterialModal
    {plugin}
    material={rescheduleTarget}
    onClose={() => {
      showRescheduleModal = false;
      rescheduleTarget = null;
    }}
    onReschedule={handleReschedule}
  />
{/if}


<style>
  /* ===== 主布局 ===== */
  .ir-calendar-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--background-primary);
  }

  /* 工具栏 */
  .ir-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .nav-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .nav-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .current-period {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    min-width: 100px;
  }

  .today-btn {
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .today-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* ===== 日历区域 ===== */
  .ir-calendar-area {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .loading-state,
  .service-not-ready {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .retry-btn {
    padding: 8px 16px;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    transition: all 0.15s;
  }

  .retry-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .calendar-wrapper {
    flex: 1;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* 紧凑日历视图 */
  .compact-calendar-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .compact-calendar-section {
    padding: 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 8px;
  }

  .weekday-cell {
    padding: 4px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .compact-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .compact-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    min-height: 52px;
  }

  .compact-day:hover {
    background: var(--background-modifier-hover);
  }

  .compact-day.other-month {
    opacity: 0.4;
  }

  .compact-day.today {
    border: 2px solid var(--interactive-accent);
  }

  .compact-day.selected {
    background: var(--interactive-accent);
  }

  .compact-day.selected .compact-day-num,
  .compact-day.selected .compact-day-count {
    color: var(--text-on-accent);
  }

  .compact-day-num {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .compact-day-count {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .compact-day-dots {
    display: flex;
    gap: 2px;
    margin-top: 4px;
  }

  .compact-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  /* 选中日期材料列表 */
  .selected-date-materials {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .date-materials-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .date-materials-header svg {
    color: var(--interactive-accent);
  }

  .date-materials-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .empty-date-hint {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    padding: 20px;
  }

  .date-material-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .date-material-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    width: 100%;
  }

  .date-material-item:hover {
    background: var(--background-modifier-hover);
  }

  .date-material-color {
    width: 4px;
    height: 40px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .date-material-info {
    flex: 1;
    min-width: 0;
  }

  .date-material-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .material-meta-inline {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .date-material-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .progress-bar-sm {
    width: 60px;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--color-green);
    border-radius: 3px;
    transition: width 0.2s;
  }

  .progress-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
    min-width: 36px;
    text-align: right;
  }

  .date-material-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  .action-btn.primary:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  /* ===== 底部统计栏 ===== */
  .ir-stats-bar {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .stat-value {
    font-weight: 600;
    color: var(--text-normal);
  }

  .stat-item.accent .stat-value {
    color: var(--interactive-accent);
  }

  .stat-item.success .stat-value {
    color: var(--color-green);
  }

  .stat-item.warning .stat-value {
    color: var(--color-orange);
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .ir-stats-bar {
      flex-wrap: wrap;
      gap: 8px;
    }
  }
</style>
