<script lang="ts">
  interface Props {
    statistics: {
      totalGenerations: number;
      totalCards: number;
      successfulImports: number;
      totalCost: number;
      monthlyCost: number;
      lastReset?: string;
    };
  }

  let { statistics }: Props = $props();

  // 格式化货币
  function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  // 格式化日期
  function formatDate(dateString?: string): string {
    if (!dateString) return '从未';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // 计算成功率
  function calculateSuccessRate(): string {
    if (statistics.totalGenerations === 0) return '0%';
    const rate = (statistics.successfulImports / statistics.totalGenerations) * 100;
    return `${rate.toFixed(1)}%`;
  }

  // 计算平均每次生成卡片数
  function calculateAvgCards(): string {
    if (statistics.totalGenerations === 0) return '0';
    const avg = statistics.totalCards / statistics.totalGenerations;
    return avg.toFixed(1);
  }
</script>

<div class="statistics-display">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon">总</div>
      <div class="stat-content">
        <div class="stat-value">{statistics.totalGenerations}</div>
        <div class="stat-label">总生成次数</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">卡</div>
      <div class="stat-content">
        <div class="stat-value">{statistics.totalCards}</div>
        <div class="stat-label">总卡片数</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">成</div>
      <div class="stat-content">
        <div class="stat-value">{statistics.successfulImports}</div>
        <div class="stat-label">成功导入</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">率</div>
      <div class="stat-content">
        <div class="stat-value">{calculateSuccessRate()}</div>
        <div class="stat-label">成功率</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">均</div>
      <div class="stat-content">
        <div class="stat-value">{calculateAvgCards()}</div>
        <div class="stat-label">平均每次卡片数</div>
      </div>
    </div>

    <div class="stat-card highlight">
      <div class="stat-icon">月</div>
      <div class="stat-content">
        <div class="stat-value">{formatCurrency(statistics.monthlyCost)}</div>
        <div class="stat-label">本月成本</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">总</div>
      <div class="stat-content">
        <div class="stat-value">{formatCurrency(statistics.totalCost)}</div>
        <div class="stat-label">总成本</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">更</div>
      <div class="stat-content">
        <div class="stat-value">{formatDate(statistics.lastReset)}</div>
        <div class="stat-label">上次重置</div>
      </div>
    </div>
  </div>
</div>

<style>
  .statistics-display {
    margin-bottom: 24px;
    padding: 20px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .stat-card.highlight {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
    border-color: var(--interactive-accent);
  }

  .stat-icon {
    font-size: 32px;
    line-height: 1;
  }

  .stat-content {
    flex: 1;
    min-width: 0;
  }

  .stat-value {
    font-size: 1.5em;
    font-weight: 700;
    color: var(--text-normal);
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 0.85em;
    color: var(--text-muted);
    line-height: 1.3;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .stat-icon {
      font-size: 24px;
    }

    .stat-value {
      font-size: 1.2em;
    }
  }
</style>




