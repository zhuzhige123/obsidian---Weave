<script lang="ts">
  import EnhancedIcon from "../../../ui/EnhancedIcon.svelte";
  //  导入国际化
  import { tr } from '../../../../utils/i18n';

  interface Props {
    cardSplitting: {
      enabled: boolean;
      defaultTargetCount: number;
      minContentLength: number;
      maxContentLength: number;
      autoInheritTags: boolean;
      autoInheritSource: boolean;
      requireConfirmation: boolean;
      defaultInstruction: string;
    };
  }

  let { cardSplitting = $bindable() }: Props = $props();

  //  响应式翻译函数
  let t = $derived($tr);
  
  //  提示词编辑开关状态
  let enablePromptEditing = $state(false);
</script>

<div class="card-splitting-config">
  <!-- 启用AI拆分 -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">
        <EnhancedIcon name="split" size={16} />
        {t('aiConfig.cardSplitting.enabled.label')}
      </div>
      <div class="setting-item-description">
        {t('aiConfig.cardSplitting.enabled.description')}
      </div>
    </div>
    <div class="setting-item-control">
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={cardSplitting.enabled} />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>

  {#if cardSplitting.enabled}
    <!-- 默认生成数量 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('aiConfig.cardSplitting.defaultTargetCount.label')}</div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.defaultTargetCount.description')}
        </div>
      </div>
      <div class="setting-item-control">
        <input
          type="number"
          min="0"
          max="10"
          bind:value={cardSplitting.defaultTargetCount}
          class="number-input"
        />
      </div>
    </div>

    <!-- 最小内容长度 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('aiConfig.cardSplitting.minContentLength.label')}</div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.minContentLength.description')}
        </div>
      </div>
      <div class="setting-item-control">
        <input
          type="number"
          min="50"
          max="1000"
          step="50"
          bind:value={cardSplitting.minContentLength}
          class="number-input"
        />
      </div>
    </div>

    <!-- 最大内容长度 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('aiConfig.cardSplitting.maxContentLength.label')}</div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.maxContentLength.description')}
        </div>
      </div>
      <div class="setting-item-control">
        <input
          type="number"
          min="1000"
          max="10000"
          step="500"
          bind:value={cardSplitting.maxContentLength}
          class="number-input"
        />
      </div>
    </div>

    <!-- 自动继承标签 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">
          {t('aiConfig.cardSplitting.autoInheritTags.label')}
        </div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.autoInheritTags.description')}
        </div>
      </div>
      <div class="setting-item-control">
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={cardSplitting.autoInheritTags} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 自动继承来源 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">
          {t('aiConfig.cardSplitting.autoInheritSource.label')}
        </div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.autoInheritSource.description')}
        </div>
      </div>
      <div class="setting-item-control">
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={cardSplitting.autoInheritSource} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 收入前确认 -->
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">
          {t('aiConfig.cardSplitting.requireConfirmation.label')}
        </div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.requireConfirmation.description')}
        </div>
      </div>
      <div class="setting-item-control">
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={cardSplitting.requireConfirmation} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 默认拆分指令（带编辑保护） -->
    <div class="setting-item prompt-setting-clean">
      <div class="setting-item-info">
        <div class="setting-item-name">
          {t('aiConfig.cardSplitting.defaultInstruction.label')}
        </div>
        <div class="setting-item-description">
          {t('aiConfig.cardSplitting.defaultInstruction.description')}
        </div>
      </div>
      
      <!-- 编辑开关 -->
      <div class="setting-item-control">
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={enablePromptEditing} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <!-- 提示词编辑区域 -->
    <div class="prompt-editor-area">
      <!-- 状态提示 -->
      {#if !enablePromptEditing}
        <div class="prompt-locked">
          <EnhancedIcon name="lock" size={14} />
          <span>{t('aiConfig.cardSplitting.defaultInstruction.locked')}</span>
        </div>
      {:else}
        <div class="prompt-warning">
          <EnhancedIcon name="alert-triangle" size={14} />
          <span>{t('aiConfig.cardSplitting.defaultInstruction.warning')}</span>
        </div>
      {/if}
      
      <!-- 系统提示词编辑器 -->
      <textarea
        value={cardSplitting.defaultInstruction || t('aiConfig.cardSplitting.defaultInstruction.defaultPromptContent')}
        oninput={(e) => {
          if (enablePromptEditing) {
            const target = e.target as HTMLTextAreaElement;
            cardSplitting.defaultInstruction = target.value;
          }
        }}
        rows="12"
        class="prompt-textarea-clean"
        class:disabled={!enablePromptEditing}
        disabled={!enablePromptEditing}
        readonly={!enablePromptEditing}
      ></textarea>
    </div>
  {/if}
</div>

<style>
  .card-splitting-config {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.75rem 0;
  }

  /* .setting-item 边框定义已移除，依赖全局样式 */
  
  /* 清理样式：不显示底部边框 */
  .prompt-setting-clean {
    border-bottom: none !important;
    padding-bottom: 0.5rem;
  }

  .setting-item-info {
    flex: 1;
  }

  .setting-item-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.25rem;
  }

  .setting-item-description {
    font-size: 0.9em;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .setting-item-control {
    flex-shrink: 0;
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background-modifier-border);
    transition: 0.3s;
    border-radius: 24px;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .toggle-switch input:checked + .toggle-slider {
    background-color: var(--interactive-accent);
  }

  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  .toggle-switch input:focus + .toggle-slider {
    box-shadow: 0 0 1px var(--interactive-accent);
  }

  /* Number Input */
  .number-input {
    width: 80px;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.95em;
  }

  .number-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  /*  简化的提示词编辑器样式 */
  
  /* 提示词编辑区域 */
  .prompt-editor-area {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* 锁定状态提示 */
  .prompt-locked {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s);
    color: var(--text-muted);
    font-size: 0.9em;
    border-left: 3px solid var(--text-muted);
  }

  /* 警告提示 */
  .prompt-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(255, 167, 38, 0.1);
    border-radius: var(--radius-s);
    color: #ffa726;
    font-size: 0.9em;
    border-left: 3px solid #ffa726;
  }

  /* 简化的提示词输入框 */
  .prompt-textarea-clean {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: 0.9em;
    line-height: 1.6;
    resize: vertical;
    min-height: 200px;
    text-align: left; /* 🔧 靠左对齐 */
  }

  .prompt-textarea-clean:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .prompt-textarea-clean.disabled {
    background: var(--background-secondary);
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>

