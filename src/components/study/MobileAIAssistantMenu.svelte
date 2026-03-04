<script lang="ts">
  /**
   * 移动端 AI 助手导航菜单组件
   * 
   * AI 助手界面的底部弹出导航菜单
   * 与牌组学习界面的 MobileNavMenu 保持一致的菜单结构
   * 
   * @module components/study/MobileAIAssistantMenu
   * @version 1.0.0
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
    onClose: () => void;
    onMenuItemClick: (itemId: string) => void;
  }

  let {
    isOpen = false,
    currentFunction = 'ai-assistant',
    onClose,
    onMenuItemClick
  }: Props = $props();

  // 菜单分类配置 - 与 MobileNavMenu 保持一致的结构
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
      title: 'AI 操作',
      items: [
        { id: 'select-file', icon: 'folder', label: '选择文件' },
        { id: 'generate-cards', icon: 'sparkles', label: '生成卡片' },
        { id: 'ai-config', icon: 'settings', label: 'AI 配置' }
      ]
    },
    {
      title: '提示词',
      items: [
        { id: 'prompt-templates', icon: 'file-text', label: '提示词模板' },
        { id: 'custom-prompt', icon: 'edit-3', label: '自定义提示词' }
      ]
    }
  ];

  function handleItemClick(itemId: string) {
    onMenuItemClick(itemId);
    onClose();
  }
</script>

<BottomSheetModal {isOpen} {onClose} height="auto">
  <div class="mobile-ai-assistant-menu">
    {#each menuSections as section}
      <div class="menu-section">
        <div class="menu-section-title">{section.title}</div>
        <div class="menu-items">
          {#each section.items as item}
            <button
              class="menu-item"
              class:active={item.id === currentFunction}
              onclick={() => handleItemClick(item.id)}
            >
              <span class="menu-item-icon">
                <ObsidianIcon name={item.icon} size={16} />
              </span>
              <span class="menu-item-text">{item.label}</span>
              {#if item.id === currentFunction}
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
  .mobile-ai-assistant-menu {
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
