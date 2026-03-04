/**
 * 渐进式挖空分析器
 *
 * 负责检测和提取{{c::}}语法的挖空标记
 * 与Anki的挖空格式完全兼容
 *
 * @module services/progressive-cloze/ProgressiveClozeAnalyzer
 */
import type { ClozeAnalysisResult, ClozeData, ClozeValidationResult } from '../../types/progressive-cloze-types';
export declare class ProgressiveClozeAnalyzer {
    /**
     * 分析内容，检测挖空类型
     *
     * @param content 待分析的内容
     * @returns 分析结果
     */
    analyze(content: string): ClozeAnalysisResult;
    /**
     * 提取渐进式挖空信息
     *
     * 支持三种格式：
     * - {{c1::text}}         基础格式
     * - {{c1::text::hint}}   带提示格式
     * - {{c1::}}text{{::}}   Anki旧版格式（兼容）
     *
     * @param content 待解析的内容
     * @returns 挖空数据列表
     */
    extractProgressiveClozes(content: string): ClozeData[];
    /**
     * 生成稳定的UUID
     *
     * 基于ord和文本内容生成，确保相同的挖空在编辑后仍有相同的UUID
     *
     * @param ord 挖空序号（0-based）
     * @param text 挖空文本
     * @returns UUID字符串
     */
    private generateClozeUUID;
    /**
     * 简单哈希函数
     *
     * 用于生成UUID的哈希值，不需要加密级别的安全性
     *
     * @param str 待哈希的字符串
     * @returns 36进制哈希字符串
     */
    private simpleHash;
    /**
     * 验证挖空编号连续性
     *
     * 检查规则：
     * 1. 编号应该从1开始连续递增（c1, c2, c3...）
     * 2. 不应该有重复的编号
     * 3. 不应该有跳过的编号（如c1, c3缺少c2）
     *
     * @param clozes 挖空数据列表
     * @returns 验证结果
     */
    validateClozeNumbers(clozes: ClozeData[]): ClozeValidationResult;
    /**
     * 获取当前内容中最大的挖空编号
     *
     * 用于自动递增挖空编号（编辑器功能）
     *
     * @param content 内容字符串
     * @returns 最大编号（如果没有挖空则返回0）
     */
    getMaxClozeNumber(content: string): number;
    /**
     * 检测内容中是否包含渐进式挖空
     *
     * 快速检测方法，不提取详细信息
     *
     * @param content 内容字符串
     * @returns 是否包含{{c::}}语法
     */
    hasProgressiveCloze(content: string): boolean;
    /**
     * 检测内容中是否包含Obsidian高亮
     *
     * @param content 内容字符串
     * @returns 是否包含==文本==语法
     */
    hasObsidianHighlight(content: string): boolean;
}
