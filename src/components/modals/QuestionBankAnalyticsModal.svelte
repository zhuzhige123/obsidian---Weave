<!--
  题库分析模态窗组件
  显示EWMA分析和历史记录
-->
<script lang="ts">
  import type { Deck } from '../../data/types';
  import type { WeavePlugin } from '../../main';
  import ResizableModal from '../ui/ResizableModal.svelte';
  
  // 导入题库分析标签页
  import QuestionBankEWMATab from './tabs/QuestionBankEWMATab.svelte';
  import QuestionBankHistoryTab from './tabs/QuestionBankHistoryTab.svelte';

  interface Props {
    /** 是否显示模态窗 */
    open: boolean;

    /** 关闭回调 */
    onClose: () => void;

    /** 插件实例 */
    plugin: WeavePlugin;

    /** 当前题库（在系统中题库就是Deck） */
    questionBank: Deck;
  }

  let { 
    open = $bindable(), 
    onClose, 
    plugin, 
    questionBank 
  }: Props = $props();

  // 标签页状态
  type TabType = 'ewma' | 'history';
  let activeTab = $state<TabType>('ewma');

  // 切换标签页
  function switchTab(tab: TabType) {
    activeTab = tab;
  }
</script>

{#if open}
<ResizableModal
  bind:open
  {plugin}
  title="{questionBank.name} - 题库分析"
  {onClose}
  keyboard={true}
>
  <div class="analytics-container">
    <!-- 标签导航 -->
    <div class="tabs-nav">
      <button 
        class="tab-btn"
        class:active={activeTab === 'ewma'}
        onclick={() => switchTab('ewma')}
      >
        EWMA分析
      </button>
      <button 
        class="tab-btn"
        class:active={activeTab === 'history'}
        onclick={() => switchTab('history')}
      >
        历史记录
      </button>
    </div>

    <!-- 内容区 - 使用CSS控制显示隐藏，避免DOM销毁 -->
    <div class="tab-content">
      <div class="tab-pane" class:hidden={activeTab !== 'ewma'}>
        {#if activeTab === 'ewma'}
          <QuestionBankEWMATab {questionBank} {plugin} />
        {/if}
      </div>
      
      <div class="tab-pane" class:hidden={activeTab !== 'history'}>
        {#if activeTab === 'history'}
          <QuestionBankHistoryTab {questionBank} {plugin} />
        {/if}
      </div>
    </div>
  </div>
</ResizableModal>
{/if}

<style>
  .analytics-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  /* 标签导航 */
  .tabs-nav {
    display: flex;
    background: var(--background-secondary);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
    margin: 16px 20px 0 20px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: var(--text-normal);
  }

  .tab-btn.active {
    background: var(--background-primary);
    color: var(--text-normal);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  /* 内容区 */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }

  .tab-pane {
    height: 100%;
    width: 100%;
  }

  .tab-pane.hidden {
    display: none;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .tabs-nav {
      gap: 2px;
      margin: 12px 16px 0 16px;
    }

    .tab-btn {
      padding: 5px 10px;
      font-size: 12px;
    }
  }
</style>
