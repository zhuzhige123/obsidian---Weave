<script lang="ts">
  import { Notice } from 'obsidian';
  import type AnkiObsidianPlugin from '../../main';
  import type { DeckTagGroup } from '../../types/deck-kanban-types';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface Props {
    plugin: AnkiObsidianPlugin;
    editingTagGroup?: DeckTagGroup; // 🆕 可选的编辑模式
    onSave: (tagGroup: DeckTagGroup) => void;
    onCancel: () => void;
  }

  let { plugin, editingTagGroup, onSave, onCancel }: Props = $props();

  // 🆕 初始化时加载编辑数据
  let name = $state(editingTagGroup?.name || '');
  let tags = $state<string[]>(editingTagGroup?.tags || []);
  let tagInput = $state('');
  let showSuggestions = $state(false);
  let allExistingTags = $state<string[]>([]);

  // 加载现有牌组标签
  $effect(() => {
    async function loadExistingTags() {
      const decks = await plugin.dataStorage.getDecks();
      const tagSet = new Set<string>();
      decks.forEach(deck => {
        if (deck.tags && deck.tags.length > 0) {
          deck.tags.forEach(tag => tagSet.add(tag));
        }
      });
      allExistingTags = Array.from(tagSet).sort();
    }
    loadExistingTags();
  });

  // 过滤标签建议
  const filteredTags = $derived.by(() => {
    if (!tagInput) return [];
    const lower = tagInput.toLowerCase();
    return allExistingTags
      .filter(tag => tag.toLowerCase().includes(lower) && !tags.includes(tag))
      .slice(0, 8);
  });

  // 添加标签
  function addTag(tag: string) {
    if (!tag.trim()) return;
    if (tags.includes(tag)) {
      new Notice('标签已存在');
      return;
    }
    tags = [...tags, tag.trim()];
    tagInput = '';
    showSuggestions = false;
  }

  // 移除标签
  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  // 处理输入
  function handleTagInput(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags.length > 0) {
        addTag(filteredTags[0]);
      } else if (tagInput.trim()) {
        addTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      showSuggestions = false;
    }
  }

  // 保存
  function handleSave() {
    if (!name.trim()) {
      new Notice('请输入标签组名称');
      return;
    }
    if (tags.length === 0) {
      new Notice('请至少添加一个标签');
      return;
    }

    const savedTagGroup: DeckTagGroup = {
      id: editingTagGroup?.id || `tag-group-${Date.now()}`, // 🆕 编辑模式保留原ID
      name: name.trim(),
      tags,
      icon: editingTagGroup?.icon || '📦', // 🆕 保留原图标
      color: editingTagGroup?.color || '#3b82f6' // 🆕 保留原颜色
    };

    onSave(savedTagGroup);
  }
</script>

<div class="quick-creator-overlay" onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
  <div class="quick-creator-dialog" onclick={(e) => e.stopPropagation()}>
    <div class="creator-header">
      <h3>{editingTagGroup ? '编辑标签组' : '创建标签组'}</h3>
      <button class="close-btn" onclick={onCancel}>
        <EnhancedIcon name="x" size={18} />
      </button>
    </div>

    <div class="creator-body">
      <div class="form-field">
        <label>标签组名称</label>
        <input
          type="text"
          class="text-input"
          placeholder="例如：循环系统、前端开发"
          bind:value={name}
          autofocus
        />
      </div>

      <div class="form-field">
        <label>包含的标签</label>
        <div class="tag-container">
          {#if tags.length > 0}
            <div class="tag-chips">
              {#each tags as tag, i}
                <div class="tag-chip">
                  <span>{tag}</span>
                  <button class="remove-btn" onclick={() => removeTag(i)}>
                    <EnhancedIcon name="x" size={12} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="input-wrapper">
            <input
              type="text"
              class="tag-input"
              placeholder="输入标签后按回车添加"
              bind:value={tagInput}
              onkeydown={handleTagInput}
              onfocus={() => showSuggestions = true}
              onblur={() => setTimeout(() => showSuggestions = false, 200)}
            />

            {#if showSuggestions && filteredTags.length > 0}
              <div class="suggestions">
                {#each filteredTags as tag}
                  <div class="suggestion-item" onclick={() => addTag(tag)}>
                    {tag}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <div class="hint">从现有牌组标签中选择，或输入新标签</div>
      </div>
    </div>

    <div class="creator-footer">
      <button class="btn" onclick={onCancel}>取消</button>
      <button class="btn primary" onclick={handleSave}>{editingTagGroup ? '保存' : '创建'}</button>
    </div>
  </div>
</div>

<style>
  .quick-creator-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
  }

  .quick-creator-dialog {
    width: 100%;
    max-width: 500px;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }

  .creator-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .creator-header h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .creator-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-field label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .text-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    transition: border-color 0.2s;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .tag-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    font-size: 12px;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .remove-btn:hover {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  .input-wrapper {
    position: relative;
  }

  .tag-input {
    width: 100%;
    padding: 8px;
    font-size: 13px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .tag-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    max-height: 180px;
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
  }

  .suggestion-item {
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-normal);
    cursor: pointer;
    transition: background 0.2s;
  }

  .suggestion-item:hover {
    background: var(--background-modifier-hover);
  }

  .hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  .creator-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .btn {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .btn.primary:hover {
    background: var(--interactive-accent-hover);
  }
</style>
