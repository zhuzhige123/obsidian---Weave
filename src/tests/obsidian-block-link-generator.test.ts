import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TFile } from 'obsidian';
import { BlockLinkManager } from '../utils/block-link-manager';

describe('BlockLinkManager', () => {
  let blockLinkManager: BlockLinkManager;
  let mockApp: any;
  let mockFile: TFile;

  beforeEach(() => {
    mockFile = new TFile('notes/test.md');

    mockApp = {
      vault: {
        getAbstractFileByPath: vi.fn(),
        getMarkdownFiles: vi.fn(() => [mockFile]),
        read: vi.fn(),
        modify: vi.fn()
      },
      workspace: {
        getActiveFile: vi.fn(() => mockFile)
      }
    };

    blockLinkManager = new BlockLinkManager(mockApp);
  });

  test('should create a block link for matching selection content', async () => {
    mockApp.vault.read.mockResolvedValue('Question line\nAnswer line');
    mockApp.vault.modify.mockResolvedValue(undefined);

    const result = await blockLinkManager.createBlockLinkForSelection('Question line', 'notes/test.md');

    expect(result.success).toBe(true);
    expect(result.blockLinkInfo).toBeDefined();
    expect(result.blockLinkInfo?.blockLink).toMatch(/^\[\[test#\^[a-z0-9-]+\]\]$/i);
    expect(result.blockLinkInfo?.lineNumber).toBe(1);
    expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
  });

  test('should reuse existing block id when target line already has one', async () => {
    mockApp.vault.read.mockResolvedValue('Question line ^abc123\nAnswer line');

    const result = await blockLinkManager.createBlockLinkForSelection('Question line', 'notes/test.md');

    expect(result.success).toBe(true);
    expect(result.blockLinkInfo?.blockId).toBe('abc123');
    expect(result.blockLinkInfo?.blockLink).toBe('[[test#^abc123]]');
    expect(mockApp.vault.modify).not.toHaveBeenCalled();
  });

  test('should return failure when source file does not exist', async () => {
    mockApp.workspace.getActiveFile.mockReturnValue(null);
    mockApp.vault.getMarkdownFiles.mockReturnValue([]);

    const result = await blockLinkManager.createBlockLinkForSelection('Question line', 'missing.md');

    expect(result.success).toBe(false);
    expect(result.error).toContain('没有找到活动的源文件');
  });

  test('should fall back to document link when no matching line is found', async () => {
    mockApp.vault.read.mockResolvedValue('Unrelated line\nAnother line');

    const result = await blockLinkManager.createBlockLinkForSelection('Question line', 'notes/test.md');

    expect(result.success).toBe(true);
    expect(result.blockLinkInfo?.blockLink).toBe('[[test]]');
    expect(result.blockLinkInfo?.lineNumber).toBeUndefined();
    expect(mockApp.vault.modify).not.toHaveBeenCalled();
  });

  test('should support precise file lookup for IR selections', async () => {
    mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockApp.vault.read.mockResolvedValue('Intro\nSelected content\nTail');
    mockApp.vault.modify.mockResolvedValue(undefined);

    const result = await blockLinkManager.createBlockLinkForIRSelection(
      'Selected content',
      'notes/test.md',
      2,
      2
    );

    expect(result.success).toBe(true);
    expect(result.blockLinkInfo?.lineNumber).toBe(2);
    expect(result.blockLinkInfo?.sourceFile).toBe('notes/test.md');
  });

  test('should return failure when reading source file fails', async () => {
    mockApp.vault.read.mockRejectedValue(new Error('读取失败'));

    const result = await blockLinkManager.createBlockLinkForSelection('Question line', 'notes/test.md');

    expect(result.success).toBe(false);
    expect(result.error).toContain('无法在源文档中创建块链接');
  });
});
