<script lang="ts">
  /**
   * Content-Only 架构迁移模态框
   * 
   * 提供可视化的迁移流程和进度显示
   */
  import { Modal } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import { ContentOnlyMigration, type MigrationReport, type ValidationReport } from '../../services/data-migration/ContentOnlyMigration';
  
  interface Props {
    plugin: WeavePlugin;
    modal: Modal;
  }
  
  let { plugin, modal }: Props = $props();
  
  // 状态管理
  let step = $state<'validate' | 'confirm' | 'migrating' | 'completed'>('validate');
  let validationReport = $state<ValidationReport | null>(null);
  let migrationReport = $state<MigrationReport | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  // 配置选项
  let createBackup = $state(true);
  let removeFields = $state(true);
  
  const migration = new ContentOnlyMigration(plugin);
  
  /**
   * 步骤1：验证数据
   */
  async function validateData() {
    isLoading = true;
    error = null;
    
    try {
      validationReport = await migration.validateCurrentData();
      step = 'confirm';
    } catch (e: any) {
      error = `验证失败: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * 步骤2：执行迁移
   */
  async function startMigration() {
    isLoading = true;
    error = null;
    step = 'migrating';
    
    try {
      migrationReport = await migration.migrate({
        createBackup,
        removeFields,
        dryRun: false
      });
      step = 'completed';
    } catch (e: any) {
      error = `迁移失败: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * 关闭模态框
   */
  function close() {
    modal.close();
  }
  
  // 自动开始验证
  $effect(() => {
    if (step === 'validate') {
      validateData();
    }
  });
</script>

<div class="migration-modal">
  <!-- 标题 -->
  <div class="migration-header">
    <h2>Content-Only 架构迁移</h2>
    <p class="migration-subtitle">将所有卡片迁移到纯 content 架构，移除冗余的 fields 字段</p>
  </div>
  
  <!-- 步骤1: 验证 -->
  {#if step === 'validate'}
    <div class="migration-step">
      <div class="migration-loading">
        <div class="spinner"></div>
        <p>正在验证数据...</p>
      </div>
    </div>
  {/if}
  
  <!-- 步骤2: 确认 -->
  {#if step === 'confirm' && validationReport}
    <div class="migration-step">
      <h3>数据验证报告</h3>
      
      <div class="validation-stats">
        <div class="stat-row">
          <span class="stat-label">总卡片数:</span>
          <span class="stat-value">{validationReport.totalCards}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">已是 Content-Only:</span>
          <span class="stat-value success">{validationReport.hasContentOnly}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">需要迁移:</span>
          <span class="stat-value warning">{validationReport.hasFieldsOnly}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">同时有 content 和 fields:</span>
          <span class="stat-value">{validationReport.hasContentAndFields}</span>
        </div>
        {#if validationReport.hasNeither > 0}
          <div class="stat-row">
            <span class="stat-label">数据异常 (两者都无):</span>
            <span class="stat-value error">{validationReport.hasNeither}</span>
          </div>
        {/if}
      </div>
      
      {#if validationReport.hasFieldsOnly > 0}
        <div class="migration-info info">
          <strong>需要迁移</strong>
          <p>发现 {validationReport.hasFieldsOnly} 张卡片只有 fields 没有 content。</p>
          <p>迁移将自动从 fields 生成 content。</p>
        </div>
      {/if}
      
      {#if validationReport.hasContentAndFields > 0}
        <div class="migration-info">
          <strong>冗余数据</strong>
          <p>{validationReport.hasContentAndFields} 张卡片同时有 content 和 fields。</p>
          <p>迁移将保留 content（权威数据源），删除 fields。</p>
        </div>
      {/if}
      
      {#if validationReport.hasNeither > 0}
        <div class="migration-info error">
          <strong>数据异常</strong>
          <p>{validationReport.hasNeither} 张卡片的 content 和 fields 都为空。</p>
          <p>这些卡片将跳过迁移，请手动检查。</p>
        </div>
      {/if}
      
      <!-- 按类型统计 -->
      {#if Object.keys(validationReport.byType).length > 0}
        <details class="type-stats">
          <summary>按卡片类型统计</summary>
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>总数</th>
                <th>有 Content</th>
                <th>有 Fields</th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries(validationReport.byType) as [type, stats]}
                <tr>
                  <td>{type}</td>
                  <td>{stats.total}</td>
                  <td>{stats.hasContent}</td>
                  <td>{stats.hasFields}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </details>
      {/if}
      
      <!-- 配置选项 -->
      <div class="migration-options">
        <h4>迁移选项</h4>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={createBackup} />
          <span>创建备份（强烈推荐）</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={removeFields} />
          <span>删除 fields 字段</span>
        </label>
      </div>
      
      <!-- 操作按钮 -->
      <div class="migration-actions">
        <button class="btn btn-secondary" onclick={close}>取消</button>
        <button class="btn btn-primary" onclick={startMigration}>
          开始迁移
        </button>
      </div>
    </div>
  {/if}
  
  <!-- 步骤3: 迁移中 -->
  {#if step === 'migrating'}
    <div class="migration-step">
      <div class="migration-loading">
        <div class="spinner"></div>
        <p>正在迁移数据，请稍候...</p>
        <p class="migration-tip">迁移完成前请勿关闭 Obsidian</p>
      </div>
    </div>
  {/if}
  
  <!-- 步骤4: 完成 -->
  {#if step === 'completed' && migrationReport}
    <div class="migration-step">
      <div class="migration-result {migrationReport.success ? 'success' : 'warning'}">
        <h3>{migrationReport.success ? '迁移成功！' : '迁移完成（部分失败）'}</h3>
        
        <div class="validation-stats">
          <div class="stat-row">
            <span class="stat-label">总卡片数:</span>
            <span class="stat-value">{migrationReport.totalCards}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">已是 Content-Only:</span>
            <span class="stat-value">{migrationReport.cardsWithContentOnly}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">成功迁移:</span>
            <span class="stat-value success">{migrationReport.cardsMigrated}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">移除 fields:</span>
            <span class="stat-value">{migrationReport.cardsFieldsRemoved}</span>
          </div>
          {#if migrationReport.cardsWithErrors > 0}
            <div class="stat-row">
              <span class="stat-label">错误数:</span>
              <span class="stat-value error">{migrationReport.cardsWithErrors}</span>
            </div>
          {/if}
          <div class="stat-row">
            <span class="stat-label">总耗时:</span>
            <span class="stat-value">{migrationReport.duration}ms</span>
          </div>
        </div>
        
        {#if migrationReport.backupPath}
          <div class="migration-info">
            <strong>备份位置</strong>
            <p><code>{migrationReport.backupPath}</code></p>
            <p class="migration-tip">如有问题，可从备份恢复</p>
          </div>
        {/if}
        
        {#if migrationReport.errors.length > 0}
          <details class="error-details">
            <summary>错误详情 ({migrationReport.errors.length})</summary>
            <ul>
              {#each migrationReport.errors.slice(0, 10) as error}
                <li>
                  <strong>[{error.errorType}]</strong> {error.cardUuid || error.cardId}
                  <br/><span class="error-message">{error.message}</span>
                </li>
              {/each}
              {#if migrationReport.errors.length > 10}
                <li>... 还有 {migrationReport.errors.length - 10} 个错误</li>
              {/if}
            </ul>
          </details>
        {/if}
        
        <div class="migration-actions">
          <button class="btn btn-primary" onclick={close}>完成</button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 错误显示 -->
  {#if error}
    <div class="migration-error">
      <p>{error}</p>
      <button class="btn btn-secondary" onclick={close}>关闭</button>
    </div>
  {/if}
</div>

<style>
  .migration-modal {
    padding: 20px;
    max-width: 600px;
  }
  
  .migration-header {
    margin-bottom: 24px;
    text-align: center;
  }
  
  .migration-header h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
  }
  
  .migration-subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }
  
  .migration-step {
    margin-top: 20px;
  }
  
  .migration-loading {
    text-align: center;
    padding: 40px 20px;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .validation-stats {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .stat-row:last-child {
    border-bottom: none;
  }
  
  .stat-label {
    color: var(--text-muted);
  }
  
  .stat-value {
    font-weight: 600;
  }
  
  .stat-value.success {
    color: var(--text-success);
  }
  
  .stat-value.warning {
    color: var(--text-warning);
  }
  
  .stat-value.error {
    color: var(--text-error);
  }
  
  .migration-info {
    background: var(--background-primary-alt);
    border-left: 4px solid var(--interactive-accent);
    padding: 12px 16px;
    margin: 16px 0;
    border-radius: 4px;
  }
  
  .migration-info.info {
    border-left-color: var(--text-accent);
  }
  
  .migration-info.error {
    border-left-color: var(--text-error);
  }
  
  .migration-info strong {
    display: block;
    margin-bottom: 8px;
  }
  
  .migration-info p {
    margin: 4px 0;
    font-size: 13px;
  }
  
  .migration-info code {
    background: var(--background-secondary);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
  }
  
  .migration-tip {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
  }
  
  .type-stats {
    margin: 16px 0;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 4px;
  }
  
  .type-stats summary {
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 12px;
  }
  
  .type-stats table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .type-stats th,
  .type-stats td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .type-stats th {
    font-weight: 600;
    color: var(--text-muted);
  }
  
  .migration-options {
    margin: 20px 0;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 8px;
  }
  
  .migration-options h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    margin: 8px 0;
    cursor: pointer;
  }
  
  .checkbox-label input {
    margin-right: 8px;
  }
  
  .migration-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
  
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .btn-primary:hover {
    background: var(--interactive-accent-hover);
  }
  
  .btn-secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
  }
  
  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }
  
  .migration-result.success {
    border: 2px solid var(--text-success);
    border-radius: 8px;
    padding: 20px;
  }
  
  .migration-result.warning {
    border: 2px solid var(--text-warning);
    border-radius: 8px;
    padding: 20px;
  }
  
  .migration-result h3 {
    margin-top: 0;
  }
  
  .error-details {
    margin: 16px 0;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 4px;
  }
  
  .error-details summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--text-error);
  }
  
  .error-details ul {
    margin-top: 12px;
    padding-left: 20px;
  }
  
  .error-details li {
    margin: 8px 0;
  }
  
  .error-message {
    color: var(--text-muted);
    font-size: 12px;
  }
  
  .migration-error {
    text-align: center;
    padding: 40px 20px;
  }
  
  .migration-error p {
    color: var(--text-error);
    margin-bottom: 20px;
  }
</style>
