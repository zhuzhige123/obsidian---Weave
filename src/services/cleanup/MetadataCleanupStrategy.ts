/**
 * 元数据清理策略接口
 * 
 * 定义清理策略的统一接口，不同的卡片创建方式实现不同的清理策略
 */

import { Vault } from 'obsidian';
import { CardCreationType, CleanupTarget, CleanupResult } from './types';

/**
 * 清理策略接口
 */
export interface ICleanupStrategy {
  /** 策略类型 */
  readonly type: CardCreationType;
  
  /**
   * 执行清理
   * @param target 清理目标
   * @param vault Obsidian Vault实例
   * @returns 清理结果
   */
  execute(target: CleanupTarget, vault: Vault): Promise<CleanupResult>;
  
  /**
   * 验证是否需要清理
   * @param target 清理目标
   * @returns 是否需要清理
   */
  shouldCleanup(target: CleanupTarget): Promise<boolean>;
}
