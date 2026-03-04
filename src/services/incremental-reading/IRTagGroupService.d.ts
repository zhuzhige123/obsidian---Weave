/**
 * 标签组（材料类型）服务 v3.0
 *
 * 职责：
 * - 管理标签组定义的 CRUD
 * - 管理标签组参数（可学习）
 * - 文档到标签组的匹配与缓存
 * - 组参数的 shrinkage 学习
 *
 * @module services/incremental-reading/IRTagGroupService
 * @version 3.0.0
 */
import type { App } from 'obsidian';
import type { IRTagGroup, IRTagGroupMatchSource, IRTagGroupProfile, IRAdvancedScheduleSettings } from '../../types/ir-types';
export declare class IRTagGroupService {
    private app;
    private initialized;
    private initPromise;
    private groupsCache;
    private profilesCache;
    private documentMapCache;
    constructor(app: App);
    private getStorageDir;
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    private doInitialize;
    /**
     * 加载所有标签组
     */
    private loadGroups;
    private saveGroups;
    private loadProfiles;
    private saveProfiles;
    private loadDocumentMap;
    private saveDocumentMap;
    getAllGroups(): Promise<IRTagGroup[]>;
    createGroup(name: string, matchAnyTags: string[], description?: string, matchPriority?: number): Promise<IRTagGroup>;
    saveGroup(group: IRTagGroup): Promise<void>;
    deleteGroup(groupId: string, storageService?: {
        getAllChunkData?: () => Promise<Record<string, any>>;
        saveChunkData?: (data: any) => Promise<void>;
        getAllSources?: () => Promise<Record<string, any>>;
        saveSource?: (data: any) => Promise<void>;
    }): Promise<void>;
    getProfile(groupId: string): Promise<IRTagGroupProfile>;
    saveProfile(profile: IRTagGroupProfile): Promise<void>;
    /**
     * 从文件中提取标签（默认提取所有来源）
     */
    extractTagsFromFile(filePath: string): Promise<string[]>;
    /**
     * 按 matchSource 配置从文件提取标签
     * 未传 matchSource 时默认提取 yamlTags + inlineTags
     */
    extractTagsWithSource(filePath: string, matchSource?: IRTagGroupMatchSource): Promise<string[]>;
    /**
     * 为文档匹配标签组
     *
     * @param filePath 文件路径
     * @param forceRefresh 强制刷新（忽略缓存）
     * @returns 匹配的标签组 ID
     */
    matchGroupForDocument(filePath: string, forceRefresh?: boolean): Promise<string>;
    invalidateDocumentCache(filePath: string): void;
    /**
     * 手动设置文档的标签组映射（用于右键菜单等手动切换场景）
     * 同步更新 documentMapCache，使设置界面文档数统计正确
     */
    updateDocumentGroupManual(filePath: string, groupId: string): Promise<void>;
    /**
     * 获取文档的标签组参数
     */
    getProfileForDocument(filePath: string): Promise<IRTagGroupProfile>;
    /**
     * 清除文档映射缓存
     */
    clearDocumentMapCache(filePath?: string): Promise<void>;
    /**
     * 检测文档标签是否发生漂移（匹配到不同标签组）
     *
     * @param filePath 源文档路径
     * @param currentTagGroup 当前存储的标签组 ID
     * @returns 漂移信息，null 表示未漂移
     */
    detectTagGroupDrift(filePath: string, currentTagGroup: string): Promise<{
        oldGroupId: string;
        newGroupId: string;
        oldGroupName: string;
        newGroupName: string;
        currentTags: string[];
    } | null>;
    /**
     * 执行标签组切换：批量更新同一 sourceId 下所有 chunk 和 source 的 tagGroup
     *
     * @param chunkId 触发切换的块 ID
     * @param sourceId 源文件 ID（可选）
     * @param newGroupId 新标签组 ID
     * @param storageService 存储服务（用于回写数据）
     */
    applyTagGroupSwitch(chunkId: string, sourceId: string | undefined, newGroupId: string, storageService: {
        getChunkData: (id: string) => Promise<any>;
        saveChunkData: (data: any) => Promise<void>;
        getSource: (id: string) => Promise<any>;
        saveSource: (data: any) => Promise<void>;
        getAllChunkData?: () => Promise<Record<string, any>>;
    }): Promise<void>;
    /**
     * 更新组参数（基于负载信号，使用 shrinkage）
     *
     * @param groupId 标签组 ID
     * @param loadSignal 负载信号 L (0-1)
     * @param priorityWeight 优先级权重 (0.5-1.5)
     * @param settings 高级设置
     */
    updateGroupProfile(groupId: string, loadSignal: number, priorityWeight: number, settings?: IRAdvancedScheduleSettings): Promise<void>;
    /**
     * 获取组统计信息
     */
    getGroupStats(): Promise<Array<{
        group: IRTagGroup;
        profile: IRTagGroupProfile;
        documentCount: number;
    }>>;
}
