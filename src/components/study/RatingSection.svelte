<script lang="ts">
  import { logger } from '../../utils/logger';

  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import type { Card, Rating, FSRSCard } from "../../data/types";
  import type { FSRS } from "../../algorithms/fsrs";
  import { UnifiedCardType } from "../../types/unified-card-types";
  import { StepIndexCalculator } from "../../utils/learning-steps/StepIndexCalculator";
  
  //  导入国际化
  import { tr } from "../../utils/i18n";

  interface Props {
    card: Card;
    fsrs: FSRS;
    onRate: (rating: Rating) => void;
    showAnswer: boolean;
    onShowAnswer: () => void;
    cardType?: UnifiedCardType | null;  // 新增：卡片题型
    learningConfig?: {
      learningSteps: number[];
      relearningSteps: number[];
      graduatingInterval: number;
      easyInterval: number;
    };
    learningStepIndex?: number;
  }

  let { card, fsrs, onRate, showAnswer, onShowAnswer, cardType, learningConfig, learningStepIndex }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);
  
  // 根据题型动态计算按钮文案
  let showAnswerButtonText = $derived(() => {
    if (cardType === UnifiedCardType.MULTIPLE_CHOICE) {
      return t('studyInterface.confirmAnswer');
    }
    return t('studyInterface.showAnswer');
  });

  /**
   * 格式化预测间隔时间（支持精细时间粒度）
   * 专门用于学习界面评分按钮的时间间隔显示
   */
  function formatPredictedInterval(days: number): string {
    // 处理异常输入
    if (typeof days !== 'number' || Number.isNaN(days) || days === null || days === undefined) {
      return t('studyInterface.intervals.unknown');
    }

    // 转换常量
    const MINUTES_PER_DAY = 24 * 60;
    const SECONDS_PER_MINUTE = 60;
    const DAYS_PER_MONTH = 30;
    const DAYS_PER_YEAR = 365;

    // 转换为分钟以处理短时间间隔
    const totalMinutes = days * MINUTES_PER_DAY;

    // 1. 处理秒级别（< 1分钟）
    if (totalMinutes < 1) {
      return t('studyInterface.intervals.lessThan1Min');
    }

    // 2. 处理分钟级别（1-59分钟）
    if (totalMinutes < 60) {
      const minutes = Math.round(totalMinutes);
      return t('studyInterface.intervals.minutes').replace('{n}', String(minutes));
    }

    // 3. 处理小时级别（1-23小时）
    const totalHours = totalMinutes / 60;
    if (totalHours < 24) {
      const hours = Math.round(totalHours);
      return t('studyInterface.intervals.hours').replace('{n}', String(hours));
    }

    // 4. 处理天级别（1-29天）
    if (days < DAYS_PER_MONTH) {
      const roundedDays = Math.round(days);
      return t('studyInterface.intervals.days').replace('{n}', String(roundedDays));
    }

    // 5. 处理月级别（30-364天）
    if (days < DAYS_PER_YEAR) {
      const months = Math.round(days / DAYS_PER_MONTH);
      return t('studyInterface.intervals.months').replace('{n}', String(months));
    }

    // 6. 处理年级别（≥365天）
    const years = (days / DAYS_PER_YEAR).toFixed(1);
    return t('studyInterface.intervals.years').replace('{n}', years);
  }

  // 获取评分预测时间
  function getPredictedInterval(rating: Rating): string {
    if (!card || !card.fsrs) return t('studyInterface.intervals.unknown');
    try {
      // 手动创建一个干净的 FSRSCard 对象，避免 structuredClone 失败
      const cloned: FSRSCard = {
        due: card.fsrs.due,
        stability: card.fsrs.stability,
        difficulty: card.fsrs.difficulty,
        elapsedDays: card.fsrs.elapsedDays,
        scheduledDays: card.fsrs.scheduledDays,
        reps: card.fsrs.reps,
        lapses: card.fsrs.lapses,
        state: card.fsrs.state,
        lastReview: card.fsrs.lastReview,
        retrievability: card.fsrs.retrievability
      };
      
      // 增强对新卡片或不完整数据的处理
      if (!cloned.lastReview) {
        cloned.lastReview = new Date().toISOString();
        cloned.elapsedDays = 0;
        cloned.state = 0; // CardState.New
      }
      if (typeof cloned.elapsedDays !== 'number' || isNaN(cloned.elapsedDays)) {
        cloned.elapsedDays = 0;
      }

      const { card: updatedCard } = fsrs.review(cloned, rating);

      // 若在新/重学阶段，应用与 StudyModal 相同的学习步骤/毕业覆盖逻辑以保持一致
      try {
        const cfg = learningConfig || { learningSteps: [1,10], relearningSteps: [10], graduatingInterval: 1, easyInterval: 4 };
        const minutesToDays = (min: number) => Math.max(0, (min || 0) / (24 * 60));
        
        // 检查FSRS计算后的状态，而不是评分前的状态
        const fsrsResultState = updatedCard.state;
        const isNewOrLearning = fsrsResultState === 0 || fsrsResultState === 1; // CardState.New|Learning
        const isRelearning = fsrsResultState === 3; // CardState.Relearning
        
        // 只有FSRS计算后仍然是New/Learning/Relearning的卡片才需要Learning Steps
        if (isNewOrLearning || isRelearning) {
          const steps = isRelearning ? (cfg.relearningSteps || [10]) : (cfg.learningSteps || [1,10]);
          const nextStepDays = (idx: number) => minutesToDays(steps[Math.min(idx, steps.length - 1)] ?? 1);
          
          // 使用StepIndexCalculator从FSRS推断当前stepIndex
          const currentStepIndex = StepIndexCalculator.calculate(
            card,
            cfg.learningSteps || [1, 10],
            cfg.relearningSteps || [10]
          );
          
          // 计算下一步的stepIndex
          const nextStepIndex = StepIndexCalculator.calculateNext(
            currentStepIndex,
            rating,
            steps
          );
          
          const setDueAfterDays = (days: number) => {
            updatedCard.scheduledDays = Math.max(0, days);
            const ms = Math.round(days * 24 * 60 * 60 * 1000);
            updatedCard.due = new Date(Date.now() + ms).toISOString();
          };
          
          // 简化逻辑：直接使用calculateNext的结果
          // -1表示毕业，>=0表示继续Learning
          if (nextStepIndex === -1) {
            // 毕业
            const interval = rating === 4 ? (cfg.easyInterval || 4) : (cfg.graduatingInterval || 1);
            setDueAfterDays(Math.max(1, interval));
            updatedCard.state = 2; // Review
          } else {
            // 继续Learning/Relearning
            setDueAfterDays(nextStepDays(nextStepIndex));
            updatedCard.state = isNewOrLearning ? 1 : 3;
          }
        }
      } catch (e) {
        logger.error("Error applying learning steps in prediction:", e);
      }

      // 使用精细时间粒度格式化函数
      const days = updatedCard.scheduledDays || 0;
      return formatPredictedInterval(days);
    } catch (e) { 
      logger.error("Failed to predict interval for rating", rating, e);
      return t('studyInterface.intervals.unknown'); 
    }
  }

  // 获取评分配置
  const ratingConfig = $derived([
    { rating: 1 as Rating, label: t('studyInterface.ratings.again'), color: "var(--weave-error)", key: "1" },
    { rating: 2 as Rating, label: t('studyInterface.ratings.hard'), color: "var(--weave-warning)", key: "2" },
    { rating: 3 as Rating, label: t('studyInterface.ratings.good'), color: "var(--weave-success)", key: "3" },
    { rating: 4 as Rating, label: t('studyInterface.ratings.easy'), color: "var(--weave-info)", key: "4" },
  ]);

  // 已移除未使用的模式/建议函数，保持组件精简
</script>

<div class="rating-section">
  {#if !showAnswer}
    <!-- 显示答案区域 -->
    <div class="show-answer-area">
      <button class="show-answer-btn" onclick={onShowAnswer}>
        <EnhancedIcon name="eye" size="20" />
        <span>{showAnswerButtonText()}</span>
      </button>
    </div>
  {:else}
  <!-- 评分区域（Cursor风格卡片按钮） -->
  <div class="rating-modern">
    <div class="rate-grid">
      {#each ratingConfig as cfg}
        <button
          class="rate-card"
          style="--accent: {cfg.color}"
          aria-label={`评分：${cfg.label}（下一次：${getPredictedInterval(cfg.rating)}）`}
          aria-keyshortcuts={cfg.key}
          onclick={() => {
            if (showAnswer) {onRate(cfg.rating);}
          }}
        >
          <div class="rate-content">
            <span class="rate-label">{cfg.label}</span>
            <span class="rate-next">{getPredictedInterval(cfg.rating)}</span>
          </div>
          <div class="rate-accent" aria-hidden="true"></div>
        </button>
      {/each}
    </div>
  <!-- 移除快捷键提示以简化界面 -->
  </div>
  {/if}

</div>

<style>
  .rating-section {
    background: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
    padding: 1rem 1.5rem 1.25rem; /* 减小内边距以突出内容区 */
  }

  /* 显示答案区域 */
  .show-answer-area {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .show-answer-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 2px solid #3b82f6;
    border-radius: 0.75rem;
    padding: 1rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--weave-shadow-md);
  }

  .show-answer-btn:hover {
    box-shadow: var(--weave-shadow-lg);
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .show-answer-btn:active {
    transform: translateY(0);
  }

  .show-answer-btn kbd {
    background: var(--background-modifier-border);
    color: var(--text-muted);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: bold;
    margin: 0;
    border: 1px solid var(--background-modifier-border);
  }
  
  .show-answer-btn:hover kbd {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
  }


  /* 评分区域（现代卡片按钮 - 优化版） */
  .rating-modern { 
    display: flex; 
    flex-direction: column; 
    gap: 0.75rem; /* 减小间距 */
    max-width: 700px; 
    margin: 0 auto;
    position: relative;
  }


  
  .rate-grid { 
    display: grid; 
    grid-template-columns: repeat(4, 1fr); 
    gap: 0.75rem; /* 减小间距以更紧凑 */
  }
  
  .rate-card {
    position: relative;
    display: flex;
    flex-direction: column;
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
  
  .rate-card:hover {
    border-color: var(--accent);
    background: var(--background-modifier-hover);
    box-shadow: 0 12px 24px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.08);
  }
  
  .rate-card:active {
    transform: translateY(-1px);
    transition: transform 0.1s ease;
  }
  
  .rate-card:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  
  .rate-accent {
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
  
  .rate-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.75rem;
  }
  
  .rate-label { 
    font-weight: 700; 
    letter-spacing: 0.025em; 
    font-size: 0.9rem;
    color: var(--text-normal);
    flex-shrink: 0;
  }
  
  .rate-next { 
    color: var(--text-muted); 
    font-weight: 600; 
    font-size: 0.875rem;
    flex-shrink: 0;
    text-align: right;
  }

/* styles aligned to current design */

  /* 评分按钮组 */
/* styles aligned to current design */

/* styles aligned to current design */

  /* 评分建议 */
/* styles aligned to current design */

  /* 已移除 keyboard-hints 未使用样式 */

  /* 无需特殊的浅色模式适配，使用CSS变量自动适配 */

  /* 桌面端不进行布局重排，评分按钮始终4列 */
  /* 移动端布局由 :global(body.is-phone) 控制 */

  /* ==================== Obsidian 移动端适配 ==================== */
  
  /* 手机端：4列单行布局（难度在上，时间在下） */
  :global(body.is-phone) .rating-section {
    /*  修复：精确控制各方向的 padding */
    padding-top: 0.5rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
    /*  修复：使用与 Obsidian 底部导航栏一致的背景色 */
    background: var(--background-primary);
    /*  优化：使用更细腻的顶部边框 */
    border-top: 1px solid color-mix(in srgb, var(--background-modifier-border) 60%, transparent);
    /*  修复：移除可能的 margin */
    margin: 0;
  }

  :global(body.is-phone) .rate-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    width: 100%;
    max-width: 100%;
  }

  :global(body.is-phone) .rate-card {
    min-height: 56px;
    padding: 0.5rem 0.375rem;
    border-radius: 0.625rem;
  }
  
  /* 🆕 移动端难度按钮颜色标识 - 使用具体颜色值 */
  :global(body.is-phone) .rate-card:nth-child(1) {
    /* 重来（Again）：红色 */
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  :global(body.is-phone) .rate-card:nth-child(1):hover,
  :global(body.is-phone) .rate-card:nth-child(1):active {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }
  
  :global(body.is-phone) .rate-card:nth-child(2) {
    /* 困难（Hard）：橙色 */
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  :global(body.is-phone) .rate-card:nth-child(2):hover,
  :global(body.is-phone) .rate-card:nth-child(2):active {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.5);
  }
  
  :global(body.is-phone) .rate-card:nth-child(3) {
    /* 良好（Good）：绿色 */
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  :global(body.is-phone) .rate-card:nth-child(3):hover,
  :global(body.is-phone) .rate-card:nth-child(3):active {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }
  
  :global(body.is-phone) .rate-card:nth-child(4) {
    /* 简单（Easy）：蓝色 */
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  :global(body.is-phone) .rate-card:nth-child(4):hover,
  :global(body.is-phone) .rate-card:nth-child(4):active {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  :global(body.is-phone) .rate-content {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 2px;
  }

  :global(body.is-phone) .rate-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
  }

  :global(body.is-phone) .rate-next {
    font-size: 0.6875rem;
    text-align: center;
  }

  :global(body.is-phone) .show-answer-btn {
    padding: 0.875rem 1.5rem;
    font-size: var(--weave-mobile-font-base, 0.875rem);
    min-height: var(--weave-mobile-touch-primary, 48px);
    width: 100%;
    max-width: 100%;
    /*  优化：更圆润的按钮设计 */
    border-radius: 0.75rem;
  }

  /* 平板端：4列横排布局 */
  :global(body.is-tablet) .rate-grid {
    grid-template-columns: repeat(4, 1fr);
  }

/* animations aligned to current design */
</style>
