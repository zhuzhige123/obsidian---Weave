<script lang="ts">
  import type { FilterConfig } from "../../types/filter-types";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import { filterManager } from "../../services/filter-manager";
  //  导入国际化
  import { tr } from '../../utils/i18n';

  interface Props {
    visible: boolean;
    filterConfig: FilterConfig;
    onSave: (name: string, description: string, icon: string, color: string, isPinned: boolean) => void;
    onClose: () => void;
  }

  let { visible, filterConfig, onSave, onClose   }: Props = $props();

  //  响应式翻译函数
  let t = $derived($tr);

  // 表单状态
  let filterName = $state("");
  let filterDescription = $state("");
  let selectedIcon = $state("filter");
  let selectedColor = $state("var(--interactive-accent)");
  let isPinned = $state(false);
  let nameError = $state("");

  // 图标选项
  let iconOptions = $derived([
    { value: "filter", label: t('modals.saveFilter.iconFilter') },
    { value: "star", label: t('modals.saveFilter.iconStar') },
    { value: "bookmark", label: t('modals.saveFilter.iconBookmark') },
    { value: "tag", label: t('modals.saveFilter.iconTag') },
    { value: "heart", label: t('modals.saveFilter.iconHeart') },
    { value: "flag", label: t('modals.saveFilter.iconFlag') },
    { value: "circle-dot", label: t('modals.saveFilter.iconCircleDot') },
    { value: "check-circle", label: t('modals.saveFilter.iconCheckCircle') },
    { value: "clock", label: t('modals.saveFilter.iconClock') },
    { value: "calendar", label: t('modals.saveFilter.iconCalendar') },
    { value: "book", label: t('modals.saveFilter.iconBook') },
    { value: "layers", label: t('modals.saveFilter.iconLayers') }
  ]);

  // 颜色选项
  let colorOptions = $derived([
    { value: "#3b82f6", label: t('modals.saveFilter.colorBlue') },
    { value: "var(--interactive-accent)", label: t('modals.saveFilter.colorTheme') },
    { value: "#ec4899", label: t('modals.saveFilter.colorPink') },
    { value: "#ef4444", label: t('modals.saveFilter.colorRed') },
    { value: "#f59e0b", label: t('modals.saveFilter.colorOrange') },
    { value: "#10b981", label: t('modals.saveFilter.colorGreen') },
    { value: "#06b6d4", label: t('modals.saveFilter.colorCyan') },
    { value: "#6b7280", label: t('modals.saveFilter.colorGray') }
  ]);

  // 重置表单
  function resetForm() {
    filterName = "";
    filterDescription = "";
    selectedIcon = "filter";
    selectedColor = "var(--interactive-accent)";
    isPinned = false;
    nameError = "";
  }

  // 当对话框打开时重置表单
  $effect(() => {
    if (visible) {
      resetForm();
    }
  });

  // 验证表单
  function validateForm(): boolean {
    nameError = "";

    if (!filterName.trim()) {
      nameError = t('modals.saveFilter.nameError');
      return false;
    }

    if (filterName.trim().length > 50) {
      nameError = t('modals.saveFilter.nameTooLong');
      return false;
    }

    return true;
  }

  // 保存筛选器
  function handleSave() {
    if (!validateForm()) {
      return;
    }

    onSave(
      filterName.trim(),
      filterDescription.trim(),
      selectedIcon,
      selectedColor,
      isPinned
    );

    resetForm();
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  // 取消
  function handleCancel() {
    resetForm();
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }

    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }
</script>

{#if visible}
  <div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeydown} role="presentation" tabindex="-1">
    <div 
      class="save-filter-modal" 
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- 头部 -->
      <header class="modal-header">
        <div class="header-title">
          <EnhancedIcon name="save" size={20} />
          <h3>{t('modals.saveFilter.title')}</h3>
        </div>
        <button class="close-btn" onclick={handleCancel}>
          <EnhancedIcon name="x" size={20} />
        </button>
      </header>

      <!-- 主体内容 -->
      <div class="modal-content">
        <!-- 名称输入 -->
        <div class="form-group">
          <label for="filter-name" class="form-label required">
            {t('modals.saveFilter.name')}
          </label>
          <input
            id="filter-name"
            type="text"
            class="form-input"
            class:error={nameError}
            bind:value={filterName}
            placeholder={t('modals.saveFilter.namePlaceholder')}
            maxlength="50"
          />
          {#if nameError}
            <span class="error-message">{nameError}</span>
          {/if}
        </div>

        <!-- 描述输入 -->
        <div class="form-group">
          <label for="filter-desc" class="form-label">
            {t('modals.saveFilter.description')}
          </label>
          <textarea
            id="filter-desc"
            class="form-textarea"
            bind:value={filterDescription}
            placeholder={t('modals.saveFilter.descriptionPlaceholder')}
            rows="3"
            maxlength="200"
          ></textarea>
        </div>

        <!-- 图标选择 -->
        <div class="form-group">
          <div class="form-label">{t('modals.saveFilter.icon')}</div>
          <div class="icon-grid">
            {#each iconOptions as icon}
              <button
                class="icon-option"
                class:selected={selectedIcon === icon.value}
                onclick={() => selectedIcon = icon.value}
                title={icon.label}
              >
                <EnhancedIcon name={icon.value} size={20} />
              </button>
            {/each}
          </div>
        </div>

        <!-- 颜色选择 -->
        <div class="form-group">
          <div class="form-label">{t('modals.saveFilter.color')}</div>
          <div class="color-grid">
            {#each colorOptions as color}
              <button
                class="color-option"
                class:selected={selectedColor === color.value}
                style:background-color={color.value}
                onclick={() => selectedColor = color.value}
                title={color.label}
              >
                {#if selectedColor === color.value}
                  <EnhancedIcon name="check" size={16} />
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- 固定选项 -->
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={isPinned}
            />
            <span>固定到快捷筛选栏</span>
            <span class="hint">（固定后可在筛选栏快速访问）</span>
          </label>
        </div>

        <!-- 预览 -->
        <div class="preview-section">
          <div class="preview-label">预览：</div>
          <div class="filter-preview">
            <button 
              class="preview-badge"
              style:border-color={selectedColor}
            >
              <EnhancedIcon name={selectedIcon} size={14} />
              <span>{filterName || "筛选器名称"}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <footer class="modal-footer">
        <div class="footer-hint">
          <EnhancedIcon name="info-circle" size={14} />
          <span>Ctrl + Enter 保存 / Esc 取消</span>
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" onclick={handleCancel}>
            {t('modals.saveFilter.cancel')}
          </button>
          <button class="btn-primary" onclick={handleSave}>
            <EnhancedIcon name="save" size={16} />
            <span>{t('modals.saveFilter.save')}</span>
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: var(--weave-z-popup);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .save-filter-modal {
    width: 100%;
    max-width: 500px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-l);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-title h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: var(--radius-s);
    display: flex;
    align-items: center;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .form-label.required::after {
    content: " *";
    color: var(--text-error);
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: 0.875rem;
    font-family: inherit;
    transition: border-color 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .form-input.error {
    border-color: var(--text-error);
  }

  .form-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .error-message {
    font-size: 0.75rem;
    color: var(--text-error);
  }

  .icon-grid,
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
    gap: 0.5rem;
  }

  .icon-option,
  .color-option {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary);
    border: 2px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .icon-option:hover,
  .color-option:hover {
    border-color: var(--interactive-accent);
    transform: scale(1.05);
  }

  .icon-option.selected,
  .color-option.selected {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .color-option {
    position: relative;
    color: white;
  }

  .color-option.selected {
    box-shadow: 0 0 0 2px var(--background-primary),
                0 0 0 4px var(--interactive-accent);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }

  .preview-section {
    padding: 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .preview-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .filter-preview {
    display: flex;
    justify-content: center;
  }

  .preview-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.75rem;
    background: var(--background-primary);
    border: 1.5px solid;
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .modal-footer {
    border-top: 1px solid var(--background-modifier-border);
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-secondary,
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: var(--radius-s);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .modal-overlay {
      padding: 0;
    }

    .save-filter-modal {
      max-width: 100%;
      border-radius: 0;
    }

    .footer-hint {
      display: none;
    }
  }
</style>

