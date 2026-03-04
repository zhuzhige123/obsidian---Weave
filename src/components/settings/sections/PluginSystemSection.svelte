<script lang="ts">
  import { onMount } from 'svelte';
  import { Notice } from 'obsidian';
  import { logger } from '../../../utils/logger';
  import { tr } from '../../../utils/i18n';
  import { getV2PathsFromApp } from '../../../config/paths';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';
  import AutoRulesConfigModal from '../../modals/AutoRulesConfigModal.svelte';
  import type { PluginExtended } from '../types/settings-types';
  import type { PluginRegistryEntry } from '../../../types/weave-plugin-types';

  interface Props { plugin: PluginExtended }
  let { plugin }: Props = $props();

  let t = $derived($tr);

  let plugins = $state<PluginRegistryEntry[]>([]);
  let isLoading = $state(true);
  let errorMessage = $state('');

  // 插件配置模态窗状态
  let showAutoRulesConfig = $state(false);

  const CONFIGURABLE_PLUGINS = new Set(['auto-rules']);

  function hasSettings(pluginId: string): boolean {
    return CONFIGURABLE_PLUGINS.has(pluginId);
  }

  function openPluginSettings(pluginId: string) {
    if (pluginId === 'auto-rules') {
      showAutoRulesConfig = true;
    }
  }

  async function refreshPlugins() {
    isLoading = true;
    errorMessage = '';
    try {
      const system = plugin.WeavePluginSystem;
      if (!system) {
        plugins = [];
        return;
      }
      plugins = system.getPlugins();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[PluginSystemSection] Failed to refresh plugins:', err);
    } finally {
      isLoading = false;
    }
  }

  async function togglePlugin(pluginId: string, currentState: string) {
    const system = plugin.WeavePluginSystem;
    if (!system) return;

    try {
      if (currentState === 'enabled') {
        await system.disablePlugin(pluginId);
      } else {
        await system.enablePlugin(pluginId);
      }
      await refreshPlugins();
    } catch (err) {
      logger.error(`[PluginSystemSection] Failed to toggle plugin ${pluginId}:`, err);
    }
  }

  async function reloadPlugin(pluginId: string) {
    const system = plugin.WeavePluginSystem;
    if (!system) return;

    try {
      await system.reloadPlugin(pluginId);
      await refreshPlugins();
    } catch (err) {
      logger.error(`[PluginSystemSection] Failed to reload plugin ${pluginId}:`, err);
    }
  }

  async function uninstallPlugin(pluginId: string, pluginName: string) {
    const system = plugin.WeavePluginSystem;
    if (!system) return;

    const confirmed = await showObsidianConfirm(
      plugin.app,
      `确定要卸载插件「${pluginName}」吗？\n\n此操作将删除该插件的文件夹及所有内容，不可恢复。`,
      { title: '卸载插件', confirmText: '卸载', cancelText: '取消' }
    );
    if (!confirmed) return;

    try {
      await system.uninstallPlugin(pluginId);
      new Notice(`插件「${pluginName}」已卸载`);
      await refreshPlugins();
    } catch (err) {
      logger.error(`[PluginSystemSection] Failed to uninstall plugin ${pluginId}:`, err);
      new Notice(`卸载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function openPluginsFolder() {
    try {
      const app = plugin.app as any;
      const adapter = app.vault.adapter;
      if (typeof adapter.getBasePath === 'function') {
        const basePath = adapter.getBasePath();
        const paths = getV2PathsFromApp(app);
        const fullPath = `${basePath}/${paths.root}/plugins`;
        
        if (typeof (window as any).require !== 'undefined') {
          const { shell } = (window as any).require('electron');
          shell?.openPath?.(fullPath);
        }
      }
    } catch (err) {
      logger.error('[PluginSystemSection] Failed to open plugins folder:', err);
    }
  }

  function getStateLabel(state: string): string {
    switch (state) {
      case 'enabled': return t('pluginSystem.state.enabled') || '已启用';
      case 'disabled': return t('pluginSystem.state.disabled') || '已禁用';
      case 'error': return t('pluginSystem.state.error') || '错误';
      case 'loading': return t('pluginSystem.state.loading') || '加载中';
      default: return state;
    }
  }

  function getStateClass(state: string): string {
    switch (state) {
      case 'enabled': return 'state-enabled';
      case 'disabled': return 'state-disabled';
      case 'error': return 'state-error';
      case 'loading': return 'state-loading';
      default: return '';
    }
  }

  onMount(() => {
    refreshPlugins();
  });
</script>

<div class="plugin-system-section">
  <div class="section-header">
    <div class="section-title-row">
      <h2 class="section-title">{t('pluginSystem.title') || '插件管理'}</h2>
      <div class="section-actions">
        <button class="action-btn" onclick={refreshPlugins} title={t('pluginSystem.refresh') || '刷新'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
        <button class="action-btn" onclick={openPluginsFolder} title={t('pluginSystem.openFolder') || '打开插件目录'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>
    </div>
    <p class="section-desc">{t('pluginSystem.description') || '管理已安装的 Weave 插件。将插件放入 weave/plugins/ 目录即可安装。'}</p>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <span class="loading-spinner"></span>
      <span>{t('pluginSystem.loading') || '正在加载插件列表...'}</span>
    </div>
  {:else if errorMessage}
    <div class="error-state">
      <p>{errorMessage}</p>
    </div>
  {:else if plugins.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>
      </div>
      <p class="empty-title">{t('pluginSystem.empty.title') || '暂无已安装插件'}</p>
      <p class="empty-hint">{t('pluginSystem.empty.hint') || '将插件文件夹放入 weave/plugins/ 目录后重新加载即可。'}</p>
      <div class="empty-structure">
        <code>
weave/plugins/<br/>
&nbsp;&nbsp;my-plugin/<br/>
&nbsp;&nbsp;&nbsp;&nbsp;manifest.json<br/>
&nbsp;&nbsp;&nbsp;&nbsp;main.js
        </code>
      </div>
    </div>
  {:else}
    <div class="plugin-list">
      {#each plugins as entry (entry.manifest.id)}
        <div class="plugin-card" class:plugin-error={entry.state === 'error'}>
          <div class="plugin-info">
            <div class="plugin-name-row">
              <span class="plugin-name">{entry.manifest.name}</span>
              <span class="plugin-version">v{entry.manifest.version}</span>
              <span class="plugin-state {getStateClass(entry.state)}">{getStateLabel(entry.state)}</span>
            </div>
            {#if entry.manifest.author}
              <span class="plugin-author">{entry.manifest.author}</span>
            {/if}
            {#if entry.manifest.description}
              <p class="plugin-desc">{entry.manifest.description}</p>
            {/if}
            {#if entry.error}
              <p class="plugin-error-msg">{entry.error}</p>
            {/if}
          </div>
          <div class="plugin-actions">
            <button class="uninstall-btn" title="卸载" onclick={() => uninstallPlugin(entry.manifest.id, entry.manifest.name)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            {#if hasSettings(entry.manifest.id) && entry.state === 'enabled'}
              <button class="settings-btn" title="配置" onclick={() => openPluginSettings(entry.manifest.id)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
            {/if}
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={entry.state === 'enabled'}
                onchange={() => togglePlugin(entry.manifest.id, entry.state)}
              />
              <span class="toggle-slider"></span>
            </label>
            {#if entry.state === 'error'}
              <button class="reload-btn" onclick={() => reloadPlugin(entry.manifest.id)}>
                {t('pluginSystem.reload') || '重新加载'}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- 插件配置模态窗 -->
<AutoRulesConfigModal
  bind:open={showAutoRulesConfig}
  onClose={() => { showAutoRulesConfig = false; }}
  plugin={plugin}
/>

<style>
  .plugin-system-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    margin: 0;
    font-size: var(--weave-font-size-md, 1rem);
    font-weight: 600;
    color: var(--text-normal);
  }

  .section-actions {
    display: flex;
    gap: 0.375rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: var(--radius-s, 0.375rem);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--background-modifier-active-hover, var(--background-modifier-hover));
    color: var(--text-normal);
  }

  .section-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* Loading */
  .loading-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem;
    justify-content: center;
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--background-modifier-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Error */
  .error-state {
    padding: 1rem;
    border-radius: var(--radius-m, 0.5rem);
    background: rgba(239, 68, 68, 0.08);
    color: var(--text-error, #ef4444);
    font-size: 0.875rem;
  }

  /* Empty */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2.5rem 1rem;
    text-align: center;
    pointer-events: none;
  }

  .empty-icon {
    color: var(--text-faint);
    opacity: 0.5;
  }

  .empty-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .empty-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-faint);
    max-width: 280px;
  }

  .empty-structure {
    margin-top: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-s, 0.375rem);
    background: var(--background-secondary);
    text-align: left;
  }

  .empty-structure code {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-monospace);
    line-height: 1.6;
  }

  /* Plugin List */
  .plugin-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .plugin-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
    border-radius: var(--radius-m, 0.5rem);
    background: var(--background-secondary);
    transition: background 0.15s ease;
  }

  .plugin-card:hover {
    background: var(--background-secondary-alt, var(--background-secondary));
  }

  .plugin-card.plugin-error {
    border-left: 3px solid var(--text-error, #ef4444);
  }

  .plugin-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .plugin-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .plugin-name {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .plugin-version {
    font-size: 0.75rem;
    color: var(--text-faint);
    font-family: var(--font-monospace);
  }

  .plugin-state {
    font-size: 0.6875rem;
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
    font-weight: 500;
  }

  .state-enabled {
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
  }

  .state-disabled {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  .state-error {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
  }

  .state-loading {
    background: rgba(234, 179, 8, 0.12);
    color: #eab308;
  }

  .plugin-author {
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .plugin-desc {
    margin: 0.125rem 0 0 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .plugin-error-msg {
    margin: 0.25rem 0 0 0;
    font-size: 0.75rem;
    color: var(--text-error, #ef4444);
    line-height: 1.4;
  }

  .plugin-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    padding-top: 0.125rem;
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 2.5rem;
    height: 1.375rem;
    cursor: pointer;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 1rem;
    background: var(--background-modifier-border);
    transition: background 0.2s ease;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 1rem;
    height: 1rem;
    left: 0.1875rem;
    bottom: 0.1875rem;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s ease;
  }

  .toggle-switch input:checked + .toggle-slider {
    background: var(--color-accent);
  }

  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(1.125rem);
  }

  .reload-btn {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.375rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reload-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .uninstall-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: var(--radius-s, 0.375rem);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .uninstall-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: var(--radius-s, 0.375rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .settings-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
</style>
