/**
 * 摘录卡片服务
 *
 * 负责从阅读材料中提取内容创建卡片，并管理牌组层级关联
 *
 * @module services/incremental-reading/ExtractCardService
 * @version 1.0.0
 */
import type { App, TFile, Editor } from 'obsidian';
import type { Card, Deck } from '../../data/types';
import type { ReadingMaterial } from '../../types/incremental-reading-types';
import type { CreateCardOptions } from '../../types/modal-types';
import type { ReadingMaterialManager } from './ReadingMaterialManager';
import type { ReadingSessionManager } from './ReadingSessionManager';
/**
 * 提取卡片选项
 */
export interface ExtractCardOptions {
    /** 选中的文本内容 */
    selectedText: string;
    /** 源文件 */
    file: TFile;
    /** 自定义导入文件夹路径（可选） */
    importFolder?: string;
    /** 编辑器实例（用于获取光标位置） */
    editor?: Editor;
    /** 目标牌组ID（可选，默认使用材料关联的Reading Deck） */
    targetDeckId?: string;
    /** 卡片类型 */
    cardType?: 'basic' | 'cloze';
    /** 额外标签（预留，暂未使用） */
    tags?: string[];
}
/**
 * 提取卡片结果
 */
export interface ExtractCardResult {
    /** 是否成功 */
    success: boolean;
    /** 创建的卡片（如果成功） */
    card?: Card;
    /** 关联的阅读材料 */
    material?: ReadingMaterial;
    /** 错误信息 */
    error?: string;
}
/**
 * 牌组层级信息
 */
export interface DeckHierarchy {
    /** Reading Deck（父牌组） */
    readingDeck: Deck;
    /** QA Deck（子牌组） */
    qaDeck?: Deck;
}
/**
 * 摘录卡片服务
 */
export declare class ExtractCardService {
    private app;
    private materialManager;
    private sessionManager;
    /** 打开创建卡片模态窗的回调 */
    private openCreateCardModal?;
    /** 获取牌组的回调 */
    private getDeck?;
    /** 创建牌组的回调 */
    private createDeck?;
    /** 更新牌组的回调 */
    private updateDeck?;
    constructor(app: App, materialManager: ReadingMaterialManager, sessionManager: ReadingSessionManager);
    private isIRFile;
    private hashToBase36;
    ensureReadingDeckForIR(deckPath: string, deckName: string): Promise<Deck>;
    /**
     * 设置插件回调函数
     */
    setCallbacks(callbacks: {
        openCreateCardModal: (options: CreateCardOptions) => Promise<void>;
        getDeck: (deckId: string) => Promise<Deck | null>;
        createDeck: (deck: Partial<Deck>) => Promise<Deck>;
        updateDeck: (deck: Deck) => Promise<void>;
    }): void;
    /**
     * 从选中文本提取卡片
     * 调用插件现有的 openCreateCardModal 方法
     */
    extractToCard(options: ExtractCardOptions): Promise<ExtractCardResult>;
    /**
     * 确保阅读材料有关联的 Reading Deck
     */
    ensureReadingDeck(material: ReadingMaterial, defaultName?: string): Promise<DeckHierarchy>;
    /**
     * 创建 QA 子牌组（用于特定主题的卡片）
     */
    createQASubDeck(parentDeck: Deck, name: string, material: ReadingMaterial): Promise<Deck>;
    /**
     * 获取牌组层级结构
     */
    getDeckHierarchy(material: ReadingMaterial): Promise<DeckHierarchy | null>;
    /**
     * 验证牌组层级完整性
     */
    validateDeckHierarchy(material: ReadingMaterial): Promise<{
        valid: boolean;
        issues: string[];
    }>;
    /**
     * 获取源位置信息
     */
    private getSourceInfo;
    /**
     * 格式化提取的内容
     */
    private formatExtractContent;
    /**
     * 获取材料的所有提取卡片
     */
    getExtractedCards(materialId: string): Promise<string[]>;
    /**
     * 获取提取卡片统计
     */
    getExtractStats(materialId: string): Promise<{
        totalCards: number;
        byType: Record<string, number>;
    }>;
}
/**
 * 创建摘录卡片服务实例
 */
export declare function createExtractCardService(app: App, materialManager: ReadingMaterialManager, sessionManager: ReadingSessionManager): ExtractCardService;
