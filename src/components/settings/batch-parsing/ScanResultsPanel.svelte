<!--
  扫描结果面板组件
  显示批量扫描的统计结果和详细信息
-->
<script lang="ts">
  import type { BatchParseResult } from '../../../services/batch-parsing';

  interface Props {
    results: BatchParseResult;
    onClose: () => void;
    onResolveConflict?: (conflictIndex: number, choice: 'use-source' | 'use-weave') => void;
  }

  let { results, onClose, onResolveConflict }: Props = $props();

  // 计算统计数据
  let stats = $derived({
    // 卡片统计
    totalCards: results.totalCards || 0,
    newCards: results.newCards || 0,
    updatedCards: results.updatedCards || 0,
    skippedCards: results.skippedCards || 0,
    conflictCards: results.conflictCards || 0,
    failedCards: results.failedCards?.length || 0,          // 🆕 解析失败的卡片数
    errors: results.errors?.length || 0,
    
    // 数据完整性
    duplicateUUIDs: results.duplicateUUIDs?.length || 0,  // 🆕 重复UUID数
    newDecks: results.newDecks?.length || 0,              // 🆕 新建牌组数
    
    // 文件统计
    filesProcessed: results.stats?.filesProcessed || 0,
    filesWithCards: results.stats?.filesWithCards || 0,   // 🆕 包含卡片的文件数
    filesSkipped: results.stats?.filesSkipped || 0,       // 🆕 跳过的文件数
    
    // 性能统计
    duration: results.stats?.processingTime || 0
  });

  // 格式化时间
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}秒`;
  }

  // 计算卡片处理速度
  let cardsPerSecond = $derived(
    stats.duration > 0 ? (stats.totalCards / (stats.duration / 1000)).toFixed(1) : '0'
  );
</script>

<div class="scan-results-panel">
  <div class="results-header">
    <h4 class="group-title">
      批量扫描结果
    </h4>
    <button 
      class="close-results-btn" 
      onclick={() => onClose()}
      aria-label="关闭"
    >
      ✕
    </button>
  </div>
  
  <!-- 结果摘要 -->
  <div class="results-summary">
    <div class="summary-item success">
      <div class="item-icon">[OK]</div>
      <div class="item-content">
        <div class="item-value">{stats.totalCards}</div>
        <div class="item-label">总卡片数</div>
      </div>
    </div>
    
    {#if stats.newCards > 0}
    <div class="summary-item new">
      <div class="item-icon">[+]</div>
      <div class="item-content">
        <div class="item-value">{stats.newCards}</div>
        <div class="item-label">新增</div>
      </div>
    </div>
    {/if}
    
    {#if stats.updatedCards > 0}
    <div class="summary-item updated">
      <div class="item-icon">[U]</div>
      <div class="item-content">
        <div class="item-value">{stats.updatedCards}</div>
        <div class="item-label">更新</div>
      </div>
    </div>
    {/if}
    
    {#if stats.skippedCards > 0}
    <div class="summary-item skipped">
      <div class="item-icon">[-]</div>
      <div class="item-content">
        <div class="item-value">{stats.skippedCards}</div>
        <div class="item-label">跳过（未变化）</div>
      </div>
    </div>
    {/if}
    
    {#if stats.conflictCards > 0}
    <div class="summary-item conflict">
      <div class="item-icon">[!]</div>
      <div class="item-content">
        <div class="item-value">{stats.conflictCards}</div>
        <div class="item-label">冲突</div>
      </div>
    </div>
    {/if}
    
    {#if stats.errors > 0}
    <div class="summary-item error">
      <div class="item-icon">[X]</div>
      <div class="item-content">
        <div class="item-value">{stats.errors}</div>
        <div class="item-label">错误</div>
      </div>
    </div>
    {/if}
    
    {#if stats.failedCards > 0}
    <div class="summary-item failed">
      <div class="item-icon">[F]</div>
      <div class="item-content">
        <div class="item-value">{stats.failedCards}</div>
        <div class="item-label">解析失败</div>
      </div>
    </div>
    {/if}
    
    {#if stats.duplicateUUIDs > 0}
    <div class="summary-item duplicate">
      <div class="item-icon">[D]</div>
      <div class="item-content">
        <div class="item-value">{stats.duplicateUUIDs}</div>
        <div class="item-label">重复UUID</div>
      </div>
    </div>
    {/if}
  </div>
  
  <!-- 性能统计 -->
  <div class="performance-stats">
    <div class="stat-item">
      <span class="stat-label">处理文件:</span>
      <span class="stat-value">{stats.filesProcessed}个</span>
    </div>
    {#if stats.filesWithCards > 0}
    <div class="stat-item">
      <span class="stat-label">包含卡片:</span>
      <span class="stat-value">{stats.filesWithCards}个</span>
    </div>
    {/if}
    {#if stats.filesSkipped > 0}
    <div class="stat-item">
      <span class="stat-label">跳过文件:</span>
      <span class="stat-value">{stats.filesSkipped}个</span>
    </div>
    {/if}
    {#if stats.newDecks > 0}
    <div class="stat-item new-decks">
      <span class="stat-label">新建牌组:</span>
      <span class="stat-value">{stats.newDecks}个</span>
    </div>
    {/if}
    <div class="stat-item">
      <span class="stat-label">扫描耗时:</span>
      <span class="stat-value">{formatDuration(stats.duration)}</span>
    </div>
    {#if stats.totalCards > 0}
    <div class="stat-item">
      <span class="stat-label">平均速度:</span>
      <span class="stat-value">{cardsPerSecond}张/秒</span>
    </div>
    {/if}
  </div>
  
  <!-- 详细信息（可展开） -->
  {#if results.errors && results.errors.length > 0}
  <details class="results-details">
    <summary>查看错误详情 ({results.errors.length})</summary>
    <div class="details-content">
      <div class="detail-section error-section">
        <ul class="error-list">
          {#each results.errors as error}
          <li class="error-message">
            <strong>{error.file}:</strong> {error.message}
          </li>
          {/each}
        </ul>
      </div>
    </div>
  </details>
  {/if}
  
  {#if results.conflicts && results.conflicts.length > 0}
  <details class="results-details">
    <summary>查看冲突详情 ({results.conflicts.length})</summary>
    <div class="details-content">
      <div class="detail-section conflict-section">
        <p class="conflict-hint">
          以下卡片在源文件和Weave中都被修改，需要手动解决冲突：
        </p>
        <ul class="conflict-list">
          {#each results.conflicts as conflict, index}
          <li class="conflict-item">
            <div class="conflict-info">
              <strong>{conflict.file}</strong> - 第{conflict.cardIndex + 1}张卡片
              <br />
              <small>UUID: {conflict.uuid}</small>
            </div>
            {#if onResolveConflict}
            <div class="conflict-actions">
              <button 
                class="btn-resolve btn-source"
                onclick={() => onResolveConflict?.(index, 'use-source')}
              >
                使用源文件版本
              </button>
              <button 
                class="btn-resolve btn-weave"
                onclick={() => onResolveConflict?.(index, 'use-weave')}
              >
                保留Weave版本
              </button>
            </div>
            {/if}
          </li>
          {/each}
        </ul>
      </div>
    </div>
  </details>
  {/if}
  
  {#if results.duplicateUUIDs && results.duplicateUUIDs.length > 0}
  <details class="results-details">
    <summary>查看重复UUID详情 ({results.duplicateUUIDs.length})</summary>
    <div class="details-content">
      <div class="detail-section duplicate-section">
        <p class="duplicate-hint">
          以下UUID在数据库中已存在，可能导致卡片冲突或数据覆盖：
        </p>
        <ul class="duplicate-list">
          {#each results.duplicateUUIDs as uuid}
          <li class="duplicate-item">
            <code class="uuid-code">{uuid}</code>
          </li>
          {/each}
        </ul>
      </div>
    </div>
  </details>
  {/if}
  
  {#if results.newDecks && results.newDecks.length > 0}
  <details class="results-details">
    <summary>查看新建牌组详情 ({results.newDecks.length})</summary>
    <div class="details-content">
      <div class="detail-section newdecks-section">
        <p class="newdecks-hint">
          批量扫描过程中自动创建了以下牌组：
        </p>
        <ul class="newdecks-list">
          {#each results.newDecks as deckName}
          <li class="newdecks-item">
            <span class="deck-icon">[D]</span>
            <span class="deck-name">{deckName}</span>
          </li>
          {/each}
        </ul>
      </div>
    </div>
  </details>
  {/if}
</div>

<style>
  /* 扫描结果面板 */
  .scan-results-panel {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background: var(--background-primary);
    border: 2px solid var(--interactive-accent);
    border-radius: 0.75rem;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* 头部 */
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--background-modifier-border);
  }
  
  .group-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .close-results-btn {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 4px;
  }
  
  .close-results-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  /* 结果摘要 */
  .results-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .summary-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--item-color);
    transition: transform 0.2s;
  }
  
  .summary-item:hover {
    transform: translateY(-2px);
  }
  
  .summary-item.success { --item-color: #22c55e; }
  .summary-item.new { --item-color: #3b82f6; }
  .summary-item.updated { --item-color: #f59e0b; }
  .summary-item.skipped { --item-color: #6b7280; }
  .summary-item.conflict { --item-color: #f59e0b; }
  .summary-item.error { --item-color: #ef4444; }
  .summary-item.failed { --item-color: #dc2626; }      /* 🆕 解析失败 - 深红色 */
  .summary-item.duplicate { --item-color: #ea580c; }   /* 🆕 重复UUID - 橙红色 */
  
  .item-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  
  .item-content {
    flex: 1;
    min-width: 0;
  }
  
  .item-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-normal);
    line-height: 1;
  }
  
  .item-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }
  
  /* 性能统计 */
  .performance-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  
  .stat-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .stat-label {
    color: var(--text-muted);
  }
  
  .stat-value {
    color: var(--text-normal);
    font-weight: 600;
  }
  
  /* 🆕 新建牌组提示样式 */
  .stat-item.new-decks {
    color: var(--interactive-accent);
  }
  
  .stat-item.new-decks .stat-label {
    color: var(--interactive-accent);
  }
  
  .stat-item.new-decks .stat-value {
    color: var(--interactive-accent);
    font-weight: 700;
  }
  
  /* 详细信息 */
  .results-details {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
  }
  
  .results-details summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--text-normal);
    user-select: none;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  .results-details summary:hover {
    background: var(--background-modifier-hover);
  }
  
  .details-content {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  .detail-section {
    margin-bottom: 0.75rem;
  }
  
  .error-list,
  .conflict-list {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    list-style: none;
  }
  
  .error-list li {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-error);
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    border-left: 3px solid var(--text-error);
  }
  
  .conflict-item {
    margin: 0.75rem 0;
    padding: 0.75rem;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 4px;
    border-left: 3px solid #f59e0b;
  }
  
  .conflict-info {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .conflict-hint {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }
  
  .conflict-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .btn-resolve {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-source {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }
  
  .btn-source:hover {
    opacity: 0.9;
  }
  
  .btn-Weave {
    background: var(--background-secondary);
    color: var(--text-normal);
  }
  
  .btn-Weave:hover {
    background: var(--background-modifier-hover);
  }
  
  /* 🆕 重复UUID详情列表样式 */
  .duplicate-section {
    margin-bottom: 0.75rem;
  }
  
  .duplicate-hint {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  
  .duplicate-list {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    list-style: none;
  }
  
  .duplicate-item {
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: rgba(234, 88, 12, 0.1);
    border-radius: 4px;
    border-left: 3px solid #ea580c;
  }
  
  .uuid-code {
    font-family: var(--font-monospace);
    font-size: 0.875rem;
    color: var(--text-normal);
    padding: 0.25rem 0.5rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
  }
  
  /* 🆕 新建牌组详情列表样式 */
  .newdecks-section {
    margin-bottom: 0.75rem;
  }
  
  .newdecks-hint {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  
  .newdecks-list {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    list-style: none;
  }
  
  .newdecks-item {
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    border-left: 3px solid #3b82f6;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .deck-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  
  .deck-name {
    font-size: 0.875rem;
    color: var(--text-normal);
    font-weight: 500;
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .results-summary {
      grid-template-columns: 1fr;
    }
    
    .performance-stats {
      flex-direction: column;
    }
    
    .conflict-actions {
      flex-direction: column;
    }
    
    .btn-resolve {
      width: 100%;
    }
  }
</style>





