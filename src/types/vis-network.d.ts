/**
 * vis-network 类型定义文件
 * 用于补充 vis-network 包的 TypeScript 类型
 */

declare module 'vis-network' {
  export interface Node {
    id: string | number;
    label?: string;
    title?: string;
    color?: string | { background?: string; border?: string };
    shape?: string;
    size?: number;
    level?: number;
    group?: string;
    [key: string]: any;
  }

  export interface Edge {
    id?: string | number;
    from: string | number;
    to: string | number;
    label?: string;
    arrows?: string | { to?: boolean; from?: boolean };
    color?: string | { color?: string; highlight?: string; hover?: string };
    width?: number;
    dashes?: boolean | number[];
    font?: { size?: number; color?: string };
    [key: string]: any;
  }

  export interface DataSet<T> {
    add(data: T | T[]): void;
    clear(): void;
    get(id?: string | number | string[] | number[]): T | T[] | null;
    update(data: T | T[]): void;
    remove(id: string | number | string[] | number[]): void;
    length: number;
  }

  export interface Options {
    nodes?: any;
    edges?: any;
    physics?: any;
    interaction?: any;
    layout?: any;
    [key: string]: any;
  }

  export interface Position {
    x: number;
    y: number;
  }

  export interface FocusOptions {
    scale?: number;
    offset?: Position;
    locked?: boolean;
    animation?: boolean | {
      duration?: number;
      easingFunction?: string;
    };
  }

  export class Network {
    constructor(
      container: HTMLElement,
      data: { nodes: DataSet<Node>; edges: DataSet<Edge> },
      options?: Options
    );
    
    on(event: string, callback: (params: any) => void): void;
    once(event: string, callback: (params: any) => void): void;
    off(event: string, callback?: (params: any) => void): void;
    
    focus(nodeId: string | number, options?: FocusOptions): void;
    fit(options?: { animation?: boolean }): void;
    getNodeAt(position: Position): string | number | undefined;
    setOptions(options: Options): void;
    destroy(): void;
    
    physics?: { options?: { enabled?: boolean } };
  }

  export class DataSet<T> {
    constructor(data?: T[], options?: any);
    add(data: T | T[]): void;
    clear(): void;
    get(id?: string | number | string[] | number[]): T | T[] | null;
    update(data: T | T[]): void;
    remove(id: string | number | string[] | number[]): void;
    length: number;
  }
}
