/**
 * StudyView - 学习界面视图（标签页模式）
 * 提供可与其他标签页并存的学习界面
 * 支持会话暂停/恢复和持久化
 */

import { ItemView, WorkspaceLeaf, Platform, Menu } from 'obsidian';
import type { WeavePlugin } from '../main';
import { tryStartStudySession, endStudySession } from '../stores/study-mode-store';
import { StudySessionManager } from '../services/StudySessionManager';
import type { StudyMode } from '../types/study-types';
import type { Card } from '../data/types';
import { logger } from '../utils/logger';
import { addLocationToggleAction, getLocationToggleIcon, getLocationToggleTooltip, toggleViewLocation } from '../utils/view-location-utils';

export const VIEW_TYPE_STUDY = 'weave-study-view';

export class StudyView extends ItemView {
  private component: any = null;
  private plugin: WeavePlugin;
  private instanceId: string;
  private isPaused = false;
  private studySessionManager: StudySessionManager;
  private isPauseHandling = false; //  防止递归调用
  private isClosing = false; //  防止 close() 递归调用
  private deckId: string | undefined; //  当前学习的牌组ID
  private mode: StudyMode | undefined; // 🆕 学习模式
  private cardIds: string[] | undefined; // 🆕 卡片ID列表
  private cards: Card[] | undefined; // 卡片对象数组
  
  //  移动端菜单回调（由 Svelte 组件设置）
  private mobileMenuCallback: (() => void) | null = null;
  private toggleStatsCallback: (() => void) | null = null;
  private toggleProficiencyStatsCallback: (() => void) | null = null;  // 🆕 学习进度统计栏回调
  private undoCallback: (() => void) | null = null;
  private undoShowAnswerCallback: (() => void) | null = null;
  
  //  移动端按钮状态
  private undoEnabled = false;
  private showAnswerState = false;
  
  //  移动端牌组统计（用于顶部栏显示）
  private deckStatsText: string = '';
  
  //  编辑模式状态管理
  private isEditMode = false;
  private editModeCallback: ((isEdit: boolean) => void) | null = null;
  private saveCallback: (() => Promise<void>) | null = null;
  
  //  存储移动端按钮元素引用（用于动态切换）
  private mobileActionElements: HTMLElement[] = [];
  
  //  位置切换按钮引用
  private locationToggleAction: HTMLElement | null = null;
  
  //  当前卡片的源文件路径（用于图谱联动）
  private currentSourceFile: string | null = null;
  
  //  队列进度状态（用于重启恢复）
  private queueState: {
    currentCardIndex: number;
    studyQueueCardIds: string[];
    sessionStudiedCardIds: string[];
  } | null = null;
  
  /**
   *  更新牌组统计文本（由 Svelte 组件调用）
   *  移动端：不更新标题，保持空白
   */
  public updateDeckStats(newCards: number, learningCards: number, reviewCards: number): void {
    //  移动端不显示统计数字在标题栏
    if (Platform.isMobile) {
      return;
    }
    
    const newText = `新${newCards} 学${learningCards} 复${reviewCards}`;
    
    // 避免重复更新
    if (this.deckStatsText === newText) return;
    
    this.deckStatsText = newText;
    logger.debug('[StudyView] 📊 牌组统计已更新:', this.deckStatsText);
    
    //  多种方式尝试更新标题
    try {
      // 方法1：使用 leaf.updateHeader()（如果存在）
      if (this.leaf && typeof (this.leaf as any).updateHeader === 'function') {
        (this.leaf as any).updateHeader();
        logger.debug('[StudyView] 使用 updateHeader() 更新标题');
      }
      
      // 方法2：触发 layout-change 事件
      this.app.workspace.trigger('layout-change');
      
      // 方法3：直接更新 DOM 中的标题元素
      const titleEl = this.leaf?.view?.containerEl?.querySelector('.view-header-title');
      if (titleEl) {
        titleEl.textContent = this.deckStatsText;
        logger.debug('[StudyView] 直接更新 DOM 标题元素');
      }
    } catch (error) {
      logger.warn('[StudyView] 更新标题失败:', error);
    }
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu?.(menu, source);

    if (!Platform.isMobile) return;

    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle(getLocationToggleTooltip(this.leaf))
        .setIcon(getLocationToggleIcon(this.leaf))
        .onClick(async () => {
          await toggleViewLocation(this, 'right');
        });
    });
  }

  constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.instanceId = `study-view-${Date.now()}`;
    this.studySessionManager = StudySessionManager.getInstance();
    
    logger.debug('[StudyView] 视图实例已创建:', this.instanceId);
  }
  
  /**
   *  设置移动端菜单回调（由 Svelte 组件调用）
   */
  public setMobileMenuCallback(callback: () => void): void {
    this.mobileMenuCallback = callback;
    logger.debug('[StudyView] 移动端菜单回调已设置');
  }
  
  /**
   *  设置展开/折叠统计栏回调（由 Svelte 组件调用）
   */
  public setToggleStatsCallback(callback: () => void): void {
    this.toggleStatsCallback = callback;
    logger.debug('[StudyView] 展开/折叠统计栏回调已设置');
  }
  
  /**
   *  设置展开/折叠学习进度统计栏回调（由 Svelte 组件调用）
   */
  public setToggleProficiencyStatsCallback(callback: () => void): void {
    this.toggleProficiencyStatsCallback = callback;
    logger.debug('[StudyView] 展开/折叠学习进度统计栏回调已设置');
  }
  
  /**
   *  设置撤销回调（由 Svelte 组件调用）
   */
  public setUndoCallback(callback: () => void): void {
    this.undoCallback = callback;
    logger.debug('[StudyView] 撤销回调已设置');
  }
  
  /**
   *  设置返回预览回调（由 Svelte 组件调用）
   */
  public setUndoShowAnswerCallback(callback: () => void): void {
    this.undoShowAnswerCallback = callback;
    logger.debug('[StudyView] 返回预览回调已设置');
  }
  
  /**
   *  设置编辑模式回调（由 Svelte 组件调用）
   */
  public setEditModeCallback(callback: (isEdit: boolean) => void): void {
    this.editModeCallback = callback;
    logger.debug('[StudyView] 编辑模式回调已设置');
  }
  
  /**
   *  设置保存回调（由 Svelte 组件调用）
   */
  public setSaveCallback(callback: () => Promise<void>): void {
    this.saveCallback = callback;
    logger.debug('[StudyView] 保存回调已设置');
  }
  
  /**
   *  更新当前卡片的源文件路径（由 Svelte 组件调用）
   */
  public updateCurrentSourceFile(sourceFile: string | null): void {
    this.currentSourceFile = sourceFile;
    logger.debug('[StudyView] 当前源文件已更新:', sourceFile);
  }
  
  /**
   *  打开当前卡片的局部图谱
   */
  private openLocalGraph(): void {
    if (!this.currentSourceFile) {
      const Notice = (window as any).Notice;
      if (Notice) {
        new Notice('当前卡片没有关联的源文件');
      }
      logger.warn('[StudyView] 无法打开图谱：当前卡片没有源文件');
      return;
    }
    
    try {
      const file = this.app.vault.getAbstractFileByPath(this.currentSourceFile);
      if (!file) {
        const Notice = (window as any).Notice;
        if (Notice) {
          new Notice('源文件不存在');
        }
        logger.warn('[StudyView] 无法打开图谱：源文件不存在', this.currentSourceFile);
        return;
      }

      this.app.workspace.onLayoutReady(() => {
        try {
          // 在右侧分割窗口打开局部图谱
          const graphLeaf = this.app.workspace.getLeaf('split', 'vertical');
          graphLeaf.setViewState({
            type: 'localgraph',
            state: { file: this.currentSourceFile }
          });
          
          logger.debug('[StudyView] 📊 已打开局部图谱:', this.currentSourceFile);
        } catch (error) {
          logger.error('[StudyView] 打开局部图谱失败:', error);
          const Notice = (window as any).Notice;
          if (Notice) {
            new Notice('打开图谱失败');
          }
        }
      });
    } catch (error) {
      logger.error('[StudyView] 打开局部图谱失败:', error);
      const Notice = (window as any).Notice;
      if (Notice) {
        new Notice('打开图谱失败');
      }
    }
  }
  
  /**
   *  更新编辑模式状态（由 Svelte 组件调用）
   */
  public updateEditMode(isEdit: boolean): void {
    if (this.isEditMode === isEdit) return; // 避免重复更新
    
    this.isEditMode = isEdit;
    logger.debug('[StudyView] 编辑模式状态已更新:', isEdit);
    
    // 更新移动端顶部栏按钮
    if (Platform.isMobile) {
      this.updateMobileActions();
    }
    
    // 通知回调
    if (this.editModeCallback) {
      this.editModeCallback(isEdit);
    }
  }
  
  /**
   *  更新移动端顶部栏按钮（根据编辑模式切换）
   */
  private updateMobileActions(): void {
    if (!Platform.isMobile) return;
    
    // 清除现有按钮
    this.clearMobileActions();
    
    if (this.isEditMode) {
      // 编辑模式：显示保存按钮
      this.addEditModeActions();
    } else {
      // 学习模式：显示学习界面按钮
      this.addStudyModeActions();
    }
    
    logger.debug('[StudyView] 📱 移动端按钮已更新，编辑模式:', this.isEditMode);
  }
  
  /**
   *  清除移动端顶部栏按钮
   */
  private clearMobileActions(): void {
    //  修复：直接移除我们添加的按钮元素，而不是清空整个容器
    // 这样更安全，不会影响 Obsidian 自己添加的按钮
    for (const element of this.mobileActionElements) {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.mobileActionElements = [];
    logger.debug('[StudyView] 📱 已清除移动端按钮');
  }
  
  /**
   *  添加编辑模式按钮（保存并返回）
   */
  private addEditModeActions(): void {
    logger.debug('[StudyView] 📱 编辑模式：不添加顶部栏按钮（使用界面内悬浮保存按钮）');
  }
  
  /**
   *  添加学习模式按钮
   */
  private addStudyModeActions(): void {
    logger.debug('[StudyView] 📱 开始添加学习模式按钮...');
    
    //  检查视图状态
    if (!this.containerEl) {
      logger.warn('[StudyView] 📱 containerEl 不存在，无法添加按钮');
      return;
    }
    
    try {
      // 1. 图谱联动按钮
      const graphAction = this.addAction('git-branch', '图谱联动', () => {
        logger.debug('[StudyView] 移动端图谱联动按钮被点击');
        this.openLocalGraph();
      });
      logger.debug('[StudyView] 📱 图谱联动按钮:', graphAction ? '已添加' : '添加失败');
      if (graphAction) this.mobileActionElements.push(graphAction);
      
      // 2. 队列统计按钮（展开/折叠队列统计栏）
      const proficiencyAction = this.addAction('bar-chart-2', '队列统计', () => {
        logger.debug('[StudyView] 移动端队列统计按钮被点击');
        if (this.toggleProficiencyStatsCallback) {
          this.toggleProficiencyStatsCallback();
        } else {
          logger.warn('[StudyView] toggleProficiencyStatsCallback 未设置');
        }
      });
      logger.debug('[StudyView] 📱 队列统计按钮:', proficiencyAction ? '已添加' : '添加失败');
      if (proficiencyAction) this.mobileActionElements.push(proficiencyAction);
      
      // 3. 记忆参数按钮（展开/折叠FSRS信息栏）
      const statsAction = this.addAction('activity', '记忆参数', () => {
        logger.debug('[StudyView] 移动端记忆参数按钮被点击');
        if (this.toggleStatsCallback) {
          this.toggleStatsCallback();
        } else {
          logger.warn('[StudyView] toggleStatsCallback 未设置');
        }
      });
      logger.debug('[StudyView] 📱 记忆参数按钮:', statsAction ? '已添加' : '添加失败');
      if (statsAction) this.mobileActionElements.push(statsAction);
      
      // 4. 菜单按钮
      const menuAction = this.addAction('menu', '打开菜单', () => {
        logger.debug('[StudyView] 移动端菜单按钮被点击');
        if (this.mobileMenuCallback) {
          this.mobileMenuCallback();
        } else {
          logger.warn('[StudyView] mobileMenuCallback 未设置');
        }
      });
      logger.debug('[StudyView] 📱 菜单按钮:', menuAction ? '已添加' : '添加失败');
      if (menuAction) this.mobileActionElements.push(menuAction);
      
      logger.debug('[StudyView] 📱 学习模式按钮添加完成，共', this.mobileActionElements.length, '个按钮');
    } catch (error) {
      logger.error('[StudyView] 📱 添加学习模式按钮失败:', error);
    }
  }
  
  /**
   *  处理从顶部栏保存按钮触发的保存
   */
  private async handleSaveFromHeader(): Promise<void> {
    if (!this.saveCallback) {
      logger.warn('[StudyView] 保存回调未设置');
      return;
    }
    
    try {
      await this.saveCallback();
      logger.debug('[StudyView] 保存成功');
    } catch (error) {
      logger.error('[StudyView] 保存失败:', error);
      // 显示错误提示
      const Notice = (window as any).Notice;
      if (Notice) {
        new Notice('保存失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }
      // 保持在编辑模式，不切换按钮状态
    }
  }
  
  /**
   * 更新撤销按钮状态（由 Svelte 组件调用）
   */
  public updateUndoState(enabled: boolean): void {
    this.undoEnabled = enabled;
  }
  
  /**
   *  更新显示答案状态（由 Svelte 组件调用）
   */
  public updateShowAnswerState(showAnswer: boolean): void {
    this.showAnswerState = showAnswer;
    // 重新添加移动端按钮以更新显示状态
    if (Platform.isMobile) {
      this.refreshMobileActions();
    }
  }
  
  /**
   *  刷新移动端功能按钮
   */
  private refreshMobileActions(): void {
    // 清除现有的 actions
    // 注意：Obsidian API 没有直接清除 actions 的方法
    // 我们需要在 addMobileActions 中处理状态变化
  }
  
  /**
   *  添加移动端顶部栏功能按钮
   * 按钮顺序（从左到右）：撤销 | 返回预览 | 展开/折叠信息栏 | 菜单
   * 注意：返回按钮已移除，用户可使用 Obsidian 原生的标签页关闭功能
   */
  private addMobileActions(): void {
    // 仅在移动端添加
    if (!Platform.isMobile) return;
    
    // 默认添加学习模式按钮
    this.addStudyModeActions();
  }

  getViewType(): string {
    return VIEW_TYPE_STUDY;
  }

  getDisplayText(): string {
    //  移动端：不显示任何标题文字
    if (Platform.isMobile) {
      return '';
    }
    return 'Weave 学习';
  }

  /**
   *  更新队列进度状态（由 StudyInterface 通过 $effect 调用）
   */
  public updateQueueState(state: {
    currentCardIndex: number;
    studyQueueCardIds: string[];
    sessionStudiedCardIds: string[];
  }): void {
    this.queueState = state;
  }

  /**
   *  序列化视图状态（用于传递学习参数和重启恢复）
   * Obsidian 会在保存 workspace 时调用此方法，结果存入 workspace.json
   */
  getState(): any {
    // 主动查询组件的当前队列状态（回退逻辑，确保数据最新）
    if (this.component && typeof this.component.getQueueProgress === 'function') {
      try {
        const liveProgress = this.component.getQueueProgress();
        if (liveProgress && liveProgress.studyQueueCardIds && liveProgress.studyQueueCardIds.length > 0) {
          this.queueState = liveProgress;
        }
      } catch (e) {
        logger.warn('[StudyView] 查询组件队列状态失败:', e);
      }
    }
    
    const state: any = {
      deckId: this.deckId,
      mode: this.mode,
      cardIds: this.cardIds,
    };
    // 保存队列进度（用于重启后恢复到之前的位置）
    if (this.queueState) {
      state.queueState = this.queueState;
    }
    logger.info('[StudyView] getState() 保存视图状态:', {
      deckId: state.deckId,
      mode: state.mode,
      hasQueueState: !!state.queueState,
      queueState: state.queueState ? {
        currentCardIndex: state.queueState.currentCardIndex,
        queueLength: state.queueState.studyQueueCardIds?.length,
        studiedCount: state.queueState.sessionStudiedCardIds?.length
      } : null
    });
    return state;
  }

  /**
   *  恢复视图状态（接收学习参数）
   */
  async setState(state: any, result: any): Promise<void> {
    await super.setState(state, result);
    
    if (state) {
      const oldDeckId = this.deckId;
      const oldMode = this.mode;
      const oldCardIds = this.cardIds;
      
      // 更新状态
      this.deckId = state.deckId;
      this.mode = state.mode;
      this.cardIds = state.cardIds;
      this.cards = state.cards;
      this.queueState = state.queueState || null;
      
      logger.info('[StudyView] setState() 接收到学习参数:', { 
        deckId: this.deckId, 
        mode: this.mode, 
        cardIds: this.cardIds?.length,
        hasQueueState: !!this.queueState,
        queueState: this.queueState ? {
          currentCardIndex: this.queueState.currentCardIndex,
          queueLength: this.queueState.studyQueueCardIds?.length,
          studiedCount: this.queueState.sessionStudiedCardIds?.length
        } : null
      });
      
      //  如果组件未创建，现在创建它
      if (!this.component) {
        logger.debug('[StudyView] 🔧 组件未创建，现在创建');
        
        // 检查是否有持久化会话
        const hasPersistedSession = this.studySessionManager.hasPersistedSession();
        
        if (hasPersistedSession) {
          // 已在 onOpen 中显示恢复提示，不需要再次处理
          logger.debug('[StudyView] 等待用户选择恢复会话');
        } else {
          // 创建新的学习组件（传递 queueState 用于重启恢复）
          await this.createStudyComponent({ 
            deckId: this.deckId,
            mode: this.mode,
            cardIds: this.cardIds,
            cards: this.cards,
            queueState: this.queueState || undefined
          });
        }
      } else {
        //  如果参数发生变化，通知组件重新加载卡片
        const paramsChanged = oldDeckId !== this.deckId || oldMode !== this.mode || 
                              JSON.stringify(oldCardIds) !== JSON.stringify(this.cardIds);
        
        if (paramsChanged) {
          logger.debug('[StudyView] 🔄 检测到参数变化，通知组件更新');
          if (typeof this.component.updateStudyParams === 'function') {
            await this.component.updateStudyParams({
              deckId: this.deckId,
              mode: this.mode,
              cardIds: this.cardIds,
              cards: this.cards
            });
          }
        }
      }
    }
  }

  getIcon(): string {
    return 'graduation-cap';
  }

  // 允许在没有文件的情况下打开
  allowNoFile(): boolean {
    return true;
  }

  /**
   * 等待 dataStorage 初始化完成
   */
  /**
   * 等待数据存储初始化
   * 使用事件驱动方式，比轮询更高效
   */
  private async waitForDataStorage(): Promise<void> {
    if (this.plugin.dataStorage) {
      return;
    }
    
    logger.debug('[StudyView] 等待 dataStorage 初始化...');
    
    try {
      // 使用事件驱动等待，超时 5 秒
      const { waitForServiceReady } = await import('../utils/service-ready-event');
      await waitForServiceReady('dataStorage', 5000);
      logger.debug('[StudyView] dataStorage 已就绪（事件通知）');
    } catch (error) {
      // 事件等待超时，回退到轮询检查
      logger.warn('[StudyView] 事件等待超时，回退到轮询检查');
      
      const maxAttempts = 20;
      const interval = 100;
      
      for (let i = 0; i < maxAttempts; i++) {
        if (this.plugin.dataStorage) {
          logger.debug(`[StudyView] dataStorage 已就绪（轮询 ${i * interval}ms）`);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      // 不抛出错误，记录警告
      logger.warn('[StudyView] dataStorage 初始化超时，将显示加载状态');
    }
  }

  /**
   * 显示加载状态
   */
  private showLoadingState(): void {
    this.contentEl.createDiv({
      cls: 'weave-study-loading',
      text: '正在初始化学习界面...'
    });
  }

  // 设置导航类型为标签页
  getNavigationType(): string {
    return 'tab';
  }

  async onOpen(): Promise<void> {
    logger.debug('[StudyView] 视图正在打开...', this.instanceId);
    
    // 设置容器样式
    this.contentEl.empty();
    this.contentEl.addClass('weave-study-view-content');
    this.contentEl.addClass('weave-main-editor-mode');
    
    //  移动端：位置切换入口移动到 Obsidian 顶部更多菜单（onPaneMenu），不在顶部栏显示独立图标
    if (!Platform.isMobile) {
      this.addLocationToggleButton();
    }
    
    //  添加移动端功能按钮到 Obsidian 原生顶部栏
    this.addMobileActions();
    
    //  性能优化：显示加载占位符，异步加载组件
    this.showLoadingState();
    
    // 后台异步初始化（不阻塞界面）
    this.initializeAsync();
  }
  
  /**
   *  添加位置切换按钮
   * 支持将视图在内容区和侧边栏之间移动
   */
  private addLocationToggleButton(): void {
    this.locationToggleAction = addLocationToggleAction(this, 'right');
    if (this.locationToggleAction) {
      logger.debug('[StudyView] 📱 位置切换按钮已添加');
    }
  }
  
  /**
   * 异步初始化（不阻塞 onOpen）
   */
  private async initializeAsync(): Promise<void> {
    try {
      // 异步等待 dataStorage
      await this.waitForDataStorage();
      
      //  检查并清理可能残留的学习实例
      const studyModeStore = (await import('../stores/study-mode-store')).studyModeStore;
      const activeInstance = studyModeStore.getActiveInstance();
      
      if (activeInstance && activeInstance.id !== this.instanceId) {
        logger.debug('[StudyView] 检测到残留的学习实例，清理中...', activeInstance.id);
        endStudySession(activeInstance.id);
      }
      
      // 尝试注册学习实例（单例控制）
      const registered = tryStartStudySession(this.instanceId);
      
      if (!registered) {
        // 已有活跃的学习会话
        logger.warn('[StudyView] 已有活跃的学习会话，阻止打开');
        this.contentEl.empty();
        this.contentEl.createDiv({
          cls: 'weave-study-view-blocked',
          text: '已有学习会话正在进行中。为保持专注，请先完成或关闭当前会话。'
        });
        return;
      }
      
      // 检查是否有持久化的会话需要恢复
      const hasPersistedSession = this.studySessionManager.hasPersistedSession();
      
      if (hasPersistedSession) {
        // 显示恢复会话提示
        await this.showRestoreSessionPrompt();
      }
      
      // 监听标签页激活/失活事件
      this.registerViewEvents();
    } catch (error) {
      logger.error('[StudyView] 初始化失败:', error);
      this.contentEl.empty();
      this.contentEl.createDiv({
        cls: 'error',
        text: '学习视图初始化失败'
      });
    }
  }

  /**
   * 显示恢复会话提示
   */
  private async showRestoreSessionPrompt(): Promise<void> {
    const promptContainer = this.contentEl.createDiv({
      cls: 'weave-study-restore-prompt'
    });
    
    promptContainer.createEl('h3', { text: '发现未完成的学习会话' });
    promptContainer.createEl('p', { text: '是否恢复上次的学习进度？' });
    
    const buttonContainer = promptContainer.createDiv({ cls: 'button-container' });
    
    // 恢复按钮
    const restoreBtn = buttonContainer.createEl('button', {
      text: '恢复会话',
      cls: 'mod-cta'
    });
    restoreBtn.addEventListener('click', async () => {
      await this.restoreSession();
    });
    
    // 新建按钮
    const newBtn = buttonContainer.createEl('button', {
      text: '开始新会话'
    });
    newBtn.addEventListener('click', async () => {
      this.studySessionManager.clearPersistedSession();
      //  传递学习参数
      await this.createStudyComponent({ 
        deckId: this.deckId,
        mode: this.mode,
        cardIds: this.cardIds,
        cards: this.cards
      });
    });
  }

  /**
   * 恢复持久化的会话
   */
  private async restoreSession(): Promise<void> {
    const persisted = this.studySessionManager.getPersistedSession();
    
    if (!persisted) {
      logger.warn('[StudyView] 无法恢复：持久化会话不存在');
      //  传递当前的学习参数（如果有）
      await this.createStudyComponent({ 
        deckId: this.deckId,
        mode: this.mode,
        cardIds: this.cardIds,
        cards: this.cards
      });
      return;
    }
    
    logger.debug('[StudyView] 正在恢复会话...', persisted);
    
    // 恢复会话到 SessionManager
    const _sessionId = this.studySessionManager.restoreSession(persisted);
    
    //  优先使用持久化的 deckId，否则使用当前的 deckId
    await this.createStudyComponent({
      deckId: persisted.deckId || this.deckId,
      resumeData: persisted
    });
  }

  /**
   * 创建学习组件
   */
  private async createStudyComponent(options?: {
    deckId?: string;
    mode?: StudyMode;
    cardIds?: string[];
    cards?: Card[];
    resumeData?: any;
    queueState?: {
      currentCardIndex: number;
      studyQueueCardIds: string[];
      sessionStudiedCardIds: string[];
    };
  }): Promise<void> {
    try {
      //  验证参数
      if (!options?.resumeData && !options?.queueState) {
        // 如果没有恢复数据也没有队列状态，必须有 deckId 或 cardIds
        if (!options?.deckId && (!options?.cardIds || options.cardIds.length === 0)) {
          logger.error('[StudyView] 缺少必要的学习参数');
          this.contentEl.empty();
          this.contentEl.createDiv({
            cls: 'weave-study-view-error',
            text: '学习参数无效，请重新选择牌组进入学习。'
          });
          return;
        }
        
        //  关键修复：如果只有 deckId 没有 cardIds，先验证是否有可学习的卡片
        if (options?.deckId && 
            !options?.resumeData && 
            !options?.queueState &&
            !options?.cardIds && 
            !options?.cards) {  
        
          // 只对普通学习模式进行预检查
          if (!options?.mode || options.mode === 'normal') {
            logger.debug('[StudyView] 🔍 验证牌组是否有可学习的卡片...');
            
            const { loadDeckCardsForStudy, getLearnedNewCardsCountToday } = await import('../utils/study/studyCompletionHelper');
            const dataStorage = this.plugin.dataStorage;
            
            if (!dataStorage) {
              logger.error('[StudyView] DataStorage 未初始化');
              this.contentEl.empty();
              this.contentEl.createDiv({
                cls: 'weave-study-view-error',
                text: '数据服务未就绪，请稍后重试。'
              });
              return;
            }
            
            const newCardsPerDay = this.plugin.settings.newCardsPerDay || 20;
            const reviewsPerDay = this.plugin.settings.reviewsPerDay || 20;
            const learnedNewCardsToday = await getLearnedNewCardsCountToday(dataStorage, options.deckId);
            
            const testCards = await loadDeckCardsForStudy(
              dataStorage,
              options.deckId,
              newCardsPerDay,
              reviewsPerDay
            );
            
            logger.debug('[StudyView] 🎯 预检查结果:', {
              deckId: options.deckId.slice(0, 8),
              cardsFound: testCards.length
            });
          
          if (testCards.length === 0) {
            logger.warn('[StudyView] ⚠️ 牌组无可学习的卡片，关闭学习界面');
            this.contentEl.empty();
            // 不显示错误，直接关闭标签页
            this.close();
            return;
          }
        }
      }
      }
      
      this.contentEl.empty();
      this.contentEl.addClass('weave-study-view-content');
      this.contentEl.addClass('weave-main-editor-mode');  //  与WeaveView保持一致
      
      // 动态导入 StudyViewWrapper 组件
      const { mount } = await import('svelte');
      const { default: StudyViewWrapper } = await import('../components/study/StudyViewWrapper.svelte');
      
      this.component = mount(StudyViewWrapper, {
        target: this.contentEl,
        props: {
          plugin: this.plugin,
          viewInstance: this,
          deckId: options?.deckId,
          mode: options?.mode,
          cardIds: options?.cardIds,
          cards: options?.cards,
          resumeData: options?.resumeData,
          queueState: options?.queueState,
          onClose: () => {
            this.close();
          },
          onPause: () => {
            this.handlePause();
          },
          onResume: () => {
            this.handleResume();
          }
        }
      });
      
      logger.debug('[StudyView] ✅ 学习组件已挂载', { 
        deckId: options?.deckId, 
        mode: options?.mode, 
        cardIds: options?.cardIds?.length,
        cards: options?.cards?.length 
      });
    } catch (error) {
      logger.error('[StudyView] 创建学习组件失败:', error);
      this.contentEl.empty();
      this.contentEl.createDiv({
        cls: 'error',
        text: '加载学习界面失败'
      });
    }
  }

  /**
   * 注册视图事件监听
   */
  private registerViewEvents(): void {
    // 监听标签页激活事件
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf === this.leaf) {
          // 当前视图被激活
          this.handleActivate();
        } else if (this.leaf && leaf !== this.leaf) {
          // 当前视图失去焦点
          this.handleDeactivate();
        }
      })
    );
  }

  /**
   * 处理视图激活（恢复学习）
   */
  private handleActivate(): void {
    if (this.isPaused && this.component) {
      logger.debug('[StudyView] 视图激活 - 恢复学习');
      this.handleResume();
    }
  }

  /**
   * 处理视图失活（暂停学习）
   */
  private handleDeactivate(): void {
    if (!this.isPaused && this.component) {
      logger.debug('[StudyView] 视图失活 - 暂停学习');
      this.handlePause();
    }
  }

  /**
   * 处理暂停
   */
  private handlePause(): void {
    //  防止递归调用
    if (this.isPauseHandling) {
      logger.debug('[StudyView] 防止重入：暂停处理中');
      return;
    }
    
    this.isPauseHandling = true;
    
    try {
      this.isPaused = true;
      logger.debug('[StudyView] 学习已暂停');
      
      // 触发组件的暂停方法（如果存在）
      if (this.component && typeof this.component.pause === 'function') {
        this.component.pause();
      }
    } finally {
      this.isPauseHandling = false;
    }
  }

  /**
   * 处理恢复
   */
  private handleResume(): void {
    this.isPaused = false;
    logger.debug('[StudyView] 学习已恢复');
    
    // 触发组件的恢复方法（如果存在）
    if (this.component && typeof this.component.resume === 'function') {
      this.component.resume();
    }
  }

  /**
   * 持久化当前会话状态
   */
  public persistCurrentSession(_sessionData: any): void {
    logger.debug('[StudyView] 持久化会话状态');
    
    // 通过组件获取当前会话数据并持久化
    if (this.component && typeof this.component.getSessionData === 'function') {
      const data = this.component.getSessionData();
      // 持久化逻辑将在 SessionManager 中实现
      logger.debug('[StudyView] 会话数据已准备持久化:', data);
    }
  }

  async onClose(): Promise<void> {
    logger.debug('[StudyView] 视图正在关闭...', this.instanceId);
    
    //  不持久化会话状态 - 关闭标签页即清理会话
    // 避免再次打开时出现残留状态
    
    // 销毁 Svelte 组件
    if (this.component) {
      try {
        const { unmount } = await import('svelte');
        unmount(this.component);
        logger.debug('[StudyView] 学习组件已销毁');
      } catch (error) {
        logger.error('[StudyView] 销毁学习组件失败:', error);
      }
      this.component = null;
    }
    
    //  强制注销学习实例（确保清理）
    endStudySession(this.instanceId);
    logger.debug('[StudyView] 学习实例已注销:', this.instanceId);
    
    // 清理持久化的会话（如果有）
    this.studySessionManager.clearPersistedSession();
    
    logger.debug('[StudyView] 视图已完全关闭，所有状态已清理');
  }

  /**
   * 手动关闭视图（供外部调用）
   */
  public close(): void {
    //  防止递归调用（特别是与其他插件如 Excalidraw 冲突时）
    if (this.isClosing) {
      logger.debug('[StudyView] 防止重入：视图正在关闭中');
      return;
    }
    
    this.isClosing = true;
    this.leaf.detach();
  }
}

