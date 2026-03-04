<!--
  增量阅读标签组编辑器
  职责：创建/编辑 IRTagGroup 的弹窗表单
  
  @version 3.0.0
-->
<script lang="ts">
  import { Notice } from 'obsidian';
  import type WeavePlugin from '../../../main';
  import type { IRTagGroup, IRTagGroupMatchSource } from '../../../types/ir-types';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';

  interface Props {
    plugin: WeavePlugin;
    group: IRTagGroup | null;
    onSave: (group: IRTagGroup) => void;
    onCancel: () => void;
  }

  let { plugin, group, onSave, onCancel }: Props = $props();

  // 表单状态
  let name = $state(group?.name || '');
  let matchPriority = $state(group?.matchPriority || 100);
  let tags = $state<string[]>(group?.matchAnyTags || []);
  let tagInput = $state('');
  let showTagSuggestions = $state(false);

  // 匹配源配置
  let useYamlTags = $state(group?.matchSource?.yamlTags ?? true);
  let useInlineTags = $state(group?.matchSource?.inlineTags ?? true);
  let customProperties = $state<string[]>(group?.matchSource?.customProperties ?? []);
  let customPropInput = $state('');
  let showCustomProps = $state((group?.matchSource?.customProperties?.length ?? 0) > 0);

  // 从库中收集已有标签
  let existingTags = $state<string[]>([]);

  $effect(() => {
    loadExistingTags();
  });

  async function loadExistingTags() {
    try {
      const files = plugin.app.vault.getMarkdownFiles();
      const tagSet = new Set<string>();

      for (const file of files) {
        const cache = plugin.app.metadataCache.getFileCache(file);
        
        // frontmatter tags
        const fmTags = cache?.frontmatter?.tags;
        if (Array.isArray(fmTags)) {
          fmTags.forEach(t => tagSet.add(String(t).toLowerCase()));
        } else if (typeof fmTags === 'string') {
          fmTags.split(',').forEach(t => tagSet.add(t.trim().toLowerCase()));
        }

        // inline #tags
        cache?.tags?.forEach(t => {
          tagSet.add(t.tag.replace(/^#/, '').toLowerCase());
        });
      }

      existingTags = Array.from(tagSet).sort();
    } catch (error) {
      console.warn('[IRTagGroupEditor] 加载标签失败:', error);
    }
  }

  // 过滤标签建议
  const filteredSuggestions = $derived.by(() => {
    if (!tagInput.trim()) return [];
    const lower = tagInput.toLowerCase();
    return existingTags
      .filter(t => t.includes(lower) && !tags.includes(t))
      .slice(0, 8);
  });

  // 添加标签
  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      new Notice('标签已存在');
      return;
    }
    tags = [...tags, trimmed];
    tagInput = '';
    showTagSuggestions = false;
  }

  // 移除标签
  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  // 处理标签输入
  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        addTag(filteredSuggestions[0]);
      } else if (tagInput.trim()) {
        addTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      showTagSuggestions = false;
    }
  }

  // 验证并保存
  function handleSave() {
    if (!name.trim()) {
      new Notice('请输入标签组名称');
      return;
    }
    if (tags.length === 0) {
      new Notice('请至少添加一个匹配标签');
      return;
    }

    const now = new Date().toISOString();
    const matchSource: IRTagGroupMatchSource = {
      yamlTags: useYamlTags,
      inlineTags: useInlineTags,
      customProperties: customProperties.length > 0 ? customProperties : []
    };

    const savedGroup: IRTagGroup = {
      id: group?.id || `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: '',
      matchAnyTags: tags,
      matchPriority,
      matchSource,
      createdAt: group?.createdAt || now,
      updatedAt: now
    };

    onSave(savedGroup);
  }

  // 点击背景关闭
  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }
</script>

<div class="editor-overlay" onclick={handleOverlayClick}>
  <div class="editor-dialog" onclick={(e) => e.stopPropagation()}>
    <!-- 头部 -->
    <div class="dialog-header">
      <h3>{group ? '编辑标签组' : '新建标签组'}</h3>
      <button class="close-btn" onclick={onCancel}>
        <EnhancedIcon name="x" size={20} />
      </button>
    </div>

    <!-- 表单内容 -->
    <div class="dialog-body">
      <!-- 名称 -->
      <div class="form-group">
        <label class="form-label">
          标签组名称 <span class="required">*</span>
        </label>
        <input
          type="text"
          class="form-input"
          placeholder="例如：论文、技术文档、小说..."
          bind:value={name}
          autofocus
        />
        <p class="form-hint">用于识别这类阅读材料的名称</p>
      </div>

      <!-- 匹配标签 -->
      <div class="form-group">
        <label class="form-label">
          匹配标签 <span class="required">*</span>
        </label>
        <p class="form-hint">文档包含任一标签即归入此组</p>
        
        <div class="tags-container">
          {#if tags.length > 0}
            <div class="tags-list">
              {#each tags as tag, i}
                <div class="tag-chip">
                  <span>{tag}</span>
                  <button class="tag-remove" onclick={() => removeTag(i)}>
                    <EnhancedIcon name="x" size={12} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="tag-input-wrapper">
            <input
              type="text"
              class="tag-input"
              placeholder="输入标签后按回车添加"
              bind:value={tagInput}
              onkeydown={handleTagKeydown}
              onfocus={() => showTagSuggestions = true}
              onblur={() => setTimeout(() => showTagSuggestions = false, 200)}
            />

            {#if showTagSuggestions && filteredSuggestions.length > 0}
              <div class="tag-suggestions">
                {#each filteredSuggestions as suggestion}
                  <div
                    class="suggestion-item"
                    onclick={() => addTag(suggestion)}
                  >
                    {suggestion}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 匹配源配置 -->
      <div class="form-group">
        <label class="form-label">匹配源</label>
        <p class="form-hint">选择从文档的哪些位置提取标签进行匹配</p>
        <div class="match-source-options">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={useYamlTags} />
            <span>YAML tags 属性</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={useInlineTags} />
            <span>内联 #标签</span>
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={showCustomProps}
              onchange={(e) => {
                showCustomProps = (e.target as HTMLInputElement).checked;
                if (!showCustomProps) customProperties = [];
              }}
            />
            <span>自定义 YAML 属性</span>
          </label>
        </div>

        {#if showCustomProps}
          <div class="custom-props-container">
            {#if customProperties.length > 0}
              <div class="tags-list">
                {#each customProperties as prop, i}
                  <div class="tag-chip prop-chip">
                    <span>{prop}</span>
                    <button class="tag-remove" onclick={() => { customProperties = customProperties.filter((_, idx) => idx !== i); }}>
                      <EnhancedIcon name="x" size={12} />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
            <input
              type="text"
              class="tag-input"
              placeholder="输入属性名后按回车（如：关键词）"
              bind:value={customPropInput}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = customPropInput.trim();
                  if (trimmed && !customProperties.includes(trimmed)) {
                    customProperties = [...customProperties, trimmed];
                  }
                  customPropInput = '';
                }
              }}
            />
          </div>
        {/if}
      </div>

      <!-- 匹配优先级 -->
      <div class="form-group">
        <label class="form-label">匹配优先级</label>
        <div class="priority-input">
          <input
            type="range"
            min="1"
            max="200"
            step="1"
            bind:value={matchPriority}
            class="priority-slider"
          />
          <span class="priority-value">{matchPriority}</span>
        </div>
        <p class="form-hint">
          数值越小优先级越高。当文档匹配多个标签组时，优先归入优先级高的组。
        </p>
      </div>

      <!-- 算法说明 -->
      <div class="algorithm-note">
        <div class="note-title">
          <EnhancedIcon name="info" size={14} />
          <span>调度参数说明</span>
        </div>
        <div class="note-content">
          标签组创建后，系统会为其初始化默认调度参数（间隔因子=1.5）。
          随着该组文档的学习积累，参数会通过收缩学习（shrinkage）逐渐适应该类型材料的最佳节奏。
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="dialog-footer">
      <button class="btn secondary" onclick={onCancel}>取消</button>
      <button class="btn primary" onclick={handleSave}>
        {group ? '保存' : '创建'}
      </button>
    </div>
  </div>
</div>

<style>
  .editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .editor-dialog {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* 头部 */
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
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
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  /* 表单内容 */
  .dialog-body {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .required {
    color: #ef4444;
  }

  .form-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 6px 0 0;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
    transition: border-color 0.15s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .form-input::placeholder {
    color: var(--text-faint);
  }

  /* 标签输入 */
  .tags-container {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 10px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--text-on-accent);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .tag-remove:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
  }

  .tag-input-wrapper {
    position: relative;
  }

  .tag-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.85rem;
  }

  .tag-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .tag-input::placeholder {
    color: var(--text-faint);
  }

  .tag-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }

  .suggestion-item {
    padding: 8px 12px;
    font-size: 0.85rem;
    color: var(--text-normal);
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .suggestion-item:hover {
    background: var(--background-secondary);
  }

  /* 匹配源配置 */
  .match-source-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-normal);
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }

  .custom-props-container {
    margin-top: 8px;
    padding: 10px;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .prop-chip {
    background: var(--text-accent) !important;
  }

  /* 优先级输入 */
  .priority-input {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .priority-slider {
    flex: 1;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--background-modifier-border);
    border-radius: 3px;
    cursor: pointer;
  }

  .priority-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    border-radius: 50%;
    cursor: pointer;
  }

  .priority-value {
    min-width: 40px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    text-align: right;
  }

  /* 算法说明 */
  .algorithm-note {
    margin-top: 16px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .note-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .note-content {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* 底部按钮 */
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .btn {
    padding: 8px 18px;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .btn.secondary:hover {
    background: var(--background-modifier-hover);
  }

  .btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn.primary:hover {
    background: var(--interactive-accent-hover);
  }
</style>
