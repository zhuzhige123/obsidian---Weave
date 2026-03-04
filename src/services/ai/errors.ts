/**
 * AI服务错误类型系统
 * 提供统一的错误处理和用户友好的错误提示
 */

import type { AIProvider } from '../../components/settings/constants/settings-constants';
import { AI_PROVIDER_LABELS } from '../../components/settings/constants/settings-constants';

/**
 * AI Provider配置错误
 * 用于API密钥缺失、无效等配置问题
 */
export class AIProviderError extends Error {
  constructor(
    public readonly provider: AIProvider,
    message: string,
    public readonly code: 'NO_API_KEY' | 'INVALID_API_KEY' | 'SERVICE_UNAVAILABLE'
  ) {
    super(message);
    this.name = 'AIProviderError';
  }

  /**
   * 获取用户友好的错误提示
   * 统一的错误提示格式，指引用户如何解决问题
   */
  getUserMessage(): string {
    const providerLabel = AI_PROVIDER_LABELS[this.provider] || this.provider;
    
    switch (this.code) {
      case 'NO_API_KEY':
        return `${providerLabel} 未配置API密钥，请前往 [插件设置 > AI服务] 进行配置`;
      case 'INVALID_API_KEY':
        return `${providerLabel} API密钥无效，请检查配置或重新生成密钥`;
      case 'SERVICE_UNAVAILABLE':
        return `${providerLabel} 服务暂时不可用，请稍后重试或切换其他AI服务`;
      default:
        return `${providerLabel}: ${this.message}`;
    }
  }
}

/**
 * AI执行错误
 * 用于AI服务调用过程中的各种错误
 */
export class AIExecutionError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProvider,
    public readonly actionType: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIExecutionError';
  }

  /**
   * 获取用户友好的错误提示
   */
  getUserMessage(): string {
    const providerLabel = AI_PROVIDER_LABELS[this.provider] || this.provider;
    return `${providerLabel} 执行失败: ${this.message}`;
  }
}

/**
 * AI配置错误
 * 用于配置缺失、无效等问题
 */
export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }

  getUserMessage(): string {
    return `配置错误: ${this.message}`;
  }
}
