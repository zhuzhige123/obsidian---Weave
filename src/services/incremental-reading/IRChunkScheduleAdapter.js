/**
 * 增量阅读文件化块调度适配器
 *
 * 桥接 IRChunkFileService 和现有调度系统：
 * - 从块文件 YAML 读取用户设置（status, priority_ui）
 * - 同步调度状态到存储服务
 * - 过滤完成态块，排除出 IR 会话
 *
 * @module services/incremental-reading/IRChunkScheduleAdapter
 * @version 5.0.0 - 文件化内容块方案
 */
import { IRChunkFileService } from './IRChunkFileService';
import { logger } from '../../utils/logger';
/**
 * 状态映射：YAML status → 内部 scheduleStatus
 */
function mapChunkStatusToScheduleStatus(yamlStatus) {
    switch (yamlStatus) {
        case 'active': return 'queued';
        case 'processing': return 'active';
        case 'done': return 'done';
        case 'archived': return 'suspended';
        case 'removed': return 'removed';
        default: return 'new';
    }
}
/**
 * 状态映射：内部 scheduleStatus → YAML status
 */
function mapScheduleStatusToChunkStatus(scheduleStatus) {
    switch (scheduleStatus) {
        case 'new':
        case 'queued':
        case 'scheduled':
            return 'active';
        case 'active':
            return 'processing';
        case 'done':
            return 'done';
        case 'suspended':
            return 'archived';
        case 'removed':
            return 'removed';
        default:
            return 'active';
    }
}
export class IRChunkScheduleAdapter {
    app;
    storage;
    chunkFileService;
    constructor(app, storage, chunkRoot) {
        this.app = app;
        this.storage = storage;
        this.chunkFileService = new IRChunkFileService(app, chunkRoot);
    }
    /**
     * 获取所有可调度的块（排除 done/archived）
     */
    async getSchedulableChunks() {
        const allChunks = await this.storage.getAllChunkData();
        const schedulable = [];
        for (const chunk of Object.values(allChunks)) {
            // 从文件读取最新的 YAML 状态
            const yamlData = await this.chunkFileService.readChunkFileYAML(chunk.filePath);
            if (yamlData) {
                // 根据 YAML status 过滤
                if (yamlData.status === 'done' || yamlData.status === 'archived') {
                    continue;
                }
                // 同步 YAML 数据到内存中的调度数据
                if (yamlData.priority_ui !== undefined && yamlData.priority_ui !== chunk.priorityUi) {
                    chunk.priorityUi = yamlData.priority_ui;
                    chunk.updatedAt = Date.now();
                    await this.storage.saveChunkData(chunk);
                }
            }
            schedulable.push(chunk);
        }
        return schedulable;
    }
    /**
     * 获取今日到期的块
     */
    async getTodayDueChunks() {
        const schedulable = await this.getSchedulableChunks();
        const now = Date.now();
        return schedulable.filter(chunk => {
            // 新块立即可用
            if (chunk.scheduleStatus === 'new')
                return true;
            // 检查是否到期
            return chunk.nextRepDate <= now;
        });
    }
    /**
     * 更新块的调度状态
     */
    async updateChunkSchedule(chunkId, updates) {
        const chunk = await this.storage.getChunkData(chunkId);
        if (!chunk) {
            logger.warn(`[IRChunkScheduleAdapter] 块不存在: ${chunkId}`);
            return;
        }
        // 更新调度数据
        if (updates.priorityUi !== undefined)
            chunk.priorityUi = updates.priorityUi;
        if (updates.priorityEff !== undefined)
            chunk.priorityEff = updates.priorityEff;
        if (updates.intervalDays !== undefined)
            chunk.intervalDays = updates.intervalDays;
        if (updates.nextRepDate !== undefined)
            chunk.nextRepDate = updates.nextRepDate;
        if (updates.scheduleStatus !== undefined)
            chunk.scheduleStatus = updates.scheduleStatus;
        if (updates.doneReason !== undefined)
            chunk.doneReason = updates.doneReason;
        if (updates.doneAt !== undefined)
            chunk.doneAt = updates.doneAt;
        chunk.updatedAt = Date.now();
        // 保存到 JSON
        await this.storage.saveChunkData(chunk);
        const yamlData = await this.chunkFileService.readChunkFileYAML(chunk.filePath);
        if (!yamlData) {
            logger.debug(`[IRChunkScheduleAdapter] 跳过 YAML 同步（非 chunk 文件或无法读取）: ${chunkId}`);
            return;
        }
        // 如果状态变化，同步到 YAML
        if (updates.scheduleStatus !== undefined) {
            const yamlStatus = mapScheduleStatusToChunkStatus(updates.scheduleStatus);
            await this.chunkFileService.updateChunkFileYAML(chunk.filePath, { status: yamlStatus });
        }
        if (updates.priorityUi !== undefined) {
            await this.chunkFileService.updateChunkFileYAML(chunk.filePath, { priority_ui: updates.priorityUi });
        }
        logger.debug(`[IRChunkScheduleAdapter] 更新块调度: ${chunkId}`);
    }
    /**
     * 批量更新多个块的调度状态（只写一次 chunks.json）
     */
    async batchUpdateChunkSchedules(updates) {
        if (updates.length === 0)
            return 0;
        const allChunks = await this.storage.getAllChunkData();
        const updatedChunks = [];
        for (const { chunkId, data } of updates) {
            const chunk = allChunks[chunkId];
            if (!chunk)
                continue;
            if (data.priorityUi !== undefined)
                chunk.priorityUi = data.priorityUi;
            if (data.priorityEff !== undefined)
                chunk.priorityEff = data.priorityEff;
            if (data.intervalDays !== undefined)
                chunk.intervalDays = data.intervalDays;
            if (data.nextRepDate !== undefined)
                chunk.nextRepDate = data.nextRepDate;
            if (data.scheduleStatus !== undefined)
                chunk.scheduleStatus = data.scheduleStatus;
            if (data.doneReason !== undefined)
                chunk.doneReason = data.doneReason;
            if (data.doneAt !== undefined)
                chunk.doneAt = data.doneAt;
            chunk.updatedAt = Date.now();
            updatedChunks.push(chunk);
        }
        if (updatedChunks.length > 0) {
            await this.storage.saveChunkDataBatch(updatedChunks);
        }
        // YAML 同步：每个块写各自的 .md 文件，不需要合并
        for (const { chunkId, data } of updates) {
            const chunk = allChunks[chunkId];
            if (!chunk)
                continue;
            const yamlData = await this.chunkFileService.readChunkFileYAML(chunk.filePath);
            if (!yamlData)
                continue;
            if (data.scheduleStatus !== undefined) {
                const yamlStatus = mapScheduleStatusToChunkStatus(data.scheduleStatus);
                await this.chunkFileService.updateChunkFileYAML(chunk.filePath, { status: yamlStatus });
            }
            if (data.priorityUi !== undefined) {
                await this.chunkFileService.updateChunkFileYAML(chunk.filePath, { priority_ui: data.priorityUi });
            }
        }
        logger.debug(`[IRChunkScheduleAdapter] 批量更新 ${updatedChunks.length} 个块调度`);
        return updatedChunks.length;
    }
    /**
     * 将块标记为完成
     */
    async markChunkDone(chunkId) {
        const chunk = await this.storage.getChunkData(chunkId);
        if (!chunk) {
            logger.warn(`[IRChunkScheduleAdapter] 块不存在: ${chunkId}`);
            return;
        }
        // 更新 JSON
        chunk.scheduleStatus = 'done';
        chunk.updatedAt = Date.now();
        await this.storage.saveChunkData(chunk);
        // 更新 YAML
        const yamlData = await this.chunkFileService.readChunkFileYAML(chunk.filePath);
        if (yamlData) {
            await this.chunkFileService.updateChunkFileYAML(chunk.filePath, { status: 'done' });
        }
        logger.info(`[IRChunkScheduleAdapter] 块标记为完成: ${chunkId}`);
    }
    /**
     * 记录块交互统计
     */
    async recordChunkInteraction(chunkId, readingTimeSec, actions = {}) {
        const chunk = await this.storage.getChunkData(chunkId);
        if (!chunk)
            return;
        // 更新统计
        chunk.stats.impressions++;
        chunk.stats.totalReadingTimeSec += readingTimeSec;
        chunk.stats.effectiveReadingTimeSec += Math.min(readingTimeSec, 600); // 最多计10分钟
        chunk.stats.extracts += actions.extracts || 0;
        chunk.stats.cardsCreated += actions.cardsCreated || 0;
        chunk.stats.notesWritten += actions.notesWritten || 0;
        chunk.stats.lastInteraction = Date.now();
        chunk.stats.lastShownAt = Date.now();
        chunk.updatedAt = Date.now();
        // 每日展示计数器（跨天自动重置）
        const todayStr = new Date().toISOString().slice(0, 10);
        if (chunk.stats.todayShownDate === todayStr) {
            chunk.stats.todayShownCount = (chunk.stats.todayShownCount || 0) + 1;
        }
        else {
            chunk.stats.todayShownDate = todayStr;
            chunk.stats.todayShownCount = 1;
        }
        await this.storage.saveChunkData(chunk);
    }
    /**
     * 从 YAML 同步状态到调度数据
     * 用于检测用户直接编辑 YAML 的情况
     */
    async syncFromYAML(chunkId) {
        const chunk = await this.storage.getChunkData(chunkId);
        if (!chunk)
            return false;
        const yaml = await this.chunkFileService.readChunkFileYAML(chunk.filePath);
        if (!yaml)
            return false;
        let changed = false;
        // 同步 status
        const expectedScheduleStatus = mapChunkStatusToScheduleStatus(yaml.status);
        if (chunk.scheduleStatus !== expectedScheduleStatus) {
            chunk.scheduleStatus = expectedScheduleStatus;
            changed = true;
        }
        // 同步 priority_ui
        if (yaml.priority_ui !== undefined && Math.abs((chunk.priorityUi ?? chunk.priorityEff) - yaml.priority_ui) > 0.1) {
            chunk.priorityUi = yaml.priority_ui;
            changed = true;
        }
        if (changed) {
            chunk.updatedAt = Date.now();
            await this.storage.saveChunkData(chunk);
        }
        return changed;
    }
    /**
     * 批量同步所有块的 YAML 状态
     */
    async syncAllFromYAML() {
        const allChunks = await this.storage.getAllChunkData();
        let syncedCount = 0;
        for (const chunk of Object.values(allChunks)) {
            const changed = await this.syncFromYAML(chunk.chunkId);
            if (changed)
                syncedCount++;
        }
        if (syncedCount > 0) {
            logger.info(`[IRChunkScheduleAdapter] 从 YAML 同步了 ${syncedCount} 个块的状态`);
        }
        return syncedCount;
    }
}
