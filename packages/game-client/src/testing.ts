import type { BaseGameState } from "@partygame/shared/schema";
import type { RoomLike } from "./RoomLike.js";

type Signal<TArgs extends unknown[]> = ((callback: (...args: TArgs) => void) => void) & {
  remove(callback: (...args: TArgs) => void): void;
};

function signal<TArgs extends unknown[]>(): {
  subscribe: Signal<TArgs>;
  fire(...args: TArgs): void;
} {
  const callbacks = new Set<(...args: TArgs) => void>();
  const subscribe = Object.assign(
    (callback: (...args: TArgs) => void) => {
      callbacks.add(callback);
    },
    {
      remove: (callback: (...args: TArgs) => void) => {
        callbacks.delete(callback);
      },
    },
  );
  return {
    subscribe,
    fire: (...args) => {
      for (const callback of [...callbacks]) callback(...args);
    },
  };
}

/**
 * An in-memory room around a real state object, for testing UI code without a server.
 * Mutate `state`, then call `patch()` the way Colyseus would after applying a patch.
 */
export class StubRoom<TState extends BaseGameState> implements RoomLike<TState> {
  readonly roomId = "stub-room";
  reconnectionToken = "stub-token";
  readonly requests: Array<{ type: string; payload: unknown }> = [];
  readonly sent: Array<{ type: string; payload: unknown }> = [];
  /** What `request` resolves with next; set to a rejected result to test failures. */
  reply: unknown = { ok: true };

  private readonly stateChange = signal<[TState]>();
  private readonly drop = signal<[]>();
  private readonly reconnect = signal<[]>();
  private readonly leaveSignal = signal<[]>();
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(readonly state: TState) {}

  readonly onStateChange = this.stateChange.subscribe;
  readonly onDrop = this.drop.subscribe;
  readonly onReconnect = this.reconnect.subscribe;
  readonly onLeave = this.leaveSignal.subscribe;

  onMessage(type: string, callback: (payload: unknown) => void): () => void {
    const handlers = this.handlersOf(type);
    handlers.add(callback);
    return () => {
      handlers.delete(callback);
    };
  }

  send(type: string, payload?: unknown): void {
    this.sent.push({ type, payload });
  }

  async request(type: string, payload?: unknown): Promise<unknown> {
    this.requests.push({ type, payload });
    return this.reply;
  }

  async leave(): Promise<number> {
    this.leaveSignal.fire();
    return 1000;
  }

  patch(): void {
    this.stateChange.fire(this.state);
  }

  push(type: string, payload: unknown): void {
    for (const handler of this.handlersOf(type)) handler(payload);
  }

  dropConnection(): void {
    this.drop.fire();
  }

  reconnected(): void {
    this.reconnect.fire();
  }

  closed(): void {
    this.leaveSignal.fire();
  }

  messageListeners(type: string): number {
    return this.handlersOf(type).size;
  }

  private handlersOf(type: string): Set<(payload: unknown) => void> {
    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }
    return handlers;
  }
}
