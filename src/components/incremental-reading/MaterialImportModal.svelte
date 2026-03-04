<!--
  MaterialImportModal - 阅读材料批量导入模态窗
  
  重构版本 v4.0.0
  - 使用 ResizableModal 统一窗口定位和样式
  - 多彩侧边颜色条标识
  - 优化的多步骤流程（选择 → 拆分方式 → 配置/预览 → 导入）
  - 改进的空状态处理
  
  @module components/incremental-reading/MaterialImportModal
  @version 4.0.0
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TFolder, TFile, Notice, normalizePath, Menu } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import { logger } from '../../utils/logger';
  import { resolveIRImportFolder } from '../../config/paths';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import ResizableModal from '../ui/ResizableModal.svelte';
  import type { BatchImportResult } from '../../services/incremental-reading/ReadingMaterialManager';
  import { getServices } from './IRDeckView.svelte';
  import type { IRDeck } from '../../types/ir-types';
  
  import type { ImportStep, SplitMode, RuleSplitConfig as RuleSplitConfigType, ContentBlock } from '../../types/content-split-types';
  import { DEFAULT_RULE_SPLIT_CONFIG, SPLIT_MARKER_REGEX, generateSplitMarker } from '../../types/content-split-types';
  import { splitByRules, parseManualSplitMarkers } from '../../utils/content-split-utils';
  import { IRChunkFileService } from '../../services/incremental-reading/IRChunkFileService';
  import { IRTagGroupService } from '../../services/incremental-reading/IRTagGroupService';
  import { IRPdfBookmarkTaskService } from '../../services/incremental-reading/IRPdfBookmarkTaskService';
  import type { SchedulingConfig, SchedulingImpact } from '../../types/ir-import-scheduling';
  import { DEFAULT_SCHEDULING_CONFIG, SCHEDULING_PRESETS } from '../../types/ir-import-scheduling';
  import { IRImportSchedulingService, type IRLoadInfo } from '../../services/incremental-reading/IRImportSchedulingService';

  interface Props {
    plugin: WeavePlugin;
    open: boolean;
    onClose: () => void;
    onImportComplete: (result: BatchImportResult) => void;
  }

  async function handlePdfBookmarkTaskImport(): Promise<void> {
    if (!selectedDeckId) return;

    importing = true;
    importProgress = { current: 0, total: contentBlocks.length };

    try {
      await services.init();

      const pdfService = new IRPdfBookmarkTaskService(plugin.app);
      await pdfService.initialize();
      const allPdfTasks = await pdfService.getAllTasks();

      let assignments: Map<ContentBlock, Date> | null = null;
      if (contentBlocks.length > 0) {
        const loadInfo: IRLoadInfo = {
          dailyBudgetMinutes: 60,
          getBlocksForDate: async (date: Date) => {
            const allChunks = await services.storageService?.getAllChunkData() || {};
            const chunks = Object.values(allChunks);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const chunkBlocks = chunks.filter((chunk: any) => {
              if (!chunk.nextRepDate) return false;
              if (chunk.scheduleStatus === 'done' || chunk.scheduleStatus === 'suspended' || chunk.scheduleStatus === 'removed') return false;
              const d = new Date(chunk.nextRepDate);
              return d >= startOfDay && d <= endOfDay;
            }) as any;

            const pdfBlocks = allPdfTasks.filter((t: any) => {
              if (!t?.nextRepDate) return false;
              if (t.status === 'done' || t.status === 'suspended' || t.status === 'removed') return false;
              const d = new Date(t.nextRepDate);
              return d >= startOfDay && d <= endOfDay;
            }) as any;

            return [...chunkBlocks, ...pdfBlocks] as any;
          },
          estimateBlockMinutes: (block: any) => {
            const charCount = 'content' in block ? block.content.length : 200;
            return Math.max(1, Math.ceil(charCount / 500));
          }
        };

        if (!schedulingService) {
          schedulingService = new IRImportSchedulingService(loadInfo);
        }

        schedulingImpact = await schedulingService.calculateScheduling(
          contentBlocks,
          schedulingConfig
        );
        assignments = schedulingService.applyScheduling(contentBlocks, schedulingImpact);
      }

      const existing = await pdfService.getTasksByDeck(selectedDeckId);
      const existingKeys = new Set<string>();
      for (const t of existing) {
        const link = String((t as any)?.link || '').trim();
        const pdfPath = String((t as any)?.pdfPath || '').trim();
        const m = link.match(/\bpage=(\d+)\b/i);
        const pageNumber = m ? Number(m[1]) : 0;
        if (pdfPath && pageNumber > 0) {
          existingKeys.add(`${pdfPath}#${pageNumber}`);
        }
        if (link) {
          existingKeys.add(link);
        }
      }

      let success = 0;
      let skipped = 0;
      const errors: Array<{ path: string; error: string }> = [];

      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        importProgress = { current: i + 1, total: contentBlocks.length };

        const pdfPath = String(block.sourceFilePath || '').trim();
        if (!pdfPath) continue;

        // 剥离 wikilink 语法：[[path#subpath|alias]] → path#subpath
        const rawContent = String(block.content || '').trim();
        const linkText = rawContent.replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
        const pageNumber = (block as any).pdfPageNumber ? Number((block as any).pdfPageNumber) : 0;
        const key = pageNumber > 0 ? `${pdfPath}#${pageNumber}` : linkText;
        if (existingKeys.has(key) || existingKeys.has(linkText)) {
          skipped++;
          continue;
        }

        try {
          const created = await pdfService.createTask({
            deckId: selectedDeckId,
            pdfPath,
            title: block.title || 'PDF',
            link: linkText,
            priorityUi: 5
          });

          const assignedDate = assignments?.get(block as any);
          if (assignedDate) {
            await pdfService.updateTask(created.id, {
              nextRepDate: assignedDate.getTime(),
              intervalDays: 1,
              status: 'queued'
            });
          }

          existingKeys.add(key);
          existingKeys.add(linkText);
          success++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : '未知错误';
          errors.push({ path: pdfPath, error: msg });
        }
      }

      window.dispatchEvent(new CustomEvent('Weave:ir-data-updated'));
      onImportComplete({ success, skipped, errors });
      onClose();
    } catch (error) {
      logger.error('[MaterialImportModal] PDF 书签任务导入失败:', error);
      new Notice(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      importing = false;
    }
  }

  let { plugin, open = $bindable(), onClose, onImportComplete }: Props = $props();

  interface TreeNode {
    name: string;
    path: string;
    type: 'folder' | 'file';
    children: TreeNode[];
    expanded: boolean;
    selected: boolean;
    indeterminate: boolean;
  }

  let treeData = $state<TreeNode[]>([]);
  let searchQuery = $state('');
  let showContent = $state(false);
  let importing = $state(false);
  let importProgress = $state({ current: 0, total: 0 });
  
  let currentStep = $state<ImportStep>('select');
  let splitMode = $state<SplitMode | null>(null);
  let ruleSplitConfig = $state<RuleSplitConfigType>({ ...DEFAULT_RULE_SPLIT_CONFIG });
  let fileContent = $state('');
  let editedContent = $state('');

  interface ImportContentBlock extends ContentBlock {
    sourceFilePath?: string;
    pdfPageNumber?: number;
  }

  let contentBlocks = $state<ImportContentBlock[]>([]);
  let selectedFilePath = $state<string | null>(null);
  let selectedFilePaths = $state<string[]>([]);
  let selectedRootFolderPaths = $state<string[]>([]);
  
  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let previewIndex = $state(0);
  let initialized = $state(false);
  
  // 牌组选择相关状态
  let availableDecks = $state<IRDeck[]>([]);
  let selectedDeckId = $state<string | null>(null);
  let showNewDeckInput = $state(false);
  let newDeckName = $state('');
  let creatingDeck = $state(false);
  const services = getServices(plugin.app, plugin.settings?.incrementalReading?.importFolder);
  
  // v5.0 文件化块服务
  let chunkFileService: IRChunkFileService | null = $state(null);

  let irTagGroupService: IRTagGroupService | null = $state(null);
  
  // 时间分散调度相关状态
  let schedulingConfig = $state<SchedulingConfig>({ ...DEFAULT_SCHEDULING_CONFIG });
  let schedulingImpact = $state<SchedulingImpact | null>(null);
  let showSchedulingDetails = $state(false);
  let schedulingService: IRImportSchedulingService | null = null;
  let useCustomDays = $state(false);
  let customDaysValue = $state(21);

  let isPdfImportMode = $state(false);
  let previewTagGroupName = $state('');

  const selectedCount = $derived.by(() => countSelectedFiles(treeData));
  
  const modalTitle = $derived.by(() => {
    switch (currentStep) {
      case 'select': return '导入阅读材料';
      case 'split-mode': return '选择拆分方式';
      case 'configure': return splitMode === 'manual' ? '手动拆分' : '配置拆分规则';
      case 'preview': return isPdfImportMode ? '确认导入 PDF 材料' : '预览拆分结果';
      default: return '导入阅读材料';
    }
  });
  
  const filteredTreeData = $derived.by(() => {
    if (!searchQuery.trim()) return treeData;
    return filterTree(treeData, searchQuery.toLowerCase());
  });

  const isMultiFileMode = $derived(selectedFilePaths.length > 1);
  
  // 计算调度影响
  $effect(() => {
    if (currentStep === 'preview' && contentBlocks.length > 0 && selectedDeckId) {
      calculateSchedulingImpact();
    }
  });
  
  // 当调度配置改变时重新计算
  $effect(() => {
    if (currentStep === 'preview' && contentBlocks.length > 0 && selectedDeckId && schedulingImpact) {
      // 配置变化时重新计算
      const config = schedulingConfig; // 触发响应式
      calculateSchedulingImpact();
    }
  });
  
  async function calculateSchedulingImpact() {
    if (!services.storageService || contentBlocks.length === 0) return;
    
    try {
      await services.init();
      // 创建负载信息对象
      const loadInfo: IRLoadInfo = {
        dailyBudgetMinutes: 60, // 默认每日60分钟，后续可从设置读取
        getBlocksForDate: async (date: Date) => {
          // 获取指定日期的已有IR块
          const allChunks = await services.storageService?.getAllChunkData() || {};
          const chunks = Object.values(allChunks);
          const startOfDay = new Date(date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);

          return chunks.filter((chunk: any) => {
            if (!chunk.nextRepDate) return false;
            if (chunk.scheduleStatus === 'done' || chunk.scheduleStatus === 'suspended' || chunk.scheduleStatus === 'removed') return false;
            const d = new Date(chunk.nextRepDate);
            return d >= startOfDay && d <= endOfDay;
          }) as any;
        },
        estimateBlockMinutes: (block: any) => {
          // 简化估算：每500字符1分钟
          const charCount = 'content' in block ? block.content.length : 500;
          return Math.max(1, Math.ceil(charCount / 500));
        }
      };
      
      // 创建调度服务并计算影响
      if (!schedulingService) {
        schedulingService = new IRImportSchedulingService(loadInfo);
      }
      
      schedulingImpact = await schedulingService.calculateScheduling(
        contentBlocks,
        schedulingConfig
      );
    } catch (error) {
      logger.error('[MaterialImportModal] 计算调度影响失败:', error);
    }
  }

  function buildTree(folder: TFolder): TreeNode {
    const children: TreeNode[] = [];

    for (const child of folder.children) {
      if (child instanceof TFolder) {
        const folderNode = buildTree(child);
        if (folderNode.children.length > 0) {
          children.push(folderNode);
        }
      } else if (child instanceof TFile && (child.extension === 'md' || child.extension === 'pdf')) {
        children.push({
          name: child.name,
          path: child.path,
          type: 'file',
          children: [],
          expanded: false,
          selected: false,
          indeterminate: false
        });
      }
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    return {
      name: folder.name || 'Vault',
      path: folder.path,
      type: 'folder',
      children,
      expanded: folder.path === '' || folder.path === '/',
      selected: false,
      indeterminate: false
    };
  }

  function toggleSelect(node: TreeNode): void {
    node.selected = !node.selected;
    node.indeterminate = false;
    if (node.type === 'folder' && node.children.length > 0) {
      setChildrenSelected(node.children, node.selected);
    }
    updateParentStates(treeData);
    treeData = [...treeData];
  }

  function setChildrenSelected(children: TreeNode[], selected: boolean): void {
    for (const child of children) {
      child.selected = selected;
      child.indeterminate = false;
      if (child.type === 'folder' && child.children.length > 0) {
        setChildrenSelected(child.children, selected);
      }
    }
  }

  function updateParentStates(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.type === 'folder' && node.children.length > 0) {
        updateParentStates(node.children);
        const selCount = node.children.filter(c => c.selected).length;
        const indeterminateCount = node.children.filter(c => c.indeterminate).length;
        const totalCount = node.children.length;

        if (selCount === totalCount && indeterminateCount === 0) {
          node.selected = true;
          node.indeterminate = false;
        } else if (selCount === 0 && indeterminateCount === 0) {
          node.selected = false;
          node.indeterminate = false;
        } else {
          node.selected = false;
          node.indeterminate = true;
        }
      }
    }
  }

  function toggleExpand(node: TreeNode): void {
    node.expanded = !node.expanded;
    treeData = [...treeData];
  }

  function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.type === 'folder' && node.children.length > 0) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  function countSelectedFiles(nodes: TreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'file' && node.selected) count++;
      else if (node.type === 'folder') count += countSelectedFiles(node.children);
    }
    return count;
  }

  function countTotalFiles(nodes: TreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'file') count++;
      else if (node.type === 'folder') count += countTotalFiles(node.children);
    }
    return count;
  }

  function getSelectedPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    function collect(nodeList: TreeNode[]): void {
      for (const node of nodeList) {
        if (node.type === 'file' && node.selected) paths.push(node.path);
        else if (node.type === 'folder') collect(node.children);
      }
    }
    collect(nodes);
    return paths;
  }

  function getSelectedRootFolderPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    const walk = (nodeList: TreeNode[], parentSelected: boolean): void => {
      for (const node of nodeList) {
        const isFolder = node.type === 'folder';
        const isSelectedRootFolder = isFolder && node.selected && !parentSelected && node.path;
        if (isSelectedRootFolder) {
          paths.push(node.path);
        }
        const nextParentSelected = parentSelected || (isFolder && node.selected);
        if (isFolder && node.children.length > 0) {
          walk(node.children, nextParentSelected);
        }
      }
    };
    walk(nodes, false);
    return paths;
  }

  function getBookNameForFilePath(filePath: string): string | null {
    if (!filePath) return null;
    const normalizedFilePath = normalizePath(filePath);
    const normalizedRoots = (selectedRootFolderPaths || []).map(p => normalizePath(p)).filter(Boolean);
    let bestRoot: string | null = null;
    for (const root of normalizedRoots) {
      if (root && normalizedFilePath.startsWith(root + '/')) {
        if (!bestRoot || root.length > bestRoot.length) {
          bestRoot = root;
        }
      }
    }
    if (!bestRoot) return null;
    const parts = bestRoot.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }

  function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        if (node.name.toLowerCase().includes(query)) {
          result.push({ ...node });
        }
      } else {
        const filteredChildren = filterTree(node.children, query);
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(query)) {
          result.push({ ...node, children: filteredChildren, expanded: true });
        }
      }
    }
    return result;
  }

  function toggleSelectAll(): void {
    const allSelected = selectedCount > 0;
    setChildrenSelected(treeData, !allSelected);
    updateParentStates(treeData);
    treeData = [...treeData];
  }

  function getMarkerCount(content: string): number {
    const matches = content.match(SPLIT_MARKER_REGEX);
    return matches ? matches.length : 0;
  }

  function insertManualMarker(): void {
    if (!textareaEl) return;
    
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const scrollTop = textareaEl.scrollTop;
    const marker = generateSplitMarker();
    
    const before = editedContent.substring(0, start);
    const after = editedContent.substring(end);
    
    editedContent = before + '\n' + marker + '\n' + after;

    requestAnimationFrame(() => {
      if (textareaEl) {
        const newPos = start + marker.length + 2;
        textareaEl.focus();
        textareaEl.setSelectionRange(newPos, newPos);
        textareaEl.scrollTop = scrollTop;
      }
    });
  }

  async function goToSplitModeStep(): Promise<void> {
    const paths = getSelectedPaths(treeData);
    if (paths.length === 0) return;
    
    selectedFilePaths = paths;
    selectedRootFolderPaths = getSelectedRootFolderPaths(treeData);

    const extensions = new Set<string>();
    for (const p of paths) {
      const af = plugin.app.vault.getAbstractFileByPath(p);
      if (af instanceof TFile) {
        extensions.add(af.extension);
      }
    }

    const hasMarkdown = extensions.has('md');
    const hasNonMarkdown = Array.from(extensions).some(ext => ext !== 'md');
    if (hasMarkdown && hasNonMarkdown) {
      new Notice('暂不支持混合导入（请分别导入 Markdown 与 PDF）');
      return;
    }

    const isPdfImport = hasNonMarkdown;
    if (isPdfImport) {
      await preparePdfImportPreview(paths);
      return;
    }

    if (paths.length === 1) {
      selectedFilePath = paths[0];
      try {
        const file = plugin.app.vault.getAbstractFileByPath(selectedFilePath);
        if (file instanceof TFile) {
          fileContent = await plugin.app.vault.read(file);
          editedContent = fileContent;
        }
      } catch (error) {
        logger.error('[MaterialImportModal] 读取文件失败:', error);
      }
    } else {
      selectedFilePath = null;
      fileContent = '';
      editedContent = '';
    }
    
    currentStep = 'split-mode';
  }

  async function preparePdfImportPreview(filePaths: string[]): Promise<void> {
    isPdfImportMode = true;
    selectedFilePath = filePaths.length === 1 ? filePaths[0] : null;
    importing = true;
    importProgress = { current: 0, total: filePaths.length };

    try {
      const blocks: ImportContentBlock[] = [];
      for (let i = 0; i < filePaths.length; i++) {
        const p = filePaths[i];
        importProgress = { current: i + 1, total: filePaths.length };

        const file = plugin.app.vault.getAbstractFileByPath(p);
        const tfile = file instanceof TFile ? file : null;
        if (!tfile) continue;

        const items = await getPdfOutlineItemsByOpeningLeaf(tfile);
        logger.debug('[MaterialImportModal] PDF 目录提取结果:', {
          pdf: tfile.path,
          outlineCount: items.length
        });
        if (items.length === 0) {
          const id = `pdf-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          blocks.push({
            id,
            title: tfile.basename,
            content: `[[${tfile.path}|${tfile.basename}]]`,
            charCount: tfile.basename.length,
            startOffset: 0,
            endOffset: 0,
            sourceFilePath: tfile.path
          });
          continue;
        }

        for (const it of items) {
          const id = `pdf-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          const title = it.path.length > 0 ? it.path.join(' / ') : it.title;
          const pageNumber = typeof it.pageNumber === 'number' ? it.pageNumber : 0;
          blocks.push({
            id,
            title,
            content: pageNumber > 0 ? `[[${tfile.path}#page=${pageNumber}|${title}]]` : `[[${tfile.path}|${title}]]`,
            charCount: title.length,
            startOffset: 0,
            endOffset: 0,
            sourceFilePath: tfile.path,
            pdfPageNumber: pageNumber > 0 ? pageNumber : undefined
          });
        }
      }

      contentBlocks = blocks;
      currentStep = 'preview';
    } catch (error) {
      logger.error('[MaterialImportModal] 解析 PDF 目录失败:', error);
      new Notice(`解析 PDF 目录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      importing = false;
    }
  }

  /**
   * 通过 Obsidian 的 PDF 视图获取 PDF 目录（outline）。
   *
   * Obsidian PDF 视图结构（参考 PDF++ typings.d.ts）：
   *   PDFView (leaf.view)
   *     └── viewer: PDFViewerComponent
   *           └── child: PDFViewerChild
   *                 └── pdfViewer: ObsidianViewer
   *                       ├── pdfOutlineViewer  ← 已解析的目录树
   *                       ├── pdfViewer (内层 PDF.js PDFViewer) → pdfDocument
   *                       └── pdfLoadingTask.promise → PDFDocumentProxy
   */
  async function getPdfOutlineItemsByOpeningLeaf(pdfFile: TFile): Promise<Array<{ title: string; pageNumber: number; path: string[] }>> {
    let leaf: any = null;
    let createdLeaf = false;
    try {
      // 1. 优先复用已打开的同一 PDF 的 leaf
      try {
        const leaves = plugin.app.workspace.getLeavesOfType('pdf') || [];
        const existing = leaves.find((l: any) => l?.view?.file?.path === pdfFile.path);
        if (existing) {
          leaf = existing;
        }
      } catch {}

      if (!leaf) {
        leaf = plugin.app.workspace.getLeaf('tab');
        createdLeaf = true;
        await leaf.openFile(pdfFile, { active: false });
      }

      // 2. 等待 PDFViewerChild 就绪
      //    PDFViewerComponent.child 初始为 null，文件加载完成后才填充
      //    PDFViewerComponent.then(cb) 可注册就绪回调
      const child: any = await new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('PDFViewerChild 等待超时')), 20000);
        const viewerComp = (leaf as any)?.view?.viewer;
        if (!viewerComp) {
          clearTimeout(timeoutId);
          reject(new Error('未找到 PDFViewerComponent'));
          return;
        }
        if (viewerComp.child) {
          clearTimeout(timeoutId);
          resolve(viewerComp.child);
          return;
        }
        if (typeof viewerComp.then === 'function') {
          viewerComp.then((c: any) => { clearTimeout(timeoutId); resolve(c); });
        } else {
          // 兜底轮询
          const poll = setInterval(() => {
            if (viewerComp.child) {
              clearInterval(poll);
              clearTimeout(timeoutId);
              resolve(viewerComp.child);
            }
          }, 100);
          setTimeout(() => clearInterval(poll), 20000);
        }
      });

      // ObsidianViewer = child.pdfViewer
      const obsViewer: any = child?.pdfViewer;

      // 3. 方案 A：从 PDFOutlineViewer 读取已解析的目录树（最可靠）
      const outlineViewer: any = obsViewer?.pdfOutlineViewer;
      if (outlineViewer) {
        // 等待 outline 加载完毕
        for (let i = 0; i < 100; i++) {
          const items = outlineViewer.allItems ?? outlineViewer.children;
          if (Array.isArray(items) && items.length > 0) break;
          await new Promise(r => setTimeout(r, 100));
        }

        const topNodes: any[] = outlineViewer.children;
        if (Array.isArray(topNodes) && topNodes.length > 0) {
          const results: Array<{ title: string; pageNumber: number; path: string[] }> = [];

          const walkTree = async (nodes: any[], ancestors: string[]) => {
            for (const node of nodes) {
              const title = String(node?.item?.title || '').trim() || '目录';
              const nextPath = [...ancestors, title];
              let pageNumber = 0;
              try {
                if (typeof node.pageNumber === 'number' && node.pageNumber > 0) {
                  pageNumber = node.pageNumber;
                } else if (typeof node.getPageNumber === 'function') {
                  pageNumber = await node.getPageNumber();
                }
              } catch {}
              results.push({ title, pageNumber: pageNumber > 0 ? pageNumber : 0, path: nextPath });
              if (Array.isArray(node.children) && node.children.length > 0) {
                await walkTree(node.children, nextPath);
              }
            }
          };

          await walkTree(topNodes, []);
          logger.debug('[MaterialImportModal] 通过 PDFOutlineViewer 获取目录:', {
            pdf: pdfFile.path,
            count: results.length
          });
          if (results.length > 0) return results;
        }
      }

      // 4. 方案 B：通过 pdfLoadingTask 获取 PDFDocumentProxy，调用 getOutline()
      let pdfDocument: any = null;
      try {
        if (obsViewer?.pdfLoadingTask?.promise) {
          pdfDocument = await Promise.race([
            obsViewer.pdfLoadingTask.promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('pdfLoadingTask 超时')), 15000))
          ]);
        }
      } catch {}

      // 兜底：从内层 PDF.js PDFViewer 取
      if (!pdfDocument) {
        pdfDocument = obsViewer?.pdfViewer?.pdfDocument;
      }

      if (!pdfDocument?.getOutline) {
        logger.debug('[MaterialImportModal] 未获取到 pdfDocument:', {
          pdf: pdfFile.path,
          hasChild: !!child,
          hasObsViewer: !!obsViewer,
          obsViewerKeys: obsViewer ? Object.keys(obsViewer).slice(0, 25) : []
        });
        return [];
      }

      let outline: any[];
      try { outline = await pdfDocument.getOutline(); } catch { outline = []; }
      if (!Array.isArray(outline) || outline.length === 0) return [];

      logger.debug('[MaterialImportModal] 通过 pdfDocument.getOutline 获取目录:', {
        pdf: pdfFile.path,
        topLevelCount: outline.length
      });

      const results: Array<{ title: string; pageNumber: number; path: string[] }> = [];

      const resolvePageNumber = async (item: any): Promise<number> => {
        if (typeof item?.pageNumber === 'number' && item.pageNumber > 0) return item.pageNumber;
        const dest = item?.dest;
        if (!dest) return 0;
        try {
          const destArray = typeof dest === 'string' ? await pdfDocument.getDestination(dest) : dest;
          if (!Array.isArray(destArray) || destArray.length === 0) return 0;
          const idx = await pdfDocument.getPageIndex(destArray[0]);
          return typeof idx === 'number' && !Number.isNaN(idx) ? idx + 1 : 0;
        } catch { return 0; }
      };

      const walkRaw = async (items: any[], ancestors: string[]) => {
        for (const it of items) {
          const title = String(it?.title || '').trim() || '目录';
          const nextPath = [...ancestors, title];
          const pageNumber = await resolvePageNumber(it);
          results.push({ title, pageNumber, path: nextPath });
          const children = it?.items ?? it?.children;
          if (Array.isArray(children) && children.length > 0) {
            await walkRaw(children, nextPath);
          }
        }
      };

      await walkRaw(outline, []);
      return results;
    } catch (e) {
      logger.warn('[MaterialImportModal] PDF 目录提取异常:', e);
      return [];
    } finally {
      try {
        if (createdLeaf) {
          leaf?.detach?.();
        }
      } catch {}
    }
  }

  function handleSplitModeSelect(mode: SplitMode): void {
    splitMode = mode;
    currentStep = 'configure';
  }

  function goBack(): void {
    switch (currentStep) {
      case 'split-mode':
        currentStep = 'select';
        splitMode = null;
        selectedFilePaths = [];
        break;
      case 'configure':
        currentStep = 'split-mode';
        break;
      case 'preview':
        if (isPdfImportMode) {
          currentStep = 'select';
          splitMode = null;
          selectedFilePath = null;
          selectedFilePaths = [];
          contentBlocks = [];
          isPdfImportMode = false;
        } else {
          currentStep = 'configure';
        }
        break;
    }
  }

  async function handleRuleConfigConfirm(): Promise<void> {
    if (isMultiFileMode) {
      // 批量模式：读取所有文件并生成预览
      await generateBatchPreview();
    } else {
      // 单文件模式：直接拆分当前文件
      let defaultTitle: string | undefined;
      if (selectedFilePath) {
        const file = plugin.app.vault.getAbstractFileByPath(selectedFilePath);
        if (file instanceof TFile) {
          defaultTitle = file.basename;
        }
      }

      contentBlocks = splitByRules(fileContent, ruleSplitConfig, { defaultTitle }).map(block => ({
        ...block,
        sourceFilePath: selectedFilePath || undefined
      }));
      currentStep = 'preview';
    }
  }

  async function generateBatchPreview(): Promise<void> {
    try {
      const allBlocks: ImportContentBlock[] = [];

      for (const filePath of selectedFilePaths) {
        const file = plugin.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          const content = await plugin.app.vault.read(file);
          const blocks = splitByRules(content, ruleSplitConfig, { defaultTitle: file.basename });

          // 为每个块添加文件来源信息
          blocks.forEach(block => {
            allBlocks.push({
              ...block,
              title: block.title ? `${file.basename} - ${block.title}` : file.basename,
              sourceFilePath: file.path
            });
          });
        }
      }

      contentBlocks = allBlocks;
      currentStep = 'preview';
    } catch (error) {
      logger.error('[MaterialImportModal] 生成批量预览失败:', error);
    }
  }

  function handleManualEditConfirm(): void {
    contentBlocks = parseManualSplitMarkers(editedContent).map(block => ({
      ...block,
      sourceFilePath: selectedFilePath || undefined
    }));
    currentStep = 'preview';
  }

  async function handleBatchImport(): Promise<void> {
    if (selectedFilePaths.length === 0 || !selectedDeckId) return;

    if (isPdfImportMode) {
      await handlePdfBookmarkTaskImport();
      return;
    }
    
    importing = true;
    importProgress = { current: 0, total: selectedFilePaths.length };

    try {
      const result = await addImportedBlocksAsFiles(selectedFilePaths);
      onImportComplete({ success: result.successCount, skipped: 0, errors: result.errorCount > 0 ? [{ path: '', error: `${result.errorCount} 个文件导入失败` }] : [] });
      onClose();
    } catch (error) {
      logger.error('[MaterialImportModal] 批量导入失败:', error);
      onImportComplete({ success: 0, skipped: 0, errors: [{ path: '', error: String(error) }] });
      onClose();
    } finally {
      importing = false;
    }
  }

  async function handleSingleFileImport(): Promise<void> {
    if (!selectedFilePath || contentBlocks.length === 0 || !selectedDeckId) return;

    if (isPdfImportMode) {
      await handlePdfBookmarkTaskImport();
      return;
    }
    
    importing = true;
    
    try {
      const result = await addImportedBlocksAsFiles([selectedFilePath]);
      onImportComplete({ success: result.successCount, skipped: 0, errors: result.errorCount > 0 ? [{ path: selectedFilePath || '', error: '导入失败' }] : [] });
      onClose();
    } catch (error) {
      logger.error('[MaterialImportModal] 导入失败:', error);
      onImportComplete({ success: 0, skipped: 0, errors: [{ path: selectedFilePath || '', error: String(error) }] });
      onClose();
    } finally {
      importing = false;
    }
  }

  // Obsidian Menu API 实现
  const STRATEGY_OPTIONS = [
    { value: 'even', label: '均分' },
    { value: 'balanced', label: '均衡' },
    { value: 'front-loaded', label: '尽快' }
  ] as const;

  function showSchedulingDaysMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    Object.entries(SCHEDULING_PRESETS).forEach(([key, preset]) => {
      menu.addItem((item) => {
        item
          .setTitle(preset.label)
          .setChecked(!useCustomDays && schedulingConfig.distributionDays === preset.days)
          .onClick(() => {
            useCustomDays = false;
            schedulingConfig.distributionDays = preset.days;
          });
      });
    });
    
    menu.addItem((item) => {
      item
        .setTitle('自定义')
        .setChecked(useCustomDays)
        .onClick(() => {
          useCustomDays = true;
          schedulingConfig.distributionDays = customDaysValue;
        });
    });
    
    menu.showAtMouseEvent(evt);
  }

  function showSchedulingStrategyMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    STRATEGY_OPTIONS.forEach(option => {
      menu.addItem((item) => {
        item
          .setTitle(option.label)
          .setChecked(schedulingConfig.strategy === option.value)
          .onClick(() => {
            schedulingConfig.strategy = option.value;
          });
      });
    });
    
    menu.showAtMouseEvent(evt);
  }

  function showDeckSelectMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    availableDecks.forEach(deck => {
      menu.addItem((item) => {
        item
          .setTitle(`${deck.icon} ${deck.name}`)
          .setChecked(selectedDeckId === deck.id)
          .onClick(() => {
            selectedDeckId = deck.id;
          });
      });
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item
        .setTitle('新建牌组')
        .setIcon('plus')
        .onClick(() => {
          showNewDeckInput = true;
        });
    });
    
    menu.showAtMouseEvent(evt);
  }

  function getSchedulingDaysLabel(): string {
    if (useCustomDays) return `${customDaysValue}天`;
    const preset = Object.values(SCHEDULING_PRESETS).find(p => p.days === schedulingConfig.distributionDays);
    return preset?.label || `${schedulingConfig.distributionDays}天`;
  }

  function getStrategyLabel(): string {
    const option = STRATEGY_OPTIONS.find(o => o.value === schedulingConfig.strategy);
    return option?.label || '均衡';
  }

  function getSelectedDeckLabel(): string {
    const deck = availableDecks.find(d => d.id === selectedDeckId);
    return deck ? `${deck.icon} ${deck.name}` : '选择牌组';
  }
  
  /**
   * v5.0 文件化块导入：生成独立的 MD 文件
   */
  async function addImportedBlocksAsFiles(filePaths: string[]): Promise<{ successCount: number; errorCount: number; chunkCount: number }> {
    try {
      await services.init();
      
      // 初始化文件化块服务
      if (!chunkFileService) {
        const outputRoot = plugin.settings?.incrementalReading?.importFolder;
        chunkFileService = new IRChunkFileService(plugin.app, outputRoot);
      }
      
      // v5.5: 获取选中牌组的信息，构建 deckTag
      const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);
      const deckTag = selectedDeck ? `#IR_deck_${selectedDeck.name}` : '#IR_deck_未分配';
      const deckNames = selectedDeck ? [selectedDeck.name] : ['未分配'];

      if (!irTagGroupService) {
        const pluginAny = plugin as any;
        const service = pluginAny.irTagGroupService ?? new IRTagGroupService(plugin.app);
        irTagGroupService = service;
        await service.initialize();
        pluginAny.irTagGroupService = service;
      }

      const tagGroupService = irTagGroupService;
      if (!tagGroupService) {
        throw new Error('[MaterialImportModal] IRTagGroupService 初始化失败');
      }
      
      logger.info(`[MaterialImportModal] 开始文件化块导入: ${filePaths.length} 个文件, 牌组: ${selectedDeck?.name || '未分配'}`);
      logger.info(`[MaterialImportModal] ruleSplitConfig: ${JSON.stringify(ruleSplitConfig)}`);
      
      const chunkIds: string[] = [];
      let successCount = 0;
      let errorCount = 0;

      let assignments: Map<ContentBlock, Date> | null = null;
      if (contentBlocks.length > 0) {
        const loadInfo: IRLoadInfo = {
          dailyBudgetMinutes: 60,
          getBlocksForDate: async (date: Date) => {
            const allChunks = await services.storageService?.getAllChunkData() || {};
            const chunks = Object.values(allChunks);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            return chunks.filter((chunk: any) => {
              if (!chunk.nextRepDate) return false;
              if (chunk.scheduleStatus === 'done' || chunk.scheduleStatus === 'suspended' || chunk.scheduleStatus === 'removed') return false;
              const d = new Date(chunk.nextRepDate);
              return d >= startOfDay && d <= endOfDay;
            }) as any;
          },
          estimateBlockMinutes: (block: any) => {
            const charCount = 'content' in block ? block.content.length : ('charCount' in block ? block.charCount : 500);
            return Math.max(1, Math.ceil(charCount / 500));
          }
        };

        if (!schedulingService) {
          schedulingService = new IRImportSchedulingService(loadInfo);
        }

        schedulingImpact = await schedulingService.calculateScheduling(
          contentBlocks,
          schedulingConfig
        );
        assignments = schedulingService.applyScheduling(contentBlocks, schedulingImpact);
      }
      
      const books = new Map<string, {
        bookTitle: string;
        bookIndexPath: string;
        chapterEntries: Array<{
          title: string;
          indexPath: string;
          chunkEntries: Array<{ title: string; filePath: string }>;
        }>;
      }>();

      const filesByBook = new Map<string, TFile[]>();
      
      for (const filePath of filePaths) {
        const file = plugin.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          const derivedBookName = getBookNameForFilePath(file.path);
          const bookName = derivedBookName || file.parent?.name || 'Unsorted';
          if (!filesByBook.has(bookName)) {
            filesByBook.set(bookName, []);
          }
          filesByBook.get(bookName)!.push(file);
        }
      }
      
      let processedCount = 0;
      for (const [bookName, bookFiles] of filesByBook) {
        for (let i = 0; i < bookFiles.length; i++) {
          const originalFile = bookFiles[i];
          processedCount++;
          importProgress = { current: processedCount, total: filePaths.length };
          
          try {
            logger.info(`[MaterialImportModal] 正在导入: ${originalFile.basename} (书籍: ${bookName})`);

            let matchedTagGroup = 'default';
            try {
              matchedTagGroup = await tagGroupService!.matchGroupForDocument(originalFile.path, true);
            } catch (error) {
              logger.warn('[MaterialImportModal] 标签组匹配失败，回退 default:', error);
              matchedTagGroup = 'default';
            }
            
            const useManualBlocks = splitMode === 'manual' && filePaths.length === 1;
            const result = useManualBlocks
              ? await chunkFileService.importFileAsChunksFromBlocks(originalFile, contentBlocks, {
                  splitConfig: ruleSplitConfig,
                  tagGroup: matchedTagGroup,
                  initialPriority: 5,
                  deckTag: deckTag,
                  deckNames: deckNames,
                  bookFolderName: bookName !== 'Unsorted' ? bookName : undefined
                })
              : await chunkFileService.importFileAsChunks(originalFile, {
                  splitConfig: ruleSplitConfig,
                  tagGroup: matchedTagGroup,
                  initialPriority: 5,
                  deckTag: deckTag,
                  deckNames: deckNames,
                  bookFolderName: bookName !== 'Unsorted' ? bookName : undefined
                });
          
          // v5.5: 设置块的 deckIds（使用正式牌组ID）
          if (selectedDeckId) {
            for (const chunkData of result.chunkDataList) {
              chunkData.deckIds = [selectedDeckId];
            }
          }
          
          if (assignments) {
            const normalizedFilePath = normalizePath(originalFile.path);
            const blocksForFile = contentBlocks.filter(b =>
              b.sourceFilePath && normalizePath(b.sourceFilePath) === normalizedFilePath
            );

            const isManualSingleFile = splitMode === 'manual' && filePaths.length === 1;
            const fallbackStartIndex = chunkIds.length;
            const fallbackEndIndex = fallbackStartIndex + result.chunkDataList.length;
            const fallbackBlocks = contentBlocks.slice(fallbackStartIndex, fallbackEndIndex);

            const blocksToUse = isManualSingleFile
              ? contentBlocks
              : (blocksForFile.length > 0 ? blocksForFile : fallbackBlocks);
            const minLen = Math.min(blocksToUse.length, result.chunkDataList.length);

            if (!isManualSingleFile && blocksForFile.length > 0 && blocksForFile.length !== result.chunkDataList.length) {
              logger.warn('[MaterialImportModal] 导入块数量与预览不一致:', {
                file: originalFile.path,
                previewBlocks: blocksForFile.length,
                importedChunks: result.chunkDataList.length
              });
            }

            for (let idx = 0; idx < minLen; idx++) {
              const block = blocksToUse[idx];
              const assignedDate = assignments.get(block);
              if (assignedDate) {
                result.chunkDataList[idx].nextRepDate = assignedDate.getTime();
                result.chunkDataList[idx].intervalDays = 1;
                result.chunkDataList[idx].scheduleStatus = 'queued' as any;
              }
            }
          }
          
          // 保存源材料元数据和块调度数据到存储
          await services.storageService!.saveSource(result.sourceMeta);
          await services.storageService!.saveChunkDataBatch(result.chunkDataList);
          
          // 收集块ID用于添加到牌组
          chunkIds.push(...result.chunkDataList.map(c => c.chunkId));
          successCount++;
          
          const bookKey = bookName || 'Unsorted';
          if (!books.has(bookKey)) {
            books.set(bookKey, {
              bookTitle: bookKey,
              bookIndexPath: result.indexFilePath,
              chapterEntries: []
            });
          }

          const bookAgg = books.get(bookKey)!;
          if (!bookAgg.bookIndexPath) {
            bookAgg.bookIndexPath = result.indexFilePath;
          }
          bookAgg.chapterEntries.push({
            title: originalFile.basename,
            indexPath: result.indexFilePath,
            chunkEntries: result.chunkDataList.map((c, idx) => ({
              title: result.chunkFilePaths[idx]?.replace(/^.*\//, '').replace(/\.md$/, '').replace(/^\d+_/, '') || `块 ${idx + 1}`,
              filePath: result.chunkFilePaths[idx] || ''
            }))
          });
          
          logger.info(`[MaterialImportModal] 文件化块导入成功: ${originalFile.basename}, ${result.chunkDataList.length} 个块文件`);
        } catch (importError) {
          errorCount++;
          logger.error(`[MaterialImportModal] 文件化块导入失败: ${originalFile.path}`, importError);
          // 显示错误通知
          new Notice(`导入失败: ${originalFile.basename} - ${importError instanceof Error ? importError.message : '未知错误'}`);
        }
      }
    }
      
      for (const [bookKey, bookAgg] of books) {
        if (bookAgg.chapterEntries.length === 0 || !bookAgg.bookTitle) continue;
        try {
          // v6.2: 按牌组入口索引卡片组织，不再混写书籍到单一总索引
          await chunkFileService.ensureDeckIndexCard(selectedDeck?.name || '未分配');
          logger.info(`[MaterialImportModal] 牌组入口索引更新成功: ${selectedDeck?.name || '未分配'}`);
        } catch (indexError) {
          logger.warn(`[MaterialImportModal] 牌组入口索引更新失败:`, indexError);
        }
      }
      
      logger.info(`[MaterialImportModal] 文件化块导入完成: 成功 ${successCount}, 失败 ${errorCount}, 共生成 ${chunkIds.length} 个块`);
      
      if (chunkIds.length > 0) {
        new Notice(`导入完成: ${successCount} 个文件, ${chunkIds.length} 个内容块`);
      }
      
      return { successCount, errorCount, chunkCount: chunkIds.length };
    } catch (error) {
      logger.error('[MaterialImportModal] 文件化块导入失败:', error);
      new Notice(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return { successCount: 0, errorCount: filePaths.length, chunkCount: 0 };
    }
  }

  function handleKeydown(_e: KeyboardEvent): void {
  }

  function handleEditorKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      insertManualMarker();
    }
  }

  function resetModalState() {
    currentStep = 'select';
    splitMode = null;
    selectedFilePath = null;
    selectedFilePaths = [];
    selectedRootFolderPaths = [];
    contentBlocks = [];
    fileContent = '';
    editedContent = '';
    previewIndex = 0;
    searchQuery = '';
    showContent = false;
    importing = false;
    importProgress = { current: 0, total: 0 };
    isPdfImportMode = false;
    selectedDeckId = null;
    showNewDeckInput = false;
    newDeckName = '';
    schedulingConfig = { ...DEFAULT_SCHEDULING_CONFIG };
    schedulingImpact = null;
    showSchedulingDetails = false;
    schedulingService = null;
    useCustomDays = false;
    customDaysValue = 21;
    availableDecks = [];
  }

  function initializeTree() {
    const rootFolder = plugin.app.vault.getRoot();
    treeData = [buildTree(rootFolder)];
    initialized = true;
    setTimeout(() => { showContent = true; }, 50);
  }
  
  async function loadAvailableDecks(): Promise<void> {
    try {
      await services.init();
      const decks = await services.deckManager!.getAllDecks();
      availableDecks = decks.filter(d => !d.archivedAt);
      
      // 默认选中第一个牌组（如果有）
      if (availableDecks.length > 0 && !selectedDeckId) {
        selectedDeckId = availableDecks[0].id;
      }
    } catch (error) {
      logger.error('[MaterialImportModal] 加载牌组列表失败:', error);
    }
  }
  
  async function handleCreateNewDeck(): Promise<void> {
    if (!newDeckName.trim() || creatingDeck) return;
    
    creatingDeck = true;
    try {
      await services.init();
      const newDeck = await services.deckManager!.createDeck(newDeckName.trim());
      availableDecks = [...availableDecks, newDeck];
      selectedDeckId = newDeck.id;
      showNewDeckInput = false;
      newDeckName = '';
      logger.info(`[MaterialImportModal] 创建新牌组: ${newDeck.name}`);
    } catch (error) {
      logger.error('[MaterialImportModal] 创建牌组失败:', error);
    } finally {
      creatingDeck = false;
    }
  }
  
  function cancelNewDeck(): void {
    showNewDeckInput = false;
    newDeckName = '';
  }
  
  $effect(() => {
    if (open) {
      resetModalState();
      initializeTree();
    }
  });
  
  // 当进入预览步骤时加载牌组列表 + 预匹配标签组
  $effect(() => {
    if (currentStep === 'preview') {
      loadAvailableDecks();
      preMatchTagGroup();
    }
  });

  async function preMatchTagGroup() {
    if (isPdfImportMode) {
      previewTagGroupName = '';
      return;
    }
    try {
      const pluginAny = plugin as any;
      const service = pluginAny.irTagGroupService ?? new IRTagGroupService(plugin.app);
      if (!pluginAny.irTagGroupService) {
        await service.initialize();
        pluginAny.irTagGroupService = service;
      }
      irTagGroupService = service;

      // 取第一个选中文件进行预匹配
      const firstPath = selectedFilePaths[0] || selectedFilePath;
      if (firstPath) {
        const groupId = await service.matchGroupForDocument(firstPath, true);
        const allGroups = await service.getAllGroups();
        const matched = allGroups.find((g: any) => g.id === groupId);
        previewTagGroupName = matched?.name || (groupId === 'default' ? '默认' : groupId);
      } else {
        previewTagGroupName = '';
      }
    } catch {
      previewTagGroupName = '';
    }
  }

  onDestroy(() => {
    // 清理
  });

  $effect(() => {
    if (currentStep === 'configure' && splitMode === 'manual') {
      document.addEventListener('keydown', handleEditorKeydown);
      return () => {
        document.removeEventListener('keydown', handleEditorKeydown);
      };
    }
  });
</script>

<ResizableModal
  bind:open
  {onClose}
  {plugin}
  title={modalTitle}
  accentColor="cyan"
  enableWindowDrag={true}
  initialWidth={currentStep === 'select' ? 520 : 680}
  initialHeight={560}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="material-import-modal" onclick={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()}>
    {#if currentStep !== 'select'}
      <div class="step-indicator">
        <div class="step" class:completed={true} class:active={false}>
          <span class="step-num">1</span>
          <span class="step-label">选择</span>
        </div>
        <div class="step-line"></div>
        <div class="step" class:completed={currentStep === 'configure' || currentStep === 'preview'} class:active={currentStep === 'split-mode'}>
          <span class="step-num">2</span>
          <span class="step-label">{isPdfImportMode ? '目录' : '拆分'}</span>
        </div>
        <div class="step-line"></div>
        <div class="step" class:active={currentStep === 'configure' || currentStep === 'preview'}>
          <span class="step-num">3</span>
          <span class="step-label">确认</span>
        </div>
      </div>
    {/if}

    {#if currentStep === 'select'}
      <div class="step-content">
        <div class="search-bar">
          <ObsidianIcon name="search" size={16} />
          <input 
            type="text" 
            placeholder="搜索文件..." 
            bind:value={searchQuery}
            class="search-input"
          />
          {#if searchQuery}
            <button class="btn-icon-sm" onclick={() => searchQuery = ''}>
              <ObsidianIcon name="x" size={14} />
            </button>
          {/if}
        </div>

        <div class="toolbar">
          <span class="info-text">
            已选择 <strong>{selectedCount}</strong> 个文件
          </span>
        </div>

        <div class="tree-container">
          {#if filteredTreeData.length === 0}
            <div class="empty-state">
              <ObsidianIcon name={searchQuery ? 'search-x' : 'file-question'} size={32} />
              <p class="empty-text">{searchQuery ? '未找到匹配的文件' : '没有可导入的文件'}</p>
              <p class="empty-hint-text">{searchQuery ? '请尝试其他关键词' : 'Vault 中没有 Markdown / PDF 文件'}</p>
            </div>
          {:else}
            {#each filteredTreeData as node (node.path)}
              {@render TreeNodeComponent(node, 0)}
            {/each}
          {/if}
        </div>
      </div>

      <footer class="modal-footer">
        {#if importing}
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {importProgress.total > 0 ? (importProgress.current / importProgress.total * 100) : 0}%"></div>
            </div>
            <span class="progress-text">正在导入 {importProgress.current}/{importProgress.total}</span>
          </div>
        {:else}
          <button class="btn-primary" onclick={goToSplitModeStep} disabled={selectedCount === 0}>
            下一步 ({selectedCount})
            <ObsidianIcon name="arrow-right" size={14} />
          </button>
        {/if}
      </footer>

    {:else if currentStep === 'split-mode'}
      <div class="step-content">
        <div class="section-header">
          <h4 class="section-title">选择拆分方式</h4>
          {#if isMultiFileMode}
            <span class="badge">批量处理 {selectedFilePaths.length} 个文件</span>
          {/if}
        </div>

        <div class="mode-list">
          <button class="mode-card" onclick={() => handleSplitModeSelect('rule')}>
            <div class="mode-icon">
              <ObsidianIcon name="list-tree" size={24} />
            </div>
            <div class="mode-info">
              <div class="mode-name">规则拆分</div>
            </div>
            <ObsidianIcon name="chevron-right" size={18} />
          </button>

          {#if !isMultiFileMode}
            <button class="mode-card" onclick={() => handleSplitModeSelect('manual')}>
              <div class="mode-icon">
                <ObsidianIcon name="scissors" size={24} />
              </div>
              <div class="mode-info">
                <div class="mode-name">手动拆分</div>
              </div>
              <ObsidianIcon name="chevron-right" size={18} />
            </button>
          {/if}
        </div>
      </div>

      <footer class="modal-footer modal-footer-row">
        <button class="btn-secondary btn-compact" onclick={goBack}>
          <ObsidianIcon name="arrow-left" size={14} />
          上一步
        </button>
      </footer>

    {:else if currentStep === 'configure' && splitMode === 'rule'}
      <div class="step-content">
        <div class="section-header">
          <h4 class="section-title">配置拆分规则</h4>
        </div>

        <div class="config-form">
          <div class="config-group">
            <label class="config-toggle">
              <input type="checkbox" bind:checked={ruleSplitConfig.enableWholeFile} />
              <span class="toggle-label">整个文件作为一个块</span>
            </label>
            {#if ruleSplitConfig.enableWholeFile}
              <div class="config-options">
                <span class="option-hint">每个文件将作为一个完整的内容块，不进行拆分</span>
              </div>
            {/if}
          </div>

          <div class="config-group">
            <label class="config-toggle">
              <input type="checkbox" bind:checked={ruleSplitConfig.enableHeadingSplit} disabled={ruleSplitConfig.enableWholeFile} />
              <span class="toggle-label">按标题拆分</span>
            </label>
            {#if ruleSplitConfig.enableHeadingSplit}
              <div class="config-options">
                <span class="option-label">标题级别:</span>
                <div class="checkbox-group">
                  {#each [1, 2, 3, 4, 5, 6] as level}
                    <label class="checkbox-item">
                      <input 
                        type="checkbox" 
                        checked={ruleSplitConfig.headingLevels.includes(level)}
                        onchange={() => {
                          if (ruleSplitConfig.headingLevels.includes(level)) {
                            ruleSplitConfig.headingLevels = ruleSplitConfig.headingLevels.filter(l => l !== level);
                          } else {
                            ruleSplitConfig.headingLevels = [...ruleSplitConfig.headingLevels, level].sort();
                          }
                        }}
                      />
                      <span>H{level}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <div class="config-group">
            <label class="config-toggle">
              <input type="checkbox" bind:checked={ruleSplitConfig.enableBlankLineSplit} disabled={ruleSplitConfig.enableWholeFile} />
              <span class="toggle-label">按空行拆分</span>
            </label>
            {#if ruleSplitConfig.enableBlankLineSplit}
              <div class="config-options">
                <span class="option-label">连续空行数:</span>
                <input type="number" class="input-number" min="1" max="10" bind:value={ruleSplitConfig.blankLineCount} />
              </div>
            {/if}
          </div>

          <div class="config-group">
            <label class="config-toggle">
              <input type="checkbox" bind:checked={ruleSplitConfig.enableSymbolSplit} disabled={ruleSplitConfig.enableWholeFile} />
              <span class="toggle-label">按符号拆分</span>
            </label>
            {#if ruleSplitConfig.enableSymbolSplit}
              <div class="config-options">
                <span class="option-label">分隔符:</span>
                <input type="text" class="input-text" bind:value={ruleSplitConfig.splitSymbol} placeholder="例如: ---" />
              </div>
            {/if}
          </div>

          <div class="config-group">
            <label class="config-toggle">
              <input type="checkbox" bind:checked={ruleSplitConfig.filterEmptyBlocks} />
              <span class="toggle-label">过滤空内容块</span>
            </label>
          </div>

          <div class="config-group">
            <label class="config-toggle">
              <input type="checkbox" bind:checked={ruleSplitConfig.preserveHeadingAsTitle} />
              <span class="toggle-label">保留标题作为内容块标题</span>
            </label>
          </div>

          <div class="config-group">
            <div class="config-options">
              <span class="option-label">最小字符数:</span>
              <input type="number" class="input-number" min="0" max="1000" bind:value={ruleSplitConfig.minBlockCharCount} />
            </div>
          </div>
        </div>
      </div>

      <footer class="modal-footer modal-footer-row">
        <button class="btn-secondary btn-compact" onclick={goBack}>
          <ObsidianIcon name="arrow-left" size={14} />
          上一步
        </button>
        <button class="btn-primary btn-compact" onclick={handleRuleConfigConfirm}>
          下一步
          <ObsidianIcon name="arrow-right" size={14} />
        </button>
      </footer>

    {:else if currentStep === 'configure' && splitMode === 'manual'}
      <div class="step-content editor-step">
        <div class="section-header">
          <h4 class="section-title">手动拆分</h4>
          <button class="btn-outline" onclick={insertManualMarker}>
            <ObsidianIcon name="plus" size={14} />
            插入拆分标记
          </button>
        </div>

        <div class="editor-hint">
          <ObsidianIcon name="info" size={14} />
          <span>将光标放在需要拆分的位置，按 <kbd>Ctrl+Shift+D</kbd> 或点击按钮插入拆分标记</span>
        </div>

        <div class="editor-container">
          <textarea
            bind:this={textareaEl}
            bind:value={editedContent}
            class="content-editor"
            placeholder="文件内容为空..."
            spellcheck="false"
          ></textarea>
        </div>

        <div class="editor-stats">
          <span class="stat-item">
            <ObsidianIcon name="scissors" size={14} />
            已标记 <strong>{getMarkerCount(editedContent)}</strong> 个拆分位置
          </span>
          <span class="stat-divider"></span>
          <span class="stat-item">
            将生成 <strong>{getMarkerCount(editedContent) + 1}</strong> 个内容块
          </span>
        </div>
      </div>

      <footer class="modal-footer modal-footer-row">
        <button class="btn-secondary btn-compact" onclick={goBack}>
          <ObsidianIcon name="arrow-left" size={14} />
          上一步
        </button>
        <button class="btn-primary btn-compact" onclick={handleManualEditConfirm}>
          下一步
          <ObsidianIcon name="arrow-right" size={14} />
        </button>
      </footer>

    {:else if currentStep === 'preview'}
      <div class="step-content preview-step">
        {#if isPdfImportMode}
          <div class="section-header">
            <h4 class="section-title">PDF 目录预览</h4>
            <span class="badge">{contentBlocks.length} 个书签</span>
          </div>
          <div class="pdf-outline-list">
            {#if contentBlocks.length === 0}
              <div class="empty-state">
                <ObsidianIcon name="file-question" size={32} />
                <p class="empty-text">未获取到 PDF 目录</p>
                <p class="empty-hint-text">该 PDF 可能没有嵌入目录信息</p>
              </div>
            {:else}
              {#each contentBlocks as block, i}
                <div class="outline-item">
                  <span class="outline-index">{i + 1}</span>
                  <span class="outline-title">{block.title || 'PDF'}</span>
                  {#if (block as any).pdfPageNumber}
                    <span class="outline-page">p.{(block as any).pdfPageNumber}</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {:else}
          <div class="preview-header">
            <button class="btn-icon" onclick={() => previewIndex = Math.max(0, previewIndex - 1)} disabled={previewIndex === 0}>
              <ObsidianIcon name="chevron-left" size={18} />
            </button>
            <span class="nav-info">
              <strong>{previewIndex + 1}</strong> / {contentBlocks.length}
            </span>
            <button class="btn-icon" onclick={() => previewIndex = Math.min(contentBlocks.length - 1, previewIndex + 1)} disabled={previewIndex === contentBlocks.length - 1}>
              <ObsidianIcon name="chevron-right" size={18} />
            </button>
            <span class="preview-count">共 {contentBlocks.length} 个内容块</span>
            {#if previewTagGroupName}
              <span class="preview-tag-group">
                <ObsidianIcon name="tag" size={12} />
                {previewTagGroupName}
              </span>
            {/if}
          </div>

          <div class="preview-container">
            {#if contentBlocks.length > 0}
              <div class="preview-cards-wrapper">
                <div class="preview-card">
                  <div class="card-header">
                    <div class="card-meta-badges">
                      <span class="meta-badge">
                        <ObsidianIcon name="type" size={12} />
                        {contentBlocks[previewIndex]?.charCount || 0} 字
                      </span>
                      <span class="meta-badge">
                        <ObsidianIcon name="hash" size={12} />
                        {previewIndex + 1}
                      </span>
                    </div>
                  </div>

                  <div class="card-content">
                    <div class="content-scroll">
                      <pre class="preview-text">{contentBlocks[previewIndex]?.content || ''}</pre>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <footer class="modal-footer modal-footer-preview">
        <button class="btn-secondary btn-compact" onclick={goBack}>
          <ObsidianIcon name="arrow-left" size={14} />
          上一步
        </button>
        
        <!-- 时间分散选择器 -->
        <div class="scheduling-selector">
            <div class="selector-row">
              <span class="selector-label">分散到:</span>
              <button class="menu-trigger" onclick={showSchedulingDaysMenu}>
                {getSchedulingDaysLabel()}
                <ObsidianIcon name="chevron-down" size={12} />
              </button>
              {#if useCustomDays}
                <input 
                  type="number" 
                  class="custom-days-input" 
                  min="1" 
                  max="90"
                  placeholder="天数"
                  value={customDaysValue}
                  oninput={(e) => {
                    customDaysValue = parseInt(e.currentTarget.value) || 14;
                    schedulingConfig.distributionDays = customDaysValue;
                  }}
                />
              {/if}
              <button class="menu-trigger" onclick={showSchedulingStrategyMenu}>
                {getStrategyLabel()}
                <ObsidianIcon name="chevron-down" size={12} />
              </button>
              <button 
                class="btn-icon-sm" 
                onclick={() => {
                  showSchedulingDetails = !showSchedulingDetails;
                  if (!schedulingImpact) {
                    calculateSchedulingImpact();
                  }
                }} 
                title="查看分散详情"
              >
                <ObsidianIcon name="info" size={14} />
              </button>
            </div>
            {#if showSchedulingDetails}
              <div class="scheduling-impact-summary">
                {#if schedulingImpact}
                  <span class="impact-item">
                    <ObsidianIcon name="alert-triangle" size={12} />
                    超载天数: <strong>{schedulingImpact.overloadedDays}</strong>
                  </span>
                  <span class="impact-item">
                    <ObsidianIcon name="trending-up" size={12} />
                    峰值负载: <strong>{Math.round(schedulingImpact.peakLoadRate * 100)}%</strong>
                  </span>
                {:else}
                  <span class="impact-item">正在计算分散影响...</span>
                {/if}
              </div>
            {/if}
          </div>
          
          <!-- 牌组选择器 -->
          <div class="deck-selector">
            {#if showNewDeckInput}
              <div class="new-deck-input">
                <input
                  type="text"
                  class="input-text deck-name-input"
                  placeholder="输入牌组名称..."
                  bind:value={newDeckName}
                  onkeydown={(e) => e.key === 'Enter' && handleCreateNewDeck()}
                />
                <button class="btn-icon-sm" onclick={handleCreateNewDeck} disabled={creatingDeck || !newDeckName.trim()}>
                  <ObsidianIcon name="check" size={14} />
                </button>
                <button class="btn-icon-sm" onclick={cancelNewDeck}>
                  <ObsidianIcon name="x" size={14} />
                </button>
              </div>
            {:else}
              <button class="menu-trigger deck-trigger" onclick={showDeckSelectMenu}>
                {getSelectedDeckLabel()}
                <ObsidianIcon name="chevron-down" size={12} />
              </button>
            {/if}
        </div>
        
        <div class="footer-actions">
          <button class="btn-secondary btn-compact btn-back-mobile" onclick={goBack}>
            <ObsidianIcon name="arrow-left" size={14} />
            上一步
          </button>
          <button class="btn-primary btn-compact" onclick={isMultiFileMode ? handleBatchImport : handleSingleFileImport} disabled={contentBlocks.length === 0 || importing || !selectedDeckId}>
            {#if importing}
              导入中...
            {:else}
              确认导入
              <ObsidianIcon name="check" size={14} />
            {/if}
          </button>
        </div>
      </footer>
    {/if}
  </div>
</ResizableModal>

{#snippet TreeNodeComponent(node: TreeNode, depth: number)}
  <div class="tree-node" style="--depth: {depth}">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <svelte:element
      this={node.type === 'folder' ? 'button' : 'div'}
      class="node-row"
      class:selected={node.selected}
      class:indeterminate={node.indeterminate}
      type={node.type === 'folder' ? 'button' : undefined}
      tabindex={node.type === 'folder' ? undefined : -1}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('.checkbox-wrapper')) return;
        const realNode = findNodeByPath(treeData, node.path) ?? node;
        if (realNode.type === 'folder') {
          toggleExpand(realNode);
        } else {
          toggleSelect(realNode);
        }
      }}
    >
      {#if node.type === 'folder'}
        <span class="expand-icon" class:expanded={node.expanded}>
          <ObsidianIcon name="chevron-right" size={14} />
        </span>
      {/if}

      <label class="checkbox-wrapper">
        <input 
          type="checkbox" 
          checked={node.selected}
          indeterminate={node.indeterminate}
          onchange={() => toggleSelect(node)}
        />
        <span class="checkbox-box"></span>
      </label>

      <span class="node-icon">
        {#if node.type === 'folder'}
          <ObsidianIcon name={node.expanded ? 'folder-open' : 'folder'} size={16} />
        {:else}
          {@const ext = (node.path.split('.').pop() || '').toLowerCase()}
          <ObsidianIcon name={ext === 'pdf' ? 'file' : 'file-text'} size={16} />
        {/if}
      </span>
      
      <span class="node-name" title={node.path}>{node.name}</span>

      {#if node.type === 'folder'}
        <span class="node-count">{countSelectedFiles([node])}/{countTotalFiles([node])}</span>
      {/if}
    </svelte:element>

    {#if node.type === 'folder' && node.expanded && node.children.length > 0}
      <div class="node-children">
        {#each node.children as child (child.path)}
          {@render TreeNodeComponent(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .material-import-modal {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .step-indicator {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
    padding: 12px 20px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 50px;
  }

  .step-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .step.active .step-num,
  .step.completed .step-num {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .step-label {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    white-space: nowrap;
  }

  .step.active .step-label {
    color: var(--interactive-accent);
    font-weight: 500;
  }

  .step.completed .step-label {
    color: var(--text-normal);
  }

  .step-line {
    width: 40px;
    height: 2px;
    background: var(--background-modifier-border);
    margin-top: 13px;
    flex-shrink: 0;
  }

  .step.completed + .step-line {
    background: var(--interactive-accent);
  }

  .step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .step-content.editor-step {
    max-height: 500px;
  }

  .hint-bar {
    padding: 12px 20px;
    font-size: 13px;
    color: var(--text-muted);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .preview-header {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .preview-header .btn-icon {
    flex-shrink: 0;
  }

  .preview-header .nav-info {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .preview-count {
    margin-left: auto;
    font-size: 13px;
    color: var(--text-muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .preview-tag-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-accent);
    padding: 2px 8px;
    background: var(--background-secondary);
    border-radius: 4px;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .badge {
    padding: 4px 10px;
    font-size: 12px;
    color: var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb), 0.1);
    border-radius: 12px;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: 14px;
    outline: none;
  }

  .toolbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 8px 20px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    gap: 12px;
  }

  .info-text {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .info-text strong {
    color: var(--interactive-accent);
  }

  .tree-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    min-height: 200px;
    max-height: 380px;
    background: var(--background-primary);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: var(--text-muted);
    text-align: center;
    pointer-events: none;
  }
  
  .empty-text {
    margin: 12px 0 4px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-normal);
  }
  
  .empty-hint-text {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  .tree-node {
    --indent: calc(var(--depth, 0) * 20px);
    border-bottom: none;
    box-shadow: none;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: calc(100% - 16px);
    box-sizing: border-box;
    padding: 6px 16px 6px calc(16px + var(--indent));
    cursor: pointer;
    transition: background 0.15s;
    border-radius: 4px;
    margin: 1px 8px;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    appearance: none;
    box-shadow: none;
    outline: none;
  }

  .node-row:hover {
    background: var(--background-modifier-hover);
  }

  .node-row.selected {
    background: rgba(var(--interactive-accent-rgb), 0.12);
  }

  .node-row.selected:hover {
    background: rgba(var(--interactive-accent-rgb), 0.18);
  }

  .expand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--text-faint);
    transition: transform 0.15s, color 0.15s;
  }

  .node-row:hover .expand-icon {
    color: var(--text-muted);
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .checkbox-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .checkbox-wrapper input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .checkbox-box {
    width: 16px;
    height: 16px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    transition: all 0.15s;
    position: relative;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .checkbox-wrapper:hover .checkbox-box {
    border-color: var(--interactive-accent);
    background: var(--background-primary);
  }

  .checkbox-wrapper input:checked + .checkbox-box {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .checkbox-wrapper input:checked + .checkbox-box::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border: solid var(--text-on-accent);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .node-row.indeterminate .checkbox-box {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .node-row.indeterminate .checkbox-box::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 5px;
    width: 8px;
    height: 2px;
    background: var(--text-on-accent);
  }

  .node-icon {
    display: flex;
    align-items: center;
    color: var(--text-faint);
  }

  .node-row:hover .node-icon {
    color: var(--text-muted);
  }

  .node-row.selected .node-icon {
    color: var(--interactive-accent);
  }

  .node-name {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-count {
    font-size: 11px;
    color: var(--text-faint);
    padding: 2px 8px;
    background: var(--background-modifier-border);
    border-radius: 10px;
  }

  .node-row.selected .node-count {
    background: rgba(var(--interactive-accent-rgb), 0.15);
    color: var(--interactive-accent);
  }

  .node-children {
    display: contents;
  }

  .mode-list {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mode-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    overflow: hidden;
  }

  .mode-card:hover {
    border-color: var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb), 0.05);
  }

  .mode-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    border-radius: 10px;
    background: transparent;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .mode-card:hover .mode-icon {
    color: var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb), 0.1);
    border-color: var(--interactive-accent);
  }

  .mode-info {
    flex: 1;
  }

  .mode-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .config-form {
    padding: 16px 20px;
    overflow-y: auto;
    max-height: 400px;
  }

  .config-group {
    padding: 12px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .config-group:last-child {
    border-bottom: none;
  }

  .config-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    width: fit-content;
  }

  .config-toggle input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .toggle-label {
    font-size: 14px;
    color: var(--text-normal);
  }

  .config-options {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding-left: 26px;
  }

  .option-label {
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text-normal);
    cursor: pointer;
  }

  .checkbox-item input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .input-number {
    width: 70px;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }

  .input-number:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .input-text {
    flex: 1;
    max-width: 200px;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }

  .input-text:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .editor-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--background-primary-alt);
    font-size: 12px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .editor-hint kbd {
    padding: 2px 6px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    font-family: var(--font-monospace);
    font-size: 11px;
    color: var(--text-normal);
  }

  .editor-container {
    flex: 1;
    min-height: 0;
  }

  .content-editor {
    width: 100%;
    height: 100%;
    min-height: 200px;
    padding: 12px 20px;
    border: none;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
  }

  .editor-stats {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 20px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
    font-size: 12px;
    color: var(--text-muted);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-item strong {
    color: var(--interactive-accent);
  }

  .stat-divider {
    width: 1px;
    height: 12px;
    background: var(--background-modifier-border);
  }

  .pdf-outline-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    min-height: 100px;
    max-height: 340px;
  }

  .outline-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background 0.1s;
  }

  .outline-item:last-child {
    border-bottom: none;
  }

  .outline-item:hover {
    background: var(--background-modifier-hover);
  }

  .outline-index {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
  }

  .outline-title {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .outline-page {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-faint);
    padding: 2px 6px;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .preview-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .preview-step {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-cards-wrapper {
    flex: 1;
    padding: 20px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-card {
    width: 100%;
    max-width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .preview-card:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    border-color: var(--interactive-accent);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 20px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .card-meta-badges {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .meta-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .content-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .preview-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }

  .nav-info {
    font-size: 14px;
    color: var(--text-muted);
    min-width: 80px;
    text-align: center;
  }

  .nav-info strong {
    color: var(--interactive-accent);
    font-size: 16px;
  }

  .preview-text {
    margin: 0;
    font-family: var(--font-text);
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-normal);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--background-modifier-border);
    gap: 8px;
    flex-wrap: wrap;
  }

  .modal-footer-row {
    justify-content: flex-start;
  }

  .modal-footer-preview {
    flex-wrap: wrap;
  }

  .footer-right {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-compact {
    padding: 6px 12px;
    font-size: 13px;
  }

  .btn-back-mobile {
    display: none;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .btn-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-icon-sm {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .btn-icon-sm:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .btn-text {
    padding: 4px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-text:hover {
    background: var(--background-secondary);
    color: var(--text-normal);
    border-color: var(--text-muted);
  }

  .btn-outline {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-normal);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-outline:hover {
    background: var(--background-secondary);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary:hover {
    background: var(--background-secondary);
    border-color: var(--text-muted);
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress-bar-container {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.2s;
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* 时间分散选择器样式 */
  .scheduling-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .selector-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .selector-label {
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .scheduling-days-select,
  .scheduling-strategy-select {
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .scheduling-days-select:hover,
  .scheduling-strategy-select:hover {
    border-color: var(--interactive-accent);
  }

  .scheduling-days-select:focus,
  .scheduling-strategy-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
  }

  .custom-days-input {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }

  .custom-days-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .scheduling-impact-summary {
    display: flex;
    gap: 16px;
    padding: 8px 0 4px;
    font-size: 12px;
  }

  .impact-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }

  .impact-item strong {
    color: var(--text-normal);
  }

  /* 牌组选择器样式 */
  .deck-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .deck-select-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
  }

  .deck-select {
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    outline: none;
  }

  .menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .menu-trigger:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-muted);
  }

  .deck-trigger {
    flex: 1;
    justify-content: space-between;
  }

  .new-deck-input {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .deck-name-input {
    width: 150px;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
  }

  .deck-name-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
  }

  @media (max-width: 640px) {
    .modal-footer {
      padding: 10px 12px;
      gap: 8px;
    }

    .modal-footer-row {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 8px;
    }

    .modal-footer-row .btn-compact {
      flex: 1;
      min-width: 0;
      justify-content: center;
      padding: 10px 8px;
      font-size: 13px;
      white-space: nowrap;
    }

    .modal-footer-preview {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .modal-footer-preview > .btn-compact:first-child {
      display: none;
    }

    .scheduling-selector {
      width: 100%;
    }

    .deck-selector {
      width: 100%;
    }

    .footer-actions {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      width: 100%;
      gap: 8px;
    }

    .footer-actions .btn-compact {
      flex: 1;
      justify-content: center;
      padding: 10px 8px;
      font-size: 13px;
    }

    .btn-back-mobile {
      display: flex;
    }

    .selector-row {
      flex-wrap: wrap;
      gap: 8px;
    }

    .scheduling-days-select,
    .scheduling-strategy-select {
      flex: 1 1 80px;
      min-width: 80px;
      font-size: 13px;
      padding: 6px 8px;
    }

    .deck-select-wrapper {
      width: 100%;
      justify-content: space-between;
    }

    .deck-select {
      width: 100%;
      font-size: 13px;
    }

    .new-deck-input {
      width: 100%;
    }

    .deck-name-input {
      width: 100%;
      font-size: 13px;
    }
  }
</style>
