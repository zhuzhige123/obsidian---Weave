import { logger } from '../../utils/logger';
import { generateId } from '../../utils/helpers';
/**
 * 题库核心服务
 */
export class QuestionBankService {
    storage;
    banks = [];
    dataStorage;
    constructor(storage, dataStorage) {
        if (!storage) {
            throw new Error('QuestionBankService requires a valid QuestionBankStorage instance');
        }
        if (!dataStorage) {
            throw new Error('QuestionBankService requires a valid WeaveDataStorage instance');
        }
        this.storage = storage;
        this.dataStorage = dataStorage;
        // 服务初始化完成
    }
    // ============================================================================
    // 初始化
    // ============================================================================
    /**
     * 初始化服务（加载数据）
     * 注意：QuestionBankStorage 应该在传入前已经初始化
     */
    async initialize() {
        await this.loadData();
    }
    /**
     * 加载所有数据（按题库加载）
     */
    async loadData() {
        this.banks = await this.storage.loadBanks();
        //  调试日志：显示从存储加载的原始数据
        logger.debug('[QuestionBankService] loadData 从存储加载的题库:', this.banks.map(b => ({
            id: b.id,
            name: b.name,
            pairedMemoryDeckId: b.metadata?.pairedMemoryDeckId
        })));
        // 防御性检查：确保数据格式正确
        if (!Array.isArray(this.banks)) {
            logger.error('[QuestionBankService] banks 数据损坏，重置为空数组');
            this.banks = [];
            await this.storage.saveBanks([]);
        }
        // 题库数据加载完成
    }
    /**
     * 保存所有数据（按题库保存）
     */
    async saveData() {
        await this.storage.saveBanks(this.banks);
    }
    // ============================================================================
    // 题库牌组管理
    // ============================================================================
    /**
     * 创建题库牌组
     * @param name 题库名称
     * @param description 题库描述
     * @param initialMetadata 初始 metadata（可选，用于设置 pairedMemoryDeckId 等）
     */
    async createQuestionBank(name, description = '', initialMetadata) {
        const now = new Date().toISOString();
        const bank = {
            id: generateId(),
            name,
            description,
            category: '',
            categoryIds: [],
            parentId: undefined,
            path: name,
            level: 0,
            order: this.banks.length,
            inheritSettings: false,
            deckType: 'question-bank',
            settings: this.getDefaultSettings(),
            stats: this.getDefaultStats(),
            includeSubdecks: false,
            created: now,
            modified: now,
            tags: [],
            metadata: initialMetadata || {},
        };
        this.banks.push(bank);
        await this.storage.saveBanks(this.banks);
        // 题库创建成功
        logger.debug('[QuestionBankService] createQuestionBank 完成:', {
            bankId: bank.id,
            bankName: bank.name,
            pairedMemoryDeckId: bank.metadata?.pairedMemoryDeckId
        });
        return bank;
    }
    /**
     * 获取题库牌组
     */
    getQuestionBank(bankId) {
        return this.banks.find(b => b.id === bankId);
    }
    /**
     * 获取所有题库牌组
     */
    getAllQuestionBanks() {
        return [...this.banks];
    }
    /**
     * 获取所有题库（别名方法）
     *  修复：每次调用时从存储重新加载，确保数据一致性
     */
    async getAllBanks() {
        //  从存储重新加载数据，避免内存缓存导致的残留数据问题
        await this.loadData();
        return this.getAllQuestionBanks();
    }
    /**
     * 根据ID获取题库（别名方法）
     */
    getBankById(bankId) {
        return this.getQuestionBank(bankId) || null;
    }
    /**
     * 根据记忆牌组ID查找对应的考试牌组
     *  修复：从存储重新加载数据，确保数据一致性
     */
    async findBankByMemoryDeckId(memoryDeckId) {
        //  从存储重新加载数据，避免内存缓存导致的残留数据问题
        await this.loadData();
        const allBanks = this.getAllQuestionBanks();
        const bank = allBanks.find(b => b.metadata &&
            b.metadata.pairedMemoryDeckId === memoryDeckId);
        logger.debug('[QuestionBankService] findBankByMemoryDeckId:', {
            searchingFor: memoryDeckId,
            found: !!bank,
            bankName: bank?.name
        });
        return bank || null;
    }
    /**
     * 创建题库（别名方法，兼容 QuestionBank 接口）
     *  关键修复：在创建时就设置完整的 metadata，避免竞态条件
     */
    async createBank(bank) {
        const name = bank.name || '未命名题库';
        const description = bank.description || '';
        //  关键修复：在创建时就传入 metadata，避免后续更新时的竞态条件
        // 之前的问题：createQuestionBank 先保存空 metadata，然后再更新
        // 如果在两次保存之间有 loadData() 调用，metadata 会丢失
        const initialMetadata = bank.metadata ? { ...bank.metadata } : {};
        //  直接传入 metadata 到 createQuestionBank
        const createdBank = await this.createQuestionBank(name, description, initialMetadata);
        // 构建其他更新（不包括 metadata，因为已经在创建时设置）
        const updates = {};
        if (bank.difficulty)
            updates.difficulty = bank.difficulty;
        if (bank.tags)
            updates.tags = bank.tags;
        if (bank.category)
            updates.category = bank.category;
        if (bank.parentId !== undefined)
            updates.parentId = bank.parentId;
        if (bank.path)
            updates.path = bank.path;
        if (bank.level !== undefined)
            updates.level = bank.level;
        if (bank.order !== undefined)
            updates.order = bank.order;
        if (bank.deckType)
            updates.deckType = bank.deckType;
        // 如果有其他更新，应用它们
        if (Object.keys(updates).length > 0) {
            Object.assign(createdBank, updates);
            // 保存到存储
            await this.storage.saveBanks(this.banks);
        }
        return createdBank;
    }
    /**
     * 更新题库（别名方法，兼容整个对象更新）
     */
    async updateBank(bank) {
        await this.updateQuestionBank(bank.id, bank);
    }
    /**
     * 更新题库牌组
     */
    async updateQuestionBank(bankId, updates) {
        const bank = this.banks.find(b => b.id === bankId);
        if (!bank) {
            throw new Error(`题库不存在: ${bankId}`);
        }
        //  修复：特殊处理 metadata 字段，确保合并而不是替换
        if (updates.metadata) {
            // 确保 bank 有 metadata 对象
            if (!bank.metadata) {
                bank.metadata = {};
            }
            // 合并 metadata
            bank.metadata = {
                ...bank.metadata,
                ...updates.metadata
            };
            // 从 updates 中移除 metadata，避免 Object.assign 覆盖
            const { metadata, ...restUpdates } = updates;
            Object.assign(bank, restUpdates);
        }
        else {
            Object.assign(bank, updates);
        }
        bank.modified = new Date().toISOString();
        await this.storage.saveBanks(this.banks);
        // 题库更新成功
    }
    /**
     * 删除题库（别名方法）
     */
    async deleteBank(bankId) {
        await this.deleteQuestionBank(bankId);
    }
    /**
     * 更新题库配置
     */
    async updateBankConfig(bankId, config) {
        const bank = this.banks.find(b => b.id === bankId);
        if (!bank) {
            throw new Error(`题库不存在: ${bankId}`);
        }
        // 确保metadata存在
        if (!bank.metadata) {
            bank.metadata = {};
        }
        // 确保config存在
        if (!bank.metadata.config) {
            bank.metadata.config = {};
        }
        // 更新modeConfig
        bank.metadata.config.modeConfig = config;
        bank.modified = new Date().toISOString();
        await this.storage.saveBanks(this.banks);
        // 题库配置更新成功
    }
    /**
     * 删除题库牌组（及其所有题目）
     */
    async deleteQuestionBank(bankId) {
        const index = this.banks.findIndex(b => b.id === bankId);
        if (index === -1) {
            throw new Error(`题库不存在: ${bankId}`);
        }
        const bank = this.banks[index];
        const pairedMemoryDeckId = bank.metadata?.pairedMemoryDeckId;
        const bankIdsToDelete = pairedMemoryDeckId
            ? this.banks.filter((b) => b.metadata?.pairedMemoryDeckId === pairedMemoryDeckId).map((b) => b.id)
            : [bankId];
        for (const id of bankIdsToDelete) {
            //  删除题库文件夹
            try {
                await this.storage.deleteBankQuestions(id);
            }
            catch (error) {
                logger.error(`[QuestionBankService] 删除题库题目文件失败: ${id}`, error);
            }
            // 删除错题本数据
            try {
                await this.storage.deleteErrorBook(id);
            }
            catch (error) {
                logger.error(`[QuestionBankService] 删除错题本失败: ${id}`, error);
            }
        }
        // 删除题库（内存）
        const toDelete = new Set(bankIdsToDelete);
        this.banks = this.banks.filter((b) => !toDelete.has(b.id));
        await this.storage.saveBanks(this.banks);
        // 题库删除成功
    }
    // ============================================================================
    // 题目管理
    // ============================================================================
    /**
     * 添加题目到题库
     */
    async addQuestion(bankId, question) {
        await this.addQuestionRefs(bankId, [question.uuid]);
    }
    /**
     * 批量添加题目
     */
    async addQuestions(bankId, questions) {
        await this.addQuestionRefs(bankId, questions.map(q => q.uuid));
    }
    async addQuestionRefs(bankId, cardUuids) {
        const bank = this.getQuestionBank(bankId);
        if (!bank) {
            throw new Error(`题库不存在: ${bankId}`);
        }
        const refs = await this.storage.loadBankQuestionRefs(bankId);
        const existing = new Set(refs.map(r => r.cardUuid));
        const now = new Date().toISOString();
        for (const uuid of cardUuids) {
            if (!uuid || existing.has(uuid))
                continue;
            refs.push({ cardUuid: uuid, addedAt: now });
            existing.add(uuid);
        }
        await this.storage.saveBankQuestionRefs(bankId, refs);
        await this.updateBankStats(bankId);
    }
    /**
     * 根据ID获取题目（async版本，用于实时刷新）
     *  先从内存查找，找不到则从数据库重新加载
     */
    async getQuestionById(bankId, questionId) {
        try {
            const questions = await this.getQuestionsByBank(bankId);
            return questions.find(q => q.uuid === questionId) || null;
        }
        catch (error) {
            logger.error('[QuestionBankService] 获取题目失败:', questionId, error);
            return null;
        }
    }
    /**
     * 更新题目
     */
    async updateQuestion(questionId, updates) {
        const card = await this.dataStorage.getCardByUUID(questionId);
        if (!card) {
            throw new Error(`题目不存在: ${questionId}`);
        }
        const { stats, deckId, cardPurpose, ...rest } = updates;
        Object.assign(card, rest);
        card.modified = new Date().toISOString();
        await this.dataStorage.saveCard(card);
    }
    /**
     * 删除题目
     * @param questionIdOrBankId - 题目ID，或者第一个参数为bankId时的bankId
     * @param questionId - 当第一个参数为bankId时的题目ID
     */
    async deleteQuestion(questionIdOrBankId, questionId) {
        // 兼容两种调用方式：
        // 1. deleteQuestion(questionId)
        // 2. deleteQuestion(bankId, questionId)
        const actualQuestionId = questionId || questionIdOrBankId;
        let bankId = questionId ? questionIdOrBankId : undefined;
        if (!bankId) {
            // 兼容旧调用：自动定位所属题库（首次命中即返回）
            for (const bank of this.banks) {
                const refs = await this.storage.loadBankQuestionRefs(bank.id);
                if (refs.some(r => r.cardUuid === actualQuestionId)) {
                    bankId = bank.id;
                    break;
                }
            }
        }
        if (!bankId) {
            throw new Error('deleteQuestion 无法定位题库，请提供 bankId');
        }
        const refs = await this.storage.loadBankQuestionRefs(bankId);
        const filtered = refs.filter(r => r.cardUuid !== actualQuestionId);
        await this.storage.saveBankQuestionRefs(bankId, filtered);
        await this.updateBankStats(bankId);
    }
    // ============================================================================
    // 题目查询
    // ============================================================================
    async resolveCardsByUuidsFromAllCards(uuids) {
        if (uuids.length === 0)
            return [];
        const allCards = await this.dataStorage.getCards();
        const cardByUuid = new Map();
        for (const c of allCards) {
            cardByUuid.set(c.uuid, c);
        }
        const resolved = [];
        let missingCount = 0;
        for (const uuid of uuids) {
            const card = cardByUuid.get(uuid);
            if (!card) {
                missingCount++;
                continue;
            }
            resolved.push(card);
        }
        if (missingCount > 0) {
            logger.warn('[QuestionBankService] 题库引用的卡片未找到（可能被删除或索引未同步）:', {
                requested: uuids.length,
                resolved: resolved.length,
                missing: missingCount,
            });
        }
        return resolved;
    }
    /**
     * 获取题库的所有题目
     */
    async getQuestionsByBank(bankId, filter) {
        const refs = await this.storage.loadBankQuestionRefs(bankId);
        const uuids = refs.map(r => r.cardUuid).filter(Boolean);
        // 不能使用 dataStorage.getCardsByUUIDs：它可能受 deck 过滤/索引状态影响，导致题库引用题目被错误过滤为空
        const cards = await this.resolveCardsByUuidsFromAllCards(uuids);
        const statsByUuid = await this.storage.loadGlobalQuestionStats();
        const merged = cards.map((c) => {
            const clone = { ...c, deckId: bankId, cardPurpose: 'test' };
            const testStats = statsByUuid[c.uuid];
            if (testStats) {
                clone.stats = clone.stats ? { ...clone.stats, testStats } : { testStats };
            }
            return clone;
        });
        if (filter) {
            return this.applyFilter(merged, filter);
        }
        return merged;
    }
    /**
     * 获取未测试的题目
     */
    async getUntestedQuestions(bankId) {
        const questions = await this.getQuestionsByBank(bankId);
        return questions.filter(q => !q.stats?.testStats || q.stats.testStats.totalAttempts === 0);
    }
    /**
     * 获取错题
     */
    async getErrorQuestions(bankId) {
        const questions = await this.getQuestionsByBank(bankId);
        return questions.filter(q => !!q.stats?.testStats?.isInErrorBook);
    }
    /**
     * 应用筛选条件
     */
    applyFilter(questions, filter) {
        let result = [...questions];
        // 按标签筛选
        if (filter.tags && filter.tags.length > 0) {
            result = result.filter(q => filter.tags?.some(tag => q.tags?.includes(tag)));
        }
        // 按难度筛选
        if (filter.difficulty) {
            result = result.filter(q => q.difficulty === filter.difficulty);
        }
        // 按题型筛选
        if (filter.cardType) {
            // TODO: 需要实现题型映射逻辑
        }
        // 仅未测试题目
        if (filter.untestedOnly) {
            result = result.filter(q => !q.stats?.testStats || q.stats.testStats.totalAttempts === 0);
        }
        // 仅错题
        if (filter.errorOnly) {
            result = result.filter(q => q.stats?.testStats?.isInErrorBook);
        }
        return result;
    }
    // ============================================================================
    // 统计信息
    // ============================================================================
    /**
     * 更新题库统计信息
     */
    async updateBankStats(bankId) {
        const bank = this.getQuestionBank(bankId);
        if (!bank)
            return;
        const questions = await this.getQuestionsByBank(bankId);
        // 统计基础信息
        const totalQuestions = questions.length;
        const testedQuestions = questions.filter(q => q.stats?.testStats && q.stats.testStats.totalAttempts > 0).length;
        // 统计平均正确率和分数
        const testedQuestionsWithStats = questions.filter(q => q.stats?.testStats && q.stats.testStats.totalAttempts > 0);
        const averageAccuracy = testedQuestionsWithStats.length > 0
            ? testedQuestionsWithStats.reduce((sum, q) => {
                // 优先使用EWMA算法计算的当前掌握度
                const currentAccuracy = q.stats.testStats?.masteryMetrics?.currentAccuracy;
                // 如果没有掌握度指标，回退到旧的简单平均
                const accuracy = currentAccuracy !== undefined ? currentAccuracy / 100 : (q.stats.testStats?.accuracy || 0);
                return sum + accuracy;
            }, 0) / testedQuestionsWithStats.length
            : 0;
        const averageScore = testedQuestionsWithStats.length > 0
            ? testedQuestionsWithStats.reduce((sum, q) => sum + (q.stats.testStats?.averageScore || 0), 0) / testedQuestionsWithStats.length
            : 0;
        // 统计错题数量
        const errorCount = questions.filter(q => q.stats.testStats?.isInErrorBook).length;
        // 按难度分布
        const byDifficulty = {
            easy: questions.filter(q => q.difficulty === 'easy').length,
            medium: questions.filter(q => q.difficulty === 'medium').length,
            hard: questions.filter(q => q.difficulty === 'hard').length,
        };
        // 更新元数据中的统计信息
        if (!bank.metadata) {
            bank.metadata = {};
        }
        bank.metadata.questionBankStats = {
            totalQuestions,
            testedQuestions,
            averageAccuracy,
            averageScore,
            averageCompletionTime: 0, // TODO: 从测试会话中计算
            errorCount,
            totalTests: 0, // TODO: 从测试会话中计算
            byDifficulty,
        };
        bank.modified = new Date().toISOString();
        await this.storage.saveBanks(this.banks);
    }
    /**
     * 获取题库统计信息
     */
    async getBankStats(bankId) {
        const bank = this.getQuestionBank(bankId);
        if (!bank)
            return null;
        // 确保统计信息是最新的
        await this.updateBankStats(bankId);
        return bank.metadata?.questionBankStats || null;
    }
    // ============================================================================
    // 辅助方法
    // ============================================================================
    /**
     * 获取默认牌组设置
     */
    getDefaultSettings() {
        return {
            newCardsPerDay: 20,
            maxReviewsPerDay: 200,
            enableAutoAdvance: false,
            showAnswerTime: 0,
            fsrsParams: {
                w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
                requestRetention: 0.9,
                maximumInterval: 36500,
                enableFuzz: true,
            },
            learningSteps: [1, 10],
            relearningSteps: [10],
            graduatingInterval: 1,
            easyInterval: 4,
        };
    }
    /**
     * 获取默认统计信息
     */
    getDefaultStats() {
        return {
            totalCards: 0,
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
            todayNew: 0,
            todayReview: 0,
            todayTime: 0,
            totalReviews: 0,
            totalTime: 0,
            memoryRate: 0,
            averageEase: 0,
            forecastDays: {},
        };
    }
}
