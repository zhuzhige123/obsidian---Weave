<script lang="ts">
  /**
   * 移动端底部弹出菜单组件
   * 仅在 body.is-phone 时使用，替代桌面端的 VerticalToolbar
   */
  import { onMount, onDestroy } from 'svelte';
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import ObsidianDropdown from "../ui/ObsidianDropdown.svelte";
  import type { Card, Deck } from "../../data/types";
  import type { WeavePlugin } from "../../main";
  import { tr } from '../../utils/i18n';
  import { logger } from '../../utils/logger';
  // 🆕 导入AI配置Store
  import { customActionsForMenu } from '../../stores/ai-config.store';
  import type { AIAction } from '../../types/ai-types';
  // 🆕 v2.2: 导入牌组信息获取工具
  import { getCardDeckIds } from '../../utils/yaml-utils';
  // 🔧 v2.3: 使用 CardMetadataService 统一获取卡片元数据（带缓存 + 向后兼容）
  import { getCardMetadataService } from '../../services/CardMetadataService';

  interface Props {
    show: boolean;
    card: Card;
    currentCardTime: number;
    averageTime: number;
    plugin?: WeavePlugin;
    decks?: Deck[];
    isPremium?: boolean;
    isGraphLinked?: boolean;
    enableDirectDelete?: boolean;
    autoPlayMedia?: boolean;
    showTutorialButton?: boolean;
    cardOrder?: 'sequential' | 'random';
    onClose: () => void;
    onToggleEdit?: () => void;
    onDelete?: (skipConfirm?: boolean) => void;
    onSetReminder?: () => void;
    onChangePriority?: (priority: number) => void;
    onChangeDeck?: (deckId: string) => void;
    onRecycleCard?: () => void;
    onAIAssistant?: (evt: MouseEvent) => void;
    // 🆕 AI功能回调
    onAIFormatCustom?: (actionId: string) => void;
    onTestGenerate?: (actionId: string) => void;
    onSplitCard?: (actionId: string) => void;
    onOpenAIConfig?: () => void;
    onGraphLinkToggle?: (enabled: boolean) => void;
    onOpenDetailedView?: () => void;
    onOpenSourceBlock?: () => void;
    onDirectDeleteToggle?: (enabled: boolean) => void;
    onMediaAutoPlayChange?: (setting: string, value: any) => void;
    onTutorialButtonToggle?: (enabled: boolean) => void;
    onCardOrderChange?: (order: 'sequential' | 'random') => void;
  }

  let {
    show = false,
    card,
    currentCardTime,
    averageTime,
    plugin,
    decks = [],
    isPremium = false,
    isGraphLinked = false,
    enableDirectDelete = false,
    autoPlayMedia = false,
    showTutorialButton = true,
    cardOrder = 'sequential',
    onClose,
    onToggleEdit,
    onDelete,
    onSetReminder,
    onChangePriority,
    onChangeDeck,
    onRecycleCard,
    onAIAssistant,
    // 🆕 AI功能回调
    onAIFormatCustom,
    onTestGenerate,
    onSplitCard,
    onOpenAIConfig,
    onGraphLinkToggle,
    onOpenDetailedView,
    onOpenSourceBlock,
    onDirectDeleteToggle,
    onMediaAutoPlayChange,
    onTutorialButtonToggle,
    onCardOrderChange,
  }: Props = $props();

  let t = $derived($tr);
  
  // 🆕 从Store获取AI功能列表
  let customActions = $derived($customActionsForMenu);

  // 子面板状态
  let activePanel = $state<string | null>(null);
  let selectedDeckId = $state<string>('');
  
  // 🆕 优先级选择状态（本地状态，点击确定后才保存）
  let selectedPriority = $state<number>(2);
  
  // 🆕 当面板打开时，初始化选中的优先级
  $effect(() => {
    if (activePanel === 'priority' && card) {
      selectedPriority = card.priority || 2;
    }
  });

  // 格式化时间
  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 获取优先级颜色
  function getPriorityColor(priority: number): string {
    switch (priority) {
      case 1: return "#888";
      case 2: return "#60a5fa";
      case 3: return "#f97316";
      case 4: return "#ef4444";
      default: return "#60a5fa";
    }
  }

  // 获取当前牌组名称
  // 🔧 v2.3: 使用 CardMetadataService 统一获取牌组名称（带缓存 + 向后兼容）
  function getCurrentDeckName(): string {
    if (!card) return '未知牌组';
    const service = getCardMetadataService();
    const names = service.getCardDeckNames(card);
    return names.length > 0 ? names[0] : '未知牌组';
  }
  
  // 🆕 v2.2: 获取当前卡片的主牌组ID（用于牌组选择器的"当前"标记）
  function getCurrentDeckId(): string | undefined {
    if (!card) return undefined;
    const { primaryDeckId } = getCardDeckIds(card);
    return primaryDeckId;
  }

  // 处理菜单项点击
  function handleMenuAction(action: string) {
    switch (action) {
      case 'edit':
        onClose();
        onToggleEdit?.();
        break;
      case 'delete':
        onClose();
        onDelete?.(enableDirectDelete);
        break;
      case 'reminder':
        activePanel = 'reminder';
        break;
      case 'priority':
        activePanel = 'priority';
        break;
      case 'recycle':
        onClose();
        onRecycleCard?.();
        break;
      case 'ai':
        activePanel = 'ai';
        break;
      case 'deck':
        // 🔧 v2.2: 使用新的工具函数获取当前牌组ID
        selectedDeckId = getCurrentDeckId() || '';
        activePanel = 'deck';
        break;
      case 'info':
        onClose();
        onOpenDetailedView?.();
        break;
      case 'source':
        onClose();
        onOpenSourceBlock?.();
        break;
      case 'settings':
        activePanel = 'settings';
        break;
    }
  }

  // 返回主菜单
  function backToMenu() {
    activePanel = null;
  }

  // 处理牌组切换
  function handleDeckChange(deckId: string) {
    onChangeDeck?.(deckId);
    onClose();
  }

  // 处理优先级设置
  function handlePriorityChange() {
    // 🆕 调用回调并传递选中的优先级
    onChangePriority?.(selectedPriority);
    onClose();
  }
  
  // 🆕 处理优先级选项点击
  function handlePrioritySelect(priority: number) {
    selectedPriority = priority;
  }

  // 处理提醒设置
  function handleReminderSave() {
    onClose();
    onSetReminder?.();
  }

  // 处理图谱联动切换
  function handleGraphToggle() {
    onGraphLinkToggle?.(!isGraphLinked);
  }

  // 点击遮罩关闭
  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('mobile-sheet-overlay')) {
      onClose();
    }
  }

  // 触摸滑动关闭
  let touchStartY = 0;
  let sheetElement = $state<HTMLElement | null>(null);

  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e: TouchEvent) {
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0 && sheetElement) {
      sheetElement.style.transform = `translateY(${diff}px)`;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (sheetElement) {
      sheetElement.style.transform = '';
    }
    if (diff > 100) {
      onClose();
    }
  }
</script>

{#if show}
  <div 
    class="mobile-sheet-overlay" 
    class:active={show}
    onclick={handleOverlayClick}
    role="dialog"
    aria-modal="true"
  >
    <div 
      class="mobile-bottom-sheet"
      bind:this={sheetElement}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <!-- 主菜单 -->
      {#if !activePanel}
        <div class="sheet-header">
          <div class="sheet-handle"></div>
          <h3 class="sheet-title">操作</h3>
        </div>
        <div class="sheet-content">
          <!-- 计时器区域 -->
          <div class="timer-section">
            <div class="timer-card">
              <span class="timer-value">{formatTime(currentCardTime)}</span>
              <span class="timer-label">当前用时</span>
            </div>
            <div class="timer-card avg">
              <span class="timer-value">{formatTime(averageTime)}</span>
              <span class="timer-label">平均用时</span>
            </div>
          </div>

          <!-- 卡片操作组 -->
          <div class="menu-group">
            <div class="menu-group-title">卡片操作</div>
            <button class="menu-item" onclick={() => handleMenuAction('edit')}>
              <span class="menu-icon"><EnhancedIcon name="edit" size="18" /></span>
              <span class="menu-text">编辑卡片</span>
            </button>
            <button class="menu-item danger" onclick={() => handleMenuAction('delete')}>
              <span class="menu-icon"><EnhancedIcon name="delete" size="18" /></span>
              <span class="menu-text">删除卡片</span>
            </button>
            <button class="menu-item" onclick={() => handleMenuAction('reminder')}>
              <span class="menu-icon"><EnhancedIcon name="bell" size="18" /></span>
              <span class="menu-text">设置提醒</span>
              <span class="menu-arrow">›</span>
            </button>
            <button class="menu-item" onclick={() => handleMenuAction('priority')}>
              <span class="menu-icon"><EnhancedIcon name="star" size="18" /></span>
              <span class="menu-text">设置优先级</span>
              <span class="menu-badge" style="color: {getPriorityColor(card?.priority || 2)}">
                {'!'.repeat(Math.min(card?.priority || 2, 3))}
              </span>
              <span class="menu-arrow">›</span>
            </button>
            <button class="menu-item" onclick={() => handleMenuAction('recycle')}>
              <span class="menu-icon"><EnhancedIcon name="archive" size="18" /></span>
              <span class="menu-text">回收卡片</span>
            </button>
          </div>

          <!-- AI功能组 -->
          {#if isPremium}
            <div class="menu-group">
              <div class="menu-group-title">AI功能</div>
              <button class="menu-item has-submenu" onclick={() => handleMenuAction('ai')}>
                <span class="menu-icon"><EnhancedIcon name="robot" size="18" /></span>
                <span class="menu-text">AI助手</span>
                <span class="menu-arrow">›</span>
              </button>
              <button class="menu-item has-toggle" onclick={handleGraphToggle}>
                <span class="menu-icon"><EnhancedIcon name="link" size="18" /></span>
                <span class="menu-text">图谱联动</span>
                <label class="toggle-switch">
                  <input type="checkbox" checked={isGraphLinked} onchange={handleGraphToggle} />
                  <span class="toggle-slider"></span>
                </label>
              </button>
            </div>
          {/if}

          <!-- 更多功能组 -->
          <div class="menu-group">
            <div class="menu-group-title">更多</div>
            <button class="menu-item has-submenu" onclick={() => handleMenuAction('deck')}>
              <span class="menu-icon"><EnhancedIcon name="folder" size="18" /></span>
              <span class="menu-text">更换牌组</span>
              <span class="menu-value">{getCurrentDeckName()}</span>
              <span class="menu-arrow">›</span>
            </button>
            <button class="menu-item" onclick={() => handleMenuAction('info')}>
              <span class="menu-icon"><EnhancedIcon name="info" size="18" /></span>
              <span class="menu-text">卡片详情</span>
            </button>
            <button class="menu-item" onclick={() => handleMenuAction('source')}>
              <span class="menu-icon"><EnhancedIcon name="fileText" size="18" /></span>
              <span class="menu-text">查看源文本</span>
            </button>
            <button class="menu-item has-submenu" onclick={() => handleMenuAction('settings')}>
              <span class="menu-icon"><EnhancedIcon name="settings" size="18" /></span>
              <span class="menu-text">更多设置</span>
              <span class="menu-arrow">›</span>
            </button>
          </div>
        </div>

      <!-- 牌组选择子面板 -->
      {:else if activePanel === 'deck'}
        <div class="sub-panel-header">
          <button class="sub-panel-back" onclick={backToMenu}>
            <EnhancedIcon name="chevronLeft" size="20" />
          </button>
          <h3 class="sub-panel-title">更换牌组</h3>
          <span class="sub-panel-hint">选择目标牌组</span>
        </div>
        <div class="sub-panel-content">
          <div class="deck-list">
            <div class="deck-section">
              <div class="section-label">当前牌组</div>
              <button class="deck-option current">
                <span class="deck-icon"><EnhancedIcon name="folder" size="16" /></span>
                <span class="deck-name">{getCurrentDeckName()}</span>
                <span class="deck-indicator"><EnhancedIcon name="check" size="14" /></span>
              </button>
            </div>
            {#if decks.filter(d => d.id !== getCurrentDeckId()).length > 0}
              <div class="deck-section">
                <div class="section-label">可用牌组</div>
                {#each decks.filter(d => d.id !== getCurrentDeckId()) as deck}
                  <button 
                    class="deck-option" 
                    onclick={() => handleDeckChange(deck.id)}
                    style="padding-left: {8 + (deck.level || 0) * 16}px;"
                  >
                    {#if (deck.level || 0) > 0}
                      <span class="hierarchy-indicator">└</span>
                    {/if}
                    <span class="deck-icon"><EnhancedIcon name="folder" size="16" /></span>
                    <span class="deck-name">{deck.name}</span>
                    <span class="deck-indicator"><EnhancedIcon name="chevronRight" size="14" /></span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

      <!-- 设置子面板 -->
      {:else if activePanel === 'settings'}
        <div class="sub-panel-header">
          <button class="sub-panel-back" onclick={backToMenu}>
            <EnhancedIcon name="chevronLeft" size="20" />
          </button>
          <h3 class="sub-panel-title">更多设置</h3>
        </div>
        <div class="sub-panel-content">
          <div class="settings-list">
            <div class="settings-section">
              <div class="section-label">学习设置</div>
              <div class="setting-item has-toggle">
                <div class="setting-info">
                  <span class="setting-name">自动播放媒体</span>
                  <span class="setting-desc">切换卡片时自动播放音频/视频</span>
                </div>
                <label class="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={autoPlayMedia}
                    onchange={() => onMediaAutoPlayChange?.('enabled', !autoPlayMedia)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-item has-toggle">
                <div class="setting-info">
                  <span class="setting-name">直接删除</span>
                  <span class="setting-desc">删除卡片时跳过确认弹窗</span>
                </div>
                <label class="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={enableDirectDelete}
                    onchange={() => onDirectDeleteToggle?.(!enableDirectDelete)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-item has-select">
                <div class="setting-info">
                  <span class="setting-name">卡片顺序</span>
                  <span class="setting-desc">学习卡片的排列方式</span>
                </div>
                <ObsidianDropdown
                  className="setting-select"
                  options={[
                    { id: 'sequential', label: '正序学习' },
                    { id: 'random', label: '乱序学习' }
                  ]}
                  value={cardOrder}
                  onchange={(value) => onCardOrderChange?.(value as 'sequential' | 'random')}
                />
              </div>
            </div>
            <div class="settings-section">
              <div class="section-label">显示设置</div>
              <div class="setting-item has-toggle">
                <div class="setting-info">
                  <span class="setting-name">显示教程按钮</span>
                  <span class="setting-desc">在界面中显示使用教程入口</span>
                </div>
                <label class="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={showTutorialButton}
                    onchange={() => onTutorialButtonToggle?.(!showTutorialButton)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

      <!-- AI助手子面板 -->
      {:else if activePanel === 'ai'}
        <div class="sub-panel-header">
          <button class="sub-panel-back" onclick={backToMenu}>
            <EnhancedIcon name="chevron-left" size="20" />
          </button>
          <h3 class="sub-panel-title">AI助手</h3>
        </div>
        <div class="sub-panel-content">
          <div class="ai-menu-list">
            <!-- 内容优化（格式化功能） -->
            {#if customActions.format.length > 0}
              <div class="ai-section">
                <div class="section-label">内容优化</div>
                {#each customActions.format as action}
                  <button class="ai-menu-item" onclick={() => { onClose(); onAIFormatCustom?.(action.id); }}>
                    <span class="ai-icon"><EnhancedIcon name={action.icon || 'sparkles'} size="18" /></span>
                    <span class="ai-name">{action.name}</span>
                  </button>
                {/each}
              </div>
            {/if}
            
            <!-- AI拆分 -->
            {#if customActions.split.length > 0}
              <div class="ai-section">
                <div class="section-label">卡片拆分</div>
                {#each customActions.split as action}
                  <button class="ai-menu-item" onclick={() => { onClose(); onSplitCard?.(action.id); }}>
                    <span class="ai-icon"><EnhancedIcon name={action.icon || 'scissors'} size="18" /></span>
                    <span class="ai-name">{action.name}</span>
                  </button>
                {/each}
              </div>
            {/if}
            
            <!-- 管理 -->
            <div class="ai-section">
              <div class="section-label">管理</div>
              <button class="ai-menu-item" onclick={() => { onClose(); onOpenAIConfig?.(); }}>
                <span class="ai-icon"><EnhancedIcon name="settings" size="18" /></span>
                <span class="ai-name">管理AI动作</span>
              </button>
            </div>
            
            <!-- 无功能时的提示 -->
            {#if customActions.format.length === 0 && customActions.split.length === 0}
              <div class="ai-empty-hint">
                <p>暂无可用的AI功能</p>
                <p class="hint">点击"管理AI动作"添加自定义功能</p>
              </div>
            {/if}
          </div>
        </div>

      <!-- 优先级子面板 -->
      {:else if activePanel === 'priority'}
        <div class="sub-panel-header">
          <button class="sub-panel-back" onclick={backToMenu}>
            <EnhancedIcon name="chevron-left" size="20" />
          </button>
          <h3 class="sub-panel-title">设置优先级</h3>
          <button class="sub-panel-action" onclick={handlePriorityChange}>确定</button>
        </div>
        <div class="sub-panel-content">
          <div class="priority-options">
            <button class="priority-option" class:active={selectedPriority === 1} onclick={() => handlePrioritySelect(1)}>
              <span class="priority-icon" style="color: #888;">!</span>
              <span class="priority-name">低优先级</span>
              {#if selectedPriority === 1}<span class="check-icon">✓</span>{/if}
            </button>
            <button class="priority-option" class:active={selectedPriority === 2} onclick={() => handlePrioritySelect(2)}>
              <span class="priority-icon" style="color: #60a5fa;">!!</span>
              <span class="priority-name">中优先级</span>
              {#if selectedPriority === 2}<span class="check-icon">✓</span>{/if}
            </button>
            <button class="priority-option" class:active={selectedPriority === 3} onclick={() => handlePrioritySelect(3)}>
              <span class="priority-icon" style="color: #f97316;">!!!</span>
              <span class="priority-name">高优先级</span>
              {#if selectedPriority === 3}<span class="check-icon">✓</span>{/if}
            </button>
            <button class="priority-option" class:active={selectedPriority === 4} onclick={() => handlePrioritySelect(4)}>
              <span class="priority-icon" style="color: #ef4444;">!!!!</span>
              <span class="priority-name">紧急</span>
              {#if selectedPriority === 4}<span class="check-icon">✓</span>{/if}
            </button>
          </div>
        </div>

      <!-- 提醒子面板 -->
      {:else if activePanel === 'reminder'}
        <div class="sub-panel-header">
          <button class="sub-panel-back" onclick={backToMenu}>
            <EnhancedIcon name="chevronLeft" size="20" />
          </button>
          <h3 class="sub-panel-title">设置提醒</h3>
          <button class="sub-panel-action" onclick={handleReminderSave}>确定</button>
        </div>
        <div class="sub-panel-content">
          <div class="reminder-placeholder">
            <p>提醒功能设置面板</p>
            <p class="hint">点击确定按钮打开完整提醒设置</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}


<style>
  /* ==================== 底部弹出菜单遮罩 ==================== */
  .mobile-sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }

  .mobile-sheet-overlay.active {
    opacity: 1;
    visibility: visible;
  }

  /* ==================== 底部弹出菜单主体 ==================== */
  .mobile-bottom-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 80vh;
    background: var(--background-secondary);
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .mobile-sheet-overlay.active .mobile-bottom-sheet {
    transform: translateY(0);
  }

  /* ==================== 菜单头部 ==================== */
  .sheet-header {
    padding: 0.75rem 1rem;
    text-align: center;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    margin: 0 auto 0.5rem;
  }

  .sheet-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  /* ==================== 菜单内容区 ==================== */
  .sheet-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px) + 52px);
    -webkit-overflow-scrolling: touch;
  }

  /* ==================== 计时器区域 ==================== */
  .timer-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .timer-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem;
    background: var(--background-primary);
    border-radius: 0.5rem;
    border: 1px solid var(--background-modifier-border);
  }

  .timer-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-accent);
    font-family: 'SF Mono', 'Menlo', monospace;
  }

  .timer-label {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* ==================== 菜单分组 ==================== */
  .menu-group {
    margin-bottom: 1rem;
  }

  .menu-group:last-child {
    margin-bottom: 0;
  }

  .menu-group-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 0.5rem;
    margin-bottom: 0.5rem;
  }

  /* ==================== 菜单项 ==================== */
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: var(--text-normal);
    font-size: 0.9375rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
    min-height: 44px;
  }

  .menu-item:hover,
  .menu-item:active {
    background: var(--background-modifier-hover);
  }

  .menu-item.danger {
    color: var(--text-error);
  }

  .menu-icon {
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.75rem;
    color: var(--text-muted);
  }

  .menu-item.danger .menu-icon {
    color: var(--text-error);
  }

  .menu-text {
    flex: 1;
  }

  .menu-value {
    font-size: 0.8125rem;
    color: var(--text-normal);
  }

  :global(.obsidian-dropdown-trigger.setting-select) {
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    color: var(--text-normal);
    min-height: 0;
  }

  .menu-badge {
    font-size: 0.75rem;
    font-weight: 700;
    margin-left: 0.5rem;
  }

  .menu-arrow {
    font-size: 1.25rem;
    color: var(--text-muted);
    margin-left: 0.5rem;
  }

  /* ==================== 开关样式 ==================== */
  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    margin-left: 0.5rem;
    flex-shrink: 0;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--background-primary);
    border-radius: 24px;
    transition: all 0.3s ease;
  }

  .toggle-slider::before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch input:checked + .toggle-slider {
    background: var(--text-accent);
  }

  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  /* ==================== 子面板头部 ==================== */
  .sub-panel-header {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .sub-panel-back {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .sub-panel-back:active {
    background: var(--background-modifier-hover);
  }

  .sub-panel-title {
    flex: 1;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  .sub-panel-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .sub-panel-action {
    padding: 0.25rem 0.75rem;
    background: var(--text-accent);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .sub-panel-action:active {
    opacity: 0.8;
  }

  .sub-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px) + 52px);
    -webkit-overflow-scrolling: touch;
  }

  /* ==================== 牌组列表样式 ==================== */
  .deck-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .deck-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 0.5rem;
  }

  .deck-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    min-height: 44px;
  }

  .deck-option:active {
    transform: scale(0.98);
  }

  .deck-option.current {
    border-color: var(--text-accent);
    background: color-mix(in srgb, var(--text-accent) 10%, var(--background-primary));
  }

  .deck-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .deck-name {
    flex: 1;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-normal);
    /* 🆕 文本溢出省略 */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .deck-indicator {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .deck-option.current .deck-indicator {
    color: var(--text-accent);
  }

  .hierarchy-indicator {
    color: var(--text-muted);
    margin-right: 0.25rem;
  }

  /* ==================== 设置列表样式 ==================== */
  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .setting-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background: var(--background-primary);
    border-radius: 0.5rem;
  }

  .setting-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  .setting-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .setting-select {
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    color: var(--text-normal);
    font-size: 0.8125rem;
  }

  /* ==================== AI菜单样式 ==================== */
  .ai-menu-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ai-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ai-menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 44px;
  }

  .ai-menu-item:active {
    transform: scale(0.98);
    background: var(--background-modifier-hover);
  }

  .ai-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .ai-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  /* ==================== 优先级选项样式 ==================== */
  .priority-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .priority-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 44px;
  }

  .priority-option:active {
    transform: scale(0.98);
  }

  .priority-option.active {
    border-color: var(--text-accent);
    background: color-mix(in srgb, var(--text-accent) 10%, var(--background-primary));
  }

  .priority-icon {
    font-size: 1.25rem;
    font-weight: 700;
    width: 32px;
    text-align: center;
    flex-shrink: 0;
  }

  .priority-name {
    flex: 1;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-normal);
    text-align: left;
  }

  .check-icon {
    color: var(--text-accent);
    font-size: 1rem;
    flex-shrink: 0;
  }

  /* ==================== 提醒占位符 ==================== */
  .reminder-placeholder {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .reminder-placeholder .hint {
    font-size: 0.75rem;
    margin-top: 0.5rem;
  }

  /* ==================== AI空状态提示 ==================== */
  .ai-empty-hint {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .ai-empty-hint .hint {
    font-size: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
