/**
 * 遮罩数据解析器
 *
 * 功能：
 * - 解析 HTML 注释中的遮罩数据
 * - 序列化遮罩数据为 HTML 注释
 * - 查找图片对应的遮罩注释
 * - 解析图片路径（支持 Wiki 链接和 Markdown 链接）
 *
 * @author Weave Team
 * @date 2025-10-22
 */
import type { App, TFile } from 'obsidian';
import type { MaskData, ParseResult, CommentLocation, Mask } from '../../types/image-mask-types';
export declare class MaskDataParser {
    private app;
    constructor(app: App);
    /**
     * 解析 HTML 注释为遮罩数据
     *
     * @param comment HTML 注释内容（完整格式）
     * @returns 解析结果
     */
    parseCommentToMaskData(comment: string): ParseResult;
    /**
     * 序列化遮罩数据为 HTML 注释
     *
     * @param maskData 遮罩数据
     * @returns HTML 注释字符串
     */
    maskDataToComment(maskData: MaskData): string;
    /**
     * 在内容中查找图片对应的遮罩注释
     *
     * @param content Markdown 内容
     * @param imageLineIndex 图片所在行索引（从0开始）
     * @returns 注释位置信息
     */
    findMaskCommentForImage(content: string, imageLineIndex: number): CommentLocation;
    /**
     * 解析图片路径为 TFile
     * 支持 Wiki 链接 ![[filename]] 和 Markdown 链接 ![](path)
     *
     * @param imageLink 图片链接字符串
     * @param sourceFilePath 源文件路径（用于相对路径解析）
     * @returns TFile 对象或 null
     */
    resolveImagePath(imageLink: string, sourceFilePath: string): TFile | null;
    /**
     * 检测文本行中是否包含图片链接
     *
     * @param line 文本行
     * @returns 是否包含图片链接
     */
    hasImageLink(line: string): boolean;
    /**
     * 提取文本行中的图片链接
     *
     * @param line 文本行
     * @returns 图片链接字符串或 null
     */
    extractImageLink(line: string): string | null;
    /**
     * 从注释中提取 JSON 内容
     */
    private extractJSONFromComment;
    /**
     * 验证遮罩数据结构
     */
    private validateMaskData;
    /**
     * 验证单个遮罩数据
     */
    private validateMask;
    /**
     * 检查是否为遮罩注释
     */
    private isMaskComment;
    /**
     * 从图片链接中提取文件名/路径
     */
    private extractImageFilename;
    private sanitizeEmbedTarget;
    private isSupportedImageFilePath;
}
/**
 * 生成唯一遮罩 ID
 */
export declare function generateMaskId(): string;
/**
 * 创建默认遮罩数据结构
 */
export declare function createDefaultMaskData(): MaskData;
/**
 * 创建默认矩形遮罩
 */
export declare function createDefaultRectMask(): Mask;
/**
 * 创建默认圆形遮罩
 */
export declare function createDefaultCircleMask(): Mask;
