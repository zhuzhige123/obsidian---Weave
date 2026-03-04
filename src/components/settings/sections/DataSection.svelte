<!--
  数据管理界面 - 已清理，等待重构
  此文件将被完全重写为新的数据管理界面
-->
<script lang="ts">
  //  导入国际化
  import { tr } from '../../../utils/i18n';
  
  interface Props {
    plugin: any;
    onSave: () => Promise<void>;
  }

  let { plugin, onSave }: Props = $props();
  
  //  响应式翻译函数
  let t = $derived($tr);
</script>

<!-- 临时占位内容，表示此组件已被清理 -->
<div class="data-management-placeholder">
  <h3>{t('settings.dataManagement.title')}</h3>
  <p>{t('settings.dataManagement.underReconstruction')}</p>
</div>

<style>
  .data-management-placeholder {
    padding: 2rem;
    text-align: center;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    color: var(--text-muted);
  }

  .data-management-placeholder h3 {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
  }

  .data-management-placeholder p {
    margin: 0;
    font-style: italic;
  }
</style>
