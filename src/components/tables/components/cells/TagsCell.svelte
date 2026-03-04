<script lang="ts">
  import { Menu, Platform } from 'obsidian';
  import EnhancedIcon from "../../../ui/EnhancedIcon.svelte";
  import { getTagColor } from "../../utils/table-utils";
  import { showObsidianInput } from "../../../../utils/obsidian-confirm";
  import type { TagsCellProps } from "../../types/table-types";

  let { card, onTagsUpdate, availableTags = [], app }: TagsCellProps = $props();

  //  移动端检测
  const isMobile = Platform.isMobile;

  let isEditing = $state(false);
  let tags = $state<string[]>([]);
  let tagInput = $state("");
  let containerEl: HTMLDivElement | null = $state(null);
  
  //  响应式显示标签
  let displayTags = $derived(card.tags || []);

  //  移动端：显示 Obsidian Menu 选择标签
  function showTagsMenu(event: MouseEvent) {
    event.stopPropagation();
    if (!onTagsUpdate) return;
    
    const currentTags = [...(card.tags || [])];
    const menu = new Menu();
    
    // 显示已选标签（点击取消选择）
    if (currentTags.length > 0) {
      currentTags.forEach(tag => {
        menu.addItem(item => {
          item
            .setTitle(`✓ ${tag}`)
            .setIcon('check')
            .onClick(() => {
              const newTags = currentTags.filter(t => t !== tag);
              onTagsUpdate(card.uuid, newTags);
            });
        });
      });
      menu.addSeparator();
    }
    
    // 显示可选标签（未选中的）
    const unselectedTags = availableTags.filter(t => !currentTags.includes(t));
    if (unselectedTags.length > 0) {
      unselectedTags.forEach(tag => {
        menu.addItem(item => {
          item
            .setTitle(tag)
            .setIcon('tag')
            .onClick(() => {
              const newTags = [...currentTags, tag];
              onTagsUpdate(card.uuid, newTags);
            });
        });
      });
      menu.addSeparator();
    }
    
    // 添加新标签选项
    menu.addItem(item => {
      item
        .setTitle('+ 添加新标签...')
        .setIcon('plus')
        .onClick(async () => {
          // 使用简单的 prompt 输入
          const newTag = await promptForNewTag();
          if (newTag && newTag.trim()) {
            const trimmedTag = newTag.trim();
            if (!currentTags.includes(trimmedTag)) {
              const newTags = [...currentTags, trimmedTag];
              onTagsUpdate(card.uuid, newTags);
            }
          }
        });
    });

    menu.showAtMouseEvent(event);
  }

  // 简单的输入提示
  async function promptForNewTag(): Promise<string | null> {
    if (app) {
      return showObsidianInput(app, '请输入标签名称:', '', { title: '添加新标签' });
    }
    // 降级：无 app 时返回 null（避免使用 window.prompt）
    return null;
  }

  //  桌面端：开始编辑
  function startEditing(e?: MouseEvent) {
    if (e) {
      e.stopPropagation();
    }
    tags = [...(card.tags || [])];
    tagInput = "";
    isEditing = true;
  }

  function cancelEditing(e?: MouseEvent) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    isEditing = false;
    tags = [];
    tagInput = "";
  }

  function saveTags(e?: MouseEvent) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!onTagsUpdate) {
      isEditing = false;
      return;
    }
    
    isEditing = false;
    onTagsUpdate(card.uuid, tags);
    tags = [];
    tagInput = "";
  }
  
  function addTag(tag: string) {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      tags = [...tags, trimmedTag];
      tagInput = '';
    }
  }
  
  function handleTagInput(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        addTag(tagInput);
      } else {
        saveTags();
      }
    } else if (e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      e.preventDefault();
      tags = tags.slice(0, -1);
    }
  }
  
  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
  }
  
  function toggleTag(tag: string) {
    if (tags.includes(tag)) {
      removeTag(tag);
    } else {
      addTag(tag);
    }
  }
  
  // 点击外部关闭编辑（仅桌面端）
  $effect(() => {
    if (!isEditing || !containerEl || isMobile) return;
    
    function handleClickOutside(e: MouseEvent) {
      if (containerEl && !containerEl.contains(e.target as Node)) {
        isEditing = false;
        if (onTagsUpdate) {
          onTagsUpdate(card.uuid, tags);
        }
        tags = [];
        tagInput = "";
      }
    }
    
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });
</script>

<td class="weave-tags-column" class:mobile={isMobile}>
  {#if isMobile}
    <!--  移动端：紧凑显示 + Obsidian Menu -->
    <button
      class="weave-tags-mobile-btn"
      onclick={showTagsMenu}
      aria-label="编辑标签"
      type="button"
    >
      {#if displayTags.length > 0}
        <span class="weave-tag-compact weave-tag-{getTagColor(displayTags[0])}">{displayTags[0]}</span>
        {#if displayTags.length > 1}
          <span class="weave-tags-count">+{displayTags.length - 1}</span>
        {/if}
      {:else}
        <EnhancedIcon name="tag" size={14} />
      {/if}
    </button>
  {:else if isEditing}
    <!--  桌面端：编辑模式 -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div 
      class="weave-tags-editor" 
      bind:this={containerEl}
      onclick={(e) => { e.stopPropagation(); e.preventDefault(); }}
    >
      <div class="tag-input-wrapper">
        {#if tags.length > 0}
          <div class="selected-tags">
            {#each tags as tag}
              <span class="tag-chip">
                <span class="tag-text">{tag}</span>
                <button 
                  type="button"
                  class="tag-chip-remove" 
                  onclick={() => removeTag(tag)}
                  aria-label="移除标签"
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
        {/if}
        <input 
          class="tag-input" 
          placeholder={tags.length > 0 ? "" : "输入标签后按回车添加"} 
          bind:value={tagInput}
          onkeydown={handleTagInput}
        />
      </div>
      
      {#if availableTags.length > 0}
        <div class="available-tags">
          <div class="available-tags-title">可选标签</div>
          <div class="available-tags-list">
            {#each availableTags as tag}
              <button 
                type="button"
                class="available-tag-item {tags.includes(tag) ? 'selected' : ''}"
                onclick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      <div class="tag-editor-actions">
        <button type="button" class="tag-btn tag-btn-cancel" onclick={(e) => cancelEditing(e)}>取消</button>
        <button type="button" class="tag-btn tag-btn-save" onclick={(e) => saveTags(e)}>保存</button>
      </div>
    </div>
  {:else}
    <!--  桌面端：显示模式 -->
    <button
      class="weave-tags-container"
      onclick={(e) => startEditing(e)}
      onkeydown={(e) => e.key === 'Enter' && startEditing()}
      aria-label="编辑标签"
      type="button"
    >
      {#if displayTags.length > 0}
        {#each displayTags.slice(0, 2) as tag (tag)}
          <span class="weave-tag weave-tag-{getTagColor(tag)}">{tag}</span>
        {/each}
        {#if displayTags.length > 2}
          <span class="weave-tags-more">+{displayTags.length - 2}</span>
        {/if}
      {:else}
        <span class="weave-text-muted weave-tags-placeholder">点击添加标签</span>
      {/if}
      <div class="weave-tags-edit-hint">
        <EnhancedIcon name="edit" size={12} />
      </div>
    </button>
  {/if}
</td>

<style>
  /*  移动端列宽 */
  .weave-tags-column.mobile {
    width: 60px;
    min-width: 60px;
    max-width: 60px;
  }

  /*  桌面端列宽 */
  .weave-tags-column:not(.mobile) {
    position: relative;
    min-width: 150px;
    max-width: 200px;
  }

  /*  移动端按钮样式 */
  .weave-tags-mobile-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 100%;
    padding: 4px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
    min-height: 28px;
  }

  .weave-tags-mobile-btn:active {
    background: var(--background-modifier-hover);
  }

  /*  移动端紧凑标签 */
  .weave-tag-compact {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 500;
    max-width: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /*  移动端标签数量 */
  .weave-tags-count {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 500;
  }

  /*  桌面端容器 */
  .weave-tags-container {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 6px;
    padding: 4px;
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
  }

  .weave-tags-container:hover {
    background: var(--background-modifier-hover);
  }

  .weave-tags-container:hover .weave-tags-edit-hint {
    opacity: 1;
  }

  .weave-tags-edit-hint {
    opacity: 0;
    transition: opacity 0.2s ease;
    color: var(--text-muted);
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .weave-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weave-tag-blue { background: rgba(59, 130, 246, 0.15); color: rgb(59, 130, 246); }
  .weave-tag-green { background: rgba(16, 185, 129, 0.15); color: rgb(16, 185, 129); }
  .weave-tag-purple { background: rgba(139, 92, 246, 0.15); color: rgb(139, 92, 246); }
  .weave-tag-orange { background: rgba(249, 115, 22, 0.15); color: rgb(249, 115, 22); }
  .weave-tag-pink { background: rgba(236, 72, 153, 0.15); color: rgb(236, 72, 153); }
  .weave-tag-cyan { background: rgba(6, 182, 212, 0.15); color: rgb(6, 182, 212); }
  .weave-tag-red { background: rgba(239, 68, 68, 0.15); color: rgb(239, 68, 68); }
  .weave-tag-yellow { background: rgba(234, 179, 8, 0.15); color: rgb(234, 179, 8); }

  .weave-tags-more {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--background-modifier-border);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .weave-tags-placeholder {
    font-size: 0.8rem;
    color: var(--text-faint);
    font-style: italic;
  }

  .weave-text-muted {
    color: var(--text-muted);
  }
  
  /*  桌面端编辑器 */
  .weave-tags-editor {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    min-width: 300px;
    padding: 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 20;
  }
  
  .tag-input-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    min-height: 32px;
    transition: all 0.2s ease;
  }
  
  .tag-input-wrapper:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
  
  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.15s ease;
  }
  
  .tag-chip:hover {
    background: color-mix(in srgb, var(--interactive-accent) 85%, black);
  }
  
  .tag-chip .tag-text {
    line-height: 1.2;
  }
  
  .tag-chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: var(--text-on-accent);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .tag-chip-remove:hover {
    background: rgba(255, 255, 255, 0.35);
    transform: scale(1.15);
  }
  
  .tag-input {
    flex: 1;
    min-width: 80px;
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: 12px;
    outline: none;
  }
  
  .tag-input::placeholder {
    color: var(--text-faint);
    font-size: 11px;
  }
  
  .available-tags {
    margin-top: 8px;
    padding: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    max-height: 150px;
    overflow-y: auto;
  }
  
  .available-tags-title {
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 4px;
    font-weight: 500;
  }
  
  .available-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .available-tag-item {
    padding: 3px 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    color: var(--text-normal);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .available-tag-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateY(-1px);
  }
  
  .available-tag-item.selected {
    background: color-mix(in srgb, var(--interactive-accent) 15%, var(--background-secondary));
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    font-weight: 600;
  }
  
  .available-tag-item.selected:hover {
    background: color-mix(in srgb, var(--interactive-accent) 20%, var(--background-secondary));
  }
  
  .tag-editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  .tag-btn {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--background-modifier-border);
  }
  
  .tag-btn-cancel {
    background: var(--background-secondary);
    color: var(--text-normal);
  }
  
  .tag-btn-cancel:hover {
    background: var(--background-modifier-hover);
  }
  
  .tag-btn-save {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }
  
  .tag-btn-save:hover {
    background: color-mix(in srgb, var(--interactive-accent) 85%, black);
  }
</style>
