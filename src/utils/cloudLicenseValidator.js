import { logger } from '../utils/logger';
export class CloudLicenseValidator {
    apiUrl = 'https://ahwhophvla.bja.sealos.run';
    cacheKey = 'weave_cloud_cache';
    cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7天
    /**
     * 激活设备
     */
    async activate(activationCode, deviceFingerprint, email, platform) {
        try {
            const response = await fetch(`${this.apiUrl}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activation_code: activationCode,
                    device_fingerprint: deviceFingerprint,
                    email: email.toLowerCase().trim(),
                    platform
                }),
                signal: AbortSignal.timeout(10000)
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                return {
                    success: false,
                    error: data.error || '激活失败',
                    is_network_error: false
                };
            }
            return {
                success: true,
                message: data.message,
                devices_count: data.devices_count,
                max_devices: data.max_devices
            };
        }
        catch (error) {
            logger.error('激活请求失败:', error);
            const isNetworkError = error instanceof TypeError ||
                (error instanceof Error && error.name === 'AbortError');
            return {
                success: false,
                error: isNetworkError ? '网络连接失败' : '激活失败',
                is_network_error: isNetworkError
            };
        }
    }
    /**
     * 验证设备
     */
    async validate(activationCode, deviceFingerprint, email) {
        try {
            // 检查缓存
            const cache = this.getCache();
            if (cache && this.isCacheValid(cache)) {
                return cache.result;
            }
            const response = await fetch(`${this.apiUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activation_code: activationCode,
                    device_fingerprint: deviceFingerprint,
                    email: email.toLowerCase().trim()
                }),
                signal: AbortSignal.timeout(10000)
            });
            const data = await response.json();
            if (!response.ok || !data.valid) {
                return {
                    valid: false,
                    error: data.error || '验证失败',
                    is_network_error: false
                };
            }
            const result = {
                valid: true,
                expires_at: data.expires_at,
                devices_count: data.devices_count,
                max_devices: data.max_devices
            };
            this.setCache(result);
            return result;
        }
        catch (error) {
            logger.error('验证请求失败:', error);
            const isNetworkError = error instanceof TypeError ||
                (error instanceof Error && error.name === 'AbortError');
            return {
                valid: false,
                error: isNetworkError ? '网络连接失败' : '验证失败',
                is_network_error: isNetworkError
            };
        }
    }
    getCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            return cached ? JSON.parse(cached) : null;
        }
        catch {
            return null;
        }
    }
    isCacheValid(cache) {
        return (Date.now() - cache.cached_at) < this.cacheTTL;
    }
    setCache(result) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify({
                result,
                cached_at: Date.now()
            }));
        }
        catch {
            // 忽略存储错误
        }
    }
    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
        }
        catch {
            // 忽略
        }
    }
}
