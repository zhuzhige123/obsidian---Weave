/**
 * 看板拖拽上下文
 * 集中管理拖拽状态和逻辑
 */
import { getContext, setContext } from 'svelte';
import type { Card } from '../../data/types';

const KANBAN_DRAG_CONTEXT_KEY = Symbol('kanban-drag-context');

/**
 * 支持拖拽的分组类型
 */
export type DraggableGroupBy = 'deck' | 'priority';

/**
 * 所有分组类型
 */
export type GroupByType = 'status' | 'type' | 'priority' | 'deck' | 'createTime';

/**
 * 拖拽状态接口
 */
export interface KanbanDragState {
  /** 当前拖拽的卡片 */
  draggedCard: Card | null;
  /** 拖拽经过的列 */
  dragOverColumn: string | null;
  /** 拖拽经过的索引位置 */
  dragOverIndex: number;
  /** 是否正在拖拽 */
  isDragging: boolean;
}

/**
 * 拖拽上下文接口
 */
export interface KanbanDragContext {
  /** 当前分组方式 */
  groupBy: GroupByType;
  /** 是否允许拖拽（根据分组方式判断） */
  isDraggable: boolean;
  /** 拖拽状态 */
  state: KanbanDragState;
  /** 开始拖拽 */
  startDrag: (card: Card, e: DragEvent) => void;
  /** 结束拖拽 */
  endDrag: () => void;
  /** 拖拽经过 */
  dragOver: (columnKey: string, index?: number) => void;
  /** 拖拽离开 */
  dragLeave: () => void;
  /** 放下卡片 */
  drop: (targetColumnKey: string) => Promise<void>;
  /** 检查是否可以放到目标列 */
  canDropTo: (sourceKey: string, targetKey: string) => { allowed: boolean; reason?: string };
}

/**
 * 判断分组方式是否支持拖拽
 */
export function isDraggableGroupBy(groupBy: GroupByType): groupBy is DraggableGroupBy {
  return groupBy === 'deck' || groupBy === 'priority';
}

/**
 * 获取拖拽限制原因
 */
export function getDragRestrictionReason(groupBy: GroupByType): string | null {
  switch (groupBy) {
    case 'status':
      return '学习状态由FSRS算法自动管理，无法手动修改';
    case 'type':
      return '卡片类型无法通过拖拽修改';
    case 'createTime':
      return '创建时间无法修改';
    default:
      return null;
  }
}

/**
 * 创建拖拽上下文初始状态
 */
export function createInitialDragState(): KanbanDragState {
  return {
    draggedCard: null,
    dragOverColumn: null,
    dragOverIndex: -1,
    isDragging: false
  };
}

/**
 * 设置拖拽上下文
 */
export function setKanbanDragContext(context: KanbanDragContext): void {
  setContext(KANBAN_DRAG_CONTEXT_KEY, context);
}

/**
 * 获取拖拽上下文
 */
export function getKanbanDragContext(): KanbanDragContext {
  return getContext<KanbanDragContext>(KANBAN_DRAG_CONTEXT_KEY);
}
