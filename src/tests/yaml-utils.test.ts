import { describe, expect, test } from 'vitest';
import { createContentWithMetadata, parseSourceInfo, setCardProperty } from '../utils/yaml-utils';

describe('yaml-utils wikilink quoting', () => {
  test('should quote we_source wikilink in YAML output', () => {
    const content = createContentWithMetadata(
      {
        we_source: '[[《浅谈基于 Lifelong Continuous Incremental Learning 的推荐算法》]]',
        we_type: 'basic'
      },
      '正文内容'
    );

    expect(content).toContain('we_source: "[[《浅谈基于 Lifelong Continuous Incremental Learning 的推荐算法》]]"');
    expect(content).toContain('we_type: basic');
  });

  test('should still parse quoted we_source wikilink correctly', () => {
    const content = createContentWithMetadata(
      {
        we_source: '![[notes/test-note#^block123]]',
        we_type: 'basic'
      },
      '正文内容'
    );

    const sourceInfo = parseSourceInfo(content);

    expect(sourceInfo.sourceFile).toBe('notes/test-note.md');
    expect(sourceInfo.sourceBlock).toBe('block123');
  });

  test('should quote wikilink when updating existing card property', () => {
    const updated = setCardProperty('正文内容', 'we_source', '[[test-note]]');

    expect(updated).toContain('we_source: "[[test-note]]"');
    expect(parseSourceInfo(updated).sourceFile).toBe('test-note.md');
  });
});