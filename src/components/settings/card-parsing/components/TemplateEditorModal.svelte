<script lang="ts">
  import type { ParseTemplate } from '../../../../types/newCardParsingTypes';
  import { tr } from '../../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    isOpen: boolean;
    editingTemplate: ParseTemplate | null;
    onClose: () => void;
    onSave: (template: ParseTemplate) => void;
  }

  let { isOpen, editingTemplate, onClose, onSave }: Props = $props();
</script>

{#if isOpen}
  <div class="template-editor-overlay" role="dialog">
    <div class="template-editor-modal">
      <div class="modal-header">
        <h3>{editingTemplate ? (t('dataManagement.templateMgmt.editTemplate') ?? 'Edit Template') : (t('dataManagement.templateMgmt.newTemplate') ?? 'New Template')}</h3>
        <button class="btn btn-small" onclick={onClose}>{t('common.close') ?? 'Close'}</button>
      </div>
      <div class="modal-body">
        <p class="placeholder-text">{t('dataManagement.templateMgmt.editorPlaceholder') ?? 'Template editor - coming soon'}</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .template-editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
  }

  .template-editor-modal {
    background: var(--background-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 640px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
  }

  .modal-body {
    padding: 20px;
  }

  .placeholder-text {
    color: var(--text-muted);
    text-align: center;
    padding: 40px 20px;
  }
</style>
