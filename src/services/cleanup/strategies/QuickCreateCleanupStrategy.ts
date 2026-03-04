import { logger } from '../../../utils/logger';
/**
 * 快捷键创建卡片的清理策略
 * 
 * 职责：
 * - 清理行末的 ^we-xxxxxx 块链接
 * - 保留行的其他内容
 */

import { TFile, Vault } from 'obsidian';
import { ICleanupStrategy } from '../MetadataCleanupStrategy';
import { CardCreationType, CleanupTarget, CleanupResult } from '../types';
import { logDebugWithTag } from '../../../utils/logger';

export class QuickCreateCleanupStrategy implements ICleanupStrategy {
  readonly type = CardCreationType.QUICK_CREATE;
  
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
      
      // 读取文件内容
      const content = await vault.read(file);
      
      // 移除块链接
      const cleanedContent = await this.removeBlockLinkFromLine(
        content,
        target.blockId!
      );
      
      // 写回文件
      if (cleanedContent !== content) {
        await vault.modify(file, cleanedContent);
        result.cleanedItems.push(`^${target.blockId}`);
        logDebugWithTag('QuickCreateCleanup', `清理块链接: ^${target.blockId} from ${target.filePath}`);
      }
      
      result.success = true;
      
    } catch (error) {
      logger.error('[QuickCreateCleanup] 清理失败:', error);
      result.error = error instanceof Error ? error.message : String(error);
    }
    
    return result;
  }
  
  /**
   * 验证是否需要清理
   */
  async shouldCleanup(target: CleanupTarget): Promise<boolean> {
    // 必须有块ID
    if (!target.blockId) {
      return false;
    }
    
    // 必须有文件路径
    if (!target.filePath) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 从行中移除块链接
   *  采用ObsidianNavigationService的成功定位逻辑：使用负向前瞻而不是行末匹配
   * @param content 文件内容
   * @param blockId 块ID（不含^前缀）
   * @returns 清理后的内容
   */
  private async removeBlockLinkFromLine(
    content: string,
    blockId: string
  ): Promise<string> {
    //  采用与ObsidianNavigationService相同的定位逻辑（见obsidian-navigation-service.ts第206行）
    // 原因：跳转能成功说明这个逻辑能准确定位块链接
    // 关键改进：使用负向前瞻 (?![A-Za-z0-9_-]) 而不是行末 $
    const blockPattern = new RegExp(
      `\\s*\\^${this.escapeRegex(blockId)}(?![A-Za-z0-9_-])`,  // 负向前瞻：确保后面不是字母数字
      'gm'
    );
    
    //  阶段1：定位块链接位置（与ObsidianNavigationService逻辑一致）
    const match = blockPattern.exec(content);
    
    if (!match) {
      logDebugWithTag('QuickCreateCleanup', `未找到块链接 ^${blockId}，可能已被清理`);
      return content;  // 未找到，返回原内容
    }
    
    //  阶段2：基于定位结果进行精确清理
    // 计算块链接所在行
    const beforeMatch = content.substring(0, match.index);
    const lineStartIndex = beforeMatch.lastIndexOf('\n') + 1;
    const lineEndIndex = content.indexOf('\n', match.index);
    const actualLineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
    
    // 提取当前行内容
    const currentLine = content.substring(lineStartIndex, actualLineEnd);
    
    // 移除块链接（移除 ` ^blockId` 及其后面的所有空白字符）
    const cleanedLine = currentLine.replace(
      new RegExp(`\\s*\\^${this.escapeRegex(blockId)}.*$`),  // 移除到行尾
      ''
    ).trimEnd();  // 移除尾部空白
    
    // 重新组装内容
    const result = content.substring(0, lineStartIndex) + 
                   cleanedLine + 
                   content.substring(actualLineEnd);
    
    logDebugWithTag('QuickCreateCleanup', `清理成功: ^${blockId}, 行: "${currentLine}" -> "${cleanedLine}"`);
    
    return result;
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
