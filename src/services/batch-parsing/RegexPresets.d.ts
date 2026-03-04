/**
 * 正则解析预设配置库
 * 职责：提供常用的正则解析配置模板，方便用户快速设置
 *
 * 预设配置：
 * 1. 默认配置（插件原生格式）
 * 2. 问答格式（Q: ... A: ...）
 * 3. 标题分隔（使用 Markdown 标题）
 * 4. 列表格式（使用 Markdown 列表）
 *
 * @author Weave Team
 * @date 2025-11-03
 */
import type { RegexParsingConfig } from '../../types/newCardParsingTypes';
/**
 * 预设配置 ID
 */
export type PresetId = 'default' | 'qa-format' | 'heading-based' | 'list-format' | 'anki-style';
/**
 * 预设配置元数据
 */
export interface RegexPresetMeta {
    id: PresetId;
    name: string;
    description: string;
    example: string;
    config: RegexParsingConfig;
}
/**
 * 预设配置库
 */
export declare const REGEX_PRESETS: Record<PresetId, RegexPresetMeta>;
/**
 * 获取预设配置
 * @param id 预设 ID
 * @returns 预设配置，如果不存在返回 null
 */
export declare function getPreset(id: PresetId): RegexPresetMeta | null;
/**
 * 获取所有预设配置
 * @returns 预设配置数组
 */
export declare function getAllPresets(): RegexPresetMeta[];
/**
 * 根据名称搜索预设配置
 * @param keyword 搜索关键词
 * @returns 匹配的预设配置数组
 */
export declare function searchPresets(keyword: string): RegexPresetMeta[];
/**
 * 创建自定义配置（基于预设）
 * @param basePresetId 基础预设 ID
 * @param customizations 自定义修改
 * @returns 自定义配置
 */
export declare function createCustomConfig(basePresetId: PresetId, customizations: Partial<RegexParsingConfig>): RegexParsingConfig;
/**
 * 验证正则配置
 * @param config 配置对象
 * @returns 验证结果
 */
export declare function validateConfig(config: RegexParsingConfig): {
    valid: boolean;
    errors: string[];
};
