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
import { MarkdownView, TFile, normalizePath } from 'obsidian';
import { logger } from '../../utils/logger';
import { getReadableWeaveRoot, normalizeWeaveParentFolder, PATHS, LEGACY_DOT_TUANKI } from '../../config/paths';
export class ModalEditorManager {
    static instance = null;
    app;
    INITIAL_POOL_SIZE = 5;
    hasCleanedRestoredLeaves = false;
    pool = [];
    isInitialized = false;
    STUDY_SESSION_CARD_ID = 'weave-study-session-editor';
    currentEditingCardUuid = '';
    hideLeafUiElements(rootEl) {
        const selectors = [
            '.view-header',
            '.view-header-title',
            '.view-header-breadcrumb',
            '.view-header-title-container',
            '.view-header-title-parent',
            '.view-header-icon',
            '.view-header-nav-buttons',
            '.inline-title',
            '.view-header-title-wrapper',
            '.metadata-container'
        ];
        for (const selector of selectors) {
            const els = rootEl.querySelectorAll(selector);
            els.forEach((el) => {
                const h = el;
                h.style.display = 'none';
                h.style.height = '0';
                h.style.minHeight = '0';
                h.style.margin = '0';
                h.style.padding = '0';
            });
        }
    }
    async expandPoolToSize(targetSize) {
        if (targetSize <= this.pool.length)
            return;
        const weaveRoot = this.getReadableWeaveRootFromApp();
        const rootDirPath = normalizePath(weaveRoot);
        const dirPath = normalizePath(`${weaveRoot}/temp`);
        const newSlots = [];
        for (let i = this.pool.length; i < targetSize; i++) {
            const fileName = i === 0
                ? 'modal-editor-permanent.md'
                : `modal-editor-permanent-${i + 1}.md`;
            const filePath = normalizePath(`${dirPath}/${fileName}`);
            const file = await this.ensurePermanentFileAtPath(rootDirPath, dirPath, filePath);
            if (!file) {
                throw new Error('无法获取永久编辑器文件（TFile）');
            }
            newSlots.push({
                index: i,
                file,
                leaf: null,
                leafHomeParent: null,
                leafHomeNextSibling: null,
                contentHomeParent: null,
                contentHomeNextSibling: null,
                contentChangeEventRef: null,
                activeChangeListenerFilePath: null,
                isProgrammaticContentUpdate: false,
                currentCallbacks: {},
                inUseSessionId: null,
                lastUsedTs: 0,
            });
        }
        this.pool.push(...newSlots);
    }
    async waitForEditorReady(view, maxWaitMs = 2000, intervalMs = 50) {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            const editor = view?.editor;
            const contentEl = view?.contentEl;
            if (editor && contentEl) {
                const cm = contentEl.querySelector('.cm-editor');
                if (cm)
                    return;
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
    }
    getReadableWeaveRootFromApp() {
        try {
            const plugin = this.app?.plugins?.getPlugin?.('weave');
            const parentFolder = normalizeWeaveParentFolder(plugin?.settings?.weaveParentFolder);
            return getReadableWeaveRoot(parentFolder);
        }
        catch {
            return getReadableWeaveRoot(undefined);
        }
    }
    isTFileLike(file) {
        const f = file;
        return !!f && typeof f.path === 'string' && typeof f.extension === 'string';
    }
    async getTFileByPathWithRetry(filePath, retries = 20, delayMs = 50) {
        for (let i = 0; i < retries; i++) {
            const af = this.app.vault.getAbstractFileByPath(filePath);
            if (this.isTFileLike(af))
                return af;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        const af = this.app.vault.getAbstractFileByPath(filePath);
        return this.isTFileLike(af) ? af : null;
    }
    async ensurePermanentFileAtPath(rootDirPath, dirPath, filePath) {
        try {
            const rootDirExists = await this.app.vault.adapter.exists(rootDirPath);
            if (!rootDirExists) {
                await this.app.vault.createFolder(rootDirPath);
            }
            const dirExists = await this.app.vault.adapter.exists(dirPath);
            if (!dirExists) {
                await this.app.vault.createFolder(dirPath);
            }
        }
        catch (error) {
            logger.warn('[ModalEditorManager] 创建目录失败（忽略）:', error);
        }
        try {
            const fileExistsOnDisk = await this.app.vault.adapter.exists(filePath);
            if (!fileExistsOnDisk) {
                const created = await this.app.vault.create(filePath, '');
                return this.isTFileLike(created) ? created : null;
            }
        }
        catch {
        }
        const existing = await this.getTFileByPathWithRetry(filePath);
        if (existing)
            return existing;
        try {
            await this.app.vault.adapter.remove(filePath);
        }
        catch {
        }
        try {
            const recreated = await this.app.vault.create(filePath, '');
            if (this.isTFileLike(recreated))
                return recreated;
        }
        catch {
        }
        return await this.getTFileByPathWithRetry(filePath);
    }
    // 会话数据（保证 finishEditing 能返回完整 card，包括 uuid）
    sessions = new Map();
    getWorkspaceActiveLeaf() {
        const ws = this.app.workspace;
        if (typeof ws.getActiveLeaf === 'function') {
            return ws.getActiveLeaf() || null;
        }
        return ws.activeLeaf || null;
    }
    setWorkspaceActiveLeaf(leaf, focus) {
        if (!leaf)
            return;
        const ws = this.app.workspace;
        if (typeof ws.setActiveLeaf === 'function') {
            ws.setActiveLeaf(leaf, { focus });
        }
    }
    getSlot(index) {
        const slot = this.pool[index];
        if (!slot) {
            throw new Error(`编辑器槽位不存在: ${index}`);
        }
        return slot;
    }
    allocateSlotIndex(sessionId) {
        for (const slot of this.pool) {
            if (slot.inUseSessionId === sessionId)
                return slot.index;
        }
        const free = this.pool.find(s => !s.inUseSessionId);
        if (free)
            return free.index;
        // 池满时：回收已经丢失的会话占用（防止某些组件异常退出导致永远占用）
        for (const slot of this.pool) {
            if (slot.inUseSessionId && !this.sessions.has(slot.inUseSessionId)) {
                slot.inUseSessionId = null;
            }
        }
        const freeAfterReclaim = this.pool.find(s => !s.inUseSessionId);
        if (freeAfterReclaim)
            return freeAfterReclaim.index;
        return -1;
    }
    restoreLeafContainerToHome(slot) {
        if (!slot.leaf)
            return;
        if (!slot.leafHomeParent)
            return;
        const leafEl = slot.leaf.containerEl;
        if (!leafEl)
            return;
        if (leafEl.parentElement === slot.leafHomeParent)
            return;
        try {
            if (slot.leafHomeNextSibling && slot.leafHomeNextSibling.parentNode === slot.leafHomeParent) {
                slot.leafHomeParent.insertBefore(leafEl, slot.leafHomeNextSibling);
            }
            else {
                slot.leafHomeParent.appendChild(leafEl);
            }
        }
        catch { }
    }
    restoreAllLeafContainersToHome() {
        for (const slot of this.pool) {
            try {
                this.restoreLeafContainerToHome(slot);
            }
            catch { }
        }
    }
    async ensureSlotLeaf(slotIndex) {
        const slot = this.getSlot(slotIndex);
        if (slot.leaf)
            return;
        await new Promise((resolve) => {
            this.app.workspace.onLayoutReady(() => resolve());
        });
        this.restoreAllLeafContainersToHome();
        slot.leaf = this.app.workspace.createLeafInParent(this.app.workspace.rootSplit, 0);
        const leafEl = slot.leaf.containerEl;
        if (leafEl) {
            slot.leafHomeParent = leafEl.parentElement;
            slot.leafHomeNextSibling = leafEl.nextSibling;
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
        await slot.leaf.openFile(slot.file, { active: false });
        try {
            const view = slot.leaf.view;
            await this.waitForEditorReady(view, 5000, 100); // 等待 5 秒，间隔 100 毫秒
            const contentEl = view.contentEl;
            if (contentEl && !slot.contentHomeParent) {
                slot.contentHomeParent = contentEl.parentElement;
                slot.contentHomeNextSibling = contentEl.nextSibling;
            }
            this.hideLeafUiElements(slot.leaf.containerEl);
            const tabEl = slot.leaf.tabHeaderEl;
            if (tabEl) {
                tabEl.style.display = 'none';
            }
            const titleEl = slot.leaf.titleEl;
            if (titleEl) {
                titleEl.style.display = 'none';
            }
        }
        catch { }
    }
    constructor(app) {
        this.app = app;
    }
    /**
     * 获取单例实例
     */
    static getInstance(app) {
        if (!this.instance) {
            this.instance = new ModalEditorManager(app);
        }
        return this.instance;
    }
    /**
     * 销毁单例（插件卸载时调用）
     */
    static destroy() {
        if (this.instance) {
            this.instance.destroyResources();
            this.instance = null;
        }
    }
    get studySessionCardId() {
        return this.STUDY_SESSION_CARD_ID;
    }
    setCurrentEditingCard(cardId) {
        this.currentEditingCardUuid = cardId;
    }
    static cleanupRestoredLeaves(app) {
        try {
            const legacyFilePaths = new Set([
                `${LEGACY_DOT_TUANKI}/temp/modal-editor-permanent.md`,
                `${PATHS.temp}/modal-editor-permanent.md`
            ]);
            const leaves = app.workspace.getLeavesOfType('markdown');
            for (const leaf of leaves) {
                try {
                    const view = leaf.view;
                    const file = view?.file;
                    const p = file?.path;
                    if (!p)
                        continue;
                    if (legacyFilePaths.has(p)) {
                        leaf.detach();
                        continue;
                    }
                    // 兼容任意父目录：只要是 weave/temp/modal-editor-permanent.md 就清理
                    if (p.endsWith('/temp/modal-editor-permanent.md') && p.includes('/weave/')) {
                        leaf.detach();
                        continue;
                    }
                    if (p.includes('/weave/') && p.includes('/temp/') && /\/temp\/modal-editor-permanent-\d+\.md$/.test(p)) {
                        leaf.detach();
                    }
                }
                catch { }
            }
        }
        catch { }
    }
    /**
     * 初始化永久资源
     */
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            logger.debug('[ModalEditorManager] 初始化永久资源...');
            if (!this.hasCleanedRestoredLeaves) {
                this.hasCleanedRestoredLeaves = true;
                ModalEditorManager.cleanupRestoredLeaves(this.app);
            }
            const weaveRoot = this.getReadableWeaveRootFromApp();
            const rootDirPath = normalizePath(weaveRoot);
            const dirPath = normalizePath(`${weaveRoot}/temp`);
            this.pool = [];
            await this.expandPoolToSize(this.INITIAL_POOL_SIZE);
            this.isInitialized = true;
            logger.debug('[ModalEditorManager] ✅ 永久资源初始化完成');
        }
        catch (error) {
            logger.error('[ModalEditorManager] 初始化失败:', error);
            throw error;
        }
    }
    /**
     * 创建编辑会话（兼容EmbeddableEditorManager接口）
     */
    async createEditorSession(card, options) {
        try {
            // 确保初始化
            await this.initialize();
            // 生成会话ID
            const sessionId = options?.isStudySession
                ? (options?.sessionId || this.STUDY_SESSION_CARD_ID)
                : (options?.sessionId || card?.uuid || `modal-${Date.now()}`);
            const existing = this.sessions.get(sessionId);
            if (existing) {
                return {
                    success: true,
                    sessionId,
                    filePath: existing.backingFile.path
                };
            }
            let slotIndex = this.allocateSlotIndex(sessionId);
            if (slotIndex < 0) {
                await this.expandPoolToSize(this.pool.length + 1);
                slotIndex = this.allocateSlotIndex(sessionId);
            }
            if (slotIndex < 0) {
                throw new Error('编辑器临时文件池已满');
            }
            const slot = this.getSlot(slotIndex);
            slot.inUseSessionId = sessionId;
            slot.lastUsedTs = Date.now();
            const backingFilePath = options?.backingFilePath;
            let backingFile;
            let usePermanentBuffer = true;
            if (backingFilePath) {
                const af = this.app.vault.getAbstractFileByPath(backingFilePath);
                if (!(af instanceof TFile)) {
                    throw new Error(`无法获取源文件（TFile）: ${backingFilePath}`);
                }
                backingFile = af;
                usePermanentBuffer = false;
            }
            else {
                backingFile = slot.file;
                usePermanentBuffer = true;
            }
            // 保存会话卡片信息（用于 finishEditing 返回完整 updatedCard）
            this.sessions.set(sessionId, {
                card: { ...card },
                backingFile,
                usePermanentBuffer,
                slotIndex,
            });
            // JSON/缓冲模式：更新缓冲文件内容
            if (usePermanentBuffer) {
                await this.app.vault.modify(backingFile, card.content || '');
            }
            logger.debug('[ModalEditorManager] 创建编辑会话:', sessionId);
            return {
                success: true,
                sessionId,
                filePath: backingFile.path
            };
        }
        catch (error) {
            logger.error('[ModalEditorManager] 创建会话失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '创建会话失败'
            };
        }
    }
    /**
     * 创建嵌入式编辑器（提取DOM到容器）
     */
    async createEmbeddedEditor(container, sessionId, onSave, onCancel, onChange) {
        try {
            // 确保初始化
            await this.initialize();
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error(`会话不存在: ${sessionId}`);
            }
            const slot = this.getSlot(session.slotIndex);
            await this.ensureSlotLeaf(session.slotIndex);
            if (!slot.leaf) {
                throw new Error('永久Leaf未初始化');
            }
            logger.debug('[ModalEditorManager] 创建嵌入式编辑器:', sessionId);
            // 保存回调
            slot.currentCallbacks = { onSave, onCancel, onChange };
            const leafContainerEl = slot.leaf.containerEl;
            if (!leafContainerEl) {
                throw new Error('无法获取Leaf容器');
            }
            if (!slot.leafHomeParent) {
                slot.leafHomeParent = leafContainerEl.parentElement;
                slot.leafHomeNextSibling = leafContainerEl.nextSibling;
            }
            const prevActiveLeaf = this.getWorkspaceActiveLeaf();
            // 获取MarkdownView
            const view = slot.leaf.view;
            const contentEl = view.contentEl;
            if (!contentEl) {
                throw new Error('无法获取编辑器内容容器');
            }
            if (!slot.contentHomeParent) {
                slot.contentHomeParent = contentEl.parentElement;
                slot.contentHomeNextSibling = contentEl.nextSibling;
            }
            // 打开会话对应文件（IR: 源文件；JSON: 缓冲文件）
            try {
                await slot.leaf.openFile(session.backingFile, { active: false });
            }
            catch (error) {
                logger.warn('[ModalEditorManager] openFile失败（忽略，继续）:', error);
            }
            await this.waitForEditorReady(view);
            // IR 源文件模式：用当前会话内容覆盖编辑器显示值（不直接写入文件）
            if (!session.usePermanentBuffer) {
                try {
                    if (view.editor) {
                        slot.isProgrammaticContentUpdate = true;
                        view.editor.setValue(session.card?.content || '');
                    }
                }
                finally {
                    slot.isProgrammaticContentUpdate = false;
                }
            }
            // /skip innerHTML = '' is used to clear container before moving Obsidian editor element
            container.innerHTML = '';
            container.appendChild(contentEl);
            contentEl.style.position = 'relative';
            contentEl.style.left = '0';
            contentEl.style.top = '0';
            contentEl.style.width = '100%';
            contentEl.style.height = '100%';
            contentEl.style.overflow = 'hidden';
            contentEl.style.pointerEvents = 'auto';
            contentEl.style.display = 'block';
            contentEl.style.visibility = 'visible';
            contentEl.style.zIndex = 'auto';
            await this.waitForEditorReady(view);
            // 设置样式
            this.setupEditorStyles(view.contentEl);
            // 设置键盘快捷键
            this.setupKeyboardHandlersForSlot(view.contentEl, session.slotIndex, view);
            // 设置内容变化监听
            if (onChange) {
                slot.activeChangeListenerFilePath = session.backingFile.path;
                this.setupContentChangeListenerForSlot(session.slotIndex, onChange);
            }
            const focusHandler = () => {
                if (slot.leaf) {
                    this.setWorkspaceActiveLeaf(slot.leaf, true);
                    try {
                        view.editor?.focus();
                    }
                    catch { }
                }
            };
            contentEl.addEventListener('focusin', focusHandler, true);
            this.setWorkspaceActiveLeaf(slot.leaf, true);
            try {
                view.editor?.focus();
            }
            catch { }
            logger.debug('[ModalEditorManager] ✅ 编辑器创建成功');
            return {
                success: true,
                cleanup: () => {
                    // 清理时将编辑器DOM移回隐藏Leaf
                    contentEl.removeEventListener('focusin', focusHandler, true);
                    if (slot.contentHomeParent) {
                        try {
                            if (slot.contentHomeNextSibling && slot.contentHomeNextSibling.parentNode === slot.contentHomeParent) {
                                slot.contentHomeParent.insertBefore(contentEl, slot.contentHomeNextSibling);
                            }
                            else {
                                slot.contentHomeParent.appendChild(contentEl);
                            }
                        }
                        catch { }
                    }
                    slot.currentCallbacks = {};
                    slot.activeChangeListenerFilePath = null;
                    if (slot.contentChangeEventRef) {
                        try {
                            this.app.workspace.offref(slot.contentChangeEventRef);
                        }
                        catch { }
                        slot.contentChangeEventRef = null;
                    }
                    if (prevActiveLeaf && slot.leaf && prevActiveLeaf !== slot.leaf) {
                        this.setWorkspaceActiveLeaf(prevActiveLeaf, false);
                    }
                    slot.inUseSessionId = null;
                    slot.lastUsedTs = Date.now();
                    // 对齐 EmbeddableEditorManager 行为：组件卸载时结束会话
                    this.sessions.delete(sessionId);
                }
            };
        }
        catch (error) {
            logger.error('[ModalEditorManager] 创建编辑器失败:', error);
            try {
                const session = this.sessions.get(sessionId);
                if (session) {
                    const slot = this.pool[session.slotIndex];
                    if (slot && slot.inUseSessionId === sessionId) {
                        slot.inUseSessionId = null;
                    }
                    this.sessions.delete(sessionId);
                }
            }
            catch { }
            return {
                success: false,
                error: error instanceof Error ? error.message : '创建编辑器失败'
            };
        }
    }
    /**
     * 完成编辑
     */
    async finishEditing(sessionId, shouldSync = false
    // 兼容 InlineCardEditor 传入的第三个参数（当前不使用）
    , _options) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error(`会话不存在: ${sessionId}`);
            }
            const slot = this.getSlot(session.slotIndex);
            if (!slot.leaf) {
                throw new Error('永久资源未初始化');
            }
            const view = slot.leaf.view;
            await this.waitForEditorReady(view);
            const content = view?.editor?.getValue?.() ?? session.card?.content ?? '';
            logger.debug('[ModalEditorManager] 完成编辑:', {
                sessionId,
                contentLength: content.length
            });
            if (session.usePermanentBuffer) {
                try {
                    slot.isProgrammaticContentUpdate = true;
                    try {
                        view?.editor?.setValue?.('');
                    }
                    catch { }
                    await this.app.vault.modify(session.backingFile, '');
                }
                finally {
                    slot.isProgrammaticContentUpdate = false;
                }
            }
            return {
                success: true,
                updatedCard: {
                    ...session.card,
                    content,
                }
            };
        }
        catch (error) {
            logger.error('[ModalEditorManager] 完成编辑失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '完成编辑失败'
            };
        }
    }
    /**
     * 取消编辑
     */
    async cancelEditing(sessionId) {
        logger.debug('[ModalEditorManager] 取消编辑:', sessionId);
        const session = this.sessions.get(sessionId);
        this.sessions.delete(sessionId);
        if (session) {
            try {
                const slot = this.pool[session.slotIndex];
                if (slot && slot.inUseSessionId === sessionId) {
                    slot.inUseSessionId = null;
                }
            }
            catch { }
        }
        // 仅缓冲模式清空内容，避免误清空 IR 源文件
        if (session?.usePermanentBuffer) {
            await this.app.vault.modify(session.backingFile, '');
        }
    }
    /**
     * 更新会话内容
     */
    async updateSessionContent(sessionId, content, container) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error(`会话不存在: ${sessionId}`);
            }
            const slot = this.getSlot(session.slotIndex);
            if (container) {
                await this.ensureSlotLeaf(session.slotIndex);
                if (!slot.leaf) {
                    throw new Error('永久Leaf未初始化');
                }
                const view = slot.leaf.view;
                const contentEl = view.contentEl;
                if (contentEl && contentEl.parentElement !== container) {
                    if (!slot.contentHomeParent) {
                        slot.contentHomeParent = contentEl.parentElement;
                        slot.contentHomeNextSibling = contentEl.nextSibling;
                    }
                    // /skip innerHTML = '' is used to clear container before moving Obsidian editor element
                    container.innerHTML = '';
                    container.appendChild(contentEl);
                    contentEl.style.position = 'relative';
                    contentEl.style.left = '0';
                    contentEl.style.top = '0';
                    contentEl.style.width = '100%';
                    contentEl.style.height = '100%';
                    contentEl.style.overflow = 'hidden';
                    contentEl.style.pointerEvents = 'auto';
                    contentEl.style.display = 'block';
                    contentEl.style.visibility = 'visible';
                    contentEl.style.zIndex = 'auto';
                }
            }
            session.card.content = content || '';
            // IR 源文件模式：只更新编辑器显示值，不直接写文件
            if (!session.usePermanentBuffer) {
                if (slot.leaf) {
                    const view = slot.leaf.view;
                    await this.waitForEditorReady(view);
                    if (view?.editor) {
                        try {
                            slot.isProgrammaticContentUpdate = true;
                            view.editor.setValue(content || '');
                        }
                        finally {
                            slot.isProgrammaticContentUpdate = false;
                        }
                    }
                }
                logger.debug('[ModalEditorManager] 内容已更新（IR源文件模式，未写入文件）');
                return { success: true };
            }
            try {
                slot.isProgrammaticContentUpdate = true;
                await this.app.vault.modify(session.backingFile, content || '');
            }
            finally {
                slot.isProgrammaticContentUpdate = false;
            }
            logger.debug('[ModalEditorManager] 内容已更新');
            return { success: true };
        }
        catch (error) {
            logger.error('[ModalEditorManager] 更新内容失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '更新内容失败'
            };
        }
    }
    /**
     * 更新会话的card对象（钉住模式用）
     */
    async updateSessionCard(sessionId, newCard) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error(`会话不存在: ${sessionId}`);
            }
            const slot = this.getSlot(session.slotIndex);
            this.sessions.set(sessionId, {
                card: { ...newCard },
                backingFile: slot.file,
                usePermanentBuffer: true,
                slotIndex: session.slotIndex,
            });
            await this.app.vault.modify(slot.file, newCard.content || '');
            logger.debug('[ModalEditorManager] 卡片对象已更新');
            return { success: true };
        }
        catch (error) {
            logger.error('[ModalEditorManager] 更新卡片失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '更新卡片失败'
            };
        }
    }
    /**
     * 设置编辑器样式
     */
    setupEditorStyles(editorEl) {
        editorEl.style.background = 'var(--background-primary)';
        editorEl.style.color = 'var(--text-normal)';
        editorEl.style.height = '100%';
        const cmEditor = editorEl.querySelector('.cm-editor');
        if (cmEditor) {
            cmEditor.style.height = '100%';
            cmEditor.style.fontSize = 'var(--font-text-size)';
            cmEditor.style.fontFamily = 'var(--font-text)';
        }
        const cmContent = editorEl.querySelector('.cm-content');
        if (cmContent) {
            cmContent.style.padding = '20px 24px';
            cmContent.style.minHeight = 'unset';
        }
    }
    /**
     * 设置键盘快捷键
     */
    setupKeyboardHandlersForSlot(editorEl, slotIndex, view) {
        const slot = this.getSlot(slotIndex);
        const handleKeydown = (e) => {
            // Ctrl+Enter 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                try {
                    const content = view?.editor?.getValue?.() ?? '';
                    slot.currentCallbacks.onSave?.(content);
                }
                catch { }
                return;
            }
            // Escape 取消
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                slot.currentCallbacks.onCancel?.();
                return;
            }
        };
        // 避免重复绑定导致一次按键触发多次
        try {
            const prev = slot.__weaveKeydownHandler;
            if (prev) {
                editorEl.removeEventListener('keydown', prev, true);
            }
        }
        catch { }
        slot.__weaveKeydownHandler = handleKeydown;
        editorEl.addEventListener('keydown', handleKeydown, true);
    }
    /**
     * 设置内容变化监听
     */
    setupContentChangeListenerForSlot(slotIndex, onChange) {
        const slot = this.getSlot(slotIndex);
        if (!onChange)
            return;
        if (!slot.activeChangeListenerFilePath)
            return;
        if (slot.contentChangeEventRef) {
            try {
                this.app.workspace.offref(slot.contentChangeEventRef);
            }
            catch { }
            slot.contentChangeEventRef = null;
        }
        const filePath = slot.activeChangeListenerFilePath;
        slot.contentChangeEventRef = this.app.workspace.on('editor-change', (editor, info) => {
            try {
                if (slot.isProgrammaticContentUpdate)
                    return;
                if (!(info instanceof MarkdownView))
                    return;
                const view = info;
                if (!view.file)
                    return;
                if (view.file.path !== filePath)
                    return;
                onChange(editor.getValue());
            }
            catch { }
        });
    }
    /**
     * 清理资源（不删除永久文件）
     */
    cleanup() {
        logger.debug('[ModalEditorManager] 清理资源...');
        for (const slot of this.pool) {
            if (slot.contentChangeEventRef) {
                try {
                    this.app.workspace.offref(slot.contentChangeEventRef);
                }
                catch { }
                slot.contentChangeEventRef = null;
            }
            if (slot.leaf) {
                try {
                    slot.leaf.detach();
                }
                catch { }
                slot.leaf = null;
            }
            slot.currentCallbacks = {};
            slot.leafHomeParent = null;
            slot.leafHomeNextSibling = null;
            slot.activeChangeListenerFilePath = null;
            slot.isProgrammaticContentUpdate = false;
            slot.inUseSessionId = null;
        }
        this.sessions.clear();
        this.currentEditingCardUuid = '';
        logger.debug('[ModalEditorManager] ✅ 资源清理完成');
    }
    destroyResources() {
        this.cleanup();
        for (const slot of this.pool) {
            try {
                this.app.fileManager.trashFile(slot.file).catch(err => {
                    logger.warn('[ModalEditorManager] 删除永久文件失败:', err);
                });
            }
            catch { }
        }
        this.pool = [];
        this.isInitialized = false;
    }
}
