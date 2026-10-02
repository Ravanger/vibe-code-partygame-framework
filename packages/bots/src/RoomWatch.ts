import { waitFor } from "@partygame/shared";

const POLL_MS = 20;

/** Tracks whether a room has closed, so waits on its state can fail instead of hanging. */
export class RoomWatch {
  private closed = false;

  constructor(room: { onLeave(callback: () => void): unknown }) {
    room.onLeave(() => {
      this.closed = true;
    });
  }

  get gone(): boolean {
    return this.closed;
  }

  /** Resolves once `predicate` holds; rejects when the room closes or `timeoutMs` passes. */
  until(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
    return waitFor(
      () => {
        if (this.closed) throw new Error(`The room closed while waiting for ${what}`);
        return predicate();
      },
      what,
      timeoutMs,
      POLL_MS,
    );
  }
}
