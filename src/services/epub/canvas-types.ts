export interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

export interface CanvasNode {
	id: string;
	type: 'text' | 'file' | 'link' | 'group';
	text?: string;
	file?: string;
	url?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
	label?: string;
}

export interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide: CanvasSide;
	toSide: CanvasSide;
	fromEnd?: 'arrow' | 'none';
	toEnd?: 'arrow' | 'none';
	color?: string;
	label?: string;
}

export type CanvasSide = 'top' | 'bottom' | 'left' | 'right';

export type CanvasInsertMode = 'child' | 'sibling';

export type CanvasLayoutDirection = 'down' | 'right' | 'up' | 'left';

export interface CanvasAnchor {
	nodeId: string;
	parentNodeId: string | null;
}

export const HIGHLIGHT_TO_CANVAS_COLOR: Record<string, string> = {
	yellow: '4',
	green: '5',
	blue: '6',
	pink: '1',
	purple: '3'
};

export const DEFAULT_NODE_WIDTH = 300;
export const DEFAULT_NODE_HEIGHT = 120;
export const NODE_GAP_X = 50;
export const NODE_GAP_Y = 40;
