import { normalizePath, type App } from 'obsidian';
import {
  LEGACY_DOT_TUANKI,
  getPluginPaths,
  getReadableWeaveRoot,
  getV2Paths,
  normalizeWeaveParentFolder,
  resolveIRImportFolder,
} from '../../config/paths';
import { DirectoryUtils } from '../../utils/directory-utils';
import { logger } from '../../utils/logger';

type WeaveSettingsLike = {
  weaveParentFolder?: string;
  incrementalReading?: {
    importFolder?: string;
  };
};

type MigrationSourceKind =
  | 'configured-root'
  | 'default-root'
  | 'legacy-plugin-root'
  | 'legacy-hidden-root'
  | 'legacy-machine-root'
  | 'legacy-ir-root';

export interface DataLayoutResolution {
  parentFolder: string;
  root: string;
  v2Paths: ReturnType<typeof getV2Paths>;
  pluginPaths: ReturnType<typeof getPluginPaths>;
  irImportFolder: string;
}

export interface LegacyDataRoot {
  path: string;
  kind: MigrationSourceKind;
  exists: boolean;
  sourceWins: boolean;
}

export interface DataMigrationPlan {
  createdAt: string;
  reason: 'startup-auto' | 'manual-review' | 'change-parent-folder';
  requestedParentFolder?: string;
  layout: DataLayoutResolution;
  legacyRoots: LegacyDataRoot[];
  activeSourceRoots: LegacyDataRoot[];
  targetRoot: string;
  conflictsRoot: string;
  backupPath: string;
  requiresMigration: boolean;
  warnings: string[];
}

export interface DataMigrationVerification {
  ok: boolean;
  missingDirectories: string[];
  remainingLegacyRoots: string[];
  conflictsCount: number;
  canCleanupLegacy: boolean;
}

export interface DataMigrationReport {
  plan: DataMigrationPlan;
  startedAt: string;
  completedAt?: string;
  status: 'planned' | 'completed' | 'failed';
  movedFiles: number;
  conflicts: number;
  rewrittenReferences: number;
  conflictFiles: string[];
  untouchedLegacyRoots: string[];
  warnings: string[];
  errors: string[];
  verification?: DataMigrationVerification;
}

const REPORT_FILE_NAME = 'latest-data-migration-report.json';
const PLAN_FILE_NAME = 'latest-data-migration-plan.json';

const REWRITE_STRING_KEYS = new Set([
  'filePath',
  'rawFilePath',
  'indexFilePath',
  'sourcePath',
  'storagePath',
  'originalPath',
  'pdfPath',
  'epubFilePath',
  'importFolder',
]);

const REWRITE_STRING_ARRAY_KEYS = new Set([
  'sourceFiles',
  'chunkFilePaths',
]);

export function resolveCurrentDataLayout(
  settings: WeaveSettingsLike | undefined,
  app: App,
  requestedParentFolder?: string,
): DataLayoutResolution {
  const parentFolder = normalizeWeaveParentFolder(
    requestedParentFolder ?? settings?.weaveParentFolder,
  );
  const v2Paths = getV2Paths(parentFolder);
  const pluginPaths = getPluginPaths(app);

  return {
    parentFolder,
    root: v2Paths.root,
    v2Paths,
    pluginPaths,
    irImportFolder: resolveIRImportFolder(
      settings?.incrementalReading?.importFolder,
      parentFolder,
    ),
  };
}

export async function discoverLegacyDataRoots(
  settings: WeaveSettingsLike | undefined,
  app: App,
  requestedParentFolder?: string,
): Promise<LegacyDataRoot[]> {
  const adapter = app.vault.adapter;
  const currentParent = normalizeWeaveParentFolder(settings?.weaveParentFolder);
  const targetParent = normalizeWeaveParentFolder(requestedParentFolder);
  const currentRoot = getReadableWeaveRoot(currentParent);
  const targetRoot = getReadableWeaveRoot(
    requestedParentFolder === undefined ? currentParent : targetParent,
  );
  const defaultRoot = getReadableWeaveRoot(undefined);

  const candidates = new Map<string, LegacyDataRoot>();

  const addCandidate = (
    rawPath: string | undefined,
    kind: MigrationSourceKind,
    sourceWins = false,
  ) => {
    if (!rawPath) return;
    const path = normalizePath(rawPath);
    if (!path || path === targetRoot) return;
    if (candidates.has(path)) return;
    candidates.set(path, { path, kind, exists: false, sourceWins });
  };

  addCandidate(currentRoot, 'configured-root', false);
  addCandidate(defaultRoot, 'default-root', false);

  const parentCandidates = new Set(
    [currentParent, targetParent].filter(Boolean),
  );

  addCandidate('tuanki', 'legacy-plugin-root', true);
  addCandidate(LEGACY_DOT_TUANKI, 'legacy-hidden-root', false);

  for (const parent of parentCandidates) {
    addCandidate(`${parent}/tuanki`, 'legacy-plugin-root', true);
    addCandidate(`${parent}/${LEGACY_DOT_TUANKI}`, 'legacy-hidden-root', false);
  }

  for (const root of new Set([currentRoot, defaultRoot, targetRoot])) {
    addCandidate(`${root}/_data`, 'legacy-machine-root', true);
    addCandidate(`${root}/IR`, 'legacy-ir-root', false);
  }

  const discovered = await Promise.all(
    Array.from(candidates.values()).map(async (candidate) => ({
      ...candidate,
      exists: await adapter.exists(candidate.path),
    })),
  );

  return discovered;
}

export async function planDataMigration(context: {
  app: App;
  settings?: WeaveSettingsLike;
  requestedParentFolder?: string;
  reason?: DataMigrationPlan['reason'];
}): Promise<DataMigrationPlan> {
  const layout = resolveCurrentDataLayout(
    context.settings,
    context.app,
    context.requestedParentFolder,
  );
  const legacyRoots = await discoverLegacyDataRoots(
    context.settings,
    context.app,
    context.requestedParentFolder,
  );
  const activeSourceRoots = legacyRoots.filter((root) => root.exists);
  const pluginPaths = layout.pluginPaths;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const warnings: string[] = [];
  if (
    context.requestedParentFolder !== undefined &&
    normalizeWeaveParentFolder(context.requestedParentFolder)
      !== normalizeWeaveParentFolder(context.settings?.weaveParentFolder)
  ) {
    warnings.push(
      `数据根目录将移动到: ${layout.root}`,
    );
  }

  const requiresMigration = activeSourceRoots.length > 0;

  return {
    createdAt: new Date().toISOString(),
    reason: context.reason ?? 'manual-review',
    requestedParentFolder:
      context.requestedParentFolder === undefined
        ? undefined
        : normalizeWeaveParentFolder(context.requestedParentFolder),
    layout,
    legacyRoots,
    activeSourceRoots,
    targetRoot: layout.root,
    conflictsRoot: `${layout.root}/_migration_conflicts`,
    backupPath: `${pluginPaths.backups}/data-migration-${timestamp}`,
    requiresMigration,
    warnings,
  };
}

export async function executeDataMigration(plan: DataMigrationPlan): Promise<DataMigrationReport> {
  throw new Error(
    `executeDataMigration(plan) requires app context; use UnifiedDataMigrationService.executeDataMigration(plan) for ${plan.targetRoot}`,
  );
}

export async function verifyDataMigration(
  result: DataMigrationReport,
  app: App,
): Promise<DataMigrationVerification> {
  const adapter = app.vault.adapter as any;
  const expectedDirs = [
    result.plan.layout.v2Paths.memory.root,
    result.plan.layout.v2Paths.memory.cards,
    result.plan.layout.v2Paths.memory.learning.root,
    result.plan.layout.v2Paths.ir.root,
    result.plan.layout.v2Paths.questionBank.root,
  ];

  const missingDirectories: string[] = [];
  for (const dir of expectedDirs) {
    if (!(await adapter.exists(dir))) {
      missingDirectories.push(dir);
    }
  }

  const remainingLegacyRoots: string[] = [];
  for (const root of result.plan.activeSourceRoots) {
    if (!(await adapter.exists(root.path))) continue;
    if (await hasAnyFiles(adapter, root.path)) {
      remainingLegacyRoots.push(root.path);
    }
  }

  let conflictsCount = 0;
  if (await adapter.exists(result.plan.conflictsRoot)) {
    try {
      const listing = await adapter.list(result.plan.conflictsRoot);
      conflictsCount = (listing?.files || []).length;
    } catch {
      conflictsCount = result.conflictFiles.length;
    }
  }

  return {
    ok: missingDirectories.length === 0,
    missingDirectories,
    remainingLegacyRoots,
    conflictsCount,
    canCleanupLegacy: remainingLegacyRoots.length === 0,
  };
}

export class UnifiedDataMigrationService {
  constructor(
    private app: App,
    private settings?: WeaveSettingsLike,
  ) {}

  resolveCurrentDataLayout(requestedParentFolder?: string): DataLayoutResolution {
    return resolveCurrentDataLayout(this.settings, this.app, requestedParentFolder);
  }

  async discoverLegacyDataRoots(requestedParentFolder?: string): Promise<LegacyDataRoot[]> {
    return discoverLegacyDataRoots(this.settings, this.app, requestedParentFolder);
  }

  async planDataMigration(options?: {
    requestedParentFolder?: string;
    reason?: DataMigrationPlan['reason'];
  }): Promise<DataMigrationPlan> {
    const plan = await planDataMigration({
      app: this.app,
      settings: this.settings,
      requestedParentFolder: options?.requestedParentFolder,
      reason: options?.reason,
    });
    await this.persistPlan(plan);
    return plan;
  }

  async executeDataMigration(plan: DataMigrationPlan): Promise<DataMigrationReport> {
    const report = await internalExecuteDataMigration(plan, this.app, this.settings);
    if (
      plan.requestedParentFolder !== undefined &&
      this.settings &&
      typeof this.settings === 'object'
    ) {
      this.settings.weaveParentFolder = plan.requestedParentFolder;

      if (!this.settings.incrementalReading) {
        this.settings.incrementalReading = {};
      }
      this.settings.incrementalReading.importFolder = rewritePathValue(
        resolveIRImportFolder(
          this.settings.incrementalReading.importFolder,
          normalizeWeaveParentFolder(this.settings.weaveParentFolder),
        ),
        Array.from(
          new Set(
            plan.activeSourceRoots
              .map((root) => root.path)
              .concat(getReadableWeaveRoot(undefined)),
          ),
        ),
        plan.targetRoot,
      ) ?? resolveIRImportFolder(
        this.settings.incrementalReading.importFolder,
        plan.requestedParentFolder,
      );
    }

    return report;
  }

  async verifyDataMigration(report: DataMigrationReport): Promise<DataMigrationVerification> {
    return verifyDataMigration(report, this.app);
  }

  async getLatestReport(): Promise<DataMigrationReport | null> {
    return this.readJsonFile<DataMigrationReport>(REPORT_FILE_NAME);
  }

  async getLatestPlan(): Promise<DataMigrationPlan | null> {
    return this.readJsonFile<DataMigrationPlan>(PLAN_FILE_NAME);
  }

  private async persistPlan(plan: DataMigrationPlan): Promise<void> {
    const pluginPaths = getPluginPaths(this.app);
    await DirectoryUtils.ensureDirRecursive(this.app.vault.adapter, pluginPaths.migration.root);
    await this.app.vault.adapter.write(
      `${pluginPaths.migration.root}/${PLAN_FILE_NAME}`,
      JSON.stringify(plan, null, 2),
    );
  }

  private async readJsonFile<T>(fileName: string): Promise<T | null> {
    try {
      const pluginPaths = getPluginPaths(this.app);
      const filePath = `${pluginPaths.migration.root}/${fileName}`;
      if (!(await this.app.vault.adapter.exists(filePath))) return null;
      const raw = await this.app.vault.adapter.read(filePath);
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn(`[UnifiedDataMigration] 读取 ${fileName} 失败`, error);
      return null;
    }
  }
}

async function internalExecuteDataMigration(
  plan: DataMigrationPlan,
  app?: App,
  settings?: WeaveSettingsLike,
): Promise<DataMigrationReport> {
  if (!app) {
    throw new Error('UnifiedDataMigrationService requires app instance');
  }

  const adapter: any = app.vault.adapter as any;
  const report: DataMigrationReport = {
    plan,
    startedAt: new Date().toISOString(),
    status: 'planned',
    movedFiles: 0,
    conflicts: 0,
    rewrittenReferences: 0,
    conflictFiles: [],
    untouchedLegacyRoots: [],
    warnings: [...plan.warnings],
    errors: [],
  };

  try {
    await DirectoryUtils.ensureDirRecursive(adapter, plan.layout.pluginPaths.migration.root);
    await writeReport(app, report);
    await createMigrationBackup(app, plan);

    if (plan.layout.parentFolder) {
      await DirectoryUtils.ensureDirRecursive(adapter, plan.layout.parentFolder);
    }
    await DirectoryUtils.ensureDirRecursive(adapter, plan.targetRoot);

    for (const root of plan.activeSourceRoots) {
      if (!(await adapter.exists(root.path))) continue;
      if (root.kind === 'legacy-machine-root') {
        const stats = await mergeFolderTo(
          adapter,
          root.path,
          plan.targetRoot,
          plan.conflictsRoot,
          root.sourceWins,
          report,
        );
        report.movedFiles += stats.moved;
        report.conflicts += stats.conflicts;
      } else if (root.kind === 'legacy-ir-root') {
        const targetIR = `${plan.targetRoot}/incremental-reading/IR`;
        await DirectoryUtils.ensureDirRecursive(adapter, targetIR);
        const stats = await mergeFolderTo(
          adapter,
          root.path,
          targetIR,
          plan.conflictsRoot,
          root.sourceWins,
          report,
        );
        report.movedFiles += stats.moved;
        report.conflicts += stats.conflicts;
      } else {
        const stats = await mergeFolderTo(
          adapter,
          root.path,
          plan.targetRoot,
          plan.conflictsRoot,
          root.sourceWins,
          report,
        );
        report.movedFiles += stats.moved;
        report.conflicts += stats.conflicts;
      }
      await tryRemoveEmptyFolderDeep(adapter, root.path);
    }

    const renamedMarkers = await renameLegacyMarkers(adapter, plan.targetRoot);
    report.movedFiles += renamedMarkers;

    const rewriteRoots = Array.from(
      new Set(
        plan.activeSourceRoots.map((root) => root.path).concat([
          getReadableWeaveRoot(undefined),
          getReadableWeaveRoot(normalizeWeaveParentFolder(settings?.weaveParentFolder)),
        ]),
      ),
    ).filter((path) => path && path !== plan.targetRoot);

    report.rewrittenReferences = await rewritePersistedReferences(
      app,
      plan,
      rewriteRoots,
      settings,
    );

    report.untouchedLegacyRoots = await findRemainingRoots(adapter, plan.activeSourceRoots);
    report.verification = await verifyDataMigration(report, app);
    report.status = report.errors.length === 0 ? 'completed' : 'failed';
    report.completedAt = new Date().toISOString();
    await writeReport(app, report);
    return report;
  } catch (error) {
    report.status = 'failed';
    report.completedAt = new Date().toISOString();
    report.errors.push(error instanceof Error ? error.message : String(error));
    report.verification = await verifyDataMigration(report, app);
    await writeReport(app, report);
    throw error;
  }
}

async function createMigrationBackup(app: App, plan: DataMigrationPlan): Promise<void> {
  const adapter = app.vault.adapter;
  const backupFiles = [
    plan.layout.v2Paths.schemaVersion,
    plan.layout.pluginPaths.userProfile,
    plan.layout.v2Paths.memory.decks,
    plan.layout.v2Paths.ir.chunks,
    plan.layout.v2Paths.ir.sources,
    plan.layout.v2Paths.ir.materials.index,
    plan.layout.v2Paths.questionBank.banks,
  ];

  await DirectoryUtils.ensureDirRecursive(adapter, plan.backupPath);

  for (const filePath of backupFiles) {
    if (!(await adapter.exists(filePath))) continue;
    const target = `${plan.backupPath}/${filePath.replace(/[\\/:]/g, '__')}`;
    try {
      const content = await adapter.read(filePath);
      await adapter.write(target, content);
    } catch (error) {
      logger.warn(`[UnifiedDataMigration] 备份失败: ${filePath}`, error);
    }
  }
}

async function writeReport(app: App, report: DataMigrationReport): Promise<void> {
  const pluginPaths = getPluginPaths(app);
  await DirectoryUtils.ensureDirRecursive(app.vault.adapter, pluginPaths.migration.root);
  await app.vault.adapter.write(
    `${pluginPaths.migration.root}/${REPORT_FILE_NAME}`,
    JSON.stringify(report, null, 2),
  );
}

async function mergeFolderTo(
  adapter: any,
  fromRoot: string,
  toRoot: string,
  conflictsRoot: string,
  sourceWins: boolean,
  report: DataMigrationReport,
): Promise<{ moved: number; conflicts: number }> {
  let moved = 0;
  let conflicts = 0;

  const walk = async (dir: string): Promise<void> => {
    const listing = await adapter.list(dir);

    for (const folder of listing?.folders || []) {
      await walk(folder);
    }

    for (const file of listing?.files || []) {
      const relative = file.startsWith(fromRoot)
        ? file.slice(fromRoot.length).replace(/^\//, '')
        : file;
      const targetPath = normalizePath(`${toRoot}/${relative}`);
      await ensureDirForFile(adapter, targetPath);
      const result = await moveFileWithConflict(
        adapter,
        file,
        targetPath,
        conflictsRoot,
        sourceWins,
        report,
      );
      if (result === 'moved') moved++;
      if (result === 'conflict') conflicts++;
    }
  };

  await walk(fromRoot);
  return { moved, conflicts };
}

async function moveFileWithConflict(
  adapter: any,
  fromPath: string,
  toPath: string,
  conflictsRoot: string,
  sourceWins: boolean,
  report: DataMigrationReport,
): Promise<'moved' | 'conflict'> {
  if (!(await adapter.exists(toPath))) {
    await safeCopyFile(adapter, fromPath, toPath);
    try {
      await adapter.remove(fromPath);
    } catch {
    }
    return 'moved';
  }

  await DirectoryUtils.ensureDirRecursive(adapter, conflictsRoot);
  const safeName = (sourceWins ? toPath : fromPath)
    .replace(/[\\/:]/g, '_')
    .replace(/^\.+/, '');
  const archivedPath = `${conflictsRoot}/${safeName}-${Date.now()}`;

  if (sourceWins) {
    await safeCopyFile(adapter, toPath, archivedPath);
    await safeCopyFile(adapter, fromPath, toPath);
    try {
      await adapter.remove(fromPath);
    } catch {
    }
    report.conflictFiles.push(archivedPath);
    return 'moved';
  }

  await safeCopyFile(adapter, fromPath, archivedPath);
  try {
    await adapter.remove(fromPath);
  } catch {
  }
  report.conflictFiles.push(archivedPath);
  return 'conflict';
}

async function safeCopyFile(adapter: any, fromPath: string, toPath: string): Promise<void> {
  if (typeof adapter.readBinary === 'function' && typeof adapter.writeBinary === 'function') {
    const binary = await adapter.readBinary(fromPath);
    await ensureDirForFile(adapter, toPath);
    await adapter.writeBinary(toPath, binary);
    return;
  }

  const text = await adapter.read(fromPath);
  await ensureDirForFile(adapter, toPath);
  await adapter.write(toPath, text);
}

async function ensureDirForFile(adapter: any, filePath: string): Promise<void> {
  const slash = filePath.lastIndexOf('/');
  if (slash <= 0) return;
  await DirectoryUtils.ensureDirRecursive(adapter, filePath.slice(0, slash));
}

async function tryRemoveEmptyFolderDeep(adapter: any, dir: string): Promise<void> {
  let listing: any;
  try {
    listing = await adapter.list(dir);
  } catch {
    return;
  }

  for (const folder of listing?.folders || []) {
    await tryRemoveEmptyFolderDeep(adapter, folder);
  }

  try {
    const after = await adapter.list(dir);
    if ((after?.files || []).length === 0 && (after?.folders || []).length === 0) {
      if (typeof adapter.rmdir === 'function') await adapter.rmdir(dir, false);
      else if (typeof adapter.remove === 'function') await adapter.remove(dir);
    }
  } catch {
  }
}

async function renameLegacyMarkers(adapter: any, targetRoot: string): Promise<number> {
  const renames: Array<[string, string]> = [
    [`${targetRoot}/.schema-version`, `${targetRoot}/schema-version.json`],
    [`${targetRoot}/schema-version`, `${targetRoot}/schema-version.json`],
    [`${targetRoot}/.migration-completed`, `${targetRoot}/migration-completed`],
  ];

  let moved = 0;
  for (const [oldPath, newPath] of renames) {
    try {
      if (await adapter.exists(oldPath) && !(await adapter.exists(newPath))) {
        await safeCopyFile(adapter, oldPath, newPath);
        await adapter.remove(oldPath);
        moved++;
      }
    } catch (error) {
      logger.warn(`[UnifiedDataMigration] 标记文件重命名失败: ${oldPath}`, error);
    }
  }
  return moved;
}

async function rewritePersistedReferences(
  app: App,
  plan: DataMigrationPlan,
  rewriteRoots: string[],
  settings?: WeaveSettingsLike,
): Promise<number> {
  const adapter = app.vault.adapter as any;
  const jsonFiles = new Set<string>([
    plan.layout.v2Paths.ir.chunks,
    plan.layout.v2Paths.ir.sources,
    plan.layout.v2Paths.ir.materials.index,
    plan.layout.v2Paths.ir.pdfBookmarkTasks,
    plan.layout.v2Paths.ir.epubBookmarkTasks,
    plan.layout.pluginPaths.userProfile,
  ]);

  let rewritten = 0;

  for (const filePath of jsonFiles) {
    if (!(await adapter.exists(filePath))) continue;

    try {
      const raw = await adapter.read(filePath);
      const data = JSON.parse(raw);
      const result = rewriteJsonValue(data, rewriteRoots, plan.targetRoot);
      if (result.changed) {
        await adapter.write(filePath, JSON.stringify(result.value, null, 2));
        rewritten += result.count;
      }
    } catch (error) {
      logger.warn(`[UnifiedDataMigration] 路径引用重写失败: ${filePath}`, error);
    }
  }

  if (settings?.incrementalReading?.importFolder) {
    const rewrittenImportFolder = rewritePathValue(
      settings.incrementalReading.importFolder,
      rewriteRoots,
      plan.targetRoot,
    );
    if (rewrittenImportFolder && rewrittenImportFolder !== settings.incrementalReading.importFolder) {
      settings.incrementalReading.importFolder = rewrittenImportFolder;
      rewritten++;
    }
  }

  return rewritten;
}

function rewriteJsonValue(
  value: unknown,
  rewriteRoots: string[],
  targetRoot: string,
  parentKey?: string,
): { value: unknown; changed: boolean; count: number } {
  if (typeof value === 'string') {
    if (parentKey && REWRITE_STRING_KEYS.has(parentKey)) {
      const rewritten = rewritePathValue(value, rewriteRoots, targetRoot);
      if (rewritten && rewritten !== value) {
        return { value: rewritten, changed: true, count: 1 };
      }
    }
    return { value, changed: false, count: 0 };
  }

  if (Array.isArray(value)) {
    let changed = false;
    let count = 0;
    const next = value.map((item) => {
      if (typeof item === 'string' && parentKey && REWRITE_STRING_ARRAY_KEYS.has(parentKey)) {
        const rewritten = rewritePathValue(item, rewriteRoots, targetRoot);
        if (rewritten && rewritten !== item) {
          changed = true;
          count++;
          return rewritten;
        }
      }
      const nested = rewriteJsonValue(item, rewriteRoots, targetRoot, parentKey);
      changed = changed || nested.changed;
      count += nested.count;
      return nested.value;
    });
    return { value: next, changed, count };
  }

  if (value && typeof value === 'object') {
    let changed = false;
    let count = 0;
    const next: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const nested = rewriteJsonValue(nestedValue, rewriteRoots, targetRoot, key);
      next[key] = nested.value;
      changed = changed || nested.changed;
      count += nested.count;
    }
    return { value: next, changed, count };
  }

  return { value, changed: false, count: 0 };
}

function rewritePathValue(
  value: string,
  rewriteRoots: string[],
  targetRoot: string,
): string | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = normalizePath(value);
  for (const root of rewriteRoots) {
    const normalizedRoot = normalizePath(root);
    if (!normalizedRoot || normalizedRoot === targetRoot) continue;
    if (normalized === normalizedRoot) return targetRoot;
    if (normalized.startsWith(`${normalizedRoot}/`)) {
      return normalizePath(`${targetRoot}/${normalized.slice(normalizedRoot.length + 1)}`);
    }
  }
  return normalized;
}

async function findRemainingRoots(
  adapter: any,
  roots: LegacyDataRoot[],
): Promise<string[]> {
  const remaining: string[] = [];
  for (const root of roots) {
    if (!(await adapter.exists(root.path))) continue;
    if (await hasAnyFiles(adapter, root.path)) {
      remaining.push(root.path);
    }
  }
  return remaining;
}

async function hasAnyFiles(adapter: any, dir: string, depth = 5): Promise<boolean> {
  if (depth <= 0) return false;

  let listing: any;
  try {
    listing = await adapter.list(dir);
  } catch {
    return false;
  }

  const files: string[] = listing?.files || [];
  const folders: string[] = listing?.folders || [];
  if (files.length > 0) return true;

  for (const folder of folders) {
    if (await hasAnyFiles(adapter, folder, depth - 1)) return true;
  }

  return false;
}
