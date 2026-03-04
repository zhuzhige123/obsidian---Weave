/**
 * 许可证相关类型定义
 * 这是唯一的权威类型定义，所有其他地方必须导入使用此类型
 */

/**
 * 云端同步状态
 */
export interface CloudSyncInfo {
  /** 同步状态 */
  status: 'pending' | 'synced' | 'failed';
  /** 上次同步时间 */
  syncedAt: string;
  /** 上次验证时间 */
  lastValidatedAt: string;
  /** 设备ID */
  deviceId?: string;
  /** 已使用设备数 */
  devicesUsed?: number;
  /** 最大设备数 */
  devicesMax?: number;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 许可证信息
 * 这是许可证数据的完整结构
 */
export interface LicenseInfo {
  // ===== 核心字段（v1 - 向后兼容） =====
  /** 激活码 */
  activationCode: string;
  /** 是否已激活 */
  isActivated: boolean;
  /** 激活时间 */
  activatedAt: string;
  /** 设备指纹 */
  deviceFingerprint: string;
  /** 过期时间 */
  expiresAt: string;
  /** 产品版本 */
  productVersion: string;
  /** 许可证类型 */
  licenseType: 'lifetime' | 'subscription';
  
  // ===== 扩展字段（v2 - 可选，向后兼容） =====
  /** 指纹版本号 */
  fingerprintVersion?: number;
  /** 绑定的邮箱（云端激活必需） */
  boundEmail?: string;
  /** 云端同步状态 */
  cloudSync?: CloudSyncInfo;
}

/**
 * 激活码数据结构（嵌入在激活码中的数据）
 */
export interface ActivationCodeData {
  /** 用户ID */
  userId: string;
  /** 产品ID */
  productId: string;
  /** 许可证类型 */
  licenseType: 'lifetime' | 'subscription';
  /** 过期时间 */
  expiresAt: string;
  /** 最大设备数 */
  maxDevices: number;
  /** 功能列表 */
  features: string[];
  /** 发行时间 */
  issuedAt: string;
}

/**
 * 默认的许可证信息（未激活状态）
 */
export const DEFAULT_LICENSE_INFO: LicenseInfo = {
  activationCode: '',
  isActivated: false,
  activatedAt: '',
  deviceFingerprint: '',
  expiresAt: '',
  productVersion: '',
  licenseType: 'lifetime'
};
