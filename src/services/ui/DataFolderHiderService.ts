/**
 * 数据文件夹CSS隐藏服务
 * 
 * 功能：通过CSS选择器隐藏文件浏览器中的数据文件夹
 * 
 * 核心原则：
 * 1. 精确定位：只影响指定的数据文件夹
 * 2. 样式隔离：不泄露到其他元素、插件或Obsidian本身
 * 3. 用户可控：可随时启用/禁用
 * 4. 安全保护：运行时监控和自动保护机制
 * 
 * @module services/ui/DataFolderHiderService
 */

import { logger } from '../../utils/logger';
import { Notice } from 'obsidian';

export class DataFolderHiderService {
  private styleElement: HTMLStyleElement | null = null;
  private monitorInterval: number | null = null;
  private isEnabled: boolean = false;
  
  /**
   * 启用CSS隐藏
   * @param folderName 要隐藏的文件夹名称（不含路径，仅名称）
   */
  enable(folderName: string): void {
    if (this.isEnabled) {
      logger.debug('[DataFolderHider] 已启用，跳过重复启用');
      return;
    }
    
    // 🔒 生成精确隔离的CSS规则
    const css = this.generateIsolatedCSS(folderName);
    
    // 创建样式元素
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'weave-data-folder-hider';
    this.styleElement.setAttribute('data-folder', folderName);
    this.styleElement.textContent = css;
    
    // 注入到页面
    document.head.appendChild(this.styleElement);
    
    this.isEnabled = true;
    logger.info(`[DataFolderHider] ✅ CSS隐藏已启用，文件夹: ${folderName}`);
    
    // 验证注入
    this.validateInjection(folderName);
    
    // 开发模式下启动监控
    if (process.env.NODE_ENV === 'development') {
      this.startLeakageMonitor(folderName);
    }
  }
  
  /**
   * 禁用CSS隐藏
   */
  disable(): void {
    if (!this.isEnabled) {
      logger.debug('[DataFolderHider] 未启用，跳过禁用');
      return;
    }
    
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    
    this.stopLeakageMonitor();
    this.isEnabled = false;
    
    logger.info('[DataFolderHider] ✅ CSS隐藏已禁用');
  }
  
  /**
   * 生成精确隔离的CSS规则
   * 
   * 设计原则：
   * - 每个选择器必须包含面板类型限定
   * - 使用精确的 data-path 匹配，不使用通配符
   * - 限定DOM层级，避免误伤
   * - 添加 !important 防止被覆盖
   */
  private generateIsolatedCSS(folderName: string): string {
    return `
/* ========================================
 * Weave 数据文件夹CSS隐藏规则
 * 
 * 仅影响: ${folderName}
 * 版本: v1.0.0
 * 
 * 🔒 基于Obsidian社区验证的选择器
 * 参考: https://forum.obsidian.md/t/snippet-custom-css-to-hide-attachments-folder/49494
 * ======================================== */

/* 核心规则：隐藏文件夹及其子内容 */
div[data-path="${folderName}"],
div[data-path="${folderName}"] + div.nav-folder-children {
  display: none !important;
}

/* 辅助规则：隐藏文件夹标题 */
.nav-folder-title[data-path="${folderName}"] {
  display: none !important;
}

/* 书签面板支持 */
.tree-item[data-path="${folderName}"] {
  display: none !important;
}
`;
  }
  
  /**
   * 验证CSS注入是否正确
   */
  private validateInjection(folderName: string): void {
    // 检查是否有重复的样式元素
    const weaveStyles = document.querySelectorAll('style#weave-data-folder-hider');
    
    if (weaveStyles.length === 0) {
      logger.error('[DataFolderHider] ❌ CSS注入失败，样式元素未找到');
      return;
    }
    
    if (weaveStyles.length > 1) {
      logger.warn('[DataFolderHider] ⚠️ 检测到重复的样式元素，正在清理...');
      // 保留第一个，删除其余
      for (let i = 1; i < weaveStyles.length; i++) {
        weaveStyles[i].remove();
      }
    }
    
    // 确认样式已应用
    if (this.styleElement && this.styleElement.isConnected) {
      logger.info('[DataFolderHider] ✅ CSS样式已成功注入');
      
      // 快速检查目标是否被隐藏
      setTimeout(() => {
        this.quickValidation(folderName);
      }, 500);
    }
  }
  
  /**
   * 快速验证目标文件夹是否被隐藏
   */
  private quickValidation(folderName: string): void {
    const targetFolder = document.querySelector(
      `.nav-folder-title[data-path="${folderName}"]`
    );
    
    if (targetFolder) {
      const isHidden = window.getComputedStyle(targetFolder).display === 'none';
      
      if (isHidden) {
        logger.info(`[DataFolderHider] ✅ 目标文件夹 "${folderName}" 已成功隐藏`);
      } else {
        logger.warn(`[DataFolderHider] ⚠️ 目标文件夹 "${folderName}" 未被隐藏，CSS可能失效`);
      }
    } else {
      logger.debug(`[DataFolderHider] 目标文件夹 "${folderName}" 尚未渲染到DOM`);
    }
  }
  
  /**
   * 启动泄漏监控（仅开发模式）
   */
  private startLeakageMonitor(folderName: string): void {
    if (this.monitorInterval) {
      return;
    }
    
    logger.info('[DataFolderHider] 🔍 启动CSS泄漏监控（开发模式）');
    
    // 每30秒检查一次
    this.monitorInterval = window.setInterval(() => {
      this.detectLeakage(folderName);
    }, 30000);
  }
  
  /**
   * 停止泄漏监控
   */
  private stopLeakageMonitor(): void {
    if (this.monitorInterval) {
      window.clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('[DataFolderHider] 🔍 CSS泄漏监控已停止');
    }
  }
  
  /**
   * 检测CSS泄漏
   */
  private detectLeakage(targetFolder: string): void {
    const allFolders = document.querySelectorAll('.nav-folder-title');
    const hiddenFolders: string[] = [];
    let targetHidden = false;
    
    allFolders.forEach((folder) => {
      const path = folder.getAttribute('data-path');
      const isHidden = window.getComputedStyle(folder).display === 'none';
      
      if (isHidden && path) {
        hiddenFolders.push(path);
        
        if (path === targetFolder) {
          targetHidden = true;
        }
      }
    });
    
    // 检查是否有意外隐藏的文件夹
    const unexpectedHidden = hiddenFolders.filter(
      path => path !== targetFolder && !path.startsWith(targetFolder + '/')
    );
    
    if (unexpectedHidden.length > 0) {
      logger.error(
        '[DataFolderHider] 🚨 CSS泄漏检测：以下文件夹被意外隐藏',
        unexpectedHidden
      );
      
      // 紧急禁用CSS
      this.emergencyDisable();
    } else if (!targetHidden) {
      logger.warn(`[DataFolderHider] ⚠️ 目标文件夹 "${targetFolder}" 未被隐藏`);
    } else {
      logger.debug('[DataFolderHider] ✅ CSS隔离检查通过，无泄漏');
    }
  }
  
  /**
   * 紧急禁用（检测到泄漏时）
   */
  private emergencyDisable(): void {
    logger.error('[DataFolderHider] 🚨 检测到CSS泄漏，执行紧急禁用');
    
    this.disable();
    
    new Notice(
      '⚠️ Weave: 检测到数据文件夹CSS泄漏，已自动禁用隐藏功能\n' +
      '请联系开发者报告此问题',
      10000
    );
  }
  
  /**
   * 获取当前状态
   */
  getStatus(): { enabled: boolean; folderName: string | null } {
    return {
      enabled: this.isEnabled,
      folderName: this.styleElement?.getAttribute('data-folder') || null
    };
  }
  
  /**
   * 清理资源
   */
  destroy(): void {
    this.disable();
    logger.info('[DataFolderHider] 服务已销毁');
  }
}

/**
 * CSS泄漏测试工具（开发模式）
 */
export class DataFolderHiderTester {
  constructor(private folderName: string) {}
  
  /**
   * 测试1: 验证仅目标文件夹被隐藏
   */
  testTargetOnly(): boolean {
    const targetFolder = document.querySelector(
      `.nav-folder-title[data-path="${this.folderName}"]`
    );
    
    if (!targetFolder) {
      return false;
    }
    
    const isHidden = window.getComputedStyle(targetFolder).display === 'none';
    
    console.assert(
      isHidden,
      `❌ 目标文件夹 "${this.folderName}" 应该被隐藏`
    );
    
    return isHidden;
  }
  
  /**
   * 测试2: 验证其他文件夹不受影响
   */
  testOtherFoldersVisible(): boolean {
    const allFolders = document.querySelectorAll('.nav-folder-title');
    let passed = true;
    
    allFolders.forEach((folder) => {
      const path = folder.getAttribute('data-path');
      const isHidden = window.getComputedStyle(folder).display === 'none';
      
      // 排除目标文件夹及其子文件夹
      if (path && path !== this.folderName && !path.startsWith(this.folderName + '/')) {
        if (isHidden) {
          passed = false;
        }
      }
    });
    
    return passed;
  }
  
  /**
   * 运行所有测试
   */
  runAllTests(): void {
    console.group('🧪 Weave CSS隔离性测试');
    
    try {
      const test1 = this.testTargetOnly();
      const test2 = this.testOtherFoldersVisible();
      
      if (test1 && test2) {
        console.log('%c✅ 所有测试通过', 'color: green; font-weight: bold;');
      } else {
        console.error('%c❌ 部分测试失败', 'color: red; font-weight: bold;');
      }
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
    }
    
    console.groupEnd();
  }
}

// 开发模式下暴露测试工具
if (process.env.NODE_ENV === 'development') {
  (window as any).testWeaveCSS = (folderName: string = 'weave-data') => {
    new DataFolderHiderTester(folderName).runAllTests();
  };
}
