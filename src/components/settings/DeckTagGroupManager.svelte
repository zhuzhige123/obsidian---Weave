<script lang="ts">
  import { Notice } from 'obsidian';
  import type AnkiObsidianPlugin from '../../main';
  import type { DeckTagGroup } from '../../types/deck-kanban-types';
  import { DEFAULT_TAG_GROUP_TEMPLATES, TAG_GROUP_CATEGORIES } from '../../config/default-tag-groups';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import TagGroupEditor from './TagGroupEditor.svelte';
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';

  interface Props {
    plugin: AnkiObsidianPlugin;
  }

  let { plugin }: Props = $props();

  // 状态管理
  let tagGroups = $state<DeckTagGroup[]>(plugin.settings.deckTagGroups || []);
  let showEditor = $state(false);
  let editingTagGroup = $state<DeckTagGroup | null>(null);
  let showTemplateImport = $state(false);

  // 保存标签组
  async function saveTagGroups() {
    plugin.settings.deckTagGroups = tagGroups;
    await plugin.saveSettings();
    new Notice('标签组已保存');
  }

  // 新建标签组
  function createTagGroup() {
    editingTagGroup = null;
    showEditor = true;
  }

  // 编辑标签组
  function editTagGroup(tagGroup: DeckTagGroup) {
    editingTagGroup = { ...tagGroup };
    showEditor = true;
  }

  // 删除标签组
  async function deleteTagGroup(id: string) {
    const confirmed = await showObsidianConfirm(plugin.app, '确定要删除这个标签组吗？', { title: '确认删除' });
    if (!confirmed) {
      return;
    }

    tagGroups = tagGroups.filter(tg => tg.id !== id);
    await saveTagGroups();
    new Notice('标签组已删除');
  }

  // 保存编辑结果
  async function handleSave(tagGroup: DeckTagGroup) {
    if (editingTagGroup) {
      // 更新现有标签组
      const index = tagGroups.findIndex(tg => tg.id === tagGroup.id);
      if (index >= 0) {
        tagGroups[index] = tagGroup;
      }
    } else {
      // 添加新标签组
      tagGroups = [...tagGroups, tagGroup];
    }

    await saveTagGroups();
    showEditor = false;
    editingTagGroup = null;
  }

  // 从模板导入
  async function importFromTemplate(template: DeckTagGroup) {
    // 检查是否已存在
    if (tagGroups.some(tg => tg.id === template.id)) {
      new Notice('该标签组已存在');
      return;
    }

    tagGroups = [...tagGroups, { ...template }];
    await saveTagGroups();
    new Notice(`已导入标签组：${template.name}`);
  }

  // 批量导入分类
  async function importCategory(categoryId: string) {
    const category = TAG_GROUP_CATEGORIES[categoryId as keyof typeof TAG_GROUP_CATEGORIES];
    if (!category) return;

    let importCount = 0;
    for (const groupId of category.groups) {
      const template = DEFAULT_TAG_GROUP_TEMPLATES.find(t => t.id === groupId);
      if (template && !tagGroups.some(tg => tg.id === template.id)) {
        tagGroups = [...tagGroups, { ...template }];
        importCount++;
      }
    }

    if (importCount > 0) {
      await saveTagGroups();
      new Notice(`已导入 ${importCount} 个标签组`);
    }
    showTemplateImport = false;
  }
</script>

<div class="tag-group-manager">
  <div class="manager-header">
    <h3>
      <EnhancedIcon name="tags" size={20} />
      牌组标签组管理
    </h3>
    <p class="header-desc">创建标签组，在看板视图中按主题分组显示牌组</p>
  </div>

  <div class="manager-actions">
    <button class="action-btn primary" onclick={createTagGroup}>
      <EnhancedIcon name="plus" size={16} />
      新建标签组
    </button>
    <button class="action-btn" onclick={() => showTemplateImport = true}>
      <EnhancedIcon name="download" size={16} />
      从模板导入
    </button>
  </div>

  {#if tagGroups.length === 0}
    <div class="empty-state">
      <EnhancedIcon name="inbox" size={48} />
      <h4>还没有标签组</h4>
      <p>创建标签组来组织您的牌组，或从模板快速导入</p>
    </div>
  {:else}
    <div class="tag-group-list">
      {#each tagGroups as tagGroup (tagGroup.id)}
        <div class="tag-group-card">
          <div class="card-header">
            <div class="card-title">
              <span class="group-icon">{tagGroup.icon || '📦'}</span>
              <span class="group-name">{tagGroup.name}</span>
            </div>
            <div class="card-actions">
              <button 
                class="icon-btn" 
                title="编辑"
                onclick={() => editTagGroup(tagGroup)}
              >
                <EnhancedIcon name="edit" size={16} />
              </button>
              <button 
                class="icon-btn danger" 
                title="删除"
                onclick={() => deleteTagGroup(tagGroup.id)}
              >
                <EnhancedIcon name="trash-2" size={16} />
              </button>
            </div>
          </div>

          <div class="card-content">
            <div class="tag-list">
              {#each tagGroup.tags as tag}
                <span class="tag-badge">{tag}</span>
              {/each}
            </div>
            {#if tagGroup.description}
              <p class="group-description">{tagGroup.description}</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- 编辑器对话框 -->
{#if showEditor}
  <TagGroupEditor
    {plugin}
    tagGroup={editingTagGroup}
    onSave={handleSave}
    onCancel={() => {
      showEditor = false;
      editingTagGroup = null;
    }}
  />
{/if}

<!-- 模板导入对话框 -->
{#if showTemplateImport}
  <div class="modal-overlay" onclick={() => showTemplateImport = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>从模板导入标签组</h3>
        <button class="close-btn" onclick={() => showTemplateImport = false}>
          <EnhancedIcon name="x" size={20} />
        </button>
      </div>

      <div class="modal-body">
        <div class="template-categories">
          {#each Object.entries(TAG_GROUP_CATEGORIES) as [categoryId, category]}
            <div class="category-section">
              <div class="category-header">
                <span class="category-icon">{category.icon}</span>
                <span class="category-name">{category.name}</span>
                <button 
                  class="import-all-btn"
                  onclick={() => importCategory(categoryId)}
                >
                  导入全部
                </button>
              </div>

              <div class="template-list">
                {#each category.groups as groupId}
                  {@const template = DEFAULT_TAG_GROUP_TEMPLATES.find(t => t.id === groupId)}
                  {#if template}
                    {@const isImported = tagGroups.some(tg => tg.id === template.id)}
                    <div class="template-item {isImported ? 'imported' : ''}">
                      <div class="template-info">
                        <span class="template-icon">{template.icon || '📦'}</span>
                        <div class="template-details">
                          <div class="template-name">{template.name}</div>
                          <div class="template-tags">
                            {template.tags.slice(0, 3).join(', ')}
                            {#if template.tags.length > 3}
                              等 {template.tags.length} 个标签
                            {/if}
                          </div>
                        </div>
                      </div>
                      {#if isImported}
                        <span class="imported-badge">已导入</span>
                      {:else}
                        <button 
                          class="import-btn"
                          onclick={() => importFromTemplate(template)}
                        >
                          导入
                        </button>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .tag-group-manager {
    padding: 20px;
  }

  .manager-header {
    margin-bottom: 24px;
  }

  .manager-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0 0 8px 0;
  }

  .header-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .manager-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .action-btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .action-btn.primary:hover {
    background: var(--interactive-accent-hover);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
  }

  .empty-state h4 {
    font-size: 16px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: var(--text-normal);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0;
  }

  .tag-group-list {
    display: grid;
    gap: 16px;
  }

  .tag-group-card {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s;
  }

  .tag-group-card:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-icon {
    font-size: 20px;
  }

  .group-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .card-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
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

  .icon-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .icon-btn.danger:hover {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-badge {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
  }

  .group-description {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  /* 模态框样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .template-categories {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .category-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .category-icon {
    font-size: 20px;
  }

  .category-name {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .import-all-btn {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    transition: all 0.2s;
  }

  .import-all-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .template-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .template-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .template-item:hover {
    border-color: var(--interactive-accent);
  }

  .template-item.imported {
    opacity: 0.6;
  }

  .template-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .template-icon {
    font-size: 24px;
  }

  .template-details {
    flex: 1;
  }

  .template-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .template-tags {
    font-size: 12px;
    color: var(--text-muted);
  }

  .import-btn {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .import-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .imported-badge {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    background: var(--background-modifier-success);
    color: var(--text-success);
    border-radius: 12px;
  }
</style>
