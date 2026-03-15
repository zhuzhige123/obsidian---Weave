/**
 * 编辑器生命周期管理器
 *  解决编辑器创建不稳定问题
 * - 使用状态机管理生命周期
 * - 支持取消操作
 * - 可靠的就绪检测（超时3000ms）
 * - 正确的异步流程控制
 */
import type { TFile } from 'obsidian';
import type { WeavePlugin } from '../../main';
import type { EditorResult } from '../../types/editor-types';
type EditorState = 'idle' | 'creating' | 'ready' | 'updating' | 'error';
export declare class EditorLifecycleManager {
    private state;
    private currentOperation;
    private plugin;
    private leaf;
    private editorElement;
    constructor(plugin: WeavePlugin);
    /**
     *  创建编辑器（带状态机和取消机制）
     */
    createEditor(container: HTMLElement, file: TFile, signal?: AbortSignal): Promise<EditorResult>;
    /**
     *  可靠的 CodeMirror 初始化检测
     */
    private waitForCodeMirrorInit;
    /**
     * 创建 Leaf
     */
    private createLeaf;
    /**
     * 提取编辑器 DOM
     */
    private extractEditorDOM;
    /**
     * 附加到容器
     */
    private attachToContainer;
    /**
     * 隐藏 Leaf
     */
    private hideLeaf;
    /**
     *  取消当前操作
     */
    cancel(): void;
    /**
     *  清理资源
     */
    dispose(): Promise<void>;
    /**
     * 获取当前状态
     */
    getState(): EditorState;
    /**
     * 组合多个 AbortSignal
     */
    private combineSignals;
    /**
     * 检查是否已取消
     */
    private checkAborted;
    private waitForLayoutReady;
}
export {};
