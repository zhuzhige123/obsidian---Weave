<script lang="ts">
/**
 * IRCognitiveSticker - 布鲁姆认知层级贴纸组件
 * 
 * 复用优先级贴纸设计风格
 * 显示内容块的认知层级：记忆→理解→应用→分析→评价→创造
 * 
 * @version 1.1.0 - 使用Obsidian图标替代emoji
 */

import EnhancedIcon from '../ui/EnhancedIcon.svelte';

interface Props {
  cognitiveLevel: number;  // 认知层级 1-6
  showTooltip?: boolean;   // 是否显示提示
}

let { cognitiveLevel = 1, showTooltip = true }: Props = $props();

// 布鲁姆认知分类法六层级配置（使用Obsidian图标）
const cognitiveLevels: Record<number, { 
  label: string; 
  icon: string;
  color: string; 
  bg: string;
}> = {
  1: { 
    label: '记忆', 
    icon: 'file-text',
    color: '#6b7280', 
    bg: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)' 
  },
  2: { 
    label: '理解', 
    icon: 'lightbulb',
    color: '#0891b2', 
    bg: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)' 
  },
  3: { 
    label: '应用', 
    icon: 'wrench',
    color: '#059669', 
    bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' 
  },
  4: { 
    label: '分析', 
    icon: 'search',
    color: '#7c3aed', 
    bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' 
  },
  5: { 
    label: '评价', 
    icon: 'scale',
    color: '#db2777', 
    bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)' 
  },
  6: { 
    label: '创造', 
    icon: 'sparkles',
    color: '#ea580c', 
    bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)' 
  }
};

const config = $derived(cognitiveLevels[cognitiveLevel] || cognitiveLevels[1]);

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

{#if isVisible && cognitiveLevel > 0}
<div 
  class="ir-cognitive-sticker"
  style="background: {config.bg}; color: {config.color};"
  role="button"
  tabindex="0"
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <div class="sticker-icon">
    <EnhancedIcon name={config.icon} size={20} />
  </div>
  <div class="sticker-label">{config.label}</div>
  
  <!-- Hover详情 -->
  {#if showTooltip && isHovered}
    <div class="sticker-tooltip">
      <div class="tooltip-header">
        <EnhancedIcon name={config.icon} size={14} />
        <span class="tooltip-title">{config.label}</span>
      </div>
      <div class="tooltip-levels">
        {#each Object.entries(cognitiveLevels) as [level, cfg]}
          <div 
            class="level-item" 
            class:active={Number(level) === cognitiveLevel}
            style="color: {cfg.color}"
          >
            <EnhancedIcon name={cfg.icon} size={10} />
            <span class="level-label">{cfg.label}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
{/if}

<style>
.ir-cognitive-sticker {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: rotate(-3deg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 999;
  cursor: pointer;
  user-select: none;
  
  /* 淡入动画 */
  animation: fadeInCognitive 0.2s ease-out;
}

@keyframes fadeInCognitive {
  from {
    opacity: 0;
    transform: rotate(-3deg) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: rotate(-3deg) translateY(0);
  }
}

/* 胶带效果 */
.ir-cognitive-sticker::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 14px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  backdrop-filter: blur(4px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.sticker-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sticker-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  opacity: 0.9;
}

/* Tooltip样式 */
.sticker-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  min-width: 180px;
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

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.tooltip-title {
  font-weight: 700;
  font-size: 12px;
}

.tooltip-levels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.level-item {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--background-secondary);
  font-size: 9px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.level-item.active {
  opacity: 1;
  font-weight: 600;
  background: var(--background-modifier-hover);
}


.level-label {
  font-size: 9px;
}

:global(body.theme-dark) .sticker-tooltip {
  background: #2d2d2d;
  border-color: #4d4d4d;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .ir-cognitive-sticker {
    width: 55px;
    height: 55px;
    top: 14px;
    left: 10px;
  }
  
  .sticker-label {
    font-size: 0.55rem;
  }
  
  .sticker-tooltip {
    font-size: 10px;
    min-width: 160px;
  }
}
</style>
