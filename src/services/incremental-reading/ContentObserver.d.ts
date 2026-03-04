/**
 * 内容变化观察器
 *
 * 监听编辑器内容变化，触发遮罩位置更新
 *
 * 监听以下事件：
 * - 图片加载完成
 * - 折叠块展开/收起
 * - 内容编辑
 * - 滚动事件
 * - 视口大小变化
 *
 * @module services/incremental-reading/ContentObserver
 * @version 1.0.0
 */
import { MarkdownView } from 'obsidian';
/**
 * 内容变化观察器接口
 */
export interface ContentObserver {
    /**
     * 开始观察
     */
    start(): void;
    /**
     * 停止观察
     */
    stop(): void;
    /**
     * 注册位置更新回调
     */
    onPositionUpdate(callback: () => void): void;
    /**
     * 移除位置更新回调
     */
    offPositionUpdate(callback: () => void): void;
    /**
     * 手动触发更新
     */
    triggerUpdate(): void;
    /**
     * 销毁观察器
     */
    destroy(): void;
}
/**
 * ContentObserver 实现
 *
 * 使用 MutationObserver、ResizeObserver 和事件监听器
 * 监听各种内容变化，并使用 requestAnimationFrame 批量更新
 */
export declare class ContentObserverImpl implements ContentObserver {
    private view;
    private callbacks;
    private mutationObserver;
    private resizeObserver;
    private scrollHandler;
    private imageLoadHandlers;
    private rafId;
    private isRunning;
    private lastUpdateTime;
    private minUpdateInterval;
    constructor(view: MarkdownView);
    /**
     * 开始观察
     */
    start(): void;
    /**
     * 停止观察
     */
    stop(): void;
    /**
     * 注册位置更新回调
     */
    onPositionUpdate(callback: () => void): void;
    /**
     * 移除位置更新回调
     */
    offPositionUpdate(callback: () => void): void;
    /**
     * 手动触发更新
     */
    triggerUpdate(): void;
    /**
     * 销毁观察器
     */
    destroy(): void;
    /**
     * 设置 MutationObserver
     */
    private setupMutationObserver;
    /**
     * 设置图片加载监听
     */
    private setupImageLoadListeners;
    /**
     * 添加单个图片的加载监听
     */
    private addImageLoadListener;
    /**
     * 清理图片加载监听
     */
    private cleanupImageLoadListeners;
    /**
     * 设置滚动监听
     */
    private setupScrollListener;
    /**
     * 设置 ResizeObserver
     */
    private setupResizeObserver;
    /**
     * 调度更新（使用 RAF 批量处理）
     */
    private scheduleUpdate;
    /**
     * 执行更新
     */
    private executeUpdate;
}
/**
 * 创建 ContentObserver 实例
 */
export declare function createContentObserver(view: MarkdownView): ContentObserver;
