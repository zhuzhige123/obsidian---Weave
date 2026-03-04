/**
 * UUID管理器（ 重构版）
 * 核心创新：UUID去重机制，防止重复导入
 *
 * 功能：
 * 1. 生成唯一UUID（集成新格式：tk-{12位}）
 * 2. 在源文件中插入UUID和BlockID
 * 3. 检测已存在的UUID（兼容新旧格式）
 * 4. 管理UUID与卡片的映射关系
 *
 * 🆕 v0.8: 集成统一标识符系统
 * - 使用WeaveIDGenerator生成新格式UUID
 * - 支持生成和管理BlockID
 * - 向后兼容旧UUID格式
 */
import { TFile, Vault } from 'obsidian';
/**
 * UUID配置
 */
export interface UUIDConfig {
    /** 是否启用UUID去重 */
    enabled: boolean;
    /** UUID插入位置 */
    insertPosition: 'before-card' | 'after-card' | 'in-metadata';
    /** UUID格式 */
    format: 'comment' | 'frontmatter' | 'inline-code';
    /** UUID前缀（用于识别） */
    prefix: string;
    /** 重复处理策略 */
    duplicateStrategy: 'skip' | 'update' | 'create-new';
    /** 是否自动修复缺失的UUID */
    autoFixMissing: boolean;
}
/**
 * UUID记录
 */
export interface UUIDRecord {
    uuid: string;
    cardId: string;
    sourceFile: string;
    lineNumber: number;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * UUID插入结果
 */
export interface UUIDInsertResult {
    success: boolean;
    uuid: string;
    updatedContent: string;
    insertedAt: number;
    error?: string;
}
/**
 * UUID检测结果
 */
export interface UUIDDetectionResult {
    found: boolean;
    uuid?: string;
    lineNumber?: number;
    cardId?: string;
    isDuplicate: boolean;
}
/**
 * UUID数据库接口（需要从插件注入）
 */
export interface IUUIDStorage {
    /** 保存UUID记录 */
    saveRecord(record: UUIDRecord): Promise<void>;
    /** 根据UUID获取记录 */
    getRecordByUUID(uuid: string): Promise<UUIDRecord | null>;
    /** 根据卡片ID获取记录 */
    getRecordByCardId(cardId: string): Promise<UUIDRecord | null>;
    /** 删除记录 */
    deleteRecord(uuid: string): Promise<void>;
    /** 检查UUID是否存在 */
    uuidExists(uuid: string): Promise<boolean>;
    /** 获取文件的所有UUID */
    getFileUUIDs(filePath: string): Promise<UUIDRecord[]>;
}
/**
 * UUID管理器
 */
export declare class UUIDManager {
    private config;
    private vault;
    private storage;
    private uuidPattern;
    constructor(config: UUIDConfig, vault: Vault, storage: IUUIDStorage);
    /**
     * 生成新的UUID（ 重构版）
     * 🆕 使用新格式：tk-{12位base32}
     */
    generateUUID(): string;
    /**
     * 生成BlockID（🆕 新增）
     * 格式：6位base36随机字符（不含^前缀）
     */
    generateBlockID(): string;
    /**
     * 在内容中插入BlockID
     * 格式：在指定位置插入 ` ^{blockId}` (Obsidian标准格式)
     */
    insertBlockID(content: string, insertPosition: number, blockId?: string): Promise<{
        success: boolean;
        blockId: string;
        updatedContent: string;
        error?: string;
    }>;
    /**
     * 在内容中插入UUID和BlockID（组合方法）
     * 🆕 同时插入UUID和BlockID，确保格式正确
     *
     * 格式示例（after-card）：
     * ```
     * 卡片内容...
     * <!-- tk-xxxxxxxxxxxx --> ^abc123
     * ```
     */
    insertUUIDAndBlockID(content: string, cardStartIndex: number, cardEndIndex: number, _file?: TFile): Promise<{
        success: boolean;
        uuid: string;
        blockId: string;
        updatedContent: string;
        insertedAt: number;
        error?: string;
    }>;
    /**
     * 在内容中插入UUID（保留原有方法，向后兼容）
     */
    insertUUID(content: string, cardStartIndex: number, cardEndIndex: number, _file?: TFile): Promise<UUIDInsertResult>;
    /**
     * 检测内容中的UUID
     */
    detectUUID(content: string, cardStartIndex: number, cardEndIndex: number): Promise<UUIDDetectionResult>;
    /**
     * 处理重复UUID
     */
    handleDuplicate(uuid: string, file: TFile): Promise<'skip' | 'update' | 'create-new'>;
    /**
     * 保存UUID记录
     */
    saveRecord(uuid: string, cardId: string, file: TFile, lineNumber: number): Promise<void>;
    /**
     * 批量处理文件中的UUID
     */
    processFileUUIDs(file: TFile, cards: Array<{
        content: string;
        startIndex: number;
        endIndex: number;
    }>): Promise<{
        updatedContent: string;
        uuidMap: Map<number, string>;
        duplicates: string[];
    }>;
    /**
     * 格式化UUID标记
     */
    private formatUUIDMarker;
    /**
     * 构建UUID匹配正则（ 重构版）
     * 🆕 支持新旧两种UUID格式
     */
    private buildUUIDPattern;
    /**
     * 获取内容中指定位置的行号
     */
    private getLineNumber;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<UUIDConfig>): void;
    /**
     * 🆕 检查UUID是否已存在
     * @param uuid UUID字符串
     * @returns 如果存在返回true，否则返回false
     */
    hasUUID(uuid: string): Promise<boolean>;
    /**
     * 🆕 通过UUID获取记录
     * @param uuid UUID字符串
     * @returns UUID记录，如果不存在返回null
     */
    getRecordByUUID(uuid: string): Promise<UUIDRecord | null>;
    /**
     * 🆕 增强的UUID检测（带数据库验证）
     * 三层检测机制：
     * 1. 正则匹配检测UUID
     * 2. 数据库验证UUID存在性
     * 3. 格式完整性检查
     *
     * @param block 卡片块内容
     * @returns UUID字符串，如果未检测到或验证失败返回null
     */
    detectUUIDWithValidation(block: string): Promise<string | null>;
    /**
     * 🆕 批量检查UUID存在性
     * 优化性能，避免多次单独查询
     *
     * @param uuids UUID数组
     * @returns UUID到存在性的映射
     */
    batchCheckUUIDs(uuids: string[]): Promise<Map<string, boolean>>;
    /**
     * 清理文件的UUID记录
     */
    cleanupFileRecords(file: TFile): Promise<void>;
    /**
     * 验证UUID格式（ 重构版）
     * 🆕 支持新旧两种格式
     */
    isValidUUID(uuid: string): boolean;
    /**
     * 验证BlockID格式（🆕 新增）
     */
    isValidBlockID(blockId: string): boolean;
    /**
     * 从UUID标记中提取UUID
     */
    extractUUID(marker: string): string | null;
}
