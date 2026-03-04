import { logger } from '../utils/logger';
/**
 * 遮罩数据中心化Store
 * 
 * 功能：
 * - 管理所有遮罩数据（单一数据源）
 * - 处理遮罩CRUD操作
 * - 管理选中状态
 * - 支持撤销/重做功能
 * - 修复：使用普通TypeScript（不使用Svelte runes）
 * 
 * @author Weave Team
 * @date 2025-10-22
 */

import { generateMaskId } from '../services/image-mask/MaskDataParser';
import type { Mask } from '../types/image-mask-types';

/**
 * 历史记录类型
 */
interface MaskHistory {
  past: Mask[][];
  future: Mask[][];
}

/**
 * 遮罩Store类
 * 修复：使用普通TypeScript而不是Svelte runes（$state只能在.svelte文件中使用）
 */
export class MaskStore {
  // ===== 核心状态 =====
  
  /** 所有遮罩数据（单一数据源） */
  masks: Mask[] = [];
  
  /** 当前选中的遮罩ID */
  selectedId: string | null = null;
  
  /** 正在绘制的临时遮罩 */
  activeDrawing: Partial<Mask> | null = null;
  
  /** 历史记录（用于撤销/重做） */
  private history: MaskHistory = {
    past: [],
    future: []
  };
  
  // ===== 构造函数 =====
  
  constructor(initialMasks: Mask[] = []) {
    this.masks = [...initialMasks];
    // 确保历史记录被正确初始化
    this.history = {
      past: [],
      future: []
    };
  }
  
  // ===== 派生状态（使用getter） =====
  
  /** 当前选中的遮罩对象 */
  get selectedMask(): Mask | null {
    return this.masks.find(m => m.id === this.selectedId) ?? null;
  }
  
  /** 遮罩总数 */
  get maskCount(): number {
    return this.masks.length;
  }
  
  /** 是否有选中的遮罩 */
  get hasSelection(): boolean {
    return this.selectedId !== null;
  }
  
  /** 是否可以撤销 */
  get canUndo(): boolean {
    return this.history.past.length > 0;
  }
  
  /** 是否可以重做 */
  get canRedo(): boolean {
    return this.history.future.length > 0;
  }
  
  // ===== CRUD 操作 =====
  
  /**
   * 添加遮罩（自动分配编号）
   */
  addMask(mask: Mask): void {
    this.saveHistory();
    //  自动分配编号：取当前最大编号 + 1
    const maxIndex = this.masks.reduce((max, m) => Math.max(max, m.index || 0), 0);
    const maskWithIndex = { ...mask, index: maxIndex + 1 };
    this.masks = [...this.masks, maskWithIndex];
    this.selectedId = mask.id;
    logger.debug('[MaskStore] 添加遮罩:', mask.id, '编号:', maskWithIndex.index);
  }
  
  /**
   * 批量添加遮罩
   */
  addMasks(masks: Mask[]): void {
    if (masks.length === 0) return;
    this.saveHistory();
    this.masks = [...this.masks, ...masks];
    logger.debug('[MaskStore] 批量添加遮罩:', masks.length);
  }
  
  /**
   * 更新遮罩
   */
  updateMask(id: string, updates: Partial<Mask>): void {
    const index = this.masks.findIndex(m => m.id === id);
    if (index === -1) {
      logger.warn('[MaskStore] 未找到遮罩:', id);
      return;
    }
    
    this.saveHistory();
    const updatedMasks = [...this.masks];
    updatedMasks[index] = {
      ...updatedMasks[index],
      ...updates
    };
    this.masks = updatedMasks;
    logger.debug('[MaskStore] 更新遮罩:', id);
  }
  
  /**
   * 删除遮罩
   */
  deleteMask(id: string): void {
    const index = this.masks.findIndex(m => m.id === id);
    if (index === -1) {
      logger.warn('[MaskStore] 未找到遮罩:', id);
      return;
    }
    
    this.saveHistory();
    this.masks = this.masks.filter(m => m.id !== id);
    
    // 如果删除的是选中的遮罩，清除选中状态
    if (this.selectedId === id) {
      this.selectedId = null;
    }
    
    logger.debug('[MaskStore] 删除遮罩:', id);
  }
  
  /**
   * 删除所有遮罩
   */
  clearAll(): void {
    if (this.masks.length === 0) return;
    
    this.saveHistory();
    this.masks = [];
    this.selectedId = null;
    logger.debug('[MaskStore] 清空所有遮罩');
  }
  
  /**
   * 获取遮罩
   */
  getMask(id: string): Mask | null {
    return this.masks.find(m => m.id === id) ?? null;
  }
  
  /**
   * 替换所有遮罩
   */
  setMasks(masks: Mask[]): void {
    this.masks = [...masks];
    this.selectedId = null;
    // 不记录历史，用于加载初始数据
  }
  
  // ===== 选择操作 =====
  
  /**
   * 选中遮罩
   */
  selectMask(id: string | null): void {
    this.selectedId = id;
    logger.debug('[MaskStore] 选中遮罩:', id);
  }
  
  /**
   * 取消选中
   */
  clearSelection(): void {
    this.selectedId = null;
    logger.debug('[MaskStore] 取消选中');
  }
  
  /**
   * 选择下一个遮罩
   */
  selectNext(): void {
    if (this.masks.length === 0) return;
    
    const currentIndex = this.masks.findIndex(m => m.id === this.selectedId);
    const nextIndex = (currentIndex + 1) % this.masks.length;
    this.selectedId = this.masks[nextIndex].id;
  }
  
  /**
   * 选择上一个遮罩
   */
  selectPrevious(): void {
    if (this.masks.length === 0) return;
    
    const currentIndex = this.masks.findIndex(m => m.id === this.selectedId);
    const prevIndex = currentIndex <= 0 ? this.masks.length - 1 : currentIndex - 1;
    this.selectedId = this.masks[prevIndex].id;
  }
  
  // ===== 历史记录操作 =====
  
  /**
   * 保存当前状态到历史记录
   */
  private saveHistory(): void {
    // 确保历史记录对象存在
    if (!this.history) {
      this.history = {
        past: [],
        future: []
      };
    }
    
    // 保存当前状态到过去
    const newPast = [...this.history.past, [...this.masks]];
    
    // 限制历史记录数量（最多50步）
    const limitedPast = newPast.length > 50 ? newPast.slice(-50) : newPast;
    
    // 使用不可变更新
    this.history = {
      past: limitedPast,
      future: [] // 新操作会覆盖重做历史
    };
  }
  
  /**
   * 撤销操作
   */
  undo(): void {
    if (!this.canUndo) return;
    
    // 检查历史记录是否存在
    if (!this.history || !this.history.past || this.history.past.length === 0) {
      logger.warn('[MaskStore] 撤销失败：历史记录为空');
      return;
    }
    
    // 保存当前状态到未来
    this.history = {
      ...this.history,
      future: [[...this.masks], ...this.history.future]
    };
    
    // 恢复过去的状态
    const past = [...this.history.past];
    const previousState = past.pop();
    
    if (previousState) {
      this.history = {
        ...this.history,
        past: past
      };
      this.masks = [...previousState];
      this.selectedId = null;
      logger.debug('[MaskStore] 撤销操作');
    }
  }
  
  /**
   * 重做操作
   */
  redo(): void {
    if (!this.canRedo) return;
    
    // 检查历史记录是否存在
    if (!this.history || !this.history.future || this.history.future.length === 0) {
      logger.warn('[MaskStore] 重做失败：未来记录为空');
      return;
    }
    
    // 保存当前状态到过去
    this.history = {
      ...this.history,
      past: [...this.history.past, [...this.masks]]
    };
    
    // 恢复未来的状态
    const future = [...this.history.future];
    const nextState = future.shift();
    
    if (nextState) {
      this.history = {
        ...this.history,
        future: future
      };
      this.masks = [...nextState];
      this.selectedId = null;
      logger.debug('[MaskStore] 重做操作');
    }
  }
  
  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = {
      past: [],
      future: []
    };
  }
  
  // ===== 高级操作 =====
  
  /**
   * 复制选中的遮罩
   */
  duplicateSelected(): Mask | null {
    if (!this.selectedMask) return null;
    
    const duplicated: Mask = {
      ...this.selectedMask,
      id: generateMaskId(),
      // 稍微偏移位置，避免完全重叠
      x: Math.min(this.selectedMask.x + 0.02, 0.98),
      y: Math.min(this.selectedMask.y + 0.02, 0.98)
    };
    
    this.addMask(duplicated);
    return duplicated;
  }
  
  /**
   * 移动遮罩到指定位置（在列表中）
   */
  moveMask(id: string, newIndex: number): void {
    const currentIndex = this.masks.findIndex(m => m.id === id);
    if (currentIndex === -1) return;
    
    this.saveHistory();
    const mask = this.masks[currentIndex];
    const newMasks = this.masks.filter(m => m.id !== id);
    newMasks.splice(newIndex, 0, mask);
    this.masks = newMasks;
  }
  
  /**
   * 获取遮罩在列表中的索引
   */
  getMaskIndex(id: string): number {
    return this.masks.findIndex(m => m.id === id);
  }
  
  /**
   * 导出为JSON
   */
  toJSON(): Mask[] {
    return [...this.masks];
  }
  
  /**
   * 从JSON导入
   */
  fromJSON(data: Mask[]): void {
    this.setMasks(data);
    this.clearHistory();
  }
}

/**
 * 创建MaskStore实例的便捷函数
 */
export function createMaskStore(initialMasks: Mask[] = []): MaskStore {
  return new MaskStore(initialMasks);
}


