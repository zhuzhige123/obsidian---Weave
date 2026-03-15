/**
 * 阅读材料管理服务
 *
 * 负责阅读材料的创建、分类管理和FSRS调度
 *
 * @module services/incremental-reading/ReadingMaterialManager
 * @version 1.0.0
 */
import { TFile as TFileClass } from 'obsidian';
import { ReadingCategory as Category } from '../../types/incremental-reading-types';
import { logger } from '../../utils/logger';
import { countWords, estimateReadingTime, generateReadingUUID } from '../../utils/reading-utils';
import { DirectoryUtils } from '../../utils/directory-utils';
import { resolveIRImportFolder } from '../../config/paths';
/**
 * 阅读材料管理器
 */
export class ReadingMaterialManager {
    app;
    storage;
    yamlManager;
    anchorManager;
    constructor(app, storage, yamlManager) {
        this.app = app;
        this.storage = storage;
        this.yamlManager = yamlManager;
    }
    async isIRFile(file) {
        try {
            const cache = this.app.metadataCache.getFileCache(file);
            const fmType = cache?.frontmatter?.weave_type;
            if (typeof fmType === 'string' && fmType.startsWith('ir-')) {
                return true;
            }
        }
        catch {
            // ignore
        }
        if (file.extension !== 'md') {
            return false;
        }
        try {
            const content = await this.app.vault.read(file);
            const match = content.match(/\bweave_type\s*:\s*([^\n\r]+)/);
            if (match?.[1]) {
                const t = match[1].trim().replace(/^['"]|['"]$/g, '');
                return t.startsWith('ir-');
            }
        }
        catch {
            // ignore
        }
        return false;
    }
    async assertNotIRFile(file, action) {
        if (await this.isIRFile(file)) {
            throw new Error(`${action} 不支持 IR 文件（chunk/index）。请使用增量阅读导入/文件化块流程。`);
        }
    }
    /**
     * 设置锚点管理器（避免循环依赖）
     */
    setAnchorManager(anchorManager) {
        this.anchorManager = anchorManager;
    }
    // ===== 文件复制 =====
    /**
     * 复制文件到目标文件夹
     * @param sourceFile 源文件
     * @param targetFolder 目标文件夹路径
     * @returns 复制后的文件
     */
    async copyFileToImportFolder(sourceFile, targetFolder) {
        logger.info(`[ReadingMaterialManager] copyFileToImportFolder 开始执行:`);
        logger.info(`  - 源文件: ${sourceFile.path}`);
        logger.info(`  - 目标文件夹: ${targetFolder}`);
        const adapter = this.app.vault.adapter;
        // 确保目标文件夹存在
        logger.info(`[ReadingMaterialManager] 确保目标文件夹存在...`);
        await DirectoryUtils.ensureDirRecursive(adapter, targetFolder);
        logger.info(`[ReadingMaterialManager] 目标文件夹已确保存在`);
        // 生成目标文件路径（处理重名）
        const targetPath = await this.generateUniqueFilePath(targetFolder, sourceFile.basename, sourceFile.extension);
        logger.info(`[ReadingMaterialManager] 目标路径: ${targetPath}`);
        let newFile;
        if (sourceFile.extension === 'md') {
            logger.info(`[ReadingMaterialManager] 读取源文件内容...`);
            const content = await this.app.vault.read(sourceFile);
            logger.info(`[ReadingMaterialManager] 源文件内容长度: ${content.length} 字符`);
            logger.info(`[ReadingMaterialManager] 创建新文件...`);
            newFile = await this.app.vault.create(targetPath, content);
        }
        else {
            logger.info(`[ReadingMaterialManager] 读取源文件内容（二进制）...`);
            const content = await this.app.vault.readBinary(sourceFile);
            logger.info(`[ReadingMaterialManager] 源文件内容长度: ${content.byteLength} bytes`);
            logger.info(`[ReadingMaterialManager] 创建新文件（二进制）...`);
            newFile = await this.app.vault.createBinary(targetPath, content);
        }
        logger.info(`[ReadingMaterialManager] ✅ 文件已复制: ${sourceFile.path} -> ${newFile.path}`);
        return newFile;
    }
    /**
     * 生成唯一的文件路径（避免重名）
     */
    async generateUniqueFilePath(folderPath, basename, extension) {
        const adapter = this.app.vault.adapter;
        let targetPath = `${folderPath}/${basename}.${extension}`;
        let counter = 1;
        // 检查文件是否已存在，如存在则添加后缀
        while (await adapter.exists(targetPath)) {
            targetPath = `${folderPath}/${basename}-${counter}.${extension}`;
            counter++;
        }
        return targetPath;
    }
    // ===== 材料创建 =====
    getDefaultImportFolderFromPluginSettings() {
        try {
            const plugin = this.app?.plugins?.getPlugin?.('weave');
            const importFolder = plugin?.settings?.incrementalReading?.importFolder;
            const parentFolder = plugin?.settings?.weaveParentFolder;
            return resolveIRImportFolder(importFolder, parentFolder);
        }
        catch {
            return resolveIRImportFolder();
        }
    }
    /**
     * 获取导入文件夹路径
     * 优先使用选项中的路径，否则使用默认路径
     */
    getImportFolder(options) {
        return options.importFolder || this.getDefaultImportFolderFromPluginSettings();
    }
    /**
     * 检查文件是否已在导入文件夹中
     */
    isInImportFolder(filePath, importFolder) {
        return filePath.startsWith(importFolder + '/');
    }
    /**
     * 为文件创建阅读材料
     * 自动初始化FSRS参数并更新YAML frontmatter
     *
     * @param file 源文件
     * @param options 创建选项（包含是否复制文件）
     */
    async createMaterial(file, options = {}) {
        await this.assertNotIRFile(file, 'createMaterial');
        const now = new Date().toISOString();
        const uuid = generateReadingUUID();
        // 默认复制文件到导入文件夹
        // 但 md 文件始终直接使用源文档，不复制副本
        const shouldCopy = file.extension === 'md'
            ? false
            : options.copyToImportFolder !== false;
        const importFolder = this.getImportFolder(options);
        // 🔍 调试日志
        logger.info(`[ReadingMaterialManager] createMaterial 被调用:`);
        logger.info(`  - 源文件: ${file.path}`);
        logger.info(`  - shouldCopy: ${shouldCopy}`);
        logger.info(`  - importFolder: ${importFolder}`);
        logger.info(`  - options.copyToImportFolder: ${options.copyToImportFolder}`);
        // 决定使用哪个文件
        let targetFile = file;
        // 检查文件是否已在导入文件夹中
        const alreadyInFolder = this.isInImportFolder(file.path, importFolder);
        logger.info(`  - alreadyInFolder: ${alreadyInFolder}`);
        // 如果需要复制且文件不在导入文件夹中，则复制文件
        if (shouldCopy && !alreadyInFolder) {
            logger.info(`[ReadingMaterialManager] 开始复制文件...`);
            try {
                targetFile = await this.copyFileToImportFolder(file, importFolder);
                logger.info(`[ReadingMaterialManager] ✅ 已复制文件到导入文件夹: ${file.path} -> ${targetFile.path}`);
            }
            catch (error) {
                logger.error(`[ReadingMaterialManager] ❌ 复制文件失败，使用原文件: ${file.path}`, error);
                targetFile = file;
            }
        }
        else {
            logger.info(`[ReadingMaterialManager] 跳过复制: shouldCopy=${shouldCopy}, alreadyInFolder=${alreadyInFolder}`);
        }
        let totalWords = 0;
        if (targetFile.extension === 'md') {
            const content = await this.app.vault.read(targetFile);
            totalWords = countWords(content);
        }
        // 合并默认值和选项
        const category = options.category || Category.Later;
        const priority = options.priority ?? 50;
        // 创建材料
        const material = {
            uuid,
            filePath: targetFile.path,
            title: targetFile.basename,
            category,
            priority,
            priorityDecay: 0.5,
            lastAccessed: now,
            progress: {
                anchorHistory: [],
                percentage: 0,
                totalWords,
                readWords: 0,
                estimatedTimeRemaining: estimateReadingTime(totalWords)
            },
            extractedCards: [],
            tags: options.tags || [],
            created: now,
            modified: now,
            source: options.source || 'auto'
        };
        // 如果分类是"正在阅读"或"收藏"，初始化FSRS
        if (category === Category.Reading || category === Category.Favorite) {
            material.fsrs = this.initializeFSRS();
        }
        // 保存材料
        await this.storage.saveMaterial(material);
        // 更新文件的YAML frontmatter
        if (targetFile.extension === 'md') {
            await this.yamlManager.initializeReadingFields(targetFile, uuid, category, priority);
        }
        logger.info(`[ReadingMaterialManager] 创建阅读材料: ${uuid} for ${targetFile.path}`);
        return material;
    }
    /**
     * 通过文件获取或创建阅读材料
     * 优先使用YAML中的weave-reading-id，降级到文件路径匹配
     */
    async getOrCreateMaterial(file, options = {}) {
        await this.assertNotIRFile(file, 'getOrCreateMaterial');
        // 1. 尝试通过YAML ID获取
        const readingId = await this.yamlManager.getReadingId(file);
        if (readingId) {
            const material = await this.storage.getMaterialById(readingId);
            if (material) {
                return material;
            }
        }
        // 2. 尝试通过文件路径获取
        const materialByPath = await this.storage.getMaterialByPath(file.path);
        if (materialByPath) {
            return materialByPath;
        }
        // 3. 创建新材料
        return await this.createMaterial(file, options);
    }
    /**
     * 通过文件获取阅读材料（不创建）
     */
    async getMaterialByFile(file) {
        // 1. 尝试通过YAML ID获取
        const readingId = await this.yamlManager.getReadingId(file);
        if (readingId) {
            const material = await this.storage.getMaterialById(readingId);
            if (material) {
                return material;
            }
        }
        // 2. 降级：通过文件路径获取
        return await this.storage.getMaterialByPath(file.path);
    }
    // ===== 分类管理 =====
    /**
     * 移动材料到新分类
     * 处理FSRS调度的激活/停用
     */
    async changeCategory(materialId, newCategory) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return {
                success: false,
                oldCategory: Category.Later,
                newCategory,
                fsrsActive: false,
                error: '材料不存在'
            };
        }
        const oldCategory = material.category;
        // 如果分类没变，直接返回
        if (oldCategory === newCategory) {
            return {
                success: true,
                oldCategory,
                newCategory,
                fsrsActive: this.isFSRSActive(newCategory)
            };
        }
        // 更新分类
        material.category = newCategory;
        material.modified = new Date().toISOString();
        // 处理FSRS调度
        const fsrsActive = this.isFSRSActive(newCategory);
        if (fsrsActive && !material.fsrs) {
            // 激活FSRS
            material.fsrs = this.initializeFSRS();
            logger.debug(`[ReadingMaterialManager] 激活FSRS调度: ${materialId}`);
        }
        else if (!fsrsActive && material.fsrs) {
            // 停用FSRS（保留数据但不再调度）
            logger.debug(`[ReadingMaterialManager] 停用FSRS调度: ${materialId}`);
        }
        // 保存更新
        await this.storage.saveMaterial(material);
        // 更新YAML frontmatter
        const file = this.app.vault.getAbstractFileByPath(material.filePath);
        if (file instanceof this.app.vault.adapter.constructor) {
            // 文件存在，更新YAML
            try {
                const tFile = file;
                await this.yamlManager.updateCategory(tFile, newCategory);
            }
            catch (error) {
                logger.warn(`[ReadingMaterialManager] 更新YAML失败: ${material.filePath}`, error);
            }
        }
        logger.info(`[ReadingMaterialManager] 分类变更: ${materialId} ${oldCategory} -> ${newCategory}`);
        return {
            success: true,
            oldCategory,
            newCategory,
            fsrsActive
        };
    }
    /**
     * 判断分类是否激活FSRS调度
     */
    isFSRSActive(category) {
        return category === Category.Reading || category === Category.Favorite;
    }
    // ===== 优先级管理 =====
    /**
     * 更新材料优先级
     */
    async updatePriority(materialId, priority) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return false;
        }
        // 限制优先级范围
        material.priority = Math.max(0, Math.min(100, priority));
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        // 更新YAML
        const file = this.app.vault.getAbstractFileByPath(material.filePath);
        if (file) {
            try {
                await this.yamlManager.updatePriority(file, material.priority);
            }
            catch (error) {
                logger.warn(`[ReadingMaterialManager] 更新优先级YAML失败: ${material.filePath}`, error);
            }
        }
        return true;
    }
    /**
     * 应用优先级衰减
     * 对非收藏分类的材料，根据未访问天数降低优先级
     */
    async applyPriorityDecay() {
        const materials = await this.storage.getAllMaterials();
        const now = new Date();
        let updatedCount = 0;
        for (const material of materials) {
            // 收藏分类不衰减
            if (material.category === Category.Favorite) {
                continue;
            }
            // 计算未访问天数
            const lastAccessed = new Date(material.lastAccessed);
            const daysSinceAccess = Math.floor((now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceAccess > 0) {
                // 计算衰减后的优先级
                const decay = daysSinceAccess * material.priorityDecay;
                const newPriority = Math.max(0, material.priority - decay);
                if (newPriority !== material.priority) {
                    material.priority = newPriority;
                    material.modified = now.toISOString();
                    await this.storage.saveMaterial(material);
                    updatedCount++;
                }
            }
        }
        if (updatedCount > 0) {
            logger.info(`[ReadingMaterialManager] 优先级衰减: 更新了 ${updatedCount} 个材料`);
        }
        return updatedCount;
    }
    // ===== FSRS 调度 =====
    /**
     * 初始化FSRS卡片数据
     */
    initializeFSRS() {
        const now = new Date().toISOString();
        return {
            due: now,
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0, // New
            lastReview: undefined,
            retrievability: 1
        };
    }
    /**
     * 完成阅读并更新FSRS调度
     * @param materialId 材料ID
     * @param rating 评分 (Again/Hard/Good/Easy)
     * @param fsrsScheduler FSRS调度器实例
     */
    async completeReading(materialId, rating, fsrsScheduler) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            logger.error(`[ReadingMaterialManager] 材料不存在: ${materialId}`);
            return null;
        }
        // 确保FSRS已初始化
        if (!material.fsrs) {
            material.fsrs = this.initializeFSRS();
        }
        // 调用FSRS算法计算下次复习时间
        const updatedFSRS = fsrsScheduler.schedule(material.fsrs, rating);
        material.fsrs = updatedFSRS;
        material.lastAccessed = new Date().toISOString();
        material.modified = material.lastAccessed;
        await this.storage.saveMaterial(material);
        logger.info(`[ReadingMaterialManager] 完成阅读: ${materialId}, 评分: ${rating}, 下次: ${updatedFSRS.due}`);
        return updatedFSRS;
    }
    /**
     * 手动调整下次复习日期
     */
    async setNextReviewDate(materialId, date) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return false;
        }
        if (!material.fsrs) {
            material.fsrs = this.initializeFSRS();
        }
        material.fsrs.due = date.toISOString();
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        logger.info(`[ReadingMaterialManager] 手动调整日期: ${materialId} -> ${date.toISOString()}`);
        return true;
    }
    // ===== 进度更新 =====
    /**
     * 更新阅读进度
     */
    async updateProgress(materialId, progress) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return false;
        }
        // 合并进度更新
        material.progress = {
            ...material.progress,
            ...progress
        };
        material.lastAccessed = new Date().toISOString();
        material.modified = material.lastAccessed;
        await this.storage.saveMaterial(material);
        return true;
    }
    /**
     * 刷新材料的进度（从文件重新计算）
     */
    async refreshProgress(materialId) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return null;
        }
        const file = this.app.vault.getAbstractFileByPath(material.filePath);
        if (!file || !(file instanceof this.app.vault.adapter.constructor)) {
            logger.warn(`[ReadingMaterialManager] 文件不存在: ${material.filePath}`);
            return null;
        }
        // 如果有锚点管理器，使用它来计算进度
        if (this.anchorManager) {
            const progress = await this.anchorManager.calculateProgress(file, material);
            material.progress = progress;
            material.modified = new Date().toISOString();
            await this.storage.saveMaterial(material);
            return progress;
        }
        return material.progress;
    }
    // ===== 卡片关联 =====
    /**
     * 添加提取的卡片
     */
    async addExtractedCard(materialId, cardId) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return false;
        }
        if (!material.extractedCards.includes(cardId)) {
            material.extractedCards.push(cardId);
            material.modified = new Date().toISOString();
            await this.storage.saveMaterial(material);
        }
        return true;
    }
    /**
     * 设置关联的阅读牌组
     */
    async setReadingDeck(materialId, deckId) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            return false;
        }
        material.readingDeckId = deckId;
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        return true;
    }
    // ===== 查询方法 =====
    /**
     * 获取今日到期的材料
     */
    getTodayDueMaterials() {
        return this.storage.getTodayDueMaterials();
    }
    /**
     * 获取指定分类的材料
     */
    getMaterialsByCategory(category) {
        return this.storage.getMaterialsByCategory(category);
    }
    /**
     * 获取最近访问的材料
     */
    getRecentMaterials(limit = 5) {
        return this.storage.getRecentMaterials(limit);
    }
    /**
     * 获取所有材料
     */
    getAllMaterials() {
        return this.storage.getAllMaterials();
    }
    // ===== 批量导入 =====
    /**
     * 批量导入阅读材料
     * 复制文件到目标文件夹，添加阅读标识和FSRS调度
     *
     * @param filePaths 文件路径列表
     * @param onProgress 进度回调
     * @param options 导入选项（包含目标文件夹设置）
     */
    async batchImportMaterials(filePaths, onProgress, options = {}) {
        const result = {
            success: 0,
            skipped: 0,
            errors: []
        };
        const total = filePaths.length;
        logger.info(`[ReadingMaterialManager] ========================================`);
        logger.info(`[ReadingMaterialManager] 开始批量导入 ${total} 个文件`);
        logger.info(`[ReadingMaterialManager] options: ${JSON.stringify(options)}`);
        // 获取目标文件夹（从选项或使用统一的 PATHS 配置）
        const targetFolder = options.importFolder || this.getDefaultImportFolderFromPluginSettings();
        logger.info(`[ReadingMaterialManager] 导入目标文件夹: ${targetFolder}`);
        logger.info(`[ReadingMaterialManager] ========================================`);
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            // 报告进度
            if (onProgress) {
                onProgress(i + 1, total);
            }
            try {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (!file || !(file instanceof TFileClass)) {
                    result.errors.push({ path: filePath, error: '文件不存在' });
                    continue;
                }
                try {
                    await this.assertNotIRFile(file, 'batchImportMaterials');
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : '不支持的文件类型';
                    result.errors.push({ path: filePath, error: msg });
                    continue;
                }
                // 检查源文件是否已导入（通过YAML ID，仅 md 可用）
                if (file.extension === 'md') {
                    const existingId = await this.yamlManager.getReadingId(file);
                    if (existingId) {
                        const existingMaterial = await this.storage.getMaterialById(existingId);
                        if (existingMaterial) {
                            result.skipped++;
                            logger.debug(`[ReadingMaterialManager] 跳过已导入文件: ${filePath}`);
                            continue;
                        }
                    }
                }
                // 检查是否已存在同名副本（通过目标路径）
                const potentialTargetPath = `${targetFolder}/${file.basename}.${file.extension}`;
                const existingByPath = await this.storage.getMaterialByPath(potentialTargetPath);
                if (existingByPath) {
                    // v2.1: 验证目标文件是否真实存在，如果不存在则清理残留记录
                    const targetFileExists = this.app.vault.getAbstractFileByPath(potentialTargetPath);
                    if (targetFileExists) {
                        result.skipped++;
                        logger.debug(`[ReadingMaterialManager] 跳过已存在副本: ${potentialTargetPath}`);
                        continue;
                    }
                    else {
                        // 目标文件已删除，清理残留的材料记录
                        logger.info(`[ReadingMaterialManager] 检测到残留记录（文件已删除），清理: ${existingByPath.uuid}`);
                        await this.storage.deleteMaterial(existingByPath.uuid);
                    }
                }
                // 创建阅读材料（会自动复制文件到导入文件夹）
                await this.createMaterial(file, {
                    category: options.category || Category.Later,
                    priority: options.priority ?? 50,
                    tags: options.tags || ['weave-incremental-reading'],
                    source: 'manual',
                    copyToImportFolder: file.extension === 'md' ? false : true,
                    importFolder: targetFolder
                });
                result.success++;
                logger.debug(`[ReadingMaterialManager] 成功导入: ${filePath}`);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : '未知错误';
                result.errors.push({ path: filePath, error: errorMsg });
                logger.error(`[ReadingMaterialManager] 导入失败: ${filePath}`, error);
            }
        }
        logger.info(`[ReadingMaterialManager] 批量导入完成: 成功 ${result.success}, 跳过 ${result.skipped}, 失败 ${result.errors.length}`);
        return result;
    }
    /**
     * 创建阅读点（PDF书签）
     * 不复制文件、不修改YAML，仅创建材料记录
     */
    async createReadingPoint(parentMaterialId, title, resumeLink, pdfFilePath) {
        const parent = await this.storage.getMaterialById(parentMaterialId);
        if (!parent) {
            logger.warn(`[ReadingMaterialManager] 父材料不存在: ${parentMaterialId}`);
            return null;
        }
        const now = new Date().toISOString();
        const uuid = generateReadingUUID();
        const material = {
            uuid,
            filePath: pdfFilePath,
            title,
            category: parent.category,
            resumeLink,
            parentMaterialId,
            priority: parent.priority,
            priorityDecay: 0.5,
            lastAccessed: now,
            progress: {
                anchorHistory: [],
                percentage: 0,
                totalWords: 0,
                readWords: 0,
                estimatedTimeRemaining: 0
            },
            extractedCards: [],
            tags: parent.tags ? [...parent.tags] : [],
            created: now,
            modified: now,
            source: 'manual',
            readingDeckId: parent.readingDeckId
        };
        await this.storage.saveMaterial(material);
        logger.info(`[ReadingMaterialManager] 创建阅读点: ${title} (parent: ${parentMaterialId})`);
        return material;
    }
    /**
     * 批量创建阅读点
     */
    async batchCreateReadingPoints(parentMaterialId, points, pdfFilePath) {
        const results = [];
        const idMap = new Map();
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const actualParent = pt.parentMaterialId || parentMaterialId;
            const material = await this.createReadingPoint(actualParent, pt.title, pt.resumeLink, pdfFilePath);
            if (material) {
                results.push(material);
                idMap.set(i, material.uuid);
            }
        }
        logger.info(`[ReadingMaterialManager] 批量创建阅读点: ${results.length}/${points.length}`);
        return results;
    }
    /**
     * 删除阅读材料
     * 从存储中移除材料记录，但不删除源文件
     * 如果删除的是父节点，子节点提升一级（不级联删除）
     */
    async removeMaterial(materialId) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            logger.warn(`[ReadingMaterialManager] 材料不存在: ${materialId}`);
            return false;
        }
        // 子节点提升：将所有子材料的 parentMaterialId 改为当前材料的 parentMaterialId
        const allMaterials = await this.storage.getAllMaterials();
        const children = allMaterials.filter(m => m.parentMaterialId === materialId);
        for (const child of children) {
            child.parentMaterialId = material.parentMaterialId;
            child.modified = new Date().toISOString();
            await this.storage.saveMaterial(child);
        }
        if (children.length > 0) {
            logger.info(`[ReadingMaterialManager] 子节点提升: ${children.length} 个子材料已提升`);
        }
        // 从存储中删除
        const success = await this.storage.deleteMaterial(materialId);
        if (success) {
            // 尝试清理YAML frontmatter中的阅读材料字段（仅非阅读点的md文件）
            if (!material.parentMaterialId) {
                const file = this.app.vault.getAbstractFileByPath(material.filePath);
                if (file) {
                    try {
                        await this.yamlManager.removeReadingFields(file);
                    }
                    catch (error) {
                        logger.warn(`[ReadingMaterialManager] 清理YAML失败: ${material.filePath}`, error);
                    }
                }
            }
            logger.info(`[ReadingMaterialManager] 已删除材料: ${material.title}`);
        }
        return success;
    }
    /**
     * 手动调整材料的复习日期
     * 覆盖 FSRS 自动调度
     */
    async rescheduleMaterial(materialId, newDate) {
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            logger.warn(`[ReadingMaterialManager] 材料不存在: ${materialId}`);
            return false;
        }
        // 更新 FSRS due 日期
        if (!material.fsrs) {
            material.fsrs = {
                due: newDate.toISOString(),
                stability: 1,
                difficulty: 0.3,
                elapsedDays: 0,
                scheduledDays: 0,
                reps: 0,
                lapses: 0,
                state: 0,
                lastReview: undefined,
                retrievability: 1
            };
        }
        else {
            material.fsrs.due = newDate.toISOString();
        }
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        logger.info(`[ReadingMaterialManager] 已调整材料日期: ${material.title} -> ${newDate.toISOString()}`);
        return true;
    }
    // ===== 摘录卡片管理 =====
    /**
     * 获取摘录卡片列表
     * @param deckId 可选的牌组ID筛选
     */
    async getExtractCards(deckId) {
        // 从存储中获取所有材料
        const materials = await this.storage.getAllMaterials();
        const extractCards = [];
        // 将材料转换为摘录卡片格式
        for (const material of materials) {
            // 如果指定了 deckId，只返回匹配的材料
            if (deckId && material.readingDeckId !== deckId) {
                continue;
            }
            // 🆕 从源文件加载完整内容
            let fullContent = material.title;
            try {
                const file = this.app.vault.getAbstractFileByPath(material.filePath);
                if (file instanceof TFileClass) {
                    const fileContent = await this.app.vault.cachedRead(file);
                    // 移除 YAML frontmatter（如果存在）
                    fullContent = this.stripYAMLFrontmatter(fileContent);
                }
            }
            catch (error) {
                logger.warn(`[ReadingMaterialManager] 读取文件内容失败: ${material.filePath}`, error);
                // 回退到标题
                fullContent = material.title;
            }
            // 将阅读材料转换为摘录卡片
            const extractCard = {
                id: material.uuid,
                type: this.mapCategoryToExtractType(material.category),
                content: fullContent,
                sourceFile: material.filePath,
                createdAt: new Date(material.created),
                updatedAt: new Date(material.modified),
                completed: material.progress.percentage >= 100,
                pinned: material.category === Category.Favorite,
                tags: material.tags || [],
                deckId: material.readingDeckId || 'default'
            };
            extractCards.push(extractCard);
        }
        logger.debug(`[ReadingMaterialManager] 获取摘录卡片: ${extractCards.length} 张`);
        return extractCards;
    }
    /**
     * 移除 YAML frontmatter
     * @param content 文件内容
     */
    stripYAMLFrontmatter(content) {
        // 匹配 YAML frontmatter: 以 --- 开头，以 --- 或 ... 结尾
        const yamlRegex = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/;
        return content.replace(yamlRegex, '').trim();
    }
    /**
     * 更新摘录卡片
     */
    async updateExtractCard(card) {
        const material = await this.storage.getMaterialById(card.id);
        if (!material) {
            logger.warn(`[ReadingMaterialManager] 摘录卡片对应的材料不存在: ${card.id}`);
            return false;
        }
        // 更新材料属性
        if (card.pinned) {
            material.category = Category.Favorite;
        }
        else if (card.completed) {
            material.category = Category.Archived;
        }
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        logger.debug(`[ReadingMaterialManager] 更新摘录卡片: ${card.id}`);
        return true;
    }
    /**
     * 更新摘录卡片类型
     */
    async updateExtractCardType(cardId, newType) {
        const material = await this.storage.getMaterialById(cardId);
        if (!material) {
            logger.warn(`[ReadingMaterialManager] 摘录卡片对应的材料不存在: ${cardId}`);
            return false;
        }
        // 将摘录类型映射回阅读分类
        material.category = this.mapExtractTypeToCategory(newType);
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        logger.debug(`[ReadingMaterialManager] 更新摘录卡片类型: ${cardId} -> ${newType}`);
        return true;
    }
    /**
     * 更新摘录卡片所属牌组
     */
    async updateExtractCardDeck(cardId, deckId) {
        const material = await this.storage.getMaterialById(cardId);
        if (!material) {
            logger.warn(`[ReadingMaterialManager] 摘录卡片对应的材料不存在: ${cardId}`);
            return false;
        }
        material.readingDeckId = deckId;
        material.modified = new Date().toISOString();
        await this.storage.saveMaterial(material);
        logger.debug(`[ReadingMaterialManager] 更新摘录卡片牌组: ${cardId} -> ${deckId}`);
        return true;
    }
    /**
     * 将摘录类型映射回阅读分类
     */
    mapExtractTypeToCategory(type) {
        switch (type) {
            case 'note':
                return Category.Later;
            case 'todo':
                return Category.Reading;
            case 'important':
                return Category.Favorite;
            case 'idea':
                return Category.Later;
            case 'capsule':
                return Category.Archived;
            default:
                return Category.Later;
        }
    }
    /**
     * 将阅读分类映射到摘录类型
     */
    mapCategoryToExtractType(category) {
        switch (category) {
            case Category.Later:
                return 'note';
            case Category.Reading:
                return 'todo';
            case Category.Favorite:
                return 'important';
            case Category.Archived:
                return 'capsule';
            default:
                return 'note';
        }
    }
    /**
     * 添加摘录卡片（从选中文本快捷键创建）
     * @param extractCard 摘录卡片数据
     */
    async addExtractCard(extractCard) {
        try {
            // 将摘录卡片转换为阅读材料格式
            const now = new Date().toISOString();
            const material = {
                uuid: extractCard.id,
                filePath: extractCard.sourceFile,
                title: extractCard.content.substring(0, 50) + (extractCard.content.length > 50 ? '...' : ''),
                category: this.mapExtractTypeToCategory(extractCard.type),
                priority: 50,
                priorityDecay: 0.5,
                lastAccessed: now,
                progress: {
                    anchorHistory: [],
                    percentage: 0,
                    totalWords: extractCard.content.length,
                    readWords: 0,
                    estimatedTimeRemaining: 0
                },
                extractedCards: [],
                tags: extractCard.tags || [],
                created: now,
                modified: now,
                source: 'manual',
                readingDeckId: extractCard.deckId
            };
            // 如果有块链接，记录到锚点历史
            if (extractCard.sourceBlock) {
                material.progress.anchorHistory.push({
                    anchorId: extractCard.sourceBlock,
                    position: 0,
                    timestamp: now,
                    wordCount: extractCard.content.length
                });
            }
            // 保存材料
            await this.storage.saveMaterial(material);
            logger.info(`[ReadingMaterialManager] 添加摘录卡片成功: ${extractCard.id}`);
            return true;
        }
        catch (error) {
            logger.error(`[ReadingMaterialManager] 添加摘录卡片失败:`, error);
            return false;
        }
    }
}
/**
 * 创建阅读材料管理器实例
 */
export function createReadingMaterialManager(app, storage, yamlManager) {
    return new ReadingMaterialManager(app, storage, yamlManager);
}
