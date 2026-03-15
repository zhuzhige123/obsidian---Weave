import { normalizePath } from 'obsidian';
import { DEFAULT_IR_BLOCK_META, DEFAULT_IR_BLOCK_STATS } from '../../types/ir-types';
import { getV2PathsFromApp } from '../../config/paths';
import { logger } from '../../utils/logger';
const DEFAULT_STORE = {
    version: 1,
    tasks: {}
};
export function isEpubBookmarkTaskId(id) {
    return typeof id === 'string' && id.startsWith('epubbm-');
}
function generateEpubBookmarkTaskId() {
    return `epubbm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
export class IREpubBookmarkTaskService {
    app;
    initialized = false;
    filePath;
    constructor(app) {
        this.app = app;
        const storageDir = getV2PathsFromApp(app).ir.root;
        this.filePath = normalizePath(`${storageDir}/epub-bookmark-tasks.json`);
    }
    async initialize() {
        if (this.initialized)
            return;
        const adapter = this.app.vault.adapter;
        logger.info('[IREpubBookmarkTaskService] init:', { filePath: this.filePath });
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
                logger.info('[IREpubBookmarkTaskService] storage file created:', { filePath: this.filePath });
            }
        }
        catch (e) {
            logger.warn('[IREpubBookmarkTaskService] init failed:', e);
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
            logger.warn('[IREpubBookmarkTaskService] read failed:', e);
            return { ...DEFAULT_STORE };
        }
    }
    async writeStore(store) {
        await this.initialize();
        const adapter = this.app.vault.adapter;
        await adapter.write(this.filePath, JSON.stringify(store));
        logger.debug('[IREpubBookmarkTaskService] written:', { filePath: this.filePath, count: Object.keys(store.tasks || {}).length });
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
    async getTasksByEpub(epubFilePath) {
        const store = await this.readStore();
        return Object.values(store.tasks).filter(t => t.epubFilePath === epubFilePath);
    }
    async createTask(input) {
        const store = await this.readStore();
        const now = Date.now();
        const id = generateEpubBookmarkTaskId();
        const priorityUi = typeof input.priorityUi === 'number' ? input.priorityUi : 5;
        const task = {
            id,
            deckId: input.deckId,
            epubFilePath: input.epubFilePath,
            title: input.title,
            tocHref: input.tocHref,
            tocLevel: input.tocLevel,
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
    /**
     * Batch create tasks from EPUB TOC items.
     * Sets up sibling chain (prev/next) for navigation context.
     */
    async batchCreateTasks(inputs) {
        if (inputs.length === 0)
            return [];
        const store = await this.readStore();
        const now = Date.now();
        const created = [];
        for (const input of inputs) {
            const id = generateEpubBookmarkTaskId();
            const priorityUi = typeof input.priorityUi === 'number' ? input.priorityUi : 5;
            const task = {
                id,
                deckId: input.deckId,
                epubFilePath: input.epubFilePath,
                title: input.title,
                tocHref: input.tocHref,
                tocLevel: input.tocLevel,
                status: input.nextRepDate ? 'queued' : 'new',
                priorityUi,
                priorityEff: priorityUi,
                intervalDays: input.nextRepDate ? 1 : 0,
                nextRepDate: input.nextRepDate || 0,
                stats: { ...DEFAULT_IR_BLOCK_STATS },
                meta: { ...DEFAULT_IR_BLOCK_META, siblings: { prev: null, next: null } },
                tags: [],
                createdAt: now,
                updatedAt: now
            };
            store.tasks[id] = task;
            created.push(task);
        }
        // Set up sibling chain
        for (let i = 0; i < created.length; i++) {
            const task = created[i];
            task.meta.siblings = {
                prev: i > 0 ? created[i - 1].id : null,
                next: i < created.length - 1 ? created[i + 1].id : null
            };
            store.tasks[task.id] = task;
        }
        await this.writeStore(store);
        logger.info('[IREpubBookmarkTaskService] batch created:', { count: created.length, deckId: inputs[0]?.deckId });
        return created;
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
    /**
     * Update task scheduling data from IRBlockV4 (after IR session completion)
     */
    async updateTaskFromBlock(block) {
        if (!isEpubBookmarkTaskId(block.id))
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
    /**
     * Set or update the resume point (CFI) for a task
     */
    async setResumePoint(taskId, cfi) {
        const store = await this.readStore();
        const existing = store.tasks[taskId];
        if (!existing)
            return;
        existing.resumeCfi = cfi;
        existing.resumeUpdatedAt = Date.now();
        existing.updatedAt = Date.now();
        store.tasks[taskId] = existing;
        await this.writeStore(store);
        logger.debug('[IREpubBookmarkTaskService] resume point set:', { taskId, cfi });
    }
    /**
     * Clear the resume point for a task
     */
    async clearResumePoint(taskId) {
        const store = await this.readStore();
        const existing = store.tasks[taskId];
        if (!existing)
            return;
        delete existing.resumeCfi;
        delete existing.resumeUpdatedAt;
        existing.updatedAt = Date.now();
        store.tasks[taskId] = existing;
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
        logger.info('[IREpubBookmarkTaskService] task deleted:', id);
        return true;
    }
    async deleteTasksByDeck(deckId) {
        return this.deleteTasksByDeckIdentifiers([deckId]);
    }
    async deleteTasksByDeckIdentifiers(deckIds) {
        const identifiers = this.toNormalizedSet(deckIds);
        return this.deleteTasksByPredicate(task => identifiers.has(String(task?.deckId || '').trim()), '[IREpubBookmarkTaskService] tasks deleted by deck identifiers:', { deckIds: Array.from(identifiers) });
    }
    async deleteTasksByEpubPaths(epubFilePaths) {
        const paths = this.toNormalizedSet(epubFilePaths);
        return this.deleteTasksByPredicate(task => paths.has(String(task?.epubFilePath || '').trim()), '[IREpubBookmarkTaskService] tasks deleted by epub paths:', { epubFilePaths: Array.from(paths) });
    }
    toNormalizedSet(values) {
        return new Set((Array.isArray(values) ? values : [])
            .map(value => String(value || '').trim())
            .filter(Boolean));
    }
    async deleteTasksByPredicate(predicate, logMessage, logMeta) {
        const store = await this.readStore();
        const toDelete = Object.entries(store.tasks)
            .filter(([, task]) => predicate(task))
            .map(([id]) => id);
        if (toDelete.length === 0) {
            return 0;
        }
        for (const id of toDelete) {
            delete store.tasks[id];
        }
        await this.writeStore(store);
        logger.info(logMessage, {
            ...logMeta,
            count: toDelete.length
        });
        return toDelete.length;
    }
    /**
     * Convert task to IRBlockV4 for IR scheduling integration
     */
    toBlockV4(task) {
        const block = {
            id: task.id,
            sourcePath: task.epubFilePath,
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
        block.epubBookmarkHref = task.tocHref;
        block.epubBookmarkTitle = task.title;
        block.epubBookmarkLevel = task.tocLevel;
        block.epubBookmarkResumeCfi = task.resumeCfi;
        return block;
    }
}
