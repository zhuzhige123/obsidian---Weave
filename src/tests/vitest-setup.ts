import { logger } from '../utils/logger';
/**
 * Vitest测试环境配置
 * 
 * 提供全局测试工具和DOM匹配器
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 全局测试工具
global.vi = vi;

// Mock Obsidian全局对象（如果需要）
if (typeof window !== 'undefined') {
  // 确保测试环境中有基本的window对象
  (window as any).app = {};
}

// 清理函数：每个测试后清理
afterEach(() => {
  vi.clearAllMocks();
});

logger.debug('✓ Vitest测试环境已初始化');
