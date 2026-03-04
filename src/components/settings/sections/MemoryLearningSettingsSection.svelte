<script lang="ts">
  import { logger } from '../../../utils/logger';
  import type WeavePlugin from '../../../main';
  import { tr } from '../../../utils/i18n';
  import { DEFAULT_AI_CONFIG } from '../constants/settings-constants';

  import SiblingDispersionSettings from './SiblingDispersionSettings.svelte';

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();
  let settings = $state(plugin.settings);

  let t = $derived($tr);

  function initializeCardSplittingConfig() {
    const defaultConfig = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG.cardSplitting));
    if (!plugin.settings.aiConfig?.cardSplitting) {
      return defaultConfig;
    }
    return {
      ...defaultConfig,
      ...plugin.settings.aiConfig.cardSplitting
    };
  }

  let cardSplitting = $state(initializeCardSplittingConfig());

  $effect(() => {
    if (cardSplitting) {
      if (!settings.aiConfig) {
        settings.aiConfig = { ...DEFAULT_AI_CONFIG };
      }
      settings.aiConfig.cardSplitting = cardSplitting;
      plugin.settings = settings;
      plugin.saveSettings();
    }
  });

  async function saveSettings() {
    try {
      plugin.settings = settings;
      await plugin.saveSettings();

} catch (error) {
      logger.error('保存设置失败:', error);
}
  }

  function handleReviewsPerDayChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    const MAX_REVIEWS_PER_DAY = 200;
    if (!isNaN(value) && value >= 1 && value <= MAX_REVIEWS_PER_DAY) {
      settings.reviewsPerDay = value;
      saveSettings();
    }
  }

  function handleNewCardsPerDayChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    const MAX_NEW_CARDS_PER_DAY = 100;
    if (!isNaN(value) && value >= 0 && value <= MAX_NEW_CARDS_PER_DAY) {
      settings.newCardsPerDay = value;
      saveSettings();
    }
  }

  function handleAutoShowAnswerChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 0 && value <= 10) {
      settings.autoShowAnswerSeconds = value;
      saveSettings();
    }
  }

  function handleLearningStepsChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const DEFAULT_LEARNING_STEPS = [1, 10];
    const steps = value.split(/\s+/)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n) && n >= 0);

    settings.learningSteps = steps.length ? steps : DEFAULT_LEARNING_STEPS;
    saveSettings();
  }

  function handleGraduatingIntervalChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 30) {
      settings.graduatingInterval = value;
      saveSettings();
    }
  }

  function handleMaxAdvanceDaysChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 7) {
      settings.maxAdvanceDays = value;
      saveSettings();
    }
  }

  function formatLearningSteps(steps: number[]): string {
    return steps.join(' ');
  }

  function formatAutoShowAnswer(seconds: number): string {
    return seconds === 0 ? t('common.time.manual') : t('common.time.seconds', { count: seconds });
  }
</script>

<div class="weave-settings settings-section memory-learning-settings">
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-orange">{t('settings.learning.title')}</h4>

    <div class="group-content">
      <div class="row">
        <label for="reviewsPerDay">{t('settings.learning.reviewsPerDay.label')}</label>
        <div class="slider-container">
          <input
            id="reviewsPerDay"
            type="range"
            min="1"
            max="200"
            step="5"
            value={settings.reviewsPerDay}
            class="modern-slider"
            oninput={handleReviewsPerDayChange}
          />
          <span class="slider-value">{settings.reviewsPerDay}</span>
        </div>
      </div>

      <div class="row">
        <label for="newCardsPerDay">{t('settings.learning.newCardsPerDay.label')}</label>
        <div class="slider-container">
          <input
            id="newCardsPerDay"
            type="range"
            min="0"
            max="100"
            step="5"
            value={settings.newCardsPerDay || 20}
            class="modern-slider"
            oninput={handleNewCardsPerDayChange}
          />
          <span class="slider-value">{settings.newCardsPerDay || 20}</span>
        </div>
      </div>

      <div class="row">
        <label for="autoShowAnswer">{t('settings.learning.autoAdvance.label')}</label>
        <div class="slider-container">
          <input
            id="autoShowAnswer"
            type="range"
            min="0"
            max="10"
            step="1"
            value={settings.autoShowAnswerSeconds}
            class="modern-slider"
            oninput={handleAutoShowAnswerChange}
          />
          <span class="slider-value">{formatAutoShowAnswer(settings.autoShowAnswerSeconds)}</span>
        </div>
      </div>

      <div class="row">
        <label for="learningSteps">学习步骤（分钟）</label>
        <input
          id="learningSteps"
          type="text"
          placeholder="1 10"
          value={formatLearningSteps(settings.learningSteps)}
          class="modern-input"
          oninput={handleLearningStepsChange}
        />
        <span class="learning-help-text">用空格分隔多个时间间隔</span>
      </div>

      <div class="row">
        <label for="graduatingInterval">毕业间隔（天）</label>
        <div class="slider-container">
          <input
            id="graduatingInterval"
            type="range"
            min="1"
            max="30"
            step="1"
            value={settings.graduatingInterval}
            class="modern-slider"
            oninput={handleGraduatingIntervalChange}
          />
          <span class="slider-value">{settings.graduatingInterval}天</span>
        </div>
      </div>

      <div class="row">
        <label for="maxAdvanceDays">提前学习天数限制</label>
        <div class="slider-container">
          <input
            id="maxAdvanceDays"
            type="range"
            min="1"
            max="7"
            step="1"
            value={settings.maxAdvanceDays || 7}
            class="modern-slider"
            oninput={handleMaxAdvanceDaysChange}
          />
          <span class="slider-value">{settings.maxAdvanceDays || 7}天</span>
        </div>
      </div>
    </div>
  </div>

  <SiblingDispersionSettings {plugin} />

  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-cyan">
      {t('aiConfig.cardSplitting.title')}
    </h4>

    <div class="group-content">
      <div class="row">
        <label for="cardSplittingEnabled">{t('aiConfig.cardSplitting.enabled.label')}</label>
        <label class="modern-switch">
          <input
            id="cardSplittingEnabled"
            type="checkbox"
            bind:checked={cardSplitting.enabled}
          />
          <span class="switch-slider"></span>
        </label>
      </div>

      {#if cardSplitting.enabled}
        <div class="row">
          <label for="defaultTargetCount">{t('aiConfig.cardSplitting.defaultTargetCount.label')}</label>
          <input
            id="defaultTargetCount"
            type="number"
            min="0"
            max="10"
            bind:value={cardSplitting.defaultTargetCount}
            class="modern-input number-input-compact"
          />
        </div>

        <div class="row">
          <label for="minContentLength">{t('aiConfig.cardSplitting.minContentLength.label')}</label>
          <input
            id="minContentLength"
            type="number"
            min="50"
            max="1000"
            step="50"
            bind:value={cardSplitting.minContentLength}
            class="modern-input number-input-compact"
          />
        </div>

        <div class="row">
          <label for="maxContentLength">{t('aiConfig.cardSplitting.maxContentLength.label')}</label>
          <input
            id="maxContentLength"
            type="number"
            min="1000"
            max="10000"
            step="500"
            bind:value={cardSplitting.maxContentLength}
            class="modern-input number-input-compact"
          />
        </div>

        <div class="row">
          <label for="autoInheritTags">{t('aiConfig.cardSplitting.autoInheritTags.label')}</label>
          <label class="modern-switch">
            <input
              id="autoInheritTags"
              type="checkbox"
              bind:checked={cardSplitting.autoInheritTags}
            />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="row">
          <label for="autoInheritSource">{t('aiConfig.cardSplitting.autoInheritSource.label')}</label>
          <label class="modern-switch">
            <input
              id="autoInheritSource"
              type="checkbox"
              bind:checked={cardSplitting.autoInheritSource}
            />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="row">
          <label for="requireConfirmation">{t('aiConfig.cardSplitting.requireConfirmation.label')}</label>
          <label class="modern-switch">
            <input
              id="requireConfirmation"
              type="checkbox"
              bind:checked={cardSplitting.requireConfirmation}
            />
            <span class="switch-slider"></span>
          </label>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .learning-help-text {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-left: auto;
    max-width: 200px;
    text-align: right;
  }

  .number-input-compact {
    width: 80px;
    text-align: center;
  }

  @media (max-width: 768px) {
    .learning-help-text {
      margin-left: 0;
      text-align: left;
      max-width: none;
    }
  }
</style>
