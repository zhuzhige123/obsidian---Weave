<!--
  IncrementalReadingCalendarView - 增量阅读完整日历视图
  
  显示月度日历、热力图、日期材料列表和统计面板
  支持手动调度和拖拽调整
  
  @module components/incremental-reading/IncrementalReadingCalendarView
  @version 1.0.0
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import type { ReadingMaterial } from '../../types/incremental-reading-types';
  import { logger } from '../../utils/logger';
  import RescheduleMaterialModal from './RescheduleMaterialModal.svelte';

  // Props
  interface Props {
    plugin: WeavePlugin;
    onMaterialSelect?: (materialId: string) => void;
  }

  let { plugin, onMaterialSelect }: Props = $props();

  // State
  let loading = $state(true);
  let currentDate = $state(new Date());
  let selectedDate = $state<Date | null>(null);
  let allMaterials = $state<ReadingMaterial[]>([]);
  let selectedDateMaterials = $state<ReadingMaterial[]>([]);
  let calendarDays = $state<CalendarDay[]>([]);
  let monthStats = $state<MonthStats>({
    totalReadingTime: 0,
    completedCount: 0,
    averageProgress: 0,
    totalMaterials: 0
  });
  
  // 手动调度状态
  let showRescheduleModal = $state(false);
  let rescheduleTarget = $state<ReadingMaterial | null>(null);

  interface CalendarDay {
    date: Date;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    materialCount: number;
    heatLevel: number; // 0-4
  }

  interface MonthStats {
    totalReadingTime: number;
    completedCount: number;
    averageProgress: number;
    totalMaterials: number;
  }

  // 加载数据
  async function loadData(): Promise<void> {
    try {
      loading = true;

      if (!plugin.readingMaterialManager) {
        throw new Error('增量阅读服务未初始化');
      }

      allMaterials = await plugin.readingMaterialManager.getAllMaterials();
      generateCalendar();
      calculateMonthStats();

      if (selectedDate) {
        loadSelectedDateMaterials();
      }

      logger.debug('[CalendarView] 数据加载完成:', {
        materials: allMaterials.length
      });
    } catch (error) {
      logger.error('[CalendarView] 加载数据失败:', error);
    } finally {
      loading = false;
    }
  }

  // 生成日历网格
  function generateCalendar(): void {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 获取日历开始日期（上月末尾）
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // 获取日历结束日期（下月开头）
    const endDate = new Date(lastDay);
    const remainingDays = 6 - lastDay.getDay();
    endDate.setDate(endDate.getDate() + remainingDays);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const days: CalendarDay[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const date = new Date(current);
      date.setHours(0, 0, 0, 0);
      
      // 计算该日期的材料数量
      const materialCount = countMaterialsForDate(date);
      
      days.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        isSelected: selectedDate ? date.getTime() === selectedDate.getTime() : false,
        materialCount,
        heatLevel: getHeatLevel(materialCount)
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    calendarDays = days;
  }

  // 计算某日期的材料数量
  function countMaterialsForDate(date: Date): number {
    return allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      const dueDate = new Date(m.fsrs.due);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === date.getTime();
    }).length;
  }

  // 获取某日期的材料列表
  function getMaterialsForDay(date: Date): ReadingMaterial[] {
    return allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      const dueDate = new Date(m.fsrs.due);
      dueDate.setHours(0, 0, 0, 0);
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === targetDate.getTime();
    });
  }

  // 获取热力图等级
  function getHeatLevel(count: number): number {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
  }

  // 计算月度统计
  function calculateMonthStats(): void {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 筛选当月材料
    const monthMaterials = allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      const dueDate = new Date(m.fsrs.due);
      return dueDate.getFullYear() === year && dueDate.getMonth() === month;
    });
    
    // 计算统计数据
    const totalProgress = monthMaterials.reduce((sum, m) => sum + m.progress.percentage, 0);
    const completedMaterials = monthMaterials.filter(m => m.progress.percentage >= 100);
    
    // 估算阅读时长（基于进度和字数）
    const totalReadingTime = monthMaterials.reduce((sum, m) => {
      const readWords = m.progress.totalWords * (m.progress.percentage / 100);
      return sum + Math.round(readWords / 300); // 假设每分钟300字
    }, 0);
    
    monthStats = {
      totalReadingTime,
      completedCount: completedMaterials.length,
      averageProgress: monthMaterials.length > 0 
        ? Math.round(totalProgress / monthMaterials.length) 
        : 0,
      totalMaterials: monthMaterials.length
    };
  }

  // 加载选中日期的材料
  function loadSelectedDateMaterials(): void {
    if (!selectedDate) {
      selectedDateMaterials = [];
      return;
    }
    
    const targetDate = selectedDate;
    selectedDateMaterials = allMaterials.filter(m => {
      if (!m.fsrs?.due) return false;
      const dueDate = new Date(m.fsrs.due);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === targetDate.getTime();
    }).sort((a, b) => b.priority - a.priority);
  }

  // 切换月份
  function changeMonth(delta: number): void {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    currentDate = newDate;
    generateCalendar();
    calculateMonthStats();
  }

  // 跳转到今天
  function goToToday(): void {
    currentDate = new Date();
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    generateCalendar();
    calculateMonthStats();
    loadSelectedDateMaterials();
  }

  // 选择日期
  function selectDate(day: CalendarDay): void {
    selectedDate = day.date;
    generateCalendar();
    loadSelectedDateMaterials();
  }

  // 处理材料点击
  function handleMaterialClick(material: ReadingMaterial): void {
    if (onMaterialSelect) {
      onMaterialSelect(material.uuid);
    }
  }

  // 格式化月份
  function formatMonth(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }

  // 格式化日期
  function formatDate(date: Date): string {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  // 格式化时长
  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }

  // 获取热力图颜色
  function getHeatColor(level: number): string {
    const colors = [
      'var(--background-secondary)',
      'rgba(139, 92, 246, 0.2)',
      'rgba(139, 92, 246, 0.4)',
      'rgba(139, 92, 246, 0.6)',
      'rgba(139, 92, 246, 0.8)'
    ];
    return colors[level] || colors[0];
  }

  // 打开手动调度模态窗
  function openRescheduleModal(material: ReadingMaterial): void {
    rescheduleTarget = material;
    showRescheduleModal = true;
  }

  // 处理手动调度
  async function handleReschedule(newDate: Date): Promise<void> {
    if (!rescheduleTarget || !plugin.readingMaterialManager) return;
    
    try {
      await plugin.readingMaterialManager.rescheduleMaterial(
        rescheduleTarget.uuid,
        newDate
      );
      
      logger.debug('[CalendarView] 材料已重新调度:', {
        materialId: rescheduleTarget.uuid,
        newDate: newDate.toISOString()
      });
      
      // 重新加载数据
      await loadData();
    } catch (error) {
      logger.error('[CalendarView] 重新调度失败:', error);
    }
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  onMount(async () => {
    await loadData();
  });
</script>

<div class="calendar-view">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
  {:else}
    <!-- 统计面板 -->
    <div class="stats-panel">
      <div class="stat-card">
        <span class="stat-value">{monthStats.totalMaterials}</span>
        <span class="stat-label">本月材料</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{monthStats.completedCount}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{monthStats.averageProgress}%</span>
        <span class="stat-label">平均进度</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{formatDuration(monthStats.totalReadingTime)}</span>
        <span class="stat-label">预计时长</span>
      </div>
    </div>

    <!-- 日历头部 -->
    <div class="calendar-header">
      <button class="nav-btn" onclick={() => changeMonth(-1)} aria-label="上个月">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h3 class="month-title">{formatMonth(currentDate)}</h3>
      <button class="nav-btn" onclick={() => changeMonth(1)} aria-label="下个月">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
      <button class="today-btn" onclick={goToToday}>今天</button>
    </div>

    <!-- 星期标题 -->
    <div class="weekday-header">
      {#each weekdays as day}
        <span class="weekday">{day}</span>
      {/each}
    </div>

    <!-- 日历网格 -->
    <div class="calendar-grid">
      {#each calendarDays as day}
        <button
          class="calendar-day"
          class:other-month={!day.isCurrentMonth}
          class:today={day.isToday}
          class:selected={day.isSelected}
          style="--heat-color: {getHeatColor(day.heatLevel)}"
          onclick={() => selectDate(day)}
        >
          <span class="day-number">{day.dayOfMonth}</span>
          {#if day.materialCount > 0}
            <div class="activity-dots">
              {#each getMaterialsForDay(day.date).slice(0, 4) as material}
                {@const progressLevel = material.progress.percentage >= 80 ? 'high-progress' : material.progress.percentage >= 40 ? 'medium-progress' : material.progress.percentage > 0 ? 'low-progress' : 'new-material'}
                <div class="activity-dot {progressLevel}"></div>
              {/each}
            </div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- 选中日期的材料列表 -->
    {#if selectedDate}
      <div class="selected-date-section">
        <h4 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {formatDate(selectedDate)} 到期材料 ({selectedDateMaterials.length})
        </h4>
        
        {#if selectedDateMaterials.length === 0}
          <div class="empty-state">
            <span>该日期无到期材料</span>
          </div>
        {:else}
          <div class="materials-list">
            {#each selectedDateMaterials as material}
              <div class="material-item-wrapper">
                <button 
                  class="material-item"
                  onclick={() => handleMaterialClick(material)}
                >
                  <div class="material-info">
                    <div class="material-title-row">
                      <span class="material-title">{material.title}</span>
                      <span class="material-progress-badge">{material.progress.percentage}%</span>
                    </div>
                    <span class="material-meta">
                      优先级 {material.priority}
                    </span>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
                <button 
                  class="reschedule-btn"
                  onclick={() => openRescheduleModal(material)}
                  title="调整日期"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<!-- 手动调度模态窗 -->
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
  .calendar-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  /* 加载状态 */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 20px;
    color: var(--text-muted);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 统计面板 */
  .stats-panel {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* 日历头部 */
  .calendar-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .nav-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .month-title {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    color: var(--text-normal);
  }

  .today-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .today-btn:hover {
    opacity: 0.9;
  }

  /* 星期标题 */
  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .weekday {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    padding: 8px 0;
  }

  /* 日历网格 */
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .calendar-day {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    aspect-ratio: 1;
    border: none;
    border-radius: 8px;
    background: var(--heat-color);
    cursor: pointer;
    transition: all 0.15s;
    padding: 4px 2px;
    gap: 2px;
  }

  .calendar-day:hover {
    transform: scale(1.05);
  }

  .calendar-day.other-month {
    opacity: 0.4;
  }

  .calendar-day.today {
    border: 2px solid var(--interactive-accent);
  }

  .calendar-day.selected {
    background: var(--interactive-accent);
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb, 124, 58, 237), 0.3);
  }

  .calendar-day.selected .day-number,
  .calendar-day.selected .material-count {
    color: var(--text-on-accent);
  }

  .day-number {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .material-count {
    display: none; /* 隐藏数字，改用彩色圆点 */
  }

  /* 彩色热力圆点容器 */
  .activity-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    min-height: 10px;
    flex-shrink: 0;
  }

  .activity-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* 根据进度显示不同颜色 */
  .activity-dot.high-progress {
    background: var(--text-success);
  }

  .activity-dot.medium-progress {
    background: var(--text-warning);
  }

  .activity-dot.low-progress {
    background: var(--text-error);
  }

  .activity-dot.new-material {
    background: var(--interactive-accent);
  }

  .calendar-day.selected .activity-dot {
    opacity: 0.9;
  }

  /* 选中日期区块 */
  .selected-date-section {
    margin-top: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .section-title svg {
    color: var(--text-muted);
  }

  /* 材料列表 */
  .materials-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .material-item-wrapper {
    display: flex;
    align-items: stretch;
    gap: 4px;
  }

  .material-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: var(--background-secondary);
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    flex: 1;
    min-width: 0;
  }

  .material-item:hover {
    background: var(--background-modifier-hover);
  }

  .material-item svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .reschedule-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    border: none;
    border-radius: 8px;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .reschedule-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .material-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .material-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .material-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .material-progress-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--interactive-accent);
    background: var(--interactive-accent-hover);
    padding: 2px 8px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .material-meta {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* 空状态 */
  .empty-state {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  /* 响应式 */
  @media (max-width: 400px) {
    .stats-panel {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-value {
      font-size: 16px;
    }
  }
</style>
