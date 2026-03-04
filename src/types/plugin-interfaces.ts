/**
 * 插件接口定义
 * 用于类型安全的依赖注入
 */

import { App, TFile, Vault, MetadataCache } from 'obsidian';
import { ParsedCard } from './newCardParsingTypes';
import type { WeaveDataStorage } from '../data/storage';
import type { BlockLinkCleanupService } from '../services/cleanup/BlockLinkCleanupService';

/**
 * Weave插件最小接口
 * 用于批量解析服务和其他子模块引用插件实例
 */
export interface IWeavePlugin {
  /**
   * 插件设置
   */
  settings: {
    simplifiedParsing?: any; // 简化解析设置
    [key: string]: any;
  };
  
  /**
   * 统一的卡片保存方法
   * @param cards 待保存的卡片数组
   */
  addCardsToDB(cards: ParsedCard[]): Promise<void>;
  
  /**
   * 数据存储服务
   */
  dataStorage: WeaveDataStorage;
  
  /**
   * 块链接清理服务
   */
  blockLinkCleanupService: BlockLinkCleanupService;
  
  /**
   * 保存插件设置
   */
  saveSettings(): Promise<void>;
}

/**
 * Obsidian App 最小接口
 * 仅包含批量解析所需的核心功能
 */
export interface IObsidianApp {
  /**
   * Vault实例（文件系统操作）
   */
  vault: Vault;
  
  /**
   * 元数据缓存（可选）
   */
  metadataCache?: MetadataCache;
}

/**
 * 类型守卫：检查是否为有效的Weave插件实例
 */
export function isWeavePlugin(obj: any): obj is IWeavePlugin {
  return obj && 
         typeof obj.addCardsToDB === 'function' && 
         obj.settings !== undefined;
}

/**
 * 类型守卫：检查是否为有效的Obsidian App实例
 */
export function isObsidianApp(obj: any): obj is IObsidianApp {
  return obj && obj.vault !== undefined;
}






