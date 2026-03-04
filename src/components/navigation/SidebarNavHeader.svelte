<script lang="ts">
  /**
   * 侧边栏导航头部组件
   *
   * 当插件界面位于 Obsidian 侧边栏时显示的紧凑导航头部
   * - 左侧：菜单按钮（☰）触发导航列表菜单
   * - 中间：彩色圆点（根据页面不同有不同功能）
   *   - 牌组学习：增量阅读、记忆牌组、考试牌组（数据源切换）
   *   - 卡片管理：表格视图、网格视图、看板视图（视图切换）
   *   - AI助手：无圆点
   * - 右侧：留空占位
   *
   * @module components/navigation/SidebarNavHeader
   * @version 1.3.0 - 卡片管理页面圆点改为视图切换
   */
  import { Menu, Notice } from 'obsidian';
  import { onMount, onDestroy } from 'svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import { tr } from '../../utils/i18n';
  import { WeaveMenuRegistry } from '../../services/plugin-system/WeaveMenuRegistry';
  import type { InstalledPluginInfo } from '../../services/plugin-system/WeaveMenuRegistry';
  import type { WeaveMenuRegistration } from '../../types/weave-plugin-types';
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';

  // 牌组学习页面的筛选类型
  export type DeckFilter = 'memory' | 'question-bank' | 'incremental-reading';
  export type DeckStudyViewType = 'grid' | 'kanban';
  // 卡片管理页面的视图类型
  export type CardViewType = 'table' | 'grid' | 'kanban';
  // 卡片管理页面的数据源类型（保留用于兼容）
  export type CardDataSource = 'memory' | 'questionBank' | 'incremental-reading';

  interface Props {
    currentPage: string;
    // 牌组学习页面的筛选状态
    selectedFilter?: DeckFilter;
    onFilterSelect?: (filter: DeckFilter) => void;
    deckStudyView?: DeckStudyViewType;
    // 卡片管理页面的视图状态
    currentView?: CardViewType;
    onViewChange?: (view: CardViewType) => void;
    // 卡片管理页面的数据源状态（保留用于兼容，但不再用于圆点）
    cardDataSource?: CardDataSource;
    onCardDataSourceChange?: (source: CardDataSource) => void;
    // 导航回调
    onNavigate: (pageId: string) => void;
  }

  let {
    currentPage = 'deck-study',
    selectedFilter = 'memory',
    onFilterSelect,
    deckStudyView = 'grid',
    currentView = 'table',
    onViewChange,
    cardDataSource = 'memory',
    onCardDataSourceChange,
    onNavigate
  }: Props = $props();

  // 🌍 响应式翻译函数
  let t = $derived($tr);

  // 牌组学习页面的彩色圆点配置
  const deckFilters = [
    { id: 'incremental-reading' as DeckFilter, name: '增量阅读', colorStart: '#ef4444', colorEnd: '#dc2626' },
    { id: 'memory' as DeckFilter, name: '记忆牌组', colorStart: '#3b82f6', colorEnd: '#2563eb' },
    { id: 'question-bank' as DeckFilter, name: '考试牌组', colorStart: '#10b981', colorEnd: '#059669' }
  ];

  // 🆕 卡片管理页面的彩色圆点配置（视图切换）
  const cardViewTypes = [
    { id: 'table' as CardViewType, name: '表格视图', colorStart: '#ef4444', colorEnd: '#dc2626' },
    { id: 'grid' as CardViewType, name: '网格视图', colorStart: '#3b82f6', colorEnd: '#2563eb' },
    { id: 'kanban' as CardViewType, name: '看板视图', colorStart: '#10b981', colorEnd: '#059669' }
  ];

  function handleMenuClick(evt: MouseEvent) {
    // 创建 Obsidian 原生菜单
    const menu = new Menu();

    // 🆕 导航分组
    menu.addItem((item) => {
      item
        .setTitle('牌组学习')
        .setIcon('graduation-cap')
        .setChecked(currentPage === 'deck-study')
        .onClick(() => onNavigate('deck-study'));
    });

    menu.addItem((item) => {
      item
        .setTitle('卡片管理')
        .setIcon('list')
        .setChecked(currentPage === 'weave-card-management')
        .onClick(() => onNavigate('weave-card-management'));
    });

    menu.addItem((item) => {
      item
        .setTitle('AI助手')
        .setIcon('bot')
        .setChecked(currentPage === 'ai-assistant')
        .onClick(() => onNavigate('ai-assistant'));
    });

    menu.addSeparator();

    // 🆕 牌组学习页面专属功能（仅在牌组学习页面显示）
    if (currentPage === 'deck-study') {
      menu.addItem((item) => {
        item
          .setTitle('切换视图')
          .setIcon('layout-grid')
          .onClick(() => {
            const event = new CustomEvent('show-view-menu', { detail: { event: evt } });
            window.dispatchEvent(event);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('新建牌组')
          .setIcon('folder-plus')
          .onClick(() => {
            const event = new CustomEvent('create-deck', { detail: { event: evt } });
            document.dispatchEvent(event);
          });
      });

      menu.addSeparator();
    }

    // 卡片管理页面专属功能（仅在卡片管理页面显示）
    if (currentPage === 'weave-card-management') {
      // 数据源切换子菜单
      menu.addItem((item) => {
        item
          .setTitle('数据源切换')
          .setIcon('database');
        const submenu = (item as any).setSubmenu();
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('记忆牌组')
            .setIcon('brain')
            .setChecked(cardDataSource === 'memory')
            .onClick(() => {
              if (onCardDataSourceChange) {
                onCardDataSourceChange('memory');
              }
              window.dispatchEvent(new CustomEvent('Weave:card-data-source-change', { detail: 'memory' }));
            });
        });
        
        submenu.addItem((subItem: any) => {
          const irGuard = PremiumFeatureGuard.getInstance();
          const irLocked = !irGuard.canUseFeature(PREMIUM_FEATURES.INCREMENTAL_READING);
          subItem
            .setTitle(irLocked ? '增量阅读 (高级)' : '增量阅读')
            .setIcon('book-open')
            .setChecked(cardDataSource === 'incremental-reading')
            .setDisabled(irLocked)
            .onClick(() => {
              if (irLocked) return;
              if (onCardDataSourceChange) {
                onCardDataSourceChange('incremental-reading');
              }
              window.dispatchEvent(new CustomEvent('Weave:card-data-source-change', { detail: 'incremental-reading' }));
            });
        });
        
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle('考试牌组')
            .setIcon('edit-3')
            .setChecked(cardDataSource === 'questionBank')
            .onClick(() => {
              if (onCardDataSourceChange) {
                onCardDataSourceChange('questionBank');
              }
              window.dispatchEvent(new CustomEvent('Weave:card-data-source-change', { detail: 'questionBank' }));
            });
        });
      });
      
      menu.addSeparator();
    }

    // 🆕 更多操作分组（直接展开，不使用子菜单）
    menu.addItem((item) => {
      item
        .setTitle('旧版APKG格式导入')
        .setIcon('package')
        .onClick(() => {
          const event = new CustomEvent('apkg-import', { detail: { event: evt } });
          document.dispatchEvent(event);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('导入CSV文件')
        .setIcon('file-text')
        .onClick(() => {
          const event = new CustomEvent('csv-import', { detail: { event: evt } });
          document.dispatchEvent(event);
        });
    });

    menu.addSeparator();

    // 操作管理子菜单
    menu.addItem((item) => {
      item.setTitle('操作管理').setIcon('more-horizontal');
      const operationSub = (item as any).setSubmenu();

      operationSub.addItem((subItem: any) => {
        subItem
          .setTitle('恢复官方教程牌组')
          .setIcon('book-open')
          .onClick(() => {
            document.dispatchEvent(new CustomEvent('Weave:restore-guide-deck'));
          });
      });
    });

    // 设置
    menu.addItem((item) => {
      item
        .setTitle('设置')
        .setIcon('settings')
        .onClick(() => {
          document.dispatchEvent(new CustomEvent('Weave:open-settings'));
        });
    });

    // 插件管理（子菜单列出已安装的第三方插件）
    if (installedPlugins.length > 0) {
      menu.addSeparator();
      menu.addItem((item) => {
        item
          .setTitle('插件管理')
          .setIcon('puzzle');
        const sub = (item as any).setSubmenu();

        for (const p of installedPlugins) {
          const reg = pluginMenuRegistrations.find(r => r.pluginId === p.id);
          const hasMenuItems = reg && reg.categories.length > 0;

          sub.addItem((pluginItem: any) => {
            const label = p.name + (p.state === 'enabled' ? '' : ' (已禁用)');
            pluginItem
              .setTitle(label)
              .setIcon(p.configurable ? 'settings' : 'puzzle');

            if (p.state !== 'enabled') {
              pluginItem.setDisabled(true);
              return;
            }

            // 有注册菜单项：用子菜单展示所有操作
            if (hasMenuItems) {
              const innerSub = pluginItem.setSubmenu();
              // 可配置插件在子菜单顶部加入"打开配置"
              if (p.configurable) {
                innerSub.addItem((cfgItem: any) => {
                  cfgItem
                    .setTitle('打开配置')
                    .setIcon('settings')
                    .onClick(() => {
                      document.dispatchEvent(new CustomEvent('Weave:open-plugin-config', { detail: { pluginId: p.id } }));
                    });
                });
                if (reg) innerSub.addSeparator();
              }
              if (reg) {
                for (const cat of reg.categories) {
                  for (const action of cat.items) {
                    innerSub.addItem((actionItem: any) => {
                      actionItem
                        .setTitle(action.label)
                        .setIcon(action.icon || 'chevron-right')
                        .onClick(() => {
                          try { action.callback(); } catch (e) { console.error('[PluginMenu]', e); }
                        });
                    });
                  }
                }
              }
            } else if (p.configurable) {
              // 仅可配置、无注册菜单项：直接点击打开配置
              pluginItem.onClick(() => {
                document.dispatchEvent(new CustomEvent('Weave:open-plugin-config', { detail: { pluginId: p.id } }));
              });
            } else {
              pluginItem.setDisabled(true);
            }
          });
        }
      });
    }

    // 显示菜单
    menu.showAtMouseEvent(evt);
  }

  function handleDotClick(dotId: string) {
    if (currentPage === 'deck-study') {
      if (dotId === 'incremental-reading') {
        const guard = PremiumFeatureGuard.getInstance();
        if (!guard.canUseFeature(PREMIUM_FEATURES.INCREMENTAL_READING)) {
          new Notice('增量阅读是高级功能，请激活许可证后使用');
          return;
        }
      }
      // 牌组学习页面：切换筛选
      if (onFilterSelect) {
        onFilterSelect(dotId as DeckFilter);
      }
    } else if (currentPage === 'weave-card-management') {
      // 卡片管理页面：切换视图
      if (onViewChange) {
        onViewChange(dotId as CardViewType);
      }
    }
  }

  function getGradientStyle(colorStart: string, colorEnd: string): string {
    return `background: linear-gradient(135deg, ${colorStart}, ${colorEnd})`;
  }

  // ===== 插件菜单注册表 + 已安装插件列表 =====
  let pluginMenuRegistrations = $state<WeaveMenuRegistration[]>([]);
  let installedPlugins = $state<InstalledPluginInfo[]>([]);
  let unsubMenuChange: (() => void) | null = null;

  function refreshPluginData() {
    pluginMenuRegistrations = WeaveMenuRegistry.getAll();
    installedPlugins = WeaveMenuRegistry.getInstalledPlugins();
  }

  onMount(() => {
    refreshPluginData();
    unsubMenuChange = WeaveMenuRegistry.onChange(refreshPluginData);
  });

  onDestroy(() => {
    if (unsubMenuChange) unsubMenuChange();
  });

</script>

<header class="sidebar-nav-header">
  <!-- 左侧：菜单按钮 -->
  <button
    class="sidebar-menu-trigger"
    onclick={handleMenuClick}
    aria-label="打开导航菜单"
  >
    <ObsidianIcon name="menu" size={18} />
  </button>

  <!-- 中间：彩色圆点 + 插件菜单按钮 -->
  <div class="sidebar-dots-container">
    {#if currentPage === 'deck-study'}
      {#each deckFilters as filter}
        <button
          class="sidebar-dot"
          class:selected={selectedFilter === filter.id}
          style={getGradientStyle(filter.colorStart, filter.colorEnd)}
          onclick={() => handleDotClick(filter.id)}
          aria-label={filter.name}
          title={filter.name}
        >
          {#if selectedFilter === filter.id}
            <span class="dot-indicator"></span>
          {/if}
        </button>
      {/each}
    {:else if currentPage === 'weave-card-management'}
      {#each cardViewTypes as viewType}
        <button
          class="sidebar-dot"
          class:selected={currentView === viewType.id}
          style={getGradientStyle(viewType.colorStart, viewType.colorEnd)}
          onclick={() => handleDotClick(viewType.id)}
          aria-label={viewType.name}
          title={viewType.name}
        >
          {#if currentView === viewType.id}
            <span class="dot-indicator"></span>
          {/if}
        </button>
      {/each}
    {:else}
      <div class="sidebar-dots-placeholder"></div>
    {/if}

  </div>

  <!-- 右侧：占位符（保持布局平衡） -->
  <div class="sidebar-header-actions">
    {#if currentPage === 'deck-study' && deckStudyView === 'kanban'}
      <button
        class="sidebar-action-btn"
        onclick={(evt) => {
          window.dispatchEvent(new CustomEvent('Weave:open-deck-kanban-menu', {
            detail: { x: evt.clientX, y: evt.clientY, filter: selectedFilter }
          }));
        }}
        aria-label="看板设置"
        title="看板设置"
      >
        <ObsidianIcon name="sliders" size={16} />
      </button>
    {/if}
  </div>
</header>

<style>
  .sidebar-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    min-height: 44px;
  }

  .sidebar-menu-trigger {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .sidebar-menu-trigger:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .sidebar-menu-trigger:active {
    background: var(--background-modifier-active-hover);
  }

  .sidebar-dots-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }

  .sidebar-dots-placeholder {
    height: 16px;
  }

  .sidebar-dot {
    position: relative;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    padding: 0;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .sidebar-dot:hover {
    transform: scale(1.25);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }

  .sidebar-dot:active {
    transform: scale(1.15);
  }

  .sidebar-dot:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  .sidebar-dot.selected {
    transform: scale(1.35);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  }

  /* 选中状态的脉冲边框 */
  .sidebar-dot.selected::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.6);
    opacity: 0.6;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.3;
    }
  }

  /* 选中指示器（白色小圆点） */
  .dot-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .sidebar-header-spacer {
    display: none;
  }

  .sidebar-header-actions {
    width: 36px;
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .sidebar-action-btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .sidebar-action-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .sidebar-action-btn:active {
    background: var(--background-modifier-active-hover);
  }
</style>
