/**
 * 渐进式挖空清理开发工具
 * 
 * 提供控制台命令，用于清理 V1.5 格式的渐进式挖空卡片
 * 
 * 使用方法（浏览器控制台）：
 * ```javascript
 * // 1. 检查是否有 V1.5 卡片
 * await plugin.checkV15Cards();
 * 
 * // 2. 模拟运行清理（不实际删除）
 * await plugin.cleanV15Cards(true);
 * 
 * // 3. 实际执行清理
 * await plugin.cleanV15Cards(false);
 * ```
 * 
 * @module utils/dev/progressive-cleanup-tool
 */

import { logger } from '../logger';
import { cleanV15ProgressiveCards, hasV15ProgressiveCards } from '../migration/clean-v15-progressive-cards';
import type { WeaveDataStorage } from '../../data/storage';
import type WeavePlugin from '../../main';

/**
 * 注册清理工具到插件实例
 * 
 * @param plugin 插件实例
 */
export function registerProgressiveCleanupTool(plugin: WeavePlugin) {
  // 添加到全局 window 对象，方便控制台调用
  (window as any).weaveDevTools = (window as any).weaveDevTools || {};
  
  // 检查 V1.5 卡片
  (window as any).weaveDevTools.checkV15Cards = async () => {
    logger.info('[开发工具] 检查 V1.5 卡片...');
    
    try {
      const hasV15 = await hasV15ProgressiveCards(plugin.dataStorage);
      
      if (hasV15) {
        logger.warn('[开发工具] ⚠️ 发现 V1.5 格式卡片');
        logger.info('[开发工具] 运行清理命令: window.weaveDevTools.cleanV15Cards(true)');
        return true;
      } else {
        logger.info('[开发工具] ✅ 未发现 V1.5 格式卡片');
        return false;
      }
    } catch (error) {
      logger.error('[开发工具] 检查失败:', error);
      throw error;
    }
  };
  
  // 清理 V1.5 卡片
  (window as any).weaveDevTools.cleanV15Cards = async (dryRun: boolean = true) => {
    const mode = dryRun ? '模拟' : '实际';
    logger.info(`[开发工具] 开始清理 V1.5 卡片（${mode}模式）...`);
    
    if (!dryRun) {
      logger.warn('[开发工具] ⚠️ 即将实际删除卡片，3秒后开始...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    try {
      const result = await cleanV15ProgressiveCards(plugin.dataStorage, dryRun);
      
      // 显示结果
      console.group(`[开发工具] 清理完成 - ${mode}模式`);
      console.log(`总扫描: ${result.totalScanned} 张`);
      console.log(`已删除: ${result.deletedCount} 张`);
      console.log(`失败: ${result.errors.length} 张`);
      
      if (result.deletedCards.length > 0) {
        console.group('删除的卡片:');
        result.deletedCards.forEach(({ uuid, reason }) => {
          console.log(`- ${uuid}: ${reason}`);
        });
        console.groupEnd();
      }
      
      if (result.errors.length > 0) {
        console.group('失败的卡片:');
        result.errors.forEach(({ uuid, error }) => {
          console.error(`- ${uuid}: ${error}`);
        });
        console.groupEnd();
      }
      
      console.groupEnd();
      
      if (dryRun && result.deletedCount > 0) {
        logger.info('[开发工具] 要实际执行删除，运行: window.weaveDevTools.cleanV15Cards(false)');
      }
      
      return result;
    } catch (error) {
      logger.error('[开发工具] 清理失败:', error);
      throw error;
    }
  };
  
  // 添加快捷方式到插件实例
  (plugin as any).checkV15Cards = (window as any).weaveDevTools.checkV15Cards;
  (plugin as any).cleanV15Cards = (window as any).weaveDevTools.cleanV15Cards;
  
  logger.debug('[开发工具] V1.5 清理工具已注册');
  logger.debug('[开发工具] 可用命令:');
  logger.debug('  - window.weaveDevTools.checkV15Cards()');
  logger.debug('  - window.weaveDevTools.cleanV15Cards(true)  // 模拟运行');
  logger.debug('  - window.weaveDevTools.cleanV15Cards(false) // 实际删除');
}
