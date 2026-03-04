<!--
  模板编辑器模态窗组件
  职责：模板的创建和编辑（不含测试功能）
-->
<script lang="ts">
  import type { ParseTemplate, TemplateField } from '../../../../types/newCardParsingTypes';
  import FieldConfigTable from './FieldConfigTable.svelte';
  import ObsidianDropdown from '../../../ui/ObsidianDropdown.svelte';

  interface Props {
    isOpen: boolean;
    editingTemplate: ParseTemplate | null;
    onClose: () => void;
    onSave?: (template: ParseTemplate) => void;
    readonly?: boolean;
  }

  let { isOpen, editingTemplate, onClose, onSave, readonly = false }: Props = $props();

  // 模板表单状态
  let templateForm = $state({
    name: '',
    description: '',
    cardType: 'basic-qa' as 'basic-qa' | 'multiple-choice' | 'cloze-deletion' | 'other',
    type: 'single-field' as ParseTemplate['type'],  //  已移除：complete-regex 类型（已废弃）
    fields: [] as TemplateField[],
    regex: '',
    flags: 'ms',
    scenarios: [] as string[]
  });

  // 监听editingTemplate变化，更新表单
  $effect(() => {
    if (editingTemplate) {
      templateForm = {
        name: editingTemplate.name,
        description: editingTemplate.description || '',
        cardType: (editingTemplate as any).cardType || 'basic-qa',
        type: editingTemplate.type,
        fields: editingTemplate.fields ? [...editingTemplate.fields] : [],
        regex: editingTemplate.regex || '',
        flags: editingTemplate.flags || 'ms',
        scenarios: [...editingTemplate.scenarios]
      };
    } else {
      resetTemplateForm();
    }
  });

  function resetTemplateForm() {
    templateForm = {
      name: '',
      description: '',
      cardType: 'basic-qa',
      type: 'single-field',
      fields: [
        { name: 'Front', pattern: '^(.+?)(?=---div---|$)', isRegex: true, flags: 'ms', required: true },
        { name: 'Back', pattern: '(?<=---div---)(.+)$', isRegex: true, flags: 'ms', required: false }
      ],
      regex: '',
      flags: 'ms',
      scenarios: ['newCard']
    };
  }

  function handleModalClick(e: MouseEvent) {
    // 阻止事件冒泡到 overlay，防止模态窗误关闭
    // Svelte 5: 移除 stopPropagation
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="modal-overlay" 
    onclick={onClose} 
    
    role="dialog" 
    aria-modal="true" 
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal" onclick={handleModalClick} role="document" tabindex="-1">
      <div class="modal-header">
        <h3>查看模板详情</h3>
        <button class="modal-close" onclick={onClose}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label for="templateName">模板名称</label>
            <input
              type="text"
              id="templateName"
              bind:value={templateForm.name}
              placeholder="例如：基础问答卡"
              disabled={true}
            />
          </div>
          <div class="form-group">
            <label for="templateDescription">模板描述</label>
            <input
              type="text"
              id="templateDescription"
              bind:value={templateForm.description}
              placeholder="模板用途说明"
              disabled={true}
            />
          </div>
        </div>

        <!-- 题型选择 -->
        <div class="form-group">
          <label for="cardType">题型分类</label>
          <ObsidianDropdown
            options={[
              { id: 'basic-qa', label: '问答题' },
              { id: 'multiple-choice', label: '选择题' },
              { id: 'cloze-deletion', label: '挖空题' },
              { id: 'other', label: '其他' }
            ]}
            value={templateForm.cardType}
            disabled={true}
            onchange={(value) => { templateForm.cardType = value as 'basic-qa' | 'multiple-choice' | 'cloze-deletion' | 'other'; }}
          />
          <small class="help-text">此模板用于AI生成和单卡编辑</small>
        </div>

        <!-- 解析模式说明（只读显示） -->
        <div class="form-group">
          <h4>解析模式</h4>
          <div class="info-box">
            <strong>单字段解析</strong>
            <p>此模板使用单字段解析模式，适用于AI生成和单卡编辑场景。</p>
            <p class="note">批量解析功能已迁移到“分隔符配置”标签页。</p>
          </div>
        </div>

        <!-- 字段配置（只读） -->
        {#if templateForm.type === 'single-field' && templateForm.fields}
          <div class="form-group">
            <h4>字段配置</h4>
            <div class="fields-readonly">
              {#each templateForm.fields as field}
                <div class="field-item">
                  <div class="field-name">{field.name}</div>
                  <div class="field-pattern">
                    <code>{field.pattern}</code>
                  </div>
                  <div class="field-meta">
                    {#if field.isRegex}
                      <span class="meta-tag">正则</span>
                    {/if}
                    {#if field.required}
                      <span class="meta-tag">必需</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={onClose}>关闭</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* 模态窗样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
  }

  .modal {
    background: var(--background-primary);
    border-radius: 12px;
    width: 95%;
    max-width: 1200px;
    max-height: 95vh;
    overflow: hidden;
    border: 1px solid var(--background-modifier-border);
  }

  .modal-header {
    background: var(--background-secondary);
    padding: 20px;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h3 {
    color: var(--text-normal);
    margin: 0;
    font-size: 18px;
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-body {
    padding: 25px;
    max-height: calc(90vh - 140px);
    overflow-y: auto;
  }

  .modal-footer {
    background: var(--background-secondary);
    padding: 15px 20px;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .form-group input[type="text"] {
    width: 100%;
    padding: 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 14px;
    transition: border-color 0.2s;
  }

  .form-group input[type="text"]:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .form-group h4 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .help-text {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.3;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  /* 信息框样式 */
  .info-box {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05));
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--weave-radius-md);
    padding: var(--weave-space-md);
  }

  .info-box strong {
    display: block;
    margin-bottom: 8px;
    color: var(--text-normal);
  }

  .info-box p {
    margin: 4px 0;
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .info-box .note {
    margin-top: 8px;
    color: var(--text-accent);
    font-weight: 500;
  }

  /* 只读字段显示 */
  .fields-readonly {
    display: flex;
    flex-direction: column;
    gap: var(--weave-space-sm);
  }

  .field-item {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--weave-radius-sm);
    padding: var(--weave-space-sm);
  }

  .field-name {
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .field-pattern {
    margin: 4px 0;
  }

  .field-pattern code {
    font-family: var(--font-monospace);
    font-size: 0.85rem;
    color: var(--text-muted);
    background: var(--background-secondary);
    padding: 2px 6px;
    border-radius: 3px;
    word-break: break-all;
  }

  .field-meta {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .meta-tag {
    display: inline-block;
    padding: 2px 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
      gap: var(--weave-space-sm);
    }

    .modal {
      width: 95%;
      margin: 10px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-body {
      padding: var(--weave-space-md);
    }
  }
</style>

