import type { PositionIndex } from './types/sync-types';
export declare class PositionIndexBuilder {
    private delimiter;
    private startMarker;
    private endMarker;
    private detector;
    constructor(delimiter?: string, startMarker?: string, endMarker?: string);
    /**
     * 构建完整的位置索引
     * @param content 文件内容
     * @returns 位置索引对象
     */
    buildIndex(content: string): PositionIndex | null;
    /**
     * 查找批量范围标记
     * @param content 文件内容
     * @returns 批量范围信息
     */
    private findBatchRange;
    /**
     * 检测块中的UUID和BlockID
     * @param blockContent 块内容
     * @param blockStartPos 块起始位置
     * @returns UUID检测结果
     */
    private detectUUIDInBlock;
    /**
     * 查找前置分隔符位置
     * @param content 完整内容
     * @param blockStartPos 块起始位置
     * @returns 分隔符位置
     */
    private findPrecedingDelimiterPos;
    /**
     * 查找后置分隔符位置
     * @param content 完整内容
     * @param blockEndPos 块结束位置
     * @param rangeEnd 批量范围结束位置
     * @returns 分隔符位置，如果没找到返回null
     */
    private findFollowingDelimiterPos;
    /**
     * 获取指定位置所在的行号
     * @param content 内容
     * @param position 字符位置
     * @returns 行号（从0开始）
     */
    private getLineNumber;
}
