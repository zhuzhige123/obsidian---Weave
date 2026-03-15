/**
 * 插件路径配置（v3.0.0 数据结构规范化）
 * 
 * 架构设计（v3.0.0 - 无隐藏文件夹、无 _data/ 中间层、三模块严格隔离）：
 * ┌──────────────────────────────────────────────────┐
 * │ weave/                     (Vault数据 - 需同步)  │
 * │  ├── memory/               (记忆牌组模块)        │
 * │  │   ├── decks.json                              │
 * │  │   ├── cards/                                  │
 * │  │   ├── learning/                               │
 * │  │   │   └── sessions/                           │
 * │  │   └── media/                                  │
 * │  ├── incremental-reading/  (增量阅读模块)        │
 * │  │   ├── decks.json                              │
 * │  │   ├── blocks.json                             │
 * │  │   ├── chunks.json                             │
 * │  │   ├── sources.json                            │
 * │  │   ├── study-sessions.json                     │
 * │  │   ├── calendar-progress.json                  │
 * │  │   ├── tag-groups.json                         │
 * │  │   ├── document-group-map.json                 │
 * │  │   ├── pdf-bookmark-tasks.json                 │
 * │  │   ├── materials/                              │
 * │  │   └── IR/               (人类可读 Markdown)   │
 * │  └── question-bank/        (考试题库模块)        │
 * │      ├── banks.json                             │
 * │      ├── question-stats.json                    │
 * │      ├── test-history.json                      │
 * │      ├── in-progress.json                       │
 * │      ├── error-book.json                        │
 * │      ├── session-archives.json                  │
 * │      └── banks/                                 │
 * │          └── {bankId}/questions.json            │
 * └──────────────────────────────────────────────────┘
 * 
 * ┌──────────────────────────────────────────────────┐
 * │ .obsidian/plugins/weave/   (插件目录 - 不同步)   │
 * │  ├── backups/              (备份文件)            │
 * │  ├── cache/                (可重建缓存)          │
 * │  ├── indices/              (索引文件)            │
 * │  ├── migration/            (迁移状态)            │
 * │  └── user-profile.json    (用户配置)            │
 * └──────────────────────────────────────────────────┘
 * 
 * 核心原则：
 * - 不使用隐藏文件夹（不要 .weave/、不要以 . 开头的目录）
 * - 不使用 _data/ 中间层，三模块直接在 weave/ 下平铺
 * - 每个数据文件只允许存在一份（单一事实源 SSOT）
 * - Vault数据（weave/）：用户数据+学习进度，跨设备同步
 * - 插件目录（.obsidian/plugins/weave/）：备份/缓存/日志，不污染文件列表
 */

import { normalizePath } from 'obsidian';

/** Vault 数据根目录 */
export const WEAVE_DATA = 'weave';

/** @deprecated legacy：旧的 Vault 隐藏数据根目录（历史版本机读数据） */
export const LEGACY_DOT_TUANKI = '.tuanki';

/** @deprecated v2.x 旧的机读数据子目录名（已废弃，数据现在直接在 weave/ 下） */
export const LEGACY_MACHINE_DATA_SUBDIR = '_data';

/** 增量阅读处理后 Markdown 输出默认目录（在 incremental-reading/ 模块内） */
export const DEFAULT_IR_IMPORT_FOLDER = `${WEAVE_DATA}/incremental-reading/IR`;

export function normalizeWeaveParentFolder(parentFolder?: string): string {
  const raw = (parentFolder || '').trim();
  if (!raw || raw === '.' || raw === '/') return '';
  const normalized = normalizePath(raw);
  if (!normalized || normalized === '.' || normalized === '/') return '';
  if (normalized === WEAVE_DATA) return '';
  return normalized;
}

export function getReadableWeaveRoot(parentFolder?: string): string {
  const parent = normalizeWeaveParentFolder(parentFolder);
  return parent ? normalizePath(`${parent}/${WEAVE_DATA}`) : WEAVE_DATA;
}

/**
 * @deprecated v2.x 旧的机读数据根（weave/_data/），现在直接使用 getReadableWeaveRoot()
 * 保留仅用于启动迁移检测
 */
export function getMachineWeaveRoot(parentFolder?: string): string {
  return normalizePath(`${getReadableWeaveRoot(parentFolder)}/${LEGACY_MACHINE_DATA_SUBDIR}`);
}

export function getV2Paths(parentFolder?: string) {
  const root = getReadableWeaveRoot(parentFolder);

  return {
    /** 数据根目录 */
    root,
    /** Schema 版本文件（无点前缀，确保同步兼容） */
    schemaVersion: `${root}/schema-version.json`,

    /** 记忆牌组模块 */
    memory: {
      root: `${root}/memory`,
      decks: `${root}/memory/decks.json`,
      deckCards: `${root}/memory/deck-cards`,
      cards: `${root}/memory/cards`,
      learning: {
        root: `${root}/memory/learning`,
        sessions: `${root}/memory/learning/sessions`,
      },
      media: `${root}/memory/media`,
    },

    /** 增量阅读模块 */
    ir: {
      root: `${root}/incremental-reading`,
      decks: `${root}/incremental-reading/decks.json`,
      blocks: `${root}/incremental-reading/blocks.json`,
      history: `${root}/incremental-reading/history.json`,
      chunks: `${root}/incremental-reading/chunks.json`,
      sources: `${root}/incremental-reading/sources.json`,
      studySessions: `${root}/incremental-reading/study-sessions.json`,
      calendarProgress: `${root}/incremental-reading/calendar-progress.json`,
      tagGroups: `${root}/incremental-reading/tag-groups.json`,
      tagGroupProfiles: `${root}/incremental-reading/tag-group-profiles.json`,
      documentGroupMap: `${root}/incremental-reading/document-group-map.json`,
      pdfBookmarkTasks: `${root}/incremental-reading/pdf-bookmark-tasks.json`,
      epubBookmarkTasks: `${root}/incremental-reading/epub-bookmark-tasks.json`,
      materials: {
        root: `${root}/incremental-reading/materials`,
        index: `${root}/incremental-reading/materials/materials.json`,
        sessions: `${root}/incremental-reading/materials/sessions`,
      },
    },

    /** 考试牌组模块 */
    questionBank: {
      root: `${root}/question-bank`,
      banks: `${root}/question-bank/banks.json`,
      banksDir: `${root}/question-bank/banks`,
      questionStats: `${root}/question-bank/question-stats.json`,
      testHistory: `${root}/question-bank/test-history.json`,
      inProgress: `${root}/question-bank/in-progress.json`,
      sessionArchives: `${root}/question-bank/session-archives.json`,
      errorBook: `${root}/question-bank/error-book.json`,
    },
  } as const;
}

export function getV2PathsFromApp(app: any) {
  try {
    const plugin = app?.plugins?.getPlugin?.('weave');
    const parentFolder = (plugin?.settings?.weaveParentFolder ?? plugin?.settings?.tuankiParentFolder) as string | undefined;
    return getV2Paths(parentFolder);
  } catch {
    return getV2Paths(undefined);
  }
}

export function getDefaultIRImportFolder(parentFolder?: string): string {
  return normalizePath(`${getReadableWeaveRoot(parentFolder)}/incremental-reading/IR`);
}

export function resolveIRImportFolder(importFolder?: string, parentFolder?: string): string {
  const raw = (importFolder || '').trim();
  const dynamicDefault = getDefaultIRImportFolder(parentFolder);

  if (!raw) return dynamicDefault;

  const normalized = normalizePath(raw);
  // 旧路径自动回退到新默认值
  if (normalized === '.weave' || normalized.startsWith('.weave/')) return dynamicDefault;
  if (normalized === 'weave' || normalized.startsWith('weave/')) return dynamicDefault;
  const machineRoot = getMachineWeaveRoot(parentFolder);
  if (normalized === machineRoot || normalized.startsWith(`${machineRoot}/`)) return dynamicDefault;
  if (normalized === `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}` || normalized.startsWith(`${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/`)) return dynamicDefault;
  const legacyIR = normalizePath(`${getReadableWeaveRoot(parentFolder)}/IR`);
  if (normalized === legacyIR) return dynamicDefault;
  return normalized;
}

export function getReadableMediaFolder(parentFolder?: string): string {
  return normalizePath(`${getReadableWeaveRoot(parentFolder)}/memory/${DEFAULT_MEDIA_FOLDER_NAME}`);
}

/** 插件目录根路径（动态获取，兼容自定义 configDir） */
export function getPluginDir(app?: { vault: { configDir: string } }): string {
  const configDir = app?.vault?.configDir ?? '.obsidian';
  return `${configDir}/plugins/weave`;
}
/** Schema 版本号 */
export const SCHEMA_VERSION = '3.0.0';

/** 默认媒体文件夹名 */
export const DEFAULT_MEDIA_FOLDER_NAME = 'media';

// ============================================================================
// V2.0 规范化路径（新架构）
// ============================================================================

/** 动态获取插件目录路径（支持自定义 configDir） */
export function getPluginPaths(app?: { vault: { configDir: string } }) {
  const root = getPluginDir(app);
  return {
    root,
    userProfile: `${root}/user-profile.json`,
    indices: {
      root: `${root}/indices`,
      card: `${root}/indices/card-index.json`,
      deck: `${root}/indices/deck-index.json`,
      ir: `${root}/indices/ir-index.json`,
      question: `${root}/indices/question-index.json`,
    },
    cache: {
      root: `${root}/cache`,
      anchors: `${root}/cache/anchors-cache.json`,
    },
    backups: `${root}/backups`,
    migration: {
      root: `${root}/migration`,
      state: `${root}/migration/migration-state.json`,
    },
  } as const;
}

/**
 *  旧版本路径（用于迁移检测）
 */
export const LEGACY_PATHS = {
  /** 记忆牌组旧路径 */
  decks: `${WEAVE_DATA}/decks`,
  cards: `${WEAVE_DATA}/cards`,
  learning: `${WEAVE_DATA}/learning`,
  media: `${WEAVE_DATA}/media`,
  
  /** flashcards 旧路径（早期版本数据存储位置） */
  flashcards: {
    root: `${WEAVE_DATA}/flashcards`,
    decks: `${WEAVE_DATA}/flashcards/decks`,
    decksJson: `${WEAVE_DATA}/flashcards/decks/decks.json`,
    cards: `${WEAVE_DATA}/flashcards/cards`,
    learning: `${WEAVE_DATA}/flashcards/learning`,
  },
  
  /** 配置/索引旧路径 */
  profile: `${WEAVE_DATA}/profile`,
  indices: `${WEAVE_DATA}/indices`,
  temp: `${WEAVE_DATA}/temp`,
  
  /** 增量阅读旧路径 */
  readingMaterials: `${WEAVE_DATA}/reading-materials`,
  ir: `${WEAVE_DATA}/IR`,
  incrementalReading: `${WEAVE_DATA}/incremental-reading`,
  
  /** 题库旧路径 */
  questionBank: `${WEAVE_DATA}/question-bank`,

  /** v2.x _data/ 中间层旧路径（用于迁移检测） */
  dataSubdir: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}`,
  dataMemory: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/memory`,
  dataIR: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/incremental-reading`,
  dataQuestionBank: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/question-bank`,
  dataProfile: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/profile`,
  dataDecks: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/decks`,
} as const;

// ============================================================================
// V1.x 兼容路径（向后兼容，迁移完成后将被移除）
// ============================================================================

/**
 * 📁 V1.x 兼容路径（向后兼容）
 * @deprecated 迁移完成后请使用 getV2Paths(parentFolder)
 */
export const PATHS = {
  /** 数据根目录 */
  root: WEAVE_DATA,
  /** 牌组文件夹 */
  decks: `${WEAVE_DATA}/decks`,
  /** 统一卡片存储文件夹 */
  cards: `${WEAVE_DATA}/cards`,
  /** 索引文件夹 */
  indices: `${WEAVE_DATA}/indices`,
  /** 临时文件夹 */
  temp: `${WEAVE_DATA}/temp`,
  /** 用户配置文件夹 */
  profile: `${WEAVE_DATA}/profile`,
  /** 题库文件夹 */
  questionBank: `${WEAVE_DATA}/question-bank`,
  /** 媒体文件夹（v3.0: memory 模块下） */
  media: `${WEAVE_DATA}/memory/${DEFAULT_MEDIA_FOLDER_NAME}`,
  /** 增量阅读材料文件夹 */
  readingMaterials: `${WEAVE_DATA}/reading-materials`,
  /** 增量阅读数据文件夹 */
  incrementalReading: `${WEAVE_DATA}/incremental-reading`,
  
  /** 增量阅读：人类可读内容文件夹（现在在 incremental-reading/IR 下） */
  irBase: `${WEAVE_DATA}/incremental-reading/IR`,
  /** 增量阅读：源材料文件夹 */
  irRaw: `${WEAVE_DATA}/incremental-reading/IR/raw`,
  /** 增量阅读：索引文件夹 */
  irSources: `${WEAVE_DATA}/incremental-reading/IR/sources`,
  /** 增量阅读：块文件夹 */
  irChunks: `${WEAVE_DATA}/incremental-reading/IR/chunks`,
} as const;

/**
 * 备份文件夹路径（独立于数据目录，防止误删）
 * 
 * 安全设计：
 * - 备份放在插件配置目录（.obsidian/plugins/weave/）
 * - 与数据文件夹（weave/）完全分离
 * - 删除数据文件夹不会影响备份
 * - 只有卸载插件时才会删除备份
 */
export function getBackupFolder(app?: { vault: { configDir: string } }): string {
  const configDir = app?.vault?.configDir ?? '.obsidian';
  return `${configDir}/plugins/weave/backups`;
}

/**
 * 获取插件相对于vault的备份路径
 * @param pluginId 插件ID（默认'weave'）
 * @returns 备份文件夹路径
 */
export function getPluginBackupPath(app?: { vault: { configDir: string } }, pluginId: string = 'weave'): string {
  const configDir = app?.vault?.configDir ?? '.obsidian';
  return `${configDir}/plugins/${pluginId}/backups`;
}

/**
 * 🆕 获取完整的媒体文件夹路径
 * @returns 完整的媒体文件夹路径
 */
export function getMediaFolder(parentFolder?: string): string {
  return getReadableMediaFolder(parentFolder);
}

/**
 * 辅助函数：获取索引文件路径
 * @param indexName 索引名称（如 'card-by-source'）
 * @returns 完整索引文件路径
 */
export function getIndexPath(indexName: string, app?: { vault: { configDir: string } }): string {
  return `${getPluginPaths(app).indices.root}/${indexName}.json`;
}

/**
 * 辅助函数：获取媒体文件路径
 * @param relativePath 媒体相对路径
 * @returns 完整媒体文件路径
 */
export function getMediaPath(relativePath: string, parentFolder?: string): string {
  return `${getReadableMediaFolder(parentFolder)}/${relativePath}`;
}

/**
 * 辅助函数：获取备份路径
 * @param backupId 备份ID（可选）
 * @returns 完整备份路径
 */
export function getBackupPath(backupId?: string, app?: { vault: { configDir: string } }): string {
  const folder = getBackupFolder(app);
  return backupId
    ? `${folder}/${backupId}`
    : folder;
}
