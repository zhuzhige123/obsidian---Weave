import { logger } from '../../utils/logger';
/**
 * 学习完成逻辑辅助函数
 * 
 * 根据Anki的逻辑实现：
 * 1. 新卡片每日限额管理
 * 2. 学习完成判定
 * 3. 提前学习功能
 */

import type { Card, CardState } from '../../data/types';
import type { StudySession } from '../../data/study-types';
import type { WeaveDataStorage } from '../../data/storage';
import { CardType } from '../../data/types';
// 🆕 v2.2: 导入牌组ID获取工具
import { getCardDeckIds } from '../yaml-utils';
// V2架构：使用新的类型守卫和类型定义
import { 
  isProgressiveClozeParent, 
  isProgressiveClozeChild,
  type ProgressiveClozeChildCard 
} from '../../types/progressive-cloze-v2';

/**
 * 统一的时间解析函数
 * 处理 string | number | Date 类型的时间
 */
export function parseDueTime(due: string | number | Date): number {
  if (typeof due === 'number') return due;
  if (typeof due === 'string') return Date.parse(due);
  return due.getTime();
}

/**
 * P0: 过滤渐进式挖空兄弟卡片
 * 
 * 避免同一父卡片的子卡片在同一学习会话中出现，减少记忆干扰
 * 
 * 科学依据：
 * - 前摄干扰（Proactive Interference）：先学的内容干扰后学的
 * - 倒摄干扰（Retroactive Interference）：后学的内容干扰先学的
 * - 记忆巩固需要时间，连续学习相似内容会降低效果
 * 
 * @param cards 原始卡片队列
 * @returns 过滤后的队列（每个父卡片最多保留一个子卡片）
 */
export function filterProgressiveSiblings(cards: Card[]): Card[] {
  const selectedCards: Card[] = [];
  const parentCardsSeen = new Set<string>();
  
  for (const card of cards) {
    // 只处理渐进式挖空子卡片
    if (card.type === CardType.ProgressiveChild) {
      // 类型断言：确认是ProgressiveClozeChildCard
      const childCard = card as ProgressiveClozeChildCard;
      
      // 如果同一父卡片的兄弟已在队列中，跳过
      if (parentCardsSeen.has(childCard.parentCardId)) {
        logger.debug(
          `[filterProgressiveSiblings] 跳过子卡片 ${childCard.uuid.slice(0, 8)} ` +
          `(cloze ${childCard.clozeOrd})，父卡片 ${childCard.parentCardId.slice(0, 8)} 的其他子卡片已在队列中`
        );
        continue;
      }
      
      parentCardsSeen.add(childCard.parentCardId);
    }
    
    selectedCards.push(card);
  }
  
  if (parentCardsSeen.size > 0) {
    logger.info(
      `[filterProgressiveSiblings] ✅ 过滤完成: ` +
      `原始 ${cards.length} 张 → 过滤后 ${selectedCards.length} 张 ` +
      `(${parentCardsSeen.size} 组渐进式挖空)`
    );
  }
  
  return selectedCards;
}

/**
 * 检查卡片是否有到期的学习实例
 * 
 * 支持渐进式挖空：检查所有子卡片的FSRS数据
 * 
 * @param card 卡片对象
 * @param targetState 目标状态（0=New, 1=Learning, 2=Review, 3=Relearning）
 * @param now 当前时间戳
 * @returns 是否有到期的实例
 */
function hasDueInstance(card: Card, targetState: CardState, now: number): boolean {
  // V2架构：父卡片不参与学习，只有子卡片才会出现在队列中
  // 因此这里只需要检查普通卡片的FSRS数据
  if (isProgressiveClozeParent(card)) {
    // 父卡片不应该出现在学习队列中
    return false;
  }
  
  // 检查卡片的FSRS数据
  const fsrs = card.fsrs;
  if (!fsrs) return false;
  
  return fsrs.state === targetState && parseDueTime(fsrs.due) <= now;
}

/**
 * 获取今天已学习的新卡片数量
 * 
 * @param dataStorage 数据存储实例
 * @param deckId 牌组ID（可选，null表示全局）
 * @returns 今天已学习的新卡片数量
 */
export async function getLearnedNewCardsCountToday(
  dataStorage: WeaveDataStorage,
  deckId?: string
): Promise<number> {
  try {
    // 获取今天的开始时间（零点）
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStartTimestamp = todayStart.getTime();
    
    // 获取所有学习会话
    const allSessions = await dataStorage.getStudySessions();
    
    // 筛选今天的会话
    const todaySessions = allSessions.filter(_session => {
      const sessionStart = new Date(_session.startTime).getTime();
      const matchesTime = sessionStart >= todayStartTimestamp;
      const matchesDeck = !deckId || _session.deckId === deckId;
      return matchesTime && matchesDeck;
    });
    
    // 统计新卡片数量
    const totalNewCards = todaySessions.reduce((sum, session) => {
      return sum + (session.newCardsLearned || 0);
    }, 0);
    
    return totalNewCards;
  } catch (error) {
    logger.error('[studyCompletionHelper] 获取今日新卡片数量失败:', error);
    return 0;
  }
}

/**
 * 计算剩余的新卡片配额
 * 
 * @param newCardsPerDay 每日新卡片限额
 * @param learnedToday 今天已学习的新卡片数量
 * @returns 剩余配额
 */
export function getRemainingNewCardsQuota(
  newCardsPerDay: number,
  learnedToday: number
): number {
  return Math.max(0, newCardsPerDay - learnedToday);
}

/**
 * 判断牌组是否完成今天的学习任务（使用CardInstanceProvider）
 * 
 *  核心改进：使用CardInstanceProvider确保与队列生成一致（Bury Siblings机制）
 * 
 * 完成条件：
 * 1. 没有到期的卡片（学习中、复习、重新学习）
 * 2. 新卡片配额已用完
 * 
 * @param cards 牌组中的所有卡片
 * @param newCardsPerDay 每日新卡片限额
 * @param learnedNewCardsToday 今天已学习的新卡片数量
 * @returns 是否完成
 */
export async function isDeckCompleteForToday(
  cards: Card[],
  newCardsPerDay: number,
  learnedNewCardsToday: number
): Promise<boolean> {
  //  使用CardInstanceProvider（与loadDeckCardsForStudy相同的逻辑）
  const { CardInstanceProvider } = await import('../../services/study/CardInstanceProvider');
  const provider = new CardInstanceProvider();
  
  let dueCount = 0;
  let newCount = 0;
  
  for (const card of cards) {
    const instances = provider.getTodaysInstances(card, { onlyDue: true });
    
    if (instances.length === 0) continue;
    
    const instance = instances[0];
    const fsrs = instance.fsrs;
    
    if (!fsrs) continue;
    
    if (fsrs.state === 0) {
      newCount++;
    } else {
      dueCount++;
    }
  }
  
  // 2. 计算剩余新卡片配额
  const remainingQuota = getRemainingNewCardsQuota(newCardsPerDay, learnedNewCardsToday);
  
  // 3.  Bug2修复：完成判定：没有到期的复习卡片 且 新卡片配额已用完
  // 逻辑：dueCount === 0（没有到期的学习中/复习/重新学习卡片）
  //      且 remainingQuota <= 0（新卡片配额已用完）
  // 注意：即使有100张新卡片，只要配额用完就算完成
  return dueCount === 0 && remainingQuota <= 0;
}

/**
 * 获取提前学习的卡片（未到期的学习中和复习卡片）
 * 
 * @param cards 牌组中的所有卡片
 * @param count 获取数量
 * @param maxDaysAhead 最多提前学习天数（默认7天，基于FSRS研究建议避免影响记忆）
 * @returns 未到期的学习中和复习卡片数组
 */
export function getAdvanceStudyCards(
  cards: Card[],
  count = 20,
  maxDaysAhead = 7
): Card[] {
  const now = Date.now();
  const maxAdvanceTime = now + (maxDaysAhead * 24 * 60 * 60 * 1000);
  
  // V2架构：只返回子卡片实例（父卡片不参与学习）
  const futureCards = cards
    .filter(_card => {
      // 跳过父卡片
      if (isProgressiveClozeParent(_card)) {
        return false;
      }
      
      // 普通卡片和子卡片实例：检查FSRS状态
      if (!_card.fsrs) return false;
      const isLearningOrReview = _card.fsrs.state === 1 || _card.fsrs.state === 2;
      const dueTime = parseDueTime(_card.fsrs.due);
      const isNotDueYet = dueTime > now;
      const withinMaxAdvance = dueTime <= maxAdvanceTime;  //  不超过最大提前天数
      
      return isLearningOrReview && isNotDueYet && withinMaxAdvance;
    })
    .sort((a, b) => {
      // 按到期时间排序
      const getDueTime = (card: Card): number => {
        return card.fsrs ? parseDueTime(card.fsrs.due) : Infinity;
      };
      return getDueTime(a) - getDueTime(b);
    });
  
  return futureCards.slice(0, count);
}

/**
 * 根据卡片ID列表加载卡片
 * 
 * @param dataStorage 数据存储实例
 * @param cardIds 卡片ID数组
 * @param deckId 可选的牌组ID，如果提供则优先从该牌组加载
 * @returns 卡片数组（保持cardIds的顺序，过滤无效ID）
 */
export async function loadCardsByIds(
  dataStorage: WeaveDataStorage,
  cardIds: string[],
  deckId?: string
): Promise<Card[]> {
  try {
    logger.debug('[loadCardsByIds] 开始加载卡片:', {
      requestedCount: cardIds.length,
      cardIds: cardIds.map(id => id.slice(0, 8)),
      deckId
    });
    
    //  修复：引用式牌组架构下，卡片可能分布在多个牌组文件中
    // 必须使用 getAllCards() 才能找到所有被引用的卡片
    // 不能使用 getCards({ deckId })，因为引用式牌组没有自己的 cards.json 文件
    const allCards = await dataStorage.getAllCards();
    
    logger.debug('[loadCardsByIds] getCards结果:', {
      totalCards: allCards.length,
      sampleCardIds: allCards.slice(0, 5).map(c => c.uuid.slice(0, 8)),
      fromDeck: false  // 始终从全局加载
    });
    
    // 创建ID到卡片的映射
    const cardMap = new Map<string, Card>();
    allCards.forEach(_card => {
      cardMap.set(_card.uuid, _card);
    });
    
    // 按照cardIds的顺序加载卡片（过滤无效ID）
    const loadedCards: Card[] = [];
    const notFoundIds: string[] = [];
    
    for (const cardId of cardIds) {
      const card = cardMap.get(cardId);
      if (card) {
        loadedCards.push(card);
      } else {
        notFoundIds.push(cardId);
        logger.warn(`[loadCardsByIds] ❌ 卡片ID不存在: ${cardId.slice(0, 8)}`);
      }
    }
    
    logger.debug(`[loadCardsByIds] ✅ 加载完成:`, {
      requested: cardIds.length,
      loaded: loadedCards.length,
      notFound: notFoundIds.length,
      notFoundIds: notFoundIds.map(id => id.slice(0, 8))
    });
    
    return loadedCards;
  } catch (error) {
    logger.error('[loadCardsByIds] 加载卡片失败:', error);
    return [];
  }
}

/**
 * 加载牌组的学习卡片（使用CardInstanceProvider）
 * 
 *  核心改进：
 * 1. 使用CardInstanceProvider统一数据访问
 * 2. 每日限额基于父卡片（而非学习实例）
 * 3. 实现Bury Siblings机制
 * 4. 🆕 v2.0: 支持引用式牌组架构（优先使用 deck.cardUUIDs）
 * 
 * 优先级：学习中 > 重新学习 > 复习 > 新卡片（限额）
 * 
 * @param dataStorage 数据存储实例
 * @param deckId 牌组ID
 * @param newCardsPerDay 每日新卡片限额（父卡片数量）
 * @param reviewsPerDay 每日总复习限制
 * @returns 排序后的学习卡片数组
 */
export async function loadDeckCardsForStudy(
  dataStorage: WeaveDataStorage,
  deckId: string,
  newCardsPerDay: number,
  reviewsPerDay: number,
  filterSiblings = true  // 🆕 是否过滤兄弟卡片（默认true保持向后兼容）
): Promise<Card[]> {
  try {
    // 🆕 v2.0: 优先使用引用式牌组架构
    const deck = await dataStorage.getDeck(deckId);
    const allCards = await dataStorage.getAllCards();
    
    logger.info('[loadDeckCardsForStudy] 📊 数据加载:', {
      deckId,
      deckName: deck?.name,
      deckCardUUIDs: deck?.cardUUIDs?.length || 0,
      allCardsCount: allCards.length
    });
    
    //  关键修复：先过滤回收卡片，确保与统计逻辑一致
    const { filterRecycledCards } = await import('../recycle-utils');
    const activeCards = filterRecycledCards(allCards);
    
    // 🆕 v2.0: 构建卡片UUID到卡片的映射
    const cardByUUID = new Map<string, Card>();
    for (const card of activeCards) {
      cardByUUID.set(card.uuid, card);
    }
    
    logger.info('[loadDeckCardsForStudy] 📊 卡片映射:', {
      activeCardsCount: activeCards.length,
      cardByUUIDSize: cardByUUID.size
    });
    
    // 🆕 v2.0: 完全引用式牌组架构
    // 优先使用 deck.cardUUIDs，同时支持 card.referencedByDecks
    let deckCards: Card[] = [];
    
    // 方式1：通过 deck.cardUUIDs 获取卡片（优先）
    if (deck?.cardUUIDs && deck.cardUUIDs.length > 0) {
      const missingUUIDs: string[] = [];
      for (const uuid of deck.cardUUIDs) {
        const card = cardByUUID.get(uuid);
        if (card) {
          deckCards.push(card);
        } else {
          missingUUIDs.push(uuid);
        }
      }
      
      if (missingUUIDs.length > 0) {
        logger.warn('[loadDeckCardsForStudy] ⚠️ 找不到的卡片UUID:', {
          missingCount: missingUUIDs.length,
          missingUUIDs: missingUUIDs.slice(0, 5)
        });
      }
      
      logger.info('[loadDeckCardsForStudy] 🔗 通过 deck.cardUUIDs 获取牌组卡片:', {
        deckId: deckId.slice(0, 8),
        cardUUIDsCount: deck.cardUUIDs.length,
        foundCards: deckCards.length
      });
    }
    
    // 方式2：🆕 v2.2 优先从 content YAML 的 we_decks 获取牌组ID
    if (deckCards.length === 0) {
      for (const card of activeCards) {
        const { deckIds } = getCardDeckIds(card);
        if (deckIds.includes(deckId) || (card.referencedByDecks && card.referencedByDecks.includes(deckId))) {
          deckCards.push(card);
        }
      }
      
      logger.info('[loadDeckCardsForStudy] 🔗 通过 we_decks/referencedByDecks 获取牌组卡片:', {
        deckId: deckId.slice(0, 8),
        foundCards: deckCards.length
      });
    }
    
    logger.debug('[loadDeckCardsForStudy] 🔍 卡片过滤:', {
      deckId: deckId.slice(0, 8),
      totalActiveCards: activeCards.length,
      deckCardsCount: deckCards.length
    });
    
    //  使用CardInstanceProvider
    const { CardInstanceProvider } = await import('../../services/study/CardInstanceProvider');
    const provider = new CardInstanceProvider();
    
    // 分类卡片（父卡片级别）
    const learningCards: Card[] = [];
    const relearningCards: Card[] = [];
    const reviewCards: Card[] = [];
    const newCards: Card[] = [];
    
    let skippedNoInstance = 0;
    let skippedNoFsrs = 0;
    
    for (const card of deckCards) {
      //  获取今日学习实例（每张卡片最多1个）
      const instances = provider.getTodaysInstances(card, { onlyDue: true });
      
      if (instances.length === 0) {
        skippedNoInstance++;
        continue;  // 今天不学习
      }
      
      const instance = instances[0];
      const fsrs = instance.fsrs;
      
      if (!fsrs) {
        skippedNoFsrs++;
        continue;
      }
      
      // 按FSRS状态分类（按父卡片计数）
      if (fsrs.state === 0) {
        newCards.push(card);
      } else if (fsrs.state === 1) {
        learningCards.push(card);
      } else if (fsrs.state === 3) {
        relearningCards.push(card);
      } else if (fsrs.state === 2) {
        reviewCards.push(card);
      }
    }
    
    logger.info('[loadDeckCardsForStudy] 📊 卡片分类:', {
      deckCardsCount: deckCards.length,
      skippedNoInstance,
      skippedNoFsrs,
      newCards: newCards.length,
      learningCards: learningCards.length,
      reviewCards: reviewCards.length,
      relearningCards: relearningCards.length
    });
    
    //  关键：每日限额基于父卡片数量
    const learnedNewCardsToday = await getLearnedNewCardsCountToday(dataStorage, deckId);
    const remainingNewCards = getRemainingNewCardsQuota(newCardsPerDay, learnedNewCardsToday);
    
    // 合并：优先级顺序
    const combined = [
      ...learningCards,
      ...relearningCards,
      ...reviewCards,
      ...newCards.slice(0, remainingNewCards)  //  限制新卡片数量（父卡片）
    ];
    
    // 🆕 P0: 渐进式挖空子卡片分散 - 队列过滤
    // 避免同一父卡片的子卡片在同一学习会话中出现
    let finalCards: Card[];
    if (filterSiblings) {
      finalCards = filterProgressiveSiblings(combined);
      logger.info(
        `[loadDeckCardsForStudy] ✅ 兄弟过滤已启用: ` +
        `${combined.length} → ${finalCards.length} 张卡片`
      );
    } else {
      finalCards = combined;
      logger.info(
        `[loadDeckCardsForStudy] ⚠️  兄弟过滤已禁用: ` +
        `保留所有 ${finalCards.length} 张卡片`
      );
    }
    
    // 应用每日总限制
    return finalCards.slice(0, reviewsPerDay);
  } catch (error) {
    logger.error('[studyCompletionHelper] 加载牌组卡片失败:', error);
    return [];
  }
}

/**
 * 加载全局学习卡片（所有牌组）
 * 
 * @param dataStorage 数据存储实例
 * @param newCardsPerDay 每日新卡片限额
 * @param reviewsPerDay 每日总复习限制
 * @returns 排序后的学习卡片数组
 */
export async function loadAllDueCardsForStudy(
  dataStorage: WeaveDataStorage,
  newCardsPerDay: number,
  reviewsPerDay: number
): Promise<Card[]> {
  try {
    const allCardsRaw = await dataStorage.getAllCards();
    
    //  关键修复：先过滤回收卡片，确保与统计逻辑一致
    const { filterRecycledCards } = await import('../recycle-utils');
    const allCards = filterRecycledCards(allCardsRaw);
    
    logger.debug('[loadAllDueCardsForStudy] 🔍 卡片过滤:', {
      totalCards: allCardsRaw.length,
      afterFilterRecycled: allCards.length
    });
    
    const now = Date.now();
    
    // 1. 学习中的到期卡片
    // 🆕 支持渐进式挖空
    const learningCards = allCards.filter(card => hasDueInstance(card, 1, now));
    
    // 2. 重新学习的到期卡片
    const relearningCards = allCards.filter(card => hasDueInstance(card, 3, now));
    
    // 3. 复习到期的卡片
    const reviewCards = allCards.filter(card => hasDueInstance(card, 2, now));
    
    // 4. 新卡片（应用每日限额）
    // V2架构：getAllCards()返回的是子卡片实例，父卡片不参与学习
    const allNewCards = allCards.filter(card => {
      // 跳过父卡片（虽然getAllCards理论上不应该返回父卡片）
      if (isProgressiveClozeParent(card)) {
        return false;
      }
      return card.fsrs && card.fsrs.state === 0;
    });
    
    const learnedNewCardsToday = await getLearnedNewCardsCountToday(dataStorage);
    const remainingNewCards = getRemainingNewCardsQuota(newCardsPerDay, learnedNewCardsToday);
    
    // 5. 合并
    const combined = [
      ...learningCards,
      ...relearningCards,
      ...reviewCards,
      ...allNewCards.slice(0, remainingNewCards)
    ];
    
    // 6. 应用每日总限制
    return combined.slice(0, reviewsPerDay);
  } catch (error) {
    logger.error('[studyCompletionHelper] 加载全局卡片失败:', error);
    return [];
  }
}

