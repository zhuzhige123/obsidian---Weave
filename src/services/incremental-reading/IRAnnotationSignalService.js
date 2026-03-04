/**
 * 增量阅读标注信号服务
 *
 * 基于《Obsidian标注作为摘录信号-权重与调度建议.md》实现
 *
 * 核心功能：
 * - 解析内容块中的 Callout 标注
 * - 按类型权重计算原始信号
 * - 使用饱和函数（tanh）防止刷标注
 * - 注入到 P_eff 优先级计算
 *
 * @module services/incremental-reading/IRAnnotationSignalService
 * @version 1.0.0
 */
import { logger } from '../../utils/logger';
// ============================================
// 类型定义
// ============================================
/**
 * Callout 类型及其别名映射
 */
export const CALLOUT_TYPE_ALIASES = {
    // question 系列
    'question': 'question',
    'help': 'question',
    'faq': 'question',
    // warning 系列
    'warning': 'warning',
    'caution': 'warning',
    'attention': 'warning',
    // quote 系列
    'quote': 'quote',
    'cite': 'quote',
    // tip 系列
    'tip': 'tip',
    'hint': 'tip',
    'important': 'tip',
    // info
    'info': 'info',
    // note
    'note': 'note',
    // 其他常用类型
    'abstract': 'abstract',
    'summary': 'abstract',
    'tldr': 'abstract',
    'todo': 'todo',
    'example': 'example',
    'success': 'success',
    'check': 'success',
    'done': 'success',
    'failure': 'failure',
    'fail': 'failure',
    'missing': 'failure',
    'danger': 'danger',
    'error': 'danger',
    'bug': 'bug'
};
/**
 * 默认类型权重配置
 * 权重范围：0.5 ~ 3.0
 */
export const DEFAULT_CALLOUT_WEIGHTS = {
    'question': 2.5, // 问题/疑惑，最高权重
    'warning': 2.0, // 警告/注意
    'quote': 1.5, // 引用/摘录
    'tip': 1.5, // 提示/重要
    'info': 1.0, // 信息
    'note': 0.8, // 笔记（泛用性强，权重略低）
    'abstract': 1.2, // 摘要
    'todo': 1.5, // 待办
    'example': 1.0, // 示例
    'success': 0.8, // 成功/完成
    'failure': 1.5, // 失败（需要关注）
    'danger': 2.0, // 危险
    'bug': 2.0 // Bug（需要关注）
};
/**
 * 默认启用的 Callout 类型白名单（保守、低噪音）
 */
export const DEFAULT_ENABLED_TYPES = [
    'question',
    'warning',
    'quote'
];
/**
 * 默认配置
 */
export const DEFAULT_ANNOTATION_SIGNAL_CONFIG = {
    enabledTypes: DEFAULT_ENABLED_TYPES,
    typeWeights: DEFAULT_CALLOUT_WEIGHTS,
    maxBoost: 2.0,
    saturationParam: 4,
    minContentLength: 0 // 默认不启用最小长度过滤
};
// ============================================
// Callout 解析正则
// ============================================
/**
 * Callout 匹配正则
 * 匹配格式：> [!type] 或 > [!type]- 或 > [!type]+ 后跟可选标题
 *
 * 捕获组：
 * 1. type - callout 类型
 * 2. 折叠标记（+/-）
 * 3. 标题（可选）
 */
const CALLOUT_REGEX = /^>\s*\[!(\w+)\]([+-])?(?:\s+(.*))?$/gm;
/**
 * Callout 内容行正则（以 > 开头的后续行）
 */
const CALLOUT_CONTENT_REGEX = /^>\s?(.*)$/;
// ============================================
// IRAnnotationSignalService 类
// ============================================
export class IRAnnotationSignalService {
    config;
    constructor(config) {
        this.config = {
            ...DEFAULT_ANNOTATION_SIGNAL_CONFIG,
            ...config
        };
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 解析文本中的所有 Callout
     *
     * @param content 文本内容
     * @returns 解析出的 Callout 列表
     */
    parseCallouts(content) {
        const callouts = [];
        const lines = content.split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const match = line.match(/^>\s*\[!(\w+)\]([+-])?(?:\s+(.*))?$/);
            if (match) {
                const rawType = match[1].toLowerCase();
                const normalizedType = CALLOUT_TYPE_ALIASES[rawType] || rawType;
                const startIndex = this.getLineStartIndex(content, i);
                // 收集 callout 内容（后续以 > 开头的行）
                const contentLines = [];
                let j = i + 1;
                while (j < lines.length) {
                    const contentMatch = lines[j].match(CALLOUT_CONTENT_REGEX);
                    if (contentMatch) {
                        contentLines.push(contentMatch[1]);
                        j++;
                    }
                    else {
                        break;
                    }
                }
                const calloutContent = contentLines.join('\n').trim();
                const endIndex = this.getLineEndIndex(content, j - 1);
                callouts.push({
                    rawType,
                    normalizedType,
                    content: calloutContent,
                    contentLength: this.countChineseAndEnglish(calloutContent),
                    startIndex,
                    endIndex
                });
                i = j;
            }
            else {
                i++;
            }
        }
        return callouts;
    }
    /**
     * 计算标注信号
     *
     * @param content 文本内容
     * @returns 信号计算结果
     */
    calculateSignal(content) {
        const callouts = this.parseCallouts(content);
        const typeCounts = {};
        const typeContributions = {};
        let rawScore = 0;
        let effectiveCalloutCount = 0;
        // 统计各类型数量和贡献
        for (const callout of callouts) {
            const type = callout.normalizedType;
            // 检查是否在白名单中
            if (!this.config.enabledTypes.includes(type)) {
                continue;
            }
            // 检查最小内容长度
            if (this.config.minContentLength &&
                callout.contentLength < this.config.minContentLength) {
                continue;
            }
            effectiveCalloutCount++;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
            // 获取权重
            const weight = this.config.typeWeights[type] || 1.0;
            const contribution = weight;
            typeContributions[type] = (typeContributions[type] || 0) + contribution;
            rawScore += contribution;
        }
        // 应用饱和函数：signal = maxBoost * tanh(raw / s)
        const signal = this.config.maxBoost * Math.tanh(rawScore / this.config.saturationParam);
        logger.debug(`[IRAnnotationSignalService] 信号计算: ` +
            `total=${callouts.length}, effective=${effectiveCalloutCount}, ` +
            `raw=${rawScore.toFixed(2)}, signal=${signal.toFixed(2)}`);
        return {
            signal,
            rawScore,
            typeCounts,
            typeContributions,
            callouts,
            totalCalloutCount: callouts.length,
            effectiveCalloutCount
        };
    }
    /**
     * 将信号注入到优先级
     *
     * @param pEff 当前有效优先级 (0-10)
     * @param signal 标注信号
     * @returns 调整后的优先级 (0-10)
     */
    applySignalToPriority(pEff, signal) {
        // P_eff' = clamp(P_eff + signal, 0, 10)
        return Math.max(0, Math.min(10, pEff + signal));
    }
    /**
     * 一站式计算：从内容直接得到调整后的优先级
     *
     * @param content 文本内容
     * @param pEff 当前有效优先级 (0-10)
     * @returns 调整后的优先级和信号详情
     */
    calculateAdjustedPriority(content, pEff) {
        const signalResult = this.calculateSignal(content);
        const adjustedPriority = this.applySignalToPriority(pEff, signalResult.signal);
        return {
            adjustedPriority,
            signalResult
        };
    }
    /**
     * 获取信号的可解释性描述
     *
     * @param result 信号计算结果
     * @returns 可读的描述文本
     */
    getSignalExplanation(result) {
        if (result.effectiveCalloutCount === 0) {
            return '无有效标注';
        }
        const parts = [];
        for (const [type, count] of Object.entries(result.typeCounts)) {
            const weight = this.config.typeWeights[type] || 1.0;
            const contribution = result.typeContributions[type] || 0;
            parts.push(`${type}×${count} (贡献 ${contribution.toFixed(1)})`);
        }
        return `标注信号: +${result.signal.toFixed(2)} ← ${parts.join(', ')}`;
    }
    // ============================================
    // 辅助方法
    // ============================================
    /**
     * 获取指定行的起始索引
     */
    getLineStartIndex(content, lineIndex) {
        const lines = content.split('\n');
        let index = 0;
        for (let i = 0; i < lineIndex && i < lines.length; i++) {
            index += lines[i].length + 1; // +1 for newline
        }
        return index;
    }
    /**
     * 获取指定行的结束索引
     */
    getLineEndIndex(content, lineIndex) {
        const lines = content.split('\n');
        let index = 0;
        for (let i = 0; i <= lineIndex && i < lines.length; i++) {
            index += lines[i].length + 1;
        }
        return index - 1; // -1 to exclude the final newline
    }
    /**
     * 统计中英文字符数
     */
    countChineseAndEnglish(text) {
        // 中文字符
        const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        // 英文单词
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        return chineseCount + englishWords;
    }
}
// ============================================
// 导出单例和工厂函数
// ============================================
let serviceInstance = null;
/**
 * 获取标注信号服务单例
 */
export function getAnnotationSignalService() {
    if (!serviceInstance) {
        serviceInstance = new IRAnnotationSignalService();
    }
    return serviceInstance;
}
/**
 * 创建新的标注信号服务实例
 */
export function createAnnotationSignalService(config) {
    return new IRAnnotationSignalService(config);
}
/**
 * 从插件设置同步配置到单例服务
 * 在插件初始化和设置保存时调用
 */
export function syncAnnotationSignalFromSettings(calloutSignal) {
    if (!calloutSignal)
        return;
    const service = getAnnotationSignalService();
    const enabledTypes = calloutSignal.typeWeights
        ?.filter(t => t.enabled)
        .map(t => t.type) || DEFAULT_ENABLED_TYPES;
    const typeWeights = { ...DEFAULT_CALLOUT_WEIGHTS };
    for (const tw of calloutSignal.typeWeights || []) {
        typeWeights[tw.type] = tw.weight;
    }
    service.updateConfig({
        enabledTypes,
        typeWeights,
        maxBoost: calloutSignal.maxBoost ?? 2.0,
        saturationParam: calloutSignal.saturationParam ?? 4,
        minContentLength: calloutSignal.minContentLength ?? 0
    });
    logger.debug('[IRAnnotationSignalService] 配置已从设置同步');
}
/**
 * 快捷函数：计算内容的标注信号
 */
export function calculateAnnotationSignal(content) {
    return getAnnotationSignalService().calculateSignal(content);
}
/**
 * 快捷函数：计算调整后的优先级
 */
export function calculateAdjustedPriority(content, pEff) {
    return getAnnotationSignalService().calculateAdjustedPriority(content, pEff);
}
