<script lang="ts">
/**
 * 单个遮罩形状组件 V2 - 使用Pointer Capture API
 * 
 * 核心改进：
 * - 使用setPointerCapture锁定鼠标事件
 * - 避免全局document事件监听
 * - 防止鼠标移出窗口时的异常行为
 * 
 * @author Weave Team
 * @date 2025-12-13
 */

import { parseRGBAColor, getRectResizeHandles, getCircleResizeHandles } from '../../services/image-mask/mask-operations';
import type { Mask } from '../../types/image-mask-types';

// Props
let {
  mask,
  editable = false,
  selected = false,
  onUpdate,
  onSelect,
  onDelete
}: {
  mask: Mask;
  editable?: boolean;
  selected?: boolean;
  onUpdate?: (updates: Partial<Mask>) => void;
  onSelect?: () => void;
  onDelete?: () => void;
} = $props();

// 内部状态
let isDragging = $state(false);
let isResizing = $state(false);
let resizeHandle = $state<string | null>(null);
let dragStart = $state<{x: number; y: number; maskX: number; maskY: number; maskRadius?: number; maskWidth?: number; maskHeight?: number} | null>(null);

// 元素引用
let shapeElement: SVGElement | null = null;
let activePointerId: number | null = null;

// 样式计算
let shapeStyle = $derived(() => {
  const { rgb, opacity } = parseRGBAColor(mask.fill || 'rgba(0, 0, 0, 0.7)');
  return {
    fill: rgb,
    'fill-opacity': opacity.toString(),
    stroke: selected ? 'var(--interactive-accent)' : 'transparent',
    'stroke-width': selected ? '0.5' : '0'
  };
});

// 控制点计算
let resizeHandles = $derived(() => {
  if (!selected || !editable) return [];
  
  if (mask.type === 'rect') {
    return getRectResizeHandles(mask);
  } else if (mask.type === 'circle') {
    return getCircleResizeHandles(mask);
  }
  
  return [];
});

// ===== 坐标转换 =====

/**
 * 获取SVG坐标（归一化到0-1）
 */
function getSVGPoint(e: PointerEvent): {x: number; y: number} {
  if (!shapeElement) return {x: 0, y: 0};
  
  const svg = shapeElement.ownerSVGElement;
  if (!svg) return {x: 0, y: 0};
  
  try {
    const ctm = svg.getScreenCTM();
    if (!ctm) return {x: 0, y: 0};
    
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    
    const svgPoint = point.matrixTransform(ctm.inverse());
    // 归一化到0-1（viewBox是0-100）
    return { x: svgPoint.x / 100, y: svgPoint.y / 100 };
    
  } catch (error) {
    return {x: 0, y: 0};
  }
}

// ===== Pointer事件处理 =====

/**
 * Pointer按下 - 开始拖拽
 */
function handlePointerDown(e: PointerEvent) {
  if (!editable) return;
  
  // Svelte 5: 拖拽开始只需要 preventDefault
  e.preventDefault();
  
  // 选中遮罩
  onSelect?.();
  
  // 获取元素引用
  shapeElement = e.currentTarget as SVGElement;
  if (!shapeElement) return;
  
  // 捕获指针 - 关键！
  activePointerId = e.pointerId;
  shapeElement.setPointerCapture(e.pointerId);
  
  // 开始拖拽
  const svgPoint = getSVGPoint(e);
  isDragging = true;
  dragStart = {
    x: svgPoint.x,
    y: svgPoint.y,
    maskX: mask.x,
    maskY: mask.y
  };
}

/**
 * 控制点Pointer按下 - 开始缩放
 */
function handleHandlePointerDown(e: PointerEvent, handleType: string) {
  if (!editable) return;
  
  // Svelte 5: 调整手柄只需要 preventDefault
  e.preventDefault();
  
  // 选中遮罩
  onSelect?.();
  
  // 获取元素引用
  const target = e.currentTarget as SVGElement;
  if (!target) return;
  
  // 捕获指针
  activePointerId = e.pointerId;
  target.setPointerCapture(e.pointerId);
  
  // 开始缩放
  const svgPoint = getSVGPoint(e);
  isResizing = true;
  resizeHandle = handleType;
  dragStart = {
    x: svgPoint.x,
    y: svgPoint.y,
    maskX: mask.x,
    maskY: mask.y,
    maskRadius: mask.radius, // 保存原始半径（圆形缩放用）
    maskWidth: mask.width,   // 🔧 修复：保存原始宽度（矩形缩放用）
    maskHeight: mask.height  // 🔧 修复：保存原始高度（矩形缩放用）
  };
}

/**
 * Pointer移动 - 处理拖拽和缩放
 */
function handlePointerMove(e: PointerEvent) {
  // 只处理捕获的指针
  if (e.pointerId !== activePointerId) return;
  if (!isDragging && !isResizing) return;
  
  // Svelte 5: 拖拽移动只需要 preventDefault
  e.preventDefault();
  
  const svgPoint = getSVGPoint(e);
  
  if (isDragging) {
    handleDrag(svgPoint);
  } else if (isResizing) {
    if (mask.type === 'rect') {
      handleRectResize(svgPoint);
    } else if (mask.type === 'circle') {
      handleCircleResize(svgPoint);
    }
  }
}

/**
 * Pointer松开 - 结束拖拽或缩放
 */
function handlePointerUp(e: PointerEvent) {
  // 只处理捕获的指针
  if (e.pointerId !== activePointerId) return;
  
  // Svelte 5: 拖拽结束只需要 preventDefault
  e.preventDefault();
  
  // 释放指针捕获
  if (e.currentTarget) {
    const target = e.currentTarget as SVGElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch (err) {
      // 忽略释放错误
    }
  }
  
  // 重置状态
  isDragging = false;
  isResizing = false;
  resizeHandle = null;
  dragStart = null;
  activePointerId = null;
}

/**
 * Pointer取消 - 处理异常情况
 */
function handlePointerCancel(e: PointerEvent) {
  handlePointerUp(e);
}

/**
 * 双击 - 删除遮罩
 */
function handleDoubleClick(e: MouseEvent) {
  if (!editable) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  // 双击删除遮罩
  onDelete?.();
}

// ===== 拖拽和缩放逻辑 =====

/**
 * 拖拽遮罩
 */
function handleDrag(newPoint: {x: number; y: number}) {
  if (!dragStart) return;
  
  const dx = newPoint.x - dragStart.x;
  const dy = newPoint.y - dragStart.y;
  
  let newX = dragStart.maskX + dx;
  let newY = dragStart.maskY + dy;
  
  // 边界限制
  let minX = 0;
  let minY = 0;
  let maxX = 1;
  let maxY = 1;
  
  if (mask.type === 'rect') {
    maxX = 1 - (mask.width || 0);
    maxY = 1 - (mask.height || 0);
  } else if (mask.type === 'circle') {
    const r = mask.radius || 0;
    minX = r;
    minY = r;
    maxX = 1 - r;
    maxY = 1 - r;
  }
  
  newX = Math.max(minX, Math.min(maxX, newX));
  newY = Math.max(minY, Math.min(maxY, newY));
  
  onUpdate?.({
    x: newX,
    y: newY
  });
}

/**
 * 矩形缩放
 */
function handleRectResize(newPoint: {x: number; y: number}) {
  if (!dragStart) return;
  
  const { maskX: origX, maskY: origY } = dragStart;
  // 🔧 修复：使用 dragStart 保存的原始尺寸，而不是当前 mask 的尺寸
  // 这样可以避免累积计算导致的灵敏度过高问题
  const origWidth = dragStart.maskWidth || 0;
  const origHeight = dragStart.maskHeight || 0;
  
  // 🔧 降低灵敏度：添加缩放因子（从全局设置获取）
  const SENSITIVITY = (window as any).__maskEditorSensitivity || 0.08; // 默认8%
  const dx = (newPoint.x - dragStart.x) * SENSITIVITY;
  const dy = (newPoint.y - dragStart.y) * SENSITIVITY;
  
  let newX = origX;
  let newY = origY;
  let newWidth = origWidth;
  let newHeight = origHeight;
  
  // 根据控制点计算新尺寸
  switch (resizeHandle) {
    case 'top-left':
      newX = origX + dx;
      newY = origY + dy;
      newWidth = origWidth - dx;
      newHeight = origHeight - dy;
      break;
    case 'top-center':
      newY = origY + dy;
      newHeight = origHeight - dy;
      break;
    case 'top-right':
      newY = origY + dy;
      newWidth = origWidth + dx;
      newHeight = origHeight - dy;
      break;
    case 'middle-left':
      newX = origX + dx;
      newWidth = origWidth - dx;
      break;
    case 'middle-right':
      newWidth = origWidth + dx;
      break;
    case 'bottom-left':
      newX = origX + dx;
      newWidth = origWidth - dx;
      newHeight = origHeight + dy;
      break;
    case 'bottom-center':
      newHeight = origHeight + dy;
      break;
    case 'bottom-right':
      newWidth = origWidth + dx;
      newHeight = origHeight + dy;
      break;
  }
  
  // 边界限制
  const minSize = 0.01;
  newX = Math.max(0, Math.min(1 - minSize, newX));
  newY = Math.max(0, Math.min(1 - minSize, newY));
  newWidth = Math.max(minSize, Math.min(1 - newX, newWidth));
  newHeight = Math.max(minSize, Math.min(1 - newY, newHeight));
  
  if (newWidth < minSize || newHeight < minSize) {
    return;
  }
  
  onUpdate?.({
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight
  });
}

/**
 * 圆形缩放
 */
function handleCircleResize(newPoint: {x: number; y: number}) {
  if (!dragStart) return;
  
  // 🔧 使用相对变化而非绝对距离
  const originalRadius = dragStart.maskRadius || mask.radius || 0;
  const dx = newPoint.x - dragStart.x;
  const dy = newPoint.y - dragStart.y;
  
  // 🔧 修复：使用与矩形相同的灵敏度计算方式（单轴最大偏移量）
  // 而不是欧几里得距离，确保矩形和圆形灵敏度一致
  const maxDelta = Math.max(Math.abs(dx), Math.abs(dy));
  const sign = (dx + dy) > 0 ? 1 : -1; // 判断是放大还是缩小
  
  // 降低灵敏度（从全局设置获取）
  const SENSITIVITY = (window as any).__maskEditorSensitivity || 0.08; // 默认8%
  const newRadius = originalRadius + (maxDelta * sign * SENSITIVITY);
  
  const minRadius = 0.01;
  const maxRadius = Math.min(
    mask.x,
    mask.y,
    1 - mask.x,
    1 - mask.y
  );
  
  const clampedRadius = Math.max(minRadius, Math.min(maxRadius, newRadius));
  
  if (clampedRadius >= minRadius) {
    onUpdate?.({
      radius: clampedRadius
    });
  }
}

/**
 * 获取光标样式
 */
function getCursorForHandle(handleType: string): string {
  const cursorMap: Record<string, string> = {
    'top-left': 'nwse-resize',
    'top-center': 'ns-resize',
    'top-right': 'nesw-resize',
    'middle-left': 'ew-resize',
    'middle-right': 'ew-resize',
    'bottom-left': 'nesw-resize',
    'bottom-center': 'ns-resize',
    'bottom-right': 'nwse-resize',
    'top': 'ns-resize',
    'right': 'ew-resize',
    'bottom': 'ns-resize',
    'left': 'ew-resize'
  };
  
  return cursorMap[handleType] || 'default';
}
</script>

<!-- 渲染遮罩形状 -->
{#if mask.type === 'rect'}
  <rect
    bind:this={shapeElement}
    x={mask.x * 100}
    y={mask.y * 100}
    width={(mask.width || 0) * 100}
    height={(mask.height || 0) * 100}
    fill={shapeStyle().fill}
    fill-opacity={shapeStyle()['fill-opacity']}
    stroke={shapeStyle().stroke}
    stroke-width={shapeStyle()['stroke-width']}
    class="mask-shape"
    class:editable
    class:selected
    class:dragging={isDragging}
    style:cursor={editable ? (isDragging ? 'move' : 'pointer') : 'default'}
    style:touch-action="none"
    role="button"
    tabindex="0"
    aria-label="遮罩区域"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
    ondblclick={handleDoubleClick}
  />
{:else if mask.type === 'circle'}
  <circle
    bind:this={shapeElement}
    cx={mask.x * 100}
    cy={mask.y * 100}
    r={(mask.radius || 0) * 100}
    fill={shapeStyle().fill}
    fill-opacity={shapeStyle()['fill-opacity']}
    stroke={shapeStyle().stroke}
    stroke-width={shapeStyle()['stroke-width']}
    class="mask-shape"
    class:editable
    class:selected
    class:dragging={isDragging}
    style:cursor={editable ? (isDragging ? 'move' : 'pointer') : 'default'}
    style:touch-action="none"
    role="button"
    tabindex="0"
    aria-label="遮罩区域"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
    ondblclick={handleDoubleClick}
  />
{/if}

<!-- 角标式编号（左上角） -->
{#if mask.index}
  {@const badgeX = mask.type === 'rect' 
    ? mask.x * 100 + 1.5
    : (mask.x - (mask.radius || 0)) * 100 + 1.5}
  {@const badgeY = mask.type === 'rect' 
    ? mask.y * 100 + 1.5
    : (mask.y - (mask.radius || 0)) * 100 + 1.5}
  <g class="mask-badge" pointer-events="none">
    <!-- 徽章背景 -->
    <rect
      x={badgeX - 1.2}
      y={badgeY - 1.2}
      width="2.4"
      height="2.4"
      rx="0.4"
      fill="rgba(0, 0, 0, 0.75)"
    />
    <!-- 编号文字 -->
    <text
      x={badgeX}
      y={badgeY}
      class="mask-badge-text"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {mask.index}
    </text>
  </g>
{/if}


<!-- 控制点 -->
{#if selected && editable}
  <g class="resize-handles">
    {#each resizeHandles() as handle}
      <circle
        cx={handle.x * 100}
        cy={handle.y * 100}
        r="1.5"
        class="resize-handle"
        style:cursor={getCursorForHandle(handle.type)}
        style:touch-action="none"
        role="button"
        tabindex="0"
        aria-label="调整大小控制点"
        onpointerdown={(e) => handleHandlePointerDown(e, handle.type)}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerCancel}
      />
    {/each}
  </g>
{/if}

<style>
  .mask-shape {
    transition: stroke 0.2s ease;
    /* 防止触摸设备的默认行为 */
    touch-action: none;
    /* 提升性能 */
    will-change: transform;
  }
  
  .mask-shape.editable:not(.dragging):hover {
    stroke: var(--interactive-accent);
    stroke-width: 0.3;
    stroke-opacity: 0.5;
  }
  
  .mask-shape.selected {
    stroke: var(--interactive-accent) !important;
    stroke-width: 0.5 !important;
  }
  
  .mask-shape.dragging {
    opacity: 0.8;
  }
  
  .resize-handle {
    fill: var(--interactive-accent);
    stroke: var(--background-primary);
    stroke-width: 0.3;
    cursor: pointer;
    transition: all 0.2s ease;
    /* 防止触摸设备的默认行为 */
    touch-action: none;
  }
  
  .resize-handle:hover {
    fill: var(--interactive-accent-hover);
    stroke-width: 0.5;
    /* 🔧 移除transform防止跳动 */
    /* transform: scale(1.2); */
    /* 使用stroke-width增加视觉反馈 */
    r: 2; /* 直接增大半径而不是缩放 */
  }
  
  /* 角标徽章样式 */
  .mask-badge-text {
    font-size: 1.6px;
    font-weight: 600;
    fill: white;
    user-select: none;
  }
</style>
