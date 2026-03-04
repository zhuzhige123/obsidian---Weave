/**
 * 渐进式挖空系统类型定义
 * 
 * 定义{{c1::}}语法的挖空卡片拆分相关类型
 * 与Anki的渐进式挖空（Progressive Cloze）完全兼容
 * 
 * @module types/progressive-cloze-types
 */

/**
 * 挖空数据
 * 
 * 记录单个挖空标记的完整信息
 */
export interface ClozeData {
  /** 
   * 序号（0-based）
   * 对应关系：c1 → ord: 0, c2 → ord: 1
   */
  ord: number;
  
  /** 挖空文本内容 */
  text: string;
  
  /** 
   * 提示信息（可选）
   * 来自{{c1::text::hint}}语法的hint部分
   */
  hint?: string;
  
  /** 在原始内容中的起始位置（字符索引） */
  startPos: number;
  
  /** 在原始内容中的结束位置（字符索引） */
  endPos: number;
  
  /** 
   * 唯一标识符
   * 用于编辑时追踪挖空的稳定性（基于ord和text生成）
   */
  uuid: string;
  
  /** 语法类型 */
  syntax: 'anki' | 'obsidian';
}

/**
 * 挖空分析结果
 * 
 * 分析内容后返回的完整信息
 */
export interface ClozeAnalysisResult {
  /** 是否包含渐进式挖空（{{c1::}}语法） */
  hasProgressiveCloze: boolean;
  
  /** 是否包含高亮（==文本==语法） */
  hasHighlight: boolean;
  
  /** 渐进式挖空数量 */
  clozeCount: number;
  
  /** 高亮数量 */
  highlightCount: number;
  
  /** 
   * 是否应该拆分为子卡片
   * 规则：clozeCount >= 2
   */
  shouldSplit: boolean;
  
  /** 提取的挖空数据列表 */
  clozes: ClozeData[];
}

/**
 * 挖空映射
 * 
 * 存储在父卡片的metadata.clozeMap中
 */
export interface ClozeMap {
  /** 挖空列表 */
  clozes: ClozeData[];
  
  /** 
   * 挖空类型标记
   * - progressive: 渐进式挖空（多个{{c::}}，已拆分）
   * - single: 单个挖空（不拆分）
   */
  clozeType: 'progressive' | 'single';
  
  /** 创建时间（ISO 8601） */
  createdAt: string;
}

/**
 * 子卡片挖空元数据
 * 
 * 存储在子卡片的metadata.childClozeMetadata中
 */
export interface ChildClozeMetadata {
  /** 当前激活的挖空序号（0-based） */
  activeClozeOrd: number;
  
  /** 当前激活的挖空UUID */
  activeClozeUuid: string;
  
  /** 当前激活的挖空文本 */
  activeClozeText: string;
  
  /** 提示信息（如果有） */
  activeClozeHint?: string;
  
  /** 总挖空数量 */
  totalClozes: number;
}

/**
 * 挖空编号验证结果
 */
export interface ClozeValidationResult {
  /** 是否有效（编号连续，无重复） */
  valid: boolean;
  
  /** 缺失的编号列表（1-based，如[2, 4]表示缺少c2和c4） */
  missingNumbers: number[];
  
  /** 重复的编号列表（1-based） */
  duplicateNumbers: number[];
}

/**
 * 拆分能力检查结果
 */
export interface SplitCapabilityResult {
  /** 是否可以拆分 */
  canSplit: boolean;
  
  /** 原因（如果不能拆分） */
  reason?: string;
}






