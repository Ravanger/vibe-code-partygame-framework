import { ResolveCodeResponseSchema } from "./protocol.js";

/** Turns a four-letter code into a room id through `GET {apiBase}/api/resolve-code`. */
export async function resolveRoomCode(apiBase: string, code: string): Promise<string> {
  const response = await fetch(`${apiBase}/api/resolve-code?code=${code}`);
  const body = ResolveCodeResponseSchema.safeParse(await response.json());
  if (!body.success) throw new Error("Unexpected reply from the game server");
  if ("roomId" in body.data) return body.data.roomId;
  throw new Error(body.data.error);
}
