/**
 * Weave 标识符系统
 * 
 * 统一导出所有标识符相关的类型、常量和服务
 * 
 * @module services/identifier
 */

// ============================================================================
// 核心服务
// ============================================================================

export { WeaveIDGenerator } from './WeaveIDGenerator';
export { WeaveIdentifierService, getIdentifierService } from './WeaveIdentifierService';

// ============================================================================
// 便捷函数
// ============================================================================

export {
  generateCardUUID,
  generateBlockID,
  isValidUUID,
  isValidBlockID,
  extractTimestamp,
  getIDGenerator,
} from './WeaveIDGenerator';

// ============================================================================
// 类型定义
// ============================================================================

export type {
  CardIdentifiers,
  IdentifierGenerationContext,
  IdentifierWriteOptions,
  UUIDValidationResult,
  BlockIDValidationResult,
  IdentifierQueryOptions,
  LinkToDocumentOptions,
  ConflictDetectionResult,
  IdentifierStatistics,
  MigrationOptions,
  MigrationResult,
  IdentifierServiceConfig,
  ReadonlyIdentifiers,
  PartialIdentifiers,
  IdentifierKey,
  IdentifierMap,
} from './types';

export {
  CardCreationMode,
  WritePosition,
  UUIDWriteFormat,
  ConflictResolution,
} from './types';

// ============================================================================
// 常量
// ============================================================================

export {
  UUID_PREFIX,
  UUID_ALPHABET,
  UUID_LENGTH,
  UUID_REGEX,
  UUID_BASE,
  BLOCK_ID_ALPHABET,
  BLOCK_ID_LENGTH,
  BLOCK_ID_PREFIX_WE,
  BLOCK_ID_FULL_LENGTH,
  BLOCK_ID_REGEX,
  BLOCK_ID_PREFIX,
  UUID_WRITE_FORMAT,
  BLOCK_ID_WRITE_FORMAT,
  UNIQUENESS_CONFIG,
  TIMESTAMP_CONFIG,
  ValidationLevel,
  DEFAULT_VALIDATION_LEVEL,
  ERROR_MESSAGES,
  ID_SYSTEM_CONFIG,
} from './constants';

export type { IDSystemConfig } from './constants';


