import { logger } from '../../utils/logger';
/**
 * 考试牌组层级管理服务
 */
export class QuestionBankHierarchyService {
    dataStorage;
    questionBankService;
    constructor(dataStorage, questionBankService) {
        if (!dataStorage) {
            throw new Error('QuestionBankHierarchyService requires WeaveDataStorage instance');
        }
        if (!questionBankService) {
            throw new Error('QuestionBankHierarchyService requires QuestionBankService instance');
        }
        this.dataStorage = dataStorage;
        this.questionBankService = questionBankService;
        logger.debug('[QuestionBankHierarchyService] Initialized');
    }
    /**
     * 基于记忆牌组树构建考试牌组树
     * 只显示有对应考试牌组的记忆牌组节点
     */
    async buildQuestionBankTree(memoryDeckTree) {
        //  修复：首先从存储重新加载所有考试牌组数据，确保数据一致性
        const allBanks = await this.questionBankService.getAllBanks();
        logger.debug('[QuestionBankHierarchyService] 当前考试牌组数量:', allBanks.length);
        // 如果没有任何考试牌组数据，直接返回空数组
        if (allBanks.length === 0) {
            logger.debug('[QuestionBankHierarchyService] 没有考试牌组数据，返回空树');
            return [];
        }
        //  修复重复显示问题：使用Set记录已添加的bankId
        const addedBankIds = new Set();
        const result = [];
        // 递归构建树的内部函数，传入已添加ID集合避免重复
        const buildTreeRecursive = async (memoryNodes) => {
            const nodes = [];
            for (const memoryNode of memoryNodes) {
                // 查找对应的考试牌组（优先通过 pairedMemoryDeckId，如果没有则通过名称匹配）
                let questionBank = await this.findQuestionBankByMemoryDeckId(memoryNode.deck.id);
                // 如果没有找到，尝试通过名称匹配（兼容旧数据）
                if (!questionBank) {
                    const bankName = `${memoryNode.deck.name} - 考试`;
                    questionBank = allBanks.find(b => b.name === bankName) || null;
                }
                //  修复：验证考试牌组存在且未被添加过
                if (questionBank && allBanks.some(b => b.id === questionBank?.id) && !addedBankIds.has(questionBank.id)) {
                    // 标记为已添加
                    addedBankIds.add(questionBank.id);
                    // 递归构建子节点
                    const children = await buildTreeRecursive(memoryNode.children);
                    // 构建考试牌组树节点
                    const questionBankNode = {
                        deck: questionBank,
                        children: children
                    };
                    nodes.push(questionBankNode);
                    logger.debug(`[QuestionBankHierarchyService] 添加考试牌组: ${questionBank.name} (ID: ${questionBank.id})`);
                }
                else {
                    //  修复关键：不要扁平化添加子节点，保持层级结构
                    // 如果当前节点没有对应考试牌组，直接递归处理子节点但不添加到当前层级
                    const children = await buildTreeRecursive(memoryNode.children);
                    // 如果父节点没有对应题库，则将子节点提升到当前层级，避免被整个分支隐藏
                    if (children.length > 0) {
                        nodes.push(...children);
                    }
                }
            }
            return nodes;
        };
        // 执行递归构建
        result.push(...await buildTreeRecursive(memoryDeckTree));
        // 方案2：如果基于记忆牌组树没有找到任何考试牌组，直接构建考试牌组树（兼容旧数据）
        if (result.length === 0 && allBanks.length > 0) {
            logger.debug('[QuestionBankHierarchyService] 未找到关联的考试牌组，使用直接构建方式');
            return this.buildTreeFromBanks(allBanks);
        }
        // 将未绑定到任何记忆牌组的题库也追加展示（新建题库可能未设置 pairedMemoryDeckId）
        const unpaired = allBanks
            .filter((b) => !addedBankIds.has(b.id))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        for (const bank of unpaired) {
            result.push({ deck: bank, children: [] });
            addedBankIds.add(bank.id);
        }
        logger.debug(`[QuestionBankHierarchyService] 构建完成，共 ${addedBankIds.size} 个唯一考试牌组`);
        return result;
    }
    /**
     * 直接从考试牌组列表构建树（平级架构）
     *
     * @deprecated v2.0+ 平级架构下 children 始终为空数组
     */
    buildTreeFromBanks(allBanks) {
        // 平级架构：所有牌组都是根节点，children 始终为空
        const roots = allBanks.map(bank => ({
            deck: bank,
            children: [] // 平级架构
        }));
        // 按 order 排序
        roots.sort((a, b) => (a.deck.order || 0) - (b.deck.order || 0));
        return roots;
    }
    /**
     * 根据记忆牌组ID查找对应的考试牌组
     */
    async findQuestionBankByMemoryDeckId(memoryDeckId) {
        return await this.questionBankService.findBankByMemoryDeckId(memoryDeckId);
    }
    /**
     * 确保考试牌组存在（如果不存在则创建空的考试牌组）
     * 用于维护层级关系
     */
    async ensureQuestionBankExists(memoryDeckId) {
        logger.debug('[QuestionBankHierarchyService] ensureQuestionBankExists 开始:', { memoryDeckId });
        // 先查找是否已存在
        const questionBank = await this.findQuestionBankByMemoryDeckId(memoryDeckId);
        if (questionBank) {
            logger.debug('[QuestionBankHierarchyService] ensureQuestionBankExists 已存在:', {
                bankId: questionBank.id,
                bankName: questionBank.name
            });
            return questionBank;
        }
        // 禁用旧方案：不允许任何隐式/后台自动创建题库
        throw new Error('未找到对应题库。已禁用自动重建/自动创建题库，请在卡片管理中使用“组建考试牌组”从选择题引入创建。');
    }
    /**
     * @deprecated v2.0+ 平级架构不支持牌组移动
     * 调用此方法将抛出错误
     */
    async syncMove(_memoryDeckId, _newParentMemoryDeckId) {
        throw new Error('[QuestionBankHierarchyService] syncMove() 已废弃 - 平级架构不支持牌组移动');
    }
    /**
     * 同步重命名考试牌组（当记忆牌组重命名时调用）
     */
    async syncRename(memoryDeckId, newMemoryDeckName) {
        const questionBank = await this.findQuestionBankByMemoryDeckId(memoryDeckId);
        if (!questionBank) {
            return;
        }
        const oldName = questionBank.name;
        const oldPath = questionBank.path;
        // 更新名称（保持 " - 考试" 后缀）
        questionBank.name = `${newMemoryDeckName} - 考试`;
        // 更新路径
        if (questionBank.parentId) {
            const parentBank = await this.questionBankService.getBankById(questionBank.parentId);
            if (parentBank) {
                questionBank.path = `${parentBank.path}::${questionBank.name}`;
            }
        }
        else {
            questionBank.path = questionBank.name;
        }
        questionBank.modified = new Date().toISOString();
        await this.questionBankService.updateBank(questionBank);
        // 递归更新子考试牌组的路径
        await this.updateChildrenPaths(questionBank.id, oldPath, questionBank.path);
        logger.debug(`[QuestionBankHierarchyService] 同步重命名考试牌组: ${oldName} -> ${questionBank.name}`);
    }
    /**
     * 同步删除考试牌组（当记忆牌组删除时调用）
     */
    async syncDelete(memoryDeckId) {
        const questionBank = await this.findQuestionBankByMemoryDeckId(memoryDeckId);
        if (!questionBank) {
            return;
        }
        // 获取所有子考试牌组
        const descendants = await this.getDescendants(questionBank.id);
        // 删除所有子孙（从叶子节点开始）
        const sortedDescendants = descendants.sort((a, b) => (b.level || 0) - (a.level || 0));
        for (const child of sortedDescendants) {
            await this.questionBankService.deleteBank(child.id);
        }
        // 删除自己
        await this.questionBankService.deleteBank(questionBank.id);
        logger.debug(`[QuestionBankHierarchyService] 同步删除考试牌组: ${questionBank.name}`);
    }
    /**
     * 递归更新子考试牌组的路径
     */
    async updateChildrenPaths(parentId, oldParentPath, newParentPath) {
        const allBanks = await this.questionBankService.getAllBanks();
        const children = allBanks.filter(b => b.parentId === parentId);
        for (const child of children) {
            const oldChildPath = child.path;
            child.path = child.path.replace(oldParentPath, newParentPath);
            child.modified = new Date().toISOString();
            await this.questionBankService.updateBank(child);
            // 递归更新子考试牌组的子考试牌组
            await this.updateChildrenPaths(child.id, oldChildPath, child.path);
        }
    }
    /**
     * 获取考试牌组的所有子孙
     */
    async getDescendants(questionBankId) {
        const allBanks = await this.questionBankService.getAllBanks();
        const bank = allBanks.find(b => b.id === questionBankId);
        if (!bank)
            return [];
        const descendants = [];
        const collect = (parentPath) => {
            const children = allBanks.filter(b => b.parentId && b.path.startsWith(`${parentPath}::`));
            for (const child of children) {
                descendants.push(child);
                collect(child.path);
            }
        };
        collect(bank.path);
        return descendants;
    }
    /**
     * 获取默认设置
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
