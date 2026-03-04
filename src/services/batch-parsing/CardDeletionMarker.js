import { logger } from '../../utils/logger';
import { logDebugWithTag } from '../../utils/logger';
/**
 * 卡片删除标记器
 */
export class CardDeletionMarker {
    config;
    vault;
    // 删除标记模式（注释格式）
    DELETION_MARKER_COMMENT = '<!-- 已删除卡片 - 请勿重新解析 -->';
    DELETION_UUID_PREFIX = '<!-- deleted-card: ';
    DELETION_UUID_SUFFIX = ' -->';
    // 删除标记模式（标签格式）
    // 使用 we_ 前缀避免与用户常见标签冲突
    DELETION_TAG = '#we_已删除';
    constructor(config, vault) {
        this.config = config;
        this.vault = vault;
    }
    /**
     * 在文档中标记已删除的卡片
     *
     * @param file - 源文件
     * @param cardStartIndex - 卡片起始位置
     * @param cardEndIndex - 卡片结束位置
     * @param uuid - 卡片UUID
     * @returns 标记结果
     */
    async markCardAsDeleted(file, cardStartIndex, cardEndIndex, uuid) {
        if (!this.config.enabled) {
            return {
                success: false,
                markedAt: -1,
                updatedContent: '',
                error: '删除标记功能未启用'
            };
        }
        try {
            // 读取文件内容
            const content = await this.vault.read(file);
            // 生成删除标记
            const deletionMarker = this.generateDeletionMarker(uuid);
            // 确定插入位置（卡片起始后）
            const insertPosition = cardStartIndex;
            // 插入删除标记
            const updatedContent = this.config.keepOriginalContent
                ? this.insertMarkerKeepContent(content, insertPosition, deletionMarker)
                : this.insertMarkerReplaceContent(content, cardStartIndex, cardEndIndex, deletionMarker);
            // 写回文件
            await this.vault.modify(file, updatedContent);
            logDebugWithTag('CardDeletionMarker', `已标记删除卡片: ${uuid} in ${file.path}`);
            return {
                success: true,
                markedAt: insertPosition,
                updatedContent
            };
        }
        catch (error) {
            logger.error('[CardDeletionMarker] 标记失败:', error);
            return {
                success: false,
                markedAt: -1,
                updatedContent: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * 检测内容中是否包含删除标记
     *
     * @param content - 卡片内容
     * @returns 检测结果
     */
    detectDeletionMarker(content) {
        if (!this.config.enabled) {
            return { isDeleted: false };
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // 检测注释格式标记
            if (line === this.DELETION_MARKER_COMMENT) {
                // 查找UUID
                const uuidLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
                if (uuidLine.startsWith(this.DELETION_UUID_PREFIX)) {
                    const uuid = uuidLine
                        .replace(this.DELETION_UUID_PREFIX, '')
                        .replace(this.DELETION_UUID_SUFFIX, '')
                        .trim();
                    return {
                        isDeleted: true,
                        uuid,
                        lineNumber: i + 1
                    };
                }
                return {
                    isDeleted: true,
                    lineNumber: i + 1
                };
            }
            // 检测标签格式标记
            if (line.includes(this.DELETION_TAG)) {
                return {
                    isDeleted: true,
                    lineNumber: i + 1
                };
            }
        }
        return { isDeleted: false };
    }
    /**
     * 批量检测内容中的删除标记
     *
     * @param content - 完整文档内容
     * @param cardDelimiter - 卡片分隔符
     * @returns 删除卡片的索引列表
     */
    detectDeletedCardsInBatch(content, cardDelimiter = '<->') {
        const deletedIndices = [];
        const cards = content.split(cardDelimiter);
        for (let i = 0; i < cards.length; i++) {
            const detection = this.detectDeletionMarker(cards[i]);
            if (detection.isDeleted) {
                deletedIndices.push(i);
                logDebugWithTag('CardDeletionMarker', `检测到已删除卡片（索引${i}）${detection.uuid ? `: ${detection.uuid}` : ''}`);
            }
        }
        return deletedIndices;
    }
    /**
     * 生成删除标记
     */
    generateDeletionMarker(uuid) {
        if (this.config.format === 'tag') {
            return `${this.DELETION_TAG}\n<!-- deleted-card: ${uuid} -->`;
        }
        // 默认使用注释格式
        return `${this.DELETION_MARKER_COMMENT}\n${this.DELETION_UUID_PREFIX}${uuid}${this.DELETION_UUID_SUFFIX}`;
    }
    /**
     * 插入标记并保留原内容
     */
    insertMarkerKeepContent(content, position, marker) {
        return (`${content.substring(0, position) +
            marker}\n${content.substring(position)}`);
    }
    /**
     * 插入标记并替换内容
     */
    insertMarkerReplaceContent(content, startPos, endPos, marker) {
        return (`${content.substring(0, startPos) +
            marker}\n<!-- 原卡片内容已删除 -->\n${content.substring(endPos)}`);
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
/**
 * 默认删除标记配置
 */
export const DEFAULT_DELETION_MARKER_CONFIG = {
    enabled: true, // 默认启用删除标记
    format: 'comment', // 使用注释格式
    keepOriginalContent: true // 保留原内容
};
