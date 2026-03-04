<script lang="ts">
  import { Menu, Notice } from 'obsidian';
  import type { AnkiDeckInfo } from '../../../types/ankiconnect-types';
  import type { Deck } from '../../../data/types';
  import type { DeckSyncMapping } from '../../settings/types/settings-types';
  import type { AnkiConnectSettings } from '../../settings/types/settings-types';
  import { tr } from '../../../utils/i18n';
  import ObsidianDropdown from '../../ui/ObsidianDropdown.svelte';
  
  //  高级功能限制
  import { PremiumFeatureGuard } from '../../../services/premium/PremiumFeatureGuard';
  
  // 子组件
  import AddMappingForm from './deck-mapping/components/AddMappingForm.svelte';
  import ToolbarActions from './deck-mapping/components/ToolbarActions.svelte';

  // 响应式翻译
  let t = $derived($tr);
  
  // UI组件（原生 Menu API，无需额外导入）
  
  let {
    ankiDecks = [],
    weaveDecks = [],
    isFetchingDecks = false,
    mappings = {},
    settings,
    onFetchDecks,
    onAddMapping,
    onUpdateMapping,
    onRemoveMapping,
    onSync,
    onImport,
    onBidirectionalSync,
    onBatchSync
  }: {
    ankiDecks: AnkiDeckInfo[];
    weaveDecks: Deck[];
    isFetchingDecks?: boolean;
    mappings: Record<string, DeckSyncMapping>;
    settings: AnkiConnectSettings;
    onFetchDecks: () => Promise<void>;
    onAddMapping: (mapping: DeckSyncMapping) => void;
    onUpdateMapping: (id: string, updates: Partial<DeckSyncMapping>) => void;
    onRemoveMapping: (id: string) => void;
    onSync: (deckId: string) => Promise<void>;
    onImport: (ankiDeckName: string, weaveDeckId: string) => Promise<void>;
    onBidirectionalSync: (deckId: string) => Promise<void>;
    onBatchSync: (mode: 'to_anki' | 'from_anki' | 'bidirectional') => Promise<void>;
  } = $props();

  let showAddModal = $state(false);
  let syncingDeckId = $state<string | null>(null);
  let showHelpModal = $state(false); // 🆕 帮助提示弹窗

  //  高级功能守卫
  const premiumGuard = PremiumFeatureGuard.getInstance();
  let isPremium = $state(false);

  // 订阅高级版状态
  $effect(() => {
    const unsubscribe = premiumGuard.isPremiumActive.subscribe(value => {
      isPremium = value;
    });
    return unsubscribe;
  });

  // 将 mappings 转换为数组，保留 key 信息
  let mappingList = $derived.by(() => {
    const list = Object.entries(mappings).map(([id, mapping]) => ({
      _id: id, // 保留原始 key
      ...mapping
    }));
    return list;
  });

  async function handleFetch() {
    await onFetchDecks();
  }
  
  function handleAddMapping(mapping: DeckSyncMapping) {
    onAddMapping(mapping);
    showAddModal = false;
  }

  async function handleSync(deckId: string) {
    syncingDeckId = deckId;
    try {
      await onSync(deckId);
    } finally {
      syncingDeckId = null;
    }
  }

  async function handleImport(ankiDeckName: string, weaveDeckId: string) {
    syncingDeckId = ankiDeckName; // 使用 ankiDeckName 作为同步状态标识
    try {
      await onImport(ankiDeckName, weaveDeckId);
    } finally {
      syncingDeckId = null;
    }
  }

  async function handleBidirectionalSync(deckId: string) {
    syncingDeckId = deckId;
    try {
      await onBidirectionalSync(deckId);
    } finally {
      syncingDeckId = null;
    }
  }

  function getSyncDirectionIcon(direction: string): string {
    switch (direction) {
      case 'to_anki': return '→';
      case 'from_anki': return '←';
      case 'bidirectional': return '⇄';
      default: return '→';
    }
  }

  function getSyncDirectionClass(direction: string): string {
    switch (direction) {
      case 'to_anki': return 'to-anki';
      case 'from_anki': return 'from-anki';
      case 'bidirectional': return 'bidirectional';
      default: return 'to-anki';
    }
  }

  function formatLastSyncTime(time: string | undefined): string {
    if (!time) return '从未同步';
    
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString();
  }

  function getContentConversionValue(mapping: any): 'standard' | 'preserve_style' | 'minimal' {
    return mapping?.contentConversion || 'standard';
  }

  /**
   * 显示映射操作菜单（Obsidian 原生 Menu）
   */
  function showMappingActionsMenu(mapping: any, event: MouseEvent) {
    const menu = new Menu();
    const isSyncing = syncingDeckId === mapping._id || syncingDeckId === mapping.ankiDeckName;
    
    // 根据同步方向添加相关操作
    if (mapping.syncDirection === 'from_anki' || mapping.syncDirection === 'bidirectional') {
      menu.addItem((item) => {
        item
          .setTitle('从 Anki 导入')
          .setIcon('download')
          .setDisabled(!mapping.enabled || isSyncing)
          .onClick(() => handleImport(mapping.ankiDeckName, mapping.weaveDeckId));
      });
    }
    
    if (mapping.syncDirection === 'to_anki' || mapping.syncDirection === 'bidirectional') {
      menu.addItem((item) => {
        item
          .setTitle('导出到 Anki')
          .setIcon('upload')
          .setDisabled(!mapping.enabled || isSyncing)
          .onClick(() => handleSync(mapping._id));
      });
    }
    
    if (mapping.syncDirection === 'bidirectional') {
      menu.addItem((item) => {
        item
          .setTitle('双向智能同步')
          .setIcon('repeat')
          .setDisabled(!mapping.enabled || isSyncing)
          .onClick(() => handleBidirectionalSync(mapping._id));
      });
    }
    
    // 添加分隔符和删除选项
    menu.addSeparator();
    
    menu.addItem((item) => {
      item
        .setTitle('删除映射')
        .setIcon('trash')
        .onClick(() => onRemoveMapping(mapping._id));
    });
    
    menu.showAtMouseEvent(event);
  }

  /**
   * 显示批量操作菜单
   */
  function showBatchActionsMenu(event: MouseEvent) {
    const menu = new Menu();
    
    // 计算启用的映射数量
    const enabledMappings = Object.values(mappings).filter(m => m.enabled);
    const enabledCount = enabledMappings.length;
    const totalCount = Object.keys(mappings).length;
    
    // 批量导出到 Anki
    menu.addItem((item) => {
      item
        .setTitle(`批量导出到 Anki`)
        .setIcon("arrow-right")
        .setDisabled(enabledCount === 0)
        .onClick(async () => {
          if (enabledCount === 0) {
            new Notice('没有启用的牌组映射');
            return;
          }
          await onBatchSync('to_anki');
        });
      
      // 添加副标题显示数量
      if (enabledCount > 0) {
        (item as any).setSection?.(`${enabledCount} 个已启用`);
      }
    });
    
    // 批量从 Anki 导入
    menu.addItem((item) => {
      item
        .setTitle(`批量从 Anki 导入`)
        .setIcon("arrow-left")
        .setDisabled(enabledCount === 0)
        .onClick(async () => {
          if (enabledCount === 0) {
            new Notice('没有启用的牌组映射');
            return;
          }
          await onBatchSync('from_anki');
        });
      
      if (enabledCount > 0) {
        (item as any).setSection?.(`${enabledCount} 个已启用`);
      }
    });
    
    // 批量双向同步
    menu.addItem((item) => {
      item
        .setTitle(`批量双向同步`)
        .setIcon("repeat")
        .setDisabled(enabledCount === 0 || !settings.bidirectionalSync.enabled)
        .onClick(async () => {
          if (enabledCount === 0) {
            new Notice('没有启用的牌组映射');
            return;
          }
          if (!settings.bidirectionalSync.enabled) {
            new Notice('双向同步未启用，请在高级设置中启用');
            return;
          }
          await onBatchSync('bidirectional');
        });
      
      if (enabledCount > 0 && settings.bidirectionalSync.enabled) {
        (item as any).setSection?.(`${enabledCount} 个已启用`);
      }
    });
    
    menu.showAtMouseEvent(event);
  }
</script>

<div class="deck-mapping-section settings-group">
  <div class="group-header">
    <div class="header-content">
      <h4 class="section-title with-accent-bar accent-purple">{t('ankiConnect.deckSync.title')}</h4>
      <p>{t('ankiConnect.deckSync.description')}</p>
    </div>
    <div class="header-actions">
      <!-- 🆕 帮助按钮 -->
      {#if mappingList.length > 0}
        <button 
          class="header-action-btn help-btn"
          aria-label={t('common.help')}
          title={t('common.help')}
          onclick={() => showHelpModal = true}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
      {/if}
      <!-- 批量操作按钮 -->
      <button 
        class="header-action-btn"
        aria-label={t('common.batchOperations')}
        title={t('common.batchOperations')}
        onclick={showBatchActionsMenu}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="19" cy="12" r="1"></circle>
          <circle cx="5" cy="12" r="1"></circle>
        </svg>
      </button>
    </div>
  </div>

  {#if weaveDecks.length === 0}
    <div class="info-banner warning">
      <span class="banner-icon">!</span>
      <div class="banner-text">
        <strong>未找到 Weave 牌组</strong><br />
        请先在"牌组学习"界面中创建至少一个牌组，然后刷新此页面。
      </div>
    </div>
  {/if}

  <!-- 工具栏操作 -->
  <ToolbarActions
    {ankiDecks}
    {weaveDecks}
    {isFetchingDecks}
    {showAddModal}
    onFetchDecks={handleFetch}
    onToggleAddModal={() => showAddModal = !showAddModal}
  />

  <!-- 添加映射表单 -->
  <AddMappingForm
    isVisible={showAddModal}
    {ankiDecks}
    {weaveDecks}
    {isPremium}
    onAdd={handleAddMapping}
  />

  {#if mappingList.length === 0}
    <!--  已移除：空状态提示可能遮挡下方按钮
    <div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-text">
        还没有配置牌组映射<br />
        点击"添加映射"开始配置
      </div>
    </div>
    -->
  {:else}
    <div class="mapping-table-container">
      <table class="anki-table">
        <thead>
          <!-- svelte-ignore component_name_lowercase -->
          <tr>
            <th>Weave 牌组</th>
            <th>Anki 牌组</th>
            <th>同步方向</th>
            <th>内容转换</th>
            <th>状态</th>
            <th>上次同步</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each mappingList as mapping}
            <!-- svelte-ignore component_name_lowercase -->
            <tr>
              <td class="truncate" title={mapping.weaveDeckName}>
                <strong>{mapping.weaveDeckName}</strong>
              </td>
              <td class="truncate" title={mapping.ankiDeckName}>
                {mapping.ankiDeckName}
              </td>
              <td>
                <span class="sync-direction {getSyncDirectionClass(mapping.syncDirection)}">
                  {getSyncDirectionIcon(mapping.syncDirection)} 
                  {mapping.syncDirection === 'to_anki' ? '到 Anki' : 
                   mapping.syncDirection === 'from_anki' ? '从 Anki' : '双向'}
                </span>
              </td>
              <td>
                <ObsidianDropdown
                  options={[
                    { id: 'standard', label: '标准' },
                    { id: 'preserve_style', label: '尽量保留样式' },
                    { id: 'minimal', label: '最少转换' }
                  ]}
                  value={getContentConversionValue(mapping)}
                  onchange={(value) => {
                    onUpdateMapping(mapping._id, { contentConversion: value as any });
                  }}
                />
              </td>
              <td>
                <label class="modern-switch" title={mapping.enabled ? '点击禁用同步' : '点击启用同步'}>
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onchange={() => {
                      onUpdateMapping(mapping._id, { 
                        enabled: !mapping.enabled 
                      });
                    }}
                  />
                  <span class="switch-slider"></span>
                </label>
              </td>
              <td class="last-sync-time truncate" title={formatLastSyncTime(mapping.lastSyncTime)}>
                {formatLastSyncTime(mapping.lastSyncTime)}
              </td>
              <td class="actions-cell">
                <button 
                  class="mapping-menu-btn"
                  aria-label="操作菜单"
                  title="更多操作"
                  onclick={(e) => showMappingActionsMenu(mapping, e)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>


<!-- 🆕 帮助提示弹窗 -->
{#if showHelpModal}
  <div 
    class="modal-overlay" 
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-modal-title"
    tabindex="-1"
    onclick={() => showHelpModal = false}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="help-modal" 
      role="document"
      tabindex="-1"
      onclick={(e) => { e.preventDefault(); }} 
      onkeydown={(e) => { e.preventDefault(); }}
    >
      <div class="help-modal-header">
        <h3 id="help-modal-title">使用说明</h3>
        <button 
          class="close-btn" 
          onclick={() => showHelpModal = false}
          aria-label="关闭帮助"
        >×</button>
      </div>
      <div class="help-modal-content">
        <div class="help-item">
          <div class="help-item-title">已配置 {mappingList.length} 个映射关系</div>
          <p class="help-item-desc">打开开关即可启用同步，点击同步按钮执行数据同步</p>
        </div>
        
        <div class="help-item">
          <div class="help-item-title">如何使用</div>
          <ul class="help-list">
            <li><strong>启用同步</strong>：点击表格中的开关启用或禁用该映射</li>
            <li><strong>单个同步</strong>：点击操作菜单（•••）选择同步方向</li>
            <li><strong>批量同步</strong>：点击右上角菜单（•••）批量操作所有启用的映射</li>
          </ul>
        </div>
        
        <div class="help-item">
          <div class="help-item-title">同步方向说明</div>
          <ul class="help-list">
            <li><strong>→ 到 Anki</strong>：将 Weave 卡片导出到 Anki</li>
            <li><strong>← 从 Anki</strong>：从 Anki 导入卡片到 Weave</li>
            <li><strong>⇄ 双向</strong>：智能双向同步（需要激活高级功能）</li>
          </ul>
        </div>
      </div>
      <div class="help-modal-footer">
        <button class="btn btn-primary" onclick={() => showHelpModal = false}>知道了</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* DeckMappingSection 组件样式 - 使用全局样式框架 */

  /* 标题头部布局 */
  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }

  .header-content {
    flex: 1;
  }

  /* 多彩侧边颜色条标题样式 */
  .section-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .section-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    border-radius: 2px;
  }

  /* 紫色主题（牌组同步配置） */
  .section-title.accent-purple::before {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  /* 批量操作菜单按钮 - Cursor 风格 */
  .header-action-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    opacity: 0.6;
  }

  .header-action-btn:hover {
    opacity: 1;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .header-action-btn:active {
    transform: scale(0.95);
    background: var(--background-modifier-active);
  }

  .header-action-btn svg {
    width: 18px;
    height: 18px;
  }

  /* 映射操作菜单按钮 - 与批量操作按钮样式一致 */
  .mapping-menu-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    opacity: 0.6;
  }

  .mapping-menu-btn:hover {
    opacity: 1;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .mapping-menu-btn:active {
    transform: scale(0.95);
    background: var(--background-modifier-active);
  }

  .mapping-menu-btn svg {
    width: 18px;
    height: 18px;
  }

  .mapping-table-container {
    width: 100%;
    overflow-x: auto;
    /* 确保表格在小屏幕上可滚动 */
    -webkit-overflow-scrolling: touch;
  }

  .anki-table {
    width: 100%;
    table-layout: fixed; /* 固定表格布局 */
  }

  /* 为每列设置固定宽度百分比 */
  .anki-table th:nth-child(1),
  .anki-table td:nth-child(1) {
    width: 20%; /* Weave 牌组 */
  }

  .anki-table th:nth-child(2),
  .anki-table td:nth-child(2) {
    width: 25%; /* Anki 牌组 */
  }

  .anki-table th:nth-child(3),
  .anki-table td:nth-child(3) {
    width: 12%; /* 同步方向 */
  }

  .anki-table th:nth-child(4),
  .anki-table td:nth-child(4) {
    width: 15%; /* 内容转换 */
  }

  .anki-table th:nth-child(5),
  .anki-table td:nth-child(5) {
    width: 10%; /* 状态 */
  }

  .anki-table th:nth-child(6),
  .anki-table td:nth-child(6) {
    width: 13%; /* 上次同步 */
  }

  .anki-table th:nth-child(7),
  .anki-table td:nth-child(7) {
    width: 60px; /* 操作 - 固定宽度，只需容纳图标按钮 */
    text-align: center;
  }

  /* 文本省略样式 */
  .anki-table td.truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sync-direction {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .last-sync-time {
    font-size: 13px;
    color: var(--text-muted);
  }

  /* 操作列样式 */
  .actions-cell {
    text-align: center;
    vertical-align: middle;
  }

  /* 空状态样式 */
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
  }

  .empty-state-icon {
    font-size: 48px;
    opacity: 0.3;
    margin-bottom: 12px;
  }

  .empty-state-text {
    font-size: 14px;
    line-height: 1.6;
  }

  /* 信息横幅 */
  .info-banner {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px;
    margin-bottom: 16px;
    background: rgba(59, 130, 246, 0.05);
    border-left: 4px solid var(--weave-info);
    border-radius: var(--weave-radius-md);
  }

  .info-banner.warning {
    background: rgba(245, 158, 11, 0.05);
    border-left-color: var(--weave-warning);
  }

  .banner-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    font-size: 14px;
    line-height: 1.5;
  }

  .banner-text strong {
    display: block;
    margin-bottom: 4px;
  }

  /* 移除未使用的样式 */

  /* 禁用状态提示 */
  .disabled-hint {
    display: block;
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
    font-style: italic;
  }

  /* 平板设备适配 */
  @media (max-width: 1024px) {
    .anki-table th:nth-child(1),
    .anki-table td:nth-child(1) {
      width: 18%;
    }
    
    .anki-table th:nth-child(2),
    .anki-table td:nth-child(2) {
      width: 22%;
    }
    
    .anki-table th:nth-child(6),
    .anki-table td:nth-child(6) {
      width: 60px; /* 操作列保持固定宽度 */
    }
  }

  /* 移动设备：隐藏部分列，保持核心信息 */
  @media (max-width: 768px) {
    .mapping-table-container {
      overflow-x: auto;
      /* 允许横向滚动 */
    }
    
    /* 保持所有列可见，但缩小间距 */
    .anki-table th,
    .anki-table td {
      padding: 8px 4px;
      font-size: 12px;
    }

    /* 移动端：操作按钮触控优化 */
    .mapping-menu-btn {
      width: 44px;
      height: 44px;
      margin: -8px; /* 负边距避免撑大单元格 */
    }
    
    .mapping-menu-btn svg {
      width: 20px;
      height: 20px;
    }
    
    .anki-table th:nth-child(6),
    .anki-table td:nth-child(6) {
      width: 60px; /* 移动端保持固定宽度 */
    }
  }

  /* 🆕 帮助按钮样式增强 - 浅色模式对比度优化 */
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .help-btn {
    color: var(--interactive-accent);
    opacity: 0.8;
  }

  .help-btn:hover {
    opacity: 1;
    color: var(--interactive-accent);
    background: var(--interactive-accent-hover);
  }

  /* 🆕 帮助弹窗样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    backdrop-filter: blur(2px);
  }

  .help-modal {
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 560px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .help-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .help-modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .help-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .help-item {
    margin-bottom: 24px;
  }

  .help-item:last-child {
    margin-bottom: 0;
  }

  .help-item-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .help-item-desc {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .help-list {
    margin: 8px 0 0 0;
    padding-left: 20px;
    list-style: disc;
  }

  .help-list li {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.8;
    margin-bottom: 6px;
  }

  .help-list li strong {
    color: var(--text-normal);
    font-weight: 600;
  }

  .help-modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
  }

  .help-modal-footer .btn {
    min-width: 100px;
  }

  /* 移动端适配 */
  @media (max-width: 640px) {
    .help-modal {
      max-width: 95%;
      margin: 10px;
    }

    .help-modal-header {
      padding: 16px 20px;
    }

    .help-modal-content {
      padding: 20px;
    }

    .help-modal-footer {
      padding: 12px 20px;
    }
  }
</style>


