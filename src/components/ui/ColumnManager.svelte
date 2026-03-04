<script lang="ts">
  import { onMount } from 'svelte';
  import type { ColumnVisibility, ColumnKey, ColumnOrder, ColumnGroupType } from '../tables/types/table-types';
  import { COLUMN_GROUPS } from '../tables/types/table-types';
  import EnhancedIcon from './EnhancedIcon.svelte';

  interface Props {
    visibility: ColumnVisibility;
    columnOrder: ColumnOrder;
    onVisibilityChange: (key: ColumnKey, value: boolean) => void;
    onOrderChange: (newOrder: ColumnOrder) => void;
  }

  let { visibility, columnOrder, onVisibilityChange, onOrderChange }: Props = $props();

  const columnLabels: Record<ColumnKey, string> = {
    front: "正面内容",
    back: "背面内容",
    status: "状态",
    deck: "牌组",
    tags: "标签",
    priority: "优先级",
    created: "创建时间",
    modified: "修改时间",
    next_review: "下次复习",
    retention: "记忆率",
    interval: "间隔",
    difficulty: "难度",
    review_count: "复习次数",
    actions: "操作",
    uuid: "唯一标识符",
    obsidian_block_link: "Obsidian块链接",
    source_document: "来源文档",
    field_template: "字段模板",
    source_document_status: "来源状态",
    // 🆕 题库专用列
    question_type: "题型",
    accuracy: "正确率",
    test_attempts: "测试次数",
    last_test: "最后测试",
    error_level: "错题等级",
    source_card: "关联记忆卡片",
    // 🆕 增量阅读专用列
    ir_title: "标题",
    ir_source_file: "源文档",
    ir_state: "阅读状态",
    ir_priority: "优先级",
    ir_tags: "标签",
    ir_favorite: "收藏",
    ir_next_review: "下次复习",
    ir_review_count: "复习次数",
    ir_reading_time: "阅读时长",
    ir_notes: "笔记",
    ir_extracted_cards: "已提取卡片",
    ir_created: "创建时间",
    ir_decks: "所属牌组",
  };

  // 高级选项展开状态
  const ADVANCED_EXPANDED_KEY = 'weave-column-manager-advanced-expanded';
  let showAdvanced = $state(false);

  // 拖拽状态（扩展为包含分组信息）
  let draggedKey = $state<ColumnKey | null>(null);
  let draggedGroup = $state<ColumnGroupType | null>(null);
  let dragOverKey = $state<ColumnKey | null>(null);

  // 过滤出各分组的字段（添加防御性检查）
  const safeColumnOrder = $derived(columnOrder || []);
  
  const basicColumns = $derived(
    safeColumnOrder.filter(key => 
      COLUMN_GROUPS.basic?.includes(key) && !COLUMN_GROUPS.advanced?.includes(key)
    )
  );

  const reviewColumns = $derived(
    safeColumnOrder.filter(key => 
      COLUMN_GROUPS.review?.includes(key) && 
      !COLUMN_GROUPS.basic?.includes(key) &&
      !COLUMN_GROUPS.advanced?.includes(key)
    )
  );

  const advancedColumns = $derived(
    safeColumnOrder.filter(key => COLUMN_GROUPS.advanced?.includes(key))
  );

  /**
   * 恢复高级选项展开状态
   */
  onMount(() => {
    const saved = localStorage.getItem(ADVANCED_EXPANDED_KEY);
    if (saved !== null) {
      showAdvanced = saved === 'true';
    }
  });

  /**
   * 切换高级选项展开状态
   */
  function toggleAdvanced() {
    showAdvanced = !showAdvanced;
    localStorage.setItem(ADVANCED_EXPANDED_KEY, String(showAdvanced));
  }

  /**
   * 判断字段属于哪个分组
   */
  function getColumnGroup(key: ColumnKey): ColumnGroupType {
    if (COLUMN_GROUPS.advanced.includes(key)) return 'advanced';
    if (COLUMN_GROUPS.review.includes(key) && !COLUMN_GROUPS.basic.includes(key)) {
      return 'review';
    }
    return 'basic';
  }

  /**
   * 判断是否为通用字段
   */
  function isSharedColumn(key: ColumnKey): boolean {
    return COLUMN_GROUPS.shared.includes(key);
  }

  /**
   * 开始拖拽
   */
  function handleDragStart(event: DragEvent, key: ColumnKey, group: ColumnGroupType) {
    draggedKey = key;
    draggedGroup = group;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  /**
   * 拖拽经过
   */
  function handleDragOver(event: DragEvent, key: ColumnKey, group: ColumnGroupType) {
    event.preventDefault();
    
    // 只允许在同一分组内拖拽
    if (draggedGroup !== group) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      return;
    }
    
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverKey = key;
  }

  /**
   * 拖拽离开
   */
  function handleDragLeave() {
    dragOverKey = null;
  }

  /**
   * 放置拖拽项
   */
  function handleDrop(event: DragEvent, dropKey: ColumnKey, dropGroup: ColumnGroupType) {
    event.preventDefault();
    
    // 验证：必须在同一分组内
    if (!draggedKey || draggedGroup !== dropGroup || draggedKey === dropKey) {
      draggedKey = null;
      draggedGroup = null;
      dragOverKey = null;
      return;
    }

    // 在columnOrder中找到两个key的索引
    const draggedIndex = columnOrder.indexOf(draggedKey);
    const dropIndex = columnOrder.indexOf(dropKey);

    if (draggedIndex === -1 || dropIndex === -1) {
      draggedKey = null;
      draggedGroup = null;
      dragOverKey = null;
      return;
    }

    // 重新排序
    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    onOrderChange(newOrder);
    
    // 重置拖拽状态
    draggedKey = null;
    draggedGroup = null;
    dragOverKey = null;
  }

  /**
   * 结束拖拽
   */
  function handleDragEnd() {
    draggedKey = null;
    draggedGroup = null;
    dragOverKey = null;
  }
</script>

<div class="column-manager">
  <!-- 头部 -->
  <div class="column-manager-header">
    <span>显示字段</span>
    <span class="drag-hint">拖拽调整顺序</span>
  </div>

  <!-- 两列布局 -->
  <div class="column-manager-grid">
    <!-- 左列：基础信息 -->
    <div class="column-group">
      <div class="column-group-header">基础信息</div>
      <ul class="column-group-list">
        {#each basicColumns as key}
          <li
            class="column-manager-item"
            class:dragging={draggedKey === key}
            class:drag-over={dragOverKey === key}
            draggable="true"
            ondragstart={(e) => handleDragStart(e, key, 'basic')}
            ondragover={(e) => handleDragOver(e, key, 'basic')}
            ondragleave={handleDragLeave}
            ondrop={(e) => handleDrop(e, key, 'basic')}
            ondragend={handleDragEnd}
          >
            <label>
              <input
                type="checkbox"
                checked={visibility[key]}
                onchange={(e) => onVisibilityChange(key, e.currentTarget.checked)}
              />
              <span class="column-label">
                {columnLabels[key]}
                {#if isSharedColumn(key)}
                  <span class="shared-badge">[通用]</span>
                {/if}
              </span>
            </label>
          </li>
        {/each}
      </ul>
    </div>

    <!-- 右列：复习数据 -->
    <div class="column-group">
      <div class="column-group-header">复习数据</div>
      <ul class="column-group-list">
        {#each reviewColumns as key}
          <li
            class="column-manager-item"
            class:dragging={draggedKey === key}
            class:drag-over={dragOverKey === key}
            draggable="true"
            ondragstart={(e) => handleDragStart(e, key, 'review')}
            ondragover={(e) => handleDragOver(e, key, 'review')}
            ondragleave={handleDragLeave}
            ondrop={(e) => handleDrop(e, key, 'review')}
            ondragend={handleDragEnd}
          >
            <label>
              <input
                type="checkbox"
                checked={visibility[key]}
                onchange={(e) => onVisibilityChange(key, e.currentTarget.checked)}
              />
              <span class="column-label">{columnLabels[key]}</span>
            </label>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <!-- 高级选项（可折叠） -->
  <div class="advanced-section" class:expanded={showAdvanced}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="advanced-section-header" onclick={toggleAdvanced}>
      <span>高级选项（点击{showAdvanced ? '收起' : '展开'}）</span>
      <span class="toggle-icon">{showAdvanced ? '▲' : '▼'}</span>
    </div>
    {#if showAdvanced}
      <ul class="advanced-section-list">
        {#each advancedColumns as key}
          <li
            class="column-manager-item"
            class:dragging={draggedKey === key}
            class:drag-over={dragOverKey === key}
            draggable="true"
            ondragstart={(e) => handleDragStart(e, key, 'advanced')}
            ondragover={(e) => handleDragOver(e, key, 'advanced')}
            ondragleave={handleDragLeave}
            ondrop={(e) => handleDrop(e, key, 'advanced')}
            ondragend={handleDragEnd}
          >
            <label>
              <input
                type="checkbox"
                checked={visibility[key]}
                onchange={(e) => onVisibilityChange(key, e.currentTarget.checked)}
              />
              <span class="column-label">{columnLabels[key]}</span>
            </label>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .column-manager {
    background: var(--background-secondary);
    border-radius: var(--radius-m);
    padding: 0.5rem;
    min-width: 500px;
    max-width: 600px;
  }

  /* 头部 */
  .column-manager-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.5rem;
  }

  .drag-hint {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-weight: 400;
  }

  /* 两列网格布局 */
  .column-manager-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  /* 列分组 */
  .column-group {
    display: flex;
    flex-direction: column;
  }

  .column-group-header {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    padding: 0.5rem 0.5rem 0.25rem;
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 0.25rem;
  }

  .column-group-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* 列表项 */
  .column-manager-item {
    display: flex;
    align-items: center;
    border-radius: var(--radius-s);
    transition: all 0.2s ease;
    cursor: grab;
    margin-bottom: 2px;
  }

  .column-manager-item:active {
    cursor: grabbing;
  }

  .column-manager-item.dragging {
    opacity: 0.5;
    background: var(--background-modifier-hover);
  }

  .column-manager-item.drag-over {
    border-top: 2px solid var(--color-accent);
    margin-top: 2px;
  }

  .column-manager-item label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    flex: 1;
    border-radius: var(--radius-s);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .column-manager-item label:hover {
    background: var(--background-modifier-hover);
  }

  .column-manager-item input[type="checkbox"] {
    accent-color: var(--color-accent);
    flex-shrink: 0;
  }

  /* 字段标签 */
  .column-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  /* 通用字段标签 */
  .shared-badge {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-weight: 400;
    opacity: 0.7;
    margin-left: 0.25rem;
  }

  /* 高级选项区域 */
  .advanced-section {
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary-alt);
    border-radius: var(--radius-s);
    margin-top: 0.5rem;
    overflow: hidden;
  }

  .advanced-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text-muted);
    transition: background-color 0.2s ease;
    user-select: none;
  }

  .advanced-section-header:hover {
    background: var(--background-modifier-hover);
  }

  .toggle-icon {
    font-size: 0.7rem;
    color: var(--text-faint);
    transition: transform 0.2s ease;
  }

  .advanced-section-list {
    list-style: none;
    margin: 0;
    padding: 0.5rem;
    padding-top: 0;
  }

  /* 响应式：小屏幕单列布局 */
  @media (max-width: 500px) {
    .column-manager {
      min-width: unset;
      width: 100%;
      max-width: 100%;
      padding: 0.75rem;
    }

    .column-manager-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .column-manager-header {
      padding: 0.5rem;
    }
    
    .column-group-header {
      padding: 0.75rem 0.5rem 0.5rem;
    }
    
    .column-manager-item label {
      padding: 0.75rem 0.5rem;
    }
  }
</style>
