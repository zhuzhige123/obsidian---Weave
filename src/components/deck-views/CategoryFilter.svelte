<script lang="ts">
  /**
   * 牌组模式筛选器
   * 🆕 v0.10 - 题库功能：改为模式切换
   * - memory: 记忆牌组（FSRS学习）
   * - reading: 增量阅读（未实现，预留）
   * - question-bank: 题库牌组（考试测试）
   * 
   * 兼容旧版：
   * - parent: 父卡片牌组（已废弃，映射到memory）
   * - child: 子卡片牌组（已废弃，映射到memory）
   * - all: 全部牌组（已废弃，映射到memory）
   * 
   *  v0.10.1 - 移动端样式统一
   * - 移除移动端特殊样式，桌面端和移动端使用相同的 16px 圆点
   * - 通过扩大触控区域（::before 伪元素）确保移动端可点击性
   */
  export type DeckFilter = 'memory' | 'reading' | 'question-bank' | 'incremental-reading' | 'parent' | 'child' | 'all';

  interface Props {
    selectedFilter: DeckFilter;
    onSelect: (filter: DeckFilter) => void;
  }

  let { selectedFilter, onSelect }: Props = $props();

  // 🆕 v0.10 - 三个模式选项（顺序：增量摘录、记忆牌组、考试牌组）
  const filters: Array<{ id: DeckFilter; name: string; icon: string; colorStart: string; colorEnd: string }> = [
    {
      id: 'incremental-reading',
      name: '增量阅读',
      icon: '📖',
      colorStart: '#ef4444',
      colorEnd: '#dc2626'
    },
    {
      id: 'memory',
      name: '记忆牌组',
      icon: '📚',
      colorStart: '#3b82f6',
      colorEnd: '#2563eb'
    },
    {
      id: 'question-bank',
      name: '考试牌组 🔒',
      icon: '📝',
      colorStart: '#10b981',
      colorEnd: '#059669'
    }
  ];

  function getGradientStyle(filter: typeof filters[0]): string {
    return `background: linear-gradient(135deg, ${filter.colorStart}, ${filter.colorEnd})`;
  }
</script>

<div class="category-filter">
  {#each filters as filter}
    <button
      class="category-dot"
      class:selected={selectedFilter === filter.id}
      style={getGradientStyle(filter)}
      onclick={() => onSelect(filter.id)}
      ontouchend={(e) => { e.preventDefault(); onSelect(filter.id); }}
      aria-label={filter.name}
      title={filter.name}
    >
      {#if selectedFilter === filter.id}
        <span class="selected-indicator"></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  /* ==================== 统一样式（桌面端和移动端相同） ==================== */
  /*  v0.10.1 - 移除移动端特殊样式，使用统一的 16px 圆点 */
  .category-filter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 0;
    margin-bottom: 4px;
  }

  .category-dot {
    position: relative;
    width: 20px; /* 🔧 从 16px 调整为 20px，移动端更易识别 */
    height: 20px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    padding: 0;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  /*  扩大触控区域（不可见），确保移动端可点击 */
  .category-dot::before {
    content: '';
    position: absolute;
    top: -12px;
    left: -12px;
    right: -12px;
    bottom: -12px;
    border-radius: 50%;
  }

  .category-dot:hover {
    transform: scale(1.25);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }

  .category-dot:active {
    transform: scale(1.15);
  }

  .category-dot:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  .category-dot.selected {
    transform: scale(1.35);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  }

  /* 选中状态的脉冲边框 */
  .category-dot.selected::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.6);
    opacity: 0.6;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.3;
    }
  }

  /* 选中指示器（白色小圆点） */
  .selected-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
</style>
