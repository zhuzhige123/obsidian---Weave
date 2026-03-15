<script lang="ts">
  /**
   * IRFocusInterface - 增量阅读主界面组件 (v5.4 正式版)
   * 
   * 这是增量阅读的核心界面组件，支持 V4 数据结构和块文件方案。
   * 
   * 设计:
   * 设计：
   * - 整体布局：模态窗风格（标签页视图）
   * - 顶部信息栏：参考 StatsCards 的4列网格设计
   * - 右侧工具栏：参考 VerticalToolbar 的垂直按钮设计
   * - 底部操作栏：统一的操作按钮
   * - 支持块文件双向实时同步
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import { Notice, Platform, debounce, TFile, MarkdownView, Menu } from 'obsidian';
  import type { IRFocusInterfaceSettings, DEFAULT_IR_FOCUS_SETTINGS } from '../../types/plugin-settings.d';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import EnhancedButton from '../ui/EnhancedButton.svelte';
  import type { WeavePlugin } from '../../main';
  import type { IRBlockV4, IRBlockStatus, IRChunkFileData } from '../../types/ir-types';
  import { logger } from '../../utils/logger';
  import { getServices } from './IRDeckView.svelte';
  // v4.0: 使用 V4 调度服务
  import type { ReadingCompletionDataV4 } from '../../services/incremental-reading/IRV4SchedulerService';
  // IRRating 类型保持兼容
  export type IRRating = 1 | 2 | 3 | 4;  // 1=忽略(suspended), 2=一般, 3=清晰, 4=精通
  import type { EmbeddableEditorManager } from '../../services/editor/EmbeddableEditorManager';
  import { irActiveDocumentStore } from '../../stores/ir-active-document-store';
  import { irActiveBlockContextStore } from '../../stores/ir-active-block-context-store';
  // v2.0 Phase 4: 理解度自评弹窗
  import IRRatingModal from './IRRatingModal.svelte';
  import FloatingMenu from '../ui/FloatingMenu.svelte';  // 仅用于设置菜单
  // v2.1: 增量阅读完成结算模态窗
  import IRCompletionModal from './IRCompletionModal.svelte';
  // v2.1: 优先级贴纸组件
  import IRPrioritySticker from './IRPrioritySticker.svelte';
  import ObsidianRenderer from '../atoms/ObsidianRenderer.svelte';
  // v2.2: 双向实时同步服务
  // @deprecated v5.0: findBlockBoundaryByUUID, extractContentByBoundary 已移除（旧 UUID 标记方案）
  import { IREditorSyncService } from '../../services/incremental-reading/IREditorSyncService';
  // v4.0: 优先级计算（使用 V4 核心算法）
  import { calculatePriorityEWMA } from '../../services/incremental-reading/IRCoreAlgorithmsV4';
  // v3.1: 内容块导航组件
  import IRContentBlockNavigation from './IRContentBlockNavigation.svelte';
  // v5.6: 内容块信息模态窗
  import IRBlockInfoModal from './IRBlockInfoModal.svelte';
  // v5.7: 标注信号服务
  import { getAnnotationSignalService, type AnnotationSignalResult } from '../../services/incremental-reading/IRAnnotationSignalService';
  // v5.8: 会话制卡统计服务
  import { createSessionCardStatsService, destroySessionCardStatsService, type IRSessionCardStatsService } from '../../services/incremental-reading/IRSessionCardStatsService';
  // v6.0: 学习会话记录
  import IRSessionConfirmModal from './IRSessionConfirmModal.svelte';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import type { IRStudySession } from '../../types/ir-types';
  import { isPdfBookmarkTaskId } from '../../services/incremental-reading/IRPdfBookmarkTaskService';
  import { isEpubBookmarkTaskId } from '../../services/incremental-reading/IREpubBookmarkTaskService';
  import { VIEW_TYPE_EPUB } from '../../views/EpubView';
  // AI助手相关导入
  import { AIAssistantMenuBuilder } from '../../services/menu/AIAssistantMenuBuilder';
  import type { AIAction, SplitCardRequest } from '../../types/ai-types';
  import { customActionsForMenu } from '../../stores/ai-config.store';
  import { get } from 'svelte/store';
  import type { Card } from '../../data/types';
  import { CardType } from '../../data/types';
  import EditorContextManager from '../../services/editor/EditorContextManager';
  import { AIActionExecutor } from '../../services/ai/AIActionExecutor';
  import ChildCardsOverlay from '../study/ChildCardsOverlay.svelte';
  import UnifiedActionsBar from '../study/UnifiedActionsBar.svelte';

  interface Props {
    plugin: WeavePlugin;
    deckPath: string;
    deckName: string;
    blocks: IRBlockV4[];
    focusStats?: {
      timeBudgetMinutes: number;
      estimatedMinutes: number;
      candidateCount: number;
      dueToday: number;
      dueWithinDays: number;
      learnAheadDays: number;
    };
    initialBlockIndex?: number;
    initialBlockId?: string | null;
    onClose: () => void;
    onBlockComplete?: (blockId: string) => void;
    onBlockSkip?: (blockId: string) => void;
    onExtractCard?: () => void;
  }

  let {
    plugin,
    deckPath,
    deckName,
    blocks,
    focusStats,
    initialBlockIndex,
    initialBlockId,
    onClose,
    onBlockComplete,
    onBlockSkip,
    onExtractCard
  }: Props = $props();

  const focusStatsTitle = $derived(() => {
    if (!focusStats) return '';
    const dueToday = focusStats.dueToday ?? 0;
    const dueWithinDays = focusStats.dueWithinDays ?? 0;
    const learnAheadDays = focusStats.learnAheadDays ?? 3;
    const ahead = Math.max(0, dueWithinDays - dueToday);
    const budget = focusStats.timeBudgetMinutes ?? 40;
    const est = typeof focusStats.estimatedMinutes === 'number' ? focusStats.estimatedMinutes : 0;
    const cand = focusStats.candidateCount ?? 0;
    return `本次会话队列受时间预算限制\n` +
      `时间预算: ${budget}min, 预计: ${est.toFixed(1)}min\n` +
      `候选池: ${cand}\n` +
      `今日到期(未读): ${dueToday}\n` +
      `待读(${learnAheadDays}天内, 不含今日): ${ahead}`;
  });

  const focusStatsSummary = $derived(() => {
    if (!focusStats) return '';
    const dueToday = focusStats.dueToday ?? 0;
    const dueWithinDays = focusStats.dueWithinDays ?? 0;
    const learnAheadDays = focusStats.learnAheadDays ?? 3;
    const ahead = Math.max(0, dueWithinDays - dueToday);
    const budget = focusStats.timeBudgetMinutes ?? 40;
    return `预算 ${budget}min · 未读 ${dueToday} · 待读 ${ahead}`;
  });

  // @deprecated v5.0: isChunkFilePath 已移除（块文件方案不再需要路径判断，所有文件都是 chunk 文件）

  // 获取持久化设置
  function getFocusSettings(): IRFocusInterfaceSettings {
    return plugin.settings?.incrementalReading?.focusInterface || {
      showChapterNav: false,  // v5.4: 默认隐藏左侧导航
      showToolbar: true,
      statsCollapsed: false,
      navCollapsed: true,     // v5.4: 默认隐藏内容块导航栏
      showRatingTime: true,
      alwaysShowRating: false,
      defaultEditMode: true,
      showPrioritySticker: true
    };
  }

  // 保存设置到插件
  async function saveFocusSettings(settings: Partial<IRFocusInterfaceSettings>) {
    if (!plugin.settings.incrementalReading) {
      plugin.settings.incrementalReading = {};
    }
    plugin.settings.incrementalReading.focusInterface = {
      ...getFocusSettings(),
      ...settings
    };
    await plugin.saveSettings();
  }

  // UI状态（从持久化设置初始化）
  const initialSettings = getFocusSettings();
  let showSidebar = $state(initialSettings.showToolbar ?? true);
  let statsCollapsed = $state(initialSettings.statsCollapsed ?? false);
  let navCollapsed = $state(initialSettings.navCollapsed ?? false);  // v3.1: 内容块导航栏折叠状态
  let outputStatsCollapsed = $state(initialSettings.outputStatsCollapsed ?? true);  // v5.5: 产出信息栏折叠状态
  let isMobile = $state(false);
  let isEditMode = $state(initialSettings.defaultEditMode ?? true);  // 默认编辑模式

  let mobileViewportHeight = $state<number | null>(null);
  let mobileTopOffset = $state(0);
  let mobileBottomOffset = $state(56);
  let mobileViewportCleanup: (() => void) | null = null;
  let mobileChromeSyncIntervalId: number | null = null;

  const MOBILE_TOP_OFFSET_FALLBACK = 44;

  const getMobileTopOffset = (): number => {
    try {
      const topSelectors = [
        '.mobile-navbar',
        '.workspace-tab-header-container',
        '.workspace-tab-header',
        '.view-header',
        '.titlebar',
      ];

      let top = 0;
      for (const selector of topSelectors) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top < 200 && rect.bottom > 0) {
          top = Math.max(top, rect.bottom);
        }
      }

      if (!Number.isFinite(top)) return MOBILE_TOP_OFFSET_FALLBACK;
      if (top < 10) return MOBILE_TOP_OFFSET_FALLBACK;
      return Math.max(0, Math.min(160, top));
    } catch {
      return MOBILE_TOP_OFFSET_FALLBACK;
    }
  };

  const getMobileBottomOffset = (): number => {
    try {
      const viewportHeight = window.innerHeight;
      const bottomSelectors = ['.mobile-toolbar', '.status-bar'];
      let bottom = 0;

      for (const selector of bottomSelectors) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top > viewportHeight - 200) {
          bottom = Math.max(bottom, viewportHeight - rect.top);
        }
      }

      if (!Number.isFinite(bottom)) return 56;
      return Math.max(0, Math.min(160, bottom || 56));
    } catch {
      return 56;
    }
  };

  $effect(() => {
    if (!(Platform.isMobile && isMobile)) {
      if (mobileViewportCleanup) {
        mobileViewportCleanup();
        mobileViewportCleanup = null;
      }
      mobileViewportHeight = null;
      mobileTopOffset = 0;
      mobileBottomOffset = 56;
      return;
    }

    const viewport = window.visualViewport;
    const updateViewport = () => {
      const top = getMobileTopOffset();
      const bottom = getMobileBottomOffset();

      mobileTopOffset = top;
      mobileBottomOffset = bottom;

      const baseHeight = viewport ? viewport.height : window.innerHeight;
      mobileViewportHeight = Math.max(200, baseHeight - top - bottom);
    };

    updateViewport();

    if (viewport) {
      viewport.addEventListener('resize', updateViewport);
      viewport.addEventListener('scroll', updateViewport);
    }

    if (mobileChromeSyncIntervalId) {
      window.clearInterval(mobileChromeSyncIntervalId);
    }

    mobileChromeSyncIntervalId = window.setInterval(updateViewport, 120);

    mobileViewportCleanup = () => {
      if (viewport) {
        viewport.removeEventListener('resize', updateViewport);
        viewport.removeEventListener('scroll', updateViewport);
      }
      if (mobileChromeSyncIntervalId) {
        window.clearInterval(mobileChromeSyncIntervalId);
        mobileChromeSyncIntervalId = null;
      }
    };

    return () => {
      if (mobileViewportCleanup) {
        mobileViewportCleanup();
        mobileViewportCleanup = null;
      }
    };
  });
  
  // v4.0: 计时器暂停状态
  let isTimerPaused = $state(false);
  let pausedAt = $state<number | null>(null);  // 暂停时的时间点
  let accumulatedPausedTime = $state(0);  // 累计暂停时长

  type PauseMode = 'manual' | 'idle' | null;
  let pauseMode = $state<PauseMode>(null);
  let showIdlePauseOverlay = $state(false);
  let lastInteractionAt = $state(Date.now());
  let idleCheckIntervalId: number | null = null;
  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  let activityListener: ((event: Event) => void) | null = null;

  function enterIdlePause() {
    if (isTimerPaused) return;
    pauseMode = 'idle';
    pausedAt = Date.now();
    isTimerPaused = true;
    showIdlePauseOverlay = true;
  }

  function resumeFromIdlePause(keep: boolean) {
    if (pauseMode !== 'idle') return;
    const now = Date.now();
    if (!keep && pausedAt) {
      accumulatedPausedTime += now - pausedAt;
    }
    pausedAt = null;
    isTimerPaused = false;
    pauseMode = null;
    showIdlePauseOverlay = false;
    lastInteractionAt = now;
  }

  // v6.1: 自定义 tooltip 状态（替代浏览器原生 title）
  let showStatsTooltip = $state(false);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  function handleStatsMouseEnter(e: MouseEvent) {
    showStatsTooltip = true;
    updateTooltipPosition(e);
  }

  function handleStatsMouseMove(e: MouseEvent) {
    if (showStatsTooltip) {
      updateTooltipPosition(e);
    }
  }

  function handleStatsMouseLeave() {
    showStatsTooltip = false;
  }

  function updateTooltipPosition(e: MouseEvent) {
    // 获取视口尺寸
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipWidth = 340;
    const tooltipHeight = 260;
    
    // 默认显示在鼠标右下方
    let x = e.clientX + 12;
    let y = e.clientY + 12;
    
    // 边界检测：如果超出右边界，显示在鼠标左侧
    if (x + tooltipWidth > vw - 20) {
      x = e.clientX - tooltipWidth - 12;
    }
    // 边界检测：如果超出下边界，显示在鼠标上方
    if (y + tooltipHeight > vh - 20) {
      y = e.clientY - tooltipHeight - 12;
    }
    
    tooltipX = Math.max(10, x);
    tooltipY = Math.max(10, y);
  }

  // v4.0: 侧边栏功能键长按拖拽排序
  let isDraggingButton = $state(false);
  let draggedButtonElement = $state<HTMLElement | null>(null);
  let dragStartY = $state(0);
  let dragCurrentY = $state(0);
  let longPressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  const LONG_PRESS_DURATION = 500;
  
  // 长按开始 - 进入拖拽模式
  function handleButtonLongPressStart(e: MouseEvent | TouchEvent, element: HTMLElement) {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY = clientY;
    
    longPressTimer = setTimeout(() => {
      isDraggingButton = true;
      draggedButtonElement = element;
      element.classList.add('dragging');
      // 触发震动反馈（如果支持）
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION);
  }
  
  // 拖拽移动
  function handleButtonDragMove(e: MouseEvent | TouchEvent) {
    if (!isDraggingButton || !draggedButtonElement) return;
    
    e.preventDefault();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragCurrentY = clientY;
    
    // 计算偏移并应用
    const deltaY = dragCurrentY - dragStartY;
    draggedButtonElement.style.transform = `translateY(${deltaY}px)`;
    draggedButtonElement.style.zIndex = '100';
    
    // 检测是否需要交换位置
    const parent = draggedButtonElement.parentElement;
    if (!parent) return;
    
    const buttons = Array.from(parent.querySelectorAll('.toolbar-btn:not(.dragging)')) as HTMLElement[];
    const draggedRect = draggedButtonElement.getBoundingClientRect();
    const draggedCenter = draggedRect.top + draggedRect.height / 2;
    
    for (const btn of buttons) {
      const btnRect = btn.getBoundingClientRect();
      const btnCenter = btnRect.top + btnRect.height / 2;
      
      // 如果拖拽元素的中心越过了其他按钮的中心，交换位置
      if (deltaY > 0 && draggedCenter > btnCenter && btn.compareDocumentPosition(draggedButtonElement) & Node.DOCUMENT_POSITION_PRECEDING) {
        parent.insertBefore(btn, draggedButtonElement);
        dragStartY = dragCurrentY;
        draggedButtonElement.style.transform = '';
        break;
      } else if (deltaY < 0 && draggedCenter < btnCenter && btn.compareDocumentPosition(draggedButtonElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
        parent.insertBefore(draggedButtonElement, btn);
        dragStartY = dragCurrentY;
        draggedButtonElement.style.transform = '';
        break;
      }
    }
  }
  
  // 拖拽结束
  function handleButtonDragEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    if (isDraggingButton && draggedButtonElement) {
      draggedButtonElement.classList.remove('dragging');
      draggedButtonElement.style.transform = '';
      draggedButtonElement.style.zIndex = '';
      
      // 保存新顺序（从DOM中读取）
      const parent = draggedButtonElement.parentElement;
      if (parent) {
        const buttons = Array.from(parent.querySelectorAll('.toolbar-btn[data-btn-id]')) as HTMLElement[];
        const newOrder = buttons.map(btn => btn.dataset.btnId).filter(Boolean) as string[];
        if (newOrder.length > 0) {
          saveFocusSettings({ toolbarButtonOrder: newOrder });
        }
      }
    }
    
    isDraggingButton = false;
    draggedButtonElement = null;
  }
  // v2.1: 移除章节导航，完全由算法控制内容块切换
  // let showChapterNav = $state(initialSettings.showChapterNav ?? true);

  // 嵌入式编辑器状态（参考 CardEditorContainer）
  let editorPoolManager: EmbeddableEditorManager | null = $state(null);
  let editorContainer: HTMLDivElement | null = $state(null);
  let editorInitialized = $state(false);
  let editCleanupFn: (() => void) | null = $state(null);
  const IR_SESSION_ID = `weave-ir-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // v2.2: 双向实时同步服务
  let editorSyncService: IREditorSyncService | null = $state(null);

  let realtimeSaveDebounced: (((content: string) => void) & { cancel?: () => void }) | null = null;
  let saveBaselineFilePath: string | null = null;
  let saveBaselineMtime: number | null = null;
  let autoSaveConflictFilePath: string | null = null;
  let autoSaveConflictMtime: number | null = null;
  let saveInProgress = false;
  let queuedSaveContent: string | null = null;

  // v2.2: 实时保存函数（不再需要防抖，直接同步到原文档）
  function handleRealtimeSave(content: string) {
    // 防止循环更新
    if (editorSyncService?.isInLocalChange()) {
      return;
    }
    
    // 🔧 防御1：内容未加载完成时禁止保存
    if (!isContentLoaded) {
      logger.warn('[IRFocusInterface] 内容未加载完成，跳过实时保存');
      return;
    }
    
    // 🔧 防御2：空白内容检查（允许合理的空白，但禁止完全空白）
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      logger.warn('[IRFocusInterface] 检测到空白内容，跳过保存以防止数据丢失');
      return;
    }

    if (!realtimeSaveDebounced) {
      realtimeSaveDebounced = debounce((latestContent: string) => {
        void handleEditorSave(latestContent);
      }, 450);
    }

    realtimeSaveDebounced(content);
  }

  async function refreshSaveBaseline(filePath: string): Promise<void> {
    try {
      const stat = await plugin.app.vault.adapter.stat(filePath);
      const mtime = (stat as any)?.mtime;
      if (typeof mtime === 'number') {
        saveBaselineFilePath = filePath;
        saveBaselineMtime = mtime;
      }
    } catch {
    }
  }

  // v6.0: 服务实例
  const services = getServices(plugin.app, plugin.settings?.incrementalReading?.importFolder);

  // 当前状态
  let currentBlockIndex = $state(0);
  // v2.3.1: 活跃块数组（初始化时过滤#ignore标签和suspended状态，同时检查 contentPreview）
  let activeBlocks = $state<IRBlockV4[]>(
    blocks.filter(b => {
      // 过滤suspended/removed状态
      if (b.status === 'suspended' || b.status === 'removed') return false;
      
      // 过滤带有#ignore标签的内容块（同时检查 tags 数组和 contentPreview）
      const hasIgnoreInTags = b.tags?.some(tag => 
        tag.toLowerCase() === 'ignore' || tag.toLowerCase() === '#ignore'
      ) || false;
      
      // 备用检查: contentPreview中是否包含 #ignore
      const hasIgnoreInContent = /#ignore\b/i.test((b as any).contentPreview || '');
      
      return !(hasIgnoreInTags || hasIgnoreInContent);
    })
  );
  // v2.1: 移除章节导航状态，完全由算法控制
  // let showChapterNav = $state(initialSettings.showChapterNav ?? true);
  let showToolbar = $state(initialSettings.showToolbar ?? true);
  let startTime = $state(Date.now());
  
  // v5.8: 会话制卡统计服务（持久化，支持异常关闭恢复）
  let sessionCardStatsService: IRSessionCardStatsService | null = null;
  let currentBlockCardCount = $state(0);  // 当前块本次制卡数（响应式）
  let isNormalSessionEnd = false;  // 标记是否正常结束会话
  
  // v6.0: 学习会话记录
  let showSessionConfirmModal = $state(false);
  let pendingCloseAction: (() => void) | null = null;  // 待执行的关闭回调
  
  // v5.5: 产出统计（历史累计 + 本次新增）- 初始化为0，在块切换时更新
  let historicalCardCount = $state(0);  // 历史累计制卡数
  let historicalReadingTime = $state(0);  // 历史累计阅读时间(ms)
  let blockContent = $state<string>('');  // 当前块的内容
  let isContentLoaded = $state(false);  // 🔧 内容加载完成标志位
  
  // v5.7: 标注信号统计
  let annotationSignal = $state<AnnotationSignalResult | null>(null);
  
  // AI助手相关状态
  let aiAssistantMenuBuilder: AIAssistantMenuBuilder | null = null;
  let showChildCardsOverlay = $state(false);
  let childCards = $state<Card[]>([]);
  let childCardsOverlayRef: any = $state(null);
  let currentSplitAction = $state<AIAction | null>(null);
  let targetDeckIdForSplit = $state<string>(deckPath); // 默认使用当前牌组
  let aiSplitInProgress = $state(false);
  let regeneratingCardIds = $state(new Set<string>());
  
  // 获取可用的记忆牌组列表（排除题库牌组）
  let availableDecks = $state<Array<{ id: string; name: string }>>([]);
  
  // 加载可用牌组列表
  async function loadAvailableDecks() {
    try {
      const allDecks = await (plugin as any).dataStorage?.getDecks?.();
      if (!Array.isArray(allDecks)) {
        availableDecks = [];
        return;
      }

      // 过滤出记忆牌组（排除题库牌组）
      availableDecks = allDecks
        .filter((d: any) => d?.deckType !== 'question-bank' && d?.purpose !== 'test')
        .map((d: any) => ({ id: d.id, name: d.name }));
        
      // 如果当前选中的牌组不在列表中，选择第一个
      if (availableDecks.length > 0 && !availableDecks.find(d => d.id === targetDeckIdForSplit)) {
        targetDeckIdForSplit = availableDecks[0].id;
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 加载牌组列表失败:', error);
    }
  }

  // 派生状态（v2.3: 使用activeBlocks替代blocks）
  const currentBlock = $derived(activeBlocks[currentBlockIndex] || null);
  const totalBlocks = $derived(activeBlocks.length);
  const progress = $derived(totalBlocks > 0 ? Math.round((currentBlockIndex / totalBlocks) * 100) : 0);

  function isBlockDueToday(block: IRBlockV4): boolean {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endMs = endOfToday.getTime();

    if (block.nextRepDate === 0) return true;
    return block.nextRepDate <= endMs;
  }

  const isLearnAheadContext = $derived.by(() => {
    for (const b of activeBlocks) {
      if (b.status === 'done' || b.status === 'suspended' || b.status === 'removed') continue;
      if (!isBlockDueToday(b)) return true;
    }
    return false;
  });

  const isCurrentBlockActionable = $derived.by(() => {
    if (!currentBlock) return false;
    if (currentBlock.status === 'done' || currentBlock.status === 'suspended' || currentBlock.status === 'removed') return false;
    return isLearnAheadContext || isBlockDueToday(currentBlock);
  });

  let hasAppliedInitialPosition = false;
  $effect(() => {
    if (hasAppliedInitialPosition) return;
    if (activeBlocks.length === 0) return;

    let idx = 0;
    if (typeof initialBlockId === 'string' && initialBlockId.length > 0) {
      const found = activeBlocks.findIndex(b => b.id === initialBlockId);
      if (found >= 0) idx = found;
    } else if (typeof initialBlockIndex === 'number') {
      idx = initialBlockIndex;
    }

    idx = Math.max(0, Math.min(activeBlocks.length - 1, idx));
    currentBlockIndex = idx;
    hasAppliedInitialPosition = true;
  });

  export function getViewState() {
    return {
      currentBlockIndex,
      currentBlockId: currentBlock?.id ?? null,
      queueBlockIds: activeBlocks.map(b => b.id)
    };
  }
  
  async function syncChunkScheduleFromBlock(updatedBlock: IRBlockV4) {
    try {
      await services.init();
      const storage = services.storageService;
      if (!storage) return;
      const chunkData = (await storage.getChunkData(updatedBlock.id)) as IRChunkFileData | null;
      if (!chunkData) return;

      if (updatedBlock.nextRepDate) {
        chunkData.nextRepDate = updatedBlock.nextRepDate;
      }

      if (typeof updatedBlock.intervalDays === 'number') {
        chunkData.intervalDays = updatedBlock.intervalDays;
      }

      if (typeof updatedBlock.priorityEff === 'number') {
        chunkData.priorityEff = updatedBlock.priorityEff;
      }

      if (updatedBlock.status) {
        chunkData.scheduleStatus = updatedBlock.status;
      }

      if (updatedBlock.doneReason !== undefined) {
        chunkData.doneReason = updatedBlock.doneReason;
      }
      if (updatedBlock.doneAt !== undefined) {
        chunkData.doneAt = updatedBlock.doneAt;
      }

      chunkData.updatedAt = Date.now();
      await storage.saveChunkData(chunkData);
    } catch (error) {
      logger.warn('[IRFocusInterface] chunks.json 同步失败:', error);
    }
  }
  
  async function persistBlockUpdate(updatedBlock: IRBlockV4) {
    try {
      await services.init();
      if (isPdfBookmarkTaskId(updatedBlock.id)) {
        await services.v4SchedulerService?.pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock as any);
      } else if (isEpubBookmarkTaskId(updatedBlock.id)) {
        await services.v4SchedulerService?.epubBookmarkTaskService.updateTaskFromBlock(updatedBlock as any);
      } else {
        await services.storageService!.saveBlock(updatedBlock as any);
        await syncChunkScheduleFromBlock(updatedBlock);
      }
    } catch (error) {
      logger.warn('[IRFocusInterface] persistBlockUpdate 失败:', error);
    }
  }

  const isPdfBlock = $derived(currentBlock ? isPdfBookmarkTaskId(currentBlock.id) : false);
  const isEpubBlock = $derived(currentBlock ? isEpubBookmarkTaskId(currentBlock.id) : false);
  const isExternalBlock = $derived(isPdfBlock || isEpubBlock);

  // v3.1: 内容块导航所需的 siblings 派生状态
  const siblings = $derived.by(() => {
    if (!currentBlock) return { prev: null, next: null };
    // 尝试从 meta.siblings 获取
    const metaSiblings = currentBlock.meta?.siblings;
    if (metaSiblings && (metaSiblings.prev || metaSiblings.next)) return metaSiblings;
    // 否则使用数组索引
    return {
      prev: currentBlockIndex > 0 ? activeBlocks[currentBlockIndex - 1]?.id : null,
      next: currentBlockIndex < activeBlocks.length - 1 ? activeBlocks[currentBlockIndex + 1]?.id : null
    };
  });
  
  // 当前时间显示
  let currentTime = $state('');
  let timeInterval: number | null = null;
  
  // 阅读计时器
  let blockStartTime = $state(Date.now());
  let currentBlockTime = $state(0);
  let totalReadingTime = $state(0);
  let timerInterval: number | null = null;
  
  // v2.0 Phase 4: 理解度自评弹窗状态
  let showRatingModal = $state(false);
  let pendingRatingBlock: IRBlockV4 | null = $state(null);
  
  // v2.1: 增量阅读完成结算模态窗状态
  let showCompletionModal = $state(false);
  let completedBlocksCount = $state(0);  // 本次会话完成的内容块数
  let ratingSum = $state(0);             // 累计评分（用于计算平均理解度）
  let ratingCount = $state(0);           // 评分次数
  let extractedCardsCount = $state(0);   // 本次会话摘录的卡片数
  
  // v5.6: 内容块信息模态窗状态
  let showBlockInfoModal = $state(false);
  
  // v2.0 Phase 4: 底部悬浮自评功能栏状态
  let showRatingBar = $state(false);
  
  // v2.0 Phase 4: 设置面板状态
  let showSettingsMenu = $state(false);
  let settingsButtonElement: HTMLButtonElement | null = $state(null);
  
  // 自评功能设置（从持久化设置初始化）
  let showRatingTime = $state(initialSettings.showRatingTime ?? true);      // 是否显示预测时间（天数）
  let alwaysShowRating = $state(initialSettings.alwaysShowRating ?? false);   // 是否始终显示自评栏
  let showPrioritySticker = $state(initialSettings.showPrioritySticker ?? true);  // v2.1: 是否显示优先级贴纸
  
  
  // 格式化计时器时间
  function formatTimer(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // 更新计时器 (v4.0: 支持暂停)
  function updateTimer() {
    if (isTimerPaused) return;  // 暂停时不更新
    const now = Date.now();
    currentBlockTime = now - blockStartTime - accumulatedPausedTime;
    totalReadingTime = now - startTime - accumulatedPausedTime;
  }
  
  // v4.0: 切换计时器暂停/继续
  function toggleTimerPause() {
    if (isTimerPaused) {
      // 继续计时
      if (pausedAt) {
        accumulatedPausedTime += Date.now() - pausedAt;
      }
      pausedAt = null;
      isTimerPaused = false;
      pauseMode = null;
      showIdlePauseOverlay = false;
    } else {
      // 暂停计时
      pausedAt = Date.now();
      isTimerPaused = true;
      pauseMode = 'manual';
    }
  }
  

  // 折叠状态管理
  let collapsedFolders = $state<Set<string>>(new Set());
  let collapsedFiles = $state<Set<string>>(new Set());

  // 切换文件夹折叠状态
  function toggleFolder(folderPath: string) {
    const newSet = new Set(collapsedFolders);
    if (newSet.has(folderPath)) {
      newSet.delete(folderPath);
    } else {
      newSet.add(folderPath);
    }
    collapsedFolders = newSet;
  }

  // 切换文件折叠状态
  function toggleFile(filePath: string) {
    const newSet = new Set(collapsedFiles);
    if (newSet.has(filePath)) {
      newSet.delete(filePath);
    } else {
      newSet.add(filePath);
    }
    collapsedFiles = newSet;
  }

  // 获取内容块显示标题（无标题时显示第一行文本）
  function getBlockDisplayTitle(block: IRBlockV4): string {
    if ((block as any).headingText && (block as any).headingText.trim()) {
      return (block as any).headingText;
    }
    // 使用内容预览的第一行
    if ((block as any).contentPreview) {
      const firstLine = ((block as any).contentPreview as string).split('\n')[0].trim();
      return firstLine.substring(0, 50) || '未命名内容块';
    }
    return '未命名内容块';
  }

  // 从文件路径中提取文件夹路径
  function getFolderPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop(); // 移除文件名
    return parts.join('/') || '/';
  }

  // 从文件路径中提取文件名
  function getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  }

  // 层级目录结构：文件夹 > 文件 > 内容块
  interface FileNode {
    filePath: string;
    fileName: string;
    blocks: IRBlockV4[];
    blockCount: number;
  }

  interface FolderNode {
    folderPath: string;
    folderName: string;
    files: FileNode[];
    totalBlocks: number;
  }

  const hierarchyTree = $derived.by(() => {
    const folderMap = new Map<string, Map<string, IRBlockV4[]>>();
    
    // 按文件夹和文件分组
    for (const block of blocks) {
      const folderPath = getFolderPath(block.sourcePath);
      const filePath = block.sourcePath;
      
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, new Map());
      }
      const fileMap = folderMap.get(folderPath)!;
      
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, []);
      }
      fileMap.get(filePath)!.push(block);
    }
    
    // 构建层级结构
    const folders: FolderNode[] = [];
    for (const [folderPath, fileMap] of folderMap) {
      const files: FileNode[] = [];
      let totalBlocks = 0;
      
      for (const [filePath, fileBlocks] of fileMap) {
        files.push({
          filePath,
          fileName: getFileName(filePath),
          blocks: fileBlocks,
          blockCount: fileBlocks.length
        });
        totalBlocks += fileBlocks.length;
      }
      
      // 按文件名排序
      files.sort((a, b) => a.fileName.localeCompare(b.fileName));
      
      folders.push({
        folderPath,
        folderName: folderPath.split('/').pop() || folderPath || '根目录',
        files,
        totalBlocks
      });
    }
    
    // 按文件夹名排序
    folders.sort((a, b) => a.folderName.localeCompare(b.folderName));
    
    return folders;
  });

  // 跳转到指定内容块
  function jumpToBlock(blockId: string) {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index >= 0) {
      currentBlockIndex = index;
    }
  }

  // v3.1: 内容块导航跳转函数
  function handleNavigateToBlock(blockId: string) {
    const index = activeBlocks.findIndex(b => b.id === blockId);
    if (index >= 0) {
      currentBlockIndex = index;
    } else {
      logger.warn('[IRFocusInterface] 未找到目标块:', blockId);
    }
  }

  // 章节列表（按文件分组）- 保留兼容
  const chapters = $derived.by(() => {
    const chapterMap = new Map<string, { 
      headingText: string; 
      progress: number; 
      extractedCards: number;
      blockIds: string[];
    }>();
    
    for (const block of blocks) {
      const heading = (block as any).headingText || '未命名';
      if (!chapterMap.has(heading)) {
        chapterMap.set(heading, {
          headingText: heading,
          progress: 0,
          extractedCards: 0,
          blockIds: []
        });
      }
      chapterMap.get(heading)!.blockIds.push(block.id);
    }
    
    return Array.from(chapterMap.values());
  });

  // 更新时间
  function updateTime() {
    const now = new Date();
    currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // AI助手相关函数
  function handleAIAssistantClick(evt: MouseEvent) {
    if (aiAssistantMenuBuilder) {
      aiAssistantMenuBuilder.showMainMenu(evt);
    }
  }
  
  // 获取选中文本
  function getSelectedText(): string {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      return selection.toString();
    }
    return '';
  }

  function getSelectedTextForAI(): { text: string; canReplaceSelection: boolean } {
    const editor = EditorContextManager.getInstance().getCompatibleEditor();
    const editorSelected = editor?.getSelection?.()?.trim() || '';
    if (editorSelected) {
      return { text: editorSelected, canReplaceSelection: true };
    }

    return { text: getSelectedText(), canReplaceSelection: false };
  }

  async function handleAIFormatCustom(actionId: string) {
    const { text, canReplaceSelection } = getSelectedTextForAI();
    const selectedText = text.trim();

    if (!selectedText) {
      new Notice('请先选中要格式化的文本');
      return;
    }

    const actions = get(customActionsForMenu);
    const action = actions.format.find(a => a.id === actionId);

    if (!action) {
      new Notice('未找到指定的AI格式化功能');
      return;
    }

    const virtualCard: Card = {
      uuid: `ir-ai-format-${Date.now()}`,
      deckId: deckPath,
      templateId: 'basic',
      type: CardType.Basic,
      content: selectedText,
      tags: [],
      priority: 0,
      fsrs: {
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        retrievability: 0
      },
      reviewHistory: [],
      stats: {
        totalReviews: 0,
        totalTime: 0,
        averageTime: 0,
        memoryRate: 0
      },
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    } as Card;

    try {
      const executor = new AIActionExecutor(plugin);
      const result = await executor.executeFormat(action as any, virtualCard as any, {} as any);

      if (!result.success || !result.formattedContent) {
        new Notice('AI格式化失败');
        return;
      }

      const formatted = result.formattedContent;
      const editor = EditorContextManager.getInstance().getCompatibleEditor();

      if (canReplaceSelection && editor?.replaceSelection) {
        editor.replaceSelection(formatted);
        new Notice('已应用AI格式化结果');
        return;
      }

      try {
        await navigator.clipboard.writeText(formatted);
        new Notice('已复制AI格式化结果到剪贴板');
      } catch {
        new Notice('AI格式化完成（无法自动写入，请手动复制结果）');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI格式化失败';
      new Notice(`${message}`);
    }
  }

  async function handleTestGenerate(actionId: string) {
    const { text } = getSelectedTextForAI();
    const selectedText = text.trim();

    if (!selectedText) {
      new Notice('请先选中要生成测试题的文本');
      return;
    }

    const actions = get(customActionsForMenu);
    const action = actions.testGen.find(a => a.id === actionId);

    if (!action) {
      new Notice('未找到指定的测试题生成功能');
      return;
    }

    const virtualCard: Card = {
      uuid: `ir-ai-testgen-${Date.now()}`,
      deckId: deckPath,
      templateId: 'basic',
      type: CardType.Basic,
      content: selectedText,
      tags: [],
      priority: 0,
      fsrs: {
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        retrievability: 0
      },
      reviewHistory: [],
      stats: {
        totalReviews: 0,
        totalTime: 0,
        averageTime: 0,
        memoryRate: 0
      },
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    } as Card;

    try {
      const executor = new AIActionExecutor(plugin);
      const result = await executor.executeTestGen(action as any, virtualCard as any);

      const questions = result.generatedQuestions || [];
      if (!result.success || questions.length === 0) {
        new Notice('生成测试题失败');
        return;
      }

      const output = questions.map((q: any, i: number) => {
        const front = q.front ?? q.question ?? '';
        const back = q.back ?? q.answer ?? '';
        if (front || back) {
          return `# ${i + 1}\n\n${front}\n\n---div---\n\n${back}`;
        }
        return `# ${i + 1}\n\n${JSON.stringify(q, null, 2)}`;
      }).join('\n\n---\n\n');

      try {
        await navigator.clipboard.writeText(output);
        new Notice(`已生成 ${questions.length} 道题（已复制到剪贴板）`);
      } catch {
        new Notice(`已生成 ${questions.length} 道题`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成测试题失败';
      new Notice(`${message}`);
    }
  }
  
  // AI拆分处理函数
  async function handleAISplit(actionId: string) {
    const selectedText = getSelectedText();
    
    if (!selectedText) {
      new Notice('请先选中要拆分的文本');
      return;
    }
    
    const actions = get(customActionsForMenu);
    const action = actions.split.find(a => a.id === actionId);
    
    if (!action) {
      new Notice('未找到指定的AI拆分功能');
      return;
    }
    
    try {
      aiSplitInProgress = true;
      new Notice('正在拆分选中文本...');
      
      // 获取AI服务
      const { AIServiceFactory } = await import('../../services/ai/AIServiceFactory');
      const provider = action.provider || plugin.settings.aiConfig?.defaultProvider || 'openai';
      
      let model = action.model;
      if (!model) {
        const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[provider];
        model = providerConfig?.model;
      }
      if (!model) {
        const defaultModels: Record<string, string> = {
          'openai': 'gpt-3.5-turbo',
          'zhipu': 'glm-4-plus',
          'deepseek': 'deepseek-chat',
          'anthropic': 'claude-3-5-sonnet-20241022',
          'gemini': 'gemini-pro',
          'siliconflow': 'Qwen/Qwen2.5-7B-Instruct'
        };
        model = defaultModels[provider] || 'gpt-3.5-turbo';
      }
      
      // 检查API配置
      const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[provider];
      if (!providerConfig || !providerConfig.apiKey) {
        throw new Error(`AI服务未配置或缺少API密钥，请在 [插件设置 > AI服务 > ${provider}] 中配置`);
      }
      
      const aiService = AIServiceFactory.createService(provider, plugin, model);
      
      if (!aiService) {
        throw new Error(`无法创建AI服务实例，请检查 ${provider} 配置`);
      }
      
      // 构建拆分请求
      const request: SplitCardRequest = {
        parentCardId: `ir-block-${currentBlock?.id || Date.now()}`,
        content: {
          front: selectedText,
          back: ''
        },
        targetCount: 3,
        instruction: (plugin.settings as any).aiConfig?.cardSplitting?.defaultInstruction || undefined
      };
      
      // 调用AI拆分（添加超时控制）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI服务请求超时（30秒），请检查网络连接或重试')), 30000);
      });
      
      const response = await Promise.race([
        aiService.splitParentCard(request),
        timeoutPromise
      ]) as any;
      
      if (!response.success || !response.childCards || response.childCards.length === 0) {
        throw new Error(response.error || '拆分失败');
      }
      
      // 转换为临时卡片数据用于预览
      const tempChildCards: Card[] = response.childCards.map((child: any, index: number) => {
        const bodyContent = child.front && child.back 
          ? `${child.front}\n\n---div---\n\n${child.back}` 
          : (child.content || child.front || '');
        
        return {
          uuid: `temp-uuid-${Date.now()}-${index}`,
          deckId: deckPath,
          templateId: 'basic',
          type: CardType.Basic,
          content: bodyContent,
          tags: child.tags || [],
          priority: 0,
          fsrs: {
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            retrievability: 0
          },
          reviewHistory: [],
          stats: {
            totalReviews: 0,
            totalTime: 0,
            averageTime: 0,
            memoryRate: 0
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        } as Card;
      });
      
      childCards = tempChildCards;
      currentSplitAction = action;

      // 确保牌组列表已加载，并选择一个有效的默认目标牌组
      await loadAvailableDecks();
      if (availableDecks.length > 0 && !availableDecks.find(d => d.id === targetDeckIdForSplit)) {
        targetDeckIdForSplit = availableDecks[0].id;
      }

      showChildCardsOverlay = true;
      new Notice(`成功拆分为${childCards.length}张子卡片`);
      
    } catch (error) {
      logger.error('[IRFocusInterface] AI拆分失败:', error);
      
      let errorMessage = '拆分失败';
      if (error instanceof Error) {
        // 检测特定错误类型并提供更友好的提示
        if (error.message.includes('ERR_TIMED_OUT') || error.message.includes('timeout')) {
          errorMessage = 'AI服务请求超时，请检查网络连接或稍后重试';
        } else if (error.message.includes('API密钥') || error.message.includes('API key')) {
          errorMessage = 'AI服务未配置或API密钥无效，请在设置中检查配置';
        } else if (error.message.includes('网络') || error.message.includes('network')) {
          errorMessage = '网络连接失败，请检查网络设置';
        } else if (error.message.includes('rate limit') || error.message.includes('限制')) {
          errorMessage = 'API调用频率超限，请稍后重试';
        } else {
          errorMessage = error.message;
        }
      }
      
      new Notice(`拆分失败: ${errorMessage}`);
    } finally {
      aiSplitInProgress = false;
    }
  }
  
  // 处理保存选中的子卡片
  async function handleSaveSelectedChildCards() {
    try {
      const selectedIds = childCardsOverlayRef?.getSelectedCardIds?.() || [];
      
      if (selectedIds.length === 0) {
        new Notice('请先选择要保存的卡片');
        return;
      }
      
      if (!targetDeckIdForSplit) {
        new Notice('请先选择目标牌组');
        return;
      }
      
      const selectedCards = childCards.filter(c => selectedIds.includes(c.uuid));
      
      // 保存卡片到选定的牌组
      new Notice('正在保存到记忆牌组...');
      
      // 获取数据存储服务
      const dataStorage = (plugin as any).dataStorage;
      if (!dataStorage?.saveCard) {
        throw new Error('数据存储服务未初始化');
      }
      
      let savedCount = 0;
      for (const card of selectedCards) {
        try {
          // 更新卡片的牌组ID
          const cardToSave = { 
            ...card, 
            deckId: targetDeckIdForSplit,
            uuid: `card-${Date.now()}-${Math.random().toString(36).substring(2, 11)}` // 生成新UUID
          };
          
          // 保存卡片
          const result = await dataStorage.saveCard(cardToSave);
          if (!result.success) {
            logger.warn('[IRFocusInterface] 保存卡片返回失败:', result.error);
            continue;
          }
          savedCount++;
          
          // 触发卡片创建事件
          (plugin.app.workspace as any).trigger('Weave:card-created', {
            card: cardToSave,
            deckId: targetDeckIdForSplit,
            source: 'ir-ai-split'
          });
        } catch (err) {
          logger.error('[IRFocusInterface] 保存单张卡片失败:', err);
        }
      }
      
      new Notice(`成功导入 ${savedCount} 张卡片到记忆牌组`);
      
      // 关闭浮层
      showChildCardsOverlay = false;
      childCards = [];
      currentSplitAction = null;
      targetDeckIdForSplit = deckPath; // 重置为当前牌组
      
      if (childCardsOverlayRef?.clearSelection) {
        childCardsOverlayRef.clearSelection();
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 保存子卡片失败:', error);
      new Notice('保存失败，请重试');
    }
  }
  
  // 关闭子卡片浮层
  function handleCloseChildOverlay() {
    showChildCardsOverlay = false;
    childCards = [];
    currentSplitAction = null;
    targetDeckIdForSplit = '';
    
    if (childCardsOverlayRef?.clearSelection) {
      childCardsOverlayRef.clearSelection();
    }
  }
  
  // 重新生成子卡片
  async function handleRegenerateChildCards() {
    if (!childCardsOverlayRef || !currentSplitAction) return;
    
    try {
      // 获取选中的卡片ID
      const selectedIds = childCardsOverlayRef.getSelectedCardIds() || [];
      const hasSelection = selectedIds.length > 0;
      
      if (hasSelection) {
        // 有选中：只重新生成选中的部分
        const selectedCount = selectedIds.length;
        new Notice(`正在重新生成 ${selectedCount} 张选中的卡片...`);
        
        // 将选中的卡片ID添加到regeneratingCardIds
        regeneratingCardIds = new Set(selectedIds);
        
        // 清空选中状态
        childCardsOverlayRef.clearSelection();
        
        // 重新调用AI拆分，但只替换选中的卡片
        await handleAISplitWithRegeneration(currentSplitAction.id, selectedIds);
        
      } else {
        // 无选中：全部重新生成
        const totalCount = childCards.length;
        new Notice(`正在重新生成全部 ${totalCount} 张卡片...`);
        
        // 将所有卡片ID添加到regeneratingCardIds
        regeneratingCardIds = new Set(childCards.map(card => card.uuid));
        
        // 清空选中状态
        childCardsOverlayRef.clearSelection();
        
        // 重新调用AI拆分
        await handleAISplit(currentSplitAction.id);
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 重新生成失败:', error);
      new Notice('重新生成失败，请重试');
    } finally {
      regeneratingCardIds.clear();
      regeneratingCardIds = new Set();
    }
  }
  
  // AI拆分（支持部分重新生成）
  async function handleAISplitWithRegeneration(actionId: string, cardIdsToReplace: string[]) {
    const selectedText = getSelectedText();
    
    if (!selectedText) {
      new Notice('请先选中要拆分的文本');
      return;
    }
    
    const actions = get(customActionsForMenu);
    const action = actions.split.find(a => a.id === actionId);
    
    if (!action) return;
    
    try {
      aiSplitInProgress = true;
      
      // 获取AI服务
      const { AIServiceFactory } = await import('../../services/ai/AIServiceFactory');
      const provider = action.provider || plugin.settings.aiConfig?.defaultProvider || 'openai';
      
      let model = action.model;
      if (!model) {
        const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[provider];
        model = providerConfig?.model;
      }
      if (!model) {
        const defaultModels: Record<string, string> = {
          'openai': 'gpt-3.5-turbo',
          'zhipu': 'glm-4-plus',
          'deepseek': 'deepseek-chat',
          'anthropic': 'claude-3-5-sonnet-20241022',
          'gemini': 'gemini-pro',
          'siliconflow': 'Qwen/Qwen2.5-7B-Instruct'
        };
        model = defaultModels[provider] || 'gpt-3.5-turbo';
      }
      
      const aiService = AIServiceFactory.createService(provider, plugin, model);
      
      if (!aiService) {
        throw new Error(`无法创建AI服务实例`);
      }
      
      // 构建拆分请求
      const request: SplitCardRequest = {
        parentCardId: `ir-block-${currentBlock?.id || Date.now()}`,
        content: {
          front: selectedText,
          back: ''
        },
        targetCount: cardIdsToReplace.length, // 生成同样数量的卡片
        instruction: (plugin.settings as any).aiConfig?.cardSplitting?.defaultInstruction || undefined
      };
      
      // 调用AI拆分（添加超时控制）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI服务请求超时（30秒），请检查网络连接或重试')), 30000);
      });
      
      const response = await Promise.race([
        aiService.splitParentCard(request),
        timeoutPromise
      ]) as any;
      
      if (!response.success || !response.childCards || response.childCards.length === 0) {
        throw new Error(response.error || '拆分失败');
      }
      
      // 转换为临时卡片数据
      const newCards: Card[] = response.childCards.slice(0, cardIdsToReplace.length).map((child: any, index: number) => {
        const bodyContent = child.front && child.back 
          ? `${child.front}\n\n---div---\n\n${child.back}` 
          : (child.content || child.front || '');
        
        return {
          uuid: `temp-uuid-${Date.now()}-${index}`,
          deckId: deckPath,
          templateId: 'basic',
          type: CardType.Basic,
          content: bodyContent,
          tags: child.tags || [],
          priority: 0,
          fsrs: {
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            retrievability: 0
          },
          reviewHistory: [],
          stats: {
            totalReviews: 0,
            totalTime: 0,
            averageTime: 0,
            memoryRate: 0
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        } as Card;
      });
      
      // 替换选中的卡片
      const updatedCards = [...childCards];
      let replaceIndex = 0;
      for (let i = 0; i < updatedCards.length && replaceIndex < newCards.length; i++) {
        if (cardIdsToReplace.includes(updatedCards[i].uuid)) {
          updatedCards[i] = newCards[replaceIndex++];
        }
      }
      
      childCards = updatedCards;
      new Notice(`成功重新生成 ${newCards.length} 张卡片`);
      
    } catch (error) {
      logger.error('[IRFocusInterface] AI拆分失败:', error);
      throw error;
    } finally {
      aiSplitInProgress = false;
    }
  }
  
  // 处理牌组选择变化
  function handleSplitDeckChange(deckId: string) {
    targetDeckIdForSplit = deckId;
    logger.debug('[AI拆分] 选择目标牌组:', deckId);
  }
  
  // 处理管理AI功能
  function handleManageAIFeatures() {
    // 打开AI助手配置模态窗
    const modal = new (plugin.app as any).Modal(plugin.app);
    modal.titleEl.textContent = 'AI助手功能配置';
    modal.contentEl.style.width = '600px';
    
    // 创建配置界面
    const container = modal.contentEl.createDiv({ cls: 'ai-features-config' });
    
    // 说明文字
    container.createEl('p', { 
      text: '在这里配置AI助手的功能，包括AI拆分、格式化、生成测试题等。',
      cls: 'setting-item-description'
    });
    
    // 打开设置页面按钮
    const settingsBtn = container.createEl('button', {
      text: '打开AI服务设置',
      cls: 'mod-cta'
    });
    
    settingsBtn.addEventListener('click', () => {
      modal.close();
      // 打开插件设置的AI服务配置页
      (plugin.app as any).setting.open();
      (plugin.app as any).setting.openTabById('weave');
      
      // 尝试滚动到AI配置部分
      setTimeout(() => {
        const aiSection = document.querySelector('.setting-item-heading:has-text("AI服务配置")');
        if (aiSection) {
          aiSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });
    
    // 快速配置提示
    container.createEl('div', { cls: 'setting-item-description', text: '' }).createEl('ul').innerHTML = `
      <li>配置API密钥以启用AI功能</li>
      <li>选择默认的AI服务提供商</li>
      <li>自定义AI拆分和格式化提示词</li>
      <li>管理测试题生成模板</li>
    `;
    
    modal.open();
  }

  // 格式化下次阅读时间
  function formatNextReview(timestamp: number | null): string {
    if (!timestamp) return '未安排';
    const reviewDate = new Date(timestamp);
    const today = new Date();
    const diffDays = Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays <= 7) return `${diffDays}天后`;
    return reviewDate.toLocaleDateString();
  }

  // 跳转到章节
  function jumpToChapter(headingText: string) {
    const index = blocks.findIndex(b => (b as any).headingText === headingText);
    if (index >= 0) {
      currentBlockIndex = index;
    }
  }

  // 显示理解度自评弹窗 (v2.0 Phase 4)
  function showRatingPrompt() {
    if (!currentBlock) return;
    pendingRatingBlock = currentBlock;
    showRatingModal = true;
  }

  // 处理理解度评分 (v2.0 Phase 4)
  async function handleRating(rating: IRRating) {
    showRatingModal = false;
    if (pendingRatingBlock) {
      await completeBlockWithRating(pendingRatingBlock, rating);
      pendingRatingBlock = null;
    }
  }

  // 完成当前块 (v6.0: 直接使用 V4 调度算法)
  async function completeBlockWithRating(block: IRBlockV4, rating: IRRating) {
    try {
      await services.init();
      
      // v4.0: 使用 V4 调度服务进行调度（支持 TagGroup/EWMA/预算/公平分配等）
      const readingTimeSeconds = Math.floor(currentBlockTime / 1000);
      const deckId = deckPath;
      
      // 构建 v4.0 完成数据
      const completionData: ReadingCompletionDataV4 = {
        rating,
        readingTimeSeconds,
        priorityUi: block.priorityUi ?? 5,
        createdCardCount: extractedCardsCount,
        createdExtractCount: annotationSignal?.effectiveCalloutCount ?? 0,
        createdNoteCount: 0,
        annotationSignal: annotationSignal?.signal ?? 0
      };
      
      // v6.0: 直接使用 V4 调度服务
      const result = await services.v4SchedulerService!.completeBlockV4(
        block,
        completionData,
        deckId
      );
      
      const updatedBlock = result.block;
      
      // 同步持久化（completeBlockV4 已处理 PDF/EPUB 书签任务，此处同步 chunks.json）
      if (!isPdfBookmarkTaskId(updatedBlock.id) && !isEpubBookmarkTaskId(updatedBlock.id)) {
        await syncChunkScheduleFromBlock(updatedBlock);
      }
      
      // 更新本地状态 - 创建新数组触发响应式更新
      const blockIndex = blocks.findIndex(b => b.id === block.id);
      if (blockIndex >= 0) {
        const newBlocks = [...blocks];
        newBlocks[blockIndex] = updatedBlock;
        blocks = newBlocks;
      }
      
      // v2.1: 记录统计数据
      completedBlocksCount++;
      ratingSum += rating;
      ratingCount++;
      
      onBlockComplete?.(block.id);
      
      // 根据评分显示不同提示
      const ratingText = ['忽略', '一般', '清晰', '精通'][rating - 1];
      
      logger.debug('[IRFocusInterface] 块已完成:', block.id, `评分:${rating}, 间隔:${result.intervalDays.toFixed(1)}天`);
      
      // 重置块计时器
      blockStartTime = Date.now();
      currentBlockTime = 0;
      
      // v2.1: 检查是否是最后一块，如果是则显示结算模态窗
      if (currentBlockIndex >= totalBlocks - 1) {
        // 最后一块完成，显示结算模态窗
        showCompletionModal = true;
        logger.info('[IRFocusInterface] 增量阅读完成，显示结算模态窗');
      } else {
        // 还有更多内容块，显示提示并跳转下一块
        new Notice(`已完成 (理解度: ${ratingText})，${result.intervalDays.toFixed(1)}天后复习`);
        currentBlockIndex++;
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 完成块失败:', error);
      new Notice('操作失败');
    }
  }
  
  // 快速完成（默认评分3=清晰）
  function quickComplete() {
    if (!currentBlock) return;
    showRatingPrompt();
  }

  // 跳过当前块 (v4.0: 使用 V4 调度服务)
  async function skipBlock() {
    if (!currentBlock) return;
    
    try {
      await services.init();
      // v6.0: 直接使用 V4 调度服务
      await services.v4SchedulerService?.skipBlockV4(currentBlock, deckPath);
    } catch (error) {
      logger.warn('[IRFocusInterface] 跳过块记录失败:', error);
    }
    
    onBlockSkip?.(currentBlock.id);
    nextBlock();
    
    logger.debug('[IRFocusInterface] 块已跳过:', currentBlock.id);
  }

  // 下一块
  function nextBlock() {
    if (currentBlockIndex < totalBlocks - 1) {
      currentBlockIndex++;
    } else {
      new Notice('已到达最后一块');
    }
  }

  // 上一块
  function prevBlock() {
    if (currentBlockIndex > 0) {
      currentBlockIndex--;
    }
  }

  // v2.1: 处理结算模态窗关闭
  function handleCompletionClose() {
    showCompletionModal = false;
    // v6.0: 显示会话确认弹窗
    triggerSessionConfirm(() => {
      isNormalSessionEnd = true;
      onClose();
    });
  }
  
  // v6.0: 触发会话确认弹窗
  function triggerSessionConfirm(afterConfirmAction: () => void) {
    pendingCloseAction = afterConfirmAction;
    showSessionConfirmModal = true;
  }

  function requestCloseWithSessionConfirm() {
    if (showSessionConfirmModal) return;
    triggerSessionConfirm(() => {
      isNormalSessionEnd = true;
      onClose();
    });
  }
  
  // v6.0: 处理会话确认
  async function handleSessionConfirm(confirmedDurationSeconds: number) {
    showSessionConfirmModal = false;
    
    // 保存学习会话记录
    try {
      const irStorage = new IRStorageService(plugin.app);
      await irStorage.initialize();
      
      const session: IRStudySession = {
        id: `study-session-${Date.now()}`,
        deckId: deckPath,
        deckName: deckName,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        autoRecordedDuration: Math.floor(totalReadingTime / 1000),
        confirmedDuration: confirmedDurationSeconds,
        blocksCompleted: completedBlocksCount,
        cardsCreated: extractedCardsCount
      };
      
      await irStorage.addStudySession(session);
      logger.info(`[IRFocusInterface] 学习会话已记录: ${session.id}, 时长: ${confirmedDurationSeconds}秒`);
    } catch (error) {
      logger.error('[IRFocusInterface] 保存学习会话失败:', error);
    }
    
    // 触发数据更新事件，让牌组列表和侧边月历刷新
    window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    
    // 执行待执行的关闭回调
    if (pendingCloseAction) {
      isNormalSessionEnd = true;
      pendingCloseAction();
      pendingCloseAction = null;
    }
  }
  
  // v6.0: 处理会话确认弹窗关闭（不记录）
  function handleSessionConfirmClose() {
    showSessionConfirmModal = false;
    // 即使不记录会话，也执行关闭回调
    if (pendingCloseAction) {
      isNormalSessionEnd = true;
      pendingCloseAction();
      pendingCloseAction = null;
    }
  }
  
  // v2.1: 前往记忆牌组
  function handleGoToMemoryDeck() {
    showCompletionModal = false;
    isNormalSessionEnd = true;  // v5.8: 标记正常结束
    onClose();  // 先关闭增量阅读界面
    
    // 切换到记忆牌组界面
    // 通过设置筛选器为 'memory' 来切换到记忆牌组视图
    try {
      // 使用plugin的方法切换到记忆牌组页面
      const studyView = plugin.app.workspace.getLeavesOfType('weave-study-view')[0];
      if (studyView) {
        plugin.app.workspace.revealLeaf(studyView);
        // 触发记忆牌组筛选
        const viewInstance = studyView.view as any;
        if (viewInstance && typeof viewInstance.setFilter === 'function') {
          viewInstance.setFilter('memory');
        }
      }
      logger.info('[IRFocusInterface] 已切换到记忆牌组界面');
    } catch (error) {
      logger.error('[IRFocusInterface] 切换到记忆牌组失败:', error);
      new Notice('切换失败，请手动打开记忆牌组');
    }
  }

  // 提取卡片
  function extractCard() {
    onExtractCard?.();
    new Notice('卡片提取功能开发中');
  }
  
  // v5.8: 处理卡片创建事件，按块统计（使用持久化服务）
  function handleCardCreated(card: any) {
    if (!currentBlock || !sessionCardStatsService) return;
    
    // 判断卡片是否属于当前块（通过 sourceFile 匹配）
    const cardSourceFile = card.sourceFile || card.cardMetadata?.sourceFile;
    if (cardSourceFile !== currentBlock.sourcePath) {
      return;  // 不是当前块的卡片，忽略
    }
    
    const blockId = currentBlock.id;
    const cardUuid = card.uuid;
    
    if (!cardUuid) return;
    
    // 使用服务记录卡片
    sessionCardStatsService.addCardToBlock(blockId, currentBlock.sourcePath, cardUuid);
    
    // 更新当前块的制卡数（触发响应式更新）
    currentBlockCardCount = sessionCardStatsService.getBlockCardCount(blockId);
    
    // v3.1: 刷新总制卡数（从存储查询）
    refreshCardCount();
    
    logger.debug(`[IRFocusInterface] 卡片创建事件: block=${blockId}, card=${cardUuid}, count=${currentBlockCardCount}`);
  }
  
  // v5.8: 处理卡片删除事件，削减计数
  function handleCardDeleted(cardUuid: string) {
    if (!currentBlock || !sessionCardStatsService) return;
    
    // 更新当前块的制卡数
    currentBlockCardCount = sessionCardStatsService.getBlockCardCount(currentBlock.id);
    
    // v3.1: 刷新总制卡数
    refreshCardCount();
    
    logger.debug(`[IRFocusInterface] 卡片删除事件: card=${cardUuid}, currentCount=${currentBlockCardCount}`);
  }
  
  // v3.1: 刷新当前文档的总制卡数（从存储查询）
  async function refreshCardCount() {
    if (!currentBlock?.sourcePath) return;
    try {
      const cards = await plugin.dataStorage?.getCardsBySourceFile(currentBlock.sourcePath);
      historicalCardCount = cards?.length ?? 0;
    } catch {
      // 静默失败
    }
  }


  // 编辑文档
  function editDocument() {
    if (!currentBlock) return;
    
    const file = plugin.app.vault.getAbstractFileByPath(currentBlock.sourcePath);
    if (file) {
      const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';

      const pdfBookmarkLink = (currentBlock as any)?.pdfBookmarkLink;
      const epubBookmarkHref = (currentBlock as any)?.epubBookmarkHref;
      let linkText: string;
      if (typeof pdfBookmarkLink === 'string' && pdfBookmarkLink.trim().length > 0) {
        linkText = pdfBookmarkLink.trim().replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
      } else {
        linkText = currentBlock.sourcePath;
      }

      // EPUB: reuse existing tab or open new
      if (isEpubBookmarkTaskId(currentBlock.id) && epubBookmarkHref) {
        const navDetail = { filePath: currentBlock.sourcePath, href: epubBookmarkHref };
        const existingLeaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EPUB)
          .find(l => {
            try {
              const s = (l.view as any)?.getState?.();
              return s?.filePath === currentBlock.sourcePath || s?.file === currentBlock.sourcePath;
            } catch { return false; }
          });
        if (existingLeaf) {
          plugin.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
          window.dispatchEvent(new CustomEvent('Weave:epub-navigate', { detail: navDetail }));
        } else {
          (window as any).__weaveEpubPendingNav = navDetail;
          plugin.app.workspace.openLinkText(linkText, contextPath, true);
        }
      } else {
        plugin.app.workspace.openLinkText(linkText, contextPath, true);
      }
    }
  }

  // 图谱联动状态
  let isGraphLinked = $state(false);
  let graphSyncLeaf = $state<any>(null);  // 图谱联动专属leaf引用
  let lastSyncedFilePath = $state<string | null>(null);  // 上次同步的文件路径

  // 复习提醒模态框状态（参考 StudyInterface）
  let showReminderModal = $state(false);
  let customReviewDate = $state("");
  let customReviewTime = $state("");

  // 优先级模态框状态（参考 StudyInterface）
  let showPriorityModal = $state(false);
  let selectedPriority = $state(2);
  
  // v3.0: 优先级滑动条展开状态
  let showPrioritySlider = $state(false);
  let priorityButtonElement: HTMLButtonElement | null = $state(null);  // v4.0: 优先级按钮引用
  let currentPriorityUi = $derived(currentBlock?.priorityUi ?? 5);
  
  // v4.0: 优先级理由输入（强制输入）
  let priorityReason = $state('');
  
  // 临时存储滑动条的优先级值，避免直接修改派生状态
  let tempPriorityValue = $state(5);

  // v3.0: 处理优先级滑动条变化
  async function handlePrioritySliderChange(newPriorityUi: number) {
    if (!currentBlock) return;
    
    try {
      await services.init();
      
      // 计算新的有效优先级（使用 EWMA）
      const priorityEffOld = currentBlock.priorityEff ?? 5;
      const priorityEffNew = calculatePriorityEWMA(
        newPriorityUi,
        priorityEffOld
      );
      
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        priorityUi: newPriorityUi,
        priorityEff: priorityEffNew,
        updatedAt: Date.now()
      };
      
      await persistBlockUpdate(updatedBlock);
      
      // 更新本地状态 - 创建新数组触发响应式更新
      const blockIndex = activeBlocks.findIndex(b => b.id === currentBlock.id);
      if (blockIndex >= 0) {
        // 重要：创建新数组以触发响应式更新
        const newActiveBlocks = [...activeBlocks];
        newActiveBlocks[blockIndex] = updatedBlock;
        activeBlocks = newActiveBlocks;
      }
      
      // 同样更新原始 blocks 数组
      const newBlocks = [...blocks];
      newBlocks[currentBlockIndex] = updatedBlock;
      blocks = newBlocks;
      
      const priorityLabel = newPriorityUi <= 3 ? '低' : newPriorityUi <= 6 ? '中' : newPriorityUi <= 8 ? '高' : '紧急';
      new Notice(`优先级已设置为 ${newPriorityUi.toFixed(1)} (${priorityLabel})`);
      
      logger.debug('[IRFocusInterface] v3.0 优先级已保存:', currentBlock.id, {
        priorityUi: newPriorityUi,
        priorityEff: priorityEffNew
      });
    } catch (error) {
      logger.error('[IRFocusInterface] 设置优先级失败:', error);
      new Notice('设置优先级失败');
    }
  }

  // 设置下次复习时间（打开模态框）
  function setNextReview() {
    if (!currentBlock) return;
    
    // 默认设置为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    customReviewDate = tomorrow.toISOString().split('T')[0];
    customReviewTime = new Date().toTimeString().slice(0, 5);
    
    showReminderModal = true;
  }

  // 确认设置复习时间
  async function confirmSetReminder() {
    if (!currentBlock || !currentBlock.sourcePath) {
      new Notice('请选择复习日期');
      return;
    }
    
    try {
      const reviewDateTime = new Date(`${customReviewDate}T${customReviewTime || '09:00'}`);
      
      // v2.0: 保存复习时间到块数据
      await services.init();
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        nextRepDate: reviewDateTime.getTime(),
        updatedAt: Date.now()
      };
      await persistBlockUpdate(updatedBlock);

      const blockIndex = activeBlocks.findIndex(b => b.id === currentBlock.id);
      if (blockIndex >= 0) {
        // 创建新数组触发响应式更新
        const newActiveBlocks = [...activeBlocks];
        newActiveBlocks[blockIndex] = updatedBlock;
        activeBlocks = newActiveBlocks;
      }
      
      new Notice(`复习时间已设置为：${reviewDateTime.toLocaleString()}`);
      showReminderModal = false;
      logger.debug('[IRFocusInterface] 复习时间已保存:', currentBlock.id, reviewDateTime.toISOString());
    } catch (error) {
      logger.error('[IRFocusInterface] 设置复习时间失败:', error);
      new Notice('设置复习时间失败');
    }
  }

  // 设置重要程度（打开模态框）
  function changePriority() {
    if (!currentBlock) return;
    selectedPriority = Math.round(currentBlock.priorityUi) || 5;
    showPriorityModal = true;
  }

  // 确认设置优先级
  async function confirmChangePriority() {
    if (!currentBlock) return;
    
    try {
      // v2.0: 保存优先级到块数据 (1=低, 2=中, 3=高)
      await services.init();
      // 映射UI优先级(1-4)到v2.0优先级(1-3)
      const v2Priority = selectedPriority >= 3 ? 1 : selectedPriority === 2 ? 2 : 3;
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        priorityUi: selectedPriority,
        updatedAt: Date.now()
      };
      await persistBlockUpdate(updatedBlock);

      const blockIndex = activeBlocks.findIndex(b => b.id === currentBlock.id);
      if (blockIndex >= 0) {
        // 创建新数组触发响应式更新
        const newActiveBlocks = [...activeBlocks];
        newActiveBlocks[blockIndex] = updatedBlock;
        activeBlocks = newActiveBlocks;
      }
      // 同样更新原始 blocks 数组
      const newBlocks = [...blocks];
      newBlocks[currentBlockIndex] = updatedBlock;
      blocks = newBlocks;
      
      const priorityText = ['', '低', '中', '高', '紧急'][selectedPriority] || '中';
      new Notice(`优先级已设置为：${priorityText}`);
      showPriorityModal = false;
      logger.debug('[IRFocusInterface] 优先级已保存:', currentBlock.id, v2Priority);
    } catch (error) {
      logger.error('[IRFocusInterface] 设置优先级失败:', error);
      new Notice('设置优先级失败');
    }
  }

  // 获取优先级颜色（参考 VerticalToolbar）
  function getPriorityColor(priority: number): string {
    switch (priority) {
      case 1: return 'var(--text-muted)';
      case 2: return 'var(--text-normal)';
      case 3: return 'var(--text-warning)';
      case 4: return 'var(--text-error)';
      default: return 'var(--text-normal)';
    }
  }

  // 切换图谱联动
  async function toggleGraphLink() {
    const newState = !isGraphLinked;
    
    if (newState) {
      // 开启联动
      const success = await initializeGraphSync();
      if (success) {
        isGraphLinked = true;
        new Notice('图谱联动已开启');
      }
    } else {
      // 关闭联动 - 分离图谱leaf并清理
      if (graphSyncLeaf) {
        try {
          graphSyncLeaf.detach();
          logger.debug('[IRFocusInterface] 已分离图谱leaf');
        } catch (error) {
          logger.warn('[IRFocusInterface] 分离图谱leaf失败:', error);
        }
      }
      graphSyncLeaf = null;
      lastSyncedFilePath = null;
      isGraphLinked = false;
      new Notice('图谱联动已关闭');
    }
  }
  
  // 初始化图谱同步
  async function initializeGraphSync(): Promise<boolean> {
    if (!currentBlock?.sourcePath) {
      new Notice('当前内容块没有关联的源文件');
      return false;
    }
    
    try {
      const filePath = currentBlock.sourcePath;
      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!file) {
        new Notice('源文件不存在');
        return false;
      }
      
      // 在右侧创建局部图谱leaf
      graphSyncLeaf = plugin.app.workspace.getLeaf('split', 'vertical');
      
      // 设置图谱视图状态
      await graphSyncLeaf.setViewState({
        type: 'localgraph',
        state: { file: filePath }
      });
      
      // 强制刷新图谱视图
      const view = graphSyncLeaf.view;
      if (view) {
        if (typeof (view as any).update === 'function') {
          (view as any).update();
        }
        if (typeof (view as any).render === 'function') {
          (view as any).render();
        }
        if (typeof view.onResize === 'function') {
          view.onResize();
        }
      }
      
      // 触发布局变化事件
      plugin.app.workspace.trigger('layout-change');
      
      // 延迟后再次刷新，确保图谱完全加载
      setTimeout(async () => {
        if (graphSyncLeaf && !graphSyncLeaf.detached) {
          try {
            await graphSyncLeaf.setViewState({
              type: 'localgraph',
              state: { file: filePath }
            });
          } catch (e) {
            // 忽略延迟刷新的错误
          }
        }
      }, 200);
      
      lastSyncedFilePath = filePath;
      logger.debug('[IRFocusInterface] 已打开局部图谱:', filePath);
      return true;
    } catch (error) {
      logger.error('[IRFocusInterface] 初始化图谱同步失败:', error);
      new Notice('打开图谱失败');
      return false;
    }
  }
  
  // 同步图谱到当前内容块
  async function syncLocalGraphWithBlock(filePath: string) {
    try {
      if (!graphSyncLeaf || graphSyncLeaf.detached) {
        logger.warn('[IRFocusInterface] 图谱leaf不可用');
        return;
      }
      
      // 设置新的视图状态
      await graphSyncLeaf.setViewState({
        type: 'localgraph',
        state: { file: filePath }
      });
      
      // 尝试调用内部刷新方法
      const view = graphSyncLeaf.view;
      if (view) {
        if (typeof (view as any).update === 'function') {
          (view as any).update();
        }
        if (typeof (view as any).render === 'function') {
          (view as any).render();
        }
        if (typeof view.onResize === 'function') {
          view.onResize();
        }
      }
      
      // 触发布局变化事件
      plugin.app.workspace.trigger('layout-change');
      
      // 延迟后再次刷新
      setTimeout(async () => {
        if (graphSyncLeaf && !graphSyncLeaf.detached) {
          try {
            await graphSyncLeaf.setViewState({
              type: 'localgraph',
              state: { file: filePath }
            });
          } catch (e) {
            // 忽略
          }
        }
      }, 100);
      
      lastSyncedFilePath = filePath;
      logger.debug('[IRFocusInterface] 图谱已同步到:', filePath);
    } catch (error) {
      logger.error('[IRFocusInterface] 同步图谱失败:', error);
    }
  }
  
  // 监听内容块切换，自动同步图谱
  $effect(() => {
    const block = currentBlock;
    const filePath = block?.sourcePath;
    const graphEnabled = isGraphLinked;
    const leafRef = graphSyncLeaf;
    
    if (graphEnabled && filePath && leafRef && filePath !== lastSyncedFilePath) {
      // 防抖处理
      const timer = setTimeout(() => {
        syncLocalGraphWithBlock(filePath);
      }, 150);
      
      return () => clearTimeout(timer);
    }
  });

  // 切换收藏 (v2.0: 实现收藏持久化)
  async function toggleFavorite() {
    if (!currentBlock) return;
    
    try {
      await services.init();
      const newFavorite = !currentBlock.favorite;
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        favorite: newFavorite,
        updatedAt: Date.now()
      };
      await persistBlockUpdate(updatedBlock);
      
      // 更新本地状态 - 创建新数组触发响应式更新
      const blockIndex = activeBlocks.findIndex(b => b.id === currentBlock.id);
      if (blockIndex >= 0) {
        const newActiveBlocks = [...activeBlocks];
        newActiveBlocks[blockIndex] = updatedBlock;
        activeBlocks = newActiveBlocks;
      }
      const newBlocks = [...blocks];
      newBlocks[currentBlockIndex] = updatedBlock;
      blocks = newBlocks;
      
      new Notice(newFavorite ? '⭐ 已收藏' : '已取消收藏');
      logger.debug('[IRFocusInterface] 收藏状态已保存:', currentBlock.id, newFavorite);
    } catch (error) {
      logger.error('[IRFocusInterface] 切换收藏失败:', error);
      new Notice('操作失败');
    }
  }

  // v5.5: 移出内容块（侧边栏按钮触发）
  async function handleRemoveBlock() {
    await removeCurrentBlock();
  }
  
  // 移除当前内容块（从队列永久移除，保留历史记录）
  async function removeCurrentBlock() {
    if (!currentBlock) return;
    
    try {
      await services.init();
      
      const now = Date.now();
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        status: 'removed' as const,
        doneReason: 'removed',
        doneAt: now,
        updatedAt: now
      };
      await persistBlockUpdate(updatedBlock);
      
      new Notice('已移除该内容块');
      logger.debug('[IRFocusInterface] 块已移除:', currentBlock.id);
      
      // 从活跃队列中移除
      const removedBlockId = currentBlock.id;
      activeBlocks = activeBlocks.filter(b => b.id !== removedBlockId);
      
      // 调整索引（如果当前索引超出范围）
      if (currentBlockIndex >= activeBlocks.length) {
        currentBlockIndex = Math.max(0, activeBlocks.length - 1);
      }
      
      // 如果队列为空，显示完成模态窗
      if (activeBlocks.length === 0) {
        showCompletionModal = true;
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 移除块失败:', error);
      new Notice('操作失败');
    }
  }

  // 搁置当前内容块（暂停调度，可恢复）
  async function suspendCurrentBlock() {
    if (!currentBlock) return;
    
    try {
      await services.init();
      
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        status: 'suspended' as const,
        updatedAt: Date.now()
      };
      await persistBlockUpdate(updatedBlock);
      
      new Notice('已搁置该内容块');
      logger.debug('[IRFocusInterface] 块已搁置:', currentBlock.id);
      
      // 从活跃队列中移除
      const suspendedBlockId = currentBlock.id;
      activeBlocks = activeBlocks.filter(b => b.id !== suspendedBlockId);
      
      if (currentBlockIndex >= activeBlocks.length) {
        currentBlockIndex = Math.max(0, activeBlocks.length - 1);
      }
      
      if (activeBlocks.length === 0) {
        showCompletionModal = true;
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 搁置块失败:', error);
      new Notice('操作失败');
    }
  }

  // 归档当前内容块（用户已完全理解）
  async function archiveCurrentBlock() {
    if (!currentBlock) return;
    
    try {
      await services.init();
      
      const now = Date.now();
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        status: 'done' as const,
        doneReason: 'archived',
        doneAt: now,
        updatedAt: now
      };
      await persistBlockUpdate(updatedBlock);
      
      new Notice('已归档该内容块');
      logger.debug('[IRFocusInterface] 块已归档:', currentBlock.id);
      
      // 从活跃队列中移除
      const archivedBlockId = currentBlock.id;
      activeBlocks = activeBlocks.filter(b => b.id !== archivedBlockId);
      
      if (currentBlockIndex >= activeBlocks.length) {
        currentBlockIndex = Math.max(0, activeBlocks.length - 1);
      }
      
      if (activeBlocks.length === 0) {
        showCompletionModal = true;
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 归档块失败:', error);
      new Notice('操作失败');
    }
  }
  
  // 兼容旧调用
  async function ignoreBlock() {
    await removeCurrentBlock();
  }

  // 摘录为卡片（调用插件的创建卡片模态窗）
  async function extractToCard() {
    try {
      // 获取选中文本（优先从编辑器获取）
      let selectedText = '';
      
      if (isEditMode) {
        // 编辑模式：使用浏览器Selection API获取选中文本
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          selectedText = selection.toString();
        }
      } else {
        // 预览模式：使用浏览器Selection API获取选中文本
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          selectedText = selection.toString();
        }
      }
      
      // 如果没有选中文本，显示提示信息
      if (!selectedText || selectedText.trim() === '') {
        new Notice('请选中文本后点击，也可通过快捷键 Ctrl+E 触发');
        return;
      }
      
      // 准备卡片内容（问答格式）
      const cardContent = `${selectedText}\n\n---div---\n\n`;
      
      // 准备溯源信息（包含块链接）
      const cardMetadata: any = {};
      let blockLinkInfo: any = null;
      
      if (currentBlock?.sourcePath) {
        cardMetadata.sourceFile = currentBlock.sourcePath;
        if (plugin.extractCardService) {
          try {
            const deck = await plugin.extractCardService.ensureReadingDeckForIR(deckPath, deckName);
            cardMetadata.targetDeckId = deck.id;
            cardMetadata.deckId = deck.id;
          } catch (e) {
            logger.warn('[IRFocusInterface] 确保 IR 目标牌组失败:', e);
          }
        }
        
        // 🔗 创建块链接（使用 IR 专用方法，利用精确的定位信息）
        try {
          logger.debug('[IRFocusInterface] 尝试创建块链接（IR专用方法）', {
            filePath: currentBlock.sourcePath,
            startLine: currentBlock.startLine,
            endLine: currentBlock.endLine,
            selectedTextPreview: selectedText.substring(0, 50)
          });
          
          const { BlockLinkManager } = await import('../../utils/block-link-manager');
          const blockLinkManager = new BlockLinkManager(plugin.app);
          
          // 🆕 使用 IR 专用的块链接创建方法，直接传入精确的定位信息
          const blockLinkResult = await blockLinkManager.createBlockLinkForIRSelection(
            selectedText,
            currentBlock.sourcePath,
            currentBlock.startLine || 0,
            currentBlock.endLine || 0
          );
          
          // 🔍 调试：显示块链接创建结果
          if (blockLinkResult.success && blockLinkResult.blockLinkInfo) {
            blockLinkInfo = blockLinkResult.blockLinkInfo;
            new Notice(`块链接创建成功: ${blockLinkInfo.blockLink}`, 5000);
            logger.debug('[IRFocusInterface] 块链接创建成功:', blockLinkInfo.blockLink);
            
            // 添加块链接到溯源信息
            cardMetadata.sourceBlock = `^${blockLinkInfo.blockId}`;
            
            // 🛡️ 标记块链接为最近创建（防止竞态条件）
            if (plugin.blockLinkCleanupService) {
              plugin.blockLinkCleanupService.markRecentlyCreated(blockLinkInfo.blockId);
              logger.debug('[IRFocusInterface] 块链接已保护（60秒）');
            }
          } else {
            new Notice(`块链接创建失败: ${blockLinkResult.error}`, 5000);
            logger.warn('[IRFocusInterface] 块链接创建失败，使用文档级溯源:', blockLinkResult.error);
          }
        } catch (error) {
          new Notice(`块链接创建异常: ${error}`, 5000);
          logger.error('[IRFocusInterface] 块链接创建异常:', error);
        }
      } else {
        new Notice(`currentBlock.sourcePath 为空`, 5000);
      }
      
      // 🔍 调试：显示完整的 cardMetadata
      logger.debug('[IRFocusInterface] 准备打开创建卡片模态窗', {
        cardMetadata,
        hasSourceFile: !!cardMetadata.sourceFile,
        hasSourceBlock: !!cardMetadata.sourceBlock,
        contentLength: cardContent.length
      });
      
      // 调用插件的创建卡片模态窗
      await plugin.openCreateCardModal({
        initialContent: cardContent,
        cardMetadata,
        onSuccess: () => {
          new Notice('卡片创建成功');
        }
      });
      
    } catch (error) {
      logger.error('[IRFocusInterface] 摘录为卡片失败:', error);
      new Notice('摘录失败，请重试');
    }
  }

  // 打开源文档并定位到具体行号
  async function openSourceDocument() {
    if (!currentBlock?.sourcePath) {
      new Notice('当前内容块没有关联的源文档');
      return;
    }
    
    try {
      // PDF 书签任务：使用 openLinkText 跳转到书签对应的页码
      if (isPdfBookmarkTaskId(currentBlock.id)) {
        const pdfLink = (currentBlock as any).pdfBookmarkLink || currentBlock.sourcePath;
        const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
        await plugin.app.workspace.openLinkText(pdfLink, contextPath, true);
        new Notice(`已打开 PDF 书签: ${(currentBlock as any).pdfBookmarkTitle || pdfLink}`);
        return;
      }

      // EPUB 书签任务：打开 EPUB 阅读器并跳转到对应章节
      if (isEpubBookmarkTaskId(currentBlock.id)) {
        const epubPath = currentBlock.sourcePath;
        const tocHref = (currentBlock as any).epubBookmarkHref || '';
        const resumeCfi = (currentBlock as any).epubBookmarkResumeCfi || '';
        const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';

        if (resumeCfi || tocHref) {
          const navDetail: any = { filePath: epubPath, cfi: resumeCfi, href: tocHref };
          const existingLeaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EPUB)
            .find(l => {
              try {
                const s = (l.view as any)?.getState?.();
                return s?.filePath === epubPath || s?.file === epubPath;
              } catch { return false; }
            });
          if (existingLeaf) {
            plugin.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
            window.dispatchEvent(new CustomEvent('Weave:epub-navigate', { detail: navDetail }));
          } else {
            (window as any).__weaveEpubPendingNav = navDetail;
            await plugin.app.workspace.openLinkText(epubPath, contextPath, true);
          }
        } else {
          await plugin.app.workspace.openLinkText(epubPath, contextPath, true);
        }
        new Notice(`已打开 EPUB: ${(currentBlock as any).epubBookmarkTitle || epubPath}`);
        return;
      }

      const file = plugin.app.vault.getAbstractFileByPath(currentBlock.sourcePath);
      if (file && file instanceof TFile) {
        // 在新标签页中打开文件
        const leaf = plugin.app.workspace.getLeaf('tab');
        await leaf.openFile(file);
        
        // 定位到具体行号
        const targetLine = currentBlock.startLine || 0;
        if (targetLine > 0) {
          // 等待编辑器加载完成
          setTimeout(() => {
            const view = leaf.view;
            if (view instanceof MarkdownView && view.editor) {
              const editor = view.editor;
              // 定位到目标行（行号从0开始）
              const lineIndex = Math.max(0, targetLine - 1);
              editor.setCursor({ line: lineIndex, ch: 0 });
              // 滚动到可见区域并居中显示
              editor.scrollIntoView({ from: { line: lineIndex, ch: 0 }, to: { line: lineIndex, ch: 0 } }, true);
            }
          }, 100);
        }
        
        new Notice(`已打开: ${currentBlock.sourcePath}，定位到第 ${targetLine} 行`);
      } else {
        new Notice('源文档不存在或已被删除');
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 打开源文档失败:', error);
      new Notice('打开源文档失败');
    }
  }

  // 打开教程
  function openTutorial() {
    new Notice('增量阅读教程功能开发中');
    // TODO: 实现教程弹窗或跳转
  }

  // v2.4: 转换为独立文档（使用 Obsidian 原生 API）
  async function convertToDocument() {
    if (!currentBlock) {
      new Notice('当前没有内容块可转换');
      return;
    }
    
    try {
      // 获取当前块内容
      const content = blockContent || (currentBlock as any).contentPreview || '';
      if (!content.trim()) {
        new Notice('内容块为空，无法转换');
        return;
      }
      
      // 生成默认文件名（使用标题或内容前20字符）
      const defaultName = ((currentBlock as any).headingText || content.slice(0, 20).replace(/[\\/:*?"<>|#^\[\]]/g, '')).trim() || '未命名文档';
      
      // 使用 Obsidian 原生的文件建议模态窗（Menu API）
      const menu = new Menu();
      
      // 获取所有文件夹
      const folders: string[] = ['/'];
      plugin.app.vault.getAllLoadedFiles().forEach((file) => {
        if ('children' in file) {
          folders.push(file.path);
        }
      });
      folders.sort();
      
      // 创建文件夹选择子菜单
      menu.addItem((item) => {
        item
          .setTitle('📄 转换为新文档')
          .setIcon('file-plus')
          .setDisabled(true);
      });
      
      menu.addSeparator();
      
      // 添加常用文件夹选项
      const recentFolders = folders.slice(0, 10);
      recentFolders.forEach((folderPath) => {
        const displayName = folderPath === '/' ? '根目录' : folderPath;
        menu.addItem((item) => {
          item
            .setTitle(`📁 ${displayName}`)
            .setIcon('folder')
            .onClick(async () => {
              await promptFileNameAndCreate(folderPath, defaultName, content);
            });
        });
      });
      
      // 如果有更多文件夹，添加"浏览更多"选项
      if (folders.length > 10) {
        menu.addSeparator();
        menu.addItem((item) => {
          item
            .setTitle('📂 浏览所有文件夹...')
            .setIcon('folder-open')
            .onClick(async () => {
              await showFolderPicker(folders, defaultName, content);
            });
        });
      }
      
      // 显示菜单
      menu.showAtMouseEvent(new MouseEvent('click', {
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      }));
      
    } catch (error) {
      logger.error('[IRFocusInterface] 转换为文档失败:', error);
      new Notice('转换失败，请重试');
    }
  }
  
  // 提示输入文件名并创建文档
  async function promptFileNameAndCreate(folderPath: string, defaultName: string, content: string) {
    // 使用简单的 prompt 获取文件名
    const fileName = await showFileNamePrompt(defaultName);
    if (!fileName) return;
    
    // 构建完整路径
    const sanitizedName = fileName.replace(/[\\/:*?"<>|#^\[\]]/g, '').trim();
    const fullPath = folderPath === '/' 
      ? `${sanitizedName}.md` 
      : `${folderPath}/${sanitizedName}.md`;
    
    // 检查文件是否已存在
    const existingFile = plugin.app.vault.getAbstractFileByPath(fullPath);
    if (existingFile) {
      new Notice(`文件已存在: ${fullPath}`);
      return;
    }
    
    // 创建文件
    try {
      const newFile = await plugin.app.vault.create(fullPath, content);
      new Notice(`已创建文档: ${newFile.path}`);
      
      // 询问是否打开新文档
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle('打开新文档')
          .setIcon('file-text')
          .onClick(async () => {
            const leaf = plugin.app.workspace.getLeaf('tab');
            await leaf.openFile(newFile);
          });
      });
      menu.addItem((item) => {
        item
          .setTitle('继续阅读')
          .setIcon('book-open');
      });
      menu.showAtMouseEvent(new MouseEvent('click', {
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      }));
      
      logger.info('[IRFocusInterface] 已转换为文档:', fullPath);
    } catch (error) {
      logger.error('[IRFocusInterface] 创建文件失败:', error);
      new Notice('创建文件失败: ' + (error as Error).message);
    }
  }
  
  // 显示文件名输入提示
  function showFileNamePrompt(defaultName: string): Promise<string | null> {
    return new Promise((resolve) => {
      // 创建简单的输入模态窗
      const modal = document.createElement('div');
      modal.className = 'modal-container mod-dim';
      modal.innerHTML = `
        <div class="modal-bg" style="opacity: 0.85;"></div>
        <div class="modal" style="width: 400px;">
          <div class="modal-title">输入文件名</div>
          <div class="modal-content">
            <input type="text" class="ir-filename-input" value="${defaultName}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--background-modifier-border);" />
          </div>
          <div class="modal-button-container" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
            <button class="mod-cta ir-confirm-btn">确定</button>
            <button class="ir-cancel-btn">取消</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const input = modal.querySelector('.ir-filename-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.ir-confirm-btn') as HTMLButtonElement;
      const cancelBtn = modal.querySelector('.ir-cancel-btn') as HTMLButtonElement;
      const bg = modal.querySelector('.modal-bg') as HTMLElement;
      
      input.focus();
      input.select();
      
      const cleanup = () => {
        modal.remove();
      };
      
      confirmBtn.onclick = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value || null);
      };
      
      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };
      
      bg.onclick = () => {
        cleanup();
        resolve(null);
      };
      
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          confirmBtn.click();
        }
      };
    });
  }
  
  // 显示文件夹选择器
  async function showFolderPicker(folders: string[], defaultName: string, content: string) {
    return new Promise<void>((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-container mod-dim';
      modal.innerHTML = `
        <div class="modal-bg" style="opacity: 0.85;"></div>
        <div class="modal" style="width: 500px; max-height: 70vh;">
          <div class="modal-title">选择保存位置</div>
          <div class="modal-content" style="max-height: 50vh; overflow-y: auto;">
            <div class="ir-folder-list" style="display: flex; flex-direction: column; gap: 4px;">
              ${folders.map(f => `
                <button class="ir-folder-item" data-path="${f}" style="text-align: left; padding: 8px 12px; border-radius: 4px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); cursor: pointer;">
                  ${f === '/' ? '根目录' : f}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="modal-button-container" style="display: flex; justify-content: flex-end; margin-top: 16px;">
            <button class="ir-cancel-btn">取消</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const cancelBtn = modal.querySelector('.ir-cancel-btn') as HTMLButtonElement;
      const bg = modal.querySelector('.modal-bg') as HTMLElement;
      const folderItems = modal.querySelectorAll('.ir-folder-item');
      
      const cleanup = () => {
        modal.remove();
        resolve();
      };
      
      folderItems.forEach((item) => {
        (item as HTMLButtonElement).onclick = async () => {
          const folderPath = item.getAttribute('data-path') || '/';
          cleanup();
          await promptFileNameAndCreate(folderPath, defaultName, content);
        };
      });
      
      cancelBtn.onclick = cleanup;
      bg.onclick = cleanup;
    });
  }


  // 切换编辑/预览模式
  async function toggleEditMode() {
    // PDF 书签任务不支持编辑模式
    if (isPdfBlock) {
      new Notice('PDF 书签不支持编辑模式');
      return;
    }
    // 🔧 防御5：内容未加载完成时禁止切换模式
    if (!isContentLoaded) {
      logger.warn('[IRFocusInterface] 内容未加载完成，禁止切换模式');
      new Notice('内容加载中，请稍后再切换模式');
      return;
    }
    
    // 🔧 防御6：编辑模式下检查当前内容是否为空
    if (isEditMode && blockContent.trim().length === 0) {
      logger.error('[IRFocusInterface] 检测到编辑器内容为空，禁止切换以防止数据丢失');
      new Notice('当前内容为空，请先确认数据已正确加载');
      return;
    }
    
    if (isEditMode) {
      // 从编辑模式切换到预览模式：清理编辑器状态
      try {
        realtimeSaveDebounced?.cancel?.();
      } catch {
      }

      queuedSaveContent = null;

      if (editCleanupFn) {
        editCleanupFn();
        editCleanupFn = null;
      }
      editorInitialized = false;
    }
    
    isEditMode = !isEditMode;
    new Notice(isEditMode ? '已切换到编辑模式' : '已切换到预览模式');
    
    // 🔧 修复：等待DOM更新完成后再执行后续操作
    await tick();
    
    if (isEditMode && currentBlock) {
      // 切换到编辑模式：初始化编辑器
      await initializeEditor();
    } else if (!isEditMode && blockContent) {
      // ObsidianRenderer 组件会自动响应 blockContent 变化进行渲染
      logger.debug('[IRFocusInterface] 切换到预览模式，ObsidianRenderer 将自动渲染');
    }
  }

  // 初始化嵌入式编辑器（参考 CardEditorContainer）
  async function initializeEditor() {
    if (!currentBlock || !editorPoolManager) {
      logger.warn('[IRFocusInterface] 无法初始化编辑器：缺少块或编辑器管理器');
      return;
    }

    try {
      await tick();
      
      const container = editorContainer;
      if (!container) {
        logger.warn('[IRFocusInterface] 编辑器容器未找到');
        return;
      }

      if (editorInitialized) {
        // 复用编辑器，更新内容
        logger.debug('[IRFocusInterface] 复用编辑器实例，更新内容');
        await editorPoolManager.updateSessionContent(IR_SESSION_ID, blockContent, container);
      } else {
        // 首次创建编辑器
        logger.debug('[IRFocusInterface] 首次创建编辑器实例');
        container.innerHTML = '';

        // 创建虚拟卡片对象（用于编辑器会话）
        const virtualCard = {
          uuid: `ir-block-${currentBlock.id}`,
          content: blockContent,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          deckId: deckPath,
          fields: {}
        } as any;

        // 创建编辑会话
        const sessionResult = await editorPoolManager.createEditorSession(virtualCard, {
          isStudySession: true,
          sessionId: IR_SESSION_ID
        });

        if (!sessionResult.success) {
          logger.error('[IRFocusInterface] 创建编辑器会话失败:', sessionResult.error);
          return;
        }

        // 创建嵌入式编辑器（v2.2: 添加实时保存回调）
        const editorResult = await editorPoolManager.createEmbeddedEditor(
          container,
          IR_SESSION_ID,
          handleEditorSave,
          handleEditorCancel,
          handleRealtimeSave  // v2.2: 双向实时同步
        );

        if (!editorResult.success) {
          logger.error('[IRFocusInterface] 创建编辑器失败:', editorResult.error);
          return;
        }

        editCleanupFn = editorResult.cleanup || null;
        editorInitialized = true;
        logger.debug('[IRFocusInterface] ✅ 编辑器创建成功');
      }
    } catch (error) {
      logger.error('[IRFocusInterface] 初始化编辑器失败:', error);
    }
  }

  // 编辑器保存回调 (v2.2: 优先使用 Editor API 同步，降级为文件写入)
  async function handleEditorSave(content: string) {
    logger.debug('[IRFocusInterface] 编辑器保存回调');
    
    // PDF 书签任务不支持文件保存
    if (isPdfBlock) return;
    
    // 🔧 防御3：保存前再次检查内容加载状态
    if (!isContentLoaded) {
      logger.warn('[IRFocusInterface] 内容未加载完成，拒绝保存');
      new Notice('内容加载中，请稍后再试');
      return;
    }
    
    // 🔧 防御4：空白内容二次检查
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      logger.error('[IRFocusInterface] 拒绝保存空白内容以防止数据丢失');
      new Notice('检测到空白内容，已阻止保存以防止数据丢失');
      return;
    }
    
    blockContent = content;
    
    if (!currentBlock) return;
    
    const filePath = currentBlock.sourcePath;
    
    // v5.4: 块文件方案 - 一个内容块即一个文件，直接保存整个文件
    // @deprecated 旧 UUID 标记方案已移除
    try {
      if (saveInProgress) {
        queuedSaveContent = content;
        return;
      }

      saveInProgress = true;

      const statBefore = await plugin.app.vault.adapter.stat(filePath).catch(() => null as any);
      const beforeMtime = (statBefore as any)?.mtime;
      if (
        saveBaselineFilePath === filePath &&
        typeof saveBaselineMtime === 'number' &&
        typeof beforeMtime === 'number' &&
        beforeMtime > saveBaselineMtime + 10
      ) {
        if (autoSaveConflictFilePath !== filePath || autoSaveConflictMtime !== beforeMtime) {
          autoSaveConflictFilePath = filePath;
          autoSaveConflictMtime = beforeMtime;
          new Notice('检测到源文件已在外部修改，已暂停写入，请先处理冲突');
        }
        return;
      }

      const fileContent = await plugin.app.vault.adapter.read(filePath);
      if (fileContent == null) {
        logger.warn('[IRFocusInterface] 无法读取块文件:', filePath);
        return;
      }
      
      // 提取 YAML frontmatter
      const yamlMatch = fileContent.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
      const yamlPart = yamlMatch ? yamlMatch[1] : '';
      
      // 保存：YAML + 新内容
      const newFileContent = yamlPart + content;

      let localChangeStarted = false;
      try {
        editorSyncService?.beginLocalChange();
        localChangeStarted = true;

        await plugin.app.vault.adapter.write(filePath, newFileContent);
      } finally {
        if (localChangeStarted) {
          setTimeout(() => {
            editorSyncService?.endLocalChange();
          }, 150);
        }
      }

      const statAfter = await plugin.app.vault.adapter.stat(filePath).catch(() => null as any);
      const afterMtime = (statAfter as any)?.mtime;
      if (typeof afterMtime === 'number') {
        saveBaselineFilePath = filePath;
        saveBaselineMtime = afterMtime;
        autoSaveConflictFilePath = null;
        autoSaveConflictMtime = null;
      }

      editorSyncService?.cacheCurrentContent(content);
      
      // 更新块的时间戳
      await services.init();
      const updatedBlock: IRBlockV4 = {
        ...currentBlock,
        updatedAt: Date.now()
      };
      await persistBlockUpdate(updatedBlock);
      
      logger.debug('[IRFocusInterface] ✅ 块文件已保存:', filePath);
    } catch (error) {
      logger.error('[IRFocusInterface] 保存块文件失败:', error);
      new Notice('保存失败');
    } finally {
      saveInProgress = false;

      if (queuedSaveContent != null && queuedSaveContent !== content) {
        const next = queuedSaveContent;
        queuedSaveContent = null;
        void handleEditorSave(next);
      } else {
        queuedSaveContent = null;
      }
    }
  }

  // 编辑器取消回调
  function handleEditorCancel() {
    logger.debug('[IRFocusInterface] 编辑器取消回调');
  }

  // 切换设置菜单
  function toggleSettingsMenu() {
    showSettingsMenu = !showSettingsMenu;
  }

  // 处理显示预测时间开关变更
  function handleShowRatingTimeChange(enabled: boolean) {
    showRatingTime = enabled;
    saveFocusSettings({ showRatingTime: enabled });
    logger.debug('[IRFocusInterface] 显示预测时间:', enabled);
  }

  // 处理始终显示自评栏开关变更
  function handleAlwaysShowRatingChange(enabled: boolean) {
    alwaysShowRating = enabled;
    if (enabled) {
      showRatingBar = true;
    } else {
      showRatingBar = false;
    }
    saveFocusSettings({ alwaysShowRating: enabled });
    logger.debug('[IRFocusInterface] 始终显示自评栏:', enabled);
  }

  // v2.1: 处理显示优先级贴纸开关变更
  function handleShowPriorityStickerChange(enabled: boolean) {
    showPrioritySticker = enabled;
    saveFocusSettings({ showPrioritySticker: enabled });
    logger.debug('[IRFocusInterface] 显示优先级贴纸:', enabled);
  }

  // 切换底部悬浮自评功能栏
  function toggleRatingBar() {
    showRatingBar = !showRatingBar;
  }

  // v5.5: 调度意图配置（从"认知程度评价"改为"价值导向调度"）
  // 攻坚=更快再见, 正常=按算法走, 放缓=更慢再见, 稍后=短期推迟
  const schedulingConfig = [
    { action: 'intensive' as const, label: '攻坚', color: 'var(--weave-error, #ef4444)', intervalMultiplier: 0.5, desc: '下次：明天' },
    { action: 'normal' as const, label: '正常', color: 'var(--weave-success, #10b981)', intervalMultiplier: 1.0, desc: '下次：3天后' },
    { action: 'slow' as const, label: '放缓', color: 'var(--weave-warning, #f59e0b)', intervalMultiplier: 1.8, desc: '下次：10天后' },
    { action: 'postpone' as const, label: '稍后', color: 'var(--text-muted, #6b7280)', intervalMultiplier: 0, desc: '推迟：+2天', isPostpone: true },
  ];

  const schedulingDefaultIntervals: Record<'intensive' | 'normal' | 'slow', number> = {
    intensive: 1,
    normal: 3,
    slow: 10
  };
  
  // 旧版理解度评分配置（保留用于兼容）
  const ratingConfig = [
    { rating: 1 as IRRating, label: '忽略', color: 'var(--text-muted, #6b7280)', intervalModifier: 0, isIgnore: true },
    { rating: 2 as IRRating, label: '一般', color: 'var(--weave-warning, #f59e0b)', intervalModifier: 1.0 },
    { rating: 3 as IRRating, label: '清晰', color: 'var(--weave-success, #10b981)', intervalModifier: 1.5 },
    { rating: 4 as IRRating, label: '精通', color: 'var(--weave-info, #3b82f6)', intervalModifier: 2.5 },
  ];

  // 格式化预测的下次复习时间
  function formatPredictedInterval(rating: IRRating): string {
    if (!currentBlock) return '未知';
    
    // 基于当前块的间隔和评分修饰符计算预测间隔
    const currentInterval = currentBlock.intervalDays || 1;
    const modifier = ratingConfig.find(r => r.rating === rating)?.intervalModifier || 1.0;
    const baseIntervalFactor = 1.5; // 默认间隔因子
    
    let predictedDays: number;
    if (rating === 1) {
      // 忽略：不再安排复习
      return '不再复习';
    } else {
      // 其他评分：基于间隔因子和修饰符计算
      predictedDays = Math.round(currentInterval * baseIntervalFactor * modifier);
    }
    
    // 限制最大间隔
    predictedDays = Math.min(predictedDays, 365);
    
    // 格式化显示
    if (predictedDays < 1) {
      return '< 1天';
    } else if (predictedDays === 1) {
      return '1天';
    } else if (predictedDays < 30) {
      return `${predictedDays}天`;
    } else if (predictedDays < 365) {
      const months = Math.round(predictedDays / 30);
      return `${months}月`;
    } else {
      return '1年';
    }
  }

  // v5.5: 计算调度意图的预测下次时间（简洁显示，不带前缀）
  function getSchedulingPrediction(action: string): string {
    if (!currentBlock) return '';
    
    const currentInterval = currentBlock.intervalDays || 1;
    const cfg = schedulingConfig.find(c => c.action === action);
    if (!cfg) return '';
    
    if (cfg.isPostpone) {
      // 稍后：短期推迟
      return '+2天';
    }

    if (currentInterval <= 1) {
      const d = schedulingDefaultIntervals[action as 'intensive' | 'normal' | 'slow'] ?? 1;
      if (d === 1) return '明天';
      return `${d}天后`;
    }
    
    // 计算预测间隔
    const baseMultiplier = 1.5;  // M_base
    let predictedDays = Math.round(currentInterval * baseMultiplier * cfg.intervalMultiplier);
    predictedDays = Math.max(1, Math.min(predictedDays, 365));  // 限制在 1-365 天
    
    if (predictedDays === 1) return '明天';
    if (predictedDays <= 7) return `${predictedDays}天后`;
    if (predictedDays <= 30) return `${Math.round(predictedDays / 7)}周后`;
    return `${Math.round(predictedDays / 30)}月后`;
  }
  
  // v5.5: 处理调度意图选择（攻坚/正常/放缓/稍后）
  async function handleSchedulingAction(action: 'intensive' | 'normal' | 'slow' | 'postpone') {
    if (!currentBlock) return;
    
    try {
      await services.init();
      
      const cfg = schedulingConfig.find(c => c.action === action);
      if (!cfg) return;
      
      let updatedBlock: IRBlockV4;
      
      if (cfg.isPostpone) {
        // 稍后：只推迟 nextRepDate，不改变间隔
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 2);  // 推迟2天
        updatedBlock = {
          ...currentBlock,
          nextRepDate: nextDate.getTime(),
          updatedAt: Date.now()
        };
        new Notice(`已推迟2天，${nextDate.toLocaleDateString()}再见`);
      } else {
        // 攻坚/正常/放缓：按倍数调整间隔
        const currentInterval = currentBlock.intervalDays || 1;
        const baseMultiplier = 1.5;

        let newInterval: number;
        if (currentInterval <= 1) {
          newInterval = schedulingDefaultIntervals[action as 'intensive' | 'normal' | 'slow'];
        } else {
          newInterval = Math.round(currentInterval * baseMultiplier * cfg.intervalMultiplier);
        }
        newInterval = Math.max(1, Math.min(newInterval, 365));
        
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);
        
        updatedBlock = {
          ...currentBlock,
          intervalDays: newInterval,
          nextRepDate: nextDate.getTime(),
          status: 'queued' as const,
          updatedAt: Date.now()
        };
        
        const actionLabel = { intensive: '攻坚', normal: '正常', slow: '放缓', postpone: '稍后' }[action] || action;
        new Notice(`${actionLabel}模式：${newInterval}天后再见`);
      }
      
      await persistBlockUpdate(updatedBlock);
      
      // 更新本地状态 - 创建新数组触发响应式更新
      const blockIndex = activeBlocks.findIndex(b => b.id === currentBlock.id);
      if (blockIndex >= 0) {
        const newActiveBlocks = [...activeBlocks];
        newActiveBlocks[blockIndex] = updatedBlock;
        activeBlocks = newActiveBlocks;
      }
      
      // 重置计时器并切换到下一块
      currentBlockTime = 0;
      blockStartTime = Date.now();
      
      if (currentBlockIndex < totalBlocks - 1) {
        currentBlockIndex++;
      } else {
        showCompletionModal = true;
      }
      
      // 关闭自评栏
      showRatingBar = false;
      
      logger.debug('[IRFocusInterface] 调度意图处理完成:', { action, blockId: currentBlock.id });
    } catch (error) {
      logger.error('[IRFocusInterface] 调度意图处理失败:', error);
      new Notice('操作失败，请重试');
    }
  }
  
  // 处理底部悬浮自评功能栏的评分 (v4.0: 使用 V4 调度服务)
  async function handleQuickRating(rating: IRRating) {
    if (!currentBlock) return;
    
    try {
      await services.init();

      if (rating === 1) {
        await ignoreBlock();
        showRatingBar = false;
        logger.debug('[IRFocusInterface] 快速自评忽略完成:', { blockId: currentBlock.id });
        return;
      }
      const readingTimeSeconds = Math.floor(currentBlockTime / 1000);
      
      // v4.0: 构建完成数据
      const completionData: ReadingCompletionDataV4 = {
        rating,
        readingTimeSeconds,
        priorityUi: currentBlock.priorityUi ?? 5,
        createdCardCount: extractedCardsCount,
        createdExtractCount: annotationSignal?.effectiveCalloutCount ?? 0,
        createdNoteCount: 0,
        annotationSignal: annotationSignal?.signal ?? 0
      };
      
      // v6.0: 直接使用 V4 调度服务
      const completeResult = await services.v4SchedulerService!.completeBlockV4(
        currentBlock,
        completionData,
        deckPath
      );
      const updatedBlock = completeResult.block;
      if (!isPdfBookmarkTaskId(updatedBlock.id) && !isEpubBookmarkTaskId(updatedBlock.id)) {
        await syncChunkScheduleFromBlock(updatedBlock);
      }
      const blockIndex = activeBlocks.findIndex(b => b.id === updatedBlock.id);
      if (blockIndex >= 0) {
        // 创建新数组触发响应式更新
        const newActiveBlocks = [...activeBlocks];
        newActiveBlocks[blockIndex] = updatedBlock;
        activeBlocks = newActiveBlocks;
      }
      
      // 显示反馈（rating === 1 已在上方 early return 处理）
      const ratingLabels = ['', '忽略', '一般', '清晰', '精通'];
      new Notice(`已标记为"${ratingLabels[rating]}", 下次复习时间已更新`);
      
      // 通知父组件
      onBlockComplete?.(currentBlock.id);
      
      // 重置当前块计时器并切换到下一块
      currentBlockTime = 0;
      blockStartTime = Date.now();
      
      if (currentBlockIndex < totalBlocks - 1) {
        currentBlockIndex++;
      }
      
      // 关闭自评栏
      showRatingBar = false;
      
      logger.debug('[IRFocusInterface] 快速自评完成:', { blockId: currentBlock.id, rating });
    } catch (error) {
      logger.error('[IRFocusInterface] 快速自评失败:', error);
      new Notice('评分失败，请重试');
    }
  }

  // v2.1: 移除章节导航切换函数，完全由算法控制
  // export function toggleChapterNav() {
  //   showChapterNav = !showChapterNav;
  //   saveFocusSettings({ showChapterNav });
  // }

  // 切换统计信息栏（并持久化）
  export function toggleStats() {
    if (outputStatsCollapsed) {
      outputStatsCollapsed = false;
      navCollapsed = true;
    } else {
      outputStatsCollapsed = true;
    }
    saveFocusSettings({ outputStatsCollapsed, navCollapsed });
  }

  // v3.1: 切换内容块导航栏（并持久化）
  export function toggleNav() {
    if (navCollapsed) {
      navCollapsed = false;
      outputStatsCollapsed = true;
    } else {
      navCollapsed = true;
    }
    saveFocusSettings({ navCollapsed, outputStatsCollapsed });
  }

  // 切换工具栏（并持久化）
  export function toggleToolbar() {
    showSidebar = !showSidebar;
    saveFocusSettings({ showToolbar: showSidebar });
  }

  export function openMobileToolbarMenu() {
    if (!Platform.isMobile) return;

    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle('编辑/预览')
        .setIcon(isEditMode ? 'eye' : 'edit')
        .setDisabled(isPdfBlock)
        .onClick(() => {
          void toggleEditMode();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('摘录为卡片')
        .setIcon('file-plus')
        .setDisabled(isPdfBlock)
        .onClick(() => {
          void extractToCard();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('设置下次复习')
        .setIcon('bell')
        .onClick(() => {
          setNextReview();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('优先级')
        .setIcon('star')
        .onClick(() => {
          changePriority();
        });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle('图谱联动')
        .setIcon('link')
        .setChecked(isGraphLinked)
        .onClick(() => {
          void toggleGraphLink();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('查看内容块信息')
        .setIcon('eye')
        .setDisabled(!currentBlock)
        .onClick(() => {
          showBlockInfoModal = true;
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('打开源文档')
        .setIcon('file-text')
        .setDisabled(!currentBlock?.sourcePath)
        .onClick(() => {
          void openSourceDocument();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('移出队列')
        .setIcon('x-circle')
        .setDisabled(!currentBlock)
        .onClick(() => {
          void handleRemoveBlock();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('AI助手')
        .setIcon('brain')
        .setDisabled(!aiAssistantMenuBuilder)
        .onClick(() => {
          if (aiAssistantMenuBuilder) {
            aiAssistantMenuBuilder.showMainMenu(new MouseEvent('click', {
              clientX: window.innerWidth / 2,
              clientY: window.innerHeight / 2
            }));
          }
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('教程')
        .setIcon('book-open')
        .onClick(() => {
          openTutorial();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('更多设置')
        .setIcon('settings')
        .onClick(() => {});
      const submenu = (item as any).setSubmenu();

      submenu.addItem((subItem: any) => {
        subItem.setTitle('自评功能').setDisabled(true);
      });

      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('理解度自评')
          .setIcon('activity')
          .setChecked(showRatingBar || alwaysShowRating)
          .onClick(() => {
            if (alwaysShowRating) {
              showRatingBar = true;
              return;
            }
            toggleRatingBar();
          });
      });

      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('显示预测时间')
          .setIcon('clock')
          .setChecked(showRatingTime)
          .onClick(() => {
            handleShowRatingTimeChange(!showRatingTime);
          });
      });

      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('始终显示自评栏')
          .setIcon('pin')
          .setChecked(alwaysShowRating)
          .onClick(() => {
            handleAlwaysShowRatingChange(!alwaysShowRating);
          });
      });

      submenu.addItem((subItem: any) => {
        subItem
          .setTitle('显示优先级贴纸')
          .setIcon('bookmark')
          .setChecked(showPrioritySticker)
          .onClick(() => {
            handleShowPriorityStickerChange(!showPrioritySticker);
          });
      });
    });

    menu.showAtMouseEvent(new MouseEvent('click', {
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2
    }));
  }

  // v5.0: 块文件方案 - 直接读取整个 chunk 文件
  // @deprecated 旧 UUID 标记方案已移除
  async function loadBlockContent(block: IRBlockV4): Promise<string> {
    try {
      if (isPdfBookmarkTaskId(block.id)) {
        const title = (block as any).pdfBookmarkTitle || (block as any).contentPreview || 'PDF 书签';
        const link = (block as any).pdfBookmarkLink || '';
        const cleanLink = link.replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
        const wikiLink = cleanLink ? `[[${cleanLink}|${title}]]` : '';
        return `## ${title}\n\n${wikiLink}`;
      }
      if (isEpubBookmarkTaskId(block.id)) {
        const title = (block as any).epubBookmarkTitle || (block as any).contentPreview || 'EPUB';
        const epubPath = block.sourcePath || '';
        const level = (block as any).epubBookmarkLevel ?? 0;
        const heading = '#'.repeat(Math.min(level + 2, 4));
        const wikiLink = epubPath ? `[[${epubPath}|${title}]]` : '';
        return `${heading} ${title}\n\n${wikiLink}\n\n> EPUB chapter - click "Open Source" to read`;
      }
      // v5.0: 块文件方案 - 直接读取整个文件（去除 YAML frontmatter）
      const content = await plugin.app.vault.adapter.read(block.sourcePath);
      if (!content) return '无法加载内容';
      
      // 移除 YAML frontmatter
      const yamlEndMatch = content.match(/^---\n[\s\S]*?\n---\n/);
      if (yamlEndMatch) {
        return content.substring(yamlEndMatch[0].length).trim();
      }
      return content.trim();
    } catch (error) {
      logger.error('[IRFocusInterface] 加载块内容失败:', error);
      return '加载失败';
    }
  }

  // 渲染 Markdown 内容（使用 ObsidianRenderer 组件，支持链接跳转/脚注/hover预览等）
  
  // 当块改变时加载内容
  $effect(() => {
    if (currentBlock) {
      // 🔧 重置加载标志位
      isContentLoaded = false;
      const filePath = currentBlock.sourcePath;
      const blockRef = currentBlock;
      loadBlockContent(currentBlock).then(async content => {
        blockContent = content;
        // 🔧 标记内容已加载
        isContentLoaded = true;
        // v5.4: 缓存内容用于双向同步变化检测
        editorSyncService?.cacheCurrentContent(content);

        if (typeof filePath === 'string' && filePath.length > 0 && !isPdfBookmarkTaskId(blockRef.id) && !isEpubBookmarkTaskId(blockRef.id)) {
          await refreshSaveBaseline(filePath);
        }
        // v5.7: 标注信号由独立的 $effect 监听 blockContent 变化自动计算
        logger.debug('[IRFocusInterface] 内容加载完成:', content.substring(0, 50));
      });

      // PDF/EPUB 书签任务：强制预览模式
      if (isPdfBookmarkTaskId(currentBlock.id) || isEpubBookmarkTaskId(currentBlock.id)) {
        if (isEditMode) {
          isEditMode = false;
        }
      }
      
      // v5.5: 更新历史产出统计
      historicalReadingTime = (currentBlock as any).meta?.totalReadingTime ?? 0;
      
      // v3.1: 基于卡片sourceFile匹配当前文档来统计制卡数（替代不可靠的meta.cardCount）
      refreshCardCount();
    }
  });
  
  // v5.7: 监听 blockContent 变化，实时更新标注信号
  $effect(() => {
    if (blockContent && blockContent.trim().length > 0) {
      annotationSignal = getAnnotationSignalService().calculateSignal(blockContent);
    }
  });
  
  // 预览渲染由 ObsidianRenderer 组件自动响应 blockContent 变化，无需手动调用

  // 判断事件目标是否在可编辑区域
  function isEditableTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return Boolean(
      element.closest(
        'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor, .cm-content'
      )
    );
  }

  // 键盘快捷键
  // 注意：移除了 ArrowLeft/ArrowRight 方向键切换卡片的功能，避免与编辑器光标移动冲突
  function handleKeydown(event: KeyboardEvent) {
    // 当焦点在可编辑控件内时，放行按键，避免干扰输入
    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;

    if (event.key === 'j') {
      nextBlock();
    } else if (event.key === 'k') {
      prevBlock();
    }
  }

  onMount(async () => {
    updateTime();
    timeInterval = window.setInterval(updateTime, 60000);
    
    // 加载可用牌组列表
    await loadAvailableDecks();
    
    // 初始化AI助手菜单构建器
    if (!aiAssistantMenuBuilder && currentBlock) {
      // 创建一个虚拟卡片，代表当前块内容
      const virtualCard: Card = {
        uuid: `ir-block-${currentBlock.id}`,
        deckId: deckPath,
        templateId: 'basic',
        type: CardType.Basic,
        content: '', // 将在使用时动态填充选中文本
        tags: [],
        priority: 0,
        fsrs: {
          due: new Date().toISOString(),
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          retrievability: 0
        },
        reviewHistory: [],
        stats: {
          totalReviews: 0,
          totalTime: 0,
          averageTime: 0,
          memoryRate: 0
        },
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      };
      
      aiAssistantMenuBuilder = new AIAssistantMenuBuilder(
        plugin,
        virtualCard,
        handleAIFormatCustom,
        handleAISplit,
        handleManageAIFeatures
      );
    }
    
    // 启动阅读计时器（每秒更新）
    timerInterval = window.setInterval(updateTimer, 1000);

    activityListener = () => {
      if (pauseMode === 'idle') return;
      lastInteractionAt = Date.now();
    };

    window.addEventListener('mousemove', activityListener, true);
    window.addEventListener('mousedown', activityListener, true);
    window.addEventListener('touchstart', activityListener, true);
    window.addEventListener('pointerdown', activityListener, true);
    window.addEventListener('scroll', activityListener, true);
    window.addEventListener('keydown', activityListener, true);

    idleCheckIntervalId = window.setInterval(() => {
      if (pauseMode !== null) return;
      if (Date.now() - lastInteractionAt > IDLE_TIMEOUT_MS) {
        enterIdlePause();
      }
    }, 1000);
    
    // 检测移动端
    isMobile = Platform.isMobile;
    
    // 初始化嵌入式编辑器管理器（参考 StudyInterface）
    editorPoolManager = plugin.editorPoolManager;
    
    // v2.2: 初始化双向实时同步服务
    editorSyncService = new IREditorSyncService(plugin.app);
    editorSyncService.initialize({
      onSourceChanged: (newContent: string) => {
        // 原文档变化时，更新嵌入式编辑器
        logger.debug('[IRFocusInterface] 原文档变化，同步到增量阅读界面');
        
        // v2.2: 标记为本地变化，防止轮询检测触发反向同步
        editorSyncService?.beginLocalChange();
        
        blockContent = newContent;

        editorSyncService?.cacheCurrentContent(newContent);

        if (currentBlock?.sourcePath) {
          void refreshSaveBaseline(currentBlock.sourcePath);
        }

        // 如果编辑器已初始化，更新其内容
        if (editorPoolManager && editorInitialized) {
          editorPoolManager.updateSessionContent(IR_SESSION_ID, newContent, editorContainer!);
        }
        
        // v2.2: 延迟结束本地变化标记，等待轮询周期过去
        setTimeout(() => {
          editorSyncService?.endLocalChange();
        }, 150);  // 略大于轮询间隔100ms
      },
      getCurrentBlock: () => currentBlock as any,
      getBlockContent: () => blockContent
    });
    
    // 🆕 设置当前增量阅读的活动文档（用于卡片管理界面的文档关联筛选）
    if (currentBlock?.sourcePath) {
      irActiveDocumentStore.setActiveDocument(currentBlock.sourcePath);
      editorSyncService.setCurrentFile(currentBlock.sourcePath);

      irActiveBlockContextStore.setActiveContext({
        sourcePath: currentBlock.sourcePath,
        startLine: currentBlock.startLine || 0,
        endLine: currentBlock.endLine || 0
      });
    }
    
    // v5.8: 初始化会话制卡统计服务（持久化，支持异常关闭恢复）
    sessionCardStatsService = createSessionCardStatsService(plugin.app);
    sessionCardStatsService.initialize();
    
    // v5.8: 监听卡片创建/删除事件
    (plugin.app.workspace as any).on('Weave:card-created', handleCardCreated);
    (plugin.app.workspace as any).on('Weave:card-deleted', handleCardDeleted);
    
    // v5.8: 恢复当前块的制卡计数（如果有）
    if (currentBlock) {
      currentBlockCardCount = sessionCardStatsService.getBlockCardCount(currentBlock.id);
    }
    
    // 🔧 修复：移除onMount中的initializeEditor调用
    // 编辑器初始化完全由$effect控制，确保blockContent加载完成后才创建编辑器
    // 这解决了初次打开时编辑器显示原始文本的问题
    
    logger.debug('[IRFocusInterface] 组件已挂载');
  });

  onDestroy(() => {
    if (timeInterval) {
      clearInterval(timeInterval);
    }
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    if (idleCheckIntervalId) {
      clearInterval(idleCheckIntervalId);
    }
    if (activityListener) {
      window.removeEventListener('mousemove', activityListener, true);
      window.removeEventListener('mousedown', activityListener, true);
      window.removeEventListener('touchstart', activityListener, true);
      window.removeEventListener('pointerdown', activityListener, true);
      window.removeEventListener('scroll', activityListener, true);
      window.removeEventListener('keydown', activityListener, true);
      activityListener = null;
    }
    
    // 清理编辑器资源
    if (editCleanupFn) {
      editCleanupFn();
      editCleanupFn = null;
    }
    
    // v2.2: 销毁双向实时同步服务
    if (editorSyncService) {
      editorSyncService.destroy();
      editorSyncService = null;
    }

    try {
      realtimeSaveDebounced?.cancel?.();
    } catch {
    }
    
    // 清理图谱联动leaf
    if (graphSyncLeaf) {
      try {
        graphSyncLeaf.detach();
      } catch (e) {
        // 忽略清理错误
      }
      graphSyncLeaf = null;
    }
    
    // 🆕 清除增量阅读的活动文档
    irActiveDocumentStore.clearActiveDocument();

    irActiveBlockContextStore.clearActiveContext();
    
    // v5.8: 移除卡片创建/删除事件监听
    (plugin.app.workspace as any).off('Weave:card-created', handleCardCreated);
    (plugin.app.workspace as any).off('Weave:card-deleted', handleCardDeleted);
    
    // v5.8: 销毁会话制卡统计服务
    // 正常结束：清除统计；异常结束：保留供下次恢复
    destroySessionCardStatsService(isNormalSessionEnd);
    sessionCardStatsService = null;
    
    logger.debug('[IRFocusInterface] 组件已销毁');
  });
  
  // 当块切换时重置块计时器，并更新活动文档
  $effect(() => {
    if (currentBlockIndex !== undefined) {
      try {
        realtimeSaveDebounced?.cancel?.();
      } catch {
      }

      queuedSaveContent = null;

      blockStartTime = Date.now();
      currentBlockTime = 0;
      
      // v5.8: 切换块时更新当前块的制卡计数（从持久化服务获取）
      if (currentBlock && sessionCardStatsService) {
        currentBlockCardCount = sessionCardStatsService.getBlockCardCount(currentBlock.id);
      } else {
        currentBlockCardCount = 0;
      }
      
      // 🆕 更新当前增量阅读的活动文档
      if (currentBlock?.sourcePath) {
        irActiveDocumentStore.setActiveDocument(currentBlock.sourcePath);
        
        // v2.2: 更新同步服务监听的文件
        editorSyncService?.setCurrentFile(currentBlock.sourcePath);

        void refreshSaveBaseline(currentBlock.sourcePath);

        irActiveBlockContextStore.setActiveContext({
          sourcePath: currentBlock.sourcePath,
          startLine: currentBlock.startLine || 0,
          endLine: currentBlock.endLine || 0
        });
      }
    }
  });

  // 🔧 核心修复：当编辑模式且内容加载完成时，初始化或更新编辑器
  // 使用单独的标志位避免重复初始化
  let editorInitPending = false;
  
  $effect(() => {
    // 显式引用所有响应式依赖
    const container = editorContainer;
    const content = blockContent;
    const manager = editorPoolManager;
    const block = currentBlock;
    const editMode = isEditMode;
    const initialized = editorInitialized;
    const contentLoaded = isContentLoaded;  // 🔧 添加加载状态依赖
    
    // 调试日志
    logger.debug('[IRFocusInterface] $effect 检查:', {
      hasContainer: !!container,
      hasContent: !!content,
      contentLength: content?.length || 0,
      hasManager: !!manager,
      hasBlock: !!block,
      editMode,
      initialized,
      editorInitPending,
      contentLoaded  // 🔧 记录加载状态
    });
    
    // 🔧 防御8：编辑器初始化必须等待内容加载完成
    if (editMode && block && manager && content && content.length > 0 && container && contentLoaded) {
      if (initialized) {
        // 编辑器已存在，更新内容
        logger.debug('[IRFocusInterface] 更新编辑器内容');
        manager.updateSessionContent(IR_SESSION_ID, content, container);
      } else if (!editorInitPending) {
        // 编辑器未初始化，且没有正在进行的初始化
        logger.debug('[IRFocusInterface] 触发编辑器初始化');
        editorInitPending = true;
        
        // 使用 requestAnimationFrame 确保 DOM 完全就绪
        requestAnimationFrame(() => {
          tick().then(() => {
            initializeEditor().finally(() => {
              editorInitPending = false;
            });
          });
        });
      }
    }
  });

  // 获取优先级文本
  function getPriorityText(priority: number): string {
    if (priority <= 3) return '高';
    if (priority <= 6) return '中';
    return '低';
  }
</script>

<!-- 🔑 全局键盘监听 -->
<svelte:window onkeydown={handleKeydown} />

<!-- v2.1: 增量阅读完成结算模态窗 -->
{#if showCompletionModal}
<IRCompletionModal
  deckName={deckName}
  stats={{
    blocksCompleted: completedBlocksCount,
    totalReadingTime: Math.floor(totalReadingTime / 1000),
    extractedCards: extractedCardsCount,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : undefined
  }}
  onClose={handleCompletionClose}
  onGoToMemoryDeck={handleGoToMemoryDeck}
/>
{/if}

<!-- v2.0 Phase 4: 理解度自评弹窗 -->
<IRRatingModal
  open={showRatingModal}
  blockTitle={(currentBlock as any)?.headingText || ''}
  readingTime={Math.floor(currentBlockTime / 1000)}
  onRate={handleRating}
  onClose={() => showRatingModal = false}
/>

<!-- v6.0: 学习会话确认弹窗 -->
<IRSessionConfirmModal
  open={showSessionConfirmModal}
  onClose={handleSessionConfirmClose}
  onConfirm={handleSessionConfirm}
  {plugin}
  {deckName}
  autoRecordedDurationSeconds={Math.floor(totalReadingTime / 1000)}
  blocksCompleted={completedBlocksCount}
  cardsCreated={extractedCardsCount}
/>


<div
  class="ir-focus-overlay"
  style={Platform.isMobile && isMobile
    ? `${mobileViewportHeight ? `--weave-viewport-height: ${mobileViewportHeight}px;` : ''} --weave-top-offset: ${Math.max(MOBILE_TOP_OFFSET_FALLBACK, Number.isFinite(mobileTopOffset) ? mobileTopOffset : MOBILE_TOP_OFFSET_FALLBACK)}px; --weave-bottom-offset: ${Number.isFinite(mobileBottomOffset) ? mobileBottomOffset : 56}px;`
    : ''}
>
  {#if showIdlePauseOverlay}
    <div class="ir-idle-pause-backdrop" role="dialog" aria-modal="true">
      <div class="ir-idle-pause-panel">
        <div class="ir-idle-pause-title">思考中...</div>
        <div class="ir-idle-pause-desc">已暂停计时，刚才是在思考还是离开？</div>
        <div class="ir-idle-pause-actions">
          <button type="button" class="ir-idle-pause-btn primary" onclick={() => resumeFromIdlePause(true)}>在思考（计入）</button>
          <button type="button" class="ir-idle-pause-btn" onclick={() => resumeFromIdlePause(false)}>离开（不计入）</button>
        </div>
      </div>
    </div>
  {/if}
  <div class="ir-focus-content">
    <!-- 头部工具栏（参考 StudyHeader） -->
    <!-- 顶部功能栏（参考 StudyHeader 设计） -->
    {#if !isMobile}
    <div class="study-header">
      <div class="header-left">
        <div class="deck-info">
          <h2 class="study-title">{deckName || '增量阅读'}</h2>
        </div>
        <div class="study-progress">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span 
            class="progress-text has-tooltip" 
            onmouseenter={handleStatsMouseEnter}
            onmousemove={handleStatsMouseMove}
            onmouseleave={handleStatsMouseLeave}
          >{currentBlockIndex + 1} / {totalBlocks}</span>
          {#if focusStats}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span 
              class="progress-hint has-tooltip"
              onmouseenter={handleStatsMouseEnter}
              onmousemove={handleStatsMouseMove}
              onmouseleave={handleStatsMouseLeave}
            >{focusStatsSummary()}</span>
          {/if}
        </div>
      </div>

      <!-- 中间：多彩彩色圆点（复用主界面设计） -->
      <div class="header-center">
        <div class="header-dots-container">
          <span class="header-dot" style="background: linear-gradient(135deg, #ef4444, #dc2626)" title="增量阅读"></span>
          <span class="header-dot" style="background: linear-gradient(135deg, #3b82f6, #2563eb)" title="记忆牌组"></span>
          <span class="header-dot" style="background: linear-gradient(135deg, #10b981, #059669)" title="考试牌组"></span>
        </div>
      </div>

      <div class="header-right">
        <!-- v4.0: 暂停计时按钮（计时器显示由侧边栏负责） -->
        <EnhancedButton
          variant="ghost"
          onclick={toggleTimerPause}
          ariaLabel={isTimerPaused ? "继续计时" : "暂停计时"}
          class={`weave-topbar-btn timer-pause-btn ${isTimerPaused ? 'paused' : ''}`}
        >
          <EnhancedIcon name={isTimerPaused ? "play" : "pause"} size={18} />
        </EnhancedButton>

        <!-- v5.5: 内容块导航栏切换按钮（与产出栏互斥） -->
        <EnhancedButton
          variant="ghost"
          onclick={() => { 
            if (navCollapsed) {
              // 显示导航栏，隐藏产出栏
              navCollapsed = false;
              outputStatsCollapsed = true;
            } else {
              // 隐藏导航栏
              navCollapsed = true;
            }
            saveFocusSettings({ navCollapsed, outputStatsCollapsed });
          }}
          ariaLabel={navCollapsed ? "显示内容块导航" : "隐藏内容块导航"}
          class={`weave-topbar-btn info-bar-toggle-btn nav-toggle-btn ${!navCollapsed ? 'active' : ''}`}
        >
          <EnhancedIcon name="layers" size={18} />
        </EnhancedButton>

        <!-- v5.5: 产出信息栏切换按钮（标注数、制卡数、累计时间、下次阅读）- 与导航栏互斥 -->
        <EnhancedButton
          variant="ghost"
          onclick={() => { 
            if (outputStatsCollapsed) {
              // 显示产出统计栏，隐藏导航栏
              outputStatsCollapsed = false;
              navCollapsed = true;
            } else {
              // 隐藏产出统计栏
              outputStatsCollapsed = true;
            }
            saveFocusSettings({ outputStatsCollapsed, navCollapsed });
          }}
          ariaLabel={outputStatsCollapsed ? "显示产出统计" : "隐藏产出统计"}
          class={`weave-topbar-btn info-bar-toggle-btn output-stats-toggle-btn ${!outputStatsCollapsed ? 'active' : ''}`}
        >
          <EnhancedIcon name="bar-chart-2" size={18} />
        </EnhancedButton>

        <!-- 右侧工具栏切换按钮 -->
        <EnhancedButton
          variant="ghost"
          onclick={() => { showSidebar = !showSidebar; saveFocusSettings({ showToolbar: showSidebar }); }}
          ariaLabel={showSidebar ? "隐藏工具栏" : "显示工具栏"}
          class="weave-topbar-btn sidebar-toggle-btn"
        >
          <EnhancedIcon name={showSidebar ? "sidebar-close" : "sidebar-open"} size={18} />
        </EnhancedButton>

        <!-- 关闭按钮 -->
        <EnhancedButton variant="ghost" onclick={requestCloseWithSessionConfirm} ariaLabel="关闭" class="weave-topbar-btn close-btn">
          <EnhancedIcon name="times" size={18} />
        </EnhancedButton>
      </div>
    </div>
    {/if}

    <!-- v4.0: 两栏布局（中间阅读区 + 右侧工具栏），已移除左侧目录栏 -->
    <div class="ir-main-content" class:with-right-sidebar={showSidebar}>
      <!-- 主阅读区域 -->
      <div class="main-reading-area">
        <!-- v5.5: 内容块导航栏（4列卡片布局，与产出信息栏互斥显示） -->
        {#if !navCollapsed}
        <IRContentBlockNavigation
          app={plugin.app}
          currentBlock={currentBlock as any}
          sessionBlocks={activeBlocks as any}
          siblings={siblings}
          collapsed={false}
          onNavigate={handleNavigateToBlock}
        />
        {/if}

        <!-- v5.5: 产出信息栏（标注数、制卡数、累计时间）- 与顶部统计栏风格统一 -->
        {#if !outputStatsCollapsed}
        <div class="ir-stats-cards ir-output-stats">
          <!-- 标注数（当前块有效Callout标注数量 + 信号增益） -->
          <div class="stat-card extract-card" title={annotationSignal && annotationSignal.effectiveCalloutCount > 0 ? `标注信号: +${annotationSignal.signal.toFixed(2)} (${annotationSignal.effectiveCalloutCount}个有效标注)` : '无有效标注'}>
            <div class="stat-header">
              <span class="stat-title">标注数</span>
              <span class="stat-status">有效+信号</span>
            </div>
            <div class="stat-content">
              <span class="stat-value" style="color: var(--weave-success, #10b981)">
                {annotationSignal ? annotationSignal.effectiveCalloutCount : 0}<span class="stat-unit">+{annotationSignal ? annotationSignal.signal.toFixed(1) : '0'}</span>
              </span>
            </div>
          </div>

          <!-- 制卡数（当前文档关联的卡片总数） -->
          <div class="stat-card card-count-card" title="来源文档关联卡片: {historicalCardCount} | 本次新增: {currentBlockCardCount}">
            <div class="stat-header">
              <span class="stat-title">制卡数</span>
              <span class="stat-status">{currentBlockCardCount > 0 ? `本次+${currentBlockCardCount}` : '总计'}</span>
            </div>
            <div class="stat-content">
              <span class="stat-value" style="color: var(--weave-info, #60a5fa)">
                {historicalCardCount}
              </span>
            </div>
          </div>

          <!-- 累计时间（历史累计 + 本次新增） -->
          <div class="stat-card time-card" title="历史累计阅读时间 + 本块本次阅读时间">
            <div class="stat-header">
              <span class="stat-title">累计时间</span>
              <span class="stat-status">累计+本次</span>
            </div>
            <div class="stat-content">
              <span class="stat-value" style="color: var(--weave-warning, #f59e0b)">
                {Math.floor(historicalReadingTime / 60000)}<span class="stat-unit">m+{Math.floor(currentBlockTime / 60000)}m</span>
              </span>
            </div>
          </div>

          <!-- 下次阅读 -->
          <div class="stat-card schedule-card" title="当前内容块预计的下次复习日期">
            <div class="stat-header">
              <span class="stat-title">下次阅读</span>
            </div>
            <div class="stat-content">
              <span class="stat-value" style="color: var(--weave-info, #60a5fa)">
                {formatNextReview(currentBlock?.nextRepDate || null)}
              </span>
            </div>
          </div>
        </div>
        {/if}

        <!-- 内容块区域（简洁设计，参考记忆学习界面） -->
        <div class="block-content-wrapper">
          {#if currentBlock}
            <!-- v2.1: 优先级贴纸（在编辑和预览模式都显示，可在设置中关闭） -->
            {#if showPrioritySticker}
            <IRPrioritySticker 
              priority={Math.round(currentBlock.priorityUi) || 5}
              lastRating={(currentBlock as any).lastRating}
              showRating={true}
            />
            {/if}
            
            
            {#if isEditMode}
              <!-- 编辑模式：嵌入式 Obsidian 编辑器 -->
              <div class="embedded-editor-container" bind:this={editorContainer}></div>
            {:else}
              <!-- 预览模式：使用 ObsidianRenderer 组件渲染（支持链接跳转/脚注/hover预览） -->
              <div 
                class="block-content markdown-rendered" 
                style="user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text;"
              >
                {#if blockContent && isContentLoaded}
                  <ObsidianRenderer
                    {plugin}
                    content={blockContent}
                    sourcePath={currentBlock?.sourcePath || ''}
                  />
                {/if}
              </div>
            {/if}
          {:else}
            <div class="empty-state">
              <EnhancedIcon name="book-open" size={48} />
              <p>暂无内容块</p>
            </div>
          {/if}
        </div>

        <!-- v5.5: 底部调度意图选择栏（价值导向：攻坚/正常/放缓/稀后） -->
        {#if showRatingBar || alwaysShowRating}
        <div class="ir-rating-section">
          <div class="ir-rate-grid ir-scheduling-grid">
            {#each schedulingConfig as cfg}
              <button
                class="ir-rate-card ir-schedule-card"
                class:disabled={!isCurrentBlockActionable}
                style="--accent: {cfg.color}"
                aria-label={`调度意图：${cfg.label}${showRatingTime ? '（' + getSchedulingPrediction(cfg.action) + '）' : ''}`}
                disabled={!isCurrentBlockActionable}
                title={!isCurrentBlockActionable ? '当前内容块未到期或不可调整' : undefined}
                onclick={() => handleSchedulingAction(cfg.action)}
              >
                <div class="ir-rate-content">
                  <span class="ir-rate-label">{cfg.label}</span>
                  {#if showRatingTime}
                    <span class="ir-rate-next">{getSchedulingPrediction(cfg.action)}</span>
                  {/if}
                </div>
                <div class="ir-rate-accent" aria-hidden="true"></div>
              </button>
            {/each}
          </div>
        </div>
        {/if}
      </div>

      <!-- 右侧垂直工具栏（复用 VerticalToolbar 设计） -->
      {#if showSidebar}
      <div class="sidebar-content">
        <div class="weave-vertical-toolbar">
          <!-- 计时器区域（在上方，参考 VerticalToolbar） -->
          <div class="toolbar-section timer-section">
            <!-- 当前块计时 -->
            <div class="timer-display block-timer">
              <span class="timer-text">{formatTimer(currentBlockTime)}</span>
              <div class="timer-label">本块用时</div>
            </div>
            
            <!-- 总阅读时间 -->
            <div class="timer-display total-timer">
              <span class="timer-text">{formatTimer(totalReadingTime)}</span>
              <div class="timer-label">总计用时</div>
            </div>
          </div>

          <!-- 功能按钮组（v4.0: 支持长按拖拽排序） -->
          <div 
            class="toolbar-section actions-section"
            class:is-dragging={isDraggingButton}
            role="presentation"
            onmousemove={handleButtonDragMove}
            onmouseup={handleButtonDragEnd}
            onmouseleave={handleButtonDragEnd}
            ontouchmove={handleButtonDragMove}
            ontouchend={handleButtonDragEnd}
            ontouchcancel={handleButtonDragEnd}
          >
            <!-- 编辑/预览切换 -->
            <button 
              class="toolbar-btn edit-btn" 
              class:active={isEditMode}
              data-btn-id="edit"
              onclick={toggleEditMode} 
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              disabled={isPdfBlock}
              title={isPdfBlock ? "PDF 书签不支持编辑模式" : (isEditMode ? "切换到预览模式（长按拖拽调整位置）" : "切换到编辑模式（长按拖拽调整位置）")}
            >
              <EnhancedIcon name={isEditMode ? "eye" : "edit"} size={18} />
              <span class="btn-label">{isEditMode ? "预览" : "编辑"}</span>
            </button>

            <!-- 摘录为卡片 -->
            <button 
              class="toolbar-btn extract-btn" 
              data-btn-id="extract"
              onclick={extractToCard}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              disabled={isPdfBlock}
              title={isPdfBlock ? "PDF 书签不支持摘录" : "将选中文本摘录为卡片（长按拖拽调整位置）"}
            >
              <EnhancedIcon name="file-plus" size={18} />
              <span class="btn-label">摘录</span>
            </button>

            <!-- 下次复习时间（参考记忆学习界面的提醒按钮） -->
            <button 
              class="toolbar-btn reminder-btn" 
              data-btn-id="reminder"
              onclick={setNextReview}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              title="设置下次复习时间（长按拖拽调整位置）"
            >
              <EnhancedIcon name="bell" size={18} />
              <span class="btn-label">复习</span>
            </button>

            <!-- v4.0: 优先级按钮 + 浮动面板（无遮罩层，显示在左侧） -->
            <button 
              class="toolbar-btn priority-btn"
              class:active={showPrioritySlider}
              data-btn-id="priority"
              bind:this={priorityButtonElement}
              onclick={() => { 
                showPrioritySlider = !showPrioritySlider; 
                priorityReason = '';
                // 初始化临时值为当前优先级
                tempPriorityValue = currentPriorityUi;
              }}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              disabled={!currentBlock}
              title="设置优先级（长按拖拽调整位置）"
            >
              <div class="priority-indicator" style="color: {currentPriorityUi <= 3 ? 'var(--text-muted)' : currentPriorityUi <= 6 ? 'var(--interactive-accent)' : 'var(--text-warning)'}">
                {currentPriorityUi <= 3 ? '!' : currentPriorityUi <= 6 ? '!!' : '!!!'}
              </div>
              <span class="btn-label">优先级</span>
            </button>

            <!-- v4.0: 优先级浮动面板（无遮罩层，显示在按钮左侧） -->
            <FloatingMenu
              bind:show={showPrioritySlider}
              anchor={priorityButtonElement}
              placement="left-start"
              onClose={() => showPrioritySlider = false}
            >
              {#snippet children()}
                <div class="ir-priority-panel">
                  <div class="priority-panel-header">
                    <span>设置优先级</span>
                    <button class="close-btn" onclick={() => showPrioritySlider = false}>
                      <EnhancedIcon name="times" size={12} />
                    </button>
                  </div>
                  <div class="priority-panel-content">
                    <!-- 当前值显示 -->
                    <div class="priority-current-value" style="color: {tempPriorityValue <= 3 ? 'var(--text-muted)' : tempPriorityValue <= 6 ? 'var(--interactive-accent)' : 'var(--text-warning)'}">
                      <span class="priority-number">{tempPriorityValue.toFixed(1)}</span>
                      <span class="priority-label-text">{tempPriorityValue <= 3 ? '低优先级' : tempPriorityValue <= 6 ? '中等优先级' : '高优先级'}</span>
                    </div>
                    <!-- 滑动条 -->
                    <div class="priority-slider-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={tempPriorityValue}
                        class="priority-range-input"
                        oninput={(e) => {
                          const target = e.target as HTMLInputElement;
                          // 更新临时值用于预览
                          tempPriorityValue = parseFloat(target.value);
                        }}
                      />
                      <div class="priority-slider-labels">
                        <span>低</span>
                        <span>中</span>
                        <span>高</span>
                      </div>
                    </div>
                    <!-- 理由输入（强制） -->
                    <div class="priority-reason-section">
                      <label class="reason-label" for="priority-reason-input">调整理由（必填）</label>
                      <textarea
                        id="priority-reason-input"
                        class="reason-input"
                        placeholder="为什么要调整优先级？例如：这是考试重点..."
                        bind:value={priorityReason}
                        rows="2"
                      ></textarea>
                    </div>
                    <!-- 确认按钮 -->
                    <button 
                      class="priority-confirm-btn"
                      disabled={priorityReason.trim().length < 3}
                      onclick={() => {
                        if (priorityReason.trim().length >= 3) {
                          handlePrioritySliderChange(tempPriorityValue);
                          showPrioritySlider = false;
                          priorityReason = '';
                          tempPriorityValue = 5; // 重置临时值
                        }
                      }}
                    >
                      确认调整
                    </button>
                  </div>
                </div>
              {/snippet}
            </FloatingMenu>

            <!-- 图谱联动（参考记忆学习界面） -->
            <button 
              class="toolbar-btn graph-link-btn" 
              class:active={isGraphLinked}
              data-btn-id="graph"
              onclick={toggleGraphLink}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              title={isGraphLinked ? "关闭图谱联动（长按拖拽调整位置）" : "开启图谱联动（长按拖拽调整位置）"}
            >
              <EnhancedIcon name="link" size={18} />
              <span class="btn-label">图谱</span>
            </button>

            <!-- v5.6: 查看内容块信息 -->
            <button 
              class="toolbar-btn info-btn"
              data-btn-id="info"
              onclick={() => showBlockInfoModal = true}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              disabled={!currentBlock}
              title="查看内容块信息（长按拖拽调整位置）"
            >
              <EnhancedIcon name="eye" size={18} />
              <span class="btn-label">查看</span>
            </button>

            <!-- 打开源文档 -->
            <button 
              class="toolbar-btn source-btn"
              data-btn-id="source"
              onclick={openSourceDocument}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              disabled={!currentBlock?.sourcePath}
              title="打开源文档（长按拖拽调整位置）"
            >
              <EnhancedIcon name="file-text" size={18} />
              <span class="btn-label">源文档</span>
            </button>

            <!-- v5.5: 移出内容块（添加 #ignore 标签，不再进入学习会话） -->
            <button 
              class="toolbar-btn remove-btn"
              data-btn-id="remove"
              onclick={handleRemoveBlock}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              disabled={!currentBlock}
              title="移出队列（添加 #ignore 标签）"
            >
              <EnhancedIcon name="x-circle" size={18} />
              <span class="btn-label">移出</span>
            </button>

            <!-- AI助手 -->
            <button
              class="toolbar-btn ai-assistant-btn"
              data-btn-id="ai-assistant"
              onclick={handleAIAssistantClick}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              title="AI助手（拆分选中文本）"
            >
              <EnhancedIcon name="brain" size={18} />
              <span class="btn-label">AI助手</span>
            </button>

            <!-- 理解度自评 -->

            <div class="toolbar-spacer"></div>

            <!-- 教程 -->
            <button 
              class="toolbar-btn tutorial-btn"
              data-btn-id="tutorial"
              onclick={openTutorial}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              title="查看使用教程（长按拖拽调整位置）"
            >
              <EnhancedIcon name="book-open" size={18} />
              <span class="btn-label">教程</span>
            </button>

            <!-- 设置 -->
            <button 
              class="toolbar-btn settings-btn"
              class:active={showSettingsMenu}
              data-btn-id="settings"
              bind:this={settingsButtonElement}
              onclick={toggleSettingsMenu}
              onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              onmouseup={handleButtonDragEnd}
              ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
              title="更多设置（长按拖拽调整位置）"
            >
              <EnhancedIcon name="settings" size={18} />
              <span class="btn-label">设置</span>
            </button>

            <!-- 设置浮动菜单 -->
            <FloatingMenu
              bind:show={showSettingsMenu}
              anchor={settingsButtonElement}
              placement="left-start"
              onClose={() => showSettingsMenu = false}
            >
              {#snippet children()}
                <div class="ir-settings-menu">
                  <div class="settings-menu-header">
                    <span>更多设置</span>
                    <button class="close-btn" onclick={() => showSettingsMenu = false}>
                      <EnhancedIcon name="times" size={12} />
                    </button>
                  </div>

                  <div class="settings-menu-content">
                    <!-- 自评功能设置 -->
                    <div class="setting-section">
                      <div class="section-title">自评功能</div>
                      
                      <button 
                        type="button"
                        class="setting-item action-item"
                        onclick={() => {
                          showSettingsMenu = false;
                          if (alwaysShowRating) {
                            showRatingBar = true;
                            return;
                          }
                          toggleRatingBar();
                        }}
                      >
                        <div class="setting-label">
                          <span>理解度自评</span>
                        </div>
                        <span class="action-hint">{(showRatingBar || alwaysShowRating) ? '关闭' : '打开'}</span>
                      </button>
                      
                      <!-- 显示预测时间 -->
                      <div class="setting-item toggle-item">
                        <div class="setting-label">
                          <span>显示预测时间</span>
                        </div>
                        <label class="toggle-switch">
                          <input
                            type="checkbox"
                            checked={showRatingTime}
                            onchange={(e) => handleShowRatingTimeChange((e.target as HTMLInputElement).checked)}
                          />
                          <span class="slider"></span>
                        </label>
                      </div>

                      <!-- 始终显示自评栏 -->
                      <div class="setting-item toggle-item">
                        <div class="setting-label">
                          <span>始终显示自评栏</span>
                        </div>
                        <label class="toggle-switch">
                          <input
                            type="checkbox"
                            checked={alwaysShowRating}
                            onchange={(e) => handleAlwaysShowRatingChange((e.target as HTMLInputElement).checked)}
                          />
                          <span class="slider"></span>
                        </label>
                      </div>

                      <!-- v2.1: 显示优先级贴纸 -->
                      <div class="setting-item toggle-item">
                        <div class="setting-label">
                          <span>显示优先级贴纸</span>
                        </div>
                        <label class="toggle-switch">
                          <input
                            type="checkbox"
                            checked={showPrioritySticker}
                            onchange={(e) => handleShowPriorityStickerChange((e.target as HTMLInputElement).checked)}
                          />
                          <span class="slider"></span>
                        </label>
                      </div>

                    </div>
                  </div>
                </div>
              {/snippet}
            </FloatingMenu>
          </div>

        </div>
      </div>
      {/if}
    </div>
  </div>
</div>

<!-- v6.1: 自定义学习队列统计 tooltip（替代浏览器原生 title） -->
{#if showStatsTooltip && focusStats}
<div 
  class="stats-tooltip"
  style="left: {tooltipX}px; top: {tooltipY}px;"
>
  <div class="tooltip-header">学习队列说明</div>
  <table class="tooltip-table">
    <thead>
      <tr>
        <th>项目</th>
        <th>说明</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="item-label">本次队列</td>
        <td>实际进入本次学习会话的内容块数量（受时间预算限制）</td>
      </tr>
      <tr>
        <td class="item-label">时间预算</td>
        <td>用户设置的每日增量阅读时间上限</td>
      </tr>
      <tr>
        <td class="item-label">预计耗时</td>
        <td>根据每块历史阅读时长估算的本次会话总时长</td>
      </tr>
      <tr>
        <td class="item-label">未读(今日到期)</td>
        <td>牌组卡片上显示的「未读」，即 nextRepDate ≤ 今天的所有内容块</td>
      </tr>
      <tr>
        <td class="item-label">待读({focusStats.learnAheadDays}天内)</td>
        <td>牌组卡片上显示的「待读」，即 {focusStats.learnAheadDays} 天内到期但不含今日</td>
      </tr>
      <tr class="highlight-row">
        <td class="item-label">解释</td>
        <td>说明为什么队列数可能小于未读数——时间预算限制</td>
      </tr>
    </tbody>
  </table>
  <div class="tooltip-data">
    <div class="data-row">
      <span class="data-label">本次队列:</span>
      <span class="data-value">{totalBlocks} 块</span>
    </div>
    <div class="data-row">
      <span class="data-label">时间预算:</span>
      <span class="data-value">{focusStats.timeBudgetMinutes} min</span>
    </div>
    <div class="data-row">
      <span class="data-label">预计耗时:</span>
      <span class="data-value">{focusStats.estimatedMinutes.toFixed(1)} min</span>
    </div>
    <div class="data-row">
      <span class="data-label">未读(今日到期):</span>
      <span class="data-value">{focusStats.dueToday}</span>
    </div>
    <div class="data-row">
      <span class="data-label">待读({focusStats.learnAheadDays}天内):</span>
      <span class="data-value">{Math.max(0, focusStats.dueWithinDays - focusStats.dueToday)}</span>
    </div>
  </div>
</div>
{/if}

<!-- 提醒设置模态窗（复用 StudyInterface 设计） -->
{#if showReminderModal}
  <div class="modal-overlay" role="presentation" onclick={(event) => {
    if (event.target === event.currentTarget) {
      showReminderModal = false;
    }
  }}>
    <div class="reminder-modal" role="dialog" aria-modal="true" aria-labelledby="reminder-modal-title" tabindex="-1">
      <div class="modal-header">
        <h3 id="reminder-modal-title">设置复习提醒</h3>
        <button class="modal-close" onclick={() => showReminderModal = false}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-description">为当前内容块自定义下次复习时间：</p>

        <div class="form-group">
          <label for="review-date">复习日期：</label>
          <input
            id="review-date"
            type="date"
            bind:value={customReviewDate}
            class="date-input"
          />
        </div>

        <div class="form-group">
          <label for="review-time">复习时间：</label>
          <input
            id="review-time"
            type="time"
            bind:value={customReviewTime}
            class="time-input"
          />
        </div>

        <div class="warning-message">
          <EnhancedIcon name="info" size={16} />
          <span>注意：自定义复习时间将覆盖算法计算的时间</span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => showReminderModal = false}>
          取消
        </button>
        <button class="btn-primary" onclick={confirmSetReminder}>
          确认设置
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 优先级设置模态窗（复用 StudyInterface 设计） -->
{#if showPriorityModal}
  <div class="modal-overlay" role="presentation" onclick={(event) => {
    if (event.target === event.currentTarget) {
      showPriorityModal = false;
    }
  }}>
    <div class="priority-modal" role="dialog" aria-modal="true" aria-labelledby="priority-modal-title" tabindex="-1">
      <div class="modal-header">
        <h3 id="priority-modal-title">设置优先级</h3>
        <button class="modal-close" onclick={() => showPriorityModal = false}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-description">选择当前内容块的重要程度：</p>

        <div class="priority-options">
          {#each [1, 2, 3, 4] as priority}
            <button
              class="priority-option"
              class:selected={selectedPriority === priority}
              onclick={(e) => {
                e.stopPropagation();
                selectedPriority = priority;
              }}
            >
              <div class="priority-stars">
                {#each Array(priority) as _}
                  <EnhancedIcon name="starFilled" size={16} />
                {/each}
                {#each Array(4 - priority) as _}
                  <EnhancedIcon name="star" size={16} />
                {/each}
              </div>
              <span class="priority-label">
                {['', '低优先级', '中优先级', '高优先级', '紧急'][priority]}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => showPriorityModal = false}>
          取消
        </button>
        <button class="btn-primary" onclick={confirmChangePriority}>
          确认设置
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- v5.6: 内容块信息模态窗 -->
{#if showBlockInfoModal && currentBlock}
  <IRBlockInfoModal
    block={currentBlock as any}
    onClose={() => showBlockInfoModal = false}
  />
{/if}

<!-- 子卡片浮层 -->
{#if showChildCardsOverlay}
  <ChildCardsOverlay 
    {childCards}
    {regeneratingCardIds}
    isRegenerating={regeneratingCardIds.size > 0}
    bind:this={childCardsOverlayRef}
  />
{/if}

<!-- 统一操作栏 - 只在子卡片模式下显示 -->
{#if showChildCardsOverlay}
  <div class="ir-unified-actions-bar-wrapper">
    <UnifiedActionsBar
      showChildOverlay={showChildCardsOverlay}
      selectedCount={childCardsOverlayRef?.getSelectedCardIds?.().length || 0}
      onReturn={handleCloseChildOverlay}
      onRegenerate={handleRegenerateChildCards}
      onSave={handleSaveSelectedChildCards}
      isRegenerating={regeneratingCardIds.size > 0}
      showDeckSelector={currentSplitAction !== null}
      {availableDecks}
      selectedDeckId={targetDeckIdForSplit}
      onDeckChange={handleSplitDeckChange}
    />
  </div>
{/if}

<style>
  /* ==================== 模态窗布局（完全参考 StudyInterface） ==================== */
  .ir-focus-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(17, 17, 17, 0.88);
    backdrop-filter: blur(8px);
    z-index: var(--weave-z-float);
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--weave-study-view-spacing, 12px);
  }

  .ir-focus-content {
    background: var(--background-primary);
    border-radius: var(--radius-l, 12px);
    width: 100%;
    max-width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: var(--weave-shadow-xl);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ir-unified-actions-bar-wrapper {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 8px;
    width: calc(100% - 2rem);
    max-width: 1400px;
    z-index: calc(var(--weave-z-float) + 20);
    pointer-events: auto;
  }

  .ir-unified-actions-bar-wrapper :global(.unified-actions-bar) {
    z-index: calc(var(--weave-z-float) + 20);
    border-radius: 0 0 var(--radius-l, 12px) var(--radius-l, 12px);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* ==================== 顶部工具栏（完全复用 StudyHeader 样式） ==================== */
  .study-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
    border-radius: var(--weave-radius-lg, 8px) var(--weave-radius-lg, 8px) 0 0;
    position: relative;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex: 1;
  }

  .deck-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .study-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-normal);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .study-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .progress-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 600;
    min-width: 60px;
  }

  .progress-hint {
    font-size: 0.75rem;
    color: var(--text-faint);
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
  }

  .has-tooltip {
    cursor: help;
  }

  /* v6.1: 自定义学习队列统计 tooltip 样式 */
  .stats-tooltip {
    position: fixed;
    z-index: var(--layer-tooltip, 70);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1);
    padding: 12px;
    max-width: 340px;
    font-size: 0.7rem;
    line-height: 1.4;
    pointer-events: none;
    animation: tooltipFadeIn 0.15s ease-out;
  }

  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .tooltip-header {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .tooltip-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    font-size: 0.65rem;
  }

  .tooltip-table th {
    text-align: left;
    padding: 4px 6px;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-weight: 600;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .tooltip-table td {
    padding: 4px 6px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--background-modifier-border-hover);
  }

  .tooltip-table .item-label {
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    width: 85px;
  }

  .tooltip-table .highlight-row {
    background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
  }

  .tooltip-table .highlight-row td {
    color: var(--text-normal);
  }

  .tooltip-data {
    background: var(--background-secondary);
    border-radius: 6px;
    padding: 8px 10px;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
  }

  .data-row:not(:last-child) {
    border-bottom: 1px dashed var(--background-modifier-border);
    padding-bottom: 3px;
    margin-bottom: 3px;
  }

  .data-label {
    color: var(--text-muted);
    font-size: 0.65rem;
  }

  .data-value {
    color: var(--text-normal);
    font-weight: 600;
    font-size: 0.7rem;
  }

  .header-center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: auto;
  }

  .header-dots-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }

  .header-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .header-dot:hover {
    transform: scale(1.25);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ir-idle-pause-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal, 50);
  }

  .ir-idle-pause-panel {
    width: min(460px, calc(100vw - 48px));
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 16px;
    box-shadow: var(--shadow-l);
  }

  .ir-idle-pause-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .ir-idle-pause-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .ir-idle-pause-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .ir-idle-pause-btn {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .ir-idle-pause-btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  /* v4.0: 暂停计时按钮样式 */
  :global(.weave-topbar-btn.timer-pause-btn.weave-btn) {
    padding: 0.25rem;
    min-width: 32px;
    min-height: 32px;
  }

  :global(.weave-topbar-btn.timer-pause-btn.paused.weave-btn) {
    color: var(--text-warning);
    animation: pulse-warning 1.5s infinite;
  }

  @keyframes pulse-warning {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* v3.2: 信息栏切换按钮激活状态 */
  :global(.weave-topbar-btn.info-bar-toggle-btn.active.weave-btn) {
    background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);
    color: var(--interactive-accent);
    box-shadow: none;
  }

  :global(.weave-topbar-btn.stats-toggle-btn.active.weave-btn) {
    background: color-mix(in srgb, var(--weave-info, #60a5fa) 20%, transparent);
    color: var(--weave-info, #60a5fa);
    box-shadow: none;
  }

  :global(.weave-topbar-btn.nav-toggle-btn.active.weave-btn) {
    background: color-mix(in srgb, var(--weave-success, #22c55e) 20%, transparent);
    color: var(--weave-success, #22c55e);
    box-shadow: none;
  }

  /* ==================== 主内容区域（v4.0: 两栏Grid布局） ==================== */
  .ir-main-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr; /* 默认单列 */
    overflow: hidden;
  }

  /* v4.0: 中间内容区 + 右侧工具栏 */
  .ir-main-content.with-right-sidebar {
    grid-template-columns: 1fr auto;
  }

  .main-reading-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  /* ==================== 统计卡片（参考 StatsCards） ==================== */
  .ir-stats-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin: 0 1.5rem 0.375rem 1.5rem;
    padding-top: 0.75rem;
    animation: slideDown 0.3s ease-out;
  }

  .stat-card {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  .stat-card:hover {
    box-shadow: 0 8px 20px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.05);
    border-color: color-mix(in srgb, var(--background-modifier-border) 70%, var(--text-accent) 30%);
  }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--text-accent), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .stat-card:hover::before {
    opacity: 1;
  }

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .stat-title {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .stat-status {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--text-muted) 8%, transparent);
    white-space: nowrap;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-normal);
    line-height: 1.1;
    letter-spacing: -0.025em;
  }

  .stat-unit {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 600;
    margin-left: 0.25rem;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ==================== 内容块区域 ==================== */
  .block-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--weave-space-md, 1rem);
    overflow: hidden;
    min-height: 0;
    position: relative;  /* v2.1: 为优先级贴纸提供定位上下文 */
  }

  .block-content {
    flex: 1;
    line-height: 1.8;
    overflow-y: auto;
    padding: var(--weave-editor-padding-y, 20px) var(--weave-editor-padding-x, 24px);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    /* 确保文本可选择和复制 */
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
    cursor: text;
  }
  
  /* 嵌入式编辑器容器（参考 CardEditorContainer 样式） */
  .embedded-editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    min-height: 400px;
  }

  /* CodeMirror 编辑器填满容器 */
  .embedded-editor-container :global(.cm-editor) {
    flex: 1;
    min-height: 300px;
  }

  /* 🚫 隐藏装订线 gutter（与记忆学习界面一致） */
  .embedded-editor-container :global(.cm-gutters) {
    display: none !important;
  }

  :global(body.weave-line-numbers-on) .embedded-editor-container :global(.cm-gutters) {
    display: flex !important;
  }

  /* 编辑器内容区 padding */
  .embedded-editor-container :global(.cm-content) {
    padding: var(--weave-editor-padding-y, 20px) var(--weave-editor-padding-right, var(--weave-editor-padding-x, 24px)) var(--weave-editor-padding-y, 20px) var(--weave-editor-padding-left, var(--weave-editor-padding-x, 24px)) !important;
  }

  /* 确保 CodeMirror 内部滚动区域正确 */
  .embedded-editor-container :global(.cm-scroller) {
    overflow-y: auto !important;
  }

  :global(body.is-phone .weave-ir-focus-view-content .embedded-editor-container .cm-scroller),
  :global(body.is-mobile .weave-ir-focus-view-content .embedded-editor-container .cm-scroller) {
    padding: 0 !important;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    gap: 1rem;
  }

  /* 评分区域 */
  .ir-rating-section {
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
  }

  /* ==================== 右侧工具栏（完全复用 VerticalToolbar 样式） ==================== */
  .sidebar-content {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 70px;
    overflow: hidden;
  }

  .toolbar-spacer {
    flex: 1;
  }


  /* 桌面端不进行布局重排，侧边栏始终在右侧 */
  /* 移动端布局由 :global(body.is-phone) / :global(body.is-mobile) 控制 */

  /* ==================== Obsidian 移动端适配（参考 StudyInterface） ==================== */
  
  /* 所有移动设备通用样式 */
  :global(body.is-phone .weave-ir-focus-view-content),
  :global(body.is-mobile .weave-ir-focus-view-content) {
    position: relative;
    height: 100%;
  }

  :global(body.is-phone) .ir-focus-overlay,
  :global(body.is-mobile) .ir-focus-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0;
    height: auto;
    align-items: stretch;
    justify-content: stretch;
  }

  :global(body.is-phone) .ir-focus-content,
  :global(body.is-mobile) .ir-focus-content {
    height: 100%;
    max-width: 100%;
    border-radius: 0;
    margin: 0;
    border: none;
    box-shadow: none;
  }

  /* v2.1: 手机端隐藏右侧工具栏 */
  :global(body.is-phone) .sidebar-content {
    display: none !important;
  }

  :global(body.is-phone) .ir-stats-cards {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 0.375rem;
    margin: 0 0.5rem 0.25rem 0.5rem;
    padding: 0.375rem 0;
    overflow-x: auto;
    animation: none;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    background: color-mix(in srgb, var(--background-secondary) 50%, var(--background-primary) 50%);
    border-radius: 0.625rem;
  }

  :global(body.is-phone) .ir-stats-cards::-webkit-scrollbar {
    display: none;
  }

  :global(body.is-phone) .block-content-wrapper {
    padding: 0.5rem;
  }

  :global(body.is-phone) .stat-card {
    flex: 1 1 0;
    min-width: 0;
    padding: 0.375rem 0.5rem;
    border-radius: 0.5rem;
    background: transparent;
    border: none;
  }

  :global(body.is-phone) .stat-header {
    margin-bottom: 0.125rem;
    justify-content: center;
  }

  :global(body.is-phone) .stat-title {
    font-size: 0.5625rem;
  }

  :global(body.is-phone) .stat-status {
    display: none;
  }

  :global(body.is-phone) .stat-content {
    align-items: center;
  }

  :global(body.is-phone) .stat-value {
    font-size: 0.875rem;
    text-align: center;
  }

  :global(body.is-phone) .stat-unit {
    font-size: 0.5625rem;
  }

  :global(body.is-phone) .stat-card::before {
    display: none;
  }

  /* ==================== 模态框样式（复用 StudyInterface 设计） ==================== */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-modal);
    backdrop-filter: blur(2px);
  }

  .reminder-modal,
  .priority-modal {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: var(--shadow-s);
    max-width: 450px;
    min-width: 350px;
    max-height: 80vh;
    overflow: hidden;
    animation: bounceIn 0.3s ease-out;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    font-size: 1.2rem;
    line-height: 1;
    transition: all 0.15s ease;
  }

  .modal-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-normal);
    font-weight: 500;
    font-size: 0.9rem;
  }

  .date-input,
  .time-input {
    width: 100%;
    padding: 0.75rem;
    border: 1.5px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .date-input:focus,
  .time-input:focus {
    outline: none;
    border-color: var(--text-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--text-accent) 20%, transparent);
  }

  .warning-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--text-warning) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-warning) 30%, transparent);
    border-radius: 6px;
    color: var(--text-warning);
    font-size: 0.85rem;
    margin-top: 1rem;
  }

  .priority-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .priority-option {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 1rem;
    padding: 1rem;
    border: 1.5px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .priority-option:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .priority-option.selected {
    background: color-mix(in srgb, var(--text-accent) 10%, var(--background-primary));
    border-color: var(--text-accent);
  }

  .priority-stars {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: #fbbf24;
  }

  .priority-label {
    color: var(--text-normal);
    font-weight: 500;
  }

  .priority-option.selected .priority-label {
    color: var(--text-accent);
    font-weight: 600;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.9) translateY(-10px);
    }
    50% {
      transform: scale(1.02);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* ==================== 底部自评功能栏（参考记忆学习界面设计） ==================== */
  .ir-rating-section {
    background: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
    padding: 1rem 1.5rem 1.25rem;
    animation: slideUpRatingBar 0.3s ease-out;
  }

  @keyframes slideUpRatingBar {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ir-rate-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    max-width: 700px;
    margin: 0 auto;
  }

  .ir-rate-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.875rem;
    padding: 0.875rem 1rem;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    isolation: isolate;
    min-height: 56px;
  }

  .ir-rate-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .ir-rate-card:disabled:hover {
    border-color: var(--background-modifier-border);
    background: var(--background-secondary);
    box-shadow: none;
    transform: none;
  }

  .ir-rate-card:hover {
    border-color: var(--accent);
    background: var(--background-modifier-hover);
    box-shadow: 0 12px 24px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.08);
    transform: translateY(-2px);
  }

  .ir-rate-card:active {
    transform: translateY(-1px);
    transition: transform 0.1s ease;
  }

  .ir-rate-card:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .ir-rate-accent {
    position: absolute;
    inset: -30% -30% auto auto;
    height: 120%;
    width: 120%;
    background: radial-gradient(50% 50% at 75% 25%,
      color-mix(in srgb, var(--accent) 15%, transparent),
      transparent 65%);
    pointer-events: none;
    z-index: -1;
  }

  .ir-rate-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.75rem;
  }

  .ir-rate-label {
    font-weight: 700;
    letter-spacing: 0.025em;
    font-size: 0.9rem;
    color: var(--text-normal);
    flex-shrink: 0;
  }

  .ir-rate-next {
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
    text-align: right;
  }


  /* 侧边栏自评按钮激活状态 */
  /* ==================== 设置浮动菜单样式 ==================== */
  .ir-settings-menu {
    min-width: 220px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .settings-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .settings-menu-header span {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .settings-menu-header .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .settings-menu-header .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .settings-menu-content {
    padding: 0.5rem;
  }

  .setting-section {
    padding: 0.5rem;
  }

  .section-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
    padding: 0 0.25rem;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.25rem;
    gap: 1rem;
  }

  .setting-item.toggle-item {
    padding: 0.625rem 0.25rem;
  }

  .setting-item.action-item {
    width: 100%;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.625rem 0.25rem;
    text-align: left;
    border-radius: 6px;
  }

  .setting-item.action-item:hover {
    background: var(--background-modifier-hover);
  }

  .setting-item.action-item:active {
    background: var(--background-modifier-active-hover);
  }

  .action-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .setting-label {
    font-size: 0.8125rem;
    color: var(--text-normal);
  }

  /* Toggle Switch 样式 */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-switch .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background-modifier-border);
    transition: 0.2s;
    border-radius: 20px;
  }

  .toggle-switch .slider::before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  .toggle-switch input:checked + .slider {
    background-color: var(--interactive-accent);
  }

  .toggle-switch input:checked + .slider::before {
    transform: translateX(16px);
  }

  /* 设置按钮激活状态 */
  .toolbar-btn.settings-btn.active {
    background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);
    color: var(--interactive-accent);
  }

  /* ==================== v4.0: 优先级浮动面板 ==================== */
  .ir-priority-panel {
    min-width: 280px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .priority-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .priority-panel-header span {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .priority-panel-header .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .priority-panel-header .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .priority-panel-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .priority-current-value {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .priority-number {
    font-size: 1.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .priority-label-text {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .priority-slider-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .priority-range-input {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--background-modifier-border);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }

  .priority-range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    border-radius: 50%;
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .priority-range-input::-webkit-slider-thumb:active {
    cursor: grabbing;
  }

  .priority-slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .priority-reason-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reason-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .reason-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.8rem;
    resize: vertical;
    min-height: 48px;
  }

  .reason-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .reason-input::placeholder {
    color: var(--text-faint);
  }

  .priority-confirm-btn {
    width: 100%;
    padding: 0.625rem;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .priority-confirm-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .priority-confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 优先级按钮激活状态 */
  .toolbar-btn.priority-btn.active {
    background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);
  }

  .toolbar-btn.priority-btn .priority-indicator {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -1px;
    line-height: 1;
  }

  /* ==================== v4.0: 长按拖拽排序样式 ==================== */
  .actions-section.is-dragging {
    cursor: grabbing;
  }

  .actions-section.is-dragging .toolbar-btn {
    transition: none;
  }

</style>
