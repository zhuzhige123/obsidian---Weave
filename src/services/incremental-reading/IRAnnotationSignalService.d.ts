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
/**
 * Callout 类型及其别名映射
 */
export declare const CALLOUT_TYPE_ALIASES: Record<string, string>;
/**
 * 默认类型权重配置
 * 权重范围：0.5 ~ 3.0
 */
export declare const DEFAULT_CALLOUT_WEIGHTS: Record<string, number>;
/**
 * 默认启用的 Callout 类型白名单（保守、低噪音）
 */
export declare const DEFAULT_ENABLED_TYPES: string[];
/**
 * 标注信号配置
 */
export interface AnnotationSignalConfig {
    /** 启用的 Callout 类型白名单 */
    enabledTypes: string[];
    /** 类型权重配置 */
    typeWeights: Record<string, number>;
    /** 最大增益（对 P_eff 的最大修正值） */
    maxBoost: number;
    /** 饱和函数参数 s（越小越快饱和） */
    saturationParam: number;
    /** 最小内容阈值（字数，可选） */
    minContentLength?: number;
}
/**
 * 默认配置
 */
export declare const DEFAULT_ANNOTATION_SIGNAL_CONFIG: AnnotationSignalConfig;
/**
 * 解析出的 Callout 信息
 */
export interface ParsedCallout {
    /** 原始类型（小写） */
    rawType: string;
    /** 规范化类型 */
    normalizedType: string;
    /** Callout 内容 */
    content: string;
    /** 内容字数 */
    contentLength: number;
    /** 在源文本中的起始位置 */
    startIndex: number;
    /** 在源文本中的结束位置 */
    endIndex: number;
}
/**
 * 标注信号计算结果
 */
export interface AnnotationSignalResult {
    /** 最终信号值（0 ~ maxBoost） */
    signal: number;
    /** 原始加权和 */
    rawScore: number;
    /** 各类型统计 */
    typeCounts: Record<string, number>;
    /** 各类型贡献 */
    typeContributions: Record<string, number>;
    /** 解析出的 Callout 列表 */
    callouts: ParsedCallout[];
    /** 总 Callout 数量 */
    totalCalloutCount: number;
    /** 有效 Callout 数量（在白名单中且满足最小长度） */
    effectiveCalloutCount: number;
}
export declare class IRAnnotationSignalService {
    private config;
    constructor(config?: Partial<AnnotationSignalConfig>);
    /**
     * 更新配置
     */
    updateConfig(config: Partial<AnnotationSignalConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): AnnotationSignalConfig;
    /**
     * 解析文本中的所有 Callout
     *
     * @param content 文本内容
     * @returns 解析出的 Callout 列表
     */
    parseCallouts(content: string): ParsedCallout[];
    /**
     * 计算标注信号
     *
     * @param content 文本内容
     * @returns 信号计算结果
     */
    calculateSignal(content: string): AnnotationSignalResult;
    /**
     * 将信号注入到优先级
     *
     * @param pEff 当前有效优先级 (0-10)
     * @param signal 标注信号
     * @returns 调整后的优先级 (0-10)
     */
    applySignalToPriority(pEff: number, signal: number): number;
    /**
     * 一站式计算：从内容直接得到调整后的优先级
     *
     * @param content 文本内容
     * @param pEff 当前有效优先级 (0-10)
     * @returns 调整后的优先级和信号详情
     */
    calculateAdjustedPriority(content: string, pEff: number): {
        adjustedPriority: number;
        signalResult: AnnotationSignalResult;
    };
    /**
     * 获取信号的可解释性描述
     *
     * @param result 信号计算结果
     * @returns 可读的描述文本
     */
    getSignalExplanation(result: AnnotationSignalResult): string;
    /**
     * 获取指定行的起始索引
     */
    private getLineStartIndex;
    /**
     * 获取指定行的结束索引
     */
    private getLineEndIndex;
    /**
     * 统计中英文字符数
     */
    private countChineseAndEnglish;
}
/**
 * 获取标注信号服务单例
 */
export declare function getAnnotationSignalService(): IRAnnotationSignalService;
/**
 * 创建新的标注信号服务实例
 */
export declare function createAnnotationSignalService(config?: Partial<AnnotationSignalConfig>): IRAnnotationSignalService;
/**
 * 从插件设置同步配置到单例服务
 * 在插件初始化和设置保存时调用
 */
export declare function syncAnnotationSignalFromSettings(calloutSignal?: {
    enabled?: boolean;
    typeWeights?: Array<{
        type: string;
        enabled: boolean;
        weight: number;
    }>;
    maxBoost?: number;
    saturationParam?: number;
    minContentLength?: number;
}): void;
/**
 * 快捷函数：计算内容的标注信号
 */
export declare function calculateAnnotationSignal(content: string): AnnotationSignalResult;
/**
 * 快捷函数：计算调整后的优先级
 */
export declare function calculateAdjustedPriority(content: string, pEff: number): {
    adjustedPriority: number;
    signalResult: AnnotationSignalResult;
};
