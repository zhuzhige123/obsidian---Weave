/**
 * 增量阅读编辑器同步服务
 *
 * v5.0: 简化为块文件方案，移除旧 UUID 标记方案
 * - 方向 A：增量阅读编辑 → 块文件立即更新
 * - 方向 B：块文件编辑 → 增量阅读界面立即更新
 *
 * @deprecated findBlockBoundaryByUUID, extractContentByBoundary 已不再需要
 *
 * @module services/incremental-reading/IREditorSyncService
 * @version 5.0.0
 */
import { App } from 'obsidian';
import type { IRBlock } from '../../types/ir-types';
/**
 * 块边界定义
 * 统一的块边界计算，确保读写一致
 */
export interface BlockBoundary {
    /** 内容起始行（包含） */
    startLine: number;
    /** 内容结束行（不含UUID行） */
    endLine: number;
    /** UUID 标记所在行 */
    uuidLine: number;
}
/**
 * 根据 UUID 查找块边界
 *
 * 块边界规则：
 * - 开始：上一个 UUID 行之后 或 ir-start 之后 或文件开头
 * - 结束：当前 UUID 行之前（UUID行本身作为结束标记，不含在内容中）
 *
 * @param lines 文件内容按行分割
 * @param blockId 块UUID
 * @returns 块边界信息，未找到返回 null
 */
export declare function findBlockBoundaryByUUID(lines: string[], blockId: string): BlockBoundary | null;
/**
 * 根据块边界提取内容
 * @param lines 文件内容按行分割
 * @param boundary 块边界
 * @returns 块内容（不含UUID行）
 */
export declare function extractContentByBoundary(lines: string[], boundary: BlockBoundary): string;
/**
 * 同步回调类型
 */
export interface SyncCallbacks {
    /** 当原文档变化时，更新增量阅读界面 */
    onSourceChanged: (newContent: string) => void;
    /** 获取当前块信息 */
    getCurrentBlock: () => IRBlock | null;
    /** 获取当前块内容 */
    getBlockContent: () => string;
}
/**
 * 增量阅读编辑器同步服务
 */
export declare class IREditorSyncService {
    private app;
    private callbacks;
    private eventRef;
    private modifyEventRef;
    /** 防止循环更新的标记 */
    private isLocalChange;
    /** 当前监听的文件路径 */
    private currentFilePath;
    /** v5.4: 缓存的文件内容（用于变化检测） */
    private cachedContent;
    constructor(app: App);
    /**
     * 初始化同步服务
     */
    initialize(callbacks: SyncCallbacks): void;
    /**
     * 设置当前监听的文件
     */
    setCurrentFile(filePath: string | null): void;
    /**
     * v5.4: 注册文件修改监听器（支持块文件方案）
     */
    private registerFileModifyListener;
    /**
     * v5.4: 处理块文件修改事件
     */
    private handleChunkFileModify;
    /**
     * 注册编辑器变化监听器
     */
    private registerEditorChangeListener;
    /**
     * 处理编辑器变化事件
     */
    private handleEditorChange;
    /**
     * @deprecated v5.0: 旧 UUID 标记方案已移除，块文件方案不需要此方法
     * 同步内容到原文档（增量阅读 → 原文档）
     * @returns 总是返回 false，块文件方案应直接写入文件
     */
    syncToSourceDocument(_content: string, _block: IRBlock): boolean;
    /**
     * 查找已打开指定文件的 Leaf
     */
    private findOpenLeaf;
    /**
     * 开始本地变化（防止循环）
     * 公共方法，供外部组件调用
     */
    beginLocalChange(): void;
    /**
     * 结束本地变化（延迟重置）
     * 公共方法，供外部组件调用
     */
    endLocalChange(): void;
    /**
     * 检查是否处于本地变化状态
     */
    isInLocalChange(): boolean;
    /**
     * v5.4: 缓存当前内容（用于变化检测）
     */
    cacheCurrentContent(content: string): void;
    /**
     * 销毁服务
     */
    destroy(): void;
}
