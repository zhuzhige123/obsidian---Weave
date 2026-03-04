<script lang="ts">
  import type { Deck } from '../../data/types';
  import type { DeckTreeNode } from '../../services/deck/DeckHierarchyService';
  import type { StudySession } from '../../data/study-types';
  import type { WeavePlugin } from '../../main';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  
  interface DeckStats {
    newCards: number;
    learningCards: number;
    reviewCards: number;
    memoryRate: number;
  }
  
  interface Props {
    deckTree: DeckTreeNode[];
    deckStats: Record<string, DeckStats>;
    studySessions: StudySession[];
    plugin: WeavePlugin;
    onStartStudy: (deckId: string) => void;
  }
  
  let { deckTree, deckStats, studySessions, plugin, onStartStudy }: Props = $props();
  
  // 扁平化牌组树
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
  
  function getTotalDue(deckId: string): number {
    const stats = deckStats[deckId];
    return (stats?.newCards ?? 0) + (stats?.learningCards ?? 0) + (stats?.reviewCards ?? 0);
  }
  
  // 今日牌组分类
  const urgentDecks = $derived(
    allDecks.filter(d => getTotalDue(d.id) > 20)
  );
  
  const normalDecks = $derived(
    allDecks.filter(d => {
      const due = getTotalDue(d.id);
      return due > 0 && due <= 20;
    })
  );
  
  const completedDecks = $derived(
    allDecks.filter(d => getTotalDue(d.id) === 0)
  );
  
  // 计算本周数据（最近7天）
  const weekDays = $derived(() => {
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const result = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      // 统计当天的学习卡片数
      const daySessionsCount = studySessions.filter(s => {
        const sessionDate = new Date(s.startTime);
        return sessionDate >= dayStart && sessionDate <= dayEnd;
      }).reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
      
      result.push({
        name: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
        count: daySessionsCount
      });
    }
    
    return result;
  });
  
  const maxCount = $derived(Math.max(...weekDays().map(d => d.count), 1));
  
  // 计算本月统计
  const monthStats = $derived(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSessions = studySessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      return sessionDate >= monthStart;
    });
    
    const completed = monthSessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
    const totalTime = monthSessions.reduce((sum, s) => sum + (s.totalTime || 0), 0);
    const studyTimeHours = (totalTime / 3600000).toFixed(1); // 毫秒转小时
    
    // 计算连续学习天数
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dayStart = new Date(checkDate);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const hasStudied = studySessions.some(s => {
        const sessionDate = new Date(s.startTime);
        return sessionDate >= dayStart && sessionDate <= dayEnd;
      });
      
      if (hasStudied) {
        streak++;
      } else if (i > 0) {
        break; // 连续中断
      }
    }
    
    // 计算新增卡片（本月首次学习的卡片）
    const newCardsSet = new Set<string>();
    monthSessions.forEach(s => {
      s.cardReviews?.forEach(r => {
        // 假设新卡片的条件是第一次复习
        newCardsSet.add(r.cardId);
      });
    });
    
    // 计算完成率（简化：基于今日目标）
    const todayTarget = 50; // 假设每日目标50张
    const todayCompleted = studySessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      const todayStart = new Date(today);
      return sessionDate >= todayStart;
    }).reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
    
    const completionRate = Math.min(100, Math.round((todayCompleted / todayTarget) * 100));
    
    return {
      completed,
      newCards: newCardsSet.size,
      studyTime: `${studyTimeHours} 小时`,
      streak,
      completionRate
    };
  });
  
  const todayTotal = $derived(
    urgentDecks.reduce((sum, d) => sum + getTotalDue(d.id), 0) +
    normalDecks.reduce((sum, d) => sum + getTotalDue(d.id), 0)
  );
  
  // 开始今日学习（选择第一个有待办的牌组）
  function handleStartTodayStudy() {
    if (todayTotal === 0) return;
    
    // 优先选择紧急牌组
    if (urgentDecks.length > 0) {
      onStartStudy(urgentDecks[0].id);
      return;
    }
    
    // 其次选择常规牌组
    if (normalDecks.length > 0) {
      onStartStudy(normalDecks[0].id);
    }
  }
</script>

<div class="timeline-view">
  <div class="timeline-columns">
    <!-- 今天 -->
    <div class="timeline-column today">
      <div class="column-header">
        <h2 class="column-title">
          <EnhancedIcon name="calendar" size={20} />
          今天
        </h2>
      </div>
      
      {#if urgentDecks.length > 0}
        <div class="section urgent">
          <h3 class="section-title">
            <EnhancedIcon name="alert-circle" size={16} />
            紧急 ({urgentDecks.length})
          </h3>
          <div class="deck-list">
            {#each urgentDecks as deck}
              <button 
                class="timeline-item"
                onclick={() => onStartStudy(deck.id)}
              >
                <span class="item-icon">{#if deck.icon}{deck.icon}{:else}<EnhancedIcon name="folder" size={16} />{/if}</span>
                <span class="item-name">{deck.name}</span>
                <span class="item-count">{getTotalDue(deck.id)} 张</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if normalDecks.length > 0}
        <div class="section normal">
          <h3 class="section-title">
            <EnhancedIcon name="file-text" size={16} />
            常规 ({normalDecks.length})
          </h3>
          <div class="deck-list">
            {#each normalDecks as deck}
              <button 
                class="timeline-item"
                onclick={() => onStartStudy(deck.id)}
              >
                <span class="item-icon">{#if deck.icon}{deck.icon}{:else}<EnhancedIcon name="folder" size={16} />{/if}</span>
                <span class="item-name">{deck.name}</span>
                <span class="item-count">{getTotalDue(deck.id)} 张</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if completedDecks.length > 0}
        <div class="section completed">
          <h3 class="section-title">
            <EnhancedIcon name="check-circle" size={16} />
            已完成 ({completedDecks.length})
          </h3>
        </div>
      {/if}
      
      <button 
        class="primary-action"
        onclick={handleStartTodayStudy}
        disabled={todayTotal === 0}
      >
        <EnhancedIcon name="play" size={16} />
        开始今日学习 ({todayTotal})
      </button>
    </div>
    
    <!-- 本周 -->
    <div class="timeline-column week">
      <div class="column-header">
        <h2 class="column-title">
          <EnhancedIcon name="calendar" size={20} />
          本周
        </h2>
      </div>
      
      <div class="week-plan">
        {#each weekDays() as day}
          <div class="day-item">
            <span class="day-name">{day.name}</span>
            <div class="day-bar">
              <div 
                class="bar-fill"
                style="width: {(day.count / maxCount) * 100}%"
              ></div>
            </div>
            <span class="day-count">{day.count} 张</span>
          </div>
        {/each}
      </div>
    </div>
    
    <!-- 本月 -->
    <div class="timeline-column month">
      <div class="column-header">
        <h2 class="column-title">
          <EnhancedIcon name="bar-chart-2" size={20} />
          本月
        </h2>
      </div>
      
      <div class="month-stats">
        <div class="stat-box">
          <div class="stat-icon">[S]</div>
          <div class="stat-value">{monthStats().completed}</div>
          <div class="stat-label">本月完成</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon">[+]</div>
          <div class="stat-value">{monthStats().newCards}</div>
          <div class="stat-label">本月新增</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon">[T]</div>
          <div class="stat-value">{monthStats().studyTime}</div>
          <div class="stat-label">学习时长</div>
        </div>
      </div>
      
      <div class="achievements">
        <h3 class="section-title">
          <EnhancedIcon name="award" size={16} />
          本月成就
        </h3>
        <div class="achievement-list">
          <div class="achievement-item">
            <span class="achievement-icon"><EnhancedIcon name="fire" size={24} color="#f97316" /></span>
            <div class="achievement-content">
              <div class="achievement-title">连续学习</div>
              <div class="achievement-value">{monthStats().streak} 天</div>
            </div>
          </div>
          <div class="achievement-item">
            <span class="achievement-icon"><EnhancedIcon name="bullseye" size={24} color="var(--interactive-accent)" /></span>
            <div class="achievement-content">
              <div class="achievement-title">完成率</div>
              <div class="achievement-value">{monthStats().completionRate}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .timeline-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
  }
  
  .timeline-columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    height: 100%;
  }
  
  .timeline-column {
    display: flex;
    flex-direction: column;
    background: var(--background-secondary);
    border-radius: 12px;
    padding: 20px;
    overflow-y: auto;
  }
  
  .column-header {
    margin-bottom: 20px;
  }
  
  .column-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }
  
  .section {
    margin-bottom: 20px;
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0 0 12px 0;
  }
  
  .section.urgent .section-title {
    color: var(--text-error);
  }
  
  .deck-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .timeline-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .timeline-item:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }
  
  .item-icon {
    font-size: 16px;
  }
  
  .item-name {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
    text-align: left;
  }
  
  .item-count {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }
  
  .primary-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: auto;
  }
  
  .primary-action:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }
  
  .primary-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .week-plan {
    margin-bottom: 20px;
  }
  
  .day-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }
  
  .day-name {
    width: 40px;
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .day-bar {
    flex: 1;
    height: 8px;
    background: var(--background-primary);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .bar-fill {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 4px;
    transition: width 0.3s;
  }
  
  .day-count {
    width: 50px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
    text-align: right;
  }
  
  .month-stats {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .stat-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: var(--background-primary);
    border-radius: 8px;
    text-align: center;
  }
  
  .stat-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }
  
  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .achievements {
    margin-top: 20px;
  }
  
  .achievement-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .achievement-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--background-primary);
    border-radius: 8px;
  }
  
  .achievement-icon {
    font-size: 24px;
  }
  
  .achievement-content {
    flex: 1;
  }
  
  .achievement-title {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  
  .achievement-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  /* 响应式 */
  @media (max-width: 1024px) {
    .timeline-columns {
      grid-template-columns: 1fr;
    }
  }
</style>

