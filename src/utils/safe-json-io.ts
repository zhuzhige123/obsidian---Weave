/**
 * 安全 JSON 读写工具
 * 
 * 为关键数据文件提供写前备份和读取恢复能力：
 * - 写入前将当前文件内容备份到插件目录（不同步）
 * - 读取时若 JSON 解析失败，自动尝试从备份恢复
 * 
 * 备份存储位置：.obsidian/plugins/weave/backups/
 */

import { logger } from './logger';
import { PLUGIN_PATHS } from '../config/paths';
import { DirectoryUtils } from './directory-utils';

const BACKUP_DIR = `${PLUGIN_PATHS.backups}/json-recovery`;

/**
 * 将 vault 路径转换为备份文件路径
 * 例: weave/memory/decks.json → .obsidian/plugins/weave/backups/json-recovery/weave__memory__decks.json
 */
function toBackupPath(vaultPath: string): string {
  const safeName = vaultPath.replace(/[\/\\]/g, '__');
  return `${BACKUP_DIR}/${safeName}`;
}

/**
 * 安全写入 JSON：写入前备份当前版本
 * @param adapter Obsidian vault adapter
 * @param filePath vault 内文件路径
 * @param content 要写入的 JSON 字符串
 */
export async function safeWriteJson(
  adapter: { read: (path: string) => Promise<string>; write: (path: string, data: string) => Promise<void>; exists: (path: string) => Promise<boolean> },
  filePath: string,
  content: string
): Promise<void> {
  // 尝试备份当前版本
  try {
    if (await adapter.exists(filePath)) {
      const current = await adapter.read(filePath);
      // 只有当前内容是有效 JSON 时才备份（避免备份已损坏的文件）
      JSON.parse(current);
      await DirectoryUtils.ensureDirRecursive(adapter as any, BACKUP_DIR);
      await adapter.write(toBackupPath(filePath), current);
    }
  } catch {
    // 备份失败不影响正常写入
  }

  // 正常写入
  await adapter.write(filePath, content);
}

/**
 * 安全读取 JSON：解析失败时尝试从备份恢复
 * @param adapter Obsidian vault adapter
 * @param filePath vault 内文件路径
 * @returns 解析后的对象，若完全无法恢复则返回 null
 */
export async function safeReadJson<T = any>(
  adapter: { read: (path: string) => Promise<string>; exists: (path: string) => Promise<boolean>; write: (path: string, data: string) => Promise<void> },
  filePath: string
): Promise<T | null> {
  // 尝试正常读取
  try {
    if (await adapter.exists(filePath)) {
      const content = await adapter.read(filePath);
      return JSON.parse(content) as T;
    }
  } catch (parseError) {
    logger.error(`[SafeJsonIO] JSON 解析失败: ${filePath}`, parseError);

    // 尝试从备份恢复
    const backupPath = toBackupPath(filePath);
    try {
      if (await adapter.exists(backupPath)) {
        const backup = await adapter.read(backupPath);
        const data = JSON.parse(backup) as T;
        logger.warn(`[SafeJsonIO] 已从备份恢复: ${filePath}`);

        // 用备份覆盖损坏的文件
        await adapter.write(filePath, backup);
        logger.info(`[SafeJsonIO] 已用备份覆盖损坏文件: ${filePath}`);

        return data;
      }
    } catch (backupError) {
      logger.error(`[SafeJsonIO] 备份恢复也失败: ${filePath}`, backupError);
    }
  }

  return null;
}
