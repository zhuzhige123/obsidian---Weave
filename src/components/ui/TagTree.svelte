<script lang="ts">
  import Icon from "./Icon.svelte";
  import { createEventDispatcher } from 'svelte';
  
  interface TagNode {
    name: string;
    fullPath: string;
    children: TagNode[];
    count: number;
    selected: boolean;
  }

  interface Props {
    tags: string[];
    selectedTags: string[];
    tagCounts?: Record<string, number>;  // 可选的标签计数映射
    onTagSelect?: (tag: string) => void;
  }

  let { tags, selectedTags, tagCounts, onTagSelect }: Props = $props();

  const dispatch = createEventDispatcher<{ tagSelect: string }>();

  // 存储每个节点的展开状态（路径 -> 是否展开）
  let expandedState = $state(new Map<string, boolean>());

  // 构建标签树（不包含展开状态，展开状态单独管理）
  let tagTreeResult = $derived(buildTagTree(tags, selectedTags, tagCounts));
  
  // 提取树和映射
  let tagTree = $derived(tagTreeResult.tree);
  let cleanToOriginalMap = $derived(tagTreeResult.mapping);
  
  function buildTagTree(allTags: string[], selected: string[], externalCounts?: Record<string, number>): { tree: TagNode[]; mapping: Map<string, string> } {
    const internalCounts = new Map<string, number>();
    const pathSet = new Set<string>();
    const pathToOriginal = new Map<string, string>(); // 清理后的路径 -> 原始标签
    
    // 辅助函数：移除标签开头的 # 符号
    function removeHashPrefix(tag: string): string {
      return tag.startsWith('#') ? tag.slice(1) : tag;
    }
    
    // 清理 selected 数组，移除 # 前缀
    const cleanSelected = selected.map(tag => removeHashPrefix(tag));

    // 如果提供了外部计数，使用它；否则统计标签出现次数
    if (externalCounts) {
      // 使用外部提供的计数
      Object.entries(externalCounts).forEach(([tag, count]) => {
        // 移除 # 前缀后处理
        const cleanTag = removeHashPrefix(tag);
        internalCounts.set(cleanTag, count);
        pathToOriginal.set(cleanTag, tag); // 保存映射
        
        // 处理层级标签（支持 / 分隔符）
        const parts = cleanTag.split('/').filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          const path = parts.slice(0, i).join('/');
          pathSet.add(path);
        }
      });
    } else {
      // 统计标签出现次数并收集所有路径
      allTags.forEach(tag => {
        // 移除 # 前缀后处理
        const cleanTag = removeHashPrefix(tag);
        internalCounts.set(cleanTag, (internalCounts.get(cleanTag) || 0) + 1);
        pathToOriginal.set(cleanTag, tag); // 保存映射
        
        // 处理层级标签（支持 / 分隔符）
        const parts = cleanTag.split('/').filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          const path = parts.slice(0, i).join('/');
          pathSet.add(path);
        }
      });
    }

    // 构建树结构
    const root: TagNode[] = [];
    const nodeMap = new Map<string, TagNode>();

    // 按路径长度排序，确保父节点先创建
    const sortedPaths = Array.from(pathSet).sort((a, b) => a.split('/').length - b.split('/').length);

    sortedPaths.forEach(path => {
      const parts = path.split('/');
      const name = parts[parts.length - 1];
      const count = internalCounts.get(path) || 0;
      
      const node: TagNode = {
        name,
        fullPath: path,
        children: [],
        count,
        selected: cleanSelected.includes(path)
      };

      nodeMap.set(path, node);

      if (parts.length === 1) {
        // 根级标签
        root.push(node);
      } else {
        // 子标签
        const parentPath = parts.slice(0, -1).join('/');
        const parent = nodeMap.get(parentPath);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    // 返回树和映射
    return {
      tree: root,
      mapping: pathToOriginal
    };
  }

  // 检查节点是否展开（默认展开）
  function isExpanded(path: string): boolean {
    // 如果没有显式设置状态，默认展开
    return expandedState.get(path) ?? true;
  }

  // 切换节点展开状态
  function toggleExpanded(node: TagNode) {
    const currentState = isExpanded(node.fullPath);
    expandedState.set(node.fullPath, !currentState);
  }

  function selectTag(node: TagNode) {
    // 返回原始标签（可能带 #），如果找不到则返回清理后的路径
    const originalTag = cleanToOriginalMap.get(node.fullPath) || node.fullPath;
    onTagSelect?.(originalTag);
    dispatch('tagSelect', originalTag);
  }

  function hasSelectedDescendants(node: TagNode): boolean {
    if (node.selected) return true;
    return node.children.some(child => hasSelectedDescendants(child));
  }

  interface NodeData {
    node: TagNode;
    hasChildren: boolean;
    isSelected: boolean;
    hasSelectedDesc: boolean;
  }

  function renderNode(node: TagNode): NodeData {
    return {
      node,
      hasChildren: node.children.length > 0,
      isSelected: node.selected,
      hasSelectedDesc: hasSelectedDescendants(node)
    };
  }
</script>

<div class="tag-tree">
  {#each tagTree as node}
    {@render TagTreeNode(renderNode(node))}
  {/each}
</div>

{#snippet TagTreeNode(data: NodeData)}
  {@const { node, hasChildren, isSelected, hasSelectedDesc } = data}
  {@const nodeExpanded = isExpanded(node.fullPath)}
  <div class="tag-node" class:has-children={hasChildren}>
    <div 
      class="tag-item" 
      class:selected={isSelected} 
      class:has-selected-descendants={hasSelectedDesc}
      role="button"
      tabindex="0"
      onclick={() => selectTag(node)}
      onkeydown={(e) => e.key === 'Enter' && selectTag(node)}
      title="#{node.fullPath}"
    >
      {#if hasChildren}
        <button 
          class="expand-button" 
          onclick={(e) => {
            e.preventDefault();
            toggleExpanded(node);
          }}
          aria-label={nodeExpanded ? '收起' : '展开'}
        >
          <Icon name={nodeExpanded ? "chevronDown" : "chevronRight"} size="12" />
        </button>
      {:else}
        <div class="expand-placeholder"></div>
      {/if}
      
      <span class="tag-name">#{node.name}</span>
      {#if node.count > 0}
        <span class="tag-count">{node.count}</span>
      {/if}
    </div>
    
    {#if nodeExpanded && hasChildren}
      <div class="tag-children">
        {#each node.children as child}
          {@render TagTreeNode(renderNode(child))}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .tag-tree {
    font-size: 13px;
    color: var(--text-normal);
  }

  .tag-node {
    margin-bottom: 1px;
  }

  /* Obsidian原生列表风格 - 扁平化设计 */
  .tag-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 2px 8px;
    cursor: pointer;
    transition: background-color 0.1s ease;
    user-select: none;
  }

  .tag-item:hover {
    background: var(--background-modifier-hover);
  }

  .tag-item.selected {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  .tag-item.has-selected-descendants {
    background: rgba(var(--color-accent-rgb), 0.05);
  }

  /* 展开/折叠按钮 */
  .expand-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .expand-button:hover {
    color: var(--text-normal);
  }

  .expand-placeholder {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* 标签名称 */
  .tag-name {
    flex: 1;
    font-size: 13px;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 计数徽章 */
  .tag-count {
    font-size: 10px;
    color: var(--text-muted);
    background: var(--background-modifier-border);
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .tag-item.selected .tag-count {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-weight: 600;
  }

  /* 子标签缩进 */
  .tag-children {
    margin-left: 20px;
    padding-left: 8px;
    border-left: 1px solid var(--background-modifier-border);
  }

  /* 焦点样式 */
  .tag-item:focus {
    outline: none;
    background: var(--background-modifier-hover);
  }

  .expand-button:focus {
    outline: none;
  }

  /* 动画效果 */
  .tag-children {
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
