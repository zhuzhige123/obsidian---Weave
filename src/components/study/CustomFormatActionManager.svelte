<script lang="ts">
  import type { CustomFormatAction, AIProvider } from '../../types/ai-types';
  import { TEMPLATE_VARIABLES } from '../../types/ai-types';
  import EnhancedButton from '../ui/EnhancedButton.svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import ObsidianDropdown from '../ui/ObsidianDropdown.svelte';
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  import type { App } from 'obsidian';
  
  interface Props {
    show: boolean;
    actions: CustomFormatAction[];
    app: App;  //  添加 app 实例用于 Obsidian Modal
    onSave: (actions: CustomFormatAction[]) => void;
    onClose: () => void;
  }
  
  let { show, actions, app, onSave, onClose }: Props = $props();
  
  let editingActions = $state<CustomFormatAction[]>([]);
  let selectedActionId = $state<string | null>(null);
  let showVariableHelp = $state(false);
  
  // 初始化编辑列表
  $effect(() => {
    if (show) {
      editingActions = JSON.parse(JSON.stringify(actions));
    }
  });
  
  const selectedAction = $derived(
    editingActions.find(a => a.id === selectedActionId) || null
  );
  
  function createNewAction() {
    const newAction: CustomFormatAction = {
      id: `custom-${Date.now()}`,
      name: '新功能',
      icon: '✨',
      systemPrompt: '你是一个专业的AI助手。',
      userPromptTemplate: '请处理以下内容:\n\n{{cardContent}}',
      category: 'custom',
      createdAt: new Date().toISOString(),
      enabled: true
    };
    editingActions = [...editingActions, newAction];
    selectedActionId = newAction.id;
  }
  
  function deleteAction(id: string) {
    //  使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    showObsidianConfirm(
      app,
      '确定要删除这个功能吗？',
      { title: '确认删除', confirmText: '删除' }
    ).then(confirmed => {
      if (confirmed) {
        editingActions = editingActions.filter(a => a.id !== id);
        if (selectedActionId === id) {
          selectedActionId = null;
        }
      }
    });
  }
  
  function saveChanges() {
    onSave(editingActions);
    onClose();
  }
  
  // 图标选择器（简化版）
  const ICON_OPTIONS = ['✨', '🔧', '📝', '🌐', '🧠', '💡', '🎯', '📊', '🔍', '⚙️', '∑', '🎨', '📐', '🔮'];
</script>

{#if show}
  <div 
    class="modal-overlay" 
    onclick={onClose} 
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="presentation"
    tabindex="-1"
  >
    <div class="manager-modal" onclick={(e) => { e.stopPropagation(); }} role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <h3>管理AI格式化功能</h3>
        <button class="close-btn" onclick={onClose} aria-label="关闭">×</button>
      </div>
      
      <div class="modal-body">
        <div class="manager-layout">
          <!-- 左侧：功能列表 -->
          <div class="actions-list">
            <div class="list-header">
              <span>功能列表 ({editingActions.length})</span>
              <button class="add-btn" onclick={createNewAction} title="创建新功能">
                <EnhancedIcon name="plus" size="14" />
              </button>
            </div>
            
            <div class="list-content">
              {#each editingActions as action}
                <div 
                  class="action-item"
                  class:selected={selectedActionId === action.id}
                  onclick={() => selectedActionId = action.id}
                  onkeydown={(e) => e.key === 'Enter' && (selectedActionId = action.id)}
                  role="button"
                  tabindex="0"
                >
                  <span class="action-icon">{action.icon}</span>
                  <span class="action-name">{action.name}</span>
                  {#if action.category === 'official'}
                    <span class="official-badge">官方</span>
                  {/if}
                  {#if action.category === 'custom'}
                    <button 
                      class="delete-btn"
                      onclick={(e) => {
            e.preventDefault();
            deleteAction(action.id);
          }}
                      title="删除功能"
                    >
                      <EnhancedIcon name="trash" size="12" />
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
          
          <!-- 右侧：编辑面板 -->
          <div class="edit-panel">
            {#if selectedAction}
              <div class="edit-form">
                <div class="form-group">
                  <label for="action-name">功能名称</label>
                  <input 
                    id="action-name"
                    type="text"
                    bind:value={selectedAction.name}
                    placeholder="例如：数学公式转换"
                  />
                </div>
                
                <div class="form-group">
                  <label for="action-icon">图标</label>
                  <div class="icon-selector">
                    {#each ICON_OPTIONS as icon}
                      <button
                        class="icon-option"
                        class:selected={selectedAction.icon === icon}
                        onclick={() => selectedAction.icon = icon}
                        title="选择图标"
                      >
                        {icon}
                      </button>
                    {/each}
                  </div>
                </div>
                
                <div class="form-group">
                  <label>AI提供商 (可选)</label>
                  <ObsidianDropdown
                    options={[
                      { id: '', label: '使用默认提供商' },
                      { id: 'openai', label: 'OpenAI' },
                      { id: 'gemini', label: 'Gemini' },
                      { id: 'anthropic', label: 'Anthropic' },
                      { id: 'deepseek', label: 'DeepSeek' },
                      { id: 'zhipu', label: '智谱AI' },
                      { id: 'siliconflow', label: '硅基流动' }
                    ]}
                    value={selectedAction.provider || ''}
                    onchange={(value) => {
                      selectedAction.provider = (value || undefined) as any;
                    }}
                  />
                </div>
                
                <div class="form-group">
                  <label>
                    系统提示词
                    <button 
                      class="help-btn"
                      onclick={() => showVariableHelp = !showVariableHelp}
                      title="显示/隐藏可用变量"
                    >
                      <EnhancedIcon name="help" size="12" />
                    </button>
                  </label>
                  <textarea
                    bind:value={selectedAction.systemPrompt}
                    placeholder="定义AI的角色和行为..."
                    rows="4"
                  ></textarea>
                </div>
                
                <div class="form-group">
                  <label>用户提示词模板</label>
                  <textarea
                    bind:value={selectedAction.userPromptTemplate}
                    placeholder="使用 {'{{'} 变量名 {'}'} 来插入动态内容..."
                    rows="6"
                  ></textarea>
                </div>
                
                {#if showVariableHelp}
                  <div class="variable-help">
                    <div class="help-header">可用变量</div>
                    {#each Object.entries(TEMPLATE_VARIABLES) as [variable, description]}
                      <div class="variable-item">
                        <code>{variable}</code>
                        <span>{description}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <EnhancedButton variant="secondary" onclick={onClose}>
          取消
        </EnhancedButton>
        <EnhancedButton variant="primary" onclick={saveChanges}>
          保存更改
        </EnhancedButton>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100; /* 🔧 标准Modal层级，高于学习界面(100) */
    backdrop-filter: blur(4px);
  }
  
  .manager-modal {
    background: var(--background-primary);
    border-radius: 12px;
    width: 90vw;
    max-width: 1200px;
    height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--background-modifier-border);
  }
  
  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--background-secondary);
    border-radius: 12px 12px 0 0;
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .modal-body {
    flex: 1;
    overflow: hidden;
    padding: 0;
  }
  
  .manager-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 0;
    height: 100%;
  }
  
  .actions-list {
    border-right: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .list-header {
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--background-modifier-border);
    font-weight: 500;
    font-size: 0.875rem;
    background: var(--background-secondary);
  }
  
  .add-btn {
    background: var(--interactive-accent);
    border: none;
    color: var(--text-on-accent);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    transition: all 0.2s ease;
  }
  
  .add-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .list-content {
    flex: 1;
    overflow-y: auto;
  }
  
  .action-item {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
    border-left: 3px solid transparent;
  }
  
  .action-item:hover {
    background: var(--background-modifier-hover);
  }
  
  .action-item.selected {
    background: var(--background-modifier-active-hover);
    border-left-color: var(--interactive-accent);
  }
  
  .action-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  
  .action-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-normal);
  }
  
  .official-badge {
    padding: 0.125rem 0.375rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 600;
  }
  
  .delete-btn {
    background: none;
    border: none;
    color: var(--text-error);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .delete-btn:hover {
    background: color-mix(in srgb, var(--text-error) 10%, transparent);
  }
  
  .edit-panel {
    padding: 1.5rem;
    overflow-y: auto;
  }
  
  .edit-form {
    max-width: 600px;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-normal);
  }
  
  .help-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.125rem;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .help-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-accent);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    font-family: var(--font-text);
    transition: border-color 0.2s ease;
  }

  :global(.form-group .obsidian-dropdown-trigger) {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    font-family: var(--font-text);
    min-height: 0;
  }
  
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  :global(.form-group .obsidian-dropdown-trigger:focus-visible) {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: none;
  }
  
  .form-group textarea {
    font-family: var(--font-monospace);
    resize: vertical;
    line-height: 1.5;
  }
  
  .icon-selector {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 0.5rem;
  }
  
  .icon-option {
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    cursor: pointer;
    font-size: 1.25rem;
    transition: all 0.2s ease;
  }
  
  .icon-option:hover {
    border-color: var(--interactive-accent);
    transform: scale(1.1);
  }
  
  .icon-option.selected {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-primary));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 20%, transparent);
  }
  
  .variable-help {
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
    margin-top: 1rem;
    border: 1px solid var(--background-modifier-border);
  }
  
  .help-header {
    font-weight: 600;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    color: var(--text-normal);
  }
  
  .variable-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .variable-item:last-child {
    border-bottom: none;
  }
  
  .variable-item code {
    color: var(--text-accent);
    font-family: var(--font-monospace);
    background: var(--code-background);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  
  .variable-item span {
    color: var(--text-muted);
  }
  
  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    background: var(--background-secondary);
    border-radius: 0 0 12px 12px;
  }
  
  @media (max-width: 1024px) {
    .manager-layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    
    .actions-list {
      border-right: none;
      border-bottom: 1px solid var(--background-modifier-border);
      max-height: 200px;
    }
  }
</style>

