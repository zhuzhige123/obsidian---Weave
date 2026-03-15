<script lang="ts">
/**
 * Choice Accuracy Sticker - 选择题正确率贴纸
 * 
 * 显示选择题答题正确率的贴纸组件
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

import { tr } from '../../utils/i18n';

interface Props {
  accuracy: number;  // 正确率 (0-100)
  correct: number;   // 正确数
  total: number;     // 总数
}

let { accuracy, correct, total }: Props = $props();

let t = $derived($tr);

// Hover状态
let isHovered = $state(false);

// 根据正确率决定颜色
const colorConfig = $derived.by(() => {
  if (accuracy >= 90) {
    return {
      bgGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
      textColor: '#065f46',
      label: t('study.choiceAccuracy.excellent')
    };
  } else if (accuracy >= 70) {
    return {
      bgGradient: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
      textColor: '#1e40af',
      label: t('study.choiceAccuracy.good')
    };
  } else if (accuracy >= 60) {
    return {
      bgGradient: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)',
      textColor: '#7c2d12',
      label: t('study.choiceAccuracy.pass')
    };
  } else {
    return {
      bgGradient: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      textColor: '#991b1b',
      label: t('study.choiceAccuracy.needsWork')
    };
  }
});

// 格式化正确率显示
const formattedAccuracy = $derived(accuracy.toFixed(1));
</script>

<div 
  class="choice-accuracy-sticker"
  style="background: {colorConfig.bgGradient}; color: {colorConfig.textColor};"
  role="button"
  tabindex="0"
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <div class="sticker-percentage">{formattedAccuracy}%</div>
  <div class="sticker-label">{t('study.choiceAccuracy.label')}</div>
  
  <!-- Hover详情 -->
  {#if isHovered}
    <div class="sticker-tooltip">
      <div class="tooltip-row">
        <span class="tooltip-label">{t('study.choiceAccuracy.tooltipTitle')}</span>
        <span class="tooltip-value">{formattedAccuracy}%</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">{t('study.choiceAccuracy.correct')}</span>
        <span class="tooltip-value">{correct}/{total}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">{t('study.choiceAccuracy.rating')}</span>
        <span class="tooltip-value">{colorConfig.label}</span>
      </div>
    </div>
  {/if}
</div>

<style>
.choice-accuracy-sticker {
  position: absolute;
  top: 16px;
  right: 290px;  /* 在难度和优先级贴纸左侧 */
  width: 80px;
  height: 75px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
  transform: rotate(-3deg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: var(--weave-z-overlay);
  cursor: pointer;
  user-select: none;
  
  animation: fadeInAccuracy 0.3s ease-out;
}

@keyframes fadeInAccuracy {
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
.choice-accuracy-sticker::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 52px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  backdrop-filter: blur(4px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 百分比显示 */
.sticker-percentage {
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 900;
  margin-bottom: 0.1rem;
  letter-spacing: -0.5px;
  font-family: var(--font-monospace);
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
  z-index: var(--weave-z-float);
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

:global(body.theme-dark) .sticker-tooltip {
  background: #2d2d2d;
  border-color: #4d4d4d;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .choice-accuracy-sticker {
    width: 70px;
    height: 65px;
    top: 14px;
    right: 250px;
  }
  
  .sticker-percentage {
    font-size: 1.25rem;
  }
  
  .sticker-label {
    font-size: 0.6rem;
  }
  
  .sticker-tooltip {
    font-size: 10px;
  }
}
</style>
