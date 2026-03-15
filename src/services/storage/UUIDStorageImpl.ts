import { logger } from '../../utils/logger';
import { vaultStorage } from '../../utils/vault-local-storage';
/**
 * UUID存储实现
 * 实现 IUUIDStorage 接口，提供UUID记录的持久化存储
 */

import { IUUIDStorage, UUIDRecord } from '../batch-parsing';

/**
 * UUID存储实现类
 */
export class UUIDStorageImpl implements IUUIDStorage {
  private records: Map<string, UUIDRecord> = new Map();
  private cardIdIndex: Map<string, string> = new Map(); // cardId -> uuid
  private filePathIndex: Map<string, Set<string>> = new Map(); // filePath -> Set<uuid>

  constructor() {
    // 可以从本地存储加载数据
    void this.loadFromStorage();
  }

  /**
   * 保存UUID记录
   */
  saveRecord(record: UUIDRecord): Promise<void> {
    logger.debug(`[UUIDStorageImpl] 💾 保存UUID记录: ${record.uuid} -> ${record.cardId}`);
    
    this.records.set(record.uuid, record);
    this.cardIdIndex.set(record.cardId, record.uuid);
    
    // 更新文件路径索引
    if (!this.filePathIndex.has(record.sourceFile)) {
      this.filePathIndex.set(record.sourceFile, new Set());
    }
    this.filePathIndex.get(record.sourceFile)?.add(record.uuid);

    // 持久化到存储
    this.persistToStorage();
    
    logger.debug(`[UUIDStorageImpl] ✅ UUID记录已保存并持久化: ${record.uuid}`);
    logger.debug(`[UUIDStorageImpl] 📊 当前记录总数: ${this.records.size}`);
    return Promise.resolve();
  }

  /**
   * 根据UUID获取记录
   */
  getRecordByUUID(uuid: string): Promise<UUIDRecord | null> {
    return Promise.resolve(this.records.get(uuid) || null);
  }

  /**
   * 根据卡片ID获取记录
   */
  getRecordByCardId(cardId: string): Promise<UUIDRecord | null> {
    const uuid = this.cardIdIndex.get(cardId);
    if (!uuid) return Promise.resolve(null);
    return Promise.resolve(this.records.get(uuid) || null);
  }

  /**
   * 删除记录
   */
  deleteRecord(uuid: string): Promise<void> {
    const record = this.records.get(uuid);
    if (!record) return Promise.resolve();

    // 清理索引
    this.cardIdIndex.delete(record.cardId);
    
    const fileUuids = this.filePathIndex.get(record.sourceFile);
    if (fileUuids) {
      fileUuids.delete(uuid);
      if (fileUuids.size === 0) {
        this.filePathIndex.delete(record.sourceFile);
      }
    }

    this.records.delete(uuid);
    this.persistToStorage();
    return Promise.resolve();
  }

  /**
   * 检查UUID是否存在
   */
  uuidExists(uuid: string): Promise<boolean> {
    const exists = this.records.has(uuid);
    logger.debug(`[UUIDStorageImpl] 🔍 查询UUID: ${uuid} - ${exists ? '✅ 存在' : '❌ 不存在'} (总记录数: ${this.records.size})`);
    return Promise.resolve(exists);
  }

  /**
   * 获取文件的所有UUID
   */
  getFileUUIDs(filePath: string): Promise<UUIDRecord[]> {
    const uuids = this.filePathIndex.get(filePath);
    if (!uuids) return Promise.resolve([]);

    const records: UUIDRecord[] = [];
    for (const uuid of uuids) {
      const record = this.records.get(uuid);
      if (record) records.push(record);
    }

    return Promise.resolve(records);
  }

  /**
   * 从存储加载数据
   */
  private loadFromStorage(): void {
    try {
      const data = vaultStorage.getItem('weave-uuid-records');
      if (!data) return;

      const parsed = JSON.parse(data) as Array<UUIDRecord>;
      
      for (const record of parsed) {
        // 转换日期字符串为Date对象
        const recordWithDates: UUIDRecord = {
          ...record,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        };
        
        this.records.set(record.uuid, recordWithDates);
        this.cardIdIndex.set(record.cardId, record.uuid);
        
        if (!this.filePathIndex.has(record.sourceFile)) {
          this.filePathIndex.set(record.sourceFile, new Set());
        }
        this.filePathIndex.get(record.sourceFile)?.add(record.uuid);
      }

      logger.debug(`[UUIDStorageImpl] 已加载 ${this.records.size} 条UUID记录`);
    } catch (error) {
      logger.error('[UUIDStorageImpl] 加载UUID记录失败:', error);
    }
  }

  /**
   * 持久化到存储
   */
  private persistToStorage(): void {
    try {
      const records = Array.from(this.records.values());
      vaultStorage.setItem('weave-uuid-records', JSON.stringify(records));
    } catch (error) {
      logger.error('[UUIDStorageImpl] 持久化UUID记录失败:', error);
    }
  }

  /**
   * 清空所有记录
   */
  clear(): Promise<void> {
    this.records.clear();
    this.cardIdIndex.clear();
    this.filePathIndex.clear();
    this.persistToStorage();
    return Promise.resolve();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalRecords: this.records.size,
      totalFiles: this.filePathIndex.size
    };
  }
}

