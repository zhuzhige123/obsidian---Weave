import { logger } from '../../../utils/logger';
/**
 * 批量解析-多卡片的清理策略
 * 
 * 职责：
 * - 在卡片块开头插入 #we_已删除 标签（确保 Obsidian 能识别）
 * - **删除** <!-- tk-xxx --> ^we-xxx 行（避免重复扫描）
 * - 保留卡片内容
 * 
 * 清理后格式：
 * ```
 * <->
 * #we_已删除
 * 
 * 卡片内容...
 * <->
 * ```
 */

import { TFile, Vault } from 'obsidian';
import { ICleanupStrategy } from '../MetadataCleanupStrategy';
import { CardCreationType, CleanupTarget, CleanupResult } from '../types';
import { logDebugWithTag } from '../../../utils/logger';

export class BatchParseMultiCleanupStrategy implements ICleanupStrategy {
  readonly type = CardCreationType.BATCH_PARSE_MULTI;
  
  // 删除标记模式（标签格式）
  // 使用 we_ 前缀避免与用户常见标签冲突
  private readonly DELETION_TAG = '#we_已删除';
  
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
      
      // 查找卡片块
      const blockInfo = this.findCardBlock(content, target.blockId || target.uuid!);
      if (!blockInfo) {
        result.error = `未找到卡片块: ${target.blockId || target.uuid}`;
        return result;
      }
      
      // 标记卡片块为已删除
      const cleanedContent = this.markCardBlockAsDeleted(
        content,
        blockInfo.startIndex,
        blockInfo.endIndex
      );
      
      // 写回文件
      if (cleanedContent !== content) {
        await vault.modify(file, cleanedContent);
        result.cleanedItems.push(`#we_已删除标签 (${target.blockId || target.uuid})`);
        logDebugWithTag('BatchParseMultiCleanup', `标记删除: ${target.blockId || target.uuid} in ${target.filePath}`);
      }
      
      result.success = true;
      
    } catch (error) {
      logger.error('[BatchParseMultiCleanup] 清理失败:', error);
      result.error = error instanceof Error ? error.message : String(error);
    }
    
    return result;
  }
  
  /**
   * 验证是否需要清理
   */
  async shouldCleanup(target: CleanupTarget): Promise<boolean> {
    // 必须有块ID或UUID
    if (!target.blockId && !target.uuid) {
      return false;
    }
    
    // 必须有文件路径
    if (!target.filePath) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 查找卡片块
   * @param content 文件内容
   * @param identifier 块ID或UUID
   * @returns 卡片块的起始和结束位置，如果未找到返回null
   */
  private findCardBlock(
    content: string,
    identifier: string
  ): { startIndex: number; endIndex: number; blockContent: string } | null {
    // 按 <-> 分隔符分割
    const delimiter = '<->';
    const parts = content.split(delimiter);
    
    // 查找包含指定标识符的卡片块
    let currentIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // 检查是否包含块ID或UUID
      if (
        part.includes(`^${identifier}`) ||
        part.includes(identifier)
      ) {
        // 计算起始和结束位置
        const startIndex = currentIndex;
        const endIndex = currentIndex + part.length;
        
        return {
          startIndex,
          endIndex,
          blockContent: part
        };
      }
      
      // 更新位置索引（包括分隔符长度）
      currentIndex += part.length + delimiter.length;
    }
    
    return null;
  }
  
  /**
   * 标记卡片块为已删除
   * @param content 文件内容
   * @param startIndex 卡片块起始位置
   * @param endIndex 卡片块结束位置
   * @returns 标记后的内容
   */
  private markCardBlockAsDeleted(
    content: string,
    startIndex: number,
    endIndex: number
  ): string {
    const blockContent = content.substring(startIndex, endIndex);
    
    // 检查是否已经标记为删除
    if (blockContent.includes('#we_已删除') || blockContent.includes('#we_deleted')) {
      return content; // 已经标记，无需重复
    }
    
    // 1. 删除UUID和块链接注释行
    // 匹配格式: <!-- tk-xxxxxxxxxxxx --> ^blockid 或 <!-- tk-xxxxxxxxxxxx → ^blockid
    const uuidLineRegex = /<!--\s*tk-[a-z0-9]{12}\s*(?:-->|→)\s*\^[a-z0-9-_]+.*$/im;
    
    const lines = blockContent.split('\n');
    const cleanedLines = lines.filter(line => !uuidLineRegex.test(line.trim()));
    
    // 2. 在第一行（或第二行如果第一行为空）插入 #已删除 标签
    // 确保 Obsidian 能识别标签
    const processedLines = [];
    
    // 找到第一个非空行的位置插入标签
    let insertPosition = 0;
    for (let i = 0; i < cleanedLines.length; i++) {
      if (cleanedLines[i].trim() !== '') {
        insertPosition = i;
        break;
      }
    }
    
    // 插入 #已删除 标签
    for (let i = 0; i < cleanedLines.length; i++) {
      if (i === insertPosition) {
        // 在第一个非空行前插入标签，确保有空行分隔
        processedLines.push('#we_已删除');
        processedLines.push(''); // 空行，确保标签被正确识别
      }
      processedLines.push(cleanedLines[i]);
    }
    
    // 如果没找到非空行，直接在开头插入
    if (insertPosition === 0 && cleanedLines.length === 0) {
      processedLines.push('#we_已删除');
      processedLines.push(''); // 空行
    }
    
    // 3. 重新组合内容
    const newBlockContent = processedLines.join('\n');
    
    // 4. 重新组合文件内容
    const beforeBlock = content.substring(0, startIndex);
    const afterBlock = content.substring(endIndex);
    
    return beforeBlock + newBlockContent + afterBlock;
  }
}
