<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount } from 'svelte';
  import { Notice } from 'obsidian';
  import type WeavePlugin from '../../main';
  import type { AnkiConnectSettings, DeckSyncMapping } from './types/settings-types';
  import type { ConnectionStatus, AnkiDeckInfo, AnkiModelInfo } from '../../types/ankiconnect-types';
  import type { Deck } from '../../data/types';
  
  import { AnkiConnectService } from '../../services/ankiconnect/AnkiConnectService';
  import { ConnectionErrorType } from '../../types/ankiconnect-types';
  import { UnifiedBackupService } from '../../services/ankiconnect/backup/UnifiedBackupService';
  import { tr } from '../../utils/i18n';
import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  
  // 导入子组件
  import DeckMappingSection from './ankiconnect/DeckMappingSection.svelte';
  import SyncProgressModal from './ankiconnect/SyncProgressModal.svelte';
  import ConnectionManager from './ankiconnect/components/ConnectionManager.svelte';
  import AutoSyncConfig from './ankiconnect/components/AutoSyncConfig.svelte';
  import AdvancedSettings from './ankiconnect/components/AdvancedSettings.svelte';
  
  //  高级功能限制
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';
  import PremiumBadge from '../premium/PremiumBadge.svelte';
  import ActivationPrompt from '../premium/ActivationPrompt.svelte';
  
  let {
    plugin
  }: {
    plugin: WeavePlugin;
  } = $props();

  // 响应式翻译
  let t = $derived($tr);

  /**
   * 获取默认设置
   */
  function getDefaultSettings(): AnkiConnectSettings {
    return {
      enabled: false,
      endpoint: 'http://localhost:8765',
      mediaSync: {
        enabled: true,
        largeFileThresholdMB: 10,
        supportedTypes: ['png', 'jpg', 'jpeg', 'gif', 'mp3', 'mp4'],
        createBacklinks: true
      },
      autoSync: {
        enabled: false,
        intervalMinutes: 30,
        syncOnStartup: false,
        onlyWhenAnkiRunning: true,
        prioritizeRecent: true
      },
      bidirectionalSync: {
        enabled: false,
        conflictResolution: 'weave_wins'
      },
      deckMappings: {},
      templateMappings: {},
      tutorialCompleted: false,
      tutorialStep: 0
    };
  }

  // 初始化设置
  if (!plugin.settings.ankiConnect) {
    plugin.settings.ankiConnect = getDefaultSettings();
  }

  // 响应式状态
  let settings = $state(plugin.settings.ankiConnect);
  // 使用插件级别的服务实例（持久化）
  let ankiService = $state<AnkiConnectService | null>(plugin.ankiConnectService);
  let connectionStatus = $state<ConnectionStatus | null>(null);
  let ankiDecks = $state<AnkiDeckInfo[]>([]);
  let ankiModels = $state<AnkiModelInfo[]>([]);
  let weaveDecks = $state<Deck[]>([]);
  let backupService = $state<UnifiedBackupService | null>(null);

  // 派生状态
  let isConnected = $derived(connectionStatus?.isConnected ?? false);

  // 加载状态
  let isTesting = $state(false);
  let isRefreshing = $state(false);
  let isFetchingDecks = $state(false);
  let isFetchingModels = $state(false);

  // 🆕 连接状态（用于心跳显示）
  let connectionState = $state<any>(null);
  
  // 统一的进度模态窗状态
  let progressModal = $state({
    open: false,
    operation: 'fetch_models' as 'fetch_models' | 'sync_to_anki' | 'sync_from_anki' | 'batch_sync',
    title: '',
    current: 0,
    total: 0,
    status: '',
    currentItem: '',
    deckIndex: 0,
    totalDecks: 0
  });

  //  高级功能守卫
  const premiumGuard = PremiumFeatureGuard.getInstance();
  let isPremium = $state(false);
  let showActivationPrompt = $state(false);
  let promptFeatureId = $state('');

  // 订阅高级版状态
  $effect(() => {
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      isPremium = value;
    });
    return unsubscribe;
  });

  /**
   * 测试连接
   */
  async function testConnection() {
    isTesting = true;
    
    try {
      // 如果插件级别的服务不存在，初始化它
      if (!plugin.ankiConnectService) {
        await plugin.initializeAnkiConnect();
        ankiService = plugin.ankiConnectService;
      }
      
      // 使用插件级别的服务实例
      if (!ankiService) {
        throw new Error('AnkiConnect 服务初始化失败');
      }
      
      const status = await ankiService.testConnection();
      connectionStatus = status;
      
      // 🆕 连接成功后启动心跳监控（如果尚未启动）
      if (status.isConnected) {
        ankiService.startConnectionMonitoring();
        // 获取连接状态用于 UI 显示
        connectionState = ankiService.getConnectionState();
      }
      
      // 保存连接状态到缓存
      if (!settings.uiCache) {
        settings.uiCache = {
          ankiDecks: [],
          ankiModels: [],
          lastFetchTime: '',
          lastConnectionStatus: status
        };
      } else {
        settings.uiCache.lastConnectionStatus = status;
      }
      
      //  不 await，异步保存不阻塞 UI
      saveSettings(false).catch((error) => {
        logger.error('保存连接状态失败:', error);
      });
      
      if (status.isConnected) {
        new Notice(t('ankiConnect.notices.connectSuccess'));
        //  不自动刷新，提示用户手动操作
        setTimeout(() => {
          new Notice(t('ankiConnect.notices.connectHint'), 3000);
        }, 500);
      } else {
        new Notice(t('ankiConnect.notices.connectFailed') + (status.error?.message || t('common.unknown')));
      }
    } catch (error: any) {
      connectionStatus = {
        isConnected: false,
        lastCheckTime: new Date().toISOString(),
        error: {
          type: ConnectionErrorType.UNKNOWN,
          message: error.message,
          suggestion: '请确保 Anki 正在运行且已安装 AnkiConnect 插件'
        }
      };
      new Notice(t('ankiConnect.notices.connectTestFailed') + error.message);
    } finally {
      //  确保一定会重置状态
      isTesting = false;
    }
  }

  /**
   * 刷新数据（仅刷新牌组，模板改为按需加载）
   */
  async function refreshData() {
    if (!ankiService || !isConnected) {
      new Notice(t('ankiConnect.notices.pleaseTestFirst'));
      return;
    }
    
    isRefreshing = true;
    
    try {
      //  只刷新牌组，模板改为按需加载
      await Promise.all([
        fetchAnkiDecks(),
        loadWeaveDecks()
      ]);
      new Notice(t('ankiConnect.notices.dataRefreshed'));
    } catch (error: any) {
      new Notice(t('ankiConnect.notices.refreshFailed') + error.message);
    } finally {
      isRefreshing = false;
    }
  }

  /**
   * 获取 Anki 牌组列表
   */
  async function fetchAnkiDecks() {
    if (!ankiService) return;
    
    isFetchingDecks = true;
    
    try {
      const decks = await ankiService.getAnkiDecks();
      ankiDecks = decks;
      
      // 更新缓存
      if (!settings.uiCache) {
        settings.uiCache = {
          ankiDecks: [],
          ankiModels: [],
          lastFetchTime: new Date().toISOString()
        };
      }
      settings.uiCache.ankiDecks = decks;
      settings.uiCache.lastFetchTime = new Date().toISOString();

      saveSettings(false).catch((error) => {
        logger.error('保存 Anki 牌组缓存失败:', error);
      });
      
      //  不再自动创建映射，改为显示获取成功的通知
      new Notice(t('ankiConnect.notices.fetchedDecks', { count: decks.length }));
    } catch (error: any) {
      logger.error('获取 Anki 牌组失败:', error);
      new Notice(t('ankiConnect.notices.fetchDecksFailed') + error.message);
      throw error;
    } finally {
      isFetchingDecks = false;
    }
  }

  /**
   * 获取 Anki 模板列表（按需加载，带进度模态窗）
   */
  async function fetchAnkiModels() {
    if (!ankiService) {
      new Notice(t('ankiConnect.notices.pleaseTestFirst'));
      return;
    }
    
    isFetchingModels = true;
    
    // 打开进度模态窗
    progressModal = {
      open: true,
      operation: 'fetch_models',
      title: t('ankiConnect.notices.fetchModelsTitle'),
      current: 0,
      total: 0,
      status: t('ankiConnect.notices.preparing'),
      currentItem: '',
      deckIndex: 0,
      totalDecks: 0
    };
    
    try {
      const models = await ankiService.getAnkiModels((current, total) => {
        // 更新进度
        progressModal.current = current;
        progressModal.total = total;
        progressModal.status = '正在获取模板信息';
      });
      
      ankiModels = models;
      
      // 更新缓存
      if (settings.uiCache) {
        settings.uiCache.ankiModels = models;
        settings.uiCache.lastFetchTime = new Date().toISOString();

        saveSettings(false).catch((error) => {
          logger.error('保存 Anki 模板缓存失败:', error);
        });
      }
      
      // 关闭进度模态窗
      progressModal.open = false;
      
      new Notice(t('ankiConnect.notices.fetchedModels', { count: models.length }));
    } catch (error: any) {
      logger.error('获取 Anki 模板失败:', error);
      progressModal.open = false;
      new Notice(t('ankiConnect.notices.fetchModelsFailed') + error.message);
    } finally {
      isFetchingModels = false;
    }
  }

  /**
   * 加载 Weave 牌组列表
   */
  async function loadWeaveDecks() {
    try {
      // 从 plugin 的 dataStorage 获取真实的 Weave 牌组
      if (plugin.dataStorage) {
        const decks = await plugin.dataStorage.getDecks();
        weaveDecks = decks;
        // Weave牌组加载完成
      } else {
        logger.warn('DataStorage 未初始化');
        weaveDecks = [];
      }
    } catch (error: any) {
      logger.error('加载 Weave 牌组失败:', error);
      weaveDecks = [];
    }
  }

  /**
   * 自动创建牌组映射
   * 
   * 为每个 Anki 牌组创建映射，但不自动设置 Weave 牌组名称
   * 让用户手动选择对应的 Weave 牌组
   */
  //  移除自动创建映射的逻辑
  // function autoCreateMappings(decks: AnkiDeckInfo[]) {
  //   不再自动创建，改为用户手动添加
  // }

  /**
   * 添加牌组映射
   */
  function addDeckMapping(mapping: DeckSyncMapping) {
    // 使用 Anki 牌组名称作为 key
    const mappingId = mapping.ankiDeckName;
    
    // 检查是否已存在
    if (settings.deckMappings[mappingId]) {
      new Notice(t('ankiConnect.notices.mappingExists', { name: mapping.ankiDeckName }));
      return;
    }
    
    // 添加新映射
    settings.deckMappings = {
      ...settings.deckMappings,
      [mappingId]: mapping
    };
    
    // 映射添加成功
    saveSettings();
    new Notice(t('ankiConnect.notices.mappingAdded', { weave: mapping.weaveDeckName, anki: mapping.ankiDeckName }));
  }

  /**
   * 更新牌组映射
   */
  function updateDeckMapping(id: string, updates: Partial<DeckSyncMapping>) {
    const mapping = settings.deckMappings[id];
    if (!mapping) {
      logger.warn(`未找到映射: ${id}`);
      return;
    }
    
    //  简化逻辑：不改变 key，只更新值
    // 使用固定的 key 策略（Anki 牌组名称）
    settings.deckMappings = {
      ...settings.deckMappings,
      [id]: {
        ...mapping,
        ...updates
      }
    };
    
    // 牌组配置更新完成
    
    saveSettings();
  }

  /**
   * 删除牌组映射
   */
  function removeDeckMapping(id: string) {
    //  使用对象解构创建新对象，确保响应式更新
    const { [id]: removed, ...remaining } = settings.deckMappings;
    settings.deckMappings = remaining;
    saveSettings();
  }

  /**
   * 快速同步单个牌组
   */
  async function quickSyncToAnki(deckId: string) {
    if (!ankiService) {
      new Notice(t('ankiConnect.notices.pleaseInitFirst'));
      return;
    }
    
    const mapping = settings.deckMappings[deckId];
    if (!mapping) {
      new Notice(t('ankiConnect.notices.mappingNotFound'));
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // 打开进度模态窗
      progressModal = {
        open: true,
        operation: 'sync_to_anki',
        title: t('ankiConnect.notices.exportToAnkiTitle'),
        current: 0,
        total: 0,
        status: t('ankiConnect.notices.preparing'),
        currentItem: mapping.weaveDeckName,
        deckIndex: 1,
        totalDecks: 1
      };
      
      // 调用后端导出方法
      const result = await ankiService.exportDeckToAnki(
        mapping.weaveDeckId,
        mapping.ankiDeckName,
        (current, total, status) => {
          // 更新进度
          progressModal.current = current;
          progressModal.total = total;
          progressModal.status = status || t('ankiConnect.notices.syncingCards');
        }
      );
      
      // 关闭进度模态窗
      progressModal.open = false;
      
      if (result.success) {
        // 更新同步时间
        mapping.lastSyncTime = new Date().toISOString();
        await saveSettings(false);
        
        // 显示成功通知
        new Notice(
          t('ankiConnect.notices.syncComplete', { name: mapping.weaveDeckName, exported: result.exportedCards, skipped: result.skippedCards }),
          5000
        );
        
        if (result.errors.length > 0) {
          logger.warn('同步过程中出现警告:', result.errors);
        }
      } else {
        throw new Error(t('ankiConnect.notices.syncFailed'));
      }
    } catch (error: any) {
      progressModal.open = false;
      logger.error('同步牌组失败:', error);
      
      // 用户友好的错误消息
      let userMessage = t('ankiConnect.notices.syncFailed');
      if (error.message?.includes('not running') || error.message?.includes('未运行')) {
        userMessage = t('ankiConnect.notices.ankiNotRunning');
      } else if (error.message?.includes('deck') || error.message?.includes('牌组')) {
        userMessage = t('ankiConnect.notices.deckNotAccessible');
      } else if (error.message) {
        userMessage = error.message;
      }
      
      new Notice(userMessage, 5000);
    }
  }

  /**
   * 双向同步单个牌组
   */
  async function handleBidirectionalSync(deckId: string) {
    if (!ankiService) {
      new Notice(t('ankiConnect.notices.pleaseInitFirst'));
      return;
    }
    
    const mapping = settings.deckMappings[deckId];
    if (!mapping) {
      new Notice(t('ankiConnect.notices.mappingNotFound'));
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // 打开进度模态窗
      progressModal = {
        open: true,
        operation: 'batch_sync',
        title: t('ankiConnect.notices.bidirectionalSyncTitle'),
        current: 0,
        total: 0,
        status: t('ankiConnect.notices.preparing'),
        currentItem: mapping.weaveDeckName,
        deckIndex: 1,
        totalDecks: 1
      };
      
      new Notice(t('ankiConnect.notices.bidirectionalSyncing', { name: mapping.weaveDeckName }));
      
      // 先导入（从 Anki 到 Weave）
      progressModal.status = t('ankiConnect.notices.importingFromAnki');
      const importResult = await ankiService.importDeckWithTemplates(
        mapping.ankiDeckName,
        mapping.weaveDeckId,
        mapping.contentConversion,
        (current, total, status) => {
          progressModal.current = current;
          progressModal.total = total;
          progressModal.status = t('ankiConnect.notices.importPrefix') + (status || t('ankiConnect.notices.importingCards'));
        }
      );
      
      // 再导出（从 Weave 到 Anki）
      progressModal.status = t('ankiConnect.notices.exportingToAnki');
      const exportResult = await ankiService.exportDeckToAnki(
        mapping.weaveDeckId,
        mapping.ankiDeckName,
        (current, total, status) => {
          progressModal.current = current;
          progressModal.total = total;
          progressModal.status = t('ankiConnect.notices.exportPrefix') + (status || t('ankiConnect.notices.syncingCards'));
        }
      );
      
      // 关闭进度模态窗
      progressModal.open = false;
      
      if (importResult.success && exportResult.success) {
        // 更新同步时间
        mapping.lastSyncTime = new Date().toISOString();
        await saveSettings(false);
        
        // 显示成功通知
        new Notice(
          t('ankiConnect.notices.bidirectionalComplete', { name: mapping.weaveDeckName, imported: importResult.importedCards, exported: exportResult.exportedCards, skipped: importResult.skippedCards + exportResult.skippedCards }),
          6000
        );
        
        if (importResult.errors.length > 0 || exportResult.errors.length > 0) {
          logger.warn('双向同步过程中出现警告:', [...importResult.errors, ...exportResult.errors]);
        }
      } else {
        throw new Error(t('ankiConnect.notices.bidirectionalFailed'));
      }
    } catch (error: any) {
      progressModal.open = false;
      logger.error('双向同步失败:', error);
      
      let userMessage = t('ankiConnect.notices.bidirectionalFailed');
      if (error.message?.includes('not running') || error.message?.includes('未运行')) {
        userMessage = t('ankiConnect.notices.ankiNotRunning');
      } else if (error.message) {
        userMessage = error.message;
      }
      
      new Notice(userMessage, 5000);
    }
  }

  /**
   * 从 Anki 导入牌组（包括模板和卡片）
   */
  async function handleImportDeck(ankiDeckName: string, weaveDeckId: string) {
    if (!ankiService) {
      new Notice(t('ankiConnect.notices.pleaseInitFirst'));
      return;
    }

    try {
      // 打开进度模态窗
      progressModal = {
        open: true,
        operation: 'sync_from_anki',
        title: t('ankiConnect.notices.importFromAnkiTitle'),
        current: 0,
        total: 0,
        status: t('ankiConnect.notices.preparing'),
        currentItem: ankiDeckName,
        deckIndex: 1,
        totalDecks: 1
      };

      const mappingForImport = settings.deckMappings?.[ankiDeckName];
      const contentConversion = mappingForImport?.contentConversion;

      const result = await ankiService.importDeckWithTemplates(
        ankiDeckName,
        weaveDeckId,
        contentConversion,
        (current, total, status) => {
          // 更新进度模态窗
          progressModal.current = current;
          progressModal.total = total;
          progressModal.status = status || t('ankiConnect.notices.importingCards');
        }
      );

      // 关闭进度模态窗
      progressModal.open = false;

      if (result.success) {
        // 更新映射的同步时间
        const mapping = Object.values(settings.deckMappings).find(
          m => m.ankiDeckName === ankiDeckName && m.weaveDeckId === weaveDeckId
        );
        if (mapping) {
          const mappingId = Object.keys(settings.deckMappings).find(
            key => settings.deckMappings[key] === mapping
          );
          if (mappingId) {
            updateDeckMapping(mappingId, { lastSyncTime: new Date().toISOString() });
          }
        }

        new Notice(
          t('ankiConnect.notices.importComplete', { cards: result.importedCards, templates: result.importedTemplates, skipped: result.skippedCards }),
          8000
        );

        if (result.errors.length > 0) {
          logger.warn('导入过程中出现错误:', result.errors);
          new Notice(t('ankiConnect.notices.importWarnings', { count: result.errors.length }), 5000);
        }
      } else {
        throw new Error(t('ankiConnect.notices.importFailedError'));
      }
    } catch (error: any) {
      // 关闭进度模态窗
      progressModal.open = false;
      logger.error('导入牌组失败:', error);
      new Notice(t('ankiConnect.notices.importFailed') + error.message, 8000);
    }
  }

  /**
   * 执行批量同步
   */
  async function performSync(mode: 'to_anki' | 'from_anki' | 'bidirectional') {
    if (!ankiService) {
      new Notice(t('ankiConnect.notices.pleaseInitFirst'));
      return;
    }
    
    // 过滤启用的映射
    let enabledMappings: DeckSyncMapping[] = Object.values(settings.deckMappings).filter((m: DeckSyncMapping) => m.enabled);
    
    // 根据模式过滤同步方向
    if (mode === 'to_anki') {
      enabledMappings = enabledMappings.filter((m: DeckSyncMapping) => m.syncDirection !== 'from_anki');
    } else if (mode === 'from_anki') {
      enabledMappings = enabledMappings.filter((m: DeckSyncMapping) => m.syncDirection !== 'to_anki');
    }
    
    if (enabledMappings.length === 0) {
      new Notice(t('ankiConnect.notices.noEnabledMappings'));
      return;
    }
    
    const startTime = Date.now();
    const results = {
      totalDecks: enabledMappings.length,
      successDecks: 0,
      failedDecks: 0,
      totalCards: 0,
      successCards: 0,
      skippedCards: 0,
      errors: [] as string[]
    };
    
    try {
      // 打开进度模态窗
      progressModal = {
        open: true,
        operation: mode === 'to_anki' ? 'sync_to_anki' : (mode === 'from_anki' ? 'sync_from_anki' : 'batch_sync'),
        title: mode === 'to_anki' ? t('ankiConnect.notices.batchExportTitle') : (mode === 'from_anki' ? t('ankiConnect.notices.batchImportTitle') : t('ankiConnect.notices.batchBidirectionalTitle')),
        current: 0,
        total: 0,
        status: t('ankiConnect.notices.preparing'),
        currentItem: '',
        deckIndex: 0,
        totalDecks: enabledMappings.length
      };
      
      // 遍历处理每个牌组
      for (let i = 0; i < enabledMappings.length; i++) {
        const mapping = enabledMappings[i];
        
        // 更新当前牌组信息
        progressModal.currentItem = mapping.weaveDeckName;
        progressModal.deckIndex = i + 1;
        progressModal.current = 0;
        progressModal.total = 0;
        progressModal.status = t('ankiConnect.notices.processing');
        
        try {
          if (mode === 'to_anki') {
            // 同步到 Anki
            const result = await ankiService.exportDeckToAnki(
              mapping.weaveDeckId,
              mapping.ankiDeckName,
              (current, total, status) => {
                progressModal.current = current;
                progressModal.total = total;
                progressModal.status = status || t('ankiConnect.notices.syncingCards');
              }
            );
            
            if (result.success) {
              results.successDecks++;
              results.totalCards += result.exportedCards + result.skippedCards;
              results.successCards += result.exportedCards;
              results.skippedCards += result.skippedCards;
              
              // 更新映射的同步时间
              mapping.lastSyncTime = new Date().toISOString();
              
              if (result.errors.length > 0) {
                results.errors.push(`${mapping.weaveDeckName}: ${result.errors.map(e => e.message).join(', ')}`);
              }
            } else {
              throw new Error(t('ankiConnect.notices.exportFailed'));
            }
          } else if (mode === 'from_anki') {
            // 从 Anki 导入
            const result = await ankiService.importDeckWithTemplates(
              mapping.ankiDeckName,
              mapping.weaveDeckId,
              mapping.contentConversion,
              (current, total, status) => {
                progressModal.current = current;
                progressModal.total = total;
                progressModal.status = status || t('ankiConnect.notices.importingCards');
              }
            );
            
            if (result.success) {
              results.successDecks++;
              results.totalCards += result.importedCards + result.skippedCards;
              results.successCards += result.importedCards;
              results.skippedCards += result.skippedCards;
              
              // 更新映射的同步时间
              mapping.lastSyncTime = new Date().toISOString();
              
              if (result.errors.length > 0) {
                results.errors.push(`${mapping.ankiDeckName}: ${result.errors.map(e => e.message).join(', ')}`);
              }
            } else {
              throw new Error(t('ankiConnect.notices.importFailedError'));
            }
          }
        } catch (error: any) {
          results.failedDecks++;
          results.errors.push(`${mapping.weaveDeckName}: ${error.message}`);
          logger.error(`处理牌组 "${mapping.weaveDeckName}" 失败:`, error);
          // 继续处理下一个牌组
        }
      }
      
      // 关闭进度模态窗
      progressModal.open = false;
      
      // 保存设置
      await saveSettings(false);
      
      // 显示汇总通知
      if (results.failedDecks === 0) {
        new Notice(
          t('ankiConnect.notices.batchComplete', { success: results.successDecks, total: results.totalDecks, cards: results.successCards }),
          6000
        );
      } else {
        new Notice(
          t('ankiConnect.notices.batchCompleteWithErrors', { success: results.successDecks, failed: results.failedDecks }),
          8000
        );
      }
      
      if (results.errors.length > 0) {
        logger.warn('批量同步错误详情:', results.errors);
      }
    } catch (error: any) {
      progressModal.open = false;
      logger.error('批量处理失败:', error);
      new Notice(t('ankiConnect.notices.batchFailed') + error.message, 5000);
    }
  }

  /**
   * 保存设置
   */
  async function saveSettings(showNotice: boolean = true) {
    const oldSettings = plugin.settings.ankiConnect;
    plugin.settings.ankiConnect = settings;
    
    // AnkiConnect设置已保存
    
    await plugin.saveSettings();
    
    // 检查是否需要重新初始化服务
    const enabledChanged = oldSettings?.enabled !== settings.enabled;
    const endpointChanged = oldSettings?.endpoint !== settings.endpoint;
    
    if (enabledChanged) {
      await plugin.toggleAnkiConnect(settings.enabled);
      ankiService = plugin.ankiConnectService;
    } else if (endpointChanged && settings.enabled) {
      await plugin.updateAnkiConnectEndpoint(settings.endpoint);
      ankiService = plugin.ankiConnectService;
    }

    if (settings.enabled && ankiService && !endpointChanged) {
      ankiService.updateSettings({
        mediaSync: settings.mediaSync,
        autoSync: settings.autoSync
      });
    }
    
    if (showNotice) {
      new Notice(t('ankiConnect.notices.settingsSaved'));
    }
  }

  /**
   * 初始化 AnkiConnect 服务
   */
  async function initializeAnkiService() {
    try {
      // 启动AnkiConnect服务
      
      if (!ankiService) {
        ankiService = new AnkiConnectService(plugin, plugin.app, settings);
      }
      
      // 启动连接监控
      ankiService.startConnectionMonitoring();
      // 连接监控已启动
      
      // 启动自动同步（如果配置启用）
      if (settings.autoSync?.enabled) {
        ankiService.startAutoSync();
        // 自动同步已启动
      }
      
      // 更新插件实例
      (plugin as any).ankiConnectService = ankiService;
      
      new Notice(t('ankiConnect.notices.serviceStarted'));
    } catch (error: any) {
      logger.error('[AnkiConnect] 服务启动失败:', error);
      new Notice(t('ankiConnect.notices.startupFailed') + error.message);
    }
  }

  /**
   * 停止 AnkiConnect 服务
   */
  async function stopAnkiService() {
    try {
      // 停止AnkiConnect服务
      
      const service = ankiService || (plugin as any).ankiConnectService;
      
      if (service) {
        // 停止自动同步
        try {
          service.stopAutoSync();
          // 自动同步已停止
        } catch (error) {
          logger.warn('[AnkiConnect] 停止自动同步失败:', error);
        }
        
        // 停止连接监控
        try {
          service.stopConnectionMonitoring();
          // 连接监控已停止
        } catch (error) {
          logger.warn('[AnkiConnect] 停止连接监控失败:', error);
        }
      }
      
      // 清理状态
      connectionStatus = null;
      ankiService = null;
      (plugin as any).ankiConnectService = null;
      
      new Notice(t('ankiConnect.notices.serviceStopped'));
    } catch (error: any) {
      logger.error('[AnkiConnect] 服务停止失败:', error);
      // 不抛出错误，确保用户可以继续操作
    }
  }

  /**
   * 响应式监听：settings.enabled 变化时自动启动/停止服务
   */
  $effect(() => {
    const isEnabled = settings.enabled;
    const hasService = !!(ankiService || (plugin as any).ankiConnectService);
    
    if (isEnabled && !hasService) {
      // 启用且服务未运行 → 启动服务
      initializeAnkiService();
    } else if (!isEnabled && hasService) {
      // 禁用且服务正在运行 → 停止服务
      stopAnkiService();
    }
  });

  /**
   * 切换功能启用状态
   */
  function toggleEnabled() {
    // 保存设置（响应式 effect 会自动处理服务启停）
    saveSettings(false).catch((error) => {
      logger.error('保存设置失败:', error);
      new Notice(t('ankiConnect.notices.saveFailed'));
    });
  }

  /**
   * 初始化
   */
  onMount(async () => {
    // AnkiConnect面板初始化完成
    
    // 初始化备份服务
    backupService = new UnifiedBackupService(plugin);
    await backupService.initialize().catch(error => {
      logger.error('初始化备份服务失败:', error);
    });
    
    // 加载缓存数据
    if (settings.uiCache) {
      ankiDecks = settings.uiCache.ankiDecks || [];
      ankiModels = settings.uiCache.ankiModels || [];
      
      // 恢复上次的连接状态
      if (settings.uiCache.lastConnectionStatus) {
        connectionStatus = settings.uiCache.lastConnectionStatus;
      }
      
      //  检查缓存是否过期（超过1小时）
      if (settings.uiCache.lastFetchTime) {
        const lastFetch = new Date(settings.uiCache.lastFetchTime);
        const now = new Date();
        const hoursSinceLastFetch = (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastFetch > 1 && ankiDecks.length > 0) {
          // 显示提示
          setTimeout(() => {
            new Notice(t('ankiConnect.notices.dataExpired'), 5000);
          }, 2000);
        }
      }
    }
    
    //  加载 Weave 本地牌组列表
    loadWeaveDecks().catch(error => {
      logger.error('加载 Weave 牌组失败:', error);
    });
    
    //  不自动测试连接，由用户手动触发
  });
</script>

<div class="weave-settings settings-section anki-connect-section">
  <!-- 主开关 -->
  <div class="settings-group">
    <div class="section-header">
      <h3 class="section-title with-accent-bar accent-red">{t('ankiConnect.title')}</h3>
      <p class="section-description">{t('ankiConnect.description')}</p>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">{t('ankiConnect.enable.label')}</div>
        <div class="setting-description">
          {t('ankiConnect.enable.description')}
        </div>
      </div>
      <div class="setting-control">
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={settings.enabled}
            onchange={toggleEnabled}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  </div>

  {#if settings.enabled}
    <!-- 连接管理 -->
    <div class="settings-group">
      <h4 class="group-title with-accent-bar accent-green">{t('ankiConnect.connection.title')}</h4>
      
      <!-- 连接状态与测试 -->
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">{t('ankiConnect.connection.status')}</div>
          <div class="setting-description">
            {#if isTesting}
              {t('ankiConnect.notices.testing')}
            {:else if connectionStatus === null}
              {t('ankiConnect.notices.notTested')}
            {:else if connectionStatus.isConnected}
              {t('ankiConnect.notices.connected')} {#if connectionStatus.apiVersion}<span style="opacity: 0.7;">· API v{connectionStatus.apiVersion}</span>{/if}
            {:else}
              {t('ankiConnect.notices.disconnected')}
            {/if}
          </div>
        </div>
        <div class="setting-control">
          <button
            class="btn-primary"
            onclick={testConnection}
            disabled={isTesting}
          >
            {isTesting ? t('ankiConnect.connection.statusLabel.testing') : t('ankiConnect.connection.testConnection')}
          </button>
        </div>
      </div>

      {#if connectionStatus?.error}
        <div class="error-banner">
          <div class="error-text">{connectionStatus.error.message}</div>
          {#if connectionStatus.error.suggestion}
            <div class="error-suggestion">{connectionStatus.error.suggestion}</div>
          {/if}
        </div>
      {/if}

      <!-- CORS 配置提示 -->
      <div class="info-banner cors-hint">
        <div class="info-content">
          <div class="info-title">{t('ankiConnect.notices.corsTitle')}</div>
          <div class="info-text">
            {@html t('ankiConnect.notices.corsDesc')}
          </div>
          <div class="info-code">
            <pre>"webCorsOriginList": [
    "http://localhost",
    "app://obsidian.md"
]</pre>
            <button class="copy-btn" onclick={() => {
              navigator.clipboard.writeText('"webCorsOriginList": [\n    "http://localhost",\n    "app://obsidian.md"\n]');
              new Notice(t('ankiConnect.notices.copiedToClipboard'));
            }}>{t('ankiConnect.notices.copyBtn')}</button>
          </div>
        </div>
      </div>

      <!-- 端点配置 -->
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">{t('ankiConnect.connection.address.label')}</div>
          <div class="setting-description">
            {t('ankiConnect.connection.address.description')}
          </div>
        </div>
        <div class="setting-control">
          <input
            type="text"
            class="text-input"
            bind:value={settings.endpoint}
            onblur={() => saveSettings()}
            placeholder="http://localhost:8765"
          />
        </div>
      </div>
    </div>

    <!-- 自动同步配置 -->
    <div class="settings-group">
      <h4 class="group-title with-accent-bar accent-purple">{t('ankiConnect.autoSync.title')}</h4>
      
      <!-- 启用自动同步 -->
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">{t('ankiConnect.autoSync.enable')}</div>
          <div class="setting-description">
            {t('ankiConnect.autoSync.enableDesc')}
          </div>
        </div>
        <div class="setting-control">
          <label class="toggle-switch">
            <input
              type="checkbox"
              bind:checked={settings.autoSync.enabled}
              onchange={() => {
                if (settings.autoSync.enabled && ankiService) {
                  ankiService.startAutoSync();
                } else if (ankiService) {
                  ankiService.stopAutoSync();
                }
                saveSettings();
              }}
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      {#if settings.autoSync.enabled}
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">{t('ankiConnect.autoSync.intervalLabel')}</div>
            <div class="setting-description">
              {t('ankiConnect.autoSync.intervalDesc')}
            </div>
          </div>
          <div class="setting-control">
            <input
              type="number"
              class="number-input"
              bind:value={settings.autoSync.intervalMinutes}
              onblur={() => saveSettings()}
              min="5"
              max="1440"
            />
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">{t('dataManagement.backup.auto.triggers.onStartup')}</div>
            <div class="setting-description">
              {t('dataManagement.backup.auto.triggers.onStartupDesc')}
            </div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                type="checkbox"
                bind:checked={settings.autoSync.syncOnStartup}
                onchange={() => saveSettings()}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">{t('ankiConnect.autoSync.fileWatcherLabel')}</div>
            <div class="setting-description">
              {t('ankiConnect.autoSync.fileWatcherDesc')}
            </div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                type="checkbox"
                bind:checked={settings.autoSync.enableFileWatcher}
                onchange={() => saveSettings()}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      {/if}
    </div>

    <!-- 媒体同步设置 -->
    <div class="settings-group">
      <h4 class="group-title with-accent-bar accent-orange">{t('ankiConnect.sectionSync.title')}</h4>
      
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">{t('ankiConnect.sectionSync.enable')}</div>
          <div class="setting-description">
            {t('ankiConnect.sectionSync.enableDesc')}
          </div>
        </div>
        <div class="setting-control">
          <label class="toggle-switch">
            <input
              type="checkbox"
              bind:checked={settings.mediaSync.enabled}
              onchange={() => saveSettings()}
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    {#if isConnected}
      <!-- 牌组管理 -->
      <DeckMappingSection
        {ankiDecks}
        {weaveDecks}
        {isFetchingDecks}
        {settings}
        mappings={settings.deckMappings}
        onFetchDecks={fetchAnkiDecks}
        onAddMapping={addDeckMapping}
        onUpdateMapping={updateDeckMapping}
        onRemoveMapping={removeDeckMapping}
        onSync={quickSyncToAnki}
        onImport={handleImportDeck}
        onBidirectionalSync={handleBidirectionalSync}
        onBatchSync={performSync}
      />
    {/if}
  {/if}
  
  <!-- 进度模态窗 -->
  <SyncProgressModal
    open={progressModal.open}
    operation={progressModal.operation}
    title={progressModal.title}
    current={progressModal.current}
    total={progressModal.total}
    status={progressModal.status}
    currentItem={progressModal.currentItem}
    deckIndex={progressModal.deckIndex}
    totalDecks={progressModal.totalDecks}
  />
  
  <!--  激活提示 -->
  <ActivationPrompt
    featureId={promptFeatureId}
    visible={showActivationPrompt}
    onClose={() => showActivationPrompt = false}
  />
</div>

<style>
  /* AnkiConnect 特有样式 */
  .anki-connect-section {
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  /*  关键修复：强制交互性 - 解决UI阻塞问题 */
  .anki-connect-section input,
  .anki-connect-section .toggle-switch {
    pointer-events: auto !important;
    position: relative;
    z-index: 1;
  }

  /* 错误横幅 */
  .error-banner {
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 0.5rem;
    width: 100%;
    margin: 1rem 0;
  }

  .error-text {
    font-size: 14px;
    color: var(--text-error);
    margin-bottom: 4px;
  }

  .error-suggestion {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* CORS 配置提示样式 */
  .info-banner {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    margin: 16px 0;
  }

  .info-banner .info-content {
    flex: 1;
    min-width: 0;
  }

  .info-banner .info-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .info-banner .info-text {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .info-banner .info-code {
    margin-top: 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .info-banner .info-code pre {
    margin: 0;
    padding: 12px;
    font-family: var(--font-monospace);
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-normal);
    overflow-x: auto;
    white-space: pre;
  }

  .info-banner .info-code .copy-btn {
    display: block;
    width: 100%;
    padding: 8px;
    background: var(--background-secondary);
    border: none;
    border-top: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .info-banner .info-code .copy-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 按钮样式 */
  .btn-primary {
    padding: 8px 16px;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .text-input {
    width: 250px;
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    color: var(--text-normal);
    font-size: 14px;
    transition: border-color 0.2s;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  /* ========== AnkiConnect 表格样式 ========== */
  .anki-connect-section :global(.anki-table) {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .anki-connect-section :global(.anki-table thead) {
    background: var(--background-secondary);
  }

  .anki-connect-section :global(.anki-table th) {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    border-bottom: 2px solid var(--background-modifier-border);
    border-right: 1px solid var(--background-modifier-border-hover);
  }

  .anki-connect-section :global(.anki-table th:last-child) {
    border-right: none;
  }

  .anki-connect-section :global(.anki-table tbody tr) {
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background-color 0.15s ease;
  }

  .anki-connect-section :global(.anki-table tbody tr:last-child) {
    border-bottom: none;
  }

  .anki-connect-section :global(.anki-table tbody tr:hover) {
    background: var(--background-modifier-hover);
  }

  .anki-connect-section :global(.anki-table td) {
    padding: 12px 16px;
    font-size: 14px;
    border-right: 1px solid var(--background-modifier-border-hover);
  }

  .anki-connect-section :global(.anki-table td:last-child) {
    border-right: none;
  }

  /* 表格容器 */
  .anki-connect-section :global(.mapping-table-container),
  .anki-connect-section :global(.log-table-container) {
    width: 100%;
    overflow-x: auto;
    margin-top: 16px;
    border-radius: 8px;
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 768px) {
    .text-input {
      width: 100%;
    }
  }
</style>



