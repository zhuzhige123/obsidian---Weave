<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { MarkdownRenderer, Component } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import { logger } from '../../utils/logger';

  interface Props {
    plugin: WeavePlugin;
    content: string;
    sourcePath?: string;
    enableClozeProcessing?: boolean;
    showClozeAnswers?: boolean;
    card?: any; // 卡片对象
    studyInstance?: any; // 🆕 学习实例（支持渐进式挖空）
    activeClozeOrdinal?: number; // 🆕 渐进式挖空：当前激活的挖空序号 (1-based)
    onRenderComplete?: (element: HTMLElement) => void;
    onRenderError?: (error: Error) => void;
  }

  let {
    plugin,
    content,
    sourcePath = '',
    enableClozeProcessing = false,
    showClozeAnswers = false,
    card,
    studyInstance, // 🆕 渐进式挖空学习实例支持
    activeClozeOrdinal, // 🆕 渐进式挖空序号
    onRenderComplete,
    onRenderError
  }: Props = $props();

  //  修复：自动从card.sourceFile获取sourcePath（如果未提供）
  // 这对于内部链接点击和Ctrl+悬停浮窗功能至关重要
  const effectiveSourcePath = $derived(
    sourcePath || card?.sourceFile || ''
  );


  let container: HTMLDivElement;
  let component: Component | null = null;
  let isRendering = $state(false);
  let renderError = $state<string | null>(null);
  let isMounted = $state(false);  
  let pendingRender = $state(false);

  // 预处理挖空内容
  //  支持三种模式（优先级从高到低）：
  // 1. activeClozeOrdinal参数：直接传递的挖空序号（1-based）- V2渐进式挖空
  // 2. 渐进式挖空学习实例：根据activeClozeOrd区分当前挖空和其他挖空
  // 3. 普通Anki挖空：全部转换为==高亮==
  // 4. Obsidian格式: ==text== → 保留原样
  function preprocessClozeContent(rawContent: string): string {
    if (!rawContent) return rawContent;
    
    let processedContent = rawContent;
    
    // 🆕 优先级1: 直接传递的 activeClozeOrdinal 参数 (1-based)
    if (activeClozeOrdinal !== undefined) {
      //  渐进式挖空：区分当前挖空和其他挖空
      const activeClozeOrd = activeClozeOrdinal - 1; // 转换为0-based
      
      processedContent = processedContent.replace(
        /\{\{c(\d+)::([^}:]+)(?:::([^}]+))?\}\}/g,
        (match, num, text, hint) => {
          const ord = parseInt(num) - 1;
          
          if (ord === activeClozeOrd) {
            // 当前激活的挖空：转换为高亮（让Obsidian渲染为<mark>）
            return `==${text}==`;
          } else {
            // 其他挖空：直接显示答案文本（移除挖空标记）
            return text;
          }
        }
      );
      
      logger.debug('[ObsidianRenderer]',`✅ 渲染渐进式挖空（activeCloze: c${activeClozeOrdinal}）`);
      
    } else if (studyInstance && typeof studyInstance === 'object' && 'activeClozeOrd' in studyInstance) {
      // 🆕 优先级2：检测渐进式挖空学习实例
      //  渐进式挖空学习实例：区分当前挖空和其他挖空
      const activeClozeOrd = studyInstance.activeClozeOrd;
      
      processedContent = processedContent.replace(
        /\{\{c(\d+)::([^}:]+)(?:::([^}]+))?\}\}/g,
        (match, num, text, hint) => {
          const ord = parseInt(num) - 1;
          
          if (ord === activeClozeOrd) {
            // 当前激活的挖空：转换为高亮（让Obsidian渲染为<mark>）
            return `==${text}==`;
          } else {
            // 其他挖空：直接显示答案文本（移除挖空标记）
            return text;
          }
        }
      );
      
      logger.debug('[ObsidianRenderer]',`✅ 渲染渐进式挖空学习实例（activeCloze: c${activeClozeOrd + 1}）`);
      
    } else {
      //  普通挖空：转换所有Anki格式为Obsidian高亮
      const ankiClozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
      const hasAnkiCloze = ankiClozeRegex.test(rawContent);
      ankiClozeRegex.lastIndex = 0;
      
      if (hasAnkiCloze) {
        processedContent = processedContent.replace(ankiClozeRegex, (match, num, text, hint) => {
          return `==${text}==`;
        });
        
        logger.debug('[ObsidianRenderer]','✅ 已转换Anki挖空格式为Obsidian高亮格式');
      }
    }
    
    return processedContent;
  }

  /**
   *  修复：设置内部链接点击处理器
   * Obsidian的MarkdownRenderer只渲染HTML，不会自动绑定点击事件
   * 需要手动绑定点击事件来处理内部链接跳转
   */
  function setupInternalLinkHandlers(container: HTMLElement): void {
    if (!container) return;

    // 查找所有内部链接
    const internalLinks = container.querySelectorAll('a.internal-link');
    
    internalLinks.forEach((link) => {
      const anchorEl = link as HTMLAnchorElement;
      const href = anchorEl.getAttribute('data-href');
      
      if (!href) return;

      // 移除已有的点击处理器（如果有）
      const oldHandler = (anchorEl as any)._weaveClickHandler;
      if (oldHandler) {
        anchorEl.removeEventListener('click', oldHandler);
      }

      // 添加新的点击处理器
      const clickHandler = (e: MouseEvent) => {
        e.preventDefault();
        // Svelte 5: 内部链接导航不需要 stopPropagation
        
        logger.debug('[ObsidianRenderer]','内部链接点击:', href);
        
        // 使用Obsidian的app.workspace.openLinkText API
        plugin.app.workspace.openLinkText(
          href,
          effectiveSourcePath,
          e.ctrlKey || e.metaKey // 新标签页
        );
      };

      anchorEl.addEventListener('click', clickHandler);
      
      // 保存处理器引用以便清理
      (anchorEl as any)._weaveClickHandler = clickHandler;

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
          sourcePath: effectiveSourcePath
        });
      });
    });
  }

  /**
   * 设置脚注处理器
   */
  function setupFootnoteHandlers(container: HTMLElement): void {
    if (!container) return;

    const footnoteRefs = container.querySelectorAll('a.footnote-ref, sup a[href^="#fn"]');
    const footnotesSection = container.querySelector('.footnotes, section.footnotes');
    
    if (footnoteRefs.length === 0 && !footnotesSection) return;

    // 为脚注引用添加点击处理
    footnoteRefs.forEach((ref) => {
      const refEl = ref as HTMLAnchorElement;
      const href = refEl.getAttribute('href');
      
      if (!href || !href.startsWith('#')) return;
      
      const footnoteId = href.substring(1);

      const oldHandler = (refEl as any)._weaveFootnoteHandler;
      if (oldHandler) {
        refEl.removeEventListener('click', oldHandler);
      }

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
          setTimeout(() => {
            footnoteContent.classList.remove('footnote-highlighted');
          }, 2000);
        }
      };

      refEl.addEventListener('click', clickHandler, { capture: true });
      (refEl as any)._weaveFootnoteHandler = clickHandler;
    });

    // 为脚注返回链接添加处理
    const backRefs = container.querySelectorAll('a.footnote-backref, .footnotes a[href^="#fnref"]');
    
    backRefs.forEach((backRef) => {
      const backRefEl = backRef as HTMLAnchorElement;
      const href = backRefEl.getAttribute('href');
      
      if (!href || !href.startsWith('#')) return;
      
      const targetId = href.substring(1);

      const oldHandler = (backRefEl as any)._weaveBackrefHandler;
      if (oldHandler) {
        backRefEl.removeEventListener('click', oldHandler);
      }

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
      (backRefEl as any)._weaveBackrefHandler = clickHandler;
    });

    // 确保脚注区域可见
    if (footnotesSection) {
      (footnotesSection as HTMLElement).style.display = '';
      (footnotesSection as HTMLElement).style.visibility = 'visible';
    }
  }

  // 后处理渲染内容，处理挖空占位符样式
  function postProcessRenderedContent(element: HTMLElement): void {
    if (!enableClozeProcessing) return;

    // 
    const markElements = element.querySelectorAll('mark');
    
    markElements.forEach((mark, index) => {
      const markEl = mark as HTMLElement;
      
      // 添加挖空样式类
      markEl.classList.add('weave-cloze-mark');
      
      if (!showClozeAnswers) {
        // 未显示答案时，添加隐藏类
        markEl.classList.add('weave-cloze-hidden');
      } else {
        // 显示答案时，添加已显示类
        markEl.classList.add('weave-cloze-revealed');
      }
      
      // 添加可访问性属性
      markEl.setAttribute('tabindex', '0');
      markEl.setAttribute('role', 'button');
      markEl.setAttribute('aria-label', showClozeAnswers ? '答案已显示' : '点击或悬停显示答案');
      markEl.setAttribute('data-cloze-index', String(index));
      
      // 添加点击事件 - 切换单个挖空的显示状态
      markEl.addEventListener('click', (e) => {
        // Svelte 5: 挖空点击切换不需要 stopPropagation
        const target = e.currentTarget as HTMLElement;
        if (target.classList.contains('weave-cloze-hidden')) {
          target.classList.remove('weave-cloze-hidden');
          target.classList.add('weave-cloze-revealed');
          target.setAttribute('aria-label', '答案已显示');
        }
      });
    });
    
    //  处理带hint的挖空（从Anki格式转换而来）
    const hintWrappers = element.querySelectorAll('[data-cloze-hint]');
    let hintCount = 0;
    
    hintWrappers.forEach((wrapper) => {
      const wrapperEl = wrapper as HTMLElement;
      const hint = wrapperEl.getAttribute('data-cloze-hint');
      const markEl = wrapperEl.querySelector('mark');
      
      if (markEl && hint) {
        // 将hint信息添加到mark元素
        markEl.setAttribute('data-hint', hint);
        markEl.setAttribute('title', `💡 提示: ${hint}`);
        
        // 更新aria-label包含提示信息
        const currentLabel = markEl.getAttribute('aria-label') || '';
        markEl.setAttribute('aria-label', `${currentLabel}，提示: ${hint}`);
        
        hintCount++;
      }
    });
    
    logger.debug('[ObsidianRenderer]',`✅ 处理了 ${markElements.length} 个挖空标记 (其中 ${hintCount} 个带提示)`);
  }

  function wrapTablesForHorizontalScroll(element: HTMLElement): void {
    const tables = Array.from(element.querySelectorAll('table'));
    if (tables.length === 0) return;

    for (const table of tables) {
      const existingWrapper = table.closest('.weave-table-scroll');
      if (existingWrapper) continue;

      const parent = table.parentElement;
      if (!parent) continue;

      const wrapper = document.createElement('div');
      wrapper.className = 'weave-table-scroll';

      parent.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }


  // 渲染Markdown内容
  async function renderContent(): Promise<void> {
    //  关键检查：防止组件卸载后继续渲染
    if (!isMounted || !container || !plugin?.app) {
      logger.debug('[ObsidianRenderer]','⚠️ 跳过渲染：组件未挂载或缺少依赖', {
        isMounted,
        hasContainer: !!container,
        hasPlugin: !!plugin?.app,
        contentLength: content?.length ?? 0
      });
      return;
    }
    
    //  防止并发渲染
    if (isRendering) {
      logger.debug('[ObsidianRenderer]','⚠️ 跳过渲染：上一次渲染尚未完成');
      pendingRender = true;
      return;
    }
    
    logger.debug('[ObsidianRenderer]','✅ 开始渲染内容:', {
      contentLength: content?.length ?? 0,
      enableClozeProcessing,
      showClozeAnswers
    });

    isRendering = true;
    renderError = null;

    try {
      // 清理之前的渲染
      if (component) {
        component.unload();
        component = null;
      }
      
      //  再次检查：在异步操作前确认组件仍然挂载
      if (!isMounted || !container) {
        logger.debug('[ObsidianRenderer]','渲染中止：组件已卸载');
        return;
      }
      
      container.innerHTML = '';

      // 预处理内容
      const processedContent = preprocessClozeContent(content);

      // 创建新的组件实例
      component = new Component();

      // 使用Obsidian原生渲染引擎
      await MarkdownRenderer.render(
        plugin.app,
        processedContent || '*空内容*',
        container,
        effectiveSourcePath,  //  使用有效的源路径以支持内部链接和hover
        component
      );

      //  最终检查：在加载组件前确认组件仍然挂载
      if (!isMounted || !component) {
        logger.debug('[ObsidianRenderer]','渲染完成但组件已卸载，跳过加载');
        if (component) {
          component.unload();
          component = null;
        }
        return;
      }

      // 加载组件
      component.load();

      //  修复：等待脚注渲染完成
      // Obsidian的脚注需要Component加载后等待DOM更新才会完全渲染
      await new Promise(resolve => setTimeout(resolve, 50));

      // 后处理渲染内容
      postProcessRenderedContent(container);

      wrapTablesForHorizontalScroll(container);

      //  修复：注册内部链接点击事件处理器
      setupInternalLinkHandlers(container);

      //  修复：设置脚注处理器
      setupFootnoteHandlers(container);

      // 触发完成回调
      onRenderComplete?.(container);
      
      logger.debug('[ObsidianRenderer]','✅ 渲染成功', {
        contentLength: content.length,
        enableClozeProcessing,
        showClozeAnswers,
        timestamp: new Date().toLocaleTimeString()
      });

    } catch (error) {
      //  只在组件仍然挂载时处理错误
      if (!isMounted || !container) {
        logger.debug('[ObsidianRenderer]','渲染错误但组件已卸载，忽略');
        return;
      }
      
      logger.error('[ObsidianRenderer] 渲染失败:', error);
      renderError = error instanceof Error ? error.message : '未知渲染错误';
      
      // 降级到简单HTML渲染
      container.innerHTML = `
        <div class="weave-render-error">
          <div class="error-icon">[!]</div>
          <div class="error-message">内容渲染失败</div>
          <div class="error-fallback">${content}</div>
        </div>
      `;

      onRenderError?.(error instanceof Error ? error : new Error('渲染失败'));
    } finally {
      isRendering = false;

      if (pendingRender) {
        pendingRender = false;

        if (isMounted && container && plugin?.app) {
          setTimeout(() => renderContent(), 0);
        }
      }
    }
  }

  //  使用安全的 $effect + 延迟执行，避免启动阻塞
  
  // 跟踪上一次渲染的内容，用于检测变化
  let previousContent = $state<string>('');
  let previousShowCloze = $state<boolean>(false);
  let previousActiveClozeOrdinal = $state<number | undefined>(undefined); // 🆕 跟踪挖空序号
  
  //  安全的内容变化监听（延迟执行，避免阻塞）
  // 修复：同时监听 content 和 activeClozeOrdinal 变化
  $effect(() => {
    // 读取依赖以触发追踪
    const currentContent = content;
    const currentActiveCloze = activeClozeOrdinal;
    const mounted = isMounted;
    
    //  检测 content 或 activeClozeOrdinal 变化
    const contentChanged = currentContent !== previousContent;
    const activeClozeChanged = currentActiveCloze !== previousActiveClozeOrdinal;
    
    if (mounted && currentContent !== undefined && (contentChanged || activeClozeChanged)) {
      logger.debug('[ObsidianRenderer]','内容或挖空序号变化，延迟渲染', {
        contentChanged,
        activeClozeChanged,
        oldActiveCloze: previousActiveClozeOrdinal,
        newActiveCloze: currentActiveCloze
      });
      
      previousContent = currentContent;
      previousActiveClozeOrdinal = currentActiveCloze;
      
      // 延迟到下一个事件循环，避免阻塞启动
      setTimeout(() => renderContent(), 0);
    }
  });
  
  // 安全的挖空显示状态监听（延迟执行，避免阻塞）
  $effect(() => {
    // 读取依赖以触发追踪
    const shouldShow = showClozeAnswers;
    const mounted = isMounted;
    const processingEnabled = enableClozeProcessing;
    
    if (mounted && shouldShow !== previousShowCloze && processingEnabled) {
      logger.debug('[ObsidianRenderer]','挖空显示状态变化:', shouldShow);
      previousShowCloze = shouldShow;
      // 延迟执行，避免阻塞
      setTimeout(() => updateClozeDisplay(shouldShow), 100);
    }
  });
  
  // 独立的挖空显示更新函数
  function updateClozeDisplay(shouldShow: boolean): void {
    if (!container) return;
    
    const markElements = container.querySelectorAll('mark.weave-cloze-mark');
    logger.debug('[ObsidianRenderer]',`更新 ${markElements.length} 个挖空的显示状态`);
    
    markElements.forEach((mark) => {
      const markEl = mark as HTMLElement;
      if (shouldShow) {
        markEl.classList.remove('weave-cloze-hidden');
        markEl.classList.add('weave-cloze-revealed');
        markEl.setAttribute('aria-label', '答案已显示');
        markEl.style.cursor = 'default';
      } else {
        markEl.classList.add('weave-cloze-hidden');
        markEl.classList.remove('weave-cloze-revealed');
        markEl.setAttribute('aria-label', '点击或悬停显示答案');
        markEl.style.cursor = 'pointer';
      }
    });
  }

  onMount(() => {
    isMounted = true;  //  标记组件已挂载
    logger.debug('[ObsidianRenderer]','onMount - 组件已挂载');
    
    //  安全的初次渲染：延迟执行避免阻塞启动
    setTimeout(() => {
      if (container && content !== undefined) {
        previousContent = content;
        previousShowCloze = showClozeAnswers;
        previousActiveClozeOrdinal = activeClozeOrdinal; // 🆕 初始化挖空序号
        renderContent();
      }
    }, 0);
  });

  onDestroy(() => {
    isMounted = false;  //  标记组件已卸载（防止异步渲染继续）
    
    if (component) {
      component.unload();
      component = null;
    }
  });
</script>

<div 
  class="weave-obsidian-renderer markdown-reading-view markdown-rendered"
  class:rendering={isRendering}
  class:has-error={!!renderError}
  bind:this={container}
>
  {#if isRendering}
    <div class="weave-render-loading">
      <div class="loading-spinner"></div>
      <span class="loading-text">正在渲染内容...</span>
    </div>
  {/if}
</div>

<style>
  .weave-obsidian-renderer {
    width: 100%;
    min-height: 1rem;
    position: relative;
    line-height: 1.6;
    color: var(--text-normal);
  }

  .weave-obsidian-renderer.rendering {
    opacity: 0.7;
    pointer-events: none;
  }

  .weave-obsidian-renderer.has-error {
    border: 1px solid var(--text-error);
    border-radius: var(--radius-s);
    background: var(--background-modifier-error);
  }

  /* 加载状态 */
  .weave-render-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-text {
    font-size: 0.875rem;
  }

  /* 错误状态 */
  :global(.weave-render-error) {
    padding: 1rem;
    text-align: center;
    color: var(--text-error);
  }

  :global(.error-icon) {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  :global(.error-message) {
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  :global(.error-fallback) {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--background-secondary);
    padding: 0.5rem;
    border-radius: var(--radius-s);
    white-space: pre-wrap;
    text-align: left;
  }

  /*  新挖空样式 - 基于Obsidian的<mark>元素 */
  :global(.weave-cloze-mark) {
    padding: 2px 6px;
    margin: 0 2px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    display: inline-block;
  }

  /* 隐藏状态 - 使用半透明背景和模糊文本 */
  :global(.weave-cloze-mark.weave-cloze-hidden) {
    background: linear-gradient(135deg,
      rgba(255, 165, 0, 0.3) 0%,
      rgba(255, 165, 0, 0.15) 100%);
    color: transparent;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
    border: 1px dashed var(--color-orange, #ff8c00);
    user-select: none;
  }

  /* 悬停时临时显示 */
  :global(.weave-cloze-mark.weave-cloze-hidden:hover) {
    background: linear-gradient(135deg,
      rgba(255, 165, 0, 0.5) 0%,
      rgba(255, 165, 0, 0.25) 100%);
    color: var(--text-normal);
    text-shadow: none;
    border: 1px solid var(--color-orange, #ff8c00);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* 焦点状态 */
  :global(.weave-cloze-mark.weave-cloze-hidden:focus) {
    outline: 2px solid var(--color-orange, #ff8c00);
    outline-offset: 2px;
  }

  /*  移除 !important：已显示状态使用更具体的选择器 */
  .weave-obsidian-renderer :global(.weave-cloze-mark.weave-cloze-revealed),
  .weave-obsidian-renderer :global(.weave-cloze-mark.weave-cloze-revealed:hover) {
    background: linear-gradient(135deg,
      rgba(16, 185, 129, 0.2) 0%,
      rgba(16, 185, 129, 0.1) 100%);
    color: var(--text-normal);
    text-shadow: none;
    border: 1px solid var(--color-green, #10b981);
    user-select: text;
    transform: none;
    animation: revealAnimation 0.3s ease-out;
  }

  @keyframes revealAnimation {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /*  带提示的挖空样式（Anki格式：{{c1::text::hint}}） */
  :global(.weave-cloze-mark[data-hint]) {
    position: relative;
  }

  /* 提示图标：在挖空右上角显示小图标 */
  :global(.weave-cloze-mark[data-hint]::after) {
    content: '💡';
    position: absolute;
    top: -8px;
    right: -8px;
    font-size: 10px;
    opacity: 0.6;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  /* 悬停时提示图标更明显 */
  :global(.weave-cloze-mark[data-hint]:hover::after) {
    opacity: 1;
  }

  /* 带提示的挖空使用特殊的边框样式 */
  :global(.weave-cloze-mark[data-hint].weave-cloze-hidden) {
    border-style: dotted;
    border-width: 2px;
  }

  /* 显示提示信息的tooltip样式增强 */
  :global(.weave-cloze-mark[data-hint][title]:hover) {
    cursor: help;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    :global(.weave-cloze-mark) {
      padding: 4px 8px;
      margin: 2px;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
    }
  }

  /* 减少动画偏好 */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }

    :global(.weave-cloze-mark) {
      transition: none;
    }

    :global(.weave-cloze-revealed) {
      animation: none;
    }
  }

  /* 高对比度模式 */
  @media (prefers-contrast: high) {
    :global(.weave-cloze-mark.weave-cloze-hidden) {
      background: var(--color-orange, #ff8c00);
      color: var(--text-on-accent);
      border: 2px solid var(--text-normal);
    }

    :global(.weave-cloze-mark.weave-cloze-revealed) {
      background: var(--color-green, #10b981);
      color: var(--text-on-accent);
      border: 2px solid var(--text-normal);
    }
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

  /*  移除 !important：脚注内容使用更具体的选择器 */
  .weave-obsidian-renderer :global(.weave-qa-content .footnotes),
  .weave-obsidian-renderer :global(.weave-cloze-content .footnotes),
  .weave-obsidian-renderer :global(.weave-choice-content .footnotes) {
    display: block;
    visibility: visible;
  }

  /*  P0修复：表格边框样式 - 确保Obsidian表格在预览中正确显示边框 */
  .weave-obsidian-renderer :global(table) {
    border-collapse: collapse;
    margin: 1em 0;
  }

  .weave-obsidian-renderer :global(.weave-table-scroll) {
    overflow-x: auto;
    max-width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  .weave-obsidian-renderer :global(.weave-table-scroll > table) {
    width: max-content;
    min-width: 100%;
    max-width: none;
  }

  .weave-obsidian-renderer :global(table th),
  .weave-obsidian-renderer :global(table td) {
    border: 1px solid var(--background-modifier-border);
    padding: 8px 12px;
    text-align: left;
  }

  .weave-obsidian-renderer :global(table th) {
    background: var(--background-secondary);
    font-weight: 600;
  }

  .weave-obsidian-renderer :global(table tr:nth-child(even)) {
    background: var(--background-secondary-alt, var(--background-primary-alt));
  }

  .weave-obsidian-renderer :global(table tr:hover) {
    background: var(--background-modifier-hover);
  }
</style>
