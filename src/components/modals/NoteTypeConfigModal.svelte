<!--
  笔记类型配置模态窗
  @module components/modals/NoteTypeConfigModal
  @version 4.0.0
  
  功能：
  - 添加/删除笔记类型
  - 创建/管理类型组
  - 拖拽类型到组
  - 选择当前使用的组
-->
<script lang="ts">
  import { setIcon } from 'obsidian';
  import type { NoteTypeConfig, NoteTypeDefinition, NoteTypeGroup } from '../../types/extract-types';
  import { DEFAULT_NOTE_TYPE_CONFIG, generateTypeId } from '../../types/extract-types';

  interface Props {
    open: boolean;
    config: NoteTypeConfig;
    onSave?: (config: NoteTypeConfig) => void;
    onClose?: () => void;
  }

  let { open = $bindable(), config, onSave, onClose }: Props = $props();

  // 本地配置副本
  let localConfig = $state<NoteTypeConfig>(JSON.parse(JSON.stringify(DEFAULT_NOTE_TYPE_CONFIG)));
  
  // 状态
  let newTypeName = $state('');
  let draggedTypeId = $state<string | null>(null);
  let dragOverGroupId = $state<string | null>(null);

  // 监听 open 变化，初始化配置
  $effect(() => {
    if (open && config) {
      localConfig = JSON.parse(JSON.stringify(config));
    }
  });

  // 获取未分配的类型
  function getUnassignedTypes(): NoteTypeDefinition[] {
    const assignedIds = new Set<string>();
    localConfig.groups.forEach(g => g.typeIds.forEach(id => assignedIds.add(id)));
    return localConfig.types.filter(t => !assignedIds.has(t.id));
  }

  // 添加新类型
  function addType() {
    const name = newTypeName.trim();
    if (!name) return;
    if (localConfig.types.some(t => t.name === name)) return;
    
    const newType: NoteTypeDefinition = {
      id: generateTypeId(name),
      name,
      color: getRandomColor(),
      isBuiltin: false
    };
    localConfig.types = [...localConfig.types, newType];
    newTypeName = '';
  }

  // 删除类型
  function deleteType(typeId: string) {
    const type = localConfig.types.find(t => t.id === typeId);
    if (type?.isBuiltin) return;
    localConfig.types = localConfig.types.filter(t => t.id !== typeId);
    localConfig.groups = localConfig.groups.map(g => ({
      ...g,
      typeIds: g.typeIds.filter(id => id !== typeId)
    }));
  }

  // 添加类型到组
  function addTypeToGroup(groupId: string, typeId: string) {
    localConfig.groups = localConfig.groups.map(g => {
      if (g.id === groupId && !g.typeIds.includes(typeId)) {
        return { ...g, typeIds: [...g.typeIds, typeId] };
      }
      if (g.id !== groupId && g.typeIds.includes(typeId)) {
        return { ...g, typeIds: g.typeIds.filter(id => id !== typeId) };
      }
      return g;
    });
  }

  // 从组中移除类型
  function removeTypeFromGroup(groupId: string, typeId: string) {
    localConfig.groups = localConfig.groups.map(g => {
      if (g.id === groupId) {
        return { ...g, typeIds: g.typeIds.filter(id => id !== typeId) };
      }
      return g;
    });
  }

  // 选择组
  function selectGroup(groupId: string) {
    localConfig.groups = localConfig.groups.map(g => ({
      ...g,
      selected: g.id === groupId
    }));
  }

  // 重命名组
  function renameGroup(groupId: string, newName: string) {
    localConfig.groups = localConfig.groups.map(g => 
      g.id === groupId ? { ...g, name: newName } : g
    );
  }

  // 删除组
  function deleteGroup(groupId: string) {
    const group = localConfig.groups.find(g => g.id === groupId);
    if (group?.isDefault || localConfig.groups.length <= 1) return;
    
    const wasSelected = group?.selected;
    localConfig.groups = localConfig.groups.filter(g => g.id !== groupId);
    
    if (wasSelected && localConfig.groups.length > 0) {
      localConfig.groups[0].selected = true;
    }
  }

  // 添加新组
  function addGroup() {
    const newGroup: NoteTypeGroup = {
      id: 'group_' + Date.now(),
      name: '新类型组',
      typeIds: [],
      selected: false,
      isDefault: false
    };
    localConfig.groups = [...localConfig.groups, newGroup];
  }

  // 拖拽处理
  function handleDragStart(e: DragEvent, typeId: string) {
    draggedTypeId = typeId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragEnd() {
    draggedTypeId = null;
    dragOverGroupId = null;
  }

  function handleDragOver(e: DragEvent, groupId: string) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    dragOverGroupId = groupId;
  }

  function handleDragLeave() {
    dragOverGroupId = null;
  }

  function handleDrop(e: DragEvent, groupId: string) {
    e.preventDefault();
    if (draggedTypeId) {
      addTypeToGroup(groupId, draggedTypeId);
    }
    draggedTypeId = null;
    dragOverGroupId = null;
  }

  // 随机颜色
  function getRandomColor(): string {
    const colors = ['#4299e1', '#f56565', '#ecc94b', '#9f7aea', '#48bb78', '#ed8936', '#38b2ac', '#e53e3e'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // 保存配置
  function handleSave() {
    onSave?.(localConfig);
    open = false;
    onClose?.();
  }

  // 关闭
  function handleClose() {
    open = false;
    onClose?.();
  }

  // 图标渲染
  function renderIcon(node: HTMLElement, iconName: string) {
    setIcon(node, iconName);
    return {
      update(newIcon: string) {
        node.empty();
        setIcon(node, newIcon);
      }
    };
  }
</script>

{#if open}
<div 
  class="ntc-overlay" 
  onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
  onkeydown={(_e) => {}}
  role="presentation"
  tabindex="-1"
>
  <div class="ntc-modal" role="dialog" aria-labelledby="ntc-title" aria-modal="true">
    <!-- 头部 -->
    <header class="ntc-header">
      <h2 id="ntc-title">笔记类型配置</h2>
      <button class="ntc-close-btn" onclick={handleClose} aria-label="关闭">
        <span use:renderIcon={'x'}></span>
      </button>
    </header>

    <!-- 内容 -->
    <main class="ntc-body">
      <!-- 添加类型 -->
      <div class="ntc-add-section">
        <input
          type="text"
          class="ntc-input"
          placeholder="输入新类型名称..."
          bind:value={newTypeName}
          onkeypress={(e) => e.key === 'Enter' && addType()}
        />
        <button class="ntc-btn-primary" onclick={addType}>添加</button>
      </div>

      <!-- 类型池 -->
      <div class="ntc-section-title">所有笔记类型</div>
      <div class="ntc-pool">
        {#each getUnassignedTypes() as type (type.id)}
          <div
            class="ntc-tag"
            class:dragging={draggedTypeId === type.id}
            draggable="true"
            ondragstart={(e) => handleDragStart(e, type.id)}
            ondragend={handleDragEnd}
            style="border-color: {type.color}"
            role="listitem"
          >
            <span class="ntc-dot" style="background: {type.color}"></span>
            <span>{type.name}</span>
            {#if !type.isBuiltin}
              <button 
                class="ntc-tag-del" 
                onclick={() => deleteType(type.id)} 
                aria-label="删除类型"
              >×</button>
            {/if}
          </div>
        {/each}
        {#if getUnassignedTypes().length === 0}
          <span class="ntc-empty-hint">所有类型已分配到组中</span>
        {/if}
      </div>
      <div class="ntc-drag-hint">↓ 拖拽类型到下方类型组 ↓</div>

      <!-- 类型组 -->
      <div class="ntc-section-title">笔记类型组</div>
      <div class="ntc-groups">
        {#each localConfig.groups as group (group.id)}
          <div
            class="ntc-group"
            class:selected={group.selected}
            class:dragover={dragOverGroupId === group.id}
          >
            <div class="ntc-group-header">
              <button
                class="ntc-radio"
                class:checked={group.selected}
                onclick={() => selectGroup(group.id)}
                aria-label="选择此组"
              ></button>
              <input
                type="text"
                class="ntc-group-name"
                value={group.name}
                onchange={(e) => renameGroup(group.id, (e.target as HTMLInputElement).value)}
              />
              {#if !group.isDefault}
                <button 
                  class="ntc-group-del" 
                  onclick={() => deleteGroup(group.id)} 
                  aria-label="删除组"
                >
                  <span use:renderIcon={'trash-2'}></span>
                </button>
              {/if}
            </div>
            <div
              class="ntc-group-content"
              class:empty={group.typeIds.length === 0}
              ondragover={(e) => handleDragOver(e, group.id)}
              ondragleave={handleDragLeave}
              ondrop={(e) => handleDrop(e, group.id)}
              role="list"
            >
              {#if group.typeIds.length === 0}
                <span class="ntc-placeholder">拖拽类型到此处</span>
              {:else}
                {#each group.typeIds as typeId}
                  {@const type = localConfig.types.find(t => t.id === typeId)}
                  {#if type}
                    <div class="ntc-tag in-group" style="border-color: {type.color}">
                      <span class="ntc-dot" style="background: {type.color}"></span>
                      <span>{type.name}</span>
                      <button 
                        class="ntc-tag-del" 
                        onclick={() => removeTypeFromGroup(group.id, typeId)} 
                        aria-label="从组中移除"
                      >×</button>
                    </div>
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- 新建组按钮 -->
      <button class="ntc-add-group-btn" onclick={addGroup}>
        <span>＋</span>
        <span>新建类型组</span>
      </button>
    </main>

    <!-- 底部 -->
    <footer class="ntc-footer">
      <button class="ntc-btn-secondary" onclick={handleClose}>取消</button>
      <button class="ntc-btn-primary" onclick={handleSave}>保存</button>
    </footer>
  </div>
</div>
{/if}

<style>
  .ntc-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .ntc-modal {
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ntc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .ntc-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .ntc-close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ntc-close-btn:hover { color: var(--text-error); }

  .ntc-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .ntc-add-section {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  .ntc-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 14px;
  }
  .ntc-input:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .ntc-btn-primary {
    padding: 10px 20px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .ntc-btn-primary:hover { opacity: 0.9; }

  .ntc-btn-secondary {
    padding: 10px 20px;
    background: var(--background-secondary);
    color: var(--text-normal);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .ntc-btn-secondary:hover { background: var(--background-modifier-hover); }

  .ntc-section-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
  }
  .ntc-section-title::before,
  .ntc-section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--background-modifier-border);
  }

  .ntc-pool {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 16px;
    min-height: 60px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-content: flex-start;
  }

  .ntc-empty-hint {
    color: var(--text-muted);
    font-size: 13px;
    width: 100%;
    text-align: center;
  }

  .ntc-drag-hint {
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
    margin: 12px 0 24px;
    padding: 8px;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 8px;
  }

  .ntc-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--background-primary);
    border: 2px solid;
    border-radius: 20px;
    font-size: 13px;
    cursor: grab;
    transition: all 0.2s;
    user-select: none;
  }
  .ntc-tag:hover { transform: translateY(-1px); }
  .ntc-tag.dragging { opacity: 0.5; cursor: grabbing; }
  .ntc-tag.in-group { cursor: default; }

  .ntc-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .ntc-tag-del {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
    margin-left: 4px;
  }
  .ntc-tag-del:hover { color: var(--text-error); }

  .ntc-groups {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 16px;
  }

  .ntc-group {
    background: var(--background-secondary);
    border-radius: 10px;
    border: 2px solid var(--background-modifier-border);
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .ntc-group.selected { border-color: var(--interactive-accent); }
  .ntc-group.dragover { 
    border-color: var(--text-success); 
    background: rgba(72, 187, 120, 0.05); 
  }

  .ntc-group-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ntc-radio {
    width: 18px;
    height: 18px;
    border: 2px solid var(--text-muted);
    border-radius: 50%;
    cursor: pointer;
    background: transparent;
    padding: 0;
    position: relative;
    flex-shrink: 0;
  }
  .ntc-radio.checked {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
  }
  .ntc-radio.checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    background: var(--text-on-accent);
    border-radius: 50%;
  }

  .ntc-group-name {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-normal);
    font-size: 14px;
    font-weight: 500;
    padding: 4px 0;
  }
  .ntc-group-name:focus { 
    outline: none; 
    border-bottom: 1px solid var(--interactive-accent); 
  }

  .ntc-group-del {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ntc-group-del:hover { color: var(--text-error); }

  .ntc-group-content {
    padding: 16px;
    min-height: 50px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-content: flex-start;
  }
  .ntc-group-content.empty {
    justify-content: center;
    align-items: center;
  }

  .ntc-placeholder {
    color: var(--text-muted);
    font-size: 13px;
  }

  .ntc-add-group-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: transparent;
    border: 2px dashed var(--background-modifier-border);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }
  .ntc-add-group-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .ntc-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  /* 滚动条 */
  .ntc-body::-webkit-scrollbar {
    width: 6px;
  }
  .ntc-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .ntc-body::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 3px;
  }
  .ntc-body::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }
</style>
