import { logger } from '../utils/logger';
/**
 * 题库数据迁移工具
 * 
 * 将题库数据从错误位置 '.obsidian/plugins/weave/question-bank' 
 * 迁移到正确位置 'weave/question-bank'
 */

import { App, Notice } from 'obsidian';
import type { WeavePlugin } from '../main';
import { getV2PathsFromApp } from '../config/paths';

export interface MigrationResult {
  success: boolean;
  migratedFiles: string[];
  errors: string[];
  skippedFiles: string[];
}

export class QuestionBankMigration {
  private app: App;
  private plugin: WeavePlugin;
  private oldBasePath = '.obsidian/plugins/weave/question-bank';
  private newBasePath: string;

  constructor(plugin: WeavePlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.newBasePath = getV2PathsFromApp(plugin.app).questionBank.root;
  }

  /**
   * 检查是否需要迁移
   */
  async needsMigration(): Promise<boolean> {
    const adapter = this.app.vault.adapter;
    
    // 检查旧路径是否存在
    const oldPathExists = await adapter.exists(this.oldBasePath);
    if (!oldPathExists) {
      return false;
    }

    //  新路径已有数据时不再迁移，避免旧路径反复回灌导致“删除后又出现”
    // 仅当新路径不存在 banks.json（首次迁移）时才允许迁移
    const newBanksFile = `${this.newBasePath}/banks.json`;
    const newHasBanksFile = await adapter.exists(newBanksFile);
    if (newHasBanksFile) {
      return false;
    }

    // 检查是否有文件需要迁移
    const files = await this.getFilesToMigrate();
    return files.length > 0;
  }

  /**
   * 获取需要迁移的文件列表
   */
  private async getFilesToMigrate(): Promise<string[]> {
    try {
      const adapter = this.app.vault.adapter;
      const files: string[] = [];

      if (await adapter.exists(this.oldBasePath)) {
        // 检查主要数据文件
        const dataFiles = ['banks.json', 'questions.json'];
        for (const file of dataFiles) {
          const filePath = `${this.oldBasePath}/${file}`;
          if (await adapter.exists(filePath)) {
            files.push(file);
          }
        }

        // 检查子目录
        const subdirs = ['test-sessions', 'test-history', 'in-progress', 'error-book'];
        for (const subdir of subdirs) {
          const subdirPath = `${this.oldBasePath}/${subdir}`;
          if (await adapter.exists(subdirPath)) {
            try {
              const stat = await adapter.stat(subdirPath);
              if (stat?.type === 'folder') {
                // 获取子目录中的文件
                const subdirFiles = await this.getFilesInDirectory(subdirPath);
                files.push(...subdirFiles.map(_f => `${subdir}/${_f}`));
              }
            } catch (error) {
              logger.warn(`[Migration] 无法访问目录 ${subdirPath}:`, error);
            }
          }
        }
      }

      return files;
    } catch (error) {
      logger.error('[Migration] 获取迁移文件列表失败:', error);
      return [];
    }
  }

  /**
   * 获取目录中的文件
   */
  private async getFilesInDirectory(dirPath: string): Promise<string[]> {
    try {
      const adapter = this.app.vault.adapter;
      const items = await adapter.list(dirPath);
      return items.files.map(f => f.replace(`${dirPath}/`, ''));
    } catch (error) {
      logger.warn(`[Migration] 无法列出目录 ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedFiles: [],
      errors: [],
      skippedFiles: []
    };

    try {
      logger.debug('[Migration] 开始题库数据迁移...');
      logger.debug(`[Migration] 源路径: ${this.oldBasePath}`);
      logger.debug(`[Migration] 目标路径: ${this.newBasePath}`);

      // 获取需要迁移的文件
      const filesToMigrate = await this.getFilesToMigrate();
      logger.debug(`[Migration] 发现 ${filesToMigrate.length} 个文件需要迁移`);

      if (filesToMigrate.length === 0) {
        result.success = true;
        logger.debug('[Migration] 没有文件需要迁移');
        return result;
      }

      // 确保目标目录存在
      await this.ensureTargetDirectories();

      // 逐个迁移文件
      for (const file of filesToMigrate) {
        try {
          await this.migrateFile(file);
          result.migratedFiles.push(file);
          logger.debug(`[Migration] ✅ 迁移成功: ${file}`);
        } catch (error) {
          const errorMsg = `迁移文件 ${file} 失败: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          logger.error(`[Migration] ❌ ${errorMsg}`);
        }
      }

      // 验证迁移结果
      const migrationSuccessful = result.errors.length === 0;
      
      if (migrationSuccessful) {
        // 清理旧文件夹（可选）
        await this.cleanupOldDirectory();
        result.success = true;
        logger.debug('[Migration] ✅ 题库数据迁移完成');
        new Notice('题库数据迁移完成');
      } else {
        logger.error('[Migration] ❌ 迁移过程中发生错误，请检查日志');
        new Notice('题库数据迁移失败，请查看控制台');
      }

    } catch (error) {
      const errorMsg = `迁移过程失败: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      logger.error('[Migration]', errorMsg);
      new Notice('题库数据迁移失败');
    }

    return result;
  }

  /**
   * 确保目标目录存在
   */
  private async ensureTargetDirectories(): Promise<void> {
    const adapter = this.app.vault.adapter;
    
    // 创建主目录
    if (!(await adapter.exists(this.newBasePath))) {
      await adapter.mkdir(this.newBasePath);
      logger.debug(`[Migration] 创建目录: ${this.newBasePath}`);
    }

    // banks 子目录
    const banksDir = `${this.newBasePath}/banks`;
    if (!(await adapter.exists(banksDir))) {
      await adapter.mkdir(banksDir);
      logger.debug(`[Migration] 创建目录: ${banksDir}`);
    }
  }

  /**
   * 迁移单个文件
   */
  private async migrateFile(file: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    
    const sourcePath = `${this.oldBasePath}/${file}`;
    const targetPath = `${this.newBasePath}/${file}`;

    // 确保目标父目录存在（adapter.write 不会自动创建父目录）
    const lastSlash = targetPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const parentDir = targetPath.slice(0, lastSlash);
      if (!(await adapter.exists(parentDir))) {
        await adapter.mkdir(parentDir);
      }
    }

    // 读取源文件
    const content = await adapter.read(sourcePath);
    
    // 写入目标文件
    await adapter.write(targetPath, content);
    
    logger.debug(`[Migration] 文件迁移: ${sourcePath} -> ${targetPath}`);
  }

  /**
   * 清理旧目录
   */
  private async cleanupOldDirectory(): Promise<void> {
    try {
      const adapter = this.app.vault.adapter;
      
      if (await adapter.exists(this.oldBasePath)) {
        // 删除旧目录及其内容
        await adapter.rmdir(this.oldBasePath, true);
        logger.debug(`[Migration] 清理旧目录: ${this.oldBasePath}`);
      }
    } catch (error) {
      logger.warn('[Migration] 清理旧目录失败:', error);
      // 不阻断迁移流程
    }
  }

  /**
   * 更新QuestionBankStorage的basePath配置
   */
  async updateStorageConfig(): Promise<void> {
    try {
      logger.debug('[Migration] 更新QuestionBankStorage配置...');
      
      // 如果插件中有questionBankStorage实例，更新其配置
      const questionBankStorage = (this.plugin as any).questionBankStorage;
      if (questionBankStorage) {
        // 更新basePath
        (questionBankStorage as any).basePath = this.newBasePath;
        logger.debug(`[Migration] ✅ QuestionBankStorage basePath updated to: ${this.newBasePath}`);
      }
    } catch (error) {
      logger.error('[Migration] 更新存储配置失败:', error);
    }
  }

  /**
   * 自动执行迁移（如果需要）
   * 注意：此方法在 QuestionBankService 初始化之前调用，只执行文件迁移
   */
  static async autoMigrate(plugin: WeavePlugin): Promise<void> {
    const migration = new QuestionBankMigration(plugin);
    
    if (await migration.needsMigration()) {
      logger.debug('[Migration] 检测到题库数据需要迁移');
      const result = await migration.migrate();
      
      if (result.success) {
        // 更新存储配置
        await migration.updateStorageConfig();
      }
    }
  }
  
  /**
   * 🆕 修复缺失的 pairedMemoryDeckId（需要在服务初始化后调用）
   * 
   * 问题背景：
   * - 通过 AI 生成测试题创建的考试牌组，可能因为代码 Bug 导致 pairedMemoryDeckId 未正确保存
   * - 这会导致从记忆牌组界面无法找到对应的考试牌组
   * 
   * 修复策略：
   * 1. 遍历所有考试牌组
   * 2. 检查是否缺少 pairedMemoryDeckId
   * 3. 通过名称匹配找到对应的记忆牌组（考试牌组名称格式："{记忆牌组名称} - 考试"）
   * 4. 自动建立关联
   */
  async fixMissingPairedMemoryDeckId(): Promise<{ fixed: number; failed: number }> {
    const result = { fixed: 0, failed: 0 };
    
    try {
      // 检查服务是否可用
      if (!this.plugin.questionBankService || !this.plugin.dataStorage) {
        logger.debug('[Migration] 服务未就绪，跳过 pairedMemoryDeckId 修复');
        return result;
      }
      
      // 获取所有考试牌组
      const allBanks = await this.plugin.questionBankService.getAllBanks();
      
      // 获取所有记忆牌组
      const allDecks = await this.plugin.dataStorage.getDecks();
      
      // 筛选出缺少 pairedMemoryDeckId 的考试牌组
      const banksNeedingFix = allBanks.filter(bank => {
        const pairedId = (bank.metadata as any)?.pairedMemoryDeckId;
        return !pairedId || pairedId === undefined || pairedId === null;
      });
      
      if (banksNeedingFix.length === 0) {
        logger.debug('[Migration] 所有考试牌组的 pairedMemoryDeckId 都已设置，无需修复');
        return result;
      }
      
      logger.info(`[Migration] 发现 ${banksNeedingFix.length} 个考试牌组缺少 pairedMemoryDeckId，开始修复...`);
      
      for (const bank of banksNeedingFix) {
        try {
          // 尝试通过名称匹配找到对应的记忆牌组
          // 考试牌组名称格式："{记忆牌组名称} - 考试" 或 "{记忆牌组名称} - 题库"
          const bankName = bank.name;
          let memoryDeckName = '';
          
          // 尝试多种命名模式
          const suffixes = [' - 考试', ' - 题库', '-考试', '-题库'];
          for (const suffix of suffixes) {
            if (bankName.endsWith(suffix)) {
              memoryDeckName = bankName.slice(0, -suffix.length);
              break;
            }
          }
          
          if (!memoryDeckName) {
            // 如果没有匹配到后缀，尝试直接用考试牌组名称查找
            memoryDeckName = bankName;
          }
          
          // 查找对应的记忆牌组
          const matchedDeck = allDecks.find(deck => 
            deck.name === memoryDeckName || 
            deck.name === bankName ||
            // 也尝试模糊匹配（考试牌组名称包含记忆牌组名称）
            bankName.includes(deck.name)
          );
          
          if (matchedDeck) {
            // 找到匹配的记忆牌组，更新 pairedMemoryDeckId
            logger.info(`[Migration] 修复考试牌组 "${bank.name}" -> 关联记忆牌组 "${matchedDeck.name}" (${matchedDeck.id})`);
            
            // 更新 metadata
            if (!bank.metadata) {
              bank.metadata = {};
            }
            (bank.metadata as any).pairedMemoryDeckId = matchedDeck.id;
            
            // 保存更新
            await this.plugin.questionBankService.updateBank(bank);
            
            result.fixed++;
            logger.info(`[Migration] ✅ 成功修复: ${bank.name}`);
          } else {
            // 未找到匹配的记忆牌组
            logger.warn(`[Migration] ⚠️ 未找到考试牌组 "${bank.name}" 对应的记忆牌组`);
            result.failed++;
          }
        } catch (error) {
          logger.error(`[Migration] ❌ 修复考试牌组 "${bank.name}" 失败:`, error);
          result.failed++;
        }
      }
      
      if (result.fixed > 0) {
        logger.info(`[Migration] ✅ pairedMemoryDeckId 修复完成: 成功 ${result.fixed} 个, 失败 ${result.failed} 个`);
        new Notice(`已修复 ${result.fixed} 个考试牌组的关联关系`);
      }
      
    } catch (error) {
      logger.error('[Migration] pairedMemoryDeckId 修复过程失败:', error);
    }
    
    return result;
  }
  
  /**
   * 🆕 在服务初始化后执行修复（静态方法，供 main.ts 调用）
   */
  static async fixPairedMemoryDeckIdAfterInit(plugin: WeavePlugin): Promise<void> {
    const migration = new QuestionBankMigration(plugin);
    await migration.fixMissingPairedMemoryDeckId();
  }
}
