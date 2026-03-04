<script lang="ts">
  import ObsidianRenderer from '../atoms/ObsidianRenderer.svelte';
  import ChoiceQuestionPreview from '../preview/ChoiceQuestionPreview.svelte';
  import ChoiceOptionRenderer from '../atoms/ChoiceOptionRenderer.svelte';

  import type { WeavePlugin } from '../../main';
  import type { Card } from '../../data/types';

  import { parseCardContent } from '../../parsing/card-content-parser';

  interface Props {
    content: string;
    plugin: WeavePlugin;
    sourcePath?: string;
    section?: 'full' | 'stem' | 'options' | 'explanation';
    showAnswer?: boolean;
    selectedOptions?: string[];
    onOptionSelect?: (label: string) => void;
    onShowAnswer?: () => void;
    enableAnimations?: boolean;
    card?: Card;
    onAddToErrorBook?: () => void;
    onRemoveFromErrorBook?: () => void;
    currentResponseTime?: number;
    userAnswer?: string | string[] | null;
    hasSubmitted?: boolean;
    onSingleSelect?: (label: string) => void;
    onMultipleToggle?: (label: string) => void;
  }

  let {
    content,
    plugin,
    sourcePath = '',
    section = 'full',
    showAnswer = false,
    selectedOptions = $bindable([]),
    onOptionSelect,
    onShowAnswer,
    enableAnimations = true,
    card,
    onAddToErrorBook,
    onRemoveFromErrorBook,
    currentResponseTime,
    userAnswer = null,
    hasSubmitted = false,
    onSingleSelect,
    onMultipleToggle
  }: Props = $props();

  const parsed = $derived(parseCardContent(content));
</script>

{#if parsed.kind === 'choice'}
  {#if section === 'stem'}
    <ObsidianRenderer
      {plugin}
      content={parsed.choice.question}
      sourcePath={sourcePath}
      enableClozeProcessing={true}
      showClozeAnswers={showAnswer}
    />
  {:else if section === 'explanation'}
    {#if parsed.choice.explanation}
      <ObsidianRenderer
        {plugin}
        content={parsed.choice.explanation}
        sourcePath={sourcePath}
        enableClozeProcessing={true}
        showClozeAnswers={showAnswer}
      />
    {/if}
  {:else if section === 'options'}
    {@const hasAnswerKey = Array.isArray(parsed.choice.correctAnswers) && parsed.choice.correctAnswers.length > 0}
    {#each parsed.choice.options as option}
      {@const isMultiple = parsed.choice.isMultipleChoice}
      {@const isSelected = isMultiple
        ? Array.isArray(userAnswer) && userAnswer.includes(option.label)
        : userAnswer === option.label}
      {@const isCorrectOption = hasAnswerKey ? option.isCorrect : false}
      {@const showAsCorrect = hasAnswerKey && !!hasSubmitted && isCorrectOption && isSelected}
      {@const showAsWrong = hasAnswerKey && !!hasSubmitted && (
        (isCorrectOption && !isSelected) ||
        (!isCorrectOption && isSelected)
      )}
      {@const badgeText = hasAnswerKey && hasSubmitted
        ? (isCorrectOption && isSelected ? '你选对了'
          : !isCorrectOption && isSelected ? '你选错了'
          : isCorrectOption && !isSelected ? '漏选'
          : '')
        : ''}
      {@const badgeIcon = hasAnswerKey && hasSubmitted
        ? (isCorrectOption && isSelected ? 'check'
          : !isCorrectOption && isSelected ? 'x'
          : isCorrectOption && !isSelected ? 'alert-circle'
          : '')
        : ''}

      <ChoiceOptionRenderer
        {option}
        isSelected={isSelected}
        isCorrect={showAsCorrect}
        isWrong={showAsWrong}
        disabled={!!hasSubmitted}
        badgeText={badgeText}
        badgeIcon={badgeIcon}
        {plugin}
        {sourcePath}
        onclick={() => isMultiple
          ? onMultipleToggle?.(option.label)
          : onSingleSelect?.(option.label)}
      />
    {/each}
  {:else}
    <ChoiceQuestionPreview
      question={parsed.choice}
      {plugin}
      {showAnswer}
      {selectedOptions}
      {onOptionSelect}
      {onShowAnswer}
      {enableAnimations}
      {card}
      {onAddToErrorBook}
      {onRemoveFromErrorBook}
      {currentResponseTime}
    />
  {/if}
{:else}
  <ObsidianRenderer
    {plugin}
    content={parsed.markdown}
    sourcePath={sourcePath}
    enableClozeProcessing={true}
    showClozeAnswers={showAnswer}
  />
{/if}
