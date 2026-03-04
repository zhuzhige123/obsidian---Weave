/**
 * 增量阅读文件化块生成服务
 *
 * 负责将导入的阅读材料拆分为独立的 MD 文件：
 * - 源文件副本（IR/raw/）：只读权威输入
 * - 索引文件（IR/sources/）：文章级容器，包含块清单
 * - 块文件（IR/chunks/）：每个内容块一个文件，带 YAML frontmatter
 *
 * @module services/incremental-reading/IRChunkFileService
 * @version 5.0.0 - 文件化内容块方案
 */
import { App, TFile } from 'obsidian';
import type { ContentBlock, RuleSplitConfig } from '../../types/content-split-types';
import { type IRSourceFileMeta, type IRChunkFileYAML, type IRChunkFileData } from '../../types/ir-types';
/**
 * 文件化块导入选项
 */
export interface ChunkFileImportOptions {
    /** 拆分配置 */
    splitConfig: RuleSplitConfig;
    /** 标签组 */
    tagGroup?: string;
    /** 初始优先级 */
    initialPriority?: number;
    /** v5.4: 牌组标签 - 格式 #IR_deck_牌组名 */
    deckTag?: string;
    /** v6.1: 多牌组支持 - 牌组名称数组 */
    deckNames?: string[];
}
/**
 * 文件化块导入结果
 */
export interface ChunkFileImportResult {
    /** 源文件元数据 */
    sourceMeta: IRSourceFileMeta;
    /** 生成的块文件数据列表 */
    chunkDataList: IRChunkFileData[];
    /** 索引文件路径 */
    indexFilePath: string;
    /** 块文件路径列表 */
    chunkFilePaths: string[];
}
export declare class IRChunkFileService {
    private app;
    private initialized;
    private chunkRoot;
    constructor(app: App, chunkRoot?: string);
    private getUniqueFolderPath;
    /**
     * 初始化目录结构
     */
    ensureDirectories(): Promise<void>;
    /**
     * 导入文件并生成文件化块
     *
     * @param sourceFile 源文件
     * @param options 导入选项
     * @returns 导入结果
     */
    importFileAsChunks(sourceFile: TFile, options: ChunkFileImportOptions & {
        bookFolderName?: string;
    }): Promise<ChunkFileImportResult>;
    importFileAsChunksFromBlocks(sourceFile: TFile, contentBlocks: ContentBlock[], options: ChunkFileImportOptions & {
        bookFolderName?: string;
    }): Promise<ChunkFileImportResult>;
    /**
     * 复制源文件到 IR/raw/
     */
    private copyToRaw;
    /**
     * 确保文件夹存在
     */
    private ensureFolder;
    /**
     * 创建块文件（v5.1: 支持自定义文件夹和索引回链）
     * v5.4: 添加 deckTag 参数用于牌组标签
     */
    private createChunkFile;
    /**
     * 创建索引文件（v5.1: 在文章文件夹内创建）
     */
    private createIndexFileInFolder;
    /**
     * 从块文件读取 YAML 元数据
     */
    readChunkFileYAML(filePath: string): Promise<IRChunkFileYAML | null>;
    /**
     * 更新块文件 YAML 中的指定字段
     */
    updateChunkFileYAML(filePath: string, updates: Partial<IRChunkFileYAML>): Promise<boolean>;
    /**
     * 将块状态标记为完成
     */
    markChunkAsDone(filePath: string): Promise<boolean>;
    /**
     * 解析 YAML 值
     */
    private parseYAMLValue;
    /**
     * 检查块文件是否处于完成状态
     */
    isChunkDone(filePath: string): Promise<boolean>;
    /**
     * 获取所有活跃状态的块文件路径
     */
    getActiveChunkFiles(): Promise<string[]>;
    /**
     * 总索引文件路径
     */
    private get masterIndexPath();
    private getDeckIndexPath;
    private normalizeDeckNameForTag;
    ensureDeckIndexCard(deckName: string): Promise<string>;
    renameDeckIndexCard(oldName: string, newName: string): Promise<string>;
    private ensureDeckInMasterIndex;
    /**
     * 更新总索引文件
     * v5.3: 导入新书时自动追加到总索引
     *
     * @param bookTitle 书籍标题
     * @param bookIndexPath 书籍索引文件路径
     * @param chapterEntries 章节条目列表 [{title, indexPath, chunkEntries}]
     * @param category 分类名称（可选，默认"未分类"）
     */
    updateMasterIndex(bookTitle: string, bookIndexPath: string, chapterEntries: Array<{
        title: string;
        indexPath: string;
        chunkEntries: Array<{
            title: string;
            filePath: string;
        }>;
    }>, category?: string): Promise<void>;
    /**
     * 构建书籍条目（含层级结构）
     */
    private buildBookEntry;
    /**
     * 创建分类文件（可选）
     */
    ensureCategoryFile(category: string): Promise<string>;
}
