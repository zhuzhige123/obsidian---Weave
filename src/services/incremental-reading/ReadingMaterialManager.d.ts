/**
 * 阅读材料管理服务
 *
 * 负责阅读材料的创建、分类管理和FSRS调度
 *
 * @module services/incremental-reading/ReadingMaterialManager
 * @version 1.0.0
 */
import type { App, TFile } from 'obsidian';
import type { ReadingMaterial, ReadingProgress, ReadingCategory } from '../../types/incremental-reading-types';
import type { FSRSCard, Rating } from '../../data/types';
import type { ReadingMaterialStorage } from './ReadingMaterialStorage';
import type { YAMLFrontmatterManager } from '../../utils/yaml-frontmatter-utils';
import type { AnchorManager } from './AnchorManager';
/**
 * 材料创建选项
 */
export interface CreateMaterialOptions {
    /** 初始分类 */
    category?: ReadingCategory;
    /** 初始优先级 */
    priority?: number;
    /** 标签 */
    tags?: string[];
    /** 来源 */
    source?: 'auto' | 'manual';
    /** 是否复制文件到导入文件夹（默认 true） */
    copyToImportFolder?: boolean;
    /** 自定义导入文件夹路径（可选，默认使用设置中的路径） */
    importFolder?: string;
}
/**
 * 分类变更结果
 */
export interface CategoryChangeResult {
    /** 是否成功 */
    success: boolean;
    /** 旧分类 */
    oldCategory: ReadingCategory;
    /** 新分类 */
    newCategory: ReadingCategory;
    /** FSRS是否激活 */
    fsrsActive: boolean;
    /** 错误信息 */
    error?: string;
}
/**
 * 阅读材料管理器
 */
export declare class ReadingMaterialManager {
    private app;
    private storage;
    private yamlManager;
    private anchorManager?;
    constructor(app: App, storage: ReadingMaterialStorage, yamlManager: YAMLFrontmatterManager);
    private isIRFile;
    private assertNotIRFile;
    /**
     * 设置锚点管理器（避免循环依赖）
     */
    setAnchorManager(anchorManager: AnchorManager): void;
    /**
     * 复制文件到目标文件夹
     * @param sourceFile 源文件
     * @param targetFolder 目标文件夹路径
     * @returns 复制后的文件
     */
    copyFileToImportFolder(sourceFile: TFile, targetFolder: string): Promise<TFile>;
    /**
     * 生成唯一的文件路径（避免重名）
     */
    private generateUniqueFilePath;
    private getDefaultImportFolderFromPluginSettings;
    /**
     * 获取导入文件夹路径
     * 优先使用选项中的路径，否则使用默认路径
     */
    private getImportFolder;
    /**
     * 检查文件是否已在导入文件夹中
     */
    private isInImportFolder;
    /**
     * 为文件创建阅读材料
     * 自动初始化FSRS参数并更新YAML frontmatter
     *
     * @param file 源文件
     * @param options 创建选项（包含是否复制文件）
     */
    createMaterial(file: TFile, options?: CreateMaterialOptions): Promise<ReadingMaterial>;
    /**
     * 通过文件获取或创建阅读材料
     * 优先使用YAML中的weave-reading-id，降级到文件路径匹配
     */
    getOrCreateMaterial(file: TFile, options?: CreateMaterialOptions): Promise<ReadingMaterial>;
    /**
     * 通过文件获取阅读材料（不创建）
     */
    getMaterialByFile(file: TFile): Promise<ReadingMaterial | null>;
    /**
     * 移动材料到新分类
     * 处理FSRS调度的激活/停用
     */
    changeCategory(materialId: string, newCategory: ReadingCategory): Promise<CategoryChangeResult>;
    /**
     * 判断分类是否激活FSRS调度
     */
    private isFSRSActive;
    /**
     * 更新材料优先级
     */
    updatePriority(materialId: string, priority: number): Promise<boolean>;
    /**
     * 应用优先级衰减
     * 对非收藏分类的材料，根据未访问天数降低优先级
     */
    applyPriorityDecay(): Promise<number>;
    /**
     * 初始化FSRS卡片数据
     */
    private initializeFSRS;
    /**
     * 完成阅读并更新FSRS调度
     * @param materialId 材料ID
     * @param rating 评分 (Again/Hard/Good/Easy)
     * @param fsrsScheduler FSRS调度器实例
     */
    completeReading(materialId: string, rating: Rating, fsrsScheduler: {
        schedule: (card: FSRSCard, rating: Rating) => FSRSCard;
    }): Promise<FSRSCard | null>;
    /**
     * 手动调整下次复习日期
     */
    setNextReviewDate(materialId: string, date: Date): Promise<boolean>;
    /**
     * 更新阅读进度
     */
    updateProgress(materialId: string, progress: Partial<ReadingProgress>): Promise<boolean>;
    /**
     * 刷新材料的进度（从文件重新计算）
     */
    refreshProgress(materialId: string): Promise<ReadingProgress | null>;
    /**
     * 添加提取的卡片
     */
    addExtractedCard(materialId: string, cardId: string): Promise<boolean>;
    /**
     * 设置关联的阅读牌组
     */
    setReadingDeck(materialId: string, deckId: string): Promise<boolean>;
    /**
     * 获取今日到期的材料
     */
    getTodayDueMaterials(): ReadingMaterial[];
    /**
     * 获取指定分类的材料
     */
    getMaterialsByCategory(category: ReadingCategory): ReadingMaterial[];
    /**
     * 获取最近访问的材料
     */
    getRecentMaterials(limit?: number): ReadingMaterial[];
    /**
     * 获取所有材料
     */
    getAllMaterials(): ReadingMaterial[];
    /**
     * 批量导入阅读材料
     * 复制文件到目标文件夹，添加阅读标识和FSRS调度
     *
     * @param filePaths 文件路径列表
     * @param onProgress 进度回调
     * @param options 导入选项（包含目标文件夹设置）
     */
    batchImportMaterials(filePaths: string[], onProgress?: (current: number, total: number) => void, options?: BatchImportOptions): Promise<BatchImportResult>;
    /**
     * 创建阅读点（PDF书签）
     * 不复制文件、不修改YAML，仅创建材料记录
     */
    createReadingPoint(parentMaterialId: string, title: string, resumeLink: string, pdfFilePath: string): Promise<ReadingMaterial | null>;
    /**
     * 批量创建阅读点
     */
    batchCreateReadingPoints(parentMaterialId: string, points: Array<{
        title: string;
        resumeLink: string;
        parentMaterialId?: string;
    }>, pdfFilePath: string): Promise<ReadingMaterial[]>;
    /**
     * 删除阅读材料
     * 从存储中移除材料记录，但不删除源文件
     * 如果删除的是父节点，子节点提升一级（不级联删除）
     */
    removeMaterial(materialId: string): Promise<boolean>;
    /**
     * 手动调整材料的复习日期
     * 覆盖 FSRS 自动调度
     */
    rescheduleMaterial(materialId: string, newDate: Date): Promise<boolean>;
    /**
     * 获取摘录卡片列表
     * @param deckId 可选的牌组ID筛选
     */
    getExtractCards(deckId?: string): Promise<import('../../types/extract-types').ExtractCard[]>;
    /**
     * 移除 YAML frontmatter
     * @param content 文件内容
     */
    private stripYAMLFrontmatter;
    /**
     * 更新摘录卡片
     */
    updateExtractCard(card: import('../../types/extract-types').ExtractCard): Promise<boolean>;
    /**
     * 更新摘录卡片类型
     */
    updateExtractCardType(cardId: string, newType: import('../../types/extract-types').ExtractType): Promise<boolean>;
    /**
     * 更新摘录卡片所属牌组
     */
    updateExtractCardDeck(cardId: string, deckId: string): Promise<boolean>;
    /**
     * 将摘录类型映射回阅读分类
     */
    private mapExtractTypeToCategory;
    /**
     * 将阅读分类映射到摘录类型
     */
    private mapCategoryToExtractType;
    /**
     * 添加摘录卡片（从选中文本快捷键创建）
     * @param extractCard 摘录卡片数据
     */
    addExtractCard(extractCard: import('../../types/extract-types').ExtractCard): Promise<boolean>;
}
/**
 * 创建阅读材料管理器实例
 */
export declare function createReadingMaterialManager(app: App, storage: ReadingMaterialStorage, yamlManager: YAMLFrontmatterManager): ReadingMaterialManager;
/**
 * 批量导入结果
 */
export interface BatchImportResult {
    /** 成功导入数量 */
    success: number;
    /** 跳过数量（已存在） */
    skipped: number;
    /** 错误列表 */
    errors: Array<{
        path: string;
        error: string;
    }>;
}
/**
 * 批量导入选项
 */
export interface BatchImportOptions {
    /** 初始分类 */
    category?: ReadingCategory;
    /** 初始优先级 */
    priority?: number;
    /** 标签 */
    tags?: string[];
    /** 导入目标文件夹路径（文件将复制到此文件夹） */
    importFolder?: string;
}
