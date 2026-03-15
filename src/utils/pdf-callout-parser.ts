/**
 * PDF++ Callout 解析器
 * 
 * 解析 Obsidian PDF++ 生成的 callout 格式文本，
 * 提取标题、链接、页码等信息，并自动推断层级关系。
 * 
 * @module utils/pdf-callout-parser
 */

/**
 * 解析后的阅读点条目
 */
export interface ParsedReadingPoint {
  /** 标题（从引用文本提取） */
  title: string;
  /** 完整的 wikilink 路径（不含 [[ ]]），用于 openLinkText */
  resumeLink: string;
  /** PDF 文件路径 */
  pdfFilePath: string;
  /** 页码 */
  pageNumber: number;
  /** 自动推断的层级深度（0 = 顶级） */
  level: number;
  /** 原始 callout 文本（用于调试） */
  raw: string;
}

/**
 * 解析 PDF++ callout 文本，支持一次粘贴多条
 * 
 * 输入格式：
 * ```
 * > [!PDF|] [[path/file.pdf#page=1&selection=121,0,121,19|display]]
 * > > 选中的文本
 * ```
 */
export function parsePdfCallouts(text: string): ParsedReadingPoint[] {
  const results: ParsedReadingPoint[] = [];
  const lines = text.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // 匹配 callout 头部：> [!PDF|...] [[...]]
    const calloutMatch = line.match(/^>\s*\[!PDF[^\]]*\]\s*\[\[([^\]]+)\]\]/i);
    if (!calloutMatch) {
      i++;
      continue;
    }

    const wikilinkContent = calloutMatch[1]; // path/file.pdf#page=1&selection=...|display

    // 解析 wikilink 内容
    const pipeIdx = wikilinkContent.indexOf('|');
    const linkPart = pipeIdx >= 0 ? wikilinkContent.substring(0, pipeIdx) : wikilinkContent;

    // 提取文件路径和 fragment
    const hashIdx = linkPart.indexOf('#');
    const pdfFilePath = hashIdx >= 0 ? linkPart.substring(0, hashIdx) : linkPart;
    const fragment = hashIdx >= 0 ? linkPart.substring(hashIdx + 1) : '';

    // 提取页码
    const pageMatch = fragment.match(/page=(\d+)/);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 0;

    // 构建 resumeLink（用于 openLinkText）
    const resumeLink = linkPart;

    // 查找引用文本（下一行的 > > 内容）
    let title = '';
    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine === '' || nextLine === '>') {
        j++;
        continue;
      }
      // 匹配 > > 文本 或 >> 文本
      const quoteMatch = nextLine.match(/^>\s*>\s*(.+)/);
      if (quoteMatch) {
        title = quoteMatch[1].trim();
        j++;
        break;
      }
      // 如果遇到新的 callout 或非引用行，停止
      if (nextLine.match(/^>\s*\[!/) || !nextLine.startsWith('>')) {
        break;
      }
      j++;
    }

    // 如果没有引用文本，使用 display 部分或默认标题
    if (!title) {
      if (pipeIdx >= 0) {
        title = wikilinkContent.substring(pipeIdx + 1).trim();
      }
      if (!title) {
        title = `Page ${pageNumber}`;
      }
    }

    results.push({
      title,
      resumeLink,
      pdfFilePath,
      pageNumber,
      level: 0,
      raw: lines.slice(i, j).join('\n')
    });

    i = j;
  }

  // 推断层级
  inferHierarchy(results);

  return results;
}

/**
 * 从标题编号自动推断层级关系
 * 
 * 支持的编号格式：
 * - "1 标题" → level 0
 * - "1.1 标题" → level 1
 * - "1.1.1 标题" → level 2
 * - "第一章" / "第1节" → level 0
 * - 无编号 → 保持当前推断
 */
export function inferHierarchy(points: ParsedReadingPoint[]): void {
  if (points.length === 0) return;

  // 编号格式正则：匹配 "1" / "1.1" / "1.1.1" 等
  const numberingRegex = /^(\d+(?:\.\d+)*)\s/;
  // 中文章节正则
  const chineseChapterRegex = /^[第][\d一二三四五六七八九十百]+[章节部分篇]/;

  let hasNumbering = false;

  for (const pt of points) {
    const numMatch = pt.title.match(numberingRegex);
    if (numMatch) {
      hasNumbering = true;
      const parts = numMatch[1].split('.');
      pt.level = parts.length - 1;
    } else if (chineseChapterRegex.test(pt.title)) {
      pt.level = 0;
    }
  }

  // 如果没有任何编号，所有项目保持 level 0
  if (!hasNumbering) {
    for (const pt of points) {
      pt.level = 0;
    }
  }
}

/**
 * 根据层级关系和父材料ID，为每个阅读点分配 parentMaterialId
 * 
 * @param points 解析后的阅读点（带 level）
 * @param rootParentId 根父材料的 UUID
 * @param createdIds 已创建的阅读点 UUID 列表（与 points 索引对应）
 * @returns 每个点的 parentMaterialId
 */
export function resolveParentIds(
  points: ParsedReadingPoint[],
  rootParentId: string,
  createdIds: string[]
): string[] {
  const parentIds: string[] = [];
  // 栈：[level, materialId]
  const stack: Array<[number, string]> = [[-1, rootParentId]];

  for (let i = 0; i < points.length; i++) {
    const level = points[i].level;

    // 弹出栈中 level >= 当前 level 的项
    while (stack.length > 1 && stack[stack.length - 1][0] >= level) {
      stack.pop();
    }

    parentIds.push(stack[stack.length - 1][1]);

    // 将当前项压入栈
    if (i < createdIds.length) {
      stack.push([level, createdIds[i]]);
    }
  }

  return parentIds;
}
