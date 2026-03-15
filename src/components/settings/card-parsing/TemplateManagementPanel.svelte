<!--
  模板管理面板组件
  职责：模板列表展示、筛选、操作管理
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';
  import { tr } from '../../../utils/i18n';

  let t = $derived($tr);

  import { Notice } from 'obsidian';
  import type { ParseTemplate } from '../../../types/newCardParsingTypes';
  import { OFFICIAL_TEMPLATES } from '../../../constants/official-templates';
  import type WeavePlugin from '../../../main';
  
  import TemplateTypeFilter from './components/TemplateTypeFilter.svelte';
  import TemplateCard from './components/TemplateCard.svelte';
  import TemplateEditorModal from './components/TemplateEditorModal.svelte';
  import HelpTooltip from './components/HelpTooltip.svelte';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';

  interface Props {
    templates: ParseTemplate[];
    onTemplatesChange: (templates: ParseTemplate[]) => void;
    plugin?: WeavePlugin;
  }

  let { templates, onTemplatesChange, plugin }: Props = $props();

  // 状态管理
  let templateSourceFilter: 'all' | 'weave' | 'anki' = $state('all');
  let showTemplateModal = $state(false);
  let editingTemplate: ParseTemplate | null = $state(null);

  // 获取所有模板（官方模板 + 用户模板） - 使用 $derived 优化性能
  const allTemplates = $derived([...OFFICIAL_TEMPLATES, ...templates]);

  // 获取过滤后的模板 - 使用 $derived 优化性能，仅按来源筛选
  const filteredTemplates = $derived(
    allTemplates.filter(template => {
      // 来源筛选
      if (templateSourceFilter === 'all') {
        return true;
      }
      
      if (templateSourceFilter === 'weave') {
        return template.weaveMetadata?.source !== 'anki_imported';
      }
      
      if (templateSourceFilter === 'anki') {
        return template.weaveMetadata?.source === 'anki_imported';
      }
      
      return true;
    })
  );

  // 打开模板编辑器
  function openTemplateModal(template?: ParseTemplate) {
    editingTemplate = template || null;
    showTemplateModal = true;
  }

  // 关闭模板编辑器
  function closeTemplateModal() {
    showTemplateModal = false;
    editingTemplate = null;
  }

  // 保存模板
  function saveTemplate(template: ParseTemplate) {
    if (editingTemplate) {
      const index = templates.findIndex(t => t.id === editingTemplate!.id);
      const newTemplates = [...templates];
      newTemplates[index] = template;
      onTemplatesChange(newTemplates);
    } else {
      onTemplatesChange([...templates, template]);
    }
  }

  // 复制模板
  function duplicateTemplate(templateId: string) {
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      const newTemplate = {
        ...template,
        id: `template_${Date.now()}`,
        name: template.name + ' ' + t('dataManagement.templateMgmt.copyLabel'),
        isDefault: false,
        isOfficial: false
      };
      onTemplatesChange([...templates, newTemplate]);
    }
  }

  // 查找使用模板的卡片
  async function findCardsUsingTemplate(templateId: string) {
    if (!plugin) {
      return [];
    }

    try {
      const allCards = await plugin.dataStorage.getAllCards();
      return allCards.filter(card => card.templateId === templateId);
    } catch (error) {
      logger.error('[TemplateManagementPanel] 查找关联卡片失败:', error);
      return [];
    }
  }

  // 删除模板（带保护机制）
  async function deleteTemplate(templateId: string) {
    // 检查是否有关联卡片
    const linkedCards = await findCardsUsingTemplate(templateId);
    
    if (linkedCards.length > 0) {
      const confirmed = await showObsidianConfirm(
        plugin!.app,
        t('dataManagement.templateMgmt.deleteLinkedWarning', { count: linkedCards.length }),
        { title: t('dataManagement.templateMgmt.confirmDelete'), confirmText: t('dataManagement.templateMgmt.deleteBtn'), confirmClass: 'mod-warning' }
      );
      
      if (!confirmed) return;
      
      // 删除关联卡片
      try {
        if (!plugin) {
          throw new Error('Plugin not available');
        }
        for (const card of linkedCards) {
          await plugin.dataStorage.deleteCard(card.uuid);
        }
      } catch (error) {
        logger.error('[TemplateManagementPanel] 删除关联卡片失败:', error);
        new Notice(t('dataManagement.templateMgmt.deleteCardsFailed'));
        return;
      }
    } else {
      // 没有关联卡片，简单确认
      const confirmed = await showObsidianConfirm(
        plugin!.app,
        t('dataManagement.templateMgmt.confirmDeleteSimple'),
        { title: t('dataManagement.templateMgmt.confirmDelete') }
      );
      if (!confirmed) {
        return;
      }
    }
    
    // 删除模板
    const newTemplates = templates.filter(t => t.id !== templateId);
    onTemplatesChange(newTemplates);
    
    // 显示通知
    if (linkedCards.length > 0) {
      new Notice(t('dataManagement.templateMgmt.deletedWithCards', { count: linkedCards.length }));
    } else {
      new Notice(t('dataManagement.templateMgmt.deletedTemplate'));
    }
  }
</script>

<div class="settings-panel">
  <!-- 模板来源筛选器 -->
  <TemplateTypeFilter
    sourceFilter={templateSourceFilter}
    onSourceFilterChange={(filter: 'all' | 'weave' | 'anki') => templateSourceFilter = filter}
  />

  <!-- 模板列表 -->
  <div class="template-grid">
    {#each filteredTemplates as template (template.id)}
      <TemplateCard
        {template}
        onEdit={(t: ParseTemplate) => openTemplateModal(t)}
        onDuplicate={(t: ParseTemplate) => duplicateTemplate(t.id)}
        onDelete={(t: ParseTemplate) => deleteTemplate(t.id)}
      />
    {/each}
  </div>
</div>

<!-- 模板编辑器模态窗 -->
<TemplateEditorModal
  isOpen={showTemplateModal}
  {editingTemplate}
  onClose={closeTemplateModal}
  onSave={saveTemplate}
/>

<style>
  .settings-panel {
    background: var(--background-primary);
    border-radius: var(--weave-radius-lg);
    padding: var(--weave-space-lg);
    border: 1px solid var(--background-modifier-border);
    width: 100%;
    box-sizing: border-box;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--weave-space-lg);
    margin-top: var(--weave-space-lg);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .template-grid {
      grid-template-columns: 1fr;
      gap: var(--weave-space-md);
    }
  }
</style>


