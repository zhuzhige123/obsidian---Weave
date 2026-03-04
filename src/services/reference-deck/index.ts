/**
 * 引用式牌组系统服务导出 (v2.0)
 * 
 * 包含：
 * - ReferenceDeckService: 引用式牌组管理
 * - DataConsistencyService: 数据一致性检查
 * - ReferenceMigrationService: 数据迁移
 * - CardFileService: 卡片文件分片管理
 */

export {
  ReferenceDeckService,
  getReferenceDeckService,
  initReferenceDeckService,
  type CreateDeckFromCardsOptions,
  type AddCardsToDeckResult,
  type RemoveCardsFromDeckResult,
  type DissolveDeckResult
} from './ReferenceDeckService';

export {
  DataConsistencyService,
  getDataConsistencyService,
  initDataConsistencyService,
  type RepairResult
} from './DataConsistencyService';

export {
  ReferenceMigrationService,
  getReferenceMigrationService,
  initReferenceMigrationService,
  type MigrationOptions
} from './ReferenceMigrationService';

export {
  CardFileService,
  getCardFileService,
  initCardFileService
} from './CardFileService';
