/**
 * 增量阅读导入模态窗 - Obsidian 原生 API 实现
 * 
 * 扁平化设计，显示文件夹和文件列表
 * 
 * @module modals/IRImportModal
 * @version 1.0.0
 */

import { App, Modal, TFolder, TFile, setIcon } from 'obsidian';

interface FileItem {
  path: string;
  name: string;
  isFolder: boolean;
  fileCount: number;
  selected: boolean;
  expanded: boolean;
  children: FileItem[];
}

export class IRImportModal extends Modal {
  private items: FileItem[] = [];
  private selectedPaths: Set<string> = new Set();
  private searchQuery = '';
  private listEl: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private importBtn: HTMLButtonElement | null = null;
  private onImport: (paths: string[]) => void;

  constructor(app: App, onImport: (paths: string[]) => void) {
    super(app);
    this.onImport = onImport;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ir-import-modal');

    // 标题
    const titleEl = contentEl.createDiv({ cls: 'ir-import-title' });
    const titleIcon = titleEl.createSpan({ cls: 'ir-import-title-icon' });
    setIcon(titleIcon, 'file-input');
    titleEl.createSpan({ text: '导入阅读材料' });

    // 提示
    const hintEl = contentEl.createDiv({ cls: 'ir-import-hint' });
    hintEl.setText('选择要导入的文件或文件夹，系统将自动添加阅读标识和调度');

    // 搜索框
    const searchEl = contentEl.createDiv({ cls: 'ir-import-search' });
    const searchIcon = searchEl.createSpan({ cls: 'ir-search-icon' });
    setIcon(searchIcon, 'search');
    const searchInput = searchEl.createEl('input', {
      type: 'text',
      placeholder: '搜索文件...'
    });
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.renderList();
    });

    // 工具栏
    const toolbarEl = contentEl.createDiv({ cls: 'ir-import-toolbar' });
    const selectAllBtn = toolbarEl.createEl('button', { text: '全选', cls: 'ir-select-all-btn' });
    selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
    
    this.countEl = toolbarEl.createSpan({ cls: 'ir-selected-count' });
    this.updateCount();

    // 文件列表
    this.listEl = contentEl.createDiv({ cls: 'ir-import-list' });

    // 底部按钮
    const footerEl = contentEl.createDiv({ cls: 'ir-import-footer' });
    
    const cancelBtn = footerEl.createEl('button', { text: '取消', cls: 'ir-btn-cancel' });
    cancelBtn.addEventListener('click', () => this.close());
    
    this.importBtn = footerEl.createEl('button', { cls: 'ir-btn-import' });
    const importIcon = this.importBtn.createSpan();
    setIcon(importIcon, 'download');
    this.importBtn.createSpan({ text: ' 导入 (0)' });
    this.importBtn.disabled = true;
    this.importBtn.addEventListener('click', () => this.handleImport());

    // 加载数据并渲染
    this.loadItems();
    this.renderList();

    // 添加样式
    this.addStyles();
  }

  private loadItems() {
    const root = this.app.vault.getRoot();
    this.items = this.buildItems(root);
  }

  private buildItems(folder: TFolder): FileItem[] {
    const items: FileItem[] = [];

    for (const child of folder.children) {
      if (child.name.startsWith('.')) continue;

      if (child instanceof TFolder) {
        const fileCount = this.countMdFiles(child);
        items.push({
          path: child.path,
          name: child.name,
          isFolder: true,
          fileCount,
          selected: false,
          expanded: false,
          children: this.buildItems(child)
        });
      } else if (child instanceof TFile && child.extension === 'md') {
        items.push({
          path: child.path,
          name: child.name,
          isFolder: false,
          fileCount: 0,
          selected: false,
          expanded: false,
          children: []
        });
      }
    }

    // 文件夹在前
    return items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  private countMdFiles(folder: TFolder): number {
    let count = 0;
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        count++;
      } else if (child instanceof TFolder) {
        count += this.countMdFiles(child);
      }
    }
    return count;
  }

  private renderList() {
    if (!this.listEl) return;
    this.listEl.empty();

    const filteredItems = this.filterItems(this.items, this.searchQuery);
    this.renderItems(filteredItems, this.listEl, 0);
  }

  private filterItems(items: FileItem[], query: string): FileItem[] {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    
    return items.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(lowerQuery);
      const childMatch = item.children.length > 0 && this.filterItems(item.children, query).length > 0;
      return nameMatch || childMatch;
    });
  }

  private renderItems(items: FileItem[], container: HTMLElement, depth: number) {
    for (const item of items) {
      const itemEl = container.createDiv({ cls: 'ir-file-item' });
      itemEl.style.paddingLeft = `${12 + depth * 20}px`;
      
      if (item.selected) {
        itemEl.addClass('selected');
      }

      // 展开箭头
      if (item.isFolder && item.children.length > 0) {
        const expandBtn = itemEl.createSpan({ cls: 'ir-expand-btn' });
        setIcon(expandBtn, item.expanded ? 'chevron-down' : 'chevron-right');
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          item.expanded = !item.expanded;
          this.renderList();
        });
      } else {
        itemEl.createSpan({ cls: 'ir-expand-spacer' });
      }

      // 图标
      const iconEl = itemEl.createSpan({ cls: 'ir-file-icon' });
      setIcon(iconEl, item.isFolder ? 'folder' : 'file-text');
      if (item.isFolder) {
        iconEl.addClass('folder-icon');
      }

      // 名称
      const nameEl = itemEl.createSpan({ cls: 'ir-file-name', text: item.name });

      // 文件数（仅文件夹）
      if (item.isFolder && item.fileCount > 0) {
        const countEl = itemEl.createSpan({ cls: 'ir-file-count', text: String(item.fileCount) });
      }

      // 点击选择（仅文件夹）
      if (item.isFolder && item.fileCount > 0) {
        itemEl.addEventListener('click', () => {
          item.selected = !item.selected;
          if (item.selected) {
            this.selectedPaths.add(item.path);
          } else {
            this.selectedPaths.delete(item.path);
          }
          this.updateCount();
          this.renderList();
        });
        itemEl.style.cursor = 'pointer';
      }

      // 渲染子项
      if (item.isFolder && item.expanded) {
        this.renderItems(item.children, container, depth + 1);
      }
    }
  }

  private toggleSelectAll() {
    const hasSelected = this.selectedPaths.size > 0;
    
    const toggleItems = (items: FileItem[], selected: boolean) => {
      for (const item of items) {
        if (item.isFolder && item.fileCount > 0) {
          item.selected = selected;
          if (selected) {
            this.selectedPaths.add(item.path);
          } else {
            this.selectedPaths.delete(item.path);
          }
        }
        toggleItems(item.children, selected);
      }
    };

    toggleItems(this.items, !hasSelected);
    this.updateCount();
    this.renderList();
  }

  private updateCount() {
    const count = this.selectedPaths.size;
    if (this.countEl) {
      this.countEl.setText(`已选择 ${count} 个文件夹`);
    }
    if (this.importBtn) {
      this.importBtn.disabled = count === 0;
      const textSpan = this.importBtn.querySelector('span:last-child');
      if (textSpan) {
        textSpan.setText(` 导入 (${count})`);
      }
    }
  }

  private handleImport() {
    if (this.selectedPaths.size > 0) {
      this.onImport(Array.from(this.selectedPaths));
      this.close();
    }
  }

  private addStyles() {
    const styleId = 'ir-import-modal-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ir-import-modal {
        padding: 0;
      }
      
      .ir-import-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 20px;
        font-size: 16px;
        font-weight: 600;
        border-bottom: 1px solid var(--background-modifier-border);
      }
      
      .ir-import-title-icon {
        color: var(--text-accent);
      }
      
      .ir-import-hint {
        padding: 12px 20px;
        font-size: 12px;
        color: var(--text-muted);
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.08));
        border-bottom: 1px solid var(--background-modifier-border);
      }
      
      .ir-import-search {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--background-modifier-border);
      }
      
      .ir-search-icon {
        color: var(--text-muted);
      }
      
      .ir-import-search input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        outline: none;
      }
      
      .ir-import-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 20px;
        border-bottom: 1px solid var(--background-modifier-border);
      }
      
      .ir-select-all-btn {
        padding: 4px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: transparent;
        font-size: 12px;
        cursor: pointer;
      }
      
      .ir-select-all-btn:hover {
        background: var(--background-modifier-hover);
      }
      
      .ir-selected-count {
        font-size: 12px;
        color: var(--text-muted);
      }
      
      .ir-import-list {
        max-height: 400px;
        overflow-y: auto;
      }
      
      .ir-file-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
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
        cursor: pointer;
        color: var(--text-muted);
        border-radius: 4px;
      }
      
      .ir-expand-btn:hover {
        background: var(--background-modifier-hover);
      }
      
      .ir-expand-spacer {
        width: 18px;
      }
      
      .ir-file-icon {
        color: var(--text-muted);
      }
      
      .ir-file-icon.folder-icon {
        color: var(--text-accent);
      }
      
      .ir-file-name {
        flex: 1;
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .ir-file-count {
        font-size: 12px;
        color: var(--text-accent);
        padding: 2px 8px;
        background: rgba(139, 92, 246, 0.1);
        border-radius: 10px;
      }
      
      .ir-import-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--background-modifier-border);
      }
      
      .ir-btn-cancel {
        padding: 8px 16px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
      }
      
      .ir-btn-cancel:hover {
        background: var(--background-modifier-hover);
      }
      
      .ir-btn-import {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        color: white;
        font-weight: 500;
        cursor: pointer;
      }
      
      .ir-btn-import:hover:not(:disabled) {
        filter: brightness(1.1);
      }
      
      .ir-btn-import:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
