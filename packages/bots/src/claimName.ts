import { ClientMessage, isServerError, ServerMessage, waitFor } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

const STEP_TIMEOUT_MS = 5000;

/** The part of a room that choosing a name needs. */
export interface SeatRoom {
  readonly state: BaseGameState;
  onMessage(type: string, callback: (payload: unknown) => void): () => void;
  send(type: string, payload?: unknown): void;
}

/** Sends `SET_NAME` and waits until the seat carries it; throws the server's reason when refused. */
export async function claimName(
  room: SeatRoom,
  playerId: string,
  name: string,
  timeoutMs = STEP_TIMEOUT_MS,
): Promise<void> {
  await waitFor(() => room.state.roomCode !== "", "the room state", timeoutMs);
  let refusal = "";
  const unsubscribe = room.onMessage(ServerMessage.ERROR, (payload: unknown) => {
    if (isServerError(payload)) refusal = payload.message;
  });
  try {
    room.send(ClientMessage.SET_NAME, name);
    await waitFor(
      () => refusal !== "" || room.state.players.get(playerId)?.name === name,
      "your name to be accepted",
      timeoutMs,
    );
  } finally {
    unsubscribe();
  }
  if (refusal !== "") throw new Error(refusal);
}
