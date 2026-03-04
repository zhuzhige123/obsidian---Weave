type Subscriber = (ctx: IRActiveBlockContext | null) => void;

export interface IRActiveBlockContext {
  sourcePath: string;
  startLine: number;
  endLine?: number;
}

class IRActiveBlockContextStore {
  private current: IRActiveBlockContext | null = null;
  private subscribers: Set<Subscriber> = new Set();

  setActiveContext(ctx: IRActiveBlockContext | null): void {
    this.current = ctx;
    this.notifySubscribers();
  }

  getActiveContext(): IRActiveBlockContext | null {
    return this.current;
  }

  clearActiveContext(): void {
    this.current = null;
    this.notifySubscribers();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.current);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(cb => cb(this.current));
  }
}

export const irActiveBlockContextStore = new IRActiveBlockContextStore();
