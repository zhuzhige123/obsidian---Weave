<!--
  ReadingMaterialSidebarView - 增量阅读侧边栏组件
  
  整合日历视图和材料列表，适配 Obsidian 侧边栏
  支持层级目录视图和批量导入
  
  @module components/incremental-reading/ReadingMaterialSidebarView
  @version 2.1.0
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Notice } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import type { ReadingMaterial, FolderNode } from '../../types/incremental-reading-types';
  import { ReadingCategory } from '../../types/incremental-reading-types';
  import { logger } from '../../utils/logger';
  import RescheduleMaterialModal from './RescheduleMaterialModal.svelte';
  import MaterialImportModal from './MaterialImportModal.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import type { BatchImportResult } from '../../services/incremental-reading/ReadingMaterialManager';

  // Props
  interface Props {
    plugin: WeavePlugin;
    onMaterialSelect: (materialId: string) => Promise<void>;
    onMaterialAction: (action: string, materialId: string) => Promise<void>;
  }

  let { plugin, onMaterialSelect, onMaterialAction }: Props = $props();

  // ===== 状态 =====
  let materials = $state<ReadingMaterial[]>([]);
  let selectedCategory = $state<ReadingCategory>(ReadingCategory.Later);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let serviceReady = $state(false);
  
  // 视图模式：'calendar' | 'hierarchy'
  let viewMode = $state<'calendar' | 'hierarchy'>('hierarchy');
  
  // 日历状态
  let currentDate = $state(new Date());
  let selectedDate = $state(new Date());
  
  // 右键菜单状态
  let contextMenuMaterialId = $state<string | null>(null);
  let contextMenuPosition = $state({ x: 0, y: 0 });
  
  // 拖拽状态
  let draggedMaterial = $state<ReadingMaterial | null>(null);
  let dragOverIndex = $state<number | null>(null);
  
  // 调度模态窗状态
  let showRescheduleModal = $state(false);
  let rescheduleTarget = $state<ReadingMaterial | null>(null);
  
  // 导入模态窗状态
  let showImportModal = $state(false);
  
  // 层级视图折叠状态
  let expandedFolders = $state<Set<string>>(new Set(['']));  // 根目录默认展开


  // ===== 派生数据 =====
  
  // 分类统计
  let laterCount = $derived(materials.filter(m => m.category === ReadingCategory.Later).length);
  let readingCount = $derived(materials.filter(m => m.category === ReadingCategory.Reading).length);
  let favoriteCount = $derived(materials.filter(m => m.category === ReadingCategory.Favorite).length);

  // 过滤当前分类的材料（列表模式）
  let filteredMaterials = $derived(materials
    .filter(m => m.category === selectedCategory)
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
    }));

  // 获取选中日期的材料（日历模式）
  let selectedDateMaterials = $derived.by(() => {
    return materials.filter(m => {
      if (!m.fsrs?.due) return false;
      const dueDate = new Date(m.fsrs.due);
      return isSameDay(dueDate, selectedDate);
    }).sort((a, b) => b.priority - a.priority);
  });
  
  // 统计数据
  let stats = $derived.by(() => {
    const todayMaterials = materials.filter(m => {
      if (!m.fsrs?.due) return false;
      return isSameDay(new Date(m.fsrs.due), new Date());
    });
    const completedCount = materials.filter(m => m.progress.percentage >= 100).length;
    
    return {
      todayCount: todayMaterials.length,
      completedCount,
      totalCount: materials.length
    };
  });

  // 层级目录结构
  let hierarchyRoot = $derived.by(() => {
    if (viewMode !== 'hierarchy') return null;
    return buildHierarchy(filteredMaterials);
  });

  // ===== 层级目录构建 =====
  
  /**
   * 构建层级目录结构
   */
  function buildHierarchy(materialList: ReadingMaterial[]): FolderNode {
    const root: FolderNode = {
      name: 'Vault',
      path: '',
      materials: [],
      children: [],
      expanded: true,
      stats: { totalCount: 0, avgProgress: 0, dueCount: 0 }
    };

    for (const material of materialList) {
      const pathParts = material.filePath.split('/');
      let currentNode = root;

      // 遍历路径，创建/查找文件夹节点
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        const folderPath = pathParts.slice(0, i + 1).join('/');
        let childNode = currentNode.children.find(c => c.name === folderName);

        if (!childNode) {
          childNode = {
            name: folderName,
            path: folderPath,
            materials: [],
            children: [],
            expanded: expandedFolders.has(folderPath),
            stats: { totalCount: 0, avgProgress: 0, dueCount: 0 }
          };
          currentNode.children.push(childNode);
        }

        currentNode = childNode;
      }

      // 将材料添加到最终文件夹
      currentNode.materials.push(material);
    }

    // 计算统计信息
    calculateFolderStats(root);

    return root;
  }

  /**
   * 递归计算文件夹统计信息
   */
  function calculateFolderStats(node: FolderNode): void {
    let totalCount = node.materials.length;
    let totalProgress = node.materials.reduce((sum, m) => sum + m.progress.percentage, 0);
    let dueCount = node.materials.filter(m => {
      if (!m.fsrs?.due) return false;
      return isSameDay(new Date(m.fsrs.due), new Date());
    }).length;

    // 递归处理子文件夹
    for (const child of node.children) {
      calculateFolderStats(child);
      totalCount += child.stats.totalCount;
      totalProgress += child.stats.avgProgress * child.stats.totalCount;
      dueCount += child.stats.dueCount;
    }

    node.stats = {
      totalCount,
      avgProgress: totalCount > 0 ? Math.round(totalProgress / totalCount) : 0,
      dueCount
    };
  }

  /**
   * 切换文件夹展开状态
   */
  function toggleFolderExpand(path: string): void {
    const newSet = new Set(expandedFolders);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    expandedFolders = newSet;
  }

  // ===== 工具函数 =====
  
  function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  
  function getMonthDays(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  }
  
  function getMaterialsForDate(date: Date): ReadingMaterial[] {
    return materials.filter(m => {
      if (!m.fsrs?.due) return false;
      return isSameDay(new Date(m.fsrs.due), date);
    });
  }
  
  function formatPeriod(): string {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    return `${year}年${month}月`;
  }

  function formatDueDate(material: ReadingMaterial): string {
    if (!material.fsrs?.due) return '未开始';
    
    const due = new Date(material.fsrs.due);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return '已过期';
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays < 7) return `${diffDays}天后`;
    return `${Math.floor(diffDays / 7)}周后`;
  }


  // ===== 事件处理 =====
  
  async function loadMaterials(): Promise<void> {
    try {
      loading = true;
      error = null;

      if (!plugin.readingMaterialManager) {
        // 优化：减少等待时间到2秒（20 * 100ms）
        const maxAttempts = 20;
        const interval = 100;
        
        for (let i = 0; i < maxAttempts; i++) {
          if (plugin.readingMaterialManager) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        if (!plugin.readingMaterialManager) {
          logger.warn('[ReadingMaterialSidebarView] 增量阅读服务未初始化');
          serviceReady = false;
          materials = [];
          return;
        }
      }

      serviceReady = true;
      const loaded = await plugin.readingMaterialManager.getAllMaterials();
      materials = loaded;

      if (selectedCategory === ReadingCategory.Later) {
        const hasLater = loaded.some(m => m.category === ReadingCategory.Later);
        const hasReading = loaded.some(m => m.category === ReadingCategory.Reading);
        if (!hasLater && hasReading) {
          selectedCategory = ReadingCategory.Reading;
        }
      }
      logger.debug('[ReadingMaterialSidebarView] 已加载材料:', materials.length);
    } catch (e) {
      error = e instanceof Error ? e.message : '加载失败';
      logger.error('[ReadingMaterialSidebarView] 加载材料失败:', e);
    } finally {
      loading = false;
    }
  }

  export async function refresh(): Promise<void> {
    await loadMaterials();
  }

  async function handleMaterialClick(material: ReadingMaterial): Promise<void> {
    try {
      const file = plugin.app.vault.getAbstractFileByPath(material.filePath);
      if (file) {
        const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
        const linkToOpen = (material.resumeLink && material.resumeLink.trim().length > 0)
          ? material.resumeLink
          : material.filePath;
        await plugin.app.workspace.openLinkText(linkToOpen, contextPath, false);
      }
    } catch {
    }
    await onMaterialSelect(material.uuid);
  }

  function handleContextMenu(event: MouseEvent, material: ReadingMaterial): void {
    event.preventDefault();
    contextMenuMaterialId = material.uuid;
    contextMenuPosition = { x: event.clientX, y: event.clientY };
  }

  function closeContextMenu(): void {
    contextMenuMaterialId = null;
  }


  async function handleMenuAction(action: string): Promise<void> {
    if (contextMenuMaterialId) {
      await onMaterialAction(action, contextMenuMaterialId);
      closeContextMenu();
      await loadMaterials();
    }
  }

  function handleClickOutside(): void {
    if (contextMenuMaterialId) {
      closeContextMenu();
    }
  }

  // 拖拽处理
  function handleDragStart(event: DragEvent, material: ReadingMaterial): void {
    draggedMaterial = material;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', material.uuid);
    }
  }

  function handleDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex = index;
  }

  function handleDragLeave(): void {
    dragOverIndex = null;
  }

  function handleDragEnd(): void {
    draggedMaterial = null;
    dragOverIndex = null;
  }

  async function handleDrop(targetIndex: number): Promise<void> {
    if (!draggedMaterial || !plugin.readingMaterialManager) {
      handleDragEnd();
      return;
    }

    const sourceIndex = filteredMaterials.findIndex(m => m.uuid === draggedMaterial!.uuid);
    if (sourceIndex === targetIndex || sourceIndex === -1) {
      handleDragEnd();
      return;
    }

    try {
      let newPriority: number;
      
      if (targetIndex === 0) {
        newPriority = filteredMaterials[0].priority + 1;
      } else if (targetIndex >= filteredMaterials.length - 1) {
        newPriority = filteredMaterials[filteredMaterials.length - 1].priority - 1;
      } else {
        const prevPriority = filteredMaterials[targetIndex - 1].priority;
        const nextPriority = filteredMaterials[targetIndex].priority;
        newPriority = (prevPriority + nextPriority) / 2;
      }

      await plugin.readingMaterialManager.updatePriority(draggedMaterial.uuid, newPriority);
      await loadMaterials();
    } catch (e) {
      logger.error('[ReadingMaterialSidebarView] 更新优先级失败:', e);
    } finally {
      handleDragEnd();
    }
  }


  // 日历导航
  function navigate(delta: number): void {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    currentDate = newDate;
  }
  
  function goToToday(): void {
    currentDate = new Date();
    selectedDate = new Date();
  }
  
  function selectDateInCalendar(date: Date): void {
    selectedDate = date;
  }
  
  function openReschedule(material: ReadingMaterial): void {
    rescheduleTarget = material;
    showRescheduleModal = true;
  }
  
  async function handleReschedule(newDate: Date): Promise<void> {
    if (!rescheduleTarget || !plugin.readingMaterialManager) return;
    
    try {
      await plugin.readingMaterialManager.rescheduleMaterial(
        rescheduleTarget.uuid,
        newDate
      );
      await loadMaterials();
    } catch (err) {
      logger.error('[ReadingMaterialSidebarView] 重新调度失败:', err);
    }
  }

  // ===== 导入处理 =====
  
  function openImportModal(): void {
    showImportModal = true;
  }

  function handleImportComplete(result: BatchImportResult): void {
    showImportModal = false;
    
    // 显示导入结果通知
    if (result.errors.length > 0) {
      new Notice(`导入完成：${result.success} 个成功，${result.skipped} 个跳过，${result.errors.length} 个失败`);
    } else if (result.skipped > 0) {
      new Notice(`导入完成：${result.success} 个成功，${result.skipped} 个已存在`);
    } else {
      new Notice(`成功导入 ${result.success} 个阅读材料`);
    }
    
    // 刷新材料列表
    loadMaterials();
  }

  let handleDataUpdate: (() => void) | null = null;

  onMount(() => {
    void loadMaterials();
    document.addEventListener('click', handleClickOutside);

    handleDataUpdate = () => {
      void loadMaterials();
    };
    window.addEventListener('Weave:ir-data-updated', handleDataUpdate);

    return () => {
      if (handleDataUpdate) {
        window.removeEventListener('Weave:ir-data-updated', handleDataUpdate);
      }
    };
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>


<div class="reading-sidebar-view">
  <!-- 顶部工具栏：导入按钮 + 视图切换 + 统计 -->
  <div class="sidebar-header">
    <button class="import-btn" onclick={openImportModal} title="导入阅读材料">
      <ObsidianIcon name="folder-input" size={16} />
      <span>导入</span>
    </button>
    <div class="view-toggle">
      <button 
        class="toggle-btn" 
        class:active={viewMode === 'hierarchy'}
        onclick={() => viewMode = 'hierarchy'}
        title="层级视图"
      >
        <ObsidianIcon name="folder-tree" size={16} />
      </button>
      <button 
        class="toggle-btn" 
        class:active={viewMode === 'calendar'}
        onclick={() => viewMode = 'calendar'}
        title="日历视图"
      >
        <ObsidianIcon name="calendar" size={16} />
      </button>
    </div>
    <div class="quick-stats">
      <span class="stat" title="今日待读">
        <ObsidianIcon name="clock" size={14} />
        <span>{stats.todayCount}</span>
      </span>
      <span class="stat" title="总材料">
        <ObsidianIcon name="library" size={14} />
        <span>{stats.totalCount}</span>
      </span>
    </div>
  </div>


  {#if loading}
    <div class="loading-state">加载中...</div>
  {:else if !serviceReady}
    <div class="loading-state">
      <span>服务初始化中...</span>
      <button class="retry-btn" onclick={loadMaterials}>重试</button>
    </div>
  {:else if error}
    <div class="error-state">{error}</div>
  {:else}
    <!-- 层级视图 -->
    {#if viewMode === 'hierarchy'}
      <div class="category-tabs">
        <button class="category-tab" class:active={selectedCategory === ReadingCategory.Later}
          onclick={() => selectedCategory = ReadingCategory.Later}>
          待读 ({laterCount})
        </button>
        <button class="category-tab" class:active={selectedCategory === ReadingCategory.Reading}
          onclick={() => selectedCategory = ReadingCategory.Reading}>
          阅读中 ({readingCount})
        </button>
        <button class="category-tab" class:active={selectedCategory === ReadingCategory.Favorite}
          onclick={() => selectedCategory = ReadingCategory.Favorite}>
          收藏 ({favoriteCount})
        </button>
      </div>

      <div class="hierarchy-view">
        {#if hierarchyRoot && (hierarchyRoot.materials.length > 0 || hierarchyRoot.children.length > 0)}
          {@render FolderTreeNode(hierarchyRoot, 0)}
        {:else}
          <div class="empty-state">
            {#if selectedCategory === ReadingCategory.Later}暂无待读材料
            {:else if selectedCategory === ReadingCategory.Reading}暂无正在阅读的材料
            {:else}暂无收藏材料{/if}
          </div>
        {/if}
      </div>


    <!-- 日历视图 -->
    {:else}
      <div class="calendar-section">
        <div class="calendar-nav">
          <button class="nav-btn" onclick={() => navigate(-1)} title="上一月">
            <ObsidianIcon name="chevron-left" size={16} />
          </button>
          <span class="period">{formatPeriod()}</span>
          <button class="nav-btn" onclick={() => navigate(1)} title="下一月">
            <ObsidianIcon name="chevron-right" size={16} />
          </button>
          <button class="today-btn" onclick={goToToday}>今天</button>
        </div>
        
        <div class="mini-calendar">
          <div class="weekday-header">
            {#each ['日', '一', '二', '三', '四', '五', '六'] as day}
              <div class="weekday-cell">{day}</div>
            {/each}
          </div>
          <div class="calendar-grid">
            {#each getMonthDays(currentDate.getFullYear(), currentDate.getMonth()) as day}
              {@const dayMaterials = getMaterialsForDate(day.date)}
              {@const isToday = isSameDay(day.date, new Date())}
              {@const isSelected = isSameDay(day.date, selectedDate)}
              <button class="day-cell"
                class:other-month={!day.isCurrentMonth}
                class:today={isToday}
                class:selected={isSelected}
                class:has-items={dayMaterials.length > 0}
                onclick={() => selectDateInCalendar(day.date)}>
                <span class="day-num">{day.date.getDate()}</span>
                {#if dayMaterials.length > 0}
                  <div class="activity-dots">
                    {#each dayMaterials.slice(0, 4) as material}
                      {@const progressLevel = material.progress.percentage >= 80 ? 'high-progress' : material.progress.percentage >= 40 ? 'medium-progress' : material.progress.percentage > 0 ? 'low-progress' : 'new-material'}
                      <div class="activity-dot {progressLevel}"></div>
                    {/each}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>


        <!-- 选中日期的材料列表 -->
        <div class="date-materials">
          <div class="date-header">
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 ({selectedDateMaterials.length}项)
          </div>
          {#if selectedDateMaterials.length === 0}
            <div class="empty-state">该日期无到期材料</div>
          {:else}
            <div class="date-material-list">
              {#each selectedDateMaterials as material (material.uuid)}
                <div class="date-material-item"
                  onclick={() => handleMaterialClick(material)}
                  onkeydown={(e) => e.key === 'Enter' && handleMaterialClick(material)}
                  oncontextmenu={(e) => handleContextMenu(e, material)}
                  role="button" tabindex="0">
                  <div class="material-info">
                    <div class="material-title-row">
                      <span class="material-title" title={material.title}>{material.title}</span>
                      <span class="material-progress-badge">{material.progress.percentage}%</span>
                    </div>
                    <div class="material-meta">
                      <span class="due-info">{formatDueDate(material)}</span>
                    </div>
                  </div>
                  <button class="reschedule-btn" title="调整日期"
                    onclick={(e) => { e.stopPropagation(); openReschedule(material); }}>
                    <ObsidianIcon name="calendar-clock" size={16} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}


  <!-- 右键菜单 -->
  {#if contextMenuMaterialId}
    <div class="context-menu" style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;">
      {#if selectedCategory !== ReadingCategory.Later}
        <button class="menu-item" onclick={() => handleMenuAction('move-to-later')}>移动到待读</button>
      {/if}
      {#if selectedCategory !== ReadingCategory.Reading}
        <button class="menu-item" onclick={() => handleMenuAction('move-to-reading')}>移动到正在阅读</button>
      {/if}
      {#if selectedCategory !== ReadingCategory.Favorite}
        <button class="menu-item" onclick={() => handleMenuAction('move-to-favorite')}>添加到收藏</button>
      {/if}
      <div class="menu-divider"></div>
      <button class="menu-item" onclick={() => handleMenuAction('archive')}>归档</button>
      <button class="menu-item danger" onclick={() => handleMenuAction('delete')}>删除</button>
    </div>
  {/if}
</div>

<!-- 调度模态窗 -->
{#if showRescheduleModal && rescheduleTarget}
  <RescheduleMaterialModal
    {plugin}
    material={rescheduleTarget}
    onClose={() => { showRescheduleModal = false; rescheduleTarget = null; }}
    onReschedule={handleReschedule}
  />
{/if}

<!-- 导入模态窗 -->
<MaterialImportModal
  {plugin}
  bind:open={showImportModal}
  onClose={() => showImportModal = false}
  onImportComplete={handleImportComplete}
/>

<!-- 文件夹树节点组件 -->
{#snippet FolderTreeNode(node: FolderNode, depth: number)}
  <div class="folder-node" style="--depth: {depth}">
    <!-- 文件夹头部（非根节点显示） -->
    {#if node.path !== ''}
      <button 
        class="folder-header"
        onclick={() => toggleFolderExpand(node.path)}
      >
        <span class="expand-icon" class:expanded={expandedFolders.has(node.path)}>
          <ObsidianIcon name="chevron-right" size={14} />
        </span>
        <ObsidianIcon name={expandedFolders.has(node.path) ? 'folder-open' : 'folder'} size={16} />
        <span class="folder-name">{node.name}</span>
        <span class="folder-stats">
          {node.stats.totalCount} | {node.stats.avgProgress}%
        </span>
      </button>
    {/if}

    <!-- 子内容（展开时显示） -->
    {#if node.path === '' || expandedFolders.has(node.path)}
      <!-- 子文件夹 -->
      {#each node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')) as child (child.path)}
        {@render FolderTreeNode(child, depth + 1)}
      {/each}

      <!-- 该文件夹下的材料 -->
      {#each node.materials.sort((a, b) => b.priority - a.priority) as material (material.uuid)}
        <div 
          class="hierarchy-material-item"
          style="--depth: {depth + 1}"
          onclick={() => handleMaterialClick(material)}
          oncontextmenu={(e) => handleContextMenu(e, material)}
          onkeydown={(e) => e.key === 'Enter' && handleMaterialClick(material)}
          role="button"
          tabindex="0"
        >
          <ObsidianIcon name="file-text" size={16} />
          <span class="material-title" title={material.title}>{material.title}</span>
          <span class="material-progress-badge">{material.progress.percentage}%</span>
        </div>
      {/each}
    {/if}
  </div>
{/snippet}


<style>
  .reading-sidebar-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: 12px;
    overflow: hidden;
  }

  /* 顶部工具栏 */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .view-toggle {
    display: flex;
    gap: 2px;
    background: var(--background-secondary);
    border-radius: 4px;
    padding: 2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
  .toggle-btn.active { background: var(--interactive-accent); color: var(--text-on-accent); }

  .quick-stats {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .stat { 
    display: flex; 
    align-items: center; 
    gap: 6px; 
  }


  /* 分类标签 */
  .category-tabs {
    display: flex;
    gap: 2px;
    padding: 8px;
    flex-shrink: 0;
  }

  .category-tab {
    flex: 1;
    padding: 5px 4px;
    border: none;
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .category-tab:hover { background: var(--background-modifier-hover); }
  .category-tab.active { background: var(--interactive-accent); color: var(--text-on-accent); }

  .material-title {
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    flex: 1;
    min-width: 0;
  }

  .material-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .material-progress-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--interactive-accent);
    background: var(--interactive-accent-hover);
    padding: 1px 6px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .material-meta {
    display: flex;
    justify-content: flex-start;
    font-size: 11px;
    color: var(--text-muted);
  }

  .due-info {
    color: var(--text-muted);
  }

  .progress { color: var(--interactive-accent); }


  /* 日历部分 */
  .calendar-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px;
    flex-shrink: 0;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .nav-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }

  .period {
    flex: 1;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .today-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .today-btn:hover { 
    background: var(--background-modifier-hover); 
    color: var(--text-normal);
  }

  /* 迷你日历 */
  .mini-calendar {
    padding: 0 8px;
    flex-shrink: 0;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 4px;
  }

  .weekday-cell {
    text-align: center;
    font-size: 10px;
    color: var(--text-muted);
    padding: 2px;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 4px 2px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    min-height: 48px;
    transition: all 0.15s;
    gap: 2px;
  }

  .day-cell:hover { background: var(--background-modifier-hover); }
  .day-cell.other-month { opacity: 0.3; }
  .day-cell.today { border: 2px solid var(--interactive-accent); }
  .day-cell.selected { background: var(--interactive-accent); transform: scale(1.05); box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb, 124, 58, 237), 0.3); }
  .day-cell.selected .day-num { color: var(--text-on-accent); }
  .day-cell.has-items .day-num { font-weight: 600; }

  .day-num { font-size: 13px; color: var(--text-normal); line-height: 1; }
  .day-count { display: none; } /* 隐藏数字，改用彩色圆点 */
  .day-cell.selected .day-count { color: var(--text-on-accent); opacity: 0.8; }

  /* 彩色热力圆点容器 */
  .activity-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    min-height: 10px;
    flex-shrink: 0;
  }

  .activity-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* 根据进度显示不同颜色 */
  .activity-dot.high-progress {
    background: var(--text-success);
  }

  .activity-dot.medium-progress {
    background: var(--text-warning);
  }

  .activity-dot.low-progress {
    background: var(--text-error);
  }

  .activity-dot.new-material {
    background: var(--interactive-accent);
  }


  /* 选中日期材料 */
  .date-materials {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    border-top: 1px solid var(--background-modifier-border);
    margin-top: 8px;
    min-height: 0; /* 防止 flex 子元素撑开 */
  }

  .date-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .date-material-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .date-material-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--background-secondary);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .date-material-item:hover { background: var(--background-modifier-hover); }

  .material-info { flex: 1; min-width: 0; }

  .reschedule-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .reschedule-btn:hover { background: var(--background-modifier-hover); color: var(--interactive-accent); }

  /* 状态 - 添加 pointer-events: none 防止遮挡点击 */
  .loading-state, .error-state, .empty-state {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
    pointer-events: none;
  }

  .error-state { color: var(--text-error); }

  /* 重试按钮需要可点击 */
  .retry-btn {
    margin-top: 8px;
    padding: 4px 10px;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: transparent;
    color: var(--interactive-accent);
    font-size: 11px;
    cursor: pointer;
    pointer-events: auto;
  }

  .retry-btn:hover { background: var(--interactive-accent); color: var(--text-on-accent); }


  /* 右键菜单 */
  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 140px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-normal);
    text-align: left;
    cursor: pointer;
    font-size: 12px;
  }

  .menu-item:hover { background: var(--background-modifier-hover); }
  .menu-item.danger { color: var(--text-error); }

  .menu-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 0;
  }

  /* 导入按钮 */
  .import-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .import-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 层级视图 */
  .hierarchy-view {
    flex: 1;
    overflow-y: auto;
    padding: 0 4px 8px;
  }

  .folder-node {
    --indent: calc(var(--depth, 0) * 12px);
  }

  .folder-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 8px 4px calc(8px + var(--indent));
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-normal);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .folder-header:hover {
    background: var(--background-modifier-hover);
  }

  .expand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .folder-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-stats {
    font-size: 10px;
    color: var(--text-muted);
    padding: 1px 6px;
    background: var(--background-secondary);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .hierarchy-material-item {
    --indent: calc(var(--depth, 0) * 12px);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px calc(8px + var(--indent));
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.1s;
    color: var(--text-muted);
  }

  .hierarchy-material-item:hover {
    background: var(--background-modifier-hover);
  }

  .hierarchy-material-item .material-title {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hierarchy-material-item .material-progress-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--interactive-accent);
    background: var(--interactive-accent-hover);
    padding: 1px 6px;
    border-radius: 10px;
    flex-shrink: 0;
  }
</style>
