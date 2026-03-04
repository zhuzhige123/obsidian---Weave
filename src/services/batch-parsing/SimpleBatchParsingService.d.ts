/**
 * 简化批量解析服务
 * 主流程协调器：整合文件选择、牌组映射、UUID管理和卡片解析
 *
 * 职责：
 * 1. 协调各子服务的工作
 * 2. 执行批量解析主流程
 * 3. 处理解析结果
 * 4. 提供统计和报告
 *
 *  架构说明：三种解析模式
 *
 *  模式1：场景2 - 单文件单卡片模式（新）
 *    - 使用 SingleCardParser + SingleCardSyncEngine
 *    - 基于文件修改时间 (mtime) 的同步策略
 *    - UUID 存储在 frontmatter 中
 *    - 支持 front-back 分离
 *
 *  模式2：场景1 - 单文件多卡片正则模式（新）
 *    - 使用 RegexCardParser
 *    - 支持自定义正则表达式解析
 *    - 支持分隔符模式和完整模式
 *    - 支持标签判断和完全同步两种同步方式
 *
 *  模式3：兼容模式 - 旧解析器（向后兼容）
 *    - 使用 SimplifiedCardParser
 *    - 适用于未配置新模式的旧映射
 *    - 保持向后兼容性
 */
import { TFile } from 'obsidian';
import { SimpleFileSelectorService, FileSelectorConfig } from './SimpleFileSelectorService';
import { DeckMappingService, DeckMappingConfig } from './DeckMappingService';
import { UUIDManager, UUIDConfig } from './UUIDManager';
import { SimplifiedCardParser } from '../../utils/simplifiedParser/SimplifiedCardParser';
import { ParsedCard, SimplifiedParsingSettings } from '../../types/newCardParsingTypes';
import type { IObsidianApp } from '../../types/plugin-interfaces';
import type { WeaveDataStorage } from '../../data/storage';
import type { BlockLinkCleanupService } from '../cleanup/BlockLinkCleanupService';
/**
 * 文件夹牌组映射（统一配置）
 * 🆕 重构后的核心数据结构，整合了文件选择和牌组映射
 *  v2: 支持文件级别映射
 */
export interface FolderDeckMapping {
    /** 唯一ID (使用UUID) */
    id: string;
    /** 🆕 映射类型：文件夹或单个文件 */
    type?: 'folder' | 'file';
    /** 🆕 统一路径字段（文件夹路径或文件路径） */
    path?: string;
    /** @deprecated 使用 path 替代，保留用于向后兼容 */
    folderPath?: string;
    /** 目标牌组ID */
    targetDeckId: string;
    /** 目标牌组名称（冗余字段，便于显示） */
    targetDeckName: string;
    /** 是否递归包含子文件夹（仅 type='folder' 时有效） */
    includeSubfolders: boolean;
    /** 是否启用该映射 */
    enabled: boolean;
    /** 牌组命名策略 */
    namingStrategy?: 'folder-name' | 'custom' | 'path-based';
    /** 自定义牌组名称 */
    customName?: string;
    /** 牌组不存在时自动创建 */
    autoCreateDeck?: boolean;
    /** 检测到的文件数 */
    fileCount?: number;
    /** 最后扫描时间 */
    lastScanned?: string;
}
/**
 * 批量解析配置（ 重构后）
 */
export interface SimpleBatchParsingConfig {
    /** 文件夹与牌组的映射关系 */
    folderDeckMappings: FolderDeckMapping[];
    /** UUID配置 */
    uuid: UUIDConfig;
    /** 解析设置 */
    parsingSettings: SimplifiedParsingSettings;
    /** 批处理限制 */
    maxFilesPerBatch: number;
    /** 是否显示进度通知 */
    showProgressNotice: boolean;
    /** 是否在解析后自动保存文件 */
    autoSaveAfterParsing: boolean;
    /** 牌组名称前缀 */
    deckNamePrefix?: string;
    /** 路径分隔符（用于层级牌组） */
    hierarchySeparator: string;
    /** @deprecated 使用 folderDeckMappings 替代 */
    fileSelector?: FileSelectorConfig;
    /** @deprecated 使用 folderDeckMappings 替代 */
    deckMapping?: DeckMappingConfig;
}
/**
 * 解析进度信息
 */
export interface ParseProgress {
    totalFiles: number;
    processedFiles: number;
    currentFile: string;
    successCount: number;
    errorCount: number;
    percentage: number;
}
/**
 * 批量解析结果（🆕 增强版 - 支持三方合并）
 */
export interface BatchParseResult {
    success: boolean;
    totalCards: number;
    successfulCards: number;
    failedCards: Array<{
        file: string;
        card: any;
        error: string;
    }>;
    newDecks: string[];
    duplicateUUIDs: string[];
    parsedCards?: ParsedCard[];
    newCards?: number;
    updatedCards?: number;
    skippedCards?: number;
    conflictCards?: number;
    conflicts?: Array<{
        file: string;
        cardIndex: number;
        uuid: string;
        conflict: any;
    }>;
    errors: Array<{
        file: string;
        message: string;
        error?: any;
    }>;
    stats: {
        filesProcessed: number;
        filesWithCards: number;
        filesSkipped: number;
        processingTime: number;
    };
}
/**
 * 简化批量解析服务（重构后）
 * 职责：只负责解析文件并返回 ParsedCard[]，不再负责保存
 */
export declare class SimpleBatchParsingService {
    private config;
    private fileSelector;
    private deckMapping;
    private uuidManager;
    private parser;
    private mergeEngine;
    private isRunning;
    private abortController?;
    private app;
    private singleCardParser?;
    private singleCardSyncEngine?;
    private regexCardParser?;
    private cleanupService?;
    constructor(config: SimpleBatchParsingConfig, fileSelector: SimpleFileSelectorService, deckMapping: DeckMappingService, uuidManager: UUIDManager, parser: SimplifiedCardParser, app: IObsidianApp, dataStorage?: WeaveDataStorage, // 🆕 添加dataStorage参数（用于ThreeWayMergeEngine和SingleCardSyncEngine）
    cleanupService?: BlockLinkCleanupService, //  添加清理服务参数
    plugin?: any);
    /**
     *  预检查：在解析前验证配置和映射
     * 核心功能：
     * 1. 验证映射配置是否存在
     * 2. 验证映射路径是否有效
     * 3. 检查文件映射覆盖率
     * 4. 提供清晰的错误和警告信息
     */
    preflightCheck(): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }>;
    /**
     *  查找未映射的文件
     */
    private findUnmappedFiles;
    /**
     *  验证映射配置的完整性
     */
    private validateMappingConfiguration;
    /**
     * 执行批量解析
     *  重构后：只负责解析，返回 ParsedCard[]，保存由上层处理
     */
    executeBatchParsing(onProgress?: (progress: ParseProgress) => void): Promise<{
        parsedCards: ParsedCard[];
        result: BatchParseResult;
    }>;
    /**
     * 解析单个文件（带映射验证）
     * 用于"批量解析当前文件"命令
     */
    parseSingleFileWithMapping(file: TFile): Promise<{
        parsedCards: ParsedCard[];
        success: boolean;
        message?: string;
    }>;
    /**
     * 处理单个文件
     * 重构后：返回解析的卡片，不再保存
     */
    private processFile;
    /**
     * 🆕 检测卡片块中是否已有UUID
     * @returns UUID字符串，如果没有则返回null
     */
    private detectUUIDInBlock;
    /**
     * 显示完成通知
     */
    private showCompletionNotice;
    /**
     * 取消批量解析
     */
    abort(): void;
    /**
     * 检查是否正在运行
     */
    isProcessing(): boolean;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<SimpleBatchParsingConfig>): void;
    /**
     * 扫描映射的文件夹或文件
     */
    private scanMappedFolders;
    /**
     * 🆕 扫描映射（支持文件夹和文件级别）
     */
    private scanMapping;
    /**
     * 🆕 扫描单个文件
     */
    private scanSingleFile;
    /**
     * 扫描文件夹（新方法）
     */
    private scanFolder;
    /**
     * 去重文件列表
     */
    private deduplicateFiles;
    /**
     * 扫描单个映射的文件夹或文件并解析卡片
     *  重构：返回解析的卡片，由上层负责保存
     * 🆕 v2: 支持文件级别映射
     * @param mapping 要扫描的映射配置
     * @param onProgress 进度回调
     * @returns 扫描结果（包含解析的卡片）
     */
    scanSingleMapping(mapping: FolderDeckMapping, onProgress?: (current: number, total: number, file: string) => void): Promise<BatchParseResult>;
    /**
     * 统计单个映射中的卡片数量
     * 🆕 v2: 支持文件级别映射
     * @param mapping 映射配置
     * @returns 卡片数量
     */
    countCardsInMapping(mapping: FolderDeckMapping): Promise<number>;
    /**
     * 检查UUID对应的卡片是否已存在于数据库
     */
    private checkCardExists;
    /**
     * 查找匹配的映射规则
     */
    private findMatchingMapping;
    /**
     * 🆕 场景2：解析单文件为单张卡片
     * @param file Obsidian 文件对象
     * @param mapping 文件夹牌组映射
     * @param result 解析结果对象（累积）
     * @returns 解析结果
     */
    private parseSingleFileAsSingleCard;
    /**
     * 🆕 场景1：解析单文件为多张卡片（使用正则解析器）
     * @param file Obsidian 文件对象
     * @param mapping 文件夹牌组映射
     * @param result 解析结果对象（累积）
     * @returns 解析结果
     */
    private parseSingleFileAsMultiCards;
}
