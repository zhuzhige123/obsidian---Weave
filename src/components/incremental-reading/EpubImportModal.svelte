<!--
  EpubImportModal - EPUB TOC -> IR 任务导入模态窗
  
  3步骤流程：
  1. 选择 EPUB 文件 + 目标 IR 牌组
  2. 配置拆分层级（TOC level 选择）
  3. 预览确认并导入

  @module components/incremental-reading/EpubImportModal
  @version 1.0.0
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { TFile, Notice } from 'obsidian';
  import type { App } from 'obsidian';
  import { setIcon } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import { EpubReaderService } from '../../services/epub/EpubReaderService';
  import { IREpubBookmarkTaskService } from '../../services/incremental-reading/IREpubBookmarkTaskService';
  import { IRImportSchedulingService, type IRLoadInfo } from '../../services/incremental-reading/IRImportSchedulingService';
  import type { TocItem } from '../../services/epub/types';
  import type { IRDeck } from '../../types/ir-types';
  import { logger } from '../../utils/logger';
  import ResizableModal from '../ui/ResizableModal.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  interface Props {
    plugin: WeavePlugin;
    open: boolean;
    onClose: () => void;
    onImportComplete?: (result: { success: number; skipped: number }) => void;
    /** Pre-selected EPUB file path (if opened from EPUB reader context) */
    preselectedEpubPath?: string;
  }

  let { plugin, open = $bindable(), onClose, onImportComplete, preselectedEpubPath }: Props = $props();

  type Step = 'select' | 'split' | 'confirm';

  function icon(node: HTMLElement, name: string) {
    setIcon(node, name);
    return {
      update(newName: string) {
        node.innerHTML = '';
        setIcon(node, newName);
      }
    };
  }

  // --- State ---
  let currentStep = $state<Step>('select');
  let epubFiles = $state<TFile[]>([]);
  let selectedEpubPath = $state(preselectedEpubPath || '');
  let irDecks = $state<IRDeck[]>([]);
  let selectedDeckId = $state('');

  // Split config
  let maxTocLevel = $state(0);
  let splitLevel = $state(0);
  let filterShortChapters = $state(false);
  let shortChapterThreshold = $state(0);

  // TOC data
  let tocTree = $state<TocItem[]>([]);
  let flattenedItems = $state<FlatTocItem[]>([]);
  let selectedItems = $state<Set<string>>(new Set());

  // Import
  let importing = $state(false);
  let importProgress = $state({ current: 0, total: 0 });
  let loadingToc = $state(false);

  interface FlatTocItem {
    id: string;
    label: string;
    href: string;
    level: number;
  }

  // --- Load data on mount ---
  onMount(() => {
    loadEpubFiles();
    loadIRDecks();
  });

  function loadEpubFiles() {
    const files = plugin.app.vault.getFiles().filter(f => f.extension === 'epub');
    epubFiles = files.sort((a, b) => a.basename.localeCompare(b.basename));
  }

  async function loadIRDecks() {
    try {
      const storageService = (plugin as any).irStorageService || (plugin as any)._irStorageService;
      if (storageService?.getAllDecks) {
        const decksStore = await storageService.getAllDecks();
        irDecks = Object.values(decksStore).filter((d: any) => !d.archivedAt) as IRDeck[];
      } else {
        const v4Scheduler = (plugin as any).irV4SchedulerService || (plugin as any)._irV4SchedulerService;
        if (v4Scheduler) {
          await v4Scheduler.initialize();
          const adapter = v4Scheduler.getStorageAdapter();
          if (adapter?.getAllDecks) {
            const allDecks = await adapter.getAllDecks();
            irDecks = Object.values(allDecks).filter((d: any) => !d.archivedAt) as IRDeck[];
          }
        }
      }
    } catch (e) {
      logger.warn('[EpubImportModal] Failed to load IR decks:', e);
      irDecks = [];
    }
  }

  // --- Step 1 -> Step 2: Load TOC ---
  async function loadToc() {
    if (!selectedEpubPath) return;

    loadingToc = true;
    try {
      const readerService = new EpubReaderService(plugin.app);
      await readerService.loadEpub(selectedEpubPath);
      tocTree = await readerService.getTableOfContents();
      readerService.destroy();

      // Determine max TOC depth
      maxTocLevel = getMaxDepth(tocTree);
      splitLevel = Math.min(1, maxTocLevel);

      // Flatten and select all
      updateFlattenedItems();
    } catch (e) {
      logger.error('[EpubImportModal] Failed to load TOC:', e);
      new Notice(`Failed to load EPUB TOC: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      loadingToc = false;
    }
  }

  function getMaxDepth(items: TocItem[]): number {
    let max = 0;
    for (const item of items) {
      max = Math.max(max, item.level);
      if (item.subitems && item.subitems.length > 0) {
        max = Math.max(max, getMaxDepth(item.subitems));
      }
    }
    return max;
  }

  function flattenToc(items: TocItem[], maxLevel: number): FlatTocItem[] {
    const result: FlatTocItem[] = [];
    const walk = (list: TocItem[]) => {
      for (const item of list) {
        if (item.level <= maxLevel) {
          result.push({
            id: item.id,
            label: item.label,
            href: item.href,
            level: item.level
          });
        }
        if (item.subitems && item.subitems.length > 0) {
          walk(item.subitems);
        }
      }
    };
    walk(items);
    return result;
  }

  function updateFlattenedItems() {
    flattenedItems = flattenToc(tocTree, splitLevel);
    selectedItems = new Set(flattenedItems.map(i => i.id));
  }

  function toggleItem(id: string) {
    const next = new Set(selectedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedItems = next;
  }

  function selectAll() {
    selectedItems = new Set(flattenedItems.map(i => i.id));
  }

  function deselectAll() {
    selectedItems = new Set();
  }

  // --- Navigation ---
  async function goToStep2() {
    if (!selectedEpubPath || !selectedDeckId) {
      new Notice('Please select an EPUB file and target deck');
      return;
    }
    await loadToc();
    currentStep = 'split';
  }

  function goToStep3() {
    updateFlattenedItems();
    if (selectedItems.size === 0) {
      new Notice('Please select at least one chapter');
      return;
    }
    currentStep = 'confirm';
  }

  function goBack() {
    if (currentStep === 'split') currentStep = 'select';
    else if (currentStep === 'confirm') currentStep = 'split';
  }

  // --- Import ---
  async function handleImport() {
    if (selectedItems.size === 0 || !selectedDeckId || !selectedEpubPath) return;

    importing = true;
    const itemsToImport = flattenedItems.filter(i => selectedItems.has(i.id));
    importProgress = { current: 0, total: itemsToImport.length };

    try {
      const epubService = new IREpubBookmarkTaskService(plugin.app);
      await epubService.initialize();

      // Check for existing tasks to avoid duplicates
      const existing = await epubService.getTasksByEpub(selectedEpubPath);
      const existingHrefs = new Set(existing.filter(t => t.deckId === selectedDeckId).map(t => t.tocHref));

      // Calculate scheduling spread
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const newItems = itemsToImport.filter(i => !existingHrefs.has(i.href));

      const inputs = newItems.map((item, idx) => {
        // Spread tasks across days: ~3-5 per day
        const dayOffset = Math.floor(idx / 4);
        const nextRepDate = new Date(startDate);
        nextRepDate.setDate(nextRepDate.getDate() + dayOffset);

        return {
          deckId: selectedDeckId,
          epubFilePath: selectedEpubPath,
          title: item.label,
          tocHref: item.href,
          tocLevel: item.level,
          priorityUi: 5,
          nextRepDate: nextRepDate.getTime()
        };
      });

      const created = await epubService.batchCreateTasks(inputs);

      const success = created.length;
      const skipped = itemsToImport.length - newItems.length;

      importProgress = { current: itemsToImport.length, total: itemsToImport.length };

      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));

      new Notice(`EPUB IR import: ${success} created, ${skipped} skipped (duplicate)`);
      onImportComplete?.({ success, skipped });
      onClose();
    } catch (e) {
      logger.error('[EpubImportModal] Import failed:', e);
      new Notice(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      importing = false;
    }
  }

  // Reactive: when splitLevel changes, re-flatten
  $effect(() => {
    if (tocTree.length > 0) {
      updateFlattenedItems();
    }
  });

  let selectedCount = $derived(selectedItems.size);
  let totalCount = $derived(flattenedItems.length);
  let stepNumber = $derived(currentStep === 'select' ? 1 : currentStep === 'split' ? 2 : 3);
  let selectedEpubName = $derived(
    selectedEpubPath ? selectedEpubPath.split('/').pop()?.replace('.epub', '') || '' : ''
  );
  let selectedDeckName = $derived(
    irDecks.find(d => d.id === selectedDeckId)?.name || ''
  );
</script>

<ResizableModal
  {plugin}
  {open}
  {onClose}
  title="EPUB Incremental Reading Import"
  accentColor="cyan"
  initialWidth={560}
  initialHeight={520}
>
  <div class="epub-import-modal">
    <!-- Step indicator -->
    <div class="epub-import-steps">
      {#each [{ n: 1, label: 'Select' }, { n: 2, label: 'Split' }, { n: 3, label: 'Confirm' }] as step}
        <div class="step-item" class:active={stepNumber === step.n} class:done={stepNumber > step.n}>
          <span class="step-number">{step.n}</span>
          <span class="step-label">{step.label}</span>
        </div>
        {#if step.n < 3}
          <div class="step-line" class:active={stepNumber > step.n}></div>
        {/if}
      {/each}
    </div>

    <!-- Step 1: Select EPUB + Deck -->
    {#if currentStep === 'select'}
      <div class="epub-import-body">
        <div class="form-group">
          <label class="form-label" for="epub-import-file-select">EPUB File</label>
          <select id="epub-import-file-select" class="form-select" bind:value={selectedEpubPath}>
            <option value="">-- Select EPUB --</option>
            {#each epubFiles as file}
              <option value={file.path}>{file.basename}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="epub-import-deck-select">Target IR Deck</label>
          <select id="epub-import-deck-select" class="form-select" bind:value={selectedDeckId}>
            <option value="">-- Select Deck --</option>
            {#each irDecks as deck}
              <option value={deck.id}>{deck.name}</option>
            {/each}
          </select>
        </div>

        {#if epubFiles.length === 0}
          <div class="empty-hint">
            <ObsidianIcon name="book-open" size={20} />
            <span>No EPUB files found in vault</span>
          </div>
        {/if}
      </div>

      <div class="epub-import-footer">
        <button class="mod-cta" disabled={!selectedEpubPath || !selectedDeckId} onclick={goToStep2}>
          Next
          <span use:icon={'arrow-right'}></span>
        </button>
      </div>

    <!-- Step 2: Configure split level -->
    {:else if currentStep === 'split'}
      <div class="epub-import-body">
        {#if loadingToc}
          <div class="loading-hint">Loading TOC...</div>
        {:else}
          <div class="split-config">
            <div class="form-group">
              <div class="form-label">TOC Split Level</div>
              <div class="level-selector">
                {#each Array.from({ length: maxTocLevel + 1 }, (_, i) => i) as lvl}
                  <button
                    class="level-btn"
                    class:active={splitLevel === lvl}
                    onclick={() => { splitLevel = lvl; }}
                  >
                    L{lvl}
                  </button>
                {/each}
              </div>
              <div class="form-hint">
                Level 0 = top chapters only, higher = deeper sections. Found {totalCount} items at L{splitLevel}.
              </div>
            </div>
          </div>

          <!-- TOC Preview with checkboxes -->
          <div class="toc-preview">
            <div class="toc-toolbar">
              <button class="toc-action" onclick={selectAll}>Select All</button>
              <button class="toc-action" onclick={deselectAll}>Deselect All</button>
              <span class="toc-count">{selectedCount}/{totalCount}</span>
            </div>
            <div class="toc-list">
              {#each flattenedItems as item}
                <label
                  class="toc-item"
                  style="padding-left: {12 + item.level * 16}px"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onchange={() => toggleItem(item.id)}
                  />
                  <span class="toc-item-label">{item.label}</span>
                </label>
              {/each}
              {#if flattenedItems.length === 0}
                <div class="empty-hint">
                  <span>No TOC items found at this level</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="epub-import-footer">
        <button class="mod-secondary" onclick={goBack}>
          <span use:icon={'arrow-left'}></span>
          Back
        </button>
        <button class="mod-cta" disabled={selectedCount === 0} onclick={goToStep3}>
          Next
          <span use:icon={'arrow-right'}></span>
        </button>
      </div>

    <!-- Step 3: Confirm -->
    {:else if currentStep === 'confirm'}
      <div class="epub-import-body">
        <div class="confirm-summary">
          <div class="summary-row">
            <span class="summary-label">EPUB</span>
            <span class="summary-value">{selectedEpubName}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Deck</span>
            <span class="summary-value">{selectedDeckName}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Chapters to import</span>
            <span class="summary-value accent">{selectedCount}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Split level</span>
            <span class="summary-value">L{splitLevel}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Scheduling</span>
            <span class="summary-value">~{Math.ceil(selectedCount / 4)} days spread</span>
          </div>
        </div>

        <div class="confirm-items">
          <div class="confirm-items-title">Items to import:</div>
          <div class="confirm-items-list">
            {#each flattenedItems.filter(i => selectedItems.has(i.id)) as item}
              <div class="confirm-item" style="padding-left: {8 + item.level * 12}px">
                <ObsidianIcon name="bookmark" size={14} />
                <span>{item.label}</span>
              </div>
            {/each}
          </div>
        </div>

        {#if importing}
          <div class="import-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {importProgress.total > 0 ? (importProgress.current / importProgress.total * 100) : 0}%"></div>
            </div>
            <span class="progress-text">{importProgress.current}/{importProgress.total}</span>
          </div>
        {/if}
      </div>

      <div class="epub-import-footer">
        <button class="mod-secondary" onclick={goBack} disabled={importing}>
          <span use:icon={'arrow-left'}></span>
          Back
        </button>
        <button class="mod-cta" onclick={handleImport} disabled={importing || selectedCount === 0}>
          {#if importing}
            Importing...
          {:else}
            Import {selectedCount} chapters
          {/if}
        </button>
      </div>
    {/if}
  </div>
</ResizableModal>

<style>
  .epub-import-modal {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0;
  }

  .epub-import-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    gap: 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0.4;
    transition: opacity 0.2s;
  }
  .step-item.active,
  .step-item.done {
    opacity: 1;
  }

  .step-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }
  .step-item.active .step-number {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  .step-item.done .step-number {
    background: var(--text-success);
    color: white;
  }

  .step-label {
    font-size: 13px;
    color: var(--text-muted);
  }
  .step-item.active .step-label {
    color: var(--text-normal);
    font-weight: 500;
  }

  .step-line {
    width: 32px;
    height: 2px;
    background: var(--background-modifier-border);
    margin: 0 8px;
    transition: background 0.2s;
  }
  .step-line.active {
    background: var(--text-success);
  }

  .epub-import-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .epub-import-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .epub-import-footer button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    border: none;
  }
  .epub-import-footer .mod-cta {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  .epub-import-footer .mod-cta:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .epub-import-footer .mod-secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }
  .form-select {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }
  .form-hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .loading-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: var(--text-muted);
  }

  .level-selector {
    display: flex;
    gap: 4px;
  }
  .level-btn {
    padding: 4px 12px;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .level-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .toc-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    min-height: 150px;
  }
  .toc-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }
  .toc-action {
    font-size: 11px;
    color: var(--text-accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .toc-action:hover {
    background: var(--background-modifier-hover);
  }
  .toc-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
  }
  .toc-list {
    flex: 1;
    overflow-y: auto;
    max-height: 250px;
  }
  .toc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
    transition: background 0.1s;
  }
  .toc-item:hover {
    background: var(--background-modifier-hover);
  }
  .toc-item input[type="checkbox"] {
    flex-shrink: 0;
  }
  .toc-item-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .confirm-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  .summary-label {
    color: var(--text-muted);
  }
  .summary-value {
    color: var(--text-normal);
    font-weight: 500;
  }
  .summary-value.accent {
    color: var(--text-accent);
  }

  .confirm-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .confirm-items-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }
  .confirm-items-list {
    overflow-y: auto;
    max-height: 200px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }
  .confirm-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--text-normal);
  }
  .confirm-item:nth-child(even) {
    background: var(--background-secondary-alt);
  }

  .import-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }
  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.2s;
  }
  .progress-text {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }
</style>
