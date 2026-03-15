import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SidebarNavHeader from './SidebarNavHeader.svelte';
import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';
import { Menu } from 'obsidian';
import type { MenuItem as MockMenuItem } from '../../tests/mocks/obsidian';

type TrackingMenuInstance = Menu & {
  findItemByTitle(title: string): MockMenuItem | undefined;
};

const menuInstances: TrackingMenuInstance[] = [];

vi.mock('obsidian', async () => {
  const actual = await vi.importActual<typeof import('../../tests/mocks/obsidian')>('../../tests/mocks/obsidian');

  class TrackingMenu extends actual.Menu {
    constructor() {
      super();
      menuInstances.push(this as unknown as TrackingMenuInstance);
    }
  }

  return {
    ...actual,
    Menu: TrackingMenu
  };
});

vi.mock('../../services/premium/PremiumFeatureGuard', () => {
  const mockGuard = {
    canUseFeature: vi.fn(() => true),
    isPremiumActive: {
      subscribe: vi.fn(),
      set: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    PremiumFeatureGuard: {
      getInstance: vi.fn(() => mockGuard)
    },
    PREMIUM_FEATURES: {
      INCREMENTAL_READING: 'incremental-reading',
      GRID_VIEW: 'grid-view',
      KANBAN_VIEW: 'kanban-view'
    }
  };
});

vi.mock('../../utils/i18n', () => ({
  tr: {
    subscribe: (callback: (translator: (key: string) => string) => void) => {
      callback((key: string) => key);
      return () => {};
    }
  }
}));

describe('SidebarNavHeader', () => {
  const mockOnNavigate = vi.fn();
  const mockOnViewChange = vi.fn();
  const mockOnCardDataSourceChange = vi.fn();
  const mockOnFilterSelect = vi.fn();

  beforeEach(() => {
    menuInstances.length = 0;
    vi.clearAllMocks();
  });

  it('在卡片管理页面显示数据源切换子菜单', async () => {
    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'weave-card-management',
        currentView: 'table',
        cardDataSource: 'memory',
        onNavigate: mockOnNavigate,
        onViewChange: mockOnViewChange,
        onCardDataSourceChange: mockOnCardDataSourceChange
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    expect(menu).toBeTruthy();

    const dataSourceItem = menu.findItemByTitle('数据源切换');
    expect(dataSourceItem).toBeTruthy();
    expect(dataSourceItem?.getIcon()).toBe('database');

    const submenu = dataSourceItem?.getSubmenu();
    expect(submenu).toBeTruthy();
    expect(submenu?.findItemByTitle('记忆牌组')).toBeTruthy();
    expect(submenu?.findItemByTitle('增量阅读')).toBeTruthy();
    expect(submenu?.findItemByTitle('考试牌组')).toBeTruthy();
  });

  it('在卡片管理页面点击数据源后触发切换回调和事件', async () => {
    const eventListener = vi.fn();
    window.addEventListener('Weave:card-data-source-change', eventListener);

    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'weave-card-management',
        currentView: 'table',
        cardDataSource: 'memory',
        onNavigate: mockOnNavigate,
        onCardDataSourceChange: mockOnCardDataSourceChange
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    const submenu = menu.findItemByTitle('数据源切换')?.getSubmenu();
    submenu?.findItemByTitle('考试牌组')?.trigger();

    expect(mockOnCardDataSourceChange).toHaveBeenCalledWith('questionBank');
    expect(eventListener).toHaveBeenCalled();
    expect((eventListener.mock.calls[0][0] as CustomEvent).detail).toBe('questionBank');

    window.removeEventListener('Weave:card-data-source-change', eventListener);
  });

  it('增量阅读未激活时在卡片管理页面禁用对应入口', async () => {
    const mockGuard = PremiumFeatureGuard.getInstance();
    vi.mocked(mockGuard.canUseFeature).mockImplementation((featureId: string) => {
      return featureId !== PREMIUM_FEATURES.INCREMENTAL_READING;
    });

    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'weave-card-management',
        currentView: 'table',
        cardDataSource: 'memory',
        onNavigate: mockOnNavigate,
        onCardDataSourceChange: mockOnCardDataSourceChange
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    const submenu = menu.findItemByTitle('数据源切换')?.getSubmenu();
    const irItem = submenu?.findItemByTitle('增量阅读 (高级)');

    expect(irItem).toBeTruthy();
    expect(irItem?.isDisabled()).toBe(true);
  });

  it('在牌组学习页面显示切换视图和新建牌组菜单项', async () => {
    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'deck-study',
        selectedFilter: 'memory',
        onNavigate: mockOnNavigate,
        onFilterSelect: mockOnFilterSelect
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    expect(menu.findItemByTitle('切换视图')?.getIcon()).toBe('layout-grid');
    expect(menu.findItemByTitle('新建牌组')?.getIcon()).toBe('folder-plus');
  });

  it('在牌组学习页面点击切换视图时派发菜单事件', async () => {
    const eventListener = vi.fn();
    window.addEventListener('show-view-menu', eventListener);

    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'deck-study',
        selectedFilter: 'memory',
        onNavigate: mockOnNavigate,
        onFilterSelect: mockOnFilterSelect
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    menu.findItemByTitle('切换视图')?.trigger();

    expect(eventListener).toHaveBeenCalled();

    window.removeEventListener('show-view-menu', eventListener);
  });

  it('在 AI 助手页面不显示无效功能入口', async () => {
    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'ai-assistant',
        onNavigate: mockOnNavigate
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    expect(menu.findItemByTitle('牌组学习')?.isChecked()).toBe(false);
    expect(menu.findItemByTitle('卡片管理')?.isChecked()).toBe(false);
    expect(menu.findItemByTitle('AI助手')?.isChecked()).toBe(true);
    expect(menu.findItemByTitle('切换视图')).toBeUndefined();
    expect(menu.findItemByTitle('新建牌组')).toBeUndefined();
    expect(menu.findItemByTitle('数据源切换')).toBeUndefined();
    expect(menu.findItemByTitle('旧版APKG格式导入')).toBeUndefined();
    expect(menu.findItemByTitle('导入CSV文件')).toBeUndefined();
    expect(menu.findItemByTitle('粘贴卡片批量导入')).toBeUndefined();
    expect(menu.findItemByTitle('操作管理')).toBeUndefined();
    expect(menu.findItemByTitle('设置')).toBeUndefined();
  });

  it('在卡片管理页面不显示仅牌组学习可用的全局操作', async () => {
    const { container } = render(SidebarNavHeader, {
      props: {
        currentPage: 'weave-card-management',
        currentView: 'table',
        cardDataSource: 'memory',
        onNavigate: mockOnNavigate,
        onViewChange: mockOnViewChange,
        onCardDataSourceChange: mockOnCardDataSourceChange
      }
    });

    await fireEvent.click(container.querySelector('.sidebar-menu-trigger')!);

    const menu = menuInstances[0];
    expect(menu.findItemByTitle('数据源切换')).toBeTruthy();
    expect(menu.findItemByTitle('旧版APKG格式导入')).toBeUndefined();
    expect(menu.findItemByTitle('导入CSV文件')).toBeUndefined();
    expect(menu.findItemByTitle('粘贴卡片批量导入')).toBeUndefined();
    expect(menu.findItemByTitle('操作管理')).toBeUndefined();
    expect(menu.findItemByTitle('设置')).toBeUndefined();
  });
});
