/**
 * IRFocusView - 增量阅读聚焦视图（标签页模式）
 * 提供独立的增量阅读界面，与记忆学习界面并行存在
 * 
 * v6.0: 完全使用 IRBlockV4 数据结构
 */

import { ItemView, WorkspaceLeaf, Platform, Menu, MenuItem } from 'obsidian';
import { mount, unmount } from 'svelte';
import type { WeavePlugin } from '../main';
import type { IRBlockV4 } from '../types/ir-types';
import { logger } from '../utils/logger';
import { addLocationToggleAction, getLocationToggleIcon, getLocationToggleTooltip, toggleViewLocation } from '../utils/view-location-utils';
import { calculateSelectionScore } from '../services/incremental-reading/IRCoreAlgorithmsV4';

export const VIEW_TYPE_IR_FOCUS = 'weave-ir-focus-view';

export class IRFocusView extends ItemView {
  private component: ReturnType<typeof mount> | null = null;
  private plugin: WeavePlugin;
  private instanceId: string;
  
  // 阅读数据
  private deckPath: string = '';
  private deckName: string = '';
  private blocks: IRBlockV4[] = [];
  private currentBlockIndex: number = 0;
  private currentBlockId: string | null = null;
  private queueBlockIds: string[] = [];

  private focusStats?: {
    timeBudgetMinutes: number;
    estimatedMinutes: number;
    candidateCount: number;
    dueToday: number;
    dueWithinDays: number;
    learnAheadDays: number;
  };
  
  // 统计数据
  private startTime: number = 0;
  private extractedCards: number = 0;
  
  // 位置切换按钮引用
  private locationToggleAction: HTMLElement | null = null;
  
  // 移动端按钮引用
  private mobileActionElements: HTMLElement[] = [];

  private openMobileToolbarMenu(): void {
    if (!Platform.isMobile) return;
    if (!this.component) return;
    const componentAny = this.component as any;
    if (typeof componentAny.openMobileToolbarMenu === 'function') {
      componentAny.openMobileToolbarMenu();
    }
  }

  constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.instanceId = `ir-focus-view-${Date.now()}`;
    
    logger.debug('[IRFocusView] 视图实例已创建:', this.instanceId);
  }

  getViewType(): string {
    return VIEW_TYPE_IR_FOCUS;
  }

  getDisplayText(): string {
    if (Platform.isMobile) {
      return '';
    }
    return this.deckName || '增量阅读';
  }

  getIcon(): string {
    return 'book-open';
  }

  // 允许在没有文件的情况下打开
  allowNoFile(): boolean {
    return true;
  }

  /**
   * 序列化视图状态（只保存必要的标识符）
   */
  getState(): any {
    try {
      if (this.component && typeof (this.component as any).getViewState === 'function') {
        const viewState = (this.component as any).getViewState();
        if (viewState) {
          if (typeof viewState.currentBlockIndex === 'number') {
            this.currentBlockIndex = viewState.currentBlockIndex;
          }
          if (typeof viewState.currentBlockId === 'string' || viewState.currentBlockId === null) {
            this.currentBlockId = viewState.currentBlockId;
          }
          if (Array.isArray(viewState.queueBlockIds)) {
            this.queueBlockIds = viewState.queueBlockIds;
          }
        }
      }
    } catch (error) {
      logger.warn('[IRFocusView] getState 获取组件状态失败:', error);
    }

    return {
      deckPath: this.deckPath,
      deckName: this.deckName,
      queueBlockIds: this.queueBlockIds,
      currentBlockIndex: this.currentBlockIndex,
      currentBlockId: this.currentBlockId
    };
  }

  /**
   * 恢复视图状态（接收阅读参数）
   * 注意：不直接传递 blocks 数组，而是通过 deckPath 重新加载
   */
  async setState(state: any, result: any): Promise<void> {
    await super.setState(state, result);
    
    logger.debug('[IRFocusView] setState 被调用:', state);
    
    if (state && state.deckPath) {
      this.deckPath = state.deckPath;
      this.deckName = state.deckName || this.deckPath.split('/').pop() || '增量阅读';
      this.focusStats = state.focusStats;
      this.currentBlockIndex = typeof state.currentBlockIndex === 'number' ? state.currentBlockIndex : 0;
      this.currentBlockId = typeof state.currentBlockId === 'string' ? state.currentBlockId : null;
      this.queueBlockIds = Array.isArray(state.queueBlockIds) ? state.queueBlockIds : [];
      
      // 如果直接传递了 blocks，使用它；否则从存储加载
      if (state.blocks && Array.isArray(state.blocks) && state.blocks.length > 0) {
        this.blocks = state.blocks;
        logger.debug('[IRFocusView] 使用传递的 blocks:', this.blocks.length);
      } else {
        // 从存储服务加载 blocks
        await this.loadBlocksFromStorage();
      }
      
      logger.debug('[IRFocusView] 接收到阅读参数:', {
        deckPath: this.deckPath,
        deckName: this.deckName,
        blocksCount: this.blocks.length
      });
      
      // 更新标题（使用 Obsidian API 兼容方式）
      (this.leaf as any).updateHeader?.();
      
      // 创建 Svelte 组件
      if (this.blocks.length > 0) {
        await this.createFocusComponent();
      } else {
        this.showErrorState('该牌组暂无内容块');
      }
    }
  }

  /**
   * 从存储服务加载 blocks
   */
  private async loadBlocksFromStorage(): Promise<void> {
    try {
      const { IRStorageAdapterV4 } = await import('../services/incremental-reading/IRStorageAdapterV4');
      const storageAdapter = new IRStorageAdapterV4(this.app);

      const allBlocks = await storageAdapter.getBlocksByDeckV4(this.deckPath);

      if (Array.isArray(this.queueBlockIds) && this.queueBlockIds.length > 0) {
        const byId = new Map(allBlocks.map(b => [b.id, b] as const));
        const restored = this.queueBlockIds
          .map(id => byId.get(id))
          .filter((b): b is IRBlockV4 => Boolean(b));
        if (restored.length > 0) {
          this.blocks = restored;
          logger.debug('[IRFocusView] 从存储恢复队列 blocks:', this.blocks.length);
          return;
        }
      }

      let dueBlocks = await storageAdapter.getDueBlocksV4(this.deckPath);
      if (dueBlocks.length > 1) {
        dueBlocks = dueBlocks
          .map(block => ({ block, score: calculateSelectionScore(block, null) }))
          .sort((a, b) => b.score - a.score)
          .map(item => item.block);
      }
      this.blocks = dueBlocks;
      this.queueBlockIds = this.blocks.map(b => b.id);
      logger.debug('[IRFocusView] 从存储加载到期队列 blocks:', this.blocks.length);
    } catch (error) {
      logger.error('[IRFocusView] 加载 V4 blocks 失败:', error);
      this.blocks = [];
    }
  }

  async onOpen(): Promise<void> {
    logger.debug('[IRFocusView] 视图正在打开...', this.instanceId);
    
    // 设置容器样式
    this.contentEl.empty();
    this.contentEl.addClass('weave-ir-focus-view-content');
    
    // 移动端：位置切换入口移动到 Obsidian 顶部更多菜单（onPaneMenu），不在顶部栏显示独立图标
    if (!Platform.isMobile) {
      this.addLocationToggleButton();
    }
    
    // 添加移动端功能按钮
    this.addMobileActions();
    
    // 显示加载状态
    this.showLoadingState();
    
    // 记录开始时间
    this.startTime = Date.now();
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu?.(menu, source);

    if (!Platform.isMobile) return;

    menu.addSeparator();
    menu.addItem((item: MenuItem) => {
      item
        .setTitle(getLocationToggleTooltip(this.leaf))
        .setIcon(getLocationToggleIcon(this.leaf))
        .onClick(async () => {
          await toggleViewLocation(this, 'right');
        });
    });
  }

  async onClose(): Promise<void> {
    logger.debug('[IRFocusView] 视图正在关闭...', this.instanceId);
    
    // 清理移动端按钮
    this.clearMobileActions();
    
    // 卸载 Svelte 组件
    if (this.component) {
      try {
        unmount(this.component);
        this.component = null;
      } catch (error) {
        logger.warn('[IRFocusView] 卸载组件时出错:', error);
      }
    }
    
    // 计算阅读时长
    const duration = Math.floor((Date.now() - this.startTime) / 1000 / 60);
    logger.info('[IRFocusView] 阅读会话结束，时长:', duration, '分钟');
  }

  /**
   * 设置阅读数据并创建组件
   * v6.0: 使用 IRBlockV4，自动过滤 suspended 状态和带有 ignore 标签的内容块
   */
  async setReadingData(deckPath: string, blocks: IRBlockV4[], deckName?: string): Promise<void> {
    this.deckPath = deckPath;
    // v6.0: 过滤 suspended 状态和带有 ignore 标签的内容块（使用 V4 status）
    this.blocks = blocks.filter(block => {
      if (block.status === 'suspended') return false;
      const hasIgnoreInTags = (block as any).tags?.some((tag: string) => 
        tag.toLowerCase() === 'ignore' || tag.toLowerCase() === '#ignore'
      ) || false;
      // 备用检查: contentPreview中是否包含 #ignore
      const hasIgnoreInContent = /#ignore\b/i.test((block as any).contentPreview || '');
      return !(hasIgnoreInTags || hasIgnoreInContent);
    });
    this.deckName = deckName || deckPath.split('/').pop() || '增量阅读';
    this.currentBlockIndex = 0;
    this.currentBlockId = this.blocks[0]?.id ?? null;
    this.queueBlockIds = this.blocks.map(b => b.id);
    
    logger.debug('[IRFocusView] 设置阅读数据:', {
      deckPath: this.deckPath,
      deckName: this.deckName,
      blocksCount: this.blocks.length
    });
    
    // 更新标题（使用 Obsidian API 兼容方式）
    (this.leaf as any).updateHeader?.();
    
    // 创建 Svelte 组件
    await this.createFocusComponent();
  }

  /**
   * 创建聚焦阅读组件
   */
  private async createFocusComponent(): Promise<void> {
    // 清空容器
    this.contentEl.empty();
    
    try {
      // 动态导入 Svelte 组件
      const { default: IRFocusInterface } = await import(
        '../components/incremental-reading/IRFocusInterface.svelte'
      );
      
      // 挂载组件
      this.component = mount(IRFocusInterface, {
        target: this.contentEl,
        props: {
          plugin: this.plugin,
          deckPath: this.deckPath,
          deckName: this.deckName,
          blocks: this.blocks,
          focusStats: this.focusStats,
          initialBlockIndex: this.currentBlockIndex,
          initialBlockId: this.currentBlockId,
          onClose: () => this.handleClose(),
          onBlockComplete: (blockId: string) => this.handleBlockComplete(blockId),
          onBlockSkip: (blockId: string) => this.handleBlockSkip(blockId),
          onExtractCard: () => this.handleExtractCard()
        }
      });
      
      logger.debug('[IRFocusView] Svelte 组件已挂载');
    } catch (error) {
      logger.error('[IRFocusView] 创建组件失败:', error);
      this.showErrorState('加载阅读界面失败');
    }
  }

  /**
   * 显示加载状态
   */
  private showLoadingState(): void {
    this.contentEl.createDiv({
      cls: 'weave-ir-focus-loading',
      text: '正在加载阅读内容...'
    });
  }

  /**
   * 显示错误状态
   */
  private showErrorState(message: string): void {
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: 'weave-ir-focus-error',
      text: message
    });
  }

  /**
   * 添加位置切换按钮
   */
  private addLocationToggleButton(): void {
    this.locationToggleAction = addLocationToggleAction(this, 'right');
    if (this.locationToggleAction) {
      logger.debug('[IRFocusView] 位置切换按钮已添加');
    }
  }

  /**
   * 添加功能按钮（桌面端和移动端都添加统计折叠按钮）
   */
  private addMobileActions(): void {
    try {
      // 统计信息栏折叠按钮（桌面端和移动端都需要）
      const statsAction = this.addAction('bar-chart-2', '折叠/展开统计信息栏', () => {
        this.toggleStats();
      });
      if (statsAction) this.mobileActionElements.push(statsAction);
      
      // 以下按钮仅在移动端显示
      if (!Platform.isMobile) return;
      
      // 章节导航按钮
      const navAction = this.addAction('list', '章节导航', () => {
        this.toggleChapterNav();
      });
      if (navAction) this.mobileActionElements.push(navAction);
      
      // 多功能菜单（移动端：以列表菜单显示右侧功能栏功能键）
      const menuAction = this.addAction('menu', '菜单', () => {
        this.openMobileToolbarMenu();
      });
      if (menuAction) this.mobileActionElements.push(menuAction);
      
      logger.debug('[IRFocusView] 移动端按钮已添加');
    } catch (error) {
      logger.error('[IRFocusView] 添加移动端按钮失败:', error);
    }
  }

  /**
   * 清理移动端按钮
   */
  private clearMobileActions(): void {
    for (const element of this.mobileActionElements) {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.mobileActionElements = [];
  }

  /**
   * 切换统计信息栏显示
   */
  private toggleStats(): void {
    // 通知 Svelte 组件切换统计信息栏
    if (this.component && typeof (this.component as any).toggleStats === 'function') {
      (this.component as any).toggleStats();
    }
  }

  /**
   * 切换章节导航显示
   */
  private toggleChapterNav(): void {
    // 通知 Svelte 组件切换章节导航
    if (!this.component) return;
    const componentAny = this.component as any;
    if (typeof componentAny.toggleNav === 'function') {
      componentAny.toggleNav();
      return;
    }
    if (typeof componentAny.toggleChapterNav === 'function') {
      componentAny.toggleChapterNav();
    }
  }

  /**
   * 切换工具栏显示
   */
  private toggleToolbar(): void {
    // 通知 Svelte 组件切换工具栏
    if (!this.component) return;
    const componentAny = this.component as any;
    if (typeof componentAny.toggleToolbar === 'function') {
      componentAny.toggleToolbar();
    }
  }

  /**
   * 处理关闭
   */
  private handleClose(): void {
    (this.leaf as any).detach?.();
  }

  /**
   * 处理块完成
   */
  private handleBlockComplete(blockId: string): void {
    logger.debug('[IRFocusView] 块已完成:', blockId);
  }

  /**
   * 处理块跳过
   */
  private handleBlockSkip(blockId: string): void {
    logger.debug('[IRFocusView] 块已跳过:', blockId);
  }

  /**
   * 处理提取卡片
   */
  private handleExtractCard(): void {
    this.extractedCards++;
    logger.debug('[IRFocusView] 已提取卡片，总数:', this.extractedCards);
  }

  /**
   * 获取阅读统计
   */
  getReadingStats(): { duration: number; extractedCards: number } {
    return {
      duration: Math.floor((Date.now() - this.startTime) / 1000 / 60),
      extractedCards: this.extractedCards
    };
  }
}
