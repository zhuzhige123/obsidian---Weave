<script lang="ts">
  import EnhancedIcon from "../../../ui/EnhancedIcon.svelte";
  import { ICON_NAMES } from "../../../../icons/index.js";
  import { truncateText } from "../../utils/table-utils";
  import type { LinkCellProps } from "../../types/table-types";

  let { card, plugin }: LinkCellProps = $props();

  //  性能优化：缓存计算结果，避免每次渲染时重复计算
  const blockRef = $derived(card.sourceBlock || (card as any).obsidian_block_link);

  //  已移除：块引用列不再提供点击跳转功能
  // 跳转功能已转移到"来源文档"列，该列支持：
  // 1. 打开源文档
  // 2. 如果存在块引用，自动定位并高亮显示
</script>

<td class="weave-link-column">
  <div class="weave-cell-content">
    {#if blockRef}
      <!--  修改：移除点击功能，只显示块引用文本 -->
      <span class="weave-block-ref-display" title="块引用: {blockRef}">
        <EnhancedIcon name={ICON_NAMES.LINK} size={14} />
        <span class="weave-link-text">{truncateText(blockRef, 20)}</span>
      </span>
    {:else}
      <span class="weave-no-link" title="无块引用">
        <EnhancedIcon name={ICON_NAMES.LINK} size={14} />
        <span class="weave-text-muted">-</span>
      </span>
    {/if}
  </div>
</td>

<style>
  @import '../../styles/cell-common.css';

  .weave-link-column {
    width: 150px;
    text-align: left;
  }

  .weave-block-ref-display {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    max-width: 100%;
  }

  .weave-link-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weave-no-link {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>


