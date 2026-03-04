import { logger } from '../../utils/logger';
/**
 * 卡片位置跟踪器
 * 用于记录卡片在原文件中的精确位置，支持UUID精确插入
 */

/**
 * 带位置信息的卡片数据
 */
export interface CardWithPosition {
  /** 卡片内容（不含分隔符） */
  content: string;
  
  /** 起始行号（第一个 <-> 所在行，从0开始） */
  startLine: number;
  
  /** 结束行号（第二个 <-> 所在行，从0开始） */
  endLine: number;
  
  /** 起始字节偏移 */
  startOffset: number;
  
  /** 结束字节偏移 */
  endOffset: number;
  
  /** 完整原始内容（包含两个分隔符） */
  rawContent: string;
  
  /** 卡片索引（在所有卡片中的位置） */
  index: number;
}

/**
 * 卡片位置跟踪器
 * 负责分割卡片并记录每张卡片的精确位置
 */
export class CardPositionTracker {
  private delimiter: string;

  constructor(delimiter: string) {
    this.delimiter = delimiter;
  }

  /**
   * 分割卡片并记录位置信息
   * 
   * 规则：
   * 1. 分隔符可以在行内任意位置（不再要求单独占一行）
   * 2. 支持两种模式：
   *    - 配对模式：%%<->%% 内容 %%<->%% （空行） %%<->%% 内容 %%<->%%
   *    - 共享模式：%%<->%% 内容1 %%<->%% 内容2 %%<->%% 内容3 %%<->%%
   * 3. 相邻两个分隔符之间的内容为一张卡片
   * 4. 记录每张卡片的精确位置（行号和字节偏移）
   */
  splitCardsWithPosition(content: string): CardWithPosition[] {
    const lines = content.split('\n');
    const cards: CardWithPosition[] = [];
    
    // 使用全局位置跟踪
    interface DelimiterPosition {
      lineIndex: number;
      charIndex: number;  // 行内字符位置
      globalOffset: number;  // 全局字节偏移
    }
    
    const delimiterPositions: DelimiterPosition[] = [];
    let globalOffset = 0;
    
    // 第一步：找到所有分隔符位置
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let searchStart = 0;
      
      // 在当前行查找所有分隔符
      while (true) {
        const charIndex = line.indexOf(this.delimiter, searchStart);
        if (charIndex === -1) break;
        
        delimiterPositions.push({
          lineIndex,
          charIndex,
          globalOffset: globalOffset + charIndex
        });
        
        searchStart = charIndex + this.delimiter.length;
      }
      
      globalOffset += line.length + 1; // +1 for \n
    }
    
    // 第二步：连续配对分隔符，提取卡片内容（支持共享分隔符）
    for (let i = 0; i < delimiterPositions.length - 1; i++) {
      const startDelim = delimiterPositions[i];
      const endDelim = delimiterPositions[i + 1];
      
      if (!endDelim) {
        logger.warn('[CardPositionTracker] ⚠️ 发现未闭合的卡片块（只有开始分隔符）');
        break;
      }
      
      // 提取卡片内容（不包含分隔符本身）
      let cardContent = '';
      
      if (startDelim.lineIndex === endDelim.lineIndex) {
        // 同一行的情况：%%<->%% content %%<->%%
        const line = lines[startDelim.lineIndex];
        const contentStart = startDelim.charIndex + this.delimiter.length;
        const contentEnd = endDelim.charIndex;
        cardContent = line.substring(contentStart, contentEnd);
      } else {
        // 跨多行的情况
        const firstLine = lines[startDelim.lineIndex];
        const lastLine = lines[endDelim.lineIndex];
        
        // 第一行：分隔符之后的内容
        const firstContent = firstLine.substring(startDelim.charIndex + this.delimiter.length);
        
        // 中间行：完整内容
        const middleLines = lines.slice(startDelim.lineIndex + 1, endDelim.lineIndex);
        
        // 最后一行：分隔符之前的内容
        const lastContent = lastLine.substring(0, endDelim.charIndex);
        
        // 组合
        cardContent = [firstContent, ...middleLines, lastContent].join('\n');
      }
      
      // 提取原始内容（包含分隔符）
      let rawContent = '';
      if (startDelim.lineIndex === endDelim.lineIndex) {
        const line = lines[startDelim.lineIndex];
        rawContent = line.substring(startDelim.charIndex, endDelim.charIndex + this.delimiter.length);
      } else {
        const firstLine = lines[startDelim.lineIndex];
        const lastLine = lines[endDelim.lineIndex];
        const firstPart = firstLine.substring(startDelim.charIndex);
        const middleLines = lines.slice(startDelim.lineIndex + 1, endDelim.lineIndex);
        const lastPart = lastLine.substring(0, endDelim.charIndex + this.delimiter.length);
        rawContent = [firstPart, ...middleLines, lastPart].join('\n');
      }
      
      cards.push({
        content: cardContent,
        startLine: startDelim.lineIndex,
        endLine: endDelim.lineIndex,
        startOffset: startDelim.globalOffset,
        endOffset: endDelim.globalOffset + this.delimiter.length,
        rawContent: rawContent,
        index: i  // 连续索引，不再是 i/2
      });
    }
    
    return cards;
  }

  /**
   * 验证卡片内容是否有效
   */
  isValidCardContent(content: string, minLength = 1): boolean {
    const trimmed = content.trim();
    return trimmed.length >= minLength;
  }

  /**
   * 检查指定行是否包含分隔符
   * 注意：不再要求分隔符单独占一行
   */
  isDelimiterLine(line: string): boolean {
    return line.includes(this.delimiter);
  }
}

