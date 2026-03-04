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
/**
 * 牌组映射服务
 */
export class DeckMappingService {
    config;
    deckStorage;
    deckCache = new Map();
    mappingCache = new Map();
    constructor(config, deckStorage) {
        this.config = config;
        this.deckStorage = deckStorage;
    }
    /**
     * 为文件解析牌组
     */
    async resolveDeckForFile(file) {
        // 检查缓存
        const cached = this.mappingCache.get(file.path);
        if (cached) {
            return cached;
        }
        let result;
        // 如果未启用映射，使用默认牌组
        if (!this.config.enabled) {
            result = await this.getDefaultDeck();
            this.mappingCache.set(file.path, result);
            return result;
        }
        // 查找匹配的规则
        const matchedRule = this.findMatchingRule(file.path);
        if (matchedRule) {
            result = await this.applyRule(file, matchedRule);
        }
        else {
            result = await this.getDefaultDeck();
        }
        this.mappingCache.set(file.path, result);
        return result;
    }
    /**
     * 查找匹配的映射规则
     */
    findMatchingRule(filePath) {
        const fileFolder = this.getFileFolder(filePath);
        // 按规则顺序查找第一个匹配的规则
        for (const rule of this.config.rules) {
            if (this.isRuleMatch(fileFolder, rule)) {
                return rule;
            }
        }
        return null;
    }
    /**
     * 判断规则是否匹配文件路径
     */
    isRuleMatch(fileFolder, rule) {
        const ruleFolder = this.normalizePath(rule.folderPath);
        const normalizedFileFolder = this.normalizePath(fileFolder);
        if (rule.includeSubfolders) {
            // 包含子文件夹：检查文件路径是否以规则文件夹开头
            return normalizedFileFolder.startsWith(ruleFolder);
        }
        else {
            // 不包含子文件夹：必须精确匹配
            return normalizedFileFolder === ruleFolder;
        }
    }
    /**
     * 应用映射规则
     */
    async applyRule(file, rule) {
        // 1. 如果规则指定了目标牌组ID，直接使用
        if (rule.targetDeckId) {
            const deck = await this.getDeck(rule.targetDeckId);
            if (deck) {
                return {
                    deckId: deck.id,
                    deckName: deck.name,
                    isNewDeck: false,
                    ruleUsed: rule
                };
            }
        }
        // 2. 根据命名策略生成牌组名称
        const deckName = this.generateDeckName(file, rule);
        // 3. 检查牌组是否已存在
        let deck = await this.deckStorage.getDeckByName(deckName);
        let isNewDeck = false;
        // 4. 如果不存在且允许自动创建，创建新牌组
        if (!deck && rule.autoCreate) {
            deck = await this.deckStorage.createDeck(deckName, `由文件夹 ${rule.folderPath} 自动创建`);
            isNewDeck = true;
            this.deckCache.set(deck.id, deck);
        }
        // 5. 如果仍然没有牌组，使用默认牌组
        if (!deck) {
            return await this.getDefaultDeck();
        }
        return {
            deckId: deck.id,
            deckName: deck.name,
            isNewDeck,
            ruleUsed: rule
        };
    }
    /**
     * 生成牌组名称
     */
    generateDeckName(file, rule) {
        let baseName;
        switch (rule.namingStrategy) {
            case 'custom':
                baseName = rule.customName || this.getFolderName(rule.folderPath);
                break;
            case 'folder-name':
                baseName = this.getFolderName(rule.folderPath);
                break;
            case 'path-based':
                baseName = this.generatePathBasedName(file, rule);
                break;
            default:
                baseName = this.getFolderName(rule.folderPath);
        }
        // 应用前缀和后缀
        const prefix = this.config.deckNamePrefix || '';
        const suffix = this.config.deckNameSuffix || '';
        return `${prefix}${baseName}${suffix}`;
    }
    /**
     * 生成基于路径的牌组名称
     */
    generatePathBasedName(file, rule) {
        const fileFolder = this.getFileFolder(file.path);
        const ruleFolder = this.normalizePath(rule.folderPath);
        // 如果是同一文件夹，直接使用文件夹名
        if (fileFolder === ruleFolder) {
            return this.getFolderName(rule.folderPath);
        }
        // 如果在子文件夹中，根据子文件夹策略处理
        if (rule.subfolderStrategy === 'hierarchy') {
            // 层级策略：创建层级牌组名称
            const relativePath = fileFolder.substring(ruleFolder.length);
            const pathParts = relativePath.split('/').filter(_p => _p);
            return pathParts.join(this.config.hierarchySeparator);
        }
        else if (rule.subfolderStrategy === 'separate-decks') {
            // 分离策略：使用直接父文件夹名
            return this.getFolderName(fileFolder);
        }
        else {
            // 同牌组策略（默认）：使用规则文件夹名
            return this.getFolderName(rule.folderPath);
        }
    }
    /**
     * 获取默认牌组
     */
    async getDefaultDeck() {
        if (this.config.defaultDeckId) {
            const deck = await this.getDeck(this.config.defaultDeckId);
            if (deck) {
                return {
                    deckId: deck.id,
                    deckName: deck.name,
                    isNewDeck: false
                };
            }
        }
        // 如果没有默认牌组，获取第一个可用牌组
        const decks = await this.deckStorage.getDecks();
        if (decks.length > 0) {
            const firstDeck = decks[0];
            return {
                deckId: firstDeck.id,
                deckName: firstDeck.name,
                isNewDeck: false
            };
        }
        // 如果没有任何牌组，创建一个默认牌组
        const defaultDeck = await this.deckStorage.createDeck('默认牌组', '批量解析默认牌组');
        this.deckCache.set(defaultDeck.id, defaultDeck);
        return {
            deckId: defaultDeck.id,
            deckName: defaultDeck.name,
            isNewDeck: true
        };
    }
    /**
     * 获取牌组信息（带缓存）
     */
    async getDeck(deckId) {
        // 检查缓存
        if (this.deckCache.has(deckId)) {
            return this.deckCache.get(deckId);
        }
        // 从存储获取
        const deck = await this.deckStorage.getDeckById(deckId);
        if (deck) {
            this.deckCache.set(deckId, deck);
        }
        return deck;
    }
    /**
     * 获取文件的文件夹路径
     */
    getFileFolder(filePath) {
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash === -1) {
            return '';
        }
        return filePath.substring(0, lastSlash);
    }
    /**
     * 获取文件夹名称（不含路径）
     */
    getFolderName(folderPath) {
        if (!folderPath || folderPath === '.' || folderPath === '/') {
            return '根目录';
        }
        const normalized = folderPath.replace(/\/+$/, '');
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash === -1) {
            return normalized;
        }
        return normalized.substring(lastSlash + 1);
    }
    /**
     * 规范化路径
     */
    normalizePath(path) {
        if (!path || path === '.' || path === '/') {
            return '';
        }
        const normalized = path.replace(/^\/+/, '').replace(/\/+$/, '');
        return normalized;
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.clearCache();
    }
    /**
     * 清除缓存
     */
    clearCache() {
        this.mappingCache.clear();
        this.deckCache.clear();
    }
    /**
     * 添加映射规则
     */
    addRule(rule) {
        this.config.rules.push(rule);
        this.clearCache();
    }
    /**
     * 移除映射规则
     */
    removeRule(folderPath) {
        this.config.rules = this.config.rules.filter(r => r.folderPath !== folderPath);
        this.clearCache();
    }
    /**
     * 获取所有规则
     */
    getRules() {
        return [...this.config.rules];
    }
    /**
     * 批量解析文件牌组
     */
    async resolveDeckForFiles(files) {
        const results = new Map();
        for (const file of files) {
            const result = await this.resolveDeckForFile(file);
            results.set(file.path, result);
        }
        return results;
    }
}
