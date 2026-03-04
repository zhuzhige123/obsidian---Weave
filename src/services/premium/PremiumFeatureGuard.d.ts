/**
 * 高级功能守卫服务
 * 单例模式，管理高级功能的访问控制
 */
import { type Writable } from 'svelte/store';
import type { LicenseInfo } from '../../utils/licenseManager';
/**
 * 高级功能ID定义
 */
export declare const PREMIUM_FEATURES: {
    readonly GRID_VIEW: "grid-view";
    readonly KANBAN_VIEW: "kanban-view";
    readonly AI_ASSISTANT: "ai-assistant";
    readonly INCREMENTAL_READING: "incremental-reading";
    readonly BATCH_PARSING: "batch-parsing";
    readonly QUESTION_BANK: "question-bank";
    readonly DECK_ANALYTICS: "deck-analytics";
    readonly PROGRESSIVE_CLOZE: "progressive-cloze";
    readonly VIEW_SOURCE: "view-source";
};
/**
 * 功能元数据
 */
export declare const FEATURE_METADATA: Record<string, {
    name: string;
    description: string;
    icon?: string;
}>;
/**
 * 高级功能守卫类
 * 单例模式，管理许可证验证和功能访问控制
 */
export declare class PremiumFeatureGuard {
    private static instance;
    /**
     * 高级版状态 Store
     * 用于响应式更新UI
     */
    isPremiumActive: Writable<boolean>;
    /**
     * 验证缓存
     * 避免频繁验证许可证
     */
    private validationCache;
    /**
     * 缓存有效期：5分钟
     */
    private readonly CACHE_DURATION;
    /**
     * 私有构造函数，确保单例
     */
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): PremiumFeatureGuard;
    /**
     * 初始化守卫
     * @param licenseInfo 许可证信息
     */
    initialize(licenseInfo: LicenseInfo | null): Promise<void>;
    /**
     * 更新许可证状态
     * @param licenseInfo 新的许可证信息
     */
    updateLicense(licenseInfo: LicenseInfo | null): Promise<void>;
    /**
     * 验证许可证
     * 使用缓存优化性能
     */
    private validateLicense;
    /**
     * 检查是否可以使用某个功能
     * @param featureId 功能ID
     * @returns true表示可以使用
     */
    canUseFeature(featureId: string): boolean;
    /**
     * 检查功能是否受限（canUseFeature的反向）
     * @param featureId 功能ID
     * @returns true表示功能受限，不可使用
     */
    isFeatureRestricted(featureId: string): boolean;
    /**
     * 清除验证缓存
     */
    private clearCache;
}
/**
 * 默认导出单例实例获取方法
 */
export default PremiumFeatureGuard;
