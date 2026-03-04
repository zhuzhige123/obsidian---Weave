<script lang="ts">
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
import { logger } from '../../utils/logger';

/**
 * SVG遮罩编辑器（Fabric.js替代版本）
 * 
 * 功能：
 * - 纯SVG实现，无外部依赖
 * - 支持拖拽绘制矩形和圆形
 * - 集成MaskStore进行状态管理
 * - 响应式更新
 * 
 * @author Weave Team
 * @date 2025-10-22
 */

import { onMount, tick } from 'svelte';
import MaskShapeV2 from './MaskShapeV2.svelte';
import { createMaskStore } from '../../stores/mask-store';
import { getSVGPoint, isValidMask, isMaskTooSmall, clampMask } from '../../services/image-mask/mask-operations';
import { generateMaskId } from '../../services/image-mask/MaskDataParser';
import type { App, TFile } from 'obsidian';
import type { Mask, MaskData } from '../../types/image-mask-types';
import { MASK_CONSTANTS } from '../../types/image-mask-types';

// Props
let {
  app,
  imageFile,
  initialMaskData = null,
  currentColor = 'rgba(0, 0, 0, 0.7)',
  onMaskDataChange,
  onEditorReady = () => {}
}: {
  app: App;
  imageFile: TFile;
  initialMaskData: MaskData | null;
  currentColor?: string;
  onMaskDataChange: (maskData: MaskData) => void;
  onEditorReady?: (ready: boolean) => void;
} = $props();

// 创建Store实例
const store = createMaskStore(initialMaskData?.masks || []);

//  修复：创建响应式代理，让 store 的关键属性触发重新渲染
let storeMasks = $state<Mask[]>([]);
let storeActiveDrawing = $state<Partial<Mask> | null>(null);
let storeSelectedId = $state<string | null>(null);

//  关键修复：直接同步函数，避免 $effect 无限循环
function syncStoreToState() {
  storeMasks = [...store.masks]; // 创建新数组引用，触发响应式更新
  storeActiveDrawing = store.activeDrawing ? {...store.activeDrawing} : null; // 创建新对象
  storeSelectedId = store.selectedId;
}

// 初始化时同步一次
syncStoreToState();

// SVG和图片状态
let svgElement = $state<SVGSVGElement | null>(null);
let imageUrl = $state<string>('');
let imageWidth = $state(0);
let imageHeight = $state(0);
let loading = $state(true);
let error = $state<string | null>(null);

// 绘制模式
let drawMode = $state<'rect' | 'circle' | null>(null);
let drawStart = $state<{x: number; y: number} | null>(null);

//  节流：避免 mousemove 时过于频繁的同步
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 16; // ~60fps

function throttledSync() {
  const now = Date.now();
  if (now - lastSyncTime >= SYNC_THROTTLE_MS) {
    syncStoreToState();
    lastSyncTime = now;
  }
}

// 拖拽状态（全局管理）
let activeDragMask = $state<string | null>(null);
let dragState = $state<{
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: string | null;
  startPoint: {x: number; y: number} | null;
  startMaskState: Partial<Mask> | null;
} | null>(null);

// 初始化
onMount(async () => {
  try {
    // 加载图片
    imageUrl = app.vault.adapter.getResourcePath(imageFile.path);
    
    const img = new Image();
    img.onload = () => {
      imageWidth = img.width;
      imageHeight = img.height;
      loading = false;
      onEditorReady(true);
    };
    
    img.onerror = () => {
      error = '图片加载失败';
      loading = false;
    };
    
    img.src = imageUrl;
  } catch (err) {
    logger.error('[MaskEditorSVG] 初始化失败:', err);
    error = err instanceof Error ? err.message : '初始化失败';
    loading = false;
  }
});

// 监听Store变化，触发保存
$effect(() => {
  //  依赖响应式的 storeMasks 而不是 store.masks
  const currentMasks = storeMasks;
  
  onMaskDataChange({
    version: MASK_CONSTANTS.CURRENT_VERSION,
    masks: currentMasks
  });
});


// ===== 导出方法（供父组件调用） =====

/**
 * 启用矩形绘制模式
 */
export function enableRectDrawing() {
  drawMode = 'rect';
  store.clearSelection();
  syncStoreToState();  //  同步状态
  logger.debug('[MaskEditorSVG] 启用矩形绘制模式');
}

/**
 * 启用圆形绘制模式
 */
export function enableCircleDrawing() {
  drawMode = 'circle';
  store.clearSelection();
  syncStoreToState();  //  同步状态
  logger.debug('[MaskEditorSVG] 启用圆形绘制模式');
}

/**
 * 删除选中的遮罩
 */
export function deleteSelectedMask() {
  if (store.selectedId) {
    store.deleteMask(store.selectedId);
    syncStoreToState();  //  同步状态
    logger.debug('[MaskEditorSVG] 删除选中遮罩');
  }
}

/**
 * 更新选中遮罩的颜色
 */
export function updateSelectedMaskColor(newColor: string) {
  if (store.selectedId) {
    store.updateMask(store.selectedId, { fill: newColor });
    syncStoreToState();  //  同步状态
    logger.debug('[MaskEditorSVG] 更新遮罩颜色:', newColor);
  }
}

/**
 * 获取当前遮罩数据
 */
export function getMaskData(): MaskData {
  return {
    version: MASK_CONSTANTS.CURRENT_VERSION,
    masks: store.masks
  };
}

/**
 * 撤销
 */
export function undo() {
  store.undo();
}

/**
 * 重做
 */
export function redo() {
  store.redo();
}

// 模块级灵敏度状态（避免使用 window 全局变量）
let _maskEditorSensitivity = 1.0;
export function getMaskEditorSensitivity(): number {
  return _maskEditorSensitivity;
}

/**
 * 更新灵敏度（由设置菜单调用）
 */
export function updateSensitivity(value: number) {
  _maskEditorSensitivity = value;
  logger.debug('[MaskEditorSVG] 更新灵敏度:', value);
}

/**
 * 更新图片显示模式
 */
export function updateImageDisplayMode(mode: 'fit' | 'fill' | 'original') {
  // 更新SVG和image元素的preserveAspectRatio属性
  const svg = svgElement;
  if (svg) {
    let aspectRatio: string;
    if (mode === 'fit') {
      aspectRatio = 'xMidYMid meet';
    } else if (mode === 'fill') {
      aspectRatio = 'xMidYMid slice';
    } else if (mode === 'original') {
      aspectRatio = 'none';
    } else {
      aspectRatio = 'xMidYMid meet';
    }
    
    // 同时更新SVG容器和image元素
    svg.setAttribute('preserveAspectRatio', aspectRatio);
    const imageElement = svg.querySelector('image');
    if (imageElement) {
      imageElement.setAttribute('preserveAspectRatio', aspectRatio);
    }
  }
  logger.debug('[MaskEditorSVG] 更新图片显示模式:', mode);
}

/**
 * 更新网格可见性
 */
export function updateGridVisibility(visible: boolean) {
  // TODO: 实现网格显示功能
  logger.debug('[MaskEditorSVG] 更新网格可见性:', visible);
}

/**
 * 更新网格大小
 */
export function updateGridSize(size: number) {
  // TODO: 实现网格大小调整
  logger.debug('[MaskEditorSVG] 更新网格大小:', size);
}

/**
 * 更新吸附网格设置
 */
export function updateSnapToGrid(snap: boolean) {
  // TODO: 实现网格吸附功能
  logger.debug('[MaskEditorSVG] 更新网格吸附:', snap);
}

// ===== SVG事件处理 =====

/**
 * SVG鼠标按下 - 开始绘制
 */
function handleSvgMouseDown(e: MouseEvent) {
  //  Svelte 5: SVG 绘制需要精确的事件控制
  // 使用事件委托兼容的方式处理
  // 不使用 stopPropagation，让事件自然冒泡
  
  if (!drawMode) {
    logger.warn('[MaskEditorSVG] drawMode 为空，无法开始绘制');
    return;
  }
  
  if (!svgElement) {
    logger.warn('[MaskEditorSVG] svgElement 为空，无法开始绘制');
    return;
  }
  
  // 取消之前的选中
  store.clearSelection();
  syncStoreToState();  //  同步状态
  
  const point = getSVGPoint(e, svgElement);
  
  drawStart = point;
  
  // 创建临时绘制对象
  store.activeDrawing = {
    id: generateMaskId(),
    type: drawMode,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    radius: 0,
    fill: currentColor,
    style: 'solid'
  };
  
  //  修复：同步状态
  syncStoreToState();
  
  logger.debug('[MaskEditorSVG] 开始绘制:', drawMode);
}

/**
 * SVG鼠标移动 - 动态更新绘制
 */
function handleSvgMouseMove(e: MouseEvent) {
  //  Svelte 5: 移动事件不需要阻止冒泡
  // SVG 内部的事件处理不会影响外部
  
  if (!svgElement) return;
  
  const point = getSVGPoint(e, svgElement);
  
  // 处理绘制
  if (store.activeDrawing && drawStart) {
    updateActiveDrawing(point);
  }
  
  // 处理拖拽/缩放（由MaskShape触发，这里只是预留）
  // 实际的拖拽逻辑在MaskShape内部处理
}

/**
 * SVG鼠标松开 - 完成绘制
 */
function handleSvgMouseUp(e: MouseEvent) {
  //  Svelte 5: 移动事件不需要阻止冒泡
  // SVG 内部的事件处理不会影响外部
  
  // 完成绘制
  if (store.activeDrawing) {
    finishDrawing();
  }
}

/**
 * 更新正在绘制的遮罩
 */
function updateActiveDrawing(point: {x: number; y: number}) {
  if (!store.activeDrawing || !drawStart) return;
  
  if (store.activeDrawing.type === 'rect') {
    // 矩形绘制（支持反向拖拽）
    const left = Math.min(point.x, drawStart.x);
    const top = Math.min(point.y, drawStart.y);
    const width = Math.abs(point.x - drawStart.x);
    const height = Math.abs(point.y - drawStart.y);
    
    //  直接修改对象属性，然后触发一次更新
    store.activeDrawing.x = left;
    store.activeDrawing.y = top;
    store.activeDrawing.width = width;
    store.activeDrawing.height = height;
    
    //  节流同步（避免过于频繁）
    throttledSync();
  } else if (store.activeDrawing.type === 'circle') {
    // 圆形绘制（从中心向外）
    const dx = point.x - drawStart.x;
    const dy = point.y - drawStart.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    
    //  直接修改对象属性
    store.activeDrawing.x = drawStart.x;
    store.activeDrawing.y = drawStart.y;
    store.activeDrawing.radius = radius;
    
    //  节流同步（避免过于频繁）
    throttledSync();
  }
}

/**
 * 完成绘制
 */
function finishDrawing() {
  if (!store.activeDrawing) {
    logger.warn('[MaskEditorSVG] activeDrawing 为空，无法完成绘制');
    return;
  }
  
  // 验证遮罩
  if (!isValidMask(store.activeDrawing)) {
    logger.warn('[MaskEditorSVG] 无效的遮罩，取消绘制');
    store.activeDrawing = null;
    syncStoreToState();  //  同步状态
    drawStart = null;
    //  修复：不清空 drawMode，允许连续绘制
    // drawMode = null;
    return;
  }
  
  // 检查尺寸
  if (isMaskTooSmall(store.activeDrawing as Mask, 0.01)) {
    logger.warn('[MaskEditorSVG] 遮罩太小，取消绘制');
    store.activeDrawing = null;
    syncStoreToState();  //  同步状态
    drawStart = null;
    //  修复：不清空 drawMode，允许连续绘制
    // drawMode = null;
    return;
  }
  
  // 限制在边界内
  const clampedMask = clampMask(store.activeDrawing as Mask);
  
  // 添加到Store
  store.addMask(clampedMask);
  
  // 清理状态
  store.activeDrawing = null;
  syncStoreToState();  //  同步状态
  drawStart = null;
  //  修复：不清空 drawMode，允许连续绘制多个遮罩
  // drawMode = null;
  
  logger.debug('[MaskEditorSVG] 绘制完成');
}

/**
 * 处理遮罩更新
 */
function handleMaskUpdate(id: string, updates: Partial<Mask>) {
  store.updateMask(id, updates);
  syncStoreToState();  //  同步状态
}

/**
 * 处理遮罩选中
 */
function handleMaskSelect(id: string) {
  store.selectMask(id);
  syncStoreToState();  //  同步状态
  drawMode = null; // 取消绘制模式
}

/**
 * 处理遮罩删除
 */
async function handleMaskDelete(id: string) {
    const confirmed = await showObsidianConfirm(app, '确定要删除这个遮罩吗？', { title: '确认删除' });
    if (confirmed) {
      store.deleteMask(id);
      syncStoreToState();  //  同步状态
    }
  }

/**
 * SVG点击 - 取消选中
 *  优化：只处理真正的点击，不处理拖拽后的click
 */
function handleSvgClick(e: MouseEvent) {
  // Svelte 5: 点击事件通过目标判断处理
  // 不需要 stopPropagation
  
  //  修复：如果刚刚完成绘制，不处理这个click（它是拖拽的副作用）
  if (store.activeDrawing || drawStart) {
    return;
  }
  
  // 如果点击的是SVG背景（不是遮罩），取消选中
  if (e.target === svgElement || (e.target as Element).tagName === 'image') {
    store.clearSelection();
    syncStoreToState();  //  同步状态
    // 注意：不再清空 drawMode，让用户手动退出绘制模式（按Escape）
  }
}
</script>

<div class="mask-editor-svg-container">
  {#if loading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>加载图片中...</p>
    </div>
  {:else if error}
    <div class="error-overlay">
      <div class="error-icon">[X]</div>
      <p>{error}</p>
    </div>
  {:else}
    <div
      class="mask-editor-canvas"
      role="application"
      tabindex="0"
      onmousedown={handleSvgMouseDown}
      onmousemove={handleSvgMouseMove}
      onmouseup={handleSvgMouseUp}
      onclick={handleSvgClick}
      onkeydown={(e) => {
        if (false) {
          e.preventDefault();
          store.clearSelection();
          syncStoreToState();
          drawMode = null;
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedId) {
          e.preventDefault();
          handleMaskDelete(store.selectedId);
        }
      }}
      ondragstart={(e) => { e.preventDefault(); }}
      oncontextmenu={(e) => { e.preventDefault(); }}
      class:drawing={!!drawMode}
      class:has-active={!!storeActiveDrawing}
    >
    <svg
      bind:this={svgElement}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      class="mask-editor-svg"
    >
      
      <!-- 背景图片 -->
      <!--  修复：使用 preserveAspectRatio="none" 让图片填满 viewBox -->
      <!-- 这样遮罩坐标直接对应图片内容，预览时也能正确对齐 -->
      <image
        href={imageUrl}
        x="0"
        y="0"
        width="100"
        height="100"
        preserveAspectRatio="none"
        pointer-events="none"
        style="image-rendering: crisp-edges;"
      />
      
      <!-- 所有已创建的遮罩 -->
      {#each storeMasks as mask (mask.id)}
        <MaskShapeV2
          {mask}
          editable={true}
          selected={mask.id === storeSelectedId}
          onUpdate={(updates) => handleMaskUpdate(mask.id, updates)}
          onSelect={() => handleMaskSelect(mask.id)}
          onDelete={() => handleMaskDelete(mask.id)}
        />
      {/each}
      
      <!-- 正在绘制的临时遮罩 -->
      {#if storeActiveDrawing && !isMaskTooSmall(storeActiveDrawing as Mask)}
        <MaskShapeV2
          mask={storeActiveDrawing as Mask}
          editable={false}
          selected={false}
        />
      {/if}
    </svg>
    </div>
    
    <!-- 提示信息 -->
    <div class="hint">
      {#if drawMode}
        💡 在图片上拖拽绘制{drawMode === 'rect' ? '矩形' : '圆形'}遮罩
      {:else if store.selectedId}
        💡 拖拽移动，控制点调整大小，双击删除，Delete键删除
      {:else}
        💡 选择工具开始绘制，或点击遮罩进行编辑
      {/if}
    </div>
  {/if}
</div>

<style>
  .mask-editor-svg-container {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
  }
  
  .mask-editor-canvas {
    flex: 1;
    width: 100%;
    background: var(--background-secondary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: default;
    outline: none;
  }
  
  .mask-editor-canvas.drawing {
    cursor: crosshair;
  }
  
  .mask-editor-canvas.has-active {
    user-select: none;
  }

  .mask-editor-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  
  .loading-overlay, .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--background-primary);
    z-index: 10;
    gap: 12px;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error-icon {
    font-size: 48px;
  }
  
  .error-overlay p {
    color: var(--text-error);
    font-size: 14px;
  }
  
  .hint {
    padding: 10px 16px;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    transition: all 0.2s ease;
  }
  
  .hint:hover {
    background: var(--background-modifier-hover);
  }
  
</style>

