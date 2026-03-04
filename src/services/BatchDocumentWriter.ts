import { logger } from '../utils/logger';
/**
 * 批量文档写入器
 * 负责将更新后的内容写回文件系统
 */
import { App, TFile, Notice } from 'obsidian';

export interface WriteResult {
  success: boolean;
  filePath: string;
  error?: string;
  blocksInserted?: number;
}

export class BatchDocumentWriter {
  constructor(private app: App) {}

  /**
   * 写入更新后的内容到文件
   * @param filePath 文件路径
   * @param newContent 新内容
   * @returns 写入结果
   */
  async writeContent(filePath: string, newContent: string): Promise<WriteResult> {
    try {
      // 获取文件
      const file = this.app.vault.getAbstractFileByPath(filePath);
      
      if (!file || !(file instanceof TFile)) {
        return {
          success: false,
          filePath,
          error: '文件不存在或不可访问'
        };
      }

      // 读取当前内容（用于比较）
      const currentContent = await this.app.vault.read(file);
      
      // 检查内容是否有变化
      if (currentContent === newContent) {
        logger.debug('内容无变化，跳过写入');
        return {
          success: true,
          filePath,
          blocksInserted: 0
        };
      }

      // 计算插入的块ID数量
      const currentBlockCount = (currentContent.match(/\^[\w-]+/g) || []).length;
      const newBlockCount = (newContent.match(/\^[\w-]+/g) || []).length;
      const blocksInserted = newBlockCount - currentBlockCount;

      // 写入文件
      await this.app.vault.modify(file, newContent);

      logger.debug(`成功写入文件: ${filePath}`);
      logger.debug(`插入 ${blocksInserted} 个块链接`);

      // 显示通知
      new Notice(`已插入 ${blocksInserted} 个块链接`);

      return {
        success: true,
        filePath,
        blocksInserted
      };

    } catch (error) {
      logger.error('写入文件失败:', error);
      
      new Notice(`写入文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
      
      return {
        success: false,
        filePath,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 验证文件是否可写
   */
  async canWrite(filePath: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      return file instanceof TFile;
    } catch {
      return false;
    }
  }
}



