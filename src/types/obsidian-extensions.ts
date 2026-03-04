/**
 * Obsidian API 扩展类型定义
 * 为 Obsidian 内部对象提供类型安全的访问
 */

import type {
  WorkspaceLeaf,
  WorkspaceTabs,
  WorkspaceMobileDrawer,
  MarkdownView,
  MarkdownSubView,
  Editor,
  TFile,
  View,
} from 'obsidian';

/**
 * 扩展的 WorkspaceLeaf 接口
 * 提供对内部属性的类型安全访问
 * 
 * 注意：不重写官方类型，只添加内部属性
 */
export interface ExtendedWorkspaceLeaf extends Omit<WorkspaceLeaf, 'containerEl' | 'parent'> {
  /** Leaf 容器 DOM 元素（内部属性）*/
  containerEl?: HTMLElement;

  /** Tab 标题 DOM 元素（内部属性）*/
  tabHeaderEl?: HTMLElement;

  /** Tab 内容 DOM 元素（内部属性）*/
  tabContentEl?: HTMLElement;

  /** 
   * Leaf 的父容器（必需）
   * 
   * 桌面端：WorkspaceTabs
   * 移动端：WorkspaceMobileDrawer
   * 使用前需要 instanceof 检查
   */
  parent: WorkspaceTabs | WorkspaceMobileDrawer;

  //  不重写 view 类型，保持官方的 View 类型
  // view: View; (已由 WorkspaceLeaf 定义)
}

/**
 * View 内部属性访问接口
 * 
 * 这不是 View 的替代类型，而是用于类型断言访问内部属性的辅助接口
 * 
 * @example
 * ```typescript
 * const view = leaf.view;
 * const internalView = view as unknown as ViewInternalProperties;
 * const contentEl = internalView.contentEl; // 访问内部属性
 * ```
 */
export interface ViewInternalProperties {
  /** 视图的 DOM 元素（内部属性）*/
  contentEl?: HTMLElement;

  /** 视图的容器元素（内部属性）*/
  containerEl?: HTMLElement;

  /** 视图的标题元素（内部属性）*/
  titleEl?: HTMLElement;

  /** 视图的操作按钮容器（内部属性）*/
  actionsEl?: HTMLElement;
}

/**
 * @deprecated 使用 ViewInternalProperties 代替
 * 保留此别名以兼容现有代码
 */
export type ExtendedView = ViewInternalProperties;

/**
 * 扩展的 MarkdownView 接口
 * 提供对编辑器和内部属性的访问
 */
export interface ExtendedMarkdownView extends Omit<MarkdownView, 'editor' | 'contentEl' | 'file' | 'currentMode'> {
  /** CodeMirror 编辑器实例 */
  editor: ExtendedEditor;

  /** 编辑器 DOM 元素 */
  editorEl?: HTMLElement;

  /** 编辑器容器元素 */
  contentEl?: HTMLElement;

  /** 预览模式容器 */
  previewEl?: HTMLElement;

  /** 
   * 当前编辑模式（必需）
   * 
   * 类型: MarkdownSubView (Obsidian 内部类型)
   * 可能值: MarkdownEditView | MarkdownPreviewView
   */
  currentMode: MarkdownSubView;

  /** 文件信息 */
  file: TFile | null;
}

/**
 * 扩展的 Editor 接口
 * 提供对 CodeMirror 内部方法的访问
 */
export interface ExtendedEditor extends Omit<Editor, 'setValue' | 'getValue' | 'refresh' | 'focus'> {
  /** CodeMirror 实例 */
  cm?: CodeMirrorInstance;

  /** 设置编辑器内容（内部方法） */
  setValue?: (content: string) => void;

  /** 获取编辑器内容（内部方法） */
  getValue?: () => string;

  /** 刷新编辑器 */
  refresh?: () => void;

  /** 聚焦编辑器 */
  focus?: () => void;

  /** 编辑器 DOM 元素 */
  editorElement?: HTMLElement;
}

/**
 * CodeMirror 实例接口
 */
export interface CodeMirrorInstance {
  /** CodeMirror DOM 元素 */
  dom?: HTMLElement;

  /** 设置内容 */
  setValue?: (content: string) => void;

  /** 获取内容 */
  getValue?: () => string;

  /** 刷新 */
  refresh?: () => void;

  /** 聚焦 */
  focus?: () => void;

  /** 获取光标位置 */
  getCursor?: () => { line: number; ch: number };

  /** 设置光标位置 */
  setCursor?: (pos: { line: number; ch: number }) => void;
}

/**
 * 编辑器管理器接口
 * 用于嵌入式编辑器管理器中的编辑器实例
 */
export interface EditorManager {
  /** 编辑器实例 */
  editor: ExtendedEditor;

  /** Leaf 实例 */
  leaf: ExtendedWorkspaceLeaf;

  /** 编辑器 DOM 元素 */
  editorElement?: HTMLElement;

  /** 是否已初始化 */
  initialized?: boolean;

  /** 清理方法 */
  cleanup?: () => void;
}

/**
 * 文件浏览器扩展接口
 */
export interface ExtendedFileExplorer {
  /** 文件树容器 */
  fileItems?: Record<string, FileItem>;

  /** 刷新视图 */
  refresh?: () => void;

  /** 滚动到文件 */
  scrollToFile?: (file: TFile) => void;
}

/**
 * 文件项接口
 */
export interface FileItem {
  /** 文件引用 */
  file: TFile;

  /** DOM 元素 */
  el?: HTMLElement;

  /** 标题元素 */
  titleEl?: HTMLElement;

  /** 是否展开 */
  collapsed?: boolean;
}

/**
 * Vault 配置扩展接口
 */
export interface ExtendedVaultConfig {
  /** 配置目录路径 */
  configDir: string;

  /** 插件目录路径 */
  pluginDir: string;

  /** 主题目录路径 */
  themeDir: string;
}

/**
 * App 扩展接口
 */
export interface ExtendedApp {
  /** Vault 配置 */
  vault: {
    /** 配置目录 */
    configDir: string;
    /** 适配器 */
    adapter: {
      /** 读取文件 */
      read(path: string): Promise<string>;
      /** 写入文件 */
      write(path: string, content: string): Promise<void>;
      /** 删除文件 */
      remove(path: string): Promise<void>;
      /** 检查文件是否存在 */
      exists(path: string): Promise<boolean>;
      /** 创建文件夹 */
      mkdir(path: string): Promise<void>;
    };
  };

  /** 工作区 */
  workspace: {
    /** 获取激活的 Leaf */
    getActiveViewOfType<T extends View>(type: new (..._args: unknown[]) => T): T | null;
    /** 创建新 Leaf */
    createLeafBySplit(
      leaf: WorkspaceLeaf,
      direction?: 'vertical' | 'horizontal'
    ): WorkspaceLeaf;
    /** 获取右侧边栏 Leaf */
    getRightLeaf(split: boolean): WorkspaceLeaf;
  };
}

/**
 * Notice 扩展接口
 */
export interface ExtendedNoticeElement {
  /** Notice DOM 元素 */
  noticeEl?: HTMLElement;

  /** Notice 容器 */
  containerEl?: HTMLElement;

  /** 消息元素 */
  messageEl?: HTMLElement;

  /** 关闭按钮 */
  closeButton?: HTMLElement;
}

/**
 * 菜单扩展接口
 */
export interface ExtendedMenu {
  /** 菜单 DOM 元素 */
  dom?: HTMLElement;

  /** 菜单项列表 */
  items?: MenuItem[];

  /** 显示菜单 */
  show?: () => void;

  /** 隐藏菜单 */
  hide?: () => void;
}

/**
 * 菜单项接口
 */
export interface MenuItem {
  /** 标题 */
  title: string;

  /** 图标 */
  icon?: string;

  /** 点击回调 */
  callback?: () => void;

  /** 是否禁用 */
  disabled?: boolean;

  /** DOM 元素 */
  dom?: HTMLElement;
}

/**
 * 模态框扩展接口
 */
export interface ExtendedModal {
  /** 模态框 DOM 元素 */
  modalEl?: HTMLElement;

  /** 内容容器 */
  contentEl?: HTMLElement;

  /** 标题容器 */
  titleEl?: HTMLElement;

  /** 关闭按钮 */
  closeButtonEl?: HTMLElement;

  /** 背景遮罩 */
  bgEl?: HTMLElement;
}

/**
 * 设置标签页扩展接口
 */
export interface ExtendedSettingTab {
  /** 容器 DOM 元素 */
  containerEl?: HTMLElement;

  /** 内容元素 */
  contentEl?: HTMLElement;

  /** 导航元素 */
  navEl?: HTMLElement;
}

/**
 * 安全访问 View 的内部属性
 * 
 * @example
 * ```typescript
 * const view = leaf.view;
 * const contentEl = getViewInternalProperty(view, 'contentEl');
 * ```
 */
export function getViewInternalProperty<K extends keyof ViewInternalProperties>(
  view: View,
  property: K
): ViewInternalProperties[K] | undefined {
  const internalView = view as unknown as ViewInternalProperties;
  return internalView[property];
}

/**
 * 类型守卫：检查是否为扩展的 WorkspaceLeaf
 */
export function isExtendedWorkspaceLeaf(
  leaf: unknown
): leaf is ExtendedWorkspaceLeaf {
  return (
    typeof leaf === 'object' &&
    leaf !== null &&
    'view' in leaf &&
    'containerEl' in leaf
  );
}

/**
 * 类型守卫：检查是否为扩展的 MarkdownView
 */
export function isExtendedMarkdownView(
  view: unknown
): view is ExtendedMarkdownView {
  return (
    typeof view === 'object' &&
    view !== null &&
    'editor' in view &&
    'file' in view
  );
}

/**
 * 类型守卫：检查是否为扩展的 Editor
 */
export function isExtendedEditor(
  editor: unknown
): editor is ExtendedEditor {
  return (
    typeof editor === 'object' &&
    editor !== null &&
    ('setValue' in editor || 'getValue' in editor)
  );
}

/**
 * 安全获取 Leaf 容器元素
 */
export function getLeafContainerElement(
  leaf: WorkspaceLeaf
): HTMLElement | null {
  const extendedLeaf = leaf as ExtendedWorkspaceLeaf;
  return extendedLeaf.containerEl || null;
}

/**
 * 安全获取编辑器元素
 */
export function getEditorElement(
  editor: Editor
): HTMLElement | null {
  const extendedEditor = editor as ExtendedEditor;
  return extendedEditor.editorElement || null;
}

/**
 * 安全设置编辑器内容
 */
export function safeSetEditorValue(
  editor: Editor,
  content: string
): boolean {
  try {
    const extendedEditor = editor as ExtendedEditor;
    if (extendedEditor.setValue) {
      extendedEditor.setValue(content);
      return true;
    }
    // 降级到标准方法
    editor.setValue(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全获取编辑器内容
 */
export function safeGetEditorValue(
  editor: Editor
): string | null {
  try {
    const extendedEditor = editor as ExtendedEditor;
    if (extendedEditor.getValue) {
      return extendedEditor.getValue();
    }
    // 降级到标准方法
    return editor.getValue();
  } catch {
    return null;
  }
}



