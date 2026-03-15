<!--
  粘贴卡片批量导入模态窗
  职责：从剪贴板粘贴文本，解析为卡片并批量导入
  分隔符：卡片间 <->，正反面 ---div---
  支持题型：问答题、选择题、挖空题（自动检测）
-->
<script lang="ts">
  import { logger } from '../../utils/logger';
  import { onMount, onDestroy } from 'svelte';
  import { Notice, AbstractInputSuggest, TFile } from 'obsidian';
  import EnhancedModal from '../ui/EnhancedModal.svelte';
  import type { WeavePlugin } from '../../main';
  import type { WeaveDataStorage } from '../../data/storage';
  import type { Deck, Card } from '../../data/types';
  import { CardType } from '../../data/types';
  import { generateUUID } from '../../utils/unified-id-generator';
  import { generateId } from '../../utils/helpers';
  import { buildContentWithYAML } from '../../utils/yaml-utils';

  interface Props {
    open: boolean;
    plugin: WeavePlugin;
    dataStorage: WeaveDataStorage;
    onClose: () => void;
    onImportComplete?: (deckId: string, cardCount: number) => void;
  }

  let {
    open = $bindable(),
    plugin,
    dataStorage,
    onClose,
    onImportComplete,
  }: Props = $props();

  // ===== 状态 =====
  let pasteText = $state('');
  let sourceLink = $state('');
  let targetDeckId = $state('');
  let newDeckName = $state('');
  let createNewDeck = $state(false);
  let batchTags = $state('');
  let isImporting = $state(false);
  let importProgress = $state(0);
  let showPreview = $state(false);

  // ===== 牌组列表 =====
  let decks = $state<Deck[]>([]);

  // ===== 文件建议器 =====
  let sourceInputEl = $state<HTMLInputElement | null>(null);
  let fileSuggest: AbstractInputSuggest<TFile> | null = null;

  // ===== 解析结果 =====
  interface ParsedCardPreview {
    index: number;
    content: string;
    type: CardType;
    typeName: string;
  }

  let parsedCards = $state<ParsedCardPreview[]>([]);

  // ===== 实时检测统计 =====
  let detectStats = $derived.by(() => {
    if (!pasteText.trim()) {
      return { total: 0, basic: 0, choice: 0, cloze: 0 };
    }
    const cards = splitCards(pasteText);
    let basic = 0, choice = 0, cloze = 0;
    for (const card of cards) {
      const type = detectCardType(card);
      if (type === CardType.Basic) basic++;
      else if (type === CardType.Multiple) choice++;
      else if (type === CardType.Cloze) cloze++;
    }
    return { total: cards.length, basic, choice, cloze };
  });

  class SourceFileSuggest extends AbstractInputSuggest<TFile> {
    getSuggestions(inputStr: string): TFile[] {
      const files = this.app.vault.getMarkdownFiles();
      const lower = inputStr.toLowerCase();
      if (!lower) return files.slice(0, 30);
      return files.filter(f => f.path.toLowerCase().includes(lower)).slice(0, 30);
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
      el.setText(file.path);
    }

    selectSuggestion(file: TFile): void {
      const name = file.path.replace(/\.md$/, '');
      sourceLink = `![[${name}]]`;
      if (sourceInputEl) {
        sourceInputEl.value = sourceLink;
      }
      this.close();
    }
  }

  function initFileSuggest() {
    if (sourceInputEl && !fileSuggest) {
      fileSuggest = new SourceFileSuggest(plugin.app, sourceInputEl);
    }
  }

  $effect(() => {
    if (sourceInputEl) {
      initFileSuggest();
    }
  });

  onMount(async () => {
    try {
      decks = await dataStorage.getAllDecks();
      if (decks.length > 0) {
        targetDeckId = decks[0].id;
      }
    } catch (e) {
      logger.error('[ClipboardImport] 初始化失败:', e);
    }
  });

  onDestroy(() => {
    if (fileSuggest) {
      fileSuggest.close();
      fileSuggest = null;
    }
  });

  // ===== 卡片分割 =====
  function splitCards(text: string): string[] {
    const lines = text.split('\n');
    const cards: string[] = [];
    let currentCard: string[] = [];

    for (const line of lines) {
      if (line.trim() === '<->') {
        const content = currentCard.join('\n').trim();
        if (content) {
          cards.push(content);
        }
        currentCard = [];
      } else {
        currentCard.push(line);
      }
    }

    // 最后一张卡片
    const lastContent = currentCard.join('\n').trim();
    if (lastContent) {
      cards.push(lastContent);
    }

    return cards;
  }

  // ===== 卡片类型检测 =====
  function detectCardType(content: string): CardType {
    // 挖空题检测：==文本== 或 {{c1::...}}
    const obsidianCloze = /==[^=]+==/g;
    const ankiCloze = /\{\{c\d+::.+?\}\}/g;
    if (obsidianCloze.test(content) || ankiCloze.test(content)) {
      return CardType.Cloze;
    }

    // 选择题检测：至少2个 A./B./C./D. 格式选项
    const labeledOptions = content.match(/^[A-Z][\.\)．）、]\s*.+$/gmi);
    if (labeledOptions && labeledOptions.length >= 2) {
      return CardType.Multiple;
    }

    return CardType.Basic;
  }

  function getCardTypeName(type: CardType): string {
    switch (type) {
      case CardType.Basic: return '问答';
      case CardType.Multiple: return '选择';
      case CardType.Cloze: return '挖空';
      default: return '未知';
    }
  }

  function handleSourceInput(value: string) {
    sourceLink = value;
  }

  // ===== 预览 =====
  function generatePreview() {
    const cards = splitCards(pasteText);
    parsedCards = cards.map((content, i) => {
      const type = detectCardType(content);
      return {
        index: i + 1,
        content,
        type,
        typeName: getCardTypeName(type),
      };
    });
    showPreview = true;
  }

  // ===== 导入执行 =====
  async function executeImport() {
    if (isImporting) return;
    if (detectStats.total === 0) {
      new Notice('没有检测到可导入的卡片');
      return;
    }

    isImporting = true;
    importProgress = 0;

    try {
      let deckId = targetDeckId;
      let deckName = '';

      // 创建新牌组
      if (createNewDeck) {
        const trimmedName = newDeckName.trim();
        if (!trimmedName) {
          new Notice('请输入牌组名称');
          isImporting = false;
          return;
        }
        const newDeck: Deck = {
          id: generateId(),
          name: trimmedName,
          description: '粘贴导入',
          category: 'imported',
          path: trimmedName,
          level: 0,
          order: 0,
          inheritSettings: false,
          includeSubdecks: false,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          settings: {
            newCardsPerDay: 20,
            maxReviewsPerDay: 100,
            enableAutoAdvance: false,
            showAnswerTime: 0,
            fsrsParams: {
              w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
              requestRetention: 0.9,
              maximumInterval: 36500,
              enableFuzz: true,
            },
            learningSteps: [1, 10],
            relearningSteps: [10],
            graduatingInterval: 1,
            easyInterval: 4,
          },
          stats: {
            totalCards: 0, newCards: 0, learningCards: 0, reviewCards: 0,
            todayNew: 0, todayReview: 0, todayTime: 0,
            totalReviews: 0, totalTime: 0, memoryRate: 0,
            averageEase: 2.5, forecastDays: {},
          },
          tags: ['clipboard-import'],
          metadata: {
            importDate: new Date().toISOString(),
          },
        };

        const deckResult = await dataStorage.saveDeck(newDeck);
        if (!deckResult.success) {
          throw new Error(`创建牌组失败: ${deckResult.error}`);
        }
        deckId = newDeck.id;
        deckName = trimmedName;
      } else {
        if (!targetDeckId) {
          new Notice('请选择目标牌组');
          isImporting = false;
          return;
        }
        const deck = decks.find(d => d.id === targetDeckId);
        deckName = deck?.name || '';
      }

      // 解析批量标签
      const extraTags = batchTags.split(/[,;，；]/).map(t => t.trim()).filter(Boolean);

      // 分割并创建卡片
      const cardTexts = splitCards(pasteText);
      const allCards: Card[] = [];
      const importBatchId = `clipboard-${Date.now()}`;

      for (let i = 0; i < cardTexts.length; i++) {
        const cardContent = cardTexts[i];
        const cardType = detectCardType(cardContent);

        // 构建 YAML 元数据
        const yamlMetadata: Record<string, any> = {
          we_type: cardType === CardType.Basic ? 'basic' : cardType === CardType.Multiple ? 'multiple' : 'cloze',
          we_created: new Date().toISOString(),
        };

        if (deckName) {
          yamlMetadata.we_decks = [deckName];
        }

        // 设置来源链接
        if (sourceLink.trim()) {
          yamlMetadata.we_source = sourceLink.trim();
        }

        const allTags = [...extraTags];
        if (allTags.length > 0) {
          yamlMetadata.tags = allTags;
        }

        const contentWithMeta = buildContentWithYAML(yamlMetadata, cardContent);

        const card: Card = {
          uuid: generateUUID(),
          deckId,
          type: cardType,
          content: contentWithMeta,
          fsrs: {
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            lastReview: undefined as any,
            retrievability: 1,
          },
          reviewHistory: [],
          stats: {
            totalReviews: 0,
            totalTime: 0,
            averageTime: 0,
            memoryRate: 0,
          },
          source: 'weave' as const,
          tags: allTags,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          metadata: {
            importBatchId,
          },
        };

        allCards.push(card);
      }

      // 批量保存
      importProgress = 10;
      await dataStorage.saveCardsBatch(allCards);
      importProgress = 100;

      new Notice(`粘贴导入完成: ${allCards.length} 张卡片已导入到 "${deckName}"`);
      logger.info('[ClipboardImport] 导入完成:', { count: allCards.length, deckName, deckId });

      onImportComplete?.(deckId, allCards.length);
      handleClose();
    } catch (err) {
      logger.error('[ClipboardImport] 导入失败:', err);
      new Notice('导入失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      isImporting = false;
    }
  }

  function handleClose() {
    if (isImporting) return;
    open = false;
    onClose();
  }
</script>

<EnhancedModal
  {open}
  onClose={handleClose}
  size="lg"
  title="粘贴卡片批量导入"
  accentColor="blue"
  maskClosable={!isImporting}
  keyboard={!isImporting}
>
  {#snippet children()}
    <div class="clip-import-wizard">
      <!-- 来源文档（可选） -->
      <div class="clip-section">
        <div class="clip-section-title">来源文档（可选）</div>
        <div class="clip-source-row">
          <input
            bind:this={sourceInputEl}
            type="text"
            class="clip-source-input"
            value={sourceLink}
            oninput={(e) => handleSourceInput((e.target as HTMLInputElement).value)}
            placeholder="输入文件名搜索或手动填写 ![[文档路径]]"
          />
        </div>
        {#if sourceLink.trim()}
          <div class="clip-source-preview">
            来源: {sourceLink}
          </div>
        {/if}
      </div>

      <!-- 目标牌组 -->
      <div class="clip-section">
        <div class="clip-section-title">目标牌组</div>
        <div class="clip-config-row">
          <label class="clip-config-label">
            <input type="radio" name="clip-deck-target" checked={!createNewDeck} onchange={() => createNewDeck = false} />
            导入到已有牌组
          </label>
          {#if !createNewDeck}
            <select class="clip-config-select" bind:value={targetDeckId}>
              {#each decks as deck}
                <option value={deck.id}>{deck.name}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div class="clip-config-row">
          <label class="clip-config-label">
            <input type="radio" name="clip-deck-target" checked={createNewDeck} onchange={() => createNewDeck = true} />
            创建新牌组
          </label>
          {#if createNewDeck}
            <input
              type="text"
              class="clip-config-input"
              bind:value={newDeckName}
              placeholder="输入牌组名称..."
            />
          {/if}
        </div>
      </div>

      <!-- 批量标签（可选） -->
      <div class="clip-section">
        <div class="clip-section-title">批量标签（可选）</div>
        <input
          type="text"
          class="clip-config-input clip-full-width"
          bind:value={batchTags}
          placeholder="多个标签用逗号分隔..."
        />
      </div>

      <!-- 粘贴区 -->
      <div class="clip-section">
        <div class="clip-section-title">
          粘贴卡片内容
          <span class="clip-format-hint">卡片间用 &lt;-&gt; 分隔，正反面用 ---div--- 分隔</span>
        </div>
        <textarea
          class="clip-textarea"
          bind:value={pasteText}
          placeholder={"Q: 什么是间隔重复？\n---div---\nA: 间隔重复是一种基于遗忘曲线的学习方法。\n\n<->\n\nQ: Java有哪些基本数据类型？\nA. int\nB. String\nC. boolean\nD. double\n---div---\nA, C, D。String是引用类型。\n\n<->\n\n==光合作用==是植物将==二氧化碳==转化为==葡萄糖==的过程。"}
        ></textarea>
      </div>

      <!-- 实时检测统计 -->
      {#if detectStats.total > 0}
        <div class="clip-detect-bar">
          <div class="clip-detect-total">
            检测到 <strong>{detectStats.total}</strong> 张卡片
          </div>
          <div class="clip-detect-types">
            {#if detectStats.basic > 0}
              <span class="clip-detect-tag clip-tag-basic">问答 {detectStats.basic}</span>
            {/if}
            {#if detectStats.choice > 0}
              <span class="clip-detect-tag clip-tag-choice">选择 {detectStats.choice}</span>
            {/if}
            {#if detectStats.cloze > 0}
              <span class="clip-detect-tag clip-tag-cloze">挖空 {detectStats.cloze}</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- 预览区 -->
      {#if showPreview && parsedCards.length > 0}
        <div class="clip-section">
          <div class="clip-section-title">卡片预览</div>
          <div class="clip-card-previews">
            {#each parsedCards as card}
              <div class="clip-card-preview">
                <div class="clip-card-preview-header">
                  卡片 {card.index}
                  <span class="clip-card-type-badge">{card.typeName}</span>
                </div>
                <pre class="clip-card-preview-content">{card.content}</pre>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 导入进度 -->
      {#if isImporting}
        <div class="clip-section">
          <div class="clip-progress-bar">
            <div class="clip-progress-fill" style="width: {importProgress}%"></div>
          </div>
          <div class="clip-progress-text">正在导入... {importProgress}%</div>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="clip-footer">
      <div class="clip-footer-left">
        {#if detectStats.total > 0}
          <button
            class="clip-btn clip-btn-secondary"
            onclick={generatePreview}
            disabled={isImporting}
          >
            {showPreview ? '刷新预览' : '预览'}
          </button>
        {/if}
      </div>
      <div class="clip-footer-right">
        <button class="clip-btn clip-btn-secondary" onclick={handleClose} disabled={isImporting}>
          取消
        </button>
        <button
          class="clip-btn clip-btn-primary"
          onclick={executeImport}
          disabled={isImporting || detectStats.total === 0}
        >
          {isImporting ? '导入中...' : `导入 ${detectStats.total} 张卡片`}
        </button>
      </div>
    </div>
  {/snippet}
</EnhancedModal>

<style>
  .clip-import-wizard {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* 区块 */
  .clip-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .clip-section-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-normal);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .clip-format-hint {
    font-weight: 400;
    font-size: 11px;
    color: var(--text-faint);
  }

  /* 来源文档 */
  .clip-source-row {
    display: flex;
    gap: 8px;
  }

  .clip-source-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }

  .clip-source-preview {
    font-size: 12px;
    color: var(--text-muted);
    padding: 4px 8px;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  /* 配置行 */
  .clip-config-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
  }

  .clip-config-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-normal);
    white-space: nowrap;
    cursor: pointer;
  }

  .clip-config-select {
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    min-width: 120px;
  }

  .clip-config-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }

  .clip-full-width {
    width: 100%;
  }

  /* 粘贴区 */
  .clip-textarea {
    width: 100%;
    min-height: 200px;
    max-height: 400px;
    padding: 12px;
    border: 2px dashed var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 13px;
    font-family: var(--font-monospace);
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.2s ease;
  }

  .clip-textarea:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .clip-textarea::placeholder {
    color: var(--text-faint);
    font-size: 12px;
  }

  /* 检测统计条 */
  .clip-detect-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .clip-detect-total {
    font-size: 13px;
    color: var(--text-normal);
  }

  .clip-detect-types {
    display: flex;
    gap: 6px;
  }

  .clip-detect-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
  }

  .clip-tag-basic {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .clip-tag-choice {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .clip-tag-cloze {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  /* 卡片预览 */
  .clip-card-previews {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .clip-card-preview {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .clip-card-preview-header {
    padding: 4px 10px;
    background: var(--background-secondary);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .clip-card-type-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-weight: 500;
  }

  .clip-card-preview-content {
    padding: 8px 10px;
    font-size: 12px;
    color: var(--text-normal);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    font-family: inherit;
    max-height: 120px;
    overflow-y: auto;
  }

  /* 进度条 */
  .clip-progress-bar {
    width: 100%;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    overflow: hidden;
  }

  .clip-progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .clip-progress-text {
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* 底部按钮 */
  .clip-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .clip-footer-left,
  .clip-footer-right {
    display: flex;
    gap: 8px;
  }

  .clip-btn {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .clip-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .clip-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .clip-btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .clip-btn-secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
    border-color: var(--background-modifier-border);
  }

  .clip-btn-secondary:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }
</style>
