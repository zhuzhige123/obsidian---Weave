import { logger } from '../utils/logger';
/**
 * 模态窗堆栈管理器
 * 
 * 功能：
 * - 管理所有 InlineCardEditor 模态窗实例
 * - 动态分配递增的 z-index，避免遮挡
 * - 自动清理销毁的实例
 * 
 * z-index 分配策略（遵循 Obsidian 规范）：
 * - 基础 z-index: 100（Obsidian 模态窗标准范围：100-500）
 * - 每个新窗口递增 2
 * - Obsidian 菜单 z-index: 1000+（始终高于所有模态窗）
 * 
 * Obsidian z-index 层级规范：
 * - 普通内容: 0-10
 * - 侧边栏: 10-50
 * - 悬浮面板: 50-100
 * - 模态窗: 100-500
 * - 菜单/提示: 1000-2000
 */

export interface ModalInstance {
  id: string;
  zIndex: number;
  createdAt: Date;
  element?: HTMLElement;
}

export class ModalStackManager {
  private static instance: ModalStackManager;
  private modalStack: Map<string, ModalInstance> = new Map();
  //  降低基础 z-index，遵循 Obsidian 规范（模态窗：100-500，菜单：1000+）
  private baseZIndex = 100;
  private zIndexIncrement = 2;

  private constructor() {
    logger.debug('[ModalStackManager] 初始化');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ModalStackManager {
    if (!ModalStackManager.instance) {
      ModalStackManager.instance = new ModalStackManager();
    }
    return ModalStackManager.instance;
  }

  /**
   * 注册模态窗实例
   * @param id 模态窗唯一标识
   * @param element 模态窗 DOM 元素（可选）
   * @returns 分配的 z-index
   */
  public register(id: string, element?: HTMLElement): number {
    // 如果已存在，返回现有 z-index
    if (this.modalStack.has(id)) {
      const existing = this.modalStack.get(id)!;
      logger.debug(`[ModalStackManager] 模态窗已注册: ${id}, z-index: ${existing.zIndex}`);
      return existing.zIndex;
    }

    // 计算新的 z-index
    const currentCount = this.modalStack.size;
    const zIndex = this.baseZIndex + (currentCount * this.zIndexIncrement);

    const instance: ModalInstance = {
      id,
      zIndex,
      createdAt: new Date(),
      element
    };

    this.modalStack.set(id, instance);

    logger.debug(`[ModalStackManager] 注册模态窗: ${id}, z-index: ${zIndex}, 当前堆栈大小: ${this.modalStack.size}`);

    return zIndex;
  }

  /**
   * 注销模态窗实例
   * @param id 模态窗唯一标识
   */
  public unregister(id: string): void {
    if (this.modalStack.has(id)) {
      this.modalStack.delete(id);
      logger.debug(`[ModalStackManager] 注销模态窗: ${id}, 剩余堆栈大小: ${this.modalStack.size}`);
    }
  }

  /**
   * 获取模态窗的 z-index
   * @param id 模态窗唯一标识
   * @returns z-index 或 undefined
   */
  public getZIndex(id: string): number | undefined {
    return this.modalStack.get(id)?.zIndex;
  }

  /**
   * 获取模态窗的菜单 z-index
   * @param id 模态窗唯一标识
   * @returns 菜单 z-index 或 undefined
   */
  public getMenuZIndex(id: string): number | undefined {
    const modalZIndex = this.getZIndex(id);
    return modalZIndex ? modalZIndex + 1 : undefined;
  }

  /**
   * 获取当前堆栈大小
   */
  public getStackSize(): number {
    return this.modalStack.size;
  }

  /**
   * 清空所有模态窗（用于测试或重置）
   */
  public clear(): void {
    logger.debug(`[ModalStackManager] 清空所有模态窗，当前大小: ${this.modalStack.size}`);
    this.modalStack.clear();
  }

  /**
   * 获取所有模态窗信息（用于调试）
   */
  public getAll(): ModalInstance[] {
    return Array.from(this.modalStack.values());
  }
}

/**
 * 获取全局模态窗管理器实例
 */
export function getModalStackManager(): ModalStackManager {
  return ModalStackManager.getInstance();
}
