import type { App } from 'obsidian';
import type { IRBlockMeta, IRBlockStats, IRBlockStatus, IRBlockV4 } from '../../types/ir-types';
/**
 * EPUB 书签 IR 任务
 * 每个任务对应 EPUB 目录中的一个条目（章节/节），参与 IR 调度队列
 */
export interface IREpubBookmarkTask {
    id: string;
    deckId: string;
    /** EPUB 文件在 Vault 中的路径 */
    epubFilePath: string;
    /** TOC 条目标题 */
    title: string;
    /** TOC 条目的 href（用于导航跳转） */
    tocHref: string;
    /** TOC 层级深度（0=顶层章节，1=节，2=小节...） */
    tocLevel: number;
    /** 续读点 CFI（用户手动标记的阅读位置） */
    resumeCfi?: string;
    /** 续读点更新时间 */
    resumeUpdatedAt?: number;
    status: IRBlockStatus;
    priorityUi: number;
    priorityEff: number;
    intervalDays: number;
    nextRepDate: number;
    stats: IRBlockStats;
    meta: IRBlockMeta;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}
export declare function isEpubBookmarkTaskId(id: string): boolean;
export declare class IREpubBookmarkTaskService {
    private app;
    private initialized;
    private filePath;
    constructor(app: App);
    initialize(): Promise<void>;
    private readStore;
    private writeStore;
    getTask(id: string): Promise<IREpubBookmarkTask | null>;
    getAllTasks(): Promise<IREpubBookmarkTask[]>;
    getTasksByDeck(deckId: string): Promise<IREpubBookmarkTask[]>;
    getTasksByEpub(epubFilePath: string): Promise<IREpubBookmarkTask[]>;
    createTask(input: {
        deckId: string;
        epubFilePath: string;
        title: string;
        tocHref: string;
        tocLevel: number;
        priorityUi?: number;
    }): Promise<IREpubBookmarkTask>;
    /**
     * Batch create tasks from EPUB TOC items.
     * Sets up sibling chain (prev/next) for navigation context.
     */
    batchCreateTasks(inputs: Array<{
        deckId: string;
        epubFilePath: string;
        title: string;
        tocHref: string;
        tocLevel: number;
        priorityUi?: number;
        nextRepDate?: number;
    }>): Promise<IREpubBookmarkTask[]>;
    updateTask(id: string, updates: Partial<Omit<IREpubBookmarkTask, 'id' | 'createdAt'>>): Promise<IREpubBookmarkTask | null>;
    /**
     * Update task scheduling data from IRBlockV4 (after IR session completion)
     */
    updateTaskFromBlock(block: IRBlockV4 & {
        epubBookmarkHref?: string;
        epubBookmarkTitle?: string;
    }): Promise<void>;
    /**
     * Set or update the resume point (CFI) for a task
     */
    setResumePoint(taskId: string, cfi: string): Promise<void>;
    /**
     * Clear the resume point for a task
     */
    clearResumePoint(taskId: string): Promise<void>;
    recordTaskInteraction(taskId: string, readingTimeSec: number, actions?: {
        extracts?: number;
        cardsCreated?: number;
        notesWritten?: number;
    }): Promise<void>;
    deleteTask(id: string): Promise<boolean>;
    deleteTasksByDeck(deckId: string): Promise<number>;
    deleteTasksByDeckIdentifiers(deckIds: string[]): Promise<number>;
    deleteTasksByEpubPaths(epubFilePaths: string[]): Promise<number>;
    private toNormalizedSet;
    private deleteTasksByPredicate;
    /**
     * Convert task to IRBlockV4 for IR scheduling integration
     */
    toBlockV4(task: IREpubBookmarkTask): IRBlockV4;
}
