import type { App } from 'obsidian';
/**
 * Sealos云端License验证器
 */
export interface CloudActivationResult {
    success: boolean;
    message?: string;
    devices_count?: number;
    max_devices?: number;
    error?: string;
    is_network_error?: boolean;
}
export interface CloudValidationResult {
    valid: boolean;
    expires_at?: string;
    devices_count?: number;
    max_devices?: number;
    error?: string;
    is_network_error?: boolean;
}
export declare class CloudLicenseValidator {
    private readonly apiUrl;
    private readonly cacheKey;
    private readonly cacheTTL;
    private app;
    setApp(app: App): void;
    /**
     * 激活设备
     */
    activate(activationCode: string, deviceFingerprint: string, email: string, platform: string): Promise<CloudActivationResult>;
    /**
     * 验证设备
     */
    validate(activationCode: string, deviceFingerprint: string, email: string): Promise<CloudValidationResult>;
    private getCache;
    private isCacheValid;
    private setCache;
    clearCache(): void;
}
