<script lang="ts">
  import { logger } from '../../utils/logger';

/**
 * StudyViewWrapper - 学习视图包装组件
 * 为标签页模式提供学习界面，直接复用 StudyInterface 组件
 */

import type { WeavePlugin } from '../../main';
import type { StudyView } from '../../views/StudyView';
import type { PersistedStudySession } from '../../types/study-types';
import type { Card, Deck } from '../../data/types';
import type { StudySession } from '../../data/study-types';
import { CardState } from '../../data/types';
import StudyInterface from './StudyInterface.svelte';
import { onMount } from 'svelte';
import { Notice } from 'obsidian';
import CelebrationModal from '../modals/CelebrationModal.svelte';
import type { CelebrationStats } from '../../types/celebration-types';
//  导入国际化
import { tr } from '../../utils/i18n';

// 🆕 导入学习完成逻辑辅助函数
import { loadDeckCardsForStudy, loadAllDueCardsForStudy, loadCardsByIds, getAdvanceStudyCards } from '../../utils/study/studyCompletionHelper';
import type { StudyMode } from '../../types/study-types';

//  导入服务就绪检查工具
import { waitForService } from '../../utils/service-ready-check';

// Props
interface Props {
  plugin: WeavePlugin;
  viewInstance: StudyView;
  deckId?: string;
  mode?: StudyMode;
  cardIds?: string[];
  cards?: Card[];  // 直接传递的卡片对象
  resumeData?: PersistedStudySession;
  queueState?: {
    currentCardIndex: number;
    studyQueueCardIds: string[];
    sessionStudiedCardIds: string[];
  };
  onClose: () => void;
}

let {
  plugin,
  viewInstance,
  deckId,
  mode,
  cardIds,
  cards,
  resumeData,
  queueState,
  onClose
}: Props = $props();

//  响应式翻译函数
let t = $derived($tr);

// 状态管理
//  移除暂停功能（影响使用体验）
let isLoading = $state(true);
let studyCards = $state<Card[]>([]);
let showStudyContent = $state(false);

//  庆祝模态窗状态
let showCelebrationModal = $state(false);
let celebrationDeckName = $state<string>('');
let celebrationDeckId = $state<string>('');
let celebrationStats = $state<CelebrationStats | null>(null);
let shouldCloseAfterCelebration = $state(false); //  标记是否需要在庆祝后关闭

// 状态监控（已移除调试日志）
let currentDeckId = $state(deckId || '');
let currentMode = $state(mode);
let currentCardIds = $state(cardIds);
let currentCards = $state(cards);  //  添加cards状态
let sessionStats = $state({
  completed: 0,
  correct: 0,
  incorrect: 0
});

// 学习会话数据
let currentCardIndex = $state(0);
let remainingCardIds = $state<string[]>([]);
let sessionType = $state<'review' | 'new' | 'learning' | 'mixed'>('mixed');

// 队列恢复的初始卡片索引（用于重启后恢复到之前的位置）
let initialCardIndex = $state(0);

// 实时队列进度（由 StudyInterface 的 $effect 通过 viewInstance.updateQueueState 更新）
// 此处仅作为 getQueueProgress 的数据源备份
let liveQueueProgress = $state<{
  currentCardIndex: number;
  studyQueueCardIds: string[];
  sessionStudiedCardIds: string[];
} | null>(null);

// 监听学习参数变化
$effect(() => {
  if (deckId !== undefined) {
    currentDeckId = deckId;
  }
  if (mode !== undefined) {
    currentMode = mode;
  }
  if (cardIds !== undefined) {
    currentCardIds = cardIds;
  }
  if (cards !== undefined) {
    currentCards = cards;  //  更新cards状态
  }
  
});

// 加载待学习的卡片
onMount(async () => {
  await loadStudyCards();
});

//  移除暂停/恢复功能（影响使用体验）

/**
 * 获取当前会话数据（用于持久化）
 */
export function getSessionData() {
  return {
    deckId: currentDeckId,
    currentCardIndex,
    remainingCardIds,
    stats: sessionStats,
    sessionType
  };
}

/**
 * 获取当前队列进度（供 StudyView.getState() 主动查询）
 * 数据来源：StudyInterface 通过 viewInstance.updateQueueState() 实时上报
 */
export function getQueueProgress(): {
  currentCardIndex: number;
  studyQueueCardIds: string[];
  sessionStudiedCardIds: string[];
} | null {
  // 优先使用 viewInstance 上的实时数据（由 StudyInterface 的 $effect 更新）
  if (viewInstance && (viewInstance as any).queueState) {
    return (viewInstance as any).queueState;
  }
  return liveQueueProgress;
}

/**
 * 是否需要持久化
 */
export function shouldPersist(): boolean {
  // 如果还有剩余卡片且已学习了一些，则需要持久化
  return remainingCardIds.length > 0 && sessionStats.completed > 0;
}

/**
 * 更新学习参数并重新加载卡片
 * 由 StudyView 在检测到参数变化时调用
 */
export async function updateStudyParams(params: {
  deckId?: string;
  mode?: StudyMode;
  cardIds?: string[];
}): Promise<void> {
  // 更新参数
  currentDeckId = params.deckId || '';
  currentMode = params.mode;
  currentCardIds = params.cardIds;
  
  // 重置状态
  isLoading = true;
  showStudyContent = false;
  
  // 重新加载卡片
  await loadStudyCards();
}

/**
 *  向后兼容：保留旧的 updateDeckId 方法
 */
export async function updateDeckId(newDeckId: string | undefined): Promise<void> {
  await updateStudyParams({ deckId: newDeckId });
}

/**
 * 处理关闭
 */
function handleClose(): void {
  onClose();
}

/**
 * 加载待学习的卡片（🆕 智能加载逻辑）
 */
async function loadStudyCards() {
  try {
    isLoading = true;
    
    // 如果有恢复数据，使用恢复数据
    if (resumeData) {
      currentDeckId = resumeData.deckId;
      currentCardIndex = resumeData.currentCardIndex;
      remainingCardIds = resumeData.remainingCardIds;
      sessionStats = resumeData.stats;
      sessionType = resumeData.sessionType;
      
      // TODO: 从 remainingCardIds 加载实际卡片对象
      // studyCards = await loadCardsFromIds(remainingCardIds);
    } else if (queueState && queueState.studyQueueCardIds && queueState.studyQueueCardIds.length > 0) {
      // 重启恢复：按保存的队列顺序和索引加载卡片
      logger.info('[StudyViewWrapper] 重启恢复：从保存的队列状态恢复', {
        savedIndex: queueState.currentCardIndex,
        queueLength: queueState.studyQueueCardIds.length,
        studiedCount: queueState.sessionStudiedCardIds?.length || 0
      });
      
      const dataStorage = await waitForService(
        () => plugin?.dataStorage,
        'DataStorage',
        10000
      );
      
      // 1. 提取唯一卡片ID（队列可能含重复ID，因learning steps插入）
      const uniqueCardIds = [...new Set(queueState.studyQueueCardIds)];
      const uniqueCards = await loadCardsByIds(dataStorage, uniqueCardIds, currentDeckId);
      
      if (uniqueCards.length > 0) {
        // 2. 建立UUID到Card的映射
        const cardMap = new Map<string, Card>();
        for (const card of uniqueCards) {
          cardMap.set(card.uuid, card);
        }
        
        // 3. 按原始队列顺序重建完整队列（含重复）
        const restoredQueue: Card[] = [];
        for (const id of queueState.studyQueueCardIds) {
          const card = cardMap.get(id);
          if (card) {
            restoredQueue.push(card);
          }
        }
        
        studyCards = restoredQueue;
        // 4. 设置初始卡片索引，确保不超出范围
        initialCardIndex = Math.min(queueState.currentCardIndex, restoredQueue.length - 1);
        initialCardIndex = Math.max(0, initialCardIndex);
        
        logger.info('[StudyViewWrapper] 队列恢复完成:', {
          uniqueCards: uniqueCards.length,
          restoredQueueLength: restoredQueue.length,
          initialCardIndex,
          currentCardId: restoredQueue[initialCardIndex]?.uuid?.slice(0, 8)
        });
      } else {
        // 加载失败，回退到正常加载
        logger.warn('[StudyViewWrapper] 队列恢复失败，回退到正常加载');
        if (currentDeckId) {
          studyCards = await loadDeckCards(currentDeckId);
        } else {
          studyCards = await loadDueCards();
        }
      }
    } else {
      //  智能加载逻辑：根据学习模式选择加载策略
      if (currentCardIds && currentCardIds.length > 0) {
        //  模式1: 自定义卡片列表（提前学习会使用这个）
        logger.debug('[StudyViewWrapper] 📥 模式1: 使用CardIds加载', {
          cardIdsCount: currentCardIds.length,
          cardIds: currentCardIds.map(id => id.slice(0, 8)),
          mode: currentMode
        });
        
        //  修复：等待 dataStorage 初始化完成
        const dataStorage = await waitForService(
          () => plugin?.dataStorage,
          'DataStorage',
          10000  // 增加到10秒，处理大数据量情况
        );
        
        //  关键修复：传递 deckId 确保从正确的牌组加载卡片
        studyCards = await loadCardsByIds(dataStorage, currentCardIds, currentDeckId);
        
        logger.debug('[StudyViewWrapper] ✅ 卡片加载完成:', {
          requestedCount: currentCardIds.length,
          loadedCount: studyCards.length,
          cardIds: studyCards.map(c => c.uuid.slice(0, 8)),
          deckId: currentDeckId
        });
      } else if (currentMode === 'advance') {
        //  模式2: 提前学习模式（加载未到期的复习卡片）
        if (!currentDeckId) {
          logger.error('[StudyViewWrapper] 提前学习模式缺少 deckId');
          new Notice('提前学习需要选择牌组');
          onClose();
          return;
        }
        studyCards = await loadAdvanceCards(currentDeckId);
      } else {
        //  模式3: 正常模式（到期卡片 + 新卡片配额）
        if (currentDeckId) {
          studyCards = await loadDeckCards(currentDeckId);
        } else {
          studyCards = await loadDueCards();
        }
      }
    }
    
    if (studyCards.length > 0) {
      showStudyContent = true;
    } else {
      //  修复：没有卡片时，立即显示友好提示并关闭
      logger.warn('[StudyViewWrapper] ⚠️ 无可学卡片，关闭学习界面');
      
      // 显示提示
      new Notice(t('noCardsToStudy'));
      
      // 立即关闭界面
      onClose();
    }
    
  } catch (error) {
    logger.error('[StudyViewWrapper] 加载卡片失败:', error);
  } finally {
    isLoading = false;
  }
}

/**
 * 从牌组加载卡片（ v3.0 使用 UnifiedStudyProvider 确保与统计一致）
 */
async function loadDeckCards(deckId: string): Promise<Card[]> {
  try {
    const newCardsPerDay = plugin.settings.newCardsPerDay || 20;
    const reviewsPerDay = plugin.settings.reviewsPerDay || 200;
    const filterSiblings = plugin.settings.studyConfig?.siblingDispersion?.filterInQueue ?? true;
    
    //  修复：等待 dataStorage 初始化完成
    const dataStorage = await waitForService(
      () => plugin?.dataStorage,
      'DataStorage',
      10000  // 增加到10秒，处理大数据量情况
    );
    
    //  v3.0: 使用 UnifiedStudyProvider（与统计使用相同的数据源）
    const { UnifiedStudyProvider } = await import('../../services/study/UnifiedStudyProvider');
    const unifiedProvider = new UnifiedStudyProvider(dataStorage);
    
    const { queue, stats, debug } = await unifiedProvider.getStudyData(deckId, {
      newCardsPerDay,
      reviewsPerDay,
      filterSiblings,
      onlyDue: true
    });
    
    //  关键日志：验证队列与统计一致性
    logger.info('[StudyViewWrapper] ✅ v3.0 统一数据加载完成:', {
      deckId: deckId.slice(0, 8),
      queueLength: queue.length,
      stats: {
        new: stats.newCards,
        learning: stats.learningCards,
        review: stats.reviewCards,
        total: stats.newCards + stats.learningCards + stats.reviewCards
      },
      debug,
      consistency: queue.length === (stats.newCards + stats.learningCards + stats.reviewCards) ? '✅ 一致' : '❌ 不一致'
    });
    
    return queue;
  } catch (error) {
    logger.error('[StudyViewWrapper] 加载牌组卡片失败:', error);
    return [];
  }
}

/**
 * 加载所有到期卡片（ 应用新卡片每日限额）
 */
async function loadDueCards(): Promise<Card[]> {
  try {
    const newCardsPerDay = plugin.settings.newCardsPerDay || 20;
    const reviewsPerDay = plugin.settings.reviewsPerDay || 20;
    
    //  修复：等待 dataStorage 初始化完成
    const dataStorage = await waitForService(
      () => plugin?.dataStorage,
      'DataStorage',
      10000  // 增加到10秒，处理大数据量情况
    );
    
    // 🆕 使用新的辅助函数（应用新卡片限额）
    const cards = await loadAllDueCardsForStudy(
      dataStorage,
      newCardsPerDay,
      reviewsPerDay
    );
    
    return cards;
  } catch (error) {
    logger.error('[StudyViewWrapper] 加载到期卡片失败:', error);
    return [];
  }
}

/**
 * 🆕 加载提前学习卡片（未到期的复习卡片）
 */
async function loadAdvanceCards(deckId: string): Promise<Card[]> {
  try {
    //  修复：等待 dataStorage 初始化完成
    const dataStorage = await waitForService(
      () => plugin?.dataStorage,
      'DataStorage',
      10000  // 增加到10秒，处理大数据量情况
    );
    
    const allDeckCards = await dataStorage.getCards({ deckId });
    const maxAdvanceDays = plugin.settings.maxAdvanceDays || 7;
    const advanceCards = getAdvanceStudyCards(allDeckCards, 20, maxAdvanceDays);
    
    return advanceCards;
  } catch (error) {
    logger.error('[StudyViewWrapper] 加载提前学习卡片失败:', error);
    return [];
  }
}

/**
 * 处理学习完成
 */
function handleStudyComplete(session: StudySession) {
  
  // 更新统计 (使用 StudySession 的实际字段)
  sessionStats = {
    completed: session.cardsReviewed || 0,
    correct: session.correctAnswers || 0,
    incorrect: (session.cardsReviewed || 0) - (session.correctAnswers || 0)
  };
  
  //  显示庆祝界面
  if (session.cardsReviewed && session.cardsReviewed > 0) {
    //  关键修复：立即同步设置所有必需的状态
    const memoryRate = session.cardsReviewed > 0 
      ? (session.correctAnswers || 0) / session.cardsReviewed 
      : 0;
    
    // 先用默认值初始化，确保模态窗可以立即显示
    celebrationDeckName = '加载中...';
    celebrationDeckId = session.deckId;
    celebrationStats = {
      reviewed: session.cardsReviewed,
      studyTime: Math.floor(session.totalTime / 1000), // 转换为秒
      memoryRate: memoryRate,
      newCards: session.newCardsLearned || 0
    };
    
    // 立即显示庆祝界面
    showCelebrationModal = true;
    shouldCloseAfterCelebration = true; // 标记需要在庆祝后关闭
    
    // 然后异步加载牌组名称
    (async () => {
      try {
        //  修复：等待 dataStorage 初始化完成
        const dataStorage = await waitForService(
          () => plugin?.dataStorage,
          'DataStorage',
          10000  // 增加到10秒，处理大数据量情况
        );
        const deck = await dataStorage.getDeck(session.deckId);
        celebrationDeckName = deck?.name || '未知牌组';
      } catch (error) {
        logger.error('[StudyViewWrapper] 加载牌组名称失败:', error);
        celebrationDeckName = '未知牌组';
      }
    })();
  } else {
    // 没有学习卡片，直接关闭
    onClose();
  }
}

/**
 * 处理关闭请求（拦截版本，用于 StudyInterface）
 *  如果庆祝界面正在显示，不立即关闭，而是等待用户关闭庆祝界面
 */
function handleCloseRequest() {
  if (showCelebrationModal) {
    // 庆祝界面正在显示，延迟关闭
    shouldCloseAfterCelebration = true;
  } else {
    // 没有庆祝界面，直接关闭
    onClose();
  }
}

/**
 *  关闭庆祝模态窗
 */
function handleCloseCelebration() {
  showCelebrationModal = false;
  celebrationStats = null;
  celebrationDeckId = '';
  
  // 如果学习已完成（shouldCloseAfterCelebration = true），关闭整个学习视图
  if (shouldCloseAfterCelebration) {
    // 延迟一点让动画完成
    setTimeout(() => {
      onClose();
    }, 100);
  }
  
  // 重置标志
  shouldCloseAfterCelebration = false;
}

/**
 *  开始考试模式
 */
async function handleStartPractice() {
  // 关闭庆祝模态窗
  showCelebrationModal = false;
  const deckId = celebrationDeckId;
  celebrationStats = null;
  celebrationDeckId = '';
  
  if (!deckId) {
    logger.error('[StudyViewWrapper] 无法开始考试：缺少牌组ID');
    new Notice('无法开始考试：缺少牌组信息');
    return;
  }
  
  try {
    logger.info('[StudyViewWrapper] 开始考试模式，牌组ID:', deckId);
    
    // 检查题库服务是否可用
    if (!plugin.questionBankService) {
      logger.error('[StudyViewWrapper] 题库服务未初始化');
      new Notice('题库功能未启用');
      return;
    }
    
    //  调试日志：查看所有题库
    const allBanks = await plugin.questionBankService.getAllBanks();
    logger.info('[StudyViewWrapper] 当前所有题库:', allBanks.map(b => ({
      id: b.id,
      name: b.name,
      deckType: b.deckType,
      pairedMemoryDeckId: (b.metadata as any)?.pairedMemoryDeckId
    })));
    
    logger.info('[StudyViewWrapper] 🔍 详细匹配信息:', {
      searchingForMemoryDeckId: deckId,
      searchingForMemoryDeckIdType: typeof deckId,
      allBanksWithPairing: allBanks.map(b => ({
        bankId: b.id,
        bankName: b.name,
        pairedMemoryDeckId: (b.metadata as any)?.pairedMemoryDeckId,
        pairedMemoryDeckIdType: typeof (b.metadata as any)?.pairedMemoryDeckId,
        strictEquals: (b.metadata as any)?.pairedMemoryDeckId === deckId,
        looseEquals: (b.metadata as any)?.pairedMemoryDeckId == deckId
      }))
    });
    
    //  关键修复：检查当前牌组是否本身就是题库牌组
    const currentDeck = await plugin.dataStorage.getDeck(deckId);
    logger.info('[StudyViewWrapper] 当前牌组信息:', currentDeck ? {
      id: currentDeck.id,
      name: currentDeck.name,
      deckType: currentDeck.deckType,
      pairedMemoryDeckId: (currentDeck.metadata as any)?.pairedMemoryDeckId
    } : '未找到');
    
    let questionBank: Deck | null = null;
    
    // 如果当前牌组本身就是题库牌组，直接使用
    if (currentDeck && currentDeck.deckType === 'question-bank') {
      logger.info('[StudyViewWrapper] ✅ 当前牌组本身就是题库牌组，直接使用');
      questionBank = currentDeck;
    } else {
      // 否则，将当前牌组ID作为记忆牌组ID，查找对应的题库牌组
      logger.info('[StudyViewWrapper] 当前牌组是记忆牌组，查找对应的题库牌组');
      questionBank = await plugin.questionBankService.findBankByMemoryDeckId(deckId);
      
      logger.info('[StudyViewWrapper] 查找结果:', questionBank ? {
        id: questionBank.id,
        name: questionBank.name,
        pairedMemoryDeckId: (questionBank.metadata as any)?.pairedMemoryDeckId
      } : '未找到');
    }
    
    if (!questionBank) {
      // 没有对应的考试牌组
      logger.info('[StudyViewWrapper] 暂无该记忆牌组对应的考试牌组');
      new Notice('暂无该记忆牌组对应的考试牌组');
      return;
    }
    
    // 打开考试学习会话
    logger.info('[StudyViewWrapper] 打开考试牌组:', questionBank.id, questionBank.name);
    await plugin.openQuestionBankSession({
      bankId: questionBank.id,
      bankName: questionBank.name
    });
    
    // 关闭当前学习视图
    if (shouldCloseAfterCelebration) {
      setTimeout(() => {
        onClose();
      }, 100);
    }
    
  } catch (error) {
    logger.error('[StudyViewWrapper] 开始考试失败:', error);
    new Notice('开始考试失败');
  }
  
  // 重置标志
  shouldCloseAfterCelebration = false;
}
</script>

<div class="weave-study-view-wrapper">
  <!--  只在有内容时显示工具栏和状态栏 -->
  {#if !isLoading && showStudyContent && studyCards.length > 0}
    <!-- 顶部工具栏 -->
    <div class="study-view-toolbar">
      <div class="toolbar-left">
        <span class="study-view-title">
          正在学习
        </span>
        <span class="study-stats">
          完成: {sessionStats.completed} | 
          正确: {sessionStats.correct} | 
          错误: {sessionStats.incorrect}
        </span>
      </div>
      
      <div class="toolbar-right">
        <!--  移除暂停/恢复按钮（影响使用体验） -->
        
        <button
          class="toolbar-btn close-btn"
          onclick={handleClose}
          title={t('studyInterface.closeStudy')}
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 学习内容区域 -->
    <div class="study-view-content">
      <div class="study-interface-embedded">
        <StudyInterface
          cards={studyCards}
          fsrs={plugin.fsrs}
          dataStorage={plugin.dataStorage}
          {plugin}
          {viewInstance}
          mode={currentMode === 'custom' ? 'normal' : currentMode}
          {initialCardIndex}
          onClose={handleCloseRequest}
          onComplete={handleStudyComplete}
        />
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="study-view-statusbar">
      <span class="status-text">
        学习中 | 
        进度: {currentCardIndex + 1} / {remainingCardIds.length + currentCardIndex + 1}
      </span>
    </div>
  {:else if isLoading}
    <!-- 加载中状态 -->
    <div class="loading-container-fullscreen">
      <div class="loading-spinner"></div>
      <p>加载学习卡片中...</p>
    </div>
  {/if}
  
  <!--  庆祝模态窗 -->
  {#if showCelebrationModal && celebrationStats}
    <CelebrationModal
      deckName={celebrationDeckName}
      deckId={celebrationDeckId}
      stats={celebrationStats}
      soundEnabled={true}
      soundVolume={0.5}
      onClose={handleCloseCelebration}
      onStartPractice={handleStartPractice}
    />
  {/if}
</div>

<style>
  .weave-study-view-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--background-primary);
  }

  .study-view-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .study-view-title {
    font-weight: 600;
    font-size: 14px;
  }

  .study-stats {
    font-size: 12px;
    color: var(--text-muted);
  }

  .toolbar-right {
    display: flex;
    gap: 4px;
  }

  .toolbar-btn {
    padding: 4px 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    font-size: 16px;
    transition: background-color 0.2s;
  }

  .toolbar-btn:hover {
    background: var(--background-modifier-hover);
  }

  .close-btn {
    color: var(--text-error);
  }

  .study-view-content {
    flex: 1;
    overflow: auto;
    position: relative;
    padding: 20px;
  }

  /*  移除暂停功能相关样式（影响使用体验） */

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /*  全屏加载容器 */
  .loading-container-fullscreen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding: 40px;
    text-align: center;
  }

  .loading-container-fullscreen .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-container-fullscreen p {
    margin: 16px 0;
    color: var(--text-muted);
  }

  /* StudyInterface 嵌入样式 */
  .study-interface-embedded {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  /* 隐藏 StudyInterface 自带的关闭按钮（如果有） */
  .study-interface-embedded :global(.interface-close-button) {
    display: none;
  }

  .study-view-statusbar {
    padding: 8px 12px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .status-text {
    display: inline-block;
  }

  /* ====================  移动端适配 ==================== */
  
  /* 手机端：隐藏冗余的顶部工具栏和底部状态栏 */
  :global(body.is-phone) .study-view-toolbar,
  :global(body.is-phone) .study-view-statusbar {
    display: none !important;
  }

  /* 手机端：内容区域全屏显示 */
  :global(body.is-phone) .study-view-content {
    padding: 0;
  }

  /* 手机端：嵌入的学习界面全屏 */
  :global(body.is-phone) .study-interface-embedded {
    height: 100%;
  }
</style>

