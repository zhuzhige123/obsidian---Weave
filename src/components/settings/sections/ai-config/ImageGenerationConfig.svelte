<script lang="ts">
  //  导入国际化
  import { tr } from '../../../../utils/i18n';
  import ObsidianDropdown from '../../../ui/ObsidianDropdown.svelte';

  interface Props {
    imageGeneration: {
      defaultSyntax: 'wiki' | 'markdown';
      attachmentDir: string;
      autoCreateSubfolders: boolean;
      includeTimestamp: boolean;
      includeCaption: boolean;
    };
  }

  let { imageGeneration = $bindable() }: Props = $props();

  //  响应式翻译函数
  let t = $derived($tr);
</script>

<div class="image-generation-config">
  <!-- 默认语法 -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">{t('aiConfig.imageGeneration.defaultSyntax.label')}</div>
      <div class="setting-item-description">
        {t('aiConfig.imageGeneration.defaultSyntax.description')}
      </div>
    </div>
    <div class="setting-item-control">
      <ObsidianDropdown
        options={[
          { id: 'wiki', label: t('aiConfig.imageGeneration.defaultSyntax.wiki') },
          { id: 'markdown', label: t('aiConfig.imageGeneration.defaultSyntax.markdown') }
        ]}
        value={imageGeneration.defaultSyntax}
        onchange={(value) => {
          imageGeneration.defaultSyntax = value as 'wiki' | 'markdown';
        }}
      />
    </div>
  </div>

  <!-- 附件目录 -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">{t('aiConfig.imageGeneration.attachmentDir.label')}</div>
      <div class="setting-item-description">
        {t('aiConfig.imageGeneration.attachmentDir.description')}
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        bind:value={imageGeneration.attachmentDir}
        placeholder={t('aiConfig.imageGeneration.attachmentDir.placeholder')}
        class="text-input"
      />
    </div>
  </div>

  <!-- 自动创建子文件夹 -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">{t('aiConfig.imageGeneration.autoCreateSubfolders.label')}</div>
      <div class="setting-item-description">
        {t('aiConfig.imageGeneration.autoCreateSubfolders.description')}
      </div>
    </div>
    <div class="setting-item-control">
      <label class="modern-switch">
        <input
          type="checkbox"
          bind:checked={imageGeneration.autoCreateSubfolders}
        />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>

  <!-- 包含时间戳 -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">{t('aiConfig.imageGeneration.includeTimestamp.label')}</div>
      <div class="setting-item-description">
        {t('aiConfig.imageGeneration.includeTimestamp.description')}
      </div>
    </div>
    <div class="setting-item-control">
      <label class="modern-switch">
        <input
          type="checkbox"
          bind:checked={imageGeneration.includeTimestamp}
        />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>

  <!-- 包含说明文字 -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">{t('aiConfig.imageGeneration.includeCaption.label')}</div>
      <div class="setting-item-description">
        {t('aiConfig.imageGeneration.includeCaption.description')}
      </div>
    </div>
    <div class="setting-item-control">
      <label class="modern-switch">
        <input
          type="checkbox"
          bind:checked={imageGeneration.includeCaption}
        />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>
</div>

<style>
  .image-generation-config {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .setting-item-info {
    flex: 1;
    min-width: 0;
  }

  .setting-item-name {
    font-size: 0.95em;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .setting-item-description {
    font-size: 0.85em;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .setting-item-control {
    flex-shrink: 0;
    min-width: 200px;
  }

  .text-input {
    width: 100%;
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9em;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

</style>



