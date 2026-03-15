<script lang="ts">
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
import { logger } from '../../utils/logger';

  import { onMount } from 'svelte';
  import { Menu, Modal, Notice, Setting } from 'obsidian';
  import type { Deck, Card } from '../../data/types';
  import type { DeckTreeNode } from '../../services/deck/DeckHierarchyService';
  import type { TestMode, QuestionBankModeConfig } from '../../types/question-bank-types';
  import type { WeavePlugin } from '../../main';
  import QuestionBankGridCard from './QuestionBankGridCard.svelte';
  import QuestionBankElegantCard from './QuestionBankElegantCard.svelte';
  import { getColorSchemeForDeck } from '../../config/card-color-schemes';
  import type { DeckCardStyle } from '../../types/plugin-settings.d';
  import BouncingBallsLoader from '../ui/BouncingBallsLoader.svelte';
  import TestModeSelectionModal from '../modals/TestModeSelectionModal.svelte';
  import QuestionBankAnalyticsModal from '../modals/QuestionBankAnalyticsModal.svelte';

  interface QuestionBankStats {
    total: number;      // 总题数
    completed: number;  // 已练题数
    accuracy: number;   // 正确率 (0-100)
    errorCount: number; // 错题数
  }

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();

  // 🆕 获取当前牌组卡片设计样式
  const deckCardStyle = $derived<DeckCardStyle>(
    (plugin.settings.deckCardStyle as DeckCardStyle) || 'default'
  );

  // 🆕 检测是否在侧边栏（容器宽度较窄）
  let containerRef: HTMLElement | null = $state(null);
  let isCompactMode = $state(false);

  // 状态管理
  let questionBankTree = $state<DeckTreeNode[]>([]);
  let bankStats = $state<Record<string, QuestionBankStats>>({});
  let isLoading = $state(true);
  
  // 模式选择相关状态
  let showModeSelectionModal = $state(false);
  let selectedBankId = $state<string | null>(null);
  let selectedBankName = $state<string>("");
  let selectedBankQuestionCount = $state(0);
  let selectedBankQuestions = $state<Card[]>([]);
  
  // 分析模态窗状态
  let showAnalyticsModal = $state(false);
  let analyticsBank = $state<import('../../data/types').Deck | null>(null);

  // 加载考试牌组树
  async function loadQuestionBankTree() {
    isLoading = true;
    try {
      if (!plugin.questionBankService || !plugin.questionBankHierarchy || !plugin.deckHierarchy) {
        logger.warn("[QuestionBankGridView] Required services not initialized");
        questionBankTree = [];
        return;
      }

      // 1. 获取记忆牌组树
      const memoryDeckTree = await plugin.deckHierarchy.getDeckTree();
      
      // 2. 基于记忆牌组树构建考试牌组树
      questionBankTree = await plugin.questionBankHierarchy.buildQuestionBankTree(memoryDeckTree);
      
      // 3. 加载统计数据
      await loadBankStats();
    } catch (error) {
      logger.error("[QuestionBankGridView] Failed to load question bank tree:", error);
      new Notice("加载题库失败: " + (error instanceof Error ? error.message : "未知错误"));
      questionBankTree = [];
    } finally {
      isLoading = false;
    }
  }

  // 加载统计数据
  async function loadBankStats() {
    if (!plugin.questionBankService) return;

    const allBanks = await plugin.questionBankService.getAllBanks();
    
    for (const bank of allBanks) {
      const questions = await plugin.questionBankService.getQuestionsByBank(bank.id);
      const total = questions.length;
      
      // 计算完成度、正确率和错题数
      let completed = 0;
      let correctCount = 0;
      let errorCount = 0;
      
      for (const question of questions) {
        if (question.stats?.testStats && question.stats.testStats.totalAttempts > 0) {
          completed++;
          const currentAccuracy = question.stats.testStats.masteryMetrics?.currentAccuracy;
          if (currentAccuracy !== undefined) {
            correctCount += currentAccuracy;
          } else {
            correctCount += (question.stats.testStats.accuracy || 0) * 100;
          }
          
          // 统计错题数
          errorCount += question.stats.testStats.incorrectAttempts;
        }
      }
      
      const accuracy = completed > 0 ? correctCount / completed : 0;
      
      bankStats[bank.id] = {
        total,
        completed,
        accuracy,
        errorCount
      };
    }
  }

  // 开始测试 - 显示模式选择窗口
  async function handleStartTest(bankId: string) {
    if (!plugin.questionBankService) {
      new Notice("题库服务未初始化");
      return;
    }
    
    const questions = await plugin.questionBankService.getQuestionsByBank(bankId);
    const bank = await plugin.questionBankService.getBankById(bankId);
    
    if (questions.length === 0) {
      new Notice("该题库暂无题目");
      return;
    }
    
    // 设置选择状态并显示模式选择窗口
    selectedBankId = bankId;
    selectedBankName = bank?.name || "未知题库";
    selectedBankQuestionCount = questions.length;
    selectedBankQuestions = questions;
    showModeSelectionModal = true;
  }

  // 开始考试（模式选择后调用）
  async function handleStartStudying(bankId: string, bankName: string, questions: Card[], mode: TestMode = 'exam', config?: QuestionBankModeConfig) {
    logger.debug('[QuestionBankGridView] 开始考试:', { bankId, bankName, questionCount: questions.length, mode, config });
    
    if (questions.length === 0) {
      new Notice('题库为空，请先添加题目');
      return;
    }
    
    // 如果有配置，保存到题库
    if (config && plugin.questionBankService) {
      try {
        await plugin.questionBankService.updateBankConfig(bankId, config);
        logger.debug('[QuestionBankGridView] 配置已保存:', config);
      } catch (error) {
        logger.error('[QuestionBankGridView] 保存配置失败:', error);
      }
    }
    
    // ✅ 新方式：打开独立的考试学习标签页
    await plugin.openQuestionBankSession({
      bankId,
      bankName,
      mode,
      config
    });
  }

  // 处理模式选择
  async function handleModeSelected(mode: TestMode, config?: QuestionBankModeConfig) {
    logger.debug('[QuestionBankGridView] 模式选择:', { mode, config });
    showModeSelectionModal = false;
    
    if (selectedBankId && selectedBankQuestions.length > 0) {
      await handleStartStudying(selectedBankId, selectedBankName, selectedBankQuestions, mode, config);
    }
  }

  // 取消模式选择
  function handleModeSelectionCancel() {
    logger.debug('[QuestionBankGridView] 取消模式选择');
    showModeSelectionModal = false;
    selectedBankId = null;
    selectedBankName = "";
    selectedBankQuestionCount = 0;
    selectedBankQuestions = [];
  }

  // 分析题库
  async function analyzeBank(bankId: string) {
    try {
      logger.debug('[QuestionBankGridView] 分析题库:', bankId);
      
      const bank = await plugin.questionBankService?.getBankById(bankId);
      if (!bank) {
        new Notice('题库不存在');
        return;
      }
      
      analyticsBank = bank;
      showAnalyticsModal = true;
    } catch (error) {
      logger.error('[QuestionBankGridView] 分析题库失败:', error);
      new Notice('打开分析界面失败');
    }
  }

  // 删除题库
  async function deleteBank(bankId: string) {
    try {
      const bank = await plugin.questionBankService?.getBankById(bankId);
      if (!bank) {
        new Notice('题库不存在');
        return;
      }

      const confirmed = await showObsidianConfirm(plugin.app, `确定要删除题库「${bank.name}」吗？\n\n删除后题库数据将无法恢复。`, { title: '确认删除' });
      if (!confirmed) return;

      new Notice('正在删除题库...');
      
      await plugin.questionBankService?.deleteBank(bankId);
      await loadQuestionBankTree();
      
      new Notice('题库删除成功');
    } catch (error) {
      logger.error('[QuestionBankGridView] 删除题库失败:', error);
      new Notice(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 初始化加载
  onMount(() => {
    loadQuestionBankTree();
    
    // 🆕 检测容器宽度，决定是否使用紧凑模式
    if (containerRef) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          isCompactMode = entry.contentRect.width < 500;
        }
      });
      resizeObserver.observe(containerRef);
      isCompactMode = containerRef.clientWidth < 500;
      
      return () => resizeObserver.disconnect();
    }
  });

  // 扁平化题库树（保持层级结构）
  function flattenBankTree(nodes: DeckTreeNode[]): Deck[] {
    const result: Deck[] = [];
    for (const node of nodes) {
      result.push(node.deck);
      if (node.children.length > 0) {
        result.push(...flattenBankTree(node.children));
      }
    }
    return result;
  }

  const allBanks = $derived(flattenBankTree(questionBankTree));

  // 显示题库菜单（考试牌组专用菜单）
  function showBankMenu(event: MouseEvent, bankId: string) {
    event.preventDefault();
    event.stopPropagation();
    const menu = new Menu();

    // 牌组编辑
    menu.addItem((item) =>
      item
        .setTitle("牌组编辑")
        .setIcon("edit-3")
        .onClick(() => handleEditBank(bankId))
    );

    // 分析功能
    menu.addItem((item) =>
      item
        .setTitle("分析")
        .setIcon("bar-chart-2")
        .onClick(() => analyzeBank(bankId))
    );

    menu.addSeparator();

    // 删除功能
    menu.addItem((item) =>
      item
        .setTitle("删除")
        .setIcon("trash-2")
        .onClick(() => deleteBank(bankId))
    );

    menu.showAtMouseEvent(event);
  }

  // 牌组编辑（名称 + 标签）
  async function handleEditBank(bankId: string) {
    
    const bank = allBanks.find(b => b.id === bankId);
    if (!bank) return;

    const modal = new Modal(plugin.app);
    modal.titleEl.setText('编辑牌组');

    let newName = bank.name;
    let newTag = (bank.tags && bank.tags.length > 0) ? bank.tags[0] : '';

    // 名称
    new Setting(modal.contentEl)
      .setName('名称')
      .addText((text: any) => {
        text.setValue(newName).onChange((v: string) => { newName = v; });
        text.inputEl.style.width = '100%';
      });

    // 牌组标签（单选）
    new Setting(modal.contentEl)
      .setName('牌组标签(单选)')
      .setDesc('标签用于牌组分类，仅可选择一个标签');

    const tagInputContainer = modal.contentEl.createDiv({ cls: 'weave-tag-input-container' });
    const tagDisplay = tagInputContainer.createDiv({ cls: 'weave-tag-display' });

    function renderTag() {
      tagDisplay.empty();
      if (newTag) {
        const chip = tagDisplay.createSpan({ cls: 'weave-tag-chip', text: newTag });
        const removeBtn = chip.createSpan({ cls: 'weave-tag-remove', text: '\u00d7' });
        removeBtn.onclick = () => { newTag = ''; renderTag(); };
      }
    }
    renderTag();

    const tagInput = tagInputContainer.createEl('input', {
      type: 'text',
      placeholder: '输入标签后按回车添加'
    });
    tagInput.style.width = '100%';
    tagInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && tagInput.value.trim()) {
        e.preventDefault();
        newTag = tagInput.value.trim();
        tagInput.value = '';
        renderTag();
      }
    });

    // 按钮
    const btnContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'flex-end';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginTop = '16px';

    const cancelBtn = btnContainer.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const saveBtn = btnContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      if (!newName.trim()) return;
      try {
        const dataStorage = plugin.dataStorage;
        const updated: Deck = {
          ...bank,
          name: newName.trim(),
          tags: newTag ? [newTag] : [],
          modified: new Date().toISOString(),
        };
        await dataStorage.saveDeck(updated);
        await loadQuestionBankTree();
        plugin.app.workspace.trigger('Weave:data-changed');
        new Notice('牌组已更新');
        modal.close();
      } catch (error) {
        logger.error('[QuestionBankGridView] 编辑失败:', error);
        new Notice('编辑失败');
      }
    };

    modal.open();
  }

</script>

<div class="question-bank-grid-view" bind:this={containerRef}>
  {#if isLoading}
    <!-- 加载动画 -->
    <div class="loading-container">
      <BouncingBallsLoader message="正在加载题库..." />
    </div>
  {:else if allBanks.length > 0}
    <!-- 网格视图 -->
    <div class="cards-grid">
      {#each allBanks as bank, index (bank.id)}
        {@const stats = bankStats[bank.id] || {
          total: 0,
          completed: 0,
          accuracy: 0,
          errorCount: 0
        }}
        {@const colorScheme = getColorSchemeForDeck(bank.id)}
        {@const colorVariant = ((index % 4) + 1) as 1 | 2 | 3 | 4}
        
        {#if deckCardStyle === 'chinese-elegant'}
          <!-- 典雅风格卡片 -->
          <QuestionBankElegantCard
            {bank}
            {stats}
            {colorVariant}
            compact={isCompactMode}
            onTest={() => handleStartTest(bank.id)}
            onMenu={(e) => showBankMenu(e, bank.id)}
          />
        {:else}
          <!-- 默认风格卡片 -->
          <QuestionBankGridCard
            {bank}
            {stats}
            {colorScheme}
            onTest={() => handleStartTest(bank.id)}
            onMenu={(e) => showBankMenu(e, bank.id)}
          />
        {/if}
      {/each}
    </div>
  {:else}
    <!-- 空状态占位符 -->
    <div class="mode-placeholder">
      <h2 class="placeholder-title">暂无考试牌组</h2>
      <p class="placeholder-desc">请在卡片管理中从选择题引入组建考试牌组</p>
    </div>
  {/if}
</div>

<!-- 模式选择模态窗 -->
<TestModeSelectionModal
  open={showModeSelectionModal}
  bankName={selectedBankName}
  totalQuestions={selectedBankQuestionCount}
  onSelect={handleModeSelected}
  onCancel={handleModeSelectionCancel}
/>

<!-- 题库分析模态窗 -->
{#if analyticsBank}
<QuestionBankAnalyticsModal
  bind:open={showAnalyticsModal}
  {plugin}
  questionBank={analyticsBank}
  onClose={() => {
    showAnalyticsModal = false;
    analyticsBank = null;
  }}
/>
{/if}

<style>
  .question-bank-grid-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow-y: auto;
    background: var(--background-primary);
  }

  /* 加载容器 */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 24px;
    padding: 8px 0;
  }

  /* 模式占位符样式 */
  .mode-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 3rem 2rem;
    text-align: center;
  }

  .placeholder-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.5rem;
  }

  .placeholder-desc {
    font-size: 1rem;
    color: var(--text-muted);
    max-width: 500px;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .question-bank-grid-view {
      padding: 16px;
    }

    .cards-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .mode-placeholder {
      min-height: 300px;
      padding: 2rem 1rem;
    }

    .placeholder-title {
      font-size: 1.25rem;
    }
  }

  @media (min-width: 769px) and (max-width: 1200px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
  }

  @media (min-width: 1201px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 24px;
    }
  }

  /* 📱 Obsidian 移动端特定样式 - 内容区贴边 */
  :global(body.is-mobile) .question-bank-grid-view {
    padding: 8px 2px; /* 🔧 减少左右间距，让卡片更贴边 */
  }

  :global(body.is-mobile) .cards-grid {
    gap: 8px; /* 🔧 减少卡片之间的间距 */
    padding: 4px 0;
  }

  :global(body.is-phone) .question-bank-grid-view {
    padding: 4px 1px; /* 🔧 手机端进一步减少间距 */
  }

  :global(body.is-phone) .cards-grid {
    gap: 6px; /* 🔧 手机端进一步减少卡片间距 */
  }
</style>
