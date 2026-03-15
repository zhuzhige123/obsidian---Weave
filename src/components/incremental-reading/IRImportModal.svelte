<script lang="ts">
  /**
   * 增量阅读导入模态窗
   * 
   * 显示 Obsidian 风格的文件夹/文件列表，支持：
   * - 文件夹展开/折叠
   * - 多选文件夹
   * - 搜索过滤
   * - 显示文件数量
   * 
   * @module components/incremental-reading/IRImportModal
   * @version 1.0.0
   */
  import { onMount } from 'svelte';
  import { TFolder, TFile } from 'obsidian';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import type { WeavePlugin } from '../../main';
  import { logger } from '../../utils/logger';

  interface Props {
    plugin: WeavePlugin;
    open: boolean;
    onClose: () => void;
    onImport: (folderPaths: string[]) => void;
  }

  let { plugin, open, onClose, onImport }: Props = $props();

  // 文件树节点
  interface FileNode {
    path: string;
    name: string;
    isFolder: boolean;
    children: FileNode[];
    fileCount: number;
    expanded: boolean;
    selected: boolean;
  }

  // 状态
  let fileTree = $state<FileNode[]>([]);
  let searchQuery = $state('');
  let selectedCount = $derived(countSelected(fileTree));

  // 统计选中数量
  function countSelected(nodes: FileNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.selected && node.isFolder) count++;
      count += countSelected(node.children);
    }
    return count;
  }

  // 构建文件树
  function buildFileTree(): FileNode[] {
    const root = plugin.app.vault.getRoot();
    return buildNodeChildren(root);
  }

  function buildNodeChildren(folder: TFolder): FileNode[] {
    const nodes: FileNode[] = [];

    for (const child of folder.children) {
      // 跳过隐藏文件夹
      if (child.name.startsWith('.')) continue;

      if (child instanceof TFolder) {
        const mdFiles = countMdFiles(child);
        nodes.push({
          path: child.path,
          name: child.name,
          isFolder: true,
          children: buildNodeChildren(child),
          fileCount: mdFiles,
          expanded: false,
          selected: false
        });
      } else if (child instanceof TFile && child.extension === 'md') {
        nodes.push({
          path: child.path,
          name: child.name,
          isFolder: false,
          children: [],
          fileCount: 0,
          expanded: false,
          selected: false
        });
      }
    }

    // 排序：文件夹在前，文件在后
    return nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // 统计文件夹内的 MD 文件数
  function countMdFiles(folder: TFolder): number {
    let count = 0;
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        count++;
      } else if (child instanceof TFolder) {
        count += countMdFiles(child);
      }
    }
    return count;
  }

  // 切换展开状态
  function toggleExpand(node: FileNode) {
    node.expanded = !node.expanded;
    fileTree = [...fileTree]; // 触发更新
  }

  // 切换选中状态
  function toggleSelect(node: FileNode) {
    node.selected = !node.selected;
    fileTree = [...fileTree]; // 触发更新
  }

  // 全选
  function selectAll() {
    const toggleAll = (nodes: FileNode[], selected: boolean) => {
      for (const node of nodes) {
        if (node.isFolder && node.fileCount > 0) {
          node.selected = selected;
        }
        toggleAll(node.children, selected);
      }
    };
    
    const allSelected = selectedCount > 0;
    toggleAll(fileTree, !allSelected);
    fileTree = [...fileTree];
  }

  // 过滤节点
  function filterNodes(nodes: FileNode[], query: string): FileNode[] {
    if (!query) return nodes;
    
    const lowerQuery = query.toLowerCase();
    return nodes.filter(node => {
      const nameMatch = node.name.toLowerCase().includes(lowerQuery);
      const childMatch = node.children.length > 0 && filterNodes(node.children, query).length > 0;
      return nameMatch || childMatch;
    });
  }

  // 过滤后的文件树
  let filteredTree = $derived(filterNodes(fileTree, searchQuery));

  // 确认导入
  function handleImport() {
    const selectedPaths: string[] = [];
    
    const collectSelected = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.selected && node.isFolder) {
          selectedPaths.push(node.path);
        }
        collectSelected(node.children);
      }
    };
    
    collectSelected(fileTree);
    
    if (selectedPaths.length > 0) {
      onImport(selectedPaths);
      onClose();
    }
  }

  // 初始化
  onMount(() => {
    fileTree = buildFileTree();
  });

  // 监听 open 状态变化
  $effect(() => {
    if (open) {
      fileTree = buildFileTree();
    }
  });

  function handleOverlayPointerDown(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

{#if open}
  <div class="ir-import-overlay" onmousedown={handleOverlayPointerDown} role="presentation">
    <div class="ir-import-modal" role="dialog" aria-modal="true" aria-label="导入阅读材料">
      <!-- 头部 -->
      <header class="ir-import-header">
        <div class="ir-import-title">
          <EnhancedIcon name="file-input" size={20} />
          <span>导入阅读材料</span>
        </div>
        <button class="ir-import-close" onclick={onClose}>
          <EnhancedIcon name="x" size={18} />
        </button>
      </header>

      <!-- 提示 -->
      <div class="ir-import-hint">
        选择要导入的文件或文件夹，系统将自动添加阅读标识和调度
      </div>

      <!-- 搜索 -->
      <div class="ir-import-search">
        <EnhancedIcon name="search" size={16} />
        <input
          type="text"
          placeholder="搜索文件..."
          bind:value={searchQuery}
        />
      </div>

      <!-- 工具栏 -->
      <div class="ir-import-toolbar">
        <button class="ir-select-all" onclick={selectAll}>
          {selectedCount > 0 ? '取消全选' : '全选'}
        </button>
        <span class="ir-selected-count">已选择 <strong>{selectedCount}</strong> 个文件夹</span>
      </div>

      <!-- 文件列表 -->
      <div class="ir-import-list">
        {#each filteredTree as node}
          {@render fileNode(node, 0)}
        {/each}
      </div>

      <!-- 底部 -->
      <footer class="ir-import-footer">
        <button class="ir-btn-cancel" onclick={onClose}>取消</button>
        <button 
          class="ir-btn-import" 
          onclick={handleImport}
          disabled={selectedCount === 0}
        >
          <EnhancedIcon name="download" size={16} />
          导入 ({selectedCount})
        </button>
      </footer>
    </div>
  </div>
{/if}

{#snippet fileNode(node: FileNode, depth: number)}
  <div 
    class="ir-file-item"
    class:folder={node.isFolder}
    class:selected={node.selected}
    style="padding-left: {12 + depth * 20}px"
  >
    <!-- 展开箭头（仅文件夹） -->
    {#if node.isFolder && node.children.length > 0}
      <button class="ir-expand-btn" onclick={() => toggleExpand(node)}>
        <EnhancedIcon 
          name={node.expanded ? 'chevron-down' : 'chevron-right'} 
          size={14} 
        />
      </button>
    {:else}
      <span class="ir-expand-spacer"></span>
    {/if}

    <!-- 选择框（仅文件夹且有文件） -->
    {#if node.isFolder && node.fileCount > 0}
      <button 
        class="ir-checkbox"
        class:checked={node.selected}
        onclick={() => toggleSelect(node)}
      >
        {#if node.selected}
          <EnhancedIcon name="check" size={12} />
        {/if}
      </button>
    {:else}
      <span class="ir-checkbox-spacer"></span>
    {/if}

    <!-- 图标 -->
    <span class="ir-file-icon">
      {#if node.isFolder}
        <EnhancedIcon name="folder" size={16} />
      {:else}
        <EnhancedIcon name="file-text" size={16} />
      {/if}
    </span>

    <!-- 名称 -->
    <span class="ir-file-name">{node.name}</span>

    <!-- 文件数（仅文件夹） -->
    {#if node.isFolder}
      <span class="ir-file-count">{node.fileCount}</span>
    {/if}
  </div>

  <!-- 子节点 -->
  {#if node.isFolder && node.expanded}
    {#each node.children as child}
      {@render fileNode(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<style>
  .ir-import-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .ir-import-modal {
    width: 420px;
    max-height: 80vh;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ir-import-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ir-import-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .ir-import-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .ir-import-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ir-import-hint {
    padding: 0.75rem 1.25rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ir-import-search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
  }

  .ir-import-search input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    color: var(--text-normal);
    outline: none;
  }

  .ir-import-search input::placeholder {
    color: var(--text-muted);
  }

  .ir-import-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1.25rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ir-select-all {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: transparent;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .ir-select-all:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ir-selected-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .ir-selected-count strong {
    color: var(--text-accent);
  }

  .ir-import-list {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
  }

  .ir-file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: default;
    transition: background 0.1s;
  }

  .ir-file-item:hover {
    background: var(--background-modifier-hover);
  }

  .ir-file-item.selected {
    background: rgba(139, 92, 246, 0.1);
  }

  .ir-expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .ir-expand-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ir-expand-spacer {
    width: 18px;
    flex-shrink: 0;
  }

  .ir-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 4px;
    background: transparent;
    color: white;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .ir-checkbox:hover {
    border-color: var(--interactive-accent);
  }

  .ir-checkbox.checked {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .ir-checkbox-spacer {
    width: 18px;
    flex-shrink: 0;
  }

  .ir-file-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .ir-file-item.folder .ir-file-icon {
    color: var(--text-accent);
  }

  .ir-file-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ir-file-count {
    font-size: 0.75rem;
    color: var(--text-accent);
    padding: 0.125rem 0.5rem;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .ir-import-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .ir-btn-cancel {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    font-size: 0.875rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .ir-btn-cancel:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ir-btn-import {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: linear-gradient(135deg, #8b5cf6, #ec4899);
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ir-btn-import:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .ir-btn-import:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
