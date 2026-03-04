import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { generateUUID } from '../../utils/helpers';
import { EpubLinkService } from './EpubLinkService';
import type {
	CanvasData,
	CanvasNode,
	CanvasEdge,
	CanvasAnchor,
	CanvasLayoutDirection,
	CanvasSide
} from './canvas-types';
import {
	HIGHLIGHT_TO_CANVAS_COLOR,
	DEFAULT_NODE_WIDTH,
	DEFAULT_NODE_HEIGHT,
	NODE_GAP_X,
	NODE_GAP_Y
} from './canvas-types';

export class EpubCanvasService {
	private app: App;
	private linkService: EpubLinkService;
	private canvasPath: string | null = null;
	private anchor: CanvasAnchor | null = null;
	private layoutDirection: CanvasLayoutDirection = 'down';

	constructor(app: App) {
		this.app = app;
		this.linkService = new EpubLinkService(app);
	}

	getCanvasPath(): string | null {
		return this.canvasPath;
	}

	setCanvasPath(path: string | null): void {
		this.canvasPath = path;
	}

	getLayoutDirection(): CanvasLayoutDirection {
		return this.layoutDirection;
	}

	setLayoutDirection(dir: CanvasLayoutDirection): void {
		this.layoutDirection = dir;
	}

	getAnchor(): CanvasAnchor | null {
		return this.anchor;
	}

	setAnchor(anchor: CanvasAnchor | null): void {
		this.anchor = anchor;
	}

	isActive(): boolean {
		return this.canvasPath !== null;
	}

	async createCanvas(canvasPath: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!canvasPath.endsWith('.canvas')) {
			canvasPath += '.canvas';
		}

		const dir = canvasPath.substring(0, canvasPath.lastIndexOf('/'));
		if (dir && !(await adapter.exists(dir))) {
			await adapter.mkdir(dir);
		}

		const emptyCanvas: CanvasData = { nodes: [], edges: [] };
		await adapter.write(canvasPath, JSON.stringify(emptyCanvas));
		this.canvasPath = canvasPath;
	}

	async readCanvas(): Promise<CanvasData> {
		if (!this.canvasPath) {
			return { nodes: [], edges: [] };
		}

		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.canvasPath))) {
			return { nodes: [], edges: [] };
		}

		try {
			const content = await adapter.read(this.canvasPath);
			return JSON.parse(content) as CanvasData;
		} catch (e) {
			console.warn('[EpubCanvasService] Failed to read canvas:', e);
			return { nodes: [], edges: [] };
		}
	}

	private async writeCanvas(data: CanvasData): Promise<void> {
		if (!this.canvasPath) return;
		await this.app.vault.adapter.write(this.canvasPath, JSON.stringify(data));
	}

	async addExcerptNode(
		text: string,
		cfiRange: string,
		filePath: string,
		chapterIndex?: number,
		chapterTitle?: string,
		color?: string
	): Promise<CanvasNode | null> {
		if (!this.canvasPath) return null;

		try {
			const data = await this.readCanvas();

			const noteContent = this.linkService.buildQuoteBlock(
				filePath, cfiRange, text, chapterIndex, color, chapterTitle
			);

			const nodeId = this.generateNodeId();
			const canvasColor = color ? HIGHLIGHT_TO_CANVAS_COLOR[color] : undefined;
			const position = this.calculateNodePosition(data);

			const node: CanvasNode = {
				id: nodeId,
				type: 'text',
				text: noteContent,
				x: position.x,
				y: position.y,
				width: DEFAULT_NODE_WIDTH,
				height: DEFAULT_NODE_HEIGHT,
				...(canvasColor && { color: canvasColor })
			};

			data.nodes.push(node);

			const parentId = this.resolveParentNodeId();
			if (parentId) {
				const sides = this.getEdgeSides();
				const edge: CanvasEdge = {
					id: this.generateNodeId(),
					fromNode: parentId,
					toNode: nodeId,
					fromSide: sides.fromSide,
					toSide: sides.toSide
				};
				data.edges.push(edge);
			}

			await this.writeCanvas(data);

			this.anchor = {
				nodeId,
				parentNodeId: parentId
			};

			return node;
		} catch (e) {
			console.error('[EpubCanvasService] Failed to add excerpt node:', e);
			new Notice('Failed to add node to canvas');
			return null;
		}
	}

	async addRawTextNode(content: string, color?: string): Promise<CanvasNode | null> {
		if (!this.canvasPath) return null;

		try {
			const data = await this.readCanvas();
			const nodeId = this.generateNodeId();
			const canvasColor = color ? HIGHLIGHT_TO_CANVAS_COLOR[color] : undefined;
			const position = this.calculateNodePosition(data);

			const node: CanvasNode = {
				id: nodeId,
				type: 'text',
				text: content,
				x: position.x,
				y: position.y,
				width: DEFAULT_NODE_WIDTH,
				height: DEFAULT_NODE_HEIGHT,
				...(canvasColor && { color: canvasColor })
			};

			data.nodes.push(node);

			const parentId = this.resolveParentNodeId();
			if (parentId) {
				const sides = this.getEdgeSides();
				const edge: CanvasEdge = {
					id: this.generateNodeId(),
					fromNode: parentId,
					toNode: nodeId,
					fromSide: sides.fromSide,
					toSide: sides.toSide
				};
				data.edges.push(edge);
			}

			await this.writeCanvas(data);

			this.anchor = {
				nodeId,
				parentNodeId: parentId
			};

			return node;
		} catch (e) {
			console.error('[EpubCanvasService] Failed to add raw text node:', e);
			new Notice('Failed to add node to canvas');
			return null;
		}
	}

	private resolveParentNodeId(): string | null {
		if (!this.anchor) return null;
		return this.anchor.nodeId;
	}

	private getEdgeSides(): { fromSide: CanvasSide; toSide: CanvasSide } {
		switch (this.layoutDirection) {
			case 'down':  return { fromSide: 'bottom', toSide: 'top' };
			case 'up':    return { fromSide: 'top', toSide: 'bottom' };
			case 'right': return { fromSide: 'right', toSide: 'left' };
			case 'left':  return { fromSide: 'left', toSide: 'right' };
		}
	}

	private calculateNodePosition(data: CanvasData): { x: number; y: number } {
		if (!this.anchor) {
			return this.calculateRootPosition(data);
		}

		const anchorNode = data.nodes.find(n => n.id === this.anchor!.nodeId);
		if (!anchorNode) {
			return this.calculateRootPosition(data);
		}

		return this.calculateDirectionalPosition(anchorNode);
	}

	private calculateRootPosition(data: CanvasData): { x: number; y: number } {
		if (data.nodes.length === 0) {
			return { x: 0, y: 0 };
		}

		switch (this.layoutDirection) {
			case 'down': {
				let maxY = -Infinity;
				for (const node of data.nodes) {
					const bottom = node.y + node.height;
					if (bottom > maxY) maxY = bottom;
				}
				return { x: 0, y: maxY + NODE_GAP_Y };
			}
			case 'up': {
				let minY = Infinity;
				for (const node of data.nodes) {
					if (node.y < minY) minY = node.y;
				}
				return { x: 0, y: minY - DEFAULT_NODE_HEIGHT - NODE_GAP_Y };
			}
			case 'right': {
				let maxX = -Infinity;
				for (const node of data.nodes) {
					const right = node.x + node.width;
					if (right > maxX) maxX = right;
				}
				return { x: maxX + NODE_GAP_X, y: 0 };
			}
			case 'left': {
				let minX = Infinity;
				for (const node of data.nodes) {
					if (node.x < minX) minX = node.x;
				}
				return { x: minX - DEFAULT_NODE_WIDTH - NODE_GAP_X, y: 0 };
			}
		}
	}

	private calculateDirectionalPosition(anchor: CanvasNode): { x: number; y: number } {
		switch (this.layoutDirection) {
			case 'down':
				return { x: anchor.x, y: anchor.y + anchor.height + NODE_GAP_Y };
			case 'up':
				return { x: anchor.x, y: anchor.y - DEFAULT_NODE_HEIGHT - NODE_GAP_Y };
			case 'right':
				return { x: anchor.x + anchor.width + NODE_GAP_X, y: anchor.y };
			case 'left':
				return { x: anchor.x - DEFAULT_NODE_WIDTH - NODE_GAP_X, y: anchor.y };
		}
	}

	updateAnchorFromCanvasSelection(app: App): void {
		try {
			const canvasLeaves = app.workspace.getLeavesOfType('canvas');
			for (const leaf of canvasLeaves) {
				const canvasView = leaf.view as any;
				if (!canvasView?.canvas) continue;

				const filePath = canvasView.file?.path;
				if (filePath !== this.canvasPath) continue;

				const selection = canvasView.canvas.selection;
				if (!selection || selection.size === 0) {
					return;
				}

				const selectedNode = selection.values().next().value;
				if (!selectedNode?.id) return;

				const data = canvasView.canvas.getData?.();
				let parentNodeId: string | null = null;
				if (data?.edges) {
					const parentEdge = data.edges.find(
						(e: CanvasEdge) => e.toNode === selectedNode.id
					);
					if (parentEdge) {
						parentNodeId = parentEdge.fromNode;
					}
				}

				this.anchor = {
					nodeId: selectedNode.id,
					parentNodeId
				};
				return;
			}
		} catch (e) {
			console.warn('[EpubCanvasService] Failed to read canvas selection:', e);
		}
	}

	async listCanvasFiles(): Promise<string[]> {
		const files = this.app.vault.getFiles();
		return files
			.filter(f => f.extension === 'canvas')
			.map(f => f.path)
			.sort();
	}

	private generateNodeId(): string {
		return generateUUID().replace(/-/g, '').substring(0, 16);
	}
}
