<!--
  NoteTypeConfigModal - 笔记类型配置模态窗
  @module components/incremental-reading/NoteTypeConfigModal
  @version 3.0.0
  
  完全重写：使用与 CreateCardModal 相同的模式
-->
<script lang="ts">
  import { setIcon } from 'obsidian';
  import { onMount } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import type { NoteTypeConfig, NoteTypeDefinition, NoteTypeGroup } from '../../types/extract-types';
  import { DEFAULT_NOTE_TYPE_CONFIG, generateTypeId } from '../../types/extract-types';
  import { logger } from '../../utils/logger';

  // ✅ 使用 interface 明确定义 Props（与 CreateCardModal 相同模式）
  interface Props {
    plugin: WeavePlugin;
    onClose: () => void;
    onSave: (config: NoteTypeConfig) => void;
  }

  let {
    plugin,
    onClose,
    onSave
  }: Props = $props();

  // 状态 - 使用安全的初始化方式
  let config: NoteTypeConfig = $state(getInitialConfig());
  let newTypeName = $state('');
  let draggedTypeId = $state<string | null>(null);
  let dragOverGroupId = $state<string | null>(null);
  let mounted = $state(false);

  // 安全获取初始配置
  function getInitialConfig(): NoteTypeConfig {
    try {
      const savedConfig = plugin?.settings?.noteTypeConfig;
      if (savedConfig) {
        return JSON.parse(JSON.stringify(savedConfig));
      }
    } catch (e) {
      logger.error('[NoteTypeConfigModal] 获取配置失败:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_NOTE_TYPE_CONFIG));
  }

  // 组件挂载
  onMount(() => {
    logger.debug('[NoteTypeConfigModal] ✅ 组件已挂载');
    mounted = true;
    return () => {
      logger.debug('[NoteTypeConfigModal] 组件已卸载');
      mounted = false;
    };
  });

  // 获取未分配的类型
  function getUnassignedTypes(): NoteTypeDefinition[] {
    const assignedIds = new Set<string>();
    config.groups.forEach(g => g.typeIds.forEach(id => assignedIds.add(id)));
    return config.types.filter(t => !assignedIds.has(t.id));
  }

  // 添加新类型
  function addType() {
    const name = newTypeName.trim();
    if (!name) return;
    if (config.types.some(t => t.name === name)) return;
    
    const newType: NoteTypeDefinition = {
      id: generateTypeId(name),
      name,
      color: getRandomColor(),
      isBuiltin: false
    };
    config.types = [...config.types, newType];
    newTypeName = '';
  }

  // 删除类型
  function deleteType(typeId: string) {
    const type = config.types.find(t => t.id === typeId);
    if (type?.isBuiltin) return;
    config.types = config.types.filter(t => t.id !== typeId);
    config.groups = config.groups.map(g => ({
      ...g,
      typeIds: g.typeIds.filter(id => id !== typeId)
    }));
  }

  // 添加类型到组
  function addTypeToGroup(groupId: string, typeId: string) {
    config.groups = config.groups.map(g => {
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
    config.groups = config.groups.map(g => {
      if (g.id === groupId) {
        return { ...g, typeIds: g.typeIds.filter(id => id !== typeId) };
      }
      return g;
    });
  }

  // 选择组
  function selectGroup(groupId: string) {
    config.groups = config.groups.map(g => ({
      ...g,
      selected: g.id === groupId
    }));
  }

  // 重命名组
  function renameGroup(groupId: string, newName: string) {
    config.groups = config.groups.map(g => 
      g.id === groupId ? { ...g, name: newName } : g
    );
  }

  // 删除组
  function deleteGroup(groupId: string) {
    const group = config.groups.find(g => g.id === groupId);
    if (group?.isDefault || config.groups.length <= 1) return;
    
    const wasSelected = group?.selected;
    config.groups = config.groups.filter(g => g.id !== groupId);
    
    if (wasSelected && config.groups.length > 0) {
      config.groups[0].selected = true;
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
    config.groups = [...config.groups, newGroup];
  }

  // 拖拽处理
  function handleDragStart(typeId: string) {
    draggedTypeId = typeId;
  }

  function handleDragEnd() {
    draggedTypeId = null;
    dragOverGroupId = null;
  }

  function handleDragOver(e: DragEvent, groupId: string) {
    e.preventDefault();
    dragOverGroupId = groupId;
  }

  function handleDragLeave() {
    dragOverGroupId = null;
  }

  function handleDrop(groupId: string) {
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
    logger.debug('[NoteTypeConfigModal] 保存配置');
    onSave(config);
    onClose();
  }

  // 处理关闭
  function handleClose() {
    logger.debug('[NoteTypeConfigModal] 关闭');
    onClose();
  }

  // 图标渲染 action
  function setIconAction(node: HTMLElement, iconName: string) {
    setIcon(node, iconName);
    return {
      update(newIcon: string) {
        node.empty();
        setIcon(node, newIcon);
      }
    };
  }
  
  // 阻止点击事件冒泡到背景
  function stopPropagation(e: MouseEvent) {
    e.stopPropagation();
  }
</script>


<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ntc-modal" onclick={stopPropagation}>
  <!-- 头部 -->
  <div class="ntc-header">
    <h2 class="ntc-title">笔记类型配置</h2>
    <button class="ntc-close" onclick={handleClose} aria-label="关闭">
      <span use:setIconAction={'x'}></span>
    </button>
  </div>

  <!-- 内容区 -->
  <div class="ntc-body">
    <!-- 添加类型 -->
    <div class="ntc-add-row">
      <input
        type="text"
        class="ntc-input"
        placeholder="输入新类型名称..."
        bind:value={newTypeName}
        onkeypress={(e) => e.key === 'Enter' && addType()}
      />
      <button class="ntc-btn-add" onclick={addType}>添加</button>
    </div>

    <!-- 类型池 -->
    <div class="ntc-section-label">所有笔记类型</div>
    <div class="ntc-pool">
      {#each getUnassignedTypes() as type (type.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="ntc-tag"
          class:dragging={draggedTypeId === type.id}
          draggable="true"
          ondragstart={() => handleDragStart(type.id)}
          ondragend={handleDragEnd}
          style="border-color: {type.color}"
          role="listitem"
        >
          <span class="ntc-dot" style="background: {type.color}"></span>
          <span>{type.name}</span>
          {#if !type.isBuiltin}
            <button class="ntc-tag-del" onclick={() => deleteType(type.id)} aria-label="删除类型">×</button>
          {/if}
        </div>
      {/each}
      {#if getUnassignedTypes().length > 0}
        <div class="ntc-hint">↓ 拖拽类型到下方类型组 ↓</div>
      {/if}
    </div>

    <!-- 类型组 -->
    <div class="ntc-section-label">笔记类型组</div>
    <div class="ntc-groups">
      {#each config.groups as group (group.id)}
        <div
          class="ntc-group"
          class:selected={group.selected}
          class:dragover={dragOverGroupId === group.id}
        >
          <div class="ntc-group-head">
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
              <button class="ntc-group-del" onclick={() => deleteGroup(group.id)} aria-label="删除组">
                <span use:setIconAction={'trash-2'}></span>
              </button>
            {/if}
          </div>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="ntc-group-body"
            class:empty={group.typeIds.length === 0}
            ondragover={(e) => handleDragOver(e, group.id)}
            ondragleave={handleDragLeave}
            ondrop={() => handleDrop(group.id)}
            role="list"
          >
            {#if group.typeIds.length === 0}
              <span class="ntc-placeholder">拖拽类型到此处</span>
            {:else}
              {#each group.typeIds as typeId}
                {@const type = config.types.find(t => t.id === typeId)}
                {#if type}
                  <div class="ntc-tag in-group" style="border-color: {type.color}">
                    <span class="ntc-dot" style="background: {type.color}"></span>
                    <span>{type.name}</span>
                    <button class="ntc-tag-del" onclick={() => removeTypeFromGroup(group.id, typeId)} aria-label="从组中移除">×</button>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- 添加组按钮 -->
    <button class="ntc-btn-add-group" onclick={addGroup}>
      <span>＋</span>
      <span>新建类型组</span>
    </button>
  </div>

  <!-- 底部 -->
  <div class="ntc-footer">
    <button class="ntc-btn ntc-btn-cancel" onclick={handleClose}>取消</button>
    <button class="ntc-btn ntc-btn-save" onclick={handleSave}>保存</button>
  </div>
</div>


<style>
  .ntc-modal {
    display: flex;
    flex-direction: column;
    width: 90vw;
    max-width: 600px;
    max-height: 80vh;
    background: var(--background-primary);
    color: var(--text-normal);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
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

  .ntc-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .ntc-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
  }
  .ntc-close:hover { color: var(--text-error); }

  .ntc-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .ntc-add-row {
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

  .ntc-btn-add {
    padding: 10px 20px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
  }
  .ntc-btn-add:hover { opacity: 0.9; }

  .ntc-section-label {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
  }
  .ntc-section-label::before,
  .ntc-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--background-modifier-border);
  }

  .ntc-pool {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 24px;
    min-height: 80px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-content: flex-start;
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

  .ntc-hint {
    width: 100%;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
    margin-top: 12px;
    padding: 8px;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 8px;
  }

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
    transition: border-color 0.2s;
  }
  .ntc-group.selected { border-color: var(--interactive-accent); }
  .ntc-group.dragover { border-color: var(--text-success); background: rgba(72, 187, 120, 0.05); }

  .ntc-group-head {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
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
  }
  .ntc-group-name:focus { outline: none; border-bottom: 1px solid var(--interactive-accent); }

  .ntc-group-del {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
  }
  .ntc-group-del:hover { color: var(--text-error); }

  .ntc-group-body {
    padding: 16px;
    min-height: 50px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-content: flex-start;
  }
  .ntc-group-body.empty {
    justify-content: center;
    align-items: center;
  }

  .ntc-placeholder {
    color: var(--text-muted);
    font-size: 13px;
  }

  .ntc-btn-add-group {
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
  }
  .ntc-btn-add-group:hover {
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

  .ntc-btn {
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .ntc-btn-cancel {
    background: var(--background-secondary);
    border: none;
    color: var(--text-normal);
  }
  .ntc-btn-cancel:hover { background: var(--background-modifier-hover); }

  .ntc-btn-save {
    background: var(--interactive-accent);
    border: none;
    color: var(--text-on-accent);
  }
  .ntc-btn-save:hover { opacity: 0.9; }
</style>
