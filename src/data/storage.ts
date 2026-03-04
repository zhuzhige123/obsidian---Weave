// Anki Plugin Data Storage
// 使用Obsidian的API进行数据持久化存储

import { TFile } from "obsidian";
import type { Card, Deck, DeckStats, UserProfile, AnkiExportData, DataQuery, ApiResponse } from "./types";
import { CardType } from "./types";
import type { ProgressiveClozeChildCard } from "../types/progressive-cloze-v2";
import type { StudySession } from "./study-types";
import type { WeavePlugin } from '../main';
import { Notice } from 'obsidian';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../types/utility-types';
import { PATHS, PLUGIN_PATHS, WEAVE_DATA, getBackupPath, getV2Paths, normalizeWeaveParentFolder } from '../config/paths';
import { DirectoryUtils } from "../utils/directory-utils";
import { setCardProperties, extractBodyContent, parseYAMLFromContent, type CardYAMLMetadata } from '../utils/yaml-utils';
import { detectCardTypeFromContent } from '../utils/card-markdown-serializer';
import { GUIDE_DECK_NAME, GUIDE_DECK_DESCRIPTION, GUIDE_DECK_TAGS, GUIDE_CARDS } from './guide-deck-data';
import { safeWriteJson, safeReadJson } from '../utils/safe-json-io';
import { weaveEventBus } from '../events/WeaveEventBus';

export class WeaveDataStorage {
  private plugin: WeavePlugin;

  /** 待刷写的 deck cardUUIDs 增量（deckId → Set<cardUUID>） */
  private _pendingDeckCardUUIDs = new Map<string, Set<string>>();
  /** 防抖定时器 */
  private _deckCardUUIDsFlushTimer: ReturnType<typeof setTimeout> | null = null;
  /** 防抖延迟（ms） */
  private static readonly DECK_CARD_UUIDS_FLUSH_DELAY = 300;

  private get v2Paths() {
    const parentFolder = normalizeWeaveParentFolder(this.plugin.settings?.weaveParentFolder);
    return getV2Paths(parentFolder);
  }
  
  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 数据文件夹路径（固定）
   */
  private get dataFolder(): string {
    return this.v2Paths.root;
  }

  private isAbsoluteVaultPath(path: string): boolean {
    return (
      path.startsWith(`${WEAVE_DATA}/`) ||
      path.startsWith(`${this.v2Paths.root}/`) ||
            path.startsWith('.obsidian/')
    );
  }

  // 初始化数据存储
  async initialize(): Promise<void> {
    try {
      logger.info("🚀 Initializing Anki data storage...");
      logger.info(`📁 Data folder: ${this.dataFolder}`);
      
      // 确保数据文件夹存在
      logger.info("📂 Creating data directories...");
      await this.ensureDataFolder();
      
      // 初始化必要的数据文件
      logger.info("📄 Creating data files...");
      await this.ensureDataFiles();

      // 如无任何牌组，则自动创建一个默认牌组，避免新建卡片时无 deckId
      logger.info("🎯 Ensuring default deck...");
      await this.ensureDefaultDeck();
      
      // 🆕 首次使用时创建指南牌组（用户手动删除后不再自动恢复）
      if (!this.plugin.settings?.skipGuideDeck) {
        logger.info("📖 Checking guide deck...");
        await this.ensureGuideDeckExists();
      } else {
        logger.debug("📖 Guide deck skipped (user previously deleted it)");
      }
      
      // 验证初始化结果
      const decks = await this.getDecks();
      logger.info(`✅ Anki data storage initialized successfully! Found ${decks.length} deck(s)`);
    } catch (error) {
      logger.error("❌ Failed to initialize data storage:", error);
      // 不再抛出错误，允许插件继续运行
      logger.warn("Plugin will continue running with default data...");
    }
  }

  private async ensureDefaultDeck(): Promise<void> {
    await this.ensureDefaultDeckExists();
  }

  // 确保数据文件夹存在
  private async ensureDataFolder(): Promise<void> {
    try {
      //  使用递归创建以支持任意嵌套深度
      await DirectoryUtils.ensureDirRecursive(this.plugin.app.vault.adapter, this.dataFolder);
    } catch (error) {
      logger.error(`❌ 创建数据根目录失败: ${this.dataFolder}`, error);
      throw error; // 抛出错误，因为根目录是必需的
    }
  }

  // 确保必要的数据文件存在
  private async ensureDataFiles(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    
    // V2.0 目录结构（完全使用新路径）
    const folders = [
      // 记忆牌组模块
      this.v2Paths.memory.root,
      this.v2Paths.memory.cards,
      this.v2Paths.memory.learning.root,
      this.v2Paths.memory.learning.sessions,
      this.v2Paths.memory.media,
      // 插件配置目录
      PLUGIN_PATHS.config.root,
    ];
    
    //  使用递归创建以支持嵌套目录
    for (const dir of folders) {
      try { 
        await DirectoryUtils.ensureDirRecursive(adapter, dir);
      } catch (error) {
        logger.warn(`⚠️ 创建目录失败: ${dir}`, error);
      }
    }

    // V2.0 数据文件（迁移由 SchemaV2MigrationService 处理）
    const fileEntries: Array<{ path: string; key: string }> = [
      { path: this.v2Paths.memory.decks, key: "decks.json" },
      { path: PLUGIN_PATHS.config.userProfile, key: "user-profile.json" },
    ];

    for (const { path: filePath, key } of fileEntries) {
      try {
        if (!await adapter.exists(filePath)) {
          const defaultData = this.getDefaultData(key);
          await adapter.write(filePath, JSON.stringify(defaultData));
        }
      } catch (error) {
        const errorMsg = extractErrorMessage(error);
        if (errorMsg.includes("already exists")) continue;
        logger.warn(`Data file creation warning for ${filePath}:`, error);
      }
    }
  }

  // 获取默认数据
  private getDefaultData(fileName: string): any {
    switch (fileName) {
      case "decks.json":
        return { decks: [] };
      case "user-profile.json":
        return this.createDefaultUserProfile();
      default:
        return {};
    }
  }

  // 确保至少存在一个默认牌组，避免首次使用时无法创建卡片
  private async ensureDefaultDeckExists(): Promise<void> {
    try {
      const decks = await this.getDecks();
      if (Array.isArray(decks) && decks.length > 0) {
        return;
      }

      logger.info("🔄 Creating default deck for first-time use...");
      const now = new Date();
      const defaultName = this.plugin.settings?.defaultDeck || "默认牌组";
      const profile = this.createDefaultUserProfile().profile;
      const defaultSettings = profile.globalSettings.defaultDeckSettings;
      const defaultDeck: Deck = {
        id: `deck_${Date.now().toString(36)}`,
        name: defaultName,
        description: "",
        category: "默认",
        path: defaultName,
        level: 0,
        order: 0,
        inheritSettings: false,
        created: now.toISOString(),
        modified: now.toISOString(),
        settings: defaultSettings,
        includeSubdecks: false,
        stats: {
          totalCards: 0,
          newCards: 0,
          learningCards: 0,
          reviewCards: 0,
          todayNew: 0,
          todayReview: 0,
          todayTime: 0,
          totalReviews: 0,
          totalTime: 0,
          memoryRate: 0,
          averageEase: 0,
          forecastDays: {}
        },
        tags: [],
        metadata: {}
      };

      await this.writeDecksFile({ decks: [defaultDeck] });
      logger.info("✅ Successfully created default deck:", defaultName);

      // 为默认牌组添加一张示例卡片
      const fsrs = this.plugin.fsrs;
      if (fsrs) {
        // 🆕 v0.8: 导入新ID生成器
        const { generateUUID } = await import('../utils/helpers');
        
        const sampleCard: Card = {
          uuid: generateUUID(), // 🆕 使用新格式UUID
          deckId: defaultDeck.id,
          //  templateId: 不再生成（改为可选字段）
          content: 'Obsidian 是什么？\n\n---div---\n\nObsidian 是一款强大的知识管理和笔记软件，支持双向链接和插件扩展。',
          //  Content-Only 架构：不再生成 fields
          type: CardType.Basic,  //  只需要 type 判断题型
          tags: ['入门'],
          created: now.toISOString(),
          modified: now.toISOString(),
          fsrs: fsrs.createCard(),
          reviewHistory: [],
          stats: { totalReviews: 0, totalTime: 0, averageTime: 0, memoryRate: 0 }
        };
        await this.saveDeckCards(defaultDeck.id, [sampleCard]);
        logger.info("✅ Added a sample card to the default deck.");
      }
    } catch (e) {
      // 更详细的错误处理
      const errorMsg = extractErrorMessage(e);
      if (errorMsg.includes("already exists") || errorMsg.includes("File already exists")) {
        try {
          // 尝试验证文件内容是否有效
          const existingDecks = await this.getDecks();
          if (Array.isArray(existingDecks) && existingDecks.length > 0) {
            // 文件有效
          } else {
            logger.warn("⚠️ Existing deck file is empty or invalid, updating content...");

            //  修复：直接更新已存在但内容无效的文件，而不是"修复"
            try {
              const now = new Date();
              const defaultName = this.plugin.settings?.defaultDeck || "默认牌组";
              const profile = this.createDefaultUserProfile().profile;
              const defaultSettings = profile.globalSettings.defaultDeckSettings;
              const defaultDeck: Deck = {
                id: `deck_${Date.now().toString(36)}`,
                name: defaultName,
                description: "自动创建的默认牌组",
                category: "默认",
                path: defaultName,
                level: 0,
                order: 0,
                inheritSettings: false,
                created: now.toISOString(),
                modified: now.toISOString(),
                settings: defaultSettings,
                includeSubdecks: false,
                stats: {
                  totalCards: 0,
                  newCards: 0,
                  learningCards: 0,
                  reviewCards: 0,
                  todayNew: 0,
                  todayReview: 0,
                  todayTime: 0,
                  totalReviews: 0,
                  totalTime: 0,
                  memoryRate: 0,
                  averageEase: 0,
                  forecastDays: {}
                },
                tags: [],
                metadata: { autoCreated: true }
              };

              //  修复：直接更新文件内容，而不是尝试创建新文件
              await this.writeDecksFile({ decks: [defaultDeck] });
              logger.info("✅ Successfully updated deck file with default deck");
            } catch (updateError) {
              logger.error("❌ Failed to update deck file:", updateError);
              logger.info("ℹ️ Continuing with plugin initialization despite deck file issue");
            }
          }
        } catch (readError) {
          logger.warn("⚠️ Could not validate existing deck file:", readError);
        }
      } else {
        logger.warn("⚠️ ensureDefaultDeck failed:", e);
      }
    }
  }

  /**
   * 手动恢复官方教程牌组（用户从菜单点击"恢复官方教程牌组"时调用）
   * 重置 skipGuideDeck 设置并重新创建教程牌组
   */
  async restoreGuideDeck(): Promise<boolean> {
    try {
      // 重置 skipGuideDeck 设置
      if (this.plugin.settings) {
        this.plugin.settings.skipGuideDeck = false;
        await this.plugin.saveSettings();
      }
      await this.ensureGuideDeckExists();
      return true;
    } catch (e) {
      logger.error("restoreGuideDeck failed:", e);
      return false;
    }
  }

  /**
   * 确保指南牌组存在（首次使用时创建）
   * 包含 24 张教程卡片，帮助用户快速了解插件功能
   */
  async ensureGuideDeckExists(): Promise<void> {
    try {
      const decks = await this.getDecks();
      
      // 检查是否已存在指南牌组
      const existingGuideDeck = decks.find(deck => deck.name === GUIDE_DECK_NAME);
      if (existingGuideDeck) {
        try {
          const existingCards = await this.getCardsByDeck(existingGuideDeck.id);
          const existingFronts = new Set(
            existingCards
              .map(c => (c.content || '').trim().split('\n\n---div---\n\n')[0]?.trim())
              .filter(Boolean)
          );

          const missing = GUIDE_CARDS.filter(cd => !existingFronts.has(cd.front.trim()));
          if (missing.length === 0) {
            logger.debug("📖 Guide deck already exists, skipping creation");
            return;
          }

          const fsrs = this.plugin.fsrs;
          if (!fsrs) {
            return;
          }

          const { generateUUID } = await import('../utils/helpers');
          const now = new Date();
          const baseTime = now.getTime();

          for (let i = 0; i < missing.length; i++) {
            const cardData = missing[i];
            const newCard: Card = {
              uuid: generateUUID(),
              deckId: existingGuideDeck.id,
              content: `${cardData.front}\n\n---div---\n\n${cardData.back}`,
              type: CardType.Basic,
              tags: [...GUIDE_DECK_TAGS, ...cardData.tags],
              created: new Date(baseTime + i).toISOString(),
              modified: new Date(baseTime + i).toISOString(),
              fsrs: fsrs.createCard(),
              reviewHistory: [],
              stats: { totalReviews: 0, totalTime: 0, averageTime: 0, memoryRate: 0 }
            };

            await this.saveCard(newCard);
          }

          const updatedDeck = await this.getDeck(existingGuideDeck.id);
          if (updatedDeck) {
            const count = updatedDeck.cardUUIDs?.length || 0;
            updatedDeck.stats = updatedDeck.stats || {} as any;
            (updatedDeck.stats as any).totalCards = count;
            if (typeof (updatedDeck.stats as any).newCards === 'number') {
              (updatedDeck.stats as any).newCards = (updatedDeck.stats as any).newCards + missing.length;
            }
            updatedDeck.modified = new Date().toISOString();
            await this.saveDeck(updatedDeck);
            await this.updateDeckIndexStats(updatedDeck.id, count);
          }

          logger.info(`✅ Added ${missing.length} guide cards to the guide deck`);
        } catch (e) {
          logger.warn("⚠️ ensureGuideDeckExists upgrade failed:", e);
        }
        return;
      }

      logger.info("📖 Creating guide deck...");
      const now = new Date();
      const profile = this.createDefaultUserProfile().profile;
      const defaultSettings = profile.globalSettings.defaultDeckSettings;
      
      const guideDeck: Deck = {
        id: `deck_guide_${Date.now().toString(36)}`,
        name: GUIDE_DECK_NAME,
        description: GUIDE_DECK_DESCRIPTION,
        category: "教程",
        path: GUIDE_DECK_NAME,
        level: 0,
        order: 1, // 排在默认牌组之后
        inheritSettings: false,
        created: now.toISOString(),
        modified: now.toISOString(),
        settings: defaultSettings,
        includeSubdecks: false,
        stats: {
          totalCards: GUIDE_CARDS.length,
          newCards: GUIDE_CARDS.length,
          learningCards: 0,
          reviewCards: 0,
          todayNew: 0,
          todayReview: 0,
          todayTime: 0,
          totalReviews: 0,
          totalTime: 0,
          memoryRate: 0,
          averageEase: 0,
          forecastDays: {}
        },
        tags: GUIDE_DECK_TAGS,
        metadata: { isBuiltIn: true, version: '1.0.0' }
      };

      // 保存牌组
      const existingDecks = await this.getDecks();
      await this.writeDecksFile({ decks: [...existingDecks, guideDeck] });
      logger.info("✅ Successfully created guide deck:", GUIDE_DECK_NAME);

      // 创建指南卡片
      const fsrs = this.plugin.fsrs;
      if (fsrs) {
        const { generateUUID } = await import('../utils/helpers');
        
        const guideCards: Card[] = GUIDE_CARDS.map((cardData, index) => ({
          uuid: generateUUID(),
          deckId: guideDeck.id,
          content: `${cardData.front}\n\n---div---\n\n${cardData.back}`,
          type: CardType.Basic,
          tags: [...GUIDE_DECK_TAGS, ...cardData.tags],
          created: new Date(now.getTime() + index).toISOString(), // 递增时间戳保持顺序
          modified: new Date(now.getTime() + index).toISOString(),
          fsrs: fsrs.createCard(),
          reviewHistory: [],
          stats: { totalReviews: 0, totalTime: 0, averageTime: 0, memoryRate: 0 }
        }));

        await this.saveDeckCards(guideDeck.id, guideCards);
        logger.info(`✅ Added ${guideCards.length} guide cards to the guide deck`);
      }
    } catch (e) {
      logger.warn("⚠️ ensureGuideDeckExists failed:", e);
      // 不阻止插件初始化
    }
  }

  // 创建默认用户配置
  private createDefaultUserProfile(): { profile: UserProfile } {
    return {
      profile: {
        id: "default-user",
        name: "Default User",
        created: new Date().toISOString(),
        globalSettings: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: "zh-CN",
          theme: "auto",
          defaultDeckSettings: {
            newCardsPerDay: 20,
            maxReviewsPerDay: 100,
            enableAutoAdvance: true,
            showAnswerTime: 0,
            fsrsParams: {
              // 使用标准FSRS6默认权重参数 (21个参数)
              w: [
                0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
                0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729,
                0.5425, 0.0912, 0.0658, 0.1542
              ],
              requestRetention: 0.9, // 修正为标准值
              maximumInterval: 36500,
              enableFuzz: true
            },
            learningSteps: [1, 10],
            relearningSteps: [10],
            graduatingInterval: 1,
            easyInterval: 4
          },
          enableNotifications: true,
          enableSounds: false,
          enableDebugMode: false,
          dataBackupInterval: 24
        },
        overallStats: {
          totalDecks: 0,
          totalCards: 0,
          totalStudyTime: 0,
          streakDays: 0
        }
      }
    };
  }

  // 牌组操作
  async getDecks(): Promise<Deck[]> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      // 完全使用 V2 路径
      const decksPath = this.v2Paths.memory.decks;
      const data = await safeReadJson<{ decks: Deck[] }>(adapter, decksPath);
      if (data) {
        const decks: Deck[] = data.decks || [];

        // 从独立文件合并 cardUUIDs
        for (const deck of decks) {
          if (!deck.cardUUIDs || deck.cardUUIDs.length === 0) {
            deck.cardUUIDs = await this.readDeckCardUUIDs(deck.id);
          } else {
            // 向后兼容：旧 decks.json 中内嵌了 cardUUIDs，迁移到独立文件
            await this.writeDeckCardUUIDs(deck.id, deck.cardUUIDs);
          }
        }

        return decks;
      }
      return [];
    } catch (_error) {
      return [];
    }
  }

  async getDeck(deckId: string): Promise<Deck | null> {
    try {
      const decks = await this.getDecks();
      return decks.find(deck => deck.id === deckId) || null;
    } catch (error) {
      logger.error("Failed to get deck:", error);
      return null;
    }
  }

  async getAllDecks(): Promise<Deck[]> {
    return this.getDecks();
  }

  async getCardsByDeck(deckId: string): Promise<Card[]> {
    // 🆕 v2.0: 完全引用式牌组架构
    // 优先使用 deck.cardUUIDs，同时支持 card.referencedByDecks
    try {
      const allCards = await this.getCards();
      const deck = await this.getDeck(deckId);
      
      let deckCards: Card[] = [];
      
      // 方式1：通过 deck.cardUUIDs 获取卡片（优先）
      if (deck?.cardUUIDs && deck.cardUUIDs.length > 0) {
        const cardByUUID = new Map<string, Card>();
        for (const card of allCards) {
          cardByUUID.set(card.uuid, card);
        }
        for (const uuid of deck.cardUUIDs) {
          const card = cardByUUID.get(uuid);
          if (card) {
            deckCards.push(card);
          }
        }
      }
      
      return deckCards;
    } catch (error) {
      logger.error(`[Storage] getCardsByDeck 失败:`, error);
      return [];
    }
  }

  async saveDeck(deck: Deck): Promise<ApiResponse<Deck>> {
    try {
      const decks = await this.getDecks();
      const existingIndex = decks.findIndex(d => d.id === deck.id);
      const isNew = existingIndex < 0;
      
      // 🆕 v2.1: 检测牌组重命名，更新映射和清除缓存
      let oldDeckName: string | undefined;
      if (existingIndex >= 0) {
        const existingDeck = decks[existingIndex];
        if (existingDeck.name !== deck.name) {
          oldDeckName = existingDeck.name;
        }
        decks[existingIndex] = { ...deck, modified: new Date().toISOString() };
      } else {
        decks.push({ ...deck, created: new Date().toISOString(), modified: new Date().toISOString() });
      }
      
      // 标记内部写入，避免 ExternalSyncWatcher 误触发
      (this.plugin as any).externalSyncWatcher?.markInternalWrite();
      
      await this.writeDecksFile({ decks });
      
      // cardUUIDs 分离写入独立文件
      if (deck.cardUUIDs) {
        await this.writeDeckCardUUIDs(deck.id, deck.cardUUIDs);
      }
      
      // 🆕 v2.1: 更新 DeckNameMapper
      if (this.plugin.deckNameMapper) {
        if (isNew) {
          this.plugin.deckNameMapper.onDeckCreated(deck);
        } else if (oldDeckName) {
          this.plugin.deckNameMapper.onDeckRenamed(deck.id, oldDeckName, deck.name);
          // 牌组重命名时清除所有缓存（因为 we_decks 存储的是名称）
          if (this.plugin.cardMetadataCache) {
            this.plugin.cardMetadataCache.clear();
          }
        }
      }
      
      // 🆕 确保数据写入完成后通知变更
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 🆕 通知数据同步服务
      const dataSyncService = (this.plugin as any).dataSyncService;
      if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
        await dataSyncService.notifyChange({
          type: 'decks',
          action: isNew ? 'create' : 'update',
          ids: [deck.id]
        });
      }
      
      //  桥接插件系统事件总线
      try {
        weaveEventBus.emitSync('deck:changed', { deck });
      } catch {}
      
      return {
        success: true,
        data: deck,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("Failed to save deck:", error);
      return {
        success: false,
        error: extractErrorMessage(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteDeck(deckId: string): Promise<ApiResponse<boolean>> {
    try {
      
      // 0. 预估卡片数量，提供进度反馈
      const cards = await this.getDeckCards(deckId);
      if (cards.length > 0) {
        // 使用Obsidian Notice显示进度
        const { Notice } = require('obsidian');
        new Notice(`🧹 正在清理 ${cards.length} 张卡片的源文档...`);
      }

      const decks = await this.getDecks();
      const filteredDecks = decks.filter(d => d.id !== deckId);

      // 1. 删除牌组索引
      await this.writeDecksFile({ decks: filteredDecks });

      // 1.5 删除 cardUUIDs 独立文件
      await this.deleteDeckCardUUIDs(deckId);

      // 2. 删除该牌组的所有卡片与媒体目录（含进度反馈）
      await this.deleteCardsByDeck(deckId);

      // 3. 清理相关的学习会话数据
      await this.cleanupStudySessionsByDeck(deckId);

      // 4. 清理媒体文件
      await this.cleanupDeckMediaFiles(deckId);

      // 5. 通知分析服务清理缓存
      await this.notifyDeckDeletion(deckId);
      
      // 🆕 v2.1: 更新 DeckNameMapper 和清除缓存
      if (this.plugin.deckNameMapper) {
        this.plugin.deckNameMapper.onDeckDeleted(deckId);
      }
      if (this.plugin.cardMetadataCache) {
        this.plugin.cardMetadataCache.clear();
      }

      logger.info(`🎉 牌组删除完成: ${deckId}`);
      
      // 🆕 确保数据写入完成后通知变更
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 🆕 通知数据同步服务
      const dataSyncService = (this.plugin as any).dataSyncService;
      if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
        await dataSyncService.notifyChange({
          type: 'decks',
          action: 'delete',
          ids: [deckId]
        });
      }

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("Failed to delete deck:", error);
      return {
        success: false,
        error: extractErrorMessage(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  // 卡片操作
  async getCards(query?: DataQuery): Promise<Card[]> {
    try {
      // 未指定 deckId：从统一卡片存储获取所有卡片
      let all: Card[] = [];
      
      
      // 从统一卡片存储 (weave/cards/) 读取
      try {
        if (this.plugin.cardFileService) {
          const unifiedCards = await this.plugin.cardFileService.getAllCards();
          // 🆕 v2.1: 从 content YAML 解析填充运行时字段
          all = unifiedCards.map(card => this.hydrateCardFromYAML(card));
        } else {
          logger.warn('[Storage] cardFileService 未初始化');
        }
      } catch (e) {
        logger.warn('[Storage] 统一存储读取失败:', e);
      }
      
      // 若指定了 deckId，通过 deck.cardUUIDs 或 card.referencedByDecks 过滤
      if (query?.deckId) {
        const deck = await this.getDeck(query.deckId);
        let deckCards: Card[] = [];
        
        // 方式1：通过 deck.cardUUIDs 获取卡片（优先）
        if (deck?.cardUUIDs && deck.cardUUIDs.length > 0) {
          const cardByUUID = new Map<string, Card>();
          for (const card of all) {
            cardByUUID.set(card.uuid, card);
          }
          for (const uuid of deck.cardUUIDs) {
            const card = cardByUUID.get(uuid);
            if (card) {
              deckCards.push(card);
            }
          }
        }
        
        // 方式2：通过 card.referencedByDecks 补充
        if (deckCards.length === 0) {
          deckCards = all.filter(c => 
            c.referencedByDecks && c.referencedByDecks.includes(query.deckId!)
          );
        }
        
        return query ? this.filterCards(deckCards, query) : deckCards;
      }
      
      return query ? this.filterCards(all, query) : all;
    } catch (error) {
      logger.error("Failed to get cards:", error);
      return [];
    }
  }

  async saveCard(card: Card): Promise<ApiResponse<Card>> {
    try {
      const { getProgressiveClozeGateway } = await import('../services/progressive-cloze/ProgressiveClozeGateway');
      const gateway = getProgressiveClozeGateway();
      
      //  检查是新卡片还是更新卡片
      // 🆕 v2.0: 从统一存储或所有来源查找现有卡片
      let existingCard: Card | undefined;
      
      // 优先从统一存储查找
      if (this.plugin.cardFileService) {
        const allCards = await this.plugin.cardFileService.getAllCards();
        existingCard = allCards.find(c => c.uuid === card.uuid);
      }
      
      // 回退：从旧的牌组文件夹查找
      if (!existingCard && card.deckId) {
        const deckCards = await this.getDeckCards(card.deckId);
        existingCard = deckCards.find(c => c.uuid === card.uuid);
      }
      
      // 第一道门：新卡片 - 渐进式挖空检测和转换
      if (!existingCard) {
        const processResult = await gateway.processNewCard(card);
        
        // 如果转换为渐进式挖空，需要保存多张卡片（父+子）
        if (processResult.converted) {
          logger.info(`检测到渐进式挖空，保存${processResult.cards.length}张卡片（1父 + ${processResult.cards.length - 1}子）`);
          
          // 保存所有卡片（父卡片在数组首位）
          const savedCards: Card[] = [];
          for (const c of processResult.cards) {
            const normalized = this.normalizeCardData(c);
            await this.saveCardInternal(normalized);
            savedCards.push(normalized);
          }
          
          // 返回父卡片（第一张）
          // 注意：渐进式挖空转换产生了${savedCards.length}张卡片
          return { 
            success: true, 
            data: savedCards[0], 
            timestamp: new Date().toISOString()
          };
        }
        
        // 标准化并保存单张卡片
        let normalizedCard = this.normalizeCardData(processResult.cards[0]);
        return await this.saveCardInternal(normalizedCard);
      }
      
      // 第二道门：更新卡片 - 内容变化检测和同步
      if (existingCard.type === 'progressive-parent' && existingCard.content !== card.content) {
        logger.info(`[Storage] 检测到父卡片内容变化，开始同步...`);
        
        // 构建确认回调（使用 Obsidian Modal）
        const onConfirmNeeded = async (message: string, title?: string): Promise<boolean> => {
          const { showObsidianConfirm } = await import('../utils/obsidian-confirm');
          return showObsidianConfirm(this.plugin.app, message, {
            title: title || '确认',
            confirmText: '确认',
            cancelText: '取消',
            confirmClass: 'mod-warning'
          });
        };
        
        // 调用Gateway的内容变化处理
        const updatedCards = await gateway.processContentChange(
          existingCard,
          card.content,
          {
            deleteCard: async (uuid: string) => {
              await this.deleteCard(uuid);
            },
            saveCard: async (c: Card) => {
              // 直接调用内部保存，避免递归
              const normalized = this.normalizeCardData(c);
              await this.saveCardInternal(normalized);
            },
            getDeckCards: async (deckId: string) => {
              return await this.getDeckCards(deckId);
            }
          },
          onConfirmNeeded
        );
        
        // 用户取消了保存操作
        if (updatedCards === null) {
          logger.info(`[Storage] 用户取消了渐进式挖空变更，保存已中止`);
          return { success: false, error: 'SAVE_CANCELLED', timestamp: new Date().toISOString() };
        }
        
        logger.info(`[Storage] 内容同步完成，更新了${updatedCards.length}张卡片`);
        
        // 返回父卡片
        return {
          success: true,
          data: updatedCards[0],
          timestamp: new Date().toISOString()
        };
      }
      
      // 普通更新：直接保存
      let normalizedCard = this.normalizeCardData(card);
      return await this.saveCardInternal(normalizedCard);
    } catch (error) {
      logger.error("Failed to save card:", error);
      return { success: false, error: extractErrorMessage(error), timestamp: new Date().toISOString() };
    }
  }

  /**
   * 🆕 v2.0: 安全的跨牌组移动方法（引用式架构）
   * 将卡片从一个牌组移动到另一个牌组
   * 使用 deck.cardUUIDs 和 card.referencedByDecks 进行引用管理
   * @param cardUuid 卡片UUID
   * @param sourceDeckId 源牌组ID
   * @param targetDeckId 目标牌组ID
   */
  async moveCardToDeck(cardUuid: string, sourceDeckId: string, targetDeckId: string): Promise<ApiResponse<Card>> {
    try {
      // 1. 验证参数
      if (!cardUuid) {
        return { success: false, error: '卡片UUID不能为空', timestamp: new Date().toISOString() };
      }
      
      if (sourceDeckId === targetDeckId) {
        return { success: false, error: '源牌组和目标牌组相同', timestamp: new Date().toISOString() };
      }
      
      // 2. 验证目标牌组存在
      const decks = await this.getDecks();
      const targetDeck = decks.find(d => d.id === targetDeckId);
      if (!targetDeck) {
        return { success: false, error: `目标牌组不存在: ${targetDeckId}`, timestamp: new Date().toISOString() };
      }
      
      // 3. 获取卡片
      const allCards = await this.getCards();
      const card = allCards.find(c => c.uuid === cardUuid);
      if (!card) {
        return { success: false, error: '卡片不存在', timestamp: new Date().toISOString() };
      }
      
      // 4. 🆕 v2.0: 使用引用式架构 - 更新 deck.cardUUIDs
      // 从源牌组移除引用
      if (sourceDeckId) {
        const sourceDeck = decks.find(d => d.id === sourceDeckId);
        if (sourceDeck && sourceDeck.cardUUIDs) {
          sourceDeck.cardUUIDs = sourceDeck.cardUUIDs.filter(uuid => uuid !== cardUuid);
          sourceDeck.modified = new Date().toISOString();
          await this.saveDeck(sourceDeck);
        }
      }
      
      // 添加到目标牌组
      if (!targetDeck.cardUUIDs) {
        targetDeck.cardUUIDs = [];
      }
      if (!targetDeck.cardUUIDs.includes(cardUuid)) {
        targetDeck.cardUUIDs.push(cardUuid);
        targetDeck.modified = new Date().toISOString();
        await this.saveDeck(targetDeck);
      }
      
      // 5. 🆕 v2.0: 更新卡片的反向引用 referencedByDecks
      const updatedCard = { ...card };
      if (!updatedCard.referencedByDecks) {
        updatedCard.referencedByDecks = [];
      }
      // 移除源牌组引用
      if (sourceDeckId) {
        updatedCard.referencedByDecks = updatedCard.referencedByDecks.filter(id => id !== sourceDeckId);
      }
      // 添加目标牌组引用
      if (!updatedCard.referencedByDecks.includes(targetDeckId)) {
        updatedCard.referencedByDecks.push(targetDeckId);
      }
      updatedCard.modified = new Date().toISOString();
      
      // 保存卡片到统一存储
      await this.saveCard(updatedCard);
      
      logger.info(`[Storage] ✅ 卡片移动成功 (引用式架构): ${cardUuid} 从 ${sourceDeckId} → ${targetDeckId}`);
      
      // 6. 通知数据同步服务
      const dataSyncService = (this.plugin as any).dataSyncService;
      if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
        await dataSyncService.notifyChange({
          type: 'cards',
          action: 'update',
          ids: [cardUuid],
          metadata: { targetDeckId, sourceDeckId }
        });
      }
      
      return { success: true, data: updatedCard, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('[Storage] 卡片移动失败:', error);
      return { success: false, error: extractErrorMessage(error), timestamp: new Date().toISOString() };
    }
  }

  /**
   * 🆕 v2.1: 从 content YAML 解析填充运行时字段
   * content 是唯一权威数据源，运行时字段作为缓存供其他组件使用
   * @private
   */
  private hydrateCardFromYAML(card: Card): Card {
    try {
      const yaml = parseYAMLFromContent(card.content || '');
      
      if (!yaml || Object.keys(yaml).length === 0) {
        return card; // 没有 YAML，返回原卡片
      }
      
      const hydrated: Card = { ...card };
      
      // 1. we_source → sourceFile（从 wikilink 格式解析）
      //  v2.1.1 修复：支持数组格式（YAML 列表）和字符串格式
      if (yaml.we_source) {
        // 处理数组格式: we_source:\n  - [[WCSP-003]]
        const sourceValue = Array.isArray(yaml.we_source) ? yaml.we_source[0] : yaml.we_source;
        if (sourceValue) {
          // [[文档名]] 或 [[文档名|别名]] → 文档名.md
          const match = sourceValue.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
          if (match) {
            hydrated.sourceFile = match[1].endsWith('.md') ? match[1] : `${match[1]}.md`;
          } else {
            hydrated.sourceFile = sourceValue;
          }
        }
      }
      
      // 2. we_block → sourceBlock（从块嵌入格式解析）
      //  v2.1.1 修复：支持多种 Obsidian 格式
      // - ![[文档名#^blockId]]
      // - [[文档名#^blockId]]
      // - ^blockId
      if (yaml.we_block) {
        const blockValue = Array.isArray(yaml.we_block) ? yaml.we_block[0] : yaml.we_block;
        if (blockValue) {
          // 匹配块ID: ^blockId 或 #^blockId
          const blockMatch = blockValue.match(/\^([a-zA-Z0-9_-]+)/);
          if (blockMatch) {
            hydrated.sourceBlock = blockMatch[1];
          }
          
          // 🆕 如果 we_block 包含文档名且 sourceFile 未设置，从中提取
          // 格式: ![[文档名#^blockId]] 或 [[文档名#^blockId]]
          if (!hydrated.sourceFile) {
            const docMatch = blockValue.match(/!?\[\[([^#\]|]+)(?:#\^[^\]]*)?\]\]/);
            if (docMatch) {
              hydrated.sourceFile = docMatch[1].endsWith('.md') ? docMatch[1] : `${docMatch[1]}.md`;
            }
          }
        }
      }
      
      // 3. we_decks → 需要通过 DeckNameMapper 转换（异步，这里只记录名称）
      // 注意：deckId 的转换在需要时通过 CardMetadataService 处理
      
      // 4. we_type → type（如果 YAML 中缺失则从内容自动检测，默认 basic）
      if (yaml.we_type) {
        hydrated.type = yaml.we_type;
      } else if (!hydrated.type) {
        const body = extractBodyContent(hydrated.content || '') || hydrated.content || '';
        hydrated.type = (detectCardTypeFromContent(body) || CardType.Basic) as any;
      }
      
      // 5. we_priority → priority
      if (yaml.we_priority !== undefined) {
        hydrated.priority = yaml.we_priority;
      }
      
      // 6. tags → tags
      if (yaml.tags && Array.isArray(yaml.tags)) {
        hydrated.tags = yaml.tags;
      }
      
      return hydrated;
    } catch (error) {
      logger.warn('[Storage] ⚠️ 从 YAML 解析运行时字段失败:', error);
      return card;
    }
  }

  /**
   * v2.1: 确保 content YAML 格式完整
   * 
   *  重要：content YAML 是唯一权威数据源
   * 此方法仅保留 YAML 现有值，不从派生字段反向同步
   * 派生字段（tags, priority 等）只是运行时缓存，不应写回 content
   * 
   * 如需修改元数据，应直接使用 yaml-utils 修改 content：
   * card.content = setCardProperty(card.content, 'tags', newTags);
   * 
   * @private
   */
  private async syncCardMetadataToYAML(card: Card): Promise<Card> {
    try {
      // content YAML 是唯一权威数据源，直接解析保留
      const existingYAML = parseYAMLFromContent(card.content || '') || {};
      
      // 调试日志：检查传入的 we_decks 值
      
      // 如果没有任何 YAML 元数据，直接返回原卡片
      if (Object.keys(existingYAML).length === 0) {
        return card;
      }
      
      // 保留 content 中已有的值，确保格式一致
      //  不从派生字段反向同步，只保留 YAML 现有值
      const metadata: CardYAMLMetadata = {};
      
      if (existingYAML.we_source) metadata.we_source = existingYAML.we_source;
      if (existingYAML.we_block) metadata.we_block = existingYAML.we_block;
      if (existingYAML.we_decks) metadata.we_decks = existingYAML.we_decks;
      // we_type：如果 YAML 中缺失，从内容自动检测并补写
      if (existingYAML.we_type) {
        metadata.we_type = existingYAML.we_type;
      } else {
        const body = extractBodyContent(card.content || '') || card.content || '';
        const detected = detectCardTypeFromContent(body);
        metadata.we_type = (detected || CardType.Basic) as any;
        logger.debug('[Storage] syncCardMetadataToYAML: we_type 缺失，自动检测为', metadata.we_type);
      }
      if (existingYAML.we_priority !== undefined) metadata.we_priority = existingYAML.we_priority;
      if (existingYAML.tags) metadata.tags = existingYAML.tags;
      if (existingYAML.we_created) metadata.we_created = existingYAML.we_created;
      
      // 使用 setCardProperties 确保 YAML 格式一致
      const newContent = setCardProperties(card.content || '', metadata);
      
      
      return {
        ...card,
        content: newContent
      };
    } catch (error) {
      logger.warn('[Storage] ⚠️ YAML 元数据处理失败，使用原卡片:', error);
      return card;
    }
  }

  /**
   * 内部保存方法：保存单张已标准化的卡片
   * 
   * 🆕 v2.0: 优先保存到统一卡片存储 (weave/cards/)
   * @private
   */
  private async saveCardInternal(normalizedCard: Card): Promise<ApiResponse<Card>> {
    // 验证UUID格式
    const { isValidUUID } = await import('../utils/helpers');
    if (!isValidUUID(normalizedCard.uuid)) {
      logger.error('[Storage] 卡片UUID格式无效:', normalizedCard.uuid);
      return {
        success: false,
        error: `卡片UUID格式无效: ${normalizedCard.uuid}`,
        timestamp: new Date().toISOString()
      };
    }
    
    const now = new Date();
    const isNew = true; // 假设是新卡片，后面会检查
    
    // 🆕 v2.1: 同步卡片元数据到 content 的 YAML frontmatter
    const cardWithYAML = await this.syncCardMetadataToYAML(normalizedCard);
    
    // 🆕 v2.0: 优先使用 CardFileService 保存到统一存储
    if (this.plugin.cardFileService) {
      try {
        // 准备卡片数据（移除 deckId，因为完全引用式架构不需要）
        const cardToSave: Card = {
          ...cardWithYAML,
          created: cardWithYAML.created || now.toISOString(),
          modified: now.toISOString()
        };
        
        // 通过 deck.cardUUIDs 管理牌组引用（防抖合并，避免批量导入时逐条写入）
        if (normalizedCard.deckId) {
          this._enqueueDeckCardUUID(normalizedCard.deckId, normalizedCard.uuid);
        }
        
        const success = await this.plugin.cardFileService.saveCard(cardToSave);
        if (success) {
          
          // 🆕 v2.1: 使卡片元数据缓存失效
          if (this.plugin.cardMetadataCache) {
            this.plugin.cardMetadataCache.invalidate(normalizedCard.uuid);
          }
          
          // 通知数据同步服务
          const dataSyncService = (this.plugin as any).dataSyncService;
          if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
            await dataSyncService.notifyChange({
              type: 'cards',
              action: isNew ? 'create' : 'update',
              ids: [normalizedCard.uuid],
              metadata: { deckId: normalizedCard.deckId }
            });
          }
          
          //  桥接插件系统事件总线
          try {
            weaveEventBus.emitSync('card:updated', { card: cardToSave });
          } catch {}
          
          return { success: true, data: cardToSave, timestamp: now.toISOString() };
        }
      } catch (error) {
        logger.warn('[Storage] CardFileService 保存失败:', error);
      }
    }

    return {
      success: false,
      error: 'CardFileService 未初始化或保存失败',
      timestamp: now.toISOString()
    };
  }

  async saveCardsBatch(cards: Card[]): Promise<void> {
    const normalizedCards = (cards || []).map(c => this.normalizeCardData(c));
    const result = await this.saveCardsInternalBatch(normalizedCards);
    if (!result.success) {
      throw new Error(result.error || '批量保存失败');
    }
  }

  private async saveCardsInternalBatch(normalizedCards: Card[]): Promise<ApiResponse<Card[]>> {
    try {
      if (!normalizedCards || normalizedCards.length === 0) {
        return { success: true, data: [], timestamp: new Date().toISOString() };
      }

      if (!this.plugin.cardFileService) {
        return {
          success: false,
          error: 'CardFileService 未初始化或保存失败',
          timestamp: new Date().toISOString()
        };
      }

      const { isValidUUID } = await import('../utils/helpers');
      const now = new Date();

      const deckToUUIDs = new Map<string, Set<string>>();
      const cardsToSave: Card[] = [];

      for (const c of normalizedCards) {
        if (!c?.uuid || !isValidUUID(c.uuid)) {
          continue;
        }

        const cardWithYAML = await this.syncCardMetadataToYAML(c);
        const cardToSave: Card = {
          ...cardWithYAML,
          created: cardWithYAML.created || now.toISOString(),
          modified: now.toISOString()
        };

        if (c.deckId) {
          const set = deckToUUIDs.get(c.deckId) || new Set<string>();
          set.add(c.uuid);
          deckToUUIDs.set(c.deckId, set);
        }

        cardsToSave.push(cardToSave);
      }

      for (const [deckId, uuidSet] of deckToUUIDs.entries()) {
        const deck = await this.getDeck(deckId);
        if (!deck) continue;
        const existing = new Set<string>(deck.cardUUIDs || []);
        let changed = false;
        for (const uuid of uuidSet) {
          if (!existing.has(uuid)) {
            existing.add(uuid);
            changed = true;
          }
        }
        if (changed) {
          deck.cardUUIDs = Array.from(existing);
          deck.modified = now.toISOString();
          await this.saveDeck(deck);
        }
      }

      const ok = await this.plugin.cardFileService.saveCardsBatch(cardsToSave);
      if (!ok) {
        return {
          success: false,
          error: 'CardFileService 未初始化或保存失败',
          timestamp: now.toISOString()
        };
      }

      if (this.plugin.cardMetadataCache) {
        for (const c of cardsToSave) {
          this.plugin.cardMetadataCache.invalidate(c.uuid);
        }
      }

      const dataSyncService = (this.plugin as any).dataSyncService;
      if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
        await dataSyncService.notifyChange({
          type: 'cards',
          action: 'create',
          ids: cardsToSave.map(c => c.uuid),
          metadata: {}
        });
      }

      return { success: true, data: cardsToSave, timestamp: now.toISOString() };
    } catch (error) {
      return {
        success: false,
        error: extractErrorMessage(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  //  向后兼容的别名方法
  async addCard(card: Card): Promise<ApiResponse<Card>> {
    return this.saveCard(card);
  }
  
  async updateCard(card: Card): Promise<ApiResponse<Card>> {
    return this.saveCard(card);
  }
  
  async addDeck(deck: Deck): Promise<ApiResponse<Deck>> {
    return this.saveDeck(deck);
  }
  
  async updateDeck(deck: Deck): Promise<ApiResponse<Deck>> {
    return this.saveDeck(deck);
  }

  async deleteCard(cardUuid: string): Promise<ApiResponse<boolean>> {
    try {
      // 🆕 v2.0: 级联删除 - 从所有引用此卡片的牌组中移除UUID
      if (this.plugin.referenceDeckService) {
        const cascadeResult = await this.plugin.referenceDeckService.cascadeDeleteCard(cardUuid);
        if (cascadeResult.affectedDecks > 0) {
          logger.info(`[Storage] 级联删除: 从 ${cascadeResult.affectedDecks} 个牌组中移除了卡片引用`);
        }
      }

      // 🆕 v2.0: 优先从统一存储删除
      if (this.plugin.cardFileService) {
        const deleted = await this.plugin.cardFileService.deleteCard(cardUuid);
        if (deleted) {
          logger.info(`[Storage] ✅ 已从统一存储删除卡片: ${cardUuid}`);
          
          // 🆕 v2.1: 使卡片元数据缓存失效
          if (this.plugin.cardMetadataCache) {
            this.plugin.cardMetadataCache.invalidate(cardUuid);
          }
          
          // v5.8: 触发卡片删除事件（用于会话统计等）
          this.plugin.app.workspace.trigger('Weave:card-deleted', cardUuid);
          
          //  桥接插件系统事件总线
          try {
            weaveEventBus.emitSync('card:deleted', { uuid: cardUuid });
          } catch {}
          
          return { success: true, data: true, timestamp: new Date().toISOString() };
        }
      }

      // 回退：从旧的牌组文件夹删除
      //  优化：使用CardIndexService快速定位deck（O(1) vs O(n*m)）
      let deckId: string | undefined;
      let cardToDelete;
      let allCardsInDeck: Card[] = [];
      
      if (this.plugin.cardIndexService) {
        deckId = this.plugin.cardIndexService.getDeckIdByUUID(cardUuid);
      }
      
      // 如果索引未找到，降级到遍历查找
      if (!deckId) {
        const allDecks = await this.getDecks();
        
        for (const d of allDecks) {
          const cards = await this.getDeckCards(d.id);
          cardToDelete = cards.find((c) => c.uuid === cardUuid);
          if (cardToDelete) {
            deckId = d.id;
            allCardsInDeck = cards;  // 保存已读取的卡片列表
            break;
          }
        }
      } else {
        // 使用索引快速定位后，只读取该deck
        allCardsInDeck = await this.getDeckCards(deckId);
        cardToDelete = allCardsInDeck.find((c) => c.uuid === cardUuid);
      }
      
      //  步骤1.5: 检查是否为渐进式挖空父卡片，如是则级联删除子卡片
      if (cardToDelete && cardToDelete.type === 'progressive-parent') {
        logger.info(`[Storage] 检测到渐进式挖空父卡片: ${cardUuid}，开始级联删除子卡片`);
        
        // 查找所有子卡片（使用类型断言）
        const childCards = allCardsInDeck.filter(c => 
          c.type === 'progressive-child' && 
          (c as ProgressiveClozeChildCard).parentCardId === cardUuid
        ) as ProgressiveClozeChildCard[];
        
        
        // 逐个删除子卡片（递归调用deleteCard，但子卡片不会再有子卡片）
        for (const childCard of childCards) {
          // 直接从当前牌组卡片列表中移除，避免重复读取
          const childIndex = allCardsInDeck.findIndex(c => c.uuid === childCard.uuid);
          if (childIndex >= 0) {
            allCardsInDeck.splice(childIndex, 1);
          }
        }
        
        logger.info(`[Storage] ✅ 已级联删除 ${childCards.length} 个子卡片`);
      }
      
      // 步骤2: 删除卡片（避免重复读取）
      let deletedDeckId: string | undefined;
      
      if (deckId && cardToDelete && allCardsInDeck.length > 0) {
        const filtered = allCardsInDeck.filter((c) => c.uuid !== cardUuid);
        await this.saveDeckCards(deckId, filtered);
        deletedDeckId = deckId;
      }
      
      if (deletedDeckId) {
        // 🆕 确保数据写入完成后通知变更
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 🆕 通知数据同步服务
        const dataSyncService = (this.plugin as any).dataSyncService;
        if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
          await dataSyncService.notifyChange({
            type: 'cards',
            action: 'delete',
            ids: [cardUuid],
            metadata: { deckId: deletedDeckId }
          });
        }
        
        //  步骤3: 清理块链接和元数据
        if (cardToDelete) {
          try {
            const cleanupService = this.plugin.blockLinkCleanupService;
            
            if (!cleanupService) {
              logger.warn('[Storage] ⚠️ 清理服务未初始化，跳过源文档清理');
            } else if (typeof cleanupService.cleanupAfterCardDeletion !== 'function') {
              logger.warn('[Storage] ⚠️ 清理服务方法不存在，跳过源文档清理');
            } else {
              const cleanupResult = await cleanupService.cleanupAfterCardDeletion(cardToDelete);
              
              if (cleanupResult.success) {
                logger.info(`[Storage] ✅ 已清理卡片源文档: ${cardUuid}, 清理项目: ${cleanupResult.cleanedItems.length}`);
                
                // 显示用户友好的通知
                if (cleanupResult.cleanedItems.length > 0) {
                  const { Notice } = require('obsidian');
                  new Notice(`🧹 已清理源文档中 ${cleanupResult.cleanedItems.length} 项残留信息`);
                }
              } else {
                logger.warn(`[Storage] ⚠️ 清理卡片源文档部分失败: ${cleanupResult.error || '未知错误'}`);
              }
            }
          } catch (cleanupError) {
            // 清理失败不影响删除操作，但要详细记录错误
            logger.error('[Storage] 清理块链接失败:', cleanupError);
            logger.error('[存储] 清理错误详情:', {
              cardUuid,
              sourceFile: cardToDelete.sourceFile,
              sourceBlock: cardToDelete.sourceBlock,
              error: cleanupError
            });
          }
          
          //  同步删除DirectFileCardReader索引
          if (this.plugin.directFileReader) {
            this.plugin.directFileReader.removeCardIndex(cardUuid, cardToDelete.uuid);
          }
          
          //  同步删除CardIndexService索引
          if (this.plugin.cardIndexService) {
            this.plugin.cardIndexService.removeCardIndex(cardToDelete.uuid);
          }
        }
        
        // v5.8: 触发卡片删除事件（用于会话统计等）
        this.plugin.app.workspace.trigger('Weave:card-deleted', cardUuid);
        
        return { success: true, data: true, timestamp: new Date().toISOString() };
      }
      
      // 取消旧全量文件的回退写入
      return { success: true, data: false, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error("Failed to delete card:", error);
      return { success: false, error: extractErrorMessage(error), timestamp: new Date().toISOString() };
    }
  }

  /**
   * 🆕 批量根据UUID查询卡片
   * 用于增量同步系统
   * 
   * @param uuids UUID数组
   * @returns 找到的卡片数组
   */
  async getCardsByUUIDs(uuids: string[]): Promise<Card[]> {
    try {
      if (uuids.length === 0) {
        return [];
      }


      const results: Card[] = [];
      const uuidSet = new Set(uuids);
      
      // 遍历所有牌组查找卡片
      const allDecks = await this.getDecks();
      
      for (const deck of allDecks) {
        const cards = await this.getDeckCards(deck.id);
        
        for (const card of cards) {
          if (uuidSet.has(card.uuid)) {
            results.push(card);
            uuidSet.delete(card.uuid); // 避免重复
            
            // 如果已找到所有UUID，提前退出
            if (uuidSet.size === 0) {
              break;
            }
          }
        }
        
        if (uuidSet.size === 0) {
          break;
        }
      }

      
      return results;
    } catch (error) {
      logger.error('[WeaveDataStorage] 批量查询失败:', error);
      return [];
    }
  }

  /**
   * 🆕 根据UUID获取单张卡片
   * 用于增量同步系统
   * 
   * @param uuid 卡片UUID
   * @returns 卡片对象，如果不存在返回null
   */
  async getCardByUUID(uuid: string): Promise<Card | null> {
    try {
      const cards = await this.getCardsByUUIDs([uuid]);
      return cards.length > 0 ? cards[0] : null;
    } catch (error) {
      logger.error('[WeaveDataStorage] 根据UUID查询卡片失败:', error);
      return null;
    }
  }

  /**
   * 🆕 标记卡片为已删除
   * 不实际删除卡片，只是添加删除标记（用户决策2）
   * 
   * @param uuid 卡片UUID
   * @param source 删除来源
   * @returns 是否标记成功
   */
  async markCardAsDeleted(uuid: string, source: 'obsidian' | 'weave' | 'manual'): Promise<boolean> {
    try {

      // 查找卡片
      const card = await this.getCardByUUID(uuid);
      
      if (!card) {
        logger.warn(`[WeaveDataStorage] 卡片不存在: ${uuid}`);
        return false;
      }

      // 设置删除标记
      card.deletedAt = Date.now();
      card.deletionSource = source;

      // 保存卡片
      const result = await this.saveCard(card);

      if (result.success) {
        logger.info(`[WeaveDataStorage] ✅ 卡片已标记为删除: ${uuid}`);
        return true;
      } else {
        logger.error(`[WeaveDataStorage] ❌ 标记删除失败: ${result.error}`);
        return false;
      }
    } catch (error) {
      logger.error('[WeaveDataStorage] 标记删除失败:', error);
      return false;
    }
  }

  /**
   * 🆕 批量标记卡片为已删除
   * 
   * @param uuids UUID数组
   * @param source 删除来源
   * @returns 成功标记的数量
   */
  async markCardsAsDeleted(uuids: string[], source: 'obsidian' | 'weave' | 'manual'): Promise<number> {
    if (uuids.length === 0) {
      return 0;
    }


    let successCount = 0;

    for (const uuid of uuids) {
      const success = await this.markCardAsDeleted(uuid, source);
      if (success) {
        successCount++;
      }
    }

    logger.info(`[WeaveDataStorage] ✅ 批量标记完成: ${successCount}/${uuids.length} 张卡片`);

    return successCount;
  }

  private async deleteCardsByDeck(deckId: string): Promise<void> {
    try {
      // 1. 首先读取牌组中的所有卡片
      const cards = await this.getDeckCards(deckId);
      
      // 2. 逐张删除卡片（触发清理机制）
      let cleanedCount = 0;
      let failedCount = 0;
      
      for (const card of cards) {
        try {
          // 使用标准的deleteCard方法，确保触发清理机制
          const result = await this.deleteCard(card.uuid);
          if (result.success) {
            cleanedCount++;
          } else {
            failedCount++;
            logger.warn(`⚠️ 删除卡片失败: ${card.uuid}, 错误: ${result.error}`);
          }
        } catch (error) {
          failedCount++;
          logger.error(`❌ 删除卡片异常: ${card.uuid}`, error);
        }
      }
      
      logger.info(`🎉 牌组删除完成: 成功清理 ${cleanedCount} 张卡片，失败 ${failedCount} 张`);
      
      // 显示清理完成通知
      if (cleanedCount > 0) {
        const { Notice } = require('obsidian');
        new Notice(`已清理 ${cleanedCount} 张卡片的源文档`);
      }
      
      // 3. 最后删除牌组分片文件（清理残余）
      
    } catch (error) {
      logger.error(`❌ 删除牌组卡片失败: ${deckId}`, error);
      throw error;
    }
  }

  /**
   * 清理指定牌组的学习会话数据
   */
  private async cleanupStudySessionsByDeck(deckId: string): Promise<void> {
    try {

      const sessionsDir = this.v2Paths.memory.learning.sessions;
      const adapter = this.plugin.app.vault.adapter as any;
      const listing = adapter.list ? await adapter.list(sessionsDir) : { files: [], folders: [] };
      const files: string[] = listing?.files || [];
      const jsonFiles = files.filter((p) => p.startsWith(sessionsDir) && /\d{4}-\d{2}\.json$/.test(p));

      let totalCleaned = 0;

      for (const filePath of jsonFiles) {
        try {
          const raw = await this.plugin.app.vault.adapter.read(filePath);
          const data = JSON.parse(raw);
          const sessions: StudySession[] = data?.sessions || [];

          // 过滤掉属于被删除牌组的会话
          const beforeCount = sessions.length;
          const filteredSessions = sessions.filter(session => session.deckId !== deckId);
          const cleanedCount = beforeCount - filteredSessions.length;

          if (cleanedCount > 0) {
            // 更新文件
            const updatedData = {
              ...data,
              sessions: filteredSessions
            };
            await this.plugin.app.vault.adapter.write(filePath, JSON.stringify(updatedData));
            totalCleaned += cleanedCount;
          }
        } catch (error) {
          logger.warn(`⚠️ 清理会话文件失败: ${filePath}`, error);
        }
      }

      logger.info(`🎉 学习会话数据清理完成，共清理 ${totalCleaned} 个记录`);
    } catch (error) {
      logger.error(`❌ 清理学习会话数据失败: ${deckId}`, error);
    }
  }

  /**
   * 清理指定牌组的媒体文件
   */
  private async cleanupDeckMediaFiles(deckId: string): Promise<void> {
    try {
      // 使用媒体文件处理器清理
      const mediaHandler = (this.plugin as any).mediaFileHandler;
      if (mediaHandler && typeof mediaHandler.cleanupDeckMedia === 'function') {
        await mediaHandler.cleanupDeckMedia(deckId);
      }
    } catch (error) {
      logger.warn(`⚠️ 媒体文件清理失败: ${deckId}`, error);
    }
  }

  /**
   * 通知相关服务牌组已删除
   */
  private async notifyDeckDeletion(deckId: string): Promise<void> {
    try {
      // 通知分析服务清理缓存
      const analyticsService = (this.plugin as any).analyticsService;
      if (analyticsService && typeof analyticsService.onDeckDeleted === 'function') {
        analyticsService.onDeckDeleted(deckId);
      }

      // 通知自动同步管理器
      const autoSyncManager = (this.plugin as any).autoSyncManager;
      if (autoSyncManager && typeof autoSyncManager.onDeckDeleted === 'function') {
        autoSyncManager.onDeckDeleted(deckId);
      }
    } catch (error) {
      logger.warn(`⚠️ 通知服务失败: ${deckId}`, error);
    }
  }

  // 学习会话操作
  async saveStudySession(session: StudySession): Promise<ApiResponse<StudySession>> {
    try {
      // 写入月分片 learning/sessions/YYYY-MM.json
      const d = new Date(session.startTime || new Date().toISOString());
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const rel = `${this.v2Paths.memory.learning.sessions}/${ym}.json`;
      // 确保目录存在
      try { await this.ensureFolder(this.v2Paths.memory.learning.root); } catch {}
      try { await this.ensureFolder(this.v2Paths.memory.learning.sessions); } catch {}
      // 读现有分片（若不存在则新建）
      let chunk: any = { _schemaVersion: "1.0.0", yearMonth: ym, sessions: [] };
      try { chunk = await this.readJsonFile(rel); } catch {}
      const arr: StudySession[] = Array.isArray(chunk.sessions) ? chunk.sessions : [];
      const idx = arr.findIndex((s) => s.id === session.id);
      const isNew = idx < 0;
      if (idx >= 0) arr[idx] = session; else arr.push(session);
      // 标记内部写入，避免 ExternalSyncWatcher 误触发
      (this.plugin as any).externalSyncWatcher?.markInternalWrite();
      
      await this.writeJsonFile(rel, { _schemaVersion: "1.0.0", yearMonth: ym, sessions: arr });
      
      // 🆕 确保数据写入完成后通知变更
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 🆕 通知数据同步服务
      const dataSyncService = (this.plugin as any).dataSyncService;
      if (dataSyncService && typeof dataSyncService.notifyChange === 'function') {
        await dataSyncService.notifyChange({
          type: 'sessions',
          action: isNew ? 'create' : 'update',
          ids: [session.id],
          metadata: { deckId: session.deckId }
        });
      }
      
      return { success: true, data: session, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error("Failed to save study session:", error);
      return { success: false, error: extractErrorMessage(error), timestamp: new Date().toISOString() };
    }
  }

  // 用户配置操作
  async getUserProfile(): Promise<UserProfile> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      // 完全使用 V2 路径（用户配置在插件目录）
      if (await adapter.exists(PLUGIN_PATHS.config.userProfile)) {
        const content = await adapter.read(PLUGIN_PATHS.config.userProfile);
        const data = JSON.parse(content);
        return data.profile;
      }
      return this.createDefaultUserProfile().profile;
    } catch (error) {
      logger.error("Failed to get user profile:", error);
      return this.createDefaultUserProfile().profile;
    }
  }

  async saveUserProfile(profile: UserProfile): Promise<ApiResponse<UserProfile>> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      await DirectoryUtils.ensureDirRecursive(adapter, PLUGIN_PATHS.config.root);
      await adapter.write(PLUGIN_PATHS.config.userProfile, JSON.stringify({ profile }, null, 2));
      
      return {
        success: true,
        data: profile,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("Failed to save user profile:", error);
      return {
        success: false,
        error: extractErrorMessage(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  // 数据导入/导出
  async exportData(): Promise<AnkiExportData> {
    const [decks, cards, userProfile] = await Promise.all([
      this.getDecks(),
      this.getCards(),
      this.getUserProfile()
    ]);

    return {
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      decks,
      cards,
      userProfile
    };
  }

  async importData(data: AnkiExportData): Promise<ApiResponse<boolean>> {
    try {
      // 备份当前数据
      await this.createBackup();
      
      // 导入新数据
      await this.writeDecksFile({ decks: data.decks });
      // 将导入的卡片按牌组落入分片
      const byDeck = new Map<string, Card[]>();
      for (const c of (data.cards || [])) {
        const dk = c.deckId || ''; const list = byDeck.get(dk) || []; list.push(c); byDeck.set(dk, list);
      }
      for (const [deckId, list] of byDeck.entries()) await this.saveDeckCards(deckId, list);
      // 保存用户配置到插件目录
      await this.saveUserProfile(data.userProfile);
      
      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("Failed to import data:", error);
      return {
        success: false,
        error: extractErrorMessage(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  // 数据备份
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    //  使用独立的备份路径（防止误删）
    const backupBasePath = getBackupPath();
    if (!backupBasePath) {
      throw new Error('备份路径未定义');
    }
    const backupFolder = `${backupBasePath}/${timestamp}`;
    const adapter = this.plugin.app.vault.adapter;
    
    
    //  使用递归创建支持嵌套路径
    await this.ensureFolder(backupFolder);
    
    // V2 路径备份（完全使用新路径）
    const fileMapping = [
      { source: this.v2Paths.memory.decks, target: "decks.json" },
      { source: PLUGIN_PATHS.config.userProfile, target: "profile.json" }
    ];
    
    for (const { source, target } of fileMapping) {
      try {
        const sourceContent = await adapter.exists(source) 
          ? await adapter.read(source) 
          : '[]';
        await adapter.write(`${backupFolder}/${target}`, sourceContent);
      } catch (error) {
        logger.warn(`备份文件失败: ${source}`, error);
        await adapter.write(`${backupFolder}/${target}`, '[]');
      }
    }
    
    // 备份保留策略
    await this.pruneBackups();
    
    return backupFolder;
  }

  // 导出为 Anki revlog 风格的 JSON（基本映射）
  async exportAsAnkiRevlog(): Promise<any[]> {
    const cards = await this.getCards();
    const rows: any[] = [];
    for (const c of cards) {
      for (const log of (c.reviewHistory || [])) {
        rows.push({
          id: new Date(log.review).getTime(), // 近似映射
          cid: c.uuid,
          button: log.rating, // 1..4
          ivl: Math.round(log.scheduledDays || 0),
          lastIvl: Math.round(log.lastElapsedDays || 0),
          time: 0,
          type: ((): number => {
            switch (log.state) {
              case 0: return 0; // learn
              case 1: return 0; // learn
              case 2: return 1; // review
              case 3: return 2; // relearn
              default: return 1;
            }
          })()
        });
      }
    }
    return rows;
  }

  // 扫描日志重建状态（当前基于卡片内 reviewHistory）
  async rebuildStatesFromLogs(): Promise<void> {
    const cards = await this.getCards();
    for (const c of cards) {
      // 以日志的最后一次为准回填基本指标（简单实现，可替换为严格重放）
      if (c.reviewHistory && c.reviewHistory.length > 0 && c.fsrs) {
        const last = c.reviewHistory[c.reviewHistory.length - 1];
        c.fsrs.elapsedDays = last.lastElapsedDays;
        c.fsrs.scheduledDays = last.scheduledDays;
        c.fsrs.lastReview = last.review;
        // due 根据 scheduledDays 推算
        const d = new Date(last.review);
        d.setDate(d.getDate() + Math.max(0, Math.round(last.scheduledDays || 0)));
        c.fsrs.due = d.toISOString();
      }
      await this.saveCard(c);
    }
  }

  // 修剪备份：保留最近 N 个
  private async pruneBackups(): Promise<void> {
    const retention: number = this.plugin.settings?.backupRetentionCount ?? 10;
    //  使用新的独立备份路径
    const parent = getBackupPath();
    if (!parent) {
      logger.warn('[pruneBackups] 备份路径未定义，跳过清理');
      return;
    }
    try {
      const adapter = this.plugin.app.vault.adapter as any;
      const listing = adapter.list ? await adapter.list(parent) : { files: [], folders: [] };
      const folders: string[] = listing?.folders ?? [];
      if (!Array.isArray(folders) || folders.length <= retention) return;
      const sorted = folders.slice().sort(); // 时间戳名称，字典序即时间序
      const toDelete = sorted.slice(0, Math.max(0, folders.length - retention));
      for (const folder of toDelete) {
        // 删除该备份文件夹内已知文件
        const files = [
          "decks.json",
          "profile.json"
        ];
        for (const f of files) {
          const p = `${folder}/${f}`;
          if (await this.exists(p)) {
            await this.plugin.app.vault.adapter.remove(p);
          }
        }
        // 删除空文件夹
        const adapter = this.plugin.app.vault.adapter as any;
        if (adapter.rmdir) {
          await adapter.rmdir(folder, true);
        } else {
          // 尝试删除文件夹同名文件（容错）
          try { await this.plugin.app.vault.adapter.remove(folder); } catch {}
        }
      }
    } catch (e) {
      logger.warn("Backup pruning skipped:", e);
    }
  }

  private async exists(path: string): Promise<boolean> {
    try {
      // adapter.stat(path) 存在则返回信息
      const adapter = this.plugin.app.vault.adapter as any;
      if (adapter.stat) {
        const stat = await adapter.stat(path);
        return !!stat;
      }
      return false;
    } catch {
      return false;
    }
  }



  // 工具方法
  private async readJsonFile(fileName: string): Promise<any> {
    const content = await this.readFileContent(fileName);
    return JSON.parse(content);
  }

  private async writeJsonFile(fileName: string, data: any): Promise<void> {
    const content = JSON.stringify(data);
    const filePath = this.isAbsoluteVaultPath(fileName) ? fileName : `${this.dataFolder}/${fileName}`;
    const adapter = this.plugin.app.vault.adapter;
    
    //  直接使用 adapter API 写入（完全支持隐藏文件夹）
    // 注意：隐藏文件夹场景下，vault API 降级逻辑无效，已移除
    await adapter.write(filePath, content);
  }

  /**
   *  新增：直接更新已存在文件的内容
   */
  private async updateExistingDeckFile(fileName: string, data: any): Promise<void> {
    const filePath = this.isAbsoluteVaultPath(fileName) ? fileName : `${this.dataFolder}/${fileName}`;
    const adapter = this.plugin.app.vault.adapter;
    
    //  使用 adapter API 检查文件是否存在（支持隐藏文件夹）
    const existing = await adapter.exists(filePath);
    
    if (existing) {
      // 文件存在，直接更新内容
      const content = JSON.stringify(data);
      await adapter.write(filePath, content);
    } else {
      // 文件不存在，使用常规创建方法
      await this.writeJsonFile(fileName, data);
    }
  }


  // ===== 新增：公开读取学习会话（按时间窗口 + 月分片） =====
  async getStudySessions(range?: { since?: string; until?: string }): Promise<StudySession[]> {
    const sessionsDir = this.v2Paths.memory.learning.sessions;
    let items: StudySession[] = [];
    try {
      const adapter = this.plugin.app.vault.adapter as any;
      const listing = adapter.list ? await adapter.list(sessionsDir) : { files: [], folders: [] };
      const files: string[] = listing?.files || [];
      const jsonFiles = files.filter((p) => p.startsWith(sessionsDir) && /\d{4}-\d{2}\.json$/.test(p));
      for (const p of jsonFiles) {
        try {
          const raw = await this.plugin.app.vault.adapter.read(p);
          const data = JSON.parse(raw);
          const chunk: StudySession[] = data?.sessions || [];
          items.push(...chunk);
        } catch {}
      }
    } catch {}
    if (range?.since || range?.until) {
      items = items.filter((s) => {
        const t = new Date(s.startTime).getTime();
        if (range?.since && t < new Date(range.since).getTime()) return false;
        if (range?.until && t > new Date(range.until).getTime()) return false;
        return true;
      });
    }
    return items;
  }

  // ===== 新增：牌组级卡片读写（分片） =====
  async getDeckCards(deckId: string): Promise<Card[]> {
    return await this.getCards({ deckId });
  }

  /**
   * 标准化卡片数据 - 确保类型一致性
   *  修复 card.tags.forEach 错误的关键方法
   */
  private normalizeCardData(card: Card): Card {
    // 确保 tags 字段是数组类型
    if (card.tags) {
      if (typeof card.tags === 'string') {
        // 保存字符串引用
        const tagsString = card.tags as unknown as string;
        try {
          // 尝试解析JSON字符串
          const parsed = JSON.parse(tagsString);
          card.tags = Array.isArray(parsed) ? parsed : [];
        } catch {
          // 如果不是JSON，则按分隔符拆分
          card.tags = tagsString.split(/[,;\s]+/).filter((tag: string) => tag.length > 0);
        }
      } else if (!Array.isArray(card.tags)) {
        // 如果既不是字符串也不是数组，重置为空数组
        card.tags = [];
      }
    } else {
      card.tags = [];
    }
    
    // 确保 type 字段不为空：从内容检测题型，默认为 basic
    if (!card.type) {
      const body = extractBodyContent(card.content || '') || card.content || '';
      const detected = detectCardTypeFromContent(body);
      card.type = (detected || CardType.Basic) as any;
      logger.debug('[Storage] normalizeCardData: type 为空，自动检测为', card.type);
    }
    
    return card;
  }

  private async ensureFolder(path: string): Promise<void> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      //  使用递归创建支持嵌套路径（如 .obsidian/plugins/weave/backups）
      await DirectoryUtils.ensureDirRecursive(adapter, path);
    } catch (error) {
      // 文件夹可能已存在，忽略错误
    }
  }

  private deckWriteQueue = new Map<string, Promise<void>>();
  
  private async enqueueDeckWrite(deckId: string, task: () => Promise<void>): Promise<void> {
    const prev = this.deckWriteQueue.get(deckId) || Promise.resolve();
    const next = prev.then(task).catch((e) => {
      logger.error("Deck write failed", e);
      //  重新抛出错误，让调用方能感知保存失败
      throw e;
    });
    this.deckWriteQueue.set(deckId, next);
    await next;
  }

  /**
   * 批量持久化所有牌组的运行时统计数据到 decks.json
   * 
   * 将内存中的 deckStats（由 UnifiedStudyProvider 计算）写入磁盘，
   * 确保其他设备同步后能看到最新的统计数据。
   * 使用单次写入避免频繁 I/O。
   */
  async persistAllDeckStats(statsMap: Record<string, Partial<DeckStats>>): Promise<void> {
    try {
      const decks = await this.getDecks();
      let changed = false;

      for (const deck of decks) {
        const stats = statsMap[deck.id];
        if (!stats) continue;

        deck.stats = deck.stats || {} as DeckStats;
        // 只更新运行时统计字段，保留其它持久化字段
        if (stats.totalCards !== undefined) deck.stats.totalCards = stats.totalCards;
        if (stats.newCards !== undefined) deck.stats.newCards = stats.newCards;
        if (stats.learningCards !== undefined) deck.stats.learningCards = stats.learningCards;
        if (stats.reviewCards !== undefined) deck.stats.reviewCards = stats.reviewCards;
        if (stats.memoryRate !== undefined) deck.stats.memoryRate = stats.memoryRate;
        changed = true;
      }

      if (changed) {
        await this.writeDecksFile({ decks });
        logger.debug('[Storage] persistAllDeckStats: 统计数据已持久化');
      }
    } catch (e) {
      logger.warn('persistAllDeckStats failed', e);
    }
  }

  private async updateDeckIndexStats(deckId: string, cardCount: number): Promise<void> {
    try {
      const decks = await this.getDecks();
      const idx = decks.findIndex((d: any) => d.id === deckId);
      if (idx >= 0) {
        decks[idx].stats = decks[idx].stats || {};
        decks[idx].stats.totalCards = cardCount;
        decks[idx].modified = new Date().toISOString();
      }
      await this.writeDecksFile({ decks });
    } catch (e) {
      logger.warn("updateDeckIndexStats failed", e);
    }
  }

  /**
   * 统一写入牌组文件到 V2 路径
   * cardUUIDs 已分离到独立文件，写入时自动剥离
   */
  private async writeDecksFile(data: { decks: Deck[] }): Promise<void> {
    // 标记内部写入，避免 ExternalSyncWatcher 误触发
    (this.plugin as any).externalSyncWatcher?.markInternalWrite();
    
    const adapter = this.plugin.app.vault.adapter;
    await DirectoryUtils.ensureDirRecursive(adapter, this.v2Paths.memory.root);
    // 剥离 cardUUIDs，只写牌组配置和统计到 decks.json
    const stripped = {
      decks: data.decks.map(d => {
        const { cardUUIDs, ...rest } = d;
        return rest;
      })
    };
    await safeWriteJson(adapter, this.v2Paths.memory.decks, JSON.stringify(stripped));
  }

  /**
   * 读取牌组的 cardUUIDs（从独立文件）
   */
  private async readDeckCardUUIDs(deckId: string): Promise<string[]> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      const filePath = `${this.v2Paths.memory.deckCards}/${deckId}.json`;
      if (await adapter.exists(filePath)) {
        const raw = await adapter.read(filePath);
        const data = JSON.parse(raw);
        return Array.isArray(data?.cardUUIDs) ? data.cardUUIDs : [];
      }
    } catch (e) {
      logger.warn(`[Storage] readDeckCardUUIDs(${deckId}) failed:`, e);
    }
    return [];
  }

  /**
   * 写入牌组的 cardUUIDs（到独立文件，紧凑 JSON）
   */
  private async writeDeckCardUUIDs(deckId: string, uuids: string[]): Promise<void> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      await DirectoryUtils.ensureDirRecursive(adapter, this.v2Paths.memory.deckCards);
      const filePath = `${this.v2Paths.memory.deckCards}/${deckId}.json`;
      await adapter.write(filePath, JSON.stringify({ cardUUIDs: uuids }));
    } catch (e) {
      logger.warn(`[Storage] writeDeckCardUUIDs(${deckId}) failed:`, e);
    }
  }

  /**
   * 删除牌组的 cardUUIDs 独立文件
   */
  private async deleteDeckCardUUIDs(deckId: string): Promise<void> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      const filePath = `${this.v2Paths.memory.deckCards}/${deckId}.json`;
      if (await adapter.exists(filePath)) {
        await adapter.remove(filePath);
      }
    } catch (e) {
      logger.warn(`[Storage] deleteDeckCardUUIDs(${deckId}) failed:`, e);
    }
  }

  /**
   * 将 cardUUID 加入待刷写队列，防抖合并后统一写入 deck 文件
   * 避免批量导入时每张卡片都触发一次 saveDeck
   */
  private _enqueueDeckCardUUID(deckId: string, cardUUID: string): void {
    let set = this._pendingDeckCardUUIDs.get(deckId);
    if (!set) {
      set = new Set();
      this._pendingDeckCardUUIDs.set(deckId, set);
    }
    set.add(cardUUID);

    // 重置防抖定时器
    if (this._deckCardUUIDsFlushTimer) {
      clearTimeout(this._deckCardUUIDsFlushTimer);
    }
    this._deckCardUUIDsFlushTimer = setTimeout(() => {
      this._flushPendingDeckCardUUIDs();
    }, WeaveDataStorage.DECK_CARD_UUIDS_FLUSH_DELAY);
  }

  /**
   * 刷写所有待处理的 deck cardUUIDs（合并后只写一次）
   */
  private async _flushPendingDeckCardUUIDs(): Promise<void> {
    this._deckCardUUIDsFlushTimer = null;
    if (this._pendingDeckCardUUIDs.size === 0) return;

    const pending = new Map(this._pendingDeckCardUUIDs);
    this._pendingDeckCardUUIDs.clear();

    for (const [deckId, newUUIDs] of pending) {
      try {
        const deck = await this.getDeck(deckId);
        if (!deck) continue;

        const existing = new Set(deck.cardUUIDs || []);
        let changed = false;
        for (const uuid of newUUIDs) {
          if (!existing.has(uuid)) {
            existing.add(uuid);
            changed = true;
          }
        }

        if (changed) {
          deck.cardUUIDs = Array.from(existing);
          deck.modified = new Date().toISOString();
          await this.saveDeck(deck);
        }
      } catch (e) {
        logger.warn(`[Storage] _flushPendingDeckCardUUIDs(${deckId}) failed:`, e);
      }
    }
  }

  /**
   * 立即刷写待处理的 deck cardUUIDs（插件卸载时调用）
   */
  async flushPendingWrites(): Promise<void> {
    if (this._deckCardUUIDsFlushTimer) {
      clearTimeout(this._deckCardUUIDsFlushTimer);
    }
    await this._flushPendingDeckCardUUIDs();
  }

  async saveDeckCards(deckId: string, cards: Card[]): Promise<void> {
    if (!this.plugin.cardFileService) {
      throw new Error('CardFileService 未初始化');
    }

    const now = new Date();
    const deck = await this.getDeck(deckId);
    if (deck) {
      deck.cardUUIDs = cards.map(c => c.uuid);
      deck.modified = now.toISOString();
      await this.saveDeck(deck);
    }

    for (const c of cards) {
      const normalized = this.normalizeCardData(c);
      await this.saveCardInternal(normalized);
    }

    await this.updateDeckIndexStats(deckId, cards.length);
  }

  // 开发阶段：移除旧结构迁移实现

  private async readFileContent(fileName: string): Promise<string> {
    const filePath = this.isAbsoluteVaultPath(fileName) ? fileName : `${this.dataFolder}/${fileName}`;
    
    try {
      // 优先尝试使用 adapter API 读取（支持隐藏文件夹）
      const adapter = this.plugin.app.vault.adapter;
      return await adapter.read(filePath);
    } catch (error) {
      // 尝试 vault API
    }
    
    try {
      // 降级到 vault API（可见文件）
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        return await this.plugin.app.vault.read(file);
      }
    } catch (error) {
      // 文件未找到
    }
    
    throw new Error(`File not found: ${filePath}`);
  }

  private filterCards(cards: Card[], query: DataQuery): Card[] {
    return cards.filter(_card => {
      if (query.deckId && _card.deckId !== query.deckId) return false;
      if (query.cardIds && !query.cardIds.includes(_card.uuid)) return false;
      if (query.state !== undefined && _card.fsrs?.state !== query.state) return false;
      if (query.tags && (!_card.tags || !query.tags.some(tag => _card.tags?.includes(tag)))) return false;
      
      if (query.dueDate) {
        // 健壮的日期检查：确保 due 是一个有效的日期字符串
        if (!_card.fsrs?.due || Number.isNaN(Date.parse(String(_card.fsrs.due)))) {
          // 如果卡片没有到期日或者格式无效，则不符合任何日期范围查询
          return false;
        }
        const due = new Date(_card.fsrs.due);
        if (query.dueDate.from && due < new Date(query.dueDate.from)) return false;
        if (query.dueDate.to && due > new Date(query.dueDate.to)) return false;
      }
      
      return true;
    });
  }

  // ===================================================================
  // 模板存储方法 - 已迁移到统一的FieldTemplate系统
  // ===================================================================



  // ===== 卡片查询方法 =====

  /**
   * 根据源文件获取卡片
   */
  async getCardsBySourceFile(filePath: string): Promise<Card[]> {
    try {
      const allCards = await this.getCards();
      return allCards.filter(card => {
        // 优先从 YAML we_source 查询
        if (card.content) {
          try {
            const yaml = parseYAMLFromContent(card.content);
            const source = Array.isArray(yaml.we_source) ? yaml.we_source[0] : yaml.we_source;
            if (typeof source === 'string' && source.includes(filePath)) return true;
          } catch { /* ignore */ }
        }
        // 回退到派生字段（运行时可能已填充）
        return card.sourceFile === filePath;
      });
    } catch (error) {
      logger.error("Failed to get cards by source file:", error);
      return [];
    }
  }

  /**
   * 获取所有卡片（别名方法）
   */
  async getAllCards(): Promise<Card[]> {
    return this.getCards();
  }

  /**
   * 根据模板ID获取卡片
   */
  async getCardsByTemplate(templateId: string): Promise<Card[]> {
    try {
      const allCards = await this.getCards();
      return allCards.filter(card => card.templateId === templateId);
    } catch (error) {
      logger.error("Failed to get cards by template:", error);
      return [];
    }
  }

}
