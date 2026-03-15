import type { App } from 'obsidian';
import type { IRBlockMeta, IRBlockStats, IRBlockStatus, IRBlockV4 } from '../../types/ir-types';
export interface IRPdfBookmarkTask {
    id: string;
    deckId: string;
    materialId?: string;
    pdfPath: string;
    title: string;
    link: string;
    annotationId?: string;
    status: IRBlockStatus;
    priorityUi: number;
    priorityEff: number;
    intervalDays: number;
    nextRepDate: number;
    stats: IRBlockStats;
    meta: IRBlockMeta;
    tags: string[];
    /** 收藏 */
    favorite?: boolean;
    createdAt: number;
    updatedAt: number;
}
export declare function isPdfBookmarkTaskId(id: string): boolean;
export declare class IRPdfBookmarkTaskService {
    private app;
    private initialized;
    private filePath;
    constructor(app: App);
    initialize(): Promise<void>;
    private readStore;
    private writeStore;
    getTask(id: string): Promise<IRPdfBookmarkTask | null>;
    getAllTasks(): Promise<IRPdfBookmarkTask[]>;
    getTasksByDeck(deckId: string): Promise<IRPdfBookmarkTask[]>;
    createTask(input: {
        deckId: string;
        materialId?: string;
        pdfPath: string;
        title: string;
        link: string;
        annotationId?: string;
        priorityUi?: number;
    }): Promise<IRPdfBookmarkTask>;
    updateTask(id: string, updates: Partial<Omit<IRPdfBookmarkTask, 'id' | 'createdAt'>>): Promise<IRPdfBookmarkTask | null>;
    updateTaskFromBlock(block: IRBlockV4 & {
        pdfBookmarkLink?: string;
        pdfBookmarkTitle?: string;
    }): Promise<void>;
    recordTaskInteraction(taskId: string, readingTimeSec: number, actions?: {
        extracts?: number;
        cardsCreated?: number;
        notesWritten?: number;
    }): Promise<void>;
    deleteTask(id: string): Promise<boolean>;
    deleteTasksByDeck(deckId: string): Promise<number>;
    deleteTasksByDeckIdentifiers(deckIds: string[]): Promise<number>;
    deleteTasksByPdfPaths(pdfPaths: string[]): Promise<number>;
    private toNormalizedSet;
    private deleteTasksByPredicate;
    toBlockV4(task: IRPdfBookmarkTask): IRBlockV4;
}
