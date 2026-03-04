import { logger } from '../../utils/logger';
/**
 * Obsidian → Anki 内容转换器
 * 负责将 Obsidian Markdown 格式转换为 Anki HTML 格式
 */

import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import type { Card } from '../../data/types';
import type { AnkiConnectClient } from './AnkiConnectClient';
import type {
  ConversionResult,
  MediaFileInfo,
  BacklinkInfo,
  ObsidianToAnkiOptions,
  FormatConversionOptions,
  ConversionContext
} from '../../types/ankiconnect-types';
import { ContentFormatConverter } from './ContentFormatConverter';
import { MathFormulaLayer } from './layers/MathFormulaLayer';
import { WikiLinkLayer } from './layers/WikiLinkLayer';
import { CalloutLayer } from './layers/CalloutLayer';
import { HighlightLayer } from './layers/HighlightLayer';
import { MarkdownLayer } from './layers/MarkdownLayer';
import { parseSourceInfo } from '../../utils/yaml-utils';

/**
 * Obsidian → Anki 转换器
 */
export class ObsidianToAnkiConverter {
  private readonly IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
  private readonly AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
  private readonly VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv'];
  
  private formatConverter: ContentFormatConverter;

  constructor(
    private app: App,
    private ankiConnect: AnkiConnectClient
  ) {
    // 初始化格式转换器
    this.formatConverter = new ContentFormatConverter();
    
    // 注册转换层（按优先级顺序）
    this.formatConverter.registerLayer(new MathFormulaLayer());      // P0: 优先级100
    this.formatConverter.registerLayer(new WikiLinkLayer());         // P1: 优先级80
    this.formatConverter.registerLayer(new CalloutLayer());          // P1: 优先级70
    this.formatConverter.registerLayer(new HighlightLayer());        // P1: 优先级60
    this.formatConverter.registerLayer(new MarkdownLayer());         // P2: 优先级50 - 基础 Markdown 转换
  }

  /**
   * 转换卡片内容
   */
  async convertContent(
    content: string,
    card: Card,
    options: ObsidianToAnkiOptions
  ): Promise<ConversionResult> {
    logger.debug('[ObsidianToAnkiConverter] 开始转换内容');

    const result: ConversionResult = {
      convertedContent: content,
      mediaFiles: [],
      backlinks: [],
      warnings: []
    };

    // 🆕 0. 提取并转换媒体文件（必须在格式转换之前）
    const mediaRefs = this.extractMediaReferences(content);
    logger.debug(`[ObsidianToAnkiConverter] 提取到 ${mediaRefs.length} 个媒体引用`);

    for (const ref of mediaRefs) {
      const mediaInfo = await this.processMediaReference(ref, card.sourceFile || '');
      result.mediaFiles.push(mediaInfo);

      //  修复：网络URL或本地文件都应该转换
      const shouldConvert = mediaInfo.fileExists || this.isNetworkUrl(ref.path);
      
      if (shouldConvert) {
        //  调试日志
        logger.debug(`[ObsidianToAnkiConverter] 替换媒体引用:`, {
          原始: ref.fullMatch.substring(0, 80),
          转换: mediaInfo.ankiFormat.substring(0, 80),
          文件名: mediaInfo.filename,
          类型: mediaInfo.fileExists ? '本地文件' : '网络URL'
        });
        
        // 替换原始引用为 Anki 格式（使用全局替换）
        const beforeReplace = result.convertedContent;
        result.convertedContent = result.convertedContent.replace(
          ref.fullMatch,
          mediaInfo.ankiFormat
        );
        
        //  验证替换是否成功
        if (beforeReplace === result.convertedContent) {
          logger.warn(`[ObsidianToAnkiConverter] ⚠️ 替换失败！未找到匹配项:`, ref.fullMatch.substring(0, 100));
        } else {
          logger.debug(`[ObsidianToAnkiConverter] ✅ 替换成功`);
        }
      } else {
        result.warnings.push(`媒体文件不存在: ${mediaInfo.filename}`);
      }
    }

    // 1. 执行格式转换（公式、双链、Callouts、Markdown等）
    if (options.formatConversion?.enabled) {
      try {
        const formatContext: ConversionContext = {
          vaultName: options.vaultName,
          sourceFile: card.sourceFile,
          options: options.formatConversion
        };
        
        const formatResult = this.formatConverter.convert(result.convertedContent, formatContext);
        result.convertedContent = formatResult.content;
        result.warnings.push(...formatResult.warnings);
        
        logger.debug('[ObsidianToAnkiConverter] 格式转换完成:', {
          应用层: formatResult.appliedLayers.join(', '),
          警告数: formatResult.warnings.length
        });
      } catch (error) {
        logger.error('[ObsidianToAnkiConverter] 格式转换失败:', error);
        result.warnings.push(`格式转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    // 2. 上传媒体文件到 Anki
    if (options.uploadMedia) {
      await this.uploadMediaFiles(result.mediaFiles);
    }

    // 3. 生成回链
    if (options.generateBacklinks) {
      const backlinks = this.generateBacklinks(card, options.vaultName);
      result.backlinks = backlinks;

      // 根据配置添加回链
      if (options.backlinkPosition === 'append' && backlinks.length > 0) {
        const backlinkHtml = backlinks.map(bl => bl.html).join('\n');
        result.convertedContent += `\n\n${backlinkHtml}`;
      }
    }

    logger.debug('[ObsidianToAnkiConverter] 转换完成:', {
      媒体文件: result.mediaFiles.length,
      回链: result.backlinks.length,
      警告: result.warnings.length
    });

    return result;
  }

  /**
   * 提取媒体引用
   */
  private extractMediaReferences(content: string): MediaReference[] {
    const references: MediaReference[] = [];

    // Obsidian 嵌入: ![[file]]
    //  修复：使用非贪婪匹配 + 正向预查，正确处理路径中的方括号
    const obsidianEmbeds = content.matchAll(/!\[\[((?:(?!\]\]).)+)\]\]/g);
    for (const match of obsidianEmbeds) {
      references.push({
        type: 'obsidian',
        path: match[1],
        fullMatch: match[0]
      });
    }

    // Markdown 图片/音频: ![alt](path)
    const mdImages = content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
    for (const match of mdImages) {
      references.push({
        type: 'markdown',
        alt: match[1],
        path: match[2],
        fullMatch: match[0]
      });
    }

    return references;
  }

  /**
   * 处理单个媒体引用
   */
  private async processMediaReference(
    ref: MediaReference,
    contextPath: string
  ): Promise<MediaFileInfo> {
    //  检查是否是网络URL
    const isUrl = this.isNetworkUrl(ref.path);
    
    let filename: string;
    let resolvedPath: string;
    let fileExists: boolean;
    
    if (isUrl) {
      // 网络URL：直接使用URL作为文件名
      filename = ref.path;
      resolvedPath = ref.path;
      fileExists = false; // 网络文件不在vault中
    } else {
      // 本地文件：解析路径
      resolvedPath = this.resolveFilePath(ref.path, contextPath);
      filename = this.extractFilename(ref.path);
      const file = this.app.vault.getAbstractFileByPath(resolvedPath);
      fileExists = file instanceof TFile;
    }

    const extension = this.getFileExtension(filename).toLowerCase();
    const mediaType = this.getMediaType(extension);

    // 生成 Anki 格式
    const ankiFormat = this.convertToAnkiFormat(
      isUrl ? ref.path : filename,  // 网络URL使用完整URL
      mediaType,
      ref.alt || ''
    );

    return {
      type: mediaType,
      originalRef: ref.fullMatch,
      filename,
      vaultPath: resolvedPath,
      ankiFormat,
      fileExists
    };
  }

  /**
   * 转换为 Anki 格式
   */
  private convertToAnkiFormat(
    filename: string,
    type: 'image' | 'audio' | 'video',
    alt: string
  ): string {
    switch (type) {
      case 'image':
        return alt
          ? `<img src="${filename}" alt="${alt}">`
          : `<img src="${filename}">`;

      case 'audio':
        // Anki 音频格式
        return `[sound:${filename}]`;

      case 'video':
        // Anki 推荐使用 [sound:] 格式处理视频
        return `[sound:${filename}]`;

      default:
        return `<img src="${filename}">`;
    }
  }

  /**
   * 上传媒体文件到 Anki
   */
  private async uploadMediaFiles(mediaFiles: MediaFileInfo[]): Promise<void> {
    logger.debug(`[ObsidianToAnkiConverter] 开始上传 ${mediaFiles.length} 个媒体文件`);

    for (const media of mediaFiles) {
      if (!media.fileExists) {
        logger.warn(`[ObsidianToAnkiConverter] 跳过不存在的文件: ${media.filename}`);
        media.uploaded = false;
        continue;
      }

      try {
        const file = this.app.vault.getAbstractFileByPath(media.vaultPath);
        if (!(file instanceof TFile)) {
          media.uploaded = false;
          continue;
        }

        // 读取文件
        const arrayBuffer = await this.app.vault.readBinary(file);
        const base64Data = this.arrayBufferToBase64(arrayBuffer);

        // 上传到 Anki
        await this.ankiConnect.storeMediaFile(media.filename, base64Data);

        media.uploaded = true;
        logger.debug(`[ObsidianToAnkiConverter] ✅ 上传成功: ${media.filename}`);
      } catch (error) {
        logger.error(`[ObsidianToAnkiConverter] ❌ 上传失败: ${media.filename}`, error);
        media.uploaded = false;
      }
    }

    const successCount = mediaFiles.filter(m => m.uploaded).length;
    logger.debug(`[ObsidianToAnkiConverter] 上传完成: ${successCount}/${mediaFiles.length}`);
  }

  /**
   * 生成回链
   *  v2.2: 从 content YAML 解析源信息，带回退机制
   */
  private generateBacklinks(card: Card, vaultName: string): BacklinkInfo[] {
    const backlinks: BacklinkInfo[] = [];
    
    //  v2.2: 从 content YAML 解析源信息，带回退机制
    const sourceInfo = parseSourceInfo(card.content);
    const sourceFile = sourceInfo.sourceFile || card.sourceFile;
    const sourceBlock = sourceInfo.sourceBlock || card.sourceBlock;

    // 源文档回链
    if (sourceFile) {
      const sourceLink = this.generateSourceFileBacklink(
        sourceFile,
        vaultName
      );
      if (sourceLink) {
        backlinks.push(sourceLink);
      }
    }

    // 块回链
    if (sourceFile && sourceBlock) {
      const blockLink = this.generateBlockBacklink(
        sourceFile,
        sourceBlock,
        vaultName
      );
      if (blockLink) {
        backlinks.push(blockLink);
      }
    }

    return backlinks;
  }

  /**
   * 生成源文档回链
   */
  private generateSourceFileBacklink(
    sourceFile: string,
    vaultName: string
  ): BacklinkInfo | null {
    const encodedVault = encodeURIComponent(vaultName);
    const encodedFile = encodeURIComponent(sourceFile);
    const url = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;

    const html = `<div class="obsidian-backlink" style="margin-top: 12px; padding: 10px 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <a href="${url}" style="color: white; text-decoration: none; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;">
    <span style="font-size: 18px;">📄</span>
    <span>查看源文档</span>
    <span style="opacity: 0.8; font-size: 12px; margin-left: auto;">(Obsidian)</span>
  </a>
</div>`;

    return {
      type: 'source_file',
      label: '查看源文档',
      url,
      html
    };
  }

  /**
   * 生成块回链
   *  v2.2: 修复 URI 格式，使用 Obsidian 官方块定位格式
   */
  private generateBlockBacklink(
    sourceFile: string,
    sourceBlock: string,
    vaultName: string
  ): BacklinkInfo | null {
    const encodedVault = encodeURIComponent(vaultName);
    
    //  修复：使用 Obsidian 官方块定位 URI 格式
    // 移除 sourceBlock 中可能存在的 ^ 前缀
    const cleanBlockId = sourceBlock.replace(/^\^/, '');
    const fileWithAnchor = `${sourceFile}#^${cleanBlockId}`;
    const url = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(fileWithAnchor)}`;

    const html = `<div class="obsidian-backlink" style="margin-top: 8px; padding: 8px 12px; background: #f0f4f8; border-left: 4px solid #667eea; border-radius: 4px;">
  <a href="${url}" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 6px; font-size: 13px;">
    <span>🔗</span>
    <span>定位到块</span>
    <span style="opacity: 0.6; font-size: 11px; font-family: monospace;">^${cleanBlockId}</span>
  </a>
</div>`;

    return {
      type: 'source_block',
      label: '定位到块',
      url,
      html
    };
  }

  /**
   * 解析文件路径
   */
  private resolveFilePath(refPath: string, contextPath: string): string {
    // 移除 Obsidian 链接语法
    let path = refPath.replace(/^\[\[|\]\]$/g, '');

    // 处理别名
    if (path.includes('|')) {
      path = path.split('|')[0];
    }

    // 绝对路径
    if (path.startsWith('/')) {
      return path.slice(1);
    }

    // 尝试使用 Obsidian API 解析
    const file = this.app.metadataCache.getFirstLinkpathDest(path, contextPath);
    return file ? file.path : path;
  }

  /**
   * 提取文件名
   */
  private extractFilename(path: string): string {
    // 清理路径：移除 [[]], 处理管道符|, 移除末尾的!
    let cleaned = path.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
    
    //  移除末尾的 ! (Obsidian 特殊语法)
    cleaned = cleaned.replace(/!+$/, '');
    
    // 提取文件名（路径的最后一部分）
    return cleaned.split('/').pop() || cleaned;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    //  处理URL参数：移除 @ 后面的内容
    let cleanFilename = filename;
    if (filename.includes('@')) {
      cleanFilename = filename.split('@')[0];
    }
    
    //  处理URL查询参数：移除 ? 后面的内容
    if (cleanFilename.includes('?')) {
      cleanFilename = cleanFilename.split('?')[0];
    }
    
    const parts = cleanFilename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * 判断媒体类型
   */
  private getMediaType(extension: string): 'image' | 'audio' | 'video' {
    const ext = extension.toLowerCase();

    if (this.IMAGE_EXTENSIONS.includes(ext)) {
      return 'image';
    } else if (this.AUDIO_EXTENSIONS.includes(ext)) {
      return 'audio';
    } else if (this.VIDEO_EXTENSIONS.includes(ext)) {
      return 'video';
    }

    // 默认为图片
    return 'image';
  }

  /**
   * 判断是否是网络URL
   */
  private isNetworkUrl(path: string): boolean {
    return path.startsWith('http://') || path.startsWith('https://');
  }

  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * 媒体引用
 */
interface MediaReference {
  type: 'obsidian' | 'markdown';
  path: string;
  fullMatch: string;
  alt?: string;
}




