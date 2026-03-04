<script lang="ts">
  import { logger } from '../../utils/logger';
  //  v2.1.1: 静态导入 parseSourceInfo（修复响应式问题）
  import { parseSourceInfo } from '../../utils/yaml-utils';

  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import FloatingMenu from "../ui/FloatingMenu.svelte";
  import ObsidianDropdown from "../ui/ObsidianDropdown.svelte";
  import type { Card } from "../../data/types";
  import type { WeavePlugin } from "../../main";
  import { tr } from '../../utils/i18n';
  import { MarkdownView, Notice } from "obsidian";

  interface Props {
    card: Card;
    currentCardTime: number;
    averageTime: number;
    plugin?: WeavePlugin;
    isEditing?: boolean;
    tempFileUnavailable?: boolean;
    compactMode?: boolean;
    compactModeSetting?: 'auto' | 'fixed';
    onCompactModeSettingChange?: (setting: 'auto' | 'fixed') => void;
    onToggleEdit?: () => void;
    onDelete?: (skipConfirm?: boolean) => void;
    onToggleFavorite?: () => void;
    onChangePriority?: () => void;
    onOpenPlainEditor?: () => void;
    onOpenDetailedView?: () => void;
    onOpenCardDebug?: () => void;
    enableDirectDelete?: boolean;
    onDirectDeleteToggle?: (enabled: boolean) => void;
    questionOrder?: 'sequential' | 'random';
    onQuestionOrderChange?: (order: 'sequential' | 'random') => void;
    navColumnMode?: 1 | 3;
    onNavColumnModeChange?: (mode: 1 | 3) => void;
  }

  let {
    card,
    currentCardTime,
    averageTime,
    plugin,
    isEditing = false,
    tempFileUnavailable = false,
    compactMode = false,
    compactModeSetting = 'fixed',
    onCompactModeSettingChange,
    onToggleEdit,
    onDelete,
    onToggleFavorite,
    onChangePriority,
    onOpenPlainEditor,
    onOpenDetailedView,
    onOpenCardDebug,
    enableDirectDelete = false,
    onDirectDeleteToggle,
    questionOrder = 'sequential',
    onQuestionOrderChange,
    navColumnMode = 3,
    onNavColumnModeChange
  }: Props = $props();

  let t = $derived($tr);

  // v4.0: 侧边栏功能键长按拖拽排序
  let isDraggingButton = $state(false);
  let draggedButtonElement = $state<HTMLElement | null>(null);
  let dragStartY = $state(0);
  let dragCurrentY = $state(0);
  let longPressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  const LONG_PRESS_DURATION = 500;
  
  function handleButtonLongPressStart(e: MouseEvent | TouchEvent, element: HTMLElement) {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY = clientY;
    
    longPressTimer = setTimeout(() => {
      isDraggingButton = true;
      draggedButtonElement = element;
      element.classList.add('dragging');
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION);
  }
  
  function handleButtonDragMove(e: MouseEvent | TouchEvent) {
    if (!isDraggingButton || !draggedButtonElement) return;
    
    e.preventDefault();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragCurrentY = clientY;
    
    const deltaY = dragCurrentY - dragStartY;
    draggedButtonElement.style.transform = `translateY(${deltaY}px)`;
    draggedButtonElement.style.zIndex = '100';
    
    const parent = draggedButtonElement.parentElement;
    if (!parent) return;
    
    const buttons = Array.from(parent.querySelectorAll('.toolbar-btn:not(.dragging)')) as HTMLElement[];
    const draggedRect = draggedButtonElement.getBoundingClientRect();
    const draggedCenter = draggedRect.top + draggedRect.height / 2;
    
    for (const btn of buttons) {
      const btnRect = btn.getBoundingClientRect();
      const btnCenter = btnRect.top + btnRect.height / 2;
      
      if (deltaY > 0 && draggedCenter > btnCenter && btn.compareDocumentPosition(draggedButtonElement) & Node.DOCUMENT_POSITION_PRECEDING) {
        parent.insertBefore(btn, draggedButtonElement);
        dragStartY = dragCurrentY;
        draggedButtonElement.style.transform = '';
        break;
      } else if (deltaY < 0 && draggedCenter < btnCenter && btn.compareDocumentPosition(draggedButtonElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
        parent.insertBefore(draggedButtonElement, btn);
        dragStartY = dragCurrentY;
        draggedButtonElement.style.transform = '';
        break;
      }
    }
  }
  
  function handleButtonDragEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    if (isDraggingButton && draggedButtonElement) {
      draggedButtonElement.classList.remove('dragging');
      draggedButtonElement.style.transform = '';
      draggedButtonElement.style.zIndex = '';
    }
    
    isDraggingButton = false;
    draggedButtonElement = null;
  }

  //  v2.1.1: 响应式来源信息 - 使用统一的 parseSourceInfo 工具函数
  //  修复：使用静态 import 确保响应式追踪正常工作
  let sourceInfo = $derived.by(() => {
    const content = card?.content;
    if (!content) return { sourceFile: card?.sourceFile, sourceBlock: card?.sourceBlock };
    
    const parsed = parseSourceInfo(content);
    return {
      sourceFile: parsed.sourceFile || card?.sourceFile,
      sourceBlock: parsed.sourceBlock || card?.sourceBlock
    };
  });

  // 格式化学习时间
  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 获取重要程度颜色
  function getPriorityColor(priority: number): string {
    switch (priority) {
      case 1: return "#fbbf24";
      case 2: return "#60a5fa";
      case 3: return "#f97316";
      case 4: return "#ef4444";
      default: return "#60a5fa";
    }
  }

  // 获取重要程度星级
  function getPriorityStars(priority: number): number {
    return Math.min(Math.max(priority, 1), 4);
  }

  // 多功能信息键
  let showMultiInfoMenu = $state(false);
  let multiInfoButtonElement: HTMLElement | null = $state(null);

  //  新增：源卡片信息
  let sourceCard = $state<Card | null>(null);
  let isLoadingSourceCard = $state(false);

  // 更多设置菜单
  let showMoreSettingsMenu = $state(false);
  let moreSettingsButtonElement: HTMLElement | null = $state(null);

  // 使用教程菜单
  let showTutorialMenu = $state(false);
  let tutorialButtonElement: HTMLElement | null = $state(null);
  let activeTutorialTab = $state<'tutorial' | 'algorithm'>('tutorial');

  function toggleMultiInfoMenu() {
    showMultiInfoMenu = !showMultiInfoMenu;
  }

  function toggleMoreSettingsMenu() {
    showMoreSettingsMenu = !showMoreSettingsMenu;
  }

  function toggleTutorialMenu() {
    showTutorialMenu = !showTutorialMenu;
  }

  function switchTutorialTab(tab: 'tutorial' | 'algorithm') {
    activeTutorialTab = tab;
  }

  // 获取来源信息
  function getSourceInfo() {
    return {
      sourceFile: card?.sourceFile,
      sourceBlock: card?.sourceBlock,
      sourceCardId: card?.metadata?.sourceCardId as string | undefined  //  新增：源记忆卡片ID
    };
  }

  //  新增：查询源卡片内容
  async function loadSourceCard() {
    const sourceCardId = card?.metadata?.sourceCardId as string | undefined;
    if (!sourceCardId || !plugin) {
      return;
    }

    isLoadingSourceCard = true;
    try {
      // 通过UUID查询源卡片
      sourceCard = await plugin.dataStorage.getCardByUUID(sourceCardId);
      if (!sourceCard) {
        logger.warn('[源卡片查询] 未找到源记忆卡片');
      }
    } catch (error) {
      logger.error('[源卡片查询] 错误:', error);
    } finally {
      isLoadingSourceCard = false;
    }
  }

  //  自动加载源卡片
  $effect(() => {
    if (showMultiInfoMenu && card?.metadata?.sourceCardId && !sourceCard && !isLoadingSourceCard) {
      loadSourceCard();
    }
  });

  // 处理文件路径点击 -  v2.1.1: 使用 openLinkText 处理 wikilink 格式
  //  v2.1.2: 添加文件存在性检查，防止创建新文档
  async function handleOpenSourceFile() {
    if (!sourceInfo.sourceFile || !plugin) {
      new Notice(t('toolbar.sourceNotFound'));
      return;
    }

    const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';

    // 移除 .md 后缀，使用 wikilink 格式让 Obsidian 自动解析
    const linkText = sourceInfo.sourceFile.replace(/\.md$/, '');
    
    // 验证文件是否存在
    const file = plugin.app.metadataCache.getFirstLinkpathDest(linkText, contextPath);
    if (!file) {
      new Notice(t('toolbar.sourceNotExist'));
      return;
    }
    
    // EPUB文件：拦截到插件内置阅读器
    if (file.path.toLowerCase().endsWith('.epub')) {
      const { EpubLinkService } = await import('../../services/epub/EpubLinkService');
      const linkService = new EpubLinkService(plugin.app);
      await linkService.navigateToEpubLocation(file.path, '', '');
      new Notice('已打开EPUB源文档');
      showMultiInfoMenu = false;
      return;
    }
    
    plugin.app.workspace.openLinkText(linkText, contextPath, true);
    showMultiInfoMenu = false;
  }

  // 处理块链接点击 -  v2.1.1: 使用 Obsidian 原生 wikilink 格式跳转
  //  v2.1.2: 添加文件存在性检查，防止创建新文档
  async function handleOpenBlockLink() {
    if (!sourceInfo.sourceFile || !plugin) {
      new Notice(t('toolbar.blockNotFound'));
      return;
    }

    try {
      const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
      // 移除 .md 后缀
      const docName = sourceInfo.sourceFile.replace(/\.md$/, '');
      const blockId = sourceInfo.sourceBlock?.replace(/^\^/, '');
      
      // 验证文件是否存在
      const file = plugin.app.metadataCache.getFirstLinkpathDest(docName, contextPath);
      if (!file) {
        new Notice(t('toolbar.sourceNotExist'));
        return;
      }
      
      // 构建 wikilink 格式：文档名#^blockId
      const linkText = blockId ? `${docName}#^${blockId}` : docName;
      
      // EPUB文件：拦截到插件内置阅读器
      if (file.path.toLowerCase().endsWith('.epub')) {
        const { EpubLinkService } = await import('../../services/epub/EpubLinkService');
        const linkService = new EpubLinkService(plugin.app);
        await linkService.navigateToEpubLocation(file.path, '', '');
        new Notice('已打开EPUB源文档');
        showMultiInfoMenu = false;
        return;
      }
      
      // 使用 Obsidian 原生 API 跳转
      await plugin.app.workspace.openLinkText(linkText, contextPath, true);
      showMultiInfoMenu = false;
    } catch (error) {
      new Notice(t('toolbar.blockJumpFailed'));
    }
  }

  //  已废弃的手动定位代码（保留作为参考）
  async function _legacyOpenBlockLink() {
    if (!sourceInfo.sourceFile || !plugin) return;

    try {
      const filePath = sourceInfo.sourceFile;
      const blockId = sourceInfo.sourceBlock?.replace(/^\^/, '');
      
      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!file) return;
      
      const leaf = plugin.app.workspace.getLeaf(false);
      await leaf.openFile(file as any);
      
      if (blockId) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) {
          const content = await plugin.app.vault.read(file as any);
          const lines = content.split('\n');
          
          let targetLine = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`^${blockId}`)) {
              targetLine = i;
              break;
            }
          }
          
          if (targetLine >= 0) {
            view.editor.setCursor({ line: targetLine, ch: 0 });
            view.editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, true);
            
            const lineContent = lines[targetLine];
            const blockIdMatch = lineContent.match(/\s*\^\w+$/);
            const contentEnd = blockIdMatch ? lineContent.length - blockIdMatch[0].length : lineContent.length;
            
            view.editor.setSelection(
              { line: targetLine, ch: 0 },
              { line: targetLine, ch: contentEnd }
            );
            
            new Notice('已跳转到源文档');
          }
        }
      }
      
      showMultiInfoMenu = false;
    } catch (error) {
      logger.error('[QuestionBankVerticalToolbar] 跳转失败:', error);
      new Notice('跳转失败');
    }
  }

  // 格式化日期时间
  function formatDateTime(dateStr: string | undefined): string {
    if (!dateStr) return '未知';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '格式错误';
    }
  }

  // 获取卡片状态文本
  function getCardStateText(state: number): string {
    const stateMap: Record<number, string> = {
      0: '新卡片',
      1: '学习中',
      2: '复习中',
      3: '重学中'
    };
    return stateMap[state] || '未知';
  }

  // 删除功能
  function handleDeleteClick() {
    if (onDelete) {
      onDelete(enableDirectDelete);
    }
  }
</script>

<div class="weave-vertical-toolbar" class:compact={compactMode}>
  <!-- 计时器区域 -->
  <div class="toolbar-section timer-section">
    <div class="timer-display card-timer">
      <span class="timer-text">{formatTime(currentCardTime)}</span>
      <div class="timer-label">{t('toolbar.currentCard')}</div>
    </div>

    <div class="timer-display avg-timer">
      <span class="timer-text">{formatTime(averageTime)}</span>
      <div class="timer-label">平均用时</div>
    </div>
  </div>

  <!-- 功能按钮组（v4.0: 支持长按拖拽排序） -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="toolbar-section actions-section"
    class:is-dragging={isDraggingButton}
    onmousemove={handleButtonDragMove}
    onmouseup={handleButtonDragEnd}
    onmouseleave={handleButtonDragEnd}
    ontouchmove={handleButtonDragMove}
    ontouchend={handleButtonDragEnd}
    ontouchcancel={handleButtonDragEnd}
  >
    <!-- 编辑/预览切换按钮 -->
    <button
      class="toolbar-btn edit-btn"
      onclick={onToggleEdit}
      onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      onmouseup={handleButtonDragEnd}
      ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      title={isEditing ? "保存并预览" : "编辑卡片"}
    >
      <EnhancedIcon name={isEditing ? "eye" : "edit"} size="18" />
    </button>

    <!-- 普通文本编辑器按钮 -->
    {#if tempFileUnavailable && onOpenPlainEditor}
      <button
        class="toolbar-btn plain-editor-btn"
        onclick={onOpenPlainEditor}
        onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        onmouseup={handleButtonDragEnd}
        ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        title="普通文本编辑器"
      >
        <EnhancedIcon name="fileText" size="18" />
      </button>
    {/if}

    <!-- 删除 -->
    <button
      class="toolbar-btn delete-btn"
      onclick={handleDeleteClick}
      onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      onmouseup={handleButtonDragEnd}
      ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      title={enableDirectDelete ? "直接删除卡片" : "删除卡片"}
    >
      <EnhancedIcon name="delete" size="18" />
    </button>

    <!-- 收藏 -->
    <button
      class="toolbar-btn favorite-btn"
      class:favorited={card.tags?.includes('#收藏')}
      onclick={onToggleFavorite}
      onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      onmouseup={handleButtonDragEnd}
      ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      title={card.tags?.includes('#收藏') ? "取消收藏" : "收藏卡片"}
    >
      <EnhancedIcon name={card.tags?.includes('#收藏') ? "starFilled" : "star"} size="18" />
    </button>

    <!-- 重要程度 -->
    <button
      class="toolbar-btn priority-btn"
      onclick={onChangePriority}
      onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      onmouseup={handleButtonDragEnd}
      ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
      title="设置重要程度"
      style="color: {getPriorityColor(card.priority || 2)}"
    >
      <div class="priority-indicator">
        {'!'.repeat(Math.min(card.priority || 2, 3))}
      </div>
    </button>

    <!-- 多功能信息键 -->
    <div class="multi-info-container">
      <button
        bind:this={multiInfoButtonElement}
        class="toolbar-btn multi-info-btn"
        class:active={showMultiInfoMenu}
        onclick={toggleMultiInfoMenu}
        onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        onmouseup={handleButtonDragEnd}
        ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        title="查看卡片信息与来源"
      >
        <EnhancedIcon name="eye" size="18" />
        <span class="btn-label">查看</span>
      </button>

      <FloatingMenu
        bind:show={showMultiInfoMenu}
        anchor={multiInfoButtonElement}
        placement="bottom-start"
        onClose={() => showMultiInfoMenu = false}
        class="multi-info-menu-container"
      >
        {#snippet children()}
          {@const sourceInfo = getSourceInfo()}
          <div class="multi-info-menu-header">
            <span>卡片信息与来源</span>
            <button class="close-btn" onclick={() => showMultiInfoMenu = false}>
              <EnhancedIcon name="times" size="12" />
            </button>
          </div>

          <div class="multi-info-menu-content">
            <!-- 基础信息 -->
            <div class="info-section">
              <div class="info-section-title">基础信息</div>
              <div class="info-item">
                <span class="info-label">卡片ID</span>
                <span class="info-value">{card.uuid.slice(0, 8)}...</span>
              </div>
              <div class="info-item">
                <span class="info-label">卡片状态</span>
                <span class="info-value">{card.fsrs ? getCardStateText(card.fsrs.state) : '未知'}</span>
              </div>
            </div>

            <!-- 来源信息 -->
            <div class="info-section">
              <div class="info-section-title">来源信息</div>
              {#if !sourceInfo.sourceFile && !sourceInfo.sourceBlock && !sourceInfo.sourceCardId}
                <div class="info-item no-source">
                  <span class="info-label no-source-label">
                    无来源
                  </span>
                  <span class="info-value text-muted">{t('toolbar.noSourceLinked')}</span>
                </div>
              {:else}
                {#if sourceInfo.sourceFile}
                  <div 
                    class="info-item clickable" 
                    onclick={handleOpenSourceFile}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleOpenSourceFile()}
                    role="button"
                    tabindex="0"
                  >
                    <span class="info-label">
                      {t('toolbar.sourceDoc')}
                    </span>
                    <span class="info-value link-value" title={sourceInfo.sourceFile}>
                      {sourceInfo.sourceFile.split('/').pop() || sourceInfo.sourceFile}
                    </span>
                  </div>
                {/if}

                {#if sourceInfo.sourceBlock}
                  <div 
                    class="info-item clickable" 
                    onclick={handleOpenBlockLink}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleOpenBlockLink()}
                    role="button"
                    tabindex="0"
                  >
                    <span class="info-label">
                      块引用
                    </span>
                    <span class="info-value link-value">
                      {sourceInfo.sourceBlock}
                    </span>
                  </div>
                {/if}

                <!--  新增：源记忆卡片信息 -->
                {#if sourceInfo.sourceCardId}
                  <div class="info-item source-card-item">
                    <span class="info-label">
                      源记忆卡片
                    </span>
                    <span class="info-value" title={sourceInfo.sourceCardId}>
                      {(sourceInfo.sourceCardId as string).slice(0, 12)}...
                    </span>
                  </div>
                  
                  <!-- 源卡片内容展示（直接显示）-->
                  {#if isLoadingSourceCard}
                    <div class="source-card-loading">
                      <EnhancedIcon name="loader" size="14" />
                      <span>加载源卡片内容中...</span>
                    </div>
                  {:else if sourceCard}
                    <div class="source-card-content">
                      <div class="source-card-header">
                        <span>源记忆卡片内容</span>
                      </div>
                      <div class="source-card-body">
                        {@html sourceCard.content || '（无内容）'}
                      </div>
                    </div>
                  {/if}
                {/if}
              {/if}
            </div>

            <!-- 查看详细信息按钮 -->
            {#if onOpenDetailedView}
              <div class="info-section detailed-view-section">
                <button 
                  class="detailed-view-btn"
                  onclick={() => {
                    showMultiInfoMenu = false;
                    onOpenDetailedView?.();
                  }}
                  type="button"
                >
                  <EnhancedIcon name="maximize-2" size="14" />
                  <span>查看详细信息</span>
                </button>
              </div>
            {/if}

            <!-- 🆕 查看题目数据结构（调试） -->
            {#if onOpenCardDebug}
              <div class="info-section card-debug-section">
                <button 
                  class="card-debug-btn"
                  onclick={() => {
                    showMultiInfoMenu = false;
                    onOpenCardDebug?.();
                  }}
                  type="button"
                  title="查看完整的题目数据结构（JSON格式）"
                >
                  <EnhancedIcon name="code" size="14" />
                  <span>查看数据结构</span>
                </button>
              </div>
            {/if}
          </div>
        {/snippet}
      </FloatingMenu>
    </div>

    <!-- 更多设置按钮 -->
    <div class="more-settings-container">
      <button
        bind:this={moreSettingsButtonElement}
        class="toolbar-btn more-settings-btn"
        class:active={showMoreSettingsMenu}
        onclick={toggleMoreSettingsMenu}
        onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        onmouseup={handleButtonDragEnd}
        ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        title="更多设置"
      >
        <EnhancedIcon name="settings" size="18" />
      </button>

      <FloatingMenu
        bind:show={showMoreSettingsMenu}
        anchor={moreSettingsButtonElement}
        placement="bottom-start"
        onClose={() => showMoreSettingsMenu = false}
        class="more-settings-menu-container"
      >
        {#snippet children()}
          <div class="more-settings-menu-header">
            <span>更多设置</span>
            <button class="close-btn" onclick={() => showMoreSettingsMenu = false}>
              <EnhancedIcon name="times" size="12" />
            </button>
          </div>

          <div class="more-settings-menu-content">
            <!-- 题目导航设置 -->
            <div class="setting-section">
              <div class="setting-item">
                <div class="setting-label">显示列数</div>
                <ObsidianDropdown
                  className="setting-select"
                  options={[
                    { id: '1', label: '单列显示' },
                    { id: '3', label: '三列显示' }
                  ]}
                  value={String(navColumnMode)}
                  onchange={(value) => onNavColumnModeChange?.(parseInt(value, 10) as 1 | 3)}
                />
              </div>
            </div>

            <!-- 学习顺序设置 -->
            <div class="setting-section">
              <div class="setting-item">
                <div class="setting-label">题目顺序</div>
                <ObsidianDropdown
                  className="setting-select"
                  options={[
                    { id: 'sequential', label: '正序学习' },
                    { id: 'random', label: '乱序学习' }
                  ]}
                  value={questionOrder}
                  onchange={(value) => onQuestionOrderChange?.(value as 'sequential' | 'random')}
                />
              </div>
            </div>

            <!-- 删除设置 -->
            <div class="setting-section">
              <div class="setting-item toggle-item">
                <div class="setting-label">
                  <span>启用直接删除</span>
                </div>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={enableDirectDelete}
                    onchange={(e) => onDirectDeleteToggle?.((e.target as HTMLInputElement).checked)}
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        {/snippet}
      </FloatingMenu>
    </div>

    <!-- 使用教程按钮 -->
    <div class="tutorial-container">
      <button
        bind:this={tutorialButtonElement}
        class="toolbar-btn tutorial-btn"
        class:active={showTutorialMenu}
        onclick={toggleTutorialMenu}
        onmousedown={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        onmouseup={handleButtonDragEnd}
        ontouchstart={(e) => handleButtonLongPressStart(e, e.currentTarget)}
        title="查看使用教程"
      >
        <EnhancedIcon name="book-open" size="18" />
      </button>

      <FloatingMenu
        bind:show={showTutorialMenu}
        anchor={tutorialButtonElement}
        placement="left-start"
        onClose={() => showTutorialMenu = false}
        class="question-bank-tutorial-menu-container"
      >
        {#snippet children()}
          <!-- 三层分离架构 -->
          <div class="question-bank-tutorial-wrapper">
            <!-- 层级1: 固定头部 -->
            <div class="question-bank-tutorial-header">
              <span>使用教程</span>
              <button class="close-btn" onclick={() => showTutorialMenu = false}>
                <EnhancedIcon name="times" size="12" />
              </button>
            </div>

            <!-- 层级2: 标签页导航 -->
            <div class="question-bank-tutorial-tabs">
              <button 
                class:active={activeTutorialTab === 'tutorial'}
                onclick={() => switchTutorialTab('tutorial')}
              >
                使用教程
              </button>
              <button 
                class:active={activeTutorialTab === 'algorithm'}
                onclick={() => switchTutorialTab('algorithm')}
              >
                算法原理
              </button>
            </div>

            <!-- 层级3: 滚动容器 -->
            <div class="question-bank-tutorial-scroll-container">
              <div class="question-bank-tutorial-content">
                
                {#if activeTutorialTab === 'tutorial'}
                  <!-- ========== 标签页1: 使用教程 ========== -->
            <!-- 选择题判断规则 -->
            <div class="tutorial-section">
              <div class="tutorial-section-title">
                <EnhancedIcon name="check-circle" size="14" />
                <span>选择题正确答案识别</span>
              </div>
              
              <div class="tutorial-text">
                <h4>使用 &#123;✓&#125; 标记正确选项</h4>
                <p>在选项行内添加 <code>&#123;✓&#125;</code> 标记：</p>
                <pre>A. 错误选项
B) 正确选项 &#123;✓&#125;
C、另一个错误选项</pre>

                <p class="tutorial-note"><strong>重要：</strong>只有 <code>&#123;✓&#125;</code> 标记会被识别，且必须在选项区域（<code>---div---</code> 之前）</p>
                
                <h4>多选题示例</h4>
                <pre>A. 选项1 &#123;✓&#125;
B) 选项2
C、选项3 &#123;✓&#125;
D. 选项4</pre>
              </div>
            </div>

            <!-- Markdown编辑优势 -->
            <div class="tutorial-section">
              <div class="tutorial-section-title">
                <EnhancedIcon name="file-text" size="14" />
                <span>Markdown编辑优势</span>
              </div>
              
              <div class="tutorial-text">
                <h4>为什么选择Markdown？</h4>
                <ul>
                  <li><strong>内容为王</strong>：笔记即卡片，无需重复录入</li>
                  <li><strong>动态解析</strong>：自动识别题型，无需手动选择</li>
                  <li><strong>完整表达</strong>：支持代码块、表格、图片等所有Markdown元素</li>
                </ul>
              </div>
            </div>

            <!-- 题型识别规则 -->
            <div class="tutorial-section">
              <div class="tutorial-section-title">
                <EnhancedIcon name="layers" size="14" />
                <span>题型自动识别</span>
              </div>
              
              <div class="tutorial-text">
                <!-- svelte-ignore component_name_lowercase -->
                <table class="tutorial-table">
                  <thead>
                    <tr>
                      <th>内容特征</th>
                      <th>识别为</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>包含 <code>==文本==</code></td>
                      <td>挖空题</td>
                    </tr>
                    <tr>
                      <td>包含 <code>A./B.</code> 等选项格式</td>
                      <td>选择题</td>
                    </tr>
                    <tr>
                      <td>包含 <code>---div---</code></td>
                      <td>问答题</td>
                    </tr>
                    <tr>
                      <td>无特殊标记</td>
                      <td>单面卡片</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 标准示例 -->
            <div class="tutorial-section">
              <div class="tutorial-section-title">
                <EnhancedIcon name="code" size="14" />
                <span>标准示例</span>
              </div>
              
              <div class="tutorial-text">
                <h4>单选题示例</h4>
                <pre>Q: 以下哪个是TypeScript相比JavaScript的核心特性？ #TypeScript

A) 支持异步编程
B) 静态类型检查 &#123;✓&#125;
C) 支持面向对象编程
D) 支持函数式编程

---div---

正确答案是B。静态类型检查是TypeScript的核心特性，
它在编译时进行类型检查，帮助开发者提前发现错误。
而异步编程、面向对象和函数式编程JavaScript也支持。</pre>

                <h4>多选题示例</h4>
                <pre>Q: 以下哪些方法可以提高代码可读性？ #编程规范

A) 使用有意义的变量名 &#123;✓&#125;
B) 添加适当的代码注释 &#123;✓&#125;
C) 保持函数简短专注 &#123;✓&#125;
D) 使用单字母变量名
E) 定期重构代码 &#123;✓&#125;

---div---

正确答案是A、B、C、E。使用有意义的变量名(A)、
添加适当注释(B)、保持函数简短(C)和定期重构(E)
都能提高代码可读性。使用单字母变量名(D)会降低
代码可读性，应该避免。</pre>

                <h4>挖空题示例</h4>
                <pre>JavaScript中 ==var== 和 ==let== 的主要区别是 ==作用域== 。</pre>

                <h4>问答题示例</h4>
                <pre>Q: 什么是闭包？ #JavaScript #进阶

---div---

闭包是函数和其词法环境的组合。闭包使得函数可以
访问其外部作用域的变量，即使外部函数已经返回。

**应用场景**：
- 数据封装和私有变量
- 创建工厂函数
- 实现函数柯里化</pre>
              </div>
            </div>

            <!-- 使用技巧 -->
            <div class="tutorial-section">
              <div class="tutorial-section-title">
                <EnhancedIcon name="lightbulb" size="14" />
                <span>使用技巧</span>
              </div>
              
              <div class="tutorial-text">
                <h4>快捷键</h4>
                <ul class="shortcut-list">
                  <li><kbd>Space/Enter</kbd> - 显示答案</li>
                  <li><kbd>← →</kbd> - 上/下一题</li>
                  <li><kbd>F</kbd> - 收藏当前题目</li>
                </ul>

                <h4>学习模式</h4>
                <ul>
                  <li><strong>正序学习</strong>：按题目顺序</li>
                  <li><strong>乱序学习</strong>：随机打乱顺序</li>
                </ul>
              </div>
            </div>

                {:else if activeTutorialTab === 'algorithm'}
                  <!-- ========== 标签页2: 算法原理 ========== -->
                  
                  <!-- Section 1: EWMA算法介绍 -->
                  <div class="tutorial-section">
                    <div class="tutorial-section-title">
                      <EnhancedIcon name="trending-up" size="14" />
                      <span>EWMA算法：科学评估掌握度</span>
                    </div>
                    
                    <div class="tutorial-text">
                      <h4>什么是EWMA？</h4>
                      <p><strong>EWMA</strong> = Exponentially Weighted Moving Average（指数加权移动平均）</p>
                      
                      <div class="highlight-box">
                        <p><strong>核心思想</strong>：近期的测试表现比早期更能反映你的当前掌握水平</p>
                      </div>
                      
                      <h4>与记忆牌组的关系</h4>
                      <p>就像记忆牌组使用 <strong>FSRS6算法</strong> 预测遗忘时间一样，考试牌组使用 <strong>EWMA算法</strong> 评估掌握程度。两者都是科学严谨的算法，只是应用场景不同。</p>
                    </div>
                  </div>

                  <!-- Section 2: 核心公式 -->
                  <div class="tutorial-section">
                    <div class="tutorial-section-title">
                      <EnhancedIcon name="function" size="14" />
                      <span>核心公式</span>
                    </div>
                    
                    <div class="tutorial-text">
                      <pre class="algorithm-formula">R_t = α × result_t + (1-α) × R_{'{'}t-1{'}'}{'\n'}
{'\n'}其中：
  R_t         当前掌握度
  result_t    最新测试结果（正确=1，错误=0）
  α           衰减因子（0.2，即近期占20%权重）
  R_{'{'}t-1{'}'}     之前的掌握度</pre>

                      <h4>权重衰减示例</h4>
                      <p>假设你做了10次测试：</p>
                      <ul>
                        <li><strong>第10次（最近）</strong>：权重 20%</li>
                        <li><strong>第9次</strong>：权重 16%</li>
                        <li><strong>第8次</strong>：权重 12.8%</li>
                        <li>...</li>
                        <li><strong>第1次（最早）</strong>：权重 &lt; 3%</li>
                      </ul>
                      
                      <div class="info-box">
                        <p>早期的错误会随着时间自动"遗忘"，不会永久影响你的掌握度评分！</p>
                      </div>
                    </div>
                  </div>

                  <!-- Section 3: 科学依据 -->
                  <div class="tutorial-section">
                    <div class="tutorial-section-title">
                      <EnhancedIcon name="award" size="14" />
                      <span>科学依据</span>
                    </div>
                    
                    <div class="tutorial-text">
                      <h4>学习曲线理论</h4>
                      <p>随着练习次数增加，你的能力在不断提升。正确率应该反映"当前位置"，而非整条曲线的平均值。</p>
                      
                      <h4>近因效应（Recency Effect）</h4>
                      <p>心理学研究证明：人们对近期发生的事件记忆更深刻。同样，近期的测试结果更能预测未来的表现。</p>
                      
                      <h4>形成性评估理论</h4>
                      <p>形成性评估关注"你现在是否已经掌握？"而非"你历史平均掌握多少？"EWMA算法完美体现这一理念。</p>
                    </div>
                  </div>

                  <!-- Section 4: 对比表格 -->
                  <div class="tutorial-section">
                    <div class="tutorial-section-title">
                      <EnhancedIcon name="bar-chart" size="14" />
                      <span>EWMA vs 简单平均</span>
                    </div>
                    
                    <div class="tutorial-text">
                      <!-- svelte-ignore component_name_lowercase -->
                      <table class="tutorial-table comparison-table">
                        <thead>
                          <tr>
                            <th>学习历史</th>
                            <th>简单平均</th>
                            <th>EWMA算法</th>
                            <th>评价</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>前10次全错，后10次全对</td>
                            <td>50%</td>
                            <td class="highlight-value">96.8%</td>
                            <td class="status-good">准确</td>
                          </tr>
                          <tr>
                            <td>前10次全对，后10次全错</td>
                            <td>50%</td>
                            <td class="highlight-value">3.2%</td>
                            <td class="status-good">准确</td>
                          </tr>
                          <tr>
                            <td>稳定80%正确率</td>
                            <td>80%</td>
                            <td>80%</td>
                            <td class="status-good">一致</td>
                          </tr>
                          <tr>
                            <td>连续20次全对</td>
                            <td>100%</td>
                            <td>100%</td>
                            <td class="status-good">一致</td>
                          </tr>
                        </tbody>
                      </table>
                      
                      <div class="highlight-box">
                        <p><strong>结论</strong>：EWMA能准确反映学习进度，而简单平均会被早期错误永久拖累！</p>
                      </div>
                    </div>
                  </div>

                  <!-- Section 5: 掌握状态 -->
                  <div class="tutorial-section">
                    <div class="tutorial-section-title">
                      <EnhancedIcon name="layers" size="14" />
                      <span>掌握状态评估</span>
                    </div>
                    
                    <div class="tutorial-text">
                      <h4>6个掌握级别</h4>
                      <div class="mastery-levels">
                        <div class="mastery-level level-mastered">
                          <div class="level-badge">已精通</div>
                          <div class="level-desc">正确率 ≥ 90% + 连续3次正确</div>
                        </div>
                        
                        <div class="mastery-level level-proficient">
                          <div class="level-badge">熟练</div>
                          <div class="level-desc">正确率 ≥ 75%</div>
                        </div>
                        
                        <div class="mastery-level level-learning">
                          <div class="level-badge">学习中</div>
                          <div class="level-desc">正确率 ≥ 60%</div>
                        </div>
                        
                        <div class="mastery-level level-struggling">
                          <div class="level-badge">有困难</div>
                          <div class="level-desc">正确率 ≥ 40%</div>
                        </div>
                        
                        <div class="mastery-level level-review">
                          <div class="level-badge">需复习</div>
                          <div class="level-desc">正确率 &lt; 40%</div>
                        </div>
                        
                        <div class="mastery-level level-insufficient">
                          <div class="level-badge">数据不足</div>
                          <div class="level-desc">测试次数太少（置信度 &lt; 50%）</div>
                        </div>
                      </div>
                      
                      <h4>置信度机制</h4>
                      <p>系统会根据测试次数计算置信度：</p>
                      <ul>
                        <li><strong>5次测试</strong>：置信度 22%（低）</li>
                        <li><strong>10次测试</strong>：置信度 39%（低）</li>
                        <li><strong>20次测试</strong>：置信度 63%（中）</li>
                        <li><strong>50次测试</strong>：置信度 92%（高）</li>
                      </ul>
                      
                      <div class="info-box">
                        <p>测试次数越多，掌握度评估越准确！</p>
                      </div>
                      
                      <h4>趋势分析</h4>
                      <p>系统自动分析你的学习趋势：</p>
                      <ul>
                        <li><strong>进步中</strong>：近期表现比早期好</li>
                        <li><strong>稳定</strong>：保持稳定的正确率</li>
                        <li><strong>退步中</strong>：需要加强复习</li>
                      </ul>
                    </div>
                  </div>

                  <!-- Section 6: 实际应用 -->
                  <div class="tutorial-section">
                    <div class="tutorial-section-title">
                      <EnhancedIcon name="lightbulb" size="14" />
                      <span>如何使用掌握度</span>
                    </div>
                    
                    <div class="tutorial-text">
                      <h4>在哪里查看？</h4>
                      <p>掌握度指标会显示在：</p>
                      <ul>
                        <li>题库列表 - 每道题的统计卡片</li>
                        <li>测试结果页 - 详细分析报告</li>
                        <li>题目详情 - 完整的掌握度历史</li>
                      </ul>
                      
                      <h4>如何理解？</h4>
                      <div class="example-box">
                        <p><strong>示例显示</strong>：熟练 (78.5%) - 进步中 +12%</p>
                        <p><strong>解读</strong>：</p>
                        <ul>
                          <li>当前掌握度：78.5%（熟练级别）</li>
                          <li>学习趋势：进步中</li>
                          <li>进步幅度：+12%（相比早期提升了12%）</li>
                        </ul>
                      </div>

                      <h4>学习建议</h4>
                      <ul>
                        <li><strong>已精通</strong>：可以降低练习频率，定期复习即可</li>
                        <li><strong>熟练/学习中</strong>：继续保持练习，巩固知识</li>
                        <li><strong>有困难/需复习</strong>：增加练习次数，重点关注</li>
                        <li><strong>数据不足</strong>：多做几次测试，建立可靠的评估</li>
                      </ul>
                    </div>
                  </div>

                {/if}

              </div><!-- .question-bank-tutorial-content -->
            </div><!-- .question-bank-tutorial-scroll-container -->
          </div><!-- .question-bank-tutorial-wrapper -->
        {/snippet}
      </FloatingMenu>
    </div>
  </div>
</div>

<style>
  /* 侧边栏工具栏基础样式已移至全局 vertical-toolbar.css */
  
  /* 下拉菜单容器 */
  .multi-info-container,
  .more-settings-container {
    position: relative;
  }

  /* 菜单头部样式 - 优化为清爽设计，确保不超出下方 */
  .multi-info-menu-header,
  .more-settings-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 14px 13px;
    border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 40%, transparent);
    background: var(--background-primary);
    margin-bottom: 14px;
  }

  .multi-info-menu-header span,
  .more-settings-menu-header span {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: 0.2px;
  }

  .multi-info-menu-header .close-btn,
  .more-settings-menu-header .close-btn {
    padding: 5px;
    border-radius: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .multi-info-menu-header .close-btn:hover,
  .more-settings-menu-header .close-btn:hover {
    background: color-mix(in srgb, var(--text-error) 10%, var(--background-primary));
    color: var(--text-error);
    transform: rotate(90deg);
  }

  /* 菜单内容样式 - 增加呼吸感 */
  .multi-info-menu-content {
    min-width: 340px;
    padding: 4px 8px 8px;
  }

  .more-settings-menu-content {
    min-width: 320px;
    max-width: 380px;
    padding: 10px 14px 12px;
  }

  /* 信息分组样式 - 优化间距和分隔 */
  .info-section {
    margin-bottom: 16px;
    padding: 8px 6px 12px;
    background: color-mix(in srgb, var(--background-secondary) 30%, transparent);
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .info-section-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 10px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    border-radius: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    margin-bottom: 4px;
    background: var(--background-primary);
    border: 1px solid transparent;
  }

  .info-item:hover {
    background: var(--background-modifier-hover);
    border-color: color-mix(in srgb, var(--text-accent) 20%, transparent);
    transform: translateX(2px);
  }

  .info-item:last-child {
    margin-bottom: 0;
  }

  .info-label {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 500;
    flex-shrink: 0;
    margin-right: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-value {
    font-size: 0.78rem;
    color: var(--text-normal);
    font-weight: 500;
    text-align: right;
    word-break: break-all;
    max-width: 65%;
    line-height: 1.4;
  }

  /* 可点击的信息项 */
  .info-item.clickable {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .info-item.clickable:hover {
    background: var(--background-modifier-hover);
  }

  .link-value {
    color: var(--text-accent) !important;
    text-decoration: underline;
    text-decoration-style: dotted;
    cursor: pointer;
  }

  .info-item.clickable:hover .link-value {
    color: var(--text-accent-hover) !important;
    text-decoration-style: solid;
  }

  .info-item.no-source {
    background: color-mix(in srgb, var(--background-modifier-border) 15%, var(--background-primary));
    border: 1px dashed color-mix(in srgb, var(--text-muted) 30%, transparent);
    border-radius: 6px;
  }

  .info-item.no-source:hover {
    background: color-mix(in srgb, var(--background-modifier-border) 25%, var(--background-primary));
    border-color: color-mix(in srgb, var(--text-muted) 40%, transparent);
    transform: none;
  }

  /*  新增：源卡片信息样式 */
  .info-item.source-card-item {
    background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 20%, transparent);
  }

  .info-item.source-card-item:hover {
    background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    border-color: color-mix(in srgb, var(--interactive-accent) 30%, transparent);
  }

  .source-card-loading {
    margin-top: 12px;
    padding: 12px;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .source-card-content {
    margin-top: 12px;
    padding: 12px;
    background: color-mix(in srgb, var(--background-secondary) 80%, transparent);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .source-card-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .source-card-body {
    color: var(--text-normal);
    font-size: 0.88rem;
    line-height: 1.7;
    word-wrap: break-word;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .source-card-body :global(p) {
    margin: 0.8em 0;
  }

  .source-card-body :global(p:first-child) {
    margin-top: 0;
  }

  .source-card-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .source-card-body :global(h1),
  .source-card-body :global(h2),
  .source-card-body :global(h3) {
    margin: 1em 0 0.5em 0;
    line-height: 1.4;
  }

  .source-card-body :global(ul),
  .source-card-body :global(ol) {
    margin: 0.8em 0;
    padding-left: 1.5em;
  }

  .source-card-body :global(li) {
    margin: 0.3em 0;
  }

  .text-muted {
    color: var(--text-muted) !important;
    font-style: italic;
    font-size: 0.75rem;
  }

  /* 查看详细信息按钮 - 优化为更优雅的设计 */
  .detailed-view-section {
    margin-top: 12px;
    padding: 0;
    background: transparent;
    border: none;
  }

  .detailed-view-btn {
    width: 100%;
    padding: 11px 14px;
    background: var(--interactive-accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    box-shadow: 0 2px 6px color-mix(in srgb, var(--interactive-accent) 25%, transparent);
    letter-spacing: 0.3px;
  }

  .detailed-view-btn:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--interactive-accent) 35%, transparent);
  }

  .detailed-view-btn:active {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px color-mix(in srgb, var(--interactive-accent) 30%, transparent);
  }

  /* 🆕 查看数据结构按钮（调试） */
  .card-debug-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
    border-bottom: none;
  }

  .card-debug-btn {
    width: 100%;
    padding: 10px 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
  }

  .card-debug-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
  }

  .card-debug-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(102, 126, 234, 0.2);
  }

  /* 设置分组样式 */
  .setting-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
  }

  .setting-section:first-child {
    padding-top: 4px;
  }

  .setting-section:last-child {
    border-bottom: none;
    padding-bottom: 4px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 12px;
    border-radius: 6px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .setting-item:hover {
    background: var(--background-modifier-hover);
    border-color: color-mix(in srgb, var(--interactive-accent) 40%, var(--background-modifier-border));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  }

  .setting-item.toggle-item {
    padding: 10px 12px;
  }

  .setting-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  /* 按钮显示模式选项 */
  .compact-mode-options {
    display: flex;
    gap: 10px;
  }

  .compact-mode-option {
    flex: 1;
    position: relative;
    cursor: pointer;
  }

  .compact-mode-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .option-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 10px;
    background: var(--background-primary);
    border: 1.5px solid var(--background-modifier-border);
    border-radius: 10px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .compact-mode-option:hover .option-content {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .compact-mode-option.active .option-content {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, color-mix(in srgb, var(--interactive-accent) 85%, black) 100%);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--interactive-accent) 30%, transparent);
  }

  .compact-mode-option.active .option-content :global(svg) {
    color: var(--text-on-accent);
  }

  .option-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
    letter-spacing: 0.3px;
  }

  /* 下拉选择框样式 */
  .setting-select {
    padding: 8px 32px 8px 12px;
    background: var(--background-primary);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 60%, transparent);
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }

  .setting-select:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .setting-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 15%, transparent);
  }

  :global(.obsidian-dropdown-trigger.setting-select) {
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 60%, transparent);
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-normal);
    cursor: pointer;
    min-height: 0;
  }

  :global(.obsidian-dropdown-trigger.setting-select:hover:not(.disabled)) {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  :global(.obsidian-dropdown-trigger.setting-select:focus-visible) {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: none;
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background-modifier-border);
    transition: .3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--interactive-accent);
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* ==================== 教程菜单样式 ==================== */
  .tutorial-container {
    position: relative;
  }

  .toolbar-btn.tutorial-btn:hover {
    background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
    border-color: var(--interactive-accent);
  }

  /* ====================  全新架构：三层分离设计 ==================== */
  
  /* 覆盖FloatingMenu的max-width限制 */
  :global(.question-bank-tutorial-menu-container.floating-menu) {
    max-width: 520px !important;
    width: max-content;
  }

  /* 第一层：Wrapper - 控制整体尺寸和padding */
  .question-bank-tutorial-wrapper {
    width: 100%;
    max-width: 500px;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
  }

  /* 第二层：Header - 固定头部 */
  .question-bank-tutorial-header {
    flex-shrink: 0; /* 头部不收缩 */
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 18px 14px; /* 与content保持一致 */
    border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
    background: var(--background-primary);
  }

  .question-bank-tutorial-header span {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: 0.3px;
  }

  .question-bank-tutorial-header .close-btn {
    padding: 6px;
    border-radius: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .question-bank-tutorial-header .close-btn:hover {
    background: color-mix(in srgb, var(--text-error) 10%, var(--background-primary));
    color: var(--text-error);
    transform: rotate(90deg);
  }

  /* 标签页导航 */
  .question-bank-tutorial-tabs {
    flex-shrink: 0;
    display: flex;
    gap: 0;
    padding: 0 18px;
    border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
    background: var(--background-primary);
  }

  .question-bank-tutorial-tabs button {
    flex: 1;
    padding: 10px 16px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .question-bank-tutorial-tabs button:hover {
    color: var(--text-normal);
    background: color-mix(in srgb, var(--background-modifier-hover) 40%, transparent);
  }

  .question-bank-tutorial-tabs button.active {
    color: var(--interactive-accent);
    border-bottom-color: var(--interactive-accent);
    font-weight: 600;
  }

  /* 第三层：Scroll Container - 可滚动区域（无padding） */
  .question-bank-tutorial-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0; /* 关键：允许flex子元素正确滚动 */
  }

  /* 滚动条样式 */
  .question-bank-tutorial-scroll-container::-webkit-scrollbar {
    width: 8px;
  }

  .question-bank-tutorial-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .question-bank-tutorial-scroll-container::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--background-modifier-border) 60%, transparent);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .question-bank-tutorial-scroll-container::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--background-modifier-border) 80%, transparent);
    background-clip: padding-box;
  }

  /* 第四层：Content - 实际内容区（有padding） */
  .question-bank-tutorial-content {
    padding: 16px 18px 20px; /* 统一的内边距：上16px 左右18px 下20px */
    min-width: 0; /* 允许子元素缩小 */
  }

  /* 教程分组 */
  .tutorial-section {
    margin-bottom: 18px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 25%, transparent);
    background: var(--background-primary);
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    max-width: 100%; /* 确保不超出父容器 */
    box-sizing: border-box;
  }

  .tutorial-section:last-child {
    margin-bottom: 0;
  }

  .tutorial-section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--background-secondary) 15%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 20%, transparent);
  }

  .tutorial-section-title span {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: 0.2px;
  }

  .tutorial-text {
    padding: 14px 16px 16px;
    font-size: 0.86rem;
    line-height: 1.65;
    color: var(--text-normal);
  }

  /* 教程文本元素 */
  .tutorial-text h4 {
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-accent);
    margin: 18px 0 10px;
    letter-spacing: 0.2px;
  }

  .tutorial-text h4:first-child {
    margin-top: 0;
  }

  .tutorial-text p {
    margin: 8px 0;
    color: var(--text-normal);
  }

  .tutorial-text ul {
    margin: 10px 0;
    padding-left: 24px;
  }

  .tutorial-text li {
    margin-bottom: 8px;
    line-height: 1.6;
  }

  .tutorial-text strong {
    font-weight: 600;
    color: var(--text-accent);
  }

  .tutorial-text code {
    background: color-mix(in srgb, var(--background-secondary) 60%, transparent);
    padding: 3px 7px;
    border-radius: 4px;
    font-family: var(--font-monospace);
    font-size: 0.82rem;
    color: var(--code-normal);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
  }

  .tutorial-text pre {
    background: color-mix(in srgb, var(--background-secondary) 35%, transparent);
    padding: 12px 15px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 10px 0;
    font-size: 0.82rem;
    line-height: 1.55;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
    box-sizing: border-box;
  }

  .tutorial-note {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 8px;
  }

  /* 表格样式 */
  .tutorial-table {
    width: 100%;
    max-width: 100%; /* 确保不超出 */
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 0.82rem;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
    border-radius: 6px;
    overflow: hidden;
    table-layout: fixed; /* 固定表格布局，防止内容撑开 */
  }

  .tutorial-table th,
  .tutorial-table td {
    padding: 9px 11px;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 25%, transparent);
    text-align: left;
    word-wrap: break-word;
  }

  .tutorial-table th {
    background: color-mix(in srgb, var(--background-secondary) 35%, transparent);
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: 0.2px;
  }

  .tutorial-table td {
    background: var(--background-primary);
  }

  .tutorial-table tr:hover td {
    background: color-mix(in srgb, var(--background-modifier-hover) 30%, transparent);
  }

  .tutorial-table code {
    font-size: 0.78rem;
  }

  /* 快捷键列表样式 */
  .shortcut-list {
    list-style: none;
    padding: 0;
  }

  .shortcut-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .shortcut-list kbd {
    background: color-mix(in srgb, var(--background-secondary) 50%, transparent);
    padding: 4px 10px;
    border-radius: 5px;
    font-family: var(--font-monospace);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-normal);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 40%, transparent);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    min-width: 90px;
    text-align: center;
  }

  /* ==================== 算法原理标签页专用样式 ==================== */
  
  /* 高亮框 */
  .highlight-box {
    background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
    border-left: 3px solid var(--interactive-accent);
    padding: 12px 14px;
    margin: 12px 0;
    border-radius: 4px;
  }

  .highlight-box p {
    margin: 0;
    color: var(--text-normal);
  }

  /* 信息框 */
  .info-box {
    background: color-mix(in srgb, var(--background-secondary) 40%, transparent);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 40%, transparent);
    padding: 12px 14px;
    margin: 12px 0;
    border-radius: 6px;
  }

  .info-box p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  /* 示例框 */
  .example-box {
    background: color-mix(in srgb, var(--background-secondary) 30%, transparent);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 35%, transparent);
    padding: 14px 16px;
    margin: 14px 0;
    border-radius: 6px;
  }

  .example-box p {
    margin: 8px 0;
  }

  .example-box ul {
    margin: 8px 0;
    padding-left: 20px;
  }

  .example-box li {
    margin: 6px 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  /* 算法公式 */
  .algorithm-formula {
    background: color-mix(in srgb, var(--background-secondary) 45%, transparent);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 40%, transparent);
    padding: 16px 18px;
    border-radius: 6px;
    font-family: var(--font-monospace);
    font-size: 0.86rem;
    line-height: 1.8;
    color: var(--text-normal);
    overflow-x: auto;
    white-space: pre;
  }

  /* 对比表格增强 */
  .comparison-table .highlight-value {
    color: var(--interactive-accent);
    font-weight: 600;
    font-size: 0.92rem;
  }

  .comparison-table .status-good {
    color: var(--text-success);
    font-weight: 500;
  }

  /* 掌握级别列表 */
  .mastery-levels {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0;
  }

  .mastery-level {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 35%, transparent);
    transition: all 0.2s ease;
  }

  .mastery-level:hover {
    background: color-mix(in srgb, var(--background-modifier-hover) 30%, transparent);
    transform: translateX(2px);
  }

  .level-badge {
    flex-shrink: 0;
    padding: 5px 11px;
    border-radius: 4px;
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .level-desc {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  /* 各级别颜色 */
  .level-mastered .level-badge {
    background: color-mix(in srgb, var(--text-success) 15%, transparent);
    color: var(--text-success);
    border: 1px solid color-mix(in srgb, var(--text-success) 25%, transparent);
  }

  .level-proficient .level-badge {
    background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
    color: var(--interactive-accent);
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 25%, transparent);
  }

  .level-learning .level-badge {
    background: color-mix(in srgb, #3b82f6 15%, transparent);
    color: #3b82f6;
    border: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  }

  .level-struggling .level-badge {
    background: color-mix(in srgb, #f59e0b 15%, transparent);
    color: #f59e0b;
    border: 1px solid color-mix(in srgb, #f59e0b 25%, transparent);
  }

  .level-review .level-badge {
    background: color-mix(in srgb, var(--text-error) 15%, transparent);
    color: var(--text-error);
    border: 1px solid color-mix(in srgb, var(--text-error) 25%, transparent);
  }

  .level-insufficient .level-badge {
    background: color-mix(in srgb, var(--text-muted) 15%, transparent);
    color: var(--text-muted);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 40%, transparent);
  }
</style>
