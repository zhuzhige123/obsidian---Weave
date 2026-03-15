/**
 * Weave卡片预览设计令牌 (TypeScript版本)
 * 用于在JavaScript/TypeScript中引用设计令牌
 * 
 * @version 1.0.0
 * @description 提供类型安全的设计令牌访问
 */

export const CardDesignTokens = {
  /** 间距系统 */
  spacing: {
    xs: 'var(--weave-space-xs)',
    sm: 'var(--weave-space-sm)',
    md: 'var(--weave-space-md)',
    lg: 'var(--weave-space-lg)',
    xl: 'var(--weave-space-xl)',
    xxl: 'var(--weave-space-2xl)',
  },
  
  /** 圆角系统 */
  radius: {
    sm: 'var(--weave-radius-sm)',
    md: 'var(--weave-radius-md)',
    lg: 'var(--weave-radius-lg)',
    xl: 'var(--weave-radius-xl)',
  },
  
  /** 背景色 */
  background: {
    primary: 'var(--weave-bg-primary)',
    secondary: 'var(--weave-bg-secondary)',
    hover: 'var(--weave-bg-modifier)',
  },
  
  /** 文字颜色 */
  text: {
    normal: 'var(--weave-text-normal)',
    muted: 'var(--weave-text-muted)',
    faint: 'var(--weave-text-faint)',
  },
  
  /** 边框 */
  border: {
    default: 'var(--weave-border)',
    hover: 'var(--weave-border-hover)',
  },
  
  /** 强调色 */
  accent: {
    default: 'var(--weave-accent)',
    hover: 'var(--weave-accent-hover)',
  },
  
  /** 语义颜色 */
  semantic: {
    success: 'var(--weave-success)',
    error: 'var(--weave-error)',
    warning: 'var(--weave-warning)',
    info: 'var(--weave-info)',
  },
  
  /** 选择题状态 */
  choice: {
    default: 'var(--weave-choice-default)',
    hover: 'var(--weave-choice-hover)',
    selected: 'var(--weave-choice-selected)',
    correct: 'var(--weave-choice-correct)',
    incorrect: 'var(--weave-choice-incorrect)',
  },
  
  /** 阴影 */
  shadow: {
    sm: 'var(--weave-shadow-sm)',
    md: 'var(--weave-shadow-md)',
    lg: 'var(--weave-shadow-lg)',
  },
  
  /** 过渡时长 */
  transition: {
    fast: 'var(--weave-transition-fast)',
    normal: 'var(--weave-transition-normal)',
    slow: 'var(--weave-transition-slow)',
  },
  
  /** 缓动函数 */
  easing: {
    out: 'var(--weave-ease-out)',
    inOut: 'var(--weave-ease-in-out)',
    bounce: 'var(--weave-ease-bounce)',
  },
} as const;

/**
 * 设计令牌类型定义
 */
export type CardDesignTokensType = typeof CardDesignTokens;

/**
 * 动画类名常量
 */
export const AnimationClasses = {
  answerEnter: 'weave-answer-enter',
  optionSelected: 'weave-option-selected',
  correctFeedback: 'weave-correct-feedback',
  incorrectFeedback: 'weave-incorrect-feedback',
  clozeReveal: 'weave-cloze-reveal',
  dividerEnter: 'weave-divider-enter',
  cardMount: 'weave-card-mount',
  fadeIn: 'weave-fade-in',
  slideUp: 'weave-slide-up',
  noAnimation: 'weave-no-animation',
  gpuAccelerated: 'weave-gpu-accelerated',
} as const;

/**
 * 样式类名常量
 */
export const StyleClasses = {
  cardBase: 'weave-card-base',
  elegantDivider: 'weave-elegant-divider',
  dividerLine: 'divider-line',
  dividerLabel: 'divider-label',
  cardTypeBadge: 'weave-card-type-badge',
} as const;







