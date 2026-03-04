/**
 * 移动端模态窗边界检测工具
 * 
 * 动态获取 Obsidian 工作区的安全边界，用于模态窗定位
 * 确保模态窗不会遮挡 Obsidian 的顶部/底部功能栏
 * 
 * 🔑 全局方案：通过 CSS 变量统一管理所有模态窗的边界
 * 调用 injectMobileBoundsCSSVariables() 即可自动设置全局 CSS 变量
 */

export interface WorkspaceBounds {
  /** 顶部安全边界（距视口顶部的距离） */
  top: number;
  /** 底部安全边界（距视口底部的距离） */
  bottom: number;
  /** 可用高度 */
  height: number;
  /** 检测到的元素信息（用于调试） */
  detected: string;
}

/**
 * 获取 Obsidian 工作区的安全边界
 * 通过检测 Obsidian UI 元素的位置来确定模态窗的可用区域
 */
export function getWorkspaceBounds(): WorkspaceBounds {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  let top = 0;
  let bottom = 0;
  const detected: string[] = [];
  
  // 顶部检测：按优先级尝试多个选择器
  const topSelectors = [
    '.mobile-navbar',                    // 移动端导航栏
    '.workspace-tab-header-container',   // 标签页头部容器
    '.view-header',                      // 视图头部
    '.titlebar',                         // 标题栏
  ];
  
  for (const selector of topSelectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      // 只取在视口顶部附近的元素（top < 200px）
      if (rect.top < 200 && rect.bottom > 0) {
        top = Math.max(top, rect.bottom);
        detected.push(`top:${selector}=${Math.round(rect.bottom)}px`);
      }
    }
  }
  
  // 底部检测：按优先级尝试多个选择器
  const bottomSelectors = [
    '.mobile-toolbar',   // 移动端工具栏
    '.status-bar',       // 状态栏
  ];
  
  for (const selector of bottomSelectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      // 只取在视口底部附近的元素
      if (rect.top > viewportHeight - 200) {
        const b = viewportHeight - rect.top;
        if (b > bottom) {
          bottom = b;
          detected.push(`bottom:${selector}=${Math.round(b)}px`);
        }
      }
    }
  }
  
  // 兜底：使用保守的默认值
  if (top < 30) {
    top = 50;
    detected.push('top:fallback=50px');
  }
  if (bottom < 30) {
    bottom = 56;
    detected.push('bottom:fallback=56px');
  }
  
  return {
    top: Math.round(top),
    bottom: Math.round(bottom),
    height: viewportHeight - Math.round(top) - Math.round(bottom),
    detected: detected.join(', ')
  };
}

/**
 * 检查当前是否为移动端环境
 */
export function isMobileDevice(): boolean {
  return document.body.classList.contains('is-phone') || 
         document.body.classList.contains('is-mobile');
}

/**
 * 获取移动端模态窗的内联样式
 * 返回可直接应用到模态窗容器的样式对象
 */
export function getMobileModalStyles(): { 
  containerStyle: string; 
  modalStyle: string;
} | null {
  if (!isMobileDevice()) {
    return null;
  }
  
  const bounds = getWorkspaceBounds();
  
  return {
    containerStyle: `top: ${bounds.top}px; bottom: ${bounds.bottom}px;`,
    modalStyle: `max-height: ${bounds.height - 24}px;`
  };
}

/**
 * 🔑 注入全局 CSS 变量到 document.documentElement
 * 所有模态窗可以通过 var(--weave-modal-top) 等变量来获取边界值
 * 
 * 应在插件初始化时调用，并监听窗口 resize 事件更新
 */
export function injectMobileBoundsCSSVariables(): void {
  if (!isMobileDevice()) {
    return;
  }

  const w = window as any;
  if (w.__weaveMobileBoundsInjected) {
    return;
  }
  w.__weaveMobileBoundsInjected = true;
  
  const updateVariables = () => {
    const bounds = getWorkspaceBounds();
    const root = document.documentElement;
    
    root.style.setProperty('--weave-modal-top', `${bounds.top}px`);
    root.style.setProperty('--weave-modal-bottom', `${bounds.bottom}px`);
    root.style.setProperty('--weave-modal-height', `${bounds.height}px`);
    root.style.setProperty('--weave-modal-max-height', `${bounds.height - 24}px`);
    root.style.setProperty('--weave-workspace-top-offset', `${bounds.top}px`);
    root.style.setProperty('--weave-workspace-bottom-offset', `${bounds.bottom}px`);
  };
  
  // 立即更新一次
  updateVariables();
  
  // 监听窗口变化
  window.addEventListener('resize', updateVariables);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateVariables);
    window.visualViewport.addEventListener('scroll', updateVariables);
  }

  w.__weaveMobileBoundsCleanup = () => {
    try {
      window.removeEventListener('resize', updateVariables);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateVariables);
        window.visualViewport.removeEventListener('scroll', updateVariables);
      }

      const root = document.documentElement;
      root.style.removeProperty('--weave-modal-top');
      root.style.removeProperty('--weave-modal-bottom');
      root.style.removeProperty('--weave-modal-height');
      root.style.removeProperty('--weave-modal-max-height');
      root.style.removeProperty('--weave-workspace-top-offset');
      root.style.removeProperty('--weave-workspace-bottom-offset');
    } catch {
    }

    try {
      delete w.__weaveMobileBoundsInjected;
      delete w.__weaveMobileBoundsCleanup;
    } catch {
      w.__weaveMobileBoundsInjected = false;
      w.__weaveMobileBoundsCleanup = null;
    }
  };
  
  // 延迟再更新一次，确保 Obsidian UI 完全加载
  setTimeout(updateVariables, 500);
  setTimeout(updateVariables, 1500);
}

export function destroyMobileModalAdaptation(): void {
  const w = window as any;
  try {
    if (typeof w.__weaveMobileBoundsCleanup === 'function') {
      w.__weaveMobileBoundsCleanup();
    }
  } catch {
  }

  try {
    const styleId = 'weave-mobile-modal-global-styles';
    const style = document.getElementById(styleId);
    style?.remove();
  } catch {
  }

  try {
    delete w.__weaveMobileModalAdaptationCleanup;
  } catch {
    w.__weaveMobileModalAdaptationCleanup = null;
  }
}

/**
 * 🔑 注入全局模态窗样式
 * 自动为所有 .weave-modal-backdrop、.modal-overlay 等元素应用边界限制
 */
export function injectGlobalModalStyles(): void {
  if (!isMobileDevice()) {
    return;
  }
  
  const styleId = 'weave-mobile-modal-global-styles';
  
  // 如果已存在则不重复注入
  if (document.getElementById(styleId)) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* 🔑 Weave 全局移动端模态窗适配 */
    body.is-mobile .weave-modal-backdrop,
    body.is-mobile .weave-modal-container,
    body.is-mobile .modal-overlay,
    body.is-mobile .test-result-backdrop,
    body.is-mobile .resizable-modal-overlay,
    body.is-mobile .receipt-modal {
      position: fixed !important;
      top: var(--weave-modal-top, 50px) !important;
      bottom: var(--weave-modal-bottom, 56px) !important;
      left: 0 !important;
      right: 0 !important;
      background: transparent !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      overflow-y: auto !important;
    }

    /* ResizableModal 自己管理滚动；避免 overlay 成为额外滚动容器 */
    body.is-mobile .resizable-modal-overlay {
      overflow: hidden !important;
    }
    
    body.is-mobile .weave-modal,
    body.is-mobile .test-result-card,
    body.is-mobile .receipt-modal .modal-content {
      max-height: var(--weave-modal-max-height, calc(100vh - 130px)) !important;
      overflow-y: auto !important;
      margin: 0 auto !important;
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
    }
    
    body.is-phone .weave-modal,
    body.is-phone .test-result-card,
    body.is-phone .receipt-modal .modal-content {
      border-radius: 12px !important;
      max-width: calc(100% - 16px) !important;
    }
    
    /* 📄 小票结果页面特殊处理 */
    body.is-mobile .receipt-modal .modal-background {
      display: none !important;
    }
    
    body.is-mobile .receipt-modal .printer-container {
      max-height: var(--weave-modal-max-height, calc(100vh - 130px)) !important;
      overflow-y: auto !important;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * 🔑 初始化全局移动端模态窗适配
 * 在插件 onload 时调用此函数即可完成所有设置
 */
export function initMobileModalAdaptation(): void {
  if (!isMobileDevice()) {
    return;
  }
  
  // 1. 注入 CSS 变量
  injectMobileBoundsCSSVariables();
  
  // 2. 注入全局样式
  injectGlobalModalStyles();

  const w = window as any;
  w.__weaveMobileModalAdaptationCleanup = destroyMobileModalAdaptation;
}
