<script lang="ts">
  import type { WeavePlugin } from '../../main';
  import type { PromptTemplate, AIProvider } from '../../types/ai-types';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import { Menu } from 'obsidian';
  import { AI_PROVIDER_LABELS, AI_MODEL_OPTIONS } from '../settings/constants/settings-constants';

  interface Props {
    plugin: WeavePlugin;
    selectedPrompt: PromptTemplate | null;
    customPrompt: string;
    selectedProvider: AIProvider;
    selectedModel: string;
    onPromptSelect: (prompt: PromptTemplate | null) => void;
    onCustomPromptChange: (prompt: string) => void;
    onProviderModelChange: (provider: AIProvider, model: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    disabled: boolean;
    refreshKey?: number; // 刷新键，用于强制刷新提示词列表
  }

  let {
    plugin,
    selectedPrompt = $bindable(),
    customPrompt = $bindable(),
    selectedProvider,
    selectedModel,
    onPromptSelect,
    onCustomPromptChange,
    onProviderModelChange,
    onGenerate,
    isGenerating,
    disabled,
    refreshKey = 0
  }: Props = $props();

  // 输入框引用
  let textareaElement = $state<HTMLTextAreaElement | undefined>(undefined);

  // 获取提示词模板（依赖refreshKey以触发刷新）
  let officialPrompts = $derived<PromptTemplate[]>((() => {
    refreshKey; // 使refreshKey成为依赖项
    return (plugin.settings.aiConfig?.promptTemplates.official || []).map(p => ({
      ...p,
      category: 'official' as const,
      useBuiltinSystemPrompt: true
    }));
  })());
  
  let customPrompts = $derived<PromptTemplate[]>((() => {
    refreshKey; // 使refreshKey成为依赖项
    return (plugin.settings.aiConfig?.promptTemplates.custom || []).map(p => ({
      ...p,
      category: 'custom' as const,
      useBuiltinSystemPrompt: true
    }));
  })());

  // 打开提示词选择菜单（使用 Obsidian Menu API）
  function openPromptMenu(event: MouseEvent) {
    const menu = new Menu();
    const target = event.target as HTMLElement;

    // 官方模板分组
    if (officialPrompts.length > 0) {
      officialPrompts.forEach(prompt => {
        menu.addItem((item) => {
          item
            .setTitle(prompt.name)
            .setIcon('message-square')
            .setChecked(selectedPrompt?.id === prompt.id)
            .onClick(() => {
              selectedPrompt = prompt;
              onPromptSelect(prompt);
            });
        });
      });
    }

    // 分隔线
    if (officialPrompts.length > 0 && customPrompts.length > 0) {
      menu.addSeparator();
    }

    // 自定义模板分组
    if (customPrompts.length > 0) {
      customPrompts.forEach(prompt => {
        menu.addItem((item) => {
          item
            .setTitle(prompt.name)
            .setIcon('file-text')
            .setChecked(selectedPrompt?.id === prompt.id)
            .onClick(() => {
              selectedPrompt = prompt;
              onPromptSelect(prompt);
            });
        });
      });
    }

    // 如果没有模板，显示提示
    if (officialPrompts.length === 0 && customPrompts.length === 0) {
      menu.addItem((item) => {
        item
          .setTitle('暂无可用模板')
          .setDisabled(true);
      });
    }

    // 所有提示词管理现已整合到AIConfigModal中

    menu.showAtMouseEvent(event);
  }

  // 打开AI服务商/模型选择菜单（悬停展开子菜单）
  function openProviderMenu(event: MouseEvent) {
    const menu = new Menu();
    
    // 获取settings中各provider的当前配置模型
    const aiConfig = plugin.settings.aiConfig;
    const apiKeys = (aiConfig?.apiKeys || {}) as Record<string, { model?: string } | undefined>;
    
    // 遍历所有AI服务商
    Object.entries(AI_MODEL_OPTIONS).forEach(([providerKey, models]) => {
      const provider = providerKey as AIProvider;
      menu.addItem((item) => {
        // 设置服务商标题，当前选中的显示勾选图标
        item
          .setTitle(AI_PROVIDER_LABELS[provider])
          .setIcon(selectedProvider === provider ? 'check' : '');
        
        // 使用setSubmenu实现悬停展开子菜单
        const submenu = (item as any).setSubmenu();
        
        // 检查settings中是否有自定义模型（不在静态列表中）
        const configuredModel = apiKeys[provider]?.model;
        const staticModelIds: string[] = models.map(m => m.id);
        if (configuredModel && !staticModelIds.includes(configuredModel)) {
          submenu.addItem((modelItem: any) => {
            modelItem
              .setTitle(configuredModel)
              .setIcon(selectedProvider === provider && selectedModel === configuredModel ? 'check' : '')
              .onClick(() => {
                onProviderModelChange(provider, configuredModel);
              });
          });
          submenu.addSeparator();
        }
        
        models.forEach(model => {
          submenu.addItem((modelItem: any) => {
            modelItem
              .setTitle(model.label)
              .setIcon(selectedProvider === provider && selectedModel === model.id ? 'check' : '')
              .onClick(() => {
                onProviderModelChange(provider, model.id);
              });
          });
        });
      });
    });
    
    menu.showAtMouseEvent(event);
  }

  // 处理自定义提示词输入
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    customPrompt = target.value;
    onCustomPromptChange(target.value);
    
    // 清除选中的模板
    if (target.value && selectedPrompt) {
      selectedPrompt = null;
      onPromptSelect(null);
    }
    
    // 自动调整高度
    adjustTextareaHeight();
  }

  // 自动调整 textarea 高度
  function adjustTextareaHeight() {
    if (!textareaElement) return;
    
    // 重置高度以获取正确的 scrollHeight
    textareaElement.style.height = '36px';
    
    // 计算新高度（最小 36px，最大 120px）
    const newHeight = Math.min(Math.max(textareaElement.scrollHeight, 36), 120);
    textareaElement.style.height = `${newHeight}px`;
  }

  // 处理键盘事件
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter 键提交（不按 Shift）
      event.preventDefault();
      if (!disabled && !isGenerating) {
        onGenerate();
      }
    }
    // Shift + Enter 允许换行（默认行为）
  }

  // 监听 customPrompt 变化，调整高度
  $effect(() => {
    if (customPrompt !== undefined) {
      adjustTextareaHeight();
    }
  });
</script>

<div class="prompt-footer">
  <!-- 提示词选择按钮 -->
  <button
    class="prompt-selector-btn"
    onclick={openPromptMenu}
    title="选择提示词模板"
  >
    <ObsidianIcon name="message-square" size={14} />
    <span class="prompt-selector-text">
      {selectedPrompt ? selectedPrompt.name : '选择提示词'}
    </span>
    <ObsidianIcon name="chevron-down" size={12} />
  </button>

  <!-- AI服务商/模型选择按钮 -->
  <button
    class="ai-provider-selector-btn"
    onclick={openProviderMenu}
    title="选择AI服务商和模型"
  >
    <ObsidianIcon name="cpu" size={14} />
    <span class="provider-text">
      {AI_PROVIDER_LABELS[selectedProvider]} · {selectedModel}
    </span>
    <ObsidianIcon name="chevron-down" size={12} />
  </button>

  <!-- 自定义提示词输入框 -->
  <textarea
    bind:this={textareaElement}
    class="prompt-textarea"
    placeholder="或输入自定义提示词..."
    value={customPrompt}
    oninput={handleInput}
    onkeydown={handleKeyDown}
  ></textarea>

  <!-- 生成按钮 -->
  <button
    class="generate-btn"
    onclick={onGenerate}
    disabled={disabled || isGenerating}
    title={disabled ? '请先输入内容' : '生成AI卡片'}
  >
    {#if isGenerating}
      <ObsidianIcon name="loader" size={16} />
      <span>生成中...</span>
    {:else}
      <ObsidianIcon name="sparkles" size={16} />
      <span>点击生成</span>
    {/if}
  </button>
</div>

<style>
  /* ===== CSS 变量定义 ===== */
  :root {
    --prompt-footer-height: 36px;
    --prompt-footer-gap: 8px;
    --prompt-footer-padding: 12px;
    --prompt-footer-radius: 6px;
  }

  /* ===== 主容器 ===== */
  .prompt-footer {
    display: flex;
    align-items: flex-start; /* 改为 flex-start 以支持 textarea 动态高度 */
    gap: var(--prompt-footer-gap);
    padding: var(--prompt-footer-padding);
    padding-bottom: 16px; /* 固定底部间距 */
    background: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
    flex-shrink: 0; /* 防止被压缩 */
  }

  /* ===== 提示词选择按钮 ===== */
  .prompt-selector-btn,
  .ai-provider-selector-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--prompt-footer-height);
    padding: 0 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--prompt-footer-radius);
    color: var(--text-normal);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .prompt-selector-btn:hover,
  .ai-provider-selector-btn:hover {
    background: var(--background-primary-alt);
    border-color: var(--interactive-accent);
  }

  .prompt-selector-btn:active,
  .ai-provider-selector-btn:active {
    transform: scale(0.98);
  }

  .prompt-selector-text,
  .provider-text {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== 自定义提示词输入框 ===== */
  .prompt-textarea {
    flex: 1;
    min-width: 0;
    min-height: var(--prompt-footer-height);
    max-height: 120px;
    padding: 8px 12px;
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: var(--prompt-footer-radius);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    overflow-y: auto;
  }

  .prompt-textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
  }

  .prompt-textarea::placeholder {
    color: var(--text-muted);
  }

  /* ===== 生成按钮 ===== */
  .generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--prompt-footer-height);
    padding: 0 20px;
    background: var(--interactive-accent);
    border: none;
    border-radius: var(--prompt-footer-radius);
    color: var(--text-on-accent);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .generate-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* ===== 加载动画 ===== */
  .generate-btn :global(.lucide-loader) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== 响应式设计 ===== */
  @media (max-width: 768px) {
    .prompt-footer {
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 10px 12px;
    }

    .prompt-textarea {
      order: 1;
      flex: 1 1 100%;
    }

    .ai-provider-selector-btn {
      order: 2;
      flex: 1;
      min-width: 0;
      justify-content: center;
    }

    .prompt-selector-btn {
      order: 3;
      flex: 1;
      min-width: 0;
      justify-content: center;
    }

    .generate-btn {
      order: 4;
      flex: 1;
    }

    .prompt-selector-text,
    .provider-text {
      max-width: 80px;
    }
  }
</style>
