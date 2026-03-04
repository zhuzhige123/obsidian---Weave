<script lang="ts">
  /**
   * APKG 导入模态窗口
   * 使用 Weave 设计系统进行现代化重构
   * 设计风格：类 Cursor 现代化界面
   */
  import { onMount, onDestroy } from "svelte";
  import type { WeavePlugin } from "../../main";
  import type { WeaveDataStorage } from "../../data/storage";
  import type { ImportProgress, ImportResult, ImportConfig } from "../../domain/apkg/types";
  import { APKGImportService } from "../../application/services/apkg/APKGImportService";
  import { ObsidianMediaStorageAdapter } from "../../infrastructure/adapters/impl/ObsidianMediaStorageAdapter";
  import { WeaveDataStorageAdapter } from "../../infrastructure/adapters/impl/WeaveDataStorageAdapter";
  import { isDarkMode, createThemeListener } from "../../utils/theme-detection";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";

  interface Props {
    show: boolean;
    dataStorage: WeaveDataStorage;
    wasmUrl: string;
    plugin: WeavePlugin;
    onClose: () => void;
    onImportComplete: (result: ImportResult) => void;
  }

  let { show, dataStorage, wasmUrl, plugin, onClose, onImportComplete }: Props = $props();

  // 状态管理
  type ImportStage = 'selection' | 'importing' | 'result';
  let importStage = $state<ImportStage>('selection');
  let selectedFile = $state<File | null>(null);
  // 移除了analysisResult，因为新架构不支持预览模式
  let importResult = $state<ImportResult | null>(null);
  let importProgress = $state<ImportProgress>({ stage: 'parsing', progress: 0, message: "" });
  let isImporting = $state(false);
  let currentIsDark = $state(isDarkMode());
  let themeCleanup: (() => void) | null = null;
  let isDragOver = $state(false);
  
  // 卡片切换状态：记录每个模型当前显示的示例卡片索引
  let currentSampleIndices = $state<Record<string | number, number>>({});

  // 文件选择处理
  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      if (!file.name.toLowerCase().endsWith('.apkg')) {
        new (require('obsidian').Notice)('请选择 .apkg 文件');
        return;
      }
      selectedFile = file;
      importResult = null;
      await startImport();
    }
  }

  function selectFile() {
    if (fileInput) {
      fileInput.click();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectFile();
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.apkg')) {
        selectedFile = file;
        importResult = null;
        await startImport();
      } else {
        new (require('obsidian').Notice)('请选择 .apkg 文件');
      }
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 卡片切换辅助函数
  function nextSample(modelId: string | number, maxIndex: number) {
    const current = currentSampleIndices[modelId] || 0;
    currentSampleIndices[modelId] = (current + 1) % maxIndex;
  }

  function prevSample(modelId: string | number, maxIndex: number) {
    const current = currentSampleIndices[modelId] || 0;
    currentSampleIndices[modelId] = (current - 1 + maxIndex) % maxIndex;
  }

  function getCurrentSample(modelId: string | number) {
    return currentSampleIndices[modelId] || 0;
  }

  async function startImport() {
    if (!selectedFile) return;

    isImporting = true;
    importResult = null;
    importStage = 'importing';
    
    try {
      // 创建新的APKG导入服务
      const dataStorage = new WeaveDataStorageAdapter(plugin.dataStorage);
      const mediaStorage = new ObsidianMediaStorageAdapter(plugin);
      const importService = new APKGImportService(dataStorage, mediaStorage);

      // 配置导入参数
      const config: ImportConfig = {
        file: selectedFile,
        conversion: {
          // 使用默认转换配置
          preserveComplexTables: true,
          convertSimpleTables: true,
          mediaFormat: 'wikilink',
          clozeFormat: '==',
          preserveStyles: false,
          tableComplexityThreshold: {
            maxColumns: 10,
            maxRows: 20,
            allowMergedCells: false
          }
        },
        skipExisting: false,
        createDeckIfNotExist: true
      };

      // 执行导入
      const result = await importService.import(config, plugin, (progress) => {
        importProgress = progress;
      });

      importResult = result;
      
      importStage = 'result';

      if (result.success) {
        onImportComplete(importResult);
      }
    } catch (error) {
      importResult = {
        success: false,
        stats: { totalCards: 0, importedCards: 0, skippedCards: 0, failedCards: 0, mediaFiles: 0, mediaTotalSize: 0 },
        errors: [{ stage: 'parsing', message: error instanceof Error ? error.message : "导入失败", code: 'UNKNOWN_ERROR' }],
        warnings: [],
        duration: 0
      };
      importStage = 'result';
    } finally {
      isImporting = false;
    }
  }

  // confirmImport功能已合并到startImport中

  function resetModal() {
    importStage = 'selection';
    selectedFile = null;
    importResult = null;
  }

  function closeModal() {
    selectedFile = null;
    importResult = null;
    importProgress = { stage: 'parsing', progress: 0, message: "" };
    importStage = 'selection';
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  onMount(() => {
    themeCleanup = createThemeListener((isDark) => {
      currentIsDark = isDark;
    });
  });

  onDestroy(() => {
    if (themeCleanup) {
      themeCleanup();
    }
  });
</script>

<!-- Weave 现代化模态窗 -->
{#if show}
<div class="weave-modal-overlay" onclick={(e) => {
  // 只有点击背景区域（overlay本身）时才关闭，避免内部点击事件冒泡导致关闭
  if (e.target === e.currentTarget) {
    closeModal();
  }
}} role="presentation" tabindex="-1">
  <div class="weave-modal-content large" onclick={(e) => {
    // 只阻止特定情况，不要全局preventDefault
    if (e.target === e.currentTarget) {
      e.preventDefault();
    }
  }} onkeydown={(e) => { e.preventDefault(); }} role="dialog" aria-modal="true" aria-labelledby="apkg-modal-title" tabindex="0">
    <!-- 头部 -->
    <div class="weave-modal-header">
      <div class="weave-modal-title" id="apkg-modal-title">
        <EnhancedIcon name="package" size={24} />
        <span>导入 APKG 文件</span>
      </div>
      <button class="weave-modal-close" onclick={closeModal} aria-label="关闭">
        <EnhancedIcon name="x" size={20} />
      </button>
    </div>

    <!-- 内容区 -->
    <div class="weave-modal-body">
      {#if importStage === 'selection'}
        <!-- 文件选择阶段 -->
        <div class="apkg-stage apkg-selection">
          <div class="weave-card weave-glass dropzone" 
               class:is-dragover={isDragOver}
               onclick={() => selectFile()}
               onkeydown={handleKeyDown}
               ondragover={handleDragOver}
               ondragleave={handleDragLeave}
               ondrop={handleDrop}
               role="button"
               tabindex="0">
            <EnhancedIcon name="upload" size={56} />
            <h3 class="dropzone-title">选择或拖拽 APKG 文件</h3>
            <p class="dropzone-hint">支持 Anki 标准导出格式</p>
          </div>
          <input
            bind:this={fileInput}
            type="file"
            accept=".apkg"
            onchange={handleFileSelect}
            style="display: none"
          />
        </div>

      <!-- 移除了预览阶段，直接进入导入 -->

      {:else if importStage === 'importing'}
        <!-- 导入进度阶段 -->
        <div class="apkg-stage apkg-importing">
          <div class="progress-container">
            <div class="weave-spinner" style="width: 48px; height: 48px;"></div>
            <h3 class="progress-title">{importProgress.stage || '正在导入...'}</h3>
            <div class="weave-progress">
              <div class="weave-progress-fill" style="width: {importProgress.progress}%"></div>
            </div>
            <p class="progress-message">{importProgress.message}</p>
          </div>
        </div>

      {:else if importStage === 'result'}
        <!-- 结果阶段 -->
        <div class="apkg-stage apkg-result">
          {#if importResult?.success}
            <div class="result-success">
              <div class="result-icon">
                <EnhancedIcon name="check-circle" size={56} color="var(--weave-success)" />
              </div>
              <h3 class="result-title">导入成功</h3>
              <p class="result-message">成功导入 {importResult.stats.importedCards} 张卡片</p>

              {#if importResult.deckName}
                <div class="weave-card weave-card--flat result-details">
                  <div class="detail-item">
                    <span class="detail-label">牌组：</span>
                    <span class="detail-value">{importResult.deckName}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">成功导入：</span>
                    <span class="detail-value">{importResult.stats.importedCards} 张</span>
                  </div>
                  {#if importResult.stats.failedCards > 0}
                    <div class="detail-item mod-warning">
                      <span class="detail-label">失败：</span>
                      <span class="detail-value">{importResult.stats.failedCards} 张</span>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- 错误信息列表 -->
              {#if importResult.errors && importResult.errors.length > 0}
                <details class="weave-collapsible">
                  <summary class="weave-collapsible-trigger">
                    <EnhancedIcon name="alert-triangle" size={16} />
                    <span>查看错误信息 ({importResult.errors.length})</span>
                    <EnhancedIcon name="chevron-down" size={16} class="chevron" />
                  </summary>
                  <div class="weave-collapsible-content">
                    {#each importResult.errors as error}
                      <div class="failed-card">
                        <div class="failed-header">
                          <span class="failed-id">{error.stage}</span>
                          <span class="failed-model">{error.code}</span>
                        </div>
                        <div class="failed-reason">{error.message}</div>
                      </div>
                    {/each}
                  </div>
                </details>
              {/if}
            </div>
          {:else}
            <div class="result-error">
              <div class="result-icon">
                <EnhancedIcon name="alert-circle" size={56} color="var(--weave-error)" />
          </div>
              <h3 class="result-title">导入失败</h3>
              <p class="result-message">{importResult?.errors?.[0]?.message || '未知错误'}</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 底部操作栏 -->
    {#if importStage === 'result'}
      <div class="weave-modal-footer">
        <div class="weave-modal-footer-actions">
          <button class="weave-btn weave-btn--primary weave-btn--md" onclick={closeModal}>
            关闭
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  /* ===== APKG 模态窗口专属样式 ===== */
  /* 使用 Weave 设计系统（design-tokens.css + modern-components.css + modal-components.css） */

  /*  移除 !important：模态窗口宽度调整使用更具体的选择器 */
  :global(.weave-app .weave-modal-content.large) {
    width: min(800px, 90vw);
    max-width: 800px;
    max-height: 85vh;
  }

  /*  移除 !important：确保 overlay 正确居中 */
  :global(.weave-app .weave-modal-overlay) {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* 阶段容器 */
  .apkg-stage {
    display: flex;
    flex-direction: column;
    gap: var(--weave-space-lg, 1.25rem);
  }

  /* ===== 文件选择阶段（Dropzone）===== */
  .dropzone {
    border: 2px dashed var(--weave-border, var(--background-modifier-border));
    padding: var(--weave-space-2xl, 2rem) var(--weave-space-xl, 1.5rem);
    text-align: center;
    cursor: pointer;
    transition: all var(--weave-transition-normal, 250ms) var(--weave-ease-out, cubic-bezier(0.4, 0, 0.2, 1));
  }

  .dropzone:hover,
  .dropzone.is-dragover {
    border-color: var(--weave-accent, var(--interactive-accent));
    background: var(--weave-choice-selected, color-mix(in srgb, var(--interactive-accent) 10%, transparent));
    transform: translateY(-2px);
    box-shadow: var(--weave-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08));
  }

  .dropzone-title {
    margin-top: var(--weave-space-lg, 1.25rem);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--weave-text-normal, var(--text-normal));
  }

  .dropzone-hint {
    margin-top: var(--weave-space-sm, 0.5rem);
    font-size: 0.875rem;
    color: var(--weave-text-muted, var(--text-muted));
  }

  /* ===== 导入进度阶段 ===== */
  .progress-container {
    text-align: center;
    padding: var(--weave-space-2xl, 2rem);
  }

  .progress-title {
    margin: var(--weave-space-lg, 1.25rem) 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--weave-text-normal, var(--text-normal));
  }

  .weave-progress {
    width: 100%;
    height: 12px;
    background: var(--weave-bg-secondary, var(--background-secondary));
    border-radius: var(--weave-radius-lg, 12px);
    overflow: hidden;
    margin: var(--weave-space-lg, 1.25rem) 0;
    border: 1px solid var(--weave-border, var(--background-modifier-border));
  }

  .weave-progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--interactive-accent),
      color-mix(in srgb, var(--interactive-accent) 80%, white)
    );
    transition: width 0.3s var(--weave-ease-out, cubic-bezier(0.4, 0, 0.2, 1));
    border-radius: var(--weave-radius-lg, 12px);
    box-shadow: 0 0 10px color-mix(in srgb, var(--interactive-accent) 30%, transparent);
  }

  .progress-message {
    margin-top: var(--weave-space-md, 1rem);
    font-size: 0.875rem;
    color: var(--weave-text-muted, var(--text-muted));
  }

  /* ===== 结果阶段 ===== */
  .result-success,
  .result-error {
    text-align: center;
    padding: var(--weave-space-xl, 1.5rem);
  }

  .result-icon {
    margin-bottom: var(--weave-space-md, 1rem);
    animation: weave-fade-in 0.5s var(--weave-ease-out, cubic-bezier(0.4, 0, 0.2, 1));
  }

  .result-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: var(--weave-space-md, 1rem) 0;
    color: var(--weave-text-normal, var(--text-normal));
  }

  .result-message {
    font-size: 1rem;
    color: var(--weave-text-muted, var(--text-muted));
    margin-bottom: var(--weave-space-lg, 1.25rem);
  }

  .result-details {
    text-align: left;
    background: var(--weave-bg-secondary, var(--background-secondary));
    margin-top: var(--weave-space-lg, 1.25rem);
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    padding: var(--weave-space-sm, 0.5rem) 0;
    border-bottom: 1px solid var(--weave-border, var(--background-modifier-border));
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item.mod-warning {
    color: var(--weave-warning, #f59e0b);
  }

  .detail-label {
    color: var(--weave-text-muted, var(--text-muted));
  }

  .detail-value {
    font-weight: 600;
  }

  /* ===== 折叠组件（失败卡片列表）===== */
  .weave-collapsible {
    margin-top: var(--weave-space-lg, 1.25rem);
    border: 1px solid var(--weave-border, var(--background-modifier-border));
    border-radius: var(--weave-radius-md, 8px);
    overflow: hidden;
    text-align: left;
  }

  .weave-collapsible-trigger {
    display: flex;
    align-items: center;
    gap: var(--weave-space-sm, 0.5rem);
    padding: var(--weave-space-md, 1rem);
    background: var(--weave-bg-secondary, var(--background-secondary));
    cursor: pointer;
    font-weight: 600;
    transition: background var(--weave-transition-fast, 150ms);
    user-select: none;
  }

  .weave-collapsible-trigger:hover {
    background: var(--weave-bg-modifier, var(--background-modifier-hover));
  }

  .weave-collapsible-trigger :global(.chevron) {
    margin-left: auto;
    transition: transform var(--weave-transition-fast, 150ms);
  }

  .weave-collapsible[open] :global(.chevron) {
    transform: rotate(180deg);
  }

  .weave-collapsible-content {
    padding: var(--weave-space-md, 1rem);
    background: var(--weave-bg-primary, var(--background-primary));
    border-top: 1px solid var(--weave-border, var(--background-modifier-border));
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--weave-space-sm, 0.5rem);
  }

  .failed-card {
    padding: var(--weave-space-md, 1rem);
    background: var(--weave-bg-secondary, var(--background-secondary));
    border-left: 3px solid var(--weave-warning, #f59e0b);
    border-radius: var(--weave-radius-sm, 6px);
  }

  .failed-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--weave-space-sm, 0.5rem);
    font-size: 0.875rem;
  }

  .failed-id {
    color: var(--weave-text-muted, var(--text-muted));
  }

  .failed-model {
    font-weight: 600;
  }

  .failed-reason {
    color: var(--weave-warning, #f59e0b);
    font-size: 0.875rem;
    margin-bottom: var(--weave-space-sm, 0.5rem);
  }

  /* 已删除failed-preview相关样式 */

  /*  移除 !important：响应式设计使用更具体的选择器 */
  @media (max-width: 768px) {
    :global(.weave-app .weave-modal-content.large) {
      width: 95vw;
      max-width: 95vw;
    }

    /* 移动端预览样式已删除 */
  }

  @media (max-width: 480px) {
    :global(.weave-app .weave-modal-content.large) {
      width: 100vw;
      max-width: 100vw;
      max-height: 100vh;
      border-radius: 0;
    }

    .dropzone {
      padding: var(--weave-space-xl, 1.5rem) var(--weave-space-md, 1rem);
    }

    /* 移动端预览样式已删除 */
  }
</style>
