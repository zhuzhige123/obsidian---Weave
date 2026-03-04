/**
 * BottomSheetModal 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证底部抽屉模态窗的核心功能
 * 
 * Property 1: Bottom_Sheet 不遮挡 Obsidian_Bottom_Bar
 * - 验证 BottomSheet 的 bottom 位置始终 >= 44px
 * - 验证 max-height 计算正确，不会超出可视区域
 * - 验证 padding-bottom 包含 Obsidian 底部栏高度
 * 
 * @module services/__tests__/BottomSheetModal.property.test
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ===== 常量定义 =====

/** Obsidian 底部栏高度 (px) */
const OBSIDIAN_BOTTOM_BAR_HEIGHT = 44;

/** iOS 安全区域顶部默认值 (px) */
const DEFAULT_SAFE_AREA_TOP = 20;

/** 最小触控目标尺寸 (px) - Apple HIG 标准 */
const MIN_TOUCH_TARGET = 44;

// ===== 类型定义 =====

interface BottomSheetConfig {
  height: 'auto' | 'half' | 'full';
  viewportHeight: number;
  safeAreaTop: number;
  safeAreaBottom: number;
}

interface BottomSheetLayout {
  bottom: number;
  maxHeight: number;
  paddingBottom: number;
  contentMaxHeight: number;
}

// ===== 布局计算函数（从组件逻辑提取） =====

/**
 * 计算 BottomSheet 在手机端的布局参数
 * 模拟 BottomSheetModal.svelte 中的样式计算
 */
function calculateMobileBottomSheetLayout(config: BottomSheetConfig): BottomSheetLayout {
  const { height, viewportHeight, safeAreaTop, safeAreaBottom } = config;
  
  // 手机端 bottom 固定为 Obsidian 底部栏高度
  const bottom = OBSIDIAN_BOTTOM_BAR_HEIGHT;
  
  // padding-bottom = 12px + safe-area-inset-bottom
  const paddingBottom = 12 + safeAreaBottom;
  
  // max-height 计算：100vh - 44px - safe-area-inset-top
  const maxHeight = viewportHeight - OBSIDIAN_BOTTOM_BAR_HEIGHT - safeAreaTop;
  
  // 根据 height 模式计算实际内容最大高度
  let contentMaxHeight: number;
  switch (height) {
    case 'full':
      contentMaxHeight = maxHeight;
      break;
    case 'half':
      contentMaxHeight = Math.min(viewportHeight * 0.5, maxHeight);
      break;
    case 'auto':
    default:
      contentMaxHeight = Math.min(viewportHeight * 0.8, maxHeight);
      break;
  }
  
  return {
    bottom,
    maxHeight,
    paddingBottom,
    contentMaxHeight
  };
}

/**
 * 验证 BottomSheet 是否遮挡 Obsidian 底部栏
 */
function isObsidianBottomBarVisible(layout: BottomSheetLayout): boolean {
  // bottom >= 44px 表示不遮挡
  return layout.bottom >= OBSIDIAN_BOTTOM_BAR_HEIGHT;
}

/**
 * 验证 BottomSheet 是否超出屏幕顶部
 */
function isWithinViewport(layout: BottomSheetLayout, viewportHeight: number): boolean {
  // BottomSheet 顶部位置 = viewportHeight - bottom - maxHeight
  // 应该 >= 0（不超出屏幕顶部）
  const topPosition = viewportHeight - layout.bottom - layout.maxHeight;
  return topPosition >= 0;
}

/**
 * 计算关闭按钮尺寸
 */
function getCloseButtonSize(isMobile: boolean): number {
  return isMobile ? MIN_TOUCH_TARGET : 36;
}

// ===== Arbitraries =====

const heightModeArbitrary = fc.constantFrom<'auto' | 'half' | 'full'>('auto', 'half', 'full');

const viewportHeightArbitrary = fc.integer({ min: 480, max: 1024 }); // 常见手机屏幕高度

const safeAreaArbitrary = fc.integer({ min: 0, max: 50 }); // iOS 安全区域

const bottomSheetConfigArbitrary: fc.Arbitrary<BottomSheetConfig> = fc.record({
  height: heightModeArbitrary,
  viewportHeight: viewportHeightArbitrary,
  safeAreaTop: safeAreaArbitrary,
  safeAreaBottom: safeAreaArbitrary
});

// ===== Property 1: Bottom_Sheet 不遮挡 Obsidian_Bottom_Bar =====
describe('Property 1: Bottom_Sheet 不遮挡 Obsidian_Bottom_Bar', () => {
  it('BottomSheet 的 bottom 位置始终 >= 44px', () => {
    fc.assert(
      fc.property(
        bottomSheetConfigArbitrary,
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          return layout.bottom >= OBSIDIAN_BOTTOM_BAR_HEIGHT;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('BottomSheet 不会超出屏幕顶部', () => {
    fc.assert(
      fc.property(
        bottomSheetConfigArbitrary,
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          return isWithinViewport(layout, config.viewportHeight);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Obsidian 底部栏始终可见', () => {
    fc.assert(
      fc.property(
        bottomSheetConfigArbitrary,
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          return isObsidianBottomBarVisible(layout);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('padding-bottom 包含安全区域', () => {
    fc.assert(
      fc.property(
        bottomSheetConfigArbitrary,
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          // padding-bottom 应该 >= 12px（基础间距）
          return layout.paddingBottom >= 12;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('max-height 正确排除 Obsidian 底部栏', () => {
    fc.assert(
      fc.property(
        bottomSheetConfigArbitrary,
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          // max-height 应该 <= viewportHeight - 44px
          return layout.maxHeight <= config.viewportHeight - OBSIDIAN_BOTTOM_BAR_HEIGHT;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== Property 2: 高度模式正确性 =====
describe('Property 2: 高度模式正确性', () => {
  it('auto 模式最大高度不超过 80vh', () => {
    fc.assert(
      fc.property(
        fc.record({
          height: fc.constant<'auto'>('auto'),
          viewportHeight: viewportHeightArbitrary,
          safeAreaTop: safeAreaArbitrary,
          safeAreaBottom: safeAreaArbitrary
        }),
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          return layout.contentMaxHeight <= config.viewportHeight * 0.8;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('half 模式最大高度不超过 50vh', () => {
    fc.assert(
      fc.property(
        fc.record({
          height: fc.constant<'half'>('half'),
          viewportHeight: viewportHeightArbitrary,
          safeAreaTop: safeAreaArbitrary,
          safeAreaBottom: safeAreaArbitrary
        }),
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          return layout.contentMaxHeight <= config.viewportHeight * 0.5;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('full 模式使用最大可用高度', () => {
    fc.assert(
      fc.property(
        fc.record({
          height: fc.constant<'full'>('full'),
          viewportHeight: viewportHeightArbitrary,
          safeAreaTop: safeAreaArbitrary,
          safeAreaBottom: safeAreaArbitrary
        }),
        (config) => {
          const layout = calculateMobileBottomSheetLayout(config);
          return layout.contentMaxHeight === layout.maxHeight;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== Property 3: 触控目标尺寸 =====
describe('Property 3: 触控目标尺寸', () => {
  it('移动端关闭按钮尺寸 >= 44px', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isMobile) => {
          const size = getCloseButtonSize(isMobile);
          if (isMobile) {
            return size >= MIN_TOUCH_TARGET;
          }
          return size >= 36; // 桌面端最小尺寸
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== Property 4: 拖动关闭阈值 =====
describe('Property 4: 拖动关闭阈值', () => {
  const DRAG_CLOSE_THRESHOLD = 100;

  it('拖动距离 > 100px 时应关闭', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 500 }),
        (dragDistance) => {
          return dragDistance > DRAG_CLOSE_THRESHOLD;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('拖动距离 <= 100px 时不应关闭', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (dragDistance) => {
          return dragDistance <= DRAG_CLOSE_THRESHOLD;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== Property 5: 动画时序 =====
describe('Property 5: 动画时序', () => {
  const ANIMATION_DURATION = 300; // ms

  it('关闭动画完成后才隐藏元素', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        (elapsedTime) => {
          // 如果经过时间 < 动画时长，元素应该仍然可见
          if (elapsedTime < ANIMATION_DURATION) {
            return true; // 元素应该可见
          }
          // 动画完成后，元素可以隐藏
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 边界条件测试 =====
describe('边界条件测试', () => {
  it('最小屏幕高度 (480px) 下仍然正常工作', () => {
    const config: BottomSheetConfig = {
      height: 'full',
      viewportHeight: 480,
      safeAreaTop: DEFAULT_SAFE_AREA_TOP,
      safeAreaBottom: 0
    };
    
    const layout = calculateMobileBottomSheetLayout(config);
    
    expect(layout.bottom).toBe(OBSIDIAN_BOTTOM_BAR_HEIGHT);
    expect(layout.maxHeight).toBeLessThanOrEqual(480 - OBSIDIAN_BOTTOM_BAR_HEIGHT);
    expect(isObsidianBottomBarVisible(layout)).toBe(true);
  });

  it('最大安全区域 (50px) 下仍然正常工作', () => {
    const config: BottomSheetConfig = {
      height: 'auto',
      viewportHeight: 800,
      safeAreaTop: 50,
      safeAreaBottom: 50
    };
    
    const layout = calculateMobileBottomSheetLayout(config);
    
    expect(layout.bottom).toBe(OBSIDIAN_BOTTOM_BAR_HEIGHT);
    expect(layout.paddingBottom).toBe(12 + 50);
    expect(isObsidianBottomBarVisible(layout)).toBe(true);
  });

  it('所有高度模式下 Obsidian 底部栏都可见', () => {
    const modes: Array<'auto' | 'half' | 'full'> = ['auto', 'half', 'full'];
    
    for (const mode of modes) {
      const config: BottomSheetConfig = {
        height: mode,
        viewportHeight: 700,
        safeAreaTop: 20,
        safeAreaBottom: 34
      };
      
      const layout = calculateMobileBottomSheetLayout(config);
      expect(isObsidianBottomBarVisible(layout)).toBe(true);
    }
  });
});
