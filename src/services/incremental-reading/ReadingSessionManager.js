/**
 * 阅读会话管理服务
 *
 * 负责阅读会话的创建、记录和统计
 *
 * @module services/incremental-reading/ReadingSessionManager
 * @version 1.0.0
 */
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/reading-utils';
/**
 * 阅读会话管理器
 */
export class ReadingSessionManager {
    storage;
    /** 当前活跃的会话 */
    activeSession = null;
    constructor(_app, // 保留参数以保持 API 兼容性
    storage, _materialManager // 保留参数以保持 API 兼容性
    ) {
        this.storage = storage;
    }
    // ===== 会话生命周期 =====
    /**
     * 开始新的阅读会话
     * @param materialId 阅读材料ID
     * @param options 会话选项
     * @returns 创建的会话，如果已有活跃会话则返回null
     */
    async startSession(materialId, options = {}) {
        // 检查是否已有活跃会话
        if (this.activeSession) {
            logger.warn('[ReadingSessionManager] 已有活跃会话，请先结束当前会话');
            return null;
        }
        // 验证材料存在
        const material = await this.storage.getMaterialById(materialId);
        if (!material) {
            logger.error(`[ReadingSessionManager] 材料不存在: ${materialId}`);
            return null;
        }
        const now = new Date();
        const session = {
            uuid: generateUUID(),
            materialId,
            startTime: now.toISOString(),
            duration: 0,
            startAnchor: options.startAnchor || material.progress.currentAnchor,
            wordsRead: 0,
            notes: options.notes,
            cardsCreated: []
        };
        // 设置活跃会话
        this.activeSession = {
            session,
            materialId,
            startTime: now
        };
        // 更新材料的最后访问时间
        material.lastAccessed = now.toISOString();
        await this.storage.saveMaterial(material);
        logger.info(`[ReadingSessionManager] 开始会话: ${session.uuid} for ${materialId}`);
        return session;
    }
    /**
     * 结束当前阅读会话
     * @param options 结束选项
     * @returns 完成的会话，如果没有活跃会话则返回null
     */
    async endSession(options = {}) {
        if (!this.activeSession) {
            logger.warn('[ReadingSessionManager] 没有活跃会话');
            return null;
        }
        const { session, materialId, startTime } = this.activeSession;
        const now = new Date();
        // 计算持续时间（秒）
        const duration = Math.round((now.getTime() - startTime.getTime()) / 1000);
        // 更新会话数据
        session.endTime = now.toISOString();
        session.duration = duration;
        session.endAnchor = options.endAnchor;
        session.rating = options.rating;
        session.comprehension = options.comprehension;
        if (options.notes) {
            session.notes = options.notes;
        }
        if (options.cardsCreated) {
            session.cardsCreated = options.cardsCreated;
        }
        // 计算阅读字数
        const material = await this.storage.getMaterialById(materialId);
        if (material && session.startAnchor && session.endAnchor) {
            session.wordsRead = await this.calculateWordsRead(material, session.startAnchor, session.endAnchor);
        }
        // 保存会话
        await this.storage.saveSession(session);
        // 清除活跃会话
        this.activeSession = null;
        logger.info(`[ReadingSessionManager] 结束会话: ${session.uuid}, 时长: ${duration}秒`);
        return session;
    }
    /**
     * 取消当前会话（不保存）
     */
    cancelSession() {
        if (this.activeSession) {
            logger.info(`[ReadingSessionManager] 取消会话: ${this.activeSession.session.uuid}`);
            this.activeSession = null;
        }
    }
    /**
     * 获取当前活跃会话
     */
    getActiveSession() {
        return this.activeSession?.session || null;
    }
    /**
     * 检查是否有活跃会话
     */
    hasActiveSession() {
        return this.activeSession !== null;
    }
    /**
     * 获取当前会话的持续时间（秒）
     */
    getCurrentDuration() {
        if (!this.activeSession) {
            return 0;
        }
        return Math.round((Date.now() - this.activeSession.startTime.getTime()) / 1000);
    }
    // ===== 会话更新 =====
    /**
     * 更新当前会话的笔记
     */
    updateSessionNotes(notes) {
        if (this.activeSession) {
            this.activeSession.session.notes = notes;
        }
    }
    /**
     * 添加创建的卡片到当前会话
     */
    addCreatedCard(cardId) {
        if (this.activeSession) {
            this.activeSession.session.cardsCreated.push(cardId);
        }
    }
    // ===== 会话查询 =====
    /**
     * 获取材料的所有会话
     */
    async getSessionsForMaterial(materialId) {
        return await this.storage.getSessionsForMaterial(materialId);
    }
    /**
     * 获取材料的会话统计
     */
    async getSessionStats(materialId) {
        const sessions = await this.getSessionsForMaterial(materialId);
        if (sessions.length === 0) {
            return {
                totalSessions: 0,
                totalDuration: 0,
                totalWordsRead: 0,
                averageDuration: 0,
                averageRating: 0,
                lastSessionDate: null
            };
        }
        let totalDuration = 0;
        let totalWordsRead = 0;
        let ratingSum = 0;
        let ratingCount = 0;
        let lastSessionDate = null;
        for (const session of sessions) {
            totalDuration += session.duration;
            totalWordsRead += session.wordsRead;
            if (session.rating) {
                ratingSum += session.rating;
                ratingCount++;
            }
            if (!lastSessionDate || (session.endTime && session.endTime > lastSessionDate)) {
                lastSessionDate = session.endTime || session.startTime;
            }
        }
        return {
            totalSessions: sessions.length,
            totalDuration,
            totalWordsRead,
            averageDuration: Math.round(totalDuration / sessions.length),
            averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
            lastSessionDate
        };
    }
    /**
     * 获取今日的会话统计
     */
    async getTodayStats() {
        const materials = await this.storage.getAllMaterials();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let sessionsCount = 0;
        let totalDuration = 0;
        let totalWordsRead = 0;
        const materialsRead = [];
        for (const material of materials) {
            const sessions = await this.getSessionsForMaterial(material.uuid);
            for (const session of sessions) {
                const sessionDate = new Date(session.startTime);
                if (sessionDate >= today) {
                    sessionsCount++;
                    totalDuration += session.duration;
                    totalWordsRead += session.wordsRead;
                    if (!materialsRead.includes(material.uuid)) {
                        materialsRead.push(material.uuid);
                    }
                }
            }
        }
        return {
            sessionsCount,
            totalDuration,
            totalWordsRead,
            materialsRead
        };
    }
    // ===== 辅助方法 =====
    /**
     * 计算两个锚点之间的阅读字数
     */
    async calculateWordsRead(material, startAnchor, endAnchor) {
        // 从锚点历史中查找字数
        const startRecord = material.progress.anchorHistory.find(a => a.anchorId === startAnchor);
        const endRecord = material.progress.anchorHistory.find(a => a.anchorId === endAnchor);
        if (startRecord && endRecord) {
            return Math.max(0, endRecord.wordCount - startRecord.wordCount);
        }
        // 如果找不到记录，返回0
        return 0;
    }
}
/**
 * 创建阅读会话管理器实例
 */
export function createReadingSessionManager(app, storage, materialManager) {
    return new ReadingSessionManager(app, storage, materialManager);
}
