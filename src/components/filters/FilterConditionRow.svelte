<script lang="ts">
  import type { FilterCondition, FilterField, FilterOperator } from "../../types/filter-types";
  import { FILTER_FIELD_CONFIGS, FILTER_OPERATOR_CONFIGS } from "../../types/filter-types";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import ObsidianDropdown from "../ui/ObsidianDropdown.svelte";
  import type { Deck } from "../../data/types";

  interface Props {
    condition: FilterCondition;
    availableDecks?: Deck[];
    availableTags?: string[];
    onUpdate: (updates: Partial<FilterCondition>) => void;
    onRemove: () => void;
  }

  let { condition, availableDecks = [], availableTags = [], onUpdate, onRemove }: Props = $props();

  // 当前字段配置
  let fieldConfig = $derived(FILTER_FIELD_CONFIGS.find(f => f.field === condition.field) || FILTER_FIELD_CONFIGS[0]);
  
  // 当前操作符配置
  let operatorConfig = $derived(FILTER_OPERATOR_CONFIGS.find(o => o.operator === condition.operator) || FILTER_OPERATOR_CONFIGS[0]);

  // 处理字段变更
  function handleFieldChange(field: FilterField) {
    const newFieldConfig = FILTER_FIELD_CONFIGS.find(f => f.field === field);
    if (!newFieldConfig) return;

    // 选择该字段的第一个可用操作符
    const newOperator = newFieldConfig.operators[0];
    
    onUpdate({
      field,
      operator: newOperator,
      value: ''
    });
  }

  // 处理操作符变更
  function handleOperatorChange(operator: FilterOperator) {
    onUpdate({ operator });
  }

  // 处理值变更
  function handleValueChange(value: string | number) {
    onUpdate({ value });
  }

  // 切换启用状态
  function toggleEnabled() {
    onUpdate({ enabled: !condition.enabled });
  }

  // 状态选项
  const statusOptions = [
    { value: 'new', label: '新卡片' },
    { value: 'learning', label: '学习中' },
    { value: 'review', label: '复习中' },
    { value: 'mastered', label: '已掌握' }
  ];
</script>

<div class="filter-condition-row" class:disabled={!condition.enabled}>
  <!-- 启用/禁用切换 -->
  <button 
    class="toggle-btn" 
    class:enabled={condition.enabled}
    onclick={toggleEnabled}
    title={condition.enabled ? '点击禁用此条件' : '点击启用此条件'}
  >
    <EnhancedIcon name={condition.enabled ? 'check-circle' : 'circle'} size={16} />
  </button>

  <!-- 字段选择 -->
  <ObsidianDropdown
    className="field-select"
    options={FILTER_FIELD_CONFIGS.map((config) => ({ id: config.field, label: config.label }))}
    value={condition.field}
    onchange={(value) => handleFieldChange(value as FilterField)}
  />

  <!-- 操作符选择 -->
  <ObsidianDropdown
    className="operator-select"
    options={fieldConfig.operators
      .map((op) => {
        const opConfig = FILTER_OPERATOR_CONFIGS.find((c) => c.operator === op);
        if (!opConfig) return null;
        return { id: op, label: opConfig.label };
      })
      .filter(Boolean) as any}
    value={condition.operator}
    onchange={(value) => handleOperatorChange(value as FilterOperator)}
  />

  <!-- 值输入 -->
  {#if operatorConfig.requiresValue}
    <div class="value-input">
      {#if fieldConfig.type === 'select'}
        {#if fieldConfig.field === 'status'}
          <ObsidianDropdown
            className="value-select"
            options={[
              { id: '', label: '选择状态...' },
              ...statusOptions.map((opt) => ({ id: opt.value, label: opt.label }))
            ]}
            value={String(condition.value ?? '')}
            onchange={(value) => handleValueChange(value)}
          />
        {:else if fieldConfig.field === 'deck'}
          <ObsidianDropdown
            className="value-select"
            options={[
              { id: '', label: '选择牌组...' },
              ...availableDecks.map((deck) => ({ id: deck.id, label: deck.name }))
            ]}
            value={String(condition.value ?? '')}
            onchange={(value) => handleValueChange(value)}
          />
        {/if}
      {:else if fieldConfig.type === 'multiselect' && fieldConfig.field === 'tags'}
        <ObsidianDropdown
          className="value-select"
          options={[
            { id: '', label: '选择标签...' },
            ...availableTags.map((tag) => ({ id: tag, label: tag }))
          ]}
          value={String(condition.value ?? '')}
          onchange={(value) => handleValueChange(value)}
        />
      {:else if fieldConfig.type === 'number' || operatorConfig.valueType === 'number'}
        <input
          type="number"
          class="value-number"
          value={condition.value}
          placeholder="输入数值..."
          oninput={(e) => handleValueChange(parseFloat(e.currentTarget.value) || 0)}
        />
      {:else if fieldConfig.type === 'date'}
        <input
          type="date"
          class="value-date"
          value={condition.value}
          oninput={(e) => handleValueChange(e.currentTarget.value)}
        />
      {:else}
        <input
          type="text"
          class="value-text"
          value={condition.value}
          placeholder="输入值..."
          oninput={(e) => handleValueChange(e.currentTarget.value)}
        />
      {/if}
    </div>
  {/if}

  <!-- 删除按钮 -->
  <button class="remove-btn" onclick={onRemove} title="删除此条件">
    <EnhancedIcon name="x" size={16} />
  </button>
</div>

<style>
  .filter-condition-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    transition: opacity 0.2s ease, background-color 0.2s ease;
  }

  .filter-condition-row.disabled {
    opacity: 0.5;
  }

  .filter-condition-row:hover {
    background: var(--background-modifier-hover);
  }

  .toggle-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-s);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
  }

  .toggle-btn:hover {
    background: var(--background-modifier-hover);
  }

  .toggle-btn.enabled {
    color: var(--interactive-accent);
  }

  .value-text,
  .value-number,
  .value-date {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: 0.875rem;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  .value-text:focus,
  .value-number:focus,
  .value-date:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .value-input {
    flex: 1;
    min-width: 0;
  }

  .value-text,
  .value-number,
  .value-date {
    width: 100%;
  }

  :global(.obsidian-dropdown-trigger.field-select) {
    min-width: 120px;
    flex-shrink: 0;
  }

  :global(.obsidian-dropdown-trigger.operator-select) {
    min-width: 100px;
    flex-shrink: 0;
  }

  :global(.obsidian-dropdown-trigger.value-select) {
    width: 100%;
  }

  :global(.obsidian-dropdown-trigger.field-select),
  :global(.obsidian-dropdown-trigger.operator-select),
  :global(.obsidian-dropdown-trigger.value-select) {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: 0.875rem;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    transition: border-color 0.2s ease;
    min-height: 0;
  }

  :global(.obsidian-dropdown-trigger.field-select:focus-visible),
  :global(.obsidian-dropdown-trigger.operator-select:focus-visible),
  :global(.obsidian-dropdown-trigger.value-select:focus-visible) {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: none;
  }

  .value-text::placeholder,
  .value-number::placeholder {
    color: var(--text-muted);
  }

  .remove-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-s);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease, background-color 0.2s ease;
  }

  .remove-btn:hover {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .filter-condition-row {
      flex-wrap: wrap;
    }

    :global(.obsidian-dropdown-trigger.field-select),
    :global(.obsidian-dropdown-trigger.operator-select) {
      flex: 1;
      min-width: 100px;
    }

    .value-input {
      flex-basis: 100%;
    }
  }
</style>

