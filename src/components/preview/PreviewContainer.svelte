<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import type { Card } from '../../data/types';
  import type { EventRef, TFile } from 'obsidian';
  import { extractBodyContent, parseBlockId, parseObsidianLink } from '../../utils/yaml-utils';
  
  type FieldTemplate = any;
  import { ContentPreviewEngine, type PreviewData, type PreviewOptions, CardType } from './ContentPreviewEngine';
  import { AnimationController, type AnimationOptions } from './AnimationController';
  import { UnifiedCardType } from '../../types/unified-card-types';
  import type { WeavePlugin } from '../../main';
  import { logger } from '../../utils/logger';
  
  // 导入题型卡片组件
  import BasicQACard from './cards/BasicQACard.svelte';
  import ClozeCard from './cards/ClozeCard.svelte';
  import CardContentView from '../content/CardContentView.svelte';
  
  // 导入选择题解析器
  import type { ChoiceQuestion } from '../../parsing/choice-question-parser';
  import { parseCardContent } from '../../parsing/card-content-parser';
  
  //  导入图片遮罩集成服务
  import { ImageMaskIntegration } from '../../services/image-mask/ImageMaskIntegration';
  
  //  导入CardAccessor用于获取子卡片内容
  import { CardAccessor } from '../../services/progressive-cloze/CardAccessor';
  import { CardStoreAdapter } from '../../services/progressive-cloze/CardStoreAdapter';

  // Props
  interface Props {
    card: Card | null;
    template?: FieldTemplate;
    showAnswer: boolean;
    enableAnimations?: boolean;
    themeMode?: 'auto' | 'light' | 'dark';
    renderingMode?: 'performance' | 'quality';
    enableAnswerControls?: boolean;
    plugin: WeavePlugin;
    activeClozeOrdinal?: number; // 🆕 渐进式挖空：当前激活的挖空序号 (1-based)
    refreshTrigger?: number; // 🆕 强制刷新触发器，值改变时重新渲染
    onCardTypeDetected?: (cardType: UnifiedCardType) => void;
    onPreviewReady?: (previewData: PreviewData) => void;
    onAddToErrorBook?: () => void;
    onRemoveFromErrorBook?: () => void;
    currentResponseTime?: number;
  }

  let {
    card = $bindable(),
    template,
    showAnswer = $bindable(),
    enableAnimations = true,
    enableAnswerControls = true,
    themeMode = 'auto',
    renderingMode = 'performance',
    plugin,
    activeClozeOrdinal, // 🆕 渐进式挖空序号
    refreshTrigger = 0, // 🆕 刷新触发器
    onCardTypeDetected,
    onPreviewReady,
    onAddToErrorBook,
    onRemoveFromErrorBook,
    currentResponseTime
  }: Props = $props();


  // 状态管理
  let previewEngine: ContentPreviewEngine;
  let animationController = $state<AnimationController | undefined>(undefined);
  let containerElement: HTMLElement;
  let currentPreviewData: PreviewData | null = $state(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let effectiveCard: Card | null = $state(null);
  let sourceFilePathForEmbed: string | null = $state(null);
  let sourceModifyRef: EventRef | null = $state(null);

  // 响应式状态
  let lastCardId = $state<string | null>(null);
  let lastShowAnswer = $state(false);
  let lastAnswerControls = $state(enableAnswerControls);
  let lastRefreshTrigger = $state(0); // 🆕 跟踪上次的刷新触发器值

  let renderRequestId = $state(0);

  // 选择题状态
  let choiceQuestionData = $state<ChoiceQuestion | null>(null);
  let selectedOptions = $state<string[]>([]);
  
  //  图片遮罩集成
  let maskIntegration: ImageMaskIntegration;
  
  // 导出方法供外部访问选择题数据
  export function getChoiceQuestionData() {
    return {
      questionData: choiceQuestionData,
      selectedOptions,
      isChoiceQuestion: choiceQuestionData !== null
    };
  }

  onMount(() => {
    // 初始化预览引擎
    previewEngine = new ContentPreviewEngine(plugin);
    
    //  初始化图片遮罩集成
    maskIntegration = new ImageMaskIntegration(plugin.app);

    // 初始化动画控制器
    const animationOptions: AnimationOptions = {
      enableAnimations,
      reducedMotion: false,
      performanceMode: renderingMode === 'performance' ? 'performance' : 'quality'
    };
    animationController = new AnimationController(animationOptions);

    if (card) {
      lastCardId = card.uuid;
      lastShowAnswer = showAnswer;
      lastAnswerControls = enableAnswerControls;
      lastRefreshTrigger = refreshTrigger;
      renderPreview();
    }
  });

  onDestroy(() => {
    // 清理资源
    if (previewEngine) {
      previewEngine.clearCache();
    }
    if (animationController) {
      animationController.cleanup();
    }
    if (sourceModifyRef) {
      plugin.app.vault.offref(sourceModifyRef);
      sourceModifyRef = null;
    }
  });

  function parseBlockEmbedLink(value: string): { filePath: string; blockId: string } | null {
    if (!value) return null;
    const trimmed = value.trim();
    // 仅支持“整段内容就是一个链接”的数据源模式
    if (!/^!?\[\[[\s\S]+?\]\]$/.test(trimmed)) return null;

    const blockId = parseBlockId(trimmed);
    const filePath = parseObsidianLink(trimmed);
    if (!blockId || !filePath) return null;
    return { filePath, blockId };
  }

  function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function resolveTFileByPath(filePath: string): TFile | null {
    const abstract = plugin.app.vault.getAbstractFileByPath(filePath);
    if (abstract && (abstract as any).path && (abstract as any).extension === 'md') {
      return abstract as TFile;
    }
    if (!filePath.endsWith('.md')) {
      const alt = plugin.app.vault.getAbstractFileByPath(`${filePath}.md`);
      if (alt && (alt as any).path && (alt as any).extension === 'md') {
        return alt as TFile;
      }
    }
    return null;
  }

  async function readBlockMarkdownFromFile(filePath: string, blockId: string): Promise<string | null> {
    const file = resolveTFileByPath(filePath);
    if (!file) return null;

    const content = await plugin.app.vault.read(file);
    const lines = content.split('\n');

    const cache = plugin.app.metadataCache.getFileCache(file);
    const block = (cache as any)?.blocks?.[blockId];
    const pos = block?.position;

    // 优先：使用 Obsidian 的 blocks 位置信息精确提取
    if (pos?.start && pos?.end && typeof pos.start.line === 'number' && typeof pos.end.line === 'number') {
      const startLine: number = pos.start.line;
      const startCol: number = pos.start.col ?? 0;
      const endLine: number = pos.end.line;
      const endCol: number = pos.end.col ?? (lines[endLine]?.length ?? 0);

      if (startLine >= 0 && endLine >= startLine && startLine < lines.length) {
        const slice = lines.slice(startLine, Math.min(lines.length, endLine + 1));
        if (slice.length > 0) {
          slice[0] = slice[0].slice(startCol);
          slice[slice.length - 1] = slice[slice.length - 1].slice(0, endCol);
        }

        const joined = slice.join('\n');
        const cleaned = joined
          .replace(new RegExp(`\\s*\\^${escapeRegExp(blockId)}\\s*$`, 'm'), '')
          .trim();
        return cleaned || null;
      }
    }

    // 回退：扫描行尾 ^blockId（兼容 metadataCache 未命中情况）
    const idRegex = new RegExp(`\\^${escapeRegExp(blockId)}\\s*$`);
    const anyIdRegex = /^\s*\^[a-zA-Z0-9_-]+\s*$/;

    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (idRegex.test(lines[i])) {
        start = i;
        break;
      }
    }
    if (start === -1) return null;

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (anyIdRegex.test(lines[i])) {
        end = i;
        break;
      }
    }

    const slice = lines.slice(start, end);
    if (slice.length > 0) {
      slice[0] = slice[0].replace(new RegExp(`\\s*\\^${escapeRegExp(blockId)}\\s*$`), '').trimEnd();
    }

    return slice.join('\n').trim();
  }

  function ensureSourceModifyListener(nextFilePath: string | null) {
    if (sourceFilePathForEmbed === nextFilePath) {
      return;
    }

    if (sourceModifyRef) {
      plugin.app.vault.offref(sourceModifyRef);
      sourceModifyRef = null;
    }

    sourceFilePathForEmbed = nextFilePath;
    if (!nextFilePath) return;

    sourceModifyRef = plugin.app.vault.on('modify', (file) => {
      const f = file as any;
      if (f?.path && f.path === nextFilePath) {
        refreshPreview();
      }
    });
  }

  // 监听卡片变化并重新渲染
  $effect(() => {
    //  修复BUG: 只在卡片ID或答案控制变化时重新渲染
    // showAnswer变化不应清空selectedOptions，因此移除该条件
    // 🆕 添加refreshTrigger监听，支持强制刷新
    if (card && (card.uuid !== lastCardId || enableAnswerControls !== lastAnswerControls || refreshTrigger !== lastRefreshTrigger)) {
      if (!previewEngine) {
        return;
      }
      lastCardId = card.uuid;
      lastShowAnswer = showAnswer;
      lastAnswerControls = enableAnswerControls;
      lastRefreshTrigger = refreshTrigger; // 🆕 更新刷新触发器
      renderPreview();
    } else if (card && showAnswer !== lastShowAnswer) {
      //  仅更新状态跟踪，不重新渲染
      lastShowAnswer = showAnswer;
    }
  });
  
  //  监听卡片渲染完成，应用图片遮罩
  $effect(() => {
    if (card && currentPreviewData && containerElement && maskIntegration) {
      //  关键修复：立即缓存containerElement，避免异步操作中失效
      const cachedContainer = containerElement;
      
      // 等待 DOM 更新
      tick().then(async () => {
        try {
          
          // ⏳ 等待图片加载完成（ObsidianRenderer 使用异步渲染）
          // 尝试多次查找图片，最多等待 2 秒
          let attempts = 0;
          const maxAttempts = 20;
          const waitInterval = 100; // 100ms
          
          while (attempts < maxAttempts) {
            const images = cachedContainer.querySelectorAll('img');
            
            if (images.length > 0) {
              // 找到图片了，等待所有图片加载完成
              const imageLoadPromises = Array.from(images).map((img: HTMLImageElement) => {
                if (img.complete) {
                  return Promise.resolve();
                }
                return new Promise<null>((resolve) => {
                  img.addEventListener('load', () => resolve(null), { once: true });
                  img.addEventListener('error', () => resolve(null), { once: true });
                  // 超时保护
                  setTimeout(() => resolve(null), 1000);
                });
              });
              
              await Promise.all(imageLoadPromises);
              
              // 应用遮罩 - 🆕 启用交互模式（点击单个遮罩切换）
              const content = effectiveCard?.content || card.content || '';
              const enableInteractive = !showAnswer; // 仅在未显示答案时启用交互
              maskIntegration.applyMasksInContainer(cachedContainer, content, enableInteractive);
              return; // 成功应用，退出
            }
            
            // 等待一段时间后再试
            await new Promise(resolve => setTimeout(resolve, waitInterval));
            attempts++;
          }
          
        } catch (error) {
          logger.error('[PreviewContainer] 应用图片遮罩失败:', error);
        }
      });
    }
  });
  
  //  监听显示答案状态，揭示遮罩
  $effect(() => {
    if (showAnswer && containerElement && maskIntegration) {
      // 延迟一帧，确保状态更新后再揭示遮罩
      tick().then(() => {
        try {
          maskIntegration.revealAllMasks(containerElement, 300);
        } catch (error) {
          logger.error('[PreviewContainer] 揭示遮罩失败:', error);
        }
      });
    } else if (!showAnswer && containerElement && maskIntegration) {
      // 隐藏答案时，重新显示遮罩
      tick().then(() => {
        try {
          maskIntegration.showAllMasks(containerElement, false);
        } catch (error) {
          logger.error('[PreviewContainer] 显示遮罩失败:', error);
        }
      });
    }
  });

  /**
   * 解析卡片内容生成预览数据
   */
  async function renderPreview(): Promise<void> {
    if (!card || !previewEngine) {
      return;
    }

    const requestId = ++renderRequestId;

    // 切换卡片时不设置 isLoading，避免销毁/重建卡片组件导致视觉抖动
    // 仅在首次加载（无预览数据）时显示加载状态
    if (!currentPreviewData) {
      isLoading = true;
    }
    error = null;

    try {

      let cardForRender: Card = card;
      const rawContent = card.content || '';
      const bodyContent = extractBodyContent(rawContent).trim();
      const embed = parseBlockEmbedLink(rawContent) || parseBlockEmbedLink(bodyContent);

      if (embed) {
        const blockMarkdown = await readBlockMarkdownFromFile(embed.filePath, embed.blockId);
        if (blockMarkdown && blockMarkdown.trim()) {
          cardForRender = { ...card, content: blockMarkdown, sourceFile: embed.filePath } as Card;
        }
        ensureSourceModifyListener(embed.filePath);
      } else if (!rawContent.trim() && card.fields) {
        // 兼容旧数据：如果 content 为空且 fields.front 是块引用，把它当做 content 数据源
        const fieldFront = (card.fields as any).front || (card.fields as any).Front || (card.fields as any).question || '';
        const fieldEmbed = parseBlockEmbedLink(fieldFront);
        if (fieldEmbed) {
          const blockMarkdown = await readBlockMarkdownFromFile(fieldEmbed.filePath, fieldEmbed.blockId);
          if (blockMarkdown && blockMarkdown.trim()) {
            cardForRender = { ...card, content: blockMarkdown, sourceFile: fieldEmbed.filePath } as Card;
          }
          ensureSourceModifyListener(fieldEmbed.filePath);
        } else {
          ensureSourceModifyListener(null);
        }
      } else {
        ensureSourceModifyListener(null);
      }

      effectiveCard = cardForRender;

      // 1. 解析卡片内容生成预览数据
      const previewData = await previewEngine.parseCardContent(cardForRender, template);

      if (requestId !== renderRequestId) {
        return;
      }
      currentPreviewData = previewData;

      // 2. 如果是选择题，重置用户选择并缓存解析结果（供 StudyInterface 统计使用）
      if (previewData.cardType === UnifiedCardType.SINGLE_CHOICE || 
          previewData.cardType === UnifiedCardType.MULTIPLE_CHOICE) {
        const cardContent = getCardContentForChoice(cardForRender);
        const parsed = parseCardContent(cardContent);
        choiceQuestionData = parsed.kind === 'choice' ? parsed.choice : null;
        selectedOptions = [];
      } else {
        choiceQuestionData = null;
        selectedOptions = [];
      }

      // 3. 通知题型检测结果
      if (onCardTypeDetected) {
        onCardTypeDetected(previewData.cardType);
      }

      // 4. 通知预览就绪
      if (onPreviewReady) {
        onPreviewReady(previewData);
      }

    } catch (err) {
      if (requestId !== renderRequestId) {
        return;
      }
      logger.error('[PreviewContainer] 卡片解析失败:', err);
      error = err instanceof Error ? err.message : '未知错误';
    } finally {
      if (requestId === renderRequestId) {
        isLoading = false;
      }
    }
  }

  /**
   * 获取卡片内容用于选择题解析
   *  V2架构：使用CardAccessor处理渐进式挖空子卡片
   */
  function getCardContentForChoice(card: Card): string {
    //  使用CardAccessor获取内容（自动处理子卡片从父卡片获取content）
    try {
      const cardStore = new CardStoreAdapter(plugin.dataStorage);
      const accessor = new CardAccessor(card, cardStore);
      const content = accessor.getContent();
      
      if (content && content.trim()) {
        return content.trim();
      }
    } catch (error) {
      logger.error('[PreviewContainer] CardAccessor获取内容失败:', error);
      // 降级到直接读取
      if (card.content && card.content.trim()) {
        return card.content.trim();
      }
    }
    
    //  步骤2：降级策略 - 从 fields 重建选择题格式
    if (!card.fields) return '';
    
    const options = card.fields.options || card.fields.Options;
    const correctAnswers = card.fields.correctAnswers || card.fields.CorrectAnswers;
    
    if (options && correctAnswers) {
      // 从 fields 重建选择题完整格式
      const front = card.fields.front || card.fields.Front || card.fields.question || '';
      const back = card.fields.back || card.fields.Back || card.fields.answer || '';
      
      let markdown = '';
      
      // 添加问题（确保有 Q: 前缀）
      if (front && !front.trim().startsWith('Q:')) {
        markdown += `Q: ${front}\n\n`;
      } else {
        markdown += `${front}\n\n`;
      }
      
      // 添加选项（已包含正确答案标记）
      markdown += `${options}\n\n`;
      
      // 添加解析（如果有）
      if (back) {
        markdown += `---div---\n\n${back}`;
      }
      
      return markdown.trim();
    }
    
    //  步骤3：基础降级 - 拼接 front 和 back
    const front = card.fields.front || card.fields.Front || card.fields.question || '';
    const back = card.fields.back || card.fields.Back || card.fields.answer || '';
    
    if (front && back) {
      return `${front}\n\n---div---\n\n${back}`;
    }
    
    return front || back;
  }

  /**
   * 处理选项选择
   */
  function handleOptionSelect(label: string) {
    // 选项状态已通过bind:绑定自动更新
  }

  /**
   * 处理显示答案请求（从选择题组件触发）
   */
  function handleShowAnswer() {
    showAnswer = true;
  }

  /**
   * 应用容器样式 - 支持统一题型
   */
  function applyContainerStyles(cardType: UnifiedCardType): void {
    if (!containerElement) return;

    // 移除旧的题型类
    containerElement.classList.remove(
      'weave-preview--basic-qa',
      'weave-preview--cloze-deletion',
      'weave-preview--single-choice',
      'weave-preview--multiple-choice',
      'weave-preview--fill-in-blank',
      'weave-preview--sequence',
      'weave-preview--extensible',
      'weave-card--basic-qa',
      'weave-card--cloze-deletion',
      'weave-card--single-choice',
      'weave-card--multiple-choice',
      'weave-card--fill-in-blank',
      'weave-card--sequence',
      'weave-card--extensible'
    );

    // 转换为统一题型并添加新的题型类
    let unifiedType: UnifiedCardType;
    switch (cardType) {
      case 'basic-qa':
        unifiedType = UnifiedCardType.BASIC_QA;
        break;
      case 'single-choice':
        unifiedType = UnifiedCardType.SINGLE_CHOICE;
        break;
      case 'multiple-choice':
        unifiedType = UnifiedCardType.MULTIPLE_CHOICE;
        break;
      case 'cloze-deletion':
        unifiedType = UnifiedCardType.CLOZE_DELETION;
        break;
      case 'extensible':
        unifiedType = UnifiedCardType.EXTENSIBLE;
        break;
      default:
        unifiedType = UnifiedCardType.BASIC_QA;
    }

    // 添加新的题型类（使用统一命名）
    containerElement.classList.add(`weave-preview--${cardType}`);
    containerElement.classList.add(`weave-card--${unifiedType}`);

    // 添加动效类
    if (enableAnimations) {
      containerElement.classList.add('weave-preview--animated');
    }
  }

  /**
   * 切换答案显示状态
   */
  function toggleAnswer(): void {
    showAnswer = !showAnswer;
  }

  /**
   * 刷新预览
   */
  function refreshPreview(): void {
    if (previewEngine) {
      previewEngine.clearCache();
    }
    renderPreview();
  }

  /**
   * 获取预览统计信息
   */
  function getPreviewStats(): {
    cacheStats: any;
    cardType: UnifiedCardType | null;
    confidence: number;
    animationStats: any;
  } {
    return {
      cacheStats: previewEngine?.getCacheStats() || null,
      cardType: currentPreviewData?.cardType || null,
      confidence: currentPreviewData?.metadata.confidence || 0,
      animationStats: animationController?.getAnimationStats() || null
    };
  }

  // 导出方法供父组件使用
  export { toggleAnswer, refreshPreview, getPreviewStats };
</script>

<!-- 预览容器 -->
<div 
  class="weave-preview-container"
  class:loading={isLoading}
  class:has-error={!!error}
  bind:this={containerElement}
>
  <!-- 🆕 优先级便签纸 - 显示在右上角 -->
  {#if card && card.priority}
    <div class="priority-sticky-note priority-{card.priority}">
      <div class="sticky-number">{card.priority}</div>
      <div class="sticky-label">
        {card.priority === 1 ? '低' : card.priority === 2 ? '中' : card.priority === 3 ? '高' : '紧急'}
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="weave-preview-loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在生成预览...</div>
    </div>
  {:else if error}
    <div class="weave-preview-error">
      <div class="error-icon">[!]</div>
      <div class="error-title">预览渲染失败</div>
      <div class="error-message">{error}</div>
    </div>
  {:else if !card}
    <div class="weave-preview-empty">
      <div class="empty-icon">--</div>
      <div class="empty-title">没有可显示的卡片</div>
      <div class="empty-description">请选择一张卡片开始学习</div>
    </div>
  {:else if currentPreviewData}
    <!-- 根据题型渲染对应组件 -->
    {@const cardType = currentPreviewData.cardType}
    {#if cardType === UnifiedCardType.SINGLE_CHOICE || cardType === UnifiedCardType.MULTIPLE_CHOICE}
      <!-- 新的选择题渲染系统 -->
      <CardContentView
        plugin={plugin}
        content={getCardContentForChoice(effectiveCard || card)}
        sourcePath={(currentPreviewData.metadata as any).sourcePath || (effectiveCard?.sourceFile ?? card.sourceFile ?? '')}
        section="full"
        {showAnswer}
        bind:selectedOptions
        onOptionSelect={handleOptionSelect}
        onShowAnswer={handleShowAnswer}
        {enableAnimations}
        card={effectiveCard || card}
        {onAddToErrorBook}
        {onRemoveFromErrorBook}
        {currentResponseTime}
      />
    {:else if cardType === UnifiedCardType.BASIC_QA || (cardType as string) === 'basic-qa'}
      <BasicQACard 
        sections={currentPreviewData.sections}
        {showAnswer}
        {plugin}
        card={effectiveCard || card}
        sourcePath={(currentPreviewData.metadata as any).sourcePath || ''}
        {animationController}
        {enableAnimations}
        {activeClozeOrdinal}
      />
    {:else if cardType === UnifiedCardType.CLOZE_DELETION || (cardType as string) === 'cloze-deletion'}
      <ClozeCard 
        sections={currentPreviewData.sections}
        {showAnswer}
        {plugin}
        sourcePath={(currentPreviewData.metadata as any).sourcePath || ''}
        {animationController}
        {enableAnimations}
        card={effectiveCard || card}
        {activeClozeOrdinal}
      />
    {:else}
      <!-- 默认渲染：显示原始内容 -->
      <div class="weave-card-base">
        <div class="preview-fallback">
          <div class="fallback-header">
            <span class="weave-card-type-badge">未知题型: {currentPreviewData.cardType}</span>
          </div>
          {#each currentPreviewData.sections as section}
            <div class="fallback-section">
              <!-- /skip {@html} renders Markdown preview content processed by Obsidian renderer -->{@html section.content}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .weave-preview-container {
    width: 100%;
    /*  移除边框和背景，避免嵌套 */
    background: transparent;
    border: none;
    border-radius: 0;
    /*  确保容器本身没有额外间距 */
    padding: 0;
    margin: 0;
    /*  改为flex布局适配内容高度 */
    display: flex;
    flex-direction: column;
    /*  最小高度确保内容区域可见 */
    min-height: 300px;
    /*  位置相对，支持特殊元素定位 */
    position: relative;
    transition: all var(--weave-duration-normal, 300ms) ease;
  }

  /* 🆕 优先级便签纸样式 */
  .priority-sticky-note {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 75px;
    height: 75px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
    transform: rotate(-3deg);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: var(--weave-z-overlay); /* 🆕 确保在所有内容之上 */
    cursor: pointer;
    user-select: none;
  }

  /*  已移除hover浮动效果 */

  /* 🆕 胶带效果 */
  .priority-sticky-note::before {
    content: '';
    position: absolute;
    top: -7px;
    left: 50%;
    transform: translateX(-50%);
    width: 48px;
    height: 16px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    backdrop-filter: blur(4px);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .sticky-number {
    font-size: 2rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.2rem;
  }

  .sticky-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.9;
  }

  /* 🆕 优先级1 - 黄色便签（低优先级）*/
  .priority-1 { 
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    color: #92400e; 
  }
  
  /* 🆕 优先级2 - 蓝色便签（中优先级）*/
  .priority-2 { 
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    color: #1e3a8a; 
  }
  
  /* 🆕 优先级3 - 橙色便签（高优先级）*/
  .priority-3 { 
    background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
    color: #7c2d12; 
  }
  
  /* 🆕 优先级4 - 红色便签（紧急）+ 摇摆动画 */
  .priority-4 { 
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    color: #991b1b;
  }

  /* 🆕 优先级4的摇摆动画 */
  .priority-4 {
    animation: wiggle-sticky 0.8s ease-in-out infinite;
  }

  @keyframes wiggle-sticky {
    0%, 100% { 
      transform: rotate(-3deg); 
    }
    25% { 
      transform: rotate(-5deg); 
    }
    75% { 
      transform: rotate(-1deg); 
    }
  }

  /*  已移除优先级4悬停效果 */

  /* 预览内容区域 - 现代UI设计间距 */
  .weave-preview-container :global(.preview-content) {
    padding: var(--weave-space-xl, 2rem); /* ✅ 增加内边距确保内容不贴边 */
    margin: 0;
    flex: 1; /* 填满容器 */
    overflow-y: auto; /* ✅ 内容区域自己滚动 */
    overflow-x: hidden;
  }

  /* 确保所有渲染的内容都能正确滚动 */
  .weave-preview-container :global(*) {
    /* 确保内容不会溢出 */
    max-width: 100%;
    word-wrap: break-word;
  }

  /* 确保卡片基础组件有合适的内边距 */
  .weave-preview-container :global(.weave-card-base) {
    padding: var(--weave-space-lg, 1.5rem);
    margin: 0;
  }

  /* 确保内容区域有足够的间距 */
  .weave-preview-container :global(.weave-qa-question-content),
  .weave-preview-container :global(.weave-qa-answer-content),
  .weave-preview-container :global(.weave-cloze-section),
  .weave-preview-container :global(.choice-question) {
    padding-left: var(--weave-space-md, 1rem);
    padding-right: var(--weave-space-md, 1rem);
  }
  
  /* 支持文本选择 */
  .weave-preview-container {
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
  }
  
  .weave-preview-container :global(.weave-card-base) {
    user-select: text;
    -webkit-user-select: text;
  }

  /* 特殊处理markdown渲染内容 */
  .weave-preview-container :global(.markdown-preview-view),
  .weave-preview-container :global(.markdown-rendered),
  .weave-preview-container :global(.cm-editor) {
    height: auto !important;
    overflow: visible; /* ✅ 移除!important，避免溢出 */
  }

  .weave-preview-container.loading {
    pointer-events: none;
  }

  /* 加载状态 */
  .weave-preview-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--weave-border, var(--background-modifier-border));
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    color: var(--weave-text-secondary, var(--text-muted));
    font-size: 0.875rem;
  }

  /* 空状态 */
  .weave-preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    text-align: center;
    gap: 0.75rem;
  }

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.6;
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--weave-text-primary, var(--text-normal));
  }

  .empty-description {
    font-size: 0.875rem;
    color: var(--weave-text-secondary, var(--text-muted));
  }

  /* 错误状态样式 */
  :global(.weave-preview-error) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    gap: 1rem;
  }

  :global(.weave-preview-error .error-icon) {
    font-size: 2rem;
    color: var(--weave-error, #ef4444);
  }

  :global(.weave-preview-error .error-title) {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--weave-error, #ef4444);
  }

  :global(.weave-preview-error .error-message) {
    font-size: 0.875rem;
    color: var(--weave-text-secondary, var(--text-muted));
    max-width: 300px;
  }

  :global(.weave-preview-error .error-retry) {
    padding: 0.5rem 1rem;
    background: var(--weave-error, #ef4444);
    color: white;
    border: none;
    border-radius: var(--weave-radius-md, 0.5rem);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  /*  已移除错误重试按钮hover效果 */

  /* 动画 */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes weave-fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .weave-preview-container {
      border-radius: var(--weave-radius-md, 0.5rem);
    }

    .weave-preview-empty,
    .weave-preview-loading {
      padding: 2rem 1rem;
    }

    .empty-icon {
      font-size: 2rem;
    }

    .empty-title {
      font-size: 1rem;
    }

    .empty-description {
      font-size: 0.8rem;
    }

    /* 🆕 移动端便签纸缩小 */
    .priority-sticky-note {
      width: 60px;
      height: 60px;
      top: 12px;
      right: 12px;
    }

    .sticky-number {
      font-size: 1.5rem;
    }

    .sticky-label {
      font-size: 0.6rem;
    }

    .priority-sticky-note::before {
      width: 40px;
      height: 14px;
      top: -6px;
    }
  }

  /* 🆕 超小屏幕进一步缩小 */
  @media (max-width: 480px) {
    .priority-sticky-note {
      width: 50px;
      height: 50px;
      top: 8px;
      right: 8px;
    }

    .sticky-number {
      font-size: 1.2rem;
    }

    .sticky-label {
      font-size: 0.55rem;
    }

    .priority-sticky-note::before {
      width: 32px;
      height: 12px;
      top: -5px;
    }
  }

  /* ==================== Obsidian 移动端适配 ==================== */
  
  /* 手机端：减小内边距，增加内容显示宽度 */
  :global(body.is-phone) .weave-preview-container :global(.preview-content) {
    padding: var(--weave-mobile-spacing-sm, 0.5rem);
  }

  :global(body.is-phone) .weave-preview-container :global(.weave-card-base) {
    padding: var(--weave-mobile-spacing-sm, 0.5rem);
  }

  :global(body.is-phone) .weave-preview-container :global(.weave-cloze-section),
  :global(body.is-phone) .weave-preview-container :global(.choice-question) {
    padding-left: var(--weave-mobile-spacing-xs, 0.25rem);
    padding-right: var(--weave-mobile-spacing-xs, 0.25rem);
  }
</style>
