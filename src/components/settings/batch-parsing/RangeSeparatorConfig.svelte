<script lang="ts">
  /**
   *  范围分隔符配置组件
   * 
   * 共享组件：用于配置卡片范围的分隔方式
   * - 支持自定义文本分隔符
   * - 支持空行分隔符
   * - 两种方式互斥
   */
  
  import { tr } from '../../../utils/i18n';

  let t = $derived($tr);

  interface Props {
    /** 配置对象（包含 cardSeparator 和 emptyLineSeparator） */
    config: {
      cardSeparator?: string;
      emptyLineSeparator?: {
        enabled: boolean;
        lineCount: number;
      };
    };
    /** 单选按钮组的唯一名称 */
    name?: string;
    /** 配置更新回调 */
    onChange?: (config: any) => void;
  }
  
  let { config, name = 'separator-type', onChange }: Props = $props();
  
  //  确保 emptyLineSeparator 存在
  const safeEmptyLineSeparator = $derived(
    config.emptyLineSeparator || { enabled: false, lineCount: 2 }
  );
  
  const safeCardSeparator = $derived(config.cardSeparator || '<->');  //  修改默认值从 %%<->%% 改为 <->

  
  /**
   * 切换到自定义分隔符模式
   */
  function switchToCustomSeparator() {
    config.emptyLineSeparator = {
      enabled: false,
      lineCount: safeEmptyLineSeparator.lineCount
    };
    onChange?.(config);
  }
  
  /**
   * 切换到空行分隔符模式
   */
  function switchToEmptyLineSeparator() {
    config.emptyLineSeparator = {
      enabled: true,
      lineCount: safeEmptyLineSeparator.lineCount
    };
    onChange?.(config);
  }
  
  /**
   * 更新空行数量
   */
  function updateLineCount(count: number) {
    if (config.emptyLineSeparator) {
      config.emptyLineSeparator.lineCount = count;
      onChange?.(config);
    }
  }
  
  /**
   * 更新卡片分隔符
   */
  function updateCardSeparator(separator: string) {
    config.cardSeparator = separator;
    onChange?.(config);
  }
</script>

<div class="range-separator-config">
  <!-- 分隔方式选择 -->
  <div class="form-group">
    <div class="form-label">{t('dataManagement.batchScan.separator.cardSeparatorMethod')}</div>
    <div class="separator-type-switch">
      <label class="switch-option">
        <input 
          type="radio" 
          {name}
          checked={!safeEmptyLineSeparator.enabled}
          onchange={switchToCustomSeparator}
        />
        <span>{t('dataManagement.batchScan.separator.useCustomSeparator')}</span>
      </label>
      <label class="switch-option">
        <input 
          type="radio" 
          {name}
          checked={safeEmptyLineSeparator.enabled}
          onchange={switchToEmptyLineSeparator}
        />
        <span>{t('dataManagement.batchScan.separator.useEmptyLine')}</span>
      </label>
    </div>
  </div>
  
  <!-- 根据选择显示对应的配置项 -->
  {#if safeEmptyLineSeparator.enabled}
    <div class="form-group">
      <label for="empty-line-count">{t('dataManagement.batchScan.separator.emptyLineCount')}</label>
      <input 
        type="number"
        id="empty-line-count"
        min="1"
        max="10"
        value={safeEmptyLineSeparator.lineCount}
        onchange={(e) => updateLineCount(parseInt(e.currentTarget.value) || 2)}
        placeholder={t('dataManagement.batchScan.separator.emptyLineCountPlaceholder')}
      />
      <small class="help-text">{t('dataManagement.batchScan.separator.emptyLineCountHelp')}</small>
    </div>
  {:else}
    <div class="form-group">
      <label for="card-separator">{t('dataManagement.batchScan.separator.cardRangeSeparator')}</label>
      <input 
        type="text"
        id="card-separator"
        value={safeCardSeparator}
        oninput={(e) => updateCardSeparator(e.currentTarget.value)}
        placeholder={t('dataManagement.batchScan.separator.cardRangeSeparatorPlaceholder')}
      />
      <small class="help-text">{t('dataManagement.batchScan.separator.cardRangeSeparatorHelp')}</small>
    </div>
  {/if}
</div>

<style>
  .range-separator-config {
    display: contents; /* 不影响父布局 */
  }
  
  .separator-type-switch {
    display: flex;
    gap: 12px;
    padding: 8px 0;
  }
  
  .switch-option {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .switch-option:hover {
    background: var(--background-modifier-hover);
  }
  
  .switch-option input[type="radio"] {
    margin: 0;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label,
  .form-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--text-normal);
  }
  
  .form-group input[type="text"],
  .form-group input[type="number"] {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
  }
  
  .help-text {
    display: block;
    margin-top: 4px;
    font-size: 0.875em;
    color: var(--text-muted);
  }
</style>

