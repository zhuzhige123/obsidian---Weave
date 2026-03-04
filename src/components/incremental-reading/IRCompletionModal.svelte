<script lang="ts">
  /**
   * IRCompletionModal - 增量阅读完成结算模态窗
   * 
   * v2.1: 参考CelebrationModal设计，风格统一但内容适配增量阅读
   * - 显示阅读成就统计
   * - 提供"前往记忆牌组"按钮
   */
  import { onMount } from 'svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import ConfettiEffect from '../celebration/ConfettiEffect.svelte';
  import WavingDots from '../celebration/WavingDots.svelte';
  import { getCelebrationSound } from '../../services/audio/CelebrationSound';
  import { logger } from '../../utils/logger';

  interface IRCompletionStats {
    blocksCompleted: number;      // 完成的内容块数
    totalReadingTime: number;     // 总阅读时间（秒）
    extractedCards: number;       // 提取的卡片数
    averageRating?: number;       // 平均理解度评分
  }

  interface Props {
    deckName: string;
    stats: IRCompletionStats;
    soundEnabled?: boolean;
    soundVolume?: number;
    onClose: () => void;
    onGoToMemoryDeck?: () => void;  // 前往记忆牌组
  }

  let {
    deckName,
    stats,
    soundEnabled = true,
    soundVolume = 0.5,
    onClose,
    onGoToMemoryDeck
  }: Props = $props();

  // 随机鼓励语
  const congratulations = [
    '阅读完成！知识在脑海中沉淀~',
    '太棒了！今日阅读任务已完成！',
    '干得漂亮！所有内容块都阅读完了！',
    '持续阅读，收获满满！',
    '知识的种子已经播下~'
  ];
  const congratulation = congratulations[Math.floor(Math.random() * congratulations.length)];

  // 格式化阅读时长
  const formattedReadingTime = $derived(() => {
    const minutes = Math.floor(stats.totalReadingTime / 60);
    if (minutes === 0) return '< 1 分钟';
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} 小时 ${mins} 分钟`;
  });

  // 动画状态
  let showContent = $state(false);

  onMount(() => {
    // 播放音效
    if (soundEnabled) {
      const sound = getCelebrationSound();
      sound.play(soundVolume).catch(err => {
        logger.error('[IRCompletionModal] Sound play failed:', err);
      });
    }

    // 延迟显示内容（等待礼花动画）
    setTimeout(() => {
      showContent = true;
    }, 300);

  });
</script>

<!-- 🎉 增量阅读完成结算界面 -->
<div
  class="ir-completion-backdrop"
  onclick={() => { if (typeof onClose === 'function') onClose(); }}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (typeof onClose === 'function') onClose(); } }}
  role="button"
  tabindex="0"
  aria-label="关闭结算窗口"
>
  <!-- 礼花动画层 -->
  <ConfettiEffect />

  <!-- 内容卡片 -->
  <div
    class="ir-completion-card"
    class:show={showContent}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-labelledby="ir-completion-title"
    aria-modal="true"
  >
    <!-- 主标题 -->
    <h2 id="ir-completion-title" class="ir-completion-title">
      {congratulation}
    </h2>

    <!-- 波浪圆点动画 -->
    <div class="dots-container">
      <WavingDots />
    </div>

    <!-- 阅读统计 -->
    <div class="stats-section">
      <div class="stats-title">
        <EnhancedIcon name="book-open" size={16} />
        <span>今日阅读成就</span>
      </div>
      <div class="stats-list">
        <div class="stat-row">
          <span class="stat-label">阅读内容块</span>
          <span class="stat-value">{stats.blocksCompleted}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">阅读时长</span>
          <span class="stat-value">{formattedReadingTime()}</span>
        </div>
        {#if stats.extractedCards > 0}
        <div class="stat-row">
          <span class="stat-label">提取卡片</span>
          <span class="stat-value">{stats.extractedCards} 张</span>
        </div>
        {/if}
        {#if stats.averageRating}
        <div class="stat-row">
          <span class="stat-label">平均理解度</span>
          <span class="stat-value">{Math.round(stats.averageRating * 25)}%</span>
        </div>
        {/if}
      </div>
    </div>

    <!-- 底部提示和按钮 -->
    <div class="ir-completion-footer">
      <div class="footer-buttons-row">
        <button class="btn-secondary" onclick={onClose}>
          知道了
        </button>
        {#if onGoToMemoryDeck}
          <button class="btn-primary" onclick={onGoToMemoryDeck}>
            <EnhancedIcon name="layers" size={16} />
            前往记忆牌组
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* 背景遮罩 */
  .ir-completion-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    padding: 20px;
    animation: backdrop-fade-in 0.3s ease-out;
    overflow: auto;
  }

  @keyframes backdrop-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 内容卡片 */
  .ir-completion-card {
    position: relative;
    max-width: 520px;
    width: 100%;
    background: var(--background-primary);
    border-radius: 16px;
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    padding: 32px 28px;
    opacity: 0;
    transform: scale(0.9);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    z-index: 10001;
  }

  .ir-completion-card.show {
    opacity: 1;
    transform: scale(1);
  }

  /* 主标题 */
  .ir-completion-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-normal);
    text-align: center;
    margin: 0 0 24px 0;
    line-height: 1.4;
    background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: title-slide-up 0.5s ease-out 0.4s both;
  }

  @keyframes title-slide-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 圆点容器 */
  .dots-container {
    margin: 0 0 28px 0;
    animation: dots-fade-in 0.5s ease-out 0.5s both;
  }

  @keyframes dots-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 统计区域 */
  .stats-section {
    margin-bottom: 24px;
    animation: stats-fade-in 0.5s ease-out 0.8s both;
  }

  @keyframes stats-fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .stats-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 12px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .stats-list {
    background: var(--background-secondary);
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .stat-row:last-child {
    border-bottom: none;
  }

  .stat-label {
    font-size: 14px;
    color: var(--text-muted);
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* 底部按钮 */
  .ir-completion-footer {
    text-align: center;
    animation: footer-fade-in 0.5s ease-out 1.0s both;
  }

  @keyframes footer-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .footer-buttons-row {
    display: flex;
    gap: 12px;
    justify-content: center;
    align-items: center;
  }

  .btn-secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 12px 32px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .btn-secondary:active {
    transform: translateY(0);
  }

  .btn-primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 32px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  /* 响应式 */
  @media (max-width: 600px) {
    .ir-completion-card {
      padding: 24px 20px;
    }

    .ir-completion-title {
      font-size: 20px;
    }

    .stat-row {
      padding: 12px 16px;
    }

    .footer-buttons-row {
      display: flex;
      flex-direction: row;
      gap: 12px;
    }

    .btn-secondary,
    .btn-primary {
      flex: 1;
      padding: 12px 16px;
    }
  }
</style>
