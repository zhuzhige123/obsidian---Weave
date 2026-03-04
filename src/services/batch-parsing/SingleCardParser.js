import { logger } from '../../utils/logger';
import { FrontmatterManager } from './FrontmatterManager';
import { generateUUID } from '../../utils/helpers';
import { CardType } from '../../data/types';
/**
 * 单文件单卡片解析器
 */
export class SingleCardParser {
    app;
    frontmatterManager;
    constructor(app) {
        this.app = app;
        this.frontmatterManager = new FrontmatterManager(app);
    }
    /**
     * 解析单个文件为卡片
     * @param file Obsidian 文件对象
     * @param config 单文件单卡片配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果
     */
    async parseFile(file, config, targetDeckId) {
        try {
            // 1. 读取文件内容
            const content = await this.app.vault.read(file);
            // 2. 解析 frontmatter
            const frontmatter = this.frontmatterManager.parseFrontmatterFromContent(content);
            // 3. 检查排除标签（系统保留标签 + 用户配置）
            const tags = this.extractTags(frontmatter, content);
            // 保持使用 #we_已删除 和 #we_deleted 标签，已经是正确的格式
            const excludeTags = ['#we_已删除', '#we_deleted', ...(config.excludeTags || [])];
            if (this.shouldSkipByTags(tags, excludeTags)) {
                // 找出匹配的标签（需要标准化比较）
                const normalizedExcludeTags = excludeTags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
                const matchedTags = normalizedExcludeTags.filter(excludeTag => tags.some(cardTag => cardTag.toLowerCase() === excludeTag.toLowerCase()));
                return {
                    success: false,
                    shouldSkip: true,
                    skipReason: `包含排除标签: ${matchedTags.map(t => '#' + t).join(', ')}`
                };
            }
            // 4. 获取或生成 UUID
            let uuid = frontmatter['weave-uuid'];
            const isNewCard = !uuid;
            if (isNewCard) {
                uuid = generateUUID();
            }
            // 5. 提取正文内容
            const bodyContent = this.frontmatterManager.extractBodyContent(content);
            // 6. 根据配置解析正反面
            let front = '';
            let back = '';
            if (config.contentStructure === 'front-back-split') {
                // 正反面分离模式
                const parts = this.splitFrontBack(bodyContent, config.frontBackSeparator);
                front = parts.front;
                back = parts.back;
            }
            else {
                // 整个文件作为正面
                front = bodyContent.trim();
                back = '';
            }
            // 7. 构造 ParsedCard
            const parsedCard = {
                type: CardType.Basic, // 单文件单卡片默认为问答类型
                front,
                back,
                tags,
                //  Content-Only: 不再生成 fields
                metadata: {
                    sourceFile: file.path,
                    sourceBlock: undefined, // 单文件单卡片没有块链接
                    targetDeckId,
                    uuid,
                    isNewCard,
                    fileMtime: file.stat.mtime,
                    parseMode: 'single-card'
                }
            };
            return {
                success: true,
                card: parsedCard
            };
        }
        catch (error) {
            logger.error('[SingleCardParser] 解析文件失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * 分离正反面内容
     * @param content 正文内容
     * @param separator 分隔符
     * @returns 正反面对象
     */
    splitFrontBack(content, separator) {
        const parts = content.split(separator);
        if (parts.length >= 2) {
            return {
                front: parts[0].trim(),
                back: parts.slice(1).join(separator).trim()
            };
        }
        else {
            // 如果没有找到分隔符，整个内容作为正面
            return {
                front: content.trim(),
                back: ''
            };
        }
    }
    /**
     * 提取标签（从 frontmatter 和正文）
     * @param frontmatter frontmatter 数据
     * @param content 完整内容
     * @returns 标签数组
     */
    extractTags(frontmatter, content) {
        const tags = new Set();
        // 从 frontmatter 提取
        if (frontmatter.tags) {
            if (typeof frontmatter.tags === 'string') {
                tags.add(frontmatter.tags);
            }
            else if (Array.isArray(frontmatter.tags)) {
                frontmatter.tags.forEach((tag) => tags.add(tag));
            }
        }
        // 从正文提取 Markdown 标签
        const tagRegex = /#([^\s#]+)/g;
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
            tags.add(match[1]);
        }
        return Array.from(tags);
    }
    /**
     * 根据标签判断是否跳过
     * @param cardTags 卡片标签（已标准化，不含 # 前缀）
     * @param excludeTags 排除标签
     * @returns 是否跳过
     */
    shouldSkipByTags(cardTags, excludeTags) {
        if (!excludeTags || excludeTags.length === 0)
            return false;
        if (!cardTags || cardTags.length === 0)
            return false;
        // 标准化排除标签（移除可能的 # 前缀）
        const normalizedExcludeTags = excludeTags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
        // 不区分大小写的标签匹配
        return normalizedExcludeTags.some(excludeTag => cardTags.some(cardTag => cardTag.toLowerCase() === excludeTag.toLowerCase()));
    }
    /**
     * 批量解析多个文件
     * @param files 文件数组
     * @param config 单文件单卡片配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果数组
     */
    async parseFiles(files, config, targetDeckId) {
        const results = [];
        for (const file of files) {
            const result = await this.parseFile(file, config, targetDeckId);
            results.push(result);
        }
        return results;
    }
    /**
     * 获取文件的 UUID（如果存在）
     * @param file Obsidian 文件对象
     * @returns UUID 或 null
     */
    async getFileUUID(file) {
        return await this.frontmatterManager.getUUID(file);
    }
    /**
     * 更新文件的 UUID
     * @param file Obsidian 文件对象
     * @param uuid UUID 字符串
     */
    async setFileUUID(file, uuid) {
        await this.frontmatterManager.setUUID(file, uuid);
    }
}
