<script lang="ts">
  import { Notice } from 'obsidian';
  import type { RegexParsingConfig } from '../../../types/newCardParsingTypes';
  import { REGEX_PRESETS } from '../../../services/batch-parsing/RegexPresets';
  import RangeSeparatorConfig from './RangeSeparatorConfig.svelte';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';
  import ObsidianDropdown from '../../ui/ObsidianDropdown.svelte';
  
  // Props
  interface Props {
    presets: RegexParsingConfig[];
    onPresetsChange: (presets: RegexParsingConfig[]) => void;
  }
  
  let { presets = [], onPresetsChange }: Props = $props();
  
  // 🆕 编辑状态
  let editingPreset: RegexParsingConfig | null = $state(null);
  let isCreating = $state(false);
  let editingOriginalId: string | null = $state(null);
  let editingOriginalName: string | null = $state(null);
  
  //  默认值常量
  const DEFAULT_SEPARATOR_MODE = {
    cardSeparator: '<->',  //  修改默认值从 %%<->%% 改为 <->
    frontBackSeparator: '---div---',
    multiline: true,
    emptyLineSeparator: {
      enabled: false,
      lineCount: 2
    }
  };
  
  // 🆕 简化后的默认正则模式配置（一步到位）
  const DEFAULT_PATTERN_MODE = {
    cardPattern: '',
    flags: 'gs',
    captureGroups: {
      front: 1,
      back: 2
    }
  };
  
  //  安全的派生状态：确保模式配置始终存在
  const safePatternMode = $derived.by(() => {
    if (editingPreset?.mode === 'pattern') {
      return editingPreset.patternMode || DEFAULT_PATTERN_MODE;
    }
    return DEFAULT_PATTERN_MODE;
  });
  
  const safeSeparatorMode = $derived.by(() => {
    if (editingPreset?.mode === 'separator') {
      return editingPreset.separatorMode || DEFAULT_SEPARATOR_MODE;
    }
    return DEFAULT_SEPARATOR_MODE;
  });
  
  /**
   * 生成新预设ID
   */
  function generatePresetId(): string {
    return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   *  工具函数：创建新的预设对象
   */
  function createNewPreset(): RegexParsingConfig {
    return {
      name: '新预设',
      description: '',
      mode: 'separator',
      separatorMode: { ...DEFAULT_SEPARATOR_MODE },
      uuidLocation: 'inline',
      uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
      excludeTags: [],
      autoAddUUID: true,
      syncMethod: 'tag-based'
    };
  }
  
  /**
   *  工具函数：确保 separatorMode 完整初始化
   */
  function ensureSeparatorMode(preset: RegexParsingConfig): void {
    if (!preset.separatorMode) {
      preset.separatorMode = { ...DEFAULT_SEPARATOR_MODE };
    } else {
      preset.separatorMode = {
        ...DEFAULT_SEPARATOR_MODE,
        ...preset.separatorMode,
        emptyLineSeparator: preset.separatorMode.emptyLineSeparator || DEFAULT_SEPARATOR_MODE.emptyLineSeparator
      };
    }
  }
  
  /**
   *  工具函数：确保 patternMode 完整初始化（简化版）
   */
  function ensurePatternMode(preset: RegexParsingConfig): void {
    if (!preset.patternMode) {
      preset.patternMode = { ...DEFAULT_PATTERN_MODE };
    } else {
      preset.patternMode = {
        ...DEFAULT_PATTERN_MODE,
        ...preset.patternMode,
        captureGroups: preset.patternMode.captureGroups || DEFAULT_PATTERN_MODE.captureGroups
      };
    }
  }
  
  /**
   * 添加新预设
   */
  function addPreset() {
    editingPreset = createNewPreset();
    isCreating = true;
    editingOriginalId = null;
    editingOriginalName = null;
  }
  
  /**
   * 编辑预设
   */
  function editPreset(preset: RegexParsingConfig) {
    editingOriginalId = preset.id ?? null;
    editingOriginalName = preset.name;
    editingPreset = { 
      ...preset,
      //  强制设置默认值
      uuidLocation: 'inline',
      uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
      autoAddUUID: preset.autoAddUUID !== undefined ? preset.autoAddUUID : true,
      excludeTags: preset.excludeTags || []
    };
    
    //  使用工具函数确保模式配置完整
    if (editingPreset.mode === 'separator') {
      ensureSeparatorMode(editingPreset);
    } else if (editingPreset.mode === 'pattern') {
      ensurePatternMode(editingPreset);
    }
    
    isCreating = false;
  }
  
  /**
   * 保存预设
   */
  function savePreset() {
    if (!editingPreset) return;
    
    if (!editingPreset.name || !editingPreset.name.trim()) {
      new Notice('预设名称不能为空');
      return;
    }

    const trimmedName = editingPreset.name.trim();
    const normalizedName = trimmedName.toLowerCase();
    const duplicateByName = presets.some(p => {
      if (isCreating) {
        return p.name?.trim().toLowerCase() === normalizedName;
      }
      if (editingOriginalId && p.id) {
        return p.id !== editingOriginalId && p.name?.trim().toLowerCase() === normalizedName;
      }
      if (editingOriginalName) {
        return p.name !== editingOriginalName && p.name?.trim().toLowerCase() === normalizedName;
      }
      return p.name?.trim().toLowerCase() === normalizedName;
    });

    if (duplicateByName) {
      new Notice('预设名称已存在');
      return;
    }
    
    //  强制设置默认值
    const presetToSave: RegexParsingConfig = {
      ...editingPreset,
      name: trimmedName,
      uuidLocation: 'inline',
      uuidPattern: '<!-- (tk-[a-z0-9]{12}) -->',
      autoAddUUID: editingPreset.autoAddUUID !== undefined ? editingPreset.autoAddUUID : true,
      excludeTags: editingPreset.excludeTags || [],
      //  确保 separatorMode 的默认值
      separatorMode: editingPreset.separatorMode ? {
        ...editingPreset.separatorMode,
        multiline: editingPreset.separatorMode.multiline !== undefined ? editingPreset.separatorMode.multiline : true
      } : undefined
    };

    if (presetToSave.mode === 'separator') {
      if (!presetToSave.separatorMode?.cardSeparator?.trim()) {
        new Notice('卡片分隔符不能为空');
        return;
      }
      try {
        const flags = presetToSave.separatorMode.multiline ? 'gm' : 'g';
        new RegExp(presetToSave.separatorMode.cardSeparator, flags);
        if (presetToSave.separatorMode.frontBackSeparator) {
          new RegExp(presetToSave.separatorMode.frontBackSeparator, 'm');
        }
      } catch (e) {
        new Notice(`分隔符正则无效: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    if (presetToSave.mode === 'pattern') {
      if (!presetToSave.patternMode?.cardPattern?.trim()) {
        new Notice('卡片匹配正则不能为空');
        return;
      }
      try {
        new RegExp(presetToSave.patternMode.cardPattern, presetToSave.patternMode.flags || 'g');
      } catch (e) {
        new Notice(`卡片匹配正则无效: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
    
    if (isCreating) {
      // 新建预设
      const id = presetToSave.id || generatePresetId();
      const newPreset = { ...presetToSave, id };
      onPresetsChange([...presets, newPreset]);
      new Notice('预设已创建');
    } else {
      // 更新现有预设
      const id = editingOriginalId || presetToSave.id || generatePresetId();
      const presetWithId = { ...presetToSave, id };

      const updated = presets.map(p => {
        if (editingOriginalId) {
          return p.id === editingOriginalId ? presetWithId : p;
        }
        if (editingOriginalName) {
          return p.name === editingOriginalName ? presetWithId : p;
        }
        return p.name === presetWithId.name ? presetWithId : p;
      });
      onPresetsChange(updated);
      new Notice('预设已保存');
    }
    
    editingPreset = null;
    isCreating = false;
    editingOriginalId = null;
    editingOriginalName = null;
  }
  
  /**
   * 删除预设
   */
  async function deletePreset(preset: RegexParsingConfig) {
    const confirmed = await showObsidianConfirm(
      (window as any).app,
      `确定要删除预设 "${preset.name}" 吗？`,
      { title: '确认删除' }
    );
    if (confirmed) {
      if (preset.id) {
        onPresetsChange(presets.filter(p => p.id !== preset.id));
      } else {
        onPresetsChange(presets.filter(p => p.name !== preset.name));
      }
      new Notice('预设已删除');
    }
  }
  
  /**
   * 取消编辑
   */
  function cancelEdit() {
    editingPreset = null;
    isCreating = false;
    editingOriginalId = null;
    editingOriginalName = null;
  }
  
  /**
   * 从官方预设导入
   */
  function importFromOfficial(presetKey: string) {
    const officialPresetMeta = REGEX_PRESETS[presetKey as keyof typeof REGEX_PRESETS];
    if (!officialPresetMeta) return;
    
    //  获取实际的配置对象
    const officialPresetId = `official-${officialPresetMeta.id}`;
    const officialPreset: RegexParsingConfig = {
      ...officialPresetMeta.config,
      id: officialPresetMeta.config.id || officialPresetId,
      excludeTags: officialPresetMeta.config.excludeTags || []
    };
    
    // 检查是否已存在同名预设
    if (presets.some(p => (p.id && p.id === officialPreset.id) || p.name === officialPreset.name)) {
      new Notice(`预设 "${officialPreset.name}" 已存在`);
      return;
    }
    
    onPresetsChange([...presets, officialPreset]);
    new Notice(`已导入预设 "${officialPreset.name}"`);
  }
</script>

<div class="regex-preset-manager">
  <!-- 标题栏 -->
  <div class="preset-header">
    <div class="preset-header-left">
      <h4 class="group-title with-accent-bar accent-red">正则预设管理</h4>
      <span class="preset-count">({presets.length})</span>
    </div>
    <div class="preset-header-right">
      <button 
        class="add-preset-btn"
        onclick={addPreset}
      >
        + 新建预设
      </button>
    </div>
  </div>
  
  <!-- 🆕 内容（始终显示） -->
  <div class="preset-content">
    <!-- 官方预设导入 -->
    <div class="official-presets">
      <div class="section-label">官方预设（快速导入）</div>
      <div class="preset-chips">
        {#each Object.keys(REGEX_PRESETS) as key}
          {@const preset = REGEX_PRESETS[key as keyof typeof REGEX_PRESETS]}
          <button 
            class="preset-chip"
            onclick={() => importFromOfficial(key)}
            title={preset.description}
          >
            {preset.name}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- 自定义预设列表 -->
    <div class="custom-presets">
      <div class="section-label">自定义预设</div>
      
      {#if presets.length > 0}
        <div class="preset-list">
          {#each presets as preset}
            <div class="preset-item">
              <div class="preset-info">
                <div class="preset-name">{preset.name}</div>
                <div class="preset-meta">
                  模式: {preset.mode === 'separator' ? '分隔符' : '完整正则'} | 
                  同步: {preset.syncMethod === 'tag-based' ? '标签判断' : '完全同步'}
                </div>
              </div>
              <div class="preset-actions">
                <button 
                  class="action-btn edit"
                  onclick={() => editPreset(preset)}
                >
                  编辑
                </button>
                <button 
                  class="action-btn delete"
                  onclick={() => deletePreset(preset)}
                >
                  删除
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- 编辑器模态窗 -->
    {#if editingPreset}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div 
        class="preset-editor-overlay" 
        onclick={cancelEdit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-editor-title"
        tabindex="-1"
      >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div 
          class="preset-editor" 
          onclick={(e) => { e.stopPropagation(); }}
          role="document"
        >
          <div class="editor-header">
            <h3 id="preset-editor-title">{isCreating ? '新建正则预设' : '编辑正则预设'}</h3>
            <button class="close-btn" onclick={cancelEdit} aria-label="关闭">×</button>
          </div>
          
          <div class="editor-body">
            <!-- 基本信息 -->
            <div class="form-group">
              <label for="preset-name">预设名称</label>
              <input 
                type="text" 
                id="preset-name"
                value={editingPreset?.name || ''}
                oninput={(e) => {
                  if (editingPreset) {
                    editingPreset.name = e.currentTarget.value;
                  }
                }}
                placeholder="例如：默认Weave格式"
              />
            </div>
            
            <!-- 解析模式 -->
            <div class="form-group">
              <label for="parsing-mode">解析模式</label>
              <ObsidianDropdown
                options={[
                  { id: 'separator', label: '分隔符模式（简单）' },
                  { id: 'pattern', label: '完整正则模式（灵活）' }
                ]}
                value={editingPreset?.mode || 'separator'}
                onchange={(value) => {
                  const newMode = value as 'separator' | 'pattern';
                  if (!editingPreset) return;
                  editingPreset.mode = newMode;
                  if (newMode === 'pattern' && !editingPreset.patternMode) {
                    editingPreset.patternMode = { ...DEFAULT_PATTERN_MODE };
                  } else if (newMode === 'separator' && !editingPreset.separatorMode) {
                    editingPreset.separatorMode = { ...DEFAULT_SEPARATOR_MODE };
                  }
                }}
              />
            </div>
            
            <!-- 分隔符模式配置 -->
            {#if editingPreset?.mode === 'separator'}
              <RangeSeparatorConfig 
                config={safeSeparatorMode}
                name="separator-type"
                onChange={() => {
                  if (!editingPreset?.separatorMode) {
                    editingPreset!.separatorMode = { ...DEFAULT_SEPARATOR_MODE };
                  }
                }}
              />
            {/if}
            
            <!-- 🆕 正则模式配置（简化版 - 一步到位） -->
            {#if editingPreset?.mode === 'pattern'}
              <!-- 卡片匹配正则表达式 -->
              <div class="form-group">
                <label for="card-pattern">卡片匹配正则表达式</label>
                <textarea 
                  id="card-pattern"
                  value={safePatternMode.cardPattern}
                  oninput={(e) => {
                    if (!editingPreset?.patternMode) editingPreset!.patternMode = { ...DEFAULT_PATTERN_MODE };
                    editingPreset!.patternMode.cardPattern = e.currentTarget.value;
                  }}
                  placeholder="例如：Q:\s*(.+?)\s*A:\s*(.+?)"
                  rows="3"
                ></textarea>
                <small class="help-text">直接在全文中匹配所有卡片，通过捕获组（括号）提取问题和答案</small>
              </div>
              
              <!-- 正则标志 -->
              <div class="form-group">
                <label for="regex-flags">正则标志</label>
                <input 
                  type="text" 
                  id="regex-flags"
                  value={safePatternMode.flags}
                  oninput={(e) => {
                    if (!editingPreset?.patternMode) editingPreset!.patternMode = { ...DEFAULT_PATTERN_MODE };
                    editingPreset!.patternMode.flags = e.currentTarget.value;
                  }}
                  placeholder="例如：gs"
                />
                <small class="help-text">g=全局匹配，s=允许.匹配换行，i=忽略大小写，m=多行模式</small>
              </div>
            {/if}
            
            <!-- 同步方法 -->
            <div class="form-group">
              <label for="sync-method">同步方法</label>
              <ObsidianDropdown
                options={[
                  { id: 'tag-based', label: '标签判断模式' },
                  { id: 'full-sync', label: '完全同步模式' }
                ]}
                value={editingPreset?.syncMethod || 'tag-based'}
                onchange={(value) => {
                  if (editingPreset) {
                    editingPreset.syncMethod = value as 'tag-based' | 'full-sync';
                  }
                }}
              />
            </div>
          </div>
          
          <div class="editor-footer">
            <button class="btn-cancel" onclick={cancelEdit}>取消</button>
            <button class="btn-save" onclick={savePreset}>保存</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* 标题栏 */
  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0 12px 0;
    background: transparent;
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 16px;
  }
  
  .preset-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .preset-count {
    color: var(--text-muted);
    font-size: 12px;
  }
  
  .preset-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .add-preset-btn {
    padding: 4px 12px;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-size: 12px;
    transition: opacity 0.2s;
  }
  
  .add-preset-btn:hover {
    opacity: 0.8;
  }
  
  /* 展开内容 */
  .preset-content {
    padding: 0;
    background: transparent;
  }
  
  /* 官方预设 */
  .official-presets {
    margin-bottom: 20px;
  }
  
  .section-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  
  .preset-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .preset-chip {
    padding: 6px 12px;
    border-radius: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  /*  深色模式 - 增强预设芯片边框可见性 */
  :global(body.theme-dark) .preset-chip {
    border-color: rgba(255, 255, 255, 0.15);
  }

  /*  浅色模式 - 增强预设芯片边框可见性 */
  :global(body.theme-light) .preset-chip {
    border-color: rgba(0, 0, 0, 0.15);
  }
  
  .preset-chip:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  /* 自定义预设列表 */
  .custom-presets {
    margin-top: 20px;
  }
  
  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .preset-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
  }

  /*  深色模式 - 增强预设项边框可见性 */
  :global(body.theme-dark) .preset-item {
    border-color: rgba(255, 255, 255, 0.15);
  }

  /*  浅色模式 - 增强预设项边框可见性 */
  :global(body.theme-light) .preset-item {
    border-color: rgba(0, 0, 0, 0.15);
  }
  
  .preset-info {
    flex: 1;
  }
  
  .preset-name {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
  }
  
  .preset-meta {
    font-size: 11px;
    color: var(--text-faint);
  }
  
  .preset-actions {
    display: flex;
    gap: 8px;
  }
  
  .action-btn {
    padding: 4px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    transition: opacity 0.2s;
  }
  
  .action-btn.edit {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .action-btn.delete {
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
  }
  
  .action-btn:hover {
    opacity: 0.8;
  }
  
  /* 编辑器模态窗 */
  .preset-editor-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  
  .preset-editor {
    background: var(--background-primary);
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .editor-header h3 {
    margin: 0;
    font-size: 16px;
  }
  
  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    color: var(--text-muted);
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text-normal);
  }
  
  .form-group input[type="text"],
  .form-group textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    transition: border-color 0.2s;
  }

  /*  深色模式 - 增强表单输入框边框可见性 */
  :global(body.theme-dark) .form-group input[type="text"],
  :global(body.theme-dark) .form-group textarea {
    border-color: rgba(255, 255, 255, 0.3);
  }

  /*  浅色模式 - 增强表单输入框边框可见性 */
  :global(body.theme-light) .form-group input[type="text"],
  :global(body.theme-light) .form-group textarea {
    border-color: rgba(0, 0, 0, 0.25);
  }

  .form-group textarea {
    font-family: var(--font-monospace);
    min-height: 80px;
    resize: vertical;
    line-height: 1.6;
  }
  
  .form-group .help-text {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.4;
  }
  
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  .btn-cancel,
  .btn-save {
    padding: 8px 20px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    transition: opacity 0.2s;
  }
  
  .btn-cancel {
    background: var(--background-secondary);
    color: var(--text-normal);
  }
  
  .btn-save {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .btn-cancel:hover,
  .btn-save:hover {
    opacity: 0.8;
  }
</style>

