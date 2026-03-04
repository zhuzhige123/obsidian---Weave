import { Component, MarkdownView, TFile, Platform, Scope } from 'obsidian';
import { logger } from '../../utils/logger';
import { WEAVE_DATA } from '../../config/paths';
import EditorContextManager from './EditorContextManager';
/**
 * DetachedLeafEditor
 * 使用真正的 WorkspaceLeaf 实现嵌入式编辑器，确保 100% 的 Obsidian 原生体验（Live Preview、插件支持等）
 */
export class DetachedLeafEditor extends Component {
    app;
    containerEl;
    options;
    leaf = null;
    tempFile = null;
    scope;
    editorView = null;
    readyPromise;
    readyResolve = null;
    destroyed = false;
    focusInHandler = null;
    focusOutHandler = null;
    pointerDownCaptureHandler = null;
    contentChromeObserver = null;
    viewScopePushed = false;
    prevActiveLeaf = null;
    keydownCaptureHandler = null;
    // 原始父节点，用于恢复 DOM（虽然通常我们销毁时直接删除）
    originalParent = null;
    originalNextSibling = null;
    constructor(app, container, options = {}) {
        super();
        this.app = app;
        this.containerEl = container;
        this.options = options;
        this.scope = new Scope(this.app.scope);
        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = resolve;
        });
    }
    whenReady() {
        return this.readyPromise;
    }
    getWorkspaceActiveLeaf() {
        try {
            const ws = this.app.workspace;
            if (typeof ws.getActiveLeaf === 'function') {
                return ws.getActiveLeaf() || null;
            }
            return ws.activeLeaf || null;
        }
        catch {
            return null;
        }
    }
    setWorkspaceActiveLeaf(leaf, focus) {
        if (!leaf)
            return;
        try {
            const ws = this.app.workspace;
            if (typeof ws.setActiveLeaf === 'function') {
                try {
                    const current = this.getWorkspaceActiveLeaf();
                    if (current === leaf)
                        return;
                }
                catch { }
                try {
                    ws.setActiveLeaf(leaf, { focus });
                }
                catch {
                    ws.setActiveLeaf(leaf, focus);
                }
            }
        }
        catch { }
    }
    pushViewScope() {
        if (this.viewScopePushed)
            return;
        const scope = this.editorView?.scope;
        const keymap = this.app?.keymap;
        if (!scope || !keymap)
            return;
        if (typeof keymap.pushScope !== 'function')
            return;
        try {
            keymap.pushScope(scope);
            this.viewScopePushed = true;
        }
        catch { }
    }
    popViewScope() {
        if (!this.viewScopePushed)
            return;
        const scope = this.editorView?.scope;
        const keymap = this.app?.keymap;
        if (!scope || !keymap) {
            this.viewScopePushed = false;
            return;
        }
        if (typeof keymap.popScope !== 'function') {
            this.viewScopePushed = false;
            return;
        }
        try {
            keymap.popScope(scope);
        }
        catch { }
        this.viewScopePushed = false;
    }
    async onload() {
        await this.initialize();
    }
    async waitForWorkspaceLayoutReady() {
        try {
            await new Promise((resolve) => {
                try {
                    this.app.workspace.onLayoutReady(() => resolve());
                }
                catch {
                    resolve();
                }
            });
        }
        catch {
        }
    }
    shouldHidePropertiesInDocument() {
        try {
            const getCfg = (key) => {
                try {
                    return this.app.vault.getConfig?.(key);
                }
                catch {
                    return undefined;
                }
            };
            const candidates = [
                getCfg('propertiesInDocument'),
                getCfg('propertiesInDocumentMode'),
                getCfg('propertiesInDocumentDisplay'),
                getCfg('showPropertiesInDocument'),
                getCfg('propertiesInDocumentEnabled'),
            ].filter((v) => v !== undefined);
            for (const v of candidates) {
                if (v === false)
                    return true;
                if (v === true)
                    return false;
                if (typeof v === 'number') {
                    if (v === 0)
                        return true;
                    continue;
                }
                if (typeof v === 'string') {
                    const s = v.toLowerCase();
                    if (s === 'hidden' || s === 'hide' || s === 'off' || s === 'never')
                        return true;
                    if (s === 'source')
                        return true;
                    if (s === 'show' || s === 'visible' || s === 'on' || s === 'always')
                        return false;
                }
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async initialize() {
        try {
            logger.debug('[DetachedLeafEditor] 开始初始化...');
            const activeLeafBeforeInit = this.getWorkspaceActiveLeaf();
            await this.waitForWorkspaceLayoutReady();
            // 1. 准备临时文件
            await this.prepareTempFile();
            if (!this.tempFile) {
                throw new Error('无法创建临时文件');
            }
            // 2. 创建 detached leaf
            this.createLeaf();
            if (!this.leaf) {
                throw new Error('无法创建 WorkspaceLeaf');
            }
            if (Platform.isMobile && activeLeafBeforeInit && this.leaf && activeLeafBeforeInit !== this.leaf) {
                try {
                    this.setWorkspaceActiveLeaf(activeLeafBeforeInit, false);
                }
                catch { }
            }
            // 3. 打开文件
            await this.openFileInLeaf();
            // 4. 劫持 DOM 并注入到容器
            await this.hijackDOM();
            // 5. 初始化设置（Live Preview, 快捷键等）
            this.setupEditor();
            if (Platform.isMobile && activeLeafBeforeInit && this.leaf && activeLeafBeforeInit !== this.leaf) {
                try {
                    this.setWorkspaceActiveLeaf(activeLeafBeforeInit, false);
                }
                catch { }
            }
            logger.debug('[DetachedLeafEditor] 初始化完成');
        }
        catch (error) {
            logger.error('[DetachedLeafEditor] 初始化失败:', error);
            // 显示错误信息
            this.containerEl.createDiv({ text: '编辑器初始化失败', cls: 'error-message' });
        }
        finally {
            if (this.readyResolve) {
                try {
                    this.readyResolve();
                }
                catch {
                }
                this.readyResolve = null;
            }
        }
    }
    async prepareTempFile() {
        const sessionId = this.options.sessionId || Date.now().toString();
        const filename = `weave-editor-${sessionId}.md`;
        let folderPath = '';
        // 1. 尝试使用 sourcePath 的目录，确保相对链接解析正确
        if (this.options.sourcePath) {
            // 处理可能包含文件名的路径
            if (this.options.sourcePath.endsWith('.md')) {
                folderPath = this.options.sourcePath.substring(0, this.options.sourcePath.lastIndexOf('/'));
            }
            else {
                // 假设它是目录（虽然通常 sourcePath 是文件路径）
                folderPath = this.options.sourcePath;
            }
            // 如果是根目录，folderPath 为空字符串
            if (folderPath === '/')
                folderPath = '';
        }
        // 2. 如果没有 sourcePath，尝试使用 weave 根目录
        if (!folderPath) {
            if (await this.app.vault.adapter.exists(WEAVE_DATA)) {
                folderPath = WEAVE_DATA;
            }
            else {
                // 最后的兜底：根目录
                folderPath = '';
            }
        }
        // 3. 确保目录存在
        if (folderPath) {
            try {
                const folderExists = await this.app.vault.adapter.exists(folderPath);
                if (!folderExists) {
                    await this.app.vault.createFolder(folderPath);
                }
            }
            catch (e) {
                logger.warn('[DetachedLeafEditor] 创建目录失败，回退到根目录:', e);
                folderPath = '';
            }
        }
        const filePath = folderPath ? `${folderPath}/${filename}` : filename;
        logger.debug('[DetachedLeafEditor] 临时文件路径:', filePath);
        // 4. 创建或获取文件
        let file = this.app.vault.getAbstractFileByPath(filePath);
        try {
            if (file instanceof TFile) {
                // 如果存在，更新内容
                await this.app.vault.modify(file, this.options.value || '');
                this.tempFile = file;
            }
            else {
                // 创建新文件
                this.tempFile = await this.app.vault.create(filePath, this.options.value || '');
            }
        }
        catch (e) {
            logger.error('[DetachedLeafEditor] 创建临时文件失败:', e);
            // 尝试使用唯一文件名重试（避免冲突）
            const fallbackPath = `weave-editor-${Date.now()}.md`;
            this.tempFile = await this.app.vault.create(fallbackPath, this.options.value || '');
        }
    }
    createLeaf() {
        // 使用 createLeafInParent 创建一个位于 rootSplit 的 leaf
        // 这允许我们创建一个"真正的"编辑器实例，但将其隐藏
        // @ts-ignore - 使用私有/高级 API
        const ws = this.app.workspace;
        const candidates = Platform.isMobile
            ? [ws.rightSplit, ws.leftSplit, ws.rootSplit]
            : [ws.rootSplit];
        const canUseSplit = (split) => {
            try {
                return !!split && typeof split.setDimension === 'function';
            }
            catch {
                return false;
            }
        };
        const parentSplit = candidates.find(canUseSplit) || ws.rootSplit;
        try {
            this.leaf = this.app.workspace.createLeafInParent(parentSplit, 0);
        }
        catch (e) {
            logger.warn('[DetachedLeafEditor] createLeafInParent 失败，回退到 rootSplit:', e);
            try {
                this.leaf = this.app.workspace.createLeafInParent(ws.rootSplit, 0);
            }
            catch {
                this.leaf = null;
            }
        }
        // 立即隐藏，防止闪烁
        const leafEl = this.leaf.containerEl;
        if (leafEl) {
            leafEl.dataset.weaveDetachedLeafEditor = 'true';
            this.originalParent = leafEl.parentElement;
            this.originalNextSibling = leafEl.nextSibling;
            // 关键：不要使用 display:none，否则 Obsidian 无法正确路由快捷键到 activeLeaf
            // 改为移动到屏幕外，但保持在 DOM 中（参考 ModalEditorManager 的方案）
            leafEl.style.position = 'absolute';
            leafEl.style.left = '-9999px';
            leafEl.style.top = '-9999px';
            leafEl.style.width = '1px';
            leafEl.style.height = '1px';
            leafEl.style.overflow = 'hidden';
            leafEl.style.pointerEvents = 'none';
            leafEl.style.display = 'block';
            leafEl.style.visibility = 'visible';
        }
    }
    async openFileInLeaf() {
        if (!this.leaf || !this.tempFile)
            return;
        // active: false 防止获得焦点并滚动 workspace
        await this.leaf.openFile(this.tempFile, { active: false });
        // 获取 View 实例
        const view = this.leaf.view;
        if (view instanceof MarkdownView) {
            this.editorView = view;
        }
        else {
            logger.error('[DetachedLeafEditor] Leaf 打开的不是 MarkdownView');
        }
    }
    async hijackDOM() {
        if (!this.leaf || !this.editorView)
            return;
        // 等待编辑器渲染
        await this.waitForEditorReady();
        const view = this.editorView;
        const contentEl = view.contentEl; // 这是包含编辑器的主要元素
        contentEl.dataset.weaveDetachedLeafEditor = 'true';
        try {
            contentEl.querySelectorAll('.weave-ir-markdown-bottom-toolbar-container').forEach((el) => {
                try {
                    el.remove();
                }
                catch {
                }
            });
        }
        catch {
        }
        // 清空容器
        this.containerEl.empty();
        // 移动 DOM
        this.containerEl.appendChild(contentEl);
        // 调整样式以适应嵌入
        contentEl.style.display = 'block';
        contentEl.style.position = 'relative';
        contentEl.style.width = '100%';
        contentEl.style.height = '100%';
        contentEl.style.padding = '0';
        contentEl.style.margin = '0';
        const removeElNoSpace = (el) => {
            if (!el)
                return;
            try {
                el.remove();
            }
            catch {
                try {
                    el.style.display = 'none';
                    el.style.height = '0';
                    el.style.minHeight = '0';
                    el.style.maxHeight = '0';
                    el.style.margin = '0';
                    el.style.padding = '0';
                    el.style.border = '0';
                }
                catch { }
            }
        };
        const toggleHideNoSpace = (el, hide) => {
            if (!el)
                return;
            try {
                if (hide) {
                    el.style.display = 'none';
                    el.style.height = '0';
                    el.style.minHeight = '0';
                    el.style.maxHeight = '0';
                    el.style.margin = '0';
                    el.style.padding = '0';
                    el.style.border = '0';
                }
                else {
                    el.style.display = '';
                    el.style.height = '';
                    el.style.minHeight = '';
                    el.style.maxHeight = '';
                    el.style.margin = '';
                    el.style.padding = '';
                    el.style.border = '';
                }
            }
            catch { }
        };
        const applyHideChrome = () => {
            try {
                const headerSelectors = [
                    '.view-header',
                    '.view-header-title-container',
                    '.view-header-title-wrapper',
                    '.view-header-nav-buttons',
                    '.view-actions',
                    '.view-action',
                ];
                for (const selector of headerSelectors) {
                    const nodes = contentEl.querySelectorAll(selector);
                    nodes.forEach((n) => removeElNoSpace(n));
                }
                const inlineTitleSelectors = [
                    '.inline-title-wrapper',
                    '.inline-title',
                ];
                for (const selector of inlineTitleSelectors) {
                    const nodes = contentEl.querySelectorAll(selector);
                    nodes.forEach((n) => removeElNoSpace(n));
                }
                const hideProps = this.shouldHidePropertiesInDocument();
                const propsSelectors = [
                    '.metadata-container',
                    '.metadata-properties',
                    '.metadata-container-inner',
                    '.metadata-properties-heading',
                    '.metadata-add-property',
                    '.markdown-source-view .metadata-container',
                    '.markdown-source-view .metadata-properties',
                ];
                for (const selector of propsSelectors) {
                    const nodes = contentEl.querySelectorAll(selector);
                    nodes.forEach((n) => toggleHideNoSpace(n, hideProps));
                }
            }
            catch { }
        };
        applyHideChrome();
        try {
            if (this.contentChromeObserver) {
                this.contentChromeObserver.disconnect();
            }
            this.contentChromeObserver = new MutationObserver(() => {
                applyHideChrome();
            });
            this.contentChromeObserver.observe(contentEl, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }
        catch { }
        // 隐藏 header 等不需要的元素（如果有）
        // 通常 MarkdownView 的 contentEl 只包含编辑器内容，header 在 view.containerEl 中
        // 但我们需要确保 view.containerEl 的其他部分不干扰
        // 强制刷新布局
        if (view.editor) {
            view.editor.refresh();
        }
    }
    async waitForEditorReady(timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (this.editorView?.editor) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        logger.warn('[DetachedLeafEditor] 等待编辑器就绪超时');
    }
    setupEditor() {
        if (!this.editorView)
            return;
        // 1. 强制 Live Preview (如果是首选)
        // 检查全局设置
        const globalLivePreview = this.app.vault.getConfig?.('livePreview');
        if (globalLivePreview) {
            const currentMode = this.editorView.getMode(); // 'source' or 'preview'
            // MarkdownView 中，Source Mode 和 Live Preview 都是 'source' 模式
            // 区别在于 editor.cm.state.field(editorLivePreviewField) ???
            // 或者 view.currentMode.type
            // 强制切换到 Live Preview
            // @ts-ignore
            const state = this.editorView.currentMode;
            if (state && state.type === 'source') {
                // @ts-ignore
                if (state.sourceMode === true) {
                    // @ts-ignore
                    state.toggleSource();
                }
            }
        }
        // 2. 注册事件
        this.registerDomEvents();
        // 3. 注册快捷键
        this.registerHotkeys();
    }
    activateLeafForHotkeys() {
        if (!this.leaf)
            return;
        // 允许移动端激活 Leaf，以便显示原生工具栏
        // if (Platform.isMobile) {
        //   return;
        // }
        this.setWorkspaceActiveLeaf(this.leaf, false);
    }
    isEventFromPropertiesUI(target) {
        try {
            if (!target)
                return false;
            let el = null;
            if (target instanceof HTMLElement) {
                el = target;
            }
            else {
                const maybeNode = target;
                const parentEl = maybeNode?.parentElement;
                if (parentEl instanceof HTMLElement) {
                    el = parentEl;
                }
            }
            if (!el)
                return false;
            const hit = el.closest('.metadata-container, .metadata-properties, .metadata-container-inner, .metadata-properties-heading, .metadata-add-property');
            return !!hit;
        }
        catch {
            return false;
        }
    }
    registerDomEvents() {
        // 监听内容变化
        // 使用 Obsidian 事件或 CodeMirror 事件
        if (this.options.onChange && this.editorView) {
            // @ts-ignore
            this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
                if (info === this.editorView) {
                    this.options.onChange?.(this);
                }
            }));
        }
        // 焦点事件
        if (this.editorView?.contentEl) {
            if (!this.pointerDownCaptureHandler) {
                this.pointerDownCaptureHandler = (ev) => {
                    if (!Platform.isMobile)
                        return;
                    try {
                        EditorContextManager.getInstance().registerActive(this);
                    }
                    catch { }
                    this.pushViewScope();
                    // 📱 关键修复：移动端点击时激活 Leaf，触发原生工具栏
                    if (!this.prevActiveLeaf) {
                        this.prevActiveLeaf = this.getWorkspaceActiveLeaf();
                    }
                    this.activateLeafForHotkeys();
                    const fromProps = this.isEventFromPropertiesUI(ev?.target ?? null);
                    if (!fromProps) {
                        try {
                            this.editorView?.editor?.focus();
                        }
                        catch { }
                        requestAnimationFrame(() => {
                            try {
                                this.editorView?.editor?.focus();
                            }
                            catch { }
                        });
                    }
                };
            }
            this.editorView.contentEl.addEventListener('pointerdown', this.pointerDownCaptureHandler, true);
            this.editorView.contentEl.addEventListener('touchstart', this.pointerDownCaptureHandler, true);
            if (!this.keydownCaptureHandler) {
                this.keydownCaptureHandler = (ev) => {
                    if (!(ev.ctrlKey || ev.metaKey || ev.altKey || ev.key === 'Tab'))
                        return;
                    this.activateLeafForHotkeys();
                };
            }
            this.editorView.contentEl.addEventListener('keydown', this.keydownCaptureHandler, true);
            // ✅ 关键修复：移动端也需要监听焦点事件，确保 Active Leaf 正确切换以显示工具栏
            // 原先仅在桌面端启用，导致移动端焦点切换时工具栏不显示
            // if (!Platform.isMobile) {
            if (!this.focusInHandler) {
                this.focusInHandler = (ev) => {
                    try {
                        EditorContextManager.getInstance().registerActive(this);
                    }
                    catch { }
                    this.pushViewScope();
                    if (!this.prevActiveLeaf) {
                        this.prevActiveLeaf = this.getWorkspaceActiveLeaf();
                    }
                    this.activateLeafForHotkeys();
                    requestAnimationFrame(() => {
                        this.activateLeafForHotkeys();
                    });
                    const fromProps = this.isEventFromPropertiesUI(ev?.target ?? null);
                    if (!fromProps) {
                        try {
                            this.editorView?.editor?.focus();
                        }
                        catch { }
                    }
                };
            }
            if (!this.focusOutHandler) {
                this.focusOutHandler = (ev) => {
                    try {
                        const next = ev.relatedTarget;
                        if (next && this.editorView?.contentEl?.contains(next)) {
                            return;
                        }
                    }
                    catch { }
                    try {
                        EditorContextManager.getInstance().unregisterActive(this);
                    }
                    catch { }
                    this.popViewScope();
                    if (this.prevActiveLeaf && this.leaf && this.prevActiveLeaf !== this.leaf) {
                        this.setWorkspaceActiveLeaf(this.prevActiveLeaf, false);
                    }
                    this.prevActiveLeaf = null;
                    this.options.onBlur?.(this);
                };
            }
            this.editorView.contentEl.addEventListener('focusin', this.focusInHandler, true);
            this.editorView.contentEl.addEventListener('focusout', this.focusOutHandler, true);
            // }
        }
    }
    registerHotkeys() {
        this.scope.register(['Mod'], 'Enter', () => {
            this.options.onSubmit?.(this);
            return false;
        });
        this.scope.register([], 'Escape', () => {
            this.options.onEscape?.(this);
            return false;
        });
        // 必须推入 scope 才能生效吗？
        // Component 会自动管理吗？
        // 我们手动管理 scope
        // 这里可能有问题，因为 editor 本身也有 scope
    }
    // --- Public API ---
    get value() {
        return this.editorView?.editor?.getValue() || '';
    }
    setValue(content) {
        this.editorView?.editor?.setValue(content);
    }
    focus() {
        this.editorView?.editor?.focus();
    }
    getEditor() {
        return this.editorView?.editor;
    }
    // 兼容旧 API
    getCM() {
        // @ts-ignore
        return this.editorView?.editor?.cm;
    }
    onunload() {
        this.destroy();
    }
    destroy() {
        logger.debug('[DetachedLeafEditor] 销毁...');
        this.destroyed = true;
        if (this.readyResolve) {
            try {
                this.readyResolve();
            }
            catch {
            }
            this.readyResolve = null;
        }
        try {
            EditorContextManager.getInstance().unregisterActive(this);
        }
        catch { }
        this.popViewScope();
        if (this.prevActiveLeaf && this.leaf && this.prevActiveLeaf !== this.leaf) {
            this.setWorkspaceActiveLeaf(this.prevActiveLeaf, false);
        }
        this.prevActiveLeaf = null;
        try {
            if (this.contentChromeObserver) {
                this.contentChromeObserver.disconnect();
            }
            if (this.editorView?.contentEl && this.pointerDownCaptureHandler) {
                this.editorView.contentEl.removeEventListener('pointerdown', this.pointerDownCaptureHandler, true);
                this.editorView.contentEl.removeEventListener('touchstart', this.pointerDownCaptureHandler, true);
            }
            if (this.editorView?.contentEl && this.focusInHandler) {
                this.editorView.contentEl.removeEventListener('focusin', this.focusInHandler, true);
            }
            if (this.editorView?.contentEl && this.focusOutHandler) {
                this.editorView.contentEl.removeEventListener('focusout', this.focusOutHandler, true);
            }
            if (this.editorView?.contentEl && this.keydownCaptureHandler) {
                this.editorView.contentEl.removeEventListener('keydown', this.keydownCaptureHandler, true);
            }
        }
        catch { }
        this.contentChromeObserver = null;
        this.pointerDownCaptureHandler = null;
        this.keydownCaptureHandler = null;
        // 1. 恢复 DOM (可选，防止内存泄漏)
        // 如果我们只是 detach leaf，Obsidian 会清理
        // 2. 关闭/Detach Leaf
        if (this.leaf) {
            this.leaf.detach();
            this.leaf = null;
        }
        // 3. 清理临时文件 (可选，或者保留用于恢复)
        const tempFileToDelete = this.tempFile;
        this.tempFile = null;
        if (tempFileToDelete instanceof TFile) {
            const name = tempFileToDelete.name || '';
            const isPluginTemp = name.startsWith('weave-editor-') && name.endsWith('.md');
            if (isPluginTemp) {
                try {
                    this.app.vault.delete(tempFileToDelete).catch(err => {
                        logger.warn('[DetachedLeafEditor] 删除临时文件失败:', err);
                    });
                }
                catch (err) {
                    logger.warn('[DetachedLeafEditor] 删除临时文件异常:', err);
                }
            }
        }
        this.containerEl.empty();
    }
}
