/**
 * IR 会话制卡统计服务
 *
 * 功能：
 * - 按块统计本次会话创建的卡片
 * - 持久化到 localStorage（支持异常关闭后恢复）
 * - 正常结束会话时清零
 * - 监听卡片删除事件，削减计数
 *
 * @version 5.8.0
 */
import { logger } from '../../utils/logger';
import { vaultStorage } from '../../utils/vault-local-storage';
const STORAGE_KEY = 'weave-ir-session-card-stats';
/**
 * IR 会话制卡统计服务
 */
export class IRSessionCardStatsService {
    app;
    store;
    eventHandlers;
    constructor(app) {
        this.app = app;
        this.store = this.loadFromStorage();
        // 绑定事件处理器
        this.eventHandlers = {
            onCardCreated: this.handleCardCreated.bind(this),
            onCardDeleted: this.handleCardDeleted.bind(this)
        };
    }
    /**
     * 初始化服务，注册事件监听
     */
    initialize() {
        // 检查是否需要恢复上次未正常结束的会话
        if (!this.store.sessionEnded && Object.keys(this.store.blockStats).length > 0) {
            logger.info('[IRSessionCardStatsService] 检测到上次会话未正常结束，保留统计数据');
        }
        else {
            // 开始新会话
            this.startNewSession();
        }
        // 注册事件监听
        this.app.workspace.on('Weave:card-created', this.eventHandlers.onCardCreated);
        this.app.workspace.on('Weave:card-deleted', this.eventHandlers.onCardDeleted);
        logger.debug('[IRSessionCardStatsService] 服务已初始化');
    }
    /**
     * 销毁服务，移除事件监听
     * @param normalEnd 是否正常结束（true=清除统计，false=保留供恢复）
     */
    destroy(normalEnd = true) {
        // 移除事件监听
        this.app.workspace.off('Weave:card-created', this.eventHandlers.onCardCreated);
        this.app.workspace.off('Weave:card-deleted', this.eventHandlers.onCardDeleted);
        if (normalEnd) {
            // 正常结束：清除统计
            this.store.sessionEnded = true;
            this.store.blockStats = {};
            this.saveToStorage();
            logger.info('[IRSessionCardStatsService] 会话正常结束，统计已清除');
        }
        else {
            // 异常结束：保留统计供下次恢复
            this.saveToStorage();
            logger.info('[IRSessionCardStatsService] 会话异常结束，统计已保存');
        }
    }
    /**
     * 开始新会话
     */
    startNewSession() {
        this.store = {
            sessionStartTime: Date.now(),
            blockStats: {},
            sessionEnded: false
        };
        this.saveToStorage();
    }
    /**
     * 处理卡片创建事件
     */
    handleCardCreated(card) {
        const cardUuid = card.uuid;
        const sourceFile = card.sourceFile || card.cardMetadata?.sourceFile;
        if (!cardUuid || !sourceFile) {
            return;
        }
        // 查找匹配的块（通过 filePath）
        // 注意：这里使用 filePath 作为 blockId 的简化方案
        // 实际应用中可能需要更精确的块匹配
        const blockId = sourceFile; // 简化：用 filePath 作为 blockId
        if (!this.store.blockStats[blockId]) {
            this.store.blockStats[blockId] = {
                blockId,
                filePath: sourceFile,
                cardUuids: [],
                updatedAt: Date.now()
            };
        }
        const blockStats = this.store.blockStats[blockId];
        // 去重
        if (!blockStats.cardUuids.includes(cardUuid)) {
            blockStats.cardUuids.push(cardUuid);
            blockStats.updatedAt = Date.now();
            this.saveToStorage();
            logger.debug(`[IRSessionCardStatsService] 卡片已记录: block=${blockId}, card=${cardUuid}, count=${blockStats.cardUuids.length}`);
        }
    }
    /**
     * 处理卡片删除事件
     */
    handleCardDeleted(cardUuid) {
        if (!cardUuid)
            return;
        // 遍历所有块，查找并移除该卡片
        for (const blockId of Object.keys(this.store.blockStats)) {
            const blockStats = this.store.blockStats[blockId];
            const index = blockStats.cardUuids.indexOf(cardUuid);
            if (index !== -1) {
                blockStats.cardUuids.splice(index, 1);
                blockStats.updatedAt = Date.now();
                this.saveToStorage();
                logger.debug(`[IRSessionCardStatsService] 卡片已移除: block=${blockId}, card=${cardUuid}, count=${blockStats.cardUuids.length}`);
                break;
            }
        }
    }
    /**
     * 获取指定块的本次会话制卡数
     */
    getBlockCardCount(blockId) {
        return this.store.blockStats[blockId]?.cardUuids.length ?? 0;
    }
    /**
     * 获取指定文件路径的本次会话制卡数
     */
    getFileCardCount(filePath) {
        const blockStats = this.store.blockStats[filePath];
        return blockStats?.cardUuids.length ?? 0;
    }
    /**
     * 获取所有块的统计
     */
    getAllStats() {
        return { ...this.store.blockStats };
    }
    /**
     * 手动添加卡片到指定块（用于兼容现有逻辑）
     */
    addCardToBlock(blockId, filePath, cardUuid) {
        if (!this.store.blockStats[blockId]) {
            this.store.blockStats[blockId] = {
                blockId,
                filePath,
                cardUuids: [],
                updatedAt: Date.now()
            };
        }
        const blockStats = this.store.blockStats[blockId];
        if (!blockStats.cardUuids.includes(cardUuid)) {
            blockStats.cardUuids.push(cardUuid);
            blockStats.updatedAt = Date.now();
            this.saveToStorage();
        }
    }
    /**
     * 从 localStorage 加载数据
     */
    loadFromStorage() {
        try {
            const data = vaultStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        }
        catch (error) {
            logger.warn('[IRSessionCardStatsService] 加载存储数据失败:', error);
        }
        return {
            sessionStartTime: Date.now(),
            blockStats: {},
            sessionEnded: true
        };
    }
    /**
     * 保存数据到 localStorage
     */
    saveToStorage() {
        try {
            vaultStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
        }
        catch (error) {
            logger.warn('[IRSessionCardStatsService] 保存存储数据失败:', error);
        }
    }
}
// 单例实例
let instance = null;
/**
 * 获取会话制卡统计服务实例
 */
export function getSessionCardStatsService(app) {
    if (!instance && app) {
        instance = new IRSessionCardStatsService(app);
    }
    return instance;
}
/**
 * 创建会话制卡统计服务实例
 */
export function createSessionCardStatsService(app) {
    if (instance) {
        instance.destroy(false); // 不清除数据
    }
    instance = new IRSessionCardStatsService(app);
    return instance;
}
/**
 * 销毁会话制卡统计服务实例
 */
export function destroySessionCardStatsService(normalEnd = true) {
    if (instance) {
        instance.destroy(normalEnd);
        instance = null;
    }
}
