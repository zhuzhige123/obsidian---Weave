<script lang="ts">
  import { logger } from '../../utils/logger';
  //  导入AI配置Store（Obsidian即时保存模式：直接操作Store）
  import { aiConfigStore, allFormatActions, allSplitActions } from '../../stores/ai-config.store';
  import type { AIAction, AIActionType, AIProvider } from '../../types/ai-types';
  import { TEMPLATE_VARIABLES } from '../../types/ai-types';
  import type { Deck } from '../../data/types';
  import type { WeavePlugin } from '../../main';
  import { AI_PROVIDER_LABELS, AI_MODEL_OPTIONS } from '../settings/constants/settings-constants';
  import ActionTypeTabBar from './ActionTypeTabBar.svelte';
  import EnhancedButton from '../ui/EnhancedButton.svelte';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import EnhancedModal from '../ui/EnhancedModal.svelte';
  import ObsidianDropdown from '../ui/ObsidianDropdown.svelte';
  import { OFFICIAL_FORMAT_ACTIONS } from '../../constants/official-format-actions';
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  import { Notice } from 'obsidian';
  
  interface Props {
    show: boolean;
    availableDecks: Deck[];
    plugin: WeavePlugin;
    onClose: () => void;
  }
  
  let { show, availableDecks, plugin, onClose }: Props = $props();
  
  // 状态管理
  let activeType = $state<AIActionType>('format');
  let selectedActionId = $state<string | null>(null);
  let showVariableHelp = $state(false);
  
  //  直接使用Store的数据（Obsidian模式：单一数据源）
  const currentFormatActions = $derived($allFormatActions);
  const currentSplitActions = $derived($allSplitActions);
  
  //  重置选中状态（切换标签页或打开模态窗时）
  $effect(() => {
    if (show) {
      selectedActionId = null;
      showVariableHelp = false;
    }
  });
  
  // 当前显示的功能列表
  const currentActions = $derived(
    activeType === 'format' ? currentFormatActions : currentSplitActions
  );
  
  // 选中的功能
  const selectedAction = $derived(
    currentActions.find(a => a.id === selectedActionId) || null
  );
  
  // 可用的模板变量
  const availableVariables = $derived(TEMPLATE_VARIABLES);
  
  // AI服务商列表
  const providers: AIProvider[] = ['openai', 'gemini', 'anthropic', 'deepseek', 'zhipu', 'siliconflow', 'xai'];
  
  // 获取默认服务商和模型
  const defaultProvider = $derived(
    plugin.settings.aiConfig?.defaultProvider || 'openai'
  );
  
  // 获取当前选中功能的可用模型列表
  const availableModels = $derived.by(() => {
    if (!selectedAction?.provider) return [];
    return AI_MODEL_OPTIONS[selectedAction.provider] || [];
  });
  
  // 获取当前选中功能的默认模型
  const defaultModel = $derived.by(() => {
    if (!selectedAction?.provider) return '';
    const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[selectedAction.provider];
    return providerConfig?.model || (AI_MODEL_OPTIONS[selectedAction.provider]?.[0]?.id || '');
  });
  
  //  自动初始化model字段：当action.model为空时自动设置为defaultModel
  $effect(() => {
    if (selectedAction && !selectedAction.model) {
      const computedDefaultModel = defaultModel;
      if (computedDefaultModel && selectedAction.category === 'custom') {
        // 只为自定义action自动初始化model
        logger.debug('[AIActionManager] 自动初始化model字段:', {
          actionId: selectedAction.id,
          provider: selectedAction.provider,
          model: computedDefaultModel
        });
        updateSelectedAction({ model: computedDefaultModel });
      }
    }
  });
  
  function handleTypeChange(type: AIActionType) {
    activeType = type;
    selectedActionId = null;
  }
  
  function createNewAction() {
    const defaultProvider = plugin.settings.aiConfig?.defaultProvider || 'zhipu';
    
    //  获取该provider的默认model
    const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[defaultProvider];
    const defaultModelForProvider = providerConfig?.model || (AI_MODEL_OPTIONS[defaultProvider]?.[0]?.id || '');
    
    const actionTypeName = activeType === 'format' ? '格式化' : 'AI拆分';
    
    const newAction: AIAction = {
      id: `custom-${activeType}-${Date.now()}`,
      name: activeType === 'format' ? '新格式化功能' : '新AI拆分功能',
      icon: 'sparkles',
      type: activeType,
      systemPrompt: '你是一个专业的AI助手。',
      userPromptTemplate: '请处理以下内容:\n\n{{cardContent}}',
      provider: defaultProvider,
      model: defaultModelForProvider, //  初始化model字段
      category: 'custom',
      createdAt: new Date().toISOString(),
      enabled: true
    };
    
    if (activeType === 'split') {
      newAction.splitConfig = {
        targetCount: 3,
        splitStrategy: 'knowledge-point',
        outputFormat: 'qa'
      };
    }
    
    //  Obsidian模式：直接更新Store并立即保存
    const currentCustomActions = currentActions.filter(a => a.category === 'custom');
    const updatedActions = [...currentCustomActions, newAction];
    
    if (activeType === 'format') {
      aiConfigStore.updateFormatActions(updatedActions);
    } else {
      aiConfigStore.updateSplitActions(updatedActions);
    }
    
    selectedActionId = newAction.id;
    new Notice(`已创建新的${actionTypeName}功能`);
  }
  
  function deleteAction(id: string) {
    const actionName = currentActions.find(a => a.id === id)?.name || '此功能';
    
    //  使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    showObsidianConfirm(
      plugin.app,
      `确定要删除"${actionName}"吗？`,
      { title: '确认删除', confirmText: '删除' }
    ).then(confirmed => {
      if (confirmed) {
        //  Obsidian模式：直接更新Store并立即保存
        const customActions = currentActions.filter(a => a.category === 'custom');
        const updatedActions = customActions.filter(a => a.id !== id);
        
        if (activeType === 'format') {
          aiConfigStore.updateFormatActions(updatedActions);
        } else {
          aiConfigStore.updateSplitActions(updatedActions);
        }
        
        if (selectedActionId === id) {
          selectedActionId = null;
        }
        
        new Notice(`已删除"${actionName}"`);
      }
    });
  }
  
  function updateSelectedAction(partial: Partial<AIAction>) {
    if (!selectedAction) return;
    
    const updated = { 
      ...selectedAction, 
      ...partial, 
      updatedAt: new Date().toISOString() 
    };
    
    //  Obsidian模式：直接更新Store并立即保存
    const customActions = currentActions.filter(a => a.category === 'custom');
    const index = customActions.findIndex(a => a.id === selectedAction.id);
    
    if (index >= 0) {
      customActions[index] = updated;
      
      if (activeType === 'format') {
        aiConfigStore.updateFormatActions(customActions);
      } else {
        aiConfigStore.updateSplitActions(customActions);
      }
    }
  }
  
  //  复制官方模板为自定义功能
  function duplicateAsCustom() {
    if (!selectedAction || selectedAction.category !== 'official') return;
    
    const defaultProvider = plugin.settings.aiConfig?.defaultProvider || 'zhipu';
    const effectiveProvider = selectedAction.provider || defaultProvider;
    
    //  获取该provider的默认model
    const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[effectiveProvider];
    const defaultModelForProvider = providerConfig?.model || (AI_MODEL_OPTIONS[effectiveProvider]?.[0]?.id || '');
    
    const newAction: AIAction = {
      ...selectedAction,
      id: `custom-${activeType}-${Date.now()}`,
      name: `${selectedAction.name} (副本)`,
      category: 'custom',
      provider: effectiveProvider,
      model: selectedAction.model || defaultModelForProvider, //  初始化model字段
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    //  Obsidian模式：直接更新Store并立即保存
    const customActions = currentActions.filter(a => a.category === 'custom');
    const updatedActions = [...customActions, newAction];
    
    if (activeType === 'format') {
      aiConfigStore.updateFormatActions(updatedActions);
    } else {
      aiConfigStore.updateSplitActions(updatedActions);
    }
    
    selectedActionId = newAction.id;
    new Notice(`已复制"${selectedAction.name}"为自定义功能`);
  }
  
  /**
   * 恢复官方默认模板
   * 将官方模板重新添加到功能列表中
   */
  async function restoreOfficialTemplates() {
    const confirmMessage = `确定要恢复官方默认模板吗？\n\n这将在当前功能列表中添加官方预设的AI功能模板（不会删除您的自定义功能）。`;
    
    //  使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    const confirmed = await showObsidianConfirm(
      plugin.app,
      confirmMessage,
      { title: '恢复官方模板', confirmText: '恢复' }
    );
    if (!confirmed) return;
    
    //  Obsidian模式：直接操作Store
    if (activeType === 'format') {
      const existingIds = new Set(currentActions.map(a => a.id));
      const newOfficialActions = OFFICIAL_FORMAT_ACTIONS.filter(a => !existingIds.has(a.id));
      
      if (newOfficialActions.length > 0) {
        const customActions = currentActions.filter(a => a.category === 'custom');
        aiConfigStore.updateFormatActions(customActions); // Store会自动合并官方模板
        new Notice(`已添加 ${newOfficialActions.length} 个官方格式化模板`);
      } else {
        new Notice('所有官方格式化模板已存在');
      }
    } else {
      new Notice('AI拆分功能暂无官方模板');
    }
  }
</script>

<!-- 🆕 自定义强制背景虚化层 -->
{#if show}
  <div 
    class="ai-config-backdrop" 
    role="button" 
    tabindex="0"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Enter' && onClose()}
  ></div>
{/if}

<EnhancedModal
  open={show}
  onClose={onClose}
  size="xl"
  title="AI功能配置"
  accentColor="purple"
  zIndex={6000}
  mask={false}
>
  <div class="ai-action-manager">
    <!--  顶部：标签页导航 + 操作按钮 -->
    <div class="top-navigation">
      <ActionTypeTabBar
        activeType={activeType}
        formatCount={currentFormatActions.length}
        splitCount={currentSplitActions.length}
        onTypeChange={handleTypeChange}
      />
      
      <!--  右侧操作区 -->
      <div class="top-actions">
        <!--  恢复官方默认模板按钮 -->
        <EnhancedButton
          variant="ghost"
          size="sm"
          icon="refresh-cw"
          onclick={restoreOfficialTemplates}
          ariaLabel="恢复官方默认模板"
        >
          恢复官方模板
        </EnhancedButton>
        
        <!--  即时保存提示 -->
        <div class="save-indicator">
          <span class="status saved">
            <EnhancedIcon name="zap" size="sm" />
            更改即时保存
          </span>
        </div>
      </div>
    </div>
    
    <div class="manager-layout">
      <!-- 左侧：功能列表 -->
      <div class="sidebar">
        <!-- 功能列表 -->
        <div class="actions-list">
          <div class="list-header">
            <span class="list-title">功能列表</span>
            <span class="list-count">{currentActions.length}</span>
          </div>
          
          <div class="list-content">
            {#each currentActions as action}
              <div 
                class="action-item"
                class:selected={selectedActionId === action.id}
                onclick={() => selectedActionId = action.id}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectedActionId = action.id;
                  }
                }}
              >
                <span class="action-name">{action.name}</span>
                {#if action.category === 'official'}
                  <span class="official-badge">官方</span>
                {/if}
                {#if action.category === 'custom'}
                  <EnhancedButton
                    variant="ghost"
                    size="xs"
                    icon="trash"
                    iconOnly
                    onclick={(e) => {
            e.preventDefault();
            deleteAction(action.id);
          }}
                    ariaLabel="删除功能"
                    class="delete-btn"
                  />
                {/if}
              </div>
            {/each}
            
            <!-- 新建功能按钮 - 参考AIConfigModal设计 -->
            <div class="new-action-section">
              <button 
                class="new-action-btn" 
                onclick={createNewAction}
                title="新建自定义功能"
              >
                <EnhancedIcon name="plus" size="16" />
                <span>新建{activeType === 'format' ? '格式化' : activeType === 'test-generator' ? '题库' : '拆分'}功能</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧：配置编辑器 -->
      <div class="config-editor">
        {#if selectedAction}
          <div class="edit-form">
            {#if selectedAction.category === 'official'}
              <div class="official-notice">
                <EnhancedIcon name="info" size="sm" variant="primary" />
                <div class="notice-content">
                  <strong>官方模板说明</strong>
                  <p>官方模板仅作为参考示例，不会显示在AI助手菜单中。请点击"复制为自定义"按钮创建您自己的AI功能。</p>
                </div>
              </div>
            {/if}
            
            <div class="form-section form-section-basic">
              <div class="section-header">
                <h4 class="section-title">基础信息</h4>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="action-name-input">功能名称</label>
                <input 
                  id="action-name-input"
                  type="text"
                  value={selectedAction.name}
                  oninput={(e) => updateSelectedAction({ name: (e.target as HTMLInputElement).value })}
                  placeholder="请输入功能名称"
                  disabled={selectedAction.category === 'official'}
                  class="form-input"
                />
              </div>
              
            </div>
            
            <!-- AI拆分配置（仅拆分类型显示） -->
            {#if selectedAction.type === 'split' && selectedAction.splitConfig}
              <div class="form-section form-section-split">
                <div class="section-header">
                  <h4 class="section-title">拆分配置</h4>
                </div>
                
                <div class="form-row">
                  <label class="form-label" for="split-target-count">目标拆分数量</label>
                  <input
                    id="split-target-count"
                    type="number"
                    class="form-input"
                    min="2"
                    max="8"
                    bind:value={selectedAction.splitConfig.targetCount}
                    onchange={() => updateSelectedAction({ splitConfig: selectedAction.splitConfig })}
                  />
                </div>
                
                <div class="form-row">
                  <label class="form-label" for="split-strategy-select">拆分策略</label>
                  <div class="form-select">
                    <ObsidianDropdown
                      options={[
                        { id: 'knowledge-point', label: '知识点拆分' },
                        { id: 'difficulty', label: '难度层次拆分' },
                        { id: 'content-length', label: '内容长度拆分' }
                      ]}
                      value={selectedAction.splitConfig.splitStrategy}
                      onchange={(value) => {
                        const splitConfig = selectedAction.splitConfig;
                        if (!splitConfig) return;
                        splitConfig.splitStrategy = value as any;
                        updateSelectedAction({ splitConfig });
                      }}
                    />
                  </div>
                </div>
                
                <div class="form-row">
                  <label class="form-label" for="split-output-format-select">输出格式</label>
                  <div class="form-select">
                    <ObsidianDropdown
                      options={[
                        { id: 'qa', label: '问答题' },
                        { id: 'cloze', label: '挖空题' },
                        { id: 'mixed', label: '混合格式' }
                      ]}
                      value={selectedAction.splitConfig.outputFormat}
                      onchange={(value) => {
                        const splitConfig = selectedAction.splitConfig;
                        if (!splitConfig) return;
                        splitConfig.outputFormat = value as any;
                        updateSelectedAction({ splitConfig });
                      }}
                    />
                  </div>
                </div>
              </div>
            {/if}
            
            <div class="form-section form-section-ai">
              <div class="section-header">
                <h4 class="section-title">AI服务配置</h4>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="ai-provider-select">AI服务商</label>
                <div class="form-select">
                  <ObsidianDropdown
                    options={[
                      { id: '', label: '使用默认配置' },
                      ...providers.map((p) => ({ id: p, label: AI_PROVIDER_LABELS[p] }))
                    ]}
                    value={selectedAction.provider || ''}
                    onchange={(value) => {
                      const provider = value as AIProvider | '';
                      if (provider) {
                        const providerConfig = (plugin.settings.aiConfig?.apiKeys as any)?.[provider];
                        const configuredModel = providerConfig?.model;
                        const firstModel = AI_MODEL_OPTIONS[provider]?.[0]?.id;
                        const modelToUse = configuredModel || firstModel;

                        updateSelectedAction({
                          provider: provider as AIProvider,
                          model: modelToUse || undefined
                        });
                      } else {
                        updateSelectedAction({ provider: undefined, model: undefined });
                      }
                    }}
                  />
                </div>
                <div class="form-hint">
                  未选择时将使用插件设置中的默认服务商和模型
                </div>
              </div>
              
              {#if selectedAction.provider}
                <div class="form-group">
                  <label class="form-label" for="ai-model-select">AI模型</label>
                  <div class="form-select">
                    <ObsidianDropdown
                      options={availableModels.map((opt) => ({
                        id: opt.id,
                        label: opt.label,
                        description: opt.description
                      }))}
                      value={selectedAction.model || defaultModel}
                      onchange={(value) => {
                        const model = value;
                        updateSelectedAction({ model: model || undefined });
                      }}
                    />
                  </div>
                  <div class="form-hint">
                    选择该服务商下可用的AI模型
                  </div>
                </div>
              {/if}
            </div>
            
            <!-- AI提示词配置 -->
            <div class="form-section form-section-prompt">
              <div class="section-header">
                <h4 class="section-title">AI提示词配置</h4>
              </div>
              
              <div class="form-group">
                <div class="label-with-help">
                  <label class="form-label" for="system-prompt-textarea">系统提示词</label>
                  <EnhancedButton
                    variant="ghost"
                    size="xs"
                    icon={showVariableHelp ? 'chevron-up' : 'chevron-down'}
                    onclick={() => showVariableHelp = !showVariableHelp}
                    ariaLabel="查看可用变量"
                  >
                    可用变量
                  </EnhancedButton>
                </div>
                <textarea
                  id="system-prompt-textarea"
                  value={selectedAction.systemPrompt}
                  oninput={(e) => updateSelectedAction({ systemPrompt: (e.target as HTMLTextAreaElement).value })}
                  placeholder="定义AI的角色和行为规则..."
                  rows="8"
                  disabled={selectedAction.category === 'official'}
                  class="form-textarea"
                ></textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="user-prompt-textarea">用户提示词模板</label>
                <textarea
                  id="user-prompt-textarea"
                  value={selectedAction.userPromptTemplate}
                  oninput={(e) => updateSelectedAction({ userPromptTemplate: (e.target as HTMLTextAreaElement).value })}
                  placeholder="使用模板变量如 {`{{cardContent}}`}..."
                  rows="6"
                  disabled={selectedAction.category === 'official'}
                  class="form-textarea"
                ></textarea>
              </div>
              
              {#if showVariableHelp && availableVariables}
                <div class="variable-help">
                  <h5 class="variable-help-title">可用的模板变量</h5>
                  <div class="variable-list">
                    {#each Object.entries(availableVariables) as [variable, description]}
                      <div class="variable-item">
                        <code class="variable-code">{variable}</code>
                        <span class="variable-desc">{description}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            
            <!--  底部操作按钮（仅官方模板显示复制按钮） -->
            {#if selectedAction.category === 'official'}
              <div class="form-actions">
                <EnhancedButton 
                  variant="primary" 
                  icon="copy"
                  onclick={duplicateAsCustom}
                >
                  复制为自定义
                </EnhancedButton>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</EnhancedModal>

<style>
  /*  CSS变量定义（确保在非.weave-app容器中也能使用） */
  .ai-action-manager {
    /* 间距系统 */
    --weave-space-xs: 4px;
    --weave-space-sm: 8px;
    --weave-space-md: 12px;
    --weave-space-lg: 16px;
    --weave-space-xl: 24px;
    --weave-space-2xl: 32px;
    
    /* 圆角系统 */
    --weave-radius-sm: 4px;
    --weave-radius-md: 8px;
    --weave-radius-lg: 12px;
    --weave-radius-xl: 16px;
    
    /* 颜色系统（使用Obsidian变量作为基础） */
    --weave-text-primary: var(--text-normal);
    --weave-text-secondary: var(--text-muted);
    --weave-text-faint: var(--text-faint);
    --weave-border: var(--background-modifier-border);
    --weave-surface: var(--background-primary);
    --weave-secondary-bg: var(--background-secondary);
    
    /* 组件样式 */
    width: 100%;
    height: 100%;
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
  }
  
  /* 顶部标签页导航区域 */
  .top-navigation {
    flex-shrink: 0;
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
    padding: var(--weave-space-lg) var(--weave-space-lg) 0 var(--weave-space-lg);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--weave-space-md);
  }
  
  /*  右侧操作区 */
  .top-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--weave-space-md);
  }
  
  /*  保存状态指示器 */
  .save-indicator {
    flex-shrink: 0;
    padding: var(--weave-space-sm) var(--weave-space-md);
    border-radius: var(--weave-radius-md);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: var(--weave-space-xs);
  }
  
  .save-indicator .status {
    display: flex;
    align-items: center;
    gap: var(--weave-space-xs);
    font-weight: 500;
  }
  
  .save-indicator .saved {
    color: var(--text-success, #4caf50);
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .manager-layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: var(--weave-space-lg);
    flex: 1;
    height: calc(85vh - 160px); /* 减少高度给顶部导航留空间 */
    min-height: 450px;
    padding: var(--weave-space-lg); /* 统一使用较大的内边距 */
  }
  
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--background-secondary, var(--weave-secondary-bg));
    border-radius: var(--weave-radius-lg);
    overflow: hidden;
    border: 1px solid var(--background-modifier-border, var(--weave-border));
  }
  
  .actions-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .list-header {
    display: flex;
    align-items: center;
    gap: var(--weave-space-sm);
    padding: var(--weave-space-md) var(--weave-space-lg);
    border-bottom: 1px solid var(--background-modifier-border, var(--weave-border));
    background: var(--background-primary, var(--weave-surface));
  }
  
  .list-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal, var(--weave-text-primary));
    flex: 1;
  }
  
  .list-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    background: var(--background-modifier-border, var(--weave-border));
    color: var(--text-muted, var(--weave-text-secondary));
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: var(--weave-radius-sm);
  }
  
  
  .list-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--weave-space-sm);
  }
  
  .action-item {
    display: flex;
    align-items: center;
    gap: var(--weave-space-sm);
    padding: var(--weave-space-sm) var(--weave-space-md);
    background: var(--background-primary, var(--weave-surface));
    border: 1px solid transparent;
    border-radius: var(--weave-radius-md);
    margin-bottom: var(--weave-space-xs);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-item:hover {
    border-color: var(--background-modifier-border, var(--weave-border));
    background: var(--background-modifier-hover, var(--weave-hover));
  }
  
  .action-item.selected {
    border-color: var(--interactive-accent, var(--weave-accent-color));
    background: var(--background-modifier-hover, var(--weave-hover));
  }
  
  .action-item:focus-visible {
    outline: 2px solid var(--interactive-accent, var(--weave-accent-color));
    outline-offset: 2px;
  }
  
  
  .action-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-normal, var(--weave-text-primary));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .official-badge {
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: var(--weave-radius-sm);
    white-space: nowrap;
    background: var(--interactive-accent, var(--weave-accent-color));
    color: var(--text-on-accent, var(--weave-text-on-accent));
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .action-item :global(.delete-btn) {
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .action-item:hover :global(.delete-btn) {
    opacity: 1;
  }
  
  /* 🆕 自定义强制背景虚化层 */
  .ai-config-backdrop {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.88) !important; /* 深色半透明 */
    backdrop-filter: blur(16px) !important; /* 强烈模糊 */
    -webkit-backdrop-filter: blur(16px) !important; /* Safari */
    z-index: calc(var(--weave-z-loading) - 1);
    animation: backdropFadeIn 0.3s ease !important;
    pointer-events: auto !important;
  }
  
  @keyframes backdropFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  /* 🆕 底部操作按钮区域 */
  .form-actions {
    margin-top: var(--weave-space-xl);
    padding-top: var(--weave-space-xl);
    border-top: 2px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: var(--weave-space-md);
  }
  
  .config-editor {
    background: var(--background-secondary, var(--weave-secondary-bg));
    border-radius: var(--weave-radius-lg);
    overflow-y: auto;
    padding: var(--weave-space-xl);
    border: 1px solid var(--background-modifier-border, var(--weave-border));
  }
  
  .edit-form {
    max-width: 700px;
  }
  
  .official-notice {
    display: flex;
    align-items: flex-start;
    gap: var(--weave-space-md);
    padding: var(--weave-space-md);
    margin-bottom: var(--weave-space-lg);
    background: var(--background-secondary);
    border: 1px solid var(--interactive-accent);
    border-radius: var(--weave-radius-md);
  }
  
  .notice-content {
    flex: 1;
  }
  
  .notice-content strong {
    display: block;
    margin-bottom: var(--weave-space-xs);
    color: var(--text-normal);
    font-weight: 600;
  }
  
  .notice-content p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  .form-section {
    margin-bottom: var(--weave-space-xl);
    padding-bottom: var(--weave-space-xl);
    border-bottom: 1px solid var(--background-modifier-border, var(--weave-border));
  }
  
  .form-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
  
  /*  Section Header - 带彩色侧边条 */
  .section-header {
    display: flex;
    align-items: center;
    gap: var(--weave-space-md);
    margin-bottom: var(--weave-space-lg);
    position: relative;
    padding-left: var(--weave-space-lg);
  }
  
  .section-header::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 1.2em;
    border-radius: 2px;
  }
  
  /*  多彩侧边条 - Weave标识性设计 */
  .form-section-basic .section-header::before {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.6));
  }
  
  .form-section-split .section-header::before {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.8), rgba(124, 58, 237, 0.6));
  }
  
  .form-section-ai .section-header::before {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.6));
  }
  
  .form-section-prompt .section-header::before {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.8), rgba(219, 39, 119, 0.6));
  }
  
  .section-title {
    display: block;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-normal, var(--weave-text-primary));
    flex: 1;
  }
  
  .form-group {
    margin-bottom: var(--weave-space-lg);
  }
  
  .form-group:last-child {
    margin-bottom: 0;
  }
  
  .form-label {
    display: block;
    margin-bottom: var(--weave-space-sm);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-normal, var(--weave-text-primary));
  }
  
  .form-input,
  .form-textarea,
  .form-select {
    width: 100%;
    padding: var(--weave-space-sm) var(--weave-space-md);
    background: var(--background-primary, var(--weave-surface));
    border: 1px solid var(--background-modifier-border, var(--weave-border));
    border-radius: var(--weave-radius-md);
    color: var(--text-normal, var(--weave-text-primary));
    font-size: 0.875rem;
    font-family: inherit;
    transition: all 0.2s ease;
  }
  
  .form-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--weave-space-md) center;
    padding-right: calc(var(--weave-space-md) * 2 + 12px);
  }
  
  .form-select:focus {
    outline: none;
    border-color: var(--interactive-accent, var(--weave-accent-color));
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb, 139, 92, 246), 0.1);
  }
  
  .form-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: var(--background-secondary, var(--weave-secondary-bg));
  }
  
  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent, var(--weave-accent-color));
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb, 139, 92, 246), 0.1);
  }
  
  .form-input:disabled,
  .form-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--background-secondary, var(--weave-secondary-bg));
  }
  
  .form-hint {
    margin-top: var(--weave-space-xs);
    font-size: 0.75rem;
    color: var(--text-muted, var(--weave-text-secondary));
    line-height: 1.4;
  }
  
  .form-textarea {
    resize: vertical;
    line-height: 1.5;
    min-height: 120px;
  }
  
  .label-with-help {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--weave-space-sm);
  }
  
  .variable-help {
    margin-top: var(--weave-space-md);
    padding: var(--weave-space-md);
    background: var(--background-primary, var(--weave-surface));
    border: 1px solid var(--background-modifier-border, var(--weave-border));
    border-radius: var(--weave-radius-md);
  }
  
  .variable-help-title {
    margin: 0 0 var(--weave-space-sm) 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-normal, var(--weave-text-primary));
  }
  
  .variable-list {
    display: flex;
    flex-direction: column;
    gap: var(--weave-space-sm);
  }
  
  .variable-item {
    display: flex;
    align-items: center;
    gap: var(--weave-space-md);
  }
  
  .variable-code {
    padding: 0.1875rem 0.375rem;
    background: var(--background-secondary, var(--weave-secondary-bg));
    border-radius: var(--weave-radius-sm);
    color: var(--text-accent, var(--interactive-accent, var(--weave-accent-color)));
    font-size: 0.75rem;
    font-family: var(--font-monospace);
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .variable-desc {
    font-size: 0.75rem;
    color: var(--text-muted, var(--weave-text-secondary));
  }
  
  /* 响应式设计 */
  @media (max-width: 1024px) {
    .manager-layout {
      grid-template-columns: 280px 1fr;
      gap: var(--weave-space-md);
    }
  }
  
  @media (max-width: 768px) {
    .top-navigation {
      padding: var(--weave-space-md) var(--weave-space-md) 0 var(--weave-space-md); /* 保持顶部内边距 */
    }
    
    .manager-layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
      height: calc(85vh - 140px); /* 调整移动端高度 */
      min-height: auto;
      padding: var(--weave-space-md);
      gap: var(--weave-space-md);
    }
    
    .sidebar {
      max-height: 300px;
    }
    
    .config-editor {
      padding: var(--weave-space-lg);
    }
    
    .edit-form {
      max-width: 100%;
    }
  }
  
  /* 滚动条样式 */
  .list-content::-webkit-scrollbar,
  .config-editor::-webkit-scrollbar {
    width: 6px;
  }
  
  .list-content::-webkit-scrollbar-track,
  .config-editor::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .list-content::-webkit-scrollbar-thumb,
  .config-editor::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border, var(--weave-border));
    border-radius: 3px;
  }
  
  .list-content::-webkit-scrollbar-thumb:hover,
  .config-editor::-webkit-scrollbar-thumb:hover {
    background: var(--text-faint, var(--weave-text-faint));
  }
  
  /* 新建功能按钮样式 - 参考AIConfigModal设计 */
  .new-action-section {
    padding: 16px;
    border-top: 1px solid var(--background-modifier-border);
    margin-top: 8px;
  }

  .new-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    background: var(--background-primary);
    border: 2px dashed var(--background-modifier-border);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .new-action-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateY(-1px);
  }

  .new-action-btn:active {
    transform: translateY(0);
  }
</style>
