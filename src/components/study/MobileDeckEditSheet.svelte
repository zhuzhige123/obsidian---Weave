<script lang="ts">
  /**
   * 移动端牌组编辑 Bottom Sheet 组件
   * 
   * Part A Task 7: 牌组编辑界面重构
   * 底部弹出式编辑界面，包含名称输入和标签选择
   * 
   * @module components/study/MobileDeckEditSheet
   * @version 1.0.0
   */
  import BottomSheetModal from '../ui/BottomSheetModal.svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import type { Snippet } from 'svelte';

  interface TagItem {
    id: string;
    name: string;
    color: string;
    selected: boolean;
  }

  interface Props {
    /** 是否显示 */
    isOpen: boolean;
    /** 牌组名称 */
    deckName: string;
    /** 标签列表 */
    tags: TagItem[];
    /** 关闭回调 */
    onClose: () => void;
    /** 保存回调 */
    onSave: (name: string, selectedTagIds: string[]) => void;
    /** 名称变更回调 */
    onNameChange?: (name: string) => void;
    /** 标签切换回调 */
    onTagToggle?: (tagId: string) => void;
  }

  let {
    isOpen = false,
    deckName = '',
    tags = [],
    onClose,
    onSave,
    onNameChange,
    onTagToggle
  }: Props = $props();

  // 本地状态
  let localName = $state(deckName);
  let localTags = $state<TagItem[]>([...tags]);

  // 同步外部状态
  $effect(() => {
    localName = deckName;
  });

  $effect(() => {
    localTags = [...tags];
  });

  function handleNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    localName = target.value;
    onNameChange?.(localName);
  }

  function handleTagToggle(tagId: string) {
    localTags = localTags.map(tag => 
      tag.id === tagId ? { ...tag, selected: !tag.selected } : tag
    );
    onTagToggle?.(tagId);
  }

  function handleSave() {
    const selectedTagIds = localTags.filter(t => t.selected).map(t => t.id);
    onSave(localName, selectedTagIds);
    onClose();
  }

  function handleCancel() {
    // 重置本地状态
    localName = deckName;
    localTags = [...tags];
    onClose();
  }
</script>

<BottomSheetModal
  {isOpen}
  onClose={handleCancel}
  title="编辑牌组"
  height="auto"
>
  {#snippet children()}
    <div class="edit-sheet-content">
      <!-- 名称输入 -->
      <div class="edit-form-group">
        <label class="edit-form-label" for="deck-name-input">牌组名称</label>
        <input
          id="deck-name-input"
          type="text"
          class="edit-form-input"
          value={localName}
          oninput={handleNameInput}
          placeholder="输入牌组名称"
        />
      </div>

      <!-- 标签选择 -->
      <div class="edit-form-group">
        <span class="edit-form-label" id="tag-list-label">选择标签</span>
        <div class="tag-list" role="listbox" aria-labelledby="tag-list-label">
          {#each localTags as tag}
            <button
              class="tag-list-item"
              class:selected={tag.selected}
              onclick={() => handleTagToggle(tag.id)}
            >
              <span
                class="tag-color"
                style="background-color: {tag.color}"
              ></span>
              <span class="tag-name">{tag.name}</span>
              {#if tag.selected}
                <span class="tag-check">
                  <EnhancedIcon name="check" size={14} />
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="edit-sheet-footer">
      <button class="btn btn-cancel" onclick={handleCancel}>取消</button>
      <button class="btn btn-primary" onclick={handleSave}>保存</button>
    </div>
  {/snippet}
</BottomSheetModal>

<style>
  .edit-sheet-content {
    padding: 0;
  }

  .edit-form-group {
    margin-bottom: 16px;
  }

  .edit-form-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
    display: block;
  }

  .edit-form-input {
    width: 100%;
    padding: 12px 14px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    color: var(--text-normal);
    font-size: 15px;
    outline: none;
  }

  .edit-form-input:focus {
    border-color: var(--weave-mobile-primary-color, #7c3aed);
  }

  .tag-list {
    background: var(--background-secondary);
    border-radius: 10px;
    overflow: hidden;
  }

  .tag-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: none;
    border-bottom: 1px solid var(--background-modifier-border);
    cursor: pointer;
    background: transparent;
    width: 100%;
    text-align: left;
  }

  .tag-list-item:last-child {
    border-bottom: none;
  }

  .tag-list-item:active {
    background: var(--background-modifier-hover);
  }

  .tag-list-item.selected {
    background: rgba(124, 58, 237, 0.1);
  }

  .tag-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-name {
    flex: 1;
    font-size: 14px;
    color: var(--text-normal);
  }

  .tag-check {
    color: var(--weave-mobile-primary-color, #a78bfa);
  }

  .edit-sheet-footer {
    display: flex;
    gap: 12px;
  }

  .btn {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    text-align: center;
  }

  .btn-cancel {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .btn-primary {
    background: var(--weave-mobile-primary-color, #7c3aed);
    color: white;
  }

  .btn:active {
    opacity: 0.8;
  }
</style>
