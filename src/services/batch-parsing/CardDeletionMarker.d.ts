/**
 * 卡片删除标记器
 *
 * 功能：
 * 1. 在源文档中标记已删除的卡片
 * 2. 防止重新解析时重复创建
 * 3. 提供删除标记的检测和跳过逻辑
 *
 * 标记格式：
 * ```
 * <->
 * <!-- 已删除卡片 - 请勿重新解析 -->
 * <!-- deleted-card: tk-xxxxxxxxxxxx -->
 * 原卡片内容...
 * <->
 * ```
 */
import { TFile, Vault } from 'obsidian';
/**
 * 删除标记配置
 */
export interface DeletionMarkerConfig {
    /** 是否启用删除标记 */
    enabled: boolean;
    /** 标记格式 */
    format: 'comment' | 'tag';
    /** 是否保留原卡片内容 */
    keepOriginalContent: boolean;
}
/**
 * 删除标记结果
 */
export interface DeletionMarkResult {
    success: boolean;
    markedAt: number;
    updatedContent: string;
    error?: string;
}
/**
 * 删除检测结果
 */
export interface DeletionDetectionResult {
    isDeleted: boolean;
    uuid?: string;
    lineNumber?: number;
}
/**
 * 卡片删除标记器
 */
export declare class CardDeletionMarker {
    private config;
    private vault;
    private readonly DELETION_MARKER_COMMENT;
    private readonly DELETION_UUID_PREFIX;
    private readonly DELETION_UUID_SUFFIX;
    private readonly DELETION_TAG;
    constructor(config: DeletionMarkerConfig, vault: Vault);
    /**
     * 在文档中标记已删除的卡片
     *
     * @param file - 源文件
     * @param cardStartIndex - 卡片起始位置
     * @param cardEndIndex - 卡片结束位置
     * @param uuid - 卡片UUID
     * @returns 标记结果
     */
    markCardAsDeleted(file: TFile, cardStartIndex: number, cardEndIndex: number, uuid: string): Promise<DeletionMarkResult>;
    /**
     * 检测内容中是否包含删除标记
     *
     * @param content - 卡片内容
     * @returns 检测结果
     */
    detectDeletionMarker(content: string): DeletionDetectionResult;
    /**
     * 批量检测内容中的删除标记
     *
     * @param content - 完整文档内容
     * @param cardDelimiter - 卡片分隔符
     * @returns 删除卡片的索引列表
     */
    detectDeletedCardsInBatch(content: string, cardDelimiter?: string): number[];
    /**
     * 生成删除标记
     */
    private generateDeletionMarker;
    /**
     * 插入标记并保留原内容
     */
    private insertMarkerKeepContent;
    /**
     * 插入标记并替换内容
     */
    private insertMarkerReplaceContent;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<DeletionMarkerConfig>): void;
}
/**
 * 默认删除标记配置
 */
export declare const DEFAULT_DELETION_MARKER_CONFIG: DeletionMarkerConfig;
