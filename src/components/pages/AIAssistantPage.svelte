<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import type { WeaveDataStorage } from '../../data/storage';
  import type { FSRS } from '../../algorithms/fsrs';
  import type {
    ObsidianFileInfo,
    PromptTemplate,
    GenerationConfig,
    GenerationProgress,
    GeneratedCard,
    AIProvider
  } from '../../types/ai-types';
  
  import FileSelector from '../ai-assistant/FileSelector.svelte';
  import ContentEditor from '../ai-assistant/ContentEditor.svelte';
  import PromptFooter from '../ai-assistant/PromptFooter.svelte';
  import ProgressIndicator from '../ai-assistant/ProgressIndicator.svelte';
  import AIConfigModal from '../ai-assistant/AIConfigModal.svelte';
  import CardPreviewModal from '../ai-assistant/CardPreviewModal.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import MobileAIAssistantHeader from '../study/MobileAIAssistantHeader.svelte';
  // MobileAIAssistantMenu 已移除 - 现在使用 Obsidian Menu API
  
  import { AICardGenerationService } from '../../services/ai/AICardGenerationService';
  import { Notice, Menu } from 'obsidian';
  import { tr } from '../../utils/i18n';

  interface Props {
    plugin: WeavePlugin;
    dataStorage: WeaveDataStorage;
    fsrs: FSRS;
    onNavigate?: (page: string) => void;
  }

  let { plugin, dataStorage, fsrs, onNavigate }: Props = $props();
  let t = $derived($tr);

  // ===== 状态管理 =====
  let selectedFile = $state<ObsidianFileInfo | null>(null);
  let content = $state('');
  let selectedPrompt = $state<PromptTemplate | null>(null);
  let customPrompt = $state('');

  let fileLoadSeq = 0;
  
  // 生成状态
  let isGenerating = $state(false);
  let generationProgress = $state<GenerationProgress | null>(null);
  let generatedCards = $state<GeneratedCard[]>([]);
  
  // 配置状态
  let showConfigModal = $state(false);
  let showPreviewModal = $state(false);
  let generationConfig = $state<GenerationConfig>({
    templateId: '',
    promptTemplate: '',
    cardCount: 10,
    difficulty: 'medium',
    typeDistribution: { qa: 50, cloze: 30, choice: 20 },
    //  优先使用上次保存的provider和model
    provider: (plugin.settings.aiConfig?.lastUsedProvider || plugin.settings.aiConfig?.defaultProvider || 'openai') as AIProvider,
    model: plugin.settings.aiConfig?.lastUsedModel || '',
    temperature: 0.7,
    maxTokens: 2000,
    imageGeneration: {
      enabled: false,
      strategy: 'none',
      imagesPerCard: 0,
      placement: 'question'
    },
    // 使用官方模板作为默认值
    templates: {
      qa: 'official-qa',
      choice: 'official-choice',
      cloze: 'official-cloze'
    },
    autoTags: [],
    enableHints: true
  });
  
  // 空状态 - 已移除，编辑器始终显示
  // let showEmptyState = $derived(!selectedFile && !content);

  // ===== 文件操作 =====
  async function handleFileSelect(file: ObsidianFileInfo) {
    const seq = ++fileLoadSeq;
    selectedFile = file;
    try {
      const fileContent = await plugin.app.vault.read(file.file);
      if (seq !== fileLoadSeq) return;
      if (selectedFile?.path !== file.path) return;
      content = fileContent;
    } catch (error) {
      new Notice('读取文件失败');
      logger.error('Failed to read file:', error);
    }
  }

  function handleClearContent() {
    content = '';
  }

  async function handleReloadFile() {
    if (selectedFile) {
      const file = selectedFile;
      const seq = ++fileLoadSeq;
      try {
        const fileContent = await plugin.app.vault.read(file.file);
        if (seq !== fileLoadSeq) return;
        if (selectedFile?.path !== file.path) return;
        content = fileContent;
        new Notice('文件已重新加载');
      } catch (error) {
        new Notice('重新加载文件失败');
        logger.error('Failed to reload file:', error);
      }
    }
  }

  // ===== 提示词操作 =====
  function handlePromptSelect(prompt: PromptTemplate | null) {
    selectedPrompt = prompt;
    if (prompt) {
      customPrompt = '';
    }
  }

  function handleCustomPromptChange(prompt: string) {
    customPrompt = prompt;
  }

  // ===== AI生成（使用独立服务）=====
  const generationService = new AICardGenerationService(plugin);

  async function handleGenerate() {
    try {
      isGenerating = true;
      generatedCards = [];
      showPreviewModal = true;

      const result = await generationService.generateCards(
        content,
        generationConfig,
        selectedPrompt,
        customPrompt,
        {
          onProgress: (progress) => {
            generationProgress = progress;
          },
          onCardsUpdate: (cards) => {
            generatedCards = cards;
          }
        }
      );

      generatedCards = result;

      // 延迟后清除进度
      setTimeout(() => {
        generationProgress = null;
      }, 1000);

    } catch (error) {
      logger.error('Generation failed:', error);
      new Notice(error instanceof Error ? error.message : 'AI生成失败');

      if (generationProgress) {
        generationProgress = {
          status: 'failed',
          progress: 0,
          message: error instanceof Error ? error.message : '生成失败'
        };
      }
    } finally {
      isGenerating = false;
    }
  }

  // ===== 配置模态窗 =====
  function handleOpenConfig() {
    showConfigModal = true;
  }

  function handleCloseConfig() {
    showConfigModal = false;
  }

  // 所有提示词管理现已集成到AIConfigModal中

  function handleSaveConfig(config: GenerationConfig) {
    generationConfig = config;
    showConfigModal = false;
    new Notice('配置已保存');
  }

  // ===== AI服务商/模型选择 =====
  async function handleProviderModelChange(provider: AIProvider, model: string) {
    generationConfig = {
      ...generationConfig,
      provider,
      model
    };
    
    //  持久化AI模型选择
    if (plugin.settings.aiConfig) {
      plugin.settings.aiConfig.lastUsedProvider = provider;
      plugin.settings.aiConfig.lastUsedModel = model;
      await plugin.saveSettings();
    }
    
    new Notice(`已切换到 ${provider} · ${model}`);
  }

  // ===== 卡片预览模态窗 =====
  function handleClosePreview() {
    showPreviewModal = false;
  }

  async function handleImportCards(selectedCards: GeneratedCard[], targetDeckId: string) {
    try {
      // 获取目标牌组（现在使用ID）
      const deck = await dataStorage.getDeck(targetDeckId);
      
      if (!deck) {
        throw new Error(`牌组不存在`);
      }

      logger.debug('Starting import to deck:', deck.name, selectedCards);

      // 动态导入 CardConverter 服务
      const { CardConverter } = await import('../../services/ai/CardConverter');
      
      // 批量转换 GeneratedCard 为 Card 格式
      const { cards, errors } = CardConverter.convertBatch(
        selectedCards,
        targetDeckId,
        selectedFile?.path, // 源文件路径
        generationConfig.templates, // 传递模板配置
        plugin.fsrs // 传递 FSRS 实例，确保数据结构标准化
      );
      
      logger.debug('Converted cards:', cards.length, 'Errors:', errors.length);
      
      if (errors.length > 0) {
        logger.warn('Card conversion errors:', errors);
      }
      
      // 逐个保存卡片
      let successCount = 0;
      let failCount = 0;
      
      for (const card of cards) {
        try {
          await dataStorage.saveCard(card);
          successCount++;
          logger.debug('Saved card:', card.uuid);
        } catch (error) {
          failCount++;
          logger.error('Failed to save card:', card.uuid, error);
        }
      }
      
      logger.debug(`Import completed: ${successCount} success, ${failCount} failed`);
      
      // 显示结果通知
      if (successCount > 0) {
        new Notice(`成功导入 ${successCount} 张卡片到 ${deck.name}`);
        
        //  已移除旧的 CustomEvent 触发
        // 现在通过 DataSyncService 在 saveCard 时自动通知
      }
      
      if (failCount > 0 || errors.length > 0) {
        new Notice(`导入失败 ${failCount + errors.length} 张卡片`, 5000);
      }
      
      if (successCount === 0) {
        throw new Error('没有卡片成功导入');
      }
    } catch (error) {
      logger.error('Import cards failed:', error);
      throw error;
    }
  }

  // ===== 移动端菜单操作 - 使用 Obsidian Menu API =====
  function handleMobileMenuClick(evt: MouseEvent) {
    showMobileNavMenuWithObsidianAPI(evt);
  }

  //  使用 Obsidian 原生 Menu API 显示移动端导航菜单
  function showMobileNavMenuWithObsidianAPI(evt: MouseEvent) {
    const menu = new Menu();
    
    // 功能切换分组
    menu.addItem((item) => {
      item
        .setTitle('牌组学习')
        .setIcon('graduation-cap')
        .onClick(() => {
          window.dispatchEvent(new CustomEvent('Weave:navigate', { 
            detail: 'deck-study' 
          }));
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('卡片管理')
        .setIcon('list')
        .onClick(() => {
          window.dispatchEvent(new CustomEvent('Weave:navigate', { 
            detail: 'weave-card-management' 
          }));
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('AI助手')
        .setIcon('bot')
        .setChecked(true)
        .onClick(() => {
          // 已在AI助手界面，无需操作
        });
    });
    
    menu.addSeparator();
    
    // AI 操作分组
    menu.addItem((item) => {
      item
        .setTitle('选择文件')
        .setIcon('folder')
        .onClick(() => {
          openNativeFilePicker();
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('生成卡片')
        .setIcon('sparkles')
        .setDisabled(!content.trim() || isGenerating)
        .onClick(() => {
          if (content.trim() && !isGenerating) {
            handleGenerate();
          }
        });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('AI 配置')
        .setIcon('settings')
        .onClick(() => {
          handleOpenConfig();
        });
    });
    
    menu.showAtMouseEvent(evt);
  }

  // 使用 Obsidian 原生文件选择器
  function openNativeFilePicker() {
    // 触发 FileSelector 组件的原生选择器
    const event = new CustomEvent('open-native-file-picker');
    document.dispatchEvent(event);
  }

  // ===== 生命周期 =====
  onMount(() => {
    logger.debug('AI Assistant Page mounted');
  });
</script>

<div class="ai-assistant-page">
  <!-- 移动端头部 -->
  <MobileAIAssistantHeader
    onMenuClick={handleMobileMenuClick}
    onConfigClick={handleOpenConfig}
  />

  <!-- 移动端菜单已移除 - 现在使用 Obsidian Menu API -->

  <!-- 桌面端顶部功能栏 -->
  <header class="ai-header desktop-only">
    <div class="header-left">
      <FileSelector 
        {plugin}
        bind:selectedFile
        onFileSelect={handleFileSelect}
      />
    </div>

    <div class="header-right">
      <button class="config-btn" title="配置" onclick={handleOpenConfig}>
        <ObsidianIcon name="settings" size={16} />
        <span>配置</span>
      </button>
    </div>
  </header>

  <!-- 主内容区 -->
  <main class="ai-main-content">
    <!-- 内容编辑器容器 - 始终显示 -->
    <div class="editor-wrapper">
      <ContentEditor
        bind:content
        {selectedFile}
        app={plugin.app}
        onClear={handleClearContent}
        onReload={handleReloadFile}
      />
    </div>

    <!-- 进度指示器 -->
    {#if generationProgress}
      <div class="progress-wrapper">
        <ProgressIndicator 
          progress={generationProgress} 
          onOpenPreview={() => { showPreviewModal = true; }}
        />
      </div>
    {/if}
  </main>

  <!-- 底部操作栏 -->
  <PromptFooter
    {plugin}
    bind:selectedPrompt
    bind:customPrompt
    selectedProvider={generationConfig.provider}
    selectedModel={generationConfig.model}
    onPromptSelect={handlePromptSelect}
    onCustomPromptChange={handleCustomPromptChange}
    onProviderModelChange={handleProviderModelChange}
    onGenerate={handleGenerate}
    {isGenerating}
    disabled={!content.trim() || isGenerating}
  />
</div>

<!-- 配置模态窗 -->
<AIConfigModal
  {plugin}
  config={generationConfig}
  isOpen={showConfigModal}
  onClose={handleCloseConfig}
  onSave={handleSaveConfig}
/>

<!-- 卡片预览模态窗 -->
<CardPreviewModal
  {plugin}
  cards={generatedCards}
  config={generationConfig}
  isOpen={showPreviewModal}
  isGenerating={isGenerating}
  totalCards={generationConfig.cardCount}
  mode="split"
  onClose={handleClosePreview}
  onImport={handleImportCards}
/>

<style>
  .ai-assistant-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
  }

  .ai-header {
    position: relative;  /* 修复：建立层叠上下文 */
    z-index: 10;  /* 修复：确保 header 在内容之上 */
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  /* 桌面端显示，移动端隐藏 */
  .desktop-only {
    display: flex;
  }

  :global(body.is-mobile) .desktop-only {
    display: none;
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .config-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--interactive-normal);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .config-btn:hover {
    background: var(--interactive-hover);
    border-color: var(--interactive-accent);
  }

  .ai-main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;  /* 移除所有padding，改用子元素margin */
    overflow: hidden;
    min-height: 0;
  }

  /* 编辑器包装器 - 始终显示，填满可用空间 */
  .editor-wrapper {
    flex: 1 1 auto;  /* 🔧 允许扩展填充所有可用空间 */
    display: flex;
    flex-direction: column;
    min-height: 200px;  /* 设置最小高度，确保编辑器有足够空间 */
    margin: 16px;  /* 添加margin替代父元素的padding */
  }

  /* 进度指示器包装器 */
  .progress-wrapper {
    margin: 12px 16px 16px 16px;  /* 顶、右、下、左 */
    flex-shrink: 0;
  }
</style>

