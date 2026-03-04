/**
 * AI服务工厂
 */

import { OpenAIService } from './OpenAIService';
import { ZhipuService } from './ZhipuService';
import { DeepSeekService } from './DeepSeekService';
import { GeminiService } from './GeminiService';
import { AnthropicService } from './AnthropicService';
import { SiliconFlowService } from './SiliconFlowService';
import type { AIProvider } from '../../types/ai-types';
import type { IAIService } from '../../types/ai-types';
import type { WeavePlugin } from '../../main';

export class AIServiceFactory {
  /**
   * 创建AI服务实例
   * @param provider AI提供商
   * @param plugin 插件实例
   * @param customModel 可选的自定义model，用于覆盖配置中的默认model
   */
  static createService(
    provider: AIProvider,
    plugin: WeavePlugin,
    customModel?: string
  ): IAIService {
    const aiConfig = plugin.settings.aiConfig;

    if (!aiConfig) {
      throw new Error('AI配置未初始化');
    }

    const apiKeys = aiConfig.apiKeys as Partial<Record<AIProvider, any>>;
    const providerConfig = apiKeys[provider];

    if (!providerConfig || !providerConfig.apiKey) {
      throw new Error(`${provider} API密钥未配置`);
    }

    // 🆕 获取自定义baseUrl（如果有）
    const customBaseUrl = providerConfig.baseUrl;
    const systemPromptConfig = aiConfig.systemPromptConfig;
    
    //  使用自定义model或配置中的默认model
    const defaultModels: Partial<Record<AIProvider, string>> = {
      openai: 'gpt-3.5-turbo',
      zhipu: 'glm-4-plus',
      deepseek: 'deepseek-chat',
      gemini: 'gemini-pro',
      anthropic: 'claude-3-5-sonnet-20241022',
      siliconflow: 'Qwen/Qwen2.5-7B-Instruct'
    };
    const modelToUse = customModel || providerConfig.model || defaultModels[provider];

    if (!modelToUse) {
      throw new Error(`${provider} model未配置，请在 [插件设置 > AI服务] 中为该provider设置默认model，或在AI功能中指定model`);
    }

    switch (provider) {
      case 'openai':
        return new OpenAIService(
          providerConfig.apiKey,
          modelToUse,
          customBaseUrl, // 🆕 传递自定义URL
          systemPromptConfig
        );

      case 'zhipu':
        return new ZhipuService(
          providerConfig.apiKey,
          modelToUse,
          customBaseUrl, // 🆕 传递自定义URL
          systemPromptConfig
        );

      case 'deepseek':
        return new DeepSeekService(
          providerConfig.apiKey,
          modelToUse,
          customBaseUrl, // 🆕 传递自定义URL
          systemPromptConfig
        );

      case 'gemini':
        return new GeminiService(
          providerConfig.apiKey,
          modelToUse,
          customBaseUrl, // 🆕 传递自定义URL
          systemPromptConfig
        );

      case 'anthropic':
        return new AnthropicService(
          providerConfig.apiKey,
          modelToUse,
          customBaseUrl, // 🆕 传递自定义URL
          systemPromptConfig
        );

      case 'siliconflow':
        return new SiliconFlowService(
          providerConfig.apiKey,
          modelToUse,
          customBaseUrl, // 🆕 传递自定义URL
          systemPromptConfig
        );

      default:
        throw new Error(`不支持的AI服务提供商: ${provider}`);
    }
  }

  /**
   * 获取默认服务实例
   */
  static getDefaultService(plugin: WeavePlugin): IAIService {
    const aiConfig = plugin.settings.aiConfig;

    if (!aiConfig) {
      throw new Error('AI配置未初始化');
    }

    return this.createService(aiConfig.defaultProvider, plugin);
  }
}


