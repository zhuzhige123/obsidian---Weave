<!--
  批量删除标签模态框 - 重构版
  优雅干净的设计风格，使用多彩侧边颜色条
-->
<script lang="ts">
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import { ICON_NAMES } from '../../icons/index.js';
  import type { Card } from '../../data/types';
  import { tr } from '../../utils/i18n';

  interface TagStatistic {
    tag: string;
    count: number;
    percentage: number;
  }

  interface Props {
    open: boolean;
    selectedCards: Card[];
    onconfirm?: (tagsToRemove: string[]) => void;
    oncancel?: () => void;
  }

  let { open, selectedCards, onconfirm, oncancel }: Props = $props();

  let t = $derived($tr);
  let selectedTags = $state(new Set<string>());

  // 收集所有标签并统计
  let tagStatistics = $derived((): TagStatistic[] => {
    const tagCounts = new Map<string, number>();
    selectedCards.forEach(card => {
      card.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: (count / selectedCards.length) * 100
      }))
      .sort((a, b) => b.count - a.count);
  });

  function resetState() {
    selectedTags = new Set();
  }

  function toggleTag(tag: string) {
    const newSet = new Set(selectedTags);
    if (newSet.has(tag)) {
      newSet.delete(tag);
    } else {
      newSet.add(tag);
    }
    selectedTags = newSet;
  }

  function selectAll() {
    selectedTags = new Set(tagStatistics().map(stat => stat.tag));
  }

  function clearSelection() {
    selectedTags = new Set();
  }

  function handleConfirm() {
    if (selectedTags.size === 0) return;
    onconfirm?.(Array.from(selectedTags));
    resetState();
  }

  function handleCancel() {
    oncancel?.();
    resetState();
  }

  $effect(() => {
    if (!open) resetState();
  });
</script>

{#if open}
<div class="brt-overlay" onclick={(e) => { if (e.currentTarget === e.target) handleCancel() }} role="button" tabindex="0">
  <div class="brt-modal" role="dialog" aria-labelledby="brt-title">
    <!-- 标题栏 - 使用多彩侧边颜色条 -->
    <header class="brt-header">
      <h2 id="brt-title" class="brt-title with-accent-bar accent-pink">
        {t('modals.batchRemoveTags.title')}
      </h2>
      <button class="brt-close-btn" onclick={handleCancel} aria-label="关闭">
        <EnhancedIcon name={ICON_NAMES.CLOSE} size={18} />
      </button>
    </header>

    <main class="brt-main">
      <!-- 卡片数量提示 -->
      <div class="brt-card-count">
        从 <strong>{selectedCards.length}</strong> 张卡片中删除标签
      </div>

      {#if tagStatistics().length === 0}
        <div class="brt-empty">
          <EnhancedIcon name={ICON_NAMES.TAG} size={32} />
          <p>选中的卡片没有标签</p>
        </div>
      {:else}
        <!-- 快捷操作 -->
        <div class="brt-actions">
          <button class="brt-action-btn" onclick={selectAll} type="button">
            全选
          </button>
          <button class="brt-action-btn" onclick={clearSelection} type="button">
            清空
          </button>
          <span class="brt-selection-count">
            已选择 <strong>{selectedTags.size}</strong> 个标签
          </span>
        </div>

        <!-- 标签列表 -->
        <div class="brt-tag-list">
          {#each tagStatistics() as stat (stat.tag)}
            <button 
              class="brt-tag-item"
              class:selected={selectedTags.has(stat.tag)}
              onclick={() => toggleTag(stat.tag)}
              type="button"
            >
              <div class="brt-tag-checkbox">
                {#if selectedTags.has(stat.tag)}
                  <EnhancedIcon name={ICON_NAMES.CHECK} size={12} />
                {/if}
              </div>
              <div class="brt-tag-content">
                <div class="brt-tag-name">
                  <EnhancedIcon name={ICON_NAMES.TAG} size={14} />
                  <span>{stat.tag}</span>
                </div>
                <div class="brt-tag-stats">
                  <span class="brt-tag-count">{stat.count} 张卡片</span>
                  <div class="brt-tag-bar">
                    <div 
                      class="brt-tag-bar-fill" 
                      style="width: {stat.percentage}%"
                    ></div>
                  </div>
                  <span class="brt-tag-percentage">{stat.percentage.toFixed(0)}%</span>
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </main>

    <!-- 底部操作栏 -->
    <footer class="brt-footer">
      <button class="brt-btn brt-btn-secondary" onclick={handleCancel} type="button">
        取消
      </button>
      <button 
        class="brt-btn brt-btn-danger"
        onclick={handleConfirm}
        disabled={selectedTags.size === 0}
        type="button"
      >
        删除 {selectedTags.size > 0 ? `${selectedTags.size} 个标签` : '...'}
      </button>
    </footer>
  </div>
</div>
{/if}

<style>
  .brt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    padding: 1rem;
    backdrop-filter: blur(2px);
  }

  .brt-modal {
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* 标题栏 */
  .brt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .brt-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 多彩侧边颜色条 */
  .brt-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
  }

  .brt-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 24px;
    border-radius: 2px;
  }

  .brt-title.accent-pink::before {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.9), rgba(219, 39, 119, 0.7));
  }

  .brt-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .brt-close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 主内容区 */
  .brt-main {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .brt-card-count {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .brt-card-count strong {
    color: var(--text-normal);
    font-weight: 600;
  }

  .brt-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--text-faint);
    text-align: center;
  }

  .brt-empty p {
    margin: 12px 0 0 0;
    font-size: 0.875rem;
  }

  /* 快捷操作 */
  .brt-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brt-action-btn {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .brt-action-btn:hover {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .brt-selection-count {
    margin-left: auto;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .brt-selection-count strong {
    color: rgb(236, 72, 153);
    font-weight: 600;
  }

  /* 标签列表 */
  .brt-tag-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 320px;
    overflow-y: auto;
  }

  .brt-tag-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .brt-tag-item:hover {
    background: var(--background-secondary);
  }

  .brt-tag-item.selected {
    background: rgba(236, 72, 153, 0.12);
  }

  .brt-tag-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .brt-tag-item.selected .brt-tag-checkbox {
    background: rgb(236, 72, 153);
    border-color: rgb(236, 72, 153);
    color: white;
  }

  .brt-tag-content {
    flex: 1;
    min-width: 0;
  }

  .brt-tag-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .brt-tag-name span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .brt-tag-stats {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brt-tag-count {
    color: var(--text-muted);
    font-size: 0.75rem;
    min-width: 50px;
  }

  .brt-tag-bar {
    flex: 1;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .brt-tag-bar-fill {
    height: 100%;
    background: rgb(236, 72, 153);
    transition: width 0.3s ease;
  }

  .brt-tag-percentage {
    color: var(--text-muted);
    font-size: 0.75rem;
    min-width: 30px;
    text-align: right;
  }

  /* 底部操作栏 */
  .brt-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .brt-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .brt-btn-secondary {
    background: transparent;
    color: var(--text-muted);
  }

  .brt-btn-secondary:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .brt-btn-danger {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.9), rgba(219, 39, 119, 0.8));
    color: white;
  }

  .brt-btn-danger:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .brt-btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

