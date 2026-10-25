import { ResolveCodeResponseSchema, RoomCodeSchema } from "@partygame/shared";

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
 * Turns a room code into a room id through `GET {apiBase}/api/resolve-code`.
 * Rejects with an `Error` when the code is not well-formed, the server cannot be reached or answers
 * non-2xx (a 404 JSON body keeps the API's reason), and with a {@link RoomCodeError} when the API
 * answers "not found" or something else than a resolve-code reply (including a body that is not JSON).
 */
export async function resolveRoomCode(apiBase: string, code: string): Promise<string> {
  if (!RoomCodeSchema.safeParse(code).success) throw new Error("Invalid room code");
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/resolve-code?code=${encodeURIComponent(code)}`);
  } catch {
    throw new Error("Could not reach the game server");
  }
  if (!response.ok) {
    // A 404 JSON body carries the API's reason ("Game code not found"); keep it (existing behaviour).
    const parsed = ResolveCodeResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (response.status === 404 && parsed.success && "error" in parsed.data) {
      throw new RoomCodeError("not-found", parsed.data.error);
    }
    throw new Error(`The game server answered ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RoomCodeError("bad-reply", "Unexpected reply from the game server");
  }
  const parsed = ResolveCodeResponseSchema.safeParse(body);
  if (!parsed.success)
    throw new RoomCodeError("bad-reply", "Unexpected reply from the game server");
  if ("roomId" in parsed.data) return parsed.data.roomId;
  throw new RoomCodeError("not-found", parsed.data.error);
}
