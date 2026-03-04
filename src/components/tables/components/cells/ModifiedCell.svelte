<!--
  修改时间单元格组件
  显示卡片的最后修改时间
-->
<script lang="ts">
  import type { Card } from '../../../../data/types';
  import { getCardModifiedTime } from '../../../../utils/card-review-data-utils';

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const modifiedTime = $derived(getCardModifiedTime(card));

  //  修复：$derived 直接返回值，不是返回函数
  const formattedTime = $derived.by(() => {
    const now = new Date();
    const diff = now.getTime() - modifiedTime.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    if (days < 365) return `${Math.floor(days / 30)}月前`;
    return `${Math.floor(days / 365)}年前`;
  });
</script>

<td class="modified-cell" title={modifiedTime.toLocaleString()}>
  <span class="modified-text">{formattedTime}</span>
</td>

<style>
  .modified-cell {
    padding: 10px 16px;
    border-right: 1px solid var(--background-modifier-border);
    vertical-align: middle;
  }

  .modified-text {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>

