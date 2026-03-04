/**
 * 增量阅读内容拆分服务
 *
 * @deprecated v5.0 文件化块方案已弃用此服务的大部分功能
 * 新方案使用 IRChunkFileService 生成独立的块文件
 * 此服务仅用于兼容旧数据，新代码应使用 IRChunkFileService
 *
 * 旧功能（废弃）：
 * - 按标题级别拆分 (heading 模式) → 使用 splitByRules + IRChunkFileService
 * - 按段落拆分 (paragraph 模式) → 同上
 * - 手动标记拆分 (manual 模式) → 同上
 * - injectInitialMarkers() → 废弃，不再在原文件中插入标记
 *
 * v2.0 变更:
 * - UUID注释格式: <!-- weave-ir: uuid -->
 * - 移除block-end标记
 * - 支持headingPath
 *
 * @module services/incremental-reading/IRContentSplitter
 * @version 2.0.0 - 引入式架构（v5.0 已废弃）
 */
import { App, TFile } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import type { IRBlock, IRDeckSettings } from '../../types/ir-types';
/** 拆分后的内容块（未持久化） */
export interface SplitResult {
    headingText: string;
    headingPath: string[];
    headingLevel: number;
    content: string;
    startLine: number;
    endLine: number;
}
export declare class IRContentSplitter {
    private app;
    private storage;
    constructor(app: App, storage: IRStorageService);
    /**
     * 拆分文件并创建内容块
     */
    splitFile(file: TFile, deckPath: string, settings: IRDeckSettings): Promise<IRBlock[]>;
    /**
     * 按标题级别拆分 (v2.3: 跳过 YAML frontmatter)
     */
    private splitByHeading;
    /**
     * 构建标题层级路径 (v2.0 新增)
     */
    private buildHeadingPath;
    /**
     * 按段落拆分 (v2.3: 跳过 YAML frontmatter)
     */
    private splitByParagraph;
    /**
     * 按手动标记拆分 (v2.3: 跳过 YAML frontmatter)
     * 两个 ---IR--- 之间的内容为一个内容块
     */
    private splitByManualMarkers;
    /**
     * v2.3: 按双空行拆分（跳过 YAML frontmatter）
     * 连续两个或以上空行作为分隔符
     */
    private splitByBlankLines;
    /**
     * v2.3: 按自定义分隔符拆分（跳过 YAML frontmatter）
     */
    private splitByCustomMarker;
    /**
     * v2.3: 检测 YAML frontmatter 结束位置
     * @returns YAML 结束后的第一行索引，如果没有 YAML 则返回 0
     */
    private findYamlEndIndex;
    /**
     * 从内容行中提取标题
     */
    private extractBlockTitleFromLines;
    /**
     * 提取文件中已存在的块ID (v2.0: 支持两种格式)
     */
    private extractExistingBlockIds;
    /**
     * 查找指定行附近的块ID (v2.0: 支持两种格式)
     */
    private findBlockIdAtPosition;
    /**
     * v2.3: 首次导入时写入拆分标记
     *
     * UUID 标记写在内容块末尾，表示“前面的内容为一个完整的学习块”
     *
     * 正确格式示例:
     * ```
     * ---
     * yaml content
     * ---
     *
     * <!-- weave-ir-start -->
     * # 标题1
     * 内容1...
     * <!-- weave-ir: ir-xxx -->
     * # 标题2
     * 内容2...
     * <!-- weave-ir: ir-yyy -->
     * ```
     */
    injectInitialMarkers(file: TFile, blocks: IRBlock[], settings: IRDeckSettings): Promise<void>;
    /**
     * v2.2: 按 UUID 标记解析内容块（用于文件变化后重新同步）
     * UUID 标记在内容块末尾，标记之前的内容属于该块
     */
    splitByUuidMarkers(lines: string[], startLineOffset?: number): SplitResult[];
    /**
     * 提取内容块标题（第一个标题行或第一行非空内容）
     */
    private extractBlockTitle;
    /**
     * 向文件注入块ID标记 (v2.2: UUID添加到内容块末尾)
     * UUID 标记表示前面的内容为一个完整的学习块
     */
    injectBlockMarkers(file: TFile, blocks: IRBlock[]): Promise<void>;
    /**
     * 从文件移除块ID标记 (v2.0: 支持两种格式)
     */
    removeBlockMarkers(file: TFile): Promise<void>;
    /**
     * 获取内容块的实际内容
     */
    getBlockContent(block: IRBlock): Promise<string>;
    /**
     * 转义正则表达式特殊字符
     */
    private escapeRegex;
}
