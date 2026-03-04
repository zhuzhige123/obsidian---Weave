/**
 * 卡片质量评估类型定义
 * 
 * @module types/card-quality-types
 * @version 1.0.0
 */

import type { Card } from '../data/types';

/**
 * 质量问题类型
 */
export type QualityIssueType = 
  | 'duplicate_exact'      // 完全重复
  | 'duplicate_similar'    // 内容相似
  | 'empty_content'        // 内容为空
  | 'too_short'            // 内容过短
  | 'too_long'             // 内容过长
  | 'missing_answer'       // 缺少答案
  | 'missing_question'     // 缺少问题
  | 'low_retention'        // 低保留率（FSRS数据）
  | 'high_difficulty'      // 高难度卡片
  | 'orphan_card'          // 孤儿卡片
  | 'invalid_format'       // 格式无效
  | 'source_missing';      // 源文档缺失

/**
 * 问题严重程度
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * 质量问题条目
 */
export interface QualityIssue {
  /** 问题唯一ID */
  id: string;
  
  /** 问题类型 */
  type: QualityIssueType;
  
  /** 严重程度 */
  severity: IssueSeverity;
  
  /** 相关卡片UUID */
  cardUuid: string;
  
  /** 问题描述 */
  description: string;
  
  /** 详细信息（如相似卡片列表、匹配片段等） */
  details?: {
    /** 相似卡片UUID列表 */
    similarCards?: string[];
    /** 相似度分数 */
    similarityScore?: number;
    /** 匹配片段 */
    matchedSnippet?: string;
    /** 建议操作 */
    suggestedAction?: string;
  };
  
  /** 检测时间 */
  detectedAt: string;
  
  /** 是否已处理 */
  resolved: boolean;
  
  /** 处理时间 */
  resolvedAt?: string;
  
  /** 处理方式 */
  resolution?: 'fixed' | 'ignored' | 'merged' | 'deleted';
}

/**
 * 扫描配置
 */
export interface ScanConfig {
  /** 检测重复卡片 */
  detectDuplicates: boolean;
  
  /** 相似度阈值 (0-1) */
  similarityThreshold: number;
  
  /** 检测空内容 */
  detectEmpty: boolean;
  
  /** 检测过短内容（最小字符数） */
  detectShort: boolean;
  minContentLength: number;
  
  /** 检测过长内容（最大字符数） */
  detectLong: boolean;
  maxContentLength: number;
  
  /** 检测孤儿卡片 */
  detectOrphans: boolean;
  
  /** 检测源文档缺失 */
  detectMissingSource: boolean;
  
  /** 检测FSRS学习问题 */
  detectFSRSIssues: boolean;
  
  /** 低保留率阈值 */
  lowRetentionThreshold: number;
  
  /** 高难度阈值 */
  highDifficultyThreshold: number;
}

/**
 * 默认扫描配置
 */
export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  detectDuplicates: true,
  similarityThreshold: 0.85,
  detectEmpty: true,
  detectShort: true,
  minContentLength: 10,
  detectLong: true,
  maxContentLength: 2000,
  detectOrphans: true,
  detectMissingSource: true,
  detectFSRSIssues: true,
  lowRetentionThreshold: 0.7,
  highDifficultyThreshold: 8
};

/**
 * 扫描结果
 */
export interface ScanResult {
  /** 扫描ID */
  scanId: string;
  
  /** 扫描时间 */
  scannedAt: string;
  
  /** 扫描的卡片总数 */
  totalCards: number;
  
  /** 发现的问题列表 */
  issues: QualityIssue[];
  
  /** 按类型统计 */
  issuesByType: Record<QualityIssueType, number>;
  
  /** 按严重程度统计 */
  issuesBySeverity: Record<IssueSeverity, number>;
  
  /** 扫描耗时（毫秒） */
  duration: number;
  
  /** 使用的配置 */
  config: ScanConfig;
}

/**
 * 收件箱状态
 */
export interface InboxState {
  /** 所有问题 */
  issues: QualityIssue[];
  
  /** 未解决问题数 */
  unresolvedCount: number;
  
  /** 最后扫描时间 */
  lastScanAt?: string;
  
  /** 最后扫描结果 */
  lastScanResult?: ScanResult;
}

/**
 * 扫描进度回调
 */
export interface ScanProgressCallback {
  (progress: {
    current: number;
    total: number;
    phase: 'preparing' | 'scanning' | 'analyzing' | 'complete';
    message: string;
  }): void;
}

/**
 * 批量操作结果
 */
export interface BatchActionResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: string[];
}
