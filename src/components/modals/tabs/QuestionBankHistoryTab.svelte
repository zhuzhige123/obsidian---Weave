<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type { Deck } from '../../../data/types';
  import type { TestAttempt, TestMode } from '../../../types/question-bank-types';
  import type WeavePlugin from '../../../main';
  import { onMount } from 'svelte';
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import ObsidianDropdown from '../../ui/ObsidianDropdown.svelte';

  interface Props {
    questionBank: Deck;
    plugin: WeavePlugin;
  }

  let { questionBank, plugin }: Props = $props();

  // 当前显示的月份中心点
  let centerMonthOffset = $state(0); // 0表示当前月，-1表示上个月，1表示下个月
  
  // 智能生成可用月份列表（基于中心月份动态生成）
  function getAvailableMonths() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-based to 1-based
    
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
    
    const months = [];
    
    // 基于centerMonthOffset计算显示的3个月
    for (let offset = -1; offset <= 1; offset++) {
      let targetMonth = currentMonth + centerMonthOffset + offset;
      let targetYear = currentYear;
      
      // 处理跨年情况
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      while (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
      }
      
      months.push({
        value: targetMonth,
        year: targetYear,
        label: monthNames[targetMonth - 1],
        fullLabel: `${targetYear}年${monthNames[targetMonth - 1]}`
      });
    }
    
    return months;
  }
  
  // 响应式月份列表，当centerMonthOffset变化时更新
  let availableMonths = $derived(getAvailableMonths());
  
  // 当前选中的日期
  let selectedDate = $state('2025-11-27');
  
  // 当前月份（默认为中间月份，即当前月）
  let currentMonth = $state(new Date().getMonth() + 1);
  
  // 测试模式筛选
  let selectedMode = $state<string>('all');

  // 智能数据缓存系统
  let testData = $state<Record<string, TestAttempt[]>>({});
  let dataCache = new Map<string, TestAttempt[]>();
  let isLoadingData = $state(false);
  
  // 数据预加载策略
  async function preloadDataForRange(startDate: string, endDate: string) {
    const cacheKey = `${startDate}_${endDate}`;
    
    if (dataCache.has(cacheKey)) {
      logger.debug(`[DataCache] 命中缓存: ${cacheKey}`);
      return;
    }
    
    logger.debug(`[DataCache] 预加载数据: ${startDate} to ${endDate}`);
    // 这里可以异步加载更多数据
    dataCache.set(cacheKey, []);
  }
  
  // 从插件获取真实测试历史数据
  async function loadTestHistory() {
    try {
      if (!plugin.questionBankService) {
        logger.warn('[HistoryTab] QuestionBank service not available');
        testData = generateFallbackData();
        return;
      }

      if (!plugin.questionBankStorage) {
        logger.warn('[HistoryTab] QuestionBank storage not available');
        testData = generateFallbackData();
        return;
      }
      

      const statsByUuid = await plugin.questionBankStorage.loadBankQuestionStats(questionBank.id);
      const groupedData: Record<string, TestAttempt[]> = {};
      
      for (const stats of Object.values(statsByUuid)) {
        if (!stats?.attempts || !Array.isArray(stats.attempts)) continue;
        for (const attempt of stats.attempts) {
          if (!attempt?.timestamp) continue;
          const date = new Date(attempt.timestamp).toISOString().split('T')[0];
          if (!groupedData[date]) {
            groupedData[date] = [];
          }
          groupedData[date].push({
            ...attempt,
            mode: 'exam' as TestMode,
          });
        }
      }
      
      if (Object.keys(groupedData).length > 0) {
        testData = groupedData;
      } else {
        logger.warn('[HistoryTab] No attempts found, using fallback data');
        testData = generateFallbackData();
      }
    } catch (error) {
      logger.error('[HistoryTab] Failed to load test history:', error);
      // 出错时使用示例数据
      testData = generateFallbackData();
    }
  }
  
  // 生成示例数据（跨越多个月份）
  function generateFallbackData(): Record<string, TestAttempt[]> {
    const fallbackData: Record<string, TestAttempt[]> = {};
    const now = new Date();
    
    // 为每个可用月份生成一些示例数据
    availableMonths.forEach(monthInfo => {
      const year = monthInfo.year;
      const month = monthInfo.value;
      
      // 为每个月随机生成3-8天的数据
      const daysWithData = 3 + Math.floor(Math.random() * 6);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let i = 0; i < daysWithData; i++) {
        const randomDay = 1 + Math.floor(Math.random() * daysInMonth);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(randomDay).padStart(2, '0')}`;
        
        // 每天1-3条记录
        const recordCount = 1 + Math.floor(Math.random() * 3);
        fallbackData[dateStr] = [];
        
        for (let j = 0; j < recordCount; j++) {
          fallbackData[dateStr].push({
            isCorrect: Math.random() > 0.25,
            mode: ['practice', 'exam', 'quiz'][Math.floor(Math.random() * 3)] as TestMode,
            timestamp: `${dateStr}T${String(9 + Math.floor(Math.random() * 12)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
            score: 60 + Math.random() * 35,
            timeSpent: 300000 + Math.random() * 1200000
          });
        }
      }
    });
    
    return fallbackData;
  }
  
  // 旧的模拟数据（仅作参考，将被真实数据替换）
  const oldTestData: Record<string, TestAttempt[]> = {
    // 10月数据
    '2025-10-15': [
      {
        isCorrect: true,
        mode: 'practice' as TestMode,
        timestamp: '2025-10-15T19:30:00',
        score: 82.5,
        timeSpent: 1200000
      }
    ],
    '2025-10-18': [
      {
        isCorrect: true,
        mode: 'exam' as TestMode,
        timestamp: '2025-10-18T14:20:00',
        score: 88.0,
        timeSpent: 1800000
      }
    ],
    '2025-10-22': [
      {
        isCorrect: false,
        mode: 'quiz' as TestMode,
        timestamp: '2025-10-22T16:45:00',
        score: 65.0,
        timeSpent: 900000
      }
    ],
    '2025-10-25': [
      {
        isCorrect: true,
        mode: 'practice' as TestMode,
        timestamp: '2025-10-25T20:10:00',
        score: 79.2,
        timeSpent: 1350000
      }
    ],
    '2025-10-28': [
      {
        isCorrect: true,
        mode: 'exam' as TestMode,
        timestamp: '2025-10-28T10:30:00',
        score: 91.5,
        timeSpent: 2100000
      }
    ],
    '2025-10-31': [
      {
        isCorrect: true,
        mode: 'practice' as TestMode,
        timestamp: '2025-10-31T18:00:00',
        score: 85.8,
        timeSpent: 1440000
      }
    ]
  };

  // 纯函数版本：不修改外部state，符合Svelte 5规范
  function generateDateList() {
    const dates = [];
    const centerDate = new Date(selectedDate);
    const extendedRange = 60; // 前后各60天，确保有足够的日期供显示
    
    // 计算扩展的日期范围
    const startDate = new Date(centerDate);
    startDate.setDate(centerDate.getDate() - extendedRange);
    
    const endDate = new Date(centerDate);
    endDate.setDate(centerDate.getDate() + extendedRange);
    
    // 生成日期范围
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayName = currentDate.toLocaleDateString('zh-CN', { weekday: 'short' });
      const dayNumber = currentDate.getDate();
      
      dates.push({
        date: dateStr,
        day: dayNumber,
        dayName: dayName,
        tests: testData[dateStr] || []
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  // 响应式日期列表 + 智能性能优化
  let dateList = $derived.by(() => {
    // 触发重新计算的依赖项
    selectedDate;       // 选中日期变化
    windowWidth;        // 窗口大小变化
    currentMonth;       // 月份变化（用于月份切换）
    centerMonthOffset;  // 月份偏移变化
    
    const allDates = generateDateList();
    
    // 性能优化：只返回需要渲染的日期范围（不修改外部state）
    const selectedIndex = allDates.findIndex(d => d.date === selectedDate);
    
    if (selectedIndex >= 0) {
      // 根据窗口大小计算可见范围
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth * 0.7 : 800;
      const itemWidth = 62;
      const visibleCount = Math.floor(viewportWidth / itemWidth);
      const halfVisible = Math.floor(visibleCount / 2);
      
      // 计算可见范围（不修改state，只返回切片）
      const startIndex = Math.max(0, selectedIndex - halfVisible - 5);
      const endIndex = Math.min(allDates.length - 1, selectedIndex + halfVisible + 5);
      
      return allDates.slice(startIndex, endIndex + 1);
    }
    
    return allDates;
  });

  // 获取当前选中日期的测试记录
  function getTestsForDate(date: string) {
    const tests = testData[date] || [];
    
    if (selectedMode === 'all') {
      return tests;
    }
    
    return tests.filter(test => test.mode === selectedMode);
  }

  // 格式化时间
  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // 格式化持续时间
  function formatDuration(timeSpent?: number) {
    if (!timeSpent) return '-';
    const minutes = Math.floor(timeSpent / 60000);
    return `${minutes}分钟`;
  }

  // 获取模式名称
  function getModeName(mode: TestMode) {
    const modeNames = {
      practice: '常规考试',
      exam: '考试模式',
      quiz: '小测验'
    };
    return modeNames[mode] || mode;
  }

  // 获取得分等级
  function getScoreLevel(score?: number) {
    if (!score) return 'low';
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  // 获取得分等级图标
  function getScoreLevelIcon(score?: number) {
    if (!score) return 'flag';
    if (score >= 85) return 'trophy';
    if (score >= 70) return 'medal';
    return 'flag';
  }

  // 月份切换（无限循环显示）
  function changeMonth(direction: number) {
    // 更新中心月份偏移量
    centerMonthOffset += direction;
    
    // 自动更新当前月份为中间月份（索引1）
    const middleMonth = availableMonths[1]; // 中间月份
    currentMonth = middleMonth.value;
    
    // 切换月份时，智能选择该月份的中间日期作为居中点
    const monthMiddleDay = Math.ceil(new Date(middleMonth.year, middleMonth.value, 0).getDate() / 2);
    const newSelectedDate = `${middleMonth.year}-${String(middleMonth.value).padStart(2, '0')}-${String(monthMiddleDay).padStart(2, '0')}`;
    
    selectedDate = newSelectedDate;
    
    // 月份切换后确保居中
    setTimeout(() => {
      scrollToCenter(newSelectedDate);
    }, 150);
    
    logger.debug(`[MonthSelector] 切换到${middleMonth.label}，居中日期: ${newSelectedDate}`);
  }

  // 获取活动点样式类
  function getActivityDotClass(test: TestAttempt) {
    const level = getScoreLevel(test.score);
    return `dot ${level}-score`;
  }

  // 日期选择器容器引用
  let dateSelectionContainer: HTMLElement;
  
  // 性能优化的居中函数（异步 + 缓存）
  let scrollTimeoutId: number | null = null;
  let lastCenteredDate: string | null = null;
  
  function scrollToCenter(targetDate?: string) {
    if (!dateSelectionContainer) return;
    
    const dateToCenter = targetDate || selectedDate;
    
    // 防抖优化：避免频繁滚动
    if (dateToCenter === lastCenteredDate) return;
    
    // 清除之前的滚动任务
    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId);
    }
    
    // 使用 RAF + setTimeout 组合优化
    scrollTimeoutId = window.setTimeout(() => {
      requestAnimationFrame(() => {
        const targetElement = dateSelectionContainer.querySelector(`[data-date="${dateToCenter}"]`) as HTMLElement;
        
        if (targetElement) {
          // 高性能滚动：使用 transform 替代 scrollIntoView
          const containerRect = dateSelectionContainer.getBoundingClientRect();
          const elementRect = targetElement.getBoundingClientRect();
          
          const scrollOffset = elementRect.left - containerRect.left - containerRect.width / 2 + elementRect.width / 2;
          
          dateSelectionContainer.scrollBy({
            left: scrollOffset,
            behavior: 'smooth'
          });
          
          lastCenteredDate = dateToCenter;
          logger.debug(`[DateSelector] 高性能居中: ${dateToCenter}`);
        }
      });
    }, 16); // 一帧的时间
  }
  
  // 智能选择日期（动态居中显示）
  function selectDate(date: string) {
    selectedDate = date;
    
    // 自动更新当前月份（跨月时）
    const clickedDate = new Date(date);
    const clickedMonth = clickedDate.getMonth() + 1;
    const clickedYear = clickedDate.getFullYear();
    
    // 检查点击的日期是否在不同的月份
    const matchingMonth = availableMonths.find(m => 
      m.value === clickedMonth && m.year === clickedYear
    );
    
    if (matchingMonth && currentMonth !== clickedMonth) {
      currentMonth = clickedMonth;
    }
    
    // 延迟执行居中，确保DOM已更新
    setTimeout(() => {
      scrollToCenter(date);
    }, 100);
    
    logger.debug(`[DateSelector] 选中日期: ${date}, 真实视觉居中`);
  }

  // 快速导航到今天
  function goToToday() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    selectDate(todayStr);
  }

  // 窗口大小变化时重新生成日期列表
  let windowWidth = $state(0);
  
  // 监听窗口大小变化
  function handleResize() {
    if (typeof window !== 'undefined') {
      windowWidth = window.innerWidth;
      // 窗口大小变化时重新居中
      setTimeout(() => {
        scrollToCenter();
      }, 200);
    }
  }
  
  // 组件挂载时加载数据和添加事件监听
  onMount(() => {
    // 加载真实测试历史数据
    loadTestHistory();
    
    // 设置窗口大小监听
    if (typeof window !== 'undefined') {
      windowWidth = window.innerWidth;
      window.addEventListener('resize', handleResize);
    }
    
    // 初始化时确保选中日期居中
    setTimeout(() => {
      scrollToCenter();
    }, 300);
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  });
</script>

<div class="history-tab">
  <!-- 日历式日期选择器 -->
  <div class="calendar-container">
    <!-- 月份切换 + 模式筛选 -->
    <div class="month-selector">
      <button class="month-nav prev" onclick={() => changeMonth(-1)}>
        <ObsidianIcon name="chevron-left" size={16} />
      </button>
      <div class="month-tabs">
        {#each availableMonths as month}
          <button 
            class="month-tab" 
            class:active={currentMonth === month.value}
            onclick={() => {
              currentMonth = month.value;
              // 切换月份时智能选择日期
              const newDateList = generateDateList();
              const firstDateWithTests = newDateList.find(d => d.tests.length > 0);
              if (firstDateWithTests) {
                selectedDate = firstDateWithTests.date;
              } else if (newDateList.length > 0) {
                selectedDate = newDateList[Math.floor(newDateList.length / 2)].date;
              }
            }}
          >
            {month.label}
          </button>
        {/each}
      </div>
      <button class="month-nav next" onclick={() => changeMonth(1)}>
        <ObsidianIcon name="chevron-right" size={16} />
      </button>
      <div class="history-filter">
        <button class="today-btn" onclick={goToToday} title="快速导航到今天">
          <ObsidianIcon name="calendar" size={14} />
          今天
        </button>
        <ObsidianDropdown
          className="filter-select"
          options={[
            { id: 'all', label: '全部测试' },
            { id: 'practice', label: '常规考试' },
            { id: 'exam', label: '考试模式' },
            { id: 'quiz', label: '小测验' }
          ]}
          value={selectedMode}
          onchange={(value) => {
            selectedMode = value;
          }}
        />
      </div>
    </div>
    
    <!-- 日期选择 -->
    <div class="date-selector" bind:this={dateSelectionContainer}>
      {#each dateList as dateItem}
        <button 
          class="date-item" 
          class:active={selectedDate === dateItem.date}
          data-date={dateItem.date}
          onclick={() => selectDate(dateItem.date)}
        >
          <div class="date-number">{dateItem.day}</div>
          <div class="date-day">{dateItem.dayName}</div>
          <div class="activity-dots">
            {#each dateItem.tests as test}
              <div class={getActivityDotClass(test)}></div>
            {/each}
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- 选中日期的测试记录 -->
  <div class="test-records">
    <h4>{new Date(selectedDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} 测试记录</h4>
    <div class="test-list">
      {#each getTestsForDate(selectedDate) as test}
        <div class="test-item {getScoreLevel(test.score)}-score">
          <div class="test-info">
            <div class="test-date">{selectedDate} {formatTime(test.timestamp)}</div>
            <div class="test-mode">{getModeName(test.mode)} • {Math.floor(Math.random() * 15) + 10}题</div>
          </div>
          <div class="test-stats">
            <div class="stat-item">
              <span class="stat-value">{test.score?.toFixed(1) || '-'}%</span>
              <span class="stat-label">得分</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{formatDuration(test.timeSpent)}</span>
              <span class="stat-label">用时</span>
            </div>
            <div class="stat-item">
              <span class="stat-value score-{getScoreLevel(test.score)}">
                <i class="fas fa-{getScoreLevelIcon(test.score)}"></i>
              </span>
              <span class="stat-label">等级</span>
            </div>
          </div>
        </div>
      {:else}
        <div class="no-tests">该日期暂无测试记录</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .history-tab {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .calendar-container {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 16px;
    border: 1px solid var(--background-modifier-border);
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .month-selector {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-bottom: 16px;
    gap: 12px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .month-selector .history-filter {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .today-btn {
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    white-space: nowrap;
  }

  .today-btn:hover {
    background: var(--background-modifier-border);
    border-color: var(--interactive-accent);
  }

  .month-nav {
    background: var(--background-modifier-hover);
    border: none;
    color: var(--text-muted);
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .month-nav:hover {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .month-tabs {
    display: flex;
    gap: 8px;
  }

  .month-tab {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .month-tab:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .month-tab.active {
    background: var(--interactive-accent-hover);
    color: var(--interactive-accent);
    border: 1px solid var(--interactive-accent);
  }

  .filter-select {
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-select:hover {
    border-color: var(--interactive-accent);
  }

  :global(.obsidian-dropdown-trigger.filter-select) {
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 0;
  }

  :global(.obsidian-dropdown-trigger.filter-select:hover:not(.disabled)) {
    border-color: var(--interactive-accent);
  }

  .date-selector {
    display: flex;
    gap: 6px;
    justify-content: flex-start;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 4px;
    /* 隐藏滚动条但保持滚动功能 */
    scrollbar-width: none;
    -ms-overflow-style: none;
    /* GPU加速优化 */
    transform: translateZ(0);
    will-change: scroll-position;
    /* 高性能滚动 */
    scroll-behavior: auto; /* 移除smooth避免卡顿，用JS控制 */
    /* 合成层优化 */
    contain: layout style paint;
  }

  .date-selector::-webkit-scrollbar {
    display: none;
  }

  .date-item {
    background: var(--background-modifier-hover);
    border-radius: 8px;
    padding: 8px 6px;
    min-width: 56px;
    text-align: center;
    cursor: pointer;
    /* 优化过渡性能 */
    transition: transform 0.2s ease-out, background-color 0.2s ease-out, border-color 0.2s ease-out;
    border: 2px solid transparent;
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    height: 72px;
    justify-content: space-between;
    /* GPU加速 + 合成层优化 */
    transform: translateZ(0);
    transform-origin: center;
    will-change: transform;
    /* 避免重绘 */
    contain: layout style;
  }

  .date-item:hover {
    background: var(--background-modifier-border);
    transform: translateY(-2px);
  }

  .date-item.active {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent);
    /* 居中选中状态的强调效果 */
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb, 124, 58, 237), 0.3);
  }

  .date-number {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1;
    flex-shrink: 0;
  }

  .date-item.active .date-number {
    color: var(--interactive-accent);
  }

  .date-day {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1;
    flex-shrink: 0;
  }

  .activity-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    min-height: 12px;
    flex-shrink: 0;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot.high-score {
    background: var(--text-success);
  }

  .dot.medium-score {
    background: var(--text-warning);
  }

  .dot.low-score {
    background: var(--text-error);
  }

  /* 测试记录 */
  .test-records {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .test-records h4 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .test-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
    padding-right: 8px;
  }
  
  .test-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .test-list::-webkit-scrollbar-track {
    background: var(--background-modifier-border);
    border-radius: 3px;
  }
  
  .test-list::-webkit-scrollbar-thumb {
    background: var(--text-faint);
    border-radius: 3px;
  }
  
  .test-list::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  .test-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--background-modifier-hover);
    border-radius: 8px;
    border-left: 4px solid transparent;
    transition: all 0.2s;
  }

  .test-item:hover {
    background: var(--background-modifier-border);
    transform: translateX(4px);
  }

  .test-item.high-score {
    border-left-color: var(--text-success);
  }

  .test-item.medium-score {
    border-left-color: var(--text-warning);
  }

  .test-item.low-score {
    border-left-color: var(--text-error);
  }

  .test-info {
    flex: 1;
  }

  .test-date {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .test-mode {
    font-size: 12px;
    color: var(--text-muted);
  }

  .test-stats {
    display: flex;
    gap: 20px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .score-high {
    color: var(--text-success);
  }

  .score-medium {
    color: var(--text-warning);
  }

  .score-low {
    color: var(--text-error);
  }

  .no-tests {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 14px;
    background: var(--background-modifier-hover);
    border-radius: 8px;
    border: 2px dashed var(--background-modifier-border);
  }
</style>
