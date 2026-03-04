<script lang="ts">
  import type { GenerationConfig, CustomSystemPrompt, PromptTemplate } from '../../types/ai-types';
  import type { WeavePlugin } from '../../main';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import { PromptBuilderService } from '../../services/ai/PromptBuilderService';
  import { OFFICIAL_SYSTEM_PROMPTS, getOfficialSystemPromptById } from '../../constants/official-system-prompts';
  import { Notice, Platform } from 'obsidian';
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  import { focusManager } from '../../utils/focus-manager';

  interface Props {
    plugin: WeavePlugin;
    config: GenerationConfig;
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: GenerationConfig) => void;
  }

  let { plugin, config, isOpen, onClose, onSave }: Props = $props();
  let modalEl = $state<HTMLElement | null>(null);
  let lastTrapEl: HTMLElement | null = null;
  let wasOpen = false;
  
  // 移动端检测
  const isMobile = Platform.isMobile;
  
  // 移动端提示词视图模式: 'list' 显示列表, 'editor' 显示编辑/预览
  let mobilePromptView = $state<'list' | 'editor'>('list');
  
  // 响应式翻译函数
  

  // 标签页状态
  type TabType = 'system-prompt' | 'ai-config' | 'user-prompt';
  let activeTab = $state<TabType>('ai-config');

  // 系统提示词状态（Obsidian模式：直接编辑）
  let customSystemPrompts = $state<CustomSystemPrompt[]>([]);
  let selectedSystemPromptId = $state<string | null>(null);
  let editingSystemPromptId = $state<string | null>(null); //  只记录正在编辑的ID

  // 用户提示词状态（Obsidian模式：直接编辑）
  let officialPrompts = $state<PromptTemplate[]>([]);
  let customUserPrompts = $state<PromptTemplate[]>([]);
  let selectedUserPromptId = $state<string | null>(null);
  let editingUserPromptId = $state<string | null>(null); //  只记录正在编辑的ID

  // 本地配置状态（深拷贝并确保AI配置存在）
  function initializeConfig(sourceConfig: GenerationConfig): GenerationConfig {
    const initialized = JSON.parse(JSON.stringify(sourceConfig));
    
    // 确保AI服务配置有默认值
    if (!initialized.provider) {
      initialized.provider = plugin.settings.aiConfig?.defaultProvider || 'zhipu';
    }
    
    // 模型由底部工具栏管理，使用配置中的值
    if (!initialized.model) {
      initialized.model = config.model || 'gpt-4';
    }
    
    if (!initialized.temperature) {
      initialized.temperature = 0.7;
    }
    if (!initialized.maxTokens) {
      initialized.maxTokens = 4000;
    }
    return initialized;
  }
  
  let localConfig = $state<GenerationConfig>(initializeConfig(config));
  
  // 验证错误
  let validationErrors = $state<string[]>([]);
  


  // 重置为当前配置（取消时使用）
  function resetConfig() {
    localConfig = initializeConfig(config);
    validationErrors = [];
  }

  function resetToDefaults() {
    localConfig = {
      ...localConfig,
      cardCount: 10,
      difficulty: 'medium',
      typeDistribution: { qa: 50, cloze: 30, choice: 20 },
      autoTags: [],
      enableHints: true
    };
  }

  $effect(() => {
    if (isOpen && !wasOpen) {
      focusManager.saveFocus();
      setTimeout(() => {
        if (modalEl) {
          lastTrapEl = modalEl;
          const firstFocusable = modalEl.querySelector(
            'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement | null;
          focusManager.trapFocus(modalEl, firstFocusable ?? undefined);
        }
      }, 0);
    } else if (!isOpen && wasOpen) {
      if (lastTrapEl) {
        focusManager.releaseTrap(lastTrapEl);
      }
      focusManager.restoreFocus();
      lastTrapEl = null;
    }

    wasOpen = isOpen;
  });

  function updateTypeDistribution(type: 'qa' | 'cloze' | 'choice', value: number) {
    const newConfig = { ...localConfig.typeDistribution };
    newConfig[type] = value;
    const others = (['qa', 'cloze', 'choice'] as const).filter(t => t !== type);
    const remaining = 100 - value;
    const currentOthersTotal = others.reduce((sum, t) => sum + newConfig[t], 0);
    
    if (currentOthersTotal > 0) {
      others.forEach(t => {
        newConfig[t] = Math.round((newConfig[t] / currentOthersTotal) * remaining);
      });
    } else {
      newConfig[others[0]] = Math.floor(remaining / 2);
      newConfig[others[1]] = remaining - newConfig[others[0]];
    }

    const total = newConfig.qa + newConfig.cloze + newConfig.choice;
    const diff = 100 - total;
    if (diff !== 0) {
      const adjustable = (['qa', 'cloze', 'choice'] as const).filter(t => t !== type);
      const target = adjustable.reduce((best, cur) => (newConfig[cur] > newConfig[best] ? cur : best), adjustable[0]);
      newConfig[target] = Math.max(0, Math.min(100, newConfig[target] + diff));
    }
    localConfig.typeDistribution = newConfig;
  }

  const visualTypeDistribution = $derived(() => {
    const dist = localConfig.typeDistribution;
    const qa = Number(dist.qa) || 0;
    const cloze = Number(dist.cloze) || 0;
    const choice = Number(dist.choice) || 0;
    const sum = qa + cloze + choice;
    if (sum <= 0) {
      return { qa: 0, cloze: 0, choice: 0 };
    }

    const qaPct = Math.max(0, (qa / sum) * 100);
    const clozePct = Math.max(0, (cloze / sum) * 100);
    const choicePct = Math.max(0, 100 - qaPct - clozePct);
    return { qa: qaPct, cloze: clozePct, choice: choicePct };
  });

  function validateConfig(): boolean {
    const errors: string[] = [];
    if (localConfig.cardCount < 1 || localConfig.cardCount > 50) {
      errors.push('卡片数量必须在 1-50 之间');
    }
    const total = Object.values(localConfig.typeDistribution).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 1) {
      errors.push(`题型分布总和必须为 100%（当前: ${total}%）`);
    }
    validationErrors = errors;
    return errors.length === 0;
  }

  function handleSave() {
    if (validateConfig()) onSave(localConfig);
  }

  function handleClose() {
    resetConfig();
    onClose();
  }

  // 彩色圆点标签页配置
  const tabDots: { id: TabType; name: string; colorStart: string; colorEnd: string }[] = [
    { id: 'system-prompt', name: '系统提示词', colorStart: '#3b82f6', colorEnd: '#2563eb' },
    { id: 'ai-config', name: '卡片生成设置', colorStart: '#8b5cf6', colorEnd: '#7c3aed' },
    { id: 'user-prompt', name: '用户提示词', colorStart: '#10b981', colorEnd: '#059669' }
  ];

  function getGradientStyle(colorStart: string, colorEnd: string): string {
    return `background: linear-gradient(135deg, ${colorStart}, ${colorEnd})`;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleSave();
  }

  // 初始化提示词数据
  $effect(() => {
    if (isOpen) {
      // 加载系统提示词
      const systemConfig = plugin.settings.aiConfig?.systemPromptConfig;
      customSystemPrompts = systemConfig?.customSystemPrompts || [];
      selectedSystemPromptId = systemConfig?.selectedSystemPromptId || null;
      
      // 加载用户提示词
      officialPrompts = (plugin.settings.aiConfig?.promptTemplates?.official || []).map(p => ({
        ...p,
        category: 'official' as const,
        useBuiltinSystemPrompt: p.useBuiltinSystemPrompt ?? true
      }));
      customUserPrompts = plugin.settings.aiConfig?.promptTemplates?.custom || [];
      
      // 重置编辑状态
      editingSystemPromptId = null;
      editingUserPromptId = null;
    }
  });

  // ===== 系统提示词管理 =====
  const currentSystemPrompt = $derived(() => {
    if (selectedSystemPromptId) {
      // 先查找官方系统提示词
      const official = getOfficialSystemPromptById(selectedSystemPromptId);
      if (official) return PromptBuilderService.replaceVariables(official.content, localConfig);
      // 再查找自定义系统提示词
      const custom = customSystemPrompts.find(p => p.id === selectedSystemPromptId);
      if (custom) return custom.content;
    }
    return PromptBuilderService.getBuiltinSystemPrompt(localConfig);
  });

  const currentSystemPromptName = $derived(() => {
    if (selectedSystemPromptId) {
      const official = getOfficialSystemPromptById(selectedSystemPromptId);
      if (official) return official.name;
      const custom = customSystemPrompts.find(p => p.id === selectedSystemPromptId);
      if (custom) return custom.name;
    }
    return '内置系统提示词';
  });

  function createSystemPrompt() {
    if (customSystemPrompts.length >= 5) {
      new Notice('最多只能创建5个自定义系统提示词');
      return;
    }
    const newPrompt: CustomSystemPrompt = {
      id: `custom-system-prompt-${Date.now()}`,
      name: '新系统提示词',
      content: PromptBuilderService.getBuiltinSystemPrompt(localConfig),
      description: '',
      createdAt: new Date().toISOString()
    };
    //  Obsidian模式：直接添加并保存
    customSystemPrompts = [...customSystemPrompts, newPrompt];
    selectedSystemPromptId = newPrompt.id;
    editingSystemPromptId = newPrompt.id;
    saveSystemPrompts();
    if (isMobile) mobilePromptView = 'editor';
  }

  function editSystemPrompt(id: string) {
    //  Obsidian模式：只设置编辑ID，直接编辑原对象
    selectedSystemPromptId = id;
    editingSystemPromptId = id;
    if (isMobile) mobilePromptView = 'editor';
  }

  async function deleteSystemPrompt(id: string) {
    const promptName = customSystemPrompts.find(p => p.id === id)?.name || '此提示词';
    const confirmed = await showObsidianConfirm(plugin.app, `确定要删除"${promptName}"吗？`, { title: '确认删除' });
    if (confirmed) {
      //  Obsidian模式：直接删除并保存
      customSystemPrompts = customSystemPrompts.filter(p => p.id !== id);
      if (selectedSystemPromptId === id) {
        selectedSystemPromptId = null;
      }
      if (editingSystemPromptId === id) {
        editingSystemPromptId = null;
      }
      saveSystemPrompts();
      new Notice(`已删除“${promptName}”`);
    }
  }

  function selectSystemPrompt(id: string | null) {
    selectedSystemPromptId = id;
    saveSystemPrompts();
    if (isMobile) mobilePromptView = 'editor';
  }

  //  Obsidian模式：直接更新对象，无需保存函数
  function updateSystemPrompt(id: string, updates: Partial<CustomSystemPrompt>) {
    const index = customSystemPrompts.findIndex(p => p.id === id);
    if (index >= 0) {
      customSystemPrompts[index] = {
        ...customSystemPrompts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      customSystemPrompts = [...customSystemPrompts]; // 触发响应式更新
      saveSystemPrompts();
    }
  }

  function cancelSystemPromptEdit() {
    if (editingSystemPromptId) {
      const prompt = customSystemPrompts.find(p => p.id === editingSystemPromptId);
      // 如果是未保存的新提示词，删除它
      if (prompt && !prompt.updatedAt && prompt.name === '新系统提示词' && !prompt.content.trim()) {
        customSystemPrompts = customSystemPrompts.filter(p => p.id !== editingSystemPromptId);
        if (selectedSystemPromptId === editingSystemPromptId) {
          selectedSystemPromptId = null;
        }
        saveSystemPrompts();
      }
    }
    editingSystemPromptId = null;
    if (isMobile) mobilePromptView = 'list';
  }

  async function saveSystemPrompts() {
    if (!plugin.settings.aiConfig) return;
    if (!plugin.settings.aiConfig.systemPromptConfig) {
      plugin.settings.aiConfig.systemPromptConfig = {
        useBuiltin: true,
        customPrompt: ''
      };
    }
    plugin.settings.aiConfig.systemPromptConfig.customSystemPrompts = customSystemPrompts;
    plugin.settings.aiConfig.systemPromptConfig.selectedSystemPromptId = selectedSystemPromptId || undefined;
    await plugin.saveSettings();
  }

  function copySystemPromptToClipboard() {
    const text = currentSystemPrompt();
    navigator.clipboard.writeText(text).then(() => {
      new Notice('已复制到剪贴板');
    }).catch(() => {
      new Notice('复制失败');
    });
  }

  // 设为默认系统提示词
  function setDefaultSystemPrompt(promptId: string | null) {
    if (!plugin.settings.aiConfig) return;
    if (!plugin.settings.aiConfig.systemPromptConfig) {
      plugin.settings.aiConfig.systemPromptConfig = {
        useBuiltin: true,
        customPrompt: ''
      };
    }
    
    plugin.settings.aiConfig.systemPromptConfig.selectedSystemPromptId = promptId || undefined;
    selectedSystemPromptId = promptId;
    plugin.saveSettings();
    
    const promptName = promptId 
      ? (getOfficialSystemPromptById(promptId)?.name || customSystemPrompts.find(p => p.id === promptId)?.name || '未知')
      : '内置系统提示词';
    new Notice(`已设为默认: ${promptName}`);
  }

  // ===== 用户提示词管理 =====
  const allUserPrompts = $derived([...officialPrompts, ...customUserPrompts]);
  const currentUserPrompt = $derived(() => {
    if (selectedUserPromptId) {
      return allUserPrompts.find(p => p.id === selectedUserPromptId) || null;
    }
    return null;
  });

  function createUserPrompt() {
    const newPrompt: PromptTemplate = {
      id: `custom-prompt-${Date.now()}`,
      name: '新提示词',
      prompt: '请根据以下内容生成学习卡片',
      variables: ['count', 'difficulty'],
      useBuiltinSystemPrompt: true,
      category: 'custom',
      createdAt: new Date().toISOString()
    };
    //  Obsidian模式：直接添加并保存
    customUserPrompts = [...customUserPrompts, newPrompt];
    selectedUserPromptId = newPrompt.id;
    editingUserPromptId = newPrompt.id;
    saveUserPrompts();
    if (isMobile) mobilePromptView = 'editor';
  }

  function editUserPrompt(id: string) {
    const prompt = allUserPrompts.find(p => p.id === id);
    if (prompt?.category === 'official') {
      new Notice('官方提示词不可编辑');
      return;
    }
    //  Obsidian模式：只设置编辑ID，直接编辑原对象
    selectedUserPromptId = id;
    editingUserPromptId = id;
    if (isMobile) mobilePromptView = 'editor';
  }

  function viewUserPrompt(id: string) {
    selectedUserPromptId = id;
    editingUserPromptId = null; // 退出编辑模式
    if (isMobile) mobilePromptView = 'editor';
  }

  async function deleteUserPrompt(id: string) {
    const prompt = allUserPrompts.find(p => p.id === id);
    if (prompt?.category === 'official') {
      new Notice('官方提示词不可删除');
      return;
    }
    const promptName = prompt?.name || '此提示词';
    const confirmed = await showObsidianConfirm(plugin.app, `确定要删除"${promptName}"吗？`, { title: '确认删除' });
    if (confirmed) {
      //  Obsidian模式：直接删除并保存
      customUserPrompts = customUserPrompts.filter(p => p.id !== id);
      if (selectedUserPromptId === id) {
        selectedUserPromptId = null;
      }
      if (editingUserPromptId === id) {
        editingUserPromptId = null;
      }
      saveUserPrompts();
      new Notice(`已删除“${promptName}”`);
    }
  }

  //  Obsidian模式：直接更新对象，无需保存函数
  function updateUserPrompt(id: string, updates: Partial<PromptTemplate>) {
    const index = customUserPrompts.findIndex(p => p.id === id);
    if (index >= 0) {
      customUserPrompts[index] = {
        ...customUserPrompts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      customUserPrompts = [...customUserPrompts]; // 触发响应式更新
      saveUserPrompts();
    }
  }

  function cancelUserPromptEdit() {
    if (editingUserPromptId) {
      const prompt = customUserPrompts.find(p => p.id === editingUserPromptId);
      // 如果是未保存的新提示词，删除它
      if (prompt && !prompt.updatedAt && prompt.name === '新提示词' && !prompt.prompt.trim()) {
        customUserPrompts = customUserPrompts.filter(p => p.id !== editingUserPromptId);
        if (selectedUserPromptId === editingUserPromptId) {
          selectedUserPromptId = null;
        }
        saveUserPrompts();
      }
    }
    editingUserPromptId = null;
    if (isMobile) mobilePromptView = 'list';
  }

  async function saveUserPrompts() {
    if (!plugin.settings.aiConfig) return;
    if (!plugin.settings.aiConfig.promptTemplates) {
      plugin.settings.aiConfig.promptTemplates = {
        official: [],
        custom: []
      };
    }
    plugin.settings.aiConfig.promptTemplates.custom = customUserPrompts as PromptTemplate[];
    await plugin.saveSettings();
  }

  function copyUserPromptToClipboard(prompt: PromptTemplate) {
    navigator.clipboard.writeText(prompt.prompt).then(() => {
      new Notice('已复制到剪贴板');
    }).catch(() => {
      new Notice('复制失败');
    });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleClose} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="ai-config-modal" bind:this={modalEl} onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <h2 class="modal-title">
          AI制卡配置
        </h2>

        <!-- 彩色圆点标签页导航（内嵌于标题行，仿 BuildDeckModal 设计） -->
        <div class="mode-dots">
          {#each tabDots as dot}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="dot"
              class:active={activeTab === dot.id}
              style="background: {dot.colorStart}"
              onclick={() => activeTab = dot.id}
              title={dot.name}
            ></span>
          {/each}
        </div>

        <button class="close-btn" onclick={handleClose} title="关闭">
          <ObsidianIcon name="x" size={18} />
        </button>
      </div>

      <!-- 标签页内容容器 -->
      <div class="tab-content-wrapper">
        {#if validationErrors.length > 0}
          <div class="validation-errors">
            {#each validationErrors as error}
              <div class="error-item">{error}</div>
            {/each}
          </div>
        {/if}

        <!-- 系统提示词标签页 -->
        {#if activeTab === 'system-prompt'}
          <div class="tab-panel system-prompt-panel">
            <div class="panel-layout" class:mobile-list-view={isMobile && mobilePromptView === 'list'} class:mobile-editor-view={isMobile && mobilePromptView === 'editor'}>
              <!-- 左侧列表 -->
              <div class="sidebar-list">
                <div class="list-content">
                  <!-- 内置系统提示词 -->
                  <div 
                    class="list-item"
                    class:active={selectedSystemPromptId === null}
                    role="button"
                    tabindex="0"
                    onclick={() => selectSystemPrompt(null)}
                  >
                    <div class="item-content">
                      <div class="item-title">
                        内置系统提示词
                        {#if plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId === undefined || plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId === null}
                          <span class="default-badge">默认</span>
                        {/if}
                      </div>
                    </div>
                    <div class="item-actions">
                      <button 
                        class="action-btn copy-prompt-btn" 
                        onclick={(e) => { e.stopPropagation(); copySystemPromptToClipboard(); }}
                        title="复制"
                      >
                        <ObsidianIcon name="copy" size={12} />
                      </button>
                      {#if plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId !== undefined && plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId !== null}
                        <button 
                          class="action-btn" 
                          onclick={(e) => { e.stopPropagation(); setDefaultSystemPrompt(null); }}
                          title="设为默认"
                        >
                          <ObsidianIcon name="star" size={12} />
                        </button>
                      {/if}
                    </div>
                  </div>
                  
                  <!-- 官方系统提示词列表 -->
                  {#each OFFICIAL_SYSTEM_PROMPTS as prompt (prompt.id)}
                    <div 
                      class="list-item"
                      class:active={selectedSystemPromptId === prompt.id}
                      role="button"
                      tabindex="0"
                      onclick={() => selectSystemPrompt(prompt.id)}
                    >
                      <div class="item-content">
                        <div class="item-title">
                          {prompt.name}
                          <span class="official-badge">官方</span>
                          {#if plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId === prompt.id}
                            <span class="default-badge">默认</span>
                          {/if}
                        </div>
                        {#if prompt.description}
                          <div class="item-desc">{prompt.description}</div>
                        {/if}
                      </div>
                      <div class="item-actions">
                        <button 
                          class="action-btn copy-prompt-btn" 
                          onclick={(e) => { e.stopPropagation(); copySystemPromptToClipboard(); }}
                          title="复制"
                        >
                          <ObsidianIcon name="copy" size={12} />
                        </button>
                        {#if plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId !== prompt.id}
                          <button 
                            class="action-btn" 
                            onclick={(e) => { e.stopPropagation(); setDefaultSystemPrompt(prompt.id); }}
                            title="设为默认"
                          >
                            <ObsidianIcon name="star" size={12} />
                          </button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                  
                  <!-- 自定义系统提示词列表 -->
                  {#each customSystemPrompts as prompt (prompt.id)}
                    <div 
                      class="list-item"
                      class:active={selectedSystemPromptId === prompt.id}
                      role="button"
                      tabindex="0"
                      onclick={() => selectSystemPrompt(prompt.id)}
                    >
                      <div class="item-content">
                        <div class="item-title">
                          {prompt.name}
                          {#if plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId === prompt.id}
                            <span class="default-badge">默认</span>
                          {/if}
                        </div>
                      </div>
                      <div class="item-actions">
                        <button 
                          class="action-btn copy-prompt-btn" 
                          onclick={(e) => { e.stopPropagation(); copySystemPromptToClipboard(); }}
                          title="复制"
                        >
                          <ObsidianIcon name="copy" size={12} />
                        </button>
                        {#if plugin.settings.aiConfig?.systemPromptConfig?.selectedSystemPromptId !== prompt.id}
                          <button 
                            class="action-btn" 
                            onclick={(e) => { e.stopPropagation(); setDefaultSystemPrompt(prompt.id); }}
                            title="设为默认"
                          >
                            <ObsidianIcon name="star" size={12} />
                          </button>
                        {/if}
                        <button 
                          class="action-btn" 
                          onclick={(e) => { e.stopPropagation(); editSystemPrompt(prompt.id); }}
                          title="编辑"
                        >
                          <ObsidianIcon name="edit" size={12} />
                        </button>
                        <button 
                          class="action-btn" 
                          onclick={(e) => { e.stopPropagation(); deleteSystemPrompt(prompt.id); }}
                          title="删除"
                        >
                          <ObsidianIcon name="trash" size={12} />
                        </button>
                      </div>
                    </div>
                  {/each}
                  
                  <!--  新建系统提示词按钮 - 移动到底部，使用用户提示词样式 -->
                  <div class="new-prompt-section">
                    <button 
                      class="new-prompt-btn" 
                      onclick={createSystemPrompt}
                      disabled={customSystemPrompts.length >= 5}
                      title={customSystemPrompts.length >= 5 ? '最多创建5个自定义系统提示词' : '新建系统提示词'}
                    >
                      <ObsidianIcon name="plus" size={16} />
                      <span>新建系统提示词</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- 右侧内容区 -->
              <div class="content-area">
                {#if isMobile}
                  <button class="mobile-back-btn" onclick={() => { mobilePromptView = 'list'; editingSystemPromptId = null; }}>
                    <ObsidianIcon name="arrow-left" size={16} />
                    <span>返回列表</span>
                  </button>
                {/if}
                {#if editingSystemPromptId}
                  {@const editingPrompt = customSystemPrompts.find(p => p.id === editingSystemPromptId)}
                  {#if editingPrompt}
                    <!--  直接编辑模式（Obsidian模式） -->
                    <div class="edit-form">
                      <div class="form-group">
                        <div class="form-label-row">
                          <label class="form-label" for="system-prompt-name">名称</label>
                          <div class="instant-save-badge">
                            <ObsidianIcon name="zap" size={12} />
                            <span>更改即时保存</span>
                          </div>
                        </div>
                        <input 
                          id="system-prompt-name"
                          type="text" 
                          value={editingPrompt.name}
                          oninput={(e) => updateSystemPrompt(editingPrompt.id, { name: (e.target as HTMLInputElement).value })}
                          placeholder="请输入提示词名称"
                          class="form-input"
                        />
                      </div>
                      
                      <div class="form-group">
                        <label class="form-label" for="system-prompt-content">内容</label>
                        <textarea 
                          id="system-prompt-content"
                          value={editingPrompt.content}
                          oninput={(e) => updateSystemPrompt(editingPrompt.id, { content: (e.target as HTMLTextAreaElement).value })}
                          placeholder="请输入系统提示词内容..."
                          class="form-textarea"
                          rows="15"
                        ></textarea>
                      </div>
                      
                      <div class="form-actions">
                        <button class="btn btn-secondary" onclick={cancelSystemPromptEdit}>完成编辑</button>
                      </div>
                    </div>
                  {/if}
                {:else}
                  <!-- 预览模式 -->
                  <div class="preview-mode">
                    <pre class="preview-content">{currentSystemPrompt()}</pre>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- AI配置标签页 -->
        {#if activeTab === 'ai-config'}
          <div class="tab-panel ai-config-panel">
        <!-- 难度级别 -->
        <section class="config-section difficulty">
          <div class="section-header">
            <div class="section-indicator difficulty-indicator"></div>
            <h3 class="section-title">难度级别</h3>
          </div>
          <div class="config-item">
            <fieldset class="config-fieldset">
              <legend class="visually-hidden">难度级别</legend>
              <div class="radio-group">
              <label class="radio-item">
                <input
                  type="radio"
                  name="difficulty"
                  value="easy"
                  bind:group={localConfig.difficulty}
                />
                <span class="radio-label">简单</span>
              </label>
              <label class="radio-item">
                <input
                  type="radio"
                  name="difficulty"
                  value="medium"
                  bind:group={localConfig.difficulty}
                />
                <span class="radio-label">中等</span>
              </label>
              <label class="radio-item">
                <input
                  type="radio"
                  name="difficulty"
                  value="hard"
                  bind:group={localConfig.difficulty}
                />
                <span class="radio-label">困难</span>
              </label>
              <label class="radio-item">
                <input
                  type="radio"
                  name="difficulty"
                  value="mixed"
                  bind:group={localConfig.difficulty}
                />
                <span class="radio-label">混合</span>
              </label>
              </div>
            </fieldset>
          </div>
        </section>

        <!-- 生成数量 -->
        <section class="config-section card-count">
          <div class="section-header">
            <div class="section-indicator count-indicator"></div>
            <h3 class="section-title">生成数量</h3>
          </div>
          <div class="config-item">
            <label class="config-label visually-hidden" for="card-count-slider">
              生成数量 ({localConfig.cardCount} 张)
            </label>
            <div class="slider-row">
              <input
                id="card-count-slider"
                type="range"
                min="1"
                max="50"
                bind:value={localConfig.cardCount}
                class="config-slider full-width"
              />
              <span class="slider-value-inline">{localConfig.cardCount} 张</span>
            </div>
          </div>
        </section>

        <!-- 题型分布 -->
        <section class="config-section type-distribution">
          <div class="section-header">
            <div class="section-indicator distribution-indicator"></div>
            <h3 class="section-title">题型分布</h3>
          </div>
          <div class="config-item">
            <fieldset class="config-fieldset">
              <legend class="visually-hidden">题型分布</legend>
              <div class="distribution-controls">
                <div class="distribution-item">
                  <label class="distribution-label" for="qa-distribution-slider">
                    <span class="type-dot qa-dot"></span>
                    问答题
                  </label>
                  <div class="slider-container">
                    <input
                      id="qa-distribution-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={localConfig.typeDistribution.qa}
                      oninput={(e) => updateTypeDistribution('qa', parseInt((e.target as HTMLInputElement).value))}
                      class="config-slider qa-slider"
                    />
                    <span class="slider-value">{localConfig.typeDistribution.qa}%</span>
                  </div>
                </div>

                <div class="distribution-item">
                  <label class="distribution-label" for="cloze-distribution-slider">
                    <span class="type-dot cloze-dot"></span>
                    挖空题
                  </label>
                  <div class="slider-container">
                    <input
                      id="cloze-distribution-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={localConfig.typeDistribution.cloze}
                      oninput={(e) => updateTypeDistribution('cloze', parseInt((e.target as HTMLInputElement).value))}
                      class="config-slider cloze-slider"
                    />
                    <span class="slider-value">{localConfig.typeDistribution.cloze}%</span>
                  </div>
                </div>

                <div class="distribution-item">
                  <label class="distribution-label" for="choice-distribution-slider">
                    <span class="type-dot choice-dot"></span>
                    选择题
                  </label>
                  <div class="slider-container">
                    <input
                      id="choice-distribution-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={localConfig.typeDistribution.choice}
                      oninput={(e) => updateTypeDistribution('choice', parseInt((e.target as HTMLInputElement).value))}
                      class="config-slider choice-slider"
                    />
                    <span class="slider-value">{localConfig.typeDistribution.choice}%</span>
                  </div>
                </div>
              </div>
              
              <!-- 可视化堆叠条形图 -->
              <div class="distribution-visual">
                <div class="stacked-bar">
                  <div class="bar-segment qa-segment" style="width: {visualTypeDistribution().qa}%"></div>
                  <div class="bar-segment cloze-segment" style="width: {visualTypeDistribution().cloze}%"></div>
                  <div class="bar-segment choice-segment" style="width: {visualTypeDistribution().choice}%"></div>
                </div>
                <div class="bar-legend">
                  <span class="legend-item">
                    <span class="legend-dot qa-dot"></span>
                    问答 {localConfig.typeDistribution.qa}%
                  </span>
                  <span class="legend-item">
                    <span class="legend-dot cloze-dot"></span>
                    挖空 {localConfig.typeDistribution.cloze}%
                  </span>
                  <span class="legend-item">
                    <span class="legend-dot choice-dot"></span>
                    选择 {localConfig.typeDistribution.choice}%
                  </span>
                </div>
              </div>
            </fieldset>
          </div>
        </section>

        <!-- 高级选项 -->
        <section class="config-section advanced-options">
          <div class="section-header">
            <div class="section-indicator advanced-indicator"></div>
            <h3 class="section-title">高级选项</h3>
          </div>

          <!-- 自动标签 -->
          <div class="config-item">
            <label class="config-label" for="auto-tags-input">自动添加标签</label>
            <input
              id="auto-tags-input"
              type="text"
              value={localConfig.autoTags.join(', ')}
              oninput={(e) => {
                const value = (e.target as HTMLInputElement).value;
                localConfig.autoTags = value.split(',').map(t => t.trim()).filter(t => t);
              }}
              placeholder="标签1, 标签2, ..."
              class="config-input"
            />
          </div>

        </section>
          </div>
        {/if}

        <!-- 用户提示词标签页 -->
        {#if activeTab === 'user-prompt'}
          <div class="tab-panel user-prompt-panel">
            <div class="panel-layout" class:mobile-list-view={isMobile && mobilePromptView === 'list'} class:mobile-editor-view={isMobile && mobilePromptView === 'editor'}>
              <!-- 左侧列表 -->
              <div class="sidebar-list">                
                <div class="list-content">
                  <!-- 官方提示词 -->
                  {#if officialPrompts.length > 0}
                    <div class="section-divider official-section">
                      <div class="section-header">
                        <h4 class="section-title">官方提示词</h4>
                      </div>
                    </div>
                    {#each officialPrompts as prompt (prompt.id)}
                      <div 
                        class="list-item official"
                        class:active={selectedUserPromptId === prompt.id && !editingUserPromptId}
                        role="button"
                        tabindex="0"
                        onclick={() => viewUserPrompt(prompt.id)}
                      >
                        <div class="item-content">
                          <div class="item-title">{prompt.name}</div>
                        </div>
                        <div class="item-actions">
                          <button 
                            class="action-btn copy-btn" 
                            onclick={(e) => { e.stopPropagation(); copyUserPromptToClipboard(prompt); }}
                            title="复制"
                          >
                            <ObsidianIcon name="copy" size={12} />
                          </button>
                        </div>
                        <span class="official-badge">官方</span>
                      </div>
                    {/each}
                  {/if}
                  
                  <!-- 自定义提示词 -->
                  {#if customUserPrompts.length > 0}
                    <div class="section-divider custom-section">
                      <div class="section-header">
                        <h4 class="section-title">自定义提示词</h4>
                      </div>
                    </div>
                    {#each customUserPrompts as prompt (prompt.id)}
                      <div 
                        class="list-item"
                        class:active={selectedUserPromptId === prompt.id && !editingUserPromptId}
                        role="button"
                        tabindex="0"
                        onclick={() => viewUserPrompt(prompt.id)}
                      >
                        <div class="item-content">
                          <div class="item-title">{prompt.name}</div>
                        </div>
                        <div class="item-actions">
                          <button 
                            class="action-btn copy-btn" 
                            onclick={(e) => { e.stopPropagation(); copyUserPromptToClipboard(prompt); }}
                            title="复制"
                          >
                            <ObsidianIcon name="copy" size={12} />
                          </button>
                          <button 
                            class="action-btn" 
                            onclick={(e) => { e.stopPropagation(); editUserPrompt(prompt.id); }}
                            title="编辑"
                          >
                            <ObsidianIcon name="edit" size={12} />
                          </button>
                          <button 
                            class="action-btn" 
                            onclick={(e) => { e.stopPropagation(); deleteUserPrompt(prompt.id); }}
                            title="删除"
                          >
                            <ObsidianIcon name="trash" size={12} />
                          </button>
                        </div>
                      </div>
                    {/each}
                  {/if}
                  
                  <!-- 新建提示词按钮 - 移动到底部 -->
                  <div class="new-prompt-section">
                    <button 
                      class="new-prompt-btn" 
                      onclick={createUserPrompt}
                      title="新建自定义提示词"
                    >
                      <ObsidianIcon name="plus" size={16} />
                      <span>新建提示词</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- 右侧内容区 -->
              <div class="content-area">
                {#if isMobile}
                  <button class="mobile-back-btn" onclick={() => { mobilePromptView = 'list'; editingUserPromptId = null; }}>
                    <ObsidianIcon name="arrow-left" size={16} />
                    <span>返回列表</span>
                  </button>
                {/if}
                {#if editingUserPromptId}
                  {@const editingPrompt = customUserPrompts.find(p => p.id === editingUserPromptId)}
                  {#if editingPrompt}
                    <!--  直接编辑模式（Obsidian模式） -->
                    <div class="edit-form">
                      <div class="form-group">
                        <div class="form-label-row">
                          <label class="form-label" for="user-prompt-name">名称</label>
                          <div class="instant-save-badge">
                            <ObsidianIcon name="zap" size={12} />
                            <span>更改即时保存</span>
                          </div>
                        </div>
                        <input 
                          id="user-prompt-name"
                          type="text" 
                          value={editingPrompt.name}
                          oninput={(e) => updateUserPrompt(editingPrompt.id, { name: (e.target as HTMLInputElement).value })}
                          placeholder="请输入提示词名称"
                          class="form-input"
                        />
                      </div>
                      
                      <div class="form-group">
                        <label class="form-label" for="user-prompt-content">提示词内容</label>
                        <textarea 
                          id="user-prompt-content"
                          value={editingPrompt.prompt}
                          oninput={(e) => updateUserPrompt(editingPrompt.id, { prompt: (e.target as HTMLTextAreaElement).value })}
                          placeholder="请输入提示词内容..."
                          class="form-textarea"
                          rows="10"
                        ></textarea>
                        <div class="form-hint">
                          可以使用变量：{'{count}'}（卡片数量）、{'{difficulty}'}（难度）等
                        </div>
                      </div>
                      
                      <div class="form-actions">
                        <button class="btn btn-secondary" onclick={cancelUserPromptEdit}>完成编辑</button>
                      </div>
                    </div>
                  {/if}
                {:else if currentUserPrompt()}
                  <!-- 查看内容 -->
                  <div class="preview-mode">
                    <div class="preview-header">
                      <h4>{currentUserPrompt()!.name}</h4>
                      <div class="header-actions">
                        <button class="copy-btn secondary" onclick={() => copyUserPromptToClipboard(currentUserPrompt()!)}>
                          <ObsidianIcon name="copy" size={14} />
                          复制
                        </button>
                        <button class="use-btn" onclick={() => { /* TODO: 使用此提示词 */ new Notice('使用此提示词'); }}>
                          <ObsidianIcon name="check" size={14} />
                          使用此提示词
                        </button>
                      </div>
                    </div>
                    <pre class="preview-content">{currentUserPrompt()!.prompt}</pre>
                  </div>
                {:else}
                  <!-- 空状态 -->
                  <div class="empty-preview">
                    <ObsidianIcon name="file-text" size={48} />
                    <p>请从左侧选择一个提示词</p>
                    <p class="hint-text">或点击"新建"按钮创建新提示词</p>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}

      </div>

      <!-- 底部按钮 -->
      <div class="modal-footer">
        <button class="reset-btn" onclick={resetToDefaults}>
          <ObsidianIcon name="rotate-ccw" size={14} />
          <span class="btn-label">重置默认</span>
        </button>
        <div class="footer-actions">
          <button class="save-btn" onclick={handleSave}>
            <ObsidianIcon name="check" size={16} />
            <span class="btn-label">保存并应用</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75); /* 增加透明度，确保内容清晰可见 */
    backdrop-filter: blur(4px); /* 添加模糊效果 */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal, 50); /* AI配置模态窗，高于菜单层级(5000) */
    overscroll-behavior: contain;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .ai-config-modal {
    width: 95%;
    max-width: 1000px;
    max-height: 85vh;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overscroll-behavior: contain;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 头部 */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-bottom: 1px solid var(--weave-border-visible);
    flex-shrink: 0;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 1.3em;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 彩色圆点（仿 BuildDeckModal 设计） */
  .mode-dots {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 20px;
    border: none;
    background: transparent;
    flex: 1;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    opacity: 0.45;
    transition: opacity 0.15s ease, transform 0.15s ease;
    cursor: pointer;
  }

  .dot.active {
    opacity: 1;
    transform: scale(1.15);
  }

  /* 标签页内容容器 */
  .tab-content-wrapper {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .tab-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* 面板布局（系统提示词 & 用户提示词） */
  .panel-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* 左侧列表 */
  .sidebar-list {
    width: 280px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-right: 1px solid var(--weave-border-visible);
    display: flex;
    flex-direction: column;
    background: var(--background-primary); /* 与右侧内容区保持一致的背景色 */
    padding-left: 8px; /* 与标签页导航栏左侧间距配合 */
  }

  /*  已删除 .new-btn 样式 - 统一使用 .new-prompt-btn */

  .list-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    margin: 20px 8px 8px 8px;
    border-radius: 8px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
  }

  /* 列表项 */
  .list-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 2px;
    border: 1px solid transparent;
  }

  .list-item:hover {
    background: var(--background-modifier-hover);
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-color: var(--weave-border-visible);
  }

  .list-item.active {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }

  /*  移除 !important：使用更具体的选择器 */
  .list-item.active .item-title,
  .list-item.active .item-content {
    color: white;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 2px;
    line-height: 1.4;
  }

  .item-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.3;
    margin-top: 2px;
  }

  /* 默认标识 */
  .default-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    background: var(--interactive-accent);
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .list-item.active .default-badge {
    background: rgba(255, 255, 255, 0.3);
  }

  /* 列表项操作按钮 */
  .item-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    background: var(--weave-border-visible);
    color: var(--text-normal);
  }

  .list-item.active .action-btn {
    color: white;
  }

  .list-item.active .action-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* 官方徽章 */
  .official-badge {
    padding: 2px 8px;
    background: var(--interactive-accent);
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .list-item.active .official-badge {
    background: rgba(255, 255, 255, 0.2);
  }

  /* 分组标题 - 带侧边颜色条 */
  .section-divider {
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .section-divider .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 8px;
    position: relative;
    padding-left: 28px;
  }

  .section-divider .section-header::before {
    content: '';
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 1.2em;
    border-radius: 2px;
  }

  .section-divider .section-title {
    flex: 1;
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* 官方提示词侧边条 - 金色 */
  .section-divider.official-section .section-header::before {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.6));
  }

  /* 自定义提示词侧边条 - 青色 */
  .section-divider.custom-section .section-header::before {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.8), rgba(8, 145, 178, 0.6));
  }

  /* 新建提示词区域 */
  .new-prompt-section {
    padding: 16px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-top: 1px solid var(--weave-border-visible);
    margin-top: 8px;
  }

  .new-prompt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    background: var(--background-primary);
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 2px dashed var(--weave-border-visible);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .new-prompt-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateY(-1px);
  }

  .new-prompt-btn:active {
    transform: translateY(0);
  }

  .new-prompt-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .new-prompt-btn:disabled:hover {
    background: var(--background-primary);
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-color: var(--weave-border-visible);
    color: var(--text-muted);
    transform: none;
  }

  /* 右侧内容区 */
  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-mode {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-bottom: 1px solid var(--weave-border-visible);
    background: var(--background-primary);
  }

  .preview-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    margin: 20px 24px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 8px;
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: 0.8125rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .copy-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .copy-btn.secondary {
    background: transparent;
  }

  .use-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--interactive-accent);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .use-btn:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
  }

  /* 编辑表单 */
  .edit-form {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 24px;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  /* 表单标签行 - 标签和徽章在同一行 */
  .form-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .form-label-row .form-label {
    margin-bottom: 0;
  }

  .form-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--background-primary); /* 🔧 显式使用主背景色，覆盖Obsidian全局样式 */
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1);
  }

  .form-textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--background-primary); /* 🔧 显式使用主背景色，覆盖Obsidian全局样式 */
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.875rem;
    font-family: var(--font-monospace);
    line-height: 1.6;
    resize: vertical;
    transition: all 0.2s ease;
  }

  .form-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1);
  }

  .form-hint {
    margin-top: 8px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 16px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-top: 1px solid var(--weave-border-visible);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: transparent;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  /* 空状态 */
  .empty-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
    padding: 60px 40px;
  }

  .empty-preview p {
    margin: 12px 0;
    font-size: 0.875rem;
  }

  /*  移除 !important：使用更具体的选择器 */
  .ai-config-modal .hint-text {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  /* AI配置面板专用样式 */
  .ai-config-panel {
    overflow-y: auto;
    padding: 20px 24px;
  }

  .validation-errors {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    margin: 16px 20px;
    background: var(--background-modifier-error);
    border: 1px solid var(--text-error);
    border-radius: 6px;
    color: var(--text-error);
    font-size: 0.85em;
  }

  .error-item {
    margin: 0;
  }

  /* 配置分组 */
  .config-section {
    margin-bottom: 20px;
    padding: 20px;
    border-radius: 8px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
  }

  /* 标题行 - 带彩色侧边条 */
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    position: relative;
    padding-left: 20px;
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

  .section-title {
    flex: 1;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  /* 多彩侧边条 - 不同配置区域使用不同颜色（已被section-indicator替代） */

  /* 底部按钮 */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-top: 1px solid var(--weave-border-visible);
    background: var(--background-primary);
    flex-shrink: 0;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: transparent;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-normal);
    color: var(--text-normal);
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    background: var(--interactive-accent);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.9em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-btn:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
  }

  .instant-save-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 12px;
    color: rgb(139, 92, 246);
    font-size: 0.75em;
    font-weight: 500;
  }

  .instant-save-badge :global(svg) {
    color: rgb(139, 92, 246);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .ai-config-modal {
      width: 95%;
      max-height: 95vh;
    }

    .modal-header {
      padding: 12px 16px;
    }

    .modal-title {
      font-size: 1.1em;
    }

    /* 移动端：底部按钮只显示图标 */
    .modal-footer .btn-label {
      display: none;
    }
    
    .reset-btn,
    .save-btn {
      padding: 10px 16px;
    }

    .panel-layout {
      flex-direction: column;
    }

    .sidebar-list {
      width: 100%;
      max-height: 200px;
      border-right: none;
      /*  使用可见边框色，修复原生主题下不显示的问题 */
      border-bottom: 1px solid var(--weave-border-visible);
    }

    .content-area {
      flex: 1;
    }

    .ai-config-panel {
      padding: 12px 16px;
    }

    .config-section {
      padding: 12px;
      margin-bottom: 16px;
    }

    .radio-group {
      flex-direction: row;
      gap: 6px;
    }

    .radio-item {
      flex: 1;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 6px;
      justify-content: center;
    }

    .radio-item .radio-label {
      font-size: 0.8rem;
    }

    .validation-errors {
      margin: 12px 16px;
    }
  }

  @media (max-width: 900px) {
    .sidebar-list {
      width: 240px;
    }

    .ai-config-panel {
      padding: 16px 16px;
    }
  }

  /* ========================================
     Phase 1 重构：桌面端样式增强
     ======================================== */
  
  /* 题型颜色变量 */
  .ai-config-modal {
    --qa-color: #3b82f6;
    --cloze-color: #10b981;
    --choice-color: #f59e0b;
    --difficulty-color: #8b5cf6;
    --count-color: #06b6d4;
    --distribution-color: #ec4899;
    --advanced-color: #6366f1;
    
    /*  修复Obsidian原生主题下边框不显示的问题 */
    /* 原生主题的 --background-modifier-border 可能是透明或与背景色相同 */
    --weave-border-color: var(--background-modifier-border, rgba(255, 255, 255, 0.1));
    --weave-border-visible: rgba(128, 128, 128, 0.3);
  }

  /* 列表项始终显示边框 */
  .list-item {
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
  }

  .list-item:hover {
    border-color: var(--interactive-accent);
  }

  .list-item.active {
    box-shadow: 0 2px 12px rgba(124, 58, 237, 0.3);
  }

  /* 卡片数量滑块全宽布局 */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .config-slider.full-width {
    flex: 1;
  }

  .slider-value-inline {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
    min-width: 60px;
    text-align: right;
  }

  /* ========================================
     配置区域指示器
     ======================================== */
  .section-indicator {
    width: 4px;
    height: 24px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .difficulty-indicator { background: var(--difficulty-color); }
  .count-indicator { background: var(--count-color); }
  .distribution-indicator { background: var(--distribution-color); }
  .advanced-indicator { background: var(--advanced-color); }

  /* 更新section-header样式以适配指示器 */
  .config-section .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-left: 0;
  }

  .config-section .section-header::before {
    display: none;
  }

  /* ========================================
     配置项样式
     ======================================== */
  .config-item {
    margin-bottom: 16px;
  }

  .config-label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  .config-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--background-primary); /* 🔧 显式使用主背景色，覆盖Obsidian全局样式 */
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .config-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1);
  }

  /* ========================================
     单选按钮组样式
     ======================================== */
  .radio-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .radio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--background-primary);
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border: 1px solid var(--weave-border-visible);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .radio-item:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .radio-item input[type="radio"] {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid var(--text-muted);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    margin: 0;
  }

  .radio-item input[type="radio"]:checked {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
  }

  .radio-item input[type="radio"]:checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
  }

  .radio-item:has(input:checked) {
    border-color: var(--interactive-accent);
    background: rgba(124, 58, 237, 0.1);
  }

  .radio-label {
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  /* ========================================
     题型分布样式
     ======================================== */
  .distribution-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .distribution-item {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .distribution-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .type-dot, .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .qa-dot { background: var(--qa-color); }
  .cloze-dot { background: var(--cloze-color); }
  .choice-dot { background: var(--choice-color); }

  .slider-container {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
  }

  .slider-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
    min-width: 50px;
    text-align: right;
  }

  /*  移除 !important：题型滑块颜色使用更具体的选择器 */
  .ai-config-modal .qa-slider::-webkit-slider-thumb { background: var(--qa-color); }
  .ai-config-modal .cloze-slider::-webkit-slider-thumb { background: var(--cloze-color); }
  .ai-config-modal .choice-slider::-webkit-slider-thumb { background: var(--choice-color); }

  .ai-config-modal .qa-slider::-moz-range-thumb { background: var(--qa-color); }
  .ai-config-modal .cloze-slider::-moz-range-thumb { background: var(--cloze-color); }
  .ai-config-modal .choice-slider::-moz-range-thumb { background: var(--choice-color); }

  /* 可视化堆叠条形图 */
  .distribution-visual {
    padding-top: 16px;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    border-top: 1px solid var(--weave-border-visible);
  }

  .stacked-bar {
    display: flex;
    height: 24px;
    border-radius: 6px;
    overflow: hidden;
    /*  使用可见边框色，修复原生主题下不显示的问题 */
    background: var(--weave-border-visible);
  }

  .bar-segment {
    height: 100%;
    transition: width 0.3s ease;
  }

  .qa-segment { background: var(--qa-color); }
  .cloze-segment { background: var(--cloze-color); }
  .choice-segment { background: var(--choice-color); }

  .bar-legend {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-top: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* ========================================
     滑块基础样式
     ======================================== */
  .config-slider {
    flex: 1;
    height: 6px;
    appearance: none;
    /*  使用可见边框色，修复原生主题下滑块轨道不显示的问题 */
    background: var(--weave-border-visible);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .config-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .config-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
  }

  .config-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  /* 可访问性：隐藏但保留屏幕阅读器访问 */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .config-fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  /* ========================================
     🔧 修复色差问题：覆盖Obsidian全局样式
     ======================================== */
  
  /* AI配置标签页中的输入框 - 使用主背景色 */
  .ai-config-panel .config-input {
    background: var(--background-primary);
  }

  .ai-config-panel .config-input:focus {
    background: var(--background-primary);
  }

  /* 预览内容区 - 确保与模态窗背景一致 */
  .preview-content {
    background: var(--background-primary);
  }

  /* 列表内容区 - 确保与模态窗背景一致 */
  .list-content {
    background: var(--background-primary);
  }

  /* ========================================
     🆕 Obsidian 移动端适配
     ======================================== */
  
  :global(body.is-mobile) .ai-config-modal {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  
  :global(body.is-mobile) .modal-footer {
    padding: 12px 16px;
  }
  
  :global(body.is-mobile) .modal-footer .btn-label {
    display: none;
  }
  
  :global(body.is-mobile) .reset-btn,
  :global(body.is-mobile) .save-btn {
    padding: 12px 20px;
    min-width: 48px;
  }

  /* 移动端提示词视图切换 */
  :global(body.is-mobile) .panel-layout.mobile-list-view {
    flex-direction: column;
  }

  :global(body.is-mobile) .panel-layout.mobile-list-view .sidebar-list {
    width: 100%;
    max-height: none;
    flex: 1;
    border-right: none;
    border-bottom: none;
    padding-left: 0;
  }

  :global(body.is-mobile) .panel-layout.mobile-list-view .content-area {
    display: none;
  }

  :global(body.is-mobile) .panel-layout.mobile-editor-view {
    flex-direction: column;
  }

  :global(body.is-mobile) .panel-layout.mobile-editor-view .sidebar-list {
    display: none;
  }

  :global(body.is-mobile) .panel-layout.mobile-editor-view .content-area {
    width: 100%;
    flex: 1;
  }

  .mobile-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    background: transparent;
    color: var(--interactive-accent);
    border: none;
    border-bottom: 1px solid var(--background-modifier-border);
    cursor: pointer;
    width: 100%;
    transition: background 0.15s ease;
  }

  .mobile-back-btn:hover {
    background: var(--background-modifier-hover);
  }

</style>


