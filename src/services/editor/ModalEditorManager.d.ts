/**
 * 模态窗专用编辑器管理器
 *
 * 方案A实现：为CreateCardModal维护一个永久的隐藏MarkdownView
 * 避免临时文件创建和清理问题，提供稳定的编辑器环境
 *
 * 核心设计：
 * 1. 单例模式，全局唯一
 * 2. 维护一个永久的隐藏WorkspaceLeaf + MarkdownView
 * 3. 通过更新MarkdownView的内容来复用编辑器
 * 4. 仅在插件卸载时销毁
 */
import { App } from 'obsidian';
export declare class ModalEditorManager {
    private static instance;
    private app;
    private readonly INITIAL_POOL_SIZE;
    private hasCleanedRestoredLeaves;
    private pool;
    private isInitialized;
    private readonly STUDY_SESSION_CARD_ID;
    private currentEditingCardUuid;
    private hideLeafUiElements;
    private expandPoolToSize;
    private waitForEditorReady;
    private getReadableWeaveRootFromApp;
    private isTFileLike;
    private getTFileByPathWithRetry;
    private ensurePermanentFileAtPath;
    private sessions;
    private getWorkspaceActiveLeaf;
    private setWorkspaceActiveLeaf;
    private getSlot;
    private allocateSlotIndex;
    private restoreLeafContainerToHome;
    private restoreAllLeafContainersToHome;
    private ensureSlotLeaf;
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(app: App): ModalEditorManager;
    /**
     * 销毁单例（插件卸载时调用）
     */
    static destroy(): void;
    get studySessionCardId(): string;
    setCurrentEditingCard(cardId: string): void;
    static cleanupRestoredLeaves(app: App): void;
    /**
     * 初始化永久资源
     */
    private initialize;
    /**
     * 创建编辑会话（兼容EmbeddableEditorManager接口）
     */
    createEditorSession(card: any, options?: any): Promise<{
        success: boolean;
        sessionId?: string;
        filePath?: string;
        error?: string;
    }>;
    /**
     * 创建嵌入式编辑器（提取DOM到容器）
     */
    createEmbeddedEditor(container: HTMLElement, sessionId: string, onSave: (content: string) => void, onCancel: () => void, onChange?: (content: string) => void): Promise<{
        success: boolean;
        cleanup?: () => void;
        error?: string;
    }>;
    /**
     * 完成编辑
     */
    finishEditing(sessionId: string, shouldSync?: boolean, _options?: any): Promise<{
        success: boolean;
        updatedCard?: any;
        error?: string;
    }>;
    /**
     * 取消编辑
     */
    cancelEditing(sessionId: string): Promise<void>;
    /**
     * 更新会话内容
     */
    updateSessionContent(sessionId: string, content: string | undefined, container?: HTMLElement): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 更新会话的card对象（钉住模式用）
     */
    updateSessionCard(sessionId: string, newCard: any): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 设置编辑器样式
     */
    private setupEditorStyles;
    /**
     * 设置键盘快捷键
     */
    private setupKeyboardHandlersForSlot;
    /**
     * 设置内容变化监听
     */
    private setupContentChangeListenerForSlot;
    /**
     * 清理资源（不删除永久文件）
     */
    cleanup(): void;
    private destroyResources;
}
