<script lang="ts">
  import { truncateText } from "../../utils/table-utils";
  import type { BasicCellProps } from "../../types/table-types";

  let { content, title = content, columnKey }: BasicCellProps = $props();

  const displayContent = $derived(truncateText(content));
</script>

<td class="weave-content-column weave-{columnKey}-column">
  <div class="weave-cell-content">
    <span class="weave-text-content" {title}>
      {displayContent}
    </span>
  </div>
</td>

<style>
  @import '../../styles/cell-common.css';

  .weave-content-column {
    width: 25%;
    min-width: 200px;
    max-width: 300px;
  }
</style>


