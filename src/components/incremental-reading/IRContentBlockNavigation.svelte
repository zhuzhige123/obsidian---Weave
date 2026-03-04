<script lang="ts">
  /**
   * IRContentBlockNavigation - 内容块导航信息栏
   * 
   * 设计：完全复用统计信息栏的CSS类名和结构
   * - 上一块：基于文章层级结构的前一个内容块
   * - 下一块：基于文章层级结构的后一个内容块
   * - 关联：基于 [[]] 双链检测的关联内容块
   * - 随机：当前会话队列中的随机内容块
   * 
   * @module components/incremental-reading/IRContentBlockNavigation
   * @version 3.0.0
   */
  import type { IRBlock } from '../../types/ir-types';
  import type { App } from 'obsidian';
  import { logger } from '../../utils/logger';

  // 辅助函数：获取源文件路径
  function getSourcePath(block: IRBlock): string {
    return block.filePath || '';
  }

  // 辅助函数：获取有效优先级
  function getEffectivePriority(block: IRBlock): number {
    return block.priorityEff ?? block.priorityUi ?? 5;
  }

  interface Props {
    app: App;
    currentBlock: IRBlock | null;
    sessionBlocks: IRBlock[];
    siblings: { prev: string | null; next: string | null };
    collapsed?: boolean;
    onNavigate: (blockId: string) => void;
  }

  let {
    app,
    currentBlock,
    sessionBlocks,
    siblings,
    collapsed = false,
    onNavigate
  }: Props = $props();

  // 缓存的关联块和随机块
  let linkedBlock = $state<IRBlock | null>(null);
  let randomBlock = $state<IRBlock | null>(null);
  let isLoadingLinked = $state(false);

  // 内部链接正则表达式
  const INTERNAL_LINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

  // v4.0: 获取块状态标识（新、读、暂、完、待）
  function getBlockStateLabel(block: IRBlock | null): { label: string; class: string } {
    if (!block) return { label: '', class: '' };
    
    const status = ((block as any)?._v4?.status ?? (block as any)?.status ?? block.state ?? 'new') as string;
    switch (status) {
      case 'new':
        return { label: '新', class: 'state-new' };
      case 'queued':
        return { label: '未', class: 'state-scheduled' };
      case 'active':
      case 'learning':
        return { label: '', class: '' };
      case 'scheduled':
      case 'review':
        return { label: '未', class: 'state-scheduled' };
      case 'done':
        return { label: '完', class: 'state-done' };
      case 'suspended':
        return { label: '暂', class: 'state-suspended' };
      default:
        return { label: '新', class: 'state-new' };
    }
  }

  // 获取块标题（优先级：headingText > 标题路径 > contentPreview > 文件名 > ID前8位）
  function getBlockTitle(block: IRBlock | null): string {
    if (!block) return '无';
    
    // v5.4: 优先使用 headingText（来自 chunkToV4WithTitle）
    const headingText = (block as any).headingText;
    if (headingText && headingText.trim() && headingText !== '未命名内容块') {
      const title = headingText.trim();
      return title.length > 30 ? title.substring(0, 30) + '...' : title;
    }
    
    // 2. 使用标题路径
    if (block.headingPath && block.headingPath.length > 0) {
      return block.headingPath[block.headingPath.length - 1];
    }
    
    // v5.4: 使用 contentPreview
    const contentPreview = (block as any).contentPreview;
    if (contentPreview && contentPreview.trim()) {
      const firstLine = contentPreview.split('\n')[0].trim();
      if (firstLine) {
        return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
      }
    }
    
    // 4. 尝试获取文件名
    const sourcePath = getSourcePath(block);
    if (sourcePath) {
      const fileName = sourcePath.split('/').pop()?.replace('.md', '') || '';
      if (fileName) return fileName;
    }
    
    // 5. 最后使用ID前8位
    return block.id.substring(0, 8);
  }

  // 获取块摘要（截取前50字符）
  function getBlockSummary(block: IRBlock | null): string {
    if (!block) return '暂无内容';
    const preview = (block as any).contentPreview ?? '';
    if (preview) {
      return preview.length > 50 ? preview.substring(0, 50) + '...' : preview;
    }
    return '点击查看';
  }

  // 根据ID查找块
  function findBlockById(blockId: string | null): IRBlock | null {
    if (!blockId) return null;
    return sessionBlocks.find(b => b.id === blockId) || null;
  }

  // 派生状态：上一块和下一块（防御性检查 siblings）
  const prevBlock = $derived(findBlockById(siblings?.prev ?? null));
  const nextBlock = $derived(findBlockById(siblings?.next ?? null));

  // 从内容中提取内部链接
  function extractLinkedFiles(content: string): string[] {
    const links: string[] = [];
    let match;
    const regex = new RegExp(INTERNAL_LINK_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
      const linkTarget = match[1].trim();
      if (linkTarget && !links.includes(linkTarget)) {
        links.push(linkTarget);
      }
    }
    return links;
  }

  // 加载关联块（获取第一个最高优先级的）
  async function loadLinkedBlock() {
    if (!currentBlock) {
      linkedBlock = null;
      return;
    }
    
    isLoadingLinked = true;
    
    try {
      const sourcePath = getSourcePath(currentBlock);
      const file = app.vault.getAbstractFileByPath(sourcePath);
      if (!file) {
        linkedBlock = null;
        return;
      }
      
      const content = await app.vault.cachedRead(file as any);
      const linkedFiles = extractLinkedFiles(content);
      
      if (linkedFiles.length === 0) {
        linkedBlock = null;
        return;
      }
      
      // 查找关联块
      const candidates: IRBlock[] = [];
      for (const block of sessionBlocks) {
        if (block.id === currentBlock.id) continue;
        
        const blockPath = getSourcePath(block);
        const blockFileName = blockPath.split('/').pop()?.replace('.md', '') || '';
        const blockPathWithoutExt = blockPath.replace('.md', '');
        
        for (const linkedFile of linkedFiles) {
          if (blockFileName === linkedFile || 
              blockPathWithoutExt.endsWith(linkedFile) ||
              blockPath.includes(linkedFile)) {
            candidates.push(block);
            break;
          }
        }
      }
      
      // 取优先级最高的
      if (candidates.length > 0) {
        candidates.sort((a, b) => getEffectivePriority(b) - getEffectivePriority(a));
        linkedBlock = candidates[0];
      } else {
        linkedBlock = null;
      }
    } catch (error) {
      logger.error('[IRContentBlockNavigation] 加载关联块失败:', error);
      linkedBlock = null;
    } finally {
      isLoadingLinked = false;
    }
  }

  // 获取随机块
  function updateRandomBlock() {
    if (!currentBlock || sessionBlocks.length <= 1) {
      randomBlock = null;
      return;
    }
    
    const candidates = sessionBlocks.filter(b => b.id !== currentBlock.id);
    if (candidates.length === 0) {
      randomBlock = null;
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * candidates.length);
    randomBlock = candidates[randomIndex];
  }

  // 点击处理函数
  function handlePrevClick() {
    if (prevBlock) onNavigate(prevBlock.id);
  }

  function handleNextClick() {
    if (nextBlock) onNavigate(nextBlock.id);
  }

  function handleLinkedClick() {
    if (linkedBlock) onNavigate(linkedBlock.id);
  }

  function handleRandomClick() {
    updateRandomBlock();
    if (randomBlock) onNavigate(randomBlock.id);
  }

  // 当前块变化时更新关联块和随机块
  $effect(() => {
    if (currentBlock) {
      loadLinkedBlock();
      updateRandomBlock();
    }
  });
</script>

<!-- v3.2: 根据手绘示意图重构为4列卡片布局 -->
{#if !collapsed}
<div class="ir-nav-cards">
  <!-- 上一块 -->
  <button 
    class="nav-card" 
    class:disabled={!prevBlock}
    onclick={handlePrevClick}
    disabled={!prevBlock}
    title="当前会话队列中的前一个内容块"
  >
    <div class="nav-card-header">
      <span class="nav-card-type">上一块</span>
      {#if prevBlock}
        {@const prevState = getBlockStateLabel(prevBlock)}
        {#if prevState.label}
          <span class="nav-card-state {prevState.class}">{prevState.label}</span>
        {/if}
      {/if}
    </div>
    <span class="nav-card-title">{getBlockTitle(prevBlock)}</span>
  </button>

  <!-- 下一块 -->
  <button 
    class="nav-card" 
    class:disabled={!nextBlock}
    onclick={handleNextClick}
    disabled={!nextBlock}
    title="当前会话队列中的后一个内容块"
  >
    <div class="nav-card-header">
      <span class="nav-card-type">下一块</span>
      {#if nextBlock}
        {@const nextState = getBlockStateLabel(nextBlock)}
        {#if nextState.label}
          <span class="nav-card-state {nextState.class}">{nextState.label}</span>
        {/if}
      {/if}
    </div>
    <span class="nav-card-title">{getBlockTitle(nextBlock)}</span>
  </button>

  <!-- 关联块 -->
  <button 
    class="nav-card" 
    class:disabled={!linkedBlock && !isLoadingLinked}
    onclick={handleLinkedClick}
    disabled={!linkedBlock}
    title="通过 [[]] 双链关联的内容块（优先级最高者）"
  >
    <div class="nav-card-header">
      <span class="nav-card-type">关联块</span>
      {#if linkedBlock}
        {@const linkedState = getBlockStateLabel(linkedBlock)}
        {#if linkedState.label}
          <span class="nav-card-state {linkedState.class}">{linkedState.label}</span>
        {/if}
      {/if}
    </div>
    <span class="nav-card-title">{isLoadingLinked ? '加载中...' : getBlockTitle(linkedBlock)}</span>
  </button>

  <!-- 随机块 -->
  <button 
    class="nav-card" 
    class:disabled={sessionBlocks.length <= 1}
    onclick={handleRandomClick}
    disabled={sessionBlocks.length <= 1}
    title="从当前会话队列中随机选取的内容块"
  >
    <div class="nav-card-header">
      <span class="nav-card-type">随机块</span>
      {#if randomBlock}
        {@const randomState = getBlockStateLabel(randomBlock)}
        {#if randomState.label}
          <span class="nav-card-state {randomState.class}">{randomState.label}</span>
        {/if}
      {/if}
    </div>
    <span class="nav-card-title">{getBlockTitle(randomBlock)}</span>
  </button>
</div>
{/if}

<style>
  /* v3.2: 根据手绘示意图重构 - 4列卡片网格布局 */
  .ir-nav-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin: 0 1.5rem 0.375rem 1.5rem;
    padding-top: 0.75rem;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 导航卡片样式 - 与统计信息栏完全一致 */
  .nav-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    min-height: 72px;
  }

  /* 边框渐变效果 - 与统计卡片完全一致 */
  .nav-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--text-accent), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .nav-card:not(:disabled):hover::before {
    opacity: 1;
  }

  .nav-card:not(:disabled):hover {
    box-shadow: 0 8px 20px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.05);
    border-color: color-mix(in srgb, var(--background-modifier-border) 70%, var(--text-accent) 30%);
  }

  .nav-card:disabled,
  .nav-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* v4.0: 卡片头部 - 类型 + 状态标识 */
  .nav-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  /* 卡片类型标签 */
  .nav-card-type {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* v4.0: 状态标识 */
  .nav-card-state {
    font-size: 0.6rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    color: white;
  }

  .nav-card-state.state-new {
    background: #3b82f6;
  }

  .nav-card-state.state-active {
    background: #10b981;
  }

  .nav-card-state.state-scheduled {
    background: #f59e0b;
  }

  .nav-card-state.state-done {
    background: #6b7280;
  }

  .nav-card-state.state-suspended {
    background: #8b5cf6;
  }

  /* 卡片标题 - 允许换行显示完整内容 */
  .nav-card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-normal);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  /* 响应式设计 */
  @media (max-width: 1024px) {
    .ir-nav-cards {
      grid-template-columns: repeat(2, 1fr);
      margin: 0 1rem 0.5rem 1rem;
    }
  }

  @media (max-width: 640px) {
    .ir-nav-cards {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }

  :global(body.is-phone) .ir-nav-cards,
  :global(body.is-mobile) .ir-nav-cards {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 0.5rem;
    margin: 0 0.5rem 0.25rem 0.5rem;
    padding-top: 0.5rem;
  }

  :global(body.is-phone) .ir-nav-cards::-webkit-scrollbar,
  :global(body.is-mobile) .ir-nav-cards::-webkit-scrollbar {
    display: none;
  }

  :global(body.is-phone) .nav-card,
  :global(body.is-mobile) .nav-card {
    flex: 0 0 auto;
    min-width: 140px;
    padding: 0.5rem 0.75rem;
    min-height: 56px;
    border-radius: 0.625rem;
  }

  :global(body.is-phone) .nav-card-type,
  :global(body.is-mobile) .nav-card-type {
    font-size: 0.65rem;
  }

  :global(body.is-phone) .nav-card-state,
  :global(body.is-mobile) .nav-card-state {
    font-size: 0.55rem;
  }

  :global(body.is-phone) .nav-card-title,
  :global(body.is-mobile) .nav-card-title {
    font-size: 0.85rem;
    -webkit-line-clamp: 1;
  }
</style>
