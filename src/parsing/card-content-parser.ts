import { parseChoiceQuestion, type ChoiceQuestion } from './choice-question-parser';

export type ParsedCardContent =
  | { kind: 'choice'; choice: ChoiceQuestion }
  | { kind: 'markdown'; markdown: string };

export function parseCardContent(content: string): ParsedCardContent {
  const choice = parseChoiceQuestion(content);
  if (choice) {
    return { kind: 'choice', choice };
  }

  return { kind: 'markdown', markdown: content ?? '' };
}
