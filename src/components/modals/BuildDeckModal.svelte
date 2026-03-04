<script lang="ts">
  /**
   * 组建牌组模态窗 (v2.0+ 平级牌组架构)
   * 
   * 功能：从选中的卡片创建新的引用式牌组
   * - 牌组只存储卡片UUID引用，不复制卡片数据
   * - 支持设置名称和标签
   * - 创建后自动更新卡片的 we_decks
   * 
   * ⚠️ v2.0+ 平级架构：已移除父牌组选择功能
   */
  import { logger } from '../../utils/logger';
  import { focusManager } from '../../utils/focus-manager';
  import type { WeavePlugin } from "../../main";
  import type { Deck } from "../../data/types";
  import { Notice } from "obsidian";
  import { tr } from '../../utils/i18n';
  import { generateId } from '../../utils/helpers';

  interface Props {
    open: boolean;
    plugin: WeavePlugin;
    /** 选中的卡片UUID数组 */
    selectedCardUUIDs: string[];
    pairedMemoryDeckId?: string | null;
    onClose: () => void;
    onCreated?: (deck: Deck) => void;
  }

  let { open, plugin, selectedCardUUIDs, pairedMemoryDeckId, onClose, onCreated }: Props = $props();

  // 响应式翻译
  let t = $derived($tr);

  // 表单状态
  let name = $state("");
  let selectedTag = $state<string>("");
  let tagInput = $state("");
  let buildTarget = $state<'memory' | 'question-bank'>('memory');
  
  // 数据状态
  let availableDecks = $state<Deck[]>([]);
  let availableTags = $state<string[]>([]);
  let isSaving = $state(false);
  let errorMessage = $state("");
  
  // DOM引用
  let nameInputRef: HTMLInputElement | null = $state(null);

  let choiceQuestionUUIDs = $state<string[]>([]);

  // 打开时初始化
  $effect(() => {
    if (open) {
      focusManager.saveFocus();
      
      (async () => {
        try {
          await loadAvailableDecks();
          loadAvailableTags();
          
          // 重置表单
          name = '';
          selectedTag = '';
          tagInput = '';
          errorMessage = '';
          buildTarget = 'memory';
          choiceQuestionUUIDs = [];
          
          // 聚焦到名称输入框
          setTimeout(() => {
            if (nameInputRef) {
              nameInputRef.focus();
            }
          }, 100);
        } catch (error) {
          logger.error('[BuildDeckModal] 初始化失败:', error);
          new Notice('初始化失败');
        }
      })();
    }
  });

  $effect(() => {
    if (!open) return;
    if (buildTarget !== 'question-bank') return;

    (async () => {
      try {
        const allCards = await plugin.dataStorage.getCards();
        const cardByUuid = new Map<string, (typeof allCards)[number]>();
        for (const c of allCards) {
          cardByUuid.set(c.uuid, c);
        }

        const selectedCards = selectedCardUUIDs
          .map((uuid) => cardByUuid.get(uuid))
          .filter((c): c is (typeof allCards)[number] => c !== undefined);
        const { parseChoiceQuestion } = await import('../../parsing/choice-question-parser');
        const uuids = selectedCards
          .filter((c) => {
            const parsed = parseChoiceQuestion(c.content);
            return !!parsed;
          })
          .map((c) => c.uuid);
        choiceQuestionUUIDs = uuids;
      } catch (error) {
        logger.error('[BuildDeckModal] 选择题筛选失败:', error);
        choiceQuestionUUIDs = [];
      }
    })();
  });

  function toggleBuildTarget() {
    buildTarget = buildTarget === 'memory' ? 'question-bank' : 'memory';
  }

  // 加载可用牌组列表
  async function loadAvailableDecks() {
    try {
      const result = await plugin.dataStorage.getDecks();
      availableDecks = result;
    } catch (error) {
      logger.error('[BuildDeckModal] 加载牌组失败:', error);
      availableDecks = [];
    }
  }
  
  // 加载所有现有标签
  function loadAvailableTags() {
    const allTags = new Set<string>();
    availableDecks.forEach(deck => {
      if (deck.tags && Array.isArray(deck.tags)) {
        deck.tags.forEach(tag => allTags.add(tag));
      }
    });
    availableTags = Array.from(allTags).sort();
  }
  
  // 选择标签（单选）
  function selectTag(tag: string) {
    const trimmedTag = tag.trim();
    if (trimmedTag) {
      selectedTag = trimmedTag;
      tagInput = '';
      
      if (!availableTags.includes(trimmedTag)) {
        availableTags = [...availableTags, trimmedTag].sort();
      }
    }
  }
  
  // 处理标签输入
  function handleTagInput(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        selectTag(tagInput);
      }
    } else if (e.key === 'Backspace' && tagInput === '' && selectedTag) {
      e.preventDefault();
      selectedTag = '';
    }
  }
  
  // 清除标签
  function clearTag() {
    selectedTag = '';
  }

  // 提交创建
  async function handleSubmit() {
    if (!name.trim() || isSaving || selectedCardUUIDs.length === 0) return;

    if (buildTarget === 'question-bank' && choiceQuestionUUIDs.length === 0) return;
    
    errorMessage = '';
    isSaving = true;
    
    try {
      if (buildTarget === 'memory') {
        if (!plugin.referenceDeckService) {
          throw new Error('引用式牌组服务未初始化');
        }

        const result = await plugin.referenceDeckService.createDeckFromCards({
          name: name.trim(),
          tag: selectedTag || undefined,
          cardUUIDs: selectedCardUUIDs
        });
        
        if (!result.success) {
          throw new Error(result.error || '创建失败');
        }
        
        new Notice(`牌组“${name}”创建成功，引用了 ${selectedCardUUIDs.length} 张卡片`);
        
        onCreated?.(result.data!);
        closeModal();
      } else {
        if (!plugin.questionBankService) {
          throw new Error('题库服务未初始化');
        }

        const bank: Deck = {
          id: generateId(),
          name: name.trim(),
          description: '',
          category: '',
          categoryIds: [],
          parentId: undefined,
          path: name.trim(),
          level: 0,
          order: 0,
          inheritSettings: false,
          settings: {} as any,
          stats: {} as any,
          includeSubdecks: false,
          deckType: 'question-bank',
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          tags: selectedTag ? [selectedTag] : [],
          metadata: {
            questionCount: 0,
            ...(pairedMemoryDeckId ? { pairedMemoryDeckId } : {}),
          }
        };

        const createdBank = await plugin.questionBankService.createBank(bank);

        const uuidsToAdd = choiceQuestionUUIDs.length > 0 ? choiceQuestionUUIDs : [];
        if (uuidsToAdd.length === 0) {
          throw new Error('所选卡片中没有可加入题库的选择题');
        }

        await plugin.questionBankService.addQuestionRefs(createdBank.id, uuidsToAdd);

        new Notice(`题库“${name}”创建成功，引用了 ${uuidsToAdd.length} 题`);
        onCreated?.(createdBank);
        closeModal();
      }
    } catch (error) {
      logger.error('[BuildDeckModal] 创建牌组失败:', error);
      errorMessage = error instanceof Error ? error.message : '创建失败';
      new Notice(`${errorMessage}`);
    } finally {
      isSaving = false;
    }
  }

  function closeModal() {
    name = "";
    selectedTag = "";
    tagInput = "";
    errorMessage = "";
    buildTarget = 'memory';
    choiceQuestionUUIDs = [];
    
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
        <h3 class="header-title">{buildTarget === 'memory' ? '组建牌组' : '组建考试牌组'}</h3>
        <button class="mode-dots" aria-label="切换组建目标" title={buildTarget === 'memory' ? '切换到组建考试牌组' : '切换到组建牌组'} onclick={toggleBuildTarget} type="button">
          <span class="dot dot-red" class:active={buildTarget === 'memory'}></span>
          <span class="dot dot-blue" class:active={buildTarget === 'question-bank'}></span>
          <span class="dot dot-green"></span>
        </button>
        <button class="icon-btn header-close" aria-label="关闭" onclick={closeModal}>×</button>
      </div>

      <div class="modal-body">
        <!-- 牌组名称 -->
        <label>
          <span>名称</span>
          <input 
            class="text-input" 
            placeholder="例如：计算机科学" 
            bind:value={name} 
            bind:this={nameInputRef}
          />
        </label>

        <!-- 标签选择 -->
        <label>
          <span>牌组标签（单选）</span>
          
          <div class="tag-input-wrapper">
            {#if selectedTag}
              <div class="selected-tags">
                <span class="tag-chip">
                  <span class="tag-text">{selectedTag}</span>
                  <button 
                    type="button"
                    class="tag-chip-remove" 
                    onclick={clearTag}
                    aria-label="移除标签"
                  >
                    ×
                  </button>
                </span>
              </div>
            {/if}
            <input 
              class="tag-input" 
              placeholder={selectedTag ? "" : "输入标签后按回车添加"} 
              bind:value={tagInput}
              onkeydown={handleTagInput}
            />
          </div>
          
          {#if availableTags.length > 0}
            <div class="available-tags">
              <div class="available-tags-title">可选标签（点击选择）</div>
              <div class="available-tags-list">
                {#each availableTags as tag}
                  <button 
                    type="button"
                    class="available-tag-item {selectedTag === tag ? 'selected' : ''}"
                    onclick={() => selectTag(tag)}
                  >
                    {tag}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          
          <span class="hint">标签用于牌组分类，仅可选择一个标签</span>
        </label>

        <!-- 卡片数量提示 -->
        <div class="card-count-info">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 14A6 6 0 108 2a6 6 0 000 12z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 5v3M8 10.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {#if buildTarget === 'memory'}
            <span>将引用 <strong>{selectedCardUUIDs.length}</strong> 张卡片</span>
          {:else}
            <span>将引用 <strong>{choiceQuestionUUIDs.length}</strong> 题</span>
          {/if}
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
          disabled={!name.trim() || isSaving || (buildTarget === 'memory' ? selectedCardUUIDs.length === 0 : choiceQuestionUUIDs.length === 0)} 
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
    width: 520px; 
    max-width: calc(100vw - 2rem);
    box-shadow: var(--anki-shadow-2xl);
    display: flex; 
    flex-direction: column;
    z-index: calc(var(--layer-notice) + 1);
  }
  
  .modal-header { 
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 1rem 1rem 0.5rem; 
  }

  .header-title {
    justify-self: start;
  }

  .header-close {
    justify-self: end;
  }

  .mode-dots {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    border: none;
    background: transparent;
    cursor: pointer;
    justify-self: center;
  }

  .mode-dots:hover {
    background: var(--background-modifier-hover);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    opacity: 0.55;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .dot.active {
    opacity: 1;
    transform: scale(1.15);
  }

  .dot-red {
    background: #ef4444;
  }

  .dot-blue {
    background: #3b82f6;
  }

  .dot-green {
    background: #22c55e;
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
  
  .hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 4px;
  }
  
  /* 卡片数量提示 */
  .card-count-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-secondary));
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 30%, transparent);
    border-radius: 8px;
    color: var(--text-normal);
    font-size: 0.9rem;
  }
  
  .card-count-info svg {
    color: var(--interactive-accent);
    flex-shrink: 0;
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
  
  /* 标签相关样式 */
  .tag-input-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    background: var(--background-secondary);
    min-height: 38px;
    transition: all 0.2s ease;
  }
  
  .tag-input-wrapper:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
  
  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .tag-chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: var(--text-on-accent);
    font-size: 12px;
    cursor: pointer;
  }
  
  .tag-chip-remove:hover {
    background: rgba(255, 255, 255, 0.35);
  }
  
  .tag-input {
    flex: 1;
    min-width: 120px;
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: 0.9rem;
    outline: none;
  }
  
  .available-tags {
    margin-top: 8px;
    padding: 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }
  
  .available-tags-title {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 6px;
    font-weight: 500;
  }
  
  .available-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .available-tag-item {
    padding: 4px 10px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    color: var(--text-normal);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .available-tag-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  .available-tag-item.selected {
    background: color-mix(in srgb, var(--interactive-accent) 15%, var(--background-secondary));
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    font-weight: 600;
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
