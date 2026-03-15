import { CardType } from '../../data/types';
import { generateUUID } from '../../utils/helpers';
import { logger } from '../../utils/logger';
import { extractAllTags } from '../../utils/yaml-utils';
import { FrontmatterManager } from './FrontmatterManager';
export class SingleCardParser {
    app;
    frontmatterManager;
    constructor(app) {
        this.app = app;
        this.frontmatterManager = new FrontmatterManager(app);
    }
    async parseFile(file, config, targetDeckId) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatter = this.frontmatterManager.parseFrontmatterFromContent(content);
            const tags = this.extractTags(content);
            const excludeTags = ['#we_已删除', '#we_deleted', ...(config.excludeTags || [])];
            if (this.shouldSkipByTags(tags, excludeTags)) {
                const normalizedExcludeTags = excludeTags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
                const matchedTags = normalizedExcludeTags.filter(excludeTag => tags.some(cardTag => cardTag.toLowerCase() === excludeTag.toLowerCase()));
                return {
                    success: false,
                    shouldSkip: true,
                    skipReason: `包含排除标签: ${matchedTags.map(tag => `#${tag}`).join(', ')}`
                };
            }
            let uuid = frontmatter['weave-uuid'];
            const isNewCard = !uuid;
            if (isNewCard) {
                uuid = generateUUID();
            }
            const bodyContent = this.frontmatterManager.extractBodyContent(content);
            let front = '';
            let back = '';
            if (config.contentStructure === 'front-back-split') {
                const parts = this.splitFrontBack(bodyContent, config.frontBackSeparator);
                front = parts.front;
                back = parts.back;
            }
            else {
                front = bodyContent.trim();
            }
            const parsedCard = {
                type: CardType.Basic,
                front,
                back,
                tags,
                metadata: {
                    sourceFile: file.path,
                    sourceBlock: undefined,
                    targetDeckId,
                    uuid,
                    isNewCard,
                    isBatchScanned: true,
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
    splitFrontBack(content, separator) {
        const parts = content.split(separator);
        if (parts.length >= 2) {
            return {
                front: parts[0].trim(),
                back: parts.slice(1).join(separator).trim()
            };
        }
        return {
            front: content.trim(),
            back: ''
        };
    }
    extractTags(content) {
        return extractAllTags(content);
    }
    shouldSkipByTags(cardTags, excludeTags) {
        if (!excludeTags?.length || !cardTags?.length) {
            return false;
        }
        const normalizedExcludeTags = excludeTags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
        return normalizedExcludeTags.some(excludeTag => cardTags.some(cardTag => cardTag.toLowerCase() === excludeTag.toLowerCase()));
    }
    async parseFiles(files, config, targetDeckId) {
        const results = [];
        for (const file of files) {
            const result = await this.parseFile(file, config, targetDeckId);
            results.push(result);
        }
        return results;
    }
    async getFileUUID(file) {
        return await this.frontmatterManager.getUUID(file);
    }
    async setFileUUID(file, uuid) {
        await this.frontmatterManager.setUUID(file, uuid);
    }
}
