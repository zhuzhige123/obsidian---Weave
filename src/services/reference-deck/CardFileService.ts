/**
 * 卡片文件管理服务 (v3.0)
 * 
 * 核心职责：
 * 1. 管理卡片文件索引 (card-files-index.json)
 * 2. 自动分片：单文件超 1MB 或 1000 张卡片时自动拆分
 * 
 * 文件结构（规范命名）：
 * weave/memory/cards/
 *   ├── card-files-index.json  # 索引文件
 *   ├── cards-0.json           # 主卡片文件
 *   ├── cards-1.json           # 自动分片
 *   └── cards-2.json           # 自动分片
 */

import type { Card, CardFileIndex, CardFileInfo } from '../../data/types';
import type { WeavePlugin } from '../../main';
import { logger } from '../../utils/logger';
import { getV2Paths, normalizeWeaveParentFolder } from '../../config/paths';
import { safeWriteJson, safeReadJson } from '../../utils/safe-json-io';

/** 分片阈值：卡片数量 */
const SHARD_THRESHOLD_COUNT = 500;
/** 分片阈值：文件大小 (512KB，云同步最佳平衡) */
const SHARD_THRESHOLD_SIZE = 512 * 1024;
/** 默认卡片文件名前缀 */
const CARDS_FILE_PREFIX = 'cards';

export interface CreateCardFileOptions {
  /** 文件名（英文，不含扩展名） */
  fileName: string;
  /** 显示名称（中文） */
  displayName: string;
  /** 描述 */
  description?: string;
  /** 颜色标识 */
  color?: string;
  /** 标签 */
  tags?: string[];
}

export interface MoveCardsResult {
  success: boolean;
  movedCount: number;
  failedCount: number;
  error?: string;
}

export class CardFileService {
  private plugin: WeavePlugin;
  private indexCache: CardFileIndex | null = null;
  /** per-shard 写入锁，防止并发读-改-写丢失数据 */
  private _shardLocks = new Map<string, Promise<void>>();

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
  }

  /**
   * 获取或创建指定分片的串行化锁
   * 确保同一分片文件的读-改-写操作不会并发执行
   */
  private async withShardLock<T>(fileName: string, fn: () => Promise<T>): Promise<T> {
    const prev = this._shardLocks.get(fileName) ?? Promise.resolve();
    let resolve: () => void;
    const next = new Promise<void>(r => { resolve = r; });
    this._shardLocks.set(fileName, next);

    try {
      await prev;
      return await fn();
    } finally {
      resolve!();
      // 清理已完成的锁，避免内存泄漏
      if (this._shardLocks.get(fileName) === next) {
        this._shardLocks.delete(fileName);
      }
    }
  }

  /**
   * 获取卡片文件夹路径（V2.0 使用新路径）
   */
  private get cardsFolder(): string {
    const parentFolder = normalizeWeaveParentFolder((this.plugin as any).settings?.weaveParentFolder);
    return getV2Paths(parentFolder).memory.cards;
  }

  /**
   * 获取索引文件路径
   */
  private get indexPath(): string {
    return `${this.cardsFolder}/card-files-index.json`;
  }

  /**
   * 初始化卡片文件系统
   */
  async initialize(): Promise<void> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      
      logger.info(`[CardFileService] 开始初始化，卡片文件夹路径: ${this.cardsFolder}`);
      
      // 确保目录存在
      const { DirectoryUtils } = await import('../../utils/directory-utils');
      
      // 先检查目录是否存在（迁移由 SchemaV2MigrationService 处理）
      const folderExistsBefore = await adapter.exists(this.cardsFolder);
      logger.info(`[CardFileService] 初始化前卡片文件夹存在: ${folderExistsBefore}`);
      
      if (!folderExistsBefore) {
        logger.info(`[CardFileService] 创建卡片文件夹: ${this.cardsFolder}`);
        await DirectoryUtils.ensureDirRecursive(adapter, this.cardsFolder);
      }
      
      // 验证目录是否创建成功
      const folderExistsAfter = await adapter.exists(this.cardsFolder);
      logger.info(`[CardFileService] 初始化后卡片文件夹存在: ${folderExistsAfter}`);
      
      if (!folderExistsAfter) {
        throw new Error(`无法创建卡片文件夹: ${this.cardsFolder}`);
      }

      // 确保索引文件存在
      const indexExists = await adapter.exists(this.indexPath);
      logger.info(`[CardFileService] 索引文件存在: ${indexExists}, 路径: ${this.indexPath}`);
      
      if (!indexExists) {
        logger.info(`[CardFileService] 索引文件不存在，创建默认索引: ${this.indexPath}`);
        await this.createDefaultIndex();
      }

      // 加载索引到缓存
      await this.loadIndex();

      // 迁移旧文件名（default.json → cards-0.json, default-N.json → cards-N.json）
      await this.migrateOldFileNames(adapter);

      // 🔥 启动时自愈：扫描 cards 文件夹，补全索引并重建 cardLocations
      await this.rebuildIndexFromDisk();

      // 对所有超阈值的分片文件执行自动分片
      await this.shardOversizedFiles();
      
      logger.info('[CardFileService] ✅ 初始化完成');
    } catch (error) {
      logger.error('[CardFileService] ❌ 初始化失败:', error);
      throw error;
    }
  }

  private async rebuildIndexFromDisk(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter as any;
    const index = await this.loadIndex();

    const listing = adapter.list ? await adapter.list(this.cardsFolder) : { files: [], folders: [] };
    const files: string[] = listing?.files || [];

    const reservedNames = new Set<string>(['card-files-index', 'cards']);

    const diskFileNames = new Set(
      files
        .filter((p: string) => p.startsWith(this.cardsFolder) && p.endsWith('.json'))
        .map((p: string) => p.split('/').pop() as string)
        .map((name: string) => name.replace(/\.json$/, ''))
        .filter((name: string) => !reservedNames.has(name))
    );

    // 1) 确保主卡片文件 cards-0 存在于索引
    if (!index.files.some(f => f.isDefault)) {
      const now = Date.now();
      index.files.unshift({
        fileName: `${CARDS_FILE_PREFIX}-0`,
        displayName: '主卡片文件',
        cardCount: 0,
        isDefault: true,
        isAutoShard: false,
        createdAt: now,
        updatedAt: now
      });
    }

    // 2) 将磁盘上存在但索引里没有的文件加入 index.files
    for (const fileName of diskFileNames) {
      if (!index.files.some(f => f.fileName === fileName)) {
        const now = Date.now();
        index.files.push({
          fileName,
          displayName: fileName,
          cardCount: 0,
          isDefault: false,
          isAutoShard: false,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // 3) 重建 cardLocations 与 cardCount（以磁盘内容为准）
    const newLocations: Record<string, string> = {};
    const countByFile = new Map<string, number>();

    for (const fileInfo of index.files) {
      const cards = await this.readCardsFromFile(fileInfo.fileName);
      countByFile.set(fileInfo.fileName, cards.length);
      for (const card of cards) {
        if (card?.uuid && typeof card.uuid === 'string' && !newLocations[card.uuid]) {
          newLocations[card.uuid] = fileInfo.fileName;
        }
      }
    }

    index.cardLocations = newLocations;
    for (const fileInfo of index.files) {
      fileInfo.cardCount = countByFile.get(fileInfo.fileName) || 0;
      fileInfo.updatedAt = Date.now();
    }

    await this.saveIndex(index);
  }

  /**
   * 创建默认索引
   */
  private async createDefaultIndex(): Promise<void> {
    const now = Date.now();
    const defaultIndex: CardFileIndex = {
      version: '1.0.0',
      files: [{
        fileName: `${CARDS_FILE_PREFIX}-0`,
        displayName: '主卡片文件',
        cardCount: 0,
        isDefault: true,
        isAutoShard: false,
        createdAt: now,
        updatedAt: now
      }],
      cardLocations: {},
      lastUpdated: now
    };

    await this.saveIndex(defaultIndex);
    
    // 创建主卡片文件
    const adapter = this.plugin.app.vault.adapter;
    const defaultFilePath = `${this.cardsFolder}/${CARDS_FILE_PREFIX}-0.json`;
    if (!await adapter.exists(defaultFilePath)) {
      await adapter.write(defaultFilePath, JSON.stringify({ cards: [] }));
    }
  }

  /**
   * 清除索引缓存（外部文件变更时调用）
   * 下次 loadIndex() 将从磁盘重新读取
   */
  invalidateCache(): void {
    this.indexCache = null;
    logger.debug('[CardFileService] 索引缓存已清除');
  }

  /**
   * 加载索引
   */
  async loadIndex(): Promise<CardFileIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }

    try {
      const adapter = this.plugin.app.vault.adapter;
      const data = await safeReadJson<CardFileIndex>(adapter, this.indexPath);
      if (data) {
        this.indexCache = data;
        return this.indexCache;
      }
      logger.warn('[CardFileService] 索引文件不存在或无法解析，创建默认索引');
      await this.createDefaultIndex();
      return this.indexCache!;
    } catch (error) {
      logger.warn('[CardFileService] 加载索引失败，创建默认索引');
      await this.createDefaultIndex();
      return this.indexCache!;
    }
  }

  /**
   * 保存索引
   */
  private async saveIndex(index: CardFileIndex): Promise<void> {
    index.lastUpdated = Date.now();
    const adapter = this.plugin.app.vault.adapter;
    // 使用紧凑 JSON（无缩进）：索引文件是纯机读数据，紧凑格式减小文件体积，利于云同步
    await safeWriteJson(adapter, this.indexPath, JSON.stringify(index));
    this.indexCache = index;
  }

  /**
   * 获取所有卡片文件信息
   */
  async getCardFiles(): Promise<CardFileInfo[]> {
    const index = await this.loadIndex();
    return index.files;
  }

  /**
   * 创建新的卡片文件
   */
  async createCardFile(options: CreateCardFileOptions): Promise<CardFileInfo | null> {
    const { fileName, displayName, description, color, tags } = options;

    try {
      const index = await this.loadIndex();

      // 检查文件名是否已存在
      if (index.files.some(f => f.fileName === fileName)) {
        logger.error(`[CardFileService] 文件名已存在: ${fileName}`);
        return null;
      }

      const now = Date.now();
      const newFile: CardFileInfo = {
        fileName,
        displayName,
        description,
        color,
        tags,
        cardCount: 0,
        isDefault: false,
        isAutoShard: false,
        createdAt: now,
        updatedAt: now
      };

      // 创建实际文件
      const adapter = this.plugin.app.vault.adapter;
      const filePath = `${this.cardsFolder}/${fileName}.json`;
      await adapter.write(filePath, JSON.stringify({ cards: [] }));

      // 更新索引
      index.files.push(newFile);
      await this.saveIndex(index);

      logger.info(`[CardFileService] ✅ 创建卡片文件: ${fileName}`);
      return newFile;
    } catch (error) {
      logger.error('[CardFileService] 创建卡片文件失败:', error);
      return null;
    }
  }

  /**
   * 删除卡片文件（卡片移动到默认文件）
   */
  async deleteCardFile(fileName: string): Promise<boolean> {
    try {
      const index = await this.loadIndex();
      const fileInfo = index.files.find(f => f.fileName === fileName);

      if (!fileInfo) {
        logger.error(`[CardFileService] 文件不存在: ${fileName}`);
        return false;
      }

      if (fileInfo.isDefault) {
        logger.error('[CardFileService] 不能删除默认文件');
        return false;
      }

      // 读取要删除文件中的卡片
      const cards = await this.readCardsFromFile(fileName);

      // 移动卡片到默认文件
      if (cards.length > 0) {
        await this.moveCardsToFile(cards.map(c => c.uuid), 'default');
      }

      // 删除文件
      const adapter = this.plugin.app.vault.adapter;
      const filePath = `${this.cardsFolder}/${fileName}.json`;
      if (await adapter.exists(filePath)) {
        await adapter.remove(filePath);
      }

      // 更新索引
      index.files = index.files.filter(f => f.fileName !== fileName);
      await this.saveIndex(index);

      // 确保至少有一个文件
      await this.ensureDefaultFile();

      logger.info(`[CardFileService] ✅ 删除卡片文件: ${fileName}`);
      return true;
    } catch (error) {
      logger.error('[CardFileService] 删除卡片文件失败:', error);
      return false;
    }
  }

  /**
   * 移动卡片到指定文件
   */
  async moveCardsToFile(cardUUIDs: string[], targetFileName: string): Promise<MoveCardsResult> {
    try {
      const index = await this.loadIndex();
      
      // 验证目标文件存在
      if (!index.files.some(f => f.fileName === targetFileName)) {
        return { success: false, movedCount: 0, failedCount: cardUUIDs.length, error: '目标文件不存在' };
      }

      let movedCount = 0;
      let failedCount = 0;

      // 按源文件分组
      const cardsBySource = new Map<string, string[]>();
      for (const uuid of cardUUIDs) {
        const sourceFile = index.cardLocations[uuid];
        if (sourceFile && sourceFile !== targetFileName) {
          if (!cardsBySource.has(sourceFile)) {
            cardsBySource.set(sourceFile, []);
          }
          cardsBySource.get(sourceFile)!.push(uuid);
        } else if (!sourceFile) {
          failedCount++;
        }
      }

      // 读取目标文件
      const targetCards = await this.readCardsFromFile(targetFileName);

      // 从每个源文件移动卡片
      for (const [sourceFile, uuids] of cardsBySource) {
        const sourceCards = await this.readCardsFromFile(sourceFile);
        const cardsToMove: Card[] = [];
        const remainingCards: Card[] = [];

        for (const card of sourceCards) {
          if (uuids.includes(card.uuid)) {
            cardsToMove.push(card);
            movedCount++;
          } else {
            remainingCards.push(card);
          }
        }

        // 更新源文件
        await this.writeCardsToFile(sourceFile, remainingCards);

        // 添加到目标文件
        targetCards.push(...cardsToMove);

        // 更新索引中的位置
        for (const card of cardsToMove) {
          index.cardLocations[card.uuid] = targetFileName;
        }
      }

      // 保存目标文件
      await this.writeCardsToFile(targetFileName, targetCards);

      // 更新文件统计
      await this.updateFileStats(index);
      await this.saveIndex(index);

      // 检查是否需要自动分片
      await this.checkAndAutoShard(targetFileName);

      logger.info(`[CardFileService] ✅ 移动 ${movedCount} 张卡片到 ${targetFileName}`);
      return { success: true, movedCount, failedCount };
    } catch (error) {
      logger.error('[CardFileService] 移动卡片失败:', error);
      return { success: false, movedCount: 0, failedCount: cardUUIDs.length, error: String(error) };
    }
  }

  /**
   * 通过UUID查找卡片所在文件
   */
  async getCardLocation(uuid: string): Promise<string | null> {
    const index = await this.loadIndex();
    return index.cardLocations[uuid] || null;
  }

  /**
   * 保存卡片（自动确定文件位置）
   */
  async saveCard(card: Card): Promise<boolean> {
    try {
      logger.debug(`[CardFileService] 保存卡片: ${card.uuid}`);
      
      const index = await this.loadIndex();
      let targetFile = index.cardLocations[card.uuid];

      // 新卡片，放入默认文件
      if (!targetFile) {
        targetFile = this.getDefaultFileName(index);
        index.cardLocations[card.uuid] = targetFile;
        logger.debug(`[CardFileService] 新卡片，放入默认文件: ${targetFile}`);
      }

      // 使用 shard lock 保护读-改-写操作
      const shardFile = targetFile;
      await this.withShardLock(shardFile, async () => {
        const cards = await this.readCardsFromFile(shardFile);
        const existingIndex = cards.findIndex(c => c.uuid === card.uuid);

        if (existingIndex >= 0) {
          cards[existingIndex] = card;
          logger.debug(`[CardFileService] 更新现有卡片`);
        } else {
          cards.push(card);
          logger.debug(`[CardFileService] 添加新卡片，文件现有 ${cards.length} 张卡片`);
        }

        await this.writeCardsToFile(shardFile, cards);
        logger.debug(`[CardFileService] 已写入文件: ${shardFile}`);
      });

      // 更新索引
      await this.updateFileStats(index);
      await this.saveIndex(index);

      // 检查分片
      await this.checkAndAutoShard(shardFile);

      return true;
    } catch (error) {
      logger.error('[CardFileService] 保存卡片失败:', error);
      return false;
    }
  }

  async saveCardsBatch(cardsToSave: Card[]): Promise<boolean> {
    try {
      if (!cardsToSave || cardsToSave.length === 0) {
        return true;
      }

      const index = await this.loadIndex();
      const defaultFile = this.getDefaultFileName(index);

      const byFile = new Map<string, Card[]>();
      for (const card of cardsToSave) {
        if (!card?.uuid) continue;

        let targetFile = index.cardLocations[card.uuid];
        if (!targetFile) {
          targetFile = defaultFile;
          index.cardLocations[card.uuid] = targetFile;
        }

        const list = byFile.get(targetFile);
        if (list) {
          list.push(card);
        } else {
          byFile.set(targetFile, [card]);
        }
      }

      for (const [fileName, incoming] of byFile.entries()) {
        const existing = await this.readCardsFromFile(fileName);
        const mergedMap = new Map<string, Card>();
        for (const c of existing) {
          if (c?.uuid) mergedMap.set(c.uuid, c);
        }
        for (const c of incoming) {
          if (c?.uuid) mergedMap.set(c.uuid, c);
        }
        await this.writeCardsToFile(fileName, Array.from(mergedMap.values()));
      }

      await this.updateFileStats(index);
      await this.saveIndex(index);

      for (const fileName of byFile.keys()) {
        await this.checkAndAutoShard(fileName);
      }

      return true;
    } catch (error) {
      logger.error('[CardFileService] 批量保存卡片失败:', error);
      return false;
    }
  }

  /**
   * 删除卡片
   */
  async deleteCard(uuid: string): Promise<boolean> {
    try {
      const index = await this.loadIndex();
      const fileName = index.cardLocations[uuid];

      if (!fileName) {
        logger.warn(`[CardFileService] 卡片不在索引中: ${uuid}`);
        return false;
      }

      // 从文件中删除（使用 shard lock 保护）
      await this.withShardLock(fileName, async () => {
        const cards = await this.readCardsFromFile(fileName);
        const filteredCards = cards.filter(c => c.uuid !== uuid);
        await this.writeCardsToFile(fileName, filteredCards);
      });

      // 更新索引
      delete index.cardLocations[uuid];
      await this.updateFileStats(index);
      await this.saveIndex(index);

      return true;
    } catch (error) {
      logger.error('[CardFileService] 删除卡片失败:', error);
      return false;
    }
  }

  /**
   * 批量删除卡片（高效：按分片分组，每个分片只读写一次）
   * @returns 实际成功删除的UUID列表
   */
  async deleteCardsBatch(uuids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
    const deleted: string[] = [];
    const notFound: string[] = [];

    if (!uuids || uuids.length === 0) {
      return { deleted, notFound };
    }

    try {
      const index = await this.loadIndex();
      const uuidSet = new Set(uuids);

      // 按分片文件分组
      const byFile = new Map<string, Set<string>>();
      for (const uuid of uuids) {
        const fileName = index.cardLocations[uuid];
        if (!fileName) {
          notFound.push(uuid);
          continue;
        }
        let set = byFile.get(fileName);
        if (!set) {
          set = new Set();
          byFile.set(fileName, set);
        }
        set.add(uuid);
      }

      // 每个分片只读写一次
      for (const [fileName, uuidsInFile] of byFile.entries()) {
        await this.withShardLock(fileName, async () => {
          const cards = await this.readCardsFromFile(fileName);
          const before = cards.length;
          const filtered = cards.filter(c => !uuidsInFile.has(c.uuid));
          const removedCount = before - filtered.length;
          await this.writeCardsToFile(fileName, filtered);

          // 记录实际删除的
          for (const uuid of uuidsInFile) {
            if (cards.some(c => c.uuid === uuid)) {
              deleted.push(uuid);
            } else {
              notFound.push(uuid);
            }
          }

          logger.debug(`[CardFileService] 批量删除: 从 ${fileName} 移除 ${removedCount} 张卡片`);
        });
      }

      // 更新索引：移除已删除的卡片位置
      for (const uuid of deleted) {
        delete index.cardLocations[uuid];
      }
      // notFound 中也可能在 index 里有残留
      for (const uuid of notFound) {
        delete index.cardLocations[uuid];
      }

      await this.updateFileStats(index);
      await this.saveIndex(index);

      logger.info(`[CardFileService] 批量删除完成: 成功 ${deleted.length}, 未找到 ${notFound.length}`);
      return { deleted, notFound };
    } catch (error) {
      logger.error('[CardFileService] 批量删除卡片失败:', error);
      return { deleted, notFound };
    }
  }

  /**
   * 获取所有卡片
   */
  async getAllCards(): Promise<Card[]> {
    try {
      const index = await this.loadIndex();
      const allCards: Card[] = [];

      logger.debug(`[CardFileService] getAllCards: 索引包含 ${index.files.length} 个文件`);

      for (const fileInfo of index.files) {
        const cards = await this.readCardsFromFile(fileInfo.fileName);
        logger.debug(`[CardFileService] 从文件 ${fileInfo.fileName} 读取 ${cards.length} 张卡片`);
        allCards.push(...cards);
      }

      logger.debug(`[CardFileService] getAllCards: 共加载 ${allCards.length} 张卡片`);
      return allCards;
    } catch (error) {
      logger.error('[CardFileService] getAllCards 失败:', error);
      return [];
    }
  }

  // ===== 私有方法 =====

  /**
   * 从文件读取卡片
   */
  private async readCardsFromFile(fileName: string): Promise<Card[]> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      const filePath = `${this.cardsFolder}/${fileName}.json`;
      
      const data = await safeReadJson<{ cards: Card[] }>(adapter, filePath);
      return data?.cards || [];
    } catch (error) {
      logger.error(`[CardFileService] 读取文件失败: ${fileName}`, error);
      return [];
    }
  }

  /**
   * 写入卡片到文件
   * v2.1: 保存时过滤掉派生字段，这些字段应从 content YAML 解析获取
   */
  private async writeCardsToFile(fileName: string, cards: Card[]): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    const filePath = `${this.cardsFolder}/${fileName}.json`;
    
    // 标记内部写入，避免 ExternalSyncWatcher 误触发
    (this.plugin as any).externalSyncWatcher?.markInternalWrite();
    
    // 过滤掉派生字段，只保存核心数据
    const cleanedCards = cards.map(card => this.stripDerivedFields(card));
    
    await safeWriteJson(adapter, filePath, JSON.stringify({ cards: cleanedCards }));
  }

  /**
   * v2.1: 移除派生字段，这些字段应从 content YAML 解析获取
   * 保持数据文件简洁，避免冗余
   */
  private stripDerivedFields(card: Card): Partial<Card> {
    const {
      // 派生字段 - 不保存到文件，从 content YAML 解析
      sourceFile,
      sourceBlock,
      tags,
      type,
      priority,
      // fields 从 content 实时解析，referencedByDecks 从 we_decks 转换
      fields,
      referencedByDecks,
      // 弃用字段 - 引用式牌组架构下不再需要持久化
      deckId,
      templateId,
      // 保留其他所有字段
      ...coreFields
    } = card;
    
    return coreFields;
  }

  /**
   * 获取默认文件名
   */
  private getDefaultFileName(index: CardFileIndex): string {
    const defaultFile = index.files.find(f => f.isDefault);
    return defaultFile?.fileName || `${CARDS_FILE_PREFIX}-0`;
  }

  /**
   * 更新文件统计信息
   */
  private async updateFileStats(index: CardFileIndex): Promise<void> {
    // 统计每个文件的卡片数量
    const countByFile = new Map<string, number>();
    
    for (const fileName of Object.values(index.cardLocations)) {
      countByFile.set(fileName, (countByFile.get(fileName) || 0) + 1);
    }

    for (const fileInfo of index.files) {
      fileInfo.cardCount = countByFile.get(fileInfo.fileName) || 0;
      fileInfo.updatedAt = Date.now();
    }
  }

  /**
   * 检查并执行自动分片
   */
  private async checkAndAutoShard(fileName: string): Promise<void> {
    const index = await this.loadIndex();
    const fileInfo = index.files.find(f => f.fileName === fileName);
    
    if (!fileInfo) return;

    // 检查文件大小
    const adapter = this.plugin.app.vault.adapter;
    const filePath = `${this.cardsFolder}/${fileName}.json`;
    const stat = await adapter.stat(filePath);

    // OR 逻辑：卡片数超阈值 或 文件大小超阈值，任一满足即触发分片
    const countExceeded = fileInfo.cardCount >= SHARD_THRESHOLD_COUNT;
    const sizeExceeded = stat != null && stat.size >= SHARD_THRESHOLD_SIZE;
    if (!countExceeded && !sizeExceeded) {
      return;
    }

    // 需要分片
    logger.info(`[CardFileService] 文件 ${fileName} 需要分片 (${fileInfo.cardCount} 卡片, ${stat?.size ?? 0} 字节)`);
    await this.performAutoShard(fileName, index);
  }

  /**
   * 执行自动分片
   */
  private async performAutoShard(fileName: string, index: CardFileIndex): Promise<void> {
    const cards = await this.readCardsFromFile(fileName);
    
    if (cards.length <= 1) return;

    // 根据触发原因计算分割点：优先按卡片数，文件大小超标时按一半分割
    let splitAt: number;
    if (cards.length > SHARD_THRESHOLD_COUNT) {
      splitAt = SHARD_THRESHOLD_COUNT;
    } else {
      // 文件大小触发：将卡片对半分
      splitAt = Math.ceil(cards.length / 2);
    }

    // 计算新分片文件名：统一使用 cards-N 命名
    const allShardNums = index.files
      .filter(f => /^cards-\d+$/.test(f.fileName))
      .map(f => parseInt(f.fileName.replace('cards-', '')));
    
    const nextShardNum = allShardNums.length > 0 ? Math.max(...allShardNums) + 1 : 1;
    const newShardName = `${CARDS_FILE_PREFIX}-${nextShardNum}`;

    // 分割卡片
    const keepCards = cards.slice(0, splitAt);
    const moveCards = cards.slice(splitAt);

    // 保存原文件
    await this.writeCardsToFile(fileName, keepCards);

    // 创建新分片文件
    await this.writeCardsToFile(newShardName, moveCards);

    // 更新索引
    const now = Date.now();
    index.files.push({
      fileName: newShardName,
      displayName: `${index.files.find(f => f.fileName === fileName)?.displayName || fileName} (分片${nextShardNum})`,
      cardCount: moveCards.length,
      isDefault: false,
      isAutoShard: true,
      createdAt: now,
      updatedAt: now
    });

    // 更新卡片位置
    for (const card of moveCards) {
      index.cardLocations[card.uuid] = newShardName;
    }

    await this.updateFileStats(index);
    await this.saveIndex(index);

    logger.info(`[CardFileService] ✅ 自动分片完成: ${newShardName} (${moveCards.length} 张卡片)`);
  }

  /**
   * 确保默认文件存在
   */
  private async ensureDefaultFile(): Promise<void> {
    const index = await this.loadIndex();
    
    if (index.files.length === 0 || !index.files.some(f => f.isDefault)) {
      await this.createDefaultIndex();
    }
  }

  /**
   * 启动时对所有超阈值文件执行自动分片
   * 处理迁移后或历史遗留的超大文件
   */
  private async shardOversizedFiles(): Promise<void> {
    try {
      const index = await this.loadIndex();
      const adapter = this.plugin.app.vault.adapter;

      for (const fileInfo of [...index.files]) {
        const filePath = `${this.cardsFolder}/${fileInfo.fileName}.json`;
        const stat = await adapter.stat(filePath);
        if (!stat) continue;

        const countExceeded = fileInfo.cardCount >= SHARD_THRESHOLD_COUNT;
        const sizeExceeded = stat.size >= SHARD_THRESHOLD_SIZE;

        if (countExceeded || sizeExceeded) {
          logger.info(`[CardFileService] 启动分片: ${fileInfo.fileName} (${fileInfo.cardCount} 卡片, ${stat.size} 字节)`);
          await this.performAutoShard(fileInfo.fileName, index);
        }
      }
    } catch (error) {
      logger.warn('[CardFileService] 启动分片检查失败:', error);
    }
  }

  /**
   * 迁移旧文件名到规范命名
   * default.json → cards-0.json, default-N.json → cards-N.json
   * 同时处理其他非标准命名的文件（如用户自定义文件），合并到 cards-0
   */
  private async migrateOldFileNames(adapter: any): Promise<void> {
    try {
      const listing = adapter.list ? await adapter.list(this.cardsFolder) : { files: [] };
      const files: string[] = listing?.files || [];

      const jsonFiles = files
        .filter((p: string) => p.endsWith('.json'))
        .map((p: string) => ({ path: p, name: (p.split('/').pop() || '').replace(/\.json$/, '') }))
        .filter(f => f.name !== 'card-files-index');

      let migrated = 0;

      for (const file of jsonFiles) {
        let newName: string | null = null;

        if (file.name === 'default') {
          newName = `${CARDS_FILE_PREFIX}-0`;
        } else if (/^default-(\d+)$/.test(file.name)) {
          const num = file.name.match(/^default-(\d+)$/)![1];
          newName = `${CARDS_FILE_PREFIX}-${num}`;
        }

        if (newName && newName !== file.name) {
          const newPath = `${this.cardsFolder}/${newName}.json`;
          if (await adapter.exists(newPath)) {
            // 目标已存在，合并卡片数据
            try {
              const oldRaw = await adapter.read(file.path);
              const oldData = JSON.parse(oldRaw);
              const newRaw = await adapter.read(newPath);
              const newData = JSON.parse(newRaw);
              if (Array.isArray(oldData?.cards) && Array.isArray(newData?.cards)) {
                const merged = new Map<string, any>();
                for (const c of newData.cards) { if (c?.uuid) merged.set(c.uuid, c); }
                for (const c of oldData.cards) { if (c?.uuid && !merged.has(c.uuid)) merged.set(c.uuid, c); }
                await adapter.write(newPath, JSON.stringify({ cards: Array.from(merged.values()) }));
              }
              await adapter.remove(file.path);
              migrated++;
            } catch (e) {
              logger.warn(`[CardFileService] 合并旧文件失败: ${file.name}`, e);
            }
          } else {
            try {
              await adapter.rename(file.path, newPath);
              migrated++;
            } catch (e) {
              logger.warn(`[CardFileService] 重命名旧文件失败: ${file.name}`, e);
            }
          }
        }
      }

      // 合并非标准命名文件（如 nihao.json, legacy-deck_*.json）到 cards-0
      const nonStandardFiles = jsonFiles.filter(f =>
        f.name !== 'card-files-index' &&
        !/^cards-\d+$/.test(f.name) &&
        f.name !== 'default' &&
        !/^default-\d+$/.test(f.name)
      );

      if (nonStandardFiles.length > 0) {
        const primaryPath = `${this.cardsFolder}/${CARDS_FILE_PREFIX}-0.json`;
        let primaryCards = new Map<string, any>();

        // 读取主文件
        try {
          if (await adapter.exists(primaryPath)) {
            const raw = await adapter.read(primaryPath);
            const data = JSON.parse(raw);
            if (Array.isArray(data?.cards)) {
              for (const c of data.cards) { if (c?.uuid) primaryCards.set(c.uuid, c); }
            }
          }
        } catch { }

        for (const file of nonStandardFiles) {
          try {
            const raw = await adapter.read(file.path);
            const data = JSON.parse(raw);
            if (Array.isArray(data?.cards)) {
              for (const c of data.cards) {
                if (c?.uuid && !primaryCards.has(c.uuid)) {
                  primaryCards.set(c.uuid, c);
                }
              }
            }
            await adapter.remove(file.path);
            migrated++;
            logger.info(`[CardFileService] 合并非标准文件 ${file.name} 到 cards-0`);
          } catch (e) {
            logger.warn(`[CardFileService] 合并非标准文件失败: ${file.name}`, e);
          }
        }

        if (primaryCards.size > 0) {
          await adapter.write(primaryPath, JSON.stringify({ cards: Array.from(primaryCards.values()) }));
        }
      }

      if (migrated > 0) {
        // 清除索引缓存，让 rebuildIndexFromDisk 重建
        this.indexCache = null;
        logger.info(`[CardFileService] 迁移完成: ${migrated} 个文件已重命名/合并`);
      }
    } catch (error) {
      logger.warn('[CardFileService] 文件名迁移失败:', error);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.indexCache = null;
  }
}

// 单例导出
let cardFileServiceInstance: CardFileService | null = null;

export function getCardFileService(plugin?: WeavePlugin): CardFileService {
  if (!cardFileServiceInstance && plugin) {
    cardFileServiceInstance = new CardFileService(plugin);
  }
  if (!cardFileServiceInstance) {
    throw new Error('CardFileService not initialized');
  }
  return cardFileServiceInstance;
}

export function initCardFileService(plugin: WeavePlugin): CardFileService {
  cardFileServiceInstance = new CardFileService(plugin);
  return cardFileServiceInstance;
}
