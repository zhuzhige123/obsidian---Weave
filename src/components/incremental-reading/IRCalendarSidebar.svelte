<script lang="ts">
  /**
   * 增量阅读日历侧边栏组件
   * 上方为月历热力图，下方为选中日期的阅读材料列表
   */
  import { onDestroy, onMount } from 'svelte';
  import { Menu, Notice, Platform } from 'obsidian';
  import { mount, unmount } from 'svelte';
  import type AnkiObsidianPlugin from '../../main';
  import type { IRDeck, IRBlock } from '../../types/ir-types';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { IRChunkScheduleAdapter } from '../../services/incremental-reading/IRChunkScheduleAdapter';
  import { IRPdfBookmarkTaskService, isPdfBookmarkTaskId } from '../../services/incremental-reading/IRPdfBookmarkTaskService';
  import { IRTagGroupService } from '../../services/incremental-reading/IRTagGroupService';
  import { calculatePriorityEWMA, calculateNextInterval, calculateNextRepDate, calculatePsi } from '../../services/incremental-reading/IRCoreAlgorithmsV4';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import FloatingMenu from '../ui/FloatingMenu.svelte';
  import IRPrioritySlider from './IRPrioritySlider.svelte';
  import MaterialImportModal from './MaterialImportModal.svelte';
  import IRBlockInfoModal from './IRBlockInfoModal.svelte';
  import IRReviewReminderModal from './IRReviewReminderModal.svelte';
  import type { BatchImportResult } from '../../services/incremental-reading/ReadingMaterialManager';
  import { logger } from '../../utils/logger';
  import { showDeleteConfirm, showObsidianConfirm, showObsidianInput } from '../../utils/obsidian-confirm';

  interface Props {
    plugin: AnkiObsidianPlugin;
  }

  function closeBlockInfoModal() {
    try {
      if (blockInfoModalInstance) {
        unmount(blockInfoModalInstance);
      }
    } catch {
    }
    blockInfoModalInstance = null;

    try {
      blockInfoModalContainer?.remove();
    } catch {
    }
    blockInfoModalContainer = null;
  }

  function closeReminderModal() {
    try {
      if (reminderModalInstance) {
        unmount(reminderModalInstance);
      }
    } catch {
    }
    reminderModalInstance = null;

    try {
      reminderModalContainer?.remove();
    } catch {
    }
    reminderModalContainer = null;
  }

  let { plugin }: Props = $props();

  // 日历状态
  let currentDate = $state(new Date());
  let selectedDate = $state(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 数据状态
  let irDecks = $state<IRDeck[]>([]);
  let allBlocks = $state<IRBlock[]>([]);
  let isLoading = $state(true);

  let readingMaterials = $state<import('../../types/incremental-reading-types').ReadingMaterial[]>([]);

  // 按日期分组的材料数据
  let materialsByDate = $state<Map<string, ScheduleItem[]>>(new Map());
  let pinnedByDate = $state<Map<string, ScheduleItem[]>>(new Map());
  let processedChunkIds = $state(new Set<string>());
  let calendarProgressByDate = $state<Record<string, string[]>>({});
  let irStorage = $state<IRStorageService | null>(null);
  let chunkScheduleAdapter = $state<IRChunkScheduleAdapter | null>(null);
  let pdfBookmarkTaskService = $state<IRPdfBookmarkTaskService | null>(null);

  let schedulingMenuAnchor = $state<HTMLElement | null>(null);
  let schedulingMenuOpen = $state(false);
  let schedulingMenuTarget = $state<ScheduleItem | null>(null);
  let schedulingMenuDateKey = $state<string>('');

  let priorityMenuAnchor = $state<HTMLElement | null>(null);
  let priorityMenuOpen = $state(false);
  let priorityMenuTarget = $state<ScheduleItem | null>(null);
  let prioritySliderExpanded = $state(true);

  let blockInfoModalContainer: HTMLElement | null = null;
  let blockInfoModalInstance: any | null = null;

  let reminderModalContainer: HTMLElement | null = null;
  let reminderModalInstance: any | null = null;

  let suppressClickOnce = $state(false);

  let longPressTimerId = $state<number | null>(null);
  let longPressStartX = $state(0);
  let longPressStartY = $state(0);
  let longPressTriggered = $state(false);

  // 导入模态窗状态
  let showImportModal = $state(false);

  // 连续阅读模式
  let continuousReadingEnabled = $state(false);
  // 显示调度时间
  let showScheduleTime = $state(false);
  let expandedMaterialIds = $state(new Set<string>());
  let siblingCache = $state(new Map<string, ScheduleItem[]>());
  let loadingSiblings = $state(new Set<string>());

  const isTablet = (Platform as any).isTablet ?? false;
  const hideCalendarTitle = Platform.isMobile && !isTablet;

  // 格式化日期为 key
  function formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async function ensureDoneItemsVisibleForDate(dateKey: string): Promise<void> {
    try {
      const doneIds = calendarProgressByDate[dateKey] || [];
      if (!doneIds.length) return;

      const storage = await getStorage();
      const allChunks = await storage.getAllChunkData();

      const doneItems: ScheduleItem[] = [];
      const unresolvedPdfIds: string[] = [];

      for (const id of doneIds) {
        if (isPdfBookmarkTaskId(id)) {
          unresolvedPdfIds.push(id);
          continue;
        }

        const chunk = allChunks[id] as any;
        if (!chunk) continue;

        const filePath = (chunk as any).filePath as string || '';
        const base = filePath?.split('/').pop() || id;
        const title = base.replace(/\.md$/i, '').replace(/^\d+_/, '');

        const nextRepDate = (chunk as any).nextRepDate as number || 0;
        const intervalDays = (chunk as any).intervalDays as number || 1;
        const priority = (chunk as any).priorityUi as number ?? (chunk as any).priorityEff as number ?? 5;
        const scheduleStatus = (chunk as any).scheduleStatus as string || 'new';

        doneItems.push({
          id,
          title,
          sourceFile: filePath,
          priority,
          intervalDays,
          scheduleStatus,
          nextRepDate,
          nextReviewDate: nextRepDate > 0 ? new Date(nextRepDate) : null,
        });
      }

      if (unresolvedPdfIds.length > 0) {
        try {
          const pdfService = await getPdfBookmarkTaskService();
          for (const pid of unresolvedPdfIds) {
            const task = await pdfService.getTask(pid);
            if (!task) continue;
            const fullTitle = String(task.title || '').trim() || 'PDF';
            doneItems.push({
              id: pid,
              title: fullTitle,
              displayName: extractPdfHeading(fullTitle),
              sourceFile: task.pdfPath,
              resumeLink: task.link,
              priority: Number(task.priorityUi ?? task.priorityEff ?? 5),
              intervalDays: Number(task.intervalDays ?? 1),
              scheduleStatus: String(task.status || 'new'),
              nextRepDate: Number(task.nextRepDate || 0),
              nextReviewDate: task.nextRepDate ? new Date(task.nextRepDate) : null,
            });
          }
        } catch (e) {
          logger.warn('[IRCalendarSidebar] PDF 书签任务恢复失败:', e);
        }
      }

      if (!doneItems.length) return;

      const currentPinned = pinnedByDate.get(dateKey) || [];
      const merged = new Map<string, ScheduleItem>();
      for (const item of currentPinned) merged.set(item.id, item);
      for (const item of doneItems) merged.set(item.id, item);

      const nextPinnedByDate = new Map(pinnedByDate);
      nextPinnedByDate.set(dateKey, [...merged.values()]);
      pinnedByDate = nextPinnedByDate;
    } catch (error) {
      logger.error('[IRCalendarSidebar] 恢复完成记录到列表失败:', error);
    }
  }

  // 获取月份的所有日期
  function getMonthDays(year: number, month: number): Array<{ date: Date; otherMonth: boolean }> {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Array<{ date: Date; otherMonth: boolean }> = [];

    // 上月补位
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), otherMonth: true });
    }

    // 本月
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), otherMonth: false });
    }

    // 下月补位 (补齐6行)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), otherMonth: true });
    }

    return days;
  }

  // 计算热力等级
  function getHeatLevel(date: Date): number {
    const key = formatDateKey(date);
    const materials = materialsByDate.get(key) || [];
    const count = materials.length;
    
    if (count === 0) return 0;
    if (count >= 8) return 5;
    if (count >= 6) return 4;
    if (count >= 4) return 3;
    if (count >= 2) return 2;
    return 1;
  }

  // 获取选中日期的材料
  function getSelectedMaterials(): ScheduleItem[] {
    const key = formatDateKey(selectedDate);
    const materials = materialsByDate.get(key) || [];
    const pinned = pinnedByDate.get(key) || [];
    const merged = new Map<string, ScheduleItem>();
    for (const m of materials) merged.set(m.id, m);
    for (const p of pinned) {
      if (!merged.has(p.id)) merged.set(p.id, p);
    }
    return [...merged.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // 切换月份
  function prevMonth() {
    closeSchedulingMenu();
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  }

  function nextMonth() {
    closeSchedulingMenu();
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  function goToToday() {
    closeSchedulingMenu();
    currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
    selectedDate = new Date(today);
    const key = formatDateKey(selectedDate);
    const done = calendarProgressByDate[key] || [];
    processedChunkIds = new Set(done);
    void ensureDoneItemsVisibleForDate(key);
  }

  // 选择日期
  function selectDay(date: Date) {
    closeSchedulingMenu();
    selectedDate = new Date(date);
    const key = formatDateKey(selectedDate);
    const done = calendarProgressByDate[key] || [];
    processedChunkIds = new Set(done);
    void ensureDoneItemsVisibleForDate(key);
  }

  // 判断日期是否相同
  function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  // 打开导入模态窗
  function openImportModal(): void {
    showImportModal = true;
  }
  
  // 处理导入完成
  function handleImportComplete(result: BatchImportResult): void {
    showImportModal = false;
    
    if (result.errors.length > 0) {
      new Notice(`导入完成：${result.success} 个成功，${result.skipped} 个跳过，${result.errors.length} 个失败`);
    } else if (result.skipped > 0) {
      new Notice(`导入完成：${result.success} 个成功，${result.skipped} 个已存在`);
    } else {
      new Notice(`成功导入 ${result.success} 个阅读材料`);
    }
    
    // 刷新数据并通知其他组件
    loadData();
    window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
  }

  async function getStorage(): Promise<IRStorageService> {
    if (!irStorage) {
      irStorage = new IRStorageService(plugin.app);
    }
    await irStorage.initialize();
    return irStorage;
  }

  async function loadCalendarProgress(): Promise<void> {
    try {
      const storage = await getStorage();
      calendarProgressByDate = await storage.getCalendarProgress();

      const key = formatDateKey(selectedDate);
      const done = calendarProgressByDate[key] || [];
      processedChunkIds = new Set(done);
      await ensureDoneItemsVisibleForDate(key);
    } catch (error) {
      logger.error('[IRCalendarSidebar] 加载 calendar-progress 失败:', error);
    }
  }

  async function getChunkScheduleAdapter(): Promise<IRChunkScheduleAdapter> {
    const storage = await getStorage();
    if (!chunkScheduleAdapter) {
      const { resolveIRImportFolder } = await import('../../config/paths');
      const chunkRoot = resolveIRImportFolder(
        plugin.settings?.incrementalReading?.importFolder,
        plugin.settings?.weaveParentFolder
      );
      chunkScheduleAdapter = new IRChunkScheduleAdapter(plugin.app, storage, chunkRoot);
    }
    return chunkScheduleAdapter;
  }

  async function getPdfBookmarkTaskService(): Promise<IRPdfBookmarkTaskService> {
    if (!pdfBookmarkTaskService) {
      pdfBookmarkTaskService = new IRPdfBookmarkTaskService(plugin.app);
    }
    await pdfBookmarkTaskService.initialize();
    return pdfBookmarkTaskService;
  }

  function getNextUnprocessedMaterial(currentId: string): ScheduleItem | null {
    const list = selectedMaterials;
    if (!list || list.length === 0) return null;

    const startIndex = Math.max(0, list.findIndex(m => m.id === currentId));

    for (let i = startIndex + 1; i < list.length; i++) {
      const m = list[i];
      if (!processedChunkIds.has(m.id)) return m;
    }

    for (let i = 0; i < startIndex; i++) {
      const m = list[i];
      if (!processedChunkIds.has(m.id)) return m;
    }

    return null;
  }

  // 打开阅读材料
  async function openMaterial(material: ScheduleItem) {
    try {
      // 获取文件路径
      const filePath = material.sourceFile;
      
      if (!filePath) {
        logger.warn('[IRCalendarSidebar] 无法获取文件路径:', material);
        // 回退到原有的事件触发方式
        const event = new CustomEvent('Weave:ir-open-block', { 
          detail: { blockId: material.id } 
        });
        window.dispatchEvent(event);
        return;
      }

      // 使用 Obsidian API 打开文件
      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
        const rm = readingMaterials.find(m => m.filePath === filePath);
        let rawLink = (material.resumeLink && material.resumeLink.trim().length > 0)
          ? material.resumeLink
          : ((rm?.resumeLink && rm.resumeLink.trim().length > 0) ? rm.resumeLink : filePath);
        // 剥离 wikilink 语法：[[path#subpath|alias]] → path#subpath
        const linkToOpen = rawLink.trim().replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
        await plugin.app.workspace.openLinkText(linkToOpen, contextPath, false);
        logger.debug('[IRCalendarSidebar] 已打开文件:', linkToOpen);
      } else {
        logger.warn('[IRCalendarSidebar] 文件不存在:', filePath);

        // 自愈：文件可能被重命名/移动，尝试通过 chunk_id 在 vault 中重新定位
        try {
          const candidates = plugin.app.vault.getMarkdownFiles();
          const matched = candidates.find(f => {
            const cache = plugin.app.metadataCache.getFileCache(f);
            const fm = cache?.frontmatter as any;
            if (!fm) return false;
            const chunkId = String(fm.chunk_id || '').trim();
            if (!chunkId) return false;
            return chunkId === material.id;
          });

          if (matched) {
            const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
            await plugin.app.workspace.openLinkText(matched.path, contextPath, false);

            const storage = await getStorage();
            const chunk = await storage.getChunkData(material.id);
            if (chunk && (chunk as any).filePath !== matched.path) {
              (chunk as any).filePath = matched.path;
              (chunk as any).updatedAt = Date.now();
              await storage.saveChunkData(chunk);
              window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
            }

            return;
          }
        } catch (e) {
          logger.warn('[IRCalendarSidebar] 自愈查找文件失败:', e);
        }

        // 尝试触发原有的事件作为回退
        const event = new CustomEvent('Weave:ir-open-block', { 
          detail: { blockId: material.id } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      logger.error('[IRCalendarSidebar] 打开材料失败:', error);
      // 错误时回退到原有的事件触发方式
      const event = new CustomEvent('Weave:ir-open-block', { 
        detail: { blockId: material.id } 
      });
      window.dispatchEvent(event);
    }
  }

  // PDF书签标题提取：只显示 " / " 后的标题部分（如 "研究9 不只限于分泌唾液的狗"）
  function extractPdfHeading(fullTitle: string): string {
    const sep = ' / ';
    const idx = fullTitle.lastIndexOf(sep);
    if (idx >= 0) {
      return fullTitle.substring(idx + sep.length);
    }
    return fullTitle;
  }

  // 材料数据结构
  interface ScheduleItem {
    id: string;
    title: string;
    displayName?: string;
    sourceFile: string;
    priority: number;
    intervalDays: number;
    scheduleStatus: string;
    nextRepDate: number;
    nextReviewDate: Date | null;
    resumeLink?: string;
  }

  // 读取 IR 高级调度设置
  function getIRScheduleParams(): { mBase: number; maxInterval: number; halfLifeDays: number; enableTagGroup: boolean } {
    const ir = plugin.settings?.incrementalReading;
    return {
      mBase: ir?.defaultIntervalFactor ?? 1.5,
      maxInterval: ir?.maxInterval ?? 365,
      halfLifeDays: ir?.priorityHalfLifeDays ?? 7,
      enableTagGroup: ir?.enableTagGroupPrior !== false
    };
  }

  // 获取材料的 TagGroup mGroup 系数
  async function getMGroupForMaterial(materialId: string): Promise<number> {
    const params = getIRScheduleParams();
    if (!params.enableTagGroup) return 1.0;

    try {
      const pluginAny = plugin as any;
      const service: IRTagGroupService = pluginAny.irTagGroupService ?? new IRTagGroupService(plugin.app);
      if (!pluginAny.irTagGroupService) {
        await service.initialize();
        pluginAny.irTagGroupService = service;
      }

      let tagGroup = 'default';
      if (isPdfBookmarkTaskId(materialId)) {
        const pdfService = await getPdfBookmarkTaskService();
        const task = await pdfService.getTask(materialId);
        tagGroup = task?.meta?.tagGroup || 'default';
      } else {
        const storage = await getStorage();
        const chunk = await storage.getChunkData(materialId);
        tagGroup = (chunk as any)?.meta?.tagGroup || 'default';
      }

      const profile = await service.getProfile(tagGroup);
      return profile?.intervalFactorBase || 1.0;
    } catch {
      return 1.0;
    }
  }

  const schedulingConfig = [
    { action: 'intensive' as const, label: '攻坚', color: 'var(--weave-error, #ef4444)', intervalMultiplier: 0.5 },
    { action: 'normal' as const, label: '正常', color: 'var(--weave-success, #10b981)', intervalMultiplier: 1.0 },
    { action: 'slow' as const, label: '放缓', color: 'var(--weave-warning, #f59e0b)', intervalMultiplier: 1.8 },
    { action: 'postpone' as const, label: '稍后', color: 'var(--text-muted, #6b7280)', intervalMultiplier: 0, isPostpone: true },
  ];

  type SchedulingAction = typeof schedulingConfig[number]['action'];

  const schedulingDefaultIntervals: Record<'intensive' | 'normal' | 'slow', number> = {
    intensive: 1,
    normal: 3,
    slow: 10
  };

  function getSchedulingPrediction(action: SchedulingAction): string {
    const target = schedulingMenuTarget;
    if (!target) return '';
    const cfg = schedulingConfig.find(c => c.action === action);
    if (!cfg) return '';
    if ((cfg as any).isPostpone) return '+2天';

    const params = getIRScheduleParams();
    const currentInterval = target.intervalDays || 1;

    // 使用 V4 核心算法预测：I_next = I_curr × mBase × intervalMultiplier × Ψ(pEff)
    const pEff = target.priority ?? 5;
    const psi = calculatePsi(pEff);
    let predictedDays: number;

    if (currentInterval <= 1) {
      const d = schedulingDefaultIntervals[action as 'intensive' | 'normal' | 'slow'] ?? 1;
      predictedDays = d;
    } else {
      predictedDays = Math.round(currentInterval * params.mBase * (cfg as any).intervalMultiplier * psi);
    }

    predictedDays = Math.max(1, Math.min(predictedDays, params.maxInterval));

    if (predictedDays === 1) return '明天';
    if (predictedDays <= 7) return `${predictedDays}天后`;
    if (predictedDays <= 30) return `${Math.round(predictedDays / 7)}周后`;
    return `${Math.round(predictedDays / 30)}月后`;
  }

  function closeSchedulingMenu() {
    schedulingMenuOpen = false;
    schedulingMenuTarget = null;
    schedulingMenuAnchor = null;
    schedulingMenuDateKey = '';
  }

  function openSchedulingMenu(event: MouseEvent, material: ScheduleItem) {
    event.preventDefault();
    event.stopPropagation();

    const alreadyOpenForSame = schedulingMenuOpen && schedulingMenuTarget?.id === material.id;
    if (alreadyOpenForSame) {
      closeSchedulingMenu();
      return;
    }

    schedulingMenuTarget = material;
    schedulingMenuAnchor = event.currentTarget as HTMLElement;
    schedulingMenuDateKey = formatDateKey(selectedDate);
    schedulingMenuOpen = true;
  }

  function openSchedulingMenuForAnchor(anchor: HTMLElement, material: ScheduleItem) {
    const alreadyOpenForSame = schedulingMenuOpen && schedulingMenuTarget?.id === material.id;
    if (alreadyOpenForSame) {
      closeSchedulingMenu();
      return;
    }

    schedulingMenuTarget = material;
    schedulingMenuAnchor = anchor;
    schedulingMenuDateKey = formatDateKey(selectedDate);
    schedulingMenuOpen = true;
  }

  function closePriorityMenu() {
    priorityMenuOpen = false;
    priorityMenuTarget = null;
    priorityMenuAnchor = null;
  }

  function openPriorityMenuForAnchor(anchor: HTMLElement, material: ScheduleItem) {
    const alreadyOpenForSame = priorityMenuOpen && priorityMenuTarget?.id === material.id;
    if (alreadyOpenForSame) {
      closePriorityMenu();
      return;
    }

    priorityMenuTarget = material;
    priorityMenuAnchor = anchor;
    prioritySliderExpanded = true;
    priorityMenuOpen = true;
  }

  async function handlePriorityUiChange(nextUi: number) {
    const target = priorityMenuTarget;
    if (!target) return;

    try {
      const ui = Math.max(0, Math.min(10, nextUi));
      const { halfLifeDays } = getIRScheduleParams();

      if (isPdfBookmarkTaskId(target.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        const task = await pdfService.getTask(target.id);
        const oldEff = (task as any)?.priorityEff ?? (task as any)?.priorityUi ?? target.priority ?? 5;
        const lastInteraction = (task as any)?.stats?.lastInteraction || (task as any)?.updatedAt || 0;
        const eff = calculatePriorityEWMA(ui, oldEff, halfLifeDays, lastInteraction > 0 ? lastInteraction : undefined);
        await pdfService.updateTask(target.id, { priorityUi: ui, priorityEff: eff });
      } else {
        const storage = await getStorage();
        const chunk = await storage.getChunkData(target.id);
        const oldEff = (chunk as any)?.priorityEff ?? (chunk as any)?.priorityUi ?? target.priority ?? 5;
        const lastInteraction = (chunk as any)?.stats?.lastInteraction || (chunk as any)?.updatedAt || 0;
        const eff = calculatePriorityEWMA(ui, oldEff, halfLifeDays, lastInteraction > 0 ? lastInteraction : undefined);

        const adapter = await getChunkScheduleAdapter();
        await adapter.updateChunkSchedule(target.id, { priorityUi: ui, priorityEff: eff });
      }

      closePriorityMenu();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    } catch (error) {
      logger.error('[IRCalendarSidebar] 设置优先级失败:', error);
      new Notice('设置优先级失败');
    }
  }

  async function suspendMaterial(material: ScheduleItem) {
    try {
      if (isPdfBookmarkTaskId(material.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        await pdfService.updateTask(material.id, { status: 'suspended' });
      } else {
        const adapter = await getChunkScheduleAdapter();
        await adapter.updateChunkSchedule(material.id, { scheduleStatus: 'suspended' as any });
      }
      new Notice('已搁置');
      closePriorityMenu();
      closeSchedulingMenu();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    } catch (error) {
      logger.error('[IRCalendarSidebar] 搁置失败:', error);
      new Notice('搁置失败');
    }
  }

  async function archiveMaterial(material: ScheduleItem) {
    try {
      if (isPdfBookmarkTaskId(material.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        await pdfService.updateTask(material.id, { status: 'done' });
      } else {
        const adapter = await getChunkScheduleAdapter();
        await adapter.updateChunkSchedule(material.id, { scheduleStatus: 'done' as any });
      }
      new Notice('已归档');
      closePriorityMenu();
      closeSchedulingMenu();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    } catch (error) {
      logger.error('[IRCalendarSidebar] 归档失败:', error);
      new Notice('归档失败');
    }
  }

  async function removeMaterial(material: ScheduleItem) {
    try {
      if (isPdfBookmarkTaskId(material.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        await pdfService.updateTask(material.id, { status: 'removed' as any });
      } else {
        const adapter = await getChunkScheduleAdapter();
        await adapter.updateChunkSchedule(material.id, { scheduleStatus: 'removed' as any });
      }
      new Notice('已移除');
      closePriorityMenu();
      closeSchedulingMenu();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    } catch (error) {
      logger.error('[IRCalendarSidebar] 移除失败:', error);
      new Notice('移除失败');
    }
  }

  async function deleteMaterial(material: ScheduleItem) {
    try {
      if (isPdfBookmarkTaskId(material.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        await pdfService.deleteTask(material.id);
      } else {
        const storage = await getStorage();
        await storage.deleteChunkData(material.id);
      }
      new Notice('已删除');
      closePriorityMenu();
      closeSchedulingMenu();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    } catch (error) {
      logger.error('[IRCalendarSidebar] 删除失败:', error);
      new Notice('删除失败');
    }
  }

  async function loadTagGroupSubmenu(sub: Menu, material: ScheduleItem) {
    try {
      const pluginAny = plugin as any;
      const service: IRTagGroupService = pluginAny.irTagGroupService ?? new IRTagGroupService(plugin.app);
      if (!pluginAny.irTagGroupService) {
        await service.initialize();
        pluginAny.irTagGroupService = service;
      }

      const allGroups = await service.getAllGroups();
      const isPdf = isPdfBookmarkTaskId(material.id);
      const storage = await getStorage();

      // 获取当前标签组
      let currentGroupId = 'default';
      if (isPdf) {
        const pdfService = await getPdfBookmarkTaskService();
        const task = await pdfService.getTask(material.id);
        if (task?.meta?.tagGroup) {
          currentGroupId = task.meta.tagGroup;
        }
      } else {
        const chunk = await storage.getChunkData(material.id);
        if (chunk?.meta?.tagGroup) {
          currentGroupId = chunk.meta.tagGroup;
        }
      }

      for (const group of allGroups) {
        sub.addItem((subItem: any) => {
          const title = group.id === currentGroupId ? `${group.name} (当前)` : group.name;
          subItem
            .setTitle(title)
            .setIcon(group.id === currentGroupId ? 'check' : 'tag')
            .setDisabled(group.id === currentGroupId)
            .onClick(async () => {
              try {
                if (isPdf) {
                  // PDF 书签：需要输入「我确认」
                  const pdfService = await getPdfBookmarkTaskService();
                  const task = await pdfService.getTask(material.id);
                  const pdfPath = task?.pdfPath || '';
                  const pdfName = pdfPath.split('/').pop() || 'PDF';

                  const inputVal = await showObsidianInput(
                    plugin.app,
                    `切换「${pdfName}」的所有书签到标签组「${group.name}」，将影响该 PDF 下全部书签的调度参数。\n\n请输入「我确认」以继续：`,
                    '',
                    { title: '切换 PDF 标签组', placeholder: '我确认', confirmText: '切换' }
                  );
                  if (inputVal?.trim() !== '我确认') {
                    if (inputVal !== null) new Notice('输入不匹配，已取消');
                    return;
                  }

                  // 批量更新同一 PDF 下所有书签
                  const allTasks = await pdfService.getAllTasks();
                  let updatedCount = 0;
                  for (const t of allTasks) {
                    if (t.pdfPath === pdfPath) {
                      await pdfService.updateTask(t.id, {
                        meta: { ...t.meta, tagGroup: group.id }
                      } as any);
                      updatedCount++;
                    }
                  }

                  // 同步 documentMapCache
                  if (pdfPath) {
                    await service.updateDocumentGroupManual(pdfPath, group.id);
                  }

                  new Notice(`已将「${pdfName}」的 ${updatedCount} 个书签切换到标签组「${group.name}」`);
                } else {
                  // MD chunk：普通确认弹窗
                  const confirmed = await showObsidianConfirm(
                    plugin.app,
                    `确定要将该材料及其同源内容切换到标签组「${group.name}」吗？\n此操作会影响后续的调度参数。`,
                    { title: '切换标签组', confirmText: '切换', confirmClass: 'mod-warning' }
                  );
                  if (!confirmed) return;

                  const chunkData = await storage.getChunkData(material.id);
                  if (chunkData) {
                    chunkData.meta = chunkData.meta || {} as any;
                    (chunkData.meta as any).tagGroup = group.id;
                    (chunkData as any).updatedAt = Date.now();
                    await storage.saveChunkData(chunkData);

                    // 批量更新同源 chunk + source
                    const sourceId = (chunkData as any).sourceId;
                    let sourcePath = '';
                    if (sourceId) {
                      const allChunks = await storage.getAllChunkData();
                      for (const c of Object.values(allChunks)) {
                        if ((c as any)?.sourceId === sourceId && (c as any)?.chunkId !== material.id) {
                          (c as any).meta = (c as any).meta || {};
                          (c as any).meta.tagGroup = group.id;
                          (c as any).updatedAt = Date.now();
                          await storage.saveChunkData(c);
                        }
                      }
                      const source = await storage.getSource(sourceId);
                      if (source) {
                        sourcePath = (source as any).originalPath || '';
                        (source as any).tagGroup = group.id;
                        (source as any).updatedAt = Date.now();
                        await storage.saveSource(source);
                      }
                    }

                    // 同步 documentMapCache
                    if (sourcePath) {
                      await service.updateDocumentGroupManual(sourcePath, group.id);
                    }
                  }

                  new Notice(`已切换到标签组「${group.name}」`);
                }

                window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
              } catch (error) {
                logger.error('[IRCalendarSidebar] 设置标签组失败:', error);
                new Notice('设置标签组失败');
              }
            });
        });
      }
    } catch (error) {
      logger.error('[IRCalendarSidebar] 加载标签组菜单失败:', error);
    }
  }

  async function openBlockInfo(material: ScheduleItem, position?: { x: number; y: number }) {
    try {
      let blockInfoTarget: any;

      if (isPdfBookmarkTaskId(material.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        const task = await pdfService.getTask(material.id);
        if (!task) {
          new Notice('PDF 书签任务不存在');
          return;
        }
        blockInfoTarget = {
          id: task.id,
          filePath: task.pdfPath ?? material.sourceFile ?? '',
          state: task.status ?? 'new',
          priority: Math.round(task.priorityUi ?? task.priorityEff ?? material.priority ?? 5),
          priorityUi: task.priorityUi ?? material.priority ?? 5,
          priorityEff: task.priorityEff ?? task.priorityUi ?? 5,
          interval: task.intervalDays ?? 1,
          intervalFactor: 1.5,
          reviewCount: task.stats?.impressions ?? 0,
          totalReadingTime: task.stats?.totalReadingTimeSec ?? 0,
          createdAt: new Date(task.createdAt ?? Date.now()).toISOString(),
          updatedAt: new Date(task.updatedAt ?? Date.now()).toISOString(),
          nextReview: task.nextRepDate ? new Date(task.nextRepDate).toISOString() : null,
          nextRepDate: task.nextRepDate,
          headingText: material.title || task.title || '',
          tags: task.tags ?? []
        };
      } else {
        const storage = await getStorage();
        const chunk = await storage.getChunkData(material.id);

        if (!chunk) {
          new Notice('内容块不存在');
          return;
        }

        const scheduleStatus = (chunk as any).scheduleStatus as string;
        const intervalDays = (chunk as any).intervalDays as number;
        const nextRepDate = (chunk as any).nextRepDate as number;
        const priorityUi = (chunk as any).priorityUi as number | undefined;
        const priorityEff = (chunk as any).priorityEff as number;

        blockInfoTarget = {
          id: (chunk as any).chunkId ?? material.id,
          filePath: (chunk as any).filePath ?? material.sourceFile ?? '',
          state: scheduleStatus ?? 'new',
          priority: Math.round(priorityUi ?? priorityEff ?? material.priority ?? 5),
          priorityUi: priorityUi ?? material.priority ?? 5,
          priorityEff: priorityEff,
          interval: intervalDays ?? 1,
          intervalFactor: 1.5,
          reviewCount: (chunk as any).stats?.impressions ?? 0,
          totalReadingTime: (chunk as any).stats?.totalReadingTimeSec ?? 0,
          createdAt: new Date((chunk as any).createdAt ?? Date.now()).toISOString(),
          updatedAt: new Date((chunk as any).updatedAt ?? Date.now()).toISOString(),
          nextReview: nextRepDate ? new Date(nextRepDate).toISOString() : null,
          nextRepDate,
          headingText: material.title || (chunk as any).headingText || '',
          tags: (chunk as any).meta?.tags ?? (chunk as any).tags ?? []
        };
      }

      closeBlockInfoModal();
      blockInfoModalContainer = document.createElement('div');
      blockInfoModalContainer.className = 'weave-ir-block-info-modal-container';
      document.body.append(blockInfoModalContainer);

      blockInfoModalInstance = mount(IRBlockInfoModal, {
        target: blockInfoModalContainer,
        props: {
          block: blockInfoTarget as any,
          position,
          onClose: () => closeBlockInfoModal()
        }
      });
    } catch (error) {
      logger.error('[IRCalendarSidebar] 打开内容块信息失败:', error);
      new Notice('打开失败');
    }
  }

  async function setReminderForMaterial(material: ScheduleItem, date: string, time: string) {
    if (!date || !time) {
      new Notice('请选择有效的日期和时间');
      return;
    }

    try {
      const reviewDateTime = new Date(`${date}T${time}`);
      if (reviewDateTime <= new Date()) {
        new Notice('复习时间必须是未来时间');
        return;
      }

      if (isPdfBookmarkTaskId(material.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        await pdfService.updateTask(material.id, {
          nextRepDate: reviewDateTime.getTime(),
          status: 'queued'
        });
      } else {
        const adapter = await getChunkScheduleAdapter();
        await adapter.updateChunkSchedule(material.id, {
          nextRepDate: reviewDateTime.getTime(),
          scheduleStatus: 'queued' as any
        });
      }

      new Notice(`复习时间已设置为：${reviewDateTime.toLocaleString()}`);
      closeReminderModal();
      // ✅ 直接刷新本组件数据，确保月历和材料列表立即更新
      await loadData();
      await loadCalendarProgress();
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
    } catch (error) {
      logger.error('[IRCalendarSidebar] 设置复习时间失败:', error);
      new Notice('设置复习时间失败');
    }
  }

  function openReminderModal(material: ScheduleItem, position?: { x: number; y: number }) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const initialDate = tomorrow.toISOString().split('T')[0];
    const initialTime = new Date().toTimeString().slice(0, 5);

    closeReminderModal();
    reminderModalContainer = document.createElement('div');
    reminderModalContainer.className = 'weave-ir-review-reminder-modal-container';
    document.body.append(reminderModalContainer);

    reminderModalInstance = mount(IRReviewReminderModal, {
      target: reminderModalContainer,
      props: {
        initialDate,
        initialTime,
        position,
        onCancel: () => closeReminderModal(),
        onConfirm: (date: string, time: string) => {
          void setReminderForMaterial(material, date, time);
        }
      }
    });
  }

  onDestroy(() => {
    closeBlockInfoModal();
    closeReminderModal();
  });

  /**
   * 获取同源文档的其它书签/内容块（不在当前选中日期的调度列表中）
   */
  async function getSiblingMaterials(material: ScheduleItem): Promise<ScheduleItem[]> {
    const sourceFile = material.sourceFile;
    if (!sourceFile) return [];

    const todayKey = formatDateKey(selectedDate);
    const todayIds = new Set((materialsByDate.get(todayKey) || []).map(m => m.id));

    const siblings: ScheduleItem[] = [];

    // 收集所有日期中同源的 items
    for (const [_dateKey, items] of materialsByDate) {
      for (const item of items) {
        if (item.id === material.id) continue;
        if (item.sourceFile !== sourceFile) continue;
        if (todayIds.has(item.id)) continue;
        siblings.push(item);
      }
    }

    // 也查找未出现在 materialsByDate 中的同源 PDF 书签任务（done/suspended 状态已过滤掉的除外）
    if (isPdfBookmarkTaskId(material.id)) {
      try {
        const pdfService = await getPdfBookmarkTaskService();
        const allTasks = await pdfService.getAllTasks();
        const existingIds = new Set(siblings.map(s => s.id));
        for (const task of allTasks) {
          if (task.id === material.id) continue;
          if (task.pdfPath !== sourceFile) continue;
          if (existingIds.has(task.id)) continue;
          if (todayIds.has(task.id)) continue;
          const status = String(task.status || 'new');
          if (status === 'done' || status === 'removed') continue;
          siblings.push({
            id: task.id,
            title: String(task.title || '').trim() || 'PDF',
            displayName: extractPdfHeading(String(task.title || '')),
            sourceFile: task.pdfPath,
            resumeLink: task.link,
            priority: Number(task.priorityUi ?? task.priorityEff ?? 5),
            intervalDays: Number(task.intervalDays ?? 1),
            scheduleStatus: status,
            nextRepDate: Number(task.nextRepDate || 0),
            nextReviewDate: task.nextRepDate ? new Date(task.nextRepDate) : null,
          });
        }
      } catch (e) {
        logger.warn('[IRCalendarSidebar] 查找同源 PDF 书签失败:', e);
      }
    }

    // 按 nextRepDate 升序排列（最近到期的在前）
    siblings.sort((a, b) => (a.nextRepDate || 0) - (b.nextRepDate || 0));
    return siblings;
  }

  /**
   * 展开/收起材料的同源目录
   */
  async function toggleMaterialExpand(material: ScheduleItem) {
    const id = material.id;
    if (expandedMaterialIds.has(id)) {
      const next = new Set(expandedMaterialIds);
      next.delete(id);
      expandedMaterialIds = next;
      return;
    }

    // 已缓存则直接展开
    if (siblingCache.has(id)) {
      expandedMaterialIds = new Set([...expandedMaterialIds, id]);
      return;
    }

    // 加载同源兄弟节点
    loadingSiblings = new Set([...loadingSiblings, id]);
    try {
      const siblings = await getSiblingMaterials(material);
      const next = new Map(siblingCache);
      next.set(id, siblings);
      siblingCache = next;
      expandedMaterialIds = new Set([...expandedMaterialIds, id]);
    } catch (e) {
      logger.error('[IRCalendarSidebar] 加载同源目录失败:', e);
    } finally {
      const ls = new Set(loadingSiblings);
      ls.delete(id);
      loadingSiblings = ls;
    }
  }

  function showMaterialMenuAt(
    menuPosition: { x: number; y: number },
    popoverPosition: { x: number; y: number },
    anchor: HTMLElement,
    material: ScheduleItem
  ) {
    try {
      const menu = new Menu();

      menu.addItem((item) => {
        item
          .setTitle('查看')
          .setIcon('eye')
          .onClick(() => {
            void openBlockInfo(material, popoverPosition);
          });
      });

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle('设置优先级')
          .setIcon('star')
          .onClick(() => {
            openPriorityMenuForAnchor(anchor, material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('设置下次复习时间')
          .setIcon('calendar-clock')
          .onClick(() => {
            openReminderModal(material, popoverPosition);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('设置标签组')
          .setIcon('tags');
        const sub = (item as any).setSubmenu();
        void loadTagGroupSubmenu(sub, material);
      });

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle('搁置')
          .setIcon('pause-circle')
          .onClick(() => {
            void suspendMaterial(material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('归档')
          .setIcon('archive')
          .onClick(() => {
            void archiveMaterial(material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('移除')
          .setIcon('x-circle')
          .onClick(() => {
            void removeMaterial(material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('删除')
          .setIcon('trash-2')
          .onClick(async () => {
            const confirmed = await showDeleteConfirm(
              plugin.app,
              material.title || material.id,
              `确定要删除「${material.title || material.id}」的所有阅读记录吗？\n此操作不可撤销，但不会删除源文档。`
            );
            if (confirmed) {
              void deleteMaterial(material);
            }
          });
      });

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle('更多操作')
          .setIcon('settings');
        const sub = (item as any).setSubmenu();

        sub.addItem((subItem: any) => {
          subItem
            .setTitle('连续阅读')
            .setChecked(continuousReadingEnabled)
            .onClick(() => {
              continuousReadingEnabled = !continuousReadingEnabled;
              if (!continuousReadingEnabled) {
                expandedMaterialIds = new Set();
              }
            });
        });

        sub.addItem((subItem: any) => {
          subItem
            .setTitle('显示调度时间')
            .setChecked(showScheduleTime)
            .onClick(() => {
              showScheduleTime = !showScheduleTime;
            });
        });
      });

      menu.showAtPosition(menuPosition);
    } catch (error) {
      logger.error('[IRCalendarSidebar] 打开菜单失败:', error);
    }
  }


  function formatSiblingDueDate(nextRepDate: number): string {
    const due = new Date(nextRepDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}天前`;
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    return `${diffDays}天后`;
  }

  function handleMaterialContextMenu(event: MouseEvent, anchor: HTMLElement, material: ScheduleItem) {
    event.preventDefault();
    event.stopPropagation();
    showMaterialMenuAt(
      { x: event.pageX, y: event.pageY },
      { x: event.clientX, y: event.clientY },
      anchor,
      material
    );
  }

  function handleMaterialClick(material: ScheduleItem) {
    if (suppressClickOnce) {
      suppressClickOnce = false;
      return;
    }
    void openMaterial(material);
  }

  function clearLongPressTimer() {
    if (longPressTimerId !== null) {
      window.clearTimeout(longPressTimerId);
      longPressTimerId = null;
    }
  }

  function handleLongPressStart(event: PointerEvent, anchor: HTMLElement, material: ScheduleItem) {
    if (!Platform.isMobile) return;
    if (event.pointerType === 'mouse') return;

    clearLongPressTimer();

    longPressTriggered = false;
    longPressStartX = event.clientX;
    longPressStartY = event.clientY;

    longPressTimerId = window.setTimeout(() => {
      longPressTriggered = true;
      suppressClickOnce = true;
      showMaterialMenuAt({ x: event.pageX, y: event.pageY }, { x: event.clientX, y: event.clientY }, anchor, material);
    }, 450);
  }

  function handleLongPressMove(event: PointerEvent) {
    if (!Platform.isMobile) return;
    if (longPressTimerId === null) return;

    const dx = event.clientX - longPressStartX;
    const dy = event.clientY - longPressStartY;
    if (Math.hypot(dx, dy) > 12) {
      clearLongPressTimer();
    }
  }

  function handleLongPressEnd(event: PointerEvent) {
    if (!Platform.isMobile) return;
    clearLongPressTimer();
    if (longPressTriggered) {
      event.preventDefault();
      event.stopPropagation();
    }
    longPressTriggered = false;
  }

  async function handleSchedulingAction(action: SchedulingAction) {
    const target = schedulingMenuTarget;
    if (!target) return;

    try {
      const cfg = schedulingConfig.find(c => c.action === action);
      if (!cfg) return;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let nextDate = new Date(now);
      let nextRepDate = target.nextRepDate;
      let intervalDays = target.intervalDays || 1;
      let scheduleStatus = target.scheduleStatus;

      const updates: { intervalDays?: number; nextRepDate?: number; scheduleStatus?: any; status?: any } = {};

      // 读取 IR 调度参数
      const params = getIRScheduleParams();
      const pEff = target.priority ?? 5;

      if ((cfg as any).isPostpone) {
        nextDate.setDate(nextDate.getDate() + 2);
        nextRepDate = nextDate.getTime();
        updates.nextRepDate = nextRepDate;
        new Notice(`已推迟2天，${nextDate.toLocaleDateString()}再见`);
      } else {
        const currentInterval = target.intervalDays || 1;
        // 获取 TagGroup mGroup 系数（异步）
        const mGroup = await getMGroupForMaterial(target.id);

        if (currentInterval <= 1) {
          intervalDays = schedulingDefaultIntervals[action as 'intensive' | 'normal' | 'slow'];
        } else {
          // 使用 V4 核心公式: I_next = I_curr × mBase × mGroup × Ψ(pEff) × actionMultiplier
          const psi = calculatePsi(pEff);
          intervalDays = Math.round(currentInterval * params.mBase * mGroup * psi * (cfg as any).intervalMultiplier);
        }

        intervalDays = Math.max(1, Math.min(intervalDays, params.maxInterval));
        nextRepDate = calculateNextRepDate(intervalDays);
        scheduleStatus = 'queued';

        updates.intervalDays = intervalDays;
        updates.nextRepDate = nextRepDate;
        updates.scheduleStatus = scheduleStatus as any;

        const actionLabel = { intensive: '攻坚', normal: '正常', slow: '放缓', postpone: '稍后' }[action] || action;
        new Notice(`${actionLabel}模式：${intervalDays}天后再见`);
      }

      // 持久化调度 + 记录交互
      if (isPdfBookmarkTaskId(target.id)) {
        const pdfService = await getPdfBookmarkTaskService();
        await pdfService.updateTask(target.id, {
          intervalDays: updates.intervalDays,
          nextRepDate: updates.nextRepDate,
          status: updates.scheduleStatus ?? undefined
        });
        await pdfService.recordTaskInteraction(target.id, 0, {});
      } else {
        const adapter = await getChunkScheduleAdapter();
        await adapter.updateChunkSchedule(target.id, updates);
        await adapter.recordChunkInteraction(target.id, 0, {});
      }

      processedChunkIds = new Set([...processedChunkIds, target.id]);

      const pinnedKey = schedulingMenuDateKey || formatDateKey(selectedDate);
      const pinnedList = pinnedByDate.get(pinnedKey) || [];
      const updated: ScheduleItem = {
        ...target,
        intervalDays,
        scheduleStatus,
        nextRepDate,
        nextReviewDate: nextRepDate > 0 ? new Date(nextRepDate) : null,
      };

      const newPinnedByDate = new Map(pinnedByDate);
      newPinnedByDate.set(
        pinnedKey,
        [...pinnedList.filter(p => p.id !== target.id), updated]
      );
      pinnedByDate = newPinnedByDate;

      const storage = await getStorage();
      await storage.addCalendarCompletion(pinnedKey, target.id);
      calendarProgressByDate = {
        ...calendarProgressByDate,
        [pinnedKey]: [...new Set([...(calendarProgressByDate[pinnedKey] || []), target.id])]
      };

      const nextMaterial = getNextUnprocessedMaterial(target.id);

      closeSchedulingMenu();

      // ✅ 关键修复：await 确保数据刷新完成后再执行后续操作
      await loadData();
      await loadCalendarProgress();
      // 通知其他组件数据已更新
      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));

      if (nextMaterial) {
        await openMaterial(nextMaterial);
      }
    } catch (error) {
      logger.error('[IRCalendarSidebar] 调度失败:', error);
      new Notice('操作失败，请重试');
    }
  }

  // 加载数据 - 参考 IRScheduleGantt 的实现
  async function loadData() {
    isLoading = true;
    try {
      const storage = await getStorage();
      irDecks = Object.values(await storage.getAllDecks());
      allBlocks = Object.values(await storage.getAllBlocks());

      const chunksStore = await storage.getAllChunkDataWithSync();
      const chunks = Object.values(chunksStore || {});

      try {
        if (plugin.readingMaterialManager) {
          readingMaterials = await plugin.readingMaterialManager.getAllMaterials();
        } else {
          readingMaterials = [];
        }
      } catch {
        readingMaterials = [];
      }
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // 1. 构建 materialsByDate
      const byDate = new Map<string, ScheduleItem[]>();
      
      for (const chunk of chunks) {
        const scheduleStatus = (chunk as any).scheduleStatus as string || 'new';
        if (scheduleStatus === 'done' || scheduleStatus === 'suspended' || scheduleStatus === 'removed') continue;

        const nextRepDate = (chunk as any).nextRepDate as number || 0;
        const intervalDays = (chunk as any).intervalDays as number || 1;
        const priority = (chunk as any).priorityUi as number ?? (chunk as any).priorityEff as number ?? 5;
        const filePath = (chunk as any).filePath as string || '';
        const chunkId = (chunk as any).chunkId as string || '';

        // 获取材料名称
        const base = filePath?.split('/').pop() || chunkId;
        const title = base.replace(/\.md$/i, '').replace(/^\d+_/, '');

        let nextReviewDate: Date | null = null;
        let dateKey: string;

        if (nextRepDate > 0) {
          nextReviewDate = new Date(nextRepDate);
          dateKey = formatDateKey(nextReviewDate);
        } else {
          // 新材料放在今天
          dateKey = formatDateKey(now);
        }

        const rm = readingMaterials.find(m => m.filePath === filePath);

        const item: ScheduleItem = {
          id: chunkId,
          title,
          sourceFile: filePath,
          resumeLink: rm?.resumeLink,
          priority,
          intervalDays,
          scheduleStatus,
          nextRepDate,
          nextReviewDate
        };

        if (!byDate.has(dateKey)) {
          byDate.set(dateKey, []);
        }
        byDate.get(dateKey)!.push(item);
      }

      try {
        const pdfService = await getPdfBookmarkTaskService();
        const tasks = await pdfService.getAllTasks();
        for (const task of tasks) {
          const status = String(task.status || 'new');
          if (status === 'done' || status === 'suspended' || status === 'removed') continue;

          let dateKey: string;
          let nextReviewDate: Date | null = null;
          const nextRepDate = Number(task.nextRepDate || 0);
          if (nextRepDate > 0) {
            nextReviewDate = new Date(nextRepDate);
            dateKey = formatDateKey(nextReviewDate);
          } else {
            dateKey = formatDateKey(now);
          }

          const pdfFullTitle = String(task.title || '').trim() || 'PDF 书签任务';
          const item: ScheduleItem = {
            id: task.id,
            title: pdfFullTitle,
            displayName: extractPdfHeading(pdfFullTitle),
            sourceFile: task.pdfPath,
            resumeLink: task.link,
            priority: Number(task.priorityUi ?? task.priorityEff ?? 5),
            intervalDays: Number(task.intervalDays ?? 1),
            scheduleStatus: status,
            nextRepDate,
            nextReviewDate
          };

          if (!byDate.has(dateKey)) {
            byDate.set(dateKey, []);
          }
          byDate.get(dateKey)!.push(item);
        }
      } catch (e) {
        logger.warn('[IRCalendarSidebar] 加载 PDF 书签任务失败:', e);
      }

      materialsByDate = byDate;

      logger.debug('[IRCalendarSidebar] 数据加载完成:', {
        chunks: chunks.length,
        dates: materialsByDate.size
      });
    } catch (error) {
      logger.error('[IRCalendarSidebar] 加载数据失败:', error);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadData();
    loadCalendarProgress();

    // 监听数据更新事件（防抖：避免短时间内重复加载）
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleDataUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
        loadCalendarProgress();
      }, 100);
    };
    window.addEventListener('Weave:ir-data-updated', handleDataUpdate);

    return () => {
      window.removeEventListener('Weave:ir-data-updated', handleDataUpdate);
    };
  });

  // 派生数据
  let monthDays = $derived(getMonthDays(currentDate.getFullYear(), currentDate.getMonth()));
  let selectedMaterials = $derived(getSelectedMaterials());
  let monthLabel = $derived(`${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`);
</script>

<div class="ir-calendar-sidebar">
  <!-- 头部 -->
  <div class="calendar-header">
    {#if !hideCalendarTitle}
      <h3 class="calendar-title">增量阅读</h3>
    {/if}
    <div class="month-nav">
      <button class="nav-btn" onclick={prevMonth} aria-label="上个月">
        <ObsidianIcon name="chevron-left" size={14} />
      </button>
      <span class="month-label">{monthLabel}</span>
      <button class="nav-btn" onclick={nextMonth} aria-label="下个月">
        <ObsidianIcon name="chevron-right" size={14} />
      </button>
      <button class="today-btn" onclick={goToToday}>今天</button>
    </div>
    <button class="import-btn" onclick={openImportModal} title="导入阅读材料">
      <ObsidianIcon name="folder-input" size={14} />
    </button>
  </div>

  <!-- 月历网格 -->
  <div class="calendar-grid-container">
    <div class="weekdays">
      <span class="weekday weekend">日</span>
      <span class="weekday">一</span>
      <span class="weekday">二</span>
      <span class="weekday">三</span>
      <span class="weekday">四</span>
      <span class="weekday">五</span>
      <span class="weekday weekend">六</span>
    </div>
    <div class="calendar-grid">
      {#each monthDays as { date, otherMonth }}
        {@const isToday = isSameDay(date, today)}
        {@const isSelected = isSameDay(date, selectedDate)}
        {@const heatLevel = getHeatLevel(date)}
        <button
          class="day-cell"
          class:other-month={otherMonth}
          class:today={isToday}
          class:selected={isSelected}
          onclick={() => selectDay(date)}
          title={`${materialsByDate.get(formatDateKey(date))?.length || 0}项待读`}
        >
          <span class="day-number">{date.getDate()}</span>
          <span class="heat-dot level-{heatLevel}"></span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 阅读材料列表 -->
  <div class="reading-list">
    {#if isLoading}
      <div class="loading-state">
        <ObsidianIcon name="loader" size={20} />
        <span>加载中...</span>
      </div>
    {:else if selectedMaterials.length > 0}
      {#each selectedMaterials as material, index}
        {@const priority = material.priority || 0}
        {@const priorityClass = priority >= 8 ? 'high' : priority >= 4 ? 'medium' : 'low'}
        {@const isExpanded = expandedMaterialIds.has(material.id)}
        {@const isLoadingSibling = loadingSiblings.has(material.id)}
        {@const siblings = siblingCache.get(material.id) || []}
        <div class="reading-item-wrapper">
          <div class="reading-item">
            {#if continuousReadingEnabled}
              <button
                class="expand-btn"
                class:expanded={isExpanded}
                class:loading={isLoadingSibling}
                aria-label={isExpanded ? '收起目录' : '展开目录'}
                onclick={() => toggleMaterialExpand(material)}
              >
                {#if isLoadingSibling}
                  <ObsidianIcon name="loader" size={12} />
                {:else}
                  <ObsidianIcon name="chevron-right" size={12} />
                {/if}
              </button>
            {/if}
            <button
              class="reading-item-main"
              onclick={() => handleMaterialClick(material)}
              oncontextmenu={(e) => handleMaterialContextMenu(e, e.currentTarget as unknown as HTMLElement, material)}
              onpointerdown={(e) => handleLongPressStart(e, e.currentTarget as unknown as HTMLElement, material)}
              onpointermove={handleLongPressMove}
              onpointerup={handleLongPressEnd}
              onpointercancel={handleLongPressEnd}
            >
              <span class="item-rank" class:top={index < 3}>{index + 1}</span>
              <span class="item-title" class:processed={processedChunkIds.has(material.id)}>{material.displayName || material.title || '未命名'}</span>
            </button>
            <div class="reading-item-controls">
              <button
                class="schedule-checkbox"
                aria-label="调度"
                onclick={(e) => openSchedulingMenu(e, material)}
              >
                <span class="checkbox-box" class:checked={processedChunkIds.has(material.id)} aria-hidden="true"></span>
              </button>
              <span class="priority-badge {priorityClass}">P{priority}</span>
            </div>
          </div>
          {#if continuousReadingEnabled && isExpanded && siblings.length > 0}
            <div class="sibling-list">
              {#each siblings as sibling}
                {@const sPriority = sibling.priority || 0}
                {@const sPriorityClass = sPriority >= 8 ? 'high' : sPriority >= 4 ? 'medium' : 'low'}
                {@const dueText = sibling.nextRepDate > 0 ? formatSiblingDueDate(sibling.nextRepDate) : '未调度'}
                <div class="sibling-item">
                  <button
                    class="sibling-item-main"
                    onclick={() => void openMaterial(sibling)}
                    oncontextmenu={(e) => handleMaterialContextMenu(e, e.currentTarget as unknown as HTMLElement, sibling)}
                    onpointerdown={(e) => handleLongPressStart(e, e.currentTarget as unknown as HTMLElement, sibling)}
                    onpointermove={handleLongPressMove}
                    onpointerup={handleLongPressEnd}
                    onpointercancel={handleLongPressEnd}
                    title={sibling.title || sibling.id}
                  >
                    <span class="sibling-title">{sibling.displayName || sibling.title || sibling.id}</span>
                    <span class="sibling-due">{dueText}</span>
                  </button>
                  <div class="reading-item-controls">
                    <button
                      class="schedule-checkbox"
                      aria-label="调度"
                      onclick={(e) => openSchedulingMenu(e, sibling)}
                    >
                      <span class="checkbox-box" class:checked={processedChunkIds.has(sibling.id)} aria-hidden="true"></span>
                    </button>
                    <span class="priority-badge {sPriorityClass}">P{sPriority}</span>
                  </div>
                </div>
              {/each}
            </div>
          {:else if continuousReadingEnabled && isExpanded && siblings.length === 0}
            <div class="sibling-list">
              <div class="sibling-empty">无其它同源书签</div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<FloatingMenu
  bind:show={schedulingMenuOpen}
  anchor={schedulingMenuAnchor}
  placement="left-start"
  onClose={closeSchedulingMenu}
  class="ir-calendar-scheduling-menu"
>
  {#snippet children()}
    <div class="ir-calendar-scheduling-grid">
      {#each schedulingConfig as cfg}
        <button
          class="ir-calendar-scheduling-btn"
          style="--accent: {cfg.color}"
          onclick={() => handleSchedulingAction(cfg.action)}
        >
          <span class="ir-calendar-scheduling-label">{cfg.label}</span>
          {#if showScheduleTime}
            <span class="ir-calendar-scheduling-next">{getSchedulingPrediction(cfg.action)}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/snippet}
</FloatingMenu>

<FloatingMenu
  bind:show={priorityMenuOpen}
  anchor={priorityMenuAnchor}
  placement="left-start"
  onClose={closePriorityMenu}
  class="ir-calendar-priority-menu"
>
  {#snippet children()}
    {#if priorityMenuTarget}
      <div class="ir-calendar-priority-panel">
        <IRPrioritySlider
          value={priorityMenuTarget.priority ?? 5}
          expanded={prioritySliderExpanded}
          onToggle={() => {
            prioritySliderExpanded = !prioritySliderExpanded;
            if (!prioritySliderExpanded) closePriorityMenu();
          }}
          onChange={handlePriorityUiChange}
        />
      </div>
    {/if}
  {/snippet}
</FloatingMenu>

<!-- 导入模态窗 -->
<MaterialImportModal
  {plugin}
  bind:open={showImportModal}
  onClose={() => showImportModal = false}
  onImportComplete={handleImportComplete}
/>

<style>
  .ir-calendar-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    background: var(--background-primary);
    overflow: hidden;
  }

  /* 头部 */
  .calendar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .calendar-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    flex-shrink: 0;
  }

  :global(.is-mobile) .calendar-title,
  :global(.is-phone) .calendar-title {
    display: none;
  }

  .import-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .import-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  .month-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }

  .nav-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: var(--background-modifier-hover);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .nav-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  .month-label {
    text-align: center;
    font-size: 13px;
    font-weight: 500;
  }

  .today-btn {
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
    line-height: 1;
    border: none;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .today-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  /* 月历网格 */
  .calendar-grid-container {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 8px;
  }

  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 4px;
  }

  .weekday {
    text-align: center;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    padding: 2px 0;
  }

  .weekday.weekend {
    color: var(--text-error);
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .day-cell {
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .day-cell:hover {
    background: var(--background-modifier-hover);
  }

  .day-cell.other-month {
    opacity: 0.3;
  }

  .day-cell.selected {
    background: var(--interactive-accent);
  }

  .day-cell.selected .day-number {
    color: var(--text-on-accent);
  }

  .day-cell.today .day-number {
    font-weight: 700;
    color: var(--interactive-accent);
  }

  .day-cell.selected.today .day-number {
    color: var(--text-on-accent);
  }

  .day-number {
    font-size: 11px;
    line-height: 1;
  }

  /* 热力圆点 */
  .heat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .heat-dot.level-0 { background: var(--background-modifier-border); opacity: 0.4; }
  .heat-dot.level-1 { background: var(--color-green); opacity: 0.5; }
  .heat-dot.level-2 { background: var(--color-green); }
  .heat-dot.level-3 { background: var(--color-yellow); }
  .heat-dot.level-4 { background: var(--color-orange); }
  .heat-dot.level-5 { background: var(--color-red); }

  /* 阅读列表 */
  .reading-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: transparent;
    padding: 0;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .reading-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 4px;
    background: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    text-align: left;
    width: 100%;
  }

  .reading-item:hover {
    background: var(--background-modifier-hover);
  }

  .reading-item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    box-shadow: none;
    outline: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-width: 0;
  }

  .reading-item-main:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }

  .reading-item-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .schedule-checkbox {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .schedule-checkbox:hover .checkbox-box {
    border-color: color-mix(in srgb, var(--interactive-accent) 50%, var(--background-modifier-border));
  }

  .schedule-checkbox:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .checkbox-box {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--background-modifier-border);
    background: transparent;
    position: relative;
  }

  .checkbox-box.checked {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 25%, var(--background-primary));
  }

  .checkbox-box.checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border-right: 2px solid var(--interactive-accent);
    border-bottom: 2px solid var(--interactive-accent);
    transform: rotate(45deg);
  }

  .item-rank {
    width: 18px;
    height: 18px;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-rank.top {
    background: var(--color-orange);
    color: white;
  }

  .item-title {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .item-title.processed {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .item-due {
    font-size: 10px;
    color: var(--text-faint);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .ir-calendar-scheduling-menu {
    min-width: 220px;
  }

  .ir-calendar-scheduling-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 10px;
  }

  .ir-calendar-scheduling-btn {
    border: none;
    background: none;
    border-radius: 6px;
    padding: 10px;
    cursor: pointer;
    text-align: left;
    position: relative;
    overflow: hidden;
    box-shadow: none;
    outline: none;
  }

  .ir-calendar-scheduling-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ir-calendar-scheduling-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .ir-calendar-scheduling-next {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
  }

  .priority-badge {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .priority-badge.high {
    background: rgba(var(--color-red-rgb), 0.15);
    color: var(--color-red);
  }

  .priority-badge.medium {
    background: rgba(var(--color-yellow-rgb), 0.15);
    color: var(--color-yellow);
  }

  .priority-badge.low {
    background: rgba(var(--color-green-rgb), 0.15);
    color: var(--color-green);
  }

  /* 展开按钮 */
  .expand-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 3px;
    transition: transform 0.15s ease, color 0.15s ease;
  }

  .expand-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .expand-btn.expanded {
    transform: rotate(90deg);
  }

  .expand-btn.loading {
    transform: none;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* 材料项包裹 */
  .reading-item-wrapper {
    display: flex;
    flex-direction: column;
    background: none;
    border: none;
    box-shadow: none;
    outline: none;
  }

  /* 同源目录列表 */
  .sibling-list {
    margin-left: 26px;
    padding-left: 10px;
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 2px;
    margin-bottom: 4px;
  }

  .sibling-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    background: none;
  }

  .sibling-item:hover {
    background: var(--background-modifier-hover);
  }

  .sibling-item-main {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    box-shadow: none;
    outline: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    flex: 1;
    min-width: 0;
  }

  .sibling-title {
    flex: 1;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .sibling-due {
    font-size: 10px;
    color: var(--text-faint);
    flex-shrink: 0;
    margin-left: 4px;
  }

  .sibling-empty {
    font-size: 11px;
    color: var(--text-faint);
    padding: 4px 0;
  }
</style>
