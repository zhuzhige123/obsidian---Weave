<!--
  FSRS复习数据单元格组件
  用于显示复习历史模式中的FSRS相关数据
-->
<script lang="ts">
  import type { Card } from '../../../../data/types';
  import type { ColumnKey } from '../../types/table-types';
  import { 
    formatNextReview, 
    getNextReviewColor,
    getRetentionColor,
    formatInterval,
    getDifficultyColor 
  } from '../../../../utils/fsrs-display-utils';
  import { deriveReviewData } from '../../../../utils/card-review-data-utils';

  interface Props {
    card: Card;
    column: ColumnKey;
  }

  let { card, column }: Props = $props();

  const reviewData = $derived(deriveReviewData(card));

  const cellContent = $derived.by(() => {
    switch (column) {
      case 'next_review':
        return {
          text: formatNextReview(reviewData.nextReview),
          color: getNextReviewColor(reviewData.nextReview),
        };
      case 'retention':
        return {
          text: `${Math.round(reviewData.retention * 100)}%`,
          color: getRetentionColor(reviewData.retention),
        };
      case 'interval':
        return {
          text: formatInterval(reviewData.interval),
          color: 'var(--text-muted)',
        };
      case 'difficulty':
        return {
          text: reviewData.difficulty.toFixed(1),
          color: getDifficultyColor(reviewData.difficulty),
        };
      case 'review_count':
        return {
          text: `${reviewData.reviewCount}次`,
          color: 'var(--text-normal)',
        };
      default:
        return { text: '-', color: 'var(--text-muted)' };
    }
  });
</script>

<td class="review-data-cell">
  <span style="color: {cellContent.color}; font-size: 13px;">
    {cellContent.text}
  </span>
</td>

<style>
  .review-data-cell {
    padding: 10px 16px;
    font-variant-numeric: tabular-nums;
    border-right: 1px solid var(--background-modifier-border);
    vertical-align: middle;
  }
</style>

