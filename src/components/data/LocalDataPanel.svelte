<!--
  本地数据管理面板
  提供本地数据查看、管理和统计功能的用户界面
-->
<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy } from 'svelte';
  import { Notice } from 'obsidian';
  import { WeaveDataStorage } from '../../data/storage';
  import type { WeavePlugin } from '../../main';

  // 接收插件实例
  interface Props {
    plugin?: WeavePlugin;
  }
  let { plugin }: Props = $props();

  // 响应式状态
  let isLoading = $state(false);
  let selectedDecks = $state<string[]>([]);
  let availableDecks = $state<any[]>([]);

  // 存储服务实例
  let dataStorage: WeaveDataStorage | null = null;
  let unsubscribers: (() => void)[] = [];

  onMount(async () => {
    // 使用插件实例中已经初始化的数据存储
    if (plugin && plugin.dataStorage) {
      dataStorage = plugin.dataStorage;
      logger.debug('✅ 使用插件实例中的数据存储服务');
    } else {
      logger.warn('⚠️ 插件数据存储服务未找到');
      new Notice('数据存储服务未初始化');
      return;
    }

    // 初始化
    await initializeData();
  });

  onDestroy(() => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
  });

  /**
   * 初始化数据
   */
  async function initializeData() {
    try {
      isLoading = true;
      await loadLocalDecks();
    } catch (error) {
      logger.error('❌ 初始化数据失败:', error);
      new Notice(`初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isLoading = false;
    }
  }

  /**
   * 加载本地牌组
   */
  async function loadLocalDecks() {
    try {
      logger.debug('🔄 开始加载本地牌组...');

      if (!dataStorage) {
        logger.warn('❌ 数据存储服务未初始化');
        new Notice('数据存储服务未初始化');
        return;
      }

      const allDecks = await dataStorage.getAllDecks();
      logger.debug(`📊 获取到 ${allDecks.length} 个牌组:`, allDecks);

      if (allDecks.length === 0) {
        logger.debug('📭 没有找到任何牌组');
        availableDecks = [];
        selectedDecks = [];
        return;
      }

      // 为每个牌组获取卡片数量
      const decksWithCardCount = await Promise.all(
        allDecks
          .filter(deck => {
            if (!deck || typeof deck !== 'object') {
              logger.warn('❌ 发现无效牌组对象:', deck);
              return false;
            }
            if (!deck.id || deck.id === null || deck.id === undefined || deck.id === '') {
              logger.warn('❌ 发现无效牌组ID:', deck);
              return false;
            }
            if (!deck.name || typeof deck.name !== 'string') {
              logger.warn('❌ 发现无效牌组名称:', deck);
              return false;
            }
            return true;
          })
          .map(async (deck) => {
            try {
              const cards = await dataStorage!.getCardsByDeck(deck.id);
              logger.debug(`📋 牌组 "${deck.name}" 包含 ${cards.length} 张卡片`);
              return {
                id: deck.id,
                name: deck.name || '未命名牌组',
                cardCount: Array.isArray(cards) ? cards.length : 0,
                description: deck.description || '',
                created: deck.created || new Date().toISOString(),
                modified: deck.modified || new Date().toISOString()
              };
            } catch (error) {
              logger.warn(`❌ 获取牌组 ${deck.id} 卡片数量失败:`, error);
              return {
                id: deck.id,
                name: deck.name || '未命名牌组',
                cardCount: 0,
                description: deck.description || '',
                created: deck.created || new Date().toISOString(),
                modified: deck.modified || new Date().toISOString()
              };
            }
          })
      );

      availableDecks = (decksWithCardCount || []).filter(deck => deck && typeof deck === 'object' && deck.id);
      selectedDecks = (availableDecks || []).filter(deck => deck && typeof deck === 'object' && deck.id).map(deck => deck.id);

      logger.debug(`✅ 成功加载 ${availableDecks.length} 个牌组`);

    } catch (error) {
      logger.error('❌ 加载本地牌组失败:', error);
      new Notice(`加载本地牌组失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 切换牌组选择
   */
  function toggleDeckSelection(deckId: string) {
    if (!deckId || typeof deckId !== 'string' || deckId.trim() === '') {
      logger.warn('❌ toggleDeckSelection: 无效的牌组ID:', deckId);
      return;
    }

    try {
      const currentSelected = selectedDecks || [];
      if (currentSelected.includes(deckId)) {
        selectedDecks = currentSelected.filter(id => id !== deckId);
        logger.debug(`📋 取消选择牌组: ${deckId}`);
      } else {
        selectedDecks = [...currentSelected, deckId];
        logger.debug(`📋 选择牌组: ${deckId}`);
      }
    } catch (error) {
      logger.error('❌ toggleDeckSelection 失败:', error);
    }
  }

  /**
   * 全选/取消全选牌组
   */
  function toggleAllDecks() {
    const validDecks = (availableDecks || []).filter(deck => deck && typeof deck === 'object' && deck.id);
    const currentSelected = selectedDecks || [];

    if (currentSelected.length === validDecks.length) {
      selectedDecks = [];
    } else {
      selectedDecks = validDecks.map(deck => deck.id);
    }
  }

  /**
   * 刷新数据
   */
  async function refreshData() {
    await initializeData();
    new Notice('数据已刷新');
  }
</script>

<div class="local-data-panel">
  <!-- 面板标题 -->
  <div class="panel-header">
    <h3>本地数据管理</h3>
  </div>

  <!-- 数据控制 -->
  <div class="data-section">
    <div class="data-controls">
      <button
        onclick={refreshData}
        disabled={isLoading}
        class="refresh-btn"
      >
        刷新数据
      </button>
    </div>
  </div>

  <!-- 牌组选择 -->
  <div class="deck-selection-container">
    <div class="deck-content">
      <!-- Weave 牌组面板 -->
      <div class="deck-panel weave-panel">
        <div class="panel-header">
          <h4>Weave 牌组列表</h4>
          <div class="panel-actions">
            <button onclick={toggleAllDecks} class="toggle-all-btn">
              {(selectedDecks || []).length === (availableDecks || []).length ? '取消全选' : '全选'}
            </button>
          </div>
        </div>

        <div class="weave-summary">
          <div class="summary-stats">
            <span class="stat-item">
              <strong>本地牌组:</strong> {(availableDecks || []).length} 个
            </span>
            <span class="stat-item">
              <strong>总卡片:</strong> {(availableDecks || []).filter(deck => deck && typeof deck === 'object' && deck.cardCount !== undefined && deck.cardCount !== null).reduce((sum, deck) => sum + (deck.cardCount || 0), 0)} 张
            </span>
            <span class="stat-item">
              <strong>已选择:</strong> {(selectedDecks || []).length} 个牌组
            </span>
            {#if (selectedDecks || []).length > 0}
              <span class="stat-item">
                <strong>将处理:</strong> {(availableDecks || []).filter(deck => deck && typeof deck === 'object' && deck.id && deck.cardCount !== undefined && deck.cardCount !== null && (selectedDecks || []).includes(deck.id)).reduce((sum, deck) => sum + (deck.cardCount || 0), 0)} 张卡片
              </span>
            {/if}
          </div>
        </div>

        {#if (availableDecks || []).length > 0}
          <div class="deck-list weave-deck-list">
            {#each (availableDecks || []) as deck}
              {#if deck && typeof deck === 'object' && deck.id && typeof deck.id === 'string' && deck.id.trim() !== ''}
              <label class="deck-item weave-deck-item">
                <input
                  type="checkbox"
                  checked={(selectedDecks || []).includes(deck.id)}
                  onchange={() => toggleDeckSelection(deck.id)}
                  disabled={isLoading}
                />
                <div class="deck-info">
                  <div class="deck-header">
                    <span class="deck-name">{deck.name || '未命名牌组'}</span>
                    <span class="deck-count">{typeof deck.cardCount === 'number' ? deck.cardCount : 0} 张卡片</span>
                  </div>
                  {#if deck.description && deck.description.trim() !== ''}
                    <div class="deck-description">{deck.description}</div>
                  {/if}
                  <div class="deck-meta">
                    <span class="meta-item">创建: {new Date(deck.created).toLocaleDateString()}</span>
                    <span class="meta-item">修改: {new Date(deck.modified).toLocaleDateString()}</span>
                  </div>
                </div>
              </label>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="no-decks">
            <div class="empty-state">
              <div class="empty-icon">--</div>
              <div class="empty-title">没有找到本地牌组</div>
              <div class="empty-description">请先在 Weave 中创建一些牌组和卡片</div>
              <button onclick={loadLocalDecks} class="reload-btn">重新加载</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .local-data-panel {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .panel-header h3 {
    margin: 0;
    color: var(--text-accent);
    font-size: 1.2rem;
  }

  .panel-header h4 {
    margin: 0;
    color: var(--text-normal);
    font-size: 1rem;
  }

  .data-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .data-controls {
    display: flex;
    gap: 0.75rem;
  }

  .deck-selection-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1rem 0;
  }

  .deck-content {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1rem;
  }

  .deck-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    height: 100%;
  }

  .weave-panel {
    border-left: 3px solid var(--color-accent);
    margin: 0;
    border-radius: 0;
    background: transparent;
  }

  .panel-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .summary-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .stat-item {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .deck-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .deck-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .deck-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--color-accent);
  }

  .deck-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .deck-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .deck-name {
    font-weight: 600;
    color: var(--text-normal);
  }

  .deck-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--background-secondary);
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
  }

  .deck-description {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .deck-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-normal);
  }

  .empty-description {
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--color-accent);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn {
    background: var(--color-accent);
    color: var(--text-on-accent);
    border-color: var(--color-accent);
  }

  .toggle-all-btn {
    font-size: 0.8rem;
    padding: 0.375rem 0.75rem;
  }

  .reload-btn {
    background: var(--color-accent);
    color: var(--text-on-accent);
    border-color: var(--color-accent);
  }
</style>
