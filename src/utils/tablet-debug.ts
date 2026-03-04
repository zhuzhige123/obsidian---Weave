import { logger } from '../utils/logger';
/**
 * 平板端调试和测试工具
 * 用于在开发环境中模拟和测试平板端功能
 */

import { detectDevice, type DeviceInfo } from './tablet-detection';

export interface TabletDebugConfig {
  enabled: boolean;
  mockDevice?: Partial<DeviceInfo>;
  showDebugInfo: boolean;
  logDeviceChanges: boolean;
  enableTouchSimulation: boolean;
}

class TabletDebugger {
  private config: TabletDebugConfig = {
    enabled: false,
    showDebugInfo: false,
    logDeviceChanges: false,
    enableTouchSimulation: false
  };

  private debugOverlay: HTMLElement | null = null;
  private originalDeviceInfo: DeviceInfo | null = null;

  /**
   * 启用平板端调试模式
   */
  enable(config: Partial<TabletDebugConfig> = {}): void {
    this.config = { ...this.config, enabled: true, ...config };
    
    // 禁用自动显示调试信息浮窗，需要时手动调用
    if (this.config.showDebugInfo && config.showDebugInfo !== undefined) {
      this.createDebugOverlay();
    }
    
    if (this.config.logDeviceChanges) {
      this.setupDeviceLogging();
    }
    
    if (this.config.enableTouchSimulation) {
      this.setupTouchSimulation();
    }
    
    logger.debug('[TabletDebugger] 调试模式已启用', this.config);
  }

  /**
   * 禁用调试模式
   */
  disable(): void {
    this.config.enabled = false;
    this.removeDebugOverlay();
    
    // ✅ 清理设备日志设置
    if ((window as any).__weave_debugger_setup) {
      delete (window as any).__weave_debugger_setup;
      // 注意：不恢复 addEventListener，因为可能影响其他插件
      logger.debug('[TabletDebugger] 已清理调试设置标记');
    }
    
    logger.debug('[TabletDebugger] 调试模式已禁用');
  }

  /**
   * 模拟特定设备
   */
  mockDevice(deviceInfo: Partial<DeviceInfo>): void {
    if (!this.originalDeviceInfo) {
      this.originalDeviceInfo = detectDevice();
    }

    // 重写设备检测函数
    const mockDetectDevice = () => ({
      ...this.originalDeviceInfo!,
      ...deviceInfo
    });

    // 替换全局设备检测函数
    (window as any).__weave_detectDevice = mockDetectDevice;
    
    logger.debug('[TabletDebugger] 设备模拟已启用', deviceInfo);
    this.updateDebugOverlay();
  }

  /**
   * 恢复真实设备检测
   */
  restoreDevice(): void {
    delete (window as any).__weave_detectDevice;
    logger.debug('[TabletDebugger] 已恢复真实设备检测');
    this.updateDebugOverlay();
  }

  /**
   * 模拟方向变化
   */
  simulateOrientationChange(orientation: 'portrait' | 'landscape'): void {
    const event = new CustomEvent('orientationchange', {
      detail: { orientation }
    });
    window.dispatchEvent(event);
    
    // 同时触发resize事件
    window.dispatchEvent(new Event('resize'));
    
    logger.debug('[TabletDebugger] 模拟方向变化:', orientation);
  }

  /**
   * 创建调试信息覆盖层
   */
  private createDebugOverlay(): void {
    if (this.debugOverlay) return;

    this.debugOverlay = document.createElement('div');
    this.debugOverlay.id = 'weave-tablet-debug';
    this.debugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
      pointer-events: none;
    `;

    document.body.appendChild(this.debugOverlay);
    this.updateDebugOverlay();
  }

  /**
   * 更新调试信息
   */
  private updateDebugOverlay(): void {
    if (!this.debugOverlay) return;

    const deviceInfo = (window as any).__weave_detectDevice?.() || detectDevice();
    const screenInfo = {
      width: window.innerWidth,
      height: window.innerHeight,
      ratio: window.devicePixelRatio
    };

    this.debugOverlay.innerHTML = `
      <div><strong>🖥️ 设备信息</strong></div>
      <div>类型: ${deviceInfo.isTablet ? 'Tablet' : deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</div>
      <div>触控: ${deviceInfo.isTouch ? 'Yes' : 'No'}</div>
      <div>方向: ${deviceInfo.orientation}</div>
      <div>尺寸: ${deviceInfo.screenSize}</div>
      <div>平台: ${deviceInfo.platform}</div>
      <div><strong>📱 屏幕信息</strong></div>
      <div>分辨率: ${screenInfo.width}x${screenInfo.height}</div>
      <div>像素比: ${screenInfo.ratio}</div>
      <div>User Agent: ${navigator.userAgent.slice(0, 50)}...</div>
      ${this.config.mockDevice ? '<div style="color: yellow">⚠️ 设备模拟中</div>' : ''}
    `;
  }

  /**
   * 移除调试覆盖层
   */
  private removeDebugOverlay(): void {
    if (this.debugOverlay) {
      document.body.removeChild(this.debugOverlay);
      this.debugOverlay = null;
    }
  }

  /**
   * 设置设备变化日志
   */
  private setupDeviceLogging(): void {
    // ✅ 添加安全检查，避免重复设置
    if ((window as any).__weave_debugger_setup) {
      logger.warn('[TabletDebugger] 设备日志已设置，跳过');
      return;
    }

    const originalAddEventListener = window.addEventListener;
    
    window.addEventListener = function(
      type: string, 
      listener: EventListenerOrEventListenerObject | null, 
      options?: boolean | AddEventListenerOptions
    ): void {
      if (type === 'resize' || type === 'orientationchange') {
        const wrappedListener = (event: Event) => {
          // 设备事件触发
          
          // ✅ 修复上下文绑定问题，安全调用原始监听器
          try {
            if (typeof listener === 'function') {
              // 使用事件目标或当前目标作为正确的上下文
              const context = event.currentTarget || event.target || window;
              return (listener as EventListener).call(context, event);
            } else if (listener && typeof (listener as EventListenerObject).handleEvent === 'function') {
              // ✅ 支持 EventListener 接口
              return (listener as EventListenerObject).handleEvent.call(listener, event);
            }
          } catch (error) {
            logger.warn('[TabletDebugger] 监听器调用失败:', error);
          }
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener!, options);
    };

    // ✅ 标记已设置，避免重复
    (window as any).__weave_debugger_setup = true;
  }

  /**
   * 设置触控模拟
   */
  private setupTouchSimulation(): void {
    // 为鼠标事件添加触控类模拟
    document.addEventListener('mousedown', (e) => {
      const touchEvent = new TouchEvent('touchstart', {
        touches: [new Touch({
          identifier: 0,
          target: e.target as Element,
          clientX: e.clientX,
          clientY: e.clientY,
          radiusX: 20,
          radiusY: 20,
          rotationAngle: 0,
          force: 1
        })]
      });
      e.target?.dispatchEvent(touchEvent);
    });

    logger.debug('[TabletDebugger] 触控模拟已启用');
  }

  /**
   * 获取当前配置
   */
  getConfig(): TabletDebugConfig {
    return { ...this.config };
  }

  /**
   * 获取调试统计信息
   */
  getStats(): {
    currentDevice: DeviceInfo;
    isMocked: boolean;
    screenInfo: any;
    capabilities: any;
  } {
    return {
      currentDevice: (window as any).__weave_detectDevice?.() || detectDevice(),
      isMocked: !!(window as any).__weave_detectDevice,
      screenInfo: {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: window.devicePixelRatio,
        available: {
          width: screen.availWidth,
          height: screen.availHeight
        }
      },
      capabilities: {
        touch: 'ontouchstart' in window,
        multiTouch: navigator.maxTouchPoints,
        hover: window.matchMedia('(hover: hover)').matches,
        pointerEvents: 'onpointerdown' in window
      }
    };
  }
}

// 全局调试器实例
export const tabletDebugger = new TabletDebugger();

/**
 * 预设的测试设备配置
 */
export const testDevicePresets = {
  iPad: {
    isTablet: true,
    isMobile: false,
    isDesktop: false,
    isTouch: true,
    orientation: 'portrait' as const,
    screenSize: 'medium' as const,
    platform: 'ios' as const
  },
  AndroidTablet: {
    isTablet: true,
    isMobile: false,
    isDesktop: false,
    isTouch: true,
    orientation: 'landscape' as const,
    screenSize: 'medium' as const,
    platform: 'android' as const
  },
  iPhone: {
    isTablet: false,
    isMobile: true,
    isDesktop: false,
    isTouch: true,
    orientation: 'portrait' as const,
    screenSize: 'small' as const,
    platform: 'ios' as const
  },
  Desktop: {
    isTablet: false,
    isMobile: false,
    isDesktop: true,
    isTouch: false,
    orientation: 'landscape' as const,
    screenSize: 'large' as const,
    platform: 'windows' as const
  }
} as const;

/**
 * 快速开启调试模式的便捷函数
 * 在浏览器控制台中使用
 */
(window as any).weaveTabletDebug = {
  enable: () => tabletDebugger.enable({ showDebugInfo: true, logDeviceChanges: true }),
  disable: () => tabletDebugger.disable(),
  mockiPad: () => tabletDebugger.mockDevice(testDevicePresets.iPad),
  mockAndroid: () => tabletDebugger.mockDevice(testDevicePresets.AndroidTablet),
  mockMobile: () => tabletDebugger.mockDevice(testDevicePresets.iPhone),
  restore: () => tabletDebugger.restoreDevice(),
  stats: () => tabletDebugger.getStats(),
  landscape: () => tabletDebugger.simulateOrientationChange('landscape'),
  portrait: () => tabletDebugger.simulateOrientationChange('portrait')
};

logger.debug('🔧 平板端调试工具已加载！使用 window.weaveTabletDebug 进行调试');
logger.debug('常用命令:');
logger.debug('- weaveTabletDebug.enable() - 启用调试');
logger.debug('- weaveTabletDebug.mockiPad() - 模拟iPad');
logger.debug('- weaveTabletDebug.landscape() - 模拟横屏');
logger.debug('- weaveTabletDebug.stats() - 查看设备信息');
