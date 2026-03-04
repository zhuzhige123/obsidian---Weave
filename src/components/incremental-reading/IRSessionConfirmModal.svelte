<!--
  学习会话结束确认弹窗
  显示自动计时的时长，允许用户手动修正后确认
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ResizableModal from '../ui/ResizableModal.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import type AnkiObsidianPlugin from '../../main';

  interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: (confirmedDurationSeconds: number) => void;
    plugin: AnkiObsidianPlugin;
    deckName: string;
    autoRecordedDurationSeconds: number;
    blocksCompleted: number;
    cardsCreated: number;
  }

  let { 
    open = $bindable(), 
    onClose, 
    onConfirm,
    plugin, 
    deckName,
    autoRecordedDurationSeconds,
    blocksCompleted,
    cardsCreated
  }: Props = $props();

  // 用户输入的修正时长（分钟）
  let inputMinutes = $state(0);
  
  // 初始化输入值
  $effect(() => {
    if (open) {
      inputMinutes = Math.round(autoRecordedDurationSeconds / 60);
    }
  });

  // 格式化时长显示
  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  }

  // 处理确认
  function handleConfirm() {
    const confirmedSeconds = Math.max(0, inputMinutes * 60);
    onConfirm(confirmedSeconds);
  }

  // 处理取消（不记录）
  function handleSkip() {
    onClose();
  }

  // 快捷设置时长
  function setQuickDuration(minutes: number) {
    inputMinutes = minutes;
  }
</script>

{#if open}
<ResizableModal
  bind:open
  {plugin}
  title="学习会话结束"
  onClose={handleSkip}
  enableTransparentMask={false}
  enableWindowDrag={false}
  keyboard={true}
  initialWidth={420}
  initialHeight={520}
>
  <div class="session-confirm-modal">
    <div class="session-confirm-body">
      <!-- 多彩侧边条标题 -->
      <div class="section-title with-accent-bar accent-green">
        会话统计
      </div>

      <!-- 统计信息卡片 -->
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-icon">
            <ObsidianIcon name="clock" size={20} />
          </div>
          <div class="stat-content">
            <span class="stat-label">自动记录时长</span>
            <span class="stat-value">{formatDuration(autoRecordedDurationSeconds)}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <ObsidianIcon name="check-square" size={20} />
          </div>
          <div class="stat-content">
            <span class="stat-label">完成内容块</span>
            <span class="stat-value">{blocksCompleted}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <ObsidianIcon name="credit-card" size={20} />
          </div>
          <div class="stat-content">
            <span class="stat-label">创建卡片</span>
            <span class="stat-value">{cardsCreated}</span>
          </div>
        </div>
      </div>

      <!-- 时长修正区域 -->
      <div class="section-title with-accent-bar accent-blue">
        确认学习时长
      </div>

      <div class="duration-input-section">
        <div class="input-row">
          <input 
            type="number" 
            class="duration-input"
            bind:value={inputMinutes}
            min="0"
            max="480"
          />
          <span class="input-unit">分钟</span>
        </div>

        <div class="quick-buttons">
          <button class="quick-btn" onclick={() => setQuickDuration(30)}>30分</button>
          <button class="quick-btn" onclick={() => setQuickDuration(45)}>45分</button>
          <button class="quick-btn" onclick={() => setQuickDuration(60)}>1小时</button>
          <button class="quick-btn" onclick={() => setQuickDuration(90)}>1.5小时</button>
          <button class="quick-btn" onclick={() => setQuickDuration(120)}>2小时</button>
        </div>

        <p class="hint-text">
          您可以根据实际情况修正学习时长，修正后的时长将用于学习行为分析。
        </p>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <button class="btn-secondary" onclick={handleSkip}>
        不记录
      </button>
      <button class="btn-primary" onclick={handleConfirm}>
        确认记录
      </button>
    </div>
  </div>
</ResizableModal>
{/if}

<style>
  .session-confirm-modal {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-primary);
    padding: 20px;
    gap: 16px;
    min-height: 0;
  }

  .session-confirm-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* 多彩侧边条标题 */
  .section-title {
    position: relative;
    padding-left: 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
    line-height: 1.4;
  }

  .section-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 18px;
    border-radius: 2px;
  }

  .section-title.accent-green::before {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.7));
  }

  .section-title.accent-blue::before {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.7));
  }

  /* 统计卡片 */
  .stats-cards {
    display: flex;
    gap: 12px;
  }

  .stat-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
  }

  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--background-modifier-hover);
    border-radius: 8px;
    color: var(--text-muted);
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 时长输入区域 */
  .duration-input-section {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .duration-input {
    width: 100px;
    padding: 10px 14px;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
    background: var(--background-primary);
    border: 2px solid var(--interactive-accent);
    border-radius: 8px;
    color: var(--text-normal);
    outline: none;
  }

  .duration-input:focus {
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.2);
  }

  .input-unit {
    font-size: 14px;
    color: var(--text-muted);
  }

  .quick-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .quick-btn {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    background: var(--background-primary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .quick-btn:hover {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }

  .hint-text {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* 操作按钮 */
  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-shrink: 0;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .btn-secondary {
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .btn-primary {
    padding: 10px 24px;
    font-size: 13px;
    font-weight: 500;
    background: var(--interactive-accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  /* 响应式 */
  @media (max-width: 480px) {
    .stats-cards {
      flex-direction: column;
    }

    .quick-buttons {
      justify-content: center;
    }
  }
</style>
