import { logger } from '../../utils/logger';
/**
 * 编辑器布局管理器
 *
 * 负责管理编辑器的布局、高度计算和滚动行为，确保：
 * 1. 编辑器高度自适应容器
 * 2. 垂直滚动正常工作
 * 3. 响应窗口大小变化
 * 4. CodeMirror布局正确
 */
export class EditorLayoutManager {
    container;
    editorElement = null;
    resizeObserver = null;
    resizeDebounceTimer = null;
    RESIZE_DEBOUNCE_DELAY = 150; // ms
    MIN_EDITOR_HEIGHT = 300; // px
    debug = false;
    windowResizeHandler = null;
    constructor(container, debug = false) {
        this.container = container;
        this.debug = debug;
        this.windowResizeHandler = this.handleResize.bind(this);
        this.log('EditorLayoutManager initialized', {
            containerHeight: container.clientHeight
        });
    }
    /**
     * 初始化布局管理器
     */
    initialize(editorElement) {
        this.editorElement = editorElement;
        this.log('Initializing layout', {
            containerHeight: this.container.clientHeight,
            editorHeight: editorElement.clientHeight
        });
        // 设置容器基本样式
        this.setupContainerStyles();
        // 设置滚动容器
        this.setupScrollContainer();
        // 启用垂直滚动
        this.enableVerticalScroll();
        // 初始化布局
        this.updateLayout();
        // 监听容器大小变化
        this.observeContainerSize();
        this.log('Layout initialized');
    }
    /**
     * 更新布局
     */
    updateLayout() {
        if (!this.editorElement) {
            this.log('Warning: Cannot update layout - editor element not set');
            return;
        }
        const availableHeight = this.calculateAvailableHeight();
        this.log('Updating layout', { availableHeight });
        // 设置编辑器高度
        this.editorElement.style.height = `${availableHeight}px`;
        // 更新CodeMirror组件
        this.updateCodeMirrorLayout(availableHeight);
        // 刷新CodeMirror
        this.refreshCodeMirror();
    }
    /**
     * 计算可用高度
     */
    calculateAvailableHeight() {
        const containerHeight = this.container.clientHeight;
        const containerPadding = this.getContainerPadding();
        // 计算可用高度
        let availableHeight = containerHeight - containerPadding;
        // 确保不小于最小高度
        availableHeight = Math.max(availableHeight, this.MIN_EDITOR_HEIGHT);
        this.log('Calculated available height', {
            containerHeight,
            containerPadding,
            availableHeight
        });
        return availableHeight;
    }
    /**
     * 设置容器样式
     */
    setupContainerStyles() {
        if (!this.container)
            return;
        // 确保容器有明确的高度
        if (!this.container.style.height && this.container.clientHeight === 0) {
            this.container.style.height = '100%';
        }
        // 确保容器可以滚动
        const computedStyle = window.getComputedStyle(this.container);
        if (computedStyle.overflow === 'visible') {
            this.container.style.overflow = 'hidden';
        }
        this.log('Container styles set up');
    }
    /**
     * 设置滚动容器
     */
    setupScrollContainer() {
        if (!this.editorElement)
            return;
        // 确保编辑器容器可以滚动
        this.editorElement.style.overflow = 'auto';
        this.editorElement.style.position = 'relative';
        // 如果编辑器在包装器中，确保包装器设置正确
        const wrapper = this.editorElement.closest('.embedded-editor-wrapper');
        if (wrapper) {
            const wrapperEl = wrapper;
            wrapperEl.style.flex = '1';
            wrapperEl.style.overflow = 'hidden';
            wrapperEl.style.display = 'flex';
            wrapperEl.style.flexDirection = 'column';
            wrapperEl.style.minHeight = '0';
        }
        this.log('Scroll container set up');
    }
    /**
     * 启用垂直滚动
     */
    enableVerticalScroll() {
        if (!this.editorElement)
            return;
        // 查找CodeMirror的滚动容器
        const cmScroller = this.editorElement.querySelector('.cm-scroller');
        if (cmScroller) {
            // 强制启用垂直滚动
            cmScroller.style.overflowY = 'auto';
            cmScroller.style.overflowX = 'auto';
            cmScroller.style.height = '100%';
            this.log('Vertical scroll enabled on .cm-scroller');
        }
        else {
            this.log('Warning: .cm-scroller not found');
        }
        // 确保cm-editor也设置正确
        const cmEditor = this.editorElement.querySelector('.cm-editor');
        if (cmEditor) {
            cmEditor.style.height = '100%';
            cmEditor.style.minHeight = `${this.MIN_EDITOR_HEIGHT}px`;
        }
        // 确保cm-content高度自适应
        const cmContent = this.editorElement.querySelector('.cm-content');
        if (cmContent) {
            cmContent.style.minHeight = 'unset';
            cmContent.style.height = 'auto';
        }
    }
    /**
     * 更新CodeMirror布局
     */
    updateCodeMirrorLayout(height) {
        if (!this.editorElement)
            return;
        const cmEditor = this.editorElement.querySelector('.cm-editor');
        if (cmEditor) {
            const adjustedHeight = Math.max(height - 16, this.MIN_EDITOR_HEIGHT);
            cmEditor.style.height = `${adjustedHeight}px`;
            this.log('CodeMirror editor height updated', { height: adjustedHeight });
        }
        const cmScroller = this.editorElement.querySelector('.cm-scroller');
        if (cmScroller) {
            const adjustedHeight = Math.max(height - 16, this.MIN_EDITOR_HEIGHT);
            cmScroller.style.height = `${adjustedHeight}px`;
            this.log('CodeMirror scroller height updated', { height: adjustedHeight });
        }
    }
    /**
     * 刷新CodeMirror
     */
    refreshCodeMirror() {
        if (!this.editorElement)
            return;
        //  修复：不再触发全局 window resize 事件，避免触发自己的监听器导致无限循环
        // ResizeObserver 已经在监听容器变化，不需要通过全局事件触发更新
        // 触发 cm-viewport 的局部 resize 事件（通知 CodeMirror 组件）
        const cmViewport = this.editorElement.querySelector('.cm-viewport');
        if (cmViewport) {
            const viewportEvent = new Event('resize');
            cmViewport.dispatchEvent(viewportEvent);
        }
        this.log('CodeMirror refreshed');
    }
    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 清除之前的定时器
        if (this.resizeDebounceTimer !== null) {
            window.clearTimeout(this.resizeDebounceTimer);
        }
        // 使用防抖处理resize
        this.resizeDebounceTimer = window.setTimeout(() => {
            this.log('Resize detected, updating layout');
            this.updateLayout();
            this.resizeDebounceTimer = null;
        }, this.RESIZE_DEBOUNCE_DELAY);
    }
    /**
     * 监听容器大小变化
     */
    observeContainerSize() {
        if (!this.container)
            return;
        // 创建ResizeObserver
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { height } = entry.contentRect;
                this.log('Container size changed', { height });
                this.handleResize();
            }
        });
        // 监听容器
        this.resizeObserver.observe(this.container);
        // 同时监听window resize
        if (this.windowResizeHandler) {
            window.addEventListener('resize', this.windowResizeHandler);
        }
        this.log('Container size observer attached');
    }
    /**
     * 获取容器的padding总和
     */
    getContainerPadding() {
        if (!this.container)
            return 0;
        const computedStyle = window.getComputedStyle(this.container);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        return paddingTop + paddingBottom;
    }
    /**
     * 清理资源
     */
    cleanup() {
        this.log('Cleaning up layout manager');
        // 断开ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        // 清除防抖定时器
        if (this.resizeDebounceTimer !== null) {
            window.clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = null;
        }
        // 移除window事件监听器
        if (this.windowResizeHandler) {
            window.removeEventListener('resize', this.windowResizeHandler);
        }
        this.editorElement = null;
        this.log('Layout manager cleaned up');
    }
    /**
     * 调试日志
     */
    log(message, data) {
        if (this.debug) {
            logger.debug(`[EditorLayoutManager] ${message}`, data || '');
        }
    }
}
