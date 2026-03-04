<script lang="ts">
  import type { PluginExtended, EditorSettings } from '../types/settings-types';
  import { updateSettings, getSettingsValue } from '../utils/settings-utils';
  import { 
    CSS_CLASSES, 
    LINK_STYLE_OPTIONS, 
    LINK_PATH_OPTIONS,
    DEFAULT_SETTINGS 
  } from '../constants/settings-constants';
  import ObsidianDropdown from "../../ui/ObsidianDropdown.svelte";
  
  //  导入国际化
  import { tr } from '../../../utils/i18n';

  interface Props {
    plugin: PluginExtended;
    onSave: () => Promise<void>;
  }

  let { plugin, onSave }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);

  // 获取编辑器设置，如果不存在则使用默认值
  let editorSettings = $derived.by(() => {
    return getSettingsValue<EditorSettings>(plugin.settings, 'editor', {
      linkStyle: 'wikilink',
      linkPath: 'short',
      preferAlias: true,
      attachmentDir: DEFAULT_SETTINGS.ATTACHMENT_DIR,
      embedImages: true
    });
  });

  // 更新编辑器设置
  async function updateEditorSetting<K extends keyof EditorSettings>(
    key: K, 
    value: EditorSettings[K]
  ) {
    plugin.settings = updateSettings(plugin.settings, `editor.${key}`, value);
    await onSave();
  }

  // 链接样式选项
  const linkStyleOptions = LINK_STYLE_OPTIONS.map(option => ({
    id: option.id,
    label: option.label
  }));

  // 链接路径选项
  const linkPathOptions = LINK_PATH_OPTIONS.map(option => ({
    id: option.id,
    label: option.label
  }));

  // 处理复选框变化
  function handleCheckboxChange(key: keyof EditorSettings, event: Event) {
    const target = event.target as HTMLInputElement;
    updateEditorSetting(key, target.checked);
  }

  // 处理文本输入变化
  function handleTextInputChange(key: keyof EditorSettings, event: Event) {
    const target = event.target as HTMLInputElement;
    updateEditorSetting(key, target.value || DEFAULT_SETTINGS.ATTACHMENT_DIR);
  }
</script>

<div class="weave-settings settings-section editor-settings">
  <div class="settings-group">
    <h4 class="group-title with-accent-bar accent-blue">{t('settings.editor.title')}</h4>
    <p class="section-description">{t('settings.editor.description')}</p>
  
    <div class="group-content">
    <!-- 编辑器模式说明 -->
    <div class="row">
      <div class="row-label">{t('settings.editor.editorMode.label')}</div>
      <div class="settings-info">
        <span class="mode-indicator">{t('settings.editor.editorMode.markdownMode')}</span>
        <small class="settings-note">{t('settings.editor.editorMode.description')}</small>
      </div>
    </div>

    <!-- 链接样式设置 -->
    <div class="row">
      <div class="row-label">{t('settings.editor.linkStyle.label')}</div>
      <ObsidianDropdown
        options={linkStyleOptions}
        value={editorSettings.linkStyle || 'wikilink'}
        onchange={(value) => updateEditorSetting('linkStyle', value as 'wikilink' | 'markdown')}
      />
    </div>

    <!-- 链接路径设置 -->
    <div class="row">
      <div class="row-label">{t('settings.editor.linkPath.label')}</div>
      <ObsidianDropdown
        options={linkPathOptions}
        value={editorSettings.linkPath || 'short'}
        onchange={(value) => updateEditorSetting('linkPath', value as 'short' | 'relative' | 'absolute')}
      />
    </div>

    <!-- 优先使用别名 -->
    <div class="row">
      <label for="preferAlias">{t('settings.editor.preferAlias.label')}</label>
      <label class="modern-switch">
        <input 
          id="preferAlias"
          type="checkbox"
          checked={editorSettings.preferAlias ?? true}
          onchange={(e) => handleCheckboxChange('preferAlias', e)}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <!-- 附件目录设置 -->
    <div class="row">
      <label for="attachDir">{t('settings.editor.attachmentDir.label')}</label>
      <input 
        id="attachDir" 
        type="text" 
        value={editorSettings.attachmentDir || DEFAULT_SETTINGS.ATTACHMENT_DIR} 
        oninput={(e) => handleTextInputChange('attachmentDir', e)}
        placeholder={DEFAULT_SETTINGS.ATTACHMENT_DIR}
        class="modern-input"
      />
    </div>

    <!-- 嵌入图片 -->
    <div class="row">
      <label for="embedImages">{t('settings.editor.embedImages.label')}</label>
      <label class="modern-switch">
        <input 
          id="embedImages"
          type="checkbox"
          checked={editorSettings.embedImages ?? true}
          onchange={(e) => handleCheckboxChange('embedImages', e)}
        />
        <span class="switch-slider"></span>
      </label>
    </div>
  </div>
  </div>
</div>

<style>
  .row-label {
    width: 180px;
    color: var(--text-normal);
    font-weight: 500;
    flex-shrink: 0;
  }

  .settings-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .mode-indicator {
    font-weight: 500;
    color: var(--text-normal);
  }

  .settings-note {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.3;
  }
</style>
