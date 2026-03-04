/**
 * Frontmatter 管理器
 * 职责：读取和写入 Markdown 文件的 frontmatter（YAML 元数据块）
 *
 * 功能：
 * 1. 解析 frontmatter
 * 2. 更新 frontmatter 中的字段
 * 3. 生成/写入 frontmatter
 * 4. 保持其他 frontmatter 字段不变
 *
 * @author Weave Team
 * @date 2025-11-03
 */
import { TFile, App } from 'obsidian';
/**
 * Frontmatter 数据类型
 */
export interface FrontmatterData {
    [key: string]: any;
}
/**
 * UUID 字段名称（Weave 专用）
 */
export declare const WEAVE_UUID_FIELD = "weave-uuid";
/**
 * Frontmatter 管理器
 */
export declare class FrontmatterManager {
    private app;
    constructor(app: App);
    /**
     * 解析文件的 frontmatter
     * @param file Obsidian 文件对象
     * @returns frontmatter 数据对象，如果不存在返回空对象
     */
    parseFrontmatter(file: TFile): Promise<FrontmatterData>;
    /**
     * 从内容字符串中解析 frontmatter
     * @param content Markdown 文件内容
     * @returns frontmatter 数据对象
     */
    parseFrontmatterFromContent(content: string): FrontmatterData;
    /**
     * 简单的 YAML 解析（仅支持基本键值对）
     * 改进：更好地处理带引号的值和特殊字符
     * @param yaml YAML 字符串
     * @returns 解析后的对象
     */
    private parseYAML;
    /**
     * 将对象转换为 YAML 字符串
     * @param data 数据对象
     * @returns YAML 字符串
     */
    private stringifyYAML;
    /**
     * 更新文件的 frontmatter
     * @param file Obsidian 文件对象
     * @param updates 要更新的字段
     */
    updateFrontmatter(file: TFile, updates: Partial<FrontmatterData>): Promise<void>;
    /**
     * 在内容字符串中更新 frontmatter
     * @param content 原始内容
     * @param updates 要更新的字段
     * @returns 更新后的内容
     */
    updateFrontmatterInContent(content: string, updates: Partial<FrontmatterData>): string;
    /**
     * 获取文件的 UUID（从 frontmatter）
     * @param file Obsidian 文件对象
     * @returns UUID 字符串，如果不存在返回 null
     */
    getUUID(file: TFile): Promise<string | null>;
    /**
     * 设置文件的 UUID（写入 frontmatter）
     * @param file Obsidian 文件对象
     * @param uuid UUID 字符串
     */
    setUUID(file: TFile, uuid: string): Promise<void>;
    /**
     * 批量更新多个字段
     * @param file Obsidian 文件对象
     * @param fields 字段映射
     */
    batchUpdate(file: TFile, fields: Record<string, any>): Promise<void>;
    /**
     * 移除 frontmatter 中的某个字段
     * @param file Obsidian 文件对象
     * @param key 字段名
     */
    removeField(file: TFile, key: string): Promise<void>;
    /**
     * 检查文件是否有 frontmatter
     * @param file Obsidian 文件对象
     * @returns 是否有 frontmatter
     */
    hasFrontmatter(file: TFile): Promise<boolean>;
    /**
     * 从内容中提取正文（去除 frontmatter）
     * @param content 完整内容
     * @returns 正文内容
     */
    extractBodyContent(content: string): string;
    /**
     * 合并 frontmatter 和正文
     * @param frontmatter frontmatter 数据
     * @param body 正文内容
     * @returns 完整内容
     */
    combineContent(frontmatter: FrontmatterData, body: string): string;
}
