<script lang="ts">
  /**
   * 组建增量阅读牌组模态窗 (v2.0+ 引入式架构)
   * 
   * 功能：从选中的内容块创建新的增量阅读牌组
   * - 牌组只存储内容块ID引用，不复制数据
   * - 创建后自动更新牌组的 blockIds
   */
  import { logger } from '../../utils/logger';
  import { focusManager } from '../../utils/focus-manager';
  import type { WeavePlugin } from "../../main";
  import type { IRDeck } from "../../types/ir-types";
  import { createDefaultIRDeck } from "../../types/ir-types";
  import { IRStorageService } from "../../services/incremental-reading/IRStorageService";
  import { Notice } from "obsidian";

  interface Props {
    open: boolean;
    plugin: WeavePlugin;
    /** 选中的内容块ID数组 */
    selectedBlockIds: string[];
    onClose: () => void;
    onCreated?: (deck: IRDeck) => void;
  }

  let { open, plugin, selectedBlockIds, onClose, onCreated }: Props = $props();

  // 表单状态
  let name = $state("");
  
  // 数据状态
  let isSaving = $state(false);
  let errorMessage = $state("");
  
  // DOM引用
  let nameInputRef: HTMLInputElement | null = $state(null);

  // 打开时初始化
  $effect(() => {
    if (open) {
      focusManager.saveFocus();
      
      // 重置表单
      name = '';
      errorMessage = '';
      
      // 聚焦到名称输入框
      setTimeout(() => {
        if (nameInputRef) {
          nameInputRef.focus();
        }
      }, 100);
    }
  });

  // 提交创建
  async function handleSubmit() {
    if (!name.trim() || isSaving || selectedBlockIds.length === 0) return;
    
    errorMessage = '';
    isSaving = true;
    
    try {
      // 初始化IR存储服务
      const irStorageService = new IRStorageService(plugin.app);
      await irStorageService.initialize();
      
      // 创建新牌组
      const newDeck = createDefaultIRDeck(name.trim(), selectedBlockIds, []);
      
      // 获取选中内容块的源文件列表
      const blocks = await irStorageService.getAllBlocks();
      const sourceFiles = new Set<string>();
      for (const blockId of selectedBlockIds) {
        const block = blocks[blockId];
        if (block?.filePath) {
          sourceFiles.add(block.filePath);
        }
      }
      newDeck.sourceFiles = Array.from(sourceFiles);
      
      // 保存牌组
      await irStorageService.saveDeck(newDeck);
      
      new Notice(`增量牌组“${name}”创建成功，包含 ${selectedBlockIds.length} 个内容块`);
      
      onCreated?.(newDeck);
      closeModal();
    } catch (error) {
      logger.error('[BuildIRDeckModal] 创建牌组失败:', error);
      errorMessage = error instanceof Error ? error.message : '创建失败';
      new Notice(`${errorMessage}`);
    } finally {
      isSaving = false;
    }
  }

  function closeModal() {
    name = "";
    errorMessage = "";
    
    focusManager.restoreFocus();
    
    if (typeof onClose === 'function') {
      onClose();
    }
  }
</script>

{#if open}
  <div class="modal-overlay" role="presentation" onclick={(e) => {
    if (e.target === e.currentTarget) closeModal();
  }}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="0" 
>
      <div class="modal-header">
        <h3>组建增量阅读牌组</h3>
        <button class="icon-btn" aria-label="关闭" onclick={closeModal}>×</button>
      </div>

      <div class="modal-body">
        <!-- 牌组名称 -->
        <label>
          <span>名称</span>
          <input 
            class="text-input" 
            placeholder="例如：计算机科学基础" 
            bind:value={name} 
            bind:this={nameInputRef}
          />
        </label>

        <!-- 内容块数量提示 -->
        <div class="card-count-info">
          <span>将包含 <strong>{selectedBlockIds.length}</strong> 个内容块</span>
        </div>

        <!-- 错误提示 -->
        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn" onclick={closeModal}>取消</button>
        <button 
          class="btn primary" 
          disabled={!name.trim() || isSaving || selectedBlockIds.length === 0} 
          onclick={handleSubmit}
        >
          {isSaving ? '创建中...' : '创建'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed; 
    inset: 0; 
    background: rgba(0,0,0,0.6);
    display: flex; 
    align-items: center; 
    justify-content: center;
    z-index: var(--layer-notice);
  }
  
  .modal {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.75rem; 
    width: 480px; 
    max-width: calc(100vw - 2rem);
    box-shadow: var(--anki-shadow-2xl);
    display: flex; 
    flex-direction: column;
    z-index: calc(var(--layer-notice) + 1);
  }
  
  .modal-header { 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    padding: 1rem 1rem 0.5rem; 
  }
  
  .modal-header h3 { 
    margin: 0; 
    font-size: 1.125rem; 
    font-weight: 700; 
  }
  
  .icon-btn { 
    background: transparent; 
    border: none; 
    color: var(--text-muted); 
    font-size: 1.25rem; 
    cursor: pointer; 
  }
  
  .icon-btn:hover { 
    color: var(--text-normal); 
  }
  
  .modal-body { 
    display: flex; 
    flex-direction: column; 
    gap: 0.75rem; 
    padding: 0.5rem 1rem 1rem; 
  }
  
  label { 
    display: flex; 
    flex-direction: column; 
    gap: 0.375rem; 
  }
  
  label span { 
    font-size: 0.875rem; 
    color: var(--text-muted); 
  }
  
  .text-input {
    padding: 0.625rem 0.75rem; 
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem; 
    background: var(--background-secondary); 
    color: var(--text-normal);
    font-size: 0.9rem;
  }
  
  .text-input:focus { 
    outline: none; 
    border-color: var(--interactive-accent); 
  }
  
  /* 内容块数量提示 */
  .card-count-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-secondary));
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 30%, transparent);
    border-radius: 8px;
    color: var(--text-normal);
    font-size: 0.9rem;
  }
  
  .card-count-info strong {
    color: var(--interactive-accent);
    font-weight: 600;
  }
  
  /* 错误提示 */
  .error-message {
    padding: 10px 14px;
    background: color-mix(in srgb, var(--text-error) 10%, var(--background-secondary));
    border: 1px solid color-mix(in srgb, var(--text-error) 30%, transparent);
    border-radius: 6px;
    color: var(--text-error);
    font-size: 0.85rem;
  }
  
  .modal-footer { 
    display: flex; 
    justify-content: flex-end; 
    gap: 0.5rem; 
    padding: 0 1rem 1rem; 
  }
  
  .btn { 
    padding: 0.5rem 0.9rem; 
    border-radius: 0.5rem; 
    border: 1px solid var(--background-modifier-border); 
    background: var(--background-secondary); 
    color: var(--text-normal); 
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn:hover {
    background: var(--background-modifier-hover);
  }
  
  .btn.primary { 
    background: var(--interactive-accent);
    color: var(--text-on-accent); 
    border: none;
    font-weight: 600;
  }
  
  .btn.primary:hover {
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  }
  
  .btn:disabled { 
    opacity: 0.6; 
    cursor: not-allowed; 
  }
</style>
