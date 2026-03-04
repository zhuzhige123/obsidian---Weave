/**
 * 渐进式挖空混合架构 V2
 * 
 * 核心设计理念：
 * 1. 父卡片：内容的原始所有者
 * 2. 子卡片：学习的独立实体（独立UUID、独立FSRS数据、存储完整 content）
 * 3. 内容存储：子卡片创建时从父卡片复制 content，保证独立性
 * 4. 架构简化：移除虚拟化层（ClozeStudyInstance）
 * 
 * V2 vs V1:
 * - V1: 子卡片 content 为空，运行时从父卡片获取（已废弃）
 * - V2: 子卡片存储完整 content，无需运行时查找父卡片
 * 
 * @module types/progressive-cloze-v2
 * @version 2.0.0
 */

import type { Card, FSRSCard, ReviewLog } from '../data/types';
import { CardType } from '../data/types';

// ============================================================================
// 类型标识符
// ============================================================================

/**
 * 渐进式挖空卡片类型
 * 
 * 使用CardType枚举值
 */
export type ProgressiveClozeCardType = 
  | CardType.ProgressiveParent   // 父卡片（内容所有者）
  | CardType.ProgressiveChild;    // 子卡片（学习实体）

// ============================================================================
// 父卡片接口
// ============================================================================

/**
 * 渐进式挖空父卡片
 * 
 * 职责：
 * - 唯一的内容所有者
 * - 管理子卡片列表
 * - 不参与学习（无FSRS数据）
 * 
 * 示例：
 * ```typescript
 * const parent: ProgressiveClozeParentCard = {
 *   uuid: 'parent-001',
 *   type: 'progressive-parent',
 *   content: '{{c1::Python}}是{{c2::解释型}}语言',
 *   progressiveCloze: {
 *     childCardIds: ['child-001', 'child-002'],
 *     totalClozes: 2,
 *     createdAt: '2024-01-01T00:00:00Z'
 *   },
 *   // 父卡片不存储学习数据
 *   fsrs: undefined,
 *   reviewHistory: undefined
 * };
 * ```
 */
export interface ProgressiveClozeParentCard extends Omit<Card, 'type' | 'fsrs' | 'reviewHistory'> {
  /** 卡片类型标识 */
  type: CardType.ProgressiveParent;
  
  /** 
   * 卡片内容（唯一真实来源）
   * 包含完整的挖空标记，如：{{c1::Python}}是{{c2::解释型}}语言
   */
  content: string;
  
  /**
   * 渐进式挖空数据（V2结构）
   */
  progressiveCloze: {
    childCardIds: string[];  // 子卡片UUID列表
    totalClozes: number;     // 总挖空数量
    createdAt: string;       // 创建时间
  };
  
  /** 父卡片不参与学习，无FSRS数据 */
  fsrs?: never;
  
  /** 父卡片不参与学习，无复习历史 */
  reviewHistory?: never;
}

// ============================================================================
// 子卡片接口
// ============================================================================

/**
 * 渐进式挖空子卡片
 * 
 * V2 架构职责：
 * - 学习的独立实体（独立UUID）
 * - 拥有独立的FSRS数据和复习历史
 * - 存储完整的content（创建时从父卡片复制）
 * 
 * 示例：
 * ```typescript
 * const child: ProgressiveClozeChildCard = {
 *   uuid: 'child-001',  // 独立UUID
 *   type: 'progressive-child',
 *   parentCardId: 'parent-001',
 *   clozeOrd: 0,  // c1挖空
 *   content: '{{c1::Python}}是一门编程语言',  // V2: 存储完整content
 *   fsrs: { ... },  // 独立的FSRS数据
 *   reviewHistory: [ ... ]  // 独立的复习历史
 * };
 * ```
 */
export interface ProgressiveClozeChildCard extends Omit<Card, 'type' | 'progressiveCloze'> {
  /** 卡片类型标识 */
  type: CardType.ProgressiveChild;
  
  /** 
   * 内容字段（V2 架构：存储完整 content）
   * 
   * V2: 创建时从父卡片复制，保证子卡片独立性
   * V1 兼容：如果为空，CardAccessor 会从父卡片获取
   */
  content: string;
  
  /** 父卡片UUID */
  parentCardId: string;
  
  /** 
   * 挖空序号（0-based）
   * - 0 表示 c1
   * - 1 表示 c2
   * - 以此类推
   */
  clozeOrd: number;
  
  /** 
   * 独立的FSRS学习数据
   * 每个子卡片有自己的学习进度
   */
  fsrs: FSRSCard;
  
  /** 
   * 独立的复习历史
   * 每个子卡片独立记录复习记录
   */
  reviewHistory: ReviewLog[];
  
  /** 渐进式挖空数据（子卡片不使用） */
  progressiveCloze?: never;
  
  /**
   * 挖空元数据快照（可选）
   * 用于快速显示，避免每次解析content
   */
  clozeSnapshot?: {
    text: string;     // 挖空文本（如 "Python"）
    hint?: string;    // 提示文本
  };
}

// ============================================================================
// 联合类型
// ============================================================================

/**
 * 渐进式挖空卡片联合类型
 */
export type ProgressiveClozeCard = 
  | ProgressiveClozeParentCard 
  | ProgressiveClozeChildCard;

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 检查是否为渐进式挖空父卡片
 */
export function isProgressiveClozeParent(card: Card): card is ProgressiveClozeParentCard {
  return card.type === CardType.ProgressiveParent;
}

/**
 * 检查是否为渐进式挖空子卡片
 */
export function isProgressiveClozeChild(card: Card): card is ProgressiveClozeChildCard {
  return card.type === CardType.ProgressiveChild;
}

/**
 * 检查是否为任何类型的渐进式挖空卡片
 */
export function isProgressiveClozeCard(card: Card): card is ProgressiveClozeCard {
  return isProgressiveClozeParent(card) || isProgressiveClozeChild(card);
}

/**
 * 检查卡片是否有渐进式挖空内容（通过content检测）
 * 用于判断一张普通卡片是否需要转换为渐进式挖空
 */
export function hasProgressiveClozeContent(content: string): boolean {
  const clozePattern = /\{\{c(\d+)::[^}]+\}\}/g;
  const matches = content.match(clozePattern);
  if (!matches) return false;
  
  // 提取所有挖空序号
  const clozeNumbers = new Set<number>();
  for (const match of matches) {
    const num = parseInt(match.match(/\{\{c(\d+)::/)?.[1] || '0', 10);
    clozeNumbers.add(num);
  }
  
  // 至少有2个不同的挖空序号才算渐进式挖空
  return clozeNumbers.size >= 2;
}

// ============================================================================
// 辅助类型
// ============================================================================

/**
 * 挖空数据结构
 */
export interface ClozeData {
  /** 挖空序号（0-based） */
  ord: number;
  
  /** 挖空文本（不含标记） */
  text: string;
  
  /** 提示文本（可选） */
  hint?: string;
  
  /** 在content中的位置信息（可选） */
  position?: {
    start: number;
    end: number;
  };
}

/**
 * 挖空解析结果
 */
export interface ClozeParseResult {
  /** 是否包含有效挖空 */
  hasValidClozes: boolean;
  
  /** 挖空数据列表 */
  clozes: ClozeData[];
  
  /** 总挖空数量 */
  totalClozes: number;
  
  /** 是否满足渐进式挖空条件（≥2个挖空） */
  isProgressive: boolean;
  
  /** 错误信息（如果有） */
  errors?: string[];
}

/**
 * 卡片转换选项
 */
export interface ConversionOptions {
  /** 是否继承父卡片的FSRS数据（仅用于第一个子卡片） */
  inheritFsrs?: boolean;
  
  /** FSRS继承模式 */
  inheritanceMode?: 'none' | 'first-only' | 'proportional';
  
  /** 是否保留父卡片（false则删除父卡片，只保留子卡片） */
  keepParent?: boolean;
  
  /** 创建时间戳（用于子卡片） */
  createdAt?: string;
}

// ============================================================================
// 学习实例类型
// ============================================================================

/**
 * 学习实例联合类型
 * 
 * 在新架构中：
 * - 普通卡片：直接使用Card
 * - 渐进式挖空：使用ProgressiveClozeChildCard（真实卡片，非虚拟）
 * 
 * 不再需要ClozeStudyInstance虚拟包装类！
 */
export type StudyInstance = Card | ProgressiveClozeChildCard;

/**
 * 判断是否为子卡片实例（用于学习流程）
 */
export function isChildCardInstance(instance: StudyInstance): instance is ProgressiveClozeChildCard {
  return isProgressiveClozeChild(instance);
}
