/**
 * 锚点管理服务
 *
 * 负责锚点的插入、解析和追踪
 * 锚点格式：^weave-bookmark-{timestamp}
 *
 * @module services/incremental-reading/AnchorManager
 * @version 1.0.0
 */
import type { App, Editor, TFile, MarkdownView } from 'obsidian';
import type { ReadingProgress, ReadingMaterial } from '../../types/incremental-reading-types';
import type { ReadingMaterialStorage } from './ReadingMaterialStorage';
import type { YAMLFrontmatterManager } from '../../utils/yaml-frontmatter-utils';
/**
 * 锚点解析结果
 */
export interface AnchorParseResult {
    /** 锚点ID */
    anchorId: string;
    /** 时间戳 */
    timestamp: number;
    /** 在文件中的字符位置 */
    position: number;
    /** 行号 */
    lineNumber: number;
}
/**
 * 锚点插入结果
 */
export interface AnchorInsertResult {
    /** 是否成功 */
    success: boolean;
    /** 锚点ID */
    anchorId?: string;
    /** 错误信息 */
    error?: string;
    /** 是否创建了新的阅读材料 */
    materialCreated?: boolean;
}
/**
 * 锚点管理器
 */
export declare class AnchorManager {
    private app;
    private storage;
    private yamlManager;
    constructor(app: App, storage: ReadingMaterialStorage, yamlManager: YAMLFrontmatterManager);
    private isIRFile;
    /**
     * 生成唯一的锚点ID
     */
    generateAnchorId(): string;
    /**
     * 在当前光标位置插入锚点
     * @param editor 编辑器实例
     * @param view Markdown视图
     * @returns 插入结果
     */
    insertAnchorAtCursor(editor: Editor, view: MarkdownView): Promise<AnchorInsertResult>;
    /**
     * 为文件创建阅读材料
     */
    private createMaterialForFile;
    /**
     * 更新材料的锚点信息
     */
    private updateMaterialAnchor;
    /**
     * 从文件内容中解析所有锚点
     * @param content 文件内容
     * @returns 锚点列表
     */
    parseAnchorsFromContent(content: string): AnchorParseResult[];
    /**
     * 从文件中解析锚点
     * @param file 目标文件
     * @returns 锚点列表
     */
    parseAnchorsFromFile(file: TFile): Promise<AnchorParseResult[]>;
    /**
     * 获取文件中最新的锚点
     * @param file 目标文件
     * @returns 最新锚点，如果没有则返回null
     */
    getLatestAnchor(file: TFile): Promise<AnchorParseResult | null>;
    /**
     * 跳转到锚点位置并高亮显示
     * @param file 目标文件
     * @param anchorId 锚点ID
     */
    jumpToAnchor(file: TFile, anchorId: string): Promise<boolean>;
    /**
     * 高亮锚点所在行（闪烁效果）
     * @param editor 编辑器实例
     * @param lineNumber 行号
     */
    private highlightAnchorLine;
    /**
     * 删除锚点
     * @param file 目标文件
     * @param anchorId 锚点ID
     */
    removeAnchor(file: TFile, anchorId: string): Promise<boolean>;
    /**
     * 计算阅读进度
     * @param file 目标文件
     * @param material 阅读材料
     * @returns 更新后的进度
     */
    calculateProgress(file: TFile, material: ReadingMaterial): Promise<ReadingProgress>;
    /**
     * 查找锚点在内容中的位置
     */
    private findAnchorPosition;
}
/**
 * 创建锚点管理器实例
 */
export declare function createAnchorManager(app: App, storage: ReadingMaterialStorage, yamlManager: YAMLFrontmatterManager): AnchorManager;
