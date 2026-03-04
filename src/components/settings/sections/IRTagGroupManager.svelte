<!--
  增量阅读标签组管理器
  职责：管理增量阅读的材料类型标签组（IRTagGroup）
  
  功能：
  - 显示已创建的标签组列表
  - 创建/编辑/删除标签组
  - 显示标签组统计信息（文档数、样本量等）
  
  @version 3.0.0
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Notice, Menu } from 'obsidian';
  import type WeavePlugin from '../../../main';
  import type { IRTagGroup, IRTagGroupProfile } from '../../../types/ir-types';
  import { DEFAULT_TAG_GROUP_PROFILE } from '../../../types/ir-types';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';
  import IRTagGroupEditor from './IRTagGroupEditor.svelte';
  import IRTagGroupStatsModal from './IRTagGroupStatsModal.svelte';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';
  import { IRTagGroupService } from '../../../services/incremental-reading/IRTagGroupService';
  import { IRStorageService } from '../../../services/incremental-reading/IRStorageService';

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();

  // 状态管理
  let tagGroups = $state<IRTagGroup[]>([]);
  let profiles = $state<Record<string, IRTagGroupProfile>>({});
  let documentCounts = $state<Record<string, number>>({});
  let isLoading = $state(true);
  let showEditor = $state(false);
  let editingGroup = $state<IRTagGroup | null>(null);
  let loadError = $state<string | null>(null);
  let hasInitialized = $state(false);
  let showStatsModal = $state(false);
  let statsGroup = $state<IRTagGroup | null>(null);
  let statsProfile = $state<IRTagGroupProfile | null>(null);

  // 获取或创建服务
  async function getOrCreateService(): Promise<IRTagGroupService> {
    if (plugin.irTagGroupService) {
      return plugin.irTagGroupService;
    }
    
    const service = new IRTagGroupService(plugin.app);
    await service.initialize();
    plugin.irTagGroupService = service;
    return service;
  }

  // 加载数据
  async function loadData() {
    if (hasInitialized) {
      return;
    }
    hasInitialized = true;
    
    isLoading = true;
    loadError = null;
    
    try {
      const service = await getOrCreateService();
      
      // 获取所有标签组
      const allGroups = await service.getAllGroups();
      tagGroups = allGroups.filter(g => g.id !== 'default');
      
      // 获取统计信息
      const stats = await service.getGroupStats();
      
      const newProfiles: Record<string, IRTagGroupProfile> = {};
      const newCounts: Record<string, number> = {};
      
      for (const stat of stats) {
        newProfiles[stat.group.id] = stat.profile;
        newCounts[stat.group.id] = stat.documentCount;
      }
      
      profiles = newProfiles;
      documentCounts = newCounts;
    } catch (error) {
      loadError = (error as Error).message;
    } finally {
      isLoading = false;
    }
  }

  // 使用 onMount 进行异步初始化（Svelte 5 正确模式）
  onMount(async () => {
    await loadData();
  });

  // 新建标签组
  function handleCreate() {
    editingGroup = null;
    showEditor = true;
  }

  // 编辑标签组
  function handleEdit(group: IRTagGroup) {
    editingGroup = { ...group };
    showEditor = true;
  }

  // 查看统计
  function handleShowStats(group: IRTagGroup) {
    statsGroup = group;
    statsProfile = profiles[group.id] || DEFAULT_TAG_GROUP_PROFILE;
    showStatsModal = true;
  }

  // 关闭统计模态窗
  function handleCloseStats() {
    showStatsModal = false;
    statsGroup = null;
    statsProfile = null;
  }

  // 删除标签组
  async function handleDelete(group: IRTagGroup) {
    if (group.id === 'default') {
      new Notice('不能删除默认标签组');
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      `确定要删除标签组「${group.name}」吗？\n该组下的文档将回归默认组。`,
      { title: '确认删除' }
    );
    
    if (!confirmed) return;

    try {
      const service = await getOrCreateService();
      
      const storage = new IRStorageService(plugin.app);
      await storage.initialize();
      await service.deleteGroup(group.id, {
        getAllChunkData: () => storage.getAllChunkData() as Promise<any>,
        saveChunkData: (d: any) => storage.saveChunkData(d),
        getAllSources: () => storage.getAllSources() as Promise<any>,
        saveSource: (d: any) => storage.saveSource(d)
      });
      hasInitialized = false;
      await loadData();
      new Notice(`已删除标签组「${group.name}」`);
    } catch (error) {
      new Notice('删除失败');
    }
  }

  // 保存标签组
  async function handleSave(group: IRTagGroup) {
    try {
      const service = await getOrCreateService();

      // saveGroup 同时适用于新建和编辑，确保 matchSource 等完整字段被保存
      await service.saveGroup(group);
      // 确保新建时 profile 存在
      if (!editingGroup) {
        await service.getProfile(group.id);
      }
      new Notice(editingGroup ? `已更新标签组「${group.name}」` : `已创建标签组「${group.name}」`);

      showEditor = false;
      editingGroup = null;
      
      // 重新加载数据
      hasInitialized = false;
      await loadData();
    } catch (error) {
      new Notice('保存失败: ' + (error as Error).message);
    }
  }

  // 关闭编辑器
  function handleCloseEditor() {
    showEditor = false;
    editingGroup = null;
  }

  // 格式化参数显示
  function formatFactor(value: number): string {
    return value.toFixed(2) + 'x';
  }

  // 显示操作菜单
  function showActionsMenu(group: IRTagGroup, event: MouseEvent) {
    const menu = new Menu();
    
    menu.addItem((item) => {
      item.setTitle('参数统计')
        .setIcon('bar-chart-2')
        .onClick(() => handleShowStats(group));
    });
    
    menu.addItem((item) => {
      item.setTitle('编辑')
        .setIcon('edit-2')
        .onClick(() => handleEdit(group));
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item.setTitle('删除')
        .setIcon('trash-2')
        .onClick(() => handleDelete(group));
    });
    
    menu.showAtMouseEvent(event);
  }
</script>

<div class="ir-tag-group-manager">
  <!-- 头部 -->
  <div class="manager-header">
    <div class="header-info">
      <div class="header-title">材料类型标签组</div>
      <p class="header-desc">
        按标签对阅读材料分组，每组可学习独立的调度节奏参数
      </p>
    </div>
    <button class="create-btn" onclick={handleCreate}>
      <EnhancedIcon name="plus" size={16} />
      <span>新建标签组</span>
    </button>
  </div>

  <!-- 内容区 -->
  {#if isLoading}
    <div class="loading-state">
      <EnhancedIcon name="loader" size={24} />
      <span>加载中...</span>
    </div>
  {:else if loadError}
    <div class="error-state">
      <EnhancedIcon name="alert-circle" size={24} />
      <span>加载失败: {loadError}</span>
      <button class="retry-btn" onclick={() => { hasInitialized = false; loadData(); }}>
        重试
      </button>
    </div>
  {:else if tagGroups.length === 0}
    <div class="empty-state">
      <EnhancedIcon name="inbox" size={40} />
      <h4>还没有自定义标签组</h4>
      <p>创建标签组来为不同类型的阅读材料定制调度节奏</p>
      <button class="empty-create-btn" onclick={handleCreate}>
        <EnhancedIcon name="plus" size={16} />
        创建第一个标签组
      </button>
    </div>
  {:else}
    <div class="tag-group-table-container">
      <table class="tag-group-table">
        <thead>
          <tr>
            <th class="col-name">名称</th>
            <th class="col-tags">标签</th>
            <th class="col-docs">文档数</th>
            <th class="col-factor">间隔因子</th>
            <th class="col-samples">样本量</th>
            <th class="col-priority">优先级</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each tagGroups as group (group.id)}
            {@const profile = profiles[group.id] || DEFAULT_TAG_GROUP_PROFILE}
            {@const docCount = documentCounts[group.id] || 0}
            <tr>
              <td class="col-name">
                <span class="group-name">{group.name}</span>
              </td>
              <td class="col-tags">
                <div class="tags-cell">
                  {#each group.matchAnyTags.slice(0, 3) as tag}
                    <span class="tag-badge">{tag}</span>
                  {/each}
                  {#if group.matchAnyTags.length > 3}
                    <span class="tag-more">+{group.matchAnyTags.length - 3}</span>
                  {/if}
                </div>
              </td>
              <td class="col-docs">{docCount}</td>
              <td class="col-factor">{formatFactor(profile.intervalFactorBase)}</td>
              <td class="col-samples">{profile.sampleCount}</td>
              <td class="col-priority">{group.matchPriority}</td>
              <td class="col-actions">
                <button 
                  class="menu-btn"
                  onclick={(e) => showActionsMenu(group, e)}
                  title="更多操作"
                >
                  <EnhancedIcon name="more-horizontal" size={18} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- 默认组提示 -->
    <div class="default-group-hint">未匹配任何标签组的文档将使用默认组参数</div>
  {/if}
</div>

<!-- 编辑器弹窗 -->
{#if showEditor}
  <IRTagGroupEditor
    {plugin}
    group={editingGroup}
    onSave={handleSave}
    onCancel={handleCloseEditor}
  />
{/if}

<!-- 统计模态窗 -->
{#if showStatsModal && statsGroup && statsProfile}
  <IRTagGroupStatsModal
    group={statsGroup}
    profile={statsProfile}
    onClose={handleCloseStats}
  />
{/if}

<style>
  .ir-tag-group-manager {
    margin: 12px 0;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 10px;
  }

  /* 头部 */
  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .header-info {
    flex: 1;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .header-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    white-space: nowrap;
  }

  .create-btn:hover {
    background: var(--interactive-accent-hover);
  }

  /* 加载状态 */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px;
    color: var(--text-muted);
  }

  /* 错误状态 */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px;
    color: var(--text-error);
    text-align: center;
  }

  .retry-btn {
    margin-top: 8px;
    padding: 6px 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-normal);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .retry-btn:hover {
    background: var(--background-secondary);
    border-color: var(--interactive-accent);
  }

  /* 空状态 */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 20px;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-state h4 {
    margin: 12px 0 6px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .empty-state p {
    margin: 0 0 16px;
    font-size: 0.85rem;
  }

  .empty-create-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .empty-create-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: var(--background-primary);
  }

  /* 表格容器 */
  .tag-group-table-container {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tag-group-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .tag-group-table th,
  .tag-group-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .tag-group-table th {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--background-secondary-alt);
    white-space: nowrap;
  }

  .tag-group-table tbody tr:hover {
    background: var(--background-secondary-alt);
  }

  .tag-group-table tbody tr:last-child td {
    border-bottom: none;
  }

  /* 列宽度 */
  .col-name { min-width: 100px; }
  .col-tags { min-width: 140px; }
  .col-docs,
  .col-factor,
  .col-samples,
  .col-priority { 
    width: 80px; 
    text-align: center;
  }
  .col-actions { 
    width: 50px; 
    text-align: center;
  }

  .tag-group-table td.col-docs,
  .tag-group-table td.col-factor,
  .tag-group-table td.col-samples,
  .tag-group-table td.col-priority,
  .tag-group-table td.col-actions {
    text-align: center;
  }

  .group-name {
    font-weight: 600;
    color: var(--text-normal);
  }

  .tags-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag-badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 0.7rem;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    border-radius: 4px;
  }

  .tag-more {
    display: inline-block;
    padding: 2px 6px;
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  /* 操作菜单按钮 */
  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .menu-btn:hover {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  /* 默认组提示 */
  .default-group-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--background-primary);
    border-radius: 6px;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
</style>
