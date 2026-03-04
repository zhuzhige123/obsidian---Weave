/**
 * 平板端设备检测和适配工具
 * 用于识别平板设备并提供相应的UI适配
 */

export interface DeviceInfo {
  isTablet: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: 'small' | 'medium' | 'large';
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
}

/**
 * 检测当前设备类型
 */
export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 屏幕尺寸检测
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const isLandscape = screenWidth > screenHeight;
  
  // 设备类型检测
  const isTablet = (
    (screenWidth >= 768 && screenWidth <= 1024) ||
    (screenHeight >= 768 && screenHeight <= 1024) ||
    /ipad|android(?!.*mobile)|tablet|kindle|silk/i.test(userAgent)
  );
  
  const isMobile = (
    !isTablet && (
      screenWidth < 768 ||
      /mobile|phone|android.*mobile|iphone|ipod|blackberry|windows phone/i.test(userAgent)
    )
  );
  
  const isDesktop = !isTablet && !isMobile;
  
  // 屏幕尺寸分类
  let screenSize: 'small' | 'medium' | 'large';
  if (screenWidth < 768) {
    screenSize = 'small';
  } else if (screenWidth <= 1024) {
    screenSize = 'medium';
  } else {
    screenSize = 'large';
  }
  
  // 平台检测
  let platform: DeviceInfo['platform'] = 'unknown';
  if (/ipad|iphone|ipod/i.test(userAgent)) {
    platform = 'ios';
  } else if (/android/i.test(userAgent)) {
    platform = 'android';
  } else if (/windows/i.test(userAgent)) {
    platform = 'windows';
  } else if (/mac/i.test(userAgent)) {
    platform = 'macos';
  } else if (/linux/i.test(userAgent)) {
    platform = 'linux';
  }
  
  return {
    isTablet,
    isMobile,
    isDesktop,
    isTouch,
    orientation: isLandscape ? 'landscape' : 'portrait',
    screenSize,
    platform
  };
}

/**
 * 响应式断点检测
 */
export const breakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
} as const;

export function getBreakpoint(): keyof typeof breakpoints | 'large' {
  const width = window.innerWidth;
  
  if (width < breakpoints.mobile) return 'mobile';
  if (width < breakpoints.tablet) return 'tablet';
  if (width < breakpoints.desktop) return 'desktop';
  return 'large';
}

/**
 * 监听设备方向变化
 */
export function onOrientationChange(callback: (orientation: 'portrait' | 'landscape') => void): () => void {
  const handleOrientationChange = () => {
    const isLandscape = window.innerWidth > window.innerHeight;
    callback(isLandscape ? 'landscape' : 'portrait');
  };

  // 监听窗口大小变化（更可靠的方向检测）
  window.addEventListener('resize', handleOrientationChange);
  
  // 监听设备方向变化事件（如果支持）
  if ('orientation' in screen) {
    screen.orientation?.addEventListener('change', handleOrientationChange);
  }

  // 返回清理函数
  return () => {
    window.removeEventListener('resize', handleOrientationChange);
    if ('orientation' in screen) {
      screen.orientation?.removeEventListener('change', handleOrientationChange);
    }
  };
}

/**
 * 为DOM元素添加设备类型类名
 */
export function applyDeviceClasses(element: HTMLElement): void {
  const device = detectDevice();
  const breakpoint = getBreakpoint();
  
  // 清除旧的类名
  element.classList.remove(
    'weave-mobile', 'weave-tablet', 'weave-desktop',
    'weave-touch', 'weave-no-touch',
    'weave-portrait', 'weave-landscape',
    'weave-small', 'weave-medium', 'weave-large'
  );
  
  // 添加设备类型类名
  if (device.isMobile) element.classList.add('weave-mobile');
  if (device.isTablet) element.classList.add('weave-tablet');
  if (device.isDesktop) element.classList.add('weave-desktop');
  
  // 添加触控类型类名
  element.classList.add(device.isTouch ? 'weave-touch' : 'weave-no-touch');
  
  // 添加方向类名
  element.classList.add(`weave-${device.orientation}`);
  
  // 添加屏幕尺寸类名
  element.classList.add(`weave-${device.screenSize}`);
  
  // 添加断点类名
  element.classList.add(`weave-bp-${breakpoint}`);
}

/**
 * 获取推荐的触控目标尺寸
 */
export function getRecommendedTouchSize(device: DeviceInfo): {
  minSize: number;
  recommendedSize: number;
  spacing: number;
} {
  if (device.isTablet) {
    return {
      minSize: 44, // 44px 最小触控目标
      recommendedSize: 48, // 48px 推荐尺寸
      spacing: 8 // 8px 间距
    };
  } else if (device.isMobile) {
    return {
      minSize: 44,
      recommendedSize: 56, // 移动端更大的触控目标
      spacing: 12
    };
  } else {
    return {
      minSize: 32,
      recommendedSize: 36, // 桌面端可以更小
      spacing: 4
    };
  }
}

/**
 * 检查是否支持平板端特定功能
 */
export function getTabletCapabilities(): {
  supportsTouch: boolean;
  supportsMultiTouch: boolean;
  supportsOrientationChange: boolean;
  supportsHover: boolean;
  supportsPointerEvents: boolean;
} {
  return {
    supportsTouch: 'ontouchstart' in window,
    supportsMultiTouch: navigator.maxTouchPoints > 1,
    supportsOrientationChange: 'orientation' in screen,
    supportsHover: window.matchMedia('(hover: hover)').matches,
    supportsPointerEvents: 'onpointerdown' in window
  };
}

/**
 * Obsidian移动端API检测
 */
export function isObsidianMobile(): boolean {
  // Obsidian移动端会有特定的API
  return !!(window as any).app?.isMobile;
}

/**
 * 获取安全区域信息（用于刘海屏等）
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
    right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0')
  };
}
