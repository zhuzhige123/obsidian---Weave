<script lang="ts">
  import type { Snippet } from "svelte";
  import EnhancedIcon from "./EnhancedIcon.svelte";
  import { createEventDispatcher } from "svelte";

  interface Props {
    // 基础属性
    variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "info";
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    disabled?: boolean;
    loading?: boolean;
    
    // 图标相关
    icon?: string;
    iconPosition?: "left" | "right";
    iconOnly?: boolean;
    
    // 交互相关
    onclick?: (event: MouseEvent) => void;
    onhover?: (event: MouseEvent) => void;
    onfocus?: (event: FocusEvent) => void;
    
    // 无障碍和提示
    ariaLabel?: string;
    tooltip?: string;
    shortcut?: string;
    
    // 样式相关
    class?: string;
    fullWidth?: boolean;
    rounded?: boolean;
    
    // 高级功能
    href?: string;
    target?: string;
    type?: "button" | "submit" | "reset";
    
    // 内容
    children?: Snippet;
    
    // 支持所有 data-* 属性
    [key: `data-${string}`]: string | undefined;
  }
  
  let {
    variant = "secondary",
    size = "md",
    disabled = false,
    loading = false,
    icon,
    iconPosition = "left",
    iconOnly = false,
    onclick,
    onhover,
    onfocus,
    ariaLabel,
    tooltip,
    shortcut,
    class: className = "",
    fullWidth = false,
    rounded = false,
    href,
    target,
    type = "button",
    children,
    ...restProps
  }: Props = $props();

  const dispatch = createEventDispatcher();

  // 计算CSS类
  let buttonClasses = $derived.by(() => {
    const classes = [
      'weave-btn',
      `weave-btn--${variant}`,
      `weave-btn--${size}`,
    ];
    
    if (loading) classes.push('weave-btn--loading');
    if (disabled) classes.push('weave-btn--disabled');
    if (fullWidth) classes.push('weave-btn--full-width');
    if (rounded) classes.push('weave-btn--rounded');
    if (iconOnly) classes.push('weave-btn--icon-only');
    if (className) classes.push(className);
    
    return classes.join(' ');
  });

  // 处理点击事件
  function handleClick(event: MouseEvent) {
    if (disabled || loading) return;
    onclick?.(event);
    dispatch('click', event);
  }

  // 处理悬停事件
  function handleMouseOver(event: MouseEvent) {
    if (disabled) return;
    onhover?.(event);
    dispatch('hover', event);
  }

  // 处理焦点事件
  function handleFocus(event: FocusEvent) {
    if (disabled) return;
    onfocus?.(event);
    dispatch('focus', event);
  }

  // 计算图标尺寸
  let iconSize = $derived.by(() => {
    switch (size) {
      case 'xs': return 12;
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 18;
      case 'xl': return 20;
      default: return 16;
    }
  });
</script>

<!-- 如果有href，渲染为链接 -->
{#if href}
  <a
    {href}
    {target}
    class={buttonClasses}
    aria-label={ariaLabel}
    title={tooltip}
    onclick={handleClick}
    onmouseover={handleMouseOver}
    onfocus={handleFocus}
    {...restProps}
  >
    {#if loading}
      <EnhancedIcon name="spinner" size={iconSize} animation="spin" />
    {:else if icon && iconPosition === "left"}
      <EnhancedIcon name={icon} size={iconSize} />
    {/if}

    {#if !iconOnly}
      <span class="weave-btn__text">
        {@render children?.()}
      </span>
    {/if}

    {#if icon && iconPosition === "right" && !loading}
      <EnhancedIcon name={icon} size={iconSize} />
    {/if}
    
    {#if shortcut}
      <kbd class="weave-btn__shortcut">{shortcut}</kbd>
    {/if}
  </a>
{:else}
  <!-- 普通按钮 -->
  <button
    {type}
    class={buttonClasses}
    {disabled}
    aria-label={ariaLabel}
    title={tooltip}
    onclick={handleClick}
    onmouseover={handleMouseOver}
    onfocus={handleFocus}
    {...restProps}
  >
    {#if loading}
      <EnhancedIcon name="spinner" size={iconSize} animation="spin" />
    {:else if icon && iconPosition === "left"}
      <EnhancedIcon name={icon} size={iconSize} />
    {/if}

    {#if !iconOnly}
      <span class="weave-btn__text">
        {@render children?.()}
      </span>
    {/if}

    {#if icon && iconPosition === "right" && !loading}
      <EnhancedIcon name={icon} size={iconSize} />
    {/if}
    
    {#if shortcut}
      <kbd class="weave-btn__shortcut">{shortcut}</kbd>
    {/if}
  </button>
{/if}

<style>
  /* 基础按钮样式 */
  .weave-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid transparent;
    border-radius: 8px;
    font-family: var(--font-interface);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    user-select: none;
    min-width: auto;
    width: auto;
    box-sizing: border-box;
  }

  .weave-btn:focus-visible {
    outline: 2px solid var(--weave-accent-color);
    outline-offset: 2px;
  }

  /* 禁用状态 */
  .weave-btn--disabled {
    opacity: 0.6;
    cursor: not-allowed;
    /*  移除 pointer-events: none，改用 JS 逻辑阻止点击 */
    /* 这样可以避免移动端触摸事件被完全忽略的问题 */
  }

  /* 加载状态 */
  .weave-btn--loading {
    cursor: wait;
    /*  移除 pointer-events: none，改用 JS 逻辑阻止点击 */
  }

  /* 全宽 */
  .weave-btn--full-width {
    width: 100%;
  }

  /* 圆角 */
  .weave-btn--rounded {
    border-radius: 9999px;
  }

  /* 仅图标 */
  .weave-btn--icon-only {
    aspect-ratio: 1;
    padding: var(--weave-space-sm);
  }

  /* 尺寸变体 - 优化内边距，内容自适应宽度 */
  .weave-btn--xs {
    font-size: 0.75rem;
    padding: 4px 8px;
    min-height: 1.5rem;
    min-width: auto;
  }

  .weave-btn--sm {
    font-size: 0.875rem;
    padding: 6px 12px;
    min-height: 2rem;
    min-width: auto;
  }

  .weave-btn--md {
    font-size: 0.875rem;
    padding: 8px 16px;
    min-height: 2.25rem;
    min-width: auto;
  }

  .weave-btn--lg {
    font-size: 1rem;
    padding: 10px 20px;
    min-height: 2.75rem;
    min-width: auto;
  }

  .weave-btn--xl {
    font-size: 1.125rem;
    padding: 12px 24px;
    min-height: 3rem;
    min-width: auto;
  }

  /* 仅图标尺寸调整 */
  .weave-btn--icon-only.weave-btn--xs {
    width: 1.5rem;
    height: 1.5rem;
    padding: var(--weave-space-xs);
  }

  .weave-btn--icon-only.weave-btn--sm {
    width: 2rem;
    height: 2rem;
    padding: var(--weave-space-xs);
  }

  .weave-btn--icon-only.weave-btn--md {
    width: 2.25rem;
    height: 2.25rem;
    padding: var(--weave-space-sm);
  }

  .weave-btn--icon-only.weave-btn--lg {
    width: 2.75rem;
    height: 2.75rem;
    padding: var(--weave-space-sm);
  }

  .weave-btn--icon-only.weave-btn--xl {
    width: 3rem;
    height: 3rem;
    padding: var(--weave-space-md);
  }

  /* 颜色变体 */
  .weave-btn--primary {
    background: var(--weave-gradient-primary);
    color: var(--weave-text-on-accent);
    border-color: transparent;
  }

  .weave-btn--primary:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  .weave-btn--secondary {
    background: var(--weave-secondary-bg);
    color: var(--weave-text-primary);
    border-color: var(--weave-border);
  }

  .weave-btn--secondary:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-hover);
    border-color: var(--weave-border-hover);
  }

  .weave-btn--ghost {
    background: transparent;
    color: var(--weave-text-primary);
    border-color: transparent;
  }

  .weave-btn--ghost:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-hover);
  }

  .weave-btn--danger {
    background: var(--weave-error);
    color: var(--weave-text-on-accent);
    border-color: transparent;
  }

  .weave-btn--danger:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-danger-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .weave-btn--success {
    background: var(--weave-success);
    color: var(--weave-text-on-accent);
    border-color: transparent;
  }

  .weave-btn--success:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-success-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .weave-btn--warning {
    background: var(--weave-warning);
    color: var(--weave-text-on-accent);
    border-color: transparent;
  }

  .weave-btn--warning:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-warning-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .weave-btn--info {
    background: var(--weave-info);
    color: var(--weave-text-on-accent);
    border-color: transparent;
  }

  .weave-btn--info:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--weave-info-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  /* 按钮内容 */
  .weave-btn__text {
    line-height: 1;
  }

  /* 快捷键显示 */
  .weave-btn__shortcut {
    font-family: var(--font-monospace, monospace);
    font-size: 0.75em;
    padding: 0.125rem 0.25rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--weave-radius-sm);
    margin-left: var(--weave-space-sm);
    opacity: 0.8;
  }

  /* 活动状态 */
  .weave-btn:active:not(.weave-btn--disabled):not(.weave-btn--loading) {
    transform: translateY(0);
    box-shadow: none;
  }

  .weave-btn.weave-topbar-btn {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  .weave-btn.weave-topbar-btn:hover:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--background-modifier-hover);
    box-shadow: none;
    transform: none;
  }

  .weave-btn.weave-topbar-btn:active:not(.weave-btn--disabled):not(.weave-btn--loading) {
    background: var(--background-modifier-border);
    box-shadow: none;
    transform: none;
  }

  /* 焦点状态增强 */
  .weave-btn:focus-visible {
    outline: 2px solid var(--weave-accent-color);
    outline-offset: 2px;
    z-index: 1;
  }
</style>
