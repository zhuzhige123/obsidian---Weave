/**
 * MobileKeyboardManager - 移动端键盘状态管理工具类
 * 
 * 使用 Visual Viewport API 监听键盘弹出/收起事件，
 * 动态计算编辑器可用高度，解决移动端键盘遮挡问题。
 * 
 * @module utils/mobile-keyboard-manager
 */

import { logDebug, logWarn } from './logger';

/**
 * 键盘状态接口
 */
export interface KeyboardState {
	/** 键盘是否可见 */
	isVisible: boolean;
	/** 键盘高度（像素） */
	keyboardHeight: number;
	/** 可视视口高度 */
	visualViewportHeight: number;
}

/**
 * MobileKeyboardManager 配置选项
 */
export interface MobileKeyboardManagerOptions {
	/** 键盘显示时的回调 */
	onKeyboardShow?: (state: KeyboardState) => void;
	/** 键盘隐藏时的回调 */
	onKeyboardHide?: (state: KeyboardState) => void;
	/** 视口大小变化时的回调 */
	onResize?: (state: KeyboardState) => void;
	/** 编辑器与键盘的最小间距，默认 8px */
	minGap?: number;
	/** 最小编辑器高度阈值，默认 200px */
	minEditorHeight?: number;
	/** 键盘检测阈值（视口高度变化超过此值认为键盘弹出），默认 150px */
	keyboardThreshold?: number;
}

/**
 * 移动端键盘管理器
 * 
 * 使用 Visual Viewport API 监听键盘状态变化，
 * 提供编辑器高度计算功能。
 */
export class MobileKeyboardManager {
	private options: Required<MobileKeyboardManagerOptions>;
	private initialViewportHeight: number;
	private resizeHandler: (() => void) | null = null;
	private scrollHandler: (() => void) | null = null;
	private lastKeyboardState: KeyboardState;
	private isListening = false;

	constructor(options: MobileKeyboardManagerOptions = {}) {
		this.options = {
			onKeyboardShow: options.onKeyboardShow ?? (() => {}),
			onKeyboardHide: options.onKeyboardHide ?? (() => {}),
			onResize: options.onResize ?? (() => {}),
			minGap: options.minGap ?? 8,
			minEditorHeight: options.minEditorHeight ?? 200,
			keyboardThreshold: options.keyboardThreshold ?? 150,
		};

		// 初始化视口高度
		this.initialViewportHeight = this.getVisualViewportHeight();
		
		// 初始化键盘状态
		this.lastKeyboardState = {
			isVisible: false,
			keyboardHeight: 0,
			visualViewportHeight: this.initialViewportHeight,
		};

		logDebug('[MobileKeyboardManager] 初始化完成', {
			initialViewportHeight: this.initialViewportHeight,
			isSupported: MobileKeyboardManager.isSupported(),
		});
	}

	/**
	 * 检查 Visual Viewport API 是否可用
	 */
	static isSupported(): boolean {
		return typeof window !== 'undefined' && 
			   window.visualViewport !== null && 
			   window.visualViewport !== undefined;
	}

	/**
	 * 获取当前可视视口高度
	 */
	private getVisualViewportHeight(): number {
		if (MobileKeyboardManager.isSupported()) {
			return window.visualViewport!.height;
		}
		// 降级方案：使用 window.innerHeight
		return window.innerHeight;
	}

	/**
	 * 开始监听键盘事件
	 */
	startListening(): void {
		if (this.isListening) {
			logWarn('[MobileKeyboardManager] 已经在监听中');
			return;
		}

		// 更新初始视口高度
		this.initialViewportHeight = this.getVisualViewportHeight();

		if (MobileKeyboardManager.isSupported()) {
			this.resizeHandler = this.handleViewportResize.bind(this);
			this.scrollHandler = this.handleViewportScroll.bind(this);
			
			window.visualViewport!.addEventListener('resize', this.resizeHandler);
			window.visualViewport!.addEventListener('scroll', this.scrollHandler);
			
			logDebug('[MobileKeyboardManager] 开始监听 Visual Viewport 事件');
		} else {
			// 降级方案：监听 window resize
			this.resizeHandler = this.handleWindowResize.bind(this);
			window.addEventListener('resize', this.resizeHandler);
			
			logWarn('[MobileKeyboardManager] Visual Viewport API 不可用，使用降级方案');
		}

		this.isListening = true;
	}

	/**
	 * 停止监听
	 */
	stopListening(): void {
		if (!this.isListening) {
			return;
		}

		if (MobileKeyboardManager.isSupported() && this.resizeHandler) {
			window.visualViewport!.removeEventListener('resize', this.resizeHandler);
			if (this.scrollHandler) {
				window.visualViewport!.removeEventListener('scroll', this.scrollHandler);
			}
		} else if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
		}

		this.resizeHandler = null;
		this.scrollHandler = null;
		this.isListening = false;

		logDebug('[MobileKeyboardManager] 停止监听');
	}

	/**
	 * 处理 Visual Viewport resize 事件
	 */
	private handleViewportResize(): void {
		const currentHeight = this.getVisualViewportHeight();
		const heightDiff = this.initialViewportHeight - currentHeight;
		
		const newState: KeyboardState = {
			isVisible: heightDiff > this.options.keyboardThreshold,
			keyboardHeight: Math.max(0, heightDiff),
			visualViewportHeight: currentHeight,
		};

		// 检测键盘状态变化
		if (newState.isVisible !== this.lastKeyboardState.isVisible) {
			if (newState.isVisible) {
				logDebug('[MobileKeyboardManager] 键盘弹出', {
					keyboardHeight: newState.keyboardHeight,
					visualViewportHeight: newState.visualViewportHeight,
				});
				this.options.onKeyboardShow(newState);
			} else {
				logDebug('[MobileKeyboardManager] 键盘收起');
				this.options.onKeyboardHide(newState);
			}
		}

		this.lastKeyboardState = newState;
		this.options.onResize(newState);
	}

	/**
	 * 处理 Visual Viewport scroll 事件
	 */
	private handleViewportScroll(): void {
		// 键盘弹出时可能会触发 scroll 事件
		// 这里可以用于处理视口偏移
	}

	/**
	 * 处理 window resize 事件（降级方案）
	 */
	private handleWindowResize(): void {
		const currentHeight = window.innerHeight;
		const heightDiff = this.initialViewportHeight - currentHeight;
		
		const newState: KeyboardState = {
			isVisible: heightDiff > this.options.keyboardThreshold,
			keyboardHeight: Math.max(0, heightDiff),
			visualViewportHeight: currentHeight,
		};

		if (newState.isVisible !== this.lastKeyboardState.isVisible) {
			if (newState.isVisible) {
				this.options.onKeyboardShow(newState);
			} else {
				this.options.onKeyboardHide(newState);
			}
		}

		this.lastKeyboardState = newState;
		this.options.onResize(newState);
	}

	/**
	 * 获取当前键盘状态
	 */
	getKeyboardState(): KeyboardState {
		return { ...this.lastKeyboardState };
	}

	/**
	 * 计算编辑器可用高度
	 * 
	 * @param headerHeight - 顶部栏高度（像素）
	 * @returns 编辑器可用高度（像素）
	 */
	calculateEditorHeight(headerHeight: number): number {
		const viewportHeight = this.getVisualViewportHeight();
		const calculatedHeight = viewportHeight - headerHeight - this.options.minGap;
		
		// 确保不小于最小高度阈值
		const finalHeight = Math.max(calculatedHeight, this.options.minEditorHeight);
		
		logDebug('[MobileKeyboardManager] 计算编辑器高度', {
			viewportHeight,
			headerHeight,
			minGap: this.options.minGap,
			calculatedHeight,
			finalHeight,
		});

		return finalHeight;
	}

	/**
	 * 重置初始视口高度
	 * 在键盘完全收起后调用，更新基准高度
	 */
	resetInitialHeight(): void {
		this.initialViewportHeight = this.getVisualViewportHeight();
		this.lastKeyboardState = {
			isVisible: false,
			keyboardHeight: 0,
			visualViewportHeight: this.initialViewportHeight,
		};
		
		logDebug('[MobileKeyboardManager] 重置初始高度', {
			initialViewportHeight: this.initialViewportHeight,
		});
	}

	/**
	 * 销毁管理器
	 */
	destroy(): void {
		this.stopListening();
		logDebug('[MobileKeyboardManager] 已销毁');
	}
}
