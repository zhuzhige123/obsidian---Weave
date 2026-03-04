/**
 * 内容拆分类型定义
 * 
 * 用于增量阅读材料导入时的内容块拆分功能
 * 
 * @module types/content-split-types
 * @version 1.0.0
 */

// ===== 拆分模式 =====

/**
 * 拆分模式
 */
export type SplitMode = 'rule' | 'manual';

// ===== 规则拆分配置 =====

/**
 * 规则拆分配置
 */
export interface RuleSplitConfig {
  /** 整个文件作为一个块（不拆分） */
  enableWholeFile: boolean;
  
  /** 启用标题拆分 */
  enableHeadingSplit: boolean;
  /** 拆分的标题级别 (1-6) */
  headingLevels: number[];
  
  /** 启用空行拆分 */
  enableBlankLineSplit: boolean;
  /** 连续空行数量 */
  blankLineCount: number;
  
  /** 启用符号拆分 */
  enableSymbolSplit: boolean;
  /** 拆分符号 */
  splitSymbol: string;
  
  /** 自动过滤空内容块 */
  filterEmptyBlocks: boolean;
  /** 保留原文标题作为内容块标题 */
  preserveHeadingAsTitle: boolean;
  /** 最小内容块字符数 */
  minBlockCharCount: number;
}

/**
 * 默认规则拆分配置
 */
export const DEFAULT_RULE_SPLIT_CONFIG: RuleSplitConfig = {
  enableWholeFile: false,
  
  enableHeadingSplit: true,
  headingLevels: [1, 2],
  
  enableBlankLineSplit: false,
  blankLineCount: 2,
  
  enableSymbolSplit: false,
  splitSymbol: '---',
  
  filterEmptyBlocks: true,
  preserveHeadingAsTitle: true,
  minBlockCharCount: 20
};

// ===== 内容块 =====

/**
 * 内容块
 */
export interface ContentBlock {
  /** 内容块ID */
  id: string;
  /** 内容块标题（从标题或首行提取） */
  title: string;
  /** 内容（Markdown格式） */
  content: string;
  /** 字符数 */
  charCount: number;
  /** 在原文中的起始位置 */
  startOffset: number;
  /** 在原文中的结束位置 */
  endOffset: number;
}

// ===== 拆分结果 =====

/**
 * 拆分结果
 */
export interface SplitResult {
  /** 原文件路径 */
  filePath: string;
  /** 拆分模式 */
  mode: SplitMode;
  /** 内容块列表 */
  blocks: ContentBlock[];
  /** 拆分配置（规则模式） */
  config?: RuleSplitConfig;
}

// ===== 导入步骤 =====

/**
 * 导入步骤
 */
export type ImportStep = 'select' | 'split-mode' | 'configure' | 'preview';

/**
 * 步骤信息
 */
export interface StepInfo {
  /** 步骤ID */
  id: ImportStep;
  /** 步骤名称 */
  name: string;
  /** 步骤序号 (1-based) */
  order: number;
}

/**
 * 导入步骤列表
 */
export const IMPORT_STEPS: StepInfo[] = [
  { id: 'select', name: '选择材料', order: 1 },
  { id: 'split-mode', name: '拆分方式', order: 2 },
  { id: 'preview', name: '预览确认', order: 3 }
];

// ===== 拆分标记（旧方案 - v5.0 已废弃）=====

/**
 * 拆分标记前缀
 * @deprecated v5.0 文件化块方案不再在原文件中插入标记
 */
export const SPLIT_MARKER_PREFIX = '<!-- weave-ir: ir-';

/**
 * 拆分标记后缀
 * @deprecated v5.0 文件化块方案不再在原文件中插入标记
 */
export const SPLIT_MARKER_SUFFIX = ' -->';

/**
 * 拆分标记正则表达式
 * @deprecated v5.0 文件化块方案不再在原文件中插入标记
 * 仅用于兼容旧数据检测和迁移
 */
export const SPLIT_MARKER_REGEX = /<!-- weave-ir: ir-([a-z0-9]+) -->/g;

/**
 * 生成拆分标记ID
 * @deprecated v5.0 使用 generateChunkId() 代替
 */
export function generateSplitMarkerId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 13; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * 生成完整的拆分标记
 * @deprecated v5.0 文件化块方案不再需要在原文件中插入标记
 */
export function generateSplitMarker(): string {
  return `${SPLIT_MARKER_PREFIX}${generateSplitMarkerId()}${SPLIT_MARKER_SUFFIX}`;
}
