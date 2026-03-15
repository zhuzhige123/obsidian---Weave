<script lang="ts" module>
  /**
   * 模块级别的服务实例（跨组件生命周期保持）
   */
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { IRStorageAdapterV4 } from '../../services/incremental-reading/IRStorageAdapterV4';
  import { IRDeckManager } from '../../services/incremental-reading/IRDeckManager';
  import { IRChunkFileService } from '../../services/incremental-reading/IRChunkFileService';
  import type { IncrementalReadingSettings } from '../../types/plugin-settings.d';
  import type { App } from 'obsidian';

  /**
   * v3.0: 从插件设置构建 IRSchedulingFacadeConfig
   */
  // export function buildFacadeConfigFromSettings(irSettings?: IncrementalReadingSettings): IRSchedulingFacadeConfig {
  //   if (!irSettings) return {};
    
  //   return {
  //     strategy: irSettings.scheduleStrategy || 'processing',
  //     advancedSettings: {
  //       dailyTimeBudgetMinutes: irSettings.dailyTimeBudgetMinutes ?? 40,
  //       maxAppearancesPerDay: irSettings.maxAppearancesPerDay ?? 2,
  //       priorityHalfLifeDays: irSettings.priorityHalfLifeDays ?? 7,
  //       agingStrength: irSettings.agingStrength || 'low',
  //       autoPostponeStrategy: irSettings.autoPostponeStrategy || 'off',
  //       tagGroupLearningSpeed: irSettings.enableTagGroupPrior ? 'medium' : 'off'
  //     }
  //   };
  // }

  let _storageService: IRStorageService | null = null;
  let _deckManager: IRDeckManager | null = null;
  // @deprecated v5.0: 旧 UUID 标记方案已弃用
  // let _contentSplitter: IRContentSplitter | null = null;
  // let _fileWatcher: IRFileWatcher | null = null;
  // let _incrementalSync: IRIncrementalSync | null = null;
  // v6.0: 仅使用 V4 调度服务
  import { IRV4SchedulerService } from '../../services/incremental-reading/IRV4SchedulerService';
  let _v4SchedulerService: IRV4SchedulerService | null = null;
  let _servicesInitialized = false;
  let _currentApp: App | null = null;

  export function getServices(app: App, importFolder?: string) {
    // 如果 app 实例变了，重新初始化
    if (_currentApp !== app) {
      _servicesInitialized = false;
      _currentApp = app;
    }
    return {
      get storageService() { return _storageService; },
      get deckManager() { return _deckManager; },
      /** v6.0: V4 调度服务 */
      get v4SchedulerService() { return _v4SchedulerService; },
      get initialized() { return _servicesInitialized; },
      async init() {
        if (_servicesInitialized && _storageService && _deckManager) {
          return;
        }
        
        try {
          _storageService = new IRStorageService(app);
          await _storageService.initialize();
          
          _deckManager = new IRDeckManager(app, _storageService, importFolder);
          
          // v6.0: 仅初始化 V4 调度服务
          _v4SchedulerService = new IRV4SchedulerService(app, importFolder);
          _v4SchedulerService.initialize().catch(() => {});
          
          _servicesInitialized = true;
        } catch (error) {
          _servicesInitialized = true;
        }
      },
      // @deprecated v5.0: 旧 UUID 标记方案已弃用，setImportFolder 不再需要
      setImportFolder(_folder: string) {
        // no-op: 块文件方案不需要监听 importFolder
      }
    };
  }
</script>

<script lang="ts">
  /**
   * 增量阅读牌组视图
   * 
   * 复用记忆牌组的卡片设计，支持样式切换
   * 
   * @module components/incremental-reading/IRDeckView
   * @version 2.0.0
   */
  import { onMount } from 'svelte';
  import { Notice, Menu, Modal, Setting, TFile } from 'obsidian';
  import MaterialImportModal from './MaterialImportModal.svelte';
  import IRLoadForecastModal from '../modals/IRLoadForecastModal.svelte';
  import type { BatchImportResult } from '../../services/incremental-reading/ReadingMaterialManager';
  import type { WeavePlugin } from '../../main';
  import type { IRDeck, IRDeckStats, IRChunkFileData, IRBlock } from '../../types/ir-types';
  import type { Deck, DeckStats } from '../../data/types';
  import { logger } from '../../utils/logger';
  import { showObsidianInput, showObsidianConfirm } from '../../utils/obsidian-confirm';
  // v3.0: 移除旧的 IRScheduler 导入，改用 getServices 中的 schedulingFacade
  // 增量阅读专用卡片组件
  import IRDeckCard from './IRDeckCard.svelte';
  import DeckGridCard from '../deck-views/DeckGridCard.svelte';
  import type { DeckCardStyle } from '../../types/plugin-settings.d';
  import { getColorSchemeForDeck } from '../../config/card-color-schemes';
  import IRNoBlocksAvailableModal from './IRNoBlocksAvailableModal.svelte';
  import IRTemporaryLearnAheadModal from './IRTemporaryLearnAheadModal.svelte';
  import { resolveIRImportFolder } from '../../config/paths';
  import { DirectoryUtils } from '../../utils/directory-utils';
  import { calculateSelectionScore } from '../../services/incremental-reading/IRCoreAlgorithmsV4';
  import { IRContentSplitter } from '../../services/incremental-reading/IRContentSplitter';
  import { IRPdfBookmarkTaskService } from '../../services/incremental-reading/IRPdfBookmarkTaskService';

  interface Props {
    plugin: WeavePlugin;
    onStartReading?: (
      deckPath: string,
      blocks: any[],
      deckName: string,
      focusStats?: {
        timeBudgetMinutes: number;
        estimatedMinutes: number;
        candidateCount: number;
        dueToday: number;
        dueWithinDays: number;
        learnAheadDays: number;
      }
    ) => void;
  }

  let { plugin, onStartReading }: Props = $props();

  const deckCardStyle = $derived<DeckCardStyle>(
    (plugin.settings.deckCardStyle as DeckCardStyle) || 'default'
  );

  // v6.0: 获取模块级别的服务实例
  const services = getServices(plugin.app, plugin.settings?.incrementalReading?.importFolder);

  // 牌组数据
  let decks = $state<IRDeck[]>([]);
  let deckStats = $state<Record<string, IRDeckStats>>({});
  let isLoading = $state(true);
  
  // 导入模态窗状态
  let showImportModal = $state(false);
  
  // 负载预测模态窗状态
  let showLoadForecastModal = $state(false);
  let loadForecastDeckId = $state<string | undefined>(undefined);
  
  // 空队列选择模态窗状态
  let showNoBlocksModal = $state(false);
  let noBlocksModalDeckPath = $state<string>('');
  let noBlocksModalDeckName = $state<string>('');
  let noBlocksModalStats = $state<{ totalBlocks: number; dueToday: number; dueWithinDays: number; learnAheadDays?: number } | undefined>(undefined);

  // 临时扩大提前阅读范围模态窗状态
  let showTemporaryLearnAheadModal = $state(false);
  let temporaryLearnAheadDeckPath = $state<string>('');
  let temporaryLearnAheadDeckName = $state<string>('');

  // 打开导入模态窗（供外部事件调用）
  export function openImportModal() {
    showImportModal = true;
  }
  
  // 处理导入完成（MaterialImportModal回调）
  function handleImportComplete(result: BatchImportResult) {
    showImportModal = false;
    
    // 显示导入结果通知
    if (result.errors.length > 0) {
      new Notice(`导入完成：${result.success} 个成功，${result.skipped} 个跳过，${result.errors.length} 个失败`);
    } else if (result.skipped > 0) {
      new Notice(`导入完成：${result.success} 个成功，${result.skipped} 个已存在`);
    } else {
      new Notice(`成功导入 ${result.success} 个阅读材料`);
    }
    
    // 刷新牌组列表
    loadDecks();
    window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
  }

  // 加载牌组数据
  async function loadDecks() {
    const startTime = Date.now();
    isLoading = true;
    logger.debug('[IRDeckView] loadDecks 开始');
    
    try {
      // 直接初始化必要的服务
      const storageService = new IRStorageService(plugin.app);
      await storageService.initialize();
      
      const deckManager = new IRDeckManager(plugin.app, storageService, plugin.settings?.incrementalReading?.importFolder);
      const decksWithStats = await deckManager.getDecksWithStats({
        dailyNewLimit: plugin.settings?.incrementalReading?.dailyNewLimit ?? 20,
        dailyReviewLimit: plugin.settings?.incrementalReading?.dailyReviewLimit ?? 50,
        learnAheadDays: plugin.settings?.incrementalReading?.learnAheadDays ?? 3
      });
      
      const dailyBudget = plugin.settings?.incrementalReading?.dailyTimeBudgetMinutes || 30;
      const loadRateDays = 3;

      let chunksByDeckId: Map<string, IRChunkFileData[]> | null = null;
      let blockById: Record<string, IRBlock> | null = null;

      try {
        const chunksData = await storageService.getAllChunkData();
        const allChunks = Object.values(chunksData);
        const blocksData = await storageService.getAllBlocks();

        chunksByDeckId = new Map();
        for (const chunk of allChunks) {
          const deckIds = (chunk as any).deckIds as string[] | undefined;
          if (!deckIds || deckIds.length === 0) continue;
          for (const deckId of deckIds) {
            const list = chunksByDeckId.get(deckId);
            if (list) {
              list.push(chunk);
            } else {
              chunksByDeckId.set(deckId, [chunk]);
            }
          }
        }

        blockById = blocksData as unknown as Record<string, IRBlock>;
      } catch (e) {
        logger.debug('[IRDeckView] 计算负载率：读取数据失败', e);
        chunksByDeckId = null;
        blockById = null;
      }

      decks = [...decksWithStats.map(d => d.deck)];

      // 加载 PDF 书签任务，按牌组分组，用于合并到主统计和负载率计算
      let pdfTasksByDeckId = new Map<string, any[]>();
      try {
        const pdfService = new IRPdfBookmarkTaskService(plugin.app);
        await pdfService.initialize();
        const allPdfTasks = await pdfService.getAllTasks();
        for (const task of allPdfTasks) {
          const deckId = String((task as any)?.deckId || '').trim();
          if (!deckId) continue;
          const status = String((task as any)?.status || 'new');
          if (status === 'done' || status === 'suspended' || status === 'removed') continue;
          const list = pdfTasksByDeckId.get(deckId);
          if (list) { list.push(task); } else { pdfTasksByDeckId.set(deckId, [task]); }
        }
      } catch (e) {
        logger.debug('[IRDeckView] 加载 PDF 书签任务失败', e);
      }
      
      const newStats: Record<string, IRDeckStats> = {};
      for (const d of decksWithStats) {
        const deckKey = d.deck.id || d.deck.path || '';
        if (deckKey) {
          let loadRatePercent: number | undefined = undefined;

          if (dailyBudget > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayMs = today.getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            const estimateChunkMinutes = (chunk: IRChunkFileData): number => {
              const stats = (chunk as any).stats as any;
              if (stats?.effectiveReadingTimeSec && stats?.impressions > 0) {
                return (stats.effectiveReadingTimeSec / stats.impressions) / 60;
              }
              return 3;
            };

            const estimateBlockMinutes = (block: IRBlock): number => {
              const totalReadingTime = (block as any).totalReadingTime as number | undefined;
              const reviewCount = (block as any).reviewCount as number | undefined;
              if (totalReadingTime && reviewCount && reviewCount > 0) {
                return (totalReadingTime / reviewCount) / 60;
              }
              return 3;
            };

            const estimatePdfTaskMinutes = (task: any): number => {
              const s = task?.stats;
              if (s?.effectiveReadingTimeSec && s?.impressions > 0) {
                return (s.effectiveReadingTimeSec / s.impressions) / 60;
              }
              return 5;
            };

            const deckChunks = chunksByDeckId?.get(deckKey) || [];
            const deckBlocks = blockById ? (d.deck.blockIds || []).map(id => blockById![id]).filter(Boolean) : [];
            const deckPdfTasks = pdfTasksByDeckId.get(deckKey) || [];

            let maxRatio = 0;
            for (let i = 0; i < loadRateDays; i++) {
              const targetMs = todayMs + i * dayMs;
              const nextDayMs = targetMs + dayMs;

              let dayMinutes = 0;

              for (const chunk of deckChunks) {
                const scheduleStatus = (chunk as any).scheduleStatus as string | undefined;
                if (scheduleStatus === 'suspended' || scheduleStatus === 'done') continue;
                const nextRepDate = ((chunk as any).nextRepDate as number | undefined) || 0;

                if (nextRepDate >= targetMs && nextRepDate < nextDayMs) {
                  dayMinutes += estimateChunkMinutes(chunk);
                } else if (nextRepDate < targetMs && i === 0) {
                  dayMinutes += estimateChunkMinutes(chunk);
                }
              }

              for (const block of deckBlocks) {
                const state = (block as any).state as string | undefined;
                if (state === 'suspended') continue;

                const nextReview = (block as any).nextReview as string | null | undefined;
                if (nextReview) {
                  const reviewMs = new Date(nextReview).getTime();
                  if (reviewMs >= targetMs && reviewMs < nextDayMs) {
                    dayMinutes += estimateBlockMinutes(block);
                  } else if (reviewMs < targetMs && i === 0) {
                    dayMinutes += estimateBlockMinutes(block);
                  }
                } else if (state === 'new' && i === 0) {
                  dayMinutes += estimateBlockMinutes(block);
                }
              }

              for (const task of deckPdfTasks) {
                const nrd = (task.nextRepDate as number) || 0;
                if (nrd >= targetMs && nrd < nextDayMs) {
                  dayMinutes += estimatePdfTaskMinutes(task);
                } else if (nrd < targetMs && i === 0) {
                  dayMinutes += estimatePdfTaskMinutes(task);
                }
              }

              maxRatio = Math.max(maxRatio, dayMinutes / dailyBudget);
            }

            loadRatePercent = Math.round(maxRatio * 100);
          }

          // PDF 书签任务的统计已在 IRStorageService.getDeckStats 中纳入，此处仅覆盖 loadRatePercent
          newStats[deckKey] = {
            ...d.stats,
            loadRatePercent
          };
        }
      }
      deckStats = newStats;
      
      logger.info('[IRDeckView] 加载完成:', decks.length, '个牌组,', Date.now() - startTime, 'ms');
    } catch (error) {
      logger.error('[IRDeckView] 加载失败:', error);
      decks = [];
      deckStats = {};
    } finally {
      isLoading = false;
      logger.debug('[IRDeckView] isLoading = false');
    }
  }

  // 获取牌组统计
  function getStats(deckPath: string): IRDeckStats {
    return deckStats[deckPath] || {
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      dueToday: 0,
      dueWithinDays: 0,
      totalCount: 0,
      fileCount: 0,
      questionCount: 0,
      completedQuestionCount: 0
    };
  }

  // 将 IRDeck 转换为 Deck 格式（适配卡片组件）
  function toMemoryDeck(irDeck: IRDeck): Deck {
    const now = new Date().toISOString();
    const deckId = irDeck.id || irDeck.path || '';
    return {
      id: deckId,
      name: irDeck.name || '未命名牌组',
      icon: 'book-open',
      description: `${getStats(deckId).fileCount} 个文件`,
      created: irDeck.createdAt || now,
      modified: irDeck.updatedAt || irDeck.createdAt || now,
      cardUUIDs: [],
      deckType: 'mixed',
      category: '',
      path: deckId,
      level: 0,
      order: 0,
      inheritSettings: false,
      settings: {} as any,
      stats: {} as any,
      includeSubdecks: false,
      tags: [],
      metadata: {}
    };
  }

  // 将 IRDeckStats 转换为 DeckStats 格式（适配卡片组件）
  function toMemoryStats(irStats: IRDeckStats): DeckStats {
    return {
      newCards: irStats.dueToday,
      learningCards: Math.max(0, (irStats.dueWithinDays ?? irStats.dueToday) - irStats.dueToday),
      reviewCards: irStats.questionCount,
      totalCards: irStats.totalCount,
      memoryRate: 0,
      todayNew: 0,
      todayReview: 0,
      todayTime: 0,
      totalReviews: 0,
      totalTime: 0,
      averageEase: 0,
      forecastDays: {}
    };
  }

  // 显示牌组菜单 (v2.0: 扩展菜单功能，使用 deckId 作为主要标识)
  function showDeckMenu(event: MouseEvent, deck: IRDeck) {
    const menu = new Menu();
    const deckId = deck.id || deck.path || '';
    
    // 开始阅读（学习队列）
    menu.addItem((item) =>
      item
        .setTitle('开始阅读')
        .setIcon('play')
        .onClick(() => handleStartReading(deckId))
    );
    
    // v2.1: 提前阅读（所有内容块）
    menu.addItem((item) =>
      item
        .setTitle('提前阅读')
        .setIcon('fast-forward')
        .onClick(() => handleAdvanceReading(deckId))
    );
    
    menu.addSeparator();
    
    // 牌组编辑
    menu.addItem((item) =>
      item
        .setTitle('牌组编辑')
        .setIcon('edit-3')
        .onClick(() => handleEditDeck(deckId))
    );
    
    // 牌组分析（负载预测）
    menu.addItem((item) =>
      item
        .setTitle('牌组分析')
        .setIcon('bar-chart-2')
        .onClick(() => {
          loadForecastDeckId = deckId;
          showLoadForecastModal = true;
        })
    );
    
    menu.addSeparator();
    
    // 解散牌组（保留内容块数据）
    menu.addItem((item) =>
      item
        .setTitle('解散牌组')
        .setIcon('unlink')
        .onClick(async () => {
          const confirmed = await confirmAction(
            '解散牌组',
            '解散后牌组将被删除，但内容块数据会保留。确定继续？'
          );
          if (confirmed) {
            const storageService = new IRStorageService(plugin.app);
            await storageService.initialize();
            const deckManager = new IRDeckManager(plugin.app, storageService, plugin.settings?.incrementalReading?.importFolder);
            logger.debug(`[IRDeckView] 解散牌组: ${deckId}`);
            await deckManager.disbandDeck(deckId);
            await loadDecks();
            window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
            new Notice('牌组已解散（内容块数据已保留）');
          }
        })
    );
    
    // 删除牌组（同时删除内容块数据）
    menu.addItem((item) =>
      item
        .setTitle('删除牌组')
        .setIcon('trash-2')
        .setWarning(true)
        .onClick(async () => {
          const confirmed = await confirmAction(
            '删除牌组',
            '此操作将删除牌组及其所有内容块数据，不可恢复。确定继续？'
          );
          if (confirmed) {
            const storageService = new IRStorageService(plugin.app);
            await storageService.initialize();
            const deckManager = new IRDeckManager(plugin.app, storageService, plugin.settings?.incrementalReading?.importFolder);
            logger.debug(`[IRDeckView] 删除牌组: ${deckId}`);
            await deckManager.deleteDeck(deckId);
            await loadDecks();
            window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
            new Notice('牌组及内容块数据已删除');
          }
        })
    );
    
    menu.showAtMouseEvent(event);
  }

  // 确认操作对话框 - 使用 Obsidian Modal 避免焦点劫持
  async function confirmAction(title: string, message: string): Promise<boolean> {
    return showObsidianConfirm(plugin.app, message, { title });
  }

  // 牌组编辑（名称 + 标签）
  async function handleEditDeck(deckId: string) {
    
    
    const storageService = new IRStorageService(plugin.app);
    await storageService.initialize();
    const deck = await storageService.getDeckById(deckId);
    if (!deck) return;

    const modal = new Modal(plugin.app);
    modal.titleEl.setText('编辑牌组');
    
    let newName = deck.name;
    let newTag = (deck.tags && deck.tags.length > 0) ? deck.tags[0] : '';
    
    // 名称
    new Setting(modal.contentEl)
      .setName('名称')
      .addText((text: any) => {
        text.setValue(newName).onChange((v: string) => { newName = v; });
        text.inputEl.style.width = '100%';
      });
    
    // 牌组标签（单选）
    const tagSetting = new Setting(modal.contentEl)
      .setName('牌组标签(单选)')
      .setDesc('标签用于牌组分类，仅可选择一个标签');
    
    const tagInputContainer = modal.contentEl.createDiv({ cls: 'weave-tag-input-container' });
    const tagDisplay = tagInputContainer.createDiv({ cls: 'weave-tag-display' });
    
    function renderTag() {
      tagDisplay.empty();
      if (newTag) {
        const chip = tagDisplay.createSpan({ cls: 'weave-tag-chip', text: newTag });
        const removeBtn = chip.createSpan({ cls: 'weave-tag-remove', text: '\u00d7' });
        removeBtn.onclick = () => { newTag = ''; renderTag(); };
      }
    }
    renderTag();
    
    const tagInput = tagInputContainer.createEl('input', { 
      type: 'text', 
      placeholder: '输入标签后按回车添加' 
    });
    tagInput.style.width = '100%';
    tagInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && tagInput.value.trim()) {
        e.preventDefault();
        newTag = tagInput.value.trim();
        tagInput.value = '';
        renderTag();
      }
    });
    
    // 按钮
    const btnContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'flex-end';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginTop = '16px';
    
    const cancelBtn = btnContainer.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();
    
    const saveBtn = btnContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      if (!newName.trim()) return;
      try {
        const oldName = deck.name;
        deck.name = newName.trim();
        deck.tags = newTag ? [newTag] : [];
        deck.updatedAt = new Date().toISOString();
        await storageService.saveDeck(deck);

        if (oldName !== deck.name) {
          try {
            await storageService.migrateChunkDeckNameInYAML(oldName, deck.name);
          } catch (e) {
            logger.warn('[IRDeckView] YAML 迁移失败:', e);
          }
          try {
            const outputRoot = plugin.settings?.incrementalReading?.importFolder;
            const chunkFileService = new IRChunkFileService(plugin.app, outputRoot);
            await chunkFileService.renameDeckIndexCard(oldName, deck.name);
          } catch (e) {
            logger.warn('[IRDeckView] 索引卡片重命名失败:', e);
          }
        }

        await loadDecks();
        window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
        plugin.app.workspace.trigger('Weave:data-changed');
        new Notice('牌组已更新');
        modal.close();
      } catch (error) {
        logger.error('[IRDeckView] 编辑失败:', error);
        new Notice('编辑失败');
      }
    };
    
    modal.open();
  }

  // 处理开始阅读（使用学习队列）- V4版本
  async function handleStartReading(deckPath: string) {
    logger.info('[IRDeckView] ========== handleStartReading V4 开始 ==========');
    logger.info('[IRDeckView] deckPath:', deckPath);
    
    try {
      // V4: 使用 IRStorageAdapterV4
      logger.debug('[IRDeckView] 初始化 IRStorageAdapterV4...');
      const storageAdapter = new IRStorageAdapterV4(plugin.app);
      await storageAdapter.initialize();
      logger.debug('[IRDeckView] IRStorageAdapterV4 初始化完成');
      
      // 获取 V4 格式的内容块
      const allBlocksV4 = await storageAdapter.getBlocksByDeckV4Fast(deckPath);
      logger.info('[IRDeckView] 牌组总内容块数(V4):', allBlocksV4.length);
      if (allBlocksV4.length > 0) {
        logger.debug('[IRDeckView] 第一个块状态:', allBlocksV4[0].status, 'nextRepDate:', allBlocksV4[0].nextRepDate);
      }
      
      await services.init();
      const timeBudgetMinutes = plugin.settings?.incrementalReading?.dailyTimeBudgetMinutes ?? 40;
      const queueResult = await services.v4SchedulerService!.getStudyQueueV4(deckPath, {
        timeBudgetMinutes,
        currentSourcePath: null,
        markActive: true,
        preloadedBlocks: allBlocksV4
      });
      const dueBlocksV4 = queueResult.queue;
      logger.info(
        '[IRDeckView] 学习队列生成(V4/DRR):',
        'len=',
        dueBlocksV4.length,
        'candidate=',
        queueResult.stats.candidateCount,
        'budgetMin=',
        timeBudgetMinutes,
        'estMin=',
        queueResult.totalEstimatedMinutes.toFixed(1),
        'persistedTransitions=',
        queueResult.stats.persistedTransitions
      );
      
      // 获取牌组名称（同时匹配 id 和 path，解决牌组名显示为ID的问题）
      const deck = decks.find(d => d.id === deckPath || d.path === deckPath);
      const deckName = deck?.name || deckPath.split('/').pop() || '增量阅读';

      const stats = deckStats[deckPath];
      const focusStats = {
        timeBudgetMinutes,
        estimatedMinutes: queueResult.totalEstimatedMinutes,
        candidateCount: queueResult.stats.candidateCount,
        dueToday: stats?.dueToday ?? 0,
        dueWithinDays: stats?.dueWithinDays ?? 0,
        learnAheadDays: plugin.settings?.incrementalReading?.learnAheadDays ?? 3
      };
      
      // 队列为空时：显示选择模态窗而非自动进入全量阅读
      if (dueBlocksV4.length === 0) {
        logger.warn('[IRDeckView] 队列为空! 总块数:', allBlocksV4.length);
        
        if (allBlocksV4.length === 0) {
          new Notice('该牌组暂无内容块');
          return;
        }
        
        // 获取统计信息用于模态窗显示
        noBlocksModalDeckPath = deckPath;
        noBlocksModalDeckName = deckName;
        noBlocksModalStats = stats ? {
          totalBlocks: stats.totalCount,
          dueToday: stats.dueToday,
          dueWithinDays: stats.dueWithinDays,
          learnAheadDays: plugin.settings?.incrementalReading?.learnAheadDays ?? 3
        } : { totalBlocks: allBlocksV4.length, dueToday: 0, dueWithinDays: 0, learnAheadDays: plugin.settings?.incrementalReading?.learnAheadDays ?? 3 };
        showNoBlocksModal = true;
        
        logger.info('[IRDeckView] 显示空队列选择模态窗');
        return;
      }
      
      logger.info('[IRDeckView] 准备打开阅读界面V4, deckName:', deckName);
      
      // 使用到期队列
      const blocksToUse = dueBlocksV4;
      
      if (onStartReading) {
        logger.info('[IRDeckView] 调用 onStartReading 回调...');
        onStartReading(deckPath, blocksToUse, deckName, focusStats);
      } else {
        logger.info('[IRDeckView] 直接调用 plugin.openIRFocusView (完整界面)...');
        // v6.0: 直接传递 V4 blocks
        await plugin.openIRFocusView(deckPath, blocksToUse, deckName, focusStats);
        logger.info('[IRDeckView] 已打开完整聚焦阅读界面:', deckPath, '学习队列:', blocksToUse.length);
      }
      logger.info('[IRDeckView] ========== handleStartReading V4 完成 ==========');
    } catch (error) {
      logger.error('[IRDeckView] ========== handleStartReading V4 失败 ==========');
      logger.error('[IRDeckView] 开始阅读失败:', error);
      new Notice('开始阅读失败');
    }
  }
  
  // v2.1: 提前阅读（阅读所有内容块，不管是否到期）- V4版本
  async function handleAdvanceReading(deckPath: string, overrideLearnAheadDays?: number) {
    try {
      // V4: 使用 IRStorageAdapterV4
      const storageAdapter = new IRStorageAdapterV4(plugin.app);
      await storageAdapter.initialize();
      
      // 获取所有 V4 格式内容块
      let allBlocksV4 = await storageAdapter.getBlocksByDeckV4(deckPath);

      // 合并 PDF 书签任务
      try {
        const pdfService = new IRPdfBookmarkTaskService(plugin.app);
        await pdfService.initialize();
        const pdfTasks = await pdfService.getTasksByDeck(deckPath);
        for (const task of pdfTasks) {
          allBlocksV4.push(pdfService.toBlockV4(task));
        }
      } catch (e) {
        logger.debug('[IRDeckView] 提前阅读：加载 PDF 书签任务失败', e);
      }
      
      // 获取待读天数设置（默认3天）
      const baseLearnAheadDays = plugin.settings?.incrementalReading?.learnAheadDays ?? 3;
      const learnAheadDays = overrideLearnAheadDays ?? baseLearnAheadDays;
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const endMs = endOfToday.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const safeDays = Math.max(learnAheadDays, 1);
      const limitMs = endMs + (safeDays - 1) * dayMs;
      
      // 过滤 suspended/done 状态、#ignore 标签，以及超出提前阅读上限的内容块
      allBlocksV4 = allBlocksV4.filter(b => {
        // 过滤 suspended 和 done 状态
        if (b.status === 'suspended' || b.status === 'done') return false;
        
        // 过滤带有 #ignore 标签的内容块
        const hasIgnoreInTags = b.tags?.some(tag => 
          tag.toLowerCase() === 'ignore' || tag.toLowerCase() === '#ignore'
        ) || false;
        
        // 备用检查: notes 中是否包含 #ignore
        const hasIgnoreInContent = /#ignore\b/i.test(b.notes || '');
        
        const hasIgnoreTag = hasIgnoreInTags || hasIgnoreInContent;
        
        if (hasIgnoreTag) {
          logger.debug(`[IRDeckView] 提前阅读V4：过滤忽略标签内容块: ${b.id}`);
          return false;
        }
        
        // 过滤超出待读天数范围的内容块（nextRepDate 为 0 表示新块，始终包含）
        if (b.nextRepDate && b.nextRepDate > limitMs) {
          logger.debug(`[IRDeckView] 提前阅读V4：过滤超出${learnAheadDays}天范围的内容块: ${b.id}`);
          return false;
        }
        
        return true;
      });
      
      if (allBlocksV4.length === 0) {
        const deck = decks.find(d => d.id === deckPath || d.path === deckPath);
        const deckName = deck?.name || deckPath.split('/').pop() || '增量阅读';

        if (!overrideLearnAheadDays && baseLearnAheadDays === 14) {
          temporaryLearnAheadDeckPath = deckPath;
          temporaryLearnAheadDeckName = deckName;
          showTemporaryLearnAheadModal = true;
          return;
        }

        new Notice(`该牌组暂无可提前阅读的内容块（限${learnAheadDays}天内到期）`);
        return;
      }
      
      // v5.5: 使用 calculateSelectionScore 算法对队列进行排序
      if (allBlocksV4.length > 1) {
        allBlocksV4 = allBlocksV4
          .map(block => ({ block, score: calculateSelectionScore(block, null) }))
          .sort((a, b) => b.score - a.score)
          .map(item => item.block);
        logger.info('[IRDeckView] 提前阅读队列已按算法排序');
      }
      
      // 获取牌组名称（同时匹配 id 和 path，解决牌组名显示为ID的问题）
      const deck = decks.find(d => d.id === deckPath || d.path === deckPath);
      const deckName = deck?.name || deckPath.split('/').pop() || '增量阅读';
      
      if (onStartReading) {
        onStartReading(deckPath, allBlocksV4, deckName);
      } else {
        // v6.0: 直接传递 V4 blocks
        await plugin.openIRFocusView(deckPath, allBlocksV4, deckName);
        logger.info('[IRDeckView] 已打开提前阅读完整界面:', deckPath, '总块数:', allBlocksV4.length);
      }
    } catch (error) {
      logger.error('[IRDeckView] 提前阅读V4失败:', error);
      new Notice('提前阅读失败');
    }
  }

  // 复制文件到导入文件夹
  async function copyFileToImportFolder(file: TFile, targetFolder: string): Promise<TFile> {
    const adapter = plugin.app.vault.adapter;
    
    // 确保目标文件夹存在
    await DirectoryUtils.ensureDirRecursive(adapter, targetFolder);
    
    // 生成目标文件路径（处理重名）
    let targetPath = `${targetFolder}/${file.basename}.${file.extension}`;
    let counter = 1;
    while (await adapter.exists(targetPath)) {
      targetPath = `${targetFolder}/${file.basename}-${counter}.${file.extension}`;
      counter++;
    }
    
    // 读取源文件内容
    const content = await plugin.app.vault.read(file);
    
    // 创建新文件
    const newFile = await plugin.app.vault.create(targetPath, content);
    logger.info(`[IRDeckView] ✅ 文件已复制: ${file.path} -> ${newFile.path}`);
    
    return newFile;
  }

  // 检查文件是否已在导入文件夹中
  function isInImportFolder(filePath: string, importFolder: string): boolean {
    return filePath.startsWith(importFolder + '/');
  }

  // 处理导入文件夹
  async function handleImport(folderPaths: string[]) {
    try {
      // 🔧 简化：直接初始化服务
      const storageService = new IRStorageService(plugin.app);
      await storageService.initialize();
      const deckManager = new IRDeckManager(plugin.app, storageService, plugin.settings?.incrementalReading?.importFolder);
      const contentSplitter = new IRContentSplitter(plugin.app, storageService);
      
      // 获取导入目标文件夹
      const importFolder = resolveIRImportFolder(
        plugin.settings?.incrementalReading?.importFolder,
        plugin.settings?.weaveParentFolder
      );
      logger.info(`[IRDeckView] ========================================`);
      logger.info(`[IRDeckView] 开始导入，目标文件夹: ${importFolder}`);
      
      new Notice(`正在导入 ${folderPaths.length} 个文件夹...`);
      
      let importedCount = 0;
      let copiedFiles = 0;
      
      for (const path of folderPaths) {
        try {
          // 导入牌组（使用导入文件夹路径作为牌组路径）
          const deck = await deckManager.importFolder(importFolder);
          logger.debug('[IRDeckView] 导入牌组成功:', deck.path);
          
          // 扫描源文件夹中的文件
          const sourceFiles = await deckManager.getDeckFiles(path);
          logger.info(`[IRDeckView] 扫描到源文件: ${sourceFiles.length} 个`);
          
          for (const file of sourceFiles) {
            try {
              let targetFile = file;
              
              // 检查文件是否已在导入文件夹中
              if (isInImportFolder(file.path, importFolder)) {
                logger.debug(`[IRDeckView] 文件已在导入文件夹中，跳过复制: ${file.path}`);
              } else {
                // 复制文件到导入文件夹
                logger.info(`[IRDeckView] 复制文件: ${file.path} -> ${importFolder}`);
                targetFile = await copyFileToImportFolder(file, importFolder);
                copiedFiles++;
              }
              
              // 拆分文件并获取内容块
              const blocks = await contentSplitter.splitFile(targetFile, importFolder, deck.settings);
              
              // v2.2: 写入拆分标记到文件
              if (blocks.length > 0) {
                await contentSplitter.injectInitialMarkers(targetFile, blocks, deck.settings);
                logger.info(`[IRDeckView] ✅ 已写入 ${blocks.length} 个内容块标记: ${targetFile.path}`);
              }
            } catch (fileError) {
              logger.error(`[IRDeckView] 处理文件失败: ${file.path}`, fileError);
            }
          }
          
          importedCount++;
        } catch (e) {
          logger.error('[IRDeckView] 导入单个文件夹失败:', path, e);
        }
      }
      
      // 刷新数据
      logger.debug('[IRDeckView] 开始刷新牌组列表...');
      await loadDecks();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
      
      logger.info(`[IRDeckView] ========================================`);
      logger.info(`[IRDeckView] 导入完成: ${importedCount} 个牌组, ${copiedFiles} 个文件已复制`);
      new Notice(`成功导入 ${importedCount} 个牌组，复制了 ${copiedFiles} 个文件`);
    } catch (error) {
      logger.error('[IRDeckView] 导入失败:', error);
      new Notice('导入失败: ' + (error as Error).message);
    }
  }

  // 监听导入事件（从左上角菜单触发）
  $effect(() => {
    const handleIRImport = () => {
      openImportModal();
    };
    
    document.addEventListener('ir-import-folder', handleIRImport);
    
    return () => {
      document.removeEventListener('ir-import-folder', handleIRImport);
    };
  });

  // 监听数据更新事件（学习结束、删除牌组等操作后刷新统计）
  $effect(() => {
    const handleDataUpdate = () => {
      loadDecks();
    };
    
    window.addEventListener('Weave:ir-data-updated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('Weave:ir-data-updated', handleDataUpdate);
    };
  });

  onMount(() => {
    loadDecks();
  });
</script>

<div class="ir-deck-view">
  <!-- 加载状态 -->
  {#if isLoading}
    <div class="ir-loading">
      <div class="ir-loading-spinner"></div>
      <span>正在加载...</span>
    </div>
  {:else if decks.length === 0}
    <!-- 空状态（简化版，与记忆牌组一致） -->
    <div class="mode-placeholder">
      <div class="placeholder-icon">--</div>
      <h2 class="placeholder-title">暂无增量阅读牌组</h2>
      <p class="placeholder-desc">点击左上角菜单导入文件夹开始增量阅读</p>
    </div>
  {:else}
    <!-- 牌组网格（复用记忆牌组的卡片设计） -->
    <div class="cards-grid">
      {#each decks as irDeck, index (irDeck.id || irDeck.path || index)}
        {@const deckId = irDeck.id || irDeck.path || ''}
        {@const irStats = getStats(deckId)}
        {@const colorVariant = ((index % 4) + 1) as 1 | 2 | 3 | 4}
        
        {#if deckCardStyle === 'chinese-elegant'}
          <!-- 典雅风格卡片 -->
          <IRDeckCard
            deck={irDeck}
            stats={irStats}
            {colorVariant}
            compact={false}
            onStudy={() => handleStartReading(deckId)}
            onMenu={(e) => showDeckMenu(e, irDeck)}
          />
        {:else}
          <!-- 默认风格卡片 -->
          {@const colorScheme = getColorSchemeForDeck(deckId)}
          <DeckGridCard
            deck={toMemoryDeck(irDeck)}
            stats={toMemoryStats(irStats)}
            {colorScheme}
            deckMode="incremental-reading"
            onStudy={() => handleStartReading(deckId)}
            onMenu={(e) => showDeckMenu(e, irDeck)}
          />
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- 导入模态窗 -->
<MaterialImportModal
  {plugin}
  bind:open={showImportModal}
  onClose={() => showImportModal = false}
  onImportComplete={handleImportComplete}
/>

<!-- 负载预测模态窗 -->
{#if showLoadForecastModal}
  <IRLoadForecastModal
    bind:open={showLoadForecastModal}
    {plugin}
    initialDeckId={loadForecastDeckId}
    onClose={() => {
      showLoadForecastModal = false;
      loadForecastDeckId = undefined;
    }}
  />
{/if}

<!-- 空队列选择模态窗 -->
{#if showNoBlocksModal}
  <IRNoBlocksAvailableModal
    deckName={noBlocksModalDeckName}
    stats={noBlocksModalStats}
    onClose={() => {
      showNoBlocksModal = false;
      noBlocksModalDeckPath = '';
      noBlocksModalDeckName = '';
      noBlocksModalStats = undefined;
    }}
    onAdvanceReading={() => {
      showNoBlocksModal = false;
      handleAdvanceReading(noBlocksModalDeckPath);
    }}
    onGoToMemoryDeck={() => {
      showNoBlocksModal = false;
    }}
  />
{/if}

{#if showTemporaryLearnAheadModal}
  <IRTemporaryLearnAheadModal
    deckName={temporaryLearnAheadDeckName}
    minDays={15}
    maxDays={30}
    initialDays={30}
    onClose={() => {
      showTemporaryLearnAheadModal = false;
      temporaryLearnAheadDeckPath = '';
      temporaryLearnAheadDeckName = '';
    }}
    onConfirm={(days) => {
      showTemporaryLearnAheadModal = false;
      handleAdvanceReading(temporaryLearnAheadDeckPath, days);
      temporaryLearnAheadDeckPath = '';
      temporaryLearnAheadDeckName = '';
    }}
  />
{/if}

<style>
  .ir-deck-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    overflow: auto;
  }

  /* 加载状态 */
  .ir-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-muted);
    gap: 1rem;
  }

  .ir-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 空状态（与记忆牌组一致） */
  .mode-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    flex: 1;
    pointer-events: none;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    opacity: 0.6;
  }

  .placeholder-title {
    margin: 0 0 0.75rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .placeholder-desc {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.95rem;
    max-width: 300px;
  }

  /* 牌组网格（与记忆牌组一致） */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    padding: 0.5rem 0;
  }

  /* 响应式 */
  @media (max-width: 640px) {
    .cards-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
