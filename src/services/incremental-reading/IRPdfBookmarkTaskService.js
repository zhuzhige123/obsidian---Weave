import { normalizePath } from 'obsidian';
import { DEFAULT_IR_BLOCK_META, DEFAULT_IR_BLOCK_STATS } from '../../types/ir-types';
import { getV2PathsFromApp } from '../../config/paths';
import { logger } from '../../utils/logger';
const DEFAULT_STORE = {
    version: 1,
    tasks: {}
};
export function isPdfBookmarkTaskId(id) {
    return typeof id === 'string' && id.startsWith('pdfbm-');
}
function generatePdfBookmarkTaskId() {
    return `pdfbm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
export class IRPdfBookmarkTaskService {
    app;
    initialized = false;
    filePath;
    constructor(app) {
        this.app = app;
        const storageDir = getV2PathsFromApp(app).ir.root;
        this.filePath = normalizePath(`${storageDir}/pdf-bookmark-tasks.json`);
    }
    async initialize() {
        if (this.initialized)
            return;
        const adapter = this.app.vault.adapter;
        logger.info('[IRPdfBookmarkTaskService] 初始化:', { filePath: this.filePath });
        const ensureDir = async (dirPath) => {
            const normalized = normalizePath(dirPath);
            const parts = normalized.split('/').filter(Boolean);
            let current = '';
            for (const part of parts) {
                current = current ? `${current}/${part}` : part;
                try {
                    if (!(await adapter.exists(current))) {
                        await adapter.mkdir(current);
                    }
                }
                catch {
                    // ignore
                }
            }
        };
        const parts = this.filePath.split('/');
        parts.pop();
        const dir = parts.join('/');
        try {
            await ensureDir(dir);
        }
        catch { }
        try {
            if (!(await adapter.exists(this.filePath))) {
                await adapter.write(this.filePath, JSON.stringify(DEFAULT_STORE));
                logger.info('[IRPdfBookmarkTaskService] 已创建存储文件:', { filePath: this.filePath });
            }
        }
        catch (e) {
            logger.warn('[IRPdfBookmarkTaskService] 初始化失败:', e);
        }
        this.initialized = true;
    }
    async readStore() {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        try {
            if (!(await adapter.exists(this.filePath))) {
                return { ...DEFAULT_STORE };
            }
            const content = await adapter.read(this.filePath);
            const parsed = JSON.parse(content);
            if (!parsed || typeof parsed !== 'object')
                return { ...DEFAULT_STORE };
            const tasks = parsed.tasks;
            if (!tasks || typeof tasks !== 'object')
                return { version: 1, tasks: {} };
            return {
                version: typeof parsed.version === 'number' ? parsed.version : 1,
                tasks: tasks
            };
        }
        catch (e) {
            logger.warn('[IRPdfBookmarkTaskService] 读取失败:', e);
            return { ...DEFAULT_STORE };
        }
    }
    async writeStore(store) {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        await adapter.write(this.filePath, JSON.stringify(store));
        logger.debug('[IRPdfBookmarkTaskService] 已写入:', { filePath: this.filePath, count: Object.keys(store.tasks || {}).length });
    }
    async getTask(id) {
        const store = await this.readStore();
        return store.tasks[id] || null;
    }
    async getAllTasks() {
        const store = await this.readStore();
        return Object.values(store.tasks);
    }
    async getTasksByDeck(deckId) {
        const store = await this.readStore();
        return Object.values(store.tasks).filter(t => t.deckId === deckId);
    }
    async createTask(input) {
        const store = await this.readStore();
        const now = Date.now();
        const id = generatePdfBookmarkTaskId();
        const priorityUi = typeof input.priorityUi === 'number' ? input.priorityUi : 5;
        const task = {
            id,
            deckId: input.deckId,
            materialId: input.materialId,
            pdfPath: input.pdfPath,
            title: input.title,
            link: input.link,
            annotationId: input.annotationId,
            status: 'new',
            priorityUi,
            priorityEff: priorityUi,
            intervalDays: 0,
            nextRepDate: 0,
            stats: { ...DEFAULT_IR_BLOCK_STATS },
            meta: { ...DEFAULT_IR_BLOCK_META, siblings: { prev: null, next: null } },
            tags: [],
            createdAt: now,
            updatedAt: now
        };
        store.tasks[id] = task;
        await this.writeStore(store);
        return task;
    }
    async updateTask(id, updates) {
        const store = await this.readStore();
        const existing = store.tasks[id];
        if (!existing)
            return null;
        const updated = {
            ...existing,
            ...updates,
            meta: updates.meta ? updates.meta : existing.meta,
            stats: updates.stats ? updates.stats : existing.stats,
            updatedAt: Date.now()
        };
        store.tasks[id] = updated;
        await this.writeStore(store);
        return updated;
    }
    async updateTaskFromBlock(block) {
        if (!isPdfBookmarkTaskId(block.id))
            return;
        const store = await this.readStore();
        const existing = store.tasks[block.id];
        if (!existing)
            return;
        store.tasks[block.id] = {
            ...existing,
            status: block.status,
            priorityUi: block.priorityUi,
            priorityEff: block.priorityEff,
            intervalDays: block.intervalDays,
            nextRepDate: block.nextRepDate,
            stats: block.stats,
            meta: block.meta,
            tags: Array.isArray(block.tags) ? block.tags : (existing.tags || []),
            updatedAt: Date.now()
        };
        await this.writeStore(store);
    }
    async recordTaskInteraction(taskId, readingTimeSec, actions = {}) {
        const store = await this.readStore();
        const existing = store.tasks[taskId];
        if (!existing)
            return;
        const stats = existing.stats;
        stats.impressions++;
        stats.totalReadingTimeSec += readingTimeSec;
        stats.effectiveReadingTimeSec += Math.min(readingTimeSec, 600);
        stats.extracts += actions.extracts || 0;
        stats.cardsCreated += actions.cardsCreated || 0;
        stats.notesWritten += actions.notesWritten || 0;
        stats.lastInteraction = Date.now();
        stats.lastShownAt = Date.now();
        // 每日展示计数器（跨天自动重置）
        const todayStr = new Date().toISOString().slice(0, 10);
        if (stats.todayShownDate === todayStr) {
            stats.todayShownCount = (stats.todayShownCount || 0) + 1;
        }
        else {
            stats.todayShownDate = todayStr;
            stats.todayShownCount = 1;
        }
        store.tasks[taskId] = {
            ...existing,
            stats,
            updatedAt: Date.now()
        };
        await this.writeStore(store);
    }
    async deleteTask(id) {
        const store = await this.readStore();
        if (!store.tasks[id])
            return false;
        delete store.tasks[id];
        await this.writeStore(store);
        logger.info('[IRPdfBookmarkTaskService] 已删除任务:', id);
        return true;
    }
    toBlockV4(task) {
        const block = {
            id: task.id,
            sourcePath: task.pdfPath,
            blockId: task.id,
            contentHash: '',
            status: task.status,
            priorityUi: task.priorityUi,
            priorityEff: task.priorityEff,
            intervalDays: task.intervalDays,
            nextRepDate: task.nextRepDate,
            stats: task.stats,
            meta: task.meta,
            tags: task.tags || [],
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
        };
        block.contentPreview = task.title;
        block.pdfBookmarkLink = task.link;
        block.pdfBookmarkTitle = task.title;
        block.pdfBookmarkAnnotationId = task.annotationId;
        return block;
    }
}
