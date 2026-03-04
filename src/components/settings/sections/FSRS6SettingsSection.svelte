<!--
  FSRS6算法设置组件 - 简化版
  职责：处理FSRS6算法相关配置，采用单文件架构，遵循项目设计规范
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';
  import { FSRS6_DEFAULTS } from '../../../types/fsrs6-types';
  import { Notice, Modal } from 'obsidian';
  import type WeavePlugin from '../../../main';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';
  import EnhancedButton from '../../ui/EnhancedButton.svelte';

  import { tr as trStore } from '../../../utils/i18n';
  
  // 子组件
  import BasicParametersPanel from './fsrs/components/BasicParametersPanel.svelte';
  import OptimizationResultModal from '../../modals/OptimizationResultModal.svelte';
  
  // Svelte mount
  import { mount } from 'svelte';
  
  // 真实优化服务
  import { PersonalizationManager } from '../../../algorithms/optimization/PersonalizationManager';
  import type { PersonalizationData } from '../../../algorithms/optimization/PersonalizationManager';

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();
  // 关键修复：直接引用plugin.settings，不使用$state包装
  // 原因：$state()会创建代理对象，导致对settings的修改无法同步到plugin.settings
  let settings = plugin.settings;
  
  // 响应式历史记录引用，用于触发UI更新
  let optimizationHistory = $state(settings.fsrsParams.optimizationHistory || []);
  
  // 响应式翻译函数
  let t = $derived($trStore);

  // 优化服务实例
  let personalizationManager: PersonalizationManager | null = $state(null);
  
  // 真实优化数据
  let optimizationData = $state<{
    dataPoints: number;
    accuracy: number;
    state: string;
    isLoading: boolean;
  }>({
    dataPoints: 0,
    accuracy: 0,
    state: 'baseline',
    isLoading: true
  });

  // FSRS6状态管理 - 统一在主组件中管理
  let fsrs6State = $state({
    // 基础参数
    retention: settings.fsrsParams.requestRetention || FSRS6_DEFAULTS.REQUEST_RETENTION,
    maxInterval: settings.fsrsParams.maximumInterval || FSRS6_DEFAULTS.MAXIMUM_INTERVAL,
    enableFuzz: settings.fsrsParams.enableFuzz ?? FSRS6_DEFAULTS.ENABLE_FUZZ,

    // 权重参数
    weights: Array.from(settings.fsrsParams.w || FSRS6_DEFAULTS.DEFAULT_WEIGHTS),

    // 界面状态
    isOptimizing: false,
    enableWeightEditing: false // 权重参数编辑开关
  });

  // 初始化优化服务 - 使用$effect.root避免无限循环
  let isInitialized = $state(false);
  
  $effect(() => {
    if (plugin && plugin.dataStorage && !isInitialized) {
      isInitialized = true;
      
      try {
        personalizationManager = new PersonalizationManager(plugin as any, plugin.dataStorage);
        
        // 延迟加载优化数据避免无限循环
        setTimeout(() => loadOptimizationData(), 100);
      } catch (error) {
        logger.error('PersonalizationManager 初始化失败:', error);
        isInitialized = false;
      }
    }
  });
  
  // 权重编辑开关状态变化监听已移除

  // 加载优化数据
  async function loadOptimizationData() {
    if (!personalizationManager) return;
    
    try {
      optimizationData.isLoading = true;
      
      // 使用正确的方法名
      const data = await personalizationManager.loadPersonalizationData();
      
      // 从 StudySession 获取复习数据
      const sessions = await plugin.dataStorage.getStudySessions();
      
      // 计算总复习次数
      let totalReviews = 0;
      for (const session of sessions) {
        if (session.cardReviews) {
          totalReviews += session.cardReviews.length;
        }
      }
      
      optimizationData.dataPoints = totalReviews;
      optimizationData.accuracy = data.baseline?.accuracy || 0;
      optimizationData.state = data.state;
    } catch (error) {
      logger.error('加载优化数据失败:', error);
    } finally {
      optimizationData.isLoading = false;
    }
  }

  // 保存设置的统一方法
  async function saveSettings() {
    try {
      // 更新插件设置
      settings.fsrsParams.requestRetention = fsrs6State.retention;
      settings.fsrsParams.maximumInterval = fsrs6State.maxInterval;
      settings.fsrsParams.enableFuzz = fsrs6State.enableFuzz;
      settings.fsrsParams.w = [...fsrs6State.weights];
      
      await plugin.saveSettings();
      
} catch (error) {
      logger.error('保存FSRS6设置失败:', error);
}
  }

  // 重置为默认值
  function resetToDefaults() {
    fsrs6State.retention = FSRS6_DEFAULTS.REQUEST_RETENTION;
    fsrs6State.maxInterval = FSRS6_DEFAULTS.MAXIMUM_INTERVAL;
    fsrs6State.enableFuzz = FSRS6_DEFAULTS.ENABLE_FUZZ;
    fsrs6State.weights = Array.from(FSRS6_DEFAULTS.DEFAULT_WEIGHTS);
    saveSettings();
  }







  // 处理目标记忆率变更
  function handleRetentionChange(value: number) {
    if (!isNaN(value) && value >= 0.5 && value <= 0.99) {
      fsrs6State.retention = value;
      saveSettings();
    }
  }

  // 处理最大间隔变更
  function handleMaxIntervalChange(value: number) {
    if (!isNaN(value) && value >= 30 && value <= 36500) {
      fsrs6State.maxInterval = value;
      saveSettings();
    }
  }

  // 处理随机化开关
  function handleFuzzToggle() {
    fsrs6State.enableFuzz = !fsrs6State.enableFuzz;
    saveSettings();
  }

  // 处理权重参数变更
  function handleWeightChange(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      fsrs6State.weights[index] = value;
      saveSettings();
    }
  }


  // 手动触发参数优化（显示模态框）
  async function startOptimization() {
    if (!personalizationManager) {
      new Notice(
        '优化服务未初始化，请稍后再试或重新加载插件',
        4000
      );
      return;
    }
    
    fsrs6State.isOptimizing = true;
    
    try {
      // 从 StudySession 收集复习数据
      const sessions = await plugin.dataStorage.getStudySessions();
      const allReviews: any[] = [];
      
      for (const session of sessions) {
        if (session.cardReviews && Array.isArray(session.cardReviews)) {
          allReviews.push(...session.cardReviews);
        }
      }
      
      // 检查数据量是否足够
      if (allReviews.length < 50) {
        new Notice(
          `数据量不足，需要至少50次复习记录才能优化参数，当前只有 ${allReviews.length} 次复习`,
          8000
        );
        fsrs6State.isOptimizing = false;
        return;
      }
      
      // 执行优化计算
      await personalizationManager.updateAfterReview(
        allReviews[allReviews.length - 1],
        allReviews
      );
      
      // 获取优化建议
      const suggestedWeights = await personalizationManager.loadOptimizedWeights();
      
      // 获取真实的优化对比数据
      const comparisonData = await personalizationManager.getOptimizationComparison(allReviews);
      
      // 准备优化结果数据
      const optimizationResult = {
        reviewCount: allReviews.length,
        phase: optimizationData.state,
        oldWeights: [...FSRS6_DEFAULTS.DEFAULT_WEIGHTS],  // 使用默认权重作为对比基准
        newWeights: suggestedWeights,
        metrics: {
          oldAccuracy: comparisonData.baselineAccuracy,
          newAccuracy: comparisonData.optimizedAccuracy,
          improvement: comparisonData.improvement
        },
        timestamp: Date.now()
      };
      
      // 保存为待确认的优化建议
      settings.fsrsParams.pendingOptimization = {
        suggestedWeights,
        timestamp: optimizationResult.timestamp,
        reviewCount: allReviews.length,
        phase: optimizationData.state,
        metrics: {
          improvement: comparisonData.improvement
        }
      };
      
      await plugin.saveSettings();
      
      // 显示优化结果模态框
      showOptimizationResultModal(optimizationResult);
      
    } catch (error) {
      logger.error('参数优化失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      new Notice(
        `参数优化失败: ${errorMessage}`,
        6000
      );
    } finally {
      fsrs6State.isOptimizing = false;
    }
  }
  
  // 显示优化结果模态框
  function showOptimizationResultModal(optimizationResult: any) {
    const modal = new Modal(plugin.app);
    modal.titleEl.remove(); // 移除默认标题
    
    // 渲染 Svelte 组件
    mount(OptimizationResultModal, {
      target: modal.contentEl,
      props: {
        app: plugin.app,
        optimizationResult,
        onAccept: async () => {
          await acceptOptimization();
          modal.close();
        },
        onReject: async () => {
          await rejectOptimization();
          modal.close();
        }
      }
    });
    
    modal.open();
  }

  // 接受优化建议
  async function acceptOptimization() {
    if (!settings.fsrsParams.pendingOptimization) return;
    
    const { suggestedWeights, timestamp, reviewCount, phase, metrics } = settings.fsrsParams.pendingOptimization;
    
    // 保存到历史记录
    if (!settings.fsrsParams.optimizationHistory) {
      settings.fsrsParams.optimizationHistory = [];
    }
    
    settings.fsrsParams.optimizationHistory.push({
      timestamp,
      reviewCount,
      phase: phase as any,
      oldWeights: [...FSRS6_DEFAULTS.DEFAULT_WEIGHTS],
      newWeights: suggestedWeights,
      metrics,
      accepted: true
    });
    
    // 限制历史记录数量
    if (settings.fsrsParams.optimizationHistory.length > 50) {
      settings.fsrsParams.optimizationHistory = 
        settings.fsrsParams.optimizationHistory.slice(-50);
    }
    
    // 应用新参数
    fsrs6State.weights = suggestedWeights;
    settings.fsrsParams.w = suggestedWeights;
    
    // 清除待确认状态
    settings.fsrsParams.pendingOptimization = undefined;
    
    await plugin.saveSettings();
    
    //  更新响应式引用，触发UI刷新
    optimizationHistory = [...settings.fsrsParams.optimizationHistory];
    
    new Notice('优化参数已应用', 3000);
  }
  
  // 拒绝优化建议
  async function rejectOptimization() {
    if (!settings.fsrsParams.pendingOptimization) return;
    
    const { suggestedWeights, timestamp, reviewCount, phase, metrics } = settings.fsrsParams.pendingOptimization;
    
    // 记录到历史（标记为拒绝）
    if (!settings.fsrsParams.optimizationHistory) {
      settings.fsrsParams.optimizationHistory = [];
    }
    
    settings.fsrsParams.optimizationHistory.push({
      timestamp,
      reviewCount,
      phase: phase as any,
      oldWeights: [...FSRS6_DEFAULTS.DEFAULT_WEIGHTS],
      newWeights: suggestedWeights,
      metrics,
      accepted: false,
      note: '用户拒绝'
    });
    
    // 限制历史记录数量
    if (settings.fsrsParams.optimizationHistory.length > 50) {
      settings.fsrsParams.optimizationHistory = 
        settings.fsrsParams.optimizationHistory.slice(-50);
    }
    
    // 清除待确认状态
    settings.fsrsParams.pendingOptimization = undefined;
    
    await plugin.saveSettings();
    
    //  更新响应式引用，触发UI刷新
    optimizationHistory = [...settings.fsrsParams.optimizationHistory];
    
    new Notice('已拒绝优化建议，保持当前参数', 3000);
  }
  
  // 刷新性能指标（重新加载优化数据）
  async function refreshMetrics() {
    await loadOptimizationData();
    
    new Notice(
      `优化数据已刷新，复习记录: ${optimizationData.dataPoints} 条`,
      2000
    );
  }
</script>

<div class="weave-settings settings-section fsrs6-settings">
  <!-- 基础设置 -->
  <div class="settings-group">
    <div class="group-title-row">
      <h4 class="group-title with-accent-bar accent-blue">{t('fsrs.basicParams.title')}</h4>
      <span class="version-badge">v6.1.1</span>
    </div>
    <div class="group-content">
      <BasicParametersPanel
        parameters={{
          retention: fsrs6State.retention,
          maxInterval: fsrs6State.maxInterval,
          enableFuzz: fsrs6State.enableFuzz
        }}
        onRetentionChange={handleRetentionChange}
        onMaxIntervalChange={handleMaxIntervalChange}
        onFuzzToggle={handleFuzzToggle}
        onReset={resetToDefaults}
      />
    </div>
  </div>

  <!-- 权重参数面板 -->
  <div class="settings-group">

    <div class="weights-panel section-panel">
          <div class="panel-header">
            <div class="panel-info">
              <div class="panel-text">
                <h5 class="panel-title with-accent-bar accent-purple">{t('fsrs.advancedSettings.weights.title')}</h5>
                <p class="panel-subtitle">{t('fsrs.advancedSettings.weights.description')}</p>
              </div>
            </div>

            <!-- 权重编辑开关 -->
            <div class="panel-controls">
              <div class="weight-edit-toggle">
                <label class="toggle-label" for="weight-edit-switch">
                  <span class="toggle-text">{t('fsrs.advancedSettings.weights.allowEdit')}</span>
                  <div class="modern-switch">
                    <input
                      id="weight-edit-switch"
                      type="checkbox"
                      checked={fsrs6State.enableWeightEditing}
                      onchange={(e) => {
                        const target = e.target as HTMLInputElement;
                        fsrs6State.enableWeightEditing = target.checked;
                      }}
                    />
                    <span class="switch-slider"></span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div class="weights-grid">
            {#each fsrs6State.weights as weight, index}
              <div class="weight-item">
                <label class="weight-label" for="weight-{index}">w{index}</label>
                <input
                  id="weight-{index}"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={(weight as number).toFixed(4)}
                  onchange={(e) => handleWeightChange(index, e)}
                  class="weight-input"
                  class:disabled={!fsrs6State.enableWeightEditing}
                  disabled={!fsrs6State.enableWeightEditing}
                  readonly={!fsrs6State.enableWeightEditing}
                />
              </div>
            {/each}
          </div>

          <!-- 权重编辑提示 -->
          {#if !fsrs6State.enableWeightEditing}
            <div class="weight-edit-notice">
              <EnhancedIcon name="info" size="14" />
              <span>{t('fsrs.advancedSettings.weights.locked')}</span>
            </div>
          {:else}
            <div class="weight-edit-warning">
              <EnhancedIcon name="alert-triangle" size="14" />
              <span>{t('fsrs.advancedSettings.weights.warning')}</span>
            </div>
          {/if}
    </div>
  </div>

  <!-- 智能优化 -->
  <div class="settings-group">
    <div class="group-title-row">
      <div>
        <h4 class="group-title with-accent-bar accent-green">{t('fsrs.optimization.title')}</h4>
        <p class="group-description">{t('fsrs.optimization.description')}</p>
      </div>
      <EnhancedButton
        variant="primary"
        onclick={startOptimization}
        disabled={fsrs6State.isOptimizing}
      >
        {#if fsrs6State.isOptimizing}
          {t('fsrs.optimization.optimizingButton')}
        {:else}
          {t('fsrs.optimization.startButton')}
        {/if}
      </EnhancedButton>
    </div>

    <div class="optimization-content">
      {#if optimizationData.isLoading}
        <div class="optimization-loading">
          <EnhancedIcon name="loader" size="20" />
          <span>加载优化数据中...</span>
        </div>
      {:else}
        <div class="optimization-status">
          <div class="status-item">
            <span class="status-label">{t('fsrs.optimization.dataPoints')}:</span>
            <span class="status-value">{optimizationData.dataPoints}</span>
          </div>
          <div class="status-item">
            <span class="status-label">{t('fsrs.optimization.accuracy')}:</span>
            <span class="status-value">{optimizationData.accuracy > 0 ? `${(optimizationData.accuracy * 100).toFixed(1)}%` : '--'}</span>
          </div>
          <div class="status-item">
            <span class="status-label">{t('fsrs.optimization.status')}:</span>
            <span class="status-value" class:optimizing={fsrs6State.isOptimizing}>
              {fsrs6State.isOptimizing ? t('fsrs.optimization.statusOptimizing') : t('fsrs.optimization.statusReady')}
            </span>
          </div>
        </div>
      {/if}

      <!-- 优化历史记录 -->
      {#if optimizationHistory && optimizationHistory.length > 0}
        <div class="history-section">
          <h4 class="history-title with-accent-bar accent-purple">
            优化历史记录
            <span class="history-count-badge">{optimizationHistory.length} 条</span>
          </h4>

          <div class="history-table-container">
              <table class="history-table">
                <thead>
                  <tr>
                    <th class="th-status">状态</th>
                    <th class="th-time">优化时间</th>
                    <th class="th-phase">阶段</th>
                    <th class="th-reviews">复习记录</th>
                    <th class="th-accuracy">准确性</th>
                    <th class="th-changes">参数变化</th>
                    <th class="th-note">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {#each optimizationHistory.slice().reverse() as entry}
                    <tr>
                      <!-- 状态 -->
                      <td class="td-status">
                        <span class="status-badge" class:success={entry.accepted} class:muted={!entry.accepted}>
                          {entry.accepted ? '已接受' : '已拒绝'}
                        </span>
                      </td>
                      
                      <!-- 优化时间 -->
                      <td class="td-time">
                        <span class="time-text">{new Date(entry.timestamp).toLocaleString('zh-CN', { 
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </td>
                      
                      <!-- 阶段 -->
                      <td class="td-phase">
                        <span class="phase-text">
                          {#if entry.phase === 'baseline'}基准收集
                          {:else if entry.phase === 'phase1'}阶段1
                          {:else if entry.phase === 'phase2'}阶段2
                          {:else if entry.phase === 'optimized'}已优化
                          {:else}{entry.phase}
                          {/if}
                        </span>
                      </td>
                      
                      <!-- 复习记录 -->
                      <td class="td-reviews">
                        <span class="review-count">{entry.reviewCount} 次</span>
                      </td>
                      
                      <!-- 准确性 -->
                      <td class="td-accuracy">
                        {#if entry.metrics.accuracy}
                          <span class="accuracy-value">{entry.metrics.accuracy.toFixed(1)}%</span>
                        {:else}
                          <span class="na-text">—</span>
                        {/if}
                      </td>
                      
                      <!-- 参数变化 -->
                      <td class="td-changes">
                        {#each [entry.newWeights.map((w: number, i: number) => ({
                          index: i,
                          old: entry.oldWeights[i],
                          new: w,
                          diff: w - entry.oldWeights[i]
                        })).filter(p => Math.abs(p.diff) > 0.01)] as changedParams}
                          {#if changedParams.length > 0}
                            <span 
                              class="changes-count clickable" 
                              title={changedParams.map(p => 
                                `w${p.index}: ${p.old.toFixed(4)} → ${p.new.toFixed(4)} (${p.diff > 0 ? '+' : ''}${p.diff.toFixed(4)})`
                              ).join('\n')}
                            >
                              {changedParams.length} 个参数
                            </span>
                          {:else}
                            <span class="na-text">无变化</span>
                          {/if}
                        {/each}
                      </td>
                      
                      <!-- 备注 -->
                      <td class="td-note">
                        {#if entry.note}
                          <span class="note-text" title={entry.note}>{entry.note}</span>
                        {:else}
                          <span class="na-text">—</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
        </div>
      {/if}
    </div>
  </div>

</div>

<style>
  /* 标题行样式 */
  .group-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .group-description {
    margin: 0 0 1rem 0;
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .version-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    background: var(--interactive-accent);
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: var(--radius-s);
    white-space: nowrap;
  }

  /* 侧边颜色条样式 */
  .group-title.with-accent-bar,
  .panel-title.with-accent-bar,
  .history-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
  }

  .group-title.with-accent-bar::before,
  .panel-title.with-accent-bar::before,
  .history-title.with-accent-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 80%;
    border-radius: 2px;
  }

  /* 颜色定义 */
  .group-title.accent-blue::before {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.6));
  }

  .group-title.accent-green::before {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.6));
  }

  .panel-title.accent-purple::before,
  .history-title.accent-purple::before {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(147, 51, 234, 0.6));
  }

  /* 滑块和开关样式已在settings-common.css中定义 */

  /* 权重参数面板样式 */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .panel-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .panel-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .panel-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .panel-subtitle {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  /* 面板控制区域 */
  .panel-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .weight-edit-toggle {
    display: flex;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s ease;
  }

  .toggle-label:hover {
    background-color: var(--background-modifier-hover);
  }

  .toggle-text {
    font-size: 0.85rem;
    color: var(--text-normal);
    font-weight: 500;
  }

  /* 权重参数网格 */
  .weights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .weight-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .weight-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .weight-input {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.8rem;
    font-family: var(--font-monospace);
    transition: all 0.2s ease;
  }

  .weight-input:focus {
    outline: none;
    border-color: var(--weave-accent-color);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }

  .weight-input.disabled,
  .weight-input:disabled {
    background: var(--background-modifier-border);
    color: var(--text-muted);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .weight-input.disabled:hover,
  .weight-input:disabled:hover {
    border-color: var(--background-modifier-border);
  }

  /* 权重编辑提示样式 */
  .weight-edit-notice,
  .weight-edit-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.85rem;
    margin-top: 1rem;
  }

  .weight-edit-notice {
    color: var(--text-muted);
  }

  .weight-edit-warning {
    background: rgba(255, 193, 7, 0.1);
    color: var(--text-normal);
  }

  /* 优化面板样式 */
  .optimization-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .optimization-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .optimization-status {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    padding: 1rem 0;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .status-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .status-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .status-value.optimizing {
    color: var(--weave-accent-color);
  }

  /* 优化历史记录区域样式 */
  .history-section {
    margin-top: 1.5rem;
    border-top: 1px solid var(--background-modifier-border);
    padding-top: 1rem;
  }

  .history-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .history-count-badge {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s);
    font-weight: 500;
  }

  .history-table-container {
    overflow-x: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
  }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .history-table thead {
    background: var(--background-secondary);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .history-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .history-table th.th-status {
    width: 90px;
  }

  .history-table th.th-time {
    width: 150px;
  }

  .history-table th.th-phase {
    width: 100px;
  }

  .history-table th.th-reviews {
    width: 100px;
  }

  .history-table th.th-accuracy {
    width: 90px;
  }

  .history-table th.th-changes {
    width: 100px;
  }

  .history-table th.th-note {
    width: auto;
    min-width: 120px;
  }

  .history-table tbody tr {
    border-bottom: 1px solid var(--background-modifier-border);
    transition: background-color 0.2s;
  }

  .history-table tbody tr:hover {
    background: var(--background-secondary-alt);
  }

  .history-table tbody tr:last-child {
    border-bottom: none;
  }

  .history-table td {
    padding: 0.75rem 1rem;
    vertical-align: middle;
  }

  /* 状态列 */
  .td-status .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: var(--radius-s);
    white-space: nowrap;
  }

  .status-badge.success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--text-success);
  }

  .status-badge.muted {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  /* 时间列 */
  .td-time .time-text {
    font-family: var(--font-monospace);
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  /* 阶段列 */
  .td-phase .phase-text {
    color: var(--text-accent);
    font-weight: 500;
  }

  /* 复习记录列 */
  .td-reviews .review-count {
    color: var(--text-normal);
  }

  /* 准确性列 */
  .td-accuracy .accuracy-value {
    color: var(--text-normal);
    font-weight: 500;
  }

  /* 参数变化列 */
  .td-changes .changes-count {
    color: var(--text-normal);
    font-weight: 500;
  }

  .td-changes .changes-count.clickable {
    color: var(--text-accent);
    cursor: help;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }

  .td-changes .changes-count.clickable:hover {
    color: var(--text-accent-hover);
  }

  /* 备注列 */
  .td-note .note-text {
    color: var(--text-muted);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
  }

  /* 空值标识 */
  .na-text {
    color: var(--text-faint);
    font-style: italic;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .weights-grid {
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }

    .optimization-status {
      grid-template-columns: 1fr;
    }

    /* 表格响应式 */
    .history-table {
      font-size: 0.8rem;
    }

    .history-table th,
    .history-table td {
      padding: 0.5rem;
    }

    .history-table th.th-time,
    .history-table th.th-note {
      display: none;
    }

    .history-table td.td-time,
    .history-table td.td-note {
      display: none;
    }
  }
</style>
