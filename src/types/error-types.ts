/**
 * 统一错误类型定义
 * 提供类型安全的错误处理机制
 */

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 文件系统错误 (1xxx)
  FILE_NOT_FOUND = 1001,
  FILE_ALREADY_EXISTS = 1002,
  FILE_READ_ERROR = 1003,
  FILE_WRITE_ERROR = 1004,
  FILE_DELETE_ERROR = 1005,
  FOLDER_CREATE_ERROR = 1006,
  FOLDER_NOT_FOUND = 1007,

  // 数据存储错误 (2xxx)
  STORAGE_INIT_ERROR = 2001,
  STORAGE_READ_ERROR = 2002,
  STORAGE_WRITE_ERROR = 2003,
  STORAGE_PARSE_ERROR = 2004,
  STORAGE_BACKUP_ERROR = 2005,

  // 卡片相关错误 (3xxx)
  CARD_NOT_FOUND = 3001,
  CARD_CREATE_ERROR = 3002,
  CARD_UPDATE_ERROR = 3003,
  CARD_DELETE_ERROR = 3004,
  CARD_PARSE_ERROR = 3005,

  // 牌组相关错误 (4xxx)
  DECK_NOT_FOUND = 4001,
  DECK_CREATE_ERROR = 4002,
  DECK_UPDATE_ERROR = 4003,
  DECK_DELETE_ERROR = 4004,

  // AnkiConnect 错误 (5xxx)
  ANKICONNECT_CONNECTION_ERROR = 5001,
  ANKICONNECT_API_ERROR = 5002,
  ANKICONNECT_SYNC_ERROR = 5003,

  // 编辑器相关错误 (6xxx)
  EDITOR_INIT_ERROR = 6001,
  EDITOR_OPEN_ERROR = 6002,
  EDITOR_SAVE_ERROR = 6003,
  EDITOR_CLOSE_ERROR = 6004,

  // 模板相关错误 (7xxx)
  TEMPLATE_NOT_FOUND = 7001,
  TEMPLATE_PARSE_ERROR = 7002,
  TEMPLATE_RENDER_ERROR = 7003,

  // FSRS 算法错误 (8xxx)
  FSRS_CALCULATION_ERROR = 8001,
  FSRS_PARAMETER_ERROR = 8002,

  // 通用错误 (9xxx)
  UNKNOWN_ERROR = 9999,
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 信息级别 - 不影响功能 */
  INFO = 'info',
  /** 警告级别 - 可能影响体验 */
  WARNING = 'warning',
  /** 错误级别 - 影响功能 */
  ERROR = 'error',
  /** 严重级别 - 导致崩溃 */
  CRITICAL = 'critical',
}

/**
 * 基础错误接口
 */
export interface BaseError {
  /** 错误代码 */
  code: ErrorCode;
  /** 错误消息 */
  message: string;
  /** 错误严重级别 */
  severity: ErrorSeverity;
  /** 错误堆栈 */
  stack?: string;
  /** 错误上下文 */
  context?: Record<string, unknown>;
  /** 原始错误 */
  originalError?: Error;
  /** 错误发生时间 */
  timestamp?: string;
}

/**
 * 文件系统错误
 */
export interface FileSystemError extends BaseError {
  code:
    | ErrorCode.FILE_NOT_FOUND
    | ErrorCode.FILE_ALREADY_EXISTS
    | ErrorCode.FILE_READ_ERROR
    | ErrorCode.FILE_WRITE_ERROR
    | ErrorCode.FILE_DELETE_ERROR
    | ErrorCode.FOLDER_CREATE_ERROR
    | ErrorCode.FOLDER_NOT_FOUND;
  /** 文件/文件夹路径 */
  path: string;
  /** 文件系统操作类型 */
  operation: 'read' | 'write' | 'delete' | 'create' | 'exists';
}

/**
 * 存储错误
 */
export interface StorageError extends BaseError {
  code:
    | ErrorCode.STORAGE_INIT_ERROR
    | ErrorCode.STORAGE_READ_ERROR
    | ErrorCode.STORAGE_WRITE_ERROR
    | ErrorCode.STORAGE_PARSE_ERROR
    | ErrorCode.STORAGE_BACKUP_ERROR;
  /** 存储操作类型 */
  operation: 'init' | 'read' | 'write' | 'parse' | 'backup';
  /** 数据类型 */
  dataType?: 'deck' | 'card' | 'settings' | 'profile';
}

/**
 * 卡片错误
 */
export interface CardError extends BaseError {
  code:
    | ErrorCode.CARD_NOT_FOUND
    | ErrorCode.CARD_CREATE_ERROR
    | ErrorCode.CARD_UPDATE_ERROR
    | ErrorCode.CARD_DELETE_ERROR
    | ErrorCode.CARD_PARSE_ERROR;
  /** 卡片ID */
  cardId?: string;
  /** 牌组ID */
  deckId?: string;
}

/**
 * 牌组错误
 */
export interface DeckError extends BaseError {
  code:
    | ErrorCode.DECK_NOT_FOUND
    | ErrorCode.DECK_CREATE_ERROR
    | ErrorCode.DECK_UPDATE_ERROR
    | ErrorCode.DECK_DELETE_ERROR;
  /** 牌组ID */
  deckId?: string;
}

/**
 * AnkiConnect 错误
 */
export interface AnkiConnectError extends BaseError {
  code:
    | ErrorCode.ANKICONNECT_CONNECTION_ERROR
    | ErrorCode.ANKICONNECT_API_ERROR
    | ErrorCode.ANKICONNECT_SYNC_ERROR;
  /** AnkiConnect 动作 */
  action?: string;
  /** 请求参数 */
  params?: unknown;
  /** 响应数据 */
  response?: unknown;
}

/**
 * 编辑器错误
 */
export interface EditorError extends BaseError {
  code:
    | ErrorCode.EDITOR_INIT_ERROR
    | ErrorCode.EDITOR_OPEN_ERROR
    | ErrorCode.EDITOR_SAVE_ERROR
    | ErrorCode.EDITOR_CLOSE_ERROR;
  /** 编辑器类型 */
  editorType?: 'obsidian' | 'codemirror' | 'textarea';
  /** 文件路径 */
  filePath?: string;
}

/**
 * 模板错误
 */
export interface TemplateError extends BaseError {
  code:
    | ErrorCode.TEMPLATE_NOT_FOUND
    | ErrorCode.TEMPLATE_PARSE_ERROR
    | ErrorCode.TEMPLATE_RENDER_ERROR;
  /** 模板ID */
  templateId?: string;
  /** 模板内容 */
  templateContent?: string;
}

/**
 * FSRS 错误
 */
export interface FSRSError extends BaseError {
  code: ErrorCode.FSRS_CALCULATION_ERROR | ErrorCode.FSRS_PARAMETER_ERROR;
  /** FSRS 参数 */
  parameters?: unknown;
  /** 卡片数据 */
  cardData?: unknown;
}

/**
 * 统一错误类型
 */
export type WeaveError =
  | FileSystemError
  | StorageError
  | CardError
  | DeckError
  | AnkiConnectError
  | EditorError
  | TemplateError
  | FSRSError
  | BaseError;

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  /** 是否成功处理 */
  handled: boolean;
  /** 是否应该重试 */
  shouldRetry: boolean;
  /** 重试延迟 (毫秒) */
  retryDelay?: number;
  /** 用户提示消息 */
  userMessage?: string;
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  /** 处理错误 */
  handle(error: WeaveError): ErrorHandlingResult;

  /** 是否可以处理该错误 */
  canHandle(error: WeaveError): boolean;

  /** 错误恢复策略 */
  recover?(error: WeaveError): Promise<void>;
}

/**
 * 错误构造器工厂
 */
export class WeaveErrorFactory {
  /**
   * 创建文件系统错误
   */
  static createFileSystemError(
    code: FileSystemError['code'],
    message: string,
    path: string,
    operation: FileSystemError['operation'],
    originalError?: Error
  ): FileSystemError {
    return {
      code,
      message,
      severity: ErrorSeverity.ERROR,
      path,
      operation,
      originalError,
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
    };
  }

  /**
   * 创建存储错误
   */
  static createStorageError(
    code: StorageError['code'],
    message: string,
    operation: StorageError['operation'],
    dataType?: StorageError['dataType'],
    originalError?: Error
  ): StorageError {
    return {
      code,
      message,
      severity: ErrorSeverity.ERROR,
      operation,
      dataType,
      originalError,
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
    };
  }

  /**
   * 创建卡片错误
   */
  static createCardError(
    code: CardError['code'],
    message: string,
    cardId?: string,
    deckId?: string,
    originalError?: Error
  ): CardError {
    return {
      code,
      message,
      severity: ErrorSeverity.ERROR,
      cardId,
      deckId,
      originalError,
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
    };
  }

  /**
   * 创建 AnkiConnect 错误
   */
  static createAnkiConnectError(
    code: AnkiConnectError['code'],
    message: string,
    action?: string,
    params?: unknown,
    response?: unknown,
    originalError?: Error
  ): AnkiConnectError {
    return {
      code,
      message,
      severity: ErrorSeverity.ERROR,
      action,
      params,
      response,
      originalError,
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
    };
  }
}



