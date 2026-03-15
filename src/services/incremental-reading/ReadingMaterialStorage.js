/**
 * 阅读材料存储服务
 *
 * 负责阅读材料索引的持久化存储
 * 核心原则：只存储索引和元数据，不存储MD文件内容
 *
 * @module services/incremental-reading/ReadingMaterialStorage
 * @version 1.0.0
 */
import { logger } from '../../utils/logger';
import { DirectoryUtils } from '../../utils/directory-utils';
import { getV2PathsFromApp, getPluginPaths } from '../../config/paths';
/**
 * V2.0 存储路径配置
 * 材料数据合并到 weave/incremental-reading/materials/
 * 锚点缓存移到插件目录 .obsidian/plugins/weave/cache/
 */
/**
 * 阅读材料存储服务
 */
export class ReadingMaterialStorage {
    app;
    materialsCache = new Map();
    initialized = false;
    get storagePaths() {
        const v2Paths = getV2PathsFromApp(this.app);
        return {
            ROOT: v2Paths.ir.materials.root,
            MATERIALS_INDEX: v2Paths.ir.materials.index,
            ANCHORS_CACHE: getPluginPaths(this.app).cache.anchors,
            SESSIONS_DIR: v2Paths.ir.materials.sessions
        };
    }
    constructor(app) {
        this.app = app;
    }
    /**
     * 初始化存储
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            logger.info('[ReadingMaterialStorage] 初始化存储...');
            // 确保目录存在（迁移由 SchemaV2MigrationService 统一处理）
            await this.ensureDirectories();
            // 加载材料索引
            await this.loadMaterialsIndex();
            this.initialized = true;
            logger.info('[ReadingMaterialStorage] 存储初始化完成');
        }
        catch (error) {
            logger.error('[ReadingMaterialStorage] 初始化失败:', error);
            throw error;
        }
    }
    /**
     * 确保存储目录存在
     */
    async ensureDirectories() {
        const adapter = this.app.vault.adapter;
        const storagePaths = this.storagePaths;
        const directories = [
            storagePaths.ROOT,
            storagePaths.SESSIONS_DIR,
            getPluginPaths(this.app).cache.root,
        ];
        for (const dir of directories) {
            try {
                await DirectoryUtils.ensureDirRecursive(adapter, dir);
                logger.debug(`[ReadingMaterialStorage] 目录已确保存在: ${dir}`);
            }
            catch (error) {
                logger.warn(`[ReadingMaterialStorage] 创建目录失败: ${dir}`, error);
            }
        }
    }
    /**
     * 加载材料索引
     */
    async loadMaterialsIndex() {
        const adapter = this.app.vault.adapter;
        const storagePaths = this.storagePaths;
        try {
            const exists = await adapter.exists(storagePaths.MATERIALS_INDEX);
            if (exists) {
                const content = await adapter.read(storagePaths.MATERIALS_INDEX);
                const index = JSON.parse(content);
                // 加载到缓存
                this.materialsCache.clear();
                for (const [uuid, material] of Object.entries(index.materials)) {
                    this.materialsCache.set(uuid, material);
                }
                logger.info(`[ReadingMaterialStorage] 加载了 ${this.materialsCache.size} 个阅读材料`);
            }
            else {
                // 创建空索引
                await this.saveMaterialsIndex();
                logger.info('[ReadingMaterialStorage] 创建了新的材料索引');
            }
        }
        catch (error) {
            logger.error('[ReadingMaterialStorage] 加载材料索引失败:', error);
            // 创建空缓存
            this.materialsCache.clear();
        }
    }
    /**
     * 保存材料索引
     */
    async saveMaterialsIndex() {
        const adapter = this.app.vault.adapter;
        const storagePaths = this.storagePaths;
        const index = {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            materials: Object.fromEntries(this.materialsCache)
        };
        try {
            await adapter.write(storagePaths.MATERIALS_INDEX, JSON.stringify(index));
            logger.debug('[ReadingMaterialStorage] 材料索引已保存');
        }
        catch (error) {
            logger.error('[ReadingMaterialStorage] 保存材料索引失败:', error);
            throw error;
        }
    }
    // ===== 材料 CRUD 操作 =====
    /**
     * 获取所有阅读材料
     */
    getAllMaterials() {
        return Array.from(this.materialsCache.values());
    }
    /**
     * 通过UUID获取阅读材料
     */
    getMaterialById(uuid) {
        return this.materialsCache.get(uuid) || null;
    }
    /**
     * 通过文件路径获取阅读材料
     */
    getMaterialByPath(filePath) {
        for (const material of this.materialsCache.values()) {
            if (material.filePath === filePath) {
                return material;
            }
        }
        return null;
    }
    /**
     * 保存阅读材料
     */
    async saveMaterial(material) {
        material.modified = new Date().toISOString();
        this.materialsCache.set(material.uuid, material);
        await this.saveMaterialsIndex();
        logger.debug(`[ReadingMaterialStorage] 保存材料: ${material.uuid}`);
    }
    /**
     * 删除阅读材料
     */
    async deleteMaterial(uuid) {
        const deleted = this.materialsCache.delete(uuid);
        if (deleted) {
            await this.saveMaterialsIndex();
            // 删除相关会话记录
            await this.deleteSessionsForMaterial(uuid);
            logger.debug(`[ReadingMaterialStorage] 删除材料: ${uuid}`);
        }
        return deleted;
    }
    /**
     * 批量保存阅读材料
     */
    async saveMaterials(materials) {
        const now = new Date().toISOString();
        for (const material of materials) {
            material.modified = now;
            this.materialsCache.set(material.uuid, material);
        }
        await this.saveMaterialsIndex();
        logger.debug(`[ReadingMaterialStorage] 批量保存 ${materials.length} 个材料`);
    }
    // ===== 会话记录操作 =====
    /**
     * 获取材料的会话记录文件路径
     */
    getSessionsFilePath(materialId) {
        return `${this.storagePaths.SESSIONS_DIR}/${materialId}.json`;
    }
    /**
     * 获取材料的所有会话记录
     */
    async getSessionsForMaterial(materialId) {
        const adapter = this.app.vault.adapter;
        const filePath = this.getSessionsFilePath(materialId);
        try {
            const exists = await adapter.exists(filePath);
            if (!exists) {
                return [];
            }
            const content = await adapter.read(filePath);
            const data = JSON.parse(content);
            return data.sessions || [];
        }
        catch (error) {
            logger.error(`[ReadingMaterialStorage] 加载会话记录失败: ${materialId}`, error);
            return [];
        }
    }
    /**
     * 保存会话记录
     */
    async saveSession(session) {
        const adapter = this.app.vault.adapter;
        const filePath = this.getSessionsFilePath(session.materialId);
        try {
            // 加载现有会话
            const sessions = await this.getSessionsForMaterial(session.materialId);
            // 添加或更新会话
            const existingIndex = sessions.findIndex(s => s.uuid === session.uuid);
            if (existingIndex >= 0) {
                sessions[existingIndex] = session;
            }
            else {
                sessions.push(session);
            }
            // 保存
            await adapter.write(filePath, JSON.stringify({ sessions }));
            logger.debug(`[ReadingMaterialStorage] 保存会话: ${session.uuid}`);
        }
        catch (error) {
            logger.error(`[ReadingMaterialStorage] 保存会话失败: ${session.uuid}`, error);
            throw error;
        }
    }
    /**
     * 删除材料的所有会话记录
     */
    async deleteSessionsForMaterial(materialId) {
        const adapter = this.app.vault.adapter;
        const filePath = this.getSessionsFilePath(materialId);
        try {
            const exists = await adapter.exists(filePath);
            if (exists) {
                await adapter.remove(filePath);
                logger.debug(`[ReadingMaterialStorage] 删除会话记录: ${materialId}`);
            }
        }
        catch (error) {
            logger.warn(`[ReadingMaterialStorage] 删除会话记录失败: ${materialId}`, error);
        }
    }
    // ===== 锚点缓存操作（可选优化）=====
    /**
     * 获取锚点缓存
     */
    async getAnchorsCache() {
        const adapter = this.app.vault.adapter;
        try {
            const exists = await adapter.exists(this.storagePaths.ANCHORS_CACHE);
            if (!exists) {
                return null;
            }
            const content = await adapter.read(this.storagePaths.ANCHORS_CACHE);
            return JSON.parse(content);
        }
        catch (error) {
            logger.warn('[ReadingMaterialStorage] 加载锚点缓存失败:', error);
            return null;
        }
    }
    /**
     * 更新锚点缓存
     */
    async updateAnchorsCache(filePath, anchors) {
        const adapter = this.app.vault.adapter;
        try {
            let cache = await this.getAnchorsCache();
            if (!cache) {
                cache = {
                    version: '1.0.0',
                    lastUpdated: new Date().toISOString(),
                    anchors: {}
                };
            }
            cache.anchors[filePath] = anchors;
            cache.lastUpdated = new Date().toISOString();
            await adapter.write(this.storagePaths.ANCHORS_CACHE, JSON.stringify(cache));
        }
        catch (error) {
            logger.warn('[ReadingMaterialStorage] 更新锚点缓存失败:', error);
        }
    }
    /**
     * 获取文件的缓存锚点
     */
    async getCachedAnchors(filePath) {
        const cache = await this.getAnchorsCache();
        return cache?.anchors[filePath] || null;
    }
    /**
     * 清除锚点缓存
     */
    async clearAnchorsCache() {
        const adapter = this.app.vault.adapter;
        try {
            const exists = await adapter.exists(this.storagePaths.ANCHORS_CACHE);
            if (exists) {
                await adapter.remove(this.storagePaths.ANCHORS_CACHE);
                logger.debug('[ReadingMaterialStorage] 锚点缓存已清除');
            }
        }
        catch (error) {
            logger.warn('[ReadingMaterialStorage] 清除锚点缓存失败:', error);
        }
    }
    // ===== 查询方法 =====
    /**
     * 按分类获取材料
     */
    getMaterialsByCategory(category) {
        return Array.from(this.materialsCache.values())
            .filter(m => m.category === category);
    }
    /**
     * 获取今日到期的材料
     */
    getTodayDueMaterials() {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return Array.from(this.materialsCache.values())
            .filter(m => {
            if (!m.fsrs?.due)
                return false;
            const dueDate = new Date(m.fsrs.due);
            return dueDate <= today;
        })
            .sort((a, b) => {
            // 按优先级排序
            return (b.priority || 0) - (a.priority || 0);
        });
    }
    /**
     * 获取指定日期范围的材料
     */
    async getMaterialsInDateRange(startDate, endDate) {
        return Array.from(this.materialsCache.values())
            .filter(m => {
            if (!m.fsrs?.due)
                return false;
            const dueDate = new Date(m.fsrs.due);
            return dueDate >= startDate && dueDate <= endDate;
        });
    }
    /**
     * 获取最近访问的材料
     */
    getRecentMaterials(limit = 5) {
        return Array.from(this.materialsCache.values())
            .filter(m => m.lastAccessed)
            .sort((a, b) => {
            const dateA = new Date(a.lastAccessed).getTime();
            const dateB = new Date(b.lastAccessed).getTime();
            return dateB - dateA;
        })
            .slice(0, limit);
    }
    /**
     * 获取材料统计
     */
    getStatistics() {
        const materials = Array.from(this.materialsCache.values());
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const byCategory = {};
        let totalProgress = 0;
        let todayDue = 0;
        for (const material of materials) {
            // 按分类统计
            byCategory[material.category] = (byCategory[material.category] || 0) + 1;
            // 进度统计
            totalProgress += material.progress.percentage;
            // 今日到期
            if (material.fsrs?.due) {
                const dueDate = new Date(material.fsrs.due);
                if (dueDate <= today) {
                    todayDue++;
                }
            }
        }
        return {
            total: materials.length,
            byCategory,
            todayDue,
            averageProgress: materials.length > 0 ? totalProgress / materials.length : 0
        };
    }
}
/**
 * 创建阅读材料存储实例
 */
export function createReadingMaterialStorage(app) {
    return new ReadingMaterialStorage(app);
}
