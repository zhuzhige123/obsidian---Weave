import { logger } from '../../utils/logger';
import { MaskDataParser } from './MaskDataParser';
import { MaskRenderer, revealAllMasks } from './MaskRenderer';
import { MASK_CONSTANTS } from '../../types/image-mask-types';
export class ImageMaskIntegration {
    app;
    parser;
    renderer;
    constructor(app) {
        this.app = app;
        this.parser = new MaskDataParser(app);
        this.renderer = new MaskRenderer();
    }
    /**
     * 在容器中查找并渲染所有带遮罩的图片
     *
     * @param container 容器元素
     * @param content Markdown 内容（用于解析遮罩数据）
     * @param interactive 是否启用交互模式（点击单个遮罩切换）
     */
    applyMasksInContainer(container, content, interactive = false) {
        const images = container.querySelectorAll('img');
        if (images.length === 0) {
            return;
        }
        // 解析内容，查找遮罩注释
        const maskDataMap = this.parseMaskDataFromContent(content);
        if (maskDataMap.size === 0) {
            return;
        }
        // 为每个图片应用遮罩
        images.forEach((img, index) => {
            const imageSrc = img.getAttribute('src') || '';
            const maskData = this.findMaskDataForImage(imageSrc, index, maskDataMap);
            if (maskData) {
                //  调试日志：输出遮罩数据详情
                logger.debug(`[ImageMaskIntegration] 为图片 ${index} 应用遮罩，数据:`, {
                    maskCount: maskData.masks.length,
                    masks: maskData.masks.map(m => ({
                        id: m.id,
                        type: m.type,
                        fill: m.fill,
                        style: m.style
                    }))
                });
                this.renderer.renderMasksOnImage(img, maskData, { visible: true, interactive });
            }
        });
    }
    /**
     * 显示所有遮罩（用于显示问题时）
     *
     * @param container 容器元素
     * @param animated 是否启用动画
     */
    showAllMasks(container, animated = false) {
        const maskedImages = container.querySelectorAll('.weave-image-with-masks');
        maskedImages.forEach((wrapper) => {
            const overlay = wrapper.querySelector('.weave-mask-overlay');
            if (overlay) {
                if (animated) {
                    this.renderer.showMasks(overlay, MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION);
                }
                else {
                    //  修复：非动画模式也要恢复 display 属性
                    overlay.style.display = '';
                    overlay.style.opacity = '1';
                }
            }
        });
        logger.debug(`[ImageMaskIntegration] 显示所有遮罩（动画: ${animated}）`);
    }
    /**
     * 揭示所有遮罩（用于显示答案时）
     *
     * @param container 容器元素
     * @param duration 动画持续时间（毫秒）
     */
    revealAllMasks(container, duration = MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION) {
        revealAllMasks(container, duration);
        logger.debug(`[ImageMaskIntegration] 揭示所有遮罩（动画 ${duration}ms）`);
    }
    /**
     * 移除容器中的所有遮罩
     *
     * @param container 容器元素
     */
    removeMasksInContainer(container) {
        const overlays = container.querySelectorAll('.weave-mask-overlay');
        overlays.forEach(overlay => overlay.remove());
        const wrappers = container.querySelectorAll('.weave-image-with-masks');
        wrappers.forEach(_wrapper => {
            const img = _wrapper.querySelector('img');
            if (img && _wrapper.parentElement) {
                _wrapper.parentElement.insertBefore(img, _wrapper);
                _wrapper.remove();
            }
        });
    }
    // ===== 私有方法 =====
    /**
     * 从内容中解析所有遮罩数据
     * 返回 Map<图片序号, MaskData>
     *
     *  修复：按图片在文件中的出现顺序（0, 1, 2...）建立索引，而不是行号
     */
    parseMaskDataFromContent(content) {
        const maskDataMap = new Map();
        const lines = content.split('\n');
        let imageCount = 0; // 图片计数器
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // 检查当前行是否为图片
            if (this.parser.hasImageLink(line)) {
                // 检查下一行是否为遮罩注释
                const nextLineIndex = i + 1;
                if (nextLineIndex < lines.length) {
                    const nextLine = lines[nextLineIndex].trim();
                    if (nextLine.startsWith(MASK_CONSTANTS.COMMENT_PREFIX)) {
                        const parseResult = this.parser.parseCommentToMaskData(nextLine);
                        if (parseResult.success && parseResult.data) {
                            // 使用图片序号作为 key（从 0 开始）
                            maskDataMap.set(imageCount, parseResult.data);
                            logger.debug(`[ImageMaskIntegration] 找到遮罩数据：图片序号=${imageCount}，遮罩数量=${parseResult.data.masks.length}`);
                        }
                    }
                }
                // 图片计数递增
                imageCount++;
            }
        }
        logger.debug(`[ImageMaskIntegration] 解析完成：共 ${imageCount} 张图片，${maskDataMap.size} 张有遮罩`);
        return maskDataMap;
    }
    /**
     * 查找图片对应的遮罩数据
     */
    findMaskDataForImage(_imageSrc, imageIndex, maskDataMap) {
        // 通过图片序号匹配（修复后的逻辑）
        const maskData = maskDataMap.get(imageIndex);
        if (maskData) {
            logger.debug(`[ImageMaskIntegration] 为图片 #${imageIndex} 找到遮罩数据，包含 ${maskData.masks.length} 个遮罩`);
            return maskData;
        }
        return null;
    }
}
/**
 * 创建图片遮罩集成实例的便捷函数
 */
export function createImageMaskIntegration(app) {
    return new ImageMaskIntegration(app);
}
