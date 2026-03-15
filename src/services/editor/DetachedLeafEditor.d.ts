import { App, Component } from 'obsidian';
export interface DetachedEditorOptions {
    value?: string;
    placeholder?: string;
    sourcePath?: string;
    sessionId?: string;
    onSubmit?: (editor: DetachedLeafEditor) => void;
    onEscape?: (editor: DetachedLeafEditor) => void;
    onChange?: (editor: DetachedLeafEditor) => void;
    onBlur?: (editor: DetachedLeafEditor) => void;
}
/**
 * DetachedLeafEditor
 * 使用真正的 WorkspaceLeaf 实现嵌入式编辑器，确保 100% 的 Obsidian 原生体验（Live Preview、插件支持等）
 */
export declare class DetachedLeafEditor extends Component {
    private app;
    private containerEl;
    private options;
    private leaf;
    private tempFile;
    private scope;
    private editorView;
    private readyPromise;
    private readyResolve;
    private destroyed;
    private focusInHandler;
    private focusOutHandler;
    private pointerDownCaptureHandler;
    private contentChromeObserver;
    private viewScopePushed;
    private prevActiveLeaf;
    private keydownCaptureHandler;
    private originalParent;
    private originalNextSibling;
    constructor(app: App, container: HTMLElement, options?: DetachedEditorOptions);
    whenReady(): Promise<void>;
    private getWorkspaceActiveLeaf;
    private setWorkspaceActiveLeaf;
    private pushViewScope;
    private popViewScope;
    onload(): Promise<void>;
    private waitForWorkspaceLayoutReady;
    private shouldHidePropertiesInDocument;
    private initialize;
    private prepareTempFile;
    private createLeaf;
    private openFileInLeaf;
    private hijackDOM;
    private waitForEditorReady;
    private setupEditor;
    private activateLeafForHotkeys;
    private isEventFromPropertiesUI;
    private registerDomEvents;
    private registerHotkeys;
    get value(): string;
    setValue(content: string): void;
    focus(): void;
    getEditor(): import("obsidian").Editor | undefined;
    getCM(): any;
    onunload(): void;
    destroy(): void;
}
