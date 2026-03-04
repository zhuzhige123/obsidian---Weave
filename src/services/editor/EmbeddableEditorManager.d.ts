/**
 * EmbeddableEditorManager - 嵌入式编辑器管理器
 *
 * 使用 DetachedLeafEditor 实现零闪烁、高性能的编辑体验 (基于 Obsidian WorkspaceLeaf)
 * 支持卡片创建/编辑模态窗和学习界面的编辑功能
 */
import type { App } from 'obsidian';
import type { Card } from '../../data/types';
/**
 * 嵌入式编辑器管理器
 */
export declare class EmbeddableEditorManager {
    private app;
    private sessions;
    private readonly STUDY_SESSION_CARD_ID;
    private currentEditingCardUuid;
    constructor(app: App);
    /**
     * 获取学习会话编辑器的 cardId
     */
    get studySessionCardId(): string;
    /**
     * 设置当前编辑的卡片ID
     */
    setCurrentEditingCard(cardId: string): void;
    /**
     * 创建编辑会话
     * 为卡片编辑创建一个新的会话，支持普通模式和学习会话模式
     */
    createEditorSession(card: Card, options?: {
        isStudySession?: boolean;
        sessionId?: string;
        sourcePath?: string;
    }): Promise<{
        success: boolean;
        sessionId?: string;
        filePath?: string;
        error?: string;
    }>;
    /**
     * 创建嵌入式编辑器
     * 在指定容器中创建零闪烁的Markdown编辑器
     * @param onChange v2.2: 可选的实时变化回调（用于增量阅读实时写入）
     */
    createEmbeddedEditor(container: HTMLElement, sessionId: string, onSave: (content: string) => void, onCancel: () => void, onChange?: (content: string) => void): Promise<{
        success: boolean;
        cleanup?: () => void;
        error?: string;
    }>;
    /**
     * 完成编辑
     * 获取编辑器的最新内容并返回更新后的卡片
     */
    finishEditing(sessionId: string, shouldSync?: boolean, options?: {
        isStudySession?: boolean;
        targetCardId?: string;
    }): Promise<{
        success: boolean;
        updatedCard?: Card;
        error?: string;
    }>;
    /**
     * 取消编辑
     * 清理会话和编辑器
     */
    cancelEditing(sessionId: string): Promise<void>;
    /**
     * 更新会话内容
     * 用于学习界面卡片切换时更新编辑器内容，支持编辑器复用
     */
    updateSessionContent(sessionId: string, content: string | undefined, container?: HTMLElement): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 更新会话的card对象
     * 用于钉住模式切换到新卡片时更新整个card对象
     */
    updateSessionCard(sessionId: string, newCard: Card): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 清理所有会话
     */
    cleanup(): void;
}
/**
 * 导出类型（兼容旧接口）
 */
export interface CardSyncResult {
    success: boolean;
    updatedCard?: Card;
    error?: string;
}
