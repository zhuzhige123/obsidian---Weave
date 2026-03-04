<!--
  懒渲染网格卡片组件
  只在进入视口时才真正渲染Markdown内容
  默认显示骨架屏，性能极佳
-->
<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import { MarkdownRenderer, Component, Platform } from 'obsidian';
  import type { Card } from '../../data/types';
  import type { WeavePlugin } from '../../main';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  // 🆕 导入挖空处理工具
  import { stripClozeForDisplay } from '../../utils/cloze-utils';
  // 🆕 导入 YAML 解析工具（用于获取来源文档）
  import { parseSourceInfo } from '../../utils/yaml-utils';

  type GridCardAttributeType = 'none' | 'uuid' | 'source' | 'priority' | 'retention' | 'modified';
  
  interface Props {
    card: Card;
    selected?: boolean;
    plugin: WeavePlugin;
    layoutMode?: 'fixed' | 'masonry';
    attributeType?: GridCardAttributeType;
    isMobile?: boolean; // 🆕 从父组件传递移动端状态
    onClick?: (card: Card) => void;
    onEdit?: (card: Card) => void;
    onDelete?: (card: Card) => void;
    onView?: (card: Card) => void;
    onSourceJump?: (card: Card) => void; // 🆕 源文档跳转
    onLongPress?: (card: Card) => void; // 🆕 长按触发多选
  }

  let {
    card,
    selected = false,
    plugin,
    layoutMode = 'fixed',
    attributeType = 'uuid',
    isMobile: isMobileProp = false, // 🆕 接收父组件传递的移动端状态
    onClick,
    onEdit,
    onDelete,
    onView,
    onSourceJump,
    onLongPress
  }: Props = $props();
  
  // 🆕 移动端检测函数 - 必须在使用前定义
  function detectMobile(): boolean {
    // 1. 如果 prop 已经是 true，直接返回
    if (isMobileProp) {
      return true;
    }
    // 2. Platform.isMobile - Obsidian 官方 API（最可靠）
    if (Platform.isMobile) {
      return true;
    }
    // 3. body classes - Obsidian 移动端会添加这些类
    if (typeof document !== 'undefined') {
      const body = document.body;
      if (body.classList.contains('is-mobile') || 
          body.classList.contains('is-phone') || 
          body.classList.contains('is-tablet')) {
        return true;
      }
    }
    // 4. 触摸屏检测（备用方案）
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      return true;
    }
    // 5. 用户代理检测（最后手段）
    if (typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return true;
    }
    // 6. 屏幕宽度检测（移动端通常 < 768px）
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return true;
    }
    return false;
  }
  
  //  修复：移动端检测 - 初始化时就调用 detectMobile()
  // 这样可以确保在组件渲染时就有正确的 isMobile 值
  let isMobile = $state(detectMobile());
  
  // 🆕 监听 prop 变化
  $effect(() => {
    if (isMobileProp) {
      isMobile = true;
    }
  });
  


  // 状态管理
  let cardElement = $state<HTMLElement>();
  let contentElement = $state<HTMLElement>();
  let hasRendered = $state(false); // 是否已渲染
  let isRendering = $state(false); // 正在渲染中
  let clickTimer: NodeJS.Timeout | null = null;
  let isHovered = $state(false);
  let contentComponent: Component | null = null;
  let observer: IntersectionObserver | null = null;
  
  // 🆕 长按检测状态
  let longPressTimer: NodeJS.Timeout | null = null;
  let isLongPressTriggered = $state(false);
  const LONG_PRESS_DURATION = 500; // 长按阈值：500ms
  
  // 🆕 移动端功能键显示状态（单击显示/隐藏）
  let showMobileActions = $state(false);

  // 计算属性
  const frontText = $derived(card.fields?.front || card.fields?.question || '');
  const backText = $derived(card.fields?.back || card.fields?.answer || '');
  const tags = $derived(card.tags || []);
  //  修复：优先从 content YAML 解析来源文档（Content-Only 架构）
  const sourceDocument = $derived.by(() => {
    // 1. 优先从 content 的 YAML frontmatter 解析 we_source
    if (card.content) {
      const sourceInfo = parseSourceInfo(card.content);
      if (sourceInfo.sourceFile) {
        // 移除 .md 后缀用于显示
        return sourceInfo.sourceFile.replace(/\.md$/, '');
      }
    }
    // 2. 兼容旧架构：从 sourceFile 字段获取
    if (card.sourceFile) {
      return card.sourceFile.replace(/\.md$/, '');
    }
    // 3. 兼容 Anki 同步格式
    if (card.fields?.source_document) {
      return card.fields.source_document as string;
    }
    return '';
  });
  
  //  修复：合并完整内容 - 优先使用 content 字段
  // 渐进式挖空卡片的内容存储在 card.content，而非 fields
  const fullContent = $derived.by(() => {
    // 1. 优先使用原始 content 字段（包含渐进式挖空、语义标记等）
    if (card.content && card.content.trim()) {
      return stripClozeForDisplay(card.content);
    }
    
    // 2. 回退到 fields（Anki 同步格式的卡片）
    const front = frontText.trim();
    const back = backText.trim();
    
    if (!front && !back) return '';
    if (!back) return stripClozeForDisplay(front);
    
    const merged = `${front}\n\n---\n\n${back}`;
    return stripClozeForDisplay(merged);
  });
  
  // 获取源文件路径
  const sourcePath = $derived.by(() => {
    if (card.fields?.source_document) {
      const doc = card.fields.source_document as string;
      if (doc.endsWith('.md')) return doc;
      return `${doc}.md`;
    }
    if (card.customFields?.obsidianFilePath) {
      return card.customFields.obsidianFilePath as string;
    }
    return '';
  });
  
  // 检查是否有源文档可跳转（使用 sourceDocument 的结果）
  const hasSourceDocument = $derived.by(() => {
    return !!sourceDocument;
  });
  
  // 根据标签名生成颜色
  function getTagColor(tag: string): string {
    const colors = ['blue', 'purple', 'pink', 'red', 'orange', 'green', 'cyan', 'gray'];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
  
  // UUID 显示格式
  const displayUuid = $derived.by(() => {
    const uuid = card.uuid;
    if (uuid.length > 12) {
      return `${uuid.slice(0, 8)}...${uuid.slice(-4)}`;
    }
    return uuid;
  });
  
  // 🆕 根据属性类型获取显示内容
  const attributeDisplay = $derived.by(() => {
    if (attributeType === 'none') return null;
    
    switch (attributeType) {
      case 'uuid':
        return { label: 'ID', value: displayUuid, icon: 'hash' };
      
      case 'source':
        const source = sourceDocument || '未知来源';
        return { label: '来源', value: source.length > 20 ? source.slice(0, 20) + '...' : source, icon: null };
      
      case 'priority':
        const priority = card.priority || 0;
        const priorityText = priority === 3 ? '高' : priority === 2 ? '中' : priority === 1 ? '低' : '无';
        return { label: '优先级', value: priorityText, icon: 'flag' };
      
      case 'retention':
        const retention = card.fsrs?.retrievability ? Math.round(card.fsrs.retrievability * 100) : 0;
        return { label: '记忆率', value: `${retention}%`, icon: 'activity' };
      
      case 'modified':
        const modifiedStr = card.modified || card.created || new Date().toISOString();
        const date = new Date(modifiedStr);
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
        return { label: '修改', value: formattedDate, icon: 'clock' };
      
      default:
        return null;
    }
  });

  /**
   * 渲染 Markdown 内容
   */
  async function renderMarkdown() {
    if (!contentElement || !plugin?.app || isRendering || contentComponent) {
      return;
    }
    
    isRendering = true;
    
    try {
      contentElement.innerHTML = '';
      
      const component = new Component();
      
      //  获取内容（已在 fullContent 中处理挖空语法）
      const content = fullContent;
      
      await MarkdownRenderer.render(
        plugin.app,
        content,
        contentElement,
        sourcePath,
        component
      );
      
      component.load();
      contentComponent = component;
      
    } catch (error) {
      logger.error('[LazyGridCard] Render failed:', error);
      if (contentElement) {
        //  降级处理：显示纯文本（已在 fullContent 中处理挖空语法）
        contentElement.textContent = fullContent;
      }
    } finally {
      isRendering = false;
    }
  }

  /**
   * 处理卡片点击
   * 桌面端：单击 = 选中/跳转（根据模式），双击 = 编辑
   * 移动端：单击 = 显示/隐藏功能键，双击 = 编辑，长按 = 多选
   */
  function handleCardClick(event: MouseEvent) {
    // 如果点击的是标签、源文档显示区或操作按钮，忽略点击
    if ((event.target as HTMLElement).closest('.card-tags, .card-source, .card-actions')) {
      return;
    }
    
    // 🆕 如果刚触发了长按，忽略这次点击
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }

    // 移动端和桌面端统一处理：双击编辑
    if (clickTimer) {
      // 双击触发编辑
      clearTimeout(clickTimer);
      clickTimer = null;
      // 移动端双击时隐藏功能键
      if (isMobile) {
        showMobileActions = false;
      }
      onEdit?.(card);
      return;
    }
    
    // 首次点击，设置延迟触发单击事件
    clickTimer = setTimeout(() => {
      if (isMobile) {
        //  移动端：单击切换功能键显示状态
        showMobileActions = !showMobileActions;
        
        // 如果显示了功能键，通知其他卡片隐藏它们的功能键
        if (showMobileActions) {
          window.dispatchEvent(new CustomEvent('Weave:hide-other-card-actions', {
            detail: { cardUuid: card.uuid }
          }));
        }
      } else {
        //  桌面端：单击选中
        onClick?.(card);
      }
      clickTimer = null;
    }, 250);
  }
  
  /**
   * 🆕 监听其他卡片的功能键隐藏事件
   */
  function handleHideOtherCardActions(event: CustomEvent<{ cardUuid: string }>) {
    // 如果不是当前卡片触发的事件，隐藏本卡片的功能键
    if (event.detail.cardUuid !== card.uuid) {
      showMobileActions = false;
    }
  }

  function handleMouseEnter() {
    isHovered = true;
  }

  function handleMouseLeave() {
    isHovered = false;
  }
  
  function handleEdit(event: MouseEvent) {
    // Svelte 5: 编辑操作不需要 stopPropagation
    onEdit?.(card);
  }
  
  function handleDelete(event: MouseEvent) {
    // Svelte 5: 删除操作不需要 stopPropagation
    onDelete?.(card);
  }
  
  function handleView(event: MouseEvent) {
    // Svelte 5: 查看操作不需要 stopPropagation
    onView?.(card);
  }
  
  // 🆕 处理源文档跳转
  function handleSourceJump(event: MouseEvent) {
    event.stopPropagation();
    onSourceJump?.(card);
  }
  
  // 🆕 长按开始（触摸开始）
  function handleTouchStart(event: TouchEvent) {
    if (!isMobile || !onLongPress) return;
    
    isLongPressTriggered = false;
    
    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      // 触发长按回调（多选）
      onLongPress(card);
      // 震动反馈（如果支持）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION);
  }
  
  // 🆕 长按结束（触摸结束/取消）
  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
  
  // 🆕 触摸移动时取消长按
  function handleTouchMove() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  /**
   * 监听hasRendered变化，当为true时渲染Markdown
   */
  $effect(() => {
    if (hasRendered && contentElement && !contentComponent) {
      // 使用setTimeout确保DOM完全更新
      setTimeout(() => {
        renderMarkdown();
      }, 0);
    }
  });

  /**
   * 组件挂载时设置Intersection Observer
   */
  onMount(() => {
    if (!cardElement) return;
    
    // 🆕 重新检测移动端状态
    // 优先使用父组件传递的值，否则自行检测
    if (!isMobile) {
      isMobile = detectMobile();
    }
    
    // 🆕 监听其他卡片的功能键隐藏事件
    window.addEventListener('Weave:hide-other-card-actions', handleHideOtherCardActions as EventListener);
    
    // 创建专属于这张卡片的Observer
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !hasRendered) {
            // 标记为已渲染，防止重复
            hasRendered = true;
            
            // 渲染后断开观察，节省资源
            observer?.disconnect();
          }
        });
      },
      {
        root: null, // 使用视口
        rootMargin: '500px', // 提前500px开始渲染
        threshold: 0 // 任何部分进入范围就触发
      }
    );
    
    observer.observe(cardElement);
    
    return () => {
      observer?.disconnect();
      contentComponent?.unload();
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
      // 清理长按定时器
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      // 🆕 移除事件监听
      window.removeEventListener('Weave:hide-other-card-actions', handleHideOtherCardActions as EventListener);
    };
  });
  
  /**
   * 组件销毁时清理
   */
  onDestroy(() => {
    observer?.disconnect();
    contentComponent?.unload();
  });
</script>

<div
  bind:this={cardElement}
  class="lazy-grid-card"
  class:selected
  class:hovered={isHovered}
  class:fixed-height={layoutMode === 'fixed'}
  class:masonry={layoutMode === 'masonry'}
  class:rendering={isRendering}
  onclick={handleCardClick}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
  ontouchmove={handleTouchMove}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && handleCardClick(e as any)}
>
  <!-- 选中标记 -->
  {#if selected}
    <div class="selected-indicator">
      <div class="checkmark-circle">
        <EnhancedIcon name="check" size={14} />
      </div>
    </div>
  {/if}

  <!-- 🆕 动态属性显示（左上角） -->
  {#if attributeDisplay}
    <div class="card-attribute" title={attributeDisplay?.label}>
      {#if attributeDisplay?.icon}
        <EnhancedIcon name={attributeDisplay.icon} size={12} />
      {/if}
      <span>{attributeDisplay?.value}</span>
    </div>
  {/if}

  <!-- 🆕 功能菜单（右上角） -->
  <!-- 桌面端：悬停显示 -->
  <!-- 移动端：单击卡片显示/隐藏 -->
  <div 
    class="card-actions" 
    class:hovered={isHovered} 
    class:mobile={isMobile}
    class:mobile-visible={isMobile && showMobileActions}
  >
    {#if onSourceJump && hasSourceDocument}
      <button class="action-menu-item" onclick={handleSourceJump} title="跳转到源文档">
        <EnhancedIcon name="file-text" size={16} />
      </button>
    {/if}
    {#if onEdit}
      <button class="action-menu-item" onclick={handleEdit} title="编辑">
        <EnhancedIcon name="edit" size={16} />
      </button>
    {/if}
    {#if onView}
      <button class="action-menu-item" onclick={handleView} title="查看">
        <EnhancedIcon name="eye" size={16} />
      </button>
    {/if}
    {#if onDelete}
      <button class="action-menu-item danger" onclick={handleDelete} title="删除">
        <EnhancedIcon name="trash-2" size={16} />
      </button>
    {/if}
  </div>

  <!-- 卡片内容 -->
  <div class="card-body">
    {#if hasRendered}
      <!-- 真正的Markdown渲染 -->
      <div 
        bind:this={contentElement}
        class="content-area markdown-rendered"
      ></div>
    {:else}
      <!-- 骨架屏占位 -->
      <div class="skeleton-placeholder">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line medium"></div>
      </div>
    {/if}
  </div>

  <!-- 卡片底部 - 只有标签时才显示，避免空div边框残留 -->
  {#if tags.length > 0}
    <div class="card-footer">
      <div class="card-tags">
        {#each tags.slice(0, 3) as tag}
          <span class="tag tag-{getTagColor(tag)}">{tag}</span>
        {/each}
        {#if tags.length > 3}
          <span class="tag-more">+{tags.length - 3}</span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- 选中遮罩 -->
  {#if selected}
    <div class="selected-overlay"></div>
  {/if}
</div>

<style>
  .lazy-grid-card {
    position: relative;
    background: var(--background-primary);
    /*  不依赖变量，直接使用box-shadow实现边框 */
    border: none;
    border-radius: var(--weave-radius-lg);
    padding: var(--weave-space-md);
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* 固定高度模式 */
  .lazy-grid-card.fixed-height {
    height: 280px;
  }

  .lazy-grid-card.fixed-height .card-body {
    flex: 1;
    overflow: hidden;
  }

  .lazy-grid-card.fixed-height .content-area {
    max-height: 200px;
  }

  /* 瀑布流模式 */
  .lazy-grid-card.masonry {
    height: auto;
    min-height: 200px;
  }

  .lazy-grid-card.masonry .content-area {
    max-height: none;
  }

  /*  深色模式边框 - 精细调整，美观实用 */
  :global(body.theme-dark) .lazy-grid-card {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  }

  /*  浅色模式边框 - 精细调整，美观实用 */
  :global(body.theme-light) .lazy-grid-card {
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
  }
  
  /*  默认边框（兜底方案） */
  .lazy-grid-card {
    box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.2);
  }

  /* 悬停效果 - 深色模式 */
  :global(body.theme-dark) .lazy-grid-card:hover,
  :global(body.theme-dark) .lazy-grid-card.hovered {
    box-shadow: 
      inset 0 0 0 1px var(--interactive-accent),
      0 2px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  /* 悬停效果 - 浅色模式 */
  :global(body.theme-light) .lazy-grid-card:hover,
  :global(body.theme-light) .lazy-grid-card.hovered {
    box-shadow: 
      inset 0 0 0 1px var(--interactive-accent),
      0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  
  /* 🆕 移动端禁用 hover 效果 - 避免触摸时触发浮动动画 */
  :global(body.is-mobile) .lazy-grid-card:hover,
  :global(body.is-phone) .lazy-grid-card:hover,
  :global(body.is-tablet) .lazy-grid-card:hover {
    transform: none;
  }
  
  /* 使用媒体查询作为备用方案 */
  @media (hover: none) and (pointer: coarse) {
    .lazy-grid-card:hover {
      transform: none;
    }
  }

  /* 选中效果 - 通用，更精细 */
  :global(body.theme-dark) .lazy-grid-card.selected,
  :global(body.theme-light) .lazy-grid-card.selected {
    box-shadow: 
      inset 0 0 0 2px var(--interactive-accent),
      0 0 0 1px color-mix(in srgb, var(--interactive-accent) 30%, transparent);
  }

  /* 选中标记 - 移至顶部中间 */
  .selected-indicator {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
  }

  .checkmark-circle {
    width: 24px;
    height: 24px;
    background: var(--interactive-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: var(--weave-shadow-sm);
  }

  .selected-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
    pointer-events: none;
    z-index: 1;
  }

  /* 🆕 卡片属性显示（左上角） */
  .card-attribute {
    position: absolute;
    top: 8px;
    left: 8px;
    /*  固定高度，与右侧操作按钮对齐 */
    height: 28px;
    font-size: var(--weave-font-size-xs);
    font-weight: 500;
    color: var(--text-muted);
    /*  使用与卡片内容区相同的背景色，消除色差 */
    background: var(--background-primary);
    padding: 0 8px;
    border-radius: var(--weave-radius-sm);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 4px;
    /*  移除边框，使用透明边框保持布局一致 */
    border: none;
    transition: all 0.2s ease;
  }

  .card-attribute:hover {
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
  }

  /* 🆕 功能菜单（右上角） */
  .card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    /*  固定高度，与左侧属性标签对齐 */
    height: 28px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 4px;
    /* 桌面端默认隐藏，悬停时显示 */
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  /*  桌面端：悬停时显示功能键 */
  .lazy-grid-card:hover .card-actions:not(.mobile),
  .card-actions.hovered:not(.mobile) {
    opacity: 1;
    pointer-events: auto;
  }

  .menu-button {
    width: 28px;
    height: 28px;
    /*  使用与卡片内容区相同的背景色 */
    background: var(--background-primary);
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--text-muted);
  }

  .menu-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .action-menu {
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideInLeft 0.2s ease-out;
  }

  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /*  操作按钮 - 使用 Obsidian clickable-icon 风格
   * 完全透明背景，无边框无阴影，仅在 hover/active 时显示背景
   * 通过高特异性选择器覆盖全局样式，避免使用 !important
   */
  .lazy-grid-card .card-actions .action-menu-item {
    /*  28px 尺寸，与左侧属性标签高度一致 */
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    /*  完全透明背景，像 Obsidian clickable-icon 一样 */
    background: transparent;
    border: none;
    box-shadow: none;
    outline: none;
    border-radius: var(--radius-s, 4px);
    cursor: pointer;
    color: var(--text-muted);
    transition: color 0.15s ease, background 0.15s ease;
  }

  .lazy-grid-card .card-actions .action-menu-item:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .lazy-grid-card .card-actions .action-menu-item.danger {
    color: var(--text-error);
  }

  .lazy-grid-card .card-actions .action-menu-item.danger:hover {
    background: color-mix(in srgb, var(--text-error) 15%, transparent);
  }
  
  /*  移动端按钮样式优化 - 更大的点击区域，但视觉尺寸与桌面端一致 */
  :global(body.is-mobile) .lazy-grid-card .card-actions .action-menu-item,
  :global(body.is-phone) .lazy-grid-card .card-actions .action-menu-item,
  :global(body.is-tablet) .lazy-grid-card .card-actions .action-menu-item {
    /*  视觉尺寸保持 28px，与左侧属性标签对齐 */
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    /*  确保完全透明，无边框无阴影 */
    background: transparent;
    border: none;
    box-shadow: none;
    /*  通过 padding 扩大触控区域到 44px，但不影响视觉尺寸 */
    position: relative;
  }
  
  /*  移动端：使用伪元素扩大触控区域 */
  :global(body.is-mobile) .lazy-grid-card .card-actions .action-menu-item::before,
  :global(body.is-phone) .lazy-grid-card .card-actions .action-menu-item::before,
  :global(body.is-tablet) .lazy-grid-card .card-actions .action-menu-item::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
  }
  
  :global(body.is-mobile) .lazy-grid-card .card-actions .action-menu-item:active,
  :global(body.is-phone) .lazy-grid-card .card-actions .action-menu-item:active,
  :global(body.is-tablet) .lazy-grid-card .card-actions .action-menu-item:active {
    transform: scale(0.92);
    background: var(--background-modifier-hover);
  }
  
  :global(body.is-mobile) .lazy-grid-card .card-actions,
  :global(body.is-phone) .lazy-grid-card .card-actions,
  :global(body.is-tablet) .lazy-grid-card .card-actions {
    gap: 2px;
  }

  /* 卡片主体 */
  .card-body {
    margin-top: 32px;
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 2;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    color: var(--text-normal);
    font-size: var(--weave-font-size-sm);
    line-height: 1.6;
    word-break: break-word;
    overflow: hidden;
  }

  /* 骨架屏 */
  .skeleton-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: var(--weave-space-sm) 0;
  }

  .skeleton-line {
    height: 14px;
    background: linear-gradient(
      90deg,
      var(--background-modifier-border) 25%,
      var(--background-modifier-hover) 50%,
      var(--background-modifier-border) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite ease-in-out;
    border-radius: 4px;
  }

  .skeleton-line.short {
    width: 60%;
  }

  .skeleton-line.medium {
    width: 80%;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* 渲染状态 */
  .lazy-grid-card.rendering {
    opacity: 0.9;
  }

  /* Markdown 渲染样式 */
  .content-area.markdown-rendered :global(p) {
    margin: 0.25em 0;
  }

  .content-area.markdown-rendered :global(hr) {
    margin: var(--weave-space-md) 0;
    border: none;
    border-top: 2px dashed var(--weave-border);
    opacity: 0.5;
  }

  .content-area.markdown-rendered :global(img),
  .content-area.markdown-rendered :global(video) {
    max-width: 100%;
    height: auto;
    border-radius: var(--weave-radius-sm);
    margin: var(--weave-space-xs) 0;
  }

  /* 卡片底部 */
  .card-footer {
    margin-top: auto;
    padding-top: 2px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    position: relative;
    z-index: 2;
  }

  /* 标签 */
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  .tag {
    font-size: var(--weave-font-size-xs);
    padding: 1px 6px;
    border-radius: var(--weave-radius-sm);
    font-weight: 500;
    line-height: 1.3;
  }

  /* 多彩标签 */
  .tag-blue { background: var(--weave-tag-blue-bg); color: var(--weave-tag-blue-text); border: 1px solid var(--weave-tag-blue-border); }
  .tag-purple { background: var(--weave-tag-purple-bg); color: var(--weave-tag-purple-text); border: 1px solid var(--weave-tag-purple-border); }
  .tag-pink { background: var(--weave-tag-pink-bg); color: var(--weave-tag-pink-text); border: 1px solid var(--weave-tag-pink-border); }
  .tag-red { background: var(--weave-tag-red-bg); color: var(--weave-tag-red-text); border: 1px solid var(--weave-tag-red-border); }
  .tag-orange { background: var(--weave-tag-orange-bg); color: var(--weave-tag-orange-text); border: 1px solid var(--weave-tag-orange-border); }
  .tag-green { background: var(--weave-tag-green-bg); color: var(--weave-tag-green-text); border: 1px solid var(--weave-tag-green-border); }
  .tag-cyan { background: var(--weave-tag-cyan-bg); color: var(--weave-tag-cyan-text); border: 1px solid var(--weave-tag-cyan-border); }
  .tag-gray { background: var(--weave-tag-gray-bg); color: var(--weave-tag-gray-text); border: 1px solid var(--weave-tag-gray-border); }

  .tag-more {
    font-size: var(--weave-font-size-xs);
    color: var(--weave-text-faint);
    font-weight: 500;
  }

</style>

