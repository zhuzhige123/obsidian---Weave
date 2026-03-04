<script lang="ts">
/**
 * IRPrioritySticker - 增量阅读优先级贴纸组件
 * 
 * 复用记忆学习界面的贴纸设计风格
 * 显示内容块的优先级和理解度信息
 * 
 * @version 1.0.0
 */

interface Props {
  priority: number | string;  // 优先级 1-10 或 文本如 'medium'
  lastRating?: number;        // 上次自评分数 1-4
  showRating?: boolean;       // 是否显示理解度
}

let { priority = 5, lastRating, showRating = true }: Props = $props();

// 将各种优先级格式统一转换为显示值
function normalizePriority(p: number | string): { display: string; level: 'high' | 'medium' | 'low' } {
  // 处理字符串类型（如 'medium', 'high', 'low'）
  if (typeof p === 'string') {
    const lower = p.toLowerCase();
    if (lower === 'high' || lower === '高') return { display: '高', level: 'high' };
    if (lower === 'low' || lower === '低') return { display: '低', level: 'low' };
    return { display: '中', level: 'medium' };  // 默认中等
  }
  // 处理数字类型（1-10范围）
  const num = Number(p);
  if (num <= 3) return { display: '高', level: 'high' };
  if (num >= 8) return { display: '低', level: 'low' };
  return { display: '中', level: 'medium' };
}

// 优先级配置（按级别）
const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: '#991b1b', bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' },
  medium: { label: '中', color: '#92400e', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' },
  low: { label: '低', color: '#166534', bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' }
};

// 理解度配置（移除"困惑"，添加"忽略"）
const ratingConfig: Record<number, { label: string; color: string }> = {
  1: { label: '忽略', color: '#6b7280' },
  2: { label: '一般', color: '#f59e0b' },
  3: { label: '清晰', color: '#10b981' },
  4: { label: '精通', color: '#06b6d4' }
};

const normalized = $derived(normalizePriority(priority));
const config = $derived(priorityConfig[normalized.level]);
const ratingInfo = $derived(lastRating ? ratingConfig[lastRating] : null);

// Hover状态
let isHovered = $state(false);

// 延迟显示，避免切换时闪烁
let isVisible = $state(false);

$effect(() => {
  isVisible = false;
  const timer = setTimeout(() => {
    isVisible = true;
  }, 150);
  
  return () => clearTimeout(timer);
});
</script>

{#if isVisible}
<div 
  class="ir-priority-sticker"
  style="background: {config.bg}; color: {config.color};"
  role="button"
  tabindex="0"
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <div class="sticker-priority">{normalized.display}</div>
  <div class="sticker-label">优先</div>
  
  <!-- Hover详情 -->
  {#if isHovered}
    <div class="sticker-tooltip">
      <div class="tooltip-row">
        <span class="tooltip-label">优先级</span>
        <span class="tooltip-value">{config.label}（{priority}）</span>
      </div>
      {#if showRating && ratingInfo}
        <div class="tooltip-row">
          <span class="tooltip-label">上次理解度</span>
          <span class="tooltip-value" style="color: {ratingInfo.color}">{ratingInfo.label}</span>
        </div>
      {/if}
      <div class="tooltip-row hint">
        <span class="tooltip-label">提示</span>
        <span class="tooltip-value">在内容中添加 #ignore 可跳过</span>
      </div>
    </div>
  {/if}
</div>
{/if}

<style>
.ir-priority-sticker {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 70px;
  height: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
  transform: rotate(3deg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  cursor: pointer;
  user-select: none;
  
  /* 淡入动画 */
  animation: fadeInSticker 0.2s ease-out;
}

@keyframes fadeInSticker {
  from {
    opacity: 0;
    transform: rotate(3deg) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: rotate(3deg) translateY(0);
  }
}

/* 胶带效果 */
.ir-priority-sticker::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  backdrop-filter: blur(4px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.sticker-priority {
  font-size: 2.8rem;
  line-height: 1;
  font-weight: 900;
  margin-bottom: 0.1rem;
}

.sticker-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.9;
}

/* Tooltip样式 */
.sticker-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-normal);
  font-weight: 400;
  z-index: 100;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 3px 0;
}

.tooltip-label {
  color: var(--text-muted);
  font-size: 11px;
}

.tooltip-value {
  font-weight: 600;
  color: var(--text-normal);
  font-size: 11px;
}

.tooltip-row.hint {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--background-modifier-border);
}

.tooltip-row.hint .tooltip-label,
.tooltip-row.hint .tooltip-value {
  color: var(--text-muted);
  font-size: 10px;
}

:global(body.theme-dark) .sticker-tooltip {
  background: #2d2d2d;
  border-color: #4d4d4d;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .ir-priority-sticker {
    width: 65px;
    height: 65px;
    top: 14px;
    right: 50px;
  }
  
  .sticker-priority {
    font-size: 2rem;
  }
  
  .sticker-label {
    font-size: 0.6rem;
  }
  
  .sticker-tooltip {
    font-size: 10px;
  }
}
</style>
