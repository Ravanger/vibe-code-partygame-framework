import { ResolveCodeResponseSchema } from "@partygame/shared";

/** Why {@link resolveRoomCode} failed: the API knows no such room, or its reply was not a resolve-code answer. */
export type RoomCodeFailure = "not-found" | "bad-reply";

/** Thrown by {@link resolveRoomCode}; `message` is the API's text (or a fixed one for a bad reply). */
export class RoomCodeError extends Error {
  readonly reason: RoomCodeFailure;

  constructor(reason: RoomCodeFailure, message: string) {
    super(message);
    this.name = "RoomCodeError";
    this.reason = reason;
  }
}

/**
 * Turns a four-letter code into a room id through `GET {apiBase}/api/resolve-code`.
 * Rejects with a {@link RoomCodeError} when the API answers "not found" or something else than a resolve-code reply.
 */
export async function resolveRoomCode(apiBase: string, code: string): Promise<string> {
  const response = await fetch(`${apiBase}/api/resolve-code?code=${code}`);
  const body = ResolveCodeResponseSchema.safeParse(await response.json());
  if (!body.success) throw new RoomCodeError("bad-reply", "Unexpected reply from the game server");
  if ("roomId" in body.data) return body.data.roomId;
  throw new RoomCodeError("not-found", body.data.error);
}
