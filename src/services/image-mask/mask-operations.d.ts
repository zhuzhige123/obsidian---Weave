/**
 * 遮罩操作辅助函数集
 *
 * 功能：
 * - 纯函数实现，无副作用
 * - 颜色处理和转换
 * - SVG坐标计算
 * - 遮罩碰撞检测
 * - 几何计算
 *
 * @author Weave Team
 * @date 2025-10-22
 */
import type { Mask } from '../../types/image-mask-types';
/**
 * 解析RGBA颜色字符串
 *
 * 支持格式：
 * - rgba(r, g, b, a)
 * - rgb(r, g, b)
 * - #RRGGBB
 * - #RGB
 *
 * @param color 颜色字符串
 * @returns {rgb, opacity} RGB颜色和透明度
 */
export declare function parseRGBAColor(color: string): {
    rgb: string;
    opacity: number;
};
/**
 * 创建RGBA颜色字符串
 *
 * @param rgb RGB部分 (如 "rgb(255, 0, 0)" 或 "255, 0, 0")
 * @param opacity 透明度 (0-1)
 * @returns RGBA字符串
 */
export declare function createRGBAColor(rgb: string, opacity: number): string;
/**
 * 清空颜色缓存（用于测试或内存管理）
 */
export declare function clearColorCache(): void;
/**
 * 从SVG事件获取相对坐标(0-1范围)
 *
 * @param event 鼠标事件
 * @param svgElement SVG元素
 * @returns {x, y} 相对坐标
 */
export declare function getSVGPoint(event: MouseEvent, svgElement: SVGSVGElement): {
    x: number;
    y: number;
};
/**
 * 限制坐标在0-1范围内
 *
 * @param value 原始值
 * @returns 限制后的值
 */
export declare function clampCoordinate(value: number): number;
/**
 * 限制遮罩在图片范围内
 *
 * @param mask 遮罩对象
 * @returns 限制后的遮罩
 */
export declare function clampMask(mask: Mask): Mask;
/**
 * 计算两点之间的距离
 *
 * @param p1 点1
 * @param p2 点2
 * @returns 距离
 */
export declare function distance(p1: {
    x: number;
    y: number;
}, p2: {
    x: number;
    y: number;
}): number;
/**
 * 计算矩形的边界框
 *
 * @param mask 矩形遮罩
 * @returns 边界框 {left, top, right, bottom}
 */
export declare function getRectBounds(mask: Mask): {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
/**
 * 检查点是否在遮罩内
 *
 * @param point 点坐标
 * @param mask 遮罩对象
 * @returns 是否在遮罩内
 */
export declare function isPointInMask(point: {
    x: number;
    y: number;
}, mask: Mask): boolean;
/**
 * 检测两个遮罩是否碰撞
 *
 * @param mask1 遮罩1
 * @param mask2 遮罩2
 * @returns 是否碰撞
 */
export declare function checkMaskCollision(mask1: Mask, mask2: Mask): boolean;
/**
 * 查找点击位置下的遮罩
 *
 * @param point 点击点
 * @param masks 遮罩数组
 * @returns 找到的遮罩或null（返回最上层的遮罩）
 */
export declare function findMaskAtPoint(point: {
    x: number;
    y: number;
}, masks: Mask[]): Mask | null;
/**
 * 控制点位置枚举
 */
export type ResizeHandle = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
/**
 * 获取矩形的所有控制点位置
 *
 * @param mask 矩形遮罩
 * @returns 控制点位置数组
 */
export declare function getRectResizeHandles(mask: Mask): Array<{
    type: ResizeHandle;
    x: number;
    y: number;
}>;
/**
 * 获取圆形的控制点位置
 *
 * @param mask 圆形遮罩
 * @returns 控制点位置数组（4个方向）
 */
export declare function getCircleResizeHandles(mask: Mask): Array<{
    type: 'top' | 'right' | 'bottom' | 'left';
    x: number;
    y: number;
}>;
/**
 * 检查点是否在控制点附近
 *
 * @param point 点坐标
 * @param handlePoint 控制点坐标
 * @param threshold 阈值（相对坐标，默认0.02）
 * @returns 是否在控制点附近
 */
export declare function isNearHandle(point: {
    x: number;
    y: number;
}, handlePoint: {
    x: number;
    y: number;
}, threshold?: number): boolean;
/**
 * 验证遮罩数据是否有效
 *
 * @param mask 遮罩对象
 * @returns 是否有效
 */
export declare function isValidMask(mask: Partial<Mask>): boolean;
/**
 * 检查遮罩是否太小（可能是误操作）
 *
 * @param mask 遮罩对象
 * @param threshold 最小尺寸阈值（默认0.01，即1%）
 * @returns 是否太小
 */
export declare function isMaskTooSmall(mask: Mask, threshold?: number): boolean;
