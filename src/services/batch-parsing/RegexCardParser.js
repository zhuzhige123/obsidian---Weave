import { logger } from '../../utils/logger';
import { FrontmatterManager } from './FrontmatterManager';
import { generateUUID } from '../../utils/helpers';
import { CardType } from '../../data/types';
import { logDebugWithTag } from '../../utils/logger';
/**
 * 正则表达式卡片解析器
 */
export class RegexCardParser {
    app;
    frontmatterManager;
    plugin; // 🆕 插件实例（用于访问全局配置）
    constructor(app, plugin) {
        this.app = app;
        this.frontmatterManager = new FrontmatterManager(app);
        this.plugin = plugin;
    }
    /**
     * 解析文件（主入口）
     * @param file Obsidian 文件对象
     * @param config 正则解析配置
     * @param targetDeckId 目标牌组 ID
     * @returns 解析结果
     */
    async parseFile(file, config, targetDeckId) {
        const result = {
            success: true,
            cards: [],
            errors: [],
            skippedCount: 0,
            positions: [],
            originalContent: undefined
        };
        try {
            // 1. 读取文件内容
            const content = await this.app.vault.read(file);
            result.originalContent = content; // 🆕 保存原始内容
            // 2. 提取 frontmatter UUID（如果配置为 frontmatter）
            let frontmatterUUID;
            if (config.uuidLocation === 'frontmatter') {
                frontmatterUUID = await this.frontmatterManager.getUUID(file) || undefined;
            }
            // 3. 根据模式解析卡片
            let cardMatches = [];
            if (config.mode === 'separator' && config.separatorMode) {
                cardMatches = this.parseBySeparator(content, config);
            }
            else if (config.mode === 'pattern' && config.patternMode) {
                cardMatches = this.parseByPattern(content, config);
            }
            else {
                result.success = false;
                result.errors.push('无效的解析配置：缺少 separatorMode 或 patternMode');
                return result;
            }
            // 4. 处理排除标签（系统标签 + 用户配置）
            const excludeTags = [
                '#we_已删除', '#we_deleted', // 系统保留标签（插件删除卡片时自动添加，使用 we_ 前缀避免冲突）
                ...(this.plugin?.settings?.simplifiedParsing?.batchParsing?.excludeTags || []) // 用户全局配置
            ];
            const validMatches = cardMatches.filter(_match => {
                const shouldSkip = this.shouldSkipByTags(_match.tags, excludeTags);
                if (shouldSkip) {
                    result.skippedCount++;
                }
                return !shouldSkip;
            });
            // 5. 转换为 ParsedCard 并构建位置信息
            const positions = [];
            const lines = content.split('\n');
            // 辅助函数：将字符索引转换为行号
            const indexToLine = (index) => {
                let currentIndex = 0;
                for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                    const lineLength = lines[lineNum].length + 1; // +1 for \n
                    if (currentIndex + lineLength > index) {
                        return lineNum;
                    }
                    currentIndex += lineLength;
                }
                return lines.length - 1;
            };
            // 辅助函数：计算行结束位置（字符索引）
            const _lineEndIndex = (lineNum) => {
                let index = 0;
                for (let i = 0; i < lineNum; i++) {
                    index += lines[i].length + 1; // +1 for \n
                }
                return index + lines[lineNum].length;
            };
            for (let i = 0; i < validMatches.length; i++) {
                const match = validMatches[i];
                // 确定 UUID
                let cardUUID = match.uuid;
                if (!cardUUID) {
                    if (config.uuidLocation === 'frontmatter' && frontmatterUUID && validMatches.length === 1) {
                        // 单卡片文件可以使用 frontmatter UUID
                        cardUUID = frontmatterUUID;
                    }
                    else if (config.autoAddUUID) {
                        // 自动生成新 UUID
                        cardUUID = generateUUID();
                    }
                }
                const parsedCard = {
                    type: CardType.Basic, // 正则解析默认为问答类型
                    front: match.front.trim(),
                    back: match.back.trim(),
                    tags: match.tags,
                    //  Content-Only: 不再生成 fields
                    metadata: {
                        sourceFile: file.path,
                        sourceBlock: undefined,
                        targetDeckId,
                        uuid: cardUUID,
                        isNewCard: !cardUUID,
                        parseMode: 'regex',
                        regexConfig: config.name,
                        cardIndex: i
                    }
                };
                result.cards.push(parsedCard);
                // 🆕 构建位置信息
                const startLine = indexToLine(match.startIndex);
                const endLine = indexToLine(match.endIndex);
                const startOffset = match.startIndex;
                const endOffset = match.endIndex;
                // 提取原始内容（用于UUID检测）
                const rawContent = content.substring(match.startIndex, match.endIndex);
                positions.push({
                    content: `${match.front}\n---div---\n${match.back}`,
                    startLine,
                    endLine,
                    startOffset,
                    endOffset,
                    rawContent,
                    index: i
                });
            }
            result.positions = positions;
            logDebugWithTag('RegexCardParser', `成功解析 ${result.cards.length} 张卡片 (跳过 ${result.skippedCount})`);
        }
        catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : String(error));
            logger.error('[RegexCardParser] 解析失败:', error);
        }
        return result;
    }
    /**
     * 分隔符模式解析
     * @param content 文件内容
     * @param config 配置
     * @returns 卡片匹配结果数组
     */
    parseBySeparator(content, config) {
        const cardMatches = [];
        if (!config.separatorMode) {
            return cardMatches;
        }
        try {
            const { cardSeparator, frontBackSeparator, multiline } = config.separatorMode;
            // 构造卡片分隔正则
            const flags = multiline ? 'gm' : 'g';
            const cardRegex = new RegExp(cardSeparator, flags);
            // 🆕 使用exec方法获取匹配位置，而不是split
            let _lastIndex = 0;
            let match;
            const delimiterMatches = [];
            // 找到所有分隔符位置
            while ((match = cardRegex.exec(content)) !== null) {
                delimiterMatches.push({
                    index: match.index,
                    length: match[0].length
                });
                _lastIndex = match.index + match[0].length;
            }
            // 根据分隔符位置分割卡片块
            for (let i = 0; i < delimiterMatches.length - 1; i++) {
                const startDelim = delimiterMatches[i];
                const endDelim = delimiterMatches[i + 1];
                // 提取卡片内容（不包括分隔符）
                const startIndex = startDelim.index + startDelim.length;
                const endIndex = endDelim.index;
                const block = content.substring(startIndex, endIndex).trim();
                if (block) {
                    const match = this.parseCardBlock(block, frontBackSeparator, config);
                    if (match) {
                        // 🆕 更新真实的位置信息
                        match.startIndex = startIndex;
                        match.endIndex = endIndex;
                        cardMatches.push(match);
                    }
                }
            }
            // 处理最后一个分隔符之后的内容（如果有）
            if (delimiterMatches.length > 0) {
                const lastDelim = delimiterMatches[delimiterMatches.length - 1];
                const startIndex = lastDelim.index + lastDelim.length;
                const endIndex = content.length;
                const block = content.substring(startIndex, endIndex).trim();
                if (block) {
                    const match = this.parseCardBlock(block, frontBackSeparator, config);
                    if (match) {
                        match.startIndex = startIndex;
                        match.endIndex = endIndex;
                        cardMatches.push(match);
                    }
                }
            }
        }
        catch (error) {
            logger.error('[RegexCardParser] 分隔符解析失败:', error);
        }
        return cardMatches;
    }
    /**
     * 🆕 正则模式解析（简化版 - 一步到位）
     * 直接使用正则表达式在全文中匹配所有卡片，不需要先划分范围
     * @param content 文件内容
     * @param config 配置
     * @returns 卡片匹配结果数组
     */
    parseByPattern(content, config) {
        const cardMatches = [];
        if (!config.patternMode) {
            return cardMatches;
        }
        try {
            const { cardPattern, flags, captureGroups } = config.patternMode;
            //  构造正则表达式
            const regex = new RegExp(cardPattern, flags);
            let match;
            //  一步到位：直接在全文中匹配所有卡片
            while ((match = regex.exec(content)) !== null) {
                //  通过捕获组提取内容
                const front = match[captureGroups.front] || '';
                const back = match[captureGroups.back] || '';
                const tagsStr = captureGroups.tags !== undefined ? match[captureGroups.tags] : undefined;
                // 提取标签
                const tags = tagsStr ? this.extractTagsFromString(tagsStr) : [];
                // 提取 UUID（如果配置为 inline）
                let uuid;
                if (config.uuidLocation === 'inline' && config.uuidPattern) {
                    uuid = this.extractInlineUUID(match[0], config.uuidPattern);
                }
                cardMatches.push({
                    front: front.trim(),
                    back: back.trim(),
                    tags,
                    uuid,
                    startIndex: match.index,
                    endIndex: match.index + match[0].length
                });
            }
            logDebugWithTag('RegexParser', `正则模式解析完成，匹配到 ${cardMatches.length} 张卡片`);
        }
        catch (error) {
            logger.error('[RegexCardParser] 正则模式解析失败:', error);
        }
        return cardMatches;
    }
    /**
     * 解析单个卡片块
     * @param block 卡片块内容
     * @param frontBackSeparator 正反面分隔符
     * @param config 配置
     * @returns 卡片匹配结果
     */
    parseCardBlock(block, frontBackSeparator, config) {
        try {
            // 🆕 先提取元数据，再清理内容
            // 提取标签
            const tags = this.extractTagsFromString(block);
            // 提取 UUID（如果配置为 inline）
            let uuid;
            if (config.uuidLocation === 'inline' && config.uuidPattern) {
                uuid = this.extractInlineUUID(block, config.uuidPattern);
            }
            //  关键修复：清理UUID标识符和块链接后再分割内容
            const cleanedBlock = this.cleanCardContent(block);
            let front = '';
            let back = '';
            // 如果有正反面分隔符，进行分割
            if (frontBackSeparator) {
                const parts = cleanedBlock.split(new RegExp(frontBackSeparator, 'm'));
                if (parts.length >= 2) {
                    front = parts[0].trim();
                    back = parts.slice(1).join('\n').trim();
                }
                else {
                    // 没有找到分隔符，整个内容作为正面
                    front = cleanedBlock.trim();
                }
            }
            else {
                // 没有配置分隔符，整个内容作为正面
                front = cleanedBlock.trim();
            }
            //  注意：startIndex 和 endIndex 在这里是相对于 block 的，需要在调用处更新为全局位置
            return {
                front,
                back,
                tags,
                uuid,
                startIndex: 0, // 临时值，会在调用处更新
                endIndex: block.length // 临时值，会在调用处更新
            };
        }
        catch (error) {
            logger.error('[RegexCardParser] 解析卡片块失败:', error);
            return null;
        }
    }
    /**
     * 从字符串中提取标签
     * @param text 文本内容
     * @returns 标签数组
     */
    extractTagsFromString(text) {
        const tags = new Set();
        const tagRegex = /#([^\s#]+)/g;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            tags.add(match[1]);
        }
        return Array.from(tags);
    }
    /**
     * 提取内联 UUID
     * @param text 文本内容
     * @param uuidPattern UUID 匹配正则
     * @returns UUID 或 undefined
     */
    extractInlineUUID(text, uuidPattern) {
        try {
            const regex = new RegExp(uuidPattern);
            const match = regex.exec(text);
            return match?.[1] ? match[1] : undefined;
        }
        catch (error) {
            logger.error('[RegexCardParser] 提取内联 UUID 失败:', error);
            return undefined;
        }
    }
    /**
     * 根据标签判断是否跳过
     * @param cardTags 卡片标签（不包括#前缀）
     * @param excludeTags 排除标签（可能包括#前缀）
     * @returns 是否跳过
     */
    shouldSkipByTags(cardTags, excludeTags) {
        //  安全检查：处理空值情况
        if (!excludeTags || excludeTags.length === 0) {
            return false;
        }
        if (!cardTags || cardTags.length === 0) {
            return false;
        }
        // 🆕 关键修复：标准化excludeTags格式，移除#前缀
        const normalizedExcludeTags = excludeTags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
        // 标签比较（不区分大小写）
        return normalizedExcludeTags.some(excludeTag => cardTags.some(cardTag => cardTag.toLowerCase() === excludeTag.toLowerCase()));
    }
    /**
     * 批量解析多个文件
     * @param files 文件数组
     * @param config 正则解析配置
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
     * 清理卡片内容，移除UUID标识符和块链接
     * @param content 原始卡片内容
     * @returns 清理后的内容
     */
    cleanCardContent(content) {
        let cleanedContent = content;
        //  优先处理组合格式：UUID标识符 + 块链接在同一行
        // 匹配格式如：<!-- tk-5vmqmfjfxthm --> ^we-3j2hjk
        cleanedContent = cleanedContent.replace(/<!--\s*(?:tk-[23456789abcdefghjkmnpqrstuvwxyz]{12}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\s*-->\s*\^[a-zA-Z0-9\-]+\s*$/gm, '');
        //  单独处理剩余的UUID注释（新格式和旧格式）
        // 新格式：<!-- tk-xxxxxxxxxxxx -->
        cleanedContent = cleanedContent.replace(/<!--\s*tk-[23456789abcdefghjkmnpqrstuvwxyz]{12}\s*-->/gi, '');
        // 旧格式UUID：<!-- xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx -->
        cleanedContent = cleanedContent.replace(/<!--\s*[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\s*-->/gi, '');
        //  单独处理剩余的Obsidian块链接：^abc123
        // 匹配行尾的块链接，包括前面可能的空格
        cleanedContent = cleanedContent.replace(/\s*\^[a-zA-Z0-9\-]+\s*$/gm, '');
        //  移除空行和多余的空白
        // 替换多个连续换行为最多两个换行
        cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
        // 移除首尾空白
        cleanedContent = cleanedContent.trim();
        return cleanedContent;
    }
}
