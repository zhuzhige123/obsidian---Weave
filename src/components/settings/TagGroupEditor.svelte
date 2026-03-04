<script lang="ts">
  import { Notice } from 'obsidian';
  import type AnkiObsidianPlugin from '../../main';
  import type { DeckTagGroup } from '../../types/deck-kanban-types';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';

  interface Props {
    plugin: AnkiObsidianPlugin;
    tagGroup: DeckTagGroup | null;
    onSave: (tagGroup: DeckTagGroup) => void;
    onCancel: () => void;
  }

  let { plugin, tagGroup, onSave, onCancel }: Props = $props();

  let id = $state(tagGroup?.id || `tag-group-${Date.now()}`);
  let name = $state(tagGroup?.name || '');
  let tags = $state<string[]>(tagGroup?.tags || []);
  let icon = $state(tagGroup?.icon || '📦');
  let color = $state(tagGroup?.color || '#3b82f6');
  let description = $state(tagGroup?.description || '');
  let tagInput = $state('');
  let showSuggestions = $state(false);
  let allExistingTags = $state<string[]>([]);

  const commonIcons = [
    '📦', '🫀', '🫁', '🧠', '🦠', '💊',
    '🎨', '⚙️', '🔢', '🐳', '💻', '📱',
    '📖', '📚', '🇯🇵', '🇺🇸', '🇨🇳',
    '🎓', '📝', '💼', '💰', '🌱', '🎭'
  ];

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

  const filteredTags = $derived.by(() => {
    if (!tagInput) return [];
    const lower = tagInput.toLowerCase();
    return allExistingTags
      .filter(tag => tag.toLowerCase().includes(lower) && !tags.includes(tag))
      .slice(0, 8);
  });

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

  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

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

  function handleSave() {
    if (!name.trim()) {
      new Notice('请输入标签组名称');
      return;
    }
    if (tags.length === 0) {
      new Notice('请至少添加一个标签');
      return;
    }
    const newTagGroup: DeckTagGroup = {
      id, name: name.trim(), tags, icon, color,
      description: description.trim()
    };
    onSave(newTagGroup);
  }
</script>

<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
  <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>{tagGroup ? '编辑标签组' : '新建标签组'}</h3>
      <button class="close-btn" onclick={onCancel}>
        <EnhancedIcon name="x" size={20} />
      </button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">
          <EnhancedIcon name="type" size={16} />
          标签组名称 <span class="required">*</span>
        </label>
        <input type="text" class="form-input" placeholder="例如：循环系统、前端开发" bind:value={name} />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">
            <EnhancedIcon name="smile" size={16} />
            图标
          </label>
          <div class="icon-selector">
            {#each commonIcons as iconOption}
              <button class="icon-option {icon === iconOption ? 'selected' : ''}" onclick={() => icon = iconOption}>
                {iconOption}
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            <EnhancedIcon name="palette" size={16} />
            颜色
          </label>
          <input type="color" class="color-input" bind:value={color} />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">
          <EnhancedIcon name="tags" size={16} />
          包含的标签 <span class="required">*</span>
        </label>
        <div class="tag-input-container">
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
          <div class="tag-input-wrapper">
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
              <div class="tag-suggestions">
                {#each filteredTags as tag}
                  <div class="tag-suggestion" onclick={() => addTag(tag)}>{tag}</div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <div class="form-hint">从现有牌组标签中选择，或输入新标签</div>
      </div>

      <div class="form-group">
        <label class="form-label">
          <EnhancedIcon name="file-text" size={16} />
          描述（可选）
        </label>
        <textarea class="form-textarea" placeholder="简要描述这个标签组的用途" bind:value={description} rows="3" />
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn" onclick={onCancel}>取消</button>
      <button class="btn primary" onclick={handleSave}>{tagGroup ? '保存' : '创建'}</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
  .modal-dialog { width: 100%; max-width: 600px; max-height: 90vh; background: var(--background-primary); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid var(--background-modifier-border); }
  .modal-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
  .close-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: none; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
  .close-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
  .modal-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  .form-group { display: flex; flex-direction: column; gap: 8px; }
  .form-row { display: grid; grid-template-columns: 1fr 150px; gap: 16px; }
  .form-label { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--text-normal); }
  .required { color: var(--text-error); }
  .form-input, .form-textarea { width: 100%; padding: 8px 12px; font-size: 14px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); color: var(--text-normal); transition: border-color 0.2s; }
  .form-input:focus, .form-textarea:focus { outline: none; border-color: var(--interactive-accent); }
  .form-textarea { resize: vertical; font-family: inherit; }
  .form-hint { font-size: 12px; color: var(--text-muted); }
  .icon-selector { display: flex; flex-wrap: wrap; gap: 6px; }
  .icon-option { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; font-size: 20px; border: 2px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-secondary); cursor: pointer; transition: all 0.2s; }
  .icon-option:hover { border-color: var(--interactive-accent); transform: scale(1.1); }
  .icon-option.selected { border-color: var(--interactive-accent); background: var(--interactive-accent-hover); }
  .color-input { width: 100%; height: 40px; padding: 4px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); cursor: pointer; }
  .tag-input-container { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-secondary); }
  .tag-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 32px; }
  .tag-chip { display: flex; align-items: center; gap: 4px; padding: 6px 10px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 12px; font-size: 13px; }
  .remove-btn { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; padding: 0; border: none; border-radius: 50%; background: var(--background-modifier-hover); color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
  .remove-btn:hover { background: var(--background-modifier-error); color: var(--text-error); }
  .tag-input-wrapper { position: relative; }
  .tag-input { width: 100%; padding: 8px; font-size: 14px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); }
  .tag-input:focus { outline: none; border-color: var(--interactive-accent); }
  .tag-suggestions { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; max-height: 200px; overflow-y: auto; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; }
  .tag-suggestion { padding: 8px 12px; font-size: 13px; color: var(--text-normal); cursor: pointer; transition: background 0.2s; }
  .tag-suggestion:hover { background: var(--background-modifier-hover); }
  .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 20px; border-top: 1px solid var(--background-modifier-border); }
  .btn { padding: 8px 20px; font-size: 14px; font-weight: 500; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); color: var(--text-normal); cursor: pointer; transition: all 0.2s; }
  .btn:hover { background: var(--background-modifier-hover); border-color: var(--interactive-accent); }
  .btn.primary { background: var(--interactive-accent); color: var(--text-on-accent); border-color: var(--interactive-accent); }
  .btn.primary:hover { background: var(--interactive-accent-hover); }
</style>
