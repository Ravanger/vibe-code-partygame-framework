import type { BaseGameState } from "@partygame/shared/schema";
import type { RoomLike } from "./RoomLike.js";

interface Listener {
  type: string;
  callback: (payload: unknown) => void;
  off: (() => void) | undefined;
}

/**
 * The manager's message-listener registry. Listeners survive room changes: `bind` re-attaches
 * every registered listener to the new room, and a listener added while bound attaches at once.
 */
export class MessageBus<TState extends BaseGameState = BaseGameState> {
  private readonly listeners = new Set<Listener>();
  private room: RoomLike<TState> | undefined;

  /** Registers a listener; attaches it to the current room if there is one. Returns an unsubscribe. */
  on(type: string, callback: (payload: unknown) => void): () => void {
    const listener: Listener = { type, callback, off: this.room?.onMessage(type, callback) };
    this.listeners.add(listener);
    return () => {
      listener.off?.();
      this.listeners.delete(listener);
    };
  }

  /** Detaches every listener from the previous room and attaches them all to `room` (or none). */
  bind(room: RoomLike<TState> | undefined): void {
    this.unbind();
    this.room = room;
    for (const listener of this.listeners) {
      listener.off = room?.onMessage(listener.type, listener.callback);
    }
  }

  /** Detaches every listener from the current room; the registry is kept. */
  unbind(): void {
    for (const listener of this.listeners) {
      listener.off?.();
      listener.off = undefined;
    }
    this.room = undefined;
  }

  /** Detaches everything and drops the registry. */
  clear(): void {
    this.unbind();
    this.listeners.clear();
  }
}
