import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => {
  class TFile {
    path: string;

    constructor(path = '') {
      this.path = path;
    }
  }

  return {
    TFile,
    Notice: class Notice {},
    Vault: class Vault {},
    App: class App {}
  };
});

import { TFile } from 'obsidian';
import { BlockLinkCleanupService } from '../BlockLinkCleanupService';

describe('BlockLinkCleanupService', () => {
  let currentContent: string;
  let file: TFile;
  let vault: {
    getAbstractFileByPath: (path: string) => TFile;
    read: (file: TFile) => Promise<string>;
    modify: (file: TFile, nextContent: string) => Promise<void>;
  };

  beforeEach(() => {
    currentContent = '';
    file = new TFile();
    file.path = 'mixed.md';
    vault = {
      getAbstractFileByPath: vi.fn(() => file),
      read: vi.fn(async () => currentContent),
      modify: vi.fn(async (_file, nextContent: string) => {
        currentContent = nextContent;
      })
    };
  });

  it('only removes the matching quick-create block link', async () => {
    currentContent = [
      '---',
      'weave-uuid: tk-batchsingle1a2',
      '---',
      'alpha ^keep111',
      'quick-created source ^we-target1',
      '<->',
      'front',
      'back',
      '<!-- tk-abc123def456 --> ^multi222',
      '<->'
    ].join('\n');

    const service = BlockLinkCleanupService.getInstance();
    service.initialize({
      dataStorage: {} as any,
      vault: vault as any,
      app: { vault } as any
    });

    const result = await service.cleanupAfterCardDeletion({
      uuid: 'tk-quickcard01',
      sourceFile: 'mixed.md',
      sourceBlock: '^we-target1',
      isBatchScanned: false,
      content: '',
      tags: []
    } as any);

    expect(result.success).toBe(true);
    expect(currentContent).not.toContain('^we-target1');
    expect(currentContent).toContain('weave-uuid: tk-batchsingle1a2');
    expect(currentContent).toContain('^keep111');
    expect(currentContent).toContain('^multi222');
    expect(currentContent).not.toContain('#we_已删除');
  });

  it('removes frontmatter uuid and adds deletion tag for single-file batch cards', async () => {
    currentContent = [
      '---',
      'weave-uuid: tk-abc123def456',
      'tags:',
      '  - 生物',
      '---',
      '',
      '什么是突触可塑性？',
      '---div---',
      '突触连接强度可随活动发生变化。'
    ].join('\n');

    const service = BlockLinkCleanupService.getInstance();
    service.initialize({
      dataStorage: {} as any,
      vault: vault as any,
      app: { vault } as any
    });

    const result = await service.cleanupAfterCardDeletion({
      uuid: 'tk-abc123def456',
      sourceFile: 'mixed.md',
      isBatchScanned: true,
      content: '',
      tags: ['生物']
    } as any);

    expect(result.success).toBe(true);
    expect(currentContent).not.toContain('weave-uuid:');
    expect(currentContent).toContain('- 生物');
    expect(currentContent).toContain('- we_已删除');
  });

  it('marks only the target batch multi block as deleted', async () => {
    currentContent = [
      '<->',
      '什么是工作记忆？',
      '---div---',
      '工作记忆是对信息进行短时保持与加工的系统。',
      '<!-- tk-abc123def456 --> ^we-multi123',
      '<->',
      '',
      '<->',
      '什么是长时记忆？',
      '---div---',
      '长时记忆用于长期存储信息。',
      '<!-- tk-ccc333ddd444 --> ^we-keep456',
      '<->'
    ].join('\n');

    const service = BlockLinkCleanupService.getInstance();
    service.initialize({
      dataStorage: {} as any,
      vault: vault as any,
      app: { vault } as any
    });

    const result = await service.cleanupAfterCardDeletion({
      uuid: 'tk-abc123def456',
      sourceFile: 'mixed.md',
      sourceBlock: '^we-multi123',
      isBatchScanned: true,
      content: '',
      tags: []
    } as any);

    expect(result.success).toBe(true);
    expect(currentContent).toContain('#we_已删除');
    expect(currentContent).not.toContain('<!-- tk-abc123def456 --> ^we-multi123');
    expect(currentContent).toContain('<!-- tk-ccc333ddd444 --> ^we-keep456');
  });
});
