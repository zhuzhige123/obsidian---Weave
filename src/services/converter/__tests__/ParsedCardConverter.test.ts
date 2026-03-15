import { describe, expect, it } from 'vitest';
import { ParsedCardConverter } from '../ParsedCardConverter';

describe('ParsedCardConverter', () => {
  it('批量解析导入的卡片应把 tags 写入 content YAML', () => {
    const converter = new ParsedCardConverter(
      {} as any,
      {
        createCard() {
          return {
            state: 0,
            due: '2026-03-15T00:00:00.000Z',
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            lastReview: undefined
          };
        }
      } as any
    );

    const result = converter.convertToCard(
      {
        type: 'basic' as any,
        front: '正面',
        back: '背面',
        tags: ['标签组1', '内科'],
        metadata: {
          uuid: 'tk-testuuid001'
        }
      },
      {
        deckId: 'deck-1',
        deckName: '批量解析'
      }
    );

    expect(result.success).toBe(true);
    expect(result.card?.content).toContain('we_decks:');
    expect(result.card?.content).toContain('tags:');
    expect(result.card?.content).toContain('- 标签组1');
    expect(result.card?.content).toContain('- 内科');
  });
});
