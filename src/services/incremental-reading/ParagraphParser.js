/**
 * 段落解析器
 *
 * 将 Markdown 文档按不同模式分割为段落块，用于聚焦阅读模式
 *
 * 支持的分割模式：
 * - paragraph: 按空行分割（默认）
 * - heading: 按 Markdown 标题（H1-H6）分割
 * - manual: 手动标记范围（使用特殊注释标记）
 * - combined: 组合模式（标题 + 手动标记）
 *
 * @module services/incremental-reading/ParagraphParser
 * @version 2.0.0
 */
import { ANCHOR_REGEX } from '../../types/incremental-reading-types';
/**
 * 默认解析器配置
 */
export const DEFAULT_PARSER_CONFIG = {
    mode: 'paragraph',
    headingConfig: {
        splitLevel: 2, // 默认按二级标题分割
        includeHeadingLine: true
    },
    manualMarkerConfig: {
        startMarker: '<!-- focus-start -->',
        endMarker: '<!-- focus-end -->'
    }
};
/**
 * 段落解析器
 *
 * 功能：
 * - 按空行分割文档为段落块（paragraph 模式）
 * - 按 Markdown 标题分割文档（heading 模式）
 * - 按手动标记分割文档（manual 模式）
 * - 组合模式支持（combined 模式）
 * - 处理代码块、引用块等特殊块级元素
 * - 计算每个段落的行号和字符偏移
 * - 检测段落中的锚点标记
 */
export class ParagraphParser {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_PARSER_CONFIG, ...config };
    }
    /**
     * 更新解析器配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 将文档内容解析为段落块
     * 根据配置的模式选择不同的解析策略
     *
     * @param content 文档内容
     * @returns 段落数组
     */
    parseDocument(content) {
        switch (this.config.mode) {
            case 'heading':
                return this.parseByHeading(content);
            case 'manual':
                return this.parseByManualMarkers(content);
            case 'combined':
                return this.parseCombined(content);
            case 'paragraph':
            default:
                return this.parseByParagraph(content);
        }
    }
    /**
     * 按空行分割文档（原有逻辑）
     */
    parseByParagraph(content) {
        const paragraphs = [];
        const lines = content.split('\n');
        let currentParagraphLines = [];
        let startLine = 0;
        let startOffset = 0;
        let currentOffset = 0;
        let inCodeBlock = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLength = line.length + (i < lines.length - 1 ? 1 : 0); // +1 for newline except last line
            // 检测代码块边界
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }
            // 在代码块内，不分割段落
            if (inCodeBlock) {
                if (currentParagraphLines.length === 0) {
                    startLine = i;
                    startOffset = currentOffset;
                }
                currentParagraphLines.push(line);
                currentOffset += lineLength;
                continue;
            }
            if (line.trim() === '') {
                // 空行：结束当前段落
                if (currentParagraphLines.length > 0) {
                    const paragraph = this.createParagraph(paragraphs.length, startLine, i - 1, startOffset, currentOffset - 1, currentParagraphLines);
                    paragraphs.push(paragraph);
                    currentParagraphLines = [];
                }
                // 更新下一段落的起始位置
                startLine = i + 1;
                startOffset = currentOffset + lineLength;
            }
            else {
                // 非空行：添加到当前段落
                if (currentParagraphLines.length === 0) {
                    startLine = i;
                    startOffset = currentOffset;
                }
                currentParagraphLines.push(line);
            }
            currentOffset += lineLength;
        }
        // 处理最后一个段落
        if (currentParagraphLines.length > 0) {
            const paragraph = this.createParagraph(paragraphs.length, startLine, lines.length - 1, startOffset, content.length, currentParagraphLines);
            paragraphs.push(paragraph);
        }
        return paragraphs;
    }
    /**
     * 按 Markdown 标题分割文档
     *
     * 简化逻辑：只按指定级别的标题分割
     * 例如 splitLevel=2 时，每个 ## 标题到下一个 ## 标题之间为一个块
     * 更低级别的标题（如 ###）不会触发分割，而是包含在当前块内
     */
    parseByHeading(content) {
        const paragraphs = [];
        const lines = content.split('\n');
        const config = this.config.headingConfig || DEFAULT_PARSER_CONFIG.headingConfig;
        // 获取分割级别（优先使用 splitLevel，向后兼容 minLevel）
        const splitLevel = config.splitLevel ?? config.minLevel ?? 2;
        // 标题正则：匹配 # 到 ###### 
        const headingRegex = /^(#{1,6})\s+(.+)$/;
        let currentLines = [];
        let startLine = 0;
        let startOffset = 0;
        let currentOffset = 0;
        let currentHeadingLevel;
        let currentHeadingText;
        let inCodeBlock = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLength = line.length + (i < lines.length - 1 ? 1 : 0);
            // 检测代码块边界
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }
            // 在代码块内，不检测标题
            if (!inCodeBlock) {
                const headingMatch = line.match(headingRegex);
                if (headingMatch) {
                    const level = headingMatch[1].length;
                    const text = headingMatch[2].trim();
                    // 只有当标题级别等于分割级别时才触发分割
                    if (level === splitLevel) {
                        // 保存之前的段落
                        if (currentLines.length > 0) {
                            const paragraph = this.createHeadingParagraph(paragraphs.length, startLine, i - 1, startOffset, currentOffset - 1, currentLines, currentHeadingLevel, currentHeadingText);
                            paragraphs.push(paragraph);
                            currentLines = [];
                        }
                        // 开始新段落
                        startLine = i;
                        startOffset = currentOffset;
                        currentHeadingLevel = level;
                        currentHeadingText = text;
                        if (config.includeHeadingLine) {
                            currentLines.push(line);
                        }
                        currentOffset += lineLength;
                        continue;
                    }
                }
            }
            // 非分割标题行或代码块内：添加到当前段落
            if (currentLines.length === 0 && currentHeadingLevel === undefined) {
                // 文档开头没有标题的内容
                startLine = i;
                startOffset = currentOffset;
            }
            currentLines.push(line);
            currentOffset += lineLength;
        }
        // 处理最后一个段落
        if (currentLines.length > 0) {
            const paragraph = this.createHeadingParagraph(paragraphs.length, startLine, lines.length - 1, startOffset, content.length, currentLines, currentHeadingLevel, currentHeadingText);
            paragraphs.push(paragraph);
        }
        return paragraphs;
    }
    /**
     * 按手动标记分割文档
     * 使用 <!-- focus-start --> 和 <!-- focus-end --> 标记
     */
    parseByManualMarkers(content) {
        const paragraphs = [];
        const lines = content.split('\n');
        const config = this.config.manualMarkerConfig || DEFAULT_PARSER_CONFIG.manualMarkerConfig;
        let currentLines = [];
        let startLine = 0;
        let startOffset = 0;
        let currentOffset = 0;
        let inManualBlock = false;
        let blockStartLine = 0;
        let blockStartOffset = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLength = line.length + (i < lines.length - 1 ? 1 : 0);
            const trimmedLine = line.trim();
            if (trimmedLine === config.startMarker) {
                // 保存之前的非标记内容
                if (currentLines.length > 0 && !inManualBlock) {
                    const paragraph = this.createParagraph(paragraphs.length, startLine, i - 1, startOffset, currentOffset - 1, currentLines);
                    paragraphs.push(paragraph);
                    currentLines = [];
                }
                inManualBlock = true;
                blockStartLine = i + 1;
                blockStartOffset = currentOffset + lineLength;
                currentOffset += lineLength;
                continue;
            }
            if (trimmedLine === config.endMarker && inManualBlock) {
                // 结束手动标记块
                if (currentLines.length > 0) {
                    const paragraph = this.createManualBlockParagraph(paragraphs.length, blockStartLine, i - 1, blockStartOffset, currentOffset - 1, currentLines);
                    paragraphs.push(paragraph);
                    currentLines = [];
                }
                inManualBlock = false;
                startLine = i + 1;
                startOffset = currentOffset + lineLength;
                currentOffset += lineLength;
                continue;
            }
            // 添加到当前段落
            if (currentLines.length === 0) {
                if (inManualBlock) {
                    blockStartLine = i;
                    blockStartOffset = currentOffset;
                }
                else {
                    startLine = i;
                    startOffset = currentOffset;
                }
            }
            currentLines.push(line);
            currentOffset += lineLength;
        }
        // 处理最后一个段落
        if (currentLines.length > 0) {
            if (inManualBlock) {
                const paragraph = this.createManualBlockParagraph(paragraphs.length, blockStartLine, lines.length - 1, blockStartOffset, content.length, currentLines);
                paragraphs.push(paragraph);
            }
            else {
                const paragraph = this.createParagraph(paragraphs.length, startLine, lines.length - 1, startOffset, content.length, currentLines);
                paragraphs.push(paragraph);
            }
        }
        return paragraphs;
    }
    /**
     * 组合模式：标题 + 手动标记
     * 优先使用手动标记，其次按指定级别的标题分割
     */
    parseCombined(content) {
        const paragraphs = [];
        const lines = content.split('\n');
        const headingConfig = this.config.headingConfig || DEFAULT_PARSER_CONFIG.headingConfig;
        const markerConfig = this.config.manualMarkerConfig || DEFAULT_PARSER_CONFIG.manualMarkerConfig;
        // 获取分割级别（优先使用 splitLevel，向后兼容 minLevel）
        const splitLevel = headingConfig.splitLevel ?? headingConfig.minLevel ?? 2;
        const headingRegex = /^(#{1,6})\s+(.+)$/;
        let currentLines = [];
        let startLine = 0;
        let startOffset = 0;
        let currentOffset = 0;
        let currentHeadingLevel;
        let currentHeadingText;
        let inCodeBlock = false;
        let inManualBlock = false;
        let isManualBlock = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLength = line.length + (i < lines.length - 1 ? 1 : 0);
            const trimmedLine = line.trim();
            // 检测代码块边界
            if (trimmedLine.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }
            // 手动标记优先级最高
            if (!inCodeBlock) {
                if (trimmedLine === markerConfig.startMarker) {
                    // 保存之前的内容
                    if (currentLines.length > 0) {
                        const paragraph = this.createCombinedParagraph(paragraphs.length, startLine, i - 1, startOffset, currentOffset - 1, currentLines, currentHeadingLevel, currentHeadingText, isManualBlock);
                        paragraphs.push(paragraph);
                        currentLines = [];
                    }
                    inManualBlock = true;
                    isManualBlock = true;
                    startLine = i + 1;
                    startOffset = currentOffset + lineLength;
                    currentHeadingLevel = undefined;
                    currentHeadingText = undefined;
                    currentOffset += lineLength;
                    continue;
                }
                if (trimmedLine === markerConfig.endMarker && inManualBlock) {
                    if (currentLines.length > 0) {
                        const paragraph = this.createCombinedParagraph(paragraphs.length, startLine, i - 1, startOffset, currentOffset - 1, currentLines, undefined, undefined, true);
                        paragraphs.push(paragraph);
                        currentLines = [];
                    }
                    inManualBlock = false;
                    isManualBlock = false;
                    startLine = i + 1;
                    startOffset = currentOffset + lineLength;
                    currentOffset += lineLength;
                    continue;
                }
                // 不在手动块内时，检测标题
                if (!inManualBlock) {
                    const headingMatch = line.match(headingRegex);
                    if (headingMatch) {
                        const level = headingMatch[1].length;
                        const text = headingMatch[2].trim();
                        // 只有当标题级别等于分割级别时才触发分割
                        if (level === splitLevel) {
                            // 保存之前的段落
                            if (currentLines.length > 0) {
                                const paragraph = this.createCombinedParagraph(paragraphs.length, startLine, i - 1, startOffset, currentOffset - 1, currentLines, currentHeadingLevel, currentHeadingText, false);
                                paragraphs.push(paragraph);
                                currentLines = [];
                            }
                            startLine = i;
                            startOffset = currentOffset;
                            currentHeadingLevel = level;
                            currentHeadingText = text;
                            isManualBlock = false;
                            if (headingConfig.includeHeadingLine) {
                                currentLines.push(line);
                            }
                            currentOffset += lineLength;
                            continue;
                        }
                    }
                }
            }
            // 普通行
            if (currentLines.length === 0) {
                startLine = i;
                startOffset = currentOffset;
            }
            currentLines.push(line);
            currentOffset += lineLength;
        }
        // 处理最后一个段落
        if (currentLines.length > 0) {
            const paragraph = this.createCombinedParagraph(paragraphs.length, startLine, lines.length - 1, startOffset, content.length, currentLines, currentHeadingLevel, currentHeadingText, isManualBlock);
            paragraphs.push(paragraph);
        }
        return paragraphs;
    }
    /**
     * 创建标题段落对象
     */
    createHeadingParagraph(index, startLine, endLine, startOffset, endOffset, lines, headingLevel, headingText) {
        const content = lines.join('\n');
        const anchorMatch = content.match(ANCHOR_REGEX);
        return {
            index,
            startLine,
            endLine,
            startOffset,
            endOffset,
            content,
            hasAnchor: !!anchorMatch,
            anchorId: anchorMatch ? anchorMatch[0] : undefined,
            headingLevel,
            headingText
        };
    }
    /**
     * 创建手动标记段落对象
     */
    createManualBlockParagraph(index, startLine, endLine, startOffset, endOffset, lines) {
        const content = lines.join('\n');
        const anchorMatch = content.match(ANCHOR_REGEX);
        return {
            index,
            startLine,
            endLine,
            startOffset,
            endOffset,
            content,
            hasAnchor: !!anchorMatch,
            anchorId: anchorMatch ? anchorMatch[0] : undefined,
            isManualBlock: true
        };
    }
    /**
     * 创建组合模式段落对象
     */
    createCombinedParagraph(index, startLine, endLine, startOffset, endOffset, lines, headingLevel, headingText, isManualBlock) {
        const content = lines.join('\n');
        const anchorMatch = content.match(ANCHOR_REGEX);
        return {
            index,
            startLine,
            endLine,
            startOffset,
            endOffset,
            content,
            hasAnchor: !!anchorMatch,
            anchorId: anchorMatch ? anchorMatch[0] : undefined,
            headingLevel,
            headingText,
            isManualBlock
        };
    }
    /**
     * 创建段落对象
     */
    createParagraph(index, startLine, endLine, startOffset, endOffset, lines) {
        const content = lines.join('\n');
        const anchorMatch = content.match(ANCHOR_REGEX);
        return {
            index,
            startLine,
            endLine,
            startOffset,
            endOffset,
            content,
            hasAnchor: !!anchorMatch,
            anchorId: anchorMatch ? anchorMatch[0] : undefined
        };
    }
    /**
     * 根据字符位置获取段落索引
     *
     * @param paragraphs 段落数组
     * @param position 字符位置
     * @returns 段落索引，如果找不到返回 0
     */
    getParagraphAtPosition(paragraphs, position) {
        for (const p of paragraphs) {
            if (position >= p.startOffset && position <= p.endOffset) {
                return p.index;
            }
        }
        return 0; // 默认返回第一段
    }
    /**
     * 根据行号获取段落索引
     *
     * @param paragraphs 段落数组
     * @param lineNumber 行号 (0-based)
     * @returns 段落索引，如果找不到返回 0
     */
    getParagraphAtLine(paragraphs, lineNumber) {
        for (const p of paragraphs) {
            if (lineNumber >= p.startLine && lineNumber <= p.endLine) {
                return p.index;
            }
        }
        return 0;
    }
    /**
     * 根据锚点 ID 获取段落索引
     *
     * @param paragraphs 段落数组
     * @param anchorId 锚点 ID
     * @returns 段落索引，如果找不到返回 0
     */
    getAnchorParagraph(paragraphs, anchorId) {
        const paragraph = paragraphs.find(p => p.anchorId === anchorId);
        return paragraph ? paragraph.index : 0;
    }
    /**
     * 获取包含锚点的所有段落
     *
     * @param paragraphs 段落数组
     * @returns 包含锚点的段落数组
     */
    getParagraphsWithAnchors(paragraphs) {
        return paragraphs.filter(p => p.hasAnchor);
    }
    /**
     * 计算段落的字数
     *
     * @param paragraph 段落
     * @returns 字数（中文按字符计算，英文按单词计算）
     */
    calculateWordCount(paragraph) {
        const content = paragraph.content;
        // 中文字符数
        const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
        // 英文单词数（移除中文后按空格分割）
        const englishText = content.replace(/[\u4e00-\u9fa5]/g, ' ');
        const englishWords = englishText.split(/\s+/).filter(w => w.length > 0).length;
        return chineseChars + englishWords;
    }
    /**
     * 计算到指定段落的累计字数
     *
     * @param paragraphs 段落数组
     * @param paragraphIndex 段落索引
     * @returns 累计字数
     */
    calculateCumulativeWordCount(paragraphs, paragraphIndex) {
        let totalWords = 0;
        for (let i = 0; i <= paragraphIndex && i < paragraphs.length; i++) {
            totalWords += this.calculateWordCount(paragraphs[i]);
        }
        return totalWords;
    }
    /**
     * 计算文档总字数
     *
     * @param paragraphs 段落数组
     * @returns 总字数
     */
    calculateTotalWordCount(paragraphs) {
        return paragraphs.reduce((total, p) => total + this.calculateWordCount(p), 0);
    }
}
