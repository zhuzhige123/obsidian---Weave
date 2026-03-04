/**
 * 内容拆分工具函数
 * 
 * 提供规则拆分和手动标记解析功能
 * 
 * @module utils/content-split-utils
 * @version 1.0.0
 */

import type { 
  ContentBlock, 
  RuleSplitConfig 
} from '../types/content-split-types';
import { 
  SPLIT_MARKER_REGEX,
  generateSplitMarkerId 
} from '../types/content-split-types';
import { extractBodyContent, parseYAMLFromContent } from './yaml-utils';

export function deriveFileTitleFromContent(content: string, defaultTitle?: string): string {
  const yaml = parseYAMLFromContent(content);
  const yamlTitle = typeof yaml.title === 'string' ? yaml.title.trim() : '';
  if (yamlTitle) return yamlTitle;

  const body = extractBodyContent(content);
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingTitle = headingMatch[1].trim();
      if (headingTitle) return headingTitle;
    }
    break;
  }

  if (defaultTitle && defaultTitle.trim()) return defaultTitle.trim();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
  }

  return 'untitled';
}

/**
 * 根据规则拆分内容
 */
export function splitByRules(
  content: string,
  config: RuleSplitConfig,
  options?: { defaultTitle?: string }
): ContentBlock[] {
  if (!content.trim()) {
    return [];
  }

  // 如果启用整个文件作为一个块，直接返回整个内容
  if (config.enableWholeFile) {
    const title = deriveFileTitleFromContent(content, options?.defaultTitle);
    return [{
      id: generateSplitMarkerId(),
      title,
      content: content.trim(),
      charCount: content.trim().length,
      startOffset: 0,
      endOffset: content.length
    }];
  }

  const splitPoints: number[] = [0];
  const lines = content.split('\n');
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentOffset;

    // 按标题拆分
    if (config.enableHeadingSplit && config.headingLevels.length > 0) {
      const headingMatch = line.match(/^(#{1,6})\s+/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        if (config.headingLevels.includes(level)) {
          if (lineStart > 0 && !splitPoints.includes(lineStart)) {
            splitPoints.push(lineStart);
          }
        }
      }
    }

    // 按空行拆分
    if (config.enableBlankLineSplit && config.blankLineCount > 0) {
      let blankCount = 0;
      let j = i;
      while (j < lines.length && lines[j].trim() === '') {
        blankCount++;
        j++;
      }
      if (blankCount >= config.blankLineCount) {
        const splitOffset = currentOffset;
        if (splitOffset > 0 && !splitPoints.includes(splitOffset)) {
          splitPoints.push(splitOffset);
        }
      }
    }

    // 按符号拆分
    if (config.enableSymbolSplit && config.splitSymbol) {
      if (line.trim() === config.splitSymbol.trim()) {
        const splitOffset = lineStart;
        if (splitOffset > 0 && !splitPoints.includes(splitOffset)) {
          splitPoints.push(splitOffset);
        }
      }
    }

    currentOffset += line.length + 1; // +1 for newline
  }

  // 添加结束点
  splitPoints.push(content.length);

  // 排序去重
  const sortedPoints = [...new Set(splitPoints)].sort((a, b) => a - b);

  // 生成内容块
  const blocks: ContentBlock[] = [];
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const startOffset = sortedPoints[i];
    const endOffset = sortedPoints[i + 1];
    let blockContent = content.substring(startOffset, endOffset).trim();

    // 移除拆分符号行（如果按符号拆分）
    if (config.enableSymbolSplit && config.splitSymbol) {
      const lines = blockContent.split('\n');
      blockContent = lines
        .filter(line => line.trim() !== config.splitSymbol.trim())
        .join('\n')
        .trim();
    }

    // 过滤空内容块
    if (config.filterEmptyBlocks && !blockContent.trim()) {
      continue;
    }

    // 检查最小字符数
    if (blockContent.length < config.minBlockCharCount) {
      continue;
    }

    // 提取标题
    const title = extractTitle(blockContent, config.preserveHeadingAsTitle);

    blocks.push({
      id: generateSplitMarkerId(),
      title,
      content: blockContent,
      charCount: blockContent.length,
      startOffset,
      endOffset
    });
  }

  return blocks;
}

/**
 * 解析手动拆分标记
 */
export function parseManualSplitMarkers(content: string): ContentBlock[] {
  if (!content.trim()) {
    return [];
  }

  const markers: { index: number; marker: string }[] = [];
  let match;

  // 重置正则
  const regex = new RegExp(SPLIT_MARKER_REGEX.source, 'g');
  
  while ((match = regex.exec(content)) !== null) {
    markers.push({
      index: match.index,
      marker: match[0]
    });
  }

  // 生成分割点
  const splitPoints: number[] = [0];
  
  for (const { index, marker } of markers) {
    // 拆分点在标记之后
    splitPoints.push(index + marker.length);
  }
  
  splitPoints.push(content.length);

  // 生成内容块
  const blocks: ContentBlock[] = [];
  
  for (let i = 0; i < splitPoints.length - 1; i++) {
    const startOffset = splitPoints[i];
    let endOffset = splitPoints[i + 1];
    
    // 对于非最后一块，结束位置需要调整到标记之前
    if (i < markers.length) {
      endOffset = markers[i].index;
    }
    
    let blockContent = content.substring(startOffset, endOffset).trim();
    
    // 移除标记本身
    blockContent = blockContent.replace(SPLIT_MARKER_REGEX, '').trim();

    if (!blockContent) {
      continue;
    }

    const title = extractTitle(blockContent, true);

    blocks.push({
      id: generateSplitMarkerId(),
      title,
      content: blockContent,
      charCount: blockContent.length,
      startOffset,
      endOffset
    });
  }

  // 处理最后一块（最后一个标记之后的内容）
  if (markers.length > 0) {
    const lastMarker = markers[markers.length - 1];
    const lastStartOffset = lastMarker.index + lastMarker.marker.length;
    const lastContent = content.substring(lastStartOffset).trim();
    
    if (lastContent) {
      // 检查是否已添加
      const alreadyAdded = blocks.some(b => 
        b.content === lastContent || 
        b.startOffset === lastStartOffset
      );
      
      if (!alreadyAdded) {
        blocks.push({
          id: generateSplitMarkerId(),
          title: extractTitle(lastContent, true),
          content: lastContent,
          charCount: lastContent.length,
          startOffset: lastStartOffset,
          endOffset: content.length
        });
      }
    }
  }

  return blocks;
}

/**
 * 从内容中提取标题
 */
function extractTitle(content: string, preserveHeading: boolean): string {
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 尝试提取Markdown标题
    if (preserveHeading) {
      const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        return headingMatch[1].trim();
      }
    }
    
    // 返回首行作为标题（截取前50个字符）
    return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
  }
  
  return '(无标题)';
}

/**
 * 将内容块转换为带标记的内容
 */
export function blocksToMarkedContent(
  originalContent: string,
  blocks: ContentBlock[]
): string {
  if (blocks.length <= 1) {
    return originalContent;
  }

  let result = '';
  
  for (let i = 0; i < blocks.length; i++) {
    result += blocks[i].content;
    
    // 在块之间添加标记（除了最后一块）
    if (i < blocks.length - 1) {
      result += `\n\n<!-- weave-ir: ir-${blocks[i].id} -->\n\n`;
    }
  }
  
  return result;
}
