/**
 * YAML 元数据服务模块导出
 * 
 * 统一导出所有 YAML 元数据相关的服务和工具
 * 
 * @module services/yaml-metadata
 * @version 1.0.0
 */

// YAML 工具函数
export {
  parseYAMLFromContent,
  getCardProperty,
  setCardProperty,
  setCardProperties,
  getCardMetadata,
  extractAllTags,
  extractBodyContent,
  hasYAMLFrontmatter,
  createContentWithMetadata,
  validateDeckNames,
  type CardYAMLMetadata,
  type CardYAMLType,
  type CardYAMLDifficulty,
  type YAMLFrontmatter
} from '../../utils/yaml-utils';

// 牌组名称映射服务
export {
  DeckNameMapper,
  getDeckNameMapper,
  initDeckNameMapper,
  destroyDeckNameMapper,
  getDeckIdByName,
  getDeckNameById
} from '../DeckNameMapper';

// 卡片元数据缓存服务
export {
  CardMetadataCache,
  getCardMetadataCache,
  initCardMetadataCache,
  destroyCardMetadataCache,
  getCardParsedMetadata,
  invalidateCardCache,
  clearCardMetadataCache,
  type ParsedCardMetadata,
  type CacheStats
} from '../CardMetadataCache';

// 数据迁移服务
export {
  CardYAMLMigrationService,
  cardNeedsMigration,
  migrateCardQuick,
  type MigrationResult,
  type CardMigrationResult,
  type MigrationConfig
} from '../data-migration/CardYAMLMigrationService';

// UI 适配层服务
export {
  CardMetadataService,
  getCardMetadataService,
  getCardDeckNamesString,
  getCardTagsFromMetadata,
  type DeckStats,
  type TagStats,
  type TypeStats
} from '../CardMetadataService';
