<script lang="ts">
  import type { Card } from '../../../data/types';
  import StatusBadge from "../../ui/StatusBadge.svelte";
  import EnhancedIcon from "../../ui/EnhancedIcon.svelte";
  import DraggableCheckboxWrapper from "./DraggableCheckboxWrapper.svelte";
  import { ICON_NAMES } from "../../../icons/index.js";
  import { formatRelativeTimeDetailed } from "../../../utils/helpers.js";
  import { truncateText, getFieldTemplateInfo, getSourceDocumentStatusInfo } from "../utils/table-utils";
  import BasicCell from "./cells/BasicCell.svelte";
  import TagsCell from "./cells/TagsCell.svelte";
  import PriorityCell from "./cells/PriorityCell.svelte";
  import DeckCell from "./cells/DeckCell.svelte";
  import LinkCell from "./cells/LinkCell.svelte";
  import ActionsCell from "./cells/ActionsCell.svelte";
  import ReviewDataCell from "./cells/ReviewDataCell.svelte";
  import ModifiedCell from "./cells/ModifiedCell.svelte";
  import type { TableRowProps, ColumnKey } from "../types/table-types";

  let { 
    card, 
    selected, 
    columnVisibility, 
    columnOrder,
    tableViewMode,
    callbacks, 
    plugin, 
    decks = [], 
    fieldTemplates = [], 
    availableTags = [], 
    onSelect,
    onDragSelectStart,
    onDragSelectMove,
    isDragSelectActive,
    isVisible = true //  性能优化：默认可见
  }: TableRowProps = $props();
  
  //  修复抖动：移除条件渲染逻辑，改用CSS控制显示
  // 原因：条件渲染会导致DOM添加/删除，触发整个表格重新布局
  // 解决方案：始终渲染ActionsCell，用CSS的opacity控制可见性
  
  // 获取源文件名
  function getSourceFileName(card: any): string {
    if (card.sourceFile) {
      return card.sourceFile.split('/').pop() || card.sourceFile;
    }
    if (card.customFields?.obsidianFilePath) {
      const path = card.customFields.obsidianFilePath as string;
      return path.split('/').pop() || path;
    }
    return '';
  }

  function handleRowSelect(checked: boolean) {
    onSelect(card.uuid, checked);
  }

  // 格式化创建时间
  function formatFixedTime(dateString: string | number | null | undefined): string {
    if (!dateString) return '-';
    
    try {
      let date: Date;
      if (typeof dateString === 'string' && /^\d+$/.test(dateString)) {
        date = new Date(Number(dateString));
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return '-';
      }
      
      const now = new Date();
      const isToday = date.getFullYear() === now.getFullYear() &&
                      date.getMonth() === now.getMonth() &&
                      date.getDate() === now.getDate();
      
      if (isToday) {
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${hour}:${minute}`;
      } else {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      return '-';
    }
  }

  //  性能优化：使用memo缓存计算结果
  //  修复：为可能为undefined的templateId提供默认值
  let templateInfo = $state(getFieldTemplateInfo(card.templateId || '', fieldTemplates, plugin));
  let sourceStatusInfo = $state(getSourceDocumentStatusInfo((card as any).sourceDocumentStatus || ''));

  // 🆕 获取卡片所属牌组名称列表（用于徽章样式显示）
  function getCardDeckNames(): string[] {
    const names: string[] = [];
    for (const deck of decks) {
      if ('cardUUIDs' in deck && deck.cardUUIDs?.includes(card.uuid)) {
        if (deck.name && !names.includes(deck.name)) {
          names.push(deck.name);
        }
      }
    }
    return names;
  }

  let cardDeckNames = $derived.by(() => {
    if (!isVisible) return [];
    const names: string[] = [];
    const seen = new Set<string>();
    for (const deck of decks) {
      if ('cardUUIDs' in deck && deck.cardUUIDs?.includes(card.uuid)) {
        if (deck.name && !seen.has(deck.name)) {
          seen.add(deck.name);
          names.push(deck.name);
        }
      }
    }
    return names;
  });
  
  // 在属性变化时更新
  $effect(() => {
    //  性能优化：不可见时跳过计算
    if (!isVisible) return;
    
    //  修复：为可能为undefined的templateId提供默认值
    templateInfo = getFieldTemplateInfo(card.templateId || '', fieldTemplates, plugin);
    sourceStatusInfo = getSourceDocumentStatusInfo((card as any).sourceDocumentStatus || '');
  });

  // v5.6: IR状态辅助函数 - 支持 V3 和 V4 状态格式
  function getIRStateClass(state: string | undefined): string {
    const s = state || 'new';
    // V4 状态映射到 V3 CSS 类名
    if (s === 'queued' || s === 'active') return 'learning';
    if (s === 'scheduled') return 'review';
    if (s === 'done') return 'done';
    return s; // new, learning, review, suspended 直接返回
  }

  function getIRStateLabel(state: string | undefined): string {
    const s = state || 'new';
    if (s === 'new') return '新导入';
    if (s === 'learning' || s === 'queued' || s === 'active') return '阅读中';
    if (s === 'review' || s === 'scheduled') return '复习';
    if (s === 'suspended') return '已暂停';
    if (s === 'done') return '已完成';
    return '未知';
  }
</script>

<tr 
  class="weave-table-row" 
  class:selected={selected}
>
  <!-- 复选框列（固定） -->
  <td class="weave-checkbox-column">
    <DraggableCheckboxWrapper
      checked={selected}
      onchange={handleRowSelect}
      ariaLabel="选择卡片"
      cardId={card.uuid}
      {onDragSelectStart}
      {onDragSelectMove}
      {isDragSelectActive}
    />
  </td>

  <!-- 动态列 -->
  {#each columnOrder as columnKey (columnKey)}
    {#if columnKey === 'front'}
      <td class="weave-content-column weave-front-column">
        <div class="weave-cell-content">
          <span class="weave-text-content">
            {truncateText((card as any).front || card.fields?.front || card.fields?.question || '')}
          </span>
        </div>
      </td>
    {:else if columnKey === 'back'}
      <td class="weave-content-column weave-back-column">
        <div class="weave-cell-content">
          <span class="weave-text-content">
            {truncateText((card as any).back || card.fields?.back || card.fields?.answer || '')}
          </span>
        </div>
      </td>
    {:else if columnKey === 'status'}
      <td class="weave-status-column"><StatusBadge state={card.fsrs ? card.fsrs.state : 0} /></td>
    {:else if columnKey === 'deck'}
      <!-- 🆕 记忆牌组：使用与IR模式相同的徽章样式 -->
      <td class="weave-deck-column">
        <div class="weave-decks-container">
          {#if cardDeckNames.length > 0}
            {#each cardDeckNames.slice(0, 2) as deckName}
              <span class="weave-deck-badge" title={deckName}>
                {truncateText(deckName, 12)}
              </span>
            {/each}
            {#if cardDeckNames.length > 2}
              <span class="weave-deck-more" title={cardDeckNames.join('\n')}>
                +{cardDeckNames.length - 2}
              </span>
            {/if}
          {:else}
            <span class="weave-text-muted">未分配</span>
          {/if}
        </div>
      </td>
    {:else if columnKey === 'tags'}
      <TagsCell {card} {availableTags} onTagsUpdate={callbacks.onTagsUpdate} />
    {:else if columnKey === 'priority'}
      <PriorityCell {card} onPriorityUpdate={callbacks.onPriorityUpdate} />
    {:else if columnKey === 'uuid'}
      <td class="weave-uuid-column">
        <div class="weave-cell-content">
          <span class="weave-uuid-text" title={card.uuid}>
            <EnhancedIcon name={ICON_NAMES.HASH} size={14} />
            {truncateText(card.uuid || 'N/A', 8)}
          </span>
        </div>
      </td>
    {:else if columnKey === 'created'}
      <td class="weave-date-column">
        <span class="weave-text-content">{formatFixedTime(card.created)}</span>
      </td>
    {:else if columnKey === 'modified'}
      <ModifiedCell {card} />
    {:else if columnKey === 'next_review' || columnKey === 'retention' || columnKey === 'interval' || columnKey === 'difficulty' || columnKey === 'review_count'}
      <ReviewDataCell {card} column={columnKey} />
    {:else if columnKey === 'source_document'}
      <td class="weave-source-document-column">
        {#if card.sourceFile || card.customFields?.obsidianFilePath}
          <button 
            class="weave-source-link"
            onclick={() => callbacks.onJumpToSource?.(card)}
            title={card.sourceBlock || (card.customFields?.blockId) 
              ? "点击打开源文档并定位到块引用位置" 
              : "点击打开源文档"}
          >
            <EnhancedIcon name="file-text" size={14} />
            <span>{truncateText(getSourceFileName(card), 20)}</span>
            {#if card.sourceBlock || (card.customFields?.blockId)}
              <EnhancedIcon name="link" size={12} class="weave-has-block-indicator" />
            {/if}
          </button>
        {:else}
          <span class="weave-text-muted">-</span>
        {/if}
      </td>
    {:else if columnKey === 'field_template'}
      <td class="weave-field-template-column">
        {#if templateInfo}
          <div class="weave-cell-content">
            <EnhancedIcon name={templateInfo.icon} size={14} />
            <span class={templateInfo.class}>{templateInfo.name}</span>
          </div>
        {:else}
          <span class="weave-text-muted">未知</span>
        {/if}
      </td>
    {:else if columnKey === 'source_document_status'}
      <td class="weave-source-status-column">
        {#if card.sourceFile || card.customFields?.obsidianFilePath}
          <div class="weave-cell-content">
            <EnhancedIcon name={sourceStatusInfo.icon} size={14} />
            <span class={sourceStatusInfo.class} title={sourceStatusInfo.tooltip}>
              {sourceStatusInfo.text}
            </span>
          </div>
        {:else}
          <span class="weave-text-muted">-</span>
        {/if}
      </td>
    {:else if columnKey === 'question_type'}
      <td class="weave-question-type-column">
        <span class="weave-text-content">{(card as any).question_type || '-'}</span>
      </td>
    {:else if columnKey === 'accuracy'}
      <td class="weave-accuracy-column">
        <span class="weave-text-content {(card as any).accuracy_class || ''}">
          {(card as any).accuracy || '-'}
        </span>
      </td>
    {:else if columnKey === 'test_attempts'}
      <td class="weave-test-attempts-column">
        <span class="weave-text-content">{(card as any).test_attempts || 0}</span>
      </td>
    {:else if columnKey === 'last_test'}
      <td class="weave-last-test-column">
        <span class="weave-text-content">{(card as any).last_test || '-'}</span>
      </td>
    {:else if columnKey === 'error_level'}
      <td class="weave-error-level-column">
        <span class="weave-text-content">{(card as any).error_level || '-'}</span>
      </td>
    {:else if columnKey === 'source_card'}
      <td class="weave-source-card-column">
        <span class="weave-text-content" title={(card as any).source_card || '-'}>
          {truncateText((card as any).source_card || '-', 30)}
        </span>
      </td>
    {:else if columnKey === 'ir_title'}
      <!-- 🆕 IR专用列：标题 -->
      <td class="weave-ir-title-column">
        <div class="weave-cell-content">
          <span class="weave-text-content" title={(card as any).ir_title || '-'}>
            {truncateText((card as any).ir_title || '-', 50)}
          </span>
        </div>
      </td>
    {:else if columnKey === 'ir_source_file'}
      <!-- 🆕 IR专用列：源文档 -->
      <td class="weave-ir-source-file-column">
        <span class="weave-text-content" title={(card as any).ir_source_file || '-'}>
          {truncateText((card as any).ir_source_file?.split('/').pop() || '-', 25)}
        </span>
      </td>
    {:else if columnKey === 'ir_state'}
      <!-- 🆕 IR专用列：阅读状态 -->
      <!-- v5.6: 支持 V3 状态(new/learning/review/suspended) 和 V4 状态(queued/scheduled/active/done) -->
      <td class="weave-ir-state-column">
        <span class="weave-state-badge weave-state-{getIRStateClass((card as any).ir_state)}">
          {getIRStateLabel((card as any).ir_state)}
        </span>
      </td>
    {:else if columnKey === 'ir_priority'}
      <!-- 🆕 IR专用列：优先级 -->
      <td class="weave-ir-priority-column">
        <span class="weave-priority-badge weave-priority-{(card as any).ir_priority || 2}">
          {(card as any).ir_priority === 1 ? '高' : 
           (card as any).ir_priority === 2 ? '中' : 
           (card as any).ir_priority === 3 ? '低' : '中'}
        </span>
      </td>
    {:else if columnKey === 'ir_tags'}
      <!-- 🆕 IR专用列：标签 -->
      <td class="weave-ir-tags-column">
        <div class="weave-tags-container">
          {#each ((card as any).ir_tags || []).slice(0, 3) as tag}
            <span class="weave-tag">{tag}</span>
          {/each}
          {#if ((card as any).ir_tags || []).length > 3}
            <span class="weave-tag-more">+{(card as any).ir_tags.length - 3}</span>
          {/if}
        </div>
      </td>
    {:else if columnKey === 'ir_favorite'}
      <!-- 🆕 IR专用列：收藏（使用星标图标） -->
      <td class="weave-ir-favorite-column">
        <EnhancedIcon
          name="star"
          size={16}
          variant={(card as any).ir_favorite ? 'warning' : 'muted'}
        />
      </td>
    {:else if columnKey === 'ir_next_review'}
      <!-- 🆕 IR专用列：下次复习 -->
      <td class="weave-ir-next-review-column">
        <span class="weave-text-content">
          {(card as any).ir_next_review ? formatFixedTime((card as any).ir_next_review) : '-'}
        </span>
      </td>
    {:else if columnKey === 'ir_review_count'}
      <!-- 🆕 IR专用列：复习次数 -->
      <td class="weave-ir-review-count-column">
        <span class="weave-text-content">{(card as any).ir_review_count || 0}</span>
      </td>
    {:else if columnKey === 'ir_reading_time'}
      <!-- 🆕 IR专用列：阅读时长 -->
      <td class="weave-ir-reading-time-column">
        <span class="weave-text-content">
          {(() => {
            const totalSeconds = (card as any).ir_reading_time || 0;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            if (hours > 0) {
              return `${hours}小时${minutes}分`;
            } else if (minutes > 0) {
              return `${minutes}分钟`;
            } else {
              return '0分钟';
            }
          })()}
        </span>
      </td>
    {:else if columnKey === 'ir_notes'}
      <!-- 🆕 IR专用列：笔记 -->
      <td class="weave-ir-notes-column">
        <span class="weave-text-content" title={(card as any).ir_notes || ''}>
          {truncateText((card as any).ir_notes || '-', 30)}
        </span>
      </td>
    {:else if columnKey === 'ir_extracted_cards'}
      <!-- 🆕 IR专用列：已提取卡片 -->
      <td class="weave-ir-extracted-cards-column">
        <span class="weave-text-content">{(card as any).ir_extracted_cards || 0}张</span>
      </td>
    {:else if columnKey === 'ir_created'}
      <!-- 🆕 IR专用列：创建时间 -->
      <td class="weave-ir-created-column">
        <span class="weave-text-content">{formatFixedTime((card as any).ir_created)}</span>
      </td>
    {:else if columnKey === 'ir_decks'}
      <!-- 🆕 IR专用列：所属牌组（引入式架构，支持多牌组） -->
      <!-- v5.5: 优先使用 ir_deck_ids（多牌组），回退到 ir_deck（单牌组兼容） -->
      <td class="weave-ir-decks-column">
        <div class="weave-decks-container">
          {#if (card as any).ir_deck_ids?.length > 0}
            <!-- v5.5: 新版多牌组显示 -->
            {#each ((card as any).ir_deck_ids || []).slice(0, 3) as deckId}
              {@const deck = decks.find(d => d.id === deckId)}
              <span class="weave-deck-badge" title={deck?.name || deckId}>
                {truncateText(deck?.name || deckId, 12)}
              </span>
            {/each}
            {#if (card as any).ir_deck_ids.length > 3}
              <span class="weave-deck-more" title="还有 {(card as any).ir_deck_ids.length - 3} 个牌组">
                +{(card as any).ir_deck_ids.length - 3}
              </span>
            {/if}
          {:else if (card as any).ir_deck && (card as any).ir_deck !== '未分配'}
            <!-- v5.4: 兼容单牌组显示 -->
            <span class="weave-deck-badge" title={(card as any).ir_deck}>
              {truncateText((card as any).ir_deck, 15)}
            </span>
          {:else if (card as any).metadata?.deckIds?.length > 0}
            <!-- 旧版 IRBlock 使用 deckIds -->
            {#each ((card as any).metadata.deckIds || []).slice(0, 3) as deckId}
              {@const deck = decks.find(d => d.id === deckId)}
              <span class="weave-deck-badge" title={deck?.name || deckId}>
                {truncateText(deck?.name || deckId, 12)}
              </span>
            {/each}
            {#if (card as any).metadata.deckIds.length > 3}
              <span class="weave-deck-more" title="还有 {(card as any).metadata.deckIds.length - 3} 个牌组">
                +{(card as any).metadata.deckIds.length - 3}
              </span>
            {/if}
          {:else}
            <span class="weave-text-muted">未分配</span>
          {/if}
        </div>
      </td>
    {:else if columnKey === 'actions'}
      <!--  修复：始终渲染ActionsCell，避免条件渲染导致的DOM变化和抖动 -->
      <td class="weave-actions-column">
        <ActionsCell 
          {card} 
          onView={callbacks.onView}
          onTempFileEdit={callbacks.onTempFileEdit}
          onEdit={callbacks.onEdit}
          onDelete={callbacks.onDelete}
        />
      </td>
    {/if}
  {/each}
</tr>

<style>
  @import '../styles/cell-common.css';

  /*  修复：移除占位符样式，因为不再使用条件渲染 */

  .weave-table-row {
    border-bottom: 1px solid var(--background-modifier-border);
    transition: all 0.15s ease;
    position: relative;
  }

  /*  增强hover效果 - 参考Notion设计 */
  .weave-table-row:hover {
    background: var(--background-modifier-hover);
    box-shadow: inset 0 0 0 1px var(--background-modifier-border-hover);
    z-index: 1;
  }

  /*  选中状态 */
  .weave-table-row.selected {
    background: rgba(var(--color-accent-rgb), 0.1);
  }

  /*  选中且hover - 组合效果 */
  .weave-table-row.selected:hover {
    background: rgba(var(--color-accent-rgb), 0.15);
    box-shadow: inset 0 0 0 1px rgba(var(--color-accent-rgb), 0.3);
  }

  .weave-table-row td {
    padding: 10px 16px;
    border-right: 1px solid var(--background-modifier-border);
    vertical-align: middle;
    /*  修复：确保文本不超出列边框 */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 0; /* 配合 table-layout: fixed 实现省略 */
  }

  /*  修复：使用更高优先级选择器确保复选框列样式正确 */
  .weave-table-row .weave-checkbox-column {
    width: 48px;
    min-width: 48px;
    max-width: 48px;
    text-align: center;
    /*  修复：与表头 th 的 padding 完全一致 */
    padding: 10px 16px;
    /*  修复：移除复选框列的省略号效果 */
    text-overflow: clip;
    overflow: visible;
  }
  
  /*  修复：添加actions列样式（从ActionsCell移过来） */
  .weave-actions-column {
    width: 60px;
    min-width: 60px;
    max-width: 60px;
    text-align: center;
  }

  /*  源文档列 - 确保无底色差异 + 文本省略 */
  .weave-source-document-column {
    background: transparent;
  }

  .weave-source-document-column .weave-source-link {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    /*  修复：确保按钮内容不超出列边框 */
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    overflow: hidden;
  }
  
  .weave-source-document-column .weave-source-link span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  
  /*  通用文本内容省略样式 */
  .weave-text-content {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .weave-cell-content {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    overflow: hidden;
  }
  
  .weave-cell-content span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  /* 🆕 IR牌组列样式 */
  .weave-decks-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .weave-deck-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    font-size: 0.75rem;
    color: var(--text-muted);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weave-deck-more {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  /* 🆕 IR状态徽章样式 - 参考记忆牌组StatusBadge设计 */
  .weave-state-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .weave-state-new {
    background: rgba(var(--color-blue-rgb, 66, 153, 225), 0.15);
    color: var(--color-blue, #4299e1);
  }

  .weave-state-learning {
    background: rgba(var(--color-orange-rgb, 237, 137, 54), 0.15);
    color: var(--color-orange, #ed8936);
  }

  .weave-state-review {
    background: rgba(var(--color-green-rgb, 72, 187, 120), 0.15);
    color: var(--color-green, #48bb78);
  }

  .weave-state-suspended {
    background: rgba(var(--color-gray-rgb, 113, 128, 150), 0.15);
    color: var(--text-muted);
  }

  .weave-state-done {
    background: rgba(var(--color-purple-rgb, 128, 90, 213), 0.15);
    color: var(--color-purple, #805ad5);
  }

  /* 🆕 IR优先级徽章样式 - 参考记忆牌组设计 */
  .weave-priority-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .weave-priority-1 {
    background: rgba(var(--color-red-rgb, 245, 101, 101), 0.15);
    color: var(--color-red, #f56565);
  }

  .weave-priority-2 {
    background: rgba(var(--color-yellow-rgb, 236, 201, 75), 0.15);
    color: var(--color-yellow, #ecc94b);
  }

  .weave-priority-3 {
    background: rgba(var(--color-green-rgb, 72, 187, 120), 0.15);
    color: var(--color-green, #48bb78);
  }

  /* 🆕 IR标签容器样式 */
  .weave-tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    width: 100%;
    min-width: 0;
  }

  .weave-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    background: var(--background-modifier-hover);
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
    flex-shrink: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weave-tag-more {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
  }
</style>


