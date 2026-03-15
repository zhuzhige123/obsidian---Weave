import { logger } from '../../utils/logger';
/**
 * 批量解析管理器
 * 集成所有批量解析服务，提供统一接口给主插件
 *
 * 职责：
 * 1. 初始化所有子服务
 * 2. 提供命令注册接口
 * 3. 管理配置和状态
 * 4. 处理UI交互
 */
import { Notice, Modal, TFile } from 'obsidian';
import { BlockLinkCleanupService } from '../cleanup/BlockLinkCleanupService';
import { GlobalCleanupScanner } from '../cleanup/GlobalCleanupScanner';
import { CleanupProgressModal } from '../../components/modals/CleanupProgressModal';
import { SimpleFileSelectorService, DeckMappingService, UUIDManager, SimpleBatchParsingService, 
//  已移除 ICardSaver 导入
createDefaultBatchConfig } from './index';
import { logDebugWithTag } from '../../utils/logger';
//  高级功能权限检查
import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../premium/PremiumFeatureGuard';
/**
 * 批量解析管理器（重构后）
 * 职责：协调解析和保存，调用插件的统一保存流程
 */
export class BatchParsingManager {
    app;
    config;
    parser;
    deckStorage;
    uuidStorage;
    plugin;
    // 调试日志辅助函数
    logDebug(message, ...args) {
        // 使用统一的日志管理器
        logDebugWithTag('BatchParsingManager', message, ...args);
    }
    // 子服务
    fileSelector;
    deckMapping;
    uuidManager;
    batchService;
    // 状态
    isInitialized = false;
    progressCallback;
    constructor(app, parsingSettings, parser, deckStorage, uuidStorage, plugin) {
        this.app = app;
        this.parser = parser;
        this.deckStorage = deckStorage;
        this.uuidStorage = uuidStorage;
        this.plugin = plugin;
        // 创建默认配置
        this.config = createDefaultBatchConfig(parsingSettings);
        //  从 settings 中恢复持久化的映射配置（添加安全检查）
        if (parsingSettings.batchParsing?.folderDeckMappings &&
            Array.isArray(parsingSettings.batchParsing.folderDeckMappings) &&
            parsingSettings.batchParsing.folderDeckMappings.length > 0) {
            this.config.folderDeckMappings = parsingSettings.batchParsing.folderDeckMappings.map((mapping) => {
                const legacyMapping = mapping;
                return {
                    ...mapping,
                    type: mapping.type ?? 'folder',
                    path: mapping.path ?? mapping.folderPath ?? '',
                    fileMode: legacyMapping.fileMode ?? 'single-card',
                };
            });
            this.logDebug('从 settings 恢复映射配置:', this.config.folderDeckMappings.length, '个映射');
        }
        else {
            this.logDebug('未找到持久化的映射配置，使用空列表');
        }
        // 初始化子服务
        this.fileSelector = new SimpleFileSelectorService(app.vault, app.metadataCache);
        this.deckMapping = new DeckMappingService(this.config.deckMapping || {
            enabled: false,
            rules: [],
            hierarchySeparator: '::'
        }, deckStorage);
        this.uuidManager = new UUIDManager(this.config.uuid, app.vault, uuidStorage);
        this.batchService = new SimpleBatchParsingService(this.config, this.fileSelector, this.deckMapping, this.uuidManager, parser, app, //  传入 app 实例
        plugin.dataStorage, // 🆕 传入 dataStorage（用于ThreeWayMergeEngine）
        plugin.blockLinkCleanupService, //  传入清理服务（用于保护新创建的UUID）
        plugin // 🆕 传入 plugin（用于ThreeWayMergeEngine访问directFileReader）
        );
        this.isInitialized = true;
    }
    /**
     * 注册命令到插件
     */
    registerCommands(_plugin) {
        //  已移除：命令1 - 执行批量解析（功能冗余，用户可以在设置面板手动触发）
        //  已移除：命令3 - 选择文件并解析（功能冗余，使用批量解析当前文件代替）
        //  已移除：命令4 - 清理孤立UUID和块链接（已统一到main.ts的两个清理命令中）
        // 现在所有清理功能统一使用：
        // -  清理当前文档（块链接、UUID、标注块等）
        // -  全局清理（扫描所有文档的残留元数据）
    }
    /**
     * 更新解析器设置
     * 用于运行时动态更新配置（例如用户在设置面板修改后）
     */
    updateParserSettings(newSettings) {
        this.config.parsingSettings = newSettings;
        this.parser.updateSettings(newSettings);
        this.batchService.updateConfig({
            parsingSettings: newSettings
        });
    }
    /**
     * 执行批量解析（ 重构后）
     * 职责：协调解析和保存，调用插件的统一保存流程
     */
    async executeBatchParsing() {
        //  权限检查：验证是否可以使用批量解析功能
        const premiumGuard = PremiumFeatureGuard.getInstance();
        if (!premiumGuard.canUseFeature(PREMIUM_FEATURES.BATCH_PARSING)) {
            new Notice('批量解析系统需要激活许可证才能使用');
            return null;
        }
        if (!this.isInitialized) {
            new Notice('批量解析服务未初始化');
            return null;
        }
        if (this.batchService.isProcessing()) {
            new Notice('批量解析正在进行中');
            return null;
        }
        //  关键修复：在执行前从 settings 同步最新配置，确保使用最新数据
        this.syncConfigFromSettings();
        //  改进验证逻辑：过滤掉无效映射，只处理有效的映射
        const validMappings = this.getValidMappings();
        if (validMappings.length === 0) {
            const configValidation = this.validateConfig();
            new Notice(`配置错误: ${configValidation.message}`);
            return null;
        }
        // 如果有无效映射，给出警告但不阻止执行
        const invalidMappings = this.getInvalidMappings();
        if (invalidMappings.length > 0) {
            const invalidPaths = invalidMappings.map(_m => {
                const mappingPath = _m.path || _m.folderPath;
                return mappingPath ? `"${mappingPath}"` : `ID: ${_m.id || '未知'}`;
            }).join(', ');
            new Notice(`检测到 ${invalidMappings.length} 个配置不完整的映射已跳过: ${invalidPaths}\n` +
                `将继续处理 ${validMappings.length} 个有效映射`, 6000);
        }
        // 临时更新配置，只使用有效的映射
        const originalMappings = this.config.folderDeckMappings;
        this.config.folderDeckMappings = validMappings;
        try {
            // 显示进度模态窗
            const progressModal = new BatchProgressModal(this.app, () => {
                this.batchService.abort();
            });
            progressModal.open();
            //  执行解析（获取 ParsedCard[] 和统计结果）
            const { parsedCards, result } = await this.batchService.executeBatchParsing((progress) => {
                progressModal.updateProgress(progress);
                if (this.progressCallback) {
                    this.progressCallback(progress);
                }
            });
            progressModal.close();
            if (parsedCards.length > 0) {
                new Notice(`开始保存 ${parsedCards.length} 张卡片...`);
                try {
                    await this.plugin.addCardsToDB(parsedCards);
                    result.successfulCards = parsedCards.length;
                    result.success = true;
                    // 保存UUID记录
                    let _uuidRecordsSaved = 0;
                    for (const card of parsedCards) {
                        const uuid = card.metadata?.uuid;
                        const cardId = card.id;
                        if (!uuid || !cardId) {
                            continue;
                        }
                        const sourceFilePath = card.sourceFile || card.metadata?.sourceFile || card.customFields?.obsidianFilePath;
                        if (!sourceFilePath) {
                            continue;
                        }
                        const file = this.app.vault.getAbstractFileByPath(sourceFilePath);
                        if (file instanceof TFile) {
                            try {
                                await this.uuidManager.saveRecord(uuid, cardId, file, 0);
                                _uuidRecordsSaved++;
                            }
                            catch (error) {
                                logger.error(`保存UUID记录失败 (${uuid}):`, error);
                            }
                        }
                    }
                }
                catch (saveError) {
                    logger.error('[BatchParsingManager] 保存卡片失败:', saveError);
                    result.errors.push({
                        file: 'system',
                        message: `保存失败: ${saveError instanceof Error ? saveError.message : '未知错误'}`,
                        error: saveError
                    });
                    result.success = false;
                }
            }
            // 显示结果
            this.showResult(result);
            // 恢复原始配置
            this.config.folderDeckMappings = originalMappings;
            return result;
        }
        catch (error) {
            logger.error('[BatchParsingManager] 批量解析失败:', error);
            new Notice(`批量解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
            // 恢复原始配置
            if (originalMappings) {
                this.config.folderDeckMappings = originalMappings;
            }
            return null;
        }
    }
    /**
     * 解析单个文件（使用映射逻辑）
     * 替代旧的 main.batchParseCurrentFile()
     */
    async parseSingleFile(file) {
        try {
            const result = await this.batchService.parseSingleFileWithMapping(file);
            if (!result.success) {
                new Notice(result.message || '解析失败', 8000);
                return;
            }
            if (result.parsedCards && result.parsedCards.length > 0) {
                new Notice(`开始保存 ${result.parsedCards.length} 张卡片...`);
                await this.plugin.addCardsToDB(result.parsedCards);
                new Notice(`成功保存 ${result.parsedCards.length} 张卡片到指定牌组`);
            }
            else {
                new Notice('未找到可解析的卡片');
            }
        }
        catch (error) {
            logger.error('解析文件失败:', error);
            new Notice(`解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    //  已移除：openFileSelector - 功能冗余，未使用
    /**
     * 清理UUID记录
     */
    async cleanupUUIDs() {
        try {
            // 获取清理服务实例
            const cleanupService = BlockLinkCleanupService.getInstance();
            const detector = cleanupService.getDetector();
            if (!detector) {
                new Notice('清理服务未初始化', 3000);
                return;
            }
            // 创建全局扫描器
            const scanner = new GlobalCleanupScanner(cleanupService, detector, this.app.vault, this.app);
            // 创建进度模态窗口
            const modal = new CleanupProgressModal(this.app, scanner);
            modal.open();
            // 执行扫描和清理（包括UUID）
            const result = await scanner.scanAndCleanup((progress) => {
                modal.updateProgress(progress);
            });
            // 显示结果
            modal.showResult(result);
            // 显示通知
            if (result.cleanedOrphans > 0) {
                new Notice(`清理完成：已清理 ${result.cleanedOrphans} 个孤立UUID和块链接`, 5000);
            }
            else {
                new Notice('扫描完成：未发现孤立的UUID或块链接', 3000);
            }
        }
        catch (error) {
            logger.error('[BatchParsingManager] UUID清理失败:', error);
            new Notice('UUID清理失败，请查看控制台', 3000);
        }
    }
    /**
     * 更新配置（ 重构后）
     *  v2: 同步更新到 plugin settings
     */
    async updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        //  同步映射配置到 plugin settings（添加安全检查）
        if (updates.folderDeckMappings && this.plugin?.settings?.simplifiedParsing?.batchParsing) {
            this.plugin.settings.simplifiedParsing.batchParsing.folderDeckMappings =
                updates.folderDeckMappings;
            this.logDebug('同步映射配置到 settings:', updates.folderDeckMappings.length, '个映射');
            //  关键修复：立即保存到磁盘
            try {
                await this.plugin.saveSettings();
                this.logDebug('✅ 配置已保存到磁盘');
            }
            catch (error) {
                logger.error('❌ [BatchParsingManager] 保存配置失败:', error);
            }
        }
        else if (updates.folderDeckMappings) {
            logger.warn('[BatchParsingManager] 无法同步映射配置：settings.simplifiedParsing.batchParsing 不存在');
        }
        // 更新子服务配置
        if (updates.deckMapping) {
            this.deckMapping.updateConfig(updates.deckMapping);
        }
        if (updates.uuid) {
            this.uuidManager.updateConfig(updates.uuid);
        }
        this.batchService.updateConfig(this.config);
    }
    /**
     * 🆕 更新文件夹牌组映射列表（便捷方法）
     */
    async updateMappings(mappings) {
        await this.updateConfig({ folderDeckMappings: mappings });
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     *  验证配置完整性
     */
    validateConfig() {
        // 检查是否有文件夹映射配置
        if (!this.config.folderDeckMappings || this.config.folderDeckMappings.length === 0) {
            return {
                valid: false,
                message: '请先配置文件夹与牌组的映射关系'
            };
        }
        // 检查是否有启用的映射
        const enabledMappings = this.config.folderDeckMappings.filter(m => m.enabled);
        if (enabledMappings.length === 0) {
            return {
                valid: false,
                message: '没有启用的文件夹映射，请至少启用一个映射'
            };
        }
        // 检查映射配置的完整性
        const invalidMappings = [];
        for (const mapping of enabledMappings) {
            // 🆕 支持 path 或 folderPath 字段（向后兼容）
            const mappingPath = mapping.path || mapping.folderPath;
            if (!mappingPath) {
                invalidMappings.push(`映射 ID: ${mapping.id || '未知'} (未配置路径)`);
            }
            else if (!mapping.targetDeckId) {
                invalidMappings.push(`映射 "${mappingPath}" (未配置目标牌组)`);
            }
        }
        if (invalidMappings.length > 0) {
            return {
                valid: false,
                message: `存在配置不完整的映射：\n${invalidMappings.join('\n')}\n\n请在插件设置中检查并完善映射配置。`
            };
        }
        return { valid: true, message: '' };
    }
    /**
     *  获取有效的映射配置（路径和目标牌组都已配置）
     */
    getValidMappings() {
        if (!this.config.folderDeckMappings || this.config.folderDeckMappings.length === 0) {
            return [];
        }
        return this.config.folderDeckMappings.filter(_m => {
            if (!_m.enabled)
                return false;
            const mappingPath = _m.path || _m.folderPath;
            return mappingPath && _m.targetDeckId;
        });
    }
    /**
     *  获取无效的映射配置（用于警告）
     */
    getInvalidMappings() {
        if (!this.config.folderDeckMappings || this.config.folderDeckMappings.length === 0) {
            return [];
        }
        return this.config.folderDeckMappings.filter(_m => {
            if (!_m.enabled)
                return false;
            const mappingPath = _m.path || _m.folderPath;
            return !mappingPath || !_m.targetDeckId;
        });
    }
    /**
     *  从 plugin settings 同步最新配置
     * 确保使用最新的映射配置，避免配置不同步问题
     * 在 executeBatchParsing 执行前调用，确保验证时使用最新配置
     */
    syncConfigFromSettings() {
        if (!this.plugin?.settings?.simplifiedParsing?.batchParsing) {
            this.logDebug('无法同步配置：settings.simplifiedParsing.batchParsing 不存在');
            return;
        }
        const settingsMappings = this.plugin.settings.simplifiedParsing.batchParsing.folderDeckMappings;
        if (settingsMappings && Array.isArray(settingsMappings) && settingsMappings.length > 0) {
            const oldCount = this.config.folderDeckMappings?.length || 0;
            this.config.folderDeckMappings = settingsMappings;
            this.logDebug('已从 settings 同步最新映射配置:', settingsMappings.length, '个映射', oldCount !== settingsMappings.length ? `(变化: ${oldCount} → ${settingsMappings.length})` : '(无变化)');
            // 同步更新到子服务
            this.batchService.updateConfig({ folderDeckMappings: settingsMappings });
        }
        else {
            this.logDebug('settings 中没有映射配置，保持当前配置');
        }
    }
    /**
     * 设置进度回调
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    /**
     * 显示结果
     */
    showResult(result) {
        const duration = (result.stats.processingTime / 1000).toFixed(1);
        if (result.success) {
            new Notice(`✅ 批量解析完成\n成功: ${result.successfulCards}/${result.totalCards} 张卡片\n处理文件: ${result.stats.filesProcessed} 个\n用时: ${duration}秒`, 8000);
        }
        else {
            new Notice(`⚠️ 批量解析完成（有错误）\n成功: ${result.successfulCards}/${result.totalCards} 张卡片\n错误: ${result.errors.length} 个文件失败\n用时: ${duration}秒`, 10000);
        }
        // 记录详细信息
        this.logDebug('批量解析结果:', {
            ...result,
            errors: result.errors.map(e => ({
                file: e.file,
                message: e.message
            }))
        });
    }
    /**
     * 扫描单个文件夹映射并解析卡片
     *  重构：返回解析的卡片，由上层负责保存
     * @param mapping 要扫描的映射配置
     * @param onProgress 进度回调
     * @returns 扫描结果（包含解析的卡片）
     */
    async scanSingleMapping(mapping, onProgress) {
        if (!this.isInitialized) {
            throw new Error('批量解析服务未初始化');
        }
        return await this.batchService.scanSingleMapping(mapping, onProgress);
    }
    /**
     * 统计单个映射中的卡片数量
     * @param mapping 映射配置
     * @returns 卡片数量
     */
    async countCardsInMapping(mapping) {
        if (!this.isInitialized) {
            throw new Error('批量解析服务未初始化');
        }
        return await this.batchService.countCardsInMapping(mapping);
    }
    /**
     * 销毁管理器
     */
    destroy() {
        // 清理资源
        this.deckMapping.clearCache();
        this.isInitialized = false;
    }
}
/**
 * 批量解析进度模态窗
 */
class BatchProgressModal extends Modal {
    //  修复：删除 contentEl 属性遮蔽，使用父类 Modal 提供的 contentEl
    // private contentEl: HTMLElement;  ← 已删除，避免遮蔽父类属性
    progressBar; // 在onOpen中初始化
    statusText; // 在onOpen中初始化
    detailsText; // 在onOpen中初始化
    onCancel;
    constructor(app, onCancel) {
        super(app);
        this.onCancel = onCancel;
    }
    onOpen() {
        //  使用父类提供的 this.contentEl（由 Obsidian Modal 框架初始化）
        // logDebug 不可用，因为这是静态模态窗类
        this.contentEl.empty();
        this.contentEl.addClass('batch-progress-modal');
        // 标题
        const _title = this.contentEl.createEl('h2', { text: '批量解析进行中' });
        // 进度条
        const progressContainer = this.contentEl.createDiv('progress-container');
        this.progressBar = progressContainer.createDiv('progress-bar');
        this.progressBar.style.width = '0%';
        // 状态文本
        this.statusText = this.contentEl.createDiv('status-text');
        this.statusText.setText('正在初始化...');
        // 详细信息
        this.detailsText = this.contentEl.createDiv('details-text');
        // 取消按钮
        const cancelBtn = this.contentEl.createEl('button', { text: '取消' });
        cancelBtn.onclick = () => {
            this.onCancel();
            this.close();
        };
        // 添加样式
        this.addStyles();
    }
    updateProgress(progress) {
        this.progressBar.style.width = `${progress.percentage}%`;
        this.statusText.setText(`正在处理: ${progress.currentFile} (${progress.processedFiles}/${progress.totalFiles})`);
        this.detailsText.setText(`成功: ${progress.successCount} | 失败: ${progress.errorCount}`);
    }
    addStyles() {
        // 样式已迁移到 styles/dynamic-injected.css
    }
    onClose() {
        //  修复：使用 this.contentEl 确保正确访问
        this.contentEl.empty();
    }
}
