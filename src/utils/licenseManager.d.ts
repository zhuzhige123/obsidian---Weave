/**
 * 激活码管理系统
 * 结合本地RSA签名验证和云端设备管理
 * 支持邮箱绑定和自动设备轮换
 */
import type { App } from 'obsidian';
import type { LicenseInfo, CloudSyncInfo, ActivationCodeData } from '../types/license';
export type { LicenseInfo, CloudSyncInfo, ActivationCodeData };
export declare class LicenseManager {
    private cloudValidator;
    private readonly PUBLIC_KEY;
    private readonly PRODUCT_ID;
    private readonly LEGACY_PRODUCT_ID;
    private readonly CURRENT_VERSION;
    constructor();
    /**
     * 生成增强的设备指纹
     */
    private generateDeviceFingerprint;
    /**
     * 收集设备特征信息
     */
    private collectDeviceComponents;
    /**
     * SHA256 哈希函数
     */
    private sha256;
    /**
     * Base64 解码
     */
    private base64Decode;
    /**
     * 验证 RSA 签名
     */
    private verifySignature;
    /**
     * 解析激活码
     */
    private parseActivationCode;
    /**
     * 验证激活码
     */
    validateActivationCode(activationCode: string, _deviceFingerprint?: string): Promise<{
        isValid: boolean;
        data?: ActivationCodeData;
        error?: string;
    }>;
    /**
     * 激活许可证（临时禁用云端验证 - 仅本地RSA验证）
     * 注意：云端验证功能暂时禁用，后续版本会恢复
     */
    activateLicense(activationCode: string, email: string): Promise<{
        success: boolean;
        licenseInfo?: LicenseInfo;
        error?: string;
        cloudInfo?: {
            isFirstActivation?: boolean;
            replacedOldDevice?: boolean;
            devicesUsed?: number;
            devicesMax?: number;
        };
    }>;
    /**
     * 移除激活状态
     */
    deactivateLicense(): {
        success: boolean;
        message?: string;
        error?: string;
    };
    /**
     * 验证邮箱格式
     */
    private isValidEmail;
    /**
     * 验证当前许可证状态（增强版 - 支持云端验证和自动迁移）
     */
    validateCurrentLicense(licenseInfo: LicenseInfo): Promise<{
        isValid: boolean;
        error?: string;
        warnings?: string[];
    }>;
    /**
     * 计算设备指纹相似度
     * 注意：此方法已废弃，因为对SHA256哈希进行相似度计算无意义
     * 保留此方法仅用于向后兼容，实际不再使用
     * @deprecated 使用简单的匹配/不匹配判断代替
     */
    private calculateFingerprintSimilarity;
    /**
     * 定期验证许可证状态
     */
    performPeriodicValidation(licenseInfo: LicenseInfo): Promise<{
        isValid: boolean;
        shouldReactivate: boolean;
        error?: string;
        warnings?: string[];
    }>;
    /**
     * 获取许可证剩余天数
     */
    getLicenseRemainingDays(licenseInfo: LicenseInfo): number;
    /**
     * 检查是否为试用版
     */
    isTrialVersion(licenseInfo: LicenseInfo): boolean;
    /**
     * 执行云端验证（内部方法）
     */
    private performCloudValidation;
    /**
     * 判断是否需要执行云端验证（临时禁用）
     */
    private shouldPerformCloudValidation;
}
/**
 * 激活码前端验证结果
 */
export interface ActivationCodeValidationResult {
    isValid: boolean;
    error?: string;
    warning?: string;
}
/**
 * 防暴力破解限制器
 */
export declare class ActivationAttemptLimiter {
    private static readonly MAX_ATTEMPTS;
    private static readonly LOCKOUT_DURATION;
    private static readonly ATTEMPT_WINDOW;
    private static readonly STORAGE_KEY;
    private static app;
    static setApp(app: App): void;
    /**
     * 检查是否可以尝试激活
     */
    static canAttemptActivation(): Promise<{
        canAttempt: boolean;
        error?: string;
        remainingTime?: number;
    }>;
    /**
     * 记录激活尝试
     */
    static recordAttempt(success: boolean): Promise<void>;
    /**
     * 获取尝试记录
     */
    private static getAttempts;
    /**
     * 保存尝试记录
     */
    private static saveAttempts;
    /**
     * 生成简单的设备指纹（用于尝试限制）
     */
    private static generateSimpleFingerprint;
    /**
     * 重置尝试记录（用于测试）
     */
    static resetAttempts(): void;
}
/**
 * 激活码前端验证工具
 */
export declare class ActivationCodeValidator {
    /**
     * 验证激活码格式
     */
    static validateFormat(activationCode: string): ActivationCodeValidationResult;
    /**
     * 实时验证激活码输入
     */
    static validateInput(input: string): ActivationCodeValidationResult;
}
export declare const licenseManager: LicenseManager;
