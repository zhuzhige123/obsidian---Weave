/**
 * 正则表达式卡片解析器
 * 职责：使用自定义正则表达式解析"单文件多卡片"的场景
 *
 * 功能：
 * 1. 支持分隔符模式（简单易用）
 * 2. 支持完整模式（灵活强大）
 * 3. 支持内联 UUID 或 frontmatter UUID
 * 4. 标签提取和排除标签判断
 *
 * @author Weave Team
 * @date 2025-11-03
 */
import { TFile, App } from 'obsidian';
import type { ParsedCard, RegexParsingConfig } from '../../types/newCardParsingTypes';
import type { CardWithPosition } from '../../utils/simplifiedParser/CardPositionTracker';
/**
 * 正则解析结果
 */
export interface RegexParseResult {
    success: boolean;
    cards: ParsedCard[];
    errors: string[];
    skippedCount: number;
    positions?: CardWithPosition[];
    originalContent?: string;
}
/**
 * 正则表达式卡片解析器
 */
export declare class RegexCardParser {
    private app;
    private frontmatterManager;
    private plugin;
    constructor(app: App, plugin?: any);
    /**
     * 解析文件（主入口）
     * @param file Obsidian 文件对象
     * @param config 正则解析配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果
     */
    parseFile(file: TFile, config: RegexParsingConfig, targetDeckId: string): Promise<RegexParseResult>;
    /**
     * 分隔符模式解析
     * @param content 文件内容
     * @param config 配置
     * @returns 卡片匹配结果数组
     */
    private parseBySeparator;
    /**
     * 🆕 正则模式解析（简化版 - 一步到位）
     * 直接使用正则表达式在全文中匹配所有卡片，不需要先划分范围
     * @param content 文件内容
     * @param config 配置
     * @returns 卡片匹配结果数组
     */
    private parseByPattern;
    /**
     * 解析单个卡片块
     * @param block 卡片块内容
     * @param frontBackSeparator 正反面分隔符
     * @param config 配置
     * @returns 卡片匹配结果
     */
    private parseCardBlock;
    /**
     * 从字符串中提取标签
     * @param text 文本内容
     * @returns 标签数组
     */
    private extractTagsFromString;
    /**
     * 提取内联 UUID
     * @param text 文本内容
     * @param uuidPattern UUID 匹配正则
     * @returns UUID 或 undefined
     */
    private extractInlineUUID;
    /**
     * 根据标签判断是否跳过
     * @param cardTags 卡片标签（不包括#前缀）
     * @param excludeTags 排除标签（可能包括#前缀）
     * @returns 是否跳过
     */
    private shouldSkipByTags;
    /**
     * 批量解析多个文件
     * @param files 文件数组
     * @param config 正则解析配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果数组
     */
    parseFiles(files: TFile[], config: RegexParsingConfig, targetDeckId: string): Promise<RegexParseResult[]>;
    /**
     * 清理卡片内容，移除UUID标识符和块链接
     * @param content 原始卡片内容
     * @returns 清理后的内容
     */
    private cleanCardContent;
}
