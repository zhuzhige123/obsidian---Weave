/**
 * 批量解析管理器
 * 集成所有批量解析服务，提供统一接口给主插件
 *
 * 职责：
 * 1. 初始化所有子服务
 * 2. 提供命令注册接口
 * 3. 管理配置和状态
 * 4. 处理UI交互
 */
import { App, TFile } from 'obsidian';
import { SimpleBatchParsingConfig, FolderDeckMapping, IDeckStorage, IUUIDStorage, ParseProgress, BatchParseResult } from './index';
import { SimplifiedCardParser } from '../../utils/simplifiedParser/SimplifiedCardParser';
import { SimplifiedParsingSettings } from '../../types/newCardParsingTypes';
import type { IWeavePlugin } from '../../types/plugin-interfaces';
/**
 * 进度回调类型
 */
export type ProgressCallback = (progress: ParseProgress) => void;
/**
 * 批量解析管理器（重构后）
 * 职责：协调解析和保存，调用插件的统一保存流程
 */
export declare class BatchParsingManager {
    private app;
    private config;
    private parser;
    private deckStorage;
    private uuidStorage;
    private plugin;
    private logDebug;
    private fileSelector;
    private deckMapping;
    private uuidManager;
    private batchService;
    private isInitialized;
    private progressCallback?;
    constructor(app: App, parsingSettings: SimplifiedParsingSettings, parser: SimplifiedCardParser, deckStorage: IDeckStorage, uuidStorage: IUUIDStorage, plugin: IWeavePlugin);
    /**
     * 注册命令到插件
     */
    registerCommands(_plugin: any): void;
    /**
     * 更新解析器设置
     * 用于运行时动态更新配置（例如用户在设置面板修改后）
     */
    updateParserSettings(newSettings: SimplifiedParsingSettings): void;
    /**
     * 执行批量解析（ 重构后）
     * 职责：协调解析和保存，调用插件的统一保存流程
     */
    executeBatchParsing(): Promise<BatchParseResult | null>;
    /**
     * 解析单个文件（使用映射逻辑）
     * 替代旧的 main.batchParseCurrentFile()
     */
    parseSingleFile(file: TFile): Promise<void>;
    /**
     * 清理UUID记录
     */
    cleanupUUIDs(): Promise<void>;
    /**
     * 更新配置（ 重构后）
     *  v2: 同步更新到 plugin settings
     */
    updateConfig(updates: Partial<SimpleBatchParsingConfig>): Promise<void>;
    /**
     * 🆕 更新文件夹牌组映射列表（便捷方法）
     */
    updateMappings(mappings: FolderDeckMapping[]): Promise<void>;
    /**
     * 获取当前配置
     */
    getConfig(): SimpleBatchParsingConfig;
    /**
     *  验证配置完整性
     */
    private validateConfig;
    /**
     *  获取有效的映射配置（路径和目标牌组都已配置）
     */
    private getValidMappings;
    /**
     *  获取无效的映射配置（用于警告）
     */
    private getInvalidMappings;
    /**
     *  从 plugin settings 同步最新配置
     * 确保使用最新的映射配置，避免配置不同步问题
     * 在 executeBatchParsing 执行前调用，确保验证时使用最新配置
     */
    private syncConfigFromSettings;
    /**
     * 设置进度回调
     */
    setProgressCallback(callback: ProgressCallback): void;
    /**
     * 显示结果
     */
    private showResult;
    /**
     * 扫描单个文件夹映射并解析卡片
     *  重构：返回解析的卡片，由上层负责保存
     * @param mapping 要扫描的映射配置
     * @param onProgress 进度回调
     * @returns 扫描结果（包含解析的卡片）
     */
    scanSingleMapping(mapping: FolderDeckMapping, onProgress?: (current: number, total: number, file: string) => void): Promise<BatchParseResult>;
    /**
     * 统计单个映射中的卡片数量
     * @param mapping 映射配置
     * @returns 卡片数量
     */
    countCardsInMapping(mapping: FolderDeckMapping): Promise<number>;
    /**
     * 销毁管理器
     */
    destroy(): void;
}
