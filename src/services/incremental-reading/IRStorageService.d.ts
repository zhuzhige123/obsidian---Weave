/**
 * 增量阅读存储服务
 *
 * 负责管理增量阅读数据的持久化存储：
 * - blocks.json: 内容块数据
 * - decks.json: 牌组配置
 * - history.json: 阅读历史
 *
 * 存储路径: weave/incremental-reading/
 *
 * @module services/incremental-reading/IRStorageService
 * @version 2.0.0 - 引入式架构
 */
import { App } from 'obsidian';
import type { IRBlock, IRDeck, IRSession, IRStudySession, FileSyncState } from '../../types/ir-types';
export declare class IRStorageService {
    private app;
    private initialized;
    private initPromise;
    private migratedChunkReadablePaths;
    private migratedSourceReadablePaths;
    private migratedBlockReadablePaths;
    private migratedDeckReadablePaths;
    constructor(app: App);
    private getStorageDir;
    private coerceToVaultPath;
    private getReadableRoots;
    private rewriteRootPrefix;
    private migrateReadablePathIfNeeded;
    /**
     * 初始化存储目录（带锁防止并发）
     */
    initialize(): Promise<void>;
    private doInitialize;
    private sleep;
    /**
     * 确保目录存在（使用 adapter）
     */
    private ensureDirectory;
    /**
     * 确保文件存在（使用 adapter）
     */
    private ensureFile;
    /**
     * 获取所有内容块 (v2.0 支持版本化结构)
     */
    getAllBlocks(): Promise<Record<string, IRBlock>>;
    /**
     * 获取单个内容块
     */
    getBlock(id: string): Promise<IRBlock | null>;
    /**
     * 获取牌组的所有内容块 (v2.0: 支持blockIds索引)
     * @param deckId 牌组ID
     * @param includeIgnored 是否包含已忽略的内容块（默认false）
     * @param caller 调用者标识（用于调试）
     */
    getBlocksByDeck(deckId: string, includeIgnored?: boolean, caller?: string): Promise<IRBlock[]>;
    /**
     * 获取文件的所有内容块 (v2.0: 使用startLine排序)
     */
    getBlocksByFile(filePath: string): Promise<IRBlock[]>;
    /**
     * 保存内容块 (v2.0 版本化存储)
     */
    saveBlock(block: IRBlock): Promise<void>;
    /**
     * 批量保存内容块 (v2.0 版本化存储)
     */
    saveBlocks(newBlocks: IRBlock[]): Promise<void>;
    /**
     * 删除内容块 (v2.0 版本化存储)
     * v2.1: 实现级联删除，自动从所有牌组的 blockIds 中移除该 UUID
     */
    deleteBlock(id: string): Promise<void>;
    /**
     * 从所有牌组中移除指定内容块引用 (v2.1 新增)
     * @param blockId 要移除的内容块ID
     * @param filePath 内容块所属文件路径（用于更新 sourceFiles）
     */
    private removeBlockFromAllDecks;
    /**
     * 删除文件的所有内容块 (v2.0 版本化存储)
     * v2.1: 实现级联删除，自动从所有牌组中移除这些内容块引用和 sourceFiles
     */
    deleteBlocksByFile(filePath: string): Promise<void>;
    /**
     * 从所有牌组中批量移除内容块引用 (v2.1 新增)
     * @param blockIds 要移除的内容块ID列表
     * @param filePath 内容块所属文件路径（用于更新 sourceFiles）
     */
    private removeBlocksFromAllDecks;
    /**
     * 获取所有牌组 (v2.0 支持版本化结构)
     */
    getAllDecks(): Promise<Record<string, IRDeck>>;
    /**
     * 获取单个牌组 (v1.0 兼容: 使用path查找)
     * @deprecated 使用 getDeckById 代替
     */
    getDeck(path: string): Promise<IRDeck | null>;
    /**
     * 获取单个牌组 (v2.0: 使用id查找，兼容path)
     */
    getDeckById(idOrPath: string): Promise<IRDeck | null>;
    migrateChunkDeckNameInYAML(oldName: string, newName: string): Promise<{
        scanned: number;
        updated: number;
    }>;
    /**
     * 保存牌组 (v2.0 版本化存储)
     */
    saveDeck(deck: IRDeck): Promise<void>;
    /**
     * 删除牌组 (v2.0 版本化存储，兼容 id 和 path 查找)
     */
    deleteDeck(idOrPath: string): Promise<void>;
    private cleanupDeletedDeckRelatedData;
    private cleanupDeckBookmarkTasks;
    private toNormalizedStringSet;
    private collectSourceFilesByExtension;
    private cleanupDeckBlocks;
    private cleanupDeckChunksAndSources;
    private cleanupDeckStudySessions;
    private cleanupDeckSyncStates;
    private cleanupDeckMarkdownFrontmatter;
    /**
     * 向牌组添加内容块 (v2.0 新增)
     */
    addBlocksToDeck(deckId: string, blockIds: string[]): Promise<void>;
    /**
     * 从牌组移除内容块 (v2.0 新增)
     */
    removeBlocksFromDeck(deckId: string, blockIds: string[]): Promise<void>;
    /**
     * 获取阅读历史 (v2.0 支持版本化结构)
     */
    getHistory(): Promise<{
        sessions: IRSession[];
    }>;
    /**
     * 添加阅读会话 (v2.0 版本化存储)
     */
    addSession(session: IRSession): Promise<void>;
    /**
     * 获取内容块的阅读历史
     */
    getBlockSessions(blockId: string): Promise<IRSession[]>;
    getCalendarProgress(): Promise<Record<string, string[]>>;
    addCalendarCompletion(dateKey: string, chunkId: string): Promise<void>;
    private static readonly STUDY_SESSIONS_FILE;
    /**
     * 获取所有学习会话记录
     */
    getStudySessions(): Promise<IRStudySession[]>;
    /**
     * 添加学习会话记录
     */
    addStudySession(session: IRStudySession): Promise<void>;
    /**
     * 获取指定牌组的学习会话
     */
    getStudySessionsByDeck(deckId: string): Promise<IRStudySession[]>;
    /**
     * 获取牌组统计
     * v2.4: 新增提问统计（解析复选框+问号语法）
     * v2.6: 优化性能 - 提问统计改为可选，默认跳过以加快加载
     * v5.3: 同时统计旧版 IRBlock 和新版 IRChunkFileData
     */
    getDeckStats(deckPath: string, dailyNewLimit?: number, dailyReviewLimit?: number, learnAheadDays?: number): Promise<{
        newCount: number;
        learningCount: number;
        reviewCount: number;
        dueToday: number;
        dueWithinDays: number;
        totalCount: number;
        fileCount: number;
        questionCount: number;
        completedQuestionCount: number;
        todayNewCount: number;
        todayDueCount: number;
    }>;
    /**
     * 统计文件中的提问数量 (v2.4 新增)
     * 识别格式: - [x] 问题? 或 - [ ] 问题?
     * @param filePaths 文件路径列表
     * @returns 提问总数和已完成数
     */
    private countQuestionsInFiles;
    /**
     * 获取今日到期的内容块
     */
    getTodayDueBlocks(): Promise<IRBlock[]>;
    /**
     * 读取文件内容（使用 adapter 直接读取）
     */
    private readFile;
    /**
     * 写入文件内容（使用 adapter 直接写入）
     */
    private writeFile;
    /**
     * 获取所有文件同步状态
     */
    getAllSyncStates(): Promise<Record<string, FileSyncState>>;
    /**
     * 获取单个文件的同步状态
     */
    getFileSyncState(filePath: string): Promise<FileSyncState | null>;
    saveFileSyncState(state: FileSyncState): Promise<void>;
    saveFileSyncStates(newStates: FileSyncState[]): Promise<void>;
    deleteFileSyncState(filePath: string): Promise<void>;
    private saveSyncStates;
    /**
     * 检测文件是否需要同步（基于 mtime 和 size）
     * @returns true 如果文件已变化需要同步
     */
    checkFileNeedsSync(filePath: string, currentMtime: number, currentSize: number): Promise<boolean>;
    /**
     * 生成 UUID 列表哈希（用于快速检测块变化）
     */
    generateUuidListHash(uuids: string[]): string;
    /**
     * 校验并清理悬空引用 (v2.1 新增)
     * 用于插件启动时执行，确保数据完整性
     *
     * @returns 清理结果统计
     */
    validateAndCleanOrphanedReferences(): Promise<{
        orphanedBlockIds: number;
        orphanedSourceFiles: number;
        affectedDecks: number;
    }>;
    /**
     * 检查内容块是否存在对应的源文件 (v2.1 新增)
     * 用于检测源文件被删除但内容块记录未清理的情况
     *
     * @returns 孤立内容块的ID列表
     */
    findOrphanedBlocks(): Promise<string[]>;
    /**
     * 清理孤立内容块（源文件已删除）(v2.1 新增)
     *
     * @returns 清理的内容块数量
     */
    cleanOrphanedBlocks(): Promise<number>;
    private readonly SOURCES_FILE;
    private readonly CHUNKS_FILE;
    /**
     * 获取所有源材料元数据
     */
    getAllSources(): Promise<Record<string, import('../../types/ir-types').IRSourceFileMeta>>;
    /**
     * 获取单个源材料元数据
     */
    getSource(sourceId: string): Promise<import('../../types/ir-types').IRSourceFileMeta | null>;
    /**
     * 保存源材料元数据
     */
    saveSource(source: import('../../types/ir-types').IRSourceFileMeta): Promise<void>;
    saveSourceBatch(sourceList: import('../../types/ir-types').IRSourceFileMeta[]): Promise<void>;
    /**
     * 删除源材料元数据
     */
    deleteSource(sourceId: string): Promise<void>;
    /**
     * 获取所有块文件调度数据
     */
    getAllChunkData(): Promise<Record<string, import('../../types/ir-types').IRChunkFileData>>;
    /**
     * 获取单个块文件调度数据
     */
    getChunkData(chunkId: string): Promise<import('../../types/ir-types').IRChunkFileData | null>;
    /**
     * 保存块文件调度数据
     */
    saveChunkData(chunk: import('../../types/ir-types').IRChunkFileData): Promise<void>;
    /**
     * 批量保存块文件调度数据
     */
    saveChunkDataBatch(chunkList: import('../../types/ir-types').IRChunkFileData[]): Promise<void>;
    /**
     * 删除块文件调度数据
     */
    deleteChunkData(chunkId: string): Promise<void>;
    /**
     * 获取源材料的所有块调度数据
     */
    getChunkDataBySource(sourceId: string): Promise<import('../../types/ir-types').IRChunkFileData[]>;
    /**
     * 获取所有活跃状态的块调度数据（排除 done/archived）
     */
    getActiveChunkData(): Promise<import('../../types/ir-types').IRChunkFileData[]>;
    /**
     * 获取今日到期的块调度数据
     */
    getTodayDueChunkData(): Promise<import('../../types/ir-types').IRChunkFileData[]>;
    /**
     * 根据牌组标签获取块调度数据
     * @param deckTag 牌组标签，格式 #IR_deck_牌组名
     */
    getChunksByDeckTag(deckTag: string): Promise<import('../../types/ir-types').IRChunkFileData[]>;
    /**
     * 获取所有牌组标签列表（从 chunks.json 中提取）
     */
    getAllDeckTags(): Promise<string[]>;
    /**
     * 修改块的牌组标签（同时更新 JSON 和块文件 YAML）
     * @param chunkId 块 ID
     * @param newDeckTag 新牌组标签
     */
    updateChunkDeckTag(chunkId: string, newDeckTag: string): Promise<void>;
    /**
     * 更新块文件的 YAML frontmatter
     */
    private updateChunkFileYAML;
    /**
     * 根据牌组标签获取统计数据
     */
    getDeckStatsByTag(deckTag: string, dailyNewLimit?: number, dailyReviewLimit?: number): Promise<{
        newCount: number;
        learningCount: number;
        reviewCount: number;
        dueToday: number;
        totalCount: number;
        fileCount: number;
        todayNewCount: number;
        todayDueCount: number;
    }>;
    /**
     * 从内容块文件 YAML 读取 deck_tag
     * @param filePath 块文件路径
     * @returns deck_tag 值，如果读取失败返回 null
     */
    readDeckTagFromYAML(filePath: string): Promise<string | null>;
    /**
     * 同步所有内容块的 deck_tag（以 YAML 为基准）
     * 返回需要更新的块数量
     */
    syncDeckTagsFromYAML(): Promise<{
        synced: number;
        removed: Map<string, string[]>;
    }>;
    /**
     * 获取所有块数据（同步 YAML deck_tag 后）
     * 这是 getAllChunkData 的增强版本，确保 deck_tag 与文件 YAML 一致
     */
    getAllChunkDataWithSync(): Promise<Record<string, import('../../types/ir-types').IRChunkFileData>>;
    /**
     * 从内容块文件 YAML 读取 deck_names（多牌组）
     * @param filePath 块文件路径
     * @returns deck_names 数组，如果读取失败返回 null
     */
    readDeckNamesFromYAML(filePath: string): Promise<string[] | null>;
    /**
     * 验证牌组名称，返回有效的牌组ID列表
     * @param deckNames 用户填写的牌组名称列表
     * @returns 验证通过的牌组ID列表
     */
    validateDeckNames(deckNames: string[]): Promise<string[]>;
    /**
     * 根据牌组ID获取牌组名称
     */
    getDeckNameById(deckId: string): Promise<string | null>;
    /**
     * 根据牌组名称获取牌组ID
     */
    getDeckIdByName(deckName: string): Promise<string | null>;
    /**
     * 同步内容块的牌组数据（从 YAML 读取并验证）
     * 支持多牌组，以 YAML 中的 deck_names 为基准
     */
    syncDeckDataFromYAML(): Promise<{
        synced: number;
        invalidDecks: string[];
    }>;
    /**
     * 辅助函数：比较两个数组是否相等
     */
    private arraysEqual;
    /**
     * 更新内容块的牌组（支持多牌组）
     * @param chunkId 块 ID
     * @param deckIds 牌组 ID 列表
     */
    updateChunkDecks(chunkId: string, deckIds: string[]): Promise<void>;
    /**
     * 向内容块添加牌组
     */
    addDeckToChunk(chunkId: string, deckId: string): Promise<void>;
    /**
     * 从内容块移除牌组
     */
    removeDeckFromChunk(chunkId: string, deckId: string): Promise<void>;
    /**
     * 更新块文件 YAML 中的 deck_names
     */
    private updateChunkFileYAMLDeckNames;
    /**
     * 获取所有正式牌组列表（用于UI显示）
     */
    getValidDeckList(): Promise<Array<{
        id: string;
        name: string;
    }>>;
    /**
     * 清理无效的块数据（对应文件不存在的块）
     * 返回被清理的块数量
     */
    cleanupInvalidChunks(): Promise<{
        removed: number;
        invalidPaths: string[];
    }>;
    slimIRMarkdownFrontmatter(scanRoot?: string): Promise<{
        updated: number;
        scanned: number;
    }>;
    cleanupOrphanChunkFiles(scanRoot?: string): Promise<{
        removed: number;
    }>;
    /**
     * 清理无效的旧版块数据（blocks.json）
     */
    cleanupInvalidBlocks(): Promise<{
        removed: number;
        invalidPaths: string[];
    }>;
    /**
     * 清理无效的源材料数据
     */
    cleanupInvalidSources(): Promise<{
        removed: number;
    }>;
    /**
     * 执行完整的数据完整性检查和清理
     * 在加载数据前调用，确保显示的数据都是有效的
     */
    performIntegrityCheck(scanRoot?: string): Promise<{
        chunksRemoved: number;
        blocksRemoved: number;
        sourcesRemoved: number;
    }>;
    /**
     * 获取所有块数据（带完整性检查）
     * 先清理无效数据，再返回有效数据
     */
    getAllChunkDataWithIntegrityCheck(scanRoot?: string): Promise<Record<string, import('../../types/ir-types').IRChunkFileData>>;
}
