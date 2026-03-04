/**
 * 阅读材料存储服务
 *
 * 负责阅读材料索引的持久化存储
 * 核心原则：只存储索引和元数据，不存储MD文件内容
 *
 * @module services/incremental-reading/ReadingMaterialStorage
 * @version 1.0.0
 */
import type { App } from 'obsidian';
import type { ReadingMaterial, ReadingSession, AnchorsCache, AnchorRecord } from '../../types/incremental-reading-types';
/**
 * 阅读材料存储服务
 */
export declare class ReadingMaterialStorage {
    private app;
    private materialsCache;
    private initialized;
    private get storagePaths();
    constructor(app: App);
    /**
     * 初始化存储
     */
    initialize(): Promise<void>;
    /**
     * 确保存储目录存在
     */
    private ensureDirectories;
    /**
     * 加载材料索引
     */
    private loadMaterialsIndex;
    /**
     * 保存材料索引
     */
    private saveMaterialsIndex;
    /**
     * 获取所有阅读材料
     */
    getAllMaterials(): Promise<ReadingMaterial[]>;
    /**
     * 通过UUID获取阅读材料
     */
    getMaterialById(uuid: string): Promise<ReadingMaterial | null>;
    /**
     * 通过文件路径获取阅读材料
     */
    getMaterialByPath(filePath: string): Promise<ReadingMaterial | null>;
    /**
     * 保存阅读材料
     */
    saveMaterial(material: ReadingMaterial): Promise<void>;
    /**
     * 删除阅读材料
     */
    deleteMaterial(uuid: string): Promise<boolean>;
    /**
     * 批量保存阅读材料
     */
    saveMaterials(materials: ReadingMaterial[]): Promise<void>;
    /**
     * 获取材料的会话记录文件路径
     */
    private getSessionsFilePath;
    /**
     * 获取材料的所有会话记录
     */
    getSessionsForMaterial(materialId: string): Promise<ReadingSession[]>;
    /**
     * 保存会话记录
     */
    saveSession(session: ReadingSession): Promise<void>;
    /**
     * 删除材料的所有会话记录
     */
    private deleteSessionsForMaterial;
    /**
     * 获取锚点缓存
     */
    getAnchorsCache(): Promise<AnchorsCache | null>;
    /**
     * 更新锚点缓存
     */
    updateAnchorsCache(filePath: string, anchors: AnchorRecord[]): Promise<void>;
    /**
     * 获取文件的缓存锚点
     */
    getCachedAnchors(filePath: string): Promise<AnchorRecord[] | null>;
    /**
     * 清除锚点缓存
     */
    clearAnchorsCache(): Promise<void>;
    /**
     * 按分类获取材料
     */
    getMaterialsByCategory(category: string): Promise<ReadingMaterial[]>;
    /**
     * 获取今日到期的材料
     */
    getTodayDueMaterials(): Promise<ReadingMaterial[]>;
    /**
     * 获取指定日期范围的材料
     */
    getMaterialsInDateRange(startDate: Date, endDate: Date): Promise<ReadingMaterial[]>;
    /**
     * 获取最近访问的材料
     */
    getRecentMaterials(limit?: number): Promise<ReadingMaterial[]>;
    /**
     * 获取材料统计
     */
    getStatistics(): Promise<{
        total: number;
        byCategory: Record<string, number>;
        todayDue: number;
        averageProgress: number;
    }>;
}
/**
 * 创建阅读材料存储实例
 */
export declare function createReadingMaterialStorage(app: App): ReadingMaterialStorage;
