/**
 * 单文件单卡片解析器
 * 职责：解析"一个 MD 文件 = 一张卡片"的场景
 *
 * 功能：
 * 1. 读取文件内容
 * 2. 从 frontmatter 提取 UUID
 * 3. 根据配置解析正反面（split 或 whole-file）
 * 4. 生成 ParsedCard 对象
 *
 * @author Weave Team
 * @date 2025-11-03
 */
import { TFile, App } from 'obsidian';
import type { ParsedCard } from '../../types/newCardParsingTypes';
import type { SingleCardConfig } from '../../types/newCardParsingTypes';
/**
 * 单文件单卡片解析结果
 */
export interface SingleCardParseResult {
    success: boolean;
    card?: ParsedCard;
    error?: string;
    shouldSkip?: boolean;
    skipReason?: string;
}
/**
 * 单文件单卡片解析器
 */
export declare class SingleCardParser {
    private app;
    private frontmatterManager;
    constructor(app: App);
    /**
     * 解析单个文件为卡片
     * @param file Obsidian 文件对象
     * @param config 单文件单卡片配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果
     */
    parseFile(file: TFile, config: SingleCardConfig, targetDeckId: string): Promise<SingleCardParseResult>;
    /**
     * 分离正反面内容
     * @param content 正文内容
     * @param separator 分隔符
     * @returns 正反面对象
     */
    private splitFrontBack;
    /**
     * 提取标签（从 frontmatter 和正文）
     * @param frontmatter frontmatter 数据
     * @param content 完整内容
     * @returns 标签数组
     */
    private extractTags;
    /**
     * 根据标签判断是否跳过
     * @param cardTags 卡片标签（已标准化，不含 # 前缀）
     * @param excludeTags 排除标签
     * @returns 是否跳过
     */
    private shouldSkipByTags;
    /**
     * 批量解析多个文件
     * @param files 文件数组
     * @param config 单文件单卡片配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果数组
     */
    parseFiles(files: TFile[], config: SingleCardConfig, targetDeckId: string): Promise<SingleCardParseResult[]>;
    /**
     * 获取文件的 UUID（如果存在）
     * @param file Obsidian 文件对象
     * @returns UUID 或 null
     */
    getFileUUID(file: TFile): Promise<string | null>;
    /**
     * 更新文件的 UUID
     * @param file Obsidian 文件对象
     * @param uuid UUID 字符串
     */
    setFileUUID(file: TFile, uuid: string): Promise<void>;
}
