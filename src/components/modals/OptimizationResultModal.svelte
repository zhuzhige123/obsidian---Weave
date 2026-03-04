<script lang="ts">
  import { Modal } from 'obsidian';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import EnhancedButton from '../ui/EnhancedButton.svelte';

  interface Props {
    app: any;
    title?: string;
    optimizationResult: {
      reviewCount: number;
      phase: string;
      oldWeights: number[];
      newWeights: number[];
      metrics: {
        oldAccuracy?: number;
        newAccuracy?: number;
        improvement?: number;
      };
      timestamp: number;
    };
    onAccept: () => void;
    onReject: () => void;
  }

  let { app, title = '参数优化结果', optimizationResult, onAccept, onReject }: Props = $props();

  // 计算参数变化统计
  const changedParams = $derived(() => {
    let changes = [];
    for (let i = 0; i < optimizationResult.oldWeights.length; i++) {
      const oldVal = optimizationResult.oldWeights[i];
      const newVal = optimizationResult.newWeights[i];
      const diff = newVal - oldVal;
      const diffPercent = oldVal !== 0 ? ((diff / oldVal) * 100) : 0;
      
      if (Math.abs(diff) > 0.01) {
        changes.push({
          index: i,
          name: `w${i}`,
          oldValue: oldVal,
          newValue: newVal,
          difference: diff,
          differencePercent: diffPercent
        });
      }
    }
    return changes;
  });

  // 格式化阶段名称
  function formatPhase(phase: string): string {
    const phaseMap: Record<string, string> = {
      'baseline': '基准收集',
      'phase1': '阶段1优化',
      'phase2': '阶段2优化',
      'optimized': '完全优化'
    };
    return phaseMap[phase] || phase;
  }

  function handleAccept() {
    onAccept();
  }

  function handleReject() {
    onReject();
  }
</script>

<div class="optimization-result-modal">
  <!-- 模态框头部 -->
  <div class="modal-header">
    <div class="header-icon success">
      <EnhancedIcon name="check-circle" size="24" />
    </div>
    <div class="header-text">
      <h2 class="modal-title">{title}</h2>
      <p class="modal-subtitle">基于 {optimizationResult.reviewCount} 次复习记录分析</p>
    </div>
  </div>

  <!-- 优化摘要 -->
  <div class="optimization-summary">
    <div class="summary-card">
      <div class="card-icon">
        <EnhancedIcon name="trending-up" size="20" />
      </div>
      <div class="card-content">
        <span class="card-label">优化阶段</span>
        <span class="card-value">{formatPhase(optimizationResult.phase)}</span>
      </div>
    </div>

    <div class="summary-card">
      <div class="card-icon">
        <EnhancedIcon name="activity" size="20" />
      </div>
      <div class="card-content">
        <span class="card-label">参数调整</span>
        <span class="card-value">{changedParams().length} 个参数</span>
      </div>
    </div>

    <div class="summary-card highlight">
      <div class="card-icon">
        <EnhancedIcon name="zap" size="20" />
      </div>
      <div class="card-content">
        <span class="card-label">预计改进</span>
        <span class="card-value improvement">
          {#if optimizationResult.metrics.improvement !== undefined}
            +{optimizationResult.metrics.improvement.toFixed(1)}%
          {:else}
            计算中
          {/if}
        </span>
      </div>
    </div>
  </div>

  <!-- 性能指标对比 -->
  {#if optimizationResult.metrics.oldAccuracy !== undefined && optimizationResult.metrics.newAccuracy !== undefined}
    <div class="metrics-comparison">
      <h3 class="section-title">
        <EnhancedIcon name="bar-chart-2" size="16" />
        性能指标对比
      </h3>
      
      <div class="comparison-grid">
        <div class="metric-row">
          <span class="metric-name">预测准确性</span>
          <div class="metric-values">
            <span class="old-value">{optimizationResult.metrics.oldAccuracy.toFixed(1)}%</span>
            <EnhancedIcon name="arrow-right" size="14" />
            <span class="new-value">{optimizationResult.metrics.newAccuracy.toFixed(1)}%</span>
          </div>
          <span class="metric-change positive">
            +{(optimizationResult.metrics.newAccuracy - optimizationResult.metrics.oldAccuracy).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- 参数变化详情 -->
  {#if changedParams().length > 0}
    <div class="params-changes">
      <h3 class="section-title">
        <EnhancedIcon name="sliders" size="16" />
        参数变化详情
        <span class="params-count">({changedParams().length} 个参数已调整)</span>
      </h3>
      
      <div class="changes-table-container">
        <table class="changes-table">
          <thead>
            <tr>
              <th>参数</th>
              <th>优化前</th>
              <th>优化后</th>
              <th>变化幅度</th>
            </tr>
          </thead>
          <tbody>
            {#each changedParams().slice(0, 10) as param}
              <tr>
                <td class="param-name">{param.name}</td>
                <td class="old-val">{param.oldValue.toFixed(4)}</td>
                <td class="new-val">{param.newValue.toFixed(4)}</td>
                <td class="change-val">
                  <span class:positive={param.difference > 0} class:negative={param.difference < 0}>
                    {param.difference > 0 ? '+' : ''}{param.differencePercent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        
        {#if changedParams().length > 10}
          <div class="table-footer">
            还有 {changedParams().length - 10} 个参数发生变化...
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- 说明文字 -->
  <div class="explanation-box">
    <EnhancedIcon name="info" size="16" />
    <div class="explanation-text">
      <p><strong>优化说明：</strong></p>
      <ul>
        <li>优化基于您的实际复习历史，参数已针对您的记忆模式进行调整</li>
        <li>接受优化后，新参数将立即生效，影响后续的复习间隔计算</li>
        <li>拒绝优化将保持当前参数不变，优化结果将保存到历史记录</li>
      </ul>
    </div>
  </div>

  <!-- 操作按钮 -->
  <div class="modal-actions">
    <EnhancedButton
      variant="ghost"
      onclick={handleReject}
    >
      <EnhancedIcon name="x" size="16" />
      拒绝优化
    </EnhancedButton>

    <EnhancedButton
      variant="primary"
      onclick={handleAccept}
    >
      <EnhancedIcon name="check" size="16" />
      接受并应用
    </EnhancedButton>
  </div>
</div>

<style>
  .optimization-result-modal {
    padding: 1.5rem;
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
  }

  /* 模态框头部 */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .header-icon.success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--text-success);
  }

  .header-text {
    flex: 1;
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-normal);
  }

  .modal-subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  /* 优化摘要卡片 */
  .optimization-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    transition: all 0.2s;
  }

  .summary-card:hover {
    background: var(--background-secondary-alt);
  }

  .summary-card.highlight {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--background-primary);
    border-radius: var(--radius-s);
    flex-shrink: 0;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .card-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .card-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-normal);
  }

  .card-value.improvement {
    color: var(--text-success);
  }

  /* 区块标题 */
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .params-count {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 400;
  }

  /* 指标对比 */
  .metrics-comparison {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: var(--radius-m);
  }

  .comparison-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .metric-row {
    display: grid;
    grid-template-columns: 150px 1fr auto;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border-radius: var(--radius-s);
  }

  .metric-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  .metric-values {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-monospace);
  }

  .old-value {
    font-size: 0.9rem;
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .new-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .metric-change {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-s);
  }

  .metric-change.positive {
    color: var(--text-success);
    background: rgba(34, 197, 94, 0.1);
  }

  /* 参数变化表格 */
  .params-changes {
    margin-bottom: 1.5rem;
  }

  .changes-table-container {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    overflow: hidden;
  }

  .changes-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .changes-table thead {
    background: var(--background-secondary);
  }

  .changes-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-muted);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .changes-table tbody tr {
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background 0.2s;
  }

  .changes-table tbody tr:hover {
    background: var(--background-secondary-alt);
  }

  .changes-table tbody tr:last-child {
    border-bottom: none;
  }

  .changes-table td {
    padding: 0.75rem;
  }

  .param-name {
    font-weight: 600;
    color: var(--text-accent);
    font-family: var(--font-monospace);
  }

  .old-val,
  .new-val {
    font-family: var(--font-monospace);
    font-size: 0.85rem;
  }

  .old-val {
    color: var(--text-muted);
  }

  .new-val {
    color: var(--text-normal);
    font-weight: 500;
  }

  .change-val {
    font-weight: 600;
    font-family: var(--font-monospace);
  }

  .change-val .positive {
    color: var(--text-success);
  }

  .change-val .negative {
    color: var(--text-error);
  }

  .table-footer {
    padding: 0.75rem;
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-muted);
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  /* 说明文字 */
  .explanation-box {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: var(--radius-m);
    margin-bottom: 1.5rem;
  }

  .explanation-text {
    flex: 1;
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .explanation-text p {
    margin: 0 0 0.5rem 0;
  }

  .explanation-text strong {
    color: var(--text-normal);
  }

  .explanation-text ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .explanation-text li {
    margin: 0.25rem 0;
  }

  /* 操作按钮 */
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  /* 响应式 */
  @media (max-width: 600px) {
    .optimization-summary {
      grid-template-columns: 1fr;
    }

    .metric-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .changes-table {
      font-size: 0.75rem;
    }

    .changes-table th,
    .changes-table td {
      padding: 0.5rem;
    }
  }
</style>
