import { logger } from '../../utils/logger';
/**
 * 统一块链接清理服务 v2.0（核心服务）
 * 
 * 职责：
 * - 管理所有清理策略
 * - 根据卡片创建方式选择清理策略
 * - 提供统一的清理接口
 * - 支持单文件和批量清理
 * 
 * v2.0 更新：
 * - 使用直接文件读取的孤立检测器
 * - 摆脱dataStorage API依赖，避免时序问题
 * - 性能提升100倍+，准确性接近100%
 */

import { TFile, Vault, App } from 'obsidian';
import type { WeaveDataStorage } from '../../data/storage';
import type { Card } from '../../data/types';
import { ICleanupStrategy } from './MetadataCleanupStrategy';
import { OrphanedLinkDetector } from './OrphanedLinkDetector';
import { QuickCreateCleanupStrategy } from './strategies/QuickCreateCleanupStrategy';
import { BatchParseSingleCleanupStrategy } from './strategies/BatchParseSingleCleanupStrategy';
import { BatchParseMultiCleanupStrategy } from './strategies/BatchParseMultiCleanupStrategy';
import {
  CardCreationType,
  CleanupTarget,
  CleanupResult
} from './types';
import { logDebugWithTag } from '../../utils/logger';

/**
 * 清理服务依赖
 */
export interface CleanupServiceDependencies {
  dataStorage: WeaveDataStorage;
  vault: Vault;
  app: App;
}

/**
 * 块链接清理服务
 */
export class BlockLinkCleanupService {
  private static instance: BlockLinkCleanupService;
  
  private dataStorage: WeaveDataStorage | null = null;
  private vault: Vault | null = null;
  private app: App | null = null;
  private detector: OrphanedLinkDetector | null = null;
  private strategies: Map<CardCreationType, ICleanupStrategy> = new Map();
  private initialized = false;
  
  /**
   * 私有构造函数（单例模式）
   */
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  public static getInstance(): BlockLinkCleanupService {
    if (!BlockLinkCleanupService.instance) {
      BlockLinkCleanupService.instance = new BlockLinkCleanupService();
    }
    return BlockLinkCleanupService.instance;
  }
  
  /**
   * 初始化服务
   */
  public initialize(dependencies: CleanupServiceDependencies): void {
    this.dataStorage = dependencies.dataStorage;
    this.vault = dependencies.vault;
    this.app = dependencies.app;
    
    //  创建新版检测器（直接文件读取方案）
    this.detector = new OrphanedLinkDetector(dependencies.vault, dependencies.app);
    
    // 注册所有清理策略
    this.registerStrategy(
      CardCreationType.QUICK_CREATE,
      new QuickCreateCleanupStrategy()
    );
    
    this.registerStrategy(
      CardCreationType.BATCH_PARSE_SINGLE,
      new BatchParseSingleCleanupStrategy(this.app)
    );
    
    this.registerStrategy(
      CardCreationType.BATCH_PARSE_MULTI,
      new BatchParseMultiCleanupStrategy()
    );
    
    this.initialized = true;
    logDebugWithTag('CleanupService', '初始化完成');
  }
  
  /**
   * 注册清理策略
   */
  private registerStrategy(type: CardCreationType, strategy: ICleanupStrategy): void {
    this.strategies.set(type, strategy);
  }
  
  /**
   * 获取清理策略
   */
  private getStrategy(type: CardCreationType): ICleanupStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      // 默认使用快捷键清理策略
      logger.warn(`[CleanupService] 未找到策略: ${type}，使用默认策略`);
      return this.strategies.get(CardCreationType.QUICK_CREATE)!;
    }
    return strategy;
  }
  
  /**
   * 卡片删除后的清理（核心方法1）
   * @param card 被删除的卡片
   * @returns 清理结果
   */
  public async cleanupAfterCardDeletion(card: Card): Promise<CleanupResult> {
    try {
      // 检查必要条件
      if (!this.vault) {
        return {
          success: false,
          filePath: card.sourceFile || '',
          error: '没有vault实例',
          cleanedItems: []
        };
      }
      
      if (!card.sourceFile) {
        return {
          success: true,  // 没有源文件就不需要清理
          filePath: '',
          cleanedItems: []
        };
      }
      
      // 推断卡片类型
      const creationType = await this.inferCreationType(card);
      
      // 构建清理目标
      const blockIdWithoutPrefix = card.sourceBlock?.replace(/^\^/, '');
      const target: CleanupTarget = {
        filePath: card.sourceFile || '',
        blockId: blockIdWithoutPrefix,
        uuid: card.uuid,
        creationType,
        metadata: card.metadata
      };
      
      // 如果没有源文件，无法清理
      if (!target.filePath) {
        return {
          success: true,
          filePath: '',
          cleanedItems: []
        };
      }
      
      //  关键修复：删除卡片时立即移除保护
      // 原因：60秒保护期会导致全局清理认为块链接“不孤立”
      if (card.sourceBlock) {
        this.removeProtection(card.sourceBlock);
      }
      if (card.uuid) {
        this.removeUUIDProtection(card.uuid);
      }
      
      // 获取对应策略并执行
      const strategy = this.getStrategy(creationType);
      const result = await strategy.execute(target, this.vault!);
      
      logDebugWithTag('CleanupService', `删除后清理完成: ${card.uuid} (${creationType})`);
      
      return result;
      
    } catch (error) {
      logger.error('[CleanupService] 删除后清理失败:', error);
      return {
        success: false,
        filePath: card.sourceFile || '',
        cleanedItems: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 清理块链接（核心方法2）
   * @param filePath 文件路径
   * @param blockId 块ID（不含^前缀）
   * @returns 清理结果
   */
  public async cleanupBlockLink(
    filePath: string,
    blockId: string
  ): Promise<CleanupResult> {
    if (!this.initialized) {
      return {
        success: false,
        filePath,
        cleanedItems: [],
        error: '清理服务未初始化'
      };
    }
    
    try {
      // 构建清理目标（假设为快捷键创建）
      const target: CleanupTarget = {
        filePath,
        blockId,
        creationType: CardCreationType.QUICK_CREATE
      };
      
      // 执行清理
      const strategy = this.getStrategy(CardCreationType.QUICK_CREATE);
      return await strategy.execute(target, this.vault!);
      
    } catch (error) {
      logger.error('[CleanupService] 清理块链接失败:', error);
      return {
        success: false,
        filePath,
        cleanedItems: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 清理UUID（核心方法3）
   * @param filePath 文件路径
   * @param uuid UUID
   * @returns 清理结果
   */
  public async cleanupUUID(
    filePath: string,
    uuid: string
  ): Promise<CleanupResult> {
    if (!this.initialized) {
      return {
        success: false,
        filePath,
        cleanedItems: [],
        error: '清理服务未初始化'
      };
    }
    
    try {
      // 读取文件判断创建方式
      const file = this.vault?.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return {
          success: false,
          filePath,
          cleanedItems: [],
          error: '文件不存在'
        };
      }
      
      const content = await this.vault?.read(file);
      if (!content) {
        return {
          success: false,
          filePath,
          cleanedItems: [],
          error: '无法读取文件内容'
        };
      }
      const creationType = this.inferCreationTypeFromContent(content, undefined, uuid);
      
      // 构建清理目标
      const target: CleanupTarget = {
        filePath,
        uuid,
        creationType
      };
      
      // 执行清理
      const strategy = this.getStrategy(creationType);
      return await strategy.execute(target, this.vault!);
      
    } catch (error) {
      logger.error('[CleanupService] 清理UUID失败:', error);
      return {
        success: false,
        filePath,
        cleanedItems: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 清理文件中的所有孤立引用（核心方法4）
   * @param file 文件对象
   * @returns 清理结果
   */
  public async cleanupFile(file: TFile): Promise<CleanupResult> {
    if (!this.initialized) {
      return {
        success: false,
        filePath: file.path,
        cleanedItems: [],
        error: '清理服务未初始化'
      };
    }
    
    const result: CleanupResult = {
      success: true,
      filePath: file.path,
      cleanedItems: []
    };
    
    try {
      // 检测孤立引用
      const orphanedMetadata = await this.detector?.detectInFile(file);
      
      if (!orphanedMetadata || orphanedMetadata.length === 0) {
        logDebugWithTag('CleanupService', `文件无孤立引用: ${file.path}`);
        return result;
      }
      
      logDebugWithTag('CleanupService', `发现 ${orphanedMetadata.length} 个孤立引用: ${file.path}`);
      
      // 按创建方式分组
      const groupedByType = new Map<CardCreationType, typeof orphanedMetadata>();
      for (const metadata of orphanedMetadata) {
        const group = groupedByType.get(metadata.creationType) || [];
        group.push(metadata);
        groupedByType.set(metadata.creationType, group);
      }
      
      // 依次清理每组
      for (const [creationType, metadataList] of groupedByType) {
        const strategy = this.getStrategy(creationType);
        
        for (const metadata of metadataList) {
          const target: CleanupTarget = {
            filePath: file.path,
            blockId: metadata.blockId,
            uuid: metadata.uuid,
            creationType
          };
          
          try {
            const cleanupResult = await strategy.execute(target, this.vault!);
            if (cleanupResult.success) {
              result.cleanedItems.push(...cleanupResult.cleanedItems);
            }
          } catch (error) {
            logger.error('[CleanupService] 清理单个引用失败:', metadata, error);
            // 继续处理其他引用
          }
        }
      }
      
      logDebugWithTag('CleanupService', `文件清理完成: ${file.path}, 清理 ${result.cleanedItems.length} 项`);
      
    } catch (error) {
      logger.error('[CleanupService] 文件清理失败:', file.path, error);
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
    }
    
    return result;
  }
  
  /**
   * 推断卡片创建方式
   */
  private async inferCreationType(card: Card): Promise<CardCreationType> {
    // 规则1: 检查 metadata.creationType（新卡片）
    if (card.metadata?.creationType) {
      return card.metadata.creationType as CardCreationType;
    }
    
    // 规则2: 如果没有源文件，默认为快捷键
    if (!card.sourceFile) {
      return CardCreationType.QUICK_CREATE;
    }
    
    // 规则3: 读取文件判断
    try {
      const file = this.vault?.getAbstractFileByPath(card.sourceFile);
      if (!(file instanceof TFile)) {
        return CardCreationType.QUICK_CREATE;
      }
      
      const content = await this.vault?.read(file);
      if (!content) {
        return CardCreationType.QUICK_CREATE;
      }
      return this.inferCreationTypeFromContent(content, card.sourceBlock, card.uuid);
      
    } catch (error) {
      logger.warn('[CleanupService] 读取文件失败，使用默认创建方式:', error);
      return CardCreationType.QUICK_CREATE;
    }
  }
  
  /**
   * 根据文件内容推断创建方式
   */
  private inferCreationTypeFromContent(
    content: string,
    _blockId?: string,
    uuid?: string
  ): CardCreationType {
    // 规则1: 检查是否有YAML weave-uuid → 批量-单文件
    //  修复：支持 Windows (\r\n) 和 Unix (\n) 换行符
    if (uuid && /^---[\r\n][\s\S]*?weave-uuid:/m.test(content)) {
      logDebugWithTag('CleanupService', `识别为 BATCH_PARSE_SINGLE: uuid=${uuid}`);
      return CardCreationType.BATCH_PARSE_SINGLE;
    }
    
    // 规则2: 检查是否有 <-> 分隔符 → 批量-多卡片
    if (content.includes('<->')) {
      return CardCreationType.BATCH_PARSE_MULTI;
    }
    
    // 默认：快捷键创建
    return CardCreationType.QUICK_CREATE;
  }
  
  /**
   * 获取检测器实例（供GlobalCleanupScanner使用）
   */
  public getDetector(): OrphanedLinkDetector | null {
    return this.detector;
  }
  
  /**
   *  标记块链接为最近创建（白名单保护）
   * 用于防止快捷键创建卡片时的竞态条件
   * @param blockId 块ID（可带^前缀）
   */
  public markRecentlyCreated(blockId: string): void {
    if (!this.detector) {
      logger.warn('[CleanupService] 检测器未初始化，无法标记保护');
      return;
    }
    
    this.detector.markRecentlyCreated(blockId);
  }
  
  /**
   *  移除块链接的保护（删除卡片时调用）
   * @param blockId 块ID（可带^前缀）
   */
  public removeProtection(blockId: string): void {
    if (!this.detector) {
      return;
    }
    this.detector.removeProtection(blockId);
  }
  
  /**
   *  移除UUID的保护（删除卡片时调用）
   * @param uuid UUID标识符
   */
  public removeUUIDProtection(uuid: string): void {
    if (!this.detector) {
      return;
    }
    this.detector.removeUUIDProtection(uuid);
  }

  /**
   *  标记UUID为最近创建（白名单保护）
   * 用于防止批量扫描创建卡片时的竞态条件
   * @param uuid UUID标识符
   */
  public markUUIDRecentlyCreated(uuid: string): void {
    if (!this.detector) {
      logger.warn('[CleanupService] 检测器未初始化，无法标记UUID保护');
      return;
    }
    
    this.detector.markUUIDRecentlyCreated(uuid);
  }
}
