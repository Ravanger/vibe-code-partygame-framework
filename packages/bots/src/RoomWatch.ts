import { waitFor } from "@partygame/client-utils";
import { RoomCodeSchema } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { OPEN_TIMEOUT_MS } from "./timeouts.js";

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

/**
 * Captures the room code at its first well-formed value — a later read can be malformed after a
 * decode hiccup — and rejects when the room closes or `timeoutMs` passes.
 */
export function captureRoomCode(
  watch: RoomWatch,
  stateOf: () => BaseGameState | undefined,
  timeoutMs = OPEN_TIMEOUT_MS,
): Promise<string> {
  let code = "";
  return watch
    .until(
      () => {
        const candidate = stateOf()?.roomCode ?? "";
        if (RoomCodeSchema.safeParse(candidate).success) {
          code = candidate;
          return true;
        }
        return false;
      },
      timeoutMs,
      "the room code",
    )
    .then(() => code);
}
