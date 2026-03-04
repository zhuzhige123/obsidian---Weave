/**
 * 增量阅读文件化块生成服务
 *
 * 负责将导入的阅读材料拆分为独立的 MD 文件：
 * - 源文件副本（IR/raw/）：只读权威输入
 * - 索引文件（IR/sources/）：文章级容器，包含块清单
 * - 块文件（IR/chunks/）：每个内容块一个文件，带 YAML frontmatter
 *
 * @module services/incremental-reading/IRChunkFileService
 * @version 5.0.0 - 文件化内容块方案
 */
import { TFile, TFolder, normalizePath } from 'obsidian';
import { resolveIRImportFolder } from '../../config/paths';
import { logger } from '../../utils/logger';
import { deriveFileTitleFromContent, splitByRules } from '../../utils/content-split-utils';
import { extractBodyContent } from '../../utils/yaml-utils';
import { sanitizeForSync } from '../../utils/sync-safe-filename';
import { generateSourceId, generateChunkId, createDefaultChunkFileYAML, createDefaultIndexFileYAML, createDefaultChunkFileData } from '../../types/ir-types';
/**
 * YAML frontmatter 工具函数
 */
function yamlStringify(obj) {
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            if (value.length === 0) {
                lines.push(`${key}: []`);
            }
            else {
                lines.push(`${key}:`);
                for (const item of value) {
                    lines.push(`  - ${item}`);
                }
            }
        }
        else if (typeof value === 'string') {
            // 如果字符串包含特殊字符，使用引号
            if (value.includes(':') || value.includes('#') || value.includes('\n')) {
                lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
            }
            else {
                lines.push(`${key}: ${value}`);
            }
        }
        else {
            lines.push(`${key}: ${value}`);
        }
    }
    return lines.join('\n');
}
/**
 * 规范化文件名（云同步安全）
 * 使用 sanitizeForSync 处理 emoji、全角标点、方括号等不兼容字符
 */
function sanitizeFileName(name, maxLength = 50) {
    return sanitizeForSync(name, maxLength);
}
export class IRChunkFileService {
    app;
    initialized = false;
    chunkRoot;
    constructor(app, chunkRoot) {
        this.app = app;
        const plugin = app?.plugins?.getPlugin?.('weave');
        const parentFolder = plugin?.settings?.weaveParentFolder;
        this.chunkRoot = normalizePath(resolveIRImportFolder(chunkRoot, parentFolder));
    }
    async getUniqueFolderPath(folderPath) {
        const adapter = this.app.vault.adapter;
        const normalized = normalizePath(folderPath);
        if (!await adapter.exists(normalized)) {
            return normalized;
        }
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) {
            return normalized;
        }
        const name = parts.pop();
        const parent = parts.join('/');
        for (let i = 2; i < 1000; i++) {
            const candidate = normalizePath(`${parent}/${name} (${i})`);
            if (!await adapter.exists(candidate)) {
                return candidate;
            }
        }
        return normalizePath(`${parent}/${name} (${Date.now()})`);
    }
    /**
     * 初始化目录结构
     */
    async ensureDirectories() {
        if (this.initialized)
            return;
        const dirs = [this.chunkRoot];
        for (const dir of dirs) {
            const normalizedPath = normalizePath(dir);
            const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (!folder) {
                try {
                    await this.app.vault.createFolder(normalizedPath);
                    logger.info(`[IRChunkFileService] 创建目录: ${normalizedPath}`);
                }
                catch (error) {
                    // 目录可能已存在（并发创建）
                    if (!(error instanceof Error && error.message.includes('already exists'))) {
                        logger.error(`[IRChunkFileService] 创建目录失败: ${normalizedPath}`, error);
                    }
                }
            }
        }
        this.initialized = true;
    }
    /**
     * 导入文件并生成文件化块
     *
     * @param sourceFile 源文件
     * @param options 导入选项
     * @returns 导入结果
     */
    async importFileAsChunks(sourceFile, options) {
        await this.ensureDirectories();
        const sourceId = generateSourceId();
        const tagGroup = options.tagGroup || 'default';
        const content = await this.app.vault.read(sourceFile);
        const bodyContent = extractBodyContent(content);
        const title = deriveFileTitleFromContent(content, sourceFile.basename);
        const sanitizedTitle = sanitizeFileName(title);
        // v5.1: 为每篇文章创建同名文件夹
        // v6.0: 如果有书籍文件夹名，先创建书籍文件夹
        let articleFolderPathBase;
        if (options.bookFolderName) {
            const bookFolder = normalizePath(`${this.chunkRoot}/${sanitizeFileName(options.bookFolderName)}`);
            await this.ensureFolder(bookFolder);
            articleFolderPathBase = normalizePath(`${bookFolder}/${sanitizedTitle}`);
        }
        else {
            articleFolderPathBase = normalizePath(`${this.chunkRoot}/${sanitizedTitle}`);
        }
        const articleFolderPath = await this.getUniqueFolderPath(articleFolderPathBase);
        await this.ensureFolder(articleFolderPath);
        // v5.2: 移除源文件副本创建，只保留原始文件路径引用
        // 用户 Obsidian 库中的原文件即为权威来源
        // 拆分内容
        const contentBlocks = splitByRules(bodyContent, options.splitConfig, { defaultTitle: sourceFile.basename });
        if (contentBlocks.length === 0) {
            throw new Error('拆分结果为空，请检查拆分配置');
        }
        const primaryDeckName = (options.deckNames?.[0] || '').trim() || '未分配';
        const deckIndexPathForBacklink = options.deckNames && options.deckNames.length > 0
            ? this.getDeckIndexPath(primaryDeckName)
            : '';
        if (deckIndexPathForBacklink) {
            try {
                await this.ensureDeckIndexCard(primaryDeckName);
            }
            catch (error) {
                logger.warn('[IRChunkFileService] 创建/更新牌组入口索引卡失败（将继续导入块文件）:', error);
            }
        }
        // 4. 生成块文件
        const chunkDataList = [];
        const chunkFilePaths = [];
        const chunkIds = [];
        for (let i = 0; i < contentBlocks.length; i++) {
            const block = contentBlocks[i];
            const chunkId = generateChunkId();
            chunkIds.push(chunkId);
            // 生成块文件（传入索引文件路径用于回链）
            const chunkFilePath = await this.createChunkFile(chunkId, sourceId, block, i, options.initialPriority, articleFolderPath, deckIndexPathForBacklink || undefined, options.deckTag, options.deckNames);
            chunkFilePaths.push(chunkFilePath);
            // 创建块调度数据 (v5.4: 添加 deckTag, v5.5: 添加 deckIds)
            const chunkData = createDefaultChunkFileData(chunkId, sourceId, chunkFilePath);
            chunkData.deckTag = options.deckTag || '#IR_deck_未分配';
            chunkData.meta.tagGroup = tagGroup;
            // v5.5: deckIds 将在调用方根据正式牌组ID设置，这里只设置 deckTag
            // 设置前后兄弟关系
            if (i > 0) {
                chunkData.meta.siblings.prev = chunkIds[i - 1];
            }
            chunkDataList.push(chunkData);
        }
        // 更新兄弟关系的 next 指针
        for (let i = 0; i < chunkDataList.length - 1; i++) {
            chunkDataList[i].meta.siblings.next = chunkDataList[i + 1].chunkId;
        }
        const indexFilePath = '';
        // 5. 构建源文件元数据（v5.2: 移除 rawFilePath，原文件路径即为来源）
        const sourceMeta = {
            sourceId,
            originalPath: sourceFile.path,
            rawFilePath: '', // v5.2: 不再创建副本，保留字段兼容性
            indexFilePath,
            chunkIds,
            title,
            tagGroup,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        logger.info(`[IRChunkFileService] 导入完成: ${title}, ${chunkIds.length} 个块文件`);
        return {
            sourceMeta,
            chunkDataList,
            indexFilePath,
            chunkFilePaths
        };
    }
    async importFileAsChunksFromBlocks(sourceFile, contentBlocks, options) {
        await this.ensureDirectories();
        const sourceId = generateSourceId();
        const tagGroup = options.tagGroup || 'default';
        const content = await this.app.vault.read(sourceFile);
        const title = deriveFileTitleFromContent(content, sourceFile.basename);
        const sanitizedTitle = sanitizeFileName(title);
        let articleFolderPathBase;
        if (options.bookFolderName) {
            const bookFolder = normalizePath(`${this.chunkRoot}/${sanitizeFileName(options.bookFolderName)}`);
            await this.ensureFolder(bookFolder);
            articleFolderPathBase = normalizePath(`${bookFolder}/${sanitizedTitle}`);
        }
        else {
            articleFolderPathBase = normalizePath(`${this.chunkRoot}/${sanitizedTitle}`);
        }
        const articleFolderPath = await this.getUniqueFolderPath(articleFolderPathBase);
        await this.ensureFolder(articleFolderPath);
        if (contentBlocks.length === 0) {
            throw new Error('拆分结果为空，请检查手动拆分标记');
        }
        const primaryDeckName = (options.deckNames?.[0] || '').trim() || '未分配';
        const deckIndexPathForBacklink = options.deckNames && options.deckNames.length > 0
            ? this.getDeckIndexPath(primaryDeckName)
            : '';
        if (deckIndexPathForBacklink) {
            try {
                await this.ensureDeckIndexCard(primaryDeckName);
            }
            catch (error) {
                logger.warn('[IRChunkFileService] 创建/更新牌组入口索引卡失败（将继续导入块文件）:', error);
            }
        }
        const chunkDataList = [];
        const chunkFilePaths = [];
        const chunkIds = [];
        for (let i = 0; i < contentBlocks.length; i++) {
            const block = contentBlocks[i];
            const chunkId = generateChunkId();
            chunkIds.push(chunkId);
            const chunkFilePath = await this.createChunkFile(chunkId, sourceId, block, i, options.initialPriority, articleFolderPath, deckIndexPathForBacklink || undefined, options.deckTag, options.deckNames);
            chunkFilePaths.push(chunkFilePath);
            const chunkData = createDefaultChunkFileData(chunkId, sourceId, chunkFilePath);
            chunkData.deckTag = options.deckTag || '#IR_deck_未分配';
            chunkData.meta.tagGroup = tagGroup;
            if (i > 0) {
                chunkData.meta.siblings.prev = chunkIds[i - 1];
            }
            chunkDataList.push(chunkData);
        }
        for (let i = 0; i < chunkDataList.length - 1; i++) {
            chunkDataList[i].meta.siblings.next = chunkDataList[i + 1].chunkId;
        }
        const indexFilePath = '';
        const sourceMeta = {
            sourceId,
            originalPath: sourceFile.path,
            rawFilePath: '',
            indexFilePath,
            chunkIds,
            title,
            tagGroup,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        logger.info(`[IRChunkFileService] 手动拆分导入完成: ${title}, ${chunkIds.length} 个块文件`);
        return {
            sourceMeta,
            chunkDataList,
            indexFilePath,
            chunkFilePaths
        };
    }
    /**
     * 复制源文件到 IR/raw/
     */
    async copyToRaw(sourceFile, sourceId, title) {
        const sanitizedTitle = sanitizeFileName(title);
        const fileName = `${sanitizedTitle}__IR-Raw__${sourceId}.md`;
        const rawFolder = normalizePath(`${this.chunkRoot}/raw`);
        await this.ensureFolder(rawFolder);
        const rawFilePath = normalizePath(`${rawFolder}/${fileName}`);
        const content = await this.app.vault.read(sourceFile);
        await this.app.vault.create(rawFilePath, content);
        logger.debug(`[IRChunkFileService] 创建源文件副本: ${rawFilePath}`);
        return rawFilePath;
    }
    /**
     * 确保文件夹存在
     */
    async ensureFolder(folderPath) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            try {
                await this.app.vault.createFolder(folderPath);
                logger.debug(`[IRChunkFileService] 创建文件夹: ${folderPath}`);
            }
            catch (error) {
                if (!(error instanceof Error && error.message.includes('already exists'))) {
                    throw error;
                }
            }
        }
    }
    /**
     * 创建块文件（v5.1: 支持自定义文件夹和索引回链）
     * v5.4: 添加 deckTag 参数用于牌组标签
     */
    async createChunkFile(chunkId, sourceId, block, order, initialPriority, articleFolderPath, indexFilePath, deckTag, deckNames) {
        // v5.1: 文件名不包含 ID，只用标题
        const sanitizedTitle = sanitizeFileName(block.title || `块_${order + 1}`, 80);
        const fileName = `${String(order + 1).padStart(2, '0')}_${sanitizedTitle}.md`;
        // v5.1: 使用文章文件夹路径
        const basePath = articleFolderPath || this.chunkRoot;
        const chunkFilePath = normalizePath(`${basePath}/${fileName}`);
        // 构建 YAML frontmatter (v5.4: 传入 deckTag)
        const yamlData = createDefaultChunkFileYAML(chunkId, sourceId, deckTag, deckNames);
        if (initialPriority !== undefined) {
            yamlData.priority_ui = initialPriority;
        }
        // v5.1: 构建索引回链（v5.3: 移除 emoji）
        let backLink = '';
        if (indexFilePath) {
            const indexName = indexFilePath.replace(/^.*\//, '').replace(/\.md$/, '');
            backLink = `\n> 来源: [[${indexName}]]\n`;
        }
        // 构建文件内容
        const yamlContent = yamlStringify(yamlData);
        const fileContent = `---\n${yamlContent}\n---\n${backLink}\n${block.content}`;
        await this.app.vault.create(chunkFilePath, fileContent);
        logger.debug(`[IRChunkFileService] 创建块文件: ${chunkFilePath}`);
        return chunkFilePath;
    }
    /**
     * 创建索引文件（v5.1: 在文章文件夹内创建）
     */
    async createIndexFileInFolder(sourceId, title, chunkIds, chunkFilePaths, contentBlocks, indexFilePath, deckNames) {
        // 构建 YAML frontmatter
        const yamlData = createDefaultIndexFileYAML(sourceId, title, deckNames);
        const yamlContent = yamlStringify(yamlData);
        // 构建块清单（双链格式）
        const chunkListLines = ['## 内容块清单\n'];
        for (let i = 0; i < chunkIds.length; i++) {
            const chunkPath = chunkFilePaths[i];
            const chunkTitle = contentBlocks[i]?.title || `块 ${i + 1}`;
            // 使用 Obsidian wiki 链接格式（只用文件名）
            const linkName = chunkPath.replace(/^.*\//, '').replace(/\.md$/, '');
            chunkListLines.push(`${i + 1}. [[${linkName}|${chunkTitle}]]`);
        }
        // 构建完整文件内容
        const fileContent = [
            '---',
            yamlContent,
            '---',
            '',
            `# ${title}`,
            '',
            `> 共 ${chunkIds.length} 个内容块`,
            '',
            chunkListLines.join('\n'),
            ''
        ].join('\n');
        await this.app.vault.create(indexFilePath, fileContent);
        logger.debug(`[IRChunkFileService] 创建索引文件: ${indexFilePath}`);
    }
    /**
     * 从块文件读取 YAML 元数据
     */
    async readChunkFileYAML(filePath) {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile))
                return null;
            const content = await this.app.vault.read(file);
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!yamlMatch)
                return null;
            // 简单 YAML 解析
            const yamlContent = yamlMatch[1];
            const result = {};
            const lines = yamlContent.split('\n');
            let currentKey = null;
            let currentArray = null;
            for (const line of lines) {
                if (line.startsWith('  - ') && currentKey && currentArray !== null) {
                    currentArray.push(line.substring(4).trim());
                }
                else {
                    if (currentKey && currentArray !== null) {
                        result[currentKey] = currentArray;
                        currentArray = null;
                    }
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        const key = line.substring(0, colonIndex).trim();
                        const value = line.substring(colonIndex + 1).trim();
                        if (value === '' || value === '[]') {
                            currentKey = key;
                            currentArray = [];
                        }
                        else {
                            result[key] = this.parseYAMLValue(value);
                            currentKey = null;
                        }
                    }
                }
            }
            if (currentKey && currentArray !== null) {
                result[currentKey] = currentArray;
            }
            return result;
        }
        catch (error) {
            logger.error(`[IRChunkFileService] 读取块文件 YAML 失败: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 更新块文件 YAML 中的指定字段
     */
    async updateChunkFileYAML(filePath, updates) {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile))
                return false;
            const content = await this.app.vault.read(file);
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!yamlMatch)
                return false;
            // 读取现有 YAML
            const existingYAML = await this.readChunkFileYAML(filePath);
            if (!existingYAML)
                return false;
            // 合并更新
            const updatedYAML = { ...existingYAML, ...updates };
            const newYamlContent = yamlStringify(updatedYAML);
            // 替换 YAML 部分
            const restContent = content.substring(yamlMatch[0].length);
            const newContent = `---\n${newYamlContent}\n---${restContent}`;
            await this.app.vault.modify(file, newContent);
            return true;
        }
        catch (error) {
            logger.error(`[IRChunkFileService] 更新块文件 YAML 失败: ${filePath}`, error);
            return false;
        }
    }
    /**
     * 将块状态标记为完成
     */
    async markChunkAsDone(filePath) {
        return this.updateChunkFileYAML(filePath, { status: 'done' });
    }
    /**
     * 解析 YAML 值
     */
    parseYAMLValue(value) {
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1);
        }
        // 数字
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return parseFloat(value);
        }
        // 布尔
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        return value;
    }
    /**
     * 检查块文件是否处于完成状态
     */
    async isChunkDone(filePath) {
        const yaml = await this.readChunkFileYAML(filePath);
        return yaml?.status === 'done' || yaml?.status === 'archived';
    }
    /**
     * 获取所有活跃状态的块文件路径
     */
    async getActiveChunkFiles() {
        const chunksFolder = this.app.vault.getAbstractFileByPath(this.chunkRoot);
        if (!(chunksFolder instanceof TFolder))
            return [];
        const activeFiles = [];
        const walk = async (folder) => {
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    await walk(child);
                    continue;
                }
                if (child instanceof TFile && child.extension === 'md') {
                    const yaml = await this.readChunkFileYAML(child.path);
                    if (yaml && (yaml.status === 'active' || yaml.status === 'processing')) {
                        activeFiles.push(child.path);
                    }
                }
            }
        };
        await walk(chunksFolder);
        return activeFiles;
    }
    /**
     * 总索引文件路径
     */
    get masterIndexPath() {
        return normalizePath(`${this.chunkRoot}/_总索引.md`);
    }
    getDeckIndexPath(deckName) {
        const safeName = sanitizeFileName(deckName, 80);
        return normalizePath(`${this.chunkRoot}/_牌组_${safeName}.md`);
    }
    normalizeDeckNameForTag(deckName) {
        return String(deckName || '')
            .trim()
            .replace(/[\s/\\#]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') || '未分配';
    }
    async ensureDeckIndexCard(deckName) {
        await this.ensureDirectories();
        const name = (deckName || '').trim() || '未分配';
        const deckIndexPath = this.getDeckIndexPath(name);
        const deckTagSegment = this.normalizeDeckNameForTag(name);
        const deckTag = `ir/deck/${deckTagSegment}`;
        const content = [
            '---',
            'weave_type: ir-deck-index',
            `title: ${name}`,
            `deck_name: "${name.replace(/"/g, '\\"')}"`,
            `deck_tag: "${deckTag}"`,
            'tags:',
            '  - ir/deck',
            `  - ir/deck/${deckTagSegment}`,
            '---',
            '',
            `# ${name}`,
            '',
            '## 内容块',
            '```dataview',
            'TABLE',
            '  status as status,',
            '  priority_ui as priority_ui,',
            '  deck_names as deck_names,',
            '  file.tags as tags,',
            '  length(file.outlinks) as outlinks,',
            '  length(file.inlinks) as inlinks,',
            '  filter(file.outlinks, (l) => regexmatch("\\.(pdf|png|jpg|jpeg|gif|webp|svg|mp3|mp4|mkv|webm|zip|rar|7z)$", lower(string(l)))) as attachments,',
            '  slice(file.outlinks, 0, 20) as outlink_list,',
            '  slice(file.inlinks, 0, 20) as inlink_list',
            `FROM "${this.chunkRoot}"`,
            'WHERE weave_type = "ir-chunk" AND (contains(tags, this.deck_tag) OR contains(deck_names, this.deck_name))',
            'SORT file.name ASC',
            '```',
            ''
        ].join('\n');
        const existing = this.app.vault.getAbstractFileByPath(deckIndexPath);
        if (existing instanceof TFile) {
            const current = await this.app.vault.read(existing);
            if (current !== content) {
                await this.app.vault.modify(existing, content);
            }
        }
        else {
            await this.app.vault.create(deckIndexPath, content);
        }
        await this.ensureDeckInMasterIndex(name, deckIndexPath);
        return deckIndexPath;
    }
    async renameDeckIndexCard(oldName, newName) {
        await this.ensureDirectories();
        const oldPath = this.getDeckIndexPath((oldName || '').trim() || '未分配');
        const newPath = this.getDeckIndexPath((newName || '').trim() || '未分配');
        if (oldPath === newPath) {
            return this.ensureDeckIndexCard(newName);
        }
        const oldFile = this.app.vault.getAbstractFileByPath(oldPath);
        const newFile = this.app.vault.getAbstractFileByPath(newPath);
        if (oldFile instanceof TFile && !(newFile instanceof TFile)) {
            await this.app.vault.rename(oldFile, newPath);
        }
        // 尝试同步更新总索引中的链接文本（避免残留旧牌组入口）
        try {
            const masterIndexPath = this.masterIndexPath;
            const masterFile = this.app.vault.getAbstractFileByPath(masterIndexPath);
            if (masterFile instanceof TFile) {
                let content = await this.app.vault.read(masterFile);
                const oldIndexName = oldPath.replace(/^.*\//, '').replace(/\.md$/, '');
                const newIndexName = newPath.replace(/^.*\//, '').replace(/\.md$/, '');
                const oldLink = `- [[${oldIndexName}|${(oldName || '').trim() || '未分配'}]]`;
                const newLink = `- [[${newIndexName}|${(newName || '').trim() || '未分配'}]]`;
                if (content.includes(oldLink)) {
                    content = content.replace(oldLink, newLink);
                    await this.app.vault.modify(masterFile, content);
                }
            }
        }
        catch (error) {
            logger.warn('[IRChunkFileService] 更新总索引中的牌组入口链接失败:', error);
        }
        return this.ensureDeckIndexCard(newName);
    }
    async ensureDeckInMasterIndex(deckName, deckIndexPath) {
        const masterIndexPath = this.masterIndexPath;
        const existingFile = this.app.vault.getAbstractFileByPath(masterIndexPath);
        let existingContent = '';
        if (existingFile instanceof TFile) {
            existingContent = await this.app.vault.read(existingFile);
        }
        const deckIndexName = deckIndexPath.replace(/^.*\//, '').replace(/\.md$/, '');
        const deckLink = `- [[${deckIndexName}|${deckName}]]`;
        if (existingContent && existingContent.includes(deckLink)) {
            return;
        }
        if (!existingContent) {
            existingContent = [
                '---',
                'weave_type: ir-master-index',
                `title: 增量阅读总索引`,
                `created: ${new Date().toISOString().split('T')[0]}`,
                'tags:',
                '  - ir/master-index',
                '---',
                '',
                '# 增量阅读总索引',
                '',
                '## 牌组',
                '',
                deckLink,
                ''
            ].join('\n');
            await this.app.vault.create(masterIndexPath, existingContent);
            return;
        }
        if (existingContent.includes('## 牌组')) {
            const insertAt = existingContent.indexOf('## 牌组') + '## 牌组'.length;
            existingContent = existingContent.substring(0, insertAt) + `\n\n${deckLink}` + existingContent.substring(insertAt);
        }
        else {
            existingContent += `\n\n## 牌组\n\n${deckLink}\n`;
        }
        if (existingFile instanceof TFile) {
            await this.app.vault.modify(existingFile, existingContent);
        }
        else {
            await this.app.vault.create(masterIndexPath, existingContent);
        }
    }
    /**
     * 更新总索引文件
     * v5.3: 导入新书时自动追加到总索引
     *
     * @param bookTitle 书籍标题
     * @param bookIndexPath 书籍索引文件路径
     * @param chapterEntries 章节条目列表 [{title, indexPath, chunkEntries}]
     * @param category 分类名称（可选，默认"未分类"）
     */
    async updateMasterIndex(bookTitle, bookIndexPath, chapterEntries, category = '未分类') {
        const masterIndexPath = this.masterIndexPath;
        // 检查总索引是否存在
        let existingContent = '';
        const existingFile = this.app.vault.getAbstractFileByPath(masterIndexPath);
        if (existingFile instanceof TFile) {
            existingContent = await this.app.vault.read(existingFile);
        }
        // 构建书籍条目（含章节和内容块的缩进结构）
        const bookIndexName = bookIndexPath.replace(/^.*\//, '').replace(/\.md$/, '');
        const bookEntry = this.buildBookEntry(bookTitle, bookIndexName, chapterEntries);
        // 查找或创建分类
        const categoryHeader = `## [[_分类_${category}|${category}]]`;
        if (existingContent.includes(categoryHeader)) {
            // 分类已存在，在分类下追加书籍
            const categoryIndex = existingContent.indexOf(categoryHeader);
            const nextCategoryMatch = existingContent.substring(categoryIndex + categoryHeader.length).match(/\n## \[\[/);
            let insertPosition;
            if (nextCategoryMatch && nextCategoryMatch.index !== undefined) {
                // 在下一个分类之前插入
                insertPosition = categoryIndex + categoryHeader.length + nextCategoryMatch.index;
            }
            else {
                // 在文件末尾插入
                insertPosition = existingContent.length;
            }
            existingContent = existingContent.substring(0, insertPosition) +
                '\n' + bookEntry +
                existingContent.substring(insertPosition);
        }
        else if (existingContent) {
            // 分类不存在，在文件末尾添加新分类
            existingContent += `\n\n${categoryHeader}\n\n${bookEntry}`;
        }
        else {
            // 总索引不存在，创建新文件
            existingContent = [
                '---',
                'weave_type: ir-master-index',
                `title: 增量阅读总索引`,
                `created: ${new Date().toISOString().split('T')[0]}`,
                '---',
                '',
                '# 增量阅读总索引',
                '',
                categoryHeader,
                '',
                bookEntry
            ].join('\n');
        }
        // 写入文件
        if (existingFile instanceof TFile) {
            await this.app.vault.modify(existingFile, existingContent);
        }
        else {
            await this.app.vault.create(masterIndexPath, existingContent);
        }
        logger.info(`[IRChunkFileService] 更新总索引: ${bookTitle} -> ${category}`);
    }
    /**
     * 构建书籍条目（含层级结构）
     */
    buildBookEntry(bookTitle, bookIndexName, chapterEntries) {
        const lines = [];
        // 书籍行
        lines.push(`- [[${bookIndexName}|${bookTitle}]]`);
        // 章节行（缩进 4 空格）
        for (let i = 0; i < chapterEntries.length; i++) {
            const chapter = chapterEntries[i];
            const chapterIndexName = chapter.indexPath.replace(/^.*\//, '').replace(/\.md$/, '');
            lines.push(`    ${i + 1}. [[${chapterIndexName}|${chapter.title}]]`);
            // 内容块行（缩进 8 空格）
            for (const chunk of chapter.chunkEntries) {
                const chunkFileName = chunk.filePath.replace(/^.*\//, '').replace(/\.md$/, '');
                lines.push(`        - [[${chunkFileName}|${chunk.title}]]`);
            }
        }
        return lines.join('\n');
    }
    /**
     * 创建分类文件（可选）
     */
    async ensureCategoryFile(category) {
        const categoryPath = normalizePath(`${this.chunkRoot}/_分类_${sanitizeFileName(category)}.md`);
        const existingFile = this.app.vault.getAbstractFileByPath(categoryPath);
        if (existingFile instanceof TFile) {
            return categoryPath;
        }
        const content = [
            '---',
            'weave_type: ir-category-index',
            `title: ${category}`,
            'parent: "[[_总索引]]"',
            '---',
            '',
            `# ${category}`,
            '',
            '> 此分类下的书籍将自动列在总索引中',
            ''
        ].join('\n');
        await this.app.vault.create(categoryPath, content);
        logger.debug(`[IRChunkFileService] 创建分类文件: ${categoryPath}`);
        return categoryPath;
    }
}
