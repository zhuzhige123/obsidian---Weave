<script lang="ts">
  import type { ParseTemplate } from '../../../../types/newCardParsingTypes';
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    template: ParseTemplate;
    onEdit: (template: ParseTemplate) => void;
    onDuplicate: (template: ParseTemplate) => void;
    onDelete: (template: ParseTemplate) => void;
  }

  let { template, onEdit, onDuplicate, onDelete }: Props = $props();

  const isOfficial = $derived(template.weaveMetadata?.source === 'official');
</script>

<div class="template-card">
  <div class="template-header">
    <h5 class="template-name">{template.name}</h5>
    {#if isOfficial}
      <span class="template-badge official">{t('dataManagement.templateMgmt.official') ?? 'Official'}</span>
    {:else}
      <span class="template-badge custom">{t('dataManagement.templateMgmt.custom') ?? 'Custom'}</span>
    {/if}
  </div>

  {#if template.description}
    <p class="template-desc">{template.description}</p>
  {/if}

  <div class="template-actions">
    <button class="btn btn-small btn-secondary" onclick={() => onEdit(template)}>
      {t('common.edit') ?? 'Edit'}
    </button>
    <button class="btn btn-small btn-secondary" onclick={() => onDuplicate(template)}>
      {t('common.duplicate') ?? 'Duplicate'}
    </button>
    {#if !isOfficial}
      <button class="btn btn-small btn-danger" onclick={() => onDelete(template)}>
        {t('common.delete') ?? 'Delete'}
      </button>
    {/if}
  </div>
</div>

<style>
  .template-card {
    padding: 16px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .template-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .template-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .template-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .template-badge.official {
    background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
    color: var(--interactive-accent);
  }

  .template-badge.custom {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .template-desc {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .template-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
</style>
