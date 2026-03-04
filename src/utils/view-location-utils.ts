/**
 * 视图位置切换工具
 * 
 * 支持将视图在内容区和侧边栏之间移动
 * 
 * @module utils/view-location-utils
 */

import { WorkspaceLeaf, ItemView, Platform } from 'obsidian';
import { logger } from './logger';

/** 视图位置类型 */
export type ViewLocation = 'center' | 'left' | 'right';

/**
 * 获取当前 leaf 的位置
 */
export function getLeafLocation(leaf: WorkspaceLeaf): ViewLocation {
  const root = leaf.getRoot();
  
  // 检查是否在左侧边栏
  if (root === leaf.view.app.workspace.leftSplit) {
    return 'left';
  }
  
  // 检查是否在右侧边栏
  if (root === leaf.view.app.workspace.rightSplit) {
    return 'right';
  }
  
  // 默认在中心区域
  return 'center';
}

/**
 * 检查视图是否在侧边栏中
 */
export function isInSidebar(leaf: WorkspaceLeaf): boolean {
  const location = getLeafLocation(leaf);
  return location === 'left' || location === 'right';
}

/**
 * 检查视图是否在内容区（中心区域）
 */
export function isInCenter(leaf: WorkspaceLeaf): boolean {
  return getLeafLocation(leaf) === 'center';
}

/**
 * 将视图移动到指定位置
 * 
 * @param view 当前视图实例
 * @param targetLocation 目标位置
 * @param preferredSide 偏好的侧边栏位置（默认右侧）
 * @returns 是否移动成功
 */
export async function moveViewToLocation(
  view: ItemView,
  targetLocation: ViewLocation,
  preferredSide: 'left' | 'right' = 'right'
): Promise<boolean> {
  try {
    const workspace = view.app.workspace;
    await new Promise<void>((resolve) => {
      workspace.onLayoutReady(() => {
        resolve();
      });
    });
    const viewType = view.getViewType();
    const currentState = view.getState();
    const currentLeaf = view.leaf;
    
    logger.debug(`[ViewLocation] 移动视图 ${viewType} 到 ${targetLocation}`);
    
    let newLeaf: WorkspaceLeaf | null = null;
    
    if (targetLocation === 'center') {
      // 移动到内容区（新标签页）
      newLeaf = workspace.getLeaf('tab');
    } else if (targetLocation === 'left') {
      // 移动到左侧边栏
      newLeaf = workspace.getLeftLeaf(false);
    } else if (targetLocation === 'right') {
      // 移动到右侧边栏
      newLeaf = workspace.getRightLeaf(false);
    }
    
    if (!newLeaf) {
      logger.error('[ViewLocation] 无法创建新的 leaf');
      return false;
    }
    
    // 在新位置设置视图状态
    await newLeaf.setViewState({
      type: viewType,
      state: currentState,
      active: true
    });
    
    // 关闭旧的 leaf
    currentLeaf.detach();
    
    // 显示新的 leaf
    workspace.revealLeaf(newLeaf);
    
    logger.debug(`[ViewLocation] ✅ 视图已移动到 ${targetLocation}`);
    return true;
  } catch (error) {
    logger.error('[ViewLocation] 移动视图失败:', error);
    return false;
  }
}

/**
 * 切换视图位置（内容区 ↔ 侧边栏）
 * 
 * @param view 当前视图实例
 * @param preferredSide 偏好的侧边栏位置（默认右侧）
 * @returns 是否切换成功
 */
export async function toggleViewLocation(
  view: ItemView,
  preferredSide: 'left' | 'right' = 'right'
): Promise<boolean> {
  const currentLocation = getLeafLocation(view.leaf);
  
  if (currentLocation === 'center') {
    // 从内容区移动到侧边栏
    return await moveViewToLocation(view, preferredSide, preferredSide);
  } else {
    // 从侧边栏移动到内容区
    return await moveViewToLocation(view, 'center', preferredSide);
  }
}

/**
 * 获取视图位置切换按钮的图标
 * 
 * @param leaf 当前 leaf
 * @returns 图标名称
 */
export function getLocationToggleIcon(leaf: WorkspaceLeaf): string {
  if (isInCenter(leaf)) {
    // 在内容区，显示"移动到侧边栏"图标
    return 'panel-right';
  } else {
    // 在侧边栏，显示"移动到内容区"图标
    return 'layout';
  }
}

/**
 * 获取视图位置切换按钮的提示文本
 * 
 * @param leaf 当前 leaf
 * @returns 提示文本
 */
export function getLocationToggleTooltip(leaf: WorkspaceLeaf): string {
  if (isInCenter(leaf)) {
    return '移动到侧边栏';
  } else {
    return '移动到内容区';
  }
}

/**
 * 为视图添加位置切换按钮
 * 
 * 在视图顶部栏添加一个切换按钮，支持在内容区和侧边栏之间移动
 * 
 * @param view 视图实例
 * @param preferredSide 偏好的侧边栏位置（默认右侧）
 * @returns 按钮元素（可用于后续管理）
 */
export function addLocationToggleAction(
  view: ItemView,
  preferredSide: 'left' | 'right' = 'right'
): HTMLElement | null {
  // 获取初始图标和提示
  const icon = getLocationToggleIcon(view.leaf);
  const tooltip = getLocationToggleTooltip(view.leaf);
  
  // 添加按钮
  const actionEl = view.addAction(icon, tooltip, async () => {
    logger.debug('[ViewLocation] 位置切换按钮被点击');
    await toggleViewLocation(view, preferredSide);
  });
  
  return actionEl;
}
