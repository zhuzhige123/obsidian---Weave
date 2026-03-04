<script lang="ts">
  import { logger } from '../../utils/logger';

  import type { ChoiceQuestion, ChoiceOption } from '../../parsing/choice-question-parser';
  import type { Card } from '../../data/types';
  import { MarkdownRenderer, Component } from 'obsidian';
  import { onMount } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import ChoiceOptionRenderer from '../atoms/ChoiceOptionRenderer.svelte';
  import ChoiceAccuracySticker from '../study/ChoiceAccuracySticker.svelte';

  interface Props {
    /** 选择题数据 */
    question: ChoiceQuestion;
    /** 是否显示答案 */
    showAnswer: boolean;
    /** 选项选择回调 */
    onOptionSelect?: (label: string) => void;
    /** 显示答案回调 */
    onShowAnswer?: () => void;
    /** 已选择的选项标签列表 */
    selectedOptions?: string[];
    /** 插件实例（用于Markdown渲染） */
    plugin: WeavePlugin;
    /** 是否启用动画 */
    enableAnimations?: boolean;
    /** 卡片数据（用于统计显示） */
    card?: Card;
    /** 加入错题集回调 */
    onAddToErrorBook?: () => void;
    /** 移出错题集回调 */
    onRemoveFromErrorBook?: () => void;
    /** 当前反应时间（毫秒） */
    currentResponseTime?: number;
  }

  let {
    question,
    showAnswer,
    onOptionSelect,
    onShowAnswer,
    selectedOptions = $bindable([]),
    plugin,
    enableAnimations = true,
    card,
    onAddToErrorBook,
    onRemoveFromErrorBook,
    currentResponseTime
  }: Props = $props();

  // 渲染容器引用
  let questionContainer: HTMLDivElement | null = $state(null);
  let explanationContainer: HTMLDivElement | null = $state(null);

  // 渲染Markdown内容
  async function renderMarkdown(container: HTMLElement, content: string) {
    if (!container || !content) return;

    try {
      container.innerHTML = '';
      
      // 获取源文件路径
      const activeFile = plugin.app.workspace.getActiveFile();
      const sourcePath = activeFile?.path || card?.sourceFile || '';
      
      // 创建Component实例以支持Obsidian特性
      const component = new Component();
      
      await MarkdownRenderer.render(
        plugin.app,
        content,
        container,
        sourcePath,
        component
      );

      // 加载组件
      component.load();

      //  修复：等待脚注渲染完成
      await new Promise(resolve => setTimeout(resolve, 50));

      //  修复：设置内部链接处理器
      setupInternalLinkHandlers(container, sourcePath);

      //  修复：设置脚注处理器
      setupFootnoteHandlers(container);

    } catch (error) {
      logger.error('[ChoiceQuestionPreview] Markdown渲染失败:', error);
      container.textContent = content;
    }
  }

  /**
   *  设置内部链接点击处理器
   */
  function setupInternalLinkHandlers(container: HTMLElement, sourcePath: string) {
    if (!container) return;

    const internalLinks = container.querySelectorAll('a.internal-link');
    
    internalLinks.forEach((link) => {
      const anchorEl = link as HTMLAnchorElement;
      const href = anchorEl.getAttribute('data-href');
      
      if (!href) return;

      const clickHandler = (e: MouseEvent) => {
        e.preventDefault();
        // Svelte 5: 内部链接导航不需要 stopPropagation
        
        plugin.app.workspace.openLinkText(
          href,
          sourcePath,
          e.ctrlKey || e.metaKey
        );
      };

      anchorEl.addEventListener('click', clickHandler);

      // 设置Obsidian标准属性以启用hover预览
      anchorEl.setAttribute('data-href', href);
      anchorEl.setAttribute('data-tooltip-position', 'top');
      anchorEl.setAttribute('rel', 'noopener');
      anchorEl.setAttribute('target', '_blank');
      anchorEl.classList.add('internal-link');
      
      // 添加hover事件
      anchorEl.addEventListener('mouseenter', (e: MouseEvent) => {
        const targetEl = e.currentTarget as HTMLElement;
        
        plugin.app.workspace.trigger('hover-link', {
          event: e,
          source: 'preview',
          hoverParent: container,
          targetEl: targetEl,
          linktext: href,
          sourcePath: sourcePath
        });
      });
    });
  }

  /**
   * 设置脚注处理器
   */
  function setupFootnoteHandlers(container: HTMLElement) {
    if (!container) return;

    const footnoteRefs = container.querySelectorAll('a.footnote-ref, sup a[href^="#fn"]');
    const footnotesSection = container.querySelector('.footnotes, section.footnotes');
    
    if (footnoteRefs.length === 0 && !footnotesSection) return;

    // 脚注引用点击
    footnoteRefs.forEach((ref) => {
      const refEl = ref as HTMLAnchorElement;
      const href = refEl.getAttribute('href');
      
      if (!href || !href.startsWith('#')) return;
      
      const footnoteId = href.substring(1);

      const clickHandler = (e: MouseEvent) => {
        e.preventDefault();
        // Svelte 5: 脚注点击不需要 stopPropagation
        
        // 查找脚注内容
        let footnoteContent = container.querySelector(`#${footnoteId}`) ||
                             container.querySelector(`li[id="${footnoteId}"]`) ||
                             container.querySelector(`[data-footnote-id="${footnoteId}"]`);
        
        if (!footnoteContent && footnoteId.startsWith('fn:')) {
          const num = footnoteId.substring(3);
          footnoteContent = container.querySelector(`#fnref\\:${num}`);
        }
        
        if (footnoteContent) {
          footnoteContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          footnoteContent.classList.add('footnote-highlighted');
          setTimeout(() => footnoteContent.classList.remove('footnote-highlighted'), 2000);
        }
      };

      refEl.addEventListener('click', clickHandler, { capture: true });
    });

    // 脚注返回链接
    const backRefs = container.querySelectorAll('a.footnote-backref, .footnotes a[href^="#fnref"]');
    
    backRefs.forEach((backRef) => {
      const backRefEl = backRef as HTMLAnchorElement;
      const href = backRefEl.getAttribute('href');
      
      if (!href || !href.startsWith('#')) return;
      
      const targetId = href.substring(1);

      const clickHandler = (e: MouseEvent) => {
        e.preventDefault();
        // Svelte 5: 脚注返回链接不需要 stopPropagation
        
        // 查找脚注引用
        let target = container.querySelector(`#${targetId}`);
        
        if (!target && targetId.startsWith('fnref:')) {
          const num = targetId.substring(6);
          target = container.querySelector(`a[href="#fn:${num}"]`) ||
                  container.querySelector(`sup a[href="#fn:${num}"]`) ||
                  container.querySelector(`a.footnote-ref[href="#fn:${num}"]`);
        }
        
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('footnote-highlighted');
          setTimeout(() => {
            target.classList.remove('footnote-highlighted');
          }, 2000);
        }
      };

      backRefEl.addEventListener('click', clickHandler, { capture: true });
    });

    // 确保脚注区域可见
    if (footnotesSection) {
      (footnotesSection as HTMLElement).style.display = '';
      (footnotesSection as HTMLElement).style.visibility = 'visible';
    }
  }

  // 渲染问题文本
  $effect(() => {
    if (questionContainer && question.question) {
      renderMarkdown(questionContainer, question.question);
    }
  });

  // 渲染解析内容
  $effect(() => {
    if (showAnswer && explanationContainer && question.explanation) {
      renderMarkdown(explanationContainer, question.explanation);
    }
  });

  let hasAnswerKey = $derived(
    Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0
  );

  // ===== 新增：答案摘要相关状态和函数 =====
  
  /**
   * 判断用户是否已作答
   */
  let hasAnswered = $derived(selectedOptions.length > 0);
  
  /**
   * 判断用户答题是否正确
   */
  let isCorrect = $derived.by(() => {
    if (selectedOptions.length === 0) return false;
    if (!hasAnswerKey) return false;
    
    if (question.isMultipleChoice) {
      // 多选题：必须选中所有正确答案，且不能选中错误答案
      const correctLabels = question.options
        .filter(opt => opt.isCorrect)
        .map(opt => opt.label);
      
      const selectedSet = new Set(selectedOptions);
      const correctSet = new Set(correctLabels);
      
      // 检查数量是否相同
      if (selectedSet.size !== correctSet.size) return false;
      
      // 检查每个选中的选项是否都是正确答案
      for (const label of selectedOptions) {
        if (!correctSet.has(label)) return false;
      }
      
      return true;
    } else {
      // 单选题：选中的选项必须是正确答案
      const selectedOption = question.options.find(opt => opt.label === selectedOptions[0]);
      return selectedOption?.isCorrect || false;
    }
  });

  /**
   * 获取所有正确答案的标签
   */
  let correctAnswerLabels = $derived(
    question.options
      .filter(opt => opt.isCorrect)
      .map(opt => opt.label)
  );



  /**
   * 处理选项点击
   */
  function handleOptionClick(option: ChoiceOption) {
    if (showAnswer) return; // 显示答案后禁用交互

    const label = option.label;

    if (question.isMultipleChoice) {
      // 多选题：切换选中状态
      if (selectedOptions.includes(label)) {
        selectedOptions = selectedOptions.filter(l => l !== label);
      } else {
        selectedOptions = [...selectedOptions, label];
      }
      // 多选题不自动显示答案，需要用户点击"确认答案"按钮
    } else {
      // 单选题：只能选择一个
      selectedOptions = [label];
      // 单选题点击后立即显示答案（移除延迟以优化交互体验）
      onShowAnswer?.();
    }

    // 触发回调
    onOptionSelect?.(label);
  }

  /**
   * 键盘快捷键支持（A/B/C/D）
   *  只处理选项快捷键，其他按键让它冒泡到StudyModal
   */
  function handleKeyPress(event: KeyboardEvent) {
    // 显示答案后停止处理键盘事件
    if (showAnswer) return;

    // 如果焦点在输入框等可编辑元素中，不处理
    const target = event.target as HTMLElement;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
      return;
    }

    const key = event.key.toUpperCase();
    const option = question.options.find(opt => opt.label === key);

    //  只处理ABCD等选项快捷键，其他键（空格、数字键等）不拦截
    if (option) {
      event.preventDefault();
      // Svelte 5: 选项快捷键应该让事件继续冒泡
      handleOptionClick(option);
    }
    //  其他按键（如空格、1234等）不处理，让它们冒泡到StudyModal
  }

  onMount(() => {
    // 绑定键盘事件到window，使用捕获阶段以优先处理
    window.addEventListener('keydown', handleKeyPress, { capture: false });

    return () => {
      window.removeEventListener('keydown', handleKeyPress, { capture: false });
    };
  });
</script>

<div class="choice-question-container" class:animations-enabled={enableAnimations}>
  <!-- 选择题正确率贴纸 -->
  {#if card?.stats?.choiceStats && card.stats.choiceStats.totalAttempts > 0}
    {@const total = card.stats.choiceStats.totalAttempts}
    {@const correct = card.stats.choiceStats.correctAttempts}
    {@const accuracy = total > 0 ? (correct / total) * 100 : 0}
    <ChoiceAccuracySticker 
      {accuracy}
      {correct}
      {total}
    />
  {/if}
  <!-- 已选状态提示（仅在选择后显示） -->
  {#if selectedOptions.length > 0 && !showAnswer}
    <div class="choice-selection-hint">
      已选 {selectedOptions.length} 项
    </div>
  {/if}

  <!-- 问题文本 -->
  <div class="question-header">
    <div class="question-text" bind:this={questionContainer}></div>
  </div>

  {#if !hasAnswerKey}
    <div class="missing-answer-hint">答案缺失</div>
  {/if}

  <!-- 选项列表 -->
  <div class="options-container">
    {#each question.options as option (option.label)}
      {@const isSelected = selectedOptions.includes(option.label)}
      {@const isCorrectAnswer = option.isCorrect}
      {@const isWrongAnswer = isSelected && !isCorrectAnswer}
      
      <ChoiceOptionRenderer
        {option}
        isSelected={isSelected}
        isCorrect={hasAnswerKey && showAnswer && isCorrectAnswer}
        isWrong={hasAnswerKey && showAnswer && isWrongAnswer}
        disabled={showAnswer}
        showStatusIcon={hasAnswerKey && showAnswer}
        {plugin}
        sourcePath={card?.sourceFile || ''}
        onclick={() => handleOptionClick(option)}
        className="memory-study-option"
      />
    {/each}
  </div>

  <!-- 答案对比区域 - 极简主义设计 -->
  {#if hasAnswerKey && showAnswer && hasAnswered}
    <div class="answer-comparison">
      <div class="comparison-row">
        <div class="comparison-item your-answer">
          <span class="comparison-label">你的答案</span>
          <span class="comparison-value" class:incorrect={!isCorrect}>
            {selectedOptions.sort().join('、')}
          </span>
        </div>
        <div class="comparison-divider"></div>
        <div class="comparison-item correct-answer">
          <span class="comparison-label">正确答案</span>
          <span class="comparison-value correct">
            {correctAnswerLabels.sort().join('、')}
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- 解析区域 - 直接显示 -->
  {#if showAnswer && question.explanation}
    <div class="explanation-section">
      <div class="explanation-header">
        <span class="explanation-title">详细解析</span>
      </div>
      <div class="explanation-content" bind:this={explanationContainer}></div>
    </div>
  {/if}

</div>

<style>
  /* ===== 容器样式 ===== */
  .choice-question-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
  }

  /* ===== 已选状态提示 ===== */
  .choice-selection-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  /* ===== 问题区域 ===== */
  .question-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .missing-answer-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
    margin-top: -0.75rem;
  }

  .question-text {
    flex: 1;
    font-size: 1.125rem;
    font-weight: 600;
    
    /* 支持文本选择 */
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
    color: var(--text-normal);
    line-height: 1.6;
  }

  /* ===== 选项容器 - 扁平化 ===== */
  .options-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    /* 移除边框和内边距，简化为纯布局容器 */
    border: none;
    border-radius: 0;
    overflow: visible;
    padding: 0;
  }

  /* 选项样式已移至 ChoiceOptionRenderer.svelte 组件 */

  /* ===== 答案对比区域 - 极简主义 ===== */
  .answer-comparison {
    margin: 1.5rem 0;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
  }

  .comparison-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .comparison-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .comparison-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .comparison-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-normal);
  }

  .comparison-value.correct {
    color: var(--color-green);
  }

  .comparison-value.incorrect {
    color: var(--color-red);
  }

  .comparison-divider {
    width: 1px;
    height: 40px;
    background-color: var(--background-modifier-border);
    flex-shrink: 0;
  }

  /* ===== 解析区域 - 直接显示设计 ===== */
  .explanation-section {
    margin-top: 1.5rem;
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
  }

  .explanation-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .explanation-icon {
    font-size: 1.125rem;
  }

  .explanation-title {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .explanation-content {
    color: var(--text-normal);
    line-height: 1.7;
    font-size: 0.9375rem;
  }


  /* ===== 响应式设计 ===== */
  @media (max-width: 768px) {
    .choice-question-container {
      padding: 0.75rem;
      gap: 1.25rem;
    }

    .question-text {
      font-size: 1rem;
    }

    /* 移动端答案对比垂直布局 */
    .comparison-row {
      flex-direction: column;
      gap: 1rem;
    }

    .comparison-divider {
      width: 100%;
      height: 1px;
    }

  }


  .explanation-content :global(p) {
    margin: 0.5rem 0;
  }

  .explanation-content :global(p:first-child) {
    margin-top: 0;
  }

  .explanation-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .explanation-content :global(code) {
    padding: 0.125rem 0.375rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
    font-family: var(--font-monospace);
    font-size: 0.9em;
  }

  .explanation-content :global(ul),
  .explanation-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .explanation-content :global(li) {
    margin: 0.375rem 0;
  }

  .explanation-content :global(strong) {
    font-weight: 600;
    color: var(--text-normal);
  }

  /*  修复：脚注样式 */
  /* 脚注引用（上标数字） */
  :global(.footnote-ref) {
    color: var(--text-accent);
    text-decoration: none;
    cursor: pointer;
    font-size: 0.75em;
    vertical-align: super;
    padding: 0 2px;
    transition: color 0.2s ease;
  }

  :global(.footnote-ref:hover) {
    color: var(--text-accent-hover);
    text-decoration: underline;
  }

  /* 脚注内容区域 */
  :global(.footnotes) {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
    font-size: 0.9em;
    color: var(--text-muted);
  }

  :global(.footnotes ol) {
    padding-left: 1.5rem;
    margin: 0;
  }

  :global(.footnotes li) {
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }

  /* 脚注返回链接 */
  :global(.footnote-backref) {
    color: var(--text-accent);
    text-decoration: none;
    margin-left: 0.25rem;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  :global(.footnote-backref:hover) {
    color: var(--text-accent-hover);
  }

  /* 脚注高亮效果 */
  :global(.footnote-highlighted) {
    background: color-mix(in srgb, var(--text-accent) 20%, transparent);
    transition: background 0.3s ease;
    border-radius: 4px;
    padding: 0.25rem;
  }

  /*  修复：脚注引用高亮（上标数字） */
  :global(a.footnote-ref.footnote-highlighted),
  :global(sup .footnote-highlighted) {
    background: color-mix(in srgb, var(--text-accent) 25%, transparent);
    padding: 2px 4px;
    border-radius: 3px;
    transition: background 0.3s ease;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--text-accent) 15%, transparent);
  }

  /* 确保脚注内容在选择题中可见 */
  .question-text :global(.footnotes),
  .explanation-content :global(.footnotes) {
    display: block !important;
    visibility: visible !important;
  }
</style>

