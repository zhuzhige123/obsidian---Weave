<script lang="ts">
  /**
   * 移动端卡片管理导航菜单组件
   * 
   * Part B: 卡片管理界面的底部弹出导航菜单
   * 与牌组学习界面的 MobileNavMenu 保持一致的菜单结构
   * 包含：功能切换、卡片操作、批量操作、视图专用功能
   * 
   * 注意：筛选排序功能已移至全局侧边筛选栏，此处不再显示
   * 
   * @module components/study/MobileCardManagementMenu
   * @version 1.2.0
   * @requirements 13.1, 13.2, 13.3, 13.4
   */
  import BottomSheetModal from '../ui/BottomSheetModal.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  interface MenuItem {
    id: string;
    icon: string;
    label: string;
    active?: boolean;
  }

  interface MenuSection {
    title: string;
    items: MenuItem[];
  }

  interface Props {
    isOpen: boolean;
    currentFunction?: string;
    currentView?: 'table' | 'grid' | 'kanban';
    tableViewMode?: 'basic' | 'review' | 'questionBank';
    gridLayout?: 'fixed' | 'masonry';
    kanbanLayoutMode?: 'compact' | 'comfortable' | 'spacious';
    enableCardLocationJump?: boolean;
    onClose: () => void;
    onMenuItemClick: (itemId: string) => void;
  }

  let {
    isOpen = false,
    currentFunction = 'card-management',
    currentView = 'table',
    tableViewMode = 'basic',
    gridLayout = 'fixed',
    kanbanLayoutMode = 'comfortable',
    enableCardLocationJump = false,
    onClose,
    onMenuItemClick
  }: Props = $props();

  // 基础菜单分类配置
  const baseMenuSections: MenuSection[] = [
    {
      title: '功能切换',
      items: [
        { id: 'deck-study', icon: 'graduation-cap', label: '牌组学习' },
        { id: 'card-management', icon: 'list', label: '卡片管理' },
        { id: 'ai-assistant', icon: 'bot', label: 'AI助手' }
      ]
    },
    {
      title: '卡片操作',
      items: [
        { id: 'new-card', icon: 'plus', label: '新建卡片' },
        { id: 'import-cards', icon: 'download', label: '导入卡片' },
        { id: 'export-cards', icon: 'upload', label: '导出卡片' }
      ]
    },
    {
      title: '批量操作',
      items: [
        { id: 'multi-select', icon: 'check-square', label: '多选模式' },
        { id: 'batch-delete', icon: 'trash-2', label: '批量删除' },
        { id: 'batch-move', icon: 'folder', label: '批量移动' }
      ]
    }
  ];

  // 根据当前视图动态生成菜单
  const menuSections = $derived(() => {
    const sections = [...baseMenuSections];
    
    // 表格视图专用功能
    if (currentView === 'table') {
      sections.push({
        title: '表格视图',
        items: [
          { id: 'table-basic', icon: 'table', label: '基础信息模式', active: tableViewMode === 'basic' },
          { id: 'table-review', icon: 'history', label: '复习历史模式', active: tableViewMode === 'review' },
          { id: 'table-question-bank', icon: 'edit-3', label: '考试牌组模式', active: tableViewMode === 'questionBank' },
          { id: 'column-manager', icon: 'columns', label: '字段管理' }
        ]
      });
    }
    
    // 网格视图专用功能
    if (currentView === 'grid') {
      sections.push({
        title: '网格视图',
        items: [
          { id: 'grid-fixed', icon: 'grid', label: '固定布局', active: gridLayout === 'fixed' },
          { id: 'grid-masonry', icon: 'layout-grid', label: '瀑布流布局', active: gridLayout === 'masonry' },
          { id: 'card-location-jump', icon: 'external-link', label: '定位跳转模式', active: enableCardLocationJump }
        ]
      });
    }
    
    // 看板视图专用功能
    if (currentView === 'kanban') {
      sections.push({
        title: '看板视图',
        items: [
          { id: 'kanban-compact', icon: 'minimize-2', label: '紧凑模式', active: kanbanLayoutMode === 'compact' },
          { id: 'kanban-comfortable', icon: 'maximize-2', label: '舒适模式', active: kanbanLayoutMode === 'comfortable' },
          { id: 'kanban-spacious', icon: 'expand', label: '宽松模式', active: kanbanLayoutMode === 'spacious' }
        ]
      });
    }
    
    return sections;
  });

  function handleItemClick(itemId: string) {
    onMenuItemClick(itemId);
    onClose();
  }
</script>

<BottomSheetModal {isOpen} {onClose} height="auto">
  <div class="mobile-card-management-menu">
    {#each menuSections() as section}
      <div class="menu-section">
        <div class="menu-section-title">{section.title}</div>
        <div class="menu-items">
          {#each section.items as item}
            <button
              class="menu-item"
              class:active={item.id === currentFunction || item.active}
              onclick={() => handleItemClick(item.id)}
            >
              <span class="menu-item-icon">
                <ObsidianIcon name={item.icon} size={16} />
              </span>
              <span class="menu-item-text">{item.label}</span>
              {#if item.id === currentFunction || item.active}
                <span class="menu-item-check">
                  <ObsidianIcon name="check" size={14} />
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</BottomSheetModal>

<style>
  .mobile-card-management-menu {
    padding: 0;
  }

  .menu-section {
    padding: 6px 12px;
  }

  .menu-section-title {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    padding: 0 4px;
  }

  .menu-items {
    background: var(--background-secondary);
    border-radius: 10px;
    overflow: hidden;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: none;
    border-bottom: 1px solid var(--background-modifier-border);
    cursor: pointer;
    background: transparent;
    width: 100%;
    text-align: left;
  }

  .menu-item:last-child {
    border-bottom: none;
  }

  .menu-item:active {
    background: var(--background-modifier-hover);
  }

  .menu-item.active {
    background: rgba(124, 58, 237, 0.15);
  }

  .menu-item-icon {
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .menu-item.active .menu-item-icon {
    color: var(--weave-mobile-primary-color, #a78bfa);
  }

  .menu-item-text {
    flex: 1;
    font-size: 14px;
    color: var(--text-normal);
  }

  .menu-item-check {
    color: var(--weave-mobile-primary-color, #a78bfa);
  }
</style>
