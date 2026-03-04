/**
 * 简化文件选择器服务
 * 负责管理批量解析的文件扫描范围
 *
 * 功能：
 * 1. 获取库中所有文件夹
 * 2. 管理包含/排除列表
 * 3. 解析文件扫描范围
 * 4. 获取符合条件的文件列表
 */
import { TFile, Vault, MetadataCache } from 'obsidian';
/**
 * 文件选择配置
 */
export interface FileSelectorConfig {
    /** 包含的文件夹路径（空数组表示全库） */
    includeFolders: string[];
    /** 排除的文件夹路径 */
    excludeFolders: string[];
    /** 是否递归扫描子文件夹 */
    recursive: boolean;
    /** 是否仅扫描包含批量标记的文件 */
    onlyMarkedFiles: boolean;
    /** 批量解析范围起始标记 */
    rangeStartMarker?: string;
    /** 批量解析范围结束标记 */
    rangeEndMarker?: string;
}
/**
 * 文件夹信息
 */
export interface FolderInfo {
    path: string;
    name: string;
    level: number;
    childCount: number;
}
/**
 * 扫描统计
 */
export interface ScanStats {
    totalFiles: number;
    includedFiles: number;
    excludedFiles: number;
    markedFiles: number;
}
/**
 * 简化文件选择器服务
 */
export declare class SimpleFileSelectorService {
    private vault;
    private metadataCache;
    constructor(vault: Vault, metadataCache: MetadataCache);
    /**
     * 获取库中所有文件夹
     */
    getAllFolders(): FolderInfo[];
    /**
     * 获取符合条件的文件列表
     */
    getFilesInScope(config: FileSelectorConfig): Promise<TFile[]>;
    /**
     * 判断文件是否应该包含在扫描范围内
     */
    private shouldIncludeFile;
    /**
     * 检查文件是否在排除的文件夹中
     */
    private isInExcludedFolders;
    /**
     * 检查文件是否在包含的文件夹中
     */
    private isInIncludedFolders;
    /**
     * 规范化路径
     */
    private normalizePath;
    /**
     * 获取文件的父文件夹路径
     */
    private getParentFolder;
    /**
     * 获取扫描统计信息
     */
    getScanStats(config: FileSelectorConfig): Promise<ScanStats>;
    /**
     * 验证文件夹路径是否存在
     */
    isFolderExists(folderPath: string): boolean;
    /**
     * 获取文件夹的子文件夹
     */
    getSubFolders(folderPath: string): FolderInfo[];
}
