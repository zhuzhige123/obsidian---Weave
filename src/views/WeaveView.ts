import { ItemView, Platform, Menu } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { WeavePlugin } from "../main";
import { logger } from "../utils/logger";
import { getLocationToggleIcon, getLocationToggleTooltip, toggleViewLocation } from "../utils/view-location-utils";
// import { performanceMonitor } from "../utils/enhanced-performance-monitor";

export const VIEW_TYPE_WEAVE = "weave-view";

export class WeaveView extends ItemView {
	component: unknown | null = null;
	plugin: WeavePlugin;
	private isClosing = false;

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_WEAVE;
	}

	getDisplayText() {
		return "Weave";
	}

	getIcon() {
		return "brain";
	}

	// 设置为可以在主编辑区打开
	allowNoFile() {
		return true;
	}

	// 设置导航类型
	getNavigationType() {
		return "tab";
	}

	async onOpen() {
		// 清空容器内容，防止残留
		this.contentEl.empty();

		// 直接创建主组件，无需进度条
		this.contentEl.classList.add("weave-view-content");
		this.contentEl.classList.add("weave-main-editor-mode");
		//  移除底部间距（侧边栏模式下不需要额外间距）
		this.contentEl.style.paddingBottom = "0";
		//  设置背景色为主内容区背景色
		this.contentEl.style.background = "var(--background-primary)";

		//  性能优化：异步非阻塞加载
		// 先显示加载占位符，不阻塞 Obsidian 主界面
		this.showLoadingPlaceholder();

		// 后台异步等待并加载组件
		this.loadComponentAsync();
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu?.(menu, source);

		if (!Platform.isMobile) return;

		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle(getLocationToggleTooltip(this.leaf))
				.setIcon(getLocationToggleIcon(this.leaf))
				.onClick(async () => {
					await toggleViewLocation(this, "right");
				});
		});
	}

	/**
	 * 显示加载占位符
	 */
	private showLoadingPlaceholder(): void {
		this.contentEl.createDiv({
			cls: "weave-view-loading",
			text: "正在初始化 Weave...",
		});
	}

	/**
	 * 异步加载组件（不阻塞 onOpen）
	 */
	private async loadComponentAsync(): Promise<void> {
		try {
			// 异步等待 dataStorage 初始化
			await this.waitForDataStorage();

			// 检查 dataStorage 是否已初始化
			if (!this.plugin.dataStorage) {
				logger.warn("[WeaveView] dataStorage 未初始化，显示等待状态");
				this.contentEl.empty();
				this.contentEl.innerHTML = `
					<div class="weave-view-loading">
						<div class="loading-spinner"></div>
						<div class="loading-text">正在等待数据服务初始化...</div>
						<div class="loading-hint">如果长时间未响应，请尝试重新加载插件</div>
					</div>
				`;

				// 继续等待，每秒检查一次
				const checkInterval = setInterval(async () => {
					if (this.plugin.dataStorage) {
						clearInterval(checkInterval);
						await this.loadComponentAsync();
					}
				}, 1000);

				return;
			}

			// 清空占位符
			this.contentEl.empty();
			this.contentEl.classList.add("weave-view-content");
			this.contentEl.classList.add("weave-main-editor-mode");
			//  移除底部间距（侧边栏模式下不需要额外间距）
			this.contentEl.style.paddingBottom = "0";
			//  设置背景色为主内容区背景色
			this.contentEl.style.background = "var(--background-primary)";

			// 创建主组件
			await this.createMainComponent();
		} catch (error) {
			logger.error("[WeaveView] 组件加载失败:", error);
			this.contentEl.empty();
			this.contentEl.innerHTML = `
				<div class="weave-view-error">
					<div class="error-icon">警告</div>
					<div class="error-text">Weave 初始化失败</div>
					<div class="error-hint">请尝试重新加载插件或重启 Obsidian</div>
				</div>
			`;
		}
	}

	/**
	 * 等待所有核心服务初始化完成（异步，不阻塞界面）
	 * 使用事件驱动方式，比轮询更高效
	 */
	private async waitForDataStorage(): Promise<void> {
		// 如果已初始化（检查 dataStorage 和 cardFileService），直接返回
		if (this.plugin.dataStorage && this.plugin.cardFileService) {
			return;
		}

		logger.debug("[WeaveView] 等待 allCoreServices 初始化...");

		try {
			//  关键修复：等待所有核心服务就绪（包括 cardFileService）
			// getCards() 依赖 cardFileService，必须等待 allCoreServices
			const { waitForServiceReady } = await import("../utils/service-ready-event");
			await waitForServiceReady("allCoreServices", 15000);
			logger.debug("[WeaveView] allCoreServices 已就绪（事件通知）");
		} catch (_error) {
			// 事件等待超时，回退到轮询检查
			logger.warn("[WeaveView] 事件等待超时，回退到轮询检查");

			const maxAttempts = 20; // 额外等待 2 秒
			const interval = 100;

			for (let i = 0; i < maxAttempts; i++) {
				if (this.plugin.dataStorage && this.plugin.cardFileService) {
					logger.debug(`[WeaveView] allCoreServices 已就绪（轮询 ${i * interval}ms）`);
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, interval));
			}

			// 不抛出错误，而是记录警告
			logger.warn("[WeaveView] dataStorage 初始化超时，将显示加载状态");
		}
	}

	private async createMainComponent() {
		try {
			// 动态导入主组件，实现懒加载
			const { mount } = await import("svelte");
			const { default: Component } = await import("../components/WeaveApp.svelte");

			this.component = mount(Component, {
				target: this.contentEl,
				props: {
					plugin: this.plugin,
					dataStorage: this.plugin.dataStorage,
					fsrs: this.plugin.fsrs,
				},
			});
		} catch (error) {
			logger.error("Failed to create WeaveView component:", error);
			this.contentEl.innerHTML = '<div class="error">Failed to load Weave interface</div>';
		}
	}

	async onClose() {
		//  防止重入：视图关闭时设置标志
		if (this.isClosing) {
			logger.debug("[WeaveView] 防止重复关闭");
			return;
		}
		this.isClosing = true;

		//  安全销毁组件
		if (this.component) {
			try {
				const { unmount } = await import("svelte");
				unmount(this.component);
				this.component = null;
			} catch (error) {
				logger.error("[WeaveView] 组件销毁失败:", error);
			}
		}

		//  清空容器内容
		this.contentEl.empty();
	}
}
