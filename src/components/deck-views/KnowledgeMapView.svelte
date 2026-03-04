<script lang="ts">
  import type { DeckTreeNode } from "../../services/deck/DeckHierarchyService";
  import type { DeckStats } from "../../data/types";
  import type { StudySession } from "../../data/study-types";
  import type WeavePlugin from "../../main";
  import { getColorSchemeForDeck } from "../../config/card-color-schemes";
  import ObsidianIcon from "../ui/ObsidianIcon.svelte";
  import DeckGridCard from "./DeckGridCard.svelte";
  import { Menu } from "obsidian";
  import { tr } from '../../utils/i18n';

  interface Props {
    deckTree: DeckTreeNode[];
    deckStats: Record<string, DeckStats>;
    studySessions: StudySession[];
    plugin: WeavePlugin;
    onStartStudy?: (deckId: string) => void;
    onRefreshData?: () => void;
    // 菜单操作回调
    onAdvanceStudy?: (deckId: string) => Promise<void>;
    onOpenDeckAnalytics?: (deckId: string) => void;
    onCreateSubdeck?: (deckId: string) => void;
    onMoveDeck?: (deckId: string) => void;
    onEditDeck?: (deckId: string) => void;
    onDeleteDeck?: (deckId: string) => void;
  }

  let { 
    deckTree, 
    deckStats, 
    studySessions,
    plugin,
    onStartStudy,
    onRefreshData,
    onAdvanceStudy,
    onOpenDeckAnalytics,
    onCreateSubdeck,
    onMoveDeck,
    onEditDeck,
    onDeleteDeck
  }: Props = $props();

  // 🌍 响应式翻译函数
  let t = $derived($tr);

  // 扁平化牌组树并添加层级信息
  interface FlatDeck {
    node: DeckTreeNode;
    level: number; // 0=基础, 1=中级, 2=高级, 3=专家
    stats: DeckStats;
    progress: number; // 0-100
    status: 'locked' | 'in-progress' | 'completed';
  }

  // 计算牌组学习完成度（学习中+复习的卡片 / 总卡片）
  function calculateProgress(deckId: string): number {
    const stats = deckStats[deckId];
    if (!stats) return 0;
    
    const total = stats.newCards + stats.learningCards + stats.reviewCards;
    if (total === 0) return 100; // 没有卡片视为完成
    
    // 学习完成度 = (学习中的 + 已进入复习的) / 总数
    // 这样可以真实反映学习进度，而不是只算复习卡片
    const learned = stats.learningCards + stats.reviewCards;
    return Math.round((learned / total) * 100);
  }
  
  // 🆕 计算牌组掌握度（基于记忆率，更科学）
  function calculateMasteryRate(deckId: string): number {
    const stats = deckStats[deckId];
    if (!stats || !stats.memoryRate) return 0;
    return Math.round(stats.memoryRate * 100);
  }

  // 判断牌组状态
  function getDeckStatus(deckId: string, progress: number): 'locked' | 'in-progress' | 'completed' {
    if (progress === 100) return 'completed';
    if (progress > 0) return 'in-progress';
    
    const stats = deckStats[deckId];
    if (!stats || (stats.newCards === 0 && stats.learningCards === 0 && stats.reviewCards === 0)) {
      return 'locked';
    }
    return 'in-progress';
  }

  // 获取牌组层级（优先使用knowledgeLevel字段，否则根据名称推断）
  function getDeckLevel(deck: any): number {
    // 优先使用显式设置的knowledgeLevel
    if (deck.knowledgeLevel !== undefined && deck.knowledgeLevel !== null) {
      return deck.knowledgeLevel;
    }
    
    // 否则根据名称推断
    const name = deck.name.toLowerCase();
    if (name.includes('基础') || name.includes('入门') || name.includes('foundation') || name.includes('basic')) {
      return 0;
    }
    if (name.includes('中级') || name.includes('intermediate') || name.includes('进阶')) {
      return 1;
    }
    if (name.includes('高级') || name.includes('advanced') || name.includes('专精')) {
      return 2;
    }
    if (name.includes('专家') || name.includes('expert') || name.includes('master')) {
      return 3;
    }
    
    // 默认显示在基础级别（之前创建的牌组统一显示为基础级）
    return 0;
  }

  // 扁平化牌组树
  const flatDecks = $derived.by(() => {
    const result: FlatDeck[] = [];
    
    function flatten(nodes: DeckTreeNode[], depth = 0) {
      for (const node of nodes) {
        const level = getDeckLevel(node.deck);
        const stats = deckStats[node.deck.id] || { newCards: 0, learningCards: 0, reviewCards: 0, totalCards: 0, todayNew: 0, todayReview: 0, todayTime: 0, totalReviews: 0, totalTime: 0, memoryRate: 0, averageEase: 0, forecastDays: {} };
        const progress = calculateProgress(node.deck.id);
        const status = getDeckStatus(node.deck.id, progress);
        
        result.push({
          node,
          level,
          stats,
          progress,
          status
        });
        
        if (node.children.length > 0) {
          flatten(node.children, depth + 1);
        }
      }
    }
    
    flatten(deckTree);
    return result;
  });

  // 按层级分组
  const decksByLevel = $derived.by(() => {
    const grouped = new Map<number, FlatDeck[]>();
    
    for (const deck of flatDecks) {
      if (!grouped.has(deck.level)) {
        grouped.set(deck.level, []);
      }
      grouped.get(deck.level)!.push(deck);
    }
    
    return grouped;
  });

  // 计算每个层级的总体进度（学习完成度）
  function getLevelProgress(level: number): number {
    const decks = decksByLevel.get(level) || [];
    if (decks.length === 0) return 0;
    
    const totalProgress = decks.reduce((sum, deck) => sum + deck.progress, 0);
    return Math.round(totalProgress / decks.length);
  }
  
  // 🆕 计算每个层级的平均记忆率（掌握度）
  function getLevelMasteryRate(level: number): number {
    const decks = decksByLevel.get(level) || [];
    if (decks.length === 0) return 0;
    
    // 只统计有复习卡片的牌组（已学习过的）
    const learnedDecks = decks.filter(d => d.stats.reviewCards > 0);
    if (learnedDecks.length === 0) return 0;
    
    const totalMemoryRate = learnedDecks.reduce((sum, deck) => {
      return sum + (deck.stats.memoryRate || 0);
    }, 0);
    
    return Math.round((totalMemoryRate / learnedDecks.length) * 100);
  }

  // 层级配置
  const levels = [
    { 
      id: 0, 
      name: '基础级', 
      englishName: 'Foundation',
      icon: '🌱',  // 保留萄芝小草emoji
      iconType: 'emoji',
      color: '#10b981',
      colorRgb: '16, 185, 129'
    },
    { 
      id: 1, 
      name: '中级', 
      englishName: 'Intermediate',
      icon: 'book-open',  // Obsidian图标
      iconType: 'obsidian',
      color: '#3b82f6',
      colorRgb: '59, 130, 246'
    },
    { 
      id: 2, 
      name: '高级', 
      englishName: 'Advanced',
      icon: 'zap',  // Obsidian图标
      iconType: 'obsidian',
      color: '#8b5cf6',
      colorRgb: '139, 92, 246'
    },
    { 
      id: 3, 
      name: '专家级', 
      englishName: 'Expert',
      icon: 'crown',  // Obsidian图标
      iconType: 'obsidian',
      color: '#ec4899',
      colorRgb: '236, 72, 153'
    }
  ];

  // 获取层级配置
  function getLevelConfig(level: number) {
    return levels.find(l => l.id === level) || levels[0];
  }

  // 开始学习
  function handleStartStudy(deckId: string) {
    onStartStudy?.(deckId);
  }

  // 获取牌组配色方案
  function getDeckColorScheme(deckId: string) {
    return getColorSchemeForDeck(deckId);
  }

  // 显示牌组菜单（完整版）
  async function showDeckMenu(event: MouseEvent, deckId: string) {
    event.stopPropagation();
    const menu = new Menu();

    // 查找牌组
    const findDeck = (nodes: DeckTreeNode[]): any => {
      for (const node of nodes) {
        if (node.deck.id === deckId) return node.deck;
        if (node.children.length > 0) {
          const found = findDeck(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    const deck = findDeck(deckTree);
    if (!deck) return;

    // 🆕 提前学习功能
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.advanceStudy'))
        .setIcon("fast-forward")
        .onClick(async () => await onAdvanceStudy?.(deckId))
    );

    // 📊 牌组分析
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.deckAnalytics'))
        .setIcon("bar-chart-2")
        .onClick(() => onOpenDeckAnalytics?.(deckId))
    );

    menu.addSeparator();

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

    menu.addSeparator();

    // 更改知识体系级别
    menu.addItem((item) => {
      item
        .setTitle("更改知识体系级别")
        .setIcon("layers");
      
      // 创建子菜单
      const submenu = (item as any).setSubmenu();
      
      // 未分类选项
      submenu.addItem((subitem: any) =>
        subitem
          .setTitle("未分类")
          .setIcon(deck.knowledgeLevel === undefined ? "check" : "")
          .onClick(async () => {
            deck.knowledgeLevel = undefined;
            await plugin.dataStorage.saveDeck(deck);
            onRefreshData?.();
          })
      );
      
      // 各级别选项
      const levelOptions = [
        { value: 0, name: "🌱 基础级 Foundation" },
        { value: 1, name: "📖 中级 Intermediate" },
        { value: 2, name: "⚡ 高级 Advanced" },
        { value: 3, name: "👑 专家级 Expert" }
      ];
      
      levelOptions.forEach(option => {
        submenu.addItem((subitem: any) =>
          subitem
            .setTitle(option.name)
            .setIcon(deck.knowledgeLevel === option.value ? "check" : "")
            .onClick(async () => {
              deck.knowledgeLevel = option.value as 0 | 1 | 2 | 3;
              await plugin.dataStorage.saveDeck(deck);
              onRefreshData?.();
            })
        );
      });
    });

    menu.addSeparator();

    // 牌组编辑
    menu.addItem((item) =>
      item
        .setTitle(t('decks.menu.editDeck'))
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

    menu.showAtMouseEvent(event);
  }
</script>

<div class="knowledge-map-container">
  <div class="knowledge-map-header">
    <h1 class="knowledge-map-title">
      <ObsidianIcon name="map" size={28} />
      知识体系路线图
    </h1>
    <p class="knowledge-map-subtitle">系统化学习路径 · 从基础到专家</p>
  </div>

  <!-- 总体进度 -->
  <div class="overall-progress-panel">
    <div class="panel-header">
      <h2 class="panel-title">
        <ObsidianIcon name="trending-up" size={20} />
        学习进度总览
      </h2>
      <div class="progress-legend">
        <span class="legend-item">
          <span class="legend-circle outer"></span>
          学习完成度
        </span>
        <span class="legend-item">
          <span class="legend-circle inner"></span>
          记忆掌握率
        </span>
      </div>
    </div>
    <div class="level-progress-grid">
      {#each levels as level}
        {@const progress = getLevelProgress(level.id)}
        {@const masteryRate = getLevelMasteryRate(level.id)}
        {@const deckCount = decksByLevel.get(level.id)?.length || 0}
        <div class="level-progress-item">
          <div class="level-progress-circle" title="">
            <!-- 详细信息悬浮窗 -->
            {#if masteryRate > 0}
              <div class="progress-tooltip">
                <div class="tooltip-item">
                  <span class="tooltip-label">学习完成度</span>
                  <span class="tooltip-value">{progress}%</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label">记忆掌握率</span>
                  <span class="tooltip-value highlight">{masteryRate}%</span>
                </div>
              </div>
            {/if}
            <svg width="120" height="120" viewBox="0 0 120 120">
              <!-- 外环背景 -->
              <circle 
                cx="60" 
                cy="60" 
                r="50" 
                fill="none" 
                stroke="rgba(255,255,255,0.08)" 
                stroke-width="8"
              />
              <!-- 外环进度（学习完成度）-->
              <circle 
                cx="60" 
                cy="60" 
                r="50" 
                fill="none" 
                stroke={level.color}
                stroke-width="8" 
                stroke-dasharray="314" 
                stroke-dashoffset={314 * (1 - progress / 100)}
                transform="rotate(-90 60 60)" 
                stroke-linecap="round"
                style="opacity: 0.9;"
              />
              
              {#if masteryRate > 0}
                <!-- 内环背景 -->
                <circle 
                  cx="60" 
                  cy="60" 
                  r="35" 
                  fill="none" 
                  stroke="rgba(255,165,0,0.1)" 
                  stroke-width="6"
                />
                <!-- 内环进度（记忆掌握率 - 橙色系）-->
                <circle 
                  cx="60" 
                  cy="60" 
                  r="35" 
                  fill="none" 
                  stroke="#ff9500"
                  stroke-width="6" 
                  stroke-dasharray="220" 
                  stroke-dashoffset={220 * (1 - masteryRate / 100)}
                  transform="rotate(-90 60 60)" 
                  stroke-linecap="round"
                  style="opacity: 0.85;"
                />
              {/if}
            </svg>
            <div class="circle-text">
              {#if masteryRate > 0}
                <div class="main-value">{masteryRate}%</div>
              {:else}
                <div class="main-value">{progress}%</div>
              {/if}
            </div>
          </div>
          <div class="level-name">
            {#if level.iconType === 'emoji'}
              {level.icon}
            {:else}
              <ObsidianIcon name={level.icon} size={16} />
            {/if}
            {level.name}
          </div>
          <div class="deck-count">{deckCount} 个牌组</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- 技能树 -->
  <div class="skill-tree">
    {#each levels as level}
      {@const levelDecks = decksByLevel.get(level.id) || []}
      {#if levelDecks.length > 0}
        <div class="level-section">
          <div class="level-header">
            <div 
              class="level-badge" 
              style="--level-color: {level.color}; --level-color-rgb: {level.colorRgb}"
            >
              <span class="level-icon">
                {#if level.iconType === 'emoji'}
                  {level.icon}
                {:else}
                  <ObsidianIcon name={level.icon} size={24} />
                {/if}
              </span>
              <span class="level-text">{level.name} {level.englishName}</span>
            </div>
          </div>

          <div class="skill-grid">
            {#each levelDecks as flatDeck}
              {@const { node, stats } = flatDeck}
              {@const colorScheme = getColorSchemeForDeck(node.deck.id)}
              <DeckGridCard
                deck={node.deck}
                stats={stats}
                colorScheme={colorScheme}
                categoryName={level.name}
                onStudy={() => handleStartStudy(node.deck.id)}
                onMenu={(e) => showDeckMenu(e, node.deck.id)}
              />
            {/each}
          </div>
        </div>
      {/if}
    {/each}

    <!-- 空状态 -->
    {#if flatDecks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <ObsidianIcon name="map" size={64} />
        </div>
        <div class="empty-title">还没有知识体系牌组</div>
        <div class="empty-desc">创建牌组时，在名称中包含"基础"、"中级"、"高级"或"专家"等关键词，系统会自动识别并组织到相应层级。</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .knowledge-map-container {
    padding: 40px 20px;
    max-width: 1600px;
    margin: 0 auto;
    background: var(--background-primary);
    min-height: 100vh;
  }

  .knowledge-map-header {
    text-align: center;
    margin-bottom: 60px;
  }

  .knowledge-map-title {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--interactive-accent);
  }

  .knowledge-map-subtitle {
    font-size: 16px;
    color: var(--text-muted);
  }

  /* 总体进度面板 */
  .overall-progress-panel {
    background: var(--background-secondary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 20px;
    padding: 32px;
    margin-bottom: 60px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .panel-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .progress-legend {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .legend-circle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }
  
  .legend-circle.outer {
    border: 3px solid var(--interactive-accent);
    background: transparent;
  }
  
  .legend-circle.inner {
    border: 2px solid #ff9500;
    background: transparent;
  }

  .level-progress-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  .level-progress-item {
    text-align: center;
  }

  .level-progress-circle {
    width: 120px;
    height: 120px;
    margin: 0 auto 12px;
    position: relative;
  }
  
  /* 悬浮提示框 */
  .progress-tooltip {
    position: absolute;
    left: 130px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    z-index: 100;
    white-space: nowrap;
    pointer-events: none;
  }
  
  /* Tooltip箭头 */
  .progress-tooltip::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 6px 6px 6px 0;
    border-color: transparent var(--background-modifier-border) transparent transparent;
  }
  
  .progress-tooltip::after {
    content: '';
    position: absolute;
    left: -5px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 5px 5px 5px 0;
    border-color: transparent var(--background-primary) transparent transparent;
  }
  
  .level-progress-circle:hover .progress-tooltip {
    opacity: 1;
    visibility: visible;
  }
  
  .tooltip-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 4px 0;
  }
  
  .tooltip-item:not(:last-child) {
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }
  
  .tooltip-label {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .tooltip-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .tooltip-value.highlight {
    color: #ff9500;
  }

  .circle-text {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    pointer-events: none;
  }
  
  .main-value {
    font-size: 36px;
    font-weight: 700;
    color: var(--text-normal);
    line-height: 1;
  }

  .level-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .deck-count {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* 技能树 */
  .skill-tree {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 80px;
  }

  .level-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .level-header {
    margin-bottom: 40px;
  }

  .level-badge {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 12px 28px;
    background: rgba(var(--level-color-rgb), 0.1);
    border: 2px solid var(--level-color);
    border-radius: 30px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .level-icon {
    font-size: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .skill-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
    max-width: 1400px;
    width: 100%;
    padding: 0 20px;
    align-items: start;
  }

  /* 空状态 */
  .empty-state {
    text-align: center;
    padding: 80px 20px;
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    opacity: 0.5;
    color: var(--text-muted);
  }

  .empty-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 12px;
  }

  .empty-desc {
    font-size: 14px;
    color: var(--text-muted);
    max-width: 500px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .knowledge-map-container {
      padding: 20px 12px;
    }

    .knowledge-map-title {
      font-size: 28px;
    }

    .skill-grid {
      grid-template-columns: 1fr;
    }

    .level-progress-grid {
      grid-template-columns: 1fr;
    }
    
    .panel-header {
      flex-direction: column;
      align-items: center;
    }
    
    .progress-legend {
      justify-content: center;
    }
    
    /* 小屏幕上tooltip显示在上方 */
    .progress-tooltip {
      left: 50%;
      top: -80px;
      transform: translateX(-50%);
    }
    
    /* 小屏幕箭头指向下方 */
    .progress-tooltip::before {
      left: 50%;
      top: auto;
      bottom: -6px;
      transform: translateX(-50%);
      border-width: 6px 6px 0 6px;
      border-color: var(--background-modifier-border) transparent transparent transparent;
    }
    
    .progress-tooltip::after {
      left: 50%;
      top: auto;
      bottom: -5px;
      transform: translateX(-50%);
      border-width: 5px 5px 0 5px;
      border-color: var(--background-primary) transparent transparent transparent;
    }
  }
</style>
