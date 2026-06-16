export type EventHandler = (...args: any[]) => void;

export class EventEmitter<T extends Record<string, EventHandler>> {
  private events: Map<keyof T, Set<EventHandler>> = new Map();
  
  on<K extends keyof T>(event: K, handler: T[K]): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }
  
  off<K extends keyof T>(event: K, handler: T[K]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }
  
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      });
    }
  }
  
  once<K extends keyof T>(event: K, handler: T[K]): void {
    const wrappedHandler = ((...args: any[]) => {
      this.off(event, wrappedHandler as T[K]);
      handler(...args);
    }) as T[K];
    this.on(event, wrappedHandler);
  }
  
  removeAllListeners(event?: keyof T): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
  
  listenerCount(event: keyof T): number {
    const handlers = this.events.get(event);
    return handlers ? handlers.size : 0;
  }
}