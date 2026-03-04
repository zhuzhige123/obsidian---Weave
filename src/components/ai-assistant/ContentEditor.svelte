<script lang="ts">
  import { tick } from 'svelte';
  import type { App } from 'obsidian';
  import type { ObsidianFileInfo } from '../../types/ai-types';
  import { formatFileSize } from '../../utils/file-utils';
  import { DetachedLeafEditor } from '../../services/editor/DetachedLeafEditor';
  import { logger } from '../../utils/logger';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';

  interface Props {
    content: string;
    selectedFile: ObsidianFileInfo | null;
    app: App;
    onClear: () => void;
    onReload: () => void;
  }

  let { content = $bindable(), selectedFile, app, onClear, onReload }: Props = $props();

  // 计算字符数
  let charCount = $derived(content.length);
  let lineCount = $derived(content.split('\n').length);
  
  // Obsidian编辑器
  let editorContainer: HTMLDivElement | null = $state(null);
  let embeddedEditor: DetachedLeafEditor | null = null;
  let editorInitialized = $state(false);
  let lastSyncedContent = '';  // 追踪上次同步的内容，避免循环更新
  let lastSelectedFilePath = '';  // 追踪上次选择的文件路径
  let pendingContent: string | null = null;
  let editorInitToken = 0;
  
  // 销毁编辑器
  function destroyEditor() {
    if (embeddedEditor) {
      embeddedEditor.destroy();
      embeddedEditor = null;
    }
    editorInitialized = false;
    lastSyncedContent = '';
  }
  
  // 创建编辑器
  async function createEditor() {
    if (!editorContainer) return;
    
    try {
      // 清空容器
      editorContainer.innerHTML = '';
      
      // 创建Obsidian原生编辑器
      const initToken = ++editorInitToken;
      const editor = new DetachedLeafEditor(
        app,
        editorContainer,
        {
          value: content,
          placeholder: selectedFile 
            ? '在此编辑内容，AI将基于此内容生成卡片...' 
            : '请先选择文件，或直接在此输入内容...',
          sourcePath: selectedFile?.path,
          sessionId: `content-editor-${Date.now()}`,
          onChange: (editor) => {
            // 实时同步内容到父组件
            const newValue = editor.value;
            lastSyncedContent = newValue;
            content = newValue;
          }
        }
      );

      embeddedEditor = editor;

      // 手动加载组件
      editor.load();

      editor.whenReady().then(() => {
        if (embeddedEditor !== editor) return;
        if (editorInitToken !== initToken) return;

        if (!editor.getEditor()) {
          logger.warn('[ContentEditor] Obsidian编辑器未就绪（editor实例为空）');
          return;
        }

        const nextContent = pendingContent ?? content;
        pendingContent = null;

        editorInitialized = true;
        editor.setValue(nextContent);
        lastSyncedContent = nextContent;
        logger.debug('[ContentEditor] Obsidian编辑器创建成功');
      });
    } catch (error) {
      logger.error('[ContentEditor] 编辑器创建失败:', error);
    }
  }
  
  // 监听selectedFile变化，切换文件时重建编辑器（解决YAML属性不更新问题）
  $effect(() => {
    const currentFilePath = selectedFile?.path || '';
    
    if (currentFilePath !== lastSelectedFilePath) {
      logger.debug('[ContentEditor] 文件切换:', lastSelectedFilePath, '->', currentFilePath);
      lastSelectedFilePath = currentFilePath;
      
      // 切换文件时重建编辑器以正确显示YAML属性
      if (embeddedEditor) {
        destroyEditor();
        // 等待DOM更新后重建
        tick().then(() => createEditor());
      }
    }
  });
  
  // 当外部content变化时（非文件切换），更新编辑器内容
  $effect(() => {
    const currentContent = content;
    
    if (embeddedEditor && editorInitialized && currentContent !== lastSyncedContent) {
      logger.debug('[ContentEditor] 外部内容变化，更新编辑器:', currentContent.length, '字符');
      embeddedEditor.setValue(currentContent);
      lastSyncedContent = currentContent;
    } else if (embeddedEditor && !editorInitialized && currentContent !== lastSyncedContent) {
      pendingContent = currentContent;
    }
  });
  
  // 容器就绪时初始化编辑器
  $effect(() => {
    if (editorContainer && !embeddedEditor) {
      createEditor();
    }
  });
  
  // 清理：组件卸载时销毁编辑器
  $effect(() => {
    return () => {
      if (embeddedEditor) {
        embeddedEditor.destroy();
        embeddedEditor = null;
        editorInitialized = false;
      }
    };
  });
</script>

<div class="content-editor-container">
  {#if selectedFile}
    <!-- 文件信息栏 -->
    <div class="file-info-bar">
      <div class="file-meta">
        <ObsidianIcon name="file-text" size={14} />
        <span class="file-name">{selectedFile.name}</span>
        <span class="file-stats">
          {formatFileSize(selectedFile.size)} · {charCount} 字符 · {lineCount} 行
        </span>
      </div>
      <div class="editor-actions">
        <button 
          class="action-btn" 
          onclick={onReload}
          title="重新加载文件"
        >
          <ObsidianIcon name="refresh-cw" size={14} />
        </button>
        <button 
          class="action-btn" 
          onclick={onClear}
          title="清空内容"
        >
          <ObsidianIcon name="trash-2" size={14} />
        </button>
      </div>
    </div>
  {/if}

  <!-- Obsidian原生编辑器 -->
  <div 
    class="obsidian-editor-wrapper" 
    bind:this={editorContainer}
  ></div>
</div>

<style>
  .content-editor-container {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;  /* 🔧 允许扩展填充所有可用空间 */
    min-height: 200px;  /* 🔧 防止折叠为一行 */
    height: 100%;  /* 🔧 确保填满父容器 */
    background: var(--background-primary);
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  .file-info-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .file-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-size: 0.9em;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-stats {
    font-size: 0.75em;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .editor-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* Obsidian原生编辑器包装器 */
  .obsidian-editor-wrapper {
    flex: 1 1 auto;  /* 🔧 允许扩展填充所有可用空间 */
    min-height: 200px; /* 最小高度 */
    height: 100%;  /* 🔧 填满父容器 */
    overflow-y: auto;
  }

  /* Obsidian编辑器内部样式调整 */
  .obsidian-editor-wrapper :global(.markdown-source-view) {
    padding: 16px;
    height: 100%;
  }

  .obsidian-editor-wrapper :global(.cm-editor) {
    height: 100%;  /* 🔧 确保编辑器填满容器 */
    min-height: 100%;
  }

  .obsidian-editor-wrapper :global(.cm-content) {
    padding: 8px 0;
  }
  
  .obsidian-editor-wrapper :global(.cm-scroller) {
    font-family: var(--font-monospace);
    font-size: 0.9em;
    line-height: 1.6;
  }
</style>

