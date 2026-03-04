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
/**
 * 预设配置库
 */
export const REGEX_PRESETS = {
    /**
     * 默认配置：插件原生格式
     * 使用 <-> 作为卡片分隔符
     * 使用 ---div--- 作为正反面分隔符
     */
    default: {
        id: 'default',
        name: '默认格式（插件原生）',
        description: '使用 <-> 分隔卡片，使用 ---div--- 分隔正反面',
        example: `<->
这是问题内容
---div---
这是答案内容
<->`,
        config: {
            name: '默认格式',
            mode: 'separator',
            separatorMode: {
                cardSeparator: '<->', //  修改默认值从 %%<->%% 改为 <->
                frontBackSeparator: '---div---',
                multiline: true,
                emptyLineSeparator: {
                    enabled: false,
                    lineCount: 2
                }
            },
            uuidLocation: 'inline',
            uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
            excludeTags: ['禁止同步'],
            autoAddUUID: true,
            syncMethod: 'tag-based'
        }
    },
    /**
     * Q&A 格式：问答题格式
     * 使用 Q: 开始问题，A: 开始答案
     */
    'qa-format': {
        id: 'qa-format',
        name: 'Q&A 格式',
        description: '使用 Q: 和 A: 标记问题和答案',
        example: `Q: 什么是间隔重复？
A: 间隔重复是一种学习技术，通过逐渐增加复习间隔来优化记忆效果。

Q: FSRS 算法的全称是什么？
A: Free Spaced Repetition Scheduler（自由间隔重复调度器）`,
        config: {
            name: 'Q&A 格式',
            mode: 'pattern',
            patternMode: {
                cardPattern: 'Q:\\s*(.+?)\\s*A:\\s*(.+?)(?=\\n\\s*Q:|$)',
                flags: 'gs',
                captureGroups: {
                    front: 1,
                    back: 2
                }
            },
            uuidLocation: 'inline',
            uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
            excludeTags: ['禁止同步'],
            autoAddUUID: true,
            syncMethod: 'tag-based'
        }
    },
    /**
     * 标题分隔格式：使用 Markdown 二级标题分隔卡片
     * 标题作为问题，内容作为答案
     */
    'heading-based': {
        id: 'heading-based',
        name: '标题分隔格式',
        description: '使用 Markdown 二级标题（##）分隔卡片，标题作为问题',
        example: `## 什么是卡片？
卡片是学习的基本单位，包含问题和答案两部分。

## 什么是牌组？
牌组是卡片的集合，用于组织和管理学习内容。`,
        config: {
            name: '标题分隔格式',
            mode: 'separator',
            separatorMode: {
                cardSeparator: '^##\\s+',
                frontBackSeparator: undefined, // 标题本身是问题，内容是答案
                multiline: true
            },
            uuidLocation: 'inline',
            uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
            excludeTags: ['禁止同步'],
            autoAddUUID: true,
            syncMethod: 'tag-based'
        }
    },
    /**
     * 列表格式：使用 Markdown 列表
     * 列表项作为问题，子项作为答案
     */
    'list-format': {
        id: 'list-format',
        name: '列表格式',
        description: '使用 Markdown 列表，列表项作为问题，缩进项作为答案',
        example: `- 什么是间隔重复？
  - 间隔重复是一种学习技术
  - 通过逐渐增加复习间隔来优化记忆效果

- FSRS 算法的优势？
  - 更准确的记忆预测
  - 自适应学习曲线`,
        config: {
            name: '列表格式',
            mode: 'pattern',
            patternMode: {
                cardPattern: '^-\\s+([^\\n]+)\\n((?:\\s+-\\s+[^\\n]+\\n?)+)',
                flags: 'gm',
                captureGroups: {
                    front: 1,
                    back: 2
                }
            },
            uuidLocation: 'inline',
            uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
            excludeTags: ['禁止同步'],
            autoAddUUID: true,
            syncMethod: 'tag-based'
        }
    },
    /**
     * Anki 导出格式：兼容 Anki 的导出格式
     * 使用制表符或其他分隔符
     */
    'anki-style': {
        id: 'anki-style',
        name: 'Anki 导出格式',
        description: '兼容 Anki 的导出格式（每行一张卡片，制表符分隔）',
        example: `问题1\t答案1
问题2\t答案2
问题3\t答案3`,
        config: {
            name: 'Anki 导出格式',
            mode: 'pattern',
            patternMode: {
                cardPattern: '^(.+?)\\t(.+?)$',
                flags: 'gm',
                captureGroups: {
                    front: 1,
                    back: 2
                }
            },
            uuidLocation: 'none',
            excludeTags: ['禁止同步'],
            autoAddUUID: true,
            syncMethod: 'full-sync'
        }
    }
};
/**
 * 获取预设配置
 * @param id 预设 ID
 * @returns 预设配置，如果不存在返回 null
 */
export function getPreset(id) {
    return REGEX_PRESETS[id] || null;
}
/**
 * 获取所有预设配置
 * @returns 预设配置数组
 */
export function getAllPresets() {
    return Object.values(REGEX_PRESETS);
}
/**
 * 根据名称搜索预设配置
 * @param keyword 搜索关键词
 * @returns 匹配的预设配置数组
 */
export function searchPresets(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return getAllPresets().filter(preset => preset.name.toLowerCase().includes(lowerKeyword) ||
        preset.description.toLowerCase().includes(lowerKeyword));
}
/**
 * 创建自定义配置（基于预设）
 * @param basePresetId 基础预设 ID
 * @param customizations 自定义修改
 * @returns 自定义配置
 */
export function createCustomConfig(basePresetId, customizations) {
    const basePreset = getPreset(basePresetId);
    if (!basePreset) {
        throw new Error(`预设配置不存在: ${basePresetId}`);
    }
    return {
        ...basePreset.config,
        ...customizations
    };
}
/**
 * 验证正则配置
 * @param config 配置对象
 * @returns 验证结果
 */
export function validateConfig(config) {
    const errors = [];
    // 检查必填字段
    if (!config.name || !config.name.trim()) {
        errors.push('配置名称不能为空');
    }
    if (!config.mode) {
        errors.push('必须指定解析模式（separator 或 pattern）');
    }
    // 检查模式配置
    if (config.mode === 'separator') {
        if (!config.separatorMode) {
            errors.push('分隔符模式需要提供 separatorMode 配置');
        }
        else {
            if (!config.separatorMode.cardSeparator) {
                errors.push('必须指定卡片分隔符');
            }
        }
    }
    if (config.mode === 'pattern') {
        if (!config.patternMode) {
            errors.push('完整模式需要提供 patternMode 配置');
        }
        else {
            if (!config.patternMode.cardPattern) {
                errors.push('必须指定卡片匹配正则');
            }
            if (typeof config.patternMode.captureGroups.front !== 'number') {
                errors.push('必须指定正面内容的捕获组编号');
            }
            if (typeof config.patternMode.captureGroups.back !== 'number') {
                errors.push('必须指定背面内容的捕获组编号');
            }
        }
    }
    // 检查 UUID 配置
    if (config.uuidLocation === 'inline' && !config.uuidPattern) {
        errors.push('使用 inline UUID 时必须提供 uuidPattern');
    }
    // 尝试验证正则表达式语法
    try {
        if (config.mode === 'separator' && config.separatorMode?.cardSeparator) {
            new RegExp(config.separatorMode.cardSeparator);
        }
        if (config.mode === 'pattern' && config.patternMode?.cardPattern) {
            new RegExp(config.patternMode.cardPattern, config.patternMode.flags);
        }
        if (config.uuidPattern) {
            new RegExp(config.uuidPattern);
        }
    }
    catch (error) {
        errors.push(`正则表达式语法错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
