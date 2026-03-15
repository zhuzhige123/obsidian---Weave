/**
 * 遮罩渲染器
 *
 * 功能：
 * - 在学习复习时渲染遮罩到图片上
 * - 支持 SVG 遮罩层（轻量级，支持百分比坐标）
 * - 支持遮罩显示/隐藏动画
 * - 支持多种遮罩样式（纯色、模糊）
 *
 * @author Weave Team
 * @date 2025-10-22
 */
import type { MaskData, MaskRenderOptions } from '../../types/image-mask-types';
export declare class MaskRenderer {
    private maskStates;
    /**
     * 在图片元素上渲染遮罩
     *
     * @param imgElement 图片 DOM 元素
     * @param maskData 遮罩数据
     * @param options 渲染选项
     */
    renderMasksOnImage(imgElement: HTMLImageElement, maskData: MaskData, options?: MaskRenderOptions): void;
    /**
     * 显示遮罩（动画）
     *
     * @param container 遮罩容器元素
     * @param duration 动画持续时间（毫秒）
     */
    showMasks(container: HTMLElement | null, duration?: number): void;
    /**
     * 隐藏遮罩（动画）- 用于显示答案时
     *
     * @param container 遮罩容器元素
     * @param duration 动画持续时间（毫秒）
     */
    hideMasks(container: HTMLElement | null, duration?: number): void;
    /**
     * 🆕 切换单个遮罩的显示状态
     *
     * @param maskId 遮罩ID
     * @param duration 动画持续时间（毫秒）
     */
    toggleMask(maskId: string, duration?: number): void;
    /**
     * 🆕 使遮罩可交互（添加点击事件）
     */
    private makeMaskInteractive;
    /**
     * 查找图片对应的遮罩容器
     *
     * @param imgElement 图片元素
     * @returns 遮罩容器或 null
     */
    findMaskContainer(imgElement: HTMLImageElement): HTMLElement | null;
    /**
     * 🆕 Hide All, Guess One 模式：只揭示指定编号的遮罩
     *
     * @param container 遮罩容器
     * @param revealIndex 要揭示的遮罩编号（从1开始），0表示全部隐藏
     */
    revealByIndex(container: HTMLElement | null, revealIndex: number): void;
    /**
     * 🆕 获取遮罩总数
     */
    getMaskCount(container: HTMLElement | null): number;
    /**
     * 创建遮罩容器
     *
     *  创新方案：动态获取图片实际显示尺寸，精确定位 SVG 遮罩层
     */
    private createMaskContainer;
    /**
     * 创建单个遮罩元素
     *
     *  创新方案：使用图片实际尺寸计算遮罩坐标
     */
    private createMaskElement;
    /**
     * 创建角标式编号徽章（左上角）
     */
    private createMaskIndexText;
    /**
     * 创建矩形遮罩
     */
    private createRectMask;
    /**
     * 创建圆形遮罩
     *
     *  创新方案：使用图片实际尺寸计算坐标
     */
    private createCircleMask;
    /**
     * 应用遮罩样式
     */
    private applyMaskStyle;
    /**
     * 🆕 重置所有遮罩状态（清理状态追踪）
     */
    resetMaskStates(): void;
    /**
     * 创建模糊滤镜
     */
    private createBlurFilter;
}
/**
 * 在容器中查找所有带遮罩的图片
 *
 * @param container 容器元素
 * @returns 带遮罩的图片包装器数组
 */
export declare function findMaskedImages(container: HTMLElement): HTMLElement[];
/**
 * 批量显示所有遮罩
 *
 * @param container 容器元素
 * @param duration 动画持续时间
 */
export declare function revealAllMasks(container: HTMLElement, duration?: number): void;
/**
 * 批量隐藏所有遮罩
 *
 * @param container 容器元素
 * @param duration 动画持续时间
 */
export declare function hideAllMasks(container: HTMLElement, duration?: number): void;
