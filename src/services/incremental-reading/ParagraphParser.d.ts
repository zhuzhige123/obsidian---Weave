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
/**
 * 分割模式类型
 */
export type SplitMode = 'paragraph' | 'heading' | 'manual' | 'combined';
/**
 * 标题级别配置
 *
 * 简化设计：只需要一个 splitLevel 参数
 * - 选择 H2：按二级标题分割，每个二级标题到下一个二级标题之间为一个块
 * - 选择 H3：按三级标题分割，每个三级标题到下一个三级标题之间为一个块
 *
 * 旧版配置（minLevel/maxLevel）仍然支持，但推荐使用 splitLevel
 */
export interface HeadingConfig {
    /**
     * 分割标题级别 (1-6)
     * 按此级别的标题分割文档，每个该级别标题到下一个同级标题之间为一个块
     * 例如：splitLevel=2 表示按 ## 二级标题分割
     */
    splitLevel: number;
    /** 是否包含标题行本身 */
    includeHeadingLine: boolean;
    /** @deprecated 使用 splitLevel 替代 */
    minLevel?: number;
    /** @deprecated 使用 splitLevel 替代 */
    maxLevel?: number;
}
/**
 * 手动标记配置
 */
export interface ManualMarkerConfig {
    /** 开始标记 */
    startMarker: string;
    /** 结束标记 */
    endMarker: string;
}
/**
 * 解析器配置
 */
export interface ParserConfig {
    /** 分割模式 */
    mode: SplitMode;
    /** 标题配置（heading/combined 模式使用） */
    headingConfig?: HeadingConfig;
    /** 手动标记配置（manual/combined 模式使用） */
    manualMarkerConfig?: ManualMarkerConfig;
}
/**
 * 默认解析器配置
 */
export declare const DEFAULT_PARSER_CONFIG: ParserConfig;
/**
 * 段落数据结构
 */
export interface Paragraph {
    /** 段落索引 (0-based) */
    index: number;
    /** 起始行号 (0-based) */
    startLine: number;
    /** 结束行号 (0-based) */
    endLine: number;
    /** 起始字符偏移 */
    startOffset: number;
    /** 结束字符偏移 */
    endOffset: number;
    /** 段落内容 */
    content: string;
    /** 是否包含锚点 */
    hasAnchor: boolean;
    /** 锚点 ID（如果有） */
    anchorId?: string;
    /** 标题级别（heading 模式下有效） */
    headingLevel?: number;
    /** 标题文本（heading 模式下有效） */
    headingText?: string;
    /** 是否为手动标记区块 */
    isManualBlock?: boolean;
}
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
export declare class ParagraphParser {
    private config;
    constructor(config?: Partial<ParserConfig>);
    /**
     * 更新解析器配置
     */
    updateConfig(config: Partial<ParserConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): ParserConfig;
    /**
     * 将文档内容解析为段落块
     * 根据配置的模式选择不同的解析策略
     *
     * @param content 文档内容
     * @returns 段落数组
     */
    parseDocument(content: string): Paragraph[];
    /**
     * 按空行分割文档（原有逻辑）
     */
    private parseByParagraph;
    /**
     * 按 Markdown 标题分割文档
     *
     * 简化逻辑：只按指定级别的标题分割
     * 例如 splitLevel=2 时，每个 ## 标题到下一个 ## 标题之间为一个块
     * 更低级别的标题（如 ###）不会触发分割，而是包含在当前块内
     */
    private parseByHeading;
    /**
     * 按手动标记分割文档
     * 使用 <!-- focus-start --> 和 <!-- focus-end --> 标记
     */
    private parseByManualMarkers;
    /**
     * 组合模式：标题 + 手动标记
     * 优先使用手动标记，其次按指定级别的标题分割
     */
    private parseCombined;
    /**
     * 创建标题段落对象
     */
    private createHeadingParagraph;
    /**
     * 创建手动标记段落对象
     */
    private createManualBlockParagraph;
    /**
     * 创建组合模式段落对象
     */
    private createCombinedParagraph;
    /**
     * 创建段落对象
     */
    private createParagraph;
    /**
     * 根据字符位置获取段落索引
     *
     * @param paragraphs 段落数组
     * @param position 字符位置
     * @returns 段落索引，如果找不到返回 0
     */
    getParagraphAtPosition(paragraphs: Paragraph[], position: number): number;
    /**
     * 根据行号获取段落索引
     *
     * @param paragraphs 段落数组
     * @param lineNumber 行号 (0-based)
     * @returns 段落索引，如果找不到返回 0
     */
    getParagraphAtLine(paragraphs: Paragraph[], lineNumber: number): number;
    /**
     * 根据锚点 ID 获取段落索引
     *
     * @param paragraphs 段落数组
     * @param anchorId 锚点 ID
     * @returns 段落索引，如果找不到返回 0
     */
    getAnchorParagraph(paragraphs: Paragraph[], anchorId: string): number;
    /**
     * 获取包含锚点的所有段落
     *
     * @param paragraphs 段落数组
     * @returns 包含锚点的段落数组
     */
    getParagraphsWithAnchors(paragraphs: Paragraph[]): Paragraph[];
    /**
     * 计算段落的字数
     *
     * @param paragraph 段落
     * @returns 字数（中文按字符计算，英文按单词计算）
     */
    calculateWordCount(paragraph: Paragraph): number;
    /**
     * 计算到指定段落的累计字数
     *
     * @param paragraphs 段落数组
     * @param paragraphIndex 段落索引
     * @returns 累计字数
     */
    calculateCumulativeWordCount(paragraphs: Paragraph[], paragraphIndex: number): number;
    /**
     * 计算文档总字数
     *
     * @param paragraphs 段落数组
     * @returns 总字数
     */
    calculateTotalWordCount(paragraphs: Paragraph[]): number;
}
