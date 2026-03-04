/**
 * 行号到 DOM 元素的映射器
 *
 * 核心职责：
 * - 将源码行号转换为对应的 .cm-line DOM 元素
 * - 处理虚拟滚动场景（行不在 DOM 中）
 * - 处理换行场景（一行源码对应多个 DOM 元素）
 *
 * @module services/incremental-reading/LineDOMMapper
 * @version 1.0.0
 */
import { MarkdownView } from 'obsidian';
/**
 * 行号到 DOM 元素映射器接口
 */
export interface LineDOMMapper {
    /**
     * 获取指定行号对应的 DOM 元素
     *
     * @param lineNumber 源码行号 (0-based)
     * @param position 'start' 返回第一个元素，'end' 返回最后一个元素
     * @returns DOM 元素，如果行不存在返回 null
     */
    getLineElement(lineNumber: number, position: 'start' | 'end'): HTMLElement | null;
    /**
     * 获取指定行号范围的边界 DOM 元素
     *
     * @param startLine 起始行号 (0-based)
     * @param endLine 结束行号 (0-based)
     * @returns 起始和结束 DOM 元素
     */
    getBlockBoundaryElements(startLine: number, endLine: number): {
        startElement: HTMLElement | null;
        endElement: HTMLElement | null;
    };
    /**
     * 获取聚焦块的实际边界矩形
     * 考虑块内所有元素（包括图片等嵌入内容）
     *
     * @param startLine 起始行号 (0-based)
     * @param endLine 结束行号 (0-based)
     * @returns 边界矩形，如果无法获取返回 null
     */
    getBlockBoundingRect(startLine: number, endLine: number): DOMRect | null;
    /**
     * 确保指定行在视口中可见
     * 用于处理虚拟滚动场景
     *
     * @param lineNumber 行号 (0-based)
     */
    ensureLineVisible(lineNumber: number): void;
    /**
     * 使缓存失效
     * 在内容变化后调用
     */
    invalidateCache(): void;
    /**
     * 销毁映射器，清理资源
     */
    destroy(): void;
}
/**
 * LineDOMMapper 实现
 *
 * 使用 CodeMirror 6 的 domAtPos API 获取 DOM 位置，
 * 然后向上查找 .cm-line 元素
 */
export declare class LineDOMMapperImpl implements LineDOMMapper {
    private view;
    private cache;
    private cacheTimeout;
    constructor(view: MarkdownView);
    /**
     * 获取指定行号对应的 DOM 元素
     */
    getLineElement(lineNumber: number, position: 'start' | 'end'): HTMLElement | null;
    /**
     * 获取指定行号范围的边界 DOM 元素
     *
     * 对于结束行，需要特别处理可能存在的嵌入内容（如图片）
     * 因为嵌入内容可能渲染在 .cm-line 之后
     */
    getBlockBoundaryElements(startLine: number, endLine: number): {
        startElement: HTMLElement | null;
        endElement: HTMLElement | null;
    };
    /**
     * 获取聚焦块的实际边界矩形
     * 考虑块内所有元素（包括图片等嵌入内容）
     */
    getBlockBoundingRect(startLine: number, endLine: number): DOMRect | null;
    /**
     * 检查元素是否是嵌入内容（图片、视频等）
     */
    private isEmbedElement;
    /**
     * 确保指定行在视口中可见
     */
    ensureLineVisible(lineNumber: number): void;
    /**
     * 使缓存失效
     */
    invalidateCache(): void;
    /**
     * 销毁映射器
     */
    destroy(): void;
    /**
     * 从给定节点向上查找 .cm-line 元素
     */
    private findCmLineElement;
}
/**
 * 创建 LineDOMMapper 实例
 */
export declare function createLineDOMMapper(view: MarkdownView): LineDOMMapper;
