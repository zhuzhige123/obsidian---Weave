/**
 * SidebarNavHeader 组件单元测试
 * 
 * 测试视图切换菜单项的显示逻辑：
 * - 在卡片管理页面显示"切换视图"菜单项
 * - 在牌组学习页面显示"切换视图"菜单项
 * - 在AI助手页面不显示"切换视图"菜单项
 * - 测试子菜单包含三个视图选项
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { Menu } from 'obsidian';
import SidebarNavHeader from './SidebarNavHeader.svelte';
import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';

// Mock PremiumFeatureGuard
vi.mock('../../services/premium/PremiumFeatureGuard', () => {
  const mockGuard = {
    canUseFeature: vi.fn((featureId: string) => {
      // 默认情况下，所有功能都可用（模拟高级用户）
      return true;
    }),
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
      GRID_VIEW: 'grid-view',
      KANBAN_VIEW: 'kanban-view'
    }
  };
});

// Mock i18n
vi.mock('../../utils/i18n', () => ({
  tr: {
    subscribe: vi.fn((callback) => {
      callback((key: string) => key);
      return () => {};
    })
  }
}));

describe('SidebarNavHeader - 视图切换菜单项显示', () => {
  let mockOnNavigate: ReturnType<typeof vi.fn>;
  let mockOnViewChange: ReturnType<typeof vi.fn>;
  let mockOnCardDataSourceChange: ReturnType<typeof vi.fn>;
  let mockOnFilterSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnNavigate = vi.fn();
    mockOnViewChange = vi.fn();
    mockOnCardDataSourceChange = vi.fn();
    mockOnFilterSelect = vi.fn();
    
    // 清除所有事件监听器
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 3.1: 卡片管理页面显示"切换视图"菜单项', () => {
    it('应该在卡片管理页面的菜单中显示"切换视图"菜单项', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'weave-card-management',
          currentView: 'table',
          onNavigate: mockOnNavigate,
          onViewChange: mockOnViewChange,
          onCardDataSourceChange: mockOnCardDataSourceChange
        }
      });

      // 找到菜单按钮
      const menuButton = container.querySelector('.sidebar-menu-trigger');
      expect(menuButton).toBeTruthy();

      // 创建一个 spy 来捕获 Menu 的创建
      let capturedMenu: any = null;
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        capturedMenu = new originalMenu();
        return capturedMenu;
      });
      (global as any).Menu = MenuSpy;

      // 点击菜单按钮
      await fireEvent.click(menuButton!);

      // 验证菜单被创建
      expect(MenuSpy).toHaveBeenCalled();
      expect(capturedMenu).toBeTruthy();

      // 验证菜单中包含"切换视图"菜单项
      const viewSwitchItem = capturedMenu!.findItemByTitle('切换视图');
      expect(viewSwitchItem).toBeTruthy();
      expect(viewSwitchItem!.getIcon()).toBe('layout-grid');

      // 恢复原始 Menu
      (global as any).Menu = originalMenu;
    });

    it('应该在点击"切换视图"后显示包含三个视图选项的子菜单', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'weave-card-management',
          currentView: 'table',
          onNavigate: mockOnNavigate,
          onViewChange: mockOnViewChange
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      
      // 捕获主菜单和子菜单
      let mainMenu: any = null;
      let subMenu: any = null;
      let menuCallCount = 0;
      
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        const menu = new originalMenu();
        menuCallCount++;
        if (menuCallCount === 1) {
          mainMenu = menu;
        } else if (menuCallCount === 2) {
          subMenu = menu;
        }
        return menu;
      });
      (global as any).Menu = MenuSpy;

      // 点击菜单按钮
      await fireEvent.click(menuButton!);

      // 找到"切换视图"菜单项并点击
      const viewSwitchItem = mainMenu!.findItemByTitle('切换视图');
      expect(viewSwitchItem).toBeTruthy();
      
      // 触发"切换视图"菜单项的点击
      viewSwitchItem!.trigger();

      // 验证子菜单被创建
      expect(subMenu).toBeTruthy();

      // 验证子菜单包含三个视图选项
      const tableViewItem = subMenu!.findItemByTitle('表格视图');
      const gridViewItem = subMenu!.findItemByTitle('网格视图');
      const kanbanViewItem = subMenu!.findItemByTitle('看板视图');

      expect(tableViewItem).toBeTruthy();
      expect(gridViewItem).toBeTruthy();
      expect(kanbanViewItem).toBeTruthy();

      // 验证图标
      expect(tableViewItem!.getIcon()).toBe('table');
      expect(gridViewItem!.getIcon()).toBe('grid');
      expect(kanbanViewItem!.getIcon()).toBe('layout-dashboard');

      // 恢复原始 Menu
      (global as any).Menu = originalMenu;
    });

    it('应该在当前视图的菜单项上显示选中标记', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'weave-card-management',
          currentView: 'grid', // 当前视图为网格视图
          onNavigate: mockOnNavigate,
          onViewChange: mockOnViewChange
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      
      let mainMenu: any = null;
      let subMenu: any = null;
      let menuCallCount = 0;
      
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        const menu = new originalMenu();
        menuCallCount++;
        if (menuCallCount === 1) {
          mainMenu = menu;
        } else if (menuCallCount === 2) {
          subMenu = menu;
        }
        return menu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);
      
      const viewSwitchItem = mainMenu!.findItemByTitle('切换视图');
      viewSwitchItem!.trigger();

      // 验证只有网格视图被选中
      const tableViewItem = subMenu!.findItemByTitle('表格视图');
      const gridViewItem = subMenu!.findItemByTitle('网格视图');
      const kanbanViewItem = subMenu!.findItemByTitle('看板视图');

      expect(tableViewItem!.isChecked()).toBe(false);
      expect(gridViewItem!.isChecked()).toBe(true);
      expect(kanbanViewItem!.isChecked()).toBe(false);

      (global as any).Menu = originalMenu;
    });

    it('应该在点击视图选项后触发视图切换事件', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'weave-card-management',
          currentView: 'table',
          onNavigate: mockOnNavigate,
          onViewChange: mockOnViewChange
        }
      });

      // 监听自定义事件
      const eventListener = vi.fn();
      window.addEventListener('Weave:sidebar-view-change', eventListener);

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      
      let mainMenu: any = null;
      let subMenu: any = null;
      let menuCallCount = 0;
      
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        const menu = new originalMenu();
        menuCallCount++;
        if (menuCallCount === 1) {
          mainMenu = menu;
        } else if (menuCallCount === 2) {
          subMenu = menu;
        }
        return menu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);
      
      const viewSwitchItem = mainMenu!.findItemByTitle('切换视图');
      viewSwitchItem!.trigger();

      // 点击网格视图
      const gridViewItem = subMenu!.findItemByTitle('网格视图');
      gridViewItem!.trigger();

      // 验证事件被触发
      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toBe('grid');

      // 清理
      window.removeEventListener('Weave:sidebar-view-change', eventListener);
      (global as any).Menu = originalMenu;
    });
  });

  describe('Requirement 3.2: 牌组学习页面显示"切换视图"菜单项', () => {
    it('应该在牌组学习页面的菜单中显示"切换视图"菜单项', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'deck-study',
          selectedFilter: 'memory',
          onNavigate: mockOnNavigate,
          onFilterSelect: mockOnFilterSelect
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      expect(menuButton).toBeTruthy();

      let capturedMenu: any = null;
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        capturedMenu = new originalMenu();
        return capturedMenu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);

      expect(MenuSpy).toHaveBeenCalled();
      expect(capturedMenu).toBeTruthy();

      // 验证菜单中包含"切换视图"菜单项
      const viewSwitchItem = capturedMenu!.findItemByTitle('切换视图');
      expect(viewSwitchItem).toBeTruthy();
      expect(viewSwitchItem!.getIcon()).toBe('layout-grid');

      (global as any).Menu = originalMenu;
    });

    it('应该在牌组学习页面显示"新建牌组"菜单项', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'deck-study',
          selectedFilter: 'memory',
          onNavigate: mockOnNavigate,
          onFilterSelect: mockOnFilterSelect
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      
      let capturedMenu: any = null;
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        capturedMenu = new originalMenu();
        return capturedMenu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);

      // 验证菜单中包含"新建牌组"菜单项
      const createDeckItem = capturedMenu!.findItemByTitle('新建牌组');
      expect(createDeckItem).toBeTruthy();
      expect(createDeckItem!.getIcon()).toBe('folder-plus');

      (global as any).Menu = originalMenu;
    });
  });

  describe('Requirement 3.3: AI助手页面不显示"切换视图"菜单项', () => {
    it('应该在AI助手页面的菜单中不显示"切换视图"菜单项', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'ai-assistant',
          onNavigate: mockOnNavigate
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      expect(menuButton).toBeTruthy();

      let capturedMenu: any = null;
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        capturedMenu = new originalMenu();
        return capturedMenu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);

      expect(MenuSpy).toHaveBeenCalled();
      expect(capturedMenu).toBeTruthy();

      // 验证菜单中不包含"切换视图"菜单项
      const viewSwitchItem = capturedMenu!.findItemByTitle('切换视图');
      expect(viewSwitchItem).toBeUndefined();

      (global as any).Menu = originalMenu;
    });

    it('应该在AI助手页面只显示导航分组和更多操作', async () => {
      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'ai-assistant',
          onNavigate: mockOnNavigate
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      
      let capturedMenu: any = null;
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        capturedMenu = new originalMenu();
        return capturedMenu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);

      // 验证导航分组存在
      const deckStudyItem = capturedMenu!.findItemByTitle('牌组学习');
      const cardManagementItem = capturedMenu!.findItemByTitle('卡片管理');
      const aiAssistantItem = capturedMenu!.findItemByTitle('AI助手');

      expect(deckStudyItem).toBeTruthy();
      expect(cardManagementItem).toBeTruthy();
      expect(aiAssistantItem).toBeTruthy();
      expect(aiAssistantItem!.isChecked()).toBe(true);

      // 验证更多操作存在
      const apkgImportItem = capturedMenu!.findItemByTitle('旧版APKG格式导入');
      const csvImportItem = capturedMenu!.findItemByTitle('导入CSV文件');

      expect(apkgImportItem).toBeTruthy();
      expect(csvImportItem).toBeTruthy();

      // 验证不包含页面专属功能
      const viewSwitchItem = capturedMenu!.findItemByTitle('切换视图');
      const qualityInboxItem = capturedMenu!.findItemByTitle('质量收件箱');
      const createDeckItem = capturedMenu!.findItemByTitle('新建牌组');

      expect(viewSwitchItem).toBeUndefined();
      expect(qualityInboxItem).toBeUndefined();
      expect(createDeckItem).toBeUndefined();

      (global as any).Menu = originalMenu;
    });
  });

  describe('权限检查', () => {
    it('应该为无权限用户在高级视图选项上显示"（需激活）"标注', async () => {
      // Mock 无权限用户
      const mockGuard = PremiumFeatureGuard.getInstance();
      vi.mocked(mockGuard.canUseFeature).mockImplementation((featureId: string) => {
        return featureId !== PREMIUM_FEATURES.GRID_VIEW && featureId !== PREMIUM_FEATURES.KANBAN_VIEW;
      });

      const { container } = render(SidebarNavHeader, {
        props: {
          currentPage: 'weave-card-management',
          currentView: 'table',
          onNavigate: mockOnNavigate,
          onViewChange: mockOnViewChange
        }
      });

      const menuButton = container.querySelector('.sidebar-menu-trigger');
      
      let mainMenu: any = null;
      let subMenu: any = null;
      let menuCallCount = 0;
      
      const originalMenu = Menu;
      const MenuSpy = vi.fn(function(this: any) {
        const menu = new originalMenu();
        menuCallCount++;
        if (menuCallCount === 1) {
          mainMenu = menu;
        } else if (menuCallCount === 2) {
          subMenu = menu;
        }
        return menu;
      });
      (global as any).Menu = MenuSpy;

      await fireEvent.click(menuButton!);
      
      const viewSwitchItem = mainMenu!.findItemByTitle('切换视图');
      viewSwitchItem!.trigger();

      // 验证高级视图选项显示"（需激活）"标注
      const gridViewItem = subMenu!.findItemByTitle('网格视图（需激活）');
      const kanbanViewItem = subMenu!.findItemByTitle('看板视图（需激活）');

      expect(gridViewItem).toBeTruthy();
      expect(kanbanViewItem).toBeTruthy();

      // 验证表格视图不显示标注
      const tableViewItem = subMenu!.findItemByTitle('表格视图');
      expect(tableViewItem).toBeTruthy();

      (global as any).Menu = originalMenu;
    });
  });
});
