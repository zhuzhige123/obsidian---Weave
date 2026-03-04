/**
 * 引用式牌组数据迁移服务 (v2.0)
 * 
 * 核心职责：
 * 1. 将现有架构迁移到完全引用式架构
 * 2. 为牌组生成 cardUUIDs 数组
 * 3. 为卡片生成 referencedByDecks 数组
 * 4. 支持迁移回滚
 * 
 * 迁移步骤：
 * 1. 备份现有数据
 * 2. 遍历所有牌组，收集卡片UUID
 * 3. 为每个牌组设置 cardUUIDs
 * 4. 为每张卡片设置 referencedByDecks
 * 5. 验证迁移结果
 */

import type { Card, Deck, DataMigrationResult } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { logger } from '../../utils/logger';
import { LEGACY_PATHS, getBackupPath, getV2PathsFromApp } from '../../config/paths';

export interface MigrationOptions {
  /** 是否创建备份 */
  createBackup?: boolean;
  /** 是否执行验证 */
  validate?: boolean;
  /** 是否为试运行（不实际修改数据） */
  dryRun?: boolean;
}

export class ReferenceMigrationService {
  private plugin: WeavePlugin;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 检查是否需要迁移
   * 
   * 扫描整个 weave 文件夹，检查是否有卡片数据在错误的位置
   */
  async needsMigration(): Promise<boolean> {
    try {
      // 扫描 weave/decks/ 下的所有子文件夹，查找 cards.json 文件
      const orphanedCardFiles = await this.scanForOrphanedCardFiles();
      
      if (orphanedCardFiles.length > 0) {
        logger.info(`[Migration] 发现 ${orphanedCardFiles.length} 个需要迁移的卡片文件`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[Migration] 检查迁移状态失败:', error);
      return false;
    }
  }

  /**
   * 扫描 weave/decks/ 下所有子文件夹中的 cards.json 文件
   * 这些文件应该被迁移到 weave/cards/ 统一存储
   */
  private async scanForOrphanedCardFiles(): Promise<string[]> {
    const orphanedFiles: string[] = [];
    const adapter = this.plugin.app.vault.adapter;
    
    try {
      const decksFolder = LEGACY_PATHS.decks;
      
      // 检查 decks 文件夹是否存在
      if (!await adapter.exists(decksFolder)) {
        return [];
      }

      // 列出 decks 文件夹下的所有内容
      const listing = await adapter.list(decksFolder);
      
      // 遍历所有子文件夹
      for (const folder of listing.folders) {
        // 跳过 decks.json 所在的根目录
        const folderName = folder.split('/').pop();
        if (!folderName || folderName === 'decks') continue;
        
        // 检查是否有 cards.json 文件
        const cardsFilePath = `${folder}/cards.json`;
        if (await adapter.exists(cardsFilePath)) {
          try {
            const content = await adapter.read(cardsFilePath);
            const data = JSON.parse(content);
            
            // 验证是否是有效的卡片数据文件
            if (data.cards && Array.isArray(data.cards) && data.cards.length > 0) {
              // 检查卡片是否有有效的 uuid 字段
              const hasValidCards = data.cards.some((card: any) => 
                card.uuid && typeof card.uuid === 'string'
              );
              
              if (hasValidCards) {
                orphanedFiles.push(cardsFilePath);
                logger.debug(`[Migration] 发现需要迁移的卡片文件: ${cardsFilePath} (${data.cards.length} 张卡片)`);
              }
            }
          } catch (e) {
            // JSON 解析失败，跳过
            logger.debug(`[Migration] 跳过无效文件: ${cardsFilePath}`);
          }
        }
      }
    } catch (error) {
      logger.error('[Migration] 扫描卡片文件失败:', error);
    }
    
    return orphanedFiles;
  }

  /**
   * 执行迁移
   * 
   * 完全引用式架构迁移：
   * 1. 扫描 weave/decks/ 下所有子文件夹中的 cards.json 文件
   * 2. 将所有卡片迁移到 weave/cards/default.json
   * 3. 为每个牌组生成 cardUUIDs 数组
   * 4. 为每张卡片生成 referencedByDecks 数组
   * 5. 清理旧的卡片文件
   */
  async migrate(options: MigrationOptions = {}): Promise<DataMigrationResult> {
    const { createBackup = true, validate = true, dryRun = false } = options;
    
    logger.info(`[Migration] 开始迁移到完全引用式牌组架构 (dryRun: ${dryRun})...`);

    try {
      // 步骤1：备份
      let backupPath: string | undefined;
      if (createBackup && !dryRun) {
        backupPath = await this.createBackup();
        logger.info(`[Migration] 备份完成: ${backupPath}`);
      }

      // 步骤2：扫描所有需要迁移的卡片文件
      const orphanedCardFiles = await this.scanForOrphanedCardFiles();
      logger.info(`[Migration] 发现 ${orphanedCardFiles.length} 个需要迁移的卡片文件`);

      // 步骤3：收集所有卡片和构建映射关系
      const adapter = this.plugin.app.vault.adapter;
      const allCardsToMigrate: Card[] = [];
      const cardDeckMappings: Record<string, string[]> = {};
      const deckCardMappings: Record<string, string[]> = {};
      const processedUUIDs = new Set<string>();

      for (const filePath of orphanedCardFiles) {
        try {
          const content = await adapter.read(filePath);
          const data = JSON.parse(content);
          
          // 从文件路径提取 deckId
          // 格式: weave/decks/{deckId}/cards.json
          const pathParts = filePath.split('/');
          const deckId = pathParts[pathParts.length - 2]; // 倒数第二个是 deckId
          
          if (!deckCardMappings[deckId]) {
            deckCardMappings[deckId] = [];
          }

          for (const card of data.cards) {
            if (!card.uuid || processedUUIDs.has(card.uuid)) {
              continue; // 跳过无效或重复的卡片
            }
            
            processedUUIDs.add(card.uuid);
            allCardsToMigrate.push(card);
            
            // 构建双向映射
            deckCardMappings[deckId].push(card.uuid);
            
            if (!cardDeckMappings[card.uuid]) {
              cardDeckMappings[card.uuid] = [];
            }
            if (!cardDeckMappings[card.uuid].includes(deckId)) {
              cardDeckMappings[card.uuid].push(deckId);
            }
          }
          
          logger.debug(`[Migration] 从 ${filePath} 收集了 ${data.cards.length} 张卡片`);
        } catch (e) {
          logger.warn(`[Migration] 读取文件失败: ${filePath}`, e);
        }
      }

      logger.info(`[Migration] 共收集 ${allCardsToMigrate.length} 张卡片待迁移`);

      if (dryRun) {
        logger.info('[Migration] 试运行完成，不修改数据');
        return {
          success: true,
          migratedCards: allCardsToMigrate.length,
          migratedDecks: Object.keys(deckCardMappings).length,
          details: { deckCardMappings, cardDeckMappings, orphanedCardFiles }
        };
      }

      // 步骤4：初始化统一卡片存储
      // 优先使用已初始化的 cardFileService，避免重复初始化
      let cardFileService = this.plugin.cardFileService;
      if (!cardFileService) {
        logger.info('[Migration] cardFileService 未初始化，创建新实例');
        const { initCardFileService } = await import('./CardFileService');
        cardFileService = initCardFileService(this.plugin);
        await cardFileService.initialize();
        this.plugin.cardFileService = cardFileService;
      } else {
        // 确保 cardFileService 已正确初始化（检查 cards 文件夹是否存在）
        const cardsFolder = getV2PathsFromApp(this.plugin.app).memory.cards;
        if (!await adapter.exists(cardsFolder)) {
          logger.info('[Migration] cards 文件夹不存在，重新初始化 cardFileService');
          await cardFileService.initialize();
        }
      }
      
      logger.info('[Migration] CardFileService 已准备就绪');

      // 步骤5：将所有卡片迁移到统一存储
      let migratedCards = 0;
      const now = new Date().toISOString();
      
      for (const card of allCardsToMigrate) {
        // 设置 referencedByDecks
        const expectedRefs = cardDeckMappings[card.uuid] || [];
        const migratedCard: Card = {
          ...card,
          referencedByDecks: expectedRefs,
          modified: now
        };
        // 移除旧的 deckId 字段（完全引用式架构不需要）
        delete (migratedCard as any).deckId;
        
        const success = await cardFileService.saveCard(migratedCard);
        if (success) {
          migratedCards++;
        } else {
          logger.warn(`[Migration] 卡片 ${card.uuid} 迁移失败`);
        }
      }

      logger.info(`[Migration] 已迁移 ${migratedCards}/${allCardsToMigrate.length} 张卡片到统一存储`);

      // 步骤6：更新牌组的 cardUUIDs
      let migratedDecks = 0;
      const decks = await this.plugin.dataStorage.getDecks();
      
      for (const deck of decks) {
        const cardUUIDs = deckCardMappings[deck.id] || [];
        
        // 合并现有的 cardUUIDs（如果有）
        const existingUUIDs = new Set(deck.cardUUIDs || []);
        for (const uuid of cardUUIDs) {
          existingUUIDs.add(uuid);
        }
        
        deck.cardUUIDs = Array.from(existingUUIDs);
        deck.modified = now;
        await this.plugin.dataStorage.saveDeck(deck);
        migratedDecks++;
      }

      // 步骤7：验证迁移结果
      // 只有当所有卡片都成功迁移后，才清空旧文件
      if (migratedCards === allCardsToMigrate.length) {
        logger.info(`[Migration] 所有 ${migratedCards} 张卡片迁移成功，开始清理旧文件`);
        
        // 清理旧的卡片文件（将卡片数组清空，保留文件结构以防万一）
        for (const filePath of orphanedCardFiles) {
          try {
            // 不删除文件，而是清空卡片数组，保留元数据
            await adapter.write(filePath, JSON.stringify({ 
              _migrated: true,
              _migratedAt: now,
              _originalCardCount: allCardsToMigrate.length,
              cards: [] 
            }, null, 2));
            logger.debug(`[Migration] 已清空旧卡片文件: ${filePath}`);
          } catch (e) {
            logger.warn(`[Migration] 清空旧文件失败: ${filePath}`, e);
          }
        }
      } else {
        logger.warn(`[Migration] ⚠️ 部分卡片迁移失败 (${migratedCards}/${allCardsToMigrate.length})，保留旧文件以防数据丢失`);
      }

      // 步骤8：验证
      if (validate) {
        const { initDataConsistencyService } = await import('./DataConsistencyService');
        const consistencyService = initDataConsistencyService(this.plugin);
        const checkResult = await consistencyService.checkConsistency();
        
        if (!checkResult.isConsistent) {
          logger.warn('[Migration] 迁移后数据一致性检查未通过，尝试修复...');
          await consistencyService.repairConsistency();
        }
      }

      logger.info(`[Migration] ✅ 迁移完成: ${migratedDecks} 个牌组, ${migratedCards} 张卡片`);

      return {
        success: true,
        migratedCards,
        migratedDecks,
        backupPath,
        details: { deckCardMappings, cardDeckMappings, orphanedCardFiles }
      };
    } catch (error) {
      logger.error('[Migration] 迁移失败:', error);
      return {
        success: false,
        migratedCards: 0,
        migratedDecks: 0,
        error: error instanceof Error ? error.message : '迁移失败'
      };
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = `${getBackupPath()}/migration-${timestamp}`;
    const adapter = this.plugin.app.vault.adapter;

    // 确保备份目录存在
    const { DirectoryUtils } = await import('../../utils/directory-utils');
    await DirectoryUtils.ensureDirRecursive(adapter, backupFolder);

    // 备份牌组数据
    const decksPath = `${LEGACY_PATHS.decks}/decks.json`;
    if (await adapter.exists(decksPath)) {
      const decksData = await adapter.read(decksPath);
      await adapter.write(`${backupFolder}/decks.json`, decksData);
    }

    // 备份每个牌组的卡片数据
    const decks = await this.plugin.dataStorage.getDecks();
    for (const deck of decks) {
      const cardsPath = `${LEGACY_PATHS.decks}/${deck.id}/cards.json`;
      if (await adapter.exists(cardsPath)) {
        const cardsData = await adapter.read(cardsPath);
        await DirectoryUtils.ensureDirRecursive(adapter, `${backupFolder}/${deck.id}`);
        await adapter.write(`${backupFolder}/${deck.id}/cards.json`, cardsData);
      }
    }

    return backupFolder;
  }

  /**
   * 从备份恢复
   */
  async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      const adapter = this.plugin.app.vault.adapter;

      // 恢复牌组数据
      const backupDecksPath = `${backupPath}/decks.json`;
      if (await adapter.exists(backupDecksPath)) {
        const decksData = await adapter.read(backupDecksPath);
        await adapter.write(`${LEGACY_PATHS.decks}/decks.json`, decksData);
      }

      // 恢复卡片数据
      const decks = JSON.parse(await adapter.read(backupDecksPath)).decks as Deck[];
      for (const deck of decks) {
        const backupCardsPath = `${backupPath}/${deck.id}/cards.json`;
        if (await adapter.exists(backupCardsPath)) {
          const cardsData = await adapter.read(backupCardsPath);
          const { DirectoryUtils } = await import('../../utils/directory-utils');
          await DirectoryUtils.ensureDirRecursive(adapter, `${LEGACY_PATHS.decks}/${deck.id}`);
          await adapter.write(`${LEGACY_PATHS.decks}/${deck.id}/cards.json`, cardsData);
        }
      }

      logger.info(`[Migration] 从备份恢复成功: ${backupPath}`);
      return true;
    } catch (error) {
      logger.error('[Migration] 恢复失败:', error);
      return false;
    }
  }
}

// 单例导出
let migrationServiceInstance: ReferenceMigrationService | null = null;

export function getReferenceMigrationService(plugin?: WeavePlugin): ReferenceMigrationService {
  if (!migrationServiceInstance && plugin) {
    migrationServiceInstance = new ReferenceMigrationService(plugin);
  }
  if (!migrationServiceInstance) {
    throw new Error('ReferenceMigrationService not initialized');
  }
  return migrationServiceInstance;
}

export function initReferenceMigrationService(plugin: WeavePlugin): ReferenceMigrationService {
  migrationServiceInstance = new ReferenceMigrationService(plugin);
  return migrationServiceInstance;
}
