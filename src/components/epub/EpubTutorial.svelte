<script lang="ts">
	import { setIcon } from 'obsidian';

	interface Props {
		visible: boolean;
		onClose: () => void;
	}

	let { visible, onClose }: Props = $props();

	let activeTab = $state<'basics' | 'highlight' | 'note' | 'tools' | 'credits'>('basics');

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	function switchTab(tab: typeof activeTab) {
		activeTab = tab;
	}

	const tabs = [
		{ id: 'basics' as const, label: '基础阅读' },
		{ id: 'highlight' as const, label: '高亮标注' },
		{ id: 'note' as const, label: '笔记提取' },
		{ id: 'tools' as const, label: '工具功能' },
		{ id: 'credits' as const, label: '致谢' }
	];
</script>

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="epub-tutorial-overlay" onclick={onClose}></div>

	<div class="epub-tutorial-panel">
		<div class="epub-tutorial-header">
			<span>EPUB 阅读器使用教程</span>
			<button class="epub-tutorial-close" onclick={onClose} aria-label="Close tutorial">
				<span use:icon={'x'}></span>
			</button>
		</div>

		<div class="epub-tutorial-tabs">
			{#each tabs as tab}
				<button
					class:active={activeTab === tab.id}
					onclick={() => switchTab(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<div class="epub-tutorial-scroll">
			<div class="epub-tutorial-body">

				{#if activeTab === 'basics'}

					<div class="epub-tut-section">
						<div class="epub-tut-title">打开 EPUB 文件</div>
						<div class="epub-tut-text">
							<p>将 <code>.epub</code> 文件放入 Obsidian 仓库，点击即可打开。阅读器会自动保存并恢复阅读进度。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">侧边栏</div>
						<div class="epub-tut-text">
							<p>点击标题栏 <span class="epub-tut-icon" use:icon={'panel-left'}></span> 按钮打开侧边栏：</p>
							<ul>
								<li><strong>书籍信息</strong> - 封面、作者、阅读进度</li>
								<li><strong>TOC</strong> - 目录导航，点击章节跳转</li>
								<li><strong>Highlights</strong> - 查看所有高亮标注</li>
								<li><strong>Bookmarks</strong> - 书签管理</li>
							</ul>
							<p>侧边栏底部 <span class="epub-tut-icon" use:icon={'library'}></span> 按钮可切换到书架视图，浏览仓库中所有 EPUB 文件。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">布局模式</div>
						<div class="epub-tut-text">
							<p>标题栏布局按钮可切换三种模式：</p>
							<ul>
								<li><strong>滚动模式</strong> <span class="epub-tut-icon" use:icon={'scroll-text'}></span> - 连续滚动阅读（默认）</li>
								<li><strong>翻页模式</strong> <span class="epub-tut-icon" use:icon={'file-text'}></span> - 单页翻页，底部有翻页按钮</li>
								<li><strong>双栏模式</strong> <span class="epub-tut-icon" use:icon={'book-open'}></span> - 双栏翻页，模拟实体书</li>
							</ul>
							<p>翻页/双栏模式下可用 <strong>左右方向键</strong> 翻页。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">显示设置</div>
						<div class="epub-tut-text">
							<p>点击标题栏 <span class="epub-tut-icon" use:icon={'a-large-small'}></span> 按钮打开显示设置：</p>
							<ul>
								<li><strong>护眼模式</strong> - 切换暖色调纸张背景</li>
								<li><strong>字号调节</strong> - 12px ~ 32px 范围调节</li>
								<li><strong>字体切换</strong> - Serif（衬线）/ Sans（无衬线）</li>
							</ul>
							<p>宽度按钮 <span class="epub-tut-icon" use:icon={'align-center'}></span> 可切换标准/全宽模式。</p>
						</div>
					</div>

				{:else if activeTab === 'highlight'}

					<div class="epub-tut-section">
						<div class="epub-tut-title">文本高亮</div>
						<div class="epub-tut-text">
							<p>在阅读时 <strong>选中文本</strong>，会弹出浮动工具栏，左侧为四种高亮色：</p>
							<div class="epub-tut-colors">
								<div class="epub-tut-color-item">
									<span class="epub-tut-color-dot yellow"></span>
									<span>黄色 - 常规标记</span>
								</div>
								<div class="epub-tut-color-item">
									<span class="epub-tut-color-dot green"></span>
									<span>绿色 - 重点内容</span>
								</div>
								<div class="epub-tut-color-item">
									<span class="epub-tut-color-dot blue"></span>
									<span>蓝色 - 思考笔记</span>
								</div>
								<div class="epub-tut-color-item">
									<span class="epub-tut-color-dot pink"></span>
									<span>粉色 - 疑问标记</span>
								</div>
							</div>
							<p>点击颜色按钮即可高亮。高亮数据以 <code>[!EPUB|color]</code> callout 格式保存在 Markdown 笔记中。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">高亮回显</div>
						<div class="epub-tut-text">
							<p>再次打开 EPUB 时，阅读器会自动扫描仓库中引用该文件的 Markdown 笔记，从 callout 中提取高亮信息并渲染到阅读器中。</p>
							<h4>工作原理</h4>
							<p>高亮采用 <strong>PDF++ 模式</strong>：数据不存储在独立文件中，而是散落在你的笔记里。这意味着：</p>
							<ul>
								<li>高亮是笔记的一部分，天然支持搜索和引用</li>
								<li>在图谱视图中可看到 EPUB 与笔记的关联</li>
								<li>高亮数据随笔记同步，无需额外管理</li>
							</ul>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">Callout 格式</div>
						<div class="epub-tut-text">
							<p>高亮保存为 Obsidian 标准 callout 格式：</p>
							<pre>> [!EPUB|yellow] [[book.epub#^ch1|Chapter 1]]
> highlighted text content</pre>
							<p>颜色值支持：<code>yellow</code>、<code>green</code>、<code>blue</code>、<code>pink</code>、<code>purple</code>。</p>
						</div>
					</div>

				{:else if activeTab === 'note'}

					<div class="epub-tut-section">
						<div class="epub-tut-title">Auto 模式</div>
						<div class="epub-tut-text">
							<p>标题栏 <span class="epub-tut-icon" use:icon={'zap'}></span> <strong>Auto 按钮</strong> 控制输出行为：</p>
							<ul>
								<li><strong>OFF（默认）</strong> - 选中文本后操作 = 复制到剪贴板</li>
								<li><strong>ON（激活）</strong> - 选中文本后操作 = 直接插入到当前打开的 Markdown 编辑器光标位置</li>
							</ul>
							<p>开启 Auto 后，高亮和复制操作都会自动将带有精确位置链接的引用块插入笔记。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">选中工具栏操作</div>
						<div class="epub-tut-text">
							<p>选中文本后弹出的工具栏从左到右包含：</p>
							<h4>高亮区</h4>
							<p>四色高亮按钮（见高亮标注页）。</p>
							<h4>操作区</h4>
							<ul>
								<li><span class="epub-tut-icon" use:icon={'underline'}></span> <strong>下划线</strong></li>
								<li><span class="epub-tut-icon" use:icon={'pencil'}></span> <strong>笔记</strong></li>
								<li><span class="epub-tut-icon" use:icon={'clipboard-copy'}></span> <strong>复制/插入</strong> - 根据 Auto 模式决定行为</li>
							</ul>
							<h4>Weave 集成区</h4>
							<ul>
								<li><span class="epub-tut-icon" use:icon={'brackets'}></span> <strong>Cloze</strong> - 制作挖空卡片</li>
								<li><span class="epub-tut-icon" use:icon={'scissors'}></span> <strong>Extract</strong> - 提取卡片</li>
								<li><span class="epub-tut-icon" use:icon={'sparkles'}></span> <strong>AI Explain</strong> - AI 解释</li>
							</ul>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">EPUB 链接系统</div>
						<div class="epub-tut-text">
							<p>所有从 EPUB 提取的引用都包含 <strong>CFI 精确定位</strong> 链接，点击链接可跳转回 EPUB 原文并高亮闪烁对应段落。</p>
							<h4>链接格式</h4>
							<pre>[[book.epub#^ch1|Chapter 1 > selected text]]</pre>
							<p>链接在 Obsidian 的 <strong>图谱视图</strong> 中可见，建立了笔记与 EPUB 之间的双向关联。</p>
						</div>
					</div>

				{:else if activeTab === 'tools'}

					<div class="epub-tut-section">
						<div class="epub-tut-title">截图工具</div>
						<div class="epub-tut-text">
							<p>点击标题栏 <span class="epub-tut-icon" use:icon={'camera'}></span> 按钮进入截图模式，在阅读区域拖拽选框即可截取。</p>
							<h4>保存模式</h4>
							<p>通过 <span class="epub-tut-icon" use:icon={'image'}></span> 按钮切换两种保存方式：</p>
							<ul>
								<li><strong>图片模式（ON）</strong> - 保存为 JPEG 图片文件，Auto ON 时插入图片嵌入链接</li>
								<li><strong>嵌入模式（OFF）</strong> - 提取选区文本，Auto ON 时插入带 CFI 定位的文本引用</li>
							</ul>
							<p>Auto OFF 时截图会复制到剪贴板。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">快捷键</div>
						<div class="epub-tut-text">
							<div class="epub-tut-shortcut-list">
								<div class="epub-tut-shortcut">
									<kbd>←</kbd> <kbd>→</kbd>
									<span>翻页（翻页/双栏模式）</span>
								</div>
							</div>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">标题栏按钮一览</div>
						<div class="epub-tut-text">
							<div class="epub-tut-btn-list">
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'panel-left'}></span>
									<span>侧边栏（目录 / 高亮 / 书架）</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'a-large-small'}></span>
									<span>显示设置（字号 / 字体 / 护眼）</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'image'}></span>
									<span>截图保存模式切换</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'camera'}></span>
									<span>截图工具</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'zap'}></span>
									<span>Auto 模式（复制 / 插入笔记）</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'scroll-text'}></span>
									<span>布局切换（滚动 / 翻页 / 双栏）</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'align-center'}></span>
									<span>宽度切换（标准 / 全宽）</span>
								</div>
								<div class="epub-tut-btn-item">
									<span class="epub-tut-icon" use:icon={'circle-help'}></span>
									<span>打开本教程</span>
								</div>
							</div>
						</div>
					</div>

				{:else if activeTab === 'credits'}

					<div class="epub-tut-section">
						<div class="epub-tut-title">EPUB 解析引擎</div>
						<div class="epub-tut-text">
							<p>EPUB 文件解析与渲染基于开源库 <strong>epub.js</strong>（futurepress/epub.js）。感谢 epub.js 提供的高质量 EPUB 解析、渲染和导航能力。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">EPUB 链接系统</div>
						<div class="epub-tut-text">
							<p>EPUB 链接追踪灵感来自 <strong>Obsidian PDF++</strong> 插件。感谢 RyotaUshio/obsidian-pdf-plus 的优秀链接格式设计。</p>
						</div>
					</div>

					<div class="epub-tut-divider"></div>

					<div class="epub-tut-section">
						<div class="epub-tut-title">Canvas 脑图交互</div>
						<div class="epub-tut-text">
							<p>EPUB 阅读器与 Obsidian Canvas 的交互设计参考了 <strong>MarginNote</strong> 的脑图笔记模式。通过摘录自动添加到 Canvas 并以方向控制组织节点结构，实现类似 MarginNote 的阅读 + 脑图联动体验。</p>
						</div>
					</div>

				{/if}

			</div>
		</div>
	</div>
{/if}
