import { logger } from '../../../utils/logger';
/**
 * 批量解析-单文件单卡片的清理策略
 * 
 * 职责：
 * - 清理YAML frontmatter中的 weave-uuid 字段
 * - 保留其他YAML字段和文档内容
 */

import { TFile, Vault, App } from 'obsidian';
import { ICleanupStrategy } from '../MetadataCleanupStrategy';
import { CardCreationType, CleanupTarget, CleanupResult } from '../types';
import { FrontmatterManager } from '../../batch-parsing/FrontmatterManager';

export class BatchParseSingleCleanupStrategy implements ICleanupStrategy {
  readonly type = CardCreationType.BATCH_PARSE_SINGLE;
  private app: App;
  
  constructor(app: App) {
    this.app = app;
  }
  
  /**
   * 执行清理
   */
  async execute(target: CleanupTarget, vault: Vault): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      filePath: target.filePath,
      cleanedItems: []
    };
    
    try {
      // 验证是否需要清理
      if (!await this.shouldCleanup(target)) {
        result.success = true;
        return result;
      }
      
      // 获取文件
      const file = vault.getAbstractFileByPath(target.filePath);
      if (!(file instanceof TFile)) {
        result.error = `文件不存在: ${target.filePath}`;
        return result;
      }
      
      //  步骤1: 清理YAML frontmatter中的weave-uuid字段
      const frontmatterManager = new FrontmatterManager(this.app);
      
      const uuid = await frontmatterManager.getUUID(file);
      
      if (uuid) {
        await frontmatterManager.removeField(file, 'weave-uuid');
        result.cleanedItems.push(`weave-uuid: ${uuid}`);
      }
      
      //  步骤2: 清理文档内容中的块链接（如果存在）
      //  关键修复：批量解析的卡片也可能有块链接，必须一起清理！
      if (target.blockId) {
        try {
          const content = await vault.read(file);
          const cleanedContent = await this.removeBlockLink(content, target.blockId);
          
          if (cleanedContent !== content) {
            await vault.modify(file, cleanedContent);
            result.cleanedItems.push(`块链接: ^${target.blockId}`);
          }
        } catch (blockError) {
          logger.error('[BatchParseSingleCleanup] 清理块链接失败:', blockError);
          // 不影响整体成功状态
        }
      }
      
      result.success = true;
      
    } catch (error) {
      logger.error('[BatchParseSingleCleanup] 清理失败:', error);
      result.error = error instanceof Error ? error.message : String(error);
    }
    
    return result;
  }
  
  /**
   * 验证是否需要清理
   */
  async shouldCleanup(target: CleanupTarget): Promise<boolean> {
    // 必须有UUID或blockId
    if (!target.uuid && !target.blockId) {
      return false;
    }
    
    // 必须有文件路径
    if (!target.filePath) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 移除块链接
   *  采用与QuickCreateCleanupStrategy相同的成功定位逻辑
   * @param content 文件内容
   * @param blockId 块ID（不含^前缀）
   * @returns 清理后的内容
   */
  private async removeBlockLink(
    content: string,
    blockId: string
  ): Promise<string> {
    //  采用与ObsidianNavigationService相同的定位逻辑
    // 使用负向前瞻 (?![A-Za-z0-9_-]) 而不是行末 $
    const blockPattern = new RegExp(
      `\\s*\\^${this.escapeRegex(blockId)}(?![A-Za-z0-9_-])`,
      'gm'
    );
    
    //  阶段1：定位块链接位置
    const match = blockPattern.exec(content);
    
    if (!match) {
      return content;
    }
    
    //  阶段2：基于定位结果进行精确清理
    const beforeMatch = content.substring(0, match.index);
    const lineStartIndex = beforeMatch.lastIndexOf('\n') + 1;
    const lineEndIndex = content.indexOf('\n', match.index);
    const actualLineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
    
    // 提取当前行内容
    const currentLine = content.substring(lineStartIndex, actualLineEnd);
    
    // 移除块链接
    const cleanedLine = currentLine.replace(
      new RegExp(`\\s*\\^${this.escapeRegex(blockId)}.*$`),
      ''
    ).trimEnd();
    
    // 重新组装内容
    const result = content.substring(0, lineStartIndex) + 
                   cleanedLine + 
                   content.substring(actualLineEnd);
    
    return result;
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
