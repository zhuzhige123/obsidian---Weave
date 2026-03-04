/**
 * APKG导入服务
 *
 * 应用层服务，编排整个导入流程
 *
 * @module application/services/apkg
 */

import type { Card, Deck, DeckSettings, DeckStats, FSRSParameters } from "../../../data/types";
import type {
	ImportConfig,
	ImportError,
	ImportProgress,
	ImportResult,
	ImportStats,
	ProgressCallback,
} from "../../../domain/apkg/types";
import type { IDataStorageAdapter } from "../../../infrastructure/adapters/DataStorageAdapter";
import type { IMediaStorageAdapter } from "../../../infrastructure/adapters/MediaStorageAdapter";
import type { WeavePlugin } from "../../../main";
import { DEFAULT_SIMPLIFIED_PARSING_SETTINGS, type ParseTemplate, type SimplifiedParsingSettings } from "../../../types/newCardParsingTypes";

import { CardBuilder } from "../../../domain/apkg/builder/CardBuilder";
import { ContentConverter } from "../../../domain/apkg/converter/ContentConverter";
import { FieldSideResolver } from "../../../domain/apkg/converter/FieldSideResolver";
import { MediaProcessor } from "../../../domain/apkg/converter/MediaProcessor";
import { APKGParser } from "../../../domain/apkg/parser/APKGParser";
import { APKGLogger } from "../../../infrastructure/logger/APKGLogger";
import { generateId } from "../../../utils/helpers";
import { AnkiTemplateConverter } from "./AnkiTemplateConverter";

/**
 * APKG导入服务
 */
export class APKGImportService {
	private logger: APKGLogger;
	private parser: APKGParser;
	private fieldResolver: FieldSideResolver;
	private contentConverter: ContentConverter;
	private mediaProcessor: MediaProcessor;
	private cardBuilder: CardBuilder;
	private templateConverter: AnkiTemplateConverter;
	private dataStorage: IDataStorageAdapter;
	private progressCallback?: ProgressCallback;

	private createDefaultFSRSParameters(): FSRSParameters {
		return {
			w: [
				0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
				0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
			],
			requestRetention: 0.9,
			maximumInterval: 36500,
			enableFuzz: true,
		};
	}

	private createDefaultDeckSettings(): DeckSettings {
		return {
			newCardsPerDay: 20,
			maxReviewsPerDay: 100,
			enableAutoAdvance: true,
			showAnswerTime: 0,
			fsrsParams: this.createDefaultFSRSParameters(),
			learningSteps: [1, 10],
			relearningSteps: [10],
			graduatingInterval: 1,
			easyInterval: 4,
		};
	}

	private createEmptyDeckStats(): DeckStats {
		return {
			totalCards: 0,
			newCards: 0,
			learningCards: 0,
			reviewCards: 0,
			todayNew: 0,
			todayReview: 0,
			todayTime: 0,
			totalReviews: 0,
			totalTime: 0,
			memoryRate: 0,
			averageEase: 0,
			forecastDays: {},
		};
	}

	constructor(dataStorage: IDataStorageAdapter, mediaStorage: IMediaStorageAdapter) {
		this.logger = new APKGLogger({ prefix: "[APKGImportService]" });
		this.parser = new APKGParser();
		this.fieldResolver = new FieldSideResolver();
		this.contentConverter = new ContentConverter();
		this.mediaProcessor = new MediaProcessor(mediaStorage);
		this.cardBuilder = new CardBuilder();
		this.templateConverter = new AnkiTemplateConverter();
		this.dataStorage = dataStorage;
	}

	/**
	 * 导入APKG文件
	 *
	 * @param config - 导入配置
	 * @param plugin - 插件实例（用于保存模板）
	 * @param onProgress - 进度回调
	 * @returns 导入结果
	 */
	async import(
		config: ImportConfig,
		plugin: WeavePlugin,
		onProgress?: ProgressCallback
	): Promise<ImportResult> {
		const startTime = Date.now();
		this.progressCallback = onProgress;

		const errors: ImportError[] = [];
		const warnings: string[] = [];

		const stats: ImportStats = {
			totalCards: 0,
			importedCards: 0,
			skippedCards: 0,
			failedCards: 0,
			mediaFiles: 0,
			mediaTotalSize: 0,
		};

		try {
			this.logger.info(`开始导入APKG: ${config.file.name}`);

			// 1. 解析APKG
			this.updateProgress("parsing", 10, "正在解析APKG文件...");
			const apkgData = await this.parser.parse(config.file);
			stats.totalCards = apkgData.notes.length;

			// 2. 解析字段显示面
			this.updateProgress("analyzing", 30, "正在分析字段配置...");
			const fieldSideMap = this.fieldResolver.resolve(apkgData.models);

			// 🆕 3. 创建/复用模板
			this.updateProgress("analyzing", 40, "正在创建模板...");
			const importedTemplates = await this.createTemplates(apkgData.models, fieldSideMap, plugin);

			// 4. 处理媒体文件
			this.updateProgress("media", 50, "正在处理媒体文件...");
			const deckName = config.targetDeckName || apkgData.decks[0]?.name || "导入牌组";
			const mediaResult = await this.mediaProcessor.process(apkgData.media, deckName);

			stats.mediaFiles = mediaResult.stats.savedFiles;
			stats.mediaTotalSize = mediaResult.stats.totalSize;

			if (mediaResult.errors.length > 0) {
				warnings.push(...mediaResult.errors.map((e) => e.error));
			}

			// 4. 创建或获取牌组
			this.updateProgress("building", 60, "正在创建牌组...");
			const deck = await this.getOrCreateDeck(deckName);

			// 5. 构建卡片
			this.updateProgress("building", 70, "正在构建卡片...", {
				totalItems: apkgData.notes.length,
				completedItems: 0,
			});

			const cards: Card[] = [];
			for (let i = 0; i < apkgData.notes.length; i++) {
				const note = apkgData.notes[i];
				const model = apkgData.models.find((m) => m.id === note.mid);

				if (!model) {
					errors.push({
						noteId: note.id,
						stage: "building",
						message: `未找到模型: ${note.mid}`,
						code: "MODEL_NOT_FOUND",
					});
					stats.failedCards++;
					continue;
				}

				// 🆕 获取对应的模板
				const template = importedTemplates.get(model.id);

				// 🆕 v2.2: 传递 deckName 以写入 we_decks
				const result = this.cardBuilder.build({
					note,
					model,
					deckId: deck.id,
					deckName: deck.name, // 🆕 用于写入 content YAML 的 we_decks
					templateId: template?.id,
					fieldSideMap: fieldSideMap[model.id],
					mediaPathMap: mediaResult.savedFiles,
					conversionConfig: config.conversion,
				});

				if (result.success && result.card) {
					cards.push(result.card as Card);
					stats.importedCards++;
				} else {
					stats.failedCards++;
					errors.push({
						noteId: note.id,
						stage: "building",
						message: result.warnings.join("; "),
						code: "BUILD_FAILED",
					});
				}

				// 更新进度
				if (i % 10 === 0) {
					this.updateProgress(
						"building",
						70 + (i / apkgData.notes.length) * 15,
						"正在构建卡片...",
						{
							totalItems: apkgData.notes.length,
							completedItems: i,
						}
					);
				}
			}

			// 6. 保存到存储
			this.updateProgress("saving", 90, "正在保存数据...");
			await this.dataStorage.createCards(cards);
			await this.dataStorage.saveAll();

			// 7. 完成
			this.updateProgress("saving", 100, "导入完成！");

			const duration = Date.now() - startTime;
			this.logger.info(
				`导入完成: ${stats.importedCards}/${stats.totalCards} 张卡片, 耗时 ${duration}ms`
			);

			return {
				success: errors.length === 0,
				deckId: deck.id,
				deckName: deck.name,
				stats,
				errors,
				warnings,
				duration,
			};
		} catch (error) {
			this.logger.error("导入失败", error);

			errors.push({
				stage: "parsing",
				message: error instanceof Error ? error.message : String(error),
				code: "IMPORT_FAILED",
				stack: error instanceof Error ? error.stack : undefined,
			});

			return {
				success: false,
				stats,
				errors,
				warnings,
				duration: Date.now() - startTime,
			};
		}
	}

	/**
	 * 获取或创建牌组
	 */
	private async getOrCreateDeck(name: string): Promise<Deck> {
		// 尝试获取已存在的牌组
		let deck = await this.dataStorage.getDeckByName(name);

		if (!deck) {
			const now = new Date().toISOString();
			// 创建新牌组 - 使用完整的Deck接口
			deck = {
				id: generateId(),
				name,
				description: "从 APKG文件导入的牌组",
				category: "",
				path: name,
				level: 0,
				order: 0,
				inheritSettings: false,
				settings: this.createDefaultDeckSettings(),
				stats: this.createEmptyDeckStats(),
				includeSubdecks: false,
				created: now,
				modified: now,
				tags: [],
				metadata: {
					source: "apkg_import",
					importedAt: now,
				},
			};

			await this.dataStorage.createDeck(deck);
			this.logger.info(`创建新牌组: ${deck.name} (${deck.id})`);
		} else {
			this.logger.info(`使用已存在牌组: ${deck.name} (${deck.id})`);
		}

		// deck 在此时不会为 null，因为上面已经处理了两种情况
		return deck;
	}

	/**
	 * 更新进度
	 */
	private updateProgress(
		stage: ImportProgress["stage"],
		progress: number,
		message: string,
		extra?: { totalItems?: number; completedItems?: number; currentItem?: string }
	): void {
		if (this.progressCallback) {
			this.progressCallback({
				stage,
				progress,
				message,
				detail: extra?.currentItem,
				totalItems: extra?.totalItems,
				completedItems: extra?.completedItems,
			});
		}
	}

	/**
	 * 🆕 创建或复用模板
	 *
	 * @param models - Anki模型列表
	 * @param fieldSideMap - 字段显示面映射
	 * @param plugin - 插件实例
	 * @returns 模板ID到模板的映射
	 */
	private async createTemplates(
		models: import("../../../domain/apkg/types").AnkiModel[],
		fieldSideMap: import("../../../domain/apkg/types").FieldSideMap,
		plugin: WeavePlugin
	): Promise<Map<number, ParseTemplate>> {
		const templateMap = new Map<number, ParseTemplate>();
		let hasNewTemplates = false;

		let simplifiedParsing: SimplifiedParsingSettings;
		if (plugin.settings.simplifiedParsing) {
			simplifiedParsing = {
				...DEFAULT_SIMPLIFIED_PARSING_SETTINGS,
				...plugin.settings.simplifiedParsing,
				symbols: {
					...DEFAULT_SIMPLIFIED_PARSING_SETTINGS.symbols,
					...plugin.settings.simplifiedParsing.symbols,
				},
				batchParsing: {
					...DEFAULT_SIMPLIFIED_PARSING_SETTINGS.batchParsing,
					...plugin.settings.simplifiedParsing.batchParsing,
				},
			};
		} else {
			simplifiedParsing = { ...DEFAULT_SIMPLIFIED_PARSING_SETTINGS };
		}

		if (!Array.isArray(simplifiedParsing.templates)) {
			simplifiedParsing.templates = [];
		}

		plugin.settings.simplifiedParsing = simplifiedParsing;

		const settings = simplifiedParsing;

		this.logger.info(`开始为 ${models.length} 个Anki模型创建模板`);

		for (const model of models) {
			// 检查是否已存在
			const existing = this.templateConverter.findExistingTemplate(model.id, settings.templates);

			if (existing) {
				this.logger.info(`复用已存在模板: ${existing.name} (Model ID: ${model.id})`);
				templateMap.set(model.id, existing);
				continue;
			}

			// 创建新模板
			const newTemplate = this.templateConverter.convertModelToTemplate(
				model,
				fieldSideMap[model.id]
			);

			// 保存到settings
			settings.templates.push(newTemplate);
			hasNewTemplates = true;

			this.logger.info(`创建新模板: ${newTemplate.name} (Model ID: ${model.id})`);
			templateMap.set(model.id, newTemplate);
		}

		if (hasNewTemplates) {
			await plugin.saveSettings();
		}

		this.logger.info(`模板创建完成: ${templateMap.size} 个模板`);
		return templateMap;
	}
}
