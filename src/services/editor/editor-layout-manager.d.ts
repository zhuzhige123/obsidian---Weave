/**
 * 编辑器布局管理器
 *
 * 负责管理编辑器的布局、高度计算和滚动行为，确保：
 * 1. 编辑器高度自适应容器
 * 2. 垂直滚动正常工作
 * 3. 响应窗口大小变化
 * 4. CodeMirror布局正确
 */
export declare class EditorLayoutManager {
    private container;
    private editorElement;
    private resizeObserver;
    private resizeDebounceTimer;
    private readonly RESIZE_DEBOUNCE_DELAY;
    private readonly MIN_EDITOR_HEIGHT;
    private debug;
    private windowResizeHandler;
    constructor(container: HTMLElement, debug?: boolean);
    /**
     * 初始化布局管理器
     */
    initialize(editorElement: HTMLElement): void;
    /**
     * 更新布局
     */
    updateLayout(): void;
    /**
     * 计算可用高度
     */
    calculateAvailableHeight(): number;
    /**
     * 设置容器样式
     */
    private setupContainerStyles;
    /**
     * 设置滚动容器
     */
    setupScrollContainer(): void;
    /**
     * 启用垂直滚动
     */
    enableVerticalScroll(): void;
    /**
     * 更新CodeMirror布局
     */
    private updateCodeMirrorLayout;
    /**
     * 刷新CodeMirror
     */
    private refreshCodeMirror;
    /**
     * 处理窗口大小变化
     */
    private handleResize;
    /**
     * 监听容器大小变化
     */
    private observeContainerSize;
    /**
     * 获取容器的padding总和
     */
    private getContainerPadding;
    /**
     * 清理资源
     */
    cleanup(): void;
    /**
     * 调试日志
     */
    private log;
}
