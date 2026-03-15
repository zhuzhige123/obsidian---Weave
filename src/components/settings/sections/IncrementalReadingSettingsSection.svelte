<!--
  增量阅读设置组件
  职责：处理增量阅读牌组的配置（调度、拆分、交错学习、导入设置）
  
  v2.0 重构：移除弃用的聚焦阅读模式相关设置
-->
<script lang="ts">
  import { logger } from '../../../utils/logger';
  import type WeavePlugin from '../../../main';
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings, CalloutSignalSettings, CalloutTypeWeight } from '../../../types/plugin-settings.d';
  import ObsidianDropdown from '../../ui/ObsidianDropdown.svelte';
  import { getDefaultIRImportFolder } from '../../../config/paths';
  import IRTagGroupManager from './IRTagGroupManager.svelte';

  let t = $derived($tr);

  // 增量阅读默认设置（使用统一的 PATHS 配置）
  const DEFAULT_IR_SETTINGS: IncrementalReadingSettings = {
    defaultIntervalFactor: 1.5,
    dailyNewLimit: 20,
    dailyReviewLimit: 50,
    defaultSplitLevel: 2,
    interleaveMode: true,
    maxConsecutiveSameTopic: 3,
    reviewThreshold: 7,
    maxInterval: 365,
    importFolder: '',
    // v3.0 新调度系统设置
    scheduleStrategy: 'processing',
    dailyTimeBudgetMinutes: 40,
    maxAppearancesPerDay: 2,
    enableTagGroupPrior: true,
    agingStrength: 'low',
    autoPostponeStrategy: 'gentle',
    priorityHalfLifeDays: 7,
    learnAheadDays: 3
  };
  
  // v3.0 调度策略选项
  let STRATEGY_OPTIONS = $derived([
    { id: 'processing', label: t('irSettings.strategyProcessingLabel'), desc: t('irSettings.strategyProcessingDesc') },
    { id: 'reading-list', label: t('irSettings.strategyReadingListLabel'), desc: t('irSettings.strategyReadingListDesc') }
  ]);
  
  // v3.0 aging 强度选项
  let AGING_OPTIONS = $derived([
    { id: 'low', label: t('irSettings.agingLowLabel'), desc: t('irSettings.agingLowDesc') },
    { id: 'medium', label: t('irSettings.agingMediumLabel'), desc: t('irSettings.agingMediumDesc') },
    { id: 'high', label: t('irSettings.agingHighLabel'), desc: t('irSettings.agingHighDesc') }
  ]);
  
  // v3.0 自动后推策略选项
  let POSTPONE_OPTIONS = $derived([
    { id: 'off', label: t('irSettings.postponeOffLabel'), desc: t('irSettings.postponeOffDesc') },
    { id: 'gentle', label: t('irSettings.postponeGentleLabel'), desc: t('irSettings.postponeGentleDesc') },
    { id: 'aggressive', label: t('irSettings.postponeAggressiveLabel'), desc: t('irSettings.postponeAggressiveDesc') }
  ]);
  
  // v3.1 默认 Callout 类型权重配置
  const DEFAULT_CALLOUT_TYPES: CalloutTypeWeight[] = [
    { type: 'question', enabled: true, weight: 2.5 },
    { type: 'warning', enabled: true, weight: 2.0 },
    { type: 'quote', enabled: true, weight: 1.5 },
    { type: 'tip', enabled: false, weight: 1.5 },
    { type: 'info', enabled: false, weight: 1.0 },
    { type: 'note', enabled: false, weight: 0.8 }
  ];
  
  // v3.1 默认标注信号设置
  const DEFAULT_CALLOUT_SIGNAL: CalloutSignalSettings = {
    enabled: true,
    typeWeights: DEFAULT_CALLOUT_TYPES,
    maxBoost: 2.0,
    saturationParam: 4,
    minContentLength: 0
  };

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();
  let settings = $state(plugin.settings);
  
  // 确保 incrementalReading 设置存在
  $effect(() => {
    if (!settings.incrementalReading) {
      settings.incrementalReading = {
        ...DEFAULT_IR_SETTINGS,
        importFolder: getDefaultIRImportFolder(plugin.settings?.weaveParentFolder)
      };
    }
  });

  // 保存设置的统一方法
  async function saveSettings() {
    try {
      plugin.settings = settings;
      await plugin.saveSettings();
      
} catch (error) {
      logger.error('保存设置失败:', error);
}
  }

  // ============================================
  // 增量阅读牌组设置处理函数
  // ============================================

  // 处理默认间隔因子变更
  function handleIntervalFactorChange(event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value) && value >= 1.0 && value <= 3.0) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.defaultIntervalFactor = value;
      saveSettings();
    }
  }

  // 处理每日新块上限变更
  function handleDailyNewLimitChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 0 && value <= 50) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.dailyNewLimit = value;
      saveSettings();
    }
  }

  // 处理每日复习上限变更
  function handleDailyReviewLimitChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 0 && value <= 200) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.dailyReviewLimit = value;
      saveSettings();
    }
  }

  // 处理默认拆分级别变更
  function handleDefaultSplitLevelChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 6) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.defaultSplitLevel = value;
      saveSettings();
    }
  }

  // 处理交错学习模式变更
  function handleInterleaveModeChange(event: Event) {
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    settings.incrementalReading.interleaveMode = (event.target as HTMLInputElement).checked;
    saveSettings();
  }

  // 处理最大连续同主题块数变更
  function handleMaxConsecutiveChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 10) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.maxConsecutiveSameTopic = value;
      saveSettings();
    }
  }

  // 处理复习阈值变更
  function handleReviewThresholdChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 3 && value <= 14) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.reviewThreshold = value;
      saveSettings();
    }
  }

  // 处理最大间隔变更
  function handleMaxIntervalChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 30 && value <= 365) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.maxInterval = value;
      saveSettings();
    }
  }

  // ============================================
  // v3.0 调度策略处理函数
  // ============================================

  // 处理调度策略变更
  function handleStrategyChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'processing' | 'reading-list';
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    settings.incrementalReading.scheduleStrategy = value;
    saveSettings();
  }

  // 处理每日时间预算变更
  function handleTimeBudgetChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 10 && value <= 120) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.dailyTimeBudgetMinutes = value;
      saveSettings();
    }
  }

  // 处理每日出现上限变更
  function handleMaxAppearancesChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 5) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.maxAppearancesPerDay = value;
      saveSettings();
    }
  }

  // 处理 TagGroup 先验开关
  function handleTagGroupPriorChange(event: Event) {
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    settings.incrementalReading.enableTagGroupPrior = (event.target as HTMLInputElement).checked;
    saveSettings();
  }

  // 处理 aging 强度变更
  function handleAgingStrengthChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'low' | 'medium' | 'high';
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    settings.incrementalReading.agingStrength = value;
    saveSettings();
  }

  // 处理自动后推策略变更
  function handlePostponeStrategyChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'off' | 'gentle' | 'aggressive';
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    settings.incrementalReading.autoPostponeStrategy = value;
    saveSettings();
  }

  // 处理优先级半衰期变更
  function handlePriorityHalfLifeChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 3 && value <= 30) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.priorityHalfLifeDays = value;
      saveSettings();
    }
  }

  // 处理待读天数变更（统一用于统计和提前阅读范围）
  function handleLearnAheadDaysChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 14) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      settings.incrementalReading.learnAheadDays = value;
      saveSettings();
    }
  }

  // ============================================
  // v3.1 标注信号处理函数
  // ============================================

  // 获取当前标注信号设置
  function getCalloutSignal(): CalloutSignalSettings {
    return settings.incrementalReading?.calloutSignal ?? { ...DEFAULT_CALLOUT_SIGNAL };
  }

  // 获取当前 Callout 类型权重列表
  function getTypeWeights(): CalloutTypeWeight[] {
    return getCalloutSignal().typeWeights ?? [...DEFAULT_CALLOUT_TYPES];
  }

  // 处理标注信号功能开关
  function handleCalloutSignalEnabledChange(event: Event) {
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    if (!settings.incrementalReading.calloutSignal) {
      settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
    }
    settings.incrementalReading.calloutSignal.enabled = (event.target as HTMLInputElement).checked;
    saveSettings();
  }

  // 处理 Callout 类型启用状态变更
  function handleCalloutTypeEnabledChange(type: string, enabled: boolean) {
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    if (!settings.incrementalReading.calloutSignal) {
      settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
    }
    if (!settings.incrementalReading.calloutSignal.typeWeights) {
      settings.incrementalReading.calloutSignal.typeWeights = [...DEFAULT_CALLOUT_TYPES];
    }
    
    const typeWeights = settings.incrementalReading.calloutSignal.typeWeights;
    const index = typeWeights.findIndex(t => t.type === type);
    if (index !== -1) {
      typeWeights[index] = { ...typeWeights[index], enabled };
    }
    saveSettings();
  }

  // 处理 Callout 类型权重变更
  function handleCalloutTypeWeightChange(type: string, weight: number) {
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    if (!settings.incrementalReading.calloutSignal) {
      settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
    }
    if (!settings.incrementalReading.calloutSignal.typeWeights) {
      settings.incrementalReading.calloutSignal.typeWeights = [...DEFAULT_CALLOUT_TYPES];
    }
    
    const typeWeights = settings.incrementalReading.calloutSignal.typeWeights;
    const index = typeWeights.findIndex(t => t.type === type);
    if (index !== -1) {
      typeWeights[index] = { ...typeWeights[index], weight };
    }
    saveSettings();
  }

  // 处理最大增益变更
  function handleMaxBoostChange(event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value) && value >= 1.0 && value <= 2.0) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      if (!settings.incrementalReading.calloutSignal) {
        settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
      }
      settings.incrementalReading.calloutSignal.maxBoost = value;
      saveSettings();
    }
  }

  // 处理饱和参数变更
  function handleSaturationParamChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 3 && value <= 6) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      if (!settings.incrementalReading.calloutSignal) {
        settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
      }
      settings.incrementalReading.calloutSignal.saturationParam = value;
      saveSettings();
    }
  }

  // 处理最小内容阈值变更
  function handleMinContentLengthChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 0 && value <= 50) {
      if (!settings.incrementalReading) {
        settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
      }
      if (!settings.incrementalReading.calloutSignal) {
        settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
      }
      settings.incrementalReading.calloutSignal.minContentLength = value;
      saveSettings();
    }
  }

  // Callout 类型显示名称映射
  const CALLOUT_TYPE_LABELS: Record<string, string> = {
    'question': 'Question / Help / FAQ',
    'warning': 'Warning / Caution / Attention',
    'quote': 'Quote / Cite',
    'tip': 'Tip / Hint / Important',
    'info': 'Info',
    'note': 'Note'
  };

  // 内置类型列表（不可删除）
  const BUILTIN_TYPES = ['question', 'warning', 'quote', 'tip', 'info', 'note'];

  // 新增自定义类型的输入状态
  let newCalloutType = $state('');
  let newCalloutWeight = $state(1.5);

  // 添加自定义 Callout 类型
  function handleAddCustomType() {
    const typeName = newCalloutType.trim().toLowerCase();
    if (!typeName) return;
    
    // 检查是否已存在
    const existingTypes = getTypeWeights();
    if (existingTypes.some(t => t.type === typeName)) {
      return;
    }
    
    if (!settings.incrementalReading) {
      settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
    }
    if (!settings.incrementalReading.calloutSignal) {
      settings.incrementalReading.calloutSignal = { ...DEFAULT_CALLOUT_SIGNAL };
    }
    if (!settings.incrementalReading.calloutSignal.typeWeights) {
      settings.incrementalReading.calloutSignal.typeWeights = [...DEFAULT_CALLOUT_TYPES];
    }
    
    settings.incrementalReading.calloutSignal.typeWeights.push({
      type: typeName,
      enabled: true,
      weight: newCalloutWeight
    });
    
    newCalloutType = '';
    newCalloutWeight = 1.5;
    saveSettings();
  }

  // 删除自定义 Callout 类型
  function handleRemoveCustomType(type: string) {
    if (BUILTIN_TYPES.includes(type)) return;
    
    if (!settings.incrementalReading?.calloutSignal?.typeWeights) return;
    
    const index = settings.incrementalReading.calloutSignal.typeWeights.findIndex(t => t.type === type);
    if (index !== -1) {
      settings.incrementalReading.calloutSignal.typeWeights.splice(index, 1);
      saveSettings();
    }
  }

  // 判断是否为自定义类型
  function isCustomType(type: string): boolean {
    return !BUILTIN_TYPES.includes(type);
  }
</script>

<div class="weave-settings settings-section incremental-reading-settings">
  <!-- 牌组调度设置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-amber">{t('irSettings.scheduleTitle')}</h4>
    
    <div class="group-content">
      <!-- 每日新块上限 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irDailyNewLimit">{t('irSettings.dailyNewLabel')}</label>
          <p class="desc">{t('irSettings.dailyNewDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irDailyNewLimit"
            type="range"
            min="0"
            max="50"
            step="5"
            value={settings.incrementalReading?.dailyNewLimit ?? 20}
            class="modern-slider"
            oninput={handleDailyNewLimitChange}
          />
          <span class="slider-value">{settings.incrementalReading?.dailyNewLimit ?? 20}</span>
        </div>
      </div>

      <!-- 每日复习上限 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irDailyReviewLimit">{t('irSettings.dailyReviewLabel')}</label>
          <p class="desc">{t('irSettings.dailyReviewDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irDailyReviewLimit"
            type="range"
            min="0"
            max="200"
            step="10"
            value={settings.incrementalReading?.dailyReviewLimit ?? 50}
            class="modern-slider"
            oninput={handleDailyReviewLimitChange}
          />
          <span class="slider-value">{settings.incrementalReading?.dailyReviewLimit ?? 50}</span>
        </div>
      </div>

      <!-- 待读天数（统一用于统计和提前阅读范围） -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irLearnAheadDays">{t('irSettings.learnAheadLabel')}</label>
          <p class="desc">{t('irSettings.learnAheadDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irLearnAheadDays"
            type="range"
            min="1"
            max="14"
            step="1"
            value={settings.incrementalReading?.learnAheadDays ?? 3}
            class="modern-slider"
            oninput={handleLearnAheadDaysChange}
          />
          <span class="slider-value">{settings.incrementalReading?.learnAheadDays ?? 3}{t('irSettings.unitDays')}</span>
        </div>
      </div>

      <!-- 默认间隔因子 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irIntervalFactor">{t('irSettings.intervalFactorLabel')}</label>
          <p class="desc">{t('irSettings.intervalFactorDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irIntervalFactor"
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={settings.incrementalReading?.defaultIntervalFactor ?? 1.5}
            class="modern-slider"
            oninput={handleIntervalFactorChange}
          />
          <span class="slider-value">{(settings.incrementalReading?.defaultIntervalFactor ?? 1.5).toFixed(1)}x</span>
        </div>
      </div>

      <!-- 复习阈值 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irReviewThreshold">{t('irSettings.reviewThresholdLabel')}</label>
          <p class="desc">{t('irSettings.reviewThresholdDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irReviewThreshold"
            type="range"
            min="3"
            max="14"
            step="1"
            value={settings.incrementalReading?.reviewThreshold ?? 7}
            class="modern-slider"
            oninput={handleReviewThresholdChange}
          />
          <span class="slider-value">{settings.incrementalReading?.reviewThreshold ?? 7}{t('irSettings.unitDays')}</span>
        </div>
      </div>

      <!-- 最大间隔 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irMaxInterval">{t('irSettings.maxIntervalLabel')}</label>
          <p class="desc">{t('irSettings.maxIntervalDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irMaxInterval"
            type="range"
            min="30"
            max="365"
            step="30"
            value={settings.incrementalReading?.maxInterval ?? 365}
            class="modern-slider"
            oninput={handleMaxIntervalChange}
          />
          <span class="slider-value">{settings.incrementalReading?.maxInterval ?? 365}{t('irSettings.unitDays')}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 内容拆分设置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-cyan">{t('irSettings.splitTitle')}</h4>
    
    <div class="group-content">
      <!-- 默认拆分级别 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irDefaultSplitLevel">{t('irSettings.splitLevelLabel')}</label>
          <p class="desc">{t('irSettings.splitLevelDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irDefaultSplitLevel"
            type="range"
            min="1"
            max="6"
            step="1"
            value={settings.incrementalReading?.defaultSplitLevel ?? 2}
            class="modern-slider"
            oninput={handleDefaultSplitLevelChange}
          />
          <span class="slider-value">H{settings.incrementalReading?.defaultSplitLevel ?? 2}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- v3.0 调度策略设置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-purple">{t('irSettings.strategyTitle')} <span class="badge">v3.0</span></h4>
    
    <div class="group-content">
      <!-- 调度策略选择 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irScheduleStrategy">{t('irSettings.strategyLabel')}</label>
          <p class="desc">{t('irSettings.strategyDesc')}</p>
        </div>
        <ObsidianDropdown
          options={STRATEGY_OPTIONS.map(opt => ({ id: opt.id, label: opt.label, description: opt.desc }))}
          value={settings.incrementalReading?.scheduleStrategy ?? 'processing'}
          onchange={(value) => {
            if (!settings.incrementalReading) {
              settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
            }
            settings.incrementalReading.scheduleStrategy = value as 'processing' | 'reading-list';
            saveSettings();
          }}
        />
      </div>
      
      <!-- 策略说明 -->
      <div class="strategy-hint">
        {#if settings.incrementalReading?.scheduleStrategy === 'reading-list'}
          {t('irSettings.strategyHintReadingList')}
        {:else}
          {t('irSettings.strategyHintProcessing')}
        {/if}
      </div>

      <!-- 每日时间预算 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irTimeBudget">{t('irSettings.timeBudgetLabel')}</label>
          <p class="desc">{t('irSettings.timeBudgetDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irTimeBudget"
            type="range"
            min="10"
            max="120"
            step="10"
            value={settings.incrementalReading?.dailyTimeBudgetMinutes ?? 40}
            class="modern-slider"
            oninput={handleTimeBudgetChange}
          />
          <span class="slider-value">{settings.incrementalReading?.dailyTimeBudgetMinutes ?? 40}{t('irSettings.unitMinutes')}</span>
        </div>
      </div>

      <!-- 同块每日出现上限（仅加工流模式） -->
      {#if settings.incrementalReading?.scheduleStrategy !== 'reading-list'}
      <div class="row">
        <div class="label-with-desc">
          <label for="irMaxAppearances">{t('irSettings.maxAppearancesLabel')}</label>
          <p class="desc">{t('irSettings.maxAppearancesDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irMaxAppearances"
            type="range"
            min="1"
            max="5"
            step="1"
            value={settings.incrementalReading?.maxAppearancesPerDay ?? 2}
            class="modern-slider"
            oninput={handleMaxAppearancesChange}
          />
          <span class="slider-value">{settings.incrementalReading?.maxAppearancesPerDay ?? 2}{t('irSettings.unitTimes')}</span>
        </div>
      </div>
      {/if}
    </div>
  </div>

  <!-- v3.0 高级调度设置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-rose">{t('irSettings.advancedTitle')}</h4>
    
    <div class="group-content">
      <!-- 启用标签组先验 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irTagGroupPrior">{t('irSettings.tagGroupPriorLabel')}</label>
          <p class="desc">{t('irSettings.tagGroupPriorDesc')}</p>
        </div>
        <label class="modern-switch">
          <input
            id="irTagGroupPrior"
            type="checkbox"
            checked={settings.incrementalReading?.enableTagGroupPrior ?? true}
            onchange={handleTagGroupPriorChange}
          />
          <span class="switch-slider"></span>
        </label>
      </div>

      <!-- 🆕 v3.0 标签组管理器（仅在启用时显示） -->
      {#if settings.incrementalReading?.enableTagGroupPrior !== false}
        <IRTagGroupManager {plugin} />

        <!-- 标签组自动跟随 -->
        <div class="row">
          <div class="label-with-desc">
            <label for="irTagGroupFollowMode">{t('irSettings.tagGroupFollowLabel')}</label>
            <p class="desc">{t('irSettings.tagGroupFollowDesc')}</p>
          </div>
          <ObsidianDropdown
            options={[
              { id: 'off', label: t('irSettings.followOff'), description: t('irSettings.followOffDesc') },
              { id: 'ask', label: t('irSettings.followAsk'), description: t('irSettings.followAskDesc') },
              { id: 'auto', label: t('irSettings.followAuto'), description: t('irSettings.followAutoDesc') }
            ]}
            value={settings.incrementalReading?.tagGroupFollowMode ?? 'ask'}
            onchange={(value) => {
              if (!settings.incrementalReading) {
                settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
              }
              settings.incrementalReading.tagGroupFollowMode = value as 'off' | 'ask' | 'auto';
              saveSettings();
            }}
          />
        </div>
      {/if}

      <!-- 防沉底强度 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irAgingStrength">{t('irSettings.agingStrengthLabel')}</label>
          <p class="desc">{t('irSettings.agingStrengthDesc')}</p>
        </div>
        <ObsidianDropdown
          options={AGING_OPTIONS.map(opt => ({ id: opt.id, label: opt.label, description: opt.desc }))}
          value={settings.incrementalReading?.agingStrength ?? 'low'}
          onchange={(value) => {
            if (!settings.incrementalReading) {
              settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
            }
            settings.incrementalReading.agingStrength = value as 'low' | 'medium' | 'high';
            saveSettings();
          }}
        />
      </div>

      <!-- 自动后推策略 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irPostponeStrategy">{t('irSettings.postponeLabel')}</label>
          <p class="desc">{t('irSettings.postponeDesc')}</p>
        </div>
        <ObsidianDropdown
          options={POSTPONE_OPTIONS.map(opt => ({ id: opt.id, label: opt.label, description: opt.desc }))}
          value={settings.incrementalReading?.autoPostponeStrategy ?? 'gentle'}
          onchange={(value) => {
            if (!settings.incrementalReading) {
              settings.incrementalReading = { ...DEFAULT_IR_SETTINGS };
            }
            settings.incrementalReading.autoPostponeStrategy = value as 'off' | 'gentle' | 'aggressive';
            saveSettings();
          }}
        />
      </div>

      <!-- 优先级半衰期 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irPriorityHalfLife">{t('irSettings.priorityHalfLifeLabel')}</label>
          <p class="desc">{t('irSettings.priorityHalfLifeDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irPriorityHalfLife"
            type="range"
            min="3"
            max="30"
            step="1"
            value={settings.incrementalReading?.priorityHalfLifeDays ?? 7}
            class="modern-slider"
            oninput={handlePriorityHalfLifeChange}
          />
          <span class="slider-value">{settings.incrementalReading?.priorityHalfLifeDays ?? 7}{t('irSettings.unitDays')}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 交错学习设置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-green">{t('irSettings.interleaveTitle')}</h4>
    
    <div class="group-content">
      <!-- 启用交错学习 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irInterleaveMode">{t('irSettings.interleaveModeLabel')}</label>
          <p class="desc">{t('irSettings.interleaveModeDesc')}</p>
        </div>
        <label class="modern-switch">
          <input
            id="irInterleaveMode"
            type="checkbox"
            checked={settings.incrementalReading?.interleaveMode ?? true}
            onchange={handleInterleaveModeChange}
          />
          <span class="switch-slider"></span>
        </label>
      </div>

      <!-- 最大连续同主题块数（仅在交错模式下显示） -->
      {#if settings.incrementalReading?.interleaveMode !== false}
      <div class="row">
        <div class="label-with-desc">
          <label for="irMaxConsecutive">{t('irSettings.maxConsecutiveLabel')}</label>
          <p class="desc">{t('irSettings.maxConsecutiveDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irMaxConsecutive"
            type="range"
            min="1"
            max="10"
            step="1"
            value={settings.incrementalReading?.maxConsecutiveSameTopic ?? 3}
            class="modern-slider"
            oninput={handleMaxConsecutiveChange}
          />
          <span class="slider-value">{settings.incrementalReading?.maxConsecutiveSameTopic ?? 3}{t('irSettings.unitBlocks')}</span>
        </div>
      </div>
      {/if}
    </div>
  </div>

  <!-- v3.1 标注信号配置 -->
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-indigo">{t('irSettings.calloutSignalTitle')} <span class="badge">v3.1</span></h4>
    
    <div class="group-content">
      <!-- 启用标注信号 -->
      <div class="row">
        <div class="label-with-desc">
          <label for="irCalloutSignalEnabled">{t('irSettings.calloutSignalLabel')}</label>
          <p class="desc">{t('irSettings.calloutSignalDesc')}</p>
        </div>
        <label class="modern-switch">
          <input
            id="irCalloutSignalEnabled"
            type="checkbox"
            checked={getCalloutSignal().enabled ?? true}
            onchange={handleCalloutSignalEnabledChange}
          />
          <span class="switch-slider"></span>
        </label>
      </div>

      <!-- 仅在启用时显示详细配置 -->
      {#if getCalloutSignal().enabled !== false}
        <!-- 类型权重配置 -->
        <div class="callout-types-section">
          <div class="section-label">{t('irSettings.calloutTypeWeightsLabel')}</div>
          <p class="section-desc">{t('irSettings.calloutTypeWeightsDesc')}</p>
          
          <div class="callout-types-list">
            {#each getTypeWeights() as typeWeight (typeWeight.type)}
              <div class="callout-type-row" class:disabled={!typeWeight.enabled}>
                <div class="type-left">
                  <label class="type-checkbox">
                    <input
                      type="checkbox"
                      checked={typeWeight.enabled}
                      onchange={(e) => handleCalloutTypeEnabledChange(typeWeight.type, (e.target as HTMLInputElement).checked)}
                    />
                    <span class="type-name">{CALLOUT_TYPE_LABELS[typeWeight.type] ?? typeWeight.type}</span>
                  </label>
                  {#if isCustomType(typeWeight.type)}
                    <button
                      class="type-remove-btn"
                      onclick={() => handleRemoveCustomType(typeWeight.type)}
                      type="button"
                      title={t('irSettings.deleteBtn')}
                    >×</button>
                  {/if}
                </div>
                <div class="type-weight-control">
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={typeWeight.weight}
                    class="type-weight-slider"
                    disabled={!typeWeight.enabled}
                    oninput={(e) => handleCalloutTypeWeightChange(typeWeight.type, parseFloat((e.target as HTMLInputElement).value))}
                  />
                  <span class="type-weight-value">{typeWeight.weight.toFixed(1)}</span>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- 添加自定义类型 -->
          <div class="add-custom-type">
            <input
              type="text"
              class="custom-type-input"
              placeholder={t('irSettings.calloutTypePlaceholder')}
              bind:value={newCalloutType}
              onkeydown={(e) => e.key === 'Enter' && handleAddCustomType()}
            />
            <div class="custom-type-weight">
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                bind:value={newCalloutWeight}
                class="type-weight-slider"
              />
              <span class="type-weight-value">{newCalloutWeight.toFixed(1)}</span>
            </div>
            <button
              class="add-type-btn"
              onclick={handleAddCustomType}
              type="button"
              disabled={!newCalloutType.trim()}
            >{t('irSettings.addBtn')}</button>
          </div>
        </div>

        <!-- 最大增益 -->
        <div class="row">
          <div class="label-with-desc">
            <label for="irMaxBoost">{t('irSettings.maxBoostLabel')}</label>
            <p class="desc">{t('irSettings.maxBoostDesc')}</p>
          </div>
          <div class="slider-container">
            <input
              id="irMaxBoost"
              type="range"
              min="1.0"
              max="2.0"
              step="0.1"
              value={getCalloutSignal().maxBoost ?? 2.0}
              class="modern-slider"
              oninput={handleMaxBoostChange}
            />
            <span class="slider-value">+{(getCalloutSignal().maxBoost ?? 2.0).toFixed(1)}</span>
          </div>
        </div>

        <!-- 饱和参数 -->
        <div class="row">
          <div class="label-with-desc">
            <label for="irSaturationParam">{t('irSettings.saturationLabel')}</label>
            <p class="desc">{t('irSettings.saturationDesc')}</p>
          </div>
          <div class="slider-container">
            <input
              id="irSaturationParam"
              type="range"
              min="3"
              max="6"
              step="1"
              value={getCalloutSignal().saturationParam ?? 4}
              class="modern-slider"
              oninput={handleSaturationParamChange}
            />
            <span class="slider-value">{getCalloutSignal().saturationParam ?? 4}</span>
          </div>
        </div>

        <!-- 最小内容阈值 -->
        <div class="row">
          <div class="label-with-desc">
            <label for="irMinContentLength">{t('irSettings.minContentLabel')}</label>
            <p class="desc">{t('irSettings.minContentDesc')}</p>
          </div>
          <div class="slider-container">
            <input
              id="irMinContentLength"
              type="range"
              min="0"
              max="50"
              step="5"
              value={getCalloutSignal().minContentLength ?? 0}
              class="modern-slider"
              oninput={handleMinContentLengthChange}
            />
            <span class="slider-value">{getCalloutSignal().minContentLength ?? 0}{t('irSettings.unitChars')}</span>
          </div>
        </div>

        <!-- 算法说明 -->
        <div class="algorithm-hint">
          <div class="hint-title">{t('irSettings.algorithmHintTitle')}</div>
          <div class="hint-content">
            <code>signal = maxBoost × tanh(Σ(count × weight) / s)</code>
            <p>{t('irSettings.algorithmHintContent')}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>

</div>

  <style>
  .incremental-reading-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* 蓝色强调条（导入设置） */
  :global(.accent-blue) {
    --accent-color: #3b82f6;
  }

  :global(.with-accent-bar.accent-blue::before) {
    background: linear-gradient(180deg, #3b82f6, #2563eb);
  }

  /* 琥珀色强调条（牌组调度） */
  :global(.accent-amber) {
    --accent-color: #f59e0b;
  }

  :global(.with-accent-bar.accent-amber::before) {
    background: linear-gradient(180deg, #f59e0b, #d97706);
  }

  /* 青色强调条（内容拆分） */
  :global(.accent-cyan) {
    --accent-color: #06b6d4;
  }

  :global(.with-accent-bar.accent-cyan::before) {
    background: linear-gradient(180deg, #06b6d4, #0891b2);
  }

  /* 绿色强调条（交错学习） */
  :global(.accent-green) {
    --accent-color: #10b981;
  }

  :global(.with-accent-bar.accent-green::before) {
    background: linear-gradient(180deg, #10b981, #059669);
  }

  /* v3.0 紫色强调条（调度策略） */
  :global(.accent-purple) {
    --accent-color: #8b5cf6;
  }

  :global(.with-accent-bar.accent-purple::before) {
    background: linear-gradient(180deg, #8b5cf6, #7c3aed);
  }

  /* v3.0 玫瑰色强调条（高级调度） */
  :global(.accent-rose) {
    --accent-color: #f43f5e;
  }

  :global(.with-accent-bar.accent-rose::before) {
    background: linear-gradient(180deg, #f43f5e, #e11d48);
  }

  /* v3.0 徽章样式 */
  .badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 0.65rem;
    font-weight: 600;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    margin-left: 8px;
    vertical-align: middle;
  }

  /* v3.0 策略说明样式 */
  .strategy-hint {
    padding: 10px 12px;
    margin: 8px 0;
    background: var(--background-secondary);
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* v3.0 下拉选择框样式 */

  /* v3.1 靛蓝色强调条（标注信号） */
  :global(.accent-indigo) {
    --accent-color: #6366f1;
  }

  :global(.with-accent-bar.accent-indigo::before) {
    background: linear-gradient(180deg, #6366f1, #4f46e5);
  }

  /* v3.1 标注类型配置区域 */
  .callout-types-section {
    margin: 12px 0;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .section-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .callout-types-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .callout-type-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--background-primary);
    border-radius: 6px;
    transition: opacity 0.15s ease;
  }

  .callout-type-row.disabled {
    opacity: 0.5;
  }

  .type-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .type-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .type-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .type-name {
    font-size: 0.85rem;
    color: var(--text-normal);
  }

  .type-weight-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .type-weight-slider {
    width: 80px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--background-modifier-border);
    border-radius: 2px;
    cursor: pointer;
  }

  .type-weight-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: var(--interactive-accent);
    border-radius: 50%;
    cursor: pointer;
  }

  .type-weight-slider:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .type-weight-slider:disabled::-webkit-slider-thumb {
    background: var(--text-muted);
    cursor: not-allowed;
  }

  .type-weight-value {
    min-width: 32px;
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: right;
  }

  .type-remove-btn {
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .type-remove-btn:hover {
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
  }

  /* 添加自定义类型区域 */
  .add-custom-type {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .custom-type-input {
    flex: 1;
    min-width: 120px;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.85rem;
  }

  .custom-type-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .custom-type-input::placeholder {
    color: var(--text-faint);
  }

  .custom-type-weight {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .add-type-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s ease;
    white-space: nowrap;
  }

  .add-type-btn:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .add-type-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* v3.1 算法说明样式 */
  .algorithm-hint {
    margin-top: 12px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .algorithm-hint .hint-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .algorithm-hint .hint-content {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .algorithm-hint code {
    display: block;
    padding: 8px 10px;
    margin-bottom: 8px;
    background: var(--background-primary);
    border-radius: 4px;
    font-family: var(--font-monospace);
    font-size: 0.8rem;
    color: var(--text-accent);
  }

  .algorithm-hint p {
    margin: 0;
  }
</style>
