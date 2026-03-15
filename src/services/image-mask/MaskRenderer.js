import { logger } from '../../utils/logger';
import { MASK_CONSTANTS } from '../../types/image-mask-types';
import { parseRGBAColor } from './mask-operations';
export class MaskRenderer {
    // 🆕 遮罩状态追踪 Map<maskId, isVisible>
    maskStates = new Map();
    /**
     * 在图片元素上渲染遮罩
     *
     * @param imgElement 图片 DOM 元素
     * @param maskData 遮罩数据
     * @param options 渲染选项
     */
    renderMasksOnImage(imgElement, maskData, options = { visible: true, interactive: false }) {
        if (!maskData || !maskData.masks || maskData.masks.length === 0) {
            return;
        }
        //  修复：图片资源可能尚未加载完成（尤其是移动端/懒加载场景）
        // 如果 naturalWidth/naturalHeight 为 0，会导致 viewBox/坐标计算错误，从而出现遮罩错位。
        if (!imgElement.complete || imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
            const pendingKey = 'weaveMaskPending';
            if (imgElement.dataset[pendingKey] === '1') {
                return;
            }
            imgElement.dataset[pendingKey] = '1';
            imgElement.addEventListener('load', () => {
                delete imgElement.dataset[pendingKey];
                this.renderMasksOnImage(imgElement, maskData, options);
            }, { once: true });
            return;
        }
        // 创建遮罩容器
        const container = this.createMaskContainer(imgElement, options.interactive);
        // 渲染每个遮罩
        maskData.masks.forEach(_mask => {
            const maskElement = this.createMaskElement(_mask, imgElement, options);
            if (maskElement) {
                container.appendChild(maskElement);
                // 🆕 初始化遮罩状态
                this.maskStates.set(_mask.id, options.visible ?? true);
                // 🆕 如果启用交互模式，添加点击事件
                if (options.interactive) {
                    this.makeMaskInteractive(maskElement, _mask.id);
                }
            }
        });
    }
    /**
     * 显示遮罩（动画）
     *
     * @param container 遮罩容器元素
     * @param duration 动画持续时间（毫秒）
     */
    showMasks(container, duration = MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION) {
        if (!container)
            return;
        container.style.display = '';
        container.style.opacity = '1';
        container.style.transition = `opacity ${duration}ms ease-in`;
    }
    /**
     * 隐藏遮罩（动画）- 用于显示答案时
     *
     * @param container 遮罩容器元素
     * @param duration 动画持续时间（毫秒）
     */
    hideMasks(container, duration = MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION) {
        if (!container)
            return;
        container.style.opacity = '0';
        container.style.transition = `opacity ${duration}ms ease-out`;
        // 🆕 更新所有遮罩状态为已揭示
        const masks = container.querySelectorAll('.weave-mask');
        masks.forEach(mask => {
            const maskId = mask.getAttribute('data-mask-id');
            if (maskId) {
                this.maskStates.set(maskId, false);
            }
        });
        // 动画结束后隐藏元素
        setTimeout(() => {
            container.style.display = 'none';
        }, duration);
    }
    /**
     * 🆕 切换单个遮罩的显示状态
     *
     * @param maskId 遮罩ID
     * @param duration 动画持续时间（毫秒）
     */
    toggleMask(maskId, duration = MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION) {
        const maskElement = document.querySelector(`[data-mask-id="${maskId}"]`);
        if (!maskElement)
            return;
        const currentState = this.maskStates.get(maskId) ?? true;
        const newState = !currentState;
        // 更新状态
        this.maskStates.set(maskId, newState);
        // 应用动画
        if (newState) {
            // 显示遮罩（重新遮盖）
            maskElement.style.transition = `fill-opacity ${duration}ms ease-in`;
            maskElement.style.fillOpacity = maskElement.getAttribute('data-original-opacity') || '0.7';
            maskElement.classList.remove('mask-revealed');
            maskElement.classList.remove('mask-hovering'); // 移除hover标记
        }
        else {
            // 隐藏遮罩（揭示内容）
            maskElement.style.transition = `fill-opacity ${duration}ms ease-out`;
            maskElement.style.fillOpacity = '0';
            maskElement.classList.add('mask-revealed');
            maskElement.classList.remove('mask-hovering'); // 移除hover标记
        }
    }
    /**
     * 🆕 使遮罩可交互（添加点击事件）
     */
    makeMaskInteractive(maskElement, maskId) {
        // 允许点击事件
        maskElement.style.pointerEvents = 'auto';
        maskElement.style.cursor = 'pointer';
        maskElement.classList.add('weave-mask-interactive');
        // 保存原始透明度
        const originalOpacity = maskElement.getAttribute('fill-opacity') || '0.7';
        maskElement.setAttribute('data-original-opacity', originalOpacity);
        // 添加点击事件
        maskElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMask(maskId);
            logger.debug('[MaskRenderer] 切换遮罩:', maskId);
        });
        // 添加hover效果 - 完全透明显示背后内容（预览效果）
        maskElement.addEventListener('mouseenter', () => {
            const isVisible = this.maskStates.get(maskId) ?? true;
            if (isVisible && !maskElement.classList.contains('mask-revealed')) {
                // 保存当前透明度，然后设为0（完全透明）
                const currentOpacity = maskElement.style.fillOpacity || maskElement.getAttribute('fill-opacity') || '0.7';
                maskElement.setAttribute('data-hover-backup-opacity', currentOpacity);
                maskElement.style.transition = 'fill-opacity 150ms ease';
                maskElement.style.fillOpacity = '0';
                maskElement.classList.add('mask-hovering'); // 标记正在hover
            }
        });
        maskElement.addEventListener('mouseleave', () => {
            const isVisible = this.maskStates.get(maskId) ?? true;
            if (isVisible && maskElement.classList.contains('mask-hovering')) {
                // 恢复原始透明度（仅在未被点击揭示时）
                const backupOpacity = maskElement.getAttribute('data-hover-backup-opacity') || '0.7';
                maskElement.style.fillOpacity = backupOpacity;
                maskElement.classList.remove('mask-hovering');
            }
        });
    }
    /**
     * 查找图片对应的遮罩容器
     *
     * @param imgElement 图片元素
     * @returns 遮罩容器或 null
     */
    findMaskContainer(imgElement) {
        const wrapper = imgElement.parentElement;
        if (!wrapper || !wrapper.classList.contains('weave-image-with-masks')) {
            return null;
        }
        return wrapper.querySelector('.weave-mask-overlay');
    }
    /**
     * 🆕 Hide All, Guess One 模式：只揭示指定编号的遮罩
     *
     * @param container 遮罩容器
     * @param revealIndex 要揭示的遮罩编号（从1开始），0表示全部隐藏
     */
    revealByIndex(container, revealIndex) {
        if (!container)
            return;
        const maskGroups = container.querySelectorAll('g[data-mask-id]');
        maskGroups.forEach(group => {
            const indexText = group.querySelector('.weave-mask-index');
            const maskIndex = indexText ? parseInt(indexText.textContent || '0', 10) : 0;
            const shapeElement = group.querySelector('rect, circle');
            if (shapeElement) {
                if (revealIndex === 0) {
                    // 全部显示遮罩
                    shapeElement.style.fillOpacity = shapeElement.getAttribute('data-original-opacity') || '0.7';
                }
                else if (maskIndex === revealIndex) {
                    // 揭示指定编号的遮罩
                    shapeElement.style.fillOpacity = '0';
                }
                else {
                    // 其他遮罩保持显示
                    shapeElement.style.fillOpacity = shapeElement.getAttribute('data-original-opacity') || '0.7';
                }
            }
        });
        logger.debug('[MaskRenderer] Hide All Guess One - 揭示编号:', revealIndex);
    }
    /**
     * 🆕 获取遮罩总数
     */
    getMaskCount(container) {
        if (!container)
            return 0;
        return container.querySelectorAll('g[data-mask-id]').length;
    }
    // ===== 私有方法 =====
    /**
     * 创建遮罩容器
     *
     *  创新方案：动态获取图片实际显示尺寸，精确定位 SVG 遮罩层
     */
    createMaskContainer(imgElement, interactive = false) {
        // 检查是否已存在包装器
        let wrapper = imgElement.parentElement;
        if (!wrapper || !wrapper.classList.contains('weave-image-with-masks')) {
            // 创建包装器
            wrapper = document.createElement('div');
            wrapper.className = 'weave-image-with-masks';
            // 替换图片位置
            const parent = imgElement.parentElement;
            if (parent) {
                parent.insertBefore(wrapper, imgElement);
                wrapper.appendChild(imgElement);
            }
        }
        // 移除旧的遮罩层（如果存在）
        const oldOverlay = wrapper.querySelector('.weave-mask-overlay');
        if (oldOverlay) {
            oldOverlay.remove();
        }
        //  修复：遮罩坐标以图片原始尺寸(natural)作为“坐标系”，但遮罩层的
        // 实际显示大小必须跟随图片当前显示尺寸，否则在不同窗口/移动端缩放时会错位。
        const naturalWidth = imgElement.naturalWidth || imgElement.clientWidth || imgElement.offsetWidth;
        const naturalHeight = imgElement.naturalHeight || imgElement.clientHeight || imgElement.offsetHeight;
        logger.debug('[MaskRenderer] 图片尺寸:', {
            naturalWidth: imgElement.naturalWidth,
            naturalHeight: imgElement.naturalHeight,
            clientWidth: imgElement.clientWidth,
            clientHeight: imgElement.clientHeight
        });
        // 创建 SVG 遮罩层
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', interactive ? 'weave-mask-overlay interactive' : 'weave-mask-overlay');
        // viewBox 固定使用图片原始像素尺寸，确保遮罩数据在任何显示尺寸下都能按比例缩放。
        svg.setAttribute('viewBox', `0 0 ${naturalWidth} ${naturalHeight}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        //  关键修复：遮罩层显示尺寸使用 100%，严格跟随图片当前显示尺寸
        // 这样无论学习预览里图片被缩放到多大，遮罩都能正确覆盖。
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = interactive ? 'auto' : 'none';
        // 保存图片尺寸供后续使用
        svg.dataset.imgWidth = String(naturalWidth);
        svg.dataset.imgHeight = String(naturalHeight);
        wrapper.appendChild(svg);
        return svg;
    }
    /**
     * 创建单个遮罩元素
     *
     *  创新方案：使用图片实际尺寸计算遮罩坐标
     */
    createMaskElement(mask, imgElement, options) {
        //  修复：遮罩元素坐标计算必须使用 natural 尺寸（与 viewBox 坐标系一致）
        const imgWidth = imgElement.naturalWidth || imgElement.clientWidth || imgElement.offsetWidth;
        const imgHeight = imgElement.naturalHeight || imgElement.clientHeight || imgElement.offsetHeight;
        let shapeElement;
        if (mask.type === 'rect') {
            shapeElement = this.createRectMask(mask, imgWidth, imgHeight);
        }
        else if (mask.type === 'circle') {
            shapeElement = this.createCircleMask(mask, imgWidth, imgHeight);
        }
        else {
            logger.warn('[MaskRenderer] 不支持的遮罩类型:', mask.type);
            return null;
        }
        // 应用样式
        this.applyMaskStyle(shapeElement, mask);
        // 创建组合元素，包含形状和编号
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-mask-id', mask.id);
        group.appendChild(shapeElement);
        // 添加编号显示
        if (mask.index) {
            const badgeGroup = this.createMaskIndexText(mask, imgWidth, imgHeight);
            group.appendChild(badgeGroup);
        }
        // 应用可见性
        if (!options.visible) {
            group.style.display = 'none';
        }
        return group;
    }
    /**
     * 创建角标式编号徽章（左上角）
     */
    createMaskIndexText(mask, imgWidth, imgHeight) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'weave-mask-badge');
        group.setAttribute('pointer-events', 'none');
        // 计算左上角位置
        let badgeX, badgeY;
        const minDimension = Math.min(imgWidth, imgHeight);
        const badgeSize = Math.max(16, minDimension * 0.04); // 徽章大小
        const offset = badgeSize * 0.3; // 内边距
        if (mask.type === 'rect') {
            badgeX = mask.x * imgWidth + offset;
            badgeY = mask.y * imgHeight + offset;
        }
        else {
            badgeX = (mask.x - (mask.radius || 0)) * imgWidth + offset;
            badgeY = (mask.y - (mask.radius || 0)) * imgHeight + offset;
        }
        // 徽章背景（圆角矩形）
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', String(badgeX - badgeSize / 2));
        bg.setAttribute('y', String(badgeY - badgeSize / 2));
        bg.setAttribute('width', String(badgeSize));
        bg.setAttribute('height', String(badgeSize));
        bg.setAttribute('rx', String(badgeSize * 0.2));
        bg.setAttribute('fill', 'rgba(0, 0, 0, 0.75)');
        group.appendChild(bg);
        // 编号文字
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(badgeX));
        text.setAttribute('y', String(badgeY));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.textContent = String(mask.index);
        const fontSize = Math.max(10, badgeSize * 0.6);
        text.style.fontSize = `${fontSize}px`;
        text.style.fontWeight = '600';
        text.style.fill = 'white';
        text.style.userSelect = 'none';
        group.appendChild(text);
        return group;
    }
    /**
     * 创建矩形遮罩
     */
    createRectMask(mask, imgWidth, imgHeight) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        //  创新方案：坐标乘以图片实际尺寸（而不是固定的10）
        // 这样 viewBox 和坐标都使用图片实际像素，确保精确对齐
        rect.setAttribute('x', `${mask.x * imgWidth}`);
        rect.setAttribute('y', `${mask.y * imgHeight}`);
        rect.setAttribute('width', `${(mask.width || 0) * imgWidth}`);
        rect.setAttribute('height', `${(mask.height || 0) * imgHeight}`);
        rect.setAttribute('data-mask-id', mask.id);
        return rect;
    }
    /**
     * 创建圆形遮罩
     *
     *  创新方案：使用图片实际尺寸计算坐标
     */
    createCircleMask(mask, imgWidth, imgHeight) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        //  创新方案：坐标乘以图片实际尺寸
        circle.setAttribute('cx', `${mask.x * imgWidth}`);
        circle.setAttribute('cy', `${mask.y * imgHeight}`);
        // 圆形半径使用宽高中较小的值，保持比例
        const minDimension = Math.min(imgWidth, imgHeight);
        circle.setAttribute('r', `${(mask.radius || 0) * minDimension}`);
        circle.setAttribute('data-mask-id', mask.id);
        return circle;
    }
    /**
     * 应用遮罩样式
     */
    applyMaskStyle(element, mask) {
        const fill = mask.fill || MASK_CONSTANTS.DEFAULT_FILL;
        const { rgb, opacity } = parseRGBAColor(fill);
        //  修复：统一设置颜色属性
        element.setAttribute('fill', rgb);
        element.setAttribute('fill-opacity', opacity.toString());
        // 🆕 保存原始透明度（用于 Hide All Guess One 模式）
        element.setAttribute('data-original-opacity', opacity.toString());
        //  修复：强制元素本身不透明，防止CSS的opacity覆盖fill-opacity
        element.style.opacity = '1';
        // 应用特殊样式
        if (mask.style === 'blur') {
            // SVG 模糊滤镜
            const filterId = `blur-${mask.id}`;
            const filter = this.createBlurFilter(filterId, mask.blurRadius || MASK_CONSTANTS.DEFAULT_BLUR_RADIUS);
            // 添加滤镜到 SVG
            const svg = element.parentElement;
            if (svg) {
                let defs = svg.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    svg.insertBefore(defs, svg.firstChild);
                }
                defs.appendChild(filter);
                element.setAttribute('filter', `url(#${filterId})`);
            }
        }
        // 添加类名用于 CSS 控制
        element.classList.add('weave-mask');
        element.classList.add(`weave-mask-${mask.style}`);
    }
    /**
     * 🆕 重置所有遮罩状态（清理状态追踪）
     */
    resetMaskStates() {
        this.maskStates.clear();
    }
    /**
     * 创建模糊滤镜
     */
    createBlurFilter(id, radius) {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', id);
        const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('in', 'SourceGraphic');
        blur.setAttribute('stdDeviation', `${radius}`);
        filter.appendChild(blur);
        return filter;
    }
}
/**
 * 在容器中查找所有带遮罩的图片
 *
 * @param container 容器元素
 * @returns 带遮罩的图片包装器数组
 */
export function findMaskedImages(container) {
    return Array.from(container.querySelectorAll('.weave-image-with-masks'));
}
/**
 * 批量显示所有遮罩
 *
 * @param container 容器元素
 * @param duration 动画持续时间
 */
export function revealAllMasks(container, duration = MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION) {
    const renderer = new MaskRenderer();
    const maskedImages = findMaskedImages(container);
    maskedImages.forEach((wrapper) => {
        const overlay = wrapper.querySelector('.weave-mask-overlay');
        renderer.hideMasks(overlay, duration);
    });
}
/**
 * 批量隐藏所有遮罩
 *
 * @param container 容器元素
 * @param duration 动画持续时间
 */
export function hideAllMasks(container, duration = MASK_CONSTANTS.DEFAULT_ANIMATION_DURATION) {
    const renderer = new MaskRenderer();
    const maskedImages = findMaskedImages(container);
    maskedImages.forEach((wrapper) => {
        const overlay = wrapper.querySelector('.weave-mask-overlay');
        renderer.showMasks(overlay, duration);
    });
}
