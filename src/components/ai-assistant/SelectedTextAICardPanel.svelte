<script lang="ts">
  import { Notice } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import type { AIAction } from '../../types/ai-types';
  import type { Card } from '../../data/types';
  import { CardType } from '../../data/types';
  import { get } from 'svelte/store';

  import { customActionsForMenu } from '../../stores/ai-config.store';
  import ChildCardMini from '../study/ChildCardMini.svelte';
  import UnifiedActionsBar from '../study/UnifiedActionsBar.svelte';

  import { AISplitService } from '../../services/ai/AISplitService';
  import { BlockLinkManager } from '../../utils/block-link-manager';
  import { createContentWithMetadata, extractBodyContent } from '../../utils/yaml-utils';
  import { generateUUID } from '../../utils/helpers';

  interface Props {
    plugin: WeavePlugin;
    selectedText: string;
    actionId: string;
    sourceFilePath: string;
    onClose: () => void;
  }

  let { plugin, selectedText, actionId, sourceFilePath, onClose }: Props = $props();

  let isGenerating = $state(false);
  let childCards = $state<Card[]>([]);
  let selectedCardIds = $state(new Set<string>());

  let availableDecks = $state<Array<{ id: string; name: string }>>([]);
  let selectedDeckId = $state<string>('');

  let sourceWeSource = $state<string>('');

  let didInit = $state(false);

  const proactiveActionId = 'Weave:proactive-question';
  const isProactiveMode = actionId === proactiveActionId;
  let generationMode = $state<'initial' | 'followup'>('initial');

  let showQuestionPrompt = $state(isProactiveMode);
  let userQuestion = $state('');

  let questionPromptTitle = $derived.by(() => {
    if (generationMode === 'followup') return '输入追问';
    if (isProactiveMode) return '输入问题';
    return '输入追问';
  });

  let questionPromptPlaceholder = $derived.by(() => {
    if (generationMode === 'followup') return '基于选中文本，你希望AI补充什么？';
    if (isProactiveMode) return '基于选中文本，你希望AI回答什么？';
    return '基于选中文本，你希望AI补充什么？';
  });

  const proactiveAction: AIAction = {
    id: proactiveActionId,
    name: '主动提问',
    icon: 'help-circle',
    type: 'split',
    systemPrompt: '你是一个严谨的学习助手，擅长把原文内容转换为可复习的学习卡片。',
    userPromptTemplate: `请根据“原文内容”和“用户问题”，生成{{数量}}张学习卡片，帮助用户回答该问题并提炼关键点。

原文内容：
{{cardContent}}

输出要求：
- 返回标准JSON格式：{ "cards": [ { "content": "<具体问题>\\n\\n---div---\\n\\n<具体答案>" } ] }
- <具体问题> 必须是完整可读的问题文本（可直接使用或改写“用户问题”），禁止输出占位词“问题”
- <具体答案> 必须是完整可读的答案文本，禁止只输出占位词“答案”
- 每张卡片聚焦一个关键点
- content字段必须使用"---div---"作为问题和答案的分隔符`,
    splitConfig: {
      targetCount: 3,
      splitStrategy: 'knowledge-point',
      outputFormat: 'qa'
    },
    category: 'official',
    createdAt: new Date().toISOString(),
    enabled: true
  };

  let currentAction = $derived.by(() => {
	if (actionId === proactiveActionId) return proactiveAction;
    const actions = get(customActionsForMenu);
    return actions.split.find((a) => a.id === actionId) || null;
  });

  async function loadDecks() {
    try {
      const allDecks = await plugin.dataStorage.getDecks();
      availableDecks = allDecks
        .filter((deck) => deck.purpose !== 'test')
        .map((deck) => ({ id: deck.id, name: deck.name }));

      if (availableDecks.length > 0) {
        if (!selectedDeckId || !availableDecks.find((d) => d.id === selectedDeckId)) {
          selectedDeckId = availableDecks[0].id;
        }
      }
    } catch {
      availableDecks = [];
      selectedDeckId = '';
    }
  }

  async function ensureSourceBlockLink(): Promise<void> {
    if (sourceWeSource) return;

    try {
      if (!sourceFilePath) {
        return;
      }

      const mgr = new BlockLinkManager(plugin.app);
      const result = await mgr.createBlockLinkForSelection(selectedText, sourceFilePath);

      if (result.blockLinkInfo) {
        const blockLink = result.blockLinkInfo.blockLink;
        if (blockLink) {
          sourceWeSource = blockLink.startsWith('!') ? blockLink : `!${blockLink}`;
        }
      }

      if (!sourceWeSource && sourceFilePath) {
        const base = sourceFilePath.split('/').pop()?.replace(/\.md$/, '') || sourceFilePath;
        sourceWeSource = `[[${base}]]`;
      }
    } catch {
      if (!sourceWeSource && sourceFilePath) {
        const base = sourceFilePath.split('/').pop()?.replace(/\.md$/, '') || sourceFilePath;
        sourceWeSource = `[[${base}]]`;
      }
    }
  }

  function toTempPreviewCard(content: string, index: number): Card {
    const now = new Date().toISOString();

    return {
      uuid: `temp-uuid-${Date.now()}-${Math.random().toString(16).slice(2)}-${index}`,
      deckId: selectedDeckId || 'preview-deck',
      templateId: 'official-qa',
      type: CardType.Basic,
      cardPurpose: 'memory',
      content,
      tags: [],
      priority: 0,
      fsrs: {
        due: now,
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        retrievability: 0
      },
      reviewHistory: [],
      stats: {
        totalReviews: 0,
        totalTime: 0,
        averageTime: 0,
        memoryRate: 0
      },
      created: now,
      modified: now
    };
  }

  function normalizeGeneratedCardContent(raw: string, questionFallback?: string): string {
    const content = (raw || '').trim();
    if (!content) return content;

    const sep = '---div---';
    if (!content.includes(sep)) return content;

    const parts = content.split(sep);
    const front = (parts[0] ?? '').trim();
    const back = parts.slice(1).join(sep).trim();

    const frontIsPlaceholder = /^问题\s*$/.test(front) || /^题目\s*$/.test(front) || /^question\s*$/i.test(front);
    if (!frontIsPlaceholder) return content;

    const fallback = (questionFallback || '').trim();
    if (!fallback) return content;

    return `${fallback}\n\n${sep}\n\n${back}`;
  }

  async function generateCards(mode: 'initial' | 'followup' = 'initial'): Promise<void> {
    if (isGenerating) return;

    const shouldRequireQuestion = isProactiveMode || mode === 'followup';
    if (shouldRequireQuestion && !userQuestion.trim()) {
      generationMode = mode;
      showQuestionPrompt = true;
      return;
    }

    const action = currentAction;
    if (!action) {
      new Notice('未找到指定的AI拆分功能');
      return;
    }

    const trimmed = (selectedText || '').trim();
    if (!trimmed) {
      new Notice('请先选中要制卡的文本');
      return;
    }

    try {
      isGenerating = true;

      await loadDecks();
      await ensureSourceBlockLink();

      const splitService = new AISplitService(plugin);
      const effectiveTargetCount = action.splitConfig?.targetCount || 3;

      const baseInstruction = (plugin.settings as any).aiConfig?.cardSplitting?.defaultInstruction || undefined;
      const instructionParts: string[] = [];
      if (userQuestion.trim()) instructionParts.push(`用户问题：${userQuestion.trim()}`);
      if (baseInstruction) instructionParts.push(baseInstruction);
      const instruction = instructionParts.length > 0 ? instructionParts.join('\n\n') : undefined;

      const tempParentCard: Card = {
        uuid: `temp-parent-${Date.now()}`,
        deckId: selectedDeckId || 'preview-deck',
        templateId: 'official-qa',
        type: CardType.Basic,
        cardPurpose: 'memory',
        content: trimmed,
        tags: [],
        priority: 0,
        fsrs: {
          due: new Date().toISOString(),
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          retrievability: 0
        },
        reviewHistory: [],
        stats: {
          totalReviews: 0,
          totalTime: 0,
          averageTime: 0,
          memoryRate: 0
        },
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      };

      const result = await splitService.splitCard(
        tempParentCard,
        action,
        {
          targetCount: effectiveTargetCount,
          instruction
        }
      );

      if (!result.success || !result.splitCards || result.splitCards.length === 0) {
        throw new Error(result.error || '拆分失败');
      }

      const questionFallback = isProactiveMode || mode === 'followup' ? userQuestion.trim() : '';
      const newlyGenerated = result.splitCards.map((c, idx) => {
        const normalized = normalizeGeneratedCardContent(c.content || '', questionFallback);
        return toTempPreviewCard(normalized, idx);
      });

      if (mode === 'followup') {
        childCards = [...childCards, ...newlyGenerated];
        const nextSelected = new Set(selectedCardIds);
        for (const c of newlyGenerated) nextSelected.add(c.uuid);
        selectedCardIds = nextSelected;
        new Notice(`已追加 ${newlyGenerated.length} 张预览卡片`);
      } else {
        childCards = newlyGenerated;
        selectedCardIds = new Set(newlyGenerated.map((c) => c.uuid));
        new Notice(`已生成 ${newlyGenerated.length} 张预览卡片`);
      }
    } catch (e) {
      new Notice(e instanceof Error ? e.message : '生成失败');
    } finally {
      isGenerating = false;
    }
  }

  function buildFinalContentForSave(body: string, deckName: string): string {
    const cleanBody = extractBodyContent(body || '').trim() || (body || '').trim();

    return createContentWithMetadata(
      {
        we_decks: deckName ? [deckName] : undefined,
        we_source: sourceWeSource || undefined
      },
      cleanBody
    );
  }

  async function handleSaveSelected(): Promise<void> {
    if (isGenerating) {
      new Notice('正在生成，请稍候');
      return;
    }

    const selectedIds = Array.from(selectedCardIds);
    if (selectedIds.length === 0) {
      new Notice('请先选择要导入的卡片');
      return;
    }

    if (!selectedDeckId) {
      new Notice('请先选择目标牌组');
      return;
    }

    const deckName = availableDecks.find((d) => d.id === selectedDeckId)?.name || '';

    try {
      let savedCount = 0;
      for (const c of childCards) {
        if (!selectedIds.includes(c.uuid)) continue;

        const now = new Date().toISOString();
        const finalContent = buildFinalContentForSave(c.content, deckName);

        const cardToSave: Card = {
          ...c,
          uuid: generateUUID(),
          deckId: selectedDeckId,
          templateId: 'official-qa',
          type: CardType.Basic,
          cardPurpose: 'memory',
          content: finalContent,
          created: now,
          modified: now
        };

        delete (cardToSave as any).fields;

        const res = await plugin.dataStorage.saveCard(cardToSave);
        if (res.success) savedCount++;
      }

      new Notice(`成功导入 ${savedCount} 张卡片`);

      try {
        (plugin.app.workspace as any).trigger('Weave:card-created', {
          deckId: selectedDeckId,
          source: 'editor-ai-split'
        });
      } catch {
      }

      onClose();
    } catch (e) {
      new Notice(e instanceof Error ? e.message : '导入失败');
    }
  }

  $effect(() => {
    if (didInit) return;
    didInit = true;
    loadDecks();
	if (!isProactiveMode) {
		generateCards('initial');
	}
  });

  function submitQuestionAndGenerate(): void {
    if (!userQuestion.trim()) return;
    showQuestionPrompt = false;
	generateCards(generationMode);
  }

  function toggleCardSelection(cardId: string) {
    const next = new Set(selectedCardIds);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    selectedCardIds = next;
  }
</script>

<div class="weave-ai-card-panel">
  <div class="header">
    <div class="title">AI预览卡片分布</div>
    <div class="header-actions">
      <button
			class="question"
			type="button"
			onclick={() => {
				generationMode = 'followup';
				showQuestionPrompt = true;
			}}
		>追问</button>
      <button class="close" type="button" onclick={onClose}>关闭</button>
    </div>
  </div>

  <div class="content">
    {#if showQuestionPrompt}
      <div class="question-overlay">
        <div class="question-dialog">
          <div class="question-title">{questionPromptTitle}</div>
          <textarea
            class="question-input"
            rows="3"
            bind:value={userQuestion}
            placeholder={questionPromptPlaceholder}
            onkeydown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitQuestionAndGenerate();
            }}
          ></textarea>
          <div class="question-actions">
            <button class="question-cancel" type="button" onclick={() => (showQuestionPrompt = false)}>取消</button>
            <button
              class="question-submit"
              type="button"
              disabled={!userQuestion.trim() || isGenerating}
              onclick={submitQuestionAndGenerate}
            >生成</button>
          </div>
        </div>
      </div>
    {/if}

    {#if isGenerating}
      <div class="generating-overlay" aria-busy="true">
        <div class="spinner"></div>
        <div class="generating-text">正在生成...</div>
      </div>
    {/if}

    {#if childCards.length === 0}
      <div class="loading">暂无预览卡片</div>
    {:else}
      <div class="cards-strip">
        {#each childCards as card, i}
          <ChildCardMini
            {card}
            index={i}
            selected={selectedCardIds.has(card.uuid)}
            regenerating={false}
            disabled={false}
            onclick={() => toggleCardSelection(card.uuid)}
          />
        {/each}
      </div>
    {/if}
  </div>

  <div class="actions">
    <UnifiedActionsBar
      showChildOverlay={true}
      selectedCount={selectedCardIds.size}
      onReturn={onClose}
      onRegenerate={generateCards}
      onSave={handleSaveSelected}
      isRegenerating={isGenerating}
      showDeckSelector={true}
      {availableDecks}
      selectedDeckId={selectedDeckId}
      onDeckChange={(deckId) => {
        selectedDeckId = deckId;
      }}
    />
  </div>
</div>

<style>
  .weave-ai-card-panel {
    border-top: 1px solid var(--background-modifier-border);
    background: transparent;
    padding: 0.5rem 0.75rem 0;
    font-size: 12px;
    position: relative;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.5rem;
  }

  .title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .question {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 12px;
  }

  .close {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 12px;
  }

  .content {
    position: relative;
    min-height: 160px;
  }

  .cards-strip {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.5rem 0 1rem;
    align-items: center;
  }

  .question-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 2;
  }

  .question-dialog {
    width: min(520px, 96%);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 0.5rem;
    padding: 0.75rem;
    box-shadow: var(--shadow-s);
    pointer-events: auto;
  }

  .generating-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--background-primary) 72%, transparent);
    z-index: 1;
    pointer-events: none;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--background-modifier-border);
    border-top-color: var(--text-muted);
    border-radius: 999px;
    animation: weave-spin 0.9s linear infinite;
  }

  .generating-text {
    color: var(--text-muted);
    font-size: 12px;
  }

  @keyframes weave-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .question-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.5rem;
  }

  .question-input {
    width: 100%;
    resize: vertical;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    border-radius: 0.375rem;
    padding: 0.5rem;
    font-size: 12px;
    line-height: 1.4;
  }

  .question-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .question-cancel,
  .question-submit {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 12px;
  }

  .loading {
    padding: 0.75rem 0;
    color: var(--text-muted);
  }

  .actions {
    padding: 0.5rem 0 0;
  }

  :global(.weave-ai-card-panel-container) {
    position: sticky;
    bottom: 0;
    z-index: 20;
    width: 100%;
    pointer-events: none;
    background: transparent;
  }

  .weave-ai-card-panel {
    pointer-events: auto;
  }
</style>
