/**
 * 增量阅读内容拆分服务
 *
 * @deprecated v5.0 文件化块方案已弃用此服务的大部分功能
 * 新方案使用 IRChunkFileService 生成独立的块文件
 * 此服务仅用于兼容旧数据，新代码应使用 IRChunkFileService
 *
 * 旧功能（废弃）：
 * - 按标题级别拆分 (heading 模式) → 使用 splitByRules + IRChunkFileService
 * - 按段落拆分 (paragraph 模式) → 同上
 * - 手动标记拆分 (manual 模式) → 同上
 * - injectInitialMarkers() → 废弃，不再在原文件中插入标记
 *
 * v2.0 变更:
 * - UUID注释格式: <!-- weave-ir: uuid -->
 * - 移除block-end标记
 * - 支持headingPath
 *
 * @module services/incremental-reading/IRContentSplitter
 * @version 2.0.0 - 引入式架构（v5.0 已废弃）
 */
import { TFile } from 'obsidian';
import { generateIRBlockId, createDefaultIRBlock } from '../../types/ir-types';
import { logger } from '../../utils/logger';
/** 块标记注释格式 (v2.0: 统一使用 weave-ir) */
const IR_UUID_REGEX = /<!--\s*weave-ir:\s*(ir-[a-z0-9]+)\s*-->/;
/** 全局匹配版本 */
const IR_UUID_REGEX_GLOBAL = /<!--\s*weave-ir:\s*(ir-[a-z0-9]+)\s*-->/g;
/** @deprecated v1.0兼容 */
const BLOCK_START_REGEX = /<!--\s*weave-block:\s*(ir-[a-z0-9]+)\s*-->/;
const BLOCK_END_MARKER = '<!-- weave-block-end -->';
/** v2.2: 增量阅读起始标记（忽略此标记之前的内容，如YAML） */
const IR_START_MARKER = '<!-- weave-ir-start -->';
const IR_START_REGEX = /<!--\s*weave-ir-start\s*-->/;
/** v2.1: 手动拆分符号（已废弃，改用 UUID 标记直接分割） */
const IR_SPLIT_MARKER = '---IR---';
export class IRContentSplitter {
    app;
    storage;
    constructor(app, storage) {
        this.app = app;
        this.storage = storage;
    }
    /**
     * 拆分文件并创建内容块
     */
    async splitFile(file, deckPath, settings) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        // 根据模式拆分 (v2.2: 扩展支持 blank-lines 和 custom)
        let splits;
        switch (settings.splitMode) {
            case 'heading':
                splits = this.splitByHeading(lines, settings.splitLevel);
                break;
            case 'blank-lines':
                splits = this.splitByBlankLines(lines);
                break;
            case 'custom':
                splits = this.splitByCustomMarker(lines, settings.customSplitMarker || '---');
                break;
            case 'manual':
                splits = this.splitByManualMarkers(lines);
                break;
            default:
                splits = this.splitByHeading(lines, settings.splitLevel);
        }
        // 检查文件中已存在的块ID (v2.0: 支持两种格式)
        const existingIds = this.extractExistingBlockIds(content);
        const existingBlocks = await this.storage.getBlocksByFile(file.path);
        const existingIdToBlock = new Map(existingBlocks.map(b => [b.id, b]));
        // 创建或更新内容块
        const blocks = [];
        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            // 查找该位置是否已有块ID
            let blockId = this.findBlockIdAtPosition(lines, split.startLine);
            let block;
            if (blockId && existingIdToBlock.has(blockId)) {
                // 使用已存在的块（保留调度状态）
                block = existingIdToBlock.get(blockId);
                // v2.0: 更新headingPath
                block.headingPath = split.headingPath;
                block.headingLevel = split.headingLevel;
                block.startLine = split.startLine;
                // v2.3: 正确赋值 endLine，用于 UUID 标记写入位置计算
                block.endLine = split.endLine;
                // 兼容字段
                block.headingText = split.headingText;
                block.blockIndex = i;
                block.contentPreview = split.content.slice(0, 100);
                block.updatedAt = new Date().toISOString();
            }
            else {
                // 创建新块 (v2.0 API)
                blockId = generateIRBlockId();
                block = createDefaultIRBlock(blockId, file.path, split.headingPath, split.headingLevel, split.startLine);
                // v2.3: 正确赋值 endLine，用于 UUID 标记写入位置计算
                block.endLine = split.endLine;
                // 兼容字段
                block.headingText = split.headingText;
                block.deckPath = deckPath;
                block.blockIndex = i;
                block.contentPreview = split.content.slice(0, 100);
            }
            blocks.push(block);
        }
        // 批量保存内容块
        await this.storage.saveBlocks(blocks);
        logger.info(`[IRContentSplitter] 拆分文件 ${file.path}: ${blocks.length} 个内容块`);
        return blocks;
    }
    /**
     * 按标题级别拆分 (v2.3: 跳过 YAML frontmatter)
     */
    splitByHeading(lines, splitLevel) {
        const results = [];
        const headingRegex = new RegExp(`^(#{1,${splitLevel}})\\s+(.+)$`);
        // v2.3: 跳过 YAML frontmatter
        const yamlEndIndex = this.findYamlEndIndex(lines);
        let currentHeading = '';
        let currentLevel = 0;
        let currentStartLine = yamlEndIndex;
        let contentLines = [];
        // v2.0: 跟踪标题层级路径
        const headingStack = [];
        for (let i = yamlEndIndex; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(headingRegex);
            if (match) {
                // 保存前一个块
                if (currentHeading || contentLines.length > 0) {
                    results.push({
                        headingText: currentHeading || '(无标题)',
                        headingPath: this.buildHeadingPath(headingStack, currentHeading, currentLevel),
                        headingLevel: currentLevel || splitLevel,
                        content: contentLines.join('\n').trim(),
                        startLine: currentStartLine,
                        endLine: i - 1
                    });
                }
                // 更新标题栈
                const newLevel = match[1].length;
                const newHeading = match[2].trim();
                // 移除同级或更低级别的标题
                while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= newLevel) {
                    headingStack.pop();
                }
                headingStack.push({ level: newLevel, text: newHeading });
                // 开始新块
                currentHeading = newHeading;
                currentLevel = newLevel;
                currentStartLine = i;
                contentLines = [];
            }
            else {
                contentLines.push(line);
            }
        }
        // 保存最后一个块
        if (currentHeading || contentLines.length > 0) {
            results.push({
                headingText: currentHeading || '(无标题)',
                headingPath: this.buildHeadingPath(headingStack, currentHeading, currentLevel),
                headingLevel: currentLevel || splitLevel,
                content: contentLines.join('\n').trim(),
                startLine: currentStartLine,
                endLine: lines.length - 1
            });
        }
        // 过滤空内容块
        return results.filter(r => r.content.trim().length > 0);
    }
    /**
     * 构建标题层级路径 (v2.0 新增)
     */
    buildHeadingPath(stack, currentHeading, currentLevel) {
        const path = [];
        for (const item of stack) {
            if (item.level < currentLevel) {
                path.push(item.text);
            }
        }
        if (currentHeading) {
            path.push(currentHeading);
        }
        return path;
    }
    /**
     * 按段落拆分 (v2.3: 跳过 YAML frontmatter)
     */
    splitByParagraph(lines) {
        const results = [];
        // v2.3: 跳过 YAML frontmatter
        const yamlEndIndex = this.findYamlEndIndex(lines);
        let currentParagraph = [];
        let startLine = yamlEndIndex;
        let paragraphIndex = 0;
        for (let i = yamlEndIndex; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                // 空行表示段落结束
                if (currentParagraph.length > 0) {
                    const content = currentParagraph.join('\n').trim();
                    if (content.length > 0) {
                        const title = `段落 ${++paragraphIndex}`;
                        results.push({
                            headingText: title,
                            headingPath: [title],
                            headingLevel: 0,
                            content,
                            startLine,
                            endLine: i - 1
                        });
                    }
                    currentParagraph = [];
                }
                startLine = i + 1;
            }
            else {
                if (currentParagraph.length === 0) {
                    startLine = i;
                }
                currentParagraph.push(line);
            }
        }
        // 保存最后一个段落
        if (currentParagraph.length > 0) {
            const content = currentParagraph.join('\n').trim();
            if (content.length > 0) {
                const title = `段落 ${++paragraphIndex}`;
                results.push({
                    headingText: title,
                    headingPath: [title],
                    headingLevel: 0,
                    content,
                    startLine,
                    endLine: lines.length - 1
                });
            }
        }
        return results;
    }
    /**
     * 按手动标记拆分 (v2.3: 跳过 YAML frontmatter)
     * 两个 ---IR--- 之间的内容为一个内容块
     */
    splitByManualMarkers(lines) {
        const results = [];
        // v2.3: 跳过 YAML frontmatter
        const yamlEndIndex = this.findYamlEndIndex(lines);
        let currentContent = [];
        let startLine = yamlEndIndex;
        let blockIndex = 0;
        let foundFirstMarker = false;
        for (let i = yamlEndIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            // 检查是否是分隔符 ---IR---
            if (line === IR_SPLIT_MARKER) {
                if (foundFirstMarker && currentContent.length > 0) {
                    // 遇到第二个分隔符，保存当前块
                    const content = currentContent.join('\n').trim();
                    if (content.length > 0) {
                        // 提取块标题（第一行非空内容或默认标题）
                        const firstLine = currentContent.find(l => l.trim().length > 0) || '';
                        const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
                        const title = headingMatch ? headingMatch[1].trim() : `块 ${++blockIndex}`;
                        results.push({
                            headingText: title,
                            headingPath: [title],
                            headingLevel: headingMatch ? headingMatch[0].match(/^#+/)[0].length : 0,
                            content,
                            startLine,
                            endLine: i - 1
                        });
                    }
                    currentContent = [];
                }
                foundFirstMarker = true;
                startLine = i + 1;
                continue;
            }
            // 收集块内容（在找到第一个分隔符后）
            if (foundFirstMarker) {
                currentContent.push(lines[i]);
            }
        }
        // 处理最后一个块（如果文件末尾没有结束分隔符）
        if (foundFirstMarker && currentContent.length > 0) {
            const content = currentContent.join('\n').trim();
            if (content.length > 0) {
                const firstLine = currentContent.find(l => l.trim().length > 0) || '';
                const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
                const title = headingMatch ? headingMatch[1].trim() : `块 ${++blockIndex}`;
                results.push({
                    headingText: title,
                    headingPath: [title],
                    headingLevel: headingMatch ? headingMatch[0].match(/^#+/)[0].length : 0,
                    content,
                    startLine,
                    endLine: lines.length - 1
                });
            }
        }
        return results;
    }
    /**
     * v2.3: 按双空行拆分（跳过 YAML frontmatter）
     * 连续两个或以上空行作为分隔符
     */
    splitByBlankLines(lines) {
        const results = [];
        // v2.3: 跳过 YAML frontmatter
        const yamlEndIndex = this.findYamlEndIndex(lines);
        let currentContent = [];
        let startLine = yamlEndIndex;
        let blockIndex = 0;
        let consecutiveBlankLines = 0;
        for (let i = yamlEndIndex; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                consecutiveBlankLines++;
                // 连续两个空行表示块分隔
                if (consecutiveBlankLines >= 2 && currentContent.length > 0) {
                    const content = currentContent.join('\n').trim();
                    if (content.length > 0) {
                        const title = this.extractBlockTitleFromLines(currentContent) || `块 ${++blockIndex}`;
                        const headingMatch = currentContent.find(l => l.match(/^#{1,6}\s+/));
                        const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                        results.push({
                            headingText: title,
                            headingPath: [title],
                            headingLevel: level,
                            content,
                            startLine,
                            endLine: i - consecutiveBlankLines
                        });
                    }
                    currentContent = [];
                    startLine = i + 1;
                }
            }
            else {
                if (currentContent.length === 0) {
                    startLine = i;
                }
                currentContent.push(line);
                consecutiveBlankLines = 0;
            }
        }
        // 保存最后一个块
        if (currentContent.length > 0) {
            const content = currentContent.join('\n').trim();
            if (content.length > 0) {
                const title = this.extractBlockTitleFromLines(currentContent) || `块 ${++blockIndex}`;
                const headingMatch = currentContent.find(l => l.match(/^#{1,6}\s+/));
                const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                results.push({
                    headingText: title,
                    headingPath: [title],
                    headingLevel: level,
                    content,
                    startLine,
                    endLine: lines.length - 1
                });
            }
        }
        return results;
    }
    /**
     * v2.3: 按自定义分隔符拆分（跳过 YAML frontmatter）
     */
    splitByCustomMarker(lines, marker) {
        const results = [];
        // v2.3: 跳过 YAML frontmatter
        const yamlEndIndex = this.findYamlEndIndex(lines);
        let currentContent = [];
        let startLine = yamlEndIndex;
        let blockIndex = 0;
        for (let i = yamlEndIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            // 检查是否是自定义分隔符
            if (line === marker) {
                if (currentContent.length > 0) {
                    const content = currentContent.join('\n').trim();
                    if (content.length > 0) {
                        const title = this.extractBlockTitleFromLines(currentContent) || `块 ${++blockIndex}`;
                        const headingMatch = currentContent.find(l => l.match(/^#{1,6}\s+/));
                        const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                        results.push({
                            headingText: title,
                            headingPath: [title],
                            headingLevel: level,
                            content,
                            startLine,
                            endLine: i - 1
                        });
                    }
                    currentContent = [];
                }
                startLine = i + 1;
                continue;
            }
            if (currentContent.length === 0 && line.length > 0) {
                startLine = i;
            }
            currentContent.push(lines[i]);
        }
        // 保存最后一个块
        if (currentContent.length > 0) {
            const content = currentContent.join('\n').trim();
            if (content.length > 0) {
                const title = this.extractBlockTitleFromLines(currentContent) || `块 ${++blockIndex}`;
                const headingMatch = currentContent.find(l => l.match(/^#{1,6}\s+/));
                const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                results.push({
                    headingText: title,
                    headingPath: [title],
                    headingLevel: level,
                    content,
                    startLine,
                    endLine: lines.length - 1
                });
            }
        }
        return results;
    }
    /**
     * v2.3: 检测 YAML frontmatter 结束位置
     * @returns YAML 结束后的第一行索引，如果没有 YAML 则返回 0
     */
    findYamlEndIndex(lines) {
        if (lines[0]?.trim() !== '---') {
            return 0;
        }
        for (let i = 1; i < lines.length; i++) {
            if (lines[i]?.trim() === '---') {
                return i + 1;
            }
        }
        // YAML 未正确关闭，返回 0
        return 0;
    }
    /**
     * 从内容行中提取标题
     */
    extractBlockTitleFromLines(lines) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0)
                continue;
            const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
            if (headingMatch) {
                return headingMatch[1].trim();
            }
            return trimmed.slice(0, 50);
        }
        return '';
    }
    /**
     * 提取文件中已存在的块ID (v2.0: 支持两种格式)
     */
    extractExistingBlockIds(content) {
        const ids = [];
        // v2.0 格式
        const regexV2 = new RegExp(IR_UUID_REGEX, 'g');
        let match;
        while ((match = regexV2.exec(content)) !== null) {
            ids.push(match[1]);
        }
        // v1.0 兼容格式
        const regexV1 = new RegExp(BLOCK_START_REGEX, 'g');
        while ((match = regexV1.exec(content)) !== null) {
            if (!ids.includes(match[1])) {
                ids.push(match[1]);
            }
        }
        return ids;
    }
    /**
     * 查找指定行附近的块ID (v2.0: 支持两种格式)
     */
    findBlockIdAtPosition(lines, startLine) {
        // 检查起始行前后5行
        for (let i = Math.max(0, startLine - 5); i < Math.min(lines.length, startLine + 5); i++) {
            // v2.0 格式优先
            const matchV2 = lines[i].match(IR_UUID_REGEX);
            if (matchV2) {
                return matchV2[1];
            }
            // v1.0 兼容
            const match = lines[i].match(BLOCK_START_REGEX);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * v2.3: 首次导入时写入拆分标记
     *
     * UUID 标记写在内容块末尾，表示“前面的内容为一个完整的学习块”
     *
     * 正确格式示例:
     * ```
     * ---
     * yaml content
     * ---
     *
     * <!-- weave-ir-start -->
     * # 标题1
     * 内容1...
     * <!-- weave-ir: ir-xxx -->
     * # 标题2
     * 内容2...
     * <!-- weave-ir: ir-yyy -->
     * ```
     */
    async injectInitialMarkers(file, blocks, settings) {
        let content = await this.app.vault.read(file);
        // 检查是否已有起始标记（避免重复处理）
        if (IR_START_REGEX.test(content)) {
            logger.debug(`[IRContentSplitter] 文件已有起始标记，跳过: ${file.path}`);
            return;
        }
        const lines = content.split('\n');
        // 找到 YAML frontmatter 结束位置
        let yamlEndIndex = 0;
        if (lines[0]?.trim() === '---') {
            for (let i = 1; i < lines.length; i++) {
                if (lines[i]?.trim() === '---') {
                    yamlEndIndex = i + 1;
                    break;
                }
            }
        }
        // 跳过 YAML 后的空行，找到内容开始位置
        let contentStartIndex = yamlEndIndex;
        while (contentStartIndex < lines.length && lines[contentStartIndex]?.trim() === '') {
            contentStartIndex++;
        }
        // 按 blockIndex 排序，确保顺序正确
        const sortedBlocks = [...blocks].sort((a, b) => (a.blockIndex ?? 0) - (b.blockIndex ?? 0));
        // 构建新内容
        const newLines = [];
        // 1. 保留 YAML 部分
        for (let i = 0; i < yamlEndIndex; i++) {
            newLines.push(lines[i]);
        }
        // 2. 添加空行和起始标记
        newLines.push('');
        newLines.push(IR_START_MARKER);
        // 3. 对每个内容块，写入内容和UUID标记
        for (let i = 0; i < sortedBlocks.length; i++) {
            const block = sortedBlocks[i];
            const startLine = block.startLine ?? 0;
            const endLine = block.endLine ?? startLine;
            // 写入内容块的内容（从原始文件中提取）
            for (let j = startLine; j <= endLine && j < lines.length; j++) {
                newLines.push(lines[j]);
            }
            // 在内容块末尾写入 UUID 标记
            newLines.push(`<!-- weave-ir: ${block.id} -->`);
        }
        // 写回文件
        content = newLines.join('\n');
        await this.app.vault.modify(file, content);
        logger.info(`[IRContentSplitter] ✅ 已写入拆分标记: ${file.path}, ${blocks.length} 个内容块`);
    }
    /**
     * v2.2: 按 UUID 标记解析内容块（用于文件变化后重新同步）
     * UUID 标记在内容块末尾，标记之前的内容属于该块
     */
    splitByUuidMarkers(lines, startLineOffset = 0) {
        const results = [];
        let currentContent = [];
        let startLine = startLineOffset;
        let blockIndex = 0;
        // 查找起始标记位置
        let contentStartLine = 0;
        for (let i = 0; i < lines.length; i++) {
            if (IR_START_REGEX.test(lines[i])) {
                contentStartLine = i + 1;
                startLine = i + 1;
                break;
            }
        }
        for (let i = contentStartLine; i < lines.length; i++) {
            const line = lines[i];
            const uuidMatch = line.match(IR_UUID_REGEX);
            if (uuidMatch) {
                // 遇到 UUID 标记，UUID 之前的内容属于该块
                if (currentContent.length > 0) {
                    const content = currentContent.join('\n').trim();
                    if (content.length > 0) {
                        const title = this.extractBlockTitle(currentContent) || `块 ${++blockIndex}`;
                        const headingMatch = currentContent.find(l => l.match(/^#{1,6}\s+/));
                        const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                        results.push({
                            headingText: title,
                            headingPath: [title],
                            headingLevel: level,
                            content,
                            startLine,
                            endLine: i - 1
                        });
                    }
                }
                // UUID 标记后开始收集下一个块的内容
                currentContent = [];
                startLine = i + 1;
                continue;
            }
            // 收集内容
            currentContent.push(line);
        }
        // 保存最后一个块（最后一个 UUID 标记之后的内容）
        if (currentContent.length > 0) {
            const content = currentContent.join('\n').trim();
            if (content.length > 0) {
                const title = this.extractBlockTitle(currentContent) || `块 ${++blockIndex}`;
                const headingMatch = currentContent.find(l => l.match(/^#{1,6}\s+/));
                const level = headingMatch ? headingMatch.match(/^#+/)[0].length : 0;
                results.push({
                    headingText: title,
                    headingPath: [title],
                    headingLevel: level,
                    content,
                    startLine,
                    endLine: lines.length - 1
                });
            }
        }
        return results;
    }
    /**
     * 提取内容块标题（第一个标题行或第一行非空内容）
     */
    extractBlockTitle(lines) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0)
                continue;
            // 检查是否是标题
            const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
            if (headingMatch) {
                return headingMatch[1].trim();
            }
            // 返回第一行非空内容的前50个字符
            return trimmed.slice(0, 50);
        }
        return '';
    }
    /**
     * 向文件注入块ID标记 (v2.2: UUID添加到内容块末尾)
     * UUID 标记表示前面的内容为一个完整的学习块
     */
    async injectBlockMarkers(file, blocks) {
        let content = await this.app.vault.read(file);
        const lines = content.split('\n');
        // 按 endLine 排序（从后往前注入，避免行号偏移）
        const sortedBlocks = [...blocks].sort((a, b) => (b.endLine ?? b.startLine ?? b.blockIndex ?? 0) -
            (a.endLine ?? a.startLine ?? a.blockIndex ?? 0));
        for (const block of sortedBlocks) {
            // 检查是否已有标记 (v2.0 + v1.0)
            if (content.includes(`weave-ir: ${block.id}`) || content.includes(`weave-block: ${block.id}`)) {
                continue;
            }
            // v2.2: 在内容块末尾插入UUID注释
            // 使用 endLine，如果没有则使用 startLine + 1
            const endLine = block.endLine ?? (block.startLine ?? 0) + 1;
            if (endLine >= 0 && endLine <= lines.length) {
                const uuidComment = `<!-- weave-ir: ${block.id} -->`;
                lines.splice(endLine + 1, 0, uuidComment);
                // 更新 content 以便后续检查
                content = lines.join('\n');
            }
        }
        // 写回文件
        await this.app.vault.modify(file, content);
        logger.debug(`[IRContentSplitter] 注入块标记: ${file.path}`);
    }
    /**
     * 从文件移除块ID标记 (v2.0: 支持两种格式)
     */
    async removeBlockMarkers(file) {
        let content = await this.app.vault.read(file);
        // v2.0 格式
        content = content.replace(/\n*<!--\s*weave-ir:\s*ir-[a-z0-9]+\s*-->\n*/g, '\n');
        // v1.0 兼容格式
        content = content.replace(/\n*<!--\s*weave-block:\s*ir-[a-z0-9]+\s*-->\n*/g, '\n');
        // 移除块结束标记 (v1.0)
        content = content.replace(/\n*<!--\s*weave-block-end\s*-->\n*/g, '\n');
        await this.app.vault.modify(file, content);
        logger.debug(`[IRContentSplitter] 移除块标记: ${file.path}`);
    }
    /**
     * 获取内容块的实际内容
     */
    async getBlockContent(block) {
        const file = this.app.vault.getAbstractFileByPath(block.filePath);
        if (!(file instanceof TFile)) {
            return '';
        }
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        // 按标题级别重新解析获取内容
        const headingRegex = new RegExp(`^#{${block.headingLevel}}\\s+${this.escapeRegex(block.headingText || '')}\\s*$`);
        let startIndex = -1;
        let endIndex = lines.length;
        for (let i = 0; i < lines.length; i++) {
            if (headingRegex.test(lines[i])) {
                startIndex = i + 1;
                continue;
            }
            // 找到下一个同级或更高级标题
            if (startIndex !== -1) {
                const nextHeadingMatch = lines[i].match(/^(#{1,6})\s+/);
                if (nextHeadingMatch && nextHeadingMatch[1].length <= block.headingLevel) {
                    endIndex = i;
                    break;
                }
            }
        }
        if (startIndex === -1) {
            return block.contentPreview || '';
        }
        // 移除块标记 (v2.0 + v1.0)
        const blockContent = lines.slice(startIndex, endIndex)
            .filter(line => !IR_UUID_REGEX.test(line) &&
            !BLOCK_START_REGEX.test(line) &&
            !line.includes(BLOCK_END_MARKER))
            .join('\n')
            .trim();
        return blockContent;
    }
    /**
     * 转义正则表达式特殊字符
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
