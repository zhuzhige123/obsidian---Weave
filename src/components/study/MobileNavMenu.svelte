<script lang="ts">
  /**
   * 移动端导航菜单组件
   * 
   * Part A: 牌组学习界面的底部弹出导航菜单
   * 包含三个分类：功能切换、视图切换、设置
   * 
   * @module components/study/MobileNavMenu
   * @version 1.2.0
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
    currentView?: string;
    onClose: () => void;
    onMenuItemClick: (itemId: string) => void;
  }

  let {
    isOpen = false,
    currentView = 'deck-study',
    onClose,
    onMenuItemClick
  }: Props = $props();

  // 菜单分类配置
  const menuSections: MenuSection[] = [
    {
      title: '功能切换',
      items: [
        { id: 'deck-study', icon: 'graduation-cap', label: '牌组学习' },
        { id: 'card-management', icon: 'list', label: '卡片管理' },
        { id: 'ai-assistant', icon: 'bot', label: 'AI助手' }
      ]
    },
    {
      title: '视图切换',
      items: [
        { id: 'toggle-view', icon: 'refresh-cw', label: '切换视图' },
        { id: 'new-deck', icon: 'plus', label: '新建牌组' },
        { id: 'more-actions', icon: 'more-horizontal', label: '更多操作' }
      ]
    },
    {
      title: '设置',
      items: [
        { id: 'note-type-config', icon: 'file-cog', label: '笔记类型配置' },
        { id: 'settings', icon: 'settings', label: '设置' }
      ]
    }
  ];

  function handleItemClick(itemId: string) {
    onMenuItemClick(itemId);
    onClose();
  }
</script>

<BottomSheetModal {isOpen} {onClose} height="auto">
  <div class="mobile-nav-menu">
    {#each menuSections as section}
      <div class="menu-section">
        <div class="menu-section-title">{section.title}</div>
        <div class="menu-items">
          {#each section.items as item}
            <button
              class="menu-item"
              class:active={item.id === currentView}
              onclick={() => handleItemClick(item.id)}
            >
              <span class="menu-item-icon">
                <ObsidianIcon name={item.icon} size={16} />
              </span>
              <span class="menu-item-text">{item.label}</span>
              {#if item.id === currentView}
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
  .mobile-nav-menu {
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
