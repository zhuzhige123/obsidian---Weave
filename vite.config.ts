import { pathToFileURL } from "url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import builtins from "builtin-modules";
import UnoCSS from "unocss/vite";
import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import commonjs from "vite-plugin-commonjs";
import path from "path";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	console.log(`🔧 Vite mode: ${mode}`);
	const isDev = mode === "development";

	const suppressedSvelteWarnings = new Set([
		"a11y_click_events_have_key_events",
		"a11y_no_static_element_interactions",
		"a11y_label_has_associated_control",
		"a11y_autofocus",
		"a11y_interactive_supports_focus",
		"css_unused_selector",
	]);

	// 环境变量配置
	// 开发模式需设置 OBSIDIAN_VAULT_PATH 环境变量（指向 .obsidian 所在目录）
	// 示例: OBSIDIAN_VAULT_PATH=C:/Users/you/my-vault/.obsidian
	const obsidianVaultPath = env.OBSIDIAN_VAULT_PATH ? path.resolve(env.OBSIDIAN_VAULT_PATH) : null;
	const PLUGIN_DIR = isDev
		? obsidianVaultPath
			? `${obsidianVaultPath}/plugins/weave`
			: "dist"
		: obsidianVaultPath
			? `${obsidianVaultPath}/plugins/weave`
			: "dist";


	return {
		resolve: {
			conditions: ['browser', 'import', 'module', 'default']
		},
		define: {
			'process.env.NODE_ENV': JSON.stringify(mode),
			'global': 'globalThis'
		},
		server: isDev ? {
			watch: {
				usePolling: false,
				useFsEvents: true,
				// 增加监听深度和间隔优化
				depth: 10,
				interval: 100,
				binaryInterval: 300
			},
			hmr: {
				overlay: false
			}
		} : undefined,
		clearScreen: false,
		plugins: [
			commonjs(),
			// 增强的构建监控和热重载日志
			{
				name: 'build-monitor',
				configureServer(server) {
					if (isDev) {
						console.log(`🚀 开发服务器启动 - 监听文件变化...`);
						console.log(`📁 输出目录: ${PLUGIN_DIR}`);
					}
				},
				handleHotUpdate({ file, server }) {
					if (isDev) {
						console.log(`🔥 文件变更: ${path.basename(file)}`);
					}
				},
				buildStart() {
					if (isDev) {
						console.log(`⚡ 开始构建...`);
					}
				},
				buildEnd() {
					if (isDev) {
						const timestamp = new Date().toLocaleTimeString('zh-CN');
						console.log(`✅ 构建完成 [${timestamp}]`);
						console.log(`📦 文件已输出到: ${PLUGIN_DIR}`);
					}
				},
				watchChange(id, change) {
					if (isDev && id) {
						const fileName = path.basename(id);
						console.log(`👀 监听到变化: ${fileName} (${change.event})`);
					}
				}
			},
			viteStaticCopy({
			targets: [
				{
					src: "manifest.json",
					dest: ".",
				},
				{
					src: "node_modules/sql.js/dist/sql-wasm.wasm",
					dest: ".",
				},
				...(isDev ? [] : [
					{
						src: "README.md",
						dest: ".",
					}
				])
			],
		}),
		svelte({
			emitCss: true,
			onwarn(warning, handler) {
				if (warning?.code && suppressedSvelteWarnings.has(warning.code)) return;
				handler(warning);
			},
			compilerOptions: {
				runes: true,
				compatibility: {
					componentApi: 4
				}
			},
			hot: isDev // Svelte 5简化了hot配置，只需boolean值
		}),
			UnoCSS(),
		],
		
		build: {
			lib: {
				entry: "src/main",
				formats: ["cjs"],
			},
			cssCodeSplit: false,
			assetsInlineLimit: 4096000,
		...(isDev && {
			watch: {
				include: ["src/**", "manifest.json"],
				exclude: ["node_modules/**", "dist/**", "**/*.test.*", ".git/**"],
				// 优化监听性能
				skipWrite: false,
				clearScreen: false
			}
		}),
			rollupOptions: {
				onwarn(warning, warn) {
					if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
					warn(warning);
				},
				output: {
					entryFileNames: "main.js",
					inlineDynamicImports: true,
					manualChunks: undefined,
					assetFileNames: "styles.css",
					sourcemapBaseUrl: isDev ? pathToFileURL(`${PLUGIN_DIR}/`).toString() : undefined,
					exports: "named", // 🔧 解决混合导出警告
				},
				external: [
					"obsidian",
					"electron",
					...builtins,
				],
				treeshake: {
				moduleSideEffects: (id) => {
					if (id && (id.includes('demo.ts') || id.includes('integration-demo.ts'))) {
						return false;
					}
					return true;
				}
			}
			},
		outDir: isDev ? PLUGIN_DIR : "dist",
		emptyOutDir: false, // 禁用vite清空，改用prebuild脚本手动清理
		sourcemap: isDev ? "inline" : false,
		target: ["es2018"],
		minify: isDev ? false : "esbuild"
	},
	// ✅ 生产环境使用 esbuild 压缩
	esbuild: isDev ? undefined : {
		drop: ['console', 'debugger'],
		legalComments: 'none'
	},
};
});
