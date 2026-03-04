<script lang="ts">
  import type { TestGenConfig, QuestionType, DifficultyLevel } from '../../types/ai-types';
  import type { Deck } from '../../data/types';
  import ObsidianDropdown from '../ui/ObsidianDropdown.svelte';
  
  interface Props {
    config: TestGenConfig;
    availableDecks: Deck[];
    onChange: (config: TestGenConfig) => void;
  }
  
  let { config, availableDecks, onChange }: Props = $props();
  
  // 题目类型选项
  const questionTypeOptions: Array<{value: QuestionType; label: string}> = [
    { value: 'single', label: '单选题' },
    { value: 'multiple', label: '多选题' },
    { value: 'judge', label: '判断题' },
    { value: 'fill', label: '填空题' }
  ];
  
  // 难度级别选项
  const difficultyOptions: Array<{value: DifficultyLevel; label: string}> = [
    { value: 'easy', label: '简单' },
    { value: 'medium', label: '中等' },
    { value: 'hard', label: '困难' },
    { value: 'mixed', label: '混合' }
  ];
  
  function updateConfig(partial: Partial<TestGenConfig>) {
    onChange({ ...config, ...partial });
  }
</script>

<div class="test-gen-config-panel">
  <div class="section-header">
    <h4 class="section-title">生成配置</h4>
  </div>
  
  <!-- 生成数量 -->
  <div class="config-row">
    <label class="config-label" for="gen-count-input">生成数量</label>
    <div class="input-with-suffix">
      <input
        id="gen-count-input"
        type="number"
        min="1"
        max="20"
        value={config.defaultCount}
        oninput={(e) => updateConfig({ defaultCount: parseInt((e.target as HTMLInputElement).value) || 1 })}
        class="number-input"
        aria-label="生成数量"
      />
      <span class="input-suffix">张</span>
    </div>
  </div>
  
  <!-- 题目类型 -->
  <div class="config-row">
    <div class="config-label" id="question-type-label">题目类型</div>
    <div class="radio-group" role="group" aria-labelledby="question-type-label">
      {#each questionTypeOptions as option}
        <label class="radio-item">
          <input
            type="radio"
            name="questionType"
            value={option.value}
            checked={config.questionType === option.value}
            onchange={() => updateConfig({ questionType: option.value })}
          />
          <span>{option.label}</span>
        </label>
      {/each}
    </div>
  </div>
  
  <!-- 难度级别 -->
  <div class="config-row">
    <div class="config-label" id="difficulty-label">难度级别</div>
    <div class="radio-group" role="group" aria-labelledby="difficulty-label">
      {#each difficultyOptions as option}
        <label class="radio-item">
          <input
            type="radio"
            name="difficulty"
            value={option.value}
            checked={config.difficultyLevel === option.value}
            onchange={() => updateConfig({ difficultyLevel: option.value })}
          />
          <span>{option.label}</span>
        </label>
      {/each}
    </div>
  </div>
  
  <!-- 导出策略 -->
  <div class="config-row">
    <div class="config-label" id="export-strategy-label">导出到</div>
    <div class="export-strategy" role="group" aria-labelledby="export-strategy-label">
      <label class="radio-item">
        <input
          type="radio"
          name="targetStrategy"
          value="auto"
          checked={config.targetDeckStrategy === 'auto'}
          onchange={() => updateConfig({ targetDeckStrategy: 'auto', targetDeckId: undefined })}
        />
        <span>自动创建对应的考试牌组</span>
      </label>
      
      <label class="radio-item">
        <input
          type="radio"
          name="targetStrategy"
          value="manual"
          checked={config.targetDeckStrategy === 'manual'}
          onchange={() => updateConfig({ targetDeckStrategy: 'manual' })}
        />
        <span>手动指定牌组</span>
      </label>
      
      {#if config.targetDeckStrategy === 'manual'}
        <ObsidianDropdown
          className="deck-select"
          options={[
            { id: '', label: '请选择目标牌组' },
            ...availableDecks
              .filter((d) => d.deckType === 'question-bank' || d.purpose === 'test')
              .map((deck) => ({ id: deck.id, label: deck.name }))
          ]}
          value={config.targetDeckId || ''}
          onchange={(value) => updateConfig({ targetDeckId: value })}
        />
      {/if}
    </div>
  </div>
  
  <div class="config-hint">
    自动模式会为当前牌组创建配套的考试牌组，手动模式可指定已存在的题库牌组
  </div>
</div>

<style>
  .test-gen-config-panel {
    padding: 16px 0; /* 只保留上下padding，移除左右padding以与其他section对齐 */
    background: var(--background-secondary);
    border-radius: 8px;
    margin-bottom: 16px;
  }
  
  /*  Section Header - 带彩色侧边条 */
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    position: relative;
    padding-left: 16px;
  }
  
  .section-header::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 1.2em;
    border-radius: 2px;
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.8), rgba(234, 88, 12, 0.6));
  }
  
  .section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    flex: 1;
  }
  
  .config-row {
    margin-bottom: 16px;
  }
  
  .config-row:last-child {
    margin-bottom: 0;
  }
  
  .config-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }
  
  .input-with-suffix {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .number-input {
    width: 80px;
    padding: 6px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    font-size: 13px;
  }
  
  .number-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  .input-suffix {
    font-size: 13px;
    color: var(--text-muted);
  }
  
  .radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .radio-item {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 6px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: all 0.2s ease;
  }
  
  .radio-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  .radio-item input[type="radio"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  
  .radio-item input[type="radio"]:checked + span {
    color: var(--interactive-accent);
    font-weight: 600;
  }
  
  .radio-item span {
    font-size: 13px;
    color: var(--text-normal);
    user-select: none;
  }
  
  .export-strategy {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .deck-select {
    width: 100%;
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    font-size: 13px;
    margin-top: 8px;
  }
  
  .deck-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  :global(.obsidian-dropdown-trigger.deck-select) {
    width: 100%;
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    font-size: 13px;
    margin-top: 8px;
    min-height: 0;
  }

  :global(.obsidian-dropdown-trigger.deck-select:focus-visible) {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: none;
  }
  
  .config-hint {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--background-primary);
    border-left: 3px solid var(--interactive-accent);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }
</style>

