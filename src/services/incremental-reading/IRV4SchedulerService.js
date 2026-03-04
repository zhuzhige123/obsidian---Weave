/**
 * 增量阅读 V4 调度服务
 *
 * 整合 IRStateMachineV4 + IRChunkScheduleAdapter + IRTagGroupService
 * 提供完整的 V4 调度能力，替代 V3 IRSchedulingFacade
 *
 * @module services/incremental-reading/IRV4SchedulerService
 * @version 4.0.0
 */
import { Notice } from 'obsidian';
import { IRStateMachineV4 } from './IRStateMachineV4';
import { IRChunkScheduleAdapter } from './IRChunkScheduleAdapter';
import { IRTagGroupService } from './IRTagGroupService';
import { IRStorageService } from './IRStorageService';
import { IRStorageAdapterV4 } from './IRStorageAdapterV4';
import { IRQueueGeneratorV4 } from './IRQueueGeneratorV4';
import { IRPdfBookmarkTaskService, isPdfBookmarkTaskId } from './IRPdfBookmarkTaskService';
import { resolveIRImportFolder } from '../../config/paths';
import { calculateNextInterval, calculateNextRepDate, calculatePriorityEWMA, M_BASE } from './IRCoreAlgorithmsV4';
import { calculateLoadSignal } from './IRSchedulerV3';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/helpers';
import { DEFAULT_ADVANCED_SCHEDULE_SETTINGS, migrateToIRBlockV4 } from '../../types/ir-types';
import { PLUGIN_PATHS } from '../../config/paths';
/**
 * V4 调度服务
 */
export class IRV4SchedulerService {
    app;
    stateMachine;
    chunkAdapter;
    tagGroupService;
    storageService;
    storageAdapterV4;
    queueGenerator;
    _pdfBookmarkTaskService;
    initialized = false;
    constructor(app, chunkRoot) {
        this.app = app;
        this.stateMachine = new IRStateMachineV4();
        this.storageService = new IRStorageService(app);
        const plugin = app?.plugins?.getPlugin?.('weave');
        const parentFolder = plugin?.settings?.weaveParentFolder;
        this.chunkAdapter = new IRChunkScheduleAdapter(app, this.storageService, resolveIRImportFolder(chunkRoot, parentFolder));
        this.tagGroupService = new IRTagGroupService(app);
        this.storageAdapterV4 = new IRStorageAdapterV4(app);
        this.queueGenerator = new IRQueueGeneratorV4();
        this._pdfBookmarkTaskService = new IRPdfBookmarkTaskService(app);
    }
    get pdfBookmarkTaskService() {
        return this._pdfBookmarkTaskService;
    }
    /**
     * 初始化服务
     */
    async initialize() {
        if (this.initialized)
            return;
        await this.storageService.initialize();
        await this.tagGroupService.initialize();
        await this._pdfBookmarkTaskService.initialize();
        try {
            this.autoBackfillTagGroupsOnce().catch((error) => {
                logger.warn('[IRV4SchedulerService] autoBackfillTagGroupsOnce 失败:', error);
            });
        }
        catch (error) {
            logger.warn('[IRV4SchedulerService] autoBackfillTagGroupsOnce 失败:', error);
        }
        this.initialized = true;
        logger.info('[IRV4SchedulerService] 初始化完成');
    }
    async autoBackfillTagGroupsOnce() {
        const adapter = this.app.vault.adapter;
        const markerPath = `${PLUGIN_PATHS.migration.root}/ir-taggroup-backfill-v1.json`;
        try {
            if (await adapter.exists(markerPath)) {
                return;
            }
        }
        catch {
        }
        let sources = {};
        let chunks = {};
        try {
            sources = await this.storageService.getAllSources();
            chunks = await this.storageService.getAllChunkData();
        }
        catch (error) {
            logger.warn('[IRV4SchedulerService] 读取 sources/chunks 失败，跳过 tagGroup 回填:', error);
            return;
        }
        const updatedSources = [];
        const updatedChunks = [];
        let updatedSourceCount = 0;
        let updatedChunkCount = 0;
        for (const source of Object.values(sources)) {
            const currentGroup = source?.tagGroup;
            if (currentGroup && currentGroup !== 'default') {
                continue;
            }
            const originalPath = source?.originalPath;
            if (typeof originalPath !== 'string' || !originalPath.trim()) {
                continue;
            }
            let matched = 'default';
            try {
                matched = await this.tagGroupService.matchGroupForDocument(originalPath, true);
            }
            catch {
                matched = 'default';
            }
            if (matched !== currentGroup) {
                updatedSources.push({
                    ...source,
                    tagGroup: matched,
                    updatedAt: Date.now()
                });
                updatedSourceCount++;
            }
            const chunkIds = source?.chunkIds;
            if (Array.isArray(chunkIds)) {
                for (const chunkId of chunkIds) {
                    const chunk = chunks[chunkId];
                    if (!chunk)
                        continue;
                    const currentChunkGroup = chunk?.meta?.tagGroup;
                    if (!currentChunkGroup || currentChunkGroup === 'default') {
                        chunk.meta = {
                            ...chunk.meta,
                            tagGroup: matched
                        };
                        chunk.updatedAt = Date.now();
                        updatedChunks.push(chunk);
                        updatedChunkCount++;
                    }
                }
            }
        }
        try {
            if (updatedSources.length > 0) {
                await this.storageService.saveSourceBatch(updatedSources);
            }
            if (updatedChunks.length > 0) {
                await this.storageService.saveChunkDataBatch(updatedChunks);
            }
        }
        catch (error) {
            logger.warn('[IRV4SchedulerService] 写回 tagGroup 回填失败:', error);
            return;
        }
        try {
            if (!(await adapter.exists(PLUGIN_PATHS.migration.root))) {
                await adapter.mkdir(PLUGIN_PATHS.migration.root);
            }
            await adapter.write(markerPath, JSON.stringify({
                version: 1,
                completedAt: new Date().toISOString(),
                updatedSourceCount,
                updatedChunkCount
            }, null, 2));
        }
        catch {
        }
        if (updatedSourceCount > 0 || updatedChunkCount > 0) {
            logger.info(`[IRV4SchedulerService] tagGroup 回填完成: sources=${updatedSourceCount}, chunks=${updatedChunkCount}`);
        }
    }
    getAdvancedSettingsSnapshot() {
        const defaults = DEFAULT_ADVANCED_SCHEDULE_SETTINGS;
        try {
            const plugin = this.app?.plugins?.getPlugin?.('weave');
            const ir = plugin?.settings?.incrementalReading;
            const enableTagGroupPrior = ir?.enableTagGroupPrior ?? defaults.enableTagGroupPrior;
            return {
                ...defaults,
                dailyTimeBudgetMinutes: ir?.dailyTimeBudgetMinutes ?? defaults.dailyTimeBudgetMinutes,
                maxAppearancesPerDay: ir?.maxAppearancesPerDay ?? defaults.maxAppearancesPerDay,
                enableTagGroupPrior,
                agingStrength: ir?.agingStrength ?? defaults.agingStrength,
                autoPostponeStrategy: ir?.autoPostponeStrategy ?? defaults.autoPostponeStrategy,
                priorityHalfLifeDays: ir?.priorityHalfLifeDays ?? defaults.priorityHalfLifeDays,
                tagGroupLearningSpeed: enableTagGroupPrior ? 'medium' : 'off',
                defaultIntervalFactor: ir?.defaultIntervalFactor ?? defaults.defaultIntervalFactor,
                maxIntervalDays: ir?.maxInterval ?? defaults.maxIntervalDays
            };
        }
        catch {
            return defaults;
        }
    }
    /**
     * 获取标签组跟随模式设置
     */
    getTagGroupFollowMode() {
        try {
            const plugin = this.app?.plugins?.getPlugin?.('weave');
            return plugin?.settings?.incrementalReading?.tagGroupFollowMode ?? 'ask';
        }
        catch {
            return 'ask';
        }
    }
    async getStudyQueueV4(deckPath, options) {
        await this.initialize();
        const advSettings = this.getAdvancedSettingsSnapshot();
        const markActive = options?.markActive ?? true;
        const timeBudgetMinutes = options?.timeBudgetMinutes ?? advSettings.dailyTimeBudgetMinutes ?? 40;
        const currentSourcePath = options?.currentSourcePath ?? null;
        // 同步 agingStrength 到队列生成器
        this.queueGenerator.setAgingStrength(advSettings.agingStrength);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const dueCutoffMs = endOfToday.getTime();
        const preloadedBlocks = Array.isArray(options?.preloadedBlocks) && options.preloadedBlocks.length > 0
            ? options.preloadedBlocks
            : null;
        const chunkBlocks = preloadedBlocks ? preloadedBlocks : await this.storageAdapterV4.getBlocksByDeckV4(deckPath);
        let pdfTaskBlocks = [];
        try {
            const tasks = await this._pdfBookmarkTaskService.getTasksByDeck(deckPath);
            pdfTaskBlocks = tasks.map(t => this._pdfBookmarkTaskService.toBlockV4(t));
        }
        catch (error) {
            logger.warn('[IRV4SchedulerService] 读取 PDF 书签任务失败（将继续仅使用 chunk 队列）:', error);
        }
        const allBlocks = [...chunkBlocks, ...pdfTaskBlocks];
        // maxAppearancesPerDay 过滤：跳过今日已达上限的块
        const maxPerDay = advSettings.maxAppearancesPerDay ?? 2;
        const todayStr = new Date().toISOString().slice(0, 10);
        const blocks = allBlocks.filter(b => {
            if (b.status === 'done' || b.status === 'suspended' || b.status === 'removed')
                return false;
            const count = b.stats.todayShownDate === todayStr ? (b.stats.todayShownCount || 0) : 0;
            return count < maxPerDay;
        });
        if (blocks.length === 0) {
            return {
                queue: [],
                totalEstimatedMinutes: 0,
                stats: {
                    candidateCount: 0,
                    scheduledCount: 0,
                    groupDistribution: {},
                    overBudget: false,
                    overBudgetRatio: 0,
                    persistedTransitions: 0,
                    activeBlockId: null
                }
            };
        }
        const originalById = new Map();
        for (const b of blocks)
            originalById.set(b.id, b);
        const transitioned = [];
        for (const block of blocks) {
            let next = block;
            if (next.status === 'scheduled' && next.nextRepDate > dueCutoffMs) {
                next = {
                    ...next,
                    status: 'queued',
                    updatedAt: Date.now()
                };
            }
            if (next.status === 'new') {
                next = this.stateMachine.transitionToQueued(next, 1);
            }
            if (next.status === 'queued' && (next.nextRepDate === 0 || next.nextRepDate <= dueCutoffMs)) {
                next = {
                    ...next,
                    status: 'scheduled',
                    updatedAt: Date.now()
                };
            }
            transitioned.push(next);
        }
        let persistedTransitions = 0;
        const pendingChunkUpdates = [];
        for (const updated of transitioned) {
            const original = originalById.get(updated.id);
            if (!original)
                continue;
            const changed = original.status !== updated.status ||
                original.intervalDays !== updated.intervalDays ||
                original.nextRepDate !== updated.nextRepDate;
            if (!changed)
                continue;
            if (isPdfBookmarkTaskId(updated.id)) {
                await this._pdfBookmarkTaskService.updateTaskFromBlock(updated);
                persistedTransitions++;
                continue;
            }
            pendingChunkUpdates.push({
                chunkId: updated.id,
                data: {
                    scheduleStatus: updated.status,
                    intervalDays: updated.intervalDays,
                    nextRepDate: updated.nextRepDate
                }
            });
            persistedTransitions++;
        }
        if (pendingChunkUpdates.length > 0) {
            await this.chunkAdapter.batchUpdateChunkSchedules(pendingChunkUpdates);
        }
        const activeBlock = this.stateMachine.getActiveBlock(transitioned);
        const groupMapping = {};
        for (const b of transitioned) {
            groupMapping[b.id] = b.meta?.tagGroup || 'default';
        }
        let candidates = this.stateMachine.getCandidatePool(transitioned);
        // 自动后推：过载时将低优先级 scheduled 块推迟
        const postponeStrategy = advSettings.autoPostponeStrategy;
        if (postponeStrategy !== 'off' && candidates.length > 0) {
            const AUTO_POSTPONE_CFG = {
                gentle: { priorityThreshold: 3, postponeDays: 1 },
                aggressive: { priorityThreshold: 5, postponeDays: 3 }
            };
            const totalCost = candidates.reduce((sum, b) => {
                const cost = (b.stats.impressions > 0 && b.stats.effectiveReadingTimeSec > 0)
                    ? (b.stats.effectiveReadingTimeSec / b.stats.impressions) / 60 : 2;
                return sum + cost;
            }, 0);
            const isOverloaded = totalCost > timeBudgetMinutes * 1.5;
            if (isOverloaded) {
                const cfg = AUTO_POSTPONE_CFG[postponeStrategy];
                if (cfg) {
                    const postponeUpdates = [];
                    const remaining = [];
                    for (const block of candidates) {
                        if (block.priorityEff <= cfg.priorityThreshold) {
                            const newDate = Date.now() + cfg.postponeDays * 24 * 60 * 60 * 1000;
                            postponeUpdates.push({
                                chunkId: block.id,
                                data: { scheduleStatus: 'queued', nextRepDate: newDate }
                            });
                        }
                        else {
                            remaining.push(block);
                        }
                    }
                    if (postponeUpdates.length > 0) {
                        await this.chunkAdapter.batchUpdateChunkSchedules(postponeUpdates);
                        candidates = remaining;
                        logger.info(`[IRV4SchedulerService] 自动后推 ${postponeUpdates.length} 个低优先级块 (策略=${postponeStrategy})`);
                    }
                }
            }
        }
        let generatedQueue = this.queueGenerator.generateQueue(candidates, groupMapping, undefined, timeBudgetMinutes, currentSourcePath);
        let queue;
        let activeBlockId = null;
        if (activeBlock) {
            activeBlockId = activeBlock.id;
            queue = [activeBlock, ...generatedQueue.queue.filter(b => b.id !== activeBlock.id)];
        }
        else {
            queue = [...generatedQueue.queue];
        }
        if (!activeBlock && markActive && queue.length > 0) {
            const first = queue[0];
            if (first.status === 'scheduled') {
                const updatedFirst = this.stateMachine.transitionToActive(first);
                queue[0] = updatedFirst;
                activeBlockId = updatedFirst.id;
                if (isPdfBookmarkTaskId(updatedFirst.id)) {
                    await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedFirst);
                    await this._pdfBookmarkTaskService.recordTaskInteraction(updatedFirst.id, 0, {});
                    persistedTransitions++;
                }
                else {
                    await this.chunkAdapter.updateChunkSchedule(updatedFirst.id, {
                        scheduleStatus: updatedFirst.status
                    });
                    await this.chunkAdapter.recordChunkInteraction(updatedFirst.id, 0, {});
                    persistedTransitions++;
                }
            }
        }
        return {
            queue,
            totalEstimatedMinutes: generatedQueue.totalEstimatedMinutes,
            stats: {
                ...generatedQueue.stats,
                persistedTransitions,
                activeBlockId
            }
        };
    }
    /**
     * 完成内容块（V4 版本）
     *
     * @param blockV4 V4 格式内容块
     * @param data 完成数据
     * @param deckPath 牌组路径（用于会话记录）
     * @returns 更新后的块和调度信息
     */
    async completeBlockV4(blockV4, data, deckPath = '') {
        await this.initialize();
        const now = Date.now();
        // 1. 获取标签组参数
        const advancedSettings = this.getAdvancedSettingsSnapshot();
        const tagGroup = blockV4.meta?.tagGroup || 'default';
        const profile = await this.tagGroupService.getProfile(tagGroup);
        const mGroup = advancedSettings.enableTagGroupPrior ? (profile.intervalFactorBase || 1.0) : 1.0;
        // 2. 更新统计数据
        let updatedBlock = this.stateMachine.updateStats(blockV4, data.readingTimeSeconds, Math.min(data.readingTimeSeconds, 600), // 有效时长最多10分钟
        data.createdExtractCount, data.createdCardCount, data.createdNoteCount);
        // 3. 根据评分计算优先级调整
        // rating: 1=完全不懂, 2=有点困难, 3=基本理解, 4=完全掌握
        const ratingPriorityAdjust = {
            1: 2, // 不懂 → 优先级+2
            2: 1, // 困难 → 优先级+1
            3: 0, // 基本理解 → 不变
            4: -1 // 掌握 → 优先级-1
        };
        const priorityDelta = ratingPriorityAdjust[data.rating] || 0;
        const newPriorityUi = Math.max(0, Math.min(10, data.priorityUi + priorityDelta));
        // 更新优先级（使用时间感知 EWMA，读取 halfLifeDays 设置）
        const halfLifeDays = advancedSettings.priorityHalfLifeDays;
        const lastInteractionMs = updatedBlock.stats.lastInteraction || 0;
        let newPriorityEff = calculatePriorityEWMA(newPriorityUi, updatedBlock.priorityEff, halfLifeDays, lastInteractionMs > 0 ? lastInteractionMs : undefined);
        // v3.1: 注入标注信号（若UI层传入了预计算的信号值）
        if (data.annotationSignal && data.annotationSignal > 0) {
            const baseEff = calculatePriorityEWMA(newPriorityUi, updatedBlock.priorityEff, halfLifeDays, lastInteractionMs > 0 ? lastInteractionMs : undefined);
            newPriorityEff = Math.max(0, Math.min(10, newPriorityEff + data.annotationSignal));
            logger.debug(`[IRV4SchedulerService] 标注信号注入: +${data.annotationSignal.toFixed(2)}, ` +
                `priorityEff: ${baseEff.toFixed(2)} → ${newPriorityEff.toFixed(2)}`);
        }
        updatedBlock = {
            ...updatedBlock,
            priorityUi: newPriorityUi,
            priorityEff: newPriorityEff
        };
        // 4. 状态迁移: active → queued（重新入队）
        // 读取用户配置的间隔因子和最大间隔
        const mBase = advancedSettings.defaultIntervalFactor ?? M_BASE;
        const maxInterval = advancedSettings.maxIntervalDays ?? 365;
        if (updatedBlock.status === 'active') {
            updatedBlock = this.stateMachine.transitionBackToQueued(updatedBlock, mBase, mGroup, maxInterval);
        }
        else if (updatedBlock.status === 'scheduled') {
            updatedBlock = this.stateMachine.transitionToActive(updatedBlock);
            updatedBlock = this.stateMachine.transitionBackToQueued(updatedBlock, mBase, mGroup, maxInterval);
        }
        else {
            const newInterval = calculateNextInterval(updatedBlock.intervalDays || 1, mBase, mGroup, updatedBlock.priorityEff, maxInterval);
            const newNextRepDate = calculateNextRepDate(newInterval);
            updatedBlock = {
                ...updatedBlock,
                intervalDays: newInterval,
                nextRepDate: newNextRepDate,
                status: 'queued',
                updatedAt: now
            };
        }
        // 5. 持久化调度
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
            await this._pdfBookmarkTaskService.recordTaskInteraction(updatedBlock.id, data.readingTimeSeconds, {
                extracts: data.createdExtractCount,
                cardsCreated: data.createdCardCount,
                notesWritten: data.createdNoteCount
            });
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                priorityUi: updatedBlock.priorityUi,
                priorityEff: updatedBlock.priorityEff,
                intervalDays: updatedBlock.intervalDays,
                nextRepDate: updatedBlock.nextRepDate,
                scheduleStatus: updatedBlock.status
            });
            // 6. 记录交互统计
            await this.chunkAdapter.recordChunkInteraction(updatedBlock.id, data.readingTimeSeconds, {
                extracts: data.createdExtractCount,
                cardsCreated: data.createdCardCount,
                notesWritten: data.createdNoteCount
            });
        }
        // 7. 记录会话历史
        await this.recordSession(updatedBlock, data, deckPath, 'completed');
        // 8. 更新标签组参数（学习信号）- 使用已有的 updateGroupProfile 方法
        if (advancedSettings.tagGroupLearningSpeed !== 'off') {
            const loadSignal = calculateLoadSignal(data.readingTimeSeconds, data.createdCardCount, data.createdExtractCount, data.createdNoteCount);
            const priorityEff = updatedBlock.priorityEff ?? 5;
            const priorityWeight = Math.max(advancedSettings.priorityWeightClamp[0], Math.min(advancedSettings.priorityWeightClamp[1], 0.5 + priorityEff / 10));
            await this.tagGroupService.updateGroupProfile(tagGroup, loadSignal, priorityWeight, advancedSettings);
        }
        // 9. 标签漂移检测：检查源文档标签是否变化导致匹配到不同标签组
        if (!isPdfBookmarkTaskId(updatedBlock.id) && advancedSettings.enableTagGroupPrior) {
            try {
                const followMode = this.getTagGroupFollowMode();
                if (followMode !== 'off') {
                    // 通过 sourceId 获取源文档的真实原始路径（而非 chunk 文件路径）
                    const chunkData = await this.storageService.getChunkData(updatedBlock.id);
                    const sourceId = chunkData?.sourceId;
                    const source = sourceId ? await this.storageService.getSource(sourceId) : null;
                    const originalPath = source?.originalPath || updatedBlock.sourcePath;
                    if (originalPath) {
                        // 检查源文件是否存在，不存在则跳过漂移检测
                        const sourceFile = this.app.vault.getAbstractFileByPath(originalPath);
                        if (sourceFile) {
                            const drift = await this.tagGroupService.detectTagGroupDrift(originalPath, tagGroup);
                            if (drift) {
                                const storageAdapter = {
                                    getChunkData: (id) => this.storageService.getChunkData(id),
                                    saveChunkData: (d) => this.storageService.saveChunkData(d),
                                    getSource: (id) => this.storageService.getSource(id),
                                    saveSource: (d) => this.storageService.saveSource(d),
                                    getAllChunkData: () => this.storageService.getAllChunkData()
                                };
                                if (followMode === 'auto') {
                                    // 静默自动切换（批量更新同源所有 chunk）
                                    await this.tagGroupService.applyTagGroupSwitch(updatedBlock.id, sourceId, drift.newGroupId, storageAdapter);
                                    updatedBlock = {
                                        ...updatedBlock,
                                        meta: { ...updatedBlock.meta, tagGroup: drift.newGroupId }
                                    };
                                    logger.info(`[IRV4SchedulerService] 标签组自动切换: ${updatedBlock.id}, ` +
                                        `${drift.oldGroupName} -> ${drift.newGroupName}`);
                                }
                                else {
                                    // ask 模式：弹出通知提醒用户
                                    const blockId = updatedBlock.id;
                                    const capturedSourceId = sourceId;
                                    const newGroupId = drift.newGroupId;
                                    const fragment = document.createDocumentFragment();
                                    const msgEl = fragment.createEl('div');
                                    msgEl.createEl('div', {
                                        text: `"${originalPath.split('/').pop()}" 的标签已变化`
                                    });
                                    msgEl.createEl('div', {
                                        text: `匹配到新标签组「${drift.newGroupName}」（原：「${drift.oldGroupName}」）`,
                                        attr: { style: 'margin-top: 4px; opacity: 0.8; font-size: 0.9em;' }
                                    });
                                    const btnRow = msgEl.createEl('div', {
                                        attr: { style: 'margin-top: 8px; display: flex; gap: 8px;' }
                                    });
                                    const switchBtn = btnRow.createEl('button', { text: '切换' });
                                    switchBtn.style.cssText = 'padding: 2px 12px; cursor: pointer;';
                                    const keepBtn = btnRow.createEl('button', { text: '保持' });
                                    keepBtn.style.cssText = 'padding: 2px 12px; cursor: pointer;';
                                    const notice = new Notice(fragment, 15000);
                                    switchBtn.addEventListener('click', async () => {
                                        try {
                                            await this.tagGroupService.applyTagGroupSwitch(blockId, capturedSourceId, newGroupId, storageAdapter);
                                            new Notice(`已切换到标签组「${drift.newGroupName}」`);
                                        }
                                        catch (e) {
                                            logger.error('[IRV4SchedulerService] 标签组切换失败:', e);
                                        }
                                        notice.hide();
                                    });
                                    keepBtn.addEventListener('click', () => {
                                        notice.hide();
                                    });
                                }
                            }
                        }
                    }
                }
            }
            catch (driftError) {
                logger.debug('[IRV4SchedulerService] 标签漂移检测失败（不影响主流程）:', driftError);
            }
        }
        logger.info(`[IRV4SchedulerService] completeBlockV4: ${updatedBlock.id}, ` +
            `rating=${data.rating}, interval=${updatedBlock.intervalDays.toFixed(1)}d, ` +
            `nextRep=${new Date(updatedBlock.nextRepDate).toLocaleDateString()}`);
        return {
            block: updatedBlock,
            nextRepDate: updatedBlock.nextRepDate,
            intervalDays: updatedBlock.intervalDays
        };
    }
    /**
     * 跳过内容块（不更新调度间隔，仅记录）
     *
     * @param blockV4 V4 格式内容块
     * @param deckPath 牌组路径
     */
    async skipBlockV4(blockV4, deckPath = '') {
        await this.initialize();
        // 记录会话（跳过）
        await this.recordSession(blockV4, {
            rating: 0,
            readingTimeSeconds: 0,
            priorityUi: blockV4.priorityUi,
            createdCardCount: 0,
            createdExtractCount: 0,
            createdNoteCount: 0
        }, deckPath, 'skipped');
        logger.debug(`[IRV4SchedulerService] skipBlockV4: ${blockV4.id}`);
    }
    /**
     * 更新优先级（带强制理由）
     *
     * @param blockV4 V4 格式内容块
     * @param newPriorityUi 新优先级 (0-10)
     * @param reason 变更理由
     * @returns 更新后的块
     */
    async updatePriorityV4(blockV4, newPriorityUi, reason) {
        await this.initialize();
        // 使用状态机更新优先级
        const updatedBlock = this.stateMachine.updatePriority(blockV4, newPriorityUi, reason);
        // 持久化
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                priorityUi: updatedBlock.priorityUi,
                priorityEff: updatedBlock.priorityEff
            });
        }
        logger.info(`[IRV4SchedulerService] updatePriorityV4: ${updatedBlock.id}, ` +
            `UI=${blockV4.priorityUi}→${newPriorityUi}, Eff=${updatedBlock.priorityEff.toFixed(2)}`);
        return updatedBlock;
    }
    /**
     * 搁置内容块（暂停调度，可恢复）
     */
    async suspendBlockV4(blockV4) {
        await this.initialize();
        const updatedBlock = this.stateMachine.transitionToSuspended(blockV4);
        // 持久化
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                scheduleStatus: 'suspended'
            });
        }
        logger.info(`[IRV4SchedulerService] suspendBlockV4: ${updatedBlock.id}`);
        return updatedBlock;
    }
    /**
     * 恢复内容块
     */
    async resumeBlockV4(blockV4) {
        await this.initialize();
        let updatedBlock;
        if (blockV4.status === 'suspended') {
            updatedBlock = this.stateMachine.resumeFromSuspended(blockV4);
        }
        else {
            // 非 suspended 状态，设置为 queued 并立即到期
            updatedBlock = {
                ...blockV4,
                status: 'queued',
                nextRepDate: Date.now(),
                updatedAt: Date.now()
            };
        }
        // 持久化
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                scheduleStatus: updatedBlock.status,
                nextRepDate: updatedBlock.nextRepDate
            });
        }
        logger.info(`[IRV4SchedulerService] resumeBlockV4: ${updatedBlock.id}`);
        return updatedBlock;
    }
    /**
     * 归档内容块（用户已完全理解，正面完成）
     */
    async archiveBlockV4(blockV4) {
        await this.initialize();
        let updatedBlock;
        if (blockV4.status === 'active') {
            updatedBlock = this.stateMachine.transitionToDone(blockV4, 'archived');
        }
        else {
            const now = Date.now();
            updatedBlock = {
                ...blockV4,
                status: 'done',
                doneReason: 'archived',
                doneAt: now,
                updatedAt: now
            };
        }
        // 持久化
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                scheduleStatus: 'done',
                doneReason: 'archived',
                doneAt: updatedBlock.doneAt
            });
        }
        // 记录会话（归档）
        await this.recordSession(updatedBlock, { rating: 0, readingTimeSeconds: 0, priorityUi: updatedBlock.priorityUi, createdCardCount: 0, createdExtractCount: 0, createdNoteCount: 0 }, '', 'completed');
        logger.info(`[IRV4SchedulerService] archiveBlockV4: ${updatedBlock.id}`);
        return updatedBlock;
    }
    /**
     * @deprecated 使用 archiveBlockV4 代替
     */
    async markBlockDoneV4(blockV4) {
        return this.archiveBlockV4(blockV4);
    }
    /**
     * 移除内容块（从队列永久移除，保留历史记录）
     */
    async removeBlockV4(blockV4) {
        await this.initialize();
        let updatedBlock;
        if (blockV4.status === 'active' || blockV4.status === 'queued' || blockV4.status === 'scheduled') {
            updatedBlock = this.stateMachine.transitionToRemoved(blockV4);
        }
        else {
            const now = Date.now();
            updatedBlock = {
                ...blockV4,
                status: 'removed',
                doneReason: 'removed',
                doneAt: now,
                updatedAt: now
            };
        }
        // 持久化
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                scheduleStatus: 'removed',
                doneReason: 'removed',
                doneAt: updatedBlock.doneAt
            });
        }
        logger.info(`[IRV4SchedulerService] removeBlockV4: ${updatedBlock.id}`);
        return updatedBlock;
    }
    /**
     * 删除内容块（彻底清除调度记录，可选删除 chunk 文件，不删除源文档）
     */
    async deleteBlockV4(blockV4, deleteChunkFile = true) {
        await this.initialize();
        if (isPdfBookmarkTaskId(blockV4.id)) {
            await this._pdfBookmarkTaskService.deleteTask(blockV4.id);
        }
        else {
            // 1. 删除 chunks.json 中的调度记录
            await this.storageService.deleteChunkData(blockV4.id);
            // 2. 可选删除 chunk 文件（IR 导入时创建的拆分文件）
            if (deleteChunkFile && blockV4.sourcePath) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(blockV4.sourcePath);
                    if (file) {
                        await this.app.vault.trash(file, true);
                        logger.debug(`[IRV4SchedulerService] 已删除 chunk 文件: ${blockV4.sourcePath}`);
                    }
                }
                catch (error) {
                    logger.warn(`[IRV4SchedulerService] 删除 chunk 文件失败: ${blockV4.sourcePath}`, error);
                }
            }
            // 3. 更新 sources.json 中的 chunkIds 引用
            try {
                const sources = await this.storageService.getAllSources();
                for (const source of Object.values(sources)) {
                    if (source.chunkIds?.includes(blockV4.id)) {
                        source.chunkIds = source.chunkIds.filter(id => id !== blockV4.id);
                        source.updatedAt = Date.now();
                        await this.storageService.saveSource(source);
                    }
                }
            }
            catch (error) {
                logger.warn(`[IRV4SchedulerService] 更新 source chunkIds 失败:`, error);
            }
        }
        logger.info(`[IRV4SchedulerService] deleteBlockV4: ${blockV4.id}, deleteFile=${deleteChunkFile}`);
    }
    /**
     * 强制恢复内容块（从 done/removed 状态重新激活）
     */
    async forceReactivateBlockV4(blockV4) {
        await this.initialize();
        const updatedBlock = this.stateMachine.forceReactivate(blockV4);
        // 持久化
        if (isPdfBookmarkTaskId(updatedBlock.id)) {
            await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
        }
        else {
            await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
                scheduleStatus: updatedBlock.status,
                nextRepDate: updatedBlock.nextRepDate
            });
        }
        logger.info(`[IRV4SchedulerService] forceReactivateBlockV4: ${updatedBlock.id}`);
        return updatedBlock;
    }
    /**
     * 记录会话历史
     */
    async recordSession(block, data, deckPath, action) {
        const now = new Date();
        const session = {
            id: generateUUID(),
            blockId: block.id,
            deckId: deckPath,
            startTime: new Date(now.getTime() - data.readingTimeSeconds * 1000).toISOString(),
            endTime: now.toISOString(),
            duration: data.readingTimeSeconds,
            action,
            rating: data.rating || undefined
        };
        await this.storageService.addSession(session);
    }
    /**
     * V3 兼容：将 IRBlock 转换为 IRBlockV4 并完成
     */
    async completeBlockFromV3(blockV3, data, deckPath = '') {
        // 转换为 V4
        const blockV4 = migrateToIRBlockV4(blockV3);
        // 调用 V4 完成逻辑
        const result = await this.completeBlockV4(blockV4, data, deckPath);
        // 转换回 V3
        const updatedV3 = this.storageAdapterV4.v4ToV3Public(result.block);
        return {
            block: updatedV3,
            nextRepDate: result.nextRepDate,
            intervalDays: result.intervalDays
        };
    }
    /**
     * V3 兼容：将 IRBlock 转换为 IRBlockV4 并跳过
     */
    async skipBlockFromV3(blockV3, deckPath = '') {
        const blockV4 = migrateToIRBlockV4(blockV3);
        await this.skipBlockV4(blockV4, deckPath);
    }
    /**
     * 获取存储适配器（供外部使用）
     */
    getStorageAdapter() {
        return this.storageAdapterV4;
    }
    /**
     * 获取标签组服务（供外部使用）
     */
    getTagGroupService() {
        return this.tagGroupService;
    }
}
