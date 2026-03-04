/**
 * 牌组映射服务
 * 核心创新：根据文件夹自动创建/映射牌组
 *
 * 功能：
 * 1. 文件夹到牌组的自动映射
 * 2. 动态创建牌组
 * 3. 牌组命名策略
 * 4. 层级结构处理
 */
import { TFile } from 'obsidian';
/**
 * 牌组映射规则
 */
export interface DeckMappingRule {
    /** 源文件夹路径 */
    folderPath: string;
    /** 目标牌组ID（如果已存在） */
    targetDeckId?: string;
    /** 牌组命名策略 */
    namingStrategy: 'folder-name' | 'custom' | 'path-based';
    /** 自定义牌组名称（当策略为custom时使用） */
    customName?: string;
    /** 是否自动创建牌组 */
    autoCreate: boolean;
    /** 是否包含子文件夹 */
    includeSubfolders: boolean;
    /** 子文件夹处理策略 */
    subfolderStrategy?: 'same-deck' | 'separate-decks' | 'hierarchy';
}
/**
 * 牌组映射配置
 */
export interface DeckMappingConfig {
    /** 是否启用文件夹到牌组映射 */
    enabled: boolean;
    /** 映射规则列表 */
    rules: DeckMappingRule[];
    /** 默认牌组ID（当无规则匹配时使用） */
    defaultDeckId?: string;
    /** 牌组名称前缀 */
    deckNamePrefix?: string;
    /** 牌组名称后缀 */
    deckNameSuffix?: string;
    /** 路径分隔符（用于层级牌组） */
    hierarchySeparator: string;
}
/**
 * 牌组信息
 */
export interface DeckInfo {
    id: string;
    name: string;
    description?: string;
}
/**
 * 映射结果
 */
export interface MappingResult {
    /** 目标牌组ID */
    deckId: string;
    /** 牌组名称 */
    deckName: string;
    /** 是否为新创建的牌组 */
    isNewDeck: boolean;
    /** 使用的映射规则 */
    ruleUsed?: DeckMappingRule;
}
/**
 * 牌组数据存储接口（需要从插件注入）
 */
export interface IDeckStorage {
    /** 获取所有牌组 */
    getDecks(): Promise<DeckInfo[]>;
    /** 根据ID获取牌组 */
    getDeckById(id: string): Promise<DeckInfo | null>;
    /** 根据名称获取牌组 */
    getDeckByName(name: string): Promise<DeckInfo | null>;
    /** 创建新牌组 */
    createDeck(name: string, description?: string): Promise<DeckInfo>;
    /** 检查牌组是否存在 */
    deckExists(id: string): Promise<boolean>;
}
/**
 * 牌组映射服务
 */
export declare class DeckMappingService {
    private config;
    private deckStorage;
    private deckCache;
    private mappingCache;
    constructor(config: DeckMappingConfig, deckStorage: IDeckStorage);
    /**
     * 为文件解析牌组
     */
    resolveDeckForFile(file: TFile): Promise<MappingResult>;
    /**
     * 查找匹配的映射规则
     */
    private findMatchingRule;
    /**
     * 判断规则是否匹配文件路径
     */
    private isRuleMatch;
    /**
     * 应用映射规则
     */
    private applyRule;
    /**
     * 生成牌组名称
     */
    private generateDeckName;
    /**
     * 生成基于路径的牌组名称
     */
    private generatePathBasedName;
    /**
     * 获取默认牌组
     */
    private getDefaultDeck;
    /**
     * 获取牌组信息（带缓存）
     */
    private getDeck;
    /**
     * 获取文件的文件夹路径
     */
    private getFileFolder;
    /**
     * 获取文件夹名称（不含路径）
     */
    private getFolderName;
    /**
     * 规范化路径
     */
    private normalizePath;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<DeckMappingConfig>): void;
    /**
     * 清除缓存
     */
    clearCache(): void;
    /**
     * 添加映射规则
     */
    addRule(rule: DeckMappingRule): void;
    /**
     * 移除映射规则
     */
    removeRule(folderPath: string): void;
    /**
     * 获取所有规则
     */
    getRules(): DeckMappingRule[];
    /**
     * 批量解析文件牌组
     */
    resolveDeckForFiles(files: TFile[]): Promise<Map<string, MappingResult>>;
}
