/**
 * 图片遮罩集成服务
 *
 * 功能：
 * - 在学习界面自动检测和渲染遮罩
 * - 处理显示答案时的遮罩揭示动画
 * - 提供统一的遮罩管理接口
 *
 * @author Weave Team
 * @date 2025-10-22
 */
import type { App } from 'obsidian';
export declare class ImageMaskIntegration {
    private app;
    private parser;
    private renderer;
    constructor(app: App);
    /**
     * 在容器中查找并渲染所有带遮罩的图片
     *
     * @param container 容器元素
     * @param content Markdown 内容（用于解析遮罩数据）
     * @param interactive 是否启用交互模式（点击单个遮罩切换）
     */
    applyMasksInContainer(container: HTMLElement, content: string, interactive?: boolean): void;
    /**
     * 显示所有遮罩（用于显示问题时）
     *
     * @param container 容器元素
     * @param animated 是否启用动画
     */
    showAllMasks(container: HTMLElement, animated?: boolean): void;
    /**
     * 揭示所有遮罩（用于显示答案时）
     *
     * @param container 容器元素
     * @param duration 动画持续时间（毫秒）
     */
    revealAllMasks(container: HTMLElement, duration?: number): void;
    /**
     * 移除容器中的所有遮罩
     *
     * @param container 容器元素
     */
    removeMasksInContainer(container: HTMLElement): void;
    /**
     * 从内容中解析所有遮罩数据
     * 返回 Map<图片序号, MaskData>
     *
     *  修复：按图片在文件中的出现顺序（0, 1, 2...）建立索引，而不是行号
     */
    private parseMaskDataFromContent;
    /**
     * 查找图片对应的遮罩数据
     */
    private findMaskDataForImage;
}
/**
 * 创建图片遮罩集成实例的便捷函数
 */
export declare function createImageMaskIntegration(app: App): ImageMaskIntegration;
