<!--
  学习界面侧边栏 - 包含卡片关联入口
-->
<script lang="ts">
  import type { Card } from '../../data/types';
  import type { StudySession } from '../../data/study-types';
  import type { WeaveDataStorage } from '../../data/storage';
  interface Props {
    currentCard: Card | undefined;
    session: StudySession;
    dataStorage: WeaveDataStorage;
    onOpenRelationPanel?: () => void;
    onOpenSourceNote?: () => void;
  }
  
  let {
    currentCard,
    session,
    dataStorage,
    onOpenRelationPanel,
    onOpenSourceNote
  }: Props = $props();
  
  // 临时学习统计（从session派生）
  let studiedToday = $derived(session?.cardsReviewed || 0);
  let remainingCards = $derived(0); // 暂时硬编码为0
  
  // 格式化进度
  function formatProgress(current: number, total: number): string {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    return `${percentage}%`;
  }
</script>

<style>
  .study-sidebar {
    width: 280px;
    background: var(--background-primary);
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  
  .sidebar-section {
    padding: 16px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .sidebar-section.highlight {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  }
  
  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .sidebar-button {
    width: 100%;
    padding: 10px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    text-align: left;
    color: var(--text-normal);
    font-size: 14px;
  }
  
  .sidebar-button:hover {
    background: var(--background-secondary-alt);
    border-color: var(--interactive-accent);
  }
  
  .sidebar-button.active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }
  
  
  .button-text {
    flex: 1;
  }
  
  
  .progress-bar {
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 8px;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
    transition: width 0.3s ease;
  }
  
  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    font-size: 13px;
  }
  
  .stat-label {
    color: var(--text-muted);
  }
  
  .stat-value {
    color: var(--text-normal);
    font-weight: 600;
  }
  
  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-size: 13px;
  }
  
  .note-preview {
    background: var(--background-secondary);
    padding: 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s;
    word-break: break-word;
  }
  
  .note-preview:hover {
    background: var(--background-secondary-alt);
  }
  
</style>

<div class="study-sidebar">
  <!-- 学习进度 -->
  <div class="sidebar-section">
    <div class="section-title">
      <span>学习统计</span>
    </div>
    
    <div class="stat-item">
      <span class="stat-label">今日完成</span>
      <span class="stat-value">{studiedToday} 张</span>
    </div>
    
    <div class="stat-item">
      <span class="stat-label">剩余卡片</span>
      <span class="stat-value">{remainingCards} 张</span>
    </div>
    
    <div class="stat-item">
      <span class="stat-label">学习进度</span>
      <span class="stat-value">
        {formatProgress(studiedToday, studiedToday + remainingCards)}
      </span>
    </div>
    
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        style="width: {formatProgress(studiedToday, studiedToday + remainingCards)}"
      ></div>
    </div>
  </div>
  
  <!-- 来源笔记 -->
  {#if currentCard?.sourceFile}
    <div class="sidebar-section">
      <div class="section-title">
        <span>来源笔记</span>
      </div>
      
      <div 
        class="note-preview"
        onclick={onOpenSourceNote}
        title="点击打开源笔记"
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && onOpenSourceNote?.()}
      >
        {currentCard.sourceFile.split('/').pop()?.replace('.md', '') || '未知笔记'}
      </div>
    </div>
  {/if}
  
  <!-- 卡片关联（核心功能） -->
  <div class="sidebar-section highlight">
    <div class="section-title">
      <span>卡片关联</span>
    </div>
    
    {#if currentCard}
      <button 
        class="sidebar-button active"
        onclick={onOpenRelationPanel}
      >
        <span class="button-text">卡片关联</span>
        <span style="font-size: 0.75em; color: var(--text-faint); margin-left: 4px;">(管理|图谱)</span>
      </button>
    {:else}
      <div class="empty-state">
        当前没有卡片
      </div>
    {/if}
  </div>
  
  <!-- 知识图谱（未来功能） -->
  <div class="sidebar-section">
    <div class="section-title">
      <span>知识图谱</span>
    </div>
    
    <button class="sidebar-button">
      <span class="button-text">查看笔记图谱</span>
    </button>
    
  </div>
  
  <!-- 学习设置 -->
  <div class="sidebar-section">
    <div class="section-title">
      <span>学习设置</span>
    </div>
    
    <div class="stat-item">
      <span class="stat-label">复习模式</span>
      <span class="stat-value">顺序</span>
    </div>
    
    <div class="stat-item">
      <span class="stat-label">自动播放</span>
      <span class="stat-value">关闭</span>
    </div>
    
    <div class="stat-item">
      <span class="stat-label">显示关联</span>
      <span class="stat-value">开启</span>
    </div>
  </div>
</div>
