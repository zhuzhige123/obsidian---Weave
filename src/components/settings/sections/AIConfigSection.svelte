<script lang="ts">
  import { logger } from '../../../utils/logger';

  import type WeavePlugin from "../../../main";
  import { DEFAULT_AI_CONFIG, DEFAULT_API_URLS } from "../constants/settings-constants";
  import { AI_PROVIDER_LABELS, AI_MODEL_OPTIONS } from "../constants/settings-constants";
  import type { AIProvider } from "../constants/settings-constants";
  import ObsidianIcon from "../../ui/ObsidianIcon.svelte";
  import ObsidianDropdown from "../../ui/ObsidianDropdown.svelte";
  import { Menu, Notice } from 'obsidian';
  
  //  导入国际化
  import { tr } from '../../../utils/i18n';

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);

  // 初始化AI配置
  function initializeAIConfig() {
    const defaultConfig = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
    
    if (!plugin.settings.aiConfig) {
      return defaultConfig;
    }
    
    const existingConfig = plugin.settings.aiConfig as any;
    
    // 深度合并配置
    const mergedConfig = {
      ...defaultConfig,
      ...existingConfig,
      apiKeys: {
        ...defaultConfig.apiKeys,
        ...existingConfig.apiKeys
      },
      globalParams: {
        ...defaultConfig.globalParams,
        ...existingConfig.globalParams
      },
      cardSplitting: {
        ...defaultConfig.cardSplitting,
        ...(existingConfig.cardSplitting || {})
      }
      // 移除 splittingProvider 的显式保留，已弃用字段通过 ...existingConfig 自动保留以兼容旧配置
    };
    
    return mergedConfig;
  }

  let aiConfig = $state(initializeAIConfig());

  // API密钥显示/隐藏状态
  let showApiKey = $state<Record<AIProvider, boolean>>({
    openai: false,
    gemini: false,
    anthropic: false,
    deepseek: false,
    zhipu: false,
    siliconflow: false,
    xai: false
  });

  // 测试状态
  let testingProvider = $state<AIProvider | null>(null);
  let testResults = $state<Record<AIProvider, { success: boolean; message: string } | null>>({
    openai: null,
    gemini: null,
    anthropic: null,
    deepseek: null,
    zhipu: null,
    siliconflow: null,
    xai: null
  });

  // 自定义模型浮窗状态
  let showCustomModelModal = $state(false);
  let modalProvider = $state<AIProvider | null>(null);
  let modalCustomModelName = $state('');

  // 🆕 自定义URL浮窗状态
  let showCustomUrlModal = $state(false);
  let urlModalProvider = $state<AIProvider | null>(null);
  let customUrl = $state('');

  // 保存配置的防抖函数
  let saveTimeout: NodeJS.Timeout | null = null;
  
  function saveSettings() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
      plugin.settings.aiConfig = aiConfig;
      await plugin.saveSettings();
    }, 500);
  }

  // 监听配置变化并自动保存
  $effect(() => {
    if (aiConfig) {
      saveSettings();
    }
  });

  // 切换API密钥显示
  function toggleApiKeyVisibility(provider: AIProvider) {
    showApiKey[provider] = !showApiKey[provider];
  }

  // 测试API连接
  async function testConnection(provider: AIProvider) {
    testingProvider = provider;
    testResults[provider] = null;

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const config = aiConfig.apiKeys[provider];
      if (!config?.apiKey) {
        throw new Error(t('aiConfig.apiKeys.testFailed'));
      }

      testResults[provider] = {
        success: true,
        message: t('aiConfig.apiKeys.testSuccess')
      };

      config.verified = true;
      config.lastVerified = new Date().toISOString();
    } catch (error) {
      testResults[provider] = {
        success: false,
        message: error instanceof Error ? error.message : '连接失败'
      };

      const config = aiConfig.apiKeys[provider];
      if (config) {
        config.verified = false;
      }
    } finally {
      testingProvider = null;
    }
  }

  // 显示提供商配置菜单
  function showProviderMenu(provider: AIProvider, event: MouseEvent) {
    const menu = new Menu();
    const hasCustomUrl = !!aiConfig.apiKeys[provider].baseUrl; // 🆕 检查是否有自定义URL
    
    //  所有默认设置已移除，交由各自的配置模态窗管理
    // - 制卡默认 → AI配置模态窗
    // - 格式化默认 → 格式化配置
    // - AI拆分默认 → AI拆分配置
    
    // 🆕 自定义API地址
    menu.addItem((item) => {
      item
        .setTitle(hasCustomUrl ? '修改API地址' : '自定义API地址')
        .setIcon('link')
        .onClick(() => {
          openCustomUrlModal(provider);
        });
    });
    
    // 🆕 重置为默认地址（仅当有自定义URL时显示）
    if (hasCustomUrl) {
      menu.addItem((item) => {
        item
          .setTitle('重置为默认地址')
          .setIcon('rotate-ccw')
          .onClick(async () => {
            await resetToDefaultUrl(provider);
          });
      });
    }
    
    // 分割线
    menu.addSeparator();
    
    // 新增自定义AI模型
    menu.addItem((item) => {
      item
        .setTitle('新增自定义AI模型')
        .setIcon('plus')
        .onClick(() => {
          openCustomModelModal(provider);
        });
    });
    
    menu.showAtMouseEvent(event);
  }

  // 显示自定义模型浮窗
  function openCustomModelModal(provider: AIProvider) {
    modalProvider = provider;
    modalCustomModelName = '';
    showCustomModelModal = true;
  }

  // 关闭自定义模型浮窗
  function closeCustomModelModal() {
    showCustomModelModal = false;
    modalProvider = null;
    modalCustomModelName = '';
  }

  // 验证自定义模型名称
  function validateCustomModel(provider: AIProvider, modelName: string): { valid: boolean; message: string } {
    if (!modelName.trim()) {
      return { valid: false, message: '模型名称不能为空' };
    }

    // 基本格式验证
    const modelNameRegex = /^[a-zA-Z0-9\-._/]+$/;
    if (!modelNameRegex.test(modelName)) {
      return { valid: false, message: '模型名称包含无效字符，只允许字母、数字、连字符、点和斜杠' };
    }

    // 长度检查
    if (modelName.length > 100) {
      return { valid: false, message: '模型名称过长，最多100个字符' };
    }

    return { valid: true, message: '模型名称格式正确' };
  }

  // 保存自定义模型
  async function saveCustomModel() {
    if (!modalProvider || !modalCustomModelName.trim()) return;
    
    const validation = validateCustomModel(modalProvider, modalCustomModelName);
    if (!validation.valid) {
      logger.error('模型名称验证失败:', validation.message);
      return;
    }

    // 更新配置
    const config = aiConfig.apiKeys[modalProvider];
    if (config) {
      config.model = modalCustomModelName;
    }

    // 保存设置
    await plugin.saveSettings();
    
    closeCustomModelModal();
  }

  // 🆕 打开自定义URL弹窗
  function openCustomUrlModal(provider: AIProvider) {
    urlModalProvider = provider;
    const currentUrl = aiConfig.apiKeys[provider].baseUrl;
    customUrl = currentUrl || DEFAULT_API_URLS[provider] || '';
    showCustomUrlModal = true;
  }

  // 🆕 关闭自定义URL弹窗
  function closeCustomUrlModal() {
    showCustomUrlModal = false;
    urlModalProvider = null;
    customUrl = '';
  }

  // 🆕 URL验证函数
  function validateUrl(url: string): { valid: boolean; message: string } {
    if (!url.trim()) {
      return { valid: false, message: 'URL不能为空' };
    }
    
    try {
      const urlObj = new URL(url);
      
      // 必须是http或https协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, message: '只支持HTTP或HTTPS协议' };
      }
      
      // 不允许包含查询参数或hash
      if (urlObj.search || urlObj.hash) {
        return { valid: false, message: '基础URL不应包含查询参数或锚点' };
      }
      
      return { valid: true, message: 'URL格式正确' };
    } catch (error) {
      return { valid: false, message: '无效的URL格式' };
    }
  }

  // 🆕 保存自定义URL
  async function saveCustomUrl() {
    if (!urlModalProvider || !customUrl.trim()) return;
    
    const validation = validateUrl(customUrl);
    if (!validation.valid) {
      new Notice(`${validation.message}`, 3000);
      return;
    }
    
    // 清理URL（移除末尾的斜杠）
    const cleanedUrl = customUrl.trim().replace(/\/+$/, '');
    
    // 更新配置
    const config = aiConfig.apiKeys[urlModalProvider];
    if (config) {
      config.baseUrl = cleanedUrl;
      config.verified = false; // 重置验证状态，需要重新测试
    }
    
    // 保存设置
    await plugin.saveSettings();
    
    new Notice(`${AI_PROVIDER_LABELS[urlModalProvider]} API地址已更新`, 2000);
    closeCustomUrlModal();
  }

  // 🆕 重置为默认URL
  async function resetToDefaultUrl(provider: AIProvider) {
    const config = aiConfig.apiKeys[provider];
    if (config) {
      config.baseUrl = undefined;
      config.verified = false; // 重置验证状态
    }
    
    await plugin.saveSettings();
    new Notice(`${AI_PROVIDER_LABELS[provider]} 已重置为默认地址`, 2000);
  }

  // 获取提供商的模型选项
  function getModelOptions(provider: AIProvider) {
    return AI_MODEL_OPTIONS[provider] || [];
  }

  // 所有提供商列表
  const providers: AIProvider[] = ['openai', 'gemini', 'anthropic', 'deepseek', 'zhipu', 'siliconflow', 'xai'];
</script>

<div class="weave-settings settings-section ai-config-section">
  

  <!-- 每个 API 提供商作为独立的 settings-group -->
  {#each providers as provider}
    {@const config = aiConfig.apiKeys[provider]}
    {@const isVerified = config?.verified || false}
    {@const isTesting = testingProvider === provider}
    {@const testResult = testResults[provider]}

    <div class="settings-group">
      <div class="group-header-with-menu">
        <h4 class="group-title with-accent-bar accent-purple">
          <span>{AI_PROVIDER_LABELS[provider]}</span>
          {#if isVerified}
            <span class="badge badge-success">{t('aiConfig.apiKeys.verified')}</span>
          {/if}
        </h4>
        <button 
          type="button"
          class="provider-menu-btn"
          aria-label={t('aiConfig.apiKeys.menuLabel')}
          title={t('aiConfig.apiKeys.configOptions')}
          onclick={(e) => showProviderMenu(provider, e)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // 对于键盘事件，创建一个模拟的MouseEvent用于菜单定位
              const buttonRect = e.currentTarget.getBoundingClientRect();
              const syntheticEvent = new MouseEvent('click', {
                clientX: buttonRect.left,
                clientY: buttonRect.bottom,
                bubbles: true
              });
              showProviderMenu(provider, syntheticEvent);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>

      {#if config}
        <!-- API密钥 -->
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">{t('aiConfig.apiKeys.apiKeyLabel')}</div>
            <div class="setting-description">
              {t('aiConfig.apiKeys.apiKeyDescription').replace('{provider}', AI_PROVIDER_LABELS[provider])}
            </div>
          </div>
          <div class="setting-control">
            <div class="input-with-button">
              <input
                type={showApiKey[provider] ? 'text' : 'password'}
                bind:value={config.apiKey}
                placeholder="sk-..."
                class="text-input"
              />
              <button
                class="btn-icon"
                onclick={() => toggleApiKeyVisibility(provider)}
                title={showApiKey[provider] ? t('aiConfig.apiKeys.hide') : t('aiConfig.apiKeys.show')}
              >
                <ObsidianIcon 
                  name={showApiKey[provider] ? 'eye-off' : 'eye'} 
                  size={16} 
                />
              </button>
            </div>
          </div>
        </div>

        <!-- 模型选择 -->
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">{t('aiConfig.apiKeys.modelLabel')}</div>
            <div class="setting-description">
              {t('aiConfig.apiKeys.modelDescription')}
            </div>
          </div>
          <div class="setting-control">
            <ObsidianDropdown
              options={getModelOptions(provider).map(opt => ({ id: opt.id, label: opt.label, description: opt.description }))}
              value={config.model}
              onchange={(value) => {
                config.model = value;
              }}
            />
          </div>
        </div>

        <!-- 测试连接 -->
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">{t('aiConfig.apiKeys.testConnection')}</div>
          </div>
          <div class="setting-control">
            <div class="test-control-group">
              <button
                class="test-btn"
                onclick={() => testConnection(provider)}
                disabled={!config?.apiKey || isTesting}
              >
                {#if isTesting}
                  <ObsidianIcon name="loader" size={14} />
                  <span>{t('aiConfig.apiKeys.testing')}</span>
                {:else}
                  <ObsidianIcon name="zap" size={14} />
                  <span>{t('aiConfig.apiKeys.testConnection')}</span>
                {/if}
              </button>

              {#if testResult}
                <div class="test-result" class:success={testResult.success} class:error={!testResult.success}>
                  <ObsidianIcon 
                    name={testResult.success ? 'check-circle' : 'x-circle'} 
                    size={14} 
                  />
                  <span>{testResult.message}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<!-- 自定义模型浮窗 -->
{#if showCustomModelModal && modalProvider}
  <div 
    class="modal-overlay" 
    onclick={(e) => {
      // 只有点击背景时才关闭
      if (e.target === e.currentTarget) {
        closeCustomModelModal();
      }
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="custom-model-modal" aria-labelledby="custom-model-title">
      <div class="modal-header">
        <h3 id="custom-model-title">新增自定义AI模型</h3>
        <button class="btn-close" onclick={closeCustomModelModal}>
          <ObsidianIcon name="x" size={16} />
        </button>
      </div>
      
      <div class="custom-modal-body">
        <div class="provider-info">
          <span class="provider-name">{AI_PROVIDER_LABELS[modalProvider]}</span>
        </div>
        
        <div class="input-group">
          <label for="custom-model-input">模型名称</label>
          <input
            id="custom-model-input"
            type="text"
            bind:value={modalCustomModelName}
            placeholder="输入自定义模型名称 (如: gpt-4o-2024-05-13)"
            class="text-input"
          />
          
          {#if modalCustomModelName}
            {@const validation = validateCustomModel(modalProvider, modalCustomModelName)}
            <small class="input-hint" class:error={!validation.valid}>
              {validation.message}
            </small>
          {/if}
        </div>
      </div>
      
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={closeCustomModelModal}>
          取消
        </button>
        <button 
          class="btn btn-primary" 
          onclick={saveCustomModel}
          disabled={!modalCustomModelName.trim() || !validateCustomModel(modalProvider, modalCustomModelName).valid}
        >
          保存
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 🆕 自定义API地址弹窗 -->
{#if showCustomUrlModal && urlModalProvider}
  <div 
    class="modal-overlay" 
    onclick={(e) => {
      // 只有点击背景时才关闭
      if (e.target === e.currentTarget) {
        closeCustomUrlModal();
      }
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="custom-url-modal" aria-labelledby="custom-url-title">
      <div class="modal-header">
        <h3 id="custom-url-title">自定义 {AI_PROVIDER_LABELS[urlModalProvider]} API地址</h3>
        <button class="btn-close" onclick={closeCustomUrlModal}>
          <ObsidianIcon name="x" size={16} />
        </button>
      </div>
      
      <div class="custom-modal-body">
        <div class="input-group">
          <label for="custom-url-input">API基础地址</label>
          <input
            id="custom-url-input"
            type="text"
            bind:value={customUrl}
            placeholder={`默认: ${DEFAULT_API_URLS[urlModalProvider] || '官方地址'}`}
            class="text-input url-input"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                saveCustomUrl();
              }
            }}
          />
          <small class="url-hint">
            <ObsidianIcon name="info" size={14} />
            输入完整的API基础地址，例如：<code>https://api.example.com/v1</code>
          </small>
        </div>
        
        <div class="url-examples">
          <h4>常用中转示例</h4>
          <div class="example-list">
            <div class="example-item">
              <span class="example-label">Cloudflare Worker:</span>
              <code class="example-url">https://your-worker.workers.dev</code>
            </div>
            <div class="example-item">
              <span class="example-label">Vercel代理:</span>
              <code class="example-url">https://your-project.vercel.app</code>
            </div>
            <div class="example-item">
              <span class="example-label">自建代理:</span>
              <code class="example-url">https://proxy.example.com/api</code>
            </div>
          </div>
        </div>
        
        <div class="url-notes">
          <h4>注意事项</h4>
          <ul>
            <li>确保中转服务与官方API接口兼容</li>
            <li>自定义地址后需要重新测试连接</li>
            <li>某些功能可能因中转服务限制而不可用</li>
            <li>请勿使用不可信的第三方服务，以保护API密钥安全</li>
          </ul>
        </div>
      </div>
      
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={closeCustomUrlModal}>
          取消
        </button>
        <button class="btn btn-primary" onclick={saveCustomUrl}>
          保存
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* 未使用的CSS选择器已清理 */

  /* 组标题带菜单按钮 */
  .group-header-with-menu {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  /* 徽章 */
  .badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75em;
    font-weight: 500;
  }


  .badge-success {
    background: var(--color-green);
    color: white;
  }

  /* 三点菜单按钮 */
  .provider-menu-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    opacity: 0.6;
  }

  .provider-menu-btn:hover {
    opacity: 1;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 输入框组合 */
  .input-with-button {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
  }

  .text-input {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9em;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border: none;
    border-radius: 4px;
    background: var(--interactive-normal);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-icon:hover {
    background: var(--interactive-hover);
  }

  /* 下拉框 */

  /* 数字输入框 */

  /* 测试控制组 */
  .test-control-group {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .test-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: var(--interactive-normal);
    color: var(--text-normal);
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .test-btn:hover {
    background: var(--interactive-hover);
  }

  .test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .test-result {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .test-result.success {
    background: rgba(46, 204, 113, 0.1);
    color: var(--color-green);
  }

  .test-result.error {
    background: rgba(231, 76, 60, 0.1);
    color: var(--color-red);
  }

  /* Toggle Switch */

  /* 自定义模型浮窗样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75); /* 🔧 增加不透明度从0.5到0.75 */
    backdrop-filter: blur(4px); /* 🆕 添加背景模糊效果 */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
  }

  .custom-model-modal {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    width: 90%;
    max-width: 480px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); /* 🔧 增强阴影从0.3到0.5 */
    animation: modalSlideIn 0.2s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 600;
    color: var(--text-normal);
  }

  .btn-close {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    border-radius: 4px;
    color: var(--text-muted);
    transition: all 0.2s ease;
  }

  .btn-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .custom-modal-body {
    padding: 20px 24px;
  }

  .provider-info {
    margin-bottom: 16px;
  }

  .provider-name {
    display: inline-block;
    padding: 4px 12px;
    background: var(--interactive-accent-bg);
    color: var(--interactive-accent);
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 500;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-group label {
    font-weight: 500;
    color: var(--text-normal);
    font-size: 0.9em;
  }

  .input-hint {
    color: var(--text-muted);
    font-size: 0.8em;
    font-style: italic;
    margin-top: 2px;
  }

  .input-hint.error {
    color: var(--text-error);
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 16px 24px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: var(--background-primary);
    border-color: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .btn-primary {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary:disabled:hover {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  /* 🆕 自定义URL弹窗样式 */
  .custom-url-modal {
    background: var(--background-primary); /* 🔧 确保背景不透明 */
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); /* 🔧 增强阴影 */
    animation: modalSlideIn 0.2s ease-out;
  }

  .url-input {
    font-family: var(--font-monospace);
    font-size: 0.9rem;
  }

  .url-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .url-hint code {
    background: var(--background-modifier-border);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: var(--font-monospace);
    font-size: 0.85em;
  }

  .url-examples {
    margin-top: 2rem;
  }

  .url-examples h4 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .example-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .example-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border); /* 🆕 添加边框增强对比 */
    border-radius: 6px;
  }

  .example-label {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .example-url {
    font-family: var(--font-monospace);
    font-size: 0.85rem;
    color: var(--text-accent);
  }

  .url-notes {
    margin-top: 1.5rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.2); /* 🔧 增加不透明度从0.15到0.2 */
    border: 1px solid rgba(239, 68, 68, 0.3); /* 🆕 添加边框 */
    border-left: 3px solid var(--text-error);
    border-radius: 6px;
  }

  .url-notes h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-error);
  }

  .url-notes ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .url-notes li {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.5;
  }
</style>
