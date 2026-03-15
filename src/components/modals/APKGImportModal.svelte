<script lang="ts">
  /**
   * APKG 导入模态窗口
   * 使用 Weave 设计系统进行现代化重构
   * 设计风格：类 Cursor 现代化界面
   */
  import { Notice } from "obsidian";
  import type { WeavePlugin } from "../../main";
  import type { WeaveDataStorage } from "../../data/storage";
  import type { ImportProgress, ImportResult, ImportConfig } from "../../domain/apkg/types";
  import { APKGImportService } from "../../application/services/apkg/APKGImportService";
  import { ObsidianMediaStorageAdapter } from "../../infrastructure/adapters/impl/ObsidianMediaStorageAdapter";
  import { WeaveDataStorageAdapter } from "../../infrastructure/adapters/impl/WeaveDataStorageAdapter";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import ResizableModal from "../ui/ResizableModal.svelte";

  interface Props {
    show: boolean;
    dataStorage: WeaveDataStorage;
    wasmUrl: string;
    plugin: WeavePlugin;
    onClose: () => void;
    onImportComplete: (result: ImportResult) => void;
  }

  let { show = $bindable(), dataStorage, wasmUrl, plugin, onClose, onImportComplete }: Props = $props();

  // 状态管理
  type ImportStage = 'selection' | 'importing' | 'result';
  let importStage = $state<ImportStage>('selection');
  let selectedFile = $state<File | null>(null);
  // 移除了analysisResult，因为新架构不支持预览模式
  let importResult = $state<ImportResult | null>(null);
  let importProgress = $state<ImportProgress>({ stage: 'parsing', progress: 0, message: "" });
  let isImporting = $state(false);
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
        new Notice('请选择 .apkg 文件');
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
        new Notice('请选择 .apkg 文件');
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
    show = false;
    if (typeof onClose === 'function') {
      onClose();
    }
  }

</script>

<!-- 使用 ResizableModal 统一模态窗设计 -->
<ResizableModal
  bind:open={show}
  {plugin}
  title="导入 APKG 文件"
  accentColor="cyan"
  className="apkg-import-modal"
  closable={true}
  maskClosable={!isImporting}
  keyboard={!isImporting}
  onClose={closeModal}
  initialWidth={600}
  initialHeight={400}
>
  {#snippet children()}
    <div class="apkg-modal-body">
      {#if importStage === 'selection'}
        <!-- 文件选择阶段 -->
        <div class="apkg-stage apkg-selection">
          <div class="dropzone" 
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
                <EnhancedIcon name="check-circle" size={56} color="var(--color-green)" />
              </div>
              <h3 class="result-title">导入成功</h3>
              <p class="result-message">成功导入 {importResult.stats.importedCards} 张卡片</p>

              {#if importResult.deckName}
                <div class="result-details">
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
                <details class="error-collapsible">
                  <summary class="error-collapsible-trigger">
                    <EnhancedIcon name="alert-triangle" size={16} />
                    <span>查看错误信息 ({importResult.errors.length})</span>
                    <EnhancedIcon name="chevron-down" size={16} class="chevron" />
                  </summary>
                  <div class="error-collapsible-content">
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
                <EnhancedIcon name="alert-circle" size={56} color="var(--color-red)" />
              </div>
              <h3 class="result-title">导入失败</h3>
              <p class="result-message">{importResult?.errors?.[0]?.message || '未知错误'}</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 底部操作栏 -->
      {#if importStage === 'result'}
        <div class="apkg-modal-footer">
          <button class="apkg-close-btn" onclick={closeModal}>
            关闭
          </button>
        </div>
      {/if}
    </div>
  {/snippet}
</ResizableModal>

<style>
  /* ===== APKG 导入模态窗样式 ===== */

  .apkg-modal-body {
    padding: 1rem 1.5rem;
  }

  /* 阶段容器 */
  .apkg-stage {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ===== 文件选择阶段（Dropzone）===== */
  .dropzone {
    border: 2px dashed var(--background-modifier-border);
    border-radius: 8px;
    padding: 2rem 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .dropzone:hover,
  .dropzone.is-dragover {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .dropzone-title {
    margin-top: 1.25rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .dropzone-hint {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  /* ===== 导入进度阶段 ===== */
  .progress-container {
    text-align: center;
    padding: 2rem;
  }

  .progress-title {
    margin: 1.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .weave-progress {
    width: 100%;
    height: 12px;
    background: var(--background-secondary);
    border-radius: 12px;
    overflow: hidden;
    margin: 1.25rem 0;
    border: 1px solid var(--background-modifier-border);
  }

  .weave-progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--interactive-accent),
      color-mix(in srgb, var(--interactive-accent) 80%, white)
    );
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 12px;
    box-shadow: 0 0 10px color-mix(in srgb, var(--interactive-accent) 30%, transparent);
  }

  .progress-message {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  /* ===== 结果阶段 ===== */
  .result-success,
  .result-error {
    text-align: center;
    padding: 1.5rem;
  }

  .result-icon {
    margin-bottom: 1rem;
  }

  .result-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 1rem 0;
    color: var(--text-normal);
  }

  .result-message {
    font-size: 1rem;
    color: var(--text-muted);
    margin-bottom: 1.25rem;
  }

  .result-details {
    text-align: left;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-top: 1.25rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item.mod-warning {
    color: #f59e0b;
  }

  .detail-label {
    color: var(--text-muted);
  }

  .detail-value {
    font-weight: 600;
  }

  /* ===== 错误折叠组件 ===== */
  .error-collapsible {
    margin-top: 1.25rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    text-align: left;
  }

  .error-collapsible-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--background-secondary);
    cursor: pointer;
    font-weight: 600;
    transition: background 150ms;
    user-select: none;
  }

  .error-collapsible-trigger:hover {
    background: var(--background-modifier-hover);
  }

  .error-collapsible-trigger :global(.chevron) {
    margin-left: auto;
    transition: transform 150ms;
  }

  .error-collapsible[open] :global(.chevron) {
    transform: rotate(180deg);
  }

  .error-collapsible-content {
    padding: 1rem;
    background: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .failed-card {
    padding: 1rem;
    background: var(--background-secondary);
    border-left: 3px solid #f59e0b;
    border-radius: 6px;
  }

  .failed-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .failed-id {
    color: var(--text-muted);
  }

  .failed-model {
    font-weight: 600;
  }

  .failed-reason {
    color: #f59e0b;
    font-size: 0.875rem;
  }

  /* ===== 底部操作栏 ===== */
  .apkg-modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 0 0;
    border-top: 1px solid var(--background-modifier-border);
    margin-top: 1rem;
  }

  .apkg-close-btn {
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    transition: opacity 150ms;
  }

  .apkg-close-btn:hover {
    opacity: 0.9;
  }

  @media (max-width: 480px) {
    .apkg-modal-body {
      padding: 0.75rem 1rem;
    }

    .dropzone {
      padding: 1.5rem 1rem;
    }
  }
</style>
