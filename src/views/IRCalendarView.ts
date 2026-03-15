/**
 * 增量阅读日历视图
 * 显示在Obsidian全局侧边栏中的月历面板
 * 上方为月历热力图，下方为选中日期的阅读材料列表
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { WeavePlugin } from '../main';
import { logger } from '../utils/logger';
import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../services/premium/PremiumFeatureGuard';

export const VIEW_TYPE_IR_CALENDAR = "weave-ir-calendar-view";

export class IRCalendarView extends ItemView {
  private component: any = null;
  private plugin: WeavePlugin;

  constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  /**
   * 获取视图类型标识
   */
  getViewType(): string {
    return VIEW_TYPE_IR_CALENDAR;
  }

  /**
   * 获取视图显示名称
   */
  getDisplayText(): string {
    return "增量阅读日历";
  }

  /**
   * 获取视图图标
   */
  getIcon(): string {
    return "calendar";
  }

  /**
   * 视图打开时调用
   */
  async onOpen(): Promise<void> {
    logger.debug('[IRCalendarView] Opening calendar view');
    
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('weave-ir-calendar-view');
    
    const guard = PremiumFeatureGuard.getInstance();
    if (!guard.canUseFeature(PREMIUM_FEATURES.INCREMENTAL_READING)) {
      this.renderPremiumLock(contentEl);
      return;
    }
    
    // 显示加载占位符
    contentEl.createDiv({
      cls: 'weave-calendar-loading',
      text: '正在加载日历...'
    });
    
    // 异步加载组件
    void this.loadComponentAsync();
  }

  /**
   * 渲染高级功能锁定提示
   */
  private renderPremiumLock(container: HTMLElement): void {
    const lockDiv = container.createDiv({ cls: 'weave-premium-lock' });
    
    const iconDiv = lockDiv.createDiv();
    iconDiv.addClass('weave-premium-lock-icon');
    iconDiv.textContent = 'lock';
    
    const title = lockDiv.createEl('h3');
    title.addClass('weave-premium-lock-title');
    title.textContent = '增量阅读 - 高级功能';
    
    const desc = lockDiv.createEl('p');
    desc.addClass('weave-premium-lock-desc');
    desc.textContent = '增量阅读是高级功能，请激活许可证后使用。';
  }
  
  /**
   * 异步加载组件
   */
  private async loadComponentAsync(): Promise<void> {
    try {
      await this.waitForDataStorage();
      
      this.contentEl.empty();
      
      const { mount } = await import('svelte');
      const { default: Component } = await import('../components/incremental-reading/IRCalendarSidebar.svelte');
      this.component = mount(Component, {
        target: this.contentEl,
        props: {
          plugin: this.plugin
        }
      }) as any;
      
      logger.debug('[IRCalendarView] Calendar component mounted');
    } catch (error) {
      logger.error('[IRCalendarView] Failed to mount calendar:', error);
      this.contentEl.empty();
      // /skip innerHTML is used with static trusted HTML string for error display
      this.contentEl.innerHTML = '<div class="error">日历加载失败</div>';
    }
  }

  /**
   * 等待 dataStorage 初始化完成
   */
  private async waitForDataStorage(): Promise<void> {
    if (this.plugin.dataStorage) {
      return;
    }
    
    logger.debug('[IRCalendarView] 等待 dataStorage 初始化...');
    
    try {
      const { waitForServiceReady } = await import('../utils/service-ready-event');
      await waitForServiceReady('allCoreServices', 15000);
      logger.debug('[IRCalendarView] allCoreServices 已就绪');
    } catch (error) {
      logger.warn('[IRCalendarView] 事件等待超时，回退到轮询检查');
      
      const maxAttempts = 20;
      const interval = 100;
      
      for (let i = 0; i < maxAttempts; i++) {
        if (this.plugin.dataStorage) {
          logger.debug(`[IRCalendarView] dataStorage 已就绪（轮询 ${i * interval}ms）`);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      logger.warn('[IRCalendarView] dataStorage 初始化超时');
    }
  }

  /**
   * 视图关闭时调用
   */
  async onClose(): Promise<void> {
    logger.debug('[IRCalendarView] Closing calendar view');
    
    if (this.component) {
      const { unmount } = await import('svelte');
      void unmount(this.component);
      this.component = null;
    }
  }
}
